# Rediseño: agregar ejercicio, rampa, previa del ejercicio y color

**Fecha:** 2026-09-27 · **Estado:** diseño aprobado por Enzo en maquetas
(`.superpowers/brainstorm/177766-1790562557/content/01..04`), pendiente de
revisión de este documento.

Cuatro piezas independientes. Cada una es su propio plan y su propio PR.
Base de evidencia: relevamientos del 2026-09-27 (zonas A/B/C y sistema de
color) y `docs/auditoria-total-2026-09.md`.

Reglas que valen para las cuatro (de `CLAUDE.md` y memoria del proyecto):
patrones visuales existentes (`.card`, `.nav-card`, `.chip`, tipografía
condensada del héroe), duraciones sólo con `--d1..--d4` / `D`,
`menosMovimiento()` para reducir movimiento, `vibrate()` de `lib/format.ts`
para háptica, hit areas ≥ 40 px, `tabular-nums` en cifras, y verificación en
Chrome con build de producción a 390×844 y 430×932, **sin scroll** donde se
dice "una pantalla".

---

## 1 · Agregar ejercicio: asistente en 3 pasos

> **Implementada el 2026-09-28** en la rama `feat/asistente-agregar` (plan
> `docs/superpowers/plans/2026-09-27-asistente-agregar-ejercicio.md`).
> Decisiones al implementar: 3×10 por defecto y el rango de la doble
> progresión (10–13); los 7 `EQUIP` reales + "Otro" con íconos SVG propios;
> en la rutina el nuevo sólo se suelta donde se queda (su bloque, o un borde
> entre bloques), en la sesión es libre; "Cambiar ejercicio" sigue en
> `SessionExercise.jsx`; al agregar, el toast "<nombre> agregado" ofrece
> "Agregar otro" (reabre en el paso 1, mismo contexto). A 390×844 el paso 2
> muestra el nuevo ±3; a 430×932, ±4.

### Problema

Hay dos flujos distintos para lo mismo. En el editor de rutina,
`ExerciseForm.jsx` + `lib/exercise-wizard.js` son 4 pasos, y el paso 2 es un
formulario de 1088 px en 742 visibles. El paso 3 muestra siempre 10 chips de
grupo. Con la sesión abierta, `SessionExercise.jsx` es una hoja de 1376 px
con un chip "Después de X" por cada ejercicio, también los ya hechos, y su
subtítulo dice "Se suma al final" aunque se elija otro lugar.

### Diseño

Un componente nuevo, **`AgregarEjercicio`**, a pantalla completa y sin
scroll. Lo usan los dos contextos:

- **Rutina** (Entreno → turno → "+ Agregar ejercicio", y Plan de hoy en
  modo edición). Guarda en la rutina; reemplaza el modo *agregar* de
  `ExerciseForm`. El modo *editar* de `ExerciseForm` se queda y es donde
  viven los campos avanzados.
- **Sesión** (··· → Agregar ejercicio). Reemplaza a `SessionExercise.jsx`.
  Guarda con `addSessionExercise` (sólo hoy); `pinAddedToRoutine` al cerrar
  no cambia.

Arriba lleva una barra de progreso de 3 segmentos, "✕" en el paso 1 y "‹" en
los siguientes. El título de cada paso va en la condensada itálica del
héroe (`.plan-title`). El CTA es la píldora con degradado, siempre al pie.

**Paso 1 · ¿Qué ejercicio?** Tiene un campo con autocompletado del catálogo,
una fila "Te falta hoy · <grupo>" con sugerencias de los grupos menos
trabajados en ese turno, y chips de grupo para explorar el catálogo. El
grupo muscular se deduce del nombre con la detección que ya existe en
`exercise-wizard.js`. **Desaparece el paso "confirmar grupo"**: sólo si la
detección falla aparece, en este mismo paso, una fila de chips de grupo.

**Paso 2 · ¿Dónde va?** Muestra la lista del turno (en la rutina) o de la
sesión (con sesión abierta). El ejercicio nuevo ya aparece **insertado en
el lugar sugerido**, iluminado (borde y halo del acento, `scale(1.02)`):
después del último ejercicio de su mismo grupo o bloque (`porBloques()`,
`muscle.ts`), y si no hay, al final. Encima, una línea explica la
sugerencia ("Sugerido: con la otra espalda, después de Jalón"). Se reordena
con el arrastre que ya existe (`lib/drag.js`: long-press, FLIP y vibración),
con ▲▼ como alternativa accesible. En la sesión, los ya hechos van arriba,
apagados y fijos. Si la lista no entra, se muestran el nuevo ±3 y un
"+N más" plegado, para que el paso siga sin scroll.

