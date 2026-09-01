# Etapa 5k — sheet `VoiceLog` (confirmar sesión registrada por voz)

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5j
(cerrada — commit `ab4d809`).

## Alcance y rulings

**`VoiceLog.jsx` — se porta esta etapa, SIN conectar un trigger real.**
Único caller real: `Hoy.jsx:391` (`VoiceLogButton`, un botón interno que
sólo se muestra si `SR_CLASS` — Web Speech API del navegador — existe Y
`!active`). Ese botón dispara dictado real de una sesión completa
(`parseWorkoutSpeech()`, de `lib/voice.js`) y recién con el resultado ya
parseado abre `openSheet('voice-log', {items, duration, raw})`. Ni
`lib/voice.js` (85 líneas, no portado — grep confirmado) ni ningún
mecanismo de reconocimiento de voz nativo existen todavía en RN — mismo
motivo de diferimiento que `FoodVoice` (Etapa 5j): sin librería de voz
instalada ni dispositivo para probarla.

**Diferencia clave con Etapa 5j: acá SÍ vale la pena portar el sheet
igual, aunque sin trigger real todavía**, porque `VoiceLog.jsx` en sí
NO tiene ninguna dependencia de reconocimiento de voz — recibe
`items`/`duration` YA PARSEADOS como props (`openSheet('voice-log',
{items, duration})`) y sólo confirma/edita esos datos antes de
guardarlos como sesión. Es decir: el sheet es 100% independiente de
`lib/voice.js`/Web Speech — sólo su ÚNICO caller actual depende de eso.
Se registra en `SHEET_REGISTRY` para cuando se porte `lib/voice.js` +
una librería de dictado nativa en una etapa futura (ese trabajo queda
FUERA de esta etapa) — mismo criterio que `EntryEdit` en Etapa 5g
(sheet portado, caller real diferido).

**RULING VALIOSA — el propio archivo original ya documenta una lección
de bug exactamente de la clase que esta migración viene evitando desde
`BodyForm.js`/`Preworkout.js`/`Profile.js`.** El comentario "FIX ROUND
1" del original (líneas 10-22) explica que los inputs de series/reps/
peso EMPEZARON controlados, y el handler de cambio reformateaba el
número de vuelta al mismo render en cada tecla — rompiendo exactamente
igual que el patrón de bug que esta migración ya conoce bien: borrar el
campo para tipear de nuevo no avanzaba, y un decimal como "62.5" perdía
el "." al tipear (`parseFloat('62.')` da `62`, y repintar `value={62}`
se come el punto). La solución ya está en el original: inputs NO
controlados (`defaultValue` + refs), el handler sólo actualiza el
estado interno (`items`/`duration`), y SÓLO los steppers +/- (`stepField`/
`stepDuration`) reescriben el valor del input a mano — porque ahí el
usuario no tecleó ese valor, lo pidió con un tap (mismo criterio ya
usado en `BodyForm.js`'s `useLastWeight`/`Profile.js`'s
`useLastWeight`). Portar EXACTAMENTE este patrón: `TextInput` con
`defaultValue`, `onChangeText` que sólo llama `changeField`/
`changeDuration` (actualiza estado, nunca reescribe el input), y
`stepField`/`stepDuration` que sí usan un `ref` con `.setNativeProps({
text })` para reflejar el nuevo valor tras un tap de +/-.

Ruling: **cada item necesita un `_id` estable generado al sembrar el
estado inicial** (`uid()`, una vez) — el comentario del original (líneas
24-29) explica por qué: sin un id estable, borrar un item con
`delItem()` puede hacer que React reutilice el nodo de una fila borrada
para la fila siguiente, dejando un input no controlado mostrando el
valor tecleado de OTRO ejercicio. Portar tal cual: `key={it._id}` en
cada card, `_id` nunca cambia después de sembrado.

Ruling: **`delItem()` cierra el sheet si el usuario borra el último
item** (`if (!next.length) { closeSheet(); toast('Registro descartado');
return; }`) — portar tal cual, no dejar un sheet vacío abierto.

Ruling: **`save()` avanza `S.cfg.seqIndex` igual que
`completeSession()`** (comentario líneas 90-92: un registro por voz
cierra el turno pendiente igual que cualquier otra sesión, para que la
racha y "qué sigue" no se desincronicen) — portar tal cual, sin
reimplementar esta lógica, sólo replicarla inline como hace el original
(no llama a `completeSession()` directamente, hace el mismo cálculo a
mano — respetar esa decisión, no "arreglarla" llamando a la función
compartida sin verificar antes que produce el mismo resultado).

