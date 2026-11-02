import { useLiveScores } from "@/lib/live";

export function LiveTicker() {
  const games = useLiveScores();
  const row = [...games, ...games];
  return (
    <div className="overflow-hidden border-y border-border bg-card">
      <div className="flex w-max animate-ticker gap-6 py-2 text-xs">
        {row.map((g, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            <span className="text-muted-foreground">{g.league}</span>
            <span>{g.home}</span>
            <b className="text-primary">{g.hs}-{g.as}</b>
            <span>{g.away}</span>
            <span className="text-accent">{g.minute}'</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function LiveBoard() {
  const games = useLiveScores();
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Dados de demonstração — ligação à API-Sports em breve.</p>
      {games.map((g) => (
        <div key={g.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{g.league}</p>
            <p className="truncate text-sm font-semibold">{g.home} <span className="text-muted-foreground">vs</span> {g.away}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold text-primary">{g.hs} - {g.as}</p>
            <p className="text-xs text-accent">● {g.minute}'</p>
          </div>
        </div>
      ))}
    </div>
  );
}
