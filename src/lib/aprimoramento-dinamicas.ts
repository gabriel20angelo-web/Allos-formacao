// Types e helpers puros pra Aprimoramento de Dinâmicas. O dataset dos
// exercícios agora vive no Supabase (tabela aprimoramento_exercicios) —
// queries em `src/lib/queries/aprimoramento-exercicios.ts`. Este arquivo
// fica só com tipos e funções stateless usadas tanto no server quanto no
// client.

export type Block =
  | { type: "heading"; text: string; level?: 2 | 3 | 4 }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "orderedList"; items: string[] }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "callout"; text: string }
  | { type: "reference"; text: string; url?: string }
  | { type: "link"; label: string; url: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export type CategorySlug =
  | "relacao"
  | "tecnica"
  | "autoconhecimento"
  | "manejo"
  | "operacional";

export type Pessoas = "solo" | "dupla" | "grupo";

export type FormatoSlug =
  | "roleplay"
  | "reflexao"
  | "discussao"
  | "preenchimento";

export interface Exercise {
  slug: string;
  number: number;
  title: string;
  summary: string;
  category: CategorySlug;
  /** Legacy — não exibido na UI. */
  duracaoMin?: [number, number];
  formato: FormatoSlug[];
  /** Legacy — não exibido na UI. */
  pessoas?: Pessoas;
  tags: string[];
  recursos?: string[];
  /**
   * Indica se passou por curadoria. Default true (ausente conta como curado).
   * Exercícios criados por associados ou importados da lista bruta entram com
   * `curado: false` — mostram selo "Não-curado" na UI.
   */
  curado?: boolean;
  /** UUID do autor (auth.users.id). NULL pros 100 seed iniciais. */
  criadoPor?: string | null;
  /** Status no banco. */
  status?: "publicado" | "rascunho" | "arquivado";
  blocks: Block[];
}

/**
 * Default semântico: ausência de `curado` ou `curado: true` ⇒ curado.
 * Só `curado: false` explícito desliga.
 */
export function isCurated(ex: Pick<Exercise, "curado">): boolean {
  return ex.curado !== false;
}

/** Slugifica um texto para uso como id de heading (âncora). */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Slugifica um tag (mais permissivo que slugifyHeading — sem cap de tamanho). */
export function tagToSlug(tag: string): string {
  return tag
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extrai um sumário (table of contents) a partir dos blocks.
 * Inclui apenas headings level 2 (seções principais).
 */
export function extractToc(blocks: Block[]): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    if (b.type !== "heading") continue;
    const level = b.level ?? 2;
    if (level !== 2) continue;
    let id = slugifyHeading(b.text);
    if (!id) continue;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${slugifyHeading(b.text)}-${suffix++}`;
    }
    seen.add(id);
    out.push({ id, text: b.text });
  }
  return out;
}

/**
 * Detecta se um heading representa um "Momento" da dinâmica.
 * Aceita variantes: "1º Momento", "Momento 1", "Primeiro momento",
 * "1º Momento: Reflexão sobre preparação", etc.
 */
export function parseMomento(
  text: string,
): { number: number; label: string } | null {
  const trimmed = text.trim();

  let m = trimmed.match(/^(\d+)[ºo]?\s*[Mm]omento(?:\s*[:\-—]\s*(.+))?$/);
  if (m) {
    return { number: Number(m[1]), label: (m[2] ?? "").trim() };
  }

  m = trimmed.match(/^[Mm]omento\s+(\d+)(?:\s*[:\-—]\s*(.+))?$/);
  if (m) {
    return { number: Number(m[1]), label: (m[2] ?? "").trim() };
  }

  const ordinais = [
    "primeiro",
    "segundo",
    "terceiro",
    "quarto",
    "quinto",
    "sexto",
  ];
  m = trimmed.match(
    /^(Primeiro|Segundo|Terceiro|Quarto|Quinto|Sexto)\s+momento(?:\s*[:\-—]\s*(.+))?$/i,
  );
  if (m) {
    const idx = ordinais.indexOf(m[1].toLowerCase());
    if (idx >= 0) {
      return { number: idx + 1, label: (m[2] ?? "").trim() };
    }
  }

  return null;
}

// ─── Modo Facilitador: particionar blocks em sections navegáveis ────────────

export interface FacilitatorSection {
  id: string;
  label: string;
  isMomento: boolean;
  momentoNumber: number | null;
  blocks: Block[];
}

/**
 * Quebra o array de blocks em sections navegáveis pelo modo Facilitador.
 *
 * Se há Momentos (heading level 3 que parseMomento bate), cada Momento vira
 * uma section, e qualquer heading level 2 anterior abre sua própria section
 * (Contextualização etc.). Sem Momentos, particiona por heading level 2.
 *
 * Blocks órfãos (antes de qualquer heading) caem em uma section "Introdução".
 */
export function partitionSections(blocks: Block[]): FacilitatorSection[] {
  const hasMomentos = blocks.some(
    (b) => b.type === "heading" && (b.level ?? 2) === 3 && parseMomento(b.text),
  );

  const sections: FacilitatorSection[] = [];
  let current: FacilitatorSection | null = null;

  function makeSection(
    label: string,
    isMomento: boolean,
    momentoNumber: number | null,
  ): FacilitatorSection {
    return {
      id: `sec-${sections.length}`,
      label,
      isMomento,
      momentoNumber,
      blocks: [],
    };
  }

  function flush() {
    if (current && current.blocks.length > 0) sections.push(current);
  }

  for (const block of blocks) {
    if (block.type === "heading") {
      const level = block.level ?? 2;

      if (hasMomentos && level === 3) {
        const momento = parseMomento(block.text);
        if (momento) {
          flush();
          current = makeSection(
            momento.label || `Momento ${momento.number}`,
            true,
            momento.number,
          );
          continue;
        }
      }
      if (level === 2) {
        flush();
        current = makeSection(block.text, false, null);
        continue;
      }
    }

    if (current === null) {
      current = makeSection("Introdução", false, null);
    }
    current.blocks.push(block);
  }

  flush();
  return sections;
}
