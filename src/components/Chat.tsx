import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { SendHorizonal, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const STARTERS = ["Monta-me um bilhete seguro para o fim de semana", "Petro ou 1º de Agosto, mano?", "Como gerir uma banca de 20.000 Kz?"];

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
          return m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
              {content}
            </div>
          ) : (
            <div key={m.id} className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">F</div>
              <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_li]:my-0.5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-4">
                <ReactMarkdown>{content}</ReactMarkdown>
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
