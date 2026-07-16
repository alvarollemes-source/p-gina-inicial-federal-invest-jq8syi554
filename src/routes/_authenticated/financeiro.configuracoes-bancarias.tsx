import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Landmark } from "lucide-react";
import { listBankAccounts } from "@/lib/financeiro/db";
import type { BankAccount } from "@/lib/financeiro/types";

export const Route = createFileRoute("/_authenticated/financeiro/configuracoes-bancarias")({
  head: () => ({ meta: [{ title: "Configurações bancárias — Federal Invest" }] }),
  component: ConfigBancarias,
});

function ConfigBancarias() {
  const [rows, setRows] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listBankAccounts().then((r) => {
      setRows(r);
      setLoading(false);
    });
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Landmark className="h-6 w-6 text-primary" /> Configurações bancárias
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro das contas usadas para geração dos arquivos CNAB 240.
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
        )}
        {rows.map((r) => (
          <Card key={r.id} className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{r.banco_nome}</span>
                {r.is_demo && <Badge variant="outline">demo</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>Código: <span className="text-foreground">{r.banco_codigo}</span></p>
              <p>Agência: <span className="text-foreground">{r.agencia}</span></p>
              <p>Conta: <span className="text-foreground">{r.conta}{r.conta_dv ? `-${r.conta_dv}` : ""}</span></p>
              {r.convenio && <p>Convênio: <span className="text-foreground">{r.convenio}</span></p>}
              {r.cedente_nome && <p>Cedente: <span className="text-foreground">{r.cedente_nome}</span></p>}
              <Badge variant={r.ativo ? "default" : "secondary"} className="mt-2">
                {r.ativo ? "Ativa" : "Inativa"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}