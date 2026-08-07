"use client";

import { useEffect, useState } from "react";
import { chaveTexto } from "@/lib/meet/quorum";

/**
 * Lê a sala medida da rota canônica.
 *
 * Existe para que nenhuma tela volte a inventar a própria conta de quórum. As
 * duas telas de condutor faziam isso e exibiam o rótulo "média" sobre colunas
 * diferentes: uma somava cabeças, a outra somava presença simultânea, e dentro
 * da mesma ficha as duas conviviam a três linhas de distância.
 */

export interface ResumoSala {
  encontros: number;
  quorumMedio: number | null;
  quorumMaximo: number;
  tendencia: number | null;
  vozesAtivasPct: number | null;
  encontrosComTranscricao: number;
  /** Fala de quem não é a conta institucional. `null` quando não houve transcrição. */
  interacaoMin: number | null;
  interacaoPorEncontroMin: number | null;
  /** O número que impede o grupo grande de ganhar só por ser grande. */
  interacaoPorPessoaMin: number | null;
  permanenciaMedianaPct: number | null;
  falaCondutorPct: number | null;
  encontrosComCondutorReconhecido: number;
  duracaoMediaMin: number | null;
  permanenciaMediaPct: number | null;
  /** Formulários recebidos. Não é presença. */
  declararam: number;
  /** Formulários sobre presentes: o grau de confiança do que vem do formulário. */
  coberturaPct: number | null;
  primeiro: string | null;
  ultimo: string | null;
}

export interface EncontroSala {
  id: string;
  slotId: string | null;
  atividade: string | null;
  atividadeChave: string;
  condutores: string[];
  data: string;
  diaSemana: number;
  duracaoMin: number | null;
  duracaoPrevistaMin: number | null;
  quorum: number;
  falaram: number;
  temTranscricao: boolean;
  interacaoMin: number | null;
  segmentosFala: number | null;
  permanenciaMediaPct: number | null;
  permanenciaMedianaPct: number | null;
  saidaAntecipadaMediaMin: number | null;
  sessoesMedia: number | null;
  falaCondutorPct: number | null;
  declararam: number;
}

/** A interação de um grupo medida por pessoa, e não por encontro. */
export interface InteracaoGrupo {
  grupo: string;
  nome: string;
  pessoas: number;
  falaram: number;
  minutosFala: number;
  permanenciaMedianaPct: number | null;
  permanenciaMediaPct: number | null;
  mudas: number;
  comTranscricao: number;
}

export interface GrupoSala extends ResumoSala {
  chave: string;
  /** `certificado_atividades.id`. `null` quando o grupo não está no catálogo. */
  atividadeId: string | null;
  nome: string;
  slots: number;
  condutores: string[];
  interacao: InteracaoGrupo | null;
  /** Este grupo tem base para entrar numa comparação entre grupos. */
  comparavel: boolean;
  /** "1 de 3 encontros com transcrição", ou `null` quando já dá. */
  faltaParaComparar: string | null;
}

/**
 * ⛔ O que a base autoriza a tela a afirmar.
 *
 * Vem da rota, não da tela, porque ordenar é o que transforma medição em juízo
 * e essa decisão não pode ficar espalhada por seis componentes.
 */
export interface ReguaSala {
  /** Falso enquanto `grupos` vier em ordem alfabética, e não por mérito. */
  podeRanquear: boolean;
  gruposComparaveis: number;
  minimoParaComparar: number;
  porqueNaoRanqueia: string | null;
  /** Falso quando o histórico é mais novo que a janela de sumiço. */
  sumicoMensuravel: boolean;
  diasDeHistorico: number;
  /** Falso quando cada dia da semana tem um grupo só, e dia é o grupo. */
  diaSemanaSeparaEfeito: boolean;
}

/** Uma linha da comparação da mesma pessoa entre os grupos que ela frequenta. */
export interface LinhaEntreGruposSala {
  grupo: string;
  nome: string;
  encontros: number;
  minutos: number;
  minutosFala: number;
  segmentosFala: number;
  caladaEm: number;
  comTranscricao: number;
  permanencias: number[];
  permanenciaMedianaPct: number | null;
  falaPorEncontroMin: number;
  primeira: string;
  ultima: string;
}

