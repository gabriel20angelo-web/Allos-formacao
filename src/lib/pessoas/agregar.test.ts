// O retrato de pessoas, medido contra o banco de verdade.
//
// Este teste não usa dado inventado, e é de propósito. As três regras que o
// retrato precisa cumprir são todas sobre a diferença entre o que a definição
// manda e o que o seletor pede, e nenhuma delas aparece num fixture pequeno:
//
//   1. A janela do seletor NÃO pode mexer no núcleo. Medido em 06/08/2026, com
//      a janela em "hoje" o núcleo por janela seria zero e em quinze dias
//      também zero, contra vinte na definição de noventa dias. Se algum dia
//      alguém ligar o núcleo ao seletor, a tela vai anunciar que a formação
//      acabou num dia em que nada aconteceu.
//   2. A lista de pessoas encolhe com a janela, e os totais encolhem junto.
//   3. O que a pessoa é (veio uma vez só, escreve relato) continua vindo da
//      vida inteira dela, mesmo quando a janela é curta.
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

  it("mantém o núcleo em noventa dias mesmo com a janela em hoje", async () => {
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
      expect(p.presencasJanela).toBeLessThanOrEqual(p.presencas);
    }
    const comHistorico = r.pessoas.filter((p) => p.presencas > p.presencasJanela);
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
});
