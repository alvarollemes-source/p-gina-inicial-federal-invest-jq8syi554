import { normalizarCodigo } from "./normalize";
import {
  barrasParaLinhaBancaria,
  classificarCodigo,
  extrairInfoBarrasBancario,
  extrairCandidatosLinha,
  linhaArrecadacaoParaBarras,
  linhaBancariaParaBarras,
  nomeBanco,
  validaBarrasBancario,
  validaLinhaArrecadacao,
  validaLinhaDigitavelBancaria,
} from "./validate";
import type { BoletoData, ExtractedAI, Origem } from "./types";
import { BoletoError } from "./errors";
import { decodeBarcodeFromCanvas, decodeBarcodeFromCanvases } from "./barcode";
import { canvasToBase64Png, fileToBase64, imageFileToCanvas, renderPdf } from "./pdf";
import { extractBoletoData } from "./ai.functions";

export const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export type StepId =
  | "preparar"
  | "buscar_barras"
  | "extrair_texto"
  | "validar"
  | "organizar";

export interface PipelineProgress {
  step: StepId;
}

export interface PipelineInput {
  file: File;
  onProgress?: (p: PipelineProgress) => void;
}

export interface PipelineResult {
  data: BoletoData;
  previewCanvases: HTMLCanvasElement[];
}

function emptyData(fileName: string, mime: string, pages: number): BoletoData {
  return {
    tipo_documento: null,
    arquivo: { nome: fileName, tipo: mime, quantidade_paginas: pages },
    banco: { codigo: null, nome: null },
    codigo_barras: { valor: null, quantidade_digitos: 0, origem: null, valido: false },
    linha_digitavel: { valor: null, quantidade_digitos: 0, origem: null, valido: false },
    beneficiario: { nome: null, documento: null, tipo_documento: null, endereco: null },
    pagador: { nome: null, documento: null, tipo_documento: null, endereco: null, cidade: null, estado: null, cep: null },
    vencimento: null,
    valor_documento: null,
    valor_cobrado: null,
    data_documento: null,
    data_processamento: null,
    numero_documento: null,
    nosso_numero: null,
    agencia_codigo_beneficiario: null,
    carteira: null,
    especie: null,
    aceite: null,
    instrucoes: [],
    juros: null,
    multa: null,
    desconto: null,
    outras_deducoes: null,
    outros_acrescimos: null,
    referencia: null,
    numero_instalacao: null,
    nota_fiscal: null,
    chave_nota_fiscal: null,
    informacoes_adicionais: null,
    gps: null,
    confianca: {
      geral: 0,
      codigo_barras: 0,
      linha_digitavel: 0,
      valor: 0,
      vencimento: 0,
    },
    validacao: { status: "nao_identificado", erros: [], alertas: [] },
    texto_original: "",
  };
}

function tipoDoc(codigo: string): "CPF" | "CNPJ" | null {
  const s = codigo.replace(/\D/g, "");
  if (s.length === 11) return "CPF";
  if (s.length === 14) return "CNPJ";
  return null;
}

function docTemFormatoValido(codigo: string | null | undefined): boolean {
  if (!codigo) return false;
  const s = codigo.replace(/\D/g, "");
  return s.length === 11 || s.length === 14;
}

/**
 * Extrai o nome do beneficiário a partir do texto bruto do PDF, priorizando
 * os rótulos da estrutura bancária do boleto (Beneficiário, Cedente, etc.).
 * Retorna null quando nenhum rótulo é encontrado — nesse caso, o chamador
 * deve manter o valor extraído pela IA.
 */
