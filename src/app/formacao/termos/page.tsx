import type { Metadata } from "next";
import LegalPage, {
  LegalAddress,
  LegalDivider,
  LegalItem,
  LegalList,
  LegalP,
  LegalSection,
  LegalTable,
  Placeholder,
  type LegalTocItem,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Termos de uso | Formação Allos",
  description:
    "Termos de uso da plataforma de formação da Associação Allos: cadastro, gratuidade, certificados, condutas vedadas, propriedade intelectual e limitação de responsabilidade.",
  openGraph: {
    title: "Termos de uso | Formação Allos",
    description:
      "Termos de uso da plataforma de formação da Associação Allos.",
    type: "article",
    locale: "pt_BR",
  },
};

const toc: LegalTocItem[] = [
  { id: "quem-somos", label: "1. Quem somos" },
  { id: "o-que-regulam", label: "2. O que estes termos regulam" },
  { id: "aceitacao", label: "3. Aceitação" },
  { id: "definicoes", label: "4. Definições" },
  { id: "cadastro-e-conta", label: "5. Cadastro e conta" },
  { id: "gratuidade", label: "6. Gratuidade e ausência de vínculo" },
  { id: "natureza-do-conteudo", label: "7. Natureza do conteúdo e responsabilidade profissional" },
  { id: "certificados", label: "8. Certificados" },
  { id: "condutas-vedadas", label: "9. Condutas vedadas" },
  { id: "medidas-aplicaveis", label: "10. Medidas aplicáveis" },
  { id: "propriedade-intelectual", label: "11. Propriedade intelectual" },
  { id: "conteudo-enviado", label: "12. Conteúdo enviado por você" },
  { id: "comunidade", label: "13. Comunidade e grupos de comunicação" },
  { id: "dados-pessoais", label: "14. Dados pessoais" },
  { id: "disponibilidade", label: "15. Disponibilidade da plataforma" },
  { id: "limitacao-de-responsabilidade", label: "16. Limitação de responsabilidade" },
  { id: "alteracoes", label: "17. Alterações destes termos" },
  { id: "vigencia-e-encerramento", label: "18. Vigência e encerramento" },
  { id: "boa-fe", label: "19. Boa-fé" },
  { id: "lei-e-foro", label: "20. Lei aplicável e foro" },
  { id: "contato", label: "21. Contato" },
  { id: "historico-de-versoes", label: "Histórico de versões" },
];

