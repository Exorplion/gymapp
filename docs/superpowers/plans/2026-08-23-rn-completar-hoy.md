# Completar Hoy.js — funcionalidad recortada de Etapa 2b

Continúa sobre el cierre de Etapa 6b (commit `a08529a`). No es parte del
mapa de 7 etapas del spec original — es trabajo de "terminar la
funcionalidad" pedido explícitamente por Enzo tras cerrar Etapa 6,
antes de considerar Play Store.

## Contexto

`native/src/screens/Hoy.js` (166 líneas) es un recorte deliberado de
Etapa 2b del original (`web/src/components/screens/Hoy.jsx`, 407
líneas + `ExerciseCarousel.jsx` 367 líneas + `WarmupCard.jsx` 71 líneas
= ~845 líneas de funcionalidad real). Lo que falta:

1. **Carrusel de ejercicios → ya reemplazado por `ExerciseList.js`**
   (lista vertical en vez de swipe horizontal, ruling ya tomada y
   correcta: sin dispositivo no se puede verificar gestos de swipe,
   mismo criterio que el resto de esta migración con gestos táctiles).
   PERO `ExerciseList.js`/`ExerciseCard` le faltan funciones reales que
   NO dependen de gestos: ícono del ejercicio, botón de info (ⓘ),
   esquema RIR, aviso de progresión, nota de "primera vez en este
   equipo" + historial relacionado, nota de "reemplaza a X", toggle de
   unilateral, botón de cambiar ejercicio (Swap), y confirmación antes
   de saltar un ejercicio (hoy `skipExercise` se llama directo, sin
   `confirm`, a diferencia del original).
2. **Tarjeta de calentamiento (`WarmupCard`)** — no existe en RN.
3. **Barra de volumen muscular semanal** — no existe en RN.
4. **Cronómetro en vivo de la sesión (`ElapsedTimer`)** — no existe,
   `ActiveHero` no muestra tiempo transcurrido.
5. **Confirmaciones al completar/descartar sesión** — hoy
   `completeSession()`/`discardSession()` se llaman directo desde
   `ActiveHero`, sin el sheet `confirm` que usa el original (riesgo
   real: un toque accidental en "Descartar" borra la sesión sin
   preguntar).
6. **Sheet `SessStartInfo`** — no existe; "Empezar entrenamiento" llama
   `startSession()` directo, sin la pantalla informativa previa del
   original.
7. **Registro retroactivo por voz (`VoiceLogButton`)** — DIFERIDO a
   propósito, mismo criterio que `FoodVoice`/`ExerciseForm` (Etapas 5j/
   5n): requiere reconocimiento de voz nativo, no instalado, sin
   dispositivo para probar. El sheet de destino (`voice-log`) ya está
   portado y revisado (Etapa 5k) — sólo falta el trigger, igual que
   `EntryEdit`/`VoiceLog` en su momento.

## Rulings

Ruling: **el carrusel deslizable NO se recupera** — se mantiene la
decisión ya tomada de lista vertical. Esta etapa completa las
FUNCIONES del carrusel que no dependen de gestos (todo lo listado en
el punto 1 salvo el swipe en sí), no el mecanismo de scroll.

Ruling: **`sessionMaxW`/`progressionWarn` se agregan a `exdb.js`
ahora** — Etapa 5c los excluyó explícitamente porque nada los
necesitaba todavía; el aviso de progresión de `Hoy.js` es exactamente
el consumidor que faltaba. Se agregan al archivo EXISTENTE (no se
duplica `EXDB`/`exInfo`), siguiendo la propia nota del original sobre
por qué viven en el mismo archivo.

Ruling: **`lib/warmup.js` se porta completo** — lógica pura (qué
bloque muscular corresponde calentar, si ya se calentó ese bloque en
la sesión), sin dependencias de UI. Se porta primero, es prerequisito
de `WarmupCard`.

