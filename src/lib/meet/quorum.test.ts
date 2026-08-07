import { describe, it, expect } from "vitest";
import {
  chaveTexto,
  chavePessoa,
  mediana,
  juntarDispositivos,
  separarCondutores,
  tendencia,
  porCondutor,
  porAtividade,
  porDiaSemana,
  resumir,
  serieSemanal,
  fluxoDeEncontros,
  interacaoDoGrupo,
  pessoaEntreGrupos,
  type EncontroMedido,
  type MetricaNoGrupo,
} from "./quorum";
import { chaveTelefone } from "@/lib/clinica/avaliallos";

function enc(p: Partial<EncontroMedido> & { id: string }): EncontroMedido {
  return {
    slotId: null,
    atividade: "Grupo",
    atividadeChave: "grupo",
    condutores: [],
    data: "2026-08-01",
    diaSemana: 0,
    duracaoMin: 90,
    duracaoPrevistaMin: 90,
    quorum: 10,
    falaram: 5,
    temTranscricao: true,
    interacaoMin: 20,
    segmentosFala: 40,
    permanenciaMediaPct: 80,
    permanenciaMedianaPct: 85,
    saidaAntecipadaMediaMin: 0,
    sessoesMedia: 1,
    falaCondutorPct: 40,
    declararam: 0,
    ...p,
  };
}

function noGrupo(p: Partial<MetricaNoGrupo> & { grupo: string }): MetricaNoGrupo {
  return {
    nome: p.grupo,
    encontros: 1,
    minutos: 80,
    minutosFala: 0,
    segmentosFala: 0,
    caladaEm: 0,
    comTranscricao: 1,
    permanencias: [90],
    primeira: "2026-08-01",
    ultima: "2026-08-01",
    ...p,
  };
}

/** Monta o `Map` aninhado que `lerSala` devolve, sem precisar de banco. */
function matriz(
  entradas: [string, MetricaNoGrupo[]][],
): Map<string, Map<string, MetricaNoGrupo>> {
  return new Map(
    entradas.map(([pessoa, linhas]) => [
      pessoa,
      new Map(linhas.map((l) => [l.grupo, l])),
    ]),
  );
}

describe("separarCondutores", () => {
  it("separa a dupla que a ingestão grava como uma string só", () => {
    // `formacao_meet_encontros.condutor_nome` recebe nomesCondutores.join(", ").
    // Quem usa a string inteira como chave perde os dois condutores de uma vez.
    expect(separarCondutores("Ana, João")).toEqual(["Ana", "João"]);
  });

  it("trata o condutor solo", () => {
    expect(separarCondutores("Laura")).toEqual(["Laura"]);
  });

  it("não inventa uma pessoa chamada Sem condutor", () => {
    expect(separarCondutores("Sem condutor")).toEqual([]);
    expect(separarCondutores(null)).toEqual([]);
    expect(separarCondutores("")).toEqual([]);
  });

  it("descarta espaço solto entre vírgulas", () => {
    expect(separarCondutores("Ana ,  , João ")).toEqual(["Ana", "João"]);
  });
});

describe("chaveTexto", () => {
  it("ignora acento, caixa e espaço repetido", () => {
    expect(chaveTexto("Tácia  DE  Souza")).toBe(chaveTexto("tacia de souza"));
  });

  it("renomear só o acento não parte o grupo", () => {
    expect(chaveTexto("Construção de caso clínico")).toBe(
      chaveTexto("Construcao de caso clinico"),
    );
  });
});

describe("tendencia", () => {
  it("exige quatro encontros, senão é ruído com seta", () => {
    expect(tendencia([10, 8, 6])).toBeNull();
  });

  it("mede a metade recente contra a antiga, em pessoas", () => {
    expect(tendencia([10, 10, 6, 6])).toBe(-4);
    expect(tendencia([6, 6, 10, 10])).toBe(4);
  });
});

describe("porCondutor", () => {
  it("credita o encontro aos DOIS condutores da dupla", () => {
    // Era o defeito das telas antigas: num slot com dois condutores, o segundo
    // ficava invisível, porque `condutorPrincipal` só guarda o primeiro.
    const m = porCondutor([enc({ id: "a", condutores: ["Ana", "João"], quorum: 12 })]);
    expect(m.get("ana")?.encontros).toHaveLength(1);
    expect(m.get("joao")?.encontros).toHaveLength(1);
  });

  it("junta encontros do mesmo condutor escritos com grafia diferente", () => {
    const m = porCondutor([
      enc({ id: "a", condutores: ["Tácia"] }),
      enc({ id: "b", condutores: ["tacia"] }),
    ]);
    expect(m.size).toBe(1);
    expect(m.get("tacia")?.encontros).toHaveLength(2);
  });
});

