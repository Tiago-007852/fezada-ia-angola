import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, startOfWeek } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Star, Table2 } from "lucide-react";
import { toast } from "sonner";
import { getUpcomingOdds, getStandings } from "@/lib/feed.functions";
import { useFavorites } from "@/lib/favorites";
import { cn } from "@/lib/utils";

type UpcomingGame = Awaited<ReturnType<typeof getUpcomingOdds>>["games"][number];
type Prediction = NonNullable<UpcomingGame["prediction"]>;

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
  NS: "Agendado",
  TBD: "A definir",
  FT: "Terminado",
  AET: "Após prolongamento",
  PEN: "Após penáltis",
  PST: "Adiado",
  CANC: "Cancelado",
  ABD: "Abandonado",
  AWD: "Atribuído",
  WO: "Falta de comparência",
};

const PICK_LABEL: Record<Prediction["pick"], string> = {
  "1": "Casa vence",
  X: "Empate",
  "2": "Fora vence",
};

function isLive(s: string) {
  return s === "1H" || s === "2H" || s === "ET" || s === "LIVE" || s === "P" || s === "HT";
}

function isFinished(s: string) {
  return s === "FT" || s === "AET" || s === "PEN";
}

export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const tzMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzMs).toISOString().slice(0, 10);
}

function isoOf(d: Date): string {
  const tzMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzMs).toISOString().slice(0, 10);
}

export function Crest({
  src,
  alt,
  size = 28,
}: {
  src: string | undefined;
  alt: string;
  size?: number;
}) {
  if (!src)
    return (
      <span
        style={{ width: size, height: size }}
        className="inline-block shrink-0 rounded-full bg-muted"
      />
    );
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

type DayTab = "all" | "live" | "tips";

function weekDays(weekOffset: number) {
  const start = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const weekday = d
      .toLocaleDateString("pt-AO", { weekday: "short" })
      .replace(".", "")
      .slice(0, 3)
      .toUpperCase();
    const month = d
      .toLocaleDateString("pt-AO", { month: "short" })
      .replace(".", "")
      .slice(0, 3)
      .toUpperCase();
    return { iso: isoOf(d), weekday, day: String(d.getDate()).padStart(2, "0"), month };
  });
}

