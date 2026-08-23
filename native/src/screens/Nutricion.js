// native/src/screens/Nutricion.js
// Puerto de web/src/components/screens/Nutricion.jsx (242 líneas) — tarjeta
// de perfil/CTA, navegador de fecha, anillo de kcal, barras de macros +
// nutriFeedback(), fila "Un toque" (frequentMeals()), fila "Frecuentes"
// (S.foods) y la lista de comidas del día.
//
// El anillo de kcal: el original reusa el gradiente #restGrad de
// RestTimer.jsx (montado siempre en App.jsx, resuelve vía url(#id) del DOM,
// document-wide). RestTimer.jsx no existe en RN todavía, y react-native-svg
// NO comparte gradientes entre <Svg> como el DOM — el hallazgo C2 de la
// revisión final de Etapa 4a (Silhouette.js: <Defs> en un <Svg> separado del
// que pintaba los <Path>, gradiente invisible) es exactamente la clase de
// bug a evitar acá. Por eso: <Defs> propio, DENTRO del mismo <Svg> que tiene
// los <Circle> que lo consumen.
//
// "Un toque" y "Frecuentes" llaman logMeal()/addMealFromFood() (Task 2)
// directo, sin sheet, igual que el original evita el sheet para esos dos
// casos. El botón "+ Agregar comida" del original (que abre el sheet
// meal-form) se conectó en Etapa 5l — llama openSheet('meal-form', {slot:
// slotForTime(...)}) directo, ya con MealForm.js portado. El botón
// "🎙 Registrar por voz" (food-voice) se agregó en Etapa 5j, que portó ese
// sheet (camino de texto completo, dictado diferido) — llama
// openSheet('food-voice') directo, mismo criterio que la tarjeta de perfil
// incompleto (openSheet('profile') desde Etapa 5f): no dejar un placeholder
// sobreviviendo a que su sheet real ya exista (bug de Etapa 3 con
// Library.js).
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { S, useStore, bump, openSheet } from '../lib/state.js';
import { dstr, fmtDFull, fmtNum, round1 } from '../lib/format.js';
import { computeMacros, GOAL_LABEL } from '../lib/macros.js';
import { mealsOf, macroCls, nutriFeedback, frequentMeals, mealsBySlot, slotForTime } from '../lib/meals.js';
import { idb } from '../lib/db.js';
import { logMeal, addMealFromFood } from '../lib/meal-logic.js';
import { C, T, R } from '../theme';

const BLUE = C.blue;
const GREEN = C.ok;
const AMBER = C.warn;
const RED = C.red;
const MUT = C.mut;

// 2*Math.PI*52 redondeado — mismo círculo (r=52) que el original, literal,
// no fórmula (el original también lo tenía como "326.7" fijo).
const KCAL_CIRC = 326.7;

