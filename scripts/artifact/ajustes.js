/* ----- Ajustes ----- */
let appVersion = '';
function vAjustes(){
  if (!appVersion) KN.version().then(v => { appVersion = v; if (ui.view === 'ajustes') render(); });
  setTimeout(refrescarColor, 0);
  const n = (x, t) => '<div class="stat" style="background:var(--s2)"><span class="mut" style="font-size:12px">' + t + '</span><b>' + x + '</b></div>';
  const notifTxt = !KN.isNative ? 'Solo disponible en la app de Android.' : KN.notif.enabled ? 'Activados: suena y vibra al terminar el descanso, aunque la app esté en segundo plano.' : 'Desactivados. Actívalos para que el celular suene y vibre al terminar cada descanso.';
  return '<div class="row between" style="margin:-12px -8px 0"><button class="ico" data-a="go" data-v="inicio" aria-label="Volver">' + I.back + '</button><span style="font-weight:600">Ajustes</span><span style="width:44px"></span></div>' +
    '<div class="col"><span class="sec">Tus datos</span><div class="card"><span class="tx2" style="font-size:14px;line-height:1.45">Todo se guarda en este celular, sin internet. Exporta una copia de vez en cuando para no perder nada si cambias de teléfono o desinstalas la app.</span>' +
    '<div class="grid3">' + n(S.rutinas.length, 'Rutinas') + n(S.sesiones.length, 'Entrenos') + n(S.medidas.length, 'Medidas') + '</div>' +
    '<button class="btn" data-a="exportar">' + I.download + 'Exportar datos</button><button class="btn ghost" data-a="importar">' + I.upload + 'Importar datos</button>' +
    '<span class="note">El archivo es un JSON con: ejercicios, rutinas, perfil, sesiones, medidas y analisis. Al importar se reemplaza lo que venga en el archivo.</span></div></div>' +
    vColor() +
    '<div class="col"><span class="sec">Avisos de descanso</span><div class="card"><span class="tx2" style="font-size:14px;line-height:1.45">' + notifTxt + '</span>' + (KN.isNative && !KN.notif.enabled ? '<button class="btn soft" style="color:var(--tx)" data-a="activarAvisos">Activar avisos</button>' : '') + '<span class="note">Durante un entreno la pantalla se mantiene encendida.</span></div></div>' +
    '<p class="note" style="text-align:center;margin:8px 0 0">Kratos' + (appVersion ? ' · versión ' + esc(appVersion) : '') + '</p>';
}

/* ----- Color de la app: el usuario elige el acento (negros y grises no cambian) ----- */
const PRESETS = [['Naranja','#FF6A1A'],['Lima','#C6F432'],['Verde','#34D399'],['Turquesa','#2DD4BF'],['Cian','#22D3EE'],['Azul','#3B82F6'],['Índigo','#6366F1'],['Morado','#A855F7'],['Rosa','#EC4899'],['Rojo','#EF4444'],['Ámbar','#F59E0B'],['Amarillo','#FACC15']];
function vColor(){
  const h = acento(), [H, Sa, L] = hexHsl(h);
  const pres = PRESETS.some(p => p[1] === ACC_DEF.toUpperCase()) ? PRESETS : [['Original', ACC_DEF]].concat(PRESETS.slice(0, 11));
  const slider = (id, label, min, max, v) => '<label class="col" style="gap:6px"><span class="row between"><span class="lbl" style="font-size:12px">' + label + '</span><span class="mut" style="font-size:12px" id="' + id + 'V"></span></span><input type="range" class="rng" id="' + id + '" data-acc-in="hsl" min="' + min + '" max="' + max + '" value="' + v + '" aria-label="' + label + '"></label>';
  return '<div class="col"><span class="sec">Color de la app</span><div class="card">' +
    '<div class="row" style="gap:12px"><span style="width:48px;height:48px;border-radius:14px;background:var(--acc);flex-shrink:0"></span><div class="col" style="gap:2px;flex:1"><span class="disp" style="font-size:18px" id="accTxt">' + h + '</span><span class="mut" style="font-size:12px">Botones, resaltados, gráficas y avisos</span></div></div>' +
    '<div class="accs">' + pres.map(([n, c]) => '<button data-acc="' + c + '" aria-label="' + n + '" title="' + n + '" style="background:' + c + '"></button>').join('') + '</div>' +
    '<span class="sec" style="margin-top:4px">O elige cualquier color</span>' +
    slider('accH', 'Tono', 0, 360, H) + slider('accS', 'Intensidad', 0, 100, Sa) + slider('accL', 'Brillo', 5, 95, Math.min(95, Math.max(5, L))) +
    '<label class="row field" style="gap:10px"><span class="mut" style="font-size:14px">Código</span><input id="accHex" data-acc-in="hex" value="' + h + '" maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Código del color" style="flex:1;min-width:0;background:transparent;border:0;outline:none;text-align:right;font-weight:700;color:var(--tx);font-family:inherit"></label>' +
    '<span class="note" id="accWarn" style="color:var(--warn)" role="status"></span>' +
    '<button class="btn soft" style="color:var(--tx)" data-acc="reset">Restablecer color original</button></div></div>';
}
// Actualiza el selector sin volver a dibujar la pantalla (para que el deslizador no se corte al arrastrar).
function refrescarColor(origen){
  const g = id => document.getElementById(id);
  if (!g('accH')) return;
  const h = acento();
  if (origen !== 'hsl') { const [H, Sa, L] = hexHsl(h); g('accH').value = H; g('accS').value = Sa; g('accL').value = L; }
  const hv = +g('accH').value, sv = +g('accS').value, lv = +g('accL').value;
  g('accHV').textContent = hv + '°'; g('accSV').textContent = sv + '%'; g('accLV').textContent = lv + '%';
  g('accH').style.background = 'linear-gradient(to right,' + [0, 60, 120, 180, 240, 300, 360].map(x => 'hsl(' + x + ',90%,55%)').join(',') + ')';
  g('accS').style.background = 'linear-gradient(to right,hsl(' + hv + ',0%,' + lv + '%),hsl(' + hv + ',100%,' + lv + '%))';
  g('accL').style.background = 'linear-gradient(to right,hsl(' + hv + ',' + sv + '%,5%),hsl(' + hv + ',' + sv + '%,50%),hsl(' + hv + ',' + sv + '%,95%))';
  g('accTxt').textContent = h;
  if (origen !== 'hex') g('accHex').value = h;
  document.querySelectorAll('[data-acc]').forEach(b => b.classList.toggle('on', b.dataset.acc.toUpperCase() === h));
  g('accWarn').textContent = contraste(h, '#0E0F11') < 3 ? 'Este color se ve poco sobre el fondo oscuro. Prueba uno más brillante.' : '';
}
function ponerAcento(h, origen){
  h = h.toUpperCase();
  S.perfil.acento = h === ACC_DEF.toUpperCase() ? null : h;
  aplicarAcento(); persist(true); refrescarColor(origen);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-acc]'); if (!b) return;
  ponerAcento(b.dataset.acc === 'reset' ? ACC_DEF : b.dataset.acc, 'btn');
});
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.accIn; if (!k) return;
  const g = id => +document.getElementById(id).value;
  if (k === 'hsl') ponerAcento(hslHex(g('accH'), g('accS'), g('accL')), 'hsl');
  else { let v = e.target.value.trim(); if (v[0] !== '#') v = '#' + v; if (hexOk(v)) ponerAcento(v, 'hex'); }
});