describe("porAtividade", () => {
  it("agrupa por atividade, não por slot: mudar de horário não parte o grupo", () => {
    const m = porAtividade([
      enc({ id: "a", slotId: "slot-terca", atividadeChave: "grupo", quorum: 10 }),
      enc({ id: "b", slotId: "slot-quarta", atividadeChave: "grupo", quorum: 12 }),
    ]);
    expect(m.size).toBe(1);
    expect(m.get("grupo")?.encontros).toHaveLength(2);
    expect(m.get("grupo")?.slots.size).toBe(2);
  });
});

describe("porDiaSemana", () => {
  it("agrupa pela convenção da coluna, onde 0 é segunda", () => {
    const r = porDiaSemana([
      enc({ id: "a", diaSemana: 1, quorum: 10 }),
      enc({ id: "b", diaSemana: 1, quorum: 20 }),
      enc({ id: "c", diaSemana: 2, quorum: 4 }),
    ]);
    expect(r).toEqual([
      { dia: 1, encontros: 2, quorumMedio: 15 },
      { dia: 2, encontros: 1, quorumMedio: 4 },
    ]);
  });
});

describe("resumir", () => {
  it("mede vozes ativas sobre o quórum, que já exclui quem conduz", () => {
    const r = resumir([enc({ id: "a", quorum: 10, falaram: 4 })]);
    expect(r.vozesAtivasPct).toBe(40);
  });

  it("encontro sem transcrição não puxa vozes ativas para baixo", () => {
    // Ausência de dado não é silêncio. Sem esta regra, ligar a transcrição em
    // metade dos grupos faria o indicador despencar sem nada ter mudado.
    const r = resumir([
      enc({ id: "a", quorum: 10, falaram: 5, temTranscricao: true }),
      enc({ id: "b", quorum: 10, falaram: 0, temTranscricao: false }),
    ]);
    expect(r.vozesAtivasPct).toBe(50);
    expect(r.encontrosComTranscricao).toBe(1);
  });

  it("não conta como calado o encontro em que o condutor não foi reconhecido", () => {
    // `falaCondutorPct: null` é o zero da ingestão já convertido na leitura.
    const r = resumir([
      enc({ id: "a", falaCondutorPct: 60 }),
      enc({ id: "b", falaCondutorPct: null }),
    ]);
    expect(r.falaCondutorPct).toBe(60);
    expect(r.encontrosComCondutorReconhecido).toBe(1);
  });

  it("mede tendência na ordem cronológica, não na ordem que chegou", () => {
    const r = resumir([
      enc({ id: "d", data: "2026-08-22", quorum: 4 }),
      enc({ id: "a", data: "2026-08-01", quorum: 10 }),
      enc({ id: "c", data: "2026-08-15", quorum: 6 }),
      enc({ id: "b", data: "2026-08-08", quorum: 10 }),
    ]);
    expect(r.tendencia).toBe(-5);
    expect(r.primeiro).toBe("2026-08-01");
    expect(r.ultimo).toBe("2026-08-22");
  });
});

describe("serieSemanal", () => {
  it("preenche a semana sem encontro com zero", () => {
    // Sem isso, um gráfico de linha desenha uma pausa de férias como declínio
    // suave, porque liga o ponto de antes direto no ponto de depois.
    const mapa = new Map([
      ["a", new Set(["p1", "p2"])],
      ["c", new Set(["p1"])],
    ]);
    const r = serieSemanal(
      [
        enc({ id: "a", data: "2026-08-03" }),
        enc({ id: "c", data: "2026-08-17" }),
      ],
      mapa,
    );
    expect(r).toEqual([
      { semana: "2026-08-03", pessoas: 2 },
      { semana: "2026-08-10", pessoas: 0 },
      { semana: "2026-08-17", pessoas: 1 },
    ]);
  });

  it("conta pessoa distinta, não presença: dois grupos na mesma semana contam um", () => {
    const mapa = new Map([
      ["a", new Set(["p1"])],
      ["b", new Set(["p1"])],
    ]);
    const r = serieSemanal(
      [enc({ id: "a", data: "2026-08-04" }), enc({ id: "b", data: "2026-08-06" })],
      mapa,
    );
    expect(r).toEqual([{ semana: "2026-08-03", pessoas: 1 }]);
  });
});

