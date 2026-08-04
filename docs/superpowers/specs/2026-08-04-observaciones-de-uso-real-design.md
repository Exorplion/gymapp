# Observaciones después de usar la app en el gimnasio

Fecha: 2026-08-04

Seis bloques independientes, cada uno con su commit y su build publicado. Un
séptimo (el reflejo al inclinar) queda diseñado y **en standby** a pedido de
Enzo — ver la sección al final.

La tarjeta va primero porque es la que molesta entrenando; nutrición al final
porque es el único bloque que toca el esquema de datos.

**Orden de construcción: 1 → 3 → 2 → 4 → 5 → 6.** El bloque 2 se apoya en dos
cosas que nacen en el 3 (el componente `SessionView` y el helper `sessionPRs`),
así que el 3 tiene que existir antes aunque en la lectura vaya después. Los
demás son independientes entre sí.

---

## 1 · La tarjeta del ejercicio no entra en la pantalla

### El problema

No es percepción, son medidas. `.carousel-slide` mide `84%` del ancho
(`styles.css`) y adentro `.setgrid` es un grid de dos columnas `1.4fr / 1fr`
con `gap:12px` (`ExerciseCarousel.jsx`). Cada columna contiene un `.step` con
dos botones de `48px`.

En un teléfono de 390px: `main` deja 354px útiles, el slide toma 297px, el
padding de `.card` deja 265px. El grid reparte 147px a peso y 105px a reps.
Los dos botones más sus gaps ya ocupan **108px**.

- Peso: quedan **39px** para un número de 34px con las libras debajo.
- Reps: quedan **−3px**. La columna es más chica que su propio contenido.

Por eso los números se pierden dentro de la tarjeta.

### La solución

**Modo foco.** Mientras hay una sesión abierta (`S.draft`), los slides pasan de
`84%` a `100%`. Antes de arrancar el peek de 84% sirve — estás ojeando qué te
toca; en plena serie no aporta nada y cuesta 57px de ancho. El cambio ocurre al
tocar "Abrir sesión", que ya es una transición de pantalla completa (el hero
también cambia), no a mitad de una serie.

La matemática de scroll (`carousel.js`) es por `offsetLeft`/`offsetWidth`, así
que funciona a cualquier ancho sin tocarla. El `useLayoutEffect` de
`ExerciseCarousel` ya recentra cuando cambia `active`, que es exactamente
cuando cambia el ancho.

**Peso y reps apilados.** `.setgrid` (dos columnas) pasa a `.setrows` (columna
de dos filas). Botones a `52px`, número a `44px`, y las libras **al lado** del
número en vez de debajo — así la fila no crece de alto y se recuperan los 14px
que costaba el `.alt` con su `margin-top:-4px`.

```
PESO                          REPS
┌────┐                ┌────┐   ┌────┐        ┌────┐
│ −  │  62.5  138 lb  │ +  │   │ −  │   10   │ +  │
└────┘                └────┘   └────┘        └────┘
```

Cuenta nueva: 265px − (52+52+20 de gaps) = **141px para el número**, contra los
39px y −3px de hoy.

### Qué no se toca

**Los inputs siguen sin controlar, con refs.** El comentario de cabecera de
`ExerciseCarousel.jsx` y `syncInputs()`/`syncDependents()` documentan un bug
real que ese diseño corrige: borrar el campo para retipear volvía al valor
viejo, y escribir "62.5" perdía el punto en el momento de teclearlo. Este
bloque es puramente de layout — no toca el manejo de valores.

---

## 2 · Un día ya entrenado sigue ofreciendo "Empezar entrenamiento"

### El problema

`PreSessionHero` (`Hoy.jsx`) pinta siempre el botón de empezar. Nadie mira
`S.sessions` para saber si ese día ya se cerró.

### La solución

**`sessionForWeekday(wd)`** en `session.js`: la sesión de ese weekday cuya
`date` caiga dentro de la semana en curso (desde el lunes hasta hoy). Como
`S.sessions` está ordenado descendente por `start`, un `find` devuelve la más
reciente.

La ventana es "esta semana", no "hoy", a propósito. Cubre los dos casos reales:
es jueves y ya entrené hoy, y es jueves y miro el lunes que ya hice. Un día
futuro de esta semana todavía no tiene sesión, así que sigue ofreciendo
empezar — entrenar el jueves un martes es legítimo y no hay que bloquearlo.

