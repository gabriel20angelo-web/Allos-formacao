// Pessoas: quem volta, quem sumiu e com quem vale conversar.
//
// Esta tela existe porque a mesma pessoa vivia em quatro lugares que não se
// conheciam (formulário de certificado, sala do Meet, plataforma e processo
// seletivo), e por isso o painel só sabia responder "quantos formulários
// chegaram". Aqui a unidade é a pessoa.
//
// Quatro regras de desenho que não são estéticas, e que valem para qualquer
// coisa acrescentada aqui depois:
//
//   1. Nenhuma palavra de dentro do código aparece na tela. "Presença" virou
//      "encontro" e a palavra "janela" não existe mais em lugar nenhum: quem
//      lê a tela não deve precisar saber como ela foi construída.
//   2. Todo rótulo carrega a definição por extenso, com os números que a régua
//      está usando de fato. Rótulo cuja regra mora escondida atrás de um ícone
//      de ajuda é rótulo que ninguém confere.
//   3. Percentual só com denominador de 30 para cima; abaixo disso a tela
//      escreve a fração. E abaixo de 25 pessoas, nome no lugar de número.
//   4. Cor significa estado, e um estado só por pessoa. Cor que decora em vez
//      de informar treina o olho a ignorar cor.
//
// A série do núcleo é impressa como sete números, não como curva: com sete
// pontos, uma linha suave desenha inflexões que os dados não têm.

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

  Shield,
  AlertTriangle,
  Upload,
  GraduationCap,
  Activity,
  Star,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import HintButton from "@/components/admin/dashboard/HintButton";
import PessoaModal, { type PessoaRef } from "@/components/admin/dashboard/PessoaModal";
import { SeletorJanela, JanelaPropria } from "@/components/admin/SeletorJanela";
import Destaque, { CORES_DESTAQUE, type MudancaDestaque } from "@/components/admin/pessoas/Destaque";
import BlocoClinica from "@/components/admin/pessoas/BlocoClinica";
import { CORES, ROTULOS, ORDEM_ESTADOS, definicao } from "@/components/admin/pessoas/estados";
import { REGUA, atende } from "@/lib/meet/regua";
import { RANGE_LABELS, type ActivityRange } from "@/lib/utils/activity";
import type { EstadoPessoa, PessoaLinha, RetratoPessoas } from "@/lib/pessoas/agregar";

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

/** Recortes que não são estado: atributos que se cruzam com qualquer estado. */
type Atributo = "destacadas" | "relato" | "mudos" | "seletivo" | "aprovado-ausente";
type Recorte = "todas" | EstadoPessoa | Atributo;

/**
 * Como ordenar. São perguntas, não campos: "quem vem mais" e "quem veio agora"
 * é o que se quer saber, e o nome da propriedade que responde é problema do
 * código, não de quem olha.
 */