export function MatchCenter() {
  const today = isoDate(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(today);
  const [filter, setFilter] = useState<DayTab>("all");
  const days = useMemo(() => weekDays(weekOffset), [weekOffset]);

  const dayLabel = new Date(selected + "T12:00:00").toLocaleDateString("pt-AO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-stretch">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label="Semana anterior"
            className="px-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="grid flex-1 grid-cols-7">
            {days.map((d) => {
              const isToday = d.iso === today;
              const active = d.iso === selected;
              return (
                <button
                  key={d.iso}
                  onClick={() => setSelected(d.iso)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 border-b-2 py-2",
                    active
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-secondary/40",
                  )}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wide">{d.weekday}</span>
                  <span
                    className={cn(
                      "font-display text-base font-extrabold tabular-nums",
                      active ? "text-primary" : "text-foreground",
                    )}
                  >
                    {d.day}
                  </span>
                  <span className="text-[9px] uppercase tracking-wide">{d.month}</span>
                  <span
                    className={cn("h-1 w-1 rounded-full", isToday ? "bg-accent" : "bg-transparent")}
                  />
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            aria-label="Semana seguinte"
            className="px-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {dayLabel}
        </p>
        {selected !== today && (
          <button
            onClick={() => setSelected(today)}
            className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold text-primary"
          >
            Hoje
          </button>
        )}
      </div>

      <DayPanel date={selected} filter={filter} setFilter={setFilter} />
    </div>
  );
}

function bestOdds(g: UpcomingGame): {
  home: number | null;
  draw: number | null;
  away: number | null;
} {
  const best: { home: number | null; draw: number | null; away: number | null } = {
    home: null,
    draw: null,
    away: null,
  };
  for (const b of g.odds) {
    if (b.home && (!best.home || b.home > best.home)) best.home = b.home;
    if (b.draw && (!best.draw || b.draw > best.draw)) best.draw = b.draw;
    if (b.away && (!best.away || b.away > best.away)) best.away = b.away;
  }
  return best;
}

const LEAGUE_ORDER = [
  "Girabola",
  "Taça de Angola",
  "CAF Champions League",
  "CAF Confederation Cup",
  "UEFA Champions League",
  "UEFA Europa League",
  "Primeira Liga",
  "Liga Portugal",
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
];

function leagueRank(name: string): number {
  const idx = LEAGUE_ORDER.findIndex((n) => name.toLowerCase().includes(n.toLowerCase()));
  return idx === -1 ? 99 : idx;
}

function groupByLeague(games: UpcomingGame[]) {
  const map = new Map<
    string,
    {
      key: string;
      leagueId: number;
      name: string;
      country: string;
      logo: string;
      games: UpcomingGame[];
    }
  >();
  for (const g of games) {
    const key = `${g.leagueId}-${g.league}`;
    if (!map.has(key))
      map.set(key, {
        key,
        leagueId: g.leagueId,
        name: g.league,
        country: g.country,
        logo: g.leagueLogo,
        games: [],
      });
    map.get(key)!.games.push(g);
  }
  return [...map.values()]
    .sort((a, b) => leagueRank(a.name) - leagueRank(b.name) || a.name.localeCompare(b.name))
    .map((grp) => ({
      ...grp,
      games: grp.games.sort((a, b) => a.kickoffISO.localeCompare(b.kickoffISO)),
    }));
}

function DayPanel({
  date,
  filter,
  setFilter,
}: {
  date: string;
  filter: DayTab;
  setFilter: (f: DayTab) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["upcoming-odds", date],
    queryFn: () => getUpcomingOdds({ data: date }),
    enabled: typeof window !== "undefined",
    refetchInterval: date === isoDate(0) ? 60_000 : false,
  });
  const { isFavorite, toggle } = useFavorites();

  const games = useMemo(() => data?.games ?? [], [data]);
  const counts = useMemo(
    () => ({
      all: games.length,
      live: games.filter((g) => isLive(g.status)).length,
      tips: games.filter((g) => g.prediction).length,
    }),
    [games],
  );

  const groups = useMemo(() => {
    const list =
      filter === "live"
        ? games.filter((g) => isLive(g.status))
        : filter === "tips"
          ? games.filter((g) => g.prediction)
          : games;
    return groupByLeague(list);
  }, [games, filter]);

  const kickoffLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["all", "Todos"],
            ["live", "Ao vivo"],
            ["tips", "Com palpite"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
              filter === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {label} <span className="opacity-70">{counts[id]}</span>
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">A carregar jogos…</p>}
      {data?.demo && !isLoading && (
        <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          O feed de jogos/odds está indisponível agora. As cotações usadas no comparador são de
          demonstração.
        </p>
      )}
      {!isLoading && data && !data.demo && groups.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          {games.length === 0 ? "Sem jogos neste dia na base." : "Nenhum jogo neste filtro."}
        </p>
      )}

      {groups.map((grp) => {
        const season = grp.games[0]?.kickoffISO
          ? new Date(grp.games[0].kickoffISO).getMonth() < 6
            ? new Date(grp.games[0].kickoffISO).getFullYear() - 1
            : new Date(grp.games[0].kickoffISO).getFullYear()
          : new Date().getFullYear();
        return (
          <LeagueCard
            key={grp.key}
            logo={grp.logo}
            name={grp.name}
            country={grp.country}
            count={grp.games.length}
            withStandings={data && !data.demo ? { leagueId: grp.leagueId, season } : undefined}
          >
            {grp.games.map((g) => {
              const odds = bestOdds(g);
              const hasOdds = odds.home || odds.draw || odds.away;
              const showScore =
                (isLive(g.status) || isFinished(g.status)) && g.hs !== null && g.as !== null;
              return (
                <li key={g.fixtureId}>
                  <Link to="/game/$id" params={{ id: g.fixtureId }} className="block px-3 py-2.5">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <TeamCell
                        logo={g.homeLogo}
                        name={g.home}
                        fav={isFavorite(g.home)}
                        onFav={() => toggle(g.home)}
                        alignRight
                      />
                      <div className="flex min-w-[58px] flex-col items-center gap-0.5">
                        {showScore ? (
                          <>
                            <span
                              className={cn(
                                "font-display text-base font-extrabold tabular-nums",
                                isLive(g.status) ? "text-accent" : "text-foreground",
                              )}
                            >
                              {g.hs} - {g.as}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                                isLive(g.status)
                                  ? "bg-accent/15 text-accent"
                                  : "bg-secondary text-muted-foreground",
                              )}
                            >
                              {g.status === "HT"
                                ? "INT"
                                : isLive(g.status)
                                  ? `${g.minute ?? 0}'`
                                  : "Fim"}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-bold tabular-nums">
                              {kickoffLabel(g.kickoffISO)}
                            </span>
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                              {STATUS[g.status] ?? g.status}
                            </span>
                          </>
                        )}
                      </div>
                      <TeamCell
                        logo={g.awayLogo}
                        name={g.away}
                        fav={isFavorite(g.away)}
                        onFav={() => toggle(g.away)}
                      />
                    </div>
                    {(g.prediction || hasOdds) && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {g.prediction && (
                          <span
                            title={g.prediction.advice ?? undefined}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                          >
                            Palpite: {PICK_LABEL[g.prediction.pick]}{" "}
                            <b className="tabular-nums">{g.prediction.confidence}%</b>
                          </span>
                        )}
                        {hasOdds && (
                          <span className="ml-auto shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
                            {odds.home?.toFixed(2) ?? "–"} / {odds.draw?.toFixed(2) ?? "–"} /{" "}
                            {odds.away?.toFixed(2) ?? "–"}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </LeagueCard>
        );
      })}
    </div>
  );
}

// ============================= Cartão de liga + tabela =============================

function LeagueCard({
  logo,
  name,
  country,
  count,
  children,
  withStandings,
}: {
  logo: string | undefined;
  name: string;
  country: string;
  count: number;
  children: React.ReactNode;
  withStandings?: { leagueId: number; season: number } | undefined;
}) {
  const [show, setShow] = useState(false);
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border bg-secondary px-3 py-2">
        <Crest src={logo} alt={name} size={18} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase tracking-wide">{name}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{country}</p>
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground">{count}</span>
      </header>
      {withStandings && (
        <button
          onClick={() => setShow((s) => !s)}
          className="flex w-full items-center gap-1 border-b border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground"
        >
          <Table2 className="h-3.5 w-3.5" />
          {show ? "Esconder" : "Classificação"}
          {show ? (
            <ChevronDown className="ml-auto h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="ml-auto h-3.5 w-3.5" />
          )}
        </button>
      )}
      {withStandings && show && (
        <StandingsSection leagueId={withStandings.leagueId} season={withStandings.season} />
      )}
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
  if (isLoading)
    return <p className="px-3 py-2 text-[11px] text-muted-foreground">A carregar a tabela…</p>;
  if (error || !data?.standings) {
    return (
      <p className="px-3 py-2 text-[11px] text-muted-foreground">
        A tabela estará disponível assim que o feed responder.
      </p>
    );
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
            <td className="flex items-center gap-1.5 py-1">
              <Crest src={r.teamLogo} alt={r.team} size={14} />{" "}
              <span className="truncate">{r.team}</span>
            </td>
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

export function TeamCell({
  logo,
  name,
  fav,
  onFav,
  alignRight,
}: {
  logo: string | undefined;
  name: string;
  fav: boolean;
  onFav: () => void;
  alignRight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5",
        alignRight && "flex-row-reverse justify-start",
      )}
    >
      <Crest src={logo} alt={name} />
      <span className={cn("truncate text-sm font-semibold", alignRight && "text-left")}>
        {name}
      </span>
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
        <Star
          className={cn("h-3.5 w-3.5", fav ? "fill-accent text-accent" : "text-muted-foreground")}
        />
      </button>
    </div>
  );
}

function MinuteBadge({ game }: { game: { status: string; minute: number } }) {
  const running = isLive(game.status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
        running ? "bg-accent/20 text-accent" : "bg-primary/15 text-primary",
      )}
    >
      {running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
      {game.status === "HT" ? "INT" : `${game.minute}'`}
    </span>
  );
}

export { MinuteBadge as MatchMinuteBadge };
