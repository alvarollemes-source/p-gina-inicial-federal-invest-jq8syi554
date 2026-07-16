import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

type Notif = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  boleto_id: string | null;
  lida: boolean;
  criado_em: string;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function NotificationsBell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!auth.user?.id) return;
    const { data } = await supabase
      .from("notificacoes")
      .select("id,tipo,titulo,mensagem,boleto_id,lida,criado_em")
      .order("criado_em", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notif[]);
  }, [auth.user?.id]);

  useEffect(() => {
    if (!auth.user?.id) return;
    load();
    const ch = supabase
      .channel(`notif-${auth.user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes", filter: `user_id=eq.${auth.user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => [n, ...prev].slice(0, 30));
          toast(n.titulo, { description: n.mensagem });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [auth.user?.id, load]);

  const unread = items.filter((i) => !i.lida).length;

  const markAllRead = async () => {
    if (unread === 0) return;
    const ids = items.filter((i) => !i.lida).map((i) => i.id);
    await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
    setItems((prev) => prev.map((i) => ({ ...i, lida: true })));
  };

  const openItem = async (n: Notif) => {
    if (!n.lida) {
      await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, lida: true } : i)));
    }
    setOpen(false);
    if (n.tipo === "boleto_recebido") {
      navigate({ to: "/boletos-recebidos" });
    } else {
      navigate({ to: "/upload-boletos" });
    }
  };

  const dotColor = (tipo: string) => {
    if (tipo === "boleto_aprovado" || tipo === "boleto_pago") return "bg-emerald-500";
    if (tipo === "boleto_rejeitado") return "bg-red-500";
    return "bg-primary";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative text-muted-foreground" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </div>
        <ScrollArea className="h-96">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Sem notificações</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/40 ${!n.lida ? "bg-primary/5" : ""}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor(n.tipo)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{n.titulo}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.mensagem}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{fmt(n.criado_em)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}