const ORDENS: { chave: string; rotulo: string; ordenar: (a: PessoaLinha, b: PessoaLinha) => number }[] = [
  {
    chave: "frequencia",
    rotulo: "Vem mais",
    ordenar: (a, b) => b.encontros - a.encontros || (a.diasSemAparecer ?? 9e9) - (b.diasSemAparecer ?? 9e9),
  },
  {
    chave: "recencia",
    rotulo: "Veio agora",
    ordenar: (a, b) => (a.diasSemAparecer ?? 9e9) - (b.diasSemAparecer ?? 9e9) || b.encontros - a.encontros,
  },
  {
    chave: "escreve",
    rotulo: "Escreve mais",
    ordenar: (a, b) => b.relatosLongos - a.relatosLongos || b.encontros - a.encontros,
  },
  {
    chave: "assiste",
    rotulo: "Assiste mais",
    ordenar: (a, b) => b.aulas - a.aulas || b.horasPlataforma - a.horasPlataforma,
  },
  {
    chave: "fala",
    rotulo: "Fala mais",
    ordenar: (a, b) => b.turnosFala - a.turnosFala || b.encontrosNaSala - a.encontrosNaSala,
  },
  {
    chave: "nome",
    rotulo: "Nome",
    ordenar: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
  },
];

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
  const [ordem, setOrdem] = useState("frequencia");
  const [mostrando, setMostrando] = useState(PAGINA);
  const [pessoaAberta, setPessoaAberta] = useState<PessoaRef | null>(null);
  const [verTodosSumidos, setVerTodosSumidos] = useState(false);
  const [verTodosAprovados, setVerTodosAprovados] = useState(false);
  const [glossarioAberto, setGlossarioAberto] = useState(false);
  const [csv, setCsv] = useState<{ nome: string; conteudo: string } | null>(null);
  const [previa, setPrevia] = useState<ResumoImport | null>(null);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // O recorte de período roda no servidor, e não no navegador, porque quem
  // decide se a pessoa deu sinal precisa das datas de todas as fontes,
  // inclusive as que a tela nunca recebe (sessão de uso, conclusão de aula).
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

  /**
   * Repinta a estrela sem refazer o retrato inteiro. Recarregar tudo a cada
   * clique custaria cerca de um megabyte de leitura no servidor e faria um
   * recurso de um clique parecer lento.
   */
  const aplicarDestaque = useCallback(({ pessoaId, destaque }: MudancaDestaque) => {
    setRetrato((r) => {
      if (!r) return r;
      const trocar = (l: PessoaLinha) => (l.id === pessoaId ? { ...l, destaque } : l);
      const pessoas = r.pessoas.map(trocar);
      const marcadas = pessoas.filter((l) => l.destaque != null);
      // As destacadas podem incluir gente fora do período; preserva quem já
      // estava lá e não aparece na lista corrente.
      const forasteiras = r.destacadas
        .filter((l) => l.id !== pessoaId && !pessoas.some((p) => p.id === l.id))
        .map(trocar)
        .filter((l) => l.destaque != null);
      return {
        ...r,
        pessoas,
        nucleo: { ...r.nucleo, pessoas: r.nucleo.pessoas.map(trocar) },
        sumidos: {
          semSinal: r.sumidos.semSinal.map(trocar),
          soFormulario: r.sumidos.soFormulario.map(trocar),
        },
        destacadas: [...marcadas, ...forasteiras],
        totais: { ...r.totais, destacadas: marcadas.length + forasteiras.length },
      };
    });
  }, []);

  const filtradas = useMemo(() => {
    if (!retrato) return [];
    const q = busca.trim().toLowerCase();
    let base = retrato.pessoas;

    if (recorte === "destacadas") base = retrato.destacadas;
    else if (recorte === "relato") base = base.filter((p) => p.relatosLongos > 0);
    else if (recorte === "mudos")
      base = base.filter((p) => p.encontrosNaSala > 0 && p.turnosFala === 0);
    else if (recorte === "seletivo") base = base.filter((p) => p.seletivo != null);
    else if (recorte === "aprovado-ausente")
      base = base.filter((p) => p.seletivo?.aprovado && p.encontros === 0);
    else if (recorte !== "todas") base = base.filter((p) => p.estado === recorte);

    if (q) {
      base = base.filter(
        (p) => p.nome.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q),
      );
    }
    const ord = ORDENS.find((o) => o.chave === ordem) ?? ORDENS[0];
    return [...base].sort(ord.ordenar);
  }, [retrato, busca, recorte, ordem]);

  useEffect(() => setMostrando(PAGINA), [recorte, busca, ordem, janela]);

  const baixarCSV = () => {
    if (!retrato) return;
    const cab = [
      "Nome", "E-mail", "Estado", "Destaque", "Anotacao", "Tem conta", "Encontros",
      `Encontros em ${retrato.regras.janelaNucleoDias}d`, "Encontros no periodo",
      "Atividades", "Relatos escritos", "Aulas", "Horas na plataforma",
      "Encontros na sala", "Minutos na sala", "Turnos de fala",
      "Dias sem aparecer", "Ultimo encontro", "Estreia", "Seletivo status", "Seletivo nota",
    ];
    const linhas = filtradas.map((p) => [
      p.nome, p.email ?? "", ROTULOS[p.estado], p.destaque?.cor ?? "", p.destaque?.nota ?? "",
      p.temConta ? "sim" : "nao", p.encontros, p.encontrosRecentes, p.encontrosNoPeriodo,
      p.atividades, p.relatosLongos, p.aulas, p.horasPlataforma,
      p.encontrosNaSala, p.minutosNaSala, p.turnosFala,
      p.diasSemAparecer ?? "", (p.ultimoEncontro ?? "").slice(0, 10), (p.estreia ?? "").slice(0, 10),
      p.seletivo?.status ?? "", p.seletivo?.nota ?? "",
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
    toast.success("Baixado com o recorte e a ordem que estão na tela.");
  };

  // A prévia e a gravação chamam a mesma rota e o mesmo cálculo. Se fossem dois
  // caminhos, a prévia prometeria um número e a gravação faria outro.
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

  const { nucleo, sumidos, coortes, totais, cobertura, fluxo, seletivo, estados, regras } = retrato;
  const sumidosVisiveis = verTodosSumidos ? sumidos.semSinal : sumidos.semSinal.slice(0, 4);
  const periodoAberto = janela === "all";
  const rotuloPeriodo = RANGE_LABELS[janela].toLowerCase();
  const abrirPessoa = (p: PessoaLinha) =>
    setPessoaAberta({ nome: p.nome, email: p.email ?? undefined, pessoaId: p.id });

  // A avaliação clínica casa por telefone e devolve o `pessoa_id`, não a linha
  // inteira. Quem não estiver no recorte do período em vigor simplesmente não
  // abre: é melhor o clique não fazer nada do que abrir a ficha de outra pessoa.
  const abrirPessoaPorId = (pessoaId: string) => {
    const p = retrato.pessoas.find((x) => x.id === pessoaId);
    if (p) abrirPessoa(p);
  };

  const chipsEstado: [Recorte, string, number][] = [
    ["todas", "Todas", totais.pessoas],
    ...ORDEM_ESTADOS.map((e) => [e, ROTULOS[e], estados[e]] as [Recorte, string, number]),
  ];
  // Rótulos curtos porque eles quebram em linha: "Estiveram na sala e não
  // falaram" ocupava sozinho a largura de um celular inteiro. A frase por
  // extenso continua existindo, logo abaixo, quando o recorte está escolhido.
  const chipsAtributo: [Recorte, string, number][] = [
    ["destacadas", "Destacadas", totais.destacadas],
    ["relato", "Escrevem", totais.escrevemRelato],
    ["mudos", "Caladas na sala", totais.mudos],
    ["seletivo", "Do seletivo", totais.doSeletivo],
    [
      "aprovado-ausente",
      "Aprovadas e ausentes",
      retrato.pessoas.filter((p) => p.seletivo?.aprovado && p.encontros === 0).length,
    ],
  ];
  const explicacaoDoRecorte =
    recorte === "todas"
      ? null
      : (ORDEM_ESTADOS as string[]).includes(recorte)
        ? definicao(recorte as EstadoPessoa, regras)
        : recorte === "destacadas"
          ? "Pessoas que você marcou com estrela. Elas aparecem aqui mesmo fora do período escolhido acima."
          : recorte === "relato"
            ? "Escreveram pelo menos um texto de mais de 200 caracteres no formulário. Abaixo disso costuma ser um elogio de uma palavra."
            : recorte === "mudos"
              ? "A captura do Meet viu essas pessoas na sala e elas não abriram o microfone nenhuma vez."
              : recorte === "seletivo"
                ? "Fizeram o processo seletivo. O casamento é por e-mail ou WhatsApp, nunca por nome."
                : "Passaram no seletivo e nunca apareceram em um grupo. É a fila de convite mais óbvia que existe.";

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

      {/* ── Período ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.03 }}>
        <SeletorJanela valor={janela} onChange={trocarJanela} desabilitado={recarregando} />
        <p className="font-dm text-[11px] text-cream/25 mt-2 leading-relaxed">
          Este seletor decide quem entra na lista. O que cada pessoa é, quantas vezes veio na vida
          e se escreve relato, continua vindo da história inteira dela. Núcleo, sumiço e coorte
          têm prazo próprio e não obedecem a este seletor.
        </p>
      </motion.div>

      {/* ── Movimento ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4" style={{ color: TEAL }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
              Movimento {periodoAberto ? "em toda a história" : `nos últimos ${rotuloPeriodo}`}
            </h2>
          </div>
          {/* Grade de duas colunas no celular e faixa livre a partir do tablet:
              com gap-x-10 e quebra livre, os quatro números caíam em 2, depois
              1, depois 1, e o último ficava órfão no meio do card. */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-8 sm:gap-x-10 gap-y-5">
            {[
              { r: "encontros de grupo", v: fluxo.encontros, c: undefined as string | undefined },
              { r: "pessoas participaram", v: fluxo.pessoas, c: TERRACOTA },
              { r: "vieram pela primeira vez", v: fluxo.estreantes, c: TEAL },
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
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Users className="h-4 w-4" style={{ color: TERRACOTA }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">Núcleo</h2>
            <JanelaPropria motivo={`${regras.janelaNucleoDias} dias, por definição`} />
          </div>
          <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
            {definicao("nucleo", regras)}
          </p>

          {/* Pular de uma coluna direto para o lg desperdiça o tablet: em 768px o card tem
              672px úteis, espaço de sobra para a coluna do número e a série lado a lado, e
              mesmo assim o número grande ficava sozinho numa faixa com a série empilhada
              embaixo. O sm entra com 170px, que é o que o número de três casas mais a frase
              curta pedem sem apertar. */}
          <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] lg:grid-cols-[210px_1fr] gap-4 sm:gap-6">
            <div>
              <p className="font-fraunces font-bold text-5xl tabular-nums leading-none" style={{ color: TERRACOTA }}>
                {nucleo.total}
              </p>
              <p className="font-dm text-xs text-cream/40 mt-2 leading-snug">
                {nucleo.total === 1 ? "pessoa" : "pessoas"} com {regras.barraNucleo} encontros ou
                mais em {regras.janelaNucleoDias} dias
              </p>
              {nucleo.aproximacao > 0 && (
                <button
                  onClick={() => setRecorte("chegando")}
                  className="font-dm text-[11px] mt-3 text-left leading-relaxed transition-colors hover:text-cream/60 inline-flex items-center min-h-[44px] sm:min-h-0 px-2 -mx-2"
                  style={{ color: TEAL }}
                >
                  {nucleo.aproximacao} {nucleo.aproximacao === 1 ? "pessoa está" : "pessoas estão"} chegando perto.
                  É daí que o núcleo cresce.
                </button>
              )}
            </div>

            <div>
              {/* Quatro pessoas não viram um número: viram quatro nomes. */}
              {nucleo.pessoas.length > 0 && nucleo.pessoas.length <= 25 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {nucleo.pessoas.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => abrirPessoa(p)}
                      className="font-dm text-xs px-2.5 py-1.5 rounded-full transition-colors hover:bg-white/[.05]"
                      style={{
                        color: "rgba(253,251,247,0.75)",
                        border: "1px solid rgba(200,75,49,0.25)",
                        background: "rgba(200,75,49,0.06)",
                      }}
                    >
                      {p.nome.split(" ").slice(0, 2).join(" ")}
                      <span className="text-cream/30 tabular-nums"> · {p.encontrosRecentes}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Os sete pontos somam uns 302px com gap-x-5, e um celular de 360px deixa
                  280px úteis dentro do card. O flex-wrap então joga justo o sétimo para a
                  linha de baixo, que é o mais recente e o único destacado. Série de sete
                  que quebra 6 mais 1 deixa de ser série: vira seis números e um número
                  solto, e a comparação entre quinzenas, que é a única leitura que a série
                  oferece, morre. Grid de sete colunas cabe sempre porque divide o que
                  existe em vez de exigir o que falta. Do sm para cima sobra largura e o
                  flex volta, que respira melhor. */}
              <div className="grid grid-cols-7 gap-x-1 items-end sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
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
              <p className="font-dm text-[11px] text-cream/30 mt-2 leading-relaxed">
                A série conta só o formulário: a captura da sala começou em agosto, e somá-la agora
                faria o último ponto subir por mudança de lente, não por mudança de vínculo.
              </p>
            </div>
          </div>

          {nucleo.frios > 0 && (
            <div
              className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-[10px]"
              style={{ background: "rgba(212,133,74,0.07)", border: "1px solid rgba(212,133,74,0.2)" }}
            >
              <p className="font-dm text-xs text-cream/70">
                {nucleo.frios} {nucleo.frios === 1 ? "dessa pessoa não aparece" : `dessas ${nucleo.total} não aparecem`} há {regras.diasSumiu} dias ou mais.
              </p>
              <a
                href="#sumiram"
                className="font-dm text-xs whitespace-nowrap inline-flex items-center min-h-[44px] sm:min-h-0 px-2 -mx-2"
                style={{ color: DOURADO }}
              >
                Ver os nomes
              </a>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ── Destacadas ── */}
      {retrato.destacadas.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
          <Card>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Star className="h-4 w-4" style={{ color: CORES_DESTAQUE.dourado }} fill={CORES_DESTAQUE.dourado} />
              <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                Você destacou
              </h2>
              <JanelaPropria motivo="sem prazo" />
            </div>
            <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
              As pessoas que você marcou com estrela, com a anotação que escreveu. Elas ficam aqui
              mesmo quando não aparecem no período escolhido acima.
            </p>
            <div className="space-y-1.5">
              {retrato.destacadas.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-2 px-3 py-2.5 rounded-[10px]"
                  style={{
                    background: `${CORES_DESTAQUE[p.destaque!.cor]}0F`,
                    border: `1px solid ${CORES_DESTAQUE[p.destaque!.cor]}40`,
                  }}
                >
                  <button onClick={() => abrirPessoa(p)} className="flex-1 min-w-0 text-left">
                    <p className="font-dm text-sm text-cream/85 truncate">{p.nome}</p>
                    {/* A anotação é texto livre de até 500 caracteres. Sem break-words, um
                        link colado sem espaço não tem onde quebrar, estoura a largura da
                        linha e faz a PÁGINA inteira rolar de lado, porque o main do painel
                        é overflow-y-auto e overflow-y automático implica overflow-x
                        automático. E sem limite de linhas os 500 caracteres viram umas
                        catorze linhas: uma pessoa só ocuparia três quartos da tela do
                        celular. No desktop a nota cabe inteira, então o corte só vale
                        enquanto a largura é pouca. */}
                    {p.destaque!.nota && (
                      <p className="font-dm text-xs text-cream/50 mt-0.5 leading-relaxed break-words line-clamp-3 sm:line-clamp-none">
                        {p.destaque!.nota}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      <Selo cor={CORES[p.estado]}>{ROTULOS[p.estado]}</Selo>
                      <Selo>{p.encontros} {p.encontros === 1 ? "encontro" : "encontros"}</Selo>
                      {p.diasSemAparecer != null && (
                        <Selo>{textoRecencia(p.diasSemAparecer)}</Selo>
                      )}
                    </div>
                  </button>
                  <Destaque
                    pessoaId={p.id}
                    nome={p.nome}
                    destaque={p.destaque}
                    onMudou={aplicarDestaque}
                  />
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Quem sumiu ── */}
      <motion.div id="sumiram" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <Card>
          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <UserMinus className="h-4 w-4" style={{ color: DOURADO }} />
              <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                Eram do núcleo e pararam de vir
              </h2>
              <JanelaPropria motivo={`${regras.diasSumiu} dias, por definição`} />
            </div>
            <span className="font-dm text-xs text-cream/30">
              {sumidos.semSinal.length + sumidos.soFormulario.length} pessoas
            </span>
          </div>
          <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
            Chegaram a {regras.barraNucleo} encontros ou mais em toda a história e estão há{" "}
            {regras.diasSumiu} dias sem dar sinal.
          </p>

          {sumidos.semSinal.length === 0 && sumidos.soFormulario.length === 0 ? (
            <p className="font-dm text-xs text-cream/30 py-6 text-center">
              Ninguém nessa situação. Todas apareceram nos últimos {regras.diasSumiu} dias.
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
                      <LinhaSumido
                        key={p.id}
                        p={p}
                        onClick={() => abrirPessoa(p)}
                        onDestaque={aplicarDestaque}
                      />
                    ))}
                  </div>
                  {sumidos.semSinal.length > 4 && (
                    <button
                      onClick={() => setVerTodosSumidos((v) => !v)}
                      className="font-dm text-xs mt-2 inline-flex items-center min-h-[44px] sm:min-h-0 px-2 -mx-2"
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
                      <LinhaSumido
                        key={p.id}
                        p={p}
                        onClick={() => abrirPessoa(p)}
                        onDestaque={aplicarDestaque}
                      />
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
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Repeat className="h-4 w-4" style={{ color: TEAL }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
              Quem veio pela primeira vez e voltou
            </h2>
            <JanelaPropria motivo="por mês de estreia" />
          </div>
          <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
            De cada grupo que estreou num mês, quantas pessoas apareceram de novo depois. O mês
            corrente fica de fora: quem estreou anteontem ainda não teve tempo de voltar.
          </p>

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
                      {/* O piso do percentual vem da régua, e não de um 30 solto
                          aqui: era o sétimo limiar espalhado pelo painel. */}
                      {atende(c.estreantes, REGUA.percentual) && (
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
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <GraduationCap className="h-4 w-4" style={{ color: ROXO }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
              Processo seletivo
            </h2>
            <JanelaPropria motivo="tem data própria" />
          </div>
          <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
            Cada candidato é ligado a uma pessoa pelo e-mail ou pelo WhatsApp, nunca pelo nome.
          </p>

          {seletivo.candidatos === 0 ? (
            <p className="font-dm text-xs text-cream/30 py-4 leading-relaxed">
              Nenhum candidato importado ainda. Solte abaixo o CSV completo do AvaliAllos e o
              seletivo passa a aparecer aqui e ao lado de cada pessoa.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 sm:gap-x-8 gap-y-5 mb-5">
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

              <div
                className="px-4 py-3 rounded-[10px] mb-4"
                style={{ background: "rgba(108,92,231,0.06)", border: "1px solid rgba(108,92,231,0.2)" }}
              >
                <p className="font-dm text-sm text-cream/80">
                  {seletivo.aprovadosQueVieram.length} de {seletivo.aprovados} aprovados
                  {seletivo.aprovadosQueVieram.length === 1 ? " apareceu" : " apareceram"} em algum grupo.
                </p>
                {seletivo.aprovadosQueVieram.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {seletivo.aprovadosQueVieram.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => abrirPessoa(p)}
                        className="font-dm text-[11px] transition-colors hover:text-cream inline-flex items-center min-h-[44px] sm:min-h-0 px-2 py-1.5 rounded-full"
                        style={{ color: TEAL }}
                      >
                        {p.nome} <span className="text-cream/25">({p.encontros}x)</span>
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
                      className="font-dm text-xs mt-2 inline-flex items-center min-h-[44px] sm:min-h-0 px-2 -mx-2"
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
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-4 sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
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

      {/* ── A avaliação clínica ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
        <BlocoClinica aoAbrirPessoa={abrirPessoaPorId} />
      </motion.div>

      {/* ── A lista ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 min-w-0">
              {periodoAberto ? "Todas as pessoas" : `Quem deu sinal nos últimos ${rotuloPeriodo}`}
            </h2>
            <span className="font-dm text-xs text-cream/30 tabular-nums flex-shrink-0 whitespace-nowrap">
              {filtradas.length === totais.pessoas ? totais.pessoas : `${filtradas.length} de ${totais.pessoas}`}
            </span>
          </div>
          {!periodoAberto && (
            <p className="font-dm text-[11px] text-cream/25 mb-3">
              {totais.pessoas} de {totais.pessoasNaBase} pessoas que a base conhece.
            </p>
          )}

          <div className="relative mb-4 mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="dark-input w-full rounded-[10px] pl-9 pr-3 py-2.5 font-dm text-base md:text-sm"
            />
          </div>

          {/* Ordenação: botões, e não um seletor escondido. É a pergunta que muda,
              e perguntar "quem vem mais" precisa custar um clique. */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="font-dm text-[11px] text-cream/25">Ordenar por</span>
            {ORDENS.map((o) => {
              const ativo = ordem === o.chave;
              return (
                <button
                  key={o.chave}
                  onClick={() => setOrdem(o.chave)}
                  className="font-dm text-[11px] px-2.5 py-1.5 rounded-full transition-all min-h-[40px] sm:min-h-0"
                  style={{
                    backgroundColor: ativo ? "rgba(253,251,247,0.08)" : "transparent",
                    color: ativo ? "rgba(253,251,247,0.8)" : "rgba(253,251,247,0.35)",
                    border: `1px solid ${ativo ? "rgba(253,251,247,0.15)" : "rgba(255,255,255,0.05)"}`,
                  }}
                >
                  {o.rotulo}
                </button>
              );
            })}
          </div>

          {/* Estados: um por pessoa, e a cor é a mesma que pinta a linha.
              Quebram em linha em vez de rolar: são nove, e com rolagem
              escondida num celular de 390px apareciam dois. Um recorte que
              ninguém enxerga é um recorte que não existe. */}
          <div className="flex flex-wrap gap-2 mb-2">
            {chipsEstado
              .filter(([k, , n]) => n > 0 || recorte === k || k === "todas")
              .map(([k, label, n]) => {
                const ativo = recorte === k;
                const cor = k === "todas" ? TERRACOTA : CORES[k as EstadoPessoa];
                return (
                  <button
                    key={k}
                    onClick={() => setRecorte(k)}
                    className="font-dm text-xs px-3 py-2 rounded-full whitespace-nowrap transition-all min-h-[36px] flex items-center gap-1.5"
                    style={{
                      backgroundColor: ativo ? `${cor}22` : "rgba(255,255,255,0.03)",
                      color: ativo ? cor : "rgba(253,251,247,0.4)",
                      border: `1px solid ${ativo ? `${cor}55` : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: cor, opacity: ativo ? 1 : 0.5 }}
                    />
                    {label}
                    <span className="opacity-60 tabular-nums">{n}</span>
                  </button>
                );
              })}
          </div>

          {/* Atributos: cruzam com qualquer estado, então vêm numa linha própria. */}
          <div className="flex flex-wrap gap-2 mb-3">
            {chipsAtributo
              .filter(([k, , n]) => n > 0 || recorte === k)
              .map(([k, label, n]) => {
                const ativo = recorte === k;
                return (
                  <button
                    key={k}
                    onClick={() => setRecorte(k)}
                    className="font-dm text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 min-h-[40px] sm:min-h-0"
                    style={{
                      backgroundColor: ativo ? "rgba(253,251,247,0.08)" : "transparent",
                      color: ativo ? "rgba(253,251,247,0.8)" : "rgba(253,251,247,0.33)",
                      border: `1px solid ${ativo ? "rgba(253,251,247,0.18)" : "rgba(255,255,255,0.05)"}`,
                    }}
                  >
                    {k === "destacadas" && (
                      <Star className="h-3 w-3" style={{ color: CORES_DESTAQUE.dourado }} fill={CORES_DESTAQUE.dourado} />
                    )}
                    {label}
                    <span className="opacity-60 tabular-nums">{n}</span>
                  </button>
                );
              })}
          </div>

          {explicacaoDoRecorte && (
            <p className="font-dm text-[11px] text-cream/35 mb-4 leading-relaxed">
              {explicacaoDoRecorte}
            </p>
          )}

          {filtradas.length === 0 ? (
            <p className="font-dm text-xs text-cream/30 py-8 text-center">
              {busca ? "Nenhuma pessoa com esse nome ou e-mail." : "Nenhuma pessoa nesse recorte."}
            </p>
          ) : (
            <>
              <div className="space-y-1">
                {filtradas.slice(0, mostrando).map((p) => (
                  <LinhaPessoa
                    key={p.id}
                    p={p}
                    onClick={() => abrirPessoa(p)}
                    onDestaque={aplicarDestaque}
                  />
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

      {/* ── Glossário ── */}
      <button
        onClick={() => setGlossarioAberto((v) => !v)}
        className="flex items-center gap-1.5 font-dm text-[11px] text-cream/30 hover:text-cream/50 transition-colors min-h-[44px] sm:min-h-0"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${glossarioAberto ? "rotate-180" : ""}`} />
        O que cada palavra desta tela quer dizer
      </button>
      {glossarioAberto && (
        <div className="space-y-2 pl-5 pb-4">
          <p className="font-dm text-[11px] text-cream/45 leading-relaxed">
            <strong className="text-cream/70">Encontro</strong>: uma vez que a pessoa participou de
            um grupo. Vale tanto o formulário que ela preencheu quanto o nome dela capturado na
            sala do Meet. Se os dois acontecem no mesmo dia e no mesmo grupo, contam um.
          </p>
          {ORDEM_ESTADOS.map((e) => (
            <p key={e} className="font-dm text-[11px] text-cream/45 leading-relaxed">
              <strong style={{ color: CORES[e] }}>{ROTULOS[e]}</strong>: {definicao(e, regras)}
            </p>
          ))}
          <p className="font-dm text-[11px] text-cream/45 leading-relaxed">
            <strong className="text-cream/70">Relato escrito</strong>: texto com mais de 200
            caracteres no formulário. Abaixo disso costuma ser um elogio de uma palavra.
          </p>
          <p className="font-dm text-[11px] text-cream/45 leading-relaxed">
            <strong className="text-cream/70">Estrela</strong>: marca que você põe à mão. Não é
            calculada e não expira. A cor é sua para significar o que quiser.
          </p>
          <p className="font-dm text-[11px] text-cream/45 leading-relaxed">
            <strong className="text-cream/70">De onde vem o que a tela diz</strong>: os selos de
            cada pessoa são a procedência dela, e cada um aponta uma fonte diferente. Relato escrito
            e nota vêm do formulário de certificado. Falou na sala e nunca preencheu o formulário
            vêm da captura do Meet, que começou em 3 de agosto. Aulas e horas estudando vêm da
            plataforma de cursos. Seletivo vem do CSV importado ali em cima. E a nota clínica vem do
            AvaliAllos, que é outro sistema e casa por telefone. Quanto mais selos, mais fontes
            conhecem aquela pessoa; onde ela participa mais é onde o número do selo é maior.
          </p>
          <p className="font-dm text-[11px] text-cream/45 leading-relaxed">
            <strong className="text-cream/70">Nunca preencheu o formulário</strong>: a sala do Meet
            viu essa pessoa e o formulário nunca. Ela existe, vem, e não entra em nenhuma média
            tirada do formulário. O formulário pega cerca de metade de quem esteve na sala, e não
            por sorteio: preencher é hábito de pessoa.
          </p>
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

function textoRecencia(dias: number): string {
  if (dias === 0) return "veio hoje";
  if (dias === 1) return "veio ontem";
  if (dias < 30) return `veio há ${dias} dias`;
  if (dias < 60) return "veio há mais de um mês";
  if (dias < 365) return `veio há ${Math.floor(dias / 30)} meses`;
  return "veio há mais de um ano";
}

function Selo({ children, cor }: { children: React.ReactNode; cor?: string }) {
  return (
    <span className="font-dm text-[10px] tabular-nums" style={{ color: cor ?? "rgba(253,251,247,0.3)" }}>
      {children}
    </span>
  );
}

/**
 * A linha da lista.
 *
 * A cor da borda esquerda é o estado, e ela some por baixo do destaque quando a
 * pessoa está marcada: entre o que o sistema calculou e o que você decidiu, o
 * que você decidiu ganha a tela.
 */
function LinhaPessoa({
  p,
  onClick,
  onDestaque,
}: {
  p: PessoaLinha;
  onClick: () => void;
  onDestaque: (m: MudancaDestaque) => void;
}) {
  const corEstado = CORES[p.estado];
  const corDestaque = p.destaque ? CORES_DESTAQUE[p.destaque.cor] : null;
  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 rounded-[10px] transition-colors hover:bg-white/[.03]"
      style={{
        background: corDestaque ? `${corDestaque}0F` : "rgba(255,255,255,0.02)",
        border: `1px solid ${corDestaque ? `${corDestaque}40` : "rgba(255,255,255,0.05)"}`,
        borderLeft: `3px solid ${corDestaque ?? corEstado}`,
      }}
    >
      {/* O número vem ANTES do nome, numa coluna estreita e alinhada.
          Encostado na borda direita ele obrigava o olho a atravessar meia tela
          vazia num monitor largo, e a coluna deixava de servir para comparar
          uma linha com a outra, que é a única razão de o número ser coluna. */}
      <button onClick={onClick} className="flex items-start gap-3 flex-1 min-w-0 text-left">
        <div className="flex-shrink-0 w-11 text-right pt-0.5">
          <p className="font-fraunces font-bold text-base tabular-nums leading-none" style={{ color: corEstado }}>
            {p.encontros}
          </p>
          <p className="font-dm text-[9px] text-cream/25 leading-tight mt-0.5">
            {p.encontros === 1 ? "encontro" : "encontros"}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-dm text-sm text-cream/85 truncate">{p.nome}</p>
          <p className="font-dm text-[11px] text-cream/25 truncate">{p.email ?? "sem e-mail"}</p>
        {/* Mesma razão da nota em "Você destacou": texto livre de 500 caracteres quebra
            dentro da palavra para não empurrar a página de lado, e para de crescer em três
            linhas enquanto a tela é estreita. */}
        {p.destaque?.nota && (
          <p className="font-dm text-xs text-cream/55 mt-1 leading-relaxed break-words line-clamp-3 sm:line-clamp-none">
            {p.destaque.nota}
          </p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
          <Selo cor={corEstado}>{ROTULOS[p.estado]}</Selo>
          {p.diasSemAparecer != null && <Selo>{textoRecencia(p.diasSemAparecer)}</Selo>}
          {p.atividades > 1 && <Selo>{p.atividades} grupos diferentes</Selo>}
          {p.relatosLongos > 0 && (
            <Selo cor={DOURADO}>
              {p.relatosLongos} {p.relatosLongos > 1 ? "relatos escritos" : "relato escrito"}
            </Selo>
          )}
          {p.aulas > 0 && (
            <Selo>
              {p.aulas} {p.aulas === 1 ? "aula" : "aulas"}
              {p.horasPlataforma > 0 && ` · ${p.horasPlataforma}h estudando`}
            </Selo>
          )}
          {/* Matriculada e nunca abriu é o caso mais comum da base: 205 dos 277
              alunos nunca concluíram uma aula. Por isso o selo destaca esse
              estado em vez de só contar matrícula. */}
          {p.matriculas > 0 && (
            <Selo cor={p.aulas === 0 ? DOURADO : undefined}>
              {p.matriculas} {p.matriculas === 1 ? "matrícula" : "matrículas"}
              {p.matriculasConcluidas > 0 && `, ${p.matriculasConcluidas} concluída${p.matriculasConcluidas > 1 ? "s" : ""}`}
              {p.aulas === 0 && " · nunca abriu"}
            </Selo>
          )}
          {p.encontrosNaSala > 0 && (
            <Selo cor={ROXO}>
              {p.turnosFala > 0 ? `falou ${p.turnosFala}x na sala` : "esteve na sala e não falou"}
            </Selo>
          )}
          {/* Procedência, e só quando ela muda alguma coisa. A sala viu a pessoa
              e o formulário nunca: é gente que aparece toda semana e não conta
              para nenhum número tirado do formulário. O contrário, declarar sem
              a sala ver, não vira selo porque a captura só começou em agosto e
              quase toda a base antiga cairia nele sem significar nada. */}
          {p.encontrosNaSala > 0 && p.ultimoFormulario == null && (
            <Selo cor={ROXO}>nunca preencheu o formulário</Selo>
          )}
          {p.seletivo && (
            <Selo cor={p.seletivo.aprovado ? TEAL : "rgba(253,251,247,0.3)"}>
              seletivo {p.seletivo.nota ?? ""}
              {p.seletivo.aprovado ? ", aprovada" : p.seletivo.status ? `, ${p.seletivo.status.toLowerCase()}` : ""}
            </Selo>
          )}
          {!p.temConta && <Selo>sem conta na plataforma</Selo>}
        </div>
        </div>
      </button>
      <Destaque pessoaId={p.id} nome={p.nome} destaque={p.destaque} onMudou={onDestaque} />
    </div>
  );
}

function LinhaSumido({
  p,
  onClick,
  onDestaque,
}: {
  p: PessoaLinha;
  onClick: () => void;
  onDestaque: (m: MudancaDestaque) => void;
}) {
  const corDestaque = p.destaque ? CORES_DESTAQUE[p.destaque.cor] : null;
  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 rounded-[10px] transition-colors hover:bg-white/[.03]"
      style={{
        background: corDestaque ? `${corDestaque}0F` : "rgba(255,255,255,0.02)",
        border: `1px solid ${corDestaque ? `${corDestaque}40` : "rgba(255,255,255,0.05)"}`,
      }}
    >
      <button onClick={onClick} className="flex items-start gap-3 flex-1 min-w-0 text-left">
        <div className="flex-shrink-0 w-11 text-right pt-0.5">
          <p className="font-fraunces font-bold text-base tabular-nums leading-none text-cream/70">
            {p.encontros}
          </p>
          <p className="font-dm text-[9px] text-cream/25 leading-tight mt-0.5">encontros</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-dm text-sm text-cream/85 truncate">{p.nome}</p>
          <p className="font-dm text-[11px] text-cream/25 truncate">{p.email ?? "sem e-mail"}</p>
          {/* Mesma razão da nota em "Você destacou": texto livre de 500 caracteres quebra
              dentro da palavra para não empurrar a página de lado, e para de crescer em três
              linhas enquanto a tela é estreita. */}
          {p.destaque?.nota && (
            <p className="font-dm text-xs text-cream/55 mt-1 leading-relaxed break-words line-clamp-3 sm:line-clamp-none">
              {p.destaque.nota}
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            <Selo cor={DOURADO}>{textoRecencia(p.diasSemAparecer ?? 0)}</Selo>
            {p.ultimoMeet && (
              <Selo cor={ROXO}>
                visto na sala em{" "}
                {new Date(p.ultimoMeet).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </Selo>
            )}
          </div>
        </div>
      </button>
      <Destaque pessoaId={p.id} nome={p.nome} destaque={p.destaque} onMudou={onDestaque} />
    </div>
  );
}
