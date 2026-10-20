# Importar una rutina pegada + RIR propio y "Fallo" — diseño

Fecha: 2026-10-20. Estado: **diseño aprobado por Enzo, falta que revise este
texto**. Partes 1 y 2 aprobadas el 2026-10-12 (HANDOFF "SESIÓN 2026-10-12
(10)"); parte 3 y el RIR, el 2026-10-20.

Son tres entregas, en este orden, cada una con su PR:

1. **RIR propio por ejercicio + "Fallo" separado de RIR 0** (no depende de la IA)
2. **Lector local + vista previa** (el importador funciona sin internet)
3. **Worker de Cloudflare + Gemini** (completa sólo lo que quedó en ámbar)

---

## Entrega 1 — RIR propio y "Fallo"

### Lo que pidió Enzo

- "Ser flexibles": una rutina puede traer el RIR que el usuario quiera; si
  no trae, la app sigue con su regla (`rirScheme`, exdb.js:97: la última
  serie en 0 y las anteriores subiendo, +1 en ejercicios de espalda baja).
- **RIR 0 no es fallo.** RIR 0: terminás la repetición y sabés que la
  siguiente no sale, no la intentás. Fallo: intentás la siguiente y queda a
  medias. Hoy la app los mezcla (`rirLabel` → "0 (al fallo)", rir.js:30;
  el chip 0 lleva `<small>fallo</small>`, RestTimer.jsx:504).

### Dos RIR distintos (no confundir)

| | Qué es | Dónde se usa |
|---|---|---|
| **Pedido** | El objetivo de la rutina | Sólo se muestra: Rutina.jsx:75, DayPeek.jsx:47, ExInfo.jsx:27, ExerciseCarousel.jsx:750, "pedía…" en RestTimer.jsx:457 (vía session.js:983) |
| **Contestado** | Lo que se elige en el descanso | `set.rpe` → `recoveryPct()` (muscle.ts:393) y recuperacion.js:145 |

El RIR propio cambia **sólo el pedido**. La recuperación sigue saliendo de
lo contestado.

### Modelo de datos

- Ejercicio de rutina: campo opcional `rir`, un array con un valor por
  serie. Cada valor es `0..4` o `'F'` (fallo). Sin `rir` → regla de la app.
- Una sola función decide el pedido: `rirDeEjercicio(ex)` en `rir.js`:
  - sin `ex.rir` → `rirScheme(ex.sets, ex.name)` (lo de hoy, sin cambios);
  - con `ex.rir` y el largo justo → tal cual;
  - más series que valores → se repite el último; menos → se recorta.
    (Pasa si se edita el número de series después de importar.)
- Los cinco lugares de la tabla de arriba pasan a llamar a
  `rirDeEjercicio`. `rirPedido` (rir.js:49) acepta `'F'`.
- Cómo se ve: `RIR 2/2/2/F`. En el descanso: "pedía al fallo" sólo si el
  pedido es `'F'`; un 0 dice "pedía RIR 0".

### La respuesta en el descanso

- Botones: **Fallo · 0 · 1 · 2 · 3 · 4+** (el 0 pierde el "fallo" de abajo).
- "Fallo" guarda `rpe: 10` **y** `fallo: true` en la serie. Se queda en
  `rpe: 10` para que todo lo que ya lee `rpe` siga andando igual (muscle.ts,
  recuperacion.js, historial).
- `recoveryPct`: una serie con `fallo: true` cuenta como esfuerzo 11 en vez
  de 10 → el grupo tarda ~3,2 días en recuperarse en vez de 3. Es la misma
  estimación que ya hace la app, con un escalón más arriba.
- **El historial no se toca.** Una serie vieja con `rpe: 10` se lee "RIR 0":
  no hay forma de saber si fue fallo, y la app no inventa ese dato.

### Editarlo a mano

En ExerciseForm (debajo de "Reps objetivo"): "RIR objetivo", con
**Automático** elegido por defecto. Cómo se elige un RIR propio (uno para
todas las series, o uno por serie) → **lienzo de maquetas** antes de
codificar.

### Tests

`rirDeEjercicio` (sin rir, largo justo, más series, menos series, `'F'`),
`rirPedido` con `'F'`, guardar "Fallo" (rpe 10 + fallo), `recoveryPct` con
y sin fallo, y que una sesión vieja sin `fallo` dé el mismo resultado que hoy.

---

## Entrega 2 — Lector local + vista previa

(Parte 1 del 2026-10-12, sin cambios: entrada en Entreno → Mis rutinas →
"Pegar una rutina"; `lib/importar/lector.js` puro; la actual pasa a Mis
rutinas y la nueva queda activa; nada se guarda sin pasar por la vista
previa.)

Borrador: `{ turnos: [{ nombre, ejercicios: [{ name, sets, reps, rir,
reconocido, original, avisos }] }], semana, dudas }`.

### Qué entiende el lector (parte 3, aprobada el 2026-10-20)

| Texto | Se guarda | Nota |
|---|---|---|
| `4x8`, `4 × 8`, `4 series de 8` | sets 4, reps 8 | |
| `4 × 8-10` | reps **8** | El piso de la doble progresión (`progression.ts`); la vista previa muestra el original |
| `RIR 2` | `rir` = 2 en **todas** las series | Decisión de Enzo |
| `RIR 3-2-1-0` / `3/2/1/0`, tantos números como series | uno por serie | |
| `RIR 1-2` con un número de series distinto de 2 | el **más alto** (2) | Es un rango; el más alto es el más prudente. Se muestra el original |
| `al fallo` | `'F'` en todas | |
| `última al fallo` | regla de la app, con la última en `'F'` | |
| `RPE 8` | RIR 2 (`rirFromRpe`) | |
| Superseries `A1` / `A2` | dos ejercicios seguidos | La app no tiene superseries |
| Nombre fuera del catálogo | **ámbar** | La IA intenta reconocerlo; si tampoco, se elige el grupo en la vista previa (como el asistente) o queda con el nombre tal cual |
| `Día 1 / Lunes / Push:` | un turno | Días nombrados se respetan; "Día 1, 2…" van seguidos con `acomodarDescansos` |

Lo que no entra en ninguna fila se lista en `dudas` y la vista previa lo
muestra; nunca desaparece en silencio.

### Vista previa

Cómo se ve lo ámbar y cómo se corrige → **lienzo de maquetas** (pendiente,
con datos reales de una rutina pegada). Reglas fijas: usar `.group` +
`.grouprow` para la lista de ejercicios y tokens de `styles.css`; verificar a
390 y 430 px.

---

## Entrega 3 — Worker + Gemini

Parte 2 del 2026-10-12, sin cambios: `worker/` en el repo; el pedido a Gemini
está fijo adentro; sólo `Origin` exorplion.github.io y localhost; ~30
lecturas/día y ~10/hora por IP; texto ≤ 6000 caracteres; no se guarda ni se
registra; respuesta validada en el Worker y en la app (series 1–12, reps
1–50, **rir 0–4 o 'F'**); si falla, la vista previa sigue con lo local y
avisa "La IA no está disponible ahora. Corregí a mano lo que quedó en ámbar".

La IA completa **sólo** lo ámbar y lo marca para revisar; lo que el lector
local reconoció gana siempre.

Cuentas: Enzo ya creó la clave de Gemini y la cuenta de Cloudflare
(2026-10-20). Falta, cuando exista `worker/`: `! npx wrangler login` y
`! npx wrangler secret put GEMINI_API_KEY` (los escribe Enzo; la clave nunca
pasa por el chat).

## Repo

Sigue **público** (Enzo, 2026-10-20). La app sigue en GitHub Pages.