**El hero pasa a `DoneHero`:**

```
● COMPLETADO · JUEVES
Pecho / Tríceps
   52        18        6
   MIN     SERIES   EJERCICIOS
🏆 1 récord · Press banca 62.5 × 8

[  Ver lo que hiciste  ]
     Entrenar de nuevo
```

- "Ver lo que hiciste" abre `session-view` con el id de la sesión. Ese
  componente y el `sessionPRs` que alimenta la línea del récord se construyen
  en el bloque 3, que por eso va antes que éste.
- "Entrenar de nuevo" es texto discreto, no botón: abre `sess-start-info`, el
  flujo de siempre. Existe para la doble sesión y para el día que te
  equivocaste, no como camino principal.

**La tira semanal** marca con ✓ los días que ya tienen sesión esta semana.

`S.draft` sigue teniendo prioridad: con una sesión abierta se ve `ActiveHero`,
sin cambios.

---

## 3 · El historial está escondido y se lee mal

### El problema

Vive detrás del reloj del header, como una lista de filas planas
(`History.jsx`). La pantalla que se llama **Progreso** no lo menciona. Y hay
dos componentes que muestran la misma sesión de dos maneras distintas:
`SessionRecap.jsx` (al terminar: cuatro stats + tarjeta de PR) y `HistDetail`
(exportado desde `Hoy.jsx`: chips planos `62.5kg × 8`, sin stats ni PRs).

### La solución

**Una sola vista de sesión.** `components/sheets/SessionView.jsx` reemplaza a
los dos. Recibe `{ id, justFinished }` y **lee la sesión de `S.sessions` por
id**, no por prop — así una edición (bloque 4) se refleja sin cerrar el sheet.
`justFinished` sólo cambia el encabezado (🎉/💪 "Sesión guardada") y el botón
de cierre.

Tres entradas, una vista: terminar una sesión, tocar una del historial, y "Ver
lo que hiciste" del día completado.

**`sessionPRs(sess)`** en `session.js` generaliza a `calcSessionPRs`: compara la
mejor serie de cada ejercicio contra el máximo de las sesiones con
`start < sess.start`. La versión de hoy asume que la sesión todavía no está en
`S.sessions`, lo que sólo es cierto en el momento de cerrarla; la nueva sirve
para cualquier sesión histórica.

**Sección "Tus sesiones" en Progreso**, debajo del hero de peso, agrupada por
semana (`ESTA SEMANA` · `SEMANA PASADA` · `SEMANA DEL 14 JUL`):

```
┌──────────────────────────────────┐
│ JUE  Pecho / Tríceps          🏆1│
│ 31 jul · 52 min                  │
│ 18 series · 4 240 kg de volumen  │
│ Press banca · Aperturas · Fondos │
└──────────────────────────────────┘
```

Muestra las últimas 8 y un "Ver todas".

**`History.jsx` se reescribe, no se borra**: pasa a ser la lista completa que
abre "Ver todas", con las tarjetas nuevas. El reloj del header deja de abrir un
sheet y lleva a Progreso, con scroll a la sección.

---

## 4 · Corregir una sesión ya cerrada

### El problema

Una vez cerrada la sesión no hay forma de tocarla. Si anotaste 60 kg donde
fueron 62.5, o te olvidaste de registrar la última serie, el registro queda
mal para siempre. Lo único disponible es borrar la sesión entera, que además
tira a la basura la duración real y el resto de lo que sí estaba bien.

### La solución

`SessionView` gana modo edición:

- Tocás una serie y la editás con el mismo control de peso/reps de la tarjeta
  de ejercicio.
- Borrás una serie, agregás una que faltó, agregás un ejercicio que hiciste y
  no anotaste (elegido de los del día en `S.routine[sess.weekday]`, o escrito a
  mano), o sacás uno entero.

**`start`, `end`, `duration`, `date`, `weekday` y `dayName` no se tocan nunca.**
Sólo cambia `entries`. El tiempo que quedó registrado en el gimnasio es un
hecho medido; corregir un peso no lo cambia.

**`updateHistorySession(sess)`** en `session.js`: `idb.put('sessions', …)` más
el reemplazo en `S.sessions`. Cada cambio muestra un toast con **Deshacer**,
que restaura un `structuredClone` tomado antes de la mutación. El sistema de
toast ya soporta `actionLabel`/`onAction` (`toast.js`, lo usa `pushHistory`).

