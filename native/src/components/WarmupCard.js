// Puerto de web/src/components/WarmupCard.jsx.
//
// El calentamiento antes de la primera serie de cada bloque muscular del día.
//
// Aparece al empezar el bloque y desaparece en cuanto registrás algo de él: es
// un recordatorio para un momento puntual, no una tarjeta más de la pantalla.
//
// Dos partes, en orden: primero movilidad general del bloque (nada que
// levantar, nada que registrar), después la rampa numérica de ESTE ejercicio.
// La rampa calienta el patrón y el peso; la movilidad calienta la
// articulación entera, que es lo que hace falta de más al entrar en frío a
// piernas después de una hora de tren superior.
//
// Muestra los pesos ya calculados en vez del porcentaje. "50%" te obliga a
// hacer la cuenta parado frente a la barra; "42.5 kg × 5" se carga y se levanta.
// El porcentaje va igual, chiquito, para el que quiera ver de dónde sale.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { S, wDisplay, wStep } from '../lib/state.js';
import { warmupSets, MOVILIDAD, DESCANSO, bloqueDe } from '../lib/warmup.js';
import { lastDataFor } from '../lib/session.js';
import { fmtMMSS } from '../lib/format.js';
import { C } from '../theme';

export default function WarmupCard({ ex, onListo, onSaltar }) {
  /* El peso de trabajo sale de lo que tengas cargado hoy y, si todavía no
     tocaste nada, de la última vez que lo hiciste.

     No se usa ensureVals() —que sería lo obvio— porque esa función RELLENA
     S.hoyVals con 20 kg cuando no hay historial, y calcular una rampa sobre un
     relleno daría tres pesos inventados con toda la pinta de ser reales. */
  const top = S.hoyVals[ex.id]?.w ?? lastDataFor(ex)?.at(-1)?.w;
  // el paso sale de la unidad activa: en libras el incremento real es otro
  const series = warmupSets(top, wStep());
  const movilidad = MOVILIDAD[bloqueDe(ex)] || [];

  // Sin peso de trabajo no hay porcentaje que calcular. Es el caso de un
  // ejercicio estrenado hoy: mejor no mostrar nada que mostrar tres ceros.
  // La movilidad sola, sin ninguna rampa debajo, no sería un calentamiento —
  // sería una lista suelta sin conexión con lo que vas a levantar.
  if (!series.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.eyebrow}>Calentamiento · {ex.name}</Text>
        <Pressable onPress={onSaltar} hitSlop={8}>
          <Text style={styles.skip}>Saltar</Text>
        </Pressable>
      </View>

      {movilidad.length > 0 && (
        <View style={styles.mov}>
          {movilidad.map((m, i) => (
            <Text key={i} style={styles.movItem}>· {m}</Text>
          ))}
        </View>
      )}

      <View style={styles.list}>
        {series.map((s, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.n}>{i + 1}</Text>
            <Text style={styles.w}>
              {wDisplay(s.w)}<Text style={styles.unit}>{S.cfg.unit}</Text>
            </Text>
            <Text style={styles.x}>× {s.reps}</Text>
            <Text style={styles.pct}>{Math.round(s.pct * 100)}%</Text>
          </View>
        ))}
      </View>

      <Text style={styles.nota}>
        Las tres seguidas, sin descanso. Después <Text style={styles.notaB}>{fmtMMSS(DESCANSO)}</Text> y vas a tu primera serie.
      </Text>

      <Pressable style={styles.btn} onPress={onListo}>
        <Text style={styles.btnText}>Listo · arrancar el descanso</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginBottom: 12,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  eyebrow: { color: C.mut, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 1 },
  skip: { color: C.mut, fontSize: 13, fontWeight: '700' },

  mov: { marginBottom: 12 },
  movItem: { color: C.mut, fontSize: 13, lineHeight: 19 },

  list: { marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  n: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.line,
    color: C.txt, fontSize: 11, fontWeight: '800',
    textAlign: 'center', lineHeight: 20,
  },
  w: { color: C.txt, fontSize: 16, fontWeight: '800' },
  unit: { color: C.mut, fontSize: 11, fontWeight: '600' },
  x: { color: C.mut, fontSize: 14, fontWeight: '600' },
  pct: { color: C.mut, fontSize: 12, fontWeight: '600', marginLeft: 'auto' },

  nota: { color: C.mut, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  notaB: { color: C.txt, fontWeight: '700' },

  btn: {
    backgroundColor: C.blue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: { color: C.txt, fontSize: 14, fontWeight: '800' },
});
