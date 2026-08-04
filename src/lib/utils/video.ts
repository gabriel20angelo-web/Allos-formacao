import type { VideoSource } from "@/types";

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function extractDriveId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function detectVideoSource(url: string): VideoSource {
  // Valida via URL parser pra evitar falso positivo em domínios atacantes
  // tipo "evil.com/drive.google.com/...".
  try {
    const u = new URL(url);
    if (u.hostname === "youtube.com" || u.hostname === "www.youtube.com" ||
        u.hostname === "youtu.be" || u.hostname === "m.youtube.com") {
      return "youtube";
    }
    if (u.hostname === "drive.google.com") return "google_drive";
  } catch {
    // URL inválida cai pra "other" e o whitelist em getEmbedUrl bloqueia
  }
  return "other";
}

function isSafeHttpUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://");
}

/**
 * O segundo em que o vídeo deve começar, quando o endereço diz.
 *
 * Gravação de encontro sobe com `&t=37` porque a sala abre quinze minutos antes
 * e o arquivo pega a chegada das pessoas. O embed do YouTube não lê `t`: ele
 * quer `start`. Sem esta tradução, o cálculo do início real era feito, gravado,
 * e jogado fora na hora de tocar.
 *
 * Aceita as formas que o YouTube usa: `t=90`, `t=90s`, `t=1m30s`, `t=1h2m3s`.
 */
export function extractStartSeconds(url: string): number | null {
  const bruto = url.match(/[?&#]t=([0-9hms]+)/i)?.[1];
  if (!bruto) return null;

  if (/^\d+$/.test(bruto)) return Number(bruto) || null;

  const m = bruto.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!m) return null;

  const seg = Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return seg || null;
}

export function getEmbedUrl(url: string, source: VideoSource): string {
  switch (source) {
    case "youtube": {
      const id = extractYouTubeId(url);
      if (!id) return isSafeHttpUrl(url) ? url : "";
      const inicio = extractStartSeconds(url);
      const params =
        "rel=0&modestbranding=1&playsinline=1" + (inicio ? `&start=${inicio}` : "");
      return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
    }
    case "google_drive": {
      const id = extractDriveId(url);
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
      return isSafeHttpUrl(url) ? url : "";
    }
    default:
      return isSafeHttpUrl(url) ? url : "";
  }
}

export function getYouTubeWatchUrl(url: string): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

export function getDriveViewUrl(url: string): string | null {
  const id = extractDriveId(url);
  return id ? `https://drive.google.com/file/d/${id}/view` : null;
}

export function getExternalUrl(url: string, source: VideoSource): string | null {
  switch (source) {
    case "youtube":
      return getYouTubeWatchUrl(url);
    case "google_drive":
      return getDriveViewUrl(url);
    default:
      return url && isSafeHttpUrl(url) ? url : null;
  }
}
