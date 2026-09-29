---
name: FIERRO
description: PWA de entrenamiento y nutrición, un solo usuario, oscura, condensada itálica y de vidrio.
colors:
  # Base grafito (fija, neutra, igual para todos)
  bg: '#101113'
  surface: '#18191c'
  surface-2: '#202125'
  glass: 'rgba(34,35,39,.66)'
  glass-strong: 'rgba(34,35,39,.9)'
  glass-border: 'rgba(255,255,255,.10)'
  text: '#f3f4f6'
  text-2: '#b1b1b9'
  text-3: '#97979f'
  line: 'rgba(255,255,255,.09)'
  line-2: 'rgba(255,255,255,.16)'
  # Acento (valores de Hielo, el de fábrica; lib/theme.js los deriva en OKLCH del matiz elegido)
  accent: '#49cffc'
  accent-strong: '#0094bb'
  on-accent: '#02141b'
  # Estados (reservados, fijos)
  ok: '#34D399'
  ok-strong: '#0E9F6E'
  on-ok: '#062b18'
  danger: '#F87171'
  danger-strong: '#E8455F'
  warn: '#FBBF24'
  warn-strong: '#E0A020'
  on-warn: '#2A1603'
  flame: '#FFC46B'
typography:
  screen-title:
    fontFamily: Barlow Condensed
    fontSize: 40px
    fontWeight: '700'
    fontStyle: italic
    lineHeight: '0.9'
    letterSpacing: .02em
    textTransform: uppercase
  hero-name:
    fontFamily: Barlow Condensed
    fontSize: 46px
    fontWeight: '700'
    fontStyle: italic
    lineHeight: '1'
    letterSpacing: .01em
  display:
    fontFamily: Barlow Condensed
    fontSize: 34px
    fontWeight: '700'
    fontStyle: italic
    lineHeight: '1.02'
    letterSpacing: -.03em
  sheet-title:
    fontFamily: Barlow Condensed
    fontSize: 26px
    fontWeight: '700'
    fontStyle: italic
    lineHeight: '1.15'
    letterSpacing: .01em
  section:
    fontFamily: Barlow Condensed
    fontSize: 15px
    fontWeight: '700'
    lineHeight: '1.5'
    letterSpacing: .18em
    textTransform: uppercase
  row-title:
    fontFamily: Barlow Condensed
    fontSize: 22px
    fontWeight: '700'
    lineHeight: '1.2'
  body:
    fontFamily: Barlow
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Barlow
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  label:
    fontFamily: Barlow
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.35'
    letterSpacing: .14em
    textTransform: uppercase
  cta:
    fontFamily: Barlow Condensed
    fontSize: 18px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: .09em
    textTransform: uppercase
  number-lg:
    fontFamily: Barlow Condensed
    fontSize: 54px
    fontWeight: '700'
    lineHeight: '1'
    fontFeature: tnum
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
    backgroundColor: 'linear-gradient(112deg,{colors.accent-strong},{colors.accent})'
    textColor: '{colors.on-accent}'
    typography: '{typography.cta}'
    rounded: '{rounded.DEFAULT}'
    height: 52px
  button-ghost:
    backgroundColor: '{colors.surface-2}'
    textColor: '{colors.accent}'
    rounded: '{rounded.DEFAULT}'
    height: 52px
  button-sm:
    rounded: '{rounded.md}'
    height: 44px
  chip:
    backgroundColor: '{colors.surface-2}'
    textColor: '{colors.text}'
    rounded: '{rounded.full}'
    padding: 8px 12px
  chip-on:
    backgroundColor: 'linear-gradient(112deg,{colors.accent-strong},{colors.accent})'
    textColor: '{colors.on-accent}'
    rounded: '{rounded.full}'
  card:
    backgroundColor: '{colors.glass}'
    rounded: '{rounded.DEFAULT}'
    padding: 16px
  card-hero:
    backgroundColor: '{colors.glass}'
    rounded: '{rounded.lg}'
    padding: 20px
  nav-card:
    backgroundColor: '{colors.surface-2}'
    rounded: '{rounded.DEFAULT}'
    padding: 13px 14px
  tabbar:
    backgroundColor: '{colors.glass-strong}'
    rounded: '{rounded.lg}'
    padding: 7px
  sheet:
    backgroundColor: '{colors.glass-strong}'
    rounded: '{rounded.lg}'
    padding: 10px 20px 24px
  input:
    backgroundColor: '{colors.surface-2}'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    padding: 14px
