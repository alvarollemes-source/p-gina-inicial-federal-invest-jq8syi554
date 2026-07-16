import { supabase } from "@/integrations/supabase/client";
import type {
  BankAccount,
  CnabBatch,
  DocumentChangeLog,
  DocumentExtraction,
  DocumentReview,
  DocumentValidationIssue,
  PaymentDocument,
} from "./types";

// Tabelas ainda não presentes nos types gerados; usamos cast controlado.
// Este arquivo é o ÚNICO ponto que faz o cast — o resto do app consome tipos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const DOC_COLS =
  "id,empresa_id,tipo,arquivo_nome,arquivo_url,descricao,beneficiario_nome,beneficiario_documento,beneficiario_tipo_pessoa,banco_emissor,codigo_barras,linha_digitavel,numero_interno,numero_documento,nosso_numero,categoria,centro_custo,vencimento,data_programada,valor_nominal,desconto,abatimento,juros,multa,valor_final,valor_calculado,classificacao_sugerida,classificacao_confirmada,hash_arquivo,motivo_reprovacao,review_notes,observacao,status_extracao,status_conferencia,status_cnab,responsavel_id,reviewed_at,reviewed_by,is_demo,created_at";

export async function listBankAccounts(): Promise<BankAccount[]> {
  const { data } = await sb
    .from("bank_accounts")
    .select("id,empresa_id,banco_codigo,banco_nome,agencia,conta,conta_dv,convenio,cedente_nome,ativo,is_demo")
    .order("created_at", { ascending: false });
  return (data ?? []) as BankAccount[];
}

export async function listPaymentDocuments(): Promise<PaymentDocument[]> {
  const { data } = await sb
    .from("payment_documents")
    .select(DOC_COLS)
    .order("created_at", { ascending: false });
  return (data ?? []) as PaymentDocument[];
}

export async function getPaymentDocument(id: string): Promise<PaymentDocument | null> {
  const { data } = await sb.from("payment_documents").select(DOC_COLS).eq("id", id).maybeSingle();
  return (data as PaymentDocument | null) ?? null;
}

export async function updatePaymentDocument(
  id: string,
  patch: Partial<PaymentDocument>,
  reason?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  // Load previous values for changed fields to record the change log
  const before = await getPaymentDocument(id);

  const { error } = await sb.from("payment_documents").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (before) {
    const changes: Array<{ field_name: string; old_value: string | null; new_value: string | null }> = [];
    for (const [k, v] of Object.entries(patch)) {
      const oldVal = (before as unknown as Record<string, unknown>)[k];
      if (oldVal !== v) {
        changes.push({
          field_name: k,
          old_value: oldVal == null ? null : String(oldVal),
          new_value: v == null ? null : String(v),
        });
      }
    }
    if (changes.length) {
      await sb.from("document_change_logs").insert(
        changes.map((c) => ({
          payment_document_id: id,
          field_name: c.field_name,
          old_value: c.old_value,
          new_value: c.new_value,
          changed_by: uid,
          change_reason: reason ?? null,
        })),
      );
    }
  }
  return { ok: true };
}

export async function listExtractions(docId: string): Promise<DocumentExtraction[]> {
  const { data } = await sb
    .from("document_extractions")
    .select("*")
    .eq("payment_document_id", docId)
    .order("created_at", { ascending: true });
  return (data ?? []) as DocumentExtraction[];
}

export async function replaceExtractions(
  docId: string,
  rows: Array<Omit<DocumentExtraction, "id" | "payment_document_id" | "created_at" | "confirmed_by" | "confirmed_at" | "confirmed_value">>,
): Promise<void> {
  await sb.from("document_extractions").delete().eq("payment_document_id", docId);
  if (!rows.length) return;
  await sb
    .from("document_extractions")
    .insert(rows.map((r) => ({ ...r, payment_document_id: docId })));
}

export async function listIssues(docId: string): Promise<DocumentValidationIssue[]> {
  const { data } = await sb
    .from("document_validation_issues")
    .select("*")
    .eq("payment_document_id", docId)
    .order("created_at", { ascending: true });
  return (data ?? []) as DocumentValidationIssue[];
}

