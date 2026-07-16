import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote, Plus, Upload, RotateCcw, Settings2, Filter, MoreHorizontal,
  Eye, CheckCircle2, XCircle, Pencil, ListPlus, History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listBankAccounts, listCnabBatches, listPaymentDocuments, createCnabBatch,
} from "@/lib/financeiro/db";
import type {
  BankAccount, CnabBatch, PaymentDocument, PaymentDocTipo,
} from "@/lib/financeiro/types";
import { BATCH_STATUS_LABEL, DOC_TIPO_LABEL } from "@/lib/financeiro/types";

export const Route = createFileRoute("/_authenticated/financeiro/cnab")({
  head: () => ({ meta: [{ title: "Central de Pagamentos CNAB — Federal Invest" }] }),
  component: CentralCnab,
});

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CentralCnab() {
  const [docs, setDocs] = useState<PaymentDocument[]>([]);
  const [batches, setBatches] = useState<CnabBatch[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);

  // Documentos filters
  const [fTipo, setFTipo] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fBeneficiario, setFBeneficiario] = useState("");
  const [fErro, setFErro] = useState(false);
  const [fJaEmLote, setFJaEmLote] = useState<"all" | "sim" | "nao">("all");

  async function refreshAll() {
    setLoading(true);
    const [d, b, ba] = await Promise.all([
      listPaymentDocuments(),
      listCnabBatches(),
      listBankAccounts(),
    ]);
    setDocs(d); setBatches(b); setBanks(ba);
    setLoading(false);
  }
  useEffect(() => { void refreshAll(); }, []);

  const indicators = useMemo(() => {
    const aguardandoConf = docs.filter((d) => d.status_conferencia === "pendente").length;
    const prontos = docs.filter((d) => d.status_conferencia === "aprovado" && d.status_cnab === "nao_incluido").length;
    const lotesElab = batches.filter((b) => b.status === "rascunho" || b.status === "em_conferencia").length;
    const arquivosGerados = batches.filter((b) => b.status === "arquivo_gerado" || b.status === "enviado_banco").length;
    const erros = docs.filter((d) => d.status_extracao === "erro" || d.status_conferencia === "reprovado").length;
    const valorAguardando = docs
      .filter((d) => d.status_cnab === "nao_incluido")
      .reduce((s, d) => s + Number(d.valor_final ?? d.valor_nominal ?? 0), 0);
    return { aguardandoConf, prontos, lotesElab, arquivosGerados, erros, valorAguardando };
  }, [docs, batches]);

  const docsFiltrados = useMemo(() => {
    return docs.filter((d) => {
      if (fTipo !== "all" && d.tipo !== fTipo) return false;
      if (fStatus !== "all" && d.status_conferencia !== fStatus) return false;
      if (fBeneficiario && !(d.beneficiario_nome ?? "").toLowerCase().includes(fBeneficiario.toLowerCase())) return false;
      if (fErro && !(d.status_extracao === "erro" || d.status_conferencia === "reprovado")) return false;
      if (fJaEmLote === "sim" && d.status_cnab === "nao_incluido") return false;
      if (fJaEmLote === "nao" && d.status_cnab !== "nao_incluido") return false;
      return true;
    });
  }, [docs, fTipo, fStatus, fBeneficiario, fErro, fJaEmLote]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Banknote className="h-6 w-6 text-primary" /> Central de Pagamentos CNAB
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize, valide e gere arquivos CNAB 240 para pagamentos bancários.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="mr-1 h-4 w-4" /> Novo lote CNAB
          </Button>
          <Button variant="outline">
            <Upload className="mr-1 h-4 w-4" /> Importar documentos
          </Button>
          <Button variant="outline">
            <RotateCcw className="mr-1 h-4 w-4" /> Importar retorno
          </Button>
          <Button variant="outline">
            <Settings2 className="mr-1 h-4 w-4" /> Configurações bancárias
          </Button>
        </div>
      </header>

      {/* Indicadores */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <IndicatorCard label="Aguardando conferência" value={indicators.aguardandoConf} />
        <IndicatorCard label="Prontos para lote" value={indicators.prontos} accent="text-emerald-600" />
        <IndicatorCard label="Lotes em elaboração" value={indicators.lotesElab} />
        <IndicatorCard label="Arquivos gerados" value={indicators.arquivosGerados} />
        <IndicatorCard label="Pagamentos com erro" value={indicators.erros} accent="text-destructive" />
        <IndicatorCard label="Valor aguardando pagamento" value={formatCurrency(indicators.valorAguardando)} />
      </div>

      <Tabs defaultValue="documentos" className="mt-6">
        <TabsList>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="lotes">Lotes CNAB</TabsTrigger>
          <TabsTrigger value="validacao">Validação</TabsTrigger>
          <TabsTrigger value="arquivos">Arquivos gerados</TabsTrigger>
          <TabsTrigger value="retornos">Retornos bancários</TabsTrigger>
        </TabsList>

        <TabsContent value="documentos">
          <Card>
            <CardContent className="p-4">
              {/* Filtros */}
              <div className="grid gap-3 md:grid-cols-6">
                <Select value={fTipo} onValueChange={setFTipo}>
                  <SelectTrigger><SelectValue placeholder="Tipo de pagamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {(Object.keys(DOC_TIPO_LABEL) as PaymentDocTipo[]).map((t) => (
                      <SelectItem key={t} value={t}>{DOC_TIPO_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger><SelectValue placeholder="Status conferência" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="conferido">Conferido</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="reprovado">Reprovado</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Beneficiário" value={fBeneficiario} onChange={(e) => setFBeneficiario(e.target.value)} />
                <Select value={fJaEmLote} onValueChange={(v) => setFJaEmLote(v as never)}>
                  <SelectTrigger><SelectValue placeholder="Em lote?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="nao">Ainda não incluídos</SelectItem>
                    <SelectItem value="sim">Já incluídos em lote</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 rounded-md border border-border px-3 text-sm">
                  <Checkbox checked={fErro} onCheckedChange={(v) => setFErro(Boolean(v))} />
                  Somente com erro
                </label>
                <Button variant="outline" size="sm" onClick={() => {
                  setFTipo("all"); setFStatus("all"); setFBeneficiario(""); setFErro(false); setFJaEmLote("all");
                }}>
                  <Filter className="mr-1 h-4 w-4" /> Limpar
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Beneficiário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Leitura</TableHead>
                      <TableHead>Conferência</TableHead>
                      <TableHead>CNAB</TableHead>
                      <TableHead className="w-[60px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && (
                      <TableRow><TableCell colSpan={9} className="text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
                    )}
                    {!loading && docsFiltrados.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-sm text-muted-foreground">Nenhum documento com estes filtros.</TableCell></TableRow>
                    )}
                    {docsFiltrados.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <div className="font-medium">{d.arquivo_nome ?? d.descricao ?? "Documento"}</div>
                          {d.is_demo && <Badge variant="outline" className="mt-1">demo</Badge>}
                        </TableCell>
                        <TableCell>
                          <div>{d.beneficiario_nome ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{d.beneficiario_documento ?? ""}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{DOC_TIPO_LABEL[d.tipo]}</Badge></TableCell>
                        <TableCell>{d.vencimento ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(d.valor_final ?? d.valor_nominal)}</TableCell>
                        <TableCell><Badge variant="secondary">{d.status_extracao}</Badge></TableCell>
                        <TableCell><Badge variant="secondary">{d.status_conferencia}</Badge></TableCell>
                        <TableCell><Badge variant={d.status_cnab === "nao_incluido" ? "outline" : "default"}>{d.status_cnab}</Badge></TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> Visualizar</DropdownMenuItem>
                              <DropdownMenuItem><CheckCircle2 className="mr-2 h-4 w-4" /> Conferir</DropdownMenuItem>
                              <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                              <DropdownMenuItem><CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar</DropdownMenuItem>
                              <DropdownMenuItem><XCircle className="mr-2 h-4 w-4" /> Reprovar</DropdownMenuItem>
                              <DropdownMenuItem><ListPlus className="mr-2 h-4 w-4" /> Incluir em lote</DropdownMenuItem>
                              <DropdownMenuItem><History className="mr-2 h-4 w-4" /> Ver histórico</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lotes">
          <Card>
            <CardContent className="p-4">
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do lote</TableHead>
                      <TableHead>Ambiente</TableHead>
                      <TableHead>Data pagamento</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-sm text-muted-foreground">Nenhum lote criado.</TableCell></TableRow>
                    )}
                    {batches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-medium">{b.nome_interno}</div>
                          {b.is_demo && <Badge variant="outline" className="mt-1">demo</Badge>}
                        </TableCell>
                        <TableCell><Badge variant="outline">{b.ambiente}</Badge></TableCell>
                        <TableCell>{b.data_pagamento ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.quantidade_itens}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(b.valor_total)}</TableCell>
                        <TableCell><Badge>{BATCH_STATUS_LABEL[b.status]}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validacao">
          <EmptyTabState title="Validação em lote" description="A validação estrutural CNAB 240 será implementada na próxima etapa. Aqui aparecerão os lotes prontos para conferência com apontamentos de inconsistências." />
        </TabsContent>
        <TabsContent value="arquivos">
          <EmptyTabState title="Arquivos gerados" description="Nenhuma remessa foi gerada ainda. A geração real do CNAB será implementada em fase posterior." />
        </TabsContent>
        <TabsContent value="retornos">
          <EmptyTabState title="Retornos bancários" description="A leitura de arquivos RET ainda não está disponível. Esta aba consolidará as respostas do banco por lote e por documento." />
        </TabsContent>
      </Tabs>

      <NovoLoteDialog
        open={openNew}
        onOpenChange={setOpenNew}
        banks={banks}
        documentos={docs.filter((d) => d.status_conferencia === "aprovado" && d.status_cnab === "nao_incluido")}
        onCreated={() => { setOpenNew(false); void refreshAll(); }}
      />
    </div>
  );
}

function IndicatorCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyTabState({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-2 p-6">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function NovoLoteDialog({
  open, onOpenChange, banks, documentos, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  banks: BankAccount[];
  documentos: PaymentDocument[];
  onCreated: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [nome, setNome] = useState("");
  const [bankId, setBankId] = useState<string>("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [dataPag, setDataPag] = useState("");
  const [ambiente, setAmbiente] = useState<"homologacao" | "producao">("homologacao");
  const [obs, setObs] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setStep(1); setNome(""); setBankId(""); setEmpresaId(null); setDataPag(""); setAmbiente("homologacao"); setObs(""); setSelecionados(new Set()); }
  }, [open]);

  useEffect(() => {
    if (bankId) {
      const b = banks.find((x) => x.id === bankId);
      setEmpresaId(b?.empresa_id ?? null);
    }
  }, [bankId, banks]);

  const toggle = (id: string) => {
    const next = new Set(selecionados);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelecionados(next);
  };

  const totalSelecionado = useMemo(() => {
    return documentos
      .filter((d) => selecionados.has(d.id))
      .reduce((s, d) => s + Number(d.valor_final ?? d.valor_nominal ?? 0), 0);
  }, [documentos, selecionados]);

  const bank = banks.find((b) => b.id === bankId);

  async function handleCreate() {
    setSaving(true);
    const res = await createCnabBatch({
      nome_interno: nome,
      empresa_id: empresaId,
      bank_account_id: bankId || null,
      data_pagamento: dataPag || null,
      ambiente,
      observacao: obs || null,
      documento_ids: Array.from(selecionados),
    });
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Erro ao criar lote"); return; }
    toast.success("Lote criado com sucesso");
    onCreated();
  }

  const canNext1 = nome.trim().length > 0 && bankId && dataPag;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo lote CNAB — Etapa {step} de 3</DialogTitle>
          <DialogDescription>
            {step === 1 && "Dados do lote"}
            {step === 2 && "Seleção de documentos aprovados"}
            {step === 3 && "Confira o resumo antes de criar o lote"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Nome interno do lote</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Fornecedores Semana 45" />
            </div>
            <div className="md:col-span-2">
              <Label>Conta bancária</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.banco_nome} · Ag {b.agencia} · Conta {b.conta}{b.conta_dv ? `-${b.conta_dv}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data programada de pagamento</Label>
              <Input type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} />
            </div>
            <div>
              <Label>Ambiente</Label>
              <Select value={ambiente} onValueChange={(v) => setAmbiente(v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Observação</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione os documentos <span className="font-medium">aprovados</span> e ainda não incluídos em outro lote.
            </p>
            <div className="max-h-[380px] overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Beneficiário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentos.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">Nenhum documento aprovado disponível.</TableCell></TableRow>
                  )}
                  {documentos.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Checkbox checked={selecionados.has(d.id)} onCheckedChange={() => toggle(d.id)} />
                      </TableCell>
                      <TableCell>{d.beneficiario_nome ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{DOC_TIPO_LABEL[d.tipo]}</Badge></TableCell>
                      <TableCell>{d.vencimento ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(d.valor_final ?? d.valor_nominal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span>{selecionados.size} documento(s) selecionado(s)</span>
              <span className="font-medium tabular-nums">Total: {formatCurrency(totalSelecionado)}</span>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <ResumoRow label="Nome" value={nome || "—"} />
            <ResumoRow label="Ambiente" value={ambiente} />
            <ResumoRow label="Conta" value={bank ? `${bank.banco_nome} · Ag ${bank.agencia} · ${bank.conta}` : "—"} />
            <ResumoRow label="Data de pagamento" value={dataPag || "—"} />
            <ResumoRow label="Quantidade de documentos" value={String(selecionados.size)} />
            <ResumoRow label="Valor total" value={formatCurrency(totalSelecionado)} />
            {obs && <ResumoRow label="Observação" value={obs} full />}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <div className="flex gap-2">
            {step > 1 && <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>Voltar</Button>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {step < 3 && (
              <Button
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                disabled={(step === 1 && !canNext1) || (step === 2 && selecionados.size === 0)}
              >Próximo</Button>
            )}
            {step === 3 && (
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? "Criando…" : "Criar lote"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResumoRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`rounded-md border border-border p-3 ${full ? "md:col-span-2" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}