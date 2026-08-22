// native/src/screens/ExerciseList.js
// Puerto simplificado de web/src/components/ExerciseCarousel.jsx — lista
// vertical (ScrollView), no carrusel deslizable. Inputs controlados
// (useState), no refs — ver nota de alcance en el plan de esta etapa.
import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { S, wDisplay, wAlt, wStep } from '../lib/state.js';
import { round1, lb2kg, fmtNum } from '../lib/format.js';
import {
  ensureVals, lastDataFor, setsDone, saveSet, deleteSet, startExercise,
  targetSets, isSkipped, skipExercise, unskipExercise, addExtraSet, dropSet,
} from '../lib/session.js';

export default function ExerciseList({ exs, active, started, curId, nextEx }) {
  if (!exs.length) return null;
  return (
    <View style={[styles.list, { gap: 14 }]}>
      {exs.map(ex => {
        const done = setsDone(ex.id);
        const target = targetSets(ex);
        const skipped = active && isSkipped(ex.id);
        const full = !skipped && done.length >= target;
        const open = active && curId === ex.id && !full && !skipped;
        const isNext = active && !open && !skipped && !curId && nextEx && nextEx.id === ex.id;
        const waiting = active && !open && !isNext && !full && !skipped;
        return (
          <ExerciseCard
            key={ex.id}
            ex={ex} done={done} target={target} skipped={skipped}
            full={full} open={open} isNext={isNext} waiting={waiting} started={started}
          />
        );
      })}
    </View>
  );
}

