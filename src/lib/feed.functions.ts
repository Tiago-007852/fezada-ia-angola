import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  feedAvailable,
  fetchGameDetail,
  fetchUpcomingOdds,
  fetchStandings,
  type GameDetail,
  type LeagueStanding,
  type UpcomingWithOdds,
} from "./feed.server";

export const getFeedStatus = createServerFn({ method: "GET" }).handler(async () => ({
  available: feedAvailable(),
}));

function isDateISO(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export const getUpcomingOdds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: string) => {
    if (!isDateISO(d)) throw new Error("Data inválida (AAAA-MM-DD)");
    return d;
  })
  .handler(
    async ({ data }): Promise<{ date: string; games: UpcomingWithOdds[]; demo: boolean }> => {
      const games = await fetchUpcomingOdds(data);
      if (!games) return { date: data, games: [], demo: true };
      return { date: data, games, demo: false };
    },
  );

export const getGameDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: string) => {
    if (!/^\d+$/.test(d)) throw new Error("ID de jogo inválido");
    return d;
  })
  .handler(async ({ data }): Promise<{ detail: GameDetail | null; demo: boolean }> => {
    const detail = await fetchGameDetail(data);
    return { detail, demo: !detail };
  });

export const getStandings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { leagueId: number; season: number }) => {
    const leagueId = Number(d.leagueId);
    const season = Number(d.season);
    if (!Number.isInteger(leagueId) || !Number.isInteger(season))
      throw new Error("Liga/temporada inválidas");
    return { leagueId, season };
  })
  .handler(async ({ data }): Promise<{ standings: LeagueStanding | null; demo: boolean }> => {
    const standings = await fetchStandings(data.leagueId, data.season);
    return { standings, demo: !standings };
  });
