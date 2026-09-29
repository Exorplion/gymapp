# Rampa (un solo botón) y Previa del ejercicio — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la rampa de aproximación se haga con el mismo botón grande de la tarjeta (avanza, se deshace y sobrevive a recargar), y que el hueco de 356–444 px debajo de la tarjeta sin empezar lo ocupe una previa del ejercicio (fuerza, récord, recuperación y meta de hoy).

**Architecture:** Dos fases. **FASE 1** (lógica pura, sin CSS): `lib/rampa.js` (estado de la rampa y del botón, sin tocar `S`), tres funciones nuevas en `lib/session.js` que guardan el avance en `S.draft.rampa`, y `lib/previa.js` con los selectores de datos de la previa, construidos sobre `e1rmSeries`/`trend`/`exerciseSeries`/`recoveryPct`/`objetivoHoy` sin duplicar cálculos. **FASE 2** (después de que se mergee el sistema de color, rama `feat/color-grafito`): el componente `Rampa` y el botón en `ExerciseCarousel.jsx`, el componente nuevo `PreviaEjercicio.jsx`, todo el CSS, las animaciones y la verificación en Chrome.

**Tech Stack:** React 19 · Vite · vitest · `motion/react` · CSS propio en `web/src/styles.css` (tokens en `:root`).

**Spec:** `docs/superpowers/specs/2026-09-27-rediseno-sesion-y-color-design.md`, secciones 2 y 3 (y las reglas del encabezado). Maquetas aprobadas: `.superpowers/brainstorm/177766-1790562557/content/02-rampa.html` (opción B, "un solo botón") y `03-espacio-vacio.html` (opción B, "resumen del ejercicio"). Relevamiento de base: zonas B y C (archivo:línea y tabla de datos disponibles).

## Global Constraints

- Patrones visuales existentes: `.card`, `.nav-card`, `.chip`, tipografía condensada del héroe. Nunca una clase de apariencia con un reset (`CLAUDE.md`, "Coherencia visual").
- Duraciones sólo con `--d1..--d4` (CSS) y `D` de `lib/motion.js` (`toque 150`, `objeto 220`, `panel 320`, `momento 460`). Nunca un ms suelto.
- `menosMovimiento()` para reducir movimiento. `vibrate()` de `lib/format.ts` para háptica.
- Hit areas ≥ 40 px. `tabular-nums` en cifras. Los pesos llevan unidad.
- Colores sólo de tokens. **En FASE 2 se usan los nombres nuevos del sistema de color** (spec §4): `--bg`, `--surface`, `--surface-2`, `--glass`, `--text`, `--text-2`, `--text-3`, `--line`, `--accent`, `--accent-strong`, `--accent-rgb`, `--on-accent`, `--ok`, `--danger`, `--warn` (ámbar = aproximación). Antes de escribir CSS, confirmar los nombres reales en `:root` de `styles.css` ya mergeado (y en `docs/superpowers/plans/2026-09-27-color-grafito-acento.md` si existe).
- La app no inventa datos: sin historial se dice "Primera vez", nunca un cero, un `NaN` ni un panel vacío.
- Verificación en Chrome con build de producción a **390×844 y 430×932**, sin scroll donde la spec dice "una pantalla". Medir con `getBoundingClientRect()`; `textContent`, no `innerText`.
- Tests: `cd web && npm test` verde (base: 764).
- Commits en español, estilo del repo (`feat(sesión): …`, `test(…)`, `docs(plan): …`), terminados en `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Mapa de archivos

| Archivo | Fase | Responsabilidad |
|---|---|---|
| `web/src/lib/rampa.js` (nuevo) | 1 | Estado puro de la rampa: pasos hecho/activo/futuro, avance de la línea, qué hace tocar un círculo, qué dice el botón. No importa `state.js`. |
| `web/src/lib/session.js` (modificar, junto a `marcarCalentado` ~:967) | 1 | `pasosRampa`, `avanzarRampa`, `deshacerRampa`: el avance vive en `S.draft.rampa[exId]` y se guarda con `saveDraft`. |
| `web/src/lib/previa.js` (nuevo) | 1 | Selectores de la previa: `fuerzaPrevia`, `sparkPuntos`, `recordPrevia`, `haceTexto`, `recuperacionPrevia`, `metaHoy`, `metaTexto`, `previaEjercicio`. |
| `web/src/lib/__tests__/rampa.test.js` (nuevo) | 1 | Tests de `rampa.js` y de la persistencia en `session.js`. |
| `web/src/lib/__tests__/previa.test.js` (nuevo) | 1 | Tests de `previa.js`. |
| `web/src/components/ExerciseCarousel.jsx` (modificar `Rampa` :486-527, botón :948-968, `ExerciseSlide` :650-976, `Comparativa` :465-484) | 2 | Rampa conectada al borrador, botón que avanza, previa debajo de la tarjeta, meta de hoy dentro de la tarjeta. |
| `web/src/components/PreviaEjercicio.jsx` (nuevo) | 2 | Los tres paneles de la previa. |
| `web/src/styles.css` (modificar `.ex-rampa*` :1068-1086, `.btn-serie*` :1089-1102, bloque nuevo `.previa*`) | 2 | Estilos y animaciones. |

---

# FASE 1 — lógica pura (sin CSS)

### Task 1: Estado puro de la rampa (`lib/rampa.js`)

**Files:**
- Create: `web/src/lib/rampa.js`
- Test: `web/src/lib/__tests__/rampa.test.js`

**Interfaces:**
- Consumes: la forma de `warmupSets()` (`lib/warmup.ts:50`): `[{ pct, reps, w }]`; `round1`, `fmtNum` de `lib/format.ts`.
- Produces:
  - `clampHechos(hechos: any, n: number): number` — entero en `0..n`; basura → 0.
  - `avanceLinea(hechos, n): number` — fracción de la línea: `min(hechos, n-1)/(n-1)` → con 3 pasos: 0 → 0.5 → 1 → 1.
  - `estadoRampa(rampa, hechos) → { n, hechos, activo: number|null, completa: boolean, avance: number, pasos: [{ pct, reps, w, estado: 'hecho'|'activo'|'futuro' }] }`
  - `tocarPaso(hechos, i, n) → { accion: 'deshacer'|'sacudir'|'nada', hechos }` — tocar un ✓ vuelve a ese paso; tocar un futuro pide sacudir el activo; con la rampa completa no hace nada.
  - `estadoBoton({ rampa, hechos, serie: { etiqueta, w, r }, unidad = 'kg', fmtPeso }) → { variante: 'aprox'|'serie', paso: number|null, texto, valor }` — `texto` va en caja normal (el CSS de `.btn-serie-t` ya pone mayúsculas): `'Aprox. 50 % lista'`, `'Serie 1 lista'`; `valor`: `'25 kg × 5'`.

- [ ] **Step 1: Escribir los tests que fallan**

```js
// web/src/lib/__tests__/rampa.test.js
import { describe, it, expect } from 'vitest';
import { clampHechos, avanceLinea, estadoRampa, tocarPaso, estadoBoton } from '../rampa.js';
import { warmupSets } from '../warmup.js';

const RAMPA = warmupSets(47.5); // 25 / 35 / 42.5

describe('avanceLinea — la línea se llena hasta el círculo siguiente', () => {
  it('0 → 50 % → 100 % con tres pasos (antes el primer paso no la movía)', () => {
    expect([0, 1, 2, 3].map(h => avanceLinea(h, 3))).toEqual([0, 0.5, 1, 1]);
  });
  it('sin pasos o con uno solo no hay línea', () => {
    expect(avanceLinea(1, 1)).toBe(0);
    expect(avanceLinea(0, 0)).toBe(0);
  });
});

