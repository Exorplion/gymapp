# Unificación visual, parte 2 — cian de eyebrows, violeta de Rutina, gradientes en CTAs, C.line residual

Continúa sobre el cierre de "Unificación visual" (commit `85e758c`).
Resuelve los 4 pendientes que esa etapa dejó documentados a propósito,
a pedido explícito de Enzo ("haz todos los detalles visuales
pendientes").

## Contexto

La etapa anterior cerró con 4 puntos fuera de alcance, documentados en
`docs/superpowers/plans/2026-08-23-rn-unificacion-visual.md`:
1. Acento cian en eyebrows — usan `C.blue` en vez de `C.accent`/`C.cyan`.
2. Violeta de Rutina en tono equivocado — `#a78bfa` (violeta plano de
   Tailwind) en vez de la familia azul-violeta translúcida del original.
3. Gradientes en CTAs — botones primarios son color plano.
4. `C.line` (token de borde) usado como `backgroundColor` en el resto
   de la app (sheets, `MachineField.js`, `WarmupCard.js`, varias
   pantallas) — sólo se corrigió en los 2 archivos que la revisión
   anterior señaló explícitamente.

Se marcaron como "de mayor riesgo sin poder verificar en pantalla"
porque son restauración de lenguaje visual no portado, no corrección
de inconsistencias. Esa limitación de verificación visual sigue
vigente (sin dispositivo/emulador de este lado) — se implementan con
el mismo cuidado (transcribir del original, no inventar), documentando
que la verificación visual final la hace Enzo con la app corriendo
(Expo Go / web).

## Rulings

Ruling: **eyebrows → `C.accent`** (`#7FD1FF`, ya existe en `theme.js`)
en vez de `C.blue`. Aplica a todo texto/etiqueta identificado como
"eyebrow" (label pequeño en mayúsculas/tracking ancho sobre un hero) —
grep de `letterSpacing` alto + `fontSize` pequeño para encontrarlos
todos, no sólo los ya vistos en el survey.

Ruling: **violeta de Rutina** — reemplazar `#a78bfa` por la familia
azul-violeta translúcida del original
(`web/src/styles.css` — buscar el valor exacto usado para Rutina,
probablemente algo como `rgba(108,92,255,.24)` sobre `C.card` con
borde `rgba(140,150,255,.22)`, confirmar leyendo el CSS, no asumir el
valor citado en el survey de memoria). Si el valor no está en
`theme.js` como token con nombre, agregarlo a `theme.js` (ej.
`C.violet`/`C.violetLine`) en vez de dejarlo suelto en `Rutina.js` —
mantiene el principio de "todo en theme.js" del resto de la etapa.

Ruling: **gradientes en CTAs** — usar `expo-linear-gradient` (ya
instalado, usado en `Silhouette.js`/`BodyMini.js`/`RestTimer.js`/
`Nutricion.js`) para los botones primarios. Confirmar en el CSS
original los stops exactos de `--grad`/`--grad2` antes de aplicar — no
inventar un gradiente "similar". Aplica a los CTAs principales de las
5 pantallas de tabs (botón "Empezar entrenamiento", "+ Registro", "+
Agregar comida", etc.) — grep de `backgroundColor: C.blue` en botones
para encontrar todos los candidatos reales.

Ruling: **`C.line` residual** — reemplazar `backgroundColor: C.line`
por `C.card2`/`C.bg2` (según nivel de superficie) en TODOS los
archivos listados por el re-review anterior:
`native/src/components/sheets/*.js` (Settings, MealForm,
CopyExercises, Profile, ExerciseForm, SessionView, VoiceLog, y
cualquier otro que el grep encuentre), `MachineField.js`,
`WarmupCard.js`, y las pantallas (`Hoy.js`, `Rutina.js`, `Library.js`,
`Progreso.js`, `Nutricion.js`). Mismo criterio que la vez anterior:
`C.line` queda sólo para `borderColor`; si un mismo literal cumplía 2
roles distintos en un archivo, documentar y decidir caso por caso, no
forzar.

Ruling: jest se mantiene igual — etapa 100% visual, sin lógica nueva
testeable.

## Tabla cruzada

| Task | Toca | Independiente de |
|---|---|---|
| 1 (eyebrows → C.accent) | grep amplio, texto pequeño con tracking | Tasks 2-4 |
| 2 (violeta de Rutina) | `Rutina.js`, `theme.js` (agrega token) | Tasks 1,3,4 salvo que Task 4 también toque `Rutina.js` (mismo archivo, correr después) |
| 3 (gradientes en CTAs) | 5 pantallas de tabs + `theme.js` si hace falta token de stops | Tasks 1,2 |
| 4 (C.line residual) | sheets + `MachineField.js`/`WarmupCard.js` + pantallas | Tasks 1,3 salvo `Rutina.js` (correr después de Task 2 si coincide) |

Orden: 1 y 3 en paralelo (no chocan). Luego 2. Luego 4 (toca el
directorio de sheets completo, más ancho, al final para evitar
conflictos de merge con las otras 3).

## Task 1: eyebrows → `C.accent`

**Files:** Modify las pantallas/componentes con estilo "eyebrow"
(`Hoy.js`, `Inicio.js`, y cualquier otro que el grep encuentre).

- [x] **Step 1**: Grep de `letterSpacing` alto (≥0.15) combinado con
  `fontSize` pequeño (11-13) en `native/src/` para encontrar todos los
  estilos "eyebrow", no sólo los 2 ya vistos.

- [x] **Step 2**: Cambiar su `color` de `C.blue` a `C.accent` en cada
  uno.

- [x] **Step 3: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 4: Commit**

```bash
cd native && git add -A && git commit -m "style(rn): restaurar acento cian en eyebrows (C.accent en vez de C.blue)"
```

Resultado (commit `9ba2998`): sólo 2 eyebrows encontrados con
`color: C.blue` — `Hoy.js:327` e `Inicio.js:84`. El resto de labels con
tracking ancho ya usaban `C.mut` u otro color no relacionado; no se
tocaron. expo-doctor 21/21, export limpio.

---

## Task 2: violeta correcto de Rutina

**Files:** Modify `native/src/screens/Rutina.js`, `native/src/theme.js`

- [x] **Step 1**: Leer `web/src/styles.css` para encontrar el valor
  EXACTO del violeta de Rutina (buscar comentario "Hoy azul, Rutina
  violeta" o el selector correspondiente a la pantalla de rutina) — no
  asumir el valor citado de memoria en el survey.

- [x] **Step 2**: Agregar el token a `theme.js` (ej.
  `C.violet`/`C.violetLine`) con el valor exacto encontrado.

- [x] **Step 3**: Reemplazar `#a78bfa` (y cualquier variante) en
  `Rutina.js` por el token nuevo.

- [x] **Step 4: Verificar** (mismo patrón).

- [x] **Step 5: Commit**

```bash
cd native && git add -A && git commit -m "style(rn): corregir violeta de Rutina a la familia azul-violeta translúcida del original"
```

Resultado (commit `a2e8de1`): valor exacto transcrito de
`web/src/styles.css:1372-1374` (`.card.hero.hero-plan`, comentario en
1370-1371 "Hoy azul, Rutina violeta"):
`background:linear-gradient(158deg,rgba(108,92,255,.24),rgba(255,255,255,.03) 60%),var(--card)`
y `border-color:rgba(140,150,255,.22)`. El CSS no ofrece un tono plano
equivalente para eyebrow/barra activa/badge (esos elementos genéricos
—`.hero-eyebrow`, `.weekbars .wbar.on .b`, `.day-badge`— son azules en
el original, compartidos con Hoy, no violetas), así que se agregaron 3
tokens a `theme.js`: `C.violetBg` (`rgba(108,92,255,.24)`, fondo del
hero) y `C.violetLine` (`rgba(140,150,255,.22)`, borde del hero,
reemplaza el `rgba(139,92,246,.25)` inline que ya traía `heroCard` —
mismo matiz, valor corregido al exacto del CSS) — ambos transcritos
literales — más `C.violet` (`#6C5CFF`, versión sólida del mismo
rgb(108,92,255), documentada en el propio `theme.js` como extensión
razonada, no transcripción literal) para los 3 usos que en `Rutina.js`
necesitaban un color plano legible (`heroEyebrow`, `wbarOn`,
`dayBadge`) donde el CSS original no da uno. jest 376/376, expo-doctor
21/21, `expo export --platform android` limpio.

---

## Task 3: gradientes en CTAs

**Files:** Modify botones primarios de `Hoy.js`, `Inicio.js`,
`Progreso.js`, `Rutina.js`, `Nutricion.js` (y `theme.js` si se agrega
un token de stops).

- [x] **Step 1**: Leer `web/src/styles.css` para los stops exactos de
  `--grad`/`--grad2` (colores y ángulo/dirección).

- [x] **Step 2**: Grep de `backgroundColor: C.blue` en botones/CTAs de
  las 5 pantallas para identificar todos los candidatos reales
  (excluir usos de `C.blue` que no sean CTA primario, ej. tints de
  ícono).

- [x] **Step 3**: Envolver cada CTA en gradiente, manteniendo el resto
  del estilo (padding, radio, texto) igual — ver nota abajo, se usó
  `react-native-svg` en vez de `LinearGradient` de `expo-linear-gradient`
  (no instalado).

- [x] **Step 4: Verificar** (mismo patrón).

- [x] **Step 5: Commit**

```bash
cd native && git add -A && git commit -m "style(rn): aplicar gradiente a los CTAs primarios (antes color plano)"
```

Resultado (commit `22343b3`): no había `expo-linear-gradient` instalado
pese a lo que asumía el plan — se implementó `GradientButton.js` con
`react-native-svg` (ya usado para gradientes en `Silhouette.js`/
`BodyMini.js`/`RestTimer.js`), mismo patrón, documentado en el propio
archivo. Stops transcritos de `web/src/styles.css:23`
(`--grad2:linear-gradient(112deg,#4FA8FF 0%,#22D3EE 58%,#7FD1FF 100%)`),
agregados como `GRAD_PRIMARY` en `theme.js`. Se identificaron y
convirtieron 4 CTAs reales (no sólo 2): "Ir a Hoy"/CTA de Inicio,
"Empezar entrenamiento"/"Abrir sesión" en `Hoy.js`, "Iniciar
ejercicio"/"Terminé la serie" en `ExerciseList.js` — todos mapean al
`.btn` genérico del CSS original que usa `--grad2` como fondo por
defecto. `addBtn` (ícono "+" circular en Progreso.js) y `pbarFill`
(barra de progreso) se dejaron sin tocar a propósito — no son botones
`.btn`, son afordancias compactas/decorativas. El agente implementador
original falló a mitad de camino por límite de sesión de API antes de
verificar/commitear; el trabajo en disco (theme.js, GradientButton.js,
Inicio.js) era genuino y se completó el resto (Hoy.js, ExerciseList.js)
directamente. jest 376/376, expo-doctor 21/21, export limpio.

---

## Task 4: `C.line` residual (backgroundColor → C.card2/C.bg2)

**Files:** Modify todos los sheets de
`native/src/components/sheets/*.js`, `MachineField.js`,
`WarmupCard.js`, y pantallas (`Hoy.js`, `Rutina.js`, `Library.js`,
`Progreso.js`, `Nutricion.js`) — correr DESPUÉS de Task 2 si ambas
tocan `Rutina.js`.

- [ ] **Step 1**: Grep de `backgroundColor: C.line` (o el nombre real
  de la variable importada) en todo `native/src/` para el inventario
  completo.

- [ ] **Step 2**: Archivo por archivo, reemplazar por `C.card2`
  (superficie de card sobre fondo) o `C.bg2` (superficie de fondo
  secundario) según el nivel de anidamiento visual del elemento —
  mismo criterio aplicado en `ExerciseList.js`/`IllusPick.js` la etapa
  anterior. Documentar cualquier caso ambiguo sin forzar.

- [ ] **Step 3**: Grep de verificación — cero `backgroundColor: C.line`
  sueltos fuera de excepciones documentadas.

- [ ] **Step 4: Verificar**

Run: `cd native && npx jest` → sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [ ] **Step 5: Commit**

```bash
cd native && git add -A && git commit -m "style(rn): corregir C.line usado como fondo en el resto de la app (sheets, WarmupCard, MachineField, pantallas)"
```

---

## Revisión final de la etapa

- [ ] `cd native && npx jest` — sin cambios (376).
- [ ] `cd native && npx expo-doctor` — sin errores.
- [ ] Bundler de Metro compila sin error.
- [ ] `web/` sin ningún archivo modificado.
- [ ] Eyebrows usan `C.accent`, no `C.blue`, en todos los sitios
  encontrados por el grep (no sólo los 2 originales del survey).
- [ ] Violeta de Rutina transcrito del CSS real, no del valor citado de
  memoria en el survey — confirmar con cita de línea del CSS.
- [ ] Gradiente de CTAs con los stops exactos del original, no
  inventados.
- [ ] Cero `backgroundColor: C.line` sueltos fuera de excepciones
  documentadas.
- [ ] Nota explícita en el cierre: esta etapa restaura lenguaje visual
  no verificado en pantalla real — Enzo debe confirmar visualmente con
  la app corriendo (Expo Go / web) antes de darla por definitiva.
