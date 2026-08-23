// Puerto de web/src/components/sheets/SessionExercise.jsx.
//
// Cambiar o agregar un ejercicio con la sesión ya abierta.
//
// Un solo sheet para los dos casos porque piden lo mismo (qué ejercicio, con
// cuántas series y reps) y sólo cambia qué se hace con la respuesta:
//
//   con exId  → reemplaza: saltea el original y mete el nuevo en su lugar
//   sin exId  → agrega al final
//
// Nada de esto toca S.routine: vive en el borrador. Al cerrar la sesión, el
// resumen ofrece dejarlo fijo en la rutina del día.
import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { S, closeSheet } from '../../lib/state.js';
import { WD } from '../../lib/format.js';
import { addSessionExercise, replaceSessionExercise, sessionExs } from '../../lib/session.js';
import { recommendedExercises } from '../../lib/rutina-logic.js';
import { EQUIP, isMachineBound } from '../../lib/equip.js';
import MachineField from '../MachineField.js';
import { toast } from '../../lib/toast.js';
import { C } from '../../theme';

export default function SessionExercise({ wd, exId = null }) {
  const esCambio = !!exId;
  const original = esCambio ? sessionExs(+wd).find(e => e.id === exId) : null;

  /* El nombre arranca con el del original y no vacío: cambiar de equipo es el
     caso normal ("predicador con barra" → "predicador con mancuerna"), y
     obligar a retipear el nombre entero para tocar sólo el equipo es
     exactamente la fricción que este sheet existe para sacar de encima. */
  const [name, setName] = useState(original?.name || '');
  const [sets, setSets] = useState(String(original?.sets ?? 3));
  const [reps, setReps] = useState(String(original?.reps ?? 10));
  const [equip, setEquip] = useState(original?.equip || '');
  const [machine, setMachine] = useState(original?.machine || '');
  const [unilateral, setUnilateral] = useState(!!original?.unilateral);
  const nameRef = useRef(null);
  // Sólo cuenta como "sólo cambié el equipo" si nada del resto se tocó: así el
  // mensaje de confirmación no dice "cambiaste el equipo" cuando en realidad
  // cambiaste el ejercicio entero y de paso el equipo también cambió.
  const soloEquipo = esCambio && name.trim() === (original?.name || '').trim();

  useEffect(() => {
    // Foco + selección de todo el texto precargado: si vas a cambiar sólo el
    // equipo, el nombre precargado no estorba; si vas a escribir uno nuevo,
    // la primera tecla lo reemplaza entero en vez de meterse al final del
    // viejo. RN no tiene un equivalente directo a `.select()` del DOM, así
    // que se combina `selectTextOnFocus` (deja todo seleccionado apenas el
    // campo toma foco) con un `.focus()` programático tras el delay que ya
    // usaba el original — mismo efecto, sin depender de `setSelection` (que
    // en algunos casos de Android no dispara el resaltado visual si se llama
    // antes de que el input esté realmente montado).
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Sugerencias del catálogo para el grupo del día, sin los que ya están en la
  // sesión: cambiar de máquina es el caso normal y escribir el nombre entero
  // con las manos húmedas, no.
  const yaEstan = new Set(sessionExs(+wd).map(e => e.name.trim().toLowerCase()));
  const sugeridos = recommendedExercises(+wd).filter(s => !yaEstan.has(s.n.trim().toLowerCase())).slice(0, 6);

  async function confirmar() {
    const n = name.trim();
    if (!n) { toast('Ponle nombre al ejercicio'); return; }
    const datos = { name: n, sets, reps, equip, machine: equip && machine ? machine : undefined, unilateral };
    const r = esCambio ? await replaceSessionExercise(exId, datos) : await addSessionExercise(datos);
    if (!r) { toast('No se pudo agregar'); return; }
    closeSheet();
    if (soloEquipo) toast(`${n} → ahora con ${(EQUIP.find(e => e.id === equip)?.label || 'sin equipo').toLowerCase()}`);
    else toast(esCambio ? `${original?.name} → ${n}` : `＋ ${n}`);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>{esCambio ? 'Cambiar ejercicio' : 'Agregar ejercicio'}</Text>
      <Text style={styles.sub}>
        {esCambio
          ? <>En vez de <Text style={styles.blue}>{original?.name}</Text>, que queda saltado en su lugar. Podés restablecerlo después.</>
          : <>Se suma al final de la sesión de <Text style={styles.blue}>{S.routine[+wd]?.name || WD[+wd]}</Text>.</>}
      </Text>

      <View style={styles.calcbox}>
        <Text style={styles.calcText}>
          Vale sólo para hoy — tu rutina no cambia. Al cerrar la sesión te
          pregunto si querés dejarlo fijo.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Ejercicio</Text>
        <TextInput
          ref={nameRef}
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Remo en polea"
          placeholderTextColor={C.mut2}
          autoComplete="off"
          selectTextOnFocus
        />
      </View>

      {sugeridos.length > 0 && (
        <View style={styles.field}>
          <Text style={styles.label}>Sugerencias para este día</Text>
          <View style={styles.chips}>
            {sugeridos.map(s => {
              const on = name.trim().toLowerCase() === s.n.toLowerCase();
              return (
                <Pressable
                  key={s.n}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setName(s.n)}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.n}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.f2}>
        <View style={[styles.field, styles.f2item]}>
          <Text style={styles.label}>Series</Text>
          <TextInput
            style={styles.input}
            value={sets}
            onChangeText={setSets}
            keyboardType="number-pad"
          />
        </View>
        <View style={[styles.field, styles.f2item]}>
          <Text style={styles.label}>Reps</Text>
          <TextInput
            style={styles.input}
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* Con qué lo hacés hoy. Es lo que permite tocar SÓLO esto —"predicador
          con barra" a "predicador con mancuerna"— sin retipear el ejercicio
          entero: ver equip.js para por qué el historial se compara distinto
          en cada equipo. */}
      <Text style={styles.eyebrow}>Con qué lo hacés</Text>
      <View style={styles.chips}>
        {EQUIP.map(e => {
          const on = equip === e.id;
          return (
            <Pressable
              key={e.id}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setEquip(on ? '' : e.id)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{e.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {isMachineBound(equip) && (
        <MachineField equip={equip} machine={machine} onChange={setMachine} />
      )}

      <Text style={styles.eyebrow}>Cómo se hace</Text>
      <View style={styles.chips}>
        <Pressable
          style={[styles.chip, unilateral && styles.chipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: unilateral }}
          onPress={() => setUnilateral(u => !u)}
        >
          <Text style={[styles.chipText, unilateral && styles.chipTextOn]}>Un lado por vez</Text>
        </Pressable>
      </View>

      <Pressable style={styles.btn} onPress={confirmar}>
        <Text style={styles.btnText}>{esCambio ? 'Cambiar' : 'Agregar a la sesión'}</Text>
      </Pressable>
      <Pressable style={styles.btnDim} onPress={closeSheet}>
        <Text style={styles.btnDimText}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 4 },
  sub: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  blue: { color: C.blue2, fontWeight: '700' },

  calcbox: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, marginBottom: 14 },
  calcText: { color: C.mut, fontSize: 13, lineHeight: 19 },

  field: { marginTop: 14 },
  label: { color: C.mut, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    color: C.txt, fontSize: 15, borderWidth: 1, borderColor: C.line,
  },

  f2: { flexDirection: 'row', gap: 12 },
  f2item: { flex: 1 },

  eyebrow: {
    color: C.mut, fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.4, marginTop: 18, marginBottom: 8,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: C.line, borderWidth: 1, borderColor: C.line,
  },
  chipOn: { backgroundColor: 'rgba(46,125,255,.16)', borderColor: C.blue },
  chipText: { color: C.mut, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: C.blue2 },

  btn: { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  btnText: { color: C.txt, fontSize: 14, fontWeight: '700' },
  btnDim: { backgroundColor: C.line, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnDimText: { color: C.mut, fontSize: 14, fontWeight: '600' },
});
