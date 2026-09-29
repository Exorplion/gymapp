---
version: alpha
name: FIERRO
description: PWA de entrenamiento y nutrición, un solo usuario, oscura, condensada itálica y de vidrio.
colors:
  # El acento elegible (valores de Hielo, el de fábrica; lib/theme.js los
  # deriva en OKLCH del matiz elegido). `primary` es el acento: la acción.
  primary: '#49cffc'
  primary-strong: '#0094bb'
  on-primary: '#02141b'
  # Base grafito (fija, neutra, igual para todos los acentos)
  neutral: '#101113'
  surface: '#18191c'
  surface-2: '#202125'
  glass: 'rgba(34,35,39,.66)'
  glass-strong: 'rgba(34,35,39,.9)'
  glass-border: 'rgba(255,255,255,.10)'
  on-surface: '#f3f4f6'
  on-surface-2: '#b1b1b9'
  on-surface-3: '#97979f'
  line: 'rgba(255,255,255,.09)'
  line-2: 'rgba(255,255,255,.16)'
  # Estados (reservados, fijos)
  ok: '#34D399'
  ok-strong: '#0E9F6E'
  on-ok: '#062b18'
  error: '#F87171'
  error-strong: '#E8455F'
  warn: '#FBBF24'
  warn-strong: '#E0A020'
  on-warn: '#2A1603'
  flame: '#FFC46B'
  # Categorías de macros: tres luces del acento (final de cada barra, Hielo)
  macro-prot: '#49cffc'
  macro-carb: '#58b9dc'
  macro-fat: '#008db3'
typography:
  screen-title:
    fontFamily: Barlow Condensed
    fontSize: 40px
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: 0.02em
  hero-name:
    fontFamily: Barlow Condensed
    fontSize: 46px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.01em
  headline-display:
    fontFamily: Barlow Condensed
    fontSize: 34px
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: -0.03em
  headline-sheet:
    fontFamily: Barlow Condensed
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: 0.01em
  section:
    fontFamily: Barlow Condensed
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0.18em
  row-title:
    fontFamily: Barlow Condensed
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.2
  body-md:
    fontFamily: Barlow
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Barlow
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  label-sm:
    fontFamily: Barlow
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: 0.14em
  label-cta:
    fontFamily: Barlow Condensed
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0.09em
  number-lg:
    fontFamily: Barlow Condensed
    fontSize: 54px
    fontWeight: 700
    lineHeight: 1
    fontFeature: '"tnum" 1'
rounded:
  xs: 4px
  sm: 8px
  md: 12px
  DEFAULT: 18px
  lg: 26px
  full: 999px
spacing:
  unit: 4px
  s1: 4px
  s2: 8px
  s3: 12px
  s4: 16px
  s5: 24px
  s6: 32px
  gutter: 18px
  tabs-h: 91px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.label-cta}'
    rounded: '{rounded.DEFAULT}'
    height: 52px
  button-ghost:
    backgroundColor: '{colors.surface-2}'
    textColor: '{colors.primary}'
    rounded: '{rounded.DEFAULT}'
    height: 52px
  button-sm:
    rounded: '{rounded.md}'
    height: 44px
  chip:
    backgroundColor: '{colors.surface-2}'
    textColor: '{colors.on-surface}'
    rounded: '{rounded.full}'
    padding: 12px
  chip-on:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    rounded: '{rounded.full}'
  card:
    backgroundColor: '{colors.glass}'
    rounded: '{rounded.DEFAULT}'
    padding: 16px
  card-hero:
    backgroundColor: '{colors.glass}'
    rounded: '{rounded.lg}'
    padding: 24px
  nav-card:
    backgroundColor: '{colors.surface-2}'
    rounded: '{rounded.DEFAULT}'
    padding: 14px
  section-title:
    textColor: '{colors.on-surface}'
    typography: '{typography.section}'
  tile-label:
    textColor: '{colors.on-surface-2}'
    typography: '{typography.label-sm}'
  tabbar:
    backgroundColor: '{colors.glass-strong}'
    rounded: '{rounded.lg}'
    padding: 7px
  sheet:
    backgroundColor: '{colors.glass-strong}'
    rounded: '{rounded.lg}'
    padding: 20px
  input:
    backgroundColor: '{colors.surface-2}'
    textColor: '{colors.on-surface}'
    rounded: '{rounded.md}'
    padding: 14px
