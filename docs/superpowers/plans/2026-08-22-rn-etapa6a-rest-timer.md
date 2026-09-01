# Etapa 6a — timer de descanso real (cuenta regresiva, alarma, notificación local)

Primera sub-etapa de Etapa 6 ("Funciones nativas") del spec de
migración. Continúa sobre el cierre de Etapa 5 (commit `4eb2839`).

## Alcance y contexto

`native/src/lib/rest.js` es hoy un STUB deliberado (`startRest()`/
`stopRest()` no-op), documentado explícitamente desde Etapa 2a como
"pendiente para una etapa futura de funciones nativas". `session.js`
(ya portado) ya llama `startRest()`/`stopRest()` en los lugares
correctos (líneas 414/471/512) — esta etapa sólo reemplaza el cuerpo de
`rest.js`, sin tocar `session.js`.

**Qué hace el timer de descanso en el original (`web/src/lib/rest.js` +
`web/src/lib/alarm.js` + `web/src/lib/notify.js` + `RestTimer.jsx`):**
cuenta regresiva basada en una marca de tiempo absoluta (`T.end`, no en
ticks — para no atrasarse si el navegador congela el `setInterval` en
segundo plano), una pill minimizada + un overlay de pantalla completa
mutuamente excluyentes, alarma sonora sintetizada (WAV generado a mano,
no un archivo) + vibración + notificación del sistema cuando termina,
con un tope de 2 minutos de alarma sonando sola.

## Rulings

**RULING DE ALCANCE — se porta el mecanismo completo de cuenta
regresiva + UI, con la alarma sonora ADAPTADA (no un puerto 1:1 del
sintetizador WAV) y la notificación local vía `expo-notifications`.**

1. **Cuenta regresiva basada en `T.end` (timestamp absoluto)** — se
   porta EXACTO. Es la parte más importante del mecanismo original y no
   depende de ninguna API específica del navegador; en RN el problema
   que resuelve (timers de JS que se pueden retrasar en segundo plano)
   es igual o peor, así que el mismo diseño aplica sin cambios.

2. **Sonido de alarma — se usa `expo-av`'s `Audio.Sound` con un tono
   generado, NO el sintetizador WAV manual del original.** El original
   sintetiza un WAV a mano en `muestrasAlarma()` (ArrayBuffer +
   DataView, cabecera RIFF/WAVE escrita byte a byte) para no depender
   de un archivo de red. En RN esto se resuelve distinto: se instala
   `expo-av` (reproducción de audio) y se genera el mismo patrón de
   pitidos (3 tonos ascendentes, ver `PITIDOS` del original) pero
   usando un enfoque más simple para RN — un archivo de audio corto
   empaquetado como asset local (no depende de red tampoco, es parte
   del bundle) en vez de sintetizar samples PCM a mano. Si no hay un
   asset de sonido de alarma ya en el repo, generar uno reutilizando la
   lógica matemática de `muestrasAlarma()` (adaptada a Node/JS para
   producir el mismo WAV una sola vez, guardarlo como archivo de
   assets) es aceptable — documentar la decisión exacta en el reporte
   de implementación.

3. **Notificación local vía `expo-notifications` — se instala y se usa
   para el aviso de "descanso terminado" cuando la app está en segundo
   plano/bloqueada**, que es exactamente el caso de uso que el spec de
   migración (Etapa 6) menciona explícitamente ("aviso de fin de
   descanso"). Requiere: `npx expo install expo-notifications` (nunca
   `npm install` directo, mismo criterio que toda esta migración),
   configurar el canal de notificación en Android (`setNotificationChannelAsync`,
   requerido en Android 8+), pedir permiso (`requestPermissionsAsync`)
   DESDE un gesto del usuario (al arrancar el descanso, igual que el
   original pide permiso desde `startRest()`), y programar la
   notificación local con `scheduleNotificationAsync` con un `trigger`
   basado en el tiempo restante — NO enviarla inmediatamente, programarla
   para el momento exacto en que el descanso termina, y cancelarla si el
   usuario para/salta el descanso antes de que llegue ese momento
   (`cancelScheduledNotificationAsync`).

4. **`AudioContext`/Web Audio API NO se porta** — es una API exclusiva
   del navegador. `expo-av` reemplaza toda esa capa.

5. **`navigator.mediaSession` NO se porta** — es una API del navegador
   para las teclas de volumen del sistema; no tiene equivalente directo
   necesario en una app nativa (el audio de una app nativa ya se
   integra naturalmente con el sistema de audio del SO sin necesitar
   este API).

