// Upload orchestration for the Central de Pagamentos CNAB (Etapa 2).
//
// Real extraction: reutiliza o pipeline de boletos (`processarBoleto`) —
// pdf.js + ZXing + IA Gemini. Não é mock. Se a IA falhar, o pipeline continua
// somente com barras + linha digitável. Guias de arrecadação com código
// iniciado em "8" também são suportadas pelo pipeline.

import { supabase } from "@/integrations/supabase/client";
import { processarBoleto } from "@/lib/boletos/pipeline";
import type { BoletoData } from "@/lib/boletos/types";
import type {
  DocumentClassification,
  PaymentDocument,
  PaymentDocTipo,
} from "./types";
import { findDuplicates, replaceExtractions, replaceIssues } from "./db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const BUCKET = "payment-documents";

export interface UploadInput {
  file: File;
  empresa_id: string | null;
  categoria?: string | null;
  observacao?: string | null;
  responsavel_id?: string | null;
}

export interface UploadResult {
  ok: boolean;
  document_id?: string;
  duplicates?: PaymentDocument[];
  error?: string;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function classify(data: BoletoData): DocumentClassification {
  const cb = data.codigo_barras.valor ?? "";
  const ld = data.linha_digitavel.valor ?? "";
  const first = cb[0] ?? ld[0] ?? "";
  if (first === "8") return "conta_convenio_tributo";
  if (cb.length === 44 && first && first !== "8") return "boleto_bancario";
  if (ld.length === 47) return "boleto_bancario";
  if (ld.length === 48 && first === "8") return "conta_convenio_tributo";
  return "nao_identificado";
}

function inferTipo(cls: DocumentClassification, ai: BoletoData): PaymentDocTipo {
  if (cls === "conta_convenio_tributo") {
    // tributo vs concessionária: tributos costumam ter identificador "9" no 3º dígito
    // (simplificado; deixamos concessionária como default para arrecadação)
    return "concessionaria";
  }
  if (ai.gps) return "gps";
  return "boleto";
}

function computeFinal(vn: number | null, desconto: number, abat: number, juros: number, multa: number): number | null {
  if (vn == null) return null;
  const v = vn - desconto - abat + juros + multa;
  return Math.round(v * 100) / 100;
}

function isValidCpfCnpj(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const s = raw.replace(/\D/g, "");
  return s.length === 11 || s.length === 14;
}

/** Sobe o arquivo, roda o pipeline e persiste tudo. Retorna duplicidades se houver. */
export async function uploadAndExtract(input: UploadInput): Promise<UploadResult> {
  const { file, empresa_id } = input;
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    // 1. hash + upload
    const buf = await file.arrayBuffer();
    const hash = await sha256Hex(buf);
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
    const path = `${uid ?? "anon"}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (upErr) return { ok: false, error: `Falha no upload: ${upErr.message}` };

    // 2. cria registro "em processamento"
    const { data: created, error: insErr } = await sb
      .from("payment_documents")
      .insert({
        empresa_id,
        tipo: "boleto",
        arquivo_nome: file.name,
        arquivo_url: path,
        descricao: input.observacao ?? null,
        observacao: input.observacao ?? null,
        categoria: input.categoria ?? null,
        responsavel_id: input.responsavel_id ?? null,
        criador_id: uid,
        hash_arquivo: hash,
        status_extracao: "em_processamento",
        status_conferencia: "pendente",
        status_cnab: "nao_elegivel",
      })
      .select("id")
      .single();
    if (insErr || !created) return { ok: false, error: insErr?.message ?? "Falha ao criar documento" };
    const docId = created.id as string;

    // 3. duplicidade por hash
    const dupsByHash = await findDuplicates({ hash_arquivo: hash, excludeId: docId });

    // 4. pipeline de extração real
    let boletoData: BoletoData | null = null;
    let extractionErr: string | null = null;
    try {
      const res = await processarBoleto({ file });
      boletoData = res.data;
    } catch (e) {
      extractionErr = e instanceof Error ? e.message : "erro_desconhecido";
    }

    // 5. determina classificação e tipo
    let classificacao: DocumentClassification = "nao_identificado";
    let tipo: PaymentDocTipo = "boleto";
    if (boletoData) {
      classificacao = classify(boletoData);
      tipo = inferTipo(classificacao, boletoData);
    }

    // 6. calcula valor final
    const desconto = boletoData?.desconto ?? 0;
    const juros = boletoData?.juros ?? 0;
    const multa = boletoData?.multa ?? 0;
    const abatimento = boletoData?.outras_deducoes ?? 0;
    const vn = boletoData?.valor_documento ?? null;
    const vf = boletoData?.valor_cobrado ?? computeFinal(vn, desconto, abatimento, juros, multa);
    const vCalc = computeFinal(vn, desconto, abatimento, juros, multa);

    // 7. atualiza campos extraídos
    const patch: Record<string, unknown> = {
      tipo,
      classificacao_sugerida: classificacao,
      status_extracao: extractionErr
        ? "erro_leitura"
        : boletoData?.validacao.status === "invalido" || boletoData?.validacao.status === "nao_identificado"
          ? "extracao_parcial"
          : "extraido",
      status_conferencia: "em_conferencia",
      beneficiario_nome: boletoData?.beneficiario.nome ?? null,
      beneficiario_documento: boletoData?.beneficiario.documento ?? null,
      beneficiario_tipo_pessoa: boletoData?.beneficiario.tipo_documento ?? null,
      banco_emissor: boletoData?.banco.nome ?? null,
      codigo_barras: boletoData?.codigo_barras.valor ?? null,
      linha_digitavel: boletoData?.linha_digitavel.valor ?? null,
      vencimento: boletoData?.vencimento ?? null,
      valor_nominal: vn,
      desconto,
      abatimento,
      juros,
      multa,
      valor_final: vf,
      valor_calculado: vCalc,
      numero_documento: boletoData?.numero_documento ?? null,
      nosso_numero: boletoData?.nosso_numero ?? null,
    };
    await sb.from("payment_documents").update(patch).eq("id", docId);

    // 8. duplicidade por código de barras (após extrair)
    let dupsByCode: PaymentDocument[] = [];
    if (boletoData?.codigo_barras.valor) {
      dupsByCode = await findDuplicates({
        codigo_barras: boletoData.codigo_barras.valor,
        excludeId: docId,
      });
    }
    const duplicates = [...dupsByHash, ...dupsByCode].filter(
      (d, i, arr) => arr.findIndex((x) => x.id === d.id) === i,
    );

    // 9. persiste extractions com confiança
    if (boletoData) {
      const conf = boletoData.confianca;
      const rows: Array<{
        field_name: string;
        extracted_value: string | null;
        confidence_score: number | null;
        source_page: number | null;
        source_type: string | null;
        original_value: string | null;
      }> = [
        {
          field_name: "codigo_barras",
          extracted_value: boletoData.codigo_barras.valor,
          confidence_score: conf.codigo_barras || null,
          source_page: 1,
          source_type: boletoData.codigo_barras.origem,
          original_value: boletoData.codigo_barras.valor,
        },
        {
          field_name: "linha_digitavel",
          extracted_value: boletoData.linha_digitavel.valor,
          confidence_score: conf.linha_digitavel || null,
          source_page: 1,
          source_type: boletoData.linha_digitavel.origem,
          original_value: boletoData.linha_digitavel.valor,
        },
        {
          field_name: "valor_documento",
          extracted_value: vn != null ? String(vn) : null,
          confidence_score: conf.valor || null,
          source_page: 1,
          source_type: "ia",
          original_value: vn != null ? String(vn) : null,
        },
        {
          field_name: "vencimento",
          extracted_value: boletoData.vencimento,
          confidence_score: conf.vencimento || null,
          source_page: 1,
          source_type: "ia",
          original_value: boletoData.vencimento,
        },
        {
          field_name: "beneficiario_nome",
          extracted_value: boletoData.beneficiario.nome,
          confidence_score: null,
          source_page: 1,
          source_type: "ia",
          original_value: boletoData.beneficiario.nome,
        },
        {
          field_name: "beneficiario_documento",
          extracted_value: boletoData.beneficiario.documento,
          confidence_score: null,
          source_page: 1,
          source_type: "ia",
          original_value: boletoData.beneficiario.documento,
        },
      ];
      await replaceExtractions(docId, rows);
    }

    // 10. persiste validation issues
    const issues: Array<{ field_name: string | null; validation_code: string; severity: "info" | "warning" | "critical"; message: string }> = [];
    if (extractionErr) {
      issues.push({
        field_name: null,
        validation_code: "extraction_failed",
        severity: "critical",
        message: `Falha na leitura automática: ${extractionErr}`,
      });
    }
    if (boletoData) {
      for (const err of boletoData.validacao.erros) {
        issues.push({ field_name: null, validation_code: "pipeline_error", severity: "critical", message: err });
      }
      for (const w of boletoData.validacao.alertas) {
        issues.push({ field_name: null, validation_code: "pipeline_warning", severity: "warning", message: w });
      }
      if (!boletoData.codigo_barras.valido) {
        issues.push({
          field_name: "codigo_barras",
          validation_code: "codigo_barras_invalido",
          severity: "critical",
          message: "Código de barras não validou dígitos verificadores.",
        });
      }
      if (boletoData.beneficiario.documento && !isValidCpfCnpj(boletoData.beneficiario.documento)) {
        issues.push({
          field_name: "beneficiario_documento",
          validation_code: "cpf_cnpj_invalido",
          severity: "warning",
          message: "CPF/CNPJ do beneficiário parece inválido.",
        });
      }
      if (boletoData.vencimento) {
        const d = new Date(boletoData.vencimento + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (d.getTime() < today.getTime()) {
          issues.push({
            field_name: "vencimento",
            validation_code: "documento_vencido",
            severity: "warning",
            message: "Documento com data de vencimento no passado.",
          });
        }
      } else {
        issues.push({
          field_name: "vencimento",
          validation_code: "vencimento_ausente",
          severity: "critical",
          message: "Vencimento não identificado.",
        });
      }
      if (vCalc != null && vf != null && Math.abs(vCalc - vf) > 0.01) {
        issues.push({
          field_name: "valor_final",
          validation_code: "valor_divergente",
          severity: "warning",
          message: `Valor calculado (${vCalc.toFixed(2)}) diverge do valor final informado (${vf.toFixed(2)}).`,
        });
      }
      if (classificacao === "nao_identificado") {
        issues.push({
          field_name: null,
          validation_code: "classificacao_indefinida",
          severity: "warning",
          message: "Não foi possível classificar o documento automaticamente.",
        });
      }
    }
    if (duplicates.length) {
      issues.push({
        field_name: null,
        validation_code: "possivel_duplicidade",
        severity: "warning",
        message: `Existem ${duplicates.length} documento(s) semelhantes registrados.`,
      });
    }
    await replaceIssues(docId, issues);

    return { ok: true, document_id: docId, duplicates };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erro_desconhecido" };
  }
}

/** Regras para aprovação. Retorna lista de motivos que impedem aprovar. */
export function approvalBlockers(doc: PaymentDocument): string[] {
  const blockers: string[] = [];
  if (!doc.empresa_id) blockers.push("Empresa pagadora não definida.");
  if (!doc.tipo) blockers.push("Tipo de pagamento não definido.");
  if (!doc.beneficiario_nome) blockers.push("Beneficiário não preenchido.");
  if (!doc.codigo_barras || doc.codigo_barras.replace(/\D/g, "").length < 44) {
    blockers.push("Código de barras ausente ou inválido.");
  }
  if (!doc.vencimento) blockers.push("Vencimento não preenchido.");
  if (!doc.data_programada) blockers.push("Data programada de pagamento não preenchida.");
  if (!doc.valor_nominal || doc.valor_nominal <= 0) blockers.push("Valor nominal deve ser maior que zero.");
  if (!doc.valor_final || doc.valor_final <= 0) blockers.push("Valor final deve ser maior que zero.");
  if (doc.status_cnab === "incluido_em_lote" || doc.status_cnab === "arquivo_gerado" || doc.status_cnab === "em_lote") {
    blockers.push("Documento já incluído em lote.");
  }
  return blockers;
}