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
// O que este arquivo NÃO faz: proteger nada. Ele governa a tela e o gate de
// rota, que são a mesma resposta dita duas vezes — a proteção de verdade está
// nas policies do Postgres, e as duas precisam ser conferidas juntas quando um
// cargo ganha ou perde uma área.

import type { Cargo } from "./cargos";
import { conjuntoTemAlgum } from "./cargos";

/** As seções da navegação do painel, na ordem em que aparecem. */
export type GrupoPainel = "conducao" | "formacao" | "sistema";

export const GRUPOS: { id: GrupoPainel; titulo: string }[] = [
  // Quem conduz um grupo, quem cuida dos eventos e quem responde pelos
  // associados fazem partes do mesmo trabalho, e antes estavam em três cantos
  // diferentes do painel.
  { id: "conducao", titulo: "Condução" },
  { id: "formacao", titulo: "Formação" },
  { id: "sistema", titulo: "Sistema" },
];

export interface Area {
  id: string;
  /** Como se chama para quem trabalha nela. */
  rotulo: string;
  /**
   * Como o administrador a chama, quando o nome muda de dono.
   *
   * Para quem conduz, a tela do grupo é "Meu grupo". Para quem administra, a
   * mesma tela é "Visão do condutor" — não é o grupo dele, é o que o condutor
   * está vendo. Um nome só obrigaria um dos dois a ler a frase errada.
   */
  rotuloAdmin?: string;
  href: string;
  /** Uma frase sobre o que se faz aqui. Aparece nos cards do hub. */
  resumo?: string;
  /**
   * Quem vê. O administrador não entra nesta lista: passa em tudo, e repetir
   * "admin" em cada linha é a repetição que alguém esquece justamente na linha
   * que importa. Lista vazia = só administrador.
   */
  cargos: Cargo[];
  /** Em que menus ela aparece. */
  onde: ("site" | "painel")[];
  grupo?: GrupoPainel;
  /**
   * O link sai do painel e cai no site. O Aprimoramento mora fora de /admin
   * porque quem usa não está administrando nada — está procurando uma dinâmica
   * para o encontro de amanhã.
   */
  saiDoPainel?: boolean;
}

/**
 * O catálogo.
 *
 * A ordem importa: é a ordem da tela, e o primeiro item que couber para uma
 * pessoa vira o destino dela quando ela abre o painel.
 */
export const AREAS: Area[] = [
  {
    id: "conducao",
    rotulo: "Início",
    rotuloAdmin: "Condução",
    href: "/formacao/admin/conducao",
    resumo: "O ponto de partida de quem conduz: o seu grupo, as dinâmicas e os eventos num lugar só.",
    cargos: ["condutor", "eventos"],
    onde: ["painel"],
    grupo: "conducao",
  },
  {
    id: "meu-grupo",
    rotulo: "Meu grupo",
    rotuloAdmin: "Visão do condutor",
    href: "/formacao/admin/meu-grupo",
    resumo:
      "Os ajustes do encontro da semana — gravar, transcrever, abrir a porta — e a curadoria do que saiu dele.",
    cargos: ["condutor"],
    onde: ["site", "painel"],
    grupo: "conducao",
  },
  {
    id: "dinamicas",
    rotulo: "Aprimoramento",
    href: "/formacao/aprimoramento-dinamicas",
    resumo:
      "O acervo de exercícios para levar ao grupo: trilhas, categorias e o que já foi curado.",
    cargos: ["associado", "condutor"],
    onde: ["site", "painel"],
    grupo: "conducao",
    saiDoPainel: true,
  },
  {
    id: "eventos",
    rotulo: "Eventos",
    href: "/formacao/admin/eventos",
    resumo: "Os eventos que aparecem no calendário público da formação.",
    cargos: ["eventos"],
    onde: ["site", "painel"],
    grupo: "conducao",
  },
  {
    id: "associados",
    rotulo: "Associados",
    href: "/formacao/admin/associados",
    resumo:
      "A curadoria do acervo de dinâmicas e a fila de sugestões que os associados mandam.",
    cargos: [],
    onde: ["painel"],
    grupo: "conducao",
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

export const AREA_POR_ID: Record<string, Area> = Object.fromEntries(
  AREAS.map((a) => [a.id, a])
);

/** Esta pessoa alcança esta área? */
export function podeVer(area: Area, cargos: Set<string>): boolean {
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

/**
 * Quem circula pelo painel inteiro.
 *
 * Um cargo restrito entra no painel e fica na própria área; estes dois andam
 * por tudo, então não são presos a lugar nenhum.
 */
export function circulaLivre(cargos: Set<string>): boolean {
  return cargos.has("admin") || cargos.has("instructor");
}

/**
 * Onde esta pessoa cai ao abrir o painel.
 *
 * Administrador vai para o Dashboard. Cargo restrito vai para o próprio começo
 * — que é o hub, quando ele couber, e não a primeira tela solta que aparecer:
 * cair direto numa área não conta que existem as outras duas.
 */
export function homeDoPainel(cargos: Set<string>): string {
  if (circulaLivre(cargos)) return "/formacao/admin";
  const suas = areasDoPainel(cargos);
  return suas[0]?.href || "/formacao";
}

/**
 * Os caminhos do painel que um cargo restrito pode abrir.
 *
 * Só serve ao middleware, que compara por prefixo e não conhece React. Áreas
 * que saem do painel ficam de fora: elas não são /formacao/admin.
 */
export function caminhosDoPainel(cargos: Set<string>): string[] {
  return areasDoPainel(cargos)
    .filter((a) => !a.saiDoPainel && a.href.startsWith("/formacao/admin"))
    .map((a) => a.href);
}
