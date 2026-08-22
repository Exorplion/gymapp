# Etapa 5j — sheet `FoodVoice` (registrar comida por voz o texto)

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5i
(cerrada — commit `4785e51`).

## Alcance y rulings

**`FoodVoice.jsx` — se porta esta etapa, con el camino de TEXTO
completo y el de VOZ diferido.** Único caller real en el original:
`Nutricion.jsx:207` (botón separado "🎙 Registrar por voz",
`openSheet('food-voice')` — distinto del botón "+ Agregar comida" que
abre `meal-form`, otro sheet todavía no portado). `native/src/screens/
Nutricion.js` (Etapa 4b) NO tiene ese botón todavía — se agrega esta
etapa.

**RULING de alcance — mismo criterio que gestos táctiles en etapas
anteriores (Etapa 3/4a): sin dispositivo para probar, se difiere.** El
dictado por voz del original usa la Web Speech API del navegador
(`window.SpeechRecognition`), que no tiene equivalente directo en RN —
requeriría instalar una librería nativa de reconocimiento de voz (ej.
`@react-native-voice/voice` o `expo-speech-recognition`), pedir permiso
de micrófono, y probar en un dispositivo real que el reconocimiento
funcione — nada de eso es verificable en este entorno (sin
emulador/dispositivo). **Se porta el camino de TEXTO completo** (el
campo "O escribilo" + `parseFoodSpeech()`, ya portado y testeado en
`lib/foodvoice.js` desde Etapa 4b) **y se deja el botón de dictado
deshabilitado** con un texto que indica que el dictado por voz llega en
una etapa futura (cuando se instale y pruebe la librería nativa
correspondiente) — NO se oculta el botón (mantiene la promesa de que la
función existe), tampoco se simula un dictado falso. Es decir: quien
prefiera tipear ("dos huevos, 150 g de pollo…") tiene la funcionalidad
completa desde el día uno; quien quiera dictar espera a una etapa
futura con la librería de voz instalada.

Ruling: **todas las dependencias del camino de texto ya existen** —
`S, closeSheet, bump` (`state.js`), `idb` (`db.js`), `uid, fmtNum,
round1, vibrate` (`format.js`), `parseFoodSpeech, sumItems`
(`lib/foodvoice.js`, ya portado y testeado en Etapa 4b), `toast`
(`toast.js`) — grep confirmado, cero dependencias nuevas de `lib/`.

Ruling: **`known`/`unknown` se recalculan en cada render a partir de
`items`** (no hay estado separado para cada lista) — portar tal cual,
sin necesidad de sincronizar dos estados.

Ruling: **`confirm()` registra cada item conocido con la fecha
`S.nutriDate`** (la fecha que se está mirando en Nutrición, NO
necesariamente "hoy") — a diferencia de `Preworkout.js` (Etapa 5e), que
sí usaba `dstr()` (hoy) explícitamente porque "el pre-workout se toma
ahora". Acá el original usa `S.nutriDate` porque el registro por voz
puede hacerse retroactivamente para el día que se esté viendo. Portar
tal cual, sin cambiar a `dstr()`.

Ruling: **quitar un item de la lista reconocida es local, no toca
`idb`** — `setItems(items.filter(x => x !== i))` sólo actualiza el
estado en memoria antes de confirmar; nada se persiste hasta `confirm()`.
Portar tal cual.

Ruling: jest se mantiene igual — esta etapa no agrega lógica nueva a
`lib/`, todo lo que el camino de texto necesita ya existe y está
testeado desde Etapa 4b.

## Task única

**Files:**
- Create: `native/src/components/sheets/FoodVoice.js`
- Modify: `native/src/components/SheetHost.js` (registrar `'food-voice':
  FoodVoice` en `SHEET_REGISTRY` — SOLO esa línea + su import)
- Modify: `native/src/screens/Nutricion.js` (agregar el botón "🎙
  Registrar por voz" que llama `openSheet('food-voice')`, separado del
  botón existente "+ Agregar comida")

