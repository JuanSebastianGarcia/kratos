// Genera el ícono de la app y la pantalla de inicio (splash) para Android.
// Uso: npm run icons   (ya se ejecutó una vez; solo hace falta si cambias el diseño)
import sharp from 'sharp';
import { readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BG = '#0E0F11';
const ACC = '#C6F432';
const RES = 'android/app/src/main/res';

// "K" geométrica centrada en un lienzo de 108x108 (tamaño del ícono adaptativo de Android).
const K = `<g fill="${ACC}">
  <rect x="33" y="30" width="11" height="48" rx="2"/>
  <polygon points="42,52 62,30 75,30 42,67"/>
  <polygon points="49,55 57,47 76,78 63,78"/>
</g>`;

const svg = ({ bg = true, radius = 0, scale = 1 } = {}) => {
  const t = 54 - 54 * scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108">
  ${bg ? `<rect width="108" height="108" rx="${radius}" fill="${BG}"/>` : ''}
  <g transform="translate(${t} ${t}) scale(${scale})">${K}</g></svg>`);
};

const png = (buf, size, out) => sharp(buf, { density: 72 * size / 108 * 4 }).resize(size, size).png().toFile(out);

const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, f] of Object.entries(dens)) {
  const dir = join(RES, 'mipmap-' + d);
  mkdirSync(dir, { recursive: true });
  // Ícono clásico (Android < 8): cuadrado redondeado, la K un poco más grande.
  await png(svg({ radius: 22, scale: 1.25 }), Math.round(48 * f), join(dir, 'ic_launcher.png'));
  // Ícono redondo
  const r = Math.round(48 * f);
  const round = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108"><circle cx="54" cy="54" r="54" fill="${BG}"/><g transform="translate(-13.5 -13.5) scale(1.25)">${K}</g></svg>`);
  await png(round, r, join(dir, 'ic_launcher_round.png'));
  // Primer plano del ícono adaptativo (Android 8+): el fondo va como color aparte.
  await png(svg({ bg: false }), Math.round(108 * f), join(dir, 'ic_launcher_foreground.png'));
}

writeFileSync(join(RES, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);

// Splash (Android < 12 lo usa como fondo al abrir)
for (const dir of readdirSync(RES).filter(d => d.startsWith('drawable'))) {
  const f = join(RES, dir, 'splash.png');
  if (!existsSync(f)) continue;
  const { width, height } = await sharp(f).metadata();
  const s = Math.round(Math.min(width, height) * 0.28);
  const logo = await sharp(svg({ bg: false, scale: 1.3 }), { density: 72 * s / 108 * 2 }).resize(s, s).png().toBuffer();
  const buf = await sharp({ create: { width, height, channels: 4, background: BG } })
    .composite([{ input: logo, left: Math.round((width - s) / 2), top: Math.round((height - s) / 2) }]).png().toBuffer();
  writeFileSync(f, buf);
}

// Copias de referencia
mkdirSync('resources', { recursive: true });
writeFileSync('resources/icon.svg', svg({ radius: 24, scale: 1.25 }));
await png(svg({ radius: 24, scale: 1.25 }), 512, 'resources/icon-512.png');
console.log('Íconos generados.');
