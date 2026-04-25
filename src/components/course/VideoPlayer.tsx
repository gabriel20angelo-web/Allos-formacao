"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getEmbedUrl, getExternalUrl } from "@/lib/utils/video";
import { ExternalLink, Loader2, PlayCircle } from "lucide-react";
import type { VideoSource } from "@/types";

interface VideoPlayerProps {
  url: string;
  source: VideoSource;
  title?: string;
}

const LOAD_TIMEOUT_MS = 6000;
// Drive embeds fail silently on a few common scenarios:
//   1. Third-party cookies blocked (Brave default, Safari ITP, Firefox strict,
//      incognito Chrome) — iframe.onLoad fires but the player stays blank.
//   2. Daily quota on the file exceeded — Drive limits each file to ~750GB
//      of download/day. Popular files hit it; the player returns "Não foi
//      possível carregar o vídeo" inside the iframe (we can't read across
//      origins to detect this programmatically).
//   3. Multi-account Google sign-in confusing the embed.
// Strategy: surface the external "Abrir no Drive" link permanently and
// show a contextual help banner up-front for Drive videos so users have
// an immediate escape route without waiting for the timeout.
const SHOW_HELP_AFTER_MS = 3000;

const SOURCE_LABEL: Record<VideoSource, string> = {
  youtube: "YouTube",
  google_drive: "Google Drive",
  other: "página original",
};

const SOURCE_FALLBACK_HINT: Record<VideoSource, string> = {
  youtube: "Pode ser conexão lenta, bloqueador de anúncios ou filtro de rede.",
  google_drive:
    "Pode ser cookies de terceiros bloqueados (Brave/Safari/anônimo), conta Google sem acesso ou rede corporativa. Abrir direto no Drive resolve.",
  other: "Conexão lenta ou filtro de rede.",
};

export default function VideoPlayer({ url, source, title }: VideoPlayerProps) {
  const embedUrl = useMemo(() => getEmbedUrl(url, source), [url, source]);
  const externalUrl = useMemo(() => getExternalUrl(url, source), [url, source]);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setTimedOut(false);
    setShowHelp(false);
    const helpTimer = window.setTimeout(() => setShowHelp(true), SHOW_HELP_AFTER_MS);
    const timer = window.setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => {
      window.clearTimeout(helpTimer);
      window.clearTimeout(timer);
    };
  }, [embedUrl]);

  const showFallback = !loaded && timedOut && !!externalUrl;

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-video w-full rounded-[16px] overflow-hidden"
        style={{
          background: "#0D0D0D",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* Loading state */}
        {!loaded && !showFallback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
            <Loader2 className="h-8 w-8 text-accent animate-spin" />
            <p className="font-dm text-sm text-cream/30">Carregando vídeo...</p>
          </div>
        )}

        {/* Fallback when embed fails to load */}
        {showFallback && externalUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20 px-6 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(200,75,49,0.1)",
                border: "1px solid rgba(200,75,49,0.2)",
              }}
            >
              <PlayCircle className="h-7 w-7" style={{ color: "rgba(200,75,49,0.7)" }} />
            </div>
            <div className="max-w-md">
              <p className="font-fraunces font-bold text-cream text-base mb-1">
                O vídeo não carregou neste dispositivo
              </p>
              <p className="font-dm text-sm text-cream/50">
                {SOURCE_FALLBACK_HINT[source]} Abra direto no {SOURCE_LABEL[source]} para assistir.
              </p>
            </div>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-dm text-sm transition-colors"
              style={{
                background: "rgba(200,75,49,0.15)",
                border: "1px solid rgba(200,75,49,0.35)",
                color: "#E8A28A",
              }}
            >
              Abrir no {SOURCE_LABEL[source]}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}

        <iframe
          key={embedUrl}
          src={embedUrl}
          className={`w-full h-full transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          title={title || "Vídeo da aula"}
          onLoad={() => {
            setLoaded(true);
            setTimedOut(false);
          }}
        />
      </div>

      {/* Permanent escape hatch + contextual help banner. For Drive we show
          the help upfront because the failure modes are silent (player
          renders blank or shows internal error inside the iframe — we
          can't detect across origins). */}
      {externalUrl && source === "google_drive" && (
        <div
          className="rounded-[10px] px-3 py-2 flex items-start gap-2.5 transition-opacity duration-300"
          style={{
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.18)",
            opacity: showHelp || timedOut ? 1 : 0.55,
          }}
        >
          <div className="flex-shrink-0 mt-0.5">
            <PlayCircle className="h-4 w-4" style={{ color: "rgba(245,158,11,0.7)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-dm text-[11px] text-cream/65 leading-relaxed">
              <span className="font-semibold text-amber-200/80">Vídeo no Google Drive.</span>{" "}
              Se demorar pra carregar ou aparecer erro: pode ser cookies de terceiros
              bloqueados, conta Google logada sem acesso, ou cota diária do arquivo
              excedida. Abrir direto no Drive resolve quase sempre.
            </p>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 font-dm text-[11px] font-semibold transition-colors"
              style={{ color: "#FBBC05" }}
            >
              <ExternalLink className="h-3 w-3" />
              Abrir no Google Drive
            </a>
          </div>
        </div>
      )}

      {externalUrl && source !== "google_drive" && (
        <div className="flex items-center justify-end text-[11px] font-dm">
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-cream/40 hover:text-accent transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            abrir no {SOURCE_LABEL[source]}
          </a>
        </div>
      )}
    </div>
  );
}

/* Placeholder when no video is available */
export function VideoPlaceholder({ title, thumbnailUrl }: { title: string; thumbnailUrl?: string }) {
  return (
    <div
      className="aspect-video w-full rounded-[16px] flex flex-col items-center justify-center gap-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #1A1414, #0F0F0F)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {thumbnailUrl ? (
        <>
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            sizes="(max-width: 1024px) 100vw, 720px"
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(15,15,15,0.85) 0%, rgba(15,15,15,0.3) 50%, transparent 100%)" }}
          />
          <div className="relative mt-auto p-6 w-full">
            <p className="font-fraunces font-bold text-cream text-lg">{title}</p>
          </div>
        </>
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(200,75,49,0.06) 0%, transparent 70%)" }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(200,75,49,0.08)",
              border: "1px solid rgba(200,75,49,0.15)",
            }}
          >
            <PlayCircle className="h-8 w-8" style={{ color: "rgba(200,75,49,0.4)" }} />
          </div>
          <div className="relative text-center">
            <p className="font-fraunces font-bold text-cream/40 text-lg mb-1">{title}</p>
            <p className="font-dm text-sm text-cream/25">Nenhum vídeo disponível para esta aula</p>
          </div>
        </>
      )}
    </div>
  );
}