export function extrairBeneficiarioDoTexto(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const linhas = texto.split(/\r?\n/).map((l) => l.trim());
  const rotulos = [
    /^Benefici[aá]rio\s*\/\s*Cedente\b/i,
    /^Nome\s+do\s+benefici[aá]rio\b/i,
    /^Raz[aã]o\s+social\s+do\s+benefici[aá]rio\b/i,
    /^Benefici[aá]rio\b/i,
    /^Cedente\b/i,
  ];
  const stop = /^(Ag[eê]ncia|C[oó]digo|CPF|CNPJ|CPF\/CNPJ|Data|Vencimento|Nosso|N[uú]mero|Esp[eé]cie|Aceite|Carteira|Valor|Instru[cç][oõ]es|Sacado|Pagador|Local)\b/i;
  const nomeRegex = /^[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .,&\/\-']{2,}$/;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    for (const rx of rotulos) {
      const m = linha.match(rx);
      if (!m) continue;
      // Caso 1: nome na mesma linha, depois do rótulo (com : ou -).
      const inline = linha
        .slice(m[0].length)
        .replace(/^[\s:\-]+/, "")
        .trim();
      const inlineLimpo = inline.replace(/\s{2,}.*$/, "").trim();
      if (inlineLimpo && !stop.test(inlineLimpo) && inlineLimpo.length >= 3) {
        return inlineLimpo;
      }
      // Caso 2: próxima(s) linha(s) contêm o nome.
      for (let j = i + 1; j < Math.min(i + 4, linhas.length); j++) {
        const prox = linhas[j];
        if (!prox) continue;
        if (stop.test(prox)) break;
        if (nomeRegex.test(prox)) return prox;
      }
    }
  }
  return null;
}

