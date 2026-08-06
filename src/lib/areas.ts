// Onde cada pessoa pode ir.
//
// Havia quatro lugares decidindo isso, e nenhum deles sabia dos outros: o menu
// do site, a navegação do painel, o gate de rota no middleware e o `redirect`
// no topo de cada página. Divergir custava caro nos dois sentidos — a área que
// existe, funciona e é inalcançável porque o link não aparece; e o link que
// aparece para quem a página manda embora meio segundo depois.
//
// Aqui a resposta é escrita uma vez. Os quatro derivam desta lista.
//
// A divisão de fundo é entre duas cascas. Quem conduz um grupo, quem cuida dos
// eventos e quem é associado trabalha no SITE, em /formacao/associados: são
// pessoas fazendo o trabalho delas, não gente administrando a plataforma, e a
// casca escura de painel dizia o contrário. O painel ficou para quem de fato
// administra.
//
// O que este arquivo NÃO faz: proteger nada. Ele governa a tela e o gate de
// rota, que são a mesma resposta dita duas vezes — a proteção de verdade está
// nas policies do Postgres, e as duas precisam ser conferidas juntas quando um
// cargo ganha ou perde uma área.

import type { Cargo } from "./cargos";
import { conjuntoTemAlgum } from "./cargos";

/** As seções da navegação do painel, na ordem em que aparecem. */
export type GrupoPainel = "formacao" | "sistema";

export const GRUPOS: { id: GrupoPainel; titulo: string }[] = [
  { id: "formacao", titulo: "Formação" },
  { id: "sistema", titulo: "Sistema" },
];

export interface Area {
  id: string;
  /** Como se chama para quem trabalha nela. */
  rotulo: string;
  href: string;
  /** Uma frase sobre o que se faz aqui. */
  resumo?: string;
  /**
   * Quem vê. O administrador não entra nesta lista: passa em tudo, e repetir
   * "admin" em cada linha é a repetição que alguém esquece justamente na linha
   * que importa. Lista vazia = só administrador.
   */
  cargos: Cargo[];
  /** Em que menus ela aparece. */
  onde: ("site" | "painel")[];
  /** A seção do painel. Sem grupo, aparece no topo, sem título. */
  grupo?: GrupoPainel;
}

/** O endereço da área de quem trabalha nos grupos. */
export const CASA_DOS_ASSOCIADOS = "/formacao/associados";

/**
 * O catálogo.
 *
 * A ordem importa: é a ordem da tela, e o primeiro item que couber para uma
 * pessoa vira o destino dela.
 */
