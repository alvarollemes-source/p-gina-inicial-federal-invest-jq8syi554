import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Landmark, Send, Car, QrCode } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getEmpresasPermitidas } from "@/lib/empresas";
import {
  CATEGORIAS_VEICULO,
  criarPagamentoManual,
  type CategoriaVeiculo,
  type ManualPayload,
  type TipoPagamentoManual,
} from "@/lib/pagamentos/manual";

export const Route = createFileRoute("/_authenticated/pagamentos-manuais")({
  head: () => ({ meta: [{ title: "Pagamentos manuais — Federal Invest" }] }),
  component: PagamentosManuaisPage,
});

type EmpresaOpt = { id: string; nome: string; matriz_id: string | null };

function parseValor(v: string): number {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function PagamentosManuaisPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const isOperador = auth.role === "operador";
  const [tipo, setTipo] = useState<TipoPagamentoManual>("pix");
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // PIX
  const [pixTipoChave, setPixTipoChave] = useState<"cnpj" | "cpf" | "celular" | "email" | "aleatoria">("cnpj");
  const [pixChave, setPixChave] = useState("");
  const [pixValor, setPixValor] = useState("");

  // TED
  const [tedNome, setTedNome] = useState("");
  const [tedDoc, setTedDoc] = useState("");
  const [tedBanco, setTedBanco] = useState("");
  const [tedAgencia, setTedAgencia] = useState("");
  const [tedConta, setTedConta] = useState("");
  const [tedTipoConta, setTedTipoConta] = useState<"corrente" | "poupanca">("corrente");
  const [tedValor, setTedValor] = useState("");

  // Veículo
  const [veicCategoria, setVeicCategoria] = useState<CategoriaVeiculo>(CATEGORIAS_VEICULO[0]);
  const [veicRenavam, setVeicRenavam] = useState("");
  const [veicFile, setVeicFile] = useState<File | null>(null);

  useEffect(() => {
    supabase.from("empresas").select("id,nome,matriz_id,ativo").eq("ativo", true).order("nome").then(({ data }) => {
      const todas = (data ?? []) as (EmpresaOpt & { ativo: boolean })[];
      const permitidas = getEmpresasPermitidas(
        auth.role,
        auth.profile ? { empresa_id: auth.profile.empresa_id, empresa_matriz_id: auth.profile.empresa_matriz_id } : null,
        todas,
      );
      setEmpresas(permitidas as EmpresaOpt[]);
    });
  }, [auth.role, auth.profile?.empresa_id, auth.profile?.empresa_matriz_id]);

  useEffect(() => {
    if (!isOperador) return;
    // Operador vinculado a filial: bloqueia na filial. Vinculado a matriz: pré-seleciona a matriz mas mantém editável.
    if (auth.profile?.empresa_matriz_id) setEmpresaId(auth.profile.empresa_id ?? "");
    else if (auth.profile?.empresa_id) setEmpresaId(auth.profile.empresa_id);
  }, [isOperador, auth.profile?.empresa_id, auth.profile?.empresa_matriz_id]);

  const resetForms = () => {
    setPixChave(""); setPixValor("");
    setTedNome(""); setTedDoc(""); setTedBanco(""); setTedAgencia(""); setTedConta(""); setTedValor("");
    setVeicRenavam(""); setVeicFile(null);
  };

  const buildPayload = (): ManualPayload | { error: string } => {
    if (!empresaId) return { error: "Selecione a empresa (matriz ou filial)." };
    if (tipo === "pix") {
      if (!pixChave.trim()) return { error: "Informe a chave PIX." };
      const v = parseValor(pixValor);
      if (!v || v <= 0) return { error: "Informe um valor válido." };
      return { tipo: "pix", empresa_id: empresaId, dados: { tipo_chave: pixTipoChave, chave: pixChave.trim(), valor: v } };
    }
    if (tipo === "transferencia") {
      if (!tedNome.trim() || !tedDoc.trim() || !tedBanco.trim() || !tedAgencia.trim() || !tedConta.trim()) {
        return { error: "Preencha todos os campos da transferência." };
      }
      const v = parseValor(tedValor);
      if (!v || v <= 0) return { error: "Informe um valor válido." };
      return {
        tipo: "transferencia",
        empresa_id: empresaId,
        dados: { nome: tedNome.trim(), documento: tedDoc.trim(), banco: tedBanco.trim(), agencia: tedAgencia.trim(), conta: tedConta.trim(), tipo_conta: tedTipoConta, valor: v },
      };
    }
    // veiculo
    if (!veicRenavam.trim()) return { error: "Informe o RENAVAM." };
    return { tipo: "debito_veiculo", empresa_id: empresaId, dados: { categoria: veicCategoria, renavam: veicRenavam.trim() }, arquivo: veicFile };
  };

  const enviar = async () => {
    const payload = buildPayload();
    if ("error" in payload) return toast.error(payload.error);
    setSaving(true);
    const r = await criarPagamentoManual(payload);
    setSaving(false);
    if (!r.ok) return toast.error(r.error ?? "Falha ao enviar");
    toast.success("Pagamento enviado para análise");
    resetForms();
    navigate({ to: "/historico" });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pagamentos manuais</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Lance pagamentos por PIX, TED/DOC ou débitos de veículo. Todos os campos são obrigatórios.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        <TipoCard active={tipo === "pix"} onClick={() => setTipo("pix")} icon={<QrCode className="h-4 w-4" />} label="PIX" />
        <TipoCard active={tipo === "transferencia"} onClick={() => setTipo("transferencia")} icon={<Landmark className="h-4 w-4" />} label="Transferência (TED/DOC)" />
        <TipoCard active={tipo === "debito_veiculo"} onClick={() => setTipo("debito_veiculo")} icon={<Car className="h-4 w-4" />} label="Débitos de veículos" />
      </div>

      <div className="mt-6 space-y-2 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
        <Label className="flex items-center gap-1.5 text-xs"><Building2 className="h-3.5 w-3.5" /> Empresa (matriz ou filial) *</Label>
        {isOperador && !auth.profile?.empresa_id ? (
          <p className="text-xs text-amber-700">
            Seu usuário não está vinculado a nenhuma empresa. Solicite ao administrador o vínculo antes de enviar pagamentos.
          </p>
        ) : (
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            disabled={isOperador && empresas.length <= 1}
          >
            <option value="">— selecionar empresa —</option>
            {[...empresas].sort((a, b) => (a.matriz_id ? 1 : 0) - (b.matriz_id ? 1 : 0) || a.nome.localeCompare(b.nome)).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.matriz_id ? `↳ ${emp.nome} (filial)` : emp.nome}</option>
            ))}
          </select>
        )}
        {isOperador && empresas.length <= 1 && auth.profile?.empresa_id && (
          <p className="text-[11px] text-muted-foreground">Empresa vinculada ao seu usuário — falar com o administrador para alterar.</p>
        )}
        {isOperador && empresas.length > 1 && (
          <p className="text-[11px] text-muted-foreground">Você pode lançar pagamentos para a matriz ou para qualquer filial vinculada.</p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        {tipo === "pix" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <Label>Tipo de chave *</Label>
              <Select value={pixTipoChave} onValueChange={(v) => setPixTipoChave(v as typeof pixTipoChave)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="celular">Celular</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="aleatoria">Chave aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-1">
              <Label>Chave PIX *</Label>
              <Input className="mt-1" value={pixChave} onChange={(e) => setPixChave(e.target.value)} placeholder="Preencha a chave" />
            </div>
            <div className="sm:col-span-2">
              <Label>Valor (R$) *</Label>
              <Input className="mt-1" inputMode="decimal" value={pixValor} onChange={(e) => setPixValor(e.target.value)} placeholder="0,00" />
            </div>
          </div>
        )}

        {tipo === "transferencia" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome completo / Razão social *</Label>
              <Input className="mt-1" value={tedNome} onChange={(e) => setTedNome(e.target.value)} />
            </div>
            <div>
              <Label>CPF / CNPJ *</Label>
              <Input className="mt-1" value={tedDoc} onChange={(e) => setTedDoc(e.target.value)} />
            </div>
            <div>
              <Label>Banco *</Label>
              <Input className="mt-1" value={tedBanco} onChange={(e) => setTedBanco(e.target.value)} placeholder="Nome do banco" />
            </div>
            <div>
              <Label>Agência *</Label>
              <Input className="mt-1" value={tedAgencia} onChange={(e) => setTedAgencia(e.target.value)} />
            </div>
            <div>
              <Label>Conta *</Label>
              <Input className="mt-1" value={tedConta} onChange={(e) => setTedConta(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de conta *</Label>
              <Select value={tedTipoConta} onValueChange={(v) => setTedTipoConta(v as typeof tedTipoConta)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Corrente</SelectItem>
                  <SelectItem value="poupanca">Poupança</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$) *</Label>
              <Input className="mt-1" inputMode="decimal" value={tedValor} onChange={(e) => setTedValor(e.target.value)} placeholder="0,00" />
            </div>
          </div>
        )}

        {tipo === "debito_veiculo" && (
          <div className="grid gap-4">
            <div>
              <Label>Categoria *</Label>
              <Select value={veicCategoria} onValueChange={(v) => setVeicCategoria(v as CategoriaVeiculo)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_VEICULO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>RENAVAM *</Label>
              <Input className="mt-1" value={veicRenavam} onChange={(e) => setVeicRenavam(e.target.value)} placeholder="Somente números" />
            </div>
            <div>
              <Label>Documento do veículo (opcional)</Label>
              <Input className="mt-1" type="file" accept="image/*,application/pdf" onChange={(e) => setVeicFile(e.target.files?.[0] ?? null)} />
              {veicFile && <p className="mt-1 text-xs text-muted-foreground">Arquivo: {veicFile.name}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={enviar} disabled={saving}>
          <Send className="mr-1.5 h-4 w-4" /> {saving ? "Enviando…" : "Enviar para pagamento"}
        </Button>
      </div>
    </div>
  );
}

function TipoCard({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${active ? "border-primary bg-primary/5 text-primary" : "border-border bg-card hover:border-primary/40"}`}
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{icon}</div>
      <span className="font-medium">{label}</span>
    </button>
  );
}