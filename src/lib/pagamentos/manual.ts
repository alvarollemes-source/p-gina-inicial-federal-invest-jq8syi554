import { supabase } from "@/integrations/supabase/client";

const BUCKET = "boletos";

export type TipoPagamentoManual = "pix" | "transferencia" | "debito_veiculo";

export type PixData = {
  tipo_chave: "cnpj" | "cpf" | "celular" | "email" | "aleatoria";
  chave: string;
  valor: number;
};
export type TedData = {
  nome: string;
  documento: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: "corrente" | "poupanca";
  valor: number;
};
export const CATEGORIAS_VEICULO = [
  "LICENCIAMENTO / DÉBITOS",
  "TRANSFERÊNCIA",
  "CRV 2ª VIA",
  "SÓ DÉBITOS PENDENTES",
  "IPVA ATUAL",
  "IPVA ANTERIORES",
  "DPVAT ATUAL",
  "DPVAT ANTERIORES",
  "MULTAS",
  "MULTAS OUTROS ESTADOS",
] as const;
export type CategoriaVeiculo = (typeof CATEGORIAS_VEICULO)[number];
export type VeiculoData = { categoria: CategoriaVeiculo; renavam: string };

export type ManualPayload =
  | { tipo: "pix"; empresa_id: string; dados: PixData }
  | { tipo: "transferencia"; empresa_id: string; dados: TedData }
  | { tipo: "debito_veiculo"; empresa_id: string; dados: VeiculoData; arquivo?: File | null };

function beneficiarioLabel(p: ManualPayload): string {
  if (p.tipo === "pix") return `PIX — ${p.dados.chave}`;
  if (p.tipo === "transferencia") return `TED/DOC — ${p.dados.nome}`;
  return `Débito de veículo — ${p.dados.categoria} (RENAVAM ${p.dados.renavam})`;
}

function valorPayload(p: ManualPayload): number | null {
  if (p.tipo === "pix" || p.tipo === "transferencia") return p.dados.valor;
  return null;
}

export async function criarPagamentoManual(p: ManualPayload): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;
  if (!uid) return { ok: false, error: "Sessão expirada" };

  let arquivoPath: string | null = null;
  let arquivoNome: string | null = null;
  let arquivoTipo: string | null = null;
  if (p.tipo === "debito_veiculo" && p.arquivo) {
    const file = p.arquivo;
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
    const path = `${uid}/veiculos/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (upErr) return { ok: false, error: `Falha no upload: ${upErr.message}` };
    arquivoPath = path;
    arquivoNome = file.name;
    arquivoTipo = file.type || null;
  }

  const record: Record<string, unknown> = {
    usuario_envio_id: uid,
    empresa_id: p.empresa_id,
    tipo_pagamento: p.tipo,
    dados_pagamento: p.dados,
    beneficiario_nome: beneficiarioLabel(p),
    valor_documento: valorPayload(p),
    valor_cobrado: valorPayload(p),
    arquivo_url: arquivoPath,
    arquivo_nome: arquivoNome,
    arquivo_tipo: arquivoTipo,
    status: "recebido",
    data_envio: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("boletos").insert(record as never).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}