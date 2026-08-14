# Look iOS moderno — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar una curva de movimiento "con resorte" a las entradas de superficies (sheets, pestañas, tarjetas de día, globo de estadísticas, beats de fin de sesión) y hacer que el vidrio esmerilado que `.card` ya tiene (pero que casi no se nota) sea visible en toda la app, sin tocar duraciones, colores ni la escala tipográfica.

**Architecture:** Dos cambios puramente de CSS (`web/src/styles.css`), sin tocar JSX ni lógica. Pieza 1 agrega un token `--spring` en `:root` y lo aplica reemplazando `var(--ease)` en un subconjunto específico de reglas de animación (sólo entradas — ver Global Constraints). Pieza 2 cambia el `background` de `.card`/`.card.hero` de un degradado con un tramo 100% opaco a uno uniformemente translúcido, dejando ver el `backdrop-filter` que la clase ya tiene.

**Tech Stack:** CSS puro (custom properties, `@keyframes`, `animation-timing-function` por keyframe-stop). React 19 + Vite ya montados, sin cambios de dependencias.

**Spec:** `docs/superpowers/specs/2026-08-14-look-ios-moderno-design.md` — incluye tres piezas originales; la Pieza 3 (tipografía/espaciado) se cerró **sin tarea** porque `.vtitle h1` (40px) y `.sect` (`margin:22px 2px 10px`) ya cumplen el objetivo de la maqueta. Este plan cubre sólo Piezas 1 y 2, con las correcciones técnicas ya aplicadas al spec (ver sección "Corrección post-spec" en cada pieza del documento).

## Global Constraints

- `--spring:cubic-bezier(.34,1.56,.64,1)` — mismo valor que ya usa `button:active` (`web/src/styles.css` línea ~24), no se inventa una curva nueva.
- **Spring sólo en entradas** (opacidad subiendo hacia 1, o transform puro sin opacidad): `shup`, `slideR`/`slideL`/`vin`, `dayArrive`/`dayBumped`/`dayLeft`, `mpop-in`/`mpop-in-up`, y sólo el tramo 0%→12% de `.sc-beat`.
- **Spring NUNCA en salidas con fade a menor opacidad** (`shdown`, `slideOutL`, `slideOutR`, el tramo 88%→100% de `.sc-beat`) ni en rellenos/progreso continuo (`railIn`, la barra de series, el anillo del descanso, `.tab-ind`): el rebote sobre una opacidad que baja se ve como un parpadeo, no como resorte físico.
- Ninguna duración cambia (siguen: 260ms pestañas, 220ms sheets, .52s tarjetas de día, .19s mpop, 700/700/1100ms los tres beats). Sólo cambia la curva.
- No se toca color ni degradado de marca — la traslucidez de `.card` usa el mismo rgb(12,19,34) que ya usa `--card`/la sombra existente, no un color nuevo.
- `npx vitest run` y `npm run lint` sin warnings nuevos antes de cada commit (baseline: 10 warnings).
- Verificación real en navegador (CDP) por tarea — nunca dar por bueno un cambio de CSS visual sin capturarlo corriendo.

---

### Task 1: Token `--spring` + entrada de sheets

**Files:**
- Modify: `web/src/styles.css:42` (agregar token en `:root`)
- Modify: `web/src/styles.css:1124` (`#sheet .panel` — animación de apertura)
- Modify: `web/src/styles.css:1142` (comentario desactualizado: dice "300ms" y `CIERRE_MS` ya es 220)

**Interfaces:**
- Produces: variable CSS `--spring` disponible globalmente para las Tasks 2 y 3.

- [ ] **Step 1: Agregar el token**

En `web/src/styles.css`, línea 42, junto a `--ease`:

```css
  --ease:cubic-bezier(.22,.9,.28,1);
  --spring:cubic-bezier(.34,1.56,.64,1);
```

- [ ] **Step 2: Aplicar spring a la apertura del sheet**

Cambiar (línea 1124):

```css
  animation:shup .22s cubic-bezier(.2,.8,.3,1);
```

por:

```css
  animation:shup .22s var(--spring);
```

`shdown` (línea 1135, `#sheet.closing .panel`) **no se toca** — sigue con `cubic-bezier(.2,.8,.3,1)` tal cual está (es la salida, ver Global Constraints).

- [ ] **Step 3: Corregir el comentario desactualizado**

En el bloque de comentario sobre `shdown` (alrededor de la línea 1142), cambiar:

```
translúcido y a medio bajar. Sheet.jsx igual mantiene #sheet.closing en
el DOM los 300ms de CIERRE_MS (ese timer es JS, no se acorta con la
```

por:

```
translúcido y a medio bajar. Sheet.jsx igual mantiene #sheet.closing en
el DOM los 220ms de CIERRE_MS (ese timer es JS, no se acorta con la
```

- [ ] **Step 4: Verificar en navegador (CDP)**

