# Etapa 5f — sheet `Profile` (perfil y macros)

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5e
(cerrada — commit `f2c39c1`).

## Alcance y rulings

**`Profile.jsx` — se porta esta etapa.** Callers reales confirmados por
grep en `web/src`: `Nutricion.jsx:87,90` (botón ✎ y la tarjeta de perfil
— Nutricion.js YA está portado, Etapa 4b), `Preworkout.jsx:35` (botón
"Ir al perfil", hasta ahora un no-op silencioso por ruling de Etapa 5e —
esta etapa lo vuelve funcional), `Settings.jsx:146,299` (sheet todavía
no portado, sin efecto en esta etapa). Portar `Profile` esta etapa
resuelve 2 de los 3 callers reales existentes hoy.

Ruling: **DEVIATION ya documentada por el propio original** (líneas
5-14) — el sexo (Hombre/Mujer) y el resto de los campos viven todos en
un solo borrador local de React (`draft`), y sólo se escriben a
`S.cfg.profile` al guardar. Si el usuario cierra el sheet sin guardar,
el perfil real queda intacto. Portar tal cual — no hay nada que "portar
mal" acá, ya es el comportamiento correcto en React.

Ruling: **`<select>` (actividad, objetivo) se porta como chips
seleccionables**, no como un `Picker` nativo. Esta migración ya adoptó
el patrón chip-button para listas enumerables cortas en sheets
anteriores (Rutina.js, EntryEdit.jsx del original usa el mismo patrón
para categoría muscular/equipo). `ACTF`/`GOAL_LABEL` tienen sólo 4 y 5
opciones respectivamente — un tamaño natural para chips, evita instalar
una librería de picker nueva sólo para 2 campos, y da mejor affordance
táctil que un `<select>` nativo minimizado. El label + hint de cada
opción (`ACT_HINT`/`GOAL_HINT`) se muestra como subtítulo del chip.

Ruling: **`<input type="range">` (reparto proteína/grasa) necesita
`@react-native-community/slider`** — no hay slider nativo integrado en
RN core, y no hay ninguna librería de slider ya instalada en el
proyecto (grep confirmado en `package.json`). Se instala vía `npx expo
install @react-native-community/slider` (mismo criterio que
`victory-native`/`@gorhom/bottom-sheet` en etapas anteriores: resolver
versión compatible con el SDK del proyecto, nunca `npm install`
directo). Es una librería liviana, sin dependencias nativas pesadas
adicionales (no trae Skia/Reanimated como los casos anteriores) — bajo
riesgo.

Ruling: **inputs numéricos libres (edad/altura/peso/TDEE) son NO
controlados** (`defaultValue` + `ref`), igual que el original — el
propio comentario (líneas 16-23) explica que el `onChange` sólo
actualiza `draft` (parseFloat crudo, sin redondear) para alimentar el
preview de macros en vivo, nunca reescribe el `value` del input mientras
el usuario tipea. La única escritura directa a un input es el botón
"usar último registrado" sobre el campo de peso (`useLastWeight`) — eso
sí es aceptable porque no es un tecleo, es un tap. En RN esto es
`TextInput` con `defaultValue` (no controlado) + un `ref` con
`.setNativeProps({text: ...})` o simplemente forzar un remount con
`key` para el caso de `useLastWeight` — decidir cuál encaja mejor al
implementar, documentar la elección en el reporte.

Ruling: **`macrosFor(draft)` reusa el truco del original** — canjea
`S.cfg.profile` por el borrador, llama `computeMacros()` (ya portado,
sin modificar), y restaura el original antes de que cualquier otro
código pueda leerlo (todo síncrono, sin `await` de por medio). Portar
tal cual, sin "arreglar" el side-effect temporal — es intencional y
ya documentado como seguro en el original.

Ruling: jest se mantiene igual — esta etapa no agrega lógica nueva a
`lib/` (todo lo que `Profile` necesita — `computeMacros`,
`applyComputedGoals`, `profileWeight`, las 6 constantes de actividad/
objetivo — ya está portado desde Etapa 4b).

## Task única

**Files:**
- Create: `native/src/components/sheets/Profile.js`
- Modify: `native/src/components/SheetHost.js` (registrar `'profile':
  Profile` en `SHEET_REGISTRY` — SOLO esa línea + su import)
- Modify: `native/package.json`, `native/package-lock.json`
  (`@react-native-community/slider`)

**Interfaces:**
- Consumes: `S, closeSheet, saveCfg` (`state.js`), `fmtNum, round1,
  vibrate` (`format.js`), `computeMacros, applyComputedGoals,
  profileWeight, ACTF, ACT_LABEL, ACT_HINT, GOALDELTA, GOAL_LABEL,
  GOAL_HINT` (`macros.js`), `toast` (`toast.js`) — todos ya portados,
  ninguno se modifica.

