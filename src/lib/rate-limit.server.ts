// Limitador simples em memória (janela deslizante) por chave. Protege os endpoints que gastam
// créditos de IA ou quota da API-Sports. É por instância do worker: reduz abuso, não substitui
// um limitador distribuído se o tráfego crescer muito.

const buckets = new Map<string, number[]>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return { ok: true };
}

export function tooManyRequests(retryAfterSec: number): Response {
  return new Response("Demasiados pedidos. Tenta novamente daqui a pouco.", {
    status: 429,
    headers: { "Retry-After": String(retryAfterSec) },
  });
}

/** Só para testes. */
export function resetRateLimits(): void {
  buckets.clear();
}
