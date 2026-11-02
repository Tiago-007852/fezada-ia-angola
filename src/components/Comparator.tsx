import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BOOKIES, MATCHES, bestBookie, bookingCode, kz, netReturn, totalOdds, type Pick, type Selection } from "@/lib/odds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const colorDot = { elephant: "bg-elephant", premier: "bg-premier", bantu: "bg-bantu" } as const;

export function Comparator() {
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
    // Sugestão: favorito de cada jogo com cotação entre 1.5 e 2.2
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
        <p className="text-sm text-muted-foreground">Toca nas cotações para montar o bilhete.</p>
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
            <p className="text-[10px] text-muted-foreground">Retorno líquido após 15% de imposto sobre o lucro. Códigos de reserva simulados. Cotações de demonstração.</p>
          </div>
        )}
      </div>
    </div>
  );
}
