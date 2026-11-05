import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/jogo-responsavel")({
  head: () => ({
    meta: [
      { title: "Jogo responsável — Fezada IA" },
      {
        name: "description",
        content: "Aposta com consciência: limites, sinais de alerta e onde pedir ajuda.",
      },
    ],
  }),
  component: () => (
    <LegalPage title="Jogo responsável">
      <p>
        Apostar deve ser entretenimento, não uma forma de ganhar a vida. Só para maiores de 18 anos.
      </p>
      <h2>Regras simples</h2>
      <ul>
        <li>Aposta apenas dinheiro que podes perder sem afetar renda, contas ou família.</li>
        <li>Define um limite por semana antes de começar e respeita-o.</li>
        <li>Nunca tentes recuperar perdas com apostas maiores.</li>
        <li>Faz pausas; não apostes sob stress, cansaço ou álcool.</li>
        <li>Lembra-te: nenhum palpite, IA incluída, garante ganhos.</li>
      </ul>
      <h2>Sinais de alerta</h2>
      <ul>
        <li>Pensar em apostar o dia todo ou esconder as apostas de quem te é próximo.</li>
        <li>Pedir dinheiro emprestado para apostar.</li>
        <li>Sentir irritação quando tentas reduzir.</li>
      </ul>
      <h2>Onde pedir ajuda</h2>
      <p>
        Fala com alguém de confiança e com um profissional de saúde. Contactos de apoio em Angola:
        [ADICIONAR ENTIDADES / LINHAS DE APOIO LOCAIS]. Podes pedir a suspensão da tua conta a
        qualquer momento por [EMAIL] ou WhatsApp.
      </p>
    </LegalPage>
  ),
});