Con el dev server corriendo (`npm run dev` dentro de `web/`), abrir un sheet cualquiera (por ejemplo "Historial" desde Progreso) y, vía CDP, tomar 6-8 muestras de `getBoundingClientRect()` o `getComputedStyle().transform` del `#sheet .panel` durante los ~220ms posteriores al click que lo abre. Confirmar que la curva no es monótona (el panel debe pasar levemente MÁS ALLÁ de su posición final — `translateY` ligeramente negativo — antes de asentarse en `translateY(0)`), a diferencia de antes donde se acercaba sin pasarse. Cerrar el sheet y confirmar que el cierre (`shdown`) sigue viéndose igual que antes (sin rebote).

- [ ] **Step 5: Test suite y lint**

```bash
cd web && npx vitest run && npm run lint
```

Esperado: mismos resultados que el baseline (los tests no cubren CSS, así que deben seguir en verde; lint sin warnings nuevos).

- [ ] **Step 6: Commit**

```bash
git add web/src/styles.css
git commit -m "feat(spring): resorte en la apertura de sheets"
```

---

### Task 2: Spring en la transición de pestañas (sólo entrada)

**Files:**
- Modify: `web/src/styles.css:150-152` (`.view.enter.dir-r`, `.view.enter.dir-l`, `.view.enter>*`)

**Interfaces:**
- Consumes: `--spring` (Task 1).

- [ ] **Step 1: Aplicar spring a las tres reglas de entrada**

Cambiar (líneas 150-152):

```css
.view.enter.dir-r{animation:slideR .26s var(--ease)}
.view.enter.dir-l{animation:slideL .26s var(--ease)}
.view.enter>*{animation:vin .26s var(--ease) backwards}
```

por:

```css
.view.enter.dir-r{animation:slideR .26s var(--spring)}
.view.enter.dir-l{animation:slideL .26s var(--spring)}
.view.enter>*{animation:vin .26s var(--spring) backwards}
```

`.view.leave.dir-r`/`.view.leave.dir-l` (líneas 177-178, `slideOutL`/`slideOutR`) **no se tocan** — siguen con `var(--ease)` (salida con fade de opacidad, ver Global Constraints).

- [ ] **Step 2: Verificar en navegador (CDP)**

Cambiar de pestaña (por ejemplo Rutina → Progreso) y muestrear `getComputedStyle(document.querySelector('.view.enter')).transform` cada ~20ms durante los 260ms de la transición. Confirmar que la vista entrante pasa levemente más allá de `translate3d(0,0,0)` antes de asentarse (sobreimpulso visible en el eje X). Confirmar visualmente que la vista SALIENTE (`.view.leave`) no parpadea ni se ve distinta a como se veía antes de este cambio.

- [ ] **Step 3: Test suite y lint**

```bash
cd web && npx vitest run && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add web/src/styles.css
git commit -m "feat(spring): resorte en la pestaña entrante"
```

---

### Task 3: Spring en tarjetas de día, globo de estadísticas y beats de fin de sesión

**Files:**
- Modify: `web/src/styles.css:526,529,531` (`.card.day.fx-arrive`, `.fx-bumped`, `.fx-left`)
- Modify: `web/src/styles.css:1715` (`.mpop`)
- Modify: `web/src/styles.css:1933` (`@keyframes sc-beat`)

**Interfaces:**
- Consumes: `--spring` (Task 1).

- [ ] **Step 1: Tarjetas de día en Rutina**

Cambiar (líneas 526, 529, 531):

```css
.card.day.fx-arrive{animation:dayArrive .52s var(--ease)}
.card.day.fx-bumped{animation:dayBumped .52s var(--ease)}
.card.day.fx-left{animation:dayLeft .52s var(--ease)}
```

por:

```css
.card.day.fx-arrive{animation:dayArrive .52s var(--spring)}
.card.day.fx-bumped{animation:dayBumped .52s var(--spring)}
.card.day.fx-left{animation:dayLeft .52s var(--spring)}
```

- [ ] **Step 2: Globo de estadísticas del músculo**

Cambiar (línea 1715):

```css
  animation:mpop-in .19s var(--ease) both;
```

por:

```css
  animation:mpop-in .19s var(--spring) both;
```

(`.mpop.arriba{animation-name:mpop-in-up}` en la línea 1720 no necesita cambio propio: hereda `--spring` de esta misma regla `.mpop` por cascada, sólo redefine `animation-name`.)

- [ ] **Step 3: Entrada del primer tramo de `.sc-beat` (sin tocar la salida)**

`.sc-beat` usa un solo `@keyframes` para entrada Y salida con una sola curva (ver Global Constraints — no se puede reemplazar `var(--ease)` en la regla `.sc-beat` completa sin afectar la salida). En vez de eso, se declara `animation-timing-function` en el stop `0%` de `@keyframes sc-beat`, que sólo gobierna el tramo 0%→12%.

