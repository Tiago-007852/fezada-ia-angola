import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Star, Table2 } from "lucide-react";
import { toast } from "sonner";
import { useLiveScores, type LiveGame } from "@/lib/live";
import { getUpcomingOdds, getStandings } from "@/lib/feed.functions";
import { useFavorites } from "@/lib/favorites";
import { cn } from "@/lib/utils";

const STATUS: Record<string, string> = {
  "1H": "1º Tempo",
  HT: "Intervalo",
  "2H": "2º Tempo",
  ET: "Prolongamento",
  BT: "Pausa",
  P: "Penáltis",
  SUSP: "Suspenso",
  INT: "Interrompido",
  LIVE: "Ao vivo",
};

function isRunning(s: string) {
  return s === "1H" || s === "2H" || s === "ET" || s === "LIVE";
}

export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const tzMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzMs).toISOString().slice(0, 10);
}

export function Crest({ src, alt, size = 28 }: { src: string | undefined; alt: string; size?: number }) {
  if (!src) return <span style={{ width: size, height: size }} className="inline-block shrink-0 rounded-full bg-muted" />;
  return <img src={src} alt={alt} width={size} height={size} loading="lazy" className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

type DayTab = "live" | "upcoming";

export function MatchCenter() {
  const [day, setDay] = useState<DayTab>("live");
  const days = useMemo(() => {
    const list: { iso: string; label: string; offset: number }[] = [];
    for (let i = 0; i <= 3; i++) {
      const iso = isoDate(i);
      const d = new Date(iso + "T12:00:00");
      const label = i === 0 ? "Hoje" : i === 1 ? "Amanhã" : d.toLocaleDateString("pt-AO", { weekday: "short", day: "2-digit", month: "2-digit" });
      list.push({ iso, label, offset: i });
    }
    return list;
  }, []);
  const [selectedDay, setSelectedDay] = useState(0);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setDay("live")}
          className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-bold", day === "live" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}
        >
          Ao vivo
        </button>
        <button
          onClick={() => setDay("upcoming")}
          className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-bold", day === "upcoming" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}
        >
          Jogos do dia
        </button>
      </div>

      {day === "live" ? (
        <LiveSection />
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map((d) => (
              <button
                key={d.iso}
                onClick={() => setSelectedDay(d.offset)}
                className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", selectedDay === d.offset ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}
              >
                {d.label}
              </button>
            ))}
          </div>
          <UpcomingSection date={days[selectedDay]?.iso ?? isoDate(0)} />
        </>
      )}
    </div>
  );
}

// ============================= AO VIVO =============================

function LiveSection() {
  const { games, demo, loading } = useLiveScores();
  const [filter, setFilter] = useState<"all" | "running" | "HT">("all");
  const { isFavorite, toggle } = useFavorites();

  const groups = useMemo(() => {
    const list = games.filter((g) => (filter === "all" ? true : filter === "HT" ? g.status === "HT" : isRunning(g.status)));
    const map = new Map<string, { name: string; country: string; logo: string; gameId: string; games: LiveGame[] }>();
    for (const g of list) {
      const k = `${g.leagueId}-${g.league}`;
      if (!map.has(k)) map.set(k, { name: g.league, country: g.country, logo: g.leagueLogo, gameId: `lg-${g.leagueId}`, games: [] });
      map.get(k)!.games.push(g);
    }
    return [...map.values()];
  }, [games, filter]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([["all", "Todos"], ["running", "A decorrer"], ["HT", "Intervalo"]] as const).map(([id, label]) => (
          <FilterPill key={id} id={id} label={label} filter={filter} setFilter={setFilter} games={games} />
        ))}
      </div>
      {demo && <p className="text-xs text-muted-foreground">Resultados ao vivo indisponíveis — a tentar ligar à API-Sports.</p>}
      {loading && <p className="text-sm text-muted-foreground">A carregar…</p>}
      {!loading && !demo && groups.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          {games.length === 0 ? "Sem jogos ao vivo neste momento. Vê os jogos do dia!" : "Nenhum jogo neste filtro."}
        </p>
      )}
      {groups.map((grp) => (
        <LeagueCard key={grp.gameId} logo={grp.logo} name={grp.name} country={grp.country}>
          {grp.games.map((g, gi) => (
            <li key={g.id} className="px-3">
              <Link to="/game/$id" params={{ id: g.id }} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3">
                <TeamCell logo={g.homeLogo} name={g.home} fav={isFavorite(g.home)} onFav={() => toggle(g.home)} />
                <div className="flex min-w-[72px] flex-col items-center gap-1">
                  <span className="font-display text-xl font-extrabold tabular-nums text-primary">{g.hs} - {g.as}</span>
                  <MinuteBadge game={g} />
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{STATUS[g.status] ?? g.status}</span>
                </div>
                <TeamCell logo={g.awayLogo} name={g.away} fav={isFavorite(g.away)} onFav={() => toggle(g.away)} alignRight />
              </Link>
            </li>
          ))}
        </LeagueCard>
      ))}
    </div>
  );
}

