⚠️ DEGRADED: single-context (sin subagentes: la tarea pedía hacer el trabajo acá; el detector `impeccable detect` no se corrió porque está prohibido ejecutar `scripts/impeccable` o binarios que descargan. Evidencia mecánica reemplazada por medidores propios en Chrome, ver "Cómo se hizo").

# Auditoría visual 2 — 2026-09-28

Pedido de Enzo: "vuelve a hacer auditoría o rediseño visual de la app". Su
estética: oscura, condensada itálica tipo deportiva, vidrio, "que todo sea
estético, alineado". Esta pasada es de **dirección visual** (jerarquía,
tipografía, ritmo, densidad, composición, consistencia de componentes,
iconografía, color en uso, movimiento percibido, "se ve template", microcopy).
**No repite** los hallazgos de `docs/auditoria-total-2026-09.md` (G1–G17,
I1–I4, H2–H9, E1–E7, C1–C2, P1–P3, B1–B3, A1–A3, M1, Z1–Z3) ni los de
`docs/auditoria-visual-2026-09-26.md`; cuando un hallazgo nuevo se apoya en
uno viejo, lo cita por su ID. No se tocó código de la app.

El sistema visual real quedó documentado en [`DESIGN.md`](../DESIGN.md).

## Cómo se hizo

- **Base:** `origin/main` = #125 (`3c44295`, base grafito + acento elegido), worktree `docs/auditoria-visual-2`.
- **Build de producción** (`npx vite build` + `npx vite preview --port 4185`), nunca el dev server. Service worker desregistrado y caches borradas. Chrome vía MCP chrome-devtools, pestaña propia en contexto aislado, emulando teléfono (touch, DPR 3) a **390×844** y **430×932**.
- **Datos:** `seedRegistro()` desde Ajustes. Para la sesión en vivo, `initScript` que adelanta `Date` uno y dos días (el seed marca hoy como hecho).
- **Acentos:** Hielo (de fábrica) a 390 y Fucsia a 430, en todas las pestañas; Fucsia además en Perfil, mapa del cuerpo, ficha de músculo y ficha de ejercicio.
- **Se midió, no se miró:** un recorrido de `getComputedStyle` sobre todos los nodos de texto visibles de las cuatro pestañas (con scroll hasta el final) para contar combinaciones tipográficas, trackings, rótulos versales, radios y espaciados; `getBoundingClientRect` para alineaciones; muestreo de la opacidad de "SEGUIR" cada 200 ms y cálculo de contraste WCAG con la mezcla real sobre el grafito; `document.fonts` para los pesos realmente cargados; porcentaje de textos pintados con el acento por pantalla.
- **Skills y referencias:** `impeccable` (critique, typeset, layout, craft-floor), `design-taste-frontend`, `redesign-existing-projects`, `high-end-visual-design`, `ui-ux-pro-max` (búsquedas locales de producto y tipografía), `stitch-extract-design-md` (para `DESIGN.md`). DESIGN.md de referencia: **Nike**, **BMW M**, **Raycast** y **Spotify** (`~/.claude/references/awesome-design-md/`).

**Lectura de diseño:** app de producto (modo *Operate*) para un solo atleta
que la usa entre series, con lenguaje de consola deportiva oscura, condensada
itálica y vidrio, sobre tokens propios (no un design system oficial). Diales
leídos del estado actual: VARIANCE 4, MOTION 6, DENSITY 6. Para el rediseño
propuesto: VARIANCE 5, MOTION 5 (menos loops, un momento con autor por
pantalla), DENSITY 6.

**En paralelo (no auditado en diseño, sólo mencionado):** la rampa de un solo
botón y la previa del ejercicio (tarjeta de Hoy en vivo), el asistente de
3 pasos para agregar ejercicio, y la optimización del descanso / cambio de
pestaña. Las propuestas que tocan esas zonas van marcadas **[choca con …]** y
quedan para después de que esos PRs se mergeen.

---

## Veredicto de especificidad

