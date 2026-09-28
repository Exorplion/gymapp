# Asistente "Agregar ejercicio" (3 pasos): plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usá superpowers:subagent-driven-development
> (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por
> tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** un solo asistente de 3 pasos a pantalla completa, **`AgregarEjercicio`**,
para agregar un ejercicio a la rutina y a la sesión abierta. Pregunta qué ejercicio,
dónde va (con el lugar ya sugerido) y cómo se hace.

**Arquitectura:** toda la lógica vive en un módulo puro, `web/src/lib/asistente-agregar.js`.
Ahí están el estado y los pasos, la validación, el grupo detectado, las sugerencias,
la posición sugerida, las posiciones válidas, la lista del paso 2 con su recorte y el
guardado en la posición elegida. Cada función se prueba con vitest sin montar React.
El componente (`AgregarEjercicio.jsx`) sólo pinta ese estado y llama a esas funciones.
La persistencia reusa `saveExercise` (rutina) y `addSessionExercise` (sesión), cada una
con un parámetro nuevo de posición.

**Stack:** React 19, Vite, `motion` (no `framer-motion`), vitest y `lib/drag.js`
propio (sin librería).

**Spec:** `docs/superpowers/specs/2026-09-27-rediseno-sesion-y-color-design.md`, §1.
Maqueta aprobada: `.superpowers/brainstorm/177766-1790562557/content/01-agregar-ejercicio.html`
(Enzo eligió la opción A, 3 pasos, y pidió que "tengan las animaciones, fonts y todo bien
desarrollado, alineado y estético").

## Restricciones globales

- Usar los patrones visuales existentes: `.card`, `.nav-card`, `.chip`, `.group`/`.grouprow`
  y la condensada itálica del héroe (`.plan-title`). **Nunca** combinar una clase de
  apariencia con un reset (CLAUDE.md, "Coherencia visual").
- Duraciones sólo con `--d1..--d4` (CSS) o `D` (`lib/motion.js`), nunca un ms suelto.
- `menosMovimiento()` (`lib/motion.js`) para reducir el movimiento. En `motion`, eso ya
  lo cubre `<MotionConfig reducedMotion="user">`.
- Háptica con `vibrate()` de `lib/format.ts`.
- Hit areas ≥ 40 px y `tabular-nums` en las cifras.
- Verificación en Chrome con **build de producción** a **390×844** y **430×932**,
  **sin scroll** en los tres pasos y en los dos contextos.
- Una clase que se usa en el markup tiene que existir en `styles.css`.
- Colores **sólo** con los tokens del sistema grafito (spec §4). Por eso el CSS espera
  al merge de `feat/color-grafito` (ver "Fases").
- La app no inventa datos. Si falta el grupo, se pide; no se adivina.

## Fases

- **FASE 1 (lógica, ya hecha en `feat/asistente-agregar`)**: Tareas 1 a 4. Son funciones
  puras más dos cambios mínimos de firma en `rutina-logic.js` y `session.js`. No llevan
  CSS ni componente.
- **FASE 2 (después del color)**: Tareas 5 a 10. Tienen markup, CSS, animaciones y
  verificación visual, y empiezan **después** del merge de `feat/color-grafito`. Esa rama
  renombra todos los tokens de color de `styles.css`, así que CSS escrito antes habría que
  rehacerlo. **Al arrancar la FASE 2**, rebasar la rama sobre `origin/main` y abrir el
  `:root` de `styles.css` para confirmar los nombres finales de los tokens que usa la
  Tarea 9.

## Mapa de archivos

| Archivo | Qué hace | Fase |
|---|---|---|
| `web/src/lib/asistente-agregar.js` (nuevo) | Toda la lógica del asistente | 1 |
| `web/src/lib/__tests__/asistente-agregar.test.js` (nuevo) | Tests de la lógica y de "queda donde se lo dejó" | 1 |
| `web/src/lib/rutina-logic.js` (`saveExercise`, `pinAddedToRoutine`) | `{ posicion }` y devolver el ejercicio. `cat` en el pin | 1 |
| `web/src/lib/session.js` (`addSessionExercise`, `completeSession`) | `donde = { antesDe \| despuesDe }` y `cat` en extras/added | 1 |
| `web/src/components/EquipIcon.jsx` (nuevo) | 8 íconos SVG de equipo, en `currentColor` | 2 |
| `web/src/components/sheets/AgregarEjercicio.jsx` (nuevo) | El asistente (markup y estado local) | 2 |
| `web/src/lib/drag.js` | kind `asist`: sólo se arrastra la fila nueva, commit a un callback | 2 |
| `web/src/App.jsx`, `Sheet.jsx` | Hoja `agregar-ej` y variante `pantalla` | 2 |
| `Rutina.jsx:715`, `Hoy.jsx:261`, `Hoy.jsx:499` | Las entradas abren `agregar-ej` | 2 |
| `ExerciseForm.jsx` | Sin `CreateWizard`: queda sólo editar | 2 |
| `SessionExercise.jsx` | Sin modo agregar: queda sólo "Cambiar" (ver Duda 1) | 2 |
| `web/src/lib/exercise-wizard.js` (+ test) | Queda sólo `resolvedCat`; se borra la máquina de 4 pasos | 2 |
| `web/src/styles.css` | Bloque `.asist-*` | 2 |

---

## FASE 1: lógica

Todos los tests de la FASE 1 viven en `web/src/lib/__tests__/asistente-agregar.test.js`,
con este encabezado (los mismos mocks que `despues.test.js`):

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { porBloques } from '../muscle.js';
import { sessionExs } from '../session.js';
import {
  PASOS, NUEVO, estadoInicial, setNombre, setGrupo, setCampo, ajustar,
  necesitaGrupo, grupoDe, validarPaso, avanzar, volver, rangoReps, textoCTA,
  datosParaGuardar, autocompletar, catalogoDe, teFaltaHoy,
  contextoRutina, contextoSesion, posicionesValidas, posicionSugerida,
  posicionDe, moverNuevo, soltarEn, recortar, listaPaso2, destinoSesion,
  confirmarAgregar,
} from '../asistente-agregar.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));

const ex = (id, name, extra = {}) => ({ id, name, sets: 3, reps: 10, ...extra });
const conNombre = (tipo, name, cat = '') => setGrupo(setNombre(estadoInicial(tipo), name), cat);
```

### Tarea 1: estado del asistente (pasos, validación, grupo)

**Archivos:**
- Crear: `web/src/lib/asistente-agregar.js`
- Test: `web/src/lib/__tests__/asistente-agregar.test.js`

**Interfaces:**
- Consume: `catOf` (`muscle.ts`), `resolvedCat` (`exercise-wizard.js`) y `VENTANA` (`progression.ts`).
- Produce:
  - `PASOS = 3`
  - `estadoInicial(tipo: 'rutina'|'sesion')`, que devuelve
    `{ tipo, paso: 1, form: { name, cat, sets: 3, reps: 10, equip: '', unilateral: false }, posicion: null }`
  - `setNombre(estado, name)` y `setGrupo(estado, cat)`. Las dos devuelven un estado nuevo y vuelven `posicion` a `null`.
  - `setCampo(estado, campo, valor)` y `ajustar(estado, 'sets'|'reps', delta)`. Recortan a 1..10 las series y a 1..50 las reps.
  - `necesitaGrupo(form)` y `grupoDe(form)`. `grupoDe` devuelve `string|null`.
  - `validarPaso(estado)`, que devuelve `string|null`. `avanzar(estado)` devuelve `{ estado, error }` y `volver(estado)` devuelve un estado.
  - `rangoReps(reps)`, que devuelve `{ piso, tope, texto }`. `textoCTA(tipo)`.
  - `datosParaGuardar(form)`, que devuelve `{ name, sets, reps, equip, unilateral, cat }`.

Reglas:
- El grupo se deduce del nombre con la detección de siempre (`resolvedCat`, que llama a `catOf`).
- Los chips de grupo aparecen **sólo** si `necesitaGrupo(form)`.
- Un grupo elegido a mano se descarta en cuanto el nombre pasa a ser detectable. Así un
  grupo viejo no pisa lo que se detecta, y `resolvedCat` sigue siendo correcto.
- Se guarda `cat` sólo cuando se eligió a mano. Vacío quiere decir automático, como en
  `saveExercise`.
- Las reps usan el rango de la doble progresión: piso = `reps`, tope = `reps + VENTANA`.

- [ ] **Paso 1: escribir los tests que fallan**

```js
describe('estado del asistente', () => {
  it('arranca en el paso 1 de 3, sin posición elegida', () => {
    const e = estadoInicial('sesion');
    expect(PASOS).toBe(3);
    expect(e).toMatchObject({ tipo: 'sesion', paso: 1, posicion: null });
    expect(e.form).toMatchObject({ name: '', cat: '', sets: 3, reps: 10, equip: '', unilateral: false });
  });

  it('sin nombre no avanza y dice qué falta', () => {
    const { estado, error } = avanzar(estadoInicial('rutina'));
    expect(estado.paso).toBe(1);
    expect(error).toMatch(/ejercicio/);
  });

  it('con nombre detectable pasa al paso 2 sin pedir el grupo', () => {
    const e = setNombre(estadoInicial('rutina'), 'Remo en polea');
    expect(necesitaGrupo(e.form)).toBe(false);
    expect(grupoDe(e.form)).toBe('Espalda');
    expect(avanzar(e).estado.paso).toBe(2);
  });

  it('si la detección falla pide el grupo, y con el grupo elegido avanza', () => {
    const e = setNombre(estadoInicial('rutina'), 'Movimiento raro');
    expect(necesitaGrupo(e.form)).toBe(true);
    expect(avanzar(e).error).toMatch(/grupo/);
    const conGrupo = setGrupo(e, 'Hombro');
    expect(grupoDe(conGrupo.form)).toBe('Hombro');
    expect(avanzar(conGrupo).estado.paso).toBe(2);
  });

  it('un grupo elegido a mano se descarta si el nombre pasa a ser detectable', () => {
    const e = setNombre(setGrupo(setNombre(estadoInicial('rutina'), 'Movimiento raro'), 'Hombro'), 'Press banca');
    expect(e.form.cat).toBe('');
    expect(grupoDe(e.form)).toBe('Pecho');
  });

  it('cambiar el nombre o el grupo vuelve a la posición sugerida', () => {
    const e = { ...setNombre(estadoInicial('rutina'), 'Press banca'), posicion: 4 };
    expect(setNombre(e, 'Remo').posicion).toBeNull();
    expect(setGrupo(e, 'Pecho').posicion).toBeNull();
  });

  it('no pasa del paso 3 ni baja del 1; volver no borra nada', () => {
    let e = setNombre(estadoInicial('rutina'), 'Press banca');
    e = avanzar(avanzar(avanzar(e).estado).estado).estado;
    expect(e.paso).toBe(3);
    e = volver(volver(volver(e)));
    expect(e.paso).toBe(1);
    expect(e.form.name).toBe('Press banca');
  });

  it('los steppers no bajan de 1 ni pasan el tope', () => {
    let e = estadoInicial('rutina');
    e = ajustar(ajustar(ajustar(e, 'sets', -1), 'sets', -1), 'sets', -1);
    expect(e.form.sets).toBe(1);
    e = setCampo(e, 'sets', 10);
    expect(ajustar(e, 'sets', 1).form.sets).toBe(10);
    expect(ajustar(setCampo(e, 'reps', 50), 'reps', 1).form.reps).toBe(50);
  });

  it('el rango de reps es el de la doble progresión (piso + VENTANA)', () => {
    expect(rangoReps(8)).toEqual({ piso: 8, tope: 11, texto: '8–11' });
  });

  it('el CTA dice a dónde va', () => {
    expect(textoCTA('rutina')).toBe('Agregar a la rutina');
    expect(textoCTA('sesion')).toBe('Agregar a la sesión');
  });

  it('guarda cat sólo si se eligió a mano', () => {
    expect(datosParaGuardar(conNombre('rutina', ' Press banca ').form)).toMatchObject({ name: 'Press banca', cat: '' });
    expect(datosParaGuardar(conNombre('rutina', 'Movimiento raro', 'Hombro').form).cat).toBe('Hombro');
  });
});
```

- [ ] **Paso 2: correr los tests y ver que fallen**

Correr: `cd web && npx vitest run src/lib/__tests__/asistente-agregar.test.js`
Esperado: FALLA con "Failed to resolve import ../asistente-agregar.js".

- [ ] **Paso 3: implementar lo mínimo**

```js
// Asistente "Agregar ejercicio" (3 pasos): la lógica, sin DOM ni React.
// (Cabecera completa en el archivo: por qué existe y qué reemplaza.)
import { catOf } from './muscle.js';
import { resolvedCat } from './exercise-wizard.js';
import { VENTANA } from './progression.js';

export const PASOS = 3;
const TOPE = { sets: 10, reps: 50 };

export function estadoInicial(tipo = 'rutina') {
  return {
    tipo, paso: 1, posicion: null,
    form: { name: '', cat: '', sets: 3, reps: 10, equip: '', unilateral: false },
  };
}

const detectado = name => catOf({ name }) || null;
export const necesitaGrupo = form => !!form.name.trim() && !detectado(form.name);
export const grupoDe = form => resolvedCat(form) || null;

export function setNombre(estado, name) {
  const cat = detectado(name) ? '' : estado.form.cat;
  return { ...estado, form: { ...estado.form, name, cat }, posicion: null };
}
export function setGrupo(estado, cat) {
  return { ...estado, form: { ...estado.form, cat }, posicion: null };
}
export function setCampo(estado, campo, valor) {
  return { ...estado, form: { ...estado.form, [campo]: valor } };
}
export function ajustar(estado, campo, delta) {
  const v = (parseInt(estado.form[campo], 10) || 1) + delta;
  return setCampo(estado, campo, Math.min(TOPE[campo], Math.max(1, v)));
}

export function validarPaso(estado) {
  if (estado.paso !== 1) return null;
  if (!estado.form.name.trim()) return 'Escribí o elegí un ejercicio para seguir';
  if (!grupoDe(estado.form)) return 'Elegí qué grupo entrena para seguir';
  return null;
}
export function avanzar(estado) {
  const error = validarPaso(estado);
  if (error) return { estado, error };
  return { estado: { ...estado, paso: Math.min(PASOS, estado.paso + 1) }, error: null };
}
export const volver = estado => ({ ...estado, paso: Math.max(1, estado.paso - 1) });

export function rangoReps(reps) {
  const piso = Math.max(1, parseInt(reps, 10) || 1);
  return { piso, tope: piso + VENTANA, texto: `${piso}–${piso + VENTANA}` };
}
export const textoCTA = tipo => (tipo === 'sesion' ? 'Agregar a la sesión' : 'Agregar a la rutina');

export function datosParaGuardar(form) {
  const name = form.name.trim();
  return {
    name, sets: form.sets, reps: form.reps, equip: form.equip || '',
    unilateral: !!form.unilateral, cat: detectado(name) ? '' : (form.cat || ''),
  };
}
```

- [ ] **Paso 4: correr los tests y ver que pasen**

Correr: `cd web && npx vitest run src/lib/__tests__/asistente-agregar.test.js`
Esperado: PASA.

- [ ] **Paso 5: commit**

```bash
git add web/src/lib/asistente-agregar.js web/src/lib/__tests__/asistente-agregar.test.js
git commit -m "feat(asistente): estado de 3 pasos, validación y grupo detectado"
```

### Tarea 2: sugerencias del paso 1 (autocompletado, "Te falta hoy", explorar)

**Archivos:**
- Modificar: `web/src/lib/asistente-agregar.js`
- Test: `web/src/lib/__tests__/asistente-agregar.test.js`

**Interfaces:**
- Consume: `EXCATALOG` y `MUSCLE_CATS` (`muscle.ts`), `exMatchesQuery` (`exdb.js`),
  `dayCategories` (`rutina-logic.js`) y `norm` (`format.ts`).
- Produce:
  - `autocompletar(q, max = 6)`, que devuelve `string[]`.
  - `catalogoDe(cat, yaEstan = [])`, que devuelve `string[]`.
  - `teFaltaHoy(ctx, max = 3)`, que devuelve `{ cat, ejercicios: string[] } | null`.
  - `ctx` tiene la forma `{ tipo, nombreTurno, fijos: Fila[], movibles: Fila[] }`, con
    `Fila = { id, name, cat?, sets, estado: 'pendiente'|'en-curso'|'hecho'|'salteado' }`.
    Lo arma la Tarea 3.

Regla de "Te falta hoy": los candidatos son los grupos del turno más los que nombra el
turno (`dayCategories`, por ejemplo "Pecho / Tríceps"). Se toma el que tenga **menos series
planificadas** en el turno; un grupo nombrado y sin ejercicios vale 0. Los salteados no
cuentan. Un empate se desempata por el orden de `MUSCLE_CATS`. Si el catálogo no tiene nada
nuevo para ese grupo, se prueba el siguiente. Si no hay candidatos, devuelve `null` y la
fila no se muestra.

- [ ] **Paso 1: escribir los tests que fallan**

```js
const ctxDe = (tipo, nombreTurno, movibles, fijos = []) => ({ tipo, nombreTurno, fijos, movibles });
const f = (id, name, sets = 3, estado = 'pendiente') => ({ id, name, sets, estado });

describe('sugerencias del paso 1', () => {
  it('autocompleta del catálogo sin repetir lo ya escrito entero', () => {
    const r = autocompletar('remo');
    expect(r).toContain('Remo con barra');
    expect(r.length).toBeLessThanOrEqual(6);
    expect(autocompletar('Remo con barra')).not.toContain('Remo con barra');
    expect(autocompletar('   ')).toEqual([]);
  });

  it('explorar un grupo da su catálogo sin lo que ya está', () => {
    const r = catalogoDe('Pecho', ['press banca']);
    expect(r).toContain('Aperturas en polea');
    expect(r).not.toContain('Press banca');
  });

  it('te falta hoy: el grupo con menos series planificadas del turno', () => {
    const ctx = ctxDe('rutina', 'Anterior A', [
      f('a', 'Press banca', 4), f('b', 'Press inclinado', 4), f('c', 'Elevaciones laterales', 3), f('d', 'Extensión tríceps polea', 2),
    ]);
    const r = teFaltaHoy(ctx);
    expect(r.cat).toBe('Tríceps');
    expect(r.ejercicios.length).toBeGreaterThan(0);
    expect(r.ejercicios.length).toBeLessThanOrEqual(3);
    expect(r.ejercicios).not.toContain('Extensión tríceps polea');
  });

  it('un grupo que el nombre del turno promete y no tiene ejercicios es el que falta', () => {
    const ctx = ctxDe('rutina', 'Pecho / Tríceps', [f('a', 'Press banca', 4), f('b', 'Aperturas en polea', 3)]);
    expect(teFaltaHoy(ctx).cat).toBe('Tríceps');
  });

  it('en la sesión no cuenta lo salteado', () => {
    const ctx = ctxDe('sesion', 'Tirón', [f('a', 'Remo con barra', 4)], [f('b', 'Curl con barra', 3, 'salteado')]);
    expect(teFaltaHoy(ctx).cat).toBe('Espalda');
  });

  it('turno vacío y sin nombre reconocible: nada que sugerir', () => {
    expect(teFaltaHoy(ctxDe('rutina', 'Día 3', []))).toBeNull();
  });
});
```

Ojo con el test de sesión: sin el salteado, Bíceps tendría 3 series contra 4 de Espalda y
ganaría Bíceps. Con el salteado afuera, el único grupo es Espalda.

- [ ] **Paso 2: correr y ver que falle**

Correr: `cd web && npx vitest run src/lib/__tests__/asistente-agregar.test.js`
Esperado: FALLA con "autocompletar is not a function" o un error de import.

- [ ] **Paso 3: implementar**

```js
import { EXCATALOG, MUSCLE_CATS } from './muscle.js';
import { norm } from './format.js';
import { exMatchesQuery } from './exdb.js';
import { dayCategories } from './rutina-logic.js';

export function autocompletar(q, max = 6) {
  const nq = norm(q);
  if (!nq) return [];
  return EXCATALOG.filter(e => norm(e.n) !== nq && exMatchesQuery(e.n, nq)).slice(0, max).map(e => e.n);
}

export function catalogoDe(cat, yaEstan = []) {
  const ya = new Set(yaEstan.map(n => norm(n)));
  return EXCATALOG.filter(e => e.c === cat && !ya.has(norm(e.n))).map(e => e.n);
}

export function teFaltaHoy(ctx, max = 3) {
  const filas = [...ctx.fijos, ...ctx.movibles].filter(x => x.estado !== 'salteado');
  const series = new Map();
  for (const c of dayCategories(ctx.nombreTurno)) series.set(c, 0);
  for (const x of filas) {
    const c = catOf(x);
    if (c) series.set(c, (series.get(c) || 0) + (x.sets || 0));
  }
  const nombres = filas.map(x => x.name);
  const orden = [...series.entries()]
    .sort((a, b) => a[1] - b[1] || MUSCLE_CATS.indexOf(a[0]) - MUSCLE_CATS.indexOf(b[0]));
  for (const [cat] of orden) {
    const ejercicios = catalogoDe(cat, nombres).slice(0, max);
    if (ejercicios.length) return { cat, ejercicios };
  }
  return null;
}
```

- [ ] **Paso 4: correr y ver que pase.** El mismo comando. Esperado: PASA.

- [ ] **Paso 5: commit**

```bash
git add web/src/lib/asistente-agregar.js web/src/lib/__tests__/asistente-agregar.test.js
git commit -m "feat(asistente): sugerencias del paso 1 (te falta hoy, explorar, autocompletar)"
```

### Tarea 3: paso 2 (contexto, posición sugerida, posiciones válidas, lista y recorte)

**Archivos:**
- Modificar: `web/src/lib/asistente-agregar.js`
- Test: `web/src/lib/__tests__/asistente-agregar.test.js`

**Interfaces:**
- Consume: `porBloques` (`muscle.ts`) y, de `session.js`, `sessionExs`, `isSkipped`,
  `setsDone` y `targetSets`.
- Produce:
  - `NUEVO = '__nuevo'`, el id de la fila nueva en el DOM (`data-sid`).
  - `contextoRutina(index)` y `contextoSesion(index)`, que devuelven un `ctx` (ver Tarea 2).
  - `posicionesValidas(ctx, cat)`, que devuelve `number[]`: índices de inserción en `ctx.movibles`.
  - `posicionSugerida(ctx, cat)`, que devuelve `{ pos, texto }`.
  - `posicionDe(estado, ctx)`, que devuelve un `number`: la elegida o la sugerida, siempre válida.
  - `moverNuevo(estado, ctx, dir: -1|1)`, que devuelve un estado. Es la acción de ▲▼.
  - `soltarEn(estado, ctx, idsCaja: string[])`, que devuelve un estado. Es el commit del
    arrastre: recibe el orden de ids que quedó en la caja arrastrable, con `NUEVO` adentro.
  - `recortar(filas, idx, radio = 3)`, que devuelve `{ desde, hasta, arriba, abajo, visibles }`.
  - `listaPaso2(estado, ctx, { radio = 3 })`, que devuelve
    `{ filas, idxNuevo, pos, sugerida, enSugerida, puedeSubir, puedeBajar, recorte }`.
    Cada fila tiene la forma `{ id, name, n, fijo, estado, nuevo? }`.

Reglas:
- **Rutina.** `movibles` es `porBloques(d.exercises)`, el orden que se ve y el real después
  de #124. No hay fijos. Como el editor reagrupa por músculo, una posición sólo es válida si
  **ahí se queda**. Si el grupo ya está en el turno, vale cualquier lugar dentro de su bloque
  (bordes incluidos). Si no está, vale cualquier borde entre bloques. Cualquier otra posición
  la movería `porBloques` y el ejercicio no quedaría donde se lo dejó.
- **Sesión.** Son fijos los ejercicios empezados, hechos o salteados; van arriba, apagados.
  Los movibles son los pendientes, en el orden real (`sessionExs`). El nuevo puede ir en
  cualquier lugar entre los pendientes, porque la sesión no reagrupa.
- **Sugerida.** Va después del último movible de su grupo. En la sesión, si el grupo sólo
  aparece en los ya hechos, va primero entre los pendientes, para seguir con ese grupo. Si
  no hay ninguno de su grupo, va al final. Los textos se ven en los tests.
- **Recorte.** Si hay más de `2·radio + 2` filas, se muestran `2·radio + 1` centradas en el
  nuevo (pegadas al borde si no alcanzan). Lo que queda afuera va en "+N" arriba y abajo.
  Plegar una sola fila no ahorra nada: con `2·radio + 2` filas se muestran todas.

- [ ] **Paso 1: escribir los tests que fallan**

```js
describe('paso 2: dónde va', () => {
  // Turno de la rutina guardado DESORDENADO a propósito: lo que se ve es porBloques.
  beforeEach(() => {
    S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Torso', exercises: [
      ex('p1', 'Press banca'), ex('e1', 'Jalón al pecho'), ex('h1', 'Elevaciones laterales'),
      ex('p2', 'Aperturas en polea'), ex('e2', 'Remo con barra'),
    ] }];
    S.draft = null;
  });

  it('la rutina se ve y se ordena por bloques (porBloques)', () => {
    const ctx = contextoRutina(0);
    expect(ctx.movibles.map(x => x.id)).toEqual(['p1', 'p2', 'e1', 'e2', 'h1']);
    expect(ctx.fijos).toEqual([]);
  });

  it('sugiere después del último de su grupo, y lo explica', () => {
    const s = posicionSugerida(contextoRutina(0), 'Espalda');
    expect(s.pos).toBe(4);
    expect(s.texto).toBe('Sugerido: con los otros de espalda, después de Remo con barra.');
    expect(posicionSugerida(contextoRutina(0), 'Hombro').texto)
      .toBe('Sugerido: con el otro de hombro, después de Elevaciones laterales.');
  });

  it('sin otro de su grupo, al final', () => {
    const s = posicionSugerida(contextoRutina(0), 'Bíceps');
    expect(s).toEqual({ pos: 5, texto: 'Sugerido: al final. Hoy no hay otro de bíceps.' });
  });

  it('turno vacío: es el primero', () => {
    S.routine[0].exercises = [];
    expect(posicionSugerida(contextoRutina(0), 'Pecho')).toEqual({ pos: 0, texto: 'Es el primero del turno.' });
  });

  it('rutina: con su grupo presente sólo vale dentro de su bloque', () => {
    expect(posicionesValidas(contextoRutina(0), 'Espalda')).toEqual([2, 3, 4]);
  });

  it('rutina: un grupo nuevo sólo entra entre bloques', () => {
    expect(posicionesValidas(contextoRutina(0), 'Bíceps')).toEqual([0, 2, 4, 5]);
  });

  it('▲▼ recorren las posiciones válidas y frenan en el borde', () => {
    const ctx = contextoRutina(0);
    let e = conNombre('rutina', 'Remo en polea');
    expect(posicionDe(e, ctx)).toBe(4);
    e = moverNuevo(e, ctx, -1); expect(posicionDe(e, ctx)).toBe(3);
    e = moverNuevo(e, ctx, -1); expect(posicionDe(e, ctx)).toBe(2);
    expect(moverNuevo(e, ctx, -1)).toBe(e);
    e = moverNuevo(moverNuevo(e, ctx, 1), ctx, 1);
    expect(moverNuevo(e, ctx, 1)).toBe(e);
  });

  it('soltar fuera de lo válido lo lleva al lugar válido más cercano', () => {
    const ctx = contextoRutina(0);
    const e = conNombre('rutina', 'Remo en polea');
    // lo soltaron arriba de todo, entre los de pecho
    expect(posicionDe(soltarEn(e, ctx, [NUEVO, 'p1', 'p2', 'e1', 'e2', 'h1']), ctx)).toBe(2);
    // entre los dos de espalda: vale
    expect(posicionDe(soltarEn(e, ctx, ['p2', 'e1', NUEVO, 'e2']), ctx)).toBe(3);
  });

  it('la lista del paso 2 trae al nuevo insertado, numerado e iluminable', () => {
    const l = listaPaso2(conNombre('rutina', 'Remo en polea'), contextoRutina(0));
    expect(l.filas.map(x => x.id)).toEqual(['p1', 'p2', 'e1', 'e2', NUEVO, 'h1']);
    expect(l.filas[l.idxNuevo]).toMatchObject({ id: NUEVO, name: 'Remo en polea', n: 5, nuevo: true, fijo: false });
    expect(l.enSugerida).toBe(true);
    expect(l.puedeSubir).toBe(true);
    expect(l.puedeBajar).toBe(false);
  });

  it('recorte: nuevo ±3 y "+N" plegado cuando no entra', () => {
    const filas = Array.from({ length: 14 }, (_, i) => ({ id: String(i) }));
    expect(recortar(filas, 6)).toMatchObject({ desde: 3, hasta: 10, arriba: 3, abajo: 4 });
    expect(recortar(filas, 0)).toMatchObject({ desde: 0, hasta: 7, arriba: 0, abajo: 7 });
    expect(recortar(filas, 13)).toMatchObject({ desde: 7, hasta: 14, arriba: 7, abajo: 0 });
    expect(recortar(filas.slice(0, 8), 7)).toMatchObject({ desde: 0, hasta: 8, arriba: 0, abajo: 0 });
  });
});

