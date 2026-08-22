# Etapa 5c — sheet `ExInfo` (ficha educativa de ejercicio) + sus 3 dependencias

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5b
(cerrada — commit `6b33efb`). Etapa 5b diferió `ExInfo.jsx` explícitamente
porque necesita 3 dependencias sin portar: `lib/exdb.js`,
`lib/illustrations.js` (+ `lib/fedb-index.js`, su índice de datos) y
`components/BodyMini.jsx`. Esta etapa las porta y con eso arma `ExInfo`.

## Rulings

1. **`exdb.js` no arrastra `sessionMaxW`/`progressionWarn`.** El archivo
   web tiene esas dos funciones al final (usadas por Hoy para el banner
   de progresión — dependen de `S.sessions`), pero el propio comentario
   del archivo (líneas 64-71) aclara que se agregaron ahí recién en una
   task posterior del proyecto original, sin relación con `exInfo`/
   `rirScheme`/`isLowerBackLift` que sí necesita `ExInfo`. Como ninguna
   pantalla de Hoy en RN tiene todavía ese banner de progresión (grep
   confirmado: cero referencias a `sessionMaxW`/`progressionWarn` en
   `native/src/`), esta etapa porta SOLO `EXDB`/`exInfo`/`LOWBACK`/
   `isLowerBackLift`/`rirScheme` — lo que `ExInfo` necesita. Las otras
   dos quedan documentadas acá para cuando se porte el banner de
   progresión de Hoy (etapa futura, no ésta).

2. **`illustrations.js` se porta completo (incluye `searchIllus`),
   aunque `ExInfo` sólo use `illusUrl`.** `searchIllus`/`ILLUS` no tienen
   consumidor todavía en RN (el sheet que los usaría en el original,
   `IllusPick.jsx`, fue excluido en Etapa 5b por ser código muerto), pero
   son ~40 líneas de lógica de búsqueda ya resueltas y con foco reusable
   para cuando `ExerciseForm`/búsqueda de ejercicio se porte más
   adelante — no vale la pena partir el archivo. `fedb-index.js` (el
   índice de 873 ejercicios, ~63KB, 7 líneas de datos) se copia
   verbatim, es sólo datos.

3. **Las imágenes de `illusUrl` son URLs remotas de GitHub raw** (CDN
   `raw.githubusercontent.com/yuhonas/free-exercise-db`), no assets
   bundleados. En RN esto se resuelve con `<Image source={{uri:...}}>`
   (o `expo-image`, ya evaluar cuál está instalado) en vez de `<img>` —
   no hace falta bundlear nada, simplemente cambia el componente. `ex.photo`
   (foto propia del usuario, si la sacó) sigue el mismo patrón.

4. **`BodyMini` reaplica la lección de scope de `<Defs>` de Etapa 4a/4b.**
   El propio comentario del original (líneas 79-81) ya dice explícitamente
   que NO reutiliza los degradados de Silhouette porque este sheet se abre
   desde Rutina, donde Silhouette no está montado — cada instancia necesita
   sus propios `<Defs>` dentro de su propio `<Svg>`, exactamente el patrón
   ya usado en `Silhouette.js` (ver su comentario de Etapa 4a) y en el
   anillo de kcal de `Nutricion.js` (Etapa 4b). Se porta reusando
   `lib/bodydata.js` (`cuerpo()`, ya portado) y `lib/fibras.js`
   (`esGrupo`/`ZONA_DE`, ya portado) sin tocar ninguno de los dos.

5. **`ExInfo` se conecta sólo en `Rutina.js`, no en un `ExerciseCarousel`
   que todavía no existe.** El original tiene 3 callers de
   `openSheet('ex-info', ...)`: `ExerciseCarousel.jsx:237`,
   `Rutina.jsx:151,270`. `ExerciseCarousel.jsx` es parte de la UI de
   sesión activa de Hoy que todavía no se portó a RN (grep confirmado:
   no existe `native/src/components/ExerciseCarousel.js` ni nada
   parecido) — esta etapa sólo conecta los 2 botones ⓘ que YA existen en
   `native/src/screens/Rutina.js` hoy (uno por ejercicio en modo lectura,
   otro en el editor), replicando exactamente `wd`/`exId`/`name` que pasa
   el original. El tercer caller se conecta cuando se porte
   `ExerciseCarousel` en una etapa futura — el registro de `ExInfo` en
   `SHEET_REGISTRY` ya lo deja listo para ese momento sin tocar nada más.

Ruling: jest sube de 312 — esta etapa SÍ toca `lib/` (task 1 agrega
`exdb.js`/`illustrations.js`, ambas con tests nuevos, mismo patrón que
Etapa 4b con `meals.js`/`macros.js`).

## Tabla cruzada

