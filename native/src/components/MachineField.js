// El campo "con qué máquina", compartido entre el alta de ejercicio (Rutina)
// y la corrección de una entrada ya registrada.
//
// Para polea es chips y no texto libre: pedir la marca no sirve —entrenás
// siempre en el mismo gimnasio y ni te acordás cómo se llama la polea— así
// que en vez de eso se pide lo que sí importa: cuánto pesa tirar de ella. Es
// el mismo campo `machine` de siempre, sólo una forma más fácil de llenarlo.
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { POLEA_FEEL } from '../lib/equip.js';
import { C } from '../theme';

export default function MachineField({ equip, machine, onChange }) {
  if (equip === 'polea') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>Cómo se siente</Text>
        <View style={styles.chips}>
          {POLEA_FEEL.map(f => {
            const on = machine === f.id;
            return (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onChange(on ? '' : f.id)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.ptext}>
          Las poleas no se distinguen por marca, sino por cuántas lleva el
          sistema y si hay contrapeso. El historial se lleva por separado
          para cada sensación.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Qué máquina</Text>
      <TextInput
        style={styles.input}
        placeholder="Life Fitness, Hammer, la del fondo…"
        placeholderTextColor={C.mut2}
        value={machine}
        onChangeText={onChange}
      />
      <Text style={styles.ptext}>
        En este sistema el número depende de la máquina, así que el historial
        se lleva por separado para cada una. Poné el nombre que te sirva a vos.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 16 },
  label: { color: C.mut, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    color: C.txt, fontSize: 15, borderWidth: 1, borderColor: C.line,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: C.line, borderWidth: 1, borderColor: C.line,
  },
  chipOn: { backgroundColor: 'rgba(46,125,255,.16)', borderColor: C.blue },
  chipText: { color: C.mut, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: C.blue2 },
  ptext: { color: C.mut, fontSize: 13, lineHeight: 18, marginTop: 6 },
});
