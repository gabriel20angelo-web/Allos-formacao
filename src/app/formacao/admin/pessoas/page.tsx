// Pessoas: quem volta, quem sumiu e com quem vale conversar.
//
// Esta tela existe porque a mesma pessoa vivia em três lugares que não se
// conheciam, e por isso o painel só sabia responder "quantos formulários
// chegaram". Aqui a unidade é a pessoa, e presença vale tanto declarada no
// formulário quanto medida na sala.
//
// Três regras de desenho que não são estéticas, são de honestidade, e que
// valem para qualquer coisa acrescentada aqui depois:
//
//   1. Percentual só com denominador de 30 para cima. Abaixo disso a tela
//      escreve a fração. Uma pessoa a mais no núcleo de 19 move 5 pontos, e
//      uma seta de variação sobre isso é teatro.
//   2. Quando o percentual aparece, a fração aparece junto e maior.
//   3. Abaixo de 25 pessoas, nome no lugar de número. Nenhum bloco agrega
//      pouca gente num número sem dar a lista a um clique.
//
// A série do núcleo é impressa como sete números, não como curva: com sete
// pontos, uma linha suave desenha inflexões que os dados não têm.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import HintButton from "@/components/admin/dashboard/HintButton";
import PessoaModal, { type PessoaRef } from "@/components/admin/dashboard/PessoaModal";
import type { PessoaLinha, RetratoPessoas } from "@/lib/pessoas/agregar";

const TERRACOTA = "#C84B31";
const TEAL = "#2E9E8F";
const DOURADO = "#D4854A";

type Recorte =
  | "todas"
  | "nucleo"
  | "so-grupo"
  | "so-plataforma"
  | "nos-dois"
  | "uma-vez"
  | "relato"
  | "mudos";

const PAGINA = 25;

