import { View, Text, StyleSheet } from 'react-native';
import { useStore } from '../lib/state.js';

export default function Inicio() {
  const S = useStore();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inicio</Text>
      <Text style={styles.sub}>{S.ready ? 'Datos cargados' : 'Cargando…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05070d' },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  sub: { color: '#8a93a6', fontSize: 14, marginTop: 8 },
});
