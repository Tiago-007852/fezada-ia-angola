import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { isProfileActive, SUBSCRIPTION_DAYS } from "@/lib/access.shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel Admin — Fezada IA" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

const statusLabel = { pending: "Pendente", active: "Ativo", blocked: "Restrito" } as const;

function Admin() {
  const { data: me, isLoading } = useMe();
  const [q, setQ] = useState("");
  const qc = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (v: { id: string; status: "active" | "blocked"; }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          status: v.status,
          payment_confirmed: v.status === "active",
          activated_at: v.status === "active" ? new Date().toISOString() : null,
          expires_at: v.status === "active" ? new Date(Date.now() + SUBSCRIPTION_DAYS * 86_400_000).toISOString() : null,
        })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.status === "active" ? `Acesso liberado por ${SUBSCRIPTION_DAYS} dias` : "Acesso restringido");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm">A carregar…</div>;
  if (!me?.isAdmin) return <div className="p-6 text-sm">Sem permissão. <Link to="/app" className="underline">Voltar</Link></div>;

  const list = (users.data ?? []).filter((u) =>
    `${u.email ?? ""} ${u.full_name ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const counts = (users.data ?? []).reduce((a, u) => ({ ...a, [u.status]: (a[u.status] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-4">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild size="icon" variant="ghost"><Link to="/app" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-xl font-bold">Painel Admin</h1>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {(["pending", "active", "blocked"] as const).map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card p-2">
            <p className="font-display text-xl font-bold">{counts[s] ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{statusLabel[s]}</p>
          </div>
        ))}
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por email ou nome" className="pl-9" />
      </div>
      <div className="space-y-2">
        {list.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{u.full_name || u.email}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              <p className="mt-1 text-[11px]">
                <span className={cn("rounded px-1.5 py-0.5", u.status === "active" ? "bg-success/20 text-success" : u.status === "blocked" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary")}>
                  {statusLabel[u.status]}
                </span>
                <span className="ml-2 text-muted-foreground">Pagamento: {u.payment_confirmed ? "confirmado" : "por confirmar"}</span>
                {u.status === "active" && (
                  <span className={cn("ml-2", isProfileActive(u) ? "text-muted-foreground" : "text-destructive")}>
                    {u.expires_at ? `${isProfileActive(u) ? "válido até" : "expirou em"} ${new Date(u.expires_at).toLocaleDateString("pt-PT")}` : "sem validade"}
                  </span>
                )}
              </p>
            </div>
            {u.id !== me.user.id &&
              (u.status === "active" ? (
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="secondary" disabled={update.isPending} onClick={() => update.mutate({ id: u.id, status: "active" })}>Renovar +{SUBSCRIPTION_DAYS}d</Button>
                  <Button size="sm" variant="destructive" disabled={update.isPending} onClick={() => update.mutate({ id: u.id, status: "blocked" })}>Restringir</Button>
                </div>
              ) : (
                <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ id: u.id, status: "active" })}>Liberar</Button>
              ))}
          </div>
        ))}
        {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum utilizador encontrado.</p>}
      </div>
    </div>
  );
}