6. **El límite de vibración `vibrate([...])` YA está resuelto** —
   `native/src/lib/format.js`'s `vibrate()` ya envuelve `expo-haptics`
   desde Etapa 2a, con la aproximación documentada (patrones largos →
   `notificationAsync`, patrones cortos → `impactAsync`). NO se toca.

7. **`RestTimer.js` (componente UI) se porta con SVG en vez de CSS** —
   mismo patrón que `Silhouette.js`/`BodyMini.js`/`ExInfo.js`: usar
   `react-native-svg` para el anillo de progreso circular (`Circle`
   con `strokeDasharray`/`strokeDashoffset`), CON `<Defs>`/
   `<LinearGradient>` propios DENTRO del mismo `<Svg>` que lo consume
   — la lección de scope de gradiente de Etapa 4a/4b/4c aplica
   exactamente igual acá (el original web reusa `#restGrad` document-
   wide, algo que react-native-svg NO permite).

8. **`RestTimer` se monta SIEMPRE en `App.js`**, como sibling de
   `<Toast/>`/`<SheetHost/>` — igual que el original lo monta siempre
   en `App.jsx` (para que sobreviva a cualquier navegación mientras el
   descanso corre). Es un componente global de la app, no de una
   pantalla.

9. **`recuperarRest()` — el listener de `visibilitychange` del DOM se
   reemplaza por el evento de `AppState` de React Native** (`AppState
   .addEventListener('change', ...)`, disparando cuando la app vuelve a
   primer plano) — mismo propósito: recalcular el tiempo restante contra
   `T.end` al volver a la app, por si los timers de JS se congelaron
   mientras estaba en segundo plano.

Ruling: **`prepararAlarma()`/`callar()`/`sonar()` de `alarm.js` se
consolidan dentro de `rest.js` o un `native/src/lib/alarm.js` propio**
(decidir al implementar cuál da un archivo más legible — probablemente
separado, seguir la misma separación de archivos que el original) —
adaptando la lógica de audio a `expo-av`, pero preservando el resto de
las decisiones de diseño: vibración en loop mientras suena, tope de 2
minutos, `sonar()` idempotente (no arranca dos veces si ya está
sonando), `callar()` idempotente.

Ruling: **NO se implementa el service-worker/notify.js completo del
original** — ese archivo resuelve el problema específico de notificar
desde un Service Worker vs. notificación directa del navegador, un
problema que no existe en RN (no hay service worker). `expo-notifications`
reemplaza toda esa capa con una API mucho más simple.

Ruling: jest SUBE — `rest.js` (la lógica de cuenta regresiva, sin las
partes de efecto de audio/notificación real) es testeable de forma
aislada (mockeando `Date.now()` y verificando `T.leftSec`/`T.pct`
calculados correctamente), mismo patrón que otras libs con estado
mutable ya testeadas en esta migración (`session.js`, `streak.js`).

## Tabla cruzada

| Task A | Task B | A produce | B consume | Hallazgo |
|---|---|---|---|---|
| 1 (alarm.js + expo-notifications/expo-av setup) | 2 (rest.js real) | `sonar/callar/prepararAlarma`, notificaciones programadas | los usa | consistente |
| 2 (rest.js real) | 3 (RestTimer.js) | `T`, `startRest/stopRest/shiftRest/minimizeRest/expandRest` | los lee/llama | consistente |

Orden secuencial: 1, 2, 3 — nunca paralelo (cada task depende de la
anterior).

## Task 1: `alarm.js` + instalación de `expo-notifications`/`expo-av`

**Files:**
- Create: `native/src/lib/alarm.js`
- Modify: `native/package.json`, `native/package-lock.json`
  (`expo-notifications`, `expo-av`)
- Modify: `native/app.json` (canal de notificación Android, permisos
  si `expo-notifications` lo requiere — confirmar al implementar)

- [x] **Step 1**: Leer `web/src/lib/alarm.js` completo (192 líneas,
  TODOS los comentarios — explican las decisiones de diseño clave:
  por qué un `<audio>` real y no sólo Web Audio, por qué se suelta el
  elemento entero al terminar, el tope de 2 minutos) y
  `web/src/lib/notify.js` completo (para entender qué reemplaza
  `expo-notifications`).

- [x] **Step 2**: Instalar `expo-notifications` y `expo-av` (`npx expo
  install`, no `npm install` directo). Configurar el canal de
  notificación Android y cualquier permiso necesario en `app.json`.
  Confirmar con `expo-doctor` que no falta nada.