---

# Design System: FIERRO

Documento extraído del código real (`web/src/styles.css`, `lib/theme.js`,
`lib/motion.js`, componentes) y del build de producción medido en Chrome a
390 y 430 px, el 2026-09-28, sobre `main` = #125 (base grafito + acento
elegido). Describe lo que HAY, no lo que se propone: la propuesta de rediseño
vive en `docs/auditoria-visual-2-2026-09.md`.

## 1. Visual Theme & Atmosphere

**Creative North Star: "El tablero del vestuario".** Una consola de
entrenamiento oscura, de noche, en un gimnasio: grafito casi negro, vidrio
ahumado encima, números grandes en una condensada itálica que se lee como
dorsal o marcador deportivo, y un solo color de acento que el usuario elige y
que se enciende sólo donde hay que actuar o celebrar. El carácter lo pone la
tipografía (Barlow Condensed itálica en títulos y cifras) y la luz del acento
(degradados, halos, brillos en la arista del vidrio); la base no tiene tinte.

La densidad es de app de uso diario: una columna de 354 px (390) a 394 px
(430) con 18 px de margen, tarjetas apiladas con 10 a 12 px entre sí, y una
barra de pestañas flotante de vidrio. El fondo lleva una atmósfera fija: dos
resplandores radiales del acento (arriba al centro y abajo a la derecha) y un
grano `feTurbulence` al 4,5 %. Todo se piensa para usarse con el teléfono en
la mano entre series: botones de 52 a 58 px, cifras tabulares, textos cortos.

**Key Characteristics:**
- Base grafito neutra (`#101113`) + un acento derivado en OKLCH de un matiz (Hielo, Cobalto, Violeta, Fucsia, Monocromo o propio).
- Estados reservados: verde logrado, rojo peligro, ámbar alerta y aproximación, llama (ámbar cálido) para la racha.
- Barlow Condensed itálica 700 para títulos de pantalla, héroes y cifras; Barlow para texto corrido.
- Vidrio: grafito translúcido al 66 % (90 % en header, barra y hojas) con `blur(22px) saturate(1.2)`, borde blanco al 10 % y arista con luz del acento arriba.
- CTA primario: píldora redondeada de 18 px con degradado 112° de `accent-strong` a `accent` y un halo del acento debajo.
- Movimiento en cuatro duraciones con nombre (`--d1..--d4`) y resorte para entradas.

## 2. Color Palette & Roles

Tres familias, nombradas por función. Fuera del bloque de tokens de
`styles.css` no hay colores literales (lo vigila `colores-literales.test.js`);
un brillo es `rgba(var(--hi-rgb),α)` y una sombra `rgba(var(--shade-rgb),α)`.

### Primary Foundation
- **Grafito de fondo** (`#101113`): el piso de toda la app, `body`.
- **Grafito de tarjeta** (`#18191c`): superficie opaca, base de las hero.
- **Grafito de control** (`#202125`): chips, campos, `nav-card`, `.group`, botones fantasma.
- **Vidrio ahumado** (`rgba(34,35,39,.66)`): `.card` y `.ini-tile`, siempre con `backdrop-filter`.
- **Vidrio denso** (`rgba(34,35,39,.9)`): header, barra de pestañas, hojas; van sobre contenido que se mueve.
- **Hilo** (`rgba(255,255,255,.09)`) y **hilo fuerte** (`.16`): divisores y bordes.

