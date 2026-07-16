import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listEmpresas, upsertEmpresa, toggleEmpresaAtiva } from "@/lib/empresas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({ meta: [{ title: "Empresas — Federal Invest" }] }),
  component: EmpresasPage,
});

type Empresa = {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  responsavel: string | null;
  observacoes: string | null;
  ativo: boolean;
  matriz_id: string | null;
  created_at: string;
};

function EmpresasPage() {
  const auth = useAuth();
  const canWrite = auth.role === "admin" || auth.role === "gestor";
  const list = useServerFn(listEmpresas);
  const upsert = useServerFn(upsertEmpresa);
  const toggle = useServerFn(toggleEmpresaAtiva);
  const [rows, setRows] = useState<Empresa[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Empresa> | null>(null);

  const refresh = () => list().then((r) => setRows(r as Empresa[]));
  useEffect(() => {
    refresh();
  }, []);

  const matrizes = rows.filter((e) => !e.matriz_id);
  const matrizMap = new Map(rows.map((e) => [e.id, e.nome] as const));

  const save = async () => {
    if (!editing?.nome?.trim()) return toast.error("Nome é obrigatório");
    if (editing.id && editing.matriz_id === editing.id) return toast.error("Uma empresa não pode ser matriz de si mesma");
    try {
      await upsert({ data: { ...editing, nome: editing.nome } });
      toast.success("Empresa salva");
      setOpen(false);
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cadastro de empresas clientes.</p>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing({ ativo: true })}>
                <Plus className="h-4 w-4 mr-1" /> Nova empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing?.id ? "Editar empresa" : "Nova empresa"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Nome *</Label>
                  <Input value={editing?.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CNPJ</Label>
                    <Input value={editing?.cnpj ?? ""} onChange={(e) => setEditing({ ...editing, cnpj: e.target.value })} />
                  </div>
                  <div>
                    <Label>Responsável</Label>
                    <Input value={editing?.responsavel ?? ""} onChange={(e) => setEditing({ ...editing, responsavel: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>E-mail</Label>
                    <Input type="email" value={editing?.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input value={editing?.telefone ?? ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={editing?.observacoes ?? ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} />
                </div>
                <div>
                  <Label>Matriz (deixe vazio se for a própria matriz)</Label>
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={editing?.matriz_id ?? ""}
                    onChange={(e) => setEditing({ ...editing, matriz_id: e.target.value || null })}
                  >
                    <option value="">— nenhuma (é matriz) —</option>
                    {matrizes
                      .filter((m) => m.id !== editing?.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Vincule esta empresa a uma matriz para tratá-la como filial.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Nome</th>
              <th className="px-4 py-2 text-left">CNPJ</th>
              <th className="px-4 py-2 text-left">Matriz</th>
              <th className="px-4 py-2 text-left">Responsável</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{r.nome}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.cnpj ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {r.matriz_id ? (
                    <span className="inline-flex items-center gap-1"><Badge variant="outline" className="text-[10px]">Filial</Badge>{matrizMap.get(r.matriz_id) ?? "—"}</span>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Matriz</Badge>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{r.responsavel ?? "—"}</td>
                <td className="px-4 py-2">
                  <Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativa" : "Inativa"}</Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  {canWrite && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {auth.role === "admin" && (
                        <Button size="sm" variant="outline" onClick={async () => { await toggle({ data: { id: r.id, ativo: !r.ativo } }); refresh(); }}>
                          {r.ativo ? "Desativar" : "Ativar"}
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhuma empresa cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}