**Interfaces:**
- Consumes: `S, closeSheet, bump` (`state.js`), `idb` (`db.js`), `uid,
  fmtNum, round1, vibrate` (`format.js`), `parseFoodSpeech, sumItems`
  (`lib/foodvoice.js`, ya portado), `toast` (`toast.js`) — todos ya
  portados, ninguno se modifica.

- [x] **Step 1**: Leer `web/src/components/sheets/FoodVoice.jsx`
  completo (147 líneas, prestar atención al comentario de cabecera sobre
  el patrón de VoiceLog.jsx y a que nada se guarda hasta confirmar) y
  `web/src/components/screens/Nutricion.jsx` línea 207 (contexto exacto
  del botón "Registrar por voz", separado de "+ Agregar comida").

- [x] **Step 2**: Portar `FoodVoice` verbatim (camino de texto) a
  `native/src/components/sheets/FoodVoice.js` — estado `text/items`,
  `reparse(t)` llamando `parseFoodSpeech(t, S.foods)`, `known`/`unknown`
  derivados de `items`, lista de reconocidos con botón de quitar
  individual, lista de no-reconocidos con el texto explicativo ("No le
  invento macros..."), total via `sumItems(items)`, `confirm()` idéntico
  (registra cada `known` con `date: S.nutriDate`, vibra, `bump()`,
  cierra, toast con el conteo). Botón de dictado ("🎙 Dictar") presente
  pero deshabilitado, con texto indicando que el dictado por voz llega
  en una etapa futura (ver ruling de alcance).

- [x] **Step 3**: Registrar `'food-voice': FoodVoice` en
  `SheetHost.js`.

- [x] **Step 4**: Agregar el botón "🎙 Registrar por voz" en
  `Nutricion.js`, separado del botón "+ Agregar comida" existente,
  llamando `openSheet('food-voice')`.

- [x] **Step 5: Verificar**

Run: `cd native && npx jest` → 330/330, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 6: Commit**

```bash
cd native && git add src/components/sheets/FoodVoice.js src/components/SheetHost.js src/screens/Nutricion.js && git commit -m "feat(rn): portar sheet FoodVoice (registrar comida por texto; dictado por voz diferido)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5i (330).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que `confirm()` usa `S.nutriDate` (no `dstr()`/hoy) para
  la fecha de cada comida registrada — a diferencia de la ruling de
  Etapa 5e (Preworkout, que sí usa hoy).
- [x] Confirmar que el botón de dictado está genuinamente deshabilitado
  (no ejecuta ninguna acción al tocarlo) y no promete una función que no
  existe sin decirlo.
- [x] Confirmar que quitar un item de "Reconocido" no llama a `idb` (es
  puramente local hasta `confirm()`).

### Resultado de la revisión final (opus, commit 4785e51..db6dc55)

CLEAN — Approved en el primer pase. El punto más crítico —
`confirm()` usa `S.nutriDate`, nunca `dstr()`/hoy, confirmado con grep
que `dstr` no aparece en el archivo — se verificó explícitamente contra
el patrón opuesto de `Preworkout.js` (Etapa 5e). El botón de dictado es
un `View` plano sin `Pressable`/`onPress` ni ningún resto de lógica de
`SpeechRecognition` (`SR_CLASS`/`recRef`/efecto de limpieza de
micrófono todos ausentes) — genuinamente inerte, con texto explicando
por qué. `sumItems(items)` se confirmó equivalente a `sumItems(known)`
porque la propia función ya filtra `!i.unknown` internamente (verificado
leyendo su implementación, no asumido). El botón nuevo en `Nutricion.js`
no toca el `<Defs>`/gradiente del anillo de kcal (la zona más delicada
de ese archivo desde Etapa 4b) ni las secciones de "Un toque"/
"Frecuentes". jest 330/330, expo-doctor 21/21, bundler limpio —
verificado de forma independiente.
