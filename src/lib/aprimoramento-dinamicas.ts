// Lista curada de exercícios pra grupos de aprimoramento clínico.
// Conteúdo restrito a usuários com role "associado".
// Cada exercício é renderizado a partir do array `blocks`, preservando a estrutura
// e o texto integral da Lista Curada de Exercícios.

export type Block =
  | { type: "heading"; text: string; level?: 2 | 3 | 4 }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "orderedList"; items: string[] }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "callout"; text: string }
  | { type: "reference"; text: string; url?: string }
  | { type: "link"; label: string; url: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export type CategorySlug =
  | "relacao"
  | "tecnica"
  | "autoconhecimento"
  | "manejo"
  | "operacional";

export type Pessoas = "solo" | "dupla" | "grupo" | "supervisor";

export type FormatoSlug =
  | "roleplay"
  | "reflexao"
  | "discussao"
  | "preenchimento"
  | "supervisao";

export interface Exercise {
  slug: string;
  number: number;
  title: string;
  summary: string;
  category: CategorySlug;
  duracaoMin: [number, number]; // [min, max] em minutos
  formato: FormatoSlug[];
  pessoas: Pessoas;
  tags: string[];
  recursos?: string[];
  /**
   * Indica se o exercício passou por revisão/curadoria. Os 13 originais são
   * `curado: true` (default ausente também conta como curado). Exercícios
   * importados da "Lista não-curada" entram com `curado: false` — mostram
   * selo "Não-curado" na UI e podem ter conteúdo bruto, sem revisão.
   */
  curado?: boolean;
  blocks: Block[];
}

export const EXERCISES: Exercise[] = [
  {
    slug: "preconceitos-e-estereotipos",
    number: 1,
    title: "Preconceitos e estereótipos",
    summary:
      "Desenvolver decisões clínicas individualizadas em vez de suposições baseadas em pertencimento a grupos.",
    category: "autoconhecimento",
    duracaoMin: [45, 90],
    formato: ["preenchimento", "discussao"],
    pessoas: "grupo",
    tags: ["preconceito", "interseccionalidade", "questionários"],
    blocks: [
      { type: "heading", text: "Contextualização" },
      {
        type: "paragraph",
        text:
          "Ao falar sobre nossos clientes com outros profissionais, frequentemente os descrevemos com base em seus transtornos ou em variáveis demográficas básicas (por exemplo, idade, gênero, etnia, orientação sexual). Embora tais descrições permitam uma comunicação rápida e fácil, elas podem resultar em suposições errôneas, simplistas e estereotipadas. Este exercício é projetado para ajudar terapeutas a desenvolverem suas habilidades para tomar decisões individualizadas sobre os clientes, em vez de se basearem em suposições coletivas (seja baseadas em verdades estatísticas ou em preconceitos individuais). Além disso, é importante, na execução do exercício, avaliar se as variáveis básicas são as mais pertinentes ou se — ainda mantendo a análise a partir do pertencimento a grupos — existem outras variáveis mais relevantes a serem consideradas em uma análise interseccional.",
      },
      {
        type: "quote",
        text:
          "O alinhamento pode ser, e muitas vezes é, importante para um cliente, mas não para todas as pessoas com uma qualidade, traço, histórico ou identidade semelhantes. Assim, o foco deve ser colocado nas preferências e valores individuais, em vez do grupo ao qual pertencem.",
        attribution:
          "APA. (2022). A Field Guide to Better Results: Evidence-Based Practice for Practitioners. American Psychological Association.",
      },
      { type: "heading", text: "Tarefa" },
      {
        type: "paragraph",
        text:
          "Escolha 4-8 colegas com quem você não tenha tanta intimidade e busque classificá-los de forma interseccional, partindo dos grupos aos quais eles pertencem (idade, gênero, sexualidade, religião, crença política...). Fantasie, caso você não saiba a resposta.",
      },
      {
        type: "paragraph",
        text:
          "Agora, escolha três questionários (BuzzFeed ou psicométricos: Political Compass, BFP, Statistical \u201CWitch Character\u201D Personality Quiz...). Responda e anote previamente o que você supõe que a pessoa responderá, justificando sempre com base no grupo ao qual a pessoa pertence.",
      },
      {
        type: "paragraph",
        text:
          "Faça o teste com a pessoa ao lado, apresentando seus preconceitos e justificando-os. Reflita sobre o quão distante sua expectativa ficou da realidade:",
      },
      {
        type: "list",
        items: [
          "A — Houve alguma categoria em que você errou ou acertou regularmente? Ex.: Ao pensar no sujeito como membro de uma comunidade religiosa, eu sempre errei minhas expectativas, mas ao responder com base no gênero fui bem mais preciso.",
          "B — Comparando a experiência com outros colegas, será que sou particularmente bom em intuir qual grupo é relevante em uma análise interseccional?",
          "C — Quando houve discrepância entre minha resposta e a da pessoa, foi mais plausível pensar que a individualidade dela se opõe à regra geral do grupo ao qual pertence, ou será que meus conceitos sobre o grupo estavam imprecisos?",
          "D — Será que na minha clínica eu deveria ler de forma mais individualizada, ou será que as categorias gerais me permitiram notar novos fenômenos?",
        ],
      },
      { type: "heading", text: "Dicas" },
      {
        type: "list",
        items: [
          "Tente fazer o exercício com pessoas que você não conhece tão bem, de preferência pessoas que sejam mais distantes de você;",
          "Esse é um exercício que pode ser feito em dupla ou em grupo, discutindo antes as hipóteses de cada um sobre o sujeito experimental;",
          "Use o momento de fazer o teste com a pessoa para expressar e coletar feedback sobre seu raciocínio. Às vezes, o preconceito está afiado, mas o erro foi na análise interseccional. Ex.: Julguei que era uma pessoa menos responsável com base na classe social, mas não considerei que era primogênito.",
        ],
      },
    ],
  },
  {
    slug: "aprendendo-a-fazer-prontuario",
    number: 2,
    title: "Aprendendo a Fazer Prontuário",
    summary:
      "Praticar o registro organizado e seguro de atendimentos por meio de roleplay e preenchimento conjunto.",
    category: "operacional",
    duracaoMin: [40, 60],
    formato: ["roleplay", "preenchimento", "discussao"],
    pessoas: "grupo",
    tags: ["prontuário", "registro", "ética"],
    blocks: [
      { type: "heading", text: "Contextualização" },
      {
        type: "paragraph",
        text:
          "Não apenas como organização pessoal dos atendimentos, mas também como exigência em muitos trabalhos, o prontuário do terapeuta é uma ferramenta importante para o registro organizado e seguro das informações relacionadas aos pacientes. Além de uma exigência ética e legal, o prontuário ajuda a garantir a qualidade do atendimento e da eficiência clínica. Ademais, o prontuário também pode servir como um histórico de atendimentos, permitindo que o terapeuta tenha acesso rápido e objetivo a informações relevantes sobre seus casos, principalmente para acompanhar a evolução dos mesmos.",
      },
      { type: "heading", text: "Descrição" },
      { type: "heading", text: "1º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Contextualização sobre o prontuário e sua importância. O monitor deve explicar quais são os itens que compõem o prontuário, como os dados relativos à identificação do paciente, o motivo do atendimento, seu histórico, principais queixas, medicações em uso, etc.",
      },
      { type: "heading", text: "2º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Aqui o monitor convida alguém para interpretar o terapeuta (ou um segundo monitor faz isso) e ele mesmo interpreta o paciente, para que a cena possa melhor corresponder ao desejado. A ideia é que os demais participantes, sozinhos ou em dupla, façam um preenchimento de prontuário de acordo com o observado nesse atendimento, que deve ter entre quinze e vinte minutos.",
      },
      { type: "heading", text: "Exemplo de caso para interpretar", level: 4 },
      {
        type: "paragraph",
        text:
          "\u201CFernanda está em terapia há três meses e sua principal reclamação é sobre seu relacionamento com a namorada, dez anos mais velha. Elas estão juntas há quase dois anos, e a namorada (Alice), costuma, segundo ela, querer controlar seu comportamento e ditar quais escolhas ela deveria fazer.",
      },
      {
        type: "paragraph",
        text:
          "As duas estão morando juntas há um ano, e aparentemente pode haver uma relação de co-dependência, porém ela não tem consciência disso.",
      },
      {
        type: "paragraph",
        text:
          "Nesta sessão, Fernanda trouxe uma discussão mais séria entre as duas. O motivo é que ela conseguiu uma nota no Enem o suficiente para pegar uma bolsa parcial em uma faculdade particular e por isso quer sair da universidade pública onde estuda e pedir transferência para a outra. Porém Alice não aceita isso, pois diz que o ensino da universidade dela (onde Alice se formou), é o melhor, e que ela se arrependeria depois.",
      },
      {
        type: "paragraph",
        text:
          "Pontos importantes do caso: O ponto principal é porque Fernanda precisa da aprovação da namorada para tomar suas próprias decisões e por isso sustenta essa dinâmica de precisar justificar o que faz, se sentindo mal com as próprias decisões caso Alice não concorde com elas.\u201D",
      },
      { type: "heading", text: "3º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "O monitor pede que os participantes leiam o que escreveram no prontuário, ou que coloquem no chat para que possa ser lida. Além disso, proponha uma discussão sobre esses elementos.",
      },
      {
        type: "paragraph",
        text:
          "Deve ser prezado a escrita sucinta, de maneira que o terapeuta ofereça uma visão geral dos principais pontos que ocorreram no atendimento, preferencialmente em texto corrido e não em tópicos.",
      },
      {
        type: "list",
        items: [
          "Qual foi o tema principal desta sessão? O paciente está se queixando sobre uma atitude que teve ao ver um casal heteronormativo, apresenta dualidade no julgamento sobre suas ações, com imprecisão sobre o que realmente o motivou. Explorei as motivações dele, como ele se sentiu após sua conduta e apontei as contradições presentes no discurso dele.",
          "Como o paciente reagiu às intervenções e discussões?",
          "Quais serão as futuras intervenções?",
          "Alguma observação adicional?",
        ],
      },
      {
        type: "paragraph",
        text:
          "O monitor deve incentivar os participantes a falarem suas dúvidas e experiências em relação a prontuários e ao registro da evolução do paciente. Quais pontos acham mais fáceis de serem feitos e quais têm mais dificuldade, bem como a compartilharem as experiências que já possuem (caso possuam experiência com isso) com a construção de prontuários no atendimento clínico.",
      },
    ],
  },
  {
    slug: "feedback-negativo",
    number: 3,
    title: "Feedback Negativo",
    summary:
      "Aumentar o conforto e a responsividade do terapeuta às críticas negativas dos pacientes.",
    category: "relacao",
    duracaoMin: [45, 75],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "dupla",
    tags: ["feedback", "crítica", "resiliência", "aliança"],
    blocks: [
      { type: "heading", text: "Contextualização" },
      {
        type: "paragraph",
        text:
          "O feedback é, atualmente, a principal métrica para a mensuração dos resultados em psicologia. As pesquisas em prática deliberada, inclusive, utilizam o feedback dos pacientes como métrica para a melhora do terapeuta na performance clínica. Dessa forma, o que o paciente tem a dizer sobre a sessão é um parâmetro importante, e receber feedbacks críticos pode acabar sendo uma tarefa desagradável.",
      },
      {
        type: "paragraph",
        text:
          "Uma característica que pode tornar a situação ainda mais desconfortável é quando um paciente apresenta uma perspectiva da atuação do terapeuta que não corresponde à sua própria. Por exemplo, um paciente que diz não se sentir escutado, apesar de o analista considerar que está fazendo um bom trabalho de escuta. Além disso, responder de maneira eficaz no momento da crítica pode ser desafiador, e um bom terapeuta deve estar pronto para lidar com a insatisfação de seus pacientes.",
      },
      {
        type: "paragraph",
        text:
          "Ademais, as críticas de um paciente não significam necessariamente que o processo terapêutico está comprometido. Um indivíduo pode, inclusive, recorrer a críticas ao terapeuta, à condução clínica e à abordagem utilizada como forma de resistência à mudança. Portanto, resiliência para receber feedbacks negativos, controle e conhecimento para lidar e responder de maneira produtiva, e a capacidade de discernir o teor da crítica — seja ela uma insatisfação genuína ou uma resistência à mudança — são ferramentas essenciais para a melhoria da prática clínica.",
      },
      {
        type: "paragraph",
        text:
          "Este exercício é desenvolvido para aumentar o conforto e a responsividade às críticas negativas por parte do paciente.",
      },
      { type: "heading", text: "Descrição" },
      { type: "heading", text: "1º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Contextualização do exercício proposto. Exponha para o grupo, com base no texto acima, a importância de saber lidar com feedbacks negativos de forma produtiva. Além disso, ressalte a dualidade dos possíveis motivos por trás das críticas.",
      },
      { type: "heading", text: "2º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Peça para que o grupo dedique um tempo para refletir sobre os feedbacks que mais os preocupam em receber dos clientes. Podem ser declarações amplas sobre sua competência geral, sua condução clínica, julgamentos em relação à sua aparência, entre outros. Cada indivíduo deve expor para o grupo suas preocupações e os motivos por tê-las. Por exemplo, uma pessoa com tatuagens expostas no corpo pode se sentir insegura em relação à imagem que passa ao paciente, pois já foi, diversas vezes ao longo de sua vida, associada a marginais por pessoas mais velhas.",
      },
      { type: "heading", text: "3º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Proponha então um roleplay de atendimento, de 15 minutos, no qual o cliente vai apresentar um feedback negativo ao terapeuta, baseado nas preocupações individuais de cada um.",
      },
      {
        type: "paragraph",
        text:
          "Primeiramente, separe o grupo em diversas duplas. A ideia é que todos passem por uma rodada atendendo e outra sendo atendidos. Se alguém ficar sem par, você pode ser o parceiro dessa pessoa.",
      },
      {
        type: "paragraph",
        text:
          "Oriente para que um integrante da dupla crie uma nova chamada de vídeo e envie o link no chat do grupo para que seu par entre. No primeiro roleplay, um será o paciente e o outro o terapeuta. Instrua que o paciente deve sustentar uma posição que incomode o terapeuta. O objetivo do terapeuta é ouvir as críticas e lidar de forma produtiva com elas, ou seja:",
      },
      {
        type: "list",
        items: [
          "Resiliência para receber feedbacks negativos;",
          "Controle e conhecimento para lidar e responder de maneira produtiva;",
          "Capacidade de discernir o teor da crítica: se é uma insatisfação genuína ou uma resistência à mudança.",
        ],
      },
      {
        type: "paragraph",
        text:
          "Terminado o primeiro roleplay, os papeis devem ser invertidos, e o segundo roleplay terá início, com as mesmas regras. Ao final, a dupla deve voltar ao grupo geral e informar no chat que concluíram o exercício.",
      },
      { type: "heading", text: "4º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Encerrados os atendimentos, peça para que cada um da dupla dê um feedback sobre como foi a sessão para o outro. Os pontos a serem considerados na qualidade do atendimento são:",
      },
      { type: "heading", text: "Para o paciente", level: 4 },
      {
        type: "list",
        items: [
          "Como foi a condução do terapeuta?",
          "Ele respeitou a opinião do paciente?",
          "Qual foi a postura dele frente à crítica realizada?",
        ],
      },
      { type: "heading", text: "Para o terapeuta", level: 4 },
      {
        type: "list",
        items: [
          "Como o terapeuta lidaria com a crítica? Qual seria o prognóstico a partir do comentário do paciente?",
          "Como ele se sentiu?",
          "Faz sentido interpretar o feedback como algo que precisa ser alterado ou mais como uma resistência (esquiva, fuga do contato)?",
        ],
      },
    ],
  },
  {
    slug: "a-boca-fala-uma-coisa-o-corpo-outra",
    number: 4,
    title: "A boca fala uma coisa, o corpo outra",
    summary:
      "Sensibilizar para a expressão corporal e o descompasso entre discurso verbal e linguagem do corpo.",
    category: "tecnica",
    duracaoMin: [30, 60],
    formato: ["roleplay", "discussao"],
    pessoas: "grupo",
    tags: ["corpo", "não-verbal", "comunicação", "terapia online"],
    recursos: ["vídeo/filme opcional para variação"],
    blocks: [
      { type: "heading", text: "Contextualização" },
      {
        type: "paragraph",
        text:
          "Na prática clínica, o que os pacientes verbalizam pode nem sempre refletir com precisão suas emoções, conflitos ou verdadeiras intenções. Muitas vezes, o corpo revela o que as palavras tentam ocultar ou minimizar. A comunicação não verbal, por meio da postura, gestos, expressões faciais e outros sinais corporais, desempenha um papel crucial na compreensão plena do paciente. Psicólogos e outros profissionais da saúde mental precisam estar atentos a esses sinais não verbais para acessar camadas mais profundas das emoções e pensamentos dos pacientes. Quando há um descompasso entre a fala e a expressão corporal, o terapeuta deve estar atento não somente ao discurso oral do paciente, mas também às discrepâncias para perceber aquilo que o paciente pode não estar verbalizando diretamente.",
      },
      { type: "heading", text: "Objetivo" },
      {
        type: "paragraph",
        text:
          "Sensibilizar os participantes sobre a importância da expressão corporal e expandir suas estratégias de atenção, presença e uso do corpo na clínica. Para isso, simular um atendimento em que o que é vocalizado pelo paciente difere do que é expresso corporalmente (não verbalmente).",
      },
      { type: "heading", text: "Dinâmica" },
      { type: "heading", text: "Momento 1", level: 3 },
      {
        type: "paragraph",
        text:
          "Faça um roleplay de 15 minutos de duração. Aos participantes que irão fazer o papel de paciente, o monitor vai passar a seguinte orientação, sem que os demais saibam: o paciente deve dizer algo em seu discurso, mas expressar um afeto diferente por meio do corpo (postura, gestos, maneirismos, expressões faciais). Oriente os demais participantes a ficarem atentos ao atendimento. (Talvez o role-play possa ser adaptado; em vez disso, pode-se usar um vídeo, filme ou série que ilustra o descompasso entre o dito e o expresso).",
      },
      { type: "heading", text: "Momento 2", level: 3 },
      {
        type: "paragraph",
        text:
          "Peça aos participantes que conduziram o caso para compartilharem suas impressões e as estratégias que utilizaram durante o atendimento. Em seguida, abra o espaço para que os demais participantes também compartilhem suas percepções e discutam como investigariam o caso apresentado. O monitor deve direcionar a conversa especificamente para a análise das expressões corporais do paciente, questionando como essas expressões poderiam ser investigadas e quais intervenções poderiam ser feitas a partir delas. Durante a discussão, conduza a reflexão para a ideia de que o discurso verbal nem sempre traz todas as informações sobre o caso e que, muitas vezes, o que é dito não condiz com o que está sendo expressado corporalmente. Por fim, amplie a discussão sobre quais recursos e estratégias os participantes utilizam para integrar a dimensão corporal no processo terapêutico, promovendo uma troca de ideias que enriqueça o aprendizado coletivo.",
      },
      { type: "heading", text: "Variação" },
      {
        type: "paragraph",
        text:
          "Aqui está uma sugestão de exercício para psicólogos explorarem o uso do corpo na terapia virtual:",
      },
      {
        type: "orderedList",
        items: [
          "Discussão Teórica: Inicie a sessão com uma breve discussão sobre a importância do corpo na terapia e como isso pode ser relevante mesmo em um ambiente virtual. Explique como a consciência corporal pode ser uma ferramenta poderosa para ajudar os clientes a explorarem e compreenderem suas emoções e experiências.",
          "Expressão Corporal: Peça aos clientes para expressarem suas emoções através do corpo. Isso pode incluir gestos, postura, movimentos ou mesmo expressões faciais. Explore como as emoções se manifestam fisicamente e como essas manifestações podem ser observadas e exploradas durante a terapia online.",
          "Feedback e Reflexão: Após o exercício, convide os clientes a compartilharem suas experiências e observações. Discuta como a consciência corporal pode ser integrada às sessões de terapia virtual e como isso pode beneficiar seu processo terapêutico.",
          "Encerramento: Encerre a sessão reforçando a importância da consciência corporal na terapia virtual e incentivando os clientes a continuarem explorando essa dimensão de si mesmos.",
        ],
      },
      {
        type: "paragraph",
        text:
          "Esse exercício pode ajudar terapeutas a entenderem como o corpo pode desempenhar um papel vital na terapia online e a desenvolverem habilidades para integrar a consciência corporal em seu trabalho terapêutico.",
      },
    ],
  },
  {
    slug: "a-internet-esta-instavel",
    number: 5,
    title: "A internet está instável",
    summary:
      "Simular a perda do retorno audiovisual durante atendimento online e mapear estratégias clínicas.",
    category: "operacional",
    duracaoMin: [30, 45],
    formato: ["roleplay", "discussao"],
    pessoas: "grupo",
    tags: ["tele-atendimento", "câmera", "presença virtual"],
    recursos: ["chamada de vídeo"],
    blocks: [
      { type: "heading", text: "Contextualização" },
      {
        type: "paragraph",
        text:
          "Nos atendimentos online, os psicoterapeutas precisam se adaptar e desenvolver estratégias específicas para abordar o corpo físico e as expressões corporais dos pacientes. Essa adaptação se torna ainda mais desafiadora quando há instabilidade na internet, o que pode resultar na perda do retorno audiovisual do paciente.",
      },
      { type: "heading", text: "Objetivo" },
      {
        type: "paragraph",
        text:
          "Simular um cenário em que tanto paciente como terapeuta ficam sem o vídeo durante sua sessão para investigar dificuldades e recursos que os terapeutas utilizam neste cenário.",
      },
      { type: "heading", text: "Dinâmica" },
      {
        type: "list",
        items: [
          "Pelo menos 1 monitor",
          "Pelo menos 2 voluntários",
          "Ouvintes / outros participantes",
        ],
      },
      { type: "heading", text: "Momento 1", level: 3 },
      {
        type: "paragraph",
        text:
          "Pedir voluntários para simular dois atendimentos de 15 minutos no máximo, em algum momento da sessão o monitor vai dizer \u201Ca internet está instável\u201D e ambos os participantes precisam fechar as câmeras e dar continuidade a sessão.",
      },
      { type: "heading", text: "Momento 2", level: 3 },
      {
        type: "paragraph",
        text:
          "Pedir aos participantes voluntários que compartilhem sua experiência e o que notaram de mudança entre o momento de câmera ligada e câmera desligada. Pedir que o grupo maior compartilhe suas impressões e experiências de atendimento em que isso aconteceu. Incentivar para que compartilhem suas estratégias para adaptar sua clínica na ausência desse feedback/presença virtual, pergunta provocadora: em que momentos que desligar as câmeras podem ser usados como estratégia? (a psicanálise por exemplo utiliza esse recurso, com que intenção?)",
      },
    ],
  },
  {
    slug: "o-que-eu-consigo-e-quero-atender",
    number: 6,
    title: "O que eu consigo e quero atender?",
    summary:
      "Mapear demandas com as quais não se sente apto e definir um plano de capacitação ou recorte de nicho.",
    category: "autoconhecimento",
    duracaoMin: [45, 90],
    formato: ["reflexao", "preenchimento"],
    pessoas: "solo",
    tags: ["limites", "nicho", "capacitação", "plano de ação"],
    blocks: [
      { type: "heading", text: "Contextualização" },
      {
        type: "paragraph",
        text:
          "Ao atuar em ambientes variados como hospitais, escolas e clínicas especializadas, o terapeuta se depara com clientes de perfis diversos e demandas igualmente distintas. É crucial que o profissional tenha clareza sobre quais queixas e situações ele se sente apto para lidar, assim como sobre aquelas que podem representar um desafio maior.",
      },
      {
        type: "paragraph",
        text:
          "Esse exercício de mapeamento proposto é essencial não apenas para identificar áreas de difícil manejo, mas também para ajudar a definir um nicho de atuação, alinhado ao perfil de clientes com os quais o terapeuta deseja trabalhar. Com esse conhecimento, o profissional pode se posicionar de forma mais estratégica, desenvolvendo competências específicas e garantindo um atendimento mais eficaz e direcionado.",
      },
      {
        type: "paragraph",
        text:
          "Além disso, transmitir confiança para o paciente é um dos fatores com um dos maiores tamanhos de efeito para melhores resultados em terapia. Nesse sentido, é importante conhecer suas limitações, não somente no sentido do que te é desafiador, mas também as demandas que você não se sente confortável para atender, portanto, podendo impactar em sua confiança na clínica.",
      },
      {
        type: "quote",
        text:
          "O encontro inicial entre o paciente e o terapeuta é essencialmente o encontro de dois estranhos, com o paciente avaliando se o terapeuta é confiável, tem a expertise necessária e se dedicará a entender tanto o problema quanto o contexto em que o paciente e o problema estão inseridos.",
      },
      {
        type: "reference",
        text:
          "Bambling, M. (2011). The Integrative Psychotherapy Alliance: Theoretical, Clinical and Research Perspectives.",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4592639/",
      },
      {
        type: "table",
        headers: [
          "Demandas que eu não me sinto apto a atender",
          "Motivos para me sentir assim",
          "Eu quero atender / ser capaz de atender essa demanda?",
          "O que eu posso fazer para me sentir apto?",
        ],
        rows: [
          [
            "ex: pacientes com transtorno de personalidade borderline",
            "falta de conhecimento teórico",
            "sim",
            "realizar um curso de DBT + pedir orientação do professor X especializado em TPB",
          ],
        ],
      },
      { type: "heading", text: "Descrição" },
      { type: "heading", text: "1º momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Preencha a tabela com as demandas que você não se sente preparado para atender. Neste primeiro momento, pense de forma ampla e considere todas as situações em que você possa não se sentir confortável, seja por conflitos com suas crenças pessoais, por falta de conhecimento (teórico ou prático), ou por se relacionarem muito com questões pessoais suas ou de pessoas próximas, que possam enviesar sua percepção ou gerar emoções fortes que comprometem o atendimento. Inclua qualquer outro motivo que considere relevante.",
      },
      { type: "heading", text: "2º momento", level: 3 },
      {
        type: "paragraph",
        text: "Especifique o motivo para não se sentir apto a lidar com cada demanda listada (na segunda coluna da tabela).",
      },
      { type: "heading", text: "3º momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Reflita se você deseja ou pretende se capacitar para atender essas demandas e registre sua decisão na terceira coluna. Se a resposta for sim, siga para o próximo passo. Se for não, o exercício para essa demanda termina aqui, mas mantenha o registro — ele é essencial para definir o perfil de clientes que você atenderá.",
      },
      { type: "heading", text: "4º momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Para as demandas que você gostaria de atender ou desenvolver a capacidade de atender, anote na quarta e última coluna as ações necessárias para se sentir mais preparado.",
      },
      { type: "heading", text: "Sugestões", level: 4 },
      {
        type: "orderedList",
        items: [
          "Conflitos com crenças pessoais: reflita sobre o grau de incompatibilidade que esses conflitos podem gerar. Apesar das diferenças, sou capaz de me conectar com o paciente e estabelecer uma relação terapêutica sólida? O conflito surge de uma possível atitude preconceituosa da minha parte? Esse conflito interfere diretamente na demanda principal do paciente ou é algo que não impacta significativamente o processo terapêutico?",
          "Desconhecimento teórico/prático: analise qual é a melhor forma de buscar esse conhecimento. Ele pode ser adquirido em supervisões, livros didáticos, videoaulas, cursos específicos, grupos de aprimoramento e/ou prática clínica, roleplays com a presença de um supervisor, conversas com professores e colegas, estudos e pesquisas, etc. As possibilidades são inúmeras, você deve escolher aquilo que trará a melhor relação custo (incluindo esforço)/benefício para você e que suprirá sua necessidade de forma mais precisa e pontual o possível;",
          "Fortes semelhanças com questões pessoais: faça uma auto observação para avaliar o quanto essas situações te impactam emocionalmente e se você se sente preparado para lidar com essas emoções no papel de terapeuta. Se estiver em psicoterapia, é importante discutir isso com seu terapeuta, pois essas questões podem ainda não estar totalmente resolvidas em você.",
        ],
      },
      { type: "heading", text: "5º momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Após ter essas possibilidades registradas, escolha uma demanda que deseja trabalhar primeiro (você pode classificá-las em nível de facilidade/esforço/tempo como critério). Monte um plano de ação baseado nessas possibilidades e o realize (pode levar algum tempo). Uma vez que o plano de ação esteja feito, reflita se agora você se sente apto para atender tal demanda. Caso sim, faça o mesmo para outras demandas (cada uma com seu plano de ação individualizado). Caso não, volte ao segundo passo e tente identificar o que está faltando ou onde ocorreu o equívoco. Reflita sobre as áreas que precisam de mais atenção para entender o que está impedindo seu progresso. Realizar essa etapa final com o apoio de um supervisor pode proporcionar bons insights, ajudando a esclarecer dúvidas e fortalecer sua prática.",
      },
    ],
  },
  {
    slug: "set-your-heart-right-adaptado",
    number: 7,
    title: "Set Your Heart Right (Adaptado)",
    summary:
      "Adaptar a reflexão sobre a preparação pré-sessão ao estilo terapêutico individual.",
    category: "autoconhecimento",
    duracaoMin: [45, 60],
    formato: ["reflexao", "discussao"],
    pessoas: "solo",
    tags: ["preparação", "presença", "estilo", "rotina"],
    blocks: [
      { type: "heading", text: "Objetivo" },
      {
        type: "paragraph",
        text:
          "O objetivo é adaptar a reflexão para cada estilo terapêutico individual e permitir que o terapeuta escolha como se preparar, de acordo com sua personalidade e estilo de atendimento.",
      },
      { type: "heading", text: "Contextualização" },
      {
        type: "paragraph",
        text:
          "A preparação antes de uma sessão terapêutica pode variar significativamente de terapeuta para terapeuta, dependendo de sua personalidade, estilo de atendimento e preferências individuais. Alguns profissionais encontram maior segurança e foco ao se preparar detalhadamente, enquanto outros preferem uma abordagem mais espontânea. Este exercício tem como objetivo adaptar a reflexão sobre o processo de preparação para cada estilo terapêutico, permitindo que o terapeuta faça escolhas conscientes sobre como se preparar, considerando sua própria forma de atuação e o que mais se alinha ao seu estilo pessoal.",
      },
      {
        type: "callout",
        text:
          "Obs.: O Field Guide constatou que, apesar da preparação tornar o terapeuta mais presente, isso não significa melhores resultados. Porém, a ideia aqui é adaptar para cada clínica individual, dando a possibilidade para o terapeuta de escolher se preparar ou não dependendo de sua personalidade.",
      },
      { type: "heading", text: "1º Momento: Reflexão sobre preparação", level: 3 },
      {
        type: "paragraph",
        text:
          "Neste momento, o foco é gerar uma reflexão sobre como o terapeuta se prepara para as sessões e como essa preparação influencia seu trabalho clínico. Algumas perguntas-chave a serem abordadas podem ser:",
      },
      {
        type: "list",
        items: [
          "Você se prepara para a sessão? Caso positivo, descreva como ocorre essa preparação (ex.: revisão de prontuários, reflexão sobre o paciente, meditação, etc.). Caso não, explore o motivo e se existe interesse em começar.",
          "Você sente que fica mais presente e focado quando se prepara? O terapeuta deve analisar o impacto direto da preparação na sua presença clínica e na sua capacidade de prestar atenção nos detalhes da sessão.",
          "A sessão é mais confortável quando há preparação? Aqui, o terapeuta pode discutir se a preparação diminui a ansiedade ou o estresse, e se isso melhora a qualidade do atendimento.",
          "Quais são os momentos de desconforto ou tensão no atendimento? Incentivar o terapeuta a identificar situações específicas de desconforto, como confrontações, momentos de silêncio ou temas difíceis.",
          "Essas situações de desconforto/tensão são mais ou menos frequentes quando há preparação prévia? O terapeuta deve refletir se a preparação diminui esses momentos ou, se mesmo preparado, as situações ainda ocorrem na mesma frequência.",
        ],
      },
      { type: "heading", text: "2º Momento: Reflexão e Registro das Incongruências", level: 3 },
      {
        type: "paragraph",
        text:
          "Agora, o terapeuta é encorajado a pensar em situações concretas em que sentiu incongruência ou desconforto durante a prática clínica. Este momento tem como objetivo aprofundar a reflexão e identificar formas de agir de maneira mais congruente.",
      },
      {
        type: "list",
        items: [
          "Identifique 3 situações de incongruência: O terapeuta deve refletir sobre situações em que sua ação, reação ou estado emocional estava desalinhado com o que ele gostaria de transmitir na sessão.",
          "Reflexão sobre a mudança desejada: Para cada incongruência anotada, pergunte como o terapeuta gostaria que esses momentos tivessem se desenrolado. O que poderia ter sido feito de forma diferente? A preparação ou outro fator teria ajudado?",
        ],
      },
      { type: "heading", text: "3º Momento: Plano de Ação Personalizado", level: 3 },
      {
        type: "paragraph",
        text: "Aqui, o terapeuta cria um plano de ação para lidar com as incongruências identificadas:",
      },
      {
        type: "list",
        items: [
          "Elabore um plano para cada incongruência: Baseando-se nas reflexões anteriores, o terapeuta deve criar um plano concreto para reduzir essas incongruências em sessões futuras. Este plano pode incluir mais preparação, técnicas de relaxamento antes das sessões, ou ajustes no manejo clínico.",
          "Autoavaliação contínua: Incentivar o terapeuta a monitorar seus atendimentos nas semanas seguintes para notar se as mudanças propostas têm impacto positivo. Caso não tenham, ele deve retornar ao plano e ajustá-lo conforme necessário.",
        ],
      },
      { type: "heading", text: "4º Momento: Revisão e Feedback", level: 3 },
      {
        type: "list",
        items: [
          "Compartilhamento em grupo ou com supervisor: Após algumas semanas aplicando o plano de ação, o terapeuta pode discutir com colegas ou um supervisor como a preparação ou falta dela afetou sua prática. O que funcionou bem? O que ainda precisa ser ajustado?",
        ],
      },
    ],
  },
  {
    slug: "intervencao-confrontativa",
    number: 8,
    title: "Intervenção Confrontativa",
    summary:
      "Praticar intervenções confrontativas assertivas e estratégicas monitorando a resposta emocional do paciente.",
    category: "tecnica",
    duracaoMin: [45, 75],
    formato: ["roleplay", "discussao"],
    pessoas: "dupla",
    tags: ["confronto", "transferência", "DBT", "resistência"],
    recursos: ["vídeos externos (Perls, Fruzzetti)"],
    blocks: [
      { type: "heading", text: "Objetivo" },
      {
        type: "paragraph",
        text:
          "O exercício tem como objetivo desenvolver a habilidade do terapeuta em aplicar intervenções confrontativas de forma assertiva e estratégica, ao mesmo tempo em que monitora cuidadosamente a resposta emocional do paciente. Dessa forma, busca-se garantir que essas intervenções promovam o progresso terapêutico de maneira segura e eficaz, evitando impactos negativos que possam prejudicar o vínculo ou o processo terapêutico.",
      },
      { type: "heading", text: "Contextualização" },
      {
        type: "paragraph",
        text:
          "As intervenções confrontativas têm relevância técnica por facilitarem o processo de identificação de inconsistências cognitivas e comportamentais no paciente. Elas funcionam como um recurso para evidenciar contradições entre o discurso e a ação, possibilitando que o paciente tenha maior clareza sobre suas dinâmicas internas.",
      },
      {
        type: "paragraph",
        text:
          "Na prática clínica, essas intervenções são úteis para desestabilizar resistências que possam estar dificultando o avanço terapêutico. Ao aprender a aplicar essas intervenções de forma precisa, o terapeuta pode acessar material clínico significativo que, de outra forma, poderia permanecer inacessível em abordagens menos diretas. Isso permite trabalhar aspectos mais profundos do caso, sem necessariamente comprometer a transferência ou a relação terapêutica, desde que o manejo seja feito de acordo com a capacidade adaptativa do paciente naquele momento.",
      },
      {
        type: "paragraph",
        text:
          "Assim, o domínio dessas técnicas amplia o repertório de intervenções do terapeuta, promovendo maior flexibilidade na condução do tratamento e aumentando a eficácia clínica em contextos onde a confrontação é necessária.",
      },
      { type: "heading", text: "Descrição" },
      { type: "heading", text: "1º Momento", level: 3 },
      { type: "paragraph", text: "Perguntas sobre o tema:" },
      {
        type: "list",
        items: [
          "Você costuma utilizar intervenções confrontativas? Você gosta desse tipo de intervenção?",
          "Qual costuma ser a reação dos seus pacientes quando você utiliza esse tipo de intervenção?",
          "Como você lida quando o paciente não recebe bem a intervenção?",
          "O que você faz para saber se o paciente realmente está preparado para ser confrontado? Quais são os sinais que você observa? (Se possível, escreva-os; se estiver em grupo, apenas liste)",
        ],
      },
      { type: "heading", text: "2º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Realize uma sessão de roleplay (10-15 min) focando em aplicar intervenções confrontativas de forma clara e direta. Caso perceba que o paciente está apresentando dificuldades para lidar com as intervenções ou demonstra sinais de abalo emocional, faça uma análise crítica da situação e considere ajustar sua postura terapêutica conforme necessário.",
      },
      {
        type: "paragraph",
        text:
          "Caso tenha dificuldades para ser confrontativo ou fazer intervenções nesse sentido, peça ajuda aos seus colegas no roleplay, ou converse com seu monitor/supervisor para praticar novamente sabendo fazer esse tipo de intervenção. Você também pode assistir o vídeo, em que Fritz Perls realiza exemplos de intervenções confrontativas; ou o vídeo em que o Fruzzetti utiliza a abordagem da DBT para realizar intervenções confrontativas:",
      },
      { type: "link", label: "Fritz Perls — exemplos de intervenções confrontativas", url: "https://www.youtube.com/watch?v=DRcszf0n6ig" },
      { type: "link", label: "Fruzzetti — abordagem DBT para intervenções confrontativas", url: "https://www.youtube.com/watch?v=nFwAiO22g4Y" },
      { type: "heading", text: "3º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Perguntar ao paciente se ele gostou da sessão, se foi muito tenso e como foi para ele terapeuticamente falando. Além disso, ouça o feedback dos colegas que estão observando o roleplay.",
      },
      { type: "heading", text: "4º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Faça uma crítica de acordo com sua própria autorreflexão sobre o atendimento realizado, a crítica dos colegas e o feedback do paciente. Além disso, após ter passado pela experiência, indique novamente os sinais para saber se o paciente está conseguindo acompanhar as intervenções e como está a situação transferencial durante esses momentos.",
      },
      { type: "heading", text: "5º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Após a crítica a respeito do exercício, diga se foi útil e se consideraria aplicar intervenções confrontativas na sua clínica. Se sim, em quais momentos as utilizaria? Como o paciente deve estar para utilizar esse tipo de intervenções? Qual o ganho terapêutico dessas intervenções?",
      },
    ],
  },
  {
    slug: "parceria-para-melhoria",
    number: 9,
    title: "Parceria para Melhoria",
    summary:
      "Capítulo 5 — Fatores da Relação. Princípio: evite os erros e, quando cometê-los, repare o relacionamento.",
    category: "relacao",
    duracaoMin: [30, 60],
    formato: ["supervisao", "reflexao"],
    pessoas: "supervisor",
    tags: ["prática deliberada", "supervisão", "aliança", "ruptura-reparo"],
    recursos: ["gravações de 3 sessões", "supervisor ou colega"],
    blocks: [
      { type: "heading", text: "Princípio" },
      {
        type: "paragraph",
        text:
          "1 — Evite os erros, e quando você (inevitavelmente) cometê-los, repare o relacionamento.",
      },
      { type: "heading", text: "Aplicabilidade" },
      { type: "paragraph", text: "Itens TDPA 3Aiii, iv, 3Bi–iv, 3Di, iv" },
      { type: "heading", text: "Propósito" },
      {
        type: "paragraph",
        text:
          "A reflexão pessoal, mesmo ao revisar gravações do nosso próprio trabalho, pode não revelar nossa sutil rigidez e processos negativos (por exemplo, negatividade, hostilidade, sarcasmo) em sessão. Supervisão, observação de terceiros e feedback dos clientes oferecem a possibilidade de uma perspectiva mais ampla.",
      },
      { type: "heading", text: "Tarefa" },
      {
        type: "paragraph",
        text:
          "Junto com seu supervisor clínico ou colega, assista a gravações de três sessões com clientes diferentes. Otimize sua seleção escolhendo sessões (a) que terminaram com baixas pontuações em qualquer escala de aliança/relacionamento que você administra (por exemplo, Session Rating Scale [SRS]), (b) que foram seguidas pela interrupção do tratamento pelo cliente ou (c) durante as quais você experimentou emoções negativas em relação ao cliente. Prática deliberada precisa ser cognitivamente exigente para ser eficaz, então comece dedicando meia hora ao processo descrito a seguir. Comece assistindo a um vídeo, parando em pontos em que respostas mais flexíveis/responsivas, menos críticas/hostis eram possíveis, mas foram perdidas. Com a ajuda de seu colega ou supervisor, elabore pelo menos duas respostas alternativas. Para cada uma delas, imagine o que um cliente poderia dizer e como você responderia de maneira aberta e empática. Para que este exercício seja útil, comprometa-se a revisar vídeos dessa maneira pelo menos uma vez por semana por um mês ou mais. Esteja avisado: assistir aos nossos erros em vídeo na frente de colegas pode ferir o ego, mas é a maneira corajosa de alcançar melhores resultados no tratamento. Conforme seu nível de conforto aumenta, peça a seu supervisor ou colega para simular reações mais desafiadoras às respostas alternativas que você elabora. Observe se e como suas ações em parceria estão melhorando ao longo do tempo.",
      },
    ],
  },
  {
    slug: "abordando-o-desconfortavel",
    number: 10,
    title: "Abordando o desconfortável",
    summary:
      "Praticar a abordagem de áreas/tópicos que o terapeuta tende a evitar por preconceito, valores ou tabus.",
    category: "manejo",
    duracaoMin: [60, 90],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "dupla",
    tags: ["tabu", "valores", "preconceito", "sexualidade", "religião", "dinheiro"],
    blocks: [
      { type: "heading", text: "Contextualização" },
      {
        type: "paragraph",
        text:
          "Alguns terapeutas enfrentam dificuldades ao abordar certos tópicos com seus clientes por diversos motivos. Um deles é a preocupação com as possíveis reações dos clientes. Por exemplo, um terapeuta pode sentir-se inibido ao realizar intervenções, temendo que o paciente possa reagir negativamente a uma fala. Essa apreensão pode levar o terapeuta a evitar confrontos que, na verdade, poderiam ser benéficos e produtivos para o tratamento.",
      },
      {
        type: "paragraph",
        text:
          "Outra possível razão são os conflitos com os valores pessoais do próprio terapeuta. Por exemplo, uma terapeuta feminista que atende um paciente conservador, que valoriza a organização social do século passado mais do que a atual, pode evitar discutir assuntos políticos, sociais e até mesmo questões familiares, uma vez que tais valores influenciam na percepção da hierarquia familiar.",
      },
      {
        type: "paragraph",
        text:
          "Além disso, certos preconceitos também podem interferir na abordagem de determinados temas na clínica. Um terapeuta cristão que não está familiarizado com as religiões de matriz africana e que considera suas práticas religiosas desrespeitosas pode evitar discutir temas relacionados às crenças de seu paciente. Além disso, tabus relacionados a certos temas como dinheiro, falta de progresso no tratamento, vida sexual, podem ser propositalmente evitados por causarem desconforto ao terapeuta.",
      },
      {
        type: "paragraph",
        text:
          "Vale ressaltar que existem situações em que retirar-se do caso ou transferir o paciente para outro terapeuta pode não ser uma opção viável. Indivíduos que já foram abandonados em outras situações na vida, ou que tem extrema resistência em se submeter à terapia, ou que já tem uma relação transferencial bem estabelecida com seu terapeuta, dentre outros, podem ter seus tratamentos arruinados com o abandono do caso. Nesse sentido, retirar-se ao sentir certo desconforto na abordagem de alguns temas não deve ser uma prática regular na clínica de um bom analista.",
      },
      {
        type: "paragraph",
        text:
          "Este exercício é, portanto, desenvolvido para proporcionar prática na abordagem dessas áreas desconfortáveis e ajudar os terapeutas a lidar com essas situações de forma mais eficaz.",
      },
      { type: "heading", text: "Descrição" },
      { type: "heading", text: "1º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Contextualização do exercício proposto. Exponha para o grupo, baseado no texto acima, a importância de saber desenvolver uma gama expressiva de temas, e fomentar a capacidade de abordar assuntos possivelmente desconfortáveis.",
      },
      { type: "heading", text: "2º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Peça para que os participantes do grupo façam um exercício mental de buscar temas que possam ser considerados desconfortáveis de se abordar na clínica. Cada um deve refletir sobre os possíveis motivos de esse tópico ser de difícil abordagem: como ele está ligado a sua história de vida, crenças, abordagem terapêutica, dentre outros.",
      },
      {
        type: "paragraph",
        text:
          "Dê um exemplo, de como um assunto pode ser desconfortável para o terapeuta, e que se relaciona com aspectos de sua vida, como um analista que tem problemas em manter conversas sobre relações sexuais, que é de uma família conservadora cristã que nunca abordava o tema, que escolheu a abordagem da TCC por rejeitar o foco no sexual presente na psicanálise, que considera o sexo antes do casamento como um pecado mortal e segue a risca às designações bíblicas, etc.",
      },
      {
        type: "paragraph",
        text:
          "Peça para que cada membro do grupo diga o tema que pensou e registre de alguma forma. Cada participante deve revelar os motivos pelo qual esse tópico parece ser de difícil abordagem, a partir da reflexão realizada no momento 2.",
      },
      { type: "heading", text: "3º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Proponha então um roleplay de atendimento, de 15 minutos, no qual o terapeuta vai propor discutir o tópico que o incomoda com o paciente.",
      },
      {
        type: "paragraph",
        text:
          "Primeiramente, separe o grupo em diversas duplas. A ideia é que todos passem por uma rodada atendendo e uma sendo atendido. Se uma pessoa ficar sobrando, seja você o par dela.",
      },
      {
        type: "paragraph",
        text:
          "Oriente para que um integrante da dupla crie uma outra chamada e mande o link dela no chat do grupo, para seu par entrar. Haverá o primeiro roleplay, em que um será o paciente e o outro o terapeuta. Instrua que o paciente deve, na medida do possível, sustentar uma posição que incomode o terapeuta. Por exemplo, no caso do terapeuta que tem dificuldades no tema relações sexuais já citado, seria interessante simular um paciente que tenha relações sexuais com frequência, sem relações de matrimônio, de modo a aumentar o desconforto da dupla.",
      },
      {
        type: "paragraph",
        text: "Avise-os de que se o roleplay ficar insustentavelmente incômodo para alguém, o mesmo pode ser encerrado.",
      },
      {
        type: "paragraph",
        text:
          "Terminado o primeiro roleplay, os papéis devem ser invertidos e o segundo roleplay tem início, com as mesmas regras. Terminado o segundo roleplay, a dupla deve voltar ao grupo geral e informar no chat que terminaram o exercício.",
      },
      { type: "heading", text: "4º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Encerrados os atendimentos, peça para que cada um da dupla dê um feedback sobre como foi a sessão para o outro. São pontos para pensar a qualidade do atendimento:",
      },
      { type: "heading", text: "Para o paciente", level: 4 },
      {
        type: "list",
        items: [
          "Como foi a condução do terapeuta?",
          "Ele respeitou a opinião do paciente?",
          "Pareceu intolerante em algum momento?",
          "Conseguiu desenvolver o tema?",
          "Atuou de maneira produtiva?",
        ],
      },
      { type: "heading", text: "Para o terapeuta", level: 4 },
      {
        type: "list",
        items: [
          "Como o terapeuta se sentiu durante a sessão?",
          "Quais momentos foram incômodos?",
        ],
      },
    ],
  },
  {
    slug: "atencao-aos-cuidados-basicos",
    number: 11,
    title: "Atenção aos cuidados básicos",
    summary:
      "Refletir sobre a relevância de explorar sono, alimentação, medicações e outros cuidados de saúde na clínica.",
    category: "manejo",
    duracaoMin: [30, 60],
    formato: ["discussao", "reflexao"],
    pessoas: "grupo",
    tags: ["sono", "medicação", "saúde física", "interdisciplinaridade"],
    blocks: [
      { type: "heading", text: "Contextualização" },
      {
        type: "paragraph",
        text:
          "Apesar da psicologia ser conhecida como a ciência que cuida da mente e das questões psicológicas no geral, são diversos os autores que não trabalham com uma ideia de \u201Ccorpo e mente\u201D como sendo duas coisas separadas e divididas entre áreas diferentes do conhecimento. Por exemplo, a psicologia analítica trabalha com a ideia que não é possível chegar a uma conclusão a respeito das causas das doenças psicossomáticas (se é do corpo para a mente ou da mente para o corpo), rompendo com a ideia de uma dualidade bem definida.",
      },
      {
        type: "paragraph",
        text:
          "Nesse sentido, o exercício em questão busca trabalhar a atenção aos cuidados que não pertencem diretamente à área da psicologia a partir do senso comum, mas que pertencem a outras áreas do conhecimento que possivelmente estabelecem uma relação com a psicologia. Portanto, a prática do exercício visa entender a relevância em explorar esses temas na clínica.",
      },
      { type: "heading", text: "Descrição" },
      { type: "heading", text: "1º Momento", level: 3 },
      { type: "paragraph", text: "Perguntas sobre o tema:" },
      {
        type: "list",
        items: [
          "Você costuma perguntar a seus pacientes sobre seus cuidados básicos de saúde, hábitos de sono, alimentação e remédios que ele toma? Você considera isso importante?",
          "Acha que faz parte do papel do psicólogo questionar sobre categorias que pertencem à outras áreas (medicina, odontologia, educação física, nutrição, etc)?",
          "Quando depara com um problema que diz do corpo biológico ou dos cuidados básicos de saúde, como você lida com isso na clínica?",
          "Você lida diferente com o caso se o paciente toma remédios controlados ou medicamentos psiquiátricos? Qual a sua condução?",
        ],
      },
      { type: "heading", text: "2º Momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Tenha um bate-papo em grupo ou com um supervisor/monitor confrontando as suas opiniões do 1º momento com o que as outras pessoas acham, refletindo e adaptando sua clínica após sua crítica. Se tiver dificuldade para desenvolver isso, anote as coisas que são importantes de ser perguntadas durante o decorrer dos atendimentos (se é que você considera importante perguntar tais coisas).",
      },
    ],
  },
  {
    slug: "manejo-paciente-teoria-x-teoria-y",
    number: 12,
    title: "Manejo de \u201Cpaciente da teoria x\u201D com a \u201Cteoria y\u201D",
    summary:
      "Refletir sobre limites e ganhos de mesclar técnicas entre abordagens, sem comprometer a linha do terapeuta.",
    category: "tecnica",
    duracaoMin: [45, 75],
    formato: ["discussao", "reflexao"],
    pessoas: "dupla",
    tags: ["abordagens", "ecletismo", "limites teóricos"],
    blocks: [
      { type: "heading", text: "Contextualização" },
      {
        type: "paragraph",
        text:
          "Promover a reflexão dos maiores benefícios e limitações da abordagem do(a) profissional e mostrar as consequências positivas e negativas de mesclar técnicas na prática clínica em função de fatores do(a) cliente e do(a) terapeuta. Algumas perguntas que guiam este exercício são:",
      },
      {
        type: "list",
        items: [
          "Como lido com um paciente que tem expectativas/experiências de uma forma de terapia que não seja a da minha abordagem, sem encaminhar?",
          "Quais adaptações posso fazer em meu manejo para mesclar meu estilo de atendimento com as expectativas, demandas e características do cliente?",
          "Quais ideias, fundamentos e técnicas de outras abordagens posso utilizar sem comprometer o meu trabalho assumindo uma linha teórica? Posso usar uma técnica de outra abordagem, se fizer uma análise deste material segundo a minha perspectiva?",
        ],
      },
      {
        type: "paragraph",
        text:
          "A especialização do psicólogo em uma abordagem é algo que leva ao enriquecimento teórico e prático no trabalho. Porém, isso pode também levar a uma alienação do ponto de vista teórico, visto que uma abordagem possui suas limitações, o que pode ser contornado com o conhecimento e pesquisa de outras linhas teóricas, tanto para os pontos fracos da abordagem do terapeuta, quanto para ver pontos fortes sob outra ótica, ambas possibilidades que enriquecem o(a) psicólogo(a).",
      },
      { type: "heading", text: "Descrição" },
      { type: "heading", text: "Primeiro momento", level: 3 },
      {
        type: "paragraph",
        text:
          "O coordenador deve apresentar a proposta do exercício ao grupo. Então, deve perguntar aos participantes qual a sua abordagem.",
      },
      { type: "heading", text: "Segundo momento", level: 3 },
      {
        type: "paragraph",
        text:
          "O coordenador deve separar os participantes em duplas que irão trocar entre si como enxergam o seu trabalho com a sua abordagem, quais seus principais pontos fortes e quais são as limitações e outros comentários relevantes. Cada um deve tentar trazer como trabalha na sua abordagem com as limitações trazidas pelo outro da dupla.",
      },
      {
        type: "callout",
        text:
          "Obs: em caso de muitas pessoas de uma mesma abordagem, pode-se optar por fazer trios ou quartetos com mais de uma pessoa da mesma abordagem para trocar com alguém de outra abordagem.",
      },
      { type: "heading", text: "Terceiro momento", level: 3 },
      {
        type: "paragraph",
        text:
          "Então, as duplas devem compartilhar com o grupo o que acharam mais interessante do trazido pelo(a) colega e quais as formas de lidar com as limitações apresentadas.",
      },
    ],
  },
  {
    slug: "parar-de-tentar-agradar",
    number: 13,
    title: "Como parar de tentar agradar seus clientes/pacientes sempre?",
    summary:
      "Grupo de Aprimoramento — distinguir intervenções confortáveis de intervenções clinicamente necessárias.",
    category: "relacao",
    duracaoMin: [45, 75],
    formato: ["roleplay", "discussao"],
    pessoas: "dupla",
    tags: ["agradar", "limites", "transferência", "intervenção"],
    blocks: [
      { type: "heading", text: "1º momento: Breve contextualização", level: 3 },
      {
        type: "paragraph",
        text:
          "A tentativa de agradar os pacientes é um fenômeno comum que muitas vezes vai na contramão de uma boa clínica pois não responde ao que é necessário fazer e sim ao que é mais confortável de fazer.",
      },
      {
        type: "paragraph",
        text:
          "Fazer interações com os participantes: Sentem isso na clínica? Como e quando? Como costumam lidar? À que a vontade de agradar serve? Enquanto pacientes, sentem-se frequentemente frustrados quando não são agradados?",
      },
      { type: "heading", text: "2º momento: Role Play 1", level: 3 },
      {
        type: "paragraph",
        text:
          "Instruções para o paciente: o paciente está frustrado e bravo pelo psicoterapeuta não ter cedido a um pedido/desejo dele. Frente a isso, vai forçar a barra a fim de conseguir o que quer ou ser validado.",
      },
      {
        type: "paragraph",
        text:
          "Instruções para o terapeuta: não deve-se focar em fazer uma boa intervenção clínica, o foco deve ser em NÃO PERDER O PACIENTE.",
      },
      {
        type: "paragraph",
        text:
          "Interações após: como foi para o paciente? Como foi para o terapeuta? Como sentem que a sessão caminhou? Quais foram os pensamentos de ambos?",
      },
      { type: "heading", text: "3º momento: Role Play 2", level: 3 },
      {
        type: "paragraph",
        text:
          "Instruções para o paciente: forçar ainda mais a barra, agora, utilizando de emoções para conseguir o que quer/ser validado.",
      },
      {
        type: "paragraph",
        text:
          "Instruções para o terapeuta: intervenções que convencem, justificam, tranquilizam ou cedem estão VETADAS. O foco aqui está em fazer BOAS intervenções clínicas, não em não perder o paciente.",
      },
      {
        type: "paragraph",
        text:
          "Interações após: Qual a diferença percebida? Como foi para o paciente? Como foi para o terapeuta? Foi fácil ou difícil? Quais outros aspectos esse novo caminho abrangeu que o primeiro falhou em abranger?",
      },
    ],
  },
  {
    slug: "perguntando-sobre-preferencias",
    number: 14,
    title: "Perguntando Sobre Preferências",
    summary:
      "As decisões de tratamento são orientadas em certa medida, pelas crenças, valores e preferências do terapeuta. O seguinte exercício é projetado para ajudar os terapeutas a identificar e, em seguida, usar as…",
    category: "relacao",
    duracaoMin: [30, 45],
    formato: ["reflexao", "discussao", "preenchimento"],
    pessoas: "grupo",
    tags: ["preferenc"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "As decisões de tratamento são orientadas em certa medida, pelas crenças, valores e preferências do terapeuta. O seguinte exercício é projetado para ajudar os terapeutas a identificar e, em seguida, usar as preferências do cliente para informar e aprimorar a tomada de decisões clínicas. Trata-se de um exercício em que a formulação precisa e potente das frases é parte fundamental, mantenha o foco muito mais no como perguntar e utilizar as preferências do que no que. É importante também ressaltar que o ideal não é trabalhar com “preferências do paciente”, mas com especificidade do caso. Mas isso requer um passo hermenêutico e será feito em outro exercício." },
      { type: "heading", text: "Tarefas" },
      { type: "paragraph", text: "Tenha o E-mapa em mãos. Se a exploração e acomodação das crenças, valores e preferências do cliente no início do cuidado não forem mencionadas especificamente, adicione-as ao seu mapa. Inclua uma descrição detalhada do que você discute explicitamente com seus clientes e como. Escreva como você iniciaria uma conversa com os clientes sobre esses valores e crenças específicos. Por exemplo, se a experiência anterior de tratamento dos clientes não era um tópico que você normalmente perguntava ou explorava, você escreveria uma pergunta inicial (ou seja, \"Gostaria de ouvir sobre suas experiências passadas, se houver, em psicoterapia\"), juntamente com várias maneiras de dar seguimento (ou seja, \"O que correu bem?\" \"O que não correu tão bem?\" \"Com base nessas experiências, como você gostaria que fosse nosso trabalho juntos?\"). Com um cliente que não tem experiência anterior em psicoterapia, você poderia perguntar: \"Antes de vir para nossa consulta hoje, você teve algum pensamento sobre o que gostaria que acontecesse enquanto trabalhamos juntos?\" seguido de \"Você tinha alguma preocupação com coisas que eu poderia fazer e que você realmente não gostaria que fizessem parte do seu tratamento?\"" },
      { type: "paragraph", text: "Complete o exercício considerando como você lidará com desafios. Por exemplo, escreva o que você diria no caso de um cliente descrever uma preferência fora da caixa, por exemplo, se encontrar em um ambiente mais informal, usar uma abordagem de tratamento para a qual você não está treinado para fornecer ou acredita ser contraindicada ou até prejudicial. Desenvolva e ensaie várias maneiras concretas de compartilhar suas preocupações ao mesmo tempo em que constroi e mantém um relacionamento colaborativo de trabalho. Como etapa final, faça simulações das respostas que você desenvolveu com colegas, refletindo sobre e fazendo ajustes com base no feedback." },
    ],
  },
  {
    slug: "incorporacao-de-um-cliente",
    number: 15,
    title: "Incorporação de um Cliente",
    summary:
      "Na terapia, assim como na vida, conflitos de valores e diferenças entre as pessoas são inevitáveis. Este exercício é projetado para ajudá-lo a reconhecer, compreender e desenvolver estratégias mais eficazes para…",
    category: "tecnica",
    duracaoMin: [30, 45],
    formato: ["preenchimento"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 3 - Busque compreender e ser respeitoso com os valores e crenças individuais do cliente, mesmo quando forem diferentes daqueles mantidos pelo terapeuta." },
      { type: "paragraph", text: "Aplicabilidade: Item TDPA 4E (também aplicável a 5Ai, ii, iii, iv, vii, 5Bi)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Na terapia, assim como na vida, conflitos de valores e diferenças entre as pessoas são inevitáveis. Este exercício é projetado para ajudá-lo a reconhecer, compreender e desenvolver estratégias mais eficazes para honrar os valores e opiniões de seus clientes durante a sessão." },
      { type: "heading", text: "Tarefas" },
      { type: "paragraph", text: "Ao escrever suas notas de progresso no final do dia, lembre-se de qualquer cliente com quem você experimentou um conflito de valores explícito ou implícito (por exemplo, política, religião, motivação, objetivo de tratamento). Feche os olhos e os visualize em sua mente. Declare sua visão do conflito em voz alta, incluindo seus pensamentos e sentimentos, bem como por que você acredita que o assunto está incomodando você tanto. Descreva com o máximo de detalhes possível como vocês dois são diferentes um do outro. Em seguida, avalie seu nível de frustração com a pessoa (0 = nenhuma frustração, 10 = frustração extrema). Com os olhos abertos e papel ou aplicativo de anotações em mãos, escreva como seu cliente descreveria o conflito. Liste as experiências ou circunstâncias de vida que podem ter levado às suas crenças e valores. Observe como o cliente pode se sentir ao ter um conflito nesta área com você (seu terapeuta). Considere se e como, apesar de quaisquer diferenças, especificamente seus objetivos e os do seu cliente para o encontro são semelhantes. Se você tiver dificuldade em articular por que eles acreditam no que acreditam ou como seus objetivos são semelhantes, escreva duas ou três maneiras específicas de fazer perguntas na próxima visita. Termine reavaliando seu nível de frustração com o cliente. O processo completo deve levar no máximo 10 a 15 minutos. Revise o exercício ao longo de vários dias até observar uma diminuição em sua frustração. Nesse ponto, faça um plano de como abordará esse conflito no futuro com seus clientes. Como o tópico será abordado? Como você expressará empatia e transmitirá compreensão?" },
    ],
  },
  {
    slug: "permitindo-diferencas",
    number: 16,
    title: "Permitindo Diferenças",
    summary:
      "O objetivo deste exercício é ajudar os terapeutas a se tornarem mais abertos às experiências de seus clientes. Também auxiliará na expressão de empatia e compreensão quando ocorrerem conflitos nas sessões. Para…",
    category: "relacao",
    duracaoMin: [30, 45],
    formato: ["reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["diferencas"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 3 - Busque compreender e ser respeitoso com os valores e crenças individuais do cliente, mesmo quando forem diferentes daqueles mantidos pelo terapeuta." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 4C, E (também aplicável a 5Ai, ii, iv, viii, 5Bi)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "O objetivo deste exercício é ajudar os terapeutas a se tornarem mais abertos às experiências de seus clientes. Também auxiliará na expressão de empatia e compreensão quando ocorrerem conflitos nas sessões. Para concluí-lo, será necessário ter acesso a gravações de áudio ou vídeo do seu trabalho." },
      { type: "heading", text: "Tarefas" },
      { type: "paragraph", text: "Como parte da sua avaliação inicial e documentação, comece a incluir um pedido formal de gravação. Exemplos de documentos de consentimento informado estão amplamente disponíveis na internet. Verifique se o documento adotado atende às regulamentações locais e profissionais referentes à gravação de sessões de psicoterapia. Não é necessário equipamento sofisticado. Se você tiver um telefone celular, terá acesso a um dispositivo de gravação de alta qualidade. Torne a gravação do seu trabalho a configuração padrão para todas as sessões. No final do dia, reflita sobre suas reuniões com os clientes, identificando momentos em que você enfrentou um conflito, seja abertamente ou internamente. Exemplos podem ser a reação que você teve quando um cliente informou que não concluiu nem se lembrava da tarefa de casa, forneceu feedback negativo, expressou raiva em relação a você ou compartilhou uma crença que você considera depreciativa (por exemplo, homofóbica, racista, desnecessária ou injustamente crítica a outros ou a você). Salve essas gravações e exclua as outras. Mantenha um registro identificando o tipo de conflitos refletidos nas gravações. Classifique por padrões, identificando os mais frequentes ou incomodativos. Em seguida, isole a seção de cada gravação em que o conflito surge. Ouça e ouça novamente, trabalhando intencionalmente para deixar de lado quaisquer pensamentos e sentimentos julgativos. Uma vez feito, teste seu progresso passando para a próxima gravação e repetindo o processo. Como etapa final, retorne à primeira gravação, considerando como você respondeu no momento. Pare a reprodução, primeiro refletindo e depois escrevendo duas respostas com o objetivo de comunicar compreensão e empatia." },
    ],
  },
  {
    slug: "solicitacao-de-feedback",
    number: 17,
    title: "Solicitação de Feedback",
    summary:
      "Melhore sua habilidade e conforto ao solicitar feedback dos clientes.",
    category: "relacao",
    duracaoMin: [30, 45],
    formato: ["roleplay", "reflexao"],
    pessoas: "grupo",
    tags: ["feedback"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 4 - Faça verificações regulares com os clientes para garantir que o trabalho esteja alinhado com suas expectativas, preferências, valores, necessidades e identidade, sendo flexível e adaptável quando necessário." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 4B, C, F (também aplicável a 5Aviii)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Melhore sua habilidade e conforto ao solicitar feedback dos clientes." },
      { type: "heading", text: "Tarefas" },
      { type: "paragraph", text: "Quaisquer dos fatores do cliente revisados na seção de pesquisa deste capítulo podem estar envolvidos em clientes experimentando baixos níveis de envolvimento ou falta de progresso no tratamento, incluindo (a) preferências ou expectativas de tratamento que não estão sendo atendidas; (b) falta de compreensão do tratamento fornecido; (c) uma falta de correspondência entre a terapia e o estilo relacional, identidade, valores ou crenças do cliente; (d) escassez de suporte social fora da psicoterapia; e (e) uma falha em reconhecer e reforçar mudanças no bem-estar do cliente que podem não estar diretamente relacionadas ao trabalho ou objetivos na terapia. Enquanto alguns desses podem refletir um padrão recorrente de erros por parte do terapeuta, muitos, como apontado em Better Results, são aleatórios. \"A psicoterapia\", observou Miller et al. (2020), \"é cognitivamente exigente”. Qualquer hora dada, portanto, conterá inúmeros (a) 'poderia, deveria, teria' bem como (b) um número incontável de ajustes no momento\" (pp. 104–105). Em tais casos, melhorar o envolvimento e o resultado depende do aumento da responsividade do terapeuta - fazer a coisa certa no momento certo junto com o cliente. A solicitação de feedback por meio da administração rotineira de medidas padronizadas tem se mostrado particularmente útil nesse sentido. Como primeiro passo, recupere o plano que você criou para como faz terapia (descrito na p. 29 de Better Results e atualizado nas pp. 18–20 no Capítulo 1 do Field Guide). Se medidas padronizadas não estiverem incluídas, adicione-as ao seu mapa. Se você ainda não desenvolveu um roteiro explicando como e por que está usando tais escalas, faça isso agora. No final de cada dia, reflita sobre como discutiu as pontuações, observando quaisquer instâncias específicas em que teve dificuldade em comunicar claramente ou foi tentado a não discutir os resultados (por exemplo, pontuações baixas de aliança, falta de progresso ou deterioração, falta de tempo). Escolha uma e imagine como você poderia ter abordado o feedback do cliente no momento, comprometendo-se a colocar pelo menos duas respostas alternativas no papel." },
    ],
  },
  {
    slug: "ficando-confortavel-com-feedback-negativo",
    number: 18,
    title: "Ficando Confortável com Feedback Negativo",
    summary:
      "Para alguns terapeutas, receber feedback crítico é difícil. Para outros, a maior preocupação é como responder de maneira mais eficaz no momento. Este exercício, a ser concluído com um parceiro, é projetado para…",
    category: "relacao",
    duracaoMin: [30, 45],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["feedback"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 4 - Faça verificações regulares com os clientes para garantir que o trabalho esteja alinhado com suas expectativas, preferências, valores, necessidades e identidade, sendo flexível e adaptável quando necessário." },
      { type: "paragraph", text: "Aplicabilidade: Item TDPA 4F (também aplicável a 5Ai, ii, iii, iv)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Para alguns terapeutas, receber feedback crítico é difícil. Para outros, a maior preocupação é como responder de maneira mais eficaz no momento. Este exercício, a ser concluído com um parceiro, é projetado para aumentar tanto o conforto quanto a responsividade ao feedback negativo do cliente." },
      { type: "heading", text: "Tarefas" },
      { type: "paragraph", text: "Dedique um tempo para refletir sobre o feedback que preocupa em receber dos clientes. Podem ser declarações amplas sobre sua competência geral ou declarações sobre habilidades ou atributos específicos. Se você quiser tornar a experiência real, liste primeiro os valores e crenças que você tem sobre si mesmo, sua identidade e seu trabalho como clínico (por exemplo, sua eficácia, nível de habilidade, abertura, capacidade de se relacionar com os outros). Em seguida, peça a um colega de confiança para interpretar um cliente que tem feedback negativo para compartilhar, com base em uma de suas preocupações específicas ou adotando uma percepção de você no feedback que vai contra como você se vê. Durante o processo, sua função é ouvir e refletir, não resolver o feedback expresso pelo cliente, continuando o role-play até que eles se sintam compreendidos por você. Preste atenção em como você se sente, repetindo a atividade em intervalos regulares até perceber um aumento significativo no seu nível de conforto. Caso se sinta travado ou incerto sobre o que fazer, consulte as seções relevantes na revisão de pesquisa e nas seções de recursos adicionais deste capítulo." },
    ],
  },
  {
    slug: "quem-e-voce",
    number: 19,
    title: "Quem é Você?",
    summary:
      "Conforme detalhado em Better Results, o tempo e a experiência dentro de um domínio específico de atuação (por exemplo, a terapia psicoterapêutica?) levam ao desenvolvimento da \"automaticidade\". Embora esse processo…",
    category: "autoconhecimento",
    duracaoMin: [30, 45],
    formato: ["reflexao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 1 - Quando em dúvida, concentre-se em aprimorar habilidades interpessoais fundamentais." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 5Ai-iv (também aplicável a 3Bi, ii, v, vii, Di-iv, 4B, C, D)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Conforme detalhado em Better Results, o tempo e a experiência dentro de um domínio específico de atuação (por exemplo, a terapia psicoterapêutica?) levam ao desenvolvimento da \"automaticidade\". Embora esse processo nos permita agir sem ter que pensar em cada passo que damos, a má notícia é que perdemos o controle consciente sobre os comportamentos dominados. Miller, Hubble e Chow (2020) observaram: \"Contrariar propositadamente a automaticidade está no cerne da prática deliberada\" (p. 28). Este exercício visa aumentar a autoconsciência desses elementos automatizados em seu estilo e interações interpessoais para que possam, se necessário, ser alterados." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Parte 1. Ao final de cada dia dedicado a encontros com clientes, reserve alguns momentos para refletir sobre as sessões que você considerou desafiadoras. Com papel e caneta ou usando seu software de anotações favorito, liste os nomes dos clientes, algumas características identificadoras, sua reação instintiva na época e sua resposta interpessoal. Em relação a esta última, considere os domínios na avaliação FIS (por exemplo, fluência verbal, expressividade emocional, persuasão, calor, consideração positiva, otimismo, empatia, capacidade de reparar o relacionamento), classificando-se com uma simples escala Likert de 1 a 5. Limite-se a 20 minutos." },
      { type: "paragraph", text: "Parte 2. Após um mês, volte sua atenção para revisar as informações que você reuniu, gastando novamente no máximo 20 minutos por vez. Quais foram suas reações instintivas? Para onde você se sentiu \"levado\" a ir com clientes ou situações específicas? Quais temas e semelhanças estão presentes (por exemplo, tipos de clientes, questões, interações, suas respostas) nas diversas sessões descritas? Quais aspectos de suas habilidades interpessoais foram mais prejudicados? É importante não apressar o processo. Portanto, entre os momentos dedicados à reflexão sobre seus dados, resista à tentação de chegar a uma conclusão firme. Esteja atento, não obcecado em descobrir o que fazer. Os pesquisadores acreditam que ponderar ideias extensivamente \"em segundo plano\" tem dois benefícios potenciais. Primeiro, nos permite estabelecer conexões mais profundas e nuanceadas entre experiências e ideias, aumentando assim as possibilidades de ação criativa. Segundo, influencia o comportamento atual, efetivamente nos preparando para buscar oportunidades de agir de maneiras consistentes com o que estamos esperando, mas atualmente incapazes de alcançar (por exemplo, mais empático, menos reativo; Wiseman, 2004)." },
    ],
  },
  {
    slug: "civilizando-as-redes-sociais-ou-pelo-menos-tentando",
    number: 20,
    title: "Civilizando as Redes Sociais (ou pelo menos tentando)",
    summary:
      "Em um período relativamente curto, as redes sociais passaram a ocupar um lugar central nas interações humanas. Quase metade da população mundial está online, ou seja, 3,5 bilhões de pessoas. Dois terços delas usam uma…",
    category: "autoconhecimento",
    duracaoMin: [30, 45],
    formato: ["reflexao", "preenchimento"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 1 - Quando em dúvida, concentre-se em aprimorar habilidades interpessoais fundamentais. / 3 - Manter uma atitude de humildade que apoie a disposição para aprender e melhorar." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 5Ai-v, viii, 5Bi (também aplicável a 3Bi, ii, iv–vi, Di, ii, iv, 4E)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Em um período relativamente curto, as redes sociais passaram a ocupar um lugar central nas interações humanas. Quase metade da população mundial está online, ou seja, 3,5 bilhões de pessoas. Dois terços delas usam uma ou mais plataformas regularmente (Ortiz-Ospina, 2019). As pessoas se informam, mantêm contato com amigos e família, se conectam com pessoas de mentalidade semelhante, assistem a vídeos divertidos e exploram seus interesses. Elas também discutem e brigam. Na verdade, um estudo recente da Universidade de Yale descobriu que os algoritmos que impulsionam o conteúdo e as conexões em vários sites realmente ensinam os usuários a se envolverem em trocas mais hostis e incivilizadas (Hathaway, 2021). A ocorrência frequente de interações difíceis nessas plataformas — e a oportunidade de refletir por mais tempo antes de responder do que seria possível em uma interação terapêutica real — torna-as o lugar perfeito para praticar os tipos de habilidades interpessoais associadas ao trabalho clínico eficaz." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Se ainda não o fez, reserve um tempo para se familiarizar com a literatura sobre habilidades interpessoais, especialmente expressividade emocional, persuasão, calor, fluência verbal, consideração positiva, otimismo, empatia e capacidade de reparar o relacionamento de trabalho. Feito isso, escreva sua definição pessoal para cada uma delas, assim como várias instâncias recentes de seu uso em interações com clientes. Em seguida, abra seu aplicativo de redes sociais favorito e participe de uma conversa acalorada ou na qual os participantes concordem completamente entre si. Junte-se à troca, usando de maneira consciente e intencional habilidades interpessoais facilitadoras para melhorar o envolvimento, a abertura e a civilidade. Como a consciência do seu estado interno e reações é crucial para responder de maneira eficaz, reserve um tempo para refletir antes de responder a qualquer postagem ou comentário feito por outros. Quais sentimentos, se houver, você está experimentando? Por quê? E como você os gerencia em prol de manter e melhorar a conversa? Finalmente, releia a troca várias vezes durante a semana, observando o que funcionou e o que não funcionou. Em relação a este último, imagine maneiras alternativas pelas quais você poderia ter respondido. Procure por oportunidades onde você poderia ter sido mais humilde ou aberto à desconfirmação. Continue o exercício indefinidamente, aumentando lentamente a dificuldade ao procurar trocas que desafiem cada vez mais suas crenças ou valores pessoais." },
    ],
  },
  {
    slug: "ensinando-para-o-teste-terapeutico",
    number: 21,
    title: "Ensinando para o Teste Terapêutico",
    summary:
      "Você provavelmente já ouviu a expressão \"ensinar para o teste\". Este exercício é uma variação daquela abordagem pedagógica amplamente desencorajada e desacreditada! Em vez de ensinar a regurgitar a resposta que você…",
    category: "autoconhecimento",
    duracaoMin: [30, 45],
    formato: ["reflexao", "preenchimento"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 1 - Quando em dúvida, concentre-se em aprimorar habilidades interpessoais fundamentais. / 2 - Independentemente do seu modelo ou abordagem teórica, seja flexível e responsivo." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 5Aiv, vii, viii (também aplicável a 3Bi-iii, v, vi, 3Di, ii)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Você provavelmente já ouviu a expressão \"ensinar para o teste\". Este exercício é uma variação daquela abordagem pedagógica amplamente desencorajada e desacreditada! Em vez de ensinar a regurgitar a resposta que você precisa para melhorar seu desempenho em um teste, este exercício, como todo bom ensino, é projetado para aprofundar sua compreensão e uso de habilidades específicas. Sua origem pode ser rastreada até os clínicos que rotineiramente monitoram seu desempenho com uma escala de resultados e aliança. Embora administradas e discutidas no início e no final de cada visita, muitos relataram que as ferramentas começaram a influenciar sutilmente como eles trabalhavam durante a sessão. Em resumo, conscientes do que os clientes estavam sendo solicitados a avaliar, os terapeutas começaram a \"fazer terapia para o teste\". Saber que seu cliente seria solicitado no final da visita a avaliar o quanto se sentiam \"ouvidos, compreendidos e respeitados\", por exemplo, os incentivava a refletir sobre e ajustar suas respostas ao longo da sessão." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Primeiro, abra sua cópia de Better Results e releia o Capítulo 14, \"Projetando um Sistema de Prática Deliberada\". Segundo, antes de cada sessão, revise rapidamente as perguntas na ferramenta de aliança que você rotineiramente administra no final de cada visita (por exemplo, Escala de Avaliação da Sessão; Miller, Duncan, & Johnson, 2000). Mesmo que você esteja usando a ferramenta há algum tempo e esteja familiarizado com seu conteúdo, não pule esta etapa. Alternativamente, escreva ou digite sua definição pessoal de cada uma das habilidades interpessoais facilitadoras centrais revisadas neste capítulo (por exemplo, expressividade emocional, persuasão, calor, fluência verbal, consideração positiva, otimismo, empatia). Em seguida, escolha uma para revisar no início de cada sessão. Importante, independentemente da abordagem escolhida, não se esforce conscientemente para mudar o que faz durante a sessão. Continue com um foco singular nessa habilidade interpessoal ou domínio de aliança por pelo menos uma semana. Terceiro, e finalmente, o sinal de que você completou o exercício com sucesso e pode passar para o próximo pode ser encontrado no final da seção de Exercícios e antes da Leitura Adicional (veja p. 99)." },
    ],
  },
  {
    slug: "vendo-vermelho",
    number: 22,
    title: "Vendo Vermelho",
    summary:
      "A pesquisa mostra que os terapeutas não são tão responsivos e flexíveis com clientes que não estão progredindo ou piorando em seu tratamento. Em uma análise do que os terapeutas fizeram em resposta a esse feedback,…",
    category: "autoconhecimento",
    duracaoMin: [30, 45],
    formato: ["roleplay", "supervisao"],
    pessoas: "supervisor",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 2 - Independentemente do seu modelo ou abordagem teórica, seja flexível e responsivo." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 5Ai, ii, iv (também aplicável a 1E, F, J, 2D, 4C)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "A pesquisa mostra que os terapeutas não são tão responsivos e flexíveis com clientes que não estão progredindo ou piorando em seu tratamento. Em uma análise do que os terapeutas fizeram em resposta a esse feedback, Lutz (2014) descobriu que ajustes nas intervenções terapêuticas foram feitos em menos de 30% dos casos. Em um pouco mais de 5%, foram feitas alterações na frequência ou intensidade e consultas com fontes adicionais de ajuda (por exemplo, supervisão, educação continuada, revisão de literatura). Claramente, a tendência de \"seguir o curso\" é forte. Desenvolver um framework para saber quando e exatamente o que fazer pode melhorar a flexibilidade e a capacidade de resposta." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Comece identificando todos os casos concluídos que terminaram sem progresso ou abandonaram o tratamento. O processo é fácil se você estiver usando um dos sistemas eletrônicos de gerenciamento de resultados discutidos em Better Results (Miller, Hubble, & Chow, 2020). Basta procurar clientes que encerraram os serviços na zona vermelha. Ainda é possível fazer este exercício se você estiver limitado ao papel e lápis, mas requer um pouco mais de trabalho. O gráfico de \"Mudança Confiável e Clinicamente Significativa\" na página 175 de Better Results (Apêndice A) pode ser usado para separar seus casos bem-sucedidos dos malsucedidos. Lembre-se, em média, entre 24% e 36% dos clientes de qualquer terapeuta encerram o tratamento sem experimentar uma melhora confiável ou clinicamente significativa em seu bem-estar ou funcionamento (veja o Capítulo 8 em Better Results). Selecione aleatoriamente 10 casos assim, reservando no máximo 30 minutos duas ou três vezes por semana para revisão e análise aprofundadas. Em seguida, escolha um e, com o gráfico de seus escores de resultado e suas anotações do caso em mãos, observe a primeira instância em que o cliente estava em risco de um resultado negativo ou nulo (por exemplo, entrou na zona vermelha, sem progresso desde a visita anterior, pontuações de aliança baixas ou decrescentes) e o que você fez em resposta. Por exemplo, você discutiu os resultados com o cliente? Ajustou seu estilo, abordagem, postura interpessoal ou dose? Foram sugeridos, organizados ou consultados recursos adicionais? Se não, por quê? Se sim, o cliente relatou melhora na visita seguinte? Se não, por quê? Foi a temporização (muito ou pouco tarde demais)? Após esgotar seus casos iniciais, continue o processo até que uma árvore de decisão abrangendo a temporização e as opções para uma capacidade aprimorada de resposta a clientes não progredindo e \"em risco\" comece a tomar forma. Conclua integrando-o ao seu blueprint (consulte p. 29 em Better Results e pp. 18-20 no Capítulo 1 do Field Guide)." },
    ],
  },
  {
    slug: "regulando-seu-termometro-interno",
    number: 23,
    title: "Regulando Seu Termômetro Interno",
    summary:
      "Na prática do Zen, pensamentos e emoções são frequentemente comparados a vento e nuvens. Eles estão em constante movimento, entrando e saindo — às vezes resultando em formas e cenas cativantes e, em outros momentos,…",
    category: "autoconhecimento",
    duracaoMin: [30, 45],
    formato: ["roleplay"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 1 - Quando em dúvida, concentre-se em aprimorar habilidades interpessoais fundamentais." },
      { type: "paragraph", text: "Aplicabilidade: Item TDPA 5Ai, ii, iv (também aplicável a 3Bi, ii, Di-iv 4C)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Na prática do Zen, pensamentos e emoções são frequentemente comparados a vento e nuvens. Eles estão em constante movimento, entrando e saindo — às vezes resultando em formas e cenas cativantes e, em outros momentos, sinalizando uma tempestade e a necessidade de se abrigar. Todos são transitórios. Ao inserir os termos \"nuvem\" e \"Zen\" em seu mecanismo de busca favorito, são retornados 20 milhões de resultados. O conselho oferecido é surpreendentemente semelhante em todos os links: observe e não faça nada. Pensamentos e emoções, aconselham os mestres, não são o pensador ou a pessoa que está sentindo. Então, deixe-os passar. Sem julgamento. Sem conexão. Sem interpretação. Por mais paradoxal que possa parecer, tratar pensamentos e emoções de maneira impessoal — como nada mais do que padrões de clima em mudança — aumenta nossa capacidade de aprender sobre e gerenciar melhor nosso mundo interno. De acordo com Jon Kabat-Zinn (2019), isso nos permite \"[usar] o pensamento e a emoção sem sermos pegos e aprisionados por padrões de hábito insensatos e não examinados ao longo de uma vida\" (parágrafo 13). Fazer terapia provoca uma ampla gama de pensamentos e emoções. Primeiro, há os sentimentos e experiências dos clientes, sua dor, tristeza, medo, raiva, culpa, e assim por diante. Em segundo lugar, estão os pensamentos, sentimentos e experiências do terapeuta — a empatia que sentem por aqueles com quem trabalham, a alegria, frustração, empolgação, tédio, desânimo, nojo ocasional e outras reações, às vezes inexplicáveis, que surgem em resposta a um cliente específico ou à sua história. Como observado na revisão das características profissionais do terapeuta, reações comportamentais, cognitivas, somáticas e afetivas negativas em relação ao cliente ou ao trabalho estão inversamente relacionadas ao resultado. Em resumo, quanto maior o número delas, menos eficaz é a terapia. Este exercício é projetado para promover a consciência e melhor gerenciamento dessas reações." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Ao final de alguns dias trabalhando com clientes, reflita sobre aqueles com os quais você experimentou uma reação cognitiva, somática e afetiva negativa. Usando um Post-it ou seu aplicativo de anotações favorito, escolha um e faça uma anotação, listando o que você pensou ou sentiu, quaisquer sensações físicas acompanhantes e sua localização (por exemplo, peito, barriga, cabeça). Assim como as crianças costumam fazer com nuvens, em seguida, dê um nome à sua reação — talvez a forma ou local onde foi sentida, uma pessoa que lembra, ou uma memória. Seja chamando-o de afiado, opaco, cachorro, peixe, montanha, estômago ou Bob, faça isso rapidamente, sem perseverar ou procurar significados ocultos. Em seguida, coloque o que você escreveu de lado e passe 5 a 10 minutos tranquilos e ininterruptos fazendo nada. Seja o que acontecer a seguir, por mais interessante, ameaçador, assustador ou estimulante que pareça, deixe passar como nuvens no céu. Após um mês, revise suas anotações, procurando e classificando padrões. Preste atenção àquelas que se repetem e provocam a reação mais forte ou mais disruptiva. Depois de refrescar sua memória dos detalhes, repita a atividade descrita no parágrafo anterior, dedicando 5 a 10 minutos à meditação privada. Você saberá que está progredindo quando conseguir notar rapidamente, mas não se absorver ou distrair quando \"Bob\", \"afiado\" ou \"montanha\" aparecer." },
    ],
  },
  {
    slug: "volta-ao-classico",
    number: 24,
    title: "Volta ao Clássico",
    summary:
      "A qualidade da sintonia empática de um terapeuta não pode ser avaliada com precisão por meio da intuição ou reflexão profunda. Simplesmente, não possuímos a percepção do cliente sem acolhê-la e obtê-la sistematicamente.",
    category: "relacao",
    duracaoMin: [40, 60],
    formato: ["reflexao", "preenchimento"],
    pessoas: "solo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 3 - Sintonizar, alinhar e colaborar para impacto" },
      { type: "paragraph", text: "Aplicabilidade: Item TDPA 3Bi, v (também aplicável a 4C, E)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "A qualidade da sintonia empática de um terapeuta não pode ser avaliada com precisão por meio da intuição ou reflexão profunda. Simplesmente, não possuímos a percepção do cliente sem acolhê-la e obtê-la sistematicamente." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Escreva os nomes de seus clientes ativos em papéis separados. Quando terminar, misture todos os nomes em um chapéu (ou caixa). Para os primeiros 15 papéis sorteados, comece a administrar o clássico Inventário de Relacionamento de Barrett-Lennard (de Barrett-Lennard, 2015, ou online em vários sites). Após calcular a amplitude (ou seja, o mais alto e o mais baixo) e a média das pontuações de seus clientes," },
      {
        type: "list",
        items: [
        "Compare a pontuação de cada cliente de sessão em sessão, considerando o que contribuiu para aumentos ou diminuições.",
        "Compare sua pontuação média com a da amostra normativa, refletindo sobre como seus clientes normalmente vivenciam sua sintonia empática. Observe especificamente aqueles clientes cujas pontuações ficam abaixo das normas.",
        "Identifique casos de pontuações em declínio (lembrando da pesquisa revisada anteriormente neste capítulo, mostrando que a sintonia empática está associada a resultados melhores). Use o método descrito no Exercício 1 (Parceria para Melhoria) para promover o desenvolvimento de alternativas mais úteis.",
        "De mês a mês, repita o exercício conforme descrito. À medida que os dados se acumulam, classifique as pontuações por idade, identidade de gênero, diagnóstico ou cultura, identificando quaisquer agrupamentos nos quais você se sai pior no Inventário de Relacionamento de Barrett-Lennard. Responder empaticamente inclui sensibilidade e ajuste ao cliente individual e ao momento singular. Isso inclui atender e responder terapeuticamente àqueles para quem respostas empáticas convencionais de Rogers não se mostram ideais, bem como clientes com os quais — consciente ou inconscientemente — você oferece compreensão subótima.",
        "Use o método descrito no Exercício 1 (Parceria para Melhoria) para promover o desenvolvimento de alternativas mais úteis.",
        ],
      },
      { type: "paragraph", text: "Lembre-se, mesmo que desagradáveis no início, os dados são sempre amigáveis a longo prazo. Se os resultados apoiam sua qualidade empática percebida com a maioria dos clientes, então, por todos os meios, passe a remediar outras habilidades relacionais. Se os resultados não são favoráveis, dedicar tempo adicional para aprimorar suas habilidades empáticas pode fazer uma diferença definitiva em seus resultados clínicos." },
    ],
  },
  {
    slug: "apenas-conecte-e-m-forster-howards-end",
    number: 25,
    title: "Apenas Conecte (E. M. Forster, Howards End)",
    summary:
      "De acordo com revisões de pesquisas, o melhor treinamento de habilidades em empatia começa com aulas teóricas e termina com elementos experienciais (Elliott et al., 2019). Este exercício une esses dois elementos…",
    category: "relacao",
    duracaoMin: [30, 45],
    formato: ["roleplay", "reflexao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 3 - Sintonizar, alinhar e colaborar para impacto" },
      { type: "paragraph", text: "Aplicabilidade: Item TDPA 3Bi, v (também aplicável a 4C, D, E; 5Aiv, viii, 5Bi)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "De acordo com revisões de pesquisas, o melhor treinamento de habilidades em empatia começa com aulas teóricas e termina com elementos experienciais (Elliott et al., 2019). Este exercício une esses dois elementos críticos usando o livro de William R. Miller (2018) \"Ouvindo Bem: A Arte da Compreensão Empática\". Como você verá, este volume enxuto contém didáticas apresentadas em seções breves e claras, apoiadas por inúmeros exercícios projetados para aprimorar habilidades de escuta calorosa e precisa de outra pessoa. Os exercícios podem ser feitos em qualquer relacionamento razoavelmente próximo, proporcionando muitas oportunidades para prática e aprimoramento de habilidades fora da terapia." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Nas páginas 14–18, W. R. Miller oferece uma verdadeira jóia, uma lista de 12 obstáculos à escuta empática. Esses surpreenderão muitas pessoas, pois incluem uma variedade de comportamentos comumente empregados em conversas que se acredita serem \"positivas\" na vida diária (por exemplo, investigar, concordar, tranquilizar), mas que interferem na verdadeira escuta empática. Em vez de ajudar os clientes a desenvolver uma compreensão mais profunda do que estão sentindo e do que querem dizer, esses comportamentos os interrompem. Comece imprimindo a lista dos 12 obstáculos e mantenha-os à mão. Então, por um mês, sempre que surgir a oportunidade de uma conversa com um colega ou amigo, pergunte se eles ajudariam com um breve experimento. Avise que nada especial é necessário da parte deles. Vocês dois conversarão brevemente, e você pedirá feedback sobre a experiência. Caso concordem, continue a conversa, intercalando o máximo possível de respostas com obstáculos nos primeiros 5 minutos. Cada uma deve ser curta e objetiva, aproveitando qualquer oportunidade que surja naturalmente na conversa, por exemplo, julgando (\"Você realmente deveria fazer isso. Você precisa de...\") e concordando (\"Sim, sim, você está certo\"). Usando uma escala de 1 a 10, peça ao ouvinte para avaliar o quanto se sentiram ouvidos e compreendidos. Nos próximos 5 minutos, evite o máximo possível dos obstáculos. Isso será mais difícil do que você provavelmente imagina. Mais uma vez, peça à pessoa para avaliar a experiência de ser ouvida e compreendida. Faça anotações sobre sua experiência e aprendizados. Volte para \"Ouvindo Bem\" e preste atenção especial no Capítulo 8, \"Formando Reflexões\". Aqui, você encontrará instruções específicas e exemplos para desenvolver comportamentos positivos que, usados em combinação com atenção real ao falante (em vez de atenção dividida enquanto pensa no que dizer em seguida ou no que você quer que eles façam), promoverão uma melhor compreensão empática. Um aviso e um conselho: O exercício que W. R. Miller sugere parece tão simples que você pode pensar que já o faz bem. Pratique com um ou dois de seus amigos mais próximos, e você logo descobrirá que é muito mais desafiador. Comece solicitando o comprometimento de um amigo ou colega para ajudá-lo a praticar suas habilidades de escuta. Dez a 15 minutos são tudo o que é necessário, com reuniões espaçadas ao longo de um período prolongado (por exemplo, 1 mês), deixando tempo entre elas para reflexão e consolidação da aprendizagem. Comece cada reunião pedindo à pessoa para dizer: \"Algo que você deveria saber sobre mim é que eu sou _______\", terminando com um adjetivo aberto à interpretação. Siga a declaração deles com uma reflexão, que será o seu melhor palpite ou hipótese sobre o sentimento, motivação ou valor contido no que o falante disse. Importante, sua resposta não deve ser formulada como uma pergunta e deve terminar com uma entonação de voz descendente. O falante segue, informando se você está certo ou errado ou esclarecendo. Com base em sua resposta, ofereça outra reflexão, continuando o processo por várias rodadas na conversa. O desafio para o ouvinte é lembrar de refletir não apenas a declaração original, mas também as novas informações adicionadas a cada turno. No final da conversa, peça um feedback detalhado de seu amigo/ouvinte, observando, em particular, os momentos em que sentiram que você realmente compreendeu o que estavam tentando comunicar. Observe que a maioria acha difícil alcançar consistência em suas reflexões! Tenha paciência. Mantenha um registro de seus aprendizados." },
    ],
  },
  {
    slug: "o-que-carl-rogers-faria",
    number: 26,
    title: "O que Carl Rogers faria?",
    summary:
      "Raramente recomendamos a leitura ou a observação de gravações como métodos eficazes de Prática Deliberada. A única exceção é o trabalho de Carl Ransom Rogers. Suas escritas publicadas e demonstrações em vídeo (além da…",
    category: "autoconhecimento",
    duracaoMin: [30, 45],
    formato: ["roleplay", "reflexao"],
    pessoas: "solo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípios: 2 - Se envolva genuinamente em um relacionamento real. / 3 - Sintonizar, alinhar e colaborar para impacto" },
      { type: "paragraph", text: "Aplicabilidade: Item TDPA 3Bi, ii (também aplicável a 4D, 5Aii)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Raramente recomendamos a leitura ou a observação de gravações como métodos eficazes de Prática Deliberada. A única exceção é o trabalho de Carl Ransom Rogers. Suas escritas publicadas e demonstrações em vídeo (além da infame Gloria ou Three Approaches to Psychotherapy) sobre as condições facilitadoras centrais da psicoterapia devem fazer parte do desenvolvimento profissional de todo profissional de saúde, especialmente no que diz respeito ao apoio positivo incondicional." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Parte 1. Decida mergulhar no trabalho de Rogers, localizando artigos, livros e gravações. Ao longo de um mês ou mais, por no máximo uma hora por vez, estude suas escritas ou assista a vídeos. Absorva a complexidade e variedade de como ele fala sobre e expressa consideração incondicional. Preste atenção especial em como ele exala isso de muitas maneiras. Seja paciente. Provavelmente, levará tempo. Como ele observou, \"É uma maneira de ser\" (Rogers, 1980), não uma técnica. Usando papel e caneta ou seu aplicativo de anotações favorito, mantenha um registro de suas observações e aprendizados, prestando atenção especial aos \"pontos doces\" no que ele fez e disse. Ao assistir a um vídeo dele trabalhando com um cliente, use a técnica de parar–iniciar—especificamente, parando a gravação antes da vez de Rogers na conversa, primeiro escrevendo como você responderia e depois comparando com o que ele disse. Lembre-se de que suas reflexões sobre a diferença são mais importantes do que acertar exatamente as palavras. Você saberá que está progredindo quando (a) abandonar a noção comum, embora antiquada, de que Rogers simplesmente alimentava os clientes com elogios, (b) acumular novas formas de comunicar consideração positiva e (c) se pegar experimentando mais genuíno apreço não possessivo pela singularidade de seus clientes." },
      { type: "paragraph", text: "Parte 2. A Parte 2 deste exercício poderia ser chamada de \"Andar nos Sapatos do Seu Cliente\". A expressão está sendo usada aqui literalmente em vez de figurativamente. Parte de comunicar respeito e cuidado pelas pessoas com quem trabalhamos é criar um ambiente físico seguro, tranquilo e nutritivo. Comece refletindo sobre seu \"espaço terapêutico\": as comunicações que os clientes têm antes de sua primeira consulta, onde entram no prédio, sua sala de espera e sua sala de consultas (mesmo que seja online). Considere a atmosfera, cor, som, iluminação, segurança, ventilação, piso e mobília. Os materiais de leitura na sala de espera estão organizados, limpos e atualizados? As cadeiras são confortáveis? A arte tem significado? Qual é a sensação geral? Termine pedindo a cinco não terapeutas para visitarem. Enquanto espera do lado de fora, peça que se sentem na sua sala de espera e consultório, anotando suas impressões imediatas. Aceite discrepâncias como feedback. Outros recursos ambientais a serem considerados? Documentação, faturamento e quaisquer medidas que você normalmente pede aos clientes para completar. Avalie o que esses procedimentos e experiências comunicam. Eles transmitem adequadamente consideração positiva—um apreço pela singularidade de cada cliente individual? Novamente, guie cinco não terapeutas por seu processo. Peça-lhes que reflitam sobre a experiência, observando que sentimentos ela evoca ou inspira. Considere criar um projeto de aprendizado, conforme descrito nos Capítulos 2 e 9, com o objetivo de corrigir o que é insatisfatório no ambiente que você procura projetar. Faça pequenos ajustes e depois repita o exercício a cada 6 meses para garantir que seu ambiente terapêutico represente o melhor de você." },
    ],
  },
  {
    slug: "ajuste-seu-coracao-corretamente-confucio",
    number: 27,
    title: "Ajuste Seu Coração Corretamente (Confúcio)",
    summary:
      "A congruência é tanto intrapessoal (qualidade do terapeuta) quanto interpessoal (relacional) em sua natureza. A atenção plena, o alongamento e o relaxamento podem todos ajudar a \"ajustar corretamente seu coração\" para…",
    category: "autoconhecimento",
    duracaoMin: [30, 45],
    formato: ["roleplay", "preenchimento", "supervisao"],
    pessoas: "supervisor",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 2 - Se envolva genuinamente em um relacionamento real." },
      { type: "paragraph", text: "Aplicabilidade: Item TDPA 3Biii, iv (também aplicável a 5Avi)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "A congruência é tanto intrapessoal (qualidade do terapeuta) quanto interpessoal (relacional) em sua natureza. A atenção plena, o alongamento e o relaxamento podem todos ajudar a \"ajustar corretamente seu coração\" para encontrar-se com os clientes. De fato, um ensaio clínico randomizado multicêntrico descobriu que terapeutas que praticavam a atenção plena antes da sessão estavam mais presentes em suas reuniões com os clientes. No entanto, isso não necessariamente resultou em torná-los mais eficazes (Dunn et al., 2013). Embora decepcionante, tal descoberta não surpreenderá ninguém que compreenda a prática deliberada. Como observado no Capítulo 1, para ser eficaz, o tempo dedicado ao desenvolvimento profissional deve visar ajudá-lo a alcançar objetivos ligeiramente além de sua habilidade atual. O processo começa usando dados para identificar déficits de desempenho." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "No final de cada dia passado em reuniões com clientes, reserve alguns momentos para revisar aquelas sessões em que você experimentou uma falta de congruência, seja internamente ou na interação terapêutica. Em 100 palavras ou menos, anote o cliente e a hora do dia, além de quaisquer outros fatores que considere contribuintes. Após concluir o processo pelo menos 10 vezes, recupere suas anotações, classificando a coleção em temas. Refine a lista continuando o exercício em dias adicionais. Desenvolva um plano para abordar os temas dominantes (por exemplo, envolver-se em práticas de atenção plena antes da sessão, diminuir o número de clientes atendidos ou os horários em que encontra clientes, comprometendo-se a deixar tempo suficiente entre as visitas para ler as anotações de casos antes de encontrar-se com eles). Revise seus planos com um colega confiável, supervisor ou consultor especializado." },
    ],
  },
  {
    slug: "va-para-a-gravacao",
    number: 28,
    title: "Vá para a Gravação",
    summary:
      "As sessões de psicoterapia são frequentemente crisóis afetivos em que nem o paciente nem o terapeuta têm uma memória precisa sobre a expressão e processamento das emoções durante a sessão. Assim, classificações de…",
    category: "relacao",
    duracaoMin: [30, 45],
    formato: ["reflexao", "preenchimento"],
    pessoas: "dupla",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 4 - Facilite a expressão e processamento emocional para melhores resultados" },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 3Bii, iii, vi, 3Dii, iii, iv (também aplicável a 1K, 5Ai,ii)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "As sessões de psicoterapia são frequentemente crisóis afetivos em que nem o paciente nem o terapeuta têm uma memória precisa sobre a expressão e processamento das emoções durante a sessão. Assim, classificações de observadores podem ser fontes melhores de informação do que relatos pós-sessão do terapeuta ou do cliente, para determinar quando o terapeuta involuntariamente diminui a experiência e expressão da emoção." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Parte 1. Se você ainda não começou a fazer isso, comece a gravar seu trabalho (com consentimento informado, é claro). Identifique aquelas sessões em que o cliente expressou uma quantidade pequena de emoção. Em seguida, reserve 30 minutos de tempo ininterrupto. Nos primeiros 20 minutos, assista a uma das gravações. Cuidado! Áudio e vídeo são meio densos. Para se proteger contra a sobrecarga de informações, limite seu foco a um único objetivo: encontrar trocas durante a hora em que sua resposta verbal (ou a falta dela) diminuiu involuntariamente a experiência, expressão ou processamento de emoções do cliente. Pense neste exercício como uma análise detalhada de duplas de respostas que não levaram a ou resultaram em vivências afetivas em lugares que a evidência de pesquisa e seu modelo de tratamento considerariam desejáveis. Depois de localizar pelo menos quatro trocas, dedique os últimos 10 minutos a refletir sobre as razões (tanto conscientes quanto parcialmente inconscientes) para desencorajar ou minimizar as emoções do cliente. Isso parece doloroso demais? Você se sente desconfortável com afeto intenso? Você está muito fatigado para lidar com isso? Existem padrões em seu comportamento? Como poderia ser uma resposta diferente que pareça congruente para você e sua abordagem terapêutica?" },
      { type: "paragraph", text: "Parte 2. No início de Better Results, você foi solicitado a criar um esquema ou plano detalhado de como você faz terapia, suficientemente detalhado para que outro profissional possa entender e replicar literalmente, \"entrar em seus sapatos\" e trabalhar como você trabalha (S. D. Miller et al., 2020, p. 29). O propósito do exercício era possibilitar que os clínicos identificassem onde poderiam intervir uma vez que as oportunidades de melhoria de desempenho derivadas de dados fossem identificadas. Em resposta ao feedback dos leitores, uma versão mais detalhada (e esperamos que aprimorada) foi desenvolvida e incluída no Field Guide (consulte pp. 18-20, Capítulo 1). Se você ainda não concluiu a atividade, faça isso agora. Em seguida, com seu \"mapa\" completo em mãos, considere onde, quando e como a expressão emocional do cliente desempenha um papel em sua abordagem de tratamento. Se não for mencionado explicitamente, adicione, tomando o tempo para identificar como está relacionado com suas premissas teóricas e plano de ação geral. Termine esta atividade retornando às trocas da gravação que você revisou e, para cada uma, escreva especificamente como você convidaria o cliente a vivenciar e expressar emoções consistentes com sua abordagem terapêutica. Espere para verificar o progresso até repetir o exercício algumas vezes por semana por pelo menos um mês. Isso pode ser feito revisando as gravações de sessões subsequentes com os mesmos clientes." },
    ],
  },
  {
    slug: "avalie-e-preveja",
    number: 29,
    title: "Avalie e Preveja",
    summary:
      "As boas notícias são que o treinamento na construção de alianças frequentemente resulta em alianças terapêuticas aprimoradas na sessão; as más notícias são que esse treinamento exige um bom tempo e esforço do…",
    category: "relacao",
    duracaoMin: [30, 45],
    formato: ["preenchimento"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 3 - Sintonizar, alinhar e colaborar para impacto" },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 3Ai–iv, 3Cii, vi (também aplicável a 1D-F, 4A, B, E)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "As boas notícias são que o treinamento na construção de alianças frequentemente resulta em alianças terapêuticas aprimoradas na sessão; as más notícias são que esse treinamento exige um bom tempo e esforço do profissional (por exemplo, Ackerman & Hilsenroth, 2003; Crits-Christoph et al., 2006; Muran et al., 2018). Como a aliança literalmente significa estar em um estado de concordância ou correspondência, o sucesso requer saber quando existe uma diferença entre nossos clientes e nós. Esta atividade é projetada para promover tal consciência." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Ao final de cada sessão, enquanto seus clientes preenchem o SRS, preencha um para si mesmo da perspectiva do cliente. O objetivo é ser alterado ou desconfirmado, não confirmado. Por quê? Como mencionado no Capítulo 1, nossos cérebros são programados para a novidade. Simplificando, ouvimos melhor quando enfrentamos situações desafiadoras ou surpreendentes. Continue a atividade por um mês, fazendo anotações sobre o que você aprende. Novamente, classifique os padrões. Existem clientes específicos, problemas apresentados, horários do dia ou dias da semana em que você está mais propenso a estar em desalinhamento?" },
    ],
  },
  {
    slug: "estou-sem-pistas",
    number: 30,
    title: "Estou Sem Pistas",
    summary:
      "O planejamento do tratamento e a popularidade dos chamados objetivos SMART podem inadvertidamente levar à visão dos objetivos terapêuticos como estáticos. Na verdade, os objetivos, significado ou propósito do…",
    category: "relacao",
    duracaoMin: [30, 45],
    formato: ["roleplay", "preenchimento", "supervisao"],
    pessoas: "supervisor",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 3 - Sintonizar, alinhar e colaborar para impacto" },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 3Ai, ii (também aplicável a 1F, H, I, 2B, 4A, B, E)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "O planejamento do tratamento e a popularidade dos chamados objetivos SMART podem inadvertidamente levar à visão dos objetivos terapêuticos como estáticos. Na verdade, os objetivos, significado ou propósito do tratamento estão constantemente evoluindo. Na melhor das hipóteses, os objetivos devem ser vistos como marcos temporários - verbos em vez de substantivos - sujeitos a mudanças à medida que o progresso é alcançado (ou não) ao longo de um episódio de cuidados. O objetivo deste exercício é duplo: (a) melhorar a consciência do terapeuta e o ajuste aos objetivos do cliente e (b) aumentar a consciência do terapeuta e a integração das preocupações, esperanças e objetivos de outros interessados." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Selecione aleatoriamente 10 clientes de sua carga de trabalho com os quais você se encontrou pelo menos duas vezes, mas não mais do que cinco vezes. Antes da próxima visita agendada, escreva o que você acredita serem seus objetivos. Note se os objetivos deles evoluíram desde o início do tratamento. Quando você se encontrar com eles, pergunte algo ao longo das seguintes linhas: \"Vamos tirar um momento e verificar o que você espera alcançar aqui. Finja que estou sem pistas sobre seus objetivos para a psicoterapia. O que você diria que são?\" Continue o processo por várias semanas ou até coletar dados de 30 clientes no total. Uma vez concluído, comece a comparar sistematicamente as respostas deles com suas próprias respostas escritas, observando o nível de concordância e o grau de divergência. Que padrões, se houver, surgem? Considere o nível e a taxa em seu trabalho com clientes obrigatórios, jovens, casais ou famílias. É mais ou menos frequente? Se discrepâncias forem aparentes, mantenha um registro de com quem você tende a se alinhar com mais e menos frequência. Classifique por padrões, dedicando tempo eventualmente para desenvolver um plano para melhorar a colaboração e o consenso, abordando os temas dominantes (por exemplo, envolvimento em práticas de mindfulness antes da sessão, diminuição do número de clientes atendidos ou horários do dia em que você atende clientes, comprometendo-se a deixar tempo suficiente entre as visitas para ler as anotações do caso antes de se encontrar). Reveja suas ideias com um colega de confiança, supervisor ou consultor especializado." },
    ],
  },
  {
    slug: "reparando-rupturas",
    number: 31,
    title: "Reparando Rupturas",
    summary:
      "Quando se trata de rupturas na aliança em psicoterapia, reparar é literalmente sobre voltar a unir o terapeuta ao cliente. Não existe uma prescrição exata para lidar com rupturas. Equipar os terapeutas com as…",
    category: "relacao",
    duracaoMin: [40, 60],
    formato: ["roleplay", "reflexao", "preenchimento"],
    pessoas: "grupo",
    tags: ["ruptura"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 1 - Evite os erros, e quando você (inevitavelmente) cometê-los, repare o relacionamento" },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 3Bii, Di (também aplicável a 5Ai, ii, iv)" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Quando se trata de rupturas na aliança em psicoterapia, reparar é literalmente sobre voltar a unir o terapeuta ao cliente. Não existe uma prescrição exata para lidar com rupturas. Equipar os terapeutas com as habilidades necessárias para desenvolver suas próprias soluções personalizadas (Eubanks et al., 2019) envolve" },
      {
        type: "list",
        items: [
        "Reconhecer as rupturas quando ocorrem (tanto as rupturas de retirada quanto as de confronto),",
        "Tolerar as emoções difíceis que evocam,",
        "Afirmar os clientes por expressarem seu descontentamento (mesmo que indiretamente) e",
        "Responder de maneiras empáticas e flexíveis.",
        ],
      },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Parte 1. Se você identificou a reparação de rupturas como um alvo para o DP - seja por métricas específicas em seus dados de desempenho (por exemplo, alta taxa de desistência, baixas pontuações no SRS ou relato do cliente) ou por conclusão do TDPA - seu primeiro passo é refletir sobre sua história. Das quatro habilidades listadas anteriormente, observe qual, seja em seu trabalho clínico ou terapia pessoal, se mostra mais desafiadora. Após fazer isso, crie um projeto de aprendizado. Leia. Assista e/ou envolva um especialista. Faça simulações fora da sessão - novamente, interpretando clientes ou terapeutas que você conheceu." },
      { type: "paragraph", text: "Parte 2. Comece fazendo uma \"cesta de coleta\". Quando você experimentar uma ruptura com um cliente ou ouvir falar de uma relatada por um colega, anote e adicione à sua coleção. Depois de ter 10 ou mais, escolha duas rupturas de confronto (por exemplo, um adolescente reclamando que \"você sempre está do lado dos meus pais\"; um cliente mais velho respondendo à sua expressão bem-intencionada de compreensão com \"Você ainda não me entende de jeito nenhum\") e duas rupturas de retirada (por exemplo, uma criança se retirando fisicamente e verbalmente da sessão, um adulto manifestando descontentamento distante, mas sem verbalizá-lo). Em seguida, registre membros da família ou amigos reencenando brevemente as rupturas. Reproduza a gravação e escreva uma resposta, lembrando-se de incorporar as quatro habilidades mencionadas anteriormente. Continue o exercício até que os cenários se esgotem." },
    ],
  },
  {
    slug: "utilizando-a-metaestrutura-da-estrutura-terapeutica-para-aut",
    number: 32,
    title: "Utilizando a Metaestrutura da Estrutura Terapêutica para Autoavaliação",
    summary:
      "Este exercício utiliza as dimensões da metaestrutura apresentadas no capítulo para ajudar você a avaliar pontos fortes e fracos na maneira como utiliza fatores estruturais para benefício terapêutico.",
    category: "operacional",
    duracaoMin: [40, 60],
    formato: ["roleplay"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 1 - Elabore inícios mais inteligentes para a terapia (Dimensão de Sequência). / 2 - Evite atividades de estruturação não auxiliares (Dimensão de Fronteira). / 3 - Conheça o seu trabalho (Dimensão de Sequência). / 4 - Isso, também, terá um fim (Dimensão de Sequência). / 5 - Utilize os dados sabiamente (Dimensão de Avaliação)." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 1 A a N" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Este exercício utiliza as dimensões da metaestrutura apresentadas no capítulo para ajudar você a avaliar pontos fortes e fracos na maneira como utiliza fatores estruturais para benefício terapêutico." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "A Tabela 7.3 (ver no Field Guide, p. 316) apresenta perguntas para ajudar os clínicos a identificar e esclarecer como impõem a estrutura terapêutica em seu trabalho clínico. Após cada pergunta, há exemplos de comportamentos do cliente e do terapeuta que podem sinalizar a necessidade de melhorar ou ajustar a estrutura para maximizar a adequação e o efeito. Como pode ser visto, ao lado de cada conjunto de comportamentos de exemplo, há uma lista de estratégias para aprimorar a estrutura terapêutica. Siga as etapas a seguir para ajudar a identificar sua área de aprendizado e atividades que podem aprimorar sua prática:" },
      {
        type: "list",
        items: [
        "Utilizando seus dados de aliança e resultados, crie uma lista de clientes que não se beneficiaram da terapia contigo.",
        "Com esses clientes em mente, revise as dimensões, perguntas e comportamentos listados na Tabela 7.3.",
        "Identifique quaisquer tendências, comportamentos e/ou estratégias que surgem com mais frequência ou que são frequentemente negligenciados.",
        "Use suas descobertas deste exercício para orientar o foco da sua prática deliberada.",
        ],
      },
    ],
  },
  {
    slug: "utilizando-metaforas",
    number: 33,
    title: "Utilizando Metáforas",
    summary:
      "Este exercício tem como objetivo ajudá-lo a desenvolver explicações claras e simples sobre o processo terapêutico e suas estruturas utilizando metáforas.",
    category: "tecnica",
    duracaoMin: [40, 60],
    formato: ["preenchimento"],
    pessoas: "grupo",
    tags: ["metafora"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 1 - Elabore inícios mais inteligentes para a terapia (Dimensão de Sequência)." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 1 A a C" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Este exercício tem como objetivo ajudá-lo a desenvolver explicações claras e simples sobre o processo terapêutico e suas estruturas utilizando metáforas." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Parte 1. Elabore uma metáfora sobre como você realiza a terapia, preferencialmente destacando a natureza interativa e colaborativa do processo. Um exemplo pode ser reformar uma casa com um empreiteiro, outro uma expedição glacial com um guia. O importante é que sua metáfora capture como você realmente trabalha (por exemplo, seu plano), além de ser consistente com sua abordagem teórica. Uma vez concluído, teste sua metáfora com um coach ou parceiro de prática. À medida que ganha confiança, aumente a dificuldade pedindo ao seu coach ou parceiro de prática que apresente de maneiras mais desafiadoras. Considere adaptações para diferentes apresentações e necessidades." },
      { type: "paragraph", text: "Parte 2. Amplie a metáfora desenvolvida na tarefa anterior desenvolvendo estruturas para comunicar os papéis e processos da terapia. Com seu roteiro em mãos, adicione elementos relacionados a papéis e expectativas. Considere, por exemplo, como sua metáfora captura:" },
      {
        type: "list",
        items: [
        "O papel do terapeuta (por exemplo, honesto, atencioso, interessado);",
        "O papel do cliente (por exemplo, trabalhar fora da sessão, o valor de abordar experiências dolorosas);",
        "A necessidade de feedback do cliente em relação a intervenções, tarefas de casa e progresso; e",
        "Os indicadores de sucesso, fracasso e conclusão da terapia.",
        ],
      },
      { type: "paragraph", text: "Uma vez concluído, teste suas adições com um parceiro de prática ou coach. Use seus dados de resultado para identificar grupos de clientes ou apresentações que têm sido mais propensos a abandonar a terapia ou experimentar falta de progresso. Considere como você poderia modificar sua metáfora para envolver melhor e ajudar esses grupos específicos de clientes." },
      { type: "paragraph", text: "Parte 3. Refine ainda mais sua metáfora, destilando o conteúdo para seus elementos essenciais para uma comunicação ultra breve. Com sua metáfora em mãos, finja que está em um elevador com um novo cliente. Usando o cronômetro do seu telefone celular, apresente sua proposta conforme escrita. Anote o tempo. Sem falar mais rápido, trabalhe para transmitir os elementos-chave em 45 segundos ou menos. Em prol da clareza, pratique fornecendo sua mensagem refinada para cinco pessoas diferentes, incluindo pelo menos uma criança, um colega e uma pessoa demograficamente diferente de você (por exemplo, em gênero, cultura, orientação sexual, status socioeconômico). Em seguida, usando seus dados de resultado, identifique primeiro os clientes que desistiram após a primeira ou segunda visita. Considere como você poderia ter modificado sua mensagem para mantê-los envolvidos, anotando diferentes possibilidades." },
    ],
  },
  {
    slug: "mapeando-o-seu-fluxo",
    number: 34,
    title: "Mapeando o seu Fluxo",
    summary:
      "Selecionar, sequenciar e individualizar intervenções são aspectos-chave da estrutura terapêutica. Este exercício é projetado para ajudá-lo a refinar a maneira como esses elementos funcionam em sua prática clínica.",
    category: "operacional",
    duracaoMin: [30, 45],
    formato: ["discussao"],
    pessoas: "solo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 3 - Conheça o seu trabalho (Dimensão de Sequência)." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 1 I–K" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Selecionar, sequenciar e individualizar intervenções são aspectos-chave da estrutura terapêutica. Este exercício é projetado para ajudá-lo a refinar a maneira como esses elementos funcionam em sua prática clínica." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "No início de Better Results, foi solicitado que você criasse um esquema ou plano para como você faz terapia, suficientemente detalhado para que outro profissional pudesse entender e replicar literalmente, \"entrar nos seus sapatos\" e trabalhar como você trabalha (Miller et al., 2020, p. 29). O objetivo da atividade era facilitar a identificação de onde intervir à medida que oportunidades para melhorar sua eficácia são identificadas pela análise de seus dados de desempenho. Se você ainda não completou um plano, consulte as páginas 18–20 do Capítulo 1, deste volume, para obter instruções atualizadas e passo a passo. Em seguida, utilizando seus dados de resultados, crie uma lista de clientes que não apresentaram melhora durante a terapia com você. Com seu plano em mãos, reveja o trabalho que você fez com cada cliente, observando quaisquer temas recorrentes ou discrepâncias entre as três dimensões da estrutura terapêutica (por exemplo, fronteira, sequência e avaliação). Considere quais mudanças ou nuances precisam ser adicionadas ao seu mapa para estruturar a terapia de forma mais eficaz para esses clientes." },
    ],
  },
  {
    slug: "quando-os-terapeutas-se-desviam",
    number: 35,
    title: "Quando os Terapeutas se Desviam",
    summary:
      "Este exercício tem como objetivo ajudar os terapeutas a enfrentar algumas das principais barreiras para aplicar efetivamente a estrutura na terapia.",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["roleplay"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 2 - Evite atividades de estruturação não auxiliares (Dimensão de Fronteira)." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 1F, H-K" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Este exercício tem como objetivo ajudar os terapeutas a enfrentar algumas das principais barreiras para aplicar efetivamente a estrutura na terapia." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Usando seus dados de resultados ou de aliança, identifique um cliente para quem o benefício terapêutico foi limitado." },
      { type: "paragraph", text: "Revise suas anotações de caso para cada sessão, observando onde suas intervenções ou abordagem pretendidas não seguiram como esperado. Considere as seguintes perguntas (derivadas de Waller & Turner, 2016):" },
      {
        type: "list",
        items: [
        "Em que medida você utilizou totalmente a intervenção terapêutica escolhida e a estrutura associada?Considere especificamente se você se desviou de in vivo (experiência total) para in sensu (dando uma ideia em vez de apoiar a experiência total).",
        "Como os seguintes fatores afetaram a maneira como você usou as técnicas terapêuticas no trabalho?",
        "Feedback do cliente: Foi buscado feedback sobre a experiência do cliente com a atividade terapêutica? Em caso afirmativo, sua reação foi proporcional e responsiva ao feedback?",
        "Crenças do cliente: Em que medida o cliente compreendeu a justificativa por trás da atividade, como se esperava que ela funcionasse, o que poderiam experimentar no processo e os possíveis resultados?",
        "Emoções do cliente: Sua resposta à experiência emocional do cliente foi proporcional e apropriada? Você estava satisfeito de que quaisquer ajustes feitos eram os mais adequados para o que o cliente estava sentindo e o que eles poderiam gerenciar?",
        "Emoções do terapeuta: Ao revisar a sessão, você pode ter uma ideia de como suas próprias emoções podem ter afetado a maneira como você aplicou métodos e técnicas estruturadas? O que ajudou e o que atrapalhou?",
        "Crenças do terapeuta: Como suas próprias crenças afetaram a maneira como você abordou esta atividade terapêutica? Existem ideias sobre os métodos que podem ter impedido você de usar a técnica de maneira mais eficaz?",
        ],
      },
      { type: "paragraph", text: "Depois de revisar as sessões conforme descrito, trabalhe para identificar um objetivo de aprendizado chave. Dependendo de suas respostas às perguntas anteriores, pode ser sobre ajudar o cliente a entender o processo da atividade antes de começar ou talvez oferecer escolhas estruturadas sobre como o tratamento pode ser adaptado quando necessário. Lembrando o conselho oferecido em Better Results de que \"nunca é tarde para ter uma boa sessão\" (ver páginas 165-166), imagine o que você faria de forma diferente se tivesse a chance de refazer, sendo o mais específico possível." },
    ],
  },
  {
    slug: "encerrando-com-firmeza",
    number: 36,
    title: "Encerrando com Firmeza",
    summary:
      "Dependendo da orientação teórica, a estrutura de encerramento da terapia terá aparências diferentes. Independentemente disso, como revisado neste capítulo, a pesquisa mostra que conclusões bem-sucedidas do tratamento…",
    category: "operacional",
    duracaoMin: [60, 90],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 4 - Isso, também, terá um fim (Dimensão de Sequência)." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 1 A, F-I" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Dependendo da orientação teórica, a estrutura de encerramento da terapia terá aparências diferentes. Independentemente disso, como revisado neste capítulo, a pesquisa mostra que conclusões bem-sucedidas do tratamento incorporam elementos e ritmo semelhantes. Este exercício explora como os elementos estruturais identificados como importantes para encerramentos eficazes operam em sua prática terapêutica." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Parte 1. Norcross et al. (2017) identificaram certos elementos estruturais centrais para encerramentos eficazes: (a) preparar explicitamente para o término, (b) orientar o cliente para o crescimento futuro, (c) consolidar ganhos alcançados, (d) expressar orgulho no progresso do cliente e (e) ter mutualidade no relacionamento. Por 1 mês, mantenha um diário de suas reflexões sobre como você aborda cada um desses fatores em sua prática clínica. Considere as seguintes perguntas, por exemplo, sobre como você:" },
      {
        type: "list",
        items: [
        "Prepara explicitamente para o término",
        "Como você fala sobre o término na primeira sessão, nas sessões intermediárias e ao se aproximar de um término real?",
        "Como você conecta objetivos aos encerramentos? (por exemplo, \"Como saberemos que a terapia está completa?\" ou \"Como você gostaria que esse objetivo parecesse daqui a 12 sessões ou um ano?\")",
        "Como suas necessidades pessoais influenciam a forma como você encerra o tratamento?",
        "Orienta o cliente para o crescimento futuro",
        "Como você prepara o cliente para abordar preocupações psicológicas futuras sem você?",
        "Como você transmite ao cliente que o crescimento e a mudança são processos contínuos e intermináveis?",
        "Como você fala com o cliente sobre problemas ou objetivos ainda a serem alcançados sem parecer crítico ou minar a confiança e a esperança?",
        "Consolida os ganhos alcançados",
        "Como você comunica sobre o progresso que os clientes fizeram no tratamento?",
        "Expressa orgulho no progresso do cliente",
        "De que maneiras você compartilha seus sentimentos autênticos com os clientes em relação ao progresso deles?",
        "Você percebe algum padrão com clientes específicos ou preocupações apresentadas onde você tem dificuldade em expressar esse orgulho?",
        "Trabalha para a mutualidade no relacionamento",
        "Como você apoia a independência do cliente, o senso de autoconfiança e a capacidade de resolver problemas no futuro?",
        "Como você promove um senso de igualdade no relacionamento?",
        ],
      },
      { type: "paragraph", text: "Parte 2. Usando seus dados de resultados, identifique cinco clientes nos quais o encerramento do tratamento poderia ter sido melhorado. Isso pode incluir:" },
      {
        type: "list",
        items: [
        "Encerramentos não planejados",
        "Encerramentos nos quais o cliente relatou não estar preparado para o término",
        "Episódios de terapia que pareciam continuar por mais tempo do que o necessário",
        ],
      },
      { type: "paragraph", text: "Usando papel e lápis ou seu software de anotações favorito, liste cada cliente pelo nome. Em seguida, observe quais das seguintes abordagens baseadas em evidências para estruturar o encerramento da terapia estavam ausentes: (a) discussão sobre término no início da terapia, (b) conectar rotineiramente atividades terapêuticas durante o tratamento ao objetivo desejado para os serviços, (c) revisões estruturadas do progresso ao longo da terapia, (d) menções explícitas desde o início do tratamento sobre o potencial de crescimento além da terapia, (e) planejamento e discussão suficientes do término antes da visita final e (f) discussão e afirmação da melhoria do cliente, incluindo links feitos para o impacto do progresso no funcionamento pós-terapia. Classifique por temas, observando se há padrões em sua estrutura de encerramentos terapêuticos associados de forma confiável a uma taxa mais alta de desistência, encerramentos não planejados, resultados mais fracos ou terapias que continuam apesar da falta de progresso mensurável. Ajuste seu plano de terapia para incluir as atividades ausentes nos momentos apropriados durante o tratamento." },
    ],
  },
  {
    slug: "tornando-a-coleta-de-dados-estruturalmente-terapeutica",
    number: 37,
    title: "Tornando a Coleta de Dados Estruturalmente Terapêutica",
    summary:
      "Este exercício visa ajudar os terapeutas a desenvolverem a estrutura terapêutica necessária para sustentar o uso de medidas de resultado e aliança, mesmo em situações clínicas desafiadoras.",
    category: "operacional",
    duracaoMin: [40, 60],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Princípio: 5 - Utilize os dados sabiamente (Dimensão de Avaliação)." },
      { type: "paragraph", text: "Aplicabilidade: Itens TDPA 1 D-F" },
      { type: "heading", text: "Propósito" },
      { type: "paragraph", text: "Este exercício visa ajudar os terapeutas a desenvolverem a estrutura terapêutica necessária para sustentar o uso de medidas de resultado e aliança, mesmo em situações clínicas desafiadoras." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "A seguir, você encontrará cinco cenários clínicos desafiadores relacionados à dimensão de avaliação da estrutura terapêutica. Pegando um exemplo por semana, considere a estrutura que você aplicaria para lidar com os exemplos de maneira terapêutica, especialmente considerando como eles se conectam à sua orientação teórica e experiência de tratamento." },
      { type: "paragraph", text: "É importante não apressar o processo. Deixe os cenários borbulharem na \"parte de trás de sua mente\" ao longo do dia, fazendo anotações sobre os pensamentos, sentimentos e reações que ocorrem, ao mesmo tempo que resiste à tentação de \"resolver o quebra-cabeça\". A evidência indica que refletir sobre ideias nos permite fazer conexões mais profundas e nuances entre experiências e ideias que, por sua vez, aumentam as possibilidades de ação criativa. Quando possível, para cada cenário, seja específico sobre no que você se concentraria (fronteira), quando se concentraria nisso (sequência) e como continuaria a buscar feedback por meio da administração e discussão de medidas padrão ao longo do caminho (avaliação)." },
      { type: "paragraph", text: "Cenário 1. Você tem incorporado avaliações em seu trabalho clínico por um ano. Você recebe um novo cliente que diz na primeira sessão que não tem muito interesse em fazer avaliações no início e no final da terapia, pois acha que é uma perda de tempo. Eles indicam que, se você insistir em usar as ferramentas, se recusarão a preenchê-las ou responderão aleatoriamente." },
      { type: "paragraph", text: "Cenário 2. Um cliente com quem você tem trabalhado há várias sessões completa a medida de resultado de maneira que sugere uma melhoria significativa desde a última sessão. Ao perguntar sobre a mudança nas pontuações, o cliente começa a chorar descrevendo a última semana como \"o pior período da [sua] vida\"." },
      { type: "paragraph", text: "Cenário 3. Ao pedir a um cliente para completar a medida de resultado que você rotineiramente usa para avaliar o progresso, eles marcam todas as perguntas de maneira superficial (por exemplo, alto ou baixo)." },
      { type: "paragraph", text: "Cenário 4. Seu trabalho com um cliente tem ido bastante bem; você tem conduzido um tratamento estruturado e orientado por protocolo. Avaliações regulares ao longo do tratamento mostraram progresso constante. Na última visita, o cliente expressa frustração por ter que encerrar a terapia meramente \"porque o número pré-planejado de sessões foi concluído.\" Eles insistem que, apesar de suas pontuações melhoradas, continuam se sentindo miseráveis." },
      { type: "paragraph", text: "Cenário 5. Olhando para trás em seus clientes ao longo do último mês, identifique aqueles com os quais você fez o seu melhor para ajustar às suas solicitações estruturais (por exemplo, foco, agendamento, avaliação de progresso), mas que continuam a fazer pouco ou nenhum progresso (pontuações de resultado ruins, sessões perdidas, baixos níveis de engajamento). Escolha um e considere quais ajustes estruturais são os próximos, incluindo encerrar o tratamento, encaminhar para outro provedor ou ambiente, ou aumentar a dose ou intensidade dos serviços." },
    ],
  },
  {
    slug: "interpretallos",
    number: 38,
    title: "INTERPRETÁLLOS",
    summary:
      "Em hermenêutica existem duas macro posições: uma que defende a autonomia do objeto [Ver Betti, 1° cânone] e outra que defende a interpretação enquanto performance [Ex. Escola de Frankfurt]. A primeira posição reporta…",
    category: "tecnica",
    duracaoMin: [60, 90],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "solo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Dificuldade: 2" },
      { type: "paragraph", text: "Complexidade: 1" },
      { type: "paragraph", text: "OBS: Exercício imaginativo, a parte importante é a discussão" },
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "Em hermenêutica existem duas macro posições: uma que defende a autonomia do objeto [Ver Betti, 1° cânone] e outra que defende a interpretação enquanto performance [Ex. Escola de Frankfurt]. A primeira posição reporta uma Verdade ao texto, que pode ser objetivamente descoberta e frequentemente é descrita como a intenção do autor, a verdadeira mensagem que buscava transmitir; Já a segunda posição busca a melhor interpretação, seja a melhor definida como a mais rica, profunda, a que melhor se adequa a minha teoria ou a que faz a vida do paciente melhorar." },
      { type: "paragraph", text: "Em psicologia, em regra, estamos mais interessados na melhora do que na Verdade. Esse é um exercício para treinar as diferentes formas de extrair a melhor interpretação para um caso. Cada uma dos exemplos a seguir são níveis de análise propostos por diferentes autores, são lentes interpretativas que podemos utilizar para compreensão de um caso. Independente da sua teoria de base, tente conhecer outras técnicas interpretativas; discuta como foi essa experiência e peça ajuda quando a descrição for difícil de compreender ao seu monitor. Crie exemplos próprios e variações interpretativas para os exemplos dados." },
      {
        type: "list",
        items: [
        "Nível do Sujeito / Nível do objeto",
        ],
      },
      { type: "paragraph", text: "Descrição: Toda interpretação, a rigor, pode se referir a um objeto “real” no mundo ou a uma “fantasia” interna." },
      { type: "heading", text: "Ex: Meu namorado nunca me escuta, não conversa comigo!", level: 3 },
      { type: "paragraph", text: "À nível do Objeto: A pessoa que você namora não te dá ouvidos." },
      { type: "paragraph", text: "À nível do Sujeito: Algo (algum complexo autônomo) que se expressa como um namorado não permite o diálogo [ex: “Você lembra que na sessão passada você estava flertando com a ideia de mudar de emprego? Você já teve uma conversa séria com a parte de você que quer tanto assim largar a licenciatura?" },
      {
        type: "list",
        items: [
        "Emoção primária e secundária",
        ],
      },
      { type: "paragraph", text: "Descrição: Em DBT acredita-se que a socialização, o contexto e a história de vida do sujeito fazem com que algumas pessoas se afastem das emoções primárias (que “realmente” sentem), por meio de uma emoção secundária, que é sintomática." },
      { type: "heading", text: "Ex: Eu fico muito puto quando vou mal na prova, aí briguei com meu irmão ontem", level: 3 },
      { type: "paragraph", text: "Primária: Ele fica frustrado com seu resultado / Ele tem medo da reação do pai à nota baixa" },
      { type: "paragraph", text: "Secundária: Como se frustrar é se apequenar ele bate no irmãozinho / Como homem (o papai) não chora, ele está dessensibilizado quanto ao medo, já a raiva ele é autorizado a sentir" },
      {
        type: "list",
        items: [
        "Confronto literal (base da concretização de metáfora)",
        ],
      },
      { type: "paragraph", text: "Descrição: A intenção aqui é confrontar a pessoa com a linguagem que ela escolhe usar, é uma forma de “conferir” a intensidade do discurso do paciente e confrontá-lo com suas hipérboles, permitindo ratificação" },
      { type: "heading", text: "Ex: Eu fico muito puta quando vou mal na prova", level: 3 },
      { type: "paragraph", text: "Confronto: Ah, entendi (você fica puta). Então é por isso que você tá chamando aquele colega seu para te ajudar nos estudos." },
      {
        type: "list",
        items: [
        "Hermenêutica da desconfiança",
        ],
      },
      { type: "paragraph", text: "Descrição: Essa é a base para toda interpretação psicanalítica é a imposição (por via di porre) de um elemento externo como chave hermenêutica do discurso, é a base da atenção flutuante, a crença de que o mais relevante nunca está no discurso, mas “por detrás” dele [Ver piada do Zizek sobre os pescadores gays, tudo é sobre sexo, exeto sexo, que é sobre outra coisa]." },
      { type: "heading", text: "Ex: Na minha escola a única coisa que se aprendia era a usar drogas", level: 3 },
      { type: "paragraph", text: "Interpretação: Paciente se acha superior que todo mundo, por ser imaculado (o importante é não ser ‘baitado’ pela intenção do sujeito ao dizer a frase, buscando sempre a intenção do [sujeito do] inconsciente)" },
      {
        type: "list",
        items: [
        "Retificação Subjetiva",
        ],
      },
      { type: "paragraph", text: "Descrição: É a clássica intervenção de Freud no caso Dora, e a mais clássica ainda realização edipiana ao final da peça. Assim como édipo, buscamos em análise compreender o que foi que causou a desgraça na polis [em nossas vidas] e o resultado é sempre o mesmo: fui eu. Retificação subjetiva é o processo analítico de devolver ao paciente o status de sujeito." },
      { type: "heading", text: "Ex: Na minha escola a única coisa que se aprendia era a usar drogas", level: 3 },
      { type: "paragraph", text: "Retificação: Então a única coisa que você aprendeu na escola foi ser um drogado?" },
      {
        type: "list",
        items: [
        "Corte Lacaniano",
        ],
      },
      { type: "paragraph", text: "Descrição: Lacan especifica a “hermenêutica da desconfiança” a partir de sua definição de inconsciente enquanto “O espaço vazio entre dois significantes”, que é pontuado pelo analista no ato da interpretação. Isso “abre espaço para o inconsciente entrar” (metáfora do basculante de Miller). O procedimento aqui é encontrar na linguagem duas falas: a fala do sujeito do discurso [a intenção do paciente ao falar] em contraste com a fala do sujeito do inconsciente [o que é dito pela língua a despeito da intenção de quem fala]. A estrutura de corte se dá devido à necessidade de impedir a resistência, se você não impedir o paciente vai ignorar o sujeito do inconsciente retificando sua intenção inicial." },
      { type: "paragraph", text: "Ex: Tô muito animado com meu novo estágio! Vou só me jogar de cabeça e vê lá o que vai acontecer" },
      { type: "paragraph", text: "Sujeito do discurso: Ele está animado e vai se jogar de cabeça e ver no que dá" },
      { type: "paragraph", text: "Sujeito do inconsciente: Ele vai se jogar de cabeça e velar (no sentido de esconder) o que acontecerá" },
      { type: "heading", text: "Ex²: Lá em casa eu sou muito calada, sou muito tímida sabe…", level: 3 },
      { type: "paragraph", text: "Sujeito do discurso: Sou tímida, por isso não falo em casa" },
      { type: "paragraph", text: "Sujeito do inc: Em casa algo/alguém me cala (e para não ver [essa violência] eu prefiro “me vestir” de tímida, mesmo em outras situações)" },
      {
        type: "list",
        items: [
        "Método Filológico",
        ],
      },
      { type: "paragraph", text: "Descrição: Essa é uma etapa que pode ser acrescentada em diferentes modelos interpretativos, trata-se de um método derivado do “estudo de textos difíceis” que tem como função enriquecer (por vezes esclarecer) o material base, por meio da criação de contexto, para uma posterior interpretação. Três critérios básicos devem ser observados: Você nunca parte de um conhecimento geral para uma inflexão particular; O paralelo deve trazer uma inflexão que não era evidente no ‘texto’ original, enriquecendo-o; O paralelo em algum momento retomar o texto. Lembre-se da máxima “nihil humani a me alienum puto”, um paralelo não precisa ser mitológico, cultura pop, sua vida pessoal, seus outros clientes, filósofos, ditados populares… Todos são possíveis campos para extrair um paralelo." },
      { type: "heading", text: "Ex: Lá em casa eu sou muito calada, sou muito tímida sabe…", level: 3 },
      { type: "paragraph", text: "Ampliação 1: Isso me lembra um conto de fadas da Marina Colassanti…" },
      { type: "paragraph", text: "Ampliação 2: Outro dia estava lendo Frantz Fanon [...] Será que essa não é uma máscara feminina?" },
      { type: "paragraph", text: "Ampliação 3: Quando eu era pequeno eu era calado meio excluído na escola, mas eu descobri que apesar de não ser bom com palavras, todo mundo gostava das brincadeiras que eu inventava, será que a fantasia também é a saída para esse caso?" },
      { type: "paragraph", text: "PS: Lembre que a ampliação, bem como quase tudo que vemos nesse exercício é primordialmente voltada para a compreensão, transformar isso em intervenção (contar para o paciente) envolve outras habilidades e ocorre apenas situacionalmente." },
      {
        type: "list",
        items: [
        "Modelo Cognitivo",
        ],
      },
      { type: "paragraph", text: "Descrição: Na TCC clássica a interpretação ocorre segundo o modelo cognitivo. O terapeuta busca extrair das falas do paciente: pensamentos automáticos, regras e crenças nucleares. Dito de forma (excessivamente) simples, pensamentos automáticos são associações diretas que se lastreiam nas crenças que o paciente tem; regras são proposições na estrutura de “se-então” e crenças nucleares são crenças sobre si, sobre o mundo e sobre o futuro que sejam rígidas, basilares e estáveis; apesar de frequentemente disfuncionais." },
      { type: "paragraph", text: "Seu objetivo em TCC clássica, via de regra, é: convencer/demonstrar racionalmente a disfuncionalidade das crenças nucleares desadaptativas; flexibilizar regras rígidas e extinguir regras falsas e demonstrar a irracionalidade dos pensamentos automáticos [nas ditas “terapias de terceira onda” o mote é muito mais aceitar e se desfundir do que confrontar racionalmente]." },
      { type: "heading", text: "Ex: Minha namorada saiu da festa sem me dar tchau", level: 3 },
      { type: "paragraph", text: "Pensamento Automático: \"Ela deve ter ficado brava com algo que fiz\" / “Ela sabe que eu me importo com isso, ela não me ama de verdade”" },
      { type: "paragraph", text: "Regra: \"Se alguém não se importa o suficiente para se despedir individualmente, significa que estou fazendo algo errado ou que ela me valorizava\"" },
      { type: "paragraph", text: "Crença Nuclear: \"Eu não sou especial [para ela]\"" },
      {
        type: "list",
        items: [
        "Fenomenologia como anti-hermenêutica",
        ],
      },
      { type: "paragraph", text: "Descrição: Em algumas abordagens da fenomenologia e do humanismo a noção de ‘interpretação’ é criticada a partir da noção de que o paciente é um sujeito epistemicamente privilegiado para falar de si, portanto, o analista deve ter o ponto de vista do sujeito como central em sua análise. A chave aqui é conferir se sua escuta está alinhada com a experiência do cliente." },
      { type: "heading", text: "Ex: Minha namorada saiu da festa sem me dar tchau", level: 3 },
      { type: "paragraph", text: "Opção 1: Parece que você ficou bastante solitário nessa festa depois que ela saiu" },
      { type: "paragraph", text: "Opção 2: Deve ter sido difícil para você, eu me sentiria inseguro, ainda mais sendo um relacionamento recente e ainda em construção. Foi assim que você se sentiu?" },
      { type: "paragraph", text: "Opção 3: Quando a minha mulher não se despede de mim, a primeira coisa que eu penso é que ela estava com pressa, qual é a primeira coisa que vem à sua mente?" },
      {
        type: "list",
        items: [
        "Leitmotiv ou Eterno retorno?",
        ],
      },
      { type: "paragraph", text: "Descrição: Essa é um nível de análise específico para fenômenos de repetição, ler como um “Eterno retorno” é ler como uma estagnação circular; já ler como “Leitmotiv” é buscar uma progressão na repetição (imagine um movimento espiralado). A estrutura circular advém de um foco nos elementos que se repetem, na busca de um núcleo ao redor do qual o fenômeno “gira”; já a estrutura ‘espiralada’ advém de um foco nos elementos que diferenciam uma experiência das anteriores. Ambos são válidos clinicamente, tudo depende do foco que o terapeuta pretende dar." },
      { type: "paragraph", text: "Ex: Você não vai acreditar, sabe aquele boy que te falei na sessão passada, já tô vendo que é mais um que tem o jeitinho de quem vai foder minha vida kkkk, a Amanda tava comigo no dia e já fazendo a cara de “te avisei” antes mesmo de acontecer" },
      { type: "paragraph", text: "Eterno retorno: Me descreva os últimos homens pelos quais você se interessou e depois quebrou a cara. [Digamos que o elemento comum foi ser seguro de si] Então você tem como projeto de vida buscar segurança em macho? [Digamos que foi ser engraçado] Você já tentou buscar graça na vida ao invés de procurar neles? [Digamos que nada em comum apareceu] Você já cogitou a possibilidade de que parte desse interesse não vem dos caras, mas das histórias que você tem para contar, o que tem - no papel de trouxa - que te captura tanto, é esse o seu projeto de vida?" },
      { type: "paragraph", text: "Leitmotiv: Você me contou que com o Victor você era uma garota inocente e inexperiente e por isso ele se aproveitou, já com o Thiago você estava tão arisca e paranoica que ele te largou. Já tentamos a donzela inocente e a amazona, qual é a personagem que você vai usar dessa vez para evitar ser você mesma?" },
      {
        type: "list",
        items: [
        "Forma e Conteúdo",
        ],
      },
      { type: "paragraph", text: "Descrição: Trata-se de se afastar o conteúdo e buscar semelhanças estruturais na forma de ser no mundo. É importante ressaltar que o conteúdo é, com frequência, importante ou delicado para o paciente, portanto você deve tentar ser sutil, ou no mínimo persuasivo, ao deixá-lo de lado." },
      { type: "heading", text: "Ex: Na minha escola a única coisa que se aprendia era a usar drogas", level: 3 },
      { type: "paragraph", text: "Intervenção: Eu fico até inseguro, pois sua infância foi muito diferente da minha e eu nem imagino o quanto deve ter sido muito difícil segurar o tranco até aqui, mas você percebe que mais uma vez você responsabilizou o Outro (a escola) pelas suas escolhas na vida?" },
      {
        type: "list",
        items: [
        "Retificação Emotiva / Corporal",
        ],
      },
      { type: "paragraph", text: "Descrição: é uma técnica experiencial tanto quanto interpretativa, a intenção é confrontar a fala com o corpo ou a emoção provável com a emoção performada." },
      { type: "heading", text: "Ex: Ontem foi um dia péssimo!", level: 3 },
      { type: "paragraph", text: "Retificação: E porque você tá me contando com um sorriso no rosto?" },
      { type: "paragraph", text: "Ex²: Criança é muito engraçado, né… (e conta a história de como o melhor amigo fazia bullying com ele por ser gordinho antes de se aproximarem)" },
      { type: "paragraph", text: "Retificação: Eu não achei graça. Aqui não é um lugar em que você precise transvestir seu sofrimento de humor / nostalgia para poder falar dele." },
      { type: "heading", text: "[...]", level: 3 },
      { type: "paragraph", text: "INTERPRETAÇÃO" },
      { type: "paragraph", text: "Dificuldade: 4" },
      { type: "paragraph", text: "Complexidade: 3" },
      { type: "paragraph", text: "Tendo em mente ao menos uma ou mais técnicas interpretativas [Caso não conheça técnicas interpretativas em psicologia; veja o exercício INTERPRETÁLLOS], convide um colega para um roleplay. Ele vai fazer as vezes do paciente contando um caso [2-15 min, na medida que for ficando fácil, aumente o tempo] e você tentará intervir seguindo as técnicas que você escolheu previamente. Evite agir intuitivamente, a forçação de barra para encaixar na técnica ajuda a compreender as potências e os limites de cada instrumento." },
      { type: "paragraph", text: "Grave o áudio do roleplay [caso seja feito em grupo, não precisa gravar, os espectadores cumprirão essa função] e depois reveja com seu(s) colega(s) em busca de:" },
      {
        type: "list",
        items: [
        "Momentos que você “perdeu” que tinham ganchos para intervenções interpretativas;",
        "Construam variações na forma de intervir, utilizando a mesma técnica [mais curto/longo; menos/mais confrontativo; linguagem teórica / linguagem do sujeito…]",
        "Busquem pelo menos um exemplo alternativo de técnica que caberia em cada caso;",
        "Tentem formular diretrizes para quando uma técnica é preferível à outra.",
        ],
      },
      { type: "paragraph", text: "INTERPRETAÇÃO" },
      { type: "paragraph", text: "Dificuldade: 2" },
      { type: "paragraph", text: "Complexidade: 1" },
      { type: "paragraph", text: "Um das maiores contribuições da filosofia contemporânea, em particular da entrada das teorias de gênero e raça no cânone filosófico é a possibilidade de pensar a epistemologia como posicionada, que a forma com que eu adquiro e valido o conhecimento é super-estruturada pelas contingências sociais e individuais." },
      { type: "paragraph", text: "Este exercício consiste em uma reflexão sobre como e o que eu sinto e como e porquê eu penso. Crie um diário, nos próximos roleplays longos ou atendimentos gaste 15-30 min escrevendo quais foram os elementos que te chamaram atenção, reflita sobre como eles estão ligados à sua história de vida, suas crenças e seu papel no jogo social [utilize tanto categorias políticas (gênero, classe, raça, religiosidade…) quanto categorias particulares (empirista, roqueiro…) à depender de qual foi o elemento que chamou atenção / foi difícil de lidar enquanto terapeuta]." },
      { type: "paragraph", text: "Descreva também como você se sentiu na hora e como você se sente ao ligar essas interpretações com as contingências da sua vida." },
      { type: "paragraph", text: "Lembre-se de que a autoconsciência durante a terapia é fundamental, seja para usar suas sensações e sentimentos como intervenção, ponte empática, ponto arquimédico ou como ferramenta interpretativa." },
      { type: "paragraph", text: "INTERPRETAÇÃO" },
      { type: "paragraph", text: "Dificuldade: 4" },
      { type: "paragraph", text: "Complexidade: 5" },
      { type: "paragraph", text: "OBS: Esse exercício funciona melhor quando o roleplay é verdadeiro" },
      { type: "paragraph", text: "O exercício consiste em um roleplay aberto e longo em que quando metade do tempo passa os papéis de terapeuta e paciente se invertem, mas o caso continua sendo o mesmo." },
      { type: "paragraph", text: "A intenção primária é trabalhar a tele moreniana e a capacidade interpretativa, sob a hipótese de que “se o terapeuta de verdade compreendeu o caso na primeira metade, ele tem condições de performar o papel do cliente com precisão na segunda metade”." },
      { type: "paragraph", text: "A secundária é permitir ao sujeito que foi atendido a oportunidade de “se colocar no divã”, as perguntas que nos faríamos, muitas vezes são mais precisas, potentes e agressivas do que qualquer terapeuta seria capaz de fazer." },
    ],
  },
  {
    slug: "preferencia-ou-especificidade-do-caso",
    number: 39,
    title: "Preferência ou Especificidade do Caso?",
    summary:
      "Em PBE um dos pilares é a preferência do paciente, isso significa especificar a técnica geral de forma alinhá-la com os objetivos do paciente (Ex simples: Informada das complicações para a imunologia do bebê a mãe…",
    category: "relacao",
    duracaoMin: [30, 45],
    formato: ["discussao"],
    pessoas: "grupo",
    tags: ["preferenc"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "Em PBE um dos pilares é a preferência do paciente, isso significa especificar a técnica geral de forma alinhá-la com os objetivos do paciente (Ex simples: Informada das complicações para a imunologia do bebê a mãe escolhe, por motivos estéticos, cesária /Ex exagerado: Por uma crença política - autoafirmação corporal - a paciente em quadro de obesidade mórbida se recusa a emagrecer ou a fazer cirurgia). Essa perspectiva é lastreada no empirismo colaborativo enquanto base da relação terapêutica, mas essa não é a base de muitas escolas da psicologia. Esse exercício é um convite a problematizar a noção de que o paciente é (co)responsável pela escolha do método de tratamento, colocando no lugar a noção de que a finalidade de uma análise é imanente ao processo (não é nem o médico, nem o paciente, nem a teoria que escolhem)." },
      { type: "heading", text: "Tarefa" },
      { type: "paragraph", text: "Em grupo, assistam os exemplos de slam poetry do exercício Diagnosticállos. Com base no poema escolhido tentem intuir qual é a preferência do paciente (expressa ou subentendida) e qual é a especificidade do caso. Busquem discutir quando preferência e especificidade se aproximam e quando se distanciam, qual(is) a(s) regra heurística(s)?" },
    ],
  },
  {
    slug: "baseado-no-exercicio-5-regulando-seu-termometro-interno-capi",
    number: 40,
    title: "Baseado no Exercício 5 - Regulando Seu Termômetro Interno (Capítulo 4 - Fatores do Terapeuta) - simplificado para 1 encontro",
    summary:
      "Objetivo: Melhorar a forma de lidar com sensações físicas e afetos negativos que aparecem por causa de temas ou momentos específicos (em outras palavras, uma forma de tentar “reconhecer” os complexos dando nome).",
    category: "autoconhecimento",
    duracaoMin: [40, 60],
    formato: ["roleplay", "reflexao", "preenchimento"],
    pessoas: "solo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Objetivo: Melhorar a forma de lidar com sensações físicas e afetos negativos que aparecem por causa de temas ou momentos específicos (em outras palavras, uma forma de tentar “reconhecer” os complexos dando nome)." },
      { type: "paragraph", text: "Justificativa: Aplicar na clínica individual o método “Zen adaptado”, caso ajude o terapeuta a lidar melhor com suas reações e afetos durante o atendimento." },
      { type: "paragraph", text: "1º Momento: Conversa sobre reações e afetos negativos" },
      {
        type: "list",
        items: [
        "Você costuma ter afetos negativos durante os atendimentos? Consegue citar um exemplo?",
        "Esses afetos trazem consigo sensações físicas? Consegue descrevê-las?",
        "Conte uma situação em que você teve de lidar (ou não soube lidar) com um afeto/sensação forte que surgiu durante algum atendimento/roleplay.",
        "Existiu alguma situação em que você teve uma reação inesperada na clínica por causa de um afeto que você não conseguiu lidar bem?",
        "Você já tinha refletido anteriormente sobre situações assim? O que fez para que não se repetisse?",
        ],
      },
      { type: "paragraph", text: "2º Momento: Roleplay entre terapeuta e paciente - De preferência o paciente deve trazer alguma questão que é sensível para o terapeuta, considerando que é um roleplay (10-15min)" },
      { type: "paragraph", text: "Instruções iniciais: Atenda como normalmente atende." },
      { type: "paragraph", text: "3º Momento: Será pedido ao terapeuta para anotar a situação em que ele não conseguiu lidar bem com seus afetos, ou que sentiu alguma coisa diferente." },
      { type: "paragraph", text: "4º Momento (mais importante): Pedir para que o terapeuta reflita e escreva o que sentiu, localizando a sensação corporalmente (literalmente em qual parte do corpo sentiu aquilo) e dando um nome para aquela sensação/reação/afeto em específico, de preferência fazer isso rapidamente, como uma associação de palavras." },
      { type: "paragraph", text: "5º Momento: Colocar o que escreveu no bolso, e passar 5 minutos sem fazer absolutamente nada, deixando as coisas passarem." },
      { type: "paragraph", text: "6º Momento/Objetivo: Discutir em grupo o que cada um refletiu e como isso têm a ver com sua condução clínica, história de vida e personalidade." },
    ],
  },
  {
    slug: "baseado-no-exercicio-6-solicitacao-de-feedback-capitulo-3-fa",
    number: 41,
    title: "Baseado no Exercício 6: Solicitação de Feedback (Capítulo 3 - Fatores do Cliente) - Simplificado para 1 encontro",
    summary:
      "Objetivo: A partir do feedback do paciente, refletir, e se necessário, alterar, diferentes posturas do terapeuta no atendimento.",
    category: "relacao",
    duracaoMin: [40, 60],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "solo",
    tags: ["feedback"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Objetivo: A partir do feedback do paciente, refletir, e se necessário, alterar, diferentes posturas do terapeuta no atendimento." },
      { type: "paragraph", text: "Justificativa: Aplicar na clínica individual o exercício de crítica consciente do feedback do paciente, buscando melhorar o processo terapêutico" },
      { type: "paragraph", text: "1º Momento: Conversa sobre feedback" },
      {
        type: "list",
        items: [
        "Você tem o costume de pedir feedback para os seus pacientes?",
        "Normalmente, o que você faz com o feedback que recebe?",
        "Consegue se lembrar de algum feedback que recebeu? Qual foi e o que você fez com ele?",
        ],
      },
      { type: "paragraph", text: "2º Momento: Roleplay entre terapeuta e paciente (10-15min)" },
      { type: "paragraph", text: "Instruções iniciais: Atender como normalmente atende." },
      { type: "paragraph", text: "3º Momento: O paciente irá dar o feedback para o terapeuta, que deverá anotar os pontos que foram ditos, e refletir sobre eles (em seu tempo). Só deve terminar a reflexão após uma opinião formada sobre o feedback, não necessariamente se deve concordar e mudar para o que o paciente deseja, mas ter uma crítica consciente do que foi trazido por ele." },
      { type: "paragraph", text: "4º Momento: Roleplay entre terapeuta e paciente (10-15min)" },
      { type: "paragraph", text: "Instruções: O terapeuta deve começar o atendimento discutindo com o paciente sobre sua reflexão acerca do feedback, e continuar o atendimento se atentando para a decisão que foi tomada, tanto individualmente quanto em conjunto." },
      { type: "paragraph", text: "5º Momento/Conclusão: Tanto o paciente quanto o terapeuta vão relatar como foi para eles o primeiro e segundo momento de terapia e a diferença entre eles. A ideia é que o feedback, a crítica e a discussão torne o processo terapêutico mais agradável para os dois, e melhore a autoconsciência clínica do terapeuta." },
    ],
  },
  {
    slug: "diagnosticos-alternativos",
    number: 42,
    title: "Diagnósticos Alternativos",
    summary:
      "1º Momento: Contextualização do exercício proposto. Exponha para o grupo, baseado no texto acima, a importância da tomada de decisão personalizada ao indivíduo.",
    category: "tecnica",
    duracaoMin: [40, 60],
    formato: ["roleplay", "reflexao"],
    pessoas: "solo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: Ao orientar o curso de um tratamento em psicoterapia, geralmente recorremos à literatura relevante de cada abordagem sobre diagnósticos em transtornos psicológicos (utilizando o DSM para a TCC; considerando o trio neurose, psicose e perversão, além da literatura específica de cada autor em psicanálise, etc.). Embora tais descrições facilitem a análise do fenômeno psíquico em questão, podem resultar em interpretações equivocadas, simplistas ou estereotipadas, que não conseguem captar as nuances de cada caso individual." },
      { type: "paragraph", text: "Por exemplo, ao diagnosticar um jovem com depressão, é comum direcionar o tratamento com base na literatura empírica sobre o transtorno em questão. No entanto, é plausível considerar que um jovem possa estar enfrentando desafios emocionais pela primeira vez, carecendo apenas de perspectiva e apoio emocional no momento. Nesse sentido, aderir estritamente ao diagnóstico de depressão pode representar um equívoco clínico." },
      { type: "paragraph", text: "Por outro lado, fundamentar-se em preconceitos individuais sem explorar a realidade do paciente também pode ser prejudicial. É razoável supor que alguns jovens ainda não tenham enfrentado muitas situações emocionalmente desafiadoras e estejam apenas lidando com seus primeiros obstáculos. No entanto, é crucial reconhecer que, por outro lado, algumas pessoas enfrentam eventos traumáticos ou emocionalmente carregados desde cedo, desmistificando a noção teórica de que jovens não vivenciaram muitas experiências de vida." },
      { type: "paragraph", text: "Este exercício é concebido, portanto, para auxiliar os terapeutas a aprimorarem suas habilidades na tomada de decisões personalizadas em relação aos clientes, ao invés de se basearem em generalizações (sejam elas oriundas da literatura empírica da área ou de preconceitos individuais)." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Contextualização do exercício proposto. Exponha para o grupo, baseado no texto acima, a importância da tomada de decisão personalizada ao indivíduo." },
      { type: "paragraph", text: "2º Momento: Proposição de um roleplay de atendimento, de cerca de 20 minutos, no qual o terapeuta deve buscar conhecer a demanda do paciente e questões que podem ser relevantes para o tratamento, como uma triagem." },
      { type: "paragraph", text: "A orientação para o terapeuta e para as outras pessoas do grupo, que vão ser observadores da sessão, é de se atentarem à características individuais do caso, se quiserem poderão registrá-las por escrito, e, ao final do atendimento, fornecerem um diagnóstico personalizado, individual, para a orientação do caso." },
      { type: "paragraph", text: "É importante demonstrar o que se quer dizer como “Diagnóstico Alternativo”, que vem da ideia de “Diagnóstico Psicológico” de Carl Jung. Por Diagnóstico Alternativo queremos transmitir a ideia de um diagnóstico não comum, não genérico, individual. Por exemplo, o diagnóstico de “Casa mal assombrada” do exercício de interpretação de poemas. Se os participantes do grupo não tiverem conhecimento da dinâmica de interpretação de poemas, ou não se lembrarem de como formular o diagnóstico, faça uma breve explicação do que ocorre nesse exercício. Leia o poema, dê o diagnóstico do caso e explique para os participantes o motivo para tal diagnóstico. Ressalte as passagens no texto que corroboram para tal diagnóstico e explique porque essa nomeação contribui mais para uma perspectiva assertiva para o caso do que uma nomeação puramente genérica." },
      { type: "paragraph", text: "3º Momento: Após o fim do atendimento, peça para as pessoas refletirem por 5 minutos sobre o nome do diagnóstico que dariam ao caso. Passado esse tempo, pergunte a cada um o diagnóstico que deu e o motivo por trás da escolha. Ao final da resposta de cada participante, dê um feedback sobre o título do diagnóstico escolhido baseado nos seguintes critérios:" },
      {
        type: "list",
        items: [
        "O diagnóstico abrange as características individuais do caso?",
        "É possível se orientar a partir do diagnóstico, ele deixa uma noção prognóstica possível?",
        "O diagnóstico é genérico demais? Diagnósticos muito abertos, pouco específicos, podem deixar escapar a individualidade do caso.",
        ],
      },
      { type: "paragraph", text: "4º Momento: Deixe, ao final dos feedbacks individuais, um tempo para que os participantes comentem sobre a experiência de participar da dinâmica. Pergunte sobre opiniões a respeito do exercício, se foi possível compreender os passos e o objetivo do mesmo, dicas para aprimorar, seu desempenho na condução, dentre outros." },
    ],
  },
  {
    slug: "preferencia-ou-resistencia",
    number: 43,
    title: "Preferência ou Resistência?",
    summary:
      "1º Momento: Contextualização do exercício proposto. Exponha para o grupo, baseado no texto acima, a importância das preferências pessoais do paciente. Deixe claro a dualidade presente nessas preferências, e que um bom…",
    category: "relacao",
    duracaoMin: [45, 75],
    formato: ["roleplay", "discussao"],
    pessoas: "solo",
    tags: ["preferenc"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: As decisões tomadas em um tratamento são influenciadas pelas crenças, valores e preferências tanto do terapeuta quanto do paciente. As convicções e inclinações dos pacientes desempenham um papel crucial em sua disposição e até na continuidade ou interrupção do tratamento. Por exemplo, um paciente cristão pode sentir-se mais motivado e conectado a uma terapia que integre elementos de sua religião, tal como com a utilização de citações bíblicas em intervenções, contribuindo significativamente para seu comprometimento e, por conseguinte, para a melhoria de seu quadro. Além disso, certas preferências podem ser determinantes para o sucesso do processo terapêutico. Um paciente que expressa uma firme exigência de evitar discussões sobre sua família durante as sessões pode decidir abandonar o tratamento se o terapeuta insistir neste tópico." },
      { type: "paragraph", text: "No entanto, é importante reconhecer que, em alguns casos, as preferências dos pacientes podem ser parte integrante de suas dificuldades emocionais. Por exemplo, alguém com dificuldades na tomada de decisões pode buscar uma abordagem terapêutica mais diretiva, em que o terapeuta assuma o papel de mestre. Portanto, uma preferência individual não deve ser incondicionalmente acatada pelo terapeuta." },
      { type: "paragraph", text: "No caso do indivíduo que não quer envolver assuntos sobre sua família no tratamento, é razoável pressupor que tal exigência seja parte do problema. É possível que a recusa seja uma resistência do indivíduo de tocar em tópicos dolorosos que constituem parte fundamental de seus problemas. Portanto, seria importante, para um tratamento efetivo, equilibrar as preferências do indivíduo com intervenções que perpassam, talvez indiretamente, esses assuntos sensíveis." },
      { type: "paragraph", text: "O exercício a seguir foi desenvolvido para auxiliar os terapeutas na identificação e utilização das preferências dos pacientes, a fim de informar-se e aprimorar a tomada de decisões clínicas." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Contextualização do exercício proposto. Exponha para o grupo, baseado no texto acima, a importância das preferências pessoais do paciente. Deixe claro a dualidade presente nessas preferências, e que um bom terapeuta deve reconhecer quando incorporá-las é um acerto e quando é um erro." },
      { type: "paragraph", text: "2º Momento: Proposição de um roleplay de atendimento, de cerca de 10/15 minutos, no qual o terapeuta deve buscar conhecer as preferências, expectativas e experiências em psicoterapia anteriores do paciente. Dê o exemplo de que, uma forma de fazer isso é voltar-se para relações terapêuticas passadas. Perguntas como:" },
      {
        type: "list",
        items: [
        "O que foi positivo no tratamento anterior?\"",
        "O que não foi?",
        "Como você gostaria que fossem nossas sessões?",
        "Há alguma coisa que você realmente não gostaria que acontecesse nas sessões? Por quê?",
        ],
      },
      { type: "paragraph", text: "Ressalte aos participantes que as preferências não precisam ser necessariamente acatadas e que o terapeuta pode questioná-las caso ache interessante." },
      { type: "paragraph", text: "3º Momento: Após o final do atendimento, proponha uma rodada de discussão com os participantes. A princípio, pergunte sobre a condução geral do terapeuta:" },
      {
        type: "list",
        items: [
        "Quais seus insights sobre o que seria positivo incorporar, e o que não seria?",
        ],
      },
      { type: "paragraph", text: "Pergunte depois sobre as opiniões sobre as pessoas que participaram como ouvintes." },
      { type: "paragraph", text: "Após a exposição de todos participantes, volte a questionar o terapeuta enquanto fornece suas percepções sobre o caso:" },
      {
        type: "list",
        items: [
        "Quais preferências podem ser positivamente incorporadas no atendimento? Como fazer isso?",
        "Por que ele questionou algumas preferências e qual suas teorias por trás delas ? (Essas teorias foram ou não exploradas na sessão.)",
        "Algumas preferências pareciam incontornáveis?",
        "Alguma preferência parecia ser, na verdade, uma resistência? Como ele lidaria com ela? Seria positivo talvez passar o caso para outro terapeuta?",
        ],
      },
    ],
  },
  {
    slug: "tempo-do-tratamento",
    number: 44,
    title: "Tempo do tratamento",
    summary:
      "Contextualização: Qual é a duração típica do tratamento em psicoterapia? A resposta varia devido a uma série de fatores. Em primeiro lugar, o tempo de tratamento varia de acordo com o diagnóstico do paciente. Por…",
    category: "tecnica",
    duracaoMin: [40, 60],
    formato: ["roleplay"],
    pessoas: "grupo",
    tags: ["tempo"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: Qual é a duração típica do tratamento em psicoterapia? A resposta varia devido a uma série de fatores. Em primeiro lugar, o tempo de tratamento varia de acordo com o diagnóstico do paciente. Por exemplo, na TCC, os transtornos de personalidade, como o transtorno borderline, geralmente demandam tratamentos mais longos devido à complexidade dos padrões de pensamento e comportamento envolvidos. Por outro lado, tratamentos para certas fobias específicas, como a fobia de animais ou de altura, podem ser mais curtos, especialmente quando empregam técnicas como a exposição gradual." },
      { type: "paragraph", text: "Um aspecto adicional a considerar é a abordagem adotada pelo terapeuta. Em geral, as sessões de orientação psicanalítica tendem a ser mais prolongadas em comparação com as da TCC. Além disso, as TCCs frequentemente têm uma duração média definida, ao passo que a psicanálise não segue um parâmetro temporal a priori." },
      { type: "paragraph", text: "Assim sendo, dada a gama variável de tempo do tratamento em psicoterapia, alguns pacientes podem chegar a terapia com expectativas irreais de duração. Quando questionado sobre a duração esperada do tratamento, um cliente pode responder que espera recuperar-se totalmente em duas sessões. Outra possibilidade, é a de um paciente que, por ter conhecidos que fazem terapia por anos, tem a expectativa de um processo terapêutico de 10 anos, já que considera ter uma vida mais problemática que esses conhecidos, e que portanto, vai precisar de mais tempo para melhorar. Se sua abordagem define um parâmetro de 20 sessões dado o diagnóstico deste paciente, como você lidaria com essas expectativas?" },
      { type: "paragraph", text: "Dada a ampla variação de duração dos tratamentos em psicoterapia, alguns pacientes podem chegar a terapia com expectativas irreais de duração para o processo terapêutico. Por exemplo, um cliente pode esperar uma recuperação completa em apenas 2 sessões. Outra possibilidade, é a de um paciente que, por ter conhecidos que fazem terapia por anos, tem a expectativa de um processo terapêutico de 10 anos, já que considera ter uma vida mais problemática que esses conhecidos, e que portanto, vai precisar de mais tempo para melhorar. Se, com base no diagnóstico, sua abordagem estabelece um parâmetro de 20 sessões para esse paciente, como você lidaria com essas expectativas?" },
      { type: "paragraph", text: "Portanto, este exercício tem como objetivo preparar o terapeuta para lidar com situações em que as expectativas em relação à duração do tratamento não correspondem à realidade." },
      { type: "heading", text: "Descrição" },
      { type: "heading", text: "1º Momento", level: 3 },
      { type: "heading", text: "2º Momento", level: 3 },
      { type: "heading", text: "3º Momento", level: 3 },
      { type: "heading", text: "4º Momento", level: 3 },
      { type: "paragraph", text: "Nesse exercício haverá uma simulação de um atendimento, de cerca de 20 minutos, no qual o terapeuta deve conversar sobre expectativas pouco prováveis em relação a duração dos atendimentos (seja para mais, como pessoas que não aceitam receber alta; seja para menos, como pessoas que querem melhorar com duas sessões.) A pessoa responsável por interpretar o paciente pode ser compreensiva, facilitando a sessão, e proporcionando um espaço para o planejamento das sessões que virão; ou pode se manter mais irredutível quanto a suas expectativas, de forma a exigir maior criatividade do terapeuta para lidar com a situação." },
      { type: "paragraph", text: "Em uma situação na qual o paciente quer um tratamento muito rápido, o terapeuta poderia reconhecer a expectativa inicial do cliente (por exemplo, “Isso é ótimo! Parece que você está otimista em relação ao tratamento e acredita que ele pode ajudá-lo rapidamente. Seu otimismo será útil enquanto trabalhamos juntos”), fornecer informações (por exemplo, “Embora o tratamento possa funcionar tão rapidamente para você, normalmente não funciona tão rápido para a maioria das pessoas. Na verdade, a pesquisa sugere que são necessárias cerca de 13 a 18 sessões para que 50% dos clientes se recuperem. Alguns se recuperam mais cedo do que isso, mas outros demoram mais”). Pode ser produtivo, desenvolver um plano conjunto (por exemplo, “Que tal planejarmos fazer as duas primeiras sessões e então, no final da segunda sessão, fazermos um check-in para ver onde você está em. Se tudo estiver melhor nesse ponto, isso é ótimo, e terminaremos. Mas, se você precisar de mais do que isso, podemos planejar mais algumas sessões juntos até que você chegue onde deseja)." },
    ],
  },
  {
    slug: "ontologia-ou-funcionalidade",
    number: 45,
    title: "Ontologia ou Funcionalidade?",
    summary:
      "Frequentemente, na clínica, o terapeuta se depara com uma grande variedade de pensamentos, opiniões e interpretações do paciente sobre si, sobre as pessoas, sobre o mundo e sobre a vida de uma maneira geral. Na…",
    category: "tecnica",
    duracaoMin: [40, 60],
    formato: ["roleplay", "reflexao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "Frequentemente, na clínica, o terapeuta se depara com uma grande variedade de pensamentos, opiniões e interpretações do paciente sobre si, sobre as pessoas, sobre o mundo e sobre a vida de uma maneira geral. Na perspectiva da TCC clássica, por exemplo, não são os fatos que importam, mas sim, a interpretação que temos destes. Essa perspectiva mentalista e que considera a cognição como um elemento mediador fundamental entre ambiente e sujeito se contrapõe à visão proveniente do behaviorismo radical de que não há a necessidade do conceito de cognição para descrever esse processo, tendo em vista que, fundamentalmente, “tudo o que um homem morto não faz”, incluindo pensar, é considerado comportamento para os que seguem essa corrente." },
      { type: "paragraph", text: "Nesse sentido, para eles, a própria interpretação que temos dos fatos tem de ser vista como um comportamento que é controlado pelas suas consequências e pelos seus antecedentes. Essa divergência implica em formas diferentes de encarar as opiniões, os pensamentos e as interpretações do paciente mencionadas anteriormente." },
      { type: "paragraph", text: "Desse modo, a TCC clássica, por entender que o modo pelo qual filtramos e processamos os dados da realidade é o que de fato importa para compreender o funcionamento do paciente, tem como foco intervenções que questionam as “redes ontológicas” dos pacientes, ou seja, os sistemas de crenças deles sobre o mundo, sobre si mesmos e sobre a realidade. Logo, o objetivo é encontrar possíveis distorções que coloquem em xeque as concepções do sujeito e favoreçam uma possível reestruturação cognitiva que produza crenças mais realistas e plausíveis. Já os behavioristas radicais, algumas TCC’s de terceira onda (contextuais) e, em alguma medida, a Gestalt Terapia, por entenderem um comportamento como uma ação situada em contexto (antecedentes, consequências, fundo, etc), não buscam avaliar e modificar as redes ontológicas dos pacientes, mas sim compreender a funcionalidade das mesmas e, consequentemente, as motivações dos comportamentos e ajustamentos criativos que cada um apresenta." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1° momento: Pare um momento para refletir sobre os seus atendimentos. Você realiza mais intervenções no sentido de questionar a plausibilidade das crenças dos pacientes, ou de saber sobre a função que elas desempenham na vida deles?" },
      { type: "paragraph", text: "2° momento: A partir da exibição de um caso clínico, construa uma intervenção que cumpra com o propósito do estilo respondido no primeiro momento e observe sua escolha de termos e frases." },
      { type: "paragraph", text: "3º momento: Se você respondeu que tenta compreender a função da crença, quais evidências do caso favorecem a ideia de que essa é a atitude correta? Se você respondeu que tenta questionar a plausibilidade da crença, o que você acredita que ganharia com isso?" },
      { type: "paragraph", text: "4° momento: Reflita sobre o que a sua resposta do 3° momento diz sobre você como terapeuta e pense em quais momentos no seu atendimento a intervenção oposta poderia ser feita." },
      { type: "paragraph", text: "5° momento: Faça um roleplay de 15 minutos de duração adotando a postura oposta à que você respondeu no primeiro momento e recolha feedback do paciente ao final do atendimento. Isso poderá aumentar sua capacidade de ter flexibilidade nas sessões, além de reforçar a deliberação sobre os objetivos das intervenções." },
    ],
  },
  {
    slug: "autorrevelacao-genuinidade",
    number: 46,
    title: "Autorrevelação & Genuinidade",
    summary:
      "Em algumas abordagens, tais como a psicologia humanista, é valorizada a atuação do terapeuta a partir da genuinidade, e a autorrevelação como uma parte possível do processo terapêutico, desde que o terapeuta diga de…",
    category: "autoconhecimento",
    duracaoMin: [40, 60],
    formato: ["roleplay", "reflexao", "preenchimento"],
    pessoas: "supervisor",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "Em algumas abordagens, tais como a psicologia humanista, é valorizada a atuação do terapeuta a partir da genuinidade, e a autorrevelação como uma parte possível do processo terapêutico, desde que o terapeuta diga de algo que o aconteceu e realmente é genuíno na sua vida, conforme discutido na obra “Tornar-se pessoa” de Carl Rogers." },
      { type: "paragraph", text: "Vale ressaltar que, mesmo para abordagens que trabalham com essas ferramentas, elas devem ser utilizadas com cautela. Por exemplo, se a pergunta realizada pelo paciente dizer de uma resposta que ele deseja obter do terapeuta para direcionar a sua vida, deve-se tomar cuidado, pois, para a abordagem citada, o paciente é que deve buscar sua própria direção no processo, tendo portanto cuidado para não direcionar por ele. Do mesmo modo, é interessante deixar claro que a situação vivida na vida do terapeuta não necessariamente servirá na vida do paciente, e nem terá as mesmas consequências na vida dele." },
      { type: "paragraph", text: "Em síntese, o objetivo deste exercício é trabalhar a ferramenta terapêutica de autorrevelação, e a relação do terapeuta com a sua capacidade de ser genuíno, explorando suas dificuldades nesse processo e lidando com temas que ainda não é capaz de revelar ou tem dificuldade de falar por conta de fortes afetos, que podem influenciar na atuação clínica." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Comece a dar mais atenção nos seus atendimentos/roleplays em momentos que pedem por autorrevelação ou que dependem da genuinidade do terapeuta, e perceba principalmente como você se comporta nestes momentos. Se surgirem quaisquer temas que sejam difíceis para você lidar, e que, ou dificultaram ou impediram de realizar autorrevelação ou de ser genuíno com seu paciente, anote-os após a sessão. Da mesma forma, se tiver dificuldade de ser genuíno, anote as situações em que isso ocorreu, ou os motivos pelos quais escolheu não ser genuíno. Por fim, se alguma situação de trazer a autorrevelação no momento errado acontecer, também anote." },
      { type: "paragraph", text: "2º Momento: Reflita sobre os temas/situações anotados, e perceba se eles também estão afetando em alguma área de sua vida ou na sua clínica como terapeuta. Posteriormente, leve os temas anotados e suas reflexões para o seu monitor/supervisor, e busque trabalhá-los internamente, até estar confortável com falar sobre eles." },
      { type: "paragraph", text: "3º Momento: Com o passar do tempo, ao se repetirem os temas nas sessões de atendimento e roleplay, note se você conseguiu mudar a forma como realiza a autorrevelação ou atua com genuinidade na clínica, e continue anotando os temas que te incomodam. A ideia é que com o tempo seja cada vez menor a lista de temas e situações que te dificultem de atuar com essas ferramentas." },
      { type: "paragraph", text: "4º Momento: Após ter lidado com pelo menos 5 situações/temas (tanto levando para o monitor quanto na prática), observe se a autorrevelação e a prática da genuinidade ao invés de uma “persona para psicólogo” está sendo efetivo na sua clínica. Para saber isso, está dentre as possibilidades notar suas próprias reações corporais e o que você sente ao fazer isso na clínica; obter o feedback do seu paciente; e discutir conjuntamente com seu monitor/supervisor os impactos do exercício em sua clínica individual." },
    ],
  },
  {
    slug: "como-voce-utiliza-a-linguagem",
    number: 47,
    title: "Como você utiliza a linguagem?",
    summary:
      "Para conseguir ser bem entendido na clínica, é essencial dominar o uso da linguagem. A ideia do exercício consiste em trabalhar a linguagem como um todo, entendendo como o terapeuta lida com a linguagem e o que pode…",
    category: "tecnica",
    duracaoMin: [40, 60],
    formato: ["roleplay", "discussao", "preenchimento"],
    pessoas: "solo",
    tags: ["linguagem"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "Para conseguir ser bem entendido na clínica, é essencial dominar o uso da linguagem. A ideia do exercício consiste em trabalhar a linguagem como um todo, entendendo como o terapeuta lida com a linguagem e o que pode fazer para melhorar a forma como a utiliza em sua clínica individual. A proposta abrange desde o tipo de linguagem como a melhor comunicação com o paciente (por exemplo, utilizar uma linguagem informal, formal…) até a prática de figuras de linguagem, tais como a metáfora." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Perguntas sobre o tema:" },
      {
        type: "list",
        items: [
        "Você costuma se preocupar com o uso da linguagem na clínica?",
        "Considera importante prestar atenção nisso?",
        "No geral, sua forma de falar durante a terapia é mais formal ou informal? Existe um motivo pelo qual você utiliza esse tipo de linguagem? Qual?",
        "Você costuma utilizar figuras de linguagem? Metáfora, hipérbole, metonimia, etc. Se sim, quais, como e por que você as utiliza?",
        "A ironia e sarcasmo são comuns na sua clínica? Você acha que consegue expressar bem quando se propõe a utilizar essas ferramentas?",
        ],
      },
      { type: "paragraph", text: "2º Momento: Anote ou discuta em grupo sobre possibilidades de explorar a linguagem (figuras de linguagem, ironia, etc), adaptá-la ou não ao seu paciente, e formar um modo específico de conversar na clínica." },
      { type: "paragraph", text: "3º Momento: Faça uma sessão de roleplay (10-15 min) de acordo com suas preferências conversadas no segundo momento." },
      { type: "paragraph", text: "Adapte a sua linguagem ao paciente (por exemplo, utilizar formalidade de acordo com a forma que ele fala, e explorar os recursos de linguagem que ele utiliza) ou criando uma forma para você utilizar na clínica (por exemplo, se tiver preferência por ironia ou por metáfora utilize-os como parte de seu atendimento e seja formal ou informal de acordo com a discussão e suas preferências)." },
      { type: "paragraph", text: "4º Momento: Após o roleplay, recolha o feedback tanto do paciente quanto dos demais presentes, buscando notar se realmente a maneira de utilizar a linguagem na clínica foi efetiva no atendimento e agradável para o terapeuta. Além disso, comente se notou diferença em relação aos seus atendimentos/roleplay antigos em comparação com a nova prática com foco na linguagem." },
      { type: "paragraph", text: "5º Momento (opcional): Caso as pessoas ou o próprio terapeuta note uma dificuldade em desenvolver a linguagem em algum aspecto trabalhado, é necessária uma discussão e uma nova sessão de roleplay, a fim de buscar desenvolver o domínio da linguagem na clínica." },
    ],
  },
  {
    slug: "analise-de-sonhos",
    number: 48,
    title: "Análise de sonhos",
    summary:
      "A interpretação psicológica dos sonhos é utilizada em diversas abordagens da psicologia, tais como a Psicologia Analítica, a Psicanálise e a Gestalt-terapia. Em vista disso, o exercício busca trabalhar a prática da…",
    category: "tecnica",
    duracaoMin: [45, 75],
    formato: ["roleplay", "supervisao"],
    pessoas: "supervisor",
    tags: ["sonhos"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "A interpretação psicológica dos sonhos é utilizada em diversas abordagens da psicologia, tais como a Psicologia Analítica, a Psicanálise e a Gestalt-terapia. Em vista disso, o exercício busca trabalhar a prática da análise de sonhos na clínica em psicologia como uma ferramenta adicional durante os seus atendimentos, observando também os impactos terapêuticos desta técnica na clínica." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Busque algum monitor, supervisor ou colega que domine a prática da análise dos sonhos na abordagem que você deseja trabalhar, e peça para ele te ensinar o método ou passar uma bibliografia básica sobre o assunto. Outras possibilidades são buscar bibliografia na internet e ler os livros da abordagem para aprender a técnica, ou ainda buscar vídeos no youtube e estudar a partir deles, de preferência se forem indicações de pessoas de confiança." },
      { type: "paragraph", text: "2º Momento: Faça uma sessão de roleplay (+- 20 mins) trabalhando com a técnica de interpretação de sonhos na abordagem psicológica escolhida. A sessão deve ser focada no sonho que a pessoa trouxer, e não necessariamente em uma condução clínica como se fosse o primeiro atendimento. De preferência o paciente da dinâmica deve trazer um sonho para que facilite o desenrolar do roleplay." },
      { type: "paragraph", text: "3º Momento: Perguntas sobre o roleplay (para o terapeuta) - caso seja um atendimento individual, é interessante anotar as respostas para as perguntas:" },
      {
        type: "list",
        items: [
        "Você acredita que soube utilizar bem a técnica na abordagem escolhida?",
        "Como foi a experiência? Utilizaria essa ferramenta na sua clínica?",
        "Considera que a análise do sonho foi satisfatória?",
        "O que acha que poderia fazer para melhorar ainda mais a técnica?",
        ],
      },
      { type: "paragraph", text: "Perguntas sobre o roleplay (para o paciente)" },
      {
        type: "list",
        items: [
        "A análise do sonho foi interessante para você?",
        "Notou algum problema ou desconforto durante o processo?",
        ],
      },
      { type: "paragraph", text: "Perguntas gerais e direcionamento de feedback de colegas" },
      {
        type: "list",
        items: [
        "O que acharam da utilização da técnica?",
        "(Caso tenha alguém da abordagem) Como foi a condução do terapeuta no método específico da abordagem para interpretação dos sonhos?",
        "Quais as críticas ao atendimento? O que acham que poderia ser mudado tanto no método quanto na condução do terapeuta para melhorar essa técnica?",
        ],
      },
    ],
  },
  {
    slug: "tempo-de-sessao",
    number: 49,
    title: "Tempo de sessão",
    summary:
      "Na prática clínica, o gerenciamento eficaz do tempo durante as sessões de terapia é essencial para promover o progresso do cliente e manter a integridade do processo terapêutico. Muitas vezes, os psicólogos enfrentam…",
    category: "tecnica",
    duracaoMin: [60, 90],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["tempo"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "Na prática clínica, o gerenciamento eficaz do tempo durante as sessões de terapia é essencial para promover o progresso do cliente e manter a integridade do processo terapêutico. Muitas vezes, os psicólogos enfrentam desafios significativos relacionados ao estabelecimento de limites, à gestão da resistência do cliente e à manutenção de um equilíbrio entre explorar profundamente os problemas apresentados e utilizar o tempo disponível de forma eficiente. Estas questões podem impactar diretamente a qualidade do serviço oferecido e a eficácia do tratamento. De todo modo, existem formas de tanto fazer atendimentos longos e efetivos, quanto curtos e efetivos, tais como observamos pelo contraste por uma abordagem mais humanista e uma abordagem mais lacaniana. Por outro lado, também é possível que sejam atendimentos curtos e ineficazes, e longos e cansativos. O exercício a seguir visa atentar-se sobre esses pontos e trabalhar possibilidades de melhorar a clínica no quesito do tempo de sessão." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Perguntas sobre o tema:" },
      {
        type: "list",
        items: [
        "Quais são os principais desafios que você enfrenta ao lidar com o tempo durante as sessões?",
        "Como você lida com a resistência do cliente que envolve tempo quando ela surge durante uma sessão (por exemplo, falar muito pouco ou falar demais e não te dar tempo)?",
        "Você estabelece limites claros dentro do tempo da sessão? (explorar o motivo de estabelecer ou não e como estabelece quando o faz)",
        "Quais são os sinais de alerta que indicam que o tempo está sendo mal utilizado durante uma sessão? E quando sabemos que o tempo está de acordo?",
        "Quais são as consequências de não gerenciar adequadamente o tempo durante as sessões de terapia?",
        "Como você se sente em relação ao seu próprio gerenciamento do tempo durante as sessões? Existem pontos específicos que você percebeu e gostaria de melhorar?",
        ],
      },
      { type: "heading", text: "2º Momento (situacional)", level: 3 },
      { type: "paragraph", text: "Caso a última pergunta traga respostas interessantes, peça para que as pessoas anotem em algum lugar (privado) os pontos que elas gostariam de melhorar." },
      { type: "heading", text: "3º Momento", level: 3 },
      { type: "heading", text: "Debate Dirigido: Tempo de Sessão Fixo vs. Variável", level: 3 },
      { type: "heading", text: "Apresentação dos Lados", level: 3 },
      {
        type: "list",
        items: [
        "Os participantes são divididos em dois grupos (não necessariamente a pessoa precisa ter a mesma opinião do grupo, a ideia é que o grupo tenha o mesmo número de pessoas e eles se “passem” pela opinião do grupo para argumentar, a ideia é gerar argumentos): o Grupo A, que defenderá a ideia de um tempo de terapia fixo, e o Grupo B, que argumentará a favor da variabilidade do tempo de acordo com a sessão.",
        "Cada grupo recebe um tempo de 5 minutos para preparar seus argumentos e identificar pontos-chave para defender sua posição. (abrir 2 salas no meet)",
        ],
      },
      { type: "heading", text: "Rodadas de Argumentação", level: 3 },
      {
        type: "list",
        items: [
        "O facilitador conduz o debate, alternando entre os grupos para apresentarem seus argumentos.",
        "Cada grupo tem a oportunidade de apresentar seus pontos de vista e responder às críticas e questionamentos do outro grupo.",
        ],
      },
      { type: "heading", text: "Discussão e Reflexão", level: 3 },
      {
        type: "list",
        items: [
        "Após as rodadas de argumentação, abre-se espaço para discussão entre os participantes.",
        "O facilitador estimula a reflexão sobre os diferentes pontos de vista apresentados, incentivando os participantes a considerar as vantagens e desvantagens de cada abordagem.",
        ],
      },
      { type: "heading", text: "Conclusões e Consolidação", level: 3 },
      {
        type: "list",
        items: [
        "O debate é encerrado com uma breve recapitulação das principais ideias discutidas.",
        "O facilitador destaca os pontos-chave levantados durante o debate e incentiva os participantes a refletirem sobre como podem aplicar esses insights em sua prática clínica.",
        ],
      },
      { type: "paragraph", text: "4º Momento: Ao final do debate, o facilitador colhe feedback dos participantes sobre a dinâmica do exercício, o conteúdo discutido e as principais conclusões alcançadas." },
      { type: "paragraph", text: "5º Momento: Peça para as pessoas pensarem em como trabalhar os pontos que elas escreveram no 2º momento a partir do exercício que foi realizado, para que possam utilizar nos próximos roleplay e ver se notam alguma diferença em relação a esse ponto após a reflexão da dinâmica (como se fosse um para-casa da dinâmica)" },
    ],
  },
  {
    slug: "linguagem-metaforica",
    number: 50,
    title: "Linguagem Metafórica",
    summary:
      "Contextualização",
    category: "tecnica",
    duracaoMin: [40, 60],
    formato: ["roleplay", "discussao", "preenchimento"],
    pessoas: "grupo",
    tags: ["linguagem"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização" },
      { type: "paragraph", text: "É muito comum que tenhamos dificuldade de expressar nossos sentimentos e estados internos para outras pessoas. Existe uma frase muito famosa entre as pessoas da área de Letras de que “toda tradução é uma traição”, ou seja, qualquer obra traduzida é, em última instância, incapaz de transmitir com precisão absoluta a mensagem que o autor planejava transmitir, afinal de contas, a única via de acesso que teríamos para tal são palavras, linguagem. Nesse sentido, o acesso é sempre mediado. É mediado por algo que, apesar de almejar organizar a experiência da realidade a fim de que ela seja compartilhável, automaticamente a recorta em pedaços, a divide e, portanto, a distorce em alguma medida." },
      { type: "paragraph", text: "Quando tentamos descrever o que estamos sentindo para outra pessoa, frequentemente tentamos articular em um discurso elaborado e racional aquilo que gostaríamos que ela captasse. No entanto, inúmeras vezes diante das interpretações e reações dos nossos ouvintes temos a sensação de que não fomos compreendidos ou de que utilizamos os termos incorretos, o que nos faz recorrer a recursos e representações imagéticas, dentre elas a metáfora." },
      { type: "paragraph", text: "Dizer por exemplo que você está com um “nó na garganta” pode ser muito mais eficaz do que dizer que vc está triste ou emocionado com alguma coisa a partir do momento que você parte de uma imagem que contém uma sensação corporal representada por um nó, algo que seus ouvintes têm pleno acesso nas suas mais diversificadas experiências de vida. Em psicoterapia, isso pode ser muito útil para o paciente no sentido de que tentar fazer com que o terapeuta entenda melhor o que de fato está sentindo, mas também é útil para o próprio terapeuta, tendo em vista que ele pode lançar mão de metáforas para favorecer a psicoeducação, evitar resistências manifestadas pelo excesso de discurso racional ou até mesmo incentivar o paciente a aprofundar suas questões" },
      { type: "paragraph", text: "Descrição" },
      { type: "paragraph", text: "1 momento: Em grupo, simule um momento de um atendimento em que o paciente tenta transmitir um sentimento ou um problema em sua vida de forma metafórica." },
      { type: "paragraph", text: "2 momento: Nesse momento, escreva sua intervenção e espere os demais completarem as deles antes de compartilhar a sua." },
      { type: "paragraph", text: "3 momento: Quando todos completarem, compartilhe sua intervenção e comente as dos outros: suas impressões, o que achou, se mudaria algo, quais seriam os possíveis objetivos das intervenções, etc." },
      { type: "paragraph", text: "4 momento: Por fim, em conjunto, tente formular princípios gerais para a utilização de linguagem metafórica em psicoterapia." },
    ],
  },
  {
    slug: "linguagem-metaforica-variacao-1-eu-sinto-cocegas-por-ele",
    number: 51,
    title: "Linguagem Metafórica - Variação 1 - “Eu sinto cócegas por ele",
    summary:
      "Descrição: Após introdução sobre a utilização e instrumentalização da linguagem metafórica no contexto clínico, convide os participantes a imaginar a seguinte situação: durante uma sessão foi perguntado a paciente o…",
    category: "tecnica",
    duracaoMin: [45, 75],
    formato: ["discussao"],
    pessoas: "solo",
    tags: ["linguagem"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Descrição: Após introdução sobre a utilização e instrumentalização da linguagem metafórica no contexto clínico, convide os participantes a imaginar a seguinte situação: durante uma sessão foi perguntado a paciente o que ela sente pelo seu parceiro/marido/namorado. Ao que ela responde “eu sinto cócegas por ele”." },
      {
        type: "list",
        items: [
        "Dê um tempo para que as pessoas digitem no chat perguntas e intervenções que poderiam ser feitas a partir dessa resposta.",
        "Faça uma rodada de discussão em torno das perguntas e intervenções, incentivando participações, ajudando os participantes do grupo a tomarem consciência do caminho e que função tinha sua pergunta, expandindo para outros possíveis caminho. Começando a delinear com o grupo, princípios gerais e cuidados em torno da utilização da linguagem metafórica em psicoterapia.",
        "Leia o texto “Cócegas” de Ana Suy, texto disponível no livro “Não pise no meu vazio”, editora planeta, 2023, a intenção aqui é ilustrar o quão rico pode ser o uso bem trabalhado de uma metáfora dentro do contexto clínico, convide os participantes a compartilharem suas impressões.",
        ],
      },
      { type: "paragraph", text: "Anexo:" },
      { type: "paragraph", text: "Texto: Suy, Ana (2023) Cócegas. Não pise no meu vazio [livro eletrônico]. São Paulo: Planeta. ePUB" },
      { type: "paragraph", text: "“Sinto apenas cócegas por você. E aí digo que é amor. Cócegas são pequenas angústias. Ou grandes angústias, dependendo da intensidade. Cócegas são a denúncia de que não controlo meu corpo, de que não controlo os meus movimentos, de que não controlo minhas sensações." },
      { type: "paragraph", text: "Amor é apenas cócegas na alma. Por mais que eu saiba que você vai me tocar com uma intensidade que oscila entre leve e agressiva, acima do meu ossinho da bacia, morro de agoniazinhas. Grito como se não acreditasse que sou dona de mim. Faço escândalo como se eu não fosse preocupada com a imagem que passo para as pessoas ao meu redor. Te arranho como se eu não me importasse com o susto que te causo." },
      { type: "paragraph", text: "E acho que a minha parte que mais se aproxima de mim é assim mesmo. Machuca, desdenha, escandaliza. A minha parte que mais se aproxima de mim me assusta." },
      { type: "paragraph", text: "Aí eu me visto em várias camadas, tal como uma cebola. Me visto de palavras, sapatos, roupas bonitinhas e ideias politicamente agradáveis sobre minha pessoa. Então acho que sou uma pessoa relativamente normal, relativamente equilibrada, relativamente educada, relativamente bem-adaptada, relativa-mente. Ah, como sou mentirosa!" },
      { type: "paragraph", text: "No fundo sei que sou um poço de loucura, lutando avidamente para me disfarçar sem morrer. Porque se deixo de ser louca, deixo de me ser, e então morro. E se enlouqueço sem amarras, morro ainda assim." },
      { type: "paragraph", text: "A loucura mata, mas a normalidade mata ainda mais. Prefiro morrer de morte vivida a morrer de morte morrida. Prefiro morrer de cócegas a morrer de uma angústia sem nome." },
      { type: "paragraph", text: "Ao menos nas cócegas, há alguém me tocando. (A angústia é pura solidão)." },
      { type: "paragraph", text: "Vocês sabem, é impossível que façamos cócegas em nós mesmos. As cócegas são a encarnação da falência dos livros de auto-ajuda. Tem coisas que simplesmente não se pode fazer sozinho. É impossível ser feliz sozinho. E se você for uma mulher, talvez seja ainda mais impossível." },
      { type: "paragraph", text: "Eu te cócegas, meu amor”" },
    ],
  },
  {
    slug: "libera-llos-inspirado-no-ex-5-encerrando-com-firmeza-capitul",
    number: 52,
    title: "LiberÁ-LLOS (Inspirado no ex 5: Encerrando com Firmeza - Capítulo 7 - Fatores da Estrutura)",
    summary:
      "Quando é o momento adequado para dar alta a um paciente? Algumas abordagens definem o número de sessões terapêuticas antecipadamente, baseadas em generalizações estatísticas, como na Terapia Cognitivo-Comportamental…",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["discussao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "Quando é o momento adequado para dar alta a um paciente? Algumas abordagens definem o número de sessões terapêuticas antecipadamente, baseadas em generalizações estatísticas, como na Terapia Cognitivo-Comportamental (TCC). Em contrapartida, há casos em que os atendimentos se estendem por anos, sem uma previsão clara de término, seguindo a prática de alguns analistas. Evitando extremos, é crucial ser capaz de estimar o tempo necessário para o tratamento em determinadas situações, levando em consideração a singularidade do indivíduo, ou pelo menos tendo em mente os objetivos terapêuticos para a melhora do paciente. Sem essa definição, não é possível assegurar a duração adequada do tratamento." },
      { type: "paragraph", text: "A estrutura de encerramento da terapia varia de acordo com a abordagem seguida pelo terapeuta, porém estudos demonstram que conclusões bem-sucedidas do tratamento compartilham elementos e ritmo semelhantes, independentemente da abordagem utilizada. São, segundo o Field Guide, elementos estruturais centrais para encerramentos eficazes: (a) preparar explicitamente para o término, (b) orientar o cliente para o crescimento futuro, (c) consolidar ganhos alcançados, (d) expressar orgulho no progresso do cliente e (e) ter mutualidade no relacionamento. Este exercício explora como alguns desses elementos operam na prática terapêutica." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Contextualização do exercício proposto. Exponha para o grupo, baseado no texto acima, a importância de analisar a atribuir algum prazo, talvez prorrogável, para o tratamento do paciente. Destaque também que é necessário saber quando dar alta para o caso e como o ir preparando para que esse momento, de encerramento do processo terapêutico, venha acompanhado de uma autonomia para o paciente." },
      { type: "paragraph", text: "2º Momento: Separa o grupo em 3 subgrupos de forma que cada grupo contenha certa variedade intragrupal. A ideia é que as diferentes perspectivas enriqueçam a discussão. Cada grupo vai ficar responsável por discutir e apresentar conclusões sobre os 3 grandes temas: preparar explicitamente para o término, orientar para o crescimento futuro e consolidar os ganhos alcançados/expressar orgulho no processo. Os grupos farão a discussão por aproximadamente 25 minutos. Nos primeiros 5 minutos deixe cada grupo discutindo sem muitas orientações. Nos demais minutos, passe de grupo em grupo fornecendo insights para pensar o tema. Use as seguintes perguntas como parâmetro:" },
      { type: "heading", text: "Grupo 1 - Preparar explicitamente para o término", level: 3 },
      {
        type: "list",
        items: [
        "Como falar sobre o término na primeira sessão, nas sessões intermediárias e ao se aproximar de um término real?",
        "Como conectar objetivos aos encerramentos?",
        "Como saberemos que a terapia está completa?",
        "Como gostaria que esse objetivo parecesse daqui a 12 sessões ou um ano?",
        "Como suas necessidades pessoais influenciam a forma como você encerra o tratamento?",
        ],
      },
      { type: "heading", text: "Grupo 2 - Orientar para o crescimento futuro", level: 3 },
      {
        type: "list",
        items: [
        "Como você prepara o cliente para abordar preocupações psicológicas futuras sem você?",
        "Como você transmite ao cliente que o crescimento e a mudança são processos contínuos e intermináveis?",
        "Como você fala com o cliente sobre problemas ou objetivos ainda a serem alcançados sem parecer crítico ou minar a confiança e a esperança?",
        ],
      },
      { type: "heading", text: "Grupo 3 - Consolidar os ganhos alcançados/Expressar orgulho no progresso", level: 3 },
      {
        type: "list",
        items: [
        "Como você comunica sobre o progresso que os clientes fizeram no tratamento?",
        "De que maneiras você compartilha seus sentimentos autênticos com os clientes em relação ao progresso deles?",
        "Você percebe algum padrão com clientes específicos ou preocupações apresentadas onde você tem dificuldade em expressar esse orgulho?",
        ],
      },
      { type: "paragraph", text: "Depois de passar por todos os grupos, de mais 5/10 minutos para a conclusão da discussão e sinalize para que as pessoas voltem para o grupo geral terminado o tempo definido ou quando terminarem as discussões em si." },
      { type: "paragraph", text: "3º Momento: Quando todos voltarem aos grupos, peça para que cada grupo exponha as ideias que foram concebidas na discussão. A ideia aqui é que todos participem e comentem sobre as conclusões dos outros grupos." },
      {
        type: "list",
        items: [
        "Como cada abordagem trabalha com as possíveis intervenções?",
        "Todos concordam com as conclusões obtidas?",
        ],
      },
    ],
  },
  {
    slug: "adaptacao-libera-llos-individual-inspirado-no-ex-5-encerrand",
    number: 53,
    title: "Adaptação LiberÁ-LLOS - individual (Inspirado no ex 5: Encerrando com Firmeza - Capítulo 7 - Fatores da Estrutura)",
    summary:
      "Quando é o momento adequado para dar alta a um paciente? Algumas abordagens definem o número de sessões terapêuticas antecipadamente, baseadas em generalizações estatísticas, como na Terapia Cognitivo-Comportamental…",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["reflexao", "discussao", "preenchimento"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "Quando é o momento adequado para dar alta a um paciente? Algumas abordagens definem o número de sessões terapêuticas antecipadamente, baseadas em generalizações estatísticas, como na Terapia Cognitivo-Comportamental (TCC). Em contrapartida, há casos em que os atendimentos se estendem por anos, sem uma previsão clara de término, seguindo a prática de alguns analistas. Evitando extremos, é crucial ser capaz de estimar o tempo necessário para o tratamento em determinadas situações, levando em consideração a singularidade do indivíduo, ou pelo menos tendo em mente os objetivos terapêuticos para a melhora do paciente. Sem essa definição, não é possível assegurar a duração adequada do tratamento." },
      { type: "paragraph", text: "A estrutura de encerramento da terapia varia de acordo com a abordagem seguida pelo terapeuta, porém estudos demonstram que conclusões bem-sucedidas do tratamento compartilham elementos e ritmo semelhantes, independentemente da abordagem utilizada. São, segundo o Field Guide, elementos estruturais centrais para encerramentos eficazes: (a) preparar explicitamente para o término, (b) orientar o cliente para o crescimento futuro, (c) consolidar ganhos alcançados, (d) expressar orgulho no progresso do cliente e (e) ter mutualidade no relacionamento. Este exercício explora como alguns desses elementos operam na prática terapêutica." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Leia a contextualização do exercício proposto e reflita a importância de atribuir algum prazo, talvez prorrogável, para o tratamento do paciente. Lembre-se que é necessário saber quando dar alta para o caso e como ir preparando-o para que esse momento, de encerramento do processo terapêutico, venha acompanhado de uma autonomia para o paciente." },
      { type: "paragraph", text: "2º Momento: Separe 3 dias diferentes, com um certo espaçamento, para refletir sobre cada um dos temas propostos a seguir. Reflita e anote suas respostas levando em consideração a sua vertente da psicologia e 2 outras que, podem não ser a sua de preferência, mas apresentam ideias que você considera interessantes. Use as seguintes perguntas como parâmetro:" },
      { type: "heading", text: "Tema 1 - Preparar explicitamente para o término", level: 3 },
      {
        type: "list",
        items: [
        "Como falar sobre o término na primeira sessão, nas sessões intermediárias e ao se aproximar de um término real?",
        "Como conectar objetivos aos encerramentos?",
        "Como saberemos que a terapia está completa?",
        "Como gostaria que esse objetivo parecesse daqui a 12 sessões ou um ano?",
        "Como suas necessidades pessoais influenciam a forma como você encerra o tratamento?",
        ],
      },
      { type: "heading", text: "Tema 2 - Orientar para o crescimento futuro", level: 3 },
      {
        type: "list",
        items: [
        "Como você prepara o cliente para abordar preocupações psicológicas futuras sem você?",
        "Como você transmite ao cliente que o crescimento e a mudança são processos contínuos e intermináveis?",
        "Como você fala com o cliente sobre problemas ou objetivos ainda a serem alcançados sem parecer crítico ou minar a confiança e a esperança?",
        ],
      },
      { type: "heading", text: "Tema 3 - Consolidar os ganhos alcançados/Expressar orgulho no progresso", level: 3 },
      {
        type: "list",
        items: [
        "Como você comunica sobre o progresso que os clientes fizeram no tratamento?",
        "De que maneiras você compartilha seus sentimentos autênticos com os clientes em relação ao progresso deles?",
        "Você percebe algum padrão com clientes específicos ou preocupações apresentadas onde você tem dificuldade em expressar esse orgulho?.",
        ],
      },
      { type: "paragraph", text: "3º Momento: Quando todos os temas estiverem concluídos, releia suas respostas e pense: dentre todas as opções que você levantou, qual é a mais eficiente? Qual combina mais com o seu estilo terapêutico? Você consegue incorporar intervenções que não são necessariamente da sua vertente, mas são efetivas, à sua prática de forma coerente?" },
    ],
  },
  {
    slug: "nuvem-de-palavras-das-habilidades-terapeuticas",
    number: 54,
    title: "Nuvem de palavras das habilidades terapêuticas",
    summary:
      "Contextualização: o propósito deste exercício é identificar quais habilidades terapêuticas são consenso dentro do grupo e quais não são, buscando explorar justamente o significado e a importância daquelas que aparecem…",
    category: "tecnica",
    duracaoMin: [30, 45],
    formato: ["discussao", "preenchimento"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: o propósito deste exercício é identificar quais habilidades terapêuticas são consenso dentro do grupo e quais não são, buscando explorar justamente o significado e a importância daquelas que aparecem menos, na forma de discussão grupal. A ideia é expandir o entendimento que os(as) associados(as) têm das habilidades terapêuticas fundamentais da Psicologia." },
      { type: "paragraph", text: "Ao longo da formação e da vida, somos cercados de noções (mais ou menos verdadeiras e corretas) das principais habilidades de um(a) profissional de Psicologia. Porém, enquanto algumas delas podem não ser nem de fato necessárias à profissão, outras, que de fato são, o(a) profissional pode não saber justificar o porquê é necessário ou mesmo ter uma visão simplista da habilidade." },
      { type: "paragraph", text: "Descrição:" },
      { type: "paragraph", text: "Primeiro momento: o coordenador deve apresentar o conceito de “habilidades terapêuticas” ao grupo (sugestão: competências essenciais e ou muito recomendadas que o(a) terapeuta consiga exercer em seu atendimento) e pedir que cada um escreva 6 competências que acreditem ser fundamentais na Psicologia no Mentimeter/Google forms, podendo envolver habilidades da abordagem do(a) associado(a);" },
      { type: "paragraph", text: "Segundo momento: Após todos enviarem, o coordenador deve expor a nuvem de palavras/gráfico ao grupo e observar quais foram as palavras mais trazidas e as menos. Em seguida, deve trazer o que as competências mais frequentes significam e como exercemos elas no trabalho clínico (se forem competências utilizadas de fato);" },
      { type: "paragraph", text: "Terceiro momento: Então, o coordenador deve pegar os termos menos ditos e investigar o motivo do termo estar ali, ou seja, o que ele significa e qual seu uso na clínica e porque ele é fundamental. Abrir para discussão entre o grupo e fazer uma devolutiva do comentário, com aspectos que o coordenador considerar relevantes das competências trazidas." },
    ],
  },
  {
    slug: "como-conduzir-mudancas-no-cliente-em-funcao-dos-tipos-de-mud",
    number: 55,
    title: "Como conduzir mudanças no cliente em função dos tipos de mudança",
    summary:
      "Contextualização: trabalhar a capacidade analítica do terapeuta de compreender como um cliente que deseja uma mudança pode obter essa mudança a partir de como ele(a) lidou com mudanças ao longo de sua vida. Em outras…",
    category: "tecnica",
    duracaoMin: [40, 60],
    formato: ["roleplay", "discussao"],
    pessoas: "solo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: trabalhar a capacidade analítica do terapeuta de compreender como um cliente que deseja uma mudança pode obter essa mudança a partir de como ele(a) lidou com mudanças ao longo de sua vida. Em outras palavras, as pessoas mudam de formas diferentes ao longo da vida. Este exercício visa trabalhar a capacidade do terapeuta conduzir uma ou mais mudanças na vida do cliente em função da forma como ele(a) muda em sua vida." },
      { type: "paragraph", text: "Uma coisa muito comum em diversos contextos de terapia é o cliente ter um objetivo e não saber como alcançá-lo. Mais especificamente, alguns desses objetivos exigem que o cliente realize e/ou passe por mudanças em sua vida. Porém, isso pode não estar claro, pode ser algo que o cliente não queira fazer (por diversas razões) e pode ser algo que o cliente não saiba como fazer, entre outras coisas. Neste caso, um trabalho que o terapeuta pode fazer seria identificar os entraves dessa(s) mudança(s) e auxiliar a realizá-la. Uma forma de superar esses entraves é trabalhando em como o cliente muda efetivamente na sua vida." },
      { type: "paragraph", text: "Descrição:" },
      { type: "paragraph", text: "Primeiro momento: o coordenador deve introduzir o assunto mudanças para o grupo. Pode seguir este modelo:" },
      { type: "paragraph", text: "Para esta tarefa, quero que vocês pensem em momentos da vida de vocês que vocês passaram por mudanças no seu jeito de ser (na personalidade, no comportamento, no modo de enxergar a vida, de pensar). Tentem ver se nesses momentos, as mudanças foram mais bruscas ou mais graduais, se foram mais prazerosas, dolorosas ou neutras. Pensem ainda em fatores principais que acompanharam essas transformações (troca de escola/casa/cidade? Uma conversa/fala com alguém? Evento marcante? Uma perda/ganhou de algo ou alguém na sua vida? Um insight? Um livro, filme ou série?)." },
      { type: "paragraph", text: "O exercício pode ser feito de forma individual também." },
      { type: "paragraph", text: "Segundo momento: um breve compartilhamento das respostas deve ser feito. Para evitar perder tempo, o coordenador pode perguntar por respostas parecidas à compartilhada e incentivar pessoas que tiveram outros pensamentos a falarem, ao invés de quem pensou igual (mas se a dinâmica estiver rolando bem com ideias iguais, deixa rolar)." },
      { type: "paragraph", text: "Terceiro momento: agora, o coordenador deve mostrar como as mudanças podem ocorrer nas nossas vidas de diversas formas. Além disso, que, no nosso trabalho, nós podemos ser solicitados a auxiliar em um processo de mudança que o cliente esteja passando. Assim, entender como as mudanças ocorreram ao longo da vida do cliente, como ele sentiu e percebeu esses processos e quais as expectativas e sentimentos para o atual pode ajudar em uma melhor intervenção nessa mudança." },
      { type: "paragraph", text: "Quarto momento: então, o coordenador deve trazer uma vinheta clínica cujo tema seja mudança em algum aspecto da vida do paciente. A vinheta deve conter como o cliente se sente perante isso, o contexto dessa mudança, o que o cliente tem feito atualmente e elementos que indiquem como ele passou por mudanças no passado e como essas mudanças são percebidas para ele. Então, o grupo terá um tempo para pensar em intervenções possíveis em função desse caso, considerando como é para o cliente passar por mudanças e quais seriam formas interessantes de conduzir o caso em função disso." },
    ],
  },
  {
    slug: "encaminhamento-para-psiquiatra-e-ou-outro-profissional",
    number: 56,
    title: "Encaminhamento para psiquiatra e/ou outro profissional",
    summary:
      "Caracterização: ajudar a identificar no decorrer da terapia elementos e sinais que indicam a necessidade de se fazer um encaminhamento para um outro profissional, como psiquiatra, neuropsicólogo, assistente social,…",
    category: "manejo",
    duracaoMin: [40, 60],
    formato: ["discussao", "supervisao"],
    pessoas: "supervisor",
    tags: ["psiquiatra"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Caracterização: ajudar a identificar no decorrer da terapia elementos e sinais que indicam a necessidade de se fazer um encaminhamento para um outro profissional, como psiquiatra, neuropsicólogo, assistente social, entre outros. Porém, não seria para interromper o processo de psicoterapia, mas sim realizar alguma intervenção além do escopo do(a) psicólogo(a) que esteja se mostrando necessária para o tratamento prosseguir." },
      { type: "paragraph", text: "O pedido de encaminhamento e de contato com outro profissional é algo frequente atualmente. Muitos psiquiatras, após fecharem um diagnóstico, indicam tanto medicação quanto psicoterapia. Além disso, alguns clientes chegam à clínica com demandas que estão fora de nosso escopo. Neste sentido, o encaminhamento deveria ser feito visando a melhor progressão do tratamento do cliente possível. Existem casos, porém, que não é possível encaminhar. Algumas razões para isso seriam: o cliente não tem recursos financeiros o bastante para consultar o(a) psicólogo e outro profissional (ou realizar um processo pontual, como uma avaliação [neuro]psicológica); o cliente não tem uma agenda que possibilite encaixar a psicoterapia e outro tratamento, sendo obrigado a escolher um ou outro; o cliente está em um momento sensível do tratamento ou apresenta características que tornam difíceis o pedido de encaminhamento (cliente demorou para se abrir com profissional e irá precisar de mais tempo para fazer o mesmo com outra pessoa; cliente com uma percepção neuro-psicótica iria ficar abalado com o encaminhamento e associar isso à uma piora do quadro; cliente nega estar com problemas, embora apresente sinais claros que requerem intervenções), entre outras coisas. Neste sentido, é muito importante que o(a) psicólogo(a) esteja consciente da condição atual do cliente para solicitar o encaminhamento. Ainda, é preciso que seus critérios estejam claros para evitar um encaminhamento (e possível gasto de tempo) desnecessário do cliente." },
      { type: "paragraph", text: "Descrição:" },
      { type: "paragraph", text: "Momento 1: O coordenador deve apresentar o objetivo e contexto do exercício, podendo fazer perguntas instigantes para ajudar os participantes a engajarem na discussão (vocês acham que, sempre que reconhecem a necessidade de encaminhar um cliente para um psiquiatra, devem fazê-lo? Quais os lados bons de encaminhar? E os ruins? Sempre é possível encaminhar?)." },
      { type: "paragraph", text: "Momento 2: Então, o coordenador deve instruir os participantes a listarem os motivos pelos quais encaminhariam um cliente para um outro profissional (lembrando: não é largar o caso! É um profissional a mais no caso) e justificar de forma breve esses motivos (ex: eu encaminho em caso de sintoma de transtorno mental pro psiquiatra pra ele dar um diagnóstico e ter um tratamento mais efetivo)." },
      { type: "paragraph", text: "Momento 3: O coordenador pergunta quais os motivos foram levantados e as justificativas rapidamente para um compartilhamento. Então, pede para que cada um identifique individualmente em que contexto aprenderem isso (ex: encaminhar para o psiquiatra foi uma orientação vista aonde? As possíveis origens disso podem ser: aula/professor/faculdade, curso, supervisor, livro/artigo, fundamentos da abordagem, preferências pessoais, redes sociais, entre outros)." },
      { type: "paragraph", text: "Momento 4: O coordenador novamente pergunta a origem desses motivos em outro compartilhamento breve. Então, ele deve perguntar aos participantes se alguém discorda de alguns dos motivos apresentados." },
      {
        type: "list",
        items: [
        "Caso haja discordância, o coordenador deve explorar e permitir a discussão entre os participantes a respeito da concordância dos motivos levantados e tentar puxar um gancho para apresentar a questão das consequências do encaminhamento.",
        "Caso não haja, o coordenador deve pegar alguns dos motivos apresentados e pedir que os participantes tragam as consequências do encaminhamento,",
        ],
      },
      { type: "paragraph", text: "Momento 5: como atividade pós-encontro, o coordenador deve instruir os participantes a olharem para seus motivos e escreverem as consequências, tanto positivas quanto negativas. Então, devem reconsiderar se encaminhariam segundo estes motivos ou se alguma modificação seria feita (consideração maior ao contexto do cliente, do momento da terapia, entre outros)." },
    ],
  },
  {
    slug: "paciente-tratando-de-temas-que-fogem-do-assunto-principal",
    number: 57,
    title: "Paciente tratando de temas que fogem do assunto principal",
    summary:
      "1o momento: Após a apresentação do exercício, cada participante deve escolher uma queixa principal de caso clínico e compartilhar com o grupo no chat ou verbalmente.",
    category: "manejo",
    duracaoMin: [30, 45],
    formato: ["reflexao", "discussao"],
    pessoas: "dupla",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: O exercício tem por objetivo refletir sobre a postura e manejo adequados aos casos em que o cliente está evitando ou desviando do assunto principal que quer trabalhar em terapia." },
      { type: "paragraph", text: "Em muitos casos, por mais que o cliente queira resolver alguma questão em sua vida (pessoal ou não), ele não consegue falar do assunto diretamente. Isso é percebido na terapia por abordagens do cliente que se concentram em outras características do problema, mas que podem sinalizar para a verdadeira questão a ser trabalhada. Neste caso, parece que o cliente está dentro do assunto de seu problema, mas não investigando o ponto principal. Essa é uma situação diferente de quando o cliente troca até mesmo o assunto, falando, por exemplo, em várias sessões sobre seu ambiente de trabalho quando na verdade sua queixa principal é em relação à sua sexualidade. Novamente, o que é trazido sobre o trabalho pode ter relação com a sexualidade de forma implícita ou simbólica (porque o indivíduo é integrado), mas pode haver casos em que o cliente busca fugir de conversar sobre seus maiores problemas. Isso pode ser percebido quando o terapeuta pergunta e o cliente não desenvolve o assunto. Este exercício visa lidar melhor com isso. O exercício pode ser praticado na forma de role play único ou separando o grupo em duplas para atendimentos individuais, ou ainda na forma de discussão grupal." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1o momento: Após a apresentação do exercício, cada participante deve escolher uma queixa principal de caso clínico e compartilhar com o grupo no chat ou verbalmente." },
      { type: "paragraph", text: "2o momento: então, irão se estabelecer as duplas ou quem irá fazer o role play e o paciente irá escolher uma das queixas trazidas pelo grupo para ser sua principal e informar ao colega terapeuta. Essa queixa será evitada de ser conversada." },
      { type: "paragraph", text: "3o momento: durante o role play, o cliente irá tentar ao máximo evitar falar daquilo que for sua queixa principal. Já o terapeuta irá tentar chegar nesse assunto. A forma pela qual ele vai tentar é livre, mas o objetivo principal é fazer seu cliente falar." },
      { type: "paragraph", text: "4o momento: Após o role play, trocam-se os papéis. O cliente atual escolhe uma nova queixa principal e informa ao terapeuta e o processo se repete. Ao final, os grupos voltam para a ligação principal e discutem como foi a experiência e compartilham suas tentativas." },
    ],
  },
  {
    slug: "paciente-tratando-de-temas-que-fogem-do-assunto-principal-po",
    number: 58,
    title: "Paciente tratando de temas que fogem do assunto principal - possibilidade 2",
    summary:
      "1o momento: Após a apresentação do exercício, cada participante deve escolher uma queixa principal de caso clínico e compartilhar com o grupo no chat ou verbalmente.",
    category: "manejo",
    duracaoMin: [30, 45],
    formato: ["roleplay", "discussao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "1o momento: Após a apresentação do exercício, cada participante deve escolher uma queixa principal de caso clínico e compartilhar com o grupo no chat ou verbalmente." },
      { type: "paragraph", text: "2o momento: O coordenador irá escolher uma queixa central para ser a queixa de um suposto cliente que está em terapia." },
      { type: "paragraph", text: "3o momento: O coordenador irá perguntar quais são as possíveis formas de lidar com um cliente desviando da queixa escolhida e como abordar isso. Após um compartilhamento geral, o coordenador deve problematizar as escolhas feitas pelo grupo, focando em: déficits das abordagens citadas, característica ou natureza da queixa principal e compatibilidade geral dela com o manejo discutido e levantamento de possíveis fatores importantes que não foram trazidos (tipo de cliente, abordagem, tempo da sessão, tom de voz, mudança ou progressão de manejo)." },
      { type: "paragraph", text: "4o momento: Após a discussão grupal considerando a problematização, pode ser passado um vídeo de paciente que desvia do assunto para o grupo que poderá elaborar intervenções com base no que foi discutido no grupo." },
    ],
  },
  {
    slug: "encerra-llos",
    number: 59,
    title: "EncerrÁ-LLOS",
    summary:
      "Um encerramento bem feito em uma sessão de psicoterapia é crucial para o processo terapêutico. Ele pode proporcionar um momento de reflexão, de integração das experiências discutidas durante a sessão de forma a…",
    category: "tecnica",
    duracaoMin: [60, 90],
    formato: ["roleplay", "reflexao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "Um encerramento bem feito em uma sessão de psicoterapia é crucial para o processo terapêutico. Ele pode proporcionar um momento de reflexão, de integração das experiências discutidas durante a sessão de forma a permitir que o paciente processe as emoções e insights obtidos. Além disso, uma finalização adequada pode ajudar a fortalecer a relação terapêutica, transmitir ao paciente uma sensação de segurança e cuidado, e reforçar a confiança no terapeuta e no processo terapêutico como um todo. Por outro lado, um encerramento também pode deixar o cliente com sentimentos de confusão, insegurança ou até mesmo frustração, que não necessariamente significam um erro clínico." },
      { type: "paragraph", text: "Na TCC, um encerramento frequentemente envolve atribuir \"tarefas para casa\" ao paciente. Essas tarefas são atividades específicas projetadas para ajudar o cliente a praticar habilidades aprendidas durante a terapia entre as sessões. A ideia por trás disso é promover a generalização das habilidades terapêuticas para a vida cotidiana do cliente, incentivando a prática e a consolidação das mudanças comportamentais e cognitivas." },
      { type: "paragraph", text: "Um exemplo de para casa é o registro de pensamentos intrusivos, que podem incluir pensamentos autodepreciativos, preocupações excessivas, previsões negativas sobre o futuro, críticas a si mesmo ou a outros, entre outros tipos de pensamentos negativos recorrentes. A ideia é registrar qual pensamento aconteceu em qual situação sempre que puder, e levar para discuti-los em terapia, por exemplo. Ao completar essa tarefa para casa, o indivíduo pode desenvolver uma compreensão mais profunda de seus padrões de pensamento automáticos e aprender a desafiar e reestruturar pensamentos intrusivos de maneira mais adaptativa, o que pode reduzir a intensidade e a frequência desses pensamentos ao longo do tempo. Ademais, um para casa pode ser também uma sugestão de reflexão, sobre situações, sobre sentimentos, sobre relações, dentre outros." },
      { type: "paragraph", text: "Outro encerramento possível é o corte lacaniano, o qual, em termos simples, consiste em encerrar abruptamente uma sessão de terapia em um momento crucial, desafiando o cliente a refletir sobre o que foi discutido. Na prática, o corte lacaniano consiste, simploriamente falando, em ressaltar, pontuar, uma frase dita pelo paciente, que possa assumir um significante diferente a partir de outras interpretações, e que pareça ser capaz de mobilizar certo afeto. A ideia por trás dessa intervenção é estimular o paciente a explorar novas perspectivas e promover certa inquietação e, posteriormente, independência. Intenciona-se que o paciente possa desenvolver uma compreensão mais profunda de si mesmo e das questões abordadas durante a terapia." },
      { type: "paragraph", text: "Um exemplo de corte lacaniano, é o de uma mulher que relata o seguinte em sessão: “Estava dando uma festa na minha casa e combinei com meu marido que na primeira metade eu ficaria responsável por servir bebidas aos convidados e na segunda metade ele ficaria. Quando chegamos na segunda metade da festa, ele passava servindo todos convidados menos eu. Cheguei a reclamar com algumas pessoas dizendo que ele não me serve.” Nesse momento, o terapeuta interrompe o discurso e afirma: “Seu marido não te serve”. Com isso encerra a sessão. Vale lembrar que, como dito anteriormente, o encerramento também pode deixar o cliente com sentimentos de confusão, insegurança e frustração sem ser considerado um erro clínico." },
      { type: "paragraph", text: "Um tipo de encerramento altamente eficaz é a atualização do processo terapêutico, um momento crucial para revisar e consolidar os progressos alcançados durante o tratamento. Durante essa fase, tanto o terapeuta quanto o cliente têm a oportunidade de refletir sobre os planos traçados anteriormente, os objetivos atingidos e quaisquer desafios enfrentados ao longo do caminho. Essa revisão não apenas ajuda a celebrar as conquistas, mas também permite uma avaliação honesta do que funcionou bem e do que pode ser ajustado para melhor atender às necessidades do cliente. Além disso, é o momento ideal para estabelecer metas claras e realistas para as próximas etapas do processo terapêutico, garantindo uma direção clara e focada para o trabalho futuro. Essa prática fortalece a colaboração entre terapeuta e cliente, promove um senso de responsabilidade mútua e nutre um ambiente terapêutico rico em crescimento e aprendizado contínuo." },
      { type: "paragraph", text: "Outra possibilidade de encerramento é um feedback positivo, que exponha de maneira explícita os avanços no processo terapêutico, as conquistas pessoais do paciente, o progresso em busca do objetivo final. Esse tipo de intervenção ajuda a fortalecer a relação terapêutica, aumenta a confiança do paciente, implementa certa melhora em sua auto-estima, dentre outros benefícios. Ademais, um feedback crítico também é uma possibilidade. Por vezes, procurar maneiras de reportar a falta de comprometimento com a terapia, atitudes desadaptativas, desrespeitosas, dentre outras, é crucial para uma virada de chave no processo terapêutico ou para impor limites saudáveis na clínica." },
      { type: "paragraph", text: "Uma finalização que resume pontos discutidos na terapia em um ponto central pode ser realizada de forma estruturada e reflexiva. O terapeuta pode começar identificando os principais temas ou padrões que emergiram ao longo das sessões, destacando os pontos-chave que foram explorados e trabalhados. Em seguida, o terapeuta pode condensar esses temas em um ponto central, uma ideia fundamental que resume a essência do processo terapêutico até aquele momento. Essa ideia central serve como um lembrete poderoso para o cliente, encapsulando o progresso feito e as questões importantes abordadas na terapia." },
      { type: "paragraph", text: "Esse exercício visa proporcionar ideias e treinar a execução de encerramentos adequados para cada caso clínico, de modo a potencializar o impacto de cada sessão e o processo terapêutico como um todo." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Contextualização do exercício proposto. Exponha para o grupo, baseado no texto acima, a importância que tem um encerramento bem feito, tanto na sessão, quanto no processo terapêutico como um todo." },
      { type: "paragraph", text: "2º Momento: Proposição de um roleplay de atendimento, de 10 minutos, no qual o terapeuta deve concluir a sessão com um encerramento produtivo." },
      { type: "paragraph", text: "3º Momento: Momento de discutir o encerramento ocorrido. Pergunte primeiramente ao terapeuta, os motivos pelo qual ele optou pelo encerramento que foi feito." },
      {
        type: "list",
        items: [
        "O que levou ele a tal escolha?",
        "Quais as hipóteses do terapeuta sobre o porque este encerramento seria produtivo?",
        "Quais as fantasias do terapeuta sobre como o paciente deve reagir.",
        ],
      },
      { type: "paragraph", text: "Pergunte agora para o paciente como ele interpretou esse encerramento:" },
      {
        type: "list",
        items: [
        "O que ele sentiu na hora da intervenção?",
        "Como ele lidaria com o encerramento?",
        "Seria produtivo em algum nível? Ou prejudicial?",
        ],
      },
      { type: "paragraph", text: "Por fim, peça aos participantes do grupo para opinarem a respeito do encerramento. A partir das teorias de cada um:" },
      {
        type: "list",
        items: [
        "O encerramento foi produtivo? Porquê?",
        "Qual encerramento poderia ser melhor e porque? Como você o formularia?",
        "Qual tipo de encerramento seria ruim? Porque?",
        ],
      },
      { type: "paragraph", text: "Por fim, repita o processo a partir de um novo atendimento, quantas vezes o tempo permitir." },
    ],
  },
  {
    slug: "auto-reflexao",
    number: 60,
    title: "Auto-reflexão",
    summary:
      "O desenvolvimento do autoconhecimento é uma pedra angular na prática psicológica, pois permite que os terapeutas compreendam melhor a si mesmos, suas próprias motivações e reações emocionais. Ao explorar suas próprias…",
    category: "autoconhecimento",
    duracaoMin: [45, 75],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "supervisor",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "O desenvolvimento do autoconhecimento é uma pedra angular na prática psicológica, pois permite que os terapeutas compreendam melhor a si mesmos, suas próprias motivações e reações emocionais. Ao explorar suas próprias experiências de vida, crenças, valores e padrões de comportamento, os psicólogos podem ganhar uma compreensão mais profunda de como esses fatores influenciam suas interpretações, sentimentos e interações com os clientes. Esse autoconhecimento é essencial para manter a objetividade durante as sessões terapêuticas, ajudando os terapeutas a reconhecer e lidar com possíveis preconceitos ou projeções que possam surgir." },
      { type: "paragraph", text: "Além disso, o desenvolvimento do autoconhecimento permite que os terapeutas cultivem uma maior empatia e compreensão em relação aos seus clientes. Ao reconhecer e aceitar suas próprias vulnerabilidades e lutas pessoais, os terapeutas podem se conectar de forma mais autêntica e genuína com os pacientes, criando um ambiente terapêutico seguro e acolhedor. Essa conexão horizontal e empática é fundamental para estabelecer uma aliança terapêutica sólida e promover o engajamento do cliente no processo de tratamento." },
      { type: "paragraph", text: "O autoconhecimento desempenha um papel fundamental na prevenção de interpretações equivocadas e projeções na prática clínica, proporcionando aos terapeutas uma base sólida de compreensão de si mesmos. Ao estar consciente de suas próprias experiências passadas, crenças, valores e preconceitos, os terapeutas podem identificar e separar suas próprias emoções e experiências das dos clientes. Isso permite uma avaliação mais precisa das situações apresentadas durante as sessões terapêuticas, reduzindo a probabilidade de interpretações distorcidas ou influenciadas por viés pessoal. Além disso, o autoconhecimento capacita os terapeutas a reconhecer e lidar com projeções inadvertidas de suas próprias questões não resolvidas nos clientes, promovendo uma prática clínica mais objetiva, compassiva e eficaz." },
      { type: "paragraph", text: "Ademais, conhecer-se é essencial para promover o crescimento pessoal e profissional contínuo dos terapeutas. Ao identificar áreas de força e fraqueza, os psicólogos podem buscar supervisão, formação adicional e práticas de autocuidado para melhorar suas habilidades terapêuticas e evitar a fadiga profissional. Esse compromisso com o auto aperfeiçoamento não apenas beneficia os terapeutas individualmente, mas também melhora a qualidade dos serviços prestados aos clientes, promovendo resultados terapêuticos mais eficazes e satisfatórios. Em suma, o desenvolvimento do autoconhecimento é uma jornada contínua e essencial para os terapeutas, capacitando-os a oferecer um cuidado compassivo, eficaz e centrado no paciente." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Contextualização do exercício proposto. Exponha para o grupo, baseado no texto acima, a importância de que o terapeuta mantenha um processo de autoconhecimento." },
      { type: "paragraph", text: "2º Momento: Introduza rapidamente a noção de valores pessoais para os participantes do grupo. Os valores pessoais de um sujeito são princípios fundamentais, crenças e ideais que guiam suas escolhas, ações e comportamentos ao longo da vida. Esses valores representam o que é mais significativo e importante para a pessoa, refletindo suas preferências, prioridades e aspirações. Podem abranger uma ampla gama de áreas, como ética, família, trabalho, saúde, liberdade, justiça, entre outros. Os valores pessoais são intrínsecos e individualmente distintos, moldados por influências culturais, experiências de vida e educação. Eles desempenham um papel essencial na definição da identidade de um indivíduo e na tomada de decisões que estão alinhadas com seus propósitos e metas pessoais." },
      { type: "paragraph", text: "3º Momento: Solicite a cada integrante do grupo que listem dois valores pessoais de certa importância em sua vida. Eles podem fazer isso através de palavras-chave, frases ou desenhos que os representem. Peça que registrem o que foi listado." },
      { type: "paragraph", text: "O número de valores deve variar a depender da quantidade de pessoas no grupo. Quanto mais pessoas no grupo, menor a margem de valores que podem ser pedidos, uma vez que a ideia é trabalhar com quase todos." },
      { type: "paragraph", text: "4º Momento: Após a listagem, peça para que os participantes compartilhem rapidamente seus valores com o grupo, explicando muito brevemente por que cada valor é significativo para eles. Anote os valores de cada integrante." },
      { type: "paragraph", text: "5º Momento: Por fim, promova um debate, em que a intenção é refletir sobre como esses valores influenciam suas vidas pessoais e práticas terapêuticas, e como podem utilizar esse conhecimento para promover o autoconhecimento e o crescimento pessoal contínuo. A ideia é que cada pessoa tenha pelo menos um valor pessoal discutido." },
      { type: "paragraph", text: "Exemplo: Um terapeuta que tem como valor pessoal a justiça. Nesse sentido, lidar com situações em que o paciente apresenta uma moral mais individualizada pode ser um problema. Outro ponto a se atentar, é que o terapeuta pode tentar fazer sobressair seu desejo por justiça durante os casos, que pode ser uma postura equivocada, visto que “fazer justiça” não é uma preocupação para algumas pessoas, que podem simplesmente esquecer o ocorrido de forma produtiva." },
      { type: "paragraph", text: "Seguem algumas perguntas para pensar o tópico:" },
      {
        type: "list",
        items: [
        "Como meus valores pessoais podem afetar minha percepção do cliente e suas experiências?",
        "Como posso garantir que meus valores pessoais não prejudiquem a terapia ou a relação terapêutica?",
        "Em que áreas específicas meus valores pessoais podem entrar em conflito com as crenças ou valores do cliente?",
        "Como posso usar meus valores pessoais de forma construtiva para apoiar o cliente?",
        ],
      },
    ],
  },
  {
    slug: "auto-reflexao-possibilidade-2",
    number: 61,
    title: "Auto-reflexão - possibilidade 2",
    summary:
      "1o momento: Repita os momentos 1, 2, 3 e 4 do exercício anterior. Sugere-se uma modificação:",
    category: "autoconhecimento",
    duracaoMin: [30, 45],
    formato: ["reflexao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "1o momento: Repita os momentos 1, 2, 3 e 4 do exercício anterior. Sugere-se uma modificação:" },
      {
        type: "list",
        items: [
        "Monte um mentimeter utilizando o modelo nuvem de palavras e exponha os resultados aos participantes, ou coloque todos os valores em uma lista única no chat ou qualquer outra plataforma de edição de texto.",
        ],
      },
      { type: "paragraph", text: "2o momento: Após elaborar a lista, peça que os participantes realizem um role play ou que leiam um(s) caso(s) clínicos e discutam como, na atuação do terapeuta ou na compreensão do caso, cada valor pode ser/foi exercido. Segue algumas sugestões de casos clínicos:" },
      {
        type: "list",
        items: [
        "Mulher adulta de 26 anos, filha única, casada, tem dois cachorros pelos quais tem “muita estima” e é fisioterapeuta há 6 anos. Buscou terapia pois estava com dores na barriga para as quais “não encontra causa orgânica”. Ela diz que suas relações aos pares não são muito boas, sempre ouvindo que é exigente e dura demais com os outros. Ela se sente incompreendida, exceto pelo marido, o qual sempre dá razão a ela e aceita o que ela tem a dizer. Diz que suas dores surgem “meio do nada”, após dias nos quais precisa interagir muito com pessoas e em que se vê contrariada e forçada a tomar atitudes pelos outros “para não se aborrecer”. Em sessão, fala alto, tem um tom de voz estridente e costuma cobrar um posicionamento específico do(a) terapeuta, além de sugerir mudanças no setting terapêutico, gesticular bastante enquanto fala, apresentar agitação, fala acelerada, mudar de posição na poltrona constantemente e conduzir a sessão.",
        "Homem idoso de 77 anos, viúvo há 25 anos e mora com o filho. É aposentado há 5 anos, tendo trabalhado como engenheiro, arquiteto, designer de interiores, pesquisador e professor de matemática. Buscou a terapia pois gostaria de desenvolver um lado mais “humano” em si. Afirma que sempre enxergou a vida de forma muito pragmática e objetiva, e agora gostaria de se aproximar de aspectos mais subjetivos e menos “exatos” de si mesmo. Aprecia arte e caminhadas pelo bairro e costuma ter dificuldades com metáforas e com pensamento simbólico em sessão, mas é muito engajado com as atividades da terapia.",
        "Homem, 18 anos de idade, formado no EM, fazendo cursinho para medicina veterinária, passa uma semana com a mãe e os 3 irmãos mais novos e outra com o pai e madrasta. Possui um namorado há 1 ano e meio da escola antiga. Buscou terapia para tentar entender um desânimo com a vida generalizado que, em terapia anterior, descobriu ser associado com a separação dos pais. Ao falar desta atualmente, diz que não se ressente mais, embora saiba que “segurou uma barra pesadíssima por causa dos irmãos”, dos quais teve que cuidar na época. Atualmente, está frustrado com o tempo perdido durante o divórcio e não sabe como compensar isso em sua vida, algo que se reflete em sua disposição com os estudos pois, por mais que esteja engajado em se tornar um “grande veterinário”, ao mesmo tempo pensa que poderia já estar ganhando um dinheiro trabalhando, quando não perde novamente a disposição. Diz que essas “tristezas” duram algo entre 5 e 7 meses, nos quais “se mata para continuar vivendo normalmente”, mas que depois tem um pique de energia de umas duas a seis semanas.",
        ],
      },
    ],
  },
  {
    slug: "autentica-llos",
    number: 62,
    title: "AutenticÁ-LLOS",
    summary:
      "A autenticidade do psicólogo desempenha um papel crucial no processo clínico, pois estabelece a base para uma relação terapêutica genuína e significativa. Quando o terapeuta é autêntico, ele transmite ao cliente uma…",
    category: "tecnica",
    duracaoMin: [60, 90],
    formato: ["discussao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "A autenticidade do psicólogo desempenha um papel crucial no processo clínico, pois estabelece a base para uma relação terapêutica genuína e significativa. Quando o terapeuta é autêntico, ele transmite ao cliente uma sensação de confiança, aceitação e segurança, criando um ambiente propício para a exploração emocional e o crescimento pessoal. Ser autêntico pode inspirar o cliente a ser mais aberto e honesto em suas interações, o que é essencial para o progresso terapêutico." },
      { type: "paragraph", text: "Além disso, saber demonstrar seus sentimentos na sessão de maneira produtiva e não invasiva é fundamental para manter os limites adequados na relação terapêutica. O terapeuta pode compartilhar suas próprias emoções de forma estratégica, quando apropriado, para validar as experiências do cliente e fortalecer a conexão terapêutica. No entanto, é essencial que essas expressões sejam feitas com cuidado e sensibilidade, respeitando o espaço e as necessidades emocionais do cliente." },
      { type: "paragraph", text: "Demonstrar autenticidade e habilidades emocionais produtivas também ajuda a modelar um comportamento saudável de enfrentamento para o cliente, incentivando-o a explorar e expressar suas próprias emoções de forma construtiva. Isso pode promover um maior autoconhecimento, resiliência emocional e habilidades de regulação emocional no cliente, fortalecendo assim o processo terapêutico. Em suma, a autenticidade do terapeuta e a capacidade de demonstrar sentimentos de maneira produtiva e não invasiva são aspectos essenciais para uma prática clínica eficaz e compassiva." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Contextualização do exercício proposto. Exponha para o grupo, baseado no texto acima, a importância de demonstrar sentimentos autênticos no processo clínico, mas de forma responsável." },
      { type: "paragraph", text: "2º Momento: Proponha um debate em grupo, no qual deve-se pensar como e em quais casos seria razoável ou produtivo expressar as emoções listadas a seguir, e quando ou como seria invasivo ou prejudicial para o desenvolvimento do caso. A ideia é permitir e incentivar que os participantes pensem casos específicos e formulem boas intervenções. Nesse sentido, para incentivar a participação de todos, o condutor do grupo pode requerir a participação de determinado integrante." },
      { type: "paragraph", text: "Perguntas:" },
      {
        type: "list",
        items: [
        "Quando expressar esse sentimento pode ser positivo?",
        "Como expressá-lo de maneira produtiva e não invasiva?",
        "Quando expressar esse sentimento pode ser prejudicial?",
        "Qual maneira de expressá-lo pode ser invasiva ou prejudicial?",
        ],
      },
      { type: "paragraph", text: "Sentimentos:" },
      {
        type: "list",
        items: [
        "Impotência/Frustração: Sensação de incapacidade de ajudar o paciente. Pode advir também de não conseguir se fazer compreendido pelo paciente.",
        "Gratidão: Sentimento de apreciação e reconhecimento pelo progresso e pela confiança demonstrados pelo cliente ao longo do processo terapêutico.",
        "Culpa: Sentimento de responsabilidade pessoal por dificuldades ou falhas no tratamento.",
        "Satisfação: Sentimento de realização pessoal ao testemunhar o desenvolvimento produtivo do processo terapêutico.",
        "Raiva: Sentimento de irritação ou indignação em relação ao comportamento do paciente ou a situações específicas.",
        "Felicidade: Sensação de alegria e contentamento ao ver o cliente alcançar seus objetivos e encontrar maior bem-estar emocional.",
        "Desgaste emocional: Exaustão emocional devido ao contato frequente com o sofrimento dos pacientes.",
        "Esperança: Sentimento de otimismo e confiança no potencial de mudança e crescimento do cliente, mesmo diante de desafios.",
        "Desilusão/Frustração: Sentimento de desilusão quando as expectativas em relação ao progresso no processo terapêutico não são atendidas.",
        "Inspiração/Orgulho: Sentimento de admiração e motivação ao testemunhar a coragem e a determinação do cliente em superar adversidades.",
        "Insegurança: Sentimento de dúvida em relação às habilidades ou competências terapêuticas.",
        "Cuidado: Sentimento de preocupação e responsabilidade pelo bem-estar do cliente, motivando o terapeuta a fornecer apoio e orientação contínuos.",
        "Tristeza: Sentimento de pesar ou melancolia ao testemunhar o sofrimento do paciente.",
        "Compaixão: Sentimento de compreensão e ternura em relação ao sofrimento do cliente, acompanhado do desejo genuíno de aliviar seu sofrimento.",
        "Ansiedade: Preocupação, apreensão em relação ao futuro do paciente ou ao próprio desempenho terapêutico.",
        "Autoaceitação: Sentimento de paz e aceitação pessoal ao reconhecer e honrar os próprios limites, desafios e conquistas na prática terapêutica. Pode advir de um autodesenvolvimento devido a relação terapêutica.",
        ],
      },
    ],
  },
  {
    slug: "cobra-llos",
    number: 63,
    title: "CobrÁ-LLOS",
    summary:
      "Dentre os aspectos burocráticos da clínica, a cobrança é um dos temas que mais gera discussão e, segundo vários relatos, insegurança nos psicólogos. Seja na comunicação do valor com o cliente, seja na definição do…",
    category: "tecnica",
    duracaoMin: [40, 60],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "Dentre os aspectos burocráticos da clínica, a cobrança é um dos temas que mais gera discussão e, segundo vários relatos, insegurança nos psicólogos. Seja na comunicação do valor com o cliente, seja na definição do valor, na organização de agenda entre os atendimentos de valor social e não-social ou ainda outros aspectos, a cobrança é um fator importante a ser discutido visto que envolve não só estabelecimento de contrato mas também toda a vida financeira do psicólogo. Este exercício visa desenvolver a reflexão dos critérios importantes na definição de valores e na passagem do valor aos clientes, além de, subjetivamente, como cada um lida com a cobrança de sua sessão." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1o Momento: contextualize o tema para realizar o levantamento de critérios e considerações importantes do paciente na cobrança. Ressaltar que cobrança não é apenas definir valor, mas como isso é feito em sessão, em qual sessão, ou é por fora da sessão, segundo qual esquema, etc. Vai se utilizar a plataforma Mentimeter para tal levantamento, na qual os participantes usam as caixas de texto para escrever 3 critérios/conceitos importantes para si. A partir disso, a plataforma gera uma nuvem de palavras com os termos trazidos." },
      { type: "paragraph", text: "2o Momento: discussão dos conceitos levantados, segundo as observações dos participantes e do condutor. A discussão pode girar em torno primeiramente das palavras/termos maiores na nuvem de palavras, que indicam as respostas predominantes. Pode-se perguntar aos participantes quem colocou tais termos e porque consideraram isso importante. Ademais, pode se puxar para os termos menos frequentes também." },
      { type: "paragraph", text: "3o Momento: após a discussão, será passado um (ou mais) caso(s) aos participantes, que deverão responder como se colocam e devolvem o pedido de cobrança ao caso. O condutor pode escolher um caso que ele ache melhor. Seguem 3 exemplos de casos para a dinâmica:" },
      { type: "heading", text: "Caso 1", level: 3 },
      { type: "paragraph", text: "Você tem um paciente que atende há 4 meses. Ao longo desse tempo, o paciente chegou a atrasar o pagamento das sessões algumas vezes, mas nada que passasse dois dias. Porém, no último mês, ele não chegou a pagar o preço de nenhuma das sessões." },
      { type: "heading", text: "Caso 2", level: 3 },
      { type: "paragraph", text: "Você recebe um contato de uma pessoa que busca atendimento psicológico. A pessoa traz uma demanda relativamente “comum” com o que você trabalha. Afirma ainda que sente que precisará de terapia por um tempo, e faz uma proposta de pagar todas as sessões do mês adiantado, mas pede um desconto de 15% nesta condição. Considere que será 1 sessão semanal." },
      { type: "heading", text: "Caso 3", level: 3 },
      { type: "paragraph", text: "Você tem um paciente atendido por valor social há 3 meses. Este paciente te manda uma mensagem dizendo que recentemente um dos pais perdeu o emprego, e agora ele não poderá continuar a terapia para poupar gastos." },
    ],
  },
  {
    slug: "postura-terapeutica-x-autenticidade",
    number: 64,
    title: "Postura terapêutica X autenticidade",
    summary:
      "A psicoterapia utiliza-se da interação verbal entre terapeuta e cliente para investigar a queixa do cliente, realizar intervenções diversas, avaliar a qualidade da terapia e fazer acordos sobre o processo. Porém, a…",
    category: "autoconhecimento",
    duracaoMin: [45, 75],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["autenticidade"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "A psicoterapia utiliza-se da interação verbal entre terapeuta e cliente para investigar a queixa do cliente, realizar intervenções diversas, avaliar a qualidade da terapia e fazer acordos sobre o processo. Porém, a psicoterapia não é uma mera conversa que se tem com um desconhecido. O psicólogo conta com uma série de recursos que faz da sua interação com o cliente um instrumento de cura. Com estes recursos, o psicólogo assume uma “postura de terapeuta” em algumas ocasiões, em função da intervenção que deseja fazer, do setting que busca criar, enfim. Ao mesmo tempo, a autenticidade é uma escolha válida de postura a ser assumida pelo psicólogo em outros contextos, tais como a auto revelação, aproximação com cliente e, possivelmente, quebrar com um preconceito que o cliente possa ter, que pode ser exatamente a postura terapêutica adotada pelo psicólogo. Este exercício visa discutir a funcionalidade e os usos dessas duas posturas e quais as implicações de cada um." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1o momento: traga o tema do encontro ao grupo e abra uma discussão inicial. Promova a reflexão de como cada um lida com a postura terapêutica e com a autenticidade. Perguntas disparadoras podem ser feitas para fomentar a discussão. Algumas delas podem ser:" },
      {
        type: "list",
        items: [
        "Como você divide a postura de terapeuta e pessoal no atendimento?",
        "Quantos por cento você é terapeuta e quantos por cento pessoal? Com base no que você define?",
        "Quais recursos vocês usam para montar sua postura terapêutica?",
        ],
      },
      { type: "paragraph", text: "2o momento: com base na discussão, saliente as respostas dos participantes com relação a critérios que você considerar importante na discussão. Algumas sugestões de critérios são:" },
      {
        type: "list",
        items: [
        "Predominância entre autenticidade ou postura;",
        "Como se dá a distribuição desses 2 modos na sessão (é em função do caso? Do paciente? Do contexto da sessão?)",
        "Raciocínio clínico pela adoção dessas posturas.",
        ],
      },
      { type: "paragraph", text: "3o momento: após a discussão, divida o grupo em trios para realizar um roleplay curto de atendimento. A ideia é ter um paciente, um terapeuta e um parecerista, que irá comentar o atendimento realizado. A ideia é observar como a postura terapêutica e autenticidade se expressam nos atendimentos, como são manejadas e qual o raciocínio de uso desses artifícios." },
      { type: "paragraph", text: "Em função do tempo para o roleplay e da quantidade de participantes, os atendimentos podem ter 3 a 10 minutos." },
      { type: "paragraph", text: "4o momento: Após os atendimentos serem realizados, convide os participantes para refletirem sobre os atendimentos de forma geral. Esteja atento às observações, mas saliente aquilo referente à proposta do grupo." },
      { type: "paragraph", text: "5o momento: peça um rápido feedback geral da atividade. Uma sugestão: pergunte ao grupo o que eles levam do grupo de hoje. Assim, pode-se observar se a proposta foi marcante ou não e os pontos fortes do encontro. Se não souberem dizer algo que levam, considere como um ponto fraco." },
    ],
  },
  {
    slug: "relato-da-queixa-x-manifestacao-da-queixa",
    number: 65,
    title: "Relato da queixa X manifestação da queixa",
    summary:
      "Na Terapia Analítico Funcional (uma terapia comportamental de terceira onda) há o conceito de comportamentos clinicamente relevantes (CRB’s), que são três comportamentos relacionados com a evolução do cliente em…",
    category: "relacao",
    duracaoMin: [40, 60],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "Na Terapia Analítico Funcional (uma terapia comportamental de terceira onda) há o conceito de comportamentos clinicamente relevantes (CRB’s), que são três comportamentos relacionados com a evolução do cliente em terapia. Esses comportamentos são: comportamentos que apresentam relação funcional com as queixas e que aparecem na sessão (ou seja, comportamentos ligados diretamente com a queixa do cliente); comportamentos que indicam progresso em relação aos comportamentos anteriores; e capacidade de interpretação do cliente sobre seu comportamento. Para este exercício, o primeiro CRB será utilizado. Apesar de ser uma noção da FAP, pode-se propor uma reflexão independente da abordagem, que seria: a diferença do relato da queixa VS a manifestação da queixa em sessão. Isso pode acontecer de diversas formas em sessão, e, visto que muitas queixas estão ligadas a comportamentos que podem ocorrer em diversos contextos, é importante que o psicólogo domine a sua intervenção, considerando tanto abordagem quanto habilidades terapêuticas gerais, em caso de se deparar com a manifestação da queixa na sessão. Alguns exemplos seriam: rituais obsessivos e alucinações (na psicanálise) ou a constelação do complexo (na analítica)." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1o momento: contextualize o tema do grupo (não precisa falar da FAP, vai direto) e proponha questionamentos sobre como cada participante aborda as queixas do cliente inicialmente (não dê os exemplos de como isso acontece no começo. Se isso for pedido, comece perguntando isso ao grupo para ver se há exemplos espontâneos). Algumas perguntas iniciais poderiam ser:" },
      {
        type: "list",
        items: [
        "Você já passou por algum atendimento em que a queixa do cliente não foi apenas relatada, mas sim demonstrada durante a sessão? (Ex: paciente fica ansioso falando sobre sua ansiedade, deprimido falando sobre sua depressão, agressivo ao falar de agressividade, teve algum delírio ou alucinação, crise de pânico, enfim)",
        "Ao cliente trazer uma queixa no início do processo psicoterapêutico, como você aborda a demanda? Qual seu raciocínio clínico inicial?",
        "Provavelmente surgirão respostas de exploração/anamnese, procure, então, identificar quais os critérios de investigação (histórico de surgimento da queixa, implicações surgidas disso, contextos que aparecem, hipóteses de causas, etc)",
        "Você já pensou se há diferenças em trabalhar com o cliente em contextos que a queixa se manifesta e em contexto que ele apenas relata? Faz sentido agir de modos diferentes nestes dois cenários?",
        "Como você faz/faria em cada uma dessas situações? Quais recursos vocês utilizam nesta situação?",
        "De que forma vocês acham que a queixa do cliente pode aparecer na sessão?",
        "Algumas formas: na relação diretamente com o terapeuta (ser agressivo com ele), ao falar sobre o tema (falar de ansiedade causando ansiedade), em relação a um evento mais ou menos distante temporalmente da sessão (medo de sair no final de semana ou medo de sair para encontro duas horas após a sessão), cliente chega apresentando sintoma antes da sessão (delírio ou alucinações)",
        ],
      },
      { type: "paragraph", text: "2o momento: agora, a ideia é promover o contato dos participantes com alguma dessas situações. Utilizando uma interpretação do coordenador, de um dos participantes ou algum vídeo, passe para o grupo um caso em que haja manifestação clínica da queixa trazida pelo cliente e discuta primeiro os raciocínios clínicos de cada um entre si sobre o caso de forma coletiva. Após a discussão, passe o caso novamente (se houver tempo) e pergunte se, baseado na discussão, alguém faria alguma modificação ou acréscimo em sua intervenção." },
    ],
  },
  {
    slug: "rompimento-de-vinculo",
    number: 66,
    title: "Rompimento de vínculo",
    summary:
      "Contextualização:",
    category: "relacao",
    duracaoMin: [45, 75],
    formato: ["roleplay", "discussao"],
    pessoas: "grupo",
    tags: ["vinculo"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização:" },
      { type: "paragraph", text: "Uma das dificuldades existentes na prática terapêutica é quando, por algum motivo, o terapeuta necessita romper o vínculo com o analisando. Os motivos podem ser desde ele não estar conseguindo lidar com o caso, precisar alterar a própria agenda ou acreditar que o paciente teria uma terapia mais adequada com outro terapeuta ou em outra abordagem. Independentemente disso, o terapeuta se verá em situações que deverá cortar o vínculo terapêutico. O foco deste exercício é esse." },
      { type: "paragraph", text: "Desta forma, aprender a como interromper uma terapia se torna importante por ser uma situação que muito provavelmente todo profissional terá que vivenciar. Não há como predizer a reação do analisando, que pode ser desde entender com tranquilidade até a total não aceitação da quebra desse vínculo e por isso é vital ter ferramentas para não ser pego completamente despreparado." },
      { type: "paragraph", text: "Descrição:" },
      { type: "paragraph", text: "Primeiro momento: Contextualizar o exercício, explicando a importância do desenvolvimento desse ponto como profissionais, fazendo um link ao questionar os participantes sobre qual dificuldade eles acreditam que teriam, ou que já tiveram, no que tange ao tema." },
      { type: "paragraph", text: "Segundo momento: Introduzir, junto a discussão proposta com os participantes no momento acima, um norteamento de finalização de terapia. Não há diretrizes específicas para as abordagens, cada caso é um caso e esse desligamento depende muito do profissional e do paciente." },
      { type: "paragraph", text: "Quando o terapeuta sente que não tem os conhecimentos necessários para lidar com o caso, mesmo tendo estudado muito a respeito, é ético que ele encaminhe o paciente para outro profissional. Esta postura está em concordância com o Código de Ética do Psicólogo, tópico \"Responsabilidades dos Psicólogos\", Artigo \"1º.\" ítem \"K\"." },
      { type: "paragraph", text: "\"Sugerir serviços de outros psicólogos, sempre que, por motivos justificáveis, não puderem ser continuados pelo profissional que os assumiu inicialmente, fornecendo ao seu substituto as informações necessárias à continuidade do trabalho.\"" },
      { type: "paragraph", text: "Fonte: http://www.crpsp.org.br/portal/orientacao/codigo/fr_codigo_etica_new.aspx" },
      { type: "paragraph", text: "Terceiro momento: Convidar alguém para interpretar o terapeuta que precisa interromper o vínculo da terapia na forma de um role play. O monitor que está ministrando o exercício deve interpretar o paciente, para que este não facilite a quebra do vínculo e para que se possa desenvolver as habilidades necessárias." },
      { type: "paragraph", text: "Quarto momento: Promover a discussão sobre o atendimento, e convidando os participantes a proporem intervenções com base no que surgiu nas dúvidas com a discussão." },
      { type: "paragraph", text: "O funcionamento dessa situação depende do contexto específico de cada caso. Geralmente, quando a psicóloga decide não atender mais o paciente, é importante que ela comunique sua decisão de forma ética e profissional, oferecendo alternativas para que o paciente possa dar continuidade ao seu tratamento com outro profissional." },
      { type: "paragraph", text: "Pontos a focar:" },
      { type: "paragraph", text: "1 - Houve encaminhamento para outro profissional? Dar esse suporte para o paciente, preferencialmente com mais de uma opção, é muito importante." },
      { type: "paragraph", text: "2 - O término da terapia deve ser GRADUAL. É importante que a pessoa que interprete o terapeuta apenas anuncie que a terapia terá que ser interrompida, mas que não o faça bruscamente ou de maneira imediata. É preciso que o desligamento seja paulatino." },
      { type: "paragraph", text: "Havendo tempo sobrando, o monitor pode propor mais um role play." },
    ],
  },
  {
    slug: "micro-agressoes",
    number: 67,
    title: "Micro Agressões",
    summary:
      "A relação terapêutica é essencial para que o tratamento seja efetivo para o paciente. Dessa maneira, para além das habilidades interpessoais gerais que um psicólogo precisa ter, é importante que ele se atente às…",
    category: "relacao",
    duracaoMin: [40, 60],
    formato: ["roleplay", "discussao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "paragraph", text: "A relação terapêutica é essencial para que o tratamento seja efetivo para o paciente. Dessa maneira, para além das habilidades interpessoais gerais que um psicólogo precisa ter, é importante que ele se atente às especificidades de seus pacientes (gênero, raça, religião, orientação sexual, identidade de gênero, status socioeconômico, etc) para garantir que o espaço da terapia seja um ambiente seguro em que não ocorrerá agressões, sejam elas micro ou macro, independentemente dos ideais do terapeuta." },
      { type: "paragraph", text: "Aqui, entenderemos micro agressões como comportamentos (principalmente verbais, por se tratar de um contexto terapêutico) geralmente feitos de forma inconsciente e sem malícia, mas que reproduzem preconceitos e têm efeitos negativos no sujeito, sendo esse de um grupo marginalizado - pessoas não brancas, população LGBTQIA+, pessoas com deficiências, etc." },
      { type: "paragraph", text: "A ideia deste exercício é ressaltar a importância de estar atento à possibilidade de ocorrência de micro agressões, além de desenvolver estratégias para remediar a relação terapêutica caso elas ocorram, tendo em mente que, quando essa relação é prejudicada, todo o processo terapêutico é posto em risco." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º momento: Antes do grupo se iniciar, combine com um colega de gravar um breve roleplay (10 min) em que ocorre algum tipo de micro agressão. Caso seja mais fácil, combine de realizar esse roleplay no início do grupo, em que ambos estejam presentes e conscientes que deve ocorrer alguma micro agressão." },
      { type: "paragraph", text: "2º momento: Comece o grupo introduzindo o assunto, falando apenas que será passado um vídeo de um atendimento/será feito um roleplay em que ocorre um erro que pode ferir a relação terapêutica e peça para que as pessoas fiquem atentas para identificar tal erro. Evite usar a palavra “micro agressão” para não deixar muito óbvio." },
      { type: "paragraph", text: "3º momento: Pergunte para as pessoas qual foi o erro (você pode ressaltar que é algo que fere a relação terapêutica se a resposta não aparecer muito rapidamente e, se ainda não acertarem, dê a resposta para não prolongar demais e poder adentrar na discussão, que é o foco). Uma vez que a micro agressão tenha sido identificada, puxe uma discussão sobre o que poderia ser feito para remediar a relação terapêutica e o que é importante fazer para evitar que isso ocorra em primeiro lugar." },
    ],
  },
  {
    slug: "abertura-de-sessao",
    number: 68,
    title: "Abertura de sessão",
    summary:
      "1o momento: contextualizar o tema com os participantes, enfatizando a importância da abertura não ser tão simplória. Após isso, inicie uma discussão inicial sobre as formas de abertura, perguntando àqueles que já…",
    category: "tecnica",
    duracaoMin: [30, 45],
    formato: ["discussao", "preenchimento"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: A abertura da sessão é um momento importante para preparar o terreno para todo o desenvolvimento da sessão. É nesse momento que estabelecemos o contato inicial do dia, o que pode determinar o que o cliente irá trazer e como o trará. Nesse sentido, a abertura dá um primeiro tom à sessão. Por isso, não é apenas um comprimento ou uma saudação, sendo algo que deve ser feito com uma funcionalidade e tendo ciência da repercussão que isso pode causar. Portanto, ela nunca é à toa, tendo sempre um objetivo. O propósito deste exercício é trabalhar sobre estes aspectos. Vale ressaltar que o exercício é sobre a abertura de sessão, e não de primeiro atendimento." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1o momento: contextualizar o tema com os participantes, enfatizando a importância da abertura não ser tão simplória. Após isso, inicie uma discussão inicial sobre as formas de abertura, perguntando àqueles que já atendem como abrem a sessão, e a quem não atende, como abririam. Peça que os participantes escrevam a resposta em algum lugar e guardem essa resposta escrita. Dê de 2 a 5 minutos para esta parte da atividade." },
      { type: "paragraph", text: "2o momento: Agora, peça que os participantes compartilhem suas respostas. Eles podem mandá-la escrita no chat da chamada, lendo-a em voz alta ou outro meio conveniente ao encontro. Comente as intervenções perguntando aos participantes porque abrem do jeito descrito? Quais as implicações de cada forma de abrir? Incentive a participação dos outros perguntando o que acham de cada forma de abrir. Se o grupo estiver quieto, assuma uma postura de advogado do diabo, perguntando o que cada participante faz em caso de sua forma de abrir não funcione." },
      { type: "paragraph", text: "3o momento: Juntar em trios ou quartetos e distribuir os participantes entre um cliente e dois/três terapeutas. Cada psicólogo vai abrir a sessão à sua maneira, e o paciente irá comentar como se sentiu em cada um deles, explorando sentimentos, percepções e pontos fortes e pontos fracos." },
    ],
  },
  {
    slug: "em-casa-de-ferreiro-o-espeto-e-de-pau-adaptacao-para-dupla",
    number: 69,
    title: "– Em casa de ferreiro o espeto é de pau (adaptação para dupla)",
    summary:
      "Exercício de dupla - role play.",
    category: "tecnica",
    duracaoMin: [40, 60],
    formato: ["reflexao", "discussao"],
    pessoas: "dupla",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Exercício de dupla - role play." },
      { type: "paragraph", text: "Contextualização: Os profissionais de saúde desempenham um papel crucial na promoção do bem-estar e na prestação de cuidados essenciais à saúde da população. No entanto, eles também enfrentam uma série de desafios únicos que podem impactar significativamente sua saúde mental e bem-estar." },
      { type: "paragraph", text: "Um dos principais desafios enfrentados pelos profissionais de saúde é a sobrecarga de trabalho. Longas horas de trabalho, turnos irregulares e uma carga de responsabilidades significativa podem levar à exaustão física e emocional. Além disso, a pressão para oferecer cuidados de alta qualidade em um ambiente muitas vezes estressante e sobrecarregado pode contribuir para altos níveis de estresse e ansiedade." },
      { type: "paragraph", text: "Outro desafio importante é o enfrentamento de situações traumáticas e emocionalmente desgastantes no ambiente de trabalho. Profissionais de saúde frequentemente lidam com pacientes em estado crítico, morte, doenças graves e outros eventos estressantes, o que pode levar ao desenvolvimento de sintomas de estresse pós-traumático, depressão e esgotamento emocional." },
      { type: "paragraph", text: "Além disso, os profissionais de saúde também enfrentam desafios relacionados à sua própria saúde mental, como estigma, falta de acesso a recursos de apoio e dificuldade em reconhecer e buscar ajuda para problemas de saúde mental. O estigma em torno das questões de saúde mental na comunidade médica pode levar os profissionais a evitar procurar ajuda por medo de repercussões em suas carreiras." },
      { type: "paragraph", text: "Esses desafios têm um impacto significativo na saúde mental dos profissionais de saúde, aumentando o risco de burnout, ansiedade, depressão e outras condições de saúde mental. É fundamental que os profissionais de saúde tenham acesso a recursos de apoio adequados e tenham em sua rotina atividades que promovam saúde e bem-estar." },
      { type: "paragraph", text: "Tendo isso em mente, o objetivo do exercício é provocar uma reflexão do participante sobre o que tem feito para cuidar de sua própria saúde usando como estratégia, usar o raciocínio clínico de alguém que está passando por uma situação parecida com a dele, esse exercício pode ser usado para dificuldades no âmbito do auto-cuidado; a dificuldade em seguir as orientações que dá ao seu cliente, síndrome do impostor, desenvolvimento de empatia, promoção do auto-conhecimento e da auto-compaixão, prevenção de burn-out, trabalhar limites pessoais." },
      { type: "paragraph", text: "1. Imagine que chegou a você um paciente que apresenta um quadro sintomatológico de repetição (como candidíase, amigdalite, infecção urinária, tendinite, uveíte, labirintite, gastrite, enxaqueca, ansiedade …), parte de sua demanda é que quando esse sintoma reaparece isso impacta muito sua vida profissional e não consegue trabalhar. Fazendo a anamnese do paciente você descobre que, como você, ele é profissional de saúde, e investigando mais a fundo constata que a rotina de trabalho que vocês compartilham tem o adoecido. Por isso, além do manejo clínico e tratamento para a demanda que chegou, você avalia que seria importante fazer uma intervenção pontuando como essa questão." },
      { type: "paragraph", text: "2. Que sugestões de atividades que promovem o bem-estar e poderiam auxiliar uma relação mais equilibrada com o trabalho?" },
      { type: "paragraph", text: "3. Quais dessas sugestões dadas você já experimentou colocar em prática em sua própria vida? Quais são os recursos que você usa para lidar com sua rotina de trabalho? Quais das orientações que você deu podem ser adaptadas a sua rotina e necessidade?" },
    ],
  },
  {
    slug: "montando-o-setting-dos-sonhos-setting-fisico",
    number: 70,
    title: "Montando o setting dos sonhos (setting físico)",
    summary:
      "Objetivo: Refletir sobre os elementos, objetos e especificações necessárias para que um espaço seja reconhecido como um setting terapêutico. Falar sobre a importância do espaço para oferecer um serviço de saúde. Expõe…",
    category: "tecnica",
    duracaoMin: [45, 75],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["sonhos", "setting"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Objetivo: Refletir sobre os elementos, objetos e especificações necessárias para que um espaço seja reconhecido como um setting terapêutico. Falar sobre a importância do espaço para oferecer um serviço de saúde. Expõe preferências pessoais, pode auxiliar na discriminação para pensar fatores que o profissional de saúde tem agência para modificar e intervir com mais facilidade, fator básico, elementar, estratégico e estrutural para pensar a prática profissional." },
      { type: "paragraph", text: "Exercício de grupo." },
      { type: "paragraph", text: "Contextualização: A organização do espaço em um ambiente de prestação de serviços de saúde desempenha um papel crucial na qualidade do atendimento oferecido aos pacientes. Um espaço bem-organizado não apenas facilita a eficiência operacional, mas também promove o bem-estar dos pacientes e profissionais de saúde. Um espaço bem-organizado pode:" },
      { type: "paragraph", text: "1. Promover abertura emocional e sensação de segurança do cliente o que pode ajudar no desenvolvimento do vínculo terapêutico." },
      { type: "paragraph", text: "2. Melhorar a eficiência: Um espaço organizado permite que os profissionais de saúde realizem suas tarefas de forma mais eficiente. Ter suprimentos, equipamentos e informações facilmente acessíveis significa menos tempo desperdiçado procurando por itens e mais tempo disponível para se concentrar no atendimento aos pacientes." },
      { type: "paragraph", text: "3. Criar um ambiente acolhedor: Um ambiente limpo, arrumado e bem-organizado transmite uma mensagem de cuidado e profissionalismo aos pacientes. Um espaço agradável e acolhedor pode ajudar a reduzir a ansiedade e o desconforto dos pacientes, promovendo uma experiência mais positiva durante o atendimento." },
      { type: "paragraph", text: "4. Facilitar a comunicação: Um ambiente organizado pode facilitar a comunicação eficaz entre os membros da equipe de saúde, permitindo uma colaboração mais fluida e coordenada no cuidado dos pacientes. Ter informações e recursos claramente identificados e acessíveis pode ajudar a garantir que todos estejam na mesma página e trabalhando em direção aos mesmos objetivos." },
      { type: "paragraph", text: "5. Favorecer a privacidade: Um espaço organizado pode ser projetado para garantir a privacidade dos pacientes durante as consultas e procedimentos médicos. Salas de exame bem isoladas, divisórias adequadas e sistemas de som que impedem a transmissão de sons podem ajudar a garantir que as conversas entre médico e paciente permaneçam confidenciais." },
      { type: "paragraph", text: "6. Favorecer a produtividade. É gostoso trabalhar em um lugar que atenda às nossas necessidades também. Precisamos pensar como as coisas impactam nossa qualidade de vida" },
      { type: "paragraph", text: "7. Transmitir profissionalismo: Um ambiente organizado e bem mantido é um reflexo do profissionalismo e do compromisso com a qualidade por parte dos prestadores de serviços de saúde. Pacientes e visitantes são mais propensos a confiar em uma instituição de saúde que valoriza a organização e a limpeza, criando uma imagem positiva e fortalecendo a reputação da instituição." },
      { type: "paragraph", text: "8. Facilitar a acessibilidade: Um espaço organizado é mais fácil de navegar para pacientes, visitantes e funcionários. Corredores desobstruídos, sinalização clara e layout lógico ajudam a garantir que todos possam encontrar o que precisam sem dificuldade, reduzindo o estresse e a confusão." },
      { type: "paragraph", text: "9. Promover a segurança: Um ambiente organizado é essencial para manter a segurança dos pacientes e profissionais de saúde. Áreas livres de desordem e obstáculos reduzem o risco de quedas e lesões, enquanto a disposição adequada de equipamentos e suprimentos ajuda a prevenir acidentes." },
      { type: "paragraph", text: "A organização do espaço desempenha um papel fundamental na prestação de serviços de saúde de qualidade. Ao criar um ambiente seguro, eficiente e acolhedor, os profissionais de saúde podem oferecer um atendimento mais eficaz e centrado no paciente, promovendo melhores resultados de saúde e satisfação geral." },
      { type: "paragraph", text: "Objetivo do exercício: refletir sobre requisitos, prioridades e escolhas pessoais para montar um setting terapêutico, focando na função que cada um dos objetos escolhidos tem na montagem do setting e potencialmente impactam o vínculo terapêutico." },
      { type: "paragraph", text: "Exercício:" },
      { type: "paragraph", text: "1) Sortear previamente a ordem de participação de modo aleatório." },
      { type: "paragraph", text: "2) Dar a seguinte consigna: Imagine que a Allos está passando por uma reforma, e recebemos uma sala para ser um novo consultório, e cabe a nós mobiliá-la e preenchê-la para fazer um setting terapêutico perfeito. É um privilégio e uma responsabilidade essa missão, por isso vamos levar a sério." },
      { type: "paragraph", text: "3) Com isso o facilitador convida a primeira pessoa da lista sorteada previamente, e lhe informe que ela pode levar apenas um objeto, e pergunta o que ela escolhe colocar no consultório. A cada resposta incentive o participante a dizer por que acha importante aquele objeto, incentive a participação dos demais pedindo que eles reajam ao objeto escolhido (usando o chat), se concordam ou não." },
      { type: "paragraph", text: "a. Se tiver discordâncias, incentivar discussão sobre qual deveria ser o objeto levado então." },
      { type: "paragraph", text: "b. No cenário desesperador dos participantes não estarem desenvolvendo o jogo e as reflexões, cabe ao facilitador bancar o advogado do diabo, questionando as prioridades." },
      { type: "paragraph", text: "i. <Uma colinha aqui, de tópicos de conversa se o grupo não tiver engajado na atividade: mesa de trabalho, cadeiras confortáveis, iluminação adequada, materiais de escrita, materiais de arte, materiais de leitura, travesseiros e almofadas, recursos audiovisuais, decoração acolhedora, espaço para movimento (ou seja um espaço de ausência), elementos que garantam o sigilo...>" },
      { type: "paragraph", text: "4) Seguir por algumas rodadas, aproveitando para de tempos em tempos lembrar aos participantes o que foi levado por quem e por quê." },
      { type: "paragraph", text: "a. Uma coisa interessante seria ir descrevendo essa sala para um gerador de imagens para apresentar aos participantes ao final como ficou seu setting dos sonhos." },
      { type: "paragraph", text: "5) Solicitar que eles enumerem elementos do setting de maneira geral, explicando como essas escolhas favoreceram a promoção daqueles 5 itens expostos na introdução." },
    ],
  },
  {
    slug: "montando-o-setting-perfeito-setting-fisico-variacao-1",
    number: 71,
    title: "Montando o setting perfeito (setting físico) – VARIAÇÃO 1",
    summary:
      "Objetivo: Refletir sobre os elementos, objetos e especificações necessárias para que um espaço seja reconhecido como um setting terapêutico. Falar sobre a importância da organização do espaço para oferecer um serviço…",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["setting"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Objetivo: Refletir sobre os elementos, objetos e especificações necessárias para que um espaço seja reconhecido como um setting terapêutico. Falar sobre a importância da organização do espaço para oferecer um serviço de saúde. Expõe preferências pessoais, pode auxiliar na discriminação para pensar fatores que o profissional de saúde tem agência para modificar e intervir com mais facilidade, fator básico, elementar, estratégico e estrutural para pensar a prática profissional." },
      { type: "paragraph", text: "Exercício de grupo." },
      { type: "paragraph", text: "Contextualização: A organização do espaço em um ambiente de prestação de serviços de saúde desempenha um papel crucial na qualidade do atendimento oferecido aos pacientes. Um espaço bem-organizado não apenas facilita a eficiência operacional, mas também promove o bem-estar dos pacientes e profissionais de saúde. Um espaço bem-organizado pode:" },
      { type: "paragraph", text: "1. Promover abertura emocional e sensação de segurança do cliente o que pode ajudar no desenvolvimento do vínculo terapêutico." },
      { type: "paragraph", text: "2. Melhorar a eficiência: Um espaço organizado permite que os profissionais de saúde realizem suas tarefas de forma mais eficiente. Ter suprimentos, equipamentos e informações facilmente acessíveis significa menos tempo desperdiçado procurando por itens e mais tempo disponível para se concentrar no atendimento aos pacientes." },
      { type: "paragraph", text: "3. Criar um ambiente acolhedor: Um ambiente limpo, arrumado e bem-organizado transmite uma mensagem de cuidado e profissionalismo aos pacientes. Um espaço agradável e acolhedor pode ajudar a reduzir a ansiedade e o desconforto dos pacientes, promovendo uma experiência mais positiva durante o atendimento." },
      { type: "paragraph", text: "4. Facilitar a comunicação: Um ambiente organizado pode facilitar a comunicação eficaz entre os membros da equipe de saúde, permitindo uma colaboração mais fluida e coordenada no cuidado dos pacientes. Ter informações e recursos claramente identificados e acessíveis pode ajudar a garantir que todos estejam na mesma página e trabalhando em direção aos mesmos objetivos." },
      { type: "paragraph", text: "5. Favorecer a privacidade: Um espaço organizado pode ser projetado para garantir a privacidade dos pacientes durante as consultas e procedimentos médicos. Salas de exame bem isoladas, divisórias adequadas e sistemas de som que impedem a transmissão de sons podem ajudar a garantir que as conversas entre médico e paciente permaneçam confidenciais." },
      { type: "paragraph", text: "6. Favorecer a produtividade. É gostoso trabalhar em um lugar que atenda às nossas necessidades também. Precisamos pensar como as coisas impactam nossa qualidade de vida" },
      { type: "paragraph", text: "7. Transmitir profissionalismo: Um ambiente organizado e bem mantido é um reflexo do profissionalismo e do compromisso com a qualidade por parte dos prestadores de serviços de saúde. Pacientes e visitantes são mais propensos a confiar em uma instituição de saúde que valoriza a organização e a limpeza, criando uma imagem positiva e fortalecendo a reputação da instituição." },
      { type: "paragraph", text: "8. Facilitar a acessibilidade: Um espaço organizado é mais fácil de navegar para pacientes, visitantes e funcionários. Corredores desobstruídos, sinalização clara e layout lógico ajudam a garantir que todos possam encontrar o que precisam sem dificuldade, reduzindo o estresse e a confusão." },
      { type: "paragraph", text: "9. Promover a segurança: Um ambiente organizado é essencial para manter a segurança dos pacientes e profissionais de saúde. Áreas livres de desordem e obstáculos reduzem o risco de quedas e lesões, enquanto a disposição adequada de equipamentos e suprimentos ajuda a prevenir acidentes." },
      { type: "paragraph", text: "A organização do espaço desempenha um papel fundamental na prestação de serviços de saúde de qualidade. Ao criar um ambiente seguro, eficiente e acolhedor, os profissionais de saúde podem oferecer um atendimento mais eficaz e centrado no paciente, promovendo melhores resultados de saúde e satisfação geral." },
      { type: "paragraph", text: "Objetivo do exercício: refletir sobre requisitos, prioridades e escolhas pessoais para montar um setting terapêutico, focando na função que cada um dos objetos escolhidos tem na montagem do setting e potencialmente impactam o vínculo terapêutico." },
      { type: "paragraph", text: "Dinâmica:" },
      { type: "paragraph", text: "1) A premissa é a mesma do exercício anterior. É pedido aos participantes que imaginem que seu ambiente de trabalho está sendo reformado, e que ficou com eles a responsabilidade de montar um dos consultórios. Ao invés de cada participante levar um objeto (e justificar sua escolha), a cada dois objetos acrescentados, a terceira pessoa vai receber a consigna que ela tem que obrigatoriamente retirar um dos objetos levados a sala (a que ela julga ser menos necessária)." },
      { type: "paragraph", text: "a. A lógica é a mesma, vai ser ainda mais interessante se conseguirmos estimular bastante a discussão entre os integrantes, para esse exercício dar certo, os participantes têm que entender que nesse cenário se trata de uma responsabilidade coletiva a montagem do consultório." },
      { type: "paragraph", text: "b. Incentive discussões, discordâncias e argumentos. Será que o objeto que foi colocado era realmente o mais importante? Será que o objeto que foi retirado era realmente o menos importante?" },
      { type: "paragraph", text: "2) Seguir por algumas rodadas, aproveitando para de tempos em tempos lembrar aos participantes o que foi levado por quem e por quê." },
      { type: "paragraph", text: "3) Solicitar que eles enumerem elementos do setting de maneira geral, explicando como essas escolhas favoreceram a promoção daqueles 5 itens expostos na introdução." },
    ],
  },
  {
    slug: "pensando-sobre-nosso-setting-virtual-para-grupos",
    number: 72,
    title: "Pensando sobre nosso setting virtual (para grupos)",
    summary:
      "Contextualização: A organização do espaço em um ambiente de prestação de serviços de saúde desempenha um papel crucial na qualidade do atendimento oferecido aos pacientes. Um espaço bem-organizado não apenas facilita…",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["reflexao", "discussao", "preenchimento"],
    pessoas: "grupo",
    tags: ["setting"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: A organização do espaço em um ambiente de prestação de serviços de saúde desempenha um papel crucial na qualidade do atendimento oferecido aos pacientes. Um espaço bem-organizado não apenas facilita a eficiência operacional, mas também promove o bem-estar dos pacientes e profissionais de saúde. Aqui estão algumas razões pelas quais a organização do espaço é importante:" },
      { type: "paragraph", text: "1. Promove abertura emocional e sensação de segurança do cliente o que pode ajudar no desenvolvimento do vínculo terapêutico." },
      { type: "paragraph", text: "2. Melhora a eficiência: Um espaço organizado permite que os profissionais de saúde realizem suas tarefas de forma mais eficiente. Ter suprimentos, equipamentos e informações facilmente acessíveis significa menos tempo desperdiçado procurando por itens e mais tempo disponível para se concentrar no atendimento aos pacientes." },
      { type: "paragraph", text: "3. Cria um ambiente acolhedor: Um ambiente limpo, arrumado e bem-organizado transmite uma mensagem de cuidado e profissionalismo aos pacientes. Um espaço agradável e acolhedor pode ajudar a reduzir a ansiedade e o desconforto dos pacientes, promovendo uma experiência mais positiva durante o atendimento." },
      { type: "paragraph", text: "4. Facilita a comunicação: Um ambiente organizado pode facilitar a comunicação eficaz entre os membros da equipe de saúde, permitindo uma colaboração mais fluida e coordenada no cuidado dos pacientes. Ter informações e recursos claramente identificados e acessíveis pode ajudar a garantir que todos estejam na mesma página e trabalhando em direção aos mesmos objetivos." },
      { type: "paragraph", text: "5. Favorece a privacidade: Um espaço organizado pode ser projetado para garantir a privacidade dos pacientes durante as consultas e procedimentos médicos. Salas de exame bem isoladas, divisórias adequadas e sistemas de som que impedem a transmissão de sons podem ajudar a garantir que as conversas entre médico e paciente permaneçam confidenciais." },
      { type: "paragraph", text: "6. Favorece a produtividade. É gostoso trabalhar em um lugar que atenda às nossas necessidades também. Precisamos pensar como as coisas impactam nossa qualidade de vida" },
      { type: "paragraph", text: "7. Transmite profissionalismo: Um ambiente organizado e bem mantido é um reflexo do profissionalismo e do compromisso com a qualidade por parte dos prestadores de serviços de saúde. Pacientes e visitantes são mais propensos a confiar em uma instituição de saúde que valoriza a organização e a limpeza, criando uma imagem positiva e fortalecendo a reputação da instituição." },
      { type: "heading", text: "Agora, e quando a gente estiver falando sobre um setting terapêutico virtual?", level: 3 },
      { type: "paragraph", text: "No cenário de um atendimento virtual, o profissional de saúde tem que gerenciar e gerir o espaço físico em que está, e, também, orientar o seu paciente/cliente para que ele faça a parte dele para garantir a manutenção do setting terapêuticos. Também pode ser usando para falar sobre contrato terapêutico, acordos, sobre criação e manutenção de vínculo terapêutico, responsabilidade do paciente, refletir sobre teleconsulta, investigar recursos tecnológicos e adaptação de recursos para o atendimento à distância, organização pessoal." },
      { type: "heading", text: "Dinâmica", level: 3 },
      { type: "paragraph", text: "1) Primeiro pedimos para que cada participante faça uma lista de 3 coisas que julga essencial para montar seu setting de atendimento e se preparar para o atendimento virtual. Dessa lista cada participante tem que escolher um para compartilhar com os demais participantes. Incentivar trocas entre eles, perguntar quem concorda, quem faz o mesmo, quem tem outras estratégias e afins." },
      { type: "paragraph", text: "2) No segundo momento pedir que façam o mesmo, mas agora a consiga é “escreva três orientações importantes para você dar ao seu cliente que será atendido virtualmente, escolha uma para compartilhar com o grupo”." },
      { type: "paragraph", text: "Em ambos os momentos cabe ao facilitador incentivar a participação e troca entre os participantes. Aproveite para pontuar semelhanças e diferenças entre as orientações que dá e o que ele mesmo faz pelo seu setting. Algumas perguntas interessantes:" },
      { type: "paragraph", text: "a) Perguntar como questões do setting presencial clássico foram adaptados para formar um setting virtual eficaz;" },
      { type: "paragraph", text: "b) Perguntar como essas orientações ajudam a promover aqueles itens expostos na introdução." },
      { type: "paragraph", text: "<Se o grupo não estiver participando seguem algumas sugestões para o facilitador afim de incentivar trocas e aprofundar o diálogo: orientações que um psicólogo pode oferecer aos clientes que ele atende virtualmente para garantir um setting terapêutico eficaz, parte dessas orientações ele mesmo precisa ter colocado em prática: escolha um ambiente tranquilo, silencioso e seguro para as sessões; escolha um horário que você esteja em casa ou em um lugar que pode fazer com segurança as sessões; teste suas tecnologias; opte por usar fones de ouvido; teste sua conexão com a internet; escolha um lugar confortável para sentar; pontualidade; iluminação; o que o paciente pode fazer para se preparar e diferenciar o momento de terapia de outras atividades que faz em casa ou com o uso de computador; orientar quanto limites pessoais e acordos sobre contato do paciente; oriente paciente a desligar notificações e gerenciar possíveis fontes de distração; solicitar ao paciente feedback sobre sua conexão, e qualidade de som e imagem; não gravar/solicitar que paciente não grave sem seu consentimento...>" },
    ],
  },
  {
    slug: "pensando-sobre-nosso-setting-virtual-para-grupos-variacao-1",
    number: 73,
    title: "Pensando sobre nosso setting virtual - (para grupos) VARIAÇÃO 1",
    summary:
      "Dinâmica de grupo, essa variação é pensada para otimizar tempo e participação.",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["setting"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Dinâmica de grupo, essa variação é pensada para otimizar tempo e participação." },
      { type: "paragraph", text: "Contextualização: A organização do espaço em um ambiente de prestação de serviços de saúde desempenha um papel crucial na qualidade do atendimento oferecido aos pacientes. Um espaço bem-organizado não apenas facilita a eficiência operacional, mas também promove o bem-estar dos pacientes e profissionais de saúde. Aqui estão algumas razões pelas quais a organização do espaço é importante:" },
      { type: "paragraph", text: "1. Promove abertura emocional e sensação de segurança do cliente o que pode ajudar no desenvolvimento do vínculo terapêutico." },
      { type: "paragraph", text: "2. Melhora a eficiência: Um espaço organizado permite que os profissionais de saúde realizem suas tarefas de forma mais eficiente. Ter suprimentos, equipamentos e informações facilmente acessíveis significa menos tempo desperdiçado procurando por itens e mais tempo disponível para se concentrar no atendimento aos pacientes." },
      { type: "paragraph", text: "3. Cria um ambiente acolhedor: Um ambiente limpo, arrumado e bem-organizado transmite uma mensagem de cuidado e profissionalismo aos pacientes. Um espaço agradável e acolhedor pode ajudar a reduzir a ansiedade e o desconforto dos pacientes, promovendo uma experiência mais positiva durante o atendimento." },
      { type: "paragraph", text: "4. Facilita a comunicação: Um ambiente organizado pode facilitar a comunicação eficaz entre os membros da equipe de saúde, permitindo uma colaboração mais fluida e coordenada no cuidado dos pacientes. Ter informações e recursos claramente identificados e acessíveis pode ajudar a garantir que todos estejam na mesma página e trabalhando em direção aos mesmos objetivos." },
      { type: "paragraph", text: "5. Favorece a privacidade: Um espaço organizado pode ser projetado para garantir a privacidade dos pacientes durante as consultas e procedimentos médicos. Salas de exame bem isoladas, divisórias adequadas e sistemas de som que impedem a transmissão de sons podem ajudar a garantir que as conversas entre médico e paciente permaneçam confidenciais." },
      { type: "paragraph", text: "6. Favorece a produtividade. É gostoso trabalhar em um lugar que atenda às nossas necessidades também. Precisamos pensar como as coisas impactam nossa qualidade de vida" },
      { type: "paragraph", text: "7. Transmite profissionalismo: Um ambiente organizado e bem mantido é um reflexo do profissionalismo e do compromisso com a qualidade por parte dos prestadores de serviços de saúde. Pacientes e visitantes são mais propensos a confiar em uma instituição de saúde que valoriza a organização e a limpeza, criando uma imagem positiva e fortalecendo a reputação da instituição." },
      { type: "heading", text: "Agora, e quando a gente estiver falando sobre um setting terapêutico virtual?", level: 3 },
      { type: "paragraph", text: "No cenário de um atendimento virtual, o profissional de saúde tem que gerenciar e gerir o espaço físico em que está, e, também, orientar o seu paciente/cliente para que ele faça a parte dele para garantir a manutenção do setting terapêuticos. Esse exercício tem como objetivo trabalhar estratégias para essas duas necessidades. Também pode ser usando para falar sobre contrato terapêutico, acordos, sobre criação e manutenção de vínculo terapêutico, responsabilidade do paciente, refletir sobre teleconsulta, investigar recursos tecnológicos e adaptação de recursos para o atendimento virtual, dificuldade com organização pessoal." },
      { type: "heading", text: "Dinâmica", level: 3 },
      { type: "paragraph", text: "1) Se for um grupo grande de participantes podemos dividi-los em dois grupos:" },
      { type: "paragraph", text: "Grupo A: cada participante do grupo A vai escrever em algumas palavras o que julga essencial para montar seu setting de atendimento e se preparar para o atendimento virtual. Crie um mapa léxico com as respostas – sugestão de ferramenta Mentimeter." },
      { type: "paragraph", text: "Grupo B: cada participante do grupo B vai escrever que orientações julgam importantes para dar a um paciente que vai atender virtualmente. Monte um mapa com essas orientações." },
      { type: "paragraph", text: "2) Compartilhe com todos o mapa criado pelo grupo A. E abra a roda para discussões entre os participantes quais tendências o mapa léxico aponta e o que talvez não tenha sido contemplado nesse mapa mas que alguns participantes julgam importantes. Repita essa dinâmica com o grupo B." },
      { type: "paragraph", text: "3) Componha um terceiro mapa sobrepondo grupos 2 e 3, para traçar junto com os participantes orientações e cuidados gerais para organização do setting terapêutico e a psicoterapia virtuais. Complemente e provoque o grupo com outras questões se julgar necessário. (Perguntas sugeridas: a) Perguntar como questões do setting presencial clássico foram adaptados para formar um setting virtual eficaz; b) Perguntar como essas orientações ajudam a promover aqueles itens expostos na introdução." },
    ],
  },
  {
    slug: "pensando-sobre-o-setting-virtual-adaptacao-para-individual",
    number: 74,
    title: "Pensando sobre o setting virtual (adaptação para individual).",
    summary:
      "Exercício individual (caneta e papel)",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["roleplay", "reflexao"],
    pessoas: "solo",
    tags: ["setting"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Exercício individual (caneta e papel)" },
      { type: "paragraph", text: "Contextualização: A organização do espaço em um ambiente de prestação de serviços de saúde desempenha um papel crucial na qualidade do atendimento oferecido aos pacientes. Um espaço bem-organizado não apenas facilita a eficiência operacional, mas também promove o bem-estar dos pacientes e profissionais de saúde. Aqui estão algumas razões pelas quais a organização do espaço é importante:" },
      { type: "paragraph", text: "1. Promove abertura emocional e sensação de segurança do cliente o que pode ajudar no desenvolvimento do vínculo terapêutico." },
      { type: "paragraph", text: "2. Melhora a eficiência: Um espaço organizado permite que os profissionais de saúde realizem suas tarefas de forma mais eficiente. Ter suprimentos, equipamentos e informações facilmente acessíveis significa menos tempo desperdiçado procurando por itens e mais tempo disponível para se concentrar no atendimento aos pacientes." },
      { type: "paragraph", text: "3. Cria um ambiente acolhedor: Um ambiente limpo, arrumado e bem-organizado transmite uma mensagem de cuidado e profissionalismo aos pacientes. Um espaço agradável e acolhedor pode ajudar a reduzir a ansiedade e o desconforto dos pacientes, promovendo uma experiência mais positiva durante o atendimento." },
      { type: "paragraph", text: "4. Facilita a comunicação: Um ambiente organizado pode facilitar a comunicação eficaz entre os membros da equipe de saúde, permitindo uma colaboração mais fluida e coordenada no cuidado dos pacientes. Ter informações e recursos claramente identificados e acessíveis pode ajudar a garantir que todos estejam na mesma página e trabalhando em direção aos mesmos objetivos." },
      { type: "paragraph", text: "5. Favorece a privacidade: Um espaço organizado pode ser projetado para garantir a privacidade dos pacientes durante as consultas e procedimentos médicos. Salas de exame bem isoladas, divisórias adequadas e sistemas de som que impedem a transmissão de sons podem ajudar a garantir que as conversas entre médico e paciente permaneçam confidenciais." },
      { type: "paragraph", text: "6. Favorece a produtividade. É gostoso trabalhar em um lugar que atenda às nossas necessidades também. Precisamos pensar como as coisas impactam nossa qualidade de vida" },
      { type: "paragraph", text: "7. Transmite profissionalismo: Um ambiente organizado e bem mantido é um reflexo do profissionalismo e do compromisso com a qualidade por parte dos prestadores de serviços de saúde. Pacientes e visitantes são mais propensos a confiar em uma instituição de saúde que valoriza a organização e a limpeza, criando uma imagem positiva e fortalecendo a reputação da instituição." },
      { type: "heading", text: "Agora, e quando a gente estiver falando sobre um setting terapêutico virtual?", level: 3 },
      { type: "paragraph", text: "No cenário de um atendimento virtual, o profissional de saúde tem que gerenciar e gerir o espaço físico em que está, e, também, orientar o seu paciente/cliente para que ele faça a parte dele para garantir a manutenção do setting terapêuticos. Esse exercício tem como objetivo trabalhar estratégias para essas duas necessidades. Também pode ser usando para falar sobre contrato terapêutico, acordos, sobre criação e manutenção de vínculo terapêutico, responsabilidade do paciente, refletir sobre teleconsulta, investigar recursos tecnológicos e adaptação de recursos para o atendimento virtual, dificuldade com organização pessoal." },
      { type: "paragraph", text: "Dinâmica:" },
      {
        type: "list",
        items: [
        "No cenário de um atendimento virtual, o profissional de saúde tem que gerenciar e gerir o espaço físico em que está, e, também, orientar o seu paciente/cliente para que ele faça a parte dele para garantir a manutenção do setting de atendimento. Por isso liste e reflita sobre:",
        "coisas que você faz enquanto profissional para se preparar e organizar seu setting e ambiente de trabalho de teleconsulta;",
        "orientações que podem ser dadas ao paciente/cliente para compor um ambiente adequado para a teleconsulta?",
        "há elementos e fatores que na sua opinião dificultam ou inviabilizam o atendimento via teleconsulta?",
        ],
      },
    ],
  },
  {
    slug: "identificacao-de-vieses-de-fatores-endogenos-e-exogenos-indi",
    number: 75,
    title: "Identificação de vieses de fatores endógenos e exógenos (individual)",
    summary:
      "Exercício individual. Caneta e papel.",
    category: "autoconhecimento",
    duracaoMin: [45, 75],
    formato: ["discussao"],
    pessoas: "solo",
    tags: ["vies"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Exercício individual. Caneta e papel." },
      { type: "paragraph", text: "Contextualização: O profissional de saúde… (tô com preguiça de escrever)" },
      { type: "paragraph", text: "Objetivo: Auxiliar o profissional de saúde a identificar se possui vieses sobre alguns grupos e características, e como possíveis estereótipos podem impactar sua intervenção, sua forma de se comunicar e sua prática clínica." },
      { type: "paragraph", text: "Dinâmica:" },
      {
        type: "list",
        items: [
        "Imagine que você, profissional de saúde recebe em sua clínica um paciente que relata o seguinte quadro inespecífico:",
        ],
      },
      { type: "paragraph", text: "\"Tenho me sentido um pouco estranho ultimamente, sabe? Não consigo entender muito bem o motivo. Sinto como se algo estivesse constantemente fora do lugar, mesmo quando tudo parece estar bem. Às vezes, minha mente fica tão agitada que é difícil desligar os pensamentos. E tem sido difícil também respirar direito, como se estivesse constantemente lutando por ar. Isso me deixa ainda mais preocupado. Tento me ocupar com coisas que normalmente gosto, mas parece que sempre há algo pairando sobre mim, como se estivesse esperando algo dar errado. É frustrante porque não consigo entender por que me sinto assim, mas simplesmente não consigo evitar.\"" },
      { type: "paragraph", text: "Que intervenções e orientações você daria a este paciente?" },
      {
        type: "list",
        items: [
        "Agora reflita, você mudaria sua intervenção ou suas orientações ao constatar que quem trouxe essa demanda é:",
        "um homem branco?",
        "um homem branco de 64 anos que está prestes a se aposentar?",
        "um homem branco idoso de 85 anos que mora sozinho?",
        "um homem pardo idoso de 85 que mora em uma instituição para idosos?",
        "uma mulher preta de 35 anos, mãe solo?",
        "E se fosse adolescente parda de classe média baixa de 14 anos, irmã mais velha de uma família de mãe solo?",
        "E se fosse uma mulher preta solteira de 27 imigrante?",
        "se fosse uma mulher parda de 60 que acabou de receber aposentadoria do único trabalho que já teve.",
        "um adolescente de 16 anos indigena queer",
        "uma adolescente de 14 anos com histórico de automutilação?",
        "uma jovem branca de 23 anos que está para se formar em contexto pandemico?",
        "uma mulher parda de 35 anos que tem uma doença crônica que exige cuidados constantes?",
        "adolescente filho de um casal interracial e de diferentes nacionalidades, que vai fazer intercâmbio no país natal do seu pai?",
        "Você mudaria sua intervenção se seu paciente fosse um colega de profissão?",
        "imagine outras características para esse paciente que poderia fazer você mudar ou adaptar suas orientações.",
        "Reflita sobre quais como e porque algumas dessas caracterizações geraram mudanças na sua intervenção. Há vieses ou expectativas sobre alguns desses grupos? Se sim quais e como isso impacta sua atuação?",
        ],
      },
    ],
  },
  {
    slug: "identificacao-de-vieses-de-fatores-endogenos-e-exogenos-dupl",
    number: 76,
    title: "Identificação de vieses de fatores endógenos e exógenos (dupla)",
    summary:
      "Exercício em dupla.",
    category: "autoconhecimento",
    duracaoMin: [40, 60],
    formato: ["discussao"],
    pessoas: "dupla",
    tags: ["vies"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Exercício em dupla." },
      { type: "paragraph", text: "Contextualização: (escrever)" },
      { type: "paragraph", text: "Objetivo: Auxiliar o profissional de saúde a identificar se possui vieses sobre alguns grupos e características, e como possíveis estereótipos podem impactar sua intervenção, sua forma de se comunicar e sua prática clínica." },
      { type: "paragraph", text: "Dinâmica:" },
      {
        type: "list",
        items: [
        "O primeiro participante apresenta uma demanda inespecífica, sem apresentar dados ou informações sobre paciente que trouxe essa demanda. E pede a sua dupla para fazer intervenções e orientações a partir dessa demanda.",
        "Então o participante 1 vai dar informações sobre quem trouxe essa demanda e perguntando se o participante 2 (que está no lugar de atender) mudaria algo em suas orientações e conduta. Perguntar: “algo mudaria em sua intervenção se essa demanda tivesse sido trazida por…”",
        "um homem branco de 50 anos de classe média?",
        "um homem branco idoso de 85 anos que mora sozinho?",
        "um homem pardo idoso de 85 que mora em uma instituição para idosos?",
        "uma mulher preta? E se fosse uma mulher preta imigrante?",
        "uma adolescente de 14 anos com histórico de automutilação? E se fosse uma criança de 10 anos?",
        "se seu paciente fosse um colega de profissão?",
        "Siga por algumas rodadas dando mais exemplos e diversificando possíveis pacientes.",
        "Após algumas rodadas, convida-se o participante 2 a reconhecer possíveis vieses sobre alguns grupos e como eles impactam sua clínica. O participante 1 pode compartilhar suas impressões sobre as possíveis mudanças - e se elas podem gerar um impacto positivo ou negativo do serviço oferecido. O participante 1 também identificou algum viés de sua parte, se sim quais?",
        ],
      },
    ],
  },
  {
    slug: "primeiramente-atendendo",
    number: 77,
    title: "Primeiramente Atendendo",
    summary:
      "1o momento: Reflita por um momento como é o primeiro atendimento de sua clínica. Qual a função dele? Você tem uma série de etapas para se nortear? Como você organiza o tempo em função da existência destas etapas ou…",
    category: "relacao",
    duracaoMin: [30, 45],
    formato: ["reflexao", "discussao", "preenchimento"],
    pessoas: "dupla",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: Usualmente, as universidades abordam a importância do primeiro atendimento como algo relacionado à obtenção de informações, realização do enquadre e do contrato terapêutico. Há contrapontos à esta visão, afirmando a importância de, em um primeiro atendimento, o terapeuta já realizar um aprofundamento da questão junto do cliente. Mas antes de tudo, é preciso refletir sobre as intervenções que realizamos no primeiro atendimento. De fato fazemos tudo com um motivo? Independentemente deste motivo, estamos atentos ao que o cliente está nos comunicando? O exercício busca promover esta conscientização sobre a realização do primeiro atendimento." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1o momento: Reflita por um momento como é o primeiro atendimento de sua clínica. Qual a função dele? Você tem uma série de etapas para se nortear? Como você organiza o tempo em função da existência destas etapas ou não? Você centraliza mais o primeiro atendimento em si (profissional) ou no cliente? Seu primeiro atendimento é muito diferente dos outros? Quais diferenças existem? Pense nisso por um tempo, se imaginando realizando um primeiro atendimento." },
      { type: "paragraph", text: "2o momento: junte-se a um colega e simule um 1o atendimento de 15 a 20 minutos. Tente reproduzir o que você havia imaginado como um primeiro atendimento." },
      { type: "paragraph", text: "3o momento: peça um feedback da sua dupla. Procure verificar os pontos fortes do atendimento, os pontos fracos e formas de corrigir os erros. Conte ao colega como você havia imaginado o atendimento, o seu raciocínio, a finalidade de suas intervenções e pergunte a ele se elas provocaram o efeito desejado. Por fim, pergunte se ele tinha alguma expectativa que você deixou de cumprir e (se for o caso de sua área) qual a chance deste cliente retornar uma consulta com você." },
      { type: "paragraph", text: "4o momento: anote os pontos levantados pela discussão e, com base nela, elenque os critérios imaginados no 1o momento, já realizando as eventuais correções necessárias. Pegue agora isto e reflita: o quão diferente ficou do imaginado? Qual foi sua principal dificuldade? Isso é algo que pode ser superado mais teoricamente ou praticamente? Dê a cada ponto a ser desenvolvido uma nota de 1 a 5, sendo que mais perto de 1 significa que pode desenvolver isso de forma relaxada e mais perto de 5 significa que um grande empenho precisa ser feito em busca de aprimorar o ponto." },
      { type: "paragraph", text: "5o momento: inverta de posição com o colega e repita o 3o momento com ele." },
    ],
  },
  {
    slug: "note-e-adote",
    number: 78,
    title: "Note e Adote",
    summary:
      "1o momento: Peça para a IA do app gere um caso clínico OU pegue um caso clínico de algum contexto (livro, episódio de série de Psicologia, filme) OU peça a um amigo que simule/descreva um caos OU crie um caso do zero…",
    category: "tecnica",
    duracaoMin: [45, 75],
    formato: ["roleplay", "reflexao", "preenchimento"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: De modo geral, muitos terapeutas realizam anotações dos casos que estão acompanhando, seja durante o atendimento ou após o mesmo. As anotações, via de regra, são ferramentas que auxiliam não só a reter as informações mas também refletir sobre o caso, ter insights, redefinir hipóteses, elaborar diagnósticos diferenciais e manter a interpretação de caso pautada no caso e não apenas em fantasias. Porém, cada terapeuta funciona de modo único e pode se organizar com anotações de formas diferentes. O exercício busca aproximar o terapeuta do seu modo de anotação predileto e colocá-lo em contato com outros modos de registro que podem eventualmente serem mais confortáveis ao terapeuta ou auxiliá-lo a aprimorar o registro." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1o momento: Peça para a IA do app gere um caso clínico OU pegue um caso clínico de algum contexto (livro, episódio de série de Psicologia, filme) OU peça a um amigo que simule/descreva um caos OU crie um caso do zero e considere que estas informações foram obtidas em uma sessão que não seja nem a primeira e nem a última. Se atenha às informações presentes nele e veja aquilo que está claro e aquilo que ainda precisa ser melhor investigado. Se achar necessário, complete o caso com algumas informações falsas, mas mantenha pontos de investigação em aberto também." },
      { type: "paragraph", text: "2o momento: Faça anotações da sessão com base nas informações obtidas do modo que preferir/esteja acostumado. Agora, refaça as anotações, mas de um modo diferente. Faça este procedimento duas vezes, de modo que você tenha 3 formas de anotações diferentes. Não se atenha agora a ter anotações de um modo formal necessariamente nas 3 formas. Explore jeitos diferentes de se anotar e varie quais informações você irá anotar. Seguem algumas sugestões:" },
      {
        type: "list",
        items: [
        "Relatório de atendimento em texto corrido;",
        "Tópicos de anotação, sem grau de hierarquia em subtópicos;",
        "Tópicos de anotação, com grau de hierarquia em subtópicos;",
        "Divisão da folha verticalmente, deixando de um lado o tópico maior e do outro informações deste tópico;",
        "Poema;",
        "Texto estilo diário, em que predominam os pensamentos, sentimentos, impressões e opiniões antes das informações do cliente;",
        "Balões de texto ligados por setas e linhas, estilo mapa mental;",
        "Brainstorming da sessão, anotação livre;",
        "Transposição de trechos do caso para interpretação segundo a teoria;",
        "Descrição do caso como roteiro de cena, com rubricas indicando os gestos do cliente e as falas aquilo que foi dito;",
        "Transformação do caso em um conto, dividindo os evento em sessão início, desenvolvimento, clímax e resolução;",
        "anotação com critérios essenciais (assunto, intervenção, reação, melhora/piora/estabilidade e finalização) minimalista com limite de 3 palavras por critério utilizado;",
        "Escrever em caderno;",
        "Escrever em computador (digitando);",
        "Escrever em computador (com caneta digital);",
        "Escrever em post-its;",
        ],
      },
      { type: "paragraph", text: "3o momento: mande as 3 formas para a IA/um dar um feedback e reflita sobre o que ela lhe devolveu. Os pontos fortes/fracos foram semelhantes entre as 3 formas? Ou foram diferentes? Uma forma lhe facilitou trazer mais algo do que outra? Após isso, qual foi a forma mais confortável? Qual foi a mais desafiadora?" },
      { type: "paragraph", text: "4o momento: observe o que lhe foi devolvido e, caso seu modelo mais gostado tenha sido o primeiro, tente aprimorá-lo a partir dos segundos. Procure usar os modelos para superar seus déficits atuais, incluindo formas de registro dos outros modelos ao seu. Caso tenha se decidido por outro, refaça o exercício em outro momento e aprimore o novo método escolhido com base em outras formas de anotação." },
    ],
  },
  {
    slug: "quando-voce-esta",
    number: 79,
    title: "Quando Você Está?",
    summary:
      "1o momento: Peça para a IA do app gere um caso clínico OU pegue um caso clínico de algum contexto (livro, episódio de série de Psicologia, filme) OU peça a um amigo que simule/descreva um caos OU crie um caso do zero…",
    category: "tecnica",
    duracaoMin: [30, 45],
    formato: ["roleplay", "preenchimento"],
    pessoas: "dupla",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: No senso comum, a Psicanálise é tida por investigar o passado dos pacientes enquanto a TCC se coloca mais no seu presente. Embora saibamos que isto não seja tão literal quanto é postulado, fato é que investigar passado e presente do cliente são caminhos viáveis e possíveis na clínica. Há clínicos que possuem uma preferência por seguir um dos caminhos (preferência oriunda de vários fatores). Este exercício ajudará o terapeuta a investigar se ele possui uma preferência ou se pauta sua investigação mais no caso que é apresentado." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1o momento: Peça para a IA do app gere um caso clínico OU pegue um caso clínico de algum contexto (livro, episódio de série de Psicologia, filme) OU peça a um amigo que simule/descreva um caos OU crie um caso do zero e considere que estas informações foram obtidas em uma sessão que não seja nem a primeira e nem a última. Com base nisso, elabore algumas perguntas que você considera serem cruciais para a evolução do caso. Essas perguntas não são para serem feitas ao paciente literalmente, mas sim orientar a condução do caso. Tente fazer de 5 a 9 perguntas." },
      { type: "paragraph", text: "2o momento: Leia agora as suas perguntas e reflita: suas perguntas estão mais voltadas à origem ou ao prognóstico do quadro? Elas direcionam mais para a investigação das causas ou para medidas e resoluções a partir da situação atual? Observe se há uma distribuição maior ou menor entre elas para um dos tipos. Quantas são voltadas ao passado? E quantas ao futuro? 3o momento: Reflita agora se estas perguntas foram adequadas à situação de seu paciente. Junte-se com uma dupla e mostre para ela tanto o caso clínico quanto as questões elaboradas e peça para que ela avalie se elas sustentam uma investigação compatível com o caso. Isto pode te ajudar a observar se o seu olhar clínico está em dia, mas também se a predominância de perguntas voltadas ao futuro ou ao passado estão se dando em função de uma boa análise do caso ou uma tendência do clínico. Caso as perguntas não estejam compatíveis, é mais provável que haja uma tendência do clínico em fazer um tipo de pergunta. Caso estejam, não há como inferir se foi feita uma boa análise de caso ou se foi coincidência." },
      { type: "paragraph", text: "Independentemente disso, com base no feedback, reflita: o caso apresentado parece ser mais compatível com um dos dois tipos de pergunta? Por que você listou as perguntas escolhidas? Como você acha que esta investigação vai promover melhoras no cliente? Após responder a essas perguntas, quais seriam, de modo genérico, os próximos passos do tratamento? O cliente, em alguma medida, apresentou preferência por algum caminho de investigação neste sentido?" },
      { type: "paragraph", text: "4o momento: repita o exercício novamente após pelo menos duas semanas da realização inicial e observe se a distribuição das perguntas se mantém ou não. Utilize novos casos clínicos para tal. O importante agora é observar se isto é um padrão de comportamento seu ou se foi algo que se deu em função do caso. Assim, isso lhe ajudará a entender como seu raciocínio clínico está funcionando, qual o seu alcance e limitações, os pontos a se trabalhar e a melhor maneira de aplicar sua análise de caso." },
    ],
  },
  {
    slug: "parabola-os-cegos-e-o-elefante",
    number: 80,
    title: "Parábola Os Cegos e o Elefante",
    summary:
      "Individual.",
    category: "tecnica",
    duracaoMin: [45, 75],
    formato: ["reflexao", "discussao"],
    pessoas: "solo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Individual." },
      { type: "paragraph", text: "Objetivo: Refletir sobre a necessidade de desenvolver um olhar/escuta interdisciplinar sobre o caso e pensar em estratégias de comunicação entre os profissionais de saúde. A proposta é usar a parábola Os cegos e o Elefante (conto da mitologia hindu), como uma analogia para entendermos a dinâmica de um atendimento multidisciplinar, assim como os cegos sábios, profissionais de diferentes especialidades podem concorrer entre si e ficar com um olhar fragmentado, perdendo noção da complexidade e da totalidade do quadro de saúde do seu paciente." },
      { type: "paragraph", text: "Contextualização: Um repertório comunicacional compartilhado é importante para profissionais de saúde, assim eles podem ser compreendidos na sua especialidade, demanda e urgência. Em casos complexos as intervenções médicas podem entrar em conflito e interações medicamentosas podem não gerar impacto ou até mesmo agravar a saúde do paciente. Nesse sentido, é fundamental escrever prontuários e se comunicar de forma a garantir o mínimo de compreensão por parte de um profissional que pertence a outra área de atuação. Para além disso, é importante compreender a função de cada profissional de saúde, quais são suas respectivas atribuições e competências a fim de que se torne visível sua relevância e que seu valor passe a ser reconhecido em meio a outros profissionais." },
      {
        type: "list",
        items: [
        "Leia a parábola dos cegos e o elefante. “OS CEGOS E O ELEFANTE",
        ],
      },
      { type: "paragraph", text: "“Numa cidade da Índia viviam sete sábios cegos. Como seus conselhos eram sempre excelentes, todas as pessoas que tinham problemas consultavam-nos. Embora fossem amigos, havia uma certa rivalidade entre eles, que, de vez em quando, discutiam sobre o qual seria o mais sábio. Certa noite, depois de muito conversarem acerca da verdade da vida e não chegarem a um acordo, o sétimo sábio ficou tão aborrecido que resolveu ir morar sozinho numa caverna da montanha. Disse aos companheiros:" },
      { type: "paragraph", text: "- Somos cegos para que possamos ouvir e compreender melhor do que as outras pessoas a verdade da vida. E, em vez de aconselhar os necessitados, vocês ficam aí brigando, como se quisessem ganhar uma competição. Não agüento mais! Vou-me embora." },
      { type: "paragraph", text: "No dia seguinte, chegou à cidade um comerciante montado num elefante imenso. Os cegos jamais haviam tocado nesse animal e correram para a rua ao encontro dele. O primeiro sábio apalpou a barriga do animal e declarou:" },
      { type: "paragraph", text: "- Trata-se de um ser gigantesco e muito forte! Posso tocar os seus músculos e eles não se movem; parecem paredes." },
      { type: "paragraph", text: "- Que bobagem! - disse o segundo sábio, tocando na presa do elefante - Este animal é pontudo como uma lança, uma arma de guerra." },
      { type: "paragraph", text: "- Ambos se enganam - retrucou o terceiro sábio, que apertava a tromba do elefante - Este animal é idêntico a uma serpente! Mas não morde, porque não tem dentes na boca. É uma cobra mansa e macia." },
      {
        type: "list",
        items: [
        "Vocês estão totalmente alucinados! - gritou o quinto sábio, que mexia as orelhas do elefante - Este animal não se parece com nenhum outro. Seus movimentos são ondeantes, como se seu corpo fosse uma enorme cortina ambulante.",
        "Vejam só! Todos vocês, mas todos mesmos, estão completamente errados! - irritou-se o sexto sábio, tocando a pequena cauda do elefante - Este animal é como uma rocha com uma cordinha presa no corpo. Posso até me pendurar nele.",
        ],
      },
      { type: "paragraph", text: "E assim ficaram horas debatendo, aos gritos, os seis sábios." },
      { type: "paragraph", text: "Até que o sétimo sábio cego, o que agora habitava a montanha, apareceu conduzido por uma criança. Ouvindo a discussão, pediu ao menino que desenhasse no chão a figura do elefante. Quando tateou os contornos do desenho, percebeu que todos os sábios estavam certos e enganados ao mesmo tempo. Agradeceu ao menino e afirmou:" },
      { type: "paragraph", text: "- Assim os homens se comportam diante da verdade. Pegam apenas uma parte, pensam que é o todo, e continuam tolos!" },
      { type: "paragraph", text: "História do folclore Hindu.”" },
      {
        type: "list",
        items: [
        "Após a leitura do conto reflita sobre o paradoxo, o que faz o que todos os sábios estarem certos e errados ao mesmo tempo? Que analogias podem ser feitas a partir desse conto que pode nos ajudar a entender a dinâmica de atendimentos em uma equipe multiprofissional? Que atitude, enquanto profissional de saúde, podemos ter para não cair no mesmo engano que os sábios cegos?",
        ],
      },
    ],
  },
  {
    slug: "controle-do-terapeuta-x-controle-compartilhado",
    number: 81,
    title: "Controle do Terapeuta X Controle Compartilhado",
    summary:
      "1o momento: contextualize o tema e bote a cena inicial do primeiro episódio do caso Haidée da série Sessão de Terapia pra galera assistir.",
    category: "tecnica",
    duracaoMin: [40, 60],
    formato: ["reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["controle"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: Como decidir entre uma condução mais centrada no cliente ou mais no profissional? Isso determina pois não só ganha ou perde cliente, mas define intervenções, raciocínio, manejo, enfim. Exemplo: sugestão de percepção X afirmação de percepção. Em geral, não é pra ser só de um jeito ou só de outro, mas um predomínio é comum e orienta melhor a progressão do caso." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1o momento: contextualize o tema e bote a cena inicial do primeiro episódio do caso Haidée da série Sessão de Terapia pra galera assistir." },
      { type: "paragraph", text: "2o momento: discussão do que foi mostrado. Caso o povo esteja quieto, faça algumas perguntas:" },
      {
        type: "list",
        items: [
        "A intervenção do psicólogo foi uma boa intervenção? Em que sentido?",
        "O efeito provocado em Haidee aparentemente foi positivo. Vocês teriam ido por este caminho, por um semelhante ou por outro completamente diferente?",
        "Esta intervenção prioriza o cliente ou o terapeuta? Por que?",
        ],
      },
      { type: "paragraph", text: "3o momento: após a discussão, pergunte aos participantes quem entre eles prefere conduzir a sessão mais em função das demandas e ritmo do cliente e quem prefere ser mais condutor neste sentido. Caso a distribuição esteja igual, peça para os participantes façam uma lista de critérios/motivos pelos quais escolhem o polo pensado." },
      { type: "paragraph", text: "Caso haja uma predominância em um dos contextos, peça para que a maioria em questão faça uma autocrítica sobre este modelo, suas limitações e pontos fracos. Após isso, peça para que a minoria comente como consegue lidar com as dificuldades levantadas com base no seu modelo e como eles acreditam que seria possível trabalhar no método do outro." },
      { type: "paragraph", text: "4o momento: Após a reflexão no momento 3, separe os participantes em duas ligações e peça para que cada subgrupo elenque problemas do modelo contrário. Ex: se escolho ter um controle maior do caso, pensarei em problemas de se atender mais às demandas do cliente." },
    ],
  },
  {
    slug: "conscientizacao-dos-sentimentos",
    number: 82,
    title: "Conscientização dos Sentimentos",
    summary:
      "Esse exercício tem como objetivo desenvolver a capacidade de identificar, interpretar e gerenciar as emoções que surgem na prática clínica, promovendo uma maior autopercepção e eficácia terapêutica.",
    category: "tecnica",
    duracaoMin: [60, 90],
    formato: ["roleplay", "discussao", "preenchimento"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Contextualização" },
      { type: "heading", text: "Potencialidades das Emoções na Clínica", level: 3 },
      {
        type: "list",
        items: [
        "Fonte de Informação: As emoções podem fornecer valiosas informações sobre a dinâmica do paciente e da relação terapêutica. Sentimentos como empatia, compaixão e mesmo desconforto podem revelar aspectos importantes do estado emocional do paciente e do progresso terapêutico.",
        "Facilitador de Empatia: Sentir genuinamente as emoções do paciente pode facilitar uma conexão mais profunda e autêntica, promovendo um ambiente de confiança e segurança, essencial para o processo terapêutico.",
        "Orientação Intuitiva: As emoções podem guiar o clínico em suas intervenções. Muitas vezes, intuições e impressões clínicas surgem de uma base emocional que, quando interpretada corretamente, pode levar a insights significativos e decisões terapêuticas eficazes.",
        ],
      },
      { type: "heading", text: "Problemas das Emoções na Clínica", level: 3 },
      {
        type: "list",
        items: [
        "Contratransferência: Sentimentos intensos ou não reconhecidos podem levar à contratransferência, onde o clínico reage aos próprios sentimentos em vez de responder às necessidades do paciente. Isso pode distorcer a percepção do caso e prejudicar a intervenção terapêutica.",
        "Perda de Objetividade: Emoções não gerenciadas podem comprometer a neutralidade e a objetividade do clínico, dificultando a tomada de decisões baseada em critérios técnicos e éticos.",
        "Burnout: A exposição contínua a emoções intensas pode levar ao esgotamento emocional, afetando a saúde mental do clínico e a qualidade do atendimento prestado.",
        ],
      },
      { type: "paragraph", text: "Esse exercício tem como objetivo desenvolver a capacidade de identificar, interpretar e gerenciar as emoções que surgem na prática clínica, promovendo uma maior autopercepção e eficácia terapêutica." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º Momento: Durante ou após uma sessão clínica, reserve um momento para identificar claramente qualquer emoção ou sentimento que tenha surgido em relação ao paciente. Anote essa emoção em um diário clínico." },
      { type: "paragraph", text: "Caso não atenda ainda, pense em emoções possíveis (raiva, desencorajamento, atração, desprezo, hostilidade, culpa, pena, culpabilização, nojo, tédio…)" },
      { type: "paragraph", text: "2º Momento: Interprete a emoção quanto á:" },
      { type: "paragraph", text: "Gênese: Pergunte-se sobre a origem dessa emoção. Ela parece ser uma resposta intuitiva ao que o paciente compartilhou, ou é uma projeção de suas próprias experiências e sentimentos?" },
      { type: "paragraph", text: "Função: Qual o papel dessa emoção no contexto do atendimento? Ela está fornecendo uma pista sobre a dinâmica do paciente ou sobre a relação terapêutica?" },
      { type: "paragraph", text: "Relação Terapêutica: Como essa emoção afeta sua percepção e interação com o paciente? Há algum elemento de contratransferência presente?" },
      { type: "paragraph", text: "3º Momento: Pensar quanto às possibilidades e exprimir essa emoção. Como ela pode ser integrada no trabalho clínico?" },
      { type: "paragraph", text: "No contexto específico do caso, exprimir essa emoção teria um efeito produtivo ou negativo?" },
      {
        type: "list",
        items: [
        "Se positivo, de que forma posso exprimir essa emoção? Em que situação seria negativa?",
        "Se negativo, em que situação seria positivo exprimi-la? Como?",
        "Como você pode usar esse insight para guiar suas próximas intervenções ou abordagens com o paciente?",
        ],
      },
      { type: "paragraph", text: "4º Momento: Revisão e Ajuste" },
      { type: "paragraph", text: "Após a próxima sessão, revise suas anotações e avalie se houve alguma mudança na dinâmica ou nos resultados terapêuticos." },
      { type: "paragraph", text: "Ajuste suas estratégias conforme necessário, mantendo a prática contínua de identificação, interpretação e gerenciamento das emoções." },
    ],
  },
  {
    slug: "refletindo-sobre-o-contrato-terapeutico",
    number: 83,
    title: "Refletindo sobre o contrato terapêutico",
    summary:
      "Contextualização: O contrato terapêutico firmado entre o terapeuta e seu cliente/paciente pode ser um recurso muito importante para organização, fortalecimento e promoção do vínculo terapêutico e do próprio processo.…",
    category: "operacional",
    duracaoMin: [40, 60],
    formato: ["discussao"],
    pessoas: "grupo",
    tags: ["contrato"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: O contrato terapêutico firmado entre o terapeuta e seu cliente/paciente pode ser um recurso muito importante para organização, fortalecimento e promoção do vínculo terapêutico e do próprio processo. Para muitos o contrato dá um primeiro parâmetro sobre o que faz um espaço ser um espaço terapêutico, o que é esperado o que é permitido, dá segurança para consolidação de um vínculo com o profissional e pode auxiliar para que o cliente se implique no seu processo de cuidado." },
      { type: "paragraph", text: "Dinâmica: Solicitar que os participantes respondam em um link do menti a seguinte pergunta: O que julga ser essencial em um contrato terapêutico? Dar espaço para 3 respostas e orientar para que duas das respostas sejam algo básico que julgam que os demais colegas vão colocar também e na terceira resposta colocar algo que eles julgam menos óbvio para se ter no contrato terapêutico, mas que valorizam estar no contrato." },
      { type: "paragraph", text: "Perguntas norteadoras: Perguntar sobre:" },
      { type: "paragraph", text: "a) como foi o contato com o contrato terapêutico durante a sua formação;" },
      { type: "paragraph", text: "b) se fazem o contrato terapêutico é uma prática em sua clínica particular;" },
      { type: "paragraph", text: "c) perguntar como eles fazem e em que momento eles o fazem;" },
      { type: "paragraph", text: "d) que adaptações fizeram no contexto da terapia virtual;" },
      { type: "paragraph", text: "e) como o contrato pode ser utilizado como recurso terapêutico." },
      { type: "paragraph", text: "Discussão: abordar de elemento em elemento citado na nuvem léxica que o grupo montou perguntando ao grupo como eles abordariam cada tópico levantado, e qual a importância dele ser acordado com o cliente/paciente." },
    ],
  },
  {
    slug: "dando-match-nos-objetivos",
    number: 84,
    title: "Dando match nos objetivos",
    summary:
      "1o momento: Sozinho ou em dupla, estabeleça o objetivo para cinco casos diferentes com base na queixa principal do caso. Seguem exemplos para pautar o exercício (OBS: caso esteja em dupla, estabeleça os objetivos…",
    category: "tecnica",
    duracaoMin: [40, 60],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "dupla",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: Todo atendimento tem um objetivo. A grande questão é o como ele é estabelecido. Ele pode ser mais ou menos compartilhado com o cliente, sendo que este tem maior ou menor poder de decisão e consciência sobre o processo, em função de cada clínico. Este exercício visa refletir sobre como o terapeuta estabelece os objetivos em sua clínica e como isso pode ser modificado." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1o momento: Sozinho ou em dupla, estabeleça o objetivo para cinco casos diferentes com base na queixa principal do caso. Seguem exemplos para pautar o exercício (OBS: caso esteja em dupla, estabeleça os objetivos individualmente, e depois compartilhe com a dupla e veja os que ela estabeleceu):" },
      {
        type: "list",
        items: [
        "uma mãe que está triste com a mudança de casa de seu filho que se formou na faculdade.",
        "um paciente psicótico com delírio e alucinações persecutórias.",
        "uma criança que apresenta comportamento agressivo com os pares na escola, mas não em casa.",
        "uma mulher que está em um relacionamento tóxico (pelas características descritas por ela).",
        "um homem polonês que possui um negócio muito bem sucedido no Brasil mas que sente falta de sua terra de origem.",
        ],
      },
      { type: "paragraph", text: "2o momento: individualmente, observe suas respostas e pense no quão estruturados ou abertos estão os seus objetivos. Eles já trazem consigo um planejamento pré definido ou exigem que o caminho seja construído? Ele propõe que o cliente interprete mais seu caso ou esteja em uma posição mais passiva perante o terapeuta? Este objetivo é mais geral ou bem específico? Ele pode ser mais ou menos reformulado ao longo do caso? Anote estas conclusões e, caso esteja em dupla, compartilhe com o seu colega e observe as diferenças e semelhanças entre as produções." },
      { type: "paragraph", text: "3o momento: após essa autoanálise, pegue os três objetivos que foram os melhores elaborados na sua opinião e refaça-os do 0, tentando ser o mais diferente possível do original. Após isso, compare as duas produções e reflita se há algo que pode ser acrescentado no original ou se ele está de fato bem elaborado. Isso permitirá que o terapeuta observe suas preferências em definição de objetivos as limitações desta, além de pistas de como aprimorar seu modelo." },
    ],
  },
  {
    slug: "leitura-de-paciente",
    number: 85,
    title: "Leitura de paciente",
    summary:
      "1o momento: Passe um caso clínico que seja relacionado à proposta do exercício (Sessão 1 caso Chiara, da série Sessão de Terapia, temporada 4, 05:09-13:25) e peça para que os participantes descrevam a paciente com 3…",
    category: "relacao",
    duracaoMin: [30, 45],
    formato: ["reflexao", "discussao", "preenchimento"],
    pessoas: "grupo",
    tags: ["leitura"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: Em alguns contextos, o que o paciente afirma diferencia daquilo que ele apresenta corporalmente, ou seu discurso está desalinhado do sentimento carregado por ele. Portanto, há contextos em que não podemos nos prender ao que o paciente nos relata verbalmente. O exercício visa promover pratica de contornar a resistência do paciente e acessar os conteúdos expressos mas não verbalizados." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1o momento: Passe um caso clínico que seja relacionado à proposta do exercício (Sessão 1 caso Chiara, da série Sessão de Terapia, temporada 4, 05:09-13:25) e peça para que os participantes descrevam a paciente com 3 palavras e enviem estas 3 palavras em um mentimeter, no chat ou oralmente. - 12 minutos" },
      { type: "paragraph", text: "2o momento: Discuta com os participantes as palavras levantadas. Caso haja predominância de um termo ou sinônimos, pergunte o motivo de tais palavras terem surgido primeiramente e, após isso, pergunte a das menos frequentes. Caso não tenha havido repetições, pergunte que os participantes expliquem uma de suas palavras e para que digam um termo usado que não entenderam o porquê. - 20-30 minutos" },
      { type: "paragraph", text: "3o momento: a partir desta discussão, puxe para o tema do grupo, de que há várias formas de ler e compreender aquilo que o paciente lhe diz. Porém, devemos sempre nos ater quando o paciente está com alguma coisa por trás de seu discurso verbal. Não necessariamente vamos trazer isso em sessão de imediato (como o Caio), mas considerar isso nas intervenções. Verificar se isto fica claro a partir do caso. - 05-10 minutos." },
      { type: "paragraph", text: "4o momento: Retome agora as palavras utilizada para descrever a Chiara e estimula os participantes a refletirem: o que pautou sua escolha? Se isso já tiver sido muito discutido com os participantes no momento 2, retome as estratégias e raciocínio abordados e hipotetize outras possíveis para identificar o conteúdo trazido pelo paciente na sessão - 10-20 minutos." },
    ],
  },
  {
    slug: "auto-reflexao-sobre-honorarios-e-valores",
    number: 86,
    title: "Auto-reflexão sobre honorários e valores",
    summary:
      "Exercício individual, papel e caneta.",
    category: "autoconhecimento",
    duracaoMin: [45, 75],
    formato: ["roleplay", "reflexao", "supervisao"],
    pessoas: "supervisor",
    tags: ["honorarios"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Exercício individual, papel e caneta." },
      { type: "paragraph", text: "Contextualização: as profissões de cuidado e saúde por vezes são desvalorizadas e é comum diversos fatores influenciam e dificultam o processo de auto-avaliação do profissional de saúde para o estabelecimento de um honorário compatível com o serviço oferecido, como por exemplo desconhecimento do valor do próprio trabalho (dificuldade em avaliar o valor do serviço oferecido, e falta de parâmetros objetivos para estabelecimento de uma linha de base e comparação com outros profissionais, pressão do mercado e falta de autonomia profissional (concorrência, planos de saúde e convênios que estabelecem valores), falta de treinamento em negócios (desconhecimento do mercado de trabalho, desconhecimento das regras fiscais, desconhecimento do dinheiro investido para manutenção dos espaços e recursos utilizados para o serviço), percepção dos pacientes (expectativas dos pacientes, elementos clínicos - como transferência), questões culturais (para algumas pessoas falar sobre dinheiro e cobrança pode vir atrelado com valores negativos e a própria valorização do serviço pode mudar a depender da região), economia e acessibilidade (o público, a região que o serviço é oferecido pode mudar a possibilidade de pagamento por parte do cliente/paciente" },
      { type: "paragraph", text: "Objetivo:" },
      { type: "paragraph", text: "Refletir sobre a importância da valorização do próprio trabalho e desenvolver uma abordagem justa e transparente para a cobrança de honorários." },
      { type: "paragraph", text: "Passo 1: Auto-valor & valor agregado ao seus serviços" },
      {
        type: "list",
        items: [
        "Faça uma lista das suas habilidades, qualificações e experiências que tornam seu serviço único.",
        "Pergunte a si mesmo: Qual é o valor que eu proporciono aos meus pacientes? Sugestão: pense em termos de impacto na saúde e bem-estar deles.",
        "Considere o seu tempo e esforço: O quanto de tempo (contato atendimento, supervisão, estudo de caso, atualização de prontuário, reuniões com equipe de saúde, tempo de deslocamento) você investe para oferecer um serviço de qualidade aos seus clientes/pacientes?",
        "Pesquise os honorários de outros profissionais de saúde na sua área de atuação e região, depois compare os seus serviços, experiências e qualificações com os padrões do mercado.",
        ],
      },
      { type: "paragraph", text: "Passo 2:" },
      {
        type: "list",
        items: [
        "Reflita sobre como você equilibra seu desejo de ajudar os outros com a necessidade de ser justamente compensado pelo seu trabalho.",
        "Pergunte a si mesmo: Estou confortável com os valores que estou cobrando? Eles refletem justamente o meu esforço e expertise?",
        "Há alguma situação em que faz sentido para você flexibilizar o valor cobrado? Se sim qual/quais?",
        ],
      },
      { type: "paragraph", text: "Passo 3: Comunicação" },
      {
        type: "list",
        items: [
        "Como você se sente ao falar sobre seus honorários? Em caso de perceber que se sente envergonhado, constrangido ou sentimentos afins, você sente que isso impacta na sua forma de comunicá-los aos seus clientes?",
        "Pense nas estratégias e como você comunica seus honorários atualmente, pense em estratégias para deixar essa comunicação mais clara e objetiva.",
        ],
      },
      { type: "paragraph", text: "Passo 4: Avaliação e Ajustes" },
      {
        type: "list",
        items: [
        "Quais elementos podem impactar sua cobrança e demandar ajustes no valor do atendimento (exemplo: conta a inflação, mudanças no mercado e evolução das suas qualificações, mudanças na vida do seu cliente/paciente).",
        "Solicite feedback de colegas e pacientes sobre a percepção deles em relação ao valor do seu trabalho e aos honorários cobrados, há algum elemento que seus colegas coloca para essa avaliação que você esqueceu, eles priorizam de forma diferente algum elemento de análise para estipular este valor?",
        ],
      },
      { type: "paragraph", text: "Conclusão:" },
      { type: "paragraph", text: "Dedique um tempo para escrever suas reflexões sobre cada passo. Isso ajudará a consolidar seus pensamentos e desenvolver uma prática mais consciente e justa em relação à cobrança dos seus honorários. Repita sempre que possível e atualize suas percepções." },
    ],
  },
  {
    slug: "desenvolvendo-confianca-na-proposta-de-tratamento",
    number: 87,
    title: "Desenvolvendo Confiança na Proposta de Tratamento",
    summary:
      "Aprimorar a habilidade de transmitir confiança ao apresentar uma proposta de tratamento, essencial para estabelecer credibilidade e ganhar a confiança dos pacientes.",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["reflexao", "discussao"],
    pessoas: "dupla",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Objetivo" },
      { type: "paragraph", text: "Aprimorar a habilidade de transmitir confiança ao apresentar uma proposta de tratamento, essencial para estabelecer credibilidade e ganhar a confiança dos pacientes." },
      { type: "heading", text: "Fase 1: Preparação (Individual)", level: 3 },
      { type: "paragraph", text: "1.Escolha de um Caso Clínico:" },
      { type: "paragraph", text: "- O médico em formação deve escolher um caso clínico relevante, real ou fictício, que inclua um diagnóstico claro e uma proposta de tratamento detalhada." },
      { type: "paragraph", text: "- Ele deve se familiarizar profundamente com o caso, incluindo possíveis alternativas de tratamento, riscos, benefícios e a evidência científica que apoia a proposta escolhida." },
      { type: "paragraph", text: "2. Estruturação da Apresentação:" },
      { type: "paragraph", text: "- Peça ao médico para estruturar a apresentação da proposta de tratamento, organizando as informações de forma clara e lógica. Eles devem planejar como introduzir o diagnóstico, explicar o tratamento proposto, e responder a possíveis perguntas ou preocupações do paciente." },
      { type: "paragraph", text: "- É importante que incluam uma parte onde expressam empatia e se mostram disponíveis para discussões adicionais, o que ajuda a passar confiança e tranquilidade ao paciente." },
      { type: "heading", text: "Fase 2: Prática (Individual ou em Dupla)", level: 3 },
      { type: "paragraph", text: "Individual:" },
      { type: "paragraph", text: "- O médico deve praticar a apresentação da proposta de tratamento em voz alta, como se estivesse falando diretamente com o paciente. (se preferir, poderá gravar o processo para avaliar)" },
      { type: "paragraph", text: "- Durante a prática, o foco deve ser em manter uma postura confiante, utilizar uma linguagem clara e assertiva, e mostrar segurança nas informações transmitidas." },
      { type: "paragraph", text: "- Feedback Pessoal: Após a prática, o médico deve se autoavaliar utilizando um checklist, observando aspectos como clareza, assertividade, empatia e a capacidade de responder a objeções de forma confiante." },
      { type: "paragraph", text: "Em Dupla:" },
      { type: "paragraph", text: "- Um dos médicos apresenta a proposta de tratamento, enquanto o outro assume o papel de observador e oferece feedback." },
      { type: "paragraph", text: "- O observador deve avaliar a clareza da comunicação, a confiança transmitida, a linguagem corporal e a capacidade de lidar com perguntas ou dúvidas." },
      { type: "paragraph", text: "- Feedback e Reflexão: Após a apresentação, o observador fornece feedback detalhado e construtivo. Em seguida, os papéis são trocados, permitindo que ambos os médicos pratiquem e recebam feedback." },
      { type: "heading", text: "Fase 3: Refinamento e Repetição", level: 3 },
      { type: "paragraph", text: "Refinamento:" },
      { type: "paragraph", text: "- Com base no feedback recebido (ou na autoavaliação), o médico deve fazer ajustes na sua abordagem, seja na escolha das palavras, na postura corporal, ou na forma de abordar perguntas difíceis." },
      { type: "paragraph", text: "-Repetição:" },
      { type: "paragraph", text: "- Repetir o exercício, incorporando as melhorias sugeridas, até que se sinta confortável e confiante ao apresentar a proposta de tratamento." },
    ],
  },
  {
    slug: "escrita-e-comunicacao-clara-da-proposta-de-tratamento",
    number: 88,
    title: "Escrita e Comunicação Clara da Proposta de Tratamento",
    summary:
      "Objetivo:",
    category: "operacional",
    duracaoMin: [60, 90],
    formato: ["reflexao", "discussao"],
    pessoas: "dupla",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Objetivo:" },
      { type: "paragraph", text: "Aprimorar a habilidade de transmitir confiança através da comunicação clara e estruturada ao propor um tratamento, utilizando tanto a linguagem escrita quanto a oral." },
      { type: "heading", text: "Fase 1: Redação da Proposta de Tratamento (Individual)", level: 3 },
      { type: "paragraph", text: "1. Seleção de um Caso Clínico:" },
      { type: "paragraph", text: "- O médico em formação escolhe ou recebe um caso clínico com um diagnóstico claro e múltiplas opções de tratamento." },
      { type: "paragraph", text: "2. Escrita da Proposta:" },
      { type: "paragraph", text: "- O médico deve redigir uma proposta de tratamento detalhada, incluindo:" },
      { type: "paragraph", text: "- Introdução ao Diagnóstico: Explicação clara e concisa do diagnóstico, usando uma linguagem que seria compreensível para o paciente." },
      { type: "paragraph", text: "- Descrição do Tratamento: Explicação do tratamento recomendado, incluindo como ele funciona, os benefícios esperados, potenciais riscos e efeitos colaterais." },
      { type: "paragraph", text: "- Justificativa: Racional por trás da escolha desse tratamento específico, citando evidências científicas ou experiências clínicas, se aplicável." },
      { type: "paragraph", text: "- Empatia e Disponibilidade: Demonstração de empatia pelas preocupações do paciente e disponibilidade para discutir alternativas ou responder a perguntas." },
      { type: "paragraph", text: "3. Revisão:" },
      { type: "paragraph", text: "- Após escrever a proposta, o médico deve revisar o texto para garantir que a linguagem seja clara, a estrutura lógica, e que transmita confiança no tratamento proposto." },
      { type: "paragraph", text: "- Autoavaliação: O médico pode utilizar uma checklist para avaliar aspectos como clareza, assertividade, e a presença de uma comunicação empática." },
      { type: "heading", text: "Fase 2: Comunicação da Proposta (Individual ou em Dupla)", level: 3 },
      { type: "paragraph", text: "- Leitura em Voz Alta (Individual):" },
      { type: "paragraph", text: "- O médico deve ler a proposta em voz alta, prestando atenção ao tom de voz, entonação e ritmo, garantindo que cada parte da proposta seja transmitida de forma confiante e clara." },
      { type: "paragraph", text: "- Autoavaliação: Depois de ler em voz alta, o médico deve refletir sobre como se sentiu ao comunicar a proposta. Ele pode gravar essa leitura e ouvi-la para identificar áreas de melhoria." },
      { type: "paragraph", text: "- Troca de Propostas (Em Dupla):" },
      { type: "paragraph", text: "- Em duplas, os médicos trocam suas propostas escritas. Cada um lê a proposta do outro e fornece feedback sobre a clareza, a confiança transmitida, e a empatia na comunicação." },
      { type: "paragraph", text: "- Discussão: Os médicos discutem o feedback recebido, destacando pontos fortes e áreas para melhorar na transmissão da proposta de tratamento." },
      { type: "heading", text: "Fase 3: Ajustes e Repetição", level: 3 },
      { type: "paragraph", text: "- Refinamento:" },
      { type: "paragraph", text: "- Com base no feedback recebido, o médico deve ajustar a proposta escrita e praticar novamente a leitura em voz alta." },
      { type: "paragraph", text: "- Repetição:" },
      { type: "paragraph", text: "- Repetir o exercício até que o médico se sinta seguro na clareza e na confiança ao comunicar a proposta de tratamento, tanto escrita quanto oralmente." },
    ],
  },
  {
    slug: "visualizar-e-melhor",
    number: 89,
    title: "Visualizar é Melhor",
    summary:
      "Ajudar médicos em formação a utilizar ferramentas visuais, como gráficos e tabelas, para demonstrar de forma clara e objetiva o progresso do paciente ao longo do tratamento.",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["discussao"],
    pessoas: "dupla",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Objetivo" },
      { type: "paragraph", text: "Ajudar médicos em formação a utilizar ferramentas visuais, como gráficos e tabelas, para demonstrar de forma clara e objetiva o progresso do paciente ao longo do tratamento." },
      { type: "heading", text: "Fase 1: Preparação (Individual)", level: 3 },
      { type: "paragraph", text: "1. Seleção de Dados Clínicos:" },
      { type: "paragraph", text: "- Os médicos devem selecionar um conjunto de dados clínicos reais ou fictícios relacionados a um paciente (por exemplo, níveis de glicose, pressão arterial, resultados de exames, etc.)." },
      { type: "paragraph", text: "2. Criação de Gráficos:" },
      { type: "paragraph", text: "- Usando esses dados, os médicos devem criar gráficos que mostrem a evolução do paciente ao longo do tempo. Podem ser gráficos de linha, barras, ou até tabelas comparativas." },
      { type: "paragraph", text: "- Incorporação de Comentários: Além do gráfico, os médicos devem preparar uma breve explicação sobre o que os dados mostram, destacando o progresso e a importância de manter o tratamento." },
      { type: "heading", text: "Fase 2: Apresentação e Feedback (Em Dupla)", level: 3 },
      { type: "paragraph", text: "Apresentação:" },
      { type: "paragraph", text: "- Os médicos se reúnem em duplas ou em grupos pequenos para apresentar seus gráficos e explicações." },
      { type: "paragraph", text: "- Cada médico deve praticar como apresentaria esses dados ao paciente, usando uma linguagem simples e acessível, enquanto reforça os aspectos positivos do progresso." },
      { type: "paragraph", text: "Feedback:" },
      { type: "paragraph", text: "- Após cada apresentação, os colegas devem fornecer feedback construtivo, focando na clareza da apresentação, na eficácia do uso dos gráficos, e na capacidade de transmitir confiança e motivação ao paciente." },
      { type: "heading", text: "Fase 3: Refinamento e Repetição", level: 3 },
      { type: "paragraph", text: "Ajustes:" },
      { type: "paragraph", text: "- Com base no feedback, os médicos ajustam seus gráficos e a forma de apresentação." },
      { type: "paragraph", text: "Repetição:" },
      { type: "paragraph", text: "- Os médicos podem repetir o exercício, agora focando em aprimorar a comunicação e a clareza dos gráficos." },
    ],
  },
  {
    slug: "ser-ou-nao-ser-horizontal-diretivo-eis-a-questao",
    number: 90,
    title: "Ser ou não ser (horizontal/diretivo)? Eis a questão",
    summary:
      "Aprimorar a capacidade do profissional de optar assertivamente por uma postura mais diretiva ou horizontal, a depender da necessidade do caso.",
    category: "tecnica",
    duracaoMin: [45, 75],
    formato: ["discussao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Objetivo" },
      { type: "paragraph", text: "Aprimorar a capacidade do profissional de optar assertivamente por uma postura mais diretiva ou horizontal, a depender da necessidade do caso." },
      { type: "paragraph", text: "1º passo: É exibido um texto “autodescritivo” de um paciente em uma consulta. A partir das informações comentadas, o clínico deverá descrever se deveria adotar uma postura mais diretiva ou mais horizontalizada e justificar a decisão." },
      { type: "paragraph", text: "(Uma opção é pedir para o chat criar casos a partir de premissas, mas por motivo de “tempo para implementar, deixei 2 prontos.)" },
      { type: "heading", text: "Caso 1", level: 3 },
      { type: "paragraph", text: "“Tenho 35 anos e venho lidando com dores nas costas que começaram há cerca de seis meses. A dor é mais intensa no final do dia, especialmente depois de passar horas sentado no escritório. Sou gerente em uma empresa de tecnologia, então meu trabalho é muito sedentário e estressante. Raramente consigo fazer pausas para me alongar, e mesmo quando consigo, a dor não alivia. Já tentei várias coisas por conta própria. Comecei a fazer alongamentos que encontrei na internet, mas não vi muita melhora. Recentemente, um amigo me recomendou acupuntura, dizendo que funcionou para ele. Outro colega falou sobre terapia quiroprática, mas me avisou que pode ser arriscado se não for feito por alguém experiente. Também li sobre fisioterapia, que parece ser uma opção mais segura, mas estou preocupado porque ouvi que pode levar muito tempo para ver resultados, e eu realmente não tenho esse tempo. Estou estressado, preocupado com o impacto disso no meu trabalho e na minha vida pessoal.”" },
      { type: "heading", text: "Caso 2", level: 3 },
      { type: "paragraph", text: "\"Eu tenho 28 anos e fui diagnosticada com uma condição crônica autoimune há cerca de dois anos. Desde então, tenho lidado com vários sintomas que vão e vêm, como fadiga, dores articulares e alguns problemas digestivos. Já consultei diferentes médicos e especialistas, e cada um me deu uma opinião um pouco diferente sobre como gerenciar minha condição. Alguns sugeriram medicamentos fortes, outros recomendaram mudanças drásticas na minha dieta, e eu até ouvi falar de terapias alternativas que parecem promissoras, mas não estou certa de sua eficácia." },
      { type: "paragraph", text: "Eu realmente quero encontrar um equilíbrio entre gerenciar meus sintomas e manter uma boa qualidade de vida. Estou disposta a explorar opções, mas preciso de ajuda para entender as implicações de cada uma delas. Considero tanto o tratamento convencional quanto as terapias alternativas\"" },
      { type: "paragraph", text: "2º passo: Discussão da escolha feita. É explorado como a postura escolhida e uma postura contrária poderiam afetar no desenvolvimento do caso." },
      { type: "heading", text: "Caso 1", level: 3 },
      { type: "paragraph", text: "Neste cenário, o paciente apresenta um quadro de incerteza considerável, tanto sobre a natureza de sua condição quanto sobre os tratamentos disponíveis. Ele já explorou várias opções de tratamento por conta própria, mas a falta de resultados claros e o receio de potenciais riscos o deixaram confuso e indeciso. Além disso, o estresse relacionado ao trabalho e à vida pessoal contribui para essa incerteza, amplificando a necessidade de uma intervenção clara e orientadora." },
      { type: "paragraph", text: "Uma postura mais diretiva é indicada porque o paciente precisa de uma orientação firme e estruturada para navegar pelas opções disponíveis. O clínico pode adotar uma abordagem mais ativa ao avaliar detalhadamente o quadro clínico do paciente, descartando ou confirmando as preocupações que ele tem sobre os diferentes métodos. Ao oferecer um plano de tratamento claro e justificado, que leve em conta o estilo de vida ocupado do paciente e suas limitações de tempo, o clínico pode ajudar a reduzir a ansiedade e aumentar a confiança do paciente no tratamento." },
      { type: "paragraph", text: "Uma postura horizontal, que envolve uma abordagem mais colaborativa e menos diretiva, pode ser prejudicial neste caso específico porque o paciente já se encontra em um estado de incerteza e confusão. Ele enfrenta dificuldades em decidir qual tratamento seguir devido à sobrecarga de informações e ao medo dos possíveis riscos. Se o clínico adotar uma postura horizontal, pode deixar o paciente ainda mais indeciso, sem a orientação clara que ele precisa para avançar. Isso pode resultar em atrasos no início do tratamento, aumento da ansiedade e possível agravamento da condição, já que o paciente pode continuar a postergar a tomada de decisões ou seguir caminhos menos eficazes por conta própria." },
      { type: "paragraph", text: "Entretanto, é crucial que o clínico mantenha uma postura adaptável ao longo do tratamento, reconhecendo que a abordagem escolhida inicialmente pode precisar de ajustes conforme o caso evolui. Se a postura diretiva se mostrar ineficaz ou se o paciente começar a demonstrar resistência ou desconforto com essa abordagem, o clínico deve estar preparado para transitar para uma postura mais horizontal. Esse ajuste pode incluir envolver mais o paciente na tomada de decisões ou adaptar o plano de tratamento com base em feedback contínuo. A adaptabilidade assegura que o tratamento permaneça centrado nas necessidades do paciente e nas melhores práticas clínicas, garantindo uma abordagem dinâmica e personalizada para alcançar os melhores resultados possíveis." },
      { type: "heading", text: "Caso 2", level: 3 },
      { type: "paragraph", text: "Neste caso, a paciente aparenta desejar ser participante ativa nas decisões relacionadas ao seu tratamento, uma vez que disse buscar um equilíbrio entre sintoma e tratamento, e considerar abordagens alternativas, indicando que um tom mais colaborativo seria mais adequado. Ela já teve várias interações com diferentes profissionais e está ciente das diversas opções de tratamento disponíveis, mas precisa de ajuda para navegar por essas opções de forma a encontrar um equilíbrio que atenda às suas necessidades e preferências pessoais." },
      { type: "paragraph", text: "Uma postura horizontal permite que o clínico atue como um facilitador, ajudando a paciente a entender as implicações de cada abordagem de tratamento sem impor uma única solução. Esse tipo de postura respeita a autonomia da paciente e reconhece a complexidade de sua condição crônica, que pode exigir ajustes contínuos e uma abordagem mais personalizada. Ao envolver a paciente ativamente no processo de decisão, o clínico também promove maior adesão ao tratamento, já que as escolhas feitas serão alinhadas com as expectativas e os valores pessoais da paciente." },
      { type: "paragraph", text: "Adotar uma postura diretiva neste caso pode ser menos eficaz porque a paciente valoriza a autonomia e deseja explorar diferentes caminhos de tratamento, incluindo opções menos convencionais. Se o clínico adotar uma postura diretiva e impuser um plano de tratamento sem considerar as preferências e preocupações da paciente, isso pode levar a resistência, insatisfação com o cuidado recebido e, potencialmente, a não adesão ao tratamento. A abordagem mais colaborativa permite que a paciente se sinta ouvida e respeitada, o que é essencial para o sucesso do manejo de uma condição crônica ao longo do tempo." },
      { type: "paragraph", text: "Como no caso anterior, a postura clínica deve ser adaptável. Se, ao longo do tratamento, a paciente demonstrar dificuldade em tomar decisões ou expressar insegurança diante das opções disponíveis, o clínico pode ajustar a abordagem para fornecer mais orientação e estrutura, se necessário. Essa flexibilidade garante que o tratamento permaneça centrado nas necessidades da paciente, oferecendo suporte mais diretivo quando necessário, mas sempre mantendo o espaço para a colaboração e a participação ativa da paciente." },
    ],
  },
  {
    slug: "reconhecendo-pequenas-conquistas",
    number: 91,
    title: "Reconhecendo Pequenas Conquistas",
    summary:
      "Capacitar médicos a usar a narrativa para comunicar o progresso do paciente, destacando pequenas conquistas e motivando a continuidade do tratamento.",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["reflexao", "discussao", "preenchimento"],
    pessoas: "solo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Objetivo" },
      { type: "paragraph", text: "Capacitar médicos a usar a narrativa para comunicar o progresso do paciente, destacando pequenas conquistas e motivando a continuidade do tratamento." },
      { type: "heading", text: "Fase 1: Redação da Narrativa (Individual)", level: 3 },
      { type: "paragraph", text: "1. Escolha de um Caso Clínico:" },
      { type: "paragraph", text: "- Os médicos devem escolher ou ser apresentados a um caso clínico em que o paciente fez progresso, mesmo que seja modesto." },
      { type: "paragraph", text: "2. Construção da Narrativa" },
      { type: "paragraph", text: "- Os médicos devem escrever uma narrativa que conte a história do progresso do paciente, focando em:" },
      { type: "paragraph", text: "- Início do Tratamento: Como era a condição do paciente no início." },
      { type: "paragraph", text: "- Pequenas Conquistas: Quais pequenas, mas importantes, melhorias o paciente alcançou ao longo do tempo." },
      { type: "paragraph", text: "- Impacto Positivo: Como essas conquistas impactaram a vida do paciente, mesmo que de forma sutil." },
      { type: "paragraph", text: "- Encorajamento: Reforçando os pontos positivos do tratamento até o momento e os possíveis pontos positivos futuros para motivar o paciente a continuidade do tratamento." },
      { type: "paragraph", text: "- Além disso, é fundamental que o usuário descreva os recursos utilizados para contar a narrativa; fala, texto, diagramas, mapas mentais," },
      { type: "heading", text: "Fase 2: Discussão em Grupo", level: 3 },
      { type: "paragraph", text: "- Compartilhamento da Narrativa:" },
      { type: "paragraph", text: "- Em pequenos grupos, os médicos compartilham suas narrativas, lendo-as em voz alta ou discutindo os principais pontos." },
      { type: "paragraph", text: "- Feedback e Reflexão:" },
      { type: "paragraph", text: "- O grupo oferece feedback sobre a clareza, empatia e eficácia da narrativa em transmitir o progresso e motivar o paciente." },
      { type: "paragraph", text: "- Discussão sobre Estratégias" },
      { type: "paragraph", text: "- Os médicos discutem diferentes formas de criar e comunicar essas narrativas, considerando a personalidade e necessidades de cada paciente." },
      { type: "heading", text: "Fase 3: Aplicação e Prática Contínua", level: 3 },
      { type: "paragraph", text: "- Aplicação:" },
      { type: "paragraph", text: "- Os médicos aplicam a técnica de narrativa com o chatbot, utilizando a abordagem discutida durante o exercício." },
      { type: "paragraph", text: "- Prática Contínua:" },
      { type: "paragraph", text: "- Este exercício pode ser repetido periodicamente, com diferentes casos e narrativas, para reforçar a competência." },
    ],
  },
  {
    slug: "estruturacao-do-encerramento-de-atendimento",
    number: 92,
    title: "Estruturação do Encerramento de Atendimento",
    summary:
      "Objetivo:",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["reflexao"],
    pessoas: "dupla",
    tags: ["encerramento"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Objetivo:" },
      { type: "paragraph", text: "Ajudar médicos em formação a estruturar e conduzir um encerramento de atendimento eficaz, garantindo que o paciente saia com clareza sobre os próximos passos e se sinta valorizado." },
      { type: "heading", text: "Fase 1: Planejamento do Encerramento (Individual)", level: 3 },
      { type: "paragraph", text: "1. Seleção de um Caso Clínico:" },
      { type: "paragraph", text: "- O médico escolhe ou recebe um caso clínico com um diagnóstico estabelecido e um plano de tratamento em andamento." },
      { type: "paragraph", text: "2. Estruturação do Encerramento:" },
      { type: "paragraph", text: "- O médico deve planejar o encerramento do atendimento, focando em:" },
      { type: "paragraph", text: "- Resumo do Atendimento: Breve recapitulação dos principais pontos discutidos durante a consulta." },
      { type: "paragraph", text: "- Próximos Passos: Explicação clara sobre o que o paciente deve fazer a seguir (exames, medicações, retorno)." },
      { type: "paragraph", text: "- Confirmação de Compreensão: Perguntas para garantir que o paciente entendeu as orientações e se sente confortável com o plano." },
      { type: "paragraph", text: "- Abertura para Dúvidas: Espaço para que o paciente faça perguntas ou expresse preocupações." },
      { type: "paragraph", text: "- Encerramento: Uma fala positiva, incluindo uma reafirmação do compromisso com o bem-estar do paciente e seu prognóstico." },
      { type: "heading", text: "Fase 2: Prática e Autoavaliação (Individual ou em Dupla)", level: 3 },
      { type: "paragraph", text: "Prática Individual:" },
      { type: "paragraph", text: "- O médico deve simular o encerramento de atendimento em voz alta, como se estivesse falando diretamente com o paciente (se preferir, poderá gravar)." },
      { type: "paragraph", text: "- Autoavaliação: Após a simulação, o médico deve refletir sobre sua performance, avaliando a clareza, a empatia e a eficácia em transmitir as informações." },
      { type: "paragraph", text: "Prática em Dupla:" },
      { type: "paragraph", text: "- Em duplas, um médico assume o papel de médico e o outro o de paciente. O médico” pratica o encerramento do atendimento conforme planejado." },
      { type: "paragraph", text: "- Feedback: Após a prática, o “paciente” oferece feedback sobre a clareza, o acolhimento e a eficácia do encerramento. Os papeis são então invertidos." },
      { type: "heading", text: "Fase 3: Refinamento e Repetição", level: 3 },
      { type: "paragraph", text: "- Ajustes:" },
      { type: "paragraph", text: "- Com base no feedback ou na autoavaliação, o médico ajusta sua abordagem e repete o exercício." },
    ],
  },
  {
    slug: "complicacoes-no-encerramento",
    number: 93,
    title: "Complicações no Encerramento",
    summary:
      "Objetivo:",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["reflexao", "discussao"],
    pessoas: "dupla",
    tags: ["encerramento"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Objetivo:" },
      { type: "paragraph", text: "Capacitar médicos a lidarem com situações desafiadoras durante o encerramento do atendimento, como pacientes resistentes, com dúvidas complexas, ou que precisam de suporte adicional." },
      { type: "heading", text: "Fase 1: Identificação de Situações Desafiadoras (Individual)", level: 3 },
      { type: "paragraph", text: "1. Reflexão sobre Experiências Passadas:" },
      { type: "paragraph", text: "- Peça ao médico para refletir ou imaginar situações em que o encerramento de um atendimento foi particularmente desafiador (por exemplo, paciente com resistência ao tratamento, dificuldade em entender as orientações, ou em estado emocional alterado)." },
      { type: "paragraph", text: "2. Planejamento de Respostas:" },
      { type: "paragraph", text: "- O médico deve planejar respostas para essas situações desafiadoras, considerando:" },
      { type: "paragraph", text: "- Técnicas de Comunicação: Como ajustar a linguagem para ser mais clara ou empática." },
      { type: "paragraph", text: "- Gerenciamento Emocional: Como lidar com pacientes que estão ansiosos, tristes ou zangados." },
      { type: "paragraph", text: "- Refirmação de Compromisso: Como reforçar o apoio ao paciente e a confiança no plano de tratamento." },
      { type: "heading", text: "Fase 2: Simulação e Feedback (Em Dupla)", level: 3 },
      { type: "paragraph", text: "- Simulação de Encerramento:" },
      { type: "paragraph", text: "- Em duplas, um médico assume o papel de médico e o outro de paciente com um comportamento desafiador. O “médico” pratica o encerramento do atendimento, aplicando as estratégias planejadas." },
      { type: "paragraph", text: "- Feedback: Após a simulação, o “paciente” oferece feedback sobre como se sentiu em relação ao encerramento, focando na clareza, acolhimento e resolução das suas dúvidas ou preocupações." },
      { type: "paragraph", text: "- Discussão: Os médicos discutem juntos sobre o que funcionou bem e o que poderia ser melhorado." },
    ],
  },
  {
    slug: "estabelecendo-o-processo",
    number: 94,
    title: "Estabelecendo o Processo",
    summary:
      "Ajudar médicos em formação a estabelecer objetivos consensuais com os pacientes no início do tratamento, garantindo que as metas sejam claras, realistas e alinhadas com as expectativas do paciente.",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["reflexao", "discussao"],
    pessoas: "dupla",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Objetivo" },
      { type: "paragraph", text: "Ajudar médicos em formação a estabelecer objetivos consensuais com os pacientes no início do tratamento, garantindo que as metas sejam claras, realistas e alinhadas com as expectativas do paciente." },
      { type: "heading", text: "Fase 1: Preparação e Planejamento (Individual)", level: 3 },
      { type: "paragraph", text: "1. Estudo de Caso Clínico:" },
      { type: "paragraph", text: "- Forneça um caso clínico fictício ou real que inclua um diagnóstico claro e uma proposta de plano de tratamento." },
      { type: "paragraph", text: "- O caso deve incluir informações sobre o paciente, como histórico médico, preocupações principais e expectativas em relação ao tratamento." },
      { type: "paragraph", text: "2. Identificação de Objetivos:" },
      { type: "paragraph", text: "- O médico deve revisar o caso e identificar possíveis objetivos de tratamento. Estes podem incluir metas relacionadas à melhoria dos sintomas, qualidade de vida, ou cumprimento de certos marcos de saúde." },
      { type: "paragraph", text: "- O médico deve considerar como esses objetivos podem ser apresentados de forma a envolver o paciente na formulação e adesão." },
      { type: "heading", text: "Fase 2: Simulação de Estabelecimento de Objetivos (Em Dupla)", level: 3 },
      { type: "paragraph", text: "- Simulação de Consulta:" },
      { type: "paragraph", text: "- Em duplas, um médico assume o papel de médico e o outro o papel de paciente. A consulta deve se concentrar em discutir o plano de tratamento e estabelecer objetivos consensuais." },
      { type: "paragraph", text: "- Diálogo de Estabelecimento de Objetivos:" },
      { type: "paragraph", text: "- O médico deve iniciar a conversa explicando a importância de definir objetivos claros para o tratamento." },
      { type: "paragraph", text: "- Utilizar técnicas de entrevista motivacional para explorar as prioridades e expectativas do paciente." },
      { type: "paragraph", text: "- Trabalhar com o paciente para definir objetivos específicos, mensuráveis, alcançáveis, relevantes e com prazo determinado ." },
      { type: "paragraph", text: "- Garantir que o paciente compreenda e concorde com os objetivos propostos e ajustar conforme necessário." },
      { type: "paragraph", text: "- Feedback e Reflexão:" },
      { type: "paragraph", text: "- Após a simulação, o “paciente” fornece feedback sobre a clareza da comunicação, a capacidade do médico de envolver o paciente na definição dos objetivos e a adequação dos objetivos estabelecidos." },
      { type: "paragraph", text: "- **Discussão em Grupo:** Se realizado em grupo, discutir as abordagens usadas e como diferentes técnicas podem ser aplicadas para estabelecer objetivos consensuais." },
      { type: "heading", text: "Fase 3: Desenvolvimento e Refinamento (Individual)", level: 3 },
      { type: "paragraph", text: "- Refinamento:" },
      { type: "paragraph", text: "- Com base no feedback recebido, o médico deve revisar e ajustar sua abordagem para o estabelecimento de objetivos." },
      { type: "paragraph", text: "- Refinar a técnica para assegurar que os objetivos sejam bem alinhados com as necessidades e expectativas do paciente." },
    ],
  },
  {
    slug: "leitura-de-caso-e-definicao-de-tratamento-sugestao-para-os-g",
    number: 95,
    title: "Leitura de caso e definição de tratamento (SUGESTÃO PARA OS GRUPOS DE APRIMORAMENTO)",
    summary:
      "1º momento: Contextualizar o tema com os participantes, questionando sobre quais critérios eles utilizam para definir finalidade do tratamento. Pode utilizar o menti, ou o chat da chamada, mas pedir para os…",
    category: "operacional",
    duracaoMin: [40, 60],
    formato: ["roleplay", "discussao"],
    pessoas: "grupo",
    tags: ["leitura"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: Definir os objetivos do tratamento não é um crime para o processo, visto que o cliente/paciente chega aos nossos consultórios com alguma queixa ou algo que ele precise elaborar. Nesse sentido, cabe a nós profissionais saber conduzir o caso estando atento às variáveis do paciente. No entanto, é importante salientar que os objetivos do tratamento não precisam ser estáticos, eles podem mudar ao longo do tempo conforme o paciente for trazendo cada vez mais informações, uma vez que, em determinados casos, a queixa principal pouco se manifesta em um primeiro atendimento. Logo, pode ser que a finalidade do tratamento não seja totalmente definida já no primeiro atendimento, é importante que tanto o profissional quanto o cliente/paciente trabalhem de forma colaborativa e ativa para determinação de objetivos." },
      { type: "paragraph", text: "Objetivos: Dessa forma, o objetivo da atividade é fazer como o profissional leia o caso e como ele pode definir a finalidade do tratamento, em quais momentos do atendimento e criticar quais métodos estamos utilizando se para o caso em específico, ele será eficaz, mesmo com apontamentos científicos relevantes." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º momento: Contextualizar o tema com os participantes, questionando sobre quais critérios eles utilizam para definir finalidade do tratamento. Pode utilizar o menti, ou o chat da chamada, mas pedir para os participantes fazerem em palavras como tópicos ou pequenas frases. Iniciando a discussão. Dê de 2 a 5 minutos para esta parte da atividade." },
      { type: "paragraph", text: "2º momento: Agora, peça que os participantes compartilhem suas respostas. Eles podem mandá-la escrita no chat da chamada, lendo-a em voz alta ou outro meio conveniente ao encontro. Comece a fazer questionamentos aos participantes sobre o momento de definir finalidade? Será que isso pode mudar? Quem define a finalidade do tratamento? Como é feita?" },
      { type: "paragraph", text: "3º momento: Nesse momento será apresentado um recorte de um caso de um paciente. O organizador irá ler em voz alta e dividir os participantes em grupos de 3 a 4 pessoas. Abrindo novas salas em vídeo chamada e dê 10 minutos no máximo para eles lerem e discutirem e voltarem para a sala principal. Eles devem voltar respondendo a seguinte pergunta: Como vocês combinariam a intervenção(finalidade) neste caso?" },
      { type: "paragraph", text: "“Olá, eu sou Pedro (nome fictício), tenho 25 anos, solteiro, nascido em São Paulo e resido no município da Campinas, eu vou contar a minha história." },
      { type: "paragraph", text: "Eu sou estúpido, mais ou menos feio e eu não sei como estou na faculdade. Meus pais dizem que não sou bom, eles não sabem por que eu vim para este mundo." },
      { type: "paragraph", text: "Eu sou um idiota, não tenho ideias, apenas gasto o dinheiro sem pensar, fico sem dinheiro rápido e gasto dos outros, e a única coisa que sei fazer é jogar futebol. Em resumo, eu sou uma droga, não deveria ter nascido. ”" },
      { type: "paragraph", text: "4º momento: Ao retornarem para a sala principal comecem a discussão do que cada grupo entrou em acordo ou desacordo das finalidades do atendimento começando a questionar se possíveis intervenções, de acordo com a finalidade, poderiam ser eficazes questionando os critérios." },
      { type: "paragraph", text: "Como recomendação para intervenções muitos imediatistas, leitura do Modelo Transteórico de estágios de mudança de Prochaska e DiClemente (Disponível no livro do Field Guide, capítulo 3 Fatores do Cliente páginas 54 -55)" },
      { type: "paragraph", text: "O caso foi retirado e editado do seguinte material: ROHDE, L. A. et al. Conversando sobre TDAH com pacientes e suas famílias. In: ROHDE, L. A. et al. (Orgs.). Guia para compreensão e manejo do TDAH. Porto Alegre: Artmed, 2019. cap. 6, p. 127-128." },
    ],
  },
  {
    slug: "leitura-de-caso-e-definicao-de-tratamento-aplicacao-individu",
    number: 96,
    title: "Leitura de caso e definição de tratamento (APLICAÇÃO INDIVIDUAL)",
    summary:
      "1º momento: Questionar ao usuário do aplicativo esta pergunta. “Como você determina a finalidade de um tratamento? Quais são seus critérios para tal?”. É importante que ao avaliar a resposta do usuário, ele pontue de…",
    category: "operacional",
    duracaoMin: [45, 75],
    formato: ["roleplay"],
    pessoas: "grupo",
    tags: ["leitura"],
    curado: false,
    blocks: [
      { type: "paragraph", text: "Contextualização: Definir os objetivos do tratamento não é um crime para o processo, visto que o cliente/paciente chega aos nossos consultórios com alguma queixa ou algo que ele precise elaborar. Nesse sentido, cabe a nós profissionais saber conduzir o caso estando atento às variáveis do paciente. No entanto, é importante salientar que os objetivos do tratamento não precisam ser estáticos, eles podem mudar ao longo do tempo conforme o paciente for trazendo cada vez mais informações, uma vez que, em determinados casos, a queixa principal pouco se manifesta em um primeiro atendimento. Logo, pode ser que a finalidade do tratamento não seja totalmente definida já no primeiro atendimento, é importante que tanto o profissional quanto o cliente/paciente trabalhem de forma colaborativa e ativa para determinação de objetivos." },
      { type: "paragraph", text: "Objetivos: Dessa forma, o objetivo da atividade é fazer como o profissional leia o caso e como ele pode definir a finalidade do tratamento, em quais momentos do atendimento e criticar quais métodos estamos utilizando se para o caso em específico, ele será eficaz, mesmo com apontamentos científicos relevantes." },
      { type: "heading", text: "Descrição" },
      { type: "paragraph", text: "1º momento: Questionar ao usuário do aplicativo esta pergunta. “Como você determina a finalidade de um tratamento? Quais são seus critérios para tal?”. É importante que ao avaliar a resposta do usuário, ele pontue de forma clara e precisa, não deixe respostas vagas e muito generalistas como “Depende”, “O paciente que decide o objetivo do tratamento”, “Eu decido o melhor para o paciente”, essas respostas muito curtas podem pouco ajudar ao usuário a entender de fato como ele pode construir finalidades do tratamento de forma efetiva. Ao analisar a resposta do usuário verifique o momento em que ele determina a finalidade do tratamento, quem (os agentes) determina a finalidade, como ele define o objetivo do tratamento quais são seus critérios." },
      { type: "paragraph", text: "2º momento: Agora, faça um caso hipotético de um paciente que chega ao consultório do profissional e peça-o para que ele defina como vai tratar esse paciente." },
      { type: "paragraph", text: "Segue um exemplo abaixo:" },
      { type: "paragraph", text: "“Olá, eu sou Pedro (nome fictício), tenho 25 anos, solteiro, nascido em São Paulo e resido no município da Campinas, eu vou contar a minha história." },
      { type: "paragraph", text: "Eu sou estúpido, mais ou menos feio e eu não sei como estou na faculdade. Meus pais dizem que não sou bom, eles não sabem por que eu vim para este mundo." },
      { type: "paragraph", text: "Eu sou um idiota, não tenho ideias, apenas gasto o dinheiro sem pensar, fico sem dinheiro rápido e gasto dos outros, e a única coisa que sei fazer é jogar futebol. Em resumo, eu sou uma droga, não deveria ter nascido. ”" },
      { type: "paragraph", text: "3º momento: A partir da resposta do usuário comece a avaliar de forma crítica, fazendo sugestões de melhoria caso encontre alguma intervenção ou finalidade imprecisa ou que o usuário não conseguiu se expressar bem seu raciocínio ao estabelecer o objetivo do tratamento." },
      { type: "paragraph", text: "4º momento: Caso consiga, peça que o usuário simule atender você e as respostas dele devem expressar a você quais serão os objetivos do tratamento. Por exemplo:" },
      { type: "paragraph", text: "IA: Olá Doutor(a) ..... (nome do usuário), eu vim hoje me consultar com o(a) senhor(a) pois venho sentindo algumas dores de cabeça, tem aparecido algumas manchinhas vermelhas nas minhas pernas, tenho sentido dores nas juntas e tenho tido febre alta nas últimas 48h. Estou me sentindo muito mal, não consegui nem ir para o trabalho, o corpo inteiro dói e só pede cama." },
      { type: "paragraph", text: "Usuário responde como irá abordar a pessoa definindo o tratamento de forma clara e precisa. Caso não entenda a sugestão de tratamento dele, pergunte-o e faça-o reformular seu raciocínio e seu método de intervenção." },
      { type: "paragraph", text: "Como recomendação para intervenções muitos imediatistas, leitura do Modelo Transteórico de estágios de mudança de Prochaska e DiClemente (Disponível no livro do Field Guide, capítulo 3 Fatores do Cliente páginas 54 -55)" },
      { type: "paragraph", text: "O primeiro caso foi retirado e editado do seguinte material: ROHDE, L. A. et al. Conversando sobre TDAH com pacientes e suas famílias. In: ROHDE, L. A. et al. (Orgs.). Guia para compreensão e manejo do TDAH. Porto Alegre: Artmed, 2019. cap. 6, p. 127-128." },
    ],
  },
  {
    slug: "roteiro-de-escuta-empatica",
    number: 97,
    title: "Roteiro de Escuta Empática",
    summary:
      "Desenvolver a capacidade de demonstrar empatia de maneira explícita e implícita, aprimorando a conexão e a comunicação com os pacientes.",
    category: "relacao",
    duracaoMin: [45, 75],
    formato: ["roleplay", "reflexao"],
    pessoas: "dupla",
    tags: ["escuta"],
    curado: false,
    blocks: [
      { type: "heading", text: "Objetivo", level: 3 },
      { type: "paragraph", text: "Desenvolver a capacidade de demonstrar empatia de maneira explícita e implícita, aprimorando a conexão e a comunicação com os pacientes." },
      { type: "heading", text: "Instruções", level: 3 },
      { type: "heading", text: "Preparação", level: 3 },
      {
        type: "list",
        items: [
        "Se o exercício for realizado em dupla, um participante será o \"Paciente\" e o outro o \"Profissional\".",
        "Se o exercício for realizado sozinho, o profissional pode imaginar um cenário com um paciente fictício ou refletir sobre uma interação recente com um paciente.",
        ],
      },
      { type: "heading", text: "Cenário", level: 3 },
      {
        type: "list",
        items: [
        "Escolha ou imagine uma situação clínica comum onde o paciente está passando por uma dificuldade emocional significativa (exemplo: recebendo um diagnóstico difícil, enfrentando dor crônica, ou expressando medo sobre um tratamento). Talvez pedir para o chat gerar um caso?",
        ],
      },
      { type: "heading", text: "Etapa 1: Demonstração de Empatia Explícita", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: O \"Paciente\" descreve suas preocupações ou sentimentos. O \"Profissional\" responde usando validação verbal, exemplos pessoais relevantes e expressões verbais de compreensão.",
        "Sozinho: O profissional escreve ou verbaliza como responderia ao paciente, focando na empatia explícita.",
        ],
      },
      { type: "heading", text: "Etapa 2: Demonstração de Empatia Implícita", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: Realize a mesma conversa, mas agora focando nas expressões faciais gentis, contato visual, tom de voz calmante, e movimentos que transmitam cuidado e atenção.",
        "Sozinho: Pratique em frente a um espelho ou grave a si mesmo, prestando atenção às expressões faciais, postura e tom de voz.",
        ],
      },
      { type: "heading", text: "Reflexão", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: Troquem de papel e repitam o exercício. Em seguida, discutam o que foi eficaz e onde houve dificuldades, especialmente em evitar parecer insincero ou condescendente.",
        "Sozinho: Reflita sobre como se sentiu ao demonstrar empatia de forma explícita e implícita. Avalie se alguma parte da comunicação poderia ser mal interpretada pelo paciente.",
        ],
      },
      { type: "heading", text: "Feedback", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: Dê feedback construtivo ao seu parceiro, destacando momentos de empatia bem-sucedida e sugerindo melhorias.",
        "Sozinho: Revise o vídeo ou anotações para identificar áreas de aprimoramento e planeje como pode aplicar essas melhorias na prática clínica.",
        ],
      },
      { type: "heading", text: "Problemas a Evitar", level: 3 },
      {
        type: "list",
        items: [
        "Cuidado com a utilização de clichês ou frases feitas que podem soar insinceras.",
        "Evite expressões faciais que possam parecer desinteressadas ou distantes.",
        "Monitore o tom de voz para garantir que não transmita condescendência.",
        ],
      },
    ],
  },
  {
    slug: "escuta-compreensiva",
    number: 98,
    title: "Escuta Compreensiva",
    summary:
      "Desenvolver a habilidade de demonstrar compreensão genuína ao escutar e responder ao paciente, valorizando a subjetividade e a individualidade de suas experiências.",
    category: "relacao",
    duracaoMin: [45, 75],
    formato: ["reflexao", "discussao"],
    pessoas: "dupla",
    tags: ["escuta"],
    curado: false,
    blocks: [
      { type: "heading", text: "Objetivo", level: 3 },
      { type: "paragraph", text: "Desenvolver a habilidade de demonstrar compreensão genuína ao escutar e responder ao paciente, valorizando a subjetividade e a individualidade de suas experiências." },
      { type: "heading", text: "Instruções", level: 3 },
      { type: "heading", text: "Preparação", level: 3 },
      {
        type: "list",
        items: [
        "Se o exercício for realizado em dupla, um participante será o \"Paciente\" e o outro o \"Profissional\".",
        "Se o exercício for realizado sozinho, o profissional pode imaginar um cenário com um paciente fictício ou refletir sobre uma interação recente com um paciente.",
        ],
      },
      { type: "heading", text: "Cenário", level: 3 },
      {
        type: "list",
        items: [
        "Escolha ou imagine uma situação clínica onde o paciente compartilha uma experiência pessoal ou emocionalmente carregada (exemplo: uma dificuldade com o tratamento, preocupações sobre os efeitos colaterais, ou medos sobre o futuro).",
        ],
      },
      { type: "heading", text: "Etapa 1: Demonstração de Compreensão Explícita", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: O \"Paciente\" descreve suas preocupações ou sentimentos. O \"Profissional\" responde utilizando parafraseamentos para verificar a compreensão, compartilha exemplos pessoais relevantes (se apropriado), e realiza psicoeducação, quando necessário, para aprofundar o entendimento do paciente.",
        "Sozinho: O profissional escreve ou verbaliza como responderia ao paciente, focando em verificar a compreensão explicitamente.",
        ],
      },
      { type: "heading", text: "Etapa 2: Demonstração de Compreensão Implícita", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: O \"Paciente\" continua sua história, enquanto o \"Profissional\" demonstra compreensão implicitamente através de uma postura aberta, contato visual atento, acenos de cabeça e permitindo que o paciente fale sem interrupções desnecessárias.",
        "Sozinho: Pratique em frente a um espelho ou grave a si mesmo, focando na linguagem corporal e nas expressões que indicam uma escuta ativa e atenta.",
        ],
      },
      { type: "heading", text: "Reflexão", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: Troquem de papel e repitam o exercício. Em seguida, discutam como a postura e a atitude do \"Profissional\" influenciaram a sensação de ser compreendido pelo \"Paciente\". Identifiquem áreas de melhoria e discutam como evitar suposições teóricas que podem obscurecer a subjetividade do paciente.",
        "Sozinho: Reflita sobre como suas respostas explícitas e implícitas contribuíram para demonstrar uma compreensão genuína. Avalie se houve algum momento em que você assumiu entender a experiência do paciente sem realmente explorar seus sentimentos e perspectivas.",
        ],
      },
      { type: "heading", text: "Feedback", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: Dê feedback construtivo ao seu parceiro, focando em como o \"Profissional\" verificou a compreensão e usou a comunicação implícita para criar uma conexão mais profunda.",
        "Sozinho: Revise o vídeo ou anotações para identificar áreas de melhoria e planeje como pode aplicar essas melhorias na prática clínica.",
        ],
      },
      { type: "heading", text: "Problemas a Evitar", level: 3 },
      {
        type: "list",
        items: [
        "Assumir Compreensão Completa: Evite acreditar que você entende completamente a experiência do paciente sem explorar suas emoções e perspectivas. Isso pode resultar em respostas superficiais ou inadequadas, que não refletem a realidade subjetiva do paciente.",
        "Pressupor Informações: Não substitua ou interrompa o discurso do paciente com suposições teóricas. Permita que o paciente expresse completamente seus sentimentos e pensamentos antes de oferecer uma resposta.",
        ],
      },
    ],
  },
  {
    slug: "pratica-de-aceitacao-incondicional",
    number: 99,
    title: "Prática de Aceitação Incondicional",
    summary:
      "Desenvolver a capacidade de demonstrar aceitação incondicional do paciente, sem julgamentos, fortalecendo a confiança e a autenticidade na relação terapêutica.",
    category: "relacao",
    duracaoMin: [45, 75],
    formato: ["reflexao", "discussao"],
    pessoas: "dupla",
    tags: ["aceitacao"],
    curado: false,
    blocks: [
      { type: "heading", text: "Objetivo", level: 3 },
      { type: "paragraph", text: "Desenvolver a capacidade de demonstrar aceitação incondicional do paciente, sem julgamentos, fortalecendo a confiança e a autenticidade na relação terapêutica." },
      { type: "heading", text: "Instruções", level: 3 },
      { type: "heading", text: "Preparação", level: 3 },
      {
        type: "list",
        items: [
        "Se o exercício for realizado em dupla, um participante será o \"Paciente\" e o outro o \"Profissional\".",
        "Se o exercício for realizado sozinho, o profissional pode imaginar um cenário com um paciente fictício ou refletir sobre uma interação recente com um paciente.",
        ],
      },
      { type: "heading", text: "Cenário", level: 3 },
      {
        type: "list",
        items: [
        "Escolha ou imagine uma situação clínica onde o paciente compartilha algo pessoal que pode ser difícil ou sensível (exemplo: comportamentos que o paciente considera inadequados, preocupações com estigmas sociais, ou sentimentos de culpa ou vergonha).",
        ],
      },
      { type: "heading", text: "Etapa 1: Demonstração de Aceitação Explícita", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: O \"Paciente\" descreve suas preocupações ou sentimentos. O \"Profissional\" responde utilizando validação verbal, oferecendo apoio, dando feedback positivo, encorajando o paciente e demonstrando disponibilidade e abertura através de perguntas clarificadoras e transparência.",
        "Sozinho: O profissional escreve ou verbaliza como responderia ao paciente, focando na aceitação explícita, sem julgamentos.",
        ],
      },
      { type: "heading", text: "Etapa 2: Demonstração de Aceitação Implícita", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: O \"Paciente\" continua sua história, enquanto o \"Profissional\" demonstra aceitação implicitamente através de postura aberta, contato visual, acenos de cabeça e permitindo que o paciente fale sem interrupções desnecessárias.",
        "Sozinho: Pratique em frente a um espelho ou grave a si mesmo, prestando atenção à linguagem corporal e às expressões que transmitem aceitação.",
        ],
      },
      { type: "heading", text: "Reflexão", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: Troquem de papel e repitam o exercício. Em seguida, discutam como o \"Paciente\" percebeu a aceitação do \"Profissional\" e identifiquem qualquer momento em que a aceitação poderia ter sido percebida como insincera ou forçada.",
        "Sozinho: Reflita sobre como você demonstrou aceitação de forma explícita e implícita. Avalie se houve momentos em que julgamentos pessoais influenciaram sua resposta e como você poderia melhorar sua abordagem.",
        ],
      },
      { type: "heading", text: "Feedback", level: 3 },
      {
        type: "list",
        items: [
        "Dupla: Dê feedback construtivo ao seu parceiro, destacando como o \"Profissional\" demonstrou aceitação e sugerindo formas de melhorar a autenticidade e a profundidade dessa aceitação.",
        "Sozinho: Revise o vídeo ou anotações para identificar áreas de melhoria e planeje como pode aplicar essas melhorias na prática clínica.",
        ],
      },
    ],
  },
  {
    slug: "coletanea-de-roteiros-cenas-de-roleplay",
    number: 100,
    title: "Coletânea de roteiros (cenas de roleplay)",
    summary:
      "Atores: terapeuta e cliente",
    category: "tecnica",
    duracaoMin: [60, 90],
    formato: ["roleplay", "reflexao", "discussao"],
    pessoas: "grupo",
    tags: ["não-curado"],
    curado: false,
    blocks: [
      { type: "heading", text: "Cena de rompimento de sigilo mal feito" },
      { type: "paragraph", text: "Atores: terapeuta e cliente" },
      { type: "paragraph", text: "A cena se inicia no meio de uma sessão. O cliente pode estar finalizando um assunto qualquer, e então começa a falar sobre uma situação de abuso, violência, assédio ou risco de vida que esteja vivenciando constantemente, mas situações passíveis de uma denúncia à polícia (e não chantagem emocional, apenas, mas contextos mais críticos, como abuso sexual, agressão, etc). Este assunto nunca havia surgido em terapia antes, e o cliente pode trazê-lo com mais impacto ou de uma forma mais tranquila, visto que o foco será a atuação precipitada do terapeuta. Porém, é importante que não tenha sido uma situação pontual. O cliente deve deixar claro em sua fala que essa situação tem perdurado por uns 2 anos." },
      { type: "paragraph", text: "O terapeuta deve ficar chocado com a informação, e vai fazer duas ou três perguntas no máximo sobre a situação (que podem ser desde quando isso tem acontecido, com que frequência e por que o cliente não contou antes) e irá interromper seu cliente (que irá trazer mais algumas informações sobre a situação) afirmando a necessidade de denunciar a situação. O cliente irá perguntar o motivo e o terapeuta deve dar explicações superficiais (isso não poderia estar acontecendo, que algo tem que ser feito, que é perigoso) ou dizer que ele deve seguir seu código de ética, e isso implicaria em denunciar essa situação. Essas explicações devem ser ditas de forma direta, sem abrir espaço para discussões ou questionamentos. O terapeuta deve repassar alguns procedimentos para realizar a denúncia em voz alta (procedimentos esses que podem ser os corretos ou não) dizer que, naquele contexto, seria necessário romper o sigilo da terapia." },
      { type: "paragraph", text: "Orientações afetivas (como o personagem deve se sentir):" },
      {
        type: "list",
        items: [
        "Cliente: pode começar neutro e falar da situação de violência com neutralidade ou com um certo receio, ficando submisso ao terapeuta quando este se agita.",
        "Terapeuta: começa neutro, fica muito surpreso/chocado ao saber da situação e faz as 3 perguntas neste estado, logo depois ficando imperativo, agitado e assustado, visando fazer a denúncia o mais rápido possível.",
        ],
      },
      { type: "heading", text: "Cena de cliente que apresenta um delírio persecutório na sessão" },
      { type: "paragraph", text: "Atores: cliente" },
      { type: "paragraph", text: "A cena retrata o início de uma sessão. O(a) cliente deve começar devagar e com uma certa insegurança na fala, dizendo que quer muito comentar algo com o(a) terapeuta, algo que já o(a) incomoda há um tempo. Algumas ideias para passar essa insegurança são: o(a) cliente não sabia se podia comentar o assunto com o(a) terapeuta; ele(a) tem medo de falar do assunto pois pode parecer estranho ou que ele(a) é doido(a); quando o(a) cliente falava com outras pessoas sobre, sempre diziam que era coisa da cabeça dele(a) e não davam atenção de forma geral." },
      { type: "paragraph", text: "Então, o(a) cliente hesita por mais um instante e começa a contar sobre algo que está acontecendo em sua vida há uns 10 meses. Deve dizer que tem a sensação de que algo vai dar errado, de que tem alguma coisa vindo e que ele(a) é o alvo disso. Conforme vai falando, o(a) cliente deve desviar a atenção da câmera por um segundo, olhando para um dos lados e voltando logo depois, como se estivesse vendo se não há ninguém na sala que o(a) pudesse estar ouvindo. Então, continua falando, que se sente observado(a) e seguido(a) em algumas situações, principalmente quando está andando na rua, perto de sua casa. Afirma que deve ser por pessoas do seu trabalho que não gostam dele(a), que, no escritório/fábrica/empresa/onde quer que seja, eles ficam olhando para ele(a), julgando. Diz que eles tem algo contra ele(a) e que devem estar planejando um jeito de tirá-lo(a) do trabalho, mas tem medo que não seja só isso, pois notou pessoas andando na rua na mesma hora que ele(a) volta do trabalho, que só podem ser seus colegas disfarçados, preparando alguma forma de rapto ou de ataque direto à ele(a) e esperando o momento certo para botá-lo em prática, mas que o(a) cliente não se deixa descuidar, e vai direto pra casa e tranca tudo quando chega, que não vai deixar eles fazerem nada com ele(a)." },
      { type: "heading", text: "Tratamento em 2 sessões" },
      { type: "paragraph", text: "Neste monólogo, João expressa sua determinação em limitar o tratamento a apenas duas sessões, enfatizando sua necessidade de soluções rápidas e práticas devido às suas responsabilidades e restrições de tempo e dinheiro. Ele espera que o terapeuta compreenda sua perspectiva e concorde em trabalhar de forma objetiva para resolver seus problemas." },
      { type: "paragraph", text: "João: [Olha diretamente para a câmera, com uma expressão séria] Doutor, estou aqui para deixar claro que só tenho tempo e paciência para duas sessões. Não tenho tempo para ficar falando sobre toda a minha infância, ou analisando meus sonhos. Preciso de soluções rápidas, objetivas. [Gesticula com as mãos, enfatizando sua determinação]" },
      { type: "paragraph", text: "João: Não quero ser rude, mas o tempo é precioso para mim. Tenho uma família para sustentar, um emprego que exige demais e contas para pagar. Não posso me dar ao luxo de ficar aqui sentado por semanas ou meses a fio. [Sua expressão facial reflete a tensão e a preocupação com suas responsabilidades]" },
      { type: "paragraph", text: "[João olha fixamente para o Dr., aguardando uma resposta]" },
      { type: "paragraph", text: "João: Eu sei o que quero, doutor. Quero resolver meus problemas de uma vez por todas. Não quero ficar remoendo o passado ou discutindo teorias. Quero soluções práticas, ações que eu possa tomar para mudar minha situação. [Ele faz um gesto de mãos, enfatizando suas palavras]" },
      { type: "paragraph", text: "[João respira fundo, esperando que o Dr. entenda sua perspectiva]" },
      { type: "paragraph", text: "João: Sei que terapia pode ser um processo longo e complicado, mas estou disposto a fazer o que for necessário durante essas duas sessões. Afinal, não tenho muito dinheiro para gastar com isso também. [Ele suspira, mostrando sua preocupação financeira]" },
      { type: "paragraph", text: "João: Então, doutor, o que me diz? Podemos trabalhar juntos nessas duas sessões e focar em soluções reais? [Ele olha fixamente para o terapeuta, esperando uma resposta afirmativa]" },
      { type: "paragraph", text: "Fim da cena." },
      { type: "heading", text: "Cena de reparação de aliança" },
      { type: "paragraph", text: "Nesta cena, o(a) paciente fará o papel de uma pessoa que sente que a terapia não está funcionando mais, que não está gostando da postura do terapeuta durante as sessões. As falas somente estão aí para nortear, mas o ator ou atriz têm liberdade para improvisar e falar da maneira como quiserem, apenas mantendo a insatisfação com relação à terapia e ao terapeuta." },
      { type: "paragraph", text: "Paciente: Não sei ao certo, mas estou sentindo que me sento neste sofá, falo da minha vida por 1 hora com você e praticamente nada muda de uma sessão pra outra (desânimo e desesperança)." },
      { type: "paragraph", text: "Paciente: Sabe, às vezes eu conto as coisas pra você e você fica completamente calado, ou quando você fala alguma coisa parece que não entendeu nada do que acabei de falar (o tom vai subindo)." },
      { type: "paragraph", text: "Paciente: Você sabe muito bem, ou deveria saber pelo menos, que eu não ganho rios de dinheiro no meu trabalho pra me dar o luxo de gastar com um serviço que não está dando resultado pra mim. (raiva) Não entendo nada de Psicologia, mas tô começando a achar que não serve pra mim." },
      { type: "paragraph", text: "Fim da cena." },
      { type: "heading", text: "Tratamento para sempre" },
      { type: "paragraph", text: "Neste monólogo, Ana expressa sua relutância em aceitar a alta do tratamento após 10 anos, destacando seu medo do abandono e questionando quem estará ao seu lado nas próximas fases da vida. Ela relata como sua jornada acadêmica a levou a se distanciar de seus amigos, intensificando seu temor de ficar sozinha." },
      { type: "paragraph", text: "___________________________________________________________________" },
      { type: "paragraph", text: "Ana: [Com a voz embargada, olhando para o Dr. com carinho] Dr., eu sei que você acha que estou pronta para seguir em frente, mas eu simplesmente não consigo." },
      { type: "paragraph", text: "[Ana engole em seco, tentando controlar suas emoções]" },
      { type: "paragraph", text: "Ana: Você foi mais do que um terapeuta para mim, foi um amigo, um confidente. Durante esses 10 anos de tratamento, você foi a única pessoa que verdadeiramente me entendeu, que esteve ao meu lado em todos os altos e baixos. [Ela olha nos olhos do Dr., expressando sua gratidão]" },
      { type: "paragraph", text: "[Ana solta um suspiro pesado, lutando contra as lágrimas]" },
      { type: "paragraph", text: "Ana: Mas agora, com a ideia de terminar nosso trabalho juntos, sinto como se estivesse prestes a ser abandonada novamente. [Sua voz treme com a emoção] Eu sei que trabalhamos muito para superar meu medo do abandono, mas parece que estou vivendo tudo isso de novo." },
      { type: "paragraph", text: "Ana: E então eu me pergunto, quem vai estar ao meu lado nas próximas fases da vida se não você? [Ela faz um gesto com a mão, como se estivesse procurando por uma resposta que teme não encontrar] Todos os amigos que ficaram pra trás, e agora, com você... [Sua voz falha, revelando sua angústia]" },
      { type: "paragraph", text: "Ana: Por favor, Dr., não me faça ir embora. Não agora. [Ela olha para ele com olhos suplicantes, esperando que ele entenda sua dor]" },
      { type: "paragraph", text: "___________________________________________________________________" },
      { type: "paragraph", text: "Fim da cena." },
      { type: "heading", text: "Cena de cliente que não se aprofunda" },
      { type: "paragraph", text: "Atores: psicólogo e cliente" },
      { type: "paragraph", text: "A cena se passa em uma sessão com paciente muito calado, que se reluta em falar sobre os temas por qualquer motivo que seja." },
      { type: "paragraph", text: "O psicólogo começa a sessão perguntando se o cliente se lembra do assunto da sessão passada (pode ser qualquer assunto). O cliente confirma com a cabeça, apenas, com uma postura corporal fechada (braços cruzados, corpo tenso, carranca)., e o psicólogo faz uma pergunta inicial para a sessão, para a qual o cliente responde com sim, não ou talvez. Se faz um silêncio e o psicólogo faz uma cara instigando o cliente a falar ou de quem espera que algo aconteça. Visto que nada acontece, o psicólogo pergunta o porquê da resposta anterior (por que sim?), ao que o cliente dá uma resposta curta, como “não sei”, “sei lá”, “não pensei nisso” ou “só sinto isso”. O psicólogo expressa frustração com a situação (pode franzir a testa, suspirar fundo, pressionar as têmporas, enfim) e faz alguma intervenção para tentar mudar a situação: puxar outro assunto para a conversa, perguntar se está tudo bem naquele dia ou ainda se há algum incômodo, ao que o cliente irá responder novamente de forma seca, desviando do aprofundamento de novo." },
      { type: "heading", text: "Cena de diferença de linguagem associada à diferença de idade" },
      { type: "paragraph", text: "Atores: cliente e terapeuta." },
      { type: "paragraph", text: "A cena se passa durante uma sessão com paciente com diferença de idade que se reflete em uma dificuldade de comunicação entre os dois, principalmente na linguagem. A ideia é isso acontecer de uma forma bem explícita, com ambos usando termos que o outro não entende, e também de uma forma mais implícita." },
      { type: "paragraph", text: "O terapeuta puxa um assunto a ser discutido e cliente traz depoimento com várias expressões e gírias da geração atual. Terapeuta evidencia confusão e estar perdido, e pede para retomar o assunto. Cliente retoma, um pouco desanimado e menos engajado. Terapeuta ouve, mas interrompe pedindo que explique alguns termos usados. Cliente explica, mas fala para deixar o assunto quieto." },
      { type: "heading", text: "Cena gatilho pro terapeuta" },
      { type: "paragraph", text: "Atores: paciente e cliente" },
      { type: "paragraph", text: "Paciente vai comentar algo bem comum. Sugestão de frase:" },
      { type: "paragraph", text: "“Sabe dr(a), eu sinto que devo me afastar mais dos meus amigos, sabe. Tipo, eu gosto deles, mas tem algo que me irrita neles que é o lance de eles não serem tão simpáticos comigo. Tipo, não que eles sejam grossos, nem escrotos, nada disso, mas sabe, eu sempre sou muito atencioso com eles, sempre cumprimento, sorrio, abraço, e eles não fazem nada, nunca são gentis comigo! Esses dias eu cheguei tristão, quieto, super diferente do que eu sou, e nenhum deles comentou nada! E pior! Quando eu vi que ninguém ia perguntar, eu comentei com eles que to com uns problemas com meu curso, o que a gente tem conversado, e aí, sabe o que eles disseram?! \"Complicado...\"! Complicado?! Cara, é isso que eu recebo de apoio dos caras?! Que saco, eu realmente tô querendo me afastar total…”" },
      { type: "paragraph", text: "A ideia é que essa situação seja um gatilho pro terapeuta, que pode tanto se identificar com o cliente quanto com os amigos, e, sendo um gatilho, terá uma catarse. Nesse sentido, ele acabará perdendo o profissionalismo e irá jogar todo o afeto pra cima do cliente. Sugestões de como isso pode acontecer:" },
      { type: "paragraph", text: "(Caso haja identificação com o cliente): “Mano, isso é um absurdo! Eu também não entendo esse tipo de coisa! Eu sempre to lá, qualquer tipo de problema eu já ajudei, até virei a noite pelo cara, aí quando eu to mal, ele simplesmente mete um: \"po, difícil isso aí, mas você que é o psicólogo, né?\" MAS NÃO É PORQUE SOU PSICÓLOGO QUE SEI RESOLVER TUDO, E MUITO MENOS QUE VOCÊ PODE CAGAR PROS MEUS PROBLEMAS!”" },
      { type: "heading", text: "Paciente que não percebe sua indecência" },
      { type: "paragraph", text: "Atores: cliente" },
      { type: "paragraph", text: "Cliente traz um depoimento sobre incômodo com o comportamento de falar alto no trabalho. Afirma que seus colegas comentam de forma amigável que ele tem “voz de trovão”, que “dá até susto” quando ele fala, mas que isso não é nada que o incomode. Só que recentemente, o chefe dele falou que não gostou do tom de voz dele na reunião, que “o escritório inteiro ia ouvir”, mas ele falou grosso e seco, e não em tom de brincadeira. Cliente não se mostra incomodado com o depoimento, mas sim confuso (cliente começa a elevar o tom de voz aqui, de forma progressiva, cada vez mais alto), porque ele não fala alto. Sugestão de fala:" },
      { type: "paragraph", text: "“Eu não falo alto. Eu realmente não falo baixo, mas po, não é como se eu falasse alto. Eu juro que não entendi o comentário dele, sabe? Eu não fui grosseiro, não interrompi o meu chefe, eu só falei a minha opinião. Pode ser que ele não tenha gostado, embora eu ache que não tenha sido nada de mais. Mas, fazer o que, né, as pessoas pensam de forma diferente. Eu só realmente não peguei qual foi a do comentário dele.”" },
      { type: "heading", text: "Dinâmica do “banque sua intervenção”" },
      { type: "paragraph", text: "Contextualização" },
      { type: "paragraph", text: "Nas simulações de atendimento clínico da Allos, algo muito comum de se perceber entre as pessoas que tentam fazer a avaliação é serem muito conservadoras ao atender os pacientes. Com “conservadoras”, me refiro ao fato de que as pessoas se privam de fazer intervenções confrontativas ou qualquer tipo de intervenção que ela julgue arriscada. Isso acontece em função de um medo de desagradar o paciente e, consequentemente, acabar rompendo o vínculo terapêutico." },
      { type: "paragraph", text: "Concretamente, isso significa que o terapeuta frequentemente se coloca em um estágio de mudança muitas vezes abaixo do patamar que o paciente está. Em muitos momentos, o paciente já tem consciência das demandas e das próprias demandas, mas o terapeuta ainda está agindo como se o cliente estivesse na pré-contemplação, resistente ou em negação de suas questões - deixando de abordar temáticas importantes." },
      { type: "paragraph", text: "Um fato curioso, no entanto, é que com frequência é justamente a ausência de intervenções mais arriscadas que contribuem para o rompimento ou fragilização do vínculo. Isso porque pouca coisa acontece, pouca coisa movimenta no processo - e o cliente percebe isso." },
      { type: "paragraph", text: "Quanto mais o terapeuta tem receio de fazer intervenções complexas ou arriscadas, mais ele se mantém num nível de profundidade raso. O terapeuta muitas vezes guarda para si hipóteses, intervenções e construções que tocariam em pontos delicados, tudo por medo. O problema é que quanto mais você se priva de uma certa pitada de risco, menos potente se torna o encontro." },
      { type: "paragraph", text: "Na prática, esse medo de errar faz o terapeuta muitas vezes perder ganchos importantes, como apontar contradições entre o discurso e o corpo (por medo do que o cliente vai pensar ou de como vai reagir), fazer auto revelações ou tentar qualquer outra intervenção diferente das que ele já está habituado. A coragem aqui se faz importante para desagradar quando é necessário, experimentar algo novo e lidar com a imprevisibilidade do encontro e seus desdobramentos." },
      { type: "paragraph", text: "Este grupo busca justamente ajudar os terapeutas a construírem soluções clínicas para intervenções mais arriscadas — e, com isso, tornar o encontro terapêutico mais potente." },
      { type: "heading", text: "1º momento: Preparação", level: 3 },
      { type: "paragraph", text: "Cada terapeuta pega um papel/bloco de notas do PC/celular e responde ao menos 3 pontos para as duas seguintes perguntas:" },
      {
        type: "list",
        items: [
        "Qual tipo de terapeuta costumo ser? (ex: muito silencioso, muito técnico, muito acolhedor)",
        "O que eu jamais faria por medo? (ex: confrontar, interromper, fazer auto revelação, ser direto, usar humor, nomear contradição)",
        ],
      },
      { type: "paragraph", text: "Obs importante: Pode se arriscar a vontade, mas tenha em mente que tudo que você se propõe a fazer deve estar à serviço da terapia." },
      { type: "paragraph", text: "Dar 5 minutos para todo mundo responder, e, para quem quiser, revelar as respostas ao grupo." },
      { type: "heading", text: "2º momento: Dinâmica", level: 3 },
      { type: "paragraph", text: "A ideia é um roleplay de 20 minutos (uma pessoa faz papel de terapeuta e outra de paciente fictício) e a ideia é simples: nos primeiros 7 a 10 minutos, o terapeuta deve fazer pelo menos duas das 3 coisas que ele anotou na lista que jamais faria, e ir lidando clinicamente com as consequências dessa abertura ao longo do atendimento." },
      { type: "heading", text: "3º momento: Discussão", level: 3 },
      { type: "paragraph", text: "Após a dinâmica, discutir:" },
      {
        type: "list",
        items: [
        "Terapeuta:",
        "O que você sentiu ao fazer algo que evita?",
        "Em algum momento o risco virou potência?",
        "Paciente:",
        "Você se sentiu invadido?",
        "Curiosamente cuidado? Confuso? Mais próximo ou mais distante?",
        ],
      },
      { type: "heading", text: "Ligação de paciente" },
      { type: "paragraph", text: "Atores: terapeuta e paciente" },
      { type: "paragraph", text: "Neste exercício, o terapeuta está em uma mesa de bar com os amigos sexta-feira à noite, logo depois de seu expediente acabar. Ele se encontra exausto, porém feliz de ter um momento para reencontrar seus amigos de infância e se atualizar sobre como eles estão levando a vida. Durante o encontro, o terapeuta recebe uma ligação de uma de suas pacientes enquanto estava no banheiro e o celular na mesa. Ao retornar, percebe o registro da chamada e observa que havia recebido mensagens da mesma paciente dizendo que precisava falar com ele a respeito de algo, mesmo estando fora de sessão. O terapeuta para e pensa no que faz." },
      { type: "heading", text: "Cena de paciente com expectativa irreal do tratamento" },
      { type: "paragraph", text: "Ator/atriz: cliente" },
      { type: "paragraph", text: "Cliente chega para primeira sessão com expectativa de cura rápida para sua demanda, algo que não é possível. Cliente deve exprimir uma urgência e postura decidida, que “não aceita um não como resposta”, passar uma dificuldade de se opor, mas não estando desesperado(a)." },
      { type: "paragraph", text: "Exemplo de fala:" },
      { type: "paragraph", text: "“Olá Fulanx. Então, vim para cá para tratar do meu jeito chorão. Eu me magoou muito fácil, não consigo ouvir críticas ou comentários negativos sem ficar triste e chateada. Me vem um negócio e quero chorar. Porém, eu consegui um emprego novo e não posso ser assim lá. Começo na semana que vem e queria já estar livre disso pra começar!" },
    ],
  },
];

export function getExerciseBySlug(slug: string): Exercise | undefined {
  return EXERCISES.find((e) => e.slug === slug);
}

/**
 * Default semântico: ausência de `curado` ou `curado: true` ⇒ curado.
 * Só `curado: false` explícito desliga.
 */
export function isCurated(ex: Pick<Exercise, "curado">): boolean {
  return ex.curado !== false;
}

// ─── Modo Facilitador: particionar blocks em sections navegáveis ───────────

export interface FacilitatorSection {
  id: string;
  label: string;
  isMomento: boolean;
  momentoNumber: number | null;
  blocks: Block[];
}

/**
 * Quebra o array de blocks em sections navegáveis pelo modo Facilitador.
 *
 * Estratégia:
 * - Se o exercício tem Momentos (heading level 3 que parseMomento bate),
 *   cada Momento vira uma section, e tudo que vier antes do primeiro Momento
 *   (Contextualização, etc.) vira sections separadas por heading level 2.
 * - Se não tem Momentos, particiona apenas por heading level 2.
 *
 * Blocks órfãos (antes de qualquer heading) caem em uma section "Introdução".
 */
export function partitionSections(blocks: Block[]): FacilitatorSection[] {
  const hasMomentos = blocks.some(
    (b) => b.type === "heading" && (b.level ?? 2) === 3 && parseMomento(b.text),
  );

  const sections: FacilitatorSection[] = [];
  let current: FacilitatorSection | null = null;

  function makeSection(
    label: string,
    isMomento: boolean,
    momentoNumber: number | null,
  ): FacilitatorSection {
    return {
      id: `sec-${sections.length}`,
      label,
      isMomento,
      momentoNumber,
      blocks: [],
    };
  }

  function flush() {
    if (current && current.blocks.length > 0) sections.push(current);
  }

  for (const block of blocks) {
    if (block.type === "heading") {
      const level = block.level ?? 2;

      if (hasMomentos && level === 3) {
        const momento = parseMomento(block.text);
        if (momento) {
          flush();
          current = makeSection(
            momento.label || `Momento ${momento.number}`,
            true,
            momento.number,
          );
          continue;
        }
      }
      if (level === 2) {
        flush();
        current = makeSection(block.text, false, null);
        continue;
      }
      // level 4 e headings level 3 sem matching de Momento ficam dentro da
      // section atual como sub-headings.
    }

    if (current === null) {
      current = makeSection("Introdução", false, null);
    }
    current.blocks.push(block);
  }

  flush();
  return sections;
}

// ─── Tags helpers ───────────────────────────────────────────────────────────

export function tagToSlug(tag: string): string {
  return tag
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listAllTags(): {
  tag: string;
  slug: string;
  count: number;
}[] {
  const map = new Map<string, number>();
  for (const ex of EXERCISES) {
    for (const tag of ex.tags) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count, slug: tagToSlug(tag) }))
    .sort(
      (a, b) =>
        b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"),
    );
}

export function findTagBySlug(
  slug: string,
): { tag: string; exercises: Exercise[] } | null {
  const target = slug.toLowerCase();
  // Procura tag cuja slugify bata. Como pode haver colisão teórica, devolve a
  // primeira (case improvável com este vocabulário pequeno).
  for (const ex of EXERCISES) {
    for (const tag of ex.tags) {
      if (tagToSlug(tag) === target) {
        return {
          tag,
          exercises: EXERCISES.filter((e) => e.tags.includes(tag)),
        };
      }
    }
  }
  return null;
}

/**
 * Retorna até `n` exercícios relacionados ao atual, ordenados por relevância:
 * +3 se categoria igual · +1 por tag em comum · +0.5 por formato em comum.
 * Empate vai pelo número original. Usado pelo bloco "Veja também" no detail.
 */
export function getRelated(current: Exercise, n: number = 3): Exercise[] {
  const tagsCur = new Set(current.tags);
  const formatosCur = new Set(current.formato);

  const scored = EXERCISES.filter((e) => e.slug !== current.slug).map((e) => {
    let score = 0;
    if (e.category === current.category) score += 3;
    for (const t of e.tags) if (tagsCur.has(t)) score += 1;
    for (const f of e.formato) if (formatosCur.has(f)) score += 0.5;
    return { ex: e, score };
  });

  scored.sort((a, b) => b.score - a.score || a.ex.number - b.ex.number);

  // Tira candidatos com score 0 (sem nenhum critério em comum) pra não poluir.
  const filtered = scored.filter((s) => s.score > 0);
  return filtered.slice(0, n).map((s) => s.ex);
}

/** Slugifica um texto para uso como id de heading (âncora). */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Extrai um sumário (table of contents) a partir dos blocks.
 * Inclui headings level 2 (seções principais).
 */
export function extractToc(blocks: Block[]): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    if (b.type !== "heading") continue;
    const level = b.level ?? 2;
    if (level !== 2) continue;
    let id = slugifyHeading(b.text);
    if (!id) continue;
    // Garante unicidade dentro de um mesmo exercício.
    let suffix = 2;
    while (seen.has(id)) {
      id = `${slugifyHeading(b.text)}-${suffix++}`;
    }
    seen.add(id);
    out.push({ id, text: b.text });
  }
  return out;
}

/**
 * Detecta se um heading representa um "Momento" da dinâmica.
 * Aceita variantes: "1º Momento", "Momento 1", "Primeiro momento",
 * "1º Momento: Reflexão sobre preparação", etc.
 */
export function parseMomento(
  text: string,
): { number: number; label: string } | null {
  const trimmed = text.trim();

  // "1º Momento" ou "1 Momento" ou "1º Momento: Label"
  let m = trimmed.match(/^(\d+)[ºo]?\s*[Mm]omento(?:\s*[:\-—]\s*(.+))?$/);
  if (m) {
    return { number: Number(m[1]), label: (m[2] ?? "").trim() };
  }

  // "Momento 1" ou "Momento 1: Label"
  m = trimmed.match(/^[Mm]omento\s+(\d+)(?:\s*[:\-—]\s*(.+))?$/);
  if (m) {
    return { number: Number(m[1]), label: (m[2] ?? "").trim() };
  }

  // "Primeiro momento", "Segundo momento", ...
  const ordinais = [
    "primeiro",
    "segundo",
    "terceiro",
    "quarto",
    "quinto",
    "sexto",
  ];
  m = trimmed.match(
    /^(Primeiro|Segundo|Terceiro|Quarto|Quinto|Sexto)\s+momento(?:\s*[:\-—]\s*(.+))?$/i,
  );
  if (m) {
    const idx = ordinais.indexOf(m[1].toLowerCase());
    if (idx >= 0) {
      return { number: idx + 1, label: (m[2] ?? "").trim() };
    }
  }

  return null;
}
