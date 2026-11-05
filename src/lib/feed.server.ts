// Feed de dados de futebol para além do "ao vivo": jogos agendados, odds, detalhe,
// eventos, estatísticas, H2H, classificações e previsões da API-Sports.
// Tudo com fallback honesto: sem chave/API → devolve null/flag e o UI mostra o aviso.

import { apiSports, hasApiKey } from "./api.server";

export type UpcomingFixture = {
  fixtureId: string;
  league: string;
  leagueId: number;
  leagueLogo: string;
  country: string;
  home: string;
  homeId: number;
  homeLogo: string;
  away: string;
  awayId: number;
  awayLogo: string;
  kickoffISO: string;
  status: string;
};

export type BookieOdds = {
  bookie: string; // nome do bookmaker na API-Sports
  home: number | null;
  draw: number | null;
  away: number | null;
};

export type UpcomingWithOdds = UpcomingFixture & {
  odds: BookieOdds[]; // mercado 1X2 por bookmaker disponível
};

type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  league: { id: number; name: string; logo: string; country: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
};

type ApiOdds = {
  fixture: { id: number };
  bookmakers: {
    id: number;
    name: string;
    bets: { id: number; name: string; values: { value: string; odd: string }[] }[];
  }[];
};

export function feedAvailable(): boolean {
  return hasApiKey();
}

export async function fetchUpcoming(dateISO: string): Promise<UpcomingFixture[] | null> {
  const data = await apiSports<ApiFixture>("/fixtures", { date: dateISO }, 5 * 60_000);
  if (!data || data.length === 0) return null;
  return data.slice(0, 60).map((f) => ({
    fixtureId: String(f.fixture.id),
    league: f.league.name,
    leagueId: f.league.id,
    leagueLogo: f.league.logo,
    country: f.league.country,
    home: f.teams.home.name,
    homeId: f.teams.home.id,
    homeLogo: f.teams.home.logo,
    away: f.teams.away.name,
    awayId: f.teams.away.id,
    awayLogo: f.teams.away.logo,
    kickoffISO: f.fixture.date,
    status: f.fixture.status.short,
  }));
}

export async function fetchUpcomingOdds(dateISO: string): Promise<UpcomingWithOdds[] | null> {
  const fixtures = await fetchUpcoming(dateISO);
  if (!fixtures) return null;
  const oddsRows = await apiSports<ApiOdds>("/odds", { date: dateISO, bookmaker: 8 }, 10 * 60_000);
  if (!oddsRows || oddsRows.length === 0) return fixtures.map((f) => ({ ...f, odds: [] }));

  const byId = new Map<string, BookieOdds[]>();
  for (const row of oddsRows) {
    const bookie = row.bookmakers?.[0];
    const bet = bookie?.bets?.find((b) => b.name === "Match Winner");
    if (!bookie || !bet) continue;
    const v = (name: string) => {
      const found = bet.values.find((x) => x.value === name);
      const n = found ? parseFloat(found.odd) : NaN;
      return Number.isFinite(n) && n > 1 ? n : null;
    };
    const entry: BookieOdds = {
      bookie: bookie.name ?? "Bet365",
      home: v("Home"),
      draw: v("Draw"),
      away: v("Away"),
    };
    const list = byId.get(String(row.fixture.id)) ?? [];
    list.push(entry);
    byId.set(String(row.fixture.id), list);
  }
  // Prioriza as ligas que o app cobre e os jogos com odds disponíveis.
  const prefer = [
    "Premier League",
    "Primeira Liga",
    "UEFA Champions League",
    "CAF Champions League",
    "Liga dos Campeões",
    "Girabola",
    "Taça de Angola",
  ];
  return fixtures
    .map((f) => ({ ...f, odds: byId.get(f.fixtureId) ?? [] }))
    .sort((a, b) => {
      const pa = a.odds.length > 0 ? 0 : 1;
      const pb = b.odds.length > 0 ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const la = prefer.findIndex((n) => a.league === n);
      const lb = prefer.findIndex((n) => b.league === n);
      return (
        (la === -1 ? 99 : la) - (lb === -1 ? 99 : lb) || a.kickoffISO.localeCompare(b.kickoffISO)
      );
    });
}

