/** Duração de uma ativação/renovação feita pelo admin. */
export const SUBSCRIPTION_DAYS = 30;

export type AccessProfile = { status: string; expires_at?: string | null } | null | undefined;

/** Conta ativa = status 'active' e subscrição não expirada (expires_at nulo = sem validade, ex.: admin). */
export function isProfileActive(profile: AccessProfile, now: Date = new Date()): boolean {
  if (!profile || profile.status !== "active") return false;
  if (!profile.expires_at) return true;
  return new Date(profile.expires_at).getTime() > now.getTime();
}

export function isProfileExpired(profile: AccessProfile, now: Date = new Date()): boolean {
  return !!profile && profile.status === "active" && !isProfileActive(profile, now);
}
