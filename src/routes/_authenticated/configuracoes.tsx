import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/rbac/roles";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Federal Invest" }] }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const auth = useAuth();
  const [nome, setNome] = useState(auth.profile?.nome ?? "");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const saveProfile = async () => {
    if (!auth.user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ nome }).eq("id", auth.user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    await auth.refresh();
  };

  const savePassword = async () => {
    if (!pw || pw.length < 4) return toast.error("Senha muito curta");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw("");
    toast.success("Senha atualizada");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preferências da sua conta.</p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Perfil</h2>
        <div><Label>E-mail</Label><Input value={auth.user?.email ?? ""} disabled /></div>
        <div><Label>Cargo</Label><Input value={auth.role ? ROLE_LABELS[auth.role] : "—"} disabled /></div>
        <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <Button onClick={saveProfile} disabled={busy}>Salvar perfil</Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Alterar senha</h2>
        <div><Label>Nova senha</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button onClick={savePassword} disabled={busy || !pw}>Alterar senha</Button>
      </section>
    </div>
  );
}