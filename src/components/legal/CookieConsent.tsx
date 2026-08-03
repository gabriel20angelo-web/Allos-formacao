"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  defaultCategories,
  getConsent,
  saveConsent,
  shouldAskAgain,
  type ConsentCategories,
  type OptionalCategory,
} from "@/lib/cookies/consent";

type Mode = "hidden" | "banner" | "panel";

interface CategoryCopy {
  key: OptionalCategory;
  label: string;
  description: string;
  anchor: string;
}

/** Textos derivados da cláusula 2 da Política de Cookies. */
const NECESSARIOS_COPY = {
  label: "Necessários",
  description:
    "Mantêm sua sessão aberta, protegem os formulários e guardam a sua escolha sobre esta política. Sem eles não é possível fazer login nem acessar as aulas.",
  anchor: "/formacao/cookies#necessarios",
};

const OPTIONAL_COPY: CategoryCopy[] = [
  {
    key: "preferencias",
    label: "Preferências",
    description:
      "Guardam ajustes que você faz na interface, como o ponto em que parou a aula. Sem eles o site esquece essas escolhas.",
    anchor: "/formacao/cookies#preferencias",
  },
  {
    key: "estatisticos",
    label: "Estatísticos",
    description:
      "Mediriam, de forma agregada, quantas pessoas acessam as páginas e quais conteúdos são mais procurados. Nenhuma ferramenta desse tipo está ativa no momento, então nada é gravado nesta categoria.",
    anchor: "/formacao/cookies#estatisticos",
  },
  {
    key: "marketing",
    label: "Marketing",
    description:
      "Mediriam o resultado das nossas divulgações e permitiriam exibir conteúdo da Allos para quem já visitou o site. Nenhuma ferramenta desse tipo está ativa no momento, então nada é gravado nesta categoria.",
    anchor: "/formacao/cookies#marketing",
  },
];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Os três botões do aviso têm exatamente o mesmo peso visual (cláusula 3.1). */
const bannerAction =
  "inline-flex items-center justify-center rounded-[10px] border border-[rgba(253,251,247,0.28)] bg-[rgba(255,255,255,0.05)] px-5 py-2.5 font-dm text-sm font-medium text-cream transition-colors hover:bg-[rgba(255,255,255,0.1)] hover:border-[rgba(253,251,247,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C84B31]";

const panelAction =
  "inline-flex items-center justify-center rounded-[10px] border border-[rgba(253,251,247,0.28)] bg-[rgba(255,255,255,0.05)] px-4 py-2.5 font-dm text-sm font-medium text-cream transition-colors hover:bg-[rgba(255,255,255,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C84B31]";

const policyLink =
  "underline decoration-[rgba(200,75,49,0.6)] underline-offset-2 transition-colors hover:text-[#C84B31] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C84B31]";

