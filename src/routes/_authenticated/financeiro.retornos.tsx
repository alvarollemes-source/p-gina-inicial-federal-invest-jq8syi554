import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/layout/PageStub";

export const Route = createFileRoute("/_authenticated/financeiro/retornos")({
  head: () => ({ meta: [{ title: "Arquivos de retorno — Federal Invest" }] }),
  component: () => (
    <PageStub
      title="Arquivos de retorno"
      description="Área para importação e leitura de arquivos RET do banco. Nesta etapa apenas a estrutura visual foi disponibilizada; o processamento real dos arquivos será implementado nas próximas fases."
    />
  ),
});