### Accent & Interactive
- **Acento** (Hielo `#49cffc`; Fucsia `#ff96d3`): `oklch(.80 C h)`. Íconos activos, cifras protagonistas, rótulos de sección, foco, enlaces.
- **Acento fuerte** (Hielo `#0094bb`; Fucsia `#d04d9f`): `oklch(.62 C' h)`. Arranque de degradados, halos, tintes de fondo.
- **Texto sobre acento** (Hielo `#02141b`; Fucsia `#1b0c15`): siempre oscuro.
- **Degradado del acento**: `linear-gradient(112deg, accent-strong, accent)`. CTA, pestaña activa, segmentado activo, chip activo, barras.
- **Halo del acento**: `0 16px 40px -14px rgba(accent-strong,.55)` debajo de los CTA.

### Typography & Text Hierarchy
- **Tiza** (`#f3f4f6`): texto principal.
- **Plomo** (`#b1b1b9`): secundario, subtítulos, pestañas inactivas.
- **Ceniza** (`#97979f`): terciario, placeholders, lo apagado. Contraste ≥ 4.5 medido sobre la peor hero.

### Functional States
- **Logrado** (`#34D399`, degradado a `#0E9F6E`): sesión hecha, serie lista, subiste, días entrenados.
- **Peligro** (`#F87171`): bajaste, borrar, faltas.
- **Alerta** (`#FBBF24`, degradado a `#E0A020`): aviso, aproximación de la rampa, calentamiento, grupo flojo.
- **Llama** (`#FFC46B`): la racha del header, el único acento cálido fijo.
- **Mapa muscular**: tres escalones de luz del acento (hoy/ayer, 2-3 días, 4-6 días) y ámbar de estado para 7+ días; grafito para "sin registro".

**The Reserved State Rule.** Verde, rojo y ámbar significan logro, peligro y
alerta. El acento nunca se acerca a menos de 20° de ellos.

## 3. Typography Rules

**Display Font:** Barlow Condensed (Google Fonts), cargada en 500, 600, 700 y
700 itálica.
**Body Font:** Barlow, cargada en 400, 500, 600 y 700.
`font-synthesis: none` en `:root`: un peso no cargado cae al más cercano, no
se finge.

**Character:** la condensada itálica es la voz deportiva (dorsal, marcador,
cronómetro); Barlow es la misma familia en ancho normal, así que el cruce es
invisible.

### Hierarchy & Weights
Escala en `@theme` (Tailwind genera `text-*` con los mismos valores):
nano 10, micro 11, sm 13, body 15, lg 18, xl 22, 2xl 26, display 34, hero 44,
más cinco tamaños protagonistas fuera de escala a propósito (40 título de
pantalla, 46 nombre del día, 52/54 cifras grandes, 56/64 cronómetros).

- **Título de pantalla** (Cond 700 itálica, 40 px, versales, `.vtitle h1`): "ENTRENO", "COMIDA", "PROGRESO", con la fecha o el subtítulo en Barlow 13 versales al lado, alineado a la línea base.
- **Nombre del día** (Cond 700 itálica, 46 px, `.hero-day`) en la hero de Hoy; 34 px en la hero de Entreno.
- **Título de Inicio** (Cond itálica 34 px, `.ini-title`, tracking −.03em).
- **Título de hoja** (Cond 700 itálica, 26 px, caja normal, `#sheet h2`).
- **Título de sección** (Cond 700, 15 px, versales, tracking .18em, acento, con raya a la derecha, `.sect`).
- **Rótulo de tarjeta** (Cond 700, 13 px, versales, tracking .14em, acento, con rayita vertical, `.ini-tile-lbl`).
- **Eyebrow** (Barlow 700, 11 px, versales, tracking .18em, acento, `.hero-eyebrow`).
- **Nombre de fila** (Cond 700, 22 px: turnos, ejercicios de Plan de hoy) o Barlow 600, 15 px (`nav-card`, listas de hoja).
- **Cuerpo** (Barlow 400, 15 px / 1.5) y **secundario** (13 px, plomo).
- **Etiqueta de cifra** (Barlow 11 px, versales, tracking .14em, plomo): "EJERCICIOS", "SERIES", "RACHA ACTUAL".
- **CTA** (Cond 700, 18 px, versales, tracking .09em; 22 px y .12–.14em en los CTA de héroe).

### Spacing Principles
- Cifras con `tabular-nums` (`.cond`, `.num`, `.bignum`, cronómetro).
- Tracking positivo en todo lo versal (de .06em a .2em), negativo sólo en el título de Inicio.
- El texto corrido nunca pasa de un renglón de columna (~50 caracteres a 390).

