import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Table2 } from "lucide-react";
import { useState } from "react";
import { getGameDetail, getStandings } from "@/lib/feed.functions";
import { Button } from "@/components/ui/button";
import { Crest, MatchMinuteBadge, TeamCell } from "@/components/MatchCenter";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/game/$id")({
  head: () => ({ meta: [{ title: "Jogo — Fezada IA" }, { name: "robots", content: "noindex" }] }),
  component: GameDetailPage,
});

function GameDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["game-detail", id],
    queryFn: () => getGameDetail({ data: id }),
    refetchInterval: 60_000,
    enabled: typeof window !== "undefined",
  });

  if (isLoading) {
    return <div className="p-6 text-center text-sm text-muted-foreground">A carregar o jogo…</div>;
  }
  if (!data?.detail?.fixture) {
    return (
      <EmptyState>
        <p className="mb-4">O detalhe deste jogo está indisponível agora — tenta atualizar.</p>
        <Button asChild size="sm" variant="secondary">
          <Link to="/app">Voltar</Link>
        </Button>
      </EmptyState>
    );
  }

  const f = data.detail.fixture;
  const finished = ["FT", "AET", "PEN"].includes(f.status);

  const homeForm = data.detail.h2h
    .slice()
    .reverse()
    .map((g) => (g.winner === "home" ? "V" : g.winner === "draw" ? "E" : g.winner === "away" ? "D" : "–"))
    .slice(-5);

  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <header className="flex items-center gap-2 px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Voltar">
          <Link to="/app"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <span className="font-display text-sm font-bold">{f.league}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{f.country}</span>
      </header>

      <section className="px-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex flex-col items-center gap-2">
              <Crest src={f.homeLogo} alt={f.home} size={40} />
              <p className="text-center text-sm font-bold leading-tight">{f.home}</p>
            </div>
            <div className="flex min-w-[64px] flex-col items-center gap-1">
              <span className="font-display text-3xl font-extrabold tabular-nums text-primary">{f.hs ?? "–"} : {f.as ?? "–"}</span>
              {["1H", "2H", "HT", "ET", "LIVE"].includes(f.status) ? (
                <MatchMinuteBadge game={{ status: f.status, minute: f.minute ?? 0 }} />
              ) : (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{finished ? f.statusLong : new Date(f.kickoffISO).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <Crest src={f.awayLogo} alt={f.away} size={40} />
              <p className="text-center text-sm font-bold leading-tight">{f.away}</p>
            </div>
          </div>
        </div>
      </section>

      <main className="space-y-3 px-4 pb-16 pt-3">
        {data.detail.stats.length > 0 && (
          <Card title="Estatísticas">
            <ul className="space-y-1.5">
              {data.detail.stats.slice(0, 10).map((s, i) => (
                <li key={i} className="grid grid-cols-[42px_1fr_42px] items-center gap-2 text-xs">
                  <span className="text-right font-bold tabular-nums">{s.home ?? "–"}</span>
                  <span className="text-center text-[11px] text-muted-foreground">{s.stat}</span>
                  <span className="font-bold tabular-nums">{s.away ?? "–"}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {data.detail.events.length > 0 && (
          <Card title="Momentos do jogo">
            <ul className="divide-y divide-border/60">
              {data.detail.events.map((e, i) => (
                <li key={i} className={cn("flex items-center gap-2 py-1.5 text-xs", e.team === "away" && "flex-row-reverse text-right")}>
                  <span className="w-10 shrink-0 text-center text-[10px] font-bold text-primary">{e.minute ?? "?"}'</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.player ?? e.detail}</p>
                    {e.player && <p className="text-[10px] text-muted-foreground">{e.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {data.detail.h2h.length > 0 && (
          <Card title="H2H — últimos duelos">
            <ul className="divide-y divide-border/60">
              {data.detail.h2h.map((g) => (
                <li key={g.fixtureId} className="flex items-center gap-2 py-1.5 text-xs">
                  <span className="w-24 shrink-0 truncate text-[10px] text-muted-foreground">{g.league}</span>
                  <span className="min-w-0 flex-1 truncate">{g.home} {g.hs ?? "–"}-{g.as ?? "–"} {g.away}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", g.winner === "home" ? "bg-success/15 text-success" : g.winner === "away" ? "bg-accent/15 text-accent" : "bg-secondary")}>
                    {new Date(g.kickoffISO).toLocaleDateString("pt-AO", { day: "2-digit", month: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
            {homeForm.length > 0 && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Forma recente {f.home} nos H2H: {homeForm.map((c, i) => <FormDot key={i} char={c} />)}
              </p>
            )}
          </Card>
        )}

        {(data.detail.homeLineup || data.detail.awayLineup) && (
          <Card title="Alinhamentos">
            <div className="grid grid-cols-2 gap-4">
              <LineupList lineup={data.detail.homeLineup} />
              <LineupList lineup={data.detail.awayLineup} />
            </div>
          </Card>
        )}

        <TrophyCard leagueId={f.leagueId} season={f.season} />
      </main>
    </div>
  );
}

function TrophyCard({ leagueId, season }: { leagueId: number; season: number }) {
  const [show, setShow] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["standings", leagueId, season],
    queryFn: () => getStandings({ data: { leagueId, season } }),
    enabled: show && typeof window !== "undefined",
  });
  return (
    <Card
      title="Classificação da liga"
      action={
        <Button size="sm" variant="secondary" onClick={() => setShow((s) => !s)}>
          <Table2 className="mr-1 h-3.5 w-3.5" />
          {show ? "Esconder" : "Ver tabela"}
        </Button>
      }
    >
      {show && (isLoading ? <p className="text-xs text-muted-foreground">A carregar…</p> : data?.standings ? (
        data.standings.groups.map((grp, gi) => (
          <div key={gi} className="mt-1">
            <p className="mb-1 text-[11px] font-bold">{grp.name}</p>
            <table className="w-full text-[11px]">
              <tbody>
                {grp.rows.slice(0, 10).map((r) => (
                  <tr key={r.rank} className="border-t border-border/60">
                    <td className="py-1 pr-2 font-bold text-primary">{r.rank}</td>
                    <td className="flex items-center gap-1.5 py-1 min-w-0"><Crest src={r.teamLogo} alt={r.team} size={14} /> <span className="truncate">{r.team}</span></td>
                    <td className="px-1 py-1 text-center">J{r.played}</td>
                    <td className="px-1 py-1 text-center font-bold">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <p className="text-xs text-muted-foreground">Tabela indisponível para esta liga agora.</p>
      ))}
      {!show && <p className="text-[11px] text-muted-foreground">Posições, pontos e forma de {season}.{String(season + 1).slice(-2)}.</p>}
    </Card>
  );
}

function LineupList({ lineup }: { lineup: { formation: string | null; coach: string | null; startXI: { player: string; pos: string | null }[] } | null }) {
  if (!lineup) return null;
  return (
    <div className="text-[11px]">
      {lineup.formation && <p className="mb-1 font-bold text-primary">{lineup.formation}</p>}
      {lineup.coach && <p className="mb-1 truncate text-muted-foreground">Treinador: {lineup.coach}</p>}
      <ul className="space-y-0.5">
        {lineup.startXI.map((p, i) => (
          <li key={i} className="truncate">{p.pos && <b className="mr-1 text-muted-foreground">{p.pos}</b>}{p.player}</li>
        ))}
      </ul>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function FormDot({ char }: { char: string }) {
  return (
    <span
      className={cn(
        "ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold",
        char === "V" ? "bg-success/20 text-success" : char === "D" ? "bg-destructive/20 text-destructive" : "bg-secondary text-muted-foreground",
      )}
    >
      {char}
    </span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-16 text-center text-sm text-muted-foreground">{children}</div>;
}
