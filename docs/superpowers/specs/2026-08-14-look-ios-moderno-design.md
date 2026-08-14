# Look iOS moderno — diseño

## Contexto

Después de la vuelta de "sensación premium" (movimiento, haptics, íconos,
ilustraciones — ya en producción), Enzo notó que la app se sentía un toque
más lenta, y por separado pidió acercarla más a un look "iOS moderno, buen
diseño". Se resolvió lo primero (las duraciones de las animaciones nuevas
se acortaron: pestañas 380→260ms, sheets 300→220ms, fin de sesión
3.65s→2.4s — no era un problema de rendimiento, era tiempo agregado a
propósito que se sentía como lentitud).

Para lo segundo, mostrando comparaciones lado a lado (curva plana vs.
resorte, tarjeta opaca vs. vidrio esmerilado, espaciado actual vs. más
aire), Enzo eligió: resorte en el movimiento, vidrio esmerilado en TODAS
las tarjetas (no sólo las principales — confirmado explícitamente pese a
la advertencia de que es un cambio grande y visible en toda la app), y más
aire/título más grande en la tipografía (recomendación mía, sin objeción).

## Alcance — tres piezas independientes

1. Movimiento con resorte (`--spring`)
2. Vidrio esmerilado en `.card` (base, afecta toda la app)
3. Tipografía y espaciado más generosos — **descartada, ya implementada** (ver corrección en su sección)

Cada una se implementa y verifica por separado.

## 1. Movimiento con resorte

**Hoy:** `--ease:cubic-bezier(.22,.9,.28,1)` es una curva plana, sin
rebote, usada en casi todas las animaciones de entrada/salida (sheets,
transición de pestañas, tarjetas que aparecen). La única excepción ya
existente es el toque de un botón (`button{transition:transform .18s
cubic-bezier(.34,1.56,.64,1)}`), que SÍ tiene ese resorte sutil — es la
curva que Enzo eligió en la comparación.

**Cambio:** sumar `--spring:cubic-bezier(.34,1.56,.64,1)` (mismo valor que
ya usa el botón, no una curva nueva — consistencia con lo que ya se probó y
gustó) como variable global en `:root`, junto a `--ease`. Reemplazar
`var(--ease)` por `var(--spring)` específicamente en las animaciones de
**entrada/salida de superficies completas** (algo aparece o desaparece de
la pantalla):

- `shup` (sheet abre) — `styles.css`
- `slideR`/`slideL`/`vin` (pestaña entrante) — `styles.css`
- `dayArrive`/`dayBumped`/`dayLeft` (tarjetas de día en Rutina)
- `mpop-in`/`mpop-in-up` (el globo de estadísticas del músculo)
- `.sc-beat`, sólo en el tramo de entrada (0%→12% del keyframe) — ver nota
  de `.sc-beat` más abajo, no todo el keyframe

**Corrección post-spec — `shdown` y `slideOutL`/`slideOutR` NO llevan
`--spring`, se quedan en `--ease`:** los tres animan opacidad
*bajando* hasta un valor menor (`shdown`: 1→.4; `slideOutL`/`slideOutR`:
1→0) al mismo tiempo que un transform. Un resorte hace que el valor pase
de largo antes de asentarse — sobre opacidad decreciente eso se ve como
un parpadeo (se apaga de más y "rebota" hacia visible otra vez justo al
terminar), exactamente el artefacto que la regla de abajo ya dice que hay
que evitar en transiciones de opacidad. Esto no se notó al escribir el
spec porque sólo se probó la maqueta con una tarjeta ENTRANDO, nunca
saliendo. El resorte queda reservado a entradas (opacidad subiendo o
transform puro sin opacidad) — las salidas seguidas de un `forwards`
siguen con `--ease`.

**Corrección post-spec:** `railIn` se saca de la lista de arriba. Al leer
el CSS se confirmó que es exactamente el tipo de animación que la regla de
abajo excluye — sus dos usos (`.dcard.entry::before` en Rutina,
`.ex-row::before` en el editor de ejercicio) son rieles que se **llenan**
(`scaleY(0)→scaleY(var(--fill))`) para representar una magnitud de datos
(volumen movido), no una superficie que entra a escena. Un resorte ahí se
vería como un dato que se pasa de su valor real y rebota, no como una
tarjeta asentándose.

**Nota sobre `.sc-beat`:** su único keyframe (`sc-beat`) cubre entrada Y
salida en una sola línea de tiempo (0-12% entra, 12-88% se sostiene,
88-100% sale) con una sola curva para las tres. Por el mismo motivo de
arriba, no se puede poner `--spring` en el `animation` completo sin
afectar también la salida (88-100%, opacidad bajando). La forma correcta
en CSS es declarar `animation-timing-function:var(--spring)` sólo en el
stop `0%` de `@keyframes sc-beat` (controla el tramo 0%→12%); el resto
del timeline sigue con el `var(--ease)` que ya trae el `animation`
shorthand de `.sc-beat`.

