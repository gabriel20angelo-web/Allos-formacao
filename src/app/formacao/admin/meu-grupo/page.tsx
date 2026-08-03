"use client";

// A área de quem conduz.
//
// A página tinha tudo numa coluna só, e o que a pessoa vem fazer toda semana —
// avaliar os cortes — estava no fundo dela, atrás de dois acordeões. Os
// interruptores da sala, que se mexem uma vez por semestre, ficavam no topo.
//
// Agora são três abas, e a ordem responde à pergunta de quem abre: o que
// acontece no meu encontro, o que saiu dele, e o combinado. A aba dos cortes
// carrega o contador, porque é ela que costuma ter trabalho esperando.
//
// Aqui ficaram só os dados e o que muda o servidor. Cada aba é um arquivo.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import ComoFunciona from "./ComoFunciona";
import AbaEncontro from "./AbaEncontro";
import AbaCortes from "./AbaCortes";
import Player from "./Player";
import { toast } from "sonner";
import { BookOpen, Scissors, Video } from "lucide-react";
import type { ClipeC, SalaC } from "./tipos";

type Aba = "encontro" | "cortes" | "combinado";

const ABAS: { id: Aba; rotulo: string; icone: typeof Video }[] = [
  { id: "encontro", rotulo: "Meu encontro", icone: Video },
  { id: "cortes", rotulo: "Cortes", icone: Scissors },
  { id: "combinado", rotulo: "Como funciona", icone: BookOpen },
];

export default function MeuGrupoPage() {
  const { profile, loading: carregandoPerfil } = useAuth();
  const [salas, setSalas] = useState<SalaC[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("encontro");
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

  async function encerrarReuniao(sala: SalaC) {
    if (
      !confirm(
        `Encerrar a reunião de ${sala.atividade_nome || sala.rotulo || "este grupo"} agora?\n\n` +
          "Todo mundo que estiver dentro sai na hora."
      )
    )
      return;

    setTrabalhando(sala.space_name);
    try {
      const r = await fetch("/formacao/api/condutor/grupo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_name: sala.space_name }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não consegui encerrar.");
      toast.success("Reunião encerrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
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

  function assistir(c: ClipeC) {
    setAnotacao(c.anotacao || "");
    setAssistindo(c);
  }

  if (carregandoPerfil || carregando) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const porVer = salas.reduce(
    (n, s) => n + s.encontros.reduce((m, e) => m + e.clipes.filter((c) => !c.avaliacao).length, 0),
    0
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-fraunces font-bold text-2xl text-cream mb-1">Meu grupo</h1>
        <p className="text-sm text-cream/50">
          {profile?.full_name ? `${profile.full_name}, aqui` : "Aqui"} você ajusta o que acontece
          no seu encontro e olha o que saiu dele.
        </p>
      </div>

      {/* As abas. O contador fica no que costuma ter trabalho esperando — sem
          ele, a fila de cortes só é descoberta por quem for procurar. */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {ABAS.map(({ id, rotulo, icone: Icone }) => {
          const ativa = aba === id;
          return (
            <button
              key={id}
              onClick={() => setAba(id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: ativa ? "rgba(200,75,49,0.14)" : "rgba(255,255,255,0.03)",
                color: ativa ? "#E8836A" : "rgba(253,251,247,0.45)",
                border: `1px solid ${ativa ? "rgba(200,75,49,0.32)" : "rgba(255,255,255,0.07)"}`,
              }}
            >
              <Icone className="h-3.5 w-3.5" />
              {rotulo}
              {id === "cortes" && porVer > 0 && (
                <span
                  className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: ativa ? "rgba(255,255,255,0.16)" : "rgba(212,168,87,0.14)",
                    color: ativa ? "#FDFBF7" : "#D4A857",
                  }}
                  aria-label={`${porVer} cortes por avaliar`}
                >
                  {porVer}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {erro && (
        <Card className="p-4 border border-amber-400/30">
          <p className="text-sm text-cream/70">{erro}</p>
        </Card>
      )}

      {aba === "encontro" && (
        <AbaEncontro
          salas={salas}
          trabalhando={trabalhando}
          aoMudarSala={mudarSala}
          aoEncerrar={encerrarReuniao}
          aoVerCortes={() => setAba("cortes")}
        />
      )}

      {aba === "cortes" && (
        <AbaCortes salas={salas} aoAssistir={assistir} aoAvaliar={avaliar} />
      )}

      {aba === "combinado" && <ComoFunciona inicialmenteAberto />}

      {assistindo && (
        <Player
          clipe={assistindo}
          anotacao={anotacao}
          aoMudarAnotacao={setAnotacao}
          aoSalvarAnotacao={salvarAnotacao}
          aoAvaliar={avaliar}
          aoFechar={() => setAssistindo(null)}
        />
      )}
    </div>
  );
}
