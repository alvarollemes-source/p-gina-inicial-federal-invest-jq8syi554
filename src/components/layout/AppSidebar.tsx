import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  History,
  Inbox,
  FileSpreadsheet,
  BarChart3,
  Scissors,
  Users,
  Building2,
  ShieldCheck,
  Settings,
  Activity,
  FileStack,
  Banknote,
  Landmark,
  RotateCcw,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { PageKey } from "@/lib/rbac/roles";
import logoAsset from "@/assets/logo_federal.png.asset.json";

type Item = { key: PageKey; title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const MAIN: Item[] = [
  { key: "dashboard", title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { key: "pagamentos", title: "Pagamentos", url: "/pagamentos", icon: Wallet },
  { key: "historico", title: "Histórico de Envios", url: "/historico", icon: History },
  { key: "boletos-recebidos", title: "Pagamentos Recebidos", url: "/boletos-recebidos", icon: Inbox },
  { key: "conversor-ofx", title: "Conversor XLS→OFX", url: "/conversor-ofx", icon: FileSpreadsheet },
  { key: "relatorios", title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { key: "separar-comprovantes", title: "Separar Comprovantes", url: "/separar-comprovantes", icon: Scissors },
];

const FINANCEIRO: Item[] = [
  { key: "financeiro-documentos", title: "Documentos de pagamento", url: "/financeiro/documentos", icon: FileStack },
  { key: "financeiro-cnab", title: "Central CNAB", url: "/financeiro/cnab", icon: Banknote },
  { key: "financeiro-retornos", title: "Arquivos de retorno", url: "/financeiro/retornos", icon: RotateCcw },
  { key: "financeiro-config-bancaria", title: "Configurações bancárias", url: "/financeiro/configuracoes-bancarias", icon: Landmark },
];

const ADMIN: Item[] = [
  { key: "usuarios", title: "Usuários", url: "/usuarios", icon: Users },
  { key: "empresas", title: "Empresas", url: "/empresas", icon: Building2 },
  { key: "permissoes", title: "Cargos e Permissões", url: "/permissoes", icon: ShieldCheck },
  { key: "configuracoes", title: "Configurações", url: "/configuracoes", icon: Settings },
  { key: "logs", title: "Logs de Atividade", url: "/logs", icon: Activity },
];

export function AppSidebar() {
  const auth = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const active = (u: string) => (u === "/" ? pathname === "/" : pathname.startsWith(u));
  const visible = (items: Item[]) => items.filter((i) => auth.canAccess(i.key));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50">
        <div className="flex items-center gap-2 px-1 py-2">
          <img src={logoAsset.url} alt="Federal Invest" className="h-8 w-8 rounded-md bg-white/10 p-0.5" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold leading-tight text-sidebar-foreground truncate">Federal Invest</p>
            <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Trustee</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible(MAIN).map((it) => (
                <SidebarMenuItem key={it.key}>
                  <SidebarMenuButton asChild isActive={active(it.url)}>
                    <Link to={it.url} className="flex items-center gap-2">
                      <it.icon className="h-4 w-4" />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {visible(FINANCEIRO).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visible(FINANCEIRO).map((it) => (
                  <SidebarMenuItem key={it.key}>
                    <SidebarMenuButton asChild isActive={active(it.url)}>
                      <Link to={it.url} className="flex items-center gap-2">
                        <it.icon className="h-4 w-4" />
                        <span>{it.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {visible(ADMIN).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visible(ADMIN).map((it) => (
                  <SidebarMenuItem key={it.key}>
                    <SidebarMenuButton asChild isActive={active(it.url)}>
                      <Link to={it.url} className="flex items-center gap-2">
                        <it.icon className="h-4 w-4" />
                        <span>{it.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}