## 4. Component Stylings

### Buttons
- **Primario** (`.btn`): píldora de 18 px de radio, 52 px de alto mínimo, a todo el ancho, degradado del acento, texto oscuro en condensada versal, halo del acento. Lleva un brillo que barre cada 3,2 s (`::after`). Press: `scale(.96)` en 50 ms, vuelta con resorte `--d1`.
- **Héroe** (`.hero-cta`, `.ini-cta`): 56 a 58 px, texto 18 a 22 px. `ENTRENAR` lleva un filo de luz cónico que gira cada 5 s; `SEGUIR` late (opacidad 1 → .4 cada 2 s).
- **Fantasma** (`.btn.ghost`): grafito de control, borde hilo fuerte, texto acento.
- **Apagado** (`.btn.dim`): grafito, texto plomo. **Peligro** (`.btn.danger`): rojo al 12 % con borde rojo. **Logrado** (`.btn.ok`): degradado verde.
- **Chico** (`.btn.sm`): 44 px, radio 12, texto 15.
- **Ícono** (`.icon-btn`): 38×38, radio 12, degradado blanco 9 %→2 %, borde blanco 10 %.

### Cards & Containers
- **Tarjeta** (`.card`): vidrio ahumado + brillo metálico arriba, radio 18, padding 16, arista del acento, sombra `0 14px 34px -18px`.
- **Hero** (`.card.hero`): radio 26, padding 20, tinte del acento en la esquina (158°) y un halo radial de 210 px arriba a la derecha.
- **Tarjeta de Inicio** (`.ini-tile`): vidrio + tinte del acento 155° + reflejo diagonal (`::after`) + rótulo con rayita.
- **Tarjeta de navegación** (`.nav-card`): grafito de control opaco, radio 18, ícono de 38 px en cajita tintada, título + subtítulo + chevron.
- **Turno** (`.day-card`): degradado blanco 7,5 %→2 %, sin blur ni sombra, insignia numerada a la izquierda.
- **Lista agrupada** (`.group` + `.grouprow`): grafito de control, filas de 56 px con hilo entre ellas.
- **Aviso** (`.notice`): sin caja, sólo una raya de 2 px a la izquierda (ok o warn).

### Navigation
- **Header** (`header.top`): sticky, degradado grafito .92→.75 + `blur(14px)`, marca "FIERRO" en condensada itálica 22 px con degradado de tiza al acento y la mancuerna; a la derecha, píldora de racha (llama) y dos botones de ícono.
- **Barra de pestañas** (`nav.tabbar`): flotante a 18 px de los bordes y 16 px del pie, radio 26, padding 7, vidrio denso. Cuatro pestañas con ícono de trazo y rótulo condensado versal 11 px. La activa es una píldora con el degradado del acento que se desliza (`.tab-ind`, `--d3`).
- **Segmentado** (`.seg`): riel blanco al 5 %, radio 18, botones condensados versales; el activo con el degradado y halo.

### Inputs & Forms
- **Campo** (`.field input/select`): grafito de control, radio 12, padding 14, texto 18; foco = borde `accent-strong`. Rótulo encima en Barlow 11 versal plomo.
- **Chip** (`.chip`): píldora, grafito de control, borde hilo fuerte; activo con el degradado.
- **Rueda** (`ReelPicker`): peso y reps con el valor central en una caja tintada del acento.

### Domain-Specific Components
- **Tarjeta del ejercicio en vivo** (`ExerciseCarousel`): tablero Series / RIR / Sesión anterior, rampa de aproximación en ámbar, ruedas de peso y reps, botón `SERIE N LISTA` verde con un círculo de check.
- **Descanso a pantalla completa** (`#rest-fs`): anillo del acento con resplandor (`glowring`), cronómetro de 54 px, pregunta de RIR segmentada, −30 s / +30 s / Saltar.
- **Silueta muscular** (`Silhouette`): cuerpo SVG con degradados por zona, frente/espalda, ficha de músculo flotante (`.mpop`).
- **Resumen de sesión** (`SessionView`): cifras en fila, tarjetas con riel vertical de 4 px coloreado por variación (sube, baja, igual, PR).

