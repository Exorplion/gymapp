// native/src/screens/Hoy.js
// Puerto de web/src/components/screens/Hoy.jsx — SIN el carrusel
// deslizable, calentamiento, pre-workout, registro por voz ni barra de
// volumen muscular (recortado a propósito, ver el plan de esta etapa).
// La lista de ejercicios se agrega en Task 2; acá sólo van los tres
// estados base de la tarjeta principal.
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { S, useStore, bump, openSheet } from '../lib/state.js';
import { pendingSlot, sessionForSlot, startSession, discardSession, completeSession, orderedExs, sessionExs, nextPending } from '../lib/session.js';
import { dstr } from '../lib/format.js';
import ExerciseList from './ExerciseList.js';

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.containerContent} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backRow} onPress={() => { S.tab = 'inicio'; bump(); }}>
        <Text style={styles.backText}>‹ Inicio</Text>
      </Pressable>
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
      <ExerciseList exs={exs} active={active} started={active && !!S.draft.start} curId={active ? S.draft.cur : null} nextEx={nextEx} />
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
      <Text style={styles.heroDay}>{S.draft?.dayName || slot?.name || 'Entrenamiento'}</Text>
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
  container: { flex: 1, backgroundColor: '#05070d' },
  containerContent: { padding: 18 },
  backRow: { alignSelf: 'flex-start', marginBottom: 10 },
  backText: { color: '#2e7dff', fontSize: 14, fontWeight: '600' },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 16 },
  reorderBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginTop: 14 },
  reorderBtnText: { color: '#c7cdda', fontSize: 13, fontWeight: '600' },
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
  sect: { color: '#8a93a6', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.06)' },
  histTitle: { color: '#fff', fontSize: 14 },
  histDate: { color: '#8a93a6', fontSize: 13 },
});