describe("juntarDispositivos", () => {
  const disp = (p: Partial<Parameters<typeof juntarDispositivos>[0]>) => ({
    minutos_presentes: 0,
    permanencia_pct: null,
    saida_antecipada_min: null,
    n_sessoes: null,
    minutos_fala: null,
    n_turnos_fala: null,
    ...p,
  });

  it("presença fica com o maior, não com a soma", () => {
    // Ela esteve na sala uma vez, não duas. Somar inventaria 130 minutos num
    // encontro de 85, e foi assim que alguém apareceu com dois encontros num
    // grupo que teve um só.
    const r = juntarDispositivos(
      disp({ minutos_presentes: 82, permanencia_pct: 96.5 }),
      disp({ minutos_presentes: 48, permanencia_pct: 56.4 }),
    );
    expect(r.minutos_presentes).toBe(82);
    expect(r.permanencia_pct).toBe(96.5);
  });

  it("fala soma, porque os dois microfones falaram coisas diferentes", () => {
    const r = juntarDispositivos(
      disp({ minutos_fala: 3, n_turnos_fala: 10 }),
      disp({ minutos_fala: 1.5, n_turnos_fala: 4 }),
    );
    expect(r.minutos_fala).toBe(4.5);
    expect(r.n_turnos_fala).toBe(14);
  });

  it("sem transcrição nos dois, continua sem transcrição e não vira zero", () => {
    // Zero diria "não falou". Nulo diz "não medimos", e são coisas diferentes.
    const r = juntarDispositivos(disp({}), disp({}));
    expect(r.minutos_fala).toBeNull();
    expect(r.n_turnos_fala).toBeNull();
  });

  it("saiu quando o último aparelho saiu", () => {
    const r = juntarDispositivos(
      disp({ saida_antecipada_min: 40 }),
      disp({ saida_antecipada_min: 2 }),
    );
    expect(r.saida_antecipada_min).toBe(2);
  });
});

describe("mediana", () => {
  it("não se deixa puxar pela cauda de quem passou e saiu", () => {
    // Medido em produção: num grupo real a média de permanência é 64,9% e a
    // mediana é 84,7%. A diferença inteira é gente que entrou e saiu em dois
    // minutos. É por isso que a mediana existe aqui.
    expect(mediana([0, 2, 90, 92, 95])).toBe(90);
  });

  it("com número par de valores, tira a média dos dois do meio", () => {
    expect(mediana([10, 20, 30, 40])).toBe(25);
  });

  it("lista vazia é null, nunca zero", () => {
    expect(mediana([])).toBeNull();
  });
});

describe("chavePessoa", () => {
  it("a conta da plataforma vence a conta Google", () => {
    // Existe uma pessoa com um aluno_id e DUAS contas Google, em três grupos.
    // Se a conta Google viesse primeiro, ela viraria duas pessoas.
    const a = chavePessoa({ aluno_id: "u1", google_user_id: "g1", display_name_norm: "ana" });
    const b = chavePessoa({ aluno_id: "u1", google_user_id: "g2", display_name_norm: "ana" });
    expect(a).toBe(b);
  });

  it("sem conta da plataforma, a conta Google separa homônimos", () => {
    // O nome é a chave proibida: dois homônimos sem conta virariam uma pessoa
    // só, e fundir duas séries históricas é silencioso e irreversível.
    const a = chavePessoa({ aluno_id: null, google_user_id: "g1", display_name_norm: "ana" });
    const b = chavePessoa({ aluno_id: null, google_user_id: "g2", display_name_norm: "ana" });
    expect(a).not.toBe(b);
  });

  it("sem nenhuma chave forte, cai no nome e diz que caiu", () => {
    expect(
      chavePessoa({ aluno_id: null, google_user_id: null, display_name_norm: "ana" }),
    ).toBe("nome:ana");
  });
});

