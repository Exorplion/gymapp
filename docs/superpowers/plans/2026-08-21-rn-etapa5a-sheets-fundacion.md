# Etapa 5a: Sistema de sheets — fundación + primeros 3 sheets

Spec: `docs/superpowers/specs/2026-08-18-migracion-react-native-design.md`
— Etapa 5 del spec ("Sheets restantes", ~25 componentes de
`web/src/components/sheets/`). Dado el tamaño (21 archivos, 2921 líneas,
sin contar que ninguno tiene todavía dónde montarse en RN), se subdivide
en sub-etapas — mismo criterio que 2a/2b/2c y 4a/4b. Esta es la primera:
construir el sistema de bottom-sheet real (no existe todavía) y validarlo
end-to-end con los 3 sheets más simples antes de comprometerse al patrón
a través de los 18 restantes.

BASE: rama `feat/rn-etapa1-andamiaje`, sobre el head de Etapa 4b
(commit `db23615` en adelante).

## Por qué fundación primero

Hasta ahora esta migración resolvió cada necesidad de "confirmar algo" o
"mostrar un mensaje" con puentes puntuales: `Alert.alert` para
confirmaciones (Etapa 3, `Library.js`'s `useConfirmSheetBridge`) y un host
de toast a medida (Etapa 3, `Toast.js`). Ninguno de los dos es un sistema
de sheets — son parches deliberados para no bloquear Etapas 3/4 en algo
que no era su alcance. Etapa 5 SÍ necesita el sistema real: 21 sheets
restantes, la mayoría con su propio formulario/estado, no caben en
`Alert.alert`.

El original (`web/src/App.jsx`'s `SheetContent`, línea 72) resuelve esto
con: un solo campo `S.sheet = {type, props} | null` (`state.js`, ya
portado), `openSheet(type, props)`/`closeSheet()` (ya portados,
actualmente sin consumidor real en RN salvo el bridge de confirmación), y
un switch `type → componente` montado una sola vez en la raíz de la app.
Se portea la misma arquitectura: un `SheetHost.js` en RN, montado una vez
en `App.js` (mismo lugar que `Toast.js`), con su propio registro
`type → componente`, sobre `@gorhom/bottom-sheet` (la librería que el spec
ya nombra explícitamente para esto — ver "Qué NO se lleva tal cual" en el
spec). Sus dependencias nativas (`reanimated`, `gesture-handler`) YA están
instaladas desde Etapa 4a — sin costo nuevo de dependencias pesadas para
la fundación en sí.

**Ruling: la fundación retira el bridge de `Alert.alert` de Etapa 3.**
Una vez que existe un sheet type `'confirm'` real (puerto de
`ConfirmSheet`, `web/src/App.jsx` líneas ~40-65), el bridge puntual de
`Library.js` queda obsoleto — mismo criterio de "no mantener un parche
después de que la solución real existe" que ya se aplicó implícitamente
en otras etapas. Portar `ConfirmSheet` y rewirear `Library.js` para usar
`openSheet('confirm', {...})` de verdad es parte de esta etapa (Task 3).

## Selección de los primeros 3 sheets (de 21)

Se leyeron los 21 archivos originales para elegir los de menor riesgo:

| Sheet | Líneas | Por qué primero |
|---|---|---|
| `Guide.jsx` | 21 | Contenido estático, sin estado, sin lógica — el caso más simple posible para validar que el host renderiza/cierra bien. |
| `StreakDetail.jsx` | 30 | Sólo lectura, reusa `streak.js` (ya portado, Etapa 2a) sin cambios — valida que un sheet con datos reales funciona. |
| `ReorderHoy.jsx` | 31 | El único de los 3 con una interacción real (reordenar ejercicios de Hoy) — valida el patrón con estado mutable. |

**`SlotEdit.jsx` (34 líneas) fue investigado y DESCARTADO de esta etapa.**
Es exclusivamente un campo de renombrar turno (`saveSlot(index, {name})`)
— el comentario del propio original dice que el drag-to-reorder de turnos
ya se sacó de este sheet en una etapa anterior de la PWA. En RN, Etapa 3
YA construyó exactamente esto: `SlotNameInput` dentro de `RutinaEdit`
(`native/src/screens/Rutina.js`, controlled `TextInput` + `onBlur` →
`saveSlot`). Portar `SlotEdit.jsx` sería reimplementar una función que ya
existe con una UI redundante. Se marca como sheet ya cubierto — no forma
parte del recuento de 21 restantes.

**Ruling: `ReorderHoy` sin drag-and-drop táctil real.** El original usa
`drag.js` (el sistema de arrastre a mano que el spec explícitamente NO se
lleva). Mismo criterio que el editor de rutina de Etapa 3: sin
dispositivo/emulador para verificar gestos, se reemplaza por reordenar con
botones ↑/↓. `commitSort()`/`orderedExs()` (ya portados en `session.js`)
proveen la lógica; sólo cambia cómo el usuario dispara el reorden.

Call sites confirmados en el original (dónde se abre cada sheet, para
saber qué pantalla RN ya portada necesita el nuevo botón/tap):
- `guide` → `Progreso.jsx:68`, botón de ícono "Guía" — en RN,
  `native/src/screens/Progreso.js` (Etapa 4a) no tiene todavía este botón,
  agregarlo.
- `streak-detail` → `App.jsx:319`, `onOpenStreak` sobre el heatmap de
  racha — en RN, `Progreso.js` (Etapa 4a) ya renderiza el heatmap inline
  sin sheet de detalle; agregar el tap que abre el sheet.
- `reorder-hoy` → `Hoy.jsx:151`, botón "Reordenar" — en RN,
  `native/src/screens/Hoy.js` (Etapa 2b) puede o no tener ya un botón
  equivalente; confirmar leyendo el archivo actual, no asumir.

## Cross-task table

| Task A | Task B | A produce | B consume | Hallazgo |
|---|---|---|---|---|
| 1 (SheetHost.js + @gorhom/bottom-sheet) | 2 (Guide/StreakDetail/ReorderHoy) | el host + registro de tipos | los 3 sheets se registran ahí | consistente — Task 2 corre después de Task 1 |
| 1 | 3 (ConfirmSheet + retiro del bridge de Etapa 3) | el host | ConfirmSheet se registra ahí | consistente — Task 3 corre después de Task 1 |

Self-consistency: Tasks 2 y 3 son independientes entre sí (archivos
distintos: 3 sheets nuevos vs. `ConfirmSheet` + `Library.js`), pero AMBAS
dependen de Task 1. Orden: 1, luego 2 y 3 en cualquier orden entre sí
(pero secuencial igual, nunca paralelo, por convención del proyecto) —
2 antes de 3 en este plan, sin motivo estructural, sólo orden de
ejecución.

---

### Task 1: `SheetHost.js` — fundación del sistema de sheets

**Files:**
- Create: `native/src/components/SheetHost.js`
- Modify: `native/App.js` (montar `<SheetHost/>` una vez, mismo patrón
  que `<Toast/>` de Etapa 3)
- Modify: `native/package.json`, `native/package-lock.json`
  (`@gorhom/bottom-sheet`)

**Interfaces:**
- Consumes: `S, useStore, closeSheet` (`state.js`, ya portado —
  `openSheet`/`closeSheet` existen pero sin consumidor real hasta ahora).
- Produces: consumido por Task 2 (3 sheets) y Task 3 (`ConfirmSheet`), y
  por TODA la Etapa 5 en adelante (fundación de largo plazo, no sólo de
  esta sub-etapa).

- [x] **Step 1: Leer `web/src/components/Sheet.jsx` completo (85
  líneas) y `web/src/App.jsx`'s `SheetContent` (líneas 68-93)**

Entender el contrato: un solo sheet abierto a la vez (`S.sheet =
{type,props}|null`), cierre por tap en el backdrop O por `closeSheet()`
desde dentro del contenido, y el registro `type → componente` vive en un
solo lugar (no en cada pantalla).

- [x] **Step 2: Instalar `@gorhom/bottom-sheet`**

`npx expo install @gorhom/bottom-sheet` (no `npm install` directo — mismo
criterio que Etapa 4a con `victory-native`, para resolver versión
compatible con el SDK del proyecto). Confirmar que NO hace falta ningún
plugin de config nuevo en `app.json` (sus peer deps —
`react-native-reanimated`, `react-native-gesture-handler`,
`react-native-screens`, `safe-area-context` — ya están instaladas desde
Etapa 4a; `GestureHandlerRootView` ya envuelve la app desde el fix final
de esa etapa). Si `expo-doctor` pide algo nuevo, resolverlo en esta misma
task, no diferirlo.

- [x] **Step 3: Construir `SheetHost.js`**

Estructura: un `BottomSheetModal` (o `BottomSheet` — decidir cuál encaja
mejor con "un solo sheet a la vez, controlado por `S.sheet`", documentar
la elección) montado siempre, que:
- Se abre cuando `S.sheet` pasa de `null` a un valor, se cierra cuando
  vuelve a `null` (snap a index -1 o equivalente de la librería).
- El backdrop (tap fuera) llama `closeSheet()` — igual que el original.
- Renderiza el contenido vía un registro `type → componente`, EMPEZANDO
  VACÍO en esta task (ningún `case` todavía — Tasks 2/3 lo llenan). Con
  `S.sheet` en un tipo no registrado, no debe romper: mostrar nada o un
  fallback, nunca un crash.
- Pasa `sheet.props` como props al componente registrado.

**Nota de diseño, no asumir la API de `@gorhom/bottom-sheet` sin
confirmarla** — mismo criterio que Etapa 4a tuvo que aplicar con
`victory-native`: leer los tipos/documentación instalada
(`node_modules/@gorhom/bottom-sheet`) antes de escribir el código, no
adivinar los nombres de props.

- [x] **Step 4: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.
Run: `cd native && npx jest` → sin cambios (esta task no toca `lib/`).

Estado manual a confirmar en el reporte (no hay device, pero sí se puede
razonar sobre el código): que `S.sheet = {type:'algo-no-registrado'}` no
crashea el registro (Tasks futuras van a abrir tipos que Task 1 no conoce
todavía — el host debe tolerarlo).

- [x] **Step 5: Commit**

```bash
cd native && git add src/components/SheetHost.js App.js package.json package-lock.json && git commit -m "feat(rn): fundación del sistema de sheets (SheetHost + @gorhom/bottom-sheet)"
```

---

### Task 2: Portar `Guide`, `StreakDetail`, `ReorderHoy`

**Files:**
- Create: `native/src/components/sheets/Guide.js`,
  `native/src/components/sheets/StreakDetail.js`,
  `native/src/components/sheets/ReorderHoy.js`
- Modify: `native/src/components/SheetHost.js` (registrar los 3 tipos:
  `'guide'`, `'streak-detail'`, `'reorder-hoy'`)
- Modify: `native/src/screens/Progreso.js` (agregar botón de Guía +
  hacer tap-able el heatmap de racha → `openSheet('streak-detail')`)
- Modify: `native/src/screens/Hoy.js` (agregar/conectar botón
  "Reordenar" → `openSheet('reorder-hoy')`, confirmar primero si ya
  existe algo parecido, leyendo el archivo actual)

**Interfaces:**
- Consumes: `SheetHost.js` (Task 1); `streakHeatmap, currentStreak,
  bestStreak` (`streak.js`, ya portado); `orderedExs` (`session.js`, ya
  portado); `S, openSheet, closeSheet` (`state.js`).
- Produces: cierra 3 de los 21 sheets restantes de Etapa 5.

- [x] **Step 1: Leer los 3 originales completos** (`Guide.jsx` 21L,
  `StreakDetail.jsx` 30L, `ReorderHoy.jsx` 31L).

- [x] **Step 2: Portar `Guide` verbatim** — contenido estático, sin
  estado. Adaptar sólo el markup (`h2`/`h3`/`div` → `Text`/`View` +
  `StyleSheet`), texto idéntico.

- [x] **Step 3: Portar `StreakDetail` verbatim** — mismo dato que ya usa
  `Progreso.js` (Etapa 4a) para su heatmap inline, así que la lógica no
  es nueva; el sheet es una vista de detalle sobre lo mismo. Reusar
  `streakHeatmap`/`currentStreak`/`bestStreak` (`streak.js`) sin
  reimplementar.

- [x] **Step 4: Portar `ReorderHoy` con reorden por botones (ver ruling
  arriba)** — SIN `data-sort`/drag.js. Usar `orderedExs` (`session.js`)
  para la lista y algo equivalente a `commitSort` (leer `session.js`
  para confirmar el nombre/firma real de la función de guardado del
  nuevo orden, no asumir) disparado por botones ↑/↓ por fila, mismo
  patrón que Etapa 3 usó para reordenar turnos/ejercicios en el editor de
  rutina.

- [x] **Step 5: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.
Run: `cd native && npx jest` → sin cambios (esta task no toca `lib/`).

- [x] **Step 6: Commit**

```bash
cd native && git add src/components/sheets/Guide.js src/components/sheets/StreakDetail.js src/components/sheets/ReorderHoy.js src/components/SheetHost.js src/screens/Progreso.js src/screens/Hoy.js && git commit -m "feat(rn): portar Guide/StreakDetail/ReorderHoy (primeros sheets reales)"
```

---

### Task 3: `ConfirmSheet` real + retirar el bridge de `Alert.alert` de Etapa 3

**Files:**
- Create: `native/src/components/sheets/ConfirmSheet.js`
- Modify: `native/src/components/SheetHost.js` (registrar `'confirm'`)
- Modify: `native/src/screens/Library.js` (quitar
  `useConfirmSheetBridge`, dejar que `openSheet('confirm', {...})` — ya
  llamado por `rutina-logic.js`, sin cambios ahí — resuelva a través del
  `SheetHost` real)

**Interfaces:**
- Consumes: `SheetHost.js` (Task 1); `closeSheet` (`state.js`).
- Produces: reemplaza el bridge puntual de Etapa 3 por el sistema real;
  deja el camino libre para que CUALQUIER llamada futura a
  `openSheet('confirm', {...})` en el resto de `lib/` (hay varias, todas
  ya portadas) funcione sin necesitar su propio bridge.

- [x] **Step 1: Leer `web/src/App.jsx`'s `ConfirmSheet` completo**
  (busca el componente inline, no es un archivo separado — confirmar
  su rango de líneas exacto leyendo el archivo).

- [x] **Step 2: Portar `ConfirmSheet` verbatim** a un archivo propio
  (`native/src/components/sheets/ConfirmSheet.js`) — recibe `title`,
  `body`, `confirmLabel`, `onConfirm`/`onCancel` (o los nombres reales del
  original, confirmar leyendo el código) como props desde
  `sheet.props`.

- [x] **Step 3: Retirar `useConfirmSheetBridge` de `Library.js`**

Leer primero cómo está implementado hoy (Etapa 3, commit `2350607`) antes
de tocarlo. Quitar el hook y su `Alert.alert`; confirmar que las 5 rutas
que lo usaban (`applyLibRoutine`/`deleteLibRoutine`/`saveCurrentAsLib`/
`startBlank`/`applyTemplate`, según el hallazgo original de Etapa 3) siguen
funcionando ahora a través del `SheetHost` real, sin dejar ninguna sin
cubrir — este es exactamente el tipo de regresión silenciosa que ya pasó
una vez en esta migración (el bug Crítico de Etapa 3), no repetirlo al
revés.

- [x] **Step 4: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.
Run: `cd native && npx jest` → sin cambios.
Grep: confirmar que `Library.js` ya no importa `Alert` de
`react-native` (si el retiro fue completo, ese import ya no hace falta).

- [x] **Step 5: Commit**

```bash
cd native && git add src/components/sheets/ConfirmSheet.js src/components/SheetHost.js src/screens/Library.js && git commit -m "feat(rn): ConfirmSheet real, retirar bridge de Alert.alert de Etapa 3"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 4b (312).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que `SheetHost` tolera un `S.sheet.type` no registrado
  sin crash (van a existir tipos no registrados hasta que el resto de
  Etapa 5 los porte).
- [x] Confirmar que las 5 rutas que usaban el bridge de `Alert.alert` de
  Etapa 3 siguen funcionando a través de `ConfirmSheet` — no repetir el
  bug Crítico original (confirmaciones que no llevan a ningún lado).
- [x] Confirmar que `reorder-hoy` no tiene código de arrastre/gesto
  remanente (mismo grep que Etapa 3/4a: `PanResponder`, `onTouchMove`,
  imports de gesture-handler específicos de drag).

### Fix de revisión final (commit 89b0b06..0287c93)

La revisión final (opus) encontró 2 Críticos + 1 Importante en
`SheetHost.js`, ninguno detectable por jest/expo-doctor/bundler (bugs de
capa de render, sin device/emulador en este entorno — `@gorhom/bottom-sheet`
no tiene mock de jest):
- **C1**: `snapPoints={['CONTENT_HEIGHT']}` no es API válida de
  `@gorhom/bottom-sheet` v5 — crash en cada boot de la app (`SheetHost` se
  monta incondicionalmente). Fix: se elimina la prop; `enableDynamicSizing`
  + `index={0}` solos ya producen el snap point de altura dinámica
  correcto.
- **C2**: `openSheet('library')` (5 sitios reales en `rutina-logic.js`/
  `templates.js`, expuestos al retirar el bridge de `Alert.alert` de la
  Task 3) abría un sheet vacío fantasma porque `index` sólo miraba
  presencia de `S.sheet`, no si el tipo estaba registrado. Fix:
  `index = sheet && SHEET_REGISTRY[sheet.type] ? 0 : -1`.
- **I1**: contenido de sheets usaba `BottomSheetView` en vez de
  `BottomSheetScrollView`, sin tope de altura equivalente al `88dvh` del
  original. Fix: `BottomSheetScrollView` + `maxDynamicContentSize`
  proporcional a la pantalla.

Un subagente de fix inicial falló por límite de sesión de la API antes de
tocar ningún archivo (confirmado con `git log`/`git status` — nada que
recuperar). El controller aplicó los 3 fixes directamente dado el alcance
pequeño y bien especificado. Re-revisión independiente confirmó las 3
correcciones (evidencia: fuente instalada de `@gorhom/bottom-sheet`,
recorrido de los 5 call-sites de `library`, los 4 sheets registrados sin
cambios) y cero regresiones nuevas. jest 312/312, expo-doctor 21/21,
bundler limpio (2242 módulos) — verificado dos veces, por el controller y
por el re-revisor, de forma independiente.
