"use client";

/**
 * A saída da avaliação clínica, dentro do retrato de pessoas.
 *
 * Duas decisões de desenho que valem explicar, porque não são óbvias:
 *
 * **É bloco e não coluna.** São quarenta avaliadas numa base de quinhentas e
 * onze pessoas. Uma coluna na tabela ficaria vazia em mais de noventa por cento
 * das linhas, e a linha da pessoa já carrega oito selos condicionais: o espaço
 * horizontal dela é a moeda mais escassa da tela.
 *
 * **A lista não depende da ponte.** O nome e a nota vêm do próprio AvaliAllos,
 * então as vinte pessoas acima do corte aparecem hoje, casando ou não com a
 * base da formação. Quem casa ganha um link para a ficha. Fosse o contrário, o
 * bloco mostraria três pessoas e daria a impressão de que só existem três.
 */

import { useEffect, useState } from "react";
import { Stethoscope, ExternalLink } from "lucide-react";
import Card from "@/components/ui/Card";
import { JanelaPropria } from "@/components/admin/SeletorJanela";

const DOURADO = "#D4854A";
const TEAL = "#2E9E8F";

interface Avaliada {
  chave: string;
  nome: string;
  vezes: number;
  avaliacoes: number;
  melhorNota: number;
  ultimaNota: number;
  ultimaEm: string;
  temCadastro: boolean;
  pessoaId: string | null;
}

interface Retrato {
  configurado: boolean;
  motivo?: string;
  error?: string;
  corte: number;
  avaliadas: Avaliada[];
  totalAvaliacoes: number;
  primeira: string | null;
  ultima: string | null;
  ponte: {
    avaliadas: number;
    comTelefoneUtilizavel: number;
    telefonesNaFormacao: number;
    casaram: number;
  };
  acimaDoCorte: number;
  maisDeUmaVez: number;
}

