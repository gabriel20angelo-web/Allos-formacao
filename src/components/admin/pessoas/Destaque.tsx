// A estrela: marcar uma pessoa para ela chamar atenção na lista.
//
// Uma lista de 511 nomes não guarda memória de quem você decidiu chamar. Este é
// o recurso que guarda: a estrela pinta a linha, a cor separa um motivo do
// outro, e a nota diz o que era para lembrar. Nada disso é calculado, é escolha
// de quem administra, e por isso vive numa tabela própria (migration 092).
//
// A estrela é otimista de propósito: clicou, pintou. Marcar é uma decisão de um
// clique só, e esperar meio segundo pelo banco para ver a cor mudar faz a lista
// inteira parecer travada. Se o banco recusar, a cor volta e o aviso explica.
//
// As quatro cores não têm significado fixo escrito em lugar nenhum, e isso é
// deliberado: quem usa decide o que cada uma quer dizer, e uma taxonomia
// imposta por quem escreve o código costuma não sobreviver ao primeiro mês.

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Star, X } from "lucide-react";
import type { DestaqueDaPessoa } from "@/lib/pessoas/agregar";

export const CORES_DESTAQUE: Record<DestaqueDaPessoa["cor"], string> = {
  dourado: "#D4A857",
  terracota: "#C84B31",
  teal: "#2E9E8F",
  roxo: "#6C5CE7",
};

export type MudancaDestaque = {
  pessoaId: string;
  destaque: DestaqueDaPessoa | null;
};

async function gravar(
  pessoaId: string,
  corpo: { cor?: string; nota?: string } | null,
): Promise<DestaqueDaPessoa | null> {
  if (corpo === null) {
    const r = await fetch(
      `/formacao/api/admin/pessoas/marcar?pessoaId=${encodeURIComponent(pessoaId)}`,
      { method: "DELETE" },
    );
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Falhou.");
    return null;
  }
  const r = await fetch("/formacao/api/admin/pessoas/marcar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pessoaId, ...corpo }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Falhou.");
  return {
    cor: j.destaque?.cor ?? "dourado",
    nota: j.destaque?.nota ?? null,
    criadaEm: j.destaque?.criada_em ?? null,
  };
}

/**
 * A estrela e, quando já marcada, o painel de cor e nota.
 *
 * `onMudou` recebe o estado novo para a lista repintar sem recarregar o retrato
 * inteiro: são cerca de um megabyte de leitura no servidor, e refazê-la a cada
 * clique de estrela seria trocar um recurso rápido por um lento.
 */