describe('paso 2 en la sesión', () => {
  beforeEach(() => {
    S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Tirón', exercises: [
      ex('a', 'Jalón al pecho'), ex('b', 'Curl con barra'), ex('c', 'Remo con barra'), ex('d', 'Face pull'), ex('e', 'Curl martillo'),
    ] }];
    S.draft = {
      id: 'd1', date: '2026-09-27', slotId: 's1', dayName: 'Tirón', open: 1, start: 1, cur: 'c',
      order: ['a', 'b', 'c', 'd', 'e'], skipped: ['b'], extraSets: {}, extras: [],
      entries: { a: { sets: [{}, {}, {}] }, c: { sets: [{}] } },
    };
    S.hoyVals = {};
  });

  it('hechos, empezados y salteados van arriba y fijos; los pendientes se mueven', () => {
    const ctx = contextoSesion(0);
    expect(ctx.fijos.map(x => [x.id, x.estado])).toEqual([['a', 'hecho'], ['b', 'salteado'], ['c', 'en-curso']]);
    expect(ctx.movibles.map(x => x.id)).toEqual(['d', 'e']);
    expect(posicionesValidas(ctx, 'Espalda')).toEqual([0, 1, 2]);
  });

  it('si su grupo sólo está en lo ya hecho, va primero entre los pendientes', () => {
    expect(posicionSugerida(contextoSesion(0), 'Espalda'))
      .toEqual({ pos: 0, texto: 'Sugerido: el próximo, para seguir con espalda.' });
  });

  it('la lista arranca con los fijos y numera todo', () => {
    const l = listaPaso2(conNombre('sesion', 'Remo en polea'), contextoSesion(0));
    expect(l.filas.map(x => x.id)).toEqual(['a', 'b', 'c', NUEVO, 'd', 'e']);
    expect(l.filas.filter(x => x.fijo).map(x => x.id)).toEqual(['a', 'b', 'c']);
    expect(l.idxNuevo).toBe(3);
  });

  it('sin pendientes: va después de lo ya hecho', () => {
    S.draft.entries = { a: { sets: [{}, {}, {}] }, c: { sets: [{}] }, d: { sets: [{}] }, e: { sets: [{}] } };
    expect(posicionSugerida(contextoSesion(0), 'Hombro')).toEqual({ pos: 0, texto: 'Va después de lo que ya hiciste.' });
  });
});
```

- [ ] **Paso 2: correr y ver que falle.** Esperado: FALLA con "contextoRutina is not a function".

- [ ] **Paso 3: implementar**

```js
import { porBloques } from './muscle.js';
import { S } from './state.js';
import { sessionExs, isSkipped, setsDone, targetSets } from './session.js';

