# Etapa 5l — sheet `MealForm` (buscar/agregar comida + alta de alimento nuevo)

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5k
(cerrada — commit `75eb23f`).

## Alcance y rulings

**`MealForm.jsx` — se porta esta etapa, y da un caller real desde el
día uno.** Único caller real: `Nutricion.jsx:202` (botón "+ Agregar
comida", `openSheet('meal-form', {slot: slotForTime(...)})`).
`native/src/screens/Nutricion.js` (Etapa 4b) YA tiene ese botón, pero
todavía muestra `toast('Próximamente')` — documentado explícitamente en
su propio comentario de cabecera como el recorte pendiente de esta
etapa. Se conecta acá.

**RULING CRÍTICA — `logMeal`/`addMealFromFood` NO se duplican.** El
archivo original co-ubica `logMeal(f, slot)` y `addMealFromFood(id)`
junto con el componente `MealForm` (líneas 25-44), pero esta migración
YA los extrajo verbatim a `native/src/lib/meal-logic.js` en Etapa 4b
(confirmado: `logMeal`/`addMealFromFood` ya existen ahí, ya usados por
Nutricion.js para "Un toque"/"Frecuentes"). Esta etapa NO vuelve a
definirlos dentro de `MealForm.js` — el sheet importa ambos desde
`meal-logic.js` si los necesita (de hecho `MealForm` en sí no los
llama directamente, sólo comparten el archivo en el original por
conveniencia de co-ubicación; el propio `guardar()` del sheet arma su
propio registro de comida con estructura distinta — `items[]` para el
carrito multi-alimento — no reusa `logMeal`). Portar SOLO el componente
`MealForm` + `AlimentoNuevo`, sin tocar `meal-logic.js`.

Ruling: **todas las demás dependencias ya existen** — `S, bump,
closeSheet` (`state.js`), `uid, vibrate, round1` (`format.js`), `idb`
(`db.js`), `toast` (`toast.js`), `searchFoods, macrosFor, defaultGrams`
(`lib/foodsearch.js`, ya portado en Etapa 4b), `SLOTS, slotForTime`
(`lib/meals.js`, ya portado) — grep confirmado, cero dependencias
nuevas de `lib/`.

Ruling: **carrito guarda el `food` original, no sólo sus macros ya
escalados** — el propio comentario del original (líneas 9-12) explica
por qué: recalcular los gramos vuelve a llamar `macrosFor()` sobre la
fuente en vez de re-escalar un número ya escalado, que pierde precisión
y se rompe si los gramos pasan por cero. Portar tal cual: cada item del
carrito es `{food, grams, ...macrosFor(food, grams)}`, y `setGramos`
recalcula desde `it.food`, nunca desde `it.kcal` ya escalado.

Ruling: **`AlimentoNuevo` es un sub-componente con sus PROPIOS 4 campos
CONTROLADOS** (`kcal/prot/carbs/fat`, `value=` + `onChange` que sólo
guarda el string) — a diferencia de `MealForm`'s `setGramos` (que sí
parsea en cada cambio porque necesita recalcular macros en vivo), acá
el propio comentario del original (líneas 163-165) es explícito: "los
campos guardan el string tal cual se tipeó y sólo se parsean al
confirmar" — exactamente el patrón ya usado en `SessionExercise.js`
(Etapa 5i): controlado con string crudo, parseo sólo en `crear()`, sin
reformateo intermedio. Portar tal cual.

Ruling: **`setGramos` SÍ parsea en cada cambio** (a diferencia de
`AlimentoNuevo`) porque el carrito necesita mostrar kcal recalculadas en
vivo mientras se ajustan los gramos — pero el campo de gramos en sí
sigue siendo controlado con el valor numérico normal (`value={i.grams}`),
no hay riesgo de "reformateo mientras se tipea" porque lo que se
muestra (`i.grams`) es exactamente lo que la última edición produjo, no
un valor derivado/redondeado distinto. Portar tal cual: `TextInput`
controlado normal con `keyboardType="decimal-pad"`.

Ruling: **`nuevo` es un flag de string, no boolean** — cuando hay
búsqueda sin resultados, el botón "Crear "{q}"" guarda el texto tipeado
en `nuevo` y el componente entero cambia a renderizar `AlimentoNuevo`
en su lugar (no un modal aparte, un `return` condicional temprano). Al
terminar (`onListo`) o cancelar (`onCancel`), vuelve a `null` y se
recupera la vista de búsqueda. Portar tal cual.

Ruling: jest se mantiene igual — esta etapa no agrega lógica nueva a
`lib/`, todo lo que `MealForm`/`AlimentoNuevo` necesitan ya existe.

## Task única

**Files:**
- Create: `native/src/components/sheets/MealForm.js`
- Modify: `native/src/components/SheetHost.js` (registrar `'meal-form':
  MealForm` en `SHEET_REGISTRY` — SOLO esa línea + su import)
