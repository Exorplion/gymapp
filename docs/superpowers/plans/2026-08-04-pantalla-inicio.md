# Pantalla de inicio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar "Hoy" como portada por una pantalla compuesta, sin scroll, cuyo héroe son dos siluetas anatómicas coloreadas según hace cuántos días entrenaste cada grupo muscular.

**Architecture:** Una pantalla nueva (`Inicio.jsx`) y un componente de dibujo (`Silhouette.jsx`) que recibe un mapa `{grupo: días}` y colorea las zonas. El cálculo vive en `lib/muscle.js`, junto a `catOf`, porque es la misma familia de lógica. La navegación cambia: `Inicio` toma el lugar de `Hoy` en la barra y `Hoy` pasa a ser un destino al que se entra desde el botón principal.

**Tech Stack:** React 19, SVG inline, IndexedDB vía el store `S`, vitest para `lib/`.

## Global Constraints

- **Directorio:** todos los comandos desde `web/`.
- **Rama:** `feat/pantalla-inicio`. No commitear a `main`.
- **Verificación de cada tarea:** `npm run test` (0 fallos) + `npm run lint` (0 errores; **10 warnings preexistentes** son el baseline) + `npm run build:only`.
- **Contar warnings con** `npm run lint 2>&1 | grep -cE "warning|error"`, no con `tail`.
- **No usar `npm run build`** durante el desarrollo: copia el build a la raíz del repo. Sólo al publicar.
- **`npm install` requiere `--legacy-peer-deps`** (conflicto preexistente vite-plugin-pwa / vite 8).
- **Idioma:** UI y comentarios en español.
- **El color de la silueta es un hecho, no un modelo.** Nunca llamarlo "recuperación" ni derivar de él ninguna afirmación fisiológica.
- **"Nunca entrenado" ≠ "hace 7+ días".** Un grupo sin historial se pinta neutro y callado.
- **El trapecio pinta con Espalda.** Los antebrazos van neutros siempre.
- **Sin línea de récord.** Se descartó: competía con la línea ámbar.
- **`prefers-reduced-motion: reduce`** apaga toda animación nueva.

## File Structure

**Nuevos:**
- `src/components/Silhouette.jsx` — las dos siluetas. Recibe datos, no los calcula.
- `src/components/screens/Inicio.jsx` — la pantalla y sus cuatro estados.

**Modificados:**
- `src/lib/muscle.js` — `daysSinceGroup`, `stalestGroups`
- `src/components/TabBar.jsx` — Inicio en lugar de Hoy
- `src/App.jsx` — el caso `inicio`, y marcar Inicio activa mientras estás en Hoy
- `src/lib/state.js` — `S.tab` arranca en `'inicio'`
- `src/components/screens/Hoy.jsx` — botón de volver
- `src/styles.css` — silueta y composición
- `src/lib/__tests__/muscle.test.js` — los tests nuevos

---

## Task 1: Cuántos días hace que entrenaste cada grupo

**Files:**
- Modify: `src/lib/muscle.js`
- Test: `src/lib/__tests__/muscle.test.js`

**Interfaces:**
- Consumes: `S.sessions`, `catOf(ex)` (ya existen en el módulo).
- Produces:
  - `daysSinceGroup(cat) -> number | null` — días enteros desde la última sesión con series de ese grupo. `null` si nunca lo entrenaste.
  - `daysSinceAll() -> { [cat]: number | null }` — el mapa de los nueve grupos, para pasárselo a la silueta.
  - `stalestGroups(min = 7) -> string[]` — grupos con historial y `>= min` días, ordenados del más viejo al más nuevo.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/__tests__/muscle.test.js`:

```js
describe('daysSinceGroup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10));   // 2026-08-10
    S.sessions = [];
  });
  afterEach(() => { vi.useRealTimers(); });

  it('cuenta los días desde la última sesión con ese grupo', () => {
    S.sessions = [
      { id: 'a', date: '2026-08-08', start: 200, entries: [{ name: 'Jalón ancho', sets: [{ w: 80, r: 7 }] }] },
    ];
    expect(daysSinceGroup('Espalda')).toBe(2);
  });

  it('un grupo entrenado hoy da 0', () => {
    S.sessions = [
      { id: 'a', date: '2026-08-10', start: 200, entries: [{ name: 'Jalón ancho', sets: [{ w: 80, r: 7 }] }] },
    ];
    expect(daysSinceGroup('Espalda')).toBe(0);
  });

  it('un grupo que nunca entrenaste da null, no un número grande', () => {
    S.sessions = [
      { id: 'a', date: '2026-08-08', start: 200, entries: [{ name: 'Jalón ancho', sets: [{ w: 80, r: 7 }] }] },
    ];
    expect(daysSinceGroup('Gemelos')).toBe(null);
  });

  it('toma la sesión MÁS RECIENTE de ese grupo, no la primera que encuentra', () => {
    S.sessions = [
      { id: 'nueva', date: '2026-08-09', start: 300, entries: [{ name: 'Jalón ancho', sets: [{ w: 80, r: 7 }] }] },
      { id: 'vieja', date: '2026-07-01', start: 100, entries: [{ name: 'Jalón ancho', sets: [{ w: 70, r: 7 }] }] },
    ];
    expect(daysSinceGroup('Espalda')).toBe(1);
  });

  it('una entrada sin series no cuenta como haber entrenado el grupo', () => {
    S.sessions = [
      { id: 'a', date: '2026-08-09', start: 200, entries: [{ name: 'Jalón ancho', sets: [] }] },
    ];
    expect(daysSinceGroup('Espalda')).toBe(null);
  });
});

