// Pessoas: quem volta, quem sumiu e com quem vale conversar.
//
// Esta tela existe porque a mesma pessoa vivia em quatro lugares que não se
// conheciam (formulário de certificado, sala do Meet, plataforma e agora o
// processo seletivo), e por isso o painel só sabia responder "quantos
// formulários chegaram". Aqui a unidade é a pessoa, e presença vale tanto
// declarada no formulário quanto medida na sala.
//
// Três regras de desenho que não são estéticas, são de honestidade, e que
// valem para qualquer coisa acrescentada aqui depois:
//
//   1. Percentual só com denominador de 30 para cima. Abaixo disso a tela
//      escreve a fração. Uma pessoa a mais no núcleo de 20 move 5 pontos, e
//      uma seta de variação sobre isso é teatro.
//   2. Quando o percentual aparece, a fração aparece junto e maior.
//   3. Abaixo de 25 pessoas, nome no lugar de número. Nenhum bloco agrega
//      pouca gente num número sem dar a lista a um clique.
//
// A série do núcleo é impressa como sete números, não como curva: com sete
// pontos, uma linha suave desenha inflexões que os dados não têm.
//
// Sobre o seletor de janela: ele governa o que é fluxo (quem apareceu, quem foi
// avaliado) e não governa o que é definição. Núcleo, sumiço e coorte trazem o
// selo da própria janela ao lado do título, porque um número que ignora o
// filtro sem avisar é pior que um número errado.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Users,
  UserMinus,
  Repeat,
  Search,
  Download,
  ChevronDown,
  Mic,
  Shield,
  AlertTriangle,
  Upload,
  GraduationCap,
  Activity,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import HintButton from "@/components/admin/dashboard/HintButton";
import PessoaModal, { type PessoaRef } from "@/components/admin/dashboard/PessoaModal";
import { SeletorJanela, JanelaPropria } from "@/components/admin/SeletorJanela";
import { RANGE_LABELS, type ActivityRange } from "@/lib/utils/activity";
import type { PessoaLinha, RetratoPessoas } from "@/lib/pessoas/agregar";

const TERRACOTA = "#C84B31";
const TEAL = "#2E9E8F";
const DOURADO = "#D4854A";
const ROXO = "#6C5CE7";

interface ResumoImport {
  linhas: number;
  casamPorEmail: number;
  casamPorTelefone: number;
  pessoasNovas: number;
  jaImportados: number;
  semEmail: number;
  semTelefone: number;
  pessoasCriadas?: number;
  tentativasNovas?: number;
  tentativasRepetidas?: number;
}

type Recorte =
  | "todas"
  | "nucleo"
  | "so-grupo"
  | "so-plataforma"
  | "nos-dois"
  | "uma-vez"
  | "relato"
  | "mudos"
  | "seletivo"
  | "aprovado-ausente";

const PAGINA = 25;

