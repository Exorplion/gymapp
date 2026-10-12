# Turnos universales — Fase 1 (modelo y reconciliación): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Cada task es TDD (test → falla → implementar → pasa → commit). Commitear después de cada task verde: los agentes se cortan por límite de uso.

**Goal:** que "Posterior" exista una sola vez. La secuencia sigue siendo de slots (ids, `seqIndex` y sesiones viejas siguen valiendo), cada fila de `routine` lleva además `turnoId`, `turnoFirma` y una copia completa de `name`/`exercises` (la versión vieja de la app sigue leyendo una rutina válida), y el editor actual —que edita por índice— ya edita el turno compartido.

**Spec:** `docs/superpowers/specs/2026-10-12-turnos-universales-y-fuera-de-plan-design.md`, secciones 1, 2 y 7 "Fase 1". Fases 2–4 NO entran.

**La restricción número uno es no perder datos.** Ante la duda: la opción que conserva más, y anotarla.

## Verificación de la spec contra el código (2026-10-12)

| Referencia de la spec | Código real | Qué cambia en el plan |
|---|---|---|
| `norm` (`format.js`) "sin espacios de más" | `format.ts:31` hace trim + minúsculas + sin tildes, **no** colapsa espacios internos | `claveNombre(n) = norm(n).replace(/\s+/g, ' ')` en `lib/turnos.js` |
| `idb` sólo de un store (`db.js:84-99`) | correcto | `idb.tx(stores, fn)` nuevo |
| `persistAll` `rutina-logic.js:427-430`: `clear()` + N `put` en transacciones separadas | correcto (y `applyDays`/`startBlank` además hacen su propio `clear` antes) | todo pasa por un `persistAll` atómico |
| store `routine` | keyPath es **`order`** (`db.js:41`), no `id` | las filas se escriben enteras por `order`; `persistAll` limpia y reescribe en la misma transacción |
| `importJSON` (`backup.js:124-134`) | también hace `clear` + `put` separados por store | la rutina y `settings.turnos` se importan en una sola transacción |
| `turnosDeEjercicio` `entreno.js:146`, `opcionesDescanso` `descansoHoy.js:17`, `minutosDe` `Inicio.jsx:41` | correctos | — |
| `toggleUnilateral`/`setBarra` (`session.js:55`, `:87`) | llaman `persistSlot(slotIndex)` | se arreglan solos: `persistSlot` delega en `persistTurno` |

## Decisiones de diseño (las que la spec deja abiertas)

1. **Hidratación = propiedades de acceso, como pide la spec (Enfoque A).** `vincular(slot, turno)` define `name` y `exercises` como get/set **enumerables y configurables** que leen y escriben el objeto turno. Se verificó en Node que `structuredClone`, `JSON.stringify` y `{...slot}` invocan los getters (salen datos planos). Alternativa descartada: arrays compartidos (Enfoque B) — las seis reasignaciones `x.exercises = nuevo` rompen el vínculo en silencio.
2. **Tres modos, explícitos:**
   - `S.turnos === null` → **modo viejo**: nada se vincula, `persistSlot` escribe la fila tal cual (como hoy). Es el estado si la migración está postergada (borrador abierto, primera vez) o si la transacción falló.
   - `S.turnos` array y sin pendientes → **modo turnos**.
   - `S.turnos` array con filas `sinVincular` (ids de slot) → **postergado con turnos**: borrador abierto y hay filas inconsistentes (editadas por una versión vieja o sin `turnoId`). Esas filas quedan planas y se guardan planas, con su firma vieja: el próximo arranque las reconoce como editadas. Las consistentes se vinculan ("se hidrata lo que haya").
