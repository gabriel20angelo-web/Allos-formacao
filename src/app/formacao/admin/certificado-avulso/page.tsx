"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import { Award, Download, Eye, RotateCcw } from "lucide-react";
import { jsPDF } from "jspdf";

function formatDatePtBR(dateStr: string) {
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function horasExtenso(h: number): string {
  const unidades = ["", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentas", "trezentas"];
  if (h === 0) return "zero";
  if (h === 1) return "uma";
  if (h < 10) return unidades[h];
  if (h < 20) return teens[h - 10];
  if (h < 100) {
    const d = Math.floor(h / 10);
    const u = h % 10;
    return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`;
  }
  if (h === 100) return "cem";
  if (h < 400) {
    const c = Math.floor(h / 100);
    const r = h % 100;
    return r === 0 ? centenas[c] : `${centenas[c]} e ${horasExtenso(r)}`;
  }
  return String(h);
}

// Wrap text into lines that fit within maxWidth
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export default function CertificadoAvulsoPage() {
  const [nome, setNome] = useState("");
  const [horas, setHoras] = useState("20");
  const [textoCorpo, setTextoCorpo] = useState(
    "concluiu com êxito o programa de estágio em Psicologia Clínica da Associação Allos, com carga horária total de {horas} ({horas_extenso}) horas, no período de {data}."
  );
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [previewing, setPreviewing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawCertificate = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = 1684;
      const H = 1190;
      canvas.width = W;
      canvas.height = H;

      // Background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);

      // Top border
      ctx.fillStyle = "#1a3a3a";
      ctx.fillRect(0, 0, W, 12);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(W * 0.4, 0, W * 0.2, 12);

      // Bottom border
      ctx.fillStyle = "#1a3a3a";
      ctx.fillRect(0, H - 12, W, 12);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(W * 0.4, H - 12, W * 0.2, 12);

      // Header
      ctx.textAlign = "center";
      ctx.fillStyle = "#1a3a3a";
      ctx.font = "700 28px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      ctx.fillText("ASSOCIAÇÃO ALLOS", W / 2, 110);

      ctx.fillStyle = "#888888";
      ctx.font = "400 16px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      ctx.fillText("PSICOLOGIA · FORMAÇÃO · PESQUISA", W / 2, 140);

      // Decorative line with diamond
      const lineY = 165;
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W * 0.25, lineY);
      ctx.lineTo(W / 2 - 12, lineY);
      ctx.moveTo(W / 2 + 12, lineY);
      ctx.lineTo(W * 0.75, lineY);
      ctx.stroke();
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.moveTo(W / 2, lineY - 6);
      ctx.lineTo(W / 2 + 6, lineY);
      ctx.lineTo(W / 2, lineY + 6);
      ctx.lineTo(W / 2 - 6, lineY);
      ctx.closePath();
      ctx.fill();

      // "CERTIFICADO"
      ctx.fillStyle = "#1a3a3a";
      ctx.font = "300 72px Georgia, 'Times New Roman', serif";
      ctx.fillText("CERTIFICADO", W / 2, 275);

      // "Certificamos que"
      ctx.fillStyle = "#444444";
      ctx.font = "300 22px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      ctx.fillText("Certificamos que", W / 2, 380);

      // Name
      ctx.fillStyle = "#c0392b";
      ctx.font = "italic 700 52px Georgia, 'Times New Roman', serif";
      ctx.fillText(nome || "Nome Completo", W / 2, 445);

      // Name underline
      const nameText = nome || "Nome Completo";
      const nameWidth = ctx.measureText(nameText).width;
      const grad = ctx.createLinearGradient(W / 2 - nameWidth / 2, 0, W / 2 + nameWidth / 2, 0);
      grad.addColorStop(0, "rgba(192,57,43,0)");
      grad.addColorStop(0.2, "rgba(192,57,43,0.3)");
      grad.addColorStop(0.5, "rgba(192,57,43,0.5)");
      grad.addColorStop(0.8, "rgba(192,57,43,0.3)");
      grad.addColorStop(1, "rgba(192,57,43,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W / 2 - nameWidth / 2 - 30, 460);
      ctx.lineTo(W / 2 + nameWidth / 2 + 30, 460);
      ctx.stroke();

      // Body text with variable replacement
      const h = parseInt(horas) || 0;
      const bodyText = textoCorpo
        .replace(/\{nome\}/g, nome || "Nome Completo")
        .replace(/\{horas\}/g, String(h))
        .replace(/\{horas_extenso\}/g, horasExtenso(h))
        .replace(/\{data\}/g, formatDatePtBR(data));

      ctx.fillStyle = "#333333";
      ctx.font = "400 24px Georgia, 'Times New Roman', serif";
      const lines = wrapText(ctx, bodyText, W * 0.65);
      let bodyY = 520;
      lines.forEach((line) => {
        ctx.fillText(line, W / 2, bodyY);
        bodyY += 36;
      });

      // Bottom date
      ctx.fillStyle = "#888888";
      ctx.font = "400 18px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      ctx.fillText(formatDatePtBR(data), W / 2, H - 120);

      // Footer line
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W * 0.3, H - 80);
      ctx.lineTo(W * 0.7, H - 80);
      ctx.stroke();

      ctx.fillStyle = "#1a3a3a";
      ctx.font = "600 14px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      ctx.fillText("Associação Allos · allos.org.br", W / 2, H - 55);
    },
    [nome, horas, textoCorpo, data]
  );

  function preview() {
    if (!nome.trim()) {
      toast.error("Preencha o nome.");
      return;
    }
    setPreviewing(true);
    setTimeout(() => {
      if (canvasRef.current) drawCertificate(canvasRef.current);
    }, 100);
  }

  function downloadPDF() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imgData = canvas.toDataURL("image/png", 1.0);
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.addImage(imgData, "PNG", 0, 0, 297, 210);
    const safeName = nome.replace(/\s+/g, "_") || "Certificado";
    pdf.save(`Certificado_Allos_${safeName}.pdf`);
    toast.success("PDF baixado!");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-fraunces font-bold text-xl text-cream">Certificado Avulso</h1>
        <p className="text-sm text-cream/40 mt-1 font-dm">
          Emita certificados personalizados para estagiarios, colaboradores ou qualquer finalidade.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-dm text-cream/50 mb-1.5">Nome completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Maria da Silva Santos"
                  className="w-full px-3 py-2.5 rounded-lg text-sm font-dm text-cream outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-dm text-cream/50 mb-1.5">Carga horaria</label>
                  <input
                    type="number"
                    value={horas}
                    onChange={(e) => setHoras(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2.5 rounded-lg text-sm font-dm text-cream outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-dm text-cream/50 mb-1.5">Data</label>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm font-dm text-cream outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", colorScheme: "dark" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-dm text-cream/50 mb-1.5">
                  Texto do certificado
                </label>
                <textarea
                  value={textoCorpo}
                  onChange={(e) => setTextoCorpo(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg text-sm font-dm text-cream outline-none resize-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <p className="text-[10px] font-dm text-cream/25 mt-1.5">
                  Variaveis disponíveis: <code className="text-cream/40">{"{nome}"}</code>, <code className="text-cream/40">{"{horas}"}</code>, <code className="text-cream/40">{"{horas_extenso}"}</code>, <code className="text-cream/40">{"{data}"}</code>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={preview}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-dm font-semibold transition-all"
                  style={{ background: "rgba(46,158,143,0.12)", color: "#2E9E8F", border: "1px solid rgba(46,158,143,0.2)" }}
                >
                  <Eye className="h-4 w-4" /> Visualizar
                </button>
                {previewing && (
                  <button
                    onClick={downloadPDF}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-dm font-semibold transition-all"
                    style={{ background: "rgba(200,75,49,0.12)", color: "#C84B31", border: "1px solid rgba(200,75,49,0.2)" }}
                  >
                    <Download className="h-4 w-4" /> Baixar PDF
                  </button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Preview */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {previewing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-dm text-cream/40">Pre-visualizacao</p>
                <button
                  onClick={() => { setPreviewing(false); }}
                  className="text-xs font-dm text-cream/30 hover:text-cream/50 flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Editar
                </button>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: "2px solid rgba(200,75,49,0.15)" }}>
                <canvas ref={canvasRef} className="w-full h-auto" style={{ display: "block" }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[300px] rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}>
              <div className="text-center">
                <Award className="h-10 w-10 mx-auto mb-3" style={{ color: "rgba(253,251,247,0.1)" }} />
                <p className="text-sm font-dm text-cream/20">Clique em &quot;Visualizar&quot; para ver o certificado</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
