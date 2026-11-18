/* ---------- almacenamiento (en el celular, con Capacitor Preferences) ---------- */
const KN = window.KN;
const STORE_KEY = 'kratos_datos_v1';
const DATA_KEYS = ['ejercicios','rutinas','perfil','sesiones','medidas','analisis'];
let saveT = null, saveChain = Promise.resolve(), saveErr = false;
function snapshot(){ return JSON.stringify({ ejercicios: S.ejercicios, rutinas: S.rutinas, perfil: S.perfil, sesiones: S.sesiones, medidas: S.medidas, analisis: S.analisis, activo: S.activo }); }
function writeNow(){
  clearTimeout(saveT); saveT = null;
  const data = snapshot();
  saveChain = saveChain.then(() => KN.storage.set(STORE_KEY, data)).then(() => { saveErr = false; }).catch(() => { if (!saveErr) { saveErr = true; toast('No se pudieron guardar los datos en el celular.'); } });
  return saveChain;
}
// Guarda todo el estado. soon = agrupa cambios rápidos (p. ej. mientras se escribe).
function persist(soon){ clearTimeout(saveT); if (soon) saveT = setTimeout(writeNow, 600); else writeNow(); }
const saveConfig = () => persist();
function saveActivo(soon){ persist(soon); syncEntreno(); }

