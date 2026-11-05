import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — Fezada IA" },
      { name: "description", content: "Como a Fezada IA trata os teus dados pessoais." },
    ],
  }),
  component: () => (
    <LegalPage title="Política de privacidade">
      <p>Responsável pelo tratamento: [NOME DA EMPRESA / TITULAR], contacto [EMAIL].</p>
      <h2>Dados que tratamos</h2>
      <ul>
        <li>Conta: nome, email e (se usares o Google) o identificador da conta Google.</li>
        <li>
          Subscrição: estado da conta, confirmação e validade do pagamento. O comprovativo é trocado
          por WhatsApp.
        </li>
        <li>
          Utilização: bilhetes que crias ou que o IA gera, e as conversas enviadas ao assistente.
        </li>
      </ul>
      <h2>Para quê</h2>
      <p>
        Para criar e gerir a tua conta, validar a subscrição, fornecer o serviço e prevenir abuso.
      </p>
      <h2>Com quem partilhamos</h2>
      <p>
        Com prestadores necessários ao serviço: alojamento e base de dados (Supabase / Lovable
        Cloud), fornecedor de dados desportivos (API-Sports) e fornecedor de IA. As mensagens que
        escreves no chat são enviadas ao fornecedor de IA para gerar a resposta. Não vendemos os
        teus dados.
      </p>
      <h2>Retenção e direitos</h2>
      <p>
        Guardamos os dados enquanto a conta existir. Podes pedir acesso, correção ou eliminação em
        [EMAIL]. Prazos e base legal: [COMPLETAR conforme a lei angolana de proteção de dados].
      </p>
    </LegalPage>
  ),
});
