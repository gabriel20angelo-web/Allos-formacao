import { describe, expect, it } from "vitest";
import { auditarCargaHoraria } from "./auditoria";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock mínimo do encadeamento do supabase-js: cada tabela devolve o que o
// teste programou. O que importa aqui não é o cliente, é a decisão.
function fakeSb(dados: {
  curso?: { total_duration_minutes: number | null } | null;
  aulas?: { duration_minutes: number | null }[];
  sessoesCurso?: { seconds: number }[];
  totalSessoesDoUsuario?: number;
}): SupabaseClient {
  const builder = (tabela: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    ["select", "eq", "in", "not", "order", "limit"].forEach((m) => {
      chain[m] = (..._args: unknown[]) => {
        // `select("id", { count: "exact", head: true })` na contagem de sessões
        if (
          m === "select" &&
          tabela === "usage_sessions" &&
          typeof _args[1] === "object" &&
          _args[1] !== null
        ) {
          chain.__contagem = true;
        }
        return self();
      };
    });
    chain.maybeSingle = async () => ({ data: dados.curso ?? null });
    chain.then = undefined;
    // consumo direto (await na query) para listas
    (chain as { then?: unknown }).then = (resolve: (v: unknown) => void) => {
      if (tabela === "sections") return resolve({ data: [{ id: "sec-1" }] });
      if (tabela === "lessons") return resolve({ data: dados.aulas ?? [] });
      if (tabela === "usage_sessions") {
        if (chain.__contagem) {
          return resolve({ count: dados.totalSessoesDoUsuario ?? 0 });
        }
        return resolve({ data: dados.sessoesCurso ?? [] });
      }
      return resolve({ data: [] });
    };
    return chain;
  };
  return { from: (t: string) => builder(t) } as unknown as SupabaseClient;
}

describe("auditarCargaHoraria", () => {
  it("não retém quando o curso não tem duração cadastrada", async () => {
    const sb = fakeSb({ curso: { total_duration_minutes: null }, aulas: [] });
    const r = await auditarCargaHoraria(sb, "u1", "c1");
    expect(r.reter).toBe(false);
  });

  it("não retém quem nunca teve tempo registrado (anterior ao rastreio)", async () => {
    const sb = fakeSb({
      curso: { total_duration_minutes: 120 },
      sessoesCurso: [],
      totalSessoesDoUsuario: 0,
    });
    const r = await auditarCargaHoraria(sb, "u1", "c1");
    expect(r.reter).toBe(false);
  });

  it("retém quem usa a plataforma mas passou longe da carga do curso", async () => {
    const sb = fakeSb({
      curso: { total_duration_minutes: 120 },
      sessoesCurso: [{ seconds: 300 }], // 5 min de 120
      totalSessoesDoUsuario: 40,
    });
    const r = await auditarCargaHoraria(sb, "u1", "c1");
    expect(r.reter).toBe(true);
    expect(r.motivo).toContain("5 min");
    expect(r.motivo).toContain("120 min");
    expect(r.segundosRegistrados).toBe(300);
  });

  it("não retém quem passou do limite de proporção", async () => {
    const sb = fakeSb({
      curso: { total_duration_minutes: 100 },
      sessoesCurso: [{ seconds: 60 * 45 }], // 45 de 100 = 45%
      totalSessoesDoUsuario: 10,
    });
    const r = await auditarCargaHoraria(sb, "u1", "c1");
    expect(r.reter).toBe(false);
  });

  it("cai para a soma das aulas quando o curso não tem duração agregada", async () => {
    const sb = fakeSb({
      curso: { total_duration_minutes: 0 },
      aulas: [{ duration_minutes: 30 }, { duration_minutes: 30 }],
      sessoesCurso: [{ seconds: 120 }], // 2 min de 60
      totalSessoesDoUsuario: 5,
    });
    const r = await auditarCargaHoraria(sb, "u1", "c1");
    expect(r.reter).toBe(true);
    expect(r.minutosConteudo).toBe(60);
  });
});
