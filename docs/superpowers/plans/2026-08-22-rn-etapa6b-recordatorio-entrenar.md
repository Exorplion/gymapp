# Etapa 6b — recordatorio diario de entrenar (función nueva, sin equivalente en la web)

Segunda sub-etapa de Etapa 6 ("Funciones nativas"). Continúa sobre el
cierre de Etapa 6a (commit `4eb0d2d`).

## Contexto y decisión de alcance

**A diferencia de TODA etapa anterior de esta migración, esto NO es un
porteo.** El spec de migración pide "notificaciones push (recordatorio
de entrenar...)" para Etapa 6, pero la app web original (`web/src/`) no
tiene ningún recordatorio de entrenamiento — no hay `lib/reminder.js`,
ni lógica equivalente en ningún lado (grep confirmado). Es función
nueva que sólo tiene sentido en una app nativa (notificaciones locales
reales, no las notificaciones de PWA limitadas del original).

**Decisión de producto (confirmada por Enzo):** recordatorio simple —
notificación local diaria a una hora configurable, SOLO si hay un turno
de rutina pendiente sin entrenar hoy. Sin sensores (el spec ya los
marca como condicionales/opcionales, y no hay caso de uso claro en una
app de registro manual de series — no hay tracking automático de
movimiento en ningún lado del original).

## Diseño

**Cuándo se dispara:** una notificación local reprogramada cada día a
una hora fija configurable (default razonable: 18:00, ajustable en
Ajustes), que SOLO aparece si `pendingSlot()` (ya portado en
`session.js`) devuelve un turno que no sea de descanso Y no haya una
sesión ya registrada para ese turno hoy (`sessionForSlot`, ya portado).
Si el usuario ya entrenó o el turno de hoy es descanso, la notificación
programada para ese día se cancela/no se dispara (ver mecanismo abajo).

**Mecanismo de reprogramación diaria — el problema real a resolver:**
`expo-notifications` puede programar notificaciones repetidas
(`trigger: {hour, minute, repeats: true}`), pero eso dispararía TODOS
los días sin importar si hay algo pendiente. Como la condición
("¿hay un turno pendiente hoy?") depende del estado de la app en el
momento del disparo, no se puede resolver con un trigger estático de
`expo-notifications` solo — se necesita reprogramar la notificación de
MAÑANA cada vez que la app se abre (o cada vez que cambia el estado
relevante: se completa una sesión, cambia la rutina, cambia la hora
configurada), calculando en ese momento si el turno de mañana amerita
recordatorio.

Ruling: **la app reprograma la notificación del día siguiente en cada
arranque** (`App.js`, en el mismo efecto donde ya corre `loadAll()`) Y
cada vez que se completa una sesión (`completeSession()` en
`session.js` ya avanza `S.cfg.seqIndex` — agregar la reprogramación ahí
mismo, sin bloquear el flujo). Esto es una aproximación razonable, no
perfecta (si la app no se abre en varios días, el recordatorio programado
puede quedar desactualizado) — documentado como limitación conocida,
aceptable para una v1 de esta función.

Ruling: **el permiso de notificaciones ya se pide en Etapa 6a**
(`pedirPermiso()` en `alarm.js`, disparado al arrancar un descanso) —
esta etapa NO duplica esa lógica de permiso, reusa el mismo canal de
notificación de Android si aplica, o crea uno nuevo con nombre propio
("Recordatorios") si conviene separarlo del canal de descanso
(`'descanso'`) para que el usuario pueda silenciar uno sin el otro —
decidir al implementar y documentar.

Ruling: **el ajuste de hora vive en `S.cfg.reminderHour`/
`S.cfg.reminderEnabled`** (nuevos campos en `cfg`, con default
`reminderHour: 18, reminderEnabled: true`) — siguiendo el mismo patrón
que `S.cfg.rest`/`S.cfg.dayDrop`/etc. ya establecido. Se agrega un
control en `Settings.js` (Etapa 5o, ya portado) para activar/desactivar
y elegir la hora — un nuevo `TextInput`/selector simple, NO un time-
picker nativo complejo (evitar instalar una librería nueva sólo para
esto — un stepper de horas enteras, mismo patrón que el stepper de
descanso, es suficiente).

Ruling: **`native/src/lib/reminder.js` es el archivo nuevo** — expone
`scheduleTomorrowReminder()` (calcula si mañana amerita recordatorio y
programa/cancela según corresponda) y `cancelReminder()`. No hay
archivo web equivalente que portar — se documenta esto explícitamente
en el header del archivo (a diferencia de todo archivo anterior de esta
migración, que siempre cita "Puerto de web/...").

Ruling: jest sube — la lógica de "¿amerita recordatorio mañana?" (qué
turno cae mañana según `S.cfg.seqIndex`+1, si es descanso, etc.) es
testeable de forma aislada mockeando `Notifications`.

## Tabla cruzada

| Task A | Task B | A produce | B consume | Hallazgo |
|---|---|---|---|---|
| 1 (reminder.js) | 2 (Settings.js + App.js + session.js wiring) | `scheduleTomorrowReminder/cancelReminder` | los llama | consistente |

## Task 1: `reminder.js`

**Files:**
- Create: `native/src/lib/reminder.js`, `native/src/lib/reminder.test.js`

**Interfaces:**
- Consumes: `S` (`state.js`), `pendingSlot, sessionForSlot`
  (`session.js`, ya portados), `dstr` (`format.js`).
- Produce (nuevo): `Notifications.scheduleNotificationAsync`/
  `cancelScheduledNotificationAsync` de `expo-notifications` (ya
  instalado en Etapa 6a).

- [x] **Step 1**: Confirmar con grep que no hay ningún archivo web
  equivalente (`reminder`/`recordatorio` en `web/src`) — documentarlo
  en el header del archivo nuevo.