describe('daysSinceAll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10));
    S.sessions = [
      { id: 'a', date: '2026-08-09', start: 200, entries: [
        { name: 'Jalón ancho', sets: [{ w: 80, r: 7 }] },
        { name: 'Curl martillo', sets: [{ w: 16, r: 8 }] },
      ] },
    ];
  });
  afterEach(() => { vi.useRealTimers(); });

  it('devuelve los nueve grupos, con null en los que no tienen historial', () => {
    const m = daysSinceAll();
    expect(Object.keys(m).sort()).toEqual([...MUSCLE_CATS].sort());
    expect(m.Espalda).toBe(1);
    expect(m['Bíceps']).toBe(1);
    expect(m.Pecho).toBe(null);
  });
});

describe('stalestGroups', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('lista los que llevan 7 días o más, del más viejo al más nuevo', () => {
    S.sessions = [
      { id: 'a', date: '2026-08-09', start: 400, entries: [{ name: 'Curl martillo', sets: [{ w: 16, r: 8 }] }] },
      { id: 'b', date: '2026-08-01', start: 300, entries: [{ name: 'Jalón ancho', sets: [{ w: 80, r: 7 }] }] },
      { id: 'c', date: '2026-07-20', start: 200, entries: [{ name: 'Hip thrust', sets: [{ w: 60, r: 8 }] }] },
    ];
    expect(stalestGroups()).toEqual(['Glúteo', 'Espalda']);
  });

  it('los que nunca entrenaste NO aparecen: la app no le grita a un usuario nuevo', () => {
    S.sessions = [];
    expect(stalestGroups()).toEqual([]);
  });

  it('los frescos no aparecen', () => {
    S.sessions = [
      { id: 'a', date: '2026-08-09', start: 200, entries: [{ name: 'Jalón ancho', sets: [{ w: 80, r: 7 }] }] },
    ];
    expect(stalestGroups()).toEqual([]);
  });
});
```

Y agregar al import del archivo:

```js
import { catOf, muscleVolume, uncategorized, daysSinceGroup, daysSinceAll, stalestGroups, MUSCLE_CATS } from '../muscle.js';
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm run test`
Expected: FAIL — `daysSinceGroup is not a function`.

- [ ] **Step 3: Implementar en `muscle.js`**

Agregar al final del archivo, y sumar `dstr` al import de `format.js` si no está:

```js
/** Días enteros entre dos fechas YYYY-MM-DD, en hora local. */
function diasEntre(desde, hasta) {
  const a = new Date(desde + 'T12:00:00');
  const b = new Date(hasta + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

/** Hace cuántos días entrenaste este grupo por última vez.

    null = nunca. Es distinto de "hace mucho": un grupo sin historial no tiene
    por qué aparecer marcado, o la app le estaría gritando a alguien nuevo por
    algo que todavía no hizo mal.

    Es un hecho, no un modelo: deliberadamente NO se llama "recuperación", que
    sería una afirmación fisiológica que la app no puede sostener. */
export function daysSinceGroup(cat) {
  const hoy = dstr();
  let mejor = null;
  for (const s of S.sessions || []) {
    const tiene = (s.entries || []).some(e => e.sets?.length && catOf(e) === cat);
    if (!tiene) continue;
    if (mejor === null || s.date > mejor) mejor = s.date;
  }
  return mejor === null ? null : Math.max(0, diasEntre(mejor, hoy));
}

/** El mapa completo de los nueve grupos, para la silueta. */
export function daysSinceAll() {
  const out = {};
  MUSCLE_CATS.forEach(c => { out[c] = daysSinceGroup(c); });
  return out;
}

/** Los grupos que llevan `min` días o más sin entrenar, del más viejo al más
    nuevo. Sólo los que TIENEN historial. */
export function stalestGroups(min = 7) {
  return MUSCLE_CATS
    .map(c => ({ c, d: daysSinceGroup(c) }))
    .filter(x => x.d !== null && x.d >= min)
    .sort((a, b) => b.d - a.d)
    .map(x => x.c);
}
```

- [ ] **Step 4: Correr los tests**

Run: `npm run test`
Expected: PASS — todos.

- [ ] **Step 5: Lint y build**

Run: `npm run lint 2>&1 | grep -cE "warning|error" && npm run build:only`
Expected: `10`, y build OK.

- [ ] **Step 6: Commit**

```bash
git add src/lib/muscle.js src/lib/__tests__/muscle.test.js
git commit -m "feat(web): días desde la última vez que entrenaste cada grupo"
```

---

## Task 2: Las siluetas

**Files:**
- Create: `src/components/Silhouette.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: nada de otras tareas. Recibe `days` por prop.
- Produces: `<Silhouette days={{ Pecho: 3, Espalda: null, ... }} />` — dibuja frente y espalda. No calcula nada: recibe el mapa y lo pinta.

**Nota sobre los trazados:** salen de la maqueta ya probada. Se dibuja **sólo la mitad izquierda** de cada cuerpo dentro de `<defs>`, y la derecha es un `<use>` espejado — mitad del trazado y simetría exacta. La cabeza y el cuello van aparte porque no se espejan.

- [ ] **Step 1: Crear el componente**

```jsx
// Las dos siluetas de la pantalla de inicio: frente y espalda, con cada grupo
// muscular coloreado según hace cuántos días lo entrenaste.
//
// Anatómico y no geométrico: a ~300px de alto, que es el tamaño real, el
// argumento de "las formas simples se leen mejor en chico" no aplica. Las
// formas son reconocibles —el abanico del pectoral, la V del dorsal, la gota
// del cuádriceps— pero el relleno es liso, sin sombreado: diagrama técnico, no
// lámina de medicina.
//
// Se dibuja SÓLO la mitad izquierda de cada cuerpo y la derecha es un <use>
// espejado. La mitad del trazado, simetría exacta, y cambiar la forma del
// dorsal la cambia en los dos lados.
//
// Este componente no calcula nada: recibe el mapa {grupo: días} y lo pinta.
// El cálculo vive en lib/muscle.js.

/** Días → clase de color. null (nunca entrenado) se pinta neutro y callado:
    no es lo mismo que "hace mucho", y marcarlo sería gritarle a alguien nuevo
    por algo que todavía no hizo mal. */
function tono(d) {
  if (d === null || d === undefined) return 'sil-none';
  if (d <= 1) return 'sil-d0';
  if (d <= 3) return 'sil-d1';
  if (d <= 6) return 'sil-d2';
  return 'sil-d3';
}

export default function Silhouette({ days = {} }) {
  // El trapecio pinta con Espalda: FIERRO no lo tiene como grupo y catOf manda
  // ahí los remos. Los antebrazos van neutros — no los rastreamos, y pintarlos
  // sería inventar un dato.
  const t = c => tono(days[c]);

  return (
    <div className="sil-pair">
      <div className="sil-box">
        <svg viewBox="0 0 120 250" aria-label="Músculos del frente">
          <use href="#sil-fh" /><use href="#sil-fh" transform="translate(120,0) scale(-1,1)" />
          <ellipse className="sil-skin" cx="60" cy="20" rx="12" ry="14.5" />
          <path className="sil-skin" d="M53,32 L67,32 L68,44 L52,44 Z" />
          <ellipse className="sil-edge" cx="60" cy="20" rx="12" ry="14.5" />
        </svg>
        <span>Frente</span>
      </div>
      <div className="sil-box">
        <svg viewBox="0 0 120 250" aria-label="Músculos de la espalda">
          <use href="#sil-bh" /><use href="#sil-bh" transform="translate(120,0) scale(-1,1)" />
          <ellipse className="sil-skin" cx="60" cy="20" rx="12" ry="14.5" />
          <path className="sil-skin" d="M53,32 L67,32 L68,44 L52,44 Z" />
          <ellipse className="sil-edge" cx="60" cy="20" rx="12" ry="14.5" />
        </svg>
        <span>Espalda</span>
      </div>

      {/* Los trazados, una sola vez. Van acá y no en un archivo aparte porque
          sólo los usa este componente. */}
      <svg width="0" height="0" className="sil-defs" aria-hidden="true"><defs>
        <g id="sil-fh">
          <path className="sil-skin" d="M25,57 C19,61 15,71 14,84 L13,104 C13,114 15,124 18,131 L24,130 C22,121 21,111 21,101 L23,84 C24,74 27,66 31,62 Z" />
          <path className="sil-skin" d="M60,44 C50,43 41,45 35,50 C29,56 27,66 27,76 L29,96 C31,110 34,124 38,134 L60,136 Z" />
          <path className="sil-skin" d="M60,136 L38,134 C35,146 34,162 35,178 L37,198 C38,210 40,224 42,236 L52,237 C54,222 55,206 56,190 L60,160 Z" />
          <path className={`sil-z ${t('Hombro')}`} d="M40,46 C32,49 28,57 28,66 C33,68 39,66 43,62 C45,55 44,49 42,46 Z" />
          <path className={`sil-z ${t('Pecho')}`} d="M58,46 C50,46 42,49 38,55 C35,62 36,70 40,75 C46,79 54,79 58,76 Z" />
          <path className={`sil-z ${t('Bíceps')}`} d="M27,63 C22,68 19,77 19,88 C19,95 21,101 24,104 C28,103 30,97 30,90 L31,72 C31,67 30,64 27,63 Z" />
          <path className={`sil-z ${t('Abs')}`} d="M58,79 L45,80 C44,92 45,106 48,118 C51,124 55,127 58,127 Z" />
          <path className={`sil-z ${t('Abs')}`} d="M43,80 C40,88 40,100 42,110 L46,118 C44,106 43,92 44,80 Z" />
          <path className={`sil-z ${t('Pierna')}`} d="M56,142 C48,141 41,144 39,152 C36,164 36,178 38,190 C40,196 45,198 49,195 C52,184 54,170 56,156 Z" />
          <path className={`sil-z ${t('Gemelos')}`} d="M46,202 C41,204 38,212 38,222 C38,230 40,236 43,238 C47,237 49,231 49,223 L48,208 Z" />
          <g className="sil-sep">
            <path d="M46,92 L58,92" /><path d="M47,104 L58,104" /><path d="M49,115 L58,115" />
          </g>
          <g className="sil-edge">
            <path d="M60,44 C50,43 41,45 35,50 C29,56 27,66 27,76 L29,96 C31,110 34,124 38,134" />
            <path d="M38,134 C35,146 34,162 35,178 L37,198 C38,210 40,224 42,236" />
          </g>
        </g>

        <g id="sil-bh">
          <path className="sil-skin" d="M25,57 C19,61 15,71 14,84 L13,104 C13,114 15,124 18,131 L24,130 C22,121 21,111 21,101 L23,84 C24,74 27,66 31,62 Z" />
          <path className="sil-skin" d="M60,44 C50,43 41,45 35,50 C29,56 27,66 27,76 L29,96 C31,108 34,120 38,130 L60,132 Z" />
          <path className="sil-skin" d="M60,132 L38,130 C35,142 34,160 35,178 L37,198 C38,210 40,224 42,236 L52,237 C54,222 55,206 56,190 L60,158 Z" />
          <path className={`sil-z ${t('Hombro')}`} d="M40,46 C32,49 28,57 28,66 C33,68 39,66 43,62 C45,55 44,49 42,46 Z" />
          <path className={`sil-z ${t('Espalda')}`} d="M60,42 L48,46 C44,52 42,58 42,64 L60,68 Z" />
          <path className={`sil-z ${t('Espalda')}`} d="M42,66 C36,72 32,82 31,92 C33,102 37,110 42,116 L60,110 L60,70 Z" />
          <path className={`sil-z ${t('Tríceps')}`} d="M27,63 C22,68 19,77 19,88 C19,95 21,101 24,104 C28,103 30,97 30,90 L31,72 C31,67 30,64 27,63 Z" />
          <path className={`sil-z ${t('Glúteo')}`} d="M58,124 C48,123 40,127 37,136 C35,146 37,155 43,159 C50,161 56,157 58,150 Z" />
          <path className={`sil-z ${t('Pierna')}`} d="M56,163 C48,162 41,165 39,173 C37,184 37,196 39,206 C42,211 47,211 50,207 C53,196 54,180 56,170 Z" />
          <path className={`sil-z ${t('Gemelos')}`} d="M47,210 C41,212 38,220 38,229 C38,236 40,241 43,242 C47,241 49,235 49,227 L48,215 Z" />
          <g className="sil-edge">
            <path d="M60,44 C50,43 41,45 35,50 C29,56 27,66 27,76 L29,96 C31,108 34,120 38,130" />
            <path d="M38,130 C35,142 34,160 35,178 L37,198 C38,210 40,224 42,236" />
          </g>
        </g>
      </defs></svg>
    </div>
  );
}
```

- [ ] **Step 2: Los estilos**

Agregar al final de `src/styles.css`:

```css
/* ---------- las siluetas de Inicio ----------
   El color dice hace cuántos días entrenaste cada grupo. Es un hecho, no un
   modelo: no es "recuperación". La pantalla se enciende cuando entrenás y se
   apaga sola con los días — entrar y verla apagada da ganas de prenderla. */
.sil-pair{display:flex;justify-content:center;gap:2px;flex:1;min-height:0;margin:2px 0}
.sil-defs{position:absolute;width:0;height:0}
.sil-box{display:flex;flex-direction:column;align-items:center;gap:2px;min-height:0}
.sil-box svg{height:100%;max-height:330px;width:auto;display:block}
.sil-box>span{
  font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--mut2);
  font-family:'Barlow Condensed',sans-serif;font-weight:700;
}
.sil-z{transition:fill .45s var(--ease)}
.sil-d0{fill:var(--cyan,#22D3EE)}
.sil-d1{fill:var(--blue)}
.sil-d2{fill:#27467F}
/* 7+ días: hueco con borde ámbar. Es la única zona que llama la atención. */
.sil-d3{fill:rgba(255,180,84,.16);stroke:rgba(255,180,84,.6);stroke-width:.9}
/* nunca entrenado: neutro y callado, distinto de "hace mucho" */
.sil-none{fill:rgba(255,255,255,.05)}
.sil-skin{fill:rgba(255,255,255,.05)}
.sil-edge{fill:none;stroke:rgba(255,255,255,.16);stroke-width:1}
.sil-sep{fill:none;stroke:rgba(4,7,15,.5);stroke-width:.9;stroke-linecap:round}
@media (prefers-reduced-motion:reduce){.sil-z{transition:none}}
```

**Nota:** `--cyan` no existe como token; el fallback `#22D3EE` lo cubre. Si más adelante se agrega el token, esta regla lo toma sola.

- [ ] **Step 3: Lint y build**

Run: `npm run lint 2>&1 | grep -cE "warning|error" && npm run build:only`
Expected: `10`, build OK.

- [ ] **Step 4: Commit**

```bash
git add src/components/Silhouette.jsx src/styles.css
git commit -m "feat(web): las siluetas anatómicas de la pantalla de inicio"
```

---

## Task 3: La pantalla de inicio

**Files:**
- Create: `src/components/screens/Inicio.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `daysSinceAll`, `stalestGroups` (Task 1); `<Silhouette days={…} />` (Task 2); `sessionForWeekday`, `orderedExs` (session.js, ya existen).
- Produces: `<Inicio />`, para el switch de `App.jsx` (Task 4).

- [ ] **Step 1: Crear la pantalla**

```jsx
// La portada. Antes la app abría en "Hoy", que es una pila de tarjetas que se
// scrollea: útil, y un feed. No había un momento en que mirases la app y te
// dieran ganas de ir al gimnasio.
//
// Acá el héroe es tu cuerpo: dos siluetas con cada grupo coloreado según hace
// cuántos días lo entrenaste. Se enciende cuando entrenás y se apaga sola.
//
// Todo entra sin scroll. "Hoy" pasa a ser adonde te lleva el botón grande.
import { S, useStore, bump, openSheet } from '../../lib/state.js';
import { WD, WD1, WDS, MO, WEEK_ORDER } from '../../lib/format.js';
import { orderedExs, sessionForWeekday } from '../../lib/session.js';
import { daysSinceAll, stalestGroups } from '../../lib/muscle.js';
import Silhouette from '../Silhouette.jsx';

export default function Inicio() {
  useStore();
  const hoy = new Date();
  const wd = hoy.getDay();
  const day = S.routine[wd];
  const exs = orderedExs(wd, day?.exercises || []);
  const hecha = sessionForWeekday(wd);
  const draft = S.draft;
  const enCurso = !!draft;

  const totalSets = exs.reduce((a, e) => a + e.sets, 0);
  const estMin = Math.round(totalSets * ((S.cfg.rest || 90) + 40) / 60);
  const viejos = stalestGroups();

  // Cuántos ejercicios llevás, para el botón de "seguir"
  const hechos = enCurso
    ? Object.values(draft.entries).filter(e => e.sets.length).length
    : 0;

  const irAHoy = () => { S.tab = 'hoy'; S.hoyDay = null; bump(); };

  let eyebrow, titulo, sub, cta;
  if (enCurso) {
    eyebrow = 'Sesión en curso';
    titulo = draft.dayName || WD[draft.weekday];
    sub = `${hechos} de ${exs.length} ejercicios`;
    cta = <button type="button" className="ini-cta pulse" onClick={irAHoy}>SEGUIR<small>{hechos} de {exs.length}</small></button>;
  } else if (hecha) {
    eyebrow = 'Completado · hoy';
    titulo = hecha.dayName || WD[wd];
    sub = `${hecha.duration} min · ${(hecha.entries || []).length} ejercicios`;
    cta = <button type="button" className="ini-cta ok" onClick={() => openSheet('session-view', { id: hecha.id })}>VER LO QUE HICISTE</button>;
  } else if (exs.length) {
    eyebrow = `${WDS[wd]} ${hoy.getDate()} ${MO[hoy.getMonth()]} · toca hoy`;
    titulo = day.name || WD[wd];
    sub = `${exs.length} ejercicios · ${totalSets} series · ~${estMin} min`;
    cta = <button type="button" className="ini-cta" onClick={irAHoy}>EMPEZAR<small>{exs.length} ej · ~{estMin} min</small></button>;
  } else {
    const hayRutina = WEEK_ORDER.some(d => S.routine[d]?.exercises?.length);
    eyebrow = `${WDS[wd]} ${hoy.getDate()} ${MO[hoy.getMonth()]}`;
    titulo = hayRutina ? 'Descanso' : 'Sin rutina';
    sub = hayRutina ? 'Hoy no toca entrenar' : 'Armá tu split para empezar';
    cta = hayRutina
      ? <button type="button" className="ini-cta dim" onClick={irAHoy}>ENTRENAR IGUAL</button>
      : <button type="button" className="ini-cta" onClick={() => { S.tab = 'rutina'; bump(); }}>ARMAR MI RUTINA</button>;
  }

  return (
    <div className="inicio">
      <div className="ini-top">
        <div className="ini-eyebrow">{eyebrow}</div>
        <div className="ini-title">{titulo}</div>
        <div className="ini-sub">{sub}</div>
      </div>

      <Silhouette days={daysSinceAll()} />

      <div className="ini-legend">
        <span><i className="sw sil-sw0"></i>ayer</span>
        <span><i className="sw sil-sw1"></i>2-3 d</span>
        <span><i className="sw sil-sw2"></i>4-6 d</span>
        <span><i className="sw sil-sw3"></i>7+ d</span>
      </div>

      {/* Una sola línea nombra el grupo más viejo. Con nueve grupos, nombrarlos
          todos sería una lista; nombrar el peor es un consejo. */}
      {viejos.length > 0 && <StaleLine grupos={viejos} dias={daysSinceAll()} />}

      {cta}

      <div className="wkstrip ini-wk">
        {WEEK_ORDER.map(d => {
          const dd = S.routine[d];
          const has = dd?.exercises?.length;
          const esHoy = d === wd;
          const listo = !!has && !!sessionForWeekday(d);
          return (
            <button
              key={d} type="button"
              className={`wd ${has ? 'has' : ''} ${esHoy ? 'today on' : ''} ${listo ? 'done' : ''}`}
              onClick={() => { S.hoyDay = d; S.tab = 'hoy'; bump(); }}
            >
              <div className="l">{WD1[d]}</div>
              <div className="n">{has ? (dd.name || 'Rutina') : 'Descanso'}</div>
              {listo && <div className="tick">✓</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

Y agregar al final del mismo archivo el subcomponente de la línea ámbar:

```jsx
/** Los grupos más olvidados, con sus días reales. Nombra como mucho dos: con
    nueve grupos, nombrarlos todos sería una lista y no un consejo.

    `stalestGroups` los devuelve del más viejo al más nuevo, así que los días
    que se muestran son los del primero — el peor caso. */
function StaleLine({ grupos, dias }) {
  const top = grupos.slice(0, 2);
  const d = dias[top[0]];
  return (
    <div className="ini-stale">
      ⌁ {top.join(' y ')} hace {d} día{d === 1 ? '' : 's'}
    </div>
  );
}
```

- [ ] **Step 2: Los estilos**

Agregar a `src/styles.css`:

```css
/* ---------- la pantalla de inicio ----------
   Compuesta, no scrolleable: entra entera en un teléfono. Por eso la silueta
   es flex:1 y se encoge antes que el resto. */
.inicio{display:flex;flex-direction:column;height:100%;min-height:0}
.ini-top{flex:none}
.ini-eyebrow{
  font-family:'Barlow Condensed',sans-serif;font-size:var(--t-micro);font-weight:700;
  letter-spacing:.16em;text-transform:uppercase;color:var(--cyan,#22D3EE);
}
.ini-title{font-size:38px;font-weight:800;font-style:italic;letter-spacing:-.03em;line-height:1.02;font-family:'Barlow Condensed',sans-serif}
.ini-sub{font-size:var(--t-sm);color:var(--mut);margin-bottom:2px}

.ini-legend{display:flex;justify-content:center;gap:11px;margin-bottom:7px;flex:none}
.ini-legend span{display:flex;align-items:center;gap:5px;font-size:9px;color:var(--mut2);letter-spacing:.04em}
.ini-legend .sw{width:9px;height:9px;border-radius:3px;flex:none;display:inline-block}
.sil-sw0{background:#22D3EE}
.sil-sw1{background:var(--blue)}
.sil-sw2{background:#27467F}
.sil-sw3{background:rgba(255,180,84,.18);border:1px solid rgba(255,180,84,.6)}

.ini-stale{
  display:flex;align-items:center;gap:7px;padding:8px 11px;border-radius:11px;flex:none;
  background:rgba(255,180,84,.09);border:1px solid rgba(255,180,84,.25);
  font-size:12.5px;color:var(--warn);margin-bottom:9px;
}

.ini-cta{
  display:flex;align-items:center;justify-content:center;gap:9px;flex:none;
  height:56px;border-radius:18px;border:0;width:100%;
  background:var(--grad2);color:var(--on-grad);
  font-family:'Barlow Condensed',sans-serif;
  font-weight:800;font-size:17px;letter-spacing:.06em;
  box-shadow:var(--glow);
}
.ini-cta small{font-weight:600;opacity:.65;font-size:12.5px;letter-spacing:0}
.ini-cta.ok{background:linear-gradient(112deg,#2EE6A8,#0E9F6E);box-shadow:0 16px 40px -14px rgba(46,230,168,.5)}
.ini-cta.dim{background:var(--card2);border:1px solid var(--line2);color:var(--mut);box-shadow:none}
.ini-cta.pulse{animation:pulse 2s infinite}
.ini-wk{margin-top:10px;flex:none}
@media (prefers-reduced-motion:reduce){.ini-cta.pulse{animation:none}}
```

- [ ] **Step 3: Lint y build**

Run: `npm run lint 2>&1 | grep -cE "warning|error" && npm run build:only`
Expected: `10`, build OK.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/Inicio.jsx src/styles.css
git commit -m "feat(web): la pantalla de inicio y sus cuatro estados"
```

---

## Task 4: La navegación

**Files:**
- Modify: `src/components/TabBar.jsx`, `src/App.jsx`, `src/lib/state.js`, `src/components/screens/Hoy.jsx`, `src/styles.css`

**Interfaces:**
- Consumes: `<Inicio />` (Task 3).
- Produces: nada nuevo.

**El detalle que rompe si se pasa por alto:** `TabBar` mueve el indicador
buscando `button.on`. Con `S.tab === 'hoy'` no hay ninguna pestaña activa, la
búsqueda devuelve `null` y el indicador se queda colgado donde estaba. Hay que
marcar Inicio como activa mientras estás en Hoy.

- [ ] **Step 1: Inicio reemplaza a Hoy en la barra**

En `src/components/TabBar.jsx`, reemplazar la primera entrada de `TABS`:

```js
  {
    id: 'hoy', label: 'Hoy',
    path: 'M13 2 4.5 13.5h5L10 22l8.5-11.5h-5L13 2z',
  },
```

por:

```js
  {
    // Inicio toma el lugar de Hoy: la barra no crece. "Hoy" pasa a ser adonde
    // te lleva el botón grande de esta pantalla.
    id: 'inicio', label: 'Inicio',
    path: 'M3.5 10.5 12 3.5l8.5 7',
    path2: 'M5.5 9v11.5h13V9',
  },
```

- [ ] **Step 2: El arranque**

En `src/lib/state.js`, cambiar:

```js
  tab: 'hoy',
```

por:

```js
  tab: 'inicio',       // la portada; 'hoy' sigue existiendo, pero se entra desde acá
```

- [ ] **Step 3: El switch de pantallas y la pestaña activa**

En `src/App.jsx`, agregar el import:

```jsx
import Inicio from './components/screens/Inicio.jsx';
```

Reemplazar el bloque de `<main>`:

```jsx
        {store.tab === 'hoy' && <Hoy />}
```

por:

```jsx
        {store.tab === 'inicio' && <Inicio />}
        {store.tab === 'hoy' && <Hoy />}
```

Y en el `<TabBar/>`, marcar Inicio como activa mientras estás en Hoy — si no,
`moveTabIndicator()` no encuentra `button.on` y el indicador se queda colgado:

```jsx
      <TabBar active={store.tab === 'hoy' ? 'inicio' : store.tab} onChange={t => { S.tab = t; bump(); }} />
```

- [ ] **Step 4: El botón de volver en Hoy**

En `src/components/screens/Hoy.jsx`, reemplazar la línea del título:

```jsx
      <div className="vtitle"><h1>Hoy</h1><span className="sub">{WDS[today.getDay()]} {today.getDate()} {MO[today.getMonth()]}</span></div>
```

por:

```jsx
      {/* Hoy dejó de ser pestaña: se entra desde Inicio, así que necesita su
          propia salida. */}
      <div className="vtitle">
        <button type="button" className="back-btn" aria-label="Volver a Inicio" onClick={() => { S.tab = 'inicio'; bump(); }}>‹</button>
        <h1>Hoy</h1>
        <span className="sub">{WDS[today.getDay()]} {today.getDate()} {MO[today.getMonth()]}</span>
      </div>
```

Y agregar el estilo a `src/styles.css`:

```css
.back-btn{
  width:34px;height:34px;flex:none;margin-left:-6px;border-radius:11px;
  background:var(--card2);border:1px solid var(--line);
  color:var(--mut);font-size:22px;line-height:1;display:grid;place-items:center;
}
.back-btn:active{color:var(--blue2);border-color:var(--line2)}
```

- [ ] **Step 5: Verificación completa**

Run: `npm run test && npm run lint 2>&1 | grep -cE "warning|error" && npm run build:only`
Expected: tests PASS, `10`, build OK.

- [ ] **Step 6: Verificación manual**

Run: `npm run dev`

1. La app abre en **Inicio**, con la pestaña Inicio marcada y el indicador en su lugar.
2. Las siluetas se ven con colores distintos según lo entrenado; los grupos sin historial quedan neutros.
3. "EMPEZAR" lleva a Hoy, y el ‹ del título vuelve a Inicio.
4. Estando en Hoy, la pestaña **Inicio sigue marcada** y el indicador no se descoloca.
5. Abrir una sesión y volver a Inicio: el botón dice "SEGUIR · n de m" y late.
6. Completar la sesión: el botón pasa a "VER LO QUE HICISTE" en verde.
7. Elegir un día de descanso en la tira: el título dice "Descanso".
8. Todo entra sin scrollear en un viewport de 390×844.

- [ ] **Step 7: Commit**

```bash
git add -A src/
git commit -m "feat(web): Inicio reemplaza a Hoy como portada"
```

---

## Self-Review

**Cobertura del spec:**

| Sección del spec | Tarea |
|---|---|
| Silueta anatómica, plana, frente y espalda | Task 2 |
| Media silueta espejada con `<use>` | Task 2 |
| Zonas por grupo, trapecio con Espalda, antebrazos neutros | Task 2 |
| Escala de color de cuatro pasos | Task 2 (CSS) + Task 1 (dato) |
| `daysSinceGroup` como hecho, no modelo | Task 1 |
| "Nunca" ≠ "hace 7+" | Task 1 (devuelve `null`) + Task 2 (`sil-none`) |
| La línea del grupo más viejo | Task 1 (`stalestGroups`) + Task 3 (`StaleLine`) |
| Composición sin scroll | Task 3 (CSS, `flex:1` en la silueta) |
| Los cuatro estados | Task 3 |
| Estado vacío sin rutina | Task 3 (rama `else`) |
| Inicio reemplaza a Hoy en la barra | Task 4 |
| Con sesión abierta, quedarse en Inicio | Task 3 (el botón dice "Seguir", no navega solo) |
| Sin línea de récord | No hay tarea — es lo correcto |

Sin huecos.

**Consistencia de nombres verificada:** `daysSinceGroup`, `daysSinceAll`,
`stalestGroups` y `MUSCLE_CATS` (Task 1) se usan con esos nombres exactos en las
tareas 2 y 3. `<Silhouette days={…} />` coincide entre Task 2 y Task 3. Las
clases `sil-d0…sil-d3`, `sil-none` y `sil-skin` coinciden entre el JSX de Task 2
y el CSS de Task 2.

**Corregido durante la escritura:** la Task 3 tenía un `Math.max(...)` que no
calculaba los días reales de la línea ámbar, y un segundo paso que lo arreglaba.
Un plan que escribe código malo y después lo parcha no es un plan: se unificó en
un solo paso con `StaleLine` recibiendo los días como prop.