export default function Destaque({
  pessoaId,
  nome,
  destaque,
  onMudou,
}: {
  pessoaId: string;
  nome: string;
  destaque: DestaqueDaPessoa | null;
  onMudou: (m: MudancaDestaque) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState(destaque?.nota ?? "");
  const [salvando, setSalvando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => setNota(destaque?.nota ?? ""), [destaque?.nota]);

  // Fecha ao clicar fora e no Escape, como os outros painéis do admin.
  useEffect(() => {
    if (!aberto) return;
    const clique = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", clique);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", clique);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const cor = destaque ? CORES_DESTAQUE[destaque.cor] : "rgba(253,251,247,0.2)";

  const alternar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (destaque) {
      setAberto((v) => !v);
      return;
    }
    // Otimismo: pinta antes de o banco confirmar, e desfaz se ele recusar.
    onMudou({ pessoaId, destaque: { cor: "dourado", nota: null, criadaEm: null } });
    try {
      const novo = await gravar(pessoaId, { cor: "dourado" });
      onMudou({ pessoaId, destaque: novo });
    } catch (err) {
      onMudou({ pessoaId, destaque: null });
      toast.error(
        err instanceof Error && err.message.includes("does not exist")
          ? "Falta rodar a migration 092 (destaque de pessoa) no Supabase."
          : "Não consegui destacar essa pessoa.",
      );
    }
  };

  const trocarCor = async (nova: DestaqueDaPessoa["cor"], e: React.MouseEvent) => {
    e.stopPropagation();
    const antes = destaque;
    onMudou({ pessoaId, destaque: { ...(destaque ?? { nota: null, criadaEm: null }), cor: nova } });
    try {
      onMudou({ pessoaId, destaque: await gravar(pessoaId, { cor: nova }) });
    } catch {
      if (antes) onMudou({ pessoaId, destaque: antes });
      toast.error("Não consegui trocar a cor.");
    }
  };

  const salvarNota = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSalvando(true);
    try {
      const novo = await gravar(pessoaId, { cor: destaque?.cor ?? "dourado", nota });
      onMudou({ pessoaId, destaque: novo });
      setAberto(false);
      toast.success("Anotação salva.");
    } catch {
      toast.error("Não consegui salvar a anotação.");
    } finally {
      setSalvando(false);
    }
  };

  const tirar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const antes = destaque;
    onMudou({ pessoaId, destaque: null });
    setAberto(false);
    try {
      await gravar(pessoaId, null);
    } catch {
      if (antes) onMudou({ pessoaId, destaque: antes });
      toast.error("Não consegui tirar o destaque.");
    }
  };

  return (
    <div className="relative" ref={caixa}>
      <button
        onClick={alternar}
        title={destaque ? `Destacada. Clique para editar.` : `Destacar ${nome.split(" ")[0]}`}
        aria-label={destaque ? "Editar destaque" : "Destacar pessoa"}
        // Alvo grande no celular. Ela fica a oito pixels de um botão que ocupa
        // a linha inteira e abre o dossiê: com 28px de alvo, o dedo erra e
        // abre a ficha de alguém em vez de marcar.
        className="p-3 -m-1 sm:p-1.5 sm:m-0 rounded-full transition-colors hover:bg-white/[.06]"
      >
        <Star
          className="h-4 w-4 transition-colors"
          style={{ color: cor }}
          fill={destaque ? cor : "none"}
        />
      </button>

      {aberto && destaque && (
        <div
          onClick={(e) => e.stopPropagation()}
          // No celular vira uma folha ancorada na base da tela; do tablet para
          // cima volta a ser o balão ao lado da estrela. Três problemas caem
          // com essa única mudança:
          //
          //   1. `Card` usa `backdrop-blur-md`, e filtro cria contexto de
          //      empilhamento: o `z-30` ficava preso dentro do card de origem,
          //      então o balão da última linha de um bloco era coberto e
          //      borrado pelo card seguinte. `fixed` escapa disso.
          //   2. `top-9` abria sempre para baixo, sem virar quando não havia
          //      espaço. Na metade de baixo de uma lista de 25 linhas, o painel
          //      abria fora da dobra e o teclado do celular tapava o resto.
          //   3. Ancorado à direita de uma estrela que já está na borda, um
          //      painel de 16rem encostava na margem oposta com zero de folga,
          //      e num aparelho de 320px passava direto para fora.
          className="fixed inset-x-3 bottom-3 z-50 p-4 rounded-[12px] shadow-xl
                     sm:absolute sm:inset-auto sm:right-0 sm:top-9 sm:bottom-auto sm:w-64 sm:p-3"
          style={{ background: "rgba(26,26,26,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/30">
              Destaque
            </span>
            <button
              onClick={() => setAberto(false)}
              className="p-2.5 -m-1.5 sm:p-1 sm:m-0 rounded-full hover:bg-white/[.06]"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-cream/35" />
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            {(Object.keys(CORES_DESTAQUE) as DestaqueDaPessoa["cor"][]).map((c) => (
              <button
                key={c}
                onClick={(e) => trocarCor(c, e)}
                aria-label={`Cor ${c}`}
                className="h-9 w-9 sm:h-6 sm:w-6 rounded-full transition-transform hover:scale-110"
                style={{
                  background: CORES_DESTAQUE[c],
                  outline: destaque.cor === c ? "2px solid rgba(253,251,247,0.6)" : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>

          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) salvarNota(e as unknown as React.MouseEvent);
            }}
            placeholder="Por que essa pessoa? Ex: convidar para monitoria."
            rows={2}
            maxLength={500}
            // `text-base` no celular por causa do Safari do iPhone, que dá zoom
            // automático em campo com fonte abaixo de 16px. Com o painel colado
            // na borda, esse zoom joga metade dele para fora e não há como
            // voltar sem fechar. O campo de busca da tela já resolve assim.
            className="dark-input w-full rounded-[8px] px-2.5 py-2 font-dm text-base sm:text-xs resize-none"
          />

          <div className="flex items-center justify-between mt-2.5">
            <button
              onClick={tirar}
              className="font-dm text-[11px] text-cream/35 hover:text-cream/60 transition-colors inline-flex items-center min-h-[44px] sm:min-h-0 px-2 -mx-2"
            >
              Tirar destaque
            </button>
            <button
              onClick={salvarNota}
              disabled={salvando || nota === (destaque.nota ?? "")}
              className="font-dm text-[11px] px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-full transition-all disabled:opacity-40 min-h-[44px] sm:min-h-0"
              style={{ background: "linear-gradient(135deg, #C84B31, #A33D27)", color: "#FDFBF7" }}
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
