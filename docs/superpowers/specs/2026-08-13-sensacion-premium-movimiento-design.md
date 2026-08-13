# Sensación premium: movimiento y feedback — diseño

## Contexto

Enzo pidió, a partir de material de referencia (`explicaciones app.txt`: reportes
UX/UI de Ultrahuman y Tesla vía Mobbin, más una transcripción de video con tips
de pulido), que FIERRO se sienta más "premium". Ya se hicieron tres ajustes
chicos y puntuales (peso visual del ícono activo en la tab bar, rebote en el
contador de series al completar una, mensaje informativo en el globo del
músculo cuando no hay datos en la ventana) — todos en producción.

Al mostrarle mockups del color/estilo actual contra un "estilo Figma" (claro,
paneles planos) confirmó que el estilo actual (oscuro, degradado) está bien
— no es un tema de color. El "no veo el look premium" apunta a otra parte:
**movimiento** (transiciones que se sienten como parpadeo, no como algo
fluido), **íconos/tipografía**, y **detalles de feedback** (vibración/sonido).

Este diseño cubre específicamente el bloque de **movimiento**: los cuatro
puntos concretos que salieron de la conversación. Íconos/tipografía y
feedback físico quedan para una vuelta aparte (no se definieron todavía).

## Alcance — cuatro piezas independientes

1. Transición entre pestañas (tab bar y swipe)
2. Cierre de los sheets (modales)
3. Reposicionamiento del carrusel de ejercicios en Hoy
4. Pantalla nueva de fin de sesión (racha + resumen + cuerpo animado)

Cada una se implementa y verifica por separado — no hay dependencia entre
ellas. Confirmado explícitamente por Enzo:
- El swipe entre pestañas **no** sigue el dedo en vivo (eso sigue como está:
  se decide recién al completar el gesto). Lo que cambia es sólo la
  animación de transición una vez decidido el cambio.
- La pantalla de fin de sesión es **corta y automática** (no un recap tipo
  historias donde hay que tocar para avanzar) — entrena casi todos los días,
  así que no puede interponerse.

## 1. Transición entre pestañas

**Por qué se siente como parpadeo hoy:** `App.jsx` sólo monta la pantalla
activa (`key={store.tab}`). Al cambiar de pestaña, React desmonta la vieja de
golpe y monta la nueva con una animación de *entrada únicamente*
(`slideR`/`slideL` en `styles.css`, fade + translate desde un lado). No hay
ninguna animación de salida — el corte es instantáneo y sólo la nueva
pantalla se mueve, lo que lee como un salto en vez de un deslizamiento
continuo.

**Cambio:** durante la transición (~320-380ms) se mantienen montadas AMBAS
pantallas — la saliente y la entrante — y ambas se mueven juntas: la vieja
sale deslizándose hacia el lado por el que "te fuiste" mientras la nueva
entra desde el lado opuesto, mismo tipo de curva/tiempo que ya usa `--ease`
en el resto de la app. Terminada la animación, la pantalla saliente se
desmonta.

**Dónde:** un wrapper nuevo en `App.jsx` (o un hook chico, p. ej.
`useTabTransition`) que guarda `{tab, saliente}` en vez de sólo `store.tab`
directo: cuando `store.tab` cambia, la pantalla anterior se guarda como
"saliente" con un timeout que la limpia cuando termina la animación. La
dirección (`dir-l`/`dir-r`) ya se calcula (línea ~130 de `App.jsx`) y se
reusa tal cual para ambas mitades del movimiento.

**No cambia:** la lógica de qué pestaña sigue a cuál (`ORDEN`,
`SWIPE_ORDEN`), el gesto de swipe en sí (`lib/swipe.js`), ni la barra de
abajo.

## 2. Cierre de los sheets

**Por qué se siente abrupto hoy:** `Sheet.jsx` alterna la clase `open` de
`#sheet` según un booleano. `styles.css` tiene `#sheet{display:none}` /
`#sheet.open{display:block}` — la apertura sí anima (`.panel` tiene
`animation:shup .3s` deslizando desde abajo, y el fondo hace `fdin`), pero el
cierre no tiene ninguna animación espejada: en el instante en que `open` pasa
a `false`, `display:none` corta todo de golpe.

**Cambio:** `Sheet.jsx` suma un estado interno que **atrasa** el desmontaje
respecto de `open`: cuando `open` pasa de `true` a `false`, en vez de
desaparecer ya mismo se le agrega una clase `closing` que dispara la
animación inversa (deslizar hacia abajo + fade), y recién cuando esa
animación termina (mismo ~300ms que ya usa `shup`, vía un timeout o
`onAnimationEnd`) se deja de renderizar/oculta de verdad. El manejo de foco
que ya existe (guardar y restaurar `previoRef`) no cambia de lugar, sólo hay
que confirmar que sigue disparándose en el momento correcto (al empezar el
cierre, no al terminarlo — si no, el foco quedaría atrapado en un panel que
ya se está yendo).

**No cambia:** la apertura (ya está bien), el manejo de teclado/foco/Escape,
ni el contenido de ningún sheet particular.

## 3. Reposicionamiento del carrusel de Hoy