export const NUEVO = '__nuevo';

const fila = (e, estado = 'pendiente') => ({ id: e.id, name: e.name, cat: e.cat, sets: e.sets, estado });
const grupoFila = x => catOf(x) || 'Otros';
const minus = cat => (cat ? cat.toLowerCase() : null);

export function contextoRutina(index) {
  const d = S.routine[index];
  return { tipo: 'rutina', nombreTurno: d?.name || '', fijos: [], movibles: porBloques(d?.exercises || []).map(e => fila(e)) };
}

function estadoEnSesion(e) {
  if (isSkipped(e.id)) return 'salteado';
  const hechas = setsDone(e.id).length;
  if (!hechas) return 'pendiente';
  return hechas >= targetSets(e) ? 'hecho' : 'en-curso';
}

export function contextoSesion(index) {
  const filas = sessionExs(index).map(e => fila(e, estadoEnSesion(e)));
  return {
    tipo: 'sesion',
    nombreTurno: S.routine[index]?.name || S.draft?.dayName || '',
    fijos: filas.filter(x => x.estado !== 'pendiente'),
    movibles: filas.filter(x => x.estado === 'pendiente'),
  };
}

export function posicionesValidas(ctx, cat) {
  const m = ctx.movibles, n = m.length;
  const todas = Array.from({ length: n + 1 }, (_, i) => i);
  if (ctx.tipo !== 'rutina') return todas;
  const g = cat || 'Otros';
  const suyos = m.map((x, i) => (grupoFila(x) === g ? i : -1)).filter(i => i >= 0);
  if (suyos.length) return todas.slice(suyos[0], suyos[suyos.length - 1] + 2);
  return todas.filter(i => i === 0 || i === n || grupoFila(m[i - 1]) !== grupoFila(m[i]));
}

