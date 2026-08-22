# Etapa 5o — sheet `Settings` (ajustes básicos, con respaldo/color/datos-de-prueba diferidos)

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5n
(cerrada — commit `d1982d4`).

## Alcance y rulings

**`Settings.jsx` — se porta esta etapa SÓLO en su porción de
preferencias simples.** El original mezcla 8 secciones de complejidad
muy distinta. Grep confirmado: NINGUNA de `lib/seed.js`, `lib/backup.js`,
`lib/foodmd.js`, `lib/theme.js` está portada todavía, y el trigger real
(`onOpenSettings` en el `Header` del original) tampoco existe en RN
todavía — este sheet queda sin caller alcanzable esta etapa (mismo
patrón que `EntryEdit`/`VoiceLog`), registrado para cuando el header/
ajustes tenga su propio botón en una etapa futura.

**Se porta esta etapa:**
- Unidad de peso (kg/lb) — `S.cfg.unit`, ya usado por `wDisplay`/`wAlt`
  en pantallas ya portadas.
- Cuerpo del mapa muscular (Hombre/Mujer) — `S.cfg.bodySex`, ya
  consumido por `Silhouette.js` (Etapa 4a).
- Descanso entre series — stepper ±15s, `S.cfg.rest`, formateado con
  `fmtMMSS` (ya portado).
- Al mover un día sobre otro ocupado (Preguntar/Correr/Intercambiar) —
  `S.cfg.dayDrop`.
- Metas nutricionales diarias — toggle Desde-perfil/Manual
  (`S.cfg.goalsAuto`), con el preview de macros (`computeMacros`, ya
  portado) en modo automático, y 4 campos NO controlados con guardado
  en `onBlur` (no `onChange`) en modo manual.
- Enlace a "✎ Editar perfil" (`openSheet('profile')`, ya portado en
  Etapa 5f).
- Pie de versión — SIN el botón "Buscar actualización" (ver ruling de
  diferimiento).

**Se DIFIERE esta etapa (documentado, no un recorte silencioso):**

1. **Selector de color de tema** — el original usa `<input
   type="color">` (rueda de color nativa del navegador) + `lib/theme.js`
   (deriva una paleta completa de un solo hex). RN no tiene un color
   picker nativo equivalente; requeriría instalar una librería de color
   picker de terceros y `lib/theme.js` completo, sin poder verificar
   visualmente el resultado sin dispositivo. Se difiere entero a una
   etapa futura de theming.

2. **Buscar actualización** — el original hace `navigator.serviceWorker
   .getRegistrations()` + `caches.delete()` + recarga sin caché: es un
   mecanismo específico de Service Worker/PWA que NO tiene equivalente
   conceptual en una app nativa (las apps nativas se actualizan vía la
   tienda de apps o un sistema de OTA update de Expo, no revisando un
   service worker). Este NO es un caso de "sin dispositivo para probar"
   — es un caso de "el concepto mismo no aplica a RN". Se omite
   permanentemente esta sección tal como está (una etapa futura podría
   agregar un chequeo de `expo-updates` si el proyecto llega a usar
   actualizaciones OTA, pero sería una función nueva, no un porteo).

3. **Datos de prueba (seed) — cargar/borrar** — requiere `lib/seed.js`
   completo (genera ~5 semanas de sesiones sintéticas + rutina +
   nutrición). No portado, deferred a una etapa propia dado su tamaño y
   que no es una preferencia sino una herramienta de desarrollo/demo.

4. **Respaldo (exportar/importar JSON) + base de alimentos (exportar/
   importar MD)** — requieren `lib/backup.js`/`lib/foodmd.js` (no
   portados) Y acceso a archivos del dispositivo (`expo-document-picker`
   + `expo-file-system` + `expo-sharing`, ninguno instalado). Mismo
   criterio que cámara/voz en etapas anteriores: sin dispositivo para
   probar permisos de almacenamiento/compartir. Se difiere completo.

5. **"Borrar todos los datos"** — depende de `wipeAll()` de
   `backup.js` (no portado), y es la acción más destructiva de toda la
   app — se difiere junto con el resto de respaldo, no se reimplementa
   parcialmente sin su contraparte de exportar-antes-de-borrar.

Ruling: **el flujo "cargar datos de prueba" tenía 2 `confirm()`
encadenados** en el original (documentado en su propio comentario de
cabecera) — es información que documentar para cuando Datos de prueba
se porte en el futuro, no algo que implementar ahora.

