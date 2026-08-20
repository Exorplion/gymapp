# Migración RN — Etapa 3: Editor de Rutina — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `Rutina` deje de ser sólo lectura. Modo edición: insertar/quitar
turnos, renombrarlos, reordenarlos, agregar/editar/borrar ejercicios dentro
de un turno y reordenarlos, y una biblioteca para guardar la rutina actual
o aplicar una plantilla/una guardada. Cierra el editor completo — la pieza
que faltaba para que la app sea usable de punta a punta sin la PWA al lado
para armar el split.

**Architecture:** La lógica de dominio ya existe y está portada/testeada en
`rutina-logic.js` (Etapa 2a): `enterEditMode/exitEditMode`, `insertWorkout/
insertRest/removeSlot`, `reorderSeq`, `moveEx/deleteExercise`, `saveSlot`
(rename), `applyLibRoutine/deleteLibRoutine/saveCurrentAsLib/startBlank`.
Falta portar `web/src/lib/templates.js` (datos estáticos de plantillas +
`applyTemplate`) — es la única adición a `lib/` de esta etapa, ver Task 3.

**Ruling de alcance — SIN drag-and-drop táctil real** (decisión del
controlador, documentada para que quien retome esto la vea): el spec de
migración describe esta etapa como "drag-and-drop nativo con gesture-
handler/reanimated". Este entorno no tiene dispositivo/emulador — cada
etapa anterior ya lo documentó como limitación y se apoyó en
`expo-doctor`+bundler para verificar UI. Gestos táctiles (`PanResponder`/
gesture-handler) no se pueden verificar de ninguna forma sin tocar una
pantalla real; escribir ese código sin poder probarlo es el tipo de riesgo
que esta migración viene evitando a propósito. En su lugar: reordenar
turnos y ejercicios usa botones ↑/↓ — mismo patrón que YA existe en el
original web para ejercicios (`handleMoveEx`, ver `Rutina.jsx`), extendido
acá también a turnos (que en web sólo tenían drag, sin fallback de botón).
`react-native-gesture-handler`/`reanimated` NO se instalan en esta etapa —
no hacen falta sin drag real. Retomar el drag táctil real es trabajo para
cuando haya un dispositivo con el que probarlo; no bloquea que el editor
sea funcional hoy.

**Recorte deliberado de alcance** (mismo patrón que Etapas 2b/2c):
- **Sin RIR/iconos/badge de equipo por ejercicio** (`exdb.js`, `exicon.js`,
  `equip.js`'s label no se usan). El form de agregar/editar ejercicio pide
  sólo nombre, series y reps — sin equipo/máquina/categoría/unilateral
  (`equip`/`machine`/`cat`/`unilateral` quedan `undefined`, campos válidos
  y ya soportados por `cloneExercise`/`persistSlot`, simplemente no se
  piden en el form de esta etapa).
- **Sin sheet `ex-info`** (Etapa 5). El botón ℹ del original no se porta.
- **Sin "Copiar a otro turno"/"Traer de otro turno"** (`copy-exs` sheet,
  usa `copyExercises`/`copySourceExercises` ya portados en `rutina-logic.js`
  pero el sheet en sí es Etapa 5). Se puede armar un turno igual a otro a
  mano; la copia rápida queda para cuando lleguen los sheets.
- **Biblioteca sin import/export JSON** (`backup.js`, Etapa 7 — migración
  de datos). Sólo guardar/aplicar/borrar rutinas guardadas + aplicar
  plantillas + empezar en blanco.

**Tech Stack:** Igual que etapas anteriores — Expo, React Navigation, Jest
para lógica pura. `templates.js` (Task 3) SÍ lleva test (es lib nuevo, no
UI) — el resto sigue el patrón UI-only (expo-doctor + bundler, sin Jest de
componentes).

**Spec:** `docs/superpowers/specs/2026-08-18-migracion-react-native-design.md`

## Global Constraints

- Plain JS, sin TypeScript.
- `native/` no toca `web/`.
- `npx jest` — sube de 211 SOLO por los tests de `templates.js` (Task 3);
  Tasks 1 y 2 no tocan `lib/`, deben mantenerlo flat. Documentar el nuevo
  número exacto en el ledger cuando Task 3 lo cambie.
- `npx expo-doctor` sin errores antes de cada commit.
- Bundler de Metro debe compilar sin error — usar
  `npx expo export --platform android` (mismo criterio que etapas
  anteriores), borrando `native/dist/` después, sin committearlo.
- NO instalar `react-native-gesture-handler` ni `react-native-reanimated`
  en esta etapa (ver ruling de alcance arriba).
- Reordenar (turnos o ejercicios) SIEMPRE usa las funciones ya portadas
  (`reorderSeq`, `moveEx`) — no reimplementar la lógica de reordenamiento,
  sólo la UI que las invoca.

---

### Task 1: Modo edición — turnos (insertar/quitar/renombrar/reordenar)

**Files:**
- Modify: `native/src/screens/Rutina.js`

**Interfaces:**
- Consumes (todo ya portado en `rutina-logic.js`, Etapa 2a):
  `enterEditMode, exitEditMode, insertWorkout, insertRest, removeSlot,
  reorderSeq, saveSlot`. `S, useStore, bump` (`state.js`); `toast`
  (`toast.js`).
- Produces: el esqueleto del editor — Task 2 agrega la edición de
  ejercicios DENTRO de cada turno abierto (mismo archivo, sección nueva).

- [ ] **Step 1: Leer `web/src/components/screens/Rutina.jsx`'s
  `RutinaEdit` y `SlotCard`'s cabecera (líneas ~176-232 aprox., NO el
  cuerpo de ejercicios — eso es Task 2)**

