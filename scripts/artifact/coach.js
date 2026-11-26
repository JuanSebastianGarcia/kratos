/* ----- Coach IA: análisis con un modelo de lenguaje (por ahora Claude de Anthropic) -----
   La conexión { proveedor, apiKey, modelo, modeloNombre, maxTokens } se guarda en su propia llave
   (IA_KEY), aparte de los datos: no entra en snapshot(), ni en Exportar, ni la toca Importar. */
const IA_KEY = 'kratos_ia_v1';
let IA = null;
const iaListo = KN.storage.get(IA_KEY).then(raw => {
  try { const o = raw ? JSON.parse(raw) : null; IA = o && o.apiKey && o.modelo && IA_PROV[o.proveedor] ? o : null; } catch(e) { IA = null; }
  if (ui.view === 'ajustes') render();
}).catch(() => {});
function iaGuardar(cfg){
  IA = cfg;
  return KN.storage.set(IA_KEY, cfg ? JSON.stringify(cfg) : '').catch(() => toast('No se pudo guardar la conexión en el celular.'));
}
// Error con un mensaje para mostrarle al usuario tal cual.
function iaFallo(msg, status){ const e = new Error(msg); e.amigable = true; e.status = status || 0; return e; }
const iaMsg = e => e && e.amigable ? e.message : 'Algo salió mal al hablar con el coach. Intenta de nuevo.';

/* Proveedores: para agregar otro basta con una entrada más con la misma forma. */
const ANTH_URL = 'https://api.anthropic.com/v1/';
async function anthFetch(key, ruta, body, ms){
  if (navigator.onLine === false) throw iaFallo('No hay conexión a internet. Conéctate y vuelve a intentar.');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  let r, j = null;
  try {
    r = await fetch(ANTH_URL + ruta, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal
    });
    try { j = await r.json(); } catch(e) { j = null; }
  } catch(e) {
    throw iaFallo(ctl.signal.aborted ? 'El servidor tardó demasiado en responder. Intenta de nuevo.' : 'No se pudo conectar con Anthropic. Revisa tu conexión a internet.');
  } finally { clearTimeout(t); }
  if (!r.ok) {
    const er = (j && j.error) || {}, m = String(er.message || '');
    let txt;
    if (r.status === 401) txt = 'La clave de API no es válida. Revísala o crea una nueva en console.anthropic.com.';
    else if (r.status === 402 || er.type === 'billing_error' || /credit balance|billing/i.test(m)) txt = 'Tu cuenta de Anthropic no tiene saldo. Recarga créditos en console.anthropic.com.';
    else if (r.status === 403) txt = 'Tu clave no tiene permiso para usar este servicio o este modelo.';
    else if (r.status === 404) txt = 'El modelo elegido no está disponible para tu cuenta. Elige otro en la conexión de IA.';
    else if (r.status === 413) txt = 'Hay demasiados datos para enviar. Elige un periodo más corto.';
    else if (r.status === 429) txt = 'Llegaste al límite de uso de tu cuenta de Anthropic. Espera un momento y vuelve a intentar.';
    else if (r.status === 529 || r.status >= 500 || er.type === 'overloaded_error') txt = 'Los servidores de Anthropic están ocupados. Intenta de nuevo en unos minutos.';
    else txt = 'Anthropic rechazó la solicitud (' + r.status + (m ? ': ' + m : '') + ').';
    throw iaFallo(txt, r.status);
  }
  return j || {};
}
const IA_PROV = {
  anthropic: {
    nombre: 'Claude (Anthropic)',
    placeholder: 'sk-ant-…',
    ayuda: 'Créala en console.anthropic.com, en API Keys. El uso se cobra a tu cuenta de Anthropic.',
    // GET /v1/models: la lista viene de la más nueva a la más antigua.
    async modelos(key){
      const j = await anthFetch(key, 'models?limit=100', null, 20000);
      const d = (Array.isArray(j.data) ? j.data : []).filter(m => m && m.id);
      if (!d.length) throw iaFallo('Tu cuenta no tiene modelos disponibles.');
      return d.map(m => ({ id: String(m.id), nombre: String(m.display_name || m.id), maxTokens: +m.max_tokens || 0 }));
    },
    // Sugerido: el Opus más reciente (el más capaz de uso general); si no hay, el modelo más nuevo.
    sugerido: ms => (ms.find(m => /opus/i.test(m.id)) || ms[0]).id,
    // POST /v1/messages (sin streaming). Devuelve el texto de la respuesta.
    async enviar(cfg, system, messages, maxTok){
      const body = { model: cfg.modelo, max_tokens: Math.min(maxTok, cfg.maxTokens || 8192), system, messages };
      const j = await anthFetch(cfg.apiKey, 'messages', body, 300000);
      if (j.stop_reason === 'refusal') throw iaFallo('El modelo no quiso responder esta solicitud. Intenta reformularla o elige otro modelo.');
      const texto = (Array.isArray(j.content) ? j.content : []).filter(b => b && b.type === 'text').map(b => b.text).join('\n').trim();
      if (!texto) throw iaFallo('El modelo no devolvió respuesta. Intenta de nuevo.');
      return { texto, cortado: j.stop_reason === 'max_tokens' };
    }
  }
};
const iaProv = () => IA_PROV[IA.proveedor];

