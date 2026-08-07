import { describe, it, expect } from "vitest";
import { semanaQueEstaFechando } from "./status-slots";
import { dataLocal } from "./nomes";

/** Meio-dia UTC é sempre o mesmo dia em Brasília, e tira o fuso da conta. */
const em = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("semanaQueEstaFechando", () => {
  it("na segunda, fecha a semana ANTERIOR", () => {
    // É o momento do cron. Os status dos slots ainda descrevem a semana que
    // acabou de passar, e é ela que precisa virar retrato antes de zerar.
    // 2026-08-10 é segunda; a semana que acabou começou em 2026-08-03.
    expect(dataLocal(semanaQueEstaFechando(em("2026-08-10")))).toBe("2026-08-03");
  });

  it("no meio da semana, fecha a semana CORRENTE", () => {
    // É o momento do botão manual. Quem clica na quarta está encerrando a
    // semana em que está, não a de trás, e os status falam dela.
    expect(dataLocal(semanaQueEstaFechando(em("2026-08-12")))).toBe("2026-08-10");
    expect(dataLocal(semanaQueEstaFechando(em("2026-08-14")))).toBe("2026-08-10");
  });

  it("⛔ o botão e o cron nomeiam a MESMA semana quando rodam no mesmo dia", () => {
    // Este é o defeito que a função existe para não deixar voltar. O botão
    // gravava a segunda corrente e o cron a anterior: um clique numa segunda
    // fazia o cron da semana seguinte encontrar o snapshot já criado, sair sem
    // fazer nada, e a semana passar sem fechamento, com os status vazando.
    const segunda = em("2026-08-10");
    expect(dataLocal(semanaQueEstaFechando(segunda))).toBe(
      dataLocal(semanaQueEstaFechando(segunda)),
    );
    // E a semana fechada na segunda nunca é a que está começando.
    expect(dataLocal(semanaQueEstaFechando(segunda))).not.toBe("2026-08-10");
  });

  it("o domingo pertence à semana que começou na segunda anterior", () => {
    // `dia_semana` da casa é 0 para segunda e 6 para domingo, e não a convenção
    // do JavaScript: domingo 16/08 fecha com a segunda de 10/08.
    expect(dataLocal(semanaQueEstaFechando(em("2026-08-16")))).toBe("2026-08-10");
  });
});
