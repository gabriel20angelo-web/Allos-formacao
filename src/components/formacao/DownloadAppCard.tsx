"use client";

import { motion } from "framer-motion";
import { Smartphone, Download } from "lucide-react";

export default function DownloadAppCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="max-w-[700px] mx-auto"
    >
      <div
        className="relative rounded-2xl overflow-hidden p-6 sm:p-8"
        style={{
          background: "linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(20,15,12,0.95) 100%)",
          border: "1px solid rgba(200,75,49,0.2)",
          boxShadow: "0 0 40px rgba(200,75,49,0.06), 0 0 80px rgba(200,75,49,0.03)",
        }}
      >
        {/* Accent line top */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(200,75,49,0.4) 30%, rgba(200,75,49,0.6) 50%, rgba(200,75,49,0.4) 70%, transparent 100%)",
          }}
        />

        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(200,75,49,0.15), rgba(163,61,39,0.08))",
              border: "1px solid rgba(200,75,49,0.2)",
            }}
          >
            <Smartphone className="h-7 w-7 text-accent" />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-fraunces font-bold text-lg text-cream mb-1">
              Baixe nosso aplicativo para Android
            </h3>
            <p className="font-dm text-sm text-cream/40 leading-relaxed">
              Acesse seus cursos direto do celular, com experiencia de app nativo.
            </p>
          </div>

          <a
            href="/allos-formacao.apk"
            download="Allos-Formacao.apk"
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-dm font-semibold text-sm text-white transition-all hover:scale-[1.03] active:scale-[0.97] flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #C84B31, #A33D27)",
              boxShadow: "0 4px 20px rgba(200,75,49,0.3)",
            }}
          >
            <Download className="h-4 w-4" />
            Baixar App
          </a>
        </div>
      </div>
    </motion.div>
  );
}
