# Kratos

App de entrenamiento para Android (Capacitor). Tema oscuro, acento naranja `#FF6A1A`. Incluye biseries (dos ejercicios seguidos sin descanso).
El color de acento se puede cambiar en Ajustes → Color de la app (se guarda en `perfil.acento`).

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
   Coach "en desarrollo", pantalla encendida y avisos de descanso. Respeta colores y diseño.
3. Haz commit y push a `main`: GitHub Actions compila y publica el APK nuevo.

## Probar en el navegador

```
npm install
npm run build
```

y abre `www/index.html`.
