import type { Metadata } from "next";
import LegalPage, {
  LegalAddress,
  LegalDivider,
  LegalItem,
  LegalLead,
  LegalList,
  LegalP,
  LegalSection,
  LegalSub,
  LegalTable,
  Placeholder,
  type LegalTocItem,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Política de cookies | Formação Allos",
  description:
    "Quais cookies o site e a plataforma de formação da Associação Allos utilizam, para que servem, quanto tempo duram e como você controla cada categoria.",
  openGraph: {
    title: "Política de cookies | Formação Allos",
    description:
      "Cookies usados pela Associação Allos, finalidade, duração e como controlar cada categoria.",
    type: "article",
    locale: "pt_BR",
  },
};

const toc: LegalTocItem[] = [
  { id: "o-que-sao-cookies", label: "1. O que são cookies" },
  { id: "categorias", label: "2. Categorias que utilizamos" },
  { id: "necessarios", label: "2.1. Necessários", sub: true },
  { id: "preferencias", label: "2.2. Preferências", sub: true },
  { id: "estatisticos", label: "2.3. Estatísticos", sub: true },
  { id: "marketing", label: "2.4. Marketing", sub: true },
  { id: "terceiros-incorporados", label: "2.5. Terceiros incorporados", sub: true },
  { id: "como-voce-controla", label: "3. Como você controla" },
  { id: "transferencia-internacional", label: "4. Transferência internacional" },
  { id: "o-que-nao-fazemos", label: "5. O que não fazemos" },
  { id: "prazo-de-guarda", label: "6. Prazo de guarda" },
  { id: "seus-direitos", label: "7. Seus direitos" },
  { id: "alteracoes", label: "8. Alterações" },
  { id: "contato", label: "9. Contato" },
  { id: "historico-de-versoes", label: "Histórico de versões" },
];

const COOKIE_TABLE_HEAD = ["Cookie", "Origem", "Finalidade", "Duração"];