/* ----- resumen compacto de los datos para el modelo ----- */
const iaFecha = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const iaN = v => String(Math.round((+v || 0) * 10) / 10);
const iaCel = p => iaN(p && p.kg) + '×' + iaN(p && p.reps);
function iaSerie(x){
  const ps = Array.isArray(x.pasos) ? x.pasos.filter(Boolean) : [];
  if (ps.some(p => p.I || p.D)) return ps.map(p => 'I ' + iaCel(p.I) + ' / D ' + iaCel(p.D)).join(' → ');
  if (ps.length > 1) return ps.map(iaCel).join('→');
  return iaCel(x);
}
const iaE1 = x => (+x.kg || 0) * (1 + (+x.reps || 0) / 30); // 1RM estimado (Epley)
const iaGrupo = id => (ejById(id) || {}).grupo || 'Otro';
function datosCoach(c){
  const f = c.fuentes || {}, sem = c.semanas || 8, ahora = Date.now(), desde = ahora - sem*7*864e5, L = [];
  const nom = {}; S.sesiones.forEach(s => s.ejercicios.forEach(e => { if (!nom[e.ejId]) nom[e.ejId] = ejById(e.ejId) ? ejName(e.ejId) : (e.nombre || 'Ejercicio'); }));
  const nombre = id => nom[id] || ejName(id);
  const ses = S.sesiones.filter(s => s.inicio >= desde).slice().sort((a, b) => a.inicio - b.inicio);
  L.push('Hoy: ' + iaFecha(ahora) + '. Periodo analizado: últimas ' + sem + ' semanas (desde ' + iaFecha(desde) + ').');
  L.push('Objetivos: ' + c.obj.map(n => { const o = OBJ.find(x => x[0] === n); return n + (o ? ' (' + o[1] + ')' : ''); }).join('; ') + '.');
  if (S.perfil && S.perfil.pesoMeta) L.push('Meta de peso corporal: ' + iaN(S.perfil.pesoMeta) + ' kg.');
  if (S.sesiones.length) L.push('Historial total: ' + S.sesiones.length + ' entrenos desde ' + iaFecha(Math.min(...S.sesiones.map(s => s.inicio))) + '.');

  L.push('', '## Frecuencia');
  const ws = weekStart(ahora).getTime(), porSem = [];
  for (let w = sem - 1; w >= 0; w--) { const a = ws - w*7*864e5; porSem.push(ses.filter(s => s.inicio >= a && s.inicio < a + 7*864e5).length); }
  L.push(ses.length + ' entrenos en el periodo. Por semana (de la más antigua a la actual, que puede ir a medias): ' + porSem.join(', ') + '.');
  if (ses.length) L.push('Duración promedio: ' + Math.round(ses.reduce((t, s) => t + (s.fin - s.inicio), 0) / ses.length / 60000) + ' min.');
  const gr = {}; ses.forEach(s => s.ejercicios.forEach(e => { const g = iaGrupo(e.ejId); gr[g] = (gr[g] || 0) + e.series.length; }));
  if (Object.keys(gr).length) L.push('Series por grupo muscular (promedio semanal): ' + Object.entries(gr).sort((a, b) => b[1] - a[1]).map(([g, n]) => g + ' ' + iaN(n / sem)).join(', ') + '.');

  if (f.rutinas && S.rutinas.length) {
    L.push('', '## Rutinas');
    S.rutinas.forEach(r => {
      const bloques = [];
      (r.items || []).forEach((it, i) => {
        const prev = r.items[i - 1], txt = nombre(it.ejId) + ' [' + iaGrupo(it.ejId) + ']' + (it.unilateral ? ' (unilateral)' : '');
        if (it.grupo && prev && prev.grupo === it.grupo) bloques[bloques.length - 1].push(txt); else bloques.push([txt]);
        bloques[bloques.length - 1].desc = it.descanso;
      });
      L.push('- ' + r.nombre + ' (días: ' + diasTxt(r.dias) + '): ' + bloques.map(b => b.join(' + ') + (b.length > 1 ? ' (biserie)' : '') + ', descanso ' + (b.desc ? mmss(b.desc) : 'libre')).join('; '));
    });
  }

  const porEj = {};
  ses.forEach(s => s.ejercicios.forEach(e => {
    if (!e.series.length) return;
    const best = e.series.reduce((b, x) => (x.kg > b.kg || (x.kg === b.kg && x.reps > b.reps)) ? x : b, e.series[0]);
    const ds = e.series.map(x => x.descanso).filter(d => d != null && d > 0);
    (porEj[e.ejId] = porEj[e.ejId] || []).push({ t: s.inicio, best, n: e.series.length, e1: Math.max(...e.series.map(iaE1)), desc: ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null });
  }));
  if (f.pesos && Object.keys(porEj).length) {
    L.push('', '## Progreso por ejercicio (mejor serie de cada sesión, en orden)');
    Object.entries(porEj).sort((a, b) => b[1].length - a[1].length).forEach(([id, h]) => {
      const ult = h.slice(-8), e1a = h[0].e1, e1b = h[h.length - 1].e1;
      L.push('- ' + nombre(id) + ' [' + iaGrupo(id) + ']: ' + h.length + ' sesiones, ~' + iaN(h.reduce((t, x) => t + x.n, 0) / h.length) + ' series/sesión. ' + ult.map(x => iaCel(x.best) + ' (' + iaFecha(x.t).slice(5) + ')').join(', ') +
        (e1a > 0 && h.length > 1 ? '. 1RM est.: ' + iaN(e1a) + ' → ' + iaN(e1b) + ' kg' : '') + '.');
    });
  }
  if (f.descansos) {
    const all = []; Object.values(porEj).forEach(h => h.forEach(x => { if (x.desc) all.push(x.desc); }));
    if (all.length) {
      L.push('', '## Descansos reales entre series');
      L.push('Promedio general: ' + mmss(all.reduce((a, b) => a + b, 0) / all.length) + '. Por ejercicio: ' + Object.entries(porEj).map(([id, h]) => { const d = h.map(x => x.desc).filter(Boolean); return d.length ? nombre(id) + ' ' + mmss(d.reduce((a, b) => a + b, 0) / d.length) : ''; }).filter(Boolean).join(', ') + '.');
    }
  }

  if (ses.length) {
    L.push('', '## Entrenos del periodo' + (ses.length > 25 ? ' (últimos 25)' : ''));
    ses.slice(-25).forEach(s => {
      L.push('- ' + iaFecha(s.inicio) + ' ' + (s.nombre || 'Entreno') + ', ' + Math.round((s.fin - s.inicio) / 60000) + ' min: ' + s.ejercicios.map(e =>
        nombre(e.ejId) + (e.grupo ? ' (biserie)' : '') + ': ' + (f.pesos ? e.series.map(iaSerie).join(', ') : e.series.length + ' series')).join('; '));
    });
  }

  if (f.medidas && S.medidas.length) {
    const d0 = iaFecha(desde), med = S.medidas.filter(m => m.fecha >= d0), antes = S.medidas.find(m => m.fecha < d0);
    const lista = (antes ? [antes] : []).concat(med.slice().reverse()).slice(-20);
    if (lista.length) {
      L.push('', '## Medidas corporales (cm, salvo peso en kg y grasa en %)');
      lista.forEach(m => {
        const p = [];
        if (m.peso) p.push('peso ' + iaN(m.peso) + ' kg');
        if (m.grasa) p.push('grasa ' + iaN(m.grasa) + '%');
        PARTES.forEach(([k, n]) => { if (m.partes && m.partes[k]) p.push(n.toLowerCase() + ' ' + iaN(m.partes[k])); });
        L.push('- ' + m.fecha + (m.fecha < d0 ? ' (antes del periodo)' : '') + ': ' + (p.join(', ') || 'sin datos'));
      });
    }
  }
  return L.join('\n');
}

