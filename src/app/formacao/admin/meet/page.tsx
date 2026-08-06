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
import ListaParticipacoes from "@/components/meet/ListaParticipacoes";
import FichaPessoa from "@/components/meet/FichaPessoa";
import type { ParticipacaoUI } from "@/components/meet/tipos";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarClock, CheckCircle2, Clock3, DoorClosed, DoorOpen, Link2,
  FolderOpen, FolderPlus, Loader2, Mic, PhoneOff, RefreshCw, ShieldCheck,
  UserSearch, Video, FileText, X, Youtube,
  Trash2, Download, Play, ThumbsUp, ThumbsDown, EyeOff, Copy, ChevronDown, ChevronRight,
  ImageOff,
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
  subir_youtube: boolean;
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
  curso_slug: string | null;
  curso_publicado: boolean;
}
interface AulaBloqueada {
  id: string;
  titulo: string;
  data_reuniao: string;
  motivo: string;
  /** Esperando o envio ao YouTube: é espera normal, não falha de configuração. */
  esperando_youtube?: boolean;
  youtube_status?: string | null;
  youtube_pct?: number;
  /** Curso já vinculado à sala: dispensa escolher curso na mão. */
  curso_id?: string | null;
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
  // Veredito da mesma função que autoriza o sistema a concluir que um encontro
  // não aconteceu. Opcional porque a tela pode estar aberta contra um servidor
  // que ainda não tem o campo, e nesse caso a idade é calculada pela data.
  captura?: {
    saudavel: boolean;
    motivo: string | null;
    horas_desde_ultima_ingestao: number | null;
  };
}
interface PessoaDoCertificado {
  nome: string;
  email: string | null;
  aluno_id: string | null;
  score: number;
}

interface ItemFila {
  display_name: string;
  display_name_norm: string;
  ocorrencias: number;
  minutos_totais: number;
  sugestoes: { aluno_id: string; full_name: string; score: number }[];
  /** Quem preencheu o certificado dos mesmos encontros e ainda não tem dono. */
  do_certificado: PessoaDoCertificado[];
}

type Participacao = ParticipacaoUI;
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
  /** Nome de documento de quem se identificou sem ter conta. */
  pessoa_nome?: string | null;
  tem_conta?: boolean;
  origem?: string | null;
  evidencia?: string | null;
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

interface Clipe {
  id: string;
  titulo: string | null;
  descricao: string | null;
  texto: string | null;
  hashtags: string[] | null;
  url: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  duracao_seg: number | null;
  pontuacao: number | null;
  avaliacao: "gostei" | "rejeitado" | null;
  anotacao: string | null;
  oculto: boolean;
}
interface ClipJob {
  id: string;
  titulo: string;
  video_url: string;
  status: "pendente" | "subindo" | "processando" | "pronto" | "erro";
  erro: string | null;
  created_at: string;
  youtube_video_id: string | null;
  youtube_bytes_enviados: number | null;
  youtube_bytes_total: number | null;
  youtube_erro: string | null;
  tentar_apos: string | null;
  clipes: Clipe[];
}
interface AulaParaClipe {
  id: string;
  titulo: string;
  secao: string | null;
  duracao_min: number | null;
  passa_pelo_youtube: boolean;
  ja_enviada: boolean;
  status: string | null;
  erro: string | null;
}

