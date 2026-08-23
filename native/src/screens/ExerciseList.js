// native/src/screens/ExerciseList.js
// Puerto simplificado de web/src/components/ExerciseCarousel.jsx — lista
// vertical (ScrollView), no carrusel deslizable. Inputs controlados
// (useState), no refs — ver nota de alcance en el plan de esta etapa.
//
// Etapa "completar Hoy" (Task 4): se agregan las funciones del original que
// no dependen de gestos de swipe — ícono, botón de info, esquema RIR, aviso
// de progresión, nota de reemplazo, "primera vez en este equipo", toggle de
// unilateral y botón de cambiar ejercicio, además de la confirmación antes
// de saltar. `wd` (índice del día) se recibe como prop opcional — Hoy.js
// todavía no lo pasa (Task 5 lo conecta); sin él los sheets que lo usan
// simplemente reciben `wd: undefined`.
import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { S, wDisplay, wAlt, wStep, openSheet } from '../lib/state.js';
import { C, R } from '../theme';
import { round1, lb2kg, fmtNum } from '../lib/format.js';
import { exInfo, rirScheme, progressionWarn } from '../lib/exdb.js';
import {
  ensureVals, lastDataFor, setsDone, saveSet, deleteSet, startExercise,
  targetSets, isSkipped, skipExercise, unskipExercise, addExtraSet, dropSet,
  reemplazaA, isUnilateral, toggleUnilateral,
} from '../lib/session.js';
import { relatedHistory, equipLabel } from '../lib/equip.js';
import { iconOf } from '../lib/exicon.js';
import ExIcon from '../components/ExIcon.js';

export default function ExerciseList({ exs, wd, active, started, curId, nextEx }) {
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
            ex={ex} wd={wd} done={done} target={target} skipped={skipped}
            full={full} open={open} isNext={isNext} waiting={waiting} started={started}
          />
        );
      })}
    </View>
  );
}

