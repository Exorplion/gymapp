# Etapa 5g — sheet `EntryEdit` (corregir qué ejercicio fue) + `MachineField`

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5f
(cerrada — commit `2f4cb68`).

## Alcance y rulings

**`EntryEdit.jsx` — se porta esta etapa.** Único caller real (grep
confirmado): `SessionView.jsx:210` (`openSheet('entry-edit', {sessId,
idx})`) — un sheet todavía no portado (queda para una etapa futura). Es
decir, **hasta que `SessionView` se porte, `EntryEdit` no tiene ningún
punto de entrada real en la UI de RN** — se porta igual porque su
dependencia (`MachineField`) también la necesita `ExerciseForm`
(tampoco portado todavía), y porque el registro en `SHEET_REGISTRY` deja
todo listo sin trabajo adicional cuando `SessionView`/`ExerciseForm`
lleguen. Mismo criterio que Etapa 5c con `ExInfo`/`ExerciseCarousel`:
portar el sheet aunque su único caller real llegue después.

**`MachineField.jsx` — se porta esta etapa como dependencia compartida.**
No es un sheet, es un componente de 52 líneas reusado por `EntryEdit` Y
`ExerciseForm` (ninguno de los dos portado hasta ahora). Se porta a
`native/src/components/MachineField.js`, mismo patrón de import que
`BodyMini.js`/otros componentes compartidos ya portados.

Ruling: **todas las dependencias de `EntryEdit` ya existen en
`native/src/lib/`** — `norm` (`format.js`), `updateHistorySession`
(`session.js`), `renameRoutineExercise` (`rutina-logic.js`), `EXCATALOG,
MUSCLE_CATS, catOf` (`muscle.js`), `EQUIP, isMachineBound, POLEA_FEEL`
(`equip.js`) — grep confirmado, cero dependencias nuevas de `lib/`.

Ruling: **el flujo de "¿también corregir la rutina?" usa el sheet
`confirm`** (ya portado, Etapa 5a) — al guardar, si la rutina del turno
todavía tiene el nombre viejo Y el nombre cambió, abre
`openSheet('confirm', {title, body, confirmLabel, onConfirm})` en vez de
cerrar directo. Portar tal cual, sin fallback: `ConfirmSheet.js` ya
existe y está revisado.

Ruling: **`sugeridos` (autocompletado desde `EXCATALOG` mientras se
tipea) se porta como una lista de chips debajo del campo de texto**,
igual que el original — no hace falta ningún componente de autocomplete
nuevo, es sólo un `.filter()` + `.slice(0,6)` ya resuelto en el original,
sólo cambia el markup a RN.

Ruling: **chips de categoría muscular/equipo son controles multi-opción
de selección única con toggle** (tocar de nuevo deselecciona) — mismo
patrón chip-button ya usado en Rutina.js/Profile.js (Etapa 5f) para
listas enumerables. `MUSCLE_CATS` (9) y `EQUIP` (tamaño variable, grep
para confirmar) encajan en el mismo patrón.

Ruling: **`isMachineBound(equip)` condiciona el render de
`MachineField`** — sólo aparece si el equipo elegido es de los que
necesitan detalle de máquina (`discos`, `placas`, `polea`). Portar la
condición tal cual, sin mostrarlo siempre.

Ruling: jest se mantiene igual — esta etapa no agrega lógica nueva a
`lib/`, todo lo que `EntryEdit`/`MachineField` necesitan ya existe.

## Tabla cruzada

| Task A | Task B | A produce | B consume | Hallazgo |
|---|---|---|---|---|
| 1 (MachineField.js) | 2 (EntryEdit.js) | componente `MachineField` | lo importa | consistente — Task 2 después de 1 |

Una sola dependencia directa. Orden: 1, luego 2 (secuencial, nunca
paralelo).

## Task 1: `MachineField.js`

**Files:**
- Create: `native/src/components/MachineField.js`

**Interfaces:**
- Consumes: `POLEA_FEEL` (`lib/equip.js`, ya portado, NO tocar).

- [x] **Step 1**: Leer `web/src/components/MachineField.jsx` completo
  (52 líneas).

- [x] **Step 2**: Portar verbatim — si `equip === 'polea'`, chips de
  `POLEA_FEEL` (toggle single-select) + texto explicativo; si no,
  `TextInput` libre para el nombre de la máquina + texto explicativo.
  Props: `{ equip, machine, onChange }`.

- [x] **Step 3: Verificar**

Run: `cd native && npx jest` → 330/330, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 4: Commit**

```bash
cd native && git add src/components/MachineField.js && git commit -m "feat(rn): portar MachineField (campo compartido de EntryEdit/ExerciseForm)"
```

