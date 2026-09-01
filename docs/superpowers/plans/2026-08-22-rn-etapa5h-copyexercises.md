# Etapa 5h — sheet `CopyExercises` (copiar/traer ejercicios entre turnos)

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5g
(cerrada — commit `0d92f32`).

## Alcance y rulings

**`CopyExercises.jsx` — se porta esta etapa.** Callers reales
confirmados por grep: `Rutina.jsx:325,329` (`openSheet('copy-exs',
{mode:'push', wd:index})` / `{mode:'pull', wd:index}`) — `Rutina.js` YA
está portado. Portar esta etapa da un caller real desde el día uno (a
diferencia de Etapa 5g, donde `EntryEdit` quedó sin caller alcanzable).

**RULING CRÍTICO — bug confirmado en el ORIGINAL, no introducido por
esta migración: se corrige en el port.** Los dos call sites en
`Rutina.jsx` pasan la prop como `wd` (`openSheet('copy-exs', {mode,
wd:index})`), pero `CopyExercises.jsx` la destructura como `index`
(`export default function CopyExercises({ mode = 'push', index })`).
Confirmado con grep exhaustivo: `CopyExercises` no tiene ningún otro
caller en `web/src` que pase `index`. Esto significa que en el ORIGINAL,
`index` siempre llega `undefined` → `propio = +index = NaN` → todos los
filtros `i !== propio` son siempre verdaderos (`NaN` nunca es igual a
nada) → el turno "propio" nunca se excluye de `otros`/`destinos`. Es
decir: el sheet "Copiar a otro turno"/"Traer de otro turno" del
ORIGINAL ofrece el turno actual como si fuera "otro turno" — un bug real
y confirmado, no parte de ningún comportamiento intencional documentado
(no hay comentario que lo explique, a diferencia de cada otra deviation
de esta migración). Portar esta prop rota tal cual reproduciría un bug
day-one en RN cuando el port SÍ tiene la oportunidad de corregirlo con
un cambio trivial y de bajísimo riesgo: destructurar `wd` en vez de
`index` (o aceptar ambos nombres, por robustez, aunque no hace falta —
ambos call sites reales usan `wd`). Fix aplicado en el port: `export
default function CopyExercises({ mode = 'push', wd })` y usar `wd` en
vez de `index` en todo el cuerpo del componente (renombrar la variable
interna `propio = +wd` para mantener el resto de la lógica intacta).
Esto es una corrección de bug real, documentada explícitamente aquí y en
el reporte de la task — no una "mejora" no solicitada ni un cambio de
alcance.

Ruling: **todas las demás dependencias ya existen** — `S, closeSheet`
(`state.js`), `equipLabel, exKey` (`equip.js`), `copyExercises,
copySourceExercises` (`rutina-logic.js`) — grep confirmado, cero
dependencias nuevas de `lib/`.

Ruling: **`<select>` (elegir de qué rutina de la biblioteca traer, sólo
en modo `pull` con `fuente==='lib'`)** se porta como chips, mismo
patrón que Etapa 5f/5g — `S.lib` es normalmente una lista corta de
rutinas guardadas.

Ruling: **checkboxes de selección de ejercicios** (`pick-list`) se
portan con `Pressable` + ícono de check, mismo patrón visual usado en
`ReorderHoy.js`/otros sheets con listas seleccionables ya portados.

Ruling: **radio buttons (merge/replace)** se portan como el mismo par de
opciones tipo-chip usado para sexo en `Profile.js` (Etapa 5f) — RN no
tiene radio nativo, y esta migración ya resolvió ese caso.

Ruling: jest se mantiene igual — esta etapa no agrega lógica nueva a
`lib/`, todo lo que `CopyExercises` necesita ya existe.

## Task única

**Files:**
- Create: `native/src/components/sheets/CopyExercises.js`
- Modify: `native/src/components/SheetHost.js` (registrar `'copy-exs':
  CopyExercises` en `SHEET_REGISTRY` — SOLO esa línea + su import)

**Interfaces:**
- Consumes: `S, closeSheet` (`state.js`), `equipLabel, exKey`
  (`equip.js`), `copyExercises, copySourceExercises`
  (`rutina-logic.js`) — todos ya portados, ninguno se modifica.

