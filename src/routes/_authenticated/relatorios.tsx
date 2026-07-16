import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/boletos/format";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Federal Invest" }] }),
  component: RelatoriosPage,
});

type Boleto = {
  id: string;
  beneficiario_nome: string | null;
  pagador_nome: string | null;
  valor_cobrado: number | null;
  valor_documento: number | null;
  vencimento: string | null;
  status: string;
  criado_em: string;
};

function RelatoriosPage() {
  const [rows, setRows] = useState<Boleto[]>([]);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  useEffect(() => {
    supabase.from("boletos").select("id,beneficiario_nome,pagador_nome,valor_cobrado,valor_documento,vencimento,status,criado_em").order("criado_em", { ascending: false }).limit(2000).then(({ data }) => setRows((data ?? []) as Boleto[]));
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const d = new Date(r.criado_em).getTime();
      if (de && d < new Date(de).getTime()) return false;
      if (ate && d > new Date(ate).getTime() + 86400000) return false;
      return true;
    });
  }, [rows, de, ate]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.valor_cobrado ?? r.valor_documento ?? 0), 0);
    const porStatus = filtered.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
    return { total, porStatus, count: filtered.length };
  }, [filtered]);

  const exportCsv = () => {
    const head = ["ID", "Beneficiário", "Pagador", "Valor", "Vencimento", "Status", "Criado em"];
    const rows = filtered.map((r) => [r.id, r.beneficiario_nome ?? "", r.pagador_nome ?? "", (r.valor_cobrado ?? r.valor_documento ?? 0), r.vencimento ?? "", r.status, r.criado_em]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-boletos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
      <p className="mt-1 text-sm text-muted-foreground">Consolidado por período. Exporte para CSV.</p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        <Button onClick={exportCsv} variant="outline"><Download className="h-4 w-4 mr-1" /> Exportar CSV</Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card label="Boletos" value={String(totals.count)} />
        <Card label="Valor total" value={formatCurrencyBRL(totals.total)} />
        <Card label="Status" value={Object.entries(totals.porStatus).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"} />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>
            <th className="px-4 py-2 text-left">Data</th>
            <th className="px-4 py-2 text-left">Beneficiário</th>
            <th className="px-4 py-2 text-right">Valor</th>
            <th className="px-4 py-2 text-left">Status</th>
          </tr></thead>
          <tbody>
            {filtered.slice(0, 200).map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2 text-muted-foreground">{new Date(r.criado_em).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-2">{r.beneficiario_nome ?? "—"}</td>
                <td className="px-4 py-2 text-right">{formatCurrencyBRL(Number(r.valor_cobrado ?? r.valor_documento ?? 0))}</td>
                <td className="px-4 py-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground truncate">{value}</p>
    </div>
  );
}