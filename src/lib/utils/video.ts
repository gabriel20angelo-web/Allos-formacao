import type { VideoSource } from "@/types";

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
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
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("drive.google.com")) return "google_drive";
  return "other";
}

export function getEmbedUrl(url: string, source: VideoSource): string {
  switch (source) {
    case "youtube": {
      const id = extractYouTubeId(url);
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    case "google_drive": {
      const id = extractDriveId(url);
      return id ? `https://drive.google.com/file/d/${id}/preview` : url;
    }
    default:
      return url;
  }
}
