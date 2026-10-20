# RIR propio y "Fallo" — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un ejercicio de rutina pueda tener su propio RIR objetivo (opción A3 de las maquetas) y que "Fallo" sea una respuesta distinta de RIR 0.

**Architecture:** Un campo opcional `ex.rir` (array por serie, valores `0..4` o `'F'`) y UNA función, `rirDeEjercicio(ex, n)`, que reemplaza a `rirScheme` en los cinco lugares que muestran el pedido. La respuesta "Fallo" se guarda como `rpe: 10` + `fallo: true`, así todo lo que ya lee `rpe` sigue igual; sólo las dos fórmulas de recuperación miran `fallo`.

**Tech Stack:** React 19, vitest, Tailwind v4 + `styles.css`.

**Spec:** `docs/superpowers/specs/2026-10-20-importar-rutina-y-rir-design.md` (Entrega 1). Maqueta elegida: A3 (claude.ai/artifact/B6ndrZszVgdv18YaChZGRK).

## Global Constraints

- `rirScheme` (exdb.js:97) no cambia: es la regla "Automático".
- El historial no se migra: una serie vieja con `rpe: 10` sin `fallo` es RIR 0.
- Coherencia visual (CLAUDE.md): reusar `.seg`, `.rir-seg`, `.group`/`.grouprow` y el stepper de ExerciseForm; ninguna clase nueva sin escribirla en `styles.css`; tokens, nunca números sueltos.
- Verificar a 390 y 430 px en navegador real, midiendo (`getBoundingClientRect`).
- Comandos: `cd web && npx vitest run <archivo>`; `npm run lint`; `npm run build`.

---

### Task 1: `rir.js` — valores, rótulos y `rirDeEjercicio`

**Files:**
- Modify: `web/src/lib/rir.js`
- Test: `web/src/lib/__tests__/rir-propio.test.js` (nuevo)

**Interfaces — Produces:**
- `FALLO = 'F'`
- `RIR_OPTS = ['F', 0, 1, 2, 3, 4]`
- `rpeFromRir(v)`: `'F'` → 10
- `rirLabel(v)`: `'F'` → `'Fallo'`, 0 → `'0'`, 4 → `'4+'`
- `rirCorto(v)`: `'F'` → `'F'`, 4 → `'4+'`, si no `String(v)`
- `rirDeEjercicio(ex, n = ex.sets)`: array de largo `max(1, n)`
- `rirPedido(scheme, i)`: acepta `'F'` (lo devuelve tal cual)

- [ ] **Step 1: tests que fallan**

```js
import { describe, it, expect } from 'vitest';
import { rirDeEjercicio, rirPedido, rpeFromRir, rirLabel, rirCorto, RIR_OPTS, FALLO } from '../rir.js';

describe('rirDeEjercicio', () => {
  it('sin rir propio usa la regla de la app', () => {
    expect(rirDeEjercicio({ name: 'Press banca', sets: 4 })).toEqual([3, 2, 1, 0]);
  });
  it('con rir del largo justo lo devuelve tal cual', () => {
    expect(rirDeEjercicio({ name: 'Press banca', sets: 3, rir: [2, 2, 'F'] })).toEqual([2, 2, 'F']);
  });
  it('más series que valores repite el último', () => {
    expect(rirDeEjercicio({ name: 'x', sets: 4, rir: [3, 1] })).toEqual([3, 1, 1, 1]);
  });
  it('menos series recorta', () => {
    expect(rirDeEjercicio({ name: 'x', sets: 2, rir: [3, 2, 1] })).toEqual([3, 2]);
  });
  it('n pisa ex.sets (series reales en la sesión)', () => {
    expect(rirDeEjercicio({ name: 'x', sets: 3, rir: [2] }, 5)).toEqual([2, 2, 2, 2, 2]);
  });
  it('un rir vacío vale como automático', () => {
    expect(rirDeEjercicio({ name: 'Press banca', sets: 2, rir: [] })).toEqual([1, 0]);
  });
});

describe('Fallo', () => {
  it('es la primera opción y no es el 0', () => {
    expect(RIR_OPTS).toEqual([FALLO, 0, 1, 2, 3, 4]);
    expect(rirLabel(FALLO)).toBe('Fallo');
    expect(rirLabel(0)).toBe('0');
    expect(rirCorto(FALLO)).toBe('F');
  });
  it('se guarda como rpe 10', () => { expect(rpeFromRir(FALLO)).toBe(10); });
  it('rirPedido lo deja pasar', () => {
    expect(rirPedido([2, 'F'], 1)).toBe('F');
    expect(rirPedido([2, 'F'], 9)).toBe('F');
    expect(rirPedido([6], 0)).toBe(4);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/rir-propio.test.js` → FAIL (exports no existen).

