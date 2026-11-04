import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MessageCircle, Ticket, Radio, Shield, LogOut, Clock, Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, ADMIN_WHATSAPP, ADMIN_WHATSAPP_LINK, SUBSCRIPTION_PRICE, PAYMENT_NUMBER } from "@/lib/auth";
import { isProfileActive, isProfileExpired } from "@/lib/access.shared";
import { useLiveScores } from "@/lib/live";
import { Chat } from "@/components/Chat";
import { Comparator } from "@/components/Comparator";
import { LiveTicker } from "@/components/LiveTicker";
import { MatchCenter } from "@/components/MatchCenter";
import { Tips } from "@/components/Tips";
import { useGoalAlerts } from "@/lib/favorites";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "A minha Fezada — Fezada IA" }, { name: "robots", content: "noindex" }] }),
  component: AppPage,
});

type Tab = "chat" | "palpites" | "bilhetes" | "live";

function AppPage() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<Tab>("chat");
  const qc = useQueryClient();
  const navigate = useNavigate();

  const liveScores = useLiveScores();
  useGoalAlerts(liveScores.games);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">A carregar…</div>;
  const active = isProfileActive(me?.profile);
  const expired = isProfileExpired(me?.profile);

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
        <Pending email={me?.user.email} blocked={me?.profile?.status === "blocked"} expired={expired} />
      ) : (
        <>
          <main className="px-4 pb-20 pt-4">
            {tab === "chat" && <Chat />}
            {tab === "palpites" && <Tips />}
            {tab === "bilhetes" && <Comparator />}
            {tab === "live" && <MatchCenter />}
          </main>
          <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
            <div className="mx-auto grid max-w-xl grid-cols-4">
              {([
                ["chat", "Camarada", MessageCircle],
                ["palpites", "Palpites", Sparkles],
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

function Pending({ email, blocked, expired }: { email: string | undefined; blocked: boolean; expired: boolean }) {
  const [copied, setCopied] = useState(false);
  const msg = encodeURIComponent(`Olá! Já paguei a subscrição Fezada IA (${SUBSCRIPTION_PRICE}) via Multicaixa Express. Segue o comprovativo. Email: ${email ?? ""}`);

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(`244${PAYMENT_NUMBER.replace(/\D/g, "")}`);
      setCopied(true);
      toast.success("Número copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Não consegui copiar. Aponta: 244 ${PAYMENT_NUMBER}`);
    }
  };

  return (
    <div className="space-y-5 px-4 py-10 text-center">
      <Clock className="mx-auto h-12 w-12 text-primary" />
      <h1 className="text-2xl font-bold">{blocked ? "Acesso suspenso" : expired ? "Subscrição expirada" : "Conta à espera de ativação"}</h1>
      <p className="text-sm text-muted-foreground">
        {blocked
          ? "O teu acesso foi restringido. Fala connosco no WhatsApp para regularizar."
          : expired
          ? "A tua subscrição terminou. Renova o pagamento para voltares a usar o Camarada IA, os bilhetes e os resultados ao vivo."
          : "Registo feito, camarada! Para desbloquear o Camarada IA, os bilhetes e os resultados ao vivo, falta só ativar a subscrição."}
      </p>

      {!blocked && (
        <div className="mx-auto max-w-sm space-y-2 rounded-xl border border-border bg-card p-4 text-left text-sm">
          <p className="font-display text-base font-bold">
            Subscrição: <span className="text-primary">{SUBSCRIPTION_PRICE}</span>
          </p>
          <p className="text-muted-foreground">Pagamento por Multicaixa Express para:</p>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <span className="font-mono text-base font-bold tracking-wide">+244 {PAYMENT_NUMBER}</span>
            <Button type="button" size="sm" variant="secondary" onClick={copyNumber}>
              {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      )}

      {!blocked && (
        <ol className="mx-auto max-w-sm space-y-2 rounded-xl border border-border bg-card p-4 text-left text-sm">
          <li><b className="text-primary">1.</b> Abre o Multicaixa Express e envia <b>{SUBSCRIPTION_PRICE}</b> para <b>+244 {PAYMENT_NUMBER}</b>.</li>
          <li><b className="text-primary">2.</b> Tira print ou guarda o comprovativo do pagamento.</li>
          <li><b className="text-primary">3.</b> Envia o comprovativo no WhatsApp <b>{ADMIN_WHATSAPP}</b> com o teu email de registo.</li>
          <li><b className="text-primary">4.</b> O admin ativa a tua conta — depois é só atualizar esta página.</li>
        </ol>
      )}
      <Button asChild size="lg" className="w-full max-w-sm">
        <a href={`${ADMIN_WHATSAPP_LINK}?text=${msg}`} target="_blank" rel="noreferrer">Enviar comprovativo no WhatsApp</a>
      </Button>
      <button onClick={() => location.reload()} className="block w-full text-xs text-muted-foreground underline">Já paguei — atualizar</button>
    </div>
  );
}
