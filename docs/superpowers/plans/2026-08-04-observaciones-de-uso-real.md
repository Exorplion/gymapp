# Observaciones de uso real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arreglar la tarjeta del ejercicio, marcar y poder corregir los días ya entrenados, sacar el historial de sesiones a Progreso, dar preview al arrastre de días, y darle a nutrición un buscador con gramos, momentos del día e ida y vuelta a Markdown.

**Architecture:** App React sobre un store mutable externo (`lib/state.js`: el objeto `S` + `bump()` vía `useSyncExternalStore`). La lógica de negocio vive en `lib/*.js` y los componentes en `components/`; la dirección de import es siempre `components/ → lib/`, nunca al revés. Los helpers nuevos van a los módulos de `lib/` que ya son dueños de cada dominio (`session.js`, `rutina-logic.js`, `meals.js`) salvo dos capacidades nuevas que ganan archivo propio (`foodmd.js`, `foodsearch.js`).

**Tech Stack:** React 19, Vite 8, IndexedDB (wrapper propio en `lib/db.js`), oxlint, vitest 4 (sólo para `lib/`).

## Global Constraints

- **Directorio de trabajo:** todos los comandos se corren desde `web/`.
- **Rama:** `feat/observaciones-uso-real`. No commitear a `main`.
- **Verificación de cada tarea:** `npm run test` (0 fallos) + `npm run lint` (0 errores; **10 warnings preexistentes** son el baseline aceptado: `streak.js`, `FoodVoice.jsx`, `MealForm.jsx` ×2, `backup.js`, `charts.js` ×2, `rest.js`, `format.js` ×2) + `npm run build:only` (tiene que compilar).
- **Contar los warnings con `npm run lint 2>&1 | grep -cE "warning|error"`**, no con `tail`: el resumen de oxlint no imprime el total y `tail -N` corta la lista.
- **`npm install` requiere `--legacy-peer-deps`** — `vite-plugin-pwa@1.2.0` declara peer `vite ^3||^4||^5||^6||^7` y el proyecto usa `vite ^8`. Conflicto preexistente; no intentar arreglarlo en este plan.
- **No usar `npm run build`** durante el desarrollo: ese script copia el build a la raíz del repo (`scripts/publish-root.mjs`). Se corre sólo al publicar, con autorización de Enzo.
- **Tests sólo para `lib/`.** No hay jsdom ni testing-library. Los componentes se verifican con `npm run dev` y el ojo.
- **Idioma:** todo el texto de UI y los comentarios de código en español rioplatense/peruano, como el resto del código.
- **Nunca inventar macros** para un alimento desconocido (regla vigente de `foodvoice.js`).
- **Nunca reescribir el historial:** `start`, `end`, `duration`, `date`, `weekday` y `dayName` de una sesión son inmutables.
- **Inputs numéricos:** nunca reescribir el `.value` de un input desde su propio `onChange`. Ver la cabecera de `ExerciseCarousel.jsx` — hay un bug real documentado detrás de esta regla.
- **`prefers-reduced-motion: reduce`** apaga toda animación nueva.

## File Structure

**Nuevos:**
- `src/lib/foodmd.js` — serializar/parsear la tabla de alimentos en Markdown.
- `src/lib/foodsearch.js` — índice unificado de alimentos y ranking de búsqueda.
- `src/components/SessionCard.jsx` — la tarjeta de una sesión en una lista.
- `src/components/sheets/SessionView.jsx` — ver y editar una sesión. Reemplaza a `SessionRecap.jsx` y al `HistDetail` de `Hoy.jsx`.
- `src/lib/__tests__/*.test.js` — tests de los módulos de `lib/`.

**Borrados:** `src/components/sheets/SessionRecap.jsx`.

**Modificados:** `styles.css`, `ExerciseCarousel.jsx`, `session.js`, `Hoy.jsx`, `Progreso.jsx`, `History.jsx`, `Header.jsx`, `App.jsx`, `rutina-logic.js`, `drag.js`, `Rutina.jsx`, `meals.js`, `foodtable.js`, `MealForm.jsx`, `Nutricion.jsx`, `Settings.jsx`, `state.js`.

---

## Task 1: La tarjeta del ejercicio entra en la pantalla

**Files:**
- Modify: `src/styles.css:306` (`.setgrid`), `:320-326` (`.carousel*`), `:241-256` (`.step`)
- Modify: `src/components/ExerciseCarousel.jsx:87-93` (el contenedor), `:221-241` (el bloque de peso/reps)

**Interfaces:**
- Consumes: nada.
- Produces: la clase CSS `.carousel.focus` y `.setrows`. Ningún export nuevo de JS.

**Contexto del bug:** en 390px de ancho, `main` deja 354px, `.carousel-slide{flex:0 0 84%}` toma 297px, el padding de `.card` deja 265px. `.setgrid` reparte `1.4fr/1fr` → 147px al peso, 105px a las reps. Los dos botones de 48px más los gaps ocupan 108px. Al número de reps le queda espacio **negativo**.

- [ ] **Step 1: Reemplazar `.setgrid` por `.setrows` en el CSS**

En `src/styles.css`, reemplazar la línea de `.setgrid`:

```css
.setgrid{display:grid;grid-template-columns:1.4fr 1fr;gap:12px;margin:14px 0 12px}
```

por:

```css
/* Peso y reps apilados, no lado a lado. En dos columnas la de reps medía
   105px y sus dos botones ya ocupaban 108px: el número no tenía dónde
   entrar. Apilados, cada número se queda con ~141px. */
.setrows{display:flex;flex-direction:column;gap:var(--s3);margin:14px 0 12px}
.setrows .step button{width:52px;height:52px}
.setrows .step .val{display:flex;align-items:baseline;justify-content:center;gap:8px}
.setrows .step .val input{font-size:44px}
/* las libras al lado del número, no debajo: así la fila no crece de alto */
.setrows .step .val .alt{flex:none;margin-top:0;font-size:13px;white-space:nowrap}
```

- [ ] **Step 2: Agregar el modo foco del carrusel**

En `src/styles.css`, justo después de la regla de `.carousel-slide`, agregar:

```css
/* Con la sesión abierta la tarjeta ocupa todo el ancho: el peek del 84% sirve
   para ojear qué te toca, pero en plena serie sólo cuesta 57px de ancho. El
   cambio pasa al abrir la sesión, que ya es una transición de pantalla
   completa, no a mitad de un ejercicio. */
.carousel.focus .carousel-slide{flex:0 0 100%}
```

- [ ] **Step 3: Poner la clase `focus` en el contenedor**

En `src/components/ExerciseCarousel.jsx`, cambiar la apertura del carrusel:

```jsx
<div id="ex-carousel" className="carousel" ref={carRef}>
```

por:

```jsx
<div id="ex-carousel" className={`carousel${active ? ' focus' : ''}`} ref={carRef}>
```

`active` ya es prop del componente y ya forma parte de `focusKey`, así que el `useLayoutEffect` recentra el scroll cuando cambia el ancho. No hay que tocar el efecto.

- [ ] **Step 4: Apilar peso y reps en el JSX**

En `src/components/ExerciseCarousel.jsx`, reemplazar el bloque `<div className="setgrid">…</div>` entero por:

```jsx
<div className="setrows">
  <div>
    <div className="steplabel">Peso ({S.cfg.unit === 'kg' ? 'kg' : 'lb'})</div>
    <div className="step">
      <button type="button" onClick={() => stepW(-1)}>−</button>
      <div className="val">
        <input ref={wRef} type="number" inputMode="decimal" step="any" defaultValue={wDisplay(v.w)} onChange={onWChange} />
        <span className="alt" ref={altRef}>{wAlt(v.w)}</span>
      </div>
      <button type="button" onClick={() => stepW(1)}>+</button>
    </div>
  </div>
  <div>
    <div className="steplabel">Reps</div>
    <div className="step">
      <button type="button" onClick={() => stepR(-1)}>−</button>
      <div className="val"><input ref={rRef} type="number" inputMode="numeric" defaultValue={v.r} onChange={onRChange} /></div>
      <button type="button" onClick={() => stepR(1)}>+</button>
    </div>
  </div>
</div>
```

Los `ref`, `defaultValue` y `onChange` quedan **exactamente** como estaban: este paso es sólo de layout. `syncInputs`/`syncDependents` no se tocan.

- [ ] **Step 5: Verificar que no quedó ningún `.setgrid` huérfano**

Run: `grep -rn "setgrid" src/`
Expected: sin resultados.

- [ ] **Step 6: Lint y build**

Run: `npm run lint && npm run build:only`
Expected: 10 warnings preexistentes, 0 errores, build OK.

- [ ] **Step 7: Verificación visual**

Run: `npm run dev`
Comprobar en el navegador con el viewport en 390px:
1. Sin sesión abierta, las tarjetas del carrusel se ven al 84% con el peek de la vecina.
2. Abrir una sesión e iniciar un ejercicio: la tarjeta pasa a ocupar todo el ancho.
3. Los números de peso y reps se leen enteros, y "138 lb" queda al lado del peso.

- [ ] **Step 8: Commit**

```bash
git add src/styles.css src/components/ExerciseCarousel.jsx
git commit -m "feat(web): la tarjeta del ejercicio entra en la pantalla"
```

---

## Task 2: Helpers de sesión — semana, PRs históricos y agrupado

**Files:**
- Modify: `src/lib/session.js` (agregar `weekStart`, `sessionForWeekday`, `sessionPRs`, `groupSessionsByWeek`, `updateHistorySession`; borrar `calcSessionPRs`)
- Modify: `src/lib/session.js:86-113` (`completeSession`)
- Test: `src/lib/__tests__/session.test.js`

**Interfaces:**
- Consumes: `S` (state.js), `dstr`/`fmtD` (format.js), `exKey` (equip.js), `idb` (db.js), `toast` (toast.js).
- Produces:
  - `weekStart(d = new Date()) -> string` — el lunes de esa semana en `YYYY-MM-DD`.
  - `sessionForWeekday(wd) -> sess | null` — sesión de ese weekday dentro de la semana en curso.
  - `sessionPRs(sess) -> [{name, equip, machine, w, r}]` — récords de esa sesión contra las anteriores a ella.
  - `groupSessionsByWeek(list) -> [{key, label, sessions}]`.
  - `updateHistorySession(sess, msg?) -> Promise<void>` — guarda una sesión editada con toast de Deshacer.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/__tests__/session.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { weekStart, sessionForWeekday, sessionPRs, groupSessionsByWeek } from '../session.js';

// dstr() y weekStart() trabajan en hora local, así que las fechas de prueba se
// construyen con el constructor local (año, mes, día), nunca con strings ISO.
const d = (y, m, day) => new Date(y, m - 1, day);

describe('weekStart', () => {
  it('devuelve el lunes de esa semana', () => {
    // 2026-08-04 es martes -> lunes 2026-08-03
    expect(weekStart(d(2026, 8, 4))).toBe('2026-08-03');
  });

  it('un lunes se devuelve a sí mismo', () => {
    expect(weekStart(d(2026, 8, 3))).toBe('2026-08-03');
  });

  it('el domingo cierra la semana que empezó el lunes anterior', () => {
    // 2026-08-09 es domingo -> lunes 2026-08-03, no el 10
    expect(weekStart(d(2026, 8, 9))).toBe('2026-08-03');
  });
});

describe('sessionForWeekday', () => {
  beforeEach(() => {
    vi.setSystemTime(d(2026, 8, 6));      // jueves
    S.sessions = [];
  });

  it('encuentra la sesión de ese weekday en la semana en curso', () => {
    S.sessions = [{ id: 'a', weekday: 4, date: '2026-08-06', start: 300 }];
    expect(sessionForWeekday(4)?.id).toBe('a');
  });

  it('ignora la del mismo weekday pero de la semana pasada', () => {
    S.sessions = [{ id: 'vieja', weekday: 4, date: '2026-07-30', start: 100 }];
    expect(sessionForWeekday(4)).toBe(null);
  });

  it('un día de esta semana sin sesión devuelve null', () => {
    S.sessions = [{ id: 'a', weekday: 4, date: '2026-08-06', start: 300 }];
    expect(sessionForWeekday(5)).toBe(null);
  });
});