**Lo que es de FIERRO y ninguna otra app podría usar tal cual:** la voz
tipográfica (Barlow Condensed itálica en versales para títulos y cifras), la
silueta muscular con su escala de luz del acento y su ficha, el tablero de la
sesión en vivo (Series / RIR / Sesión anterior + botón "SERIE 1 LISTA"), el
riel de variación del resumen, y el sistema de acento elegible con estados
reservados (#125). Ahí la app tiene carácter.

**Lo que es de categoría (intercambiable):** el resto de la piel. Cada
contenedor lleva la misma receta de "tarjeta oscura premium": vidrio + tinte
del acento en la esquina + un orbe radial arriba a la derecha + reflejo
diagonal + rótulo versal en el acento con una rayita. Encima de cada título
hay un *eyebrow* versal espaciado ("COMPLETADO · HOY", "PLAN ACTIVO",
"PESO · PROMEDIO 4 DÍAS", "TOCA HOY" con punto). Es exactamente el patrón que
`impeccable` (craft-floor: "a kicker or eyebrow above a heading… is a ban")
y `design-taste` (§4.7 "Eyebrow restraint", §9.A "no neon/outer glows")
señalan como firma de plantilla. Hasta la pareja tipográfica es la que la base
de `ui-ux-pro-max` devuelve por defecto para "Sports/Fitness" (Barlow
Condensed + Barlow): no es mala, pero hoy se usa en su registro más tímido
(700, con el 800 declarado pero no cargado, V8).

**La mayor oportunidad:** dejar que las **cifras y la condensada** sean el
diseño, como hacen Nike (un solo nivel de display gigante y todo lo demás
callado) y BMW M (negro, blanco, versales pesadas y el color de marca sólo
como firma), y sacarle a cada tarjeta la luz decorativa para que el acento
vuelva a significar "acá se actúa".

---

## Puntaje por pantalla

Rúbrica visual 0–4 por eje (0 roto, 2 aceptable con deriva visible, 4
excelente): **J** jerarquía, **T** tipografía, **R** ritmo y espaciado,
**C** consistencia de componentes, **Co** color en uso, **E** especificidad
(no se ve template). Máximo 24.

| Pantalla | J | T | R | C | Co | E | Total | Lo que más pesa |
|---|---|---|---|---|---|---|---|---|
| Inicio | 3 | 3 | 2 | 2 | 2 | 3 | **15** | SEGUIR apagado (V1); 5 rótulos en acento (V2); tarjetas de altura y alineación dispares |
| Hoy sin sesión | 4 | 3 | 3 | 3 | 3 | 3 | **19** | La mejor composición de la app: un héroe, un CTA, una lista |
| Hoy en vivo | 3 | 3 | 3 | 3 | 3 | 3 | **18** | Tablero claro; mitad inferior vacía **[en construcción: previa]** |
| Descanso | 3 | 3 | 2 | 3 | 3 | 3 | **17** | Cronómetro fuerte; 170 px vacíos arriba y el rótulo lejos del reloj |
| Fin de sesión (resumen) | 3 | 2 | 3 | 3 | 3 | 2 | **16** | Emoji en el título (H9); cifras sin jerarquía entre sí |
| Entreno | 2 | 2 | 2 | 2 | 3 | 2 | **13** | Pila de 7 bloques de peso parecido; aviso de 16 px sobre título de 13 (V8) |
| Editor + hoja del turno | 3 | 2 | 3 | 2 | 3 | 2 | **15** | Nombres en Barlow en la hoja y en condensada en Plan de hoy (V9) |
| Mis rutinas | 3 | 2 | 3 | 2 | 2 | 2 | **14** | "EN USO" en verde de logro (V6); rótulo gris distinto de todos (V3) |
| Comida | 2 | 2 | 2 | 2 | 2 | 2 | **12** | Tres voces de fila tocable (V9); carbos verde y grasa ámbar (V6) |
| Progreso + historial | 2 | 3 | 2 | 2 | 1 | 2 | **12** | 24 % del texto en acento (V2); bloque rojo de "faltas" inventadas (V7) |
| Ajustes | 3 | 3 | 3 | 3 | 4 | 3 | **19** | La vista previa del acento es un buen componente propio |
| Perfil y macros | 3 | 2 | 3 | 2 | 3 | 2 | **15** | Dos estilos de rótulo en el mismo formulario (V3); chevron azulado (V11) |
| Mapa del cuerpo + ficha de músculo | 4 | 3 | 3 | 3 | 3 | 4 | **20** | Lo más específico y logrado de la app |

**Promedio: 15,8 / 24 (66 %).** Las pantallas "de un solo trabajo" (Hoy,
Ajustes, mapa) están bien; las pantallas "tablero" (Inicio, Entreno, Comida,
Progreso) son las que se ven genéricas y desalineadas, porque ahí es donde
cada bloque trae su propia receta de superficie, rótulo y luz.

### Heurísticas de Nielsen (toda la app, lente visual)

| # | Heurística | Puntaje | Clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Estado de sesión, racha y descanso siempre visibles; SEGUIR parece deshabilitado la mitad del tiempo (V1) |
| 2 | Lenguaje del usuario | 3 | Voseo y términos de gimnasio; "PRS · RÉCORDS PERSONALES" repite lo mismo (V12) |
| 3 | Control y libertad | 3 | Hojas con cierre, deshacer en "Después" |
| 4 | Consistencia y estándares | 2 | 14 estilos de rótulo, 13 recetas de superficie, 3 voces de fila (V3, V4, V9) |
| 5 | Prevención de errores | 3 | Confirmaciones en borrar y terminar |
| 6 | Reconocer antes que recordar | 3 | Íconos con rótulo en la barra |
| 7 | Flexibilidad y eficiencia | 2 | Un toque en Comida, pero la mayoría de los caminos tiene uno solo |
| 8 | Estética y minimalismo | 2 | Luz decorativa en cada tarjeta, eyebrows en cada título (V5, V12) |
| 9 | Recuperación de errores | 3 | — |
| 10 | Ayuda y documentación | 2 | Guía en Progreso; textos de ayuda largos en Mis rutinas y el mapa |
| **Total** | | **26 / 40** | **Aceptable** (65 %) |

### Carga cognitiva (checklist de impeccable)

Fallan 3 de 8 (moderada): **jerarquía visual** en Inicio/Entreno/Progreso (el
acento está en 5 a 9 lugares a la vez), **opciones mínimas** en Entreno (7
bloques tocables antes de la lista de turnos: hero, CTA, 2 nav-cards, aviso,
porciones, turnos) y **agrupamiento** en Comida (tres tipos de fila tocable
distintos para acciones hermanas).

---

## Qué funciona (conservar)

1. **La voz condensada itálica en versales para títulos de pantalla y del día** ("ENTRENO", "Anterior A" a 46 px). Es la identidad; Nike y BMW M hacen lo mismo con su display pesado.
2. **Hoy sin sesión** (`50-hoy-sin-sesion-390-hielo.png`): héroe con tres cifras tabulares, un CTA, dos acciones secundarias, y Plan de hoy con grupos numerados. Es la composición a copiar en las demás pantallas.
3. **El mapa del cuerpo y la ficha de músculo** (`60`, `61`): la escala de luz del acento funciona con Fucsia igual que con Hielo, la ficha tiene jerarquía clara (nombre, "hoy", tres cifras, desglose, tope en ámbar).
4. **La vista previa del acento en Ajustes** (`20-ajustes-390-hielo.png`): enseña la paleta real, estados incluidos.

---

## Hallazgos

Severidad visual: **Alta** = rompe la lectura o miente; **Media** = deriva que
se nota y se acumula; **Baja** = pulido. Capturas en
`C:/Users/LENOVO/AppData/Local/Temp/claude/c--Users-LENOVO-Documents-Enzo-Gymapp/3ed2a546-867f-40c4-be4e-07fc30cc3c00/scratchpad/auditoria-visual-2/`.

### V1 · ALTA · "SEGUIR" late con la opacidad de todo el botón: con Fucsia se ve malva y apagado

- **Dónde:** `web/src/styles.css:3165` (`.ini-cta.pulse{animation:pulse 2s infinite}`), `:627` (`@keyframes pulse{50%{opacity:.4}}`); lo aplica `web/src/components/screens/Inicio.jsx:103`.
- **Evidencia (Fucsia, 430):** `getAnimations()` en `.ini-cta` = `pulse`, 2000 ms, infinito. Opacidad muestreada cada 200 ms: **0,54 · 0,51 · 0,53 · 0,74 · 0,89 · 0,97 · 1,00 · 0,94 · 0,73 · 0,58**: la mitad del ciclo está por debajo de 0,75. La pestaña activa (`.tab-ind`, `styles.css:1943`) tiene el **mismo** degradado (`linear-gradient(112deg, #d04d9f, #ff96d3)`) pero no anima: siempre a opacidad 1.
- **Por qué se ve malva:** la opacidad no baja el brillo del rosa, lo **mezcla con el grafito** `#101113`. Al 40 % el arranque del degradado pasa de `rgb(208,77,159)` a `rgb(93,41,75)` y el final de `rgb(255,150,211)` a `rgb(112,70,96)`: un ciruela desaturado, o sea malva. Con Hielo pasa lo mismo (el cian al 40 % queda `rgb(10,70,87)`, un petróleo), pero el cian apagado se lee "más oscuro", no "otro color"; el magenta mezclado con gris sí cambia de nombre. Además el texto también se funde: el contraste de "SEGUIR" sobre el arranque cae de **4,72 a 1,70** y el de "0 de 9" (que ya va a opacidad .65) de **2,98 a 1,48**. En el valle del ciclo el botón es ilegible.
- **Captura:** `04-inicio-seguir-430-fucsia.png` (tomada cerca del valle) contra `03-inicio-entrenar-430-fucsia.png` (ENTRENAR, sin pulso).
- **Arreglo propuesto:** nunca animar la opacidad de un CTA. Si "sesión en curso" necesita vida, que lata un **anillo exterior** (pseudo-elemento con la sombra ya pintada, animando sólo su `opacity` y `scale`) o que el botón muestre el **avance como relleno** ("0 de 9" como barra dentro del botón). El botón queda a opacidad 1 y con contraste ≥ 4,5 siempre.

### V2 · ALTA · El acento se gasta en rótulos: el CTA deja de ser lo único encendido

- **Evidencia (textos visibles pintados con `--accent`, Fucsia 430):** Inicio **9 de 37 (24 %)**: "Sesión en curso", "Tu cuerpo", "Ver mapa ›", "Racha", "Más flojo", "Calorías", "Peso", "Tu Año Fierro →", "Lun". Progreso **48 de 203 (24 %)**: el eyebrow del peso, "+0.2 kg/sem", "+ Registro", cada título de sección y, en **cada tarjeta de sesión**, la línea de metadatos "21 series · 7285 kg de volumen". Además las cifras de las tarjetas de Inicio van con el degradado del acento como texto (3 textos con relleno transparente en Inicio: marca, racha, peso).
- **Dónde:** `.ini-tile-lbl` (`styles.css:3231-3237`, acento + rayita), `.ini-tile-num` (`:3251`, degradado recortado al texto), `.sect` (`:2129`), `#sheet h3` (`:2104`), `.hero-eyebrow` (`:2508`), metadatos de `SessionCard.jsx`.
- **Por qué importa:** con cinco rótulos, dos enlaces y dos cifras en el mismo color que el CTA, el ojo no tiene un primero. Spotify usa su verde sólo en play y estado activo; Raycast deja todo monocromo salvo el CTA blanco; Nike guarda el color para el precio de oferta. La base grafito de #125 se pensó exactamente para eso, pero los rótulos se quedaron del sistema anterior (auditoría del 26 los pasó a azul para que "resalten").
- **Arreglo:** rótulos de tarjeta y de sección en **tiza/plomo** (la jerarquía la da el peso y el tamaño, no el color); acento sólo en: acción primaria, estado activo (pestaña, segmentado, chip), la cifra protagonista de cada pantalla y el dato del cuerpo. Objetivo medible: ≤ 8 % de los textos de una pantalla en acento.

### V3 · ALTA · Catorce estilos de rótulo versal y siete niveles de título

- **Evidencia:** recorriendo las cuatro pestañas, **14 firmas distintas** de rótulo versal chico (familia + tamaño + peso + tracking + color), **23 valores distintos de `letter-spacing`**, y 52 reglas `text-transform:uppercase` en `styles.css`. Ejemplos: `.ini-eyebrow` Cond 11/700 .16em acento; `.ini-tile-lbl` Cond 13/700 .14em acento con rayita; `.hero-eyebrow` **Barlow** 11/700 .18em acento; `.sect` Cond 15/700 .18em acento con raya; `#sheet h3` Cond 15/700 .12em acento; `.field label` Barlow 11/700 .14em **plomo**; etiquetas de cifra Barlow 11/400 .14em plomo; `.eyebrow` de Mis rutinas en plomo.
- **Mismo formulario, dos voces:** en Perfil, "SEXO", "NIVEL DE ACTIVIDAD" y "OBJETIVO" son `#sheet h3` (acento, condensada 15) y "EDAD", "ALTURA (CM)", "PESO (KG)" son `.field label` (plomo, Barlow 11). Captura `21-perfil-430-fucsia.png`. En Mis rutinas, "LA QUE ESTÁS USANDO" (`Library.jsx:107`, `.eyebrow` plomo) convive con los `.sect` en acento del resto de la app.
- **Títulos:** título de pantalla (40 itálica versal), nombre del día (46 itálica), título de Inicio (34 itálica, −.03em), título de hoja (26 itálica), `.plan-title` (26 itálica con degradado y resplandor), `.sect` (15 versal con raya), `.ini-tile-lbl` (13 versal con rayita). Siete escalones para una app de una columna.
- **Arreglo:** tres roles y nada más. **Título** (condensada itálica, 40 / 26 según pantalla u hoja), **sección** (condensada 15 versal, tiza, raya a la derecha; el `.sect` actual sin acento) y **etiqueta** (Barlow 11 versal plomo, .12em, la de las cifras y los campos). Eyebrows fuera (V12).

### V4 · MEDIA · Trece recetas de superficie para "una tarjeta"; el vidrio aparece en unas sí y en otras no

- **Evidencia:** contenedores de radio ≥ 12 y ≥ 200 px de ancho en las cuatro pestañas: **13 combinaciones distintas** de fondo, borde, blur y sombra. Con `backdrop-filter`: `.card`, `.card.hero`, `.ini-tile`. Sin blur: `.nav-card` (grafito opaco `#202125`, `:2579`), `.day-card` (degradado blanco 7,5→2 % a 158°, `:2598`), `.pw-btn` (degradado a 135°, `:2254`), `.calcbox.blue` (acento al 9 %, `:2219`), `.seg` (blanco al 5 %). Los ángulos del tinte cambian entre 112°, 135°, 155° y 158°.
- **Efecto:** Entreno, que es la pestaña con más tarjetas, casi no tiene vidrio real: sólo la hero. Las `nav-card` de "Mis rutinas" y "Ver mis gimnasios" se ven como botones de otro sistema pegados entre la hero y los turnos (`10b-entreno-390-hielo-top.png`).
- **Arreglo:** tres superficies con nombre: **vidrio** (lo que flota o encabeza: hero, header, barra, hoja), **control** (grafito `surface-2`, para filas tocables y grupos) y **plana** (sin caja, para avisos y texto). Un solo ángulo de tinte (158°) y sólo en la hero.

### V5 · MEDIA · Un orbe de luz en la esquina de cada tarjeta

- **Evidencia:** halo radial arriba a la derecha en `.card.hero::before` (`styles.css:658`, 210 px), `.card.hero.hero-plan::before` (`:2504`, 200 px), `.ini-tile-body::before` (`:3244`, 150 px), más la hero de peso, la de calorías y "La que estás usando". Sumado al resplandor fijo del `body::before` (`:275-281`) y al reflejo diagonal de `.ini-tile::after` (`:3223`). Con Fucsia, el orbe tiñe de rosa media tarjeta (`32-comida-430-fucsia.png`, hero de calorías).
- **Por qué importa:** es la decoración que más delata plantilla ("AI glow", `design-taste` §9.A; `impeccable` craft-floor "glass and blur as decoration"). Repetida en cada tarjeta deja de ser luz y pasa a ser textura; y al ser del acento, compite con el CTA (V2).
- **Arreglo:** **una fuente de luz por pantalla**: la hero de arriba conserva su halo, el resto de las tarjetas no lleva orbe ni reflejo diagonal. El vidrio se lee por el blur, el borde y la arista, que ya existen.

### V6 · MEDIA · Los colores de estado se usan como colores de categoría

- **Evidencia:** en Comida, **Carbos** en degradado verde de logro y **Grasa** en ámbar de alerta (`styles.css:1788-1790`); con Fucsia la barra de proteína es rosa, la de carbos verde y la de grasa amarilla: tres colores sin significado (`30-comida-390-hielo.png`, `32`). En Inicio, "Al día · **nada flojo esta semana**" va en ámbar de alerta (`.ini-tile-stale-days`, `styles.css:3260`, texto en `Inicio.jsx:339-341`): un mensaje positivo pintado como aviso. En Mis rutinas, "EN USO" en verde de logro.
- **Por qué importa:** contradice la regla de #125 ("verde logrado, rojo peligro, ámbar alerta, reservados"). Si el ámbar dice "todo bien" en Inicio, pierde fuerza cuando dice "descarga" en Entreno.
- **Arreglo:** macros en tres luces del acento (como ya hace el mapa muscular) o en neutro con la cifra fuerte; verde sólo cuando se cumplió la meta, ámbar sólo si se pasó. "nada flojo esta semana" en plomo. "EN USO" en tiza con borde.

### V7 · MEDIA · El mapa de racha pinta de rojo tres semanas en las que la app no existía

- **Evidencia:** `streakHeatmap()` (`web/src/lib/streak.ts:160-178`) arranca siempre 56 días atrás y marca como `miss` toda tanda sin sesión más larga que la tolerancia, **también antes de la primera sesión registrada**. Con el seed: 21 de 56 celdas `miss` (las tres primeras columnas enteras), pintadas con `.cell.miss` rojo (`styles.css:400`). Es el bloque de color más grande de Progreso (`42-progreso-390-hielo-abajo.png`) y además baja el "49 % cumplimiento".
- **Por qué importa:** visualmente, la pantalla de progreso abre su tarjeta de constancia con un castigo rojo; de producto, afirma faltas que no puede sostener (el criterio de CLAUDE.md: "no inventa datos").
- **Arreglo:** estado `antes` para los días previos a la primera sesión, pintado como celda vacía de grafito, y el porcentaje contado desde ese día.

### V8 · MEDIA · La escala tipográfica tiene fugas y un peso que no existe

- **Body sin tamaño:** el `body` (`styles.css:264-272`) no define `font-size`, así que todo texto sin clase cae al **16 px del navegador**, que no está en la escala (el cuerpo es 15). Caso visible: el aviso de descarga de Entreno (`Rutina.jsx:319`, `.s` sin regla global) tiene el título en **13 px** y el cuerpo en **16 px**: la jerarquía queda invertida (`10c-entreno-390-hielo-medio.png`).
- **`text-xs` sin redefinir:** `@theme` redefine `sm`, `lg`, `xl`… pero no `xs`, que queda en el 12 px de Tailwind. Caso: la leyenda del gráfico de carga (`Progreso.jsx:181`).
- **El 800 que no está:** `.ini-title` (`:3139`), `.ini-cta` (`:3155`) e `.ini-tile-num` (`:3251`) piden peso **800**, pero `index.html:11` sólo carga Barlow Condensed 500/600/700 y 700 itálica (verificado en `document.fonts`: 600, 700 y 700 itálica cargadas). Con `font-synthesis:none` se dibujan en 700: Inicio **cree** que es más pesado que el resto y no lo es. El propio comentario de `:3178` lo reconoce para ENTRENAR.
- **Medido:** 32 combinaciones distintas de familia/tamaño/peso/estilo en las cuatro pestañas, 11 tamaños (11, 12, 13, 15, 16, 18, 22, 26, 34, 40, 54), de los cuales 12 y 16 son fugas.
- **Arreglo:** `body{font-size:var(--t-body)}`; `--text-xs` en `@theme` apuntando a micro (o prohibido); y decidir el peso display (ver Tanda B: cargar el 800 itálico **a propósito**, que es el "golpe" deportivo que hoy falta).

### V9 · MEDIA · Tres voces para una fila tocable

- **Evidencia:** en Entreno, "Mis rutinas" y "Ver mis gimnasios" (`.nav-card .t`) en **Barlow 15/600**; en Comida, "Calcular mis macros" (`.profcard .pt`, `styles.css:2231`) en **condensada 18/700** y "Registrar por voz" (`.pw-btn`, `:2254`) en **condensada 18/700 con el subtítulo al lado** en vez de abajo. Los ejercicios se llaman en **condensada 22** en Plan de hoy y en **Barlow 15** en la hoja del turno (`12-turno-editor-390-hielo.png`). Los íconos de esas filas son emoji a todo color (📚 🏋 🎯 🎙, ya registrado como G7) y son el único objeto policromo sobre el grafito.
- **Arreglo:** una sola fila tocable (`.nav-card`, título Barlow 15/600, subtítulo 13 plomo debajo, chevron) con ícono SVG de trazo en su cajita; la condensada queda para nombres de turno y de ejercicio **en todos lados**.

### V10 · MEDIA · Ritmo monótono: todo está a 10–12 px de todo

- **Evidencia:** en las cuatro pestañas hay **2.142 declaraciones de espacio fuera de la escala** (4/8/12/16/24/32) contra 1.374 dentro. Los más usados fuera: 10 px (474), 14 (252), 7 (210), 5 (168), 6 (156), 18 (72). En Entreno la pila hero → CTA → nav-card → nav-card → aviso → porciones → turnos va a 10–16 px entre bloques, sin un salto mayor entre grupos: la lista de turnos (lo que se viene a ver) empieza a 1.120 px de altura, debajo de dos pantallas de accesorios.
- **Arreglo:** 12 dentro de un grupo, **28–32 entre grupos**; en Entreno, hero + CTA arriba, los dos accesos como un `.group` de dos filas, y los turnos inmediatamente después.

### V11 · BAJA · El chevron del select sigue en el azul del sistema viejo

- **Dónde:** `styles.css:1888`, `stroke='%238B97B4'` dentro del `data:` SVG. Es un gris azulado de la paleta navy anterior: con cualquier acento, y más con Fucsia, la flecha de "Moderado" y "Déficit moderado" se ve fría (`21-perfil-430-fucsia.png`). `colores-literales.test.js` no mira dentro de los `data:` URI.
- **Arreglo:** una máscara (`mask-image` + `background-color: var(--text-3)`) o el color en un token; y que el test revise también los `data:`.

### V12 · MEDIA · Eyebrows, puntos y "·" como decoración de microcopy

- **Evidencia:** eyebrow encima de casi cada título: "COMPLETADO · HOY" / "SESIÓN EN CURSO" (Inicio), "TOCA HOY" con punto decorativo (`Hoy.jsx:367`), "PLAN ACTIVO" (`Rutina.jsx:172`), "PESO · PROMEDIO 4 DÍAS" (`Progreso.jsx:92`), "EXCEDENTE/RESTANTES" (`Nutricion.jsx:200`). Rótulos que se repiten a sí mismos: "PRS · RÉCORDS PERSONALES", "MEDIDAS · ÚLTIMO REGISTRO". El "·" separa casi todas las líneas de metadatos (hasta 3 por línea: "Anterior / Posterior · 4 entrenamientos · guardadas, plantillas…").
- **Por qué importa:** `impeccable` lo prohíbe sin excepción ("delete the label and let the heading speak") y `design-taste` lo pone como la regla más violada. Acá además cada eyebrow está en acento (V2).
- **Arreglo:** el título habla solo; lo que el eyebrow dice útil pasa a la línea de abajo ("Anterior A" / "Sesión en curso · 0 de 9"). "Récords" y "Medidas" sin su traducción al lado. Un "·" por línea como máximo.

### V13 · BAJA · Degradado en el texto en tres lugares por pantalla

- **Evidencia:** la marca "FIERRO" (`.brand`, `styles.css:363`), `.plan-title` (`:2323`, degradado + `drop-shadow`) y las cifras de las tarjetas de Inicio (`.ini-tile-num`). `impeccable` y `design-taste` lo cuentan como tic ("emphasis comes from weight or size").
- **Arreglo:** dejarlo **sólo en la marca**, que es firma. `.plan-title` en tiza; las cifras en tiza con la unidad en plomo (como ya hace Progreso con "74.1 kg", que se ve mejor).

### V14 · BAJA · Descanso: el reloj está bien, la composición no

- **Evidencia:** en `55-descanso-390-hielo.png` el contenido empieza a 170 px del borde: arriba queda una banda vacía, el rótulo "DESCANSO" flota a 88 px de la pregunta y el botón de minimizar va desalineado (H2, ya registrado). La pregunta de RIR usa un segmentado con "0 / FALLO" en dos líneas mientras los demás tienen una.
- **Arreglo:** anclar el bloque (rótulo + reloj) al centro óptico (un poco arriba del centro) y la pregunta debajo del reloj, como paso siguiente. **[choca con la optimización del descanso]**: después de ese PR.

---

## Personas

- **Casey (con una mano, entre series):** en Inicio, con la sesión abierta, el único botón que importa ("SEGUIR") se ve deshabilitado la mitad del tiempo (V1). En Entreno, para llegar al turno de hoy hay que pasar por hero, CTA, dos accesos, un aviso y "porciones" (V10).
- **Sam (baja visión):** en el valle del pulso, "SEGUIR" queda a 1,70:1 y "0 de 9" a 1,48:1 (V1). Rótulos en acento a 11–13 px por todos lados diluyen dónde está lo tocable (V2).
- **Enzo (el dueño, ojo estético):** lo que él llama "desalineado y con cero estética" se explica casi entero por V3, V4 y V9: cada bloque trae su propio rótulo, su propia superficie y su propia voz tipográfica.

---

## Propuesta de rediseño visual

**Dirección: "Marcador".** Menos vidrio decorativo, más tablero. La
condensada itálica pesada y las cifras son el diseño; el grafito es el
estadio apagado; el acento es la luz del marcador que se enciende sólo sobre
lo que hay que hacer ahora. Se conserva todo lo que es identidad (voz
tipográfica, vidrio de header/barra/hojas/hero, acento elegible, estados,
mapa muscular) y se retira la piel de plantilla (orbes, eyebrows, rótulos en
acento, cinco recetas de tarjeta).

Cómo se va a ver: cada pantalla tiene **un** héroe de vidrio con **una** luz,
un título en condensada itálica 800, las cifras grandes en tiza, y debajo
listas en grafito de control sin brillo propio. El único objeto en acento en
el primer pantallazo es el botón de la acción (o la pestaña activa). Los
rótulos pasan a plomo y dejan de gritar.

### Tanda A · "Un acento que signifique" (bajo riesgo, alto impacto, independiente)

1. **V1**: sacar el pulso de opacidad de `SEGUIR`; anillo exterior que late o relleno de avance dentro del botón.
2. **V2**: rótulos de tarjeta (`.ini-tile-lbl`), eyebrows y metadatos del historial a tiza/plomo; acento sólo en acción, activo y cifra protagonista. Criterio: ≤ 8 % de los textos por pantalla en acento, medido igual que acá.
3. **V6**: macros sin verde/ámbar de categoría; "nada flojo" en plomo; "EN USO" neutro.
4. **V7**: estado `antes` en el mapa de racha (test de lógica incluido).
5. **V11**: chevron del select desde un token; el test de literales mira los `data:`.

Toca Inicio, Comida, Progreso, Mis rutinas y Perfil. **No choca** con los otros agentes (no toca la tarjeta del ejercicio, el asistente ni el descanso). Puede ir ya.

#### Tanda A — estado (2026-09-29, rama `feat/visual-acento`)

Hecha. Medido en el build de producción (`vite build` + `vite preview`),
service worker y caches borrados, `seedRegistro()`, con Hielo y Fucsia a
390×844 y 430×932, con el mismo medidor de este informe (nodos de texto
visibles de `main` pintados con `--accent` o con degradado recortado).

| ID | Estado | Commit | Antes → después |
|---|---|---|---|
| **V1** | ✅ Arreglado | `89068aa` | SEGUIR ya no anima la opacidad: late un anillo por fuera (`ctaAnillo`, el mismo gesto y ciclo que `rampaAnillo`). Opacidad muestreada cada 200 ms: **0,50–1,00 → 1,00 fija**. Contraste mínimo de "SEGUIR" en el ciclo: Hielo **2,19 → 5,32**, Fucsia **2,05 → 4,72**; "0 de 10": Hielo 1,76 → 5,32, Fucsia **1,69 → 4,72** (sin opacidad .65). `@keyframes pulse` borrado: SEGUIR era su único uso. |
| **V2** | ✅ Arreglado | `d6c61fa` | Texto en acento — **Inicio** (sesión en curso): **32,4 % → 2,7 %** (12 de 37 → 1, el día de hoy en la semana); Inicio "completado hoy" 33,3 % → 2,7 %. **Progreso: 23,5 % → 1,5 %** (48 de 204 → 3: "+ Registro" y "Ver todas", que son acciones). **Comida: 8,1–10,4 % → 1,6–2,1 %**. Iguales a 390 y 430 y con los dos acentos. Pasan a tiza/plomo: `.ini-tile-lbl` (y su rayita), `.ini-tile-go`, `.ini-eyebrow`, `.hero-eyebrow`, `.sect`, `#sheet h3`, `.sc-meta.strong`, `.hist-badge`, `.pr-w`, 1RM y nivel de fuerza, "Tu Año Fierro". Las cifras de las tarjetas de Inicio sin degradado recortado (de paso cubre V13 ahí). |
| **V6** | ✅ Arreglado | `89068aa`, `536912d` | Macros en tres luces del acento (tokens `--macro-*`, desde la escala del mapa): carbos ya no en verde ni grasa en ámbar; había **una segunda copia** en `.hero-kcal` que ganaba por orden y se borró. Verde sólo si la proteína se cumplió; `macroCls` ya no marca el "casi" (≥ 75 %) en ámbar. "nada flojo esta semana" y "registrá una sesión" en plomo (el ámbar queda para "hace N días"). "en uso" en tiza con borde. |
| **V7** | ✅ Arreglado | `49081b7` | Estado `antes` en `streakHeatmap()` para los días previos a la primera sesión (celda vacía, sólo el hilo). Con el seed: **21 celdas `miss` → 0** (20–21 `antes`), cumplimiento contado desde la primera sesión (49 % en el relevamiento → **100 %**). 4 tests nuevos en `streak.test.js`. |
| **V11** | ✅ Arreglado | `0bb5f73` | La flecha del select son dos gradientes con `var(--text-3)`; fuera el `%238B97B4`. `colores-literales.test.js` revisa también los `data:` URI (decodifica y mira fill/stroke/stop-color): falló con el literal viejo antes del arreglo. |

Además, pedido junto con la tanda:

- **Rueda de reps = meta de hoy** (`dac68fe`, pendiente de la rampa): `ensureVals()` arranca en `metaHoy()` cuando la meta sale de la doble progresión (subir / sostener / sumar). En vivo: "Meta de hoy 47.5 kg × 8" y la rueda en **47.5 / 8** (antes 47.5 / 6). 6 tests nuevos en `previa.test.js`.

Lo que **no** se tocó a propósito: `.grouprow-v` sigue en acento porque ahí
vive también el "Sí/No" de los interruptores (es estado); los números de la
previa y la meta de hoy en la tarjeta del ejercicio (Hoy en vivo: 6,6 %,
23 de 351, todos cifras protagonistas) quedan como están porque son zona de
la previa; el degradado de `.brand` y `.plan-title` (V13) y los eyebrows
mismos (V12) son de la tanda B.

### Tanda B · Tipografía "dorsal" [choca con rampa/previa y asistente: toca `@theme` y `styles.css` global; después de que mergeen]

1. **V8**: `body{font-size:var(--t-body)}`, `--text-xs` resuelto, y **cargar Barlow Condensed 800 itálica** (y 800 recta si se usa) para título de pantalla, nombre del día y cifras protagonistas. Es el cambio que más acerca la app a lo "deportivo" que pide Enzo: hoy todo el display está en 700.
2. **V3**: tres roles (título / sección / etiqueta) y un solo tracking por rol. `#sheet h3` y `.field label` pasan a ser el mismo rol donde conviven.
3. **V12**: fuera eyebrows y rótulos duplicados; un "·" por línea.
4. **V13**: degradado de texto sólo en la marca.
5. **V9 (parte tipográfica)**: nombres de turno y ejercicio en condensada en todas partes.

Se verá: títulos más negros y más apretados, sin la escalera de siete tamaños; debajo, texto calmo en Barlow.

#### Tanda B — estado (2026-09-29, rama `feat/visual-tipografia`)

Hecha, junto con la tanda 6 de `auditoria-total-2026-09.md`. Medido en el
build de producción (`vite build` + `vite preview` :4192), service worker
bloqueado y caches borradas, `seedRegistro()`, reloj adelantado 1-3 días para
la sesión en vivo. Hielo a 390×844 y Fucsia a 430×932.

**Medidor:** para cada nodo de texto visible, `getComputedStyle` de familia,
tamaño, peso, estilo, tracking (en em) y caja. "Antes" = `origin/main` #132
recorriendo las cuatro pestañas, Ajustes, Mis rutinas y Perfil. "Después" =
lo mismo **más** Hoy (previa, Antes de empezar, calentamiento, en vivo, serie
con rampa, descanso, terminar, fin de sesión), historial, Tu cuerpo y ficha
de músculo, en los dos anchos: el recorrido de después es más grande y aun así
da menos.

| Medida | Antes | Después |
|---|---|---|
| Tamaños distintos renderizados | 12 (10, 11, **12**, 13, 15, **16**, 18, 22, 26, 34, 40, 54) | **10** (11, 13, 15, 18, 22, 26, 34, 40, 46, 54; el 64 es la racha del fin de sesión) |
| Pesos distintos renderizados | 6 (400, 500, 600, 700, 800, 900) | **4** (400, 600, 700, 800) |
| Caras renderizadas (familia + peso + estilo) | 11 (tres pedidas y no cargadas: Cond 800, 800 itálica, 900) | **6**, las seis cargadas |
| Trackings distintos renderizados | 17 | **6** (−.01, 0, .08, .12, .14, .2 la marca) |
| Firmas de rótulo versal ≤ 15 px | 19 | **7** (1 etiqueta, 1 sección, 4 de control por tamaño/peso, 1 número en una burbuja) |
| Combinaciones familia/tamaño/peso/estilo | 38 | **24** |
| `font-size` distintos en `styles.css` | 17 (con 40/46/52/54/56/64/12.5/11 px sueltos, .65em, nano) | **11**, todos tokens |
| `letter-spacing` distintos en `styles.css` | 22 | **6**, todos tokens `--tr-*` (o 0) |
| `font-weight` en `styles.css` | 500, 600, 700, 800 | 400, 600, 700, 800 |
| Fuentes | Google Fonts: 1 CSS (1 KB) + 6 woff2 al abrir Inicio (133 KiB), Cond 500 y Barlow 500 a demanda; **no precargadas** (sin red, fuente del sistema) | 6 woff2 propias, **136.444 B (133 KiB)**, precargadas por workbox (precache 16 → 22 entradas) |

`document.fonts` después: Barlow 400/600/700 y Barlow Condensed 700/800/800
itálica, las seis `loaded`; ninguna petición a `googleapis`/`gstatic`.

| ID | Estado | Commit | Qué |
|---|---|---|---|
| **V8** | ✅ | `4103f89`, `fb3a5fe` | 800 y 800 itálica cargados de verdad (subconjunto latino, `font-display:swap`, precargados). `body{font-size:var(--t-body)}`. Escala cerrada en `@theme` (`--text-*: initial`: fuera `text-xs`, `text-base`, `text-3xl`, el nano de 10). Títulos, cifras protagonistas y CTA en 800. |
| **V3** | ✅ | `fb3a5fe`, `cbc9bb3` | Cuatro roles con un tracking cada uno (`--tr-titulo/-seccion/-etiqueta/-control`, atajos `--rol-seccion`/`--rol-etiqueta`, clase `.t-etiqueta`). 40+ reglas y 30+ usos de Tailwind migrados. En Perfil, Sexo / Actividad / Objetivo / TDEE son etiquetas de campo como Edad y Peso. |
| **V12** | ✅ | `cbc9bb3`, `121254a` | Fuera los eyebrows de Inicio ("COMPLETADO · HOY"…), Entreno ("PLAN ACTIVO"), Hoy ("TOCA HOY" con su punto, "HOY TE TOCA DESCANSAR"); en Comida y Progreso la etiqueta va debajo de la cifra. "PRs · Récords personales" → "Récords", "Medidas · último registro" → "Medidas", "Constancia · 8 semanas" → "Constancia", "Sesiones · 7 días" → "Últimos 7 días". Resumen de Mis rutinas en una frase; plantillas con coma. |
| **V13** | ✅ | `cbc9bb3` | `.plan-title` y la cifra del anillo de sesión en tiza; el degradado de texto queda sólo en la marca. |
| **V9** (parte tipográfica) | ◐ | `fb3a5fe` | Los nombres de fila ya comparten rol (Condensed 700 sin tracking); unificar la fila tocable es de la tanda C. |

Guardia nueva: `web/src/lib/__tests__/tipografia.test.js` (8 tests) falla si
se agrega una cara no cargada, un `font-size` en px, un peso fuera de
400/600/700/800, una itálica que no sea 800, un `letter-spacing` literal, o en
el JSX `font-medium`/`tracking-wide`/`text-xs`/tamaños en línea. Lo primero
que atrapó fue un bug propio (el reemplazo de familias por token había tocado
los `@font-face`).

Verificado: `scrollWidth` = ancho en todas las pantallas y hojas del
recorrido a 390 y 430; **Inicio 844/844 y 932/932** (completado, ENTRENAR y
SEGUIR); **Hoy en vivo, serie con rampa, descanso y terminar 844/844 y
932/932**; ningún texto recortado (los dos `clip:` del medidor son el brillo
de `.btn`, que es un `::after` animado, no texto).

**No se tocó a propósito:** Sheet.jsx y el movimiento de las hojas, hit
areas, AgregarEjercicio (sólo su CSS de rótulo `.asist-eyebrow`/`.asist-lbl`
pasa a etiqueta), el `::before` rayita de `.ini-tile-lbl` y `.plan-block-t`
(superficie: tanda C).

**Pendientes que deja:**
1. `.ex-group-tag` (el nombre del grupo en la banda del editor) quedó en
   plomo sobre la banda tintada del acento: si se lee apagado, la banda es de
   la tanda C.
2. La burbuja con el número de ejercicios del bloque (`.plan-block-n`) hereda
   `uppercase` sin tracking: inocuo (son dígitos), pero es la séptima firma.
3. "SESIÓN ANTERIOR" en el tablero en vivo es la etiqueta más larga de la
   app; a 11 px entra en 390 con 30 px de sobra. Si se agrega una cuarta
   columna, no entra.
4. El emoji del título "💪 Sesión guardada" y los de las filas (📚 🏋 🎯 🎙)
   siguen: son G7/H9, tanda C / tanda 8.

### Tanda C · Superficies y luz [choca con la previa (usa paneles `.card`): después]

1. **V4**: tres superficies con nombre (vidrio / control / plana); `nav-card`, `day-card`, `pw-btn`, `profcard` y `calcbox` a una de ellas.
2. **V5**: una fuente de luz por pantalla; fuera orbes y reflejo diagonal de las tarjetas secundarias.
3. **V9 (parte de componente)**: una sola fila tocable; íconos SVG de trazo en lugar de emoji (cierra G7).

Se verá: Inicio con la tarjeta del cuerpo como único vidrio iluminado y las cuatro chicas en grafito de control con cifras en tiza; Entreno con la hero arriba y el resto como listas.

### Tanda D · Ritmo y composición [Inicio, Entreno, Comida, Progreso: sin choque; Hoy excluido por la previa]

1. **V10**: espaciado en la escala; 28–32 px entre grupos.
2. **Entreno**: hero + CTA; "Mis rutinas" y "Gimnasios" como un `.group` de dos filas; el aviso de descarga como fila de estado; turnos a continuación.
3. **Progreso**: historial en filas compactas de dos líneas (turno + fecha / series y volumen en plomo), con el trofeo sólo si hay PR.
4. **Inicio**: las cuatro tarjetas chicas con la misma altura y el rótulo arriba a la izquierda (cierra I2 de paso).

#### Tanda D — estado (2026-09-29, rama `feat/visual-composicion`)

Hecha. Medido en el build de producción (`vite build` + `vite preview`
:4190), service worker bloqueado y caches borradas, `seedRegistro()`, con
Hielo a 390×844 y Fucsia a 430×932. El "antes" es `origin/main` = #131 (con
la tanda A ya adentro), medido con el mismo script y los mismos datos sobre
un build aparte.