---

# Design System: FIERRO

Documento extraído del código real (`web/src/styles.css`, `lib/theme.js`,
`lib/motion.js`, componentes) y del build de producción medido en Chrome a
390 y 430 px. Primera versión el 2026-09-28 sobre `main` = #125 (base grafito
+ acento elegido); actualizado el mismo día con la **tanda A** de la
auditoría visual 2 ("Un acento que signifique", V1 V2 V6 V7 V11) y el
2026-09-29 con la **tanda D** ("Ritmo y composición", V10 e I2 en Inicio,
Entreno, Comida y Progreso). Describe lo
que HAY; las propuestas pendientes viven en
`docs/auditoria-visual-2-2026-09.md`.

Los tokens del frontmatter siguen la spec de DESIGN.md (`version: alpha`): los
nombres del código (`--accent`, `--text`, `--danger`) se mapean a los
recomendados (`primary`, `on-surface`, `error`). Los degradados, la itálica y
las versales no son tokens de la spec: se describen en la prosa.

## Overview

**Creative North Star: "El tablero del vestuario".** Una consola de
entrenamiento oscura, de noche, en un gimnasio: grafito casi negro, vidrio
ahumado encima, números grandes en una condensada itálica que se lee como
dorsal o marcador deportivo, y un solo color de acento que el usuario elige y
que se enciende **sólo donde hay que actuar**. El carácter lo pone la
tipografía (Barlow Condensed itálica en títulos y cifras) y la luz del acento
(degradados, halos, la arista del vidrio); la base no tiene tinte.

La densidad es de app de uso diario: una columna de 354 px (390) a 394 px
(430) con 18 px de margen, **12 px dentro de un grupo y 32 entre grupos**, y
una barra de pestañas flotante de vidrio. El fondo lleva una atmósfera fija: dos
resplandores radiales del acento (arriba al centro y abajo a la derecha) y un
grano `feTurbulence` al 4,5 %. Todo se piensa para usarse con el teléfono en
la mano entre series: botones de 52 a 58 px, cifras tabulares, textos cortos.

**Key Characteristics:**
- Base grafito neutra (`#101113`) + un acento derivado en OKLCH de un matiz (Hielo, Cobalto, Violeta, Fucsia, Monocromo o propio).
- **El acento significa "acá se actúa"**: acción primaria, estado activo (pestaña, segmentado, chip, día de hoy), foco y la cifra protagonista. Rótulos, títulos de sección y metadatos van en tiza o plomo. Medido tras la tanda A: 1 de 37 textos en acento en Inicio (2,7 %), 3 de 204 en Progreso (1,5 %), 1 de 62 en Comida (1,6 %); antes 32 %, 24 % y 8 %.
- Estados reservados: verde logrado, rojo peligro, ámbar alerta y aproximación, llama (ámbar cálido) para la racha. Nunca como color de categoría.
- Barlow Condensed itálica 700 para títulos de pantalla, héroes y cifras; Barlow para texto corrido.
- Vidrio: grafito translúcido al 66 % (90 % en header, barra y hojas) con `blur(22px) saturate(1.2)`, borde blanco al 10 % y arista con luz del acento arriba.
- CTA primario: píldora redondeada de 18 px con degradado 112° de `primary-strong` a `primary` y un halo del acento debajo.
- Movimiento en cuatro duraciones con nombre (`--d1..--d4`) y resorte para entradas. "Esto está activo" se dice con **un anillo que late por fuera**, nunca bajando la opacidad de lo activo.

## Colors

Tres familias, nombradas por función. Fuera del bloque de tokens de
`styles.css` no hay colores literales, **tampoco dentro de un `data:` URI**
(lo vigila `colores-literales.test.js`); un brillo es `rgba(var(--hi-rgb),α)`
y una sombra `rgba(var(--shade-rgb),α)`.

