// Puerto de renderProg() (index.html, sección PROGRESO) — hero de peso +
// gráfico, selector de rango, pestañas Carga/1RM/Volumen, sección de
// frecuencia y tabla de PRs.
//
// La pestaña Volumen NO reusa el markup del card de volumen muscular de
// Hoy.jsx: en el original ambas pantallas llaman a la misma muscleVolume(7)
// pero pintan el resultado con estilos distintos (Hoy: wrapper "card sub",
// barras de 7px con animación "rise"; Progreso: wrapper "card" liso, barras
// de altura default sin animación, otro espaciado). Reusar el componente de
// Hoy tal cual habría sido más corto pero cambia el aspecto visual de esta
// pestaña respecto del original — se prioriza fidelidad sobre el ahorro de
// líneas.
import { S, useStore, bump, openSheet } from '../../lib/state.js';
import { streakHeatmap, currentStreak, bestStreak } from '../../lib/streak.js';
import { WD, WEEK_ORDER, fmtD, fmtDFull, fmtNum, kg2lb, round1 } from '../../lib/format.js';
import { muscleVolume } from '../../lib/muscle.js';
import { sessionsSince, routineStability } from '../../lib/rutina-logic.js';
import { weeklyAvg, exerciseSeries, filterByRange, strengthReadout, project } from '../../lib/charts.js';
import Chart from '../Chart.jsx';

const BODY_LABELS = { waist: 'Cintura', arm: 'Brazo', chest: 'Pecho', leg: 'Pierna' };

