// A imagem que aparece no WhatsApp.
//
// Gerada por código, não desenhada: cada grupo precisa da sua, com o próprio
// nome escrito, e ninguém vai abrir um editor de imagem toda vez que um horário
// mudar de atividade.
//
// As medidas seguem o que a Meta documenta: 1200x630 (dentro da proporção
// máxima de 4:1) e largura bem acima dos 300px que fazem o WhatsApp mostrar a
// prévia GRANDE em vez de uma miniatura de canto. Sem imagem de fundo nem
// fonte externa, o arquivo sai na casa das dezenas de kilobytes — bem abaixo
// dos 600KB documentados, e longe do tempo limite de dez segundos que o
// aparelho do remetente dá para montar a prévia.
//
// Tudo que importa fica no miolo: o WhatsApp corta pelas bordas quando a
// proporção do container não bate com a da imagem.

import { ImageResponse } from "next/og";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Encontro ao vivo da Associação Allos";

const VINHO = "#C84B31";
const CREME = "#FDFBF7";

async function nomeDoGrupo(slug: string): Promise<string | null> {
  try {
    const sb = await createServiceRoleClient();
    const { data: link } = await sb
      .from("study_links")
      .select("label, space_name")
      .eq("slug", slug)
      .maybeSingle();

    if (!link) return null;
    if (link.label) return link.label;
    if (!link.space_name) return null;

    const { data: sala } = await sb
      .from("formacao_meet_spaces")
      .select("rotulo, slot_id")
      .eq("space_name", link.space_name)
      .maybeSingle();

    if (sala?.rotulo) return sala.rotulo;
    if (!sala?.slot_id) return null;

    const { data: slot } = await sb
      .from("formacao_slots")
      .select("atividade_nome")
      .eq("id", sala.slot_id)
      .maybeSingle();

    return slot?.atividade_nome || null;
  } catch {
    // Imagem sem nome ainda serve; imagem que não carrega, não.
    return null;
  }
}

export default async function Image({ params }: { params: { shortlink: string } }) {
  const nome = await nomeDoGrupo(decodeURIComponent(params.shortlink).toLowerCase());

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
          background: "#111111",
          padding: "0 90px",
          position: "relative",
        }}
      >
        {/* Faixa superior: dá a cor da marca sem competir com o texto. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            background: VINHO,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 30 }}>
          {/* Ponto vermelho: o sinal universal de "acontecendo agora". */}
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              background: "#FF4D4D",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 30,
              letterSpacing: 9,
              color: "#FF4D4D",
              fontWeight: 700,
              display: "flex",
            }}
          >
            AO VIVO AGORA
          </div>
        </div>

        <div
          style={{
            fontSize: nome && nome.length > 34 ? 62 : 78,
            fontWeight: 700,
            color: CREME,
            textAlign: "center",
            lineHeight: 1.15,
            display: "flex",
            maxWidth: 1000,
          }}
        >
          {nome || "Encontro online"}
        </div>

        <div
          style={{
            marginTop: 36,
            padding: "20px 46px",
            borderRadius: 18,
            background: VINHO,
            color: "#FFFFFF",
            fontSize: 36,
            fontWeight: 700,
            display: "flex",
          }}
        >
          Toque para entrar
        </div>

        <div
          style={{
            marginTop: 34,
            fontSize: 26,
            color: "rgba(253,251,247,0.4)",
            letterSpacing: 3,
            display: "flex",
          }}
        >
          ASSOCIAÇÃO ALLOS
        </div>
      </div>
    ),
    size
  );
}