### Primary Foundation (base grafito)
- **Grafito de fondo** (`neutral`, `#101113`): el piso de toda la app, `body`.
- **Grafito de tarjeta** (`surface`, `#18191c`): superficie opaca, base de las hero.
- **Grafito de control** (`surface-2`, `#202125`): chips, campos, `nav-card`, `.group`, botones fantasma, la insignia del día en el historial.
- **Vidrio ahumado** (`glass`): `.card` y `.ini-tile`, siempre con `backdrop-filter`.
- **Vidrio denso** (`glass-strong`): header, barra de pestañas, hojas; van sobre contenido que se mueve.
- **Hilo** (`line`) e **hilo fuerte** (`line-2`): divisores y bordes.

### Accent & Interactive (`primary`)
- **Acento** (Hielo `#49cffc`; Fucsia `#ff96d3`): `oklch(.80 C h)`. Íconos activos, foco, enlaces de acción ("+ Registro", "Ver todas"), el día de hoy en la semana, la cifra protagonista.
- **Acento fuerte** (`primary-strong`; Hielo `#0094bb`, Fucsia `#d04d9f`): `oklch(.62 C' h)`. Arranque de degradados, halos, tintes de fondo.
- **Texto sobre acento** (`on-primary`; Hielo `#02141b`, Fucsia `#1b0c15`): siempre oscuro. Sobre el arranque del degradado: 5,32:1 con Hielo, 4,72:1 con Fucsia (el peor preset).
- **Degradado del acento**: `linear-gradient(112deg, primary-strong, primary)`. CTA, pestaña activa, segmentado activo, chip activo, barras.
- **Halo del acento**: `0 16px 40px -14px rgba(primary-strong,.55)` debajo de los CTA.

### Typography & Text Hierarchy
- **Tiza** (`on-surface`, `#f3f4f6`): texto principal, títulos de sección (`.sect`, `#sheet h3`), cifras de tarjetas y listas (racha, calorías, peso, récords, 1RM), metadatos fuertes ("21 series · 7285 kg de volumen").
- **Plomo** (`on-surface-2`, `#b1b1b9`): secundario, subtítulos, rótulos de tarjeta (`.ini-tile-lbl`), eyebrows (`.ini-eyebrow`, `.hero-eyebrow`), pestañas inactivas.
- **Ceniza** (`on-surface-3`, `#97979f`): terciario, placeholders, lo apagado, la flecha del select. Contraste ≥ 4.5 medido sobre la peor hero.

### Functional States
- **Logrado** (`ok`, degradado a `ok-strong`): sesión hecha, serie lista, subiste, días entrenados, proteína del día cumplida.
- **Peligro** (`error`): bajaste, borrar, faltas reales en el mapa de racha, grasa > 110 % del máximo.
- **Alerta** (`warn`, degradado a `warn-strong`): aviso, aproximación de la rampa, calentamiento, grupo que se enfría ("hace 9 días"), grasa por encima del máximo.
- **Llama** (`flame`): la racha del header, el único acento cálido fijo.
- **Mapa muscular**: tres escalones de luz del acento (hoy/ayer, 2-3 días, 4-6 días) y ámbar de estado para 7+ días; grafito para "sin registro".

### Categorías (no estados)
- **Macros** (`macro-prot`, `macro-carb`, `macro-fat`; en CSS `--macro-*-a/-b`, arranque y final de cada barra): tres luces del acento tomadas de la escala del mapa muscular — proteína = el degradado del acento, carbos = escalón 0-lo → 1-hi, grasa = 1-lo → 1-md. No se baja al tercer escalón (L .43–.54): se leía malva, como deshabilitado. El verde y el ámbar entran encima sólo como estado (`macroCls`).