export const AREAS: Area[] = [
  {
    id: "associados",
    rotulo: "Associados",
    href: CASA_DOS_ASSOCIADOS,
    resumo:
      "O seu grupo, o acervo de dinâmicas para levar até ele e os eventos, num lugar só.",
    cargos: ["associado", "condutor", "eventos"],
    onde: ["site"],
  },
  {
    // O outro "Associados". Este é o de quem responde pelo acervo: curar
    // exercício e decidir sugestão. Fica no painel porque é administração, e
    // não o trabalho de quem usa as dinâmicas.
    id: "associados-admin",
    rotulo: "Associados",
    href: "/formacao/admin/associados",
    resumo: "Curadoria do acervo de dinâmicas e a fila de sugestões.",
    cargos: [],
    onde: ["painel"],
  },
  {
    id: "dashboard",
    rotulo: "Dashboard",
    href: "/formacao/admin",
    cargos: ["instructor"],
    onde: ["painel"],
    grupo: "formacao",
  },
  {
    id: "formacao-base",
    rotulo: "Formação",
    href: "/formacao/admin/formacao-base",
    cargos: ["instructor"],
    onde: ["painel"],
    grupo: "formacao",
  },
  {
    // A tela que junta os três lugares onde a mesma pessoa aparece: o formulário
    // de certificado, a sala do Meet e a plataforma. Fica ao lado da Formação
    // porque é dela que se olha para decidir com quem falar.
    id: "pessoas",
    rotulo: "Pessoas",
    href: "/formacao/admin/pessoas",
    resumo: "Quem volta, quem sumiu e com quem vale conversar.",
    // Só administrador, e a lista vazia é o que diz isso. Não é zelo excessivo:
    // a tela cruza e-mail, telefone e presença de gente que nunca pediu conta
    // na plataforma, e as tabelas por trás dela têm policy `is_admin()`. Com
    // `instructor` aqui, o instrutor entraria numa tela que carrega para sempre
    // e nunca saberia que o problema é permissão.
    cargos: [],
    onde: ["painel"],
    grupo: "formacao",
  },
  {
    // Os encontros síncronos vistos como grupo: quórum, tendência, quem sumiu.
    // Ganhou porta própria porque respondia a uma pergunta que estava espalhada
    // entre o dashboard, o calendário e as estatísticas, com três réguas de
    // tempo diferentes e nenhuma tela avisando das outras.
    id: "grupos",
    rotulo: "Grupos",
    href: "/formacao/admin/grupos",
    resumo: "Qual grupo está crescendo, qual está encolhendo, e se é o horário.",
    // Mesmo motivo de Pessoas: a tela lista nome de participante e as tabelas
    // do Meet têm policy `is_admin()`.
    cargos: [],
    onde: ["painel"],
    grupo: "formacao",
  },
  {
    // Quem conduz, visto por si. Antes era só um cadastro escondido numa aba
    // dentro de Formação, sem nenhuma porta na barra lateral, e o que se dizia
    // sobre condutor estava repartido entre quatro telas com quatro definições.
    id: "condutores",
    rotulo: "Condutores",
    href: "/formacao/admin/condutores",
    resumo: "Os feedbacks de cada condutor e o quórum dos grupos dele.",
    cargos: [],
    onde: ["painel"],
    grupo: "formacao",
  },
  {
    id: "certificados",
    rotulo: "Certificados",
    href: "/formacao/admin/certificados",
    cargos: ["instructor"],
    onde: ["painel"],
    grupo: "formacao",
  },
  {
    id: "moderacao",
    rotulo: "Moderação",
    href: "/formacao/admin/moderacao",
    cargos: ["instructor"],
    onde: ["painel"],
    grupo: "formacao",
  },
  {
    id: "configuracoes",
    rotulo: "Configurações",
    href: "/formacao/admin/configuracoes",
    cargos: [],
    onde: ["painel"],
    grupo: "sistema",
  },
];

// =============================================================
// As subseções de /formacao/associados
// =============================================================
// As três coisas que estavam em três cantos do sistema. É a mesma pessoa
// usando: quem conduz um grupo procura uma dinâmica para levar nele, e às
// vezes cuida de um evento. Cada uma aparece só para quem lhe cabe, e quem tem
// um cargo só vê uma subseção — o que está certo, e continua sendo um lugar
// que faz sentido.

export interface Secao {
  id: string;
  rotulo: string;
  href: string;
  resumo: string;
  cargos: Cargo[];
}

export const SECOES: Secao[] = [
  {
    id: "sincrono",
    rotulo: "Síncrono",
    href: `${CASA_DOS_ASSOCIADOS}/sincrono`,
    resumo:
      "O encontro da semana: o que gravar, quem entra, e a curadoria do que saiu dele.",
    cargos: ["condutor"],
  },
  {
    id: "aprimoramento",
    rotulo: "Aprimoramento",
    href: `${CASA_DOS_ASSOCIADOS}/aprimoramento`,
    resumo: "O acervo de dinâmicas: trilhas, categorias e o que já foi curado.",
    cargos: ["associado", "condutor"],
  },
  {
    id: "eventos",
    rotulo: "Eventos",
    href: `${CASA_DOS_ASSOCIADOS}/eventos`,
    resumo: "Os eventos que aparecem no calendário público da formação.",
    cargos: ["eventos"],
  },
];

/** Os cargos que dão entrada em /formacao/associados. */
export const CARGOS_DOS_ASSOCIADOS: Cargo[] = ["associado", "condutor", "eventos"];

export const AREA_POR_ID: Record<string, Area> = Object.fromEntries(
  AREAS.map((a) => [a.id, a])
);