const SISTEMA_COACH = 'Eres el Coach IA de Kratos, una app para registrar entrenamientos con pesas. Eres un entrenador experto en fuerza e hipertrofia y te basas en la evidencia actual: sobrecarga progresiva, volumen semanal por grupo muscular, frecuencia, cercanía al fallo, descansos, recuperación y recomposición corporal.\n' +
  'Hablas en español neutro, de tú, claro y directo; motivador pero honesto. Usa solo los datos que te dan: no inventes ejercicios, pesos, fechas ni medidas. Si faltan datos para concluir algo, dilo y sugiere qué registrar.\n' +
  'Formato de los datos: los pesos están en kg y "60×8" es 60 kg por 8 repeticiones. "I" y "D" son los lados izquierdo y derecho de un ejercicio unilateral; "→" separa los pesos de una serie en pirámide. Un peso de 0 suele ser peso corporal.\n' +
  'No das consejos médicos: ante dolor o lesiones recomiendas consultar a un profesional.';
const PIDE_ANALISIS = 'Analiza mi entrenamiento según mis objetivos. Revisa: 1) progreso (sobrecarga progresiva por ejercicio, 1RM estimado), 2) estancamientos o retrocesos (ejercicios sin mejora en 3 o más sesiones), 3) equilibrio entre grupos musculares (series semanales por grupo, empuje y tracción, tren superior e inferior), 4) frecuencia y constancia, 5) descansos entre series y 6) medidas corporales, si hay. Cierra con recomendaciones concretas y aplicables (ejercicio, series, repeticiones, peso o descanso).\n\n' +
  'Responde únicamente con un objeto JSON válido, sin texto antes ni después y sin bloque de código, con esta forma:\n' +
  '{"puntaje": número entero de 0 a 100 que califica qué tan bien va el entrenamiento para mis objetivos,\n' +
  ' "veredicto": "frase corta, máximo 6 palabras",\n' +
  ' "resumen": "2 o 3 frases con lo más importante",\n' +
  ' "areas": [{"area": "Progreso" | "Estancamientos" | "Equilibrio muscular" | "Frecuencia" | "Descansos" | "Medidas", "estado": "Bien" | "Ajustar" | "Cambiar", "detalle": "1 o 2 frases con datos concretos"}],\n' +
  ' "cambios": [{"donde": "rutina o ejercicio", "titulo": "acción concreta", "antes": "cómo está hoy, corto", "despues": "cómo debería quedar, corto", "motivo": "por qué, en 1 frase"}],\n' +
  ' "informe": "informe completo en Markdown: títulos con ###, listas con -, negritas con **; sin tablas ni enlaces"}\n' +
  'Incluye de 3 a 6 áreas y de 2 a 5 cambios, ordenados por impacto.\n\nMis datos:\n';