- [x] **Step 3**: Portar `alarm.js` — adaptar `sonar(texto, alCallar)`/
  `callar()`/`prepararAlarma()`/`pedirPermiso()`/`sonando()` a
  `expo-av`+`expo-notifications`. Preservar: vibración en loop
  (`vibrate([400,200,400,200,400])` repetida cada 2s), tope de 2
  minutos (`TOPE`), idempotencia de `sonar()`/`callar()`. La
  notificación de "Descanso terminado" se dispara al empezar a sonar
  la alarma (no antes) — si la app está en primer plano el usuario ya
  ve/escucha la alarma directamente; documentar si conviene mostrar la
  notificación siempre o sólo cuando `AppState` no es `'active'` (leer
  el comportamiento del original: llama `notificar()` incondicionalmente,
  confiando en que el navegador ya maneja mostrar/no-mostrar
  notificaciones de pestañas visibles — en RN puede que convenga ser
  explícito; decidir y documentar).

- [x] **Step 4: Verificar**

Run: `cd native && npx expo-doctor` → 21/21 (o más, si
`expo-notifications` agrega checks).
Run: `cd native && npx jest` → sin cambios (esta task es principalmente
efectos de audio/notificación, difícil de testear unitariamente —
documentar qué SÍ se puede testear, ej. la construcción del payload de
`scheduleNotificationAsync`, si aplica).
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 5: Commit**

```bash
cd native && git add src/lib/alarm.js package.json package-lock.json app.json && git commit -m "feat(rn): portar alarm.js (audio/notificación de fin de descanso) sobre expo-av + expo-notifications"
```

---

## Task 2: `rest.js` real (reemplaza el stub)

**Files:**
- Modify: `native/src/lib/rest.js` (reemplaza completo el contenido
  stub), `native/src/lib/rest.test.js` (nuevo)

**Interfaces:**
- Consumes: `S, bump` (`state.js`), `vibrate` (`format.js`, ya
  portado), `toast` (`toast.js`), `prepararAlarma, pedirPermiso, sonar,
  callar` (Task 1).
- Produce: `T` (objeto mutable), `startRest, stopRest, shiftRest,
  minimizeRest, expandRest, tickRest, recuperarRest, REST_CIRC` — mismos
  nombres exportados que el original, para que `session.js` (ya
  importa `startRest`/`stopRest`) siga funcionando sin tocar sus
  imports.

- [x] **Step 1**: Leer `web/src/lib/rest.js` completo (135 líneas) —
  ya leído en el análisis de esta etapa, releer con foco en el timing
  exacto (`T.end`, `setInterval(tickRest, 250)`).

- [x] **Step 2**: Portar `rest.js` verbatim en su lógica de cuenta
  regresiva (`T`, `startRest`, `shiftRest`, `minimizeRest`,
  `expandRest`, `tickRest`, `terminar`, `stopRest`) — reemplazando
  `document.addEventListener('visibilitychange', ...)` por
  `AppState.addEventListener('change', handler)` de React Native (ver
  ruling 9) para `recuperarRest()`.

- [x] **Step 3**: Tests para la lógica de cuenta regresiva pura —
  mockear `Date.now()`, verificar que `startRest(90)` deja `T.total=90`
  `T.end` correcto, que `tickRest()` calcula `leftSec`/`pct` bien, que
  `shiftRest(-9999)` respeta el piso de 5 segundos, que `shiftRest(+N)`
  sube `T.total` si corresponde. No testear los efectos reales de
  audio/vibración/notificación (son I/O nativo, no lógica pura) — sólo
  que se llaman (mock de los imports de Task 1).

- [x] **Step 4: Verificar**

Run: `cd native && npx jest` → sube de 339 (reportar número).
Run: `cd native && npx expo-doctor` → sin errores.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 5: Commit**

```bash
cd native && git add src/lib/rest.js src/lib/rest.test.js && git commit -m "feat(rn): portar rest.js (timer de descanso real, reemplaza el stub de Etapa 2a)"
```

---

## Task 3: `RestTimer.js` (componente UI) + montaje en `App.js`

**Files:**
- Create: `native/src/components/RestTimer.js`
- Modify: `native/App.js` (montar `<RestTimer/>` siempre, sibling de
  `<Toast/>`/`<SheetHost/>`)

**Interfaces:**
- Consumes: `T, minimizeRest, expandRest, stopRest, shiftRest,
  REST_CIRC` (Task 2), `useStore` (`state.js`), `fmtMMSS` (`format.js`).

