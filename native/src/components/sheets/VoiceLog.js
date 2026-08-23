// Puerto de web/src/components/sheets/VoiceLog.jsx — confirmación/edición
// de un registro de sesión ya parseado por dictado de voz, antes de
// guardarlo. Este sheet NO hace reconocimiento de voz: recibe `items`/
// `duration` YA PARSEADOS como props (openSheet('voice-log', {items,
// duration})). Su único caller real (VoiceLogButton, web/src/Hoy.jsx)
// depende de lib/voice.js (no portado) + Web Speech API, así que esta
// etapa registra el sheet en SHEET_REGISTRY sin conectar ningún trigger
// real todavía — mismo criterio que EntryEdit (Etapa 5g).
//
// FIX ROUND 1 (heredado del original, code review): los inputs de
// series/reps/peso y de duración empezaron controlados (value={it[f]}) y
// el handler de cambio reformateaba el número (round1/Math.round) de
// vuelta al mismo render en cada tecla. Eso rompía igual que el bug ya
// evitado en BodyForm.js/Preworkout.js/Profile.js: borrar el campo para
// tipear de nuevo no dejaba avanzar, y un peso decimal como "62.5" perdía
// el "." al tipear (parseFloat('62.') da 62, y repintar value={62} se
// come el punto). La solución, ya presente en el original y portada tal
// cual: TextInput NO controlado (defaultValue + ref), el handler de
// cambio (changeField/changeDuration) sólo actualiza el estado interno
// (items/duration) y NUNCA reescribe el texto del input mientras el
// usuario tipea. Sólo los steppers +/- (stepField/stepDuration)
// reescriben el input a mano vía ref.setNativeProps({text}) — ahí es
// seguro porque el usuario no tecleó ese valor, lo pidió con un tap
// (mismo criterio que "usar último registrado" en BodyForm.js/Profile.js).
//
// Cada item recibe un `_id` estable (uid()) generado una sola vez al
// sembrar el estado inicial — sin esto, delItem() podría hacer que React
// reutilice el nodo de una fila borrada para la fila siguiente, dejando un
// input no controlado mostrando el valor tecleado de OTRO ejercicio.
// key={it._id} en cada card, nunca el índice del array.
import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { S, bump, saveCfg, wStep, closeSheet } from '../../lib/state.js';
import { dstr, uid, round1, vibrate } from '../../lib/format.js';
import { idb } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { pendingSlot } from '../../lib/session.js';
import { C } from '../../theme';

const FIELDS = [['sets', 'Series'], ['reps', 'Reps'], ['w', 'Peso kg']];

