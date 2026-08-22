# Migración RN — Etapa 4a: Progreso (silueta + gráficos + racha) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar la pantalla `Progreso` — silueta muscular (estática, sin
arrastre), gráficos de fuerza/volumen, racha de entrenamiento, historial de
sesiones. Es la mitad de la Etapa 4 del spec ("Nutrición + Progreso");
Nutrición se hace en 4b porque necesita portar 5 archivos de `lib/` nuevos
que Progreso no toca.

**Rulings de alcance (decisiones del usuario en esta sesión, no del
controlador — documentadas para quien retome esto):**
- **Sin rotación táctil de la silueta.** El original (`Silhouette.jsx`)
  gira el cuerpo arrastrando el dedo. Sin dispositivo/emulador en este
  entorno no hay forma de verificar ese gesto — mismo problema que el
  drag-and-drop de rutinas en Etapa 3. Acá la silueta se ve fija (frente
  o espalda) con un botón para alternar entre las dos vistas, en vez de
  arrastrar para girar. El gesto se retoma cuando haya un dispositivo
  real con el que probarlo.
- **`victory-native` como librería de gráficos**, pese a que exige
  `@shopify/react-native-skia`, `react-native-reanimated` y
  `react-native-gesture-handler` como peer-deps — decisión explícita del
  usuario, aceptando que el render real de Skia no se puede verificar
  visualmente en este entorno (mismo tipo de riesgo no verificable que la
  silueta, pero elegido conscientemente en vez de una librería más liviana
  como alternativa).

**Architecture:** La mayoría de la lógica de dominio ya existe:
`muscle.js`, `rutina-logic.js`, `session.js`, `streak.js`, `format.js`
(todos portados en Etapas 2a/2a). Falta portar `lib/charts.js` (Task 1) —
sólo su lógica pura (`weeklyAvg`, `exerciseSeries`, `filterByRange`,
`e1rm`, `e1rmSeries`, `trend`, `project`, `strengthReadout`, `RANGE_DAYS`);
`drawChart`/`pickChartPoint`/`CHART_SEL` NO se portan — son canvas-DOM
puro, reemplazados acá por `victory-native`'s propio renderer (Task 2).

**Tech Stack:** Expo, React Navigation, Jest para lógica pura.
`victory-native` + `@shopify/react-native-skia` + `react-native-reanimated`
+ `react-native-gesture-handler` se instalan en Task 2 (primera vez que
este proyecto instala dependencias nativas de este peso — requiere rebuild
del dev client si alguna vez se corrió uno, pero `expo-doctor`/`expo
export` son suficientes para este entorno sin dispositivo).

**Spec:** `docs/superpowers/specs/2026-08-18-migracion-react-native-design.md`

## Global Constraints

- Plain JS, sin TypeScript.
- `native/` no toca `web/`.
- `npx jest` sube sólo por los tests de `charts.js` (Task 1) — documentar
  el número exacto en el ledger.
- `npx expo-doctor` sin errores antes de cada commit — prestar especial
  atención después de Task 2 (nuevas dependencias nativas pueden generar
  warnings de versión/config que expo-doctor sí detecta aunque no pueda
  verificar el render).
- Bundler de Metro debe compilar sin error (`npx expo export --platform
  android`, borrando `native/dist/` después, sin committearlo).
- Ningún código de arrastre/gesto en la silueta — sólo tap (para ver stats
  de un grupo) y un botón de alternar frente/espalda.

---

### Task 1: Portar `charts.js` (lógica pura)

**Files:**
- Create: `native/src/lib/charts.js`
- Create: `native/src/lib/charts.test.js`

**Interfaces:**
- Consumes: `S` (`state.js`), y lo que `weeklyAvg`/`exerciseSeries`/etc.
  ya usan internamente en el original (revisar imports exactos al leer el
  archivo).
- Produces: consumido por Task 4 (pantalla Progreso) para alimentar los
  gráficos de `victory-native`.

- [ ] **Step 1: Leer `web/src/lib/charts.js` completo**

Portar verbatim SÓLO: `weeklyAvg`, `exerciseSeries`, `RANGE_DAYS`,
`filterByRange`, `e1rm`, `e1rmSeries`, `trend`, `project`,
`strengthReadout`. NO portar `CHART_SEL`, `drawChart`, `pickChartPoint` —
son manipulación directa de un `<canvas>` del DOM, sin sentido en RN
(Task 2 reemplaza esa parte con `victory-native`).

- [ ] **Step 2: Tests**

Cobertura mínima por función portada: un caso con datos reales (usando el
mismo patrón de fixtures que `session.test.js`/`streak.test.js` ya
establecieron) y un caso de borde (sin sesiones/sin datos → no debe
explotar, debe devolver un array vacío o el valor por defecto que el
original devuelve — confirmar leyendo el código, no asumir).

- [ ] **Step 3: Verificar**

Run: `cd native && npx jest` → sube respecto al número que dejó Etapa 3
(215 + los tests nuevos de esta task — documentar el total exacto).
Run: `cd native && npx expo-doctor` → 21/21 (esta task no toca deps).

- [ ] **Step 4: Commit**

