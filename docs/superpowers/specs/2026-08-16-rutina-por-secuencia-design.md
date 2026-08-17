# Rutina por secuencia — diseño

## Contexto

Hoy la rutina está atada al día calendario: `S.routine` es un mapa `weekday
-> {name, exercises}` (`web/src/lib/state.js:12`), persistido en IndexedDB
con `keyPath:'weekday'` (`web/src/lib/db.js:12`). El problema que reportó
Enzo: en la práctica, cambia con frecuencia qué día entrena. Si el plan
dice "lunes: Anterior A, miércoles: Posterior" pero por algo de la vida
real recién puede entrenar el miércoles habiendo hecho Anterior A el
lunes, la app le sigue mostrando lo que está fijo para miércoles — no lo
que sigue en su plan — y hoy la única salida es editar la rutina a mano
cada vez que pasa esto.

Referencia visual que trajo Enzo: el flujo "Start Workout" de LIFTOFF
(`Imagenes LIFTOFF/`), donde la pantalla principal muestra una sola
tarjeta con el próximo entrenamiento ("Tuesday · Upper Body Pull · Start
workout") en vez de una grilla fija por día.

## Alcance — seis piezas

1. Modelo de datos: `S.routine` pasa de mapa por weekday a secuencia
   ordenada + puntero de progreso.
2. Pantalla Hoy: tarjeta "próximo turno" + historial de la semana, sin
   tira de 7 días fija.
3. Editor de Rutina: lista arrastrable, con inserción de entrenamiento o
   descanso en cualquier posición.
4. Migración automática de la rutina existente.
5. Racha adaptada al turno pendiente de la secuencia.
6. Plantillas (Push/Pull/Legs, etc.) como secuencias predefinidas.

## 1. Modelo de datos

**Hoy:** `S.routine = {1: {weekday:1, name, exercises}, 3: {...}, ...}`
indexado 0-6 por `Date.getDay()`. El store IndexedDB `routine` tiene
`keyPath:'weekday'` (`db.js:12`, `DB.ver:1`).

**Cambio:** `S.routine` pasa a ser un **array ordenado**:

```js
S.routine = [
  { id, order: 0, type: 'workout', name: 'Anterior A', exercises: [...] },
  { id, order: 1, type: 'workout', name: 'Posterior', exercises: [...] },
  { id, order: 2, type: 'rest' },
  { id, order: 3, type: 'workout', name: 'Piernas', exercises: [...] },
];
```

`type:'rest'` no tiene `exercises` ni `name` propios (se muestra como
"Descanso" en toda la UI). El store IndexedDB cambia su `keyPath` de
`weekday` a `order`, lo que requiere subir `DB.ver` a `2` y migrar los
datos existentes dentro de `onupgradeneeded` (ver Pieza 4 — la migración
de datos y la migración de schema son el mismo paso técnico).

**Puntero de progreso:** se agrega `S.cfg.seqIndex` (número, posición en
`S.routine` del turno pendiente). Avanza `+1`:
- al completar una sesión (`completeSession()`, `session.js:413`), o
- automáticamente la primera vez que se abre la app en un día calendario
  posterior a aquel en que el turno pendiente era `type:'rest'` (se
  guarda también `S.cfg.seqIndexDate`, la fecha en que `seqIndex` quedó
  en su valor actual, para poder comparar "¿ya pasó un día calendario
  desde que este turno quedó pendiente?").

Si se edita la secuencia (agregar/quitar/reordenar) mientras hay un
turno pendiente, `seqIndex` se queda apuntando al mismo **índice
numérico** (no al mismo turno "con nombre") — insertar algo antes del
pendiente corre cuál es "el próximo". Simple y sin estado extra que
sincronizar; se documenta como comportamiento esperado, no como bug.

`S.hoyDay` (hoy usado para navegar la tira de días y para recordar el
weekday de un draft en curso, `state.js:27,77`) se elimina — ya no hay
"día" que navegar. El draft de sesión en curso (`S.draft`) guarda
`seqIndex` en vez de `weekday`.

## 2. Pantalla Hoy

Se quita la tira de 7 días (`L M X J V S D`) y el lookup directo
`S.routine[wd]` de `Hoy.jsx:56`. En su lugar:

- Una tarjeta destacada ("Próximo entrenamiento") con el `name` del
  turno en `S.routine[S.cfg.seqIndex]`, cantidad de ejercicios/series, y
  botón "Empezar" que llama `startSession(seqIndex)` (reemplaza
  `startSession(wd)`).
- Si el turno pendiente es `type:'rest'` y todavía no pasó un día
  calendario desde que quedó pendiente, se muestra como "Hoy: Descanso"
  (pantalla informativa, sin botón de acción — se resuelve sola al otro
  día, Pieza 5).
- Debajo, un historial de la semana en curso: por cada sesión guardada
  con fecha en los últimos 7 días, su nombre y fecha; los huecos sin
  sesión no se listan como "pendiente a futuro" (no se puede saber qué
  tocará un día que todavía no llegó).

## 3. Editor de Rutina

En `Rutina.jsx` / `rutina-logic.js`, las operaciones indexadas por
`wd` (`ensureDay(wd)`, `saveExercise(wd,...)`, `moveDayTo(fromWd,toWd)`,
`dropDayOn`/`applyDayDrop(fromWd,toWd,mode)`) pasan a operar por
**posición en el array** en vez de weekday:

- `reorderSeq(fromIndex, toIndex)` reemplaza `moveDayTo`/`applyDayDrop`
  — un solo movimiento de arrastre, sin los modos `'shift'`/`'swap'`
  (esos existían para resolver colisiones entre dos días fijos; en una
  lista ordenada, insertar en una posición corre lo demás un lugar, no
  hay colisión que resolver).
- Dos acciones nuevas, separadas: `insertWorkout(atIndex)` e
  `insertRest(atIndex)`.
- `saveExercise`/`deleteExercise`/edición de nombre siguen igual,
  parametrizadas por `index` en vez de `wd`.

Visualmente: lista con handle de arrastre por fila (`⠿`), y dos botones
"+ Entrenamiento" / "+ Descanso" al final (y, para insertar en medio,
mantener presionado o un menú contextual por fila — detalle de
implementación, no bloquea el diseño).

## 4. Migración

Al abrir la app con la versión nueva, `onupgradeneeded` (`db.js:10`)
sube `DB.ver` a `2`. Dentro de esa transacción de versión: se leen todos
los registros del store `routine` viejo (`{weekday, name, exercises}`),
se ordenan `1,2,3,4,5,6,0` (lunes primero, como ya hace `WEEK_ORDER` en
`format.js:11`), se convierte cada uno a `{order, type:'workout', name,
exercises}` y los weekdays sin registro o con `exercises:[]` se
convierten en `{order, type:'rest'}` intercalados en su posición. Se
borra el store viejo y se crea el nuevo con `keyPath:'order'`, y se
insertan los registros convertidos. `S.cfg.seqIndex` arranca en `0`.
Este mismo mecanismo corre para cualquier usuario que abra la app
después del deploy — no hace falta que Enzo haga nada a mano.

## 5. Racha

`streak.js` hoy resuelve `dayCompleted(dateStr)` mirando el `weekday` de
esa fecha: sin ejercicios asignados = `null` (no cuenta ni corta), con
ejercicios = `true`/`false` según si hay sesión ese día exacto.

**Cambio:** en vez de mirar el weekday de la fecha, se camina la
secuencia junto con el historial de sesiones ya guardado (que sigue
teniendo `start`/fecha) para reconstruir, fecha por fecha, cuál turno
estaba pendiente ese día — mismo criterio de "cortar sólo si había un
turno de entrenamiento pendiente sin completar", ahora aplicado al turno
de la secuencia en vez de al weekday fijo. Los turnos de descanso nunca
cortan ni cuentan, igual que hoy.

**Límite de la migración:** esta reconstrucción sólo aplica a fechas
desde el día de la migración en adelante — no se recalcula con el
modelo nuevo el historial de rachas de antes (esas fechas ya usaron el
criterio viejo, atado al weekday que estaba vigente en su momento, y ese
dato deja de existir después de migrar). La racha sigue contándose sin
cortes visibles para Enzo (no se "resetea" el número), simplemente el
criterio que decide cortar-o-no cambia a partir del día de la
migración.

## 6. Plantillas

`TEMPLATES` (`lib/templates.js:13-45`) tiene hoy `split: {weekday:
[nombre, ejercicios]}` fijo por día. Pasa a ser `secuencia:
[{type,name,exercises}, ...]` en el orden natural de la plantilla (ej.
Push, Pull, Legs, Descanso, repetir). `applyTemplate()` (`:47`) escribe
directo a `S.routine` como array en vez de a índices de weekday
puntuales.

## Testing

- Suite existente de `streak.js`, `rutina-logic.js`, `session.js` se
  reescribe para el nuevo modelo (son las piezas con más lógica pura,
  fáciles de testear sin DOM).
- Migración: test específico que arranca con un `routine` viejo
  (formato weekday) en IndexedDB simulada y verifica que
  `onupgradeneeded` produce la secuencia esperada, con descansos en los
  huecos correctos.
- Verificación en navegador real (CDP): completar un turno, confirmar
  que Hoy muestra el siguiente turno de la secuencia (no el que
  correspondería a ese weekday en el modelo viejo); dejar pasar un
  descanso y confirmar que se resuelve solo al otro día.

## Non-goals

- No se rediseña la pantalla de edición de un turno individual (nombre,
  ejercicios, series) — sigue siendo el mismo sheet, sólo cambia cómo se
  lo referencia (`index` en vez de `weekday`).
- No se agrega la posibilidad de completar más de un turno el mismo día
  calendario como flujo guiado — técnicamente `seqIndex` lo permitiría
  (nada lo bloquea), pero no se diseña una UI específica para eso en
  esta vuelta.
- No se toca el histórico de sesiones ya guardadas (siguen mostrando
  fecha real y qué se hizo ese día — eso no depende del modelo de
  rutina).
