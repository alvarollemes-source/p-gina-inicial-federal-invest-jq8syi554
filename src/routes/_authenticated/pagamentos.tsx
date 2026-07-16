import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Wallet, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pagamentos")({
  head: () => ({ meta: [{ title: "Pagamentos — Federal Invest" }] }),
  component: PagamentosHub,
});

function PagamentosHub() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pagamentos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Selecione o tipo de pagamento que deseja enviar para a Federal Invest.
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Link
          to="/upload-boletos"
          className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/60 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Pagamento de Boleto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie um ou mais boletos em PDF ou imagem. Extraímos automaticamente o código de barras,
            valor, vencimento e beneficiário para conferência antes do envio.
          </p>
          <div className="mt-6 flex items-center gap-1 text-sm font-medium text-primary">
            Continuar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link
          to="/pagamentos-manuais"
          className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/60 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">PIX, Transferência e outros</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lance manualmente pagamentos por PIX, TED/DOC ou débitos de veículos (IPVA, licenciamento,
            multas, DPVAT etc.), vinculando à empresa correta.
          </p>
          <div className="mt-6 flex items-center gap-1 text-sm font-medium text-primary">
            Continuar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      </div>
    </div>
  );
}