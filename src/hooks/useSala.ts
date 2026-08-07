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
  permanenciaMediaPct: number | null;
  saidaAntecipadaMediaMin: number | null;
  sessoesMedia: number | null;
  falaCondutorPct: number | null;
  declararam: number;
}

export interface GrupoSala extends ResumoSala {
  chave: string;
  /** `certificado_atividades.id`. `null` quando o grupo não está no catálogo. */
  atividadeId: string | null;
  nome: string;
  slots: number;
  condutores: string[];
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

export interface Sala {
  vazio: boolean;
  dias: number;
  hoje: string;
  geral: ResumoSala;
  encontros: EncontroSala[];
  grupos: GrupoSala[];
  condutores: CondutorSala[];
  diaSemana: { dia: number; encontros: number; quorumMedio: number | null }[];
  semanas: { semana: string; pessoas: number }[];
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
        setSala(j.vazio ? { ...j, grupos: [], condutores: [], encontros: [] } : j);
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
