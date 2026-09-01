// Puerto de web/src/App.jsx's ConfirmSheet (inline, líneas 53-66) — diálogo
// de confirmación genérico usado por rutina-logic.js/templates.js vía
// openSheet('confirm', {title, body, confirmLabel, onConfirm, onCancel}).
// Reemplaza el puente de Alert.alert de Etapa 3 (Library.js): ahora que
// SheetHost tiene un registro real, este componente resuelve el type
// 'confirm' directamente, sin interceptar nada.
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { closeSheet } from '../../lib/state.js';
import { C } from '../../theme';

export default function ConfirmSheet({ title, body, confirmLabel, onConfirm, onCancel }) {
  function cancel() { if (onCancel) onCancel(); else closeSheet(); }
  function confirm() { closeSheet(); onConfirm?.(); }
  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.row}>
        <Pressable style={styles.ghostBtn} onPress={cancel}>
          <Text style={styles.ghostBtnText}>Cancelar</Text>
        </Pressable>
        <Pressable style={styles.dangerBtn} onPress={confirm}>
          <Text style={styles.dangerBtnText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 10 },
  body: { color: C.mut, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  row: { flexDirection: 'row', gap: 10 },
  ghostBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.line2 },
  ghostBtnText: { color: C.txt, fontSize: 13, fontWeight: '600' },
  dangerBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, backgroundColor: C.red },
  dangerBtnText: { color: C.txt, fontSize: 13, fontWeight: '700' },
});