describe('sessionPRs', () => {
  beforeEach(() => { S.sessions = []; });

  it('marca récord cuando la mejor serie supera a todo lo anterior', () => {
    const vieja = { id: 'v', start: 100, entries: [{ name: 'Press banca', sets: [{ w: 60, r: 8 }] }] };
    const nueva = { id: 'n', start: 200, entries: [{ name: 'Press banca', sets: [{ w: 62.5, r: 8 }] }] };
    S.sessions = [nueva, vieja];
    expect(sessionPRs(nueva)).toEqual([{ name: 'Press banca', equip: undefined, machine: undefined, w: 62.5, r: 8 }]);
  });

  it('no marca récord si no supera lo anterior', () => {
    const vieja = { id: 'v', start: 100, entries: [{ name: 'Press banca', sets: [{ w: 70, r: 8 }] }] };
    const nueva = { id: 'n', start: 200, entries: [{ name: 'Press banca', sets: [{ w: 62.5, r: 8 }] }] };
    S.sessions = [nueva, vieja];
    expect(sessionPRs(nueva)).toEqual([]);
  });

  it('sólo compara contra sesiones anteriores, no contra las posteriores', () => {
    const media = { id: 'm', start: 200, entries: [{ name: 'Press banca', sets: [{ w: 62.5, r: 8 }] }] };
    const futura = { id: 'f', start: 300, entries: [{ name: 'Press banca', sets: [{ w: 80, r: 8 }] }] };
    S.sessions = [futura, media];
    expect(sessionPRs(media)).toHaveLength(1);
  });

  it('funciona igual esté o no la sesión dentro de S.sessions', () => {
    const vieja = { id: 'v', start: 100, entries: [{ name: 'Press banca', sets: [{ w: 60, r: 8 }] }] };
    const nueva = { id: 'n', start: 200, entries: [{ name: 'Press banca', sets: [{ w: 62.5, r: 8 }] }] };
    S.sessions = [vieja];               // todavía no se guardó
    expect(sessionPRs(nueva)).toHaveLength(1);
  });
});