describe("fluxoDeEncontros", () => {
  it("compara com o anterior DO MESMO GRUPO, não com o anterior no calendário", () => {
    // Duas turmas diferentes na mesma semana não têm nada a ver uma com a
    // outra. Comparar as duas produziria uma debandada por semana.
    const mapa = new Map([
      ["a1", new Set(["p1", "p2"])],
      ["b1", new Set(["p9"])],
      ["a2", new Set(["p1", "p3"])],
    ]);
    const r = fluxoDeEncontros(
      [
        enc({ id: "a1", atividadeChave: "alfa", data: "2026-08-03" }),
        enc({ id: "b1", atividadeChave: "beta", data: "2026-08-04" }),
        enc({ id: "a2", atividadeChave: "alfa", data: "2026-08-10" }),
      ],
      mapa,
    );
    const a2 = r.find((f) => f.encontroId === "a2");
    expect(a2).toMatchObject({ estrearam: 1, voltaram: 1, sumiram: 1, retomaram: 0 });
  });

  it("o primeiro encontro do grupo é null, nunca zero", () => {
    // "0 estrearam" leria como "ninguém novo apareceu", que é o oposto da
    // verdade: sem encontro anterior, todo mundo é novo.
    const r = fluxoDeEncontros(
      [enc({ id: "a1", atividadeChave: "alfa" })],
      new Map([["a1", new Set(["p1"])]]),
    );
    expect(r[0]).toMatchObject({
      estrearam: null,
      voltaram: null,
      retomaram: null,
      sumiram: null,
      presentes: 1,
    });
  });

  it("separa quem retomou de quem estreou", () => {
    // Quem faltou uma vez e voltou não é gente nova. Grupo que perde gente e
    // grupo que tem gente indo e voltando pedem providências opostas.
    const mapa = new Map([
      ["e1", new Set(["p1"])],
      ["e2", new Set(["p2"])],
      ["e3", new Set(["p1", "p3"])],
    ]);
    const r = fluxoDeEncontros(
      [
        enc({ id: "e1", data: "2026-08-03" }),
        enc({ id: "e2", data: "2026-08-10" }),
        enc({ id: "e3", data: "2026-08-17" }),
      ],
      mapa,
    );
    const e3 = r.find((f) => f.encontroId === "e3");
    expect(e3).toMatchObject({ estrearam: 1, retomaram: 1, voltaram: 0, sumiram: 1 });
  });
});

describe("interacaoDoGrupo", () => {
  it("mede por pessoa, não por encontro", () => {
    const m = matriz([
      ["p1", [noGrupo({ grupo: "alfa", minutosFala: 10, permanencias: [90] })]],
      ["p2", [noGrupo({ grupo: "alfa", minutosFala: 0, permanencias: [10] })]],
      ["p3", [noGrupo({ grupo: "beta", minutosFala: 5, permanencias: [50] })]],
    ]);
    const r = interacaoDoGrupo(m, "alfa");
    expect(r).toMatchObject({ pessoas: 2, falaram: 1, minutosFala: 10, mudas: 1 });
    // Mediana de 90 e 10, não a média de 50: aqui elas coincidem, e a diferença
    // aparece na cauda longa que a produção tem.
    expect(r?.permanenciaMedianaPct).toBe(50);
  });

  it("grupo sem ninguém devolve null, não um grupo vazio", () => {
    expect(interacaoDoGrupo(matriz([]), "alfa")).toBeNull();
  });

  it("só conta como muda quem esteve em encontro com transcrição", () => {
    // Sem transcrição, "não falou" e "não medimos" são a mesma linha no banco.
    const m = matriz([
      ["p1", [noGrupo({ grupo: "alfa", minutosFala: 0, comTranscricao: 0, caladaEm: 0 })]],
    ]);
    expect(interacaoDoGrupo(m, "alfa")).toMatchObject({ mudas: 0, comTranscricao: 0 });
  });
});

