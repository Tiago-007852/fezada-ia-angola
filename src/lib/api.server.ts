// Cliente partilhado da API-Sports (v3 football) com cache em memória por isolado.
// A API devolve sempre { response: T[] } — o retorno é o array. Qualquer falha devolve
// null e quem chama decide o fallback, nunca dados falsos.

const API_BASE = "https://v3.football.api-sports.io";

type Entry = { at: number; data: unknown };

const caches = new Map<string, Entry>();

export function hasApiKey(): boolean {
  return !!process.env["API_SPORTS_KEY"];
}

export async function apiSports<T>(
  path: string,
  params: Record<string, string | number>,
  ttlMs = 120_000,
): Promise<T[] | null> {
  const key = process.env["API_SPORTS_KEY"];
  if (!key) return null;

  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ""}`;
  const cached = caches.get(url);
  if (cached && Date.now() - cached.at < ttlMs) return cached.data as T[];

  try {
    const res = await fetch(url, { headers: { "x-apisports-key": key } });
    if (!res.ok) throw new Error(`API-Sports respondeu ${res.status}`);
    const json = (await res.json()) as { response?: T[]; errors?: unknown };
    const arr = json.response;
    if (!Array.isArray(arr)) throw new Error("Resposta inesperada da API-Sports");
    caches.set(url, { at: Date.now(), data: arr });
    // Limita o cache para não crescer sem controlo.
    if (caches.size > 500) {
      const oldest = [...caches.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) caches.delete(oldest[0]);
    }
    return arr;
  } catch (e) {
    console.error(`[api-sports] Falha em ${path}:`, e);
    return null;
  }
}