describe('groupSessionsByWeek', () => {
  beforeEach(() => { vi.setSystemTime(d(2026, 8, 6)); });

  it('etiqueta esta semana, la pasada y las más viejas por fecha', () => {
    const g = groupSessionsByWeek([
      { id: 'a', date: '2026-08-06' },
      { id: 'b', date: '2026-08-03' },
      { id: 'c', date: '2026-07-29' },
      { id: 'd', date: '2026-07-15' },
    ]);
    expect(g.map(x => x.label)).toEqual(['Esta semana', 'Semana pasada', 'Semana del 13 jul']);
    expect(g[0].sessions).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm run test`
Expected: FAIL — `weekStart is not a function` (y las demás), porque todavía no existen.

- [ ] **Step 3: Implementar los helpers en `session.js`**

En `src/lib/session.js`, agregar al import de `format.js` lo que falte (`fmtD`), y agregar estas funciones:

```js
/** El lunes de la semana de `d`, en YYYY-MM-DD. La semana arranca el lunes
    porque es el orden en que la app muestra los días (WEEK_ORDER). */
export function weekStart(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));   // domingo (0) cae 6 días atrás
  return dstr(x);
}

/** La sesión de ese día de la semana dentro de la semana en curso, o null.
    La ventana es "esta semana" y no "hoy" a propósito: cubre tanto "ya entrené
    hoy" como "miro el lunes que ya hice". Un día futuro de esta semana todavía
    no tiene sesión, así que sigue ofreciendo entrenar.
    S.sessions está ordenado descendente por start, así que find() da la más
    reciente. */
export function sessionForWeekday(wd) {
  const ws = weekStart();
  return S.sessions.find(s => s.weekday === +wd && s.date >= ws) || null;
}

/** Récords de `sess`: la mejor serie de cada ejercicio contra el máximo de las
    sesiones ANTERIORES a ella. Sirve para cualquier sesión, esté o no todavía
    en S.sessions — reemplaza a calcSessionPRs(), que asumía que la sesión no
    estaba en la lista y por eso sólo servía en el momento de cerrarla. */
export function sessionPRs(sess) {
  const prior = S.sessions.filter(s => s.id !== sess.id && s.start < sess.start);
  const prs = [];
  (sess.entries || []).forEach(e => {
    if (!e.sets?.length) return;
    const bestSet = e.sets.reduce((a, b) => (b.w > a.w ? b : a), e.sets[0]);
    let prevMax = 0;
    prior.forEach(s => (s.entries || []).forEach(pe => {
      if (exKey(pe) !== exKey(e)) return;
      pe.sets.forEach(st => { if (st.w > prevMax) prevMax = st.w; });
    }));
    if (bestSet.w > prevMax) prs.push({ name: e.name, equip: e.equip, machine: e.machine, w: bestSet.w, r: bestSet.r });
  });
  return prs;
}

/** Agrupa sesiones por semana calendario, conservando el orden de entrada. */
export function groupSessionsByWeek(list) {
  const ws = weekStart();
  const prevWs = weekStart(new Date(new Date(ws + 'T12:00:00').getTime() - 7 * 86400000));
  const groups = [];
  const byKey = new Map();
  (list || []).forEach(s => {
    const k = weekStart(new Date(s.date + 'T12:00:00'));
    let g = byKey.get(k);
    if (!g) {
      const label = k === ws ? 'Esta semana' : k === prevWs ? 'Semana pasada' : `Semana del ${fmtD(k)}`;
      g = { key: k, label, sessions: [] };
      byKey.set(k, g);
      groups.push(g);
    }
    g.sessions.push(s);
  });
  return groups;
}

/** Guarda una sesión del historial ya editada. `start`, `end`, `duration`,
    `date`, `weekday` y `dayName` no se tocan nunca: el tiempo que quedó
    registrado en el gimnasio es un hecho medido, corregir un peso no lo cambia.
    El toast de Deshacer restaura el snapshot previo. */
export async function updateHistorySession(sess, msg = 'Sesión actualizada') {
  const i = S.sessions.findIndex(s => s.id === sess.id);
  const snapshot = i >= 0 ? structuredClone(S.sessions[i]) : null;
  if (i >= 0) S.sessions[i] = sess;
  await idb.put('sessions', sess);
  bump();
  toast(msg, {
    actionLabel: 'Deshacer',
    onAction: async () => {
      if (!snapshot) return;
      const j = S.sessions.findIndex(s => s.id === snapshot.id);
      if (j >= 0) S.sessions[j] = snapshot;
      await idb.put('sessions', snapshot);
      bump();
    },
  });
}
```

- [ ] **Step 4: Reemplazar `calcSessionPRs` en `completeSession`**

En `completeSession()`, borrar la línea `const prs = calcSessionPRs(entries);` y mover el cálculo a después de guardar, usando `sessionPRs`:

```js
  await idb.put('sessions', sess);
  S.sessions.unshift(sess);
  // sessionPRs filtra por start < sess.start, así que la sesión recién
  // insertada se excluye sola: da lo mismo calcular antes o después de guardar.
  const prs = sessionPRs(sess);
  S.draft = null; S.hoyDay = null;
```

Después borrar la función `calcSessionPRs` entera (y su comentario de cabecera).

- [ ] **Step 5: Verificar que nadie más usa `calcSessionPRs`**

Run: `grep -rn "calcSessionPRs" src/`
Expected: sin resultados.

- [ ] **Step 6: Correr los tests**

Run: `npm run test`
Expected: PASS — todos.

- [ ] **Step 7: Lint y build**

Run: `npm run lint && npm run build:only`
Expected: 10 warnings preexistentes, 0 errores, build OK.

- [ ] **Step 8: Commit**

```bash
git add src/lib/session.js src/lib/__tests__/session.test.js
git commit -m "feat(web): helpers de semana, PRs históricos y agrupado de sesiones"
```

---

## Task 3: SessionView — una sola vista de sesión

**Files:**
- Create: `src/components/sheets/SessionView.jsx`
- Delete: `src/components/sheets/SessionRecap.jsx`
- Modify: `src/components/screens/Hoy.jsx` (borrar el export `HistDetail` y `confirmHistDel`)
- Modify: `src/lib/session.js` (`completeSession` abre `session-view`)
- Modify: `src/App.jsx` (el switch de sheets)
- Modify: `src/components/sheets/History.jsx` (abre `session-view`)

**Interfaces:**
- Consumes: `sessionPRs`, `deleteHistorySession` (session.js, Task 2).
- Produces: el sheet `'session-view'` con props `{ id, justFinished }`. Los sheets `'session-recap'` y `'hist-detail'` dejan de existir.

- [ ] **Step 1: Crear `SessionView.jsx`**

```jsx
// Una sola vista para una sesión, con tres entradas: al terminarla
// (justFinished), al tocarla en el historial, y desde el día ya completado en
// Hoy. Antes eran dos componentes que mostraban lo mismo distinto —
// SessionRecap (cuatro stats + tarjeta de PR) y HistDetail (chips planos, sin
// stats ni PRs).
//
// Lee la sesión de S.sessions POR ID, no por prop: así una edición (Task 6) se
// refleja sin cerrar y reabrir el sheet.
import { S, useStore, openSheet, closeSheet } from '../../lib/state.js';
import { WD, fmtDFull, fmtNum, round1 } from '../../lib/format.js';
import { sessionPRs, deleteHistorySession } from '../../lib/session.js';

export default function SessionView({ id, justFinished = false }) {
  useStore();
  const s = S.sessions.find(x => x.id === id);
  if (!s) return null;

  const prs = sessionPRs(s);
  const hasPR = prs.length > 0;
  const nsets = (s.entries || []).reduce((a, e) => a + e.sets.length, 0);
  const vol = (s.entries || []).reduce((a, e) => a + e.sets.reduce((b, st) => b + st.w * st.r, 0), 0);

  return (
    <>
      <h2>{justFinished ? (hasPR ? '🎉 Sesión guardada' : '💪 Sesión guardada') : (s.dayName || WD[s.weekday])}</h2>
      <div className="txt-mut" style={{ margin: '-8px 0 16px', fontSize: 14 }}>
        {justFinished ? `${s.dayName || WD[s.weekday]} · ` : ''}{fmtDFull(s.date)} · {s.duration} min
      </div>

      <div className="macro3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <SessStat n={s.duration} l="Min" />
        <SessStat n={nsets} l="Series" />
        <SessStat n={(s.entries || []).length} l="Ejercicios" />
        <SessStat n={Math.round(vol)} l="Kg vol." />
      </div>

      {hasPR && (
        <div className="card pr-card" style={{ marginTop: 18, animation: justFinished ? 'flash 1.2s ease 2' : undefined }}>
          <div className="pr-troph">🏆</div>
          <div className="grow">
            <div className="cond" style={{ fontSize: 17, fontWeight: 700 }}>
              {justFinished ? '¡Nuevo récord!' : `${prs.length} récord${prs.length === 1 ? '' : 's'} en esta sesión`}
            </div>
            <div className="txt-mut" style={{ fontSize: 13 }}>
              {prs.map(p => `${p.name} · ${fmtNum(round1(p.w))} kg × ${p.r}`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      <div className="sect">Lo que hiciste</div>
      {(s.entries || []).map((e, i) => (
        <div key={i} className="card" style={{ padding: '12px 14px' }}>
          <div className="cond" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{e.name}</div>
          <div className="chips">
            {e.sets.map((st, j) => (
              <span key={j} className="chip">{fmtNum(round1(st.w))}kg × {st.r}</span>
            ))}
          </div>
        </div>
      ))}

      {justFinished ? (
        <button type="button" className={`btn ${hasPR ? 'ok' : ''}`} style={{ marginTop: 18 }} onClick={closeSheet}>
          Guardar y cerrar
        </button>
      ) : (
        <button type="button" className="btn danger sm" style={{ marginTop: 6 }} onClick={() => confirmDel(s.id)}>
          Eliminar sesión
        </button>
      )}
    </>
  );
}

function SessStat({ n, l }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="cond" style={{ fontSize: 26, fontWeight: 700 }}>{n}</div>
      <div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{l}</div>
    </div>
  );
}

function confirmDel(id) {
  openSheet('confirm', {
    title: 'Eliminar sesión',
    body: 'Se elimina del historial. Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
    onConfirm: () => deleteHistorySession(id),
    onCancel: () => openSheet('session-view', { id }),
  });
}
```

- [ ] **Step 2: Apuntar `completeSession` al sheet nuevo**

En `src/lib/session.js`, dentro de `completeSession()`, cambiar:

```js
  openSheet('session-recap', { sess, prs });
```

por:

```js
  openSheet('session-view', { id: sess.id, justFinished: true });
```

`prs` se sigue usando en la línea siguiente (`if (prs.length > 0) fireConfetti();`), así que la variable no se borra.

- [ ] **Step 3: Sacar `HistDetail` y `confirmHistDel` de `Hoy.jsx`**

En `src/components/screens/Hoy.jsx`, borrar la función exportada `HistDetail` y la función `confirmHistDel` completas (desde el comentario `/** Puerto de sheetHist() … */` hasta el final del archivo). Sacar de los imports lo que quede sin uso: `fmtDFull`, `fmtNum`, `round1` y `deleteHistorySession`.

Run: `npm run lint`
Expected: sin warnings nuevos de `no-unused-vars` en `Hoy.jsx`.

- [ ] **Step 4: Actualizar el switch de sheets en `App.jsx`**

Reemplazar el import:

```jsx
import SessionRecap from './components/sheets/SessionRecap.jsx';
```

por:

```jsx
import SessionView from './components/sheets/SessionView.jsx';
```

Cambiar el import de `Hoy` para que no traiga `HistDetail`:

```jsx
import Hoy, { SessStartInfo } from './components/screens/Hoy.jsx';
```

Y en `SheetContent`, reemplazar las dos líneas:

```jsx
    case 'session-recap': return <SessionRecap {...sheet.props} />;
    case 'hist-detail': return <HistDetail {...sheet.props} />;
```

por una sola:

```jsx
    case 'session-view': return <SessionView {...sheet.props} />;
```

- [ ] **Step 5: Actualizar `History.jsx`**

En `src/components/sheets/History.jsx`, cambiar el `onClick` de cada fila:

```jsx
onClick={() => openSheet('hist-detail', { id: s.id })}
```

por:

```jsx
onClick={() => openSheet('session-view', { id: s.id })}
```

- [ ] **Step 6: Borrar `SessionRecap.jsx`**

```bash
git rm src/components/sheets/SessionRecap.jsx
```

- [ ] **Step 7: Verificar que no quedaron referencias**

Run: `grep -rn "SessionRecap\|hist-detail\|session-recap\|HistDetail" src/`
Expected: sin resultados.

- [ ] **Step 8: Tests, lint y build**

Run: `npm run test && npm run lint && npm run build:only`
Expected: tests PASS, 6 warnings preexistentes, build OK.

- [ ] **Step 9: Verificación manual**

Run: `npm run dev`
1. Cerrar una sesión → se abre `SessionView` con "Sesión guardada", las cuatro stats y el detalle por ejercicio.
2. Abrir el historial desde el reloj → tocar una sesión → la misma vista, con el nombre del día como título y el botón de eliminar.

- [ ] **Step 10: Commit**

```bash
git add -A src/
git commit -m "feat(web): una sola vista para ver una sesión"
```

---

## Task 4: Tus sesiones en Progreso

**Files:**
- Create: `src/components/SessionCard.jsx`
- Modify: `src/components/screens/Progreso.jsx` (sección nueva)
- Modify: `src/components/sheets/History.jsx` (reescrito con las tarjetas nuevas)
- Modify: `src/components/Header.jsx` (`onOpenHistory` → `onOpenSessions`)
- Modify: `src/App.jsx` (el handler del reloj)
- Modify: `src/styles.css` (`.sess-card`)

**Interfaces:**
- Consumes: `groupSessionsByWeek`, `sessionPRs` (session.js, Task 2); el sheet `'session-view'` (Task 3).
- Produces: `<SessionCard sess={…} />`; el ancla `id="sesiones"` en Progreso.

- [ ] **Step 1: Crear `SessionCard.jsx`**

```jsx
// La tarjeta de una sesión en una lista. La usan la sección "Tus sesiones" de
// Progreso y el sheet de todas las sesiones, así que vive suelta en
// components/ y no dentro de ninguna de las dos.
import { openSheet } from '../lib/state.js';
import { WDS, WD, fmtD } from '../lib/format.js';
import { sessionPRs } from '../lib/session.js';

export default function SessionCard({ sess }) {
  const nsets = (sess.entries || []).reduce((a, e) => a + e.sets.length, 0);
  const vol = Math.round((sess.entries || []).reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0));
  const nprs = sessionPRs(sess).length;
  const names = (sess.entries || []).map(e => e.name).join(' · ');

  return (
    <button type="button" className="sess-card" onClick={() => openSheet('session-view', { id: sess.id })}>
      <div className="sc-top">
        <span className="hist-badge">{WDS[sess.weekday]}</span>
        <span className="sc-name">{sess.dayName || WD[sess.weekday]}</span>
        {nprs > 0 && <span className="sc-pr">🏆{nprs}</span>}
      </div>
      <div className="sc-meta">{fmtD(sess.date)} · {sess.duration} min</div>
      <div className="sc-meta strong">{nsets} series · {vol.toLocaleString('es')} kg de volumen</div>
      {names && <div className="sc-exs">{names}</div>}
    </button>
  );
}
```

- [ ] **Step 2: Agregar los estilos de la tarjeta**

Al final de la sección de historial en `src/styles.css`, agregar:

```css
/* ---------- tarjeta de sesión (Progreso / todas las sesiones) ---------- */
.sess-list{display:flex;flex-direction:column;gap:10px;margin-bottom:var(--s4)}
.sess-card{
  display:block;width:100%;text-align:left;
  background:linear-gradient(158deg,rgba(255,255,255,.075),rgba(255,255,255,.02));
  border:1px solid var(--glass-border);border-radius:var(--r);padding:12px 14px;
  transition:transform .15s var(--ease),border-color .15s ease;
}
.sess-card:active{transform:scale(.99);border-color:var(--line2)}
.sc-top{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.sc-name{font-family:'Barlow Condensed';font-size:19px;font-weight:700;letter-spacing:.02em;flex:1;min-width:0}
.sc-pr{font-size:13px;font-weight:700;color:var(--warn);flex:none}
.sc-meta{font-size:12.5px;color:var(--mut)}
.sc-meta.strong{color:var(--blue2);font-weight:500}
.sc-exs{font-size:12px;color:var(--mut2);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sess-week{
  font-family:'Barlow Condensed';font-size:12.5px;font-weight:700;
  letter-spacing:.14em;text-transform:uppercase;color:var(--mut);
  margin:var(--s4) 2px var(--s2);
}
```

- [ ] **Step 3: Agregar la sección a `Progreso.jsx`**

Agregar los imports:

```jsx
import { groupSessionsByWeek } from '../../lib/session.js';
import SessionCard from '../SessionCard.jsx';
```

E insertar, justo **después** del `</div>` que cierra `<div className="card hero hero-prog">` y **antes** del `<div className="seg" style={{ margin: 'var(--s3) 0' }}>` de Carga/1RM/Volumen:

```jsx
      <SesionesSection />
```

Y agregar el componente al final del archivo:

```jsx
/** "Qué hice" es lo que más se consulta de Progreso, así que va arriba de los
    gráficos. Muestra las últimas 8 agrupadas por semana; el resto vive en el
    sheet de todas las sesiones. */
function SesionesSection() {
  const recientes = S.sessions.slice(0, 8);
  return (
    <div id="sesiones" style={{ scrollMarginTop: 70 }}>
      <div className="sect">
        Tus sesiones
        {S.sessions.length > 8 && (
          <button type="button" className="btn sm ghost" style={{ width: 'auto', padding: '0 12px', height: 32, marginLeft: 'auto' }} onClick={() => openSheet('history')}>
            Ver todas
          </button>
        )}
      </div>
      {!recientes.length ? (
        <div className="card"><div className="empty" style={{ padding: 18 }}>
          <p style={{ margin: 0 }}>Cuando cierres tu primera sesión va a aparecer acá.</p>
        </div></div>
      ) : (
        groupSessionsByWeek(recientes).map(g => (
          <div key={g.key}>
            <div className="sess-week">{g.label} · {g.sessions.length} sesión{g.sessions.length === 1 ? '' : 'es'}</div>
            <div className="sess-list">
              {g.sessions.map(s => <SessionCard key={s.id} sess={s} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 4: Reescribir `History.jsx` como "todas las sesiones"**

Reemplazar el contenido entero por:

```jsx
// Todas las sesiones cerradas, agrupadas por semana. Se abre desde "Ver todas"
// de la sección Tus sesiones (Progreso), que muestra sólo las 8 más recientes.
// Antes este sheet era la ÚNICA forma de ver el historial y colgaba del reloj
// del header; ahora el reloj lleva a Progreso y esto es el desborde.
import { S, useStore } from '../../lib/state.js';
import { groupSessionsByWeek } from '../../lib/session.js';
import SessionCard from '../SessionCard.jsx';

export default function History() {
  useStore();
  const grupos = groupSessionsByWeek(S.sessions);
  const n = S.sessions.length;

  return (
    <>
      <h2 className="sheet-title">Todas tus sesiones</h2>
      <div className="txt-mut" style={{ fontSize: 13, marginTop: 2, marginBottom: 14 }}>
        {n ? `${n} sesión${n === 1 ? '' : 'es'} cerrada${n === 1 ? '' : 's'}` : 'Todavía no cerraste ninguna sesión'}
      </div>

      {!n ? (
        <div className="card"><div className="empty" style={{ padding: 18 }}>
          <p style={{ margin: 0 }}>Tus sesiones completadas aparecerán acá.</p>
        </div></div>
      ) : (
        grupos.map(g => (
          <div key={g.key}>
            <div className="sess-week">{g.label} · {g.sessions.length} sesión{g.sessions.length === 1 ? '' : 'es'}</div>
            <div className="sess-list">
              {g.sessions.map(s => <SessionCard key={s.id} sess={s} />)}
            </div>
          </div>
        ))
      )}
    </>
  );
}
```

- [ ] **Step 5: El reloj del header lleva a Progreso**

En `src/components/Header.jsx`, renombrar la prop `onOpenHistory` a `onOpenSessions` (en la firma, en el default y en el `onClick`), y cambiar el `aria-label` a `"Tus sesiones"`.

En `src/App.jsx`, cambiar el uso:

```jsx
onOpenHistory={() => openSheet('history')}
```

por:

```jsx
onOpenSessions={() => {
  S.tab = 'prog';
  bump();
  // el scroll espera a que Progreso esté pintado
  setTimeout(() => document.getElementById('sesiones')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}}
```

- [ ] **Step 6: Lint y build**

Run: `npm run test && npm run lint && npm run build:only`
Expected: tests PASS, 6 warnings preexistentes, build OK.

- [ ] **Step 7: Verificación manual**

Run: `npm run dev`
1. Cargar datos de prueba desde Ajustes ("🧪 Cargar mi registro") para tener historial.
2. Tocar el reloj del header → lleva a Progreso y baja hasta "Tus sesiones".
3. Las sesiones se ven agrupadas por semana con "Esta semana"/"Semana pasada".
4. "Ver todas" abre el sheet con la lista completa.
5. Tocar una tarjeta abre `SessionView`.

- [ ] **Step 8: Commit**

```bash
git add -A src/
git commit -m "feat(web): tus sesiones viven en Progreso, agrupadas por semana"
```

---

## Task 5: El día ya entrenado deja de ofrecer "Empezar entrenamiento"

**Files:**
- Modify: `src/components/screens/Hoy.jsx` (`PreSessionHero` → decide entre hero y `DoneHero`; la tira semanal)
- Modify: `src/styles.css` (`.wkstrip .wd.done`, `.done-hero`)

**Interfaces:**
- Consumes: `sessionForWeekday`, `sessionPRs` (session.js, Task 2); el sheet `'session-view'` (Task 3).
- Produces: nada nuevo hacia afuera.

- [ ] **Step 1: Importar los helpers en `Hoy.jsx`**

Agregar `sessionForWeekday` y `sessionPRs` al import que ya trae de `session.js`.

- [ ] **Step 2: Agregar `DoneHero`**

En `src/components/screens/Hoy.jsx`, agregar antes de `PreSessionHero`:

```jsx
/** El día de esta semana que ya entrenaste. Reemplaza al hero de "empezar":
    el botón principal pasa a ser mirar lo que hiciste, y volver a entrenar
    queda como texto discreto — existe para la doble sesión y para el día que
    te equivocaste, no como camino principal. */
function DoneHero({ sess, wd, today }) {
  const nsets = (sess.entries || []).reduce((a, e) => a + e.sets.length, 0);
  const prs = sessionPRs(sess);
  return (
    <div className="card hero done-hero">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--ok)', boxShadow: '0 0 8px var(--ok)' }}></span>
        <div className="txt-mut" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          Completado · {wd === today.getDay() ? 'hoy' : WD[wd]}
        </div>
      </div>
      <div className="hero-day">{sess.dayName || WD[wd]}</div>
      <div className="hero-stats">
        <div><div className="cond">{sess.duration}</div><span>Minutos</span></div>
        <div><div className="cond">{nsets}</div><span>Series</span></div>
        <div><div className="cond">{(sess.entries || []).length}</div><span>Ejercicios</span></div>
      </div>
      {prs.length > 0 && (
        <div className="done-pr">
          🏆 {prs.length} récord{prs.length === 1 ? '' : 's'} · {prs.map(p => `${p.name} ${fmtNum(round1(p.w))} × ${p.r}`).join(' · ')}
        </div>
      )}
      <button type="button" className="btn hero-cta ok" onClick={() => openSheet('session-view', { id: sess.id })}>
        Ver lo que hiciste
      </button>
      <button type="button" className="done-again" onClick={() => openSheet('sess-start-info', { wd })}>
        Entrenar de nuevo
      </button>
    </div>
  );
}
```

Esto usa `fmtNum` y `round1`, que el Task 3 sacó de los imports de `Hoy.jsx` al borrar `HistDetail` — hay que volver a agregarlos al import de `format.js`.

- [ ] **Step 3: Elegir entre los dos heroes**

En el JSX de `Hoy`, reemplazar la línea que renderiza el hero:

```jsx
<PreSessionHero day={shown.day} wd={shown.wd} exs={shown.exs} today={today} />
```

por:

```jsx
<HeroForDay day={shown.day} wd={shown.wd} exs={shown.exs} today={today} />
```

Y agregar el selector junto a los otros subcomponentes:

```jsx
/** Un día de esta semana que ya tiene sesión cerrada muestra el resumen; el
    resto, la invitación a empezar. */
function HeroForDay({ day, wd, exs, today }) {
  const done = sessionForWeekday(wd);
  return done
    ? <DoneHero sess={done} wd={wd} today={today} />
    : <PreSessionHero day={day} wd={wd} exs={exs} today={today} />;
}
```

- [ ] **Step 4: Marcar los días hechos en la tira semanal**

En el `.wkstrip`, dentro del `WEEK_ORDER.map`, agregar el cálculo y la clase:

```jsx
              const dayR = S.routine[d];
              const has = dayR?.exercises?.length;
              const isToday = d === today.getDay();
              const hecho = !!has && !!sessionForWeekday(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`wd ${has ? 'has' : ''} ${d === wd ? 'on' : ''} ${isToday ? 'today' : ''} ${hecho ? 'done' : ''}`}
                  onClick={() => { S.hoyDay = d; bump(); }}
                >
                  <div className="l">{WD1[d]}</div>
                  <div className="n">{has ? (dayR.name || 'Rutina') : 'Descanso'}</div>
                  {hecho && <div className="tick">✓</div>}
                </button>
              );
```

- [ ] **Step 5: Estilos**

En `src/styles.css`, agregar después del bloque de `.wkstrip`:

```css
.wkstrip .wd{position:relative}
.wkstrip .wd.done{border-color:rgba(16,185,129,.35);background:rgba(16,185,129,.07)}
.wkstrip .wd .tick{
  position:absolute;top:3px;right:4px;
  font-size:9px;font-weight:700;color:var(--ok);line-height:1;
}
/* el día ya entrenado: mismo hero, en verde en vez de azul */
.done-hero{
  background:linear-gradient(158deg,rgba(16,185,129,.14),rgba(255,255,255,.03) 58%),var(--card);
  border-color:rgba(16,185,129,.3);
}
.done-pr{
  margin-top:12px;padding:9px 12px;border-radius:12px;font-size:12.5px;line-height:1.4;
  background:rgba(255,180,84,.1);border:1px solid rgba(255,180,84,.3);color:var(--warn);font-weight:500;
}
.done-again{
  display:block;width:100%;margin-top:10px;padding:6px;
  font-size:13px;font-weight:600;color:var(--mut);background:none;border:none;
}
.done-again:active{color:var(--blue2)}
```

- [ ] **Step 6: Tests, lint y build**

Run: `npm run test && npm run lint && npm run build:only`
Expected: tests PASS, 6 warnings preexistentes, build OK.

- [ ] **Step 7: Verificación manual**

Run: `npm run dev`
1. Completar una sesión de hoy.
2. La pantalla Hoy muestra el hero verde "Completado · hoy" con las tres stats.
3. "Ver lo que hiciste" abre `SessionView`; "Entrenar de nuevo" abre el flujo de iniciar.
4. La tira semanal muestra ✓ en el día hecho.
5. Cambiar a otro día de la semana sin sesión → vuelve el hero azul con "Empezar entrenamiento".

- [ ] **Step 8: Commit**

```bash
git add src/components/screens/Hoy.jsx src/styles.css
git commit -m "feat(web): el día ya entrenado muestra el resumen, no el botón de empezar"
```

---

## Task 6: Corregir una sesión ya cerrada

**Files:**
- Modify: `src/components/sheets/SessionView.jsx` (modo edición)
- Modify: `src/styles.css` (`.set-edit`)

**Interfaces:**
- Consumes: `updateHistorySession` (session.js, Task 2).
- Produces: nada nuevo hacia afuera.

- [ ] **Step 1: Agregar el estado de edición a `SessionView`**

Cambiar los imports y la firma para sumar `useState` y los helpers:

```jsx
import { useState } from 'react';
import { S, useStore, openSheet, closeSheet } from '../../lib/state.js';
import { WD, fmtDFull, fmtNum, round1, uid } from '../../lib/format.js';
import { sessionPRs, deleteHistorySession, updateHistorySession } from '../../lib/session.js';
```

Dentro del componente, después de `if (!s) return null;`:

```jsx
  const [editando, setEditando] = useState(false);
```

- [ ] **Step 2: Agregar las mutaciones**

Dentro de `SessionView`, agregar:

```jsx
  /* Toda edición clona la sesión, la muta y la manda entera a
     updateHistorySession — que guarda y ofrece Deshacer. start/end/duration/
     date/weekday/dayName no se tocan en ninguna de estas funciones. */
  function editar(fn, msg) {
    const copia = structuredClone(s);
    fn(copia);
    copia.entries = (copia.entries || []).filter(e => e.sets.length);
    updateHistorySession(copia, msg);
  }

  const setSerie = (ei, si, campo, valor) => editar(c => {
    const n = campo === 'w' ? Math.max(0, round1(parseFloat(valor) || 0)) : Math.max(1, parseInt(valor, 10) || 1);
    c.entries[ei].sets[si][campo] = n;
  }, 'Serie corregida');

  const borrarSerie = (ei, si) => editar(c => { c.entries[ei].sets.splice(si, 1); }, 'Serie borrada');

  const duplicarSerie = (ei) => editar(c => {
    const sets = c.entries[ei].sets;
    const ult = sets[sets.length - 1];
    sets.push({ w: ult ? ult.w : 20, r: ult ? ult.r : 10, t: Date.now() });
  }, 'Serie agregada');

  const borrarEjercicio = (ei) => editar(c => { c.entries[ei].sets = []; }, 'Ejercicio borrado');

  const agregarEjercicio = (ex) => editar(c => {
    c.entries.push({ exId: ex.id || uid(), name: ex.name, equip: ex.equip, machine: ex.machine, sets: [{ w: 20, r: ex.reps || 10, t: Date.now() }] });
  }, `${ex.name} agregado`);
```

- [ ] **Step 3: Renderizar las series según el modo**

Reemplazar el bloque `{(s.entries || []).map(…)}` por:

```jsx
      {(s.entries || []).map((e, ei) => (
        <div key={ei} className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div className="cond grow" style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>{e.name}</div>
            {editando && (
              <button type="button" className="mini red" title="Quitar ejercicio" onClick={() => borrarEjercicio(ei)}>✕</button>
            )}
          </div>
          {editando ? (
            <>
              {e.sets.map((st, si) => (
                <div key={si} className="set-edit">
                  <span className="i">{si + 1}</span>
                  <input
                    type="number" inputMode="decimal" step="any" defaultValue={fmtNum(round1(st.w))}
                    onBlur={ev => setSerie(ei, si, 'w', ev.target.value)}
                  />
                  <span className="u">kg ×</span>
                  <input
                    type="number" inputMode="numeric" defaultValue={st.r}
                    onBlur={ev => setSerie(ei, si, 'r', ev.target.value)}
                  />
                  <button type="button" className="mini red" onClick={() => borrarSerie(ei, si)}>✕</button>
                </div>
              ))}
              <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => duplicarSerie(ei)}>
                + Serie
              </button>
            </>
          ) : (
            <div className="chips">
              {e.sets.map((st, si) => (
                <span key={si} className="chip">{fmtNum(round1(st.w))}kg × {st.r}</span>
              ))}
            </div>
          )}
        </div>
      ))}
```

Los inputs guardan en `onBlur`, no en `onChange` — mismo criterio que `Settings.jsx`: escribir a IndexedDB en cada tecla persiste dígitos parciales, y reescribir el `.value` desde el propio `onChange` es el bug que documenta `ExerciseCarousel.jsx`.

- [ ] **Step 4: Agregar el botón de editar y la lista de ejercicios del día**

Reemplazar el bloque final de botones por:

```jsx
      {editando && (
        <>
          <div className="sect">Agregar un ejercicio que hiciste</div>
          <div className="chips" style={{ marginBottom: 'var(--s3)' }}>
            {(S.routine[s.weekday]?.exercises || [])
              .filter(ex => !(s.entries || []).some(e => e.name === ex.name))
              .map(ex => (
                <span key={ex.id} className="chip blue" onClick={() => agregarEjercicio(ex)}>＋ {ex.name}</span>
              ))}
          </div>
        </>
      )}

      {justFinished ? (
        <button type="button" className={`btn ${hasPR ? 'ok' : ''}`} style={{ marginTop: 18 }} onClick={closeSheet}>
          Guardar y cerrar
        </button>
      ) : (
        <>
          <button type="button" className="btn ghost" style={{ marginTop: 14 }} onClick={() => setEditando(v => !v)}>
            {editando ? '✓ Listo' : '✎ Corregir lo que anoté'}
          </button>
          <div className="txt-mut" style={{ fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 1.45 }}>
            Los minutos y la fecha no cambian: sólo se corrigen los pesos y las series.
          </div>
          <button type="button" className="btn danger sm" style={{ marginTop: 14 }} onClick={() => confirmDel(s.id)}>
            Eliminar sesión
          </button>
        </>
      )}
```

- [ ] **Step 5: Estilos de la fila editable**

En `src/styles.css`, agregar:

```css
/* fila de serie en modo corrección */
.set-edit{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line)}
.set-edit:last-of-type{border-bottom:none}
.set-edit .i{
  width:22px;height:22px;flex:none;display:grid;place-items:center;border-radius:7px;
  background:var(--card2);color:var(--mut);font-size:11px;font-weight:700;
}
.set-edit input{
  width:64px;flex:none;text-align:center;padding:6px 4px;border-radius:10px;
  background:var(--card2);border:1px solid var(--line2);
  font-family:'Barlow Condensed';font-weight:700;font-size:18px;
  font-variant-numeric:tabular-nums;
}
.set-edit .u{font-size:12px;color:var(--mut);flex:none}
.set-edit .mini{margin-left:auto}
```

- [ ] **Step 6: Tests, lint y build**

Run: `npm run test && npm run lint && npm run build:only`
Expected: tests PASS, 6 warnings preexistentes, build OK.

- [ ] **Step 7: Verificación manual**

Run: `npm run dev`
1. Abrir una sesión del historial → "✎ Corregir lo que anoté".
2. Cambiar un peso y salir del campo → toast "Serie corregida" con Deshacer.
3. Tocar Deshacer → vuelve el valor anterior.
4. Borrar una serie, agregar una, agregar un ejercicio del día.
5. **Verificar que los minutos y la fecha del encabezado no cambiaron nunca.**
6. Cerrar y reabrir el sheet: los cambios persisten.
7. Ir a Progreso → los PRs y el gráfico de carga reflejan el peso corregido.

- [ ] **Step 8: Commit**

```bash
git add src/components/sheets/SessionView.jsx src/styles.css
git commit -m "feat(web): corregir una sesión ya cerrada sin tocar el tiempo registrado"
```

---

## Task 7: Preview vivo al arrastrar un día

**Files:**
- Modify: `src/lib/rutina-logic.js` (agregar `previewDayDrop`)
- Modify: `src/lib/drag.js` (`dragStart` y la rama `days` de `dragUpdate`)
- Modify: `src/styles.css` (`body.dragging-on .day-body`)
- Test: `src/lib/__tests__/rutina-logic.test.js`

**Interfaces:**
- Consumes: `dayIsFree`, `nextFreeDay` (rutina-logic.js, ya existen).
- Produces: `previewDayDrop(fromWd, toWd) -> { [weekdayOrigen]: weekdayDestino }`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/__tests__/rutina-logic.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import { previewDayDrop } from '../rutina-logic.js';

const dia = (wd, name) => ({ weekday: wd, name, exercises: [{ id: 'x' + wd, name: 'Press', sets: 4, reps: 10 }] });
const libre = wd => ({ weekday: wd, name: '', exercises: [] });

describe('previewDayDrop', () => {
  beforeEach(() => {
    S.routine = {};
    S.cfg.dayDrop = 'ask';
  });

  it('destino libre: sólo se muda el origen', () => {
    S.routine = { 1: dia(1, 'Push'), 2: libre(2), 3: libre(3), 4: libre(4), 5: libre(5), 6: libre(6), 0: libre(0) };
    expect(previewDayDrop(1, 4)).toEqual({ 1: 4 });
  });

  it('destino ocupado con "ask" previsualiza el corrimiento al próximo día libre', () => {
    S.routine = { 1: dia(1, 'Push'), 2: dia(2, 'Pull'), 3: libre(3), 4: libre(4), 5: libre(5), 6: libre(6), 0: libre(0) };
    // Push va al martes; Pull se corre al primer libre después del martes: miércoles
    expect(previewDayDrop(1, 2)).toEqual({ 1: 2, 2: 3 });
  });

  it('con dayDrop="swap" previsualiza el intercambio', () => {
    S.cfg.dayDrop = 'swap';
    S.routine = { 1: dia(1, 'Push'), 2: dia(2, 'Pull'), 3: libre(3), 4: libre(4), 5: libre(5), 6: libre(6), 0: libre(0) };
    expect(previewDayDrop(1, 2)).toEqual({ 1: 2, 2: 1 });
  });

  it('con la semana llena el corrimiento degenera en intercambio', () => {
    S.routine = { 1: dia(1, 'A'), 2: dia(2, 'B'), 3: dia(3, 'C'), 4: dia(4, 'D'), 5: dia(5, 'E'), 6: dia(6, 'F'), 0: dia(0, 'G') };
    expect(previewDayDrop(1, 2)).toEqual({ 1: 2, 2: 1 });
  });

  it('soltar sobre sí mismo o arrastrar un día libre no previsualiza nada', () => {
    S.routine = { 1: dia(1, 'Push'), 2: libre(2), 3: libre(3), 4: libre(4), 5: libre(5), 6: libre(6), 0: libre(0) };
    expect(previewDayDrop(1, 1)).toEqual({});
    expect(previewDayDrop(2, 1)).toEqual({});
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm run test`
Expected: FAIL — `previewDayDrop is not a function`.

- [ ] **Step 3: Implementar `previewDayDrop`**

En `src/lib/rutina-logic.js`, justo antes de `dropDayOn`, agregar:

```js
/** Dónde terminaría el contenido de cada día si soltaras `from` sobre `to`.
    Devuelve un mapa { weekday origen -> weekday destino }.

    Usa exactamente las mismas reglas que applyDayDrop (nextFreeDay + la
    preferencia S.cfg.dayDrop), así que el preview del arrastre no puede
    mentir: si cambia la regla, cambian los dos a la vez. Con 'ask' se
    previsualiza el corrimiento, que es la primera opción que ofrece el sheet
    day-drop. */
export function previewDayDrop(fromWd, toWd) {
  const from = +fromWd, to = +toWd;
  const map = {};
  if (from === to || dayIsFree(from)) return map;
  map[from] = to;
  if (dayIsFree(to)) return map;
  const parked = (S.cfg.dayDrop === 'swap') ? null : nextFreeDay(to, from);
  map[to] = (parked === null || parked === from) ? from : parked;
  return map;
}
```

- [ ] **Step 4: Correr los tests**

Run: `npm run test`
Expected: PASS — todos.

- [ ] **Step 5: Colapsar el día abierto antes de medir, en `dragStart`**

En `src/lib/drag.js`, agregar los imports:

```js
import { flushSync } from 'react-dom';
```

y sumar `previewDayDrop` al import que ya trae de `rutina-logic.js`.

Reemplazar el cuerpo de `dragStart` desde el inicio hasta el cálculo de `rects` por:

```js
export function dragStart(card, clientY) {
  const box = card.parentElement;
  const kind = box.dataset.sort;
  // Un día abierto mide el doble que un descanso, y con alturas dispares el
  // preview salta. Se colapsa ANTES de medir. El orden importa: .day-body
  // anima grid-template-rows en 340ms, así que primero va la clase que apaga
  // esa transición (body.dragging-on) y recién después el colapso, o los
  // rects se miden a mitad de la animación.
  document.body.classList.add('dragging-on');
  if (kind === 'days' && S.rutOpen != null) {
    S.rutOpen = null;
    flushSync(() => bump());
  }
  const cards = [...box.children].filter(k => k.dataset.sid);
  const from = cards.indexOf(card);
  if (from < 0) { document.body.classList.remove('dragging-on'); return; }
  const rects = cards.map(k => { const r = k.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; });
  const gap = Math.max(0, rects[1].top - (rects[0].top + rects[0].h));
  Object.assign(DRAG, { on: true, box, el: card, cards, rects, gap, from, to: from, y0: clientY + scrollY, self: 0, cy: clientY, kind });
  card.classList.remove('shift', 'settling');
  card.classList.add('dragging');
  // Todas las tarjetas menos la arrastrada llevan .shift, que es sólo la
  // transición de transform. En modo lista abre el hueco; en modo días es lo
  // que hace que el preview se deslice en vez de saltar.
  cards.forEach((k, i) => { if (i !== from) k.classList.add('shift'); });
  vibrate(18);
  DRAG.raf = requestAnimationFrame(dragTick);
}
```

- [ ] **Step 6: Previsualizar en la rama `days` de `dragUpdate`**

En `dragUpdate()`, reemplazar el bloque `if (DRAG.kind === 'days') { … }` por:

```js
  if (DRAG.kind === 'days') {
    // El destino es el día que está bajo EL DEDO, no bajo el centro de la
    // tarjeta que arrastrás: acá las tarjetas miden distinto y el centro de la
    // que llevás puede caer dos días más abajo de donde estás apuntando.
    const py = DRAG.cy + scrollY;
    let to = -1;
    DRAG.rects.forEach((r, i) => { if (py >= r.top && py <= r.top + r.h) to = i; });
    if (to < 0) {   // en los huecos entre tarjetas, la más cercana
      let best = Infinity;
      DRAG.rects.forEach((r, i) => {
        const d = Math.abs(py - (r.top + r.h / 2));
        if (d < best) { best = d; to = i; }
      });
    }
    if (to !== DRAG.to) {
      DRAG.to = to;
      DRAG.cards.forEach((k, i) => k.classList.toggle('drop-target', i === to && i !== DRAG.from));
      dragPreviewDays(to);
      if (to !== DRAG.from) vibrate(6);
    }
    return;
  }
```

Y agregar la función nueva justo después de `dragUpdate`:

```js
/* El preview: cada día afectado se desliza hacia donde terminaría su contenido
   si soltaras acá. La tarjeta arrastrada no entra — a esa la mueve el dedo. */
function dragPreviewDays(to) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clear = () => DRAG.cards.forEach((k, i) => { if (i !== DRAG.from) k.style.transform = ''; });
  if (reduce || to < 0 || to === DRAG.from) { clear(); return; }
  const map = previewDayDrop(+DRAG.cards[DRAG.from].dataset.sid, +DRAG.cards[to].dataset.sid);
  DRAG.cards.forEach((k, i) => {
    if (i === DRAG.from) return;
    const dest = map[+k.dataset.sid];
    if (dest == null) { k.style.transform = ''; return; }
    const j = DRAG.cards.findIndex(c => +c.dataset.sid === dest);
    k.style.transform = j < 0 ? '' : `translateY(${DRAG.rects[j].top - DRAG.rects[i].top}px)`;
  });
}
```

- [ ] **Step 7: Apagar la transición del cuerpo del día mientras se arrastra**

En `src/styles.css`, junto a las otras reglas de `body.dragging-on`, agregar:

```css
/* mientras se arrastra un día no puede haber una altura animándose: los rects
   del preview se miden justo después de colapsar el día abierto */
body.dragging-on .day-body{transition:none}
```

- [ ] **Step 8: Tests, lint y build**

Run: `npm run test && npm run lint && npm run build:only`
Expected: tests PASS, 6 warnings preexistentes, build OK.

- [ ] **Step 9: Verificación manual**

Run: `npm run dev`
1. Rutina → "Editar rutina". Abrir un día para que quede desplegado.
2. Mantener presionado un día con rutina: el día abierto se colapsa de golpe (sin animación) y la tarjeta se levanta.
3. Arrastrar sobre un día ocupado: ese día se desliza hacia su próximo día libre — **antes** de soltar.
4. Arrastrar sobre un día de descanso: sólo se ilumina, nadie se corre.
5. Soltar → sale el sheet de confirmación → el resultado coincide con lo que mostraba el preview.
6. En Ajustes poner "Intercambiar" y repetir: el preview ahora muestra el swap.

- [ ] **Step 10: Commit**

```bash
git add src/lib/rutina-logic.js src/lib/drag.js src/styles.css src/lib/__tests__/rutina-logic.test.js
git commit -m "feat(web): el arrastre de días muestra el resultado antes de soltar"
```

---

## Task 8: Exportar e importar la tabla de alimentos en Markdown

**Files:**
- Create: `src/lib/foodmd.js`
- Modify: `src/components/sheets/Settings.jsx` (dos botones)
- Test: `src/lib/__tests__/foodmd.test.js`

**Interfaces:**
- Consumes: `FOOD_TABLE` (foodtable.js), `S`, `idb`, `norm`, `uid`, `toast`.
- Produces:
  - `foodsToMD(list) -> string`
  - `parseFoodsMD(texto) -> [{name, alias, kcal, p, c, f, unit, cat}]`
  - `exportFoodsMD() -> void` (descarga el archivo)
  - `importFoodsMD(file) -> Promise<void>`

**Forma del alimento importado:** `{ id, name, alias: string[], kcal, p, c, f, unit: number|null, cat: string|null, base: '100g' }`. Los `S.foods` existentes no tienen `base` y se leen como `'portion'` (Task 9 formaliza la distinción).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/__tests__/foodmd.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { foodsToMD, parseFoodsMD } from '../foodmd.js';

const pollo = { name: 'Pollo', alias: ['pechuga', 'pollo a la plancha'], kcal: 165, p: 31, c: 0, f: 3.6, unit: 150, cat: 'Proteínas' };
const huevo = { name: 'Huevo', alias: ['huevos'], kcal: 143, p: 12.6, c: 0.7, f: 9.5, unit: 55, cat: 'Proteínas' };

describe('foodsToMD', () => {
  it('genera una tabla markdown con encabezado explicativo', () => {
    const md = foodsToMD([pollo]);
    expect(md).toContain('| Alimento |');
    expect(md).toContain('| Pollo |');
    expect(md).toContain('pechuga, pollo a la plancha');
    expect(md).toContain('165');
    expect(md).toContain('Macros por 100 g');
  });
});

describe('parseFoodsMD', () => {
  it('lee la tabla que genera foodsToMD (ida y vuelta)', () => {
    const salida = parseFoodsMD(foodsToMD([pollo, huevo]));
    expect(salida).toHaveLength(2);
    expect(salida[0]).toMatchObject({ name: 'Pollo', kcal: 165, p: 31, c: 0, f: 3.6, unit: 150, cat: 'Proteínas' });
    expect(salida[0].alias).toEqual(['pechuga', 'pollo a la plancha']);
    expect(salida[1]).toMatchObject({ name: 'Huevo', kcal: 143, p: 12.6, unit: 55 });
  });

  it('ignora el encabezado, la fila de separadores y las líneas sueltas', () => {
    const md = `# Alimentos
texto suelto que no es tabla

| Alimento | Alias | kcal | P | C | G | Unidad | Categoría |
|---|---|---:|---:|---:|---:|---:|---|
| Arroz |  | 130 | 2.7 | 28 | 0.3 | 200 | Carbos |
`;
    const salida = parseFoodsMD(md);
    expect(salida).toHaveLength(1);
    expect(salida[0]).toMatchObject({ name: 'Arroz', kcal: 130, unit: 200, cat: 'Carbos' });
    expect(salida[0].alias).toEqual([]);
  });

  it('acepta coma decimal y celdas vacías', () => {
    const md = `| Alimento | Alias | kcal | P | C | G | Unidad | Categoría |
|---|---|---:|---:|---:|---:|---:|---|
| Palta |  | 160 | 2 | 9 | 15,3 |  |  |
`;
    const salida = parseFoodsMD(md);
    expect(salida[0].f).toBe(15.3);
    expect(salida[0].unit).toBe(null);
    expect(salida[0].cat).toBe(null);
  });

  it('descarta filas sin nombre o sin calorías', () => {
    const md = `| Alimento | Alias | kcal | P | C | G | Unidad | Categoría |
|---|---|---:|---:|---:|---:|---:|---|
|  |  | 100 | 1 | 1 | 1 |  |  |
| Sin datos |  |  |  |  |  |  |  |
| Bueno |  | 50 | 1 | 2 | 0 |  |  |
`;
    expect(parseFoodsMD(md).map(f => f.name)).toEqual(['Bueno']);
  });

  it('un archivo vacío o sin tabla devuelve lista vacía', () => {
    expect(parseFoodsMD('')).toEqual([]);
    expect(parseFoodsMD('# Nada\n\nsólo prosa.')).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm run test`
Expected: FAIL — no existe `../foodmd.js`.

- [ ] **Step 3: Implementar `foodmd.js`**

Crear `src/lib/foodmd.js`:

```js
// La tabla de alimentos, de ida y vuelta a Markdown.
//
// Exportar sin poder importar no lleva a ningún lado, así que las dos mitades
// nacen juntas y comparten el mismo formato: la salida de foodsToMD() la lee
// parseFoodsMD() sin perder nada.
//
// Todo por 100 g. "Unidad" es cuánto pesa una porción natural (1 huevo, 1
// scoop) y es opcional. Las reglas van escritas en el encabezado del propio
// archivo para poder editarlo en cualquier editor sin consultar nada.
import { S } from './state.js';
import { idb } from './db.js';
import { dstr, uid, norm } from './format.js';
import { FOOD_TABLE } from './foodtable.js';
import { toast } from './toast.js';

const COLS = ['Alimento', 'Alias', 'kcal', 'P', 'C', 'G', 'Unidad', 'Categoría'];

const ENCABEZADO = `# Alimentos · FIERRO

Macros **por 100 g**. "Unidad" es cuánto pesa una porción natural
(1 huevo, 1 scoop) y es opcional. Los alias van separados por coma.

Podés editar, agregar o borrar filas y volver a importar el archivo desde
Ajustes. Al importar, tus alimentos ganan sobre la tabla incorporada.
`;

/** Número de celda: acepta coma decimal y celda vacía. */
function num(cell) {
  const t = String(cell ?? '').trim().replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

function texto(cell) {
  const t = String(cell ?? '').trim();
  return t || null;
}

/** Serializa una lista de alimentos (forma por 100 g) a la tabla markdown. */
export function foodsToMD(list) {
  const filas = (list || []).map(f => [
    f.name,
    (f.alias || []).join(', '),
    f.kcal ?? '',
    f.p ?? '',
    f.c ?? '',
    f.f ?? '',
    f.unit ?? '',
    f.cat ?? '',
  ]);
  const lineas = [
    `| ${COLS.join(' | ')} |`,
    '|---|---|---:|---:|---:|---:|---:|---|',
    ...filas.map(r => `| ${r.join(' | ')} |`),
  ];
  return `${ENCABEZADO}\n${lineas.join('\n')}\n`;
}

/** Lee la tabla markdown. Ignora todo lo que no sea una fila de datos: el
    encabezado en prosa, la fila de guiones y cualquier línea suelta. */
export function parseFoodsMD(texto_) {
  const out = [];
  for (const linea of String(texto_ || '').split(/\r?\n/)) {
    const t = linea.trim();
    if (!t.startsWith('|')) continue;
    const celdas = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    if (celdas.length < 6) continue;
    if (celdas.every(c => /^:?-{2,}:?$/.test(c) || !c)) continue;   // fila de separadores
    const name = texto(celdas[0]);
    const kcal = num(celdas[2]);
    if (!name || kcal === null) continue;                            // encabezado y filas incompletas
    if (norm(name) === 'alimento') continue;                         // la fila de títulos
    out.push({
      name,
      alias: (celdas[1] || '').split(',').map(a => a.trim()).filter(Boolean),
      kcal,
      p: num(celdas[3]) ?? 0,
      c: num(celdas[4]) ?? 0,
      f: num(celdas[5]) ?? 0,
      unit: num(celdas[6]),
      cat: texto(celdas[7]),
    });
  }
  return out;
}

/** Todo lo que la app conoce, en forma "por 100 g": la tabla incorporada más
    los alimentos tuyos que ya estén en esa base. */
function todoParaExportar() {
  const mios = S.foods.filter(f => f.base === '100g').map(f => ({
    name: f.name, alias: f.alias || [], kcal: f.kcal, p: f.p, c: f.c, f: f.f, unit: f.unit ?? null, cat: f.cat ?? null,
  }));
  const tomados = new Set(mios.map(f => norm(f.name)));
  const tabla = FOOD_TABLE
    .filter(it => !tomados.has(norm(it.n)))
    .map(it => ({ name: it.n, alias: it.a || [], kcal: it.kcal, p: it.p, c: it.c, f: it.f, unit: it.u ?? null, cat: null }));
  return [...mios, ...tabla];
}

export function exportFoodsMD() {
  const blob = new Blob([foodsToMD(todoParaExportar())], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fierro-alimentos-${dstr()}.md`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Alimentos exportados');
}

/** Merge por nombre normalizado: actualiza los que ya tenías y agrega los
    nuevos. No borra nada — un archivo recortado no te vacía la base. */
export async function importFoodsMD(file) {
  let filas;
  try {
    filas = parseFoodsMD(await file.text());
  } catch {
    toast('⚠ No se pudo leer el archivo');
    return;
  }
  if (!filas.length) { toast('⚠ No encontré ninguna fila de alimentos'); return; }

  const porNombre = new Map(S.foods.map(f => [norm(f.name), f]));
  let nuevos = 0, actualizados = 0;
  for (const r of filas) {
    const existente = porNombre.get(norm(r.name));
    const food = {
      id: existente ? existente.id : uid(),
      name: r.name, alias: r.alias, kcal: r.kcal, p: r.p, c: r.c, f: r.f,
      unit: r.unit, cat: r.cat, base: '100g',
    };
    await idb.put('foods', food);
    if (existente) { Object.assign(existente, food); actualizados++; }
    else { S.foods.push(food); porNombre.set(norm(food.name), food); nuevos++; }
  }
  toast(`${nuevos} alimento${nuevos === 1 ? '' : 's'} nuevo${nuevos === 1 ? '' : 's'} · ${actualizados} actualizado${actualizados === 1 ? '' : 's'}`);
}
```

- [ ] **Step 4: Correr los tests**

Run: `npm run test`
Expected: PASS — todos.

- [ ] **Step 5: Agregar los botones a Ajustes**

En `src/components/sheets/Settings.jsx`, agregar el import:

```jsx
import { exportFoodsMD, importFoodsMD } from '../../lib/foodmd.js';
```

Agregar un ref y un handler junto a los que ya existen:

```jsx
  const mdRef = useRef(null);

  function onMdFile(e) {
    const f = e.target.files[0];
    if (f) importFoodsMD(f);
    e.target.value = '';
  }
```

Y una sección nueva, justo antes de `<h3>Respaldo</h3>`:

```jsx
      <h3>Mi base de alimentos</h3>
      <div className="txt-mut" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
        Bajá la tabla en Markdown, editala donde quieras y volvé a subirla. Se
        actualizan los que ya tenías y se agregan los nuevos — nada se borra.
      </div>
      <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={() => exportFoodsMD()}>⬇ Exportar alimentos a MD</button>
      <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={() => mdRef.current?.click()}>⬆ Importar alimentos MD</button>
      <input ref={mdRef} type="file" accept=".md,text/markdown,text/plain" hidden onChange={onMdFile} />
```

- [ ] **Step 6: Lint y build**

Run: `npm run test && npm run lint && npm run build:only`
Expected: tests PASS, 6 warnings preexistentes, build OK.

- [ ] **Step 7: Verificación manual del viaje redondo**

Run: `npm run dev`
1. Ajustes → "⬇ Exportar alimentos a MD" → se baja `fierro-alimentos-YYYY-MM-DD.md`.
2. Abrir el archivo: tiene el encabezado y ~55 filas.
3. Editar una fila (cambiar las kcal del pollo a 999) y agregar una fila nueva.
4. "⬆ Importar alimentos MD" → toast con la cuenta de nuevos y actualizados.
5. Volver a exportar: el pollo sale con 999 y la fila nueva está.

- [ ] **Step 8: Commit**

```bash
git add src/lib/foodmd.js src/lib/__tests__/foodmd.test.js src/components/sheets/Settings.jsx
git commit -m "feat(web): exportar e importar la base de alimentos en Markdown"
```

---

## Task 9: Índice y buscador de alimentos

**Files:**
- Create: `src/lib/foodsearch.js`
- Test: `src/lib/__tests__/foodsearch.test.js`

**Interfaces:**
- Consumes: `FOOD_TABLE` (foodtable.js), `S.foods`, `S.meals`, `norm`, `round1`.
- Produces:
  - `foodIndex() -> [{key, name, alias, kcal, p, c, f, unit, cat, base, source}]` — alimentos tuyos primero, tabla como respaldo, deduplicado por nombre normalizado.
  - `searchFoods(query, {slot, limit}) -> Food[]`
  - `macrosFor(food, grams) -> {kcal, p, c, f}` — escala según `base`.
  - `defaultGrams(food) -> number`

**Regla de `base`:** `'100g'` → los macros son por 100 g y se escalan. `'portion'` (o ausente, que es lo que tienen todos los `S.foods` viejos) → los macros son de UNA porción; `grams` se interpreta contra `unit`, y si no hay `unit` la porción vale 100 g para que la cuenta sea la identidad.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/__tests__/foodsearch.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import { foodIndex, searchFoods, macrosFor, defaultGrams } from '../foodsearch.js';

beforeEach(() => { S.foods = []; S.meals = []; });

describe('foodIndex', () => {
  it('incluye la tabla incorporada', () => {
    expect(foodIndex().some(f => f.name === 'pollo')).toBe(true);
  });

  it('tus alimentos ganan sobre la tabla con el mismo nombre', () => {
    S.foods = [{ id: '1', name: 'Pollo', kcal: 999, p: 1, c: 1, f: 1, base: '100g' }];
    const pollos = foodIndex().filter(f => f.key === 'pollo');
    expect(pollos).toHaveLength(1);
    expect(pollos[0].kcal).toBe(999);
    expect(pollos[0].source).toBe('mine');
  });
});

describe('searchFoods', () => {
  it('el prefijo exacto va primero', () => {
    expect(searchFoods('pollo')[0].name).toBe('pollo');
  });

  it('encuentra por alias', () => {
    expect(searchFoods('pechuga').some(f => f.name === 'pollo')).toBe(true);
  });

  it('ignora acentos y mayúsculas', () => {
    expect(searchFoods('PLATANO').some(f => f.name === 'plátano')).toBe(true);
  });

  it('una consulta vacía devuelve sugerencias, no todo', () => {
    const r = searchFoods('', { limit: 5 });
    expect(r.length).toBeLessThanOrEqual(5);
  });

  it('prioriza lo que comés en ese momento del día', () => {
    S.meals = [
      { id: 'm1', name: 'Avena', slot: 'desayuno', date: '2026-08-01', kcal: 100, p: 1, c: 1, f: 1 },
      { id: 'm2', name: 'Avena', slot: 'desayuno', date: '2026-08-02', kcal: 100, p: 1, c: 1, f: 1 },
    ];
    const r = searchFoods('a', { slot: 'desayuno' });
    expect(r[0].name.toLowerCase()).toBe('avena');
  });
});

describe('macrosFor', () => {
  it('escala un alimento por 100 g', () => {
    const f = { kcal: 165, p: 31, c: 0, f: 3.6, base: '100g' };
    expect(macrosFor(f, 150)).toEqual({ kcal: 248, p: 46.5, c: 0, f: 5.4 });
  });

  it('un alimento por porción con unidad escala contra esa unidad', () => {
    const f = { kcal: 200, p: 20, c: 10, f: 5, base: 'portion', unit: 100 };
    expect(macrosFor(f, 200)).toEqual({ kcal: 400, p: 40, c: 20, f: 10 });
  });

  it('un alimento por porción sin unidad trata 100 g como una porción', () => {
    const f = { kcal: 200, p: 20, c: 10, f: 5, base: 'portion' };
    expect(macrosFor(f, 100)).toEqual({ kcal: 200, p: 20, c: 10, f: 5 });
  });
});

describe('defaultGrams', () => {
  it('usa la unidad natural si existe', () => {
    expect(defaultGrams({ base: '100g', unit: 55 })).toBe(55);
  });

  it('sin unidad natural propone 100 g', () => {
    expect(defaultGrams({ base: '100g' })).toBe(100);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm run test`
Expected: FAIL — no existe `../foodsearch.js`.

- [ ] **Step 3: Implementar `foodsearch.js`**

Crear `src/lib/foodsearch.js`:

```js
// El índice de alimentos y su búsqueda.
//
// Une dos fuentes en una sola forma: TUS alimentos (S.foods, incluidos los que
// importaste en Markdown) y la tabla incorporada (foodtable.js). Los tuyos
// ganan siempre — la misma regla que ya aplica el dictado por voz
// (foodvoice.js). La tabla es el respaldo, nunca la autoridad.
import { S } from './state.js';
import { norm, round1 } from './format.js';
import { FOOD_TABLE } from './foodtable.js';

/** Cuántos gramos proponer por defecto: la porción natural si el alimento la
    declara, si no 100 g. */
export function defaultGrams(food) {
  return food?.unit || 100;
}

/** Macros de `grams` gramos de `food`.

    base '100g'   -> los números son por 100 g y se escalan.
    base 'portion' -> los números son de UNA porción, que pesa `unit` gramos.
      Es lo que tienen todos los S.foods viejos (guardados con "marcar como
      frecuente"), que no traen `base`. Sin `unit` la porción vale 100 g, así
      la cuenta con los 100 g por defecto es la identidad y nada cambia de
      comportamiento para quien ya venía usando la app. */
export function macrosFor(food, grams) {
  const por = food?.base === '100g' ? 100 : (food?.unit || 100);
  const k = (grams || 0) / por;
  return {
    kcal: Math.round((food?.kcal || 0) * k),
    p: round1((food?.p || 0) * k),
    c: round1((food?.c || 0) * k),
    f: round1((food?.f || 0) * k),
  };
}

/** Todos los alimentos conocidos, deduplicados por nombre normalizado. */
export function foodIndex() {
  const out = [];
  const vistos = new Set();
  (S.foods || []).forEach(f => {
    const key = norm(f.name);
    if (!key || vistos.has(key)) return;
    vistos.add(key);
    out.push({
      key, name: f.name, alias: f.alias || [],
      kcal: f.kcal, p: f.p, c: f.c, f: f.f,
      unit: f.unit ?? null, cat: f.cat ?? null,
      base: f.base || 'portion', source: 'mine', id: f.id,
    });
  });
  FOOD_TABLE.forEach(it => {
    const key = norm(it.n);
    if (!key || vistos.has(key)) return;
    vistos.add(key);
    out.push({
      key, name: it.n, alias: it.a || [],
      kcal: it.kcal, p: it.p, c: it.c, f: it.f,
      unit: it.u ?? null, cat: null,
      base: '100g', source: 'table', id: null,
    });
  });
  return out;
}

/** Cuántas veces registraste cada nombre, y cuántas en cada momento del día. */
function uso() {
  const total = new Map(), porSlot = new Map();
  (S.meals || []).forEach(m => {
    const k = norm(m.name);
    if (!k) return;
    total.set(k, (total.get(k) || 0) + 1);
    if (m.slot) {
      const sk = `${m.slot}|${k}`;
      porSlot.set(sk, (porSlot.get(sk) || 0) + 1);
    }
  });
  return { total, porSlot };
}

/* Puntaje de coincidencia. Más alto es mejor; 0 es "no coincide".
   El orden importa: con una sola regla de "contiene", buscar "pollo" ponía
   "pollo a la brasa" a la misma altura que "pollo". */
function puntajeTexto(f, q) {
  const cands = [f.key, ...f.alias.map(norm)].filter(Boolean);
  let best = 0;
  for (const c of cands) {
    if (c === q) best = Math.max(best, 100);
    else if (c.startsWith(q)) best = Math.max(best, 70);
    else if (c.split(/\s+/).some(w => w.startsWith(q))) best = Math.max(best, 50);
    else if (c.includes(q)) best = Math.max(best, 30);
  }
  return best;
}

/**
 * searchFoods('po', { slot: 'almuerzo' })
 *
 * Con `query` vacía devuelve sugerencias: lo que más comés en ese momento del
 * día, después lo que más comés en general. Con query, ordena por coincidencia
 * y desempata por uso.
 */
export function searchFoods(query, { slot = null, limit = 20 } = {}) {
  const q = norm(query || '');
  const idx = foodIndex();
  const { total, porSlot } = uso();
  const usoDe = f => (slot ? (porSlot.get(`${slot}|${f.key}`) || 0) * 10 : 0) + (total.get(f.key) || 0);

  if (!q) {
    return idx
      .map(f => ({ f, u: usoDe(f) }))
      .filter(x => x.u > 0)
      .sort((a, b) => b.u - a.u || a.f.name.localeCompare(b.f.name))
      .slice(0, limit)
      .map(x => x.f);
  }

  return idx
    .map(f => ({ f, s: puntajeTexto(f, q), u: usoDe(f) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || b.u - a.u || a.f.name.length - b.f.name.length || a.f.name.localeCompare(b.f.name))
    .slice(0, limit)
    .map(x => x.f);
}
```

- [ ] **Step 4: Correr los tests**

Run: `npm run test`
Expected: PASS — todos.

- [ ] **Step 5: Lint y build**

Run: `npm run lint && npm run build:only`
Expected: 10 warnings preexistentes, 0 errores, build OK.

- [ ] **Step 6: Commit**

```bash
git add src/lib/foodsearch.js src/lib/__tests__/foodsearch.test.js
git commit -m "feat(web): índice unificado y buscador de alimentos"
```

---

## Task 10: Momentos del día

**Files:**
- Modify: `src/lib/meals.js` (agregar `slotForTime`, `slotOf`, `SLOTS`, `mealsBySlot`)
- Test: `src/lib/__tests__/meals.test.js`

**Interfaces:**
- Consumes: `S`, `norm`.
- Produces:
  - `SLOTS = [{k, label}]` — el orden canónico: desayuno, almuerzo, cena, snack.
  - `slotForTime(hhmm) -> 'desayuno'|'almuerzo'|'cena'|'snack'`
  - `slotOf(meal) -> slot` — el guardado, o el inferido de `meal.t`.
  - `mealsBySlot(date) -> [{k, label, meals, kcal}]` — sólo los bloques con comidas.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/__tests__/meals.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import { slotForTime, slotOf, mealsBySlot } from '../meals.js';

describe('slotForTime', () => {
  it('reparte el día en cuatro momentos', () => {
    expect(slotForTime('07:30')).toBe('desayuno');
    expect(slotForTime('10:59')).toBe('desayuno');
    expect(slotForTime('11:00')).toBe('almuerzo');
    expect(slotForTime('15:59')).toBe('almuerzo');
    expect(slotForTime('16:00')).toBe('cena');
    expect(slotForTime('20:59')).toBe('cena');
    expect(slotForTime('21:00')).toBe('snack');
    expect(slotForTime('02:00')).toBe('desayuno');
  });

  it('sin hora cae en snack', () => {
    expect(slotForTime('')).toBe('snack');
    expect(slotForTime(undefined)).toBe('snack');
  });
});

describe('slotOf', () => {
  it('usa el slot guardado si existe', () => {
    expect(slotOf({ slot: 'cena', t: '08:00' })).toBe('cena');
  });

  it('lo infiere de la hora si la comida es vieja y no lo tiene', () => {
    expect(slotOf({ t: '08:00' })).toBe('desayuno');
  });
});

describe('mealsBySlot', () => {
  beforeEach(() => { S.meals = []; });

  it('agrupa el día en bloques con su subtotal, en orden canónico', () => {
    S.meals = [
      { id: '1', date: '2026-08-04', name: 'Cena', t: '20:00', kcal: 700, p: 40, c: 60, f: 20 },
      { id: '2', date: '2026-08-04', name: 'Avena', t: '08:00', kcal: 300, p: 10, c: 50, f: 6 },
      { id: '3', date: '2026-08-04', name: 'Huevos', t: '08:30', kcal: 200, p: 18, c: 1, f: 14 },
      { id: '4', date: '2026-08-03', name: 'Otro día', t: '08:00', kcal: 999, p: 0, c: 0, f: 0 },
    ];
    const b = mealsBySlot('2026-08-04');
    expect(b.map(x => x.k)).toEqual(['desayuno', 'cena']);
    expect(b[0].kcal).toBe(500);
    expect(b[0].meals).toHaveLength(2);
    expect(b[1].kcal).toBe(700);
  });

  it('un día sin comidas no devuelve bloques', () => {
    expect(mealsBySlot('2026-08-04')).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm run test`
Expected: FAIL — `slotForTime is not a function`.

- [ ] **Step 3: Implementar los helpers en `meals.js`**

Agregar a `src/lib/meals.js`:

```js
/** Los cuatro momentos, en el orden en que se comen. */
export const SLOTS = [
  { k: 'desayuno', label: 'Desayuno' },
  { k: 'almuerzo', label: 'Almuerzo' },
  { k: 'cena', label: 'Cena' },
  { k: 'snack', label: 'Snack' },
];

/** Momento del día para una hora "HH:MM". Los cortes son los de una comida
    peruana normal, no los de un libro: se almuerza tarde y se cena tarde. */
export function slotForTime(t) {
  const h = parseInt(String(t || '').slice(0, 2), 10);
  if (Number.isNaN(h)) return 'snack';
  if (h < 11) return 'desayuno';
  if (h < 16) return 'almuerzo';
  if (h < 21) return 'cena';
  return 'snack';
}

/** El momento de una comida: el que quedó guardado, o el que se deduce de su
    hora. Las comidas viejas no tienen `slot` y NO se migran — inferir al leer
    es reversible, reescribir el historial no. */
export function slotOf(meal) {
  return meal?.slot || slotForTime(meal?.t);
}

/** El día partido en bloques, con el subtotal de kcal de cada uno. Sólo
    devuelve los bloques que tienen algo. */
export function mealsBySlot(date) {
  const del = mealsOf(date);
  return SLOTS
    .map(s => {
      const meals = del.filter(m => slotOf(m) === s.k);
      return { k: s.k, label: s.label, meals, kcal: Math.round(meals.reduce((a, m) => a + (m.kcal || 0), 0)) };
    })
    .filter(b => b.meals.length);
}
```

- [ ] **Step 4: Correr los tests**

Run: `npm run test`
Expected: PASS — todos.

- [ ] **Step 5: Lint y build**

Run: `npm run lint && npm run build:only`
Expected: 10 warnings preexistentes, 0 errores, build OK.

- [ ] **Step 6: Commit**

```bash
git add src/lib/meals.js src/lib/__tests__/meals.test.js
git commit -m "feat(web): momentos del día para las comidas"
```

---

## Task 11: El formulario de comida con buscador y gramos

**Files:**
- Modify: `src/components/sheets/MealForm.jsx` (reescrito)
- Modify: `src/components/screens/Nutricion.jsx` (bloques por momento; abrir el form con slot)
- Modify: `src/styles.css` (`.food-search`, `.food-hit`, `.cart-row`, `.slot-block`)

**Interfaces:**
- Consumes: `searchFoods`, `macrosFor`, `defaultGrams` (foodsearch.js, Task 9); `SLOTS`, `slotForTime`, `mealsBySlot` (meals.js, Task 10).
- Produces: `logMeal(f)` y `addMealFromFood(id)` siguen exportándose con la misma firma — `Nutricion.jsx` los usa para las filas "Un toque" y "Frecuentes".

**Forma de la comida guardada:** se suma `slot` y `items: [{name, grams, kcal, p, c, f}]`. Las comidas viejas no tienen ninguno de los dos y se siguen mostrando como una línea.

- [ ] **Step 1: Reescribir `MealForm.jsx`**

Reemplazar el contenido entero por:

```jsx
// Buscar → elegir → gramos. Antes había que escribir kcal, proteína, carbos y
// grasa a mano en cada comida, con una tabla de 55 alimentos que sólo usaba el
// dictado por voz.
//
// Se conserva la regla de foodvoice.js: nunca se inventan macros. Un alimento
// que no está en ningún lado se crea a mano una vez, con los cuatro campos de
// siempre, y desde entonces queda disponible en el buscador.
//
// Los campos numéricos guardan el string tal cual se tipeó y sólo se
// parsean al confirmar: reescribir el value con un número redondeado en cada
// tecla rompe borrar-y-retipear y corta decimales a medio escribir ("62.").
import { useEffect, useMemo, useRef, useState } from 'react';
import { S, bump, closeSheet } from '../../lib/state.js';
import { uid, vibrate, round1 } from '../../lib/format.js';
import { idb } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { searchFoods, macrosFor, defaultGrams } from '../../lib/foodsearch.js';
import { SLOTS, slotForTime } from '../../lib/meals.js';

const ahora = () => new Date().toTimeString().slice(0, 5);

/** Registra algo con forma {name,kcal,p,c,f} como comida del día seleccionado.
    Lo comparten las filas "Un toque" y "Frecuentes" de Nutricion.jsx. */
export async function logMeal(f, slot) {
  const t = ahora();
  const meal = {
    id: uid(), date: S.nutriDate, name: f.name,
    kcal: f.kcal, p: f.p, c: f.c, f: f.f,
    t, slot: slot || slotForTime(t),
  };
  await idb.put('meals', meal);
  S.meals.push(meal);
  vibrate(12);
  bump();
  toast(`＋ ${f.name}`);
}

export async function addMealFromFood(id) {
  const f = S.foods.find(x => x.id === id);
  if (!f) return;
  await logMeal(f);
}

export default function MealForm({ slot: slotInicial }) {
  const [slot, setSlot] = useState(slotInicial || slotForTime(ahora()));
  const [q, setQ] = useState('');
  const [carrito, setCarrito] = useState([]);   // [{key,name,grams,base,unit,kcal,p,c,f}]
  const [nuevo, setNuevo] = useState(null);     // el alimento que no existe, para crearlo
  const buscarRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => buscarRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const hits = useMemo(() => searchFoods(q, { slot, limit: 8 }), [q, slot]);

  const total = carrito.reduce((a, i) => ({
    kcal: a.kcal + i.kcal, p: round1(a.p + i.p), c: round1(a.c + i.c), f: round1(a.f + i.f),
  }), { kcal: 0, p: 0, c: 0, f: 0 });

  function agregar(food) {
    const grams = defaultGrams(food);
    setCarrito(c => [...c, { key: food.key, name: food.name, base: food.base, unit: food.unit, grams, ...macrosFor(food, grams) }]);
    setQ('');
    buscarRef.current?.focus();
  }

  function setGramos(i, raw) {
    const g = Math.max(0, parseFloat(String(raw).replace(',', '.')) || 0);
    setCarrito(c => c.map((it, j) => {
      if (j !== i) return it;
      const base = { kcal: it.kcal, p: it.p, c: it.c, f: it.f };
      // se re-escala desde los macros por unidad de base, no desde los ya escalados
      const porUnidad = it.grams ? { kcal: base.kcal / it.grams, p: base.p / it.grams, c: base.c / it.grams, f: base.f / it.grams } : null;
      if (!porUnidad) return { ...it, grams: g };
      return {
        ...it, grams: g,
        kcal: Math.round(porUnidad.kcal * g),
        p: round1(porUnidad.p * g), c: round1(porUnidad.c * g), f: round1(porUnidad.f * g),
      };
    }));
  }

  const quitar = i => setCarrito(c => c.filter((_, j) => j !== i));

  async function guardar() {
    if (!carrito.length) { toast('Agregá al menos un alimento'); return; }
    const t = ahora();
    const name = carrito.length === 1 ? carrito[0].name : carrito.map(i => i.name).join(' + ');
    const meal = {
      id: uid(), date: S.nutriDate, name, t, slot,
      kcal: Math.round(total.kcal), p: round1(total.p), c: round1(total.c), f: round1(total.f),
      items: carrito.map(i => ({ name: i.name, grams: i.grams, kcal: i.kcal, p: i.p, c: i.c, f: i.f })),
    };
    await idb.put('meals', meal);
    S.meals.push(meal);
    vibrate(12);
    closeSheet();
    toast('Comida agregada');
  }

  if (nuevo) return <AlimentoNuevo nombre={nuevo} onListo={f => { setNuevo(null); agregar(f); }} onCancel={() => setNuevo(null)} />;

  return (
    <>
      <h2>Agregar comida</h2>

      <div className="seg" style={{ marginBottom: 'var(--s3)' }}>
        {SLOTS.map(s => (
          <button key={s.k} type="button" className={slot === s.k ? 'on' : ''} onClick={() => setSlot(s.k)}>{s.label}</button>
        ))}
      </div>

      <div className="field">
        <input
          ref={buscarRef} value={q} onChange={e => setQ(e.target.value)}
          placeholder="🔍 Buscá un alimento" autoComplete="off"
        />
      </div>

      <div className="food-hits">
        {hits.map(f => (
          <button key={f.key} type="button" className="food-hit" onClick={() => agregar(f)}>
            <span className="grow">
              <span className="t">{f.name}</span>
              {f.source === 'mine' && <span className="eq-tag">tuyo</span>}
            </span>
            <span className="s">{f.kcal} kcal{f.base === '100g' ? '/100g' : '/porción'}</span>
          </button>
        ))}
        {q.trim() && !hits.length && (
          <button type="button" className="food-hit nuevo" onClick={() => setNuevo(q.trim())}>
            <span className="grow"><span className="t">Crear "{q.trim()}"</span></span>
            <span className="s">no lo tengo · lo definís vos</span>
          </button>
        )}
      </div>

      {carrito.length > 0 && (
        <>
          <div className="sect">En esta comida</div>
          <div className="card">
            {carrito.map((i, idx) => (
              <div key={idx} className="cart-row">
                <span className="n">{i.name}</span>
                <input
                  type="number" inputMode="decimal" value={i.grams}
                  onChange={e => setGramos(idx, e.target.value)}
                />
                <span className="u">g</span>
                <span className="k">{i.kcal} kcal</span>
                <button type="button" className="mini red" onClick={() => quitar(idx)}>✕</button>
              </div>
            ))}
            <div className="cart-total">
              <span>Total</span>
              <b>{Math.round(total.kcal)} kcal</b>
            </div>
            <div className="txt-mut" style={{ fontSize: 12.5, textAlign: 'right' }}>
              P {total.p} · C {total.c} · G {total.f}
            </div>
          </div>
        </>
      )}

      <button type="button" className="btn" onClick={guardar}>Agregar</button>
    </>
  );
}

/** El caso "no lo tengo": los cuatro campos de siempre, una sola vez. Se guarda
    en S.foods como base 'portion' — son los macros de lo que te vas a comer,
    no de 100 g. */
function AlimentoNuevo({ nombre, onListo, onCancel }) {
  const [name, setName] = useState(nombre);
  const [kcal, setKcal] = useState('');
  const [prot, setProt] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  async function crear() {
    const trimmed = name.trim();
    if (!trimmed) { toast('Ponle nombre al alimento'); return; }
    const food = {
      id: uid(), name: trimmed,
      kcal: Math.max(0, parseFloat(kcal) || 0),
      p: Math.max(0, parseFloat(prot) || 0),
      c: Math.max(0, parseFloat(carbs) || 0),
      f: Math.max(0, parseFloat(fat) || 0),
      base: 'portion', unit: null, alias: [], cat: null,
    };
    await idb.put('foods', food);
    S.foods.push(food);
    bump();
    onListo({ key: trimmed.toLowerCase(), name: food.name, base: 'portion', unit: null, kcal: food.kcal, p: food.p, c: food.c, f: food.f });
  }

  return (
    <>
      <h2>Alimento nuevo</h2>
      <div className="txt-mut" style={{ fontSize: 14, lineHeight: 1.5, margin: '-8px 0 16px' }}>
        No lo tengo en la base, así que no me lo invento. Poné sus macros una vez
        y queda guardado para siempre.
      </div>
      <div className="field">
        <label>Nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
      </div>
      <div className="f2">
        <div className="field"><label>Calorías</label><input type="number" inputMode="numeric" placeholder="0" value={kcal} onChange={e => setKcal(e.target.value)} /></div>
        <div className="field"><label>Proteína (g)</label><input type="number" inputMode="decimal" placeholder="0" value={prot} onChange={e => setProt(e.target.value)} /></div>
        <div className="field"><label>Carbos (g)</label><input type="number" inputMode="decimal" placeholder="0" value={carbs} onChange={e => setCarbs(e.target.value)} /></div>
        <div className="field"><label>Grasa (g)</label><input type="number" inputMode="decimal" placeholder="0" value={fat} onChange={e => setFat(e.target.value)} /></div>
      </div>
      <button type="button" className="btn" onClick={crear}>Guardar y agregar</button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={onCancel}>Cancelar</button>
    </>
  );
}
```

- [ ] **Step 2: Agrupar el día por momento en `Nutricion.jsx`**

Cambiar el import de `meals.js` para sumar `mealsBySlot` y `slotForTime`, y reemplazar el bloque final "Comidas de hoy" por:

```jsx
      <div className="sect">Comidas de {isToday ? 'hoy' : 'este día'}</div>
      {!meals.length ? (
        <div className="card"><div className="empty" style={{ padding: 16 }}><p style={{ margin: 0 }}>Nada registrado {isToday ? 'hoy' : 'este día'}.</p></div></div>
      ) : (
        mealsBySlot(date).map(b => (
          <div key={b.k} className="slot-block">
            <div className="slot-head"><span>{b.label}</span><span className="num">{b.kcal} kcal</span></div>
            <div className="card">
              {b.meals.map(meal => (
                <div className="row" key={meal.id}>
                  <div className="grow">
                    <div className="t">{meal.name}</div>
                    <div className="s">{meal.kcal} kcal · P {meal.p} · C {meal.c} · G {meal.f}</div>
                    {meal.items?.length > 1 && (
                      <div className="s" style={{ color: 'var(--mut2)' }}>
                        {meal.items.map(i => `${i.name} ${i.grams}g`).join(' · ')}
                      </div>
                    )}
                  </div>
                  <button type="button" className="meal-del" onClick={() => deleteMeal(meal.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
```

Y hacer que el botón de agregar pase el momento sugerido:

```jsx
      <button type="button" className="btn" onClick={() => openSheet('meal-form', { slot: slotForTime(new Date().toTimeString().slice(0, 5)) })}>+ Agregar comida</button>
```

- [ ] **Step 3: Estilos**

En `src/styles.css`, agregar:

```css
/* ---------- buscador de alimentos ---------- */
.food-hits{display:flex;flex-direction:column;gap:6px;margin-bottom:var(--s3)}
.food-hit{
  display:flex;align-items:center;gap:8px;width:100%;text-align:left;
  padding:10px 12px;border-radius:12px;
  background:var(--card2);border:1px solid var(--line);
}
.food-hit .t{font-size:14.5px;font-weight:600}
.food-hit .s{font-size:12px;color:var(--mut);flex:none}
.food-hit .grow{flex:1;min-width:0;display:flex;align-items:center;gap:6px}
.food-hit.nuevo{border-style:dashed;border-color:var(--line2)}
.food-hit:active{border-color:var(--blue2)}

.cart-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)}
.cart-row .n{flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cart-row input{
  width:66px;flex:none;text-align:center;padding:5px 4px;border-radius:9px;
  background:var(--card2);border:1px solid var(--line2);
  font-family:'Barlow Condensed';font-weight:700;font-size:17px;font-variant-numeric:tabular-nums;
}
.cart-row .u{font-size:12px;color:var(--mut);flex:none}
.cart-row .k{font-size:12.5px;color:var(--blue2);font-weight:600;flex:none;min-width:56px;text-align:right}
.cart-total{display:flex;justify-content:space-between;align-items:baseline;padding-top:10px;font-size:14px}

/* ---------- el día por momentos ---------- */
.slot-block{margin-bottom:var(--s3)}
.slot-head{
  display:flex;justify-content:space-between;align-items:baseline;
  margin:0 2px 6px;font-size:12.5px;font-weight:700;
  letter-spacing:.12em;text-transform:uppercase;color:var(--mut);
}
```

- [ ] **Step 4: Tests, lint y build**

Run: `npm run test && npm run lint && npm run build:only`
Expected: tests PASS, build OK. Los dos warnings de `only-export-components` en `MealForm.jsx` siguen ahí (`logMeal`/`addMealFromFood` se siguen exportando): el baseline de 6 warnings no cambia.

- [ ] **Step 5: Verificación manual**

Run: `npm run dev`
1. Comida → "+ Agregar comida": el momento viene preseleccionado según la hora.
2. Escribir "po" → aparecen pollo, pollo a la brasa, pavo.
3. Elegir pollo → entra al carrito con 150 g (su porción natural) y sus kcal.
4. Cambiar a 200 g → las kcal y los macros se recalculan en vivo.
5. Agregar arroz → el total suma los dos.
6. Guardar → la comida aparece bajo el bloque del momento correcto.
7. Buscar algo inexistente ("zarandaja") → "Crear zarandaja" → cargar macros → queda en el carrito y disponible en futuras búsquedas.
8. Verificar que una comida vieja (de los datos de prueba, sin `slot`) sigue apareciendo, ubicada por su hora.

- [ ] **Step 6: Commit**

```bash
git add src/components/sheets/MealForm.jsx src/components/screens/Nutricion.jsx src/styles.css
git commit -m "feat(web): buscar alimentos, poner gramos y agrupar el día por momento"
```

---

## Cierre

- [ ] **Correr la verificación completa**

Run: `npm run test && npm run lint && npm run build:only`
Expected: todos los tests PASS, 6 warnings preexistentes, 0 errores, build OK.

- [ ] **Publicar (requiere autorización explícita de Enzo)**

El sitio vive en `exorplion.github.io/gymapp` y no cambia hasta que el build esté commiteado en `main`.

```bash
npm run build          # vite build + scripts/publish-root.mjs
cd ..
git add -A
git commit -m "build: publicar"
git checkout main
git merge feat/observaciones-uso-real
```

---

## Self-Review

**Cobertura del spec:**

| Sección del spec | Tarea |
|---|---|
| 1 · Modo foco del carrusel | Task 1 (steps 2-3) |
| 1 · Peso y reps apilados | Task 1 (steps 1, 4) |
| 2 · `sessionForWeekday` | Task 2 |
| 2 · `DoneHero` + "Entrenar de nuevo" | Task 5 |
| 2 · ✓ en la tira semanal | Task 5 (steps 4-5) |
| 3 · `SessionView` unificado | Task 3 |
| 3 · `sessionPRs` histórico | Task 2 |
| 3 · Sección Tus sesiones | Task 4 |
| 3 · `History.jsx` reescrito | Task 4 (step 4) |
| 3 · El reloj lleva a Progreso | Task 4 (step 5) |
| 4 · Modo edición | Task 6 |
| 4 · `updateHistorySession` + Deshacer | Task 2 (step 3), Task 6 |
| 4 · Campos inmutables | Task 6 (steps 2, 7.5) |
| 5 · `previewDayDrop` | Task 7 |
| 5 · Colapsar antes de medir | Task 7 (steps 5, 7) |
| 5 · reduced-motion | Task 7 (step 6) |
| 6a · Export/import MD | Task 8 |
| 6b · Campo `base` | Task 8 (import), Task 9 (`macrosFor`) |
| 6c · Buscador + gramos | Task 9, Task 11 |
| 6c · Nunca inventar macros | Task 11 (`AlimentoNuevo`) |
| 6d · Momentos del día | Task 10, Task 11 |
| 7 · Reflejo al inclinar | **En standby, sin tarea.** |

Sin huecos.

**Consistencia de nombres verificada:** `sessionForWeekday`, `sessionPRs`, `groupSessionsByWeek`, `updateHistorySession`, `weekStart` (Task 2) se usan con esos nombres exactos en las tareas 3, 4, 5 y 6. `previewDayDrop` (Task 7) coincide entre `rutina-logic.js` y `drag.js`. `foodIndex`/`searchFoods`/`macrosFor`/`defaultGrams` (Task 9) coinciden con los usos de la Task 11. `SLOTS`/`slotForTime`/`slotOf`/`mealsBySlot` (Task 10) coinciden con la Task 11. El sheet `'session-view'` se abre con `{id, justFinished}` en las tareas 3, 4 y 5.

**Riesgo conocido:** la Task 3 borra `HistDetail` de `Hoy.jsx` (y con él los imports de `fmtNum`/`round1`), y la Task 5 los vuelve a necesitar para `DoneHero`. Está anotado explícitamente en el step 2 de la Task 5.