**Paso 3 · ¿Cómo lo hacés?** Tiene dos steppers grandes, Series y Reps, con
un rango de reps como el que ya usa la rutina. Debajo, una grilla de 8
equipos con **íconos SVG** del set de la app, no emoji (hallazgo G7 de la
auditoría), y el interruptor Unilateral con la explicación "un lado por vez".
El CTA dice "Agregar a la rutina" o "Agregar a la sesión"; en la sesión se
suma la línea "Vale sólo para hoy". Peso de partida, máquina/placas, foto
e ilustración **salen del asistente**: se cargan después desde editar.

**Movimiento.** Los pasos se deslizan en horizontal (`--ease-push`,
`D.panel`) y "‹" desliza en sentido inverso. Los segmentos de la barra se
llenan con `D.objeto`. Los botones hacen press con `scale(.96)`. El
asistente entra y sale como hoja (patrón `Sheet`), con salida más corta.

**Persistencia.** Rutina: `saveExercise` (`rutina-logic.js`) más el índice
elegido; hoy siempre empuja al final. Sesión: `addSessionExercise`
(`session.js`) con la posición elegida en `draft.order`.

**Criterio de aprobación.** Los tres pasos, en los dos contextos, entran sin
scroll a 390×844 y 430×932. El ejercicio queda donde se lo dejó: en la
rutina y en el orden de la sesión (lo verifica un test de lógica). Además,
el arrastre y los botones ▲▼ funcionan (verificado en Chrome), y el foco y
los nombres accesibles están en cada control.

---

## 2 · Rampa de aproximación: un solo botón que avanza

> **Implementada el 2026-09-28** en la rama `feat/rampa-previa` (plan
> `docs/superpowers/plans/2026-09-27-rampa-y-previa.md`), junto con la §3.
> Decisiones tomadas al implementar: los pasos hechos llevan el ✓ ámbar
> (no verde: el verde queda para la serie de verdad); "Saltar" desaparece al
> completar; si la app se recarga con la rampa completa y sin marcar, se
> marca sin animación y sin descanso (ese descanso ya pasó); si la serie se
> registra mientras la rampa se pliega, el bloque igual queda calentado.

### Problema

El paso activo de `Rampa` (`ExerciseCarousel.jsx`) se distingue sólo por un
halo ámbar al 16 %, no hay háptica, y tocar el 90 % marca los tres pasos sin
deshacer. La línea de progreso no se mueve con el primer paso. Al completar
la rampa desaparece en menos de 120 ms, antes de que se vea el ✓, y la
tarjeta se achica de golpe de 510 a 392 px. "Saltar" mide 36×32 y los
pesos van sin unidad.

### Diseño (maqueta 02, opción B)

- **El botón grande de la tarjeta (`.btn-serie`) hace la rampa.** Mientras
  quedan aproximaciones, va en variante ámbar y dice "APROX. 50 % LISTA",
  con el valor "25 kg × 5" a la derecha. Cada toque avanza un paso y vibra
  (`vibrate()`). Después de la tercera se transforma en el verde
  "SERIE 1 LISTA" de siempre. El pulgar va siempre al mismo lugar.
- **Los círculos muestran el avance.** El activo late (escala 1 → 1.07) con
  un anillo que se expande y se desvanece; son dos anillos desfasados en un
  ciclo de ~1.6 s. Con `menosMovimiento()` queda un anillo fijo. Cada paso
  hecho muestra un ✓ con pop (`D.objeto`) y la línea se llena hasta el
  siguiente círculo (`D.momento`): 0 → 50 % → 100 %.
- **Tocar un ✓ lo deshace** y vuelve a ese paso. Tocar un paso futuro
  sacude el activo (pista de "primero este"). "Saltar" pasa a tener
  ≥ 40 px de hit area. Los pesos llevan unidad.
