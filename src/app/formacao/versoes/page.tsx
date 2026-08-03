// Histórico de versões dos documentos legais.
//
// Existe porque a cláusula 17.3 dos Termos e a 8 da Política de cookies
// prometem que as versões anteriores ficam disponíveis. Enquanto só há a
// versão inicial de cada documento, esta página diz isso com todas as letras:
// documento legal com link quebrado é pior do que documento sem link.
//
// Ao publicar uma versão nova: acrescente a linha na tabela do documento,
// suba a constante em src/lib/legal/versoes.ts e guarde o texto anterior em
// /formacao/versoes/<documento>-<versao> antes de sobrescrever a página
// vigente. O aceite antigo continua valendo como prova do que foi aceito
// naquela data (ver tabela termos_aceites, migration 044).

import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, {
  LegalP,
  LegalSection,
  LegalTable,
  type LegalTocItem,
} from "@/components/legal/LegalPage";
import { VERSAO_COOKIES, VERSAO_TERMOS } from "@/lib/legal/versoes";

export const metadata: Metadata = {
  title: "Histórico de versões | Formação Allos",
  description:
    "Versões dos Termos de uso e da Política de cookies da Associação Allos, com data de vigência e o que mudou em cada uma.",
  openGraph: {
    title: "Histórico de versões | Formação Allos",
    description:
      "Versões dos documentos legais da plataforma de formação da Associação Allos.",
    type: "article",
    locale: "pt_BR",
  },
};

const toc: LegalTocItem[] = [
  { id: "termos-de-uso", label: "Termos de uso" },
  { id: "politica-de-cookies", label: "Política de cookies" },
  { id: "como-funciona", label: "Como as mudanças acontecem" },
];

export default function VersoesPage() {
  return (
    <LegalPage
      title="Histórico de versões"
      version="Atualizado em 1º de julho de 2026"
      effectiveFrom={
        <>
          Versões dos documentos legais da plataforma de formação, com data de
          vigência e o que mudou em cada uma.
        </>
      }
      toc={toc}
    >
      <LegalSection id="termos-de-uso" title="Termos de uso">
        <LegalP>
          Texto vigente em{" "}
          <Link href="/formacao/termos" className="text-accent hover:underline">
            allos.org.br/formacao/termos
          </Link>
          . Versão atual: {VERSAO_TERMOS}.
        </LegalP>

        <LegalTable
          caption="Versões dos Termos de uso"
          head={["Versão", "Vigência", "Alterações"]}
          rows={[
            [
              "1.0",
              "1º de julho de 2026",
              "Versão inicial.",
            ],
          ]}
        />

        <LegalP>
          Não houve alteração desde a publicação, então não há versão anterior
          arquivada até aqui.
        </LegalP>
      </LegalSection>

      <LegalSection id="politica-de-cookies" title="Política de cookies">
        <LegalP>
          Texto vigente em{" "}
          <Link href="/formacao/cookies" className="text-accent hover:underline">
            allos.org.br/formacao/cookies
          </Link>
          . Versão atual: {VERSAO_COOKIES}.
        </LegalP>

        <LegalTable
          caption="Versões da Política de cookies"
          head={["Versão", "Vigência", "Alterações"]}
          rows={[
            [
              "1.0",
              "1º de julho de 2026",
              "Versão inicial.",
            ],
          ]}
        />

        <LegalP>
          Não houve alteração desde a publicação, então não há versão anterior
          arquivada até aqui.
        </LegalP>
      </LegalSection>

      <LegalSection id="como-funciona" title="Como as mudanças acontecem">
        <LegalP>
          Alterações relevantes nos Termos de uso são comunicadas por e-mail e
          por aviso na plataforma com pelo menos 15 (quinze) dias de
          antecedência, e exigem novo aceite no primeiro acesso após a entrada
          em vigor, conforme as cláusulas 17.1 e 17.2. Quem não aceitar pode
          encerrar a conta, e os certificados já emitidos de forma regular
          continuam válidos.
        </LegalP>

        <LegalP>
          Alterações na Política de cookies que envolvam uma categoria nova
          exigem novo consentimento, e o aviso reaparece no primeiro acesso
          seguinte, conforme a cláusula 8 daquela política.
        </LegalP>

        <LegalP>
          Cada aceite fica registrado com data, hora, endereço IP e o número da
          versão aceita. Esse registro vale como prova do que foi aceito naquela
          data, mesmo depois de o documento ser atualizado.
        </LegalP>
      </LegalSection>
    </LegalPage>
  );
}