Ruling: **inputs de peso/reps siguen CONTROLADOS** (patrón ya usado en
`ExerciseList.js`, `useState` + `onChangeText`) — NO se migra al patrón
de refs no-controlados del original web (que existe ahí por una razón
específica del DOM: evitar re-render de toda la lista en cada tecla,
un problema de performance que React Native maneja distinto). Mientras
seas cuidadoso de no re-escribir el input mientras el usuario tipea
(la lección de toda esta migración), el patrón controlado ya
implementado en `ExerciseList.js` es correcto y no hace falta
cambiarlo — confirmado que ya evita el bug (el `onWChange`/`onRChange`
actuales sólo llaman `setW`/`setR` con el texto tal cual, sin
reformatear).

Ruling: **el ícono de ejercicio reusa `ExIcon`/`iconOf`** (Etapa 5m, ya
portados) — no se re-crea nada.

Ruling: **confirmaciones de completar/descartar/saltar usan el sheet
`confirm`** (ya portado, Etapa 5a) — corrige el riesgo real de
descarte accidental mencionado en el punto 5.

Ruling: **`SessStartInfo` se porta como función exportada dentro de
`Hoy.js`**, igual que el original (`export function SessStartInfo`),
registrada en `SheetHost.js` como `'sess-start-info'` — mismo criterio
que el original la trata como contenido de sheet específico de Hoy sin
lógica propia que justifique un archivo aparte.

Ruling: **`VoiceLogButton` se difiere** — el botón NO se porta esta
etapa (ni siquiera deshabilitado, ya que ni el ícono de micrófono está
resuelto) — se documenta en el header de `Hoy.js` como diferido, mismo
patrón que otras funciones de voz ya diferidas.

Ruling: jest sube — `warmup.js` y las 2 funciones nuevas de `exdb.js`
son lógica pura testeable.

## Tabla cruzada

| Task | Produce | Consume | Depende de |
|---|---|---|---|
| 1 (exdb.js: sessionMaxW/progressionWarn) | funciones nuevas | — | ninguna |
| 2 (warmup.js) | `tocaCalentar, bloqueDe, DESCANSO` | `session.js` (ya portado) | ninguna |
| 3 (WarmupCard.js) | componente | Task 2 | Task 2 |
| 4 (ExerciseList.js — enriquecer tarjeta) | — | Task 1, `ExIcon`/`iconOf`, `equip.js` | Task 1 |
| 5 (Hoy.js — volumen muscular, cronómetro, confirmaciones, SessStartInfo, WarmupCard) | — | Tasks 2-4 | Tasks 2, 3, 4 |

Tasks 1 y 2 son independientes entre sí — orden: 1 y 2 (cualquier
orden, secuencial, nunca paralelo), luego 3, luego 4, luego 5.

## Task 1: `exdb.js` — agregar `sessionMaxW`/`progressionWarn`

**Files:** Modify `native/src/lib/exdb.js`, `native/src/lib/exdb.test.js`

- [x] **Step 1**: Leer `web/src/lib/exdb.js` líneas 64-85
  (`sessionMaxW`/`progressionWarn`) y el propio comentario de cabecera
  que explica por qué se agregan al mismo archivo.

- [x] **Step 2**: Agregar ambas funciones verbatim al `exdb.js` de RN
  existente — `sessionMaxW(session, name)` busca el peso máximo de un
  ejercicio en una sesión pasada; `progressionWarn(name, w)` compara
  contra el historial (`S.sessions`, importar `S` de `state.js`) y
  avisa si el peso actual es menor al de la última vez que se subió.
  NO tocar `EXDB`/`exInfo`/`rirScheme`/`isLowerBackLift` ya existentes.

- [x] **Step 3**: Agregar tests para las 2 funciones nuevas.

- [x] **Step 4: Verificar**

Run: `cd native && npx jest` → sube (reportar número).
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 5: Commit**

```bash
cd native && git add src/lib/exdb.js src/lib/exdb.test.js && git commit -m "feat(rn): agregar sessionMaxW/progressionWarn a exdb.js (diferido desde Etapa 5c)"
```

---