- **Al completar**, el tercer ✓ se ve, aparece la línea "Aproximación
  completa · ahora la serie efectiva" y la rampa se pliega por altura
  (`grid-template-rows`, `D.panel`). Recién después entra el descanso,
  que se queda como está.
- **El avance se persiste** en el borrador de la sesión (hoy vive en
  memoria, `pasosRampa`, y se pierde al recargar).

**Criterio de aprobación.** Estados verificados en Chrome: paso 1, 2 y 3
activos, deshacer y completa. Con `getAnimations()` se ve que el pulso
corre sólo en el activo y que no hay animación de `filter` en loop. Con la
tarjeta desplegada y la rampa, todo entra sin scroll a 390×844. Los tests
cubren la lógica de avance y deshacer.

---

## 3 · Previa del ejercicio (el espacio vacío)

> **Implementada el 2026-09-28** en `feat/rampa-previa`. Decisiones al
> implementar: el récord es la serie **más pesada** (el número grande de
> Progreso → PRs), no la de más volumen; la recuperación sin historial dice
> "sin registro"; la previa va debajo de TODA tarjeta sin empezar (también la
> que está en espera si deslizás hasta ella con otro ejercicio en curso). La
> primera vez muestra "Meta de hoy" al lado del grupo (la tarjeta ya dice
> "Primera vez"). Al tocar Empezar, además de la previa, el bloque de
> Empezar se cierra por altura mientras la tarjeta se despliega: si no, la
> previa saltaba ~100 px para arriba antes de irse.

### Problema

Con la sesión abierta y el ejercicio sin empezar, la tarjeta mide 244 px y
quedan 356 px vacíos debajo (444 px a 430 de ancho).

### Diseño (maqueta 03, opción B)

Debajo de la tarjeta sin desplegar aparece **`PreviaEjercicio`**, con
paneles de vidrio del patrón `.card`:

1. **Tu fuerza:** 1RM estimado actual, el cambio en 8 semanas (▲/▼ %) y una
   sparkline con `e1rmSeries` / `trend`.
2. **Récord** (mejor serie y hace cuánto, `exerciseSeries` / `sessionPRs`) y
   **Recuperación** del grupo (`recoveryPct`), lado a lado.
3. **Meta de hoy** (`objetivoHoy` / `progresion`), por ejemplo "47.5 kg × 8 ·
   1 rep más que la última".

Sin historial, el ejercicio muestra "Primera vez", con el peso sugerido
(`suggestedWeight`) y sin gráfico. La previa tiene que entrar en el hueco
sin scroll en los dos anchos. A 390 se mide y, si no alcanza, se achica la
sparkline antes de quitar paneles.

**Al tocar Empezar**, una sola transición: los paneles salen con fundido y
translateY (`D.objeto`) mientras la tarjeta se despliega (`D.panel`). La
**meta de hoy pasa a vivir dentro de la tarjeta** como una línea. El gráfico
de fuerza y el récord se siguen viendo en el aviso que abre "Sesión
anterior ›". Deslizar el carrusel a otro ejercicio sin empezar muestra la
previa de ese ejercicio.

**Criterio de aprobación.** El hueco queda ocupado sin scroll a 390 y 430,
con los datos correctos (verificados contra la ficha del ejercicio en
Progreso). La transición a desplegado no hace saltar la pantalla, y no hay
paneles vacíos ni "NaN" con un ejercicio nuevo.

---

## 4 · Color: base grafito + un acento elegido

> **Implementada el 2026-09-28** en la rama `feat/color-grafito` (plan
> `docs/superpowers/plans/2026-09-27-color-grafito-acento.md`). Decisión
> tomada al implementar: el cuarto escalón del mapa muscular (7+ días) no
> sale del acento sino del ámbar de estado ("atención"); los tres primeros sí
> son la escala de luminosidad del acento.

### Problema

El relevamiento del sistema de color encontró cinco causas:

- Los tokens se nombran por matiz (`--blue`, `--blue2`, `--cyan`…), no por
  función.
- `lib/theme.js` cambia sólo 17 variables. Quedan azules fijos: 68 literales
  fríos en `styles.css`, la base navy del vidrio en ~22 reglas,
  `--edge-metal`, el resplandor de `body::before`, 39 utilidades Tailwind
  que leen `--color-*`, `charts.ts`, `Silhouette`/`BodyMini`, el confeti,
  el Lottie y `theme-color`.
