"use client";

// Painel do quórum automático.
//
// Três abas porque são três trabalhos diferentes: configurar as salas (raro),
// resolver nomes (semanal, rápido) e conferir se a máquina rodou (quando algo
// parece errado).

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarClock, CheckCircle2, Clock3, DoorClosed, DoorOpen, Link2,
  FolderOpen, FolderPlus, Loader2, Mic, PhoneOff, RefreshCw, ShieldCheck,
  UserSearch, Video, FileText, X,
} from "lucide-react";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const ROXO = "#6c5ce7";

interface Slot {
  id: string;
  dia_semana: number;
  horario_id: string;
  ativo: boolean;
  atividade_nome: string | null;
  meet_link: string | null;
}
interface Horario { id: string; hora: string; ordem: number }
interface SpaceRow {
  id: string;
  slot_id: string | null;
  space_name: string;
  meeting_code: string | null;
  meeting_uri: string | null;
  rotulo: string | null;
  gravar: boolean;
  transcrever: boolean;
  notas: boolean;
  access_type: "OPEN" | "TRUSTED" | "RESTRICTED";
  janela_automatica: boolean;
  duracao_min: number | null;
  pasta_drive_url: string | null;
  curso_id: string | null;
  ativo: boolean;
}
interface CursoOpcao {
  id: string;
  title: string;
}
interface AulaSugerida {
  id: string;
  titulo: string;
  video_url: string;
  duracao_min: number | null;
  data_reuniao: string;
  curso_titulo: string;
}
interface Excecao {
  id: string;
  slot_id: string;
  data: string;
  gravar: boolean | null;
  transcrever: boolean | null;
  notas: boolean | null;
  aplicada_em: string | null;
  revertida_em: string | null;
}
interface Status {
  autorizado: boolean;
  organizer_email: string | null;
  credenciais_app_configuradas: boolean;
  cron_configurado: boolean;
  total_salas: number;
  total_encontros: number;
  nomes_pendentes: number;
  ultima_ingestao: {
    executado_em: string;
    encontros_novos: number;
    encontros_atualizados: number;
    participacoes_gravadas: number;
    nomes_nao_reconhecidos: number;
    erro: string | null;
  } | null;
}
interface ItemFila {
  display_name: string;
  display_name_norm: string;
  ocorrencias: number;
  minutos_totais: number;
  sugestoes: { aluno_id: string; full_name: string; score: number }[];
}

interface Participacao {
  display_name: string;
  aluno_id: string | null;
  minutos_presentes: number;
  permanencia_pct: number | null;
  atraso_min: number | null;
  minutos_fala: number | null;
  n_turnos_fala: number | null;
  n_sessoes: number;
  eh_condutor: boolean;
}
interface Encontro {
  id: string;
  atividade_nome: string | null;
  condutor_nome: string | null;
  data_reuniao: string;
  inicio: string;
  fim: string | null;
  duracao_min: number | null;
  total_participantes: number;
  vozes_ativas_pct: number | null;
  fala_condutor_pct: number | null;
  gravacao_uri: string | null;
  transcricao_uri: string | null;
  descartado: boolean;
  descartado_motivo: string | null;
  participacoes: Participacao[];
}
interface Vinculo {
  display_name: string;
  display_name_norm: string;
  aluno_nome: string | null;
  ignorado: boolean;
}

interface Config {
  tolerancia_atraso_min?: number;
  limite_encerramento_min?: number;
  pasta_drive_url?: string | null;
}

interface ResultadoBusca {
  id: string;
  display_name: string;
  texto: string;
  inicio: string | null;
  encontro: {
    id: string;
    atividade_nome: string | null;
    condutor_nome: string | null;
    data_reuniao: string;
    transcricao_uri: string | null;
  } | null;
}

type Aba = "salas" | "encontros" | "aulas" | "nomes" | "diagnostico";

/**
 * Fetch que nunca explode a tela.
 *
 * Rota inexistente devolve a página de erro do Next em HTML, e `.json()` num
 * HTML estoura com "Unexpected token '<'", derrubando o painel inteiro por
 * causa de um endpoint só. Acontece de verdade quando se abre uma cópia antiga
 * do app: as rotas novas ainda não existem lá.
 */
/**
 * Lê a resposta de uma ação, traduzindo os dois jeitos de dar errado.
 *
 * Quando vem HTML em vez de JSON, a causa quase sempre é o painel estar aberto
 * numa versão do app que não tem a rota. "Unexpected token '<'" não ajuda
 * ninguém a resolver isso; dizer onde abrir, sim.
 */
async function lerResposta(r: Response): Promise<Record<string, unknown>> {
  const tipo = r.headers.get("content-type") || "";
  if (!tipo.includes("application/json")) {
    throw new Error(
      "O servidor respondeu uma página em vez de dados. Abra o painel por allos.org.br/formacao/admin/meet."
    );
  }
  const j = (await r.json()) as Record<string, unknown>;
  if (!r.ok) throw new Error((j.error as string) || "Não foi possível concluir.");
  return j;
}

