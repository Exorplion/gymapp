# Migración RN — Etapa 1: Andamiaje — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Producir un proyecto Expo instalable (vía EAS Build) con navegación
de 4 pestañas y una capa de datos portada desde la PWA — el walking
skeleton sobre el que se construyen las etapas siguientes.

**Architecture:** Proyecto Expo nuevo en `native/`, hermano de `web/` en el
mismo repo. La capa de datos (`native/src/lib/db.js`, `state.js`,
`format.js`) se porta desde `web/src/lib/*`, reemplazando IndexedDB por
AsyncStorage detrás de la misma interfaz `idb.all/put/del/clear` — así
`rutina-logic.js`/`session.js`/etc. (a portar en etapas siguientes) necesitan
cambios mínimos. Navegación con React Navigation (bottom tabs).

**Tech Stack:** Expo SDK managed (última versión estable), React Navigation
6 (`@react-navigation/native` + `@react-navigation/bottom-tabs`),
`@react-native-async-storage/async-storage`, `expo-haptics`, Jest
(`jest-expo` preset) para tests, EAS CLI para el build.

**Spec:** `docs/superpowers/specs/2026-08-18-migracion-react-native-design.md`

## Global Constraints

- JS/JSX plano, sin TypeScript — mismo estilo que `web/`.
- `native/` no toca ningún archivo de `web/`; la PWA sigue funcionando sin
  cambios.
- Cada task deja `npx expo-doctor` (desde `native/`) sin errores antes de
  commitear.
- Cada archivo portado desde `web/src/lib/` debe citar de qué archivo viene
  en un comentario de cabecera, igual que el resto del repo ya hace al
  portar código.

---

### Task 1: Scaffold del proyecto Expo

**Files:**
- Create: `native/` (scaffold completo vía `create-expo-app`)
- Modify: `native/app.json` (nombre/slug de la app)

**Interfaces:**
- Produces: proyecto Expo corriendo, `native/App.js` como entry point.

- [ ] **Step 1: Generar el proyecto**

Run (desde la raíz del repo):
```bash
npx create-expo-app@latest native --template blank
```

- [ ] **Step 2: Configurar nombre/slug de la app**

Editar `native/app.json`, campos `expo.name` y `expo.slug`:
```json
{
  "expo": {
    "name": "FIERRO",
    "slug": "fierro"
  }
}
```
(dejar el resto de los campos generados por `create-expo-app` tal cual —
íconos y splash se ajustan recién en la Etapa 7, publicación).

- [ ] **Step 3: Verificar que el proyecto está sano**

Run: `cd native && npx expo-doctor`
Expected: "No issues detected" (o sólo warnings informativos de un proyecto
recién creado, sin errores).

- [ ] **Step 4: Commit**

```bash
cd native && git add -A && git commit -m "chore(rn): scaffold inicial del proyecto Expo"
```

---

### Task 2: Capa de almacenamiento (AsyncStorage, interfaz compatible con `idb`)

**Files:**
- Create: `native/src/lib/db.js`
- Test: `native/src/lib/db.test.js`
- Modify: `native/package.json` (agregar `jest-expo`, config de `jest`)

**Interfaces:**
- Produces: `idb.all(store)`, `idb.put(store, value)`, `idb.del(store, key)`,
  `idb.clear(store)`, `idbOpenOnce()`, `STORES` (array) — misma forma que
  `web/src/lib/db.js`'s `idb`/`idbOpenOnce`/`STORES`, para que Task 3 (portar
  `state.js`) y las etapas siguientes (portar `rutina-logic.js`, `session.js`,
  etc.) importen sin cambiar sus llamadas.

- [ ] **Step 1: Instalar dependencias de storage y testing**

Run (desde `native/`):
```bash
npx expo install @react-native-async-storage/async-storage
npm install --save-dev jest-expo jest @testing-library/react-native
```

- [ ] **Step 2: Configurar Jest en `package.json`**

Agregar a `native/package.json`:
```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFiles": [
      "./node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock"
    ]
  }
}
```