## 5. Layout Principles

### Grid & Structure
- Una columna, `max-width: 520px` centrada, margen lateral `--pad-x` 18 px.
- Inicio usa un grid asimétrico de 2 columnas: el cuerpo ocupa las dos, debajo Racha / Más flojo y Calorías / Peso.
- La sesión en vivo entra en una pantalla sin scroll (844 px a 390).
- Las hojas suben desde abajo hasta 88 dvh, radio 26 arriba.

### Whitespace Strategy
- Escala de espacio de seis pasos: 4, 8, 12, 16, 24, 32. En uso real, 10, 14, 7, 5, 6 y 18 px aparecen más que la mitad de la escala (medido: 2.142 declaraciones fuera de escala contra 1.374 dentro, en las cuatro pestañas).
- Entre tarjetas 10 a 12 px; dentro, 14 a 20 px.

### Alignment & Visual Balance
- Todo arranca en x = 18: marca, título, tarjetas, barra.
- Texto a la izquierda, salvo dos tarjetas de Inicio (Racha, Más flojo) y los diálogos centrados.

### Responsive Behavior & Touch
- Probado a 390×844 y 430×932; ninguna pantalla desborda a lo ancho.
- Área táctil mínima buscada: 44 px (con `::after` invisible donde el dibujo es más chico).
- Foco visible: anillo del acento de 2 px + halo del fondo de 4 px.

### Elevation & Depth
Híbrido: capas tonales (grafito → control → vidrio) más sombras difusas
hacia abajo (`0 14px 30-34px -18px`) y una arista interior (luz del acento
arriba al 22 %, sombra abajo al 50 %). El brillo lo ponen los halos del acento
debajo de los CTA y los resplandores radiales dentro de las hero.

### Motion
- Duraciones: `--d1` 150 ms toque, `--d2` 220 ms objeto, `--d3` 320 ms panel, `--d4` 460 ms momento (espejo en `D` de `lib/motion.js`).
- Curvas: `--ease` (.22,.9,.28,1), `--ease-out` (.16,1,.3,1), `--spring` (.34,1.56,.64,1) para entradas, `--ease-push` (.4,0,.2,1) para el deslizamiento de pestaña.
- Loops permanentes: brillo de `.btn` (3,2 s), filo de `ENTRENAR` (5 s), latido de `SEGUIR` (2 s), resplandor del descanso (2,4 s).
- `prefers-reduced-motion` y `menosMovimiento()` apagan loops y giros.

## 6. Design System Notes for Stitch Generation

### Language to Use
"Consola deportiva oscura de grafito, vidrio ahumado con arista iluminada,
títulos en condensada itálica pesada en versales, cifras grandes tabulares,
un solo acento luminoso en degradado, estados en verde, rojo y ámbar."

### Color References
Grafito de fondo `#101113`, grafito de tarjeta `#18191c`, grafito de control
`#202125`, tiza `#f3f4f6`, plomo `#b1b1b9`, ceniza `#97979f`, acento Hielo
`#49cffc` sobre `#0094bb`, logrado `#34D399`, peligro `#F87171`, alerta
`#FBBF24`, llama `#FFC46B`.

### Component Prompts
- "Tarjeta hero de vidrio ahumado con radio 26, el nombre del día en Barlow Condensed itálica 46 px, tres cifras tabulares con etiqueta versal chica debajo, y un CTA píldora con degradado del acento a todo el ancho."
- "Lista de turnos: filas de radio 18 con insignia numerada tintada del acento, nombre en condensada 22 px, subtítulo 13 px plomo y chevron."
- "Barra de pestañas flotante de vidrio denso, radio 26, cuatro íconos de trazo con rótulo condensado versal, la activa como píldora con el degradado del acento."

### Incremental Iteration
Usar siempre los patrones existentes (`.card`, `.nav-card`, `.chip`,
`.group`/`.grouprow`, `.btn`), tokens para color, radio, espacio y duración,
y verificar en el build de producción a 390 y 430 px con dos acentos.
