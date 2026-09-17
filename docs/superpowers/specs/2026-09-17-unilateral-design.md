# Unilateral: una serie son los dos lados

**Fecha:** 2026-09-17 · **Estado:** diseño aprobado por Enzo (opción "una serie = los dos lados")

## El problema, en las palabras de Enzo

> "cuando selecciono el brazo sea izquierdo o derecho lo toma como una serie
> completa cuando hago unilateral. descanso entre 15-20 segundos entre brazo,
> no es una serie completa y además debería registrarse de una manera que
> cuadre con eso."

Y además: el interruptor tiene que estar a la vista (no dentro de "opciones de
esta serie"), tiene que **persistir** en la rutina y en el historial, y
bilateral y unilateral tienen que llevar **registros de peso distintos**
(40 kg bilateral vs 25 kg unilateral).

## Lo que hace hoy el código

| Hecho | Dónde |
|---|---|
| Cada lado empuja UNA fila a `sets` y cuenta contra el objetivo | `lib/session.js:545` |
| `startRest()` se llama sin condición: descanso completo entre brazos | `lib/session.js:558` |
| El toggle sólo escribe `S.draft.unilateralOverride` — no persiste | `lib/session.js:39-51` |
| El toggle vive dentro de `<details>` "Más opciones de esta serie" | `components/ExerciseCarousel.jsx:526` |
| `exKey()` es `nombre·equipo·máquina` — sin lateralidad | `lib/equip.js:83-90` |
| Los gráficos agrupan sólo por `e.name.trim()` — ignoran hasta el equipo | `lib/charts.ts:40-56` |

## Decisiones de diseño

### D1 — La fila sigue siendo por lado; lo que cambia es el conteo

**No** se cambia la forma de `set` (`{w, r, t, rpe, side}`). Cambiarla obligaría
a tocar todos los consumidores de `set.w` (PRs, deltas, gráficos, e1RM,
volumen, `symmetry.ts`) y **no hay precedente de migración de sesiones** en
este repo: toda la compatibilidad histórica se resolvió siempre leyendo con
defaults, nunca reescribiendo datos (`lib/db.js` sólo migró `routine`).

En cambio:

- `targetSets(ex)` devuelve `ex.sets * 2` cuando el ejercicio es unilateral.
  Las filas siguen siendo una por lado; el objetivo se duplica para que
  3×12 unilateral signifique **3 series reales = 6 lados**.
- La UI muestra `Serie N/3`, calculado como `Math.floor(filas / 2)`, no
  `filas`. Lo que Enzo cuenta en el gimnasio es la serie, no el brazo.
- Cuando el ejercicio es unilateral, `v.side` arranca en `'left'` en vez de
  `null`: Enzo empieza siempre por el izquierdo, y un `side: null` dejaría
  filas que no se pueden emparejar.

### D2 — El descanso se parte en dos

- Fila **impar** (acabás de hacer el primer lado) → descanso corto,
  `S.cfg.restSide`, **20 s** por defecto.
- Fila **par** (cerraste la serie) → descanso normal, `S.cfg.rest`.

`startRest(segs)` ya acepta una duración (`lib/rest.js:44`), así que no hay
que inventar nada: sólo elegir cuál se pasa.

### D3 — La lateralidad entra en `exKey()`

```js
const uni = ex?.unilateral ? '·uni' : '';
```

Se agrega como sufijo. Consecuencia buscada: **todo el historial viejo, que
no tiene lateralidad, se lee como bilateral** — que es exactamente el default
que pidió Enzo ("si yo defino tricep extension se asume que es bilateral").
Cero migración, cero riesgo de partir el pasado en dos.

Esto separa automáticamente: `lastDataFor`, `entryDelta`, `sessionPRs`,
`progresion`, `sideImbalance` y la deduplicación de rutina.

**Si no hay historial unilateral todavía, se dice — no se muestra el número
bilateral disfrazado.** Criterio de la app: la ausencia de dato no es un cero.

### D4 — Los gráficos también, o mienten

`exerciseSeries()` y `e1rmSeries()` agrupan por nombre pelado. Sin tocarlos,
los 25 kg unilaterales entrarían en la misma línea que los 40 kg bilaterales
y el gráfico mostraría un derrumbe que nunca pasó. Se separan agregando
` (unilateral)` a la clave de agrupación, de modo que aparezcan como dos
entradas distintas en el selector de Progreso.

### D5 — El toggle persiste, pero sólo antes de la primera serie

`toggleUnilateral(exId)` pasa a escribir **también** en el ejercicio de la
rutina (`ex.unilateral`) y a persistir el slot. Así la semana que viene la
app ya sabe que ese ejercicio es unilateral, tal como pidió Enzo.

**Restricción:** si ya registraste series hoy para ese ejercicio, el cambio
se bloquea con un aviso. Motivo: las filas ya guardadas quedaron indexadas
con la clave vieja; darlas vuelta a mitad de camino corrompe el historial de
las dos lateralidades a la vez. Cambiar antes de la primera serie es gratis.

### D6 — Qué ejercicios muestran el interruptor

`puedeSerUnilateral(ex)`: se muestra en todos **salvo** los claramente
bilaterales por naturaleza (sentadilla, peso muerto, press de banca con
barra, dominadas, prensa). Lista de exclusión explícita y testeada; el
default es mostrarlo, porque equivocarse mostrando un chip de más es
recuperable y equivocarse escondiéndolo no.

## Qué se toca

| Archivo | Cambio |
|---|---|
| `lib/equip.js` | sufijo `·uni` en `exKey()` + `puedeSerUnilateral()` |
| `lib/session.js` | `targetSets` ×2, descanso partido, `v.side` default, persistencia del toggle |
| `lib/state.js` | `cfg.restSide = 20` |
| `lib/charts.ts` | separar series por lateralidad |
| `components/ExerciseCarousel.jsx` | chip visible + "Serie N/3" + nombre con "(unilateral)" |

## Cómo se verifica

Tests nuevos por cada decisión (D1-D6). Lo crítico a fijar:

1. 3×12 unilateral = 6 filas, y a la fila 6 el ejercicio está completo.
2. Tras la fila 1 el descanso es 20 s; tras la fila 2, `cfg.rest`.
3. Una sesión vieja sin `unilateral` sigue matcheando la clave bilateral —
   **el historial no se parte**.
4. Bilateral y unilateral del mismo ejercicio no comparten último peso ni PR.
5. El toggle con series ya registradas hoy no cambia nada y avisa.
