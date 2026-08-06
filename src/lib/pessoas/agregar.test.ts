// O retrato de pessoas, medido contra o banco de verdade.
//
// Este teste não usa dado inventado, e é de propósito. As regras que o retrato
// precisa cumprir são sobre a diferença entre o que a definição manda e o que o
// seletor pede, e nenhuma delas aparece num fixture pequeno:
//
//   1. O seletor de período NÃO pode mexer no núcleo. Medido em 06/08/2026, com
//      o seletor em "hoje" um núcleo que obedecesse ao seletor seria zero, e em
//      quinze dias também zero, contra quatro na definição de sessenta dias. Se
//      algum dia alguém ligar o núcleo ao seletor, a tela vai anunciar que a
//      formação acabou num dia em que nada aconteceu.
//   2. A lista de pessoas encolhe com o período, e os totais encolhem junto.
//   3. O que a pessoa é (veio uma vez só, escreve relato) continua vindo da
//      vida inteira dela, mesmo com o período curto.
//   4. Cada pessoa tem exatamente um estado, e a soma dos estados fecha com o
//      total. Um estado sobrando ou faltando quebra os contadores dos recortes.
//
// Roda só quando existe credencial de leitura no ambiente. Sem ela o teste se
// declara pulado em vez de falhar, porque falhar por falta de segredo treina
// todo mundo a ignorar a saída vermelha.

import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { montarRetrato } from "./agregar";

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const temCredencial = Boolean(URL && CHAVE);

describe.skipIf(!temCredencial)("montarRetrato contra o banco", () => {
  const sb = () => createClient(URL!, CHAVE!, { auth: { persistSession: false } });

  it("mantém a régua do núcleo mesmo com o seletor em hoje", async () => {
    const [tudo, hoje] = await Promise.all([
      montarRetrato(sb(), { janela: "all" }),
      montarRetrato(sb(), { janela: "today" }),
    ]);

    expect(hoje.nucleo.total).toBe(tudo.nucleo.total);
    expect(hoje.nucleo.serie).toEqual(tudo.nucleo.serie);
    expect(hoje.sumidos.semSinal.length).toBe(tudo.sumidos.semSinal.length);
    expect(hoje.coortes).toEqual(tudo.coortes);
    // O núcleo existe. Se este número zerar, ou a base mudou de verdade ou
    // alguém ligou a definição ao seletor.
    expect(tudo.nucleo.total).toBeGreaterThan(0);
  }, 60_000);

  it("encolhe a lista conforme a janela aperta, sem nunca crescer", async () => {
    const janelas = ["all", "90d", "30d", "today"] as const;
    const retratos = [];
    for (const j of janelas) retratos.push(await montarRetrato(sb(), { janela: j }));

    for (let i = 1; i < retratos.length; i++) {
      expect(retratos[i].pessoas.length).toBeLessThanOrEqual(retratos[i - 1].pessoas.length);
      expect(retratos[i].totais.pessoas).toBe(retratos[i].pessoas.length);
    }
    // O denominador honesto não se mexe: é quanta gente a base conhece.
    const base = retratos.map((r) => r.totais.pessoasNaBase);
    expect(new Set(base).size).toBe(1);
  }, 120_000);

  it("lê o histórico inteiro da pessoa mesmo dentro de uma janela curta", async () => {
    const r = await montarRetrato(sb(), { janela: "30d" });
    for (const p of r.pessoas) {
      // Presença na janela nunca pode passar da presença de sempre.
      expect(p.encontrosNoPeriodo).toBeLessThanOrEqual(p.encontros);
    }
    const comHistorico = r.pessoas.filter((p) => p.encontros > p.encontrosNoPeriodo);
    // Numa janela de trinta dias sobre uma base que começou em abril, tem que
    // existir gente cuja história é maior que a janela. Se não existir, o
    // recorte está apagando o passado em vez de filtrar a lista.
    expect(comHistorico.length).toBeGreaterThan(0);
  }, 60_000);

  it("devolve o retrato do seletivo sem quebrar quando ainda não houve importação", async () => {
    const r = await montarRetrato(sb(), { janela: "all" });
    expect(r.seletivo).toBeDefined();
    expect(r.seletivo.aprovados + r.seletivo.rejeitados + r.seletivo.semStatus)
      .toBeLessThanOrEqual(r.seletivo.candidatos);
    // Aprovado que veio e aprovado que não veio são partições, não conjuntos
    // que se cruzam.
    const vieram = new Set(r.seletivo.aprovadosQueVieram.map((p) => p.id));
    for (const p of r.seletivo.aprovadosQueNaoVieram) expect(vieram.has(p.id)).toBe(false);
  }, 60_000);

  it("dá exatamente um estado a cada pessoa, e a soma fecha", async () => {
    const r = await montarRetrato(sb(), { janela: "all" });
    const soma = Object.values(r.estados).reduce((s, n) => s + n, 0);
    expect(soma).toBe(r.pessoas.length);

    // O núcleo do bloco de cima e o recorte da lista são a mesma gente. Se
    // divergirem, a tela mostra um número no topo e outro no chip.
    expect(r.estados.nucleo).toBe(r.nucleo.total);
    expect(r.nucleo.pessoas.length).toBe(r.nucleo.total);
    for (const p of r.nucleo.pessoas) {
      expect(p.estado).toBe("nucleo");
      expect(p.encontrosRecentes).toBeGreaterThanOrEqual(r.regras.barraNucleo);
    }

    // Ninguém entra em "sumiu" ou "esfriando" sem histórico: sem esse piso,
    // quem veio uma vez em abril apareceria como pessoa que a formação perdeu.
    for (const p of r.pessoas) {
      if (p.estado === "sumiu" || p.estado === "esfriando") {
        expect(p.encontros).toBeGreaterThanOrEqual(3);
      }
      if (p.estado === "so-assiste" || p.estado === "sem-sinal") {
        expect(p.encontros).toBe(0);
      }
    }
  }, 60_000);

  it("não perde os destaques quando o período aperta", async () => {
    // Marcar alguém é dizer "lembra desta pessoa". Ela sumir da tela porque não
    // apareceu nos últimos quinze dias é o contrário do que a marca serve.
    const [tudo, hoje] = await Promise.all([
      montarRetrato(sb(), { janela: "all" }),
      montarRetrato(sb(), { janela: "today" }),
    ]);
    expect(hoje.destacadas.length).toBe(tudo.destacadas.length);
    expect(hoje.totais.destacadas).toBe(tudo.totais.destacadas);
  }, 60_000);
});