function FilterPill({
  id,
  label,
  filter,
  setFilter,
  games,
}: {
  id: "all" | "running" | "HT";
  label: string;
  filter: string;
  setFilter: (f: "all" | "running" | "HT") => void;
  games: LiveGame[];
}) {
  const counts = {
    all: games.length,
    running: games.filter((g) => isRunning(g.status)).length,
    HT: games.filter((g) => g.status === "HT").length,
  };
  return (
    <button
      onClick={() => setFilter(id)}
      className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", filter === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}
    >
      {label} <span className="opacity-70">{counts[id]}</span>
    </button>
  );
}

function MinuteBadge({ game }: { game: { status: string; minute: number } }) {
  const running = isRunning(game.status);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", running ? "bg-accent/20 text-accent" : "bg-primary/15 text-primary")}>
      {running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
      {game.status === "HT" ? "INT" : `${game.minute}'`}
    </span>
  );
}

// ============================= JOGOS DO DIA (agendados + odds) =============================

function UpcomingSection({ date }: { date: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["upcoming-odds", date],
    queryFn: () => getUpcomingOdds({ data: date }),
    enabled: typeof window !== "undefined",
  });
  const { isFavorite, toggle } = useFavorites();

  const groups = useMemo(() => {
    const list = data?.games ?? [];
    const map = new Map<string, { name: string; country: string; logo: string; gameId: string; games: typeof list }>();
    for (const g of list) {
      const k = `${g.leagueId}-${g.league}`;
      if (!map.has(k)) map.set(k, { name: g.league, country: g.country, logo: g.leagueLogo, gameId: k, games: [] });
      map.get(k)!.games.push(g);
    }
    return [...map.values()];
  }, [data]);

  const kickoffLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-sm text-muted-foreground">A carregar jogos…</p>}
      {data?.demo && !isLoading && (
        <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          O feed de jogos/odds está indisponível agora. As cotações usadas no comparador são de demonstração.
        </p>
      )}
      {!isLoading && data && !data.demo && groups.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">Sem jogos a decorrer neste dia na base.</p>
      )}
      {groups.map((grp) => (
        <LeagueCard
          key={grp.gameId}
          logo={grp.logo}
          name={grp.name}
          country={grp.country}
          withStandings={data && !data.demo ? { leagueId: Number(grp.gameId.split("-")[0]), season: Number(grp.games[0]?.kickoffISO ? new Date(grp.games[0].kickoffISO).getMonth() < 6 ? new Date(grp.games[0].kickoffISO).getFullYear() - 1 : new Date(grp.games[0].kickoffISO).getFullYear() : new Date().getFullYear()) } : undefined}
        >
          {grp.games.map((g) => (
            <li key={g.fixtureId} className="px-3">
              <Link to="/game/$id" params={{ id: g.fixtureId }} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3">
                <TeamCell logo={g.homeLogo} name={g.home} fav={isFavorite(g.home)} onFav={() => toggle(g.home)} />
                <div className="flex min-w-[66px] flex-col items-center gap-0.5">
                  <span className="text-sm font-bold tabular-nums">{kickoffLabel(g.kickoffISO)}</span>
                  {g.odds[0] && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                      {g.odds[0].home?.toFixed(2) ?? "–"} / {g.odds[0].draw?.toFixed(2) ?? "–"} / {g.odds[0].away?.toFixed(2) ?? "–"}
                    </span>
                  )}
                </div>
                <TeamCell logo={g.awayLogo} name={g.away} fav={isFavorite(g.away)} onFav={() => toggle(g.away)} alignRight />
              </Link>
            </li>
          ))}
        </LeagueCard>
      ))}
    </div>
  );
}

