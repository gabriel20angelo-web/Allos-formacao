"use client";

/**
 * Os ciclos de cronograma.
 *
 * O painel sabia dois recortes de tempo, "esta semana" e "tudo", e a formação
 * não roda assim: um cronograma abre, roda alguns meses, fecha, e outro abre no
 * lugar. Sem essa entidade, "este ciclo foi melhor que o anterior" era trabalho
 * de memória de quem estava lá.
 *
 * Esta tela é a lista e a abertura. A comparação de verdade mora na página do
 * ciclo, porque é uma tabela e não uma linha.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { History, AlertTriangle, Play, Square } from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { toast } from "sonner";

const TERRACOTA = "#C84B31";
const TEAL = "#2E9E8F";
const DOURADO = "#D4854A";

interface Ciclo {
  id: string;
  nome: string;
  inicio: string;
  fim: string | null;
  status: "planejado" | "ativo" | "encerrado";
  observacoes: string | null;
  encerrado_em: string | null;
}

const dia = (s: string | null) =>
  s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR") : null;

function meses(inicio: string, fim: string | null): string {
  const a = new Date(inicio + "T12:00:00");
  const b = fim ? new Date(fim + "T12:00:00") : new Date();
  const dias = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
  if (dias < 14) return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  const semanas = Math.round(dias / 7);
  if (semanas < 9) return `${semanas} semanas`;
  return `${Math.round(dias / 30)} meses`;
}

export default function Ciclos() {
  const router = useRouter();
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [migracaoPendente, setMigracaoPendente] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [inicio, setInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/formacao/api/admin/ciclos");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "falha ao ler os ciclos");
      setMigracaoPendente(Boolean(j.migracaoPendente));
      setCiclos(j.ciclos ?? []);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "falha ao ler");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function abrirCiclo() {
    if (!nome.trim()) return;
    setCriando(true);
    try {
      const r = await fetch("/formacao/api/admin/ciclos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), inicio }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "não consegui abrir");
      setNome("");
      await carregar();
      toast.success("Ciclo aberto.");
      router.push(`/formacao/admin/ciclos/${j.ciclo.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "não consegui abrir");
    } finally {
      setCriando(false);
    }
  }

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (migracaoPendente) {
    return (
      <Card>
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: DOURADO }} />
          <div>
            <h2 className="font-dm text-sm text-cream/80 mb-1">
              A migration 095 ainda não foi aplicada
            </h2>
            <p className="font-dm text-xs text-cream/45 leading-relaxed">
              A tabela dos ciclos não existe no banco ainda. O arquivo está em{" "}
              <code className="text-cream/60">
                supabase/migrations/095_ciclos_de_cronograma.sql
              </code>{" "}
              e precisa ser rodado no SQL Editor do Supabase. Nada mais no painel
              depende dela, então o resto continua funcionando normalmente.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const ativo = ciclos.find((c) => c.status === "ativo") ?? null;
  const encerrados = ciclos.filter((c) => c.status !== "ativo");

  return (
    <div className="space-y-4 pb-6">
      {erro && (
        <Card>
          <p className="font-dm text-xs text-cream/50">{erro}</p>
        </Card>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <History className="h-4 w-4" style={{ color: TERRACOTA }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
              O ciclo que está rodando
            </h2>
          </div>

          {ativo ? (
            <button
              onClick={() => router.push(`/formacao/admin/ciclos/${ativo.id}`)}
              className="w-full text-left mt-3 px-3 py-3 rounded-[10px] transition-colors hover:bg-white/[.04]"
              style={{ background: "rgba(46,158,143,0.06)", border: "1px solid rgba(46,158,143,0.2)" }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Play className="h-3.5 w-3.5" style={{ color: TEAL }} />
                <span className="font-fraunces font-bold text-lg text-cream">{ativo.nome}</span>
                <span className="font-dm text-[11px] text-cream/35">
                  desde {dia(ativo.inicio)} · {meses(ativo.inicio, null)} rodando
                </span>
              </div>
              {ativo.observacoes ? (
                <p className="font-dm text-[11px] text-cream/45 mt-2 leading-relaxed line-clamp-2">
                  {ativo.observacoes}
                </p>
              ) : (
                <p className="font-dm text-[11px] text-cream/25 mt-2">
                  Sem anotações ainda. É aqui que fica o que este cronograma ensinou.
                </p>
              )}
            </button>
          ) : (
            <p className="font-dm text-xs text-cream/40 mt-3 leading-relaxed">
              Nenhum ciclo aberto. Enquanto não houver um, os encontros continuam
              sendo capturados normalmente e ficam sem recorte de período: é só o
              agrupamento que falta, nunca o dado.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && abrirCiclo()}
              placeholder="Nome do ciclo novo"
              className="dark-input flex-1 rounded-[10px] px-3 py-2.5 font-dm text-base sm:text-sm"
            />
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="dark-input rounded-[10px] px-3 py-2.5 font-dm text-base sm:text-sm"
            />
            <button
              onClick={abrirCiclo}
              disabled={!nome.trim() || criando}
              className="font-dm text-xs px-4 rounded-[10px] transition-all min-h-[40px] shrink-0 disabled:opacity-30"
              style={{ background: "rgba(200,75,49,0.12)", color: TERRACOTA, border: "1px solid rgba(200,75,49,0.3)" }}
            >
              Abrir ciclo
            </button>
          </div>
          {ativo && (
            <p className="font-dm text-[11px] text-cream/30 mt-2 leading-relaxed">
              Abrir um ciclo novo encerra <strong className="text-cream/50">{ativo.nome}</strong> na
              véspera da data escolhida. Os dois ficam colados, sem buraco e sem
              sobreposição, que é o que a divisão por data exige.
            </p>
          )}
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <Card>
          <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-3">
            Ciclos anteriores
          </h2>
          {encerrados.length === 0 ? (
            <p className="font-dm text-xs text-cream/30 py-2 leading-relaxed">
              Nenhum ciclo encerrado ainda. A comparação entre cronogramas aparece
              quando existirem dois: até lá não há o que comparar, e isso é falta de
              tempo, não de código.
            </p>
          ) : (
            <div className="space-y-1.5">
              {encerrados.map((c) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/formacao/admin/ciclos/${c.id}`)}
                  className="w-full text-left px-3 py-2.5 rounded-[10px] transition-colors hover:bg-white/[.04]"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Square className="h-3 w-3 text-cream/25" />
                    <span className="font-dm text-sm text-cream/80">{c.nome}</span>
                    <span className="font-dm text-[11px] text-cream/30">
                      {dia(c.inicio)} até {dia(c.fim) ?? "sem fim"} · {meses(c.inicio, c.fim)}
                    </span>
                  </div>
                  {c.observacoes && (
                    <p className="font-dm text-[11px] text-cream/35 mt-1 line-clamp-1">
                      {c.observacoes}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
          <p className="font-dm text-[11px] text-cream/25 mt-4 leading-relaxed">
            Um encontro pertence ao ciclo pela data em que aconteceu, e não por uma
            marca gravada nele. Isso vale para trás: abrir um ciclo hoje com início
            em março já recolhe tudo que foi capturado desde março, sem reprocessar
            nada.
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