export default function AdminPessoasPage() {
  const { isAdmin } = useAuth();
  const [retrato, setRetrato] = useState<RetratoPessoas | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [recorte, setRecorte] = useState<Recorte>("todas");
  const [ordem, setOrdem] = useState<keyof PessoaLinha>("presencas");
  const [mostrando, setMostrando] = useState(PAGINA);
  const [pessoaAberta, setPessoaAberta] = useState<PessoaRef | null>(null);
  const [verTodosCondutores, setVerTodosCondutores] = useState(false);
  const [verTodosSumidos, setVerTodosSumidos] = useState(false);
  const [glossarioAberto, setGlossarioAberto] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/formacao/api/admin/pessoas");
      const tipo = r.headers.get("content-type") || "";
      if (!tipo.includes("application/json")) {
        throw new Error(
          "O servidor respondeu uma página em vez de dados. Abra o painel por allos.org.br/formacao/admin/pessoas.",
        );
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível carregar.");
      setRetrato(j as RetratoPessoas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

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

  useEffect(() => setMostrando(PAGINA), [recorte, busca, ordem]);

  const baixarCSV = () => {
    if (!retrato) return;
    const cab = [
      "Nome", "E-mail", "Tem conta", "Presencas", "Presencas 90d", "Atividades",
      "Relatos longos", "Aulas", "Horas plataforma", "Encontros Meet",
      "Minutos na sala", "Turnos de fala", "Dias sem aparecer", "Estreia",
    ];
    const linhas = filtradas.map((p) => [
      p.nome, p.email ?? "", p.temConta ? "sim" : "nao", p.presencas, p.presencas90,
      p.atividades, p.relatosLongos, p.aulas, p.horasPlataforma, p.encontrosMeet,
      p.minutosMeet, p.turnosFala, p.diasSemAparecer ?? "", (p.estreia ?? "").slice(0, 10),
    ]);
    const csv =
      "﻿" +
      [cab, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pessoas_${recorte}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Baixado com o recorte e a ordem que estão na tela.");
  };

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
              onClick={() => { setLoading(true); setErro(null); carregar(); }}
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

  const { nucleo, sumidos, coortes, condutores, totais, cobertura } = retrato;
  const sumidosVisiveis = verTodosSumidos ? sumidos.semSinal : sumidos.semSinal.slice(0, 4);

  return (
    <div className="space-y-6">
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

      {/* ── Núcleo ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4" style={{ color: TERRACOTA }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">Núcleo</h2>
            <HintButton text="Cinco presenças em noventa dias é a linha em que alguém deixa de ser visita e vira parte. Vale presença declarada no formulário e presença capturada na sala: se as duas caem no mesmo dia e no mesmo grupo, contam uma." />
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
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <UserMinus className="h-4 w-4" style={{ color: DOURADO }} />
              <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                Quem sumiu do núcleo
              </h2>
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
                      <LinhaSumido key={p.id} p={p} onClick={() => setPessoaAberta({ nome: p.nome, email: p.email ?? undefined })} />
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
                      <LinhaSumido key={p.id} p={p} onClick={() => setPessoaAberta({ nome: p.nome, email: p.email ?? undefined })} />
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
          <div className="flex items-center gap-2 mb-4">
            <Repeat className="h-4 w-4" style={{ color: TEAL }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
              Quem veio pela primeira vez e voltou
            </h2>
            <HintButton text="De cada grupo que estreou num mês, quantas pessoas apareceram de novo em qualquer momento depois. O mês corrente fica de fora: quem estreou anteontem ainda não teve tempo de voltar." />
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

      {/* ── Tabela ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
        <Card>
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">Todas as pessoas</h2>
            <span className="font-dm text-xs text-cream/30 tabular-nums">
              {filtradas.length === totais.pessoas ? totais.pessoas : `${filtradas.length} de ${totais.pessoas}`}
            </span>
          </div>

          <div className="relative mb-3">
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
              ["nucleo", "Núcleo", nucleo.total],
              ["so-grupo", "Só no grupo", totais.soGrupo],
              ["so-plataforma", "Só na plataforma", totais.soPlataforma],
              ["nos-dois", "Nos dois", totais.nosDois],
              ["uma-vez", "Vieram uma vez só", totais.umaVezSo],
              ["relato", "Escrevem relato", totais.escrevemRelato],
              ["mudos", "Presentes e mudos", retrato.pessoas.filter((p) => p.encontrosMeet > 0 && p.turnosFala === 0).length],
            ] as [Recorte, string, number][]).map(([k, label, n]) => {
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
                    onClick={() => setPessoaAberta({ nome: p.nome, email: p.email ?? undefined })}
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
                      {p.atividades > 1 && <Selo>{p.atividades} atividades</Selo>}
                      {p.relatosLongos > 0 && <Selo cor={DOURADO}>{p.relatosLongos} relato{p.relatosLongos > 1 ? "s" : ""}</Selo>}
                      {p.aulas > 0 && <Selo>{p.aulas} aulas</Selo>}
                      {p.horasPlataforma > 0 && <Selo>{p.horasPlataforma}h na plataforma</Selo>}
                      {p.encontrosMeet > 0 && (
                        <Selo cor="#6C5CE7">
                          {p.encontrosMeet} no Meet{p.turnosFala > 0 ? ` · falou ${p.turnosFala}x` : " · calada"}
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
              Nenhum condutor recebeu avaliação ainda.
            </p>
          ) : (
            <>
              <p className="font-dm text-[11px] text-cream/35 mb-4 leading-relaxed">
                As notas ficam todas perto de 10, então elas não separam ninguém. O que separa é
                quanto cada um conduz e o que escrevem sobre ele. A lista vai por volume, não por nota.
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
            "Núcleo: cinco ou mais presenças nos últimos noventa dias.",
            "Sumida: quarenta e cinco dias sem nenhum dos dois sinais.",
            "Voltou: apareceu em qualquer data depois da estreia.",
            "Relato escrito: texto com mais de 200 caracteres no formulário. Abaixo disso costuma ser um elogio de uma palavra.",
            "Nos dois mundos: tem presença em grupo e também conta na plataforma.",
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
          <Selo cor="#6C5CE7">
            visto na sala em {new Date(p.ultimoMeet).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </Selo>
        )}
      </div>
    </button>
  );
}