type Aba = "salas" | "encontros" | "aulas" | "clipes" | "nomes" | "diagnostico";

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
  // Quem está com a ficha aberta. Guarda o nome de tela junto para o título do
  // modal não piscar vazio enquanto a rota responde.
  const [pessoaAberta, setPessoaAberta] = useState<{
    norm: string;
    aluno_id: string | null;
    nome: string;
  } | null>(null);
  const [verDescartados, setVerDescartados] = useState(false);
  const [cursos, setCursos] = useState<CursoOpcao[]>([]);
  const [aulas, setAulas] = useState<AulaSugerida[]>([]);
  const [aulasPublicadas, setAulasPublicadas] = useState<AulaSugerida[]>([]);
  const [aulasBloqueadas, setAulasBloqueadas] = useState<AulaBloqueada[]>([]);
  const [clipJobs, setClipJobs] = useState<ClipJob[]>([]);
  const [clipesConfigurado, setClipesConfigurado] = useState(false);
  const [cursoParaClipes, setCursoParaClipes] = useState("");
  const [aulasParaClipe, setAulasParaClipe] = useState<AulaParaClipe[]>([]);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [buscandoAulas, setBuscandoAulas] = useState(false);
  const [falhouEncontros, setFalhouEncontros] = useState(false);
  const [diagDrive, setDiagDrive] = useState<string | null>(null);
  const [cursoParaBloqueada, setCursoParaBloqueada] = useState<Record<string, string>>({});
  const [jobAberto, setJobAberto] = useState<string | null>(null);
  const [filtroClipes, setFiltroClipes] = useState<"novos" | "gostei" | "todos">("novos");
  const [assistindo, setAssistindo] = useState<Clipe | null>(null);
  const [atalhos, setAtalhos] = useState<Record<string, string>>({});
  const [anotacao, setAnotacao] = useState("");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);

  const carregarClipes = useCallback(async () => {
    const j = await pegarJson<{ jobs?: ClipJob[]; configurado?: boolean; error?: string }>(
      "/formacao/api/admin/meet/clipes"
    );
    if (j && !j.error) {
      setClipJobs(j.jobs || []);
      setClipesConfigurado(!!j.configurado);
    }
  }, []);

  // Escolher o curso não manda nada: só mostra o que tem dentro. O envio é
  // sempre por vídeo marcado, porque é por vídeo que se paga.
  const carregarAulasDoCurso = useCallback(async (cursoId: string) => {
    setMarcadas([]);
    setAulasParaClipe([]);
    if (!cursoId) return;
    setBuscandoAulas(true);
    const j = await pegarJson<{ aulas?: AulaParaClipe[] }>(
      `/formacao/api/admin/meet/clipes?curso_id=${cursoId}`
    );
    setAulasParaClipe(j?.aulas || []);
    setBuscandoAulas(false);
  }, []);

  async function enviarMarcadasParaClipes() {
    if (!marcadas.length) return;

    const escolhidas = aulasParaClipe.filter((a) => marcadas.includes(a.id));
    const minutos = escolhidas.reduce((s, a) => s + (a.duracao_min || 0), 0);
    const semDuracao = escolhidas.filter((a) => !a.duracao_min).length;

    const custo = minutos
      ? `São ${minutos} minutos de vídeo${semDuracao ? ` (mais ${semDuracao} sem duração registrada)` : ""}.`
      : "A duração desses vídeos não está registrada, então não dá para estimar o custo aqui.";

    if (
      !confirm(
        `Gerar clipes de ${escolhidas.length} ${escolhidas.length === 1 ? "vídeo" : "vídeos"}?\n\n` +
          `${custo}\n\nA cobrança é por minuto de vídeo original, não por clipe gerado.`
      )
    )
      return;

    setTrabalhando("clipes");
    try {
      const r = await fetch("/formacao/api/admin/meet/clipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_ids: marcadas }),
      });
      const j = await lerResposta(r);
      toast.success((j.aviso as string) || "Enviado.");
      setMarcadas([]);
      await Promise.all([carregarClipes(), carregarAulasDoCurso(cursoParaClipes)]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setTrabalhando(null);
    }
  }
  const [falhouFila, setFalhouFila] = useState(false);
  const [tituloEditado, setTituloEditado] = useState<Record<string, string>>({});

  const carregarAulas = useCallback(async () => {
    const j = await pegarJson<{
      fila?: AulaSugerida[];
      publicadas?: AulaSugerida[];
      bloqueadas?: AulaBloqueada[];
      error?: string;
    }>("/formacao/api/admin/meet/aulas");
    if (j && !j.error) {
      setAulas(j.fila || []);
      setAulasPublicadas(j.publicadas || []);
      setAulasBloqueadas(j.bloqueadas || []);
    }
  }, []);

  async function decidirAula(a: AulaSugerida, acao: "aprovar" | "descartar") {
    // Descartar não tem volta: a sugestão sai da fila e nenhuma tela lê
    // descartadas. Aprovar também merece pausa, porque libera o vídeo para
    // quem tiver o link.
    const aviso =
      acao === "descartar"
        ? `Descartar "${a.titulo}"? Ela não volta para a fila, e a gravação continua só no Drive.`
        : `Publicar "${a.titulo}" em ${a.curso_titulo}? O vídeo fica acessível a quem tiver o link.`;
    if (!confirm(aviso)) return;

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

  async function alternarYoutube(space: SpaceRow) {
    const novo = !space.subir_youtube;
    setTrabalhando(space.space_name + "yt");
    try {
      const r = await fetch("/formacao/api/admin/meet/spaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_name: space.space_name, subir_youtube: novo }),
      });
      await lerResposta(r);
      setSpaces((atual) =>
        atual.map((s) =>
          s.space_name === space.space_name ? { ...s, subir_youtube: novo } : s
        )
      );
      toast.success(
        novo
          ? "As gravações deste grupo passam a subir para o YouTube como não listadas."
          : "As gravações deste grupo ficam só no Drive."
      );
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
        body: JSON.stringify({ rotulo: nome, gravar: true, transcrever: true, notas: true }),
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
    // Falha ao buscar é diferente de não haver nada: sem separar os dois, a
    // tela anuncia "nenhum encontro" quando na verdade não conseguiu perguntar.
    if (j && !j.error) {
      setEncontros(j.encontros || []);
      setFalhouEncontros(false);
    } else {
      setFalhouEncontros(true);
    }
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

  /**
   * Apaga de vez, sem volta.
   *
   * Descartar esconde e é reversível; isto não é, e por isso pergunta. Vale
   * para o caso comum de testar o link cinco vezes e ficar com cinco encontros
   * de um minuto atravancando a lista para sempre.
   */
  async function apagarEncontro(e: Encontro) {
    if (
      !confirm(
        `Apagar de vez o encontro de ${new Date(e.inicio).toLocaleDateString("pt-BR")}?\n\n` +
          "As participações e as falas vão junto. Isto não tem volta."
      )
    )
      return;

    setTrabalhando(e.id);
    try {
      const r = await fetch(`/formacao/api/admin/meet/encontros?id=${e.id}&apagar=1`, {
        method: "DELETE",
      });
      const j = await lerResposta(r);
      toast.success((j.aviso as string) || "Apagado.");
      await carregarEncontros();
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  /**
   * Guarda a opinião sobre um clipe sem recarregar a lista inteira.
   *
   * Avaliar quarenta clipes é quarenta cliques seguidos; buscar tudo de novo a
   * cada um faria a grade piscar e perder a posição da rolagem no meio do
   * trabalho.
   */
  async function avaliarClipe(c: Clipe, valor: "gostei" | "rejeitado") {
    const novo = c.avaliacao === valor ? null : valor;
    setClipJobs((jobs) =>
      jobs.map((j) => ({
        ...j,
        clipes: j.clipes.map((x) => (x.id === c.id ? { ...x, avaliacao: novo } : x)),
      }))
    );
    try {
      const r = await fetch("/formacao/api/admin/meet/clipes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clip_id: c.id, avaliacao: novo }),
      });
      await lerResposta(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar");
      await carregarClipes();
    }
  }

  async function salvarAnotacao(c: Clipe) {
    if ((c.anotacao || "") === anotacao) return;
    setClipJobs((jobs) =>
      jobs.map((j) => ({
        ...j,
        clipes: j.clipes.map((x) => (x.id === c.id ? { ...x, anotacao } : x)),
      }))
    );
    try {
      await fetch("/formacao/api/admin/meet/clipes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clip_id: c.id, anotacao }),
      });
    } catch {
      toast.error("Não consegui salvar a anotação.");
    }
  }

  async function apagarReprovados(jobId: string) {
    if (!confirm("Apagar todos os cortes reprovados deste vídeo?\n\nIsto não tem volta.")) return;
    setTrabalhando(jobId + "limpar");
    try {
      const r = await fetch(
        `/formacao/api/admin/meet/clipes?rejeitados=1&job_id=${jobId}`,
        { method: "DELETE" }
      );
      const j = await lerResposta(r);
      toast.success((j.aviso as string) || "Limpo.");
      await carregarClipes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  async function ocultarClipe(c: Clipe) {
    setClipJobs((jobs) =>
      jobs.map((j) => ({
        ...j,
        clipes: j.clipes.map((x) => (x.id === c.id ? { ...x, oculto: true } : x)),
      }))
    );
    try {
      const r = await fetch("/formacao/api/admin/meet/clipes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clip_id: c.id, oculto: true }),
      });
      await lerResposta(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar");
      await carregarClipes();
    }
  }

  const carregarAtalhos = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb
      .from("study_links")
      .select("slug, space_name")
      .not("space_name", "is", null);
    const mapa: Record<string, string> = {};
    for (const l of (data || []) as { slug: string; space_name: string }[]) {
      mapa[l.space_name] = l.slug;
    }
    setAtalhos(mapa);
  }, []);

  async function criarAtalhosDasSalas() {
    setTrabalhando("atalhos");
    try {
      const r = await fetch("/formacao/api/admin/meet/spaces", { method: "PUT" });
      const j = await lerResposta(r);
      toast.success((j.aviso as string) || "Feito.");
      await carregarAtalhos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  async function criarAulaDaGravacao(b: AulaBloqueada, forcarDrive = false) {
    // Quando a sala já tem curso, o vínculo vale: obrigar a escolher de novo só
    // para destravar uma espera do YouTube seria pedir duas vezes a mesma coisa.
    const cursoId = cursoParaBloqueada[b.id] || b.curso_id;
    if (!cursoId) return;

    if (forcarDrive) {
      const ok = confirm(
        `Publicar "${b.titulo}" com o arquivo do Drive?\n\n` +
          "O aluno assiste pelo Drive, não pelo YouTube. Quando o envio ao YouTube terminar, " +
          "a aula troca sozinha para o vídeo do YouTube."
      );
      if (!ok) return;
    }

    setTrabalhando(b.id);
    try {
      const r = await fetch("/formacao/api/admin/meet/aulas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "criar",
          encontro_id: b.id,
          curso_id: cursoId,
          forcar_drive: forcarDrive,
        }),
      });
      const j = await lerResposta(r);
      toast.success((j.aviso as string) || "Na fila.");
      await carregarAulas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  async function ignorarGravacao(b: AulaBloqueada) {
    setTrabalhando(b.id);
    try {
      const r = await fetch("/formacao/api/admin/meet/aulas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "ignorar", encontro_id: b.id }),
      });
      const j = await lerResposta(r);
      toast.success((j.aviso as string) || "Fora da fila.");
      await carregarAulas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  async function verificarDrive() {
    setTrabalhando("drive");
    setDiagDrive(null);
    try {
      const j = await pegarJson<Record<string, unknown>>(
        "/formacao/api/admin/meet/diagnostico-drive"
      );
      if (!j) throw new Error("Sem resposta do servidor.");
      // A conclusão é o que interessa; o resto é matéria para quem for
      // investigar a fundo, e cabe no console.
      console.info("[diagnostico-drive]", j);
      setDiagDrive(
        (j.conclusao as string) ||
          (j.erro as string) ||
          "Sem problemas encontrados no acesso ao Drive."
      );
    } catch (e) {
      setDiagDrive(e instanceof Error ? e.message : "Não consegui verificar.");
    } finally {
      setTrabalhando(null);
    }
  }

  async function apagarEscolhidos() {
    if (!escolhidos.length) return;
    if (
      !confirm(
        `Apagar de vez ${escolhidos.length} ${escolhidos.length === 1 ? "encontro" : "encontros"}?\n\n` +
          "As participações e as falas vão junto, e eles não voltam na próxima captura. Isto não tem volta."
      )
    )
      return;

    setTrabalhando("escolhidos");
    try {
      const r = await fetch(
        `/formacao/api/admin/meet/encontros?ids=${escolhidos.join(",")}`,
        { method: "DELETE" }
      );
      const j = await lerResposta(r);
      toast.success((j.aviso as string) || "Apagados.");
      setEscolhidos([]);
      await carregarEncontros();
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTrabalhando(null);
    }
  }

  async function limparDescartados() {
    if (
      !confirm(
        "Apagar de vez TODOS os encontros descartados?\n\n" +
          "As participações e as falas de cada um vão junto. Isto não tem volta."
      )
    )
      return;

    setTrabalhando("limpar");
    try {
      const r = await fetch("/formacao/api/admin/meet/encontros?apagar_descartados=1", {
        method: "DELETE",
      });
      const j = await lerResposta(r);
      toast.success((j.aviso as string) || "Limpo.");
      await carregarEncontros();
      await carregar();
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
    if (j && !j.error) {
      setFila(j.fila || []);
      setFalhouFila(false);
    } else {
      setFalhouFila(true);
    }
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
    if (aba === "clipes") carregarClipes();
    if (aba === "salas") carregarAtalhos();
  }, [
    aba,
    carregarFila,
    carregarVinculos,
    carregarEncontros,
    carregarAulas,
    carregarClipes,
    carregarAtalhos,
  ]);

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
        // Tudo ligado. Gravar deixou de incomodar quando o vídeo publicado
        // passou a começar no minuto em que o encontro de fato começou.
        body: JSON.stringify({ slot_id: slot.id, gravar: true, transcrever: true, notas: true }),
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
    // Esta função era a única do arquivo que ignorava a falha: quando o
    // servidor recusava, nada acontecia na tela e a pessoa não tinha como
    // saber se tinha funcionado.
    try {
      const r = await fetch(`/formacao/api/admin/meet/excecoes?id=${id}`, { method: "DELETE" });
      await lerResposta(r);
      toast.success("Exceção removida.");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui remover a exceção.");
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

  /**
   * Liga o nome de tela a quem preencheu o certificado daquele encontro.
   *
   * Vale mesmo quando a pessoa não tem conta: identificar não é a mesma coisa
   * que cadastrar, e a maior parte de quem frequenta os grupos nunca criou
   * conta. Se por acaso houver perfil com aquele e-mail, o servidor liga as
   * duas coisas sozinho e o histórico vem junto.
   */
  async function conciliarPeloCertificado(item: ItemFila, pessoa: PessoaDoCertificado) {
    setTrabalhando(item.display_name_norm);
    try {
      const r = await fetch("/formacao/api/admin/meet/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: item.display_name,
          pessoa_nome: pessoa.nome,
          pessoa_email: pessoa.email,
          aluno_id: pessoa.aluno_id || undefined,
        }),
      });
      const j = await lerResposta(r);
      toast.success(
        j.sem_conta
          ? `${item.display_name} agora é ${pessoa.nome}, sem conta na plataforma.`
          : `${j.participacoes_atualizadas} participações ligadas a ${pessoa.nome}.`
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
              <p className="text-sm text-cream break-all">
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

      {/* Abas: no celular rola na horizontal em vez de quebrar linha, senão a barra fica alta demais */}
      <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1 md:mx-0 md:px-0 md:pb-0 md:flex-wrap md:overflow-visible">
        {([
          ["salas", "Salas dos grupos"],
          ["encontros", `Encontros${status?.total_encontros ? ` (${status.total_encontros})` : ""}`],
          ["aulas", `Aulas a publicar${aulas.length ? ` (${aulas.length})` : ""}`],
          ["clipes", "Clipes"],
          ["nomes", `Nomes a resolver${status?.nomes_pendentes ? ` (${fila.length || status.nomes_pendentes})` : ""}`],
          ["diagnostico", "Ajustes"],
        ] as [Aba, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className="shrink-0 font-dm text-xs px-3 py-2.5 md:py-1.5 min-h-[40px] md:min-h-0 rounded-full transition-all"
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

          {/* Endereço curto por sala.
              Divulgar allos.org.br/formacao/<slug> em vez do link do Meet faz o
              clique passar pelo site e, principalmente, deixa de exigir
              reavisar todo mundo quando o link da reunião muda: o destino é
              lido da sala a cada clique. */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-[200px] flex-1">
                <p className="text-sm text-cream font-semibold">Endereço curto de cada sala</p>
                <p className="text-xs text-cream/40 mt-0.5">
                  Divulgue{" "}
                  <code className="text-cream/60">allos.org.br/formacao/&lt;nome&gt;</code> em vez do
                  link do Meet. Quando o link da reunião mudar, o atalho segue sozinho.
                </p>
              </div>
              <button
                onClick={criarAtalhosDasSalas}
                disabled={trabalhando === "atalhos"}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: "rgba(108,92,231,0.12)", color: ROXO, border: "1px solid rgba(108,92,231,0.3)" }}
              >
                {trabalhando === "atalhos" ? "Criando" : "Criar os que faltam"}
              </button>
            </div>
          </Card>

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
                className="flex-1 min-w-[180px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-base md:text-xs text-cream placeholder:text-cream/25"
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
                        {/* O endereço a divulgar. Fica ao lado do link do Meet,
                            e não no lugar dele, porque quem conduz ainda entra
                            pelo Meet direto. */}
                        {atalhos[space.space_name] && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `https://allos.org.br/formacao/${atalhos[space.space_name]}`
                              );
                              toast.success("Endereço copiado.");
                            }}
                            title="Copiar o endereço curto para divulgar"
                            className="inline-flex items-center gap-1 text-xs text-cream/45 hover:text-cream/70"
                          >
                            <Copy className="h-3 w-3" /> /{atalhos[space.space_name]}
                          </button>
                        )}
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
                      <button
                        onClick={() => alternarYoutube(space)}
                        disabled={trabalhando === space.space_name + "yt"}
                        title="Envia a gravação para o YouTube como não listada e usa esse vídeo na aula do curso, começando no ponto em que o encontro de fato começou."
                        className="flex items-center gap-1.5 px-2.5 py-2.5 md:py-1.5 min-h-[40px] md:min-h-0 rounded-lg text-xs transition-all disabled:opacity-40"
                        style={{
                          background: space.subir_youtube
                            ? "rgba(255,0,0,0.10)"
                            : "rgba(255,255,255,0.03)",
                          color: space.subir_youtube ? "#FF4D4D" : "rgba(253,251,247,0.35)",
                          border: `1px solid ${space.subir_youtube ? "rgba(255,0,0,0.3)" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <Youtube className="h-3 w-3" /> YouTube
                      </button>
                      {([
                        ["transcrever", "Transcrever", Mic],
                        ["gravar", "Gravar", Video],
                        ["notas", "Notas IA", FileText],
                      ] as const).map(([campo, label, Icone]) => (
                        <button
                          key={campo}
                          onClick={() => alternar(space, campo)}
                          disabled={trabalhando === space.space_name + campo}
                          className="flex items-center gap-1.5 px-2.5 py-2.5 md:py-1.5 min-h-[40px] md:min-h-0 rounded-lg text-xs transition-all disabled:opacity-40"
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
                        // Sem verde e vermelho: aberta e fechada não são "certo"
                        // e "errado", são dois estados normais em momentos
                        // diferentes do dia. Verde na sala aberta sugeria que
                        // aquele era o estado seguro, quando é o contrário:
                        // aberta é a sala em que qualquer um com o link entra.
                        className="flex items-center gap-1.5 px-2.5 py-2.5 md:py-1.5 min-h-[40px] md:min-h-0 rounded-lg text-xs transition-all disabled:opacity-40"
                        style={{
                          background:
                            space.access_type === "OPEN"
                              ? "rgba(108,92,231,0.12)"
                              : "rgba(255,255,255,0.03)",
                          color: space.access_type === "OPEN" ? ROXO : "rgba(253,251,247,0.45)",
                          border: `1px solid ${space.access_type === "OPEN" ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.08)"}`,
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
                      // O dropdown nativo é desenhado pelo sistema, não pela
                      // página: sem cor explícita nas opções, o Windows abre
                      // com fundo branco e herda o texto claro do tema escuro,
                      // deixando a lista ilegível.
                      className="text-base md:text-xs border border-white/10 rounded-lg px-2.5 py-1.5 max-w-full md:max-w-[280px]"
                      style={{ background: "#1A1A1A", color: "#FDFBF7" }}
                    >
                      <option value="" style={{ background: "#1A1A1A", color: "#FDFBF7" }}>
                        nenhum curso
                      </option>
                      {cursos.map((c) => (
                        <option
                          key={c.id}
                          value={c.id}
                          style={{ background: "#1A1A1A", color: "#FDFBF7" }}
                        >
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
            <Card className="p-4 sm:p-6 text-center text-sm text-cream/40">
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
                className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-base md:text-xs text-cream placeholder:text-cream/25"
              />
              <select
                value={filtroGrupo}
                onChange={(e) => setFiltroGrupo(e.target.value)}
                className="border border-white/10 rounded-lg px-2.5 py-1.5 text-base md:text-xs"
                style={{ background: "#1A1A1A", color: "#FDFBF7" }}
              >
                <option value="" style={{ background: "#1A1A1A", color: "#FDFBF7" }}>
                  Todos os grupos
                </option>
                {gruposDosEncontros.map((g) => (
                  <option key={g} value={g} style={{ background: "#1A1A1A", color: "#FDFBF7" }}>
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
              {/* A faxina só existe enquanto se olha o lixo. Fora daí, é um
                  botão destrutivo esperando um clique errado. */}
              {verDescartados && escolhidos.length > 0 && (
                <button
                  onClick={apagarEscolhidos}
                  disabled={trabalhando === "escolhidos"}
                  className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40"
                  style={{
                    background: "rgba(245,158,11,0.15)",
                    color: "#F59E0B",
                    border: "1px solid rgba(245,158,11,0.35)",
                  }}
                >
                  {trabalhando === "escolhidos"
                    ? "Apagando"
                    : `Apagar os ${escolhidos.length} marcados`}
                </button>
              )}
              {verDescartados && encontros.length > 0 && (
                <button
                  onClick={limparDescartados}
                  disabled={trabalhando === "limpar"}
                  title="Apaga de vez todos os encontros descartados, com participações e falas."
                  className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40"
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    color: "#F59E0B",
                    border: "1px solid rgba(245,158,11,0.25)",
                  }}
                >
                  {trabalhando === "limpar"
                    ? "Apagando"
                    : `Apagar os ${encontros.length} de vez`}
                </button>
              )}
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

          {falhouEncontros ? (
            <Card className="p-4 sm:p-6 text-center">
              <AlertTriangle className="h-5 w-5 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-cream/60">Não consegui buscar os encontros.</p>
              <p className="text-xs text-cream/40 mt-1">
                Isso não quer dizer que não há nenhum. Recarregue a página.
              </p>
            </Card>
          ) : encontrosFiltrados.length === 0 ? (
            <Card className="p-4 sm:p-6 text-center text-sm text-cream/40">
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
                    {/* A marcação só aparece na lista dos descartados: é lá
                        que se faz faxina, e uma caixa de seleção ao lado de
                        encontro válido convida ao acidente. */}
                    {verDescartados && (
                      <input
                        type="checkbox"
                        checked={escolhidos.includes(e.id)}
                        onChange={() =>
                          setEscolhidos((m) =>
                            m.includes(e.id) ? m.filter((x) => x !== e.id) : [...m, e.id]
                          )
                        }
                        className="mt-1 accent-[#F59E0B]"
                        title="Escolher para apagar"
                      />
                    )}
                    <button
                      onClick={() => setEncontroAberto(aberto ? null : e.id)}
                      className="text-left min-w-[180px] flex-1"
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
                      {/* Quantos desses sabemos quem são. O número separado do
                          total é o que mostra se a conciliação está em dia sem
                          precisar abrir a aba de nomes. */}
                      {presentes.length > 0 && (
                        <span className="text-cream/40">
                          {presentes.filter((p) => p.identificada).length} identificados
                        </span>
                      )}
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
                      {/* Apagar só aparece no que já está descartado: para
                          chegar aqui foi preciso descartar antes e ir procurar
                          na lista dos descartados. Duas decisões, não uma. */}
                      {e.descartado && (
                        <button
                          onClick={() => apagarEncontro(e)}
                          disabled={trabalhando === e.id}
                          title="Apagar de vez, com as participações e as falas. Não tem volta."
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-cream/30 hover:text-amber-400 disabled:opacity-40"
                          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {aberto && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <ListaParticipacoes
                        participacoes={e.participacoes}
                        tolerancia={tolerancia}
                        aoAbrirPessoa={(p) =>
                          setPessoaAberta({
                            norm: p.display_name_norm,
                            aluno_id: p.aluno_id,
                            nome: p.pessoa_nome || p.display_name,
                          })
                        }
                      />
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
            O caminho da gravação: o Meet grava, o arquivo é organizado no Drive, sobe ao YouTube
            como não listado, e é <span className="text-cream/60">esse vídeo do YouTube</span> que
            vira aula do curso. O link do Drive não vai para a plataforma. Antes de publicar, vale
            abrir e conferir o começo da gravação, que costuma pegar a chegada das pessoas.
          </p>
          <p className="text-xs text-cream/30">
            Publicar aqui não manda nada para o OpusClip: nenhum corte é gerado, e nada é cobrado,
            sem você pedir na aba Clipes.
          </p>

          {aulasPublicadas.length > 0 && (
            <Card className="p-4">
              <p className="text-sm text-cream font-semibold mb-2">Publicadas</p>
              <div className="space-y-1.5">
                {aulasPublicadas.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-xs flex-wrap">
                    <span className="text-cream/60">
                      {a.titulo}
                      <span className="text-cream/30"> em </span>
                      {a.curso_titulo}
                      {!a.curso_publicado && (
                        <span
                          className="ml-1.5 text-amber-400/80"
                          title="A aula existe, mas o curso está como rascunho e nenhum aluno o enxerga."
                        >
                          curso não publicado
                        </span>
                      )}
                    </span>
                    {a.curso_slug && (
                      <a
                        href={`/formacao/curso/${a.curso_slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0"
                        style={{ color: ROXO }}
                      >
                        abrir no curso
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Esperar o envio ao YouTube é o estado normal de uma gravação que
              acabou agora, e por isso fica separado do aviso âmbar: alarme para
              o que é rotina ensina a ignorar alarme. A aula do curso é o vídeo
              do YouTube; o Drive é onde o arquivo mora. */}
          {aulasBloqueadas.some((b) => b.esperando_youtube && b.curso_id) && (
            <Card className="p-4 border border-white/10">
              <p className="text-sm text-cream font-semibold">Subindo para o YouTube</p>
              <p className="text-xs text-cream/40 mt-1">
                A gravação vai para o Drive, sobe ao YouTube como não listada, e é o vídeo do
                YouTube que vira aula. O agendador empurra uma gravação por vez, a cada quinze
                minutos; um encontro de duas horas leva algumas rodadas.
              </p>
              <div className="mt-3 space-y-3">
                {aulasBloqueadas
                  .filter((b) => b.esperando_youtube && b.curso_id)
                  .map((b) => (
                    <div key={b.id} className="text-xs">
                      <p className="text-cream/70">
                        {new Date(b.data_reuniao + "T12:00:00").toLocaleDateString("pt-BR")}{" "}
                        {b.titulo}
                      </p>
                      <p
                        className={
                          b.youtube_status === "erro" ? "text-red-400/80" : "text-cream/40"
                        }
                      >
                        {b.motivo}
                      </p>

                      {b.youtube_status === "enviando" && (
                        <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden max-w-[280px]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${b.youtube_pct || 0}%`,
                              background: ROXO,
                            }}
                          />
                        </div>
                      )}

                      {/* A saída para quando o envio quebra ou a pressa é maior
                          que a espera. Fica discreto de propósito: é exceção. */}
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        {!b.curso_id && (
                          <select
                            value={cursoParaBloqueada[b.id] || ""}
                            onChange={(ev) =>
                              setCursoParaBloqueada((m) => ({ ...m, [b.id]: ev.target.value }))
                            }
                            className="text-base md:text-xs border border-white/10 rounded-lg px-2 py-1 min-w-[180px] w-full sm:w-auto"
                            style={{ background: "#1A1A1A", color: "#FDFBF7" }}
                          >
                            <option value="" style={{ background: "#1A1A1A", color: "#FDFBF7" }}>
                              escolha o curso
                            </option>
                            {cursos.map((c) => (
                              <option
                                key={c.id}
                                value={c.id}
                                style={{ background: "#1A1A1A", color: "#FDFBF7" }}
                              >
                                {c.title}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => criarAulaDaGravacao(b, true)}
                          disabled={
                            (!cursoParaBloqueada[b.id] && !b.curso_id) || trabalhando === b.id
                          }
                          title="O aluno assiste pelo Drive até o envio terminar. Quando o YouTube ficar pronto, a aula troca sozinha."
                          className="px-2.5 py-1 rounded-lg text-xs text-cream/50 border border-white/10 disabled:opacity-40"
                        >
                          {trabalhando === b.id ? "Publicando" : "Publicar com o Drive mesmo assim"}
                        </button>
                        <button
                          onClick={() => ignorarGravacao(b)}
                          disabled={trabalhando === b.id}
                          title="Tira da fila de aulas. O encontro continua contando para presença e quórum."
                          className="px-2.5 py-1 rounded-lg text-xs text-cream/40 border border-white/10 disabled:opacity-40"
                        >
                          Nunca virar aula
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* Gravação que existe mas não chegou na fila. Sem isto, o vazio da
              tela é indistinguível de "não houve encontro", e foi exatamente
              nisso que o Gabriel se perdeu. */}
          {aulasBloqueadas.some((b) => !(b.esperando_youtube && b.curso_id)) && (
            <Card className="p-4 border border-amber-400/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-cream font-semibold">
                    {aulasBloqueadas.filter((b) => !(b.esperando_youtube && b.curso_id)).length}{" "}
                    gravação
                    {aulasBloqueadas.filter((b) => !(b.esperando_youtube && b.curso_id)).length > 1
                      ? "ões"
                      : ""}{" "}
                    sem virar aula
                  </p>
                  {/* Um aviso sem saída ensina a ignorar avisos. O motivo mais
                      comum é o grupo não ter curso vinculado, e escolher o
                      curso aqui resolve sem obrigar a ir configurar a sala. */}
                  <div className="mt-2 space-y-3">
                    {aulasBloqueadas
                      .filter((b) => !(b.esperando_youtube && b.curso_id))
                      .map((b) => (
                      <div key={b.id} className="text-xs">
                        <p className="text-cream/50">
                          <span className="text-cream/70">
                            {new Date(b.data_reuniao + "T12:00:00").toLocaleDateString("pt-BR")}{" "}
                            {b.titulo}
                          </span>
                          {": "}
                          {b.motivo}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap mt-1.5">
                          <select
                            value={cursoParaBloqueada[b.id] || ""}
                            onChange={(ev) =>
                              setCursoParaBloqueada((m) => ({ ...m, [b.id]: ev.target.value }))
                            }
                            className="text-base md:text-xs border border-white/10 rounded-lg px-2 py-1 min-w-[180px] w-full sm:w-auto"
                            style={{ background: "#1A1A1A", color: "#FDFBF7" }}
                          >
                            <option value="" style={{ background: "#1A1A1A", color: "#FDFBF7" }}>
                              escolha o curso
                            </option>
                            {cursos.map((c) => (
                              <option
                                key={c.id}
                                value={c.id}
                                style={{ background: "#1A1A1A", color: "#FDFBF7" }}
                              >
                                {c.title}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => criarAulaDaGravacao(b)}
                            disabled={!cursoParaBloqueada[b.id] || trabalhando === b.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
                            style={{ background: "rgba(74,222,128,0.12)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
                          >
                            {trabalhando === b.id ? "Criando" : "Virar aula"}
                          </button>
                          {/* Sem curso E sem vídeo no YouTube: "Virar aula"
                              recusa, com razão. Sem esta saída, o aviso seria
                              um beco. */}
                          {b.esperando_youtube && (
                            <button
                              onClick={() => criarAulaDaGravacao(b, true)}
                              disabled={!cursoParaBloqueada[b.id] || trabalhando === b.id}
                              title="O aluno assiste pelo Drive até o envio terminar. Quando o YouTube ficar pronto, a aula troca sozinha."
                              className="px-2.5 py-1 rounded-lg text-xs text-cream/50 border border-white/10 disabled:opacity-40"
                            >
                              Publicar com o Drive mesmo assim
                            </button>
                          )}
                          <button
                            onClick={() => ignorarGravacao(b)}
                            disabled={trabalhando === b.id}
                            title="Tira da fila de aulas. O encontro continua contando para presença e quórum."
                            className="px-2.5 py-1 rounded-lg text-xs text-cream/40 border border-white/10 disabled:opacity-40"
                          >
                            Nunca virar aula
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {aulas.length === 0 ? (
            <Card className="p-4 sm:p-6 text-center text-sm text-cream/40">
              Nada esperando aprovação. As gravações aparecem aqui quando o grupo tem um curso
              escolhido na aba Salas.
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
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-base md:text-sm text-cream"
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

      {aba === "clipes" && (
        <div className="space-y-3">
          {!clipesConfigurado ? (
            <Card className="p-4 border border-amber-400/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-cream/70">
                  A chave do OpusClip não está configurada no servidor.
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Escrito na tela porque a dúvida apareceu de verdade: uma
                  gravação nova não subiu para corte e pareceu falha, quando na
                  verdade é a regra. Nada entra na fila de cortes sozinho. */}
              <Card className="p-4 border border-white/10">
                <p className="text-sm text-cream font-semibold">Corte é sempre por decisão sua</p>
                <p className="text-xs text-cream/40 mt-1">
                  Nenhum encontro gravado vai para o OpusClip automaticamente. Gravar, subir ao
                  YouTube e virar aula acontecem sozinhos; cortar, não. Um vídeo só é enviado
                  quando você marca e clica aqui nesta aba, e é aqui que a conta começa a correr.
                </p>
              </Card>

              <Card className="p-4">
                <p className="text-sm text-cream font-semibold mb-1">
                  Escolher vídeos para cortar
                </p>
                {/* O custo é por minuto do vídeo original, e é a informação que
                    decide se vale a pena. Fica escrita aqui, não escondida. */}
                <p className="text-xs text-cream/40 mb-3">
                  Escolha o curso e marque os vídeos, um a um. A cobrança é por minuto de vídeo
                  original, não por clipe gerado. O envio acontece um por vez, a cada rodada.
                </p>

                <select
                  value={cursoParaClipes}
                  onChange={(e) => {
                    setCursoParaClipes(e.target.value);
                    carregarAulasDoCurso(e.target.value);
                  }}
                  className="w-full border border-white/10 rounded-lg px-2.5 py-1.5 text-base md:text-xs"
                  style={{ background: "#1A1A1A", color: "#FDFBF7" }}
                >
                  <option value="" style={{ background: "#1A1A1A", color: "#FDFBF7" }}>
                    escolha o curso
                  </option>
                  {cursos.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                      style={{ background: "#1A1A1A", color: "#FDFBF7" }}
                    >
                      {c.title}
                    </option>
                  ))}
                </select>

                {buscandoAulas && (
                  <p className="text-xs text-cream/40 mt-3">Procurando os vídeos…</p>
                )}

                {!buscandoAulas && cursoParaClipes && aulasParaClipe.length === 0 && (
                  <p className="text-xs text-cream/40 mt-3">
                    Nenhuma aula deste curso tem vídeo.
                  </p>
                )}

                {aulasParaClipe.length > 0 && (
                  <>
                    <div className="mt-3 space-y-1 max-h-[320px] overflow-y-auto pr-1">
                      {aulasParaClipe.map((a) => {
                        const marcada = marcadas.includes(a.id);
                        return (
                          <label
                            key={a.id}
                            className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-xs ${
                              a.ja_enviada ? "opacity-45" : "cursor-pointer hover:bg-white/[0.03]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={marcada}
                              disabled={a.ja_enviada}
                              onChange={() =>
                                setMarcadas((m) =>
                                  m.includes(a.id) ? m.filter((x) => x !== a.id) : [...m, a.id]
                                )
                              }
                              className="mt-0.5 accent-[#6C5CE7]"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="text-cream/80">{a.titulo}</span>
                              <span className="text-cream/30">
                                {a.duracao_min ? ` · ${a.duracao_min} min` : ""}
                                {a.secao ? ` · ${a.secao}` : ""}
                              </span>
                              {a.ja_enviada && (
                                <span className="block text-cream/40 mt-0.5">
                                  já enviado
                                  {a.status ? ` · ${a.status}` : ""}
                                </span>
                              )}
                              {!a.ja_enviada && a.passa_pelo_youtube && (
                                <span className="block text-cream/30 mt-0.5">
                                  vai ao YouTube como não listado antes de cortar
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-white/5">
                      <button
                        onClick={() => {
                          const livres = aulasParaClipe.filter((a) => !a.ja_enviada).map((a) => a.id);
                          setMarcadas(marcadas.length === livres.length ? [] : livres);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs text-cream/50 border border-white/10"
                      >
                        {marcadas.length === aulasParaClipe.filter((a) => !a.ja_enviada).length &&
                        marcadas.length > 0
                          ? "desmarcar todos"
                          : "marcar todos"}
                      </button>
                      <button
                        onClick={enviarMarcadasParaClipes}
                        disabled={!marcadas.length || trabalhando === "clipes"}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                        style={{
                          background: "rgba(108,92,231,0.12)",
                          color: ROXO,
                          border: "1px solid rgba(108,92,231,0.3)",
                        }}
                      >
                        {trabalhando === "clipes"
                          ? "Enviando"
                          : marcadas.length
                            ? `Gerar clipes de ${marcadas.length}`
                            : "Gerar clipes"}
                      </button>
                      {marcadas.length > 0 && (
                        <span className="text-xs text-cream/40">
                          {aulasParaClipe
                            .filter((a) => marcadas.includes(a.id))
                            .reduce((s, a) => s + (a.duracao_min || 0), 0) || "?"}{" "}
                          minutos de vídeo
                        </span>
                      )}
                    </div>
                  </>
                )}
              </Card>

              {clipJobs.length === 0 ? (
                <Card className="p-4 sm:p-6 text-center text-sm text-cream/40">
                  Nenhum vídeo enviado para corte ainda.
                </Card>
              ) : (
                clipJobs.map((j) => (
                  <Card key={j.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-[200px] flex-1">
                        <p className="text-sm text-cream">{j.titulo}</p>
                        <p className="text-xs text-cream/40 mt-0.5">
                          {/* Depois de enviado, o YouTube ainda processa o
                              arquivo, e nessa janela o corte não pode começar.
                              Dizer "na fila" aqui pareceria travado. */}
                          {j.status === "pendente" &&
                            (j.youtube_video_id
                              ? "o YouTube está processando o vídeo · o corte começa sozinho quando terminar"
                              : "na fila")}
                          {j.status === "subindo" && "subindo para o YouTube"}
                          {j.status === "processando" && "cortando"}
                          {j.status === "pronto" && `${j.clipes.length} clipes`}
                          {j.status === "erro" && (
                            <span className="text-amber-400/80">
                              {j.erro || j.youtube_erro || "falhou"}
                            </span>
                          )}
                        </p>

                        {/* Envio de centenas de megabytes leva várias rodadas.
                            Sem a barra, o estado "subindo" parece travado. */}
                        {j.status === "subindo" && !!j.youtube_bytes_total && (
                          <div className="mt-2">
                            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.round(((j.youtube_bytes_enviados || 0) / j.youtube_bytes_total) * 100)}%`,
                                  background: ROXO,
                                }}
                              />
                            </div>
                            <p className="text-xs text-cream/30 mt-1">
                              {Math.round(((j.youtube_bytes_enviados || 0) / j.youtube_bytes_total) * 100)}
                              % de {Math.round(j.youtube_bytes_total / 1_048_576)} MB
                            </p>
                          </div>
                        )}
                      </div>

                      {j.youtube_video_id && (
                        <a
                          href={`https://www.youtube.com/watch?v=${j.youtube_video_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-cream/40 underline decoration-white/20 shrink-0"
                        >
                          ver no YouTube
                        </a>
                      )}
                    </div>

                    {/* Quarenta clipes numa lista viram parede de texto. Ficam
                        fechados, e abertos viram grade de miniaturas: o que
                        decide se um corte presta é vê-lo, não ler sobre ele. */}
                    {j.clipes.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setJobAberto(jobAberto === j.id ? null : j.id)}
                            className="flex items-center gap-1.5 text-xs text-cream/60 hover:text-cream"
                          >
                            {jobAberto === j.id ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            {jobAberto === j.id ? "esconder" : "ver os clipes"}
                          </button>

                          {(() => {
                            const bons = j.clipes.filter((c) => c.avaliacao === "gostei").length;
                            const ruins = j.clipes.filter(
                              (c) => c.avaliacao === "rejeitado"
                            ).length;
                            const novos = j.clipes.filter(
                              (c) => !c.avaliacao && !c.oculto
                            ).length;
                            return (
                              <>
                                <span className="text-[11px] text-cream/30">
                                  {bons > 0 && `${bons} aprovado${bons > 1 ? "s" : ""}`}
                                  {bons > 0 && novos > 0 && " · "}
                                  {novos > 0 && `${novos} por ver`}
                                </span>
                                {/* A faxina fecha o ciclo da curadoria: alguém
                                    marcou o que não presta, e isto varre. */}
                                {ruins > 0 && (
                                  <button
                                    onClick={() => apagarReprovados(j.id)}
                                    disabled={trabalhando === j.id + "limpar"}
                                    className="text-[11px] text-cream/30 hover:text-amber-400 ml-auto disabled:opacity-40"
                                  >
                                    {trabalhando === j.id + "limpar"
                                      ? "apagando"
                                      : `apagar os ${ruins} reprovados`}
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {jobAberto === j.id && (
                          <>
                            <div className="flex items-center gap-1.5 mt-3 mb-2 flex-wrap">
                              {(
                                [
                                  ["novos", "Por ver"],
                                  ["gostei", "Aprovados"],
                                  ["todos", "Todos"],
                                ] as const
                              ).map(([k, rotulo]) => (
                                <button
                                  key={k}
                                  onClick={() => setFiltroClipes(k)}
                                  className="px-2 py-0.5 rounded-lg text-[11px]"
                                  style={{
                                    background:
                                      filtroClipes === k
                                        ? "rgba(108,92,231,0.12)"
                                        : "transparent",
                                    color: filtroClipes === k ? ROXO : "rgba(253,251,247,0.35)",
                                    border: `1px solid ${filtroClipes === k ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
                                  }}
                                >
                                  {rotulo}
                                </button>
                              ))}
                            </div>

                            {/* O que olhar antes de aprovar. Quem avalia
                                quarenta cortes cansa e passa a julgar pela
                                miniatura, e é aí que entra um corte que soa
                                bem e diz o contrário do que foi dito. */}
                            <p className="text-[11px] text-cream/35 mb-2 leading-relaxed">
                              Ouça antes de aprovar: o que decide é o que está sendo dito, não a
                              imagem. Repare se o corte não começa no meio de uma ressalva nem
                              termina antes dela. O mesmo corte serve em pé e deitado, então o
                              formato não é motivo para reprovar.
                            </p>

                            {/* Seis colunas nas telas largas, e não quatro: o
                                corte é vertical, então cada coluna a menos
                                estica o card para mais de seiscentos pixels de
                                altura e a grade vira uma coluna de painéis
                                gigantes que não deixa comparar nada. */}
                            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                              {j.clipes
                                .filter((c) => {
                                  if (filtroClipes === "todos") return true;
                                  if (filtroClipes === "gostei") return c.avaliacao === "gostei";
                                  return !c.avaliacao && !c.oculto;
                                })
                                .map((c) => (
                                  <ClipeCard
                                    key={c.id}
                                    clipe={c}
                                    aoAssistir={() => setAssistindo(c)}
                                    aoAvaliar={(v) => avaliarClipe(c, v)}
                                    aoOcultar={() => ocultarClipe(c)}
                                    ocupado={trabalhando === c.id}
                                  />
                                ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </>
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
          <p className="text-xs text-cream/40">
            A cada rodada da captura, quem sobra aqui é comparado com as pessoas que preencheram o
            formulário de certificado daquele mesmo encontro. É de lá que sai a identificação de
            quem participa dos grupos sem ter conta na plataforma, que é a maioria. As sugestões
            marcadas em roxo vêm desse cruzamento.
          </p>

          {vinculos.length > 0 && (
            <Card className="p-4">
              <p className="text-sm text-cream font-semibold mb-2">Vínculos já feitos</p>
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                {vinculos.map((v) => (
                  <div
                    key={v.display_name_norm}
                    className="flex items-start justify-between gap-2 text-xs"
                  >
                    <span className="text-cream/60 min-w-0">
                      {v.display_name}
                      <span className="text-cream/30"> vira </span>
                      {v.ignorado ? (
                        <span className="text-amber-400/70">não é aluno</span>
                      ) : (
                        <span className="text-cream">
                          {v.aluno_nome || v.pessoa_nome || "pessoa sem nome"}
                        </span>
                      )}
                      {!v.ignorado && !v.tem_conta && (
                        <span className="text-cream/30"> · sem conta</span>
                      )}
                      {v.origem === "certificado" && (
                        <span style={{ color: ROXO }}> · pelo certificado</span>
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

          {falhouFila ? (
            <Card className="p-4 sm:p-6 text-center">
              <AlertTriangle className="h-5 w-5 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-cream/60">Não consegui buscar os nomes pendentes.</p>
              <p className="text-xs text-cream/40 mt-1">
                Pode haver nomes esperando. Recarregue a página.
              </p>
            </Card>
          ) : fila.length === 0 ? (
            <Card className="p-4 sm:p-6 text-center">
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
                    {item.sugestoes.length === 0 && item.do_certificado.length === 0 && (
                      <span className="text-xs text-cream/30">
                        Nem no cadastro nem no formulário de certificado
                      </span>
                    )}

                    {/* Do cadastro: quem tem conta e entrou com o nome dela */}
                    {item.sugestoes.map((s) => (
                      <button
                        key={s.aluno_id}
                        onClick={() => conciliar(item, s.aluno_id)}
                        disabled={trabalhando === item.display_name_norm}
                        className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          color: "rgba(253,251,247,0.7)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {s.full_name}{" "}
                        <span className="opacity-40">{Math.round(s.score * 100)}%</span>
                      </button>
                    ))}

                    {/* Do certificado: quem esteve no mesmo encontro e se
                        identificou por conta própria. Fica em roxo porque é a
                        sugestão de dentro do encontro, e não de dentro do
                        cadastro inteiro: erra muito menos. */}
                    {item.do_certificado.map((c) => (
                      <button
                        key={c.email || c.nome}
                        onClick={() => conciliarPeloCertificado(item, c)}
                        disabled={trabalhando === item.display_name_norm}
                        title={
                          c.aluno_id
                            ? "Preencheu o certificado deste encontro e tem conta na plataforma."
                            : "Preencheu o certificado deste encontro. Ainda não tem conta na plataforma."
                        }
                        className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40"
                        style={{
                          background: "rgba(108,92,231,0.12)",
                          color: ROXO,
                          border: "1px solid rgba(108,92,231,0.3)",
                        }}
                      >
                        {c.nome}{" "}
                        <span className="opacity-50">
                          {Math.round(c.score * 100)}%{c.aluno_id ? " · tem conta" : ""}
                        </span>
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
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-base md:text-xs text-cream"
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
                className="flex-1 min-w-[240px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-base md:text-xs text-cream placeholder:text-cream/25"
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
                className="w-24 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-base md:text-xs text-cream"
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

            {/* Esta verificação já existia no servidor e nenhum botão a
                chamava. Ela distingue as três causas de o Drive recusar —
                permissão não concedida, app barrado pela organização, pasta
                inexistente — que de fora parecem o mesmo erro. */}
            <div className="pt-2 mt-1 border-t border-white/5">
              <button
                onClick={verificarDrive}
                disabled={trabalhando === "drive"}
                className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(253,251,247,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {trabalhando === "drive" ? "Verificando" : "Verificar acesso ao Drive"}
              </button>
              {diagDrive && (
                <p className="text-xs text-cream/50 mt-2 whitespace-pre-wrap">{diagDrive}</p>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-cream font-semibold mb-2">Última busca</p>
            {status?.ultima_ingestao ? (
              <div className="text-xs text-cream/50 space-y-1">
                {/* A data sozinha não responde a pergunta que se faz olhando
                    para este cartão, que é "isso ainda está rodando?". Ninguém
                    calcula de cabeça quantas horas faz, e era exatamente assim
                    que uma captura parada passava despercebida por dias. */}
                <IdadeDaCaptura
                  executadoEm={status.ultima_ingestao.executado_em}
                  captura={status.captura}
                />
                <p>
                  {status.ultima_ingestao.encontros_novos} novos ·{" "}
                  {status.ultima_ingestao.encontros_atualizados} atualizados ·{" "}
                  {status.ultima_ingestao.participacoes_gravadas} participações
                </p>
                {status.ultima_ingestao.erro && (
                  <p className="text-amber-400/80 mt-2">{status.ultima_ingestao.erro}</p>
                )}
                {/* A consequência, e não só o sintoma: enquanto a captura não
                    está saudável o sistema se recusa a marcar qualquer slot
                    como não conduzido, e o calendário fica parado sem avisar. */}
                {status.captura && !status.captura.saudavel && status.captura.motivo && (
                  <p className="text-amber-400/80 mt-2">
                    Marcação automática de status suspensa: {status.captura.motivo}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-cream/40">Ainda não rodou.</p>
            )}
          </Card>
        </div>
      )}

      {/* Assistir sem sair da tela.
          Abrir numa aba nova perderia a posição na grade, e avaliar quarenta
          clipes é justamente ir e voltar quarenta vezes. */}
      {assistindo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setAssistindo(null)}
        >
          <div
            className="rounded-2xl overflow-y-auto overflow-x-hidden max-h-[90vh] max-w-[min(420px,90vw)] w-full"
            style={{ background: "#111" }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <video
              src={assistindo.preview_url || assistindo.url || undefined}
              poster={assistindo.thumbnail_url || undefined}
              controls
              autoPlay
              className="w-full"
              style={{ aspectRatio: "9/16", background: "#000" }}
            />
            <div className="p-3">
              <p className="text-sm text-cream">{assistindo.titulo}</p>
              {assistindo.descricao && (
                <p className="text-xs text-cream/45 mt-1">{assistindo.descricao}</p>
              )}
              {assistindo.hashtags?.length ? (
                <p className="text-xs text-cream/30 mt-1">{assistindo.hashtags.join(" ")}</p>
              ) : null}

              {/* "Não presta" sem motivo não ensina nada a quem faz a
                  curadoria depois. Aqui é onde vira critério. */}
              <textarea
                value={anotacao}
                onChange={(ev) => setAnotacao(ev.target.value)}
                onBlur={() => salvarAnotacao(assistindo)}
                placeholder="Por que presta, ou por que não. Ex: cortou no meio da ressalva."
                rows={2}
                className="w-full mt-3 px-2.5 py-2 rounded-lg text-base md:text-xs resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#FDFBF7" }}
              />

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => {
                    salvarAnotacao(assistindo);
                    avaliarClipe(assistindo, "gostei");
                    setAssistindo(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(74,222,128,0.12)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
                >
                  <ThumbsUp className="h-3.5 w-3.5" /> Gostei
                </button>
                <button
                  onClick={() => {
                    salvarAnotacao(assistindo);
                    avaliarClipe(assistindo, "rejeitado");
                    setAssistindo(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(253,251,247,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <ThumbsDown className="h-3.5 w-3.5" /> Não presta
                </button>
                <a
                  href={`/formacao/api/admin/meet/clipes/baixar?clip_id=${assistindo.id}`}
                  title="Baixar o arquivo"
                  className="p-2.5 md:p-1.5 rounded-lg text-cream/40"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => {
                    salvarAnotacao(assistindo);
                    setAssistindo(null);
                  }}
                  className="ml-auto p-2.5 md:p-1.5 rounded-lg text-cream/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A pessoa por trás do nome de tela, aberta de qualquer lista */}
      <FichaPessoa
        aberta={!!pessoaAberta}
        aoFechar={() => setPessoaAberta(null)}
        endpoint="/formacao/api/admin/meet/pessoa"
        norm={pessoaAberta?.norm}
        alunoId={pessoaAberta?.aluno_id}
        nomeProvisorio={pessoaAberta?.nome}
      />
    </div>
  );
}

/**
 * Um corte, do tamanho de uma miniatura.
 *
 * A miniatura é o card inteiro e é ela que abre o vídeo: numa grade de
 * quarenta, a imagem é o que diferencia um do outro, então ela precisa ser o
 * alvo do clique, não um enfeite ao lado de um link.
 */
function ClipeCard({
  clipe: c,
  aoAssistir,
  aoAvaliar,
  aoOcultar,
  ocupado,
}: {
  clipe: Clipe;
  aoAssistir: () => void;
  aoAvaliar: (v: "gostei" | "rejeitado") => void;
  aoOcultar: () => void;
  ocupado: boolean;
}) {
  const aprovado = c.avaliacao === "gostei";
  const rejeitado = c.avaliacao === "rejeitado";

  // Miniatura que não carrega desenha nada, e "nada" é indistinguível de um
  // corte que é mesmo escuro. Sem este estado, a tela inteira de endereços
  // vencidos parecia um problema de conteúdo, não de acesso.
  const [imagemFalhou, setImagemFalhou] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${aprovado ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.06)"}`,
        opacity: rejeitado ? 0.45 : 1,
      }}
    >
      <button
        onClick={aoAssistir}
        className="relative block w-full group"
        style={{ aspectRatio: "9/16", background: "rgba(0,0,0,0.3)" }}
        title="Assistir"
      >
        {c.thumbnail_url && !imagemFalhou ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImagemFalhou(true)}
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
            <ImageOff className="h-4 w-4 text-cream/20" />
            <span className="text-[10px] text-cream/25 leading-tight">
              {imagemFalhou ? "prévia expirada, recarregue a página" : "sem prévia"}
            </span>
          </span>
        )}
        <span
          className="absolute inset-0 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <Play className="h-8 w-8 text-white" fill="white" />
        </span>
        <span
          className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] text-white"
          style={{ background: "rgba(0,0,0,0.65)" }}
        >
          {c.duracao_seg ? `${Math.round(c.duracao_seg)}s` : ""}
        </span>
        {c.pontuacao != null && (
          <span
            className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px]"
            style={{ background: "rgba(0,0,0,0.65)", color: "#FDFBF7" }}
          >
            {Math.round(c.pontuacao)}
          </span>
        )}
      </button>

      <div className="p-2 flex-1 flex flex-col gap-1.5">
        <p className="text-[11px] text-cream/80 leading-snug line-clamp-2">
          {c.titulo || "clipe"}
        </p>

        {/* flex-wrap é rede de segurança: o card tem overflow-hidden (por
            causa dos cantos redondos da miniatura), e sem wrap um botão a mais
            some cortado em vez de ir para a linha de baixo */}
        <div className="flex items-center flex-wrap gap-1.5 md:gap-1 mt-auto pt-1">
          <button
            onClick={() => aoAvaliar("gostei")}
            disabled={ocupado}
            title="Gostei"
            className="p-2 md:p-1.5 rounded-lg"
            style={{
              background: aprovado ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.03)",
              color: aprovado ? "#4ADE80" : "rgba(253,251,247,0.3)",
            }}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => aoAvaliar("rejeitado")}
            disabled={ocupado}
            title="Não presta"
            className="p-2 md:p-1.5 rounded-lg"
            style={{
              background: rejeitado ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.03)",
              color: rejeitado ? "#F59E0B" : "rgba(253,251,247,0.3)",
            }}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              const legenda = [c.titulo, c.descricao, c.hashtags?.join(" ")]
                .filter(Boolean)
                .join("\n\n");
              navigator.clipboard.writeText(legenda);
              toast.success("Legenda copiada.");
            }}
            title="Copiar título, descrição e hashtags"
            className="p-2 md:p-1.5 rounded-lg text-cream/30"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <a
            href={`/formacao/api/admin/meet/clipes/baixar?clip_id=${c.id}`}
            title="Baixar o arquivo"
            className="p-2 md:p-1.5 rounded-lg text-cream/30 inline-flex"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={aoOcultar}
            title="Esconder da lista"
            className="p-2 md:p-1.5 rounded-lg text-cream/30 ml-auto"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Há quanto tempo a captura rodou pela última vez, em palavras.
 *
 * Arredonda de propósito. Precisão de minuto não muda nenhuma decisão de quem
 * olha esta tela; o que muda é a ordem de grandeza.
 */
function tempoDecorrido(horas: number): string {
  if (horas < 1) {
    const min = Math.max(1, Math.round(horas * 60));
    return `há ${min} ${min === 1 ? "minuto" : "minutos"}`;
  }
  if (horas < 48) {
    const h = Math.round(horas);
    return `há ${h} ${h === 1 ? "hora" : "horas"}`;
  }
  return `há ${Math.round(horas / 24)} dias`;
}

/**
 * Data da última busca com a idade dela ao lado, em cor.
 *
 * Os cortes seguem a batida do agendador, que é de hora em hora: até duas horas
 * é o funcionamento normal com folga para um atraso de fila; até seis é
 * estranho mas ainda pode ser uma sequência ruim de sorte; acima disso alguma
 * coisa parou, e o caso mais comum não é erro nenhum no código, e sim o GitHub
 * ter desativado o agendamento por falta de push no repositório.
 */
function IdadeDaCaptura({
  executadoEm,
  captura,
}: {
  executadoEm: string;
  captura: Status["captura"];
}) {
  // A conta do servidor vale mais que a do browser, cujo relógio pode estar
  // errado. Sem ela, sobra calcular pela data, que é melhor que não mostrar.
  const horas =
    captura?.horas_desde_ultima_ingestao ??
    (Date.now() - new Date(executadoEm).getTime()) / 3_600_000;

  const nivel = horas <= 2 ? "ok" : horas <= 6 ? "atencao" : "parada";
  const cor =
    nivel === "ok"
      ? { fg: "#4ADE80", bg: "rgba(74,222,128,0.12)", borda: "rgba(74,222,128,0.3)" }
      : nivel === "atencao"
        ? { fg: "#F59E0B", bg: "rgba(245,158,11,0.12)", borda: "rgba(245,158,11,0.3)" }
        : { fg: "#FF4D4D", bg: "rgba(255,0,0,0.10)", borda: "rgba(255,0,0,0.3)" };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span>{new Date(executadoEm).toLocaleString("pt-BR")}</span>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold"
          style={{ background: cor.bg, color: cor.fg, border: `1px solid ${cor.borda}` }}
        >
          {nivel === "ok" ? (
            <CheckCircle2 className="h-3 w-3 shrink-0" />
          ) : (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          )}
          {tempoDecorrido(horas)}
        </span>
      </div>

      {nivel === "parada" && (
        <p className="mt-2 leading-relaxed" style={{ color: cor.fg }}>
          A busca deveria rodar de hora em hora, então a captura pode ter parado.
          Vale conferir se o agendamento ainda está disparando: o GitHub desativa
          sozinho o agendamento de repositório que fica sessenta dias sem push, e
          quando isso acontece nada aqui dá erro, só para de acontecer.
        </p>
      )}
    </>
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
          className="w-20 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-base md:text-xs text-cream"
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
          className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-base md:text-xs text-cream"
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