**The Reserved State Rule.** Verde, rojo y ámbar significan logro, peligro y
alerta, y sólo eso: ni una categoría (carbos, grasa), ni un rótulo ("en uso"),
ni un mensaje positivo ("nada flojo esta semana") van en esos colores. El
acento nunca se acerca a menos de 20° de ellos.

## Typography

**Display Font:** Barlow Condensed (Google Fonts), cargada en 500, 600, 700 y
700 itálica. **Body Font:** Barlow, cargada en 400, 500, 600 y 700.
`font-synthesis: none` en `:root`: un peso no cargado cae al más cercano, no
se finge (`.ini-title`, `.ini-cta` e `.ini-tile-num` piden 800 y se dibujan
en 700; pendiente V8).

**Character:** la condensada itálica es la voz deportiva (dorsal, marcador,
cronómetro); Barlow es la misma familia en ancho normal, así que el cruce es
invisible. La jerarquía la dan el tamaño, el peso y las versales, **no el
color**.

Escala en `@theme` (Tailwind genera `text-*` con los mismos valores): nano 10,
micro 11, sm 13, body 15, lg 18, xl 22, 2xl 26, display 34, hero 44, más
cinco tamaños protagonistas fuera de escala a propósito (40 título de
pantalla, 46 nombre del día, 52/54 cifras grandes, 56/64 cronómetros).

- **Título de pantalla** (`screen-title`: Cond 700 **itálica**, 40 px, **versales**, `.vtitle h1`): "ENTRENO", "COMIDA", "PROGRESO", con la fecha en Barlow 13 versales al lado, alineada a la línea base.
- **Nombre del día** (`hero-name`, itálica) en la hero de Hoy; 34 px en la hero de Entreno.
- **Título de Inicio** (`headline-display`, itálica, `.ini-title`, tracking −.03em).
- **Título de hoja** (`headline-sheet`, itálica, caja normal, `#sheet h2`).
- **Título de sección** (`section`, versales, tiza, raya a la derecha, `.sect`; `#sheet h3` a 15 px y .12em, también en tiza).
- **Rótulo de tarjeta** (Cond 700, 13 px, versales, .14em, **plomo**, rayita ceniza, `.ini-tile-lbl`).
- **Eyebrow** (Barlow 700, 11 px, versales, .18em, **plomo**, `.hero-eyebrow`; `.ini-eyebrow` en condensada 11). Pendiente V12: sacarlos.
- **Nombre de fila** (`row-title`: turnos, ejercicios de Plan de hoy) o Barlow 600, 15 px (`nav-card`, listas de hoja).
- **Cuerpo** (`body-md`) y **secundario** (`body-sm`, plomo).
- **Etiqueta de cifra** (`label-sm`, versales, plomo): "EJERCICIOS", "SERIES", "RACHA ACTUAL".
- **CTA** (`label-cta`, versales; 22 px y .12–.14em en los CTA de héroe).
- **Cifras**: `tabular-nums` (`.cond`, `.num`, `.bignum`, cronómetro). Las de las tarjetas de Inicio en tiza con la unidad en plomo, sin degradado recortado al texto (el degradado de texto queda en la marca y en `.plan-title`, pendiente V13).

## Layout