- [ ] **Step 3: Escribir el test de la capa de storage**

```js
// native/src/lib/db.test.js
import { idb, idbOpenOnce, STORES } from './db.js';

describe('db.js — capa de almacenamiento (AsyncStorage, interfaz idb)', () => {
  beforeEach(async () => {
    await idbOpenOnce();
    for (const s of STORES) await idb.clear(s);
  });

  it('put + all: guarda y lee filas de un store', async () => {
    await idb.put('sessions', { id: 's1', date: '2026-08-18' });
    const rows = await idb.all('sessions');
    expect(rows).toEqual([{ id: 's1', date: '2026-08-18' }]);
  });

  it('put con la misma key reemplaza en vez de duplicar', async () => {
    await idb.put('settings', { key: 'cfg', value: { a: 1 } });
    await idb.put('settings', { key: 'cfg', value: { a: 2 } });
    const rows = await idb.all('settings');
    expect(rows).toEqual([{ key: 'cfg', value: { a: 2 } }]);
  });

  it('del quita sólo la fila con esa key', async () => {
    await idb.put('meals', { id: 'm1', name: 'Pollo' });
    await idb.put('meals', { id: 'm2', name: 'Arroz' });
    await idb.del('meals', 'm1');
    expect(await idb.all('meals')).toEqual([{ id: 'm2', name: 'Arroz' }]);
  });

  it('clear vacía el store', async () => {
    await idb.put('body', { id: 'b1', date: '2026-08-18', weight: 74 });
    await idb.clear('body');
    expect(await idb.all('body')).toEqual([]);
  });

  it('routine usa order como key (no id)', async () => {
    await idb.put('routine', { id: 'x', order: 0, type: 'rest' });
    await idb.put('routine', { id: 'y', order: 0, type: 'workout' });
    expect(await idb.all('routine')).toEqual([{ id: 'y', order: 0, type: 'workout' }]);
  });

  it('STORES incluye los 6 stores de la PWA', () => {
    expect(STORES.sort()).toEqual(['body', 'foods', 'meals', 'routine', 'sessions', 'settings']);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd native && npx jest src/lib/db.test.js`
Expected: FAIL — `./db.js` no existe todavía.

- [ ] **Step 3: Implementar `db.js`**

```js
// native/src/lib/db.js
// Puerto de web/src/lib/db.js — misma interfaz (idb.all/put/del/clear,
// idbOpenOnce, STORES) pero sobre AsyncStorage en vez de IndexedDB: RN no
// tiene IndexedDB. AsyncStorage no tiene "object stores" con keyPath propio
// como IndexedDB, así que cada store se guarda entero como un array JSON
// bajo una sola clave (`fierro:<store>`), y put/del hacen el find-and-replace
// a mano usando la keyPath correspondiente (PK).
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORES = ['routine', 'sessions', 'meals', 'foods', 'body', 'settings'];

// keyPath de cada store — igual que los keyPath que usaba IndexedDB en
// web/src/lib/db.js (routine: 'order', el resto: 'id', settings: 'key').
const PK = { routine: 'order', sessions: 'id', meals: 'id', foods: 'id', body: 'id', settings: 'key' };

const storageKey = (store) => `fierro:${store}`;

async function readStore(store) {
  const raw = await AsyncStorage.getItem(storageKey(store));
  return raw ? JSON.parse(raw) : [];
}
async function writeStore(store, rows) {
  await AsyncStorage.setItem(storageKey(store), JSON.stringify(rows));
}

export const idb = {
  all: (store) => readStore(store),
  put: async (store, value) => {
    const rows = await readStore(store);
    const pk = PK[store];
    const i = rows.findIndex(r => r[pk] === value[pk]);
    if (i >= 0) rows[i] = value; else rows.push(value);
    await writeStore(store, rows);
  },
  del: async (store, key) => {
    const rows = await readStore(store);
    const pk = PK[store];
    await writeStore(store, rows.filter(r => r[pk] !== key));
  },
  clear: (store) => writeStore(store, []),
};

// AsyncStorage no tiene noción de "abrir conexión" como IndexedDB — queda
// como no-op async para que state.js (portado verbatim en Task 3) pueda
// seguir haciendo `await idbOpenOnce()` sin cambios.
export async function idbOpenOnce() {}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd native && npx jest src/lib/db.test.js`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
cd native && git add src/lib/db.js src/lib/db.test.js package.json package-lock.json && git commit -m "feat(rn): capa de almacenamiento AsyncStorage con interfaz idb compatible"
```

---

### Task 3: Portar `format.js`

**Files:**
- Create: `native/src/lib/format.js`
- Test: `native/src/lib/format.test.js`

**Interfaces:**
- Produces: mismo set de exports que `web/src/lib/format.js` (`esc, uid,
  KG2LB, pad, dstr, WD, WDS, WD1, MO, WEEK_ORDER, fmtD, fmtDFull, round1,
  fmtNum, fmtMMSS, kg2lb, lb2kg, vibrate, norm`), consumido por Task 4
  (`state.js`) y por las etapas siguientes al portar el resto de `lib/`.

- [ ] **Step 1: Instalar expo-haptics**

Run: `cd native && npx expo install expo-haptics`

- [ ] **Step 2: Escribir el test**

```js
// native/src/lib/format.test.js
import { dstr, fmtD, fmtDFull, fmtNum, round1, kg2lb, lb2kg, fmtMMSS, norm, KG2LB } from './format.js';