```bash
cd native && git add src/lib/charts.js src/lib/charts.test.js && git commit -m "feat(rn): portar charts.js (lógica pura, sin drawChart/pickChartPoint de canvas)"
```

---

### Task 2: Instalar `victory-native` + peer deps

**Files:**
- Modify: `native/package.json`, `native/package-lock.json`
- Modify: `native/app.json` si `expo-doctor`/`npx expo install` piden algún
  plugin de config (ej. reanimated suele pedir el babel plugin)

**Interfaces:**
- Produces: `victory-native`, `@shopify/react-native-skia`,
  `react-native-reanimated`, `react-native-gesture-handler` disponibles
  para Task 3 (silueta, si termina necesitando gesture-handler para el
  tap) y Task 4 (gráficos).

- [ ] **Step 1: Instalar**

Usar `npx expo install victory-native @shopify/react-native-skia
react-native-reanimated react-native-gesture-handler` (no `npm install`
directo — `expo install` resuelve versiones compatibles con el SDK de
Expo del proyecto, evitando el tipo de drift que ya pasó una vez con
`expo-doctor` en Etapa 2b).

- [ ] **Step 2: Configurar `react-native-reanimated`'s babel plugin**

`react-native-reanimated` requiere `'react-native-reanimated/plugin'`
como ÚLTIMO plugin en `babel.config.js` — confirmar si `native/
babel.config.js` existe y agregarlo si falta (la documentación de Expo
lo pide explícitamente; sin esto el bundler puede compilar en este
entorno pero fallar en tiempo de ejecución en un dispositivo real).

- [ ] **Step 3: Verificar**

Run: `cd native && npx expo-doctor` → debe seguir en verde; si aparece
algún warning de versión de una de las 4 libs nuevas, resolverlo (mismo
criterio que el bump de expo en Etapa 2b).
Run: `cd native && npx expo export --platform android` → debe compilar
sin error. Esto NO verifica que Skia renderice correctamente en un
dispositivo — sólo que el bundle se arma. Documentar esta limitación en
el reporte de la task explícitamente.
Run: `cd native && npx jest` → sin cambios (esta task no toca `lib/`).

- [ ] **Step 4: Commit**

```bash
cd native && git add package.json package-lock.json babel.config.js app.json && git commit -m "build(native): instalar victory-native + skia + reanimated + gesture-handler"
```

(Ajustar la lista de archivos según lo que realmente cambie — puede que
`app.json` no necesite tocarse si Expo config plugins no son necesarios
para estas libs; confirmar al instalar, no asumir.)

---

### Task 3: Silueta muscular (estática, sin arrastre)

**Files:**
- Create: `native/src/screens/Silhouette.js`

**Interfaces:**
- Consumes: `cuerpo` (`bodydata.js`, ya portado); `groupStats, diasTexto`
  (`muscle.js`, ya portado); `S` (`state.js`).
- Produces: usado por Task 4 dentro de la pantalla Progreso.

- [ ] **Step 1: Leer `web/src/components/Silhouette.jsx` completo (369
  líneas)**

Enfocarse en: las 3 capas por cuerpo (masa/músculo/luz — SVG puro,
gradientes por grupo según `groupStats`), y el tap sobre un músculo para
ver sus stats (`groupStats(cat)` + `diasTexto`). IGNORAR todo el código
de arrastre/inercia/ángulo (`useRef`, el cálculo de `anchoDelCuerpo` para
medir el drag, los handlers de pointer/touch para rotar) — no se porta
esta etapa.

- [ ] **Step 2: Implementar con `react-native-svg`**

`react-native-svg` ya es una dependencia transitiva de Expo (usada por
iconos en varias libs) — confirmar que está en `native/package.json`;
si no, agregarla con `npx expo install react-native-svg` como parte de
esta task. Portar la geometría de `cuerpo(sexo)` (ya en `bodydata.js`,
formato de paths SVG) usando `Svg`/`Path`/`LinearGradient`/`Stop` de
`react-native-svg` en vez de los elementos `<svg>`/`<path>` nativos del
DOM. Un botón (`Pressable`, texto "↻ Ver de atrás"/"↻ Ver de frente")
alterna entre `cuerpo('m'|'f', 'front'|'back')` — confirmar la firma
exacta de `cuerpo()` al leer `bodydata.js`, puede que la vista
frente/espalda sea un parámetro separado o parte de la clave del objeto.
Tocar un grupo muscular (`Path` con `onPress`) muestra sus stats
(`groupStats`/`diasTexto`) en un popup simple (`View` posicionado
absoluto cerca del punto tocado, o un `Modal` — decisión del
implementador, lo que menos código nuevo requiera dado que no existe
sistema de sheets todavía).

- [ ] **Step 3: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error (borrar `native/dist/`).
Run: `cd native && npx jest` → sin cambios (esta task no toca `lib/`
salvo por agregar `react-native-svg` si hiciera falta, lo cual no afecta
tests).

- [ ] **Step 4: Commit**

```bash
cd native && git add src/screens/Silhouette.js package.json package-lock.json && git commit -m "feat(rn): silueta muscular estática (sin arrastre — ver ruling de alcance)"
```

