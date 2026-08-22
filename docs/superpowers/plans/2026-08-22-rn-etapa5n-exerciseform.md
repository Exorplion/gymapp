# Etapa 5n — sheet `ExerciseForm` (alta/edición de ejercicio en la rutina) + `IllusPick`

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5m
(cerrada — commit `1da1a45`).

## Alcance y rulings

**`ExerciseForm.jsx` — se porta esta etapa, con dictado por voz y foto
de máquina DIFERIDOS.** Callers reales confirmados por grep:
`Rutina.jsx:301,309` (`openSheet('ex-form', {wd, ex})`) —
`native/src/screens/Rutina.js` YA está portado, así que esta etapa da
un caller real desde el día uno (mismo patrón que Etapa 5h/5l).

**CORRECCIÓN a una ruling de Etapa 5b (no es un bug, es contexto
nuevo).** Etapa 5b excluyó `IllusPick.jsx` como "código muerto,
completamente inalcanzable" porque no aparece en el switch
`SheetContent` de `App.jsx` ni en ningún `openSheet('illus-pick', ...)`.
Eso seguía siendo correcto en su alcance — pero `IllusPick` en realidad
SÍ se usa, no como sheet independiente sino EMBEBIDO directamente dentro
de `ExerciseForm.jsx` (`{picking && <IllusPick .../>}`), y su propio
comentario de cabecera lo explica: como `S.sheet` tiene una sola ranura,
abrir un sheet nuevo desde `ExerciseForm` reemplazaría el formulario
entero y perdería todo lo tipeado — por eso `IllusPick` es un componente
normal embebido, no un sheet. Etapa 5b no vio esto porque en ese momento
`ExerciseForm` no estaba planeado todavía. Se porta acá como
`native/src/components/IllusPick.js` (NO como sheet, NO se registra en
`SHEET_REGISTRY` — es un componente hijo normal, igual que en el
original).

Ruling: **dictado por voz (SpeechRecognition) se difiere** — mismo
criterio que `FoodVoice`/`VoiceLog` (Etapas 5j/5k): sin librería nativa
instalada ni dispositivo para probar reconocimiento de voz. El botón de
micrófono NO se porta esta etapa (a diferencia de `FoodVoice`, acá ni
siquiera se muestra un botón deshabilitado — el original ya lo oculta
condicionalmente si `!SR_CLASS`, así que omitirlo del todo es fiel al
propio comportamiento condicional del original, no una desviación
nueva).

Ruling: **foto de la máquina (cámara/galería) se difiere** — requiere
`lib/photo.js` (`shrinkImage`, procesamiento de imagen desde
`<input type="file">`, API del navegador) que NO está portado, y una
librería nativa de cámara/imagen (`expo-image-picker` +
`expo-image-manipulator` para el redimensionado) que tampoco está
instalada. Igual que el dictado por voz, sin dispositivo para probar
permisos de cámara. Se difiere la sección completa de foto — el
ejercicio se puede guardar sin foto de máquina (`photo` queda `''`,
exactamente el valor por defecto del original), lo único que falta es
la UI para agregarla. Documentado para una etapa futura de cámara
nativa (probablemente junto con `MealForm`'s falta de escaneo de
código de barras si existiera, u otras features de cámara).

Ruling: **todas las demás dependencias ya existen** — `EQUIP,
EQUIP_HINT, isMachineBound` (`equip.js`), `MachineField` (Etapa 5g),
`MUSCLE_CATS, catOf, EXCATALOG` (`muscle.js`), `illusUrl`
(`illustrations.js`, Etapa 5c), `norm` (`format.js`), `recommendedExercises,
saveExercise` (`rutina-logic.js`), `toast` (`toast.js`) — grep
confirmado, cero dependencias nuevas de `lib/` (más allá de
`IllusPick`, que no es `lib/`, es componente).

Ruling: **autofocus SOLO al crear, nunca al editar** — el propio
comentario (líneas 52-55) explica por qué: al editar entrás a cambiar
series/equipo, no el nombre, y el teclado no debería taparte la
pantalla para un campo que no ibas a tocar. Portar tal cual: `useEffect`
con `if (ex) return;` antes del `setTimeout`.

