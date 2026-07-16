import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileStack, Search, Filter, ExternalLink, CloudUpload } from "lucide-react";
import { listPaymentDocuments } from "@/lib/financeiro/db";
import type { PaymentDocument } from "@/lib/financeiro/types";
import { DOC_TIPO_LABEL } from "@/lib/financeiro/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/financeiro/documentos")({
  head: () => ({ meta: [{ title: "Documentos de pagamento — Federal Invest" }] }),
  component: DocumentosPage,
});

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DocumentosPage() {
  const [rows, setRows] = useState<PaymentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    listPaymentDocuments().then((r) => {
      setRows(r);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.beneficiario_nome, r.beneficiario_documento, r.descricao, r.arquivo_nome]
        .filter(Boolean)
        .some((x) => (x as string).toLowerCase().includes(s)),
    );
  }, [rows, q]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileStack className="h-6 w-6 text-primary" /> Documentos de pagamento
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os documentos disponíveis para conferência e inclusão em lotes CNAB.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/financeiro/documentos/upload"><CloudUpload className="mr-1 h-4 w-4" /> Novo upload</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/financeiro/cnab">Central CNAB <ExternalLink className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </header>

      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por beneficiário, documento, descrição…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-1 h-4 w-4" /> Filtros
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beneficiário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Extração</TableHead>
                  <TableHead>Conferência</TableHead>
                  <TableHead>CNAB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">Nenhum documento.</TableCell></TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => { window.location.href = `/financeiro/documentos/${r.id}`; }}>
                    <TableCell>
                      <div className="font-medium">{r.beneficiario_nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.beneficiario_documento ?? ""}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{DOC_TIPO_LABEL[r.tipo]}</Badge></TableCell>
                    <TableCell>{r.vencimento ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.valor_final ?? r.valor_nominal)}</TableCell>
                    <TableCell><Badge variant="secondary">{r.status_extracao}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{r.status_conferencia}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={r.status_cnab === "nao_incluido" ? "outline" : "default"}>{r.status_cnab}</Badge>
                      {r.is_demo && <Badge variant="outline" className="ml-2">demo</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}