describe("pessoaEntreGrupos", () => {
  it("acha quem fala num grupo e fica muda em outro", () => {
    // O achado mais forte da base hoje: 15 das 39 pessoas que frequentam mais
    // de um grupo têm exatamente este padrão. Isso mede o grupo, não a pessoa.
    const m = matriz([
      [
        "p1",
        [
          noGrupo({ grupo: "alfa", minutosFala: 25.1, permanencias: [97.8] }),
          noGrupo({ grupo: "beta", minutosFala: 0, permanencias: [97.6] }),
        ],
      ],
    ]);
    const r = pessoaEntreGrupos(m, "p1");
    expect(r?.falaEmUmCalaEmOutro).toBe(true);
    expect(r?.amplitudeFalaMin).toBe(25.1);
    // A permanência é praticamente igual nos dois: o que muda é a fala.
    expect(r?.amplitudePermanenciaPct).toBeCloseTo(0.2, 1);
  });

  it("quem está num grupo só não tem amplitude, e isso não é zero de variação", () => {
    const m = matriz([["p1", [noGrupo({ grupo: "alfa", minutosFala: 10 })]]]);
    const r = pessoaEntreGrupos(m, "p1");
    expect(r?.grupos).toHaveLength(1);
    expect(r?.falaEmUmCalaEmOutro).toBe(false);
    expect(r?.amplitudeFalaMin).toBe(0);
  });

  it("grupo sem transcrição não entra na comparação de fala", () => {
    // Senão a amplitude viraria artefato de cobertura: o grupo que ninguém
    // transcreveu apareceria como o grupo em que ela não fala.
    const m = matriz([
      [
        "p1",
        [
          noGrupo({ grupo: "alfa", minutosFala: 12, comTranscricao: 1 }),
          noGrupo({ grupo: "beta", minutosFala: 0, comTranscricao: 0 }),
        ],
      ],
    ]);
    const r = pessoaEntreGrupos(m, "p1");
    expect(r?.falaEmUmCalaEmOutro).toBe(false);
    expect(r?.amplitudeFalaMin).toBe(0);
  });

  it("pessoa que não esteve em nenhuma sala devolve null", () => {
    expect(pessoaEntreGrupos(matriz([]), "p9")).toBeNull();
  });
});

describe("resumir, interação", () => {
  it("soma a interação só dos encontros com transcrição", () => {
    const r = resumir([
      enc({ id: "a", interacaoMin: 55.4, quorum: 76, temTranscricao: true }),
      enc({ id: "b", interacaoMin: null, quorum: 40, temTranscricao: false }),
    ]);
    expect(r.interacaoMin).toBe(55.4);
    expect(r.interacaoPorEncontroMin).toBe(55.4);
    // O denominador também ignora o encontro sem transcrição: 55,4 sobre 76,
    // não sobre 116.
    expect(r.interacaoPorPessoaMin).toBe(0.73);
  });

  it("interação por pessoa é o que impede o grupo grande de ganhar sempre", () => {
    // Números reais de 06/08: o grupo de 76 pessoas tem mais fala total que o
    // de 31, e menos fala por pessoa. Sem este campo a ordem se inverte.
    const grande = resumir([enc({ id: "a", interacaoMin: 55.4, quorum: 76 })]);
    const pequeno = resumir([enc({ id: "b", interacaoMin: 74.9, quorum: 31 })]);
    expect(grande.interacaoPorPessoaMin).toBeLessThan(
      pequeno.interacaoPorPessoaMin as number,
    );
  });

  it("sem nenhum encontro com transcrição, a interação é null e não zero", () => {
    const r = resumir([enc({ id: "a", temTranscricao: false, interacaoMin: null })]);
    expect(r.interacaoMin).toBeNull();
    expect(r.interacaoPorPessoaMin).toBeNull();
  });
});

describe("chaveTelefone", () => {
  it("absorve as formas de escrever o mesmo número", () => {
    const esperado = "8199998888";
    expect(chaveTelefone("(81) 99999-8888")).toBe(esperado);
    expect(chaveTelefone("81999998888")).toBe(esperado);
    expect(chaveTelefone("5581999998888")).toBe(esperado);
    expect(chaveTelefone("+55 81 99999-8888")).toBe(esperado);
    expect(chaveTelefone("0 81 99999-8888")).toBe(esperado);
  });

  it("casa o cadastro antigo de dez dígitos com o atual de onze", () => {
    // É a diferença entre esta normalização e a que a base usa hoje: sem tratar
    // o nono dígito, a mesma pessoa vira duas.
    expect(chaveTelefone("81 9999-8888")).toBe(chaveTelefone("81 99999-8888"));
  });

  it("recusa o que é curto demais para ser telefone", () => {
    expect(chaveTelefone("999888")).toBeNull();
    expect(chaveTelefone("")).toBeNull();
    expect(chaveTelefone(null)).toBeNull();
  });
});
