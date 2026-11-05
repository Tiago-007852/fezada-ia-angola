// Favoritos: equipas e competições guardadas no device (localStorage), sem backend.
// Também deteta golos dos seguidos enquanto o app está aberto (toast, sem notificações push).
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { LiveGame } from "@/lib/live";

const KEY = "fezada:favoritos:equipas";
const SCORES_KEY = "fezada:favoritos:placares";

type GameScore = { id: string; hs: number; as: number; status: string };

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeFavorites(list: string[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFavorites(readFavorites());
    setReady(true);
  }, []);

  const toggle = useCallback((team: string) => {
    setFavorites((prev) => {
      const next = prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team];
      writeFavorites(next);
      return next;
    });
  }, []);

  return { favorites, toggle, ready, isFavorite: (team: string) => favorites.includes(team) };
}

function readScores(): GameScore[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    return raw ? (JSON.parse(raw) as GameScore[]) : [];
  } catch {
    return [];
  }
}

/** Enquanto o app está aberto, avisa (toast) quando uma equipa seguida marca. */
export function useGoalAlerts(games: LiveGame[]) {
  const { favorites } = useFavorites();
  useEffect(() => {
    if (favorites.length === 0 || games.length === 0) return;
    const prev = new Map(readScores().map((s) => [s.id, s]));
    const followed = games.filter((g) => favorites.includes(g.home) || favorites.includes(g.away));
    let changed = false;
    for (const g of followed) {
      const old = prev.get(g.id);
      const current: GameScore = { id: g.id, hs: g.hs, as: g.as, status: g.status };
      if (old && g.status === "1H" && (g.hs > old.hs || g.as > old.as)) {
        const scoredHome = g.hs > old.hs;
        const team =
          scoredHome === favorites.includes(g.home)
            ? favorites.find((t) => t === (scoredHome ? g.home : g.away))
            : scoredHome
              ? g.home
              : g.away;
        toast.success(
          `⚽ Golo! ${team ?? (scoredHome ? g.home : g.away)} ${g.hs}-${g.as} — ${g.minute}'`,
          { duration: 8000 },
        );
      }
      if (!old || old.hs !== g.hs || old.as !== g.as || old.status !== g.status) {
        changed = true;
        prev.set(g.id, current);
      }
    }
    if (changed) {
      // Limpa histórico de jogos que já não estão em direto
      const live = new Set(games.map((g) => g.id));
      const kept = [...prev.values()].filter((s) => live.has(s.id)).slice(0, 60);
      localStorage.setItem(SCORES_KEY, JSON.stringify(kept));
    }
  });
}