## Task 2: `lib/warmup.js`

**Files:** Create `native/src/lib/warmup.js`, `native/src/lib/warmup.test.js`

**Interfaces:** Consumes `S` (`state.js`), lo que `session.js` ya
exponga sobre bloques musculares/ejercicios del día (revisar qué existe
antes de asumir).

- [x] **Step 1**: Leer `web/src/lib/warmup.js` completo (102 líneas).

- [x] **Step 2**: Portar `tocaCalentar(draft, ex)`, `bloqueDe(ex)`,
  `DESCANSO` verbatim.

- [x] **Step 3**: Tests cubriendo los casos reales (bloque ya calentado
  no vuelve a pedir calentamiento, bloque nuevo sí).

- [x] **Step 4: Verificar** (mismo patrón que Task 1).

- [x] **Step 5: Commit**

```bash
cd native && git add src/lib/warmup.js src/lib/warmup.test.js && git commit -m "feat(rn): portar warmup.js (lógica de bloques de calentamiento)"
```

---

## Task 3: `WarmupCard.js`

**Files:** Create `native/src/components/WarmupCard.js`

**Interfaces:** Consumes `tocaCalentar, bloqueDe` (Task 2).

- [x] **Step 1**: Leer `web/src/components/WarmupCard.jsx` completo
  (71 líneas).

- [x] **Step 2**: Portar el componente — props `{ex, onListo, onSaltar}`,
  tarjeta con el bloque muscular a calentar y 2 botones (listo/saltar).

- [x] **Step 3: Verificar** (mismo patrón).

- [x] **Step 4: Commit**

```bash
cd native && git add src/components/WarmupCard.js && git commit -m "feat(rn): portar WarmupCard (tarjeta de calentamiento)"
```

---

## Task 4: enriquecer `ExerciseList.js`

**Files:** Modify `native/src/screens/ExerciseList.js`

**Interfaces:** Consumes `ExIcon` (Etapa 5m), `iconOf` (Etapa 5m),
`exInfo, rirScheme, progressionWarn` (Task 1 + ya existentes),
`equipLabel, relatedHistory` (`equip.js`, ya portado), `reemplazaA,
isUnilateral, toggleUnilateral` (`session.js` — confirmar que existen,
si no agregarlos como parte de esta task leyendo
`web/src/lib/session.js` para su lógica exacta).

- [ ] **Step 1**: Releer `web/src/components/ExerciseCarousel.jsx`
  completo (367 líneas) con foco en `ExerciseSlide` (líneas 152-366) —
  es la fuente de todo lo que falta portar a `ExerciseCard`.

- [ ] **Step 2**: Agregar a cada tarjeta: ícono (`ExIcon`+`iconOf`),
  botón ⓘ que abre `openSheet('ex-info', {name, wd, exId})` si
  `exInfo(ex.name)` existe, esquema RIR mostrado junto al objetivo
  cuando la tarjeta está abierta, aviso de progresión
  (`progressionWarn`) bajo el campo de peso, nota "reemplaza a X" si
  `reemplazaA(ex.id)`, nota de "primera vez en este equipo" +
  historial relacionado (`relatedHistory`) cuando no hay `last`, chip
  de "un lado por vez" (`isUnilateral`/`toggleUnilateral`) en el modo
  abierto, botón "Cambiar" (Swap → `openSheet('ex-swap', {wd, exId})`)
  junto al de Saltar.

- [ ] **Step 3**: Cambiar el botón "Saltar" para que abra
  `openSheet('confirm', {...})` en vez de llamar `skipExercise(ex.id)`
  directo — mismo texto que el original ("¿Saltar {nombre}?").

- [ ] **Step 4**: `ExerciseList`/`ExerciseCard` necesita recibir `wd`
  (índice del día) como prop para los `openSheet` que lo requieren —
  confirmar que `Hoy.js` ya se lo pasa (hoy no lo hace, agregar en Task
  5 si hace falta).

- [ ] **Step 5: Verificar**

