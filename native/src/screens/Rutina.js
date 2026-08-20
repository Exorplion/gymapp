import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { S, useStore, bump } from '../lib/state.js';
import { routineStats, routineName, enterEditMode, exitEditMode, insertWorkout, insertRest, removeSlot, reorderSeq, saveSlot } from '../lib/rutina-logic.js';
import { toast } from '../lib/toast.js';

export default function Rutina() {
  useStore();
  if (S.rutMode === 'edit') return <RutinaEdit />;
  return <RutinaView />;
}

function RutinaView() {
  const [openIdx, setOpenIdx] = useState(-1);
  const st = routineStats();
  const maxSets = Math.max(1, ...S.routine.map(slot =>
    slot.type === 'workout' ? (slot.exercises || []).reduce((a, e) => a + e.sets, 0) : 0));

  if (!st.workoutCount) {
    return (
      <View style={[styles.container, styles.scrollContent]}>
        <Text style={styles.title}>Rutina</Text>
        <Text style={styles.sub}>tu semana de un vistazo</Text>
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            Todavía no tenés rutina.{'\n'}Armá tu split turno por turno.
          </Text>
          <Pressable style={styles.ghostBtn} onPress={() => toast('Próximamente')}>
            <Text style={styles.ghostBtnText}>Ver rutinas y plantillas</Text>
          </Pressable>
        </View>
        <Pressable style={styles.editBtn} onPress={() => toast('Próximamente')}>
          <Text style={styles.editBtnText}>✎ Armar mi rutina</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Rutina</Text>
      <Text style={styles.sub}>tu semana</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Plan activo</Text>
        <Text style={styles.heroName}>{routineName()}</Text>
        <Text style={styles.heroStats}>
          {st.workoutCount} turno{st.workoutCount === 1 ? '' : 's'} de entrenamiento · {st.ex} ejercicios · {st.sets} series por ciclo
        </Text>
        <View style={styles.weekbars}>
          {S.routine.map((slot, i) => {
            const sets = slot.type === 'workout' ? (slot.exercises || []).reduce((a, e) => a + e.sets, 0) : 0;
            const h = sets ? Math.round(30 + (sets / maxSets) * 40) : 10;
            return (
              <View key={slot.id} style={styles.wbar}>
                <View style={[styles.wbarFill, { height: h }, sets && styles.wbarOn]} />
                <Text style={styles.wbarLabel}>{i + 1}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.btnRow}>
        <Pressable style={styles.btn} onPress={() => enterEditMode()}>
          <Text style={styles.btnText}>Editar rutina</Text>
        </Pressable>
        <Pressable style={styles.btnGlass} onPress={() => toast('Próximamente')}>
          <Text style={styles.btnText}>Mis rutinas</Text>
        </Pressable>
      </View>

      <View style={styles.dayCards}>
        {S.routine.map((slot, i) => {
          const on = slot.type === 'workout' && !!slot.exercises?.length;
          const sets = on ? slot.exercises.reduce((a, e) => a + e.sets, 0) : 0;
          const open = openIdx === i && on;
          return (
            <View key={slot.id} style={styles.dayCard}>
              <Pressable style={styles.dayHead} onPress={() => setOpenIdx(open ? -1 : i)}>
                <View style={[styles.dayBadge, !on && styles.dayBadgeOff]}>
                  <Text style={styles.dayBadgeText}>{i + 1}</Text>
                </View>
                <View style={styles.dayGrow}>
                  <Text style={styles.dayTitle}>{on ? (slot.name || 'Rutina') : 'Descanso'}</Text>
                  <Text style={styles.daySub}>{on ? `${slot.exercises.length} ejercicios · ${sets} series` : 'libre'}</Text>
                </View>
                <Text style={styles.chev}>{open ? '⌄' : '›'}</Text>
              </Pressable>
              {open && (
                <View style={styles.dayExs}>
                  {slot.exercises.map((e, k) => (
                    <View key={e.id} style={styles.dayEx}>
                      <Text style={styles.dayExIndex}>{k + 1}</Text>
                      <Text style={styles.dayExName}>{e.name}</Text>
                      <Text style={styles.dayExSets}>{e.sets}×{e.reps}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function RutinaEdit() {
  useStore();
  const [openIdx, setOpenIdx] = useState(-1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Editar</Text>
      <Text style={styles.sub}>{routineName()}</Text>

      <Pressable style={styles.doneBtn} onPress={() => exitEditMode()}>
        <Text style={styles.doneBtnText}>‹ Listo</Text>
      </Pressable>

      <View style={styles.editList}>
        {S.routine.map((slot, i) => {
          const isWorkout = slot.type === 'workout';
          const open = openIdx === i && isWorkout;
          return (
            <View key={slot.id} style={styles.editCard}>
              <View style={styles.editHeadRow}>
                <Text style={styles.editIndex}>Turno {i + 1}</Text>
                <View style={styles.editArrows}>
                  <Pressable
                    style={[styles.miniBtn, i === 0 && styles.miniBtnDisabled]}
                    disabled={i === 0}
                    onPress={() => reorderSeq(i, i - 1)}
                  >
                    <Text style={styles.miniBtnText}>↑</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.miniBtn, i === S.routine.length - 1 && styles.miniBtnDisabled]}
                    disabled={i === S.routine.length - 1}
                    onPress={() => reorderSeq(i, i + 1)}
                  >
                    <Text style={styles.miniBtnText}>↓</Text>
                  </Pressable>
                  <Pressable style={styles.miniBtnRed} onPress={() => removeSlot(i)}>
                    <Text style={styles.miniBtnRedText}>✕</Text>
                  </Pressable>
                </View>
              </View>

              {isWorkout ? (
                <Pressable style={styles.editNameRow} onPress={() => setOpenIdx(open ? -1 : i)}>
                  <TextInput
                    style={styles.editNameInput}
                    defaultValue={slot.name || ''}
                    placeholder="Sin nombre"
                    placeholderTextColor="#8a93a6"
                    onBlur={(e) => saveSlot(i, { name: e.nativeEvent.text })}
                  />
                  <Text style={styles.chev}>{open ? '⌄' : '›'}</Text>
                </Pressable>
              ) : (
                <Text style={styles.editRestText}>Descanso</Text>
              )}

              {isWorkout && open && (
                <View style={styles.editBody}>
                  <Text style={styles.editBodyPlaceholder}>(ejercicios — Task 2)</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.btnRow}>
        <Pressable style={styles.btnGlass} onPress={() => insertWorkout(S.routine.length)}>
          <Text style={styles.btnText}>+ Entrenamiento</Text>
        </Pressable>
        <Pressable style={styles.btnGlass} onPress={() => insertRest(S.routine.length)}>
          <Text style={styles.btnText}>+ Descanso</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070d' },
  scrollContent: { padding: 18, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  sub: { color: '#8a93a6', fontSize: 13, marginTop: 2, marginBottom: 16 },
  card: { backgroundColor: '#0e1626', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,.08)' },
  emptyText: { color: '#8a93a6', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  ghostBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,.06)' },
  ghostBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  editBtn: { marginTop: 16, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,.15)' },
  editBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  heroCard: { backgroundColor: '#0e1626', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(139,92,246,.25)' },
  heroEyebrow: { color: '#a78bfa', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroName: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 4 },
  heroStats: { color: '#8a93a6', fontSize: 13, marginTop: 4 },
  weekbars: { flexDirection: 'row', gap: 6, marginTop: 16, alignItems: 'flex-end', height: 70 },
  wbar: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  wbarFill: { width: '100%', borderRadius: 4, backgroundColor: 'rgba(255,255,255,.08)' },
  wbarOn: { backgroundColor: '#a78bfa' },
  wbarLabel: { color: '#8a93a6', fontSize: 10, marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,.08)' },
  btnGlass: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.15)' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  dayCards: { marginTop: 20, gap: 10 },
  dayCard: { backgroundColor: '#0e1626', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,.06)', overflow: 'hidden' },
  dayHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  dayBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center' },
  dayBadgeOff: { backgroundColor: 'rgba(255,255,255,.1)' },
  dayBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dayGrow: { flex: 1 },
  dayTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  daySub: { color: '#8a93a6', fontSize: 12, marginTop: 2 },
  chev: { color: '#8a93a6', fontSize: 18 },
  dayExs: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  dayEx: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.06)' },
  dayExIndex: { color: '#8a93a6', fontSize: 11, width: 16 },
  dayExName: { flex: 1, color: '#fff', fontSize: 13 },
  dayExSets: { color: '#8a93a6', fontSize: 12 },
  doneBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.15)' },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  editList: { marginTop: 16, gap: 10 },
  editCard: { backgroundColor: '#0e1626', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,.06)', padding: 14, gap: 8 },
  editHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editIndex: { color: '#8a93a6', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  editArrows: { flexDirection: 'row', gap: 6 },
  miniBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.08)' },
  miniBtnDisabled: { opacity: 0.3 },
  miniBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  miniBtnRed: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(248,113,113,.12)' },
  miniBtnRedText: { color: '#f87171', fontSize: 13, fontWeight: '700' },
  editNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editNameInput: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', paddingVertical: 4 },
  editRestText: { color: '#8a93a6', fontSize: 15, fontWeight: '600' },
  editBody: { paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.06)' },
  editBodyPlaceholder: { color: '#8a93a6', fontSize: 12, fontStyle: 'italic' },
});