export default function CookiesPage() {
  return (
    <LegalPage
      title="Política de cookies"
      version="1.0"
      effectiveFrom={<Placeholder>[DATA DE PUBLICAÇÃO]</Placeholder>}
      toc={toc}
    >
      <LegalLead>
        Esta política explica quais cookies o site <Placeholder>[DOMÍNIO]</Placeholder> e a
        plataforma de formação da Associação Allos utilizam, para que servem e como você controla o
        uso deles. Ela integra a nossa Política de Privacidade, disponível em{" "}
        <Placeholder>[URL DA POLÍTICA DE PRIVACIDADE]</Placeholder>.
      </LegalLead>

      <LegalSection id="o-que-sao-cookies" title="1. O que são cookies">
        <LegalP>
          Cookies são arquivos de texto que o site grava no seu navegador quando você o visita. Em
          visitas seguintes, o navegador devolve esse arquivo ao site, o que permite reconhecer o seu
          dispositivo.
        </LegalP>
        <LegalP>
          Nesta política, &quot;cookies&quot; abrange também outras tecnologias com função parecida,
          como armazenamento local (localStorage e sessionStorage), pixels de rastreamento e
          identificadores de sessão.
        </LegalP>
        <LegalP>
          Cookies de primeira parte são gravados pelo próprio domínio da Allos. Cookies de terceiros
          são gravados por outros domínios cujos recursos aparecem nas nossas páginas, como um vídeo
          incorporado.
        </LegalP>
      </LegalSection>

      <LegalSection id="categorias" title="2. Categorias que utilizamos">
        <LegalSub id="necessarios" title="2.1. Necessários">
          <LegalP>
            Fazem o site e a plataforma funcionarem. Mantêm sua sessão aberta, protegem formulários
            contra fraude e guardam a sua escolha sobre esta política. Sem eles não é possível fazer
            login nem acessar as aulas.
          </LegalP>
          <LegalP>
            Esses cookies não dependem de consentimento. Eles são tratados com base no art. 7º,
            incisos II, V e IX da Lei nº 13.709/2018 e no art. 15 da Lei nº 12.965/2014.
          </LegalP>
          <LegalTable
            caption="Cookies necessários"
            head={COOKIE_TABLE_HEAD}
            rows={[
              [
                <Placeholder key="sessao">[NOME DO COOKIE DE SESSÃO]</Placeholder>,
                "Allos",
                "Mantém você conectado à plataforma",
                "Sessão",
              ],
              [
                <Placeholder key="token">[NOME DO TOKEN DE AUTENTICAÇÃO]</Placeholder>,
                "Allos",
                "Identifica sua conta entre visitas",
                "30 dias",
              ],
              [
                <Placeholder key="csrf">[NOME DO COOKIE CSRF]</Placeholder>,
                "Allos",
                "Protege formulários contra requisição forjada",
                "Sessão",
              ],
              ["allos_consent", "Allos", "Guarda suas escolhas nesta política", "6 meses"],
            ]}
          />
        </LegalSub>

        <LegalSub id="preferencias" title="2.2. Preferências">
          <LegalP>
            Guardam ajustes que você faz na interface, como idioma ou posição no vídeo. A ausência
            deles não impede o uso, apenas faz o site esquecer suas escolhas.
          </LegalP>
          <LegalP>Dependem do seu consentimento.</LegalP>
          <LegalTable
            caption="Cookies de preferências"
            head={COOKIE_TABLE_HEAD}
            rows={[
              [
                <Placeholder key="nome">[NOME]</Placeholder>,
                "Allos",
                "Guarda o ponto em que você parou a aula",
                "12 meses",
              ],
            ]}
          />
        </LegalSub>

        <LegalSub id="estatisticos" title="2.3. Estatísticos">
          <LegalP>
            Medem quantas pessoas acessam as páginas, de onde vêm e quais conteúdos são mais
            procurados. Usamos esses dados de forma agregada para decidir o que produzir.
          </LegalP>
          <LegalP>Dependem do seu consentimento.</LegalP>
          <LegalTable
            caption="Cookies estatísticos"
            head={COOKIE_TABLE_HEAD}
            rows={[
              ["_ga", "Google Analytics", "Distingue visitantes", "2 anos"],
              [
                <span key="ga4">
                  _ga_<Placeholder>[ID]</Placeholder>
                </span>,
                "Google Analytics",
                "Mantém o estado da sessão de medição",
                "2 anos",
              ],
            ]}
          />
        </LegalSub>

        <LegalSub id="marketing" title="2.4. Marketing">
          <LegalP>
            Medem o resultado das nossas divulgações e permitem exibir conteúdo da Allos para quem já
            visitou o site.
          </LegalP>
          <LegalP>Dependem do seu consentimento.</LegalP>
          <LegalTable
            caption="Cookies de marketing"
            head={COOKIE_TABLE_HEAD}
            rows={[
              [
                "_fbp",
                "Meta",
                "Identifica o navegador para atribuição de campanhas",
                "3 meses",
              ],
              ["_fbc", "Meta", "Registra o clique no anúncio que trouxe você ao site", "3 meses"],
            ]}
          />
        </LegalSub>

        <LegalSub id="terceiros-incorporados" title="2.5. Terceiros incorporados">
          <LegalP>
            Algumas páginas exibem vídeos hospedados no YouTube. Ao carregar esses vídeos, o Google
            pode gravar cookies próprios, sobre os quais não temos controle. O tratamento desses
            dados segue a política do Google, disponível em{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
            >
              https://policies.google.com/privacy
            </a>
            .
          </LegalP>
          <LegalTable
            caption="Cookies de terceiros incorporados"
            head={COOKIE_TABLE_HEAD}
            rows={[
              [
                "VISITOR_INFO1_LIVE",
                "YouTube",
                "Mede a largura de banda e a interface do player",
                "6 meses",
              ],
              ["YSC", "YouTube", "Registra visualizações do vídeo incorporado", "Sessão"],
            ]}
          />
        </LegalSub>
      </LegalSection>

      <LegalSection id="como-voce-controla" title="3. Como você controla">
        <LegalP>
          3.1. No primeiro acesso, um aviso apresenta as categorias desta política. Você pode aceitar
          todas, recusar todas ou escolher categoria por categoria. Recusar é tão simples quanto
          aceitar, e nenhuma categoria vem marcada por padrão, com exceção dos cookies necessários.
        </LegalP>
        <LegalP>
          3.2. Você pode revisar sua escolha a qualquer momento pelo link &quot;Preferências de
          cookies&quot;, disponível no rodapé de todas as páginas.
        </LegalP>
        <LegalP>
          3.3. Seu consentimento fica registrado com data, hora, versão desta política e categorias
          aceitas. Passados 6 (seis) meses, o aviso volta a aparecer para que você confirme ou mude a
          escolha.
        </LegalP>
        <LegalP>
          3.4. Você também pode apagar cookies já gravados ou bloquear novos pelas configurações do
          navegador. Os caminhos mudam conforme o programa:
        </LegalP>
        <LegalList>
          <LegalItem>
            Google Chrome: Configurações, Privacidade e segurança, Cookies e outros dados do site.
          </LegalItem>
          <LegalItem>
            Mozilla Firefox: Configurações, Privacidade e Segurança, Cookies e dados de sites.
          </LegalItem>
          <LegalItem>Safari: Preferências, Privacidade, Gerenciar dados de sites.</LegalItem>
          <LegalItem>Microsoft Edge: Configurações, Cookies e permissões de site.</LegalItem>
        </LegalList>
        <LegalP>
          3.5. Bloquear cookies necessários pelo navegador impede o login e o acesso às aulas.
          Bloquear as demais categorias não afeta o funcionamento.
        </LegalP>
      </LegalSection>

      <LegalSection id="transferencia-internacional" title="4. Transferência internacional">
        <LegalP>
          Os cookies estatísticos e de marketing descritos nas cláusulas 2.3 e 2.4 são operados por
          empresas com sede fora do Brasil, e os dados por eles coletados podem ser tratados em
          outros países. Essa transferência ocorre nos termos do art. 33 da Lei nº 13.709/2018 e
          depende do seu consentimento.
        </LegalP>
        <LegalP>
          Se você recusar essas categorias, nenhum dado é enviado a esses fornecedores por meio do
          nosso site.
        </LegalP>
      </LegalSection>

      <LegalSection id="o-que-nao-fazemos" title="5. O que não fazemos">
        <LegalP>Não vendemos dados coletados por cookies.</LegalP>
        <LegalP>
          Não usamos cookies para inferir informação sobre saúde, e não cruzamos dados de navegação
          no site com informações de atendimento clínico. Esses dois ambientes são separados.
        </LegalP>
      </LegalSection>

      <LegalSection id="prazo-de-guarda" title="6. Prazo de guarda">
        <LegalP>
          Cada cookie é apagado ao fim da duração indicada nas tabelas da cláusula 2, salvo se você o
          apagar antes pelo navegador. O registro do seu consentimento é guardado por 5 (cinco) anos,
          prazo necessário para comprovar o cumprimento da Lei nº 13.709/2018.
        </LegalP>
      </LegalSection>

      <LegalSection id="seus-direitos" title="7. Seus direitos">
        <LegalP>
          Você pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade,
          eliminação de dados tratados com base no consentimento e revogação do consentimento, nos
          termos do art. 18 da Lei nº 13.709/2018.
        </LegalP>
        <LegalP>
          Os pedidos devem ser enviados para <Placeholder>[EMAIL DO ENCARREGADO]</Placeholder>.
          Responderemos em até 15 (quinze) dias.
        </LegalP>
        <LegalP>
          Encarregado pelo tratamento de dados pessoais:{" "}
          <Placeholder>[NOME DO ENCARREGADO]</Placeholder>.
        </LegalP>
      </LegalSection>

      <LegalSection id="alteracoes" title="8. Alterações">
        <LegalP>
          Esta política pode mudar quando incluirmos ou retirarmos ferramentas do site. Alterações
          que envolvam nova categoria de cookies exigem novo consentimento, e o aviso reaparece no
          primeiro acesso seguinte.
        </LegalP>
        <LegalP>
          As versões anteriores ficam disponíveis em{" "}
          <Placeholder>[URL DO HISTÓRICO DE VERSÕES]</Placeholder>.
        </LegalP>
      </LegalSection>

      <LegalSection id="contato" title="9. Contato">
        <LegalAddress>
          Associação Allos
          <br />
          CNPJ <Placeholder>[CNPJ]</Placeholder>
          <br />
          <Placeholder>[ENDEREÇO COMPLETO]</Placeholder>
          <br />
          <Placeholder>[EMAIL INSTITUCIONAL]</Placeholder>
        </LegalAddress>
      </LegalSection>

      <LegalDivider />

      <LegalSection id="historico-de-versoes" title="Histórico de versões">
        <LegalTable
          caption="Histórico de versões da política de cookies"
          head={["Versão", "Vigência", "Alterações"]}
          rows={[["1.0", <Placeholder key="data">[DATA]</Placeholder>, "Versão inicial"]]}
        />
      </LegalSection>
    </LegalPage>
  );
}
