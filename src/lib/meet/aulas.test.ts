// A aula do curso é o vídeo do YouTube; o Drive é onde o arquivo mora.
//
// Estes testes existem por causa de um caso real: em 04/08/2026 a sugestão
// entrou na fila às 20:21:12 com o link do Drive, porque o envio ao YouTube
// ainda não tinha terminado, e foi aprovada às 20:21:29. Dezessete segundos
// depois o vídeo ficou pronto no YouTube, e a aula seguiu apontando para o
// Drive, porque nada voltava para corrigir aula já publicada.

import { describe, expect, it } from "vitest";
import { decidirTroca, deveEsperarYoutube, ehDrive, montarUrl, podeCorrigirAula } from "./aulas";

const DRIVE = "https://drive.google.com/file/d/1_izx8pnENaARvu-X7RkdFcRYg4G2I2Mg/view?usp=drive_web";
const YT = "https://www.youtube.com/watch?v=kwNnyzFU2Go";

describe("ehDrive", () => {
  it("reconhece o arquivo do Drive", () => {
    expect(ehDrive(DRIVE)).toBe(true);
  });

  it("não confunde o YouTube com o Drive", () => {
    expect(ehDrive(YT)).toBe(false);
    expect(ehDrive(null)).toBe(false);
  });
});

describe("deveEsperarYoutube", () => {
  it("segura a gravação enquanto o vídeo não existe no YouTube", () => {
    expect(deveEsperarYoutube(true, null)).toBe(true);
  });

  it("libera assim que o vídeo existe", () => {
    expect(deveEsperarYoutube(true, "kwNnyzFU2Go")).toBe(false);
  });

  it("não segura sala que não publica no YouTube", () => {
    // Desligar o envio e mesmo assim nunca ver a aula aparecer seria armadilha:
    // quem desligou espera o comportamento antigo, com o link do Drive.
    expect(deveEsperarYoutube(false, null)).toBe(false);
  });
});

describe("decidirTroca", () => {
  const pendenteDrive = { status: "pendente", video_url: DRIVE, lesson_id: null };
  const aprovadaDrive = { status: "aprovada", video_url: DRIVE, lesson_id: "aula-1" };

  it("troca o link da sugestão que ainda espera aprovação", () => {
    expect(decidirTroca(pendenteDrive, "kwNnyzFU2Go")).toBe("sugestao");
  });

  it("corrige a aula já publicada — o caso de 04/08/2026", () => {
    expect(decidirTroca(aprovadaDrive, "kwNnyzFU2Go")).toBe("aula");
  });

  it("não faz nada enquanto o YouTube não existe", () => {
    expect(decidirTroca(pendenteDrive, null)).toBe("nada");
    expect(decidirTroca(aprovadaDrive, null)).toBe("nada");
  });

  it("não mexe no que já aponta para o YouTube", () => {
    expect(
      decidirTroca({ status: "aprovada", video_url: YT, lesson_id: "aula-1" }, "kwNnyzFU2Go")
    ).toBe("nada");
  });

  it("ignora sugestão descartada e aprovada sem aula", () => {
    expect(decidirTroca({ status: "descartada", video_url: DRIVE, lesson_id: null }, "abc")).toBe(
      "nada"
    );
    expect(decidirTroca({ status: "aprovada", video_url: DRIVE, lesson_id: null }, "abc")).toBe(
      "nada"
    );
  });
});

describe("podeCorrigirAula", () => {
  it("corrige quando a aula está com o link que a sugestão pôs lá", () => {
    expect(podeCorrigirAula({ video_url: DRIVE }, DRIVE)).toBe(true);
  });

  it("respeita quem editou o vídeo da aula à mão", () => {
    expect(podeCorrigirAula({ video_url: DRIVE }, "https://vimeo.com/123")).toBe(false);
  });

  it("não corrige aula que sumiu", () => {
    expect(podeCorrigirAula({ video_url: DRIVE }, null)).toBe(false);
    expect(podeCorrigirAula({ video_url: DRIVE }, undefined)).toBe(false);
  });
});

describe("montarUrl", () => {
  it("usa o Drive só enquanto não há vídeo no YouTube", () => {
    expect(montarUrl(DRIVE, null, null)).toBe(DRIVE);
  });

  it("começa no minuto em que o encontro de fato começou", () => {
    expect(montarUrl(DRIVE, "kwNnyzFU2Go", 320)).toBe(
      "https://www.youtube.com/watch?v=kwNnyzFU2Go&t=320"
    );
  });

  it("sem corte quando o encontro começou junto com a gravação", () => {
    expect(montarUrl(DRIVE, "kwNnyzFU2Go", 0)).toBe(YT);
  });
});
