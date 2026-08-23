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
import { C, S as SP, T, R } from '../theme';

// Etapa 3 interceptaba openSheet('confirm', {...}) con un Alert.alert nativo
// (no había sistema de sheets todavía). Etapa 5a Task 1/3 ya lo resuelve de
// verdad vía SheetHost + SHEET_REGISTRY.confirm (ConfirmSheet.js) — no hace
// falta puente ninguno para MOSTRAR el diálogo.
//
// Lo que sí seguía haciendo falta portar es el efecto colateral de
// navegación que el bridge agregaba encima (fix de revisión final de
// Etapa 3, commit a102939): tras confirmar applyLibRoutine/applyTemplate/
// startBlank hay que volver a Rutina; tras deleteLibRoutine o el overwrite
// de saveCurrentAsLib, no. rutina-logic.js/templates.js no saben nada de
// navegación (y no deberían), así que ese "volver" sigue viviendo acá,
// desacoplado del componente de sheet genérico.
//
// Mecanismo: LibraryList sigue seteando navBackRef.current = true justo
// antes de llamar a applyLibRoutine/applyTemplate/startBlank (sin cambios).
// Este efecto corre en cada render (bump() dispara uno vía useStore) y
// mira la transición de S.sheet:
//   - cuando aparece un sheet 'confirm' nuevo (por referencia, para no
//     reprocesar el mismo dos veces), captura el navBackRef vigente en
//     pendingRef y lo limpia enseguida — igual que el bridge original
//     (líneas 36-37 de la versión vieja), así un cancel no deja "pegado"
//     un goBack para la próxima confirmación de otro flujo.
//   - cuando ese mismo sheet 'confirm' se cierra a null (éxito: los 5
//     call sites llaman closeSheet() dentro de su propio onConfirm) y
//     pendingRef estaba en true, navega para atrás.
//   - un cancel no cierra a null: onCancel de los 3 call sites relevantes
//     hace openSheet('library') (no-op en RN, sheet type sin registrar),
//     así que la rama de "cerrado a null" nunca se dispara para un cancel.
function useNavBackAfterConfirm(navigation, navBackRef) {
  const prevSheetRef = useRef(null);
  const pendingRef = useRef(false);
  useEffect(() => {
    const prev = prevSheetRef.current;
    const cur = S.sheet;
    if (cur?.type === 'confirm' && cur !== prev) {
      pendingRef.current = navBackRef.current;
      navBackRef.current = false;
    } else if (prev?.type === 'confirm' && !cur && pendingRef.current) {
      pendingRef.current = false;
      navigation.goBack();
    }
    prevSheetRef.current = cur;
  });
}

export default function Library({ navigation }) {
  useStore();
  const navBackRef = useRef(false);
  useNavBackAfterConfirm(navigation, navBackRef);
  const [mode, setMode] = useState('list');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Pressable style={styles.backBtn} onPress={() => (mode === 'save' ? setMode('list') : navigation.goBack())}>
        <Text style={styles.backBtnText}>‹ {mode === 'save' ? 'Volver' : 'Rutina'}</Text>
      </Pressable>
      {mode === 'save'
        ? <LibrarySave onDone={() => setMode('list')} />
        : <LibraryList navigation={navigation} navBackRef={navBackRef} onSave={() => setMode('save')} />}
    </ScrollView>
  );
}

function LibraryList({ navigation, navBackRef, onSave }) {
  const st = routineStats();

  const handleApplyLib = (id) => {
    navBackRef.current = true;
    applyLibRoutine(id);
  };
  const handleApplyTemplate = async (id) => {
    navBackRef.current = true;
    await applyTemplate(id);
    if (S.sheet?.type !== 'confirm') { navBackRef.current = false; navigation.goBack(); }
  };
  const handleStartBlank = () => {
    navBackRef.current = true;
    startBlank();
    if (S.sheet?.type !== 'confirm') { navBackRef.current = false; navigation.goBack(); }
  };
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
                  <Pressable style={styles.rowGrow} onPress={() => handleApplyLib(r.id)}>
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
        <Pressable key={t.id} style={styles.tmplCard} onPress={() => handleApplyTemplate(t.id)}>
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
        <Pressable style={styles.smallGhostBtn} onPress={() => handleStartBlank()}>
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
          placeholderTextColor={C.mut}
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
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 18, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 12 },
  backBtnText: { color: C.mut, fontSize: 14, fontFamily: 'Barlow_600SemiBold', fontWeight: '600' },
  title: { color: C.txt, fontSize: 24, fontFamily: 'Barlow_700Bold', fontWeight: '700' },
  sub: { color: C.mut, fontSize: T.sm, marginTop: 6, marginBottom: 16, lineHeight: 18 },
  h3: { color: C.txt, fontSize: T.body, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  ghostBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: C.line, marginBottom: 4 },
  ghostBtnText: { color: C.txt, fontSize: T.sm, fontWeight: '600' },
  // padding subido de 6 a S.s3 (12) para alinear con tmplCard/blankCard,
  // ya migradas a R.r — quedaba desalineado, el único radio-18 con relleno
  // de miniatura.
  card: { backgroundColor: C.card, borderRadius: R.r, padding: SP.s3, borderWidth: 1, borderColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8 },
  rowGrow: { flex: 1 },
  rowTitle: { color: C.txt, fontSize: 14, fontWeight: '600' },
  tag: { color: '#a78bfa', fontSize: T.micro, fontWeight: '700' },
  rowSub: { color: C.mut, fontSize: 12, marginTop: 2 },
  miniBtnRed: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(248,113,113,.12)' },
  miniBtnRedText: { color: C.red, fontSize: 13, fontWeight: '700' },
  tmplHint: { color: C.mut, fontSize: 13, marginBottom: 10 },
  tmplCard: { backgroundColor: C.card, borderRadius: R.r, borderWidth: 1, borderColor: C.line, padding: 14, marginBottom: 10 },
  tmplRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tmplName: { color: C.txt, fontSize: 17, fontWeight: '700' },
  tmplMeta: { color: C.mut, fontSize: 13, marginTop: 2 },
  tmplFreq: { color: C.blue2, fontSize: 12, marginTop: 3, fontWeight: '600' },
  useBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: C.line },
  useBtnText: { color: C.txt, fontSize: 13, fontWeight: '600' },
  blankCard: { borderRadius: R.r, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line2, padding: 16, marginTop: 4 },
  blankTitle: { color: C.txt, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  blankSub: { color: C.mut, fontSize: 13, marginBottom: 12 },
  smallGhostBtn: { paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: C.line2 },
  smallGhostBtnText: { color: C.txt, fontSize: 13, fontWeight: '600' },
  field: { marginBottom: 16 },
  fieldLabel: { color: C.mut, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  fieldInput: { color: C.txt, fontSize: 15, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.line },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, backgroundColor: C.line },
  btnGlass: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.line2 },
  btnText: { color: C.txt, fontSize: 13, fontWeight: '600' },
});
