# Migración RN — Etapa 2c: Inicio real + Rutina en modo lectura — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la Etapa 2 ("Núcleo") del mapa de migración. Reemplazar
el hack temporal de Etapa 2b (`Hoy` ocupando la pestaña "Inicio") por la
pantalla `Inicio` real — portada con los cuatro estados y acceso a
`Hoy` — y agregar `Rutina` en modo lectura (resumen de la secuencia,
turnos expandibles). Con esto, las 4 pestañas muestran contenido real por
primera vez.

**Architecture:** Toda la lógica de datos ya existe y está portada/testeada
(`rutina-logic.js`, `muscle.js`, `session.js`, Etapa 2a) — esta etapa es
pura construcción de UI, sin `lib/` nuevo. `S.tab` (`state.js:21`) ya
existe con el mismo propósito que en `web/`: distinguir cuándo la pestaña
"Inicio" debe mostrar `Inicio` vs. `Hoy` (ver `web/src/App.jsx`'s
`pantallaDe(tab)` — "Hoy" no es pestaña propia, se entra desde Inicio).

**Recorte deliberado de alcance** (ruling del controlador, no bloqueante
— se retoma en etapas posteriores):

- **Sin `Silhouette` (mapa de músculo corporal).** El original centra
  `Inicio` en dos siluetas SVG coloreadas por días-sin-entrenar
  (`Silhouette.jsx`). El spec de migración (`2026-08-18-migracion-react-
  native-design.md`) ya asigna esto a su propia etapa (4) por ser la
  pieza más trabajosa de portar (SVG + gradientes de color). Acá el hero
  de `Inicio` es sólo texto (eyebrow/título/sub — mismo patrón de
  4-estados que `Hoy` ya usa), sin silueta ni leyenda de colores. El
  "grupo más olvidado" (`stalestGroups`, `daysSinceAll`, ya portados en
  `muscle.js`) SÍ se muestra como una línea de texto (`StaleLine`) — es
  dato puro, no visualización, y da valor real sin necesitar la silueta.
- **Rutina: sólo modo lectura (`RutinaView`).** El editor drag-and-drop
  (`RutinaEdit`, `flipSort`/`drag.js`) es la Etapa 3 completa
  ("Editor de Rutina — drag-and-drop nativo con gesture-handler/
  reanimated"). Acá el botón "Editar rutina" y "Mis rutinas" (que abre el
  sheet `library`) muestran `toast('Próximamente')` en vez de navegar —
  visibles pero no funcionales todavía, así el layout ya está armado
  cuando la Etapa 3 los conecte.
- **Sin RIR/iconos por ejercicio en las tarjetas de turno.** Mismo
  recorte que Etapa 2b (`exdb.js`, `exicon.js` no se usan). Cada
  ejercicio dentro de un turno expandido muestra sólo nombre y
  `series×reps`, sin el badge de equipo ni el esquema RIR.
- **Sin sheet `ex-info` al tocar un ejercicio.** Los sheets son Etapa 5.
  Tocar un ejercicio dentro de un turno expandido no hace nada todavía
  (no es un `Pressable`, es sólo texto — evita el affordance de "esto
  hace algo" cuando no lo hace, distinto al turno en sí que sí es
  interactivo por el expand/collapse).

**Tech Stack:** Igual que Etapas 1/2a/2b — Expo, React Navigation, Jest
para lógica pura. Sin tests unitarios de los componentes de pantalla en
sí (mismo patrón ya establecido: UI se verifica con `expo-doctor` +
bundler).

**Spec:** `docs/superpowers/specs/2026-08-18-migracion-react-native-design.md`

## Global Constraints

- Plain JS, sin TypeScript.
- `native/` no toca `web/`.
- `npx jest` (debe seguir en 211/211 — esta etapa no agrega tests de
  lógica, sólo UI) y `npx expo-doctor` sin errores antes de cada commit.
- Cada task que toque JSX debe confirmar que el bundler de Metro compila
  sin error. Sin dispositivo/emulador en este entorno: usar
  `npx expo export --platform android` como cheque equivalente de
  compilación de Metro (mismo criterio que Etapa 2b), borrando
  `native/dist/` después si se genera — no committear ese directorio.