3. **`persistTurno` escribe sólo filas vinculadas.** Una fila plana con `turnoId` (pendiente) jamás se pisa con el contenido del turno: sería borrar la edición de la versión vieja.
4. **Firma** = hash FNV-1a de un JSON canónico (claves ordenadas, sin `undefined`) de `{ name, exercises }` **sin los `id` de los ejercicios**: `applyDays` le da ids nuevos a cada copia, así que dos copias de la plantilla son "idénticas" aunque sus ids difieran (si no, toda rutina hecha con la plantilla generaría un respaldo y un aviso falsos).
5. **Fila consistente** = `turnoId` existe en los turnos guardados **y** `firma(copia) === firma(turno guardado)` **y** (`turnoFirma` ausente o igual a `firma(copia)`). Comparar contra el turno guardado además de la firma cubre el caso de una versión vieja que importó un backup v3.
6. **Agrupar** (reconciliación): fila con `turnoId` válido → grupo de ese turno (aunque esté editada); sin nombre → sola; con nombre → por `claveNombre`, y si ya hay un turno *con filas* que se llama igual, se une a él. Un turno guardado que ya no nombra ninguna fila **se conserva** (huérfano): no se adopta por nombre ni se borra (Fase 2 lo mostrará como "no está en tu semana").
7. **Ganador:** la primera fila editada por `order`; si no hay, la primera fila consistente (el contenido establecido del turno); si no hay, la primera por `order` (regla de Enzo).
8. **"Distinta"** = `firma(copia descartada) !== firma(ganadora)`. Sólo entonces: respaldo en `S.lib` (al principio), y aviso.
9. **Aviso** = `S.cfg.avisoTurnos = { fecha, grupos:[{ nombre, versiones, gano:'primera'|'editada' }], respaldo }`, escrito en la misma transacción. App lo abre al arrancar (hoja diálogo `aviso-turnos`) y lo borra al abrirla: sale una vez. **Texto:** no dice "quedó la del martes" como el ejemplo de la spec, porque el día sale de una proyección (`weekdayProjection`) y la app no afirma lo que no sabe: dice "quedó la primera de tu semana" (o "la que cambiaste último").
10. **`applyDays`** reemplaza `S.turnos` entero (igual que hoy reemplaza el split, con confirmación). `startBlank` también. `removeSlot`/`removeWorkoutDay` dejan el turno huérfano (se conserva).
11. **Recorrer turnos al mutar:** helper `porTurno(fn)` (rutina-logic) que visita una vez cada turno vinculado y una vez cada slot plano. Lo usan `applyDeload`, `endDeload` y los loops de `gyms.js`.
12. **Historial de deshacer** guarda `{ routine, turnos }` clonados; restaurar → `hidratar()` → `persistAll()`.
13. **Fuera de Fase 1, anotado:** `S.hoyOrder` sigue por `slotId` (en memoria); los lectores de `turnoDeSesion` de la sección 4 (sesiones fuera del plan) van en Fase 3; `CopyExercises` sólo deja de ofrecer el mismo turno (la lista "por turno" completa es Fase 2).

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `web/src/lib/db.js` | `idb.tx(stores, fn)` — una transacción readwrite sobre varios stores; `fn` es síncrona; si tira, aborta. |
| `web/src/lib/turnos.js` (nuevo) | Puro + E/S de arranque: `claveNombre`, `firma`, `claveTurno`, `claveDeSesion`, `snapshotDeFilas`, `planReconciliacion`, `vincular`, `esVinculado`, `hidratar`, `filaDe`, `reconciliarTurnos`, `sinVincular`. No importa `state.js` (recibe el estado). |
| `web/src/lib/state.js` | `S.turnos`; `loadAll` lee `settings.turnos` y llama `reconciliarTurnos(S, …)` antes de `resolveAutoRest`; comentario de las propiedades de acceso. |
| `web/src/lib/rutina-logic.js` | `persistTurno`, `persistSlot` (envoltorio), `persistAll` atómico, `porTurno`, `turnoDe`, `turnoDeSesion`; `applyDays` agrupa; deload por turno; historial con turnos; `daySessions`/`routineStability`/`copyExercises` por turno; `routineSnapshot` usa `snapshotDeFilas`. |
| `web/src/lib/gyms.js` | `setActiveGym`/`reaplicar` recorren turnos. |
| `web/src/lib/session.js` | `turnoId` en el borrador, en la sesión cerrada y en la retroactiva. |
| `web/src/lib/entreno.js`, `descansoHoy.js`, `components/screens/Inicio.jsx` | lectores por turno. |
| `web/src/components/sheets/CopyExercises.jsx` | no ofrece el mismo turno como origen/destino. |
| `web/src/lib/backup.js` | export v3 (`turnos`, filas con firma); import atómico de rutina + `turnos` (borra la clave si el archivo no la trae). |
| `web/src/components/sheets/AvisoTurnos.jsx` (nuevo) + `App.jsx` | la hoja del aviso (diálogo, patrones de `SalirPrueba`), y abrirla una vez al arrancar. |
| `web/src/lib/__tests__/turnos-*.test.js` (nuevos) | tests de la Fase 1. |