**No hace falta migrar nada más.** PRs, gráficos de carga, 1RM y volumen se
derivan de `S.sessions` en cada render (`Progreso.jsx`, `charts.js`,
`muscle.js`), así que corregir un peso actualiza todo solo.

---

## 5 · El arrastre de días no muestra qué va a pasar

### El problema

`drag.js`, modo `days`, evita deliberadamente abrir un hueco: sólo ilumina la
tarjeta de destino (`.drop-target`). Fue la decisión correcta contra el modelo
de lista — los días no se reordenan, cada tarjeta **es** un día — pero deja el
gesto mudo. No ves que el ocupante del destino se va a correr hasta después de
soltar y confirmar.

### La solución

**Preview vivo del resultado.** `previewDayDrop(from, to)` en `rutina-logic.js`
devuelve, con las reglas que ya existen (`nextFreeDay` + `S.cfg.dayDrop`), un
mapa `{ weekday origen → weekday destino }` de dónde terminaría el contenido de
cada día afectado. `drag.js` lo traduce a transforms: cada tarjeta afectada se
desliza `rects[destino].top − rects[origen].top`. El origen se apaga.

Es la misma función que decide el resultado real, así que el preview no puede
mentir: si cambia la regla, cambian los dos a la vez.

Al soltar se revierten los transforms y sigue el flujo de siempre — `dropDayOn`,
la confirmación `day-drop` si `S.cfg.dayDrop === 'ask'`, y las animaciones
`S.dayFx` de llegada.

**Hay que colapsar el día abierto antes de medir.** Un día abierto mide el doble
que un descanso, y con alturas dispares el preview salta. Al empezar el
arrastre se pone `S.rutOpen = null`.

El orden importa: `.day-body` tiene una transición de 340ms sobre
`grid-template-rows`, así que si se mide inmediatamente después las alturas
están a mitad de camino. La secuencia en `dragStart` es: agregar
`body.dragging-on` (que ahora incluye `.day-body{transition:none}`) → colapsar
con `flushSync(bump)` → **recién ahí** medir los rects.

Con `prefers-reduced-motion` no hay transforms de preview: queda el highlight
de hoy.

---

## 6 · Nutrición: buscador, gramos, momentos del día y export MD

Es el bloque más grande y el único que cambia el esquema de datos.

### El problema

La tabla de ~55 alimentos con macros por 100 g y peso por unidad
(`foodtable.js`) **sólo la usa el dictado por voz**. El formulario manual
(`MealForm.jsx`) te hace escribir kcal, proteína, carbos y grasa a mano, cada
vez. No hay buscador, no hay gramos, y no existe la noción de desayuno /
almuerzo / cena.

### 6a · Exportar (e importar) la base de alimentos en MD

Lo que Enzo pidió primero: poder sacar la base, editarla afuera y volver a
meterla.

`lib/foodmd.js` con `exportFoodsMD()`, `parseFoodsMD(texto)` e
`importFoodsMD(file)`. Dos botones en Ajustes, junto al respaldo JSON.

El importador se construye junto con el exportador aunque Enzo todavía no
tenga el archivo: exportar sin poder volver a importar no lleva a ningún lado,
y el pedido original era "de ahí poderla poner dentro de la aplicación".

**Formato** — tabla markdown, todo por 100 g, con las reglas escritas en el
encabezado del propio archivo para poder editarlo en cualquier editor:

```markdown
# Alimentos · FIERRO

Macros por 100 g. "Unidad" es cuánto pesa una porción natural
(1 huevo, 1 scoop) y es opcional. Los alias van separados por coma.

| Alimento | Alias              | kcal |    P |    C |   G | Unidad | Categoría |
|----------|--------------------|-----:|-----:|-----:|----:|-------:|-----------|
| Pollo    | pechuga, pollo a la plancha | 165 | 31.0 | 0.0 | 3.6 | 150 | Proteínas |
| Huevo    | huevos             |  143 | 12.6 |  0.7 | 9.5 |     55 | Proteínas |
| Avena    | hojuelas de avena  |  389 | 17.0 | 66.0 | 7.0 |     40 | Carbos    |
```

La exportación junta la tabla incorporada con `S.foods`, así que el archivo
sale lleno y sirve de punto de partida.

