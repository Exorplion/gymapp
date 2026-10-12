# Turnos universales, "hoy hago otra cosa" y cómo cerrar la semana: diseño

## Contexto

Enzo tomó cinco decisiones el 2026-10-12 (HANDOFF, "Decisiones de Enzo para
lo que sigue", más la respuesta a la pregunta que quedaba abierta):

1. **Un turno es uno solo.** "Posterior" existe una vez. La semana
   (A · P · Descanso · A · P · Descanso · Descanso) sólo lo *nombra*. Si
   cambiás Posterior, cambia en las dos apariciones.
2. **Migración: gana la primera.** Si hoy las copias del mismo nombre
   difieren, queda la primera de la secuencia ("las que tocarían lunes y
   martes"). **No se pierde nada**: lo descartado queda guardado.
3. **"Hoy hago otra cosa"** se puede hacer cualquier día, no sólo en un
   descanso: otro de tus turnos o una sesión libre (arrancás vacío y agregás
   ejercicios sobre la marcha).
4. **Opción A para el ciclo.** Si hacés algo fuera del plan, la semana
   **sigue como estaba**: el día cuenta como usado y el plan no se corre.
   Lunes Anterior; el martes tocaba Posterior y fue Pull con un amigo;
   miércoles descanso, jueves Anterior y viernes Posterior, como estaba.
5. **La app recomienda cómo compensar** lo que faltó en la semana, por zona
   muscular, **sólo con ejercicios que ya están en tu rutina**. Vos decidís:
   la podés ignorar y seguir con la rutina tal cual.

**Contradicción con HANDOFF.** En la entrada "borrar una serie…" el punto 2
dice "Lo que tocaba queda pendiente", o sea que la semana se corre (B). La
entrada siguiente dice que la pregunta A/B "sigue sin respuesta". La
respuesta de Enzo es **A**. Este documento manda sobre esas dos líneas.

**La seguridad de los datos es la restricción número uno.** Enzo ya perdió
datos dos veces: el 09-17 el navegador desalojó la base entera, y el 09-29
perdió dos sesiones hechas en modo prueba (`persist.js`, `modoPrueba.js`).
Cada paso de este diseño se puede deshacer, y la versión vieja de la app (la
que el service worker puede seguir sirviendo un rato) tiene que leer datos
válidos.

Base: el modelo de secuencia de
[`2026-08-16-rutina-por-secuencia-design.md`](./2026-08-16-rutina-por-secuencia-design.md)
(`S.routine` como array ordenado + `S.cfg.seqIndex`).

---

## Lo que hay hoy (verificado en el código)

Hoy un turno no tiene identidad propia: cada aparición en la secuencia es un
**slot** independiente, con su `id`, su `name` y su copia de los ejercicios.

`applyDays` (`lib/rutina-logic.js:321`) crea un slot con `uid()` y una copia
de los ejercicios por aparición, aunque el nombre se repita: la plantilla
Anterior/Posterior (`templates.js:93-106`) aplica cuatro copias, y
`templates.js:12-14` ya avisa que "se pueden desincronizar al editar una".
Toda edición va a **un índice** (`saveExercise` `:720`, `deleteExercise`
`:775`, `moveEx` `:799`, `saveSlot` `:613`, `persistSlot` `:424`): editar el
Posterior del martes no cambia el del viernes. El editor (`Rutina.jsx`) elige
por índice (`S.rutOpen`, `elegir` `:81`), y "Traer de otro" existe porque
había que cargar los mismos ejercicios dos veces (comentario de `:454`).

### Quién depende de la identidad o del índice del slot

| Lugar | Qué usa | Qué pasa con turnos universales |
|---|---|---|
| `S.cfg.seqIndex` (`state.js:28`), `resolveAutoRest` (`state.js:191`) | índice en `S.routine` | Sigue igual: la secuencia sigue siendo de slots. |
| `S.draft.slotId`, `startSession` (`session.js:1067`), `completeSession` (`:949`) | id del slot | Sigue valiendo: los slots conservan su id. Se agrega `turnoId`. |
| Sesiones guardadas (`slotId`, `dayName`) | id del slot | Siguen valiendo, porque la migración **no cambia ids de slot**. |
| `findEx` (`session.js:1497`) | primera coincidencia de `exId` | Con ejercicios compartidos el primero ES el mismo objeto: queda correcto. Hoy `cloneExercise` (`rutina-logic.js:208`) existe para esquivar justo esto. |
| `toggleUnilateral` / `setBarra` (`session.js:55`, `:87`) | `persistSlot` del primer slot que contiene el ejercicio | Hoy marcar unilateral el Press plano del lunes **no** lo marca en el del jueves. Se arregla solo. |
| `S.hoyOrder[slotId]` (`session.js:200`, `:230`) | id del slot, sólo en memoria | Pasa a la clave `turnoId`: el orden que elegiste para Anterior vale en las dos apariciones. |
| `ultimaVezDeTurno` / `minutosDeTurno` (`entreno.js:106`, `:99`), `minutosDe` duplicado (`Inicio.jsx:41`) | `s.slotId === slot.id` | Dicen "nunca" para la segunda aparición aunque hayas hecho el turno ayer. Pasan a `turnoId`. |
| `opcionesDescanso` (`descansoHoy.js:17`) | un renglón por slot | En A·P·R·A·P·R·R lista **cuatro** opciones (Anterior y Posterior dos veces cada uno). Se deduplica por turno. |
| `daySessions` / `routineStability` (`rutina-logic.js:29`, `:37`) | `slotId` | Pasan a `turnoId`. |
| `applyDeload` / `endDeload` (`rutina-logic.js:89`, `:116`) | recorren `S.routine` y mutan `ex.sets` | **Bug si no se toca:** con objetos compartidos, el mismo ejercicio se visita dos veces: pasa de 4 a 2 y de 2 a 1, `antes[id]` queda en 2 y al terminar la descarga vuelve a 2, no a 4. Hay que recorrer turnos. |
| `copyExercises` (`:281`), `CopyExercises.jsx:40-51` | índices de slot; `fromIdx === toIdx` para "sobre sí mismo" | Copiar entre dos apariciones del mismo turno tiene que dar `same`. La lista se arma por turnos. |
| `pinAddedToRoutine` (`:347`), `renameRoutineExercise` (`:374`), `seriesPrellenadas` (`session.js:1460`), `SessionView.jsx:55` | `slotId` de la sesión → ejercicios del slot | Pasan por `turnoDeSesion(s)` (sección 1). |
| `setActiveGym` (`gyms.js:182-203`), `gyms.js:278-281` | recorren slots y llaman a `persistSlot(i)` | Funciona (aplicar la máquina dos veces da lo mismo) pero escribe de más. Se recorren turnos. |
| Drag del editor (`drag.js:249-259`) | `d.exercises = porBloques(out)` sobre un slot | Es una de las **seis reasignaciones** de `exercises` (`drag.js:258`; `rutina-logic.js:304`, `:363`, `:765`, `:780`, `:807`). Pesa en la elección del modelo. |
| `pushHistory` / `undoRutina` (`:392-412`) | `structuredClone(S.routine)` | El clon pierde el vínculo de los slots con su turno: hay que volver a armarlo. |
| `applyWorkoutOrder` (`:513`) + `pideDescanso` (`:501`) | rearma la secuencia y **recalcula los descansos** | Ver la nota de abajo. |
| `MisEjercicios` (`Rutina.jsx:605-609`), `turnosDeEjercicio` / `turnosComunes` (`entreno.js:146`, `:168`) | deduplican por nombre / devuelven slots | La tabla sigue deduplicando por nombre (Anterior A y B son turnos distintos). `turnosDeEjercicio` deduplica por turno; si no, los chips dicen "A · P · A · P". |
| Backup (`backup.js:42`, `:74-80`, `:124-134`) | store `routine` + claves de `settings` | Hay que sumar `turnos` a exportar e importar (sección 2). |
| `modoPrueba.js:119` | compara sesiones por `slotId` | Sigue valiendo. La copia de prueba copia `settings` entero: `turnos` viaja solo. |
| `VoiceLog.jsx:100-117` | copia a mano el avance del puntero de `completeSession` | Se reemplaza por el helper único `avanzarPuntero` (sección 5). |
| `uncategorized()` (`muscle.ts:559`), `voice.js:33`, `ExInfo.jsx:23` | recorren slots | Ven duplicados, sin romper nada. `uncategorized` deduplica por id. |

**Nota sobre los descansos del editor (por lectura de código; falta
confirmarlo con un test).** "Mover antes / después" llama a `moverTurno`
(`entreno.js:179`) → `applyWorkoutOrder`, que tira los descansos y los vuelve
a calcular con `pideDescanso`: uno después de cada turno con un ejercicio de
Pierna. Anterior tiene "Extensión de cuádriceps" y "Hack squat"; Posterior,
"Curl femoral" y "Peso muerto rumano". Entonces mover cualquier turno
convierte **A·P·R·A·P·R·R** en **A·R·P·R·A·R·P**: con el editor actual Enzo
no puede conservar la semana que eligió. Pesa en la sección 3 y es la
pregunta abierta 1.

---

## 1. Modelo de datos

Qué tiene que lograr: (a) un turno con un solo contenido; (b) la secuencia
sigue siendo de slots, así que `seqIndex`, `slotId` y las sesiones viejas
siguen valiendo; (c) una versión vieja de la app que lea la base ve una
rutina válida; (d) revertir el código no pierde nada; (e) los ~40 lectores de
`slot.exercises` / `slot.name` no se reescriben todos de una.

### Enfoque A: turnos aparte, slots que los nombran, copia en cada fila (recomendado)

- **Dónde viven los turnos:** una clave nueva de `settings`, `turnos`:
  `[{ id, name, exercises, creado }]`, el mismo patrón que `lib` y `gyms`
  (`state.js:146-147`). **No hay que subir la versión de IndexedDB.**
- **Cada fila de `routine`:** `{ id, order, type, turnoId, turnoFirma, name,
  exercises }`. `name` y `exercises` son una **copia** del turno, escrita cada
  vez que el turno se guarda: es lo que lee una versión vieja. `turnoFirma` es
  un hash corto de `{name, exercises}` al escribir, para darse cuenta de que
  otra versión editó la fila (sección 2). Los descansos siguen siendo
  `{ id, order, type:'rest' }`.
- **En memoria, cada slot se "hidrata":** `name` y `exercises` pasan a ser
  propiedades de acceso **enumerables** (`Object.defineProperty`, get y set)
  que leen y escriben el turno. `slot.exercises = lista` (las seis
  reasignaciones) cae en el turno, `ex.sets = 2` muta el objeto compartido, y
  los ~40 lectores no cambian.
- **Guardar escribe el turno entero.** `persistSlot(i)` pasa a ser
  `persistTurno(slot.turnoId)`: en **una sola transacción** sobre `settings` +
  `routine` escribe el registro del turno y todas las filas que lo nombran,
  con copia y firma recalculadas. Hace falta un helper nuevo,
  `idb.tx(stores, fn)`: el `idb` actual sólo abre transacciones de un store
  (`db.js:84-99`).
- **Rehidratar después de cada `S.routine = …`** (`loadAll`, `undoRutina` /
  `redoRutina`, `applyDays`, `applyWorkoutOrder`, `startBlank`) con una sola
  función, `hidratar()`. `structuredClone` y JSON llaman a los getters, así
  que los clones y el backup salen con datos planos. El historial de deshacer
  guarda `{routine, turnos}`.

**A favor:** la versión vieja lee filas completas (c); revertir deja filas
válidas y la clave `turnos` se ignora (d); no hay `VersionError`; los
lectores no cambian; `findEx` queda correcto.

**En contra:** las propiedades de acceso son "magia": hay que documentarlas
en `state.js`, y un `{...slot}` produce un objeto plano que no se debe volver
a guardar como slot. El almacenamiento se duplica (k copias + el registro),
y pesa si un ejercicio tiene `photo` como data-URL (`rutina-logic.js:739`,
`:754`). Toda iteración que **muta** tiene que recorrer turnos, no slots
(`applyDeload`, gyms).

### Enfoque B: arrays compartidos sin propiedades de acceso

Es el candidato inicial: se hidrata para que los slots del mismo turno
compartan **el mismo array** `exercises`, y al guardar se escriben todas las
filas. No usa getters, pero las **seis** reasignaciones
`x.exercises = nuevoArray` rompen el vínculo sin avisar (sólo ese slot recibe
el array nuevo), y el nombre, copiado, necesita propagarse a mano en cada
renombre. Es frágil justo donde Enzo ya perdió datos: un cambio que "se ve
guardado" y en la otra aparición no está. **Descartado:** es A sin la red de
seguridad.

### Enfoque C: normalización completa, en un store nuevo `turnos`

Los slots quedan en `{id, order, type, turnoId}`, sin copia; todos los
lectores pasan por `turnoDe(slot)`; `DB.ver` sube de 3 a 4 (`db.js:4`). Es
una sola fuente de verdad, sin copias ni getters. Pero una versión vieja que
abre con `ver: 3` una base en 4 recibe **`VersionError`** → `bootError` → la
app no arranca hasta que se actualiza el service worker (`registerType:
'autoUpdate'`); si llegara a abrirla (rollback del código), lee slots **sin
ejercicios**, una rutina vacía que `persistAll` puede volver a escribir
vacía (vector de pérdida de datos); y hay que tocar ~40 lugares de una vez y
escribir una migración de bajada. **No ahora:** se puede llegar a C desde A
cuando nadie lea ya las copias (la migración a React Native es buen
momento).

### Recomendación

**Enfoque A.** Cumple (a) a (e). El costo queda encerrado en dos funciones,
`hidratar` y `persistTurno`, y en una regla: lo que muta, recorre turnos.

### Piezas nuevas del modelo

- `S.turnos` (en memoria) y la clave `settings.turnos`; `turnoDe(ref)` (por
  índice, `slotId` o `turnoId`); `turnoDeSesion(s)` (por `s.turnoId`, o por
  el slot si la sesión es vieja; `null` si ya no existe).
- Las sesiones nuevas guardan `turnoId` además de `slotId` (sección 4), y
  `S.cfg.ciclo` sube en 1 cada vez que el puntero vuelve a 0 (secciones 5 y
  6).
- `persistAll` (`rutina-logic.js:427-430`) hoy hace `clear()` y después N
  `put` **en transacciones separadas**: si la app muere en el medio, la rutina
  queda vacía. Es un riesgo que ya existe; con `idb.tx` pasa a ser atómico, y
  conviene arreglarlo en la Fase 1.

---

## 2. Migración: una reconciliación al arrancar

No hay paso de versión de IndexedDB. En `loadAll` (`state.js:137`), después
de leer `routine` y `settings` y **antes** de `resolveAutoRest`, corre
`reconciliarTurnos()`. Corre en cada arranque, no hace nada si todo está en
orden, y cubre con el mismo código la primera migración, la importación de
un backup viejo (filas sin `turnoId`) y una fila editada por una versión
vieja de la app (firma que no coincide).

### Algoritmo

0. **Con un borrador abierto (`S.draft`) no se migra:** se hidrata lo que
   haya y se reintenta en el próximo arranque. El borrador guarda `entries` y
   `order` por `exId`: si estás entrenando la *segunda* aparición de Posterior
   y gana la primera, los ids de tu sesión dejan de existir en la rutina, y
   `sessionExs`/`findEx` dejan de encontrar lo que estás anotando. Postergar
   cuesta abrir la app una vez más.
1. **¿Hace falta?** Sí, si alguna fila de entrenamiento no tiene `turnoId`,
   apunta a un turno que no está en `S.turnos`, o tiene una `turnoFirma`
   distinta de la firma de su propia copia. Si no, se hidrata y listo.
2. **Foto previa:** `routineSnapshot()` (`rutina-logic.js:186`) de la
   secuencia **tal como está**, para el respaldo del paso 6. En la **primera**
   migración (si no existe la clave) se guardan además las filas crudas, con
   ids y fotos, en `settings.rutinaAntesDeTurnos`: es para poder restaurar
   exacto, sin interfaz.
3. **Agrupar** por `norm(name)` (`format.js`: sin tildes, en minúsculas, sin
   espacios de más). "Anterior A" y "Anterior B" **siguen siendo dos turnos**
   (el seed, `seed.js:29-47`, es ese caso). Un turno sin nombre no se agrupa
   nunca. Las filas con `turnoId` válido y firma que coincide no se reagrupan
   por nombre: su identidad ya está decidida.
4. **Ganador de cada grupo:** si alguna fila tiene la firma cambiada (la editó
   una versión vieja), gana esa, porque es la edición más nueva; si son
   varias, la primera por `order`. Si no, gana **la primera por `order`**: la
   regla de Enzo (en A·P·R·A·P·R·R empezada el lunes, `order` 0 y 1 son lunes
   y martes; `weekdayProjection`, `rutina-logic.js:600`). El turno toma el
   `turnoId` del ganador si tenía, o uno nuevo, y los ids de ejercicio del
   ganador.
5. **Escribir en una sola transacción** (`idb.tx(['routine','settings'])`):
   `settings.turnos`, todas las filas con `turnoId` + copia + firma, `S.lib`
   si hay respaldo, y `S.cfg.turnosMigrados = 'YYYY-MM-DD'`. Si la transacción
   aborta, no cambió nada y la app abre con lo de antes (sin turnos, con aviso
   en consola), como el `try/catch` del TDEE en `loadAll`.
6. **Respaldo, sólo si alguna copia descartada era distinta del ganador:** se
   agrega al principio de `S.lib` la rutina `Respaldo antes de unificar
   turnos (12 oct)` con la foto previa entera (todas las copias como
   estaban). Se aplica desde "Mis rutinas" como cualquier otra
   (`applyLibRoutine`). Si las copias eran idénticas no hay nada que
   preservar, y un respaldo igual a la rutina sería ruido.
7. **Avisar una vez, sólo si se descartó algo.** Una hoja al arrancar: "Ahora
   cada turno es uno solo. Posterior tenía dos versiones distintas: quedó la
   del martes. La otra está en Mis rutinas → Respaldo antes de unificar
   turnos.", con el botón **Descargar respaldo**. La migración corre sin un
   toque del usuario y por eso no puede bajar el archivo sola: `exportJSON`
   (`backup.js:62`) necesita esa activación. Las tres redes son el respaldo en
   `S.lib`, las filas crudas y el botón.

### Qué pasa con cada cosa

**Ids de slot:** no cambian, así que `seqIndex`, `seqIndexDate`,
`S.draft.slotId` y el `slotId` de las sesiones siguen valiendo. **Ids de
ejercicio de las copias descartadas:** desaparecen de la rutina, y el
historial no se entera (`lastDataFor`, récords y progresión comparan por
`exKey`/nombre, `session.js:23`, `entreno.js:117`, nunca por `exId`); una
descarga activa (`S.cfg.deload.antes`) restaura los ids del ganador.
**`S.hoyOrder`** vive sólo en memoria, como hoy, con clave `turnoId`.
**Sesiones pasadas:** no se reescriben; `turnoDeSesion` les resuelve el turno
por su `slotId` (las de antes de la secuencia, con `weekday`, siguen sin
turno, `rutina-logic.js:22-28`).

### Respaldo e importación

`exportJSON` agrega `turnos: S.turnos` (versión de archivo 3); las filas de
`routine` ya salen con la copia, porque JSON llama a los getters.
`importJSON` escribe la clave si el archivo la trae y **la borra si no**:
restaurar es volver a ese estado, y un `turnos` viejo colgado haría
reaparecer turnos que el backup no tiene. Al recargar, `reconciliarTurnos`
unifica las filas del backup viejo.

### Tests (Fase 1)

Dos "Posterior" distintos → un turno con el contenido de `order` 1 y un
respaldo con la secuencia previa entera · copias idénticas → un turno, sin
respaldo · "Anterior A"/"Anterior B" → dos turnos · borrador abierto → no
migra · correr dos veces → la segunda no escribe · fila con firma cambiada →
gana y la versión anterior va al respaldo · backup sin `turnos` → se borra la
clave y se unifica al recargar · transacción abortada (`QuotaExceededError`
simulado) → la rutina queda como estaba · **compatibilidad:** las filas de
`persistTurno` leídas *sin* hidratar (como la versión vieja) tienen `name` y
`exercises` completos e iguales al turno · `applyDeload` con un turno que
aparece dos veces → cada ejercicio baja una vez y `endDeload` lo devuelve a
su valor · `undoRutina` tras editar un turno → vuelve en las dos apariciones
y siguen vinculadas · `applyWorkoutOrder` sobre A·P·R·A·P·R·R da
A·R·P·R·A·R·P (confirma la nota de los descansos).

---

## 3. Editor: qué turno cambiar y, aparte, el orden de la semana

Se describe el comportamiento; las maquetas van aparte (lienzo de opciones,
como siempre). La pestaña Entreno separa dos cosas:

1. **Tus turnos.** Cada turno distinto **una vez**, con nombre, ejercicios,
   series y cuántas veces aparece ("2 veces por semana"; "no está en tu
   semana" si quedó sin usar). Tocarlo lo edita con la tarjeta de siempre
   (`Turno` / `ListaEditable`, `Rutina.jsx`), referida al turno: `S.rutOpen`
   pasa a ser un `turnoId`.
   Las funciones del editor (`saveExercise`, `deleteExercise`, `moveEx`,
   `saveSlot`, el drag `rut`, `abrirAsistente`, `copy-exs`, `ex-form`,
   `ex-info`) aceptan `{turnoId}`, con la firma por índice como envoltorio de
   compatibilidad (un turno fuera de la semana no tiene índice). Renombrar
   cambia todas las apariciones; un nombre repetido se rechaza ("Ya tenés un
   turno que se llama así").
2. **Tu semana.** La secuencia, una parada por slot: el turno con su nombre
   corto, o un punto si es descanso. Un turno que aparece dos veces se ve dos
   veces con el mismo código ("A" en el lugar 1 y en el 4). Tocar una parada
   abre ese turno en "Tus turnos": no hay contenido por parada. Se puede
   **mover** una parada (`reorderSeq`, `rutina-logic.js:438`, hoy sin uso en
   la interfaz), **insertar** un turno existente o un descanso (`insertRest`,
   `:456`; "Crear un turno nuevo" lo crea y lo inserta) y **sacar** una
   parada (si era la última aparición: "¿Lo guardás para después o lo
   borrás?", por defecto se guarda; con sesión abierta no se saca la suya,
   `hasOpenSession`, `:480`). Los descansos son paradas **explícitas**: lo que
   armás es lo que queda, al revés de `applyWorkoutOrder`. `pideDescanso`
   puede quedar como un botón "Acomodar descansos solo", de una vez y con
   deshacer. **Pregunta abierta 1.**

**El puntero al editar la semana.** Antes de editar se anota el `id` del slot
pendiente; después, `seqIndex` pasa al índice nuevo de ese slot (si se sacó,
a la parada que quedó en su lugar). Mover una parada no cambia "lo que te
toca hoy". Reemplaza el conteo de entrenamientos de `applyWorkoutOrder`
(`:513-562`), que existía sólo porque los descansos se regeneraban sin id.

**Copiar entre turnos** (`CopyExercises.jsx`): las listas se arman por turno
y "sobre sí mismo" se detecta por `turnoId`. Copiar sigue clonando con ids
nuevos: un ejercicio copiado a otro turno es otro ejercicio.

**Plantillas y "Mis rutinas":** `applyDays` agrupa por `norm(name)` igual que
la reconciliación, así que la plantilla A·P·R·A·P·R·R crea **dos** turnos.
Una rutina de la biblioteca con copias distintas del mismo nombre aplica la
primera; la entrada de `S.lib` no se toca, así que no se pierde nada.
`routineSnapshot` y `saveWizardRoutine` no cambian de formato (`days` sigue
siendo la secuencia): `S.lib` sigue compatible.

---

## 4. "Hoy hago otra cosa"

### Dónde y qué se ofrece

- **Día de entrenamiento:** en Hoy, antes de empezar (`PreSessionHero` /
  `PlanHoy`, `Hoy.jsx:413`), un renglón discreto "Hoy hago otra cosa" que
  abre una hoja. **Descanso:** la lista de `RestHero` (`Hoy.jsx:305`) ya es
  esto; se le suma "Sesión libre". **Con una sesión abierta no se ofrece:**
  primero hay que terminarla o descartarla.
- `opcionesDelDia({ routine, turnos, seqIndex, sessions, hoy })` generaliza
  `opcionesDescanso` y sigue siendo pura:
  - **tus turnos, una vez cada uno** (por `turnoId`), con "hace N días" y el
    aviso "repetirlo no deja descansar esos músculos" que ya existe
    (`descansoHoy.js:49`); la última vez sale de `turnoId`;
  - en un día de entrenamiento no aparece el que te tocaba (ya está en
    pantalla); en un descanso, el primero es "el que sigue" y lleva
    "Adelantar", como hoy (sección 5);
  - **sesión libre:** "Arrancás vacío y agregás ejercicios sobre la marcha",
    con un nombre opcional ("Pull con Juan"; si no, "Sesión libre"). Se
    agregan con el asistente de siempre (`addSessionExercise`,
    `session.js:719`), que permite cualquier ejercicio del catálogo: la regla
    de "sólo tu rutina" es de las **recomendaciones** (sección 6), no de lo
    que elegís hacer vos.

### Cómo se guarda

El borrador (`startSession`, `session.js:1067`) y la sesión cerrada
(`completeSession`, `:949`) suman campos:

```js
// dentro del plan (como hoy, más turnoId)
{ slotId, turnoId, dayName, ... }
// otro de tus turnos, fuera del plan
{ slotId: null, turnoId: 'U', dayName: 'Pull', fueraDePlan: true,
  reemplaza: { slotId: 'p', turnoId: 'T', ciclo: 12 } | null, ... }  // null en un descanso
// sesión libre
{ slotId: null, turnoId: null, dayName: 'Pull con Juan', fueraDePlan: true, libre: true,
  reemplaza: { slotId, turnoId, ciclo } | null, ... }
```

- **`slotId: null` fuera del plan, a propósito:** una versión vieja no le
  atribuye la sesión al turno que tocaba, y `modoPrueba.js:119` compara por
  id. Todo lector que busque el turno de una sesión pasa por
  `turnoDeSesion(s)` (`pinAddedToRoutine`, `renameRoutineExercise`,
  `seriesPrellenadas`, `SessionView.jsx:55`, `opcionesDelDia`,
  `ultimaVezDeTurno`).
- **Sesión libre sin turno:** `sessionExs(-1)` ya devuelve sólo los `extras`
  (`session.js:595-598`), que es exactamente una sesión libre. Pero
  `indiceHoy` (`:326`) volvería al pendiente porque `draft.slotId` es null:
  hay que sumarle el caso `draft.libre` (índice `-1`) y que Hoy,
  `App.jsx:460`/`:544`, `Despues.jsx:14`, `ExOpciones.jsx:21`,
  `Maquinas.jsx:34` y `asistente-agregar.js:192` soporten `-1`. La mayoría ya
  cae en `S.routine[-1] === undefined` sin romperse, pero hay que
  **testearlos uno por uno**. La tarjeta "Entrenando ahora" de Inicio
  (`Inicio.jsx:82-90`) arma la lista con `turno?.exercises`; para una sesión
  libre tiene que usar `sessionExs`.
- **Fijar en la rutina** lo agregado: no se ofrece en una sesión libre (no
  hay turno); en otro de tus turnos se ofrece como hoy, en ese turno.

### La regla de MarcarDia, revisada y no saltada

`MarcarDia.jsx:8-11` rechaza un turno escrito a mano porque "un turno suelto
que no existe en la rutina no se puede comparar con nada después (ni
progresión, ni volumen por grupo, ni 'última vez')". **La regla se mantiene
para el registro retroactivo:** anotar un día pasado sigue siendo elegir uno
de tus turnos. Una sesión libre retroactiva sería `entries: []` + nombre
suelto, sin ejercicios ni turno: exactamente el dato huérfano.

**Una sesión libre en vivo no es huérfana:** tiene **series reales por
ejercicio** (`completeSession` no guarda una sesión sin series,
`session.js:958`), y todo lo que compara, compara por ejercicio: progresión y
récords por `exKey`, recuperación y volumen por zona con `zonasDeEjercicio`
sobre las entradas (`recuperacion.js:167`, `:209`), la racha por fecha
(`streak.ts`). Lo que se compara por turno ("última vez de Posterior",
minutos, estabilidad) **no la incluye** porque `turnoId` es null, y es lo
correcto: no fue Posterior. El nombre libre es sólo una etiqueta.

**En historial y Progreso:** la tarjeta de sesión (`SessionCard.jsx:36`)
muestra `dayName` como hoy, más una marca chica "Fuera del plan" con "en vez
de Posterior" si `reemplaza` no es null. La recuperación y el mapa ya la
cuentan, sin cambios.

---

## 5. Regla del puntero (opción A)

Un helper único, `avanzarPuntero(desdeIndex, fecha)`: `seqIndex =
(desdeIndex + 1) % n`, `seqIndexDate = fecha`, y si dio la vuelta suma 1 a
`S.cfg.ciclo`. Lo usan `completeSession` (`session.js:1015-1017`; el pedido
decía `~:995-1001`, la línea real es ésta), `registrarDiaEntrenado`
(`:1408-1413`) y `VoiceLog.jsx:115-117`, que hoy lo copia a mano.
`resolveAutoRest` (`state.js:191`) también suma `ciclo` al dar la vuelta.

Sea `p` el slot pendiente **al abrir la sesión** (queda en el borrador; no se
recalcula al cerrar, por si pasó la medianoche):

| Slot `p` | Qué hiciste | Puntero al cerrar | Sesión |
|---|---|---|---|
| entreno T | T | `p + 1` | `slotId = p`, `turnoId = T` |
| entreno T | otro turno U, o sesión libre | `p + 1`: el día se usó y la semana sigue | `fueraDePlan`, `reemplaza = {p, T, ciclo}` |
| descanso | "Adelantar": el que sigue, en el slot `k` | `k + 1` (como hoy) | dentro del plan, `slotId = k` |
| descanso | cualquier otro turno, o sesión libre | **no se mueve**: mañana `resolveAutoRest` consume el descanso por fecha | `fueraDePlan`, `reemplaza = null` |

- **Cambio de comportamiento:** hoy, elegir en un descanso un turno que no es
  el siguiente deja el puntero en `índiceDeEseTurno + 1` (`session.js:1015`):
  la semana salta (opción B). Con A, ya no.
- **Ejemplo de Enzo** (A·P·R·A·P·R·R, lunes en el slot 0): martes `p = 1`
  (Posterior), hace Pull libre → `seqIndex = 2`; el miércoles el descanso se
  consume solo por fecha; jueves Anterior (3), viernes Posterior (4).
- **Retroactivo:** registrar un día pasado usa la misma tabla con el `p` de
  ese momento, y sólo si es la sesión más reciente (la condición de hoy,
  `session.js:1407`). MarcarDia sólo ofrece turnos, así que es el caso "T" o
  "U".
- **Día libre declarado** (`setDiaLibre`, `state.js:241`): sigue sin mover el
  puntero.

---

## 6. Recomendar cómo cerrar la semana

### Principios

- **Sólo con lo que ya está en tu rutina.** Dos tipos de propuesta:
  **series** (+N series a un ejercicio que **ya está** en la sesión de hoy y
  trabaja la zona que falta) y **traer** (sumar a la sesión de hoy un
  ejercicio **del turno que no se hizo**, el de `reemplaza`, con nombre,
  equipo, máquina, unilateral y cat). Nunca se busca en el catálogo:
  `recommendedExercises` (`rutina-logic.js:639`) no se usa acá.
- **Recomendaciones, no cambios:** aceptar toca **sólo la sesión de ese día**
  (`S.draft.extraSets` / `S.draft.extras`); nunca `S.routine` ni `S.turnos`.
- **No se inventa** (CLAUDE.md): sin turno reemplazado, sin entrenamientos
  que queden en el ciclo o sin datos de zona, no se dice nada; lo que no
  entra se dice una vez. **Avisos raros:** sólo después de una sesión fuera
  del plan en un día de entrenamiento, en las sesiones afectadas del ciclo.

### "Grupo muscular" = zona

La frecuencia se evalúa por **zona** (`ZONAS`, `recuperacion.js:44`), no por
el grupo de `catOf`: "Pierna" mezcla cuádriceps y femoral (lo dice el
encabezado de `recuperacion.js`). Por grupo, en el caso de Enzo la frecuencia
de Pierna no bajaría (Anterior tiene cuádriceps), y justo el femoral es lo
que falta. El volumen se mide en series por zona (`seriesPorZona`), y la
**fibra** (`coberturaDe`, `coverage.js:39`) desempata qué ejercicio proponer.

### Entradas y ventana

- **Ventana = el ciclo actual:** desde que el puntero volvió a 0 (el
  `S.cfg.ciclo` vigente) hasta el último slot. No hace falta estimar una
  fecha de inicio: cuenta toda sesión con `reemplaza.ciclo === S.cfg.ciclo`.
  Cuando el puntero da la vuelta, todo vence; nada pasa a la semana siguiente.
- **Lo que quedó sin hacer** por cada sesión fuera del plan del ciclo:
  `seriesPorZonaDeTurno(turno de reemplaza)` (`entreno.js:53`) menos
  `seriesPorZona([esa sesión], su fecha)`, sólo los positivos; **menos lo ya
  compensado**: lo hecho por encima del plan en esa zona por las sesiones
  posteriores del ciclo.
- **Frecuencia por zona:** cuántos slots del ciclo planeaban trabajarla,
  contra las sesiones hechas que la trabajaron más los slots que quedan desde
  `p` que la trabajan.
- **Zona con falta:** ≥ 3 series faltantes, o frecuencia que bajó de 2 o más
  a 1, o una fibra de `FIBRAS_DEL_GRUPO` que ya no cubre ninguna sesión del
  ciclo, hecha ni por hacer.
- **Recuperación** (`recuperacion()`, `ventanaHoras`; `recuperacion.js:167`,
  `:150`). La fecha de cada slot que viene se estima como "un slot = un día",
  el mismo supuesto que `weekdayProjection`, y se dice "estimado" como el
  resto de la recuperación. Una propuesta de la zona z para hoy vale sólo si
  (1) z no está "cargada" ahora (`estadoDe` ≥ 60 %, `recuperacion.js:159`), y
  (2) si un slot posterior del ciclo trabaja z en su plan, con las series de
  hoy z llega a ese slot con ≥ 60 % estimado (`ventanaHoras(z, series, 2)`
  contra las horas que faltan).

### Orden, elección y topes

- **Orden de las zonas:** primero las que perdieron frecuencia, después las
  de más series faltantes, después el orden de `ZONAS`.
- **Propuesta para cada zona:** si perdió frecuencia y el turno de hoy no la
  trabaja → **traer** del turno que no se hizo un ejercicio cuya zona
  principal sea z; si no → **series** en el ejercicio de hoy que trabaja z.
  Desempate en los dos casos: el de menos zonas (más específico), después el
  que cubre la fibra que falta, después el de más series planeadas. Si la
  elegida no pasa la recuperación se prueba la otra; si ninguna pasa, la zona
  no recibe nada hoy.
- **Topes** (números propuestos; pregunta abierta 3): **+4 series** extra por
  sesión en total; **+2** por ejercicio existente; **1** ejercicio traído por
  sesión, con `min(sus series, la falta, 3)`; nunca más que la falta de la
  zona; nunca el grupo por encima de su MRV semanal (`VOLUME_BANDS`,
  `charts.ts:146`).

### Salida

`compensacion({ routine, turnos, sessions, seqIndex, ciclo, rec, ahora })` es
pura, como `opcionesDescanso`, y se calcula en cada render:

```js
null | {
  origen: [{ sessionId, fecha, enVezDe: 'Posterior', hiciste: 'Pull con Juan' }],
  faltan: [{ zona: 'Femoral', series: 7, frecuencia: { plan: 2, real: 1 } }],
  hoy: [
    { tipo: 'series', exId, nombre: 'Curl femoral', mas: 2, zona: 'Femoral' },
    { tipo: 'traer', ex: { name, sets, reps, equip, machine, unilateral, cat }, desde: 'Posterior', zona: 'Gemelos' },
  ],
  despues: 'el viernes en Posterior',   // dónde va lo que hoy no entra, si hay lugar
  sinLugar: ['Trapecio', 'Romboides'],  // lo que no entra este ciclo
}
```

### Dónde aparece y cómo se aplica

- **En Hoy, antes de empezar**, debajo del encabezado del turno: una tarjeta
  "Para cerrar la semana" (`.group` + `.grouprow`, patrón existente), una
  fila por propuesta con el motivo en el subtítulo ("faltan 7 series de
  femoral por el martes"), y dos acciones: **Sumar a hoy** (se puede
  destildar fila por fila) y **Hoy no**.
- **Al cerrar la sesión fuera del plan**, una sola línea en el resumen ("El
  jueves y el viernes te voy a proponer cómo compensar femoral y gemelos.
  Podés ignorarlo."). Nada en Inicio: un aviso diario devaluaría la moneda.
- **Aceptar antes de empezar** guarda `S.cfg.compensar = { ciclo, slotId,
  items }` y `startSession` lo vuelca al borrador: `series` →
  `extraSets[exId] += mas` (`targetSets` ya los suma, `session.js:540-548`);
  `traer` → `extras` con `compensa: true`, que `completeSession` no ofrece
  fijar en la rutina (filtro en `added`, `session.js:973`). Con la sesión
  abierta, `addExtraSet` / `addSessionExercise` directo. **"Hoy no"** guarda
  `S.cfg.compensarDescartada = 'ciclo:slotId'`.

### Ejemplo trabajado: el caso de Enzo

Usa la plantilla Anterior/Posterior (`templates.js:15-39`); la rutina real de
Enzo puede diferir, y el test lo fija con estos datos. A·P·R·A·P·R·R, lunes
en el slot 0. **Lunes:** Anterior, dentro del plan. **Martes** (`p = 1`,
Posterior): sesión libre "Pull con Juan" → Dominadas 4, Remo con barra 4,
Face pull 3, Curl con barra 4. El puntero pasa a 2.

Por zona, con `zonasDeEjercicio` y `fibras.js`:

| Zona | Plan de Posterior | Hecho el martes | Falta | Frecuencia en el ciclo |
|---|---|---|---|---|
| Femoral (PMR 4 + Curl femoral 3) | 7 | 0 | **7** | 2 → 1 |
| Gemelos | 4 | 0 | **4** | 2 → 1 |
| Glúteo (Hip thrust) | 4 | 0 | **4** | 2 → 1 |
| Trapecio, Romboides (Kelso) | 3 c/u | 0 | **3** c/u | 2 → 1 |
| Bíceps | 6 | 4 | 2 (< 3: no se dice) | — |
| Dorsal bajo / alto, Hombro posterior | 4 / 4 / 3 | 8 / 4 / 3 | 0 (sobra dorsal bajo) | — |

**Jueves** (`p = 3`, Anterior, que no trabaja ninguna de esas zonas; el hack
squat carga glúteo sólo como secundario):
- **Femoral:** perdió frecuencia → traer Curl femoral (3); pero el viernes
  Posterior vuelve a cargarlo a ~24 h y `ventanaHoras('Femoral', 3, 2) =
  72 × 0,90 = 64,8 h` → ~37 % → **no pasa** ("series" no aplica: Anterior no
  tiene femoral). **Gemelos:** traer Elevación de gemelos (3), `42 × 0,90 =
  37,8 h` → ~63 % → **pasa**. **Glúteo** (`66 × 0,90`, ~40 %) y
  **Romboides/Trapecio** (~44 %) no pasan, y ya se usó el único "traer".
- **Propuesta:** "Traer Elevación de gemelos 3×15 (de Posterior): faltan 4
  series de gemelos por el martes", más "Lo demás, el viernes en Posterior".

**Viernes** (`p = 4`, Posterior; ningún slot posterior del ciclo trabaja esas
zonas, así que la regla 2 no limita):
si el jueves sumó gemelos, ya no tiene falta (queda 1, < 3). Femoral **+2
Curl femoral** y Glúteo **+2 Hip thrust** llegan al tope de +4. Trapecio y
Romboides van a `sinLugar`, dicho una vez ("quedan 3 series abajo esta
semana"); femoral queda 5 abajo y también se dice. **No se propone nada para
la semana siguiente.** Con "Hoy no", el viernes es el Posterior de siempre.

---

## 7. Fases

Cada fase se puede publicar sola. La 2 y la 3 dependen de la 1; la 4, de la 3.

### Fase 1: modelo y reconciliación (casi sin cambios visibles)

Incluye: `S.turnos`/`settings.turnos`, `hidratar`, `persistTurno`, `idb.tx`;
`reconciliarTurnos` en `loadAll` con foto previa, respaldo y aviso único;
`applyDays` agrupa por nombre; `applyDeload`/`endDeload` y `gyms.js` iteran
turnos; deshacer con turnos; `turnoId` en sesiones nuevas y `turnoDeSesion`;
`ultimaVezDeTurno`, `minutosDeTurno`, `minutosDe` (Inicio), `daySessions`,
`routineStability` y `opcionesDescanso` por turno; `turnosDeEjercicio`
deduplicado; "sobre sí mismo" en `copyExercises` por turno; backup v3;
`persistAll` atómico. El editor actual sigue andando por índice y ya edita el
turno compartido.

- [ ] Con la rutina real de Enzo (o su copia en modo prueba): un turno por
      nombre; editar Posterior en el martes cambia el viernes y sobrevive a
      recargar.
- [ ] Si las copias diferían: el respaldo está en Mis rutinas, el aviso sale
      una vez y "Descargar respaldo" baja el JSON.
- [ ] El build anterior (`main` antes de la fase), sobre la base migrada,
      muestra la misma rutina y entrena normal.
- [ ] Con un borrador abierto, la migración se posterga y la sesión sigue.
- [ ] En un descanso, "¿Entrenar igual?" lista cada turno una sola vez.
- [ ] Pasan los tests de la sección 2 y los existentes siguen verdes.

### Fase 2: editor por turnos y semana aparte

Incluye: "Tus turnos" y "Tu semana" (sección 3); `S.rutOpen` por `turnoId`;
funciones del editor por `{turnoId}`; turnos sin usar; nombres únicos;
descansos explícitos (según la respuesta 1); puntero seguido por id de slot;
`CopyExercises` por turno. Lienzo de opciones antes de implementar.

- [ ] Mover una parada no cambia los descansos ni "lo que te toca hoy";
      A·P·R·A·P·R·R se arma desde cero.
- [ ] Sacar la última aparición ofrece guardar el turno, que se vuelve a
      insertar con sus ejercicios.
- [ ] Verificado a 390 y 430 px en Chrome con el build de producción.

### Fase 3: "Hoy hago otra cosa" y la regla del puntero

Incluye: `opcionesDelDia` y la hoja; sesión libre (`draft.libre`, índice -1
en Hoy, Inicio y las hojas de la sesión); `fueraDePlan` / `reemplaza` /
`libre`; `avanzarPuntero` único (sale la copia de VoiceLog) y `S.cfg.ciclo`;
la marca en el historial; MarcarDia sin cambios, con el comentario al día.

- [ ] Martes Pull libre → miércoles Descanso, jueves Anterior, viernes
      Posterior. En un descanso, otro turno no mueve la semana; "Adelantar"
      sí, como hoy.
- [ ] El historial dice "Pull con Juan · Fuera del plan · en vez de
      Posterior"; cuenta en recuperación, volumen y racha, y no cambia la
      "Última vez" de Posterior.
- [ ] Una sesión libre completa (agregar 3 ejercicios, anotar, borrar una
      serie, cerrar), con el seed, sin pantallas en blanco.

### Fase 4: compensación

Incluye: `compensacion()` pura con tests (el ejemplo de la sección 6 es el
principal; además ciclo vencido, sin slots restantes, fuera del plan en un
descanso, topes y recuperación); la tarjeta en Hoy; aceptar hacia el
borrador; "Hoy no"; la línea del resumen; los extras `compensa: true` no se
ofrecen para fijar.

- [ ] Nunca aparece un ejercicio que no esté en la rutina (un test lo afirma
      sobre todas las salidas); aceptar no cambia `S.routine` ni `S.turnos`.
- [ ] "Hoy no" deja la sesión exactamente como el plan; sin sesiones fuera
      del plan, la tarjeta no existe.

---

## Riesgos

- **Propiedades de acceso implícitas:** alguien guarda un `{...slot}` como
  fila o asigna `S.routine = …` sin `hidratar()`. Mitigación: `hidratar` y
  `persistTurno` son la única puerta (se borran los demás
  `idb.put('routine')`), un test de "siguen vinculadas" tras cada operación
  del editor, y el comentario en `state.js`.
- **Una versión vieja edita después de migrar:** lo cubren la firma y la
  reconciliación. Una pestaña vieja que corre `persistAll` reusa los objetos
  y no borra `turnoId`; sólo su `applyDays` vuelve a disparar la unificación.
  Peor caso: ese cambio termina en el respaldo en vez de en el turno. Nunca
  se pierde.
- **Tamaño:** las copias multiplican las fotos data-URL (`photo`). Si
  molesta, `turnos` se parte en una clave por turno (`turno:<id>`).
- **"Gana la primera"** puede no ser lo que Enzo quería en algún turno: por
  eso el respaldo y el aviso con nombre y día.
- **"Un slot = un día"** en la compensación (supuesto de `weekdayProjection`,
  dicho como "estimado") puede volver conservadora la regla de recuperación.
  Es preferible a lo contrario.
- **`indiceHoy = -1`** en sesión libre toca muchas hojas: hay que
  verificarlas una por una (Fase 3).

## Fuera de alcance

- El núcleo de IA (Cloudflare Worker + Gemini, importar rutina como texto, el
  coach): spec aparte, después de estas fases (HANDOFF, decisión 4).
- Recomendar **bajar** volumen cuando una sesión fuera del plan sobrecargó
  una zona (el dorsal bajo del martes): por ahora lo cubre la tarjeta de
  recuperación.
- Convertir un borrador ya empezado en "otra cosa"; una sesión libre
  retroactiva; el enfoque C; las maquetas (van en un lienzo aparte).

## Preguntas abiertas para Enzo

1. **Descansos en "Tu semana":** ¿los ponés vos donde quieras (recomendado:
   lo que armás es lo que queda, más un botón "acomodar descansos solo"), o
   se siguen acomodando solos como hoy? Hoy mover un turno te convierte
   A·P·R·A·P·R·R en A·R·P·R·A·R·P.
2. **En un descanso, entrenar "el que sigue":** ¿adelanta la semana como hoy
   (el jueves pasa a ser lo del viernes), o cuenta como fuera del plan y la
   semana no se mueve?
3. **Topes de la compensación:** +4 series por sesión, +2 por ejercicio, un
   ejercicio traído por sesión, y avisar sólo si a una zona le faltan 3
   series o más. ¿Te parecen bien, o preferís más o menos?