- [ ] **Step 3: implementación** en `rir.js` (importa `rirScheme` de `./exdb.js`):

```js
export const FALLO = 'F';
export const RIR_OPTS = [FALLO, 0, 1, 2, 3, 4];

export function rpeFromRir(rir) { return rir === FALLO ? 10 : rir >= 4 ? 6 : 10 - rir; }
export function rirLabel(n) { return n === FALLO ? 'Fallo' : n === 4 ? '4+' : String(n); }
export function rirCorto(n) { return n === FALLO ? 'F' : n === 4 ? '4+' : String(n); }

export function rirDeEjercicio(ex, n = ex?.sets) {
  const largo = Math.max(1, parseInt(n) || 1);
  const propio = Array.isArray(ex?.rir) && ex.rir.length ? ex.rir : null;
  if (!propio) return rirScheme(largo, ex?.name);
  return Array.from({ length: largo }, (_, i) => propio[Math.min(i, propio.length - 1)]);
}

export function rirPedido(scheme, serieIdx) {
  if (!Array.isArray(scheme) || !scheme.length) return null;
  const i = Math.max(0, Math.min(serieIdx, scheme.length - 1));
  const n = scheme[i];
  if (n == null) return null;
  return n === FALLO ? FALLO : Math.min(n, 4);
}
```

Verificar antes que `exdb.js` no importe `rir.js` (ciclo).

- [ ] **Step 4:** el test pasa; correr también `session-rir.test.js` (usa `RIR_OPTS`) y ajustar lo que asuma 5 opciones.
- [ ] **Step 5:** commit `feat(rir): RIR propio por ejercicio y Fallo como valor`.

### Task 2: mostrar el pedido con `rirDeEjercicio`

**Files:**
- Modify: `web/src/components/screens/Rutina.jsx:75`, `web/src/components/sheets/DayPeek.jsx:47`, `web/src/components/sheets/ExInfo.jsx:27,76-84`, `web/src/components/ExerciseCarousel.jsx:750,1063`, `web/src/lib/session.js:983`, `web/src/components/RestTimer.jsx:457`

**Interfaces — Consumes:** `rirDeEjercicio`, `rirCorto`, `FALLO` (Task 1).

- [ ] Rutina/DayPeek: `RIR ${rirDeEjercicio(ex).map(rirCorto).join('/')}`.
- [ ] ExInfo: `const scheme = ex ? rirDeEjercicio(ex) : null;` y el rótulo: `r === FALLO ? 'al fallo' : \`RIR ${r}\``; en negrita sólo `r === FALLO || r === 0` (el límite).
- [ ] ExerciseCarousel: `rirDeEjercicio(ex, serieObjetivo)`; línea 1063: `curRir === FALLO ? <b className="txt-blue">al fallo</b> : \`RIR ${curRir}\``.
- [ ] session.js:983: `rirPedido(rirDeEjercicio(ex, techoSeries), …)`.
- [ ] RestTimer:457: `pedía ${p.pedia === FALLO ? 'al fallo' : \`RIR ${p.pedia}\`}`.
- [ ] Test en `rir-propio.test.js`: con `ex.rir = [2]`, `saveSet` deja `T.rir.pedia === 2` (mismo armado que `session-rir.test.js`).
- [ ] `npx vitest run` completo verde; commit `feat(rir): la rutina, la sesión y el descanso piden el RIR propio`.

### Task 3: contestar "Fallo" en el descanso

**Files:**
- Modify: `web/src/lib/session.js` (`setRirUltimaSerie`, `setRirLado`), `web/src/components/RestTimer.jsx` (`SegRir`), `web/src/styles.css:2543` (`repeat(5,1fr)` → `repeat(6,1fr)`)

