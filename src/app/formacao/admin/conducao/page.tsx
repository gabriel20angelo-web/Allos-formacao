"use client";

// O começo da área de quem conduz.
//
// Três coisas moravam em cantos diferentes do sistema: a tela do grupo, o
// acervo de dinâmicas e os eventos. É a mesma pessoa usando as três — quem
// conduz um grupo procura uma dinâmica para levar nele, e às vezes cuida de um
// evento —, e a separação obrigava a lembrar em qual menu estava o quê.
//
// Aqui elas aparecem juntas, e cada uma só para quem lhe cabe. O cartão traz
// um número porque um cartão sem número não diz se há trabalho esperando: o
// que decide se a pessoa abre "Meu grupo" hoje é saber que há cortes por
// avaliar lá dentro.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import Skeleton from "@/components/ui/Skeleton";
import { AREAS, circulaLivre, podeVer, type Area } from "@/lib/areas";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Compass,
  Sparkles,
  Users,
  Video,
  AlertTriangle,
} from "lucide-react";

// `formacao_slots.dia_semana` é CHECK 0..4: zero é segunda, não domingo.
const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

interface Resumo {
  grupo?: {
    semFicha?: boolean;
    salas: { dia_semana: number | null; hora: string | null; atividade_nome: string | null }[];
    cortesPorVer: number;
    ultimoEncontro: string | null;
  };
  eventos?: { ativos: number; proximo: { titulo: string; data_inicio: string } | null };
  dinamicas?: { publicados: number };
}

/** A cor de cada área. Serve para reconhecer o cartão antes de ler o título. */
const CORES: Record<string, { cor: string; tinta: string; borda: string }> = {
  "meu-grupo": { cor: "#6C5CE7", tinta: "rgba(108,92,231,0.10)", borda: "rgba(108,92,231,0.28)" },
  dinamicas: { cor: "#C84B31", tinta: "rgba(200,75,49,0.10)", borda: "rgba(200,75,49,0.28)" },
  eventos: { cor: "#D946EF", tinta: "rgba(217,70,239,0.10)", borda: "rgba(217,70,239,0.28)" },
  associados: { cor: "#D4A857", tinta: "rgba(212,168,87,0.10)", borda: "rgba(212,168,87,0.28)" },
};

const ICONES: Record<string, typeof Compass> = {
  "meu-grupo": Video,
  dinamicas: Sparkles,
  eventos: CalendarDays,
  associados: Users,
};

export default function ConducaoPage() {
  const { profile, cargos, loading: carregandoPerfil } = useAuth();
  const [resumo, setResumo] = useState<Resumo>({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    fetch("/formacao/api/conducao/resumo")
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => {
        if (!cancelado) setResumo(j);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const livre = circulaLivre(cargos);

  // As áreas da seção, menos esta — um cartão apontando para a própria tela
  // seria só ruído.
  const areas = AREAS.filter(
    (a) => a.grupo === "conducao" && a.id !== "conducao" && podeVer(a, cargos)
  );

  /** A linha de número do cartão. É o que diz se há trabalho esperando. */
  function detalhe(area: Area): { texto: string; alerta?: boolean } | null {
    if (area.id === "meu-grupo") {
      const g = resumo.grupo;
      if (!g) return null;
      if (g.semFicha) {
        return {
          texto: "Sua conta ainda não está ligada a uma ficha de condutor",
          alerta: true,
        };
      }
      if (g.cortesPorVer > 0) {
        return {
          texto: `${g.cortesPorVer} ${g.cortesPorVer === 1 ? "corte" : "cortes"} por avaliar`,
          alerta: true,
        };
      }
      const sala = g.salas[0];
      if (sala && sala.dia_semana !== null) {
        return {
          texto: `${DIAS[sala.dia_semana]}${sala.hora ? ` · ${sala.hora}` : ""}${
            g.salas.length > 1 ? ` e mais ${g.salas.length - 1}` : ""
          }`,
        };
      }
      return { texto: "Nenhum horário com sala criada ainda" };
    }

    if (area.id === "dinamicas") {
      const d = resumo.dinamicas;
      return d ? { texto: `${d.publicados} exercícios publicados` } : null;
    }

    if (area.id === "eventos") {
      const e = resumo.eventos;
      if (!e) return null;
      if (e.proximo) {
        const quando = new Date(e.proximo.data_inicio).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        });
        return { texto: `Próximo: ${e.proximo.titulo} · ${quando}` };
      }
      return { texto: `${e.ativos} ${e.ativos === 1 ? "evento ativo" : "eventos ativos"}` };
    }

    if (area.id === "associados") {
      return { texto: "Curadoria do acervo e fila de sugestões" };
    }

    return null;
  }

  if (carregandoPerfil) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const primeiroNome = profile?.full_name?.split(" ")[0];

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <Compass className="h-5 w-5" style={{ color: "#C84B31" }} />
          <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
            Condução
          </h1>
        </div>
        <p className="font-dm text-sm text-cream/40">
          {primeiroNome ? `${primeiroNome}, tudo` : "Tudo"} o que é seu está aqui:{" "}
          {areas.length === 1
            ? "a sua área."
            : "o seu grupo, as dinâmicas para levar até ele e os eventos."}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {areas.map((area) => {
          const cor = CORES[area.id] || CORES.dinamicas;
          const Icone = ICONES[area.id] ?? Compass;
          const info = carregando ? null : detalhe(area);
          const nome = livre && area.rotuloAdmin ? area.rotuloAdmin : area.rotulo;

          return (
            <Link
              key={area.id}
              href={area.href}
              className="group block rounded-2xl p-5 transition-all duration-200 hover:translate-y-[-1px] relative"
              style={{
                background: `linear-gradient(135deg, ${cor.tinta} 0%, rgba(255,255,255,0.02) 100%)`,
                border: `1px solid ${cor.borda}`,
              }}
            >
              <div className="flex items-start gap-3 mb-2">
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: cor.tinta, border: `1px solid ${cor.borda}` }}
                >
                  <Icone className="h-4 w-4" style={{ color: cor.cor }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-fraunces text-lg text-cream leading-snug group-hover:text-accent transition-colors">
                    {nome}
                  </h2>
                </div>
                {area.saiDoPainel ? (
                  <ArrowUpRight className="h-4 w-4 text-cream/25 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-cream/25 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                )}
              </div>

              <p className="font-dm text-[13px] text-cream/55 leading-relaxed">
                {area.resumo}
              </p>

              {carregando && (
                <div className="mt-3">
                  <Skeleton className="h-4 w-40" />
                </div>
              )}

              {info && (
                <p
                  className="font-dm text-[12px] mt-3 inline-flex items-center gap-1.5"
                  style={{ color: info.alerta ? cor.cor : "rgba(253,251,247,0.35)" }}
                >
                  {info.alerta && <AlertTriangle className="h-3 w-3 flex-shrink-0" />}
                  {info.texto}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      {/* O vínculo entre conta e ficha é o que faz a área do grupo existir, e
          quando falta, o condutor vê uma tela vazia sem saber por quê. Só o
          administrador pode ligar as duas, então só ele recebe o atalho. */}
      {livre && (
        <p className="font-dm text-[12px] text-cream/25 mt-6">
          Quem conduz só enxerga o próprio grupo depois que a conta é ligada à ficha, em{" "}
          <Link
            href="/formacao/admin/condutores"
            className="text-cream/45 hover:text-accent transition-colors underline underline-offset-2"
          >
            Condutores
          </Link>
          . O cargo sozinho não basta, e a troca de cargo só vale no próximo login da pessoa.
        </p>
      )}
    </div>
  );
}
