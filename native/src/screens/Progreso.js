// native/src/screens/Progreso.js
// Puerto de web/src/components/screens/Progreso.jsx — recortado a lo que el
// plan de Etapa 4a pide: racha, silueta, selector de rango, volumen por
// grupo muscular, fuerza estimada (1RM) y sesiones recientes.
//
// Recortes deliberados frente al original (304 líneas):
//  - Sin hero de peso corporal / pestaña "Carga" (peso de la mejor serie
//    por ejercicio) ni tabla de PRs: son la mitad "cuerpo/medidas" de
//    Progreso, fuera del alcance de esta etapa (silueta + gráficos + racha
//    + historial, según el brief de Task 4).
//  - Sin `Chart.jsx` (canvas + drawChart/pickChartPoint): reemplazado por
//    `CartesianChart`/`Line`/`Bar` de victory-native, alimentados con los
//    mismos puntos que produce charts.js. La API confirmada leyendo
//    node_modules/victory-native/dist/*.d.ts (v41, la "XL" de Victory) es:
//    <CartesianChart data xKey yKeys>{({points, chartBounds}) => <Line
//    points={points.y} .../> o <Bar .../>}</CartesianChart> — no existen
//    componentes `LineChart`/`BarChart` de alto nivel en esta versión.
//  - Sin sheet de detalle por ejercicio en el gráfico de fuerza (el
//    original no lo tenía tampoco — Progreso.jsx no abre ningún sheet
//    desde el gráfico de 1RM, sólo desde el hero de peso y "Ver todas" del
//    historial, ambos fuera de alcance acá).
//  - `routineStability` se muestra como texto plano (ya lo es en el
//    original: `st.last`/`st.sessions` van directo a un string, sin
//    componente propio) — no hubo nada que simplificar.
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { CartesianChart, Line, Bar } from 'victory-native';
import { S, useStore, bump, openSheet } from '../lib/state.js';
import { streakHeatmap, currentStreak, bestStreak } from '../lib/streak.js';
import { fmtD, fmtNum, round1 } from '../lib/format.js';
import { muscleVolume, daysSinceAll } from '../lib/muscle.js';
import { sessionsSince, routineStability } from '../lib/rutina-logic.js';
import { groupSessionsByWeek } from '../lib/session.js';
import { strengthReadout, project, filterByRange, RANGE_DAYS } from '../lib/charts.js';
import Silhouette from './Silhouette.js';
import SessionCard from './SessionCard.js';

const BLUE = '#2e7dff';
const GREEN = '#1fbf75';

