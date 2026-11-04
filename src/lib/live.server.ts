import type { LiveGame } from "./live";

export type LiveResult = { games: LiveGame[]; demo: boolean };

const API_BASE = "https://v3.football.api-sports.io";
const TTL_MS = 45_000;
const MAX_GAMES = 40;

// Cache em memória por isolado do worker — evita gastar a quota da API-Sports a cada pedido.
let cache: { at: number; data: LiveResult } | undefined;

type ApiFixture = {
  fixture: { id: number; status: { elapsed: number | null; short: string } };
  league: { id: number; name: string; logo: string; country: string };
  teams: { home: { name: string; logo: string }; away: { name: string; logo: string } };
  goals: { home: number | null; away: number | null };
};

export async function fetchLiveScores(): Promise<LiveResult> {
  const key = process.env["API_SPORTS_KEY"];
  if (!key) return { games: [], demo: true };
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const res = await fetch(`${API_BASE}/fixtures?live=all`, {
      headers: { "x-apisports-key": key },
    });
    if (!res.ok) throw new Error(`API-Sports respondeu ${res.status}`);
    const json = (await res.json()) as { response?: ApiFixture[] };
    const games: LiveGame[] = (json.response ?? []).slice(0, MAX_GAMES).map((f) => ({
      id: String(f.fixture.id),
      league: f.league.name,
      home: f.teams.home.name,
      away: f.teams.away.name,
      hs: f.goals.home ?? 0,
      as: f.goals.away ?? 0,
      minute: f.fixture.status.elapsed ?? 0,
      status: f.fixture.status.short,
      homeLogo: f.teams.home.logo,
      awayLogo: f.teams.away.logo,
      leagueLogo: f.league.logo,
      country: f.league.country,
      leagueId: f.league.id,
    }));
    const data: LiveResult = { games, demo: false };
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.error("[live] Falha na API-Sports:", e);
    return { games: [], demo: true };
  }
}
