// O vídeo do encontro começa onde o encontro começou.
//
// A sala do Meet abre quinze minutos antes do horário e a gravação pega esse
// vazio: a chegada das pessoas, a conversa antes de todo mundo saber que está
// sendo gravado. O sistema calcula o segundo em que a segunda pessoa entrou e
// grava o endereço com `&t=`. O embed do YouTube, porém, só entende `start`.

import { describe, expect, it } from "vitest";
import { detectVideoSource, extractStartSeconds, getEmbedUrl } from "./video";

describe("extractStartSeconds", () => {
  it("lê os segundos que o sistema grava", () => {
    expect(extractStartSeconds("https://www.youtube.com/watch?v=kwNnyzFU2Go&t=37")).toBe(37);
  });

  it("lê as formas que o YouTube usa", () => {
    expect(extractStartSeconds("https://youtu.be/abc?t=90s")).toBe(90);
    expect(extractStartSeconds("https://youtu.be/abc?t=1m30s")).toBe(90);
    expect(extractStartSeconds("https://youtu.be/abc?t=1h2m3s")).toBe(3723);
  });

  it("devolve nulo quando não há corte", () => {
    expect(extractStartSeconds("https://www.youtube.com/watch?v=kwNnyzFU2Go")).toBe(null);
    expect(extractStartSeconds("https://www.youtube.com/watch?v=kwNnyzFU2Go&t=0")).toBe(null);
  });
});

describe("getEmbedUrl", () => {
  it("pula a chegada das pessoas — a aula de 04/08/2026", () => {
    const url = getEmbedUrl("https://www.youtube.com/watch?v=kwNnyzFU2Go&t=37", "youtube");
    expect(url).toContain("youtube-nocookie.com/embed/kwNnyzFU2Go");
    expect(url).toContain("start=37");
  });

  it("não inventa corte onde não há", () => {
    expect(getEmbedUrl("https://www.youtube.com/watch?v=kwNnyzFU2Go", "youtube")).not.toContain(
      "start="
    );
  });

  it("continua tocando Drive como antes", () => {
    expect(getEmbedUrl("https://drive.google.com/file/d/ABC123/view", "google_drive")).toBe(
      "https://drive.google.com/file/d/ABC123/preview"
    );
  });

  it("não embute endereço que não é http", () => {
    expect(getEmbedUrl("javascript:alert(1)", "other")).toBe("");
  });
});

describe("detectVideoSource", () => {
  it("reconhece o que a plataforma toca", () => {
    expect(detectVideoSource("https://www.youtube.com/watch?v=kwNnyzFU2Go&t=37")).toBe("youtube");
    expect(detectVideoSource("https://drive.google.com/file/d/ABC/view")).toBe("google_drive");
  });

  it("não cai em domínio que imita o Drive", () => {
    expect(detectVideoSource("https://evil.com/drive.google.com/file/d/ABC/view")).toBe("other");
  });
});