export function posicionSugerida(ctx, cat) {
  const { movibles: m, fijos, tipo } = ctx;
  const g = minus(cat);
  const suyos = cat ? m.filter(x => catOf(x) === cat) : [];
  if (suyos.length) {
    const ultimo = suyos[suyos.length - 1];
    const con = suyos.length === 1 ? `el otro de ${g}` : `los otros de ${g}`;
    return { pos: m.indexOf(ultimo) + 1, texto: `Sugerido: con ${con}, después de ${ultimo.name}.` };
  }
  if (cat && tipo === 'sesion' && m.length && fijos.some(x => catOf(x) === cat)) {
    return { pos: 0, texto: `Sugerido: el próximo, para seguir con ${g}.` };
  }
  if (!m.length) {
    if (tipo !== 'sesion') return { pos: 0, texto: 'Es el primero del turno.' };
    return { pos: 0, texto: fijos.length ? 'Va después de lo que ya hiciste.' : 'Es el primero de la sesión.' };
  }
  return { pos: m.length, texto: g ? `Sugerido: al final. Hoy no hay otro de ${g}.` : 'Sugerido: al final.' };
}

const masCercana = (validas, pos) =>
  validas.reduce((mejor, v) => (Math.abs(v - pos) < Math.abs(mejor - pos) ? v : mejor), validas[0]);

export function posicionDe(estado, ctx) {
  const cat = grupoDe(estado.form);
  const pos = estado.posicion ?? posicionSugerida(ctx, cat).pos;
  return masCercana(posicionesValidas(ctx, cat), pos);
}

