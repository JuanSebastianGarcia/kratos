// Puente entre la app (src/index.html) y las funciones nativas de Android vía Capacitor.
// Se empaqueta con esbuild en www/native.js y expone window.KN.
// En un navegador normal todo tiene un respaldo web para poder probar la app.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { LocalNotifications } from '@capacitor/local-notifications';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Haptics } from '@capacitor/haptics';
import { App } from '@capacitor/app';

import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';

const isNative = Capacitor.isNativePlatform();
const CHANNEL = 'descanso';

/* ---------- almacenamiento (SharedPreferences en Android) ---------- */
const storage = {
  async get(key) {
    const r = await Preferences.get({ key });
    return r.value;
  },
  async set(key, value) {
    await Preferences.set({ key, value });
  },
};

/* ---------- pantalla encendida ---------- */
let awake = null;
async function keepAwake(on) {
  on = !!on;
  if (awake === on) return;
  awake = on;
  try {
    if (on) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
  } catch (e) { awake = null; }
}

/* ---------- notificaciones locales ---------- */
const notif = {
  enabled: false,
  ready: null,
  // Pide permiso (solo la primera vez muestra el diálogo) y crea el canal con sonido y vibración.
  init(ask) {
    if (!isNative) return Promise.resolve(false);
    if (this.ready && (this.enabled || !ask)) return this.ready;
    this.ready = (async () => {
      try {
        let p = await LocalNotifications.checkPermissions();
        if (p.display !== 'granted' && ask) p = await LocalNotifications.requestPermissions();
        this.enabled = p.display === 'granted';
        if (this.enabled) {
          await LocalNotifications.createChannel({
            id: CHANNEL,
            name: 'Fin del descanso',
            description: 'Suena y vibra cuando termina el descanso entre series',
            importance: 5,
            visibility: 1,
            vibration: true,
            lights: true,
            lightColor: '#C6F432',
          });
        }
      } catch (e) { this.enabled = false; }
      return this.enabled;
    })();
    return this.ready;
  },
  async schedule(id, at, title, body) {
    if (!isNative) return;
    await this.init(false);
    if (!this.enabled) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
      if (at <= Date.now() + 500) return;
      await LocalNotifications.schedule({
        notifications: [{
          id, title, body,
          channelId: CHANNEL,
          smallIcon: 'ic_stat_kratos',
          iconColor: '#C6F432',
          schedule: { at: new Date(at), allowWhileIdle: true },
        }],
      });
    } catch (e) {}
  },
  async cancel(id) {
    if (!isNative) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
      await LocalNotifications.removeDeliveredNotifications({ notifications: [{ id, title: '', body: '' }] });
    } catch (e) {}
  },
};

/* ---------- vibración ---------- */
async function vibrate() {
  try {
    if (isNative) await Haptics.vibrate({ duration: 400 });
    else if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch (e) {}
}

/* ---------- exportar archivo ---------- */
// En Android: guarda en Documentos (si se puede) y abre el menú "Compartir" para mandarlo a Drive, WhatsApp, etc.
async function exportFile(filename, text) {
  if (!isNative) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { saved: 'Descargas' };
  }
  let saved = null;
  try {
    await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
    saved = 'Documentos';
  } catch (e) {}
  const tmp = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title: 'Datos de Kratos', dialogTitle: 'Guardar o enviar copia', files: [tmp.uri] });
  } catch (e) {
    // El usuario cerró el menú de compartir: no es un error.
  }
  return { saved };
}

/* ---------- ciclo de vida y botón atrás ---------- */
function onPause(fn) { if (isNative) App.addListener('pause', fn); else document.addEventListener('visibilitychange', () => { if (document.hidden) fn(); }); }
function onResume(fn) { if (isNative) App.addListener('resume', fn); else document.addEventListener('visibilitychange', () => { if (!document.hidden) fn(); }); }
function onBack(fn) { if (isNative) App.addListener('backButton', fn); }
function minimize() { if (isNative) App.minimizeApp().catch(() => {}); }
async function version() { try { if (isNative) { const i = await App.getInfo(); return i.version + ' (' + i.build + ')'; } } catch (e) {} return 'web'; }

window.KN = { isNative, storage, keepAwake, notif, vibrate, exportFile, onPause, onResume, onBack, minimize, version };