Ruling: **todas las dependencias ya existen** — `S, bump, saveCfg,
wStep, closeSheet` (`state.js`), `dstr, uid, round1, vibrate`
(`format.js`), `idb` (`db.js`), `toast` (`toast.js`), `pendingSlot`
(`session.js`) — grep confirmado, cero dependencias nuevas de `lib/`.

Ruling: jest se mantiene igual — esta etapa no agrega lógica nueva a
`lib/`, todo lo que `VoiceLog` necesita ya existe.

## Task única

**Files:**
- Create: `native/src/components/sheets/VoiceLog.js`
- Modify: `native/src/components/SheetHost.js` (registrar `'voice-log':
  VoiceLog` en `SHEET_REGISTRY` — SOLO esa línea + su import)

**Interfaces:**
- Consumes: `S, bump, saveCfg, wStep, closeSheet` (`state.js`), `dstr,
  uid, round1, vibrate` (`format.js`), `idb` (`db.js`), `toast`
  (`toast.js`), `pendingSlot` (`session.js`) — todos ya portados,
  ninguno se modifica.

- [x] **Step 1**: Leer `web/src/components/sheets/VoiceLog.jsx`
  completo (149 líneas, TODOS los comentarios de cabecera — el FIX
  ROUND 1 es la parte más importante de esta task) y confirmar con grep
  que `lib/voice.js` no está portado (para documentar por qué no hay
  trigger real todavía).

- [x] **Step 2**: Portar `VoiceLog` verbatim a
  `native/src/components/sheets/VoiceLog.js` — props `{items:
  initialItems, duration: initialDuration}`, estado sembrado con `_id`
  estable por item, `TextInput`s NO controlados (`defaultValue` +
  `ref`) para sets/reps/peso/duración, `changeField`/`changeDuration`
  sólo actualizan estado (nunca reescriben el input), `stepField`/
  `stepDuration` sí reescriben el input vía ref tras el tap de +/-,
  `delItem` (cierra el sheet si queda vacío), `save()` idéntico
  (construye la sesión, avanza `seqIndex`, guarda, toast).

- [x] **Step 3**: Registrar `'voice-log': VoiceLog` en `SheetHost.js`.
  NO agregar ningún trigger en `Hoy.js` esta etapa — el `VoiceLogButton`
  real requiere `lib/voice.js` + reconocimiento de voz nativo, fuera de
  alcance (ver ruling).

- [x] **Step 4: Verificar**

Run: `cd native && npx jest` → 330/330, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 5: Commit**

```bash
cd native && git add src/components/sheets/VoiceLog.js src/components/SheetHost.js && git commit -m "feat(rn): portar sheet VoiceLog (confirmar sesión registrada por voz, sin trigger real todavía)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5j (330).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar EXPLÍCITAMENTE que ningún `TextInput` de sets/reps/peso/
  duración reescribe su propio valor mientras el usuario tipea (la
  misma clase de bug que el propio comentario "FIX ROUND 1" del
  original advierte, y que esta migración ya evitó correctamente en
  `BodyForm.js`/`Preworkout.js`/`Profile.js` — verificar que NO se
  reintrodujo acá).
- [x] Confirmar que los steppers (+/-) SÍ reescriben el input via ref
  (comportamiento esperado, distinto del tecleo).
- [x] Confirmar que cada item tiene un `_id` estable y que `key={it._id}`
  se usa en el render (no el índice del array, que rompería tras un
  `delItem()`).

### Resultado de la revisión final (opus, commit ab4d809..b734f04)

CLEAN — Approved en el primer pase. El chequeo más crítico — que se
portó el FIX documentado por el propio original ("FIX ROUND 1"), no el
bug — se confirmó con grep: cero apariciones de `value={` en todo el
archivo, las 4 `TextInput` (series/reps/peso/duración) usan
`defaultValue`, y `changeField`/`changeDuration` sólo llaman a los
setters de estado sin tocar ningún ref. Los steppers sí reescriben el
input vía `setNativeProps` tras un tap, tal como corresponde. `_id`
sembrado una sola vez dentro del inicializador lazy de `useState` (no en
el cuerpo del render), `key={it._id}` en cada card. `save()` verificado
línea por línea contra el original, incluyendo el avance manual de
`seqIndex` (réplica inline de `completeSession()`, no una llamada
directa — tal como pide la ruling). jest 330/330, expo-doctor 21/21,
bundler limpio — verificado de forma independiente. Nota menor no
bloqueante: `stepField` hace el side-effect de `setNativeProps` dentro
del callback de `setItems` (técnicamente impuro para React, pero
idéntico al original y sin efecto observable adverso — no se cambia
para preservar el porteo verbatim).