**Medidor de espaciado:** `getComputedStyle` de margin (4 lados), padding
(4 lados) y gap (sólo en flex/grid) de cada nodo visible de la pantalla
(scroll completo, sin los márgenes `auto`); "en la escala" = 4, 8, 12, 16,
24 o 32. No es el mismo conteo que el del relevamiento (2.142 declaraciones
fuera sumando las cuatro pestañas por otro método): acá se comparan antes y
después con el mismo instrumento.

| Pantalla | Fuera de escala antes → después | En la escala antes → después | De lo que queda |
|---|---|---|---|
| Inicio | **57 → 4** | 37 → 90 | 2 px ópticos del título; 2 valores internos del SVG de la silueta |
| Entreno | **100 → 2** | 60 → 159 | los 2 px ópticos de `.vtitle` |
| Comida | **105 → 17** | 75 → 156 | 16 son los 2 px ópticos de `.sect`/`.slot-head`/`.vtitle`; 1 el punto del aviso (5 px, centrado óptico) |
| Progreso | **217 → 25** | 235 → 384 | 20 son 2 px ópticos; el `select` del gráfico (14/40, control de formulario) |
| **Total** | **479 → 48** (40 de ellos, el sangrado óptico de 2 px de los rótulos) | 407 → 789 | en la escala: **46 % → 94 %** |

