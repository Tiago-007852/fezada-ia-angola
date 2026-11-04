// Lógica server-side dos bilhetes: criação (auth + valida odds) e liquidação com resultados reais.
import { createClient } from "@supabase/supabase-js";
import { apiSports } from "./api.server";
import { netReturn, totalOddsOf } from "./ticket.shared";
import { pickLabel } from "./tips.shared";
import type { Database } from "@/integrations/supabase/types";

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

export async function createTicket(token: string, input: CreateTicketInput): Promise<CreateTicketOutput> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return { ok: false, error: "Supabase não configurado", status: 500 };
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return { ok: false, error: "Sessão inválida", status: 401 };
  const { data: profile } = await sb.from("profiles").select("status").eq("id", u.user.id).maybeSingle();
  if (profile?.status !== "active") return { ok: false, error: "Conta ainda não ativada", status: 403 };

  if (!input.selections || input.selections.length < 1 || input.selections.length > 10)
    return { ok: false, error: "Bilhete precisa de 1 a 10 seleções", status: 400 };
  if (!(input.stake > 0)) return { ok: false, error: "Valor da aposta inválido", status: 400 };

  const totalOdds = totalOddsOf(input.selections.map((s) => ({ odds: s.odds, pick: s.pick })));
  if (!(totalOdds > 1)) return { ok: false, error: "Odds inválidas", status: 400 };
  const r = netReturn(input.stake, totalOdds);

  const { data: ticket, error: tErr } = await sb
    .from("tickets")
    .insert({
      user_id: u.user.id,
      source: input.source,
      risk: input.risk ?? null,
      rationale: input.rationale ?? null,
      stake: input.stake,
      total_odds: totalOdds,
      bookie: "referência",
      net_return: r.net,
      status: "pending",
    })
    .select("*")
    .single();
  if (tErr || !ticket) return { ok: false, error: tErr?.message ?? "Falha ao criar bilhete", status: 500 };

  const rows = input.selections.map((s) => ({
    ticket_id: ticket.id,
    fixture_id: Number(s.fixtureId),
    home: s.home,
    away: s.away,
    kickoff: s.kickoff,
    league: s.league,
    market: "1X2",
    pick: s.pick,
    odds: s.odds,
  }));
  const { error: sErr } = await sb.from("ticket_selections").insert(rows);
  if (sErr) return { ok: false, error: sErr.message, status: 500 };

  return { ok: true, ticket };
}

type ApiFixtureResult = {
  fixture: { id: number; status: { short: string } };
  teams: { home: { id: number }; away: { id: number } };
  score: { fulltime: { home: number | null; away: number | null } };
};

type PendingTicket = {
  id: string;
  stake: number;
  status: string;
  user_id: string;
  selections: { id: string; pick: string; result: string | null; fixture_id: number }[];
};

/** Liquida bilhetes pendentes do próprio utilizador (RLS) com os finais reais da API-Sports. */
export async function settleTickets(token: string | null): Promise<{ settled: number }> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase não configurado");

  const headers: Record<string, string> = { "apikey": key };
  let sb: ReturnType<typeof createClient<Database>>;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    sb = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers },
    });
  } else {
    const secret = process.env["SUPABASE_SERVICE_ROLE"];
    if (!secret) throw new Error("Sem credenciais para liquidação");
    headers["apikey"] = secret;
    headers["Authorization"] = `Bearer ${secret}`;
    sb = createClient<Database>(url, secret, { auth: { persistSession: false } });
  }

  const { data: pending } = await sb
    .from("tickets")
    .select("id, stake, status, user_id, ticket_selections ( id, pick, result, fixture_id, odds )")
    .eq("status", "pending")
    .limit(30);

  const tickets = ((pending ?? []) as unknown) as (Omit<PendingTicket, "selections"> & { ticket_selections: PendingTicket["selections"] })[];
  let settled = 0;

  for (const t of tickets) {
    const sels = (t.ticket_selections ?? []).filter((s) => s.result !== "win" && s.result !== "lost");
    if (sels.length === 0) continue;
    const ids = [...new Set(sels.map((s) => s.fixture_id))].slice(0, 20);
    const results = await apiSports<ApiFixtureResult>("/fixtures", { ids: ids.join("-") }, 60_000);
    if (!results || results.length === 0) continue;
    const byId = new Map(results.map((f) => [String(f.fixture.id), f]));

    let anyLost = false;
    let anyPending = false;
    for (const s of sels) {
      const f = byId.get(String(s.fixture_id));
      if (!f) {
        anyPending = true;
        continue;
      }
      const status = f.fixture.status.short;
      const finished = ["FT", "AET", "PEN"].includes(status);
      if (!finished) {
        anyPending = true;
        continue;
      }
      const hs = f.score.fulltime.home;
      const as = f.score.fulltime.away;
      if (hs === null || as === null) {
        anyPending = true;
        continue;
      }
      const win = s.pick === "1" ? hs > as : s.pick === "X" ? hs === as : as > hs;
      await sb.from("ticket_selections").update({ result: win ? "win" : "lost" }).eq("id", s.id);
      if (!win) anyLost = true;
    }

    const newStatus = anyLost ? "lost" : anyPending ? "pending" : "won";
    if (newStatus !== "pending") {
      if (newStatus === "won") {
        const allSels = t.ticket_selections ?? [];
        const totalOdds = totalOddsOf(allSels.map((sel) => ({ odds: oddsOf(sel), pick: sel.pick })));
        const r = netReturn(Number(t.stake), totalOdds);
        await sb.from("tickets").update({ status: "won", net_return: r.net, settled_at: new Date().toISOString() }).eq("id", t.id);
      } else {
        await sb.from("tickets").update({ status: "lost", settled_at: new Date().toISOString() }).eq("id", t.id);
      }
      settled++;
    }
  }
  return { settled };
}

function oddsOf(s: unknown): number {
  const sel = s as { odds?: number };
  return Number(sel.odds ?? 1);
}
