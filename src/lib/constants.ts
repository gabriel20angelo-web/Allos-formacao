export const COLORS = {
  teal: "#2E9E8F",
  tealDark: "#1A7A6D",
  tealLight: "#3ECFBE",
  tealBg: "#0D3B36",
  accent: "#C84B31",
  accentDark: "#A33D27",
  cream: "#FDFBF7",
  creamAlt: "#F5F0E8",
  charcoal: "#1A1A1A",
  muted: "#5C5C5C",
  border: "#E5DFD3",
  sage: "#2D6A4F",
} as const;

export const EASE = [0.22, 1, 0.36, 1] as const;

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "application/zip",
];

export const DEFAULT_CATEGORIES = [
  "Psicologia Clínica",
  "Neuropsicologia",
  "Psicoterapia",
  "Avaliação Psicológica",
  "Supervisão Clínica",
  "Formação Continuada",
  "Pesquisa",
];

// Categories are now stored in the Supabase "categories" table.
// Use the useCategories() hook for client components.
// DEFAULT_CATEGORIES is kept as seed/fallback data.
export const CATEGORIES = DEFAULT_CATEGORIES;
