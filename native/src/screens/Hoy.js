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