export function moverNuevo(estado, ctx, dir) {
  const validas = posicionesValidas(ctx, grupoDe(estado.form));
  const i = validas.indexOf(posicionDe(estado, ctx)) + dir;
  if (i < 0 || i >= validas.length) return estado;
  return { ...estado, posicion: validas[i] };
}

export function soltarEn(estado, ctx, idsCaja) {
  const i = idsCaja.indexOf(NUEVO);
  if (i < 0) return estado;
  const ids = ctx.movibles.map(x => x.id);
  const antes = i > 0 ? ids.indexOf(idsCaja[i - 1]) : -1;
  const despues = i < idsCaja.length - 1 ? ids.indexOf(idsCaja[i + 1]) : -1;
  const pos = antes >= 0 ? antes + 1 : despues >= 0 ? despues : null;
  if (pos == null) return estado;
  return { ...estado, posicion: masCercana(posicionesValidas(ctx, grupoDe(estado.form)), pos) };
}

export function recortar(filas, idx, radio = 3) {
  const max = 2 * radio + 1;
  if (filas.length <= max + 1) return { desde: 0, hasta: filas.length, arriba: 0, abajo: 0, visibles: filas };
  const desde = Math.max(0, Math.min(idx - radio, filas.length - max));
  const hasta = desde + max;
  return { desde, hasta, arriba: desde, abajo: filas.length - hasta, visibles: filas.slice(desde, hasta) };
}

export function listaPaso2(estado, ctx, { radio = 3 } = {}) {
  const cat = grupoDe(estado.form);
  const validas = posicionesValidas(ctx, cat);
  const sugerida = posicionSugerida(ctx, cat);
  const pos = posicionDe(estado, ctx);
  const movs = [...ctx.movibles];
  movs.splice(pos, 0, { id: NUEVO, name: estado.form.name.trim(), cat, estado: 'nuevo', nuevo: true });
  const filas = [
    ...ctx.fijos.map(x => ({ ...x, fijo: true })),
    ...movs.map(x => ({ ...x, fijo: false })),
  ].map((x, i) => ({ ...x, n: i + 1 }));
  const idxNuevo = ctx.fijos.length + pos;
  const k = validas.indexOf(pos);
  return {
    filas, idxNuevo, pos, sugerida,
    enSugerida: pos === masCercana(validas, sugerida.pos),
    puedeSubir: k > 0, puedeBajar: k < validas.length - 1,
    recorte: recortar(filas, idxNuevo, radio),
  };
}
```

- [ ] **Paso 4: correr y ver que pase.** Esperado: PASA.

- [ ] **Paso 5: commit**

```bash
git add web/src/lib/asistente-agregar.js web/src/lib/__tests__/asistente-agregar.test.js
git commit -m "feat(asistente): paso 2 — posición sugerida, válidas, ▲▼, soltar y recorte"
```

### Tarea 4: guardar en la posición elegida (rutina y sesión)

**Archivos:**
- Modificar: `web/src/lib/rutina-logic.js` (`saveExercise` ~:710 y `pinAddedToRoutine` ~:347)
- Modificar: `web/src/lib/session.js` (`addSessionExercise` ~:619 y `completeSession`, el `added` ~:837)
- Modificar: `web/src/lib/asistente-agregar.js`
- Test: `web/src/lib/__tests__/asistente-agregar.test.js`

**Interfaces:**
- `saveExercise(index, exId, datos, { mantenerSheet = false, posicion = null } = {})`
  ahora **devuelve** el ejercicio (el nuevo o el editado). Con `posicion` numérica inserta
  en ese índice del orden que se ve (`porBloques`) y guarda la lista en ese orden. Sin
  `posicion`, hace el push de siempre.
- `addSessionExercise(datos, donde = null)` acepta `datos.cat`. `donde` puede ser un id
  (string, "después de", compatible con `replaceSessionExercise`), `{ antesDe }`,
  `{ despuesDe }` o `null` (al final). El orden nuevo se arma sobre `sessionExs()`, que es el
  orden que se ve, y no sobre `S.draft.order` crudo: con un `order` vacío o parcial, el
  código viejo dejaba el agregado **primero**.
- `pinAddedToRoutine` y el `added` de `completeSession` conservan `cat`.
- Produce: `destinoSesion(ctx, pos)`, que devuelve `{ antesDe } | { despuesDe } | {}`,
  y `confirmarAgregar(estado, index)`, una Promise que resuelve al ejercicio o a `null`.

- [ ] **Paso 1: escribir los tests que fallan**

```js
describe('queda donde se lo dejó', () => {
  beforeEach(() => {
    S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Torso', exercises: [
      ex('p1', 'Press banca'), ex('e1', 'Jalón al pecho'), ex('h1', 'Elevaciones laterales'),
      ex('p2', 'Aperturas en polea'), ex('e2', 'Remo con barra'),
    ] }];
    S.draft = null;
    S.hoyVals = {};
  });

  it('rutina: en el lugar sugerido', async () => {
    const nuevo = await confirmarAgregar(avanzar(conNombre('rutina', 'Remo en polea')).estado, 0);
    const ids = porBloques(S.routine[0].exercises).map(e => e.id);
    expect(ids).toEqual(['p1', 'p2', 'e1', 'e2', nuevo.id, 'h1']);
    // lo guardado ES lo que se ve
    expect(S.routine[0].exercises.map(e => e.id)).toEqual(ids);
  });

  it('rutina: movido con ▲ entre los de su grupo', async () => {
    const ctx = contextoRutina(0);
    const e = moverNuevo(moverNuevo(conNombre('rutina', 'Remo en polea'), ctx, -1), ctx, -1);
    const nuevo = await confirmarAgregar(e, 0);
    expect(porBloques(S.routine[0].exercises).map(x => x.id)).toEqual(['p1', 'p2', nuevo.id, 'e1', 'e2', 'h1']);
  });

  it('rutina: un grupo nuevo soltado entre dos bloques queda ahí', async () => {
    const ctx = contextoRutina(0);
    const e = soltarEn(conNombre('rutina', 'Curl con barra'), ctx, ['p1', 'p2', NUEVO, 'e1', 'e2', 'h1']);
    const nuevo = await confirmarAgregar(e, 0);
    expect(porBloques(S.routine[0].exercises).map(x => x.id)).toEqual(['p1', 'p2', nuevo.id, 'e1', 'e2', 'h1']);
  });

  it('rutina: el grupo elegido a mano se guarda como cat', async () => {
    const nuevo = await confirmarAgregar(conNombre('rutina', 'Movimiento raro', 'Hombro'), 0);
    expect(nuevo.cat).toBe('Hombro');
    expect(porBloques(S.routine[0].exercises).map(x => x.id)).toEqual(['p1', 'p2', 'e1', 'e2', 'h1', nuevo.id]);
  });

  it('saveExercise sin posición sigue empujando al final (compatibilidad)', async () => {
    const { saveExercise } = await import('../rutina-logic.js');
    const nuevo = await saveExercise(0, null, { name: 'Fondos', sets: 3, reps: 10 });
    expect(S.routine[0].exercises.at(-1).id).toBe(nuevo.id);
  });
});

