"use client";

// A pessoa por trás do nome de tela.
//
// Abre ao clicar num nome da lista de presença e responde o que a lista não
// responde: veio quantas vezes, fala ou fica calada, chega atrasada, e o que
// escreveu ao pedir o certificado. É o mesmo componente no painel e na área de
// quem conduz — muda só a rota, e com ela o recorte: quem conduz vê a pessoa
// dentro do próprio grupo, e o aviso no rodapé diz isso em voz alta, para
// ninguém ler "dois encontros" como "só veio duas vezes na vida".

import { useEffect, useState } from "react";
import { CalendarDays, Clock3, Mic, Star, TriangleAlert } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { RetratoUI } from "./tipos";
import { minutos, ROXO } from "./tipos";

export default function FichaPessoa({
  aberta,
  aoFechar,
  endpoint,
  norm,
  alunoId,
  nomeProvisorio,
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** "/formacao/api/admin/meet/pessoa" ou "/formacao/api/condutor/pessoa" */
  endpoint: string;
  norm?: string | null;
  alunoId?: string | null;
  /** O nome de tela, para o título não ficar vazio enquanto carrega. */
  nomeProvisorio?: string;
}) {
  const [retrato, setRetrato] = useState<RetratoUI | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!aberta || (!norm && !alunoId)) return;

    let cancelado = false;
    setCarregando(true);
    setErro(null);
    setRetrato(null);

    const params = new URLSearchParams();
    if (norm) params.set("norm", norm);
    if (alunoId) params.set("aluno_id", alunoId);

    fetch(`${endpoint}?${params.toString()}`)
      .then(async (r) => {
        const tipo = r.headers.get("content-type") || "";
        if (!tipo.includes("application/json")) {
          throw new Error("O servidor respondeu uma página em vez de dados.");
        }
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Não consegui abrir esta pessoa.");
        return j as RetratoUI;
      })
      .then((j) => {
        if (!cancelado) setRetrato(j);
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Não consegui abrir.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [aberta, endpoint, norm, alunoId]);

  const titulo = retrato?.pessoa.nome || nomeProvisorio || "Pessoa";

  return (
    <Modal open={aberta} onClose={aoFechar} title={titulo} maxWidth="max-w-2xl">
      {carregando && <p className="text-sm text-cream/40">Juntando os encontros…</p>}

      {erro && (
        <div className="flex items-start gap-2 text-sm text-cream/60">
          <TriangleAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {retrato && (
        <div className="space-y-4">
          {/* Quem é, e por que achamos que é */}
          <div className="text-xs text-cream/50 space-y-1">
            {retrato.pessoa.email && <p className="break-all">{retrato.pessoa.email}</p>}
            <p>
              {retrato.pessoa.tem_conta ? (
                <span style={{ color: ROXO }}>tem conta na plataforma</span>
              ) : (
                <span className="text-amber-400/70">ainda não tem conta na plataforma</span>
              )}
              {retrato.pessoa.nomes_de_tela.length > 1 && (
                <span className="text-cream/35">
                  {" · entra como "}
                  {retrato.pessoa.nomes_de_tela.join(", ")}
                </span>
              )}
            </p>
            {retrato.pessoa.evidencia && (
              <p className="text-cream/30">{retrato.pessoa.evidencia}</p>
            )}
          </div>

          {/* O resumo, que é o que se olha primeiro */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              {
                icone: CalendarDays,
                valor: String(retrato.resumo.encontros),
                rotulo: retrato.resumo.encontros === 1 ? "encontro" : "encontros",
              },
              {
                icone: Clock3,
                valor: `${retrato.resumo.minutos_totais}`,
                rotulo: "minutos presentes",
              },
              {
                icone: Mic,
                valor:
                  retrato.resumo.minutos_fala === null
                    ? "—"
                    : `${minutos(retrato.resumo.minutos_fala)}`,
                rotulo:
                  retrato.resumo.minutos_fala === null
                    ? "sem transcrição"
                    : `min de fala em ${retrato.resumo.encontros_em_que_falou}`,
              },
              {
                icone: Star,
                valor:
                  retrato.resumo.media_permanencia_pct === null
                    ? "—"
                    : `${retrato.resumo.media_permanencia_pct}%`,
                rotulo: "permanência média",
              },
            ].map(({ icone: Icone, valor, rotulo }) => (
              <div
                key={rotulo}
                className="rounded-[12px] p-2.5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <Icone className="h-3 w-3 text-cream/30 mb-1" />
                <p className="text-base text-cream tabular-nums leading-none">{valor}</p>
                <p className="text-[10px] text-cream/35 mt-1">{rotulo}</p>
              </div>
            ))}
          </div>

          {retrato.resumo.atrasos > 0 && (
            <p className="text-xs text-cream/40">
              Chegou depois do horário em {retrato.resumo.atrasos} de {retrato.resumo.encontros}{" "}
              {retrato.resumo.encontros === 1 ? "encontro" : "encontros"}.
            </p>
          )}

          {/* Encontro a encontro */}
          <div>
            <p className="text-xs text-cream/50 mb-1.5">Encontro a encontro</p>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {retrato.encontros.map((e) => (
                <div
                  key={`${e.encontro_id}-${e.display_name}`}
                  className="rounded-[10px] px-2.5 py-2 text-[11px]"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-cream/70">
                      {new Date(e.data_reuniao + "T12:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                      {e.atividade_nome ? (
                        <span className="text-cream/35"> · {e.atividade_nome}</span>
                      ) : null}
                    </span>
                    <span className="text-cream/50 tabular-nums">
                      {e.minutos_presentes} min
                      {e.permanencia_pct !== null ? ` · ${e.permanencia_pct}%` : ""}
                      {e.minutos_fala !== null && e.minutos_fala > 0
                        ? ` · falou ${minutos(e.minutos_fala)} min`
                        : e.minutos_fala === 0
                          ? " · não falou"
                          : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* O outro lado do mesmo encontro */}
          {retrato.feedback.length > 0 && (
            <div>
              <p className="text-xs text-cream/50 mb-1.5">
                O que escreveu ao pedir o certificado
              </p>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                {retrato.feedback.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-[10px] px-2.5 py-2 text-[11px]"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap text-cream/50">
                      <span>{f.atividade_nome || "Sem atividade"}</span>
                      <span className="tabular-nums">
                        {new Date(f.created_at).toLocaleDateString("pt-BR")}
                        {f.nota_grupo !== null ? ` · grupo ${f.nota_grupo}` : ""}
                        {f.nota_condutor !== null ? ` · condutor ${f.nota_condutor}` : ""}
                      </span>
                    </div>
                    {f.relato && <p className="text-cream/60 mt-1 break-words">{f.relato}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {retrato.recortado && (
            <p className="text-[11px] text-cream/30 pt-1 border-t border-white/5">
              Só os encontros dos grupos que você conduz.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