async function pegarJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    const tipo = r.headers.get("content-type") || "";
    if (!tipo.includes("application/json")) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export default function MeetAdminPage() {
  const [aba, setAba] = useState<Aba>("salas");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [excecoes, setExcecoes] = useState<Excecao[]>([]);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [encontroAberto, setEncontroAberto] = useState<string | null>(null);
  const [verDescartados, setVerDescartados] = useState(false);
  const [cursos, setCursos] = useState<CursoOpcao[]>([]);
  const [aulas, setAulas] = useState<AulaSugerida[]>([]);
  const [tituloEditado, setTituloEditado] = useState<Record<string, string>>({});

  const carregarAulas = useCallback(async () => {
    const j = await pegarJson<{ fila?: AulaSugerida[]; error?: string }>(
      "/formacao/api/admin/meet/aulas"
    );
    if (j && !j.error) setAulas(j.fila || []);
  }, []);

  async function decidirAula(a: AulaSugerida, acao: "aprovar" | "descartar") {
    setTrabalhando(a.id);
    try {
      const r = await fetch("/formacao/api/admin/meet/aulas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: a.id,
          acao,
          titulo: tituloEditado[a.id] ?? a.titulo,
        }),
      });
      const j = await lerResposta(r);
      toast.success(
        acao === "aprovar" ? "Aula publicada no curso." : "Gravação descartada."
      );
      if (j.aviso) toast.warning(j.aviso as string);
      setAulas((f) => f.filter((x) => x.id !== a.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  async function vincularCurso(space: SpaceRow, cursoId: string) {
    setTrabalhando(space.space_name + "curso");
    try {
      const r = await fetch("/formacao/api/admin/meet/spaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_name: space.space_name, curso_id: cursoId || null }),
      });
      await lerResposta(r);
      setSpaces((atual) =>
        atual.map((s) =>
          s.space_name === space.space_name ? { ...s, curso_id: cursoId || null } : s
        )
      );
      toast.success(
        cursoId
          ? "As gravações deste grupo passam a virar aulas deste curso, para você aprovar."
          : "Desvinculado do curso."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [excecaoAberta, setExcecaoAberta] = useState<string | null>(null);
  const [duracaoAberta, setDuracaoAberta] = useState<string | null>(null);
  const [tolerancia, setTolerancia] = useState(7);
  const [limiteEncerramento, setLimiteEncerramento] = useState(120);
  const [pastaDrive, setPastaDrive] = useState("");

  async function salvarPasta() {
    setTrabalhando("pasta");
    try {
      const r = await fetch("/formacao/api/admin/meet/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasta_drive: pastaDrive.trim() || null }),
      });
      const j = await lerResposta(r);
      toast.success(
        j.pasta_nome
          ? `Gravações vão para a pasta "${j.pasta_nome}".`
          : "Pasta removida: os arquivos ficam onde o Meet coloca."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a pasta");
    } finally {
      setTrabalhando(null);
    }
  }
  const [novaAvulsa, setNovaAvulsa] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null);

  async function buscarNasFalas() {
    const termo = busca.trim();
    if (termo.length < 3) {
      toast.error("Escreva ao menos três letras.");
      return;
    }
    setTrabalhando("busca");
    try {
      const j = await pegarJson<{ resultados?: ResultadoBusca[]; error?: string }>(
        `/formacao/api/admin/meet/buscar?q=${encodeURIComponent(termo)}`
      );
      if (!j || j.error) throw new Error(j?.error || "Falhou");
      setResultados(j.resultados || []);
      if (!j.resultados?.length) toast.info("Nada encontrado nas transcrições.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na busca");
    } finally {
      setTrabalhando(null);
    }
  }

  async function criarSalaAvulsa() {
    const nome = novaAvulsa.trim();
    if (!nome) return;
    setTrabalhando("avulsa");
    try {
      const r = await fetch("/formacao/api/admin/meet/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotulo: nome, gravar: false, transcrever: true, notas: true }),
      });
      await lerResposta(r);
      toast.success(`Sala "${nome}" criada.`);
      setNovaAvulsa("");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar sala");
    } finally {
      setTrabalhando(null);
    }
  }

  async function salvarTolerancia() {
    setTrabalhando("tolerancia");
    try {
      const r = await fetch("/formacao/api/admin/meet/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tolerancia_atraso_min: tolerancia,
          limite_encerramento_min: limiteEncerramento,
        }),
      });
      await lerResposta(r);
      toast.success("Configuração salva.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setTrabalhando(null);
    }
  }

  const carregar = useCallback(async () => {
    const sb = createClient();

    // Uma chamada de API só, e depois as consultas do browser. Duas rotas
    // administrativas ao mesmo tempo disputam a renovação do token de sessão no
    // servidor, o Supabase devolve 409 e a sessão fica instável.
    const st = await pegarJson<Status & { config?: Config; error?: string }>(
      "/formacao/api/admin/meet/status"
    );

    const [sl, hr, sp, ex, cs] = await Promise.all([
      sb.from("formacao_slots").select("*").eq("ativo", true),
      sb.from("formacao_horarios").select("*").order("ordem"),
      sb.from("formacao_meet_spaces").select("*"),
      sb.from("formacao_meet_excecoes").select("*").is("revertida_em", null),
      sb.from("courses").select("id, title").order("title").limit(200),
    ]);
    setCursos((cs.data as CursoOpcao[]) || []);
    const cfg = st?.config;
    setStatus(st && !st.error ? st : null);
    setSlots((sl.data as Slot[]) || []);
    setHorarios((hr.data as Horario[]) || []);
    setSpaces((sp.data as SpaceRow[]) || []);
    setExcecoes((ex.data as Excecao[]) || []);
    if (cfg) {
      setTolerancia(cfg.tolerancia_atraso_min ?? 7);
      setLimiteEncerramento(cfg.limite_encerramento_min ?? 120);
      setPastaDrive(cfg.pasta_drive_url ?? "");
    }
    setLoading(false);
  }, []);

  const carregarEncontros = useCallback(async () => {
    const j = await pegarJson<{ encontros?: Encontro[]; error?: string }>(
      `/formacao/api/admin/meet/encontros?limite=40${verDescartados ? "&descartados=1" : ""}`
    );
    if (j && !j.error) setEncontros(j.encontros || []);
  }, [verDescartados]);

  const carregarVinculos = useCallback(async () => {
    try {
      const r = await fetch("/formacao/api/admin/meet/aliases", { method: "PUT" });
      const tipo = r.headers.get("content-type") || "";
      if (!tipo.includes("application/json")) return;
      const j = await r.json();
      if (!j.error) setVinculos(j.vinculos || []);
    } catch {
      // aba continua utilizável sem a lista
    }
  }, []);

  async function descartarEncontro(e: Encontro) {
    const restaurar = e.descartado;
    setTrabalhando(e.id);
    try {
      const r = await fetch(
        `/formacao/api/admin/meet/encontros?id=${e.id}${restaurar ? "&restaurar=1" : ""}`,
        { method: "DELETE" }
      );
      const j = await lerResposta(r);
      toast.success((j.aviso as string) || "Feito.");
      await carregarEncontros();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  async function desfazerVinculo(v: Vinculo) {
    setTrabalhando(v.display_name_norm);
    try {
      const r = await fetch(
        `/formacao/api/admin/meet/aliases?norm=${encodeURIComponent(v.display_name_norm)}`,
        { method: "DELETE" }
      );
      const j = await lerResposta(r);
      toast.success(
        `Desfeito. ${j.participacoes_desvinculadas ?? 0} participações voltaram a ficar sem dono.`
      );
      await Promise.all([carregarVinculos(), carregarFila(), carregar()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  const carregarFila = useCallback(async () => {
    const j = await pegarJson<{ fila?: ItemFila[]; error?: string }>(
      "/formacao/api/admin/meet/aliases"
    );
    if (j && !j.error) setFila(j.fila || []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // A captura NÃO é mais disparada ao abrir o painel.
  //
  // Ela era a chamada mais pesada do sistema e saía junto com as outras na
  // abertura da tela. Várias requisições administrativas ao mesmo tempo disputam
  // a renovação do token de sessão no servidor, e o Supabase responde a isso com
  // 409, o que deixava o painel lento e fazia telas anunciarem que a integração
  // tinha sumido quando ela estava intacta.
  //
  // Quem chama a captura é o agendador, de quinze em quinze minutos, e o botão
  // "Buscar encontros agora" quando alguém quiser na hora.

  useEffect(() => {
    if (aba === "nomes") {
      carregarFila();
      carregarVinculos();
    }
    if (aba === "encontros") carregarEncontros();
    if (aba === "aulas") carregarAulas();
  }, [aba, carregarFila, carregarVinculos, carregarEncontros, carregarAulas]);

  const horarioPorId = useMemo(
    () => new Map(horarios.map((h) => [h.id, h])),
    [horarios]
  );
  const spacePorSlot = useMemo(
    () => new Map(spaces.filter((s) => s.slot_id).map((s) => [s.slot_id as string, s])),
    [spaces]
  );
  const avulsas = useMemo(() => spaces.filter((s) => !s.slot_id), [spaces]);

  // Catálogo por grupo: é isto que substitui arrumar pastas no Drive. O nome do
  // grupo vem do próprio encontro, então sala avulsa entra pelo rótulo dela.
  const gruposDosEncontros = useMemo(
    () =>
      Array.from(
        new Set(encontros.map((e) => e.atividade_nome).filter((n): n is string => !!n))
      ).sort(),
    [encontros]
  );
  const encontrosFiltrados = useMemo(
    () => (filtroGrupo ? encontros.filter((e) => e.atividade_nome === filtroGrupo) : encontros),
    [encontros, filtroGrupo]
  );
  const excecoesPorSlot = useMemo(() => {
    const m = new Map<string, Excecao[]>();
    for (const e of excecoes) {
      m.set(e.slot_id, [...(m.get(e.slot_id) || []), e]);
    }
    return m;
  }, [excecoes]);

  const slotsOrdenados = useMemo(
    () =>
      [...slots].sort((a, b) => {
        if (a.dia_semana !== b.dia_semana) return a.dia_semana - b.dia_semana;
        return (horarioPorId.get(a.horario_id)?.ordem ?? 0) - (horarioPorId.get(b.horario_id)?.ordem ?? 0);
      }),
    [slots, horarioPorId]
  );

  async function criarSala(slot: Slot) {
    setTrabalhando(slot.id);
    try {
      const r = await fetch("/formacao/api/admin/meet/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Transcrição e notas sim, vídeo não. Gravar é decisão consciente por
        // grupo, tomada na chave do painel, não um padrão que ninguém escolheu.
        body: JSON.stringify({ slot_id: slot.id, gravar: false, transcrever: true, notas: true }),
      });
      await lerResposta(r);
      toast.success("Sala criada. O link do grupo já aponta para ela.");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar sala");
    } finally {
      setTrabalhando(null);
    }
  }

  async function encerrarReuniao(space: SpaceRow) {
    if (!confirm("Encerrar a reunião desta sala para todos os participantes?")) return;
    setTrabalhando(space.space_name + "encerrar");
    try {
      const r = await fetch("/formacao/api/admin/meet/encerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_name: space.space_name }),
      });
      await lerResposta(r);
      toast.success("Reunião encerrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao encerrar");
    } finally {
      setTrabalhando(null);
    }
  }

  async function criarPastaDoGrupo(space: SpaceRow) {
    setTrabalhando(space.space_name + "pasta");
    try {
      const r = await fetch("/formacao/api/admin/meet/pasta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_name: space.space_name }),
      });
      const j = await lerResposta(r);
      setSpaces((atual) =>
        atual.map((s) =>
          s.space_name === space.space_name
            ? { ...s, pasta_drive_url: (j.pasta_url as string) || null }
            : s
        )
      );
      toast.success(j.criada ? "Pasta do grupo criada no Drive." : "Pasta já existia.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar a pasta");
    } finally {
      setTrabalhando(null);
    }
  }

  async function salvarDuracao(space: SpaceRow, minutos: number | null) {
    setTrabalhando(space.space_name + "duracao");
    try {
      const r = await fetch("/formacao/api/admin/meet/spaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_name: space.space_name, duracao_min: minutos }),
      });
      await lerResposta(r);
      setSpaces((atual) =>
        atual.map((s) =>
          s.space_name === space.space_name ? { ...s, duracao_min: minutos } : s
        )
      );
      toast.success(
        minutos
          ? `Esta sala passa a durar ${minutos} minutos.`
          : `Esta sala volta ao padrão de ${limiteEncerramento} minutos.`
      );
      setDuracaoAberta(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  async function religarJanela(space: SpaceRow) {
    setTrabalhando(space.space_name + "janela");
    try {
      const r = await fetch("/formacao/api/admin/meet/spaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_name: space.space_name, janela_automatica: true }),
      });
      await lerResposta(r);
      setSpaces((atual) =>
        atual.map((s) =>
          s.space_name === space.space_name ? { ...s, janela_automatica: true } : s
        )
      );
      toast.success("A sala volta a abrir e fechar no horário do grupo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  async function alternarAcesso(space: SpaceRow) {
    const novo = space.access_type === "OPEN" ? "RESTRICTED" : "OPEN";
    setTrabalhando(space.space_name + "acesso");
    try {
      const r = await fetch("/formacao/api/admin/meet/spaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_name: space.space_name, access_type: novo }),
      });
      await lerResposta(r);
      setSpaces((atual) =>
        atual.map((s) =>
          s.space_name === space.space_name
            ? { ...s, access_type: novo, janela_automatica: false }
            : s
        )
      );
      toast.success(
        novo === "OPEN"
          ? "Sala aberta. O horário automático desta sala foi desligado."
          : "Sala fechada: quem tentar entrar bate à porta."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar acesso");
    } finally {
      setTrabalhando(null);
    }
  }

  async function alternar(space: SpaceRow, campo: "gravar" | "transcrever" | "notas") {
    setTrabalhando(space.space_name + campo);
    try {
      const r = await fetch("/formacao/api/admin/meet/spaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_name: space.space_name, [campo]: !space[campo] }),
      });
      await lerResposta(r);
      setSpaces((atual) =>
        atual.map((s) =>
          s.space_name === space.space_name ? { ...s, [campo]: !space[campo] } : s
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar");
    } finally {
      setTrabalhando(null);
    }
  }

  async function salvarExcecao(slotId: string, data: string, gravar: boolean) {
    try {
      const r = await fetch("/formacao/api/admin/meet/excecoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slotId, data, gravar }),
      });
      await lerResposta(r);
      toast.success(gravar ? "Vai gravar nesta data." : "Não vai gravar nesta data.");
      setExcecaoAberta(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function removerExcecao(id: string) {
    const r = await fetch(`/formacao/api/admin/meet/excecoes?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Exceção removida.");
      await carregar();
    }
  }

  async function conciliar(item: ItemFila, alunoId: string | null) {
    setTrabalhando(item.display_name_norm);
    try {
      const r = await fetch("/formacao/api/admin/meet/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          alunoId
            ? { display_name: item.display_name, aluno_id: alunoId }
            : { display_name: item.display_name, ignorar: true }
        ),
      });
      const j = await lerResposta(r);
      toast.success(
        alunoId
          ? `${j.participacoes_atualizadas} participações ligadas a essa pessoa.`
          : "Nome ignorado."
      );
      setFila((f) => f.filter((x) => x.display_name_norm !== item.display_name_norm));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  async function ingerirAgora() {
    setTrabalhando("ingestao");
    toast.info("Buscando encontros no Google. Pode levar um minuto.");
    try {
      const r = await fetch("/formacao/api/admin/meet/ingerir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dias: 30 }),
      });
      const j = await lerResposta(r);
      const res = j.resultado as
        | { encontros_novos: number; participacoes_gravadas: number }
        | undefined;
      toast.success(
        `${res?.encontros_novos ?? 0} encontros novos, ${res?.participacoes_gravadas ?? 0} participações.`
      );
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na ingestão");
    } finally {
      setTrabalhando(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Não conseguir verificar é diferente de não estar configurado, e confundir os
  // dois faz a tela anunciar que o acesso sumiu quando ele está intacto.
  const naoVerificado = status === null;
  const precisaAutorizar = !naoVerificado && !status?.autorizado;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-fraunces font-bold text-cream">Quórum automático</h1>
          <p className="text-sm text-cream/40 mt-1">
            Presença, permanência e tempo de fala capturados pela API do Google Meet.
          </p>
        </div>
        <button
          onClick={ingerirAgora}
          disabled={precisaAutorizar || trabalhando === "ingestao"}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
          style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
        >
          {trabalhando === "ingestao" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Buscar encontros agora
        </button>
      </div>

      {/* Estado da conexão */}
      {naoVerificado ? (
        <Card className="p-4 border border-amber-400/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-cream font-semibold">
                Não consegui verificar o estado da integração.
              </p>
              <p className="text-xs text-cream/50 mt-1">
                Isso não quer dizer que algo foi perdido: a conexão com o Google costuma estar
                intacta. Recarregue a página. Se persistir, saia e entre de novo na plataforma.
              </p>
              <button
                onClick={() => carregar()}
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
              </button>
            </div>
          </div>
        </Card>
      ) : precisaAutorizar ? (
        <Card className="p-4 border border-amber-400/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-cream font-semibold">
                Nenhuma conta autorizada ainda.
              </p>
              <p className="text-xs text-cream/50 mt-1">
                {status?.credenciais_app_configuradas
                  ? "Autorize com a conta do Workspace que vai ser dona das salas. É ela que enxerga as gravações."
                  : "Falta configurar GOOGLE_MEET_CLIENT_ID e GOOGLE_MEET_CLIENT_SECRET no servidor."}
              </p>
              {status?.credenciais_app_configuradas && (
                <a
                  href="/formacao/api/admin/meet/oauth"
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Autorizar conta do Google
                </a>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm text-cream">
                Conectado como <span className="font-semibold">{status?.organizer_email}</span>
              </p>
              <p className="text-xs text-cream/40 mt-0.5">
                {status?.total_salas} salas · {status?.total_encontros} encontros capturados
                {status && status.nomes_pendentes > 0
                  ? ` · ${status.nomes_pendentes} participações sem pessoa`
                  : ""}
              </p>
            </div>
            <a
              href="/formacao/api/admin/meet/oauth"
              className="text-xs text-cream/40 hover:text-cream/70 underline"
            >
              trocar conta
            </a>
          </div>
        </Card>
      )}

      {/* Abas */}
      <div className="flex flex-wrap gap-1">
        {([
          ["salas", "Salas dos grupos"],
          ["encontros", `Encontros${status?.total_encontros ? ` (${status.total_encontros})` : ""}`],
          ["aulas", `Aulas a publicar${aulas.length ? ` (${aulas.length})` : ""}`],
          ["nomes", `Nomes a resolver${status?.nomes_pendentes ? ` (${fila.length || status.nomes_pendentes})` : ""}`],
          ["diagnostico", "Diagnóstico"],
        ] as [Aba, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className="font-dm text-xs px-3 py-1.5 rounded-full transition-all"
            style={{
              backgroundColor: aba === id ? "rgba(108,92,231,0.12)" : "rgba(255,255,255,0.03)",
              color: aba === id ? ROXO : "rgba(253,251,247,0.35)",
              border: `1px solid ${aba === id ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === "salas" && (
        <div className="space-y-3">
          <p className="text-xs text-cream/40">
            Cada grupo tem uma sala fixa que abre 15 minutos antes do horário e fecha quando o
            encontro já teria acabado. Fora dessa janela, quem tem o link bate à porta e não
            entra. Transcrição ligada é o que permite medir tempo de fala; gravação só é
            necessária se você quiser o vídeo, e é ela que ocupa o Drive.
          </p>

          {/* ── Sala fora da grade ──
              Reunião de equipe, evento pontual, conversa com convidado. Mesma
              captura de quórum, sem precisar existir na grade semanal. */}
          <Card className="p-4">
            <p className="text-sm text-cream font-semibold mb-1">Sala avulsa</p>
            <p className="text-xs text-cream/40 mb-3">
              Para reuniões que não são grupo da grade. O quórum é capturado igual.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={novaAvulsa}
                onChange={(e) => setNovaAvulsa(e.target.value)}
                placeholder="Nome da reunião"
                className="flex-1 min-w-[180px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-cream placeholder:text-cream/25"
              />
              <button
                onClick={criarSalaAvulsa}
                disabled={!novaAvulsa.trim() || precisaAutorizar || trabalhando === "avulsa"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
              >
                {trabalhando === "avulsa" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Video className="h-3.5 w-3.5" />
                )}
                Criar sala
              </button>
            </div>

            {avulsas.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                {avulsas.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-[140px]">
                      <p className="text-xs text-cream">{s.rotulo}</p>
                      {s.meeting_uri && (
                        <a
                          href={s.meeting_uri}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs"
                          style={{ color: ROXO }}
                        >
                          <Link2 className="h-3 w-3" /> {s.meeting_code}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {([
                        ["transcrever", "Transcrever", Mic],
                        ["gravar", "Gravar", Video],
                      ] as const).map(([campo, label, Icone]) => (
                        <button
                          key={campo}
                          onClick={() => alternar(s, campo)}
                          disabled={trabalhando === s.space_name + campo}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs disabled:opacity-40"
                          style={{
                            background: s[campo] ? "rgba(108,92,231,0.12)" : "rgba(255,255,255,0.03)",
                            color: s[campo] ? ROXO : "rgba(253,251,247,0.35)",
                            border: `1px solid ${s[campo] ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
                          }}
                        >
                          <Icone className="h-3 w-3" /> {label}
                        </button>
                      ))}
                      <button
                        onClick={() => encerrarReuniao(s)}
                        disabled={trabalhando === s.space_name + "encerrar"}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-cream/40 hover:text-red-400 disabled:opacity-40"
                        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <PhoneOff className="h-3 w-3" /> Encerrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {slotsOrdenados.map((slot) => {
            const space = spacePorSlot.get(slot.id);
            const hora = horarioPorId.get(slot.horario_id)?.hora || "";
            const exs = excecoesPorSlot.get(slot.id) || [];

            return (
              <Card key={slot.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-[180px]">
                    <p className="text-sm text-cream font-semibold">
                      {DIAS[slot.dia_semana] || `Dia ${slot.dia_semana}`} · {hora}
                    </p>
                    <p className="text-xs text-cream/40 mt-0.5">
                      {slot.atividade_nome || "Sem atividade definida"}
                    </p>
                    {space?.meeting_uri && (
                      <div className="flex items-center gap-3 flex-wrap mt-1.5">
                        <a
                          href={space.meeting_uri}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs"
                          style={{ color: ROXO }}
                        >
                          <Link2 className="h-3 w-3" /> {space.meeting_code}
                        </a>
                        {space.pasta_drive_url ? (
                          <a
                            href={space.pasta_drive_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Pasta deste grupo no Drive, onde caem as gravações e transcrições."
                            className="inline-flex items-center gap-1 text-xs text-cream/40 hover:text-cream/70"
                          >
                            <FolderOpen className="h-3 w-3" /> pasta
                          </a>
                        ) : (
                          <button
                            onClick={() => criarPastaDoGrupo(space)}
                            disabled={trabalhando === space.space_name + "pasta"}
                            title="Cria a pasta deste grupo dentro da pasta raiz definida no Diagnóstico."
                            className="inline-flex items-center gap-1 text-xs text-cream/30 hover:text-cream/60 disabled:opacity-40"
                          >
                            <FolderPlus className="h-3 w-3" /> criar pasta
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {space ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {([
                        ["transcrever", "Transcrever", Mic],
                        ["gravar", "Gravar", Video],
                        ["notas", "Notas IA", FileText],
                      ] as const).map(([campo, label, Icone]) => (
                        <button
                          key={campo}
                          onClick={() => alternar(space, campo)}
                          disabled={trabalhando === space.space_name + campo}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all disabled:opacity-40"
                          style={{
                            background: space[campo] ? "rgba(108,92,231,0.12)" : "rgba(255,255,255,0.03)",
                            color: space[campo] ? ROXO : "rgba(253,251,247,0.35)",
                            border: `1px solid ${space[campo] ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
                          }}
                        >
                          <Icone className="h-3 w-3" /> {label}
                        </button>
                      ))}
                      <button
                        onClick={() => alternarAcesso(space)}
                        disabled={trabalhando === space.space_name + "acesso"}
                        title={
                          space.access_type === "OPEN"
                            ? "Qualquer pessoa com o link entra direto, sem ninguém admitir."
                            : "Quem é de fora do domínio precisa ser admitido. Clique para reabrir."
                        }
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all disabled:opacity-40"
                        style={{
                          background:
                            space.access_type === "OPEN"
                              ? "rgba(34,197,94,0.12)"
                              : "rgba(245,158,11,0.12)",
                          color: space.access_type === "OPEN" ? "#22C55E" : "#F59E0B",
                          border: `1px solid ${space.access_type === "OPEN" ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
                        }}
                      >
                        {space.access_type === "OPEN" ? (
                          <DoorOpen className="h-3 w-3" />
                        ) : (
                          <DoorClosed className="h-3 w-3" />
                        )}
                        {space.access_type === "OPEN" ? "Aberta" : "Fechada"}
                        {space.janela_automatica && (
                          <span className="opacity-50">no horário</span>
                        )}
                      </button>
                      {!space.janela_automatica && (
                        <button
                          onClick={() => religarJanela(space)}
                          disabled={trabalhando === space.space_name + "janela"}
                          title="Volta a abrir 15 minutos antes do horário do grupo e fechar quando o encontro já teria acabado."
                          className="px-2 py-1.5 rounded-lg text-xs text-cream/40 hover:text-cream/70 disabled:opacity-40"
                          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          voltar ao horário
                        </button>
                      )}
                      <button
                        onClick={() => encerrarReuniao(space)}
                        disabled={trabalhando === space.space_name + "encerrar"}
                        title="Encerra a reunião em andamento para todos, sem precisar entrar nela."
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-cream/40 hover:text-red-400 transition-colors disabled:opacity-40"
                        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <PhoneOff className="h-3 w-3" /> Encerrar
                      </button>
                      <button
                        onClick={() =>
                          setDuracaoAberta(duracaoAberta === slot.id ? null : slot.id)
                        }
                        title="Quanto tempo esta sala fica de pé antes de fechar e encerrar sozinha."
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                        style={{
                          background: space.duracao_min
                            ? "rgba(108,92,231,0.12)"
                            : "rgba(255,255,255,0.03)",
                          color: space.duracao_min ? ROXO : "rgba(253,251,247,0.35)",
                          border: `1px solid ${space.duracao_min ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <Clock3 className="h-3 w-3" />
                        {(() => {
                          const min = space.duracao_min ?? limiteEncerramento;
                          const h = min / 60;
                          return h >= 1
                            ? `${h.toFixed(1).replace(".0", "")}h`
                            : `${min} min`;
                        })()}
                      </button>
                      <button
                        onClick={() => setExcecaoAberta(excecaoAberta === slot.id ? null : slot.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-cream/40 hover:text-cream/70"
                        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <CalendarClock className="h-3 w-3" /> Data específica
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => criarSala(slot)}
                      disabled={precisaAutorizar || trabalhando === slot.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                      style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
                    >
                      {trabalhando === slot.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Video className="h-3.5 w-3.5" />
                      )}
                      Criar sala
                    </button>
                  )}
                </div>

                {space && cursos.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-cream/40">Gravações viram aulas de:</span>
                    <select
                      value={space.curso_id || ""}
                      onChange={(e) => vincularCurso(space, e.target.value)}
                      disabled={trabalhando === space.space_name + "curso"}
                      className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-cream max-w-[280px]"
                    >
                      <option value="">nenhum curso</option>
                      {cursos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {duracaoAberta === slot.id && space && (
                  <FormDuracao
                    atual={space.duracao_min}
                    padrao={limiteEncerramento}
                    salvando={trabalhando === space.space_name + "duracao"}
                    onSalvar={(min) => salvarDuracao(space, min)}
                    onFechar={() => setDuracaoAberta(null)}
                  />
                )}

                {excecaoAberta === slot.id && (
                  <FormExcecao
                    onSalvar={(data, gravar) => salvarExcecao(slot.id, data, gravar)}
                    onFechar={() => setExcecaoAberta(null)}
                  />
                )}

                {exs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                    {exs.map((e) => (
                      <div key={e.id} className="flex items-center gap-2 text-xs text-cream/50">
                        <CalendarClock className="h-3 w-3" />
                        <span>
                          {new Date(e.data + "T12:00:00").toLocaleDateString("pt-BR")}:{" "}
                          {e.gravar === true ? "grava" : e.gravar === false ? "não grava" : "padrão"}
                          {e.aplicada_em ? " (aplicada)" : " (agendada)"}
                        </span>
                        <button
                          onClick={() => removerExcecao(e.id)}
                          className="text-cream/30 hover:text-cream/60"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

          {slotsOrdenados.length === 0 && (
            <Card className="p-6 text-center text-sm text-cream/40">
              Nenhum grupo ativo na grade.
            </Card>
          )}
        </div>
      )}

      {aba === "encontros" && (
        <div className="space-y-3">
          <p className="text-xs text-cream/40">
            Cada encontro que de fato aconteceu, com quem esteve e por quanto tempo. A gravação e a
            transcrição ficam no Drive da conta organizadora; os links abaixo levam direto a elas.
          </p>

          {/* ── Busca dentro das transcrições ──
              É o que justifica guardar o texto: achar em que encontro um tema
              apareceu, sem abrir documento por documento. */}
          <Card className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarNasFalas()}
                placeholder="Buscar palavra nas transcrições"
                className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-cream placeholder:text-cream/25"
              />
              <select
                value={filtroGrupo}
                onChange={(e) => setFiltroGrupo(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-cream"
              >
                <option value="">Todos os grupos</option>
                {gruposDosEncontros.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setVerDescartados(!verDescartados)}
                title="Encontros de um minuto com uma pessoa costumam ser alguém testando o link."
                className="px-2.5 py-1.5 rounded-lg text-xs"
                style={{
                  background: verDescartados ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)",
                  color: verDescartados ? "#F59E0B" : "rgba(253,251,247,0.35)",
                  border: `1px solid ${verDescartados ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {verDescartados ? "Ocultar descartados" : "Ver descartados"}
              </button>
              <button
                onClick={buscarNasFalas}
                disabled={trabalhando === "busca"}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
              >
                {trabalhando === "busca" ? "Buscando" : "Buscar"}
              </button>
              {resultados !== null && (
                <button
                  onClick={() => {
                    setResultados(null);
                    setBusca("");
                  }}
                  className="text-xs text-cream/40 hover:text-cream/70"
                >
                  limpar
                </button>
              )}
            </div>

            {resultados !== null && resultados.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5 space-y-2 max-h-[420px] overflow-y-auto">
                <p className="text-xs text-cream/40">
                  {resultados.length} trecho{resultados.length > 1 ? "s" : ""} encontrado
                  {resultados.length > 1 ? "s" : ""}
                </p>
                {resultados.map((r) => (
                  <div key={r.id} className="text-xs border-l-2 border-white/10 pl-2.5 py-1">
                    <p className="text-cream/70">{r.texto}</p>
                    <p className="text-cream/35 mt-0.5">
                      {r.display_name}
                      {r.encontro && (
                        <>
                          {" · "}
                          {new Date(r.encontro.data_reuniao + "T12:00:00").toLocaleDateString("pt-BR")}
                          {r.encontro.atividade_nome ? ` · ${r.encontro.atividade_nome}` : ""}
                        </>
                      )}
                      {r.encontro?.transcricao_uri && (
                        <>
                          {" · "}
                          <a
                            href={r.encontro.transcricao_uri}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: ROXO }}
                          >
                            abrir transcrição
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {encontrosFiltrados.length === 0 ? (
            <Card className="p-6 text-center text-sm text-cream/40">
              Nenhum encontro capturado ainda. Depois que os grupos usarem as salas novas, eles
              aparecem aqui sozinhos.
            </Card>
          ) : (
            encontrosFiltrados.map((e) => {
              const aberto = encontroAberto === e.id;
              const presentes = e.participacoes.filter((p) => !p.eh_condutor);
              return (
                <Card key={e.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <button
                      onClick={() => setEncontroAberto(aberto ? null : e.id)}
                      className="text-left min-w-[180px]"
                    >
                      <p className="text-sm text-cream font-semibold">
                        {new Date(e.data_reuniao + "T12:00:00").toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                        {" · "}
                        {new Date(e.inicio).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-cream/40 mt-0.5">
                        {e.atividade_nome || "Sem atividade"}
                        {e.condutor_nome ? ` · ${e.condutor_nome}` : ""}
                      </p>
                      {e.descartado && (
                        <p className="text-xs text-amber-400/70 mt-1">
                          Fora das estatísticas
                          {e.descartado_motivo ? `: ${e.descartado_motivo}` : ""}
                        </p>
                      )}
                    </button>

                    <div className="flex items-center gap-3 flex-wrap text-xs">
                      <span className="text-cream/60">
                        <strong className="text-cream">{presentes.length}</strong> presentes
                      </span>
                      <span className="text-cream/40">{e.duracao_min ?? "—"} min</span>
                      {e.vozes_ativas_pct !== null && (
                        <span className="text-cream/40">
                          {e.vozes_ativas_pct}% falaram
                        </span>
                      )}
                      {e.transcricao_uri && (
                        <a
                          href={e.transcricao_uri}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
                        >
                          <FileText className="h-3 w-3" /> Transcrição
                        </a>
                      )}
                      {e.gravacao_uri && (
                        <a
                          href={e.gravacao_uri}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
                        >
                          <Video className="h-3 w-3" /> Gravação
                        </a>
                      )}
                      <button
                        onClick={() => descartarEncontro(e)}
                        disabled={trabalhando === e.id}
                        title={
                          e.descartado
                            ? "Trazer de volta para as estatísticas."
                            : "Tirar de todas as estatísticas. O registro continua guardado."
                        }
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-cream/40 hover:text-cream/70 disabled:opacity-40"
                        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        {e.descartado ? "Restaurar" : "Descartar"}
                      </button>
                    </div>
                  </div>

                  {aberto && (
                    <div className="mt-3 pt-3 border-t border-white/5 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-cream/30 text-left">
                            <th className="pb-2 font-normal">Pessoa</th>
                            <th className="pb-2 font-normal">Minutos</th>
                            <th className="pb-2 font-normal">Do encontro</th>
                            <th className="pb-2 font-normal">Chegou</th>
                            <th className="pb-2 font-normal">Falou</th>
                          </tr>
                        </thead>
                        <tbody>
                          {e.participacoes.map((p, i) => (
                            <tr key={i} className="border-t border-white/5">
                              <td className="py-1.5 text-cream/70">
                                {p.display_name}
                                {p.eh_condutor && (
                                  <span className="ml-1.5 text-cream/30">condutor</span>
                                )}
                                {!p.aluno_id && !p.eh_condutor && (
                                  <span className="ml-1.5 text-amber-400/60">sem cadastro</span>
                                )}
                              </td>
                              <td className="py-1.5 text-cream/50">{p.minutos_presentes}</td>
                              <td className="py-1.5 text-cream/50">
                                {p.permanencia_pct !== null ? `${p.permanencia_pct}%` : "—"}
                              </td>
                              <td className="py-1.5 text-cream/50">
                                {p.atraso_min === null
                                  ? "—"
                                  : p.atraso_min <= tolerancia
                                    ? "no horário"
                                    : `${p.atraso_min} min depois`}
                              </td>
                              <td className="py-1.5 text-cream/50">
                                {p.minutos_fala === null
                                  ? "—"
                                  : p.minutos_fala === 0
                                    ? "não falou"
                                    : `${p.minutos_fala.toFixed(1)} min · ${p.n_turnos_fala} vezes`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {aba === "aulas" && (
        <div className="space-y-3">
          <p className="text-xs text-cream/40">
            Gravações de grupos vinculados a um curso. Aprovar cria a aula no curso e libera o
            vídeo para quem tiver o link, que é o que permite o aluno assistir. Antes de aprovar,
            vale abrir e conferir o começo da gravação, que costuma pegar a chegada das pessoas.
          </p>

          {aulas.length === 0 ? (
            <Card className="p-6 text-center text-sm text-cream/40">
              Nada esperando. Aparecem aqui as gravações dos grupos que você vincular a um curso,
              na aba Salas.
            </Card>
          ) : (
            aulas.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <input
                      type="text"
                      value={tituloEditado[a.id] ?? a.titulo}
                      onChange={(e) =>
                        setTituloEditado((t) => ({ ...t, [a.id]: e.target.value }))
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-cream"
                    />
                    <p className="text-xs text-cream/40 mt-1.5">
                      {a.curso_titulo}
                      {" · "}
                      {new Date(a.data_reuniao + "T12:00:00").toLocaleDateString("pt-BR")}
                      {a.duracao_min ? ` · ${a.duracao_min} min` : ""}
                      {" · "}
                      <a
                        href={a.video_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: ROXO }}
                      >
                        ver gravação
                      </a>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => decidirAula(a, "aprovar")}
                      disabled={trabalhando === a.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                      style={{ background: "rgba(34,197,94,0.12)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.3)" }}
                    >
                      Publicar
                    </button>
                    <button
                      onClick={() => decidirAula(a, "descartar")}
                      disabled={trabalhando === a.id}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-cream/40 hover:text-red-400 disabled:opacity-40"
                      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {aba === "nomes" && (
        <div className="space-y-3">
          <p className="text-xs text-cream/40">
            O Google entrega o nome exibido, nunca o e-mail. Ligar um nome a uma pessoa aqui faz
            todos os encontros daquele nome, passados e futuros, contarem no histórico dela.
            Errar contamina duas histórias ao mesmo tempo, então tudo aqui é reversível.
          </p>

          {vinculos.length > 0 && (
            <Card className="p-4">
              <p className="text-sm text-cream font-semibold mb-2">Vínculos já feitos</p>
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                {vinculos.map((v) => (
                  <div
                    key={v.display_name_norm}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-cream/60">
                      {v.display_name}
                      <span className="text-cream/30"> vira </span>
                      {v.ignorado ? (
                        <span className="text-amber-400/70">não é aluno</span>
                      ) : (
                        <span className="text-cream">{v.aluno_nome}</span>
                      )}
                    </span>
                    <button
                      onClick={() => desfazerVinculo(v)}
                      disabled={trabalhando === v.display_name_norm}
                      className="text-cream/35 hover:text-red-400 shrink-0 disabled:opacity-40"
                    >
                      desfazer
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {fila.length === 0 ? (
            <Card className="p-6 text-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-cream/60">Nenhum nome pendente.</p>
            </Card>
          ) : (
            fila.map((item) => (
              <Card key={item.display_name_norm} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-[160px]">
                    <p className="text-sm text-cream font-semibold flex items-center gap-1.5">
                      <UserSearch className="h-3.5 w-3.5 text-cream/30" />
                      {item.display_name}
                    </p>
                    <p className="text-xs text-cream/40 mt-0.5">
                      {item.ocorrencias} encontro{item.ocorrencias > 1 ? "s" : ""} ·{" "}
                      {item.minutos_totais} min no total
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 items-center">
                    {item.sugestoes.length === 0 && (
                      <span className="text-xs text-cream/30">Nenhum nome parecido no cadastro</span>
                    )}
                    {item.sugestoes.map((s) => (
                      <button
                        key={s.aluno_id}
                        onClick={() => conciliar(item, s.aluno_id)}
                        disabled={trabalhando === item.display_name_norm}
                        className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40"
                        style={{
                          background: "rgba(108,92,231,0.12)",
                          color: ROXO,
                          border: "1px solid rgba(108,92,231,0.3)",
                        }}
                      >
                        {s.full_name}{" "}
                        <span className="opacity-50">{Math.round(s.score * 100)}%</span>
                      </button>
                    ))}
                    <button
                      onClick={() => conciliar(item, null)}
                      disabled={trabalhando === item.display_name_norm}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-cream/40 hover:text-cream/70 disabled:opacity-40"
                      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      Não é aluno
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {aba === "diagnostico" && (
        <div className="space-y-3">
          <Card className="p-4">
            <p className="text-sm text-cream font-semibold mb-1">Tolerância de atraso</p>
            <p className="text-xs text-cream/40 mb-3">
              Quem chega dentro desse prazo não conta como atrasado. Vale para o histórico
              inteiro: mudar o número aqui recalcula também os encontros já capturados.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={60}
                value={tolerancia}
                onChange={(e) => setTolerancia(Number(e.target.value))}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-cream"
              />
              <span className="text-xs text-cream/40">minutos</span>
            </div>

            <p className="text-sm text-cream font-semibold mt-4 mb-1">
              Pasta das gravações
            </p>
            <p className="text-xs text-cream/40 mb-3">
              Cole o endereço de uma pasta do Drive. Gravações e transcrições passam a ser movidas
              para lá assim que o Google terminar de gerá-las, com nome de data e grupo. Vazio
              deixa tudo onde o Meet coloca.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={pastaDrive}
                onChange={(e) => setPastaDrive(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="flex-1 min-w-[240px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-cream placeholder:text-cream/25"
              />
              <button
                onClick={salvarPasta}
                disabled={trabalhando === "pasta"}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
              >
                {trabalhando === "pasta" ? "Conferindo" : "Salvar pasta"}
              </button>
            </div>

            <p className="text-sm text-cream font-semibold mt-4 mb-1">
              Encerrar reunião esquecida aberta
            </p>
            <p className="text-xs text-cream/40 mb-3">
              A sala é permanente e o link nunca expira, então uma reunião que ninguém encerrou
              continua de pé e continua gravando. Passando deste tempo, o sistema encerra para
              todos. Zero desliga.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                min={0}
                max={600}
                step={30}
                value={limiteEncerramento}
                onChange={(e) => setLimiteEncerramento(Number(e.target.value))}
                className="w-24 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-cream"
              />
              <span className="text-xs text-cream/40">
                minutos
                {limiteEncerramento >= 60
                  ? ` (${(limiteEncerramento / 60).toFixed(1).replace(".0", "")} h)`
                  : ""}
              </span>
              <button
                onClick={salvarTolerancia}
                disabled={trabalhando === "tolerancia"}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
              >
                Salvar
              </button>
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <Linha
              ok={!!status?.credenciais_app_configuradas}
              texto="Credenciais do app configuradas no servidor"
            />
            <Linha ok={!!status?.autorizado} texto={`Conta autorizada${status?.organizer_email ? `: ${status.organizer_email}` : ""}`} />
            <Linha ok={!!status?.cron_configurado} texto="Segredo do cron configurado" />
            <Linha ok={(status?.total_salas ?? 0) > 0} texto={`${status?.total_salas ?? 0} salas criadas`} />
          </Card>

          <Card className="p-4">
            <p className="text-sm text-cream font-semibold mb-2">Última busca</p>
            {status?.ultima_ingestao ? (
              <div className="text-xs text-cream/50 space-y-1">
                <p>
                  {new Date(status.ultima_ingestao.executado_em).toLocaleString("pt-BR")}
                </p>
                <p>
                  {status.ultima_ingestao.encontros_novos} novos ·{" "}
                  {status.ultima_ingestao.encontros_atualizados} atualizados ·{" "}
                  {status.ultima_ingestao.participacoes_gravadas} participações
                </p>
                {status.ultima_ingestao.erro && (
                  <p className="text-amber-400/80 mt-2">{status.ultima_ingestao.erro}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-cream/40">Ainda não rodou.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Linha({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
      )}
      <span className={ok ? "text-cream/60" : "text-cream/40"}>{texto}</span>
    </div>
  );
}

function FormDuracao({
  atual,
  padrao,
  salvando,
  onSalvar,
  onFechar,
}: {
  atual: number | null;
  padrao: number;
  salvando: boolean;
  onSalvar: (minutos: number | null) => void;
  onFechar: () => void;
}) {
  const [valor, setValor] = useState(atual ?? padrao);

  // Atalhos cobrem o que se pede na prática; o campo cobre o resto.
  const opcoes = [60, 90, 120, 180, 240];

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <p className="text-xs text-cream/50 mb-2">
        Depois deste tempo, a reunião é encerrada para todos e a sala fecha. Vale para este
        grupo; os outros seguem o padrão de {padrao} minutos.
      </p>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex gap-1">
          {opcoes.map((o) => (
            <button
              key={o}
              onClick={() => setValor(o)}
              className="px-2 py-1.5 rounded-lg text-xs"
              style={{
                background: valor === o ? "rgba(108,92,231,0.12)" : "rgba(255,255,255,0.03)",
                color: valor === o ? ROXO : "rgba(253,251,247,0.35)",
                border: `1px solid ${valor === o ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              {o >= 60 ? `${(o / 60).toFixed(1).replace(".0", "")}h` : `${o}min`}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={30}
          max={600}
          step={15}
          value={valor}
          onChange={(e) => setValor(Number(e.target.value))}
          className="w-20 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-cream"
        />
        <button
          onClick={() => onSalvar(valor)}
          disabled={salvando || valor < 30 || valor > 600}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
          style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
        >
          Salvar
        </button>
        {atual !== null && (
          <button
            onClick={() => onSalvar(null)}
            disabled={salvando}
            className="px-2.5 py-1.5 rounded-lg text-xs text-cream/40 hover:text-cream/70 disabled:opacity-40"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            usar o padrão
          </button>
        )}
        <button onClick={onFechar} className="px-2 py-1.5 text-cream/30 hover:text-cream/60">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function FormExcecao({
  onSalvar,
  onFechar,
}: {
  onSalvar: (data: string, gravar: boolean) => void;
  onFechar: () => void;
}) {
  const [data, setData] = useState("");
  const [gravar, setGravar] = useState(true);

  return (
    <div className="mt-3 pt-3 border-t border-white/5 flex items-end gap-2 flex-wrap">
      <div>
        <label className="block text-xs text-cream/40 mb-1">Data</label>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-cream"
        />
      </div>
      <div className="flex gap-1">
        {[
          [true, "Gravar"],
          [false, "Não gravar"],
        ].map(([v, label]) => (
          <button
            key={String(v)}
            onClick={() => setGravar(v as boolean)}
            className="px-2.5 py-1.5 rounded-lg text-xs"
            style={{
              background: gravar === v ? "rgba(108,92,231,0.12)" : "rgba(255,255,255,0.03)",
              color: gravar === v ? ROXO : "rgba(253,251,247,0.35)",
              border: `1px solid ${gravar === v ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {label as string}
          </button>
        ))}
      </div>
      <button
        onClick={() => data && onSalvar(data, gravar)}
        disabled={!data}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
        style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
      >
        Agendar
      </button>
      <button onClick={onFechar} className="px-2 py-1.5 text-cream/30 hover:text-cream/60">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