- [x] **Step 1**: Leer `web/src/components/sheets/CopyExercises.jsx`
  completo (250 líneas, prestar atención especial a los 3 comentarios de
  cabecera que explican por qué push/pull comparten un componente) y
  `web/src/components/screens/Rutina.jsx` líneas 320-330 (los 2 call
  sites, confirmar que ambos pasan `wd`, nunca `index`).

- [x] **Step 2**: Portar `CopyExercises` verbatim a
  `native/src/components/sheets/CopyExercises.js` **CON EL FIX de la
  prop `wd` en vez de `index`** (ver ruling crítico arriba) — toda la
  demás lógica intacta: estado de origen/destino, `useMemo` de
  `destinos`/`src`, selección con default inteligente (excluye
  repetidos en modo merge), toggle individual y "Todos"/"Ninguno",
  `confirmar()` llamando `copyExercises()` y cerrando.

- [x] **Step 3**: Registrar `'copy-exs': CopyExercises` en
  `SheetHost.js`.

- [x] **Step 4: Verificar**

Run: `cd native && npx jest` → 330/330, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 5: Commit**

```bash
cd native && git add src/components/sheets/CopyExercises.js src/components/SheetHost.js && git commit -m "feat(rn): portar sheet CopyExercises (copiar/traer ejercicios entre turnos, fix de prop wd/index del original)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5g (330).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar EXPLÍCITAMENTE que el componente portado usa `wd` (no
  `index`) y que por lo tanto `propio` NUNCA es `NaN` para los 2 call
  sites reales de `Rutina.js` — este es el hallazgo más importante de
  esta etapa, re-verificar con una traza manual del flujo completo
  (abrir en modo push desde el turno 2, confirmar que el turno 2 NO
  aparece en la lista de destinos).
- [x] Confirmar que el modo `pull` con `fuente==='lib'` no crashea si
  `S.lib` está vacío (ya cubierto por el `S.lib.length > 0 &&` guard del
  original).
- [x] Confirmar que `disabled={destino == null || !elegidos.length}` en
  el botón de confirmar se porta correctamente (RN: `disabled` prop de
  `Pressable` o condicional de estilo/handler).

### Corrección de premisa: `Rutina.js` NO tenía los call sites

Esta ruling asumía que `Rutina.js` ya llamaba `openSheet('copy-exs',
...)` desde una etapa anterior. Era falso — grep confirmado por el
implementador: cero referencias a `'copy-exs'` en `Rutina.js` antes de
esta etapa. Sin los botones, el sheet portado habría quedado sin ningún
punto de entrada real, haciendo imposible verificar el fix del bug
`wd`/`index` (el motivo de esta etapa). El implementador agregó los 2
botones faltantes (⧉ Copiar / ⤓ Traer) directo en `ExerciseList`,
reflejando exactamente `web/src/components/screens/Rutina.jsx:321-332`
(mismo texto, misma condición `disabled={!exs.length}` en el botón
push). Verificado por el revisor: la inserción reusa estilos ya
existentes en el archivo (`btnRow`/`btnGlass`/`miniBtnDisabled`), no
choca con el botón ⓘ de Etapa 5c ni con la fila de mini-botones
↑/↓/✎/✕, y pasa la variable de loop correcta (`i` de
`S.routine.map((slot,i)=>...)`, sin anidamiento ni off-by-one).

### Resultado de la revisión final (opus, commit 0d92f32..3c11c2d)

CLEAN — Approved en el primer pase. La cadena completa `Rutina.js` pasa
`wd:index` → `CopyExercises.js` recibe `wd` → `propio = +wd` nunca es
`NaN` — se verificó de punta a punta con una traza manual (turno 2 como
origen en modo push, confirmado que el turno 2 se excluye de
`destinos`). Resto del port fiel línea por línea al original
(`conEjercicios`/`destinos`/`src`/`seleccion` con exclusión de
repetidos en merge/`confirmar()` con el guard y el coerce a `'replace'`
cuando el destino está vacío). Notas menores no bloqueantes: el par
merge/replace se implementó como radios reales en vez de chips (más
fiel al original que la ruling sugerida, no un problema), el
`equipLabel` se muestra como texto plano en vez de badge (cosmético), y
el comentario portado en `Rutina.js` perdió la segunda mitad que
explica por qué los botones son siempre visibles (recuperar la próxima
vez que se toque el archivo). jest 330/330, expo-doctor 21/21, bundler
limpio — verificado de forma independiente.
