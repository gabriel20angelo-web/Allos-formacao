import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div
        className="w-full max-w-md text-center p-10 rounded-[16px]"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-6"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <FileQuestion className="h-7 w-7 text-cream/40" />
        </div>

        <h1 className="font-fraunces font-bold text-2xl text-cream mb-2">
          Pagina nao encontrada
        </h1>
        <p className="font-dm text-sm text-cream/50 mb-8 leading-relaxed">
          O endereco que voce acessou nao existe ou foi movido.
        </p>

        <Link
          href="/formacao"
          className="inline-block w-full py-3 rounded-[10px] font-dm font-semibold text-sm text-cream transition-colors duration-200"
          style={{
            background: "rgba(200,75,49,0.15)",
            border: "1px solid rgba(200,75,49,0.25)",
          }}
        >
          Voltar ao inicio
        </Link>
      </div>
    </div>
  );
}
