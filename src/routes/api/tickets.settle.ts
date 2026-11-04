import { createFileRoute } from "@tanstack/react-router";
import { settleTickets } from "@/lib/tickets.server";

export const Route = createFileRoute("/api/tickets/settle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
        try {
          const { settled } = await settleTickets(token);
          return Response.json({ settled });
        } catch (e) {
          return new Response((e as Error).message || "Falha na liquidação", { status: 500 });
        }
      },
    },
  },
});
