import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CloudUpload, FileText, ImageIcon, Loader2, X, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndExtract } from "@/lib/financeiro/upload";
import type { UploadResult } from "@/lib/financeiro/upload";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financeiro/documentos/upload")({
  head: () => ({ meta: [{ title: "Upload de documentos — Central CNAB" }] }),
  component: UploadPage,
});

type Empresa = { id: string; nome: string };
type FileItem = {
  id: string;
  file: File;
  status: "pendente" | "enviando" | "ok" | "erro";
  result?: UploadResult;
};

const ACCEPT = "application/pdf,image/png,image/jpeg,image/jpg";
const MAX = 15 * 1024 * 1024;

function UploadPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [categoria, setCategoria] = useState("");
  const [observacao, setObservacao] = useState("");
  const [items, setItems] = useState<FileItem[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    supabase
      .from("empresas")
      .select("id,nome")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setEmpresas((data ?? []) as Empresa[]));
  }, []);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => {
      const okType = /\.(pdf|png|jpe?g)$/i.test(f.name) || ACCEPT.includes(f.type);
      return okType && f.size <= MAX;
    });
    setItems((prev) => [
      ...prev,
      ...arr.map((f) => ({ id: crypto.randomUUID(), file: f, status: "pendente" as const })),
    ]);
  }

  async function submit() {
    if (!empresaId) return;
    for (const it of items) {
      if (it.status !== "pendente") continue;
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: "enviando" } : x)));
      const res = await uploadAndExtract({
        file: it.file,
        empresa_id: empresaId,
        categoria: categoria || null,
        observacao: observacao || null,
        responsavel_id: auth.user?.id ?? null,
      });
      setItems((prev) =>
        prev.map((x) =>
          x.id === it.id ? { ...x, status: res.ok ? "ok" : "erro", result: res } : x,
        ),
      );
    }
  }

  const canSubmit = empresaId && items.some((x) => x.status === "pendente");
  const anyProcessed = items.some((x) => x.status === "ok");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/financeiro/documentos"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CloudUpload className="h-6 w-6 text-primary" /> Upload de documentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Envie PDF, PNG, JPG ou JPEG (individual ou em lote). Cada arquivo vira um registro em conferência.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Dados do envio</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <Label>Empresa pagadora *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Fornecedores" />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={auth.profile?.nome ?? auth.user?.email ?? "—"} readOnly disabled />
          </div>
          <div className="md:col-span-3">
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Notas opcionais para todos os documentos deste envio" />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">2. Arquivos</CardTitle></CardHeader>
        <CardContent>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors sm:p-10",
              dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CloudUpload className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-medium">Arraste os arquivos aqui</p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar (PDF, PNG, JPG, JPEG — até 15MB cada)</p>
            </div>
            <input type="file" accept={ACCEPT} multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </label>

          {items.length > 0 && (
            <div className="mt-4 divide-y divide-border rounded-lg border border-border">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {it.file.type.includes("pdf") ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.file.name}</p>
                    <p className="text-xs text-muted-foreground">{(it.file.size / 1024).toFixed(0)} KB</p>
                    {it.status === "ok" && it.result?.duplicates?.length ? (
                      <p className="mt-1 text-xs text-amber-600">
                        <AlertTriangle className="mr-1 inline h-3 w-3" /> {it.result.duplicates.length} possível duplicidade
                      </p>
                    ) : null}
                    {it.status === "erro" && (
                      <p className="mt-1 text-xs text-destructive">{it.result?.error ?? "Erro no envio."}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {it.status === "pendente" && (
                      <Badge variant="outline">aguardando</Badge>
                    )}
                    {it.status === "enviando" && (
                      <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> processando</Badge>
                    )}
                    {it.status === "ok" && it.result?.document_id && (
                      <>
                        <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="mr-1 h-3 w-3" /> extraído</Badge>
                        <Button size="sm" variant="outline" onClick={() => navigate({ to: "/financeiro/documentos/$id", params: { id: it.result!.document_id! } })}>
                          Conferir
                        </Button>
                      </>
                    )}
                    {it.status === "erro" && <Badge variant="destructive">erro</Badge>}
                    {it.status === "pendente" && (
                      <Button size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              A extração usa o pipeline real (pdf.js + ZXing + IA). Nenhuma aprovação é automática.
            </p>
            <div className="flex gap-2">
              {anyProcessed && (
                <Button asChild variant="outline"><Link to="/financeiro/documentos">Ver documentos</Link></Button>
              )}
              <Button onClick={submit} disabled={!canSubmit}>Processar {items.filter(x => x.status === "pendente").length} arquivo(s)</Button>
            </div>
          </div>
          {!empresaId && items.length > 0 && (
            <p className="mt-2 text-xs text-destructive">Selecione a empresa pagadora antes de processar.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}