Cambiar (línea 1933):

```css
@keyframes sc-beat{0%{opacity:0;transform:scale(.94)}12%{opacity:1;transform:none}88%{opacity:1}100%{opacity:0;transform:scale(1.04)}}
```

por:

```css
@keyframes sc-beat{0%{opacity:0;transform:scale(.94);animation-timing-function:var(--spring)}12%{opacity:1;transform:none}88%{opacity:1}100%{opacity:0;transform:scale(1.04)}}
```

La regla `.sc-beat{animation:sc-beat var(--dur) var(--ease) forwards}` (línea 1931) no se toca — sigue siendo `--ease` la curva por defecto para el resto del timeline (sostenido y salida).

- [ ] **Step 4: Verificar en navegador (CDP)**

- Rutina: mover un día de la semana a otro (dispara `fx-bumped`/`fx-arrive`) y confirmar visualmente el rebote sutil en la tarjeta afectada.
- Hoy o Progreso: tocar una zona del cuerpo en la silueta para abrir el globo de estadísticas (`.mpop`) y confirmar que aparece con un leve sobreimpulso de escala.
- Completar una sesión de entrenamiento para llegar a `SessionComplete`; muestrear `getComputedStyle()` del primer beat (`.sc-beat.b1`) en los primeros ~200ms para confirmar el sobreimpulso de escala en la entrada, y luego observar el tramo 88%-100% (alrededor de los 2200-2400ms desde que empezó ese beat) para confirmar que la salida sigue sin parpadeo.

- [ ] **Step 5: Test suite y lint**

```bash
cd web && npx vitest run && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add web/src/styles.css
git commit -m "feat(spring): resorte en tarjetas de día, globo de músculo y entrada de los beats de fin de sesión"
```

---

### Task 4: Vidrio esmerilado visible en `.card` y `.card.hero`

**Files:**
- Modify: `web/src/styles.css:230-241` (`.card`, `.card.hero`)

**Interfaces:**
- Consumes: nada de las tasks anteriores (independiente).
- Produces: nada que otras tasks consuman.

- [ ] **Step 1: Fondo uniformemente translúcido en `.card`**

`.card` ya tiene `backdrop-filter:var(--glass-blur)` (`blur(22px) saturate(1.5)`, línea 234) — no se toca. El problema es que su `background` (línea 231) empieza 100% opaco, así que el blur no se ve arriba de la tarjeta. Cambiar:

```css
  background:linear-gradient(180deg,var(--card),rgba(12,19,34,.6));
```

por:

```css
  background:linear-gradient(180deg,rgba(12,19,34,.9),rgba(12,19,34,.74));
```

Mismo rgb (12,19,34, el de `--card`) en ambos extremos — sólo cambia que ahora los dos extremos son translúcidos en vez de uno opaco y uno al 60%.

- [ ] **Step 2: Fondo translúcido en `.card.hero`**

`.card.hero` (línea 238) pone `var(--card)` (100% opaco) como última capa del fondo, debajo de sus dos degradados de tinte — eso tapa su propio blur heredado por completo, y es la tarjeta más visible de la app (el hero de Hoy). Cambiar:

```css
  background:linear-gradient(158deg,rgba(37,64,232,.3),rgba(255,255,255,.03) 58%),var(--card);
```

por:

```css
  background:linear-gradient(158deg,rgba(37,64,232,.3),rgba(255,255,255,.03) 58%),rgba(12,19,34,.85);
```

- [ ] **Step 3: Verificar en navegador (CDP)**

- Capturar screenshot de Hoy (hero card) antes/después — confirmar que ahora se nota el blur del fondo detrás de la tarjeta (los halos de color de `body::before` deberían insinuarse a través).
- Capturar screenshot de Progreso con el historial de sesiones abierto (varias `.card` apiladas) antes/después — confirmar que el texto dentro de cada tarjeta sigue siendo legible (contraste suficiente) y que no hay lag perceptible al scrollear la lista (backdrop-filter ya corría antes sobre estas mismas tarjetas, así que no debería agregar costo de rendimiento nuevo — sólo confirmar que sigue siendo así).
- Si en la verificación visual `.card.hero` se ve demasiado transparente para leer sus números, subir la opacidad de `rgba(12,19,34,.85)` en pasos de `.05` hasta que se lea bien, y anotar el valor final usado.

- [ ] **Step 4: Test suite y lint**

```bash
cd web && npx vitest run && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add web/src/styles.css
git commit -m "fix(vidrio): fondo translúcido en .card y .card.hero para que el blur que ya tenían se note"
```

---

## Final Review

Después de las 4 tasks, revisión de rama completa (igual que en el plan de "sensación premium"): recorrer las cinco pantallas principales, confirmar que ningún resorte se ve en una salida (sin parpadeos), y que el vidrio de `.card` es consistente en todas las pantallas (Hoy, Rutina, Nutrición, Progreso).