describe('clampHechos', () => {
  it('basura, negativos y excesos quedan dentro de 0..n', () => {
    for (const v of [undefined, null, NaN, 'x', -2]) expect(clampHechos(v, 3)).toBe(0);
    expect(clampHechos(7, 3)).toBe(3);
    expect(clampHechos(1.9, 3)).toBe(1);
  });
});

describe('estadoRampa', () => {
  it('al empezar el primer paso es el activo y los otros futuros', () => {
    const e = estadoRampa(RAMPA, 0);
    expect(e.activo).toBe(0);
    expect(e.completa).toBe(false);
    expect(e.pasos.map(p => p.estado)).toEqual(['activo', 'futuro', 'futuro']);
  });
  it('con dos hechos el activo es el 90 %', () => {
    const e = estadoRampa(RAMPA, 2);
    expect(e.activo).toBe(2);
    expect(e.pasos.map(p => p.estado)).toEqual(['hecho', 'hecho', 'activo']);
    expect(e.avance).toBe(1);
  });
  it('con los tres hechos está completa y no hay activo', () => {
    const e = estadoRampa(RAMPA, 3);
    expect(e.completa).toBe(true);
    expect(e.activo).toBe(null);
  });
  it('sin rampa no hay nada que completar', () => {
    const e = estadoRampa([], 0);
    expect(e).toMatchObject({ n: 0, completa: false, activo: null, avance: 0, pasos: [] });
  });
});

describe('tocarPaso — se deshace hacia atrás, nunca se salta hacia adelante', () => {
  it('tocar un ✓ vuelve a ese paso', () => {
    expect(tocarPaso(2, 0, 3)).toEqual({ accion: 'deshacer', hechos: 0 });
    expect(tocarPaso(2, 1, 3)).toEqual({ accion: 'deshacer', hechos: 1 });
  });
  it('tocar un paso futuro no avanza: sacude el activo', () => {
    expect(tocarPaso(0, 2, 3)).toEqual({ accion: 'sacudir', hechos: 0 });
    expect(tocarPaso(1, 2, 3)).toEqual({ accion: 'sacudir', hechos: 1 });
  });
  it('tocar el activo no hace nada: el que avanza es el botón', () => {
    expect(tocarPaso(1, 1, 3)).toEqual({ accion: 'nada', hechos: 1 });
  });
  it('con la rampa completa ya no se deshace (el bloque quedó calentado)', () => {
    expect(tocarPaso(3, 0, 3)).toEqual({ accion: 'nada', hechos: 3 });
  });
  it('un índice fuera de rango no hace nada', () => {
    expect(tocarPaso(1, 5, 3).accion).toBe('nada');
    expect(tocarPaso(1, -1, 3).accion).toBe('nada');
  });
});