| Task A | Task B | A produce | B consume | Hallazgo |
|---|---|---|---|---|
| 1 (exdb.js + illustrations.js + fedb-index.js) | 3 (ExInfo.js) | `exInfo`/`rirScheme`/`isLowerBackLift`/`illusUrl` | los usa directo | consistente — Task 3 después de 1 |
| 2 (BodyMini.js) | 3 (ExInfo.js) | componente `BodyMini` | lo importa | consistente — Task 3 después de 2 |

Tasks 1 y 2 son independientes entre sí (archivos disjuntos, ninguna
importa de la otra) pero ambas son prerequisito de Task 3. Orden: 1 y 2
(cualquier orden entre ellas, secuencial igual que siempre en este
proyecto — nunca paralelo), luego 3.

## Task 1: `exdb.js` + `illustrations.js` + `fedb-index.js`

**Files:**
- Create: `native/src/lib/exdb.js`, `native/src/lib/exdb.test.js`
- Create: `native/src/lib/illustrations.js`,
  `native/src/lib/illustrations.test.js`
- Create: `native/src/lib/fedb-index.js` (copia verbatim de datos, sin
  test propio — es sólo un array de datos, se testea indirectamente vía
  `illustrations.test.js`)

- [x] **Step 1**: Leer `web/src/lib/exdb.js` completo (86 líneas) y
  `web/src/lib/illustrations.js` completo (103 líneas). Confirmar (grep
  en `native/src/`) que ninguna de las dos ya existe.

- [x] **Step 2**: Portar `exdb.js` — SOLO `EXDB`/`exInfo`/`LOWBACK`/
  `isLowerBackLift`/`rirScheme` (ver ruling 1: NO portar
  `sessionMaxW`/`progressionWarn` en esta etapa). Depende de `format.js`
  (`norm`) — ya portado, no tocar.

- [x] **Step 3**: Portar `illustrations.js` completo (`ILLUS`,
  `illusUrl`, `searchIllus`, el mapa `ES_EN`) + copiar
  `fedb-index.js` verbatim (datos, no lógica).

- [x] **Step 4**: Tests — cobertura equivalente a lo que exista para
  `exdb`/`illustrations` en `web/` si hay tests ahí (revisar
  `web/src/lib/__tests__/` o similar); si no hay tests web de
  referencia, escribir tests directos sobre `exInfo`/`rirScheme`/
  `isLowerBackLift`/`illusUrl`/`searchIllus` cubriendo casos reales
  (ej.: `exInfo('press banca')` matchea, `rirScheme` respeta el cap de
  espalda baja, `searchIllus('press banca')` devuelve resultados
  relevantes vía la capa ES_EN).

- [x] **Step 5: Verificar**

Run: `cd native && npx jest` → sube de 312 (reportar número exacto).
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 6: Commit**

```bash
cd native && git add src/lib/exdb.js src/lib/exdb.test.js src/lib/illustrations.js src/lib/illustrations.test.js src/lib/fedb-index.js && git commit -m "feat(rn): portar exdb.js + illustrations.js (base para ExInfo)"
```

---

## Task 2: `BodyMini.js`

**Files:**
- Create: `native/src/components/BodyMini.js`

**Interfaces:**
- Consumes: `cuerpo` (`lib/bodydata.js`, ya portado, NO tocar), `esGrupo`/
  `ZONA_DE` (`lib/fibras.js`, ya portado, NO tocar), `S` (`state.js`).

- [x] **Step 1**: Leer `web/src/components/BodyMini.jsx` completo (97
  líneas) y `native/src/screens/Silhouette.js` completo (referencia
  directa: mismo patrón de `<Svg>`/`<Defs>`/`<Path>` con
  `react-native-svg`, misma fuente de geometría `cuerpo()`).

