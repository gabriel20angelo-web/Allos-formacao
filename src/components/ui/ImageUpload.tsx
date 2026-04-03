"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Upload, Link as LinkIcon, X, Loader2, ImageOff } from "lucide-react";

interface ImageUploadProps {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
  aspectHint?: string;
  placeholder?: string;
}

export default function ImageUpload({
  label,
  value,
  onChange,
  bucket = "course-images",
  folder = "thumbnails",
  aspectHint,
  placeholder = "https://...",
}: ImageUploadProps) {
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Selecione um arquivo de imagem.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("Imagem muito grande. Máximo: 10MB.");
        return;
      }

      setUploading(true);
      setPreviewError(false);
      try {
        const client = createClient();
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error } = await client.storage
          .from(bucket)
          .upload(fileName, file, {
            cacheControl: "31536000",
            upsert: false,
          });

        if (error) throw error;

        const { data: publicData } = client.storage
          .from(bucket)
          .getPublicUrl(fileName);

        onChange(publicData.publicUrl);
        toast.success("Imagem enviada!");
      } catch (err: unknown) {
        console.error("Upload error:", err);
        toast.error("Erro ao enviar imagem. Verifique se o bucket está configurado.");
      } finally {
        setUploading(false);
      }
    },
    [bucket, folder, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <div
      className="flex flex-col gap-1.5"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {label && (
        <label className="text-sm font-medium text-cream/70">{label}</label>
      )}

      {/* Mode toggle */}
      <div className="flex gap-1 mb-1">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === "url"
              ? "bg-white/10 text-cream"
              : "text-cream/40 hover:text-cream/60"
          }`}
        >
          <LinkIcon className="h-3 w-3" />
          URL
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === "upload"
              ? "bg-white/10 text-cream"
              : "text-cream/40 hover:text-cream/60"
          }`}
        >
          <Upload className="h-3 w-3" />
          Upload
        </button>
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div
          className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl"
          style={{
            background: "rgba(200,75,49,0.06)",
            border: "1.5px dashed rgba(200,75,49,0.4)",
          }}
        >
          <Upload className="h-6 w-6 text-accent" />
          <span className="text-xs text-accent">Solte a imagem aqui</span>
        </div>
      )}

      {!dragOver && mode === "url" && (
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setPreviewError(false); }}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 rounded-[10px] text-cream placeholder:text-cream/25 transition-all duration-250 ease-out"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1.5px solid rgba(255,255,255,0.08)",
            color: "rgba(253,251,247,0.9)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(200,75,49,0.5)";
            e.currentTarget.style.boxShadow =
              "0 0 0 3px rgba(200,75,49,0.12), 0 0 20px rgba(200,75,49,0.06)";
            e.currentTarget.style.outline = "none";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      )}

      {!dragOver && mode === "upload" && (
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          className="relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl cursor-pointer transition-all"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1.5px dashed rgba(255,255,255,0.12)",
          }}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 text-accent animate-spin" />
              <span className="text-xs text-cream/40">Enviando...</span>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-cream/30" />
              <span className="text-xs text-cream/50 text-center">
                Clique para selecionar ou arraste uma imagem
              </span>
              <span className="text-[10px] text-cream/25">
                PNG, JPG, WebP — máx. 10MB
              </span>
            </>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* Preview — uses native <img> to avoid next/image domain issues */}
      {value && (
        <div className="relative mt-2 group">
          {!previewError ? (
            <div
              className="relative rounded-xl overflow-hidden bg-black/20"
              style={{ aspectRatio: aspectHint || "16/9", maxHeight: "220px" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={() => setPreviewError(true)}
              />
            </div>
          ) : (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <ImageOff className="h-5 w-5 text-cream/25 flex-shrink-0" />
              <span className="text-xs text-cream/40 truncate">{value}</span>
            </div>
          )}
          {/* Remove button */}
          <button
            type="button"
            onClick={() => { onChange(""); setPreviewError(false); }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center bg-black/60 text-white/70 hover:text-white hover:bg-red-600/80 transition-all opacity-0 group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
