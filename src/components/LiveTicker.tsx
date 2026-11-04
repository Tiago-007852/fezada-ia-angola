import { useMemo, useState } from "react";
import { useLiveScores, type LiveGame } from "@/lib/live";
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

function Crest({ src, alt, size = 28 }: { src?: string; alt: string; size?: number }) {
  if (!src) return <span style={{ width: size, height: size }} className="inline-block shrink-0 rounded-full bg-muted" />;
  return <img src={src} alt={alt} width={size} height={size} loading="lazy" className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

function MinuteBadge({ g }: { g: LiveGame }) {
  const running = isRunning(g.status);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", running ? "bg-accent/20 text-accent" : "bg-primary/15 text-primary")}>
      {running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
      {g.status === "HT" ? "INT" : `${g.minute}'`}
    </span>
  );
}

export function LiveTicker() {
  const { games, demo, loading } = useLiveScores();
  const row = [...games, ...games];
  return (
    <div className="overflow-hidden border-y border-border bg-card/80 backdrop-blur">
      <div className="flex w-max animate-ticker gap-3 py-2 text-xs">
        {games.length === 0 ? (
          <span className="px-4 text-muted-foreground">
            {loading ? "A carregar jogos ao vivo…" : demo ? "Resultados ao vivo indisponíveis de momento." : "Sem jogos ao vivo neste momento."}
          </span>
        ) : (
          row.map((g, i) => (
            <span key={i} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background px-3 py-1">
              <Crest src={g.homeLogo} alt={g.home} size={16} />
              <span className="font-semibold">{g.home}</span>
              <b className="font-display text-primary">{g.hs}-{g.as}</b>
              <span className="font-semibold">{g.away}</span>
              <Crest src={g.awayLogo} alt={g.away} size={16} />
              <MinuteBadge g={g} />
            </span>
          ))
        )}
      </div>
    </div>
  );
}

type Filter = "all" | "running" | "HT";

export function LiveBoard() {
  const { games, demo, loading } = useLiveScores();
  const [filter, setFilter] = useState<Filter>("all");

  const groups = useMemo(() => {
    const list = games.filter((g) => (filter === "all" ? true : filter === "HT" ? g.status === "HT" : isRunning(g.status)));
    const map = new Map<string, { name: string; country: string; logo: string; games: LiveGame[] }>();
    for (const g of list) {
      const k = `${g.leagueId}-${g.league}`;
      if (!map.has(k)) map.set(k, { name: g.league, country: g.country, logo: g.leagueLogo, games: [] });
      map.get(k)!.games.push(g);
    }
    return [...map.values()];
  }, [games, filter]);

  const counts = {
    all: games.length,
    running: games.filter((g) => isRunning(g.status)).length,
    HT: games.filter((g) => g.status === "HT").length,
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([["all", "Todos"], ["running", "A decorrer"], ["HT", "Intervalo"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", filter === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}
          >
            {label} <span className="opacity-70">{counts[id]}</span>
          </button>
        ))}
      </div>

      {demo && <p className="text-xs text-muted-foreground">Resultados ao vivo indisponíveis — a tentar ligar à API-Sports.</p>}
      {loading && <p className="text-sm text-muted-foreground">A carregar…</p>}
      {!loading && !demo && groups.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          {games.length === 0 ? "Sem jogos ao vivo neste momento. Volta daqui a pouco!" : "Nenhum jogo neste filtro."}
        </p>
      )}

      {groups.map((grp) => (
        <section key={grp.name + grp.country} className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="flex items-center gap-2 border-b border-border bg-secondary px-3 py-2">
            <Crest src={grp.logo} alt={grp.name} size={18} />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{grp.name}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{grp.country}</p>
            </div>
          </header>
          <ul className="divide-y divide-border">
            {grp.games.map((g) => (
              <li key={g.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Crest src={g.homeLogo} alt={g.home} />
                  <span className="truncate text-sm font-semibold">{g.home}</span>
                </div>
                <div className="flex min-w-[72px] flex-col items-center gap-1">
                  <span className="font-display text-xl font-extrabold tabular-nums text-primary">{g.hs} - {g.as}</span>
                  <MinuteBadge g={g} />
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{STATUS[g.status] ?? g.status}</span>
                </div>
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <span className="truncate text-right text-sm font-semibold">{g.away}</span>
                  <Crest src={g.awayLogo} alt={g.away} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
