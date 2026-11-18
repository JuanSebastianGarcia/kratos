// Genera el ícono de la app y la pantalla de inicio (splash) para Android
// a partir de resources/logo-kratos.png (K con mancuerna, fondo transparente).
// Uso: npm run icons   (solo hace falta si cambias el logo)
import sharp from 'sharp';
import { readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const LOGO = 'resources/logo-kratos.png';
const ICON_BG = '#000000';   // fondo del ícono (negro, como el diseño original)
const SPLASH_BG = '#0E0F11'; // fondo de la app
const RES = 'android/app/src/main/res';

// Logo centrado en un lienzo cuadrado de `canvas` px con fondo `bg` (o transparente).
async function compose(canvas, logoFrac, bg, { round = false, radius = 0 } = {}) {
  const size = Math.round(canvas * logoFrac);
  const logo = await sharp(LOGO).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const off = Math.round((canvas - size) / 2);
  let img = sharp({ create: { width: canvas, height: canvas, channels: 4, background: bg || { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, left: off, top: off }]);
  if (round || radius) {
    const r = round ? canvas / 2 : radius;
    const mask = Buffer.from(`<svg width="${canvas}" height="${canvas}"><rect width="${canvas}" height="${canvas}" rx="${r}" ry="${r}"/></svg>`);
    img = sharp(await img.png().toBuffer()).composite([{ input: mask, blend: 'dest-in' }]);
  }
  return img.png().toBuffer();
}

const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, f] of Object.entries(dens)) {
  const dir = join(RES, 'mipmap-' + d);
  mkdirSync(dir, { recursive: true });
  const s48 = Math.round(48 * f), s108 = Math.round(108 * f);
  // Ícono clásico (Android < 8) y redondo
  writeFileSync(join(dir, 'ic_launcher.png'), await compose(s48, 0.72, ICON_BG, { radius: s48 * 0.22 }));
  writeFileSync(join(dir, 'ic_launcher_round.png'), await compose(s48, 0.66, ICON_BG, { round: true }));
  // Primer plano del ícono adaptativo (Android 8+): el logo cabe en la zona segura central (66 de 108)
  writeFileSync(join(dir, 'ic_launcher_foreground.png'), await compose(s108, 0.56, null));
}

writeFileSync(join(RES, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${ICON_BG}</color>\n</resources>\n`);

// Splash (Android < 12 lo usa como fondo al abrir)
for (const dir of readdirSync(RES).filter(d => d.startsWith('drawable'))) {
  const f = join(RES, dir, 'splash.png');
  if (!existsSync(f)) continue;
  const { width, height } = await sharp(f).metadata();
  const s = Math.round(Math.min(width, height) * 0.32);
  const logo = await sharp(LOGO).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const buf = await sharp({ create: { width, height, channels: 4, background: SPLASH_BG } })
    .composite([{ input: logo, left: Math.round((width - s) / 2), top: Math.round((height - s) / 2) }]).png().toBuffer();
  writeFileSync(f, buf);
}

// Vista previa
mkdirSync('resources', { recursive: true });
writeFileSync('resources/icon-512.png', await compose(512, 0.72, ICON_BG, { radius: 512 * 0.22 }));
console.log('Íconos generados.');