Enfocarse en: el toggle modo lectura/edición, la lista de turnos con
handle de arrastre (acá se reemplaza por botones ↑/↓), insertar turno al
final (`+ Entrenamiento`/`+ Descanso`), quitar turno (`✕`), y cómo se
renombra un turno (`slot-edit` sheet en el original — acá, sin sheets
todavía, el nombre se edita con un `TextInput` inline en la cabecera del
turno cuando está en modo edición).

- [ ] **Step 2: Agregar un botón "Editar rutina" que llama
  `enterEditMode()` y togglea entre `RutinaView` (ya existe, Etapa 2c) y
  un nuevo `RutinaEdit`**

`Rutina()` pasa a alternar según `S.rutMode` (ya existe en `state.js`,
mismo campo que usa el original — comprobar que esté inicializado; si no,
agregarlo a `state.js`'s shape inicial como `rutMode: 'view'`, coordinando
con cómo Etapa 1 definió el resto de `S`). El botón "Editar rutina" que
Etapa 2c dejó con `toast('Próximamente')` pasa a llamar `enterEditMode()`
de verdad.

- [ ] **Step 3: Implementar `RutinaEdit` — lista de turnos editable**

Por cada turno en `S.routine`, una tarjeta con:
- Índice (`Turno {i+1}`) y, si es `workout`, un `TextInput` con
  `slot.name` que al perder foco (`onBlur`) llama `saveSlot(index, {
  name })` (persiste). Si es `rest`, mostrar "Descanso" (texto fijo, no
  editable — igual que el original no permite nombrar un descanso).
- Botones ↑/↓ para mover el turno un lugar (llaman `reorderSeq(i, i-1)`/
  `reorderSeq(i, i+1)`, deshabilitados en los extremos — mismo patrón
  `disabled={i===0}`/`disabled={i===length-1}` que el original usa para
  `ex-up`/`ex-down`).
- Botón `✕` que llama `removeSlot(index)` (sin confirmación — mismo
  comportamiento que el original).
- Al final de la lista: dos botones `+ Entrenamiento`/`+ Descanso` que
  llaman `insertWorkout(S.routine.length)`/`insertRest(S.routine.length)`.
- Un botón `‹ Listo` (o similar) que llama `exitEditMode()` y vuelve a
  `RutinaView`.

Cada turno `workout` debe quedar expandible/colapsable (mismo mecanismo
`useState` local que `RutinaView` de Etapa 2c) para que Task 2 tenga dónde
insertar la lista de ejercicios editable cuando está abierto — Task 1
puede dejar el cuerpo expandido vacío o con un placeholder de una línea
("(ejercicios — Task 2)") que Task 2 reemplaza; NO se necesita que Task 1
prediseñe la UI de ejercicios, sólo que el expand/collapse funcione.

- [ ] **Step 4: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error (borrar `native/dist/`).
Run: `cd native && npx jest` → sigue en 211/211 (esta task no toca `lib/`).

- [ ] **Step 5: Commit**

```bash
cd native && git add src/screens/Rutina.js && git commit -m "feat(rn): editor de rutina — insertar/quitar/renombrar/reordenar turnos"
```