---

## Task 1 — `idb.tx`
- [ ] Test `__tests__/turnos-idb-tx.test.js` (fake-indexeddb real): escribe en `routine` y `settings` en una transacción; si `fn` tira, no queda nada escrito y la promesa rechaza; si un `put` tira `QuotaExceededError` (spy sobre `IDBObjectStore.prototype.put`), rechaza y no queda nada.
- [ ] Implementar `idb.tx` en `db.js` (oncomplete/onerror/onabort como las otras escrituras).
- [ ] Commit `feat(db): idb.tx — una transacción sobre varios stores`.

## Task 2 — núcleo puro de turnos
- [ ] Test `__tests__/turnos-plan.test.js`: `claveNombre`, `firma` (ignora ids de ejercicio, orden de claves, `undefined`), `planReconciliacion`:
  copias idénticas → 1 turno, `distintas` vacío · copias distintas → gana `order` menor, `distintas` con el nombre · "Anterior A"/"Anterior B" → 2 turnos · sin nombre → nunca se agrupa · filas consistentes → `null` (idempotente) · fila con firma cambiada → gana aunque sea la segunda · fila sin `turnoId` con el mismo nombre que un turno con filas → se une, gana el turno establecido · turno guardado huérfano → se conserva · `turnoId` del ganador se reusa · descansos intactos, ids de slot intactos.
- [ ] Implementar `lib/turnos.js` (parte pura).
- [ ] Commit.

## Task 3 — hidratación
- [ ] Test `__tests__/turnos-hidratar.test.js`: `vincular` → dos slots del mismo turno comparten `exercises` (mismo array), `slot.exercises = x` y `slot.name = y` caen en el turno, `structuredClone`/JSON/spread dan datos planos, `filaDe` da fila completa con `turnoFirma`; `hidratar` con `S.turnos = null` no toca nada; respeta `sinVincular`; adopta un slot de entrenamiento sin `turnoId` creando un turno.
- [ ] Implementar `vincular`, `esVinculado`, `hidratar`, `filaDe`; `S.turnos: null` en `state.js` con el comentario de las propiedades de acceso.
- [ ] Commit.

## Task 4 — `reconciliarTurnos` en `loadAll`
- [ ] Test `__tests__/turnos-reconciliar.test.js` (fake-indexeddb + `loadAll` real): primera migración con copias distintas → filas con `turnoId`+firma+copia, `settings.turnos`, `rutinaAntesDeTurnos` crudo, respaldo al principio de `S.lib` con TODAS las copias, `cfg.avisoTurnos` y `cfg.turnosMigrados`; copias idénticas → sin respaldo ni aviso; borrador abierto → no escribe nada, modo viejo; segunda carga → `idb.tx` no se llama (no-op); `QuotaExceededError` en la transacción → la base queda byte a byte igual y la app abre en modo viejo con la rutina de antes; `seqIndex` e ids de slot sin cambios; fila editada por "la versión vieja" (escrita a mano en la base) → gana y la anterior va al respaldo.
- [ ] Implementar `reconciliarTurnos(S, { guardados, hayCrudo, hoy })` y llamarlo en `loadAll` dentro de try/catch.
- [ ] Commit.

## Task 5 — guardar el turno entero
- [ ] Test `__tests__/turnos-persistir.test.js` (fake-indexeddb): después de migrar, `saveExercise(4, …)` (API vieja por índice) cambia el slot 1 en memoria, y tras "recargar" (`loadAll` de nuevo) las dos filas leídas **crudas** (como la versión vieja) tienen `name`/`exercises` completos e iguales al turno; `persistAll` es una sola transacción (si aborta, la rutina guardada queda como estaba); `deleteExercise`/`moveEx`/`saveSlot` (renombra las dos apariciones) quedan vinculados.
- [ ] Implementar `persistTurno`, `persistSlot` (vinculado → `persistTurno`; plano → `put` de la fila), `persistAll` atómico (llama `hidratar` primero), `turnoDe`, `turnoDeSesion`, `porTurno`. Sacar los `idb.clear('routine')` sueltos de `applyDays`/`startBlank`.
- [ ] Ajustar mocks de `db.js` en tests existentes que ahora necesiten `tx`.
- [ ] Commit.