function shiftNutriDate(days) {
  const d = new Date(S.nutriDate + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const s = dstr(d);
  if (s > dstr()) return;
  S.nutriDate = s;
  bump();
}

async function deleteMeal(id) {
  await idb.del('meals', id);
  S.meals = S.meals.filter(m => m.id !== id);
  bump();
}

async function deleteFood(id) {
  await idb.del('foods', id);
  S.foods = S.foods.filter(f => f.id !== id);
  if (!S.foods.length) S.foodEdit = false;
  bump();
}

// Mapeo de los tags planos de meals.js a color, decidido en esta screen (el
// lib no sabe de RN/colores — ver docblock de meals.js):
//   macroCls(): 'ok' -> verde, 'warn' -> ámbar, 'red' -> rojo, '' -> neutro.
//   nutriFeedback().dot: 'empty'/'blue' -> azul (mismo color, "sin marcar
//     todavía" y "va bien, sobra margen" comparten tono neutro-informativo
//     en el original: .fdot sin clase == gris/azulado tenue), 'ok' -> verde,
//     'warn' -> ámbar, 'red' -> rojo.
const MACRO_COLOR = { ok: GREEN, warn: AMBER, red: RED, '': BLUE };
const DOT_COLOR = { empty: MUT, blue: BLUE, ok: GREEN, warn: AMBER, red: RED };

export default function Nutricion() {
  useStore();
  const date = S.nutriDate;
  const meals = mealsOf(date);
  const tot = meals.reduce((a, mm) => ({ kcal: a.kcal + mm.kcal, p: a.p + mm.p, c: a.c + mm.c, f: a.f + mm.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  const g = S.cfg.goals;
  const m = S.cfg.goalsAuto ? computeMacros() : null;
  const pct = (v, goal) => goal ? Math.min(100, v / goal * 100) : 0;
  const isToday = date === dstr();
  const kc = Math.round(tot.kcal), tp = Math.round(tot.p), tc = Math.round(tot.c), tf = Math.round(tot.f);
  const kcalOff = KCAL_CIRC * (1 - Math.min(1, g.kcal ? kc / g.kcal : 0));
  const freq = frequentMeals();
  const fb = nutriFeedback(kc, tp, tf, g, m);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Comida</Text>
        <Text style={styles.sub}>{fmtDFull(S.nutriDate)}</Text>
      </View>

      {m ? (
        <View style={styles.profCard}>
          <Text style={styles.pavatar}>👤</Text>
          <View style={styles.grow}>
            <Text style={styles.pt}>{GOAL_LABEL[S.cfg.profile.goal]} · {m.target} kcal</Text>
            <Text style={styles.mutSm}>
              {S.cfg.profile.sex === 'f' ? 'Mujer' : 'Hombre'} · {fmtNum(round1(m.weight))} kg · P {m.protMin}-{m.protMax} · G {m.fatMin}-{m.fatMax} · C {m.carbs}g
            </Text>
          </View>
        </View>
      ) : (
        <Pressable style={styles.profCard} onPress={() => openSheet('profile')}>
          <Text style={styles.pavatar}>🎯</Text>
          <View style={styles.grow}>
            <Text style={styles.pt}>Calcular mis macros</Text>
            <Text style={styles.mutSm}>Perfil → TDEE → target y rangos automáticos{S.cfg.goalsAuto ? '' : ' (usando metas manuales)'}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      )}

      <View style={styles.datenav}>
        <Pressable style={styles.miniBtn} onPress={() => shiftNutriDate(-1)}>
          <Text style={styles.miniBtnText}>‹</Text>
        </Pressable>
        <Pressable style={styles.dateMid} disabled={isToday} onPress={() => { S.nutriDate = dstr(); bump(); }}>
          <Text style={styles.dateMidText}>{isToday ? 'Hoy' : fmtDFull(date)}</Text>
          {!isToday && <Text style={styles.mutXs}>toca para volver a hoy</Text>}
        </Pressable>
        <Pressable style={[styles.miniBtn, isToday && styles.miniBtnDisabled]} disabled={isToday} onPress={() => shiftNutriDate(1)}>
          <Text style={styles.miniBtnText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.kcalTop}>
          <View style={styles.kcalRing}>
            <Svg width={104} height={104} viewBox="0 0 120 120">
              {/* Defs vive DENTRO de este mismo <Svg> — el <Circle> de abajo
                  lo referencia con stroke="url(#kcalGrad)". Un <Defs> en un
                  <Svg> separado sería invisible acá (ver docblock arriba). */}
              <Defs>
                <LinearGradient id="kcalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={C.blue2} />
                  <Stop offset="100%" stopColor={BLUE} />
                </LinearGradient>
              </Defs>
              <Circle cx={60} cy={60} r={52} stroke={C.line} strokeWidth={10} fill="none" />
              <Circle
                cx={60} cy={60} r={52}
                stroke="url(#kcalGrad)" strokeWidth={10} fill="none"
                strokeDasharray={KCAL_CIRC}
                strokeDashoffset={kcalOff}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
            </Svg>
            <View style={styles.krVal}>
              <Text style={styles.krN}>{kc}</Text>
              <Text style={styles.krOf}>de {g.kcal}</Text>
            </View>
          </View>
          <View style={styles.kcalSide}>
            <Text style={styles.heroEyebrow}>{kc > g.kcal ? 'Excedente' : 'Restantes'}</Text>
            <Text style={styles.kcalBig}>
              {kc > g.kcal ? kc - g.kcal : Math.max(0, g.kcal - kc)}<Text style={styles.kcalUnit}> kcal</Text>
            </Text>
            <Text style={styles.mutSm}>
              {GOAL_LABEL[S.cfg.profile.goal]}
              {S.cfg.profile.weightKg ? ` · ${fmtNum(round1(S.cfg.profile.weightKg))} kg` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.macro3}>
          <MacroBar label="Proteína" val={tp} goal={g.p} pct={pct(tp, g.p)} color={MACRO_COLOR[macroCls(tp, 'prot', m)]} />
          <MacroBar label="Carbos" val={tc} goal={g.c} pct={pct(tc, g.c)} color={BLUE} />
          <MacroBar label="Grasa" val={tf} goal={g.f} pct={pct(tf, g.f)} color={MACRO_COLOR[macroCls(tf, 'fat', m)]} />
        </View>

        <View style={styles.fbRow}>
          <View style={[styles.fdot, { backgroundColor: DOT_COLOR[fb.dot] }]} />
          <View style={styles.grow}>
            <Text style={styles.fbText}>{fb.text}</Text>
            {fb.warn && <Text style={styles.fbWarn}>{fb.warn}</Text>}
          </View>
        </View>
      </View>

      {freq.length > 0 && (
        <>
          <Text style={styles.sect}>Un toque</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {freq.map((f, i) => (
              <Pressable key={i} style={styles.chipBlue} onPress={() => logMeal(f)}>
                <Text style={styles.chipBlueText}>＋ {f.name} <Text style={styles.mutSm}>{f.kcal}</Text></Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {S.foods.length > 0 && (
        <>
          <View style={styles.sectRow}>
            <Text style={styles.sect}>Frecuentes</Text>
            <Pressable
              style={[styles.miniBtn, styles.miniBtnSm, S.foodEdit && styles.miniBtnActive]}
              accessibilityLabel="Editar la lista de frecuentes"
              onPress={() => { S.foodEdit = !S.foodEdit; bump(); }}
            >
              <Text style={[styles.miniBtnText, S.foodEdit && styles.miniBtnTextActive]}>✎</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {S.foods.map(f => S.foodEdit ? (
              <Pressable key={f.id} style={styles.chip} accessibilityLabel={`Borrar ${f.name} de frecuentes`} onPress={() => deleteFood(f.id)}>
                <Text style={styles.chipText}>{f.name} <Text style={styles.chipX}>✕</Text></Text>
              </Pressable>
            ) : (
              <Pressable key={f.id} style={styles.chipBlue} onPress={() => addMealFromFood(f.id)}>
                <Text style={styles.chipBlueText}>＋ {f.name} <Text style={styles.mutSm}>{f.kcal}</Text></Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <Pressable style={styles.addBtn} onPress={() => openSheet('meal-form', { slot: slotForTime(new Date().toTimeString().slice(0, 5)) })}>
        <Text style={styles.addBtnText}>+ Agregar comida</Text>
      </Pressable>

      <Pressable style={styles.voiceBtn} onPress={() => openSheet('food-voice')}>
        <Text style={styles.voiceBtnText}>🎙 Registrar por voz</Text>
        <Text style={styles.mutSm}>decí qué comiste</Text>
      </Pressable>

      <Text style={styles.sect}>Comidas de {isToday ? 'hoy' : 'este día'}</Text>
      {!meals.length ? (
        <View style={styles.card}>
          <Text style={styles.mutSm}>Nada registrado {isToday ? 'hoy' : 'este día'}.</Text>
        </View>
      ) : (
        mealsBySlot(date).map(b => (
          <View key={b.k} style={styles.slotBlock}>
            <View style={styles.slotHead}>
              <Text style={styles.slotLabel}>{b.label}</Text>
              <Text style={styles.slotKcal}>{b.kcal} kcal</Text>
            </View>
            <View style={styles.card}>
              {b.meals.map(meal => (
                <View style={styles.mealRow} key={meal.id}>
                  <View style={styles.grow}>
                    <Text style={styles.mealName}>{meal.name}</Text>
                    <Text style={styles.mealSub}>{meal.kcal} kcal · P {meal.p} · C {meal.c} · G {meal.f}</Text>
                    {meal.items?.length > 1 && (
                      <Text style={styles.mealItems}>
                        {meal.items.map(i => `${i.name} ${i.grams}g`).join(' · ')}
                      </Text>
                    )}
                  </View>
                  {/* La comida no lleva onPress: el original abre un sheet de
                      detalle/edición inexistente acá — mismo criterio que
                      SessionCard.js en Etapa 4a Task 4, se deja inerte en vez
                      de navegar a algo que no existe. Sólo el botón de
                      borrar queda activo, igual que en la web. */}
                  <Pressable style={styles.mealDel} onPress={() => deleteMeal(meal.id)}>
                    <Text style={styles.mealDelText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function MacroBar({ label, val, goal, pct, color }) {
  return (
    <View style={styles.mRow}>
      <View style={styles.mLbl}>
        <Text style={styles.mLblText}>{label}</Text>
        <Text style={styles.mLblText}>{val}/{goal}</Text>
      </View>
      <View style={styles.pbar}>
        <View style={[styles.pbarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 18, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 },
  title: { color: C.txt, fontSize: T.display, fontFamily: 'Barlow_700Bold', fontWeight: '700' },
  sub: { color: MUT, fontSize: 13 },

  grow: { flex: 1 },
  mutSm: { color: MUT, fontSize: 13 },
  mutXs: { color: MUT, fontSize: 11 },

  profCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.r, padding: 14, borderWidth: 1, borderColor: C.line, gap: 12, marginBottom: 12 },
  pavatar: { fontSize: 26 },
  pt: { color: C.txt, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  chev: { color: MUT, fontSize: 20 },

  datenav: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  miniBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  miniBtnDisabled: { opacity: 0.4 },
  miniBtnSm: { width: 32, height: 32 },
  miniBtnActive: { borderColor: BLUE },
  miniBtnText: { color: C.txt, fontSize: 18 },
  miniBtnTextActive: { color: BLUE },
  dateMid: { flex: 1, alignItems: 'center' },
  dateMidText: { color: C.txt, fontSize: 15, fontWeight: '700' },

  hero: { backgroundColor: C.card, borderRadius: R.r, padding: 16, borderWidth: 1, borderColor: C.line, marginBottom: 4 },
  kcalTop: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  kcalRing: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  krVal: { position: 'absolute', alignItems: 'center' },
  krN: { color: C.txt, fontSize: 24, fontFamily: 'BarlowCondensed_700Bold_Italic', fontWeight: '700', fontVariant: ['tabular-nums'] },
  krOf: { color: MUT, fontSize: T.micro },
  kcalSide: { flex: 1 },
  heroEyebrow: { color: MUT, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  kcalBig: { color: C.txt, fontSize: 30, fontFamily: 'BarlowCondensed_700Bold_Italic', fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  kcalUnit: { fontSize: 14, color: MUT, fontWeight: '600' },

  macro3: { marginTop: 16, gap: 10 },
  mRow: {},
  mLbl: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  mLblText: { color: C.mut, fontSize: 13 },
  pbar: { height: 8, borderRadius: 5, backgroundColor: C.line, overflow: 'hidden' },
  pbarFill: { height: '100%', borderRadius: 5 },

  fbRow: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'flex-start' },
  fdot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  fbText: { color: C.mut, fontSize: 13, lineHeight: 18 },
  fbWarn: { color: AMBER, fontSize: 13, lineHeight: 17, marginTop: 2 },

  sect: { color: MUT, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },
  sectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  chipScroll: { marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.line, marginRight: 8 },
  chipText: { color: C.mut, fontSize: 13, fontWeight: '600' },
  chipX: { color: MUT },
  chipBlue: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(46,125,255,.15)', borderWidth: 1, borderColor: 'rgba(46,125,255,.4)', marginRight: 8 },
  chipBlueText: { color: BLUE, fontSize: 13, fontWeight: '600' },

  addBtn: { marginTop: 18, backgroundColor: BLUE, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  addBtnText: { color: C.txt, fontSize: 15, fontWeight: '700' },

  voiceBtn: { marginTop: 10, backgroundColor: C.card, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  voiceBtnText: { color: C.txt, fontSize: 15, fontWeight: '700', marginBottom: 2 },

  card: { backgroundColor: C.card, borderRadius: R.r, padding: 16, borderWidth: 1, borderColor: C.line },

  slotBlock: { marginBottom: 12 },
  slotHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 2 },
  slotLabel: { color: C.mut, fontSize: 13, fontWeight: '700' },
  slotKcal: { color: MUT, fontSize: 13 },

  mealRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  mealName: { color: C.txt, fontSize: 14, fontWeight: '600' },
  mealSub: { color: MUT, fontSize: 12, marginTop: 2 },
  mealItems: { color: '#6b7387', fontSize: 11, marginTop: 2 },
  mealDel: { paddingHorizontal: 8, paddingVertical: 4 },
  mealDelText: { color: MUT, fontSize: 16 },
});
