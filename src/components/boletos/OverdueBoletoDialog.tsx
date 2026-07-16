import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Calculator } from "lucide-react";
import type { BoletoRow } from "@/lib/boletos/storage";
import {
  calcularValorAtualizadoBoleto,
  extrairRegrasCompletas,
  formatarDataBR,
  getDataAtualBrasilia,
  parseDataBoleto,
  type JurosTipo,
  type MultaTipo,
  type MemoriaCalculo,
} from "@/lib/boletos/overdue";
import { formatCurrencyBRL } from "@/lib/boletos/format";

interface Props {
  row: BoletoRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (params: {
    valorAtualizado: number;
    memoria: MemoriaCalculo;
    origem: "instrucoes_boleto" | "preenchimento_manual";
  }) => void | Promise<void>;
}

type Stage = "aviso" | "revisao";

export function OverdueBoletoDialog({ row, open, onOpenChange, onConfirm }: Props) {
  const dataAtual = useMemo(() => getDataAtualBrasilia(), [open]);
  const valorOriginal = Number(row?.dados_json?.valor_documento ?? row?.valor_documento ?? row?.valor_cobrado ?? 0);
  const vencimento = row?.vencimento ?? null;

  const regrasAuto = useMemo(
    () =>
      extrairRegrasCompletas({
        instrucoes: row?.dados_json?.instrucoes ?? [],
        informacoes_adicionais: row?.dados_json?.informacoes_adicionais ?? null,
        multa: row?.dados_json?.multa ?? null,
        juros: row?.dados_json?.juros ?? null,
      }),
    [row?.id],
  );
  const identificouAuto = regrasAuto.juros_tipo !== "" || regrasAuto.multa_tipo !== "";

  const [stage, setStage] = useState<Stage>("aviso");
  const [multaTipo, setMultaTipo] = useState<MultaTipo>(regrasAuto.multa_tipo);
  const [multaValor, setMultaValor] = useState<string>(String(regrasAuto.multa_valor || ""));
  const [jurosTipo, setJurosTipo] = useState<JurosTipo>(regrasAuto.juros_tipo);
  const [jurosValor, setJurosValor] = useState<string>(String(regrasAuto.juros_valor || ""));

  // Reset ao (re)abrir com outro boleto
  const [lastId, setLastId] = useState<string | null>(null);
  if (open && row && row.id !== lastId) {
    setLastId(row.id);
    setStage("aviso");
    setMultaTipo(regrasAuto.multa_tipo);
    setMultaValor(String(regrasAuto.multa_valor || ""));
    setJurosTipo(regrasAuto.juros_tipo);
    setJurosValor(String(regrasAuto.juros_valor || ""));
  }

  const calculo = useMemo(() => {
    return calcularValorAtualizadoBoleto({
      valorOriginal,
      vencimento,
      dataAtual,
      jurosTipo,
      jurosValor: Number(String(jurosValor).replace(",", ".")) || 0,
      multaTipo,
      multaValor: Number(String(multaValor).replace(",", ".")) || 0,
    });
  }, [valorOriginal, vencimento, dataAtual, jurosTipo, jurosValor, multaTipo, multaValor]);

  const origem: "instrucoes_boleto" | "preenchimento_manual" =
    identificouAuto &&
    multaTipo === regrasAuto.multa_tipo &&
    Number(multaValor) === regrasAuto.multa_valor &&
    jurosTipo === regrasAuto.juros_tipo &&
    Number(jurosValor) === regrasAuto.juros_valor
      ? "instrucoes_boleto"
      : "preenchimento_manual";

  const confirmar = async () => {
    const memoria: MemoriaCalculo = {
      valor_original: calculo.valor_original,
      vencimento: vencimento ? formatarDataBR(parseDataBoleto(vencimento)!) : "",
      data_calculo: formatarDataBR(dataAtual),
      dias_atraso: calculo.dias_atraso,
      multa: {
        tipo: calculo.multa_tipo,
        valor_base: calculo.multa_valor_base,
        valor_calculado: calculo.multa_calculada,
      },
      juros: {
        tipo: calculo.juros_tipo,
        valor_base: calculo.juros_valor_base,
        percentual_diario: calculo.juros_diario_percentual,
        valor_calculado: calculo.juros_calculado,
      },
      valor_atualizado: calculo.valor_atualizado,
      origem_dos_dados: origem,
    };
    await onConfirm({ valorAtualizado: calculo.valor_atualizado, memoria, origem });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {stage === "aviso" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Boleto vencido
              </DialogTitle>
              <DialogDescription>
                {identificouAuto ? (
                  <>
                    Este boleto está vencido. O sistema calculará automaticamente o valor atualizado
                    com juros e multa conforme as instruções identificadas no boleto. Confira o cálculo
                    antes de confirmar o pagamento.
                  </>
                ) : (
                  <>
                    Este boleto está vencido, mas não foi possível identificar automaticamente os
                    percentuais ou valores de juros e multa nas instruções. Preencha os dados manualmente
                    para calcular o valor atualizado.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
              <div className="flex justify-between"><span>Vencimento</span><span>{vencimento ? formatarDataBR(parseDataBoleto(vencimento)!) : "—"}</span></div>
              <div className="flex justify-between"><span>Data atual (Brasília)</span><span>{formatarDataBR(dataAtual)}</span></div>
              <div className="flex justify-between font-medium"><span>Dias em atraso</span><span>{calculo.dias_atraso}</span></div>
              <div className="flex justify-between"><span>Valor original</span><span>{formatCurrencyBRL(valorOriginal)}</span></div>
              {identificouAuto && (
                <>
                  <div className="mt-2 flex justify-between border-t border-amber-200 pt-2">
                    <span>
                      Multa
                      {calculo.multa_tipo === "percentual" && ` (${calculo.multa_valor_base}%)`}
                      {calculo.multa_tipo === "valor_fixo" && " (fixa)"}
                      {!calculo.multa_tipo && " (não identificada)"}
                    </span>
                    <span>{formatCurrencyBRL(calculo.multa_calculada)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      Juros de mora
                      {calculo.juros_tipo === "percentual_mensal" && ` (${calculo.juros_valor_base}% a.m.)`}
                      {calculo.juros_tipo === "percentual_diario" && ` (${calculo.juros_valor_base}% a.d.)`}
                      {calculo.juros_tipo === "valor_fixo_diario" && ` (R$ ${calculo.juros_valor_base}/dia)`}
                      {!calculo.juros_tipo && " (não identificado)"}
                    </span>
                    <span>{formatCurrencyBRL(calculo.juros_calculado)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-amber-300 pt-1 text-base font-semibold">
                    <span>Valor atualizado</span>
                    <span>{formatCurrencyBRL(calculo.valor_atualizado)}</span>
                  </div>
                </>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button variant="outline" onClick={() => setStage("revisao")}>
                <Calculator className="mr-1.5 h-4 w-4" /> Calcular valor atualizado
              </Button>
              <Button
                onClick={confirmar}
                className="bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600"
              >
                Ok
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Cálculo do valor atualizado</DialogTitle>
              <DialogDescription>
                Revise os percentuais/valores {identificouAuto ? "identificados nas instruções" : "preenchidos manualmente"} e confirme o envio.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Tipo de multa</Label>
                <Select value={multaTipo || "sem"} onValueChange={(v) => setMultaTipo(v === "sem" ? "" : (v as MultaTipo))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem">Sem multa</SelectItem>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor da multa {multaTipo === "percentual" ? "(%)" : multaTipo === "valor_fixo" ? "(R$)" : ""}</Label>
                <Input inputMode="decimal" value={multaValor} disabled={!multaTipo} onChange={(e) => setMultaValor(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Tipo de juros</Label>
                <Select value={jurosTipo || "sem"} onValueChange={(v) => setJurosTipo(v === "sem" ? "" : (v as JurosTipo))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem">Sem juros</SelectItem>
                    <SelectItem value="percentual_mensal">Percentual mensal (%)</SelectItem>
                    <SelectItem value="percentual_diario">Percentual diário (%)</SelectItem>
                    <SelectItem value="valor_fixo_diario">Valor fixo diário (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor do juros {jurosTipo.startsWith("percentual") ? "(%)" : jurosTipo === "valor_fixo_diario" ? "(R$/dia)" : ""}</Label>
                <Input inputMode="decimal" value={jurosValor} disabled={!jurosTipo} onChange={(e) => setJurosValor(e.target.value)} />
              </div>
            </div>

            <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between"><span>Valor original</span><span>{formatCurrencyBRL(calculo.valor_original)}</span></div>
              <div className="flex justify-between"><span>Vencimento</span><span>{vencimento ? formatarDataBR(parseDataBoleto(vencimento)!) : "—"}</span></div>
              <div className="flex justify-between"><span>Data do cálculo</span><span>{formatarDataBR(dataAtual)}</span></div>
              <div className="flex justify-between"><span>Dias em atraso</span><span>{calculo.dias_atraso} dias</span></div>
              <div className="flex justify-between">
                <span>Multa aplicada</span>
                <span>
                  {calculo.multa_tipo === "percentual" && `${calculo.multa_valor_base}% = `}
                  {calculo.multa_tipo === "valor_fixo" && "fixa = "}
                  {formatCurrencyBRL(calculo.multa_calculada)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Juros de mora</span>
                <span>
                  {calculo.juros_tipo === "percentual_mensal" && `${calculo.juros_valor_base}% ao mês = `}
                  {calculo.juros_tipo === "percentual_diario" && `${calculo.juros_valor_base}% ao dia = `}
                  {calculo.juros_tipo === "valor_fixo_diario" && `R$ ${calculo.juros_valor_base}/dia = `}
                  {formatCurrencyBRL(calculo.juros_calculado)}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold">
                <span>Valor atualizado</span><span>{formatCurrencyBRL(calculo.valor_atualizado)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStage("aviso")}>Voltar</Button>
              <Button onClick={confirmar}>Confirmar e enviar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
