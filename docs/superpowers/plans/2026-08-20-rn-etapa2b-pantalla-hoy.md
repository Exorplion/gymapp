# Migración RN — Etapa 2b: Pantalla Hoy real — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la pantalla `Inicio` placeholder de Etapa 1 (la que
hoy sólo muestra "Cargando…"/"Datos cargados") por la pantalla `Hoy` real:
ver el turno pendiente, empezar una sesión, anotar series, cerrar la
sesión. El loop mínimo de "usar la app para entrenar".

**Architecture:** Toda la lógica de datos ya existe (`native/src/lib/
session.js`, portado y probado en Etapa 2a) — esta etapa es pura
construcción de UI con componentes nativos de RN (`View`/`Text`/
`Pressable`/`TextInput`/`ScrollView`/`StyleSheet`), sin `lib/` nuevo.

**Recorte deliberado de alcance** (ruling del controlador, no bloqueante —
se retoma en una etapa posterior si hace falta):
- **Sin carrusel deslizable.** El original (`ExerciseCarousel.jsx`) tiene
  matemática de scroll-snap propia (`lib/carousel.js`) para animar entre
  ejercicios. Acá los ejercicios se muestran como una lista vertical
  simple (`ScrollView`) — mismo contenido, sin la navegación por swipe.
  `lib/carousel.js`'s stub sigue siendo no-op (Etapa 2a).
- **Sin RIR/warnings de progresión/historial relacionado/iconos por
  ejercicio.** (`exdb.js`, `exicon.js`, `equip.js`'s `relatedHistory` no se
  usan acá.) Sólo el número de la serie objetivo, sin el esquema RIR.
- **Sin calentamiento** (`WarmupCard.jsx`, `lib/warmup.js`), **sin
  pre-workout**, **sin registro por voz** (`SpeechRecognition` es una API
  web-only sin equivalente RN directo — cuando se retome, necesita
  `expo-speech-recognition` o similar, otra etapa).
- **Sin barra de volumen muscular** (`muscleVolume`, aunque ya portado en
  `muscle.js`, su visualización es polish, no núcleo).
- **Inputs de peso/reps: controlados, no con refs.** El original usa refs
  sin re-render para evitar que React pelee con lo que el usuario tipea
  (ver comentario de cabecera de `ExerciseCarousel.jsx`) — un problema
  específico de re-render de React DOM. En RN, `TextInput` controlado con
  `onChangeText` no tiene ese mismo costo de rendimiento a esta escala;
  se usa el patrón más simple y correcto por defecto, no la optimización
  prematura.

**Tech Stack:** Igual que Etapas 1/2a — Expo, React Navigation, Jest para
lo que sea testeable como lógica pura (los componentes de pantalla en sí
no llevan test unitario en este plan, siguiendo el patrón ya establecido
en Etapa 1 Task 5 de que la UI se verifica con `expo-doctor` + bundler,
no con Jest).

**Spec:** `docs/superpowers/specs/2026-08-18-migracion-react-native-design.md`

## Global Constraints

- Plain JS, sin TypeScript.
- `native/` no toca `web/`.
- `npx jest` (debe seguir en 211/211, esta etapa no agrega tests de lógica
  — sólo UI) y `npx expo-doctor` sin errores antes de cada commit.
