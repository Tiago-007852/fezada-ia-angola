import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MessageCircle, Ticket, Radio, Shield, LogOut, Clock, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, ADMIN_WHATSAPP, ADMIN_WHATSAPP_LINK } from "@/lib/auth";
import { Chat } from "@/components/Chat";
import { Comparator } from "@/components/Comparator";
import { LiveBoard, LiveTicker } from "@/components/LiveTicker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "A minha Fezada — Fezada IA" }, { name: "robots", content: "noindex" }] }),
  component: AppPage,
});

type Tab = "chat" | "bilhetes" | "live";

function AppPage() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<Tab>("chat");
  const qc = useQueryClient();
  const navigate = useNavigate();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">A carregar…</div>;
  const active = me?.profile?.status === "active";

  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <header className="flex items-center gap-2 px-4 py-3">
        <span className="font-display text-lg font-bold">Fezada<span className="text-primary"> IA</span></span>
        <div className="ml-auto flex items-center gap-1">
          {me?.isAdmin && (
            <Button asChild size="sm" variant="secondary"><Link to="/admin"><Shield className="mr-1 h-4 w-4" />Admin</Link></Button>
          )}
          <Button size="icon" variant="ghost" onClick={signOut} aria-label="Sair"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>
      <LiveTicker />

      {!active ? (
        <Pending email={me?.user.email} blocked={me?.profile?.status === "blocked"} />
      ) : (
        <>
          <main className="px-4 pb-20 pt-4">
            {tab === "chat" && <Chat />}
            {tab === "bilhetes" && <Comparator />}
            {tab === "live" && <LiveBoard />}
          </main>
          <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
            <div className="mx-auto grid max-w-xl grid-cols-3">
              {([
                ["chat", "Camarada", MessageCircle],
                ["bilhetes", "Bilhetes", Ticket],
                ["live", "Ao vivo", Radio],
              ] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setTab(id)} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", tab === id ? "text-primary" : "text-muted-foreground")}>
                  <Icon className="h-5 w-5" />{label}
                </button>
              ))}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

function Pending({ email, blocked }: { email: string | undefined; blocked: boolean }) {
  const msg = encodeURIComponent(`Olá! Quero ativar a minha conta Fezada IA. Email: ${email ?? ""}`);
  return (
    <div className="space-y-5 px-4 py-10 text-center">
      <Clock className="mx-auto h-12 w-12 text-primary" />
      <h1 className="text-2xl font-bold">{blocked ? "Acesso suspenso" : "Conta à espera de ativação"}</h1>
      <p className="text-sm text-muted-foreground">
        {blocked
          ? "O teu acesso foi restringido. Fala connosco no WhatsApp para regularizar."
          : "Registo feito, camarada! Para desbloquear o Camarada IA, os bilhetes e os resultados ao vivo, falta só ativar a subscrição."}
      </p>
      <ol className="mx-auto max-w-sm space-y-2 rounded-xl border border-border bg-card p-4 text-left text-sm">
        <li><b className="text-primary">1.</b> Envia mensagem no WhatsApp para <b>{ADMIN_WHATSAPP}</b>.</li>
        <li><b className="text-primary">2.</b> Recebes os dados de pagamento e envias o comprovativo.</li>
        <li><b className="text-primary">3.</b> O admin ativa a tua conta — depois é só atualizar esta página.</li>
      </ol>
      <Button asChild size="lg" className="w-full max-w-sm">
        <a href={`${ADMIN_WHATSAPP_LINK}?text=${msg}`} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
      </Button>
      <button onClick={() => location.reload()} className="block w-full text-xs text-muted-foreground underline">Já paguei — atualizar</button>
    </div>
  );
}
