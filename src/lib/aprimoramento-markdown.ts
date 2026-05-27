// Markdown ↔ Block[] pra editor do admin de Aprimoramento.
//
// Sintaxe convencionada:
//
//   ## Heading (level 2 — padrão das seções)
//   ### Heading (level 3 — sub-seção, "Momento N" cai aqui)
//   #### Heading (level 4 — sub-sub)
//
//   Parágrafo normal — linhas consecutivas não-marcadas viram um parágrafo,
//   linha em branco separa.
//
//   - Item bullet
//   - Outro item
//
//   1. Item ordenado
//   2. Outro item
//
//   > Citação que pode
//   > continuar em várias linhas
//   > — Atribuição opcional (linha começando com — ou --)
//
//   [!callout]
//   Texto destacado que pode
//   ocupar várias linhas até a próxima linha em branco
//
//   [!ref] Texto da referência
//   [!ref] Texto com URL | https://exemplo.com
//
//   [link: Label do link → https://url.com]
//
//   | Header 1 | Header 2 |
//   | -------- | -------- |
//   | célula   | célula   |
//
// Round-trip garante: parseMarkdown(blocksToMarkdown(b)) ≈ b (sem perdas
// pros tipos suportados).

import type { Block } from "@/lib/aprimoramento-dinamicas";

// ─── Parser ──────────────────────────────────────────────────────────────────