describe('estadoBoton — el botón grande dice qué aproximación toca', () => {
  const serie = { etiqueta: 'Serie 1', w: 47.5, r: 7 };
  it('mientras quedan aproximaciones: variante ámbar, porcentaje y peso con unidad', () => {
    expect(estadoBoton({ rampa: RAMPA, hechos: 0, serie })).toEqual({
      variante: 'aprox', paso: 0, texto: 'Aprox. 50 % lista', valor: '25 kg × 5',
    });
    expect(estadoBoton({ rampa: RAMPA, hechos: 2, serie })).toMatchObject({ texto: 'Aprox. 90 % lista', valor: '42.5 kg × 1' });
  });
  it('después de la tercera vuelve a ser la serie de siempre', () => {
    expect(estadoBoton({ rampa: RAMPA, hechos: 3, serie })).toEqual({
      variante: 'serie', paso: null, texto: 'Serie 1 lista', valor: '47.5 kg × 7',
    });
  });
  it('sin rampa es la serie normal', () => {
    expect(estadoBoton({ rampa: [], hechos: 0, serie }).variante).toBe('serie');
  });
  it('respeta la unidad y el formateador que le pasen (lb)', () => {
    const b = estadoBoton({ rampa: RAMPA, hechos: 0, serie, unidad: 'lb', fmtPeso: kg => String(Math.round(kg * 2.20462)) });
    expect(b.valor).toBe('55 lb × 5');
  });
  it('en unilateral la etiqueta es el lado', () => {
    expect(estadoBoton({ rampa: [], hechos: 0, serie: { etiqueta: 'Izquierda', w: 20, r: 10 } }).texto).toBe('Izquierda lista');
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd web && npx vitest run src/lib/__tests__/rampa.test.js`
Expected: FAIL — `Failed to resolve import "../rampa.js"`.

- [ ] **Step 3: Implementación mínima**

```js
// web/src/lib/rampa.js
// La rampa de aproximación como estado puro (rediseño 2026-09-27, pieza 2).
// Sin S ni DOM: qué paso está hecho, cuál toca, cuánto se llena la línea,
// qué hace tocar un círculo y qué dice el botón grande. El avance real vive
// en el borrador (pasosRampa/avanzarRampa/deshacerRampa en session.js).
import { round1, fmtNum } from './format.js';

const pesoPorDefecto = kg => fmtNum(round1(kg));
const pctTexto = pct => `${Math.round(pct * 100)} %`;

/** Pasos hechos, siempre un entero entre 0 y n. */
export function clampHechos(hechos, n) {
  const h = Math.floor(Number(hechos));
  if (!(h > 0) || !(n > 0)) return 0;
  return Math.min(h, n);
}

/** Cuánto de la línea entre círculos está lleno (0..1). Con el paso 1 hecho
    llega al segundo círculo; antes la cuenta era (hechos-1)/(n-1) y el
    primer toque no la movía. */
export function avanceLinea(hechos, n) {
  if (!(n > 1)) return 0;
  return Math.min(clampHechos(hechos, n), n - 1) / (n - 1);
}

export function estadoRampa(rampa, hechos) {
  const lista = Array.isArray(rampa) ? rampa : [];
  const n = lista.length;
  const h = clampHechos(hechos, n);
  return {
    n,
    hechos: h,
    activo: h < n ? h : null,
    completa: n > 0 && h >= n,
    avance: avanceLinea(h, n),
    pasos: lista.map((s, i) => ({ ...s, estado: i < h ? 'hecho' : i === h ? 'activo' : 'futuro' })),
  };
}

/** Qué pasa al tocar el círculo `i`. Hacia atrás deshace; hacia adelante
    no se puede saltar (la UI sacude el activo); el activo lo avanza el
    botón, no el círculo. Completa, la rampa ya marcó el bloque. */
export function tocarPaso(hechos, i, n) {
  const h = clampHechos(hechos, n);
  if (h >= n || !Number.isInteger(i) || i < 0 || i >= n) return { accion: 'nada', hechos: h };
  if (i < h) return { accion: 'deshacer', hechos: i };
  if (i > h) return { accion: 'sacudir', hechos: h };
  return { accion: 'nada', hechos: h };
}

/** Lo que dice el botón grande de la tarjeta. */
export function estadoBoton({ rampa = [], hechos = 0, serie, unidad = 'kg', fmtPeso = pesoPorDefecto }) {
  const n = Array.isArray(rampa) ? rampa.length : 0;
  const h = clampHechos(hechos, n);
  if (h < n) {
    const s = rampa[h];
    return { variante: 'aprox', paso: h, texto: `Aprox. ${pctTexto(s.pct)} lista`, valor: `${fmtPeso(s.w)} ${unidad} × ${s.reps}` };
  }
  return { variante: 'serie', paso: null, texto: `${serie.etiqueta} lista`, valor: `${fmtPeso(serie.w)} ${unidad} × ${serie.r}` };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd web && npx vitest run src/lib/__tests__/rampa.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/rampa.js web/src/lib/__tests__/rampa.test.js
git commit -m "feat(rampa): estado puro — avance, deshacer y qué dice el botón"
```

---

### Task 2: El avance de la rampa se guarda en el borrador

**Files:**
- Modify: `web/src/lib/session.js` (junto a `marcarCalentado`, ~:960-977; import de `./rampa.js`)
- Test: `web/src/lib/__tests__/rampa.test.js` (bloque nuevo al final)

**Interfaces:**
- Consumes: `clampHechos` (Task 1); `S`, `saveDraft`, `bump` (`state.js`); `vibrate` (`format.ts`).
- Produces:
  - `pasosRampa(exId): number` — pasos hechos guardados en `S.draft.rampa[exId]` (0 sin borrador).
  - `avanzarRampa(exId, total): Promise<number>` — suma un paso (nunca pasa de `total`), vibra, `saveDraft`, `bump`. **No** llama a `marcarCalentado`: la UI lo llama cuando termina de mostrar el ✓ y plegar la rampa (spec §2, "Al completar").
  - `deshacerRampa(exId, paso): Promise<number>` — vuelve a `paso` si es menor que lo hecho; si no, no toca nada.
  - Forma nueva del borrador: `S.draft.rampa?: { [exId]: number }`. `completeSession` arma la sesión campo por campo (session.js ~:849), así que no se filtra al historial.

- [ ] **Step 1: Escribir los tests que fallan** (agregar al final de `rampa.test.js`, con los mocks arriba del archivo)

```js
// arriba del archivo, después de los imports de vitest:
import { vi, beforeEach } from 'vitest';
import { S } from '../state.js';
import { idb } from '../db.js';
import { vibrate } from '../format.js';
vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../format.js', async orig => ({ ...(await orig()), vibrate: vi.fn() }));
import { pasosRampa, avanzarRampa, deshacerRampa } from '../session.js';

describe('rampa en el borrador — sobrevive a recargar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    S.draft = { id: 'd1', date: '2026-09-27', slotId: 's', entries: {}, order: ['a'], skipped: [], extraSets: {}, extras: [] };
  });

  it('sin avance guardado arranca en 0', () => {
    expect(pasosRampa('a')).toBe(0);
  });

  it('cada toque del botón suma un paso, vibra y se guarda', async () => {
    expect(await avanzarRampa('a', 3)).toBe(1);
    expect(await avanzarRampa('a', 3)).toBe(2);
    expect(S.draft.rampa).toEqual({ a: 2 });
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(idb.put).toHaveBeenLastCalledWith('settings', { key: 'draft', value: S.draft });
  });

  it('nunca pasa del total', async () => {
    S.draft.rampa = { a: 3 };
    expect(await avanzarRampa('a', 3)).toBe(3);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('lo guardado se lee de vuelta (simula recargar la app)', async () => {
    await avanzarRampa('a', 3);
    const guardado = JSON.parse(JSON.stringify(S.draft));
    S.draft = guardado;
    expect(pasosRampa('a')).toBe(1);
  });

  it('cada ejercicio lleva su propio avance', async () => {
    await avanzarRampa('a', 3);
    await avanzarRampa('b', 3);
    await avanzarRampa('b', 3);
    expect([pasosRampa('a'), pasosRampa('b')]).toEqual([1, 2]);
  });

  it('deshacer vuelve al paso tocado', async () => {
    S.draft.rampa = { a: 2 };
    expect(await deshacerRampa('a', 0)).toBe(0);
    expect(pasosRampa('a')).toBe(0);
    expect(idb.put).toHaveBeenCalled();
  });

  it('deshacer no sirve para saltar hacia adelante', async () => {
    S.draft.rampa = { a: 1 };
    expect(await deshacerRampa('a', 2)).toBe(1);
    expect(await deshacerRampa('a', 1)).toBe(1);
    expect(idb.put).not.toHaveBeenCalled();
  });

  it('sin sesión abierta no hace nada', async () => {
    S.draft = null;
    expect(pasosRampa('a')).toBe(0);
    expect(await avanzarRampa('a', 3)).toBe(0);
    expect(await deshacerRampa('a', 0)).toBe(0);
  });

  it('un valor roto en el borrador se lee como 0', () => {
    S.draft.rampa = { a: 'x' };
    expect(pasosRampa('a')).toBe(0);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd web && npx vitest run src/lib/__tests__/rampa.test.js`
Expected: FAIL — `pasosRampa is not a function` (o import undefined).

- [ ] **Step 3: Implementación mínima** (en `session.js`, después de `marcarCalentado`; agregar `import { clampHechos } from './rampa.js';` junto a los imports)

```js
/** Pasos de la rampa de aproximación ya hechos en este ejercicio.
    Vive en el borrador (S.draft.rampa) y no en memoria: antes era un Map
    de módulo en ExerciseCarousel y recargar la app lo perdía. */
export function pasosRampa(exId) {
  const n = Math.floor(Number(S.draft?.rampa?.[exId]));
  return n > 0 ? n : 0;
}

/** Un toque del botón grande durante la rampa: suma un paso y vibra.
    No marca el calentamiento: la tarjeta primero muestra el ✓ y pliega la
    rampa, y recién después llama a marcarCalentado() (spec §2). */
export async function avanzarRampa(exId, total) {
  if (!S.draft || !(total > 0)) return 0;
  const antes = clampHechos(pasosRampa(exId), total);
  if (antes >= total) return antes;
  const n = antes + 1;
  S.draft.rampa = { ...(S.draft.rampa || {}), [exId]: n };
  vibrate(15);
  await saveDraft();
  bump();
  return n;
}

/** Tocar un ✓: vuelve a ese paso. Sólo hacia atrás — hacia adelante no se
    salta (lo decide tocarPaso en rampa.js; acá se vuelve a cuidar). */
export async function deshacerRampa(exId, paso) {
  if (!S.draft) return 0;
  const antes = pasosRampa(exId);
  if (!Number.isInteger(paso) || paso < 0 || paso >= antes) return antes;
  S.draft.rampa = { ...(S.draft.rampa || {}), [exId]: paso };
  await saveDraft();
  bump();
  return paso;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd web && npx vitest run src/lib/__tests__/rampa.test.js && npm test`
Expected: PASS, y la suite entera verde.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/session.js web/src/lib/__tests__/rampa.test.js
git commit -m "feat(rampa): el avance se guarda en el borrador y se puede deshacer"
```

---

### Task 3: Previa — fuerza, sparkline, récord y recuperación

**Files:**
- Create: `web/src/lib/previa.js`
- Test: `web/src/lib/__tests__/previa.test.js`

**Interfaces:**
- Consumes: `e1rmSeries(name)`, `trend(pts)`, `exerciseSeries()` (`charts.ts:82/:101/:40`); `catOf`, `recoveryPct`, `daysSinceGroup`, `diasTexto` (`muscle.ts`); `round1`, `dstr` (`format.ts`).
- Produces:
  - `fuerzaPrevia(ex, { uni = false }) → null | { actual: number, cambioPct: number|null, semanas: number|null, puntos: E1rmPoint[], tendencia: Trend|null, fecha: string }` — `actual` = último e1RM (redondeado a 0.1). `puntos` = la ventana de 8 semanas (56 días) que termina en la última sesión; `cambioPct` compara el primer y el último punto de esa ventana, sólo si hay ≥ 2 puntos separados por ≥ 7 días (si no, `null`, nunca "0 %"). `semanas` = el tramo real medido (1..8).
  - `sparkPuntos(puntos, { ancho = 96, alto = 38, margen = 3 }) → null | { points: string, ultimo: { x, y } }` — para `<polyline points>`; `null` con menos de 2 puntos; serie plana → línea al medio; nunca `NaN`.
  - `recordPrevia(ex, { uni = false, hoy = dstr() }) → null | { w, r, date, dias, hace }` — la mejor serie (peso × reps de mayor volumen), el mismo criterio y la misma clave que "PRs · Mejor serie" de Progreso (`exerciseSeries`); en empate gana la primera vez que se logró.
  - `haceTexto(dias) → string` — `diasTexto` hasta 13 días ("hoy", "ayer", "hace N días"); "hace N semanas" hasta 59; "hace N meses" después.
  - `recuperacionPrevia(ex) → null | { cat, pct, dias }` — `pct` de `recoveryPct(cat)`; `dias` de `daysSinceGroup(cat)` (`null` = nunca; la UI dice "sin registro" en vez de "100 %"). `null` si el grupo no se reconoce.

- [ ] **Step 1: Escribir los tests que fallan**

```js
// web/src/lib/__tests__/previa.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { dstr } from '../format.js';
vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
import { fuerzaPrevia, sparkPuntos, recordPrevia, haceTexto, recuperacionPrevia } from '../previa.js';
import { e1rmSeries } from '../charts.js';

const PRESS = { id: 'p', name: 'Press plano máquina', cat: 'Pecho', sets: 2, reps: 8 };
const hace = n => dstr(new Date(Date.now() - n * 86400000));
let t = 0;
// S.sessions va de la más nueva a la más vieja, como en la app.
const sesion = (date, sets, extra = {}) => ({ id: `s${++t}`, date, start: Date.parse(date + 'T10:00:00'), entries: [{ name: PRESS.name, cat: 'Pecho', sets, ...extra }] });
const serie = (w, r, rpe) => ({ w, r, ...(rpe != null ? { rpe } : {}) });
const sinNaN = o => JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'NaN!' : v));

beforeEach(() => { S.sessions = []; S.cfg.unit = 'kg'; t = 0; });

describe('fuerzaPrevia', () => {
  it('sin historial no hay panel de fuerza', () => {
    expect(fuerzaPrevia(PRESS)).toBe(null);
  });

  it('1RM actual y cambio en la ventana de 8 semanas que termina en la última sesión', () => {
    S.sessions = [
      sesion('2026-09-20', [serie(50, 8)]),
      sesion('2026-09-06', [serie(47.5, 8)]),
      sesion('2026-08-01', [serie(45, 8)]),
      sesion('2026-06-01', [serie(30, 8)]), // fuera de la ventana: no entra
    ];
    const f = fuerzaPrevia(PRESS);
    const ult = e1rmSeries(PRESS.name).at(-1).y;
    expect(f.actual).toBe(Math.round(ult * 10) / 10);
    expect(f.puntos.map(p => p.date)).toEqual(['2026-08-01', '2026-09-06', '2026-09-20']);
    expect(f.cambioPct).toBe(11); // 50 contra 45: +11 %
    expect(f.semanas).toBe(7);    // 1 ago → 20 sep = 50 días
    expect(f.fecha).toBe('2026-09-20');
  });

  it('bajar también se dice: el cambio es negativo', () => {
    S.sessions = [sesion('2026-09-20', [serie(40, 8)]), sesion('2026-09-01', [serie(50, 8)])];
    expect(fuerzaPrevia(PRESS).cambioPct).toBe(-20);
  });

  it('con una sola sesión hay 1RM pero no cambio (nunca un "0 %" inventado)', () => {
    S.sessions = [sesion('2026-09-20', [serie(50, 8)])];
    const f = fuerzaPrevia(PRESS);
    expect(f.actual).toBeGreaterThan(0);
    expect(f.cambioPct).toBe(null);
    expect(f.semanas).toBe(null);
  });

  it('dos sesiones en la misma semana tampoco alcanzan para un cambio', () => {
    S.sessions = [sesion('2026-09-20', [serie(50, 8)]), sesion('2026-09-17', [serie(47.5, 8)])];
    expect(fuerzaPrevia(PRESS).cambioPct).toBe(null);
  });

  it('la tendencia es la de trend() sobre la ventana (null con menos de 4 puntos)', () => {
    S.sessions = [sesion('2026-09-20', [serie(50, 8)]), sesion('2026-09-06', [serie(47.5, 8)])];
    expect(fuerzaPrevia(PRESS).tendencia).toBe(null);
    S.sessions = ['2026-09-20', '2026-09-13', '2026-09-06', '2026-08-30'].map((d, i) => sesion(d, [serie(50 - i * 2.5, 8)]));
    expect(fuerzaPrevia(PRESS).tendencia.slope).toBeGreaterThan(0);
  });

  it('unilateral usa su propia serie, no la bilateral', () => {
    S.sessions = [sesion('2026-09-20', [serie(20, 8)], { unilateral: true }), sesion('2026-09-10', [serie(50, 8)])];
    expect(fuerzaPrevia(PRESS, { uni: true }).actual).toBeLessThan(30);
    expect(fuerzaPrevia(PRESS).actual).toBeGreaterThan(50);
  });
});

describe('sparkPuntos', () => {
  it('con menos de dos puntos no hay línea', () => {
    expect(sparkPuntos([])).toBe(null);
    expect(sparkPuntos([{ date: 'x', y: 50 }])).toBe(null);
    expect(sparkPuntos(null)).toBe(null);
  });
  it('escala al recuadro: el más alto arriba, el más bajo abajo', () => {
    const s = sparkPuntos([{ y: 40 }, { y: 50 }], { ancho: 100, alto: 40, margen: 0 });
    expect(s.points).toBe('0,40 100,0');
    expect(s.ultimo).toEqual({ x: 100, y: 0 });
  });
  it('una serie plana va al medio, sin NaN', () => {
    const s = sparkPuntos([{ y: 50 }, { y: 50 }, { y: 50 }], { ancho: 96, alto: 38 });
    expect(s.points).not.toMatch(/NaN/);
    expect(s.ultimo.y).toBe(19);
  });
});

describe('recordPrevia y haceTexto', () => {
  it('sin historial no hay récord', () => {
    expect(recordPrevia(PRESS)).toBe(null);
  });
  it('la mejor serie (peso × reps) y hace cuánto, igual que "Mejor serie" en Progreso', () => {
    S.sessions = [
      sesion('2026-09-20', [serie(47.5, 7), serie(47.5, 7)]),
      sesion('2026-09-06', [serie(50, 8)]),
      sesion('2026-08-30', [serie(52.5, 3)]),
    ];
    expect(recordPrevia(PRESS, { hoy: '2026-09-27' })).toEqual({ w: 50, r: 8, date: '2026-09-06', dias: 21, hace: 'hace 3 semanas' });
  });
  it('en empate cuenta la primera vez que se logró', () => {
    S.sessions = [sesion('2026-09-20', [serie(50, 8)]), sesion('2026-09-06', [serie(50, 8)])];
    expect(recordPrevia(PRESS, { hoy: '2026-09-27' }).date).toBe('2026-09-06');
  });
  it('haceTexto', () => {
    expect([0, 1, 5, 13, 14, 21, 59, 60, 400].map(haceTexto)).toEqual([
      'hoy', 'ayer', 'hace 5 días', 'hace 13 días', 'hace 2 semanas', 'hace 3 semanas', 'hace 8 semanas', 'hace 2 meses', 'hace 13 meses',
    ]);
    expect(haceTexto(null)).toBe('');
    expect(haceTexto(NaN)).toBe('');
  });
});

describe('recuperacionPrevia', () => {
  it('el grupo del ejercicio y su recuperación estimada', () => {
    S.sessions = [sesion(hace(1), [serie(50, 8, 9)])];
    const r = recuperacionPrevia(PRESS);
    expect(r.cat).toBe('Pecho');
    expect(r.dias).toBe(1);
    expect(r.pct).toBeGreaterThan(0);
    expect(r.pct).toBeLessThan(100);
  });
  it('sin historial del grupo, dias es null (la UI dice "sin registro", no un 100 % inventado)', () => {
    expect(recuperacionPrevia(PRESS)).toEqual({ cat: 'Pecho', pct: 100, dias: null });
  });
  it('un ejercicio sin grupo reconocible no tiene panel', () => {
    expect(recuperacionPrevia({ id: 'z', name: 'Qwerty' })).toBe(null);
  });
  it('nada devuelve NaN', () => {
    S.sessions = [sesion(hace(3), [serie(50, 8)])];
    expect(sinNaN([fuerzaPrevia(PRESS), recordPrevia(PRESS), recuperacionPrevia(PRESS)])).not.toContain('NaN!');
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd web && npx vitest run src/lib/__tests__/previa.test.js`
Expected: FAIL — `Failed to resolve import "../previa.js"`.

- [ ] **Step 3: Implementación mínima**

```js
// web/src/lib/previa.js
// Los datos de la previa del ejercicio (rediseño 2026-09-27, pieza 3): lo
// que se ve debajo de la tarjeta antes de empezar. Todo sale de funciones
// que ya existen (charts, muscle, objetivoHoy); acá sólo se eligen la
// ventana y el formato. Criterio de la app: sin dato, null — nunca un cero.
import { e1rmSeries, trend, exerciseSeries } from './charts.js';
import { catOf, recoveryPct, daysSinceGroup, diasTexto } from './muscle.js';
import { round1, dstr } from './format.js';

const UNI = ' (unilateral)';
/** La ventana del cambio de fuerza: 8 semanas. */
const VENTANA_DIAS = 56;

/** La clave de historial por nombre, la misma que usa Progreso
    (exerciseSeries/e1rmSeries): el unilateral es otra serie. */
const clave = (ex, uni) => String(ex?.name || '').trim() + (uni ? UNI : '');

function diasEntre(desde, hasta) {
  return Math.round((new Date(hasta + 'T12:00:00') - new Date(desde + 'T12:00:00')) / 86400000);
}

export function fuerzaPrevia(ex, { uni = false } = {}) {
  const pts = e1rmSeries(clave(ex, uni));
  if (!pts.length) return null;
  const ultimo = pts[pts.length - 1];
  const puntos = pts.filter(p => diasEntre(p.date, ultimo.date) <= VENTANA_DIAS);
  const base = puntos[0];
  const tramo = diasEntre(base.date, ultimo.date);
  const hayCambio = puntos.length >= 2 && tramo >= 7 && base.y > 0;
  return {
    actual: round1(ultimo.y),
    cambioPct: hayCambio ? (Math.round(((ultimo.y - base.y) / base.y) * 100) || 0) : null,
    semanas: hayCambio ? Math.max(1, Math.round(tramo / 7)) : null,
    puntos,
    tendencia: trend(puntos),
    fecha: ultimo.date,
  };
}

export function sparkPuntos(puntos, { ancho = 96, alto = 38, margen = 3 } = {}) {
  const ys = (puntos || []).map(p => Number(p?.y)).filter(Number.isFinite);
  if (ys.length < 2 || !(ancho > 2 * margen) || !(alto > 2 * margen)) return null;
  const min = Math.min(...ys), max = Math.max(...ys), rango = max - min;
  const w = ancho - 2 * margen, h = alto - 2 * margen;
  const xy = ys.map((y, i) => [
    round1(margen + (i / (ys.length - 1)) * w),
    round1(rango ? margen + (1 - (y - min) / rango) * h : alto / 2),
  ]);
  const [x, y] = xy[xy.length - 1];
  return { points: xy.map(p => p.join(',')).join(' '), ultimo: { x, y } };
}

export function haceTexto(dias) {
  if (dias == null || !Number.isFinite(dias) || dias < 0) return '';
  if (dias < 14) return diasTexto(dias);
  if (dias < 60) return `hace ${Math.round(dias / 7)} semanas`;
  return `hace ${Math.round(dias / 30)} meses`;
}

export function recordPrevia(ex, { uni = false, hoy = dstr() } = {}) {
  let mejor = null;
  for (const p of exerciseSeries()[clave(ex, uni)] || []) if (!mejor || p.best > mejor.best) mejor = p;
  if (!mejor) return null;
  const dias = Math.max(0, diasEntre(mejor.date, hoy));
  return { w: mejor.w, r: mejor.r, date: mejor.date, dias, hace: haceTexto(dias) };
}

export function recuperacionPrevia(ex) {
  const cat = catOf(ex);
  if (!cat) return null;
  return { cat, pct: recoveryPct(cat), dias: daysSinceGroup(cat) };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd web && npx vitest run src/lib/__tests__/previa.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/previa.js web/src/lib/__tests__/previa.test.js
git commit -m "feat(previa): fuerza, sparkline, récord y recuperación del ejercicio"
```

---

### Task 4: Previa — meta de hoy, "Primera vez" y el selector completo

**Files:**
- Modify: `web/src/lib/previa.js`
- Test: `web/src/lib/__tests__/previa.test.js` (bloques nuevos)

**Interfaces:**
- Consumes: `objetivoHoy(ex, { uni, ajuste })` (`objetivoHoy.js:21`, que ya usa `progresion` y `suggestedWeight`); `lastDataFor(ex)` (`session.js:20`); `S`, `wDisplay` (`state.js`); Task 3.
- Produces:
  - `metaHoy(ex, { uni = false, ajuste = 0 }) → { tipo: 'subir'|'sostener'|'sumar'|'sugerido'|'primera', peso: number|null, reps: number|null, texto: string }` —
    `subir`: peso nuevo × piso; `sostener`: peso × tope, texto de `objetivoHoy`; `sumar`: peso × (mejores reps de la última vez al peso de trabajo + 1, con techo en el tope), texto `'1 rep más que la última'`; `sugerido`: `suggestedWeight` (80 % del 1RM, con el ajuste del chequeo) × `ex.reps`; `primera`: `ex.pesoInicialKg` si la rutina lo declara (texto `'tu peso de partida'`), si no `peso: null` y `'arrancá liviano'`.
  - `metaTexto(meta) → string` — la línea lista: `'47.5 kg × 8 · 1 rep más que la última'`, `'~40 kg × 10 · 80% de tu 1RM estimado'`, `'10 reps · arrancá liviano'`. Pesos con `wDisplay` y la unidad de `S.cfg.unit`. La misma línea va dentro de la tarjeta después de Empezar.
  - `previaEjercicio(ex, { uni = false, ajuste = 0, hoy = dstr() }) → { primeraVez: boolean, fuerza, record, recuperacion, meta }` — `primeraVez = !lastDataFor(ex)` (la misma condición que el "Primera vez" de la tarjeta, por equipo); en primera vez `fuerza` y `record` son `null` (sin gráfico) y el peso sugerido llega en `meta` (`tipo: 'sugerido'`).

- [ ] **Step 1: Escribir los tests que fallan** (agregar a `previa.test.js`; sumar `metaHoy, metaTexto, previaEjercicio` al import de `../previa.js`)

```js
describe('metaHoy y metaTexto', () => {
  it('sumar reps: 1 rep más que la mejor de la última vez al peso de trabajo', () => {
    S.sessions = [sesion('2026-09-20', [serie(47.5, 7), serie(47.5, 6)])];
    const m = metaHoy(PRESS);
    expect(m).toEqual({ tipo: 'sumar', peso: 47.5, reps: 8, texto: '1 rep más que la última' });
    expect(metaTexto(m)).toBe('47.5 kg × 8 · 1 rep más que la última');
  });
  it('sumar nunca pide más que el tope del rango', () => {
    S.sessions = [sesion('2026-09-20', [serie(47.5, 10), serie(47.5, 9)])];
    expect(metaHoy(PRESS).reps).toBe(11); // piso 8 + ventana 3
  });
  it('subir: peso nuevo y vuelta al piso', () => {
    S.sessions = [sesion('2026-09-20', [serie(40, 11), serie(40, 11)])];
    const m = metaHoy(PRESS);
    expect(m.tipo).toBe('subir');
    expect(m.peso).toBeGreaterThan(40);
    expect(m.reps).toBe(8);
  });
  it('sostener: al tope en las series que faltan', () => {
    S.sessions = [sesion('2026-09-20', [serie(40, 11), serie(40, 9)])];
    const m = metaHoy(PRESS);
    expect(m).toMatchObject({ tipo: 'sostener', peso: 40, reps: 11 });
    expect(metaTexto(m)).toBe('40 kg × 11 · 1 serie más a 11 reps');
  });
  it('primera vez en este equipo pero con historial del nombre: el sugerido por 1RM', () => {
    S.sessions = [sesion('2026-09-20', [serie(50, 8)])];
    const m = metaHoy({ ...PRESS, equip: 'barra' });
    expect(m.tipo).toBe('sugerido');
    expect(m.peso).toBeGreaterThan(0);
    expect(m.reps).toBe(8);
    expect(metaTexto(m)).toMatch(/^~\d/);
  });
  it('primera vez sin nada: sin número inventado', () => {
    const m = metaHoy(PRESS);
    expect(m).toEqual({ tipo: 'primera', peso: null, reps: 8, texto: 'arrancá liviano' });
    expect(metaTexto(m)).toBe('8 reps · arrancá liviano');
  });
  it('primera vez con peso de partida declarado en la rutina', () => {
    const m = metaHoy({ ...PRESS, pesoInicialKg: 30 });
    expect(m).toMatchObject({ tipo: 'primera', peso: 30, texto: 'tu peso de partida' });
    expect(metaTexto(m)).toBe('30 kg × 8 · tu peso de partida');
  });
  it('en libras muestra libras', () => {
    S.cfg.unit = 'lb';
    S.sessions = [sesion('2026-09-20', [serie(47.5, 7)])];
    expect(metaTexto(metaHoy(PRESS))).toMatch(/^104\.7 lb × 8/);
  });
  it('sin meta no hay línea', () => {
    expect(metaTexto(null)).toBe('');
  });
});

describe('previaEjercicio', () => {
  it('con historial trae los cuatro paneles', () => {
    S.sessions = [sesion(hace(7), [serie(50, 8)]), sesion(hace(21), [serie(47.5, 8)])];
    const p = previaEjercicio(PRESS);
    expect(p.primeraVez).toBe(false);
    expect(p.fuerza.cambioPct).not.toBe(null);
    expect(p.record).toMatchObject({ w: 50, r: 8 });
    expect(p.recuperacion.cat).toBe('Pecho');
    expect(p.meta.tipo).toBe('sumar');
  });
  it('primera vez: sin gráfico ni récord, con el peso sugerido en la meta', () => {
    S.sessions = [sesion(hace(7), [serie(50, 8)])];
    const p = previaEjercicio({ ...PRESS, equip: 'barra' });
    expect(p.primeraVez).toBe(true);
    expect(p.fuerza).toBe(null);
    expect(p.record).toBe(null);
    expect(p.meta.tipo).toBe('sugerido');
  });
  it('un ejercicio nuevo de verdad: nada vacío ni NaN', () => {
    const p = previaEjercicio({ id: 'n', name: 'Remo pendlay', sets: 3, reps: 6 });
    expect(p).toMatchObject({ primeraVez: true, fuerza: null, record: null });
    expect(p.meta.texto).toBeTruthy();
    expect(metaTexto(p.meta)).not.toMatch(/NaN|undefined|null/);
    expect(sinNaN(p)).not.toContain('NaN!');
  });
  it('el ajuste del chequeo inicial llega a la meta sugerida', () => {
    S.sessions = [sesion(hace(7), [serie(50, 8)])];
    const sin = previaEjercicio({ ...PRESS, equip: 'barra' }).meta.peso;
    const con = previaEjercicio({ ...PRESS, equip: 'barra' }, { ajuste: -0.1 }).meta.peso;
    expect(con).toBeLessThan(sin);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd web && npx vitest run src/lib/__tests__/previa.test.js`
Expected: FAIL — `metaHoy is not a function`.

- [ ] **Step 3: Implementación mínima** (agregar a `previa.js`; imports nuevos: `import { S, wDisplay } from './state.js'; import { objetivoHoy } from './objetivoHoy.js'; import { lastDataFor } from './session.js';`)

```js
const repsDe = ex => {
  const r = Math.round(Number(ex?.reps));
  return r > 0 ? r : null;
};

export function metaHoy(ex, { uni = false, ajuste = 0 } = {}) {
  const obj = objetivoHoy(ex, { uni, ajuste });
  const { tipo } = obj;
  if (tipo === 'subir' || tipo === 'sostener') return { tipo, peso: obj.peso, reps: obj.meta, texto: obj.texto };
  if (tipo === 'sumar') {
    const last = lastDataFor(ex) || [];
    const top = Math.max(...last.map(s => s.w));
    const mejores = Math.max(0, ...last.filter(s => s.w >= top - 0.01).map(s => s.r));
    return { tipo, peso: obj.peso, reps: last.length ? Math.min(obj.meta, mejores + 1) : obj.meta, texto: '1 rep más que la última' };
  }
  if (tipo === 'sugerido') return { tipo, peso: obj.peso, reps: repsDe(ex), texto: obj.texto };
  const inicial = typeof ex?.pesoInicialKg === 'number' && ex.pesoInicialKg > 0 ? ex.pesoInicialKg : null;
  return inicial != null
    ? { tipo, peso: inicial, reps: repsDe(ex), texto: 'tu peso de partida' }
    : { tipo, peso: null, reps: repsDe(ex), texto: obj.texto };
}

export function metaTexto(meta) {
  if (!meta) return '';
  const unidad = S.cfg.unit === 'lb' ? 'lb' : 'kg';
  const partes = [];
  if (meta.peso != null) partes.push(`${meta.tipo === 'sugerido' ? '~' : ''}${wDisplay(meta.peso)} ${unidad}${meta.reps ? ` × ${meta.reps}` : ''}`);
  else if (meta.reps) partes.push(`${meta.reps} reps`);
  if (meta.texto) partes.push(meta.texto);
  return partes.join(' · ');
}

export function previaEjercicio(ex, { uni = false, ajuste = 0, hoy = dstr() } = {}) {
  const primeraVez = !lastDataFor(ex);
  return {
    primeraVez,
    fuerza: primeraVez ? null : fuerzaPrevia(ex, { uni }),
    record: primeraVez ? null : recordPrevia(ex, { uni, hoy }),
    recuperacion: recuperacionPrevia(ex),
    meta: metaHoy(ex, { uni, ajuste }),
  };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd web && npx vitest run src/lib/__tests__/previa.test.js && npm test`
Expected: PASS; la suite completa verde.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/previa.js web/src/lib/__tests__/previa.test.js
git commit -m "feat(previa): meta de hoy, primera vez y el selector completo"
```

---

# FASE 2 — UI, CSS y animaciones (después del color)

> **No empezar hasta que `feat/color-grafito` esté mergeado en `main`.** Primero: `git fetch origin && git rebase origin/main` (resolver conflictos: FASE 1 no toca CSS), releer `:root` en `styles.css` y reemplazar en los snippets de abajo cualquier nombre de token que haya quedado distinto. Los snippets usan los nombres de la spec §4.

### Task 5 (FASE 2): La rampa conectada al borrador y el botón que avanza

**Files:**
- Modify: `web/src/components/ExerciseCarousel.jsx` — `Rampa` (:486-527), el botón `.btn-serie` (:948-968), imports (:24-29).

**Interfaces:**
- Consumes: `estadoRampa`, `tocarPaso`, `estadoBoton` (Task 1); `pasosRampa`, `avanzarRampa`, `deshacerRampa`, `marcarCalentado` (Task 2 / `session.js`); `D`, `menosMovimiento` (`motion.js`).
- Produces: `Rampa({ ex, rampa, hechos, completa, onSaltar })` sin estado propio; `ExerciseSlide` es dueño de `hechos = pasosRampa(ex.id)`.

- [ ] **Step 1:** Borrar `const pasosRampa = new Map()` y el `useState` de `Rampa`. En `ExerciseSlide`, después de `const rampa = …` (:691):

```jsx
const hechosRampa = calentar ? pasosRampa(ex.id) : 0;
const rampaEstado = estadoRampa(rampa, hechosRampa);
const [plegando, setPlegando] = useState(false);
const boton = estadoBoton({
  rampa: calentar && !plegando ? rampa : [],
  hechos: hechosRampa,
  serie: { etiqueta: uni ? (v.side === 'left' ? 'Izquierda' : 'Derecha') : `Serie ${serieHechas + 1}`, w: v.w, r: v.r },
  unidad, fmtPeso: wDisplay,
});
/* Completa: se ve el tercer ✓, aparece "Aproximación completa…" y la rampa
   se pliega (D.panel). Recién después marcarCalentado() arranca el descanso.
   Si la app se recargó con la rampa completa y sin marcar, se marca sin
   animación. */
useEffect(() => {
  if (!calentar || !rampaEstado.completa) return;
  if (menosMovimiento()) { marcarCalentado(ex, true); return; }
  setPlegando(true);
  const t = setTimeout(() => marcarCalentado(ex, true), D.momento + D.panel);
  return () => clearTimeout(t);
}, [calentar, rampaEstado.completa, ex]);
```

- [ ] **Step 2:** `Rampa` pasa a pintar `rampaEstado.pasos` (clase `hecho` / `cur` / nada), con `aria-current="step"` en el activo, `style={{ '--avance': rampaEstado.avance }}`, pesos con unidad (`{wDisplay(s.w)}<small> {unidad}</small>`), y al tocar un círculo:

```jsx
function tocar(i, el) {
  const r = tocarPaso(hechos, i, rampa.length);
  if (r.accion === 'deshacer') deshacerRampa(ex.id, r.hechos);
  else if (r.accion === 'sacudir' && !menosMovimiento()) {
    el.parentElement.querySelector('.ex-paso.cur i')?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
      { duration: D.objeto },
    );
  }
}
```

  Debajo de los pasos, `{completa && <p className="ex-rampa-ok" role="status">Aproximación completa · ahora la serie efectiva</p>}`. "Saltar" sigue llamando a `marcarCalentado(ex, false)`.

- [ ] **Step 3:** El botón grande usa `boton`:

```jsx
<button
  type="button"
  className={`btn-serie${boton.variante === 'aprox' ? ' aprox' : ''}`}
  onClick={e => {
    squashStretch(e.currentTarget);
    if (boton.variante === 'aprox') { avanzarRampa(ex.id, rampa.length); return; }
    impactBurst(e.clientX, e.clientY, { color: 'var(--ok)' });
    saveSet(ex.id);
  }}
>
  <span className="btn-serie-ok" aria-hidden="true"><Check size={22} /></span>
  <span className="btn-serie-t">{boton.texto}</span>
  <small ref={boton.variante === 'serie' ? valRef : undefined}>{boton.valor}</small>
</button>
```

  `syncDependents()` sólo escribe en `valRef` cuando el botón está en modo serie (el ref ya es `null` en modo aprox, no hace falta tocarlo).

- [ ] **Step 4:** `npm test` verde y `npm run lint` sin errores nuevos. Commit: `feat(rampa): el botón grande hace la rampa y el avance sobrevive a recargar`.

### Task 6 (FASE 2): CSS y animaciones de la rampa

**Files:**
- Modify: `web/src/styles.css` — `.ex-rampa*` / `.ex-paso*` (:1068-1086), `.btn-serie*` (:1089-1102), keyframes nuevos junto a los de la tarjeta.

- [ ] **Step 1:** Círculo activo que late: escala 1 → 1.07 y dos anillos desfasados que se expanden y desvanecen en un ciclo de ~1.6 s. Sólo `transform` y `opacity` (nada de `filter` en loop). Con movimiento reducido, un anillo fijo.

```css
.ex-paso i{width:40px;height:40px;position:relative}
.ex-paso.cur i{background:var(--warn);border-color:var(--warn);color:var(--bg);animation:rampaLate 1.6s ease-in-out infinite}
.ex-paso.cur i::before,.ex-paso.cur i::after{content:"";position:absolute;inset:-2px;border-radius:inherit;border:2px solid var(--warn);animation:rampaAnillo 1.6s ease-out infinite}
.ex-paso.cur i::after{animation-delay:.8s}
.ex-paso.hecho i{background:rgba(var(--warn-rgb),.14);border-color:var(--warn);color:var(--warn);transform:none}
.ex-paso.hecho i svg{animation:rampaPop var(--d2) var(--spring)}
.ex-rampa-pasos::before,.ex-rampa-pasos::after{top:19px}
.ex-rampa-pasos::after{background:var(--warn);transition:transform var(--d4) var(--ease)}
@keyframes rampaLate{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes rampaAnillo{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.7);opacity:0}}
@keyframes rampaPop{0%{transform:scale(.3);opacity:0}100%{transform:scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){
  .ex-paso.cur i,.ex-paso.cur i::before{animation:none}
  .ex-paso.cur i::after{display:none}
  .ex-paso.cur i::before{transform:scale(1.25);opacity:.5}
}
```

  (Revisar si `menosMovimiento()` depende de algo más que la media query — p. ej. una opción de Ajustes con clase en `<html>` — y replicar esa condición en el selector.)

- [ ] **Step 2:** Variante ámbar del botón (`.btn-serie.aprox`): borde `rgba(var(--warn-rgb),.55)`, fondo con el ámbar al 7–12 %, círculo `var(--warn)`, texto `var(--warn)`; la transición de ámbar a verde con `transition: background var(--d3) var(--ease), border-color var(--d3) var(--ease), color var(--d3) var(--ease)`.
- [ ] **Step 3:** "Saltar" con hit area ≥ 40 px: `.ex-rampa-hd .linkcard{min-height:40px;min-width:40px;padding:0 var(--s2)}`.
- [ ] **Step 4:** Pliegue al completar: envolver la rampa en `.ex-rampa-pliegue{display:grid;grid-template-rows:1fr;transition:grid-template-rows var(--d3) var(--ease)}` con hijo `min-height:0;overflow:hidden`, y `.plegando` → `grid-template-rows:0fr`, aplicado después de `D.momento` (el ✓ y la línea "Aproximación completa" se ven primero). `.ex-rampa-ok{color:var(--ok);font-size:var(--t-sm);text-align:center;margin-top:var(--s2)}`.
- [ ] **Step 5:** Commit: `style(rampa): el paso activo late, ✓ con pop, línea que se llena y botón ámbar`.

### Task 7 (FASE 2): Componente `PreviaEjercicio`

**Files:**
- Create: `web/src/components/PreviaEjercicio.jsx`
- Modify: `web/src/components/ExerciseCarousel.jsx` (`ExerciseSlide`, después de la tarjeta), `web/src/styles.css` (bloque `.previa*`).

**Interfaces:**
- Consumes: `previaEjercicio`, `sparkPuntos`, `metaTexto` (Tasks 3–4); `wDisplay` (`state.js`); `fmtNum` (`format.ts`).

- [ ] **Step 1:** Componente, con paneles `.card` (el vidrio de la app), sin inventar clases de apariencia:

```jsx
export default function PreviaEjercicio({ ex, uni, ajuste }) {
  const p = previaEjercicio(ex, { uni, ajuste });
  const unidad = S.cfg.unit === 'lb' ? 'lb' : 'kg';
  const spark = p.fuerza ? sparkPuntos(p.fuerza.puntos) : null;
  return (
    <div className="previa">
      {p.primeraVez ? (
        <div className="card previa-panel"><div className="previa-k">Primera vez</div><p className="previa-s">{metaTexto(p.meta)}</p></div>
      ) : p.fuerza && (
        <div className="card previa-panel previa-fuerza">
          <div>
            <div className="previa-k">Tu fuerza en este ejercicio</div>
            <div className="previa-big">{wDisplay(p.fuerza.actual)} <small>{unidad} 1RM est.</small></div>
            {p.fuerza.cambioPct != null && (
              <div className={p.fuerza.cambioPct >= 0 ? 'previa-up' : 'previa-down'}>
                {p.fuerza.cambioPct >= 0 ? '▲' : '▼'} {Math.abs(p.fuerza.cambioPct)} % en {p.fuerza.semanas} semana{p.fuerza.semanas === 1 ? '' : 's'}
              </div>
            )}
          </div>
          {spark && (
            <svg className="previa-spark" viewBox="0 0 96 38" aria-hidden="true">
              <polyline points={spark.points} /><circle cx={spark.ultimo.x} cy={spark.ultimo.y} r="3" />
            </svg>
          )}
        </div>
      )}
      {(p.record || p.recuperacion) && (
        <div className="previa-dos">
          {p.record && <div className="card previa-panel"><div className="previa-k">Récord</div><div className="previa-big">{wDisplay(p.record.w)} <small>{unidad} × {p.record.r}</small></div><div className="previa-s">{p.record.hace}</div></div>}
          {p.recuperacion && <div className="card previa-panel"><div className="previa-k">{p.recuperacion.cat}</div>{p.recuperacion.dias == null ? <div className="previa-s">sin registro</div> : <><div className="previa-big">{p.recuperacion.pct}<small>%</small></div><div className="previa-s">recuperado</div></>}</div>}
        </div>
      )}
      {!p.primeraVez && <div className="card previa-panel previa-meta">Meta de hoy: <b>{metaTexto(p.meta)}</b></div>}
    </div>
  );
}
```

- [ ] **Step 2:** En `ExerciseSlide`, debajo del `div.card.ex-card` y dentro de `.carousel-slide`: `{(isNext || (waiting && !curId)) && <PreviaEjercicio ex={ex} uni={uni} ajuste={S.draft?.precheckAdjust || 0} />}` (pasar `curId` a `ExerciseSlide`). Así, deslizar el carrusel a otro ejercicio sin empezar muestra la previa de ese ejercicio.
- [ ] **Step 3:** CSS `.previa` (`display:grid;gap:var(--s2);margin-top:var(--s3)`), `.previa-dos` (dos columnas), `.previa-k` (etiqueta condensada, mayúsculas, `--text-3`), `.previa-big` (condensada del héroe, `tabular-nums`), `.previa-up{color:var(--ok)}`, `.previa-down{color:var(--danger)}`, `.previa-spark polyline{fill:none;stroke:var(--accent);stroke-width:2;stroke-linejoin:round}`, `.previa-spark circle{fill:var(--accent)}`. Sparkline de 96×38; si a 390 no entra, bajar la sparkline a 72×28 antes de sacar paneles (spec §3).
- [ ] **Step 4:** Commit: `feat(previa): resumen del ejercicio en el espacio vacío antes de empezar`.

### Task 8 (FASE 2): La transición al tocar Empezar y la meta dentro de la tarjeta

**Files:**
- Modify: `web/src/components/ExerciseCarousel.jsx` (`ExerciseSlide`, `Comparativa`, `AvisoUltimaVez`), `web/src/components/PreviaEjercicio.jsx`, `web/src/styles.css`.

- [ ] **Step 1:** Envolver la previa en `<AnimatePresence initial={false}>` con `exit={{ opacity: 0, y: 12, transition: { duration: D.objeto / 1000, ease: curvaSalida } }}` (mismo `curvaSalida` que `desplegar`). Así los paneles salen con fundido y translateY mientras `.ex-live` se despliega con `D.panel`. Con `menosMovimiento()`, sin `exit` animado.
- [ ] **Step 2:** Meta de hoy dentro de la tarjeta, como una línea, sólo con el ejercicio abierto (antes de `.ex-live` o como primera `pieza`): `<p className="ex-meta-hoy">Meta de hoy · <b>{metaTexto(metaHoy(ex, { uni, ajuste }))}</b></p>`.
- [ ] **Step 3:** En el aviso de "Sesión anterior ›" (`AvisoUltimaVez` / `Comparativa`), sumar el 1RM con la sparkline y el récord (mismos `fuerzaPrevia` / `recordPrevia` / `sparkPuntos`), así el gráfico de fuerza y el récord siguen accesibles con el ejercicio en marcha.
- [ ] **Step 4:** Commit: `feat(previa): al empezar, la previa sale y la meta pasa a la tarjeta`.

### Task 9 (FASE 2): Verificación en Chrome y publicación

- [ ] **Step 1:** `cd web && npm test && npm run lint && npx vite build && npx vite preview --port 4190`. Pestaña propia, service worker desregistrado, caches borrados, datos de "Cargar mi registro" (Ajustes). Si el seed deja la sesión con fecha de hoy, adelantar el reloj un día con un `initScript` (ver el relevamiento).
- [ ] **Step 2:** A **390×844** y **430×932**:
  - Previa (C2): `document.scrollingElement.scrollHeight <= innerHeight` (sin scroll); el último panel termina por encima de la barra de pestañas (`getBoundingClientRect().bottom < tabbar.top`); ningún `textContent` con `NaN`/`undefined`; 1RM, cambio % y récord iguales a Progreso → 1RM y Progreso → PRs ("Mejor serie") para ese ejercicio. Probar también con un ejercicio nuevo (Primera vez): sin gráfico ni paneles vacíos.
  - Deslizar a otro ejercicio sin empezar: se ve su previa.
  - Empezar: la previa sale mientras la tarjeta se despliega; medir que la barra de sesión y la tarjeta no saltan (`top` estable antes/después); la meta aparece dentro de la tarjeta.
  - Rampa: estados paso 1, 2 y 3 activos, deshacer (tocar un ✓), paso futuro (sacude, no avanza), completa (se ve el ✓ y la línea, se pliega, después el descanso). Recargar a mitad de rampa: el avance sigue.
  - `document.getAnimations()`: el pulso corre sólo en el círculo activo, y no hay ninguna animación de `filter` en loop.
  - Tarjeta desplegada con la rampa: todo entra sin scroll a 390×844. "Saltar" ≥ 40×40.
- [ ] **Step 3:** Publicar según `CLAUDE.md`: rebase sobre `origin/main`, `npm run build`, commit de la raíz (`assets/ index.html manifest.webmanifest sw.js workbox-*.js`), push, PR (un PR para las dos piezas), merge.

---

## Autorrevisión

- Spec §2: botón que hace la rampa (T1 `estadoBoton`, T5), vibra (T2), círculos que laten con dos anillos y ✓ con pop (T6), línea 0 → 50 → 100 % (T1 `avanceLinea`, T6), deshacer / no saltar (T1 `tocarPaso`, T2, T5), sacudir (T5), Saltar ≥ 40 px y pesos con unidad (T5, T6), completa → línea + pliegue → descanso (T5, T6), persistido en el borrador (T2), verificación (T9).
- Spec §3: fuerza + cambio 8 semanas + sparkline (T3, T7), récord + hace cuánto (T3), recuperación (T3), meta de hoy (T4), Primera vez con sugerido y sin gráfico (T4, T7), sin NaN (T3, T4, T9), transición al Empezar (T8), meta dentro de la tarjeta (T8), fuerza y récord en "Sesión anterior ›" (T8), otro ejercicio al deslizar (T7), sin scroll y achicar la sparkline antes de quitar paneles (T7, T9).
