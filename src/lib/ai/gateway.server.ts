import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage, type ToolSet } from "ai";

const RUN = "X-Lovable-AIG-Run-ID";

function runIdFetch(initial?: string) {
  let runId = initial?.trim() || undefined;
  let resolve: (v: string | undefined) => void = () => {};
  let done = false;
  const ready = new Promise<string | undefined>((r) => (resolve = r));
  const publish = (v?: string) => {
    if (!runId && v?.trim()) runId = v.trim();
    if (!done) {
      done = true;
      resolve(runId);
    }
  };
  if (runId) publish(runId);
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN)) headers.set(RUN, runId);
      try {
        const res = await fetch(input, { ...init, headers });
        publish(res.headers.get(RUN) ?? undefined);
        return res;
      } catch (e) {
        publish(undefined);
        throw e;
      }
    },
    waitForRunId: () => (runId ? Promise.resolve(runId) : ready),
  };
}

async function withRunId(response: Response, gw: ReturnType<typeof runIdFetch>) {
  if (!response.body) return response;
  const reader = response.body.getReader();
  const first = reader.read();
  const runId = await gw.waitForRunId();
  const headers = new Headers(response.headers);
  if (runId) headers.set(RUN, runId);
  const body = new ReadableStream({
    async start(c) {
      try {
        const f = await first;
        if (f.done) return c.close();
        c.enqueue(f.value);
        while (true) {
          const ch = await reader.read();
          if (ch.done) break;
          c.enqueue(ch.value);
        }
        c.close();
      } catch (e) {
        c.error(e);
      }
    },
    cancel: (r) => reader.cancel(r),
  });
  return new Response(body, { status: response.status, headers });
}

export function streamGatewayChat(
  request: Request,
  apiKey: string,
  messages: ModelMessage[],
  system: string,
  tools?: ToolSet,
) {
  const gw = runIdFetch(request.headers.get(RUN) ?? undefined);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: gw.fetch,
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system,
    messages,
    ...(tools ? { tools: tools as ToolSet, toolChoice: "auto" as const } : {}),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return withRunId(result.toUIMessageStreamResponse(), gw);
}