- [x] **Step 2**: Implementar `scheduleTomorrowReminder()` — calcula el
  turno de MAÑANA (el índice siguiente al actual en `S.routine`, con
  wraparound), determina si amerita recordatorio (turno no es de
  descanso Y no hay ya una sesión registrada para esa fecha), y si
  `S.cfg.reminderEnabled` es true, programa una notificación local para
  mañana a `S.cfg.reminderHour`:00 con `Notifications.scheduleNotificationAsync`
  (trigger de tipo fecha/hora específica, NO repetido — se reprograma
  día a día). Si no amerita (descanso, ya entrenado, o
  `reminderEnabled` false), cancela cualquier recordatorio ya programado
  en su lugar. Guarda el id de la notificación programada para poder
  cancelarla.

- [x] **Step 3**: Implementar `cancelReminder()` — cancela la
  notificación programada si existe, no-op si no hay ninguna.

- [x] **Step 4**: Tests — mockear `expo-notifications`, cubrir: turno de
  mañana es descanso → no programa; turno de mañana ya tiene sesión
  registrada → no programa; turno pendiente sin sesión →
  programa con la hora correcta; `reminderEnabled: false` → nunca
  programa nada.

- [x] **Step 5: Verificar**

Run: `cd native && npx jest` → sube (reportar número).
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 6: Commit**

```bash
cd native && git add src/lib/reminder.js src/lib/reminder.test.js && git commit -m "feat(rn): agregar reminder.js (recordatorio diario de entrenar, función nueva sin equivalente web)"
```

---

## Task 2: conectar `reminder.js` (Ajustes + arranque + fin de sesión)

**Files:**
- Modify: `native/src/lib/state.js` (agregar `reminderHour`/
  `reminderEnabled` a `S.cfg` con sus defaults)
- Modify: `native/App.js` (llamar `scheduleTomorrowReminder()` al
  arrancar, después de `loadAll()`)
- Modify: `native/src/lib/session.js` (llamar
  `scheduleTomorrowReminder()` al completar una sesión — buscar dónde
  ya avanza `seqIndex`)
- Modify: `native/src/components/sheets/Settings.js` (agregar el
  control de activar/desactivar + hora)

- [x] **Step 1**: Agregar `reminderHour: 18, reminderEnabled: true` a
  los defaults de `S.cfg` en `state.js`.

- [x] **Step 2**: Llamar `scheduleTomorrowReminder()` en `App.js` tras
  `loadAll()` (una vez, al arrancar).

- [x] **Step 3**: Llamar `scheduleTomorrowReminder()` en el punto donde
  `session.js` completa una sesión y avanza `seqIndex` (no bloquear el
  flujo si falla — envolver en try/catch silencioso, mismo criterio que
  el resto de esta migración con efectos secundarios no críticos).

- [x] **Step 4**: Agregar a `Settings.js` un toggle
  (activar/desactivar) + stepper de hora (mismo patrón que el stepper
  de descanso ya portado), llamando `scheduleTomorrowReminder()` tras
  cualquier cambio para que el ajuste tenga efecto inmediato.

- [x] **Step 5: Verificar**

Run: `cd native && npx jest` → sin cambios respecto a Task 1.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 6: Commit**

```bash
cd native && git add src/lib/state.js App.js src/lib/session.js src/components/sheets/Settings.js && git commit -m "feat(rn): conectar recordatorio diario (Ajustes + arranque + fin de sesión)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — reportar número final.
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que la notificación de mañana se CANCELA correctamente
  si el usuario entrena hoy (no debería sonar un recordatorio para un
  turno ya completado).
- [x] Confirmar que desactivar `reminderEnabled` cancela cualquier
  recordatorio ya programado, no sólo detiene programar nuevos.
- [x] Confirmar que el trigger de notificación usado pasa el parser
  real de `expo-notifications` instalado (misma clase de bug que costó
  2 rondas de fix en Etapa 6a — verificar el objeto `trigger` contra el
  código fuente de la librería, no asumir el formato).

### Resultado de la revisión final (opus, commits 4eb0d2d..3435b20) + fix

El chequeo más importante — el objeto `trigger` de tipo `DATE`, distinto
al `TIME_INTERVAL` de Etapa 6a — se verificó COMPLETAMENTE correcto
desde el primer pase, trazando el parser real de `expo-notifications`
instalado y probando por mutación que el test lo detectaría (comentar
el campo `type` hace fallar el test). Ningún hallazgo de esa clase esta
vez.

Se encontró 1 Important real: el id de la notificación programada se
guardaba sólo en memoria del proceso (`R.scheduledNotifId`), que se
reinicia en cada arranque de la app. Como `App.js` reprograma en cada
arranque, esto creaba notificaciones DUPLICADAS entre reinicios (cada
llamada generaba un id nuevo en vez de reemplazar la anterior), y
desactivar el recordatorio o cambiar la hora después de un reinicio no
cancelaba la notificación huérfana de la sesión anterior — violando
directamente el propio checklist de esta etapa. Fix: usar un
`identifier` ESTABLE (string fijo, no generado) en
`scheduleNotificationAsync` — verificado leyendo el código fuente de la
librería que un `identifier` explícito reemplaza cualquier notificación
pendiente con el mismo id, en vez de crear una nueva, y que cancelar un
id inexistente es un no-op seguro. `cancelReminder()` pasó a cancelar
incondicionalmente con ese mismo id fijo, eliminando el estado en
memoria por completo. Re-revisión trazó el escenario completo de
reinicio (programar → matar la app → reprogramar → confirmar que
reemplaza, no duplica) y confirmó resuelto. jest 358/358, expo-doctor
21/21, bundler limpio — verificado de forma independiente en cada paso.
