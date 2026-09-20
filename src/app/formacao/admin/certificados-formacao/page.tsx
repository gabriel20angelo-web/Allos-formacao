"use client";

/**
 * Horas de formação: quem acumulou o quê, e o certificado que existe por isso.
 *
 * A tela era uma caixa de busca: digitava-se um nome, e o que voltasse era o
 * que havia. Três coisas quebravam aí, e as três apareceram no mesmo caso real,
 * em 20/09/2026. A Paula tinha onze participações e vinte e duas horas; a tela
 * mostrava duas, e o certificado oferecido a ela era de duas horas.
 *
 * 1. **O resgate escondia o histórico.** A busca filtrava as participações
 *    marcadas como resgatadas, e o botão de resgatar marcava todas de uma vez.
 *    Quem resgatava sumia da tela, e o vazio se lia como "essa pessoa nunca
 *    participou". Aqui nada é escondido: o acumulado é a vida inteira da pessoa.
 * 2. **Procurar exigia acertar o nome.** Agora a lista chega inteira e a busca
 *    filtra dentro dela, por nome ou e-mail, com quem tem mais horas na frente.
 * 3. **Somar por nome dava o total errado nos dois sentidos.** O agrupamento é
 *    por e-mail, que é a única chave forte da tabela, e quando duas contas usam
 *    o mesmo nome a tela avisa em vez de juntar sozinha.
 *
 * Emitir passou a ser server-side (`/formacao/api/admin/horas-formacao`) e usa
 * a mesma chave do formulário público, para que a mesma pessoa não termine com
 * dois certificados válidos das mesmas horas, um por porta de entrada.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, Award, FileCheck, User, Clock, ShieldCheck, AlertTriangle } from "lucide-react";
import type { PessoaHoras, CertificadoRegistrado } from "@/lib/certificados/horas";

const CertificateGenerator = dynamic(
  () => import("@/components/certificado/CertificateGenerator"),
  { ssr: false },
);

const HORAS_MINIMO = 20;

type Filtro = "todos" | "liberados" | "sem-certificado" | "com-certificado";
type Ordem = "horas" | "recentes" | "nome";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todas" },
  { id: "liberados", label: `${HORAS_MINIMO}h ou mais` },
  { id: "sem-certificado", label: "Sem certificado" },
  { id: "com-certificado", label: "Com certificado" },
];

const ORDENS: { id: Ordem; label: string }[] = [
  { id: "horas", label: "Mais horas" },
  { id: "recentes", label: "Participação recente" },
  { id: "nome", label: "Nome" },
];

function horasExtenso(h: number): string {
  const unidades = [
    "zero", "uma", "duas", "três", "quatro",
    "cinco", "seis", "sete", "oito", "nove",
  ];
  const especiais = [
    "dez", "onze", "doze", "treze", "quatorze",
    "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
  ];
  const dezenas = [
    "", "", "vinte", "trinta", "quarenta",
    "cinquenta", "sessenta", "setenta", "oitenta", "noventa",
  ];

  if (h < 0) return "zero";
  if (h < 10) return unidades[h];
  if (h < 20) return especiais[h - 10];
  if (h < 100) {
    const d = Math.floor(h / 10);
    const u = h % 10;
    return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`;
  }
  if (h === 100) return "cem";
  if (h < 200) return `cento e ${horasExtenso(h - 100)}`;
  return String(h);
}

function normalizar(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function dataCurta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}/${a.slice(2)}` : iso;
}

export default function AdminCertificadosFormacaoPage() {
  const { isAdmin } = useAuth();
  const [pessoas, setPessoas] = useState<PessoaHoras[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [ordem, setOrdem] = useState<Ordem>("horas");
  const [aberta, setAberta] = useState<string | null>(null);
  const [emitindo, setEmitindo] = useState(false);
  const [mostrarPdfs, setMostrarPdfs] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/formacao/api/admin/horas-formacao", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error || "Não foi possível carregar as horas.");
        setPessoas([]);
      } else {
        setPessoas(json.pessoas || []);
      }
    } catch {
      setErro("Erro de rede ao carregar as horas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) carregar();
  }, [isAdmin, carregar]);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    let lista = pessoas;

    if (termo) {
      lista = lista.filter(
        (p) =>
          normalizar(p.nome).includes(termo) ||
          (p.email ? p.email.includes(termo) : false) ||
          p.nomesUsados.some((n) => normalizar(n).includes(termo)),
      );
    }

    if (filtro === "liberados") lista = lista.filter((p) => p.totalHoras >= HORAS_MINIMO);
    if (filtro === "sem-certificado") lista = lista.filter((p) => p.certificados.length === 0);
    if (filtro === "com-certificado") lista = lista.filter((p) => p.certificados.length > 0);

    const ordenada = [...lista];
    if (ordem === "horas") ordenada.sort((a, b) => b.totalHoras - a.totalHoras);
    if (ordem === "recentes") ordenada.sort((a, b) => b.ultima.localeCompare(a.ultima));
    if (ordem === "nome") ordenada.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return ordenada;
  }, [pessoas, busca, filtro, ordem]);

  const pessoaAberta = useMemo(
    () => pessoas.find((p) => p.identificador === aberta) || null,
    [pessoas, aberta],
  );

  const resumo = useMemo(() => {
    const liberadas = pessoas.filter((p) => p.totalHoras >= HORAS_MINIMO).length;
    const comCertificado = pessoas.filter((p) => p.certificados.length > 0).length;
    const horas = pessoas.reduce((s, p) => s + p.totalHoras, 0);
    return { total: pessoas.length, liberadas, comCertificado, horas };
  }, [pessoas]);

  const emitir = useCallback(async () => {
    if (!pessoaAberta) return;
    setEmitindo(true);
    try {
      const res = await fetch("/formacao/api/admin/horas-formacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificador: pessoaAberta.identificador }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Não foi possível emitir.");
        return;
      }
      const emitidos: CertificadoRegistrado[] = json.emitidos || [];
      setPessoas((prev) =>
        prev.map((p) =>
          p.identificador === pessoaAberta.identificador ? { ...p, certificados: emitidos } : p,
        ),
      );
      setMostrarPdfs(true);
      toast.success("Certificados registrados. Agora eles têm código de verificação.");
    } catch {
      toast.error("Erro de rede ao emitir.");
    } finally {
      setEmitindo(false);
    }
  }, [pessoaAberta]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-dm text-cream/50">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const codigoDe = (atividade: string): string | undefined =>
    pessoaAberta?.certificados.find((c) => c.atividade === atividade && !c.anulado)?.codigo;

  return (
    <div className="max-w-5xl space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="font-fraunces text-2xl font-bold text-cream tracking-tight">
          Horas de formação
        </h1>
        <p className="font-dm text-sm text-cream/50 max-w-2xl leading-snug">
          Todo mundo que já registrou participação, com o que acumulou desde a primeira vez. A
          partir de {HORAS_MINIMO} horas o certificado pode ser emitido — e continua valendo depois:
          participar de novo soma no mesmo documento, que mantém o código.
        </p>
      </motion.div>

      {/* Resumo */}
      {!loading && pessoas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Pessoas", valor: String(resumo.total) },
            { label: `Com ${HORAS_MINIMO}h ou mais`, valor: String(resumo.liberadas) },
            { label: "Com certificado", valor: String(resumo.comCertificado) },
            { label: "Horas somadas", valor: `${resumo.horas}h` },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-[14px] p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="font-fraunces text-xl font-bold text-cream">{c.valor}</p>
              <p className="font-dm text-xs text-cream/50 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Busca e filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/40" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome ou e-mail..."
            className="w-full dark-input rounded-[10px] py-2.5 pl-10 pr-4 font-dm text-sm"
            aria-label="Buscar pessoa por nome ou e-mail"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className="font-dm text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: filtro === f.id ? "rgba(46,158,143,0.14)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${filtro === f.id ? "rgba(46,158,143,0.35)" : "rgba(255,255,255,0.06)"}`,
                color: filtro === f.id ? "#2E9E8F" : "rgba(247,243,238,0.55)",
              }}
            >
              {f.label}
            </button>
          ))}
          <span className="mx-1 self-center text-cream/15">|</span>
          {ORDENS.map((o) => (
            <button
              key={o.id}
              onClick={() => setOrdem(o.id)}
              className="font-dm text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: ordem === o.id ? "rgba(200,75,49,0.14)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${ordem === o.id ? "rgba(200,75,49,0.35)" : "rgba(255,255,255,0.06)"}`,
                color: ordem === o.id ? "#C84B31" : "rgba(247,243,238,0.55)",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {erro && (
        <div
          className="rounded-[14px] p-4 font-dm text-sm text-cream/70"
          style={{ background: "rgba(200,75,49,0.08)", border: "1px solid rgba(200,75,49,0.25)" }}
        >
          {erro}
        </div>
      )}

      {/* Lista */}
      {!loading && !erro && (
        <div className="space-y-2">
          <p className="font-dm text-xs text-cream/40">
            {filtradas.length} {filtradas.length === 1 ? "pessoa" : "pessoas"}
          </p>

          {filtradas.length === 0 && (
            <div
              className="rounded-[14px] p-8 text-center"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <User className="mx-auto mb-3 h-10 w-10 text-cream/15" />
              <p className="font-dm text-sm text-cream/50">
                Ninguém corresponde a esta busca.
              </p>
            </div>
          )}

          {filtradas.map((p) => {
            const liberado = p.totalHoras >= HORAS_MINIMO;
            const selecionada = p.identificador === aberta;
            return (
              <div key={p.identificador}>
                <button
                  onClick={() => {
                    setAberta(selecionada ? null : p.identificador);
                    setMostrarPdfs(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-[12px] text-left transition-colors hover:bg-white/5"
                  style={{
                    background: selecionada ? "rgba(46,158,143,0.08)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${selecionada ? "rgba(46,158,143,0.25)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-dm text-sm text-cream/90 block truncate">{p.nome}</span>
                    <span className="font-dm text-xs text-cream/45 block truncate">
                      {p.email ?? "sem e-mail"}
                      {p.outrosEmails.length > 0 && " · nome repetido em outra conta"}
                    </span>
                  </div>

                  {p.certificados.length > 0 && (
                    <span
                      className="hidden sm:inline-flex items-center gap-1 font-dm text-[11px] px-2 py-1 rounded-full shrink-0"
                      style={{ background: "rgba(46,158,143,0.12)", color: "#2E9E8F" }}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {p.certificados.length}
                    </span>
                  )}

                  <span className="font-dm text-xs text-cream/40 shrink-0 hidden md:block">
                    {dataCurta(p.ultima)}
                  </span>

                  <span
                    className="font-dm text-sm font-semibold shrink-0 w-16 text-right"
                    style={{ color: liberado ? "#2E9E8F" : "rgba(247,243,238,0.55)" }}
                  >
                    {p.totalHoras}h
                  </span>
                </button>

                {/* Ficha */}
                <AnimatePresence>
                  {selecionada && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="mt-2 mb-4 rounded-[14px] p-5 space-y-5"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-dm text-xs text-cream/50">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {p.totalHoras}h em {p.participacoes}{" "}
                            {p.participacoes === 1 ? "participação" : "participações"}
                          </span>
                          <span>
                            de {dataCurta(p.primeira)} a {dataCurta(p.ultima)}
                          </span>
                          {!liberado && (
                            <span style={{ color: "#C84B31" }}>
                              faltam {HORAS_MINIMO - p.totalHoras}h para emitir
                            </span>
                          )}
                        </div>

                        {p.nomesUsados.length > 1 && (
                          <p className="font-dm text-xs text-cream/45 leading-relaxed">
                            Assinou de mais de um jeito: {p.nomesUsados.join(" · ")}. O certificado
                            sai com o nome mais completo.
                          </p>
                        )}

                        {p.outrosEmails.length > 0 && (
                          <div
                            className="rounded-[10px] p-3 flex gap-2.5"
                            style={{
                              background: "rgba(200,75,49,0.07)",
                              border: "1px solid rgba(200,75,49,0.2)",
                            }}
                          >
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#C84B31" }} />
                            <p className="font-dm text-xs text-cream/60 leading-relaxed">
                              Este nome também aparece em {p.outrosEmails.join(", ")}. As horas de
                              cada conta são contadas à parte — pode ser a mesma pessoa com dois
                              e-mails, e pode ser homônima. Confira antes de emitir.
                            </p>
                          </div>
                        )}

                        {/* Por atividade */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left font-dm text-sm min-w-[520px]">
                            <thead style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                              <tr>
                                <th className="px-2 py-2 font-semibold text-cream/60">Atividade</th>
                                <th className="px-2 py-2 font-semibold text-cream/60">Presenças</th>
                                <th className="px-2 py-2 font-semibold text-cream/60">Horas</th>
                                <th className="px-2 py-2 font-semibold text-cream/60">Período</th>
                                <th className="px-2 py-2 font-semibold text-cream/60">Código</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(p.porAtividade).map(([atividade, info]) => {
                                const cert = p.certificados.find((c) => c.atividade === atividade);
                                return (
                                  <tr
                                    key={atividade}
                                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                                  >
                                    <td className="px-2 py-2 text-cream/90">{atividade}</td>
                                    <td className="px-2 py-2 text-cream/60">{info.count}</td>
                                    <td className="px-2 py-2 text-cream/60">{info.horas}h</td>
                                    <td className="px-2 py-2 text-cream/45 text-xs">
                                      {info.dataInicio === info.dataFim
                                        ? dataCurta(info.dataInicio)
                                        : `${dataCurta(info.dataInicio)} a ${dataCurta(info.dataFim)}`}
                                    </td>
                                    <td className="px-2 py-2 text-xs font-mono">
                                      {cert ? (
                                        <span style={{ color: cert.anulado ? "#C84B31" : "#2E9E8F" }}>
                                          {cert.codigo}
                                          {cert.anulado ? " (anulado)" : ""}
                                        </span>
                                      ) : (
                                        <span className="text-cream/25">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {p.marcadasResgatadas > 0 && (
                          <p className="font-dm text-xs text-cream/35 leading-relaxed">
                            {p.marcadasResgatadas} destas participações foram marcadas pelo resgate
                            antigo, que zerava o contador. Elas continuam valendo: o acumulado acima
                            já as inclui.
                          </p>
                        )}

                        {liberado && (
                          <div className="flex flex-wrap gap-3">
                            <Button onClick={emitir} disabled={emitindo}>
                              <FileCheck className="mr-2 h-4 w-4" />
                              {emitindo
                                ? "Registrando..."
                                : p.certificados.length > 0
                                  ? "Atualizar certificados"
                                  : "Emitir certificados"}
                            </Button>
                            <Button variant="secondary" onClick={() => setMostrarPdfs((v) => !v)}>
                              <Award className="mr-2 h-4 w-4" />
                              {mostrarPdfs ? "Ocultar PDFs" : "Ver e baixar PDFs"}
                            </Button>
                          </div>
                        )}

                        {liberado && (
                          <p className="font-dm text-xs text-cream/45 leading-relaxed max-w-2xl">
                            {p.certificados.length > 0
                              ? "Os PDFs saem com o código impresso no rodapé, e quem recebe pode conferir em /formacao/certificado/verificar."
                              : "Emitir é o que cria o código de verificação. Antes disso o PDF é rascunho e não pode ser conferido por ninguém."}
                          </p>
                        )}

                        <AnimatePresence>
                          {mostrarPdfs && liberado && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-6 overflow-hidden"
                            >
                              {Object.entries(p.porAtividade).map(([atividade, info]) => (
                                <div
                                  key={atividade}
                                  className="rounded-[12px] p-4"
                                  style={{
                                    background: "rgba(255,255,255,0.02)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                  }}
                                >
                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="font-fraunces text-sm font-semibold text-cream">
                                      {atividade}
                                    </h3>
                                    {codigoDe(atividade) && (
                                      <span
                                        className="font-dm text-[11px] font-mono"
                                        style={{ color: "#2E9E8F" }}
                                      >
                                        {codigoDe(atividade)}
                                      </span>
                                    )}
                                  </div>
                                  <CertificateGenerator
                                    data={{
                                      nomeParticipante: p.nome,
                                      atividade,
                                      data: info.dataInicio,
                                      dataFim: info.dataFim,
                                      cargaHoraria: info.horas,
                                      cargaHorariaExtenso: horasExtenso(info.horas),
                                      codigo: codigoDe(atividade),
                                    }}
                                  />
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
