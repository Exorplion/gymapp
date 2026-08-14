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
3. Tipografía y espaciado más generosos

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

- `shup`/`shdown` (sheets abren/cierran) — `Sheet.jsx` + `styles.css`
- `slideR`/`slideL`/`vin`/`slideOutL`/`slideOutR` (transición de pestañas)
  — `App.jsx` + `styles.css`
- `dayArrive`/`dayBumped`/`dayLeft` (tarjetas de día en Rutina)
- `railIn` (filas que entran en Progreso/Rutina)
- `.sc-beat` (los tres tiempos de la pantalla de fin de sesión)
- `mpop-in` (el globo de estadísticas del músculo)

**Qué NO cambia a `--spring`:** nada que sea un relleno/progreso continuo
(el anillo del descanso, la barra de series, `.tab-ind` deslizándose entre
pestañas de la tab bar) ni transiciones de color/opacidad puras (el rebote
ahí se vería como un parpadeo raro, no como movimiento físico). Esas
siguen con `--ease` tal cual están.

**Duraciones:** se mantienen las ya acortadas (260ms pestañas, 220ms
sheets, etc.) — este cambio es sólo de curva, no de tiempo.

## 2. Vidrio esmerilado en las tarjetas

**Hoy:** sólo la tab bar y los sheets usan `backdrop-filter:blur(...)`. La
clase `.card` (usada en casi todas las pantallas: el hero de Hoy, cada
fila de ejercicio en Rutina, las tarjetas de Progreso, etc.) tiene un
fondo con degradado pero casi opaco — no deja pasar nada de lo que hay
detrás.

**Cambio:** `.card` (la regla base en `styles.css`, la que heredan todos
los usos) suma `backdrop-filter:blur(20px) saturate(1.6)` (mismo valor que
ya usa el panel de los sheets, para que se sienta como el mismo material
en toda la app) y ajusta su fondo a una versión más translúcida del
degradado que ya tiene, no un color nuevo.

**Confirmado explícitamente con Enzo:** esto se aplica a la clase base, así
que alcanza a TODAS las tarjetas de la app — no sólo los hero cards
destacados. Es el cambio de mayor superficie visual de los tres.

**Riesgo a vigilar:** blur real sobre MUCHAS tarjetas a la vez en una
pantalla larga (por ejemplo el historial de sesiones en Progreso, con
varias `.card` apiladas) puede pesarle a un teléfono viejo — cada capa de
blur es su propio costo de repintado. Si al verificar en navegador se ve
lento en una lista larga, la salida es acotar el blur a menos tarjetas por
pantalla (por ejemplo sólo la primera visible) en vez de sacarlo del todo
— eso se decide en la implementación, con datos reales, no a priori acá.

**Qué NO cambia:** las clases más específicas ya construidas sobre `.card`
(`.card.hero`, `.card.sub`, `.card.day`, etc.) heredan el blur de la base
automáticamente — no hace falta tocarlas una por una salvo que alguna
tenga su propio `background` que lo tape (se revisa caso por caso al
implementar).

## 3. Tipografía y espaciado más generosos

**Hoy:** los títulos de pantalla (`.vtitle h1`, ~1.7rem/27px) y el margen
entre secciones (`.sect`, ~14-16px arriba) son compactos — se ve más
contenido sin scrollear, pero la jerarquía es menos marcada que en una
pantalla nativa de iOS.

**Cambio:** agrandar el título de pantalla (`h1` dentro de `.vtitle`, y
equivalentes en Hoy/Nutrición/Progreso) a un tamaño más grande (referencia
de la comparación: ~34-38px, similar a "Ajustes" de iOS), y aumentar el
margen superior de `.sect` (secciones dentro de una pantalla) para que
respiren más. Aplica a las cuatro pantallas principales (Inicio, Rutina,
Hoy, Nutrición, Progreso) de forma consistente — mismo criterio, no una
pantalla sí y otra no.

**Trade-off aceptado:** más scroll para ver la misma cantidad de
contenido. Enzo lo vio en la comparación y no objetó.

**Qué NO cambia:** el tamaño de texto dentro de las tarjetas (nombres de
ejercicio, números, etc.) — esto es específicamente el título de pantalla
y el espacio ENTRE bloques, no una revisión de toda la escala tipográfica.

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