// Lee la respuesta del análisis: JSON con la forma que usa la pantalla. Si no viene en JSON, se muestra como informe.
function leerAnalisis(txt, cortado){
  let o = null;
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
  if (a !== -1 && b > a) {
    const j = txt.slice(a, b + 1);
    try { o = JSON.parse(j); } catch(e) {
      // a veces el modelo deja saltos de línea sin escapar dentro de los textos: se escapan y se reintenta
      let r = '', dentro = false;
      for (let i = 0; i < j.length; i++) {
        const ch = j[i];
        if (dentro && ch === '\\') { r += ch + (j[i + 1] || ''); i++; continue; }
        if (ch === '"') dentro = !dentro;
        r += dentro && ch === '\n' ? '\\n' : dentro && ch === '\t' ? '\\t' : dentro && ch === '\r' ? '' : ch;
      }
      try { o = JSON.parse(r); } catch(e2) { o = null; }
    }
  }
  if (!isObj(o)) {
    if (cortado) throw iaFallo('La respuesta salió incompleta. Intenta con un periodo más corto o con otro modelo.');
    return { puntaje: null, veredicto: 'Análisis del coach', resumen: '', areas: [], cambios: [], informe: txt };
  }
  const s = v => v == null ? '' : String(v);
  const p = Math.round(+o.puntaje);
  return {
    puntaje: isNaN(p) ? null : Math.max(0, Math.min(100, p)),
    veredicto: s(o.veredicto) || 'Análisis del coach',
    resumen: s(o.resumen),
    areas: (Array.isArray(o.areas) ? o.areas : []).filter(isObj).map(x => ({ area: s(x.area), estado: ['Bien','Ajustar','Cambiar'].includes(x.estado) ? x.estado : 'Ajustar', detalle: s(x.detalle) })),
    cambios: (Array.isArray(o.cambios) ? o.cambios : []).filter(isObj).map(x => ({ donde: s(x.donde), titulo: s(x.titulo), antes: s(x.antes), despues: s(x.despues), motivo: s(x.motivo) })),
    informe: s(o.informe)
  };
}