Ruling: **autocompletado (`acOpen`/`acMatches`) es estado derivado del
input, no un listener global** — el propio comentario de cabecera
(líneas 2-3) ya documenta que el original migró de un listener
delegado global a estado derivado de React; portar ese estado derivado
tal cual (`acOpen` se activa en cada cambio de texto, `acMatches` filtra
`EXCATALOG` por substring normalizado, sliced a 6).

Ruling: **el explorador de catálogo completo (`<details>`) SOLO
aparece al crear** (`{!ex && (...)}`), organiza `EXCATALOG` por
categoría (`CATALOG_CATS`, derivado una vez con `[...new
Set(EXCATALOG.map(e => e.c))]`). En RN, `<details>`/`<summary>` no
existen — portar como un toggle expandible (`Pressable` que alterna un
estado local `explorando`, mostrando/ocultando la lista de categorías).

Ruling: **steppers de series/reps usan `step(setter, d)` genérico** —
clampa a mínimo 1 (`Math.max(1, (parseInt(v)||0) + d)`) — portar tal
cual, mismo patrón chip/stepper ya usado en `Preworkout.js`/
`VoiceLog.js`.

Ruling: **`handleSave()` llama `saveExercise(wd, ex ? ex.id : null,
{...})`** — nota que NO cierra el sheet ni valida nada en el propio
`handleSave` (a diferencia de la mayoría de los otros sheets con
`guardar()`); confirmar en `saveExercise` (ya portado) si la validación/
cierre ocurre ahí adentro, y portar `handleSave` EXACTAMENTE como está
en el original — sin agregar un `closeSheet()` que el original no tiene
si `saveExercise` ya lo maneja internamente (verificar antes de asumir).

Ruling: jest se mantiene igual — esta etapa no agrega lógica nueva a
`lib/`.

## Tabla cruzada

| Task A | Task B | A produce | B consume | Hallazgo |
|---|---|---|---|---|
| 1 (IllusPick.js) | 2 (ExerciseForm.js) | componente `IllusPick` | lo embebe | consistente — Task 2 después de 1 |

## Task 1: `IllusPick.js`

**Files:**
- Create: `native/src/components/IllusPick.js`

**Interfaces:**
- Consumes: `searchIllus, illusUrl` (`lib/illustrations.js`, ya
  portado en Etapa 5c, NO tocar).

- [x] **Step 1**: Leer `web/src/components/sheets/IllusPick.jsx`
  completo (65 líneas, el comentario de cabecera es la razón de ser de
  esta task — por qué NO es un sheet).

- [x] **Step 2**: Portar verbatim a
  `native/src/components/IllusPick.js` (NO en `sheets/`, es un
  componente embebido normal) — props `{exName='', onPick, onClose}`,
  búsqueda arranca con `exName`, `useMemo` sobre `searchIllus(q)`,
  grid de resultados con imagen remota (`Image` de RN,
  `source={{uri: illusUrl(it.id)}}`) + nombre, estado vacío con 2
  mensajes distintos (sin query vs. sin resultados).

- [x] **Step 3: Verificar**

Run: `cd native && npx jest` → sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 4: Commit**

```bash
cd native && git add src/components/IllusPick.js && git commit -m "feat(rn): portar IllusPick (elegir ilustración, embebido en ExerciseForm — corrige alcance de Etapa 5b)"
```

---

## Task 2: sheet `ExerciseForm.js`

**Files:**
- Create: `native/src/components/sheets/ExerciseForm.js`
- Modify: `native/src/components/SheetHost.js` (registrar `'ex-form':
  ExerciseForm` — SOLO esa línea + su import)

**Interfaces:**
- Consumes: `EQUIP, EQUIP_HINT, isMachineBound` (`equip.js`),
  `MachineField` (Etapa 5g), `MUSCLE_CATS, catOf, EXCATALOG`
  (`muscle.js`), `illusUrl` (`illustrations.js`), `norm` (`format.js`),
  `recommendedExercises, saveExercise` (`rutina-logic.js`), `toast`
  (`toast.js`), `IllusPick` (Task 1).

- [x] **Step 1**: Leer `web/src/components/sheets/ExerciseForm.jsx`
  completo (323 líneas, TODOS los comentarios) y confirmar en
  `saveExercise` (`rutina-logic.js`) si valida/cierra el sheet
  internamente.

