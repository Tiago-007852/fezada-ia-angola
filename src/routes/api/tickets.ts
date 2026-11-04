import { createFileRoute } from "@tanstack/react-router";
import { authenticateUser } from "@/lib/access.server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.server";
import { createTicket, type CreateTicketInput } from "@/lib/tickets.server";

export const Route = createFileRoute("/api/tickets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateUser(request, { requireActive: true });
        if (!auth.ok) return auth.response;
        const rl = rateLimit(`tickets:${auth.userId}`, 20, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

        let body: Partial<CreateTicketInput>;
        try {
          body = (await request.json()) as Partial<CreateTicketInput>;
        } catch {
          return new Response("Pedido inválido", { status: 400 });
        }
        // Bilhetes vindos do cliente são sempre "manual" e validados contra o feed.
        const result = await createTicket(
          auth.userId,
          {
            source: "manual",
            stake: Number(body.stake),
            selections: Array.isArray(body.selections) ? body.selections : [],
          },
          { trusted: false },
        );
        if (!result.ok)
          return new Response(result.error ?? "Falha ao criar bilhete", {
            status: result.status ?? 400,
          });
        return Response.json({ ticket: result.ticket });
      },
    },
  },
});