async function analizar(){
  const c = ui.coach;
  if (!c.obj.length) { c.run = { error: 'Elige al menos un objetivo.' }; render(); return; }
  if (c.run && c.run.loading) return;
  await iaListo;
  if (!IA) { abrirIA('analizar'); return; }
  const desde = Date.now() - c.semanas*7*864e5;
  if (!sesionesEn(desde).length && !(c.fuentes.medidas && S.medidas.length)) { c.run = { error: 'No hay entrenos en este periodo para analizar. Elige un periodo más largo o registra algunos entrenos.' }; render(); return; }
  c.run = { loading: true }; render();
  try {
    const cfg = IA, r = await iaProv().enviar(cfg, SISTEMA_COACH, [{ role: 'user', content: PIDE_ANALISIS + datosCoach(c) }], 16000);
    const an = { id: uid(), fecha: Date.now(), objetivos: c.obj.slice(), semanas: c.semanas, fuentes: Object.assign({}, c.fuentes), modelo: cfg.modeloNombre || cfg.modelo, chat: [], res: leerAnalisis(r.texto, r.cortado) };
    S.analisis.unshift(an); persist();
    c.run = null;
    if (ui.view === 'coach') { ui.analisisId = an.id; go('analisis'); } else toast('Tu análisis está listo en Coach IA.');
  } catch(e) {
    c.run = { error: iaMsg(e) + (e.status === 401 || e.status === 404 ? ' Toca el engranaje de arriba para cambiar la conexión.' : '') };
    if (ui.view === 'coach') render();
  }
}

