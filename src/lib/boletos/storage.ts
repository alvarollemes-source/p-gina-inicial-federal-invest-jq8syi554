import { supabase } from "@/integrations/supabase/client";
import type { BoletoData } from "./types";

const BUCKET = "boletos";

/** Recupera ou cria um session_id anônimo persistido em localStorage. */
export function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  const KEY = "boletos.session_id";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export interface BoletoRow {
  id: string;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  banco_nome: string | null;
  beneficiario_nome: string | null;
  valor_documento: number | null;
  valor_cobrado: number | null;
  vencimento: string | null;
  status_validacao: string | null;
  nivel_confianca: number | null;
  dados_json: BoletoData | null;
  criado_em: string;
  status?: string | null;
  data_envio?: string | null;
  usuario_envio_id?: string | null;
  empresa_id?: string | null;
}

/** Faz upload do arquivo e salva o registro no banco. Retorna o registro criado. */
export async function salvarBoleto(file: File, data: BoletoData): Promise<BoletoRow | null> {
  const sessionId = getSessionId();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;
  const scope = uid ?? sessionId;
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
  const path = `${scope}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  // Puxa empresa_id do profile do operador (se houver)
  let empresaId: string | null = null;
  if (uid) {
    const { data: prof } = await supabase.from("profiles").select("empresa_id").eq("id", uid).maybeSingle();
    empresaId = (prof?.empresa_id as string | null) ?? null;
  }

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (upErr) {
    console.warn("upload falhou:", upErr.message);
  }

  const record = {
    session_id: sessionId,
    usuario_envio_id: uid,
    empresa_id: empresaId,
    status: "rascunho",
    arquivo_url: upErr ? null : path,
    arquivo_nome: file.name,
    arquivo_tipo: file.type || null,
    tipo_documento: data.tipo_documento,
    texto_extraido: data.texto_original?.slice(0, 20000) ?? null,
    codigo_barras: data.codigo_barras.valor,
    codigo_barras_original: data.codigo_barras.valor,
    linha_digitavel: data.linha_digitavel.valor,
    linha_digitavel_original: data.linha_digitavel.valor,
    banco_codigo: data.banco.codigo,
    banco_nome: data.banco.nome,
    beneficiario_nome: data.beneficiario.nome,
    beneficiario_documento: data.beneficiario.documento,
    beneficiario_tipo_documento: data.beneficiario.tipo_documento,
    beneficiario_endereco: data.beneficiario.endereco,
    pagador_nome: data.pagador.nome,
    pagador_documento: data.pagador.documento,
    pagador_tipo_documento: data.pagador.tipo_documento,
    pagador_endereco: data.pagador.endereco,
    pagador_cidade: data.pagador.cidade ?? null,
    pagador_estado: data.pagador.estado ?? null,
    pagador_cep: data.pagador.cep ?? null,
    vencimento: data.vencimento,
    valor_documento: data.valor_documento,
    valor_cobrado: data.valor_cobrado,
    data_documento: data.data_documento,
    data_processamento: data.data_processamento,
    numero_documento: data.numero_documento,
    nosso_numero: data.nosso_numero,
    agencia_beneficiario: data.agencia_codigo_beneficiario,
    carteira: data.carteira,
    referencia: data.referencia,
    instrucoes: data.instrucoes,
    status_validacao: data.validacao.status,
    nivel_confianca: data.confianca.geral,
    campos_baixa_confianca: null,
    erros_validacao: data.validacao.erros,
    alertas_validacao: data.validacao.alertas,
    dados_json: data,
  };

  const { data: inserted, error } = await supabase
    .from("boletos")
    .insert(record as never)
    .select("*")
    .single();

  if (error) {
    console.warn("insert falhou:", error.message);
    return null;
  }
  return inserted as unknown as BoletoRow;
}

/** Busca duplicidade por código de barras / linha digitável no session_id atual. */
export async function buscarDuplicado(codigoBarras: string | null, linhaDig: string | null): Promise<BoletoRow | null> {
  if (!codigoBarras && !linhaDig) return null;
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  let q = supabase
    .from("boletos")
    .select("id, arquivo_url, arquivo_nome, arquivo_tipo, banco_nome, beneficiario_nome, valor_documento, valor_cobrado, vencimento, status_validacao, nivel_confianca, dados_json, criado_em, status, data_envio, usuario_envio_id, empresa_id")
    .order("criado_em", { ascending: false })
    .limit(1);
  if (uid) q = q.eq("usuario_envio_id", uid);
  else q = q.eq("session_id", getSessionId());
  if (codigoBarras) q = q.eq("codigo_barras", codigoBarras);
  else if (linhaDig) q = q.eq("linha_digitavel", linhaDig);
  const { data, error } = await q;
  if (error || !data || data.length === 0) return null;
  return data[0] as unknown as BoletoRow;
}

/** Lista o histórico da session atual. */
export async function listarHistorico(limit = 20): Promise<BoletoRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  let q = supabase
    .from("boletos")
    .select("id, arquivo_url, arquivo_nome, arquivo_tipo, banco_nome, beneficiario_nome, valor_documento, valor_cobrado, vencimento, status_validacao, nivel_confianca, dados_json, criado_em, status, data_envio, usuario_envio_id, empresa_id")
    .order("criado_em", { ascending: false })
    .limit(limit);
  if (uid) q = q.eq("usuario_envio_id", uid);
  else q = q.eq("session_id", getSessionId());
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as unknown as BoletoRow[];
}

export async function excluirBoleto(id: string): Promise<void> {
  await supabase.from("boletos").delete().eq("id", id);
}

/** Atualiza a empresa (matriz/filial) vinculada a um boleto. */
export async function atualizarEmpresaBoleto(id: string, empresaId: string | null): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("boletos").update({ empresa_id: empresaId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Envia o boleto (rascunho) para análise da Federal Invest. */
export async function enviarParaPagamento(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("boletos")
    .update({ status: "recebido", data_envio: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Atualiza dados do boleto (usado no modo edição de rascunhos). Só permite em rascunho. */
export async function atualizarDadosBoleto(
  id: string,
  data: BoletoData,
): Promise<{ ok: boolean; error?: string }> {
  const patch = {
    dados_json: data,
    banco_codigo: data.banco.codigo,
    banco_nome: data.banco.nome,
    linha_digitavel: data.linha_digitavel.valor,
    codigo_barras: data.codigo_barras.valor,
    beneficiario_nome: data.beneficiario.nome,
    beneficiario_documento: data.beneficiario.documento,
    beneficiario_tipo_documento: data.beneficiario.tipo_documento,
    pagador_nome: data.pagador.nome,
    pagador_documento: data.pagador.documento,
    pagador_tipo_documento: data.pagador.tipo_documento,
    vencimento: data.vencimento,
    valor_documento: data.valor_documento,
    valor_cobrado: data.valor_cobrado,
    numero_documento: data.numero_documento,
    status_validacao: data.validacao.status,
  } as never;
  const { error } = await supabase
    .from("boletos")
    .update(patch)
    .eq("id", id)
    .eq("status", "rascunho");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Salva o cálculo de atualização (juros/multa) do boleto vencido e envia para pagamento. */
export async function confirmarAtualizacaoEEnviar(
  id: string,
  dadosAtuais: BoletoData,
  valorAtualizado: number,
  memoria: unknown,
  origem: "instrucoes_boleto" | "preenchimento_manual",
): Promise<{ ok: boolean; error?: string }> {
  const m = (memoria ?? {}) as {
    dias_atraso?: number;
    data_calculo?: string;
    multa?: { tipo: "" | "percentual" | "valor_fixo"; valor_base: number; valor_calculado: number };
    juros?: {
      tipo: "" | "percentual_mensal" | "percentual_diario" | "valor_fixo_diario";
      valor_base: number;
      percentual_diario?: number | null;
      valor_calculado: number;
    };
  };
  const nextDados: BoletoData = {
    ...dadosAtuais,
    atualizacao: {
      aplicada: true,
      origem_dos_dados: origem,
      valor_original: Number(dadosAtuais.valor_documento ?? dadosAtuais.valor_cobrado ?? 0),
      valor_atualizado: valorAtualizado,
      dias_atraso: m.dias_atraso ?? 0,
      data_calculo: m.data_calculo ?? "",
      multa: m.multa,
      juros: m.juros,
      memoria_calculo: memoria,
    },
  };
  const { error } = await supabase
    .from("boletos")
    .update({
      status: "recebido",
      data_envio: new Date().toISOString(),
      valor_cobrado: valorAtualizado,
      dados_json: nextDados as never,
    } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Cria uma URL assinada para o arquivo do boleto. */
export async function assinarArquivo(path: string, expiresIn = 300): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
