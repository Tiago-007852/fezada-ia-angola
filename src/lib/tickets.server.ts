// Lógica server-side dos bilhetes. O cliente NÃO escreve em tickets/ticket_selections (RLS só
// permite leitura): criação e liquidação passam por aqui com o service role, depois de
// autenticar o utilizador e validar tudo contra dados oficiais.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { apiSports } from "./api.server";
import { fetchBestOdds1X2, fetchFixtureMetas } from "./feed.server";
import {
  evaluateSelection,
  evaluateTicket,
  type FixtureOutcome,
  type SelResult,
} from "./settle.shared";
import { netReturn, totalOddsOf } from "./ticket.shared";

export const MAX_STAKE = 500_000;
const ODDS_TOLERANCE = 1.02; // 2% de folga face à melhor odd do feed (as odds mexem entre pedidos)
const PICKS = new Set(["1", "X", "2"]);

export type NewSelectionInput = {
  fixtureId: string;
  home: string;
  away: string;
  kickoff: string;
  league: string;
  pick: string;
  odds: number;
};

export type CreateTicketInput = {
  source: "manual" | "ai";
  stake: number;
  risk?: string;
  rationale?: string;
  selections: NewSelectionInput[];
};

export type CreateTicketOutput = { ok: boolean; error?: string; status?: number; ticket?: unknown };

/**
 * Cria um bilhete para um utilizador JÁ autenticado e ativo (ver authenticateUser).
 * `trusted` = as seleções foram geradas no servidor a partir do feed (fluxo do IA); sem isso,
 * odds, jogos e horas são verificados contra a API-Sports.
 */
export async function createTicket(
  userId: string,
  input: CreateTicketInput,
  opts: { trusted: boolean },
): Promise<CreateTicketOutput> {
  const sels = input.selections;
  if (!Array.isArray(sels) || sels.length < 1 || sels.length > 10)
    return { ok: false, error: "Bilhete precisa de 1 a 10 seleções", status: 400 };
  const stake = Number(input.stake);
  if (!Number.isFinite(stake) || stake <= 0 || stake > MAX_STAKE)
    return {
      ok: false,
      error: `Valor da aposta inválido (máx. ${MAX_STAKE.toLocaleString("pt-PT")} Kz)`,
      status: 400,
    };

  for (const s of sels) {
    if (!/^\d{1,12}$/.test(String(s.fixtureId)))
      return { ok: false, error: "Jogo inválido", status: 400 };
    if (!PICKS.has(s.pick)) return { ok: false, error: "Escolha inválida", status: 400 };
    if (!Number.isFinite(s.odds) || s.odds <= 1 || s.odds > 1000)
      return { ok: false, error: "Odds inválidas", status: 400 };
  }
  if (new Set(sels.map((s) => s.fixtureId)).size !== sels.length)
    return { ok: false, error: "Não podes repetir o mesmo jogo no bilhete", status: 400 };

  let rows = sels.map((s) => ({
    fixture_id: Number(s.fixtureId),
    home: String(s.home).slice(0, 80),
    away: String(s.away).slice(0, 80),
    kickoff: s.kickoff,
    league: String(s.league ?? "").slice(0, 80),
    market: "1X2",
    pick: s.pick,
    odds: s.odds,
  }));

  if (!opts.trusted) {
    const metas = await fetchFixtureMetas(sels.map((s) => s.fixtureId));
    if (!metas)
      return {
        ok: false,
        error: "Não foi possível validar os jogos agora. Tenta de novo.",
        status: 503,
      };
    const now = Date.now();
    const next: typeof rows = [];
    for (const s of sels) {
      const meta = metas.get(String(s.fixtureId));
      if (!meta) return { ok: false, error: "Jogo não encontrado", status: 400 };
      if (!["NS", "TBD"].includes(meta.status) || new Date(meta.kickoffISO).getTime() <= now)
        return {
          ok: false,
          error: `${meta.home} vs ${meta.away} já começou ou não aceita apostas`,
          status: 400,
        };
      const best = await fetchBestOdds1X2(s.fixtureId);
      if (!best)
        return {
          ok: false,
          error: "Não foi possível validar as cotações agora. Tenta de novo.",
          status: 503,
        };
      const real = best[s.pick as "1" | "X" | "2"];
      if (real === null || s.odds > real * ODDS_TOLERANCE)
        return {
          ok: false,
          error: `Cotação inválida ou desatualizada em ${meta.home} vs ${meta.away}`,
          status: 400,
        };
      next.push({
        fixture_id: Number(s.fixtureId),
        home: meta.home,
        away: meta.away,
        kickoff: meta.kickoffISO,
        league: meta.league,
        market: "1X2",
        pick: s.pick,
        odds: s.odds,
      });
    }
    rows = next;
  }

  const totalOdds = totalOddsOf(rows.map((r) => ({ odds: r.odds, pick: r.pick })));
  if (!(totalOdds > 1)) return { ok: false, error: "Odds inválidas", status: 400 };
  const r = netReturn(stake, totalOdds);

  const { data: ticket, error: tErr } = await supabaseAdmin
    .from("tickets")
    .insert({
      user_id: userId,
      source: opts.trusted ? input.source : "manual",
      risk: input.risk ? String(input.risk).slice(0, 30) : null,
      rationale: input.rationale ? String(input.rationale).slice(0, 2000) : null,
      stake,
      total_odds: totalOdds,
      bookie: "referência",
      net_return: r.net,
      status: "pending",
    })
    .select("*")
    .single();
  if (tErr || !ticket) return { ok: false, error: "Falha ao criar bilhete", status: 500 };

  const { error: sErr } = await supabaseAdmin
    .from("ticket_selections")
    .insert(rows.map((row) => ({ ...row, ticket_id: ticket.id })));
  if (sErr) {
    await supabaseAdmin.from("tickets").delete().eq("id", ticket.id); // não deixar bilhete órfão
    return { ok: false, error: "Falha ao guardar seleções", status: 500 };
  }
  return { ok: true, ticket };
}

