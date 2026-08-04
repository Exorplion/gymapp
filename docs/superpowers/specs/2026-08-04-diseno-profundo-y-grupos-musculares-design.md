# El diseño que se pierde en profundidad, y los ejercicios que no cuentan

Fecha: 2026-08-04

Tres bloques independientes, en este orden: **2 → 1 → 3**. El 2 primero porque
arregla datos que hoy están mal; el 1 antes que el 3 para que "Lo que hiciste"
nazca con el vocabulario nuevo en vez de rehacerse dos veces.

---

## Bloque 2 · Los ejercicios que no cuentan

### El problema, medido

`catOf(name)` (`muscle.js`) exige que el nombre registrado **contenga** el del
catálogo, y `muscleVolume` descarta en silencio lo que no matchea (`if (c)`).

Corrido contra la rutina real de Enzo: **de sus 22 ejercicios, 4 tienen
categoría.** Los otros 18 no cuentan para nada:

> Press plano máquina · Press inclinado · Pec deck unilateral · Extensión
> tríceps unilateral · JM press unilateral · Leg press · Leg extension · Abs
> polea · Jalón ancho · Remo espalda alta · Remo neutro · Curl predicador ·
> SLDL · Hamstring curl · Standing calf raise · Back extension 45° · Aductor ·
> Abductor

Por eso "Músculos esta semana" muestra sólo Hombro, Glúteo y Bíceps: el pecho,
la espalda, las piernas, los tríceps y los abs son invisibles.

El caso más revelador: **"Press inclinado" falla** porque el catálogo dice
"Press inclinado *mancuernas*". El match va en una sola dirección — lo
registrado tiene que contener a lo del catálogo, nunca al revés.

### La solución

**`catOf(ex)` acepta el objeto ejercicio, no sólo el nombre**, y resuelve en
cuatro pasos, en orden:

1. **`ex.cat` explícito gana.** Ninguna lista de palabras va a adivinar "JM
   press unilateral"; con el selector se resuelve una vez y queda.
2. **Lo registrado contiene al catálogo** → gana la entrada más larga, la más
   específica. Es la regla de hoy, conservada.
3. **El catálogo contiene a lo registrado** → gana la más corta, la más cercana
   a lo que escribiste. Es la dirección que falta, y la que arregla "Press
   inclinado". Sólo para nombres de 4 caracteres o más, para que un fragmento
   corto no se lleve por delante media tabla.
4. **Tabla de palabras clave ordenada**, de lo más específico a lo más
   genérico. El orden es la parte que importa: "Hamstring curl" tiene que caer
   en Pierna antes de que "curl" lo mande a Bíceps, y "Press militar" en Hombro
   antes de que "press" lo mande a Pecho.

**El catálogo se amplía** con los 18 ejercicios reales, así el automático
resuelve el caso común sin que haya que etiquetar nada a mano.

**`ex.cat` se edita** desde el formulario de ejercicio, con los nueve grupos
que ya existen más "sin asignar".

**Las entradas de sesión guardan su `cat`**, igual que ya guardan `equip` y
`machine`. Sin eso, el volumen histórico dependería de la rutina actual, y
renombrar un ejercicio reescribiría el pasado.

### Deja de fallar en silencio

Esto es lo que convierte el bug en un bug. La tarjeta de músculos suma una
línea cuando hay ejercicios sin grupo:

> 3 ejercicios sin grupo muscular · **asignar**

que lleva al editor. Un resumen incompleto presentado como completo es peor
que no tener resumen.

---

## Bloque 1 · El vocabulario que falta

### El problema, medido

La app tiene sistema de diseño — tokens `--t-*`/`--s*`, clases `.hero`,
`.card`, `.sect` — pero se termina en las portadas. Debajo hay **246 estilos
inline** que reinventan los mismos seis patrones.

El detalle que lo resume: la escala tipográfica lleva este comentario en
`styles.css`:

> *"escala tipográfica: la app tenía 18 tamaños distintos (12.5, 13.5, 14.5…),
> que es deriva, no jerarquía"*

Se creó exactamente para este problema. Se usa **17 veces** en toda la app,
contra 246 inline con tamaños a número pelado (12.5 diecinueve veces, 13
dieciséis, 14 quince). El rediseño anterior arregló las portadas y la deriva se
mudó un nivel más abajo.

### La solución: generalizar lo que ya está, no inventar