- [x] **Step 2**: Portar `ExerciseForm` verbatim a
  `native/src/components/sheets/ExerciseForm.js` (SIN dictado por voz,
  SIN sección de foto — ver rulings de diferimiento): nombre con
  autocompletado en vivo, sugeridos para el día (sólo al crear),
  explorador de catálogo completo colapsable (sólo al crear, sin
  `<details>` nativo — toggle propio), steppers de series/reps, chip
  unilateral, chips de grupo muscular (con detección automática
  mostrada como hint), chips de equipo (con hint de texto), campo de
  máquina condicional (`MachineField`), selector de ilustración
  (embebe `IllusPick` cuando `picking` es true), botón guardar.

- [x] **Step 3**: Registrar `'ex-form': ExerciseForm` en
  `SheetHost.js`.

- [x] **Step 4: Verificar**

Run: `cd native && npx jest` → sin cambios respecto a Task 1.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 5: Commit**

```bash
cd native && git add src/components/sheets/ExerciseForm.js src/components/SheetHost.js && git commit -m "feat(rn): portar sheet ExerciseForm (alta/edición de ejercicio; dictado por voz y foto diferidos)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5m (339).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que el autofocus SOLO ocurre al crear (`!ex`), nunca al
  editar.
- [x] Confirmar que `IllusPick` se usa como componente embebido normal,
  NO registrado en `SHEET_REGISTRY` (fiel al propio diseño del
  original: un solo sheet a la vez, `IllusPick` vive dentro del mismo
  formulario).
- [x] Confirmar que `handleSave()` llama `saveExercise` con los
  argumentos exactos del original, sin agregar/quitar un `closeSheet()`
  que no corresponda según lo que `saveExercise` ya hace internamente.
- [x] Confirmar que ninguna referencia a voz/cámara quedó a medio
  portar (ni un botón roto ni un import de algo no instalado).

### Resultado de la revisión final (opus, commits 1da1a45..88842a5) + fix

NEEDS FIX WAVE → 1 Crítico, corregido y re-revisado limpio. Las dos
tasks en sí (`IllusPick.js`, `ExerciseForm.js`) resultaron fieles y
seguras — en particular, `handleSave()` preserva correctamente la foto
existente de un ejercicio (`photo: ex?.photo || ''`, no `''` fijo),
exactamente lo que esta revisión verificó con más cuidado dado el bug
crítico de la etapa anterior.

Pero la premisa central del plan resultó FALSA: `Rutina.js` en
realidad NUNCA llamaba `openSheet('ex-form', ...)` — tenía su PROPIO
formulario placeholder local (con el mismo nombre `ExerciseForm`,
tapando al real) que sólo manejaba nombre/series/reps y guardaba con
`saveExercise(index, editing.id, {name, sets, reps})`, dejando
`equip`/`machine`/`photo`/`illus`/`cat`/`unilateral` como `undefined`.
Como `saveExercise` sobreescribe esos campos incondicionalmente, **cada
edición de un ejercicio ya existente en la app borraba silenciosamente
su equipo, máquina, foto, ilustración, categoría manual y unilateral**
— un bug real, EN VIVO, en la pantalla más central de la app (editor de
rutina), no hipotético. El sheet nuevo de esta etapa, aunque
perfectamente construido, nunca se conectó — 306 líneas de código
muerto sin este fix.

Fix (`1a119d8`): se reemplazaron los 2 call sites del placeholder por
`openSheet('ex-form', {wd:index, ex})`/`{wd:index, ex:null})` (idéntico
al original web), se eliminó el `ExerciseForm` local, su estado
(`formFor`/`editing`), sus estilos huérfanos, y el import ahora-sin-uso
de `saveExercise` en `Rutina.js`. El botón "+ Ejercicio" volvió a ser
incondicional (como el original). Re-revisión trazó el escenario
completo de punta a punta (ejercicio con equipo/categoría ya
configurados → editar → guardar) y confirmó que el único camino de
guardado restante es el sheet real, que preserva todos los campos
correctamente. jest 339/339, expo-doctor 21/21, bundler limpio —
verificado de forma independiente en cada paso de esta cadena.
