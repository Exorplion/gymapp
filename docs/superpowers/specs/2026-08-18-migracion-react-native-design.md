# Migración a React Native — Diseño

## Contexto y motivación

Gymapp (FIERRO) es hoy una PWA en React 19 + Vite, servida estática desde
GitHub Pages, con IndexedDB como almacenamiento. Funciona bien, pero:

- Las transiciones nunca van a sentirse 100% nativas dentro de un WebView
  (motor de renderizado compartido con el navegador — probado en esta
  misma sesión: hasta la mejor animación CSS sigue siendo un WebView).
- No se puede publicar en Play Store como app real (sólo como PWA
  instalable, que no aparece en la tienda).
- No hay acceso a notificaciones push reales ni a sensores del teléfono.

Enzo quiere los tres: presencia en Play Store, funciones nativas
(notificaciones push, sensores), y animaciones que corran en el hilo de
UI nativo — indistinguibles de una app nativa de verdad.

## Alcance de esta migración

- **Plataforma**: Android primero (Play Store). iOS queda abierto para
  después — React Native genera ambos desde el mismo código, así que no
  se pierde nada dejándolo para más adelante.
- **La PWA actual sigue viva** en `exorplion.github.io/gymapp` durante
  toda la migración. Nada se apaga hasta que la app nativa iguale la
  funcionalidad actual y los datos se hayan migrado.
- Esto es un proyecto grande, no una task — se decompone en 7 etapas,
  cada una con su propio ciclo spec→plan→implementación (esta spec cubre
  la arquitectura general y el mapa de etapas; cada etapa profundiza su
  propio diseño cuando le toca empezar).

## Stack técnico

- **Expo (managed workflow)**, no React Native "bare". Permite build en
  la nube vía EAS sin Android Studio/Xcode instalados localmente, y dejar
  iOS para después sin cambiar nada de la base.
- **La capa de lógica de negocio se porta, no se reescribe.** Los
  archivos de `web/src/lib/*.js` (`rutina-logic.js`, `session.js`,
  `streak.js`, `muscle.js`, `macros.js`, `format.js`, `templates.js`,
  etc.) son JS puro operando sobre objetos/arrays planos — sin DOM, sin
  CSS, sin imports de React-DOM. Esa capa se lleva casi intacta a la app
  nueva; sólo cambia:
  - **Persistencia**: IndexedDB → `@react-native-async-storage/async-storage`.
    La app usa IndexedDB como almacén clave-valor simple (`idb.all/put/
    clear`, sin queries indexadas complejas — confirmado leyendo
    `web/src/lib/db.js`), así que AsyncStorage (JSON por clave) es un
    reemplazo directo, más simple que meter SQLite.
  - **UI**: JSX con `<div>`/CSS → componentes nativos de React Native
    (`View`/`Text`/`Pressable`/`StyleSheet`). Esto sí se reescribe
    pantalla por pantalla.
- **Animación y gestos**: `react-native-reanimated` +
  `react-native-gesture-handler` — corren en el hilo de UI nativo, no en
  el hilo de JS, así que no se pueden trabar por un re-render de React
  (la causa raíz del problema de rendimiento que tuvo la PWA con Framer
  Motion esta misma sesión). Reemplaza tanto las transiciones de pestaña
  como el sistema de drag-and-drop de `web/src/lib/drag.js`.
- **Gráficos** (Progreso): librería de charts para RN basada en
  `react-native-svg` (a definir en la Etapa 4 — Victory Native o
  similar).
- **Notificaciones**: `expo-notifications`.
- **Build y publicación**: `eas build` (Android) + `eas submit` (Play
  Store).

## Qué NO se lleva tal cual

- **Todo el CSS** (`web/src/styles.css`, ~2000 líneas) — no aplica en
  RN. Cada pantalla se re-estiliza con `StyleSheet.create`, tomando la
  paleta de colores y espaciados actuales como referencia visual, no como
  código reusable.
- **El sistema de sheets basado en un `<div>` fixed + backdrop-filter**
  (`web/src/lib/state.js`'s `openSheet`/`closeSheet`, `Sheet.jsx`) — se
  reemplaza por el patrón nativo de bottom sheet de RN (ej.
  `@gorhom/bottom-sheet`, construido sobre gesture-handler/reanimated).
- **El service worker / manifest PWA** — no aplica; Expo maneja su
  propio ciclo de updates (OTA vía `expo-updates` si hace falta).
- **`web/src/lib/drag.js`** (el sistema de arrastre táctil hecho a mano
  con pointer events) — se reemplaza por gesture-handler, que ya resuelve
  esto de forma nativa y sin los workarounds que el código actual
  documenta (long-press, exclusión de zonas, etc.).

## Etapas (cada una es su propio ciclo spec→plan→implementación)

1. **Andamiaje** — proyecto Expo, navegación de 4 pestañas (Inicio/
   Rutina/Comida/Progreso, con Hoy accesible desde Inicio igual que en la
   PWA), capa de datos portada (`state.js`'s shape + AsyncStorage).
   Objetivo: un APK real instalado en el teléfono, aunque casi vacío —
   walking skeleton, no una demo de pantallas sueltas.
2. **Núcleo** — Hoy + Inicio + Rutina en modo lectura. El loop mínimo
   usable: ver qué toca hoy, empezar una sesión, registrar series.
3. **Editor de Rutina** — drag-and-drop nativo con gesture-handler/
   reanimated, turnos de la secuencia, biblioteca de rutinas/plantillas.
4. **Nutrición + Progreso** — incluye elegir e integrar la librería de
   charts.
5. **Sheets restantes** — los ~25 componentes de `web/src/components/
   sheets/` que faltan (Ajustes, historial de sesiones, formularios de
   comida/cuerpo, etc.).
6. **Funciones nativas** — notificaciones push (recordatorio de
   entrenar, aviso de fin de descanso), sensores si siguen siendo
   prioridad después de probar las etapas anteriores.
7. **Migración de datos + publicación** — herramienta de exportación
   desde la PWA (ya existe un export/import JSON en Ajustes,
   `web/src/lib/backup.js`) hacia la app nueva, más armar la ficha de
   Play Store (íconos, capturas, política de privacidad) y `eas submit`.

## Método de ejecución

Cada etapa se ejecuta con `subagent-driven-development`, igual que el
plan de rutina-por-secuencia: un subagente implementador por task, con
review de spec-compliance y calidad después de cada una, y una revisión
final de rama antes de integrar. Las tasks independientes dentro de una
etapa se despachan en paralelo cuando no comparten archivos.

## Riesgos conocidos

- **Escala real**: esto es semanas de trabajo, no una sesión. Cada etapa
  probablemente necesite varias sesiones.
- **Gráficos y la silueta muscular** (`Silhouette.jsx`, actualmente SVG
  embebido con CSS) son las piezas más trabajosas de portar — se
  resuelven en su propia etapa (4) en vez de bloquear el andamiaje.
- **Paridad de funcionalidad**: hasta que la Etapa 5 no esté completa, la
  app nativa no cubre el 100% de lo que ya hace la PWA — por eso la PWA
  sigue viva en paralelo (ver "Alcance").