- Una columna, `max-width: 520px` centrada, margen lateral `gutter` 18 px. Todo arranca en x = 18: marca, título, tarjetas, barra.
- Inicio usa un grid asimétrico de 2 columnas: el cuerpo ocupa las dos, debajo Racha / Más flojo y Calorías / Peso. Las cuatro chicas miden lo mismo (`grid-template-rows:auto 1fr 1fr`) y tienen el mismo esqueleto: rótulo arriba a la izquierda, cifra debajo, línea de apoyo abajo del todo. Inicio entra sin scroll a 390×844 y 430×932.
- La sesión en vivo entra en una pantalla sin scroll (844 px a 390).
- Las hojas suben desde abajo hasta 88 dvh, radio 26 arriba.
- Escala de espacio de seis pasos (`s1`–`s6`: 4, 8, 12, 16, 24, 32). **Ritmo de las pantallas tablero** (Inicio, Entreno, Comida, Progreso; tanda D): `.pila` separa grupos a `--s6` (32) y `.grupo` junta lo de adentro a `--s3` (12); los márgenes verticales de los hijos se anulan (el aire lo pone el contenedor). Un `.sect` dentro de una pantalla abre grupo: 32 arriba, 12 abajo. Inicio usa `--s5` entre grupos porque entra entera sin scroll. Medido: 94 % de los espacios de esas cuatro pantallas en la escala (antes 46 %); lo que queda afuera es el sangrado óptico de 2 px de los rótulos versales (`.vtitle`, `.sect`, `.slot-head`, `.sess-week`) y controles de formulario (`.field`, padding 14).
- Dentro de las tarjetas: 16 de padding (`.card`), 24 en las hero de las pantallas tablero (`.hero-plan`, `.hero-kcal`, `.hero-prog`; la de Hoy sigue en 20), 12/16 en las tarjetas chicas de Inicio.
- **Un protagonista por pantalla, primero**: Inicio el estado del día con su botón; Entreno la hero del plan con "Editar rutina" adentro; Comida la hero de calorías (el perfil va al final); Progreso la hero del peso.
- Texto a la izquierda, salvo los diálogos centrados.
- Probado a 390×844 y 430×932; ninguna pantalla desborda a lo ancho (`scrollWidth` = ancho de la ventana en Inicio, Hoy, Progreso y Comida con Hielo y Fucsia).
- Área táctil mínima buscada: 44 px (con `::after` invisible donde el dibujo es más chico). Foco visible: anillo del acento de 2 px + halo del fondo de 4 px.

## Elevation & Depth

Híbrido: capas tonales (grafito → control → vidrio) más sombras difusas
hacia abajo (`0 14px 30-34px -18px`) y una arista interior (luz del acento
arriba al 22 %, sombra abajo al 50 %). El brillo lo ponen los halos del acento
debajo de los CTA y los resplandores radiales dentro de las hero (pendiente
V5: una sola luz por pantalla).

### Motion
- Duraciones: `--d1` 150 ms toque, `--d2` 220 ms objeto, `--d3` 320 ms panel, `--d4` 460 ms momento (espejo en `D` de `lib/motion.js`).
- Curvas: `--ease` (.22,.9,.28,1), `--ease-out` (.16,1,.3,1), `--spring` (.34,1.56,.64,1) para entradas, `--ease-push` (.4,0,.2,1) para el deslizamiento de pestaña.
- Loops permanentes: brillo de `.btn` (3,2 s), filo de `ENTRENAR` (5 s), resplandor del descanso (2,4 s), y el **anillo que late** (`ctaAnillo` en `SEGUIR`, `rampaAnillo` en el paso activo de la rampa): dos contornos del color del estado que crecen y se desvanecen por fuera, ciclo `calc(var(--d4) * 3.5)`, sólo `transform` y `opacity` del pseudo-elemento. El botón queda a opacidad 1.
- `prefers-reduced-motion` y `menosMovimiento()` apagan loops y giros; el anillo queda quieto, visible.

## Shapes

Redondeado generoso y consistente: píldora de 18 px (`DEFAULT`) para botones
y tarjetas, 26 px (`lg`) para lo que encabeza o flota (hero, barra, hojas),
12 px (`md`) para campos, botones chicos y cajitas de ícono, 4–8 px
(`xs`, `sm`) para barras, celdas del mapa de racha e insignias, y `full` para
chips y puntos. Nada con esquina viva.

## Components