| Patrón repetido inline | Pasa a ser |
|---|---|
| `margin:'-8px 0 16px'` + 14px + mut (×10) | `.sheet-sub` |
| 11px/700/`.14em`/uppercase (×11) | `.eyebrow` — hoy es `.hero-eyebrow`, atado al hero |
| Bloque de 3-4 stats con número `cond` (×5 vistas) | `.stats` con `--n` columnas — hoy `.macro3`, atado a nutrición |
| `.card` + padding a mano en vistas de detalle | `.dcard` — encabezado + cuerpo |
| Cajas informativas con colores a mano | `.calcbox` gana `.warn` / `.ok` |

`.hero-eyebrow` y `.macro3` se conservan como alias para no tocar las pantallas
que ya los usan: los nombres nuevos son los generales, los viejos siguen
funcionando.

**Los tamaños de fuente vuelven a la escala.** Esto mueve algunos textos medio
píxel (12.5 → 13, 13.5 → 13). Es el objetivo, no un efecto secundario: cinco
tamaños con jerarquía en vez de dieciocho por deriva.

**Alcance:** los ~24 sheets y pantallas. El estilo inline que queda es el que
de verdad es puntual (un `flex:2` para repartir dos botones, un `animation` de
una vez) — no el que estaba replicando una regla.

---

## Bloque 3 · "Lo que hiciste", y cambiar qué fue

### El problema

Cada ejercicio de una sesión es una tarjeta plana: el nombre y una fila de
chips. Sin grupo muscular, sin resumen, sin relación con la vez anterior. Es la
vista donde uno mira "cómo me fue" y no contesta esa pregunta.

Y no hay forma de corregir **qué ejercicio fue**. Se pueden editar los pesos y
las series (bloque anterior), pero si registraste "Press banca" y en realidad
fue "Press inclinado", queda mal para siempre — y arrastra su historial y su
volumen a la categoría equivocada.

### La tarjeta

```
┌──────────────────────────────┐
│ ESPALDA                      │
│ Jalón ancho              🏆 │
│ ────────────────────────     │
│  1   85 kg × 7               │
│  2   85 kg × 6               │
│ ────────────────────────     │
│ 2 series · 1 105 kg          │
│ ↗ +5 kg vs. la anterior      │
└──────────────────────────────┘
```

- **Eyebrow con el grupo muscular** — sale de `catOf`, y de paso hace visible
  cuando falta.
- **Series numeradas**, no chips sueltos.
- **Resumen del ejercicio**: series y volumen (Σ peso × reps).
- **Comparación con la sesión anterior** del mismo `exKey`: la diferencia en la
  mejor serie. Sube en verde, baja en ámbar, igual en gris. Si no hay anterior,
  la línea no aparece — nunca se inventa una comparación.

### Cambiar qué ejercicio fue

En modo corrección, el nombre se vuelve tocable y abre un buscador contra el
catálogo, con la opción de escribir libre. Se puede cambiar nombre, equipo y
grupo muscular.

Al aceptar cambia **sólo esa entrada de esa sesión**. `updateHistorySession` ya
guarda con Deshacer, así que el mecanismo existe.

**Y ofrece arreglar la rutina.** Si el día de esa sesión tiene un ejercicio con
el nombre viejo, aparece:

> "Anterior A" también tiene *Press banca*. ¿Lo cambio ahí? **[Cambiarlo]**

Con un botón, no automáticamente: el historial y el plan son dos cosas, y
corregir un registro no debería reescribir el plan sin permiso.

---

## Archivos

**Bloque 2:** `lib/muscle.js` (`catOf`, `EXCATALOG`, tabla de palabras clave),
`lib/session.js` (`cat` en las entradas), `components/sheets/ExerciseForm.jsx`
(selector), `components/screens/Hoy.jsx` y `Progreso.jsx` (el aviso de "sin
grupo"), tests en `lib/__tests__/muscle.test.js`.

**Bloque 1:** `styles.css` (las primitivas), y los ~24 archivos de
`components/` para el reemplazo de inline por clases.

**Bloque 3:** `components/sheets/SessionView.jsx` (la tarjeta y el modo
corrección), `components/sheets/EntryEdit.jsx` (nuevo, el buscador),
`lib/session.js` (`entryDelta`, comparación con la anterior),
`lib/rutina-logic.js` (`renameRoutineExercise`), `styles.css`.

## Publicación

Cada bloque se publica por separado, con autorización explícita.
