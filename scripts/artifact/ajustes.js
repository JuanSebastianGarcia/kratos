/* ----- Ajustes ----- */
let appVersion = '';
function vAjustes(){
  if (!appVersion) KN.version().then(v => { appVersion = v; if (ui.view === 'ajustes') render(); });
  const n = (x, t) => '<div class="stat" style="background:var(--s2)"><span class="mut" style="font-size:12px">' + t + '</span><b>' + x + '</b></div>';
  const notifTxt = !KN.isNative ? 'Solo disponible en la app de Android.' : KN.notif.enabled ? 'Activados: suena y vibra al terminar el descanso, aunque la app esté en segundo plano.' : 'Desactivados. Actívalos para que el celular suene y vibre al terminar cada descanso.';
  return '<div class="row between" style="margin:-12px -8px 0"><button class="ico" data-a="go" data-v="inicio" aria-label="Volver">' + I.back + '</button><span style="font-weight:600">Ajustes</span><span style="width:44px"></span></div>' +
    '<div class="col"><span class="sec">Tus datos</span><div class="card"><span class="tx2" style="font-size:14px;line-height:1.45">Todo se guarda en este celular, sin internet. Exporta una copia de vez en cuando para no perder nada si cambias de teléfono o desinstalas la app.</span>' +
    '<div class="grid3">' + n(S.rutinas.length, 'Rutinas') + n(S.sesiones.length, 'Entrenos') + n(S.medidas.length, 'Medidas') + '</div>' +
    '<button class="btn" data-a="exportar">' + I.download + 'Exportar datos</button><button class="btn ghost" data-a="importar">' + I.upload + 'Importar datos</button>' +
    '<span class="note">El archivo es un JSON con: ejercicios, rutinas, perfil, sesiones, medidas y analisis. Al importar se reemplaza lo que venga en el archivo.</span></div></div>' +
    '<div class="col"><span class="sec">Avisos de descanso</span><div class="card"><span class="tx2" style="font-size:14px;line-height:1.45">' + notifTxt + '</span>' + (KN.isNative && !KN.notif.enabled ? '<button class="btn soft" style="color:var(--tx)" data-a="activarAvisos">Activar avisos</button>' : '') + '<span class="note">Durante un entreno la pantalla se mantiene encendida.</span></div></div>' +
    '<p class="note" style="text-align:center;margin:8px 0 0">Kratos' + (appVersion ? ' · versión ' + esc(appVersion) : '') + '</p>';
}

