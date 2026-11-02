import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Ticket, Radio } from "lucide-react";
import { LiveTicker } from "@/components/LiveTicker";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fezada IA — O teu consultor camarada de apostas em Angola" },
      { name: "description", content: "Chat IA, comparador de cotações Elephant Bet, Premier Bet e Bantu Bet em Kwanzas e resultados ao vivo da Girabola e mais." },
      { property: "og:title", content: "Fezada IA — Consultor camarada de apostas" },
      { property: "og:description", content: "Compara cotações das casas angolanas, calcula o retorno líquido em Kz e fala com o Camarada IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-xl items-center px-4 py-4">
        <span className="font-display text-xl font-bold">Fezada<span className="text-primary"> IA</span></span>
        <Button asChild size="sm" variant="secondary" className="ml-auto"><Link to="/auth">Entrar</Link></Button>
      </header>
      <LiveTicker />
      <main className="mx-auto max-w-xl px-4 pb-16 pt-10">
        <p className="mb-3 inline-block rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">Feito para Angola 🇦🇴</p>
        <h1 className="text-4xl font-extrabold leading-tight">A tua fezada,<br /><span className="text-primary">com cabeça.</span></h1>
        <p className="mt-4 text-muted-foreground">O Camarada IA analisa os jogos contigo, compara as cotações da Elephant Bet, Premier Bet e Bantu Bet e mostra quanto levas em Kwanzas — já com imposto.</p>
        <Button asChild size="lg" className="mt-6 w-full"><Link to="/auth">Criar conta</Link></Button>

        <div className="mt-10 space-y-3">
          {[
            [MessageCircle, "Consultor camarada", "Fala como tu falas. Bilhetes, banca e dicas na hora."],
            [Ticket, "Comparador de bilhetes", "3 casas lado a lado, retorno líquido em Kz e código de reserva."],
            [Radio, "Resultados ao vivo", "Girabola, Liga Portugal, Premier, Champions e CAF."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof MessageCircle;
            return (
              <div key={t as string} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <I className="h-6 w-6 shrink-0 text-primary" />
                <div><p className="font-semibold">{t as string}</p><p className="text-sm text-muted-foreground">{d as string}</p></div>
              </div>
            );
          })}
        </div>
        <p className="mt-10 text-center text-[11px] text-muted-foreground">Jogo responsável · Apenas maiores de 18 · Aposta só o que podes perder.</p>
      </main>
    </div>
  );
}