---

### Task 2: Editar ejercicios dentro de un turno

**Files:**
- Modify: `native/src/screens/Rutina.js`

**Interfaces:**
- Consumes: `moveEx, deleteExercise` (`rutina-logic.js`, ya portados);
  `cloneExercise, persistSlot` si hacen falta para el alta de un
  ejercicio nuevo (comprobar si `rutina-logic.js` ya expone una función de
  "agregar ejercicio a un turno" — si no, construirla en el propio
  componente usando `cloneExercise` + `persistSlot` + `bump()`, sin tocar
  `lib/`: agregar un id nuevo con `cloneExercise({name, sets, reps})` al
  array `slot.exercises`, `await persistSlot(index)`, `bump()`).
- Produces: cierra el editor turno-por-turno — junto con Task 1, un turno
  se puede armar de punta a punta sin la PWA.

- [ ] **Step 1: Leer `web/src/components/screens/Rutina.jsx`'s `SlotCard`
  — el cuerpo de ejercicios cuando el turno está `open` (líneas ~245-310
  aprox., el `.map(exs)` con `ex-row`)**

Ignorar: `ExIcon`/`iconOf`, `exInfo`/`rirScheme`, `equipLabel`, el botón
ℹ, y "Copiar a otro turno"/"Traer de otro turno" — todo recortado (ver
plan). Enfocarse en: la fila por ejercicio (nombre + series×reps), los
botones ↑/↓ (`handleMoveEx` → acá directo `moveEx(index, ex.id, dir)`,
sin la animación FLIP del original — no hay equivalente barato sin
gesture libs, se pierde la animación pero no la función), el botón ✎
(editar — acá un form inline, no un sheet aparte) y ✕ (`deleteExercise`).

- [ ] **Step 2: Implementar la lista de ejercicios del turno abierto**

Dentro del cuerpo expandido de cada turno `workout` (donde Task 1 dejó el
placeholder), por cada ejercicio en `slot.exercises`:
- Nombre y `{sets}×{reps}`.
- Botones ↑/↓ que llaman `moveEx(index, ex.id, -1)`/`moveEx(index, ex.id,
  1)`, deshabilitados en los extremos.
- Botón ✎ que abre un form inline (mismo turno, `useState` local — no un
  modal/sheet) con 3 campos: nombre (`TextInput`), series (`TextInput`
  numérico), reps (`TextInput` texto libre — el original permite reps
  como rango de texto, ej. "8-10", no sólo número). Guardar reescribe el
  ejercicio en `slot.exercises[k]` (mutación directa + `persistSlot(index)`
  + `bump()`, mismo patrón que el resto de `rutina-logic.js` usa para
  mutar `S.routine` in-place) y cierra el form inline.
- Botón ✕ que llama `deleteExercise(index, ex.id)`.
- Al final de la lista, un botón `+ Ejercicio` que abre el mismo form
  inline en modo alta (campos vacíos, guardar hace `push` al array con
  `cloneExercise` en vez de reescribir un índice existente).

- [ ] **Step 3: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error (borrar `native/dist/`).
Run: `cd native && npx jest` → sigue en el número que dejó Task 1 (211,
salvo que Task 3 ya haya corrido y lo haya subido — coordinar con el
ledger).

- [ ] **Step 4: Commit**

```bash
cd native && git add src/screens/Rutina.js && git commit -m "feat(rn): editor de rutina — agregar/editar/borrar/reordenar ejercicios"
```

---

### Task 3: Biblioteca de rutinas + plantillas

**Files:**
- Create: `native/src/lib/templates.js` (puerto de `web/src/lib/
  templates.js` — datos estáticos + `applyTemplate`)
- Create: `native/src/lib/templates.test.js`
- Create: `native/src/screens/Library.js` (pantalla completa, no sheet
  modal — sin sistema de sheets todavía, Etapa 5. Se navega a ella desde
  el botón "Mis rutinas" de `Rutina.js`)
- Modify: `native/App.js` (registrar `Library` — como pantalla dentro de
  un `Stack.Navigator` anidado en la pestaña Rutina, o una ruta separada;
  usar el patrón que menos toque la estructura de tabs existente — ver
  Step 3)
- Modify: `native/src/screens/Rutina.js` (el botón "Mis rutinas" navega a
  `Library` en vez de `toast('Próximamente')`)