/* Markdown sencillo y seguro: primero se escapa todo; solo títulos, negritas, cursivas, código, listas y párrafos. */
function md(src){
  const inl = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/__(.+?)__/g, '<strong>$1</strong>').replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  const out = []; let para = [], list = null;
  const finP = () => { if (para.length) { out.push('<p>' + para.map(inl).join('<br>') + '</p>'); para = []; } };
  const finL = () => { if (list) { out.push('<' + list.t + '>' + list.items.map(x => '<li>' + inl(x) + '</li>').join('') + '</' + list.t + '>'); list = null; } };
  String(src || '').replace(/\r\n?/g, '\n').split('\n').forEach(raw => {
    const l = raw.trim(); let m;
    if (!l || /^```/.test(l)) { finP(); finL(); return; }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { finP(); finL(); const h = m[1].length <= 3 ? 'h3' : 'h4'; out.push('<' + h + '>' + inl(m[2].replace(/#+$/, '').trim()) + '</' + h + '>'); return; }
    if (/^([-*_])(\s*\1){2,}$/.test(l)) { finP(); finL(); out.push('<hr>'); return; }
    if (/^\|?[\s:|-]+\|?$/.test(l) && l.includes('-') && l.includes('|')) return; // separador de tabla
    const ul = /^[-*+•]\s+(.*)$/.exec(l), ol = /^\d+[.)]\s+(.*)$/.exec(l);
    if (ul || ol) {
      const t = ul ? 'ul' : 'ol'; finP();
      if (list && list.t !== t && !/^\s{2,}/.test(raw)) finL();
      if (!list) list = { t, items: [] };
      list.items.push((ul || ol)[1]); return;
    }
    if (list && /^\s{2,}/.test(raw)) { list.items[list.items.length - 1] += ' ' + l; return; }
    finL();
    para.push(l.replace(/^>\s?/, '').replace(/^\|(.*)\|$/, '$1').replace(/\s*\|\s*/g, ' · '));
  });
  finP(); finL();
  return out.join('');
}

function vAnalisis(){
  const an = S.analisis.find(x => x.id === ui.analisisId);
  if (!an) { ui.view = 'coach'; return vCoach(); }
  const r = an.res; an.chat = an.chat || [];
  const chat = an.chat.map(m => m.role === 'user' ? '<div class="bubble u">' + esc(m.content) + '</div>' : '<div class="bubble a md">' + md(m.content) + '</div>').join('');
  return '<div class="row between" style="margin:-12px -8px 0"><button class="ico" data-a="go" data-v="coach" aria-label="Volver">' + I.back + '</button><span style="font-weight:600">Análisis del coach</span><span style="width:44px"></span></div>' +
    '<div class="row" style="gap:8px;flex-wrap:wrap"><span class="tag">' + esc(an.objetivos.join(' + ')) + '</span><span class="tag">' + an.semanas + ' semanas</span><span class="tag">' + dstr(an.fecha) + '</span></div>' +
    '<div class="card hi"><div class="row" style="gap:14px"><div style="width:64px;height:64px;border-radius:32px;border:5px solid var(--acc);display:flex;align-items:center;justify-content:center;flex-shrink:0"><span class="disp" style="font-size:20px">' + fmt(r.puntaje) + '</span></div><div class="col" style="gap:4px"><span class="sec acc">Veredicto</span><span class="disp" style="font-size:21px;line-height:1.15">' + esc(r.veredicto) + '</span></div></div>' + (r.resumen ? '<p class="tx2" style="margin:0;font-size:14px;line-height:1.5">' + esc(r.resumen) + '</p>' : '') + '</div>' +
    (r.areas.length ? '<div class="col"><span class="sec">Por área</span>' + r.areas.map(a => '<div class="card" style="gap:6px;padding:14px 16px"><div class="row between"><span style="font-weight:700">' + esc(a.area) + '</span><span class="chip ' + esc(a.estado) + '">' + esc(a.estado) + '</span></div><span class="tx2" style="font-size:13px;line-height:1.45">' + esc(a.detalle) + '</span></div>').join('') + '</div>' : '') +
    (r.cambios.length ? '<div class="col"><span class="sec">Qué cambiar</span>' + r.cambios.map((x, i) => '<div class="card" style="flex-direction:row;gap:12px;padding:14px 16px"><span class="num" style="background:var(--acc);color:var(--acc-tx)">' + (i+1) + '</span><div class="col" style="gap:6px;min-width:0"><span class="mut" style="font-size:12px">' + esc(x.donde || '') + '</span><span style="font-weight:700;line-height:1.3">' + esc(x.titulo) + '</span>' + (x.antes || x.despues ? '<span class="row" style="gap:8px;font-size:13px;flex-wrap:wrap"><span class="mut" style="text-decoration:line-through">' + esc(x.antes || '') + '</span><span class="mut">→</span><span class="acc" style="font-weight:600">' + esc(x.despues || '') + '</span></span>' : '') + '<span class="tx2" style="font-size:13px;line-height:1.45">' + esc(x.motivo || '') + '</span></div></div>').join('') + '</div>' : '') +
    (r.informe ? '<div class="col"><span class="sec">Informe completo</span><div class="card md">' + md(r.informe) + '</div></div>' : '') +
    '<button class="btn ghost" data-a="go" data-v="rutinas">Ir a mis rutinas para aplicar cambios</button>' +
    '<div class="col"><span class="sec">Pregúntale al coach</span>' + chat + (ui.chatBusy ? '<div class="bubble a mut" id="chatLive">Pensando…</div>' : '') +
    (ui.chatErr ? '<p class="note" style="margin:0;color:var(--bad)" role="alert">' + esc(ui.chatErr) + '</p>' : '') +
    '<div class="row field" style="padding:0 6px 0 14px;height:52px"><input id="chatIn" placeholder="Ej: ¿cómo organizo la semana?" aria-label="Pregunta para el coach" value="' + esc(ui.chatDraft || '') + '" style="flex:1;background:transparent;border:0;outline:none;color:var(--tx)"' + (ui.chatBusy ? ' disabled' : '') + '><button class="ico box" style="width:40px;height:40px;border-radius:10px;border:0;background:var(--s2);color:var(--acc)" data-a="enviarChat" aria-label="Enviar pregunta"' + (ui.chatBusy ? ' disabled' : '') + '>' + I.send + '</button></div>' +
    (an.modelo ? '<span class="note">Hecho con ' + esc(an.modelo) + '. El coach puede equivocarse: revisa los cambios antes de aplicarlos.</span>' : '') + '</div>';
}

// Preguntas de seguimiento: misma conexión, con los datos y el análisis como contexto.
async function enviarChat(){
  const inp = document.getElementById('chatIn'), q = ((inp && inp.value) || '').trim();
  const an = S.analisis.find(x => x.id === ui.analisisId);
  if (!q || !an || ui.chatBusy) return;
  await iaListo;
  if (!IA) { ui.chatDraft = q; abrirIA(); return; }
  an.chat = an.chat || [];
  an.chat.push({ role: 'user', content: q });
  ui.chatBusy = true; ui.chatErr = ''; ui.chatDraft = ''; persist(); render();
  const r = an.res, ctx = 'Datos del usuario:\n' + datosCoach({ obj: an.objetivos, semanas: an.semanas || 8, fuentes: an.fuentes || ui.coach.fuentes }) +
    '\n\nTu análisis anterior (' + iaFecha(an.fecha) + '):\nPuntaje: ' + (r.puntaje == null ? '—' : r.puntaje) + '. ' + r.veredicto + '. ' + r.resumen + '\n' +
    r.areas.map(a => '- ' + a.area + ' (' + a.estado + '): ' + a.detalle).join('\n') + '\n' + r.cambios.map(x => '- Cambio: ' + x.titulo + ' (' + x.donde + '): ' + x.antes + ' → ' + x.despues).join('\n') +
    (r.informe ? '\n\n' + r.informe : '');
  const sys = SISTEMA_COACH + '\n\nAhora respondes preguntas de seguimiento sobre el análisis. Sé breve (máximo unas 200 palabras), concreto y usa Markdown sencillo (negritas y listas, sin tablas).\n\n' + ctx;
  let msgs = an.chat.slice(-12).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  try {
    const res = await iaProv().enviar(IA, sys, msgs, 4000);
    an.chat.push({ role: 'assistant', content: res.texto });
  } catch(e) {
    an.chat.pop(); ui.chatDraft = q; ui.chatErr = iaMsg(e);
  }
  ui.chatBusy = false; persist();
  if (ui.view === 'analisis') render();
}

/* ----- hoja "Conexión de IA": proveedor, clave y modelo ----- */
function abrirIA(luego){
  const s = { tipo: 'ia', luego: luego || null, proveedor: IA ? IA.proveedor : 'anthropic', key: '', modelos: null, modelo: IA ? IA.modelo : '', error: '', cargando: false, paso: IA ? 'modelo' : 'clave' };
  ui.sheet = s;
  if (IA) { s.key = IA.apiKey; iaCargarModelos(s); } else renderLayer();
}
async function iaCargarModelos(s){
  s.cargando = true; s.error = ''; renderLayer();
  try {
    const ms = await IA_PROV[s.proveedor].modelos(s.key.trim());
    if (ui.sheet !== s) return;
    s.key = s.key.trim(); s.modelos = ms; s.paso = 'modelo';
    if (!ms.some(m => m.id === s.modelo)) s.modelo = IA_PROV[s.proveedor].sugerido(ms);
  } catch(e) {
    if (ui.sheet !== s) return;
    s.error = iaMsg(e);
    // con la conexión guardada, se deja elegir el modelo actual aunque no se pudo actualizar la lista
    if (s.paso === 'modelo' && !s.modelos && IA) s.modelos = [{ id: IA.modelo, nombre: IA.modeloNombre || IA.modelo, maxTokens: IA.maxTokens || 0 }];
  }
  s.cargando = false; renderLayer();
}
function vSheetIA(s){
  const p = IA_PROV[s.proveedor], err = s.error ? '<p class="note" style="margin:0;color:var(--bad)" role="alert">' + esc(s.error) + '</p>' : '';
  let h = '<div class="row between"><span class="disp" style="font-size:22px">Conexión de IA</span><button class="ico" data-a="cerrarSheet" aria-label="Cerrar">' + I.x + '</button></div>';
  if (s.paso === 'clave') {
    return h + '<span class="tx2" style="font-size:14px;line-height:1.45">El Coach usa tu propia cuenta del proveedor de IA. La clave se guarda solo en este celular y no se incluye al exportar tus datos.</span>' +
      '<label class="col" style="gap:6px"><span class="sec">Proveedor</span><select class="field" data-ia-in="proveedor">' + Object.entries(IA_PROV).map(([k, v]) => '<option value="' + k + '"' + (k === s.proveedor ? ' selected' : '') + '>' + esc(v.nombre) + '</option>').join('') + '</select></label>' +
      '<label class="col" style="gap:6px"><span class="sec">Clave de API</span><input class="field" type="password" id="iaKey" data-ia-in="key" value="' + esc(s.key) + '" placeholder="' + esc(p.placeholder) + '" autocomplete="off" autocapitalize="off" spellcheck="false"></label>' +
      '<span class="note">' + esc(p.ayuda) + '</span>' + err +
      '<button class="btn" data-ia="verificar"' + (s.cargando ? ' disabled' : '') + '>' + (s.cargando ? 'Verificando…' : 'Verificar clave') + '</button>';
  }
  const ms = s.modelos || [];
  return h + '<div class="card" style="background:var(--s2);gap:4px;padding:12px 14px"><span class="sec">Proveedor</span><span style="font-weight:600">' + esc(p.nombre) + '</span><span class="mut" style="font-size:12px">Clave terminada en …' + esc(s.key.slice(-4)) + '</span></div>' +
    '<label class="col" style="gap:6px"><span class="sec">Modelo</span>' + (s.cargando && !ms.length ? '<span class="field row mut" style="font-size:14px">Cargando modelos…</span>' :
      '<select class="field" data-ia-in="modelo">' + ms.map(m => '<option value="' + esc(m.id) + '"' + (m.id === s.modelo ? ' selected' : '') + '>' + esc(m.nombre) + '</option>').join('') + '</select>') + '</label>' +
    '<span class="note">Te sugerimos el más reciente y capaz. Los modelos más grandes analizan mejor, pero cuestan más por uso.</span>' + err +
    '<button class="btn" data-ia="guardar"' + (s.cargando || !ms.length ? ' disabled' : '') + '>' + (s.luego === 'analizar' ? I.spark + 'Guardar y analizar' : 'Guardar') + '</button>' +
    '<button class="btn soft" style="color:var(--tx)" data-ia="otraClave">Cambiar clave</button>' +
    (IA ? '<button class="btn soft" style="color:var(--bad)" data-ia="borrar">Borrar conexión</button>' : '');
}
function vIAAjustes(){
  const p = IA && IA_PROV[IA.proveedor];
  return '<div class="col"><span class="sec">Coach IA</span><div class="card"><span class="tx2" style="font-size:14px;line-height:1.45">' +
    (IA ? 'Conectado a ' + esc(p.nombre) + ' con el modelo ' + esc(IA.modeloNombre || IA.modelo) + '.' : 'Sin conectar. Para analizar tus entrenos con el Coach IA necesitas una clave de API de tu proveedor de IA.') + '</span>' +
    '<button class="btn soft" style="color:var(--tx)" data-ia="abrir">' + (IA ? 'Cambiar modelo o clave' : 'Conectar') + '</button>' +
    '<span class="note">La clave se guarda solo en este celular y no se incluye al exportar tus datos.</span></div></div>';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ia]'); if (!b || b.disabled) return;
  e.preventDefault();
  const k = b.dataset.ia, s = ui.sheet;
  if (k === 'abrir') { iaListo.then(() => abrirIA()); return; }
  if (!s || s.tipo !== 'ia') return;
  if (k === 'verificar') {
    if (!s.key.trim()) { s.error = 'Pega tu clave de API.'; renderLayer(); return; }
    iaCargarModelos(s);
  } else if (k === 'otraClave') { s.paso = 'clave'; s.key = ''; s.modelos = null; s.error = ''; renderLayer(); }
  else if (k === 'guardar') {
    const m = (s.modelos || []).find(x => x.id === s.modelo); if (!m) { s.error = 'Elige un modelo.'; renderLayer(); return; }
    iaGuardar({ proveedor: s.proveedor, apiKey: s.key, modelo: m.id, modeloNombre: m.nombre, maxTokens: m.maxTokens || 0 });
    ui.sheet = null; toast('Conexión guardada.'); render();
    if (s.luego === 'analizar') analizar();
  } else if (k === 'borrar') {
    confirmar('¿Borrar conexión de IA?', 'Se borra la clave de este celular. Tus análisis anteriores se mantienen.', 'Borrar', () => { iaGuardar(null); toast('Conexión borrada.'); render(); });
  }
});
['input', 'change'].forEach(ev => document.addEventListener(ev, e => {
  const k = e.target.dataset && e.target.dataset.iaIn, s = ui.sheet;
  if (!k || !s || s.tipo !== 'ia') return;
  s[k] = e.target.value;
  if (k === 'proveedor') { s.modelos = null; s.modelo = ''; s.error = ''; }
}));

