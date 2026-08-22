# Etapa 5e — sheet `Preworkout` (dosis de fluidos/carbos/cafeína)

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5d
(cerrada — commit `8f4e7d8`).

## Alcance y rulings

**`Preworkout.jsx` — se porta esta etapa.** Único caller real:
`Hoy.jsx:126` (`openSheet('preworkout')`, botón "Pre-workout" visible
sólo cuando `!active && exs.length > 0` — antes de arrancar la sesión,
si el día tiene ejercicios). Todas las dependencias necesarias ya están
portadas: `S, bump, closeSheet, openSheet` (`state.js`), `fmtNum, round1,
dstr, uid, vibrate` (`format.js`), `profileWeight` (`macros.js`), `idb`
(`db.js`), `toast` (`toast.js`) — grep confirmado, cero dependencias
nuevas de `lib/`.

Ruling: **`PW` es un objeto mutable a nivel de módulo, no vive en `S`.**
El propio comentario del original (líneas 5-10) explica que es
intencional: sobrevive entre aperturas del sheet dentro de la misma
carga de la app (no se persiste a IndexedDB), igual que otros globales
mutables ya portados en esta migración (`T` de rest.js). Los checkboxes
lo mutan directo y llaman `bump()` — el mismo canal de re-render que usa
`S` — para repintar. Portar tal cual: NO mover `PW` dentro de `S`.

Ruling: **el botón "Ir al perfil" abre `openSheet('profile')`, un sheet
que todavía NO está portado** (`Profile.jsx`, 174 líneas, queda para una
etapa futura de Etapa 5). El propio comentario del original (líneas
12-16) documenta que el proyecto original pasó por esta misma situación
— antes de que existiera `Profile.jsx`, ese botón cerraba el sheet con
un toast explicativo en su lugar. Acá NO se replica ese fallback viejo:
se porta el botón llamando `openSheet('profile')` directo, confiando en
el comportamiento ya construido y revisado de `SheetHost.js` (Etapa 5a,
hallazgo C2): un tipo no registrado simplemente no abre nada (index se
queda en -1), sin crash ni sheet fantasma. Es decir, hasta que se porte
`Profile.jsx`, el botón "Ir al perfil" es un no-op silencioso — aceptable
como comportamiento transitorio (no había peso: el sheet ya mostró
"Necesito tu peso para calcular las dosis", así que el usuario sabe qué
falta, aunque el botón en sí no lleve todavía a ningún lado). Se
documenta acá para cuando `Profile.jsx` se porte, sin trabajo adicional
en `Preworkout.js` en ese momento (nada que cambiar, `openSheet('profile')`
ya está bien llamado).

Ruling: `addMacros()` registra la comida en la fecha de HOY (`dstr()`,
fecha actual), no en la fecha que se esté mirando en Nutrición — el
propio comentario del original (líneas 52-53) es explícito: "el
pre-workout se toma ahora". Portar tal cual.

Ruling: jest se mantiene igual — esta etapa no agrega lógica nueva a
`lib/`, todo lo que `Preworkout` necesita ya existe.

## Task única

**Files:**
- Create: `native/src/components/sheets/Preworkout.js`
- Modify: `native/src/components/SheetHost.js` (registrar
  `'preworkout': Preworkout` en `SHEET_REGISTRY` — SOLO esa línea + su
  import)
- Modify: `native/src/screens/Hoy.js` (agregar el botón "Pre-workout"
  con la misma condición `!active && exs.length > 0`)

**Interfaces:**
- Consumes: `S, bump, closeSheet, openSheet` (`state.js`), `fmtNum,
  round1, dstr, uid, vibrate` (`format.js`), `profileWeight`
  (`macros.js`), `idb` (`db.js`), `toast` (`toast.js`) — todos ya
  portados, ninguno se modifica.