- [x] **Step 2**: Portar `BodyMini` — dos `<Svg>` (frente/espalda,
  siempre ambas, igual que el original: un cuerpo sin espalda "se lee
  como error"), zonas encendidas por `enciende()` según `fibras.p`/
  `fibras.s`, degradado propio en su propio `<Defs>` DENTRO de cada
  `<Svg>` (nunca compartir con Silhouette — ver ruling 4). Leyenda de
  texto con las porciones principales/secundarias.

- [x] **Step 3: Verificar**

Run: `cd native && npx jest` → sin cambios respecto a Task 1 (este
componente no tiene lógica testeable aislada de renderizado).
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 4: Commit**

```bash
cd native && git add src/components/BodyMini.js && git commit -m "feat(rn): portar BodyMini (mini-silueta con zonas encendidas)"
```

---

## Task 3: sheet `ExInfo.js`

**Files:**
- Create: `native/src/components/sheets/ExInfo.js`
- Modify: `native/src/components/SheetHost.js` (registrar `'ex-info':
  ExInfo` en `SHEET_REGISTRY` — SOLO esa línea + su import, no tocar
  nada más del archivo, ya cerrado y revisado en Etapa 5a/5b)
- Modify: `native/src/screens/Rutina.js` (conectar los 2 botones ⓘ
  existentes a `openSheet('ex-info', {name, wd, exId})`)

**Interfaces:**
- Consumes: `exInfo`/`rirScheme`/`isLowerBackLift` (`lib/exdb.js`, Task
  1), `illusUrl` (`lib/illustrations.js`, Task 1), `BodyMini`
  (Task 2), `equipLabel` (`lib/equip.js`, ya portado), `fibrasDe`
  (`lib/fibras.js`, ya portado), `S` (`state.js`).

- [x] **Step 1**: Leer `web/src/components/sheets/ExInfo.jsx` completo
  (79 líneas) y ambos call sites de `web/src/components/screens/Rutina.jsx`
  (líneas 151 y 270) para confirmar el shape exacto de props que se pasan
  (`name`, `wd`, `exId`). Leer también `native/src/screens/Rutina.js`
  actual para localizar dónde viven hoy los botones ⓘ equivalentes (si
  ya existen sin handler, o si hay que agregarlos).

- [x] **Step 2**: Portar `ExInfo` verbatim a
  `native/src/components/sheets/ExInfo.js` — misma búsqueda de `sets`
  recorriendo TODOS los días de `S.routine` por `exId` (no sólo `wd`,
  igual que el original), mismo orden de secciones (BodyMini → media →
  equipo → músculos/por qué elegirlo → esquema RIR), mismo texto de
  fallback si no hay ficha educativa. Imágenes (`ex.illus`/`ex.photo`)
  con `Image` de React Native (o `expo-image` si ya está instalado en
  el proyecto — confirmar antes de elegir) en vez de `<img>`.

- [x] **Step 3**: Registrar `'ex-info': ExInfo` en `SheetHost.js`.

- [x] **Step 4**: Conectar los 2 botones ⓘ de `Rutina.js` a
  `openSheet('ex-info', {name, wd, exId})`, replicando el original.

- [x] **Step 5: Verificar**

Run: `cd native && npx jest` → sin cambios respecto a Task 1/2.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 6: Commit**

```bash
cd native && git add src/components/sheets/ExInfo.js src/components/SheetHost.js src/screens/Rutina.js && git commit -m "feat(rn): portar sheet ExInfo (ficha educativa + esquema RIR)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — reportar número final, comparar con el
  esperado tras Task 1.
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que `BodyMini` usa `<Defs>` propios (no los de
  `Silhouette.js`) — mismo grep que atrapó el bug de Etapa 4a.
- [x] Confirmar que `exdb.js` NO incluye `sessionMaxW`/`progressionWarn`
  (quedan fuera de alcance a propósito, ver ruling 1).
- [x] Confirmar que las imágenes remotas (`illusUrl`) no rompen el
  bundler ni requieren configuración adicional de `app.json` (dominios
  remotos en `<Image>` no necesitan whitelist en Expo por defecto —
  verificar que sigue siendo cierto en la versión de Expo del proyecto).

### Resultado de la revisión final (opus, commits 6b33efb..51bfaf1)

CLEAN — sin ronda de fix. Las dos clases de bug que esta migración ya
había pisado antes se verificaron con evidencia de código y quedaron
confirmadas correctas: (1) scope de `<Defs>` en `BodyMini.js` — cada una
de las dos `<Svg>` (frente/espalda) tiene su propio `<Defs>` anidado, no
uno compartido/izado afuera (justo lo opuesto al patrón del original web,
que usa un `<svg>` oculto con defs compartidos — un patrón sólo válido en
el DOM); reusar el mismo id `bm-grad` en ambas instancias es seguro,
verificado leyendo el código fuente instalado de `react-native-svg`
(`SvgView.java`: mapa de brushes por instancia de `SvgView`, no global).
(2) "tap-swallowing" en `Rutina.js` — la fila de modo lectura no tenía
ningún touchable anidado antes de envolverla en `Pressable` (sólo
`<Text>`s), y el nuevo botón ⓘ del editor es un sibling plano en el
mismo row flex, no anidado — ninguno de los dos rompe interacciones
existentes. `exdb.js` confirmado sin `sessionMaxW`/`progressionWarn` y
sin import de `state.js`. Imágenes remotas (`https://`) no necesitan
configuración adicional en Expo; `ex.photo` confirmado como data-URI en
`rutina-logic.js` (ruta hoy inactiva — no hay UI de cámara portada
todavía, pero el patrón es correcto para cuando exista).

4 notas cosméticas menores registradas para el backlog (no bloquean):
colores de `BodyMini` (secundario/pelo/leyenda) difieren ligeramente de
los del CSS original sin justificación documentada; zonas visibles sin
`stroke` entre ellas (a diferencia de Silhouette.js) — zonas adyacentes
del mismo estado pueden leerse como una sola mancha; el botón ⓘ del
editor de Rutina no se atenúa cuando no hay ficha educativa (el original
sí, con `opacity:.4`); `accessibilityElementsHidden` es sólo-iOS, falta
el equivalente Android (`importantForAccessibility`). jest 330/330,
expo-doctor 21/21, bundler limpio — verificado de forma independiente
por el controller antes y después de cada task, y por el revisor final.
