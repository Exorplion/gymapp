# Copiar ejercicios entre días, y modificar la sesión en vivo

Fecha: 2026-08-04

Dos bloques independientes. El A vive en el editor de rutina; el B, en Hoy
durante una sesión abierta. No comparten código salvo el clonado de un
ejercicio.

---

## A · Copiar y traer ejercicios entre días

### El problema

Anterior A y Anterior B son la misma rutina. Hoy, armarlas significa cargar
nueve ejercicios a mano dos veces, y cada corrección hay que hacerla dos veces
más. No hay ninguna forma de llevar ejercicios de un día a otro: el editor sólo
permite mover un día **entero** a otro día de la semana (`dropDayOn`), que
vacía el origen — lo contrario de duplicar.

### Dos entradas, un componente

`components/sheets/CopyExercises.jsx`, con `mode: 'push' | 'pull'`. Los dos
modos muestran lo mismo — de dónde, adónde, y cuáles — y sólo cambia qué
extremo viene fijo:

- **push** (`⧉ Copiar a otro día`): origen fijo = el día que estás editando;
  elegís destino.
- **pull** (`⤓ Traer de otro día`): destino fijo = el día que estás editando;
  elegís origen.

```
┌──────────────────────────────────────┐
│ Copiar de Lunes · Anterior A         │
│                                      │
│ ¿A qué día?                          │
│  [L] [M•] [X] [J•] [V] [S] [D]       │
│  El jueves ya tiene "Anterior B"     │
│  ( ) Reemplazar todo                 │
│  (•) Sumar los que falten (4 de 9)   │
│                                      │
│ ¿Qué ejercicios?          [Todos]    │
│  ☑ 1  Press plano máquina            │
│  ☑ 2  Press inclinado                │
│  ☐ 3  Pec deck unilateral  ya está   │
│  ☑ 4  Elevaciones laterales          │
│                                      │
│ [    Copiar 3 ejercicios al jueves ] │
└──────────────────────────────────────┘
```

En modo pull, arriba va un selector de fuente `Mi semana | Mis rutinas`.

Los dos botones viven en la fila de acciones del día abierto en el editor,
junto a `+ Ejercicio` y `✎ Día`.

**Botones siempre visibles, no un aviso al terminar de editar.** El pedido
original decía "cuando termino de editar un lunes me dé la opción". Un cartel
cada vez que salís del editor se vuelve ruido en dos días y termina en que lo
cerrás sin leer; un botón te da lo mismo cuando lo querés sin preguntarte
cuando no.

### Reglas

**Destino ocupado: se pregunta en el mismo sheet.** Dos radios — *Reemplazar
todo* (el destino queda idéntico a la selección) o *Sumar los que falten* (sólo
entran los que el destino no tiene). Los dos son legítimos y cuál querés
depende de qué estés armando. Con el destino vacío no aparece la pregunta.

**"Ya está" se decide por `exKey`**, no por nombre: nombre + equipo + máquina
(`equip.js`). "Press banca · Discos" y "Press banca · Barra" son dos ejercicios
distintos y los dos pueden convivir en el mismo día, que es exactamente el caso
que el módulo de equipamiento existe para separar.

**Las copias llevan `id` nuevo.** No es cosmético: `findEx(exId)`
(`session.js`) recorre todos los días y devuelve la primera coincidencia, así
que dos días con el mismo id harían que guardar una serie apunte al ejercicio
equivocado.

**El historial se enlaza solo.** Se compara por `exKey`, no por id, así que un
ejercicio recién copiado ya llega sabiendo tu última vez y tus PRs. No hay nada
que migrar.

**Se copia todo menos el id:** nombre, series, reps, equipo, máquina, foto e
ilustración.

**Deshacer sale gratis.** `copyExercises` pasa por `pushHistory()`, el mismo
mecanismo que ya usa el editor para borrar y reordenar: el toast trae
"Deshacer".

### Defecto preexistente que hay que arreglar acá

`routineSnapshot()` guarda cada ejercicio como `{name, sets, reps}` — descarta
`equip`, `machine`, `illus` y `photo`. `applyDays()` los recrea igual de
incompletos. Es decir: **guardar una rutina en "Mis rutinas" y volver a
cargarla te borra el equipamiento de todos los ejercicios**, y con él el enlace
a su historial.

Hasta ahora pasaba desapercibido porque cargar una rutina guardada es raro.
Traer ejercicios de una rutina guardada lo vuelve el camino principal, así que
se arregla: `routineSnapshot` y `applyDays` conservan `equip`, `machine` e
`illus`.

`photo` queda deliberadamente afuera: son data-URLs y `S.lib` entero vive en un
único registro de `settings`. Meter fotos ahí infla ese registro sin límite.

---

## B · Modificar la sesión en vivo

### El problema