function ExerciseCard({ ex, wd, done, target, skipped, full, open, isNext, waiting, started }) {
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

  // el esquema se arma sobre el objetivo de HOY (con series extra incluidas)
  const scheme = rirScheme(target, ex.name);
  const curSet = Math.min(done.length, target - 1);
  const curRir = scheme[curSet];
  const info = exInfo(ex.name);
  // sin historial propio: primera vez en ESTE equipo
  const related = last ? [] : relatedHistory(ex, S.sessions);
  const uni = isUnilateral(ex);
  const envez = reemplazaA(ex.id);
  const progWarn = open ? progressionWarn(ex.name, v.w) : null;

  function confirmarSalto() {
    openSheet('confirm', {
      title: `¿Saltar ${ex.name}?`,
      body: 'Queda marcado como saltado y pasás al siguiente. Podés restablecerlo en cualquier momento y vuelve a su lugar.',
      confirmLabel: 'Saltar',
      onConfirm: () => skipExercise(ex.id),
    });
  }

  return (
    <View style={[styles.card, open && styles.cardOpen, skipped && styles.cardSkipped]}>
      <View style={styles.headerRow}>
        <ExIcon icono={iconOf(ex)} size={34} />
        <Text style={styles.doneCount}>{done.length}/{target}</Text>
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.exName}>{ex.name}</Text>
        {info && (
          <Pressable style={styles.infoBtn} onPress={() => openSheet('ex-info', { name: ex.name, wd, exId: ex.id })}>
            <Text style={styles.infoBtnText}>ⓘ</Text>
          </Pressable>
        )}
      </View>
      {envez && <Text style={styles.envez}>en vez de {envez}</Text>}
      <Text style={styles.exTarget}>
        Objetivo {target} × {ex.reps}
        {open && (curRir === 0 ? ' · al fallo' : ` · RIR ${curRir}`)}
      </Text>
      {last && (
        <Text style={styles.exLast}>
          Última vez: {last.map(s => `${fmtNum(round1(s.w))}×${s.r}`).join(' · ')} kg{uni ? ' por lado' : ''}
        </Text>
      )}
      {!last && equipLabel(ex) && (
        <View style={styles.firstBox}>
          <Text style={styles.firstTitle}>Primera vez en {equipLabel(ex)}</Text>
          {related.length > 0 && (
            <Text style={styles.firstSub}>
              Este ejercicio lo venís haciendo en {related.map(r => `${r.label} (${fmtNum(round1(r.w))}×${r.r})`).join(' · ')}.
            </Text>
          )}
          <Text style={styles.firstSub}>
            Ese número no se traslada: cada sistema mueve una carga distinta. Arrancá
            claramente liviano y subí hasta que las {ex.reps} reps te queden con 2 en
            reserva. Lo que anotes hoy queda como tu punto de partida acá.
          </Text>
        </View>
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
          <ExActions ex={ex} wd={wd} onSkip={confirmarSalto} />
        </>
      )}
      {open && (
        <>
          {progWarn && <Text style={styles.progWarn}>⚠ {progWarn}</Text>}
          <Pressable style={[styles.uniChip, uni && styles.uniChipOn]} onPress={() => toggleUnilateral(ex.id)}>
            <Text style={styles.uniChipText}>{uni ? '✓ Un lado por vez' : 'Un lado por vez'}</Text>
          </Pressable>
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
          <ExActions ex={ex} wd={wd} onSkip={confirmarSalto} />
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

function ExActions({ ex, wd, onSkip }) {
  return (
    <View style={styles.actionsRow}>
      <Pressable style={styles.actionBtn} onPress={() => dropSet(ex.id)}><Text style={styles.actionBtnText}>− Serie</Text></Pressable>
      <Pressable style={styles.actionBtn} onPress={() => addExtraSet(ex.id)}><Text style={styles.actionBtnText}>+ Serie</Text></Pressable>
      <Pressable style={styles.actionBtn} onPress={() => openSheet('ex-swap', { wd, exId: ex.id })}><Text style={styles.actionBtnText}>Cambiar</Text></Pressable>
      <Pressable style={styles.actionBtn} onPress={onSkip}><Text style={styles.actionBtnText}>Saltar</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 16 },
  card: { backgroundColor: C.card, borderRadius: R.r, padding: 16, borderWidth: 1, borderColor: C.line },
  cardOpen: { borderColor: C.blue },
  cardSkipped: { opacity: 0.5 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  doneCount: { color: C.mut, fontSize: 12, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  exName: { color: C.txt, fontSize: 18, fontWeight: '700' },
  infoBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' },
  infoBtnText: { color: C.mut, fontSize: 13, fontWeight: '700' },
  envez: { color: C.mut, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  exTarget: { color: C.mut, fontSize: 13, marginTop: 4 },
  progWarn: { color: '#ffb347', fontSize: 12, marginTop: 8, marginBottom: 4 },
  uniChip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.line, marginBottom: 8 },
  uniChipOn: { backgroundColor: 'rgba(46,125,255,.28)' },
  uniChipText: { color: C.txt, fontSize: 12, fontWeight: '600' },
  firstBox: { marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: C.line },
  firstTitle: { color: C.txt, fontSize: 13, fontWeight: '700' },
  firstSub: { color: C.mut, fontSize: 12, marginTop: 4 },
  exLast: { color: C.mut, fontSize: 12, marginTop: 4 },
  stateOk: { color: '#1fbf75', fontSize: 13, marginTop: 8, fontWeight: '600' },
  stateMut: { color: C.mut, fontSize: 13, marginTop: 8 },
  stateSkip: { color: '#ffb347', fontSize: 13, marginTop: 8 },
  ghostBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: C.line },
  ghostBtnText: { color: C.txt, fontSize: 13, fontWeight: '600' },
  primaryBtn: { marginTop: 12, backgroundColor: C.blue, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: C.txt, fontWeight: '700', fontSize: 14 },
  hint: { color: C.mut, fontSize: 11, textAlign: 'center', marginTop: 6 },
  setRows: { flexDirection: 'row', gap: 14, marginTop: 12 },
  setCol: { flex: 1 },
  stepLabel: { color: C.mut, fontSize: 11, marginBottom: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: C.txt, fontSize: 18, fontWeight: '700' },
  input: { flex: 1, color: C.txt, fontSize: 16, textAlign: 'center', backgroundColor: C.line, borderRadius: 8, paddingVertical: 8 },
  alt: { color: C.mut, fontSize: 11, marginTop: 4, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { backgroundColor: 'rgba(46,125,255,.18)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: '#6ea8ff', fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: C.line, alignItems: 'center' },
  actionBtnText: { color: C.txt, fontSize: 11, fontWeight: '600' },
});