describe('queda donde se lo dejó (sesión)', () => {
  beforeEach(() => {
    S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Tirón', exercises: [
      ex('a', 'Jalón al pecho'), ex('b', 'Curl con barra'), ex('c', 'Remo con barra'), ex('d', 'Face pull'),
    ] }];
    S.draft = {
      id: 'd1', date: '2026-09-27', slotId: 's1', dayName: 'Tirón', open: 1, start: 1, cur: 'b',
      order: ['a', 'b', 'c', 'd'], skipped: [], extraSets: {}, extras: [],
      entries: { a: { sets: [{}, {}, {}] } },
    };
    S.hoyVals = {};
  });

  it('en el lugar sugerido (después del último pendiente de su grupo)', async () => {
    const nuevo = await confirmarAgregar(conNombre('sesion', 'Remo en polea'), 0);
    expect(sessionExs(0).map(e => e.id)).toEqual(['a', 'b', 'c', nuevo.id, 'd']);
    expect(S.draft.order).toEqual(['a', 'b', 'c', nuevo.id, 'd']);
    expect(S.routine[0].exercises.map(e => e.id)).toEqual(['a', 'b', 'c', 'd']); // la rutina no se toca
  });

  it('movido al primer lugar de los pendientes: antes del primero pendiente', async () => {
    const ctx = contextoSesion(0);
    let e = conNombre('sesion', 'Remo en polea');
    e = moverNuevo(moverNuevo(e, ctx, -1), ctx, -1);
    const nuevo = await confirmarAgregar(e, 0);
    expect(sessionExs(0).map(x => x.id)).toEqual(['a', nuevo.id, 'b', 'c', 'd']);
  });

  it('al final', async () => {
    const e = soltarEn(conNombre('sesion', 'Curl martillo'), contextoSesion(0), ['b', 'c', 'd', NUEVO]);
    const nuevo = await confirmarAgregar(e, 0);
    expect(sessionExs(0).map(x => x.id)).toEqual(['a', 'b', 'c', 'd', nuevo.id]);
  });

  it('nunca antes de lo ya hecho aunque el orden guardado esté vacío', async () => {
    S.draft.order = [];
    const ctx = contextoSesion(0);
    const e = moverNuevo(moverNuevo(moverNuevo(conNombre('sesion', 'Remo en polea'), ctx, -1), ctx, -1), ctx, -1);
    const nuevo = await confirmarAgregar(e, 0);
    expect(sessionExs(0).map(x => x.id)).toEqual(['a', nuevo.id, 'b', 'c', 'd']);
  });

  it('destinoSesion traduce la posición a un ancla', () => {
    const ctx = contextoSesion(0);
    expect(destinoSesion(ctx, 0)).toEqual({ antesDe: 'b' });
    expect(destinoSesion(ctx, 3)).toEqual({ despuesDe: 'd' });
    expect(destinoSesion({ ...ctx, movibles: [] }, 0)).toEqual({});
  });

  it('el grupo elegido a mano viaja a la sesión y al fijar en la rutina', async () => {
    const nuevo = await confirmarAgregar(conNombre('sesion', 'Movimiento raro', 'Hombro'), 0);
    expect(nuevo.cat).toBe('Hombro');
    const { pinAddedToRoutine } = await import('../rutina-logic.js');
    await pinAddedToRoutine('s1', [{ name: 'Movimiento raro', sets: 3, reps: 10, cat: 'Hombro' }]);
    expect(S.routine[0].exercises.at(-1).cat).toBe('Hombro');
  });
});
```

- [ ] **Paso 2: correr y ver que falle.** Esperado: FALLA con "confirmarAgregar is not a function".

- [ ] **Paso 3: implementar**

En `rutina-logic.js`, `saveExercise`:

```js
export async function saveExercise(index, exId, { name, sets, reps, equip, machine, photo, illus, cat, unilateral, pesoInicialKg }, { mantenerSheet = false, posicion = null } = {}) {
  // … igual hasta el else …
  let hecho = null;
  if (exId) {
    const ex = d.exercises.find(e => e.id === exId);
    if (ex) { /* … igual … */ hecho = ex; }
  } else {
    const nuevo = { id: uid(), name, sets: s, reps: r, /* … los mismos campos … */ };
    if (posicion == null) d.exercises.push(nuevo);
    else {
      const lista = porBloques(d.exercises);
      lista.splice(Math.max(0, Math.min(posicion, lista.length)), 0, nuevo);
      d.exercises = lista;
    }
    hecho = nuevo;
  }
  await persistSlot(index);
  if (!mantenerSheet) closeSheet();
  bump(); toast('Guardado');
  return hecho;
}
```

En `pinAddedToRoutine`, el `.map(a => ({ … }))` suma `cat: a.cat || undefined`.

En `session.js`:

```js
export async function addSessionExercise({ name, sets, reps, equip, machine, unilateral, cat } = {}, donde = null) {
  if (!S.draft) return null;
  const ex = {
    id: uid(), name: String(name || '').trim(),
    sets: Math.max(1, parseInt(sets, 10) || 3), reps: Math.max(1, parseInt(reps, 10) || 10),
    equip: equip || undefined, machine: equip && machine ? machine : undefined,
    unilateral: unilateral || undefined, cat: cat || undefined,
  };
  if (!ex.name) return null;
  const { antesDe = null, despuesDe = null } = typeof donde === 'string' ? { despuesDe: donde } : (donde || {});
  const ids = sessionExs(S.routine.findIndex(s => s.id === S.draft.slotId)).map(e => e.id);
  let at = antesDe ? ids.indexOf(antesDe) : -1;
  if (at < 0 && despuesDe) { const j = ids.indexOf(despuesDe); if (j >= 0) at = j + 1; }
  ids.splice(at >= 0 ? at : ids.length, 0, ex.id);
  if (!S.draft.extras) S.draft.extras = [];
  S.draft.extras.push(ex);
  S.draft.order = ids;
  await saveDraft();
  vibrate(15);
  bump();
  return ex;
}
```

En `completeSession`, el `.map` de `added` suma `cat: e.cat`.

En `asistente-agregar.js`:

```js
import { saveExercise } from './rutina-logic.js';
import { addSessionExercise } from './session.js';

export function destinoSesion(ctx, pos) {
  const m = ctx.movibles;
  if (pos < m.length) return { antesDe: m[pos].id };
  if (m.length) return { despuesDe: m[m.length - 1].id };
  return {};
}

export async function confirmarAgregar(estado, index) {
  const sesion = estado.tipo === 'sesion';
  const ctx = sesion ? contextoSesion(index) : contextoRutina(index);
  const pos = posicionDe(estado, ctx);
  const datos = datosParaGuardar(estado.form);
  if (sesion) return addSessionExercise(datos, destinoSesion(ctx, pos));
  return (await saveExercise(index, null, datos, { mantenerSheet: true, posicion: pos })) || null;
}
```

- [ ] **Paso 4: correr la suite entera**

Correr: `cd web && npm test`
Esperado: todo verde, con los 764 anteriores más los nuevos. Revisar en especial
`session.test.js`, `despues.test.js` y los tests de `replaceSessionExercise`: el orden nuevo
sale de `sessionExs`.

- [ ] **Paso 5: commit**

```bash
git add web/src/lib web/src/lib/__tests__/asistente-agregar.test.js
git commit -m "feat(asistente): guardar en la posición elegida en rutina y sesión"
```

---

## FASE 2 (después del color): UI, CSS, animaciones y verificación

> **No empezar hasta que `feat/color-grafito` esté en `main`.** Primero,
> `git fetch && git rebase origin/main`. Después abrir `:root` en `styles.css` y anotar los
> nombres finales de los tokens: `--accent`, `--accent-strong`, `--accent-rgb`,
> `--on-accent`, `--glass`, `--surface`, `--surface-2`, `--text`, `--text-2`, `--text-3` y
> `--line`, según la spec §4. Si alguno quedó con otro nombre, usar el real en la Tarea 9.

### Tarea 5 (FASE 2): íconos SVG de equipo

**Archivos:**
- Crear: `web/src/components/EquipIcon.jsx`
- Test: `web/src/lib/__tests__/a11y-markup.test.js` (suma un caso)

**Interfaces:**
- `EQUIP_ASIST`: los 7 `EQUIP` de siempre (`barra`, `mancuernas`, `discos`, `placas`,
  `polea`, `smith`, `corporal`) más `{ id: '', label: 'Otro' }`, 8 en total.
  Ver la Duda 3 sobre el set de la maqueta.
- `<EquipIcon id size=22 />` devuelve un `<svg aria-hidden="true">` de 24×24, trazo
  `currentColor` de 1.75, sin relleno de color, con el mismo lenguaje que `Icon.jsx`.

- [ ] **Paso 1.** Test: renderizar los 8 con `renderToStaticMarkup` y comprobar que cada
  uno es un `<svg` con `aria-hidden="true"` y sin `fill="#` (nada de hex).
- [ ] **Paso 2.** Correr el test y ver que falle.
- [ ] **Paso 3.** Implementar el componente como un `switch (id)` que devuelve un `<path>`
  por equipo: barra (barra con dos discos), mancuernas, discos (disco con agujero), placas
  (stack con pasador), polea (roldana y cable), smith (barra con guías), corporal (figura) y
  otro (tres puntos). Todo con `stroke="currentColor"` y `fill="none"`.
- [ ] **Paso 4.** Correr el test y ver que pase.
- [ ] **Paso 5.** Commit `feat(asistente): íconos SVG de equipo (adiós emoji, G7)`.

### Tarea 6 (FASE 2): componente `AgregarEjercicio`

**Archivos:**
- Crear: `web/src/components/sheets/AgregarEjercicio.jsx`
- Modificar: `web/src/App.jsx` (caso `'agregar-ej'` y set `PANTALLA` → `variante="pantalla"`)
- Modificar: `web/src/components/Sheet.jsx` (acepta `variante="pantalla"`, sin handle)

**Interfaces:**
- Props: `{ wd: number, tipo: 'rutina'|'sesion' }`.
- Consume toda la API de las Tareas 1 a 4. El estado local es `useState(() => estadoInicial(tipo))`
  más `dir` ('r'|'l') para el sentido del deslizamiento. Los contextos se calculan con
  `useMemo(() => tipo === 'sesion' ? contextoSesion(wd) : contextoRutina(wd), [wd, tipo, store.version])`.

Estructura (markup; las clases se escriben en la Tarea 9):

