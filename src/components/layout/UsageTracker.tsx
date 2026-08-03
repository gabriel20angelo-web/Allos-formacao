"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Sinal de presença da plataforma.
 *
 * O player é um iframe cross-origin, então não dá para ler quanto tempo o vídeo
 * de fato rodou. O que se pode medir com honestidade é permanência ativa: este
 * componente avisa o servidor a cada minuto enquanto a aba está visível E a
 * pessoa deu algum sinal de vida recente. Quem costura os sinais em sessões é
 * /formacao/api/usage-ping.
 *
 * Não renderiza nada.
 */

const ENDPOINT = "/formacao/api/usage-ping";

const INTERVALO_PING_MS = 60 * 1000;

// Sem esse corte, uma aba esquecida aberta a noite inteira viraria oito horas
// de estudo. Mexer o mouse, digitar, clicar, rolar ou tocar a tela conta como
// presença; passados 15 minutos sem nada disso, o relógio para até a próxima
// interação.
const LIMITE_OCIOSIDADE_MS = 15 * 60 * 1000;

// Visitante deslogado toma 401. Em vez de bater na rota a cada minuto para
// sempre, espera antes de tentar de novo, o que também cobre quem faz login
// depois sem recarregar a página.
const ESPERA_APOS_401_MS = 5 * 60 * 1000;

const EVENTOS_DE_INTERACAO = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function derivarContexto(pathname: string): string {
  if (/^\/formacao\/curso\/[^/]+\/assistir(\/|$)/.test(pathname)) return "aula";
  if (/^\/formacao\/curso\/[^/]+/.test(pathname)) return "curso";
  if (pathname.startsWith("/formacao/meus-cursos")) return "meus-cursos";
  if (pathname.startsWith("/formacao/admin")) return "admin";
  return "formacao";
}

interface PayloadPing {
  contexto: string;
  lessonId: string | null;
}

function UsageTrackerInterno() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const contexto = derivarContexto(pathname);
  // A aula vem do ?lesson= que a própria tela de assistir mantém na URL. Fora
  // dessa rota, ou sem uuid válido, vai null: nenhum id é inventado aqui.
  const lessonParam = searchParams.get("lesson");
  const lessonId =
    contexto === "aula" && lessonParam && UUID_RE.test(lessonParam) ? lessonParam : null;

  // O payload vive em ref para o intervalo não precisar ser recriado a cada
  // navegação; o efeito principal monta uma vez só.
  const payloadRef = useRef<PayloadPing>({ contexto, lessonId });
  useEffect(() => {
    payloadRef.current = { contexto, lessonId };
  }, [contexto, lessonId]);

  useEffect(() => {
    let vivo = true;
    const ultimaInteracao = { em: Date.now() };
    const bloqueadoAte = { em: 0 };

    function estaOcioso() {
      return Date.now() - ultimaInteracao.em > LIMITE_OCIOSIDADE_MS;
    }

    function enviarPing(usarBeacon = false) {
      if (!vivo) return;
      if (Date.now() < bloqueadoAte.em) return;
      if (estaOcioso()) return;
      // No beacon a aba já está escondida por definição: é justamente o trecho
      // final que se quer registrar antes de perder a chance.
      if (!usarBeacon && document.visibilityState !== "visible") return;

      const corpo = JSON.stringify({
        contexto: payloadRef.current.contexto,
        courseId: null,
        lessonId: payloadRef.current.lessonId,
      });

      if (usarBeacon && typeof navigator.sendBeacon === "function") {
        try {
          navigator.sendBeacon(ENDPOINT, new Blob([corpo], { type: "application/json" }));
        } catch {
          // beacon bloqueado (extensão, política do navegador): perder o
          // último trecho é aceitável, atrapalhar a navegação não.
        }
        return;
      }

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: corpo,
      })
        .then((res) => {
          if (res.status === 401) bloqueadoAte.em = Date.now() + ESPERA_APOS_401_MS;
        })
        .catch(() => {
          // rede caiu: o próximo minuto tenta de novo
        });
    }

    function registrarInteracao() {
      const voltouDoOcioso = estaOcioso();
      ultimaInteracao.em = Date.now();
      // Retomar já no gesto evita descartar até um minuto inteiro esperando o
      // próximo tique do intervalo.
      if (voltouDoOcioso) enviarPing();
    }

    function aoMudarVisibilidade() {
      if (document.visibilityState === "visible") {
        enviarPing();
      } else {
        enviarPing(true);
      }
    }

    for (const evento of EVENTOS_DE_INTERACAO) {
      window.addEventListener(evento, registrarInteracao, { passive: true });
    }
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    enviarPing();
    const intervalo = window.setInterval(() => enviarPing(), INTERVALO_PING_MS);

    return () => {
      vivo = false;
      window.clearInterval(intervalo);
      for (const evento of EVENTOS_DE_INTERACAO) {
        window.removeEventListener(evento, registrarInteracao);
      }
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, []);

  return null;
}

export default function UsageTracker() {
  // useSearchParams obriga fronteira de Suspense no App Router do Next 14,
  // senão a rota inteira cai para renderização dinâmica.
  return (
    <Suspense fallback={null}>
      <UsageTrackerInterno />
    </Suspense>
  );
}