export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];

  let paragraphBuf: string[] = [];
  let listBuf: string[] = [];
  let olBuf: string[] = [];
  let quoteBuf: string[] = [];
  let calloutBuf: string[] = [];
  let tableBuf: string[] = [];

  function flushParagraph() {
    if (paragraphBuf.length === 0) return;
    const t = paragraphBuf.join(" ").trim();
    if (t) blocks.push({ type: "paragraph", text: t });
    paragraphBuf = [];
  }
  function flushList() {
    if (listBuf.length === 0) return;
    blocks.push({ type: "list", items: listBuf.map((s) => s.trim()) });
    listBuf = [];
  }
  function flushOl() {
    if (olBuf.length === 0) return;
    blocks.push({ type: "orderedList", items: olBuf.map((s) => s.trim()) });
    olBuf = [];
  }
  function flushQuote() {
    if (quoteBuf.length === 0) return;
    let attribution: string | undefined;
    const linesQ = [...quoteBuf];
    const last = linesQ[linesQ.length - 1];
    if (last) {
      const m = last.match(/^[—\-]{1,2}\s*(.+)$/);
      if (m) {
        attribution = m[1].trim();
        linesQ.pop();
      }
    }
    const t = linesQ.join(" ").trim();
    if (t) {
      const b: Block = attribution
        ? { type: "quote", text: t, attribution }
        : { type: "quote", text: t };
      blocks.push(b);
    }
    quoteBuf = [];
  }
  function flushCallout() {
    if (calloutBuf.length === 0) return;
    const t = calloutBuf.join(" ").trim();
    if (t) blocks.push({ type: "callout", text: t });
    calloutBuf = [];
  }
  function flushTable() {
    if (tableBuf.length < 2) {
      tableBuf = [];
      return;
    }
    const headers = tableBuf[0]
      .split("|")
      .slice(1, -1)
      .map((s) => s.trim());
    const rows = tableBuf.slice(2).map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((s) => s.trim()),
    );
    blocks.push({ type: "table", headers, rows });
    tableBuf = [];
  }
  function flushAll() {
    flushParagraph();
    flushList();
    flushOl();
    flushQuote();
    flushCallout();
    flushTable();
  }

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (line === "") {
      flushAll();
      i++;
      continue;
    }

    // Headings (## ### ####)
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^####\s+(.+)$/))) {
      flushAll();
      blocks.push({ type: "heading", text: m[1].trim(), level: 4 });
      i++;
      continue;
    }
    if ((m = line.match(/^###\s+(.+)$/))) {
      flushAll();
      blocks.push({ type: "heading", text: m[1].trim(), level: 3 });
      i++;
      continue;
    }
    if ((m = line.match(/^##\s+(.+)$/))) {
      flushAll();
      blocks.push({ type: "heading", text: m[1].trim() });
      i++;
      continue;
    }

    // Callout — começa com [!callout], consome até linha vazia ou outro marker
    if (line.startsWith("[!callout]")) {
      flushParagraph();
      flushList();
      flushOl();
      flushQuote();
      flushTable();
      const rest = line.replace(/^\[!callout\]\s*/, "").trim();
      if (rest) calloutBuf.push(rest);
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (next === "") break;
        if (
          /^(#{2,4}\s|[-*+]\s|\d+\.\s|>|\[!|\|)/.test(next)
        ) {
          break;
        }
        calloutBuf.push(next);
        i++;
      }
      flushCallout();
      continue;
    }

    // Reference [!ref] (uma linha)
    if (line.startsWith("[!ref]")) {
      flushAll();
      const rest = line.replace(/^\[!ref\]\s*/, "").trim();
      let text = rest;
      let url: string | undefined;
      const pipeIdx = rest.lastIndexOf("|");
      if (pipeIdx > 0) {
        text = rest.slice(0, pipeIdx).trim();
        url = rest.slice(pipeIdx + 1).trim();
      }
      const b: Block = url
        ? { type: "reference", text, url }
        : { type: "reference", text };
      blocks.push(b);
      i++;
      continue;
    }

    // Link [link: Label → URL]
    if (line.startsWith("[link:")) {
      flushAll();
      const m2 = line.match(/^\[link:\s*(.+?)\s*(?:→|->)\s*(.+?)\s*\]$/);
      if (m2) {
        blocks.push({
          type: "link",
          label: m2[1].trim(),
          url: m2[2].trim(),
        });
      }
      i++;
      continue;
    }

    // Bullet list
    if ((m = line.match(/^[-*+]\s+(.+)$/))) {
      flushParagraph();
      flushOl();
      flushQuote();
      flushCallout();
      flushTable();
      listBuf.push(m[1]);
      i++;
      continue;
    }

    // Ordered list
    if ((m = line.match(/^\d+\.\s+(.+)$/))) {
      flushParagraph();
      flushList();
      flushQuote();
      flushCallout();
      flushTable();
      olBuf.push(m[1]);
      i++;
      continue;
    }

    // Quote
    if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      flushOl();
      flushCallout();
      flushTable();
      quoteBuf.push(line.replace(/^>\s*/, ""));
      i++;
      continue;
    }

    // Table
    if (line.startsWith("|") && line.endsWith("|") && line.length > 1) {
      flushParagraph();
      flushList();
      flushOl();
      flushQuote();
      flushCallout();
      tableBuf.push(line);
      i++;
      continue;
    }

    // Default: paragraph (acumula linhas consecutivas)
    flushList();
    flushOl();
    flushQuote();
    flushCallout();
    flushTable();
    paragraphBuf.push(line);
    i++;
  }

  flushAll();
  return blocks;
}

// ─── Serializer ──────────────────────────────────────────────────────────────

export function blocksToMarkdown(blocks: Block[]): string {
  const out: string[] = [];

  for (const b of blocks) {
    switch (b.type) {
      case "heading": {
        const prefix = "#".repeat(b.level ?? 2);
        out.push(`${prefix} ${b.text}`);
        break;
      }
      case "paragraph":
        out.push(b.text);
        break;
      case "list":
        out.push(b.items.map((it) => `- ${it}`).join("\n"));
        break;
      case "orderedList":
        out.push(b.items.map((it, idx) => `${idx + 1}. ${it}`).join("\n"));
        break;
      case "quote": {
        const lines = b.text.split("\n").map((l) => `> ${l}`);
        if (b.attribution) lines.push(`> — ${b.attribution}`);
        out.push(lines.join("\n"));
        break;
      }
      case "callout":
        out.push(`[!callout]\n${b.text}`);
        break;
      case "reference":
        out.push(b.url ? `[!ref] ${b.text} | ${b.url}` : `[!ref] ${b.text}`);
        break;
      case "link":
        out.push(`[link: ${b.label} → ${b.url}]`);
        break;
      case "table": {
        const sep = b.headers.map(() => "---").join(" | ");
        const headerRow = `| ${b.headers.join(" | ")} |`;
        const sepRow = `| ${sep} |`;
        const rowsMd = b.rows.map((r) => `| ${r.join(" | ")} |`);
        out.push([headerRow, sepRow, ...rowsMd].join("\n"));
        break;
      }
    }
  }

  return out.join("\n\n");
}