Una vez abierta la sesión, la rutina es un riel. No podés hacer una serie de
más (`saveSet` corta al llegar al objetivo, a propósito: "el objetivo es el
techo"), no podés agregar un ejercicio que decidiste hacer, no podés cambiar
uno porque la máquina está ocupada, y no podés saltar el peso muerto porque no
te da el tiempo. La única salida es descartar la sesión o registrar mal.

### Estado nuevo, todo dentro del borrador

Tres campos en `S.draft`. **Nada de esto toca `S.routine`**: improvisar en el
gimnasio no debería reescribir tu plan.

- `skipped: [exId]` — los salteados.
- `extraSets: { [exId]: n }` — series concedidas por encima del objetivo.
- `extras: [ejercicio]` — ejercicios agregados sólo para esta sesión, con su
  `id` propio, agregados también a `draft.order`.

**`targetSets(ex)`** = `ex.sets + (S.draft?.extraSets[ex.id] || 0)`. Reemplaza
los usos de `ex.sets` en `saveSet` (el guard que cierra el ejercicio),
`nextPending`, y la tarjeta del carrusel (contador, `full`, texto del botón,
`rirScheme`). `rirScheme(n)` genera el esquema para cualquier cantidad, así que
una serie extra no lo rompe.

**`sessionExs(wd)`** devuelve los ejercicios de la rutina más `draft.extras`,
ordenados por `draft.order`. Reemplaza a `orderedExs` en Hoy mientras hay
sesión.

### Las acciones

Bajo el botón principal de la tarjeta abierta, tres botones chicos:

```
[    ✓ Terminé la serie 3 de 3    ]
   + Serie      ⇄ Cambiar      ⤼ Saltar
```

- **+ Serie** — sube el techo de hoy en uno.
- **⇄ Cambiar** — reemplaza este ejercicio por otro **en el mismo lugar del
  orden**. Es saltar el original e insertar el nuevo donde estaba. La máquina
  ocupada es la regla, no la excepción.
- **⤼ Saltar** — pide confirmación (sheet `confirm`, que ya existe) y lo apaga.

Y al final del carrusel, **+ Agregar ejercicio**.

### Saltar es reversible

La tarjeta saltada **sigue visible**, apagada, con el rótulo "Saltado" y un
botón **Restablecer**. Vuelve exactamente a donde estaba, porque el orden vive
en `draft.order` y saltar no lo toca nunca — sólo agrega el id a `skipped`.

Si salteás el ejercicio en curso, `draft.cur` pasa a `null` y el siguiente
pendiente queda como el próximo.

`nextPending` ignora los salteados, y "terminaste el día" se calcula sobre los
no salteados: si salteaste el último, la sesión se puede cerrar.

### Al cerrar la sesión

**Los salteados no ensucian tus números.** No tienen series, así que nunca
entran en `draft.entries` ni en `sess.entries`: cero volumen, cero PRs, cero
efecto sobre el gráfico de carga. Se guardan aparte:

```js
sess.skipped = [{ name, equip, machine }]
```

y el resumen dice "1 saltado · Peso muerto". Sin eso, dentro de un mes no vas a
saber si ese día no tocaba peso muerto o si lo dejaste pasar.

**Los ejercicios agregados preguntan una vez.** Si la sesión tuvo `extras`, se
guardan también en `sess.added` y `SessionView` (con `justFinished`) muestra
arriba del botón de cierre:

> Agregaste **Face pull** hoy. ¿Lo dejo en tu rutina del jueves?
> [Sí, agregarlo] [No, sólo fue hoy]

Aceptar lo agrega a `S.routine[weekday]` con un `id` nuevo. La tarjeta
desaparece al responder y no vuelve a aparecer.

**Las series extra no preguntan nada.** Una serie de más suele ser "hoy me
sentía bien", no un cambio de plan. Preguntarlo cada vez sería ruido; el
objetivo se cambia desde el editor, que es donde vive el plan.

### Compatibilidad

Un borrador viejo (guardado antes de este cambio) no tiene `skipped`,
`extraSets` ni `extras`. Todos los accesos van por `?.` con default, así que
una sesión abierta durante la actualización sigue funcionando sin migración.

---

## Archivos

**A · Copiar:**
- `components/sheets/CopyExercises.jsx` (nuevo)
- `lib/rutina-logic.js` — `copyExercises`, `cloneExercise`, y el arreglo de
  `routineSnapshot`/`applyDays`
- `components/screens/Rutina.jsx` — los dos botones
- `App.jsx` — el sheet `copy-exs`
- `styles.css` — la lista con checkboxes

**B · Sesión en vivo:**
- `lib/session.js` — `targetSets`, `sessionExs`, `skipExercise`,
  `unskipExercise`, `addExtraSet`, `addSessionExercise`,
  `replaceSessionExercise`, y `completeSession` guardando `skipped`/`added`
- `lib/state.js` — los tres campos del draft
- `components/ExerciseCarousel.jsx` — las tres acciones y la tarjeta saltada
- `components/screens/Hoy.jsx` — `+ Agregar ejercicio`
- `components/sheets/SessionView.jsx` — los saltados en el resumen y la
  pregunta de fijar
- `styles.css` — tarjeta saltada y fila de acciones

## Publicación

El sitio no cambia hasta commitear el build a la raíz (`npm run build` desde
`web/`) en `main`. Se publica con autorización explícita.
