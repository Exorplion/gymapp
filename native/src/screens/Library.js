// Puerto de web/src/components/sheets/Library.jsx (sheetLibrary() +
// sheetLibSave(name) en el original) — pantalla completa de navegación en
// vez de sheet modal, ya que RN todavía no tiene sistema de sheets
// (Etapa 5). Mismo patrón de dos modos ('list' | 'save') que el original,
// pero conmutados con estado local en vez de route.params (menos código
// nuevo: no hace falta ida y vuelta de navegación para abrir el form de
// guardado, ver decisión en el ledger de Task 3).
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { S, useStore } from '../lib/state.js';
import { fmtD } from '../lib/format.js';
import { TEMPLATES, applyTemplate } from '../lib/templates.js';
import {
  routineStats, routineName, applyLibRoutine, deleteLibRoutine, saveCurrentAsLib, startBlank,
} from '../lib/rutina-logic.js';

export default function Library({ navigation }) {
  useStore();
  const [mode, setMode] = useState('list');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Pressable style={styles.backBtn} onPress={() => (mode === 'save' ? setMode('list') : navigation.goBack())}>
        <Text style={styles.backBtnText}>‹ {mode === 'save' ? 'Volver' : 'Rutina'}</Text>
      </Pressable>
      {mode === 'save'
        ? <LibrarySave onDone={() => setMode('list')} />
        : <LibraryList onSave={() => setMode('save')} />}
    </ScrollView>
  );
}

function LibraryList({ onSave }) {
  const st = routineStats();
  return (
    <>
      <Text style={styles.title}>Mis rutinas</Text>
      <Text style={styles.sub}>
        Guardá el split que estés usando para volver a él cuando quieras, o cargá una plantilla.
      </Text>

      {st.workoutCount > 0 && (
        <Pressable style={styles.ghostBtn} onPress={onSave}>
          <Text style={styles.ghostBtnText}>💾 Guardar la actual como…</Text>
        </Pressable>
      )}

      {S.lib.length > 0 && (
        <>
          <Text style={styles.h3}>Guardadas</Text>
          <View style={styles.card}>
            {S.lib.map(r => {
              const nd = Object.values(r.days).filter(d => d.type === 'workout').length;
              const ne = Object.values(r.days).reduce((a, d) => a + (d.exercises?.length || 0), 0);
              const cur = r.name === S.cfg.routineName;
              return (
                <View style={styles.row} key={r.id}>
                  <Pressable style={styles.rowGrow} onPress={() => applyLibRoutine(r.id)}>
                    <Text style={styles.rowTitle}>
                      {r.name}{cur ? <Text style={styles.tag}>  en uso</Text> : null}
                    </Text>
                    <Text style={styles.rowSub}>{nd} días · {ne} ejercicios · guardada {fmtD(r.savedAt)}</Text>
                  </Pressable>
                  <Pressable style={styles.miniBtnRed} onPress={() => deleteLibRoutine(r.id)}>
                    <Text style={styles.miniBtnRedText}>✕</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.h3}>Plantillas</Text>
      <Text style={styles.tmplHint}>Reemplazan tu split actual. Después las editás a gusto.</Text>
      {TEMPLATES.map(t => (
        <Pressable key={t.id} style={styles.tmplCard} onPress={() => applyTemplate(t.id)}>
          <View style={styles.tmplRow}>
            <View style={styles.rowGrow}>
              <Text style={styles.tmplName}>{t.name}</Text>
              <Text style={styles.tmplMeta}>{t.days} · {t.who}</Text>
              <Text style={styles.tmplFreq}>{t.freq}</Text>
            </View>
            <View style={styles.useBtn}>
              <Text style={styles.useBtnText}>Usar</Text>
            </View>
          </View>
        </Pressable>
      ))}

      <View style={styles.blankCard}>
        <Text style={styles.blankTitle}>Personalizada</Text>
        <Text style={styles.blankSub}>Empezá de cero y armá tu propio split día por día.</Text>
        <Pressable style={styles.smallGhostBtn} onPress={() => startBlank()}>
          <Text style={styles.smallGhostBtnText}>Empezar en blanco</Text>
        </Pressable>
      </View>
    </>
  );
}

function LibrarySave({ onDone }) {
  const [name, setName] = useState(routineName() === 'Rutina personalizada' ? '' : routineName());
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <Text style={styles.title}>Guardar rutina</Text>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Nombre</Text>
        <TextInput
          ref={inputRef}
          style={styles.fieldInput}
          value={name}
          onChangeText={setName}
          placeholder="Mi rutina"
          placeholderTextColor="#8a93a6"
        />
      </View>
      <View style={styles.btnRow}>
        <Pressable style={styles.btnGlass} onPress={onDone}>
          <Text style={styles.btnText}>Cancelar</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => { saveCurrentAsLib(name); onDone(); }}>
          <Text style={styles.btnText}>Guardar</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070d' },
  scrollContent: { padding: 18, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 12 },
  backBtnText: { color: '#8a93a6', fontSize: 14, fontWeight: '600' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  sub: { color: '#8a93a6', fontSize: 13, marginTop: 6, marginBottom: 16, lineHeight: 18 },
  h3: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  ghostBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,.06)', marginBottom: 4 },
  ghostBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#0e1626', borderRadius: 14, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,.08)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8 },
  rowGrow: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  tag: { color: '#a78bfa', fontSize: 11, fontWeight: '700' },
  rowSub: { color: '#8a93a6', fontSize: 12, marginTop: 2 },
  miniBtnRed: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(248,113,113,.12)' },
  miniBtnRedText: { color: '#f87171', fontSize: 13, fontWeight: '700' },
  tmplHint: { color: '#8a93a6', fontSize: 12.5, marginBottom: 10 },
  tmplCard: { backgroundColor: '#0e1626', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,.08)', padding: 14, marginBottom: 10 },
  tmplRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tmplName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  tmplMeta: { color: '#8a93a6', fontSize: 12.5, marginTop: 2 },
  tmplFreq: { color: '#5b9dff', fontSize: 12, marginTop: 3, fontWeight: '600' },
  useBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.08)' },
  useBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  blankCard: { borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,.15)', padding: 16, marginTop: 4 },
  blankTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  blankSub: { color: '#8a93a6', fontSize: 13, marginBottom: 12 },
  smallGhostBtn: { paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,.15)' },
  smallGhostBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  field: { marginBottom: 16 },
  fieldLabel: { color: '#8a93a6', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  fieldInput: { color: '#fff', fontSize: 15, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.06)' },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,.08)' },
  btnGlass: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.15)' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