```jsx
<div className="asist" data-paso={e.paso}>
  <header className="asist-top">
    <button type="button" className="asist-x" aria-label={e.paso === 1 ? 'Cerrar' : 'Volver al paso anterior'}
      onClick={e.paso === 1 ? closeSheet : () => { setDir('l'); setE(volver(e)); }}>
      {e.paso === 1 ? <X /> : <ChevronLeft />}
    </button>
    <div className="asist-prog" role="progressbar" aria-valuemin={1} aria-valuemax={PASOS} aria-valuenow={e.paso}
      aria-label={`Paso ${e.paso} de ${PASOS}`}>
      {Array.from({ length: PASOS }, (_, i) => <i key={i} className={i < e.paso ? 'on' : ''} />)}
    </div>
  </header>
  <div className="asist-eyebrow">Paso {e.paso} de {PASOS}</div>
  <h2 className="plan-title asist-h">{['¿Qué ejercicio?', '¿Dónde va?', '¿Cómo lo hacés?'][e.paso - 1]}</h2>
  <div key={e.paso} className={`asist-step dir-${dir}`}>{/* Paso1 | Paso2 | Paso3 */}</div>
  <footer className="asist-pie">
    {tipo === 'sesion' && e.paso === 3 && <div className="asist-nota">Vale sólo para hoy</div>}
    <button type="button" className="btn asist-cta" onClick={e.paso < 3 ? siguiente : agregar}>
      {e.paso < 3 ? 'Siguiente' : textoCTA(tipo)}
    </button>
  </footer>
</div>
```

- `siguiente()`: si `avanzar(e)` trae un `error`, se muestra en un `<p role="alert">` inline
  arriba del CTA (no un toast: el foco no se pierde). Si no, `setDir('r')` y se avanza.
- `agregar()`: `const nuevo = await confirmarAgregar(e, wd)`. Si viene, `closeSheet()`,
  `vibrate(15)` y `toast('＋ ' + nuevo.name)`. En la rutina, el `toast('Guardado')` de
  `saveExercise` ya alcanza.
- **Paso 1.**
  - Un `input` con `aria-label="Nombre del ejercicio"`, `autoComplete="off"` y foco al montar.
  - Chips de `autocompletar(name)` mientras se escribe. Tocar uno llama a `setNombre` y **no**
    cambia de vista (fricción A.4).
  - Una fila "Te falta hoy · {cat}" con `teFaltaHoy(ctx)`.
  - "Explorar" con los chips de `MUSCLE_CATS`. Tocar uno reemplaza la fila de sugerencias
    por `catalogoDe(cat, nombres).slice(0, 6)`.
  - Si `necesitaGrupo(form)`, la fila "¿Qué grupo entrena?" con los 10 chips, que llaman a
    `setGrupo`, con `aria-pressed`.
- **Paso 2.**
  - La línea `.asist-sug`: `✦ {sugerida.texto}` y, abajo, "Arrastralo o usá ▲▼ si lo
    querés en otro lado". Si `!enSugerida`, un link "Volver al sugerido" que hace
    `setE({ ...e, posicion: null })`.
  - Las filas de `recorte.visibles`. Los fijos van fuera de la caja arrastrable, apagados,
    con ✓ si están hechos, "en curso" o "salteado". Los movibles y el nuevo van dentro de
    `<div data-sort="asist">`, con `data-sid={fila.id}` y `data-fijo` en todos menos el nuevo.
  - La fila nueva lleva dos botones ▲▼ (`aria-label="Subir"` / `"Bajar"`, `disabled` según
    `puedeSubir` y `puedeBajar`) que llaman a `flipSort(() => setE(moverNuevo(e, ctx, ∓1)))`.
  - "+N antes" y "+N más" son filas `aria-hidden="false"` de sólo texto, no botones.
- **Paso 3.**
  - Dos steppers (`ajustar`, botones de 44 px con `aria-label="Menos series"` y similares).
    El valor va en la condensada con `tabular-nums`. Las reps muestran `rangoReps(reps).texto`.
  - Una grilla de 8 `EquipIcon` (`role="radiogroup"`; cada botón con `role="radio"` y
    `aria-checked`).
  - Un switch "Unilateral" (`role="switch"`, `aria-checked`) con la línea "Un lado por vez
    · izq / der".
  - Al pie, una línea chica: "Peso de partida, máquina y foto → después, desde editar".

- [ ] **Paso 1.** Test de markup en `a11y-markup.test.js`, con el mismo patrón que los casos
  que ya existen ahí. Montar `AgregarEjercicio` en paso 1, 2 y 3 con `S` sembrado, y
  comprobar que:
  - hay un único `h2`;
  - cada `button` tiene texto o `aria-label`;
  - el `progressbar` tiene `aria-valuenow`;
  - en el paso 2, la fila con `data-sid="__nuevo"` está dentro de `[data-sort="asist"]` y
    ningún fijo lo está.
- [ ] **Paso 2.** Correr el test y ver que falle. **Paso 3.** Implementar. **Paso 4.** Correr y
  ver que pase.
- [ ] **Paso 5.** Commit `feat(asistente): componente AgregarEjercicio (3 pasos)`.

### Tarea 7 (FASE 2): arrastre de la fila nueva con `lib/drag.js`

**Archivos:**
- Modificar: `web/src/lib/drag.js` (`dragPick` y `commitSort`)
- Modificar: `web/src/components/sheets/AgregarEjercicio.jsx`
- Test: `web/src/lib/__tests__/asistente-agregar.test.js` (casos de `commitSort('asist')`)

**Interfaces:**
- `setAsistDrop(fn | null)`, exportada por `drag.js`, registra el callback de la hoja abierta.
- En `dragPick`, si `card.dataset.fijo != null` se devuelve `null`: sólo se agarra la fila
  nueva. Las demás siguen en la caja para que el FLIP abra el hueco.
- En `commitSort`, si `kind === 'asist'`, se llama a `ASIST_DROP?.(ids)` y se vuelve. No
  hay `pushHistory` ni persistencia; el componente hace `setE(e => soltarEn(e, ctx, ids))`.
- `dragEnd` ya mueve los nodos y hace `bump()`. React vuelve a pintar desde el estado, y
  si `soltarEn` ajustó a una posición válida, la fila salta a ese lugar con `flipSort`.

- [ ] **Paso 1.** Test: con `setAsistDrop(spy)`, `await commitSort('asist', '0', ['x', NUEVO])`
  llama al spy con `['x', NUEVO]` y no toca `S.routine`.
- [ ] **Paso 2.** Correr y ver que falle. **Paso 3.** Implementar, y registrar/desregistrar
  en un `useEffect` del componente. **Paso 4.** Correr y ver que pase.
- [ ] **Paso 5.** Commit `feat(asistente): arrastrar la fila nueva (drag.js kind asist)`.

### Tarea 8 (FASE 2): enchufar las entradas y retirar los flujos viejos

**Archivos:**
- `web/src/components/screens/Rutina.jsx:715` y `Hoy.jsx:499`:
  `openSheet('agregar-ej', { wd: index, tipo: 'rutina' })`
- `web/src/components/screens/Hoy.jsx:261` (SesionMenu):
  `openSheet('agregar-ej', { wd, tipo: 'sesion' })`
- `ExerciseForm.jsx`: borrar `CreateWizard`, `WizardProgress` y sus imports. `ExerciseForm`
  queda como `return <EditForm wd={wd} ex={ex} />`, con guardia `if (!ex) return null`.
- `SessionExercise.jsx`: queda **sólo** "Cambiar ejercicio" (con `exId`). Se borran el
  "Dónde va" y el subtítulo "Se suma al final" (ver Duda 1).
- `exercise-wizard.js` y su test: queda sólo `resolvedCat`, junto con el comentario que
  explica por qué el elegido a mano gana. Se borran `TOTAL_PASOS`, `emptyForm`,
  `nextStep` y compañía, y sus tests.
- `styles.css`: borrar `.exwiz-*` si ya nadie lo usa (`grep -rn exwiz web/src`).

- [ ] **Paso 1.** Hacer los cambios.
- [ ] **Paso 2.** `grep -rn "CreateWizard\|exwiz\|TOTAL_PASOS" web/src` tiene que dar vacío,
  salvo algún comentario histórico.
- [ ] **Paso 3.** `npm test` y `npm run lint` (el error de `WarmupCard.jsx` ya estaba).
- [ ] **Paso 4.** Commit `refactor(asistente): un solo flujo para agregar — adiós CreateWizard y el modo agregar de SessionExercise`.

### Tarea 9 (FASE 2): CSS y animaciones

**Archivos:**
- Modificar: `web/src/styles.css` (un bloque `/* ===== Asistente agregar ejercicio ===== */`
  cerca del viejo `.exwiz-*`)

Reglas: sólo tokens del sistema grafito. Cero hex y cero `rgba(` con números sueltos, salvo
`rgba(var(--accent-rgb), a)`. Sólo `--d1..--d4`, `--ease-push` y `--ease-out`. El test de
"color literal fuera del bloque de tokens" de la pieza 4 tiene que seguir verde.

