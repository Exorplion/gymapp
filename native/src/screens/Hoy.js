// native/src/screens/Hoy.js
// Puerto de web/src/components/screens/Hoy.jsx.
//
// Diferido a propósito: sólo `VoiceLogButton` (registro retroactivo por
// voz) — requiere reconocimiento de voz nativo, no instalado, sin
// dispositivo para probar. Mismo criterio que FoodVoice/ExerciseForm
// (Etapas 5j/5n). El sheet de destino ('voice-log') ya está portado —
// sólo falta el trigger.
//
// Del resto del original ya está: volumen muscular semanal
// (muscleVolume/uncategorized), cronómetro en vivo (ElapsedTimer, aislado
// para no re-renderizar toda la pantalla cada segundo), confirmaciones de
// completar/descartar sesión vía sheet 'confirm', sheet informativo
// SessStartInfo antes de abrir sesión, WarmupCard antes de la lista de
// ejercicios cuando toca calentar, los contadores de ejercicios
// completados/saltados y la caja de celebración al terminarlos todos
// (ActiveHero), y el empty-state de "este turno todavía no tiene
// ejercicios" cuando el día no tiene nada cargado.
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { S, useStore, bump, openSheet, closeSheet, saveDraft } from '../lib/state.js';
import { pendingSlot, sessionForSlot, startSession, discardSession, completeSession, orderedExs, sessionExs, nextPending, isSkipped, setsDone, targetSets } from '../lib/session.js';
import { dstr, fmtMMSS } from '../lib/format.js';
import { muscleVolume, uncategorized } from '../lib/muscle.js';
import { tocaCalentar, bloqueDe, DESCANSO } from '../lib/warmup.js';
import { startRest } from '../lib/rest.js';
import ExerciseList from './ExerciseList.js';
import WarmupCard from '../components/WarmupCard.js';

export default function Hoy() {
  useStore();
  const slot = pendingSlot();
  const active = !!S.draft;
  const index = active
    ? S.routine.findIndex(s => s.id === S.draft.slotId)
    : S.routine.findIndex(s => s.id === slot?.id);
  const hecha = slot ? sessionForSlot(slot.id) : null;
  const exs = active ? sessionExs(index) : orderedExs(index, slot?.exercises || []);
  const nextEx = active ? nextPending(exs) : null;
  // El próximo ejercicio a hacer decide qué calentamiento corresponde — no
  // necesariamente el primero del día: puede ser el primero de un bloque
  // nuevo (ver lib/warmup.js).
  const exCalentar = active ? (nextEx || exs[0]) : null;

  /* El calentamiento se marca hecho por BLOQUE en el borrador y no en un
     estado local: así sobrevive a cerrar la app en el medio, que es
     exactamente cuando pasa —dejás el teléfono, calentás, volvés—. Si
     viviera en React, al volver te lo ofrecería otra vez. */
  async function cerrarCalentamiento(conDescanso) {
    if (!S.draft || !exCalentar) return;
    const bloque = bloqueDe(exCalentar);
    if (bloque) {
      if (!Array.isArray(S.draft.warmBlocks)) S.draft.warmBlocks = [];
      if (!S.draft.warmBlocks.includes(bloque)) S.draft.warmBlocks.push(bloque);
    }
    await saveDraft();
    bump();
    if (conDescanso) startRest(DESCANSO);
  }
  const terminarCalentamiento = () => cerrarCalentamiento(true);
  const saltarCalentamiento = () => cerrarCalentamiento(false);

  const mv = muscleVolume(7);
  const mvCats = Object.entries(mv).sort((a, b) => b[1] - a[1]);
  const maxv = mvCats.length ? mvCats[0][1] : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.containerContent} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backRow} onPress={() => { S.tab = 'inicio'; bump(); }}>
        <Text style={styles.backText}>‹ Inicio</Text>
      </Pressable>
      <Text style={styles.title}>Hoy</Text>
      {active ? (
        <ActiveHero slot={slot} exs={exs} />
      ) : slot?.type === 'rest' ? (
        <RestHero />
      ) : hecha ? (
        <DoneHero hecha={hecha} />
      ) : (
        <PreSessionHero slot={slot} index={index} />
      )}

      {mvCats.length > 0 && (
        <>
          <Text style={styles.sect}>Músculos esta semana</Text>
          <View style={styles.card}>
            {mvCats.map(([c, n]) => (
              <View key={c} style={{ marginBottom: 14 }}>
                <View style={styles.mvRow}>
                  <Text style={styles.mvCat}>{c}</Text>
                  <Text style={styles.mvNum}>{n} series</Text>
                </View>
                <View style={styles.pbar}>
                  <View style={[styles.pbarFill, { width: `${Math.round(n / maxv * 100)}%` }]} />
                </View>
              </View>
            ))}
            <Text style={styles.mvNote}>
              10–20 series semanales por grupo es el rango habitual para ganar masa.
            </Text>
            <SinGrupoAviso />
          </View>
        </>
      )}

      {exs.length > 1 && (
        <Pressable style={styles.reorderBtn} onPress={() => openSheet('reorder-hoy')}>
          <Text style={styles.reorderBtnText}>↕ Reordenar</Text>
        </Pressable>
      )}
      {!active && exs.length > 0 && (
        <Pressable style={styles.reorderBtn} onPress={() => openSheet('preworkout')}>
          <Text style={styles.reorderBtnText}>⚡ Pre-workout</Text>
        </Pressable>
      )}
      {active && exCalentar && tocaCalentar(S.draft, exCalentar) && (
        <WarmupCard
          ex={exCalentar}
          onListo={terminarCalentamiento}
          onSaltar={saltarCalentamiento}
        />
      )}
      {!exs.length ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            Este turno todavía no tiene ejercicios.{'\n'}Configuralo en la pestaña Rutina.
          </Text>
          <Pressable style={styles.reorderBtn} onPress={() => { S.tab = 'rutina'; bump(); }}>
            <Text style={styles.reorderBtnText}>Configurar rutina</Text>
          </Pressable>
        </View>
      ) : (
        <ExerciseList exs={exs} wd={index} active={active} started={active && !!S.draft.start} curId={active ? S.draft.cur : null} nextEx={nextEx} />
      )}
      {active && (
        <Pressable style={styles.reorderBtn} onPress={() => openSheet('ex-swap', { wd: index })}>
          <Text style={styles.reorderBtnText}>+ Agregar ejercicio a esta sesión</Text>
        </Pressable>
      )}
      <Text style={styles.sect}>Esta semana</Text>
      <View style={styles.card}>
        <WeekHistory />
      </View>
    </ScrollView>
  );
}

