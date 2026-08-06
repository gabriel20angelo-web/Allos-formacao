import { describe, expect, it } from "vitest";
import { validadeDoEndereco } from "./opusclip";

// A validade vem escrita no próprio endereço, e é o que permite saber se a
// miniatura vai aparecer sem gastar uma requisição por clipe. Se a leitura
// errar, ou o sistema renova o tempo todo à toa, ou deixa a tela preta.

const PREFIXO =
  "https://signed-ext.cdn.opus.pro/media/org_1/user_1/P30803/c.jpg?v=1785792374541397&hdnts=";

function endereco(expiresEpoch: number): string {
  return `${PREFIXO}URLPrefix=aHR0cHM6&Expires=${expiresEpoch}~Signature=qBzZrD`.replace(
    "&Expires=",
    "~Expires="
  );
}

describe("validadeDoEndereco", () => {
  it("lê a data de vencimento assinada", () => {
    const quando = validadeDoEndereco(endereco(1786064598));
    expect(quando?.toISOString()).toBe("2026-08-07T01:03:18.000Z");
  });

  it("devolve null para endereço sem assinatura", () => {
    expect(validadeDoEndereco("https://exemplo.com/video.mp4")).toBeNull();
  });

  it("devolve null para vazio, e não quebra", () => {
    expect(validadeDoEndereco(null)).toBeNull();
    expect(validadeDoEndereco(undefined)).toBeNull();
    expect(validadeDoEndereco("")).toBeNull();
  });

  it("devolve null quando o Expires não é um instante plausível", () => {
    // Segundos pequenos demais são lixo, não 1970: aceitar viraria "venceu há
    // cinquenta anos" e mandaria renovar tudo para sempre.
    expect(validadeDoEndereco(endereco(42))).toBeNull();
  });

  it("não quebra com endereço malformado", () => {
    expect(validadeDoEndereco("nem-url-isso-e")).toBeNull();
  });

  it("reconhece endereço já vencido", () => {
    const ontem = Math.floor(Date.now() / 1000) - 24 * 3600;
    const quando = validadeDoEndereco(endereco(ontem));
    expect(quando).not.toBeNull();
    expect(quando!.getTime()).toBeLessThan(Date.now());
  });
});
