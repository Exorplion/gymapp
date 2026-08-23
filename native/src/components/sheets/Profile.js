// Puerto de web/src/components/sheets/Profile.jsx (perfil y macros).
//
// DEVIATION ya documentada por el propio original (ver cabecera de
// Profile.jsx): el sexo (Hombre/Mujer) y el resto de los campos viven todos
// en un solo borrador local de React (`draft`), y sólo se escriben a
// S.cfg.profile al guardar. Se porta tal cual.
//
// Los inputs numéricos libres (edad/altura/peso/TDEE) son NO controlados
// (defaultValue + ref, TextInput con defaultValue en vez de value) — el
// onChangeText sólo actualiza `draft` (parseFloat crudo, sin redondear)
// para alimentar el preview en vivo, nunca reescribe el texto del input
// mientras el usuario tipea (misma clase de bug ya evitada en
// BodyForm.js/Preworkout.js). La única escritura directa a un input es el
// botón "usar último registrado" sobre el campo de peso: acá se usa un
// `ref` + `.setNativeProps({ text })` porque es más liviano que forzar un
// remount con `key` (evita perder el foco/selección de otros campos y no
// depende de re-render) — es un tap, no un tecleo, así que es seguro.
//
// `<select>` (actividad, objetivo) se porta como chips seleccionables (ver
// ruling del plan) — RN no tiene <select>, y ACTF/GOALDELTA tienen 4 y 5
// opciones respectivamente, tamaño natural para chips.
//
// `<input type="range">` (reparto proteína/grasa) usa
// @react-native-community/slider, instalado esta etapa vía `expo install`.
//
// macrosFor(draft) reusa el truco del original: canjea S.cfg.profile por el
// borrador, llama computeMacros() (ya portado, sin modificar), y lo
// restaura antes de que cualquier otro código pueda leerlo — todo síncrono,
// sin await de por medio. Se porta tal cual, sin "arreglar" el side-effect
// temporal.
import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { S, closeSheet, saveCfg } from '../../lib/state.js';
import { fmtNum, round1, vibrate } from '../../lib/format.js';
import {
  computeMacros, applyComputedGoals, profileWeight,
  ACTF, ACT_LABEL, ACT_HINT, GOALDELTA, GOAL_LABEL, GOAL_HINT,
} from '../../lib/macros.js';
import { toast } from '../../lib/toast.js';
import { C } from '../../theme';

function MacroRow({ label, hint, value }) {
  return (
    <View style={styles.cr}>
      <Text style={styles.crLabel}>
        {label}
        {hint ? <Text style={styles.crMut}> {hint}</Text> : null}
      </Text>
      <Text style={styles.crVal}>{value}</Text>
    </View>
  );
}

function MacroPreview({ m }) {
  return (
    <>
      <MacroRow label="BMR (Mifflin-St Jeor)" value={`${m.bmr} kcal`} />
      <MacroRow label={`TDEE ${m.empirical ? '(empírico)' : '(calculado)'}`} value={`${m.tdee} kcal`} />
      <MacroRow label="Proteína" hint={`(${m.protMin}–${m.protMax})`} value={`${m.prot} g`} />
      <MacroRow label="Grasa" hint={`(${m.fatMin}–${m.fatMax})`} value={`${m.fat} g`} />
      <MacroRow label="Carbos" hint="(resto)" value={`${m.carbs} g`} />
      <View style={[styles.cr, styles.crBig]}>
        <Text style={styles.crBigLabel}>Target diario</Text>
        <Text style={styles.crBigVal}>{m.target} kcal</Text>
      </View>
    </>
  );
}

