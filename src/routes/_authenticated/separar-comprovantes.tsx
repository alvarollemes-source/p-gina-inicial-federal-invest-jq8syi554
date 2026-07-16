import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Download, FileText, Loader2, Package, RefreshCw, Save, Scissors, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  buildFilename,
  layoutTextFromPdfjsItems,
  parseReceiptText,
  requiresReview,
  uniqueFilename,
  type ParsedReceipt,
  type ReceiptType,
} from "@/lib/split/comprovantes";

export const Route = createFileRoute("/_authenticated/separar-comprovantes")({
  head: () => ({ meta: [{ title: "Separar Comprovantes — Federal Invest" }] }),
  component: SepararComprovantesPage,
});

type ProcessedItem = ParsedReceipt & {
  filename: string;
  bytes: Uint8Array;
  status: "ok" | "revisar" | "corrigido";
  editing?: boolean;
  draft?: { tipo: ReceiptType; data: string; beneficiario: string; valor: string };
};

function SepararComprovantesPage() {
  const auth = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progressPage, setProgressPage] = useState(0);
  const [phase, setPhase] = useState<string>("");
  const [items, setItems] = useState<ProcessedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [removeAccents, setRemoveAccents] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canAccess = auth.canAccess("separar-comprovantes");

  const chooseFile = useCallback(async (f: File | null | undefined) => {
    setError(null);
    setItems([]);
    setTotalPages(null);
    setProgressPage(0);
    if (!f) return;
    if (!/pdf$/i.test(f.name) && f.type !== "application/pdf") {
      setError("Envie um arquivo PDF.");
      return;
    }
    if (f.size > 60 * 1024 * 1024) {
      setError("Arquivo maior que 60 MB.");
      return;
    }
    setFile(f);
    // Try to detect page count up front (lightweight — just load)
    try {
      const { PDFDocument } = await import("pdf-lib");
      const buf = await f.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      setTotalPages(doc.getPageCount());
    } catch {
      /* falha silenciosa; será tratada no processamento */
    }
  }, []);

  const process = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setItems([]);
    setProgressPage(0);
    try {
      setPhase("Lendo o PDF…");
      const buf = await file.arrayBuffer();

      const pdfjs = await import("pdfjs-dist");
      try {
        // @ts-ignore worker url
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      } catch {
        /* worker já configurado */
      }
      const { PDFDocument } = await import("pdf-lib");
      const jsDoc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
      const srcDoc = await PDFDocument.load(buf.slice(0), { ignoreEncryption: false });
      const total = jsDoc.numPages;
      setTotalPages(total);

      const used = new Set<string>();
      const out: ProcessedItem[] = [];
      for (let i = 0; i < total; i++) {
        setProgressPage(i + 1);
        setPhase(`Processando página ${i + 1} de ${total}…`);

        const page = await jsDoc.getPage(i + 1);
        const content = await page.getTextContent();
        const layoutText = layoutTextFromPdfjsItems(
          content.items
            .filter((it) => "str" in it)
            .map((it) => ({
              str: (it as { str: string }).str,
              transform: (it as { transform: number[] }).transform,
            })),
        );
        const parsed = parseReceiptText(layoutText, i + 1);

        const outDoc = await PDFDocument.create();
        const [copied] = await outDoc.copyPages(srcDoc, [i]);
        outDoc.addPage(copied);
        const bytes = await outDoc.save();

        const filename = uniqueFilename(buildFilename(parsed, { removeAccents }), used);
        const status: ProcessedItem["status"] = requiresReview(parsed) ? "revisar" : "ok";
        out.push({ ...parsed, filename, bytes, status });
      }

      setItems(out);
      setPhase("Concluído");
      toast.success(`${out.length} comprovante(s) processado(s).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("password") ? "PDF protegido por senha." : msg);
      toast.error("Falha no processamento");
    } finally {
      setProcessing(false);
    }
  }, [file, removeAccents]);

  const downloadOne = useCallback((it: ProcessedItem) => {
    // Cria uma cópia do buffer para o Blob para evitar problemas de SharedArrayBuffer no lib.dom
    const copy = new Uint8Array(it.bytes.byteLength);
    copy.set(it.bytes);
    const blob = new Blob([copy.buffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = it.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, []);

  const downloadZip = useCallback(async () => {
    if (items.length === 0) return;
    const zip = new JSZip();
    for (const it of items) {
      const copy = new Uint8Array(it.bytes.byteLength);
      copy.set(it.bytes);
      zip.file(it.filename, copy);
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprovantes_separados_${stamp}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [items]);

  const startEdit = (idx: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              editing: true,
              draft: { tipo: it.tipo, data: it.data, beneficiario: it.beneficiario, valor: it.valor },
            }
          : it,
      ),
    );
  };

  const cancelEdit = (idx: number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, editing: false, draft: undefined } : it)));
  };

  const saveEdit = (idx: number) => {
    setItems((prev) => {
      const next = [...prev];
      const it = next[idx];
      if (!it || !it.draft) return prev;
      const merged: ProcessedItem = { ...it, ...it.draft, editing: false, draft: undefined };
      // Regenerate filename with uniqueness across the entire set
      const used = new Set<string>(next.filter((_, j) => j !== idx).map((x) => x.filename));
      merged.filename = uniqueFilename(buildFilename(merged, { removeAccents }), used);
      merged.status = "corrigido";
      next[idx] = merged;
      return next;
    });
    toast.success("Correção aplicada");
  };

  const reset = () => {
    setFile(null);
    setItems([]);
    setTotalPages(null);
    setProgressPage(0);
    setError(null);
    setPhase("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const stats = useMemo(() => {
    const total = items.length;
    const revisar = items.filter((i) => i.status === "revisar").length;
    const corrigido = items.filter((i) => i.status === "corrigido").length;
    const ok = total - revisar - corrigido;
    return { total, ok, revisar, corrigido };
  }, [items]);

  if (!canAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sem acesso</CardTitle>
            <CardDescription>Esta ferramenta é exclusiva da equipe Federal Invest.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const progressPct = totalPages && progressPage ? Math.round((progressPage / totalPages) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Scissors className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Separar comprovantes bancários</h1>
          <p className="text-sm text-muted-foreground">
            Envie um PDF com vários comprovantes. Cada página vira um arquivo individual, renomeado automaticamente com data, beneficiário e valor.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Arquivo</CardTitle>
          <CardDescription>Aceita apenas PDF. Processamento é feito no seu navegador — o arquivo não sai do dispositivo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!file ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                chooseFile(e.dataTransfer.files?.[0]);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.02]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Upload className="h-7 w-7" />
              </div>
              <div>
                <p className="text-base font-medium">Arraste um PDF para esta área</p>
                <p className="mt-1 text-sm text-muted-foreground">ou clique para selecionar</p>
              </div>
              <Button type="button" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
                <Upload className="mr-2 h-4 w-4" /> Selecionar arquivo
              </Button>
              <p className="text-xs text-muted-foreground">Somente PDF — até 60 MB</p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB{totalPages ? ` • ${totalPages} páginas` : ""}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={reset} disabled={processing} aria-label="Remover">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="rmacc" checked={removeAccents} onCheckedChange={setRemoveAccents} disabled={processing} />
              <Label htmlFor="rmacc" className="text-sm">Remover acentos dos nomes dos arquivos</Label>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={reset} disabled={processing || !file}>
                <RefreshCw className="mr-2 h-4 w-4" /> Novo arquivo
              </Button>
              <Button onClick={process} disabled={!file || processing}>
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scissors className="mr-2 h-4 w-4" />}
                Processar comprovantes
              </Button>
            </div>
          </div>

          {processing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{phase}</span>
                {totalPages ? <span>{progressPage} / {totalPages}</span> : null}
              </div>
              <Progress value={progressPct} />
            </div>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">2. Resultados</CardTitle>
              <CardDescription>
                {stats.total} páginas — {stats.ok} identificado(s), {stats.corrigido} corrigido(s), {stats.revisar} para revisar.
              </CardDescription>
            </div>
            <Button onClick={downloadZip}>
              <Package className="mr-2 h-4 w-4" /> Baixar todos em ZIP
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Pág.</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Beneficiário</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => {
                    const d = it.draft;
                    return (
                      <TableRow key={it.page} className={it.status === "revisar" ? "bg-amber-500/5" : undefined}>
                        <TableCell>{it.page}</TableCell>
                        <TableCell>
                          {it.editing ? (
                            <Select
                              value={d?.tipo}
                              onValueChange={(v) =>
                                setItems((prev) => prev.map((x, i) => (i === idx && x.draft ? { ...x, draft: { ...x.draft, tipo: v as ReceiptType } } : x)))
                              }
                            >
                              <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="boleto">Boleto</SelectItem>
                                <SelectItem value="transferir">Transferir/PIX</SelectItem>
                                <SelectItem value="ted">TED</SelectItem>
                                <SelectItem value="unknown">Não identificado</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <TypeBadge tipo={it.tipo} />
                          )}
                        </TableCell>
                        <TableCell>
                          {it.editing ? (
                            <Input
                              className="h-8 w-[110px]"
                              value={d?.data}
                              placeholder="DD.MM.AAAA"
                              onChange={(e) =>
                                setItems((prev) => prev.map((x, i) => (i === idx && x.draft ? { ...x, draft: { ...x.draft, data: e.target.value } } : x)))
                              }
                            />
                          ) : (
                            it.data
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          {it.editing ? (
                            <Input
                              className="h-8"
                              value={d?.beneficiario}
                              onChange={(e) =>
                                setItems((prev) => prev.map((x, i) => (i === idx && x.draft ? { ...x, draft: { ...x.draft, beneficiario: e.target.value.toUpperCase() } } : x)))
                              }
                            />
                          ) : (
                            <span className="break-words">{it.beneficiario}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {it.editing ? (
                            <Input
                              className="h-8 w-[110px]"
                              value={d?.valor}
                              onChange={(e) =>
                                setItems((prev) => prev.map((x, i) => (i === idx && x.draft ? { ...x, draft: { ...x.draft, valor: e.target.value } } : x)))
                              }
                            />
                          ) : (
                            it.valor
                          )}
                        </TableCell>
                        <TableCell className="max-w-[260px] break-words text-xs text-muted-foreground">{it.filename}</TableCell>
                        <TableCell>
                          <StatusBadge status={it.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {it.editing ? (
                              <>
                                <Button size="sm" variant="default" onClick={() => saveEdit(idx)}>
                                  <Save className="mr-1 h-3.5 w-3.5" /> Salvar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => cancelEdit(idx)}>
                                  Cancelar
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" onClick={() => startEdit(idx)}>
                                  Editar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => downloadOne(it)} aria-label="Baixar PDF">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TypeBadge({ tipo }: { tipo: ReceiptType }) {
  const map: Record<ReceiptType, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    boleto: { label: "Boleto", variant: "default" },
    transferir: { label: "Transferir/PIX", variant: "secondary" },
    ted: { label: "TED", variant: "secondary" },
    unknown: { label: "Não identificado", variant: "destructive" },
  };
  const it = map[tipo];
  return <Badge variant={it.variant}>{it.label}</Badge>;
}

function StatusBadge({ status }: { status: ProcessedItem["status"] }) {
  if (status === "ok") return <Badge variant="secondary">Identificado</Badge>;
  if (status === "corrigido") return <Badge>Corrigido manualmente</Badge>;
  return <Badge variant="destructive">Revisar</Badge>;
}