**Tus alimentos ganan sobre la tabla incorporada**, la misma regla que ya
aplica el dictado (`foodvoice.js`: primero `userFoods`, después `FOOD_TABLE`).
El importador hace merge por nombre normalizado, no borra nada.

### 6b · El esquema de un alimento

Hoy un `S.foods` es `{id, name, kcal, p, c, f}` y esos macros son **de una
porción** — así lo trata `foodvoice.js` cuando encuentra un alimento tuyo. La
tabla MD, en cambio, es **por 100 g**. Hay que distinguirlos o los gramos van a
dar cualquier cosa.

Se agrega un campo `base`:

- `base: 'portion'` — macros de una porción. Es el default y lo que tienen
  todos los alimentos existentes, así que nada se rompe ni hay que migrar.
- `base: '100g'` — macros por 100 g. Lo que produce el importador MD.
  Acompañado de `unit` (gramos de una porción natural, opcional), `alias`
  (array) y `cat` (categoría, opcional).

`FOOD_TABLE` es `base:'100g'` por definición, así que el índice de búsqueda
unifica las dos fuentes en una sola forma.

### 6c · Buscar → elegir → gramos

`lib/foodsearch.js` construye el índice (tuyos primero, tabla como respaldo,
deduplicado por nombre normalizado) y expone `searchFoods(query, {slot})`.
Ranking: prefijo exacto > prefijo de palabra > contiene; y a igualdad, primero
lo que más comés **en ese momento del día**, después lo que más comés en
general.

`MealForm.jsx` se reescribe:

```
┌─────────────────────────────┐
│ Agregar · Almuerzo          │
│ ┌─────────────────────────┐ │
│ │ 🔍 po|                  │ │
│ └─────────────────────────┘ │
│  Pollo            165/100g  │
│  Pollo a la brasa 220/100g  │
│  Pavo             135/100g  │
│─────────────────────────────│
│ En esta comida:             │
│  Pollo    [150] g   248 kcal│
│  Arroz    [200] g   260 kcal│
│  ────────────────────────── │
│  Total    508 kcal          │
│  P 52  ·  C 56  ·  G 6      │
│ [       Agregar        ]    │
└─────────────────────────────┘
```

**Nunca se inventan macros.** Si escribís algo que no está en ningún lado, lo
creás ahí mismo con los cuatro campos de hoy — el formulario manual actual pasa
a ser el caso "alimento nuevo", no el camino principal. Es la misma regla que
ya sostiene `foodvoice.js`.

La comida guardada suma `items: [{name, grams, kcal, p, c, f}]`. Las comidas
viejas no lo tienen y se siguen mostrando como una línea, igual que hoy.

### 6d · Momentos del día

`meal.slot`: `'desayuno' | 'almuerzo' | 'cena' | 'snack'`.

- `slotForTime(t)` lo autoelige por hora (antes de 11 desayuno, antes de 16
  almuerzo, antes de 21 cena, el resto snack) y se cambia con un seg en el
  formulario.
- Las comidas viejas no tienen `slot`: se infiere de `meal.t` al mostrarlas.
  **No se migran datos** — inferir al leer es reversible, reescribir el
  historial no.
- La lista del día se agrupa en bloques con subtotal de kcal por bloque.
- Las sugerencias del buscador priorizan lo que comés en ese slot (6c).

---

## 7 · EN STANDBY — Reflejo al inclinar el teléfono

**No implementar hasta que Enzo lo pida explícitamente.** Queda documentado
acá, completo, para retomarlo sin volver a investigar.

### Qué es

El *specular highlight* del material **Liquid Glass** de iOS 26. Apple describe
el material en tres capas: **highlight** (el reflejo que se mueve), **shadow**
(profundidad) e **illumination**. Lo que se percibe al girar el teléfono es la
primera: un brillo que recorre la superficie como si hubiera una luz fija en la
habitación y el vidrio la reflejara.

### Restricciones reales de la API

- `DeviceOrientationEvent.requestPermission()` existe **sólo en Safari/iOS** y
  hay que llamarlo **desde un gesto del usuario** — no se puede pedir al cargar
  la página. Devuelve `"granted"` o `"denied"`.
- Requiere **contexto seguro (HTTPS)**. GitHub Pages ya lo es.
- En Chrome Android no hace falta permiso: los eventos llegan directo.
- En escritorio no hay giroscopio.
- Valores: `beta` (adelante-atrás, −180…180) y `gamma` (izquierda-derecha,
  −90…90).

### Diseño

