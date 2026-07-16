import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Copy, Download, RotateCw, ZoomIn, ZoomOut, CheckCircle2, XCircle,
  PenLine, History, AlertTriangle, FileText, ImageIcon, RefreshCw, Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getPaymentDocument, listExtractions, listIssues, listReviews, listChangeLog,
  updatePaymentDocument, insertReview, createSignedFileUrl,
} from "@/lib/financeiro/db";
import type {
  PaymentDocument, DocumentExtraction, DocumentValidationIssue,
  DocumentReview, DocumentChangeLog, DocumentClassification,
} from "@/lib/financeiro/types";
import { CLASSIFICATION_LABEL, REJECTION_REASONS } from "@/lib/financeiro/types";
import { approvalBlockers } from "@/lib/financeiro/upload";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financeiro/documentos/$id")({
  head: () => ({ meta: [{ title: "Conferência de documento — Central CNAB" }] }),
  component: ConferenciaPage,
});

function fmtCurrency(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseCurrency(s: string): number | null {
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function ConfidenceBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <Badge variant="outline" className="text-muted-foreground">—</Badge>;
  const pct = Math.round(score * 100);
  const cls =
    pct >= 90 ? "bg-emerald-600 text-white"
    : pct >= 70 ? "bg-amber-500 text-white"
    : "bg-destructive text-white";
  return <Badge className={cls}>{pct}%</Badge>;
}

function ConferenciaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const auth = useAuth();

  const [doc, setDoc] = useState<PaymentDocument | null>(null);
  const [extractions, setExtractions] = useState<DocumentExtraction[]>([]);
  const [issues, setIssues] = useState<DocumentValidationIssue[]>([]);
  const [reviews, setReviews] = useState<DocumentReview[]>([]);
  const [changes, setChanges] = useState<DocumentChangeLog[]>([]);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<PaymentDocument>>({});
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectAction, setRejectAction] = useState<"reprovado" | "correcao_solicitada">("reprovado");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    const [d, ex, iss, rv, cg] = await Promise.all([
      getPaymentDocument(id), listExtractions(id), listIssues(id),
      listReviews(id), listChangeLog(id),
    ]);
    setDoc(d); setExtractions(ex); setIssues(iss); setReviews(rv); setChanges(cg);
    setForm(d ?? {});
    if (d?.arquivo_url) {
      const url = await createSignedFileUrl(d.arquivo_url);
      setSignedUrl(url);
    }
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [id]);

  const confByField = useMemo(() => {
    const map: Record<string, DocumentExtraction> = {};
    for (const e of extractions) map[e.field_name] = e;
    return map;
  }, [extractions]);

  const isImage = doc?.arquivo_nome && /\.(png|jpe?g)$/i.test(doc.arquivo_nome);
  const isPdf = doc?.arquivo_nome && /\.pdf$/i.test(doc.arquivo_nome);

  const canReview = auth.isFederal;
  const blockers = doc ? approvalBlockers({ ...doc, ...form } as PaymentDocument) : [];
  const canApprove = canReview && blockers.length === 0 && (doc?.status_conferencia !== "aprovado");

  async function saveEdits(reason?: string | null) {
    if (!doc) return;
    const patch: Partial<PaymentDocument> = { ...form };
    // recalc valor_calculado
    const vn = patch.valor_nominal ?? doc.valor_nominal ?? 0;
    const desc = patch.desconto ?? doc.desconto ?? 0;
    const abat = patch.abatimento ?? doc.abatimento ?? 0;
    const juros = patch.juros ?? doc.juros ?? 0;
    const multa = patch.multa ?? doc.multa ?? 0;
    patch.valor_calculado = Math.round(((vn ?? 0) - desc - abat + juros + multa) * 100) / 100;
    const res = await updatePaymentDocument(doc.id, patch, reason ?? null);
    if (!res.ok) { toast.error(res.error ?? "Erro ao salvar"); return; }
    toast.success("Alterações salvas");
    setEditing(false);
    await refresh();
  }

  async function approve() {
    if (!doc || !canApprove) return;
    const uid = auth.user?.id ?? null;
    const res = await updatePaymentDocument(doc.id, {
      status_conferencia: "aprovado",
      status_cnab: "pronto_para_lote",
      reviewed_at: new Date().toISOString(),
      reviewed_by: uid,
      motivo_reprovacao: null,
    } as Partial<PaymentDocument>, "aprovacao");
    if (!res.ok) { toast.error(res.error ?? "Erro"); return; }
    await insertReview({ payment_document_id: doc.id, review_status: "aprovado" });
    toast.success("Documento aprovado — pronto para lote CNAB");
    await refresh();
  }

  async function submitReject() {
    if (!doc) return;
    if (!rejectReason) { toast.error("Selecione um motivo"); return; }
    if (rejectReason === "outro" && !rejectNotes.trim()) { toast.error("Descreva a justificativa"); return; }
    const res = await updatePaymentDocument(doc.id, {
      status_conferencia: rejectAction,
      status_cnab: "nao_elegivel",
      motivo_reprovacao: rejectReason,
      review_notes: rejectNotes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user?.id ?? null,
    } as Partial<PaymentDocument>, rejectAction);
    if (!res.ok) { toast.error(res.error ?? "Erro"); return; }
    await insertReview({
      payment_document_id: doc.id,
      review_status: rejectAction,
      rejection_reason: rejectReason,
      review_notes: rejectNotes || null,
    });
    toast.success(rejectAction === "reprovado" ? "Documento reprovado" : "Correção solicitada");
    setRejectOpen(false); setRejectReason(""); setRejectNotes("");
    await refresh();
  }

  async function reopen() {
    if (!doc) return;
    const reason = window.prompt("Justificativa para reabrir o documento aprovado:");
    if (!reason) return;
    const res = await updatePaymentDocument(doc.id, {
      status_conferencia: "em_conferencia",
      status_cnab: "nao_elegivel",
      reviewed_at: null,
      reviewed_by: null,
    } as Partial<PaymentDocument>, `reabertura: ${reason}`);
    if (!res.ok) { toast.error(res.error ?? "Erro"); return; }
    await insertReview({ payment_document_id: doc.id, review_status: "reaberto", review_notes: reason });
    toast.success("Documento reaberto");
    await refresh();
  }

  function copyBarcode() {
    const v = form.codigo_barras ?? doc?.codigo_barras;
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success("Código de barras copiado");
  }

  if (loading && !doc) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!doc) return <div className="p-8 text-sm text-muted-foreground">Documento não encontrado.</div>;

  const fieldExtract = (name: string) => confByField[name];
  function renderField(
    label: string, name: keyof PaymentDocument,
    input: React.ReactNode,
  ) {
    const ex = fieldExtract(String(name));
    return (
      <div className="grid gap-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{label}</Label>
          <div className="flex items-center gap-2">
            {ex?.source_page ? <span className="text-[10px] text-muted-foreground">p.{ex.source_page}</span> : null}
            <ConfidenceBadge score={ex?.confidence_score ?? null} />
          </div>
        </div>
        {input}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/financeiro/documentos"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold">{doc.arquivo_nome ?? "Documento"}</h1>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="outline">{doc.status_extracao}</Badge>
            <Badge variant={doc.status_conferencia === "aprovado" ? "default" : "secondary"}>{doc.status_conferencia}</Badge>
            <Badge variant={doc.status_cnab === "pronto_para_lote" ? "default" : "outline"}>{doc.status_cnab}</Badge>
            {doc.classificacao_sugerida && (
              <Badge variant="outline">
                {CLASSIFICATION_LABEL[doc.classificacao_sugerida as DocumentClassification] ?? doc.classificacao_sugerida}
              </Badge>
            )}
            {doc.is_demo && <Badge variant="outline">demo</Badge>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="mr-1 h-4 w-4" /> Atualizar</Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Lado esquerdo — Viewer */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
            <CardTitle className="text-sm">Documento original</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
              <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
              {isImage && (
                <Button variant="outline" size="icon" onClick={() => setRotation((r) => (r + 90) % 360)}><RotateCw className="h-4 w-4" /></Button>
              )}
              {signedUrl && (
                <Button asChild variant="outline" size="icon">
                  <a href={signedUrl} target="_blank" rel="noreferrer" download><Download className="h-4 w-4" /></a>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[80vh] overflow-auto bg-muted/30">
              {!signedUrl && (
                <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
                  {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  Prévia indisponível (arquivo original não anexado)
                </div>
              )}
              {signedUrl && isImage && (
                <img
                  src={signedUrl}
                  alt={doc.arquivo_nome ?? "documento"}
                  style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: "top left" }}
                  className="block max-w-none"
                />
              )}
              {signedUrl && isPdf && (
                <iframe
                  title="documento"
                  src={signedUrl}
                  className="block h-[80vh] w-full border-0"
                  style={{ zoom }}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lado direito — Formulário + validações */}
        <div className="space-y-4">
          {issues.length > 0 && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Validações</CardTitle></CardHeader>
              <CardContent className="space-y-1 py-0 pb-3">
                {issues.map((i) => (
                  <div key={i.id} className="flex items-start gap-2 text-xs">
                    <Badge className={cn(
                      i.severity === "critical" ? "bg-destructive text-white" :
                      i.severity === "warning" ? "bg-amber-500 text-white" : "bg-muted text-foreground",
                      "shrink-0",
                    )}>{i.severity}</Badge>
                    <span>{i.message}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
              <CardTitle className="text-sm">Dados do documento</CardTitle>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={copyBarcode}><Copy className="mr-1 h-3 w-3" /> Código</Button>
                <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}><History className="mr-1 h-3 w-3" /> Histórico</Button>
                {!editing ? (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}><PenLine className="mr-1 h-3 w-3" /> Editar</Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setForm(doc); setEditing(false); }}>Cancelar</Button>
                    <Button size="sm" onClick={() => saveEdits("edicao_manual")}><Save className="mr-1 h-3 w-3" /> Salvar</Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="gerais">
                <TabsList>
                  <TabsTrigger value="gerais">Gerais</TabsTrigger>
                  <TabsTrigger value="beneficiario">Beneficiário</TabsTrigger>
                  <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
                </TabsList>

                <TabsContent value="gerais" className="mt-3 grid gap-3 sm:grid-cols-2">
                  {renderField("Tipo do documento", "tipo",
                    <Select value={form.tipo ?? doc.tipo} disabled={!editing}
                      onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as PaymentDocument["tipo"] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["boleto","tributo","concessionaria","gps","outros"] as const).map((t) =>
                          <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>)}
                  {renderField("Classificação confirmada", "classificacao_confirmada",
                    <Select value={(form.classificacao_confirmada as string) ?? (doc.classificacao_sugerida as string) ?? ""} disabled={!editing}
                      onValueChange={(v) => setForm((f) => ({ ...f, classificacao_confirmada: v }))}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CLASSIFICATION_LABEL).map(([v, l]) =>
                          <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>)}
                  {renderField("Nome do arquivo", "arquivo_nome",
                    <Input value={form.arquivo_nome ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, arquivo_nome: e.target.value }))} />)}
                  {renderField("Nº interno", "numero_interno",
                    <Input value={form.numero_interno ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, numero_interno: e.target.value }))} />)}
                  {renderField("Categoria", "categoria",
                    <Input value={form.categoria ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} />)}
                  {renderField("Centro de custo", "centro_custo",
                    <Input value={form.centro_custo ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, centro_custo: e.target.value }))} />)}
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Observações</Label>
                    <Textarea rows={2} value={form.observacao ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} />
                  </div>
                </TabsContent>

                <TabsContent value="beneficiario" className="mt-3 grid gap-3 sm:grid-cols-2">
                  {renderField("Nome / razão social", "beneficiario_nome",
                    <Input value={form.beneficiario_nome ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, beneficiario_nome: e.target.value }))} />)}
                  {renderField("CPF / CNPJ", "beneficiario_documento",
                    <Input value={form.beneficiario_documento ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, beneficiario_documento: e.target.value.replace(/\D/g, "") }))} />)}
                  {renderField("Tipo de pessoa", "beneficiario_tipo_pessoa",
                    <Select value={form.beneficiario_tipo_pessoa ?? ""} disabled={!editing}
                      onValueChange={(v) => setForm((f) => ({ ...f, beneficiario_tipo_pessoa: v }))}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                      </SelectContent>
                    </Select>)}
                  {renderField("Banco emissor", "banco_emissor",
                    <Input value={form.banco_emissor ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, banco_emissor: e.target.value }))} />)}
                </TabsContent>

                <TabsContent value="pagamento" className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    {renderField("Código de barras", "codigo_barras",
                      <div className="flex gap-1">
                        <Input value={form.codigo_barras ?? ""} disabled={!editing}
                          onChange={(e) => setForm((f) => ({ ...f, codigo_barras: e.target.value.replace(/\D/g, "") }))} />
                        <Button size="icon" variant="outline" onClick={copyBarcode} type="button"><Copy className="h-4 w-4" /></Button>
                      </div>)}
                  </div>
                  <div className="sm:col-span-2">
                    {renderField("Linha digitável", "linha_digitavel",
                      <Input value={form.linha_digitavel ?? ""} disabled={!editing}
                        onChange={(e) => setForm((f) => ({ ...f, linha_digitavel: e.target.value.replace(/\D/g, "") }))} />)}
                  </div>
                  {renderField("Vencimento", "vencimento",
                    <Input type="date" value={form.vencimento ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value || null }))} />)}
                  {renderField("Data programada", "data_programada",
                    <Input type="date" value={form.data_programada ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, data_programada: e.target.value || null }))} />)}
                  {renderField("Valor nominal (R$)", "valor_nominal",
                    <Input value={fmtCurrency(form.valor_nominal ?? doc.valor_nominal)} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, valor_nominal: parseCurrency(e.target.value) }))} />)}
                  {renderField("Desconto", "desconto",
                    <Input value={fmtCurrency(form.desconto ?? doc.desconto)} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, desconto: parseCurrency(e.target.value) ?? 0 }))} />)}
                  {renderField("Abatimento", "abatimento",
                    <Input value={fmtCurrency(form.abatimento ?? doc.abatimento)} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, abatimento: parseCurrency(e.target.value) ?? 0 }))} />)}
                  {renderField("Juros", "juros",
                    <Input value={fmtCurrency(form.juros ?? doc.juros)} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, juros: parseCurrency(e.target.value) ?? 0 }))} />)}
                  {renderField("Multa", "multa",
                    <Input value={fmtCurrency(form.multa ?? doc.multa)} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, multa: parseCurrency(e.target.value) ?? 0 }))} />)}
                  {renderField("Valor final", "valor_final",
                    <Input value={fmtCurrency(form.valor_final ?? doc.valor_final)} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, valor_final: parseCurrency(e.target.value) }))} />)}
                  {renderField("Nosso número", "nosso_numero",
                    <Input value={form.nosso_numero ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, nosso_numero: e.target.value }))} />)}
                  {renderField("Número do documento", "numero_documento",
                    <Input value={form.numero_documento ?? ""} disabled={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, numero_documento: e.target.value }))} />)}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Ações de revisão */}
          {canReview && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="text-xs text-muted-foreground">
                  {blockers.length === 0
                    ? "Todas as condições para aprovação estão atendidas."
                    : (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {blockers.map((b) => <li key={b}>{b}</li>)}
                      </ul>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {doc.status_conferencia === "aprovado" ? (
                    <Button variant="outline" onClick={reopen}>Reabrir documento</Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => { setRejectAction("correcao_solicitada"); setRejectOpen(true); }}>
                        Solicitar correção
                      </Button>
                      <Button variant="outline" className="text-destructive" onClick={() => { setRejectAction("reprovado"); setRejectOpen(true); }}>
                        <XCircle className="mr-1 h-4 w-4" /> Reprovar
                      </Button>
                      <Button disabled={!canApprove} onClick={approve}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Aprovar
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Diálogo Reprovar / Solicitar correção */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rejectAction === "reprovado" ? "Reprovar documento" : "Solicitar correção"}</DialogTitle>
            <DialogDescription>Informe o motivo. A ação será registrada no histórico.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo</Label>
              <Select value={rejectReason} onValueChange={setRejectReason}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {REJECTION_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Justificativa {rejectReason === "outro" && "*"}</Label>
              <Textarea rows={3} value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)}
                placeholder={rejectReason === "outro" ? "Descreva o motivo (obrigatório)" : "Opcional"} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button onClick={submitReject}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Histórico do documento</DialogTitle></DialogHeader>
          <Tabs defaultValue="reviews">
            <TabsList>
              <TabsTrigger value="reviews">Revisões ({reviews.length})</TabsTrigger>
              <TabsTrigger value="changes">Alterações ({changes.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="reviews" className="max-h-[60vh] space-y-2 overflow-auto pt-3">
              {reviews.length === 0 && <p className="text-sm text-muted-foreground">Sem revisões.</p>}
              {reviews.map((r) => (
                <div key={r.id} className="rounded-md border border-border p-2 text-xs">
                  <div className="flex justify-between"><b>{r.review_status}</b><span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span></div>
                  {r.rejection_reason && <div>Motivo: {r.rejection_reason}</div>}
                  {r.review_notes && <div className="text-muted-foreground">{r.review_notes}</div>}
                </div>
              ))}
            </TabsContent>
            <TabsContent value="changes" className="max-h-[60vh] space-y-2 overflow-auto pt-3">
              {changes.length === 0 && <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>}
              {changes.map((c) => (
                <div key={c.id} className="rounded-md border border-border p-2 text-xs">
                  <div className="flex justify-between"><b>{c.field_name ?? "—"}</b><span className="text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span></div>
                  <div className="text-muted-foreground">de: <span className="font-mono">{c.old_value ?? "∅"}</span> → <span className="font-mono">{c.new_value ?? "∅"}</span></div>
                  {c.change_reason && <div className="text-muted-foreground italic">{c.change_reason}</div>}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}