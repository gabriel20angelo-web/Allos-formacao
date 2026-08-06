"use client";

// Os cortes que vieram das aulas dos cursos.
//
// Três passos, e nenhum a mais: escolhe o curso, escolhe o encontro, avalia os
// cortes. Mostrar tudo de uma vez seria uma parede — um curso de oito
// encontros passa de trezentos cortes, e ninguém avalia trezentos de uma vez.
//
// O curso só entra na lista se tiver corte. Uma lista de cursos onde metade
// abre vazia ensina a não clicar.
//
// A lista era filtrada pelos cursos vinculados à sala de quem olhava, e como
// nenhuma sala tinha esse vínculo, ela vinha vazia para todo mundo. Agora quem
// conduz vê os cortes de todos os cursos.

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { toast } from "sonner";
import { ChevronLeft, Play } from "lucide-react";
import ClipeGrade, { type ClipeC } from "./ClipeGrade";
import EscolhaDeFormato, { type FormatoC } from "./EscolhaDeFormato";

interface CursoComCortes {
  id: string;
  title: string;
  videos: number;
  /** O que foi pedido para os próximos cortes; `null` se ninguém pediu. */
  formato: FormatoC | null;
}
interface EncontroDoCurso {
  job_id: string;
  lesson_id: string;
  titulo: string;
  status: string;
  clipes: ClipeC[];
}

