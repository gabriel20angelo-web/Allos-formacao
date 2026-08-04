// A matriz de cargos, travada.
//
// Este é o teste que teria pego os dois erros que custaram caro. O primeiro: a
// navegação do painel decidia com um ternário — eventos, senão condutor, senão
// tudo — e quem acumulava os dois cargos perdia uma das áreas, enquanto um
// administrador com o cargo de eventos marcado perdia o painel inteiro. O
// segundo: cinco páginas comparavam `role` direto, então quem tinha o cargo na
// lista de extras via o link e levava um redirect ao clicar.
//
// Nenhum dos dois aparecia como erro. A área continuava existindo e
// funcionando; só ninguém chegava nela.

import { describe, it, expect } from "vitest";
import { cargosDe, temAlgumCargo, conjuntoTemAlgum } from "./cargos";
import {
  areasDoSite,
  areasDoPainel,
  caminhosDoPainel,
  circulaLivre,
  homeDaPessoa,
  homeDoPainel,
  homeDosAssociados,
  secoesDaPessoa,
} from "./areas";

/** Uma pessoa, do jeito que ela sai de `profiles`. */
const quem = (role: string, ...extras: string[]) => ({ role, cargos: extras });

const idsDoSite = (p: { role: string; cargos: string[] }) =>
  areasDoSite(cargosDe(p)).map((a) => a.id);
const idsDoPainel = (p: { role: string; cargos: string[] }) =>
  areasDoPainel(cargosDe(p)).map((a) => a.id);
const idsDasSecoes = (p: { role: string; cargos: string[] }) =>
  secoesDaPessoa(cargosDe(p)).map((s) => s.id);

describe("cargos acumuláveis", () => {
  it("junta o papel principal e os extras", () => {
    expect(cargosDe(quem("eventos", "condutor"))).toEqual(new Set(["eventos", "condutor"]));
  });

  it("ignora o perfil ausente em vez de estourar", () => {
    expect(cargosDe(null)).toEqual(new Set());
    expect(temAlgumCargo(null, ["condutor"])).toBe(false);
  });

  it("deixa o administrador passar sem que 'admin' esteja na lista pedida", () => {
    expect(temAlgumCargo(quem("admin"), ["condutor"])).toBe(true);
    expect(conjuntoTemAlgum(new Set(["admin"]), [])).toBe(true);
  });

  it("reconhece o administrador que tem 'admin' entre os extras", () => {
    // O caso que quebrava as rotas do condutor: papel principal trocado para
    // condutor, administração mantida na lista de extras.
    expect(temAlgumCargo(quem("condutor", "admin"), ["eventos"])).toBe(true);
  });

  it("não deixa passar quem não tem nenhum dos cargos", () => {
    expect(temAlgumCargo(quem("student"), ["associado", "condutor"])).toBe(false);
  });
});

describe("o painel é de quem administra", () => {
  it("condutor não entra no painel", () => {
    // A casca escura dizia que essa gente administra a plataforma, e não é o
    // caso: elas fazem o trabalho delas, no site.
    expect(caminhosDoPainel(cargosDe(quem("condutor")))).toEqual([]);
    expect(circulaLivre(cargosDe(quem("condutor")))).toBe(false);
  });

  it("quem cuida de eventos não entra no painel", () => {
    expect(caminhosDoPainel(cargosDe(quem("eventos")))).toEqual([]);
  });

  it("associado não entra no painel", () => {
    expect(caminhosDoPainel(cargosDe(quem("associado")))).toEqual([]);
  });

  it("nem quem acumula os três cargos entra", () => {
    expect(caminhosDoPainel(cargosDe(quem("condutor", "eventos", "associado")))).toEqual([]);
  });

  it("administrador vê o painel inteiro", () => {
    expect(idsDoPainel(quem("admin"))).toEqual([
      "associados-admin",
      "dashboard",
      "formacao-base",
      "certificados",
      "moderacao",
      "configuracoes",
    ]);
  });

  it("professor vê o painel menos o que é só do administrador", () => {
    const ids = idsDoPainel(quem("instructor"));
    expect(ids).toContain("dashboard");
    expect(ids).toContain("certificados");
    expect(ids).toContain("moderacao");
    expect(ids).not.toContain("configuracoes");
    expect(ids).not.toContain("associados-admin");
  });

  it("o grupo Condução não existe mais no painel", () => {
    const ids = idsDoPainel(quem("admin"));
    for (const sumido of ["conducao", "meu-grupo", "dinamicas", "eventos"]) {
      expect(ids).not.toContain(sumido);
    }
  });
});

describe("a casa de quem trabalha nos grupos", () => {
  it("aparece no menu do site para os três cargos", () => {
    for (const p of [quem("associado"), quem("condutor"), quem("eventos")]) {
      expect(idsDoSite(p)).toEqual(["associados"]);
    }
  });

  it("não aparece para aluno nem para quem não está logado", () => {
    expect(idsDoSite(quem("student"))).toEqual([]);
    expect(areasDoSite(new Set())).toEqual([]);
  });

  it("condutor vê Síncrono e Aprimoramento, não os Eventos", () => {
    expect(idsDasSecoes(quem("condutor"))).toEqual(["sincrono", "aprimoramento"]);
  });

  it("associado vê só o Aprimoramento", () => {
    expect(idsDasSecoes(quem("associado"))).toEqual(["aprimoramento"]);
  });

  it("quem cuida de eventos vê só os Eventos", () => {
    // O Aprimoramento saiu do contrato deste cargo: quem cuida do calendário
    // não trabalha com dinâmicas de grupo.
    expect(idsDasSecoes(quem("eventos"))).toEqual(["eventos"]);
  });

  it("quem acumula eventos e condução vê as três", () => {
    // Era o caso que o ternário do painel apagava.
    expect(idsDasSecoes(quem("eventos", "condutor"))).toEqual([
      "sincrono",
      "aprimoramento",
      "eventos",
    ]);
  });

  it("administrador vê as três", () => {
    expect(idsDasSecoes(quem("admin"))).toEqual(["sincrono", "aprimoramento", "eventos"]);
  });

  it("aluno não vê nenhuma", () => {
    expect(idsDasSecoes(quem("student"))).toEqual([]);
    expect(homeDosAssociados(cargosDe(quem("student")))).toBeNull();
  });
});

describe("para onde cada pessoa é mandada", () => {
  it("quem tem um cargo só cai direto na subseção dele", () => {
    expect(homeDaPessoa(cargosDe(quem("condutor")))).toBe("/formacao/associados/sincrono");
    expect(homeDaPessoa(cargosDe(quem("associado")))).toBe(
      "/formacao/associados/aprimoramento"
    );
    expect(homeDaPessoa(cargosDe(quem("eventos")))).toBe("/formacao/associados/eventos");
  });

  it("administrador e professor vão para o painel", () => {
    expect(homeDaPessoa(cargosDe(quem("admin")))).toBe("/formacao/admin");
    expect(homeDoPainel(cargosDe(quem("instructor")))).toBe("/formacao/admin");
  });

  it("quem não tem nada vai para o site", () => {
    expect(homeDaPessoa(cargosDe(quem("student")))).toBe("/formacao");
  });

  it("o condutor expulso do painel cai na casa dele, não na home", () => {
    // Sem isto ele seria despejado em /formacao e teria de descobrir sozinho
    // onde fica o trabalho dele.
    expect(homeDoPainel(cargosDe(quem("condutor")))).toBe("/formacao/associados/sincrono");
  });
});