describe('format.js — portado de web/src/lib/format.js', () => {
  it('dstr formatea YYYY-MM-DD', () => {
    expect(dstr(new Date('2026-08-18T12:00:00'))).toBe('2026-08-18');
  });
  it('fmtD muestra día + mes corto', () => {
    expect(fmtD('2026-08-18')).toBe('18 ago');
  });
  it('fmtDFull agrega el día de semana', () => {
    expect(fmtDFull('2026-08-18')).toBe('Mar 18 ago');
  });
  it('round1 redondea a un decimal', () => {
    expect(round1(74.26)).toBe(74.3);
  });
  it('fmtNum no muestra decimales si es entero', () => {
    expect(fmtNum(75)).toBe('75');
    expect(fmtNum(74.5)).toBe('74.5');
  });
  it('kg2lb y lb2kg son inversas entre sí (con margen de redondeo)', () => {
    expect(round1(lb2kg(kg2lb(80)))).toBe(80);
  });
  it('KG2LB es la constante de conversión estándar', () => {
    expect(KG2LB).toBeCloseTo(2.20462262, 5);
  });
  it('fmtMMSS formatea segundos como m:ss', () => {
    expect(fmtMMSS(90)).toBe('1:30');
    expect(fmtMMSS(65)).toBe('1:05');
  });
  it('norm normaliza mayúsculas y acentos para comparar texto', () => {
    expect(norm('Press Banca')).toBe('press banca');
    expect(norm('SENTADILLA')).toBe('sentadilla');
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `cd native && npx jest src/lib/format.test.js`
Expected: FAIL — `./format.js` no existe.

- [ ] **Step 4: Implementar `format.js`**

```js
// native/src/lib/format.js
// Puerto de web/src/lib/format.js — todo pure JS/Intl, sin cambios, salvo
// vibrate(): navigator.vibrate no existe en RN, se reemplaza por
// expo-haptics (impactAsync da una vibración corta comparable al patrón
// simple [n] que usaba la PWA; los patrones largos [a,b,c] de la PWA — poco
// usados, sólo en el final de sesión — se aproximan con notificationAsync).
import * as Haptics from 'expo-haptics';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const KG2LB = 2.20462262;
export const pad = n => String(n).padStart(2, '0');
export const dstr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const WD = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WDS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const WD1 = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const MO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const fmtD = s => `${+s.slice(8)} ${MO[+s.slice(5, 7) - 1]}`;
export const fmtDFull = s => { const dt = new Date(s + 'T12:00:00'); return `${WDS[dt.getDay()]} ${+s.slice(8)} ${MO[+s.slice(5, 7) - 1]}`; };
export const round1 = n => Math.round(n * 10) / 10;
export const fmtNum = n => Number.isInteger(n) ? String(n) : n.toFixed(1);
export const fmtMMSS = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
export const kg2lb = kg => round1(kg * KG2LB);
export const lb2kg = lb => lb / KG2LB;
export const vibrate = p => {
  try {
    if (Array.isArray(p)) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};
export const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd native && npx jest src/lib/format.test.js`
Expected: PASS, 9/9.

- [ ] **Step 6: Commit**

```bash
cd native && git add src/lib/format.js src/lib/format.test.js package.json package-lock.json && git commit -m "feat(rn): portar format.js — vibrate() sobre expo-haptics"
```

---

### Task 4: Portar `state.js`

**Files:**
- Create: `native/src/lib/state.js`
- Test: `native/src/lib/state.test.js`

**Interfaces:**
- Consumes: `idb`, `STORES`, `idbOpenOnce` (Task 2); `dstr`, `fmtNum`,
  `round1`, `kg2lb`, `KG2LB`, `vibrate` (Task 3).
- Produces: `S` (objeto mutable), `bump()`, `useStore()`, `loadAll()`,
  `resolveAutoRest()`, `saveCfg()`, `saveDraft()`, `wDisplay/wAlt/wBoth/
  wStep`, `openSheet/closeSheet` — misma interfaz que `web/src/lib/state.js`,
  consumida por Task 5 (navegación) y por el resto de `lib/` en etapas
  siguientes.

- [ ] **Step 1: Escribir el test**

```js
// native/src/lib/state.test.js
import { S, bump, loadAll, resolveAutoRest, saveCfg } from './state.js';
import { idb } from './db.js';

describe('state.js — portado de web/src/lib/state.js', () => {
  beforeEach(async () => {
    for (const s of ['routine', 'sessions', 'meals', 'foods', 'body', 'settings']) await idb.clear(s);
    S.routine = []; S.sessions = []; S.ready = false;
  });

  it('loadAll() deja S.ready en true y ordena S.routine por order', async () => {
    await idb.put('routine', { id: 'b', order: 1, type: 'rest' });
    await idb.put('routine', { id: 'a', order: 0, type: 'workout', exercises: [] });
    await loadAll();
    expect(S.ready).toBe(true);
    expect(S.routine.map(r => r.id)).toEqual(['a', 'b']);
  });

  it('loadAll() hidrata S.cfg desde settings, mezclando con los defaults', async () => {
    await idb.put('settings', { key: 'cfg', value: { rest: 120 } });
    await loadAll();
    expect(S.cfg.rest).toBe(120);
    expect(S.cfg.unit).toBe('kg'); // default no pisado
  });

  it('resolveAutoRest() no rompe con S.routine vacío', async () => {
    await loadAll();
    await expect(resolveAutoRest()).resolves.not.toThrow();
  });

  it('saveCfg() persiste S.cfg en el store settings', async () => {
    await loadAll();
    S.cfg.rest = 180;
    await saveCfg();
    const rows = await idb.all('settings');
    const cfgRow = rows.find(r => r.key === 'cfg');
    expect(cfgRow.value.rest).toBe(180);
  });

  it('bump() no tira si no hay listeners suscriptos', () => {
    expect(() => bump()).not.toThrow();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd native && npx jest src/lib/state.test.js`
Expected: FAIL — `./state.js` no existe.

- [ ] **Step 3: Implementar `state.js`**

```js
// native/src/lib/state.js
// Puerto verbatim de web/src/lib/state.js — misma forma de S, mismo
// bump()/useStore() (useSyncExternalStore funciona igual en RN que en
// React DOM, es API de React puro, no del navegador). Sólo cambia de dónde
// importa idb/STORES (./db.js portado en Task 2, sobre AsyncStorage).
import { useSyncExternalStore } from 'react';
import { idb, STORES } from './db.js';
import { dstr, fmtNum, round1, kg2lb, KG2LB, vibrate } from './format.js';

export const S = {
  routine: [],
  sessions: [],
  meals: [], foods: [], body: [],
  cfg: {
    unit: 'kg', rest: 90, goals: { kcal: 2600, p: 160, c: 280, f: 80 }, goalsAuto: false,
    seqIndex: 0,
    seqIndexDate: null,
    profile: { sex: 'm', age: null, height: null, weightKg: null, activity: 'moderate', goal: 'deficit_mod', tdeeEmpirical: null, proteinPref: 0.5, fatPref: 0.5 },
  },
  draft: null,
  tab: 'inicio',
  hoyVals: {},
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

let version = 0;
const listeners = new Set();
export function bump() {
  version++;
  listeners.forEach(l => l());
}
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function getSnapshot() { return version; }

export function useStore() {
  useSyncExternalStore(subscribe, getSnapshot);
  return S;
}

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
  await resolveAutoRest();
}

export function resolveAutoRest() {
  const today = dstr();
  if (S.cfg.seqIndexDate && S.cfg.seqIndexDate < today) {
    for (let i = 0; i < S.routine.length && S.routine[S.cfg.seqIndex]?.type === 'rest'; i++) {
      S.cfg.seqIndex = (S.cfg.seqIndex + 1) % Math.max(1, S.routine.length);
    }
  }
  if (S.routine.length) S.cfg.seqIndexDate = today;
  return saveCfg();
}

export const saveCfg = () => idb.put('settings', { key: 'cfg', value: S.cfg });
export const saveDraft = () => S.draft ? idb.put('settings', { key: 'draft', value: S.draft }) : idb.del('settings', 'draft');

export function wDisplay(kg) {
  return S.cfg.unit === 'kg' ? fmtNum(round1(kg)) : fmtNum(kg2lb(kg));
}
export function wAlt(kg) {
  return S.cfg.unit === 'kg' ? `${fmtNum(kg2lb(kg))} lb` : `${fmtNum(round1(kg))} kg`;
}
export function wBoth(kg) {
  return `${fmtNum(round1(kg))} kg · ${fmtNum(kg2lb(kg))} lb`;
}
export function wStep() {
  return S.cfg.unit === 'kg' ? 2.5 : 5 / KG2LB;
}

export function openSheet(type, props = {}) { S.sheet = { type, props }; bump(); vibrate(6); }
export function closeSheet() { S.sheet = null; bump(); }
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd native && npx jest src/lib/state.test.js`
Expected: PASS, 5/5.

- [ ] **Step 5: Test suite completa**

Run: `cd native && npx jest`
Expected: todos los tests de Tasks 2-4 en verde (db.test.js, format.test.js, state.test.js).

- [ ] **Step 6: Commit**

```bash
cd native && git add src/lib/state.js src/lib/state.test.js && git commit -m "feat(rn): portar state.js sobre la capa de storage de Task 2"
```

---

### Task 5: Navegación de 4 pestañas + arranque de la app

**Files:**
- Modify: `native/App.js`
- Create: `native/src/screens/Inicio.js`, `native/src/screens/Rutina.js`,
  `native/src/screens/Comida.js`, `native/src/screens/Progreso.js`

**Interfaces:**
- Consumes: `S`, `useStore`, `loadAll` (Task 4).
- Produces: app arrancando con 4 pestañas navegables — la base sobre la que
  la Etapa 2 reemplaza cada pantalla placeholder por la real.

- [ ] **Step 1: Instalar React Navigation**

Run:
```bash
cd native && npx expo install @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context
```

- [ ] **Step 2: Crear las 4 pantallas placeholder**

```js
// native/src/screens/Inicio.js
import { View, Text, StyleSheet } from 'react-native';
import { useStore } from '../lib/state.js';

export default function Inicio() {
  const S = useStore();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inicio</Text>
      <Text style={styles.sub}>{S.ready ? 'Datos cargados' : 'Cargando…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05070d' },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  sub: { color: '#8a93a6', fontSize: 14, marginTop: 8 },
});
```

Repetir el mismo patrón para `Rutina.js`, `Comida.js`, `Progreso.js` — sólo
cambia el texto de `title` ('Rutina', 'Comida', 'Progreso'). Cada archivo
importa `useStore` igual, aunque todavía no muestre datos reales (eso es
Etapa 2 en adelante) — el objetivo de esta task es sólo confirmar que la
navegación y la carga de datos conviven sin romperse.

- [ ] **Step 3: Armar la navegación en `App.js`**

```js
// native/App.js
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { loadAll } from './src/lib/state.js';
import Inicio from './src/screens/Inicio.js';
import Rutina from './src/screens/Rutina.js';
import Comida from './src/screens/Comida.js';
import Progreso from './src/screens/Progreso.js';

const Tab = createBottomTabNavigator();

export default function App() {
  // Puerto del efecto de arranque de web/src/App.jsx: idbOpenOnce().then(loadAll)
  // corría ahí; acá loadAll() ya no necesita idbOpenOnce por separado porque
  // AsyncStorage no tiene noción de "abrir conexión" (ver Task 2).
  const [ready, setReady] = useState(false);
  useEffect(() => { loadAll().then(() => setReady(true)); }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05070d' }}>
        <ActivityIndicator color="#2e7dff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2e7dff' }}>
        <Tab.Screen name="Inicio" component={Inicio} />
        <Tab.Screen name="Rutina" component={Rutina} />
        <Tab.Screen name="Comida" component={Comida} />
        <Tab.Screen name="Progreso" component={Progreso} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 4: Verificar que arranca**

Run: `cd native && npx expo-doctor`
Expected: sin errores.

Run: `cd native && npx expo start` (dejarlo correr, confirmar en el log que
dice "Metro waiting on exp://..." sin errores de bundling; cerrar con
Ctrl+C una vez confirmado — no hace falta un dispositivo conectado para
este chequeo, el bundler igual compila).

- [ ] **Step 5: Commit**

```bash
cd native && git add App.js src/screens && git commit -m "feat(rn): navegación de 4 pestañas + carga de datos al arrancar"
```

---

### Task 6: Configuración de EAS Build (manual — requiere cuenta de Enzo)

**Files:**
- Create: `native/eas.json`

**Interfaces:** ninguna — esta task no produce código que otra task
consuma, es la puesta a punto de publicación.

**Nota:** esta task necesita la cuenta de Expo de Enzo (login interactivo) y
no se puede automatizar desde un subagente — se documenta acá como
instrucciones para que él la corra, no como pasos que un agente ejecuta
solo.

- [ ] **Step 1: Instalar EAS CLI**

Run: `npm install -g eas-cli`

- [ ] **Step 2: Login (interactivo, lo corre Enzo)**

Run: `eas login`

- [ ] **Step 3: Configurar el build**

Run (desde `native/`): `eas build:configure`
Esto genera `native/eas.json` con un perfil `development`/`preview`/
`production` por defecto — dejar los defaults para esta etapa (se ajustan
recién en la Etapa 7, publicación real a Play Store).

- [ ] **Step 4: Generar el primer build de Android (preview, instalable directo)**

Run: `eas build --platform android --profile preview`
Esto sube el proyecto a los servidores de Expo, compila, y al terminar da un
link para descargar un `.apk` instalable directo en el teléfono (sin pasar
por Play Store todavía — eso es la Etapa 7).

- [ ] **Step 5: Instalar en el teléfono y confirmar**

Descargar el `.apk` del link que da `eas build` e instalarlo en el
teléfono (puede pedir habilitar "orígenes desconocidos" la primera vez).
Confirmar que abre y muestra las 4 pestañas con "Cargando…" → "Datos
cargados".

- [ ] **Step 6: Commit**

```bash
cd native && git add eas.json && git commit -m "chore(rn): configuración de EAS Build (perfil preview)"
```

---

## Revisión final de la etapa

- [ ] `cd native && npx jest` — toda la suite en verde.
- [ ] `cd native && npx expo-doctor` — sin errores.
- [ ] APK instalado en el teléfono real, abre sin crashear, muestra las 4
  pestañas.
- [ ] `web/` no tiene ningún archivo modificado — la PWA sigue intacta.