export default function Progreso() {
  useStore();

  const weights = S.body.filter(b => b.weight != null);
  const lastW = weights[weights.length - 1];
  const wk = weeklyAvg();
  const series = exerciseSeries();
  const exNames = Object.keys(series).sort((a, b) => a.localeCompare(b));
  // Igual que el original: S es un store mutable externo a React, así que
  // normalizar S.progEx acá (sin bump — sólo lo lee este mismo render) es
  // el mismo patrón que ya usan session.js/rutina-logic.js en otros lados.
  if (!S.progEx || !series[S.progEx]) S.progEx = exNames[0] || null;

  const lastVals = {};
  ['waist', 'arm', 'chest', 'leg'].forEach(k => {
    for (let i = S.body.length - 1; i >= 0; i--) {
      if (S.body[i][k] != null) { lastVals[k] = S.body[i][k]; break; }
    }
  });

  const headNum = wk && wk.curAvg != null ? wk.curAvg : (lastW ? lastW.weight : null);
  const headLabel = wk && wk.curAvg != null ? `Peso · promedio ${wk.n} día${wk.n === 1 ? '' : 's'}` : 'Peso corporal';
  const wpts = filterByRange(weights.map(b => ({ date: b.date, y: round1(b.weight) })), S.progRange);

  const tab = S.progTab;
  const exPts = (tab === 'carga' && S.progEx)
    ? filterByRange((series[S.progEx] || []).map(p => ({ date: p.date, y: Math.round(p.w), r: p.r })), S.progRange)
    : [];

  const trainDays = WEEK_ORDER.filter(wd => S.routine[wd]?.exercises?.length);

  // Cuántas semanas de historia hay: el mockup lo pone junto al título como
  // contexto de todo lo que se ve abajo.
  const heat = streakHeatmap();
  const oldest = S.sessions.length ? S.sessions[S.sessions.length - 1].start : null;
  const weeksTracked = oldest ? Math.max(1, Math.round((Date.now() - oldest) / 6048e5)) : 0;

  return (
    <>
      <div className="vtitle">
        <h1>Progreso</h1>
        <span className="sub">{weeksTracked} semana{weeksTracked === 1 ? '' : 's'}</span>
        <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Guía" onClick={() => openSheet('guide')}>ⓘ</button>
      </div>

      <div className="card hero hero-prog">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div className="hero-eyebrow">{headLabel}</div>
            <div className="bignum">{headNum != null ? fmtNum(round1(headNum)) : '—'}<small> kg</small></div>
            {lastW && (
              <div className="txt-mut" style={{ fontSize: 13, marginTop: 3 }}>
                {wk && wk.curAvg != null ? `último ${fmtNum(round1(lastW.weight))} kg · ` : `${fmtNum(kg2lb(lastW.weight))} lb · `}
                {fmtDFull(lastW.date)}
                {wk && wk.delta != null && (
                  <> · <b className={wk.delta <= 0 ? 'txt-ok' : 'txt-blue'}>{wk.delta > 0 ? '+' : ''}{fmtNum(wk.delta)} kg/sem</b></>
                )}
              </div>
            )}
          </div>
          <button type="button" className="reg-btn" onClick={() => openSheet('body-form')}>+ Registro</button>
        </div>
        {wk && wk.curAvg != null && (
          <div className="txt-mut" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.4 }}>El peso fluctúa 1-2 kg por día; el promedio semanal es la métrica que importa.</div>
        )}
        <div className="seg" style={{ marginTop: 12 }}>
          {[['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['all', 'Todo']].map(([r, label]) => (
            <button key={r} type="button" className={(S.progRange || 'all') === r ? 'on' : ''} onClick={() => { S.progRange = r; bump(); }}>{label}</button>
          ))}
        </div>
        <div style={{ marginTop: 12 }}><Chart id="chartWeight" pts={wpts} opts={{ unit: 'kg' }} /></div>
        {Object.keys(lastVals).length > 0 && (
          <div className="macro3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            {Object.entries(lastVals).map(([k, v]) => (
              <div key={k} style={{ textAlign: 'center' }}>
                <div className="cond" style={{ fontSize: 24, fontWeight: 700 }}>{fmtNum(v)}</div>
                <div className="txt-mut" style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{BODY_LABELS[k]} cm</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="seg" style={{ margin: 'var(--s3) 0' }}>
        {[['carga', 'Carga'], ['1rm', '1RM'], ['volumen', 'Volumen']].map(([k, label]) => (
          <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => { S.progTab = k; bump(); }}>{label}</button>
        ))}
      </div>

      {tab === 'carga' && (
        !exNames.length ? (
          <div className="card"><div className="empty" style={{ padding: 18 }}><p style={{ margin: 0 }}>Completa sesiones para ver la progresión<br />de tu mejor serie (peso × reps).</p></div></div>
        ) : (
          <div className="card">
            <div className="field" style={{ marginBottom: 10 }}>
              <select value={S.progEx || ''} onChange={e => { S.progEx = e.target.value; bump(); }}>
                {exNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <Chart id="chartEx" pts={exPts} opts={{ unit: 'kg' }} />
            <div className="txt-mut" style={{ fontSize: 12, textAlign: 'center', marginTop: 6 }}>Peso de tu mejor serie por sesión · tocá un punto para ver las reps</div>
          </div>
        )
      )}

      {tab === '1rm' && <StrengthTab />}

      {tab === 'volumen' && <VolumeTab />}

      {trainDays.length > 0 && (
        <>
          <div className="sect">Frecuencia</div>
          <div className="card">
            <div className="macro3" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
              <div style={{ textAlign: 'center' }}><div className="cond" style={{ fontSize: 26, fontWeight: 700 }}>{sessionsSince(7)}</div><div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Sesiones · 7 días</div></div>
              <div style={{ textAlign: 'center' }}><div className="cond" style={{ fontSize: 26, fontWeight: 700 }}>{sessionsSince(30)}</div><div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Sesiones · 30 días</div></div>
            </div>
          </div>
          <div className="card sub">
            {trainDays.map(wd => {
              const st = routineStability(wd);
              const bits = [];
              bits.push(st?.last ? `última vez ${fmtD(st.last)}` : 'sin sesiones registradas aún');
              if (st?.sessions) bits.push(`mismos ejercicios hace ${st.sessions} sesión${st.sessions === 1 ? '' : 'es'}`);
              return (
                <div key={wd} className="row"><div className="grow"><div className="t">{S.routine[wd].name || WD[wd]}</div><div className="s">{bits.join(' · ')}</div></div></div>
              );
            })}
          </div>
        </>
      )}

      {/* Constancia: en el mockup el mapa de calor vive acá, no escondido
          detrás de la racha del header. */}
      <div className="sect">Constancia · 8 semanas</div>
      <div className="card">
        <div className="heatmap const">
          {heat.days.map(d => <div key={d.date} className={`cell ${d.status}`} title={d.date}></div>)}
        </div>
        <div className="const-stats">
          <div><div className="cond">{currentStreak()}</div><span>Racha actual</span></div>
          <div><div className="cond">{bestStreak()}</div><span>Mejor racha</span></div>
          <div><div className="cond">{heat.pct}%</div><span>Cumplimiento</span></div>
        </div>
      </div>

      <div className="sect">PRs · Récords personales</div>
      {!exNames.length ? (
        <div className="card sub"><div className="empty" style={{ padding: 18 }}><p style={{ margin: 0 }}>Aquí brillarán tus mejores marcas. 🏆</p></div></div>
      ) : (
        <PRsList exNames={exNames} />
      )}
    </>
  );
}