export default function CortesDosCursos({
  aoAssistir,
  aoAvaliar,
  ajustes,
}: {
  aoAssistir: (c: ClipeC) => void;
  aoAvaliar: (c: ClipeC, v: "gostei" | "rejeitado") => void;
  /**
   * O que foi avaliado desde que esta lista carregou.
   *
   * A lista é estado deste componente, e quem envia a avaliação é a tela, que
   * atualiza o estado DELA: as salas do grupo. O corte de curso era gravado no
   * servidor e continuava aparecendo por avaliar; o segundo clique mandava
   * "gostei" outra vez em vez de desmarcar, porque o valor de partida estava
   * velho. Enquanto a aba vinha vazia ninguém tropeçou nisso.
   */
  ajustes: Record<string, "gostei" | "rejeitado" | null>;
}) {
  const [cursos, setCursos] = useState<CursoComCortes[]>([]);
  const [escolhido, setEscolhido] = useState<CursoComCortes | null>(null);
  const [encontros, setEncontros] = useState<EncontroDoCurso[]>([]);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvandoFormato, setSalvandoFormato] = useState(false);

  const carregarCursos = useCallback(async () => {
    try {
      const r = await fetch("/formacao/api/condutor/cursos");
      const j = await r.json();
      if (r.ok) setCursos(j.cursos || []);
    } catch {
      toast.error("Não consegui carregar os cursos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarCursos();
  }, [carregarCursos]);

  /**
   * A proporção pedida para os próximos cortes deste curso.
   *
   * Fica no curso e não na sala porque a maior parte do acervo nasceu de aulas
   * gravadas, que não têm sala nenhuma: pedir pela sala deixaria de fora
   * justamente o material que mais se corta.
   */
  async function pedirFormato(curso: CursoComCortes, formato: FormatoC) {
    const antes = curso.formato;
    const aplicar = (f: FormatoC | null) => {
      setCursos((lista) => lista.map((x) => (x.id === curso.id ? { ...x, formato: f } : x)));
      setEscolhido((e) => (e && e.id === curso.id ? { ...e, formato: f } : e));
    };

    setSalvandoFormato(true);
    aplicar(formato);
    try {
      const r = await fetch("/formacao/api/condutor/formato", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escopo: "curso", chave: curso.id, formato }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não consegui salvar.");
      toast.success(
        formato === "horizontal"
          ? "Os próximos cortes deste curso saem deitados, 16:9."
          : "Os próximos cortes deste curso saem em pé, 9:16."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
      aplicar(antes);
    } finally {
      setSalvandoFormato(false);
    }
  }

  async function abrirCurso(c: CursoComCortes) {
    setEscolhido(c);
    setEncontros([]);
    setAbertoId(null);
    try {
      const r = await fetch(`/formacao/api/condutor/cursos?curso_id=${c.id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro");
      setEncontros(j.encontros || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  if (carregando) return null;

  if (!cursos.length) {
    return (
      <Card className="p-4">
        <p className="text-sm text-cream font-semibold mb-1">Cortes dos cursos</p>
        <p className="text-xs text-cream/40">
          Nenhum curso tem cortes ainda. Eles aparecem depois que as aulas gravadas passam
          pelo corte.
        </p>
      </Card>
    );
  }

  // ── lista de cursos ──
  if (!escolhido) {
    return (
      <Card className="p-4">
        <p className="text-sm text-cream font-semibold mb-1">Cortes dos cursos</p>
        <p className="text-xs text-cream/40 mb-3">
          Trechos curtos tirados das aulas gravadas. Escolha o curso para ver por encontro.
        </p>
        <div className="space-y-1.5">
          {cursos.map((c) => (
            <button
              key={c.id}
              onClick={() => abrirCurso(c)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/[0.03] transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-sm text-cream/80 min-w-0 break-words">{c.title}</span>
              <span className="text-xs text-cream/30 shrink-0 flex items-center gap-2">
                {/* Só o pedido fora do comum aparece: marcar "9:16" em todos
                    seria ruído, já que é o que acontece sem escolha nenhuma. */}
                {c.formato === "horizontal" && (
                  <span className="text-[10px] text-cream/45">16:9</span>
                )}
                {c.videos} {c.videos === 1 ? "encontro" : "encontros"}
              </span>
            </button>
          ))}
        </div>
      </Card>
    );
  }

  // ── encontros do curso escolhido ──
  return (
    <Card className="p-4">
      <button
        onClick={() => setEscolhido(null)}
        className="flex items-center gap-1 text-xs text-cream/40 hover:text-cream/70 mb-3"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> todos os cursos
      </button>

      <p className="text-sm text-cream font-semibold">{escolhido.title}</p>

      {/* No topo do curso, e não em cada encontro: a proporção é do material
          inteiro, e repetir a escolha por linha convidaria a pedir uma coisa
          num encontro e outra no vizinho, o que só produz acervo desencontrado. */}
      <EscolhaDeFormato
        valor={escolhido.formato}
        aoEscolher={(f) => pedirFormato(escolhido, f)}
        ocupado={salvandoFormato}
        titulo="Formato dos cortes deste curso"
      />

      <div className="space-y-2 mt-3">
        {encontros.map((e0) => {
          // O que já foi avaliado nesta visita vale mais que o que veio do
          // servidor quando a lista carregou.
          const e = {
            ...e0,
            clipes: e0.clipes.map((c) =>
              c.id in ajustes ? { ...c, avaliacao: ajustes[c.id] } : c
            ),
          };
          const aberto = abertoId === e.job_id;
          const porVer = e.clipes.filter((c) => !c.avaliacao).length;

          return (
            <div
              key={e.job_id}
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <button
                onClick={() => setAbertoId(aberto ? null : e.job_id)}
                className="w-full flex items-center justify-between gap-3 text-left flex-wrap py-1.5 sm:py-0 min-h-[44px] sm:min-h-0"
              >
                <span className="text-xs text-cream/80 min-w-0 break-words">{e.titulo}</span>
                <span className="text-[11px] text-cream/35 shrink-0">
                  {e.clipes.length
                    ? `${e.clipes.length} cortes${porVer ? ` · ${porVer} por ver` : ""}`
                    : e.status === "pronto"
                      ? "sem cortes"
                      : "ainda cortando"}
                </span>
              </button>

              {aberto && e.clipes.length > 0 && (
                <div className="mt-3">
                  <ClipeGrade clipes={e.clipes} aoAssistir={aoAssistir} aoAvaliar={aoAvaliar} />
                </div>
              )}

              {aberto && !e.clipes.length && (
                <p className="text-[11px] text-cream/30 mt-2 flex items-center gap-1">
                  <Play className="h-3 w-3" />
                  {e.status === "pronto"
                    ? "O corte rodou e não rendeu trecho aproveitável."
                    : "O corte ainda está sendo feito. Volte mais tarde."}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