// ============================= Cartão de liga + tabela =============================

function LeagueCard({ logo, name, country, children, withStandings }: { logo: string | undefined; name: string; country: string; children: React.ReactNode; withStandings?: { leagueId: number; season: number } | undefined }) {
  const [show, setShow] = useState(false);
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border bg-secondary px-3 py-2">
        <Crest src={logo} alt={name} size={18} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold">{name}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{country}</p>
        </div>
      </header>
      {withStandings && (
        <button onClick={() => setShow((s) => !s)} className="flex w-full items-center gap-1 border-b border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground">
          <Table2 className="h-3.5 w-3.5" />
          {show ? "Esconder" : "Classificação"}
          {show ? <ChevronDown className="ml-auto h-3.5 w-3.5" /> : <ChevronRight className="ml-auto h-3.5 w-3.5" />}
        </button>
      )}
      {withStandings && show && <StandingsSection leagueId={withStandings.leagueId} season={withStandings.season} />}
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}

function StandingsSection({ leagueId, season }: { leagueId: number; season: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["standings", leagueId, season],
    queryFn: () => getStandings({ data: { leagueId, season } }),
    enabled: typeof window !== "undefined",
  });
  if (isLoading) return <p className="px-3 py-2 text-[11px] text-muted-foreground">A carregar a tabela…</p>;
  if (error || !data?.standings) {
    return <p className="px-3 py-2 text-[11px] text-muted-foreground">A tabela estará disponível assim que o feed responder.</p>;
  }
  const grp = data.standings.groups[0];
  if (!grp) return null;
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-muted-foreground">
          <th className="px-2 py-1 text-left font-medium">#</th>
          <th className="py-1 text-left font-medium">Equipa</th>
          <th className="px-1 py-1 font-medium">J</th>
          <th className="px-1 py-1 font-medium">V</th>
          <th className="px-1 py-1 font-medium">E</th>
          <th className="px-1 py-1 font-medium">D</th>
          <th className="px-1 py-1 font-medium">Pts</th>
        </tr>
      </thead>
      <tbody>
        {grp.rows.slice(0, 12).map((r) => (
          <tr key={r.rank} className="border-t border-border/60">
            <td className="px-2 py-1 font-bold text-primary">{r.rank}</td>
            <td className="flex items-center gap-1.5 py-1"><Crest src={r.teamLogo} alt={r.team} size={14} /> <span className="truncate">{r.team}</span></td>
            <td className="px-1 py-1 text-center">{r.played}</td>
            <td className="px-1 py-1 text-center">{r.win}</td>
            <td className="px-1 py-1 text-center">{r.draw}</td>
            <td className="px-1 py-1 text-center">{r.lose}</td>
            <td className="px-1 py-1 text-center font-bold">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TeamCell({ logo, name, fav, onFav, alignRight }: { logo: string | undefined; name: string; fav: boolean; onFav: () => void; alignRight?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", alignRight && "flex-row-reverse")}>
      <Crest src={logo} alt={name} />
      <span className="truncate text-sm font-semibold">{name}</span>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFav();
          toast.success(fav ? "Deixaste de seguir." : "Agora segues esta equipa! Torço contigo.");
        }}
        aria-label={fav ? "Deixar de seguir" : "Segue esta equipa"}
        className="shrink-0"
      >
        <Star className={cn("h-3.5 w-3.5", fav ? "fill-accent text-accent" : "text-muted-foreground")} />
      </button>
    </div>
  );
}

export { MinuteBadge as MatchMinuteBadge };
