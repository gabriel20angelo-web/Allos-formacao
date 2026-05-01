// Recolorir o ícone Allos verde → laranja (accent #C84B31).
// Uso: node scripts/tint-icon.mjs
// Requer sharp já instalado nas deps do projeto.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "public", "Icone_Allos_Verde.png");
const out = path.join(root, "public", "Icone_Allos_Laranja.png");

// #C84B31 ≈ rgb(200, 75, 49) — accent terracota oficial.
await sharp(src)
  .tint({ r: 200, g: 75, b: 49 })
  .toFile(out);

console.log("OK:", out);
