import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const alt = "Allos Formação — Cursos de psicologia e formação continuada";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logoPath = path.join(process.cwd(), "public", "Logo_Allos_Light.png");
  const logoBase64 = fs.readFileSync(logoPath).toString("base64");
  const logoSrc = `data:image/png;base64,${logoBase64}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(ellipse at top left, #1a4a47 0%, #0d2a28 55%, #081a18 100%)",
          padding: "80px",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(circle at 80% 90%, rgba(200,75,49,0.18) 0%, transparent 50%)",
          }}
        />
        <img
          src={logoSrc}
          width={420}
          height={140}
          alt=""
          style={{ objectFit: "contain", marginBottom: 56 }}
        />
        <div
          style={{
            fontSize: 78,
            fontWeight: 700,
            color: "#FDFBF7",
            letterSpacing: "-0.02em",
            textAlign: "center",
            lineHeight: 1.05,
            marginBottom: 24,
          }}
        >
          Formação clínica crítica
        </div>
        <div
          style={{
            fontSize: 34,
            color: "rgba(253,251,247,0.78)",
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.3,
            fontStyle: "italic",
          }}
        >
          Cursos de psicologia, pesquisa e formação continuada pela Associação Allos
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 48,
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "rgba(253,251,247,0.55)",
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          allos.org.br/formacao
        </div>
      </div>
    ),
    { ...size },
  );
}