export interface PessoaEntreGrupos {
  chave: string;
  nome: string;
  alunoId: string | null;
  grupos: LinhaEntreGruposSala[];
  amplitudeFalaMin: number;
  amplitudePermanenciaPct: number;
  falaEmUmCalaEmOutro: boolean;
}

/** Estreou, voltou, retomou e sumiu, contra o encontro anterior do mesmo grupo. */
export interface FluxoSala {
  encontroId: string;
  grupo: string;
  data: string;
  presentes: number;
  /** `null` no primeiro encontro medido do grupo. Não é zero. */
  estrearam: number | null;
  voltaram: number | null;
  retomaram: number | null;
  sumiram: number | null;
}

export interface CondutorSala extends ResumoSala {
  chave: string;
  nome: string;
  atividades: string[];
}

export interface PessoaSala {
  chave: string;
  nome: string;
  alunoId: string | null;
  encontros: number;
  minutos: number;
  minutosFala: number;
  caladaEm: number;
  comTranscricao: number;
  ultima: string;
}

/** Uma linha do catálogo de atividades, que é o catálogo de grupos. */
export interface AtividadeCatalogo {
  id: string;
  nome: string;
  carga_horaria: number | null;
  ativo: boolean;
  arquivado: boolean;
}

export interface Sala {
  vazio: boolean;
  /**
   * Todos os grupos do cadastro, medidos ou não.
   *
   * `grupos` só traz quem teve encontro capturado, que hoje são 6 de 19. As
   * outras 13 não têm posição na grade e mesmo assim carregam 185 feedbacks.
   */
  catalogo: AtividadeCatalogo[];
  dias: number;
  hoje: string;
  geral: ResumoSala;
  encontros: EncontroSala[];
  grupos: GrupoSala[];
  condutores: CondutorSala[];
  regua: ReguaSala;
  diaSemana: { dia: number; encontros: number; quorumMedio: number | null }[];
  semanas: { semana: string; pessoas: number }[];
  fluxo: FluxoSala[];
  /** Quem frequenta mais de um grupo. Ordenado por quem mais varia entre eles. */
  entreGrupos: PessoaEntreGrupos[];
  entreGruposIdentificadas: number;
  maisPresentes: PessoaSala[];
  sumindo: PessoaSala[];
  calados: PessoaSala[];
  totalPessoas: number;
}

export function useSala(dias = 3650) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    async function carregar() {
      setCarregando(true);
      try {
        const r = await fetch(`/formacao/api/admin/meet/sala?dias=${dias}`);
        // O Next devolve HTML na página de erro, e `.json()` num HTML estoura
        // com uma mensagem que não tem nada a ver com o problema real.
        const tipo = r.headers.get("content-type") ?? "";
        if (!r.ok || !tipo.includes("application/json")) {
          throw new Error(`a sala não respondeu (${r.status})`);
        }
        const j = (await r.json()) as Sala;
        if (!vivo) return;
        setSala(j.vazio ? { ...j, grupos: [], condutores: [], encontros: [], catalogo: j.catalogo ?? [] } : j);
        setErro(null);
      } catch (e) {
        if (!vivo) return;
        setSala(null);
        setErro(e instanceof Error ? e.message : "falha ao ler a sala");
      } finally {
        if (vivo) setCarregando(false);
      }
    }
    carregar();
    return () => {
      vivo = false;
    };
  }, [dias]);

  return { sala, carregando, erro };
}

/** Índice de condutor por nome normalizado, para casar com a ficha do cadastro. */
export function indexarCondutores(sala: Sala | null): Map<string, CondutorSala> {
  const m = new Map<string, CondutorSala>();
  sala?.condutores?.forEach((c) => m.set(c.chave, c));
  return m;
}

/** Índice de grupo por nome de atividade normalizado. */
export function indexarGrupos(sala: Sala | null): Map<string, GrupoSala> {
  const m = new Map<string, GrupoSala>();
  sala?.grupos?.forEach((g) => m.set(g.chave, g));
  return m;
}

export { chaveTexto };
