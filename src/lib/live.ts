import { useQuery } from "@tanstack/react-query";
import { getLiveScores } from "./live.functions";

export type LiveGame = {
  id: string;
  league: string;
  home: string;
  away: string;
  hs: number;
  as: number;
  minute: number;
};

export function useLiveScores(): { games: LiveGame[]; demo: boolean; loading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["live-scores"],
    queryFn: () => getLiveScores(),
    refetchInterval: 30_000,
    staleTime: 20_000,
    // Sem sessão no SSR — o pedido autenticado corre só no browser.
    enabled: typeof window !== "undefined",
  });
  return { games: data?.games ?? [], demo: data?.demo ?? false, loading: isLoading };
}
