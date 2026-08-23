# Unificación visual — tokens de diseño + tab bar + tipografía

Continúa sobre el cierre de "Completar Hoy.js" (commit `6aa4abb`). Segunda
mitad del pedido explícito de Enzo tras cerrar Etapa 6 ("Haz la opción 1
y 2": completar Hoy.js + revisar visual), basada en el inventario hecho
por un agente de investigación (sin cambios de código) que comparó
`web/src/styles.css` contra los `StyleSheet.create` de `native/src/`.

## Contexto

`native/` no tiene ningún archivo de tokens de diseño — 26 archivos
definen colores/spacing/tipografía como literales sueltos. El original
web sí lo tiene, muy explícito (`web/src/styles.css:4-46`, `:root` con
paleta nombrada, escala de espaciado de 6 pasos, escala tipográfica de 7
pasos, radios, con comentarios documentando por qué existe esa escala:
"la app tenía 18 tamaños distintos, que es deriva, no jerarquía"). El
port a RN reintrodujo esa misma deriva: 18 `fontSize` distintos
(incluyendo 12.5/11.5 fraccionarios), 16 `borderRadius` distintos, 57
hex colors distintos, y la paleta base está corrida del original
(grises neutros en vez de azulados, bordes blancos en vez de azules
translúcidos).

Hallazgos priorizados del inventario (ver detalle completo en el
reporte del survey, no repetido aquí):
1. Tab bar sin ningún estilo (`native/App.js:68`) — el elemento más
   visible de la app, roto.
2. Cero tipografía custom (Barlow/Barlow Condensed del original vs.
   sans del sistema) y cero `fontVariant: tabular-nums` en cifras que
   cambian en vivo.
3. Tokens de hero a ~55-60% del tamaño original (26px vs 46px).
4. Paleta base desplazada (texto, mutados, card, fondo, línea) —
   siempre en la misma dirección: gris neutro en vez de azulado.
5. Eyebrows sin acento cian (usan el azul de botón primario).
6. 8 ámbares casi idénticos sin criterio + verde/rojo no coinciden con
   el original.
7. Radio de card inconsistente entre pantallas (18/16/14 mezclados).
8. Tamaños fraccionarios resucitados (12.5, 11.5).
9. Violeta de Rutina en el tono equivocado (violeta de Tailwind plano
   en vez de la familia azul-violeta translúcida del original).
10. Gradientes casi no se portaron (CTAs son color plano).
11. Contraste sospechoso en `#5a6478` sobre `#0e1626` (~2.4:1, bajo el
    mínimo de 4.5:1 para texto).

## Rulings

Ruling: **alcance de esta etapa = hallazgos 1, 2, 3, 4, 6, 7, 8, 11**
(tab bar, fuentes, tokens centralizados, migración mecánica de colores,
jerarquía de tamaños). **Quedan FUERA a propósito**: hallazgo 5 (acento
cian en eyebrows), hallazgo 9 (violeta correcto de Rutina), hallazgo 10
(gradientes en CTAs) — son restauración de lenguaje visual que nunca se
portó, no unificación de inconsistencias; el propio survey los marca
como "rediseño, no unificación", de mayor riesgo sin poder verificar en
pantalla. Se documentan como pendientes para una etapa futura cuando
haya dispositivo/emulador para juzgar el resultado.

Ruling: **orden de trabajo = tab bar + fuentes primero, tokens después,
migración mecánica al final** — siguiendo la recomendación del survey:
son los únicos 2 hallazgos que se notan en el primer segundo y no son
problemas de consistencia sino de ausencia; parchar tokens sin fuentes
deja la app "ordenada pero genérica".

Ruling: **`native/src/theme.js` se transcribe del `:root` del web
(`web/src/styles.css:4-46`), no se inventa** — mismos nombres de rol
(`C.bg, C.card, C.txt, C.mut, C.mut2, C.accent, C.blue, C.ok, C.warn,
C.red, C.line`), misma escala de spacing (`S.s1..s6`), misma escala
tipográfica (`T.micro..hero`), mismos radios (`R.r:18, R.rLg:26,
R.pill:999`). Si `docs/design-tokens-hoy.md` existe (citado por el CSS
como origen), leerlo también antes de fijar los valores numéricos
exactos.

Ruling: **la migración de las 26 pantallas a los tokens se hace por
reemplazo mecánico** (`#fff`→`C.txt`, `#8a93a6`→`C.mut`,
`rgba(255,255,255,.08)`→`C.line`, `rgba(255,255,255,.06)`→su
equivalente, etc.) revisado con grep antes/después — NO reescritura de
layout ni de estructura de componentes. Bajo riesgo: son cambios de
color puros. Cualquier archivo donde el reemplazo mecánico no sea 1:1
obvio (por ejemplo un color usado con dos intenciones distintas en el
mismo archivo) se documenta y se decide caso por caso, no se fuerza.

Ruling: **fuentes** — instalar Barlow + Barlow Condensed vía
`expo-font`/`@expo-google-fonts` (evaluar cuál conviene al implementar:
`@expo-google-fonts/barlow` + `@expo-google-fonts/barlow-condensed` son
la opción estándar de Expo, sin necesidad de alojar archivos `.ttf`
propios). Aplicar Condensed itálica a números "hero" (peso, heroDay,
etc.) y `fontVariant: ['tabular-nums']` a toda cifra que cambie en vivo
(temporizador, peso/reps en edición, contadores).

Ruling: **jerarquía de tamaños** (hallazgos 3, 7, 8) se resuelve
DESPUÉS de que existan los tokens (`T.hero`, `R.r`), usando esos valores
— no se fijan números nuevos sueltos. Título de pantalla se unifica a
un solo tamaño de `T` en las 4 pantallas que hoy difieren (28 vs 34);
cards se unifican a `R.r` (18) salvo que haya una razón real para un
radio distinto (documentar si aplica); tamaños fraccionarios (12.5,
11.5) se redondean al escalón de `T` más cercano.

Ruling: **contraste** (hallazgo 11) — subir `#5a6478`/equivalente a un
tono con ratio ≥4.5:1 sobre `C.card`/`C.bg`, usando el propio `mut2`
del web como referencia (que ya es más claro que lo que tiene RN hoy).

Ruling: jest se mantiene igual — esta etapa es 100% estilos, sin lógica
nueva testeable. Verificación es `expo-doctor` + `expo export` +
revisión de código (grep de valores antes/después), no jest.

## Tabla cruzada

| Task | Produce | Consume | Depende de |
|---|---|---|---|
| 1 (theme.js) | `C, S, T, R` | `web/src/styles.css` | ninguna |
| 2 (fuentes + tab bar) | fuentes cargadas, `App.js` tab bar estilado | Task 1 (colores de la barra) | Task 1 |
| 3 (migración mecánica de colores, 26 archivos) | — | Task 1 | Task 1 |
| 4 (jerarquía: tamaños de hero/título/radios/fraccionarios) | — | Task 1, Task 3 (mismo archivo, evitar conflicto de merge) | Tasks 1, 3 |

Orden: 1 → (2 y 3 en paralelo, no tocan los mismos archivos salvo
`App.js` que sólo toca Task 2) → 4.

## Task 1: `native/src/theme.js`

**Files:** Create `native/src/theme.js`

- [x] **Step 1**: Leer `web/src/styles.css` líneas 1-50 (o el rango
  completo del `:root`) y, si existe, `docs/design-tokens-hoy.md`.

- [x] **Step 2**: Crear `theme.js` exportando `C` (colores), `S`
  (spacing s1-s6), `T` (tipografía micro-hero), `R` (radios r/rLg/pill)
  con los valores exactos transcritos del web — no inventar ninguno.

- [x] **Step 3: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error (el archivo nuevo no se usa todavía, sólo debe existir sin
romper nada).

- [x] **Step 4: Commit**

```bash
cd native && git add src/theme.js && git commit -m "feat(rn): crear theme.js con tokens de diseño transcritos del original web"
```

---

## Task 2: fuentes + tab bar

**Files:** Modify `native/App.js`, `native/package.json`

- [x] **Step 1**: Instalar `@expo-google-fonts/barlow` y
  `@expo-google-fonts/barlow-condensed` vía `npx expo install` (nunca
  `npm install` plano, convención de esta migración).

- [x] **Step 2**: Cargar las fuentes en `App.js` (hook
  `useFonts`/`expo-font`, con pantalla de carga o `null` mientras
  cargan, patrón estándar de Expo).

- [x] **Step 3**: Estilar la barra de tabs en `App.js:68` —
  `tabBarStyle` (fondo `C.card`/`C.bg`, altura acorde a `--tabs-h` del
  web si aplica), `tabBarActiveTintColor`/`tabBarInactiveTintColor`
  usando `C`, usando `theme.js` de Task 1.

- [x] **Step 4: Verificar**

Run: `cd native && npx expo-doctor` → 21/21 (agregar excepción en
`expo.doctor.reactNativeDirectoryCheck.exclude` sólo si alguna de las
librerías de fuentes lo requiere, verificar primero).
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 5: Commit**

```bash
cd native && git add App.js package.json && git commit -m "feat(rn): cargar Barlow/Barlow Condensed y estilar la barra de tabs"
```

---

## Task 3: migración mecánica de colores (26 archivos)

**Files:** Modify los 26 archivos de `native/src/` con estilos
(identificar con grep antes de empezar).

- [x] **Step 1**: Grep de los valores a reemplazar en todo
  `native/src/`: `#fff`, `#8a93a6`, `#5a6478`, `rgba(255,255,255,.08)`,
  `rgba(255,255,255,.06)`, y el resto de hex/rgba identificados en el
  survey, con conteo por archivo.

- [x] **Step 2**: Reemplazo mecánico archivo por archivo, importando
  `C`/`S`/`T`/`R` de `../theme.js` (ruta relativa según profundidad) y
  sustituyendo el literal por el token correspondiente. Documentar
  cualquier caso donde el mismo literal se use con 2 intenciones
  distintas en un mismo archivo (no forzar un solo reemplazo ahí,
  decidir caso por caso).

- [x] **Step 3**: Grep de verificación — cero apariciones de los
  valores viejos en los archivos migrados (salvo los casos
  documentados en Step 2).

- [x] **Step 4: Verificar**

Run: `cd native && npx jest` → sin cambios (esta task no toca lib/).
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 5: Commit**

```bash
cd native && git add -A && git commit -m "refactor(rn): migrar colores hardcodeados a theme.js (reemplazo mecánico)"
```

---

## Task 4: jerarquía (tamaños de hero/título, radios, fraccionarios)

**Files:** Modify pantallas con desviaciones identificadas en el
survey (`Hoy.js`, `Inicio.js`, `Progreso.js`, `Rutina.js`,
`Nutricion.js`, `ExerciseList.js`, `Library.js`, y cualquier otra que
el grep de Step 1 encuentre).

- [ ] **Step 1**: Grep de `fontSize`/`borderRadius` en todo
  `native/src/` para el inventario completo (el survey ya listó los
  principales, confirmar que no falta ninguno).

- [ ] **Step 2**: Unificar título de pantalla a un solo valor de `T`
  (hoy 28 vs 34 mezclados en 5 pantallas).

- [ ] **Step 3**: Subir los "hero" numbers a un valor de `T` cercano al
  original (26→~46 en Hoy, 22→~38 en Rutina) — usando `T.hero`/el
  escalón que corresponda de Task 1, no un número nuevo suelto.

- [ ] **Step 4**: Unificar radios de card a `R.r` (18) en los archivos
  que hoy tienen 16/14, salvo justificación real documentada.

- [ ] **Step 5**: Redondear tamaños fraccionarios (12.5, 11.5) al
  escalón de `T` más cercano.

- [ ] **Step 6**: Subir el contraste de `mut2`/equivalente
  (`#5a6478`→valor con ratio ≥4.5:1, referencia el `mut2` del web) si
  Task 3 no lo dejó ya resuelto vía el token.

- [ ] **Step 7: Verificar**

Run: `cd native && npx jest` → sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [ ] **Step 8: Commit**

```bash
cd native && git add -A && git commit -m "style(rn): unificar jerarquía tipográfica y radios de card entre pantallas"
```

---

## Revisión final de la etapa

- [ ] `cd native && npx jest` — sin cambios respecto al cierre de
  "Completar Hoy.js" (376).
- [ ] `cd native && npx expo-doctor` — sin errores.
- [ ] Bundler de Metro compila sin error.
- [ ] `web/` sin ningún archivo modificado.
- [ ] `theme.js` tiene los valores transcritos correctamente del `:root`
  del web (comparar línea por línea, no de memoria).
- [ ] Grep de verificación: cero literales de color viejos quedaron
  sueltos fuera de los casos documentados como excepción.
- [ ] Tab bar tiene estilo propio (no el default de React Navigation).
- [ ] Las fuentes cargan sin bloquear el arranque de la app (pantalla
  de carga o fallback razonable mientras `useFonts` resuelve).
- [ ] Ningún archivo quedó con un radio/tamaño de fuente huérfano fuera
  de la escala de `T`/`R` sin justificación.
- [ ] Documentar en el reporte final los 3 hallazgos dejados fuera a
  propósito (cian de eyebrows, violeta de Rutina, gradientes en CTAs) —
  no se pierden, quedan para una etapa futura con dispositivo.