- [ ] Test (en `rir-propio.test.js`, armado de `session-rir.test.js`): `setRirUltimaSerie('F')` deja `rpe: 10, fallo: true`; después `setRirUltimaSerie(0)` deja `rpe: 10` y **sin** `fallo`; `null` borra los dos. Igual para `setRirLado`.
- [ ] Implementación: un helper en session.js

```js
function anotarRir(set, rir) {
  set.rpe = rir == null ? null : rpeFromRir(rir);
  if (rir === FALLO) set.fallo = true; else delete set.fallo;
}
```

  usado en los dos setters y para cada lado.
- [ ] `SegRir`: rótulo `<b>{n === FALLO ? 'Fallo' : n === 4 ? '4+' : n}</b>`, sin el `<small>fallo</small>` del 0; `aria-label` con `rirLabel`. "Fallo" en `--t-sm` versal (`.rir-seg button.f b`), porque la palabra no entra a `--t-xl` en un sexto de 358 px.
- [ ] Commit `feat(rir): Fallo separado de RIR 0 en el descanso`.

### Task 4: recuperación

**Files:** `web/src/lib/muscle.ts:393-407`, `web/src/lib/recuperacion.js:143-155`; tests en `muscle.test.js` y `recuperacion.test.js`.

- [ ] `recoveryPct`: cada serie aporta `st.fallo ? 11 : st.rpe`. Test: mismo historial, con `fallo: true` da menor % que sin; sin `fallo` el número es idéntico al de hoy.
- [ ] `recuperacion.js`: `rirDe` mapea una serie con `fallo` a `-1`; `ventanaHoras` usa `POR_FALLO = 1.25` cuando `Math.round(r) < 0`. Test: una serie de fallo da una ventana mayor que RIR 0; sin fallo, igual que hoy.
- [ ] Commit `feat(rir): el fallo pesa un poco más en la recuperación`.

### Task 5: editarlo (A3) en ExerciseForm

**Files:** `web/src/lib/rutina-logic.js:1022` (`saveExercise` acepta `rir`), `web/src/components/sheets/ExerciseForm.jsx` (EditForm, debajo de Series/Reps).

- [ ] `saveExercise`: `ex.rir = Array.isArray(rir) && rir.length ? rir.slice(0, s) : undefined;` Test: guardar `[2]` lo deja; guardar `null` lo borra (vuelve a Automático).
- [ ] UI (estado local `rir`: `null` = Automático, array = propio):
  - etiqueta `t-etiqueta` "RIR objetivo" + `.seg` Automático / Propio;
  - Propio: etiqueta "Todas las series" + `.rir-seg` (6 botones) → `setRir(Array(sets).fill(v))`; ninguno marcado si las series no son todas iguales;
  - `.group` con `.grouprow` "Distinto por serie" (subtítulo "Para pirámides: 3 · 2 · 1 · fallo", chevron que gira); abierto, una `.grouprow` por serie con el stepper `−  valor  +` del mismo markup que Series/Reps;
  - debajo, `text-sm text-text-2`: "En la rutina se ve **RIR 2/2/2/2**." (con `rirDeEjercicio({ name, sets, rir })`).
  - Al pasar a Propio la primera vez, arranca con `rirDeEjercicio({ name, sets })` (lo que ya veías), no con un número inventado.
- [ ] Verificar a 390 y 430 px en Chrome (build de producción), medir que el `.rir-seg` no desborde la hoja y que el stepper por serie entre en una fila.
- [ ] Commit `feat(rutina): elegir el RIR objetivo de un ejercicio`.

### Task 6: publicar

- [ ] `npx vitest run`, `npm run lint` (sólo el error preexistente de WarmupCard.jsx).
- [ ] Rebasar sobre `origin/main`, `npm run build`, commitear la raíz (`assets/ index.html manifest.webmanifest sw.js workbox-*.js`), push, PR, merge (memoria "publicar siempre sin preguntar").
- [ ] HANDOFF.md: sesión 2026-10-20 con lo hecho y lo pendiente (entrega 2 con B1).
