// Puerto de web/src/components/sheets/IllusPick.jsx — elegir la ilustración
// del movimiento para un ejercicio.
//
// Va EMBEBIDO en el formulario (ExerciseForm), no como sheet propio: el
// sheet host tiene una sola ranura, así que abrir un sheet desde otro
// reemplazaría al primero y se perdería todo lo que hubieras escrito
// (nombre, series, equipo, foto). Por eso NO está en components/sheets/ ni
// registrado en SHEET_REGISTRY — es un componente hijo normal.
//
// Se elige a mano una sola vez, en vez de adivinar automáticamente: la base
// es en inglés y tus ejercicios están en español, así que un emparejamiento
// automático acertaría a veces y pondría la ilustración equivocada el
// resto — y una ilustración equivocada de un ejercicio es peor que ninguna.
//
// La búsqueda arranca con el nombre de tu ejercicio ya escrito, y entiende
// vocabulario en español (ver lib/illustrations.js).
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, StyleSheet } from 'react-native';
import { searchIllus, illusUrl } from '../lib/illustrations.js';

export default function IllusPick({ exName = '', onPick, onClose }) {
  const [q, setQ] = useState(exName);
  const results = useMemo(() => searchIllus(q), [q]);

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.label}>Elegí la ilustración</Text>
        <Pressable onPress={() => onClose?.()} hitSlop={8}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Buscá el movimiento y tocá el que corresponda. Las imágenes son de
        free-exercise-db, de dominio público.
      </Text>

      <TextInput
        style={styles.input}
        value={q}
        onChangeText={setQ}
        placeholder="press banca, sentadilla, jalón…"
        placeholderTextColor="#6b7280"
      />

      {results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {q.trim() ? 'Nada con ese nombre. Probá con otra palabra.' : 'Escribí el nombre del movimiento.'}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {results.map(it => (
            <Pressable
              key={it.id}
              style={styles.opt}
              onPress={() => { onPick?.(it.id); onClose?.(); }}
            >
              <Image source={{ uri: illusUrl(it.id) }} style={styles.optImg} resizeMode="cover" />
              <Text style={styles.optName} numberOfLines={2}>{it.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#fff', fontSize: 15, fontWeight: '700' },
  close: { color: '#8a93a6', fontSize: 16, paddingHorizontal: 6 },
  hint: { color: '#8a93a6', fontSize: 13, marginTop: 2, marginBottom: 14 },
  input: {
    color: '#fff', fontSize: 15, backgroundColor: 'rgba(255,255,255,.06)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
  },
  empty: { padding: 18, alignItems: 'center', backgroundColor: 'rgba(255,255,255,.04)', borderRadius: 12 },
  emptyText: { color: '#8a93a6', fontSize: 14, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  opt: { width: '47%', backgroundColor: 'rgba(255,255,255,.05)', borderRadius: 12, padding: 8 },
  optImg: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.06)' },
  optName: { color: '#c7cdda', fontSize: 12.5, marginTop: 6, textAlign: 'center' },
});