function dataCurta(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export default function BlocoClinica({
  aoAbrirPessoa,
}: {
  aoAbrirPessoa?: (pessoaId: string) => void;
}) {
  const [r, setR] = useState<Retrato | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [verTodas, setVerTodas] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const resp = await fetch("/formacao/api/admin/pessoas/clinica");
        const tipo = resp.headers.get("content-type") ?? "";
        if (!tipo.includes("application/json")) throw new Error("resposta inesperada");
        const j = (await resp.json()) as Retrato;
        if (vivo) setR(j);
      } catch {
        if (vivo) setR(null);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Enquanto carrega, o bloco não existe. Ele chega depois do resto da tela de
  // propósito: é leitura de outro banco, em outro servidor, e não vale segurar
  // o retrato inteiro por ela.
  if (carregando || !r) return null;

  if (!r.configurado) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Stethoscope className="h-4 w-4" style={{ color: DOURADO }} />
          <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
            Avaliação clínica
          </h2>
        </div>
        <p className="font-dm text-xs text-cream/30 py-2 leading-relaxed">
          {r.motivo ?? "A leitura da avaliação clínica não está ligada neste ambiente."}
        </p>
      </Card>
    );
  }

  if (r.error) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Stethoscope className="h-4 w-4" style={{ color: DOURADO }} />
          <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
            Avaliação clínica
          </h2>
        </div>
        <p className="font-dm text-xs text-cream/40 py-2 leading-relaxed">{r.error}</p>
      </Card>
    );
  }

  const acima = r.avaliadas.filter((a) => a.melhorNota >= r.corte);
  const mostradas = verTodas ? r.avaliadas : acima;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Stethoscope className="h-4 w-4" style={{ color: DOURADO }} />
        <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
          Avaliação clínica
        </h2>
        <JanelaPropria motivo="outro sistema, sem prazo próprio" />
      </div>
      <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
        A nota é a soma de doze competências, e vai de {"−"}108 a +108, então
        é escala que passa pelo negativo. Duas avaliações da mesma pessoa no mesmo
        dia contam uma vez: são dois avaliadores olhando o mesmo atendimento.
      </p>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 sm:gap-x-8 gap-y-5 mb-5">
        <div>
          <p className="font-fraunces font-bold text-2xl tabular-nums leading-none text-cream/85">
            {r.avaliadas.length}
          </p>
          <p className="font-dm text-[11px] text-cream/30 mt-1.5">pessoas avaliadas</p>
        </div>
        <div>
          <p
            className="font-fraunces font-bold text-2xl tabular-nums leading-none"
            style={{ color: TEAL }}
          >
            {r.acimaDoCorte}
          </p>
          <p className="font-dm text-[11px] text-cream/30 mt-1.5">
            com nota +{r.corte} ou mais
          </p>
        </div>
        <div>
          <p className="font-fraunces font-bold text-2xl tabular-nums leading-none text-cream/85">
            {r.maisDeUmaVez}
          </p>
          <p className="font-dm text-[11px] text-cream/30 mt-1.5">avaliadas mais de uma vez</p>
        </div>
        <div>
          <p className="font-fraunces font-bold text-2xl tabular-nums leading-none text-cream/85">
            {r.totalAvaliacoes}
          </p>
          <p className="font-dm text-[11px] text-cream/30 mt-1.5">
            avaliações desde {dataCurta(r.primeira)}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="font-dm text-[10px] uppercase tracking-wider text-cream/25 mb-2">
          {verTodas
            ? `todas as ${r.avaliadas.length}, da maior nota para a menor`
            : `as ${acima.length} com nota +${r.corte} ou mais`}
        </p>
        {mostradas.map((a) => {
          const podeAbrir = Boolean(a.pessoaId && aoAbrirPessoa);
          return (
            <div
              key={a.chave}
              className="flex items-center gap-3 px-2 py-2 rounded-[10px]"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <span
                className="font-fraunces font-bold text-sm tabular-nums w-12 text-right shrink-0"
                style={{
                  color:
                    a.melhorNota >= r.corte
                      ? TEAL
                      : a.melhorNota >= 0
                        ? "rgba(253,251,247,0.6)"
                        : "#E07A5F",
                }}
              >
                {a.melhorNota > 0 ? "+" : ""}
                {a.melhorNota}
              </span>
              <div className="min-w-0 flex-1">
                {podeAbrir ? (
                  <button
                    onClick={() => aoAbrirPessoa?.(a.pessoaId as string)}
                    className="font-dm text-xs text-cream/80 hover:text-cream transition-colors inline-flex items-center gap-1 truncate"
                  >
                    {a.nome}
                    <ExternalLink className="h-3 w-3 shrink-0 text-cream/30" />
                  </button>
                ) : (
                  <span className="font-dm text-xs text-cream/70 truncate block">{a.nome}</span>
                )}
                <span className="font-dm text-[10px] text-cream/25 block">
                  {a.vezes > 1 ? `${a.vezes} vezes · ` : ""}
                  última em {dataCurta(a.ultimaEm)}
                  {a.avaliacoes > a.vezes
                    ? ` · ${a.avaliacoes} avaliadores`
                    : ""}
                  {!a.temCadastro ? " · só como nome na sessão" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {r.avaliadas.length > acima.length && (
        <button
          onClick={() => setVerTodas((v) => !v)}
          className="font-dm text-[11px] text-cream/35 hover:text-cream/60 transition-colors mt-3 min-h-[44px] sm:min-h-0"
        >
          {verTodas
            ? `Mostrar só as ${acima.length} acima de +${r.corte}`
            : `Ver todas as ${r.avaliadas.length}, inclusive as negativas`}
        </button>
      )}

      {/* A procedência do bloco: de onde ele vem e até onde ele alcança. */}
      <div
        className="mt-4 pt-3 font-dm text-[11px] text-cream/35 leading-relaxed"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        Estes nomes e notas vêm do AvaliAllos, que é outro sistema e outro banco.
        A ligação com a ficha de cada pessoa aqui é feita por telefone, que é a
        única chave forte que os dois lados têm em comum, porque o AvaliAllos não
        guarda e-mail.{" "}
        {r.ponte.telefonesNaFormacao === 0 ? (
          <>
            Hoje a base da formação não tem nenhum telefone gravado, então{" "}
            <strong className="text-cream/60">nenhuma das {r.ponte.avaliadas} casa</strong>.
            Importar o CSV do processo seletivo, ali embaixo, liga três delas.
          </>
        ) : (
          <>
            {r.ponte.casaram} de {r.ponte.comTelefoneUtilizavel} com telefone
            utilizável casaram com uma pessoa da formação. As outras aparecem aqui
            do mesmo jeito, só sem link.
          </>
        )}
      </div>
    </Card>
  );
}