- Esta etapa revierte el hack TEMP de Etapa 2b (`App.js`'s
  `<Tab.Screen name="Inicio" component={Hoy} />`): la pestaña "Inicio"
  vuelve a mostrar `Inicio` real, con `Hoy` accesible desde ahí via
  `S.tab === 'hoy'` (mismo mecanismo que `web/`).

---

### Task 1: Pantalla Inicio + acceso a Hoy

**Files:**
- Create: `native/src/screens/Inicio.js`
- Modify: `native/App.js` (revertir el hack TEMP de Etapa 2b: la pestaña
  "Inicio" pasa a renderizar un wrapper que alterna `Inicio`/`Hoy` según
  `S.tab`)

**Interfaces:**
- Consumes: `S, useStore, bump` (`state.js`); `pendingSlot, sessionForSlot`
  (`session.js`); `daysSinceAll, stalestGroups` (`muscle.js`).
- Produces: pantalla `Inicio` real + el mecanismo `S.tab` que Task 2
  no necesita pero que deja establecido el patrón "pestaña Inicio con
  sub-pantalla Hoy" para el resto de la app.

- [ ] **Step 1: Leer `web/src/components/screens/Inicio.jsx` completo**

Ya leído durante la planificación (114 líneas) — releer antes de
implementar para el detalle exacto de los 4 estados y `StaleLine`.

- [ ] **Step 2: Implementar la pantalla**

```js
// native/src/screens/Inicio.js
// Puerto de web/src/components/screens/Inicio.jsx — SIN la silueta
// muscular (Silhouette.jsx, Etapa 4) ni su leyenda de colores. El "grupo
// más olvidado" se muestra como texto (StaleLine), igual que el original,
// porque es dato puro (muscle.js) y no depende de la silueta.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { S, useStore, bump } from '../lib/state.js';
import { WDS, MO } from '../lib/format.js';
import { pendingSlot, sessionForSlot } from '../lib/session.js';
import { daysSinceAll, stalestGroups } from '../lib/muscle.js';

export default function Inicio() {
  useStore();
  const hoy = new Date();
  const slot = pendingSlot();
  const hecha = slot ? sessionForSlot(slot.id) : null;
  const draft = S.draft;
  const enCurso = !!draft;

  const dias = daysSinceAll();
  const viejos = stalestGroups();
  const fecha = `${WDS[hoy.getDay()]} ${hoy.getDate()} ${MO[hoy.getMonth()]}`;

  const irAHoy = () => { S.tab = 'hoy'; bump(); };

  let eyebrow, titulo, sub, ctaLabel, ctaSub, onCta;
  if (enCurso) {
    const hechos = Object.values(draft.entries).filter(e => e.sets.length).length;
    const turnoDraft = S.routine.find(s => s.id === draft.slotId);
    const total = (turnoDraft?.exercises || []).length;
    eyebrow = 'Sesión en curso';
    titulo = 'Entrenando';
    sub = `${hechos} de ${total} ejercicios registrados`;
    ctaLabel = 'SEGUIR'; ctaSub = `${hechos} de ${total}`; onCta = irAHoy;
  } else if (hecha) {
    eyebrow = 'Completado · hoy';
    titulo = 'Listo por hoy';
    sub = `${hecha.duration} min · ${(hecha.entries || []).length} ejercicios`;
    // Sin sheet 'session-view' todavía (Etapa 5) — el CTA lleva a Hoy,
    // que ya muestra el resumen de la sesión completada (DoneHero).
    ctaLabel = 'VER HOY'; ctaSub = null; onCta = irAHoy;
  } else if (slot?.type === 'workout' && slot.exercises?.length) {
    eyebrow = fecha;
    titulo = 'Toca entrenar';
    sub = 'Vas por tu racha';
    ctaLabel = 'IR A HOY'; ctaSub = null; onCta = irAHoy;
  } else {
    const hayRutina = S.routine.some(s => s.type === 'workout' && s.exercises?.length);
    eyebrow = fecha;
    titulo = hayRutina ? 'Descanso' : 'Sin rutina';
    sub = hayRutina ? 'Hoy no toca entrenar' : 'Armá tu split para empezar';
    ctaLabel = hayRutina ? 'ENTRENAR IGUAL' : 'IR A RUTINA';
    ctaSub = null;
    onCta = hayRutina ? irAHoy : () => { S.tab = 'rutina'; bump(); };
  }

  const top = viejos.slice(0, 2);
  const staleD = top.length ? dias[top[0]] : null;

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{titulo}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>

      {top.length > 0 && (
        <Text style={styles.stale}>
          ⌁ {top.join(' y ')} hace {staleD} día{staleD === 1 ? '' : 's'}
        </Text>
      )}

      <Pressable style={styles.cta} onPress={onCta}>
        <Text style={styles.ctaText}>{ctaLabel}</Text>
        {ctaSub && <Text style={styles.ctaSubText}>{ctaSub}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070d', padding: 18, justifyContent: 'center' },
  top: { marginBottom: 24 },
  eyebrow: { color: '#2e7dff', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 6 },
  sub: { color: '#8a93a6', fontSize: 15, marginTop: 6 },
  stale: { color: '#ffb347', fontSize: 13, marginBottom: 24 },
  cta: { backgroundColor: '#2e7dff', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 17, letterSpacing: 0.5 },
  ctaSubText: { color: 'rgba(255,255,255,.75)', fontSize: 12, marginTop: 2 },
});
```