type ApiFixtureResult = {
  fixture: { id: number; status: { short: string } };
  score: { fulltime: { home: number | null; away: number | null } };
};

type PendingSel = {
  id: string;
  pick: string;
  result: string | null;
  fixture_id: number;
  odds: number;
  kickoff: string | null;
};
type PendingTicket = {
  id: string;
  stake: number;
  user_id: string;
  ticket_selections: PendingSel[];
};

/**
 * Liquida bilhetes pendentes com os resultados finais da API-Sports.
 * `scope.userId` = só os bilhetes desse utilizador; `"all"` = todos (apenas para o agendador).
 */
export async function settleTickets(
  scope: { userId: string } | "all",
): Promise<{ settled: number }> {
  let q = supabaseAdmin
    .from("tickets")
    .select("id, stake, user_id, ticket_selections ( id, pick, result, fixture_id, odds, kickoff )")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(scope === "all" ? 100 : 30);
  if (scope !== "all") q = q.eq("user_id", scope.userId);
  const { data: pending } = await q;

  const tickets = (pending ?? []) as unknown as PendingTicket[];
  let settled = 0;

  for (const t of tickets) {
    const sels = t.ticket_selections ?? [];
    const open = sels.filter((s) => s.result === null || s.result === "pending");
    const resultOf = new Map<string, SelResult>(
      sels.map((s) => [s.id, (s.result ?? "pending") as SelResult]),
    );

    if (open.length > 0) {
      const ids = [...new Set(open.map((s) => s.fixture_id))].slice(0, 20);
      const results = await apiSports<ApiFixtureResult>(
        "/fixtures",
        { ids: ids.join("-") },
        60_000,
      );
      if (!results || results.length === 0) continue;
      const byId = new Map<string, FixtureOutcome>(
        results.map((f) => [
          String(f.fixture.id),
          {
            status: f.fixture.status.short,
            home: f.score.fulltime.home,
            away: f.score.fulltime.away,
          },
        ]),
      );
      for (const s of open) {
        const res = evaluateSelection(s.pick, byId.get(String(s.fixture_id)), s.kickoff);
        if (res === "pending") continue;
        resultOf.set(s.id, res);
        await supabaseAdmin.from("ticket_selections").update({ result: res }).eq("id", s.id);
      }
    }

    const outcome = evaluateTicket(
      Number(t.stake),
      sels.map((s) => ({ odds: Number(s.odds), result: resultOf.get(s.id) ?? "pending" })),
    );
    if (outcome.status === "pending") continue;
    await supabaseAdmin
      .from("tickets")
      .update({
        status: outcome.status,
        ...(outcome.status === "won" || outcome.status === "void"
          ? { net_return: outcome.netReturn }
          : {}),
        settled_at: new Date().toISOString(),
      })
      .eq("id", t.id);
    settled++;
  }
  return { settled };
}