**Interfaces:**
- Consumes: `applyLibRoutine, deleteLibRoutine, saveCurrentAsLib,
  startBlank, routineStats, routineName` (`rutina-logic.js`, ya
  portados); `S` (`state.js`); `fmtD` (`format.js` — comprobar que ya
  esté portado, si no agregarlo como parte de esta task, es una función
  de formato de fecha, no lógica de dominio); `TEMPLATES, applyTemplate`
  (`templates.js`, nuevo de esta task).
- Produces: cierra Etapa 3 — el editor completo, guardar/cargar rutinas y
  plantillas.

- [ ] **Step 1: Leer `web/src/lib/templates.js` completo y portarlo
  verbatim**

Mismo criterio que toda la migración: lógica pura, sin DOM, se porta tal
cual (ajustando sólo imports si hace falta). Agregar
`templates.test.js` con al menos: `TEMPLATES` no vacío y con la forma
esperada (`id/name/days/who/freq` — confirmar campos exactos leyendo el
archivo), y `applyTemplate(id)` aplica `TEMPLATES.find(t=>t.id===id)` vía
`applyDays` (ya portado) — un test que llama `applyTemplate` con un id
válido y confirma que `S.routine`/`S.cfg.routineName` quedan acordes,
más un caso de id inexistente (no explota, no hace nada o lanza un error
claro — confirmar el comportamiento del original y portarlo igual).

- [ ] **Step 2: Leer `web/src/components/sheets/Library.jsx` completo**

Portar la lógica de `LibraryList` y `LibrarySave` a una sola pantalla con
dos modos (mismo patrón que el original ya usa, `mode='list'|'save'`),
pero como pantalla de navegación (`route.params` en vez de `openSheet`
props) en vez de sheet modal.

- [ ] **Step 3: Registrar `Library` en la navegación**

`native/App.js` usa `createBottomTabNavigator` para las 4 pestañas. Para
que "Mis rutinas" navegue a una pantalla nueva sin romper esa estructura,
envolver la pestaña "Rutina" en un `Stack.Navigator` propio (patrón
estándar de React Navigation: tab → stack anidado) con dos rutas,
`RutinaHome` (el componente `Rutina` actual) y `Library`. El botón "Mis
rutinas" en `Rutina.js` llama `navigation.navigate('Library')`; dentro de
`Library.js`, "Guardar la actual como…" navega a la misma pantalla con
`{mode:'save'}` (`navigation.navigate('Library', {mode:'save'})`) o abre
un form inline en la misma pantalla — decisión del implementador, lo que
menos código nuevo agregue dado que ambas rutas ya están portadas.

- [ ] **Step 4: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error (borrar `native/dist/`).
Run: `cd native && npx jest` → sube respecto al número que dejaron Tasks
1/2 (nuevo, sólo por `templates.test.js` — documentar el número exacto en
el ledger).

- [ ] **Step 5: Commit**

```bash
cd native && git add src/lib/templates.js src/lib/templates.test.js src/screens/Library.js src/screens/Rutina.js App.js && git commit -m "feat(rn): biblioteca de rutinas + plantillas — cierra el editor de Etapa 3"
```

---

## Revisión final de la etapa

- [ ] `cd native && npx jest` — todos los tests pasan (número final
  documentado en el ledger, mayor a 211 sólo por `templates.test.js`).
- [ ] `cd native && npx expo-doctor` — sin errores.
- [ ] Bundler de Metro compila sin error.
- [ ] `web/` sin ningún archivo modificado.
- [ ] Confirmar que insertar/quitar/renombrar/reordenar un turno, y
  agregar/editar/borrar/reordenar un ejercicio, cada uno persiste
  (`persistSlot`/`saveSlot`/`removeSlot` etc. ya se encargan de IDB —
  confirmar que ningún camino nuevo muta `S.routine` sin pasar por esas
  funciones o sin `bump()`).
- [ ] Confirmar que `reorderSeq`/`moveEx` en los extremos (primer/último
  turno o ejercicio) no producen un índice inválido — los botones deben
  quedar `disabled`, no fallar en runtime si se llaman igual.
- [ ] Confirmar que `S.rutMode`/`S.rutOpen` (si el original los usa
  globalmente) no quedan en un estado inconsistente al salir del editor
  o cambiar de pestaña — mismo tipo de chequeo cross-task que atrapó el
  bug de `S.tab` en la revisión final de Etapa 2c.