Nota: `S.routine` puede no traer un turno para `hoy` si `pendingSlot()`
devuelve `undefined` (ver el uso de `slot?.` en todo el componente,
consistente con `Hoy.js`).

- [ ] **Step 3: Revertir el hack TEMP en `App.js` — pestaña Inicio con
  sub-pantalla Hoy**

Reemplazar el `<Tab.Screen name="Inicio" component={Hoy} />` (TEMP de
Etapa 2b) por un wrapper que alterna según `S.tab`, portando
`pantallaDe(tab)` de `web/src/App.jsx` acotado a este único caso (Hoy no
es pestaña propia, se entra desde Inicio):

```js
// native/App.js
import { S, useStore, loadAll } from './src/lib/state.js';
import Inicio from './src/screens/Inicio.js';
import Hoy from './src/screens/Hoy.js';
// ... (Rutina, Comida, Progreso imports igual que antes)

function InicioTab() {
  useStore();
  return S.tab === 'hoy' ? <Hoy /> : <Inicio />;
}

// dentro de <Tab.Navigator>:
// <Tab.Screen name="Inicio" component={InicioTab} />
```

`InicioTab` puede vivir como función local en `App.js` (no hace falta un
archivo nuevo — es un switch de dos líneas, no una pantalla). Borrar el
comentario TEMP de Etapa 2b y el import directo de `Hoy` como
`component` de la pestaña (`Hoy` se sigue importando, ahora usado dentro
de `InicioTab`).

- [ ] **Step 4: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error (borrar `native/dist/` después).
Run: `cd native && npx jest` → sigue en 211/211 (esta task no toca `lib/`).

- [ ] **Step 5: Commit**

```bash
cd native && git add src/screens/Inicio.js App.js && git commit -m "feat(rn): pantalla Inicio real + acceso a Hoy vía S.tab"
```

---

### Task 2: Rutina en modo lectura

**Files:**
- Create: `native/src/screens/Rutina.js` (reemplaza el placeholder de
  Etapa 1)

**Interfaces:**
- Consumes: `S, useStore, bump` (`state.js`); `routineStats, routineName`
  (`rutina-logic.js`); `toast` (`toast.js`, ya portado en Etapa 2a).
- Produces: cierra el loop de lectura de Etapa 2 ("Núcleo") — las 4
  pestañas muestran contenido real. El editor (Etapa 3) reemplaza el
  `toast('Próximamente')` de "Editar rutina" por la navegación real.

