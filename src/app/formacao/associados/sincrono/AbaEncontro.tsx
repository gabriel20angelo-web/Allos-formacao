"use client";

// O encontro da semana.
//
// Só o que acontece DENTRO da reunião: gravar, transcrever, abrir a porta,
// encerrar. O que sai dela — o vídeo, os cortes — mudou de lugar e virou a aba
// ao lado, porque são dois trabalhos com ritmos diferentes: os interruptores
// se mexem uma vez por semestre, a curadoria é toda semana.
//
// O que decide onde o material vai parar (YouTube, curso, pasta) continua fora
// daqui de propósito: é escolha de quem responde pela plataforma.

import Card from "@/components/ui/Card";
import {
  Clock3,
  DoorClosed,
  DoorOpen,
  FileText,
  Link2,
  Mic,
  PhoneOff,
  Scissors,
  Video,
  Youtube,
} from "lucide-react";
import LembreteDoEncontro from "./LembreteDoEncontro";
import { DIAS, ROXO, type SalaC } from "./tipos";

export default function AbaEncontro({
  salas,
  trabalhando,
  aoMudarSala,
  aoEncerrar,
  aoVerCortes,
}: {
  salas: SalaC[];
  trabalhando: string | null;
  aoMudarSala: (sala: SalaC, campos: Record<string, unknown>) => void;
  aoEncerrar: (sala: SalaC) => void;
  aoVerCortes: () => void;
}) {
  if (!salas.length) return null;

  return (
    <div className="space-y-3">
      {salas.map((sala) => {
        const ocupado = trabalhando === sala.space_name;
        const porVer = sala.encontros.reduce(
          (n, e) => n + e.clipes.filter((c) => !c.avaliacao).length,
          0
        );

        return (
          <Card key={sala.space_name} className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <p className="text-sm text-cream font-semibold">
                  {sala.dia_semana !== null ? DIAS[sala.dia_semana] : sala.rotulo}
                  {sala.hora ? ` · ${sala.hora}` : ""}
                </p>
                <p className="text-xs text-cream/50 mt-0.5">
                  {sala.atividade_nome || sala.rotulo || "Sem atividade definida"}
                </p>
              </div>

              {sala.meeting_uri && (
                <a
                  href={sala.meeting_uri}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs break-all"
                  style={{ color: ROXO }}
                >
                  <Link2 className="h-3 w-3 shrink-0" /> {sala.meeting_code}
                </a>
              )}
            </div>

            {/* Vem antes dos interruptores porque é o que se faz toda semana,
                e eles são de ajustar uma vez e esquecer. */}
            <LembreteDoEncontro linkDoMeet={sala.meeting_uri} />

            {/* Os interruptores. Todos reversíveis, todos sem consequência fora
                do encontro. */}
            <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-white/5">
              {(
                [
                  ["gravar", "Gravar", Video],
                  ["transcrever", "Transcrever", Mic],
                  ["notas", "Notas de IA", FileText],
                ] as const
              ).map(([campo, rotulo, Icone]) => {
                const ligado = sala[campo];
                return (
                  <button
                    key={campo}
                    onClick={() => aoMudarSala(sala, { [campo]: !ligado })}
                    disabled={ocupado}
                    className="flex items-center gap-1 px-3 py-2.5 min-h-[44px] md:px-2.5 md:py-1.5 md:min-h-0 rounded-lg text-xs disabled:opacity-40"
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
                  aoMudarSala(sala, {
                    access_type: sala.access_type === "OPEN" ? "TRUSTED" : "OPEN",
                  })
                }
                disabled={ocupado}
                title="Aberta deixa entrar sem bater à porta. Fechada exige que você aceite cada pessoa."
                className="flex items-center gap-1 px-3 py-2.5 min-h-[44px] md:px-2.5 md:py-1.5 md:min-h-0 rounded-lg text-xs disabled:opacity-40"
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
                  onClick={() => aoMudarSala(sala, { janela_automatica: true })}
                  disabled={ocupado}
                  className="flex items-center px-3 py-2.5 min-h-[44px] md:px-2.5 md:py-1.5 md:min-h-0 rounded-lg text-xs text-cream/40 border border-white/10"
                >
                  voltar ao horário
                </button>
              )}

              {/* Encerrar derruba todo mundo de dentro, então pergunta antes e
                  fica separado dos interruptores, que são reversíveis; gap-2 do
                  container acima já garante distância mínima dos outros botões. */}
              <button
                onClick={() => aoEncerrar(sala)}
                disabled={ocupado}
                title="Encerra a reunião em andamento para todos, sem precisar entrar nela."
                className="flex items-center gap-1 px-3 py-2.5 min-h-[44px] md:px-2.5 md:py-1.5 md:min-h-0 rounded-lg text-xs disabled:opacity-40"
                style={{
                  background: "rgba(255,77,77,0.08)",
                  color: "#FF6B6B",
                  border: "1px solid rgba(255,77,77,0.22)",
                }}
              >
                <PhoneOff className="h-3 w-3" /> Encerrar
              </button>

              <span className="flex items-center gap-1 text-xs text-cream/30 w-full justify-end mt-1 sm:w-auto sm:ml-auto sm:justify-start sm:mt-0">
                <Clock3 className="h-3 w-3" />
                {sala.duracao_min ? `${sala.duracao_min} min` : "duração padrão"}
              </span>
            </div>

            {/* Os encontros passados: quando foram, quanto duraram, quem veio.
                Os cortes ficam na outra aba — daqui sai só o atalho, porque
                avaliar quarenta cortes não é coisa que se faça de passagem. */}
            <div className="mt-4 space-y-1.5">
              {sala.encontros.length === 0 && (
                <p className="text-xs text-cream/30">Nenhum encontro capturado ainda.</p>
              )}

              {sala.encontros.slice(0, 8).map((e) => (
                <div
                  key={e.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 rounded-xl px-3 py-2"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
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

                  <span className="flex items-center gap-3 text-[11px]">
                    {e.youtube_video_id && (
                      <a
                        href={`https://www.youtube.com/watch?v=${e.youtube_video_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1"
                        style={{ color: "#FF4D4D" }}
                      >
                        <Youtube className="h-3.5 w-3.5" /> inteiro
                      </a>
                    )}
                    <span className="text-cream/35">
                      {e.clipes.length ? `${e.clipes.length} cortes` : "sem cortes"}
                    </span>
                  </span>
                </div>
              ))}

              {sala.encontros.length > 8 && (
                <p className="text-[11px] text-cream/25 px-3">
                  e mais {sala.encontros.length - 8} encontros
                </p>
              )}
            </div>

            {porVer > 0 && (
              <button
                onClick={aoVerCortes}
                className="mt-3 w-full sm:w-auto flex sm:inline-flex items-center justify-center sm:justify-start gap-1.5 px-4 sm:px-3 py-3 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-xs font-medium"
                style={{
                  background: "rgba(108,92,231,0.12)",
                  color: ROXO,
                  border: "1px solid rgba(108,92,231,0.3)",
                }}
              >
                <Scissors className="h-3.5 w-3.5" />
                {porVer} {porVer === 1 ? "corte por avaliar" : "cortes por avaliar"}
              </button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