**Qué NO cambia a `--spring`:** nada que sea un relleno/progreso continuo
(el anillo del descanso, la barra de series, `railIn`, `.tab-ind`
deslizándose entre pestañas de la tab bar) ni transiciones de
color/opacidad puras (el rebote ahí se vería como un parpadeo raro, no
como movimiento físico). Esas siguen con `--ease` tal cual están.

**Duraciones:** se mantienen las ya acortadas (260ms pestañas, 220ms
sheets, etc.) — este cambio es sólo de curva, no de tiempo.

## 2. Vidrio esmerilado en las tarjetas

**Corrección post-spec:** al leer `styles.css` para armar el plan, se
encontró que `.card` YA tiene `backdrop-filter:blur(22px) saturate(1.5)`
desde el primer commit de la app — no es cierto que sólo la tab bar y los
sheets lo usen. La comparación mostrada a Enzo (tarjeta "A" totalmente
opaca) no reflejaba el CSS real. El problema real es otro: **el blur ya
está pero casi no se nota**, porque el fondo de `.card` es
`linear-gradient(180deg,var(--card) /* 100% opaco */,rgba(12,19,34,.6))`
— arriba de la tarjeta el blur no se ve (tapado por color 100% opaco), y
sólo se insinúa un poco abajo. El panel de los sheets, en cambio, usa un
degradado *uniformemente* translúcido
(`linear-gradient(180deg,rgba(14,22,38,.92),rgba(10,16,28,.92))`), por
eso su vidrio sí se percibe. `.card.hero` (la tarjeta principal de Hoy) es
el peor caso: su fondo pone `var(--card)` 100% opaco como última capa,
así que su blur es invisible pese a heredarlo de `.card`.

**Cambio (corregido):** no se agrega `backdrop-filter` (ya existe). Se
cambia el fondo de `.card` de "opaco arriba → 60% abajo" a un degradado
uniformemente translúcido, mismo tono azul/marino que ya usa (no un color
nuevo, no el blanco genérico de la maqueta), en el rango del 85-90% de
opacidad — similar al material de los sheets pero un poco más sólido
porque las tarjetas conviven con más contenido/scroll. Ajuste específico
para `.card.hero`: reemplazar la última capa opaca (`var(--card)`) por su
equivalente translúcido para que su blur (el más visible del app, al ser
la tarjeta principal de Hoy) deje de estar tapado.

**Confirmado explícitamente con Enzo:** esto se aplica a la clase base, así
que alcanza a TODAS las tarjetas de la app — no sólo los hero cards
destacados. Sigue siendo el cambio de mayor superficie visual de los tres,
aunque técnicamente es un ajuste de opacidad, no de blur nuevo.

**Riesgo a vigilar:** el blur en sí ya corre hoy sobre todas las
`.card` sin problema de rendimiento reportado, así que el riesgo de este
ajuste es bajo (no se agrega una capa de repintado nueva, sólo cambia
cuánto de ella se ve). Igual se verifica en una pantalla larga (historial
de Progreso) por si el cambio de opacidad revela algo distinto.

**Qué NO cambia:** `.card.sub` (`background:rgba(12,19,34,.4)`, 40% de
opacidad) ya es más translúcida que el objetivo — no se toca. El resto de
clases construidas sobre `.card` heredan el ajuste automáticamente salvo
que tengan su propio `background` (se revisa caso por caso al
implementar).

## 3. Tipografía y espaciado más generosos

**Corrección post-spec — esta pieza queda descartada, ya está hecha.** La
premisa de esta sección (títulos de ~27px, secciones con ~14-16px arriba)
era incorrecta: al leer `styles.css` se encontró que `.vtitle h1` ya está
en `font-size:40px` (con un comentario propio: *"40px e itálica, como el
mockup"* — ya se había llevado a este tamaño en una vuelta de diseño
anterior de esta misma sesión) y `.sect` ya usa `margin:22px 2px 10px`.
Comparado contra los dos tratamientos mostrados en la maqueta (A:
título 27px/margen 14px arriba — cramped; B: título 37.6px/margen 22.4px
arriba — "estilo Ajustes de iOS"), el valor real de hoy YA IGUALA O SUPERA
el tratamiento "B" en las cuatro pantallas (Hoy, Rutina ×3, Nutrición,
Progreso vía `<div className="vtitle">`, confirmado leyendo los cinco
usos de `<h1>` en `components/screens/*.jsx`). No hay una pieza de código
que escribir acá — se documenta la corrección y se cierra sin tarea en el
plan.

## Testing

- Verificación en navegador real (CDP) de las tres piezas, con capturas
  antes/durante/después, como se viene haciendo toda la sesión.
- Atención específica al riesgo de rendimiento del blur en listas largas
  (punto 2) — medir, no asumir.
- Suite completa (`npx vitest run`) + `npm run lint` sin warnings nuevos
  antes de cada commit.

## Non-goals

- No se toca el color/degradado de la app (ya confirmado en una vuelta
  anterior).
- No es una revisión completa de la escala tipográfica — sólo títulos de
  pantalla y espaciado entre secciones.
- No se agregan superficies de vidrio nuevas fuera de `.card` (por ejemplo
  el header no se toca en esta vuelta).
