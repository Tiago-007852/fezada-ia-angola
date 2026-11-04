import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { BOOKIES, MATCHES, bestBookie, bookingCode, kz, netReturn, totalOdds, type Pick, type Selection } from "@/lib/odds";
import { getUpcomingOdds } from "@/lib/feed.functions";
import { totalOddsOf } from "@/lib/ticket.shared";
import { createTicket } from "@/lib/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const colorDot = { elephant: "bg-elephant", premier: "bg-premier", bantu: "bg-bantu" } as const;

function isoToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

type RealGame = {
  fixtureId: string;
  league: string;
  home: string;
  away: string;
  kickoffISO: string;
  odds: Record<Pick, number | null>;
};

// Converte os jogos reais do dia (melhor odd disponível por pick) para o formato do comparador.
function toRealGames(games: Awaited<ReturnType<typeof getUpcomingOdds>>["games"]): RealGame[] {
  return games
    .filter((g) => g.odds.length > 0)
    .map((g) => {
      const best: Record<Pick, number | null> = { "1": null, X: null, "2": null };
      for (const b of g.odds) {
        if (b.home && (!best["1"] || b.home > best["1"])) best["1"] = b.home;
        if (b.draw && (!best.X || b.draw > best.X)) best.X = b.draw;
        if (b.away && (!best["2"] || b.away > best["2"])) best["2"] = b.away;
      }
      return { fixtureId: g.fixtureId, league: g.league, home: g.home, away: g.away, kickoffISO: g.kickoffISO, odds: best };
    })
    .filter((g) => g.odds["1"] !== null || g.odds.X !== null || g.odds["2"] !== null)
    .slice(0, 12);
}

export function Comparator() {
  const real = useQuery({
    queryKey: ["comparator-odds"],
    queryFn: () => getUpcomingOdds({ data: isoToday() }),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60_000,
  });
  const realGames = useMemo(() => (real.data && !real.data.demo ? toRealGames(real.data.games) : []), [real.data]);
  const mode: "real" | "demo" = realGames.length > 0 ? "real" : "demo";

  return mode === "real" ? (
    <RealComparator realGames={realGames} />
  ) : (
    <DemoComparator loading={real.isLoading} />
  );
}

