import { useState } from "react";
import type { BoletoData, GpsInfo } from "@/lib/boletos/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";

type PessoaTipo = "CPF" | "CNPJ" | null;

function toNum(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function EditBoletoForm({
  data,
  onCancel,
  onSave,
}: {
  data: BoletoData;
  onCancel: () => void;
  onSave: (next: BoletoData) => Promise<void> | void;
}) {
  const gps = data.gps;
  const [form, setForm] = useState({
    vencimento: data.vencimento ?? "",
    valor_cobrado: data.valor_cobrado != null ? String(data.valor_cobrado).replace(".", ",") : "",
    valor_documento: data.valor_documento != null ? String(data.valor_documento).replace(".", ",") : "",
    linha_digitavel: data.linha_digitavel.valor ?? "",
    codigo_barras: data.codigo_barras.valor ?? "",
    banco_codigo: data.banco.codigo ?? "",
    banco_nome: data.banco.nome ?? "",
    beneficiario_nome: data.beneficiario.nome ?? "",
    beneficiario_documento: data.beneficiario.documento ?? "",
    beneficiario_tipo: (data.beneficiario.tipo_documento ?? "") as "" | "CPF" | "CNPJ",
    beneficiario_endereco: data.beneficiario.endereco ?? "",
    pagador_nome: data.pagador.nome ?? "",
    pagador_documento: data.pagador.documento ?? "",
    pagador_tipo: (data.pagador.tipo_documento ?? "") as "" | "CPF" | "CNPJ",
    pagador_endereco: data.pagador.endereco ?? "",
    pagador_cidade: data.pagador.cidade ?? "",
    pagador_estado: data.pagador.estado ?? "",
    pagador_cep: data.pagador.cep ?? "",
    numero_documento: data.numero_documento ?? "",
    nosso_numero: data.nosso_numero ?? "",
    agencia_codigo_beneficiario: data.agencia_codigo_beneficiario ?? "",
    carteira: data.carteira ?? "",
    especie: data.especie ?? "",
    aceite: data.aceite ?? "",
    data_documento: data.data_documento ?? "",
    data_processamento: data.data_processamento ?? "",
    juros: data.juros != null ? String(data.juros).replace(".", ",") : "",
    multa: data.multa != null ? String(data.multa).replace(".", ",") : "",
    desconto: data.desconto != null ? String(data.desconto).replace(".", ",") : "",
    referencia: data.referencia ?? "",
    numero_instalacao: data.numero_instalacao ?? "",
    nota_fiscal: data.nota_fiscal ?? "",
    chave_nota_fiscal: data.chave_nota_fiscal ?? "",
    informacoes_adicionais: data.informacoes_adicionais ?? "",
    instrucoes: (data.instrucoes ?? []).join("\n"),
    // GPS
    gps_codigo_pagamento: gps?.codigo_pagamento ?? "",
    gps_competencia: gps?.competencia ?? "",
    gps_identificador: gps?.identificador ?? "",
    gps_valor_inss: gps?.valor_inss != null ? String(gps.valor_inss).replace(".", ",") : "",
    gps_valor_outras: gps?.valor_outras_entidades != null ? String(gps.valor_outras_entidades).replace(".", ",") : "",
    gps_atm_multa_juros: gps?.atm_multa_juros != null ? String(gps.atm_multa_juros).replace(".", ",") : "",
    gps_valor_total: gps?.valor_total != null ? String(gps.valor_total).replace(".", ",") : "",
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const linha = form.linha_digitavel.replace(/\D/g, "");
      const cbar = form.codigo_barras.replace(/\D/g, "");
      const hasGps =
        !!(form.gps_codigo_pagamento || form.gps_competencia || form.gps_identificador ||
          form.gps_valor_inss || form.gps_valor_outras || form.gps_atm_multa_juros || form.gps_valor_total);
      const nextGps: GpsInfo | null = hasGps
        ? {
            codigo_pagamento: form.gps_codigo_pagamento || null,
            competencia: form.gps_competencia || null,
            identificador: form.gps_identificador || null,
            valor_inss: toNum(form.gps_valor_inss),
            valor_outras_entidades: toNum(form.gps_valor_outras),
            atm_multa_juros: toNum(form.gps_atm_multa_juros),
            valor_total: toNum(form.gps_valor_total),
          }
        : null;
      const next: BoletoData = {
        ...data,
        vencimento: form.vencimento || null,
        valor_cobrado: toNum(form.valor_cobrado),
        valor_documento: toNum(form.valor_documento),
        numero_documento: form.numero_documento || null,
        nosso_numero: form.nosso_numero || null,
        agencia_codigo_beneficiario: form.agencia_codigo_beneficiario || null,
        carteira: form.carteira || null,
        especie: form.especie || null,
        aceite: form.aceite || null,
        data_documento: form.data_documento || null,
        data_processamento: form.data_processamento || null,
        juros: toNum(form.juros),
        multa: toNum(form.multa),
        desconto: toNum(form.desconto),
        referencia: form.referencia || null,
        numero_instalacao: form.numero_instalacao || null,
        nota_fiscal: form.nota_fiscal || null,
        chave_nota_fiscal: form.chave_nota_fiscal || null,
        informacoes_adicionais: form.informacoes_adicionais || null,
        instrucoes: form.instrucoes.split("\n").map((s) => s.trim()).filter(Boolean),
        banco: { codigo: form.banco_codigo || null, nome: form.banco_nome || null },
        codigo_barras: {
          ...data.codigo_barras,
          valor: cbar || null,
          origem: "usuario",
          quantidade_digitos: cbar.length,
        },
        linha_digitavel: {
          ...data.linha_digitavel,
          valor: linha || null,
          origem: "usuario",
          quantidade_digitos: linha.length,
        },
        beneficiario: {
          ...data.beneficiario,
          nome: form.beneficiario_nome || null,
          documento: form.beneficiario_documento || null,
          tipo_documento: (form.beneficiario_tipo || null) as PessoaTipo,
          endereco: form.beneficiario_endereco || null,
        },
        pagador: {
          ...data.pagador,
          nome: form.pagador_nome || null,
          documento: form.pagador_documento || null,
          tipo_documento: (form.pagador_tipo || null) as PessoaTipo,
          endereco: form.pagador_endereco || null,
          cidade: form.pagador_cidade || null,
          estado: form.pagador_estado || null,
          cep: form.pagador_cep || null,
        },
        gps: nextGps,
      };
      await onSave(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="mb-4 text-base font-semibold text-foreground">Editar dados do boleto</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ed-venc">Vencimento</Label>
          <Input id="ed-venc" type="date" value={form.vencimento} onChange={(e) => set("vencimento", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-vcob">Valor a pagar</Label>
          <Input id="ed-vcob" inputMode="decimal" placeholder="0,00" value={form.valor_cobrado} onChange={(e) => set("valor_cobrado", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-vdoc">Valor do documento</Label>
          <Input id="ed-vdoc" inputMode="decimal" placeholder="0,00" value={form.valor_documento} onChange={(e) => set("valor_documento", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-ndoc">Nº documento</Label>
          <Input id="ed-ndoc" value={form.numero_documento} onChange={(e) => set("numero_documento", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ed-linha">Linha digitável</Label>
          <Input id="ed-linha" inputMode="numeric" value={form.linha_digitavel} onChange={(e) => set("linha_digitavel", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ed-cbar">Código de barras</Label>
          <Input id="ed-cbar" inputMode="numeric" value={form.codigo_barras} onChange={(e) => set("codigo_barras", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-banco-cod">Banco (código)</Label>
          <Input id="ed-banco-cod" value={form.banco_codigo} onChange={(e) => set("banco_codigo", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-banco-nome">Banco (nome)</Label>
          <Input id="ed-banco-nome" value={form.banco_nome} onChange={(e) => set("banco_nome", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ed-benef">Beneficiário</Label>
          <Input id="ed-benef" value={form.beneficiario_nome} onChange={(e) => set("beneficiario_nome", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-benef-doc">Documento beneficiário</Label>
          <Input id="ed-benef-doc" value={form.beneficiario_documento} onChange={(e) => set("beneficiario_documento", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-benef-tp">Tipo</Label>
          <select
            id="ed-benef-tp"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.beneficiario_tipo}
            onChange={(e) => set("beneficiario_tipo", e.target.value as "" | "CPF" | "CNPJ")}
          >
            <option value="">—</option>
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ed-benef-end">Endereço beneficiário</Label>
          <Input id="ed-benef-end" value={form.beneficiario_endereco} onChange={(e) => set("beneficiario_endereco", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ed-pag">Pagador</Label>
          <Input id="ed-pag" value={form.pagador_nome} onChange={(e) => set("pagador_nome", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-pag-doc">Documento pagador</Label>
          <Input id="ed-pag-doc" value={form.pagador_documento} onChange={(e) => set("pagador_documento", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-pag-tp">Tipo</Label>
          <select
            id="ed-pag-tp"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.pagador_tipo}
            onChange={(e) => set("pagador_tipo", e.target.value as "" | "CPF" | "CNPJ")}
          >
            <option value="">—</option>
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ed-pag-end">Endereço pagador</Label>
          <Input id="ed-pag-end" value={form.pagador_endereco} onChange={(e) => set("pagador_endereco", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-pag-cid">Cidade</Label>
          <Input id="ed-pag-cid" value={form.pagador_cidade} onChange={(e) => set("pagador_cidade", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-pag-uf">UF</Label>
          <Input id="ed-pag-uf" maxLength={2} value={form.pagador_estado} onChange={(e) => set("pagador_estado", e.target.value.toUpperCase())} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-pag-cep">CEP</Label>
          <Input id="ed-pag-cep" value={form.pagador_cep} onChange={(e) => set("pagador_cep", e.target.value)} />
        </div>

        <div className="sm:col-span-2 mt-2 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Detalhes bancários
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-nn">Nosso número</Label>
          <Input id="ed-nn" value={form.nosso_numero} onChange={(e) => set("nosso_numero", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-ag">Agência/Código beneficiário</Label>
          <Input id="ed-ag" value={form.agencia_codigo_beneficiario} onChange={(e) => set("agencia_codigo_beneficiario", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-cart">Carteira</Label>
          <Input id="ed-cart" value={form.carteira} onChange={(e) => set("carteira", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-esp">Espécie</Label>
          <Input id="ed-esp" value={form.especie} onChange={(e) => set("especie", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-ace">Aceite</Label>
          <Input id="ed-ace" value={form.aceite} onChange={(e) => set("aceite", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-ddoc">Data do documento</Label>
          <Input id="ed-ddoc" type="date" value={form.data_documento} onChange={(e) => set("data_documento", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-dproc">Data de processamento</Label>
          <Input id="ed-dproc" type="date" value={form.data_processamento} onChange={(e) => set("data_processamento", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-juros">Juros</Label>
          <Input id="ed-juros" inputMode="decimal" placeholder="0,00" value={form.juros} onChange={(e) => set("juros", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-multa">Multa</Label>
          <Input id="ed-multa" inputMode="decimal" placeholder="0,00" value={form.multa} onChange={(e) => set("multa", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-desc">Desconto</Label>
          <Input id="ed-desc" inputMode="decimal" placeholder="0,00" value={form.desconto} onChange={(e) => set("desconto", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ed-ref">Referência</Label>
          <Input id="ed-ref" value={form.referencia} onChange={(e) => set("referencia", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-inst">Nº instalação</Label>
          <Input id="ed-inst" value={form.numero_instalacao} onChange={(e) => set("numero_instalacao", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-nf">Nota fiscal</Label>
          <Input id="ed-nf" value={form.nota_fiscal} onChange={(e) => set("nota_fiscal", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ed-chnf">Chave da NF</Label>
          <Input id="ed-chnf" value={form.chave_nota_fiscal} onChange={(e) => set("chave_nota_fiscal", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ed-info">Informações adicionais</Label>
          <Input id="ed-info" value={form.informacoes_adicionais} onChange={(e) => set("informacoes_adicionais", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ed-instr">Instruções (uma por linha)</Label>
          <textarea
            id="ed-instr"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.instrucoes}
            onChange={(e) => set("instrucoes", e.target.value)}
          />
        </div>

        <div className="sm:col-span-2 mt-2 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-primary">
          Guia da Previdência Social (GPS)
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-gps-cod">Código do pagamento</Label>
          <Input id="ed-gps-cod" value={form.gps_codigo_pagamento} onChange={(e) => set("gps_codigo_pagamento", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-gps-comp">Competência</Label>
          <Input id="ed-gps-comp" placeholder="MM/AAAA" value={form.gps_competencia} onChange={(e) => set("gps_competencia", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ed-gps-ident">Identificador (CPF/CNPJ/NIT)</Label>
          <Input id="ed-gps-ident" value={form.gps_identificador} onChange={(e) => set("gps_identificador", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-gps-inss">Valor do INSS</Label>
          <Input id="ed-gps-inss" inputMode="decimal" placeholder="0,00" value={form.gps_valor_inss} onChange={(e) => set("gps_valor_inss", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-gps-out">Outras entidades</Label>
          <Input id="ed-gps-out" inputMode="decimal" placeholder="0,00" value={form.gps_valor_outras} onChange={(e) => set("gps_valor_outras", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-gps-atm">ATM/Multa e Juros</Label>
          <Input id="ed-gps-atm" inputMode="decimal" placeholder="0,00" value={form.gps_atm_multa_juros} onChange={(e) => set("gps_atm_multa_juros", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ed-gps-tot">Total (Valor a pagar)</Label>
          <Input id="ed-gps-tot" inputMode="decimal" placeholder="0,00" value={form.gps_valor_total} onChange={(e) => set("gps_valor_total", e.target.value)} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          <X className="mr-1 h-4 w-4" /> Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}