- [x] **Step 1**: Leer `web/src/components/sheets/Preworkout.jsx`
  completo (109 líneas) y `web/src/components/screens/Hoy.jsx` líneas
  123-131 (contexto exacto del botón). Leer `native/src/screens/Hoy.js`
  actual para confirmar que `active`/`exs` ya existen como variables
  locales (confirmado: sí, líneas 16 y 21) y localizar dónde insertar el
  botón (mismo lugar relativo, después de la sección "sin grupo" /
  gráfico semanal, antes del botón de registro por voz si existe).

- [x] **Step 2**: Portar `Preworkout` verbatim a
  `native/src/components/sheets/Preworkout.js` — mismo cálculo de
  dosis (fluidos/carbos/cafeína), mismo objeto mutable `PW` a nivel de
  módulo (NO dentro de `S`, ver ruling), mismos 2 checkboxes
  (`RN: Switch` o un `Pressable` a medida — decidir cuál encaja mejor
  con el estilo `check` ya usado en otros sheets de este proyecto, si
  existe alguno con checkbox; si no hay precedente, usar `Switch` de RN
  por simplicidad), mismo estado sin peso (mensaje + botón "Ir al
  perfil" llamando `openSheet('profile')` sin fallback, ver ruling),
  mismo `addMacros()` (agrega a `S.meals`, vibra, cierra el sheet,
  toast).

- [x] **Step 3**: Registrar `'preworkout': Preworkout` en
  `SheetHost.js`.

- [x] **Step 4**: Agregar el botón "Pre-workout" en `Hoy.js`, con la
  condición `!active && exs.length > 0`, llamando
  `openSheet('preworkout')`.

- [x] **Step 5: Verificar**

Run: `cd native && npx jest` → 330/330, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 6: Commit**

```bash
cd native && git add src/components/sheets/Preworkout.js src/components/SheetHost.js src/screens/Hoy.js && git commit -m "feat(rn): portar sheet Preworkout (dosis de fluidos/carbos/cafeína)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5d (330).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que `PW` es verdaderamente un objeto a nivel de módulo
  (no dentro de `S`, no recreado en cada render del componente) y que
  los checkboxes efectivamente llaman `bump()` para repintar tras
  mutarlo.
- [x] Confirmar que `openSheet('profile')` no crashea (tipo no
  registrado todavía) — mismo criterio que la ruling de Etapa 5b sobre
  `openSheet('library')`.
- [x] Confirmar que el botón "Pre-workout" en `Hoy.js` respeta
  exactamente la condición `!active && exs.length > 0` del original (no
  aparece durante una sesión activa).

### Resultado de la revisión (opus, commit 8f4e7d8..c9f48ce)

CLEAN — Approved en el primer pase, sin ronda de fix. El foco principal
de la revisión fue el patrón más inusual de esta task — `PW` mutable a
nivel de módulo + `bump()` — y se trazó la cadena de re-render completa
(no se asumió): `bump()` incrementa `version` en `state.js`,
`useStore()` se suscribe vía `useSyncExternalStore`, `SheetHost` llama
`useStore()` y por lo tanto se re-renderiza, recreando el elemento
`<Preworkout/>` con props frescas — como `Preworkout` no está envuelto
en `React.memo`, se re-ejecuta completo y relee `PW.meal`/`PW.sensitive`
sin closures obsoletos. Confirmado además: `openSheet('profile')` sin
stub agregado (`SHEET_REGISTRY` sigue con exactamente 8 entradas),
`addMacros()` byte-a-byte fiel al original, lógica de cafeína (rango
sensible/no-sensible, warning de over-cap) preservada, condición del
botón en `Hoy.js` idéntica al original. jest 330/330, expo-doctor 21/21,
bundler limpio.

Nota de UX registrada para el futuro (no bloquea): el botón "Pre-workout"
reusa el mismo estilo visual que el botón "↕ Reordenar" (ambos pills
pequeños apilados), mientras que el original le da un affordance más
rico (ícono + título + subtítulo + chevron) — consistente con otras
simplificaciones ya aceptadas en esta migración por la sección recortada
de Etapa 4a; revisar si conviene diferenciarlos más cuando se vea en
dispositivo real.
