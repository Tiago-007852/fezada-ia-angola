import { createFileRoute } from "@tanstack/react-router";
import { authenticateUser, bearerToken } from "@/lib/access.server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.server";
import { settleTickets } from "@/lib/tickets.server";

export const Route = createFileRoute("/api/tickets/settle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Utilizador autenticado: liquida só os seus bilhetes.
          if (bearerToken(request)) {
            const auth = await authenticateUser(request, { requireActive: false });
            if (auth.ok) {
              const rl = rateLimit(`settle:${auth.userId}`, 4, 60_000);
              if (!rl.ok) return tooManyRequests(rl.retryAfterSec);
              const { settled } = await settleTickets({ userId: auth.userId });
              return Response.json({ settled });
            }
          }
          // Caso contrário só o agendador (segredo partilhado) pode liquidar todos.
          const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
          const denied = await authenticateCronRequest(request);
          if (denied) return denied;
          const { settled } = await settleTickets("all");
          return Response.json({ settled });
        } catch (e) {
          console.error("[settle]", e);
          return new Response("Falha na liquidação", { status: 500 });
        }
      },
    },
  },
});
