import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("permissoes_individuais")
      .select("*")
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

type PermInput = {
  user_id: string;
  pagina: string;
  pode_visualizar: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
  pode_exportar: boolean;
};

export const savePermissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: PermInput) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("permissoes_individuais")
      .delete()
      .eq("user_id", data.user_id)
      .eq("pagina", data.pagina);
    const { error } = await supabaseAdmin.from("permissoes_individuais").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });