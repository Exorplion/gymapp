# Rutina por secuencia — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el modelo de rutina indexado por día de semana
(`S.routine[weekday]`) por una secuencia ordenada que avanza al completar
cada sesión, sin importar el día calendario — igual que el flujo "Start
Workout" de LIFTOFF, y resolviendo el problema real de Enzo (cambia de
día seguido y hoy tiene que reeditar la rutina a mano cada vez).

**Architecture:** `S.routine` pasa de mapa `weekday -> {...}` a array
ordenado de "turnos" (`workout` o `rest`), cada uno con un `id` estable.
Un puntero (`S.cfg.seqIndex`) marca el turno pendiente y avanza al
completar una sesión o cuando un turno de descanso "vence" (pasa un día
calendario). Las sesiones guardan `slotId` (el `id` del turno, estable
across reordenamientos) en vez de `weekday`, para que el historial no se
desarme si después reordenás la secuencia. El editor de Rutina cambia su
mecánica de arrastre de "intercambiar contenido entre 7 casilleros fijos"
a "reordenar una lista" — esto de hecho **elimina** la máquina de
colisiones día-contra-día (`shift`/`swap`/`dayDrop`) que existía sólo
porque antes dos turnos no podían ocupar el mismo día.

**Tech Stack:** React 19, IndexedDB (con migración de schema — sube
`DB.ver` de 1 a 2), mismo mecanismo de arrastre por FLIP (`drag.js`) ya
usado para ejercicios.

**Spec:** `docs/superpowers/specs/2026-08-16-rutina-por-secuencia-design.md`

## Global Constraints

- Ningún dato existente se pierde: la migración de IndexedDB corre sola
  la primera vez que se abre la app con esta versión (Pieza 4 del spec).
- Las sesiones ya guardadas (`S.sessions`) NO se reescriben — siguen
  teniendo `weekday` tal cual están; sólo las sesiones NUEVAS (desde esta
  versión en adelante) usan `slotId`. Cualquier función que lea
  `s.weekday` de una sesión vieja para agrupar/mostrar historial sigue
  funcionando (mostrar fecha/nombre de una sesión pasada no depende del
  modelo de rutina).
- `npx vitest run` y `npm run lint` sin warnings nuevos antes de cada
  commit (baseline: 10 warnings).
- Verificación en navegador real (CDP) en las tasks que tocan UI/flujo
  completo (6, 8, 9) — nunca dar por buena una migración o un flujo de
  sesión sin probarlo corriendo.

---

### Task 1: Modelo de datos y migración de IndexedDB

**Files:**
- Modify: `web/src/lib/db.js`
- Modify: `web/src/lib/state.js`
- Test: `web/src/lib/db.test.js` (crear si no existe)

**Interfaces:**
- Produces: `S.routine` como array de `{id, order, type:'workout'|'rest', name?, exercises?}`. `S.cfg.seqIndex` (number), `S.cfg.seqIndexDate` (string `YYYY-MM-DD` o `null`).

- [ ] **Step 1: Escribir el test de migración**

```js
// web/src/lib/db.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { idbOpen, DB, idb } from './db.js';

describe('migración de rutina a secuencia (DB.ver 1 -> 2)', () => {
  beforeEach(() => { DB.db = null; DB.ver = 1; indexedDB.deleteDatabase(DB.name); });

  it('convierte un routine viejo por weekday a una secuencia ordenada con descansos en los huecos', async () => {
    // Simula un usuario en ver 1: weekday 1 (lunes) y 3 (miércoles) con ejercicios.
    await idbOpen();
    await idb.put('routine', { weekday: 1, name: 'Anterior A', exercises: [{ id: 'e1', name: 'Press banca', sets: 4, reps: 8 }] });
    await idb.put('routine', { weekday: 3, name: 'Posterior', exercises: [{ id: 'e2', name: 'Remo', sets: 4, reps: 10 }] });
    DB.db.close(); DB.db = null;

    DB.ver = 2;
    await idbOpen();
    const rows = (await idb.all('routine')).sort((a, b) => a.order - b.order);

    // Orden WEEK_ORDER = [1,2,3,4,5,6,0]: lunes(1)=workout, martes(2)=rest,
    // miércoles(3)=workout, jueves..domingo=rest.
    expect(rows.map(r => r.type)).toEqual(['workout', 'rest', 'workout', 'rest', 'rest', 'rest', 'rest']);
    expect(rows[0].name).toBe('Anterior A');
    expect(rows[0].exercises).toEqual([{ id: 'e1', name: 'Press banca', sets: 4, reps: 8 }]);
    expect(rows[2].name).toBe('Posterior');
    rows.forEach(r => expect(typeof r.id).toBe('string'));
  });

  it('un routine viejo vacío (usuario sin rutina) migra a 7 descansos sin romper', async () => {
    await idbOpen();
    DB.db.close(); DB.db = null;
    DB.ver = 2;
    await idbOpen();
    const rows = await idb.all('routine');
    expect(rows.length).toBe(7);
    expect(rows.every(r => r.type === 'rest')).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd web && npx vitest run src/lib/db.test.js`
Expected: FAIL — `DB.ver` sigue en 1, `onupgradeneeded` no migra nada, `r.order`/`r.type` son `undefined`.

- [ ] **Step 3: Implementar la migración en `db.js`**

```js
// web/src/lib/db.js
export const DB = { name: 'fierro', ver: 2, db: null };
export const STORES = ['routine', 'sessions', 'meals', 'foods', 'body', 'settings'];

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB.name, DB.ver);
    r.onupgradeneeded = (ev) => {
      const db = r.result;
      const tx = ev.target.transaction;
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meals')) db.createObjectStore('meals', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('foods')) db.createObjectStore('foods', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('body')) db.createObjectStore('body', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });

      if (ev.oldVersion < 2) {
        // Migración routine: weekday -> secuencia ordenada.
        const migrate = (oldRows) => {
          if (db.objectStoreNames.contains('routine')) db.deleteObjectStore('routine');
          const store = db.createObjectStore('routine', { keyPath: 'order' });
          const byWd = new Map(oldRows.map(r => [r.weekday, r]));
          WEEK_ORDER.forEach((wd, i) => {
            const old = byWd.get(wd);
            const hasWorkout = old?.exercises?.length;
            store.put(hasWorkout
              ? { id: uid(), order: i, type: 'workout', name: old.name || '', exercises: old.exercises }
              : { id: uid(), order: i, type: 'rest' });
          });
        };
        if (db.objectStoreNames.contains('routine')) {
          const req = tx.objectStore('routine').getAll();
          req.onsuccess = () => migrate(req.result || []);
        } else {
          migrate([]);
        }
      } else if (!db.objectStoreNames.contains('routine')) {
        db.createObjectStore('routine', { keyPath: 'order' });
      }
    };
    r.onsuccess = () => { DB.db = r.result; res(); };
    r.onerror = () => rej(r.error);
  });
}

export const idb = {
  all: st => new Promise((res, rej) => { const q = DB.db.transaction(st).objectStore(st).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }),
  put: (st, v) => new Promise((res, rej) => { const t = DB.db.transaction(st, 'readwrite'); t.objectStore(st).put(v); t.oncomplete = res; t.onerror = () => rej(t.error); }),
  del: (st, k) => new Promise((res, rej) => { const t = DB.db.transaction(st, 'readwrite'); t.objectStore(st).delete(k); t.oncomplete = res; t.onerror = () => rej(t.error); }),
  clear: st => new Promise((res, rej) => { const t = DB.db.transaction(st, 'readwrite'); t.objectStore(st).clear(); t.oncomplete = res; t.onerror = () => rej(t.error); }),
};

let openPromise = null;
export function idbOpenOnce() {
  if (!openPromise) openPromise = idbOpen();
  return openPromise;
}
```

Nota: `uid()` se duplica acá en vez de importar `lib/format.js` a
propósito — `db.js` es la capa más baja de la app (todo lo demás la
importa a ella) y no al revés; importar `format.js` desde acá crearía un
ciclo. Es la misma función (`Math.random...+Date.now...`), sólo copiada.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd web && npx vitest run src/lib/db.test.js`
Expected: PASS. Si `fake-indexeddb` no está instalado: `cd web && npm install -D fake-indexeddb`.

- [ ] **Step 5: Actualizar `state.js`**

```js
// web/src/lib/state.js — reemplaza la línea `routine: {}`
export const S = {
  routine: [],   // [{id, order, type:'workout'|'rest', name?, exercises?}]
  sessions: [],
  meals: [], foods: [], body: [],
  cfg: {
    unit: 'kg', rest: 90, goals: { kcal: 2600, p: 160, c: 280, f: 80 }, goalsAuto: false,
    seqIndex: 0,        // posición pendiente en S.routine
    seqIndexDate: null, // 'YYYY-MM-DD': desde cuándo seqIndex está en este valor
    profile: { sex: 'm', age: null, height: null, weightKg: null, activity: 'moderate', goal: 'deficit_mod', tdeeEmpirical: null, proteinPref: 0.5, fatPref: 0.5 },
  },
  draft: null,
  tab: 'inicio',
  hoyVals: {},
  // hoyDay / hoyOrder / dayFx / rutOpen(por weekday) / dayDrop se eliminan
  // acá — reemplazados en las tasks siguientes por sus equivalentes de
  // secuencia (S.rutOpen pasa a ser un índice o null, ver Task 9).
  rutOpen: null,
  rutMode: 'view',
  lib: [],
  nutriDate: dstr(),
  foodEdit: false,
  histOpen: false,
  progEx: null,
  progRange: 'all',
  progTab: 'carga',
  ready: false,
  sheet: null,
  sessionComplete: null,
};
```

Y `loadAll()`:

```js
export async function loadAll() {
  const [rt, ss, ms, fs, bd, st] = await Promise.all(STORES.map(s => idb.all(s)));
  S.routine = rt.sort((a, b) => a.order - b.order);
  S.sessions = ss.sort((a, b) => b.start - a.start);
  S.meals = ms; S.foods = fs;
  S.body = bd.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  st.forEach(kv => {
    if (kv.key === 'cfg') S.cfg = { ...S.cfg, ...kv.value, goals: { ...S.cfg.goals, ...(kv.value.goals || {}) }, profile: { ...S.cfg.profile, ...(kv.value.profile || {}) } };
    if (kv.key === 'draft') S.draft = kv.value;
    if (kv.key === 'lib') S.lib = kv.value || [];
  });
  S.ready = true;
}
```

(Se quita `if (S.draft) S.hoyDay = S.draft.weekday;` — `S.hoyDay` deja de existir, ver Task 4.)

- [ ] **Step 6: Test suite y lint**

```bash
cd web && npx vitest run && npm run lint
```

Esperado: el resto de la suite falla en cascada (todo lo que lee
`S.routine[wd]` como objeto) — eso es correcto en esta task, se arregla
en las Tasks 2-9. Confirmar específicamente que `db.test.js` pasa.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/db.js web/src/lib/state.js web/src/lib/db.test.js web/package.json web/package-lock.json
git commit -m "feat(rutina-secuencia): modelo de datos y migración de IndexedDB a secuencia ordenada"
```

---

### Task 2: `rutina-logic.js` — núcleo reescrito para secuencia

**Files:**
- Modify: `web/src/lib/rutina-logic.js`
- Test: `web/src/lib/rutina-logic.test.js`

**Interfaces:**
- Consumes: `S.routine` (array, Task 1).
- Produces: `ensureSlot(index)`, `persistSlot(index)`, `slotIsWorkout(index)`, `reorderSeq(fromIndex,toIndex)`, `insertWorkout(atIndex)`, `insertRest(atIndex)`, `removeSlot(index)`, `saveSlot(index,{name})`, `saveExercise(index,exId,{...})`, `deleteExercise(index,exId)`, `moveEx(index,exId,dir)`, `routineStats()`, `routineName()`, `hasOpenSession(index)`. Usadas por Task 3 (biblioteca), Task 4 (session.js), Task 6/9 (UI).

- [ ] **Step 1: Escribir los tests que fijan el comportamiento nuevo**

```js
// web/src/lib/rutina-logic.test.js (agregar a los tests existentes del archivo si ya hay,
// o crearlo si no existe — cubre sólo las funciones reescritas)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from './state.js';
import { ensureSlot, reorderSeq, insertWorkout, insertRest, removeSlot, routineStats, routineName } from './rutina-logic.js';

vi.mock('./db.js', () => ({ idb: { put: vi.fn(), clear: vi.fn(), del: vi.fn(), all: vi.fn() } }));

describe('rutina-logic — secuencia', () => {
  beforeEach(() => {
    S.routine = [
      { id: 'a', order: 0, type: 'workout', name: 'Anterior A', exercises: [{ id: 'e1', name: 'Press', sets: 4, reps: 8 }] },
      { id: 'b', order: 1, type: 'workout', name: 'Posterior', exercises: [{ id: 'e2', name: 'Remo', sets: 4, reps: 10 }] },
      { id: 'c', order: 2, type: 'rest' },
    ];
    S.cfg.routineName = '';
  });

  it('reorderSeq mueve un turno de una posición a otra y reindexa order', () => {
    reorderSeq(0, 2); // Anterior A pasa al final
    expect(S.routine.map(s => s.id)).toEqual(['b', 'c', 'a']);
    expect(S.routine.map(s => s.order)).toEqual([0, 1, 2]);
  });

  it('insertWorkout agrega un turno vacío tipo workout en la posición dada', () => {
    insertWorkout(1);
    expect(S.routine[1].type).toBe('workout');
    expect(S.routine[1].exercises).toEqual([]);
    expect(S.routine.map(s => s.order)).toEqual([0, 1, 2, 3]);
  });

  it('insertRest agrega un descanso en la posición dada', () => {
    insertRest(0);
    expect(S.routine[0].type).toBe('rest');
    expect(S.routine.length).toBe(4);
  });

  it('removeSlot saca el turno y reindexa', () => {
    removeSlot(1);
    expect(S.routine.map(s => s.id)).toEqual(['a', 'c']);
    expect(S.routine.map(s => s.order)).toEqual([0, 1]);
  });

  it('ensureSlot crea un turno workout vacío si el índice no existe todavía', () => {
    const s = ensureSlot(5);
    expect(s.type).toBe('workout');
    expect(S.routine[5]).toBe(s);
  });

  it('routineStats cuenta turnos workout/rest y totales de ejercicios/series', () => {
    const st = routineStats();
    expect(st.workoutCount).toBe(2);
    expect(st.restCount).toBe(1);
    expect(st.ex).toBe(2);
    expect(st.sets).toBe(8);
  });

  it('routineName usa S.cfg.routineName o cae a un default según si hay turnos workout', () => {
    expect(routineName()).toBe('Rutina personalizada');
    S.routine = [{ id: 'x', order: 0, type: 'rest' }];
    expect(routineName()).toBe('Sin rutina');
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd web && npx vitest run src/lib/rutina-logic.test.js`
Expected: FAIL — las funciones nuevas no existen todavía.

- [ ] **Step 3: Reescribir el núcleo de `rutina-logic.js`**

Reemplazar por completo el bloque `dayIsFree` → `saveDay` (líneas 258-460
del archivo actual: `dayIsFree`, `nextFreeDay`, `setDayFx`/`S.dayFx`,
`applyDayDrop`, `previewDayDrop`, `dropDayOn`, `ensureDay`, `persistDay`,
`enterEditMode`/`exitEditMode`/`editDay`/`toggleDayOpen`/`deleteDay`/`saveDay`)
por:

```js
export function ensureSlot(index) {
  if (!S.routine[index]) {
    // Rellena huecos intermedios con descanso si insertás más allá del final.
    for (let i = S.routine.length; i < index; i++) S.routine[i] = { id: uid(), order: i, type: 'rest' };
    S.routine[index] = { id: uid(), order: index, type: 'workout', name: '', exercises: [] };
  }
  return S.routine[index];
}
export async function persistSlot(index) { await idb.put('routine', S.routine[index]); }
export function slotIsWorkout(index) { return S.routine[index]?.type === 'workout'; }

async function persistAll() {
  await idb.clear('routine');
  await Promise.all(S.routine.map(s => idb.put('routine', s)));
}

function reindex() { S.routine.forEach((s, i) => { s.order = i; }); }

/** Mueve un turno de `fromIndex` a `toIndex` (mismo mecanismo que reordenar
    ejercicios: splice + reindex). No hay colisión que resolver — a
    diferencia del modelo viejo (7 casilleros fijos por weekday), acá
    insertar en una posición simplemente corre lo demás un lugar. */
export async function reorderSeq(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  const [m] = S.routine.splice(fromIndex, 1);
  S.routine.splice(toIndex, 0, m);
  reindex();
  pushHistory('Secuencia reordenada');
  await persistAll();
  bump();
}

export async function insertWorkout(atIndex) {
  S.routine.splice(atIndex, 0, { id: uid(), order: atIndex, type: 'workout', name: '', exercises: [] });
  reindex();
  pushHistory('Entrenamiento agregado');
  await persistAll();
  bump();
}

export async function insertRest(atIndex) {
  S.routine.splice(atIndex, 0, { id: uid(), order: atIndex, type: 'rest' });
  reindex();
  pushHistory('Descanso agregado');
  await persistAll();
  bump();
}

export async function removeSlot(index) {
  if (hasOpenSession(index)) { toast('Hay una sesión abierta en este turno — terminala o descartala primero'); return; }
  pushHistory('Turno eliminado');
  S.routine.splice(index, 1);
  reindex();
  // Si el turno pendiente estaba en o después del que se borró, el puntero
  // se corre para seguir apuntando al mismo contenido relativo.
  if (S.cfg.seqIndex > index) S.cfg.seqIndex--;
  else if (S.cfg.seqIndex >= S.routine.length) S.cfg.seqIndex = Math.max(0, S.routine.length - 1);
  await Promise.all([persistAll(), saveCfg()]);
  bump();
}

/** ¿Hay una sesión en curso en este turno? Comparado por `id` del turno
    (estable), no por índice: si reordenás mientras hay una sesión abierta,
    sigue detectándola correctamente. */
export function hasOpenSession(index) { return !!S.draft && S.draft.slotId === S.routine[index]?.id; }

export async function saveSlot(index, { name }) {
  ensureSlot(index).name = (name || '').trim();
  await persistSlot(index);
  closeSheet();
  bump();
}

export async function saveExercise(index, exId, { name, sets, reps, equip, machine, photo, illus, cat, unilateral }) {
  name = (name || '').trim();
  const s = Math.max(1, parseInt(sets) || 4);
  const r = Math.max(1, parseInt(reps) || 10);
  if (!name) { toast('Ponle nombre al ejercicio'); return; }
  const d = ensureSlot(index);
  if (exId) {
    const ex = d.exercises.find(e => e.id === exId);
    if (ex) {
      ex.name = name; ex.sets = s; ex.reps = r;
      ex.equip = equip || undefined;
      ex.machine = equip && machine ? machine.trim() : undefined;
      ex.photo = equip && photo ? photo : undefined;
      ex.illus = illus || undefined;
      ex.cat = cat || undefined;
      ex.unilateral = unilateral || undefined;
    }
  } else {
    d.exercises.push({
      id: uid(), name, sets: s, reps: r,
      equip: equip || undefined,
      machine: equip && machine ? machine.trim() : undefined,
      photo: equip && photo ? photo : undefined,
      illus: illus || undefined,
      cat: cat || undefined,
      unilateral: unilateral || undefined,
    });
  }
  await persistSlot(index);
  closeSheet(); bump(); toast('Guardado');
}

export async function deleteExercise(index, exId) {
  const d = S.routine[index];
  const ex = d.exercises.find(e => e.id === exId);
  if (!ex) return;
  pushHistory(`"${ex.name}" eliminado`);
  d.exercises = d.exercises.filter(e => e.id !== exId);
  await persistSlot(index);
  bump();
}

export async function moveEx(index, exId, dir) {
  const d = S.routine[index];
  const i = d.exercises.findIndex(e => e.id === exId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= d.exercises.length) return;
  pushHistory('Ejercicios reordenados');
  [d.exercises[i], d.exercises[j]] = [d.exercises[j], d.exercises[i]];
  await persistSlot(index);
}

export function enterEditMode() { S.rutMode = 'edit'; bump(); scrollTo({ top: 0, behavior: 'instant' }); }
export function exitEditMode() { S.rutMode = 'view'; clearHistory(); bump(); scrollTo({ top: 0, behavior: 'instant' }); }
export function editSlot(index) { S.rutMode = 'edit'; S.rutOpen = index; closeSheet(); bump(); scrollTo({ top: 0, behavior: 'instant' }); }
export function toggleSlotOpen(index) { S.rutOpen = S.rutOpen === index ? null : index; bump(); }
```

`S.cfg.dayDrop` (la preferencia `'ask'|'shift'|'swap'`) se elimina del
default en `state.js` (Task 1 ya no la incluye) — si `saveCfg()` la trae
puesta de una sesión IndexedDB vieja no rompe nada (queda como campo
suelto sin uso), no hace falta migrarla explícitamente.

- [ ] **Step 4: Actualizar el resto de funciones del archivo a array**

Estas cuatro cambian su forma de recorrer `S.routine` (de
`Object.values`/`WEEK_ORDER.map` a iterar el array directo) pero
conservan su lógica:

```js
export function routineStats() {
  const workouts = S.routine.filter(s => s.type === 'workout' && s.exercises?.length);
  const rest = S.routine.filter(s => s.type === 'rest');
  const ex = workouts.reduce((a, s) => a + s.exercises.length, 0);
  const sets = workouts.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets, 0), 0);
  return { workouts, workoutCount: workouts.length, restCount: rest.length, ex, sets };
}
export function routineName() { return S.cfg.routineName || (routineStats().workoutCount ? 'Rutina personalizada' : 'Sin rutina'); }
```

`activeDayWds()` se elimina (ya no hace falta: `Rutina.jsx` recorre
`S.routine` directo, ver Task 9).

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `cd web && npx vitest run src/lib/rutina-logic.test.js`
Expected: PASS.

- [ ] **Step 6: Test suite completa y lint**

```bash
cd web && npx vitest run && npm run lint
```

Esperado: `Rutina.jsx`/`DayEdit.jsx`/`session.js`/etc. siguen rotos hasta
las Tasks 3-9 (importan funciones que ya no existen) — normal en esta
task. Confirmar que `rutina-logic.test.js` y `db.test.js` pasan.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/rutina-logic.js web/src/lib/rutina-logic.test.js
git commit -m "feat(rutina-secuencia): núcleo de rutina-logic.js reescrito para secuencia (elimina la máquina de colisiones día-contra-día)"
```

---

### Task 3: Biblioteca "Mis rutinas" y copiar ejercicios entre turnos

**Files:**
- Modify: `web/src/lib/rutina-logic.js` (funciones de biblioteca y copiado)
- Modify: `web/src/lib/templates.js` (ver Task 6 — comparten `applyDays`)

**Interfaces:**
- Consumes: `S.lib`, `S.routine` (Task 2).
- Produces: `routineSnapshot()`, `applyDays(seq, name)`, `copySourceExercises(src)`, `copyExercises(src, toIndex, ids, mode)`, `saveCurrentAsLib(name)`, `applyLibRoutine(id)`, `deleteLibRoutine(id)`.

- [ ] **Step 1: Reescribir `routineSnapshot`/`applyDays` para secuencia**

Antes guardaban/cargaban un mapa `{weekday: {name,exercises}}`; ahora
guardan/cargan el array completo (sin `id`s propios — se regeneran al
aplicar, igual que antes):

```js
export function routineSnapshot() {
  return S.routine.map(s => s.type === 'rest'
    ? { type: 'rest' }
    : {
        type: 'workout',
        name: s.name || '',
        exercises: (s.exercises || []).map(e => ({
          name: e.name, sets: e.sets, reps: e.reps,
          equip: e.equip, machine: e.machine, illus: e.illus, cat: e.cat, unilateral: e.unilateral,
        })),
      });
}

export async function applyDays(seq, name) {
  await idb.clear('routine');
  S.routine = seq.map((s, i) => s.type === 'rest'
    ? { id: uid(), order: i, type: 'rest' }
    : {
        id: uid(), order: i, type: 'workout', name: s.name,
        exercises: s.exercises.map(e => ({
          id: uid(), name: e.name, sets: e.sets, reps: e.reps,
          equip: e.equip || undefined, machine: e.machine || undefined, illus: e.illus || undefined,
          cat: e.cat || undefined, unilateral: e.unilateral || undefined,
        })),
      });
  await persistAll();
  S.cfg.routineName = name;
  S.cfg.seqIndex = 0; S.cfg.seqIndexDate = null;
  await saveCfg();
}
```

`saveCurrentAsLib(name)`/`applyLibRoutine(id)`/`deleteLibRoutine(id)` no
cambian de lógica (ya llaman a `routineSnapshot()`/`applyDays()`), sólo
hace falta actualizar la línea de `applyLibRoutine` que fija
`S.rutOpen = routineStats().days[0] ?? new Date().getDay()` (ese campo
`days` ya no existe, ver `routineStats()` de Task 2) a
`S.rutOpen = 0`.

- [ ] **Step 2: Reescribir `copySourceExercises`/`copyExercises` por índice**

```js
export function copySourceExercises(src) {
  if (src?.libId != null) {
    const r = S.lib.find(x => x.id === src.libId);
    return r?.days?.[src.libIndex]?.exercises || [];
  }
  return S.routine[+src?.fromIndex]?.exercises || [];
}
function copySourceName(src) {
  if (src?.libId != null) {
    const r = S.lib.find(x => x.id === src.libId);
    return r?.days?.[src.libIndex]?.name || '';
  }
  return S.routine[+src?.fromIndex]?.name || '';
}
export async function copyExercises(src, toIndex, ids, mode = 'merge') {
  const to = +toIndex;
  if (src?.libId == null && +src?.fromIndex === to) return;
  const elegidos = copySourceExercises(src).filter(e => ids.includes(e.id ?? e.name));
  if (!elegidos.length) return;
  const destino = ensureSlot(to);
  const existentes = mode === 'replace' ? [] : (destino.exercises || []);
  const yaHay = new Set(existentes.map(exKey));
  const nuevos = elegidos.filter(e => mode === 'replace' || !yaHay.has(exKey(e))).map(cloneExercise);
  if (!nuevos.length && mode === 'merge') { toast('Ese turno ya tiene todos esos ejercicios'); return; }
  pushHistory(mode === 'replace' ? `Turno reemplazado con ${nuevos.length} ejercicio${nuevos.length === 1 ? '' : 's'}` : `${nuevos.length} ejercicio${nuevos.length === 1 ? '' : 's'} copiado${nuevos.length === 1 ? '' : 's'}`);
  destino.exercises = [...existentes, ...nuevos];
  if (!destino.name) destino.name = copySourceName(src);
  await persistSlot(to);
  bump();
}
```

(`cloneExercise` no cambia — ya es agnóstico de weekday, ver archivo
actual líneas 95-108.)

- [ ] **Step 3: Actualizar `CopyExercises.jsx`**

`web/src/components/sheets/CopyExercises.jsx` pasa `wd`/`fromWd`/`toWd`
como props — renombrar a `index`/`fromIndex`/`toIndex` en las llamadas a
`copySourceExercises`/`copyExercises`, y su lista de turnos-destino pasa
de `WEEK_ORDER.map(wd => ...)` a `S.routine.map((s,i) => ...)` mostrando
`s.name || 'Descanso'` en vez de `WD[wd]`.

- [ ] **Step 4: Test suite y lint**

```bash
cd web && npx vitest run && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/rutina-logic.js web/src/components/sheets/CopyExercises.jsx
git commit -m "feat(rutina-secuencia): biblioteca de rutinas y copiar ejercicios adaptados a secuencia"
```

---

### Task 4: `session.js` — sesiones por `slotId`, avance del puntero

**Files:**
- Modify: `web/src/lib/session.js`
- Test: `web/src/lib/session.test.js`

**Interfaces:**
- Consumes: `S.routine`, `S.cfg.seqIndex` (Task 1/2).
- Produces: `startSession(index)`, `completeSession()` (avanza `seqIndex`), `sessionForSlot(slotId)`, `pendingSlot()`.

- [ ] **Step 1: Escribir los tests que fijan el avance del puntero**

```js
// agregar a web/src/lib/session.test.js (o crearlo si no existe)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from './state.js';

