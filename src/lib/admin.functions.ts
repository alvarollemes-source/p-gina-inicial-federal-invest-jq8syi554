import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "alvaro@adm.com";
const ADMIN_PASSWORD = "1234";

/**
 * Bootstrap the seed admin. Idempotent: creates the admin user and role
 * only if not already present. Publicly callable so the first browser
 * visit primes the account.
 */
export const bootstrapAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Check if any admin already exists
  const { data: existing } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1);
  if (existing && existing.length > 0) return { ok: true, seeded: false };

  // Try to find user by email
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  let userId = list?.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL)?.id ?? null;

  if (!userId) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { nome: "Administrador" },
    });
    if (error || !created.user) return { ok: false, error: error?.message ?? "createUser failed" };
    userId = created.user.id;
  }

  await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "admin" });
  await supabaseAdmin.from("profiles").upsert({ id: userId, email: ADMIN_EMAIL, nome: "Administrador", ativo: true });

  return { ok: true, seeded: true };
});

export const createUserAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; password: string; nome: string; role: "admin" | "gestor" | "analista" | "operador"; empresa_id?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error || !created.user) throw new Error(error?.message ?? "createUser failed");
    await supabaseAdmin.from("profiles").upsert({ id: created.user.id, email: data.email, nome: data.nome, empresa_id: data.empresa_id ?? null, ativo: true });
    await supabaseAdmin.from("user_roles").upsert({ user_id: created.user.id, role: data.role });
    return { ok: true, id: created.user.id };
  });

export const updateUserPasswordAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; password: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserRoleAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; role: "admin" | "gestor" | "analista" | "operador" }) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    return { ok: true };
  });

export const deleteUserAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; nome?: string | null; empresa_id?: string | null; ativo?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { nome?: string | null; empresa_id?: string | null; ativo?: boolean } = {};
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.empresa_id !== undefined) patch.empresa_id = data.empresa_id;
    if (data.ativo !== undefined) patch.ativo = data.ativo;
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllUsersAsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id,nome,email,empresa_id,ativo,ultimo_acesso,created_at")
      .order("created_at", { ascending: false });
    const { data: roles } = await context.supabase.from("user_roles").select("user_id,role");
    const rmap = new Map<string, string>();
    (roles ?? []).forEach((r) => rmap.set(r.user_id, r.role));
    return (profiles ?? []).map((p) => ({ ...p, role: rmap.get(p.id) ?? null }));
  });