// Tipos para /fixtures?id= (detalhe + eventos + estatísticas)
export type FixtureDetail = {
  fixtureId: string;
  league: string;
  leagueId: number;
  leagueLogo: string;
  country: string;
  season: number;
  home: string;
  homeLogo: string;
  away: string;
  awayLogo: string;
  kickoffISO: string;
  status: string;
  statusLong: string;
  minute: number | null;
  hs: number | null;
  as: number | null;
};

export type FixtureEvent = {
  minute: number | null;
  team: "home" | "away";
  player: string | null;
  assist: string | null;
  detail: string;
  type: string;
};

export type FixtureStats = {
  stat: string;
  home: string | number | null;
  away: string | number | null;
};

export type H2HGame = {
  fixtureId: string;
  league: string;
  home: string;
  away: string;
  hs: number | null;
  as: number | null;
  kickoffISO: string;
  winner: "home" | "away" | "draw" | null;
};

export type Lineup = {
  formation: string | null;
  coach: string | null;
  startXI: { player: string; pos: string | null }[];
};

export type GameDetail = {
  fixture: FixtureDetail;
  events: FixtureEvent[];
  stats: FixtureStats[];
  h2h: H2HGame[];
  homeLineup: Lineup | null;
  awayLineup: Lineup | null;
};

type ApiEvent = {
  time: { elapsed: number | null };
  team: { id: number };
  player: { name: string | null } | null;
  assist: { name: string | null } | null;
  detail: string;
  type: string;
};

type ApiDetailFixture = ApiFixture & {
  fixture: ApiFixture["fixture"] & {
    status: { short: string; long: string; elapsed: number | null };
  };
  season: number;
  score: { fulltime: { home: number | null; away: number | null } };
};

type TeamStatsRow = {
  teams: { id: number; name: string }[];
  statistics: { type: string; value: string | number | null }[];
};

type ApiLineup = {
  team: { id: number; name: string };
  formation: string | null;
  coach: { name: string | null } | null;
  startXI: { player: { name: string; grid?: string | null } }[];
};

export async function fetchGameDetail(fixtureId: string): Promise<GameDetail | null> {
  const fx = await apiSports<ApiDetailFixture>("/fixtures", { id: fixtureId }, 30_000);
  if (!fx || fx.length === 0) return null;
  const f = fx[0]!;
  const homeId = f.teams.home.id;
  // events, stats, h2h e escalações; cada pedido tolera falha
  const [ev, st, h2h, lineupsRows] = await Promise.all([
    apiSports<ApiEvent>("/fixtures/events", { fixture: fixtureId }, 30_000),
    apiSports<TeamStatsRow>("/fixtures/statistics", { fixture: fixtureId }, 30_000),
    apiSports<ApiDetailFixture>(
      "/fixtures/headtohead",
      { h2h: `${f.teams.home.id}-${f.teams.away.id}`, last: 5 },
      60_000,
    ),
    apiSports<ApiLineup>("/fixtures/lineups", { fixture: fixtureId }, 60_000),
  ]);

  const events: FixtureEvent[] = (ev ?? []).map((e) => ({
    minute: e.time.elapsed,
    team: e.team.id === homeId ? "home" : "away",
    player: e.player?.name ?? null,
    assist: e.assist?.name ?? null,
    detail: e.detail,
    type: e.type,
  }));

  // A API devolve uma linha por equipa com o mesmo tipo de estatística; emparelhamos por tipo.
  const stats: FixtureStats[] = [];
  if (st && st.length > 0) {
    const homeRow = st.find((row) => row.teams.some((t) => t.id === homeId)) ?? st[0];
    if (homeRow) {
      const awayRow = st.find((row) => row !== homeRow);
      const awayByType = new Map((awayRow?.statistics ?? []).map((s) => [s.type, s.value]));
      for (const s of homeRow.statistics) {
        stats.push({ stat: s.type, home: s.value, away: awayByType.get(s.type) ?? null });
      }
      for (const s of awayRow?.statistics ?? []) {
        if (!homeRow.statistics.some((h) => h.type === s.type))
          stats.push({ stat: s.type, home: null, away: s.value });
      }
    }
  }

  const h2hGames: H2HGame[] = (h2h ?? []).map((g) => {
    const w = g.score?.fulltime;
    const hw = w?.home ?? null;
    const aw = w?.away ?? null;
    let winner: H2HGame["winner"] = null;
    if (hw !== null && aw !== null) winner = hw > aw ? "home" : hw < aw ? "away" : "draw";
    return {
      fixtureId: String(g.fixture.id),
      league: g.league.name,
      home: g.teams.home.name,
      away: g.teams.away.name,
      hs: hw,
      as: aw,
      kickoffISO: g.fixture.date,
      winner,
    };
  });

  const extract = (t: ApiLineup | undefined): Lineup | null =>
    t
      ? {
          formation: t.formation,
          coach: t.coach?.name ?? null,
          startXI: (t.startXI ?? []).slice(0, 11).map((p) => ({
            player: p.player.name,
            pos: p.player.grid ? p.player.grid.split(":")[0]! : null,
          })),
        }
      : null;

  return {
    fixture: {
      fixtureId: String(f.fixture.id),
      league: f.league.name,
      leagueId: f.league.id,
      leagueLogo: f.league.logo,
      country: f.league.country,
      season: f.season,
      home: f.teams.home.name,
      homeLogo: f.teams.home.logo,
      away: f.teams.away.name,
      awayLogo: f.teams.away.logo,
      kickoffISO: f.fixture.date,
      status: f.fixture.status.short,
      statusLong: f.fixture.status.long,
      minute: f.fixture.status.elapsed,
      hs: f.score?.fulltime?.home ?? null,
      as: f.score?.fulltime?.away ?? null,
    },
    events,
    stats,
    h2h: h2hGames,
    homeLineup: extract(lineupsRows?.[0]),
    awayLineup: extract(lineupsRows?.[1]),
  };
}

