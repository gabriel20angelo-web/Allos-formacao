"use client";

// A tela de meio segundo entre o WhatsApp e o Meet.
//
// Ela existe por dois motivos, e o segundo é o que mais importa: primeiro,
// porque um redirecionamento de servidor faria o WhatsApp mostrar o logo do
// Google em vez da Allos; segundo, porque quem chega por um link no celular
// muitas vezes chega com dúvida — se a página piscar e jogar direto no Meet,
// ninguém sabe em que grupo entrou.
//
// Então o encaminhamento é automático e rápido, mas o nome do grupo aparece
// antes, e há um botão para quem chegou pelo navegador do próprio WhatsApp
// (onde o encaminhamento automático às vezes é bloqueado).

import { useEffect, useState } from "react";
import { Video } from "lucide-react";

export default function EntrarNoEncontro({
  destino,
  nome,
}: {
  destino: string;
  nome: string | null;
}) {
  const [demorou, setDemorou] = useState(false);

  useEffect(() => {
    // Curto o bastante para não parecer uma parada, longo o bastante para o
    // nome do grupo ser lido.
    const irEmbora = setTimeout(() => {
      window.location.replace(destino);
    }, 900);

    // O navegador embutido do WhatsApp às vezes ignora o replace. Depois de
    // três segundos, quem ainda está aqui precisa de um botão, não de mais
    // espera.
    const desistir = setTimeout(() => setDemorou(true), 3000);

    return () => {
      clearTimeout(irEmbora);
      clearTimeout(desistir);
    };
  }, [destino]);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#111111" }}
    >
      <div className="text-center max-w-sm w-full">
        <div
          className="mx-auto mb-5 flex items-center justify-center rounded-2xl"
          style={{
            width: 64,
            height: 64,
            background: "rgba(200,75,49,0.12)",
            border: "1px solid rgba(200,75,49,0.25)",
          }}
        >
          <Video className="h-7 w-7" style={{ color: "#C84B31" }} />
        </div>

        <p
          className="font-dm text-[11px] tracking-[0.28em] uppercase mb-2"
          style={{ color: "#C84B31" }}
        >
          Encontro ao vivo
        </p>

        <h1 className="font-fraunces font-bold text-2xl text-cream leading-tight mb-2">
          {nome || "Encontro online"}
        </h1>

        <p className="text-sm text-cream/45 mb-7">
          {demorou ? "Toque no botão para entrar." : "Abrindo a sala…"}
        </p>

        <a
          href={destino}
          className="block w-full px-6 py-4 rounded-2xl font-dm font-semibold text-base text-white"
          style={{
            background: "linear-gradient(135deg, #C84B31, #A33D27)",
            boxShadow: "0 4px 20px rgba(200,75,49,0.35)",
          }}
        >
          Entrar no encontro agora
        </a>

        <p className="text-xs text-cream/25 mt-6">Associação Allos · allos.org.br</p>
      </div>
    </main>
  );
}
