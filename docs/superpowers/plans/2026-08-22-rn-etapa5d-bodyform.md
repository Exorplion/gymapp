# Etapa 5d — sheet `BodyForm` (registro corporal)

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5c
(cerrada — commit `0882a5a`).

## Alcance y rulings

**`BodyForm.jsx` — se porta esta etapa.** Único caller real:
`Progreso.jsx:86` (`openSheet('body-form')`, botón "+ Registro"). Todas
sus dependencias ya están portadas: `S`/`closeSheet`/`saveCfg`
(`state.js`), `uid`/`dstr` (`format.js`), `applyComputedGoals`
(`macros.js`), `idb` (`db.js`), `toast` (`toast.js`) — grep confirmado,
cero dependencias nuevas.

Ruling: los 5 campos numéricos (peso/cintura/brazo/pecho/pierna) son
inputs controlados que guardan el string tal cual lo tipeó el usuario —
el propio comentario del original (líneas 1-6) advierte que reescribir
`value=` del propio input en su `onChange` fue la causa raíz de un bug
ya corregido en una task anterior del proyecto original (no de esta
migración). Portar tal cual: `parseFloat`/clamping sólo ocurre una vez,
al guardar, nunca en cada tecla.

Ruling: los campos arrancan VACÍOS, no precargados con el último
registro — el original sólo usa el último valor como `placeholder`
(pista visual), nunca como valor inicial, porque dejar un campo en
blanco al guardar significa "no registro este dato hoy", no "repetí el
valor de la vez pasada". Portar tal cual: en RN esto es
`placeholder={String(last.weight ?? '70.0')}` en vez de `defaultValue`.

Ruling: jest se mantiene igual — esta etapa no agrega lógica nueva a
`lib/` (todo lo que `BodyForm` necesita ya existe), pero SÍ ejercita
`applyComputedGoals`/`idb.put`/`saveCfg` desde una pantalla nueva —
verificar que la integración no rompe nada, no que la lógica en sí
cambie.

## Task única

**Files:**
- Create: `native/src/components/sheets/BodyForm.js`
- Modify: `native/src/components/SheetHost.js` (registrar `'body-form':
  BodyForm` en `SHEET_REGISTRY` — SOLO esa línea + su import)
- Modify: `native/src/screens/Progreso.js` (agregar el botón "+
  Registro" que llama `openSheet('body-form')`)

**Interfaces:**
- Consumes: `S, closeSheet, saveCfg` (`state.js`), `uid, dstr`
  (`format.js`), `applyComputedGoals` (`macros.js`), `idb` (`db.js`),
  `toast` (`toast.js`) — todos ya portados, ninguno se modifica.

- [x] **Step 1**: Leer `web/src/components/sheets/BodyForm.jsx` completo
  (87 líneas) y confirmar en `web/src/components/screens/Progreso.jsx`
  línea 86 el contexto exacto del botón "+ Registro" (qué sección lo
  rodea). Leer también `native/src/screens/Progreso.js` actual para ver
  dónde encaja naturalmente (probablemente cerca de la sección de
  registro corporal/medidas, si existe, o cerca de Constancia).

- [x] **Step 2**: Portar `BodyForm` verbatim a
  `native/src/components/sheets/BodyForm.js` — 5 `TextInput` controlados
  (`keyboardType="decimal-pad"`), autofocus en el campo de peso (RN:
  `useRef` + `.focus()` en un `setTimeout` corto tras montar, igual que
  el original — necesario porque el sheet recién terminó su animación de
  apertura), función `save()` idéntica (incluye el guardado condicional
  de `saveCfg()`/`applyComputedGoals()` sólo si hay peso nuevo, y el
  mensaje de toast distinto según si `S.cfg.goalsAuto` está activo).

- [x] **Step 3**: Registrar `'body-form': BodyForm` en `SheetHost.js`.

- [x] **Step 4**: Agregar el botón "+ Registro" en `Progreso.js` que
  llama `openSheet('body-form')`, en el lugar equivalente al original.

- [x] **Step 5: Verificar**

Run: `cd native && npx jest` → 330/330, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 6: Commit**

```bash
cd native && git add src/components/sheets/BodyForm.js src/components/SheetHost.js src/screens/Progreso.js && git commit -m "feat(rn): portar sheet BodyForm (registro corporal: peso/medidas)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5c (330).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que los inputs son verdaderamente controlados sin
  reescribir su propio `value` en `onChange` (la clase de bug que el
  comentario original advierte).
- [x] Confirmar que los placeholders usan el último registro (`last.*`)
  y NO el `value` inicial de cada campo (campos deben arrancar vacíos).
- [x] Confirmar que `applyComputedGoals()`/`saveCfg()` sólo se llaman
  cuando `rec.weight != null`, igual que el original.

### Resultado de la revisión (opus, commit 0882a5a..125cfcb)

CLEAN — Approved en el primer pase, sin ronda de fix. Los 7 puntos de
verificación pasaron: inputs verdaderamente controlados (`onChangeText`
usa el setter directo, nunca reescribe con `parseFloat` — ese sólo
aparece una vez, dentro de `save()`), placeholders vs. valor inicial
correctos, `save()` byte-a-byte equivalente al original (guard de "al
menos un campo", `S.body.push`+`.sort()` incondicional, guardado de
perfil/metas condicionado a `rec.weight != null`), `SheetHost.js` con
diff de exactamente 2 líneas, botón "+ Registro" en `Progreso.js` sin
romper el botón de guía existente (`marginLeft:auto` movido
correctamente, sin riesgo de solapamiento), autofocus con cleanup
correcto del timeout. jest 330/330, expo-doctor 21/21, bundler limpio.

Nota de UX registrada para el futuro (no bloquea): `Progreso.js` en RN
todavía no muestra ningún dato derivado de `S.body` (sin hero de
peso/medidas ni gráfico) porque esa sección fue recortada en Etapa 4a —
el botón vive en la fila de título como sustituto razonable hasta que
esa sección se porte, momento en el que debería moverse a su lugar
original (`web/src/components/screens/Progreso.jsx:86`, dentro de
`.hero-prog`).
