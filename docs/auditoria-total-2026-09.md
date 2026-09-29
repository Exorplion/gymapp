# Auditoría total — 2026-09-27

Pedido de Enzo (HANDOFF, "PENDIENTES AL 2026-09-27", punto 1): auditar lo
visual, las animaciones y la fluidez de **todas** las pantallas, en todos los
momentos. Este documento es el paso 5 del plan: **el informe va primero, los
arreglos después**, un PR por tanda. No se tocó código de la app.

## Cómo se hizo

- **Base:** `origin/main` = #123 (f499153), worktree `audit/total-2026-09`.
- **Build de producción** (`npx vite build` + `npx vite preview --port 4180`),
  nunca el dev server. Chrome vía MCP chrome-devtools, pestaña propia en un
  contexto aislado, emulando teléfono (touch, DPR 3) a **390×844** y
  **430×932**, con los datos de `seedRegistro()` cargados desde Ajustes.
- **Se midió, no se miró:** `getBoundingClientRect`, `getComputedStyle`,
  `document.getAnimations()`, muestreo por `requestAnimationFrame` de las
  entradas y salidas, y un medidor inyectado (texto < 12 px, controles < 40 px,
  cifras sin `tabular-nums`, títulos sin `text-wrap`, animaciones infinitas).
  Las acciones se dispararon con los botones del DOM.
- **Fluidez:** CPU frenada **6×**, **mediana de 5 corridas** por interacción,
  más trazas de rendimiento para atribuir el tiempo a funciones concretas
  (mapeadas del bundle minificado a su archivo fuente).
- **Checklists:** `ecc:make-interfaces-feel-better`, `ui-ux-pro-max`
  (pro-rules), `ecc:motion-foundations`, `accessibility` (WCAG 2.2),
  `ecc:react-performance`.
- **Se evitó repetir** lo ya arreglado o decidido en
  `docs/auditoria-visual-2026-09-26.md` (textos de 11 px como escala, tarjeta
  "Medidas", etc.).

**Zonas en rediseño (Enzo las rediseña aparte):** (a) hoja de "agregar
ejercicio" del editor, (b) la rampa `Rampa` de la tarjeta en vivo, (c) Hoy
con la sesión abierta antes de empezar el ejercicio. Ahí sólo se anotan bugs
objetivos, marcados **[zona en rediseño]**, sin propuesta de diseño.

**Ruido de medición a tener en cuenta:** en el perfil de Chrome usado corre un
script inyectado por una extensión (`connect` / `ws.onclose` / `setStatus`,
sin URL) que ocupa 50–110 ms cada ~250 ms bajo 6×. No es de la app; se
excluyó al atribuir tiempos en las trazas, pero infla el conteo de long tasks
en ventanas largas (se marca donde importa).

---

## Tabla resumen

| Severidad | Cantidad | IDs |
|---|---|---|
| **Alta** | 7 | G1, G2, G3, G4, I1, E1, B1 |
| **Media** | 17 | G5, G6, G7, G8, G9, G11, G17, H2, H4, H5, H7, E2, E3, E4, B3, A1, A2 |
| **Baja** | 22 | G10, G12, G13, G14, G16, I2, I3, I4, H3, H6, H8, H9, E5, E6, E7, C1, C2, P1, P2, P3, A3, M1 |
| **Zona en rediseño** (sólo bugs) | 3 | Z1, Z2, Z3 |

Por pantalla: Global 16 · Inicio 4 · Hoy / descanso / fin de sesión 8 ·
Entreno + editor + hojas 7 · Comida 2 · Progreso 3 · Tu cuerpo + ficha de
músculo 2 · Ajustes + Perfil + ficha de ejercicio 3 · Modo prueba 1 ·
zonas en rediseño 3. (Los IDs saltean números —G15, H1, B2— donde un hallazgo
se fusionó con otro: H1 quedó dentro de I1, B2 dentro de G11/G12.)

### Los 7 más graves, en una línea

1. **G1** — El build de producción borra el `backdrop-filter` no prefijado: en Chrome/Android no hay vidrio en header, barra, hojas, descanso ni tarjetas (medido `backdropFilter: none`, también en el sitio publicado).
2. **G2** — Todas las hojas aparecen con el 40 % ya en pantalla sin fundido, y al cerrar se congelan ~80 ms con 155 px de panel opaco y desaparecen de golpe.
3. **G3** — Durante cada descanso la app se re-renderiza entera 4 veces por segundo y repinta sin parar: el hilo principal queda ~80 % ocupado a 6×.
4. **G4** — Cambiar de pestaña bloquea 317–692 ms a 6× (20–32 fps en el deslizamiento); ~40 % es layout forzado por dos `useLayoutEffect`.
5. **I1** — Inicio dice "Completado · hoy" con una sesión de otro día de la semana (y Hoy dice "Toca hoy" al mismo tiempo): se reprodujo tres veces.

(Los otros dos altos: **E1** el chevron del turno abierto se ve "<" —regresión—
y **B1** la leyenda del mapa muscular no coincide con los colores del cuerpo.)

---

## Global (sistema de estilos, movimiento, build)

### G1 · ALTA · El build de producción elimina `backdrop-filter`

> **Arreglado** en `6aeedad` (tanda 1). Medido en el build: `backdropFilter` = `blur(14px)` en `header.top`, `blur(26px) saturate(1.6)` en `nav.tabbar`, `blur(22px) saturate(1.5)` en `.card`/`.ini-tile`, `blur(24px) saturate(1.5)` en `#sheet .panel`, `blur(18px) saturate(1.3)` en `#rest-fs`, a 390 y 430. Test: `__tests__/backdrop-build.test.js` construye el CSS con Vite + Tailwind y falla si una regla queda sólo con `-webkit-`.

- **Dónde:** `web/src/styles.css:411` (header), `:708`, `:1937` (tab bar),
  `:1999` (`#rest-fs`), `:2069` (`#sheet .panel`), `:2227`, `:2358`, `:2370`,
  `:2393`, `:3241`; `styles-coverflow.css:45-46`.
