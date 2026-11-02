import { useEffect, useState } from "react";

export type LiveGame = {
  id: string;
  league: string;
  home: string;
  away: string;
  hs: number;
  as: number;
  minute: number;
};

// Dados de demonstração — trocar por API-Sports quando a chave estiver configurada.
const SEED: LiveGame[] = [
  { id: "1", league: "Girabola", home: "Petro", away: "Wiliete", hs: 1, as: 0, minute: 34 },
  { id: "2", league: "Girabola", home: "1º Agosto", away: "Kabuscorp", hs: 0, as: 0, minute: 12 },
  { id: "3", league: "Liga Portugal", home: "Benfica", away: "Vitória SC", hs: 2, as: 1, minute: 67 },
  { id: "4", league: "Premier League", home: "Arsenal", away: "Spurs", hs: 1, as: 1, minute: 55 },
  { id: "5", league: "Champions League", home: "Inter", away: "PSG", hs: 0, as: 1, minute: 78 },
  { id: "6", league: "CAF Champions", home: "Mamelodi", away: "Esperance", hs: 2, as: 2, minute: 81 },
];

export function useLiveScores() {
  const [games, setGames] = useState(SEED);
  useEffect(() => {
    const t = setInterval(() => {
      setGames((gs) =>
        gs.map((g) => {
          if (g.minute >= 90) return { ...g, minute: 1, hs: 0, as: 0 };
          const r = Math.random();
          return {
            ...g,
            minute: g.minute + 1,
            hs: g.hs + (r < 0.03 ? 1 : 0),
            as: g.as + (r > 0.97 ? 1 : 0),
          };
        }),
      );
    }, 6000);
    return () => clearInterval(t);
  }, []);
  return games;
}