- [ ] **Step 1: Leer `web/src/components/screens/Rutina.jsx` — sólo
  `RutinaView` (líneas 62-166 aprox., NO `RutinaEdit`)**

Ya leído durante la planificación — releer antes de implementar. Ignorar
todo lo relacionado a `S.rutMode`, `enterEditMode`/`RutinaEdit`,
`flipSort`/drag — eso es Etapa 3.

- [ ] **Step 2: Implementar la pantalla**

```js
// native/src/screens/Rutina.js
// Puerto de web/src/components/screens/Rutina.jsx — SÓLO el modo lectura
// (RutinaView). El editor drag-and-drop (RutinaEdit) es Etapa 3. Sin
// RIR/iconos por ejercicio ni sheet ex-info (mismo recorte que Etapa 2b
// para Hoy) — cada ejercicio dentro de un turno expandido es texto
// plano, no un botón, para no prometer una interacción que no existe.
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { S, useStore, bump } from '../lib/state.js';
import { routineStats, routineName } from '../lib/rutina-logic.js';
import { toast } from '../lib/toast.js';

export default function Rutina() {
  useStore();
  const [openIdx, setOpenIdx] = useState(-1);
  const st = routineStats();
  const maxSets = Math.max(1, ...S.routine.map(slot =>
    slot.type === 'workout' ? (slot.exercises || []).reduce((a, e) => a + e.sets, 0) : 0));

  if (!st.workoutCount) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Rutina</Text>
        <Text style={styles.sub}>tu semana de un vistazo</Text>
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            Todavía no tenés rutina.{'\n'}Armá tu split turno por turno.
          </Text>
          <Pressable style={styles.ghostBtn} onPress={() => toast('Próximamente')}>
            <Text style={styles.ghostBtnText}>Ver rutinas y plantillas</Text>
          </Pressable>
        </View>
        <Pressable style={styles.editBtn} onPress={() => toast('Próximamente')}>
          <Text style={styles.editBtnText}>✎ Armar mi rutina</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Rutina</Text>
      <Text style={styles.sub}>tu semana</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Plan activo</Text>
        <Text style={styles.heroName}>{routineName()}</Text>
        <Text style={styles.heroStats}>
          {st.workoutCount} turno{st.workoutCount === 1 ? '' : 's'} de entrenamiento · {st.ex} ejercicios · {st.sets} series por ciclo
        </Text>
        <View style={styles.weekbars}>
          {S.routine.map((slot, i) => {
            const sets = slot.type === 'workout' ? (slot.exercises || []).reduce((a, e) => a + e.sets, 0) : 0;
            const h = sets ? Math.round(30 + (sets / maxSets) * 40) : 10;
            return (
              <View key={slot.id} style={styles.wbar}>
                <View style={[styles.wbarFill, { height: h }, sets && styles.wbarOn]} />
                <Text style={styles.wbarLabel}>{i + 1}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.btnRow}>
        <Pressable style={styles.btn} onPress={() => toast('Próximamente')}>
          <Text style={styles.btnText}>Editar rutina</Text>
        </Pressable>
        <Pressable style={styles.btnGlass} onPress={() => toast('Próximamente')}>
          <Text style={styles.btnText}>Mis rutinas</Text>
        </Pressable>
      </View>

      <View style={styles.dayCards}>
        {S.routine.map((slot, i) => {
          const on = slot.type === 'workout' && !!slot.exercises?.length;
          const sets = on ? slot.exercises.reduce((a, e) => a + e.sets, 0) : 0;
          const open = openIdx === i && on;
          return (
            <View key={slot.id} style={styles.dayCard}>
              <Pressable style={styles.dayHead} onPress={() => setOpenIdx(open ? -1 : i)}>
                <View style={[styles.dayBadge, !on && styles.dayBadgeOff]}>
                  <Text style={styles.dayBadgeText}>{i + 1}</Text>
                </View>
                <View style={styles.dayGrow}>
                  <Text style={styles.dayTitle}>{on ? (slot.name || 'Rutina') : 'Descanso'}</Text>
                  <Text style={styles.daySub}>{on ? `${slot.exercises.length} ejercicios · ${sets} series` : 'libre'}</Text>
                </View>
                <Text style={styles.chev}>{open ? '⌄' : '›'}</Text>
              </Pressable>
              {open && (
                <View style={styles.dayExs}>
                  {slot.exercises.map((e, k) => (
                    <View key={e.id} style={styles.dayEx}>
                      <Text style={styles.dayExIndex}>{k + 1}</Text>
                      <Text style={styles.dayExName}>{e.name}</Text>
                      <Text style={styles.dayExSets}>{e.sets}×{e.reps}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070d' },
  scrollContent: { padding: 18, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  sub: { color: '#8a93a6', fontSize: 13, marginTop: 2, marginBottom: 16 },
  card: { backgroundColor: '#0e1626', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,.08)' },
  emptyText: { color: '#8a93a6', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  ghostBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,.06)' },
  ghostBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  editBtn: { marginTop: 16, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,.15)' },
  editBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  heroCard: { backgroundColor: '#0e1626', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(139,92,246,.25)' },
  heroEyebrow: { color: '#a78bfa', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroName: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 4 },
  heroStats: { color: '#8a93a6', fontSize: 13, marginTop: 4 },
  weekbars: { flexDirection: 'row', gap: 6, marginTop: 16, alignItems: 'flex-end', height: 70 },
  wbar: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  wbarFill: { width: '100%', borderRadius: 4, backgroundColor: 'rgba(255,255,255,.08)' },
  wbarOn: { backgroundColor: '#a78bfa' },
  wbarLabel: { color: '#8a93a6', fontSize: 10, marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,.08)' },
  btnGlass: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.15)' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  dayCards: { marginTop: 20, gap: 10 },
  dayCard: { backgroundColor: '#0e1626', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,.06)', overflow: 'hidden' },
  dayHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  dayBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center' },
  dayBadgeOff: { backgroundColor: 'rgba(255,255,255,.1)' },
  dayBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dayGrow: { flex: 1 },
  dayTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  daySub: { color: '#8a93a6', fontSize: 12, marginTop: 2 },
  chev: { color: '#8a93a6', fontSize: 18 },
  dayExs: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  dayEx: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.06)' },
  dayExIndex: { color: '#8a93a6', fontSize: 11, width: 16 },
  dayExName: { flex: 1, color: '#fff', fontSize: 13 },
  dayExSets: { color: '#8a93a6', fontSize: 12 },
});
```

