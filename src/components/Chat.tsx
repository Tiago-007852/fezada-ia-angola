import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { SendHorizonal, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { pickLabel } from "@/lib/tips.shared";
import { kz } from "@/lib/odds";

const STARTERS = ["Monta-me um bilhete seguro para o fim de semana", "Petro ou 1º de Agosto, mano?", "Como gerir uma banca de 20.000 Kz?"];

type ToolPart = { type: string; state?: string; output?: unknown; input?: unknown };

function ToolCard({ part }: { part: ToolPart }) {
  if (part.state !== "output-available") {
    return <p className="m-1 text-xs text-muted-foreground animate-pulse">O Camarada está a montar o bilhete…</p>;
  }
  const out = (part.output ?? {}) as {
    ok?: boolean;
    error?: string;
    demo?: boolean;
    rationale?: string;
    stake_advice?: string;
    responsible_note?: string;
    selections?: { home: string; away: string; pick: string }[];
    ticket?: { total_odds: number | null; net_return: number | null; risk: string | null } | null;
  };
  if (out.ok === false) {
    return <div className="m-1 rounded-lg border border-destructive/40 bg-card p-3 text-sm">Puta de falha: {out.error ?? "Não consegui criar o palpite agora."}</div>;
  }
  const demo = out.demo === true;
  const odds = out.ticket?.total_odds;
  const net = out.ticket?.net_return;
  return (
    <div className="m-1 space-y-2 rounded-xl border border-primary/40 bg-card p-3">
      <p className="font-display text-sm font-bold">{demo ? "Bilhete de demonstração 🔥" : "Palpite criado e guardado 🔥"}</p>
      {out.rationale && <p className="text-xs text-muted-foreground">{out.rationale}</p>}
      <ul className="divide-y divide-border text-sm">
        {(out.selections ?? []).map((s, i) => (
          <li key={i} className="flex items-center gap-2 py-1.5">
            <span className="min-w-0 flex-1 truncate">{s.home} vs {s.away}</span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold text-primary">{s.pick}{s.pick in pickLabel ? ` · ${pickLabel[s.pick]}` : ""}</span>
          </li>
        ))}
      </ul>
      {odds != null && (
        <p className="text-xs text-muted-foreground">
          Odd total {Number(odds).toFixed(2)}{net != null && <> · líquido de referência {kz(Number(net))} (aposta de 1.000 Kz, às contas de imposto de 15%)</>}
        </p>
      )}
      {out.stake_advice && <p className="text-xs text-accent">💳 {out.stake_advice}</p>}
      {out.responsible_note && <p className="text-[11px] text-muted-foreground">{out.responsible_note}</p>}
    </div>
  );
}

export function Chat() {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
      }),
    [],
  );
  const { messages, sendMessage, status, stop } = useChat({
    transport,
    onError: (e) => toast.error(e.message || "O Camarada está sem rede. Tenta de novo."),
  });
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
    if (!busy) ref.current?.focus();
  }, [messages, busy]);

  const send = (t: string) => {
    if (!t.trim() || busy) return;
    sendMessage({ text: t.trim() });
    setText("");
  };

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="space-y-3 pt-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary font-display text-xl font-bold text-primary-foreground">F</div>
            <p className="font-display text-lg font-semibold">Bora, camarada! Qual é a fezada de hoje?</p>
            <div className="flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => {
          const content = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const toolParts = m.parts.filter((p) => p.type.startsWith("tool-")) as unknown as ToolPart[];
          return m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
              {content}
            </div>
          ) : (
            <div key={m.id} className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">F</div>
              <div className="min-w-0 flex-1">
                {content && (
                  <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_li]:my-0.5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-4">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                )}
                {toolParts.map((part, i) => (
                  <ToolCard key={i} part={part} />
                ))}
              </div>
            </div>
          );
        })}
        {status === "submitted" && <p className="pl-9 text-sm text-muted-foreground animate-pulse">O Camarada está a analisar…</p>}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-end gap-2 rounded-xl border border-border bg-card p-2"
      >
        <textarea
          ref={ref}
          autoFocus
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          placeholder="Pergunta ao Camarada…"
          className="max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
        />
        {busy ? (
          <Button type="button" size="icon" variant="secondary" onClick={stop} aria-label="Parar"><Square className="h-4 w-4" /></Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Enviar" disabled={!text.trim()}><SendHorizonal className="h-4 w-4" /></Button>
        )}
      </form>
    </div>
  );
}