### Buttons
- **Primario** (`.btn`, `button-primary`): píldora de 18 px de radio, 52 px de alto mínimo, a todo el ancho, degradado del acento, texto oscuro en condensada versal, halo del acento. Lleva un brillo que barre cada 3,2 s (`::after`). Press: `scale(.96)` en 50 ms, vuelta con resorte `--d1`.
- **Héroe** (`.hero-cta`, `.ini-cta`): 56 a 58 px, texto 18 a 22 px. `ENTRENAR` lleva un filo de luz cónico que gira cada 5 s. `SEGUIR` (`.ini-cta-seguir`, sesión en curso) lleva el anillo que late por fuera; "0 de 9" a opacidad plena.
- **Fantasma** (`.btn.ghost`, `button-ghost`): grafito de control, borde hilo fuerte, texto acento.
- **Apagado** (`.btn.dim`): grafito, texto plomo. **Peligro** (`.btn.danger`): rojo al 12 % con borde rojo. **Logrado** (`.btn.ok`): degradado verde.
- **Chico** (`.btn.sm`, `button-sm`): 44 px, radio 12, texto 15.
- **Ícono** (`.icon-btn`): 38×38, radio 12, degradado blanco 9 %→2 %, borde blanco 10 %.

### Cards & Containers
- **Tarjeta** (`.card`): vidrio ahumado + brillo metálico arriba, radio 18, padding 16, arista del acento, sombra `0 14px 34px -18px`.
- **Hero** (`.card.hero`): radio 26, padding 20, tinte del acento en la esquina (158°) y un halo radial de 210 px arriba a la derecha.
- **Tarjeta de Inicio** (`.ini-tile`): vidrio + tinte del acento 155° + reflejo diagonal (`::after`) + rótulo en plomo con rayita ceniza; cifra en tiza.
- **Tarjeta de navegación** (`.nav-card`): grafito de control opaco, radio 18, ícono de 38 px en cajita tintada (`.nav-card-ico`, también dentro de un `.grouprow`; `.warn`/`.ok` para una fila de estado), título + subtítulo + chevron. En Entreno los accesos ya no son nav-card sueltas: son un `.group`.
- **Turno** (`.day-card`): degradado blanco 7,5 %→2 %, sin blur ni sombra, insignia numerada a la izquierda.
- **Lista agrupada** (`.group` + `.grouprow`): grafito de control, filas de 56 px con hilo entre ellas. `.grouprow-v` (el valor a la derecha) va en acento porque ahí vive también el estado de los interruptores ("Sí"/"No"). **Fila de estado** (`.grouprow-estado`): no se toca entera, la acción es un `.chip` a la derecha (la descarga en Entreno).
- **Fila de sesión** (`SessionCard`, `.grouprow.sess-row` en un `.group` por semana): insignia del día en grafito de control, arriba el turno en condensada 18 y la fecha a la derecha en plomo, abajo "21 series · 7285 kg de volumen" en plomo; el trofeo en ámbar sólo si hubo PR. 64 px de alto (antes una tarjeta de 115 con la lista de ejercicios).
- **Hero del plan** (Entreno): nombre de la rutina 34 itálica, tres cifras (`.hero-stats`: turnos / ejercicios / series por ciclo), barras de series por turno y "Editar rutina" adentro.
- **Aviso** (`.notice`): sin caja, sólo una raya de 2 px a la izquierda (ok o warn).
- **Etiqueta "en uso"** (`.lib-tag`): tiza con borde hilo fuerte, sin relleno.

### Navigation
- **Header** (`header.top`): sticky, degradado grafito .92→.75 + `blur(14px)`, marca "FIERRO" en condensada itálica 22 px con degradado de tiza al acento y la mancuerna; a la derecha, píldora de racha (llama) y dos botones de ícono.
- **Barra de pestañas** (`nav.tabbar`, `tabbar`): flotante a 18 px de los bordes y 16 px del pie, radio 26, padding 7, vidrio denso. Cuatro pestañas con ícono de trazo y rótulo condensado versal 11 px. La activa es una píldora con el degradado del acento que se desliza (`.tab-ind`, `--d3`).
- **Segmentado** (`.seg`): riel blanco al 5 %, radio 18, botones condensados versales; el activo con el degradado y halo.

