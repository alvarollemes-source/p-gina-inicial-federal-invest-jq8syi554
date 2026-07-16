import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { bootstrapAdmin } from "@/lib/admin.functions";
import { Loader2 } from "lucide-react";
import logoAsset from "@/assets/logo_federal.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Federal Invest Trustee" },
      { name: "description", content: "Acesse a plataforma Federal Invest Trustee." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // seed admin (idempotent, non-blocking)
    bootstrapAdmin().catch(() => undefined);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect ?? "/dashboard", replace: true });
    });
  }, [navigate, redirect]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast.error("Falha no login", { description: error.message });
      return;
    }
    toast.success("Bem-vindo");
    navigate({ to: redirect ?? "/dashboard", replace: true });
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Se o e-mail existir, enviamos as instruções.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_var(--color-primary)_0%,_transparent_55%)] bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <img src={logoAsset.url} alt="Federal Invest" className="h-10 w-10" />
          </div>
          <div>
            <p className="text-lg font-semibold leading-tight text-foreground">Federal Invest</p>
            <p className="text-xs uppercase tracking-widest text-primary">Trustee Platform</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">
            {mode === "login" ? "Entrar" : "Recuperar senha"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? "Use seu e-mail e senha corporativos." : "Enviaremos um link para redefinir sua senha."}
          </p>
          <form onSubmit={mode === "login" ? handleLogin : handleForgot} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode === "login" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Entrar" : "Enviar link"}
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <button type="button" className="text-primary hover:underline" onClick={() => setMode(mode === "login" ? "forgot" : "login")}>
              {mode === "login" ? "Esqueci minha senha" : "Voltar ao login"}
            </button>
            <Link to="/" className="text-muted-foreground hover:text-foreground">Início</Link>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Primeiro acesso? A conta administradora inicial é criada automaticamente na primeira visita.
        </p>
      </div>
    </div>
  );
}