## Task 6 — plantillas, vaciar y deshacer
- [ ] Test: `applyDays` con A·P·R·A·P·R·R → 2 turnos, 4 slots vinculados de a pares; `S.lib` intacta; `undoRutina` tras editar Posterior vuelve en las dos apariciones y siguen vinculadas; `redoRutina` igual; `applyWorkoutOrder` sobre A·P·R·A·P·R·R da A·R·P·R·A·R·P (confirma la nota de la spec); `startBlank` deja `S.turnos = []`.
- [ ] Implementar.
- [ ] Commit.

## Task 7 — lo que muta recorre turnos
- [ ] Test: `applyDeload(['Pierna'])` con un turno que aparece dos veces → cada ejercicio baja una vez (4→2, no 4→2→1), `antes` = 4; `endDeload` lo devuelve a 4 en las dos apariciones. `setActiveGym` escribe una vez por turno.
- [ ] Implementar `porTurno` en `applyDeload`/`endDeload` y en `gyms.js`.
- [ ] Commit.

## Task 8 — sesiones y lectores por turno
- [ ] Test: `startSession` guarda `turnoId` en el borrador; `completeSession` y `registrarDiaEntrenado` en la sesión; `turnoDeSesion` (por `turnoId`, por `slotId`, `null`); `ultimaVezDeTurno`/`minutosDeTurno` de la segunda aparición ven la sesión de la primera (y la sesión vieja sin `turnoId`); `daySessions`/`routineStability` por turno; `opcionesDescanso` en A·P·R·A·P·R·R lista 2 opciones, la primera la que sigue; `turnosDeEjercicio` sin repetidos; `copyExercises` entre dos apariciones → `same`. En modo viejo (slots sin `turnoId`) todo se comporta como antes.
- [ ] Implementar `claveTurno`/`claveDeSesion` en los lectores; `Inicio.jsx` usa `minutosDeTurno`; `CopyExercises.jsx` filtra el mismo turno.
- [ ] Commit.

## Task 9 — respaldo v3
- [ ] Test: `exportJSON` lleva `version: 3`, `turnos` y filas con firma; `importJSON` de un v3 escribe la clave `turnos` en la misma transacción que la rutina; de un v2 (sin `turnos`) la borra, y al recargar `reconciliarTurnos` unifica.
- [ ] Implementar.
- [ ] Commit.

## Task 10 — el aviso
- [ ] Test: `textoAvisoTurnos(aviso)` (puro) para uno y para varios turnos, "primera"/"editada"; `abrirAvisoTurnos()` abre la hoja y borra `cfg.avisoTurnos` (una sola vez).
- [ ] Implementar `AvisoTurnos.jsx` (diálogo: `h2`, `.txt-mut`, `btn ok` "Descargar respaldo" → `exportJSON()`, `.dlg-fila` con "Ver en Mis rutinas" y "Entendido"), `DIALOGOS` + `SheetContent` + arranque en `App.jsx`.
- [ ] Commit.

## Task 11 — suite completa y lint
- [ ] `npx vitest run` verde; `npm run lint` sin advertencias nuevas en archivos tocados.

## Task 12 — Chrome: viejo → nuevo → viejo
- [ ] Build de `origin/main` servido en :4191 → plantilla Anterior/Posterior, editar un Posterior; build nuevo en el mismo puerto (SW fuera, caches limpias) → un turno por nombre, aviso una vez, respaldo en Mis rutinas, editar Posterior un día se ve el otro tras recargar, descanso lista cada turno una vez; build viejo de nuevo → rutina completa, se puede empezar una sesión.

## Task 13 — HANDOFF
- [ ] Entrada arriba de todo: qué cambió (archivo:línea), decisiones, qué se verificó y qué no, próximo paso exacto (Fase 2).