### Inputs & Forms
- **Campo** (`.field input/select`, `input`): grafito de control, radio 12, padding 14, texto 18; foco = borde `primary-strong`. Rótulo encima en Barlow 11 versal plomo.
- **Flecha del select**: dos gradientes de 7×7 px (un "\" y un "/" de 2 px en `on-surface-3`) a 14–27 px del borde derecho. No es un SVG en `data:`: un `data:` es otro documento y no puede leer `var()`.
- **Chip** (`.chip`, `chip` / `chip-on`): píldora, grafito de control, borde hilo fuerte; activo con el degradado.
- **Rueda** (`ReelPicker`): peso y reps con el valor central en una caja tintada del acento. Arranca en la **meta de hoy** (`metaHoy`) cuando sale de la doble progresión; si no, en la última serie o el peso de partida.

### Domain-Specific Components
- **Tarjeta del ejercicio en vivo** (`ExerciseCarousel`): tablero Series / RIR / Sesión anterior, "Meta de hoy", rampa de aproximación en ámbar, ruedas de peso y reps, botón `SERIE N LISTA` verde con un círculo de check.
- **Descanso a pantalla completa** (`#rest-fs`): anillo del acento con resplandor (`glowring`), cronómetro de 54 px, pregunta de RIR segmentada, −30 s / +30 s / Saltar.
- **Silueta muscular** (`Silhouette`): cuerpo SVG con degradados por zona, frente/espalda, ficha de músculo flotante (`.mpop`).
- **Mapa de racha** (`.heatmap`, `streakHeatmap`): 56 celdas; entrenado = degradado del acento, descanso = grafito al 28 %, falta = rojo al 12 %, **antes de la primera sesión** = casillero vacío (sólo el hilo, al 50 %). El cumplimiento se cuenta desde la primera sesión.
- **Macros** (`.macro3`): tres barras de 7 px con los tokens `--macro-*`; proteína cumplida en verde, grasa pasada en ámbar (> máximo) o rojo (> 110 %).
- **Resumen de sesión** (`SessionView`): cifras en fila, tarjetas con riel vertical de 4 px coloreado por variación (sube, baja, igual, PR).

## Do's and Don'ts

- Do usar el acento sólo para la acción primaria, el estado activo, el foco y la cifra protagonista: objetivo ≤ 8 % de los textos de una pantalla (medido con `getComputedStyle` sobre los nodos de texto visibles de `main`).
- Don't pintar rótulos, títulos de sección, eyebrows ni metadatos con el acento: tiza o plomo, y la jerarquía por tamaño y peso.
- Don't animar la opacidad de un botón o de un texto activo: a .4 el texto cae a 1,7:1 y el acento mezclado con el grafito cambia de color (Fucsia → malva). Para "esto está activo", el anillo que late por fuera.
- Do mantener ≥ 4.5:1 para texto en todo el ciclo de una animación, no sólo en el cuadro quieto.
- Don't usar verde, rojo o ámbar como color de categoría ni para un mensaje neutro o positivo; para categorías, luces del acento.
- Don't escribir un color literal fuera del bloque de tokens, ni dentro de un `data:` URI (`%23…`, `fill='white'`).
- Don't afirmar lo que no se midió: nada de "faltas" antes de la primera sesión ni ceros de relleno.
- Do reusar el patrón que existe (`.card`, `.nav-card`, `.chip`, `.group`/`.grouprow`, `.btn`) y verificar en el build de producción a 390 y 430 px con dos acentos.

## Notas para generación (Stitch)

"Consola deportiva oscura de grafito, vidrio ahumado con arista iluminada,
títulos en condensada itálica pesada en versales, cifras grandes tabulares en
tiza, un solo acento luminoso en degradado reservado a la acción y al estado
activo, estados en verde, rojo y ámbar."

- "Tarjeta hero de vidrio ahumado con radio 26, el nombre del día en Barlow Condensed itálica 46 px, tres cifras tabulares en tiza con etiqueta versal chica en plomo debajo, y un CTA píldora con degradado del acento a todo el ancho."
- "Lista de turnos: filas de radio 18 con insignia numerada, nombre en condensada 22 px, subtítulo 13 px plomo y chevron."
- "Barra de pestañas flotante de vidrio denso, radio 26, cuatro íconos de trazo con rótulo condensado versal, la activa como píldora con el degradado del acento."