Nota: el original guarda el turno expandido en `S.rutOpen` (estado
global, sobrevive a re-render por `bump()` de otras partes de la app).
Acá se usa `useState` local (`openIdx`) porque nada fuera de esta
pantalla necesita saber qué turno está expandido — es UI efímera, no
estado de dominio. Si una etapa futura necesita que el turno expandido
sobreviva a salir/volver a la pestaña, eso es una decisión a tomar en
esa etapa, no una regresión de ésta.

- [ ] **Step 3: Verificar**

Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error (borrar `native/dist/` después).
Run: `cd native && npx jest` → sigue en 211/211.

- [ ] **Step 4: Commit**

```bash
cd native && git add src/screens/Rutina.js && git commit -m "feat(rn): pantalla Rutina en modo lectura"
```

---

## Revisión final de la etapa

- [ ] `cd native && npx jest` — 211/211 (sin cambios de lógica, sólo UI).
- [ ] `cd native && npx expo-doctor` — sin errores.
- [ ] Bundler de Metro compila sin error.
- [ ] `web/` sin ningún archivo modificado.
- [ ] Confirmar que los cuatro estados de Inicio (sesión en curso/
  completado/toca entrenar/descanso-o-sin-rutina) están todos
  alcanzables leyendo el código.
- [ ] Confirmar que `S.tab === 'hoy'` lleva de Inicio a Hoy y que no
  quedó ningún rastro del hack TEMP de Etapa 2b en `App.js`.
- [ ] Confirmar que `Rutina` maneja tanto el caso vacío (`!st.workoutCount`)
  como el caso con turnos, y que el expand/collapse de un turno no
  rompe con `slot.type === 'rest'`.
