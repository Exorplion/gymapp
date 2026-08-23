// Puerto de web/src/components/sheets/EntryEdit.jsx.
//
// Cambiar QUÉ ejercicio fue una entrada ya registrada.
//
// Se podían corregir los pesos y las series, pero si anotaste "Press banca" y
// en realidad fue "Press inclinado" quedaba mal para siempre — y arrastraba su
// historial y su volumen a la categoría equivocada.
//
// Cambia sólo esa entrada de esa sesión. Si la RUTINA del día también tiene el
// nombre viejo, lo ofrece con un botón: el historial y el plan son dos cosas, y
// corregir un registro no debería reescribir el plan sin permiso.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { S, closeSheet, openSheet } from '../../lib/state.js';
import { norm } from '../../lib/format.js';
import { updateHistorySession } from '../../lib/session.js';
import { renameRoutineExercise } from '../../lib/rutina-logic.js';
import { EXCATALOG, MUSCLE_CATS, catOf } from '../../lib/muscle.js';
import { EQUIP, isMachineBound } from '../../lib/equip.js';
import { toast } from '../../lib/toast.js';
import MachineField from '../MachineField.js';
import { C } from '../../theme';

export default function EntryEdit({ sessId, idx }) {
  const sess = S.sessions.find(s => s.id === sessId);
  const entry = sess?.entries?.[idx];

  const [name, setName] = useState(entry?.name || '');
  const [equip, setEquip] = useState(entry?.equip || '');
  const [machine, setMachine] = useState(entry?.machine || '');
  const [cat, setCat] = useState(entry?.cat || '');
  const [unilateral, setUnilateral] = useState(!!entry?.unilateral);
  const nameRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const q = norm(name);
  const sugeridos = useMemo(
    () => (q ? EXCATALOG.filter(e => norm(e.n).includes(q) && norm(e.n) !== q).slice(0, 6) : []),
    [q],
  );

  if (!sess || !entry) return null;
  const original = entry.name;
  const auto = catOf({ name });

  async function guardar() {
    const n = name.trim();
    if (!n) { toast('Ponle nombre al ejercicio'); return; }
    const copia = structuredClone(sess);
    Object.assign(copia.entries[idx], {
      name: n,
      equip: equip || undefined,
      machine: equip && isMachineBound(equip) && machine ? machine.trim() : undefined,
      cat: cat || undefined,
      unilateral: unilateral || undefined,
    });
    await updateHistorySession(copia, `Ahora dice ${n}`);

    // ¿la rutina de ese turno también lo tiene mal? Sólo se puede resolver
    // para sesiones nuevas (con slotId) — una sesión vieja (weekday) no
    // tiene forma confiable de mapearse a un turno actual de la secuencia,
    // así que no se ofrece el cambio ahí (mejor no ofrecerlo que ofrecer
    // corregir el turno equivocado).
    const slot = sess.slotId ? S.routine.find(s => s.id === sess.slotId) : null;
    const enRutina = (slot?.exercises || []).some(e => e.name === original);
    if (enRutina && n !== original) {
      openSheet('confirm', {
        title: '¿También en tu rutina?',
        body: `"${slot.name || 'Tu rutina'}" todavía tiene "${original}". Si el nombre estaba mal en el plan, lo vas a volver a registrar mal.`,
        confirmLabel: 'Cambiarlo ahí también',
        onConfirm: () => renameRoutineExercise(sess.slotId, original, { name: n, equip, machine, cat, unilateral }),
      });
      return;
    }
    closeSheet();
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Cambiar ejercicio</Text>
      <Text style={styles.sub}>
        Corrige qué fue <Text style={styles.bold}>{original}</Text> en esta sesión. Los pesos y las series
        que anotaste no se tocan.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Qué ejercicio fue</Text>
        <TextInput
          ref={nameRef}
          style={styles.input}
          value={name}
          onChangeText={setName}
          autoComplete="off"
          placeholderTextColor={C.mut2}
        />
      </View>

      {sugeridos.length > 0 && (
        <View style={styles.field}>
          <Text style={styles.label}>De la base</Text>
          <View style={styles.chips}>
            {sugeridos.map(e => (
              <Pressable
                key={e.n}
                style={styles.chip}
                onPress={() => { setName(e.n); setCat(''); }}
              >
                <Text style={styles.chipText}>{e.n} <Text style={styles.chipMut}>· {e.c}</Text></Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.eyebrow}>
        Qué grupo entrena
        {!cat && auto ? <Text style={styles.autoHint}> · detecté {auto}</Text> : null}
      </Text>
      <View style={styles.chips}>
        {MUSCLE_CATS.map(c => {
          const on = cat === c;
          const blue = !cat && auto === c;
          return (
            <Pressable
              key={c}
              style={[styles.chip, on && styles.chipOn, !on && blue && styles.chipBlue]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setCat(on ? '' : c)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.eyebrow}>Con qué lo hiciste</Text>
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

      <Text style={styles.ptext}>
        El equipo es lo que decide contra qué historial se compara: el mismo
        ejercicio en dos máquinas distintas no mueve la misma carga.
      </Text>

      <Text style={styles.eyebrow}>Cómo se hizo</Text>
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

      <Pressable style={styles.btn} onPress={guardar}>
        <Text style={styles.btnText}>Guardar</Text>
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
  sub: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  bold: { color: C.mut, fontWeight: '700' },

  field: { marginTop: 14 },
  label: { color: C.mut, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    color: C.txt, fontSize: 15, borderWidth: 1, borderColor: C.line,
  },

  eyebrow: {
    color: C.mut, fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.4, marginTop: 18, marginBottom: 8,
  },
  autoHint: { color: C.mut, fontWeight: '500', textTransform: 'none', letterSpacing: 0 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: C.line, borderWidth: 1, borderColor: C.line,
  },
  chipOn: { backgroundColor: 'rgba(46,125,255,.16)', borderColor: C.blue },
  chipBlue: { borderColor: C.blue },
  chipText: { color: C.mut, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: C.blue2 },
  chipMut: { color: C.mut2, fontSize: 12, fontWeight: '500' },

  ptext: { color: C.mut, fontSize: 13, lineHeight: 18, marginTop: 12 },

  btn: { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  btnText: { color: C.txt, fontSize: 14, fontWeight: '700' },
  btnDim: { backgroundColor: 'transparent', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnDimText: { color: C.mut, fontSize: 14, fontWeight: '600' },
});
