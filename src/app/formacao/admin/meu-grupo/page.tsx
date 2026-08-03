"use client";

// A área de quem conduz.
//
// O condutor entra no painel e chega aqui, e daqui não sai — o middleware
// prende. O que ele vê é o próprio grupo: os ajustes do encontro da semana e o
// que saiu dos encontros passados.
//
// A ordem da tela responde à pergunta que ele tem quando abre: primeiro "o que
// acontece no meu encontro" (gravar, transcrever, porta aberta), depois "o que
// saiu dos encontros" (o vídeo e os cortes). Configuração é raro; curadoria é
// toda semana.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { toast } from "sonner";
import {
  Clock3,
  DoorClosed,
  DoorOpen,
  Download,
  Link2,
  Mic,
  Play,
  ThumbsDown,
  ThumbsUp,
  Video,
  Youtube,
  X,
} from "lucide-react";

const ROXO = "#6C5CE7";
const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

interface ClipeC {
  id: string;
  titulo: string | null;
  descricao: string | null;
  hashtags: string[] | null;
  url: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  duracao_seg: number | null;
  pontuacao: number | null;
  avaliacao: "gostei" | "rejeitado" | null;
  anotacao: string | null;
}
interface EncontroC {
  id: string;
  data_reuniao: string;
  inicio: string;
  duracao_min: number | null;
  total_participantes: number | null;
  youtube_video_id: string | null;
  gravacao_uri: string | null;
  clipes: ClipeC[];
}
interface SalaC {
  space_name: string;
  rotulo: string | null;
  meeting_uri: string | null;
  meeting_code: string | null;
  gravar: boolean;
  transcrever: boolean;
  notas: boolean;
  access_type: string;
  janela_automatica: boolean;
  duracao_min: number | null;
  dia_semana: number | null;
  hora: string | null;
  atividade_nome: string | null;
  encontros: EncontroC[];
}

