"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import { Award, Download, Eye, RotateCcw } from "lucide-react";
import { jsPDF } from "jspdf";

type TipoCert = "participação" | "conclusão" | "supervisão" | "palestra" | "organização";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

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
  const [tipo, setTipo] = useState<TipoCert>("conclusão");
  const [textoCorpo, setTextoCorpo] = useState(
    "concluiu com êxito o programa de estágio em Psicologia Clínica da Associação Allos, com carga horária total de {horas} ({horas_extenso}) horas, no período de {data}."
  );
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [previewing, setPreviewing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signatureImg, setSignatureImg] = useState<HTMLImageElement | null>(null);
  // Código de verificação do documento já registrado. Vazio enquanto o
  // certificado é só uma prévia na tela.
  const [codigo, setCodigo] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);

  useEffect(() => {
    loadImage("/assinatura.jpg").then(setSignatureImg).catch(() => {});
  }, []);

  // O código entra por parâmetro, e não só pelo estado, porque o download
  // desenha e exporta na mesma função: esperar o React repintar para depois
  // capturar o canvas é uma corrida que às vezes salva o PDF sem o rodapé.
  const drawCertificate = useCallback(
    (canvas: HTMLCanvasElement, codigoImpresso?: string | null) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cod = codigoImpresso !== undefined ? codigoImpresso : codigo;

      const W = 1684;
      const H = 1190;
      canvas.width = W;
      canvas.height = H;
      const cx = W / 2;

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

      // Inner frame
      const fm = 40;
      ctx.strokeStyle = "rgba(26,58,58,0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(fm, fm, W - fm * 2, H - fm * 2);

      // Header
      ctx.textAlign = "center";
      ctx.font = "700 28px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = "#1a3a3a";
      ctx.letterSpacing = "8px";
      ctx.fillText("ASSOCIAÇÃO ALLOS", cx, 110);
      ctx.letterSpacing = "0px";

      ctx.font = "400 16px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = "#888888";
      ctx.letterSpacing = "4px";
      ctx.fillText("PSICOLOGIA  ·  FORMAÇÃO  ·  PESQUISA", cx, 140);
      ctx.letterSpacing = "0px";

      // Decorative line with diamond
      const lineW = 120;
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - lineW, 165);
      ctx.lineTo(cx + lineW, 165);
      ctx.stroke();

      ctx.fillStyle = "#c0392b";
      ctx.save();
      ctx.translate(cx, 165);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();

      // "CERTIFICADO"
      ctx.font = "300 72px Georgia, 'Times New Roman', serif";
      ctx.fillStyle = "#1a3a3a";
      ctx.fillText("CERTIFICADO", cx, 260);

      // "DE [TIPO]"
      ctx.font = "400 22px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = "#888888";
      ctx.letterSpacing = "6px";
      ctx.fillText(`DE ${tipo.toUpperCase()}`, cx, 295);
      ctx.letterSpacing = "0px";

      // "Certificamos que"
      ctx.font = "300 22px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = "#666666";
      ctx.fillText("Certificamos que", cx, 370);

      // Name
      ctx.font = "italic 700 52px Georgia, 'Times New Roman', serif";
      ctx.fillStyle = "#c0392b";
      const nameText = nome || "Nome Completo";
      ctx.fillText(nameText, cx, 440);

      // Name underline (gradient bar)
      const nw = ctx.measureText(nameText).width;
      const nlGrad = ctx.createLinearGradient(cx - nw / 2 - 10, 452, cx + nw / 2 + 10, 452);
      nlGrad.addColorStop(0, "transparent");
      nlGrad.addColorStop(0.15, "rgba(192,57,43,0.25)");
      nlGrad.addColorStop(0.85, "rgba(192,57,43,0.25)");
      nlGrad.addColorStop(1, "transparent");
      ctx.fillStyle = nlGrad;
      ctx.fillRect(cx - nw / 2 - 20, 448, nw + 40, 5);

      // Body text with variable replacement
      const h = parseInt(horas) || 0;
      const bodyText = textoCorpo
        .replace(/\{nome\}/g, nameText)
        .replace(/\{horas\}/g, String(h))
        .replace(/\{horas_extenso\}/g, horasExtenso(h))
        .replace(/\{data\}/g, formatDatePtBR(data));

      ctx.font = "300 20px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = "#444444";
      const lines = wrapText(ctx, bodyText, W * 0.65);
      lines.forEach((line, i) => {
        ctx.fillText(line, cx, 500 + i * 34);
      });

      // Location line
      const locY = 500 + lines.length * 34 + 30;
      ctx.font = "italic 18px Georgia, 'Times New Roman', serif";
      ctx.fillStyle = "#999999";
      ctx.fillText(`Belo Horizonte, ${formatDatePtBR(data)}`, cx, locY);

      // Signature
      if (signatureImg) {
        const iw = signatureImg.naturalWidth;
        const ih = signatureImg.naturalHeight;
        const sx = Math.round(iw * 0.36);
        const sy = Math.round(ih * 0.58);
        const sw = Math.round(iw * 0.40);
        const sh = Math.round(ih * 0.38);
        const sigDrawW = W * 0.30;
        const sigDrawH = sigDrawW * (sh / sw);
        const sigX = cx - sigDrawW / 2;
        const sigY = H - 55 - sigDrawH;
        ctx.drawImage(signatureImg, sx, sy, sw, sh, sigX, sigY, sigDrawW, sigDrawH);
      }

      // Rodapé de verificação, igual ao dos certificados de formação: o código
      // sozinho não verifica nada se quem recebe não souber onde digitá-lo.
      if (cod) {
        ctx.textAlign = "center";
        ctx.font = "400 15px 'Helvetica Neue', Arial, sans-serif";
        ctx.fillStyle = "#8a8a8a";
        ctx.fillText(`Código de verificação: ${cod}`, cx, H - 42);
        ctx.font = "300 13px 'Helvetica Neue', Arial, sans-serif";
        ctx.fillStyle = "#aaaaaa";
        ctx.fillText(
          "Confira a autenticidade em allos.org.br/formacao/certificado/verificar",
          cx,
          H - 24
        );
      }
    },
    [nome, horas, tipo, textoCorpo, data, signatureImg, codigo]
  );

  useEffect(() => {
    if (previewing && canvasRef.current) drawCertificate(canvasRef.current);
  }, [previewing, drawCertificate]);

  // Mudou qualquer campo, mudou o documento, e o código anterior deixa de valer
  // para ele. Sem isto, emitir para a segunda pessoa logo depois da primeira
  // imprimiria no PDF dela o código do certificado da outra, que é o pior tipo
  // de erro possível aqui: o documento pareceria verificável e apontaria para o
  // registro errado.
  useEffect(() => {
    setCodigo(null);
  }, [nome, horas, tipo, textoCorpo, data]);

  function preview() {
    if (!nome.trim()) {
      toast.error("Preencha o nome.");
      return;
    }
    setPreviewing(true);
  }

  // Baixar registra antes de gerar. A declaração avulsa é o documento com menos
  // amarras da plataforma, feita à mão, com texto livre e para quem quase nunca
  // tem conta: é justamente o que mais precisa de código para poder ser
  // conferido depois, e de registro para poder ser anulado se for preciso.
  async function downloadPDF() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cod = codigo;

    if (!cod) {
      setRegistrando(true);
      try {
        const res = await fetch("/formacao/api/admin/certificado-registrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "avulso",
            nome: nome.trim(),
            horas: parseInt(horas) || null,
            detalhes: {
              modalidade: tipo,
              data_referencia: data,
              texto: textoCorpo,
              origem: "certificado-avulso",
            },
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.code) {
          toast.error(json.error || "Não foi possível registrar. O PDF não foi gerado.");
          setRegistrando(false);
          return;
        }
        cod = json.code as string;
        setCodigo(cod);
      } catch {
        toast.error("Erro de rede ao registrar. O PDF não foi gerado.");
        setRegistrando(false);
        return;
      }
      setRegistrando(false);
    }

    // Redesenha com o código antes de capturar: o canvas na tela ainda é o de
    // antes do registro.
    drawCertificate(canvas, cod);

    const imgData = canvas.toDataURL("image/png", 1.0);
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.addImage(imgData, "PNG", 0, 0, 297, 210);
    const safeName = nome.replace(/\s+/g, "_") || "Certificado";
    pdf.save(`Certificado_Allos_${safeName}.pdf`);
    toast.success(`Certificado registrado com o código ${cod}.`);
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <label className="block text-xs font-dm text-cream/50 mb-1.5">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoCert)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm font-dm text-cream outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", colorScheme: "dark" }}
                >
                  <option value="participação">Participação</option>
                  <option value="conclusão">Conclusão</option>
                  <option value="supervisão">Supervisão</option>
                  <option value="palestra">Palestra</option>
                  <option value="organização">Organização</option>
                </select>
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

              <div className="flex flex-wrap gap-2 pt-2">
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
                    disabled={registrando}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-dm font-semibold transition-all disabled:opacity-40"
                    style={{ background: "rgba(200,75,49,0.12)", color: "#C84B31", border: "1px solid rgba(200,75,49,0.2)" }}
                  >
                    <Download className="h-4 w-4" />
                    {registrando ? "Registrando..." : "Baixar PDF"}
                  </button>
                )}
              </div>

              {previewing && (
                <p className="text-[11px] font-dm text-cream/30 leading-relaxed">
                  {codigo
                    ? `Registrado com o código ${codigo}. Baixar de novo devolve o mesmo documento; mudar qualquer campo cria um certificado novo.`
                    : "Cada download registra um certificado com código verificável, que pode ser conferido publicamente e anulado depois se for preciso."}
                </p>
              )}
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