| ID / pedido | Estado | Commit | Antes → después |
|---|---|---|---|
| **V10** ritmo | ✅ | `c8de3b5`, `911f381`, `2ff36c7` | Dos intervalos: `--s3` (12) dentro de un grupo, `--s6` (32) entre grupos (`.pila` / `.grupo`, al final de `styles.css` para ganarle por orden a `.card`, `.nav-card`, `.notice`). `.sect` dentro de una pantalla abre grupo: 32 arriba, 12 abajo (en las hojas, igual que antes). Inicio usa `--s5` entre grupos: a 32 no entra sin scroll. |
| **Entreno** reordenado | ✅ | `911f381` | Hero del plan con **tres cifras** (turnos / ejercicios / series) en vez de una oración de dos renglones, barras más bajas y "Editar rutina" **adentro** (como EMPEZAR en Hoy); "Mis rutinas" + "Mis gimnasios" como **un `.group`** con subtítulos de un renglón; la descarga en curso es una **fila de estado** en esa lista y la sugerida una fila con chip "Aplicar" **debajo de los turnos** (es consejo, no plan), junto a "Se está enfriando" y "Porciones". **Turnos: 1.021 → 706 px** (390×844: el primero asoma sobre la barra; a 430×932 entran dos). Los turnos de descanso medían 14 px más que los de entrenamiento: iguales (75). |
| **Progreso** historial | ✅ | `2ff36c7` | `SessionCard` pasa de tarjeta a **fila de dos renglones** en una lista agrupada: turno + fecha arriba, "21 series · 7122 kg de volumen" en plomo abajo, trofeo sólo si hubo PR. **115 → 64 px por sesión; "Tus sesiones" 1.136 → 698 px.** El sheet de todas las sesiones usa la misma lista. Progreso entero: 5.070 → 4.620 px. |
| **Inicio** tarjetas chicas (I2) | ✅ | `c8de3b5`, `c492038` | Alto **91/104 → 96/96** (filas `1fr` de un grid de altura indefinida); rótulos que arrancaban en x = 35, 79, 247, 217 → **35 y 218** (columna izquierda y derecha), cifras a la misma altura en cada fila (580/580, 687/687). Tres grupos: semana (con "¿Entrenaste…?" sin márgenes negativos), estado del día, tablero. El aviso "Hace tiempo no entrenás …" va al costado de la silueta: con él y la línea de la semana, Inicio sigue **844/844 a 390×844** (reloj +9 días para forzarlo) y 932/932 a 430×932. |
| **Comida** | ✅ | `2ff36c7` | La hero de calorías abre la pantalla (día arriba, ciclo de carbos debajo). La tarjeta del perfil —avatar con el degradado y el halo del acento, el objeto más encendido de la pantalla para un ajuste de una vez— pasa al final. Grupos: avisos / registrar / Un toque / Frecuentes / comidas del día / tus macros. Los chips de "Un toque" arrancan en x = 18 (antes 20). |
| Extras chicos | ✅ | `911f381`, `2ff36c7`, `74213fc` | `.chip`, `.seg`, `.row`, `.grouprow-s`, `.empty`, `.calcbox`, constancia en la escala; el encabezado de grupo del turno abierto en tiza (el último rótulo de Entreno en acento, V2); el texto de un `.notice` a 13 px (caía a 16, más grande que su título: V8 local); la leyenda del gráfico de carga en `micro` (era `text-xs`, 12 px); las cifras de constancia repartidas sin partir "RACHA ACTUAL". |

