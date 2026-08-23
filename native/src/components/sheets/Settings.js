// Puerto PARCIAL de web/src/components/sheets/Settings.jsx — sólo las
// preferencias simples. Se DIFIEREN esta etapa (documentado en el plan
// docs/superpowers/plans/2026-08-22-rn-etapa5o-settings.md, no un recorte
// silencioso):
//   1. Selector de color de tema (lib/theme.js) — sin color picker nativo
//      equivalente en RN, requeriría una librería de terceros.
//   2. "Buscar actualización" (service worker + caches) — concepto de PWA
//      sin equivalente en app nativa, se omite permanentemente tal como
//      estaba (no es un "sin dispositivo para probar").
//   3. Datos de prueba (seed) — depende de lib/seed.js, no portado.
//   4. Respaldo (JSON) + base de alimentos (MD) — depende de
//      lib/backup.js/lib/foodmd.js, no portados, más acceso a archivos
//      del dispositivo no instalado.
//   5. "Borrar todos los datos" — depende de wipeAll() de backup.js.
// Grep confirmado: ninguno de seed.js/backup.js/foodmd.js/theme.js está
// portado a native/ todavía, ni el botón de ajustes que abriría este sheet
// (Header no portado) — este sheet queda sin caller alcanzable esta etapa,
// mismo patrón que EntryEdit/VoiceLog en etapas previas.
//
// Las metas manuales (Kcal/Prot/Carb/Grasa) son inputs NO controlados
// (defaultValue, sin value=): el original las leía en `onBlur` (evento del
// navegador, dispara UNA vez al perder foco) porque guardar en cada tecla
// persistía dígitos parciales a IndexedDB ("1","19","195","1950"). El
// equivalente RN de "onBlur que expone el texto final" es `onEndEditing`
// (no `onBlur`: en RN ese evento NO expone `nativeEvent.text`, lección de
// Etapa 5m que corrompió datos silenciosamente) — se usa onEndEditing desde
// el principio acá.
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { S, bump, closeSheet, openSheet, saveCfg } from '../../lib/state.js';
import { fmtMMSS } from '../../lib/format.js';
import { computeMacros, applyComputedGoals } from '../../lib/macros.js';
import { scheduleTomorrowReminder } from '../../lib/reminder.js';
import { C } from '../../theme';

function MacroPreview({ m }) {
  return (
    <>
      <View style={styles.cr}><Text style={styles.crLabel}>BMR (Mifflin-St Jeor)</Text><Text style={styles.crVal}>{m.bmr} kcal</Text></View>
      <View style={styles.cr}><Text style={styles.crLabel}>TDEE {m.empirical ? '(empírico)' : '(calculado)'}</Text><Text style={styles.crVal}>{m.tdee} kcal</Text></View>
      <View style={styles.cr}><Text style={styles.crLabel}>Proteína <Text style={styles.crMut}>({m.protMin}–{m.protMax})</Text></Text><Text style={styles.crVal}>{m.prot} g</Text></View>
      <View style={styles.cr}><Text style={styles.crLabel}>Grasa <Text style={styles.crMut}>({m.fatMin}–{m.fatMax})</Text></Text><Text style={styles.crVal}>{m.fat} g</Text></View>
      <View style={styles.cr}><Text style={styles.crLabel}>Carbos <Text style={styles.crMut}>(resto)</Text></Text><Text style={styles.crVal}>{m.carbs} g</Text></View>
      <View style={[styles.cr, styles.crBig]}><Text style={styles.crBigLabel}>Target diario</Text><Text style={styles.crBigVal}>{m.target} kcal</Text></View>
    </>
  );
}

