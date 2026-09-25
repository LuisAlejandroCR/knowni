// write-qr.ts: escribe un QR como SVG en web/public/qr/.
//
// El QR se genera aquí y se sirve desde este dominio. Una imagen de una API de
// códigos QR le contaría a esa API quién mira el pitch, y W7 dice que esta
// página no incrusta terceros. Un SVG de un kilobyte y medio no necesita más.
//
//   node --experimental-strip-types web/tools/write-qr.ts <destino> <nombre>
//
// El destino es la URL que se codifica; el nombre, el fichero que sale. Sin
// destino no escribe nada: un QR que apunta a un sitio equivocado se imprime,
// se pega en una sala y nadie lo revisa.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const target = process.argv[2];
const name = process.argv[3];

if (target === undefined || !/^https:\/\/\S+$/.test(target)) {
  process.stderr.write("refused: el destino tiene que ser una URL https\n");
  process.exit(1);
}
if (name === undefined || !/^[a-z0-9-]+$/.test(name)) {
  process.stderr.write("refused: el nombre tiene que ser minúsculas, dígitos y guiones\n");
  process.exit(1);
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "qr");
mkdirSync(out, { recursive: true });

// Corrección media: aguanta un pliegue o un reflejo en una pantalla sin
// volverse ilegible, y no engorda el módulo tanto como la alta.
const svg = await QRCode.toString(target, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
writeFileSync(join(out, `${name}.svg`), svg);
process.stderr.write(`wrote public/qr/${name}.svg → ${target}\n`);
