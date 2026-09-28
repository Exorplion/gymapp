# Color: base grafito + un acento elegido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que toda la app salga de una base grafito fija y de UN acento derivado en OKLCH de un matiz elegido en Ajustes, sin un solo azul fijo que no venga del acento.

**Architecture:** `lib/theme.js` es la única fuente de la derivación: de `{h, c}` calcula en OKLCH (recortado al gamut sRGB) `--accent`, `--accent-strong`, `--on-accent`, los canales `-rgb` y la escala del mapa muscular, y los escribe como custom properties en `<html>`. `styles.css` define los tokens por función (base, acento, estados) con los valores de Hielo como defecto — un test exige que coincidan con `theme.js` —, y fuera de ese bloque no queda ni un color literal (otro test). Tailwind lee los mismos tokens con `@theme inline`; canvas, confeti y Lottie leen los tokens con `getComputedStyle` en el momento de dibujar.

**Tech Stack:** React 19 · Vite · Tailwind v4 · vitest · Chrome MCP para verificar.

**Spec:** `docs/superpowers/specs/2026-09-27-rediseno-sesion-y-color-design.md` (sección 4 y reglas del encabezado).

## Global Constraints

- Base fija: `--bg #101113`; `--glass rgba(34,35,39,.66)` + borde blanco al 10 %; `backdrop-filter: blur() saturate(1.2)` (≤ 1.2).
- `--accent = oklch(.80 C h)`, `--accent-strong = oklch(.62 C' h)` (C' = C·1.1), `--on-accent` oscuro (`oklch(.18 min(C,.03) h)`), recortados al gamut sRGB reduciendo croma.
- Presets: Hielo 225/.13 (defecto), Cobalto 262/.16, Violeta 295/.15, Fucsia 345/.17, Monocromo croma 0. Personalizado: sólo el matiz, croma .15, alejado ≥ 20° de rojo/ámbar/verde. Sin Naranja ni Lima. Negro no es acento.
- Estados fijos: `--ok #34D399`, `--danger #F87171`, `--warn #FBBF24` (+ `--flame #FFC46B` de la racha).
- Contraste AA: texto ≥ 4.5; texto grande e íconos ≥ 3.
- Duraciones sólo `--d1..--d4` / `D`; patrones existentes (`.card`, `.chip`, `.seg`, `.btn`); ninguna clase sin CSS.
- Verificación: `npx vite build` + `npx vite preview --port 4182 --strictPort`, pestaña propia de Chrome MCP, 390×844 y 430×932.
- `tokens.test.js` verde en todo momento (todo `var()` apunta a un token definido).
- Commits en español, terminados en `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `web/src/lib/theme.js` | Reescrito: OKLCH↔hex, presets, `alejarDeEstados`, `acentoDe`, `variablesDe`, `acentoGuardado` (migración), `aplicarAcento`, `leerToken` |
| `web/src/lib/__tests__/theme.test.js` | Reescrito: conversión, presets, barrida AA cada 10°, distancia a estados, migración, CSS = theme.js |
| `web/src/lib/__tests__/colores-literales.test.js` | Nuevo: ningún color literal en `styles.css` fuera del bloque de tokens |
| `web/src/styles.css` | Bloque de tokens nuevo (`@theme inline` + `:root`), todos los literales → tokens |
| `web/src/components/sheets/Settings.jsx` | Sección Color: presets, personalizado, vista previa real |
| `web/src/App.jsx` | Arranque: `aplicarAcento(acentoGuardado(S.cfg))` + persistir la migración |
| `web/src/lib/charts.ts`, `components/Chart.jsx` | Tokens en el canvas, redibujo con el evento `fierro:acento` |
| `web/src/components/Silhouette.jsx`, `BodyMini.jsx` | Stops por `var(--mapa-*)` |
| `web/src/lib/confetti.js`, `components/PrBurst.jsx`, `lib/photo.js` | Colores leídos de tokens |
| `web/index.html`, `web/vite.config.js`, `web/public/*.png`, `web/public/favicon.svg` | Grafito + ícono de FIERRO |
| `web/src/components/**/*.jsx` | Utilidades Tailwind y `var()` renombrados |

## Mapa de nombres (viejo → nuevo)

| Viejo | Nuevo |
|---|---|
| `--bg` / `--bg2` / `--card` / `--card2` | `--bg` / `--surface` / `--surface` / `--surface-2` |
| `--txt` / `--mut` / `--mut2` | `--text` / `--text-2` / `--text-3` |
| `--line` / `--line2` | `--line` / `--line-2` (neutros) |
| `--accent` `--blue` `--blue2` `--blue3` `--cyan` | `--accent` |
| `--deep` (y `--blue` como arranque de degradado) | `--accent-strong` |
| `--grad` / `--grad2` | `--accent-grad` |
| `--on-grad` | `--on-accent` (sobre acento) · `--on-ok` (sobre verde) · `--on-warn` (sobre ámbar) |
| `--glow` | `--accent-glow` |
| `--blue-rgb` `--blue2-rgb` `--blue3-rgb` `--cyan-rgb` / `--deep-rgb` | `--accent-rgb` / `--accent-strong-rgb` |
| `--red` / `--red-rgb` | `--danger` / `--danger-rgb` |
| `--glass-hi` | `--edge-metal` |
| Tailwind `text-txt` `text-mut` `text-mut2` `bg-card2` `border-line2` | `text-text` `text-text-2` `text-text-3` `bg-surface-2` `border-line-2` |
| Tailwind `*-blue*` `*-cyan` | `*-accent` · `*-red` → `*-danger` |

Literales (fuera del bloque de tokens) → tokens: blanco translúcido → `rgba(var(--hi-rgb),α)`; negro → `rgba(var(--shade-rgb),α)`; bases navy del vidrio → `var(--glass)` / `rgba(var(--glass-rgb),α)` / `rgba(var(--bg-rgb),α)` / `var(--surface*)`; fríos de acento → `rgba(var(--accent-rgb|--accent-strong-rgb),α)`; rojos → `--danger*`; ámbares → `--warn*`/`--flame-rgb`; verdes → `--ok*`.

---

### Task 1: `theme.js` — derivación OKLCH, presets, estados y migración

**Files:**
- Modify (reescritura): `web/src/lib/theme.js`
- Test (reescritura): `web/src/lib/__tests__/theme.test.js`

**Interfaces:**
- Produces:
  - `oklchAHex(L, C, h) → { hex: string, c: number }` (croma recortado al gamut)
  - `hexAOklch(hex) → { L, C, h } | null`
  - `contrastRatio(hexA, hexB) → number`
  - `PRESETS: { id, nombre, h, c }[]` · `ACENTO_DEFECTO = { id: 'hielo' }` · `CROMA_PROPIO = .15`
  - `ESTADOS = { danger, warn, ok, flame }` (hex) · `BASE = { bg, glassRgb, glassAlfa, surface, surface2, text, text2, text3 }` · `HERO_TINTE = .14`
  - `distanciaMatiz(a, b) → [0,180]` · `alejarDeEstados(h) → h`
  - `acentoDe(sel) → { h, c }` (sel = `{ id }` o `{ id: 'propio', h }`)
  - `variablesDe({h, c}) → Record<'--accent'|'--accent-strong'|'--on-accent'|'--accent-rgb'|'--accent-strong-rgb'|'--mapa-{0,1,2}-{hi,md,lo}', string>`
  - `acentoGuardado(cfg) → { sel, migrado: boolean }` (lee `cfg.acento`; si no hay y hay `cfg.themeColor`, migra al preset más cercano por matiz si está a ≤ 15°, si no a `{id:'propio', h}` alejado de los estados; acromático → defecto)
  - `aplicarAcento(sel)` (escribe variables en `<html>`, `meta[name=theme-color]` = `--bg`, dispara `window` event `fierro:acento`)
  - `leerToken(nombre) → string`

- [ ] **Step 1: Write the failing tests** (`theme.test.js`) cubriendo:

```js
import { describe, it, expect } from 'vitest';
import { oklchAHex, hexAOklch, contrastRatio, PRESETS, ACENTO_DEFECTO, ESTADOS, BASE, HERO_TINTE,
  distanciaMatiz, alejarDeEstados, acentoDe, variablesDe, acentoGuardado } from '../theme.js';

const MARGEN = 20;
const componer = (rgb, a, fondo) => '#' + [0, 1, 2].map(i => Math.round(rgb[i] * a + parseInt(fondo.slice(1 + i * 2, 3 + i * 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
const canales = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const glass = componer(BASE.glassRgb, BASE.glassAlfa, BASE.bg);
const barrida = [...PRESETS.map(p => [p.nombre, { id: p.id }]),
  ...Array.from({ length: 36 }, (_, i) => [`propio ${i * 10}°`, { id: 'propio', h: i * 10 }])];

describe('contraste AA para cada preset y cada 10°', () => {
  it.each(barrida)('%s', (_n, sel) => {
    const v = variablesDe(acentoDe(sel));
    const hero = componer(canales(v['--accent-strong']), HERO_TINTE, glass);
    for (const fondo of [glass, BASE.surface, BASE.surface2, hero])
      for (const t of [BASE.text, BASE.text2, BASE.text3, v['--accent']])
        expect(contrastRatio(t, fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(v['--on-accent'], v['--accent'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(v['--on-accent'], v['--accent-strong'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(v['--accent-strong'], glass)).toBeGreaterThanOrEqual(3);
  });
});

describe('distancia entre el acento y los estados', () => {
  it('ningún matiz elegido queda a menos de 20° de un estado', () => {
    for (let h = 0; h < 360; h++) {
      const { h: final, c } = acentoDe({ id: 'propio', h });
      const v = variablesDe({ h: final, c });
      const real = hexAOklch(v['--accent']).h;
      for (const e of Object.values(ESTADOS)) expect(distanciaMatiz(real, hexAOklch(e).h)).toBeGreaterThanOrEqual(MARGEN - 1);
    }
  });
  it('los presets cromáticos también', () => { /* igual, sobre PRESETS con c > 0 */ });
  it('no se ofrecen Naranja ni Lima', () => expect(PRESETS.map(p => p.id)).toEqual(['hielo', 'cobalto', 'violeta', 'fucsia', 'mono']));
});

describe('migración de themeColor', () => {
  it('sin nada guardado → Hielo', () => expect(acentoGuardado({}).sel).toEqual(ACENTO_DEFECTO));
  it('el celeste de fábrica viejo (#38BDF8) → Hielo', () => expect(acentoGuardado({ themeColor: '#38BDF8' })).toEqual({ sel: { id: 'hielo' }, migrado: true }));
  it('violeta #8B5CF6 → Violeta', () => expect(acentoGuardado({ themeColor: '#8B5CF6' }).sel).toEqual({ id: 'violeta' }));
  it('negro → defecto', () => expect(acentoGuardado({ themeColor: '#000000' }).sel).toEqual(ACENTO_DEFECTO));
  it('rojo → propio, corrido fuera del rojo', () => { const { sel } = acentoGuardado({ themeColor: '#EF4444' }); expect(sel.id).toBe('propio'); expect(distanciaMatiz(sel.h, hexAOklch(ESTADOS.danger).h)).toBeGreaterThanOrEqual(MARGEN); });
  it('si ya hay acento, gana y no migra', () => expect(acentoGuardado({ acento: { id: 'fucsia' }, themeColor: '#8B5CF6' })).toEqual({ sel: { id: 'fucsia' }, migrado: false }));
});
```

Más: `oklchAHex` redondea y vuelve (`hexAOklch(oklchAHex(.8,.1,230).hex).h ≈ 230 ± 1`), queda dentro del gamut (canales 0-255) y reduce croma cuando hace falta (`oklchAHex(.8,.3,262).c < .3`); Monocromo da grises (`r=g=b`); `contrastRatio` blanco/negro 21.

- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/theme.test.js` → FAIL (exports inexistentes).

- [ ] **Step 3: Implement** `theme.js`:

```js
const aLineal = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const aGamma = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function oklchALineal(L, C, h) { /* matrices de Björn Ottosson (OKLab → LMS → sRGB lineal) */ }
const enGamut = v => v.every(x => x >= -1e-4 && x <= 1 + 1e-4);
export function oklchAHex(L, C, h) { /* búsqueda binaria del croma máximo ≤ C dentro del gamut; hex */ }
export function hexAOklch(hex) { /* inversa; null si no es un hex */ }
export const PRESETS = [
  { id: 'hielo', nombre: 'Hielo', h: 225, c: 0.13 },
  { id: 'cobalto', nombre: 'Cobalto', h: 262, c: 0.16 },
  { id: 'violeta', nombre: 'Violeta', h: 295, c: 0.15 },
  { id: 'fucsia', nombre: 'Fucsia', h: 345, c: 0.17 },
  { id: 'mono', nombre: 'Monocromo', h: 0, c: 0 },
];
export const ESTADOS = { danger: '#F87171', warn: '#FBBF24', ok: '#34D399', flame: '#FFC46B' };
// zonas prohibidas = matiz de cada estado ± MARGEN, fusionadas si el hueco entre dos es < MARGEN
export function alejarDeEstados(h) { /* si cae en una zona, al borde más cercano (+/-0.5° de aire) */ }
export function variablesDe({ h, c }) {
  const a = oklchAHex(0.80, c, h), s = oklchAHex(0.62, c * 1.1, h), on = oklchAHex(0.18, Math.min(c, 0.03), h);
  // mapa muscular: tres escalones de luminosidad del mismo matiz (d0 más claro = entrenado hace poco)
  return { '--accent': a.hex, '--accent-strong': s.hex, '--on-accent': on.hex, '--accent-rgb': canales(a.hex), '--accent-strong-rgb': canales(s.hex), ...mapa };
}
```

- [ ] **Step 4: Run** → PASS. Si algún contraste no llega, se ajustan `BASE.text3` (`#97979f`) y `HERO_TINTE` (.14), no el umbral.
- [ ] **Step 5: Commit** `feat(color): theme.js deriva el acento en OKLCH desde un matiz`.

### Task 2: bloque de tokens nuevo en `styles.css` (con alias temporales)

**Files:** Modify `web/src/styles.css:1-300`; Test: `theme.test.js` (bloque "CSS = theme.js").

**Interfaces:** Consumes `variablesDe`, `BASE`, `ESTADOS`, `PRESETS` de Task 1. Produces los tokens del mapa de nombres + `--hi-rgb`, `--shade-rgb`, `--glass-rgb`, `--bg-rgb`, `--glass-strong`, `--*-strong`, `--on-ok`, `--on-warn`, `--warn-soft`, `--flame-rgb`, `--mapa-n-*`, `--mapa-3-*`, `--pelo-*`.

- [ ] **Step 1: Test que falla:** leer `styles.css`, extraer el primer `:root{…}` y exigir que cada clave de `variablesDe(acentoDe(ACENTO_DEFECTO))`, `BASE` y `ESTADOS` tenga el mismo valor en el CSS.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Reescribir `@theme` → `@theme inline` (sólo `--color-*: var(--token)`; radios, fuentes y escala tipográfica siguen en un `@theme` normal) y `:root` con los tokens nuevos y valores de Hielo. Alias temporales `--txt:var(--text)` etc. para que nada se rompa hasta Task 3.
- [ ] **Step 4:** `npx vitest run` → PASS (incluye `tokens.test.js`).
- [ ] **Step 5: Commit** `feat(color): tokens por función y base grafito`.

### Task 3: renombrar todos los usos y borrar los alias

**Files:** `web/src/styles.css`, `web/src/components/**/*.jsx`, `web/src/lib/*.js|ts`.

- [ ] **Step 1:** script de reemplazo con el mapa de nombres (`var(--x)` y utilidades Tailwind con límite de palabra); a mano los casos de `--on-grad` sobre verde/ámbar y los arranques de degradado (`--blue` → `--accent-strong`).
- [ ] **Step 2:** borrar los alias; `npx vitest run` → `tokens.test.js` falla si quedó un `var()` a un alias → corregir hasta verde.
- [ ] **Step 3:** `grep -rnE "var\(--(txt|mut2?|card2?|bg2|line2|blue[23]?|cyan|deep|grad2?|on-grad|red|glow|glass-hi)\b|\b(text-(txt|mut2?|blue[23]?|red)|bg-(card2|blue2|cyan|red/)|border-(line2|blue2|red/)|outline-blue2)\b" web/src` → vacío.
- [ ] **Step 4: Commit** `refactor(color): nombres por función en CSS y componentes`.

### Task 4: cero literales fuera del bloque de tokens

**Files:** `web/src/styles.css`; Test: `web/src/lib/__tests__/colores-literales.test.js` (nuevo).

- [ ] **Step 1: Test que falla:**

```js
// sin comentarios; se corta el bloque de tokens (@theme inline + el primer :root)
const RE = /#[0-9a-f]{3,8}\b|\brgba?\(\s*\d|\bhsla?\(|\boklch\(|(?<![\w-])(white|black|red|blue|navy)(?![\w-])/gi;
expect(culpables, 'color literal fuera del bloque de tokens: usá un token').toEqual([]);
```
- [ ] **Step 2:** FAIL con ~160 líneas.
- [ ] **Step 3:** reemplazar según la tabla de literales (arriba). Borrar `.sil-sw0..3` (CSS muerto). `saturate()` del vidrio ≤ 1.2 en todas las recetas de `backdrop-filter`.
- [ ] **Step 4:** PASS + `tokens.test.js` verde.
- [ ] **Step 5: Commit** `feat(color): styles.css sin colores fijos fuera de los tokens`.

### Task 5: arranque, migración y Ajustes

**Files:** `web/src/App.jsx:394`, `web/src/components/sheets/Settings.jsx:115-307`, `web/src/styles.css` (`.theme-*`).

- [ ] **Step 1:** App: `const { sel, migrado } = acentoGuardado(S.cfg); if (migrado) { S.cfg.acento = sel; delete S.cfg.themeColor; saveCfg(); } aplicarAcento(sel);`
- [ ] **Step 2:** Ajustes: fila de 5 muestras `button[aria-pressed]` (presets) + muestra "Personalizado" con `<input type="color">` (toma el matiz; si se corrió, una línea lo dice); vista previa real con `.card`: eyebrow en `--accent`, cifra, barra, `.btn` con el degradado y chips de los tres estados.
- [ ] **Step 3:** `npx vitest run` verde. **Commit** `feat(color): elegir acento en Ajustes con presets y vista previa real`.

### Task 6: canvas, confeti, Lottie, foto

- [ ] `charts.ts`: `const t = tokensGrafico()` (lee `--accent`, `--accent-rgb`, `--text`, `--text-2`, `--text-3`, `--hi-rgb`) al empezar `drawChart`; `Chart.jsx` escucha `fierro:acento` y redibuja.
- [ ] `confetti.js`: colores = `--accent`, `--accent-strong`, `--ok`, `--flame`, `--text`.
- [ ] `PrBurst.jsx`: clona el JSON y cambia el azul `[0.184,0.49,1,1]` por el acento (y el dorado queda como `--flame`).
- [ ] `photo.js`: fondo = `leerToken('--bg')`.
- [ ] **Commit** `feat(color): gráfico, confeti y récord con el acento`.

### Task 7: mapa muscular por luminosidad del acento

- [ ] `Silhouette.jsx` / `BodyMini.jsx`: `<stop style={{ stopColor: 'var(--mapa-0-hi)' }}>`…; `sil-g3` (7+ días) queda en la familia ámbar de estado (`--mapa-3-*`), `sil-gn`/`sil-gne` en grafito neutro. Leyenda usa las mismas clases (no cambia).
- [ ] test en `leyenda-silueta.test.js`: ningún `stopColor="#…"` literal en los dos componentes.
- [ ] **Commit** `feat(color): mapa muscular derivado del acento`.

### Task 8: theme-color, manifest, íconos, favicon

- [ ] `index.html` `theme-color #101113` + `favicon.svg` = mancuerna de FIERRO en grafito; `vite.config.js` `background_color/theme_color #101113`; PNG 192/512 + maskable regenerados desde ese SVG con Chrome headless.
- [ ] **Commit** `feat(color): ícono y manifest en grafito`.

### Task 9: verificación en Chrome, documentación, publicación

- [ ] build + preview 4182, SW desregistrado, `seedRegistro()`; por preset: capturas 390×844 de Inicio, Hoy en vivo, Entreno, Progreso, Ajustes y 430×932 de Inicio y Hoy; script que recorre elementos visibles y reporta colores no derivados; `backdropFilter` en header/tabbar/hoja/tarjeta; contrastes reales.
- [ ] `HANDOFF.md` (entrada arriba) + spec: pieza 4 implementada. Commit `docs: ...`.
- [ ] `git fetch && git rebase origin/main`, `npm test`, `npm run lint`, `npm run build`, commit `build: publica base grafito y acento elegido`, push, `gh pr create --body-file`.
