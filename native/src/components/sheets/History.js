// native/src/components/sheets/History.js
// Puerto de web/src/components/sheets/History.jsx — todas las sesiones
// cerradas, agrupadas por semana. Se abre desde "Ver todas" de la sección
// Tus sesiones (Progreso), que muestra sólo las 8 más recientes.
//
// Antes este sheet era la ÚNICA forma de ver el historial y colgaba del reloj
// del header, con una fila plana por sesión. Ahora el reloj lleva a Progreso y
// esto es el desborde de esa sección.
import { View, Text, StyleSheet } from 'react-native';
import { S, useStore } from '../../lib/state.js';
import { groupSessionsByWeek } from '../../lib/session.js';
import SessionCard from '../../screens/SessionCard.js';

export default function History() {
  useStore();
  const grupos = groupSessionsByWeek(S.sessions);
  const n = S.sessions.length;

  return (
    <View>
      <Text style={styles.title}>Todas tus sesiones</Text>
      <Text style={styles.sub}>
        {n ? `${n} ${n === 1 ? 'sesión cerrada' : 'sesiones cerradas'}` : 'Todavía no cerraste ninguna sesión'}
      </Text>

      {!n ? (
        <View style={styles.card}>
          <Text style={styles.empty}>Tus sesiones completadas aparecerán acá.</Text>
        </View>
      ) : (
        grupos.map(g => (
          <View key={g.key} style={{ marginBottom: 10 }}>
            <Text style={styles.weekLabel}>{g.label} · {g.sessions.length} {g.sessions.length === 1 ? 'sesión' : 'sesiones'}</Text>
            {g.sessions.map(s => <SessionCard key={s.id} sess={s} />)}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sub: { color: '#8a93a6', fontSize: 13, marginTop: 2, marginBottom: 14 },
  card: { backgroundColor: '#0e1626', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,.08)' },
  empty: { color: '#8a93a6', fontSize: 13 },
  weekLabel: { color: '#8a93a6', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
});