function ExerciseCard({ ex, done, target, skipped, full, open, isNext, waiting, started }) {
  const v = ensureVals(ex);
  const last = lastDataFor(ex);
  const [w, setW] = useState(wDisplay(v.w));
  const [r, setR] = useState(String(v.r));

  function stepW(d) { v.w = Math.max(0, round1(v.w + d * wStep())); setW(wDisplay(v.w)); }
  function stepR(d) { v.r = Math.max(1, v.r + d); setR(String(v.r)); }
  function onWChange(text) {
    setW(text);
    const num = parseFloat(text);
    if (!isNaN(num) && num >= 0) v.w = S.cfg.unit === 'kg' ? num : lb2kg(num);
  }
  function onRChange(text) {
    setR(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num > 0) v.r = num;
  }

  return (
    <View style={[styles.card, open && styles.cardOpen, skipped && styles.cardSkipped]}>
      <Text style={styles.doneCount}>{done.length}/{target}</Text>
      <Text style={styles.exName}>{ex.name}</Text>
      <Text style={styles.exTarget}>Objetivo {target} × {ex.reps}</Text>
      {last && (
        <Text style={styles.exLast}>Última vez: {last.map(s => `${fmtNum(round1(s.w))}×${s.r}`).join(' · ')} kg</Text>
      )}
      {full && <Text style={styles.stateOk}>✓ Completo · {done.length} de {target} series</Text>}
      {waiting && <Text style={styles.stateMut}>En espera{done.length ? ` · ${done.length}/${target} series` : ''}</Text>}
      {skipped && (
        <>
          <Text style={styles.stateSkip}>Saltado{done.length ? ` · ${done.length} serie${done.length === 1 ? '' : 's'} registrada${done.length === 1 ? '' : 's'}` : ''}</Text>
          <Pressable style={styles.ghostBtn} onPress={() => unskipExercise(ex.id)}>
            <Text style={styles.ghostBtnText}>↺ Restablecer</Text>
          </Pressable>
        </>
      )}
      {full && (
        <Pressable style={styles.ghostBtn} onPress={() => addExtraSet(ex.id)}>
          <Text style={styles.ghostBtnText}>+ Una serie más</Text>
        </Pressable>
      )}
      {isNext && (
        <>
          <Pressable style={styles.primaryBtn} onPress={() => startExercise(ex)}>
            <Text style={styles.primaryBtnText}>▶ Iniciar ejercicio</Text>
          </Pressable>
          <Text style={styles.hint}>Dale cuando estés en la máquina{!started ? ' — acá arranca el cronómetro' : ''}</Text>
          <ExActions ex={ex} />
        </>
      )}
      {open && (
        <>
          <View style={styles.setRows}>
            <View style={styles.setCol}>
              <Text style={styles.stepLabel}>Peso ({S.cfg.unit === 'kg' ? 'kg' : 'lb'})</Text>
              <View style={styles.stepRow}>
                <Pressable style={styles.stepBtn} onPress={() => stepW(-1)}><Text style={styles.stepBtnText}>−</Text></Pressable>
                <TextInput style={styles.input} keyboardType="decimal-pad" value={w} onChangeText={onWChange} />
                <Pressable style={styles.stepBtn} onPress={() => stepW(1)}><Text style={styles.stepBtnText}>+</Text></Pressable>
              </View>
              <Text style={styles.alt}>{wAlt(v.w)}</Text>
            </View>
            <View style={styles.setCol}>
              <Text style={styles.stepLabel}>Reps</Text>
              <View style={styles.stepRow}>
                <Pressable style={styles.stepBtn} onPress={() => stepR(-1)}><Text style={styles.stepBtnText}>−</Text></Pressable>
                <TextInput style={styles.input} keyboardType="number-pad" value={r} onChangeText={onRChange} />
                <Pressable style={styles.stepBtn} onPress={() => stepR(1)}><Text style={styles.stepBtnText}>+</Text></Pressable>
              </View>
            </View>
          </View>
          <Pressable style={styles.primaryBtn} onPress={() => saveSet(ex.id)}>
            <Text style={styles.primaryBtnText}>✓ Terminé la serie {done.length + 1} de {target}</Text>
          </Pressable>
          <ExActions ex={ex} />
        </>
      )}
      {done.length > 0 && (
        <View style={styles.chipsRow}>
          {done.map((s, i) => (
            <Pressable key={i} style={styles.chip} onPress={() => deleteSet(ex.id, i)}>
              <Text style={styles.chipText}>{fmtNum(round1(s.w))}kg × {s.r} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function ExActions({ ex }) {
  return (
    <View style={styles.actionsRow}>
      <Pressable style={styles.actionBtn} onPress={() => dropSet(ex.id)}><Text style={styles.actionBtnText}>− Serie</Text></Pressable>
      <Pressable style={styles.actionBtn} onPress={() => addExtraSet(ex.id)}><Text style={styles.actionBtnText}>+ Serie</Text></Pressable>
      <Pressable style={styles.actionBtn} onPress={() => skipExercise(ex.id)}><Text style={styles.actionBtnText}>Saltar</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 16 },
  card: { backgroundColor: '#0e1626', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,.06)' },
  cardOpen: { borderColor: '#2e7dff' },
  cardSkipped: { opacity: 0.5 },
  doneCount: { color: '#8a93a6', fontSize: 12, fontWeight: '700' },
  exName: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  exTarget: { color: '#8a93a6', fontSize: 13, marginTop: 4 },
  exLast: { color: '#8a93a6', fontSize: 12, marginTop: 4 },
  stateOk: { color: '#1fbf75', fontSize: 13, marginTop: 8, fontWeight: '600' },
  stateMut: { color: '#8a93a6', fontSize: 13, marginTop: 8 },
  stateSkip: { color: '#ffb347', fontSize: 13, marginTop: 8 },
  ghostBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,.06)' },
  ghostBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  primaryBtn: { marginTop: 12, backgroundColor: '#2e7dff', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  hint: { color: '#8a93a6', fontSize: 11, textAlign: 'center', marginTop: 6 },
  setRows: { flexDirection: 'row', gap: 14, marginTop: 12 },
  setCol: { flex: 1 },
  stepLabel: { color: '#8a93a6', fontSize: 11, marginBottom: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.08)', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  input: { flex: 1, color: '#fff', fontSize: 16, textAlign: 'center', backgroundColor: 'rgba(255,255,255,.06)', borderRadius: 8, paddingVertical: 8 },
  alt: { color: '#8a93a6', fontSize: 11, marginTop: 4, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { backgroundColor: 'rgba(46,125,255,.18)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: '#6ea8ff', fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: 'rgba(255,255,255,.06)', alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