function Toggle({
  checked,
  locked,
  label,
  onChange,
}: {
  checked: boolean;
  locked?: boolean;
  label: string;
  onChange?: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={locked ? true : undefined}
      disabled={locked}
      onClick={locked ? undefined : () => onChange?.(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C84B31] ${
        checked
          ? "border-[#C84B31] bg-[#C84B31]"
          : "border-[rgba(253,251,247,0.25)] bg-[rgba(255,255,255,0.06)]"
      } ${locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1/2 block h-4 w-4 -translate-y-1/2 rounded-full bg-cream transition-[left] duration-200 ${
          checked ? "left-[22px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

export default function CookieConsent() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [draft, setDraft] = useState<ConsentCategories>(defaultCategories);

  const bannerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Primeiro acesso, versão nova da política ou registro com mais de 6 meses.
  useEffect(() => {
    if (shouldAskAgain()) setMode("banner");
  }, []);

  const openPanel = useCallback(() => {
    const record = getConsent();
    setDraft(record ? record.categories : defaultCategories());
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setMode("panel");
  }, []);

  const closePanel = useCallback(() => {
    setMode(shouldAskAgain() ? "banner" : "hidden");
  }, []);

  const commit = useCallback((cats: ConsentCategories) => {
    saveConsent(cats);
    setMode("hidden");
    const target = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (target && document.contains(target)) {
      target.focus({ preventScroll: true });
    }
  }, []);

  const acceptAll = useCallback(() => {
    commit({
      necessarios: true,
      preferencias: true,
      estatisticos: true,
      marketing: true,
    });
  }, [commit]);

  const rejectAll = useCallback(() => {
    commit(defaultCategories());
  }, [commit]);

  // Reabertura pelo rodapé: qualquer elemento com [data-cookie-prefs].
  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest("[data-cookie-prefs]");
      if (!trigger) return;
      event.preventDefault();
      openPanel();
    }
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [openPanel]);

  // Foco inicial do aviso, sem roubar a rolagem da página.
  useEffect(() => {
    if (mode !== "banner") return;
    bannerRef.current?.focus({ preventScroll: true });
  }, [mode]);

  // Painel: foco inicial, Esc fecha, Tab circula dentro do diálogo.
  useEffect(() => {
    if (mode !== "panel") return;
    const node = panelRef.current;
    if (!node) return;

    node.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closePanel();
        return;
      }
      if (event.key !== "Tab" || !node) return;

      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [mode, closePanel]);

  if (mode === "hidden") return null;

  if (mode === "banner") {
    return (
      <div
        ref={bannerRef}
        role="dialog"
        aria-label="Aviso de cookies"
        aria-describedby="allos-cookie-banner-text"
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-[70] border-t border-[rgba(255,255,255,0.08)] bg-[#111111]/97 backdrop-blur-md focus:outline-none"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="min-w-0">
            <h2 className="font-fraunces text-base font-semibold text-cream">
              Cookies neste site
            </h2>
            <p
              id="allos-cookie-banner-text"
              className="mt-1.5 font-dm text-sm leading-relaxed text-[rgba(253,251,247,0.6)]"
            >
              Usamos cookies necessários para manter sua sessão e o site
              funcionando. Preferências, estatísticas e marketing só com a sua
              autorização, e nada vem marcado por padrão. Detalhes na{" "}
              <a href="/formacao/cookies" className={`text-cream ${policyLink}`}>
                política de cookies
              </a>
              .
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2.5">
            <button type="button" onClick={acceptAll} className={bannerAction}>
              Aceitar todos
            </button>
            <button type="button" onClick={rejectAll} className={bannerAction}>
              Recusar todos
            </button>
            <button type="button" onClick={openPanel} className={bannerAction}>
              Escolher
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) closePanel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="allos-cookie-panel-title"
        tabIndex={-1}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[16px] border border-[rgba(255,255,255,0.08)] bg-[#111111] shadow-[0_24px_80px_rgba(0,0,0,0.5)] focus:outline-none sm:rounded-[16px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(255,255,255,0.08)] px-6 py-5">
          <div>
            <h2
              id="allos-cookie-panel-title"
              className="font-fraunces text-lg font-bold text-cream"
            >
              Preferências de cookies
            </h2>
            <p className="mt-1 font-dm text-xs text-[rgba(253,251,247,0.5)]">
              Escolha categoria por categoria. Você pode mudar quando quiser.
            </p>
          </div>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Fechar preferências de cookies"
            className="-mr-1.5 rounded-[8px] p-1.5 text-[rgba(253,251,247,0.4)] transition-colors hover:bg-white/5 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C84B31]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-fraunces text-sm font-semibold text-cream">
                  {NECESSARIOS_COPY.label}
                </h3>
                <span className="mt-0.5 inline-block font-dm text-[11px] uppercase tracking-wider text-[#C84B31]">
                  Sempre ativos
                </span>
              </div>
              <Toggle
                checked
                locked
                label="Cookies necessários, sempre ativos"
              />
            </div>
            <p className="mt-2 font-dm text-xs leading-relaxed text-[rgba(253,251,247,0.6)]">
              {NECESSARIOS_COPY.description}{" "}
              <a
                href={NECESSARIOS_COPY.anchor}
                className={`text-[rgba(253,251,247,0.8)] ${policyLink}`}
              >
                Saiba mais
              </a>
              .
            </p>
          </div>

          {OPTIONAL_COPY.map((cat) => (
            <div
              key={cat.key}
              className="rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-fraunces text-sm font-semibold text-cream">
                  {cat.label}
                </h3>
                <Toggle
                  checked={draft[cat.key]}
                  label={`Cookies de ${cat.label.toLowerCase()}`}
                  onChange={(next) =>
                    setDraft((prev) => ({ ...prev, [cat.key]: next }))
                  }
                />
              </div>
              <p className="mt-2 font-dm text-xs leading-relaxed text-[rgba(253,251,247,0.6)]">
                {cat.description}{" "}
                <a
                  href={cat.anchor}
                  className={`text-[rgba(253,251,247,0.8)] ${policyLink}`}
                >
                  Saiba mais
                </a>
                .
              </p>
            </div>
          ))}

          <p className="pt-1 font-dm text-[11px] leading-relaxed text-[rgba(253,251,247,0.4)]">
            Estatísticos e marketing continuam aqui para o caso de passarmos a
            usar alguma ferramenta desse tipo. Se isso acontecer, a política
            será atualizada e o seu consentimento pedido de novo, inclusive
            quanto à transferência internacional descrita na{" "}
            <a href="/formacao/cookies" className={policyLink}>
              política de cookies
            </a>
            . Os vídeos das aulas são incorporados de serviços do Google e
            seguem valendo.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-[rgba(255,255,255,0.08)] px-6 py-5 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={acceptAll} className={panelAction}>
              Aceitar todos
            </button>
            <button type="button" onClick={rejectAll} className={panelAction}>
              Recusar todos
            </button>
          </div>
          <button
            type="button"
            onClick={() => commit(draft)}
            className="inline-flex items-center justify-center rounded-[10px] border border-[#C84B31] bg-[#C84B31] px-5 py-2.5 font-dm text-sm font-semibold text-cream transition-colors hover:bg-[#A33D27] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C84B31]"
          >
            Salvar escolhas
          </button>
        </div>
      </div>
    </div>
  );
}