export async function replaceIssues(
  docId: string,
  rows: Array<Omit<DocumentValidationIssue, "id" | "payment_document_id" | "created_at" | "resolved_by" | "resolved_at" | "status">>,
): Promise<void> {
  await sb
    .from("document_validation_issues")
    .delete()
    .eq("payment_document_id", docId)
    .eq("status", "aberto");
  if (!rows.length) return;
  await sb
    .from("document_validation_issues")
    .insert(rows.map((r) => ({ ...r, payment_document_id: docId, status: "aberto" })));
}

export async function listReviews(docId: string): Promise<DocumentReview[]> {
  const { data } = await sb
    .from("document_reviews")
    .select("*")
    .eq("payment_document_id", docId)
    .order("created_at", { ascending: false });
  return (data ?? []) as DocumentReview[];
}

export async function listChangeLog(docId: string): Promise<DocumentChangeLog[]> {
  const { data } = await sb
    .from("document_change_logs")
    .select("*")
    .eq("payment_document_id", docId)
    .order("created_at", { ascending: false });
  return (data ?? []) as DocumentChangeLog[];
}

export async function insertReview(row: {
  payment_document_id: string;
  review_status: string;
  rejection_reason?: string | null;
  review_notes?: string | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;
  await sb.from("document_reviews").insert({
    ...row,
    reviewer_id: uid,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
}

export async function findDuplicates(input: {
  codigo_barras?: string | null;
  hash_arquivo?: string | null;
  beneficiario_documento?: string | null;
  valor_final?: number | null;
  vencimento?: string | null;
  excludeId?: string | null;
}): Promise<PaymentDocument[]> {
  const filters: string[] = [];
  if (input.codigo_barras) filters.push(`codigo_barras.eq.${input.codigo_barras}`);
  if (input.hash_arquivo) filters.push(`hash_arquivo.eq.${input.hash_arquivo}`);
  if (!filters.length) return [];
  let q = sb.from("payment_documents").select(DOC_COLS).or(filters.join(","));
  if (input.excludeId) q = q.neq("id", input.excludeId);
  const { data } = await q.limit(20);
  return (data ?? []) as PaymentDocument[];
}

export async function createSignedFileUrl(path: string, expiresIn = 600): Promise<string | null> {
  const { data } = await supabase.storage.from("payment-documents").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function listCnabBatches(): Promise<CnabBatch[]> {
  const { data } = await sb
    .from("cnab_batches")
    .select(
      "id,nome_interno,empresa_id,bank_account_id,data_pagamento,ambiente,status,quantidade_itens,valor_total,observacao,is_demo,created_at",
    )
    .order("created_at", { ascending: false });
  return (data ?? []) as CnabBatch[];
}

export async function createCnabBatch(input: {
  nome_interno: string;
  empresa_id: string | null;
  bank_account_id: string | null;
  data_pagamento: string | null;
  ambiente: "homologacao" | "producao";
  observacao: string | null;
  documento_ids: string[];
}): Promise<{ ok: boolean; error?: string; batch_id?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const criador_id = userData.user?.id ?? null;

  const { data: batch, error } = await sb
    .from("cnab_batches")
    .insert({
      nome_interno: input.nome_interno,
      empresa_id: input.empresa_id,
      bank_account_id: input.bank_account_id,
      data_pagamento: input.data_pagamento,
      ambiente: input.ambiente,
      observacao: input.observacao,
      status: "rascunho",
      quantidade_itens: input.documento_ids.length,
      criador_id,
    })
    .select("id")
    .single();
  if (error || !batch) return { ok: false, error: error?.message };

  if (input.documento_ids.length) {
    const items = input.documento_ids.map((doc_id, idx) => ({
      batch_id: batch.id as string,
      payment_document_id: doc_id,
      ordem: idx + 1,
    }));
    await sb.from("cnab_batch_items").insert(items);
    await sb
      .from("payment_documents")
      .update({ status_cnab: "em_lote" })
      .in("id", input.documento_ids);
  }
  return { ok: true, batch_id: batch.id as string };
}