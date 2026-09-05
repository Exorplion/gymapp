# Plan de reformulación de FIERRO

**Fecha:** 2026-09-05
**Origen:** `AppDesign.jpeg` (framework del curso "How to Build Mobile Apps with
Claude Code", 2026) + auditoría del código real de FIERRO.

> **Nota de honestidad sobre la fuente:** la transcripción literal del video NO se
> pudo obtener (YouTube no la sirve por fetch; el extractor devolvió 403). Lo que sí
> está confirmado por dos fuentes independientes + el propio diagrama de la imagen es
> el **framework de 5 pasos**. Si el video dice algo específico fuera del diagrama,
> no está incorporado acá.

---

## El framework (lo que dice la imagen)

```
Raw idea
  → CORE FUNCTION      "Define the ONE thing"
                        filtro: ¿lo podés decir en UNA frase? Si no, PARÁ.
  → CORE LOOP          "Map action→reward cycle, under 30 seconds"
                        filtro: ¿es repetible?
  → ACCESSORY FEATURES "Add only what supports the loop"
                        filtro: ¿sirve al loop? Si no, CORTALO.
  → SURFACE AREA CHECK "Count screens: max 5-7"
                        filtro: ¿más de 7? RECORTÁ.
  → RETENTION HOOK     "Create unfinished state"
  → Shippable MVP
```

El framework es **un embudo con frenos**: cada paso tiene una pregunta que te
manda a parar o a recortar. FIERRO se construyó en el orden inverso — features
primero, loop después — y eso es exactamente lo que la auditoría encuentra.

---

## Diagnóstico: dónde estamos parados

| Paso | Veredicto | Resumen |
| --- | --- | --- |
| Core Function | **NO CUMPLE** | Son dos productos cosidos por la barra de pestañas |
| Core Loop | **A MEDIAS** | El de entreno es excelente; el de comida no; y estaba **roto** |
| Accessory Features | **NO CUMPLE** | El peso muerto se paga *dentro* del loop |
| Surface Area | **NO CUMPLE** | 35 superficies contra un techo de 7 (5×) |
| Retention Hook | **A MEDIAS** | Sólo hook intra-sesión; cero razón para volver mañana |

### 1. Core Function — no hay una frase

No hay una cosa; hay dos. Entrenamiento ocupa 3 de 5 pestañas
(`state.js:162`), nutrición 1. Y casi no se tocan: el **único** puente real en
todo el código es `postWorkoutProteinPending()` (`Nutricion.jsx:56-69`), que es
texto informativo, no accionable.

Los modelos de datos son disjuntos (`S.sessions`/`S.routine`/`S.draft` vs.
`S.meals`/`S.foods`; `session.js` no importa nada de `meals.js`). Incluso los
**ejes temporales** son incompatibles: la rutina es una *secuencia* que sólo
avanza entrenando; la nutrición es un *calendario por fecha*.

La frase honesta de lo que la app hace hoy:
> *"Registrar y ejecutar tu entrenamiento, serie por serie."*

Nutrición **no cabe** en esa frase.

### 2. Core Loop

**Loop A (registrar una serie) — es lo mejor que tiene la app.** 2 gestos + 1
tap, ~5-10 s. Recompensa inmediata y multicapa en el mismo tap: squash&stretch,
partículas, vibración, toast, chip nuevo, riel que se llena. Al cerrar el
ejercicio el loop **se re-arma solo** (auto-scroll al siguiente). Entra holgado
en 30 s y es repetible.

**Loop B (registrar una comida) — la ruta buena está enterrada.** El camino
rápido (chips "Un toque"/"Frecuentes" → `logMeal()`) es 1 tap, <3 s, con
vibración y toast. Pero el **botón principal** abre `MealForm`: ≥5
interacciones con teclado numérico, y al guardar da un toast genérico sin
vibración — la recompensa (el anillo animando) queda *detrás* del sheet que se
cierra.

### 3. Accessory Features — el peso muerto está en el peor lugar

El patrón: casi todo lo accesorio se cobra **dentro del loop más repetido**.

- `RpeSelector` — 10 botones en cada serie, opcionales, que alimentan features diferidas
- Selector de lado + toggle unilateral (`symmetry.js`) — agrega taps por serie
- `GymPhoto` — cámara dentro de la tarjeta del ejercicio en curso
- Precheck de 3 preguntas antes de cada sesión, para un ajuste de ±10% que ni se persiste

Fuera del loop: `fibras.js` (205 líneas), micronutrientes (que la propia UI
admite que "no sirve para diagnosticar nada"), `YearRecap`, `IllusPick` (código
muerto — no está registrado en `App.jsx`).

### 4. Surface Area — 35 contra 7

- **5** rutas de pantalla (la `TabBar` muestra 4; `hoy` es una quinta oculta)
- **28** sheets/modales en el switch de `App.jsx:77-107`
- **2** overlays a pantalla completa (`RestTimer`, `SessionComplete`)

**8 de esos sheets son sólo para editar la rutina** (`Library`, `ExerciseForm`,
`ExSwap`, `CopyExercises`, `SlotEdit`, `DayDrop`, `ReorderHoy`,
`RoutineWizard`). Es una app de configuración adentro de la app de entrenar —
y es donde está el 80% del recorte posible.

### 5. Retention Hook — la app se siente terminada cada día

Lo único fuerte es **intra-sesión**: `S.draft` persiste, enciende una
notificación con `requireInteraction:true` y la portada muestra "SEGUIR — 3 de
6". Dura horas, no días.

Lo que falta: **cero notificaciones programadas**. `notify.js` sólo tiene dos
tags (descanso y sesión en curso). No hay un solo "hoy te toca entrenar". Y al
cerrar la sesión, Inicio pasa a *"Completado · hoy"* — un estado terminal
explícito. Nutrición nunca genera estado inconcluso.

---

## El plan, en 5 fases

Ordenadas por **impacto sobre el loop**, no por dificultad. La regla del
framework manda: nada de lo de abajo importa si el loop no está sano.

### Fase 0 — Parar la hemorragia ✅ HECHO

- [x] **`useEffect` no importado en `ExerciseCarousel.jsx`.** `GymPhoto` lo usa
      (línea 203) y se renderiza con `open && S.cfg.activeGym` (línea 331) →
      `ReferenceError` que **mata la tarjeta del ejercicio en curso apenas hay
      un gym activo**. Y el flujo de inicio empuja a elegir gym como paso
      obligatorio, o sea que el camino feliz llevaba directo al crash.
      **Esto explica por qué la foto de máquina nunca funcionó en el celular.**

> **Lección:** ni los 355 tests, ni `tsc --noEmit`, ni `oxlint` detectaron un
> identificador no importado en un `.jsx`. Los tests no montan `GymPhoto` con un
> gym activo. Si algo "debería andar" y en el celular no anda, sospechar de un
> camino que ningún test recorre — no del CSS.

### Fase 1 — Devolverle el aire al loop

Sacar de la tarjeta del ejercicio en curso todo lo que no sea peso, reps y ✓:

1. **RPE** → detrás de un gesto opcional (long-press en el ✓), no 10 botones visibles
2. **Foto de máquina** → mover al arranque del ejercicio, no dentro de la serie
3. **Selector de lado** → sólo visible si el ejercicio es unilateral *y* ya hay historial de ambos lados
4. **Precheck de 3 preguntas** → 1 sola pregunta, o que se pueda saltar de una

**Criterio de aceptación:** registrar una serie no debe requerir mirar nada más
que peso, reps y el botón de confirmar.

### Fase 2 — Estética de los botones (lo que pediste puntualmente)

1. **Botón de calentamiento** (`WarmupCard.jsx:85`) — tres problemas sumados:
   - **Choque de paleta:** la tarjeta `.warmup` es toda ámbar (`--warn`), pero el
     botón usa `variant="primary"` = `--grad2`, **degradado azul con glow azul**
   - **Desalineado:** `Button` es `inline-flex` (ancho natural, pegado a la
     izquierda) mientras la rampa y la nota ocupan el ancho completo
   - **Perdió peso:** `size="sm"` (`h-9`) para ser el único CTA de la tarjeta
   → Fix: variante ámbar propia, ancho completo, altura normal.
2. **"Se está enfriando"** (`Rutina.jsx:286`) — el `.chip` genérico funciona pero
   es visualmente mudo. Darle tono propio + feedback táctil, sin volver al botón
   grande que ya se descartó.

### Fase 3 — Recortar superficie (28 sheets → ~14)

| Acción | Sheets | Detalle |
| --- | --- | --- |
| CONSOLIDAR | 8 → 3 | Toda la edición de rutina |
| FUSIONAR | `gyms` + `gym-equip` → Ajustes | `SessStartInfo` ya crea gyms inline: hay **3** lugares para lo mismo |
| FUSIONAR | `body-map` + `body-form` → 1 | Ver el cuerpo y registrar medidas son la misma tarea partida |
| FUSIONAR | `history` + `session-view` + `day-peek` → 1-2 | Solapan en "mirar sesiones pasadas" |
| CORTAR | `year-recap`, `guide`, `preworkout` | Cero relación con el loop |
| CORTAR | `voice-log` + `food-voice` | Rutas *alternativas* que compiten con el loop rápido |
| BORRAR | `IllusPick` | Código muerto, no registrado en `App.jsx` |

### Fase 4 — Retention hook real

1. **Recordatorio programado de entrenar** — no existe ninguno hoy. Es la pieza
   que más falta.
2. **Matar el estado terminal.** *"Completado · hoy"* debería abrir la siguiente
   tensión (lo que viene mañana), no cerrar el día.
3. **Racha honesta en split con descansos** — `dayCompleted()` devuelve `null` en
   día de descanso, así que la racha no acumula tensión visible.

### Fase 5 — Decidir el Core Function

**Esta es la decisión de producto que sólo vos podés tomar**, y condiciona todo
lo demás. Tres caminos:

- **A — FIERRO es entrenar.** Nutrición se subordina: deja de ser pestaña y pasa
  a ser un paso del post-entreno. Frase: *"Ejecutá tu entrenamiento, serie por
  serie."*
- **B — FIERRO es el ciclo completo.** Hay que construir los puentes que hoy no
  existen: que comer alimente al entrenar y viceversa (un solo eje de tiempo,
  datos que se crucen de verdad).
- **C — Se queda como está**, asumiendo que son dos herramientas en un
  contenedor. Es una opción válida si te sirve así — pero entonces el framework
  de la imagen no aplica y no tiene sentido medirse contra él.

---

## Trabajo en paralelo (no bloquea nada de arriba)

- **Migración a TypeScript de `lib/`** — delegada. Ya migrados `charts.ts`,
  `macros.ts`, y en curso `format.ts`, `streak.ts` y otros módulos de lógica pura.

---

## Orden sugerido

Fase 0 (hecho) → **Fase 2** (rápida, visible, ya la pediste) → **Fase 1** (el
loop) → **Fase 5** (la decisión) → Fases 3 y 4 según lo que salga de la 5.

La Fase 5 va antes que la 3 y la 4 a propósito: no tiene sentido recortar
sheets ni diseñar el hook de retención sin saber cuál es la una cosa.
