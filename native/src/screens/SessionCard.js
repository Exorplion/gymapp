// native/src/screens/SessionCard.js
// Puerto simplificado de web/src/components/SessionCard.jsx — fila de una
// sesión en el historial.
//
// La web abre un sheet de detalle (`openSheet('session-view', {id})`) al
// tocar la tarjeta, sin distinguir si la sesión es de hoy o no. Ese sheet ya
// existe acá (session-view, Etapa 5), así que este puerto hace lo mismo.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { openSheet } from '../lib/state.js';
import { WDS, fmtD } from '../lib/format.js';
import { sessionPRs } from '../lib/session.js';

export default function SessionCard({ sess }) {
  const nsets = (sess.entries || []).reduce((a, e) => a + e.sets.length, 0);
  const vol = Math.round((sess.entries || []).reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0));
  const nprs = sessionPRs(sess).length;
  const names = (sess.entries || []).map(e => e.name).join(' · ');
  const wd = new Date(sess.date + 'T12:00:00').getDay();

  return (
    <Pressable style={styles.card} onPress={() => openSheet('session-view', { id: sess.id })}>
      <View style={styles.top}>
        <Text style={styles.badge}>{WDS[wd]}</Text>
        <Text style={styles.name} numberOfLines={1}>{sess.dayName || 'Entrenamiento'}</Text>
        {nprs > 0 && <Text style={styles.pr}>🏆{nprs}</Text>}
      </View>
      <Text style={styles.meta}>{fmtD(sess.date)} · {sess.duration} min</Text>
      <Text style={styles.metaStrong}>{nsets} series · {vol.toLocaleString('es')} kg de volumen</Text>
      {names ? <Text style={styles.exs} numberOfLines={1}>{names}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0e1626', borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,.08)',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    color: '#8a93a6', fontSize: 11, fontWeight: '700', backgroundColor: 'rgba(255,255,255,.06)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  name: { color: '#fff', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  pr: { marginLeft: 'auto', color: '#f5b942', fontSize: 12, fontWeight: '700' },
  meta: { color: '#8a93a6', fontSize: 12, marginTop: 6 },
  metaStrong: { color: '#c7cdda', fontSize: 12, fontWeight: '600', marginTop: 2 },
  exs: { color: '#8a93a6', fontSize: 11, marginTop: 6 },
});