// Classificações
export type StandingRow = {
  rank: number;
  team: string;
  teamLogo: string;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: string | null;
};

export type LeagueStanding = {
  leagueId: number;
  league: string;
  country: string;
  logo: string;
  season: number;
  groups: { name: string; rows: StandingRow[] }[];
};

type ApiStandings = {
  league: { id: number; name: string; country: string; logo: string; season: number };
  standings: { name: string; update: string } & {
    rank: number;
    team: { name: string; logo: string };
    all: {
      played: number;
      win: number;
      draw: number;
      lose: number;
      goals: { for: number; against: number };
    };
    points: number;
    form: string | null;
  }[];
};

export async function fetchStandings(
  leagueId: number,
  season: number,
): Promise<LeagueStanding | null> {
  const data = await apiSports<ApiStandings>(
    "/standings",
    { league: leagueId, season },
    10 * 60_000,
  );
  const root = data?.[0];
  if (!root?.standings) return null;
  const raw = root.standings as unknown as {
    name: string;
    rank: number;
    team: { name: string; logo: string };
    all: {
      played: number;
      win: number;
      draw: number;
      lose: number;
      goals: { for: number; against: number };
    };
    points: number;
    form: string | null;
  }[];
  const groups = new Map<string, StandingRow[]>();
  for (const r of raw) {
    const g = (r as { name?: string }).name ?? "Classificação";
    const rows = groups.get(g) ?? [];
    rows.push({
      rank: r.rank,
      team: r.team.name,
      teamLogo: r.team.logo,
      played: r.all.played,
      win: r.all.win,
      draw: r.all.draw,
      lose: r.all.lose,
      goalsFor: r.all.goals.for,
      goalsAgainst: r.all.goals.against,
      points: r.points,
      form: r.form,
    });
    groups.set(g, rows);
  }
  return {
    leagueId: root.league.id,
    league: root.league.name,
    country: root.league.country,
    logo: root.league.logo,
    season: root.league.season,
    groups: [...groups.entries()].map(([name, rows]) => ({ name, rows })),
  };
}

// Formas recentes de uma equipa (últimos 5), para o contexto de palpites
export async function fetchTeamForm(
  teamId: number,
  leagueId: number | null,
  season: number,
): Promise<string | null> {
  const data = await apiSports<ApiDetailFixture>(
    "/fixtures",
    leagueId
      ? { team: teamId, league: leagueId, season, last: 5 }
      : { team: teamId, season, last: 5 },
    10 * 60_000,
  );
  const games = data ?? [];
  if (games.length === 0) return null;
  return games
    .map((g): string | null => {
      const hs = g.score?.fulltime?.home ?? null;
      const as = g.score?.fulltime?.away ?? null;
      if (hs === null || as === null) return null;
      const isHome = g.teams.home.id === teamId;
      const gf = isHome ? hs : as;
      const ga = isHome ? as : hs;
      return gf > ga ? "V" : gf < ga ? "D" : "E";
    })
    .filter((x): x is string => typeof x === "string")
    .reverse()
    .join("");
}