export default function AdminPessoasPage() {
  const { isAdmin } = useAuth();
  const [retrato, setRetrato] = useState<RetratoPessoas | null>(null);
  const [loading, setLoading] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [janela, setJanela] = useState<ActivityRange>("all");
  const [busca, setBusca] = useState("");
  const [recorte, setRecorte] = useState<Recorte>("todas");
  const [ordem, setOrdem] = useState<keyof PessoaLinha>("presencas");
  const [mostrando, setMostrando] = useState(PAGINA);
  const [pessoaAberta, setPessoaAberta] = useState<PessoaRef | null>(null);
  const [verTodosCondutores, setVerTodosCondutores] = useState(false);
  const [verTodosSumidos, setVerTodosSumidos] = useState(false);
  const [verTodosAprovados, setVerTodosAprovados] = useState(false);
  const [glossarioAberto, setGlossarioAberto] = useState(false);
  // Importação do processo seletivo
  const [csv, setCsv] = useState<{ nome: string; conteudo: string } | null>(null);
  const [previa, setPrevia] = useState<ResumoImport | null>(null);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // O recorte roda no servidor, e não no navegador, porque quem decide quem
  // entra na janela precisa das datas de todas as fontes, inclusive as que a
  // tela nunca recebe (sessão de uso, conclusão de aula).
  const carregar = useCallback(async (j: ActivityRange) => {
    try {
      const r = await fetch(`/formacao/api/admin/pessoas?janela=${j}`);
      const tipo = r.headers.get("content-type") || "";
      if (!tipo.includes("application/json")) {
        throw new Error(
          "O servidor respondeu uma página em vez de dados. Abra o painel por allos.org.br/formacao/admin/pessoas.",
        );
      }
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.error || "Não foi possível carregar.");
      setRetrato(dados as RetratoPessoas);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
      setRecarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar(janela);
  }, [carregar, janela]);

  const trocarJanela = (j: ActivityRange) => {
    if (j === janela) return;
    setRecarregando(true);
    setJanela(j);
  };

  // ── Recorte e busca ────────────────────────────────────────
  const filtradas = useMemo(() => {
    if (!retrato) return [];
    const q = busca.trim().toLowerCase();
    let base = retrato.pessoas;
    if (recorte === "nucleo") base = base.filter((p) => p.presencas90 >= 5);
    else if (recorte === "so-grupo") base = base.filter((p) => p.presencas > 0 && !p.temConta);
    else if (recorte === "so-plataforma") base = base.filter((p) => p.presencas === 0 && p.temConta);
    else if (recorte === "nos-dois") base = base.filter((p) => p.presencas > 0 && p.temConta);
    else if (recorte === "uma-vez") base = base.filter((p) => p.presencas === 1);
    else if (recorte === "relato") base = base.filter((p) => p.relatosLongos > 0);
    else if (recorte === "mudos")
      base = base.filter((p) => p.encontrosMeet > 0 && p.turnosFala === 0);
    else if (recorte === "seletivo") base = base.filter((p) => p.seletivo != null);
    else if (recorte === "aprovado-ausente")
      base = base.filter((p) => p.seletivo?.aprovado && p.presencas === 0);
    if (q) {
      base = base.filter(
        (p) =>
          p.nome.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q),
      );
    }
    return [...base].sort((a, b) => {
      const va = a[ordem];
      const vb = b[ordem];
      if (typeof va === "number" && typeof vb === "number") return vb - va;
      return String(vb ?? "").localeCompare(String(va ?? ""));
    });
  }, [retrato, busca, recorte, ordem]);

  useEffect(() => setMostrando(PAGINA), [recorte, busca, ordem, janela]);

  const baixarCSV = () => {
    if (!retrato) return;
    const cab = [
      "Nome", "E-mail", "Tem conta", "Presencas", "Presencas 90d", "Presencas na janela",
      "Atividades", "Relatos longos", "Aulas", "Horas plataforma", "Encontros Meet",
      "Minutos na sala", "Turnos de fala", "Dias sem aparecer", "Estreia",
      "Seletivo status", "Seletivo nota",
    ];
    const linhas = filtradas.map((p) => [
      p.nome, p.email ?? "", p.temConta ? "sim" : "nao", p.presencas, p.presencas90,
      p.presencasJanela, p.atividades, p.relatosLongos, p.aulas, p.horasPlataforma,
      p.encontrosMeet, p.minutosMeet, p.turnosFala, p.diasSemAparecer ?? "",
      (p.estreia ?? "").slice(0, 10), p.seletivo?.status ?? "", p.seletivo?.nota ?? "",
    ]);
    const texto =
      "﻿" +
      [cab, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pessoas_${recorte}_${janela}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Baixado com o recorte, a janela e a ordem que estão na tela.");
  };

  // ── Importação do seletivo ─────────────────────────────────
  // A prévia e a gravação chamam a mesma rota e o mesmo cálculo. Se fossem
  // dois caminhos, a prévia prometeria um número e a gravação faria outro.
  const enviarSeletivo = useCallback(
    async (conteudo: string, nome: string, gravar: boolean) => {
      setImportando(true);
      try {
        const r = await fetch("/formacao/api/admin/seletivo/importar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conteudo, previa: !gravar }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Não foi possível ler o arquivo.");
        if (gravar) {
          setPrevia(null);
          setCsv(null);
          toast.success(
            `${j.resumo.pessoasCriadas} pessoas novas, ${j.resumo.tentativasNovas} tentativas gravadas.`,
          );
          setLoading(true);
          carregar(janela);
        } else {
          setCsv({ nome, conteudo });
          setPrevia(j.resumo);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao importar");
      } finally {
        setImportando(false);
      }
    },
    [carregar, janela],
  );

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="h-12 w-12 text-cream/20 mx-auto mb-4" />
        <h2 className="font-fraunces font-bold text-xl text-cream mb-2">Acesso restrito</h2>
        <p className="text-cream/40">Apenas administradores veem esta tela.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (erro || !retrato) {
    return (
      <Card>
        <div className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" style={{ color: DOURADO }} />
          <div>
            <p className="font-dm text-sm text-cream">Não consegui montar o retrato.</p>
            <p className="font-dm text-xs text-cream/40 mt-1">{erro}</p>
            <button
              onClick={() => { setLoading(true); setErro(null); carregar(janela); }}
              className="mt-3 font-dm text-xs px-3 py-1.5 rounded-full"
              style={{ color: TERRACOTA, border: `1px solid ${TERRACOTA}55` }}
            >
              Tentar de novo
            </button>
          </div>
        </div>
      </Card>
    );
  }

  const { nucleo, sumidos, coortes, condutores, totais, cobertura, fluxo, seletivo } = retrato;
  const sumidosVisiveis = verTodosSumidos ? sumidos.semSinal : sumidos.semSinal.slice(0, 4);
  const janelaAberta = janela === "all";
  const rotuloJanela = RANGE_LABELS[janela].toLowerCase();
  const abrirPessoa = (p: PessoaLinha) =>
    setPessoaAberta({ nome: p.nome, email: p.email ?? undefined });

  return (
    <div className={`space-y-6 transition-opacity ${recarregando ? "opacity-50" : ""}`}>
      {/* ── Cabeçalho ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">Pessoas</h1>
            <p className="text-sm text-cream/35 mt-1 font-dm">
              Quem volta, quem sumiu e com quem vale conversar.
            </p>
          </div>
          <button
            onClick={baixarCSV}
            className="flex items-center gap-1.5 font-dm text-xs px-3 py-2 rounded-full transition-all hover:bg-white/[.05] self-start"
            style={{ color: "rgba(253,251,247,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Download className="h-3.5 w-3.5" />
            Baixar CSV
          </button>
        </div>
        <div className="flex items-center gap-1.5 mt-3">
          <p className="font-dm text-[11px] text-cream/30">
            {cobertura.encontrosCapturados > 0 && cobertura.pct != null
              ? `O formulário registra cerca de ${cobertura.pct}% de quem esteve na sala.`
              : "O formulário registra cerca de metade de quem esteve na sala."}
          </p>
          <HintButton text="Comparando a lista do Meet com quem enviou formulário, mais ou menos metade de quem esteve na sala preenche. E não é sorteio: quem preenche costuma preencher sempre, quem não preenche nunca preenche. Todo número desta tela que vem do formulário está por baixo do real, e existe gente frequente que ele nunca viu." />
        </div>
      </motion.div>

      {/* ── Janela ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.03 }}>
        <SeletorJanela valor={janela} onChange={trocarJanela} desabilitado={recarregando} />
        <p className="font-dm text-[11px] text-cream/25 mt-2 leading-relaxed">
          A janela decide quem entra na lista. O que cada pessoa é, quantas vezes veio na vida
          e se escreve relato, continua vindo da história inteira dela. Núcleo, sumiço e coorte
          têm janela própria e não obedecem a este seletor.
        </p>
      </motion.div>

      {/* ── Movimento da janela ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4" style={{ color: TEAL }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
              Movimento {janelaAberta ? "em toda a história" : `nos últimos ${rotuloJanela}`}
            </h2>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {[
              { r: "presenças em grupo", v: fluxo.presencas, c: undefined as string | undefined },
              { r: "pessoas presentes", v: fluxo.pessoas, c: TERRACOTA },
              { r: "estrearam", v: fluxo.estreantes, c: TEAL },
            ].map((x) => (
              <div key={x.r}>
                <p
                  className="font-fraunces font-bold text-3xl tabular-nums leading-none"
                  style={{ color: x.c ?? "rgba(253,251,247,0.85)" }}
                >
                  {x.v}
                </p>
                <p className="font-dm text-[11px] text-cream/30 mt-1.5">{x.r}</p>
              </div>
            ))}
            <div>
              <p className="font-fraunces font-bold text-3xl tabular-nums leading-none text-cream/85">
                {fluxo.medianaVezes}
              </p>
              <p className="font-dm text-[11px] text-cream/30 mt-1.5">
                vezes, na mediana
                {fluxo.vezesPorPessoa != null && (
                  <span className="text-cream/20"> · média {fluxo.vezesPorPessoa}</span>
                )}
              </p>
            </div>
          </div>
          {fluxo.vezesPorPessoa != null && fluxo.vezesPorPessoa > fluxo.medianaVezes && (
            <p className="font-dm text-[11px] text-cream/30 mt-4 leading-relaxed">
              A média está acima da mediana porque um punhado de pessoas vem muitas vezes e a
              maioria vem uma só. Leia a mediana, não a média.
            </p>
          )}
        </Card>
      </motion.div>

      {/* ── Núcleo ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Users className="h-4 w-4" style={{ color: TERRACOTA }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">Núcleo</h2>
            <JanelaPropria motivo="90 dias, por definição" />
            <HintButton text="Cinco presenças em noventa dias é a linha em que alguém deixa de ser visita e vira parte. Vale presença declarada no formulário e presença capturada na sala: se as duas caem no mesmo dia e no mesmo grupo, contam uma. A janela do topo da tela não mexe neste bloco: se mexesse, escolher hoje devolveria zero e a tela diria que a formação acabou." />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
            <div>
              <p className="font-fraunces font-bold text-5xl tabular-nums leading-none" style={{ color: TERRACOTA }}>
                {nucleo.total}
              </p>
              <p className="font-dm text-xs text-cream/40 mt-2 leading-snug">
                pessoas com 5 ou mais presenças em 90 dias
              </p>
              {nucleo.aproximacao > 0 && (
                <p className="font-dm text-[11px] text-cream/30 mt-3">
                  {nucleo.aproximacao} {nucleo.aproximacao === 1 ? "pessoa está" : "pessoas estão"} em 3 ou 4 presenças.
                  É daí que o núcleo cresce.
                </p>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
                {nucleo.serie.map((q, i) => (
                  <div key={q.rotulo} className="text-center">
                    <p
                      className="font-fraunces font-bold text-xl tabular-nums"
                      style={{ color: i >= nucleo.serie.length - 2 ? "rgba(253,251,247,0.85)" : "rgba(253,251,247,0.35)" }}
                    >
                      {q.valor}
                    </p>
                    <p className="font-dm text-[9px] text-cream/20 mt-0.5">{q.rotulo}</p>
                  </div>
                ))}
              </div>
              <p className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mt-3">
                as últimas sete quinzenas
              </p>
              {nucleo.serie.length >= 2 &&
                nucleo.serie.at(-1)!.valor === nucleo.serie.at(-2)!.valor && (
                  <p className="font-dm text-xs text-cream/50 mt-3 leading-relaxed">
                    Parado no mesmo número há duas quinzenas.
                  </p>
                )}
              <div className="flex flex-wrap gap-4 mt-4">
                {[
                  { r: "aparecendo", v: nucleo.quentes, c: TEAL },
                  { r: "esfriando", v: nucleo.esfriando, c: DOURADO },
                  { r: "sumidas", v: nucleo.frios, c: "#EF4444" },
                ].map((e) => (
                  <div key={e.r} className="flex items-baseline gap-1.5">
                    <span className="font-fraunces font-bold text-lg tabular-nums" style={{ color: e.c }}>
                      {e.v}
                    </span>
                    <span className="font-dm text-[11px] text-cream/35">{e.r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {nucleo.frios > 0 && (
            <div
              className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-[10px]"
              style={{ background: "rgba(212,133,74,0.07)", border: "1px solid rgba(212,133,74,0.2)" }}
            >
              <p className="font-dm text-xs text-cream/70">
                {nucleo.frios} {nucleo.frios === 1 ? "dessa pessoa não aparece" : `dessas ${nucleo.total} não aparecem`} há 45 dias ou mais.
              </p>
              <a href="#sumiram" className="font-dm text-xs whitespace-nowrap" style={{ color: DOURADO }}>
                Ver os nomes
              </a>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ── Quem sumiu ── */}
      <motion.div id="sumiram" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <Card>
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <UserMinus className="h-4 w-4" style={{ color: DOURADO }} />
              <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                Quem sumiu do núcleo
              </h2>
              <JanelaPropria motivo="45 dias, por definição" />
            </div>
            <span className="font-dm text-xs text-cream/30">
              {sumidos.semSinal.length + sumidos.soFormulario.length} pessoas
            </span>
          </div>

          {sumidos.semSinal.length === 0 && sumidos.soFormulario.length === 0 ? (
            <p className="font-dm text-xs text-cream/30 py-6 text-center">
              Ninguém do núcleo está sumido. Todas apareceram nos últimos 45 dias.
            </p>
          ) : (
            <div className="space-y-5">
              {sumidos.semSinal.length > 0 && (
                <div>
                  <p className="font-dm text-[11px] text-cream/40 mb-2">
                    Não aparece em lugar nenhum
                    <span className="text-cream/25"> · {sumidos.semSinal.length}</span>
                  </p>
                  <div className="space-y-1">
                    {sumidosVisiveis.map((p) => (
                      <LinhaSumido key={p.id} p={p} onClick={() => abrirPessoa(p)} />
                    ))}
                  </div>
                  {sumidos.semSinal.length > 4 && (
                    <button
                      onClick={() => setVerTodosSumidos((v) => !v)}
                      className="font-dm text-xs mt-2"
                      style={{ color: DOURADO }}
                    >
                      {verTodosSumidos ? "Mostrar menos" : `Ver ${sumidos.semSinal.length - 4} restantes`}
                    </button>
                  )}
                </div>
              )}

              {sumidos.soFormulario.length > 0 && (
                <div>
                  <p className="font-dm text-[11px] text-cream/40 mb-2">
                    Esteve na sala, parou de preencher
                    <span className="text-cream/25"> · {sumidos.soFormulario.length}</span>
                  </p>
                  <div className="space-y-1">
                    {sumidos.soFormulario.map((p) => (
                      <LinhaSumido key={p.id} p={p} onClick={() => abrirPessoa(p)} />
                    ))}
                  </div>
                  <p className="font-dm text-[11px] text-cream/30 mt-2 leading-relaxed">
                    Aqui o sumiço pode ser só do formulário. Confira antes de cobrar.
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      </motion.div>

      {/* ── Coorte ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
        <Card>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Repeat className="h-4 w-4" style={{ color: TEAL }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
              Quem veio pela primeira vez e voltou
            </h2>
            <JanelaPropria motivo="por mês de estreia" />
            <HintButton text="De cada grupo que estreou num mês, quantas pessoas apareceram de novo em qualquer momento depois. O mês corrente fica de fora: quem estreou anteontem ainda não teve tempo de voltar. Este bloco substituiu a retenção do dashboard, que dividia os ativos por todo mundo que já passou e por isso só podia cair." />
          </div>

          {coortes.length === 0 ? (
            <p className="font-dm text-xs text-cream/30 py-6 text-center">
              Ainda não há mês fechado com gente nova o suficiente para contar.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {coortes.slice(-4).map((c) => {
                  const pct = c.estreantes > 0 ? (c.voltaram / c.estreantes) * 100 : 0;
                  return (
                    <div key={c.mes}>
                      <p className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">{c.rotulo}</p>
                      <p className="font-fraunces font-bold text-xl text-cream mt-1 tabular-nums">
                        {c.voltaram} <span className="text-cream/35 font-dm text-sm font-normal">de {c.estreantes}</span>
                      </p>
                      {c.estreantes >= 30 && (
                        <p className="font-dm text-xs text-cream/40 tabular-nums">{Math.round(pct)}%</p>
                      )}
                      {/* Escala fixa de 0 a 60: normalizar pelo maior faria 43% parecer o dobro de 32%. */}
                      <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min((pct / 60) * 100, 100)}%`, background: TEAL, opacity: 0.7 }}
                        />
                      </div>
                      <p className="font-dm text-[10px] text-cream/25 mt-1.5">
                        {c.estreantes - c.voltaram} não voltaram
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="font-dm text-[11px] text-cream/30 mt-4 leading-relaxed">
                A diferença entre um mês e outro cabe dentro do erro: leia os quatro como iguais.
                O que interessa é que o patamar não se mexeu.
              </p>
            </>
          )}
        </Card>
      </motion.div>

      {/* ── Processo seletivo ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
        <Card>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <GraduationCap className="h-4 w-4" style={{ color: ROXO }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
              Processo seletivo
            </h2>
            <JanelaPropria motivo="tem data própria" />
            <HintButton text="Cada candidato é ligado a uma pessoa pelo e-mail ou pelo WhatsApp, nunca pelo nome. A pergunta que este bloco responde e que não existia em lugar nenhum: quem foi aprovado e nunca apareceu num grupo. O resultado do seletivo morria no AvaliAllos e a presença morria no formulário." />
          </div>

          {seletivo.candidatos === 0 ? (
            <p className="font-dm text-xs text-cream/30 py-4 leading-relaxed">
              Nenhum candidato importado ainda. Solte abaixo o CSV completo do AvaliAllos e o
              seletivo passa a aparecer aqui e ao lado de cada pessoa.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-8 gap-y-4 mb-5">
                {[
                  { r: "candidatos", v: seletivo.candidatos, c: undefined as string | undefined },
                  { r: "aprovados", v: seletivo.aprovados, c: TEAL },
                  { r: "não aprovados", v: seletivo.rejeitados, c: undefined },
                  { r: "já eram pessoa conhecida", v: seletivo.jaEramPessoa, c: undefined },
                ].map((x) => (
                  <div key={x.r}>
                    <p
                      className="font-fraunces font-bold text-2xl tabular-nums leading-none"
                      style={{ color: x.c ?? "rgba(253,251,247,0.85)" }}
                    >
                      {x.v}
                    </p>
                    <p className="font-dm text-[11px] text-cream/30 mt-1.5">{x.r}</p>
                  </div>
                ))}
                {seletivo.corte != null && (
                  <div>
                    <p className="font-fraunces font-bold text-2xl tabular-nums leading-none text-cream/85">
                      {seletivo.corte}
                    </p>
                    <p className="font-dm text-[11px] text-cream/30 mt-1.5">nota de corte observada</p>
                  </div>
                )}
              </div>

              {/* O cruzamento. Abaixo de 25 pessoas, nome no lugar de número. */}
              <div
                className="px-4 py-3 rounded-[10px] mb-4"
                style={{ background: "rgba(108,92,231,0.06)", border: "1px solid rgba(108,92,231,0.2)" }}
              >
                <p className="font-dm text-sm text-cream/80">
                  {seletivo.aprovadosQueVieram.length} de {seletivo.aprovados} aprovados
                  {seletivo.aprovadosQueVieram.length === 1 ? " apareceu" : " apareceram"} em algum grupo.
                </p>
                {seletivo.aprovadosQueVieram.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {seletivo.aprovadosQueVieram.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => abrirPessoa(p)}
                        className="font-dm text-[11px] transition-colors hover:text-cream"
                        style={{ color: TEAL }}
                      >
                        {p.nome} <span className="text-cream/25">({p.presencas}x)</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="font-dm text-[11px] text-cream/35 mt-2 leading-relaxed">
                  Aprovar não traz ninguém para dentro sozinho. Os outros{" "}
                  {seletivo.aprovadosQueNaoVieram.length} passaram e nunca vieram.
                </p>
              </div>

              {seletivo.aprovadosQueNaoVieram.length > 0 && (
                <div>
                  <p className="font-dm text-[11px] text-cream/40 mb-2">
                    Aprovados que nunca apareceram
                    <span className="text-cream/25"> · {seletivo.aprovadosQueNaoVieram.length}</span>
                  </p>
                  <div className="space-y-1">
                    {(verTodosAprovados
                      ? seletivo.aprovadosQueNaoVieram
                      : seletivo.aprovadosQueNaoVieram.slice(0, 6)
                    ).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => abrirPessoa(p)}
                        className="w-full text-left px-3 py-2 rounded-[10px] transition-colors hover:bg-white/[.03] flex items-center justify-between gap-3"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <div className="min-w-0">
                          <p className="font-dm text-sm text-cream/80 truncate">{p.nome}</p>
                          <p className="font-dm text-[11px] text-cream/25 truncate">{p.email ?? "sem e-mail"}</p>
                        </div>
                        {p.seletivo?.nota != null && (
                          <span className="font-fraunces font-bold text-sm tabular-nums flex-shrink-0" style={{ color: ROXO }}>
                            {p.seletivo.nota}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {seletivo.aprovadosQueNaoVieram.length > 6 && (
                    <button
                      onClick={() => setVerTodosAprovados((v) => !v)}
                      className="font-dm text-xs mt-2"
                      style={{ color: ROXO }}
                    >
                      {verTodosAprovados
                        ? "Mostrar menos"
                        : `Ver ${seletivo.aprovadosQueNaoVieram.length - 6} restantes`}
                    </button>
                  )}
                </div>
              )}

              {seletivo.rejeitadosQueVieram.length > 0 && (
                <p className="font-dm text-[11px] text-cream/30 mt-4 leading-relaxed">
                  {seletivo.rejeitadosQueVieram.length}{" "}
                  {seletivo.rejeitadosQueVieram.length === 1
                    ? "pessoa não aprovada veio"
                    : "pessoas não aprovadas vieram"}{" "}
                  a grupo assim mesmo. A formação é aberta, então isso não é erro: é o lembrete de
                  que o seletivo não é a porta.
                </p>
              )}
            </>
          )}

          {/* Importar */}
          <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="font-dm text-[11px] text-cream/35 leading-relaxed">
                Solte aqui o CSV completo do AvaliAllos. Quem não existe ainda vira pessoa nova.
                Importar o mesmo arquivo duas vezes não duplica nada.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  enviarSeletivo(await f.text(), f.name, false);
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importando}
                className="flex items-center gap-1.5 font-dm text-xs px-3 py-2 rounded-full transition-all hover:bg-white/[.05] self-start whitespace-nowrap disabled:opacity-50"
                style={{ color: ROXO, border: "1px solid rgba(108,92,231,0.35)" }}
              >
                <Upload className="h-3.5 w-3.5" />
                {importando ? "Lendo..." : "Escolher arquivo"}
              </button>
            </div>

            {previa && csv && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="font-dm text-[11px] text-cream/30 mb-3">{csv.nome}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
                  {[
                    { r: "candidatos no arquivo", v: previa.linhas, c: undefined as string | undefined },
                    { r: "já são pessoas conhecidas", v: previa.casamPorEmail + previa.casamPorTelefone, c: TEAL },
                    { r: "viram pessoas novas", v: previa.pessoasNovas, c: DOURADO },
                    { r: "já importados antes", v: previa.jaImportados, c: undefined },
                  ].map((x) => (
                    <div key={x.r}>
                      <p className="font-fraunces font-bold text-xl tabular-nums" style={{ color: x.c ?? "rgba(253,251,247,0.8)" }}>
                        {x.v}
                      </p>
                      <p className="font-dm text-[10px] text-cream/30">{x.r}</p>
                    </div>
                  ))}
                </div>
                {(previa.semEmail > 0 || previa.semTelefone > 0) && (
                  <p className="font-dm text-[11px] mb-3" style={{ color: DOURADO }}>
                    {previa.semEmail} sem e-mail e {previa.semTelefone} sem WhatsApp. Esses só podem virar
                    pessoa nova, porque sem chave forte não dá para afirmar que já são alguém.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => enviarSeletivo(csv.conteudo, csv.nome, true)}
                    disabled={importando}
                    className="font-dm text-xs px-4 py-2 rounded-full transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #C84B31, #A33D27)", color: "#FDFBF7" }}
                  >
                    {importando ? "Gravando..." : `Gravar ${previa.linhas} candidatos`}
                  </button>
                  <button
                    onClick={() => { setPrevia(null); setCsv(null); }}
                    className="font-dm text-xs px-3 py-2 rounded-full transition-all hover:bg-white/[.05]"
                    style={{ color: "rgba(253,251,247,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    Cancelar
                  </button>
                </div>
                <p className="font-dm text-[10px] text-cream/25 mt-3">Nada foi gravado ainda.</p>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* ── Tabela ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
              {janelaAberta ? "Todas as pessoas" : `Quem deu sinal nos últimos ${rotuloJanela}`}
            </h2>
            <span className="font-dm text-xs text-cream/30 tabular-nums">
              {filtradas.length === totais.pessoas ? totais.pessoas : `${filtradas.length} de ${totais.pessoas}`}
            </span>
          </div>
          {!janelaAberta && (
            <p className="font-dm text-[11px] text-cream/25 mb-3">
              {totais.pessoas} de {totais.pessoasNaBase} pessoas que a base conhece.
            </p>
          )}

          <div className="relative mb-3 mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="dark-input w-full rounded-[10px] pl-9 pr-3 py-2.5 font-dm text-base md:text-sm"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4">
            {([
              ["todas", "Todas", totais.pessoas],
              ["nucleo", "Núcleo", retrato.pessoas.filter((p) => p.presencas90 >= 5).length],
              ["so-grupo", "Só no grupo", totais.soGrupo],
              ["so-plataforma", "Só na plataforma", totais.soPlataforma],
              ["nos-dois", "Nos dois", totais.nosDois],
              ["uma-vez", "Vieram uma vez só", totais.umaVezSo],
              ["relato", "Escrevem relato", totais.escrevemRelato],
              ["mudos", "Presentes e mudos", retrato.pessoas.filter((p) => p.encontrosMeet > 0 && p.turnosFala === 0).length],
              ["seletivo", "Veio do seletivo", totais.doSeletivo],
              ["aprovado-ausente", "Aprovadas e ausentes", retrato.pessoas.filter((p) => p.seletivo?.aprovado && p.presencas === 0).length],
            ] as [Recorte, string, number][])
              // Um recorte que não pega ninguém vira ruído no meio dos que pegam.
              // Fica visível o que estiver selecionado, para o zero se explicar.
              .filter(([k, , n]) => n > 0 || recorte === k || k === "todas")
              .map(([k, label, n]) => {
                const ativo = recorte === k;
                return (
                  <button
                    key={k}
                    onClick={() => setRecorte(k)}
                    className="font-dm text-xs px-3 py-2 rounded-full whitespace-nowrap transition-all min-h-[36px] flex items-center gap-1.5"
                    style={{
                      backgroundColor: ativo ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
                      color: ativo ? TERRACOTA : "rgba(253,251,247,0.4)",
                      border: `1px solid ${ativo ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {label}
                    <span className="opacity-60 tabular-nums">{n}</span>
                  </button>
                );
              })}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="font-dm text-[11px] text-cream/25">Ordenar por</span>
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as keyof PessoaLinha)}
              className="dark-input rounded-[8px] px-2 py-1.5 font-dm text-xs"
              style={{ colorScheme: "dark" }}
            >
              <option value="presencas">Presenças</option>
              <option value="presencas90">Presenças em 90 dias</option>
              {!janelaAberta && <option value="presencasJanela">Presenças na janela</option>}
              <option value="relatosLongos">Relatos escritos</option>
              <option value="turnosFala">Turnos de fala</option>
              <option value="aulas">Aulas concluídas</option>
              <option value="horasPlataforma">Horas na plataforma</option>
              <option value="diasSemAparecer">Dias sem aparecer</option>
            </select>
          </div>

          {filtradas.length === 0 ? (
            <p className="font-dm text-xs text-cream/30 py-8 text-center">
              {busca ? "Nenhuma pessoa com esse nome ou e-mail." : "Nenhuma pessoa nesse recorte."}
            </p>
          ) : (
            <>
              <div className="space-y-1">
                {filtradas.slice(0, mostrando).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => abrirPessoa(p)}
                    className="w-full text-left px-3 py-2.5 rounded-[10px] transition-colors hover:bg-white/[.03]"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-dm text-sm text-cream/80 truncate">{p.nome}</p>
                        <p className="font-dm text-[11px] text-cream/25 truncate">{p.email ?? "sem e-mail"}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="font-fraunces font-bold text-sm tabular-nums" style={{ color: TERRACOTA }}>
                          {p.presencas}
                        </p>
                        <p className="font-dm text-[9px] text-cream/25">presenças</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                      <Selo cor={p.temConta ? TEAL : undefined}>{p.temConta ? "tem conta" : "sem conta"}</Selo>
                      {!janelaAberta && p.presencasJanela > 0 && (
                        <Selo>{p.presencasJanela} na janela</Selo>
                      )}
                      {p.atividades > 1 && <Selo>{p.atividades} atividades</Selo>}
                      {p.relatosLongos > 0 && <Selo cor={DOURADO}>{p.relatosLongos} relato{p.relatosLongos > 1 ? "s" : ""}</Selo>}
                      {p.aulas > 0 && <Selo>{p.aulas} aulas</Selo>}
                      {p.horasPlataforma > 0 && <Selo>{p.horasPlataforma}h na plataforma</Selo>}
                      {p.encontrosMeet > 0 && (
                        <Selo cor={ROXO}>
                          {p.encontrosMeet} no Meet{p.turnosFala > 0 ? ` · falou ${p.turnosFala}x` : " · calada"}
                        </Selo>
                      )}
                      {p.seletivo && (
                        <Selo cor={p.seletivo.aprovado ? TEAL : "rgba(253,251,247,0.3)"}>
                          seletivo{p.seletivo.nota != null ? ` ${p.seletivo.nota}` : ""}
                          {p.seletivo.aprovado ? ", aprovada" : p.seletivo.status ? `, ${p.seletivo.status.toLowerCase()}` : ""}
                        </Selo>
                      )}
                      {p.diasSemAparecer != null && (
                        <Selo cor={p.diasSemAparecer >= 45 ? "#EF4444" : undefined}>
                          {p.diasSemAparecer === 0 ? "apareceu hoje" : `há ${p.diasSemAparecer} dias`}
                        </Selo>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {mostrando < filtradas.length && (
                <button
                  onClick={() => setMostrando((m) => m + PAGINA)}
                  className="w-full mt-3 font-dm text-xs py-2.5 rounded-[10px] transition-colors hover:bg-white/[.03]"
                  style={{ color: "rgba(253,251,247,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  Carregar mais {Math.min(PAGINA, filtradas.length - mostrando)}
                  <span className="text-cream/25"> · {filtradas.length - mostrando} restantes</span>
                </button>
              )}
            </>
          )}
        </Card>
      </motion.div>

      {/* ── Condutores ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
        <Card>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4" style={{ color: TEAL }} />
              <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">Condutores</h2>
            </div>
            <span className="font-dm text-xs text-cream/30 tabular-nums">{condutores.length}</span>
          </div>

          {condutores.length === 0 ? (
            <p className="font-dm text-xs text-cream/30 py-6 text-center">
              Nenhum condutor recebeu avaliação {janelaAberta ? "ainda" : `nos últimos ${rotuloJanela}`}.
            </p>
          ) : (
            <>
              <p className="font-dm text-[11px] text-cream/35 mb-4 leading-relaxed">
                As notas ficam todas perto de 10, então elas não separam ninguém. O que separa é
                quanto cada um conduz e o que escrevem sobre ele. A lista vai por volume, não por nota.
                A nota só conta quando havia condutor a avaliar: evento sem condutor grava 5 fixo no
                formulário, e essas linhas ficam de fora.
              </p>
              <div className="space-y-2">
                {(verTodosCondutores ? condutores : condutores.slice(0, 5)).map((c) => (
                  <div
                    key={c.nome}
                    className="px-3 py-2.5 rounded-[10px]"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-dm text-sm text-cream/80">{c.nome}</span>
                      <span className="font-dm text-[11px] text-cream/30">
                        {c.avaliacoes} avaliaç{c.avaliacoes === 1 ? "ão" : "ões"}
                        {c.relatos.length > 0 && ` · ${c.relatos.length} relato${c.relatos.length > 1 ? "s" : ""}`}
                        {c.encontrosMeet > 0 && ` · ${c.encontrosMeet} no Meet`}
                        {c.falaPct != null && ` · fala ${c.falaPct}%`}
                      </span>
                    </div>
                    {c.avaliacoes < 5 ? (
                      <p className="font-dm text-[11px] text-cream/30 mt-1">
                        {c.avaliacoes} nota{c.avaliacoes > 1 ? "s" : ""} só. Ainda não dá para ler média nenhuma aqui.
                      </p>
                    ) : (
                      <p className="font-dm text-[11px] text-cream/30 mt-1 tabular-nums">
                        nota {c.notaMedia?.toFixed(1)} em {c.avaliacoes} notas
                      </p>
                    )}
                    {c.relatos[0] && (
                      <p className="font-dm text-xs text-cream/50 italic mt-2 leading-relaxed">
                        &ldquo;{c.relatos[0].texto.slice(0, 180)}
                        {c.relatos[0].texto.length > 180 ? "..." : ""}&rdquo;
                      </p>
                    )}
                    {c.relatos.length === 0 && (
                      <p className="font-dm text-[11px] text-cream/25 mt-1.5">
                        Ninguém escreveu sobre {c.nome.split(" ")[0]} ainda. Só notas.
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {condutores.length > 5 && (
                <button
                  onClick={() => setVerTodosCondutores((v) => !v)}
                  className="w-full mt-3 font-dm text-xs py-2 rounded-[10px] transition-colors hover:bg-white/[.03]"
                  style={{ color: "rgba(253,251,247,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {verTodosCondutores ? "Mostrar os cinco primeiros" : `Ver os ${condutores.length}`}
                </button>
              )}
            </>
          )}
        </Card>
      </motion.div>

      {/* ── Glossário ── */}
      <button
        onClick={() => setGlossarioAberto((v) => !v)}
        className="flex items-center gap-1.5 font-dm text-[11px] text-cream/30 hover:text-cream/50 transition-colors"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${glossarioAberto ? "rotate-180" : ""}`} />
        Como esses números são contados
      </button>
      {glossarioAberto && (
        <div className="space-y-1.5 pl-5 pb-4">
          {[
            "Presença: formulário enviado ou nome capturado na sala do Meet. Se os dois acontecem no mesmo dia e no mesmo grupo, conta uma.",
            "Núcleo: cinco ou mais presenças nos últimos noventa dias. A janela do topo não mexe nisso.",
            "Sumida: quarenta e cinco dias sem nenhum dos dois sinais.",
            "Voltou: apareceu em qualquer data depois da estreia.",
            "Relato escrito: texto com mais de 200 caracteres no formulário. Abaixo disso costuma ser um elogio de uma palavra.",
            "Nos dois mundos: tem presença em grupo e também conta na plataforma.",
            "Sinal: qualquer rastro na janela, inclusive aula assistida e tempo na plataforma. É o que decide quem entra na lista.",
            "Veio do seletivo: existe candidatura ligada a esta pessoa por e-mail ou WhatsApp. Nunca por nome.",
          ].map((t) => (
            <p key={t} className="font-dm text-[11px] text-cream/35 leading-relaxed">{t}</p>
          ))}
          <p className="font-dm text-[11px] text-cream/25 leading-relaxed pt-1">
            Retrato montado em {new Date(retrato.geradoEm).toLocaleString("pt-BR")}.
          </p>
        </div>
      )}

      <PessoaModal pessoa={pessoaAberta} onClose={() => setPessoaAberta(null)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════

function Selo({ children, cor }: { children: React.ReactNode; cor?: string }) {
  return (
    <span className="font-dm text-[10px] tabular-nums" style={{ color: cor ?? "rgba(253,251,247,0.3)" }}>
      {children}
    </span>
  );
}

function LinhaSumido({ p, onClick }: { p: PessoaLinha; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-[10px] transition-colors hover:bg-white/[.03]"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-dm text-sm text-cream/80 truncate">{p.nome}</p>
          <p className="font-dm text-[11px] text-cream/25 truncate">{p.email ?? "sem e-mail"}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-fraunces font-bold text-sm tabular-nums text-cream/70">{p.presencas}</p>
          <p className="font-dm text-[9px] text-cream/25">presenças</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 mt-1.5">
        <Selo cor={DOURADO}>há {p.diasSemAparecer} dias sem aparecer</Selo>
        {p.ultimoMeet && (
          <Selo cor={ROXO}>
            visto na sala em {new Date(p.ultimoMeet).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </Selo>
        )}
      </div>
    </button>
  );
}
