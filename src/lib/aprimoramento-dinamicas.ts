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
];

export function getExerciseBySlug(slug: string): Exercise | undefined {
  return EXERCISES.find((e) => e.slug === slug);
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
