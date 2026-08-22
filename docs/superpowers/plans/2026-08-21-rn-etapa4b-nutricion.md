# Etapa 4b: Nutrición

Spec: `docs/superpowers/specs/2026-08-18-migracion-react-native-design.md`
— Etapa 4 del spec ("Nutrición + Progreso") se dividió en 4a (Progreso,
completa, PR #3) y 4b (esta, Nutrición), mismo criterio que 2a/2b/2c.

BASE: rama `feat/rn-etapa1-andamiaje`, sobre el head de Etapa 4a
(commit `6e2fdae` en adelante).

## Alcance y recortes deliberados

La pantalla `Nutricion.jsx` original (242 líneas) es un dashboard: tarjeta
de perfil/CTA, navegador de fecha, anillo de kcal, barras de macros +
feedback textual, fila "Un toque" (comidas frecuentes con un tap),
fila "Frecuentes" (`S.foods` guardados), y la lista de comidas del día.
Registrar una comida NUEVA (buscar en la tabla de alimentos, armar un
carrito de varios ítems, o dictar por voz) pasa por dos **sheets**
(`MealForm.jsx`, `FoodVoice.jsx`) — el sistema de sheets no existe en RN
todavía (Etapa 5 del spec lo cubre explícitamente: "formularios de
comida/cuerpo").

**Recorte de alcance (mismo patrón que Etapa 2c: Rutina en modo lectura
antes del editor de Etapa 3):** esta etapa porta el dashboard completo +
registro rápido de comidas ya conocidas ("Un toque"/"Frecuentes", que no
necesitan sheet — llaman directo a `logMeal`/`addMealFromFood`). Registrar
un alimento nuevo por búsqueda o por voz queda para Etapa 5, cuando exista
el sistema de bottom-sheet nativo. Si el usuario no tiene comidas
frecuentes todavía (primera vez), la pantalla no debe romperse ni mostrar
un botón "+" que no lleve a ningún lado — mostrar el dashboard vacío y
nada más, sin inventar un punto de entrada a un formulario que no existe.

**Nota sobre `foodvoice.js` (170 líneas):** a pesar del nombre, este
archivo es lógica pura de parseo de texto (`parseFoodSpeech`, `sumItems`)
— NO usa la Web Speech API del navegador en absoluto. Se portea verbatim,
sin recorte. La captura de voz real (`SpeechRecognition`/
`webkitSpeechRecognition`) vive en `FoodVoice.jsx` (el sheet) y en la
detección de soporte del botón en `Nutricion.jsx` (sólo decide si mostrar
un botón, no la captura en sí) — ambos quedan fuera de esta etapa junto
con el resto de sheets. Cuando llegue Etapa 5, ahí sí habrá que decidir
qué hacer con la Web Speech API en RN (no tiene equivalente directo —
`@react-native-voice/voice` u otra librería nativa sería la opción, con
su propio análisis de dependencias pesadas como victory-native en 4a).

**Ruling: el anillo de kcal NO comparte gradiente con `RestTimer.jsx`.**
El original reusa `#restGrad` (definido una sola vez en `RestTimer.jsx`,
montado siempre en `App.jsx`) porque en el DOM `url(#id)` resuelve a nivel
de documento. `RestTimer.jsx` no está portado a RN todavía (no es parte de
ninguna etapa completada), y aunque lo estuviera, Etapa 4a ya confirmó
(hallazgo Crítico C2 de su revisión final) que `react-native-svg` NO
comparte gradientes entre `<Svg>` distintos — cada uno tiene su propio
scope. El anillo de kcal en RN define su propio `<LinearGradient>` local,
sin depender de que otra pantalla exista primero.

**Ruling: `nutriFeedback`/`macroCls` se ADAPTAN, no se portean verbatim.**
Ambas funciones devuelven strings HTML (`<div class="feedback ok">...`) o
nombres de clase CSS (`'ok'|'warn'|'red'|''`) — no tienen sentido en RN.
Se portea la LÓGICA (los mismos umbrales numéricos, el mismo texto,
decidido con las mismas condiciones) pero cambiando la forma de salida a
datos planos que el componente RN interpreta con `Text`/`View` +
`StyleSheet` (ej. `{ dot: 'ok'|'warn'|'red'|'blue', text: '...' }`, con
las partes en `<b>` separadas de alguna forma simple — decisión del
implementador, documentar cuál). Este el mismo criterio ya usado con
`toast.js`'s pub-sub o el bridge de confirmación de Etapa 3: adaptar la
interfaz de salida a lo que RN puede consumir, sin reescribir la lógica de
negocio.

## Cross-task table

| Task A | Task B | A produce | B consume | Hallazgo |
|---|---|---|---|---|
| 1 (meals.js, macros.js, foodtable.js, foodsearch.js, foodvoice.js) | 3 (pantalla Nutrición) | funciones de datos/lógica | las importa | consistente, sin overlap de archivos |
| 2 (meal-logic.js: logMeal/addMealFromFood) | 3 (pantalla Nutrición) | funciones de registro rápido | las llama desde "Un toque"/"Frecuentes" | consistente — Task 3 corre después de 1 y 2 |

Self-consistency: Tasks 1 y 2 son independientes entre sí (archivos
distintos, sin dependencia de import entre ellos — Task 2 importa
`slotForTime` de `meals.js`, que Task 1 produce, así que Task 2 corre
después de Task 1, no en paralelo). Task 3 depende de ambas. Orden:
1, 2, 3 (secuencial, nunca paralelo, por convención de
subagent-driven-development).

---

### Task 1: Portar `meals.js`, `macros.js`, `foodtable.js`, `foodsearch.js`, `foodvoice.js`

**Files:**
- Create: `native/src/lib/meals.js`, `native/src/lib/macros.js`,
  `native/src/lib/foodtable.js`, `native/src/lib/foodsearch.js`,
  `native/src/lib/foodvoice.js`
- Create: tests para cada uno (mismo patrón que `charts.test.js`/
  `streak.test.js`)

**Interfaces:**
- Consumes: `S` (`state.js`, ya portado), `norm/round1/uid/vibrate`
  (`format.js`, ya portado).
- Produces: consumido por Task 2 (`slotForTime` de `meals.js`) y Task 3
  (todo).

- [ ] **Step 1: Leer los 5 archivos completos** (`web/src/lib/meals.js`
  81L, `macros.js` 49L, `foodtable.js` 108L, `foodsearch.js` 140L,
  `foodvoice.js` 170L — 548 líneas en total).

- [ ] **Step 2: Portar verbatim `macros.js`, `foodtable.js`,
  `foodsearch.js`, `foodvoice.js`** — lógica pura, sin DOM, sin HTML
  strings, deberían portar sin cambios de forma (confirmar leyendo cada
  uno, no asumir — si alguno tiene algo DOM-específico no detectado en
  este plan, documentarlo y adaptar igual que se hizo con `nutriFeedback`
  en `meals.js`, ver Step 3).

- [ ] **Step 3: Portar `meals.js` con la adaptación documentada en el
  plan** — `mealsOf`, `SLOTS`, `slotForTime`, `slotOf`, `mealsBySlot`,
  `frequentMeals` van verbatim. `macroCls` y `nutriFeedback` se adaptan
  de HTML-string/clase-CSS a datos planos (ver ruling arriba) —
  documentar la forma exacta elegida en el reporte de la task, porque
  Task 3 depende de consumir esa forma correctamente.

- [ ] **Step 4: Tests** — cobertura mínima por función: un caso con datos
  reales, un caso de borde (sin datos → no debe explotar). Para
  `nutriFeedback` adaptada, testear los 3+ umbrales (sobrante grande,
  en objetivo, pasado) igual que el original description en comentarios
  lo indica.

- [ ] **Step 5: Verificar**

Run: `cd native && npx jest` → sube respecto a lo que dejó Etapa 4a (247).
Run: `cd native && npx expo-doctor` → 21/21 (esta task no toca deps).

- [ ] **Step 6: Commit**

```bash
cd native && git add src/lib/meals.js src/lib/macros.js src/lib/foodtable.js src/lib/foodsearch.js src/lib/foodvoice.js src/lib/*.test.js && git commit -m "feat(rn): portar meals/macros/foodtable/foodsearch/foodvoice.js"
```

---

### Task 2: `meal-logic.js` — extraer `logMeal`/`addMealFromFood`

**Files:**
- Create: `native/src/lib/meal-logic.js` (lógica pura extraída de
  `web/src/components/sheets/MealForm.jsx`, que es un sheet — no se
  portea el sheet completo, sólo las dos funciones puras que
  `Nutricion.jsx` necesita para "Un toque"/"Frecuentes", mismo patrón que
  `rutina-logic.js` en Etapa 2a)
- Create: `native/src/lib/meal-logic.test.js`

**Interfaces:**
- Consumes: `S, bump` (`state.js`), `uid, vibrate` (`format.js`), `idb`
  (`db.js`), `toast` (`toast.js`), `slotForTime` (`meals.js`, Task 1) —
  todos ya portados.
- Produces: consumido por Task 3 (filas "Un toque"/"Frecuentes").

- [ ] **Step 1: Leer `web/src/components/sheets/MealForm.jsx` líneas
  1-42** (imports + `logMeal`/`addMealFromFood` — NO leer ni portar el
  resto del archivo, es el componente del sheet, fuera de alcance).

- [ ] **Step 2: Portar `logMeal(f, slot)` y `addMealFromFood(id)`
  verbatim** — son funciones async puras, sin JSX. Mismo criterio que la
  extracción del bridge de confirmación en Etapa 3 (Library.js): tomar
  sólo la lógica reusable, dejar el resto del sheet para Etapa 5.

- [ ] **Step 3: Tests** — mockear `idb.put` (ver cómo `session.test.js`/
  `rutina-logic.test.js` ya mockean `idb`, seguir el mismo patrón), un
  caso normal y el caso `addMealFromFood` con id inexistente (no debe
  explotar, el original hace `if (!f) return`).

- [ ] **Step 4: Verificar**

Run: `cd native && npx jest` → sube respecto a Task 1.
Run: `cd native && npx expo-doctor` → 21/21.

- [ ] **Step 5: Commit**

```bash
cd native && git add src/lib/meal-logic.js src/lib/meal-logic.test.js && git commit -m "feat(rn): extraer logMeal/addMealFromFood (meal-logic.js, sin el sheet completo)"
```

---

### Task 3: Pantalla Nutrición

**Files:**
- Create: `native/src/screens/Nutricion.js` (reemplaza el placeholder de
  Etapa 1)

**Interfaces:**
- Consumes: `S, useStore, bump, openSheet` (`state.js` — `openSheet` NO
  se usa para abrir un sheet real todavía, ver recorte abajo);
  `dstr, fmtDFull, fmtNum, round1` (`format.js`); `computeMacros,
  GOAL_LABEL` (`macros.js`, Task 1); `mealsOf, macroCls, nutriFeedback,
  frequentMeals, mealsBySlot, slotForTime` (`meals.js`, Task 1); `idb`
  (`db.js`); `logMeal, addMealFromFood` (`meal-logic.js`, Task 2).
- Produces: cierra la mitad "Nutrición" de la Etapa 4 del spec —
  Etapa 4 (Nutrición + Progreso) queda 100% completa entre esta task y
  Etapa 4a.

- [ ] **Step 1: Leer `web/src/components/screens/Nutricion.jsx` completo
  (242 líneas)**

Confirmar la lista exacta de secciones (tarjeta de perfil/CTA, navegador
de fecha, anillo de kcal, barras de macros + feedback, "Un toque",
"Frecuentes", lista de comidas del día) leyendo el archivo, no asumiendo
sobre este plan.

- [ ] **Step 2: Anillo de kcal — SVG local, sin depender de RestTimer**

Implementar el círculo de progreso con `react-native-svg` (ya instalado,
Etapa 4a) con su propio `<LinearGradient>` local dentro del mismo `<Svg>`
que lo consume (ver ruling arriba — y ver el hallazgo C2 de la revisión
final de Etapa 4a antes de escribir esto: `<Defs>` debe estar DENTRO del
`<Svg>` que lo usa, no en un `<Svg>` separado). `KCAL_CIRC = 326.7` es un
valor fijo del original (2π×52), portarlo tal cual.

- [ ] **Step 3: Navegador de fecha, barras de macros, feedback**

Navegador: botones ←/→ que llaman algo equivalente a `shiftNutriDate`
(portar esa función también, vive en el mismo archivo del original, no en
un lib — está bien copiarla dentro de `Nutricion.js`). Barras de macros:
usar los datos planos que `macroCls`/`nutriFeedback` adaptadas (Task 1)
devuelven.

- [ ] **Step 4: "Un toque" y "Frecuentes" — registro rápido**

Ambas filas llaman a `logMeal`/`addMealFromFood` (Task 2) directo, sin
sheet — igual que el original evita el sheet para estos dos casos. Si
`S.foods`/`frequentMeals()` están vacíos (usuario nuevo), no mostrar la
sección (mismo criterio que el original: `.filter(b.meals.length)` en
`mealsBySlot`, no inventar placeholders vacíos con botones muertos).

- [ ] **Step 5: Lista de comidas del día**

Usar `mealsBySlot`/`mealsOf` (Task 1). Si el original tiene un
`onClick`/tap por comida que abre un sheet de detalle/edición, dejarlo
inerte por ahora (documentar cuál decisión se tomó, mismo criterio que
Etapa 4a Task 4 con `SessionCard`).

**Recorte deliberado:** sin botón para registrar un alimento nuevo (no
existe el sheet `MealForm`/`FoodVoice` todavía). Si el original tiene un
botón tipo "+ Agregar comida" que abre ese sheet, en RN debe quedar
ausente o inerte con un `toast('Próximamente')` — NO llamar
`openSheet(...)` sin que exista nada que lo renderice (ese exacto bug ya
pasó en Etapa 3 con `Library.js` y quedó documentado como una clase de
error a no repetir).

- [ ] **Step 6: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error (borrar `native/dist/` si el gate lo permite; si no, dejarlo, es
ignorado por git).
Run: `cd native && npx jest` → sin cambios respecto a lo que dejó Task 2
(esta task no toca `lib/`).

- [ ] **Step 7: Commit**

```bash
cd native && git add src/screens/Nutricion.js && git commit -m "feat(rn): pantalla Nutrición — anillo de kcal, macros, registro rápido, comidas del día"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — 312/312.
- [x] `cd native && npx expo-doctor` — 21/21.
- [x] Bundler de Metro compila sin error (`expo export --platform
  android`, 2130 módulos).
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmado (grep + trazado manual de JSX): ningún `openSheet(...)`
  quedó sin consumidor — cero llamadas ejecutables en `Nutricion.js`,
  las que existían en el original se reemplazaron por
  `toast('Próximamente')` o se omitieron.
- [x] Confirmado: el anillo de kcal define su `<Defs>` DENTRO del mismo
  `<Svg>` que lo renderiza — es el único `<Svg>` de todo el diff, sin
  posibilidad de repetir el bug C2 de Etapa 4a. La revisión final
  también verificó dos detalles de renderizado de react-native-svg
  invisibles para jest/expo export (`strokeDasharray` numérico,
  `transform` como string) contra el código fuente instalado de la
  librería.
- [x] Confirmado cross-check de campos end-to-end (`logMeal` →
  `mealsOf`/`mealsBySlot`/`frequentMeals` → render en `Nutricion.js`),
  retrazado por la revisión final a través de las 3 tasks juntas, sin
  drift de forma. También se verificó a mano el caso de perfil vacío/
  primer uso (`computeMacros()` devolviendo `null`) — sin crash en
  ningún punto de lectura.
- [x] Revisión final: 0 hallazgos Critical, 0 Important — primera etapa
  de esta migración en llegar limpia en el primer pase, sin ronda de
  fix.
