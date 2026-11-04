import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { totalOddsOf } from "./ticket.shared";
import type { Pick } from "./odds";

export type TicketRow = {
  id: string;
  user_id: string;
  source: "manual" | "ai";
  risk: string | null;
  rationale: string | null;
  stake: number;
  total_odds: number | null;
  bookie: string | null;
  net_return: number | null;
  status: "pending" | "won" | "lost" | "void";
  created_at: string;
  settled_at: string | null;
};

export type TicketSelectionRow = {
  id: string;
  ticket_id: string;
  fixture_id: number;
  home: string;
  away: string;
  kickoff: string | null;
  league: string | null;
  market: string;
  pick: string;
  odds: number;
  result: "win" | "lost" | "pending" | null;
};

export type TicketWithSelections = TicketRow & { selections: TicketSelectionRow[] };

export type NewSelection = {
  fixtureId: string;
  home: string;
  away: string;
  kickoff: string;
  league: string;
  pick: Pick;
  odds: number;
};

/** Cria um bilhete e devolve a versão persistida (sem seleções; buscar depois na lista). */
export async function createTicket(input: {
  source: "manual" | "ai";
  stake: number;
  risk?: string;
  rationale?: string;
  selections: NewSelection[];
}): Promise<{ ok: boolean; error?: string; ticket?: TicketRow }> {
  try {
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text || `Erro ${res.status}` };
    }
    void res;
    const json = (await res.json()) as { ticket: TicketWithSelections };
    return { ok: true, ticket: json.ticket };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function useTickets() {
  return useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const settled = await settlePendingTickets();
      const [tRes, sRes] = await Promise.all([
        supabase.from("tickets").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("ticket_selections").select("*").order("id"),
      ]);
      if (tRes.error) throw tRes.error;
      const sels = (sRes.data ?? []) as TicketSelectionRow[];
      const tickets = ((tRes.data ?? []) as TicketRow[]).map((t) => ({
        ...t,
        selections: sels.filter((s) => s.ticket_id === t.id),
      }));
      return { tickets: tickets as TicketWithSelections[], settledCount: settled };
    },
    staleTime: 30_000,
  });
}

/** Ir buscar finais dos jogos dos bilhetes pendentes e liquidar (server-side). */
export function useTicketSettler() {
  const qc = useQueryClient();
  return useCallback(async () => {
    await settlePendingTickets();
    await qc.invalidateQueries({ queryKey: ["tickets"] });
  }, [qc]);
}

async function settlePendingTickets(): Promise<number> {
  try {
    const res = await fetch("/api/tickets/settle", { method: "POST" });
    if (!res.ok) return 0;
    const json = (await res.json()) as { settled: number };
    return json.settled ?? 0;
  } catch {
    return 0;
  }
}

/** Estatísticas do histórico: win rate, ROI e valor líquido em Kz. */
export function ticketStats(tickets: TicketWithSelections[]) {
  const settled = tickets.filter((t) => t.status !== "pending");
  const won = settled.filter((t) => t.status === "won");
  const lost = settled.filter((t) => t.status === "lost");
  const staked = settled.reduce((a, t) => a + Number(t.stake), 0);
  const returned = won.reduce((a, t) => a + Number(t.net_return ?? 0), 0);
  const net = returned - staked;
  const hitRate = settled.length > 0 ? won.length / settled.length : 0;
  const roi = staked > 0 ? (net / staked) * 100 : 0;
  return { won: won.length, lost: lost.length, staked, net, hitRate, roi };
}