export default function Settings() {
  const g = S.cfg.goals;
  const m = S.cfg.goalsAuto ? computeMacros() : null;

  function setUnit(u) {
    S.cfg.unit = u; saveCfg();
    bump(); // re-renderiza toda la app: wDisplay/wAlt en Hoy/Rutina/Progreso dependen de S.cfg.unit
  }

  function stepRest(d) {
    S.cfg.rest = Math.max(0, (S.cfg.rest || 0) + d);
    saveCfg();
    bump();
  }

  const cuerpoSexo = () => S.cfg.bodySex || S.cfg.profile?.sex || 'm';

  function setCuerpo(s) {
    S.cfg.bodySex = s;
    saveCfg();
    bump();
  }

  function setDayDrop(mode) {
    S.cfg.dayDrop = mode;
    saveCfg();
    bump();
  }

  function setGoalMode(auto) {
    S.cfg.goalsAuto = auto;
    if (S.cfg.goalsAuto && !computeMacros()) {
      S.cfg.goalsAuto = false;
      closeSheet();
      openSheet('profile');
      return;
    }
    applyComputedGoals();
    saveCfg();
    bump();
  }

  function setGoal(k, raw) {
    const num = Math.max(0, parseInt(raw, 10) || 0);
    S.cfg.goals[k] = num;
    saveCfg();
  }

  function setReminderEnabled(on) {
    S.cfg.reminderEnabled = on;
    saveCfg();
    bump();
    scheduleTomorrowReminder().catch(() => {});
  }

  function stepReminderHour(d) {
    const h = ((S.cfg.reminderHour ?? 18) + d + 24) % 24;
    S.cfg.reminderHour = h;
    saveCfg();
    bump();
    scheduleTomorrowReminder().catch(() => {});
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Ajustes</Text>

      <Text style={styles.h3}>Unidad de peso</Text>
      <View style={styles.seg}>
        <Pressable style={[styles.segBtn, S.cfg.unit === 'kg' && styles.segBtnOn]} onPress={() => setUnit('kg')}>
          <Text style={[styles.segBtnText, S.cfg.unit === 'kg' && styles.segBtnTextOn]}>Kilos (kg)</Text>
        </Pressable>
        <Pressable style={[styles.segBtn, S.cfg.unit === 'lb' && styles.segBtnOn]} onPress={() => setUnit('lb')}>
          <Text style={[styles.segBtnText, S.cfg.unit === 'lb' && styles.segBtnTextOn]}>Libras (lb)</Text>
        </Pressable>
      </View>

      <Text style={styles.h3}>Cuerpo del mapa muscular</Text>
      <View style={styles.seg}>
        <Pressable style={[styles.segBtn, cuerpoSexo() !== 'f' && styles.segBtnOn]} onPress={() => setCuerpo('m')}>
          <Text style={[styles.segBtnText, cuerpoSexo() !== 'f' && styles.segBtnTextOn]}>Hombre</Text>
        </Pressable>
        <Pressable style={[styles.segBtn, cuerpoSexo() === 'f' && styles.segBtnOn]} onPress={() => setCuerpo('f')}>
          <Text style={[styles.segBtnText, cuerpoSexo() === 'f' && styles.segBtnTextOn]}>Mujer</Text>
        </Pressable>
      </View>
      <Text style={styles.mut}>Cambia la silueta de Inicio. Los grupos musculares y tus datos son los mismos.</Text>

      <Text style={styles.h3}>Descanso entre series</Text>
      <View style={styles.step}>
        <Pressable style={styles.stepBtn} onPress={() => stepRest(-15)}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <View style={styles.val}>
          <Text style={styles.valText}>{S.cfg.rest ? fmtMMSS(S.cfg.rest) : 'OFF'}</Text>
          <Text style={styles.valAlt}>−/+ 15 seg · 0 = sin timer</Text>
        </View>
        <Pressable style={styles.stepBtn} onPress={() => stepRest(15)}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.h3}>Al mover un día sobre otro ocupado</Text>
      <View style={styles.seg}>
        <Pressable style={[styles.segBtn, (S.cfg.dayDrop || 'ask') === 'ask' && styles.segBtnOn]} onPress={() => setDayDrop('ask')}>
          <Text style={[styles.segBtnText, (S.cfg.dayDrop || 'ask') === 'ask' && styles.segBtnTextOn]}>Preguntar</Text>
        </Pressable>
        <Pressable style={[styles.segBtn, S.cfg.dayDrop === 'shift' && styles.segBtnOn]} onPress={() => setDayDrop('shift')}>
          <Text style={[styles.segBtnText, S.cfg.dayDrop === 'shift' && styles.segBtnTextOn]}>Correr</Text>
        </Pressable>
        <Pressable style={[styles.segBtn, S.cfg.dayDrop === 'swap' && styles.segBtnOn]} onPress={() => setDayDrop('swap')}>
          <Text style={[styles.segBtnText, S.cfg.dayDrop === 'swap' && styles.segBtnTextOn]}>Intercambiar</Text>
        </Pressable>
      </View>
      <Text style={styles.mut}>
        <Text style={styles.bold}>Correr</Text>: el día que estaba ahí se va al próximo día libre. <Text style={styles.bold}>Intercambiar</Text>: los dos cambian de lugar.
      </Text>

      <Text style={styles.h3}>Metas nutricionales diarias</Text>
      <View style={styles.seg}>
        <Pressable style={[styles.segBtn, S.cfg.goalsAuto && styles.segBtnOn]} onPress={() => setGoalMode(true)}>
          <Text style={[styles.segBtnText, S.cfg.goalsAuto && styles.segBtnTextOn]}>Desde perfil</Text>
        </Pressable>
        <Pressable style={[styles.segBtn, !S.cfg.goalsAuto && styles.segBtnOn]} onPress={() => setGoalMode(false)}>
          <Text style={[styles.segBtnText, !S.cfg.goalsAuto && styles.segBtnTextOn]}>Manual</Text>
        </Pressable>
      </View>
      {S.cfg.goalsAuto ? (
        <>
          <View style={[styles.calcbox, { marginTop: 12 }]}>
            {m ? <MacroPreview m={m} /> : <Text style={styles.calcEmpty}>Completa tu perfil para calcular las metas.</Text>}
          </View>
          <Pressable style={styles.ghostBtn} onPress={() => openSheet('profile')}>
            <Text style={styles.ghostBtnText}>✎ Editar perfil</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.f4}>
          <View style={styles.f4Item}>
            <Text style={styles.label}>Kcal</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              defaultValue={String(g.kcal)}
              onEndEditing={ev => setGoal('kcal', ev.nativeEvent.text)}
            />
          </View>
          <View style={styles.f4Item}>
            <Text style={styles.label}>Prot</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              defaultValue={String(g.p)}
              onEndEditing={ev => setGoal('p', ev.nativeEvent.text)}
            />
          </View>
          <View style={styles.f4Item}>
            <Text style={styles.label}>Carb</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              defaultValue={String(g.c)}
              onEndEditing={ev => setGoal('c', ev.nativeEvent.text)}
            />
          </View>
          <View style={styles.f4Item}>
            <Text style={styles.label}>Grasa</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              defaultValue={String(g.f)}
              onEndEditing={ev => setGoal('f', ev.nativeEvent.text)}
            />
          </View>
        </View>
      )}

      <Text style={styles.h3}>Recordatorio diario de entrenar</Text>
      <View style={styles.seg}>
        <Pressable style={[styles.segBtn, S.cfg.reminderEnabled !== false && styles.segBtnOn]} onPress={() => setReminderEnabled(true)}>
          <Text style={[styles.segBtnText, S.cfg.reminderEnabled !== false && styles.segBtnTextOn]}>Activado</Text>
        </Pressable>
        <Pressable style={[styles.segBtn, S.cfg.reminderEnabled === false && styles.segBtnOn]} onPress={() => setReminderEnabled(false)}>
          <Text style={[styles.segBtnText, S.cfg.reminderEnabled === false && styles.segBtnTextOn]}>Desactivado</Text>
        </Pressable>
      </View>
      {S.cfg.reminderEnabled !== false && (
        <View style={[styles.step, { marginTop: 10 }]}>
          <Pressable style={styles.stepBtn} onPress={() => stepReminderHour(-1)}>
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <View style={styles.val}>
            <Text style={styles.valText}>{String(S.cfg.reminderHour ?? 18).padStart(2, '0')}:00</Text>
            <Text style={styles.valAlt}>−/+ 1 hora · sólo si hay un turno pendiente</Text>
          </View>
          <Pressable style={styles.stepBtn} onPress={() => stepReminderHour(1)}>
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.version}>FIERRO v1 · datos 100% en tu dispositivo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 6 },
  h3: { color: C.mut, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 },
  mut: { color: C.mut, fontSize: 13, lineHeight: 19, marginTop: 8 },
  bold: { fontWeight: '700', color: C.mut },

  seg: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: C.line, borderWidth: 1, borderColor: C.line,
  },
  segBtnOn: { backgroundColor: C.blue, borderColor: C.blue },
  segBtnText: { color: C.mut, fontSize: 14, fontWeight: '600' },
  segBtnTextOn: { color: C.txt },

  step: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.line, borderRadius: 12, overflow: 'hidden' },
  stepBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  stepBtnText: { color: C.txt, fontSize: 18, fontWeight: '700' },
  val: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  valText: { color: C.txt, fontSize: 16, fontWeight: '700' },
  valAlt: { color: C.mut, fontSize: 11, marginTop: 2 },

  calcbox: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line },
  calcEmpty: { color: C.mut, textAlign: 'center', fontSize: 13 },
  cr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  crLabel: { color: C.mut, fontSize: 13 },
  crMut: { color: C.mut2, fontSize: 12 },
  crVal: { color: C.txt, fontSize: 14, fontWeight: '700' },
  crBig: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 4, paddingTop: 10 },
  crBigLabel: { color: C.txt, fontSize: 15, fontWeight: '700' },
  crBigVal: { color: C.blue, fontSize: 17, fontWeight: '800' },

  ghostBtn: { backgroundColor: C.line, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  ghostBtnText: { color: C.txt, fontWeight: '700', fontSize: 13 },

  f4: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  f4Item: { width: '47%' },
  label: { color: C.mut, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    color: C.txt, fontSize: 15, borderWidth: 1, borderColor: C.line,
  },

  version: { color: C.mut, fontSize: 12, textAlign: 'center', marginTop: 24 },
});
