// El campo "con qué máquina", compartido entre el alta de ejercicio (Rutina)
// y la corrección de una entrada ya registrada.
//
// Para polea es chips y no texto libre: pedir la marca no sirve —entrenás
// siempre en el mismo gimnasio y ni te acordás cómo se llama la polea— así
// que en vez de eso se pide lo que sí importa: cuánto pesa tirar de ella. Es
// el mismo campo `machine` de siempre, sólo una forma más fácil de llenarlo.
import { View, Text, TextInput, Pressable } from 'react-native';
import { POLEA_FEEL } from '../lib/equip.js';

export default function MachineField({ equip, machine, onChange }) {
  if (equip === 'polea') {
    return (
      <View style={{ marginTop: 16 }}>
        <Text>Cómo se siente</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {POLEA_FEEL.map(f => {
            const on = machine === f.id;
            return (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onChange(on ? '' : f.id)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: on ? '#333' : '#ccc',
                  backgroundColor: on ? '#333' : 'transparent',
                }}
              >
                <Text style={{ color: on ? '#fff' : '#000' }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>
          Las poleas no se distinguen por marca, sino por cuántas lleva el
          sistema y si hay contrapeso. El historial se lleva por separado
          para cada sensación.
        </Text>
      </View>
    );
  }
  return (
    <View style={{ marginTop: 16 }}>
      <Text>Qué máquina</Text>
      <TextInput
        placeholder="Life Fitness, Hammer, la del fondo…"
        value={machine}
        onChangeText={onChange}
      />
      <Text style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>
        En este sistema el número depende de la máquina, así que el historial
        se lleva por separado para cada una. Poné el nombre que te sirva a vos.
      </Text>
    </View>
  );
}
