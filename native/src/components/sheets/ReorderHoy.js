// Puerto de web/src/components/sheets/ReorderHoy.jsx (31 líneas) — el
// original usa drag.js (data-sort/data-sid, pointer-event dragging a mano)
// para reordenar; ese archivo está explícitamente fuera de alcance de esta
// migración (sin device para verificar gestos). Igual que el editor de
// rutina (Rutina.js, Etapa 3) y Silhouette.js (Etapa 4a), acá el reorden se
// hace con botones ↑/↓ por fila en vez de arrastre — mismo patrón visual
// (miniBtn/miniBtnDisabled) que ya usa ExerciseList dentro de Rutina.js.
//
// Persistencia: setExOrder(index, ids) (session.js línea 79) — NO
// commitSort() (eso es sólo del original, ligado a drag.js). setExOrder ya
// distingue sesión abierta (S.draft.order) de sin sesión (S.hoyOrder), así
// que no hace falta ninguna lógica nueva acá, sólo llamarla con el nuevo
// array de ids tras mover un elemento.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { S, closeSheet, bump } from '../../lib/state.js';
import { orderedExs, setExOrder } from '../../lib/session.js';
import { C } from '../../theme';

export default function ReorderHoy() {
  const index = S.cfg.seqIndex;
  const exs = orderedExs(index, S.routine[index]?.exercises || []);

  async function move(exId, dir) {
    const ids = exs.map(e => e.id);
    const i = ids.indexOf(exId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await setExOrder(index, ids);
    bump();
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Reordenar</Text>
      <View style={styles.hint}>
        <Text style={styles.hintIcon}>↕</Text>
        <Text style={styles.hintText}>Usá las flechas para cambiar el orden.</Text>
      </View>

      <View style={styles.list}>
        {exs.map((ex, k) => (
          <View key={ex.id} style={styles.row}>
            <View style={styles.grow}>
              <Text style={styles.t}>{ex.name}</Text>
              <Text style={styles.s}>{ex.sets} × {ex.reps}</Text>
            </View>
            <Pressable
              style={[styles.miniBtn, k === 0 && styles.miniBtnDisabled]}
              disabled={k === 0}
              onPress={() => move(ex.id, -1)}
            >
              <Text style={styles.miniBtnText}>↑</Text>
            </Pressable>
            <Pressable
              style={[styles.miniBtn, k === exs.length - 1 && styles.miniBtnDisabled]}
              disabled={k === exs.length - 1}
              onPress={() => move(ex.id, 1)}
            >
              <Text style={styles.miniBtnText}>↓</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Pressable style={styles.doneBtn} onPress={closeSheet}>
        <Text style={styles.doneBtnText}>Listo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 12 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  hintIcon: { color: C.mut, fontSize: 16 },
  hintText: { color: C.mut, fontSize: 13, flexShrink: 1 },

  list: { marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  grow: { flex: 1 },
  t: { color: C.txt, fontSize: 14, fontWeight: '600' },
  s: { color: C.mut, fontSize: 12, marginTop: 2 },

  miniBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  miniBtnDisabled: { opacity: 0.3 },
  miniBtnText: { color: C.txt, fontSize: 15, fontWeight: '700' },

  doneBtn: { backgroundColor: C.card2, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  doneBtnText: { color: C.txt, fontWeight: '700', fontSize: 15 },
});