export default function MeuGrupoPage() {
  const { profile, loading: carregandoPerfil } = useAuth();
  const [salas, setSalas] = useState<SalaC[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salaAberta, setSalaAberta] = useState<string | null>(null);
  const [encontroAberto, setEncontroAberto] = useState<string | null>(null);
  const [assistindo, setAssistindo] = useState<ClipeC | null>(null);
  const [anotacao, setAnotacao] = useState("");
  const [trabalhando, setTrabalhando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/formacao/api/condutor/grupo");
      const tipo = r.headers.get("content-type") || "";
      if (!tipo.includes("application/json")) {
        throw new Error("O servidor respondeu uma página em vez de dados.");
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não consegui carregar.");
      setSalas(j.salas || []);
      setErro(j.aviso || null);
      if (j.salas?.length === 1) setSalaAberta(j.salas[0].space_name);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui carregar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mudarSala(sala: SalaC, campos: Record<string, unknown>) {
    setTrabalhando(sala.space_name);
    // Muda na tela primeiro: um botão que só reage depois da ida e volta
    // parece quebrado, e aqui são vários seguidos.
    setSalas((s) =>
      s.map((x) => (x.space_name === sala.space_name ? { ...x, ...campos } : x))
    );
    try {
      const r = await fetch("/formacao/api/condutor/grupo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_name: sala.space_name, ...campos }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não consegui salvar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
      await carregar();
    } finally {
      setTrabalhando(null);
    }
  }

  async function avaliar(c: ClipeC, valor: "gostei" | "rejeitado") {
    const novo = c.avaliacao === valor ? null : valor;
    setSalas((s) =>
      s.map((sala) => ({
        ...sala,
        encontros: sala.encontros.map((e) => ({
          ...e,
          clipes: e.clipes.map((x) => (x.id === c.id ? { ...x, avaliacao: novo } : x)),
        })),
      }))
    );
    try {
      const r = await fetch("/formacao/api/condutor/clipes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clip_id: c.id, avaliacao: novo }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Erro");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar");
      await carregar();
    }
  }

  async function salvarAnotacao(c: ClipeC) {
    if ((c.anotacao || "") === anotacao) return;
    setSalas((s) =>
      s.map((sala) => ({
        ...sala,
        encontros: sala.encontros.map((e) => ({
          ...e,
          clipes: e.clipes.map((x) => (x.id === c.id ? { ...x, anotacao } : x)),
        })),
      }))
    );
    try {
      await fetch("/formacao/api/condutor/clipes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clip_id: c.id, anotacao }),
      });
    } catch {
      toast.error("Não consegui salvar a anotação.");
    }
  }

  if (carregandoPerfil || carregando) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-fraunces font-bold text-2xl text-cream mb-1">Meu grupo</h1>
        <p className="text-sm text-cream/50">
          {profile?.full_name ? `${profile.full_name}, aqui` : "Aqui"} você ajusta o que acontece
          no seu encontro e olha o que saiu dele.
        </p>
      </div>

      {erro && (
        <Card className="p-4 border border-amber-400/30">
          <p className="text-sm text-cream/70">{erro}</p>
        </Card>
      )}

      {salas.map((sala) => {
        const aberta = salaAberta === sala.space_name;
        const ocupado = trabalhando === sala.space_name;

        return (
          <Card key={sala.space_name} className="p-4">
            <button
              onClick={() => setSalaAberta(aberta ? null : sala.space_name)}
              className="w-full text-left"
            >
              <p className="text-sm text-cream font-semibold">
                {sala.dia_semana !== null ? DIAS[sala.dia_semana] : sala.rotulo}
                {sala.hora ? ` · ${sala.hora}` : ""}
              </p>
              <p className="text-xs text-cream/50 mt-0.5">
                {sala.atividade_nome || sala.rotulo || "Sem atividade definida"}
              </p>
            </button>

            {sala.meeting_uri && (
              <a
                href={sala.meeting_uri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs mt-2"
                style={{ color: ROXO }}
              >
                <Link2 className="h-3 w-3" /> {sala.meeting_code}
              </a>
            )}

            {aberta && (
              <>
                {/* O que ele pode mexer. O que decide onde o material vai parar
                    (YouTube, curso, pasta) não está aqui de propósito. */}
                <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-white/5">
                  {(
                    [
                      ["gravar", "Gravar", Video],
                      ["transcrever", "Transcrever", Mic],
                    ] as const
                  ).map(([campo, rotulo, Icone]) => {
                    const ligado = sala[campo];
                    return (
                      <button
                        key={campo}
                        onClick={() => mudarSala(sala, { [campo]: !ligado })}
                        disabled={ocupado}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40"
                        style={{
                          background: ligado ? "rgba(108,92,231,0.12)" : "rgba(255,255,255,0.03)",
                          color: ligado ? ROXO : "rgba(253,251,247,0.35)",
                          border: `1px solid ${ligado ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <Icone className="h-3 w-3" /> {rotulo}
                      </button>
                    );
                  })}

                  <button
                    onClick={() =>
                      mudarSala(sala, {
                        access_type: sala.access_type === "OPEN" ? "TRUSTED" : "OPEN",
                      })
                    }
                    disabled={ocupado}
                    title="Aberta deixa entrar sem bater à porta. Fechada exige que você aceite cada pessoa."
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40"
                    style={{
                      background:
                        sala.access_type === "OPEN"
                          ? "rgba(74,222,128,0.12)"
                          : "rgba(255,255,255,0.03)",
                      color: sala.access_type === "OPEN" ? "#4ADE80" : "rgba(253,251,247,0.35)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {sala.access_type === "OPEN" ? (
                      <DoorOpen className="h-3 w-3" />
                    ) : (
                      <DoorClosed className="h-3 w-3" />
                    )}
                    {sala.access_type === "OPEN" ? "Aberta" : "Fechada"}
                    {sala.janela_automatica ? " no horário" : ""}
                  </button>

                  {!sala.janela_automatica && (
                    <button
                      onClick={() => mudarSala(sala, { janela_automatica: true })}
                      disabled={ocupado}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-cream/40 border border-white/10"
                    >
                      voltar ao horário
                    </button>
                  )}

                  <span className="flex items-center gap-1 text-xs text-cream/30 ml-auto">
                    <Clock3 className="h-3 w-3" />
                    {sala.duracao_min ? `${sala.duracao_min} min` : "duração padrão"}
                  </span>
                </div>

                {/* Encontros e o que saiu deles */}
                <div className="mt-4 space-y-2">
                  {sala.encontros.length === 0 && (
                    <p className="text-xs text-cream/30">Nenhum encontro capturado ainda.</p>
                  )}

                  {sala.encontros.map((e) => {
                    const abertoE = encontroAberto === e.id;
                    const porVer = e.clipes.filter((c) => !c.avaliacao).length;

                    return (
                      <div
                        key={e.id}
                        className="rounded-xl p-3"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <button
                          onClick={() => setEncontroAberto(abertoE ? null : e.id)}
                          className="w-full text-left flex items-center justify-between gap-2 flex-wrap"
                        >
                          <span className="text-xs text-cream/80">
                            {new Date(e.inicio).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "long",
                            })}
                            <span className="text-cream/35">
                              {e.total_participantes ? ` · ${e.total_participantes} presentes` : ""}
                              {e.duracao_min ? ` · ${e.duracao_min} min` : ""}
                            </span>
                          </span>
                          <span className="text-[11px] text-cream/35">
                            {e.clipes.length
                              ? `${e.clipes.length} cortes${porVer ? ` · ${porVer} por ver` : ""}`
                              : "sem cortes"}
                          </span>
                        </button>

                        {abertoE && (
                          <div className="mt-3">
                            {e.youtube_video_id && (
                              <a
                                href={`https://www.youtube.com/watch?v=${e.youtube_video_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs mb-3"
                                style={{ color: "#FF4D4D" }}
                              >
                                <Youtube className="h-3.5 w-3.5" /> ver o encontro inteiro
                              </a>
                            )}

                            {e.clipes.length > 0 && (
                              <>
                                <p className="text-[11px] text-cream/35 mb-2 leading-relaxed">
                                  Ouça antes de aprovar: o que decide é o que está sendo dito, não
                                  a imagem. Repare se o corte não começa no meio de uma ressalva
                                  nem termina antes dela. O mesmo corte serve em pé e deitado,
                                  então o formato não é motivo para reprovar.
                                </p>

                                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                                  {e.clipes.map((c) => (
                                    <div
                                      key={c.id}
                                      className="rounded-lg overflow-hidden"
                                      style={{
                                        border: `1px solid ${c.avaliacao === "gostei" ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.06)"}`,
                                        opacity: c.avaliacao === "rejeitado" ? 0.4 : 1,
                                      }}
                                    >
                                      <button
                                        onClick={() => {
                                          setAnotacao(c.anotacao || "");
                                          setAssistindo(c);
                                        }}
                                        className="relative block w-full group"
                                        style={{ aspectRatio: "9/16", background: "rgba(0,0,0,0.3)" }}
                                      >
                                        {c.thumbnail_url && (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={c.thumbnail_url}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                          />
                                        )}
                                        <span
                                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                          style={{ background: "rgba(0,0,0,0.45)" }}
                                        >
                                          <Play className="h-7 w-7 text-white" fill="white" />
                                        </span>
                                        {c.duracao_seg && (
                                          <span
                                            className="absolute bottom-1 right-1 px-1 rounded text-[10px] text-white"
                                            style={{ background: "rgba(0,0,0,0.65)" }}
                                          >
                                            {Math.round(c.duracao_seg)}s
                                          </span>
                                        )}
                                      </button>
                                      <p className="text-[10px] text-cream/70 px-1.5 pt-1.5 line-clamp-2">
                                        {c.titulo}
                                      </p>
                                      <div className="flex items-center gap-1 p-1.5">
                                        <button
                                          onClick={() => avaliar(c, "gostei")}
                                          className="p-1 rounded"
                                          style={{
                                            background:
                                              c.avaliacao === "gostei"
                                                ? "rgba(74,222,128,0.15)"
                                                : "transparent",
                                            color:
                                              c.avaliacao === "gostei"
                                                ? "#4ADE80"
                                                : "rgba(253,251,247,0.3)",
                                          }}
                                        >
                                          <ThumbsUp className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={() => avaliar(c, "rejeitado")}
                                          className="p-1 rounded"
                                          style={{
                                            background:
                                              c.avaliacao === "rejeitado"
                                                ? "rgba(245,158,11,0.15)"
                                                : "transparent",
                                            color:
                                              c.avaliacao === "rejeitado"
                                                ? "#F59E0B"
                                                : "rgba(253,251,247,0.3)",
                                          }}
                                        >
                                          <ThumbsDown className="h-3 w-3" />
                                        </button>
                                        <a
                                          href={c.url || c.preview_url || "#"}
                                          download
                                          target="_blank"
                                          rel="noreferrer"
                                          title="Baixar"
                                          className="p-1 rounded text-cream/30 ml-auto"
                                        >
                                          <Download className="h-3 w-3" />
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        );
      })}

      {assistindo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => {
            salvarAnotacao(assistindo);
            setAssistindo(null);
          }}
        >
          <div
            className="rounded-2xl overflow-hidden max-w-[min(420px,90vw)] w-full"
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

              <textarea
                value={anotacao}
                onChange={(ev) => setAnotacao(ev.target.value)}
                onBlur={() => salvarAnotacao(assistindo)}
                placeholder="Por que presta, ou por que não. Ex: cortou no meio da ressalva."
                rows={2}
                className="w-full mt-3 px-2.5 py-2 rounded-lg text-xs resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#FDFBF7" }}
              />

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => {
                    salvarAnotacao(assistindo);
                    avaliar(assistindo, "gostei");
                    setAssistindo(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(74,222,128,0.12)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
                >
                  <ThumbsUp className="h-3.5 w-3.5" /> Publicável
                </button>
                <button
                  onClick={() => {
                    salvarAnotacao(assistindo);
                    avaliar(assistindo, "rejeitado");
                    setAssistindo(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(253,251,247,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <ThumbsDown className="h-3.5 w-3.5" /> Não publicar
                </button>
                <a
                  href={assistindo.url || assistindo.preview_url || "#"}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-cream/40"
                  title="Baixar"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => {
                    salvarAnotacao(assistindo);
                    setAssistindo(null);
                  }}
                  className="ml-auto p-1.5 rounded-lg text-cream/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
