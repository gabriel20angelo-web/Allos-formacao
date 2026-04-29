export function generateCertificateCode(): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  // crypto.getRandomValues é criptograficamente seguro (Math.random é
  // previsível e potencialmente colidível em volume).
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return `ALLOS-${year}-${code}`;
}