- [x] **Step 1**: Leer `web/src/components/sheets/Profile.jsx` completo
  (174 líneas, prestar atención especial a los 3 comentarios de cabecera
  — la deviation del sexo y el patrón de inputs no controlados) y
  confirmar en `web/src/components/screens/Nutricion.jsx` líneas 87 y 90
  el contexto exacto de los 2 triggers.

- [x] **Step 2**: Instalar `@react-native-community/slider` (`npx expo
  install`, no `npm install` directo). Confirmar que `expo-doctor` no
  pide configuración adicional.

- [x] **Step 3**: Portar `Profile` verbatim a
  `native/src/components/sheets/Profile.js` — toggle sexo (2 botones),
  edad/altura/peso/TDEE como `TextInput` no controlados con
  `defaultValue`, actividad/objetivo como chips (ver ruling), reparto
  proteína/grasa con `@react-native-community/slider` (0-100, mismo
  mapeo a `proteinPref`/`fatPref` que el original), preview de macros en
  vivo (`MacroPreview`, reusar `macrosFor()` tal cual), botón "usar
  último registrado" sobre peso (sólo si `bw != null`, calculado una vez
  al abrir sobre el perfil REAL, no el borrador — igual que el
  original), `save()` idéntico (valida edad/altura/peso, fuerza
  `S.cfg.goalsAuto = true`, `applyComputedGoals()`, `saveCfg()`, cierra,
  vibra, toast con el resumen de metas).

- [x] **Step 4**: Registrar `'profile': Profile` en `SheetHost.js`.

- [x] **Step 5: Verificar**

Run: `cd native && npx jest` → 330/330, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 6: Commit**

```bash
cd native && git add src/components/sheets/Profile.js src/components/SheetHost.js package.json package-lock.json && git commit -m "feat(rn): portar sheet Profile (perfil y macros)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5e (330).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que los inputs numéricos libres son verdaderamente NO
  controlados (no reescriben su propio `defaultValue`/`value` en cada
  tecla) — misma clase de bug que `BodyForm.js`/`Preworkout.js` ya
  evitaron correctamente en etapas anteriores.
- [x] Confirmar que el botón "Ir al perfil" de `Preworkout.js` (Etapa
  5e) ahora abre este sheet correctamente (deja de ser no-op).
- [x] Confirmar que `macrosFor()` restaura `S.cfg.profile` sin dejar
  ningún estado intermedio visible a otro código (todo síncrono).

### Nota operativa: el subagente implementador falló a mitad de task

El subagente dispatchado para esta task terminó con error de límite de
sesión de la API justo después de escribir `Profile.js` completo, pero
ANTES de registrar el sheet en `SheetHost.js`, instalar/verificar, o
comitear. El controller investigó el estado en disco (`git status`)
antes de decidir: `Profile.js` estaba genuinamente completo y correcto
(componente + estilos, nada a medio escribir), y `package.json`/
`package-lock.json` ya tenían el slider instalado. El controller
completó los pasos faltantes directamente (registro en `SheetHost.js`,
las 3 verificaciones, commit `d0dfd18`) en vez de re-dispatchar un
subagente nuevo desde cero — evitando descartar trabajo válido.

Como este archivo nunca pasó por una revisión de task normal (el
subagente nunca llegó a ese punto), la revisión de cierre de esta etapa
se trató explícitamente como la PRIMERA revisión real del código, no
como un re-chequeo — con el mismo nivel de rigor que cualquier revisión
final de etapa de esta migración. Resultado: CLEAN, sin hallazgos
Critical/Important/Minor — los 4 inputs numéricos libres son
verdaderamente no controlados, `useLastWeight` es la única excepción
correcta (tap, no tecleo), `macrosFor()` es genuinamente síncrono (grep
confirmado: cero `async`/`await`/`Promise` en `macros.js`), `save()` es
fiel línea por línea al original, chips y slider correctamente cableados.

Hallazgo informativo de la revisión (no bloqueante, corregido en un
commit aparte `b6051c6`): la ruling original de esta etapa asumía que
portar `Profile` resolvía 2 de los 3 callers reales en `Nutricion.js`,
pero `Nutricion.js` (Etapa 4b) nunca portó esos botones — los dejó como
`toast('Próximamente')` documentado como recorte deliberado. Con
`Profile` ya portado, dejar ese placeholder habría sido exactamente el
mismo bug que Etapa 3 tuvo con `Library.js` (placeholder que sobrevive a
que su sheet real ya existe). Se conectó la tarjeta de perfil incompleto
a `openSheet('profile')` en el mismo cierre de esta etapa; el botón "+
Agregar comida" (que abre `meal-form`, todavía no portado) queda
correctamente sin tocar.
