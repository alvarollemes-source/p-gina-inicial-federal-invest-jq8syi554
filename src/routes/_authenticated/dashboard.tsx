import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { FileText, CheckCircle2, AlertTriangle, DollarSign, Clock, XCircle, Send, Ban } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/boletos/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Federal Invest Trustee" }] }),
  component: Dashboard,
});

type Row = {
  status: string | null;
  status_validacao: string | null;
  valor_cobrado: number | null;
  valor_documento: number | null;
  criado_em: string;
  vencimento: string | null;
};

type Preset = "all" | "7d" | "30d" | "month" | "custom";

function rangeFromPreset(preset: Preset, from: string, to: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (preset === "all") return { from: null, to: null };
  if (preset === "7d") return { from: new Date(now.getTime() - 7 * 86400000), to: now };
  if (preset === "30d") return { from: new Date(now.getTime() - 30 * 86400000), to: now };
  if (preset === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  return {
    from: from ? new Date(from + "T00:00:00") : null,
    to: to ? new Date(to + "T23:59:59") : null,
  };
}

function Dashboard() {
  const auth = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusF, setStatusF] = useState<string>("all");

  useEffect(() => {
    supabase
      .from("boletos")
      .select("status,status_validacao,valor_cobrado,valor_documento,criado_em,vencimento")
      .limit(5000)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);

  const filtered = useMemo(() => {
    const { from: dFrom, to: dTo } = rangeFromPreset(preset, from, to);
    return rows.filter((r) => {
      if (dFrom && new Date(r.criado_em) < dFrom) return false;
      if (dTo && new Date(r.criado_em) > dTo) return false;
      if (statusF !== "all" && r.status !== statusF) return false;
      return true;
    });
  }, [rows, preset, from, to, statusF]);

  const stats = useMemo(() => {
    const s = {
      total: filtered.length,
      recebidos: 0,
      aprovados: 0,
      rejeitados: 0,
      pagos: 0,
      pendentes: 0,
      invalidos: 0,
      valor: 0,
      valorPago: 0,
    };
    for (const r of filtered) {
      const v = Number(r.valor_cobrado ?? r.valor_documento ?? 0);
      s.valor += v;
      if (r.status === "recebido") s.recebidos++;
      if (r.status === "aprovado") s.aprovados++;
      if (r.status === "rejeitado") s.rejeitados++;
      if (r.status === "pago") { s.pagos++; s.valorPago += v; }
      if (r.status === "rascunho" || r.status === "em_analise") s.pendentes++;
      if (r.status_validacao === "invalido") s.invalidos++;
    }
    return s;
  }, [filtered]);

  const cards = [
    { label: "Total no período", value: stats.total, icon: FileText, tone: "text-primary bg-primary/10" },
    { label: "Recebidos", value: stats.recebidos, icon: Send, tone: "text-sky-700 bg-sky-50" },
    { label: "Aprovados", value: stats.aprovados, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Pagos", value: stats.pagos, icon: DollarSign, tone: "text-emerald-800 bg-emerald-100" },
    { label: "Rejeitados", value: stats.rejeitados, icon: XCircle, tone: "text-red-700 bg-red-50" },
    { label: "Pendentes", value: stats.pendentes, icon: Clock, tone: "text-amber-700 bg-amber-50" },
    { label: "Inválidos", value: stats.invalidos, icon: AlertTriangle, tone: "text-orange-700 bg-orange-50" },
    { label: "Volume total", value: formatCurrencyBRL(stats.valor), icon: Ban, tone: "text-slate-700 bg-slate-100" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo, {auth.profile?.nome ?? auth.user?.email}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Visão gerencial das operações de boletos.</p>

      <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
        <div>
          <Label>Período</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {preset === "custom" && (
          <>
            <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </>
        )}
        <div>
          <Label>Status</Label>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="recebido">Recebido</SelectItem>
              <SelectItem value="em_analise">Em análise</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.tone}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Volume pago no período</p>
        <p className="mt-1 text-3xl font-semibold text-emerald-700">{formatCurrencyBRL(stats.valorPago)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{stats.pagos} boleto(s) pagos</p>
      </div>
    </div>
  );
}