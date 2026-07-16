import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAllUsersAsAdmin } from "@/lib/admin.functions";
import { listPermissoes, savePermissao } from "@/lib/permissoes.functions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGES, ROLE_LABELS, DEFAULT_ROLE_PAGES, type AppRole, type PageKey } from "@/lib/rbac/roles";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/permissoes")({
  head: () => ({ meta: [{ title: "Cargos e Permissões" }] }),
  component: PermissoesPage,
});

type UserRow = { id: string; email: string | null; nome: string | null; role: AppRole | null };
type Perm = {
  pagina: string;
  pode_visualizar: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
  pode_exportar: boolean;
};

function PermissoesPage() {
  const auth = useAuth();
  const listUsers = useServerFn(listAllUsersAsAdmin);
  const listPerms = useServerFn(listPermissoes);
  const savePerm = useServerFn(savePermissao);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [perms, setPerms] = useState<Record<string, Perm>>({});

  useEffect(() => {
    if (auth.role !== "admin") return;
    listUsers().then((r) => setUsers(r as UserRow[]));
  }, [auth.role]);

  useEffect(() => {
    if (!selected) return;
    listPerms({ data: { user_id: selected } }).then((rows) => {
      const map: Record<string, Perm> = {};
      (rows as Perm[]).forEach((r) => { map[r.pagina] = r; });
      setPerms(map);
    });
  }, [selected]);

  if (auth.role !== "admin") return <div className="p-8 text-sm text-muted-foreground">Acesso restrito.</div>;

  const user = users.find((u) => u.id === selected);
  const roleDefault = user?.role ? DEFAULT_ROLE_PAGES[user.role] : [];

  const getPerm = (page: PageKey): Perm => perms[page] ?? {
    pagina: page,
    pode_visualizar: roleDefault.includes(page),
    pode_criar: false,
    pode_editar: false,
    pode_excluir: false,
    pode_exportar: false,
  };

  const setPerm = (page: PageKey, patch: Partial<Perm>) => {
    setPerms((p) => ({ ...p, [page]: { ...getPerm(page), ...patch, pagina: page } }));
  };

  const save = async (page: PageKey) => {
    if (!selected) return;
    const p = getPerm(page);
    await savePerm({ data: { user_id: selected, ...p } });
    toast.success(`Salvo: ${page}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cargos e Permissões</h1>
      <p className="mt-1 text-sm text-muted-foreground">Ajuste fino de acesso por página, sobrepondo o padrão do cargo.</p>

      <div className="mt-4 max-w-md">
        <Label>Usuário</Label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger><SelectValue placeholder="Selecione um usuário…" /></SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.email} — {u.role ? ROLE_LABELS[u.role] : "sem cargo"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Página</th>
                <th className="px-3 py-2">Ver</th>
                <th className="px-3 py-2">Criar</th>
                <th className="px-3 py-2">Editar</th>
                <th className="px-3 py-2">Excluir</th>
                <th className="px-3 py-2">Exportar</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {PAGES.map((page) => {
                const p = getPerm(page);
                return (
                  <tr key={page} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{page}</td>
                    {(["pode_visualizar", "pode_criar", "pode_editar", "pode_excluir", "pode_exportar"] as const).map((k) => (
                      <td key={k} className="px-3 py-2 text-center">
                        <Checkbox checked={p[k]} onCheckedChange={(v) => setPerm(page, { [k]: Boolean(v) })} />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => save(page)}>Salvar</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}