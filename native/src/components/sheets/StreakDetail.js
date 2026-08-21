// Puerto de web/src/components/sheets/StreakDetail.jsx (30 líneas) — heatmap
// de 56 días + racha actual/mejor/% de cumplimiento. Reusa streak.js
// (streakHeatmap/currentStreak/bestStreak) tal cual, sin reimplementar la
// lógica — es el mismo dato que ya pinta el heatmap inline de Progreso.js
// (Etapa 4a), acá sólo en vista de detalle dentro de un sheet.
//
// El original usa <Flame/> de Icon.jsx; no hay Icon.js portado todavía en
// RN, así que se usa el mismo emoji 🔥 que ya usan Rutina.js/Progreso.js en
// vez de agregar un componente de ícono nuevo sólo para este sheet.
import { View, Text, StyleSheet } from 'react-native';
import { streakHeatmap, currentStreak, bestStreak } from '../../lib/streak.js';
import { fmtDFull } from '../../lib/format.js';

const GREEN = '#1fbf75';

export default function StreakDetail() {
  const { days, pct } = streakHeatmap();
  const colorOf = status => status === 'done' ? GREEN : status === 'miss' ? '#e0505a' : 'rgba(255,255,255,.08)';

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>🔥 Racha</Text>

      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.n}>{currentStreak()}</Text><Text style={styles.l}>Actual</Text></View>
        <View style={styles.stat}><Text style={styles.n}>{bestStreak()}</Text><Text style={styles.l}>Mejor</Text></View>
        <View style={styles.stat}><Text style={styles.n}>{pct}%</Text><Text style={styles.l}>Cumplimiento</Text></View>
      </View>

      <View style={styles.heatGrid}>
        {days.map(d => (
          <View key={d.date} style={[styles.cell, { backgroundColor: colorOf(d.status) }]} />
        ))}
      </View>

      <Text style={styles.footer}>
        Últimos 56 días · un día cuenta si tenía rutina asignada y completaste la
        sesión. Los días de descanso no suman ni cortan la racha.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: '#fff', fontSize: 19, fontWeight: '700', marginBottom: 14 },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  n: { color: '#fff', fontSize: 22, fontWeight: '700' },
  l: { color: '#8a93a6', fontSize: 11, marginTop: 2 },
  heatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 20 },
  cell: { width: '11.5%', aspectRatio: 1, borderRadius: 3 },
  footer: { color: '#8a93a6', fontSize: 12, lineHeight: 17, marginTop: 14 },
});
