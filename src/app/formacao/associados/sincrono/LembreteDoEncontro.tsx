"use client";

// As três coisas que não podem faltar em nenhum encontro.
//
// São as que mais dão problema depois e as que só têm conserto na hora: a
// conta com que se entra, o link por onde se entra, e o link do certificado no
// chat. Errar qualquer uma das três produz o mesmo estrago silencioso — o
// encontro acontece normalmente, ninguém percebe nada, e depois não existe
// gravação, nem transcrição, nem corte, nem presença de ninguém.
//
// Estão na ordem em que se fazem, não na ordem de importância: entrar com a
// conta certa, no link certo, e mandar o certificado.
//
// Fica aberto, dentro do cartão do grupo, e não numa página de instruções: o
// que se lê uma vez no começo some da memória três semanas depois, que é
// justamente quando passa a fazer falta.

import { Copy, CircleAlert } from "lucide-react";
import { toast } from "sonner";

const LINK_CERTIFICADO = "https://allos.org.br/certificado";

export default function LembreteDoEncontro({
  linkDoMeet,
}: {
  linkDoMeet?: string | null;
}) {
  async function copiar(texto: string, oQue: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${oQue} copiado.`);
    } catch {
      toast.error("Não consegui copiar. Selecione e copie à mão.");
    }
  }

  return (
    <div
      className="rounded-xl p-3 mt-3"
      style={{
        background: "rgba(212,168,87,0.07)",
        border: "1px solid rgba(212,168,87,0.24)",
      }}
    >
      <p
        className="flex items-center gap-1.5 text-xs font-semibold mb-2"
        style={{ color: "#D4A857" }}
      >
        <CircleAlert className="h-3.5 w-3.5 shrink-0" />
        Em todo encontro, sem exceção
      </p>

      <ol className="space-y-2.5">
        <li className="text-[12px] text-cream/70 leading-relaxed">
          <span className="text-cream/90 font-medium">
            Entre com a conta do Google da Allos, a mesma do Drive.
          </span>{" "}
          É ela que autoriza a gravação. Entrando pela conta pessoal, a reunião acontece
          normalmente e simplesmente não começa a gravar, sem avisar nada a ninguém. Confira no
          canto da tela do Meet antes de começar.
        </li>

        <li className="text-[12px] text-cream/70 leading-relaxed">
          <span className="text-cream/90 font-medium">
            Use sempre o link do Meet deste grupo.
          </span>{" "}
          É o único que o sistema acompanha. Reunião aberta por fora não é gravada, não vira
          transcrição, não gera cortes e não conta presença para ninguém.
          {linkDoMeet && (
            <button
              onClick={() => copiar(linkDoMeet, "Link do Meet")}
              className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
              style={{
                background: "rgba(212,168,87,0.12)",
                color: "#D4A857",
                border: "1px solid rgba(212,168,87,0.3)",
              }}
            >
              <Copy className="h-3 w-3" />
              {linkDoMeet.replace(/^https?:\/\//, "")}
            </button>
          )}
        </li>

        <li className="text-[12px] text-cream/70 leading-relaxed">
          <span className="text-cream/90 font-medium">
            Mande o link do certificado no chat da reunião.
          </span>{" "}
          É onde quem participou registra a presença. O que não for preenchido ali não entra no
          certificado da pessoa, e depois do encontro não há como recuperar.
          <button
            onClick={() => copiar(LINK_CERTIFICADO, "Link do certificado")}
            className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
            style={{
              background: "rgba(212,168,87,0.12)",
              color: "#D4A857",
              border: "1px solid rgba(212,168,87,0.3)",
            }}
          >
            <Copy className="h-3 w-3" />
            allos.org.br/certificado
          </button>
        </li>
      </ol>
    </div>
  );
}