function StrengthTab() {
  const readout = strengthReadout();
  return (
    <>
      <div className="sect">Fuerza · 1RM estimado</div>
      {!readout.length ? (
        <div className="card sub"><div className="empty" style={{ padding: 18 }}><p style={{ margin: 0 }}>Registrá un ejercicio en dos sesiones para empezar a ver su tendencia.</p></div></div>
      ) : (
        <div className="card">
          {readout.slice(0, 10).map(x => {
            const pr = project(x.t, 4);
            let cls = 'txt-mut', tag = '';
            if (!x.t) tag = `${x.pts.length} sesion${x.pts.length === 1 ? '' : 'es'} · faltan datos para calcular tendencia`;
            else if (pr) { cls = 'txt-ok'; tag = `+${fmtNum(round1(pr.perWeek))} kg/sem · en 4 semanas ≈ ${fmtNum(round1(pr.value))} kg${pr.capped ? ' (ritmo acotado)' : ''}`; }
            else if (x.t.slope > 0) { cls = 'txt-blue'; tag = 'subiendo pero irregular · sin señal suficiente para proyectar'; }
            else if (x.t.slope === 0) { cls = 'txt-warn'; tag = `plano en las últimas ${x.t.n} sesiones · probá variar reps, series o ejercicio`; }
            else { cls = 'txt-warn'; tag = `bajando en las últimas ${x.t.n} sesiones · revisá descanso y alimentación`; }
            return (
              <div key={x.name} className="row">
                <div className="grow"><div className="t">{x.name}</div><div className="s"><span className={cls}>{tag}</span></div></div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div className="num" style={{ fontSize: 'var(--t-xl)', color: 'var(--blue3)', lineHeight: 1 }}>{fmtNum(round1(x.last))}</div>
                  <div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.08em' }}>KG 1RM</div>
                </div>
              </div>
            );
          })}
          <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.5, marginTop: 'var(--s3)' }}>Calculado con la fórmula de Epley sobre tu mejor serie de cada sesión (se ignoran las de más de 12 reps, donde la fórmula se desvía). La proyección supone que mantenés el ritmo y se limita a 1 %/semana: la fuerza no sube en línea recta.</div>
        </div>
      )}
    </>
  );
}

function VolumeTab() {
  const mv = muscleVolume(7);
  const cats = Object.entries(mv).sort((a, b) => b[1] - a[1]);
  if (!cats.length) return null;
  const maxv = cats[0][1];
  return (
    <>
      <div className="sect">Volumen por grupo · 7 días</div>
      <div className="card">
        {cats.map(([c, n]) => (
          <div key={c} style={{ marginBottom: 'var(--s3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-sm)', marginBottom: 'var(--s1)' }}><span>{c}</span><span className="num">{n} series</span></div>
            <div className="pbar"><i style={{ width: `${Math.round(n / maxv * 100)}%` }}></i></div>
          </div>
        ))}
        <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.5 }}>Series registradas por grupo muscular. Como referencia, 10-20 series semanales por grupo es el rango habitual para ganar masa.</div>
      </div>
    </>
  );
}

function PRsList({ exNames }) {
  const prs = exNames.map(n => {
    let maxW = 0, bestVol = 0, bestSet = null, dV = '';
    [...S.sessions].forEach(s => (s.entries || []).forEach(e => {
      if (e.name.trim() !== n) return;
      e.sets.forEach(st => {
        if (st.w > maxW) maxW = st.w;
        if (st.w * st.r > bestVol) { bestVol = st.w * st.r; bestSet = st; dV = s.date; }
      });
    }));
    return { n, maxW, bestSet, dV };
  }).filter(p => p.bestSet).sort((a, b) => b.maxW - a.maxW);
  return (
    <div className="card">
      {prs.map(p => (
        <div key={p.n} className="row">
          <div className="grow"><div className="t">{p.n}</div>
            <div className="s">Mejor serie {fmtNum(round1(p.bestSet.w))} × {p.bestSet.r} · {fmtD(p.dV)}</div></div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div className="pr-w">{fmtNum(round1(p.maxW))}<span style={{ fontSize: 'var(--t-sm)', color: 'var(--mut)' }}> kg</span></div>
            <div className="txt-mut" style={{ fontSize: 'var(--t-micro)' }}>{fmtNum(kg2lb(p.maxW))} lb</div>
          </div>
        </div>
      ))}
    </div>
  );
}