/** Los ejercicios sin grupo muscular no suman en esta tarjeta. Antes se
    descartaban en silencio; ahora se dicen y se pueden asignar. */
function SinGrupoAviso() {
  const sin = uncategorized();
  if (!sin.length) return null;
  return (
    <Pressable style={styles.sinGrupo} onPress={() => { S.tab = 'rutina'; S.rutMode = 'edit'; bump(); }}>
      <Text style={styles.sinGrupoT}>
        {sin.length} ejercicio{sin.length === 1 ? '' : 's'} sin grupo muscular · no suma{sin.length === 1 ? '' : 'n'} acá
      </Text>
      <Text style={styles.sinGrupoS}>{sin.slice(0, 4).map(e => e.name).join(' · ')}{sin.length > 4 ? ` +${sin.length - 4}` : ''}</Text>
      <Text style={styles.sinGrupoA}>Asignar →</Text>
    </Pressable>
  );
}

/** Cronómetro en vivo de la sesión — aislado en su propio componente con
    su propio tick de 1s, así no re-renderiza toda la pantalla de Hoy. */
function ElapsedTimer({ start }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <Text style={styles.elapsed}>{fmtMMSS(Math.floor((Date.now() - start) / 1000))}</Text>;
}

function WeekHistory() {
  const cutoff = dstr(new Date(Date.now() - 7 * 86400000));
  const recent = S.sessions.filter(s => s.date >= cutoff);
  if (!recent.length) {
    return <Text style={styles.mut}>Todavía no hay sesiones esta semana.</Text>;
  }
  return recent.map(s => (
    <Pressable key={s.id} style={styles.histRow} onPress={() => openSheet('session-view', { id: s.id })}>
      <Text style={styles.histTitle}>{s.dayName}</Text>
      <Text style={styles.histDate}>{s.date}</Text>
    </Pressable>
  ));
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
        <Pressable style={styles.ctaBtn} onPress={() => openSheet('sess-start-info', { index })}>
          <Text style={styles.ctaBtnText}>Empezar entrenamiento</Text>
        </Pressable>
      )}
    </View>
  );
}

function confirmSessDone() {
  openSheet('confirm', {
    title: 'Completar sesión',
    body: '¿Completar y guardar la sesión?',
    confirmLabel: 'Completar',
    onConfirm: () => completeSession(),
  });
}

function confirmSessDiscard() {
  openSheet('confirm', {
    title: 'Descartar sesión',
    body: '¿Descartar la sesión en curso? Se pierde todo lo registrado.',
    confirmLabel: 'Descartar',
    onConfirm: () => discardSession(),
  });
}

