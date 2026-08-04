# Mover un día de rutina a otro día de la semana

Fecha: 2026-08-03

## El problema

Al aplicar una plantilla, los días quedan clavados donde los puso la plantilla.
`TEMPLATES` mapea el split a weekdays fijos (`templates.js`: Full Body va a 1/3/5,
Upper-Lower a 1/2/4/5, etc.), y no había forma de correrlo.

Lo único que existía era `swapDayContents()`, que el drag de días invocaba desde
`drag.js`. Permutaba el contenido **entre los días activos**: el conjunto de
weekdays ocupados no cambiaba nunca. Con un split en Lun/Mié/Vie podías reordenar
cuál iba en cuál de esos tres, pero no llevarlo a Mar/Jue/Sáb.

Quien entrena martes, jueves y sábado no podía representar su semana.

## La solución

Dos caminos al mismo resultado, porque el gesto no siempre es la mejor
herramienta: arrastrar es más rápido, pero exige pulso y que los dos días entren
en pantalla a la vez.

**Arrastrando.** El editor ahora lista **los siete días**, no sólo los activos:
los de descanso aparecen como una tarjeta fina, y por eso son destino válido de
un drop. Mantenés presionado un día, lo soltás sobre otro, y la rutina se muda
ahí.

**Por lista.** El sheet `day-edit` ("✎ Día") suma un selector de los siete días
debajo del nombre. Elegís y guardás. Es el mismo camino: `saveDay()` delega en
`dropDayOn()`, así que las reglas son idénticas.

### Reglas

**Destino libre:** el día se muda y el origen queda de descanso.

**Destino ocupado:** hay dos resultados razonables y cuál querés depende de la
semana que estés armando, así que **se pregunta** (sheet `day-drop`):

- **Correr** — el ocupante se va al primer día libre buscando hacia adelante y
  dando la vuelta a la semana; el origen queda de descanso.
- **Intercambiar** — los dos cambian de lugar.

La respuesta se puede fijar ("no volver a preguntar") en `S.cfg.dayDrop`
(`'ask'|'shift'|'swap'`) y se cambia después desde Ajustes. Con la semana llena
no hay adónde correr a nadie: "correr" degenera en intercambio, y el sheet
directamente no ofrece esa opción.

**Nada se pisa nunca**, así que no hace falta un diálogo destructivo: alcanza con
nombrar lo que pasó en el toast y ofrecer "Deshacer", el mecanismo que el editor
ya usa para todo (`pushHistory`).

**El selector de la lista sólo aparece si el día tiene contenido.** Un día vacío
al que le estás asignando entrenamiento se está creando, no moviendo.

**Se dice qué va a pasar antes de que pase** — el sheet de día anticipa el
resultado ("Se muda al sábado", "se intercambia con Pull, que pasa al lunes"), y
los chips llevan un punto en los días ya ocupados. Sin eso elegís a ciegas cuál
día vas a desplazar.

### Animación

Las tarjetas no se reordenan: cada una **es** un día de la semana y se queda
donde está. Lo que viaja es el contenido. Por eso el arrastre de días no abre un
hueco como una lista (el modelo de `dragLayout()`) sino que **resalta la tarjeta
sobre la que vas a soltar**, y al soltar cada día afectado cuenta con una
animación qué le pasó: `arrive` el que recibió, `bumped` el que fue desplazado,
`left` el que quedó libre (`S.dayFx`, limpiado solo).

El día bajo el dedo se calcula desde **la posición del puntero**, no desde el
centro de la tarjeta arrastrada. Con filas de igual alto da lo mismo, pero acá
un día abierto mide el doble que un descanso y el centro de la tarjeta que
llevás puede caer dos días más abajo de donde estás apuntando.

### Qué no se toca

**El historial.** Cada sesión guarda su propio `weekday` (`session.js`), que es el
día en que realmente entrenaste. Mover el plan cambia de acá en adelante;
reescribir las sesiones pasadas sería falsear el registro.

**Una sesión en curso.** Si hay un borrador abierto en el día origen o en el
destino, la operación se bloquea con un aviso. `orderedExs()` resuelve los
ejercicios de la sesión leyendo `S.routine[draft.weekday]` en cada render: mover
el día por debajo dejaría la sesión en curso apuntando a otros ejercicios.

## Implementación

`lib/rutina-logic.js`:
- `hasOpenSession(wd)` / `dayIsFree(wd)` — predicados.
- `nextFreeDay(wd, alsoFree)` — primer día libre después de `wd`, dando la vuelta
  a la semana. `alsoFree` es el origen del arrastre: todavía tiene contenido pero
  lo está por perder, así que cuenta como disponible.
- `moveDayTo(from, to)` — intercambio de dos días: cambia los dos registros de
  `S.routine` corrigiendo el `weekday` (que es el `keyPath` del store) y mueve el
  `S.hoyOrder` de cada día con su día.
- `applyDayDrop(from, to, mode)` — la mecánica completa, incluida la cascada.
- `dropDayOn(from, to)` — punto de entrada: guards y decidir si preguntar.
- `saveDay(wd, {name, toWd})` — reemplaza a `saveDayName`.
- `setDayFx(map, ms)` — la marca transitoria de animación.
- Se borró `swapDayContents()`: ya no la llama nadie.

`lib/drag.js`: modo `days` — sin `.shift` a los vecinos, destino por puntero,
`.drop-target` en la tarjeta de abajo, y `dropDayOn()` al soltar.

`components/screens/Rutina.jsx`: los siete días, la variante `rest`, y las clases
de `S.dayFx`. `components/sheets/DayEdit.jsx`: el selector. `DayDrop.jsx` (nuevo):
la pregunta. `Settings.jsx`: la preferencia.

## Dos defectos preexistentes que aparecieron al construir esto

**`.day-name.empty` heredaba de `.empty`.** `.empty` es el bloque de estado vacío
de una pantalla entera (`text-align:center; padding:36px 20px`), y al compartir
nombre le metía ese padding al nombre del día: la tarjeta de un día sin asignar
medía el triple de alto, con el texto centrado. Se renombró a `.day-name.off`.
No se notaba antes porque un día activo sin nombre es un estado raro; con los
siete días listados, cinco tarjetas lo mostraban.

**El toast tapaba los botones de cualquier sheet.** `#toast` tiene `z-index:70`
contra el `60` del sheet, y se posiciona a 90px del borde inferior — justo encima
del panel, que llega hasta `88dvh`. Con un sheet abierto ahora entra desde
arriba (`#toast.over-sheet`). Se veía siempre que una acción con toast abría un
sheet a continuación, que es exactamente el flujo de mover días.
