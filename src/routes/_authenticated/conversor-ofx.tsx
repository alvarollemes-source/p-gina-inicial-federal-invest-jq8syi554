import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { convertToOfx, convertFromOfx, type ConversionResult } from "@/lib/ofx/convert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatCurrencyBRL } from "@/lib/boletos/format";
import { FileSpreadsheet, Download, Loader2, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/conversor-ofx")({
  head: () => ({ meta: [{ title: "Conversor XLS→OFX" }] }),
  component: ConversorOfxPage,
});

function ConversorOfxPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<"xls2ofx" | "ofx2xls">("xls2ofx");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [reverse, setReverse] = useState<{ lancamentos: ConversionResult["lancamentos"]; totalCreditos: number; totalDebitos: number; saldoFinal: number; xlsx: ArrayBuffer } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setReverse(null);
    try {
      if (mode === "xls2ofx") {
        const r = await convertToOfx(file);
        setResult(r);
        await supabase.from("conversoes_ofx").insert({
          user_id: auth.user?.id ?? null,
          empresa_id: auth.profile?.empresa_id ?? null,
          nome_arquivo_xls: file.name,
          quantidade_lancamentos: r.lancamentos.length,
          total_creditos: r.totalCreditos,
          total_debitos: r.totalDebitos,
          saldo_final: r.saldoFinal,
          status_conversao: "sucesso",
        });
        toast.success(`${r.lancamentos.length} lançamentos convertidos`);
      } else {
        const r = await convertFromOfx(file);
        setReverse(r);
        toast.success(`${r.lancamentos.length} lançamentos extraídos do OFX`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na conversão");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!file) return;
    if (mode === "xls2ofx" && result) {
      const blob = new Blob([result.ofx], { type: "application/x-ofx" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.[^.]+$/, "") + ".ofx";
      a.click();
      URL.revokeObjectURL(url);
    } else if (mode === "ofx2xls" && reverse) {
      const blob = new Blob([reverse.xlsx], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.[^.]+$/, "") + ".xlsx";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const active = mode === "xls2ofx" ? result : reverse;
  const accept = mode === "xls2ofx" ? ".xls,.xlsx,.csv,.html,.htm" : ".ofx";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
        <ArrowRightLeft className="h-6 w-6 text-primary" /> Conversor OFX
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Converta extratos bancários entre planilha e OFX nos dois sentidos.</p>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as typeof mode); setFile(null); setResult(null); setReverse(null); }} className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="xls2ofx">XLS/CSV → OFX</TabsTrigger>
          <TabsTrigger value="ofx2xls">OFX → XLS</TabsTrigger>
        </TabsList>
        <TabsContent value="xls2ofx" className="text-xs text-muted-foreground pt-2">
          Colunas esperadas: Data, Descrição, Valor (ou Crédito/Débito), C/D (opcional).
        </TabsContent>
        <TabsContent value="ofx2xls" className="text-xs text-muted-foreground pt-2">
          Envie um arquivo .ofx para extrair os lançamentos como planilha.
        </TabsContent>
      </Tabs>

      <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <Input type="file" accept={accept} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setReverse(null); }} />
          <Button onClick={run} disabled={!file || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Converter
          </Button>
        </div>
      </div>

      {active && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Metric label="Créditos" value={formatCurrencyBRL(active.totalCreditos)} />
            <Metric label="Débitos" value={formatCurrencyBRL(active.totalDebitos)} />
            <Metric label="Saldo" value={formatCurrencyBRL(active.saldoFinal)} />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{active.lancamentos.length} lançamentos</p>
            <Button onClick={download}><Download className="h-4 w-4 mr-1" /> Baixar {mode === "xls2ofx" ? "OFX" : "XLSX"}</Button>
          </div>
          <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-right">Valor</th></tr>
              </thead>
              <tbody>
                {active.lancamentos.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-1.5">{l.data.slice(6, 8)}/{l.data.slice(4, 6)}/{l.data.slice(0, 4)}</td>
                    <td className="px-3 py-1.5">{l.descricao}</td>
                    <td className={`px-3 py-1.5 text-right ${l.valor < 0 ? "text-red-600" : "text-emerald-700"}`}>{formatCurrencyBRL(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}