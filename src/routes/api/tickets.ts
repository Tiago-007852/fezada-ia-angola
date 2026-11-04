import { createFileRoute } from "@tanstack/react-router";
import { createTicket } from "@/lib/tickets.server";

export const Route = createFileRoute("/api/tickets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Sessão em falta", { status: 401 });
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Pedido inválido", { status: 400 });
        }
        const result = await createTicket(token, body as Parameters<typeof createTicket>[1]);
        if (!result.ok) return new Response(result.error ?? "Falha ao criar bilhete", { status: result.status ?? 400 });
        return Response.json({ ticket: result.ticket });
      },
    },
  },
});