export async function processarBoleto({ file, onProgress }: PipelineInput): Promise<PipelineResult> {
  const emit = (step: StepId) => onProgress?.({ step });

  // Validação básica
  const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
  if (!allowed.includes(file.type) && !/\.(pdf|jpg|jpeg|png)$/i.test(file.name)) {
    throw new BoletoError("arquivo_nao_suportado");
  }
  if (file.size > MAX_SIZE_BYTES) throw new BoletoError("arquivo_muito_grande");

  emit("preparar");

  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  // 1. Renderiza páginas / imagem
  let canvases: HTMLCanvasElement[] = [];
  let pdfText = "";
  let pages = 1;

  if (isPdf) {
    const buffer = await file.arrayBuffer();
    try {
      const { pages: rendered, fullText } = await renderPdf(buffer, 2);
      if (rendered.length === 0) throw new BoletoError("pdf_sem_paginas");
      canvases = rendered.map((p) => p.canvas);
      pdfText = fullText;
      pages = rendered.length;
    } catch (e) {
      if (e instanceof BoletoError) throw e;
      const msg = e instanceof Error ? e.message : "";
      if (/password/i.test(msg)) throw new BoletoError("pdf_protegido");
      throw new BoletoError("erro_ocr", msg);
    }
  } else {
    const canvas = await imageFileToCanvas(file);
    canvases = [canvas];
  }

  const data = emptyData(file.name, file.type || (isPdf ? "application/pdf" : "image/*"), pages);
  data.texto_original = pdfText;

  // 2. Leitura direta do código de barras
  emit("buscar_barras");
  let barrasLidas = normalizarCodigo(decodeBarcodeFromCanvases(canvases) ?? "");
  // ZXing pode capturar códigos aleatórios (EAN, etc). Só aceita 44 dígitos.
  if (barrasLidas.length !== 44) barrasLidas = "";
  let origemBarras: Origem | null = barrasLidas ? "leitura_visual" : null;

  // 3. Extração de linha digitável no texto
  emit("extrair_texto");
  let linhaTexto: string | null = null;
  let linhaTipo: "bancaria" | "arrecadacao" | null = null;
  if (pdfText) {
    const candidatos = extrairCandidatosLinha(pdfText);
    // Escolhe o primeiro candidato VÁLIDO; se nenhum validar, guarda o primeiro
    // para permitir edição manual pelo usuário.
    let escolhido: { linha: string; tipo: "bancaria" | "arrecadacao" } | null = null;
    for (const c of candidatos) {
      const v =
        c.tipo === "bancaria"
          ? validaLinhaDigitavelBancaria(c.linha)
          : validaLinhaArrecadacao(c.linha);
      if (v.valido) {
        escolhido = c;
        break;
      }
    }
    if (!escolhido && candidatos.length > 0) escolhido = candidatos[0];
    if (escolhido) {
      linhaTexto = escolhido.linha;
      linhaTipo = escolhido.tipo;
      data.linha_digitavel.origem = "texto_pdf";
    }
  }
  void linhaTipo;

  // 4. IA visual (usa primeira página / imagem, ou primeira canvas do PDF quando texto vazio)
  let aiData: ExtractedAI | null = null;
  try {
    let imageBase64: string;
    let mime: string;
    if (isPdf) {
      imageBase64 = canvasToBase64Png(canvases[0]);
      mime = "image/png";
    } else {
      imageBase64 = await fileToBase64(file);
      mime = file.type || "image/jpeg";
    }
    const res = await extractBoletoData({
      data: { imageBase64, mime, textoOcrDisponivel: pdfText || null },
    });
    if (res.ok) aiData = res.data as ExtractedAI;
  } catch (e) {
    // IA falhou — segue com o que tem
    console.warn("[boletos] falha IA:", e);
  }

  // 5. Consolida código / linha
  emit("validar");

  // Prioriza ZXing > texto do PDF > IA
  const linhaIa = aiData?.linha_digitavel ? normalizarCodigo(aiData.linha_digitavel) : "";
  const barrasIa = aiData?.codigo_barras ? normalizarCodigo(aiData.codigo_barras) : "";

  const validaLinha = (l: string) => {
    if (l.length === 47 && l[0] !== "8") return validaLinhaDigitavelBancaria(l);
    if (l.length === 48 && l[0] === "8") return validaLinhaArrecadacao(l);
    return { valido: false, erros: ["Linha digitável com formato desconhecido."] };
  };

  let linhaFinal = "";
  let linhaOrigem: Origem | null = null;
  // Prioriza uma linha VÁLIDA vinda do texto do PDF; se a do PDF for inválida
  // mas a da IA validar, usa a da IA.
  const linhaIaOk = linhaIa && (linhaIa.length === 47 || linhaIa.length === 48) && validaLinha(linhaIa).valido;
  const linhaTxtOk = linhaTexto ? validaLinha(linhaTexto).valido : false;
  if (linhaTxtOk && linhaTexto) {
    linhaFinal = linhaTexto;
    linhaOrigem = "texto_pdf";
  } else if (linhaIaOk) {
    linhaFinal = linhaIa;
    linhaOrigem = "ia";
  } else if (linhaTexto) {
    linhaFinal = linhaTexto;
    linhaOrigem = "texto_pdf";
  } else if (linhaIa && (linhaIa.length === 47 || linhaIa.length === 48)) {
    linhaFinal = linhaIa;
    linhaOrigem = "ia";
  }

  let barrasFinal = "";
  if (barrasLidas && barrasLidas.length === 44) {
    barrasFinal = barrasLidas;
  } else if (barrasIa && barrasIa.length === 44) {
    barrasFinal = barrasIa;
    origemBarras = "ia";
  }

  // Tenta converter linha → barras quando não há barras diretas
  const classLinha = linhaFinal ? classificarCodigo(linhaFinal) : "desconhecido";
  const validacaoLinha = { valido: false, erros: [] as string[] };
  if (classLinha === "linha_bancaria") {
    const v = validaLinhaDigitavelBancaria(linhaFinal);
    validacaoLinha.valido = v.valido;
    validacaoLinha.erros = v.erros;
    if (v.valido && !barrasFinal) {
      barrasFinal = linhaBancariaParaBarras(linhaFinal);
      origemBarras = origemBarras ?? "ia";
    }
  } else if (classLinha === "linha_arrecadacao") {
    const v = validaLinhaArrecadacao(linhaFinal);
    validacaoLinha.valido = v.valido;
    validacaoLinha.erros = v.erros;
    if (v.valido && !barrasFinal) {
      barrasFinal = linhaArrecadacaoParaBarras(linhaFinal);
      origemBarras = origemBarras ?? "ia";
    }
  }

  // Validação do código de barras bancário
  const validacaoBarras = { valido: false, erros: [] as string[] };
  if (barrasFinal.length === 44 && barrasFinal[0] !== "8") {
    const v = validaBarrasBancario(barrasFinal);
    validacaoBarras.valido = v.valido;
    validacaoBarras.erros = v.erros;
    // Se temos barras válidas mas nenhuma linha, gera a linha
    if (v.valido && !linhaFinal) {
      linhaFinal = barrasParaLinhaBancaria(barrasFinal);
      linhaOrigem = origemBarras;
      const vl = validaLinhaDigitavelBancaria(linhaFinal);
      validacaoLinha.valido = vl.valido;
    }
  } else if (barrasFinal.length === 44 && barrasFinal[0] === "8") {
    // arrecadação — validação via linha (não há DV geral separado no barras).
    validacaoBarras.valido = validacaoLinha.valido;
  }

  data.codigo_barras = {
    valor: barrasFinal || null,
    quantidade_digitos: barrasFinal.length,
    origem: origemBarras,
    valido: validacaoBarras.valido,
  };
  data.linha_digitavel = {
    valor: linhaFinal || null,
    quantidade_digitos: linhaFinal.length,
    origem: linhaOrigem,
    valido: validacaoLinha.valido,
  };

  // Info derivada do código de barras bancário
  if (barrasFinal.length === 44 && validacaoBarras.valido && barrasFinal[0] !== "8") {
    const info = extrairInfoBarrasBancario(barrasFinal);
    if (info.banco) {
      data.banco.codigo = info.banco;
      data.banco.nome = nomeBanco(info.banco);
    }
    if (info.valor != null) data.valor_documento = info.valor;
    // Não derivar vencimento a partir do fator do código de barras — o valor
    // deve vir sempre do documento (extração via IA). Fator é ambíguo entre
    // ciclos FEBRABAN (rollover em 22/02/2025) e pode divergir da data impressa.
  }

  // Merge com IA (só preenche o que ainda é null)
  if (aiData) {
    if (!data.tipo_documento && aiData.tipo_documento) data.tipo_documento = aiData.tipo_documento;
    if (!data.banco.codigo && aiData.banco?.codigo) {
      data.banco.codigo = aiData.banco.codigo;
      data.banco.nome = data.banco.nome ?? aiData.banco.nome ?? nomeBanco(aiData.banco.codigo);
    }
    if (!data.banco.nome && aiData.banco?.nome) data.banco.nome = aiData.banco.nome;

    const mergePessoa = (target: BoletoData["beneficiario"], src?: Partial<BoletoData["beneficiario"]> | null) => {
      if (!src) return;
      if (!target.nome && src.nome) target.nome = src.nome;
      if (!target.documento && src.documento && docTemFormatoValido(src.documento)) {
        target.documento = normalizarCodigo(src.documento);
        target.tipo_documento = tipoDoc(src.documento);
      }
      if (!target.endereco && src.endereco) target.endereco = src.endereco;
      if ("cidade" in src && src.cidade && !target.cidade) target.cidade = src.cidade;
      if ("estado" in src && src.estado && !target.estado) target.estado = src.estado;
      if ("cep" in src && src.cep && !target.cep) target.cep = normalizarCodigo(src.cep);
    };
    mergePessoa(data.beneficiario, aiData.beneficiario ?? null);
    mergePessoa(data.pagador, aiData.pagador ?? null);

    // Override beneficiário a partir do texto do PDF quando houver rótulo
    // Beneficiário/Cedente — evita usar cabeçalho comercial (ex: Sicoob).
    const nomeDoTexto = extrairBeneficiarioDoTexto(pdfText);
    if (nomeDoTexto) {
      // Se o nome atual do beneficiário corresponde ao cabeçalho comercial
      // detectado pela IA (ou é diferente do rótulo bancário), substitui.
      const cabecalho = (aiData as { cabecalho_documento?: string | null } | null)?.cabecalho_documento ?? null;
      const atual = (data.beneficiario.nome ?? "").trim().toUpperCase();
      const doTexto = nomeDoTexto.trim().toUpperCase();
      const doCabecalho = (cabecalho ?? "").trim().toUpperCase();
      if (!atual || atual !== doTexto) {
        if (atual && atual === doCabecalho) {
          // IA pegou cabeçalho — troca pelo campo bancário
          data.beneficiario.nome = nomeDoTexto;
        } else if (!atual) {
          data.beneficiario.nome = nomeDoTexto;
        } else {
          // Prioriza texto bancário quando divergente
          data.beneficiario.nome = nomeDoTexto;
        }
      }
    }

    if (aiData.vencimento) data.vencimento = aiData.vencimento;
    if (data.valor_documento == null && typeof aiData.valor_documento === "number") data.valor_documento = aiData.valor_documento;
    if (data.valor_cobrado == null && typeof aiData.valor_cobrado === "number") data.valor_cobrado = aiData.valor_cobrado;
    if (data.valor_cobrado == null && data.valor_documento != null) data.valor_cobrado = data.valor_documento;
    if (!data.data_documento && aiData.data_documento) data.data_documento = aiData.data_documento;
    if (!data.data_processamento && aiData.data_processamento) data.data_processamento = aiData.data_processamento;
    if (!data.numero_documento && aiData.numero_documento) data.numero_documento = aiData.numero_documento;
    if (!data.nosso_numero && aiData.nosso_numero) data.nosso_numero = aiData.nosso_numero;
    if (!data.agencia_codigo_beneficiario && aiData.agencia_codigo_beneficiario) data.agencia_codigo_beneficiario = aiData.agencia_codigo_beneficiario;
    if (!data.carteira && aiData.carteira) data.carteira = aiData.carteira;
    if (!data.especie && aiData.especie) data.especie = aiData.especie;
    if (!data.aceite && aiData.aceite) data.aceite = aiData.aceite;
    if (Array.isArray(aiData.instrucoes)) data.instrucoes = aiData.instrucoes.filter(Boolean);
    if (aiData.juros != null) data.juros = aiData.juros;
    if (aiData.multa != null) data.multa = aiData.multa;
    if (aiData.desconto != null) data.desconto = aiData.desconto;
    if (aiData.outras_deducoes != null) data.outras_deducoes = aiData.outras_deducoes;
    if (aiData.outros_acrescimos != null) data.outros_acrescimos = aiData.outros_acrescimos;
    if (aiData.referencia) data.referencia = aiData.referencia;
    if (aiData.numero_instalacao) data.numero_instalacao = aiData.numero_instalacao;
    if (aiData.nota_fiscal) data.nota_fiscal = aiData.nota_fiscal;
    if (aiData.chave_nota_fiscal) data.chave_nota_fiscal = aiData.chave_nota_fiscal;
    if (aiData.informacoes_adicionais) data.informacoes_adicionais = aiData.informacoes_adicionais;
    if (aiData.gps) {
      const g = aiData.gps;
      data.gps = {
        codigo_pagamento: g.codigo_pagamento ?? null,
        competencia: g.competencia ?? null,
        identificador: g.identificador ?? null,
        valor_inss: g.valor_inss ?? null,
        valor_outras_entidades: g.valor_outras_entidades ?? null,
        atm_multa_juros: g.atm_multa_juros ?? null,
        valor_total: g.valor_total ?? null,
      };
      if (!data.tipo_documento) data.tipo_documento = "gps";
    }
    if (aiData.confianca) {
      data.confianca = { ...data.confianca, ...aiData.confianca } as BoletoData["confianca"];
    }
  }

  // Validação de datas / valores consistentes
  const erros: string[] = [];
  const alertas: string[] = [];
  if (barrasFinal && barrasFinal.length !== 44) erros.push("Código de barras com tamanho inválido.");
  if (linhaFinal && linhaFinal.length !== 47 && linhaFinal.length !== 48) erros.push("Linha digitável com tamanho inválido.");
  if (barrasFinal && !validacaoBarras.valido) erros.push(...validacaoBarras.erros);
  if (linhaFinal && !validacaoLinha.valido) erros.push(...validacaoLinha.erros);

  // Consistência valor do código × valor do texto
  if (barrasFinal.length === 44 && barrasFinal[0] !== "8") {
    const info = extrairInfoBarrasBancario(barrasFinal);
    if (info.valor != null && aiData?.valor_documento != null) {
      const diff = Math.abs(info.valor - Number(aiData.valor_documento));
      if (diff > 0.01) {
        alertas.push(
          `Valor do código (${info.valor.toFixed(2)}) diverge do valor lido no documento (${Number(aiData.valor_documento).toFixed(2)}).`,
        );
      }
    }
  }

  // Status final
  let status: BoletoData["validacao"]["status"] = "nao_identificado";
  if (!barrasFinal && !linhaFinal) {
    status = "nao_identificado";
  } else if (erros.length > 0) {
    status = "invalido";
  } else if (validacaoBarras.valido || validacaoLinha.valido) {
    const conf = data.confianca.geral || 1;
    if (conf >= 0.95 && alertas.length === 0) status = "valido";
    else status = "requer_conferencia";
  } else {
    status = "requer_conferencia";
  }

  data.validacao = { status, erros, alertas };

  if (data.confianca.codigo_barras === 0 && data.codigo_barras.valido) data.confianca.codigo_barras = data.codigo_barras.origem === "leitura_visual" ? 0.99 : 0.9;
  if (data.confianca.linha_digitavel === 0 && data.linha_digitavel.valido) data.confianca.linha_digitavel = 0.95;
  if (data.confianca.geral === 0) {
    const parts = [data.confianca.codigo_barras, data.confianca.linha_digitavel, data.confianca.valor, data.confianca.vencimento].filter((x) => x > 0);
    data.confianca.geral = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  }

  emit("organizar");
  return { data, previewCanvases: canvases };
}