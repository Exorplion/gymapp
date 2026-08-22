// Puerto de web/src/components/sheets/BodyForm.jsx (87 líneas). Mismo
// criterio que los otros sheets con formularios: los 5 campos numéricos son
// inputs controlados que guardan el string tal cual lo tipeó el usuario —
// nunca se reescribe el value= del propio input en su propio onChange (la
// causa raíz de un bug ya corregido en una task anterior del proyecto
// original, según el comentario del archivo fuente). El parseFloat/clamping
// sólo pasa una vez, al guardar.
//
// A diferencia de otros forms, acá los campos arrancan VACÍOS (no
// precargados con el último registro) — el original sólo pone el último
// valor como placeholder (pista visual), no como value inicial: dejar un
// campo en blanco al guardar significa "no registro este dato hoy", no
// "repetí el valor de la vez pasada". save() lo refleja con num():
// parseFloat('') es NaN → null → esa columna queda null en el registro.
//
// Autofocus del campo de peso: igual que el original (setTimeout de 80ms
// tras montar), necesario porque el sheet recién terminó su animación de
// apertura — enfocar antes no hace nada en RN.
import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { S, closeSheet, saveCfg } from '../../lib/state.js';
import { uid, dstr } from '../../lib/format.js';
import { applyComputedGoals } from '../../lib/macros.js';
import { idb } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';

export default function BodyForm() {
  const last = S.body[S.body.length - 1] || {};
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [arm, setArm] = useState('');
  const [chest, setChest] = useState('');
  const [leg, setLeg] = useState('');
  const weightRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => weightRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  async function save() {
    const num = raw => { const v = parseFloat(raw); return isNaN(v) ? null : v; };
    const rec = { id: uid(), date: dstr(), weight: num(weight), waist: num(waist), arm: num(arm), chest: num(chest), leg: num(leg) };
    if (rec.weight == null && rec.waist == null && rec.arm == null && rec.chest == null && rec.leg == null) {
      toast('Ingresa al menos un dato');
      return;
    }
    await idb.put('body', rec);
    S.body.push(rec);
    S.body.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    // sincroniza el peso del perfil → recalcula macros (Sección 0: nada fijo).
    // El original llama saveCfg() en las dos ramas del if/else de
    // applyComputedGoals() — o sea, siempre guarda si hay peso nuevo,
    // recalcule o no las metas automáticas. Se porta tal cual, sin "arreglar"
    // el if/else redundante.
    if (rec.weight != null) {
      S.cfg.profile.weightKg = rec.weight;
      applyComputedGoals();
      await saveCfg();
    }
    closeSheet();
    toast(S.cfg.goalsAuto && rec.weight != null ? 'Registro guardado · macros actualizadas' : 'Registro guardado');
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Registro corporal</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Peso (kg)</Text>
        <TextInput
          ref={weightRef}
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder={String(last.weight ?? '70.0')}
          placeholderTextColor="#5a6478"
          value={weight}
          onChangeText={setWeight}
        />
      </View>

      <View style={styles.row2}>
        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>Cintura (cm)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder={String(last.waist ?? '—')}
            placeholderTextColor="#5a6478"
            value={waist}
            onChangeText={setWaist}
          />
        </View>
        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>Brazo (cm)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder={String(last.arm ?? '—')}
            placeholderTextColor="#5a6478"
            value={arm}
            onChangeText={setArm}
          />
        </View>
      </View>

      <View style={styles.row2}>
        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>Pecho (cm)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder={String(last.chest ?? '—')}
            placeholderTextColor="#5a6478"
            value={chest}
            onChangeText={setChest}
          />
        </View>
        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>Pierna (cm)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder={String(last.leg ?? '—')}
            placeholderTextColor="#5a6478"
            value={leg}
            onChangeText={setLeg}
          />
        </View>
      </View>

      <Pressable style={styles.btn} onPress={save}>
        <Text style={styles.btnText}>Guardar registro</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: '#fff', fontSize: 19, fontWeight: '700', marginBottom: 14 },
  field: { marginBottom: 14 },
  row2: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  label: { color: '#8a93a6', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
  },
  btn: { backgroundColor: '#2e7dff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