export default function Progreso({ navigation }) {
  useStore();

  const heat = streakHeatmap();
  const oldest = S.sessions.length ? S.sessions[S.sessions.length - 1].start : null;
  const weeksTracked = oldest ? Math.max(1, Math.round((Date.now() - oldest) / 6048e5)) : 0;
  const trainDays = S.routine.filter(s => s.type === 'workout' && s.exercises?.length);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Progreso</Text>
        <Text style={styles.sub}>{weeksTracked} semana{weeksTracked === 1 ? '' : 's'}</Text>
        <Pressable style={styles.addBtn} onPress={() => openSheet('body-form')}>
          <Text style={styles.addBtnText}>+ Registro</Text>
        </Pressable>
        <Pressable style={styles.guideBtn} onPress={() => openSheet('guide')}>
          <Text style={styles.guideBtnText}>ⓘ</Text>
        </Pressable>
      </View>

      <Silhouette days={daysSinceAll()} />

      <RangeSelector />

      <Text style={styles.sect}>Constancia · 8 semanas</Text>
      <Pressable style={styles.card} onPress={() => openSheet('streak-detail')}>
        <Heatmap heat={heat} />
        <View style={styles.constStats}>
          <View style={styles.constStat}><Text style={styles.constNum}>{currentStreak()}</Text><Text style={styles.constLabel}>Racha actual</Text></View>
          <View style={styles.constStat}><Text style={styles.constNum}>{bestStreak()}</Text><Text style={styles.constLabel}>Mejor racha</Text></View>
          <View style={styles.constStat}><Text style={styles.constNum}>{heat.pct}%</Text><Text style={styles.constLabel}>Cumplimiento</Text></View>
        </View>
      </Pressable>

      <VolumeChart />

      <StrengthChart />

      {trainDays.length > 0 && (
        <>
          <Text style={styles.sect}>Frecuencia</Text>
          <View style={styles.card}>
            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.statNum}>{sessionsSince(7)}</Text><Text style={styles.statLabel}>Sesiones · 7 días</Text></View>
              <View style={styles.stat}><Text style={styles.statNum}>{sessionsSince(30)}</Text><Text style={styles.statLabel}>Sesiones · 30 días</Text></View>
            </View>
          </View>
          <View style={styles.card}>
            {trainDays.map(slot => {
              const st = routineStability(slot.id);
              const bits = [];
              bits.push(st?.last ? `última vez ${fmtD(st.last)}` : 'sin sesiones registradas aún');
              if (st?.sessions) bits.push(`mismos ejercicios hace ${st.sessions} ${st.sessions === 1 ? 'sesión' : 'sesiones'}`);
              return (
                <View key={slot.id} style={styles.row}>
                  <Text style={styles.rowTitle}>{slot.name || 'Rutina'}</Text>
                  <Text style={styles.rowSub}>{bits.join(' · ')}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      <SesionesSection navigation={navigation} />
    </ScrollView>
  );
}

function RangeSelector() {
  const range = S.progRange && RANGE_DAYS[S.progRange] ? S.progRange : '3m';
  return (
    <View style={styles.seg}>
      {[['1m', '1M'], ['3m', '3M'], ['6m', '6M']].map(([r, label]) => (
        <Pressable
          key={r}
          style={[styles.segBtn, range === r && styles.segBtnOn]}
          onPress={() => { S.progRange = r; bump(); }}
        >
          <Text style={[styles.segText, range === r && styles.segTextOn]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Heatmap({ heat }) {
  // Grilla de 7 columnas (semanas de 7 días) x 8 filas — misma info que el
  // `.heatmap.const` de la web (56 días), pintada con Views coloreados en
  // vez de una grilla CSS.
  const colorOf = status => status === 'done' ? GREEN : status === 'miss' ? '#e0505a' : 'rgba(255,255,255,.08)';
  return (
    <View style={styles.heatGrid}>
      {heat.days.map(d => (
        <View key={d.date} style={[styles.heatCell, { backgroundColor: colorOf(d.status) }]} />
      ))}
    </View>
  );
}

function VolumeChart() {
  const mv = muscleVolume(7);
  const cats = Object.entries(mv).sort((a, b) => b[1] - a[1]);
  if (!cats.length) return null;
  const maxv = cats[0][1];
  const data = cats.map(([c, n], i) => ({ x: i, n, cat: c }));

  return (
    <>
      <Text style={styles.sect}>Volumen por grupo · 7 días</Text>
      <View style={styles.card}>
        <View style={{ height: 200 }}>
          <CartesianChart
            data={data}
            xKey="x"
            yKeys={['n']}
            domainPadding={{ left: 30, right: 30, top: 20 }}
            axisOptions={{ labelColor: '#8a93a6', lineColor: 'rgba(255,255,255,.08)' }}
          >
            {({ points, chartBounds }) => (
              <Bar points={points.n} chartBounds={chartBounds} color={BLUE} roundedCorners={{ topLeft: 6, topRight: 6 }} />
            )}
          </CartesianChart>
        </View>
        <View style={styles.barLabels}>
          {cats.map(([c, n]) => (
            <View key={c} style={styles.barLabelRow}>
              <Text style={styles.barLabelCat}>{c}</Text>
              <Text style={styles.barLabelN}>{n} series</Text>
            </View>
          ))}
        </View>
        <Text style={styles.mutSm}>Series registradas por grupo muscular. Como referencia, 10-20 series semanales por grupo es el rango habitual para ganar masa.</Text>
      </View>
    </>
  );
}

function StrengthChart() {
  const readout = strengthReadout();
  const [exName, setExName] = useState(null);
  const active = exName && readout.some(x => x.name === exName) ? exName : (readout[0]?.name || null);
  const range = S.progRange && RANGE_DAYS[S.progRange] ? S.progRange : '3m';

  return (
    <>
      <Text style={styles.sect}>Fuerza · 1RM estimado</Text>
      {!readout.length ? (
        <View style={styles.card}>
          <Text style={styles.mutSm}>Registrá un ejercicio en dos sesiones para empezar a ver su tendencia.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exChips}>
            {readout.slice(0, 10).map(x => (
              <Pressable
                key={x.name}
                style={[styles.chip, active === x.name && styles.chipOn]}
                onPress={() => setExName(x.name)}
              >
                <Text style={[styles.chipText, active === x.name && styles.chipTextOn]}>{x.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {active && (() => {
            const x = readout.find(r => r.name === active);
            const pts = filterByRange(x.pts, range);
            const pr = project(x.t, 4);
            let cls = styles.mutSm, tag = '';
            if (!x.t) tag = `${x.pts.length} sesion${x.pts.length === 1 ? '' : 'es'} · faltan datos para calcular tendencia`;
            else if (pr) { cls = styles.txtOk; tag = `+${fmtNum(round1(pr.perWeek))} kg/sem · en 4 semanas ≈ ${fmtNum(round1(pr.value))} kg${pr.capped ? ' (ritmo acotado)' : ''}`; }
            else if (x.t.slope > 0) { cls = styles.txtBlue; tag = 'subiendo pero irregular · sin señal suficiente para proyectar'; }
            else if (x.t.slope === 0) { cls = styles.txtWarn; tag = `plano en las últimas ${x.t.n} sesiones · probá variar reps, series o ejercicio`; }
            else { cls = styles.txtWarn; tag = `bajando en las últimas ${x.t.n} sesiones · revisá descanso y alimentación`; }

            if (pts.length < 2) {
              return <Text style={styles.mutSm}>No hay suficientes datos en este rango — probá con "6M".</Text>;
            }
            const data = pts.map((p, i) => ({ x: i, y: p.y }));
            return (
              <>
                <View style={{ height: 180, marginTop: 12 }}>
                  <CartesianChart
                    data={data}
                    xKey="x"
                    yKeys={['y']}
                    domainPadding={{ left: 16, right: 16, top: 20, bottom: 10 }}
                    axisOptions={{ labelColor: '#8a93a6', lineColor: 'rgba(255,255,255,.08)' }}
                  >
                    {({ points }) => (
                      <Line points={points.y} color={BLUE} strokeWidth={2.5} curveType="natural" />
                    )}
                  </CartesianChart>
                </View>
                <View style={styles.strengthFoot}>
                  <View>
                    <Text style={cls}>{tag}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.strengthNum}>{fmtNum(round1(x.last))}</Text>
                    <Text style={styles.strengthUnit}>KG 1RM</Text>
                  </View>
                </View>
              </>
            );
          })()}

          <Text style={styles.mutSm}>Calculado con la fórmula de Epley sobre tu mejor serie de cada sesión (se ignoran las de más de 12 reps, donde la fórmula se desvía). La proyección supone que mantenés el ritmo y se limita a 1 %/semana: la fuerza no sube en línea recta.</Text>
        </View>
      )}
    </>
  );
}

/** "Qué hice" — últimas 8 sesiones agrupadas por semana. El resto del
    historial (sheet de "todas las sesiones") queda para la Etapa 5. */
function SesionesSection({ navigation }) {
  const recientes = S.sessions.slice(0, 8);
  return (
    <View>
      <View style={styles.sectRow}>
        <Text style={styles.sectRowText}>Tus sesiones</Text>
        {S.sessions.length > 8 && (
          <Pressable style={styles.verTodasBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => openSheet('history', { navigation })}>
            <Text style={styles.verTodasText}>Ver todas</Text>
          </Pressable>
        )}
      </View>
      {!recientes.length ? (
        <View style={styles.card}>
          <Text style={styles.mutSm}>Cuando cierres tu primera sesión va a aparecer acá.</Text>
        </View>
      ) : (
        groupSessionsByWeek(recientes).map(g => (
          <View key={g.key} style={{ marginBottom: 10 }}>
            <Text style={styles.weekLabel}>{g.label} · {g.sessions.length} {g.sessions.length === 1 ? 'sesión' : 'sesiones'}</Text>
            {g.sessions.map(s => <SessionCard key={s.id} sess={s} navigation={navigation} />)}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070d' },
  content: { padding: 18, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  sub: { color: '#8a93a6', fontSize: 13 },
  addBtn: { marginLeft: 'auto', paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: '#2e7dff', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  guideBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.08)', alignItems: 'center', justifyContent: 'center' },
  guideBtnText: { color: '#8a93a6', fontSize: 15, fontWeight: '700' },

  seg: { flexDirection: 'row', backgroundColor: '#0e1626', borderRadius: 12, padding: 4, marginTop: 16, marginBottom: 4 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segBtnOn: { backgroundColor: BLUE },
  segText: { color: '#8a93a6', fontSize: 13, fontWeight: '600' },
  segTextOn: { color: '#fff' },

  sect: { color: '#8a93a6', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },
  sectRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 8 },
  sectRowText: { color: '#8a93a6', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  verTodasBtn: { marginLeft: 'auto', paddingHorizontal: 12, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.08)', alignItems: 'center', justifyContent: 'center' },
  verTodasText: { color: '#c7cdda', fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: '#0e1626', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,.08)' },

  heatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatCell: { width: '11.5%', aspectRatio: 1, borderRadius: 3 },
  constStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  constStat: { alignItems: 'center' },
  constNum: { color: '#fff', fontSize: 20, fontWeight: '700' },
  constLabel: { color: '#8a93a6', fontSize: 11, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 24 },
  stat: { alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#8a93a6', fontSize: 11, marginTop: 2 },

  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.06)' },
  rowTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowSub: { color: '#8a93a6', fontSize: 12, marginTop: 2 },

  barLabels: { marginTop: 10 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  barLabelCat: { color: '#c7cdda', fontSize: 13 },
  barLabelN: { color: '#8a93a6', fontSize: 12 },
  mutSm: { color: '#8a93a6', fontSize: 12, lineHeight: 17, marginTop: 10 },

  exChips: { marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.06)', marginRight: 8 },
  chipOn: { backgroundColor: BLUE },
  chipText: { color: '#8a93a6', fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: '#fff' },

  strengthFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 },
  strengthNum: { color: BLUE, fontSize: 22, fontWeight: '700', lineHeight: 24 },
  strengthUnit: { color: '#8a93a6', fontSize: 10, letterSpacing: 1 },
  txtOk: { color: GREEN, fontSize: 12 },
  txtBlue: { color: BLUE, fontSize: 12 },
  txtWarn: { color: '#e0a63a', fontSize: 12 },

  weekLabel: { color: '#8a93a6', fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4 },
});