- Cada task que toque JSX debe además confirmar que el bundler de Metro
  compila sin error (`npx expo start`, confirmar "Metro waiting on
  exp://..." sin errores de bundling, cerrar con Ctrl+C) — mismo criterio
  que Etapa 1 Task 5, ya que no hay dispositivo/emulador disponible en
  este entorno.
- La pantalla `Hoy` reemplaza el registro `'Inicio'` en `native/App.js`
  temporalmente (Inicio real es Etapa 2c) — hasta entonces, la pestaña
  "Inicio" de la barra de navegación muestra Hoy directo, para tener algo
  usable de punta a punta cuanto antes. Se revierte a Inicio real en 2c.

---

### Task 1: Estructura de la pantalla + estados (Descanso / Toca hoy / Sesión en curso)

**Files:**
- Create: `native/src/screens/Hoy.js`
- Modify: `native/App.js` (registrar Hoy en la pestaña "Inicio", temporal)

**Interfaces:**
- Consumes: `S, useStore, bump` (`state.js`); `pendingSlot, sessionForSlot`
  (`session.js`).
- Produces: pantalla `Hoy` con los tres estados base (sin lista de
  ejercicios todavía, eso es Task 2) — consumida por Task 2 (agrega la
  lista) y Task 3 (agrega el historial semanal).

- [ ] **Step 1: Leer `web/src/components/screens/Hoy.jsx` completo**

Ya leído durante la planificación — releer antes de implementar para
tener el detalle exacto de `PreSessionHero`/`ActiveHero`/`RestHero`
(líneas 217-326 del original).

- [ ] **Step 2: Implementar la pantalla base**

```js
// native/src/screens/Hoy.js
// Puerto de web/src/components/screens/Hoy.jsx — SIN el carrusel
// deslizable, calentamiento, pre-workout, registro por voz ni barra de
// volumen muscular (recortado a propósito, ver el plan de esta etapa).
// La lista de ejercicios se agrega en Task 2; acá sólo van los tres
// estados base de la tarjeta principal.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { S, useStore, bump } from '../lib/state.js';
import { pendingSlot, sessionForSlot, startSession, discardSession, completeSession } from '../lib/session.js';

export default function Hoy() {
  useStore();
  const slot = pendingSlot();
  const index = S.routine.findIndex(s => s.id === slot?.id);
  const active = !!S.draft;
  const hecha = slot ? sessionForSlot(slot.id) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hoy</Text>
      {active ? (
        <ActiveHero slot={slot} />
      ) : slot?.type === 'rest' ? (
        <RestHero />
      ) : hecha ? (
        <DoneHero hecha={hecha} />
      ) : (
        <PreSessionHero slot={slot} index={index} />
      )}
    </View>
  );
}

function RestHero() {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Hoy</Text>
      <Text style={styles.heroDay}>Descanso</Text>
      <Text style={styles.mut}>Mañana seguís con el próximo turno de tu rutina.</Text>
    </View>
  );
}

function DoneHero({ hecha }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Completado · hoy</Text>
      <Text style={styles.heroDay}>Listo por hoy</Text>
      <Text style={styles.mut}>{hecha.duration} min · {(hecha.entries || []).length} ejercicios</Text>
    </View>
  );
}

function PreSessionHero({ slot, index }) {
  const exs = slot?.exercises || [];
  const totalSets = exs.reduce((a, e) => a + e.sets, 0);
  const estMin = Math.round(totalSets * ((S.cfg.rest || 90) + 40) / 60);
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Toca hoy</Text>
      <Text style={styles.heroDay}>{slot?.name || 'Entrenamiento'}</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statNum}>{exs.length}</Text><Text style={styles.statLabel}>Ejercicios</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{totalSets}</Text><Text style={styles.statLabel}>Series</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>~{estMin}</Text><Text style={styles.statLabel}>Minutos</Text></View>
      </View>
      {exs.length > 0 && (
        <Pressable style={styles.ctaBtn} onPress={() => startSession(index)}>
          <Text style={styles.ctaBtnText}>Empezar entrenamiento</Text>
        </Pressable>
      )}
    </View>
  );
}

function ActiveHero({ slot }) {
  const entries = S.draft?.entries || {};
  const nsets = Object.values(entries).reduce((a, e) => a + e.sets.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Sesión en curso</Text>
      <Text style={styles.heroDay}>{slot?.name || S.draft?.dayName || 'Entrenamiento'}</Text>
      <Text style={styles.mut}>{nsets} serie{nsets === 1 ? '' : 's'} registrada{nsets === 1 ? '' : 's'}</Text>
      <View style={styles.rowGap}>
        <Pressable style={[styles.smallBtn, styles.okBtn]} onPress={() => completeSession()}>
          <Text style={styles.smallBtnText}>✓ Completar sesión</Text>
        </Pressable>
        <Pressable style={[styles.smallBtn, styles.dimBtn]} onPress={() => discardSession()}>
          <Text style={styles.smallBtnText}>Descartar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070d', padding: 18 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: '#0e1626', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,.08)' },
  eyebrow: { color: '#2e7dff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroDay: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 4 },
  mut: { color: '#8a93a6', fontSize: 13, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 20, marginTop: 16 },
  stat: { alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#8a93a6', fontSize: 11, marginTop: 2 },
  ctaBtn: { backgroundColor: '#2e7dff', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rowGap: { flexDirection: 'row', gap: 10, marginTop: 14 },
  smallBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  okBtn: { backgroundColor: '#1fbf75' },
  dimBtn: { backgroundColor: 'rgba(255,255,255,.08)' },
  smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
```

- [ ] **Step 3: Registrar Hoy en `App.js` (temporal, hasta Etapa 2c)**

En `native/App.js`, cambiar el import y `<Tab.Screen name="Inicio"
component={Inicio} />` por `component={Hoy}` (dejando el `name="Inicio"`
tal cual — sólo cambia qué pantalla renderiza esa pestaña por ahora).
Comentar por qué: `// TEMP: Hoy real ocupa la pestaña Inicio hasta que
Etapa 2c traiga la pantalla Inicio real — así hay un loop usable de punta
a punta cuanto antes.`

- [ ] **Step 4: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo start`, confirmar bundler sin errores, cerrar.
Run: `cd native && npx jest` → sigue en 211/211 (esta task no toca `lib/`).

- [ ] **Step 5: Commit**

```bash
cd native && git add src/screens/Hoy.js App.js && git commit -m "feat(rn): pantalla Hoy — estados base (descanso/toca hoy/en curso/completado)"
```

---

### Task 2: Lista de ejercicios + registrar series

**Files:**
- Create: `native/src/screens/ExerciseList.js`
- Modify: `native/src/screens/Hoy.js` (integra `ExerciseList`)

**Interfaces:**
- Consumes: `sessionExs, orderedExs, nextPending, setsDone, targetSets,
  isSkipped, saveSet, deleteSet, startExercise, skipExercise,
  unskipExercise, addExtraSet, dropSet, ensureVals, lastDataFor` (todos ya
  en `session.js`, Etapa 2a); `wDisplay, wAlt, wStep` (`state.js`).
- Produces: lista de ejercicios completa dentro de Hoy — última pieza
  del loop de "entrenar" de esta etapa.

- [ ] **Step 1: Implementar `ExerciseList`**

```js
// native/src/screens/ExerciseList.js
// Puerto simplificado de web/src/components/ExerciseCarousel.jsx — lista
// vertical (ScrollView), no carrusel deslizable. Inputs controlados
// (useState), no refs — ver nota de alcance en el plan de esta etapa.
import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { S, wDisplay, wAlt, wStep } from '../lib/state.js';
import { round1, lb2kg, fmtNum } from '../lib/format.js';
import {
  ensureVals, lastDataFor, setsDone, saveSet, deleteSet, startExercise,
  targetSets, isSkipped, skipExercise, unskipExercise, addExtraSet, dropSet,
} from '../lib/session.js';

export default function ExerciseList({ exs, active, started, curId, nextEx }) {
  if (!exs.length) return null;
  return (
    <ScrollView style={styles.list} contentContainerStyle={{ gap: 14 }}>
      {exs.map(ex => {
        const done = setsDone(ex.id);
        const target = targetSets(ex);
        const skipped = active && isSkipped(ex.id);
        const full = !skipped && done.length >= target;
        const open = active && curId === ex.id && !full && !skipped;
        const isNext = active && !open && !skipped && !curId && nextEx && nextEx.id === ex.id;
        const waiting = active && !open && !isNext && !full && !skipped;
        return (
          <ExerciseCard
            key={ex.id}
            ex={ex} done={done} target={target} skipped={skipped}
            full={full} open={open} isNext={isNext} waiting={waiting} started={started}
          />
        );
      })}
    </ScrollView>
  );
}

function ExerciseCard({ ex, done, target, skipped, full, open, isNext, waiting, started }) {
  const v = ensureVals(ex);
  const last = lastDataFor(ex);
  const [w, setW] = useState(wDisplay(v.w));
  const [r, setR] = useState(String(v.r));

  function stepW(d) { v.w = Math.max(0, round1(v.w + d * wStep())); setW(wDisplay(v.w)); }
  function stepR(d) { v.r = Math.max(1, v.r + d); setR(String(v.r)); }
  function onWChange(text) {
    setW(text);
    const num = parseFloat(text);
    if (!isNaN(num) && num >= 0) v.w = S.cfg.unit === 'kg' ? num : lb2kg(num);
  }
  function onRChange(text) {
    setR(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num > 0) v.r = num;
  }

  return (
    <View style={[styles.card, open && styles.cardOpen, skipped && styles.cardSkipped]}>
      <Text style={styles.doneCount}>{done.length}/{target}</Text>
      <Text style={styles.exName}>{ex.name}</Text>
      <Text style={styles.exTarget}>Objetivo {target} × {ex.reps}</Text>
      {last && (
        <Text style={styles.exLast}>Última vez: {last.map(s => `${fmtNum(round1(s.w))}×${s.r}`).join(' · ')} kg</Text>
      )}
      {full && <Text style={styles.stateOk}>✓ Completo · {done.length} de {target} series</Text>}
      {waiting && <Text style={styles.stateMut}>En espera{done.length ? ` · ${done.length}/${target} series` : ''}</Text>}
      {skipped && (
        <>
          <Text style={styles.stateSkip}>Saltado{done.length ? ` · ${done.length} serie${done.length === 1 ? '' : 's'} registrada${done.length === 1 ? '' : 's'}` : ''}</Text>
          <Pressable style={styles.ghostBtn} onPress={() => unskipExercise(ex.id)}>
            <Text style={styles.ghostBtnText}>↺ Restablecer</Text>
          </Pressable>
        </>
      )}
      {full && (
        <Pressable style={styles.ghostBtn} onPress={() => addExtraSet(ex.id)}>
          <Text style={styles.ghostBtnText}>+ Una serie más</Text>
        </Pressable>
      )}
      {isNext && (
        <>
          <Pressable style={styles.primaryBtn} onPress={() => startExercise(ex)}>
            <Text style={styles.primaryBtnText}>▶ Iniciar ejercicio</Text>
          </Pressable>
          <Text style={styles.hint}>Dale cuando estés en la máquina{!started ? ' — acá arranca el cronómetro' : ''}</Text>
          <ExActions ex={ex} />
        </>
      )}
      {open && (
        <>
          <View style={styles.setRows}>
            <View style={styles.setCol}>
              <Text style={styles.stepLabel}>Peso ({S.cfg.unit === 'kg' ? 'kg' : 'lb'})</Text>
              <View style={styles.stepRow}>
                <Pressable style={styles.stepBtn} onPress={() => stepW(-1)}><Text style={styles.stepBtnText}>−</Text></Pressable>
                <TextInput style={styles.input} keyboardType="decimal-pad" value={w} onChangeText={onWChange} />
                <Pressable style={styles.stepBtn} onPress={() => stepW(1)}><Text style={styles.stepBtnText}>+</Text></Pressable>
              </View>
              <Text style={styles.alt}>{wAlt(v.w)}</Text>
            </View>
            <View style={styles.setCol}>
              <Text style={styles.stepLabel}>Reps</Text>
              <View style={styles.stepRow}>
                <Pressable style={styles.stepBtn} onPress={() => stepR(-1)}><Text style={styles.stepBtnText}>−</Text></Pressable>
                <TextInput style={styles.input} keyboardType="number-pad" value={r} onChangeText={onRChange} />
                <Pressable style={styles.stepBtn} onPress={() => stepR(1)}><Text style={styles.stepBtnText}>+</Text></Pressable>
              </View>
            </View>
          </View>
          <Pressable style={styles.primaryBtn} onPress={() => saveSet(ex.id)}>
            <Text style={styles.primaryBtnText}>✓ Terminé la serie {done.length + 1} de {target}</Text>
          </Pressable>
          <ExActions ex={ex} />
        </>
      )}
      {done.length > 0 && (
        <View style={styles.chipsRow}>
          {done.map((s, i) => (
            <Pressable key={i} style={styles.chip} onPress={() => deleteSet(ex.id, i)}>
              <Text style={styles.chipText}>{fmtNum(round1(s.w))}kg × {s.r} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function ExActions({ ex }) {
  return (
    <View style={styles.actionsRow}>
      <Pressable style={styles.actionBtn} onPress={() => dropSet(ex.id)}><Text style={styles.actionBtnText}>− Serie</Text></Pressable>
      <Pressable style={styles.actionBtn} onPress={() => addExtraSet(ex.id)}><Text style={styles.actionBtnText}>+ Serie</Text></Pressable>
      <Pressable style={styles.actionBtn} onPress={() => skipExercise(ex.id)}><Text style={styles.actionBtnText}>Saltar</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 16 },
  card: { backgroundColor: '#0e1626', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,.06)' },
  cardOpen: { borderColor: '#2e7dff' },
  cardSkipped: { opacity: 0.5 },
  doneCount: { color: '#8a93a6', fontSize: 12, fontWeight: '700' },
  exName: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  exTarget: { color: '#8a93a6', fontSize: 13, marginTop: 4 },
  exLast: { color: '#8a93a6', fontSize: 12, marginTop: 4 },
  stateOk: { color: '#1fbf75', fontSize: 13, marginTop: 8, fontWeight: '600' },
  stateMut: { color: '#8a93a6', fontSize: 13, marginTop: 8 },
  stateSkip: { color: '#ffb347', fontSize: 13, marginTop: 8 },
  ghostBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,.06)' },
  ghostBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  primaryBtn: { marginTop: 12, backgroundColor: '#2e7dff', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  hint: { color: '#8a93a6', fontSize: 11, textAlign: 'center', marginTop: 6 },
  setRows: { flexDirection: 'row', gap: 14, marginTop: 12 },
  setCol: { flex: 1 },
  stepLabel: { color: '#8a93a6', fontSize: 11, marginBottom: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.08)', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  input: { flex: 1, color: '#fff', fontSize: 16, textAlign: 'center', backgroundColor: 'rgba(255,255,255,.06)', borderRadius: 8, paddingVertical: 8 },
  alt: { color: '#8a93a6', fontSize: 11, marginTop: 4, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { backgroundColor: 'rgba(46,125,255,.18)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: '#6ea8ff', fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: 'rgba(255,255,255,.06)', alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
```

- [ ] **Step 2: Integrar en `Hoy.js`**

En `native/src/screens/Hoy.js`, importar `ExerciseList` y `orderedExs,
sessionExs, nextPending` de `session.js`. Después del bloque de hero
(`ActiveHero`/`RestHero`/`DoneHero`/`PreSessionHero`), agregar:

```js
const exs = active ? sessionExs(index) : orderedExs(index, slot?.exercises || []);
const nextEx = active ? nextPending(exs) : null;
```

y renderizar `<ExerciseList exs={exs} active={active} started={active &&
!!S.draft.start} curId={active ? S.draft.cur : null} nextEx={nextEx} />`
debajo del hero (fuera de la `View` del `card`, como hermano).

- [ ] **Step 3: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo start`, confirmar bundler sin errores, cerrar.
Run: `cd native && npx jest` → sigue en 211/211.

- [ ] **Step 4: Commit**

```bash
cd native && git add src/screens/ExerciseList.js src/screens/Hoy.js && git commit -m "feat(rn): lista de ejercicios y registro de series en Hoy"
```

---

### Task 3: Historial de la semana

**Files:**
- Modify: `native/src/screens/Hoy.js`

**Interfaces:**
- Consumes: `S.sessions`, `dstr` (`format.js`).
- Produces: cierra el loop de Etapa 2b — pantalla Hoy completa según el
  alcance recortado de esta etapa.

- [ ] **Step 1: Agregar `WeekHistory`**

```js
// dentro de native/src/screens/Hoy.js, después del bloque de ExerciseList
import { dstr } from '../lib/format.js';
// ...
function WeekHistory() {
  const cutoff = dstr(new Date(Date.now() - 7 * 86400000));
  const recent = S.sessions.filter(s => s.date >= cutoff);
  if (!recent.length) {
    return <Text style={styles.mut}>Todavía no hay sesiones esta semana.</Text>;
  }
  return recent.map(s => (
    <View key={s.id} style={styles.histRow}>
      <Text style={styles.histTitle}>{s.dayName}</Text>
      <Text style={styles.histDate}>{s.date}</Text>
    </View>
  ));
}
```

(Sin `onPress` a un sheet de detalle todavía — `session-view` es de una
etapa posterior, Etapa 2b se queda en "ver la lista", no "abrir el
detalle".) Renderizar `<Text style={styles.sect}>Esta semana</Text><View
style={styles.card}><WeekHistory /></View>` al final de `Hoy()`, después
de `ExerciseList`. Agregar `sect: { color: '#8a93a6', fontSize: 12,
fontWeight: '700', textTransform: 'uppercase', marginTop: 20, marginBottom:
8 }`, `histRow: { flexDirection: 'row', justifyContent: 'space-between',
paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.06)' }`,
`histTitle: { color: '#fff', fontSize: 14 }`, `histDate: { color: '#8a93a6', fontSize: 13 }`
al `StyleSheet.create` existente.

- [ ] **Step 2: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo start`, confirmar bundler sin errores, cerrar.
Run: `cd native && npx jest` → sigue en 211/211.

- [ ] **Step 3: Commit**

```bash
cd native && git add src/screens/Hoy.js && git commit -m "feat(rn): historial de la semana en Hoy — cierra el loop de Etapa 2b"
```

---

## Revisión final de la etapa

- [ ] `cd native && npx jest` — 211/211 (sin cambios de lógica, sólo UI).
- [ ] `cd native && npx expo-doctor` — sin errores.
- [ ] Bundler de Metro compila sin error.
- [ ] `web/` sin ningún archivo modificado.
- [ ] Confirmar que los cuatro estados de Hoy (descanso/toca
  hoy/en curso/completado) están todos alcanzables leyendo el código —
  no hay forma de verificar visualmente sin dispositivo en este entorno,
  así que la revisión final debe trazar cada rama de `Hoy()` a mano.