---

## Task 2: sheet `EntryEdit.js`

**Files:**
- Create: `native/src/components/sheets/EntryEdit.js`
- Modify: `native/src/components/SheetHost.js` (registrar
  `'entry-edit': EntryEdit` en `SHEET_REGISTRY` — SOLO esa línea + su
  import)

**Interfaces:**
- Consumes: `S, closeSheet, openSheet` (`state.js`), `norm`
  (`format.js`), `updateHistorySession` (`session.js`),
  `renameRoutineExercise` (`rutina-logic.js`), `EXCATALOG, MUSCLE_CATS,
  catOf` (`muscle.js`), `EQUIP, isMachineBound` (`equip.js`), `toast`
  (`toast.js`), `MachineField` (Task 1).

- [x] **Step 1**: Leer `web/src/components/sheets/EntryEdit.jsx`
  completo (161 líneas, prestar atención especial al comentario de
  cabecera sobre por qué existe este sheet y a la lógica de
  `enRutina`/`slotId` — sólo se ofrece corregir la rutina para sesiones
  con `slotId`, nunca para sesiones viejas por weekday).

- [x] **Step 2**: Portar `EntryEdit` verbatim a
  `native/src/components/sheets/EntryEdit.js` — busca la sesión/entrada
  por `sessId`/`idx`, si no existe retorna `null` (sin crash), estado
  local (`name, equip, machine, cat, unilateral`) inicializado desde la
  entrada existente, autofocus en el campo de nombre, `sugeridos`
  (autocompletado, `useMemo` sobre `EXCATALOG`), detección automática de
  categoría (`catOf`) mostrada como hint si no se eligió una manual,
  `guardar()` idéntico (clona con `structuredClone`, actualiza la
  entrada, `updateHistorySession()`, detecta si la rutina también tiene
  el nombre viejo y ofrece `openSheet('confirm', ...)` para corregirla
  ahí también — SOLO si `sess.slotId` existe).

- [x] **Step 3**: Registrar `'entry-edit': EntryEdit` en
  `SheetHost.js`.

- [x] **Step 4: Verificar**

Run: `cd native && npx jest` → 330/330, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 5: Commit**

```bash
cd native && git add src/components/sheets/EntryEdit.js src/components/SheetHost.js && git commit -m "feat(rn): portar sheet EntryEdit (corregir qué ejercicio fue)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5f (330).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que `EntryEdit` retorna `null` sin crashear si
  `sessId`/`idx` no resuelven una entrada real (caso borde: sesión
  borrada entre que se abrió el sheet y se re-renderiza).
- [x] Confirmar que el flujo "¿también en tu rutina?" SOLO se ofrece
  cuando `sess.slotId` existe (nunca para sesiones viejas por weekday) —
  el propio comentario del original lo marca como una decisión
  deliberada, no un caso a "arreglar".
- [x] Confirmar que `openSheet('confirm', ...)` desde dentro de
  `EntryEdit` no deja las dos sheets abiertas a la vez (sólo un sheet
  activo por vez, mismo invariante de `SheetHost.js` desde Etapa 5a).

### Resultado de la revisión final (opus, commit 2f4cb68..36fb44a) + fix

La lógica más riesgosa de esta etapa — guard de orden de hooks en
`EntryEdit.js` (única razón por la que el sheet puede devolver `null`
sin romper las Rules of Hooks), el handoff a `openSheet('confirm', ...)`
sin `closeSheet()` doble, y el gating estricto de `sess.slotId` — se
verificó línea por línea y quedó confirmada correcta. Único hallazgo:
Important, no bloqueante hoy — `MachineField.js` usaba una paleta clara
(`#333`/`#ccc`/texto `#000`) casi invisible sobre el fondo oscuro del
sheet (`#0e1626`), incluyendo un `TextInput` sin ningún estilo. Como
`EntryEdit` (su único consumidor) todavía no tiene ningún punto de
entrada real en la UI (su caller, `SessionView.jsx`, no está portado),
el bug no es visible a ningún usuario hoy — pero se corrigió de todos
modos antes de que `ExerciseForm` (el otro consumidor futuro de
`MachineField`) lo herede. Fix (`6d9bb5a`): paleta oscura consistente
con `EntryEdit.js` (labels `#8a93a6`, input con fondo/borde/texto
blanco + `placeholderTextColor`, chips con el mismo esquema
seleccionado/no-seleccionado), sin tocar ninguna lógica. Re-revisión
independiente confirmó el fix (comparación de valores de color exactos
contra `EntryEdit.js`) y cero regresiones. jest 330/330, expo-doctor
21/21, bundler limpio — verificado repetidamente de forma independiente.