- Modify: `native/src/screens/Nutricion.js` (cambiar el botón "+
  Agregar comida" de `toast('Próximamente')` a `openSheet('meal-form',
  {slot: slotForTime(...)})`, igual que el original)

**Interfaces:**
- Consumes: `S, bump, closeSheet` (`state.js`), `uid, vibrate, round1`
  (`format.js`), `idb` (`db.js`), `toast` (`toast.js`), `searchFoods,
  macrosFor, defaultGrams` (`lib/foodsearch.js`), `SLOTS, slotForTime`
  (`lib/meals.js`) — todos ya portados, ninguno se modifica.

- [x] **Step 1**: Leer `web/src/components/sheets/MealForm.jsx`
  completo (214 líneas, TODOS los comentarios de cabecera) y confirmar
  que `logMeal`/`addMealFromFood` ya existen en
  `native/src/lib/meal-logic.js` (Etapa 4b) — NO se vuelven a definir.
  Leer `web/src/components/screens/Nutricion.jsx` línea 202 (contexto
  exacto del botón).

- [x] **Step 2**: Portar `MealForm` (el componente default export, NO
  las 2 funciones de arriba) verbatim a
  `native/src/components/sheets/MealForm.js` — segmented control de
  slot (`SLOTS`), buscador con autofocus, resultados de búsqueda
  (`searchFoods`) con botón "Crear" cuando no hay resultados, carrito
  con recálculo por gramos vía `macrosFor(it.food, g)`, total, botón
  guardar que arma el registro con `items[]` y persiste.

- [x] **Step 3**: Portar `AlimentoNuevo` (sub-componente, mismo
  archivo) verbatim — 4 campos CONTROLADOS con string crudo, parseo
  sólo en `crear()`, guarda en `S.foods` con `base:'portion'`.

- [x] **Step 4**: Registrar `'meal-form': MealForm` en `SheetHost.js`.

- [x] **Step 5**: Cambiar el botón "+ Agregar comida" en `Nutricion.js`
  de `toast('Próximamente')` a `openSheet('meal-form', {slot:
  slotForTime(new Date().toTimeString().slice(0,5))})` — o la forma
  equivalente ya usada en el archivo para calcular "ahora" (revisar si
  `Nutricion.js` ya tiene un helper para esto, para no duplicar).

- [x] **Step 6: Verificar**

Run: `cd native && npx jest` → 330/330, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 7: Commit**

```bash
cd native && git add src/components/sheets/MealForm.js src/components/SheetHost.js src/screens/Nutricion.js && git commit -m "feat(rn): portar sheet MealForm (buscar/agregar comida + alta de alimento nuevo)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5k (330).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que `logMeal`/`addMealFromFood` NO se duplicaron dentro
  de `MealForm.js` (deben seguir viviendo sólo en `meal-logic.js`).
- [x] Confirmar que `setGramos` recalcula desde `it.food` (la fuente),
  nunca re-escala un `kcal` ya calculado — la ruling más importante de
  esta etapa sobre precisión numérica.
- [x] Confirmar que `AlimentoNuevo` usa campos controlados con string
  crudo (sin reformateo intermedio) — mismo patrón ya usado en
  `SessionExercise.js` (Etapa 5i).
- [x] Confirmar que el botón "+ Agregar comida" de `Nutricion.js` ya no
  muestra `toast('Próximamente')`.

### Resultado de la revisión final (opus, commit 75eb23f..40f0997) + fix

CLEAN — Approved, con 2 hallazgos Menores (no bloqueantes): import
muerto de `toast` en `Nutricion.js` (su único uso era el
`toast('Próximamente')` que esta etapa reemplazó) e import muerto de
`ScrollView` en `MealForm.js` (nunca usado — el scroll lo maneja
`SheetHost`). Corregidos directo por el controller (commit `e187dc2`),
sin necesidad de subagente dado lo trivial del cambio; jest 330/330,
expo-doctor 21/21, bundler limpio tras la corrección.

Los dos chequeos críticos de esta etapa (por ser la primera en conectar
un botón real y visible, no un caller diferido) se confirmaron
correctos con evidencia de código: `setGramos` recalcula siempre desde
`it.food` vía `macrosFor(it.food, g)` (confirmado leyendo la
implementación real de `macrosFor` — recomputa desde cero en cada
llamada, no reescala un valor previo, así que no hay riesgo de
`0/0`/`Infinity` al pasar por gramos=0), y `guardar()` se verificó línea
por línea contra el original (redondeo asimétrico correcto:
`Math.round` para kcal, `round1` para macros; `items[]` persiste sólo
los 6 campos esperados, no el objeto `food` completo). `AlimentoNuevo`
confirmado con el mismo patrón ya usado y ya revisado en
`SessionExercise.js` (Etapa 5i): controlado con string crudo, parseo
sólo al confirmar.
