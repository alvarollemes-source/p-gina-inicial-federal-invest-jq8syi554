import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import type { AppRole, PageKey } from "@/lib/rbac/roles";
import { DEFAULT_ROLE_PAGES, isFederal } from "@/lib/rbac/roles";

interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
  empresa_id: string | null;
  empresa_nome: string | null;
  empresa_matriz_id: string | null;
  empresa_matriz_nome: string | null;
  ativo: boolean;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  isFederal: boolean;
  loading: boolean;
  canAccess: (page: PageKey) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const loadForUser = async (uid: string) => {
    const [{ data: p }, { data: r }, { data: perms }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,nome,email,empresa_id,ativo,empresas:empresa_id(id,nome,matriz_id)")
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("permissoes_individuais").select("pagina,pode_visualizar").eq("user_id", uid),
    ]);
    const pr = p as
      | (Omit<Profile, "empresa_nome" | "empresa_matriz_id" | "empresa_matriz_nome"> & {
          empresas?: { id: string; nome: string; matriz_id: string | null } | null;
        })
      | null;
    let matrizNome: string | null = null;
    if (pr?.empresas?.matriz_id) {
      const { data: m } = await supabase.from("empresas").select("nome").eq("id", pr.empresas.matriz_id).maybeSingle();
      matrizNome = (m as { nome: string } | null)?.nome ?? null;
    }
    setProfile(
      pr
        ? {
            id: pr.id,
            nome: pr.nome,
            email: pr.email,
            empresa_id: pr.empresa_id,
            ativo: pr.ativo,
            empresa_nome: pr.empresas?.nome ?? null,
            empresa_matriz_id: pr.empresas?.matriz_id ?? null,
            empresa_matriz_nome: matrizNome,
          }
        : null,
    );
    // Priority: admin > gestor > analista > operador
    const roles = (r ?? []).map((x) => x.role as AppRole);
    const priority: AppRole[] = ["admin", "gestor", "analista", "operador"];
    setRole(priority.find((x) => roles.includes(x)) ?? null);
    const map: Record<string, boolean> = {};
    (perms ?? []).forEach((row) => {
      map[row.pagina as string] = Boolean(row.pode_visualizar);
    });
    setOverrides(map);
  };

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        // defer to avoid deadlock inside the listener
        setTimeout(() => loadForUser(s.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) await loadForUser(data.session.user.id);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Realtime: recarrega permissões individuais quando alteradas
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    const ch = supabase
      .channel(`perms-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "permissoes_individuais", filter: `user_id=eq.${uid}` },
        () => loadForUser(uid),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role,
      isFederal: isFederal(role),
      loading,
      canAccess: (page) => {
        if (Object.prototype.hasOwnProperty.call(overrides, page)) return overrides[page];
        return role ? DEFAULT_ROLE_PAGES[role].includes(page) : false;
      },
      refresh: async () => {
        if (session?.user) await loadForUser(session.user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, role, loading, overrides],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}