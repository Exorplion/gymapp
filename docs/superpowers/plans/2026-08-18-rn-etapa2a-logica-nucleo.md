# Migración RN — Etapa 2a: Lógica de negocio del núcleo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar la lógica de negocio pura que necesitan las pantallas de
Hoy/Inicio/Rutina-lectura (Etapas 2b/2c) — `equip.js`, `muscle.js`,
`toast.js`, `rutina-logic.js`, `session.js`, `streak.js` — sin timer de
descanso ni notificaciones (quedan stubbeados, ver Global Constraints).

**Architecture:** Todos estos archivos son JS puro sin dependencia de DOM.
Como `native/src/lib/{db,state,format}.js` ya exportan exactamente los
mismos nombres que sus equivalentes web (Etapa 1), la mayoría de estos
archivos se portan **verbatim, cero cambios de lógica** — sólo cambia
`toast.js` (verbatim también, es puro) y se crean tres módulos stub
(`rest.js`, `alarm.js`, `carousel.js`) con la misma firma de exports que
sus originales pero implementación no-op, documentados como pendientes
para una etapa futura de funciones nativas (timer/notificaciones).

**Tech Stack:** Igual que Etapa 1 (Expo, Jest). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-08-18-migracion-react-native-design.md`

## Global Constraints

- Plain JS, sin TypeScript.
- `native/` no toca `web/`.
- `npx jest` y `npx expo-doctor` (desde `native/`) sin errores antes de cada commit.
- **Los stubs de `rest.js`/`alarm.js`/`carousel.js` son intencionales, no
  un olvido**: exportan las mismas funciones que sus originales
  (`startRest`/`stopRest`, `pedirPermiso`, `scrollCarouselTo`) pero con
  cuerpo vacío/no-op, comentado explícitamente como placeholder de una
  etapa futura (timer de descanso + notificaciones nativas). Esto deja
  `session.js` portable verbatim sin tocar sus imports.
- Los tests portados desde `web/src/lib/__tests__/` o `web/src/lib/*.test.js`
  usan Vitest (`vi.mock`, `vi.fn`) — al portarlos a Jest, convertir
  mecánicamente `vi.` → `jest.` (la API es compatible en los casos que usa
  este repo: `.mock()`, `.fn()`, `.spyOn()`).

---

### Task 1: Portar `equip.js` y `muscle.js`

**Files:**
- Create: `native/src/lib/equip.js`, `native/src/lib/muscle.js`
- Test: `native/src/lib/equip.test.js`, `native/src/lib/muscle.test.js`

**Interfaces:**
- Produces: mismos exports que `web/src/lib/equip.js` (incluye `exKey`,
  `EQUIP`, `isMachineBound`, etc.) y `web/src/lib/muscle.js` (incluye
  `EXCATALOG`, `MUSCLE_CATS`, `catOf`, `daysSinceAll`, `stalestGroups`,
  `daysSinceGroup`, `routineStability`-adjacent helpers si existen) —
  consumidos por Task 3 (`rutina-logic.js`) y Task 4 (`session.js`).

- [ ] **Step 1: Leer los originales completos**

Leer `web/src/lib/equip.js` (104 líneas) y `web/src/lib/muscle.js` (295
líneas) enteros antes de portar — son la fuente de verdad de qué exportan.

- [ ] **Step 2: Copiar verbatim**

```bash
cp web/src/lib/equip.js native/src/lib/equip.js
cp web/src/lib/muscle.js native/src/lib/muscle.js
```

Agregar un comentario de cabecera a cada uno: `// Puerto verbatim de
web/src/lib/equip.js — JS puro, sin cambios.` (mismo patrón que Etapa 1).
Revisar que ninguno de los dos importe algo DOM-específico (`document`,
`window`, `navigator`) — si lo hace, documentarlo como BLOCKED en el
reporte y no seguir sin resolverlo primero (no se espera que pase; son
catálogos de datos + funciones puras sobre `S.sessions`/`S.body`).

- [ ] **Step 3: Portar sus tests si existen en la PWA**

Buscar `web/src/lib/equip.test.js`/`web/src/lib/__tests__/equip*.test.js`
y `muscle.test.js` equivalentes. Si existen, copiarlos a
`native/src/lib/` convirtiendo `vi.` → `jest.` donde aparezca. Si no
existen tests en la PWA para alguno de los dos, escribir al menos 3-4
tests nuevos que cubran sus funciones exportadas más usadas por
`rutina-logic.js`/`session.js` (`exKey`, `catOf` como mínimo).

- [ ] **Step 4: Correr los tests**

Run: `cd native && npx jest src/lib/equip.test.js src/lib/muscle.test.js`
Expected: PASS.

- [ ] **Step 5: expo-doctor**

Run: `cd native && npx expo-doctor`
Expected: 21/21.

- [ ] **Step 6: Commit**

```bash
cd native && git add src/lib/equip.js src/lib/equip.test.js src/lib/muscle.js src/lib/muscle.test.js && git commit -m "feat(rn): portar equip.js y muscle.js (verbatim)"
```

---

### Task 2: Portar `toast.js` + crear stubs de `rest.js`/`alarm.js`/`carousel.js`

**Files:**
- Create: `native/src/lib/toast.js`, `native/src/lib/toast.test.js`
- Create: `native/src/lib/rest.js`, `native/src/lib/alarm.js`, `native/src/lib/carousel.js`

**Interfaces:**
- Produces: `toast(msg, opts)`, `subscribeToast(fn)` (verbatim de
  `web/src/lib/toast.js`); `startRest()`, `stopRest()` (stub, de
  `rest.js`); `pedirPermiso()` (stub, de `alarm.js`); `scrollCarouselTo(id)`
  (stub, de `carousel.js`) — consumidos por Task 4 (`session.js`).

- [ ] **Step 1: Portar `toast.js` verbatim**

```bash
cp web/src/lib/toast.js native/src/lib/toast.js
```
Es 100% JS puro (pub-sub con `setTimeout`, sin DOM) — cero cambios.
Agregar el mismo comentario de cabecera que Task 1.

- [ ] **Step 2: Test de `toast.js`**

```js
// native/src/lib/toast.test.js
import { toast, subscribeToast } from './toast.js';

describe('toast.js — portado de web/src/lib/toast.js', () => {
  it('toast() no hace nada si no hay listener suscripto', () => {
    expect(() => toast('hola')).not.toThrow();
  });

  it('subscribeToast() recibe el mensaje al llamar toast()', () => {
    const recibidos = [];
    const unsub = subscribeToast(evt => recibidos.push(evt));
    toast('Guardado');
    expect(recibidos[0]).toMatchObject({ msg: 'Guardado' });
    unsub();
  });

  it('el unsubscribe corta la suscripción', () => {
    const recibidos = [];
    const unsub = subscribeToast(evt => recibidos.push(evt));
    unsub();
    toast('no debería llegar');
    expect(recibidos.length).toBe(0);
  });
});
```

- [ ] **Step 3: Crear los tres stubs**

```js
// native/src/lib/rest.js
// STUB — pendiente para una etapa futura de funciones nativas (timer de
// descanso con notificaciones locales reales, expo-notifications). Misma
// firma que web/src/lib/rest.js para que session.js (Task 4) se porte
// verbatim sin tocar sus imports. No hacer nada acá todavía es
// intencional, no un olvido.
export function startRest() {}
export function stopRest() {}
```

```js
// native/src/lib/alarm.js
// STUB — pendiente para una etapa futura (permisos de notificación real,
// expo-notifications). Misma firma que web/src/lib/alarm.js. Ver nota de
// rest.js — intencional.
export function pedirPermiso() {}
```

```js
// native/src/lib/carousel.js
// STUB — el carrusel de ejercicios de Hoy con scroll nativo se implementa
// junto con la pantalla Hoy real (Etapa 2b), no acá. Misma firma que
// web/src/lib/carousel.js. Ver nota de rest.js — intencional.
export function scrollCarouselTo(id) {}
```

- [ ] **Step 4: Correr los tests**

Run: `cd native && npx jest src/lib/toast.test.js`
Expected: PASS, 3/3. (Los stubs no llevan test propio — no tienen
comportamiento que probar todavía.)

- [ ] **Step 5: expo-doctor**

Run: `cd native && npx expo-doctor`
Expected: 21/21.

- [ ] **Step 6: Commit**

```bash
cd native && git add src/lib/toast.js src/lib/toast.test.js src/lib/rest.js src/lib/alarm.js src/lib/carousel.js && git commit -m "feat(rn): portar toast.js + stubs de rest/alarm/carousel para el resto del núcleo"
```

---

### Task 3: Portar `rutina-logic.js`

**Files:**
- Create: `native/src/lib/rutina-logic.js`
- Test: `native/src/lib/rutina-logic.test.js`

**Interfaces:**
- Consumes: `S, bump, openSheet, closeSheet, saveCfg` (state.js, Etapa 1);
  `dstr, uid, norm, vibrate` (format.js, Etapa 1); `idb` (db.js, Etapa 1);
  `EXCATALOG` (muscle.js, Task 1); `exKey` (equip.js, Task 1); `toast`
  (toast.js, Task 2).
- Produces: mismos exports que `web/src/lib/rutina-logic.js` (`routineStats,
  routineName, ensureSlot, persistSlot, persistAll, reorderSeq,
  insertWorkout, insertRest, removeSlot, saveSlot, saveExercise,
  deleteExercise, moveEx, applyDays, routineSnapshot, copySourceExercises,
  copyExercises, saveCurrentAsLib, applyLibRoutine, deleteLibRoutine,
  pinAddedToRoutine, renameRoutineExercise, daySessions, sessionsSince,
  routineStability, startBlank, pushHistory, undoRutina, redoRutina, etc.`)
  — consumidos por Task 4 (`session.js`, vía `ensureSlot`/`persistSlot`) y
  por Etapa 2c (pantalla Rutina de solo lectura, vía `routineStats`/
  `routineName`).

- [ ] **Step 1: Leer el original completo**

Leer `web/src/lib/rutina-logic.js` entero (510 líneas) — es la fuente de
verdad. Confirmar que sus únicos imports externos son los ya cubiertos por
Etapa 1 + Task 1 + Task 2 de este plan (no debería importar nada de
`rest.js`/`alarm.js`/`carousel.js` — ese trío sólo lo usa `session.js`).

- [ ] **Step 2: Copiar verbatim**

```bash
cp web/src/lib/rutina-logic.js native/src/lib/rutina-logic.js
```
Agregar el comentario de cabecera estándar. Los imports ya apuntan a
`./state.js`/`./format.js`/`./db.js`/`./muscle.js`/`./equip.js`/`./toast.js`
— todos existen en `native/src/lib/` con los mismos nombres exportados a
esta altura del plan, así que no debería hacer falta tocar ni una línea
más allá del comentario de cabecera.

- [ ] **Step 3: Portar el test**

`web/src/lib/rutina-logic.test.js` existe en la PWA. Copiarlo a
`native/src/lib/rutina-logic.test.js`, convirtiendo `vi.mock`→`jest.mock`,
`vi.fn`→`jest.fn`, `vi.spyOn`→`jest.spyOn` (buscar y reemplazar mecánico,
son intercambiables en los usos de este archivo). Revisar los mocks de
`./db.js` en el test — deben apuntar a las funciones reales que expone el
`db.js` de Task 2 de Etapa 1 (`idb.put/clear/del/all`), no inventar una
forma nueva.

- [ ] **Step 4: Correr los tests**

Run: `cd native && npx jest src/lib/rutina-logic.test.js`
Expected: PASS (mismo conteo que la PWA — confirmar cuántos tests tiene
`web/src/lib/rutina-logic.test.js` antes de portar, y que ese mismo número
pasa acá).

- [ ] **Step 5: Test suite completa + expo-doctor**

Run: `cd native && npx jest && npx expo-doctor`
Expected: todo verde, 21/21.

- [ ] **Step 6: Commit**

```bash
cd native && git add src/lib/rutina-logic.js src/lib/rutina-logic.test.js && git commit -m "feat(rn): portar rutina-logic.js (verbatim)"
```

---

### Task 4: Portar `session.js`

**Files:**
- Create: `native/src/lib/session.js`
- Test: `native/src/lib/session.test.js`

**Interfaces:**
- Consumes: `S, bump, saveDraft, saveCfg, wBoth, closeSheet` (state.js);
  `dstr, uid, round1, fmtD, vibrate` (format.js); `idb` (db.js); `toast`
  (toast.js, Task 2); `startRest, stopRest` (rest.js stub, Task 2);
  `pedirPermiso` (alarm.js stub, Task 2); `scrollCarouselTo` (carousel.js
  stub, Task 2); `exKey` (equip.js, Task 1).
- Produces: mismos exports que `web/src/lib/session.js` (`pendingSlot,
  sessionForSlot, orderedExs, setExOrder, sessionExs, startSession,
  completeSession, discardSession, saveSet, skipExercise, unskipExercise,
  addExtraSet, dropSet, addSessionExercise, nextPending, targetSets,
  isSkipped, setsDone, sessionPRs, groupSets, entryDelta,
  groupSessionsByWeek, updateHistorySession, lastDataFor, isUnilateral,
  toggleUnilateral, weekStart, ensureVals`) — consumidos por Etapa 2b
  (pantalla Hoy real).

- [ ] **Step 1: Leer el original completo**

Leer `web/src/lib/session.js` entero (554 líneas).

- [ ] **Step 2: Copiar verbatim**

```bash
cp web/src/lib/session.js native/src/lib/session.js
```
Agregar el comentario de cabecera estándar, más una nota explícita sobre
los stubs: `// startRest/stopRest/pedirPermiso/scrollCarouselTo son stubs
no-op en esta etapa (ver Task 2) — el timer de descanso real y las
notificaciones llegan en una etapa futura; esta migración no pierde esa
funcionalidad, la pospone a propósito.`

- [ ] **Step 3: Portar el test**

`web/src/lib/session.test.js` existe en la PWA. Copiarlo a
`native/src/lib/session.test.js`, mismo procedimiento de conversión
`vi.`→`jest.` que Task 3. Prestar atención particular a los mocks de
`rest.js`/`alarm.js`/`carousel.js` si el test los mockea — con los stubs
reales ya no exportando nada que dependa de temporizadores del navegador,
puede que el mock ya no haga falta (los stubs de por sí no hacen nada) —
si el test original mockea `vi.mock('./rest.js', ...)` para simular
`startRest`/`stopRest`, evaluar si conviene dejar el mock (documenta
intención) o quitarlo (los stubs reales ya son no-op) — cualquiera de las
dos es válida, preferir la que rompa menos con el resto del archivo de
test.

- [ ] **Step 4: Correr los tests**

Run: `cd native && npx jest src/lib/session.test.js`
Expected: PASS (mismo conteo que `web/src/lib/session.test.js`).

- [ ] **Step 5: Test suite completa + expo-doctor**

Run: `cd native && npx jest && npx expo-doctor`
Expected: todo verde, 21/21.

- [ ] **Step 6: Commit**

```bash
cd native && git add src/lib/session.js src/lib/session.test.js && git commit -m "feat(rn): portar session.js (verbatim, sobre stubs de rest/alarm/carousel)"
```

---

### Task 5: Portar `streak.js`

**Files:**
- Create: `native/src/lib/streak.js`
- Test: `native/src/lib/streak.test.js`

**Interfaces:**
- Consumes: `S` (state.js); `dstr, fmtDFull` (format.js).
- Produces: `dayCompleted, currentStreak, bestStreak, streakHeatmap` —
  mismos exports que `web/src/lib/streak.js`, consumidos por Etapa 2c
  (pantalla Inicio real, muestra la racha).

- [ ] **Step 1: Leer el original completo**

Leer `web/src/lib/streak.js` entero (69 líneas) — el más chico del lote,
incluye la protección de `MAX_STREAK_LOOKBACK_DAYS` contra el bucle
infinito que ya mordió una vez en la PWA (ver historial del proyecto).

- [ ] **Step 2: Copiar verbatim**

```bash
cp web/src/lib/streak.js native/src/lib/streak.js
```
Agregar el comentario de cabecera estándar, más una nota destacando que
`currentStreak()`'s hard cap (`MAX_STREAK_LOOKBACK_DAYS`) se porta tal
cual — no reimplementar el loop desde cero.

- [ ] **Step 3: Portar el test**

`web/src/lib/streak.test.js` existe en la PWA. Copiarlo a
`native/src/lib/streak.test.js`, conversión `vi.`→`jest.` igual que las
tasks anteriores. Confirmar que el test que cubre el caso "turno pendiente
es descanso" (el que atrapó el bug del loop infinito originalmente) se
porta también, no sólo los casos felices.

- [ ] **Step 4: Correr los tests**

Run: `cd native && npx jest src/lib/streak.test.js`
Expected: PASS (mismo conteo que la PWA).

- [ ] **Step 5: Test suite completa + expo-doctor**

Run: `cd native && npx jest && npx expo-doctor`
Expected: todo verde, 21/21. Esta es también la revisión final de la
sub-etapa 2a — confirmar el conteo total de tests acumulado (Etapa 1: 23 +
Task 1-5 de esta sub-etapa) antes de dar la sub-etapa por cerrada.

- [ ] **Step 6: Commit**

```bash
cd native && git add src/lib/streak.js src/lib/streak.test.js && git commit -m "feat(rn): portar streak.js (verbatim, incluye el cap anti-loop-infinito)"
```

---

## Revisión final de la sub-etapa

- [ ] `cd native && npx jest` — toda la suite en verde (Etapa 1 + Tasks 1-5).
- [ ] `cd native && npx expo-doctor` — sin errores.
- [ ] `web/` sin ningún archivo modificado.
- [ ] Confirmar que ningún archivo portado importa `rest.js`/`alarm.js`/
  `carousel.js` esperando comportamiento real (deben seguir siendo
  no-ops intencionales, documentados) — grep rápido de sus nombres de
  función en los archivos portados para verificar que sólo `session.js`
  los llama, tal como en la PWA.