Run: `cd native && npx jest` → sin cambios de lib (esta task es UI).
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [ ] **Step 6: Commit**

```bash
cd native && git add src/screens/ExerciseList.js && git commit -m "feat(rn): enriquecer ExerciseList con ícono, info, RIR, progresión, unilateral y confirmación de saltar"
```

---

## Task 5: `Hoy.js` — volumen muscular, cronómetro, confirmaciones, SessStartInfo, WarmupCard

**Files:** Modify `native/src/screens/Hoy.js`, `native/src/components/SheetHost.js`

- [ ] **Step 1**: Releer `web/src/components/screens/Hoy.jsx` completo
  (407 líneas) — ya leído en el análisis, releer con foco en
  `ElapsedTimer`, la tarjeta de volumen muscular, y `SessStartInfo`.

- [ ] **Step 2**: Agregar la tarjeta "Músculos esta semana"
  (`muscleVolume(7)`, ya portado — barra de progreso por grupo,
  ordenada de mayor a menor, con el aviso de ejercicios sin grupo vía
  `uncategorized()`, ya portado).

- [ ] **Step 3**: Agregar `ElapsedTimer` — cronómetro que tickea cada
  segundo mientras la sesión está iniciada (`S.draft.start`), mismo
  patrón de aislar el tick a un solo componente pequeño que el
  original (evita re-renderizar toda la pantalla).

- [ ] **Step 4**: Cambiar `ActiveHero`'s botones de completar/descartar
  para abrir `openSheet('confirm', {...})` en vez de llamar
  `completeSession()`/`discardSession()` directo.

- [ ] **Step 5**: Portar `SessStartInfo` como función exportada en
  `Hoy.js`, registrarla en `SheetHost.js` como `'sess-start-info'`.
  Cambiar el CTA "Empezar entrenamiento" de `PreSessionHero` para que
  abra `openSheet('sess-start-info', {index})` en vez de llamar
  `startSession(index)` directo.

- [ ] **Step 6**: Integrar `WarmupCard` (Task 3) — mostrarlo antes de
  `ExerciseList` cuando `active && exCalentar && tocaCalentar(S.draft,
  exCalentar)`, con `onListo`/`onSaltar` llamando `saveDraft()` +
  `bump()` + (si `onListo`) `startRest(DESCANSO)` (de `rest.js`, ya
  portado en Etapa 6a).

- [ ] **Step 7**: Pasar `wd={index}` a `ExerciseList` (para los
  `openSheet` de Task 4).

- [ ] **Step 8**: Actualizar el comentario de cabecera de `Hoy.js`
  reflejando qué queda diferido (sólo `VoiceLogButton`/dictado por voz)
  en vez de la lista larga de recortes que ya no aplica.

- [ ] **Step 9: Verificar**

Run: `cd native && npx jest` → sin cambios de lib.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [ ] **Step 10: Commit**

```bash
cd native && git add src/screens/Hoy.js src/components/SheetHost.js && git commit -m "feat(rn): completar Hoy.js (volumen muscular, cronómetro, confirmaciones, SessStartInfo, calentamiento)"
```

---

## Revisión final de la etapa

- [ ] `cd native && npx jest` — reportar número final.
- [ ] `cd native && npx expo-doctor` — sin errores.
- [ ] Bundler de Metro compila sin error.
- [ ] `web/` sin ningún archivo modificado.
- [ ] Confirmar que completar/descartar sesión y saltar un ejercicio
  ahora piden confirmación (no se ejecutan directo al tocar el botón).
- [ ] Confirmar que `ElapsedTimer` no re-renderiza toda la pantalla de
  Hoy cada segundo (aislado a su propio componente).
- [ ] Confirmar que `WarmupCard` sólo aparece cuando corresponde
  (`tocaCalentar` true) y que "Listo" arranca el descanso de
  calentamiento (`startRest(DESCANSO)`).
- [ ] Confirmar que el comentario de cabecera de `Hoy.js` ya no lista
  como "recortado" nada que se haya portado en esta etapa.
