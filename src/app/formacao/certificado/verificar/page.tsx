// Verificador público de autenticidade de certificado (Termos de Uso, 8.3).
//
// A cláusula 8.3 promete um endereço onde qualquer pessoa confere, pelo código,
// se o documento é autêntico, se está válido e se foi anulado. Esta é a página
// dessa promessa, e por isso ela não pede login: quem verifica é o empregador, a
// instituição de ensino ou o órgão de classe que recebeu o certificado, gente
// que não tem conta aqui.
//
// A consulta é feita pelo navegador de quem verifica, contra
// /formacao/api/verificar-certificado. Ela não roda no servidor de propósito: o
// rate limit da rota é por IP, e se a página consultasse do lado do servidor
// todos os visitantes chegariam com o mesmo endereço e um único robô derrubaria
// a verificação para todo mundo.
//
// Consequência disso: sendo um client component, o arquivo não pode exportar
// `metadata` (o Next 14 recusa o export em módulo com "use client"). O título e
// a descrição são aplicados no documento pelo efeito abaixo. Para ter metadata
// estática de verdade, esta página precisa virar server component e o formulário
// sair para um arquivo próprio de client component.

"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, Ban, FileQuestion, Search, ShieldCheck } from "lucide-react";

const TITULO_PAGINA = "Verificar certificado | Formação Allos";
const DESCRICAO_PAGINA =
  "Confira pelo código se um certificado da Associação Allos é autêntico, se está válido e se foi anulado.";

type Situacao = "valido" | "anulado" | "nao_encontrado";

interface Resultado {
  situacao: Situacao;
  codigo?: string;
  titular?: string;
  curso?: string;
  carga_horaria?: number | null;
  emitido_em?: string;
  anulado_em?: string | null;
  anulado_motivo?: string | null;
  /** curso, formacao ou avulso. */
  tipo?: string;
  /** Rótulo pronto do tipo, escrito pela rota para quem lê a tela. */
  tipo_documento?: string;
}

/**
 * Como chamar aquilo a que o documento se refere.
 *
 * "Curso" está certo para o certificado de curso e errado para os outros dois:
 * o de formação atesta participação nas atividades e a declaração avulsa não
 * tem curso nenhum por trás. Quem confere precisa entender o que tem em mãos.
 */
function rotuloDoObjeto(tipo?: string): string {
  if (tipo === "formacao") return "Atividade";
  if (tipo === "avulso") return "Objeto";
  return "Curso";
}

function dataLonga(iso?: string | null): string {
  if (!iso) return "data não registrada";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "data não registrada";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3">
      <span className="text-[11px] uppercase tracking-wider text-cream/30 font-dm sm:w-32 shrink-0">
        {rotulo}
      </span>
      <span className="text-sm text-cream/85 font-dm leading-relaxed">
        {valor}
      </span>
    </div>
  );
}