/* ----- color de acento personalizado (se guarda en perfil.acento) ----- */
const ACC_DEF = '__ACC_DEF__'; // color original del diseño (lo pone scripts/adaptar.mjs)
const hexOk = h => /^#[0-9a-f]{6}$/i.test(h || '');
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const lum = h => hexRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce((t, v, i) => t + v * [.2126, .7152, .0722][i], 0);
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const acento = () => hexOk(S.perfil && S.perfil.acento) ? S.perfil.acento.toUpperCase() : ACC_DEF;
function aplicarAcento(){
  const h = acento(), st = document.documentElement.style;
  st.setProperty('--acc', h);
  st.setProperty('--acc-rgb', hexRgb(h).join(','));
  // texto encima del color: negro o blanco, el que se lea mejor
  st.setProperty('--acc-tx', contraste(h, '#0E0F11') >= contraste(h, '#FFFFFF') ? '#0E0F11' : '#FFFFFF');
}
function hslHex(h, s, l){
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function hexHsl(hex){
  const [r, g, b] = hexRgb(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/* ----- pantalla encendida y aviso de fin de descanso ----- */
const REST_NOTIF = 1001;
let restSig = '', restNotif = false;
function textoSiguiente(a, d){
  const ex = a.ejercicios[d.ex]; if (!ex) return 'Toca para continuar.';
  if (typeof miembros === 'function' && typeof celdaAbierta === 'function') {
    const m = miembros(a, d.ex), ab = celdaAbierta(a, m), esBi = m.length > 1;
    if (ab) return 'Sigue: ' + ejName(a.ejercicios[ab.e].ejId) + (esBi ? ', ronda ' : ', serie ') + (ab.r + 1);
    return (esBi ? 'Terminaste la biserie.' : 'Terminaste ' + ejName(ex.ejId) + '.') + ' Toca para continuar.';
  }
  const i = ex.series.findIndex(s => !s.done);
  return i !== -1 ? 'Sigue: ' + ejName(ex.ejId) + ', serie ' + (i+1) : 'Terminaste ' + ejName(ex.ejId) + '. Toca para continuar.';
}
function syncEntreno(){
  const a = S.activo;
  KN.keepAwake(!!a);
  const d = a && a.descanso;
  const sig = d ? d.inicio + ':' + d.objetivo : '';
  if (sig === restSig) return;
  restSig = sig;
  restNotif = false;
  if (!d) { KN.notif.cancel(REST_NOTIF); return; }
  const at = d.inicio + d.objetivo*1000;
  restNotif = KN.notif.enabled && at > Date.now() + 500;
  KN.notif.schedule(REST_NOTIF, at, '¡Descanso terminado!', textoSiguiente(a, d), acento());
}

function applyLoaded(o){
  if (!o) return;
  ['ejercicios','rutinas','sesiones','medidas','analisis'].forEach(k => { if (Array.isArray(o[k])) S[k] = o[k]; });
  if (o.perfil) S.perfil = o.perfil;
  S.activo = o.activo || null;
}
function ensureBase(){
  if (!S.ejercicios.length) { S.ejercicios = BASE_EJ.map(([n,g]) => ({ id: uid(), nombre: n, grupo: g })); return true; }
  return false;
}
function ordenar(){
  S.sesiones.sort((a, b) => b.inicio - a.inicio);
  S.medidas.sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0));
  S.analisis.sort((a, b) => b.fecha - a.fecha);
}
async function boot(){
  try {
    const raw = await KN.storage.get(STORE_KEY);
    if (raw) applyLoaded(JSON.parse(raw));
  } catch(e) {
    ui.saveNote = 'No se pudieron leer los datos guardados en este celular.';
  }
  if (ensureBase()) persist();
  ordenar();
  aplicarAcento();
  if (S.activo) ui.view = 'entreno';
  render();
  KN.notif.init(false).then(() => { restSig = ''; syncEntreno(); });
  KN.onPause(() => { if (saveT) writeNow(); });
  KN.onResume(() => { tick(); });
  KN.onBack(atras);
}

/* ----- exportar / importar ----- */
function exportarDatos(){
  const o = {}; DATA_KEYS.forEach(k => { o[k] = S[k]; });
  const nombre = 'kratos-datos-' + todayISO() + '.json';
  KN.exportFile(nombre, JSON.stringify(o, null, 2))
    .then(r => toast(r && r.saved ? 'Copia guardada en ' + r.saved + ' (' + nombre + ').' : 'Copia lista para compartir.'))
    .catch(() => toast('No se pudo exportar. Intenta de nuevo.'));
}
const toMs = v => typeof v === 'number' ? v : (typeof v === 'string' && !isNaN(Date.parse(v)) ? Date.parse(v) : NaN);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
// Revisa y limpia el JSON importado para que la app no se rompa con datos incompletos.
function normalizar(o){
  if (!isObj(o)) throw 'El archivo no tiene el formato de datos de Kratos.';
  const presentes = DATA_KEYS.filter(k => o[k] != null);
  if (!presentes.length) throw 'El archivo no tiene ejercicios, rutinas, perfil, sesiones, medidas ni analisis.';
  presentes.forEach(k => { if (k === 'perfil' ? !isObj(o[k]) : !Array.isArray(o[k])) throw '"' + k + '" no tiene el formato esperado.'; });
  const r = {};
  if (o.ejercicios) r.ejercicios = o.ejercicios.filter(e => isObj(e) && e.nombre).map(e => ({ id: String(e.id || uid()), nombre: String(e.nombre), grupo: GRUPOS.includes(e.grupo) ? e.grupo : 'Otro' }));
  if (o.rutinas) r.rutinas = o.rutinas.filter(x => isObj(x) && x.nombre).map(x => {
    // "grupo" en un ítem de rutina = id de la biserie a la que pertenece
    const items = (Array.isArray(x.items) ? x.items : []).filter(isObj).map(it => ({ ejId: String(it.ejId), series: +it.series || 3, repsMin: +it.repsMin || 8, repsMax: +it.repsMax || +it.repsMin || 12, descanso: +it.descanso || 90, grupo: it.grupo ? String(it.grupo) : null }));
    if (typeof normalizarGrupos === 'function') normalizarGrupos(items);
    return { id: String(x.id || uid()), nombre: String(x.nombre), dias: Array.isArray(x.dias) ? x.dias.map(Number).filter(d => d >= 0 && d <= 6) : [], items };
  });
  if (o.perfil) r.perfil = Object.assign({ pesoMeta: null }, o.perfil);
  if (o.sesiones) r.sesiones = o.sesiones.filter(s => isObj(s) && Array.isArray(s.ejercicios) && !isNaN(toMs(s.inicio))).map(s => {
    const ini = toMs(s.inicio), fin = toMs(s.fin);
    return Object.assign({}, s, { id: String(s.id || uid()), nombre: String(s.nombre || 'Entreno'), inicio: ini, fin: isNaN(fin) ? ini : fin,
      ejercicios: s.ejercicios.filter(e => isObj(e) && Array.isArray(e.series)).map(e => Object.assign({}, e, { ejId: String(e.ejId), grupo: e.grupo ? String(e.grupo) : null, series: e.series.filter(isObj).map(z => ({ kg: num(z.kg) || 0, reps: num(z.reps) || 0, descanso: z.descanso == null ? null : +z.descanso })) })) });
  });
  if (o.medidas) r.medidas = o.medidas.filter(m => isObj(m) && m.fecha).map(m => ({ id: String(m.id || uid()), fecha: String(m.fecha).slice(0, 10), peso: num(m.peso) || null, grasa: num(m.grasa) || null, partes: isObj(m.partes) ? m.partes : {} }));
  if (o.analisis) r.analisis = o.analisis.filter(a => isObj(a) && isObj(a.res)).map(a => Object.assign({}, a, { id: String(a.id || uid()), fecha: isNaN(toMs(a.fecha)) ? Date.now() : toMs(a.fecha), objetivos: Array.isArray(a.objetivos) ? a.objetivos : [], semanas: +a.semanas || 0, chat: Array.isArray(a.chat) ? a.chat : [],
    res: Object.assign({ puntaje: 0, veredicto: '', resumen: '' }, a.res, { areas: Array.isArray(a.res.areas) ? a.res.areas.filter(isObj) : [], cambios: Array.isArray(a.res.cambios) ? a.res.cambios.filter(isObj) : [] }) }));
  return r;
}
const NOMBRES = { ejercicios: 'ejercicios', rutinas: 'rutinas', perfil: 'perfil', sesiones: 'entrenos', medidas: 'registros de medidas', analisis: 'análisis' };
function importarTexto(txt){
  let r;
  try { r = normalizar(JSON.parse(txt)); }
  catch(e) { toast(typeof e === 'string' ? e : 'El archivo no es un JSON válido.'); return; }
  const lista = Object.keys(r).map(k => k === 'perfil' ? 'perfil' : r[k].length + ' ' + NOMBRES[k]).join(', ');
  confirmar('¿Importar datos?', 'Se van a reemplazar: ' + lista + '. Lo que no venga en el archivo se mantiene. Te recomendamos exportar una copia antes.', 'Importar', () => {
    Object.keys(r).forEach(k => { S[k] = r[k]; });
    ensureBase(); ordenar(); aplicarAcento(); persist();
    toast('Datos importados.'); render();
  });
}
document.getElementById('importFile').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => importarTexto(String(rd.result || ''));
  rd.onerror = () => toast('No se pudo leer el archivo.');
  rd.readAsText(f);
});

/* ----- botón atrás de Android ----- */
function atras(){
  if (ui.picker) { ui.picker = null; renderLayer(); return; }
  if (ui.sheet) { ui.sheet = null; renderLayer(); return; }
  const v = ui.view;
  if (v === 'editor') { ui.draft = null; go('rutinas'); return; }
  const padre = { medida: 'medidas', coach: 'stats', analisis: 'coach', ajustes: 'inicio', entreno: 'inicio', rutinas: 'inicio', medidas: 'inicio', stats: 'inicio' }[v];
  if (padre) go(padre); else KN.minimize();
}