function ActiveHero({ slot, exs }) {
  const entries = S.draft?.entries || {};
  const nsets = Object.values(entries).reduce((a, e) => a + e.sets.length, 0);
  const started = !!S.draft?.start;
  const doneEx = exs.filter(e => !isSkipped(e.id) && setsDone(e.id).length >= targetSets(e)).length;
  const nSkip = exs.filter(e => isSkipped(e.id)).length;
  const allDone = exs.length > 0 && doneEx + nSkip >= exs.length;
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Sesión en curso</Text>
      <Text style={styles.heroDay}>{S.draft?.dayName || slot?.name || 'Entrenamiento'}</Text>
      <Text style={styles.mut}>
        {started
          ? <><ElapsedTimer start={S.draft.start} />{' · '}{doneEx}/{exs.length - nSkip} ejercicios{' · '}{nsets} serie{nsets === 1 ? '' : 's'}{nSkip > 0 ? ` · ${nSkip} saltado${nSkip === 1 ? '' : 's'}` : ''}</>
          : 'El reloj arranca cuando inicies el primer ejercicio'}
      </Text>
      {allDone && (
        <View style={styles.calcbox}>
          <Text style={styles.calcboxText}>
            🎉 Terminaste los {exs.length - nSkip} ejercicios que hiciste hoy.
            {nSkip > 0 ? ` Saltaste ${nSkip}.` : ''} Cerrá la sesión para guardarla.
          </Text>
        </View>
      )}
      <View style={styles.rowGap}>
        <Pressable style={[styles.smallBtn, styles.okBtn]} onPress={confirmSessDone}>
          <Text style={styles.smallBtnText}>✓ Completar sesión</Text>
        </Pressable>
        <Pressable style={[styles.smallBtn, styles.dimBtn]} onPress={confirmSessDiscard}>
          <Text style={styles.smallBtnText}>Descartar</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Sheet informativo previo a abrir la sesión — registrado en SheetHost.js
    como 'sess-start-info'. Separado de startSession(), que arranca cuando
    se toca "Abrir sesión" acá adentro. */
export function SessStartInfo({ index }) {
  const day = S.routine[index];
  const n = day?.exercises?.length || 0;
  return (
    <View style={styles.sheetWrap}>
      <Text style={styles.sheetH2}>Iniciar entrenamiento</Text>
      <Text style={styles.sheetSub}>
        Vas a abrir la sesión de <Text style={styles.sheetB}>{day?.name || 'Entrenamiento'}</Text> · {n} ejercicio{n === 1 ? '' : 's'}.
      </Text>
      <View style={styles.calcbox}>
        <Text style={styles.calcboxText}>⏱ El cronómetro arranca cuando toques "Iniciar ejercicio", no ahora. Así el tiempo mide lo que entrenaste y no lo que tardaste en cambiarte, calentar y llegar a la máquina.</Text>
      </View>
      <View style={styles.calcbox}>
        <Text style={styles.calcboxText}>↕ Antes de arrancar podés reacomodar el orden con el botón "Reordenar", por si la máquina está ocupada.</Text>
      </View>
      <View style={styles.calcbox}>
        <Text style={styles.calcboxText}>✓ Vas de a un ejercicio: al llegar a las series objetivo se cierra solo y pasás al siguiente.</Text>
      </View>
      <Pressable style={styles.ctaBtn} onPress={() => { closeSheet(); startSession(index); }}>
        <Text style={styles.ctaBtnText}>Abrir sesión</Text>
      </Pressable>
      <Pressable style={[styles.smallBtn, styles.dimBtn, { marginTop: 10 }]} onPress={closeSheet}>
        <Text style={styles.smallBtnText}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070d' },
  containerContent: { padding: 18 },
  backRow: { alignSelf: 'flex-start', marginBottom: 10 },
  backText: { color: '#2e7dff', fontSize: 14, fontWeight: '600' },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 16 },
  reorderBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginTop: 14 },
  reorderBtnText: { color: '#c7cdda', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#0e1626', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,.08)' },
  emptyText: { color: '#8a93a6', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  eyebrow: { color: '#2e7dff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroDay: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 4 },
  mut: { color: '#8a93a6', fontSize: 13, marginTop: 6 },
  elapsed: { color: '#fff', fontWeight: '700' },
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
  sect: { color: '#8a93a6', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.06)' },
  histTitle: { color: '#fff', fontSize: 14 },
  histDate: { color: '#8a93a6', fontSize: 13 },
  mvRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  mvCat: { color: '#c7cdda', fontSize: 13 },
  mvNum: { color: '#8a93a6', fontSize: 13, fontWeight: '600' },
  pbar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.08)', overflow: 'hidden' },
  pbarFill: { height: '100%', borderRadius: 3, backgroundColor: '#2e7dff' },
  mvNote: { color: '#8a93a6', fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  sinGrupo: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,179,71,.1)' },
  sinGrupoT: { color: '#ffb347', fontSize: 12.5, fontWeight: '700' },
  sinGrupoS: { color: '#8a93a6', fontSize: 11.5, marginTop: 4 },
  sinGrupoA: { color: '#ffb347', fontSize: 12, fontWeight: '700', marginTop: 6 },
  sheetWrap: { paddingHorizontal: 20 },
  sheetH2: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  sheetSub: { color: '#8a93a6', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  sheetB: { color: '#6ea8ff', fontWeight: '700' },
  calcbox: { backgroundColor: 'rgba(255,255,255,.05)', borderRadius: 12, padding: 12, marginTop: 10 },
  calcboxText: { color: '#c7cdda', fontSize: 14, lineHeight: 20 },
});
