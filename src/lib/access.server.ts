// Autenticação partilhada dos endpoints: valida o token, exige conta ativa e não expirada.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isProfileActive } from "./access.shared";

export type AuthResult =
  { ok: true; userId: string; token: string } | { ok: false; response: Response };

export function bearerToken(request: Request): string | null {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
}

export async function authenticateUser(
  request: Request,
  opts: { requireActive: boolean },
): Promise<AuthResult> {
  const token = bearerToken(request);
  if (!token) return { ok: false, response: new Response("Sessão em falta", { status: 401 }) };
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key)
    return { ok: false, response: new Response("Supabase não configurado", { status: 500 }) };

  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}`, apikey: key } },
  });
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return { ok: false, response: new Response("Sessão inválida", { status: 401 }) };

  if (opts.requireActive) {
    const { data: profile } = await sb
      .from("profiles")
      .select("status, expires_at")
      .eq("id", u.user.id)
      .maybeSingle();
    if (!isProfileActive(profile))
      return {
        ok: false,
        response: new Response("Conta não ativa ou subscrição expirada", { status: 403 }),
      };
  }
  return { ok: true, userId: u.user.id, token };
}