**Por qué se siente abrupto hoy:** hay dos caminos distintos moviendo el
mismo carrusel (`lib/carousel.js`). Cuando deslizás vos con el dedo es scroll
nativo del navegador — fluido. Pero `jumpToSlide()` (usado en el
`useLayoutEffect` de `ExerciseCarousel.jsx`, disparado cada vez que cambia
`focusKey`: día distinto, arranca la sesión, cambia el ejercicio en curso)
hace `car.scrollLeft = ...` directo — un salto instantáneo, sin transición,
cada vez que la propia app decide reposicionar la vista.

**Cambio:** `jumpToSlide()` pasa a usar scroll suave
(la función `scrollToSlideEl()` que ya existe y ya se usa después de
completar un ejercicio, con `behavior:'smooth'`), **excepto** en el primer
montaje real de la pantalla (la primera vez que se abre Hoy en la sesión de
navegación) — ahí sí tiene que ser instantáneo, porque animar desde la
posición 0 en el primer pintado se vería raro (el carrusel "viajando" apenas
abrís la pantalla). Se distingue con una bandera de "ya hubo un primer
posicionamiento" en el propio efecto.

**No cambia:** la matemática de centrado (`offsetLeft`/`offsetWidth`, ya
corregida de un bug real documentado en el archivo), ni `scrollCarouselTo()`
(que ya es suave).

## 4. Pantalla de fin de sesión

Hoy, `completeSession()` (`lib/session.js`) guarda la sesión, dispara un
vibrado, y abre directamente el sheet `session-view` con `justFinished:true`
(más confetti si hubo PRs). No hay ningún momento que reconozca "terminaste
el día" antes de caer en el detalle numérico de la sesión.

**Cambio:** antes de abrir `session-view`, se muestra una pantalla completa
nueva (no un sheet — ocupa toda la pantalla, mismo patrón que ya usa el
overlay de descanso `#rest-fs`), automática, de unos 3.5-4 segundos en tres
tiempos consecutivos (no simultáneos — cada uno tiene su propio momento,
siguiendo el consejo del video de referencia de no animar todo junto):

1. **Racha** (~1s): el número de racha sumando +1, mismo tratamiento visual
   que ya existe en el header (`currentStreak()`).
2. **Resumen** (~1s): ejercicios completados, series totales, kg movidos del
   día — los mismos números que ya calcula `completeSession()` al armar
   `sess` (no hace falta recalcular nada nuevo, salvo el volumen total, que
   es una suma directa de `sess.entries[].sets[].w * .r`).
3. **Cuerpo** (~1.5-2s): la silueta (reusando el componente `Silhouette` /
   su sistema de zonas ya existente) con los grupos musculares trabajados
   HOY iluminándose uno por uno — se derivan de `sess.entries[].cat`
   (ya vienen guardados por entrada), sin necesitar `groupStats()` completo
   ni ninguna consulta nueva a `S.sessions`.

Se puede tocar en cualquier momento para saltarla (no es obligatorio
mirarla entera) — entrenar es una acción diaria, y una pantalla que no se
puede apurar en un mal día se vuelve fricción, no algo premium. Al
terminar (sola, o por el toque), pasa a abrir `session-view` exactamente
como pasa hoy — eso no cambia.

**Dónde:** componente nuevo (p. ej. `components/SessionComplete.jsx`),
montado desde `App.jsx` junto a `RestTimer`/`Toast` (mismo nivel, no dentro
de `<Sheet/>`), controlado por un campo de estado nuevo en `S` (p. ej.
`S.sessionComplete: {sess} | null`), seteado por `completeSession()` en vez
de (o justo antes de) abrir `session-view` directamente. `styles.css` suma
las animaciones de los tres tiempos (reutilizando `--ease` y el sistema de
colores por zona que ya pinta la silueta en Inicio).

**No cambia:** el cálculo de PRs/confetti existente, ni el contenido del
sheet `session-view` en sí.

## Testing

- Tests unitarios donde haya lógica nueva no trivial: derivar qué zonas
  corresponden a una sesión concreta (paso 3 del punto 4) es la única pieza
  con lógica real fuera de CSS/JSX — se prueba igual que el resto de
  `lib/muscle.js`.
- Verificación en navegador real (CDP) de las cuatro piezas, con capturas
  antes/durante/después como se viene haciendo el resto de la sesión.
- Suite completa (`npx vitest run`) + `npm run lint` sin warnings nuevos
  antes de cada commit, como en todo el resto del proyecto.

## Non-goals (explícitamente fuera de esta vuelta)

- Nada de color/tema: el estilo actual (oscuro, degradado) queda confirmado
  tal cual está.
- Swipe con seguimiento en vivo del dedo: descartado a propósito, se
  mantiene "medir el gesto completo y decidir al soltar".
- Íconos/tipografía y feedback físico (haptics/sonido): son las otras dos
  áreas que Enzo marcó como parte de "premium", pero no se definieron en
  esta conversación — quedan para un diseño aparte.
- Ilustraciones custom / mascota: necesitan una herramienta de generación de
  imágenes aparte, ya conversado con Enzo, fuera de alcance acá.