**Puntaje (rúbrica de este informe, 0–4 por eje):**

| Pantalla | Relevamiento (#125) | Antes (#131, con tanda A) | Después | Lo que falta para 4 |
|---|---|---|---|---|
| Inicio | 15 | 16 (J3 T3 R2 C2 Co3 E3) | **18** (J3 T3 R3 C3 Co3 E3) | V3/V12 (eyebrow del estado), V5 (orbe y reflejo de cada tarjeta) |
| Entreno | 13 | 13 (J2 T2 R2 C2 Co3 E2) | **17** (J3 T3 R3 C3 Co3 E2) | emoji en las filas (V9/G7), eyebrow "Plan activo" (V12) |
| Comida | 12 | 13 (J2 T2 R2 C2 Co3 E2) | **15** (J3 T2 R3 C2 Co3 E2) | tres voces de fila tocable: `.btn`, `.pw-btn`, `.profcard` (V9, tanda C) |
| Progreso | 12 | 14 (J2 T3 R2 C2 Co3 E2) | **17** (J3 T3 R3 C3 Co3 E2) | "PRs · Récords personales" y "Medidas · último registro" (V12); tarjetas de cifras con dos recetas |

**No se tocó a propósito** (otros agentes o tandas B/C): Sheet.jsx y sus
animaciones, AgregarEjercicio, ExerciseCarousel/Rampa/Previa, RestTimer, Hoy;
`@theme`, carga de fuentes y `body{font-size}` (V8, tanda B); eyebrows
(V12, B); superficies, orbes y emoji (V4, V5, V9, C). El `.field` (padding
14 de los campos) queda como está: es el sistema de formularios, no ritmo de
pantalla. El sangrado óptico de 2 px de `.vtitle`, `.sect`, `.slot-head` y
`.sess-week` se conserva: alinea las versales con el texto de las tarjetas.

**Pendientes que deja:**
1. `bloomOpen` en cada `SessionCard` se sacó: en una lista agrupada una fila
   que escala sola se despega del grupo. Si se quiere un gesto para "sesión
   nueva", que sea de la lista (tanda E).
2. En la hoja "Todas tus sesiones" las filas ya son las nuevas; el resto de la
   hoja (título, rótulo de semana en Tailwind) no se tocó.
3. Inicio a 390×844 queda con 10 px entre el grid y la barra en el peor caso
   medido (grupo frío + día sin anotar + tonelaje). Si se suma un tercer
   renglón en "estado" (recuerdo de hace un año + tonelaje), pediría scroll:
   no se pudo forzar con el seed.

### Tanda E · Movimiento percibido [choca con la rampa (sus pulsos) y con la optimización del descanso (`glowring`): al final]

1. Un momento con autor por pantalla: el filo de ENTRENAR se queda (es el gesto de Inicio); el brillo que barre `.btn` sólo en el CTA principal (G5), sin loops detrás de hojas.
2. Alinear el pulso de la rampa (otro agente) con el nuevo "anillo que late" de V1 para que sea **un** lenguaje de "esto está activo".
3. **V14** (descanso), una vez mergeada la optimización.

**Orden:** A ya; D en paralelo con A (pantallas distintas del mismo CSS, cuidar el rebase); B y C cuando mergeen rampa/previa y asistente; E al final.

---

## Las 10 mejoras de mayor impacto

1. Sacar el pulso de opacidad de "SEGUIR" (V1): deja de verse malva y deshabilitado, contraste ≥ 4,5 siempre.
2. Rótulos y metadatos fuera del acento (V2): el CTA vuelve a ser lo único encendido.
3. Cargar y usar Barlow Condensed 800 itálica en títulos y cifras (V8): el "golpe" deportivo que hoy la app declara y no dibuja.
4. Tres roles de rótulo en vez de catorce (V3): se acaba el "cada bloque habla distinto".
5. Tres superficies en vez de trece (V4): el vidrio vuelve a significar "esto flota/encabeza".
6. Una sola luz por pantalla, sin orbes en cada tarjeta (V5): menos plantilla, más foco.
7. Estados sólo como estados (V6): el verde y el ámbar recuperan su significado.
8. Mapa de racha sin "faltas" antes de la primera sesión (V7): Progreso deja de abrir con un castigo rojo inventado.
9. Una sola fila tocable con íconos SVG (V9 + G7): Entreno y Comida se ven del mismo sistema.
10. Ritmo 12 / 32 y Entreno reordenado (V10): la lista de turnos sube a la primera pantalla.

---

## Capturas

Carpeta: `C:/Users/LENOVO/AppData/Local/Temp/claude/c--Users-LENOVO-Documents-Enzo-Gymapp/3ed2a546-867f-40c4-be4e-07fc30cc3c00/scratchpad/auditoria-visual-2/`

| Archivo | Pantalla | Ancho · acento |
|---|---|---|
| `00-inicio-vacio-390.png` | Inicio sin datos | 390 · Hielo |
| `01-inicio-390-hielo.png` | Inicio, completado hoy (página entera) | 390 · Hielo |
| `02-inicio-entrenar-390-hielo.png` | Inicio, toca entrenar | 390 · Hielo |
| `03-inicio-entrenar-430-fucsia.png` | Inicio, ENTRENAR | 430 · Fucsia |
| `04-inicio-seguir-430-fucsia.png` | Inicio, SEGUIR en el valle del pulso (V1) | 430 · Fucsia |
| `10-entreno-390-hielo.png` | Entreno (página entera) | 390 · Hielo |
| `10b-entreno-390-hielo-top.png`, `10c-…-medio.png` | Entreno, arriba y aviso (V8, V10) | 390 · Hielo |
| `11-editor-390-hielo.png` | Editor de rutina | 390 · Hielo |
| `12-turno-editor-390-hielo.png` | Hoja del turno (V9) | 390 · Hielo |
| `13-mis-rutinas-390-hielo.png` | Mis rutinas (V3, V6) | 390 · Hielo |
| `14-entreno-430-fucsia.png` | Entreno | 430 · Fucsia |
| `15-ficha-ejercicio-430-fucsia.png` | Ficha de ejercicio | 430 · Fucsia |
| `20-ajustes-390-hielo.png` | Ajustes | 390 · Hielo |
| `21-perfil-430-fucsia.png` | Perfil y macros (V3, V11) | 430 · Fucsia |
| `30-comida-390-hielo.png`, `31-…-abajo.png` | Comida (V6, V9) | 390 · Hielo |
| `32-comida-430-fucsia.png` | Comida (V5, V6) | 430 · Fucsia |
| `40-progreso-390-hielo.png`, `41-…-medio.png`, `42-…-abajo.png` | Progreso (V2, V7) | 390 · Hielo |
| `43-historial-390-hielo.png` | Tus sesiones (V2) | 390 · Hielo |
| `45-progreso-430-fucsia.png` | Progreso | 430 · Fucsia |
| `50-hoy-sin-sesion-390-hielo.png` | Hoy antes de empezar | 390 · Hielo |
| `51-antes-de-empezar-390-hielo.png` | Hoja "Antes de empezar" | 390 · Hielo |
| `52-calentamiento-390-hielo.png` | Calentamiento | 390 · Hielo |
| `53-hoy-en-vivo-390-hielo.png` | Sesión en vivo, sin empezar el ejercicio | 390 · Hielo |
| `54-hoy-en-vivo-serie-390-hielo.png` | Sesión en vivo, serie con rampa | 390 · Hielo |
| `55-descanso-390-hielo.png` | Descanso a pantalla completa (V14) | 390 · Hielo |
| `56-terminar-dialogo-390-hielo.png` | Diálogo "Terminar la sesión" | 390 · Hielo |
| `57-fin-sesion-390-hielo.png` | Sesión guardada | 390 · Hielo |
| `58-hoy-en-vivo-430-fucsia.png` | Sesión en vivo | 430 · Fucsia |
| `60-mapa-cuerpo-430-fucsia.png` | Tu cuerpo | 430 · Fucsia |
| `61-ficha-musculo-430-fucsia.png` | Ficha de músculo | 430 · Fucsia |

---

## Preguntas para Enzo

1. **¿Por dónde empezamos?** (a) Tanda A ya, que no choca con nadie; (b) A + D juntas (color y ritmo de las pantallas tablero); (c) esperar a que mergeen rampa, previa y asistente y hacer B + C de una.
2. **El vidrio:** (a) sólo en lo que flota o encabeza (header, barra, hojas, hero), el resto en grafito sólido; (b) vidrio en todas las tarjetas pero sin orbes ni reflejos; (c) como está.
3. **El peso del display:** (a) cargar Barlow Condensed 800 itálica y subir títulos y cifras a 800 (más "dorsal"); (b) quedarse en 700 y corregir el CSS para que no pida 800.
