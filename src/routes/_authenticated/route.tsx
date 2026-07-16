import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/logo_federal.png.asset.json";
import { NotificationsBell } from "@/components/layout/NotificationsBell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const auth = useAuth();
  const router = useRouter();
  const handleSignOut = async () => {
    await auth.signOut();
    toast.success("Sessão encerrada");
    await router.navigate({ to: "/auth", replace: true, search: { redirect: undefined } });
  };
  if (auth.loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando…</div>;
  }
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/20">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger />
              <Link to="/" className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                  <img src={logoAsset.url} alt="" className="h-6 w-6" />
                </div>
                <span className="truncate text-sm font-semibold text-foreground">Federal Invest Trustee</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-xs font-medium text-foreground truncate max-w-[240px]">{auth.profile?.nome ?? auth.user?.email}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{auth.role ?? "sem perfil"}</p>
                {auth.profile?.empresa_nome && (
                  <p className="text-[10px] text-muted-foreground truncate max-w-[240px]">
                    {auth.profile.empresa_nome}
                    {" — "}
                    {auth.profile.empresa_matriz_id
                      ? `Filial${auth.profile.empresa_matriz_nome ? ` de ${auth.profile.empresa_matriz_nome}` : ""}`
                      : "Matriz"}
                  </p>
                )}
              </div>
              <NotificationsBell />
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}