export default function Profile() {
  const p0 = S.cfg.profile;
  const [draft, setDraft] = useState({ ...p0 });
  const weightRef = useRef(null);
  const ageRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => { if (!p0.age) ageRef.current?.focus(); }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sugerencia de peso desde Progreso — sólo si el perfil no tiene peso
  // propio todavía, calculada una vez sobre el perfil REAL (no el
  // borrador), igual que el original.
  const bw = !p0.weightKg ? profileWeight() : null;

  function macrosFor(d) {
    const saved = S.cfg.profile;
    S.cfg.profile = d;
    const m = computeMacros();
    S.cfg.profile = saved;
    return m;
  }
  const m = macrosFor(draft);

  function setField(field, value) { setDraft(d => ({ ...d, [field]: value })); }
  function setNumField(field, raw) {
    const v = parseFloat(raw);
    setDraft(d => ({ ...d, [field]: isNaN(v) ? null : v }));
  }
  function useLastWeight() {
    if (bw == null) return;
    if (weightRef.current) weightRef.current.setNativeProps({ text: String(bw) }); // tap, no tecleo: sí se puede reescribir
    setDraft(d => ({ ...d, weightKg: bw }));
  }

  async function save() {
    if (!draft.age || !draft.height || !draft.weightKg) { toast('Faltan edad, altura o peso'); return; }
    S.cfg.profile = draft;
    S.cfg.goalsAuto = true;
    applyComputedGoals();
    await saveCfg();
    closeSheet();
    vibrate(15);
    const mm = computeMacros();
    toast(`🎯 Metas: ${mm.target} kcal · P ${mm.prot} · C ${mm.carbs} · G ${mm.fat}`);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Perfil y macros</Text>
      <Text style={styles.sub}>Todo se recalcula desde estos datos. Nada queda fijo.</Text>

      <Text style={styles.h3}>Sexo</Text>
      <View style={styles.seg}>
        <Pressable
          style={[styles.segBtn, draft.sex === 'm' && styles.segBtnOn]}
          onPress={() => setField('sex', 'm')}
        >
          <Text style={[styles.segBtnText, draft.sex === 'm' && styles.segBtnTextOn]}>Hombre</Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, draft.sex === 'f' && styles.segBtnOn]}
          onPress={() => setField('sex', 'f')}
        >
          <Text style={[styles.segBtnText, draft.sex === 'f' && styles.segBtnTextOn]}>Mujer</Text>
        </Pressable>
      </View>

      <View style={styles.row2}>
        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>Edad</Text>
          <TextInput
            ref={ageRef}
            style={styles.input}
            keyboardType="number-pad"
            placeholder="24"
            placeholderTextColor={C.mut2}
            defaultValue={draft.age != null ? String(draft.age) : ''}
            onChangeText={t => setNumField('age', t)}
          />
        </View>
        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>Altura (cm)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="179"
            placeholderTextColor={C.mut2}
            defaultValue={draft.height != null ? String(draft.height) : ''}
            onChangeText={t => setNumField('height', t)}
          />
        </View>
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Peso (kg)</Text>
          {bw != null && (
            <Pressable onPress={useLastWeight}>
              <Text style={styles.link}>usar último registrado ({fmtNum(round1(bw))})</Text>
            </Pressable>
          )}
        </View>
        <TextInput
          ref={weightRef}
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="74"
          placeholderTextColor={C.mut2}
          defaultValue={draft.weightKg != null ? String(draft.weightKg) : ''}
          onChangeText={t => setNumField('weightKg', t)}
        />
      </View>

      <Text style={styles.h3}>Nivel de actividad</Text>
      <View style={styles.chipList}>
        {Object.keys(ACTF).map(k => (
          <Pressable
            key={k}
            style={[styles.chip, draft.activity === k && styles.chipOn]}
            onPress={() => setField('activity', k)}
          >
            <Text style={[styles.chipLabel, draft.activity === k && styles.chipLabelOn]}>{ACT_LABEL[k]}</Text>
            <Text style={[styles.chipHint, draft.activity === k && styles.chipHintOn]}>{ACT_HINT[k]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.h3}>Objetivo</Text>
      <View style={styles.chipList}>
        {Object.keys(GOALDELTA).map(k => (
          <Pressable
            key={k}
            style={[styles.chip, draft.goal === k && styles.chipOn]}
            onPress={() => setField('goal', k)}
          >
            <Text style={[styles.chipLabel, draft.goal === k && styles.chipLabelOn]}>{GOAL_LABEL[k]}</Text>
            <Text style={[styles.chipHint, draft.goal === k && styles.chipHintOn]}>{GOAL_HINT[k]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.h3}>Reparto de proteína y grasa</Text>
      <View style={styles.rangerow}>
        <View style={styles.rlbl}>
          <Text style={styles.rlblLabel}>Proteína</Text>
          <Text style={styles.rlblVal}>{m ? `${m.prot} g` : '—'}</Text>
        </View>
        <Slider
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={Math.round((draft.proteinPref ?? 0.5) * 100)}
          onValueChange={v => setField('proteinPref', v / 100)}
          minimumTrackTintColor={C.blue}
          maximumTrackTintColor={C.line2}
          thumbTintColor={C.blue}
        />
      </View>
      <View style={styles.rangerow}>
        <View style={styles.rlbl}>
          <Text style={styles.rlblLabel}>Grasa</Text>
          <Text style={styles.rlblVal}>{m ? `${m.fat} g` : '—'}</Text>
        </View>
        <Slider
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={Math.round((draft.fatPref ?? 0.5) * 100)}
          onValueChange={v => setField('fatPref', v / 100)}
          minimumTrackTintColor={C.blue}
          maximumTrackTintColor={C.line2}
          thumbTintColor={C.blue}
        />
      </View>

      <Text style={styles.h3}>TDEE empírico <Text style={styles.optional}>(opcional)</Text></Text>
      <View style={styles.field}>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder={m ? `calculado: ${m.tdeeCalc}` : 'kcal de mantenimiento real'}
          placeholderTextColor={C.mut2}
          defaultValue={draft.tdeeEmpirical != null ? String(draft.tdeeEmpirical) : ''}
          onChangeText={t => setNumField('tdeeEmpirical', t)}
        />
        <Text style={styles.hintText}>
          Si tras 2-3 semanas tu peso no se mueve como predice el cálculo, pon aquí las kcal a las que realmente te mantienes. Este valor manda sobre el calculado.
        </Text>
      </View>

      <View style={styles.calcbox}>
        {m ? <MacroPreview m={m} /> : (
          <Text style={styles.calcEmpty}>Completa edad, altura y peso para ver tus macros.</Text>
        )}
      </View>

      <Pressable style={styles.btn} onPress={save}>
        <Text style={styles.btnText}>Guardar y usar estas metas</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 4 },
  h3: { color: C.mut, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 },
  sub: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  optional: { color: C.mut, fontWeight: '500', textTransform: 'none', fontSize: 12 },

  seg: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: C.line, borderWidth: 1, borderColor: C.line,
  },
  segBtnOn: { backgroundColor: C.blue, borderColor: C.blue },
  segBtnText: { color: C.mut, fontSize: 14, fontWeight: '600' },
  segBtnTextOn: { color: C.txt },

  row2: { flexDirection: 'row', gap: 10, marginTop: 14 },
  half: { flex: 1 },
  field: { marginTop: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { color: C.mut, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  link: { color: C.blue, fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    color: C.txt, fontSize: 15, borderWidth: 1, borderColor: C.line,
  },
  hintText: { color: C.mut, fontSize: 12, marginTop: 7, lineHeight: 17 },

  chipList: { gap: 8 },
  chip: {
    borderRadius: 12, padding: 12, backgroundColor: C.line,
    borderWidth: 1, borderColor: C.line,
  },
  chipOn: { backgroundColor: 'rgba(46,125,255,.16)', borderColor: C.blue },
  chipLabel: { color: C.txt, fontSize: 14, fontWeight: '600' },
  chipLabelOn: { color: C.blue2 },
  chipHint: { color: C.mut, fontSize: 12, marginTop: 2 },
  chipHintOn: { color: '#a9c3ee' },

  rangerow: { marginTop: 14 },
  rlbl: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  rlblLabel: { color: C.mut, fontSize: 13, fontWeight: '600' },
  rlblVal: { color: C.txt, fontSize: 13, fontWeight: '700' },

  calcbox: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, marginTop: 18 },
  calcEmpty: { color: C.mut, textAlign: 'center', fontSize: 13 },
  cr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  crLabel: { color: C.mut, fontSize: 13 },
  crMut: { color: C.mut2, fontSize: 12 },
  crVal: { color: C.txt, fontSize: 14, fontWeight: '700' },
  crBig: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 4, paddingTop: 10 },
  crBigLabel: { color: C.txt, fontSize: 15, fontWeight: '700' },
  crBigVal: { color: C.blue, fontSize: 17, fontWeight: '800' },

  btn: { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  btnText: { color: C.txt, fontSize: 14, fontWeight: '700' },
});
