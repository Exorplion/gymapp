// native/src/screens/Inicio.js
// Puerto de web/src/components/screens/Inicio.jsx — SIN la silueta
// muscular (Silhouette.jsx, Etapa 4) ni su leyenda de colores. El "grupo
// más olvidado" se muestra como texto (StaleLine), igual que el original,
// porque es dato puro (muscle.js) y no depende de la silueta.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { S, useStore, bump, openSheet } from '../lib/state.js';
import { WDS, MO } from '../lib/format.js';
import { pendingSlot, sessionForSlot } from '../lib/session.js';
import { daysSinceAll, stalestGroups } from '../lib/muscle.js';
import { C } from '../theme';

export default function Inicio({ navigation }) {
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
    ctaLabel = 'VER LO QUE HICISTE'; ctaSub = null; onCta = () => openSheet('session-view', { id: hecha.id });
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
    onCta = hayRutina ? irAHoy : () => navigation.navigate('Rutina');
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
  container: { flex: 1, backgroundColor: C.bg, padding: 18, justifyContent: 'center' },
  top: { marginBottom: 24 },
  eyebrow: { color: C.blue, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: C.txt, fontSize: 34, fontWeight: '800', marginTop: 6 },
  sub: { color: C.mut, fontSize: 15, marginTop: 6 },
  stale: { color: '#ffb347', fontSize: 13, marginBottom: 24 },
  cta: { backgroundColor: C.blue, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaText: { color: C.txt, fontWeight: '800', fontSize: 17, letterSpacing: 0.5 },
  ctaSubText: { color: C.txt, fontSize: 12, marginTop: 2 },
});