vi.mock('./db.js', () => ({ idb: { put: vi.fn(), del: vi.fn() } }));
vi.mock('./rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn() }));
vi.mock('./alarm.js', () => ({ pedirPermiso: vi.fn() }));
vi.mock('./carousel.js', () => ({ scrollCarouselTo: vi.fn() }));

import { startSession, completeSession, pendingSlot } from './session.js';

describe('session.js — secuencia', () => {
  beforeEach(() => {
    S.routine = [
      { id: 'a', order: 0, type: 'workout', name: 'Anterior A', exercises: [{ id: 'e1', name: 'Press', sets: 1, reps: 8 }] },
      { id: 'b', order: 1, type: 'rest' },
      { id: 'c', order: 2, type: 'workout', name: 'Posterior', exercises: [{ id: 'e2', name: 'Remo', sets: 1, reps: 8 }] },
    ];
    S.cfg.seqIndex = 0; S.cfg.seqIndexDate = null;
    S.draft = null; S.sessions = [];
  });

  it('startSession abre el draft con slotId (no weekday)', async () => {
    await startSession(0);
    expect(S.draft.slotId).toBe('a');
    expect(S.draft.dayName).toBe('Anterior A');
  });

  it('completeSession avanza seqIndex al turno siguiente', async () => {
    await startSession(0);
    S.draft.entries['e1'] = { name: 'Press', sets: [{ w: 50, r: 8, t: Date.now() }] };
    await completeSession();
    expect(S.cfg.seqIndex).toBe(1); // pasa al descanso
  });

  it('pendingSlot() devuelve el turno en seqIndex', () => {
    S.cfg.seqIndex = 2;
    expect(pendingSlot().id).toBe('c');
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd web && npx vitest run src/lib/session.test.js`
Expected: FAIL.

- [ ] **Step 3: Reescribir las funciones de `session.js`**

```js
// orderedExs: firma cambia de (wd, exs) a (index, exs)
export function orderedExs(index, exs) {
  const slotId = S.routine[index]?.id;
  const ord = (S.draft && S.draft.slotId === slotId) ? S.draft.order : S.hoyOrder?.[slotId];
  if (!ord || !ord.length) return exs;
  const by = new Map(exs.map(e => [e.id, e]));
  const out = [];
  ord.forEach(id => { if (by.has(id)) { out.push(by.get(id)); by.delete(id); } });
  by.forEach(e => out.push(e));
  return out;
}

export async function setExOrder(index, ids) {
  const slotId = S.routine[index]?.id;
  if (S.draft && S.draft.slotId === slotId) { S.draft.order = ids; await saveDraft(); }
  else { S.hoyOrder = S.hoyOrder || {}; S.hoyOrder[slotId] = ids; }
}

/** El turno pendiente según el puntero de la secuencia. */
export function pendingSlot() { return S.routine[S.cfg.seqIndex] || null; }

export function sessionForSlot(slotId) {
  const ws = weekStart();
  return S.sessions.find(s => s.slotId === slotId && s.date >= ws) || null;
}

export function sessionExs(index) {
  const slot = S.routine[index];
  const cambiados = S.draft?.replaced || {};
  const todos = [...(slot?.exercises || []), ...(S.draft?.extras || [])].filter(e => !cambiados[e.id]);
  const ord = S.draft?.order;
  if (!ord?.length) return todos;
  const by = new Map(todos.map(e => [e.id, e]));
  const out = [];
  ord.forEach(id => { if (by.has(id)) { out.push(by.get(id)); by.delete(id); } });
  by.forEach(e => out.push(e));
  return out;
}

export async function startSession(index) {
  const slot = S.routine[index];
  if (!slot?.exercises?.length) { toast('Este turno no tiene ejercicios'); return; }
  pedirPermiso();
  S.draft = {
    id: uid(), date: dstr(), slotId: slot.id, dayName: slot.name || 'Entrenamiento', open: Date.now(), start: null, cur: null,
    order: orderedExs(index, slot.exercises).map(e => e.id), entries: {},
    skipped: [], extraSets: {}, extras: [],
  };
  await saveDraft();
  closeSheet();
  vibrate(15);
  bump();
  toast('Sesión abierta · tocá "Iniciar ejercicio" cuando estés en la máquina');
}

export async function completeSession() {
  if (!S.draft) return;
  const d = S.draft;
  const slot = S.routine.find(s => s.id === d.slotId);
  const order = (d.order && d.order.length) ? d.order : (slot?.exercises || []).map(e => e.id);
  const entries = Object.entries(d.entries)
    .sort((a, b) => { const ia = order.indexOf(a[0]), ib = order.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); })
    .map(([exId, e]) => ({ exId, name: e.name, equip: e.equip, machine: e.machine, cat: e.cat, unilateral: e.unilateral, sets: e.sets }));
  if (!entries.length) { toast('No registraste ninguna serie. Usá "Descartar" para cerrar la sesión.'); return; }
  const startAt = d.start || d.open || Date.now();
  const todos = sessionExs(S.routine.findIndex(s => s.id === d.slotId));
  const skipped = (d.skipped || []).map(id => todos.find(e => e.id === id)).filter(Boolean).map(e => ({ name: e.name, equip: e.equip, machine: e.machine }));
  const added = (d.extras || []).filter(e => d.entries[e.id]?.sets?.length).map(e => ({ name: e.name, sets: e.sets, reps: e.reps, equip: e.equip, machine: e.machine, unilateral: e.unilateral }));

  const sess = {
    id: d.id, date: d.date, slotId: d.slotId, dayName: d.dayName,
    start: startAt, end: Date.now(), duration: Math.max(1, Math.round((Date.now() - startAt) / 60000)), entries,
    ...(skipped.length ? { skipped } : {}),
    ...(added.length ? { added } : {}),
  };
  await idb.put('sessions', sess);
  S.sessions.unshift(sess);
  const prs = sessionPRs(sess);
  S.draft = null;

  // Avanza el puntero al turno siguiente al que se acaba de completar,
  // buscando por id (no por índice guardado): si reordenaste la secuencia
  // mientras entrenabas, esto sigue apuntando al lugar correcto.
  const finishedAt = S.routine.findIndex(s => s.id === d.slotId);
  S.cfg.seqIndex = finishedAt >= 0 ? (finishedAt + 1) % Math.max(1, S.routine.length) : S.cfg.seqIndex;
  S.cfg.seqIndexDate = dstr();
  await Promise.all([saveDraft(), saveCfg()]);

  stopRest();
  vibrate([30, 50, 30]);
  S.sessionComplete = { ...sess, huboPR: prs.length > 0 };
  bump();
}

export async function discardSession() {
  S.draft = null;
  await saveDraft();
  stopRest();
  bump();
}
```

`findEx(exId)` cambia su recorrido de `Object.values(S.routine)` a
`S.routine` directo:

```js
function findEx(exId) {
  const extra = (S.draft?.extras || []).find(x => x.id === exId);
  if (extra) return extra;
  for (const slot of S.routine) {
    const e = (slot.exercises || []).find(x => x.id === exId);
    if (e) return e;
  }
  return null;
}
```

`saveSet()` cambia su única línea que arma un draft nuevo "por las
dudas" (caso borde, normalmente `S.draft` ya existe por `startSession`):
reemplazar `const wd = currentDayForHoy(); ... weekday: wd, dayName:
S.routine[wd]?.name || WD[wd]` por usar `pendingSlot()` (`slotId:
pendingSlot()?.id, dayName: pendingSlot()?.name`). `currentDayForHoy()`
se elimina (ver Task 6, ya no hay noción de "día elegido").

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd web && npx vitest run src/lib/session.test.js`
Expected: PASS.

- [ ] **Step 5: Test suite completa y lint**

```bash
cd web && npx vitest run && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/session.js web/src/lib/session.test.js
git commit -m "feat(rutina-secuencia): sesiones referenciadas por slotId, avance de seqIndex al completar"
```

---

### Task 5: `streak.js` — racha por turno pendiente

**Files:**
- Modify: `web/src/lib/streak.js`
- Test: `web/src/lib/streak.test.js`

**Interfaces:**
- Consumes: `S.routine`, `S.cfg.seqIndex`/`seqIndexDate`, `S.sessions` (con `slotId`, Task 4).
- Produces: `dayCompleted(dateStr)`, `currentStreak()`, `bestStreak()`, `streakHeatmap()` — mismas firmas públicas, comportamiento adaptado.

**Nota de diseño (del spec):** esta reconstrucción sólo es válida desde
la fecha de la migración en adelante — no se recalcula con el modelo
nuevo el historial de antes.

- [ ] **Step 1: Escribir los tests**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { S } from './state.js';
import { dayCompleted, currentStreak } from './streak.js';

describe('streak.js — secuencia', () => {
  beforeEach(() => {
    S.routine = [
      { id: 'a', order: 0, type: 'workout', name: 'A', exercises: [{ id: 'e1', name: 'X', sets: 1, reps: 1 }] },
      { id: 'b', order: 1, type: 'rest' },
    ];
    S.sessions = [];
  });

  it('un turno de descanso no cuenta ni corta (null)', () => {
    // seqIndex apunta al descanso en la fecha dada
    S.cfg.seqIndex = 1; S.cfg.seqIndexDate = '2026-08-10';
    expect(dayCompleted('2026-08-10')).toBeNull();
  });

  it('un turno de entrenamiento sin sesión ese día corta (false)', () => {
    S.cfg.seqIndex = 0; S.cfg.seqIndexDate = '2026-08-10';
    expect(dayCompleted('2026-08-10')).toBe(false);
  });

  it('un turno de entrenamiento con sesión guardada ese día cumple (true)', () => {
    S.cfg.seqIndex = 0; S.cfg.seqIndexDate = '2026-08-10';
    S.sessions = [{ id: 's1', date: '2026-08-10', slotId: 'a' }];
    expect(dayCompleted('2026-08-10')).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd web && npx vitest run src/lib/streak.test.js`

- [ ] **Step 3: Reescribir `dayCompleted`**

```js
/** Un día "cumplido" mira qué turno de la secuencia estaba pendiente esa
    fecha (aproximado por S.cfg.seqIndexDate: el turno vigente cuando
    seqIndex cambió por última vez) — si es descanso, no cuenta ni corta;
    si es entrenamiento, cumple si hay una sesión de ESE turno esa fecha. */
export function dayCompleted(dateStr) {
  // Sólo se puede evaluar con precisión el turno vigente ahora mismo (no
  // se reconstruye el puntero histórico completo — ver nota de diseño).
  // Para `dateStr === S.cfg.seqIndexDate` (el día en que el puntero quedó
  // en su valor actual) esto es exacto; para fechas más viejas se usa la
  // misma aproximación, consistente con "sólo aplica desde la migración".
  const slot = S.routine[S.cfg.seqIndex];
  if (!slot || slot.type === 'rest') return null;
  return S.sessions.some(s => s.slotId === slot.id && s.date === dateStr);
}
```

`currentStreak()`, `bestStreak()`, `streakHeatmap()` no cambian de
lógica — siguen llamando `dayCompleted(ds)` día por día y contando según
`null`/`true`/`false` exactamente como hoy (ver archivo actual líneas
13-55). Sólo se les quita el guard inicial `if
(!Object.values(S.routine).some(...))` de `currentStreak()`, que pasa a:
`if (!S.routine.some(s => s.type === 'workout' && s.exercises?.length))
return 0;`.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd web && npx vitest run src/lib/streak.test.js`

- [ ] **Step 5: Test suite completa y lint**

```bash
cd web && npx vitest run && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/streak.js web/src/lib/streak.test.js
git commit -m "feat(rutina-secuencia): racha adaptada al turno pendiente de la secuencia"
```

---

### Task 6: `templates.js` — plantillas como secuencias

**Files:**
- Modify: `web/src/lib/templates.js`

**Interfaces:**
- Consumes: `applyDays` (Task 3).
- Produces: `TEMPLATES` con `secuencia` en vez de `split`, `applyTemplate(id)` sin cambios de firma.

- [ ] **Step 1: Convertir `TEMPLATES` de `split:{weekday:[...]}` a `secuencia:[...]`**

Cada plantilla pasa su `split` (mapa por weekday) a un array en el orden
natural del split, con descansos donde correspondía. Ejemplo completo
para `antpost` (las demás siguen el mismo patrón mecánico: tomar las
claves de `split` en orden ascendente y convertir cada `[nombre,
ejercicios]` a `{type:'workout', name, exercises: ejercicios.map(...)}`,
sin agregar descansos explícitos entre ellas — la plantilla es la
secuencia de entrenamiento pura, sin días de descanso fijos, ya que en
este modelo el usuario agrega los descansos que quiera con "+
Descanso" después de aplicarla):

```js
{ id: 'antpost', name: 'Anterior / Posterior', days: '4 días/sem', who: 'empujadores vs traccionadores', freq: 'cada grupo 2×/sem',
  secuencia: [
    ['Anterior A', [['Press banca', 4, 8], ['Press militar', 3, 10], ['Sentadilla', 4, 8], ['Elevaciones laterales', 3, 15], ['Extensión tríceps polea', 3, 12]]],
    ['Posterior A', [['Dominadas', 4, 8], ['Remo con barra', 4, 10], ['Peso muerto rumano', 4, 10], ['Curl con barra', 3, 12], ['Face pull', 3, 15]]],
    ['Anterior B', [['Press inclinado mancuernas', 4, 10], ['Prensa', 4, 12], ['Fondos', 3, 10], ['Extensiones de cuádriceps', 3, 15], ['Overhead extension', 3, 12]]],
    ['Posterior B', [['Jalón al pecho', 4, 10], ['Remo', 4, 12], ['Curl femoral', 4, 12], ['Curl martillo', 3, 12], ['Pájaros', 3, 15]]],
  ] },
```

(Repetir la misma transformación mecánica — tomar los valores de `split`
en el orden en que aparecen sus claves — para `fullbody`, `ul`, `ppl`,
`ppl6`, `hybrid`.)

- [ ] **Step 2: Reescribir `applyTemplate`**

```js
export async function applyTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id); if (!t) return;
  const has = S.routine.some(s => s.type === 'workout' && s.exercises?.length);
  const doApply = async () => {
    const seq = t.secuencia.map(([name, list]) => ({
      type: 'workout', name, exercises: list.map(([n, s, r]) => ({ name: n, sets: s, reps: r })),
    }));
    await applyDays(seq, t.name);
    S.rutOpen = 0;
    S.rutMode = 'view';
    closeSheet(); bump(); vibrate([20, 40, 20]);
    toast(`Plantilla "${t.name}" cargada`);
  };
  if (has) {
    openSheet('confirm', {
      title: '¿Reemplazar tu split?',
      body: `Esto reemplaza tu split actual por "${t.name}". Podés editar todo después.`,
      confirmLabel: 'Reemplazar',
      onConfirm: doApply,
      onCancel: () => openSheet('library'),
    });
  } else {
    await doApply();
  }
}
```

- [ ] **Step 2: Test suite y lint**

```bash
cd web && npx vitest run && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/templates.js
git commit -m "feat(rutina-secuencia): plantillas como secuencias predefinidas"
```

---

### Task 7: `drag.js` — nuevo tipo de arrastre `'seq'` reemplaza `'days'`

**Files:**
- Modify: `web/src/lib/drag.js`

**Interfaces:**
- Consumes: `reorderSeq` (Task 2).
- Produces: `commitSort('seq', null, ids)` reordena `S.routine` completo.

**Contexto:** el modo `'days'` existía porque en el modelo viejo cada
tarjeta ERA un día fijo de la semana — arrastrar movía el CONTENIDO entre
casilleros que nunca cambiaban de posición (`dragPreviewDays`,
`S.dayFx`). En una secuencia no hay casilleros fijos: arrastrar reordena
la lista de verdad, exactamente igual que ya funciona el arrastre de
ejercicios dentro de un turno (`kind==='rut'`). Por eso `'seq'` reutiliza
el camino genérico que ya existe (`dragLayout`/`dragEnd` fuera del
`if (kind==='days')`), y **se borra** el bloque especial de `'days'`.

- [ ] **Step 1: Quitar el import y la rama especial de `'days'`**

En `dragUpdate()`, borrar el bloque `if (DRAG.kind === 'days') { ... return; }`
(líneas 116-139 del archivo actual) — con eso `'seq'` cae directo en el
cálculo genérico de `to` que ya usan `'rut'`/`'hoy'` (líneas 141-144).

En `dragEnd()`, borrar el bloque `if (kind === 'days') { ... return; }`
(líneas 191-201) — `'seq'` cae en el camino genérico que ya arma `ids` vía
splice y llama `commitSort(kind, wd, ids)` (líneas 202-220).

Borrar `dragPreviewDays()` completa (ya no se llama desde ningún lado) y
su import de `previewDayDrop` en la cabecera del archivo. También se
quita `dropDayOn`, `persistDay` de ese mismo import (Task 2 ya no los
exporta) — sólo queda `import { pushHistory } from './rutina-logic.js';`
si `commitSort('rut', ...)` lo sigue necesitando (lo sigue necesitando,
ver Step 2).

- [ ] **Step 2: Agregar la rama `'seq'` en `commitSort`**

```js
// cabecera de drag.js — agregar idb y persistSlot a los imports existentes
import { S, bump } from './state.js';
import { idb } from './db.js';
import { pushHistory, persistSlot } from './rutina-logic.js';

export async function commitSort(kind, wd, ids) {
  if (kind === 'hoy') return setExOrder(S.cfg.seqIndex, ids);
  if (kind === 'seq') {
    const by = new Map(S.routine.map(s => [s.id, s]));
    const out = [];
    ids.forEach(id => { if (by.has(id)) { out.push(by.get(id)); by.delete(id); } });
    by.forEach(s => out.push(s));
    out.forEach((s, i) => { s.order = i; });
    S.routine = out;
    await idb.clear('routine');
    await Promise.all(S.routine.map(s => idb.put('routine', s)));
    return;
  }
  const d = S.routine[+wd];
  if (!d || !d.exercises) return;
  pushHistory('Ejercicios reordenados');
  const by = new Map(d.exercises.map(e => [e.id, e]));
  const out = [];
  ids.forEach(i => { if (by.has(i)) { out.push(by.get(i)); by.delete(i); } });
  by.forEach(e => out.push(e));
  d.exercises = out;
  return persistSlot(+wd);
}
```

Y actualizar `refreshSortArrows`/el resto del archivo: donde decía
`box.dataset.wd` para pasarlo a `commitSort`, en `data-sort="seq"` ese
atributo no existe (no hace falta, `commitSort('seq', ...)` no usa el
segundo parámetro) — queda `undefined`, no rompe nada porque la rama
`'seq'` no lo lee.

- [ ] **Step 3: Test suite y lint**

```bash
cd web && npx vitest run && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/drag.js
git commit -m "refactor(rutina-secuencia): arrastre de turnos reordena de verdad (elimina el modo 'days' de casilleros fijos)"
```

---

### Task 8: Pantalla Hoy — tarjeta "próximo turno" + historial

**Files:**
- Modify: `web/src/components/screens/Hoy.jsx`

**Interfaces:**
- Consumes: `pendingSlot()`, `sessionForSlot()` (Task 4).

- [ ] **Step 1: Quitar la tira de 7 días y el lookup por `S.hoyDay`**

Reemplazar (líneas 40-64 actuales, `useDayDirection` + el arranque de
`Hoy()`):

```js
export default function Hoy() {
  useStore();
  const today = new Date();
  const index = S.cfg.seqIndex;
  const day = S.routine[index];
  const active = !!S.draft;
  const exs = active ? sessionExs(index) : orderedExs(index, day?.exercises || []);
  const started = active && !!S.draft.start;
  const curId = active ? S.draft.cur : null;
  const nextEx = active ? nextPending(exs) : null;
  const allDone = active && exs.length > 0 && !nextEx;
  const exCalentar = active ? (nextEx || exs[0]) : null;
  // ... cerrarCalentamiento/terminarCalentamiento/saltarCalentamiento sin cambios ...
```

- [ ] **Step 2: Reemplazar la tira semanal por la tarjeta "próximo turno" + historial**

Reemplazar el bloque `!active` completo (líneas 117-156 actuales, el
`hero-slot`/`wkstrip`) por:

```jsx
{active ? (
  <ActiveHero day={day} index={index} exs={exs} started={started} allDone={allDone} />
) : day?.type === 'rest' ? (
  <RestHero />
) : (
  <PreSessionHero day={day} index={index} exs={exs} />
)}
<div className="sect">Esta semana</div>
<div className="card">
  <WeekHistory />
</div>
```

`RestHero` (nuevo, informativo, sin botón — el descanso se resuelve solo
al otro día, Task 4 ya avanza `seqIndex` en `completeSession`; falta el
avance automático del descanso, Step 3 de esta task):

```jsx
function RestHero() {
  return (
    <div className="card hero">
      <div className="eyebrow">Hoy</div>
      <div className="hero-day">Descanso</div>
      <div className="txt-mut" style={{ fontSize: 13, marginTop: 6 }}>
        Mañana seguís con el próximo turno de tu rutina.
      </div>
    </div>
  );
}
```

`WeekHistory` (nuevo, reemplaza la tira — lista simple de las sesiones de
los últimos 7 días, sin mostrar días futuros):

```jsx
function WeekHistory() {
  const cutoff = dstr(new Date(Date.now() - 7 * 86400000));
  const recent = S.sessions.filter(s => s.date >= cutoff);
  if (!recent.length) return <div className="txt-mut" style={{ fontSize: 13 }}>Todavía no hay sesiones esta semana.</div>;
  return recent.map(s => (
    <div key={s.id} className="hist-row" onClick={() => openSheet('session-view', { id: s.id })}>
      <span className="t">{s.dayName}</span>
      <span className="s">{fmtDFull(s.date)}</span>
    </div>
  ));
}
```

(`hist-row` es una clase nueva y chica — dos `span` en fila, mismo
patrón que otras filas de lista de la app; agregar a `styles.css` un
`.hist-row{display:flex;justify-content:space-between;padding:8px
0;border-bottom:1px solid var(--line);font-size:14px}` si no hay ya algo
reusable con ese layout.)

`PreSessionHero`/`DoneHero`/`ActiveHero`/`SessStartInfo` cambian su
prop `wd`/`day` por `index`/`day`, y donde llamaban `sessionForWeekday(wd)`
pasan a `sessionForSlot(day.id)`; donde llamaban `startSession(wd)` pasan
a `startSession(index)`; `openSheet('sess-start-info',{wd})` pasa a
`openSheet('sess-start-info',{index})`. El chequeo `wd === today.getDay()`
en `PreSessionHero`/`DoneHero` para decidir "Toca hoy" vs. el nombre del
día se elimina — en la tarjeta "próximo turno" SIEMPRE es "hoy" (ya no
hay otro día que mirar), así que el eyebrow queda fijo en `"Toca hoy"`.

El bloque `!exs.length` (líneas 195-207 actuales, "No hay rutina para
{WD[wd]}") cambia su texto a algo que no mencione un día de la semana:
`<p>Este turno todavía no tiene ejercicios.<br/>Configuralo en la
pestaña Rutina.</p>`.

- [ ] **Step 3: Resolución automática del descanso al otro día**

En `loadAll()` (`state.js`, Task 1) o en el primer render de `Hoy.jsx`
—mejor en `loadAll()`, corre una sola vez al abrir la app y no depende de
que el usuario entre a Hoy—, agregar:

```js
// Al final de loadAll(), después de S.ready = true:
resolveAutoRest();
```

```js
// state.js, nueva función exportada
export function resolveAutoRest() {
  const today = dstr();
  while (S.routine[S.cfg.seqIndex]?.type === 'rest' && S.cfg.seqIndexDate && S.cfg.seqIndexDate < today) {
    S.cfg.seqIndex = (S.cfg.seqIndex + 1) % Math.max(1, S.routine.length);
    S.cfg.seqIndexDate = today;
  }
  if (S.routine.length && !S.cfg.seqIndexDate) S.cfg.seqIndexDate = today;
  saveCfg();
}
```

El `while` (no `if`) cubre el caso de varios descansos seguidos en la
secuencia: los salta todos de una vez hasta el próximo turno de
entrenamiento o hasta dar la vuelta completa (rutina 100% descanso).

- [ ] **Step 4: Verificar en navegador (CDP)**

- Con una rutina de prueba (`[workout, rest, workout]`), completar el
  primer turno y confirmar que Hoy muestra "Descanso" a continuación (no
  el turno 3 todavía).
- Simular que pasó un día (mutar `S.cfg.seqIndexDate` a ayer vía consola
  del navegador + recargar) y confirmar que Hoy ya muestra el turno 3
  ("próximo entrenamiento"), no el descanso.
- Confirmar que el historial de la semana lista sesiones reales, sin
  inventar "días futuros".

- [ ] **Step 5: Test suite y lint**

```bash
cd web && npx vitest run && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add web/src/components/screens/Hoy.jsx web/src/lib/state.js web/src/styles.css
git commit -m "feat(rutina-secuencia): pantalla Hoy muestra el próximo turno de la secuencia, no un día fijo"
```

---

### Task 9: Pantalla Rutina — vista y editor por secuencia

**Files:**
- Modify: `web/src/components/screens/Rutina.jsx`
- Modify: `web/src/components/sheets/DayEdit.jsx` → renombrar a `web/src/components/sheets/SlotEdit.jsx`
- Modify: `web/src/App.jsx` (registro del sheet: `'day-edit'` → `'slot-edit'`)

**Interfaces:**
- Consumes: `reorderSeq`, `insertWorkout`, `insertRest`, `removeSlot`, `toggleSlotOpen`, `saveSlot` (Task 2).

- [ ] **Step 1: `RutinaView` — resumen ya no asume 7 días fijos**

Reemplazar el `weekbars` (7 barras fijas por `WEEK_ORDER`) por barras
sobre `S.routine` directo (largo variable):

```jsx
<div className="weekbars">
  {S.routine.map((slot, i) => {
    const sets = slot.type === 'workout' ? (slot.exercises || []).reduce((a, e) => a + e.sets, 0) : 0;
    const h = sets ? Math.round(30 + (sets / maxSets) * 40) : 10;
    return (
      <div key={slot.id} className={`wbar ${sets ? 'on' : ''}`}>
        <div className="b" style={{ height: h }}></div>
        <span>{i + 1}</span>
      </div>
    );
  })}
</div>
```

`maxSets` se recalcula sobre `S.routine` en vez de `WEEK_ORDER.map(d =>
S.routine[d]...)`. La lista `day-cards` debajo (líneas 116-167 actuales)
recorre `S.routine.map((slot,i) => ...)` en vez de `WEEK_ORDER.map(d =>
...)`, mostrando `slot.name || 'Rutina'`/`'Descanso'` igual que antes
pero sin la letra de día (`WD1[d]`) — el número de orden (`i+1`) la
reemplaza donde hacía falta un identificador corto.

- [ ] **Step 2: `RutinaEdit` — lista arrastrable con inserción**

```jsx
function RutinaEdit() {
  return (
    <>
      <div className="vtitle"><h1>Editar</h1><span className="sub">{routineName()}</span></div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--s4)' }}>
        <button type="button" className="btn sm ghost" style={{ flex: 1 }} onClick={exitEditMode}>‹ Listo</button>
        <button type="button" className="btn sm ghost" style={{ flex: 1 }} onClick={openLibSaveSheet}>💾 Guardar como…</button>
      </div>
      {S.routine.length > 1 && (
        <div className="drag-hint tight"><span>↕</span><span>Mantené presionado un turno y soltalo para reordenarlo.</span></div>
      )}
      <div data-sort="seq">
        {S.routine.map((slot, i) => <SlotCard key={slot.id} slot={slot} index={i} />)}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 'var(--s3)' }}>
        <button type="button" className="btn sm ghost" style={{ flex: 1 }} onClick={() => insertWorkout(S.routine.length)}>+ Entrenamiento</button>
        <button type="button" className="btn sm ghost" style={{ flex: 1 }} onClick={() => insertRest(S.routine.length)}>+ Descanso</button>
      </div>
    </>
  );
}
```

`SlotCard` reemplaza a `DayCard` — mismo cuerpo (líneas 202-334
actuales), con estos cambios puntuales: prop `wd` → `index`; `data-wd`/
`data-sid` pasan de `wd` a `slot.id` (`data-sid={slot.id}`, sin
`data-wd`); el `onClick` del header (`toggleDayOpen(wd)`) pasa a
`toggleSlotOpen(index)`; el botón "✕ Vaciar día" pasa a "✕ Quitar turno" y
llama `removeSlot(index)` (no `deleteDay`, que sólo vaciaba contenido —
acá sacar el turno directo tiene más sentido porque ya no hay "7
casilleros que siempre existen"); el import de `rutina-logic.js` en
`Rutina.jsx` cambia de `{ routineStats, routineName, activeDayWds,
enterEditMode, exitEditMode, toggleDayOpen, deleteDay, deleteExercise,
moveEx }` a `{ routineStats, routineName, enterEditMode, exitEditMode,
toggleSlotOpen, removeSlot, insertWorkout, insertRest, deleteExercise,
moveEx }`; dentro de un turno de descanso, en vez de la
tarjeta fina "Descanso, asignar ›" que abría `day-edit`, ahora sólo
muestra "Descanso" con el botón "✕ Quitar turno" (no tiene sentido
"asignarle" nada a un descanso — para convertirlo en entrenamiento se
borra y se agrega uno nuevo con "+ Entrenamiento" en su lugar, o se abre
el turno con el botón "✎ Turno" igual que cualquier otro y ahí se le
pone nombre, lo que efectivamente lo vuelve `type:'workout'` — ver Step 3).
El `data-sort="rut" data-wd={wd}` interno (ejercicios dentro del turno)
pasa a `data-wd={index}` (ese atributo se sigue usando, `commitSort('rut',
wd, ids)` en Task 7 sigue leyendo un índice ahí, no un id).

- [ ] **Step 3: `SlotEdit.jsx` (ex `DayEdit.jsx`) — sin selector de día**

```jsx
import { useEffect, useRef, useState } from 'react';
import { S } from '../../lib/state.js';
import { saveSlot } from '../../lib/rutina-logic.js';

export default function SlotEdit({ index }) {
  const d = S.routine[index];
  const [name, setName] = useState(d?.name || '');
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <h2>Turno {index + 1}</h2>
      <div className="field">
        <label htmlFor="slotedit-nombre">Nombre (grupos musculares)</label>
        <input id="slotedit-nombre" ref={inputRef} value={name} onChange={e => setName(e.target.value)} placeholder="Pecho / Tríceps" />
      </div>
      <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s2)', lineHeight: 1.45 }}>
        Para cambiar el orden, arrastrá el turno en la lista de edición.
      </div>
      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => saveSlot(index, { name })}>Guardar</button>
    </>
  );
}
```

El selector "¿Qué día de la semana?" (chips + `outcome()`) se elimina
por completo — mover un turno ahora es sólo arrastrar en la lista
(Step 2), no un campo dentro de este sheet. Un descanso al que le ponés
nombre pasa a `type:'workout'` automáticamente — agregar esa conversión
en `saveSlot` (Task 2): si `S.routine[index].type==='rest'` y `name`
llega no vacío, `S.routine[index] = {...S.routine[index], type:'workout',
name, exercises: []}` antes de persistir.

- [ ] **Step 4: `App.jsx` — renombrar el registro del sheet**

Buscar `'day-edit'` en el switch de `<SheetContent/>` (`App.jsx`) y
cambiarlo a `'slot-edit'`, importando `SlotEdit` en vez de `DayEdit`.
Actualizar el único `openSheet('day-edit', {wd})` que queda en
`Rutina.jsx` (dentro de `SlotCard`, turno de descanso) a
`openSheet('slot-edit', {index})`.

- [ ] **Step 5: Verificar en navegador (CDP)**

- Entrar a Rutina → Editar, arrastrar un turno a otra posición, confirmar
  que el orden persiste tras recargar la página (releer IndexedDB).
- Agregar un turno de descanso en el medio de la secuencia con "+
  Descanso", confirmar que aparece en la posición correcta.
- Quitar un turno con "✕", confirmar que los índices de los demás se
  acomodan y que Hoy sigue mostrando el turno correcto después.
- Aplicar una plantilla y confirmar que la vista de Rutina la muestra
  como secuencia (no como 7 días).

- [ ] **Step 6: Test suite y lint**

```bash
cd web && npx vitest run && npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add web/src/components/screens/Rutina.jsx web/src/components/sheets/SlotEdit.jsx web/src/App.jsx
git rm web/src/components/sheets/DayEdit.jsx
git commit -m "feat(rutina-secuencia): editor de Rutina como lista arrastrable, sin selector de día de semana"
```

---

### Task 10: Revisión final de toda la rama

- [ ] Recorrer a mano las cinco pantallas principales en el navegador
  (Hoy, Rutina vista, Rutina editor, Progreso, Nutrición) buscando
  cualquier resto de `WEEK_ORDER`/`WD[wd]`/`S.hoyDay` que haya quedado
  sin convertir — `grep -rn "hoyDay\|WEEK_ORDER\|dayIsFree\|dropDayOn"
  web/src` no debería devolver nada fuera de comentarios explicativos.
- [ ] Confirmar que migrar una rutina real (la de Enzo, no una de
  prueba) produce una secuencia sensata — probar con un snapshot real de
  su IndexedDB si es posible, o al menos con una rutina de 4-5 días con
  huecos como la de los ejemplos de este plan.
- [ ] Confirmar que completar sesiones en un orden distinto al que
  tenían los turnos originalmente (ej. hacer el turno 3 antes que el 2)
  no rompe `sessionForSlot`/el historial/la racha.
- [ ] `npx vitest run` + `npm run lint` en la rama completa, sin
  warnings nuevos sobre el baseline.
- [ ] Build (`npm run build`) y verificación de que el bundle no creció
  de forma anormal.

---

## Deploy y finishing-a-development-branch

Seguir el flujo estándar de la sesión: commit final si hace falta →
`gh auth switch --hostname github.com --user Exorplion` → `git push` →
poll de `https://exorplion.github.io/gymapp/` hasta ver el nuevo hash de
`assets/index-*.js` antes de reportar terminado.
