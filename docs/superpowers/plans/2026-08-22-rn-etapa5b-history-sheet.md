# Etapa 5b — sheet `History` (historial completo de sesiones)

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa directamente sobre
Etapa 5a (fundación del sistema de sheets, ya cerrada — commit `f37a9b9`).

## Alcance y rulings

Del inventario de 21 sheets restantes original (tras excluir `SlotEdit.jsx`
en Etapa 5a), esta sub-etapa audita 5 candidatos pequeños
(`History`/39L, `DayPeek`/48L, `DayDrop`/65L, `IllusPick`/65L,
`ExInfo`/79L) y encuentra:

1. **`History.jsx` — se porta esta etapa.** Único caller real:
   `Progreso.jsx:199` (`openSheet('history')`, botón "Ver todas" de la
   sección Tus sesiones). Cero dependencias nuevas: reutiliza
   `groupSessionsByWeek` (`lib/session.js`, ya portado) y `SessionCard`
   (`screens/SessionCard.js`, ya portado en Etapa 4a).

2. **`DayPeek.jsx` — excluido, código muerto confirmado.** El propio
   archivo web ya trae un comentario admitiendo que quedó huérfano
   (`editDay` ya no existe, TEMP stub). Se confirmó además con grep que
   NO existe ningún `openSheet('day-peek', ...)` en toda `web/src` — cero
   callers. Misma categoría que `SlotEdit.jsx` en Etapa 5a: no se porta.

3. **`DayDrop.jsx` — excluido, código muerto confirmado.** SÍ está en el
   switch de `App.jsx` (`case 'day-drop'`) pero se confirmó con grep que
   ningún archivo de `web/src` llama `openSheet('day-drop')` — cero
   callers reales, sólo registrado pero nunca disparado.

4. **`IllusPick.jsx` — excluido, ni siquiera registrado.** No aparece en
   el switch `SheetContent` de `App.jsx` en absoluto (no hay `case
   'illus-pick'`) y tampoco hay ningún `openSheet('illus-pick')` en el
   árbol. Completamente inalcanzable en el original.

5. **`ExInfo.jsx` — diferido a una etapa futura, NO excluido.** 3
   callers reales confirmados (`ExerciseCarousel.jsx:237`,
   `Rutina.jsx:151,270` — todos vía `openSheet('ex-info', ...)`), así que
   es necesario portarlo, pero requiere 3 dependencias que esta etapa NO
   tiene tiempo de portar con el mismo rigor que exige el resto de la
   migración: `lib/exdb.js` (85L, base de datos educativa de ejercicios),
   `lib/illustrations.js` (102L, mapeo de urls/assets de ilustraciones —
   necesita decidirse cómo se resuelven imágenes remotas/bundleadas en
   RN, con `Image`/`expo-image` en vez de `<img>`) y
   `components/BodyMini.jsx` (97L, mini-silueta muscular con
   `react-native-svg` — mismo riesgo de scope-de-`<Defs>` que ya mordió
   dos veces esta migración en Etapa 4a/4b). Se difiere explícitamente
   a una sub-etapa futura (5c o posterior) que porte esas 3 dependencias
   como su propio grupo de tasks antes de portar `ExInfo` mismo — no se
   apura un port de mala calidad de la sheet educativa más citada de la
   app.

Ruling: jest se mantiene en 312 — esta etapa no toca `lib/`.

## Task única

**Files:**
- Create: `native/src/components/sheets/History.js`
- Modify: `native/src/components/SheetHost.js` (registrar `'history':
  History` en `SHEET_REGISTRY`, siguiendo el patrón de Etapa 5a)
- Modify: `native/src/screens/Progreso.js` (agregar el botón "Ver todas"
  que llama `openSheet('history')` — confirmar primero si ya existe algo
  parecido o si hay que agregarlo desde cero, igual que Etapa 5a hizo con
  el botón de reordenar en `Hoy.js`)

**Interfaces:**
- Consumes: `S, useStore` (`state.js`), `groupSessionsByWeek`
  (`lib/session.js`, ya portado), `SessionCard`
  (`screens/SessionCard.js`, ya portado en Etapa 4a — mismo componente,
  no duplicar).

- [x] **Step 1: Leer `web/src/components/sheets/History.jsx` completo (39
  líneas) y confirmar en `web/src/components/screens/Progreso.jsx` cómo
  se dispara `openSheet('history')` (contexto del botón "Ver todas": qué
  aparece antes/al lado, bajo qué condición se muestra si la hay).**

- [x] **Step 2: Portar `History` verbatim** a
  `native/src/components/sheets/History.js` — mismo agrupamiento por
  semana, mismo texto de estado vacío/contador. Reutilizar `SessionCard`
  tal cual está en `native/src/screens/SessionCard.js` (no crear una
  copia).

- [x] **Step 3: Registrar en `SheetHost.js`** — agregar `history: History`
  a `SHEET_REGISTRY`, import correspondiente. No tocar ninguna otra
  parte de `SheetHost.js` (ya cerrado y revisado en Etapa 5a).

- [x] **Step 4: Agregar el botón "Ver todas" en `Progreso.js`** que
  llama `openSheet('history')`, en el mismo lugar/condición que el
  original junto a la sección "Tus sesiones".

- [x] **Step 5: Verificar**

Run: `cd native && npx jest` → 312/312, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 6: Commit**

```bash
cd native && git add src/components/sheets/History.js src/components/SheetHost.js src/screens/Progreso.js && git commit -m "feat(rn): portar sheet History (historial completo de sesiones)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5a (312).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que `SessionCard` no se duplicó (History.js importa el
  mismo componente que usa Progreso.js, no una copia nueva).
- [x] Confirmar que las 3 exclusiones (DayPeek/DayDrop/IllusPick) siguen
  siendo código verdaderamente muerto en el original (no se activaron
  accidentalmente por algún cambio de esta etapa).

### Fix de revisión final (commit 6b99d4e..1429510)

La revisión final (opus) encontró 2 Importantes + 2 Menores, ninguno
detectable por jest/expo-doctor/bundler:
- **I1**: `History.js` no tenía padding horizontal (el host sólo aporta
  padding vertical) — contenido a borde de pantalla. Fix: `styles.wrap`
  con `paddingHorizontal: 20`, igual que los otros 3 sheets reales.
- **I2**: `SessionCard` dentro de `History.js` no recibía `navigation` —
  el tap silenciosamente mutaba `S.tab` sin navegar a ningún lado (misma
  clase de bug "tap muerto" ya encontrada y corregida dos veces antes en
  esta migración). Fix: `Progreso.js` pasa `navigation` como sheet prop
  (`openSheet('history', {navigation})`); `History.js` envuelve
  `navigation.navigate` para cerrar el sheet (`closeSheet()`) antes de
  navegar.
- **M1**: desalineación vertical del nuevo botón "Ver todas" (margen de
  `sect` heredado sin querer). Fix: nuevo `sectRowText` sin márgenes,
  márgenes movidos a `sectRow`; `sect` intacto para sus otros 4 usos.
- **M2**: touch target de 32pt sin `hitSlop`. Fix: `hitSlop` agregado,
  tamaño visual sin cambios.

Re-revisión independiente confirmó las 4 correcciones (trazado completo
de la cadena `navigation`, comparación de estilos con `Guide.js`, grep de
los otros usos de `styles.sect`) y cero regresiones. jest 312/312,
expo-doctor 21/21, bundler limpio (2243 módulos) — verificado tres veces
de forma independiente (controller, revisor de task, re-revisor).
