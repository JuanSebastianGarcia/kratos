// Convierte el HTML del artifact de Claude.ai en la versión para Android (src/index.html).
//
// Uso:  npm run adaptar -- "kratos (1).html"
//
// Qué hace:
//  - Quita claude.use('db') / localStorage y guarda todo en el celular (Capacitor Preferences).
//  - Agrega la pantalla Ajustes (engranaje en Inicio) con Exportar / Importar datos en JSON.
//  - Conecta el Coach IA a Claude (Anthropic) con la clave de API del usuario (scripts/artifact/coach.js)
//    en vez de claude.use('sample'). La clave se guarda aparte y no sale en Exportar.
//  - Pantalla encendida durante el entreno y notificación con sonido y vibración al terminar el descanso.
//  - Fuentes incluidas en la app (sin Google Fonts) y botón atrás de Android.
// Los colores y el diseño se respetan tal como vienen en el artifact.
// Si el artifact cambió mucho y algún punto de anclaje ya no existe, el script avisa cuál.
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
if (!src) { console.error('Uso: npm run adaptar -- "archivo-del-artifact.html"'); process.exit(1); }
let s = readFileSync(src, 'utf8').replace(/\r\n/g, '\n');

// 0. Color de acento personalizable: todo lo que use el color fijo del diseño pasa a var(--acc) / var(--acc-rgb).
//    Se hace antes de insertar los bloques para no tocar la lista de colores predefinidos.
const accDef = /--acc:\s*(#[0-9A-Fa-f]{6})\s*;/.exec(s);
if (!accDef) throw new Error('No encontré la variable --acc en el CSS del artifact.');
const ACC = accDef[1].toUpperCase();
const [ar, ag, ab] = [1, 3, 5].map(i => parseInt(ACC.slice(i, i + 2), 16));
s = s.replace(accDef[0], '@@ACC_DEF@@');
s = s.replace(new RegExp(ACC, 'gi'), 'var(--acc)');
s = s.replace(new RegExp(`rgba\\(\\s*${ar}\\s*,\\s*${ag}\\s*,\\s*${ab}\\s*,`, 'g'), 'rgba(var(--acc-rgb),');
s = s.replace('@@ACC_DEF@@', `--acc:${ACC};--acc-rgb:${ar},${ag},${ab};`);
s = s.replace('</style>', `/* selector de color (Ajustes) */
.accs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
.accs button{aspect-ratio:1;border-radius:12px;border:2px solid transparent;padding:0}
.accs button.on{border-color:var(--tx);box-shadow:inset 0 0 0 3px var(--s1)}
input.rng{-webkit-appearance:none;appearance:none;width:100%;height:26px;border-radius:13px;outline:none;margin:0;background:var(--s2)}
input.rng::-webkit-slider-thumb{-webkit-appearance:none;width:30px;height:30px;border-radius:15px;background:#fff;border:3px solid var(--bg);box-shadow:0 1px 4px rgba(0,0,0,.6)}
/* respuestas del Coach IA en Markdown */
.md{display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.55;color:var(--tx2)}
.md h3,.md h4{margin:6px 0 0;font-family:"Space Grotesk",Inter,sans-serif;font-weight:700;color:var(--tx);line-height:1.25}
.md h3{font-size:18px}.md h4{font-size:15px}
.md p,.md ul,.md ol{margin:0}.md ul,.md ol{padding-left:20px;display:flex;flex-direction:column;gap:4px}
.md strong{color:var(--tx)}.md code{background:var(--s2);border-radius:6px;padding:1px 5px;font-size:13px}
.md hr{border:0;border-top:1px solid var(--line);margin:4px 0;width:100%}
.bubble.md{white-space:normal}
</style>`);
const bloque = f => readFileSync(new URL('./artifact/' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n').replace(/__ACC_DEF__/g, ACC);

function rep(old, nuevo, desc) {
  const n = s.split(old).length - 1;
  if (n !== 1) throw new Error(`No encontré (o hay ${n}) el punto de anclaje: ${desc}`);
  s = s.replace(old, () => nuevo);
}
function entre(ini, fin, nuevo, desc) {
  const a = s.indexOf(ini), b = s.indexOf(fin, a);
  if (a < 0 || b < 0) throw new Error('No encontré la sección: ' + desc);
  s = s.slice(0, a) + nuevo + s.slice(b);
}

// 1. Cabecera: fuentes locales y color de barra
function repRe(re, nuevo, desc) {
  if (!re.test(s)) throw new Error('No encontré el punto de anclaje: ' + desc);
  s = s.replace(re, nuevo);
}
s = s.replace(/<link rel="preconnect"[^>]*>\n/g, '');
repRe(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/,
  '<meta name="theme-color" content="#0E0F11">\n<meta name="color-scheme" content="dark">\n<link rel="stylesheet" href="native.css">', 'Google Fonts');

// 2. Input de importar + puente nativo antes del script de la app
rep('<div id="layer"></div>\n<script>', '<div id="layer"></div>\n<input type="file" id="importFile" hidden>\n<script src="native.js"></script>\n<script>', 'div#layer + <script>');

// 3. Íconos extra
repRe(/(\n \w+:'<svg[^\n]*')\n\};/, `$1,
 gear:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
 upload:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
 download:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
 tool:'<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg>'
};`, 'lista de íconos');

// 4. Almacenamiento: reemplaza claude db + localStorage
entre('/* ---------- almacenamiento ---------- */', '/* ---------- consultas ---------- */', bloque('almacenamiento.js'), 'almacenamiento');
s = s.replace(/\bput\('[a-z]_' \+ [\w.]+, [\w.]+\)/g, 'persist()');

// 5. Coach IA conectado a un modelo de lenguaje (Claude) con la clave del usuario.
//    Reemplaza todo el coach del artifact desde datosCoach() hasta las hojas (análisis, pantalla del análisis y chat).
entre('function datosCoach(){', '/* ----- hojas (sheets) ----- */', bloque('coach.js'), 'funciones del coach (datosCoach → hojas)');
rep(`Coach IA</span><span style="width:44px"></span></div>' +
    '<div class="col" style="gap:8px"><h2 style="font-size:26px">¿Cuál es tu objetivo?</h2>`,
  `Coach IA</span><button class="ico" data-ia="abrir" aria-label="Conexión de IA">' + I.gear + '</button></div>' +
    '<div class="col" style="gap:8px"><h2 style="font-size:26px">¿Cuál es tu objetivo?</h2>`, 'cabecera del coach');
rep(`  } else if (s.tipo === 'confirmar') {`, `  } else if (s.tipo === 'ia') {
    h = vSheetIA(s);
  } else if (s.tipo === 'confirmar') {`, 'hoja "confirmar"');

// 6. Ajustes: engranaje en Inicio, ruta, vista y acciones
rep(`'</span><h1>Hoy</h1></div>' +`,
  `'</span><h1>Hoy</h1></div><button class="ico box" data-a="go" data-v="ajustes" aria-label="Ajustes">' + I.gear + '</button></div>' +`, 'título "Hoy"');
rep(`return '<div class="col" style="gap:4px"><span class="mut" style="font-size:13px">' + fecha`,
  `return '<div class="row between" style="align-items:flex-start"><div class="col" style="gap:4px"><span class="mut" style="font-size:13px">' + fecha`, 'cabecera de Inicio');
rep(`  else if (v === 'analisis') html = vAnalisis();`, `  else if (v === 'analisis') html = vAnalisis();\n  else if (v === 'ajustes') html = vAjustes();`, 'ruta analisis en render()');
rep('/* ----- hojas (sheets) ----- */', bloque('ajustes.js') + '/* ----- hojas (sheets) ----- */', 'sección de hojas');
rep(`  enviarChat: () => enviarChat()\n};`, `  enviarChat: () => enviarChat(),
  exportar: () => exportarDatos(),
  importar: () => document.getElementById('importFile').click(),
  activarAvisos: () => { KN.notif.ready = null; KN.notif.init(true).then(ok => { toast(ok ? 'Avisos activados.' : 'Android no dio permiso. Puedes activarlo en Ajustes del sistema > Apps > Kratos > Notificaciones.'); render(); }); }
};`, 'fin de las acciones');

// 7. Entreno: pedir permiso de notificaciones al empezar; beep solo si no hay notificación
rep(`  saveActivo();\n  go('entreno');\n}`, `  KN.notif.init(true).then(() => { restSig = ''; syncEntreno(); });\n  saveActivo();\n  go('entreno');\n}`, 'final de startEntreno');
rep(`if (rest <= 0 && !d.avisado) { d.avisado = true; beep(); }`, `if (rest <= 0 && !d.avisado) { d.avisado = true; if (!restNotif) beep(); }`, 'aviso en tick()');
rep(`  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch(e){}`, `  KN.vibrate();`, 'vibración en beep()');

// Comprobación final: nada de Claude
const resto = s.match(/window\.claude|claude\.use|localStorage|\bput\(/g);
if (resto) throw new Error('Quedaron referencias sin adaptar: ' + [...new Set(resto)].join(', '));

writeFileSync('src/index.html', s);
console.log('src/index.html actualizado desde ' + src);
