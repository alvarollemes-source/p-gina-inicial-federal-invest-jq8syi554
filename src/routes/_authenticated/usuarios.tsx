import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllUsersAsAdmin,
  createUserAsAdmin,
  updateUserPasswordAsAdmin,
  setUserRoleAsAdmin,
  deleteUserAsAdmin,
  updateUserAsAdmin,
} from "@/lib/admin.functions";
import { listEmpresas } from "@/lib/empresas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Key, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ROLE_LABELS, type AppRole } from "@/lib/rbac/roles";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Federal Invest" }] }),
  component: UsuariosPage,
});

type UserRow = { id: string; email: string | null; nome: string | null; empresa_id: string | null; ativo: boolean; role: AppRole | null };
type Empresa = { id: string; nome: string; matriz_id: string | null };

function UsuariosPage() {
  const auth = useAuth();
  const list = useServerFn(listAllUsersAsAdmin);
  const create = useServerFn(createUserAsAdmin);
  const setPw = useServerFn(updateUserPasswordAsAdmin);
  const setRole = useServerFn(setUserRoleAsAdmin);
  const updateUser = useServerFn(updateUserAsAdmin);
  const del = useServerFn(deleteUserAsAdmin);
  const listE = useServerFn(listEmpresas);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", password: "", role: "operador" as AppRole, empresa_id: "" });
  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [newPw, setNewPw] = useState("");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", role: "operador" as AppRole, empresa_id: "" });

  const refresh = () => list().then((r) => setRows(r as UserRow[]));
  useEffect(() => {
    if (auth.role !== "admin") return;
    refresh();
    listE().then((r) => setEmpresas(r as Empresa[]));
  }, [auth.role]);

  if (auth.role !== "admin") return <div className="p-8 text-sm text-muted-foreground">Acesso restrito.</div>;

  const empresaLabel = (id: string | null) => {
    if (!id) return "—";
    const e = empresas.find((x) => x.id === id);
    if (!e) return "—";
    return e.matriz_id ? `↳ ${e.nome} (filial)` : `${e.nome} (matriz)`;
  };

  const empresasSorted = [...empresas].sort(
    (a, b) => (a.matriz_id ? 1 : 0) - (b.matriz_id ? 1 : 0) || a.nome.localeCompare(b.nome),
  );

  const submit = async () => {
    if (!form.email || !form.password || !form.nome) return toast.error("Preencha nome, e-mail e senha");
    if (form.role === "operador" && !form.empresa_id) return toast.error("Operador Cliente exige empresa vinculada");
    try {
      await create({ data: { ...form, empresa_id: form.empresa_id || null } });
      toast.success("Usuário criado");
      setOpen(false);
      setForm({ nome: "", email: "", password: "", role: "operador", empresa_id: "" });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({ nome: u.nome ?? "", role: (u.role ?? "operador") as AppRole, empresa_id: u.empresa_id ?? "" });
  };

  const submitEdit = async () => {
    if (!editUser) return;
    if (editForm.role === "operador" && !editForm.empresa_id) return toast.error("Operador Cliente exige empresa vinculada");
    try {
      await updateUser({ data: { user_id: editUser.id, nome: editForm.nome, empresa_id: editForm.empresa_id || null } });
      if (editForm.role !== editUser.role) {
        await setRole({ data: { user_id: editUser.id, role: editForm.role } });
      }
      toast.success("Usuário atualizado");
      setEditUser(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestão de contas, cargos e senhas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Novo usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar usuário</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Senha</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div>
                <Label>Cargo</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa {form.role === "operador" ? "*" : "(opcional)"}</Label>
                <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {empresasSorted.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.matriz_id ? `↳ ${e.nome} (filial)` : `${e.nome} (matriz)`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Nome</th>
              <th className="px-4 py-2 text-left">E-mail</th>
              <th className="px-4 py-2 text-left">Cargo</th>
              <th className="px-4 py-2 text-left">Empresa</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{u.nome ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2">{u.role ? ROLE_LABELS[u.role] : "—"}</td>
                <td className="px-4 py-2">{empresaLabel(u.empresa_id)}</td>
                <td className="px-4 py-2 text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(u)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPwUser(u); setNewPw(""); }} title="Alterar senha"><Key className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (confirm(`Excluir ${u.email}?`)) { await del({ data: { user_id: u.id } }); toast.success("Excluído"); refresh(); } }} title="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhum usuário.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar usuário — {editUser?.email}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome</Label><Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} /></div>
            <div>
              <Label>Cargo</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v as AppRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa {editForm.role === "operador" ? "*" : "(opcional)"}</Label>
              <Select value={editForm.empresa_id} onValueChange={(v) => setEditForm({ ...editForm, empresa_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {empresasSorted.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.matriz_id ? `↳ ${e.nome} (filial)` : `${e.nome} (matriz)`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={submitEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova senha — {pwUser?.email}</DialogTitle></DialogHeader>
          <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Nova senha" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwUser(null)}>Cancelar</Button>
            <Button onClick={async () => { if (!pwUser || !newPw) return; await setPw({ data: { user_id: pwUser.id, password: newPw } }); toast.success("Senha atualizada"); setPwUser(null); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