- Elegir negro o el color "actual" no vuelve al de fábrica.
- Los corrimientos de matiz son fijos (el violeta sale azul).
- No hay regla contra el choque con los estados: rojo 1.16:1, amarillo
  1.07:1.

### Diseño (maqueta 04, base B)

**Base grafito, fija para todos**, en neutros sin tinte:

- `--bg #101113`
- `--surface` / `--surface-2` para las tarjetas opacas
- `--glass`: rgba(34,35,39,.66) más un borde blanco al 10 %, y
  `backdrop-filter: blur() saturate(1.2)`. Baja de 1.5 para no amplificar
  tintes.
- `--text` / `--text-2` / `--text-3`
- `--line`

**Acento desde un solo matiz.** Todo se deriva en OKLCH con luminosidad fija
y croma fijo por matiz (recortado al gamut):

- `--accent` = `oklch(.80 C h)`
- `--accent-strong` = `oklch(.62 C' h)`, para degradados y sombras
- `--on-accent` oscuro, `--accent-glow`, y `--accent-rgb` para los `rgba()`

El degradado de CTA y de la pestaña activa va de `accent-strong` a
`accent`. El resplandor de fondo y la arista del vidrio salen del acento.

**Estados reservados y fijos:**

- `--ok` verde: logrado
- `--danger` rojo: bajaste, peligro
- `--warn` ámbar: alerta y aproximación

Los 45 literales de estado sueltos pasan a estos tokens.

**Elección del usuario (Ajustes).** Hay presets **Hielo** (por defecto),
**Cobalto**, **Violeta**, **Fucsia** y **Monocromo** (croma 0), más un
"personalizado" que toma sólo el matiz del color elegido. Si ese matiz cae
a menos de ~20° de rojo, ámbar o verde, se corre fuera de esa zona.
Naranja y Lima no se ofrecen. Negro no es una opción de acento: la base ya
es negra. La vista previa de Ajustes muestra la paleta real. Un
`themeColor` guardado de antes se migra al matiz más cercano.

**Migración:**

- Renombrar los tokens por función, con alias temporales si ayudan a partir
  el PR.
- Reemplazar los literales en `styles.css`, y el bloque `@theme` → `@theme
  inline` apuntando a las variables, para que las utilidades Tailwind sigan
  al tema.
- `charts.ts` lee los tokens y redibuja al cambiar el tema.
- La escala del mapa muscular (`TONOS` en `Silhouette.jsx`, la misma que la
  leyenda desde #124) se deriva del acento por luminosidad.
- `theme-color` dinámico; manifest e íconos en grafito; `favicon.svg` pasa
  a ser el ícono de FIERRO (hoy es el rayo por defecto de Vite).
- El confeti y el Lottie de PR usan el acento.

**Tests:**

- `theme.test.js`: contraste AA de `--text*` sobre `--glass`/`--surface` y
  de `--on-accent` sobre los dos extremos del degradado, para cada preset y
  para una barrida de matices cada 10°.
- Distancia mínima entre el acento y los estados.
- Un test que falle si aparece un color literal en `styles.css` fuera del
  bloque de tokens.

**Criterio de aprobación.** Con cada preset, capturas a 390 de Inicio, Hoy
en vivo, Entreno, Progreso y Ajustes sin un solo azul que no venga del
acento. `backdropFilter` activo en header, barra, hojas y tarjetas. Todos
los contrastes medidos en AA (texto ≥ 4.5, texto grande e íconos ≥ 3).

---

## Orden de trabajo propuesto

1. **Color (4)** primero: es la base sobre la que se construyen las demás.
   Hacer 1–3 antes sería construirlas con tokens que después se renombran.
   Las tandas 2–8 de la auditoría tocan el mismo CSS, así que van después
   de esto.
2. **Rampa (2) + Previa (3)**, en un PR: las dos viven en la tarjeta de
   `ExerciseCarousel.jsx`.
3. **Asistente (1).**
4. Tandas 2–8 de la auditoría, en el orden del informe.

## Fuera de alcance

Modo claro. Cambiar el descanso a pantalla completa después de la rampa.
Notas por ejercicio. El orden de Plan de hoy en memoria (`S.hoyOrder`).