- [x] **Step 1**: Leer `web/src/components/RestTimer.jsx` completo
  (119 líneas, TODOS los comentarios — especialmente el de
  `stopPropagation()`/`role="button"` sobre por qué la pill entera es
  tappable pero tiene botones internos).

- [x] **Step 2**: Portar `RestTimer` a `native/src/components/RestTimer.js`
  usando `react-native-svg` para el anillo (`<Defs>` propio dentro del
  mismo `<Svg>`, ver ruling 7) — pill minimizada (mostrada cuando
  `T.state === 'minimized'`) y overlay de pantalla completa (mostrado
  cuando `T.state === 'fullscreen'` o sonando), mutuamente excluyentes,
  con los botones −30s/+30s/Saltar/minimizar, y el estado "sonando"
  (un solo botón "PARAR" grande).

- [x] **Step 3**: Montar `<RestTimer/>` en `App.js`, siempre presente
  (no condicionado a ninguna pantalla), junto a `<Toast/>`/
  `<SheetHost/>`.

- [x] **Step 4: Verificar**

Run: `cd native && npx jest` → sin cambios respecto a Task 2.
Run: `cd native && npx expo-doctor` → sin errores.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 5: Commit**

```bash
cd native && git add src/components/RestTimer.js App.js && git commit -m "feat(rn): portar RestTimer (UI de descanso: pill minimizada + overlay de pantalla completa)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — reportar número final.
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que `RestTimer` usa `<Defs>` propios dentro de su
  propio `<Svg>` (no compartidos con ningún otro componente) — mismo
  grep que atrapó el bug de Etapa 4a.
- [x] Confirmar que la notificación local se PROGRAMA para el momento
  exacto de fin de descanso (no se dispara inmediatamente) y se
  CANCELA si el usuario para/salta el descanso antes de que llegue ese
  momento — probar mentalmente el flujo: iniciar descanso de 90s,
  saltar a los 10s, confirmar que no debería sonar una notificación a
  los 90s de todos modos.
- [x] Confirmar que `session.js` sigue importando `startRest`/`stopRest`
  de `rest.js` sin cambios en sus imports (la interfaz pública no
  cambió de forma).
- [x] Confirmar que `recuperarRest()` usa `AppState` de RN, no ningún
  listener del DOM que no exista en este entorno.

### Resultado de la revisión final + 2 rondas de fix

Primera revisión (opus, commits d3f2da9..0643f0a): 0 Críticos, 3
Important, 6 Menores. Los 3 Important: race condition en `sonar()` que
podía dejar la alarma sonando 2 minutos sin ningún botón para pararla
(fix: re-chequeo del flag `sonando` después de cada `await`), la
notificación se disparaba de inmediato en vez de programarse para el
momento exacto de fin de descanso (justo el caso de uso que pedía la
ruling — sin esto, la app en segundo plano nunca la mostraba), y una
fuga de timers reales en `session-live.test.js`/`session.test.js` ahora
que `rest.js` dejó de ser un stub. Fix wave 1 (commit `5aa2d53`) corrigió
los 3 + los 6 menores.

**Re-revisión de esa primera ronda encontró un bug Crítico NUEVO**: el
objeto `trigger` de la notificación programada le faltaba el campo
`type` requerido por `expo-notifications` — en Android disparaba de
inmediato (ignorando los segundos, el mismo bug que se acababa de
corregir) y en iOS nunca se programaba (excepción silenciada por un
`catch{}` vacío). Verificado leyendo el código fuente real de la
librería instalada, no asumido. Fix wave 2 (commit `91f99b9`) agregó
`type: SchedulableTriggerInputTypes.TIME_INTERVAL` y un test nuevo que
importa `alarm.js` real (no mockeado) y verifica los argumentos reales
pasados a `scheduleNotificationAsync` — probado por mutación: quitar el
campo `type` hace fallar el test, confirmando que sí habría atrapado el
bug original.

Segunda re-revisión: TODO resuelto, verificado de forma independiente
trazando el parser real de `expo-notifications` (no repitiendo el
análisis de la revisión anterior). jest 352/352, expo-doctor 21/21,
bundler limpio. 2 notas advisory no bloqueantes quedaron registradas:
el mock de `expo-av` en `jest.setup.js` no tiene `unloadAsync` (nada lo
ejercita hoy, pero el primer test que toque `callar()` real fallaría) y
`stopRest()` llama `cancelScheduledNotification()` dos veces
efectivamente (inofensivo, código muerto menor).
