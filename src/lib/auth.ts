import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Configuráveis por variáveis VITE_* (ver .env.example). Os valores por omissão mantêm o
// comportamento atual; depois de definires as variáveis podes apagar os defaults.
const env = import.meta.env as Record<string, string | undefined>;
export const ADMIN_WHATSAPP = env["VITE_ADMIN_WHATSAPP"] ?? "+244 950 596 073";
export const ADMIN_WHATSAPP_LINK = env["VITE_ADMIN_WHATSAPP_LINK"] ?? "https://wa.me/244950596073";
export const SUBSCRIPTION_PRICE = env["VITE_SUBSCRIPTION_PRICE"] ?? "5.000 Kz/mês";
export const PAYMENT_NUMBER = env["VITE_PAYMENT_NUMBER"] ?? "950 596 073";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      return {
        user: u.user,
        profile,
        isAdmin: !!roles?.some((r) => r.role === "admin"),
      };
    },
  });
}