---

### Task 4: Pantalla Progreso (gráficos + racha + historial)

**Files:**
- Create: `native/src/screens/SessionCard.js` (puerto simplificado de
  `web/src/components/SessionCard.jsx`, 35 líneas — fila de una sesión en
  el historial)
- Modify: `native/src/screens/Progreso.js` (reemplaza el placeholder de
  Etapa 1)

**Interfaces:**
- Consumes: `S, useStore, bump` (`state.js`); `streakHeatmap,
  currentStreak, bestStreak` (`streak.js`, ya portado); `fmtD, fmtDFull,
  fmtNum, kg2lb, round1` (`format.js`, ya portado); `muscleVolume`
  (`muscle.js`, ya portado); `sessionsSince, routineStability`
  (`rutina-logic.js`, ya portado); `groupSessionsByWeek` (`session.js`,
  ya portado); `weeklyAvg, exerciseSeries, filterByRange, strengthReadout,
  project, RANGE_DAYS` (`charts.js`, Task 1); `Silhouette` (Task 3).
- Produces: cierra la mitad "Progreso" de la Etapa 4 del spec.

- [ ] **Step 1: Leer `web/src/components/screens/Progreso.jsx` completo
  (304 líneas) y `web/src/components/Chart.jsx` (55 líneas) y
  `web/src/components/SessionCard.jsx` (35 líneas)**

`Chart.jsx` es un wrapper delgado sobre `drawChart`/canvas — NO se porta
tal cual, se reemplaza por `LineChart`/`BarChart` de `victory-native`
alimentados con los mismos puntos que `weeklyAvg`/`exerciseSeries`/etc.
producen (Task 1). Confirmar la firma exacta de los componentes de
`victory-native` instalados (leer su documentación/tipos en
`node_modules/victory-native` si hace falta) antes de escribir el
wrapper — no asumir una API sin confirmarla.

- [ ] **Step 2: Implementar `SessionCard`**

Puerto directo — fila con fecha, nombre del turno, duración, cantidad de
ejercicios. Sin lógica nueva, sólo `View`/`Text`/`Pressable` (si el
original tiene `onClick` a un sheet de detalle, acá queda sin acción —
sheets son Etapa 5 — o navega a `Hoy` si aplica a la sesión de hoy,
decisión del implementador, documentar cuál eligió).

- [ ] **Step 3: Implementar la pantalla `Progreso`**

Estructura (adaptar del original, recortando lo que no aplica):
racha (`currentStreak`/`bestStreak`/`streakHeatmap` — heatmap como grilla
de `View`s coloreados, no SVG, es más simple), `Silhouette` (Task 3),
selector de rango (`RANGE_DAYS` — botones 1m/3m/6m), gráfico de volumen
por grupo (`muscleVolume` + `victory-native`), gráfico de fuerza estimada
(`strengthReadout`/`e1rmSeries`/`project` + `victory-native`), lista de
sesiones recientes (`sessionsSince` + `SessionCard`).

**Recorte deliberado:** sin el sheet de detalle de ejercicio para el
gráfico de fuerza (`exercise-detail` o similar en el original, si existe
— confirmar leyendo el archivo; si existe, se recorta, Etapa 5). Sin
`routineStability`'s visualización avanzada si el original la muestra con
algo más que texto simple — confirmar y recortar a texto plano si hace
falta un componente nuevo no trivial.

- [ ] **Step 4: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error (borrar `native/dist/`).
Run: `cd native && npx jest` → sin cambios respecto a lo que dejó Task 1
(esta task no toca `lib/`).

- [ ] **Step 5: Commit**

```bash
cd native && git add src/screens/SessionCard.js src/screens/Progreso.js && git commit -m "feat(rn): pantalla Progreso — silueta, gráficos, racha, historial"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — todos los tests pasan (247/247, sólo suben
  por `charts.test.js` de Task 1).
- [x] `cd native && npx expo-doctor` — 21/21, incluyendo las 5
  dependencias nuevas (victory-native, skia, reanimated, gesture-handler,
  react-native-svg).
- [x] Bundler de Metro compila sin error (`expo export --platform
  android`, 2127 módulos).
- [x] `web/` sin ningún archivo modificado (confirmado en cada task y en
  la revisión final).
- [x] Confirmado explícitamente en la revisión final (y repetido acá):
  el render real de Skia/victory-native NO fue verificado visualmente
  (sin dispositivo/emulador en este entorno) — limitación conocida y
  aceptada, no un hallazgo. La revisión final SÍ encontró 3 bugs Critical
  de la capa de render que ni jest ni expo-doctor ni el bundler podían
  detectar (silueta sin pintar por mismatch de ids de gradiente + scope
  de `<Defs>` en RN-SVG; falta de `GestureHandlerRootView` causando
  crash al abrir Progreso) — arreglados en un fix round, re-revisión
  limpia. La primera corrida real en un dispositivo debe tratarse como
  una prueba genuina, no un trámite.
- [x] Confirmado (grep, dos veces — Task 3 y revisión final) que la
  silueta no tiene código de arrastre/gesto remanente.
