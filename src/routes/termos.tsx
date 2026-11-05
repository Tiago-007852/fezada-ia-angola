import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de utilização — Fezada IA" },
      { name: "description", content: "Termos de utilização da plataforma Fezada IA." },
    ],
  }),
  component: () => (
    <LegalPage title="Termos de utilização">
      <p>
        A Fezada IA é um serviço de informação e apoio à decisão, operado por [NOME DA EMPRESA /
        TITULAR], NIF [NIF], contacto [EMAIL].
      </p>
      <h2>1. O que é (e o que não é)</h2>
      <p>
        Fornecemos resultados, cotações de referência, sugestões geradas por inteligência artificial
        e ferramentas de cálculo. Não somos uma casa de apostas, não recebemos apostas e não
        garantimos resultados. Os palpites são opiniões automáticas, podem estar errados e nunca são
        garantia de ganho.
      </p>
      <h2>2. Elegibilidade</h2>
      <p>
        Só podes usar o serviço se tiveres 18 anos ou mais e se a lei aplicável te permitir aceder a
        conteúdos sobre apostas.
      </p>
      <h2>3. Conta e subscrição</h2>
      <ul>
        <li>O acesso depende de ativação manual após confirmação do pagamento.</li>
        <li>
          Cada ativação tem uma validade (atualmente 30 dias). Findo o prazo, o acesso é suspenso
          até à renovação.
        </li>
        <li>Reembolsos: [POLÍTICA DE REEMBOLSO].</li>
        <li>Podemos restringir contas que violem estes termos.</li>
      </ul>
      <h2>4. Dados de terceiros</h2>
      <p>
        Resultados e cotações vêm de fornecedores externos e podem atrasar-se ou conter erros.
        Confirma sempre a cotação e as condições na casa de apostas antes de apostar.
      </p>
      <h2>5. Responsabilidade</h2>
      <p>
        Na máxima medida permitida por lei, não respondemos por perdas resultantes de apostas feitas
        com base no conteúdo do serviço.
      </p>
      <h2>6. Alterações</h2>
      <p>
        Podemos atualizar estes termos; a continuação de uso após a alteração implica aceitação.
        Última atualização: [DATA].
      </p>
    </LegalPage>
  ),
});