Ruling: **`setGoal(k, raw)` usa `onBlur`, no `onChange`, y el propio
comentario de cabecera (líneas 14-27) es la explicación más detallada
de esta migración sobre por qué** — el original tenía un FIX ROUND 1
propio: guardar en cada tecla escribía a IndexedDB dígitos parciales
("1","19","195","1950") según cuándo se interrumpiera el tecleo. Portar
EXACTAMENTE este patrón: `TextInput` con `defaultValue`, `onEndEditing`
(equivalente RN de `onBlur` que expone `text` — ver la lección de la
Etapa 5m, donde `onBlur` NO expone `nativeEvent.text` en RN y corrompió
datos silenciosamente; acá se usa `onEndEditing` desde el principio,
no se repite ese error).

Ruling: **`setTheme`/`resetTheme`/`aplicarPaleta` NO se portan** —
dependen de `lib/theme.js`, diferido (ver arriba). El bloque de color
completo (swatch, preview de paleta, botón restablecer) se omite del
JSX portado, no se deja a medias.

Ruling: **todas las dependencias de la porción portada ya existen** —
`S, bump, closeSheet, openSheet, saveCfg` (`state.js`), `fmtMMSS`
(`format.js`), `computeMacros, applyComputedGoals` (`macros.js`) — grep
confirmado, cero dependencias nuevas de `lib/`.

Ruling: jest se mantiene igual — esta etapa no agrega lógica nueva a
`lib/`.

## Task única

**Files:**
- Create: `native/src/components/sheets/Settings.js`
- Modify: `native/src/components/SheetHost.js` (registrar
  `'settings': Settings` — SOLO esa línea + su import)

**Interfaces:**
- Consumes: `S, bump, closeSheet, openSheet, saveCfg` (`state.js`),
  `fmtMMSS` (`format.js`), `computeMacros, applyComputedGoals`
  (`macros.js`) — todos ya portados, ninguno se modifica.

- [x] **Step 1**: Leer `web/src/components/sheets/Settings.jsx`
  completo (347 líneas, TODOS los comentarios) y confirmar con grep que
  `seed.js`/`backup.js`/`foodmd.js`/`theme.js` no están portados (para
  documentar los diferimientos con evidencia).

- [x] **Step 2**: Portar `Settings` verbatim SÓLO en las secciones no
  diferidas: unidad de peso, cuerpo del mapa muscular, descanso entre
  series (stepper + `fmtMMSS` + texto "OFF" si `rest===0`), modo de
  arrastre de día, metas nutricionales (toggle + preview automático +
  4 campos manuales con `defaultValue`+`onEndEditing`), enlace a editar
  perfil, pie de versión (usar `Constants.expoConfig.version` de
  `expo-constants`, ya disponible en cualquier proyecto Expo, como
  equivalente RN de `__BUILD__` — o un string estático si no hay acceso
  trivial; documentar la elección) SIN el botón de buscar actualización.

- [x] **Step 3**: Registrar `'settings': Settings` en `SheetHost.js`.
  NO agregar ningún trigger nuevo esta etapa (sin Header/ícono de
  ajustes portado todavía).

- [x] **Step 4: Verificar**

Run: `cd native && npx jest` → 339/339, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 5: Commit**

```bash
cd native && git add src/components/sheets/Settings.js src/components/SheetHost.js && git commit -m "feat(rn): portar sheet Settings (preferencias básicas; color/respaldo/datos-de-prueba diferidos)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5n (339).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que los 4 campos de metas manuales usan `defaultValue`
  + `onEndEditing` (NO `onBlur` sin `nativeEvent.text`, NO `onChange`)
  — aplicando la lección exacta de Etapa 5m.
- [x] Confirmar que ninguna referencia a `theme.js`/`seed.js`/
  `backup.js`/`foodmd.js` quedó a medio portar (ni un import roto ni un
  botón sin acción).
- [x] Confirmar que el toggle de metas (auto/manual) sigue exactamente
  la lógica de `setGoalMode` — incluyendo el caso donde activar "auto"
  sin perfil completo revierte a manual y abre el sheet de perfil en
  su lugar.

### Resultado de la revisión final (opus, commit d1982d4..0cfa37c)

CLEAN — Approved en el primer pase, sin ronda de fix. Dado que las 2
etapas anteriores (5m, 5n) tuvieron bugs Críticos reales, esta revisión
se hizo sin concesiones — y esta vez la lección se aplicó correctamente
desde el principio: los 4 campos de metas manuales usan `defaultValue`
+ `onEndEditing` (con `ev.nativeEvent.text`), cero apariciones de
`onBlur`/`onChange` fuera del comentario explicativo. `setGoalMode`
verificado orden por orden contra el original (revertir el flag →
cerrar sheet → abrir perfil → return, ANTES de llegar a
`applyComputedGoals`). `expo-constants` confirmado genuinamente ausente
del proyecto — el string estático de versión es una elección razonable,
no un import roto. Cero referencias muertas a las 4 libs diferidas
(`theme`/`seed`/`backup`/`foodmd`), cero triggers agregados de más.
jest 339/339, expo-doctor 21/21, bundler limpio.
