"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { getEmbedUrl } from "@/lib/utils/video";
import { Loader2, PlayCircle } from "lucide-react";
import type { VideoSource } from "@/types";

interface VideoPlayerProps {
  url: string;
  source: VideoSource;
  title?: string;
}

export default function VideoPlayer({ url, source, title }: VideoPlayerProps) {
  const embedUrl = useMemo(() => getEmbedUrl(url, source), [url, source]);
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="relative aspect-video w-full rounded-[16px] overflow-hidden"
      style={{
        background: "#0D0D0D",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      {/* Loading state */}
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
          <Loader2 className="h-8 w-8 text-accent animate-spin" />
          <p className="font-dm text-sm text-cream/30">Carregando vídeo...</p>
        </div>
      )}

      <iframe
        src={embedUrl}
        className={`w-full h-full transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={title || "Vídeo da aula"}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
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