export default function VoiceLog({ items: initialItems, duration: initialDuration }) {
  const [items, setItems] = useState(() => initialItems.map(it => ({ ...it, _id: uid() })));
  const [duration, setDuration] = useState(initialDuration);
  const fieldRefs = useRef({}); // `${_id}-${f}` -> TextInput ref
  const durRef = useRef(null);

  function stepField(id, f, d) {
    setItems(prev => prev.map(it => {
      if (it._id !== id) return it;
      const next = f === 'w' ? { ...it, w: Math.max(0, round1(it.w + d * wStep())) } : { ...it, [f]: Math.max(1, it[f] + d) };
      const ref = fieldRefs.current[`${id}-${f}`];
      if (ref) ref.setNativeProps({ text: String(next[f]) }); // stepper: el usuario no tecleó esto, seguro reescribir
      return next;
    }));
  }
  function changeField(id, f, value) {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return; // no reescribir el input: el usuario sigue tipeando
    setItems(prev => prev.map(it => it._id === id ? { ...it, [f]: f === 'w' ? num : Math.max(1, Math.round(num)) } : it));
  }
  function delItem(id) {
    const next = items.filter(it => it._id !== id);
    if (!next.length) { closeSheet(); toast('Registro descartado'); return; }
    setItems(next);
  }
  function changeDuration(value) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) setDuration(num);
  }
  function stepDuration(d) {
    setDuration(v => {
      const next = Math.max(1, v + d);
      if (durRef.current) durRef.current.setNativeProps({ text: String(next) });
      return next;
    });
  }

  async function save() {
    if (!items.length) return;
    const slot = pendingSlot();
    const entries = items.map(it => ({
      exId: uid(), name: it.name,
      sets: Array.from({ length: it.sets }, () => ({ w: round1(it.w), r: it.reps })),
    }));
    const end = Date.now(), dur = Math.max(1, duration | 0);
    const sess = {
      id: uid(), date: dstr(), slotId: slot?.id, dayName: slot?.name || 'Entrenamiento',
      start: end - dur * 60000, end, duration: dur, entries,
    };
    await idb.put('sessions', sess);
    S.sessions.unshift(sess);
    // Mismo avance de puntero que completeSession() (session.js): un
    // registro por voz cierra el turno pendiente igual que cualquier otra
    // sesión, así la racha y el "qué sigue" no se desincronizan.
    const finishedAt = S.routine.findIndex(s => s.id === slot?.id);
    S.cfg.seqIndex = finishedAt >= 0 ? (finishedAt + 1) % Math.max(1, S.routine.length) : S.cfg.seqIndex;
    S.cfg.seqIndexDate = dstr();
    await saveCfg();
    const n = entries.reduce((a, e) => a + e.sets.length, 0);
    closeSheet();
    vibrate([30, 50, 30]);
    bump();
    toast(`💪 Sesión guardada · ${n} series · ${dur} min`);
  }

  if (!items.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Confirmá tu sesión</Text>
      <Text style={styles.sub}>
        Esto es lo que entendí. <Text style={styles.bold}>Revisá los pesos</Text>: el dictado casi nunca los capta bien, así que van con lo que levantaste la última vez.
      </Text>
      {items.map(it => (
        <View style={styles.card} key={it._id}>
          <View style={styles.cardHead}>
            <View style={styles.grow}><Text style={styles.exName}>{it.name}</Text></View>
            <Pressable style={styles.delBtn} onPress={() => delItem(it._id)}>
              <Text style={styles.delBtnText}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.fieldsRow}>
            {FIELDS.map(([f, lbl]) => (
              <View key={f} style={styles.fieldCol}>
                <Text style={styles.stepLabel}>{lbl}</Text>
                <View style={styles.step}>
                  <Pressable style={styles.stepBtn} onPress={() => stepField(it._id, f, -1)}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <View style={styles.val}>
                    <TextInput
                      ref={el => { fieldRefs.current[`${it._id}-${f}`] = el; }}
                      keyboardType="decimal-pad"
                      defaultValue={String(it[f])}
                      onChangeText={t => changeField(it._id, f, t)}
                      style={styles.valInput}
                    />
                  </View>
                  <Pressable style={styles.stepBtn} onPress={() => stepField(it._id, f, 1)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
      <Text style={styles.stepLabelDur}>Duración (min)</Text>
      <View style={[styles.step, { marginTop: 6 }]}>
        <Pressable style={styles.stepBtn} onPress={() => stepDuration(-5)}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <View style={styles.val}>
          <TextInput
            ref={durRef}
            keyboardType="number-pad"
            defaultValue={String(duration)}
            onChangeText={changeDuration}
            style={styles.valInput}
          />
        </View>
        <Pressable style={styles.stepBtn} onPress={() => stepDuration(5)}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
      <Pressable style={styles.btn} onPress={save}>
        <Text style={styles.btnText}>Guardar sesión</Text>
      </Pressable>
      <Pressable style={styles.btnDim} onPress={closeSheet}>
        <Text style={styles.btnDimText}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 6 },
  sub: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  bold: { color: C.mut, fontWeight: '700' },

  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1 },
  exName: { color: C.txt, fontSize: 16, fontWeight: '700' },
  delBtn: { backgroundColor: 'rgba(224,60,60,.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  delBtnText: { color: C.red, fontWeight: '700' },

  fieldsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  fieldCol: { flex: 1 },
  stepLabel: { color: C.mut, fontSize: 12, marginBottom: 6 },
  stepLabelDur: { color: C.mut, fontSize: 12, marginTop: 18 },

  step: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card2, borderRadius: 12, overflow: 'hidden' },
  stepBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  stepBtnText: { color: C.txt, fontSize: 18, fontWeight: '700' },
  val: { flex: 1, alignItems: 'center' },
  valInput: { color: C.txt, fontSize: 20, fontWeight: '700', textAlign: 'center', minWidth: 40, paddingVertical: 6 },

  btn: { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: C.txt, fontWeight: '700', fontSize: 15 },
  btnDim: { backgroundColor: C.card2, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnDimText: { color: C.mut, fontWeight: '700', fontSize: 14 },
});
