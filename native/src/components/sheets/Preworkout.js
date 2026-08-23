// Puerto de web/src/components/sheets/Preworkout.jsx — dosis de
// fluidos/carbos/cafeína calculadas desde el peso del perfil (macros.js:
// profileWeight(), ya portado para Nutrición).
//
// PW (meal/sensitive) es un objeto mutable a nivel de módulo, igual que T
// (rest.js) o DRAG (drag.js): el original también lo tenía como global que
// sobrevive entre aperturas del sheet dentro de la misma carga de la app
// (no se persiste a IndexedDB). Los checkboxes lo mutan y llaman bump()
// (mismo canal que S) para volver a pintar — no hace falta que PW viva
// dentro de S para eso.
//
// El botón "Ir al perfil" abre el sheet 'profile', que todavía no está
// portado (queda para una etapa futura de Etapa 5). SheetHost.js ya
// resuelve un type no registrado como no-op silencioso (index se queda en
// -1, sin crash ni sheet fantasma) — ver Etapa 5a, hallazgo C2. Se porta el
// botón llamando openSheet('profile') directo, sin fallback.
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { S, bump, closeSheet, openSheet } from '../../lib/state.js';
import { fmtNum, round1, dstr, uid, vibrate } from '../../lib/format.js';
import { profileWeight } from '../../lib/macros.js';
import { idb } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { C } from '../../theme';

const PW = { meal: false, sensitive: false };

export default function Preworkout() {
  const w = profileWeight();

  if (!w) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h2}>Pre-workout</Text>
        <Text style={styles.mut}>
          Necesito tu peso para calcular las dosis. Complétalo en tu perfil.
        </Text>
        <Pressable style={styles.btn} onPress={() => openSheet('profile')}>
          <Text style={styles.btnText}>Ir al perfil</Text>
        </Pressable>
      </View>
    );
  }

  const fluidMin = Math.round(5 * w), fluidMax = Math.round(7 * w);
  const carbs = Math.round(w);
  const cafLo = Math.round(3 * w), cafHi = Math.round(6 * w), cafMax = Math.round(9 * w);
  const CAP = 400;
  const recTop = Math.min(cafHi, CAP);
  const overCap = cafHi > CAP;
  const cafRec = PW.sensitive ? `${Math.round(1.5 * w)}–${cafLo} mg` : `${cafLo}–${recTop} mg`;
  const cafWarn = overCap || PW.sensitive;

  async function addMacros() {
    if (!carbs) { toast('No hay carbos que sumar'); return; }
    // se registra en el día de hoy, no en la fecha que se esté mirando en
    // Nutrición: el pre-workout se toma ahora
    const meal = { id: uid(), date: dstr(), name: 'Pre-workout', kcal: Math.round(carbs * 4), p: 0, c: carbs, f: 0, t: new Date().toTimeString().slice(0, 5) };
    await idb.put('meals', meal);
    S.meals.push(meal);
    vibrate(12);
    closeSheet();
    toast(`＋ Sumado a Nutrición · ${Math.round(carbs * 4)} kcal · ${carbs} g carbos`);
  }
  function toggleMeal() { PW.meal = !PW.meal; bump(); }
  function toggleSens() { PW.sensitive = !PW.sensitive; bump(); }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Pre-workout</Text>
      <Text style={styles.sub}>
        Calculado para tu peso de <Text style={styles.blue}>{fmtNum(round1(w))} kg</Text>. Tómalo ~30-60 min antes de entrenar.
      </Text>

      <View style={styles.calcbox}>
        <View style={styles.cr}>
          <Text style={styles.crLabel}>💧 Fluidos + electrolitos</Text>
          <Text style={styles.crVal}>{fluidMin}–{fluidMax} ml</Text>
        </View>
        <Text style={styles.ptext}>Agua con sodio, potasio, magnesio y calcio (5-7 ml/kg).</Text>
      </View>

      <View style={[styles.calcbox, { marginTop: 10, opacity: PW.meal ? 0.55 : 1 }]}>
        <View style={styles.cr}>
          <Text style={styles.crLabel}>🍯 Carbos rápidos</Text>
          <Text style={styles.crVal}>{PW.meal ? '—' : `${carbs} g`}</Text>
        </View>
        <Text style={styles.ptext}>
          {PW.meal ? 'Ya cubierto: comiste una comida completa 60-90 min antes, no necesitas carbo extra.' : 'Fructosa, glucosa o sacarosa (1 g/kg) para energía rápida.'}
        </Text>
      </View>

      <View style={[styles.calcbox, { marginTop: 10 }]}>
        <View style={styles.cr}>
          <Text style={styles.crLabel}>☕ Cafeína</Text>
          <Text style={[styles.crVal, cafWarn && styles.warn]}>{cafRec}</Text>
        </View>
        <Text style={styles.ptext}>
          {PW.sensitive
            ? <Text style={styles.warn}>Marcaste sensibilidad: empieza bajo (o evítala). No la tomes tarde.</Text>
            : <>Rango efectivo 3-6 mg/kg. {overCap && <Text style={styles.warn}>Tu 6 mg/kg = {cafHi} mg supera el límite prudente de 400 mg — no pases de 400.</Text>}</>}
          {'\n'}El extremo de 9 mg/kg ({cafMax} mg) es solo para gente muy adaptada.
        </Text>
      </View>

      {!PW.meal && (
        <>
          <Pressable style={styles.ghostBtn} onPress={addMacros}>
            <Text style={styles.ghostBtnText}>＋ Sumar a Nutrición · {carbs} g carbos ({Math.round(carbs * 4)} kcal)</Text>
          </Pressable>
          <Text style={styles.ptext}>
            Solo si de verdad los tomás. Fluidos y cafeína no aportan calorías, así que no se cuentan.
          </Text>
        </>
      )}

      <Text style={styles.h3}>Ajustes</Text>
      <View style={styles.checkRow}>
        <Switch value={PW.meal} onValueChange={toggleMeal} />
        <Text style={styles.checkLabel}>Comí una comida completa 60-90 min antes</Text>
      </View>
      <View style={styles.checkRow}>
        <Switch value={PW.sensitive} onValueChange={toggleSens} />
        <Text style={styles.checkLabel}>Soy sensible a la cafeína</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 6 },
  h3: { color: C.txt, fontSize: 15, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  mut: { color: C.mut, fontSize: 14, lineHeight: 20, marginVertical: 10 },
  sub: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  blue: { color: C.blue, fontWeight: '700' },

  calcbox: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line },
  cr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  crLabel: { color: C.txt, fontSize: 14, fontWeight: '600' },
  crVal: { color: C.txt, fontSize: 16, fontWeight: '700' },
  warn: { color: C.warn },
  ptext: { color: C.mut, fontSize: 12.5, lineHeight: 18, marginTop: 8 },

  btn: { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnText: { color: C.txt, fontWeight: '700', fontSize: 15 },

  ghostBtn: { backgroundColor: C.line, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  ghostBtnText: { color: C.txt, fontWeight: '700', fontSize: 14, textAlign: 'center' },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  checkLabel: { color: C.mut, fontSize: 13.5, flexShrink: 1 },
});