function RealComparator({ realGames }: { realGames: RealGame[] }) {
  const [sel, setSel] = useState<Selection[]>([]);
  const [stake, setStake] = useState(1000);
  const [saving, setSaving] = useState(false);

  const suggest = () => {
    // Sugestão: favorito do jogo com odd na faixa de valor (1.6-2.4) — mantém o espírito do botão
    const picks = realGames
      .flatMap((g) => {
        const pick = (["1", "2"] as Pick[]).find((k) => g.odds[k] && g.odds[k]! >= 1.6 && g.odds[k]! <= 2.4);
        return pick ? [{ matchId: g.fixtureId, pick }] : [];
      })
      .slice(0, 4);
    setSel(picks);
    toast.success("Bilhete sugerido pelo Camarada 🔥");
  };

  const toggle = (matchId: string, pick: Pick) =>
    setSel((s) => {
      const cur = s.find((x) => x.matchId === matchId);
      if (cur?.pick === pick) return s.filter((x) => x.matchId !== matchId);
      return [...s.filter((x) => x.matchId !== matchId), { matchId, pick }];
    });

  const oddsOf = (matchId: string, pick: Pick) => realGames.find((g) => g.fixtureId === matchId)?.odds[pick] ?? null;

  const currentOdds = sel.map((s) => ({ pick: s.pick, pickKey: s.pick, odds: oddsOf(s.matchId, s.pick) ?? 0 }));
  const total = totalOddsOf(currentOdds.length > 0 ? currentOdds : [{ odds: 1, pick: "1" }]);
  const r = netReturn(stake, total);
  const validSel = sel.filter((s) => (oddsOf(s.matchId, s.pick) ?? 0) > 1);

  const saveTicket = async () => {
    if (validSel.length === 0) return;
    setSaving(true);
    try {
      const res = await createTicket({
        source: "manual",
        stake,
        selections: validSel.flatMap((s) => {
          const g = realGames.find((x) => x.fixtureId === s.matchId);
          if (!g) return [];
          return [
            {
              fixtureId: s.matchId,
              home: g.home,
              away: g.away,
              kickoff: g.kickoffISO,
              league: g.league,
              pick: s.pick,
              odds: g.odds[s.pick] ?? 0,
            },
          ];
        }),
      });
      if (!res.ok) throw new Error(res.error ?? "Falha ao guardar");
      toast.success("Bilhete guardado na tua conta! Vês-o na aba Palpites.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Jogos de hoje com odds reais do feed.</p>
        <Button size="sm" variant="secondary" onClick={suggest}>Sugerir bilhete</Button>
      </div>

      <div className="space-y-2">
        {realGames.map((g) => {
          const pick = sel.find((s) => s.matchId === g.fixtureId)?.pick;
          return (
            <div key={g.fixtureId} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>{g.league}</span>
                <span>{new Date(g.kickoffISO).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className="mb-2 text-sm font-semibold">{g.home} vs {g.away}</p>
              <div className="grid grid-cols-3 gap-2">
                {(["1", "X", "2"] as Pick[]).map((k) => {
                  const odd = g.odds[k];
                  const top = odd ?? 0;
                  return (
                    <button
                      key={k}
                      disabled={!odd}
                      onClick={() => toggle(g.fixtureId, k)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-40",
                        pick === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary",
                      )}
                    >
                      <span className="font-bold">{k}</span>
                      <span className="float-right font-semibold">{odd ? top.toFixed(2) : "–"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-16 space-y-3 rounded-xl border border-primary/40 bg-card p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Bilhete ({sel.length})</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Aposta</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              className="h-8 w-28"
            />
            <span className="text-xs">Kz</span>
          </div>
        </div>
        {sel.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ainda sem seleções.</p>
        ) : (
          <div className="space-y-2">
            <div className="rounded-md border border-primary p-2 text-xs">
              <p className="font-semibold text-primary">Melhor odd de referência (feed)</p>
              <p className="text-muted-foreground">Odd {total.toFixed(2)} · Líquido <b className="text-foreground">{kz(r.net)}</b></p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={saving || validSel.length === 0}
                onClick={saveTicket}
              >
                <span className="mr-1">💾</span> {saving ? "A guardar…" : "Guardar bilhete"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const text = validSel
                    .map((s) => {
                      const g = realGames.find((x) => x.fixtureId === s.matchId);
                      return g ? `${g.home} vs ${g.away}: ${s.pick} @ ${g.odds[s.pick]?.toFixed(2)}` : "";
                    })
                    .filter(Boolean)
                    .join("\n");
                  navigator.clipboard?.writeText(`Bilhete Fezada IA (${total.toFixed(2)}, aposta ${stake} Kz):\n${text}`);
                  toast.success("Bilhete copiado — colas na casa que escolheres");
                }}
              >
                <Copy className="mr-1 h-4 w-4" /> Copiar
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Odds reais do feed (melhor odd por pick). Retorno líquido após 15% de imposto sobre o lucro. Não há códigos de reserva gerados: colas as seleções diretamente na tua casa.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DemoComparator({ loading }: { loading: boolean }) {
  const [sel, setSel] = useState<Selection[]>([]);
  const [stake, setStake] = useState(1000);
  const best = useMemo(() => bestBookie(sel), [sel]);

  const toggle = (matchId: string, pick: Pick) =>
    setSel((s) => {
      const cur = s.find((x) => x.matchId === matchId);
      if (cur?.pick === pick) return s.filter((x) => x.matchId !== matchId);
      return [...s.filter((x) => x.matchId !== matchId), { matchId, pick }];
    });

  const suggest = () => {
    const picks = MATCHES.flatMap((m) => {
      const o = m.odds.elephant;
      const p = (["1", "2"] as Pick[]).find((k) => o[k] >= 1.5 && o[k] <= 2.2);
      return p ? [{ matchId: m.id, pick: p }] : [];
    }).slice(0, 4);
    setSel(picks);
    toast.success("Bilhete sugerido pelo Camarada 🔥");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {loading ? "A tentar ligar ao feed real…" : "Feed indisponível — cotações de demonstração."}
          <RefreshCw className="mb-0.5 ml-1 inline h-3 w-3" />
        </p>
        <Button size="sm" variant="secondary" onClick={suggest}>Sugerir bilhete</Button>
      </div>

      <div className="space-y-2">
        {MATCHES.map((m) => {
          const pick = sel.find((s) => s.matchId === m.id)?.pick;
          return (
            <div key={m.id} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>{m.league}</span><span>{m.kickoff}</span>
              </div>
              <p className="mb-2 text-sm font-semibold">{m.home} vs {m.away}</p>
              <div className="grid grid-cols-3 gap-2">
                {(["1", "X", "2"] as Pick[]).map((k) => {
                  const top = Math.max(...BOOKIES.map((b) => m.odds[b.id][k]));
                  return (
                    <button
                      key={k}
                      onClick={() => toggle(m.id, k)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                        pick === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary",
                      )}
                    >
                      <span className="font-bold">{k}</span>
                      <span className="float-right font-semibold">{top.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-16 space-y-3 rounded-xl border border-primary/40 bg-card p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Bilhete ({sel.length})</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Aposta</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              className="h-8 w-28"
            />
            <span className="text-xs">Kz</span>
          </div>
        </div>
        {sel.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ainda sem seleções.</p>
        ) : (
          <div className="space-y-2">
            {BOOKIES.map((b) => {
              const odds = totalOdds(sel, b.id);
              const r = netReturn(stake, odds);
              const code = bookingCode(b.id, sel);
              return (
                <div key={b.id} className={cn("flex items-center gap-2 rounded-md border p-2 text-xs", best === b.id ? "border-primary" : "border-border")}>
                  <span className={cn("h-2 w-2 rounded-full", colorDot[b.id])} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{b.name} {best === b.id && <span className="text-primary">· melhor</span>}</p>
                    <p className="text-muted-foreground">Odd {odds.toFixed(2)} · Líquido <b className="text-foreground">{kz(r.net)}</b></p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(code);
                      toast.success(`Código ${code} copiado`);
                    }}
                    className="rounded bg-secondary px-2 py-1 font-mono text-[11px]"
                  >
                    {code}
                  </button>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground">Retorno líquido após 15% de imposto sobre o lucro. Códigos de reserva simulados. Cotações de demonstração — compara direto na casa.</p>
          </div>
        )}
      </div>
    </div>
  );
}
