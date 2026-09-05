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
import { fmtD, fmtDFull, fmtNum, kg2lb, round1 } from '../../lib/format.js';
import { muscleVolume } from '../../lib/muscle.js';
import { sessionsSince, routineStability } from '../../lib/rutina-logic.js';
import { groupSessionsByWeek } from '../../lib/session.js';
import { weeklyAvg, exerciseSeries, filterByRange, strengthReadout, project, volumeBand, VOLUME_BANDS, strengthTier, acwr } from '../../lib/charts.js';
import { profileWeight } from '../../lib/macros.js';
import Chart from '../Chart.jsx';
import SessionCard from '../SessionCard.jsx';
import { Info } from '../Icon.jsx';
import { useEffect, useRef } from 'react';
import { countTo, staggerRevealOnce } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';

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
  // Composición corporal (Plan Fierro · Fase 3): masa magra = peso ×
  // (1-%grasa), a partir del último registro con %grasa — separa "bajar de
  // peso" de "recomponer" sin inventar un dato que falta.
  const lastBf = [...S.body].reverse().find(b => b.bodyfat != null);

  const tab = S.progTab;
  const exPts = (tab === 'carga' && S.progEx)
    ? filterByRange((series[S.progEx] || []).map(p => ({ date: p.date, y: Math.round(p.w), r: p.r })), S.progRange)
    : [];

  const trainDays = S.routine.filter(s => s.type === 'workout' && s.exercises?.length);

  // Cuántas semanas de historia hay: el mockup lo pone junto al título como
  // contexto de todo lo que se ve abajo.
  const heat = streakHeatmap();
  const oldest = S.sessions.length ? S.sessions[S.sessions.length - 1].start : null;
  const weeksTracked = oldest ? Math.max(1, Math.round((Date.now() - oldest) / 6048e5)) : 0;

  // Cuenta ascendente del número grande de peso/promedio del hero al montar
  // o al cambiar de dato — mismo touch que el resto de la app (Inicio,
  // Comida) para que un número frío sienta que "llegó".
  const headNumRef = useRef(null);
  useEffect(() => {
    if (headNum == null) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { if (headNumRef.current) headNumRef.current.textContent = fmtNum(round1(headNum)); return; }
    if (headNumRef.current) countTo(headNumRef.current, headNum, { duration: 500, format: n => fmtNum(round1(n)) });
  }, [headNum]);

  return (
    <>
      <div className="vtitle">
        <h1>Progreso</h1>
        <span className="sub">{weeksTracked} semana{weeksTracked === 1 ? '' : 's'}</span>
        <button type="button" className="icon-btn ml-auto" aria-label="Guía" onClick={() => openSheet('guide')}><Info /></button>
      </div>

      <div className="card hero hero-prog">
        <div className="flex items-end justify-between gap-2.5">
          <div>
            <div className="hero-eyebrow">{headLabel}</div>
            <div className="bignum">{headNum != null ? <span ref={headNumRef}>{fmtNum(round1(headNum))}</span> : '—'}<small> kg</small></div>
            {lastW && (
              <div className="text-mut text-[13px] mt-[3px]">
                {wk && wk.curAvg != null ? `último ${fmtNum(round1(lastW.weight))} kg · ` : `${fmtNum(kg2lb(lastW.weight))} lb · `}
                {fmtDFull(lastW.date)}
                {wk && wk.delta != null && (
                  <> · <b className={wk.delta <= 0 ? 'text-ok' : 'text-blue2'}>{wk.delta > 0 ? '+' : ''}{fmtNum(wk.delta)} kg/sem</b></>
                )}
              </div>
            )}
          </div>
          <button type="button" className="reg-btn" onClick={() => openSheet('body-form')}>+ Registro</button>
        </div>
        {wk && wk.curAvg != null && (
          <div className="text-mut text-[11.5px] mt-2 leading-snug">El peso fluctúa 1-2 kg por día; el promedio semanal es la métrica que importa.</div>
        )}
        <div className="seg mt-3">
          {[['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['all', 'Todo']].map(([r, label]) => (
            <button key={r} type="button" className={(S.progRange || 'all') === r ? 'on' : ''} aria-pressed={(S.progRange || 'all') === r} onClick={() => { S.progRange = r; bump(); }}>{label}</button>
          ))}
        </div>
        <div className="mt-3"><Chart id="chartWeight" pts={wpts} opts={{ unit: 'kg' }} /></div>
        {lastBf && (
          <div className="text-mut text-[12.5px] mt-1.5">
            {lastBf.bodyfat}% grasa · masa magra estimada {fmtNum(round1(lastBf.weight * (1 - lastBf.bodyfat / 100)))} kg
          </div>
        )}
        {Object.keys(lastVals).length > 0 && (
          <div className="stats" style={{ '--n': 4 }}>
            {Object.entries(lastVals).map(([k, v]) => (
              <div key={k}>
                <div className="n">{fmtNum(v)}</div>
                <span className="l">{BODY_LABELS[k]} cm</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <SesionesSection />

      <div className="seg my-[var(--s3)]">
        {[['carga', 'Carga'], ['1rm', '1RM'], ['volumen', 'Volumen']].map(([k, label]) => (
          <button key={k} type="button" className={tab === k ? 'on' : ''} aria-pressed={tab === k} onClick={() => { S.progTab = k; bump(); }}>{label}</button>
        ))}
      </div>

      {tab === 'carga' && (
        !exNames.length ? (
          <div className="card"><div className="empty p-[18px]"><p className="m-0">Completa sesiones para ver la progresión<br />de tu mejor serie (peso × reps).</p></div></div>
        ) : (
          <div className="card">
            <div className="field mb-2.5">
              <select aria-label="Elegir ejercicio" value={S.progEx || ''} onChange={e => { S.progEx = e.target.value; bump(); }}>
                {exNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <Chart id="chartEx" pts={exPts} opts={{ unit: 'kg' }} />
            <div className="text-mut text-xs text-center mt-1.5">Peso de tu mejor serie por sesión · tocá un punto para ver las reps</div>
          </div>
        )
      )}

      {tab === '1rm' && <StrengthTab />}

      {tab === 'volumen' && <VolumeTab />}

      {trainDays.length > 0 && (
        <>
          <div className="sect">Frecuencia</div>
          <div className="card">
            <div className="stats" style={{ '--n': 2 }}>
              <div><div className="n">{sessionsSince(7)}</div><span className="l">Sesiones · 7 días</span></div>
              <div><div className="n">{sessionsSince(30)}</div><span className="l">Sesiones · 30 días</span></div>
            </div>
          </div>
          <div className="card sub">
            {trainDays.map(slot => {
              const st = routineStability(slot.id);
              const bits = [];
              bits.push(st?.last ? `última vez ${fmtD(st.last)}` : 'sin sesiones registradas aún');
              if (st?.sessions) bits.push(`mismos ejercicios hace ${st.sessions} ${st.sessions === 1 ? 'sesión' : 'sesiones'}`);
              return (
                <div key={slot.id} className="row"><div className="grow"><div className="t">{slot.name || 'Rutina'}</div><div className="s">{bits.join(' · ')}</div></div></div>
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
          {heat.days.map(d => <div key={d.date} className={cn('cell', d.status)} title={d.date}></div>)}
        </div>
        <div className="const-stats">
          <div><div className="cond">{currentStreak()}</div><span>Racha actual</span></div>
          <div><div className="cond">{bestStreak()}</div><span>Mejor racha</span></div>
          <div><div className="cond">{heat.pct}%</div><span>Cumplimiento</span></div>
        </div>
      </div>

      <div className="sect">PRs · Récords personales</div>
      {!exNames.length ? (
        <div className="card sub"><div className="empty p-[18px]"><p className="m-0">Aquí brillarán tus mejores marcas. 🏆</p></div></div>
      ) : (
        <PRsList exNames={exNames} />
      )}
    </>
  );
}

/** "Qué hice" es lo que más se consulta de Progreso, así que va arriba de los
    gráficos y debajo del hero de peso. Antes el historial no estaba en esta
    pantalla: vivía detrás del reloj del header, como una lista de filas planas.
    Muestra las últimas 8 agrupadas por semana; el resto vive en el sheet de
    todas las sesiones. */
function SesionesSection() {
  const recientes = S.sessions.slice(0, 8);
  return (
    <div id="sesiones" className="scroll-mt-[70px]">
      <div className="sect">
        Tus sesiones
        {S.sessions.length > 8 && (
          <button
            type="button" className="btn sm ghost w-auto h-8 px-3 ml-auto"
            onClick={() => openSheet('history')}
          >
            Ver todas
          </button>
        )}
      </div>
      {!recientes.length ? (
        <div className="card"><div className="empty p-[18px]">
          <p className="m-0">Cuando cierres tu primera sesión va a aparecer acá.</p>
        </div></div>
      ) : (
        groupSessionsByWeek(recientes).map(g => (
          <div key={g.key}>
            <div className="sess-week">{g.label} · {g.sessions.length} {g.sessions.length === 1 ? 'sesión' : 'sesiones'}</div>
            <div className="sess-list">
              {g.sessions.map(s => <SessionCard key={s.id} sess={s} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function StrengthTab() {
  const readout = strengthReadout();
  return (
    <>
      <div className="sect">Fuerza · 1RM estimado</div>
      {!readout.length ? (
        <div className="card sub"><div className="empty p-[18px]"><p className="m-0">Registrá un ejercicio en dos sesiones para empezar a ver su tendencia.</p></div></div>
      ) : (
        <div className="card">
          {readout.slice(0, 10).map(x => {
            const pr = project(x.t, 4);
            let cls = 'text-mut', tag = '';
            if (!x.t) tag = `${x.pts.length} sesion${x.pts.length === 1 ? '' : 'es'} · faltan datos para calcular tendencia`;
            else if (pr) { cls = 'text-ok'; tag = `+${fmtNum(round1(pr.perWeek))} kg/sem · en 4 semanas ≈ ${fmtNum(round1(pr.value))} kg${pr.capped ? ' (ritmo acotado)' : ''}`; }
            else if (x.t.slope > 0) { cls = 'text-blue2'; tag = 'subiendo pero irregular · sin señal suficiente para proyectar'; }
            else if (x.t.slope === 0) { cls = 'text-warn'; tag = `plano en las últimas ${x.t.n} sesiones · probá variar reps, series o ejercicio`; }
            else { cls = 'text-warn'; tag = `bajando en las últimas ${x.t.n} sesiones · revisá descanso y alimentación`; }
            return (
              <div key={x.name} className="row">
                <div className="grow"><div className="t">{x.name}</div><div className="s"><span className={cls}>{tag}</span></div></div>
                <div className="text-right flex-none">
                  <div className="num text-[length:var(--t-xl)] text-blue3 leading-none">{fmtNum(round1(x.last))}</div>
                  <div className="text-mut text-[length:var(--t-micro)] tracking-[.08em]">KG 1RM</div>
                </div>
              </div>
            );
          })}
          <div className="text-mut text-[length:var(--t-sm)] leading-normal mt-[var(--s3)]">Calculado con la fórmula de Epley sobre tu mejor serie de cada sesión (se ignoran las de más de 12 reps, donde la fórmula se desvía). La proyección supone que mantenés el ritmo y se limita a 1 %/semana: la fuerza no sube en línea recta.</div>
        </div>
      )}
    </>
  );
}

const BAND_COLOR = { bajo: 'var(--text-mut, #8B97B4)', efectivo: 'var(--ok, #2EE6A8)', 'cerca-max': 'var(--warn, #FFB454)', excedido: 'var(--danger, #FF5470)' };
const BAND_LABEL = { bajo: 'Bajo mínimo', efectivo: 'Rango efectivo', 'cerca-max': 'Cerca del máximo', excedido: 'Excedido' };

function VolumeTab() {
  const mv = muscleVolume(7);
  const cats = Object.entries(mv).sort((a, b) => b[1] - a[1]);
  if (!cats.length) return null;
  const risk = acwr();
  return (
    <>
      {risk?.risk && (
        <div className="card sub" style={{ borderColor: 'var(--warn, #FFB454)' }}>
          <div className="text-[13.5px] text-txt font-medium">⚠ Volumen alto esta semana</div>
          <div className="s text-mut mt-1">Tonelaje 7 días ({fmtNum(risk.acute)} kg) es {risk.ratio}× tu promedio de las últimas 4 semanas — riesgo de sobreentrenamiento.</div>
        </div>
      )}
      <div className="sect">Volumen por grupo · 7 días</div>
      <div className="card">
        {cats.map(([c, n]) => {
          const band = volumeBand(c, n);
          const b = VOLUME_BANDS[c];
          const pct = b ? Math.min(100, Math.round((n / (b.mrv * 1.15)) * 100)) : Math.round(n / cats[0][1] * 100);
          return (
            <div key={c} className="mb-[var(--s3)]">
              <div className="flex justify-between text-[length:var(--t-sm)] mb-[var(--s1)]">
                <span>{c}</span>
                <span className="num">{n} series · <span style={{ color: BAND_COLOR[band] }}>{BAND_LABEL[band]}</span></span>
              </div>
              <div className="pbar"><i style={{ width: `${pct}%`, background: BAND_COLOR[band] }}></i></div>
            </div>
          );
        })}
        <div className="text-mut text-[length:var(--t-sm)] leading-normal">Bandas de Renaissance Periodization (Mike Israetel): mínimo efectivo, rango que hace crecer y máximo recuperable — varían por grupo.</div>
      </div>
    </>
  );
}

function PRsList({ exNames }) {
  const bw = profileWeight();
  const prs = exNames.map(n => {
    let maxW = 0, bestVol = 0, bestSet = null, dV = '';
    [...S.sessions].forEach(s => (s.entries || []).forEach(e => {
      if (e.name.trim() !== n) return;
      e.sets.forEach(st => {
        if (st.w > maxW) maxW = st.w;
        if (st.w * st.r > bestVol) { bestVol = st.w * st.r; bestSet = st; dV = s.date; }
      });
    }));
    return { n, maxW, bestSet, dV, tier: strengthTier(n, maxW, bw) };
  }).filter(p => p.bestSet).sort((a, b) => b.maxW - a.maxW);
  const listRef = useRef(null);
  // Reveal escalonado de la lista de PRs — sólo la primera vez que ESTE
  // conteo de PRs se ve en la sesión. La key incluye prs.length a propósito:
  // remontar Progreso por un simple cambio de pestaña (key={store.tab} en
  // App.jsx) no debe volver a animar la lista si nada cambió, pero un PR
  // nuevo de verdad (prs.length distinto) sí tiene que revelarse.
  useEffect(() => {
    const rows = listRef.current?.querySelectorAll(':scope > .row');
    if (rows?.length) staggerRevealOnce(`progreso-prs-${prs.length}`, rows);
  }, [prs.length]);
  return (
    <div className="card" ref={listRef}>
      {prs.map(p => (
        <div key={p.n} className="row">
          <div className="grow"><div className="t">{p.n}</div>
            <div className="s">Mejor serie {fmtNum(round1(p.bestSet.w))} × {p.bestSet.r} · {fmtD(p.dV)}</div>
            {p.tier && <div className="s text-blue2">{p.tier.label} · {p.tier.ratio}× tu peso corporal</div>}</div>
          <div className="text-right flex-none">
            <div className="pr-w">{fmtNum(round1(p.maxW))}<span className="text-[length:var(--t-sm)] text-mut"> kg</span></div>
            <div className="text-mut text-[length:var(--t-micro)]">{fmtNum(kg2lb(p.maxW))} lb</div>
          </div>
        </div>
      ))}
    </div>
  );
}