```css
/* ===== Asistente agregar ejercicio ===== */
#sheet.pantalla .panel{inset:0;max-height:none;height:100dvh;border-radius:0;padding:
  calc(env(safe-area-inset-top) + var(--s3)) var(--s4) calc(env(safe-area-inset-bottom) + var(--s3))}
#sheet.pantalla .handle{display:none}
#sheet.pantalla.closing .panel{animation-duration:var(--d2)} /* sale más corta que entra */
.asist{display:flex;flex-direction:column;height:100%;min-height:0}
.asist-top{display:flex;align-items:center;gap:var(--s2);margin-bottom:var(--s3)}
.asist-x{width:40px;height:40px;border-radius:50%;background:var(--surface-2);display:grid;place-items:center;color:var(--text-2)}
.asist-prog{flex:1;display:flex;gap:4px}
.asist-prog i{flex:1;height:4px;border-radius:4px;background:var(--line);overflow:hidden;position:relative}
.asist-prog i::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--accent-strong),var(--accent));
  transform:scaleX(0);transform-origin:left;transition:transform var(--d2) var(--ease-out)}
.asist-prog i.on::after{transform:scaleX(1)}
.asist-eyebrow{font-size:var(--t-micro);letter-spacing:.14em;text-transform:uppercase;color:var(--text-3)}
.asist-h{margin:4px 0 var(--s3)}
.asist-step{flex:1;min-height:0;display:flex;flex-direction:column;animation:asistInR var(--d3) var(--ease-push) both}
.asist-step.dir-l{animation-name:asistInL}
@keyframes asistInR{from{transform:translateX(32px);opacity:0}}
@keyframes asistInL{from{transform:translateX(-32px);opacity:0}}
.asist-sug{font-size:var(--t-sm);color:var(--text);background:rgba(var(--accent-rgb),.08);
  border:1px dashed rgba(var(--accent-rgb),.45);border-radius:var(--r-s);padding:6px 10px;margin-bottom:var(--s2)}
.asist-fila{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border-radius:var(--r-s);
  background:var(--glass);border:1px solid var(--line);margin-bottom:6px;font-size:var(--t-sm)}
.asist-fila .n{width:20px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-weight:700;color:var(--text-3);font-variant-numeric:tabular-nums}
.asist-fila.fijo{opacity:.4}
.asist-fila.nuevo{border-color:var(--accent);box-shadow:0 0 0 3px rgba(var(--accent-rgb),.14);transform:scale(1.02);
  background:linear-gradient(90deg,rgba(var(--accent-rgb),.22),rgba(var(--accent-rgb),.08))}
.asist-mas{font-size:var(--t-sm);color:var(--text-3);padding:6px 12px}
.asist-steppers{display:grid;grid-template-columns:1fr 1fr;gap:var(--s2)}
.asist-eq{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.asist-eq button{min-height:56px;border-radius:var(--r-s);background:var(--glass);border:1px solid var(--line);color:var(--text-3);font-size:var(--t-micro)}
.asist-eq button[aria-checked="true"]{border-color:var(--accent);color:var(--text);background:rgba(var(--accent-rgb),.1)}
.asist-pie{padding-top:var(--s3)}
.asist-cta{width:100%}
.asist-x:active,.asist-eq button:active,.asist-cta:active{transform:scale(.96)}
@media (prefers-reduced-motion: reduce){
  .asist-step{animation:none}
  .asist-prog i::after{transition:none}
}
```

Los radios (`--r-s`), los tamaños de texto (`--t-sm`, `--t-micro`) y los espacios (`--s*`)
hay que confirmarlos en `:root` al arrancar. Si alguno no existe, usar el que ya usa
`.chip` o `.card`; nunca un número nuevo. El CTA reusa `.btn` (la píldora con degradado)
y no se estiliza aparte.

- [ ] **Paso 1.** Escribir el bloque.
- [ ] **Paso 2.** Comprobar que cada clase `asist-*` del JSX exista en `styles.css`:
  `grep -o 'asist-[a-z-]*' web/src/components/sheets/AgregarEjercicio.jsx | sort -u`
  contra el CSS.
- [ ] **Paso 3.** `npm test` (incluye `tokens.test.js` y el de literales de color).
- [ ] **Paso 4.** Commit `style(asistente): CSS y animaciones con tokens grafito`.

### Tarea 10 (FASE 2): verificación en Chrome, publicación y PR

- [ ] **Paso 1.** `cd web && npx vite build && npx vite preview --port 4190`. Service worker
  desregistrado y caches borrados. Datos con "Cargar mi registro" de Ajustes. Para tener
  una sesión abierta sin la de hoy sembrada, ver el aviso de método del relevamiento: el
  reloj adelantado un día con `initScript`.
- [ ] **Paso 2.** Para **cada** combinación de {390×844, 430×932} × {rutina, sesión} × {paso
  1, 2, 3}, medir con `evaluate_script`:
  `document.querySelector('#sheet .panel').scrollHeight <= clientHeight`, y que ningún
  `.asist *` tenga `getBoundingClientRect().right > innerWidth`. Tomar captura de cada
  una: son 12.
- [ ] **Paso 3.** En el paso 2, con un turno de 11 o más ejercicios, confirmar que se ve
  el recorte "+N más" y que sigue sin scroll. Si a 430 entran más filas, subir `radio` según
  la altura (`innerHeight >= 900 ? 4 : 3`) y volver a medir.
- [ ] **Paso 4.** Arrastre: con `drag` de chrome-devtools (o `mousedown` + 300 ms +
  `mousemove`), llevar la fila nueva dos lugares arriba. Tiene que quedar ahí. En la rutina,
  soltarla fuera de su bloque la tiene que devolver al borde válido. Probar ▲▼ con el
  teclado (Tab + Enter). Confirmar el foco visible y `aria-label` en cada control con
  `take_snapshot`.
- [ ] **Paso 5.** Confirmar que el ejercicio agregado quedó en el lugar elegido: en el
  editor de rutina y en el carrusel de la sesión.
- [ ] **Paso 6.** `getAnimations()` en el paso 2: sólo corren las transiciones esperadas y
  no hay ningún `filter` en loop.
- [ ] **Paso 7.** Publicar según CLAUDE.md: rebasar sobre `origin/main`, correr
  `npm run build`, commitear la raíz (`assets/ index.html manifest.webmanifest sw.js
  workbox-*.js`) y hacer push. Después abrir el PR con las capturas y las mediciones.

---

## Dudas de diseño abiertas (para Enzo)

1. **"Cambiar ejercicio" (`ExOpciones` → `ex-swap` con `exId`)** vive hoy en el mismo
   `SessionExercise.jsx`. La spec dice que el asistente "reemplaza a SessionExercise", pero
   no habla de "Cambiar". El plan deja `SessionExercise` sólo para cambiar. ¿Querés que
   "Cambiar" también pase a ser un asistente, por ejemplo con los pasos 1 y 3 y sin el 2?
2. **Series y reps por defecto.** Hoy la rutina usa 4×10 y la sesión 3×10. El plan unifica
   en 3×10, lo mismo que muestra la maqueta. El rango de reps que se muestra es el de la doble
   progresión (`reps`–`reps+3`, por ejemplo 10–13), no el "8–10" de la maqueta, porque es el
   rango que la app de verdad usa para progresar.
3. **Los 8 equipos.** La maqueta dibuja Barra, Mancuernas, Polea, Máquina, Peso corporal,
   Banda, Kettlebell y Otro. Pero `EQUIP` (`equip.js`) tiene 7 ids que forman parte de la
   clave del historial (`exKey`): barra, mancuernas, discos, placas, polea, smith y corporal.
   Sumar "Banda" o "Kettlebell" sería un equipo nuevo, sin hint ni reglas de carga. El plan
   usa los 7 reales más "Otro" (sin equipo).
4. **Rutina y bloques.** En el editor el orden visible es `porBloques`, así que un ejercicio
   de Espalda no puede quedar entre dos de Pecho: `blocksOf` lo volvería a juntar. El paso 2
   de la rutina limita el arrastre a las posiciones donde el ejercicio se queda, que son
   dentro de su bloque o entre bloques si es un grupo nuevo. En la sesión el orden es libre.
5. **"Te falta hoy"** se calcula como el grupo con **menos series planificadas en ese turno**,
   contando como 0 los grupos que el nombre del turno promete y no tiene. No usa el volumen
   semanal. Si se prefiere "el grupo que más días lleva sin entrenar" (`daysSinceGroup`),
   el cambio es de una función.
6. **Plan de hoy con orden en memoria (`S.hoyOrder`).** Queda fuera de alcance según la spec.
   Si Enzo reordenó Plan de hoy antes de empezar, el paso 2 muestra el orden de la rutina
   (`porBloques`), que puede diferir de lo que ve en Plan de hoy hasta recargar.
7. **Sin paso "Agregado · agregar otro".** El asistente viejo lo tenía; la spec no lo nombra.
   El plan cierra la hoja al agregar. Si se quiere encadenar, se puede sumar un "＋ Otro" en
   el toast.
