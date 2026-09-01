# Etapa 5i — sheet `SessionExercise` (cambiar/agregar ejercicio en sesión activa)

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5h
(cerrada — commit `3a4e2d8`).

## Alcance y rulings

**`SessionExercise.jsx` — se porta esta etapa.** Callers reales
confirmados por grep: `ExerciseCarousel.jsx:146` (botón "Cambiar", con
`exId` → reemplaza) y `Hoy.jsx:170` (botón "+ Agregar ejercicio a esta
sesión", sin `exId` → agrega al final, sólo visible con `active` true).
`ExerciseCarousel.jsx` NO está portado todavía (grep confirmado: no
existe en `native/src/`) — mismo patrón que Etapa 5g/5h con sheets que
tienen un caller no alcanzable todavía. El OTRO caller (`Hoy.jsx:170`)
SÍ es alcanzable: `native/src/screens/Hoy.js` ya tiene `active`/`index`
como variables locales (líneas 16-17) pero no tiene todavía el botón
"+ Agregar ejercicio". Se agrega esta etapa, dando un caller real desde
el día uno (igual que Etapa 5h con `CopyExercises`).

Ruling: **todas las dependencias ya existen** — `S, closeSheet`
(`state.js`), `WD` (`format.js`), `addSessionExercise,
replaceSessionExercise, sessionExs` (`session.js`),
`recommendedExercises` (`rutina-logic.js`), `EQUIP, isMachineBound`
(`equip.js`), `MachineField` (Etapa 5g), `toast` (`toast.js`) — grep
confirmado, cero dependencias nuevas de `lib/`.

Ruling: **`sets`/`reps` son inputs CONTROLADOS con string crudo**
(`useState(String(original?.sets ?? 3))`), a diferencia de los inputs
numéricos de `BodyForm.js`/`Profile.js` que son no controlados — acá no
hay riesgo de reformateo mientras se tipea porque el `onChange` sólo
guarda el string tal cual, sin `parseFloat` intermedio (el parseo, si
hace falta, lo hace `addSessionExercise`/`replaceSessionExercise` del
lado de `session.js`, ya portado). Portar tal cual: `TextInput`
controlado normal, sin necesidad del patrón `defaultValue`.

Ruling: **autofocus con SELECT, no sólo focus** — el original usa
`nameRef.current?.select()` (selecciona todo el texto precargado), no
`.focus()`, para que la primera tecla reemplace el nombre entero en vez
de insertarse en medio. En RN esto es `TextInput.setSelection(0,
name.length)` después de `.focus()`, o simplemente confiar en que
`selectTextOnFocus` (prop nativa de `TextInput`) más un `.focus()`
programático logre el mismo efecto — decidir cuál encaja mejor al
implementar y documentar en el reporte.

Ruling: **`soloEquipo`** (mensaje de confirmación distinto si sólo se
tocó el equipo) se calcula comparando `name.trim()` contra el nombre
original trimeado — portar tal cual, sin optimizar la comparación.

Ruling: **sugerencias del catálogo excluyen los ejercicios que ya están
en la sesión** (`sessionExs(+wd)`, no `S.routine`) — a diferencia de
`EntryEdit`/`ExerciseForm` que sugieren desde `EXCATALOG` global, acá
`recommendedExercises(+wd)` ya filtra por grupo del día, y además se
excluyen los que ya están presentes en la sesión ACTIVA (con
`sessionExs`, que puede incluir extras agregados a mano, no sólo lo
planeado). Portar tal cual.

Ruling: jest se mantiene igual — esta etapa no agrega lógica nueva a
`lib/`, todo lo que `SessionExercise` necesita ya existe.

## Task única

**Files:**
- Create: `native/src/components/sheets/SessionExercise.js`
- Modify: `native/src/components/SheetHost.js` (registrar `'ex-swap':
  SessionExercise` en `SHEET_REGISTRY` — SOLO esa línea + su import)
- Modify: `native/src/screens/Hoy.js` (agregar el botón "+ Agregar
  ejercicio a esta sesión", visible SOLO cuando `active` es true,
  llamando `openSheet('ex-swap', {wd: index})` sin `exId`)

**Interfaces:**
- Consumes: `S, closeSheet` (`state.js`), `WD` (`format.js`),
  `addSessionExercise, replaceSessionExercise, sessionExs`
  (`session.js`), `recommendedExercises` (`rutina-logic.js`), `EQUIP,
  isMachineBound` (`equip.js`), `MachineField` (Etapa 5g, ya portado),
  `toast` (`toast.js`) — todos ya portados, ninguno se modifica.

- [x] **Step 1**: Leer `web/src/components/sheets/SessionExercise.jsx`
  completo (156 líneas, prestar atención al comentario de cabecera sobre
  por qué reemplazo y alta comparten componente, y al comentario sobre
  `soloEquipo`) y `web/src/components/screens/Hoy.jsx` línea 170
  (contexto exacto del botón alcanzable).

- [x] **Step 2**: Portar `SessionExercise` verbatim a
  `native/src/components/sheets/SessionExercise.js` — props `{wd,
  exId=null}`, `esCambio = !!exId`, busca el original vía
  `sessionExs(+wd).find(e => e.id === exId)` sólo si `esCambio`, estado
  inicial precargado desde el original (o valores por defecto si es
  alta), autofocus+select en el nombre, sugerencias filtradas por
  `recommendedExercises(+wd)` excluyendo los ya presentes, chips de
  equipo + `MachineField` condicional + chip de unilateral (mismo patrón
  que `EntryEdit.js`/`CopyExercises.js`), `confirmar()` idéntico (llama
  `replaceSessionExercise`/`addSessionExercise` según corresponda, toast
  distinto si `soloEquipo`).

- [x] **Step 3**: Registrar `'ex-swap': SessionExercise` en
  `SheetHost.js`.

- [x] **Step 4**: Agregar el botón "+ Agregar ejercicio a esta sesión"
  en `Hoy.js`, gated por `active`, llamando `openSheet('ex-swap', {wd:
  index})`.

- [x] **Step 5: Verificar**

Run: `cd native && npx jest` → 330/330, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 6: Commit**

```bash
cd native && git add src/components/sheets/SessionExercise.js src/components/SheetHost.js src/screens/Hoy.js && git commit -m "feat(rn): portar sheet SessionExercise (cambiar/agregar ejercicio en sesión activa)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5h (330).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que el botón nuevo en `Hoy.js` sólo aparece con `active
  === true` (nunca antes de arrancar la sesión ni en el estado "ya
  hecha").
- [x] Confirmar que `r` (resultado de
  `replaceSessionExercise`/`addSessionExercise`) se chequea antes de
  cerrar el sheet — si la operación falla, el sheet debe quedar abierto
  con el toast de error, no cerrarse igual.
- [x] Confirmar que `MachineField` (Etapa 5g) se reusa tal cual, sin
  duplicar su lógica dentro de este sheet.

### Corrección menor de la propia ruling de este plan

La ruling sobre `datos.machine` decía `machine.trim() : undefined`, pero
el código real del original (línea 57) NO tiene `.trim()`:
`machine: equip && machine ? machine : undefined`. El implementador
siguió correctamente el código fuente real en vez de la paráfrasis del
plan — confirmado explícitamente en la revisión.

### Resultado de la revisión final (opus, commit 3a4e2d8..df7b512)

CLEAN — Approved en el primer pase. El comportamiento más crítico —
`confirmar()` NO cierra el sheet si `replaceSessionExercise`/
`addSessionExercise` devuelve un valor falsy — se verificó
explícitamente contra los 3 paths reales de fallo en `session.js`. El
resto del port es fiel línea por línea: `soloEquipo`, filtro de
sugerencias contra `sessionExs()` (no `S.routine`, para excluir extras
agregados a mano), reuso de `MachineField` sin duplicación, gating del
nuevo botón en `Hoy.js` estrictamente sobre `active` (mutuamente
excluyente con los otros 3 estados de héroe). jest 330/330, expo-doctor
21/21, bundler limpio — verificado de forma independiente.
