/**
 * Generates PWA icons from an inline SVG (an open book). Run: pnpm icons
 * Replace the SVG with the festival's own artwork if desired.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const BRAND = '#891a27';
const ACCENT = '#f8c56a';

function svg(size: number, padding: number) {
  const s = size;
  const p = padding;
  const w = s - p * 2;
  const x = p;
  const y = p + w * 0.18;
  const h = w * 0.64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${BRAND}"/>
  <g fill="none" stroke="${ACCENT}" stroke-width="${w * 0.045}" stroke-linejoin="round" stroke-linecap="round">
    <path d="M${x + w * 0.5} ${y + h * 0.12} C ${x + w * 0.38} ${y} ${x + w * 0.16} ${y} ${x + w * 0.04} ${y + h * 0.06} V ${y + h} C ${x + w * 0.16} ${y + h * 0.94} ${x + w * 0.38} ${y + h * 0.94} ${x + w * 0.5} ${y + h * 1.05} Z"/>
    <path d="M${x + w * 0.5} ${y + h * 0.12} C ${x + w * 0.62} ${y} ${x + w * 0.84} ${y} ${x + w * 0.96} ${y + h * 0.06} V ${y + h} C ${x + w * 0.84} ${y + h * 0.94} ${x + w * 0.62} ${y + h * 0.94} ${x + w * 0.5} ${y + h * 1.05} Z"/>
  </g>
</svg>`;
}

async function main() {
  const out = join(process.cwd(), 'public', 'icons');
  mkdirSync(out, { recursive: true });
  const jobs: Array<[string, number, number]> = [
    ['icon-192.png', 192, 24],
    ['icon-512.png', 512, 64],
    ['icon-maskable-512.png', 512, 112], // keeps the glyph inside the 80% safe zone
    ['apple-touch-icon.png', 180, 24],
    ['badge-96.png', 96, 12],
  ];
  for (const [name, size, pad] of jobs) {
    await sharp(Buffer.from(svg(size, pad)))
      .png({ compressionLevel: 9 })
      .toFile(join(out, name));
    console.log('wrote', name);
  }
  await sharp(Buffer.from(svg(48, 4)))
    .resize(32, 32)
    .png()
    .toFile(join(out, 'favicon-32.png'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
