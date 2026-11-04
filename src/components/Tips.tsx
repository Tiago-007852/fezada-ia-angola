import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Star, Timer, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTickets, ticketStats, type TicketWithSelections } from "@/lib/tickets";
import { pickLabel, type RiskLevel } from "@/lib/tips.shared";
import { kz } from "@/lib/odds";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_LABEL = {
  pending: "A decorrer",
  won: "Ganho",
  lost: "Perdido",
  void: "Anulado",
} as const;

export function Tips() {
  const { data, isLoading } = useTickets();
  const [risk, setRisk] = useState<RiskLevel>("equilibrado");
  const qc = useQueryClient();

  const generate = useMutation({
    mutationFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) throw new Error("Sessão em falta");
      const res = await fetch("/api/tips/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.session.access_token}`,
        },
        body: JSON.stringify({ risk, stake: 1000 }),
      });
      const json = (await res.json()) as { error?: string; demo?: boolean };
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
      return json;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(
        r.demo
          ? "O feed está indisponível — o Camarada montou um bilhete de demonstração (não foi guardado)."
          : "Bilhete do Camarada criado e guardado! 🔥",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tickets = data?.tickets ?? [];
  const stats = ticketStats(tickets);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/40 bg-card p-4">
        <p className="font-display text-base font-bold">Bilhete do Camarada IA 🤖</p>
        <p className="mt-1 text-xs text-muted-foreground">
          O Camarada analisa odds reais, previsões e formas dos jogos do dia e monta um bilhete
          guardado na tua conta. Odds de 1 a 6 por pick, melhor casa referência, imposto de 15% no
          lucro.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["seguro", "equilibrado", "arriscado"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRisk(r)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
                risk === r
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-muted-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Button
          className="mt-3 w-full"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          <Sparkles className="mr-1 h-4 w-4" />
          {generate.isPending ? "O Camarada está a analisar…" : "Gerar bilhete de hoje"}
        </Button>
      </div>

      {tickets.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatTile label="Bilhetes" value={String(tickets.length)} />
          <StatTile
            label="Hit rate"
            value={`${(stats.hitRate * 100).toFixed(0)}%`}
            sub={`${stats.won}G · ${stats.lost}P`}
          />
          <StatTile
            label="ROI"
            value={`${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(0)}%`}
            sub={`${stats.net >= 0 ? "+" : ""}${kz(stats.net).replace(" Kz", "")} Kz`}
            good={stats.net >= 0}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">A carregar bilhetes…</p>}
      {!isLoading && tickets.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          Ainda sem bilhetes. Pede o primeiro ao Camarada acima, mano!
        </p>
      )}

      <div className="space-y-2">
        {tickets.map((t) => (
          <TicketCard key={t.id} ticket={t} />
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Palpites são opiniões do IA com base em dados, não garantia de ganho. Jogo responsável · 18+
        · aposta só o que podes perder.
      </p>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  good,
}: {
  label: string;
  value: string;
  sub?: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-display text-lg font-bold",
          good === true && "text-success",
          good === false && "text-destructive",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: TicketWithSelections }) {
  const won = ticket.status === "won";
  const lost = ticket.status === "lost";
  const pending = ticket.status === "pending";
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3",
        won ? "border-success/50" : lost ? "border-destructive/50" : "border-border",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        {ticket.source === "ai" && (
          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">
            IA · {ticket.risk ?? ""}
          </span>
        )}
        {ticket.source !== "ai" && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold">Manual</span>
        )}
        <span
          className={cn(
            "ml-auto flex items-center gap-1 text-[11px] font-semibold",
            won ? "text-success" : lost ? "text-destructive" : "text-primary",
          )}
        >
          {pending ? (
            <Timer className="h-3.5 w-3.5" />
          ) : won ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>
      <ul className="divide-y divide-border text-sm">
        {ticket.selections.map((s) => (
          <li key={s.id} className="flex items-center gap-2 py-1.5">
            <Star
              className={cn(
                "h-3 w-3 shrink-0",
                s.result === "win"
                  ? "text-success"
                  : s.result === "lost"
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">
                {s.home} vs {s.away}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {s.league} · {pickLabel[s.pick] ?? s.pick}
              </p>
            </div>
            <span className="text-xs font-bold">×{String(s.odds)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Odd {Number(ticket.total_odds ?? 0).toFixed(2)} · Aposta {kz(Number(ticket.stake))}
        </span>
        {ticket.status === "won" && Number(ticket.net_return ?? 0) > 0 && (
          <b className="text-success">+{kz(Number(ticket.net_return))}</b>
        )}
        {ticket.status === "pending" && (
          <b className="text-primary">Líquido poss. {kz(Number(ticket.net_return ?? 0))}</b>
        )}
        {ticket.status === "lost" && (
          <b className="text-destructive">-{kz(Number(ticket.stake))}</b>
        )}
      </div>
      {ticket.rationale && (
        <p className="mt-2 rounded-lg bg-secondary px-2 py-1.5 text-[11px] text-muted-foreground">
          {ticket.rationale}
        </p>
      )}
    </div>
  );
}