- **Evidencia:** las reglas escritas como `backdrop-filter:X;-webkit-backdrop-filter:X`
  salen del minificador **sólo** con `-webkit-backdrop-filter` (verificado en
  `web/dist/assets/index-*.css` y en el publicado `assets/index-BC7Fkk8N.css`).
  Chrome no reconoce el prefijo: `getComputedStyle(...).backdropFilter` da
  `none` en `header.top`, `nav.tabbar`, `#rest-fs`, `.card` y el panel de las
  hojas. Las dos reglas escritas sólo sin prefijo (`.reel-fine-backdrop` :820,
  `#sheet .bk` :2063) salen bien, con los dos. Efecto visible: el header
  (degradado .92→.75) deja leer el contenido que pasa por detrás ("79 CINTURA
  CM", "TU ENTRENAMIENTO" en Progreso); el descanso a pantalla completa deja
  leer "Press plano máquina" detrás de "DESCANSO".
- **Arreglo:** escribir sólo `backdrop-filter` (el build ya agrega el prefijo)
  en las 11 reglas, y un test que lea el CSS de `dist/` y falle si una regla
  tiene `-webkit-backdrop-filter` sin su par. **Ojo:** prender el blur de
  verdad cuesta GPU; re-medir G3/G4 después (el descanso a pantalla completa
  con blur de 18 px encima de una tarjeta que se re-renderiza es el caso caro).

### G2 · ALTA · Hojas: entrada y salida cortadas

- **Dónde:** `web/src/styles.css:2073` (`animation:shup var(--d2) var(--spring)`),
  `:2081` (`shup` desde `translateY(60%)`), `:2087-2090` (`shdown` a
  `translateY(60%)`, `ease-out`), `web/src/components/Sheet.jsx:4`
  (`CIERRE_MS = 220` escrito a mano).
- **Evidencia (Gimnasios, panel de 387 px, muestreo por frame):** apertura →
  el primer frame ya pinta el panel en `top 689` (155 px visibles, sin
  fundido), sube con rebote hasta 435 y asienta en 457. Cierre → llega a
  `top 689` a los ~150 ms por la curva `ease-out`, queda **quieto** hasta los
  231 ms con 155 px de panel opaco, y a los 232 ms desaparece en un frame.
  En una hoja alta (88dvh ≈ 742 px) el salto es de ~300 px.
- **Arreglo:** `shup`/`shdown` a `translateY(100%)`; salida más corta que la
  entrada (`--d1` con una curva de salida, no `ease-out`), y `CIERRE_MS`
  derivado de `D` (motion.js), no un número suelto. El rebote de `--spring`
  en la entrada puede quedar, pero desde fuera del marco.

> **Arreglado** en la tanda 2 (`6f5840f`, `a37cc97`, `7a7a383`, rama `fix/hojas-y-toques`). `shup` desde `translateY(100%)` en `--d3` con `--ease-push` + `fdin` en `--d1`; `shdown` a `translateY(100%)` y opacidad 0 en `--d2` con `--ease-push`; `CIERRE_MS = D.objeto`. Dos desvíos del arreglo propuesto: la salida va en `--d2` y no en `--d1` (sigue más corta que la entrada en `--d3`, pero ahora recorre el alto entero: hasta 742 px en 150 ms era un tirón), y la entrada va sin `--spring` (desde el 100 % el sobrepaso levantaba el borde de abajo y dejaba ver el fondo). Además: la hoja se desmonta con el `animationend` de su salida (el timer de CIERRE_MS arrancaba en el toque y, con el hilo ocupado, la animación empezaba ~150 ms después: cortaba con el panel al 19 %), y el cierre pasa por `useLayoutEffect` (con `useEffect` se pintaba un cuadro con la hoja en `display:none` antes de `shdown`). Medido cuadro a cuadro (390×844, Racha, 654 px): entra desde `top 844` con opacidad 0 → 0,98 a los 84 ms → asienta en 190 a los 317 ms sin rebote; sale de 190 → 844 con opacidad 0 a los 200–220 ms y se desmonta en el cuadro siguiente. Ajustes (743 px) y el diálogo de Terminar igual; a 430×932 idem (932 → 251).

### G3 · ALTA · El descanso re-renderiza la app 4×/s y repinta sin parar

- **Dónde:** `web/src/lib/rest.js:62` (`setInterval(tickRest, 250)`),
  `:123-130` (`tickRest` → `bump()` global),
  `web/src/components/RestTimer.jsx:74-77` (`animateRing` con dependencia
  `Math.round(pct*1000)`: arranca una animación nueva de 900 ms cada tick),
  `web/src/styles.css:679` + `:2008` (`glowring 2.4s infinite` anima
  `filter: drop-shadow`).
- **Evidencia (traza de 26,7 s con el descanso abierto, 6×):** React
  (`performWorkOnRoot`) 7,5 s, inactivo sólo 5,5 s; la tarjeta de ejercicio
  (`ExerciseCarousel`, componente de cada ejercicio) suma 1,06 s re-renderizándose.
  Por segundo: ~80–120 paints, Paint ~110 ms, Style ~90 ms, Layout ~75 ms.
  Apagando sólo `glowring` (estilo inyectado a mitad de traza) el Layerize baja
  de ~200 ms/s a ~40 ms/s. Cada `bump()` re-renderiza los 11 componentes con
  `useStore()` (App, Hoy, RestTimer, Toast, SessionComplete…).
- **Arreglo:** el reloj del descanso no pasa por el store global: un store
  propio para `T` (o `useSyncExternalStore` con selector) al que sólo se
  suscriben RestTimer y la barra; el texto se escribe cuando cambia el
  segundo, no cada 250 ms. El anillo: una sola transición CSS lineal de
  `stroke-dashoffset` con duración = tiempo restante (se reprograma sólo en
  ±30 s). El brillo: `opacity` de un pseudo-elemento con la sombra ya pintada,
  no `filter` animado.

> **Arreglado** en `7c989a3` + `7e97f7a` (tanda 3). El reloj tiene su propio canal (`suscribirReloj`, rest.js) y avisa una vez por segundo sólo al número y a la pill; `bump()` queda para los cambios de estado. El anillo es UNA animación por tramo (se reprograma sólo al arrancar, en ±30 s y al volver a la app) y la dibuja un worker en un OffscreenCanvas; el brillo es la opacidad de un `::before` con la sombra ya pintada. **Por qué worker y no una animación CSS/WAAPI:** medido a 6× con el mismo build, forzando el camino de respaldo (una sola animación WAAPI lineal de `stroke-dashoffset`): 60 % de hilo inactivo (74 → 47 % a lo largo de 30 s, Layerize 80 → 235 ms/s), contra 95 % con el worker — cualquier animación que no va en el compositor hace recorrer estilo + pintado + capas de la página entera en cada cuadro. Re-medido sobre main #127 (descanso a pantalla completa, 6×, mediana de 5 ventanas de 5 s): **hilo inactivo 48 % → 87 %**, script 93 → 24 ms/s, estilo 46 → 4, layout 35 → 8, paint 53 → 9, Layerize 154 → 30 ms/s, long tasks 0,2/s → 0, cuadros del hilo principal 52/s → 3/s; el compositor sigue a 57 fps. Visual: mismo anillo, degradado y geometría (capturas a 390 px, DPR 3); el aro del brillo quedó 1 px más angosto que el trazo por lado porque con los bordes justo encima aparecía una línea oscura.

### G4 · ALTA · Cambio de pestaña: 0,3–0,7 s de hilo bloqueado a 6×

- **Dónde:** `web/src/components/TabBar.jsx:47-53` (`useLayoutEffect` →
  `getBoundingClientRect` del botón activo), `web/src/App.jsx:362-370`
  (`useLayoutEffect` → `scrollHeight` de `.view.enter`/`.view.leave` para el
  `minHeight`), `web/src/lib/muscle.ts:147-150` (`catOf` normaliza el nombre
  con `normalize('NFD')` **antes** de mirar la caché).
- **Evidencia (mediana de 5, 6×):**

  | Destino | Handler | 1er paint | fps en la transición | Frame máx | Long tasks |
  |---|---|---|---|---|---|
  | → Entreno | 692 ms | 818 ms | 20 | 800 ms | 4 (máx 699) |
  | → Comida | 317 ms | 423 ms | 32 | 400 ms | 2 (máx 322) |
  | → Progreso | 409 ms | 492 ms | 22 | 483 ms | 3 (máx 411) |
  | → Inicio | 436 ms | 560 ms | 21 | 517 ms | 5 (máx 443) |

  En la traza del click a Entreno (1.339 ms bajo traza): 341 ms en el
  `getBoundingClientRect` de TabBar y 229 ms en el `scrollHeight` de App —dos
  layouts forzados seguidos, porque TabBar escribe `style.width/transform`
  entre medio— más `norm()` con 104 ms de tiempo propio (llamado miles de
  veces por `daysSinceAll()`, `muscle.ts:313-327`). Recalc de estilo 143–197 ms
  para ~1.100 elementos. El deslizamiento `pushIn` (320 ms) queda comido por un
  frame de 400–800 ms: se ve el salto, no el movimiento.
- **Arreglo:** (1) indicador de la barra sin medir: los botones son de ancho
  igual, `transform: translateX(calc(100% * var(--i)))`; (2) apilar las dos
  vistas en la misma celda de grid (`grid-area:1/1`) y sacar el `minHeight`
  medido; (3) `catOf`: caché por nombre crudo antes de normalizar (o categoría
  guardada en la entrada al registrar). Objetivo: < 200 ms a 6× en las cuatro.

> **Arreglado** en la tanda 4 (`82decc7`, `76c3573`, `b75acb2`, `ed275ed`, `759bed6`). Los tres arreglos propuestos, más tres cosas que aparecieron al medir:
> (1) la píldora de la barra se ubica con CSS (índice `--i` + ancho de la barra en `cqw`), sin `getBoundingClientRect`; coincide al medio píxel con el botón activo a 390, 430 y 900 px;
> (2) `main` es una grilla de una celda y las dos vistas del cambio van en esa celda: sin `min-height` medido, y con las posiciones de todos los elementos de las cuatro pestañas iguales a main en bloque;
> (3) `catOf` tiene caché por el nombre crudo, antes de normalizar, y `daysSinceAll` hace una sola pasada;
> (4) el gráfico de Progreso toma su tamaño del ResizeObserver en vez de leer `clientWidth` al montar (~200 ms de layout forzado) y `sessionPRs` junta los máximos en una sola pasada (~80 ms);
> (5) la pantalla que se va es la misma pantalla viva, con la misma key, no una copia del DOM (`sacarFoto`/`cloneNode`). Reinsertar la copia obligaba a recalcular estilo y layout de la pantalla vieja entera;
> (6) mientras se va, esa pantalla queda congelada: sus `useStore()` no ven el `bump()` del cambio (`PantallaCtx`, state.js). Antes redibujaba Progreso y su gráfico en el mismo cuadro.
>
> **Medido** (build de producción, 6×, 390×844 DPR 3, main #127 y esta rama trazadas una detrás de la otra, 5 vueltas de las cuatro pestañas, mediana):
>
> | Destino | 1er cuadro main → rama | Tarea más larga main → rama (CPU del hilo) | Recálculos forzados desde JS | fps del deslizamiento |
> |---|---|---|---|---|
> | → Entreno | 744 → **363 ms** | 628 → **191 ms** (171 → 70) | 5 → 0 | 43 → 48 |
> | → Comida | 448 → **165 ms** | 373 → **126 ms** (93 → 43) | 5 → 0 | 48 → 48 |
> | → Progreso | 571 → **305 ms** | 470 → **192 ms** (124 → 64) | 7 → 1 | 43 → 38 |
> | → Inicio | 733 → **298 ms** | 591 → **209 ms** (146 → 58) | 5 → 0 | 45 → 50 |
>
> La tarea más larga queda en 126–209 ms: se cumple el objetivo de < 200 ms, salvo Inicio, que queda en el borde. El deslizamiento lo dibuja el compositor y ya iba a 38–50 fps. Lo que cambia es el bloqueo antes del primer cuadro, que baja a la mitad o menos. Objetos de layout por cambio: Comida 1962 → 494, Inicio 1499 → 903. **Ruido**: la máquina tenía otros agentes con Chrome cargado (el hilo recibía ~30 % del CPU de pared); las columnas de pared varían ±40 % entre corridas. El CPU del hilo y los recálculos forzados son la parte estable. Queda: el recálculo de estilo de ~1.200–1.500 elementos al montar Entreno e Inicio (el tamaño de esas pantallas; ahí no hay nada forzado).

### G5 · MEDIA · El brillo que barre los botones anima `left` en loop

- **Dónde:** `web/src/styles.css:677` (`@keyframes sweep{…left:-60%…left:130%}`),
  `:733-737` (`.btn:not(.sm)…::after`, `3.2s infinite`).
- **Evidencia:** `getAnimations()` lo muestra corriendo en todas las pantallas
  con un `.btn` primario, también detrás de hojas abiertas (Mis rutinas,
  Ajustes, Agregar comida: 2 a la vez). `left` es propiedad de layout. Además
  el `::after` (40 % de ancho, degradado a 115°) deja un **borde vertical duro**
  (la esquina inferior izquierda no es transparente): visible en "ABRIR SESIÓN",
  "EMPEZAR ENTRENAMIENTO" y "✓ COMPLETAR Y GUARDAR".
- **Arreglo:** `transform: translateX()` en vez de `left`, degradado que
  arranque y termine transparente en todo el alto (90°, o máscara), y pausarlo
  cuando hay hoja abierta o limitarlo al CTA principal de la pantalla.

### G6 · MEDIA · `transition` sin propiedad (= `all`)

- **Dónde:** `web/src/styles.css:436` (`.icon-btn`), `:731` (`.btn`), `:1303`
  (`.carousel-dots i`), `:1820` (`.chev`), `:1950` (`nav.tabbar button`),
  `:1981` (`#restbar`), `:2137` (`#toast`).
- **Arreglo:** listar las propiedades (`transform, background-color,
  border-color, color, opacity`).

### G7 · MEDIA · Emoji y glifos de texto como íconos (~85 en 25 archivos)

- `web/src/components/Icon.jsx:3` dice que se migraron a SVG, pero quedan:
  `Rutina.jsx:222` 📚, `:241` 🏋, `:597` ✥; `Library.jsx:119` 💾;
  `Settings.jsx:391` 🧪, `:403`/`:438` ⬇, `:404`/`:452` ⬆; `Nutricion.jsx:135`
  👤, `:146` 🎯, `:229` 🥩, `:313` 🎙; `MealForm.jsx:113` 🔍 (en el
  placeholder); `SessionView.jsx:94` 🎉💪, `:116`/`:120`/`:233` 🏆;
  `SessionCard.jsx:34` 🏆; `Progreso.jsx:229` 🏆; `SessionComplete.jsx:38-40`;
  `ExerciseForm.jsx:263/417/440/688/711`; `Preworkout.jsx:74/79/86`;
  `Guide.jsx:17-25`; `Profile.jsx:92`. Se ven en "Mis rutinas", "Ver mis
  gimnasios", "Guardar la actual como…", "Calcular mis macros", el título
  "💪 Sesión guardada" y los botones de Ajustes.
- **Arreglo:** pasar cada uno a `Icon.jsx` (trazo 1.8, tamaños del sistema).
  Los ✓ ✕ ✎ de texto también.

### G8 · MEDIA · Casi ningún título tiene `text-wrap`

- **Evidencia:** en todo `styles.css` hay 2 `text-wrap:balance` y 1 `pretty`
  (`:2350`, `:2370`, `:2413`); 0 en JSX. `h1`, `h2` de las hojas, `.sect`,
  `.vtitle`, `.ini-title`, `.mpop-title` no lo tienen. Huérfanos vistos:
  "…88 series por / **ciclo**" (hero de Entreno), "…tocá un punto para ver las
  / **reps**" (gráfico de Progreso), "Rotación externa e interna con / banda".
- **Arreglo:** una regla base: `h1,h2,h3,.sect,.vtitle,[class*="-title"]
  {text-wrap:balance}` y `p,.s,.grouprow-s,.hint{text-wrap:pretty}`.

### G9 · MEDIA · Cifras que cambian sin `tabular-nums`

- **Evidencia (medidor):** `#streak-n` (racha del header), `.ini-tile-num`
  (Racha/Calorías), `.kr-n` "2236" (anillo de Comida), `.kcal-big` "170",
  macros "147/140", kcal por comida, `.session-ring-num` "0%", stats de la hoja
  de sesión (69 / 21 / 10 / 7653), `.calent-dosis`. Hay 33 usos en CSS; el
  resto de números vivos no los tiene.
- **Arreglo:** `font-variant-numeric: tabular-nums` en esas clases (o una
  utilidad `.num` que ya exista en el markup de listas).

### G10 · BAJA · Duraciones sueltas fuera de `--d1..--d4` / `D`

- **CSS:** `:398`/`:400` `.05s`, `:882` `.12s`, `:1309`/`:1314` `.26s`,
  `:1371-1376` `.52s` (`dayArrive/dayBumped/dayLeft`), `:1477` 45 ms,
  `:1673` 35 ms, `:2921` `.55s`, `:3496-3497` 650/1300 ms (beats), más los
  loops `:736` 3.2 s, `:2008` 2.4 s, `:2047` .9 s, `:3191` 2 s, `:3218` 5 s.
- **JS:** `Sheet.jsx:4` 220; `RestTimer.jsx:246` 0.12 s; `Nutricion.jsx:116`
  y `Progreso.jsx:78` 500; `SessionComplete.jsx:133-139` 600/700/800;
  `BodyMap.jsx:82` `rise .5s`; `StreakDetail.jsx:36` 8 ms;
  `AnimatedText.jsx:32`, `Inicio.jsx:53`, `RoutineWizard.jsx:69` 60;
  `motion.js` `animateRing` 900, `countTo` 600.
- **Arreglo:** mapear cada uno al paso que le corresponde; los loops y los
  beats de fin de sesión, como constantes con nombre al lado de `D`.

### G11 · MEDIA · Controles de menos de 40 px

| Control | Medido | Dónde |
|---|---|---|
| Botones del editor ↑ ↓ ✎ ✕ | 32×32, 5 px entre sí | `styles.css:1706` (`.ex-row .acts .mini`) |
| "i" del editor | 24×24 | `styles.css:1678` |
| Cerrar ficha de músculo | 20×20 (+4 px de `::after` = 28) | `styles.css:3082-3086` |
| Cerrar aviso "sesión anterior" | 26×26 | `styles.css:998` |
| Volver (Hoy) | 34×34 | `styles.css:3402` |
| Racha (header) | 59×35 | `styles.css:445` |
| Tus sesiones / Ajustes | 38×38 | `styles.css:432` |
| "Después" / "Saltar" (tarjeta en vivo) | 87×32 / 36×32 | `styles.css:1058` |
| Borrar serie (tabla) | 32×32 | ExerciseCarousel `TablaSeries` |
| Frente / Espalda | 67×25, 73×25 | `BodyMap.jsx` / `Silhouette.jsx:468+` |
| "¿Entrenaste el sáb 26?" | 354×38 | `styles.css:3330` |
| "Tu Año Fierro →" | 76×15 | `Inicio.jsx:262+` |
| Nombre del turno (editor) | 151×28 | `styles.css:3601` |
| Chips / segmentados (varios) | alto 38 | `.chip`, `.seg button` |

- **Arreglo:** `::after` con `inset` negativo hasta 44 px donde el dibujo deba
  quedar chico (sin que se pisen los vecinos), y alto 40–44 en los que no.


> **Arreglado** en la tanda 7 (CSS en `266a1e0`, ajustes en `7a7a383` y `dd9241b`). `::after` invisible con el inset justo, medido con `getBoundingClientRect` y `elementFromPoint` a 390×844 y 430×932 (Inicio, Entreno, editor, Comida, Progreso, la sesión en curso): **antes** 5 controles < 40 en Inicio, 5 en Entreno, 64 en el editor de un turno (↑↓✎✕ 32×32, "i" 24×24, fibras 32×36, nombre del turno 152×28), 7 en Comida, 11 en Progreso, 7 en Hoy, 14 en el pre-check (chips de 37 y "Ver cuánto tomar" 104×20), "i" de la tarjeta 26×26, cerrar del aviso 26×26, Después 86×32, borrar serie 32×32; **después** 0 en todas (el medidor marca "Tu Año Fierro →" como 84×28 porque no lee el `margin-top` del `::after`; `elementFromPoint` da 40 de alto). Sin pisarse: los ↑↓✎✕ pasaron a 8 px entre sí (40 de paso), las filas de la tabla de series a 40, "Ver cuánto tomar" a 12 px de los chips. La × de la ficha de músculo, 20 → 44. Frente/Espalda ya tenía 47 de alto.

### G12 · BAJA · Texto de menos de 12 px

- 22 usos de `--t-nano` (10 px) y 90 de `--t-micro` (11 px) en CSS, 39 en JSX.
  El 10 px aparece en la ficha de músculo (`.mpop-when`, "series",
  "Clavicular", "Tope…", "últimos 28 días"), el toggle Frente/Espalda
  (**10 px en un botón**), encabezados de la tabla de series, `.week-proj-cap`,
  `.ex-group-tag`. La escala de 11 px ya está anotada como decisión aparte en
  la auditoría del 26; lo nuevo acá es que **10 px** se usa en controles.
- **Arreglo:** ningún control ni etiqueta de dato en `--t-nano`; subir esos a
  `--t-micro` sin esperar la decisión de escala.

### G13 · BAJA · `letter-spacing` corre el texto centrado de los botones

- `.btn` usa `.09em` en mayúsculas: el espacio de la última letra queda
  adentro y el texto se corre ~1,3 px a la izquierda (2,64 px de tracking en
  "EMPEZAR ENTRENAMIENTO"). **Arreglo:** `padding-left` = el tracking, o
  `margin-right: -.09em` en el texto.

### G14 · BAJA · "−30S / +30S" en mayúsculas en el descanso

- El `.btn` del descanso a pantalla completa pasa la unidad a mayúscula; la
  barra minimizada dice "−30s". **Arreglo:** `text-transform:none` en esos dos.

> **Arreglado** en `adf6f83` (tanda 3): `.rfs-seg{text-transform:none}` → "−30s / +30s", igual que la barra.

### G16 · BAJA · `will-change` en cada slide del coverflow

- `styles-coverflow.css:24` promueve **todos** los slides (10 en Anterior A)
  a capa propia. Los de `.sil-zoom`/`.sil-flip` (`styles.css:2896`, `:2911`)
  están justificados. **Arreglo:** sólo al centro y a los dos vecinos.

> **Sin tocar** en la tanda 4: es el coverflow de ExerciseCarousel, que está en rediseño (fuera de alcance).

### G17 · MEDIA · Botones sin nombre accesible

- Editor de rutina: `data-act="ex-up"`, `ex-down` y `ex-info` sin
  `aria-label` (el lector dice "botón", 3 por ejercicio, 30 en un turno);
  el "i" además va con `opacity:.4` en línea pero sin `disabled`.
  Perfil y macros: los dos `input type=range` sin `<label>` ni `aria-label`.
- **Arreglo:** `aria-label="Subir {nombre}"` / "Bajar…" / "Qué trabaja…";
  `aria-labelledby` al texto "Proteína"/"Grasa" en los range.


> **Arreglado** en `6f5840f` (tanda 7): ↑ ↓ ⓘ del editor con `aria-label` "Subir/Bajar/Qué trabaja {nombre}"; el "i" sin ficha pasa de `opacity:.4` en línea a `.sin-ficha`. **Los range ya no aplicaba**: Perfil ya tenía `aria-labelledby` a "Proteína"/"Grasa" (tanda 1).

---

## Inicio

### I1 · ALTA · "Completado · hoy" con sesiones de otro día

> **Arreglado** en `d719200` (tanda 1), con una corrección al arreglo propuesto: "sesión *de ese turno* con `date === dstr()`" no alcanza, porque `completeSession` adelanta el puntero y el turno pendiente es siempre el SIGUIENTE — con ese criterio "Completado · hoy" no saldría nunca. `sesionDeHoy()` busca la sesión de hoy de cualquier turno y el título es el turno que se hizo. Medido: con el seed (última Anterior A el lun 21, hoy dom 27) Inicio dice "Dom 27 sep · Anterior A · ENTRENAR"; tras completar Anterior A, "Completado · hoy · Anterior A · 1 ejercicio".

- **Dónde:** `web/src/components/screens/Inicio.jsx:57` y `:106`;
  `web/src/lib/session.js:229-232` (`sessionForSlot` = cualquier sesión de ese
  turno **en la semana**).
- **Evidencia (tres veces):** (1) con el seed, Inicio mostraba "COMPLETADO ·
  HOY · Anterior A" y "Ver lo que hiciste" abría la del **Lun 21** (hoy Dom
  27); (2) después de completar Anterior A hoy, Inicio pasó a "Completado · hoy
  · **Posterior A**" (la del Mar 22) mientras Hoy decía "TOCA HOY · Posterior
  A"; (3) en modo prueba, "Completado · hoy · Posterior B · 81 min" era la del
  Vie 25. En uso real pasa cada vez que el ciclo vuelve al mismo turno dentro
  de la semana (5+ entrenos con 4 turnos, un split de 3 días, o entrenar sábado
  y domingo).
- **Arreglo:** "completado hoy" = sesión de ese turno con `date === dstr()`;
  si la de la semana no es de hoy, el estado es el de "toca entrenar". Test
  con una sesión del lunes y hoy domingo.

### I2 · BAJA · Alineación de las tarjetas de abajo

- Racha y "Más flojo" van centradas (`styles.css:3276`, `:3287`); Tu cuerpo,
  Calorías y Peso a la izquierda. El rótulo de Racha queda a 17 px del borde
  y el de "Más flojo" a 15 (2 px de escalón), y "Más flojo" cambia de centrado
  a izquierda según el estado (`.ini-tile-ok` vs `.ini-tile-stale`).
- **Arreglo:** todas a la izquierda, mismo `top` del rótulo.

### I3 · BAJA · Radios no concéntricos en la barra de pestañas

- `nav.tabbar` radio 26 con 7 px de padding; el botón activo radio 12
  (`styles.css:1925`, `:1950`). Concéntrico sería 19.

### I4 · BAJA · Cuatro formatos para "kg"

- "127042 kg movidos en total" (`Inicio.jsx:262`, `fmtNum` sin miles), "7653 KG
  VOL." (hoja de sesión), "6.85k kg movidos" (ficha de músculo),
  `toLocaleString('es')` en `SessionComplete.jsx:40`. **Arreglo:** un solo
  `fmtKg()` con separador de miles.

---

## Hoy · antes, durante, descanso y fin de sesión

### H2 · MEDIA · Descanso a pantalla completa: fondo que se trasluce y botón fuera de columna

- `#rest-fs` (`styles.css:1998-2000`) queda con fondo .94 y sin blur (G1): se
  lee la tarjeta de atrás encima de "DESCANSO". El minimizar `.rfs-min`
  (`styles.css:2039`, `right:-6px`) cae en x 343–381: 30 px fuera de la columna
  (termina en 351) y a 9 px del borde.
- **Arreglo:** con G1 resuelto, revisar si el .94 alcanza; alinear el botón al
  borde de la columna.

> **Arreglado** en `adf6f83` (tanda 3): `.rfs-min` a `right:24px` (el padding de la columna): termina donde termina "Saltar" (350 px a 390). El fondo que se traslucía ya no se lee con el blur de vuelta (G1): `#rest-fs` = `rgba(…,.94)` + `blur(18px) saturate(1.2)`.

### H3 · BAJA · Barra de descanso más ancha que la columna

- `#restbar` usa `left/right:12px` (`styles.css:1975-1981`); la barra de
  pestañas y el contenido, 18 px. Además tapa los puntos del carrusel.

> **Arreglado** en `adf6f83` (tanda 3): `#restbar` con `left/right: var(--pad-x)` y tope `520px − 2·pad-x`; medido 18–372 px a 390, igual que `nav.tabbar`. Lo de tapar los puntos del carrusel sigue (la barra flota sobre el contenido por diseño).

### H4 · MEDIA · Fin de sesión sin entrada ni salida, con destello al cerrar

- **Dónde:** `web/src/components/SessionComplete.jsx` (`cerrar()` a
  `DUR_TOTAL = 2400`), `styles.css:3483-3497`.
- **Evidencia (muestreo cada 150 ms):** tiempo 1 de 0 a 650 ms, 2 de 650 a
  1300, 3 de 1300 a 2400, y a los ~2450 ms `#session-complete` ya no existe.
  No tiene animación propia: aparece de golpe encima del diálogo que sale, y
  se desmonta en un frame mientras la hoja de la sesión recién arranca (`.bk`
  desde opacidad 0, panel desde 60 %): durante esos frames se ve la pantalla
  Hoy entera.
- **Arreglo:** fundido de entrada corto y, al cerrar, dejarla encima hasta que
  el fondo de la hoja llegó (o fundirla sobre la hoja ya abierta).


> **Arreglado** en `6f5840f` + `a37cc97` (tanda 2). `#session-complete` entra con `fdin` (`--d2`) sobre el diálogo que sale y, al cerrar, queda opaca `--d1` y se funde en `--d3` (`.saliendo`, `SALIDA_MS`), desmontándose con su `animationend`. Medido (390×844): fin de sesión 0 → 0,98 en 117 ms mientras `dlgOut` termina; al cerrar a los 2,4 s, opacidad 1 hasta que el `.bk` de la hoja llega a 1 (150 ms), después 0,99 → 0 en 300 ms con el panel ya subiendo; el `.bk` está en 1 todo el fundido: Hoy no se ve en ningún cuadro.

### H5 · MEDIA · El tiempo "cuerpo" queda casi negro en días Posterior

- `SessionComplete.jsx:153-160`, `:184-188`: la silueta es siempre de frente y
  no gira. En una sesión de Posterior (espalda, isquios, glúteo) no se enciende
  casi nada: la captura del tiempo 3 es una silueta oscura sobre negro durante
  1,1 s. **Arreglo:** mostrar la cara con más grupos trabajados.

### H6 · BAJA · Los números del resumen nunca se ven quietos

- `countTo(…, { duration: 800, delay: 650 })` (`SessionComplete.jsx:135-139`)
  termina a los 1450 ms, pero el tiempo 2 (`styles.css:3496`, 700 ms) empieza
  a fundirse a los ~1266 y es 0 a los 1350: se va mientras cuenta.
  **Arreglo:** conteo de ≤ 450 ms o beat más largo.

### H7 · MEDIA · Registrar una serie deja ~0,6 s de tirones

- **Evidencia (mediana de 5, 6×):** handler 17 ms y primer paint 66 ms (bien),
  pero en los 900 ms siguientes: 17 fps, frame máximo 233 ms, 5 long tasks que
  suman 581 ms (incluye el ruido de la extensión). En la traza, la tarea tras
  el toque dura 241 ms: ~120 ms de commit de React y **109 ms de layout
  forzado** en `reelCenter()` leyendo `offsetLeft`
  (`web/src/components/ReelPicker.jsx:77-81`, `useEffect` sobre `val`).
- **Arreglo:** `reelCenter` dentro de `requestAnimationFrame` y con la posición
  calculada del índice (ancho fijo de ítem), sin leer layout.
- **Saltar descanso:** handler 57 ms, primer paint 94 ms, 48 fps: bien.

> **Re-medido, sin arreglar** (tanda 4). En main #127 el layout forzado después de registrar una serie ya no lo inicia `reelCenter`: lo inicia primero el `useLayoutEffect` del carrusel (`ExerciseCarousel`, `clientWidth`, ~130 ms en 4 series a 6×), y `reelCenter` paga un segundo (~250 ms). Se probó mover `reelCenter` a un `requestAnimationFrame` y salió **peor**: en el cuadro siguiente la página ya cambió (se abrió el descanso) y el layout se vuelve a hacer entero (offsetLeft ~590 ms en las mismas 4 series). Se descartó y no está en el PR. El arreglo va junto con el carrusel, que está fuera de esta tanda (rampa/previa en rediseño): leer la geometría de la rueda en el mismo momento que el carrusel, o calcular `scrollLeft = índice × ancho del diente` sin leer.

### H8 · BAJA · Unidades partidas en el calentamiento

- `web/src/lib/warmup.ts:102-103`: "2 s de ida", "Pausa de 1 s" se parten
  entre renglones ("1 / s atrás"). **Arreglo:** espacio duro (` `).

### H9 · BAJA · Textos de la hoja al terminar

- "💪 Sesión guardada" (`SessionView.jsx:94`, emoji en el título) y abajo
  "GUARDAR Y CERRAR" cuando ya se guardó. **Arreglo:** "Listo" / "Cerrar".

---

## Entreno · plan, editor, Mis rutinas, gimnasios

### E1 · ALTA · El chevron del turno abierto se ve "<" (regresión)

> **Arreglado** en `60d3320` (tanda 1): glifo `›` fijo; lo gira sólo el CSS. Medido `matrix(0,1,-1,0)` sobre "›" → apunta abajo, a 390 y 430.

- **Dónde:** `web/src/components/screens/Rutina.jsx:608` (cambia el glifo a
  `⌄` al abrir) + `web/src/styles.css:2650` (`.day-card.open .day-head .chev`
  rota 90°). Medido `transform: matrix(0,1,-1,0)` sobre "⌄" → apunta a la
  izquierda. El comentario de `Rutina.jsx:585-593` describe exactamente este
  bug como arreglado; volvió con la regla de la línea 2650.
- **Arreglo:** un solo mecanismo: glifo fijo `›` rotado por CSS (o ícono SVG).

### E2 · MEDIA · La tarjeta de descanso no se alinea con los turnos

- `Rutina.jsx:565-568` usa `.day-head` suelto (padding 15 px 16 px,
  `styles.css:2626`); los turnos usan `.day-headrow` (`styles.css:1337-1338`,
  0 12 px + 14 px 0). Medido: número y nombre 4 px más a la derecha (x 35/88
  vs 31/84) y la fila 12 px más alta (83 vs 71). **Arreglo:** el mismo
  `.day-headrow` en las dos ramas.

### E3 · MEDIA · Editor: controles chicos y sin nombre

- Ver G11 y G17: cuatro botones de 32 px a 5 px entre sí (`styles.css:1706`),
  tres sin `aria-label`.


> **Arreglado** con G11 y G17 (tanda 7): 40×40 de toque, 8 px entre sí, los tres con nombre.

### E4 · MEDIA · "2×9" se lee "2.9"

> **Arreglado** en `14ae7ae` (tanda 1): `×` a `.65em` (16,9 px contra 26), `--mut`, 2 px de aire por lado y subida al centro de la cifra (centro de la × a 1 px del centro del dígito).

- `styles.css:1692-1697`: dígitos de 26 px y la `×` a 13 px en `--mut2`; a
  simple vista es un punto decimal. **Arreglo:** `×` al 60–70 % del tamaño del
  dígito, color `--mut`, con 2–3 px de aire.

### E5 · BAJA · "Mis rutinas" repite el mismo dato

- `Library.jsx:85`: "4 turnos de entrenamiento · 3 de descanso · 4
  entrenamientos y 3 descansos por ciclo". **Arreglo:** una sola de las dos.

### E6 · BAJA · Gimnasios vacío

- El texto habla de "las perillas" que no existen sin gimnasios; el vacío va en
  una píldora `r-full` distinta del resto de tarjetas; "Nuevo gimnasio" es un
  label Tailwind en minúscula mientras los demás subtítulos de hoja son `h3`
  azules en mayúscula. **Arreglo:** usar `.card` + `h3` como en las demás hojas.

### E7 · BAJA · Detalles del editor

- "‹ LISTO": un chevron de "volver" en el botón de confirmar; nombre del turno
  editable de 28 px de alto (`styles.css:3601`); el asa `✥` y la ayuda `↕`
  son glifos de texto (G7).

---

## Comida

### C1 · BAJA · "EXCEDENTE" y "Déficit moderado" en el mismo bloque

- `Nutricion.jsx:200` + `GOAL_LABEL` (`macros.ts:31`): "EXCEDENTE 170 kcal" y
  justo abajo "Déficit moderado · 74 kg". Es el objetivo, pero se lee como
  contradicción. **Arreglo:** "Objetivo: déficit moderado".

### C2 · BAJA · Agregar comida

- "Agregar" habilitado con la búsqueda vacía; placeholder con emoji; al tipear
  el panel pasa de 312 a 543 px de alto sin transición (el `sheetReveal` de los
  resultados corre, la hoja salta).


> **Arreglado** en `7d5aa61` (tanda 2): "Agregar" con `disabled` sin alimentos, placeholder "Buscá un alimento" y el panel anima su alto (D.objeto): medido 311 → 540 px en 200 ms en vez del salto de un cuadro.

---

## Progreso · historial · ficha de ejercicio

### P1 · BAJA · "1 series"

> **Arreglado** en `9358f98` (tanda 1): "1 serie · 333 kg de volumen" medido en Progreso; de paso Inicio decía "1 ejercicios".

- `SessionCard.jsx:43`: "1 series · 333 kg de volumen". **Arreglo:** plural.

### P2 · BAJA · Marcas del eje no redondas

- `lib/charts.ts:265-266`: el eje de Carga marca 54.3 / 56.4 / 58.6 / 60.7.
  **Arreglo:** pasos "lindos" (2,5 kg) o 1 decimal redondeado a 0,5.

### P3 · BAJA · Página de 5.053 px

- 25 PRs sin límite ni `content-visibility`. El scroll medido está bien (60 fps,
  0 frames > 33 ms), así que es de longitud, no de fluidez: "Ver todos" como en
  sesiones.

---

## Tu cuerpo · ficha de músculo

### B1 · ALTA · La leyenda no dice lo que pinta el cuerpo

> **Arreglado** en `d74f18c` (tanda 1): `TONOS` (Silhouette.jsx) es la única escala; `LeyendaTonos` pinta cada muestra con la misma clase de la zona (`fill: url(#sil-g0…g3)`, `url(#sil-gn)`): "hoy o ayer · 2-3 días · 4-6 días · hace 7+ días · sin registro".

- **Dónde:** `web/src/components/sheets/BodyMap.jsx:47-50` vs
  `web/src/components/Silhouette.jsx:498-510`.
- **Evidencia:** la leyenda dice ayer = cian, 2-3 d = azul, 4-6 d = celeste
  (#93C5FD), 7+ d = gris translúcido. El cuerpo pinta **hoy** en cian (no hay
  "hoy" en la leyenda), 4-6 d en azul oscuro (#2C4C86) y los grupos de 7+ días
  en **naranja** (#E39C43): Hombro, Abs y Tríceps a 10 días salen naranjas y
  nada lo explica.
- **Arreglo:** la leyenda se genera de los mismos degradados (`sil-g0..g3`,
  `sil-gn`), con "hoy/ayer", y el naranja nombrado ("hace una semana o más").

### B3 · MEDIA · Ficha de músculo

- Entra con `mpop-in` (`styles.css:3045`) pero se desmonta sin salida
  (`Silhouette.jsx:254`, `setSel(null)`), mientras el cuerpo sí sale con zoom.
  Cerrar mide 20 px (+4). Cinco textos a 10 px. La ficha (y 379–637) tapa el
  toggle Frente/Espalda (609–634) y se trasluce "FRENTE" por debajo.


> **Arreglado** en `6f5840f` + `a37cc97` (tanda 2): sale con `mpop-out` (`--d1`, más corta que la entrada), desmontada con su `animationend`; se sacó el `bloomOpen` de MusclePop, que anulaba `mpop-in`; × de 44; los cinco textos de 10 → 11 px; el toggle Frente/Espalda se apaga mientras la ficha está (y vuelve mientras sale). Medido: entra 395 → 379 con opacidad 0 → 1 en 220 ms; sale 379 → 395 y opacidad 0 a los 150 ms.

---

## Ajustes · Perfil y macros · ficha de ejercicio

### A1 · MEDIA · El objetivo se corta bajo la flecha del select

> **Arreglado** en `1bf3aa6` (tanda 1): `padding-right: 40px` y la opción dice sólo el nombre; lo que implica va debajo (`.field-hint`). Medido: la opción más larga mide 136 px en 294 útiles (390) y 334 (430).

- `styles.css:1911-1913` (`.field select` con `padding:14px` y la flecha en
  `calc(100% - 14px)`): "Déficit moderado — −300 kcal · ~0.25-0.3 kg/sem" mide
  379 px en 320 útiles: corre por debajo del chevron y se pierde "kg/sem".
  **Arreglo:** `padding-right: 40px` y textos de opción más cortos.

### A2 · MEDIA · Placeholders que parecen datos cargados

> **Arreglado** en `1bf3aa6` (tanda 1): "Ej. 24" / "Ej. 179" / "Ej. 74", y el recuadro dice "Sin edad, altura y peso no se puede calcular tu gasto diario ni tus macros."

- Perfil: Edad y Altura vacíos con placeholder "24" y "179" en gris; Peso "74"
  es valor real. Parece que están completos. Choca con el criterio de producto
  ("no inventa datos"). **Arreglo:** placeholder "—" o "Ej. 24", y avisar que
  sin esos datos el TDEE no se calcula.

### A3 · BAJA · Ajustes y ficha de ejercicio

- Los puntos de color (16 px, `<i>` dentro de `.theme-preview`) parecen
  opciones tocables y son sólo vista previa. Metas nutricionales sin unidad (g).
  `ExInfo.jsx:68` usa "puedes" en una app en voseo, y "set" por "serie"; los
  chips "Serie 1: RIR 1 / Serie 2: al fallo" parecen botones seleccionables.

---

## Modo prueba

### M1 · BAJA · Orden de botones distinto entre diálogos

- "Salir del modo prueba" y "Eliminar sesión": Cancelar | Acción. "Terminar la
  sesión": la acción primero y a todo el ancho. **Arreglo:** un solo orden.
  (La pastilla ámbar funciona; 36 px de alto, ver G11.)


> **Arreglado** en `6ae4d03` (tanda 7): una sola fila `.dlg-fila` en Confirmar, Terminar la sesión y Salir del modo prueba: salida segura a la izquierda, la que borra o sale a la derecha, la constructiva (si la hay) sola y a todo el ancho arriba. La pastilla ámbar: 42 de toque (G11).

---

## Zonas en rediseño — sólo bugs objetivos

- **Z1 [zona en rediseño, c]** Con la sesión abierta, la tarjeta del ejercicio
  (x 25–365) queda 7 px por lado más angosta que la barra de sesión (x 18–372)
  por el 88 % del coverflow; el CTA dice "EMPEZAR RUTINA" cuando lo que empieza
  es el ejercicio.
- **Z2 [zona en rediseño, b]** El aviso flotante de "sesión anterior" cae justo
  encima del encabezado de la rampa y lo tapa los 4 s que dura.
- **Z3 [zona en rediseño, a]** No se abrió la hoja de agregar ejercicio a
  propósito.

---

## Fluidez — todas las mediciones (build de producción, 6×, mediana de 5)

| Interacción | Handler | 1er paint | fps | Frame máx | Long tasks (suma) |
|---|---|---|---|---|---|
| Pestaña → Entreno | 692 ms | 818 ms | 20 | 800 ms | 4 (1017 ms) |
| Pestaña → Comida | 317 ms | 423 ms | 32 | 400 ms | 2 (419 ms) |
| Pestaña → Progreso | 409 ms | 492 ms | 22 | 483 ms | 3 (560 ms) |
| Pestaña → Inicio | 436 ms | 560 ms | 21 | 517 ms | 5 (723 ms) |
| Abrir Ajustes | 135 ms | 262 ms | 23 | 250 ms | 3 (409 ms) |
| Cerrar Ajustes | 121 ms | 172 ms | 27 | 166 ms | 3 (317 ms) |
| Abrir Mis rutinas | 106 ms | 180 ms | 48 | 167 ms | 2 (169 ms) |
| Registrar serie | 17 ms | 66 ms | 17 | 233 ms | 5 (581 ms)* |
| Saltar descanso | 57 ms | 94 ms | 48 | 83 ms | 1 (60 ms) |
| Scroll Progreso 0→3500 | — | — | 60 | 17 ms | 0 |

\* incluye tareas de la extensión (ver "Ruido de medición").

- **Descanso abierto (traza 26,7 s):** React 7,5 s, inactivo 5,5 s;
  80–120 paints/s; Layerize ~200 ms/s con `glowring`, ~40 ms/s sin (G3).
- **Arranque (1 corrida, traza con recarga):** LCP 5.038 ms a 6×, casi todo
  "render delay" (arranque de JS + IndexedDB); DCL 886–1.035 ms. Una sola
  medición: tomarlo como orden de magnitud.
- DOM de 1.832 elementos con las dos vistas montadas durante el cambio de
  pestaña; recalcular estilos cuesta 143–197 ms para ~1.100 elementos.

## Revisado y bien

- Ninguna pantalla desborda a lo ancho a 390 ni a 430 (lo único que pasa del
  borde es la fila de chips "Un toque", que es un scroll horizontal a propósito).
- Hoy con la sesión abierta entra en la pantalla (`scrollHeight` 844 a 390).
- Salidas que funcionan: descanso a pantalla completa (fundido de 220 ms,
  medido), barra de descanso (se funde en ~200 ms), diálogos (`dlgOut`), aviso.
- Scroll de listas largas: 60 fps sin frames lentos.
- `:focus-visible` global (`styles.css:370`) y regla de "reducir movimiento"
  (`styles.css:671`); `menosMovimiento()` en los helpers de motion.js.
- Las `will-change` de la silueta están justificadas.

---

## Tanda 1 — estado (2026-09-27, rama `fix/auditoria-tanda1`)

Arreglados: **G1, I1, E1, B1, A1, A2, E4, P1** (ver cada ID) y tres bugs del
relevamiento de orden que tienen la misma raíz, `76e296e`:

- **A.9** — las ↑↓ del editor swapeaban el índice guardado mientras la lista
  se pinta agrupada por músculo: "Aperturas" guardada 11ª y pintada 4ª no se
  movía y el aviso decía "Ejercicios reordenados". Ahora `moveEx` mueve dentro
  del grupo sobre la lista que se ve, las flechas se apagan en el borde del
  grupo y el aviso sólo sale si algo cambió. Medido: con "Pec deck" guardado
  último, el modo mirar lo numera 3 (antes 10), ↑ lo pasa a 2 y lo guardado
  queda igual a lo visto.
- **A.10** — `orderedExs` devuelve el orden por bloques antes de la sesión:
  la sesión arranca con la numeración de Plan de hoy (medido: "Pec deck",
  guardado último, sale 3º en el carrusel).
- **A.11** — `data-sort="hoy-blocks"` se había puesto para que `flipSort`
  animara las ▲▼ y el arrastre lo agarraba de rebote sin guardar. Ahora
  `commitSort` lo maneja (`ordenarBloques`), el arrastre siempre re-renderiza
  (numeración 1…10 correcta después de soltar) y los nodos se reinsertan en
  su lugar ("+ Agregar ejercicio" queda abajo).

Correcciones al informe: el arreglo propuesto para I1 no alcanzaba (ver I1).
El comentario de `blocksOf` ("no reordena nada") era falso y se corrigió: junta
también lo que está separado, y esa es la raíz de A.9/A.10.

Re-medición de G3 con el vidrio prendido (descanso a pantalla completa, 6×,
3 pares de 4 s alternando blur on/off con un estilo inyectado): el hilo
principal no cambia — 780/601/0 ms de long tasks con blur contra 762/0/0 sin
blur; el costo del descanso sigue siendo el re-render (G3), no el blur, que va
en el compositor.

## Tandas de arreglo propuestas (un PR por tanda, en este orden)

1. **Tanda 1 — Lo que miente o está roto** (bajo riesgo, alto impacto):
   G1 (backdrop-filter + test sobre `dist/`), I1 ("completado hoy"),
   E1 (chevron), B1 (leyenda), A1 (select), A2 (placeholders), E4 (×),
   P1 (plural). Verificar en navegador que el blur vuelve y re-medir G3.
2. **Tanda 2 — Hojas y salidas:** G2 (`shup`/`shdown` desde fuera del marco,
   salida más corta, `CIERRE_MS` desde `D`), H4 (entrada/salida del fin de
   sesión sin destello), B3 (salida de la ficha de músculo), C2 (la hoja crece
   con transición). Medir por frame como se hizo acá.
3. **Tanda 3 — Descanso liviano:** G3 (reloj fuera del store global, anillo con
   una transición, brillo por opacidad), H2, H3, G14. Criterio: con el descanso
   abierto, el hilo principal inactivo > 70 % a 6×.
4. **Tanda 4 — Cambio de pestaña y registro de serie:** G4 (indicador sin
   medir, vistas apiladas en grid, caché de `catOf` por nombre crudo), H7
   (`reelCenter` sin layout forzado), G16. Criterio: < 200 ms de handler a 6×
   en las cuatro pestañas y ≥ 45 fps en el deslizamiento.
5. **Tanda 5 — Movimiento con tokens:** G5 (sweep por `transform`, sin borde
   duro, sólo en el CTA principal), G6, G10, H5 (cara de espalda en días
   Posterior), H6.
6. **Tanda 6 — Tipografía y cifras:** G8 (`text-wrap` base), G9
   (`tabular-nums`), I4 (`fmtKg` único), G13, H8, G12 (nada de 10 px en
   controles).
7. **Tanda 7 — Toques y accesibilidad:** G11 (hit areas), G17 (nombres
   accesibles), E3, M1.
8. **Tanda 8 — Íconos y coherencia:** G7 (emoji → `Icon.jsx`), E2, I2, I3,
   E5, E6, E7, C1, H9, A3, P2, P3.

Las tandas 1 y 2 no dependen de ninguna otra. La 3 conviene después de la 1
(el blur cambia el costo del descanso). La 4 es independiente pero es la que
más se nota en la mano.

## Tanda 6 — estado (2026-09-29, rama `feat/visual-tipografia`)

Hecha junto con la tanda B de `auditoria-visual-2-2026-09.md` (mismo PR,
números y método ahí).

| ID | Estado | Qué |
|---|---|---|
| **G8** | ✅ | Regla base: `h1,h2,h3,.sect,.vtitle,.ini-title,.hero-day,.plan-title,.mpop-name,.rt-name,.grouprow-t,.nav-card .t{text-wrap:balance}` y `p,.s,.sub,.grouprow-s,…{text-wrap:pretty}`. "88 series por / ciclo" ya no existe (la hero es de tres cifras desde la tanda D). |
| **G9** | ✅ | `tabular-nums` en `.streak-n`, `.ini-tile-num`, `.kr-n`, `.kcal-big`, macros, `.slot-head`, `.session-ring-num`, `.calent-dosis`, historial, constancia, `.rir-seg b`, badges de día. Va al final de `styles.css`: los roles usan el atajo `font:`, que lo resetea. |
| **I4** | ✅ | `fmtKg()` / `fmtMiles()` en `lib/format.ts` (es-PE: "151,059 kg", "7,122 kg", punto decimal como el resto de la app, espacio duro). En Inicio, historial, ficha de músculo (era "6.85k kg"), resumen de sesión, fin de sesión, Año Fierro, riesgo de volumen. Tests en `format.test.js`. |
| **G13** | ✅ | `text-indent: var(--tr-control)` en `.btn`, CTA, segmentados, pestañas: el texto queda centrado (medido: "+ AGREGAR COMIDA" con 0,7 px de diferencia entre el centro del botón y el del texto, antes ~1,3 px corrido). |
| **H8** | ✅ | Espacios duros en las dosis y tiempos del calentamiento (`warmup.ts`: "2 × 12", "2 s", "1 s"). |
| **G12** | ✅ | El paso de 10 px (`--t-nano`, `text-nano`) no existe más: todo a 11 como mínimo, incluidos el toggle Frente/Espalda, la ficha de músculo, la tabla de series y las etiquetas de la previa. |
