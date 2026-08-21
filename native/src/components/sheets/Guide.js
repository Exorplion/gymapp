// Puerto verbatim de web/src/components/sheets/Guide.jsx (21 líneas).
// Contenido estático, sin estado ni acciones — se cierra deslizando el
// sheet hacia abajo o tocando el backdrop (SheetHost.js ya lo resuelve),
// igual que el original no traía botón de cierre propio.
import { View, Text, StyleSheet } from 'react-native';

export default function Guide() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Cómo leer tu progreso</Text>

      <Text style={styles.h3}>⚖️ El peso fluctúa</Text>
      <Text style={styles.p}>Variar 1-2 kg en un día es normal (agua, glucógeno, sodio, digestión). Pésate a diario en las mismas condiciones y mira el <Text style={styles.b}>promedio semanal</Text>, no el número de un día suelto.</Text>

      <Text style={styles.h3}>💪 Recomposición: mira el gym, no la balanza</Text>
      <Text style={styles.p}>Ganar músculo en déficit es real pero lento (~0.5-1 kg en 3-4 meses) e invisible en la balanza. El mejor indicador de que estás reteniendo/ganando músculo es que <Text style={styles.b}>tus pesos en el gym se mantienen o suben</Text>. Dale más peso a la fuerza que al número.</Text>

      <Text style={styles.h3}>🧪 Creatina</Text>
      <Text style={styles.p}>5 g/día todos los días (incluso descanso), sin fase de carga; el timing da igual, solo importa la constancia. Sube +1-2 kg en la balanza los primeros 7-10 días por <Text style={styles.b}>agua intracelular — no es grasa</Text>.</Text>

      <Text style={styles.h3}>🏃 Cardio en déficit</Text>
      <Text style={styles.p}>El cuello de botella de perder grasa casi nunca es el cardio, es el control calórico. En días de descanso, 25-30 min moderados suman ~200-250 kcal. Evítalo justo después de sesiones largas de pesas (interfiere con la recuperación).</Text>

      <Text style={styles.h3}>🎯 Expectativas</Text>
      <Text style={styles.p}>Pérdida de grasa saludable: ~0.25-0.3 kg/sem con déficit de ~300 kcal. Abs visibles requieren ~10-12% de grasa — la mayoría subestima cuánto falta. El mismo peso con más músculo se ve muy distinto.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: '#fff', fontSize: 19, fontWeight: '700', marginBottom: 12 },
  h3: { color: '#fff', fontSize: 14.5, fontWeight: '700', marginTop: 14, marginBottom: 4 },
  p: { color: '#8a93a6', fontSize: 13.5, lineHeight: 19 },
  b: { color: '#c7cdda', fontWeight: '700' },
});