export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de uso"
      version="1.0"
      effectiveFrom="1º de julho de 2026"
      toc={toc}
    >
      <LegalSection id="quem-somos" title="1. Quem somos">
        <LegalP>
          A Associação Allos é uma associação civil sem fins lucrativos, inscrita no CNPJ sob o nº
          50.990.346/0001-52, com sede na Rua Rio Negro, 1048, bairro Barroca, CEP 30.431-058, Belo
          Horizonte, Minas Gerais, qualificada como Instituição Científica, Tecnológica e de Inovação
          (ICT) privada nos termos da Lei nº 10.973/2004.
        </LegalP>
        <LegalP>
          Neste documento, &quot;Allos&quot; ou &quot;nós&quot; se refere à Associação Allos.
          &quot;Você&quot; ou &quot;Usuário&quot; se refere a quem acessa o site ou a plataforma.
        </LegalP>
        <LegalP>
          Contato para qualquer assunto tratado aqui: suporte@allos.org.br.
        </LegalP>
      </LegalSection>

      <LegalSection id="o-que-regulam" title="2. O que estes termos regulam">
        <LegalP>
          Estes termos regulam o uso do site allos.org.br, da plataforma de formação da Allos, dos
          cursos e trilhas nela publicados e dos grupos de comunicação mantidos pela Allos.
        </LegalP>
        <LegalP>
          Estes termos não regulam a prestação de serviços psicológicos pela Allos, incluindo
          atendimento clínico, avaliação psicológica e supervisão contratada. Esses serviços têm
          contrato próprio, firmado diretamente entre a Allos e o interessado.
        </LegalP>
      </LegalSection>

      <LegalSection id="aceitacao" title="3. Aceitação">
        <LegalP>
          Ao criar uma conta na plataforma, você declara que leu estes termos, concorda com eles e se
          compromete a cumpri-los. Se você não concorda com alguma cláusula, não crie a conta.
        </LegalP>
        <LegalP>
          O aceite fica registrado com data, hora, endereço IP e número da versão aceita. Esse
          registro é a prova da sua concordância e pode ser apresentado por qualquer das partes.
        </LegalP>
        <LegalP>
          Ao continuar navegando no site sem criar conta, você concorda com as cláusulas 11, 14, 15,
          16 e 20.
        </LegalP>
      </LegalSection>

      <LegalSection id="definicoes" title="4. Definições">
        <LegalP>
          <strong className="font-semibold text-cream">Plataforma:</strong> o ambiente digital em que
          a Allos publica cursos, aulas e trilhas.
        </LegalP>
        <LegalP>
          <strong className="font-semibold text-cream">Conta:</strong> o cadastro individual que dá
          acesso à plataforma.
        </LegalP>
        <LegalP>
          <strong className="font-semibold text-cream">Curso:</strong> conjunto de aulas reunidas sob
          um mesmo título.
        </LegalP>
        <LegalP>
          <strong className="font-semibold text-cream">Aula:</strong> unidade de conteúdo, em geral
          um vídeo, que compõe um curso.
        </LegalP>
        <LegalP>
          <strong className="font-semibold text-cream">Trilha:</strong> percurso que reúne aulas de
          diferentes cursos em uma sequência definida pela Allos.
        </LegalP>
        <LegalP>
          <strong className="font-semibold text-cream">Certificado:</strong> documento emitido pela
          Allos que declara a conclusão de um curso ou trilha e a respectiva carga horária.
        </LegalP>
        <LegalP>
          <strong className="font-semibold text-cream">Conteúdo:</strong> todo material publicado
          pela Allos na plataforma ou no site.
        </LegalP>
        <LegalP>
          <strong className="font-semibold text-cream">Comunidade:</strong> os grupos de WhatsApp e
          demais canais mantidos pela Allos para comunicação com os usuários.
        </LegalP>
      </LegalSection>

      <LegalSection id="cadastro-e-conta" title="5. Cadastro e conta">
        <LegalP>
          5.1. Para criar conta você precisa ter 18 anos completos. Pessoas entre 16 e 18 anos podem
          se cadastrar com autorização e assistência do responsável legal, mediante solicitação pelo
          canal de contato.
        </LegalP>
        <LegalP>
          5.2. Os dados informados no cadastro devem ser verdadeiros e estar atualizados. O nome
          informado é o que constará dos certificados emitidos.
        </LegalP>
        <LegalP>
          5.3. A conta é pessoal e intransferível. Você não pode compartilhar suas credenciais nem
          permitir que outra pessoa acesse a plataforma com elas.
        </LegalP>
        <LegalP>
          5.4. Você responde por toda atividade registrada na sua conta. Se suspeitar de acesso
          indevido, avise a Allos imediatamente pelo canal de contato.
        </LegalP>
        <LegalP>
          5.5. A Allos pode solicitar confirmação de identidade quando houver dúvida sobre a
          titularidade da conta ou sobre a veracidade dos dados cadastrais, inclusive antes de emitir
          um certificado.
        </LegalP>
      </LegalSection>

      <LegalSection id="gratuidade" title="6. Gratuidade e ausência de vínculo">
        <LegalP>
          6.1. O acesso à plataforma de formação é gratuito. A Allos não cobra pelo acesso às aulas
          nem pela emissão dos certificados.
        </LegalP>
        <LegalP>
          6.2. O uso da plataforma não cria vínculo empregatício, estatutário, associativo ou de
          estágio entre você e a Allos. Também não gera direito de participação nos processos
          seletivos da Allos nem promessa de vaga.
        </LegalP>
        <LegalP>
          6.3. Os cursos publicados na plataforma são atividades de formação livre. Eles não integram
          o sistema federal de ensino, não são regulados ou reconhecidos pelo Ministério da Educação
          e não conferem diploma de graduação, pós-graduação, especialização ou título equivalente.
        </LegalP>
        <LegalP>
          6.4. A Allos pode criar, alterar, reorganizar, despublicar ou descontinuar cursos, aulas e
          trilhas a qualquer momento. Certificados já emitidos de forma regular continuam válidos.
        </LegalP>
      </LegalSection>

      <LegalSection
        id="natureza-do-conteudo"
        title="7. Natureza do conteúdo e responsabilidade profissional"
      >
        <LegalP>
          7.1. O conteúdo da plataforma tem finalidade formativa e é apresentado em caráter geral.
        </LegalP>
        <LegalP>
          7.2. Nenhum conteúdo da plataforma constitui supervisão clínica, orientação sobre caso
          concreto ou parecer técnico. Discussões de caso apresentadas nas aulas têm finalidade
          didática.
        </LegalP>
        <LegalP>
          7.3. Você é o único responsável pela sua prática profissional e responde por ela perante o
          Conselho Federal de Psicologia e os Conselhos Regionais, nos termos do Código de Ética
          Profissional do Psicólogo (Resolução CFP nº 10/2005).
        </LegalP>
        <LegalP>
          7.4. Alguns exercícios da plataforma indicam o uso de ferramentas de inteligência
          artificial. Essas ferramentas produzem respostas geradas automaticamente, que podem conter
          erros e não passam por revisão prévia da Allos. Elas não substituem supervisão.
        </LegalP>
        <LegalP>
          7.5. É vedado inserir em qualquer ferramenta de inteligência artificial indicada pela
          plataforma dados que permitam identificar pacientes, incluindo nome, endereço, local de
          trabalho, vínculo institucional ou qualquer combinação de informações capaz de levar à
          identificação. O sigilo profissional é seu, e a responsabilidade por rompê-lo também.
        </LegalP>
      </LegalSection>

      <LegalSection id="certificados" title="8. Certificados">
        <LegalP>
          8.1. A emissão do certificado depende do cumprimento dos critérios de conclusão definidos
          em cada curso ou trilha e informados na própria plataforma. Esses critérios podem incluir
          tempo mínimo de reprodução do conteúdo e aproveitamento em avaliação.
        </LegalP>
        <LegalP>
          8.2. O certificado declara a carga horária cumprida pelo titular. Ao apresentar um
          certificado da Allos a instituição de ensino, empregador ou órgão de classe, você declara a
          esse destinatário que cumpriu integralmente a carga horária nele descrita.
        </LegalP>
        <LegalP>
          8.3. Cada certificado recebe um código de autenticidade, verificável publicamente em{" "}
          <a
            href="/formacao/certificado/verificar"
            className="text-accent hover:underline"
          >
            allos.org.br/formacao/certificado/verificar
          </a>
          . A verificação informa se o documento é
          autêntico, se está válido e se foi anulado.
        </LegalP>
        <LegalP>
          8.4. A Allos audita os registros da plataforma, incluindo horário de acesso, progresso e
          tempo de reprodução de cada aula. A auditoria pode ser automática ou motivada por indício
          específico.
        </LegalP>
        <LegalP>
          8.5. Quando a auditoria apontar inconsistência entre os registros de uso e a carga horária
          declarada, a Allos reterá a emissão do certificado e comunicará o titular. Você terá 7
          (sete) dias corridos, contados do recebimento da comunicação, para se manifestar pelo canal
          indicado. A Allos analisará a manifestação em até 5 (cinco) dias úteis e decidirá pela
          emissão ou pela recusa.
        </LegalP>
        <LegalP>
          8.6. A Allos pode anular certificado já emitido quando ficar demonstrado que os critérios
          de conclusão não foram cumpridos, que houve uso de automação ou de qualquer outro meio para
          simular progresso, ou que os dados cadastrais do titular são falsos. A anulação segue o
          mesmo procedimento de comunicação e prazo previsto na cláusula 8.5.
        </LegalP>
        <LegalP>
          8.7. O certificado anulado passa a constar como anulado no verificador de autenticidade,
          com a data e o motivo da anulação.
        </LegalP>
        <LegalP>
          8.8. Quando o certificado anulado tiver sido apresentado a instituição de ensino,
          empregador ou órgão de classe, a Allos poderá comunicar a anulação diretamente ao
          destinatário, informando o número do certificado, a data de emissão e o motivo da anulação.
          Essa comunicação decorre do fato de a declaração de carga horária ser de autoria da Allos,
          que responde por sua veracidade. Ao aceitar estes termos, você reconhece essa
          possibilidade.
        </LegalP>
        <LegalP>
          8.9. As providências que o destinatário venha a adotar após a comunicação são de
          competência exclusiva dele e seguem as regras internas da instituição. A Allos não participa
          dessas decisões.
        </LegalP>
      </LegalSection>

      <LegalSection id="condutas-vedadas" title="9. Condutas vedadas">
        <LegalP>Você não pode:</LegalP>
        <LegalList>
          <LegalItem>
            a) burlar, desativar ou interferir nos controles de progresso, de reprodução ou de
            avaliação da plataforma;
          </LegalItem>
          <LegalItem>
            b) usar script, robô, extensão, emulador ou qualquer recurso de automação para simular
            acesso, reprodução de conteúdo ou conclusão de aulas;
          </LegalItem>
          <LegalItem>
            c) compartilhar credenciais de acesso ou permitir o uso da sua conta por terceiro;
          </LegalItem>
          <LegalItem>
            d) criar mais de uma conta para a mesma pessoa, salvo autorização expressa da Allos;
          </LegalItem>
          <LegalItem>
            e) alterar, editar ou reproduzir certificados emitidos pela Allos, ou apresentar como seu
            certificado emitido em nome de outra pessoa;
          </LegalItem>
          <LegalItem>
            f) apresentar a terceiro certificado da Allos sabendo que a carga horária nele declarada
            não foi cumprida;
          </LegalItem>
          <LegalItem>
            g) gravar, baixar, reproduzir, republicar ou distribuir o conteúdo da plataforma fora
            dela, por qualquer meio, sem autorização escrita da Allos;
          </LegalItem>
          <LegalItem>
            h) usar o conteúdo da plataforma para treinar, ajustar ou avaliar modelos de inteligência
            artificial, sem autorização escrita da Allos;
          </LegalItem>
          <LegalItem>i) coletar dados de outros usuários, por meio automatizado ou não;</LegalItem>
          <LegalItem>
            j) usar a plataforma ou a Comunidade para divulgação comercial não autorizada, captação
            de clientes, corrente de mensagens ou envio de spam;
          </LegalItem>
          <LegalItem>
            k) praticar assédio, discriminação, ameaça ou qualquer conduta que exponha outro usuário
            a constrangimento;
          </LegalItem>
          <LegalItem>
            l) publicar na plataforma ou na Comunidade informação que identifique paciente,
            supervisionando ou terceiro sem consentimento.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="medidas-aplicaveis" title="10. Medidas aplicáveis">
        <LegalP>
          10.1. Verificado o descumprimento destes termos, a Allos pode aplicar, conforme a gravidade
          e de forma isolada ou cumulativa: advertência, retenção da emissão de certificado, anulação
          de certificado, suspensão temporária da conta, encerramento definitivo da conta, remoção da
          Comunidade e comunicação a terceiros nos casos da cláusula 8.8.
        </LegalP>
        <LegalP>
          10.2. Antes de aplicar qualquer medida, a Allos comunicará o usuário e abrirá prazo de 7
          (sete) dias corridos para manifestação, salvo quando houver risco imediato à integridade da
          plataforma, à segurança de outros usuários ou a sigilo profissional, hipóteses em que a
          medida pode ser aplicada de imediato, com comunicação posterior.
        </LegalP>
        <LegalP>
          10.3. A aplicação dessas medidas não impede que a Allos adote as providências judiciais
          cabíveis, quando for o caso.
        </LegalP>
      </LegalSection>

      <LegalSection id="propriedade-intelectual" title="11. Propriedade intelectual">
        <LegalP>
          11.1. O conteúdo da plataforma e do site, incluindo textos, vídeos, apresentações,
          exercícios, materiais em PDF, marcas, logotipos, layout e código, pertence à Allos ou a
          terceiros que autorizaram seu uso.
        </LegalP>
        <LegalP>
          11.2. A Allos concede a você uma licença pessoal, não exclusiva, intransferível, revogável
          e sem fins comerciais, limitada ao acesso e à consulta do conteúdo pela própria plataforma,
          enquanto sua conta estiver ativa.
        </LegalP>
        <LegalP>
          11.3. A licença da cláusula 11.2 não autoriza download, cópia, republicação, exibição
          pública, uso em aulas ou treinamentos próprios, criação de obra derivada, nem qualquer uso
          comercial.
        </LegalP>
        <LegalP>
          11.4. Os nomes e marcas da Allos e de seus projetos não podem ser usados sem autorização
          escrita, inclusive em material de divulgação profissional.
        </LegalP>
      </LegalSection>

      <LegalSection id="conteudo-enviado" title="12. Conteúdo enviado por você">
        <LegalP>
          12.1. Ao enviar comentários, respostas de exercícios, dúvidas ou qualquer outro material
          pela plataforma, você garante que tem os direitos necessários sobre esse material e que ele
          não viola sigilo profissional.
        </LegalP>
        <LegalP>
          12.2. Você concede à Allos licença gratuita e não exclusiva para armazenar, exibir e
          moderar esse material dentro da plataforma, pelo tempo necessário à finalidade para a qual
          foi enviado.
        </LegalP>
        <LegalP>
          12.3. A Allos pode remover conteúdo enviado por usuário que viole estes termos, sem aviso
          prévio quando houver exposição de dado de terceiro.
        </LegalP>
      </LegalSection>

      <LegalSection id="comunidade" title="13. Comunidade e grupos de comunicação">
        <LegalP>
          13.1. A participação nos grupos mantidos pela Allos é voluntária e você pode sair a
          qualquer momento.
        </LegalP>
        <LegalP>
          13.2. Os grupos são moderados pela Allos ou por quem ela indicar. A moderação pode remover
          mensagens e participantes que descumpram a cláusula 9.
        </LegalP>
        <LegalP>
          13.3. Grupos vinculados a cursos encerrados podem ser arquivados, renomeados ou encerrados
          após o fim do curso.
        </LegalP>
      </LegalSection>

      <LegalSection id="dados-pessoais" title="14. Dados pessoais">
        <LegalP>
          14.1. O tratamento dos seus dados pessoais é descrito na Política de Privacidade,
          disponível em <Placeholder>[URL DA POLÍTICA]</Placeholder>, que integra estes termos.
        </LegalP>
        <LegalP>
          14.2. Para a finalidade específica de emitir e verificar certificados, a Allos trata os
          dados cadastrais, os registros de acesso, o progresso nos cursos e o tempo de reprodução de
          cada aula. Esse tratamento é necessário à execução da relação firmada por estes termos e ao
          exercício regular de direitos da Allos sobre declarações que ela própria emite.
        </LegalP>
        <LegalP>
          14.3. Na hipótese da cláusula 8.8, a Allos compartilhará com o destinatário do certificado
          apenas os dados necessários para identificar o documento anulado e o motivo da anulação.
        </LegalP>
        <LegalP>
          14.4. Os registros de acesso à plataforma são guardados pelo prazo de 6 (seis) meses,
          conforme o art. 15 da Lei nº 12.965/2014, e podem ser guardados por prazo maior quando
          necessário para apuração de descumprimento destes termos ou por determinação judicial.
        </LegalP>
        <LegalP>
          14.5. Para exercer seus direitos previstos na Lei nº 13.709/2018, escreva para
          suporte@allos.org.br.
        </LegalP>
      </LegalSection>

      <LegalSection id="disponibilidade" title="15. Disponibilidade da plataforma">
        <LegalP>
          15.1. A Allos empenha esforços para manter a plataforma disponível, sem garantir
          funcionamento ininterrupto ou livre de falhas.
        </LegalP>
        <LegalP>
          15.2. A plataforma pode ficar indisponível por manutenção, atualização ou motivo alheio ao
          controle da Allos.
        </LegalP>
        <LegalP>
          15.3. Caso a Allos decida descontinuar a plataforma, avisará os usuários com pelo menos 30
          (trinta) dias de antecedência e manterá, nesse período, o acesso para download dos
          certificados já emitidos.
        </LegalP>
      </LegalSection>

      <LegalSection id="limitacao-de-responsabilidade" title="16. Limitação de responsabilidade">
        <LegalP>
          16.1. A Allos não responde por decisões profissionais, clínicas ou acadêmicas que você tome
          a partir do conteúdo da plataforma.
        </LegalP>
        <LegalP>
          16.2. A Allos não responde pelo tratamento que instituições de ensino, empregadores ou
          órgãos de classe deem aos certificados por ela emitidos, nem pelo aproveitamento de carga
          horária, que depende de regras próprias de cada instituição.
        </LegalP>
        <LegalP>
          16.3. A Allos não responde por danos decorrentes de uso da conta por terceiro em razão de
          compartilhamento de credenciais pelo titular.
        </LegalP>
        <LegalP>
          16.4. Nenhuma cláusula deste documento afasta a responsabilidade da Allos por dolo ou por
          descumprimento de norma de ordem pública.
        </LegalP>
      </LegalSection>

      <LegalSection id="alteracoes" title="17. Alterações destes termos">
        <LegalP>
          17.1. A Allos pode alterar estes termos. Alterações relevantes serão comunicadas com pelo
          menos 15 (quinze) dias de antecedência, por email e por aviso na plataforma.
        </LegalP>
        <LegalP>
          17.2. Alterações relevantes exigem novo aceite no primeiro acesso após a entrada em vigor.
          Se você não aceitar, poderá encerrar a conta, e os certificados já emitidos de forma
          regular continuarão válidos.
        </LegalP>
        <LegalP>
          17.3. As versões anteriores ficam disponíveis em{" "}
          <a
            href="/formacao/versoes#termos-de-uso"
            className="text-accent hover:underline"
          >
            allos.org.br/formacao/versoes
          </a>
          .
        </LegalP>
      </LegalSection>

      <LegalSection id="vigencia-e-encerramento" title="18. Vigência e encerramento">
        <LegalP>18.1. Estes termos vigoram enquanto sua conta estiver ativa.</LegalP>
        <LegalP>
          18.2. Você pode encerrar sua conta a qualquer momento pelo canal de contato. O encerramento
          não anula certificados emitidos de forma regular.
        </LegalP>
        <LegalP>
          18.3. As cláusulas 8.6 a 8.9, 11, 14 e 16 continuam produzindo efeito após o encerramento
          da conta.
        </LegalP>
      </LegalSection>

      <LegalSection id="boa-fe" title="19. Boa-fé">
        <LegalP>
          As partes se obrigam a observar a boa-fé objetiva na execução destes termos, nos termos do
          art. 422 do Código Civil.
        </LegalP>
      </LegalSection>

      <LegalSection id="lei-e-foro" title="20. Lei aplicável e foro">
        <LegalP>20.1. Estes termos são regidos pela lei brasileira.</LegalP>
        <LegalP>
          20.2. Fica eleito o foro da comarca de Belo Horizonte, Minas Gerais, para dirimir
          controvérsias decorrentes destes termos, sem prejuízo do direito do usuário de demandar no
          foro de seu domicílio quando a lei assim assegurar.
        </LegalP>
      </LegalSection>

      <LegalSection id="contato" title="21. Contato">
        <LegalP>
          Dúvidas, pedidos e manifestações previstas nestes termos devem ser enviados para
          suporte@allos.org.br.
        </LegalP>
        <LegalAddress>
          Associação Allos
          <br />
          CNPJ 50.990.346/0001-52
          <br />
          Rua Rio Negro, 1048, Barroca, Belo Horizonte/MG, CEP 30.431-058
        </LegalAddress>
      </LegalSection>

      <LegalDivider />

      <LegalSection id="historico-de-versoes" title="Histórico de versões">
        <LegalTable
          caption="Histórico de versões dos termos de uso"
          head={["Versão", "Vigência", "Alterações"]}
          rows={[["1.0", "1º de julho de 2026", "Versão inicial"]]}
        />
      </LegalSection>
    </LegalPage>
  );
}
