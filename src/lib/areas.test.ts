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
  homeDoPainel,
} from "./areas";

/** Uma pessoa, do jeito que ela sai de `profiles`. */
const quem = (role: string, ...extras: string[]) => ({ role, cargos: extras });

const idsDoSite = (p: { role: string; cargos: string[] }) =>
  areasDoSite(cargosDe(p)).map((a) => a.id);
const idsDoPainel = (p: { role: string; cargos: string[] }) =>
  areasDoPainel(cargosDe(p)).map((a) => a.id);

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

describe("o que cada pessoa vê no menu do site", () => {
  it("associado vê o Aprimoramento e mais nada de restrito", () => {
    expect(idsDoSite(quem("associado"))).toEqual(["dinamicas"]);
  });

  it("condutor vê o próprio grupo e o Aprimoramento, não os eventos", () => {
    expect(idsDoSite(quem("condutor")).sort()).toEqual(["dinamicas", "meu-grupo"]);
  });

  it("quem cuida de eventos vê só os eventos", () => {
    // O Aprimoramento saiu do contrato deste cargo: quem cuida do calendário
    // não trabalha com dinâmicas de grupo.
    expect(idsDoSite(quem("eventos"))).toEqual(["eventos"]);
  });

  it("administrador vê tudo", () => {
    expect(idsDoSite(quem("admin")).sort()).toEqual(["dinamicas", "eventos", "meu-grupo"]);
  });

  it("aluno não vê nenhuma área restrita", () => {
    expect(idsDoSite(quem("student"))).toEqual([]);
  });

  it("quem não está logado não vê nada restrito", () => {
    expect(areasDoSite(new Set())).toEqual([]);
  });
});

describe("quem acumula cargo não perde área", () => {
  it("eventos + condutor alcança as duas áreas", () => {
    // Era o caso que o ternário apagava: a pessoa via só Eventos, e a tela do
    // grupo dela ficava sem link apontando para ela.
    const ids = idsDoPainel(quem("eventos", "condutor"));
    expect(ids).toContain("eventos");
    expect(ids).toContain("meu-grupo");
  });

  it("administrador com o cargo de eventos não perde o painel", () => {
    // O outro lado do mesmo ternário: `isEventos` já incluía os extras, então
    // o administrador caía no primeiro ramo e ficava só com Eventos.
    const ids = idsDoPainel(quem("admin", "eventos"));
    expect(ids).toContain("dashboard");
    expect(ids).toContain("configuracoes");
    expect(homeDoPainel(cargosDe(quem("admin", "eventos")))).toBe("/formacao/admin");
  });
});

describe("o gate de rota do painel", () => {
  it("manda o condutor para o hub, não para uma área solta", () => {
    // Cair direto na tela do grupo não conta que existem as outras duas.
    expect(homeDoPainel(cargosDe(quem("condutor")))).toBe("/formacao/admin/conducao");
  });

  it("prende o condutor às áreas dele", () => {
    const caminhos = caminhosDoPainel(cargosDe(quem("condutor")));
    expect(caminhos).toContain("/formacao/admin/conducao");
    expect(caminhos).toContain("/formacao/admin/meu-grupo");
    expect(caminhos).not.toContain("/formacao/admin/eventos");
    expect(caminhos).not.toContain("/formacao/admin/configuracoes");
  });

  it("deixa de fora as áreas que saem do painel", () => {
    // O Aprimoramento mora fora de /formacao/admin. Se entrasse nesta lista, o
    // middleware compararia um prefixo que nunca casa e prenderia a pessoa.
    expect(caminhosDoPainel(cargosDe(quem("condutor")))).not.toContain(
      "/formacao/aprimoramento-dinamicas"
    );
  });

  it("não deixa o painel inteiro aberto por causa do prefixo do dashboard", () => {
    // `/formacao/admin` casa por prefixo com todo o painel. Enquanto ele só
    // couber a quem circula livre, isso é inofensivo — este teste é o alarme
    // para o dia em que alguém der o dashboard a um cargo restrito.
    for (const p of [quem("condutor"), quem("eventos"), quem("condutor", "eventos")]) {
      expect(caminhosDoPainel(cargosDe(p))).not.toContain("/formacao/admin");
    }
  });

  it("nega o painel a quem não tem área nenhuma nele", () => {
    expect(caminhosDoPainel(cargosDe(quem("associado")))).toEqual([]);
    expect(caminhosDoPainel(cargosDe(quem("student")))).toEqual([]);
  });

  it("só administrador e professor circulam livres", () => {
    expect(circulaLivre(cargosDe(quem("admin")))).toBe(true);
    expect(circulaLivre(cargosDe(quem("instructor")))).toBe(true);
    expect(circulaLivre(cargosDe(quem("condutor", "eventos")))).toBe(false);
  });
});