/** Esta pessoa alcança esta área? */
export function podeVer(area: Area | Secao, cargos: Set<string>): boolean {
  return conjuntoTemAlgum(cargos, area.cargos);
}

/** As áreas do menu do site que cabem a esta pessoa. */
export function areasDoSite(cargos: Set<string>): Area[] {
  return AREAS.filter((a) => a.onde.includes("site") && podeVer(a, cargos));
}

/** As áreas do painel que cabem a esta pessoa. */
export function areasDoPainel(cargos: Set<string>): Area[] {
  return AREAS.filter((a) => a.onde.includes("painel") && podeVer(a, cargos));
}

/** As subseções de /formacao/associados que cabem a esta pessoa. */
export function secoesDaPessoa(cargos: Set<string>): Secao[] {
  return SECOES.filter((s) => podeVer(s, cargos));
}

/**
 * Quem circula pelo painel inteiro.
 *
 * O painel é de quem administra. Condutor, eventos e associado não entram —
 * eles têm a própria casa, no site.
 */
export function circulaLivre(cargos: Set<string>): boolean {
  return cargos.has("admin") || cargos.has("instructor");
}

/**
 * Os caminhos do painel que esta pessoa pode abrir.
 *
 * Só serve ao middleware, que compara por prefixo e não conhece React.
 */
export function caminhosDoPainel(cargos: Set<string>): string[] {
  return areasDoPainel(cargos)
    .filter((a) => a.href.startsWith("/formacao/admin"))
    .map((a) => a.href);
}

/**
 * O caminho pedido é de uma área que esta pessoa NÃO alcança?
 *
 * `circulaLivre` existe porque o painel tem dezenas de telas fora do catálogo
 * (alunos, cursos, categorias, atalhos) e prender o professor às poucas áreas
 * catalogadas fecharia todas elas. Só que "circula livre" acabou valendo também
 * para as áreas que o catálogo marca como exclusivas do administrador — o menu
 * escondia Configurações do professor, e digitar o endereço abria a tela assim
 * mesmo, com a lista de contas e o botão de trocar cargo à vista.
 *
 * Aqui a pergunta é ao contrário da outra: não é "onde ela pode ir", é "este
 * lugar tem dono, e não é ela?". Quem circula livre continua alcançando tudo
 * que o catálogo não reivindica.
 */
export function areaProibida(pathname: string, cargos: Set<string>): boolean {
  return AREAS.some((a) => {
    if (!a.href.startsWith("/formacao/admin")) return false;
    // A raiz do painel é o Dashboard e casa por igualdade apenas: com prefixo
    // ela cobriria todas as telas do painel, e negar o Dashboard a alguém
    // fecharia junto tudo o que não tem dono no catálogo. Mesma convenção do
    // menu e do gate de rota.
    const casa =
      a.href === "/formacao/admin"
        ? pathname === a.href
        : pathname === a.href || pathname.startsWith(`${a.href}/`);
    return casa && !podeVer(a, cargos);
  });
}

/** Onde esta pessoa cai ao abrir o painel. */
export function homeDoPainel(cargos: Set<string>): string {
  if (circulaLivre(cargos)) return "/formacao/admin";
  return homeDaPessoa(cargos);
}

/**
 * A primeira tela de /formacao/associados para esta pessoa.
 *
 * Quem tem um cargo só é levado direto à subseção dele: uma tela de índice com
 * um card só não conta nada que a própria subseção não conte melhor.
 */
export function homeDosAssociados(cargos: Set<string>): string | null {
  const suas = secoesDaPessoa(cargos);
  if (!suas.length) return null;
  return suas[0].href;
}

/**
 * Onde mandar alguém que caiu num lugar que não é dela.
 *
 * Administrador e professor vão para o painel; quem trabalha nos grupos vai
 * para a própria casa; o resto vai para o site.
 */
export function homeDaPessoa(cargos: Set<string>): string {
  if (circulaLivre(cargos)) return "/formacao/admin";
  return homeDosAssociados(cargos) || "/formacao";
}
