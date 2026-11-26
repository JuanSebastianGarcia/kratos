# Kratos

App de entrenamiento para Android (Capacitor). Tema oscuro, acento naranja `#FF6A1A`. Incluye biseries (dos ejercicios seguidos sin descanso).
El color de acento se puede cambiar en Ajustes → Color de la app (se guarda en `perfil.acento`).

- **Rutinas:** solo definen ejercicios, orden, biseries, si el ejercicio es unilateral y el descanso
  (con tiempo y alarma, o libre). Las series, pesos y repeticiones se anotan al entrenar.
- **Antes de empezar** se confirma el orden de los ejercicios (se puede cambiar solo para ese día).
- **En el entreno:** kg o lb por ejercicio, unilaterales con izquierdo y derecho por separado,
  series en pirámide (varios pesos en una misma serie) y opción de cancelar o reiniciar el entreno.
- Las sesiones siempre se guardan en kg. Una serie guardada es `{ kg, reps, descanso, pasos? }`:
  `kg`/`reps` son el mejor peso de la serie y `pasos` solo existe en pirámides o unilaterales
  (`{ I: {kg, reps}, D: {kg, reps} }`).

## Coach IA

El Coach (Estadísticas → Coach IA) analiza tus entrenos con un modelo de lenguaje usando **tu propia clave de API**.
Por ahora el proveedor es Claude (Anthropic): la primera vez pide la clave, la verifica trayendo la lista de modelos
(`GET /v1/models`) y deja elegir el modelo (sugiere el Opus más reciente). El análisis y las preguntas de seguimiento
usan `POST /v1/messages` directo desde la app (`fetch` con el encabezado `anthropic-dangerous-direct-browser-access`).
La conexión se cambia o se borra con el engranaje del Coach o en Ajustes → Coach IA.

La clave se guarda solo en el celular, en una llave aparte (`kratos_ia_v1`): **no** va en la copia exportada y
importar datos no la toca. El código está en `scripts/artifact/coach.js` (y copiado igual en `src/index.html`).

## Descargar

Última versión del APK (enlace fijo):
`https://github.com/JuanSebastianGarcia/kratos/releases/latest/download/Kratos.apk`

En el celular: abre el enlace, descarga `Kratos.apk` y ábrelo. La primera vez Android pedirá permitir
"instalar apps desconocidas" para tu navegador. Las versiones nuevas se instalan encima sin perder datos.

## Cómo está hecho

- `src/index.html` — toda la app (pantallas, lógica, estilos).
- `src/native.js` — puente con Android: guardado (Capacitor Preferences), pantalla encendida durante el
  entreno (KeepAwake), aviso de fin de descanso con sonido y vibración (Local Notifications),
  exportar (Filesystem + Share) y botón atrás.
- `scripts/build.mjs` — empaqueta todo en `www/` (incluye las fuentes, funciona sin internet).
- `scripts/icons.mjs` — genera el ícono y la pantalla de inicio desde `resources/logo-kratos.png`.
- `scripts/adaptar.mjs` — convierte una versión nueva del artifact de Claude.ai en `src/index.html`.
- `.github/workflows/apk.yml` — en cada push a `main` compila el APK firmado y lo publica en Releases.

## Datos

Todo se guarda en el celular. En **Ajustes** (engranaje en Inicio) puedes **Exportar** e **Importar** un JSON con:

```json
{ "ejercicios": [], "rutinas": [], "perfil": {}, "sesiones": [], "medidas": [], "analisis": [] }
```

Al importar se reemplazan solo las secciones que vienen en el archivo.

## Firma del APK

GitHub Actions firma con la llave guardada en los secretos `KRATOS_KEYSTORE_BASE64` y
`KRATOS_KEYSTORE_PASSWORD`. Siempre la misma llave = las actualizaciones se instalan encima.
No la pierdas: si cambia, hay que desinstalar la app (y se pierden los datos no exportados).

## Traer una versión nueva desde Claude.ai

1. Guarda el HTML del artifact en la carpeta del proyecto (por ejemplo `kratos (2).html`).
2. `npm run adaptar -- "kratos (2).html"`. Quita lo de Claude y agrega guardado local, Ajustes,
   Coach IA (desde `scripts/artifact/coach.js`), pantalla encendida y avisos de descanso. Respeta colores y diseño.
3. Haz commit y push a `main`: GitHub Actions compila y publica el APK nuevo.

## Probar en el navegador

```
npm install
npm run build
```

y abre `www/index.html`.
