import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({ meta: [{ title: "Logs de Atividade" }] }),
  component: LogsPage,
});

type Log = {
  id: string;
  acao: string;
  modulo: string | null;
  data_hora: string;
  detalhes: unknown;
  user_id: string | null;
  usuario_email?: string | null;
};

function LogsPage() {
  const [rows, setRows] = useState<Log[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { nome: string | null; email: string | null }>>({});
  const [modulo, setModulo] = useState<string>("all");
  const [acao, setAcao] = useState<string>("");
  const [usuario, setUsuario] = useState<string>("");
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const pageSize = 1000;
      let from = 0;
      const logs: Log[] = [];
      // Paginação por range para contornar o limite padrão de 1000 do PostgREST
      // e trazer todos os registros da plataforma.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("logs_atividade")
          .select("*")
          .order("data_hora", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) break;
        const batch = (data ?? []) as Log[];
        logs.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      setRows(logs);
      const ids = Array.from(new Set(logs.map((l) => l.user_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,nome,email").in("id", ids);
        const m: Record<string, { nome: string | null; email: string | null }> = {};
        (profs ?? []).forEach((p) => { m[p.id as string] = { nome: p.nome as string | null, email: p.email as string | null }; });
        setProfiles(m);
      }
    })();
  }, []);

  const modulos = useMemo(() => Array.from(new Set(rows.map((r) => r.modulo).filter(Boolean))) as string[], [rows]);

  const filtered = useMemo(() => {
    return rows.filter((l) => {
      if (modulo !== "all" && l.modulo !== modulo) return false;
      if (acao && !l.acao.toLowerCase().includes(acao.toLowerCase())) return false;
      if (usuario) {
        const p = l.user_id ? profiles[l.user_id] : null;
        const hay = `${p?.nome ?? ""} ${p?.email ?? ""}`.toLowerCase();
        if (!hay.includes(usuario.toLowerCase())) return false;
      }
      if (de && new Date(l.data_hora) < new Date(de + "T00:00:00")) return false;
      if (ate && new Date(l.data_hora) > new Date(ate + "T23:59:59")) return false;
      return true;
    });
  }, [rows, modulo, acao, usuario, de, ate, profiles]);

  useEffect(() => { setPage(1); }, [modulo, acao, usuario, de, ate, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Logs de Atividade</h1>
      <p className="mt-1 text-sm text-muted-foreground">Todos os eventos registrados na plataforma.</p>

      <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-5">
        <div>
          <Label>Módulo</Label>
          <Select value={modulo} onValueChange={setModulo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {modulos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Ação</Label><Input value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="Filtrar por ação…" /></div>
        <div><Label>Usuário</Label><Input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Nome/email" /></div>
        <div><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Quando</th>
              <th className="px-4 py-2 text-left">Usuário</th>
              <th className="px-4 py-2 text-left">Módulo</th>
              <th className="px-4 py-2 text-left">Ação</th>
              <th className="px-4 py-2 text-left">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((l) => {
              const p = l.user_id ? profiles[l.user_id] : null;
              const isOpen = !!expanded[l.id];
              return (
                <Fragment key={l.id}>
                <tr className="border-t border-border align-top">
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{new Date(l.data_hora).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2 text-xs">{p?.nome ?? p?.email ?? (l.user_id ? l.user_id.slice(0, 8) : "sistema")}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{l.modulo ?? "—"}</Badge></td>
                  <td className="px-4 py-2 font-medium">{l.acao}</td>
                  <td className="px-4 py-2 text-xs">
                    {l.detalhes ? (
                      <button
                        onClick={() => setExpanded((e) => ({ ...e, [l.id]: !e[l.id] }))}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {isOpen ? "Ocultar" : "Expandir"}
                      </button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
                {isOpen && l.detalhes != null && (
                  <tr className="border-t border-border bg-muted/20">
                    <td colSpan={5} className="px-4 py-3 text-xs text-muted-foreground">
                      <pre className="whitespace-pre-wrap break-all">{JSON.stringify(l.detalhes, null, 2)}</pre>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhum log com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Itens por página:</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <span>· {filtered.length} registros</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
        </div>
      </div>
    </div>
  );
}