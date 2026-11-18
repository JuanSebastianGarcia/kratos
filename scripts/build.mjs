// Construye la carpeta www/ que Capacitor mete dentro del APK.
import { build } from 'esbuild';
import { rmSync, mkdirSync, copyFileSync } from 'node:fs';

rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });

await build({
  entryPoints: { native: 'src/native.js' },
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome90'],
  outdir: 'www',
  loader: { '.woff2': 'file', '.woff': 'file' },
  assetNames: 'fonts/[name]-[hash]',
  logLevel: 'info',
});

copyFileSync('src/index.html', 'www/index.html');
console.log('www/ listo');