`lib/tilt.js` mantiene `--tilt-x` y `--tilt-y` en el `<html>`, normalizadas
−1…1 y suavizadas. No pasa por React: se escriben dos custom properties y el
resto lo hace CSS.

Dos detalles que deciden si se ve premium o barato:

1. **Calibrar el reposo.** Nadie sostiene el teléfono a `beta = 0` — eso es
   plano sobre la mesa; se sostiene a unos 50-60°. Sin tomar la primera lectura
   como cero, el reflejo queda clavado en un extremo. Se mide el delta contra
   esa referencia.
2. **Suavizar.** El giroscopio es ruidoso; sin interpolación hacia el valor
   objetivo en un `rAF`, el brillo tiembla.

- **Permiso:** un switch en Ajustes, "Reflejo al inclinar". Tocarlo *es* el
  gesto que iOS exige. Si se niega, se avisa y queda el fallback de puntero. Se
  guarda en `S.cfg.tilt`.
- **Alcance:** una clase `.glass-tilt`, no un selector global sobre `.card`.
  Sólo los heroes de Hoy/Rutina/Progreso, la tarjeta del ejercicio abierto y
  las tarjetas de día.
- **Cómo:** un `::after` con un gradiente lineal cuya posición y ángulo
  dependen de `--tilt-x`/`--tilt-y`, más un borde que se ilumina del lado hacia
  donde cae la luz. Encaja con `--glass-hi`, `--glass-border` y el
  `backdrop-filter` que las tarjetas ya tienen.
- **Apagado** con `prefers-reduced-motion`, y el `rAF` se detiene cuando el
  movimiento baja de un umbral: no queda un loop girando toda la sesión.

### Fuentes

- [MDN — DeviceOrientationEvent](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent)
- [CSS-Tricks — Getting Clarity on Apple's Liquid Glass](https://css-tricks.com/getting-clarity-on-apples-liquid-glass/)
- [LogRocket — How to create Liquid Glass effects with CSS and SVG](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)
- [Lee Martin — How to request device motion and orientation permission in iOS 13](https://leemartin.dev/how-to-request-device-motion-and-orientation-permission-in-ios-13-74fc9d6cd140)

---

## Archivos por bloque

**1 · Tarjeta:** `styles.css` (`.carousel-slide`, `.setgrid`→`.setrows`,
`.step`), `components/ExerciseCarousel.jsx`.

**2 · Día completado:** `lib/session.js` (`sessionForWeekday`, helper de inicio
de semana), `components/screens/Hoy.jsx` (`DoneHero`, la tira semanal),
`styles.css` (`.wkstrip .wd.done`).

**3 · Sesiones:** `components/sheets/SessionView.jsx` (nuevo; reemplaza a
`SessionRecap.jsx` y al `HistDetail` de `Hoy.jsx`), `lib/session.js`
(`sessionPRs`), `components/screens/Progreso.jsx` (sección "Tus sesiones"),
`components/sheets/History.jsx` (reescrito como "todas las sesiones"),
`components/Header.jsx` (el reloj lleva a Progreso), `App.jsx` (el switch de
sheets), `styles.css` (`.sess-card`).

**4 · Editar sesión:** `lib/session.js` (`updateHistorySession`),
`components/sheets/SessionView.jsx` (modo edición).

**5 · Drag:** `lib/rutina-logic.js` (`previewDayDrop`), `lib/drag.js` (modo
`days`), `styles.css` (`body.dragging-on .day-body{transition:none}`).

**6 · Nutrición:** `lib/foodmd.js` (nuevo), `lib/foodsearch.js` (nuevo),
`lib/foodtable.js` (forma unificada), `lib/meals.js` (`slotForTime`, agrupado),
`components/sheets/MealForm.jsx` (reescrito),
`components/screens/Nutricion.jsx` (bloques por momento),
`components/sheets/Settings.jsx` (export/import MD), `lib/state.js`
(`S.foods` con `base`).

**7 · Reflejo:** en standby. Sería `lib/tilt.js` (nuevo), `styles.css`
(`.glass-tilt`), `components/sheets/Settings.jsx` (el switch), `lib/state.js`
(`S.cfg.tilt`).

## Publicación

El sitio no cambia hasta que se commitea el build a mano (`npm run build` desde
`web/`, que corre `scripts/publish-root.mjs`). Se publica al cerrar cada
bloque, no al final de los seis.