function Verificador() {
  const searchParams = useSearchParams();

  const [codigo, setCodigo] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Metadata aplicada no documento, pelo motivo explicado no topo do arquivo.
  useEffect(() => {
    document.title = TITULO_PAGINA;
    let tag = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    );
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "description";
      document.head.appendChild(tag);
    }
    tag.content = DESCRICAO_PAGINA;
  }, []);

  const verificar = useCallback(async (bruto: string) => {
    const alvo = bruto.trim();
    if (!alvo) return;
    setConsultando(true);
    setErro(null);
    setResultado(null);
    try {
      const res = await fetch(
        `/formacao/api/verificar-certificado?codigo=${encodeURIComponent(alvo)}`
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(
          payload?.error ||
            "Não foi possível consultar agora. Tente novamente em instantes."
        );
        return;
      }
      setResultado(payload as Resultado);
    } catch {
      setErro("Erro de rede ao consultar. Verifique a conexão e tente de novo.");
    } finally {
      setConsultando(false);
    }
  }, []);

  // Verificação automática quando o código vem na URL: é assim que o link
  // impresso no certificado e o QR code funcionam, sem exigir que quem recebeu o
  // documento digite nada. O ref garante que isso aconteça uma vez só, mesmo que
  // o componente volte a renderizar.
  const jaVerificouDaUrl = useRef(false);
  useEffect(() => {
    if (jaVerificouDaUrl.current) return;
    const daUrl = (searchParams.get("codigo") || "").trim();
    if (!daUrl) return;
    jaVerificouDaUrl.current = true;
    setCodigo(daUrl);
    verificar(daUrl);
  }, [searchParams, verificar]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const alvo = codigo.trim();
    if (!alvo || consultando) return;
    // Deixa o endereço copiável com o código consultado, para que quem verificou
    // possa mandar o link adiante. replaceState nativo em vez do router do Next:
    // aqui só interessa a barra de endereços, não uma navegação que remontaria a
    // página e dispararia a consulta de novo.
    try {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?codigo=${encodeURIComponent(alvo)}`
      );
      jaVerificouDaUrl.current = true;
    } catch {
      // Ambiente que bloqueia history não impede a verificação.
    }
    verificar(alvo);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto px-6 py-16"
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{
          background: "rgba(200,75,49,0.08)",
          border: "1px solid rgba(200,75,49,0.2)",
        }}
      >
        <ShieldCheck className="h-8 w-8" style={{ color: "#C84B31" }} />
      </div>

      <h1 className="font-fraunces font-bold text-2xl text-cream mb-3 text-center tracking-tight">
        Verificar certificado
      </h1>

      <div className="space-y-4 text-sm text-cream/55 font-dm leading-relaxed mb-8">
        <p>
          Digite o código impresso no certificado para saber se ele foi mesmo
          emitido pela Associação Allos, em nome de quem, e se continua valendo.
        </p>
        <p className="text-[13px] text-cream/40">
          Esta consulta cumpre a cláusula 8.3 dos{" "}
          <Link href="/formacao/termos" className="text-accent hover:underline">
            Termos de Uso
          </Link>
          , que promete verificação pública de autenticidade, validade e
          anulação de cada certificado.
        </p>
      </div>

      <form
        onSubmit={enviar}
        className="rounded-[16px] p-6 sm:p-8 space-y-5"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div>
          <label
            htmlFor="cert-codigo"
            className="block text-[12px] font-medium text-cream/50 font-dm mb-1.5"
          >
            Código do certificado
          </label>
          <input
            id="cert-codigo"
            type="text"
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="ALLOS-2026-XXXXXXXX"
            // Maiúsculas só na aparência: quem copia de um PDF costuma trazer o
            // código com formatação estranha, e a normalização de verdade
            // (trim e caixa alta) acontece na rota, antes da consulta.
            className="w-full px-4 py-3 dark-input rounded-[12px] text-sm font-dm uppercase tracking-wide"
          />
          <p className="text-[11px] text-cream/30 font-dm mt-1.5">
            O código aparece no rodapé do certificado, junto da data de emissão.
          </p>
        </div>

        {erro && (
          <div
            className="rounded-[12px] px-4 py-3"
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.18)",
            }}
          >
            <p className="text-[13px] text-red-200/80 font-dm">{erro}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!codigo.trim() || consultando}
          className="w-full px-4 py-3 rounded-[10px] text-sm font-medium text-cream disabled:opacity-40 disabled:cursor-not-allowed transition-opacity inline-flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #C84B31, #A33D27)",
            boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
          }}
        >
          <Search className="h-4 w-4" />
          {consultando ? "Verificando..." : "Verificar"}
        </button>
      </form>

      {resultado && !consultando && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          {resultado.situacao === "valido" && (
            <div
              className="rounded-[16px] p-6 sm:p-8"
              style={{
                background: "rgba(46,158,143,0.06)",
                border: "1px solid rgba(46,158,143,0.25)",
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <BadgeCheck className="h-6 w-6" style={{ color: "#2E9E8F" }} />
                <h2 className="font-fraunces font-bold text-lg text-cream tracking-tight">
                  Certificado autêntico e válido
                </h2>
              </div>

              <div className="space-y-3">
                <Linha rotulo="Titular" valor={resultado.titular || "-"} />
                {resultado.tipo_documento && (
                  <Linha rotulo="Documento" valor={resultado.tipo_documento} />
                )}
                <Linha
                  rotulo={rotuloDoObjeto(resultado.tipo)}
                  valor={resultado.curso || "-"}
                />
                {/* Carga horária só aparece quando o curso a declara: certificado
                    antigo pode não ter o dado, e inventar um número aqui seria
                    declarar carga horária que ninguém assinou. */}
                {typeof resultado.carga_horaria === "number" &&
                  resultado.carga_horaria > 0 && (
                    <Linha
                      rotulo="Carga horária"
                      valor={`${resultado.carga_horaria} horas`}
                    />
                  )}
                <Linha
                  rotulo="Emitido em"
                  valor={dataLonga(resultado.emitido_em)}
                />
                <Linha rotulo="Código" valor={resultado.codigo || "-"} />
              </div>

              <p className="text-[12px] text-cream/35 font-dm leading-relaxed mt-6">
                Este registro consta na base da Associação Allos e não sofreu
                anulação até a data desta consulta.
              </p>
            </div>
          )}

          {resultado.situacao === "anulado" && (
            <div
              className="rounded-[16px] p-6 sm:p-8"
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <Ban className="h-6 w-6" style={{ color: "#EF4444" }} />
                <h2 className="font-fraunces font-bold text-lg text-cream tracking-tight">
                  Certificado anulado
                </h2>
              </div>

              <p className="text-sm text-cream/60 font-dm leading-relaxed mb-5">
                Este documento existiu, foi emitido pela Associação Allos e
                depois anulado. A carga horária declarada nele não deve ser
                considerada para nenhum fim.
              </p>

              <div className="space-y-3">
                <Linha rotulo="Titular" valor={resultado.titular || "-"} />
                {resultado.tipo_documento && (
                  <Linha rotulo="Documento" valor={resultado.tipo_documento} />
                )}
                <Linha
                  rotulo={rotuloDoObjeto(resultado.tipo)}
                  valor={resultado.curso || "-"}
                />
                <Linha
                  rotulo="Emitido em"
                  valor={dataLonga(resultado.emitido_em)}
                />
                <Linha
                  rotulo="Anulado em"
                  valor={dataLonga(resultado.anulado_em)}
                />
                <Linha
                  rotulo="Motivo"
                  valor={
                    resultado.anulado_motivo?.trim() ||
                    "Motivo não registrado no sistema."
                  }
                />
                <Linha rotulo="Código" valor={resultado.codigo || "-"} />
              </div>

              <p className="text-[12px] text-cream/35 font-dm leading-relaxed mt-6">
                A anulação consta aqui conforme a cláusula 8.7 dos{" "}
                <Link
                  href="/formacao/termos"
                  className="text-accent hover:underline"
                >
                  Termos de Uso
                </Link>
                .
              </p>
            </div>
          )}

          {resultado.situacao === "nao_encontrado" && (
            <div
              className="rounded-[16px] p-6 sm:p-8"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <FileQuestion className="h-6 w-6 text-cream/30" />
                <h2 className="font-fraunces font-semibold text-lg text-cream/80 tracking-tight">
                  Nenhum certificado com este código
                </h2>
              </div>

              {/* Sem alarde: o caso mais comum aqui é erro de digitação, não
                  fraude, e acusar quem consultou seria injusto e inútil. */}
              <p className="text-sm text-cream/50 font-dm leading-relaxed">
                Não encontramos registro para{" "}
                <span className="text-cream/70">{resultado.codigo || "-"}</span>.
                Confira a digitação, principalmente a troca entre a letra O e o
                número 0, e o hífen entre as partes do código.
              </p>
            </div>
          )}
        </motion.div>
      )}

      <p className="text-[11px] text-cream/25 font-dm text-center leading-relaxed mt-8">
        A consulta mostra apenas o que consta do próprio certificado. Nenhum
        outro dado do titular é exibido nesta página.
      </p>
    </motion.div>
  );
}

export default function VerificarCertificadoPage() {
  return (
    <div className="min-h-screen" style={{ background: "#111111" }}>
      {/* Suspense é exigência do Next 14 para useSearchParams em client
          component: sem ele o build falha na pré-renderização da rota. */}
      <Suspense
        fallback={
          <div className="max-w-xl mx-auto px-6 py-16">
            <div
              className="h-64 rounded-[16px] animate-pulse"
              style={{ background: "rgba(255,255,255,0.03)" }}
            />
          </div>
        }
      >
        <Verificador />
      </Suspense>
    </div>
  );
}
