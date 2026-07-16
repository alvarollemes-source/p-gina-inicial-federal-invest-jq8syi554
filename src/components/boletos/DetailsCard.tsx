import { useState } from "react";
import { ChevronDown, ChevronUp, Building2, Calendar, User2, Wallet } from "lucide-react";
import type { BoletoData } from "@/lib/boletos/types";
import { formatCep, formatCpfCnpj, formatCurrencyBRL, formatDateBR, tipoDocumentoLabel } from "@/lib/boletos/format";
import { nomeBanco } from "@/lib/boletos/validate";
import { Button } from "@/components/ui/button";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 py-2 border-b border-border/60 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground text-left sm:text-right break-words">{value ?? "—"}</span>
    </div>
  );
}

export function DetailsCard({ data }: { data: BoletoData }) {
  const [open, setOpen] = useState(false);
  const bancoNome = data.banco.nome ?? nomeBanco(data.banco.codigo) ?? "—";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Dados do documento</h2>
          <p className="text-xs text-muted-foreground">{tipoDocumentoLabel(data.tipo_documento)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-muted/30 p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> Vencimento
          </div>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{formatDateBR(data.vencimento)}</p>
        </div>
        <div className="rounded-xl bg-muted/30 p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Valor a pagar
          </div>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {formatCurrencyBRL(data.valor_cobrado ?? data.valor_documento)}
          </p>
          {data.valor_cobrado != null && data.valor_documento != null && data.valor_cobrado !== data.valor_documento && (
            <p className="mt-1 text-xs text-muted-foreground">Documento: {formatCurrencyBRL(data.valor_documento)}</p>
          )}
        </div>
      </div>

      {data.atualizacao?.aplicada && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Boleto vencido — valor atualizado</p>
          <div className="mt-2 space-y-0.5 text-amber-900">
            <div className="flex justify-between"><span>Valor original</span><span>{formatCurrencyBRL(data.atualizacao.valor_original)}</span></div>
            <div className="flex justify-between"><span>Dias em atraso</span><span>{data.atualizacao.dias_atraso}</span></div>
            <div className="flex justify-between"><span>Data do cálculo</span><span>{data.atualizacao.data_calculo}</span></div>
            {data.atualizacao.multa?.tipo && (
              <div className="flex justify-between">
                <span>
                  Multa
                  {data.atualizacao.multa.tipo === "percentual" && ` (${data.atualizacao.multa.valor_base}%)`}
                  {data.atualizacao.multa.tipo === "valor_fixo" && " (fixa)"}
                </span>
                <span>{formatCurrencyBRL(data.atualizacao.multa.valor_calculado)}</span>
              </div>
            )}
            {data.atualizacao.juros?.tipo && (
              <div className="flex justify-between">
                <span>
                  Juros de mora
                  {data.atualizacao.juros.tipo === "percentual_mensal" && ` (${data.atualizacao.juros.valor_base}% a.m.)`}
                  {data.atualizacao.juros.tipo === "percentual_diario" && ` (${data.atualizacao.juros.valor_base}% a.d.)`}
                  {data.atualizacao.juros.tipo === "valor_fixo_diario" && ` (R$ ${data.atualizacao.juros.valor_base}/dia × ${data.atualizacao.dias_atraso})`}
                </span>
                <span>{formatCurrencyBRL(data.atualizacao.juros.valor_calculado)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-amber-300 pt-1 mt-1"><span>Valor atualizado</span><span>{formatCurrencyBRL(data.atualizacao.valor_atualizado)}</span></div>
            <p className="mt-1 text-xs text-amber-700">
              Origem: {data.atualizacao.origem_dos_dados === "instrucoes_boleto" ? "instruções do boleto" : "preenchimento manual"}
            </p>
          </div>
        </div>
      )}



      <div className="mt-4 space-y-4">
        {data.gps && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
              Guia da Previdência Social (GPS)
            </div>
            <Row label="Código do pagamento" value={data.gps.codigo_pagamento} />
            <Row label="Competência" value={data.gps.competencia} />
            <Row label="Identificador" value={data.gps.identificador ? formatCpfCnpj(data.gps.identificador) : null} />
            <Row label="Valor do INSS" value={data.gps.valor_inss != null ? formatCurrencyBRL(data.gps.valor_inss) : null} />
            <Row label="Valor de Outras Entidades" value={data.gps.valor_outras_entidades != null ? formatCurrencyBRL(data.gps.valor_outras_entidades) : null} />
            <Row label="ATM/Multa e Juros" value={data.gps.atm_multa_juros != null ? formatCurrencyBRL(data.gps.atm_multa_juros) : null} />
            <Row label="Total (Valor a pagar)" value={data.gps.valor_total != null ? formatCurrencyBRL(data.gps.valor_total) : null} />
          </div>
        )}
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> Beneficiário
          </div>
          <p className="text-sm text-foreground">{data.beneficiario.nome ?? "—"}</p>
          {data.beneficiario.documento && (
            <p className="text-xs text-muted-foreground">
              {data.beneficiario.tipo_documento ?? "Documento"}: {formatCpfCnpj(data.beneficiario.documento)}
            </p>
          )}
          {(data.banco.codigo || bancoNome !== "—") && (
            <p className="mt-1 text-xs text-muted-foreground">
              Banco {data.banco.codigo ?? ""} · {bancoNome}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <User2 className="h-3.5 w-3.5" /> Pagador
          </div>
          <p className="text-sm text-foreground">{data.pagador.nome ?? "—"}</p>
          {data.pagador.documento && (
            <p className="text-xs text-muted-foreground">
              {data.pagador.tipo_documento ?? "Documento"}: {formatCpfCnpj(data.pagador.documento)}
            </p>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-border pt-4">
          <Row label="Nº documento" value={data.numero_documento} />
          <Row label="Nosso número" value={data.nosso_numero} />
          <Row label="Agência / código do beneficiário" value={data.agencia_codigo_beneficiario} />
          <Row label="Carteira" value={data.carteira} />
          <Row label="Espécie" value={data.especie} />
          <Row label="Aceite" value={data.aceite} />
          <Row label="Data do documento" value={formatDateBR(data.data_documento)} />
          <Row label="Data de processamento" value={formatDateBR(data.data_processamento)} />
          <Row label="Juros" value={data.juros != null ? formatCurrencyBRL(data.juros) : null} />
          <Row label="Multa" value={data.multa != null ? formatCurrencyBRL(data.multa) : null} />
          <Row label="Desconto" value={data.desconto != null ? formatCurrencyBRL(data.desconto) : null} />
          <Row label="Endereço do pagador" value={data.pagador.endereco} />
          <Row label="Cidade / UF" value={data.pagador.cidade ? `${data.pagador.cidade}${data.pagador.estado ? " / " + data.pagador.estado : ""}` : null} />
          <Row label="CEP" value={data.pagador.cep ? formatCep(data.pagador.cep) : null} />
          <Row label="Referência" value={data.referencia} />
          <Row label="Nº instalação" value={data.numero_instalacao} />
          <Row label="Nota fiscal" value={data.nota_fiscal} />
          <Row label="Chave da NF" value={data.chave_nota_fiscal} />
          <Row label="Informações adicionais" value={data.informacoes_adicionais} />
          {data.instrucoes.length > 0 && (
            <div className="py-2 border-b border-border/60 last:border-b-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Instruções</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-foreground">
                {data.instrucoes.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Button variant="ghost" size="sm" className="mt-2 w-full text-muted-foreground" onClick={() => setOpen((v) => !v)}>
        {open ? (
          <>
            <ChevronUp className="mr-1 h-4 w-4" /> Ocultar detalhes
          </>
        ) : (
          <>
            <ChevronDown className="mr-1 h-4 w-4" /> Ver todos os detalhes
          </>
        )}
      </Button>
    </div>
  );
}