// Previsões da API-Sports (input para a pipeline de palpites)
export type ApiPrediction = {
  percentHome: number | null;
  percentDraw: number | null;
  percentAway: number | null;
  advice: string | null;
  goalsComparison: { total: string; home: string; away: string };
  last5Form: { home: string | null; away: string | null };
};

type ApiPredResponse = {
  predictions: {
    percent: { home: string; draw: string | undefined; away: string };
    advice: string | null;
    goals: { home: string | null; away: string | null };
    total?: unknown;
  };
  teams: Record<string, unknown>;
  comparison: { total: { home: string; away: string } };
  league: unknown;
  teams_meta?: unknown;
};

export async function fetchPrediction(fixtureId: string): Promise<ApiPrediction | null> {
  const data = await apiSports<ApiPredResponse>(
    "/predictions",
    { fixture: fixtureId },
    10 * 60_000,
  );
  const main = data?.[0];
  if (!main?.predictions) return null;
  const pct = (s: string | undefined) => {
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };
  const tt = (
    main as unknown as {
      predictions: ApiPredResponse["predictions"];
      teams?: { home?: { last_5_form?: string | null }; away?: { last_5_form?: string | null } };
    }
  ).teams;
  void main.comparison;
  return {
    percentHome: pct(main.predictions.percent.home),
    percentDraw: pct(main.predictions.percent.draw),
    percentAway: pct(main.predictions.percent.away),
    advice: main.predictions.advice ?? null,
    goalsComparison: {
      total: String(main.predictions.total ?? ""),
      home: main.predictions.goals.home ?? "",
      away: main.predictions.goals.away ?? "",
    },
    last5Form: { home: tt?.home?.last_5_form ?? null, away: tt?.away?.last_5_form ?? null },
  };
}

// ---- Validação server-side de bilhetes manuais -------------------------------------------

export type FixtureMeta = {
  fixtureId: string;
  home: string;
  away: string;
  league: string;
  kickoffISO: string;
  status: string;
};

/** Dados oficiais dos jogos (nomes, liga, hora, estado) — não confiar no que o cliente envia. */
export async function fetchFixtureMetas(ids: string[]): Promise<Map<string, FixtureMeta> | null> {
  const unique = [...new Set(ids)].slice(0, 20);
  if (unique.length === 0) return new Map();
  const data = await apiSports<ApiFixture>("/fixtures", { ids: unique.join("-") }, 60_000);
  if (!data) return null;
  return new Map(
    data.map((f) => [
      String(f.fixture.id),
      {
        fixtureId: String(f.fixture.id),
        home: f.teams.home.name,
        away: f.teams.away.name,
        league: f.league.name,
        kickoffISO: f.fixture.date,
        status: f.fixture.status.short,
      },
    ]),
  );
}

/** Melhor odd 1X2 disponível entre todos os bookmakers do feed para um jogo. */
export async function fetchBestOdds1X2(
  fixtureId: string,
): Promise<Record<"1" | "X" | "2", number | null> | null> {
  const rows = await apiSports<ApiOdds>("/odds", { fixture: fixtureId }, 5 * 60_000);
  if (!rows) return null;
  const best: Record<"1" | "X" | "2", number | null> = { "1": null, X: null, "2": null };
  const map: Record<string, "1" | "X" | "2"> = { Home: "1", Draw: "X", Away: "2" };
  for (const row of rows) {
    for (const bk of row.bookmakers ?? []) {
      const bet = bk.bets?.find((b) => b.name === "Match Winner");
      for (const v of bet?.values ?? []) {
        const key = map[v.value];
        const n = parseFloat(v.odd);
        if (key && Number.isFinite(n) && n > 1 && (best[key] === null || n > best[key]!))
          best[key] = n;
      }
    }
  }
  return best;
}
