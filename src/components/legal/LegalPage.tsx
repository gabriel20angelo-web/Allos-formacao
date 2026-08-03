import Link from "next/link";
import type { ReactNode } from "react";
import Footer from "@/components/layout/Footer";

/* ────────────────────────────────────────────────────────────────────
   Layout compartilhado das páginas legais públicas (/termos, /cookies).

   Server component: o sumário do mobile usa <details>, então não há
   necessidade de estado nem de "use client". O scroll suave já vem do
   `html { scroll-behavior: smooth }` em globals.css, e cada seção tem
   scroll-margin pra não encostar no topo da viewport.
   ──────────────────────────────────────────────────────────────────── */

export type LegalTocItem = {
  id: string;
  label: string;
  /** Entrada de subseção: recuada e um pouco mais discreta no sumário. */
  sub?: boolean;
};

const BODY_TEXT = "font-dm text-[15px] leading-[1.85] text-cream/65 md:text-base";

/* ── Placeholder: trecho que o Gabriel ainda precisa preencher ─────── */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span
      title="Campo a preencher antes da publicação"
      className="box-decoration-clone rounded-[4px] px-1 py-[1px] font-medium"
      style={{
        background: "rgba(216,160,74,0.12)",
        color: "#E3B26A",
        boxShadow: "inset 0 0 0 1px rgba(216,160,74,0.24)",
      }}
    >
      {children}
    </span>
  );
}

/* ── Blocos de texto ──────────────────────────────────────────────── */
export function LegalLead({ children }: { children: ReactNode }) {
  return (
    <p className="font-dm text-[16px] leading-[1.85] text-cream/75 md:text-[17px]">
      {children}
    </p>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 pt-11 first:pt-0 md:scroll-mt-24">
      <h2 className="font-fraunces text-[25px] font-semibold leading-[1.25] text-cream md:text-[29px]">
        {title}
      </h2>
      <div
        className="mb-6 mt-3 h-px w-14"
        style={{ background: "linear-gradient(90deg,#C84B31,rgba(200,75,49,0))" }}
      />
      {children}
    </section>
  );
}

export function LegalSub({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className="mt-9 scroll-mt-20 md:scroll-mt-24">
      <h3 className="mb-3 font-fraunces text-[19px] font-medium text-cream/90 md:text-[21px]">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p className={`mb-4 ${BODY_TEXT}`}>{children}</p>;
}

/* Lista sem marcador própria: os itens do documento já trazem o rótulo
   ("a)", "b)", "Google Chrome:"), então o texto é preservado como está e
   o recuo pendurado só cuida do alinhamento visual. */
export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="mb-5 mt-1 list-none space-y-3">{children}</ul>;
}

export function LegalItem({ children }: { children: ReactNode }) {
  return <li className={`-indent-6 pl-6 ${BODY_TEXT}`}>{children}</li>;
}

export function LegalAddress({ children }: { children: ReactNode }) {
  return (
    <address
      className="mb-4 mt-6 rounded-[12px] px-5 py-4 font-dm text-[15px] not-italic leading-[1.9] text-cream/65"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {children}
    </address>
  );
}

export function LegalDivider() {
  return (
    <hr
      className="my-14 border-0"
      style={{
        height: "1px",
        background:
          "linear-gradient(90deg,rgba(253,251,247,0),rgba(253,251,247,.14),rgba(253,251,247,0))",
      }}
    />
  );
}

/* ── Tabela real, com rolagem horizontal no mobile ────────────────── */
export function LegalTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="-mx-5 my-7 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[560px] border-collapse text-left font-dm text-[14px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((cell) => (
              <th
                key={cell}
                scope="col"
                className="border-b border-white/10 pb-2.5 pr-5 text-[10px] font-semibold uppercase tracking-[.18em] text-accent"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border-b py-3 pr-5 align-top leading-relaxed text-cream/65"
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Sumário ──────────────────────────────────────────────────────── */
function TocLinks({ items }: { items: LegalTocItem[] }) {
  return (
    <>
      {items.map((item) => (
        <li key={item.id} className={item.sub ? "pl-4" : undefined}>
          <a
            href={`#${item.id}`}
            className={`block font-dm leading-snug transition-colors hover:text-accent ${
              item.sub ? "text-[12px] text-cream/30" : "text-[13px] text-cream/45"
            }`}
          >
            {item.label}
          </a>
        </li>
      ))}
    </>
  );
}

/* ── Página ───────────────────────────────────────────────────────── */
export default function LegalPage({
  title,
  version,
  effectiveFrom,
  toc,
  children,
}: {
  title: string;
  version: string;
  effectiveFrom: ReactNode;
  toc: LegalTocItem[];
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen" style={{ background: "#111111" }}>
      {/* Brilho quente no topo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 0%, rgba(200,75,49,0.10), rgba(17,17,17,0) 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1180px] px-5 pb-20 pt-10 sm:px-8 md:pt-14 lg:px-10">
        {/* Voltar */}
        <Link
          href="/formacao"
          className="inline-flex items-center gap-2 font-dm text-[13px] text-cream/40 transition-colors hover:text-accent"
        >
          <span aria-hidden="true">&#8592;</span> Voltar para a plataforma
        </Link>

        {/* Cabeçalho */}
        <header className="mb-10 mt-8 max-w-3xl md:mb-14">
          <p className="mb-4 font-dm text-[10px] font-semibold uppercase tracking-[.28em] text-accent">
            Documento legal
          </p>
          <h1 className="font-fraunces text-[38px] font-bold leading-[1.1] tracking-tight text-cream md:text-[52px]">
            {title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 font-dm text-[13px] text-cream/45">
            <span
              className="rounded-full px-3 py-1 text-cream/70"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              Versão {version}
            </span>
            <span>Vigente a partir de {effectiveFrom}</span>
          </div>
        </header>

        {/* Sumário colapsado (mobile) */}
        <details
          className="group mb-10 rounded-[14px] lg:hidden"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-dm text-sm font-semibold text-cream/80 [&::-webkit-details-marker]:hidden">
            Sumário
            <span
              aria-hidden="true"
              className="text-lg leading-none text-accent transition-transform duration-200 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <nav aria-label="Sumário do documento">
            <ul className="space-y-2.5 px-5 pb-5 pt-1">
              <TocLinks items={toc} />
            </ul>
          </nav>
        </details>

        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12 xl:gap-16">
          {/* Sumário lateral (desktop) */}
          <nav aria-label="Sumário do documento" className="hidden lg:block">
            <div className="sticky top-12 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
              <p className="mb-4 font-dm text-[10px] font-semibold uppercase tracking-[.22em] text-cream/35">
                Nesta página
              </p>
              <ul
                className="space-y-2.5 pl-4"
                style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}
              >
                <TocLinks items={toc} />
              </ul>
            </div>
          </nav>

          {/* Conteúdo */}
          <article className="max-w-3xl">{children}</article>
        </div>
      </div>

      <Footer />
    </div>
  );
}
