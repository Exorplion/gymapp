// La pestaña Progreso, rehecha el 2026-10-06.
//
// Enzo: "la mayoría de la pestaña es solo ver el peso y un gráfico, y abajo
// 'tus sesiones' que no se entiende muy bien… te muestra tu entrenamiento,
// tu carga, el one rep max, el volumen… debería ser más estético, más
// ordenado, tiene que servir un propósito, darle valor al usuario, ver ese
// progreso". Antes medía 3.682 px y abría con el peso; la pregunta del
// gimnasio ("¿estoy más fuerte?") no la contestaba nada.
//
// Ahora, de arriba a abajo, cada bloque contesta UNA pregunta:
//   1. Tu fuerza           ¿estoy más fuerte? Un % y su curva (lib/progreso.js).
//   2. Ejercicio por ejer. ¿qué sube, qué se estancó, qué bajó? Con su curva.
//   3. Récords             ¿qué marqué este mes?
//   4. Tu cuerpo           peso (promedio semanal) y medidas, juntos.
//   5. Esta semana         ¿cuánto volumen real le di a cada músculo?
//   6. Constancia          ¿vengo cumpliendo? Racha y mapa por semanas.
//   7. Historial           la lista de sesiones vive en su hoja (era la
//                          sección "Tus sesiones", que repetía Inicio).
import { useEffect, useRef, useState } from 'react';
import { S, useStore, bump, openSheet } from '../../lib/state.js';
import { streakHeatmap, currentStreak, bestStreak } from '../../lib/streak.js';
import { NBSP, fmtD, fmtDFull, fmtKg, fmtNum, kg2lb, round1 } from '../../lib/format.js';
import { muscleVolume } from '../../lib/muscle.js';
import { weeklyAvg, exerciseSeries, filterByRange, volumeBand, VOLUME_BANDS, strengthTier, acwr } from '../../lib/charts.js';
import { profileWeight } from '../../lib/macros.js';
import { resumenFuerza, proyeccion, recordsRecientes, semanasDeConstancia } from '../../lib/progreso.js';
import Chart from '../Chart.jsx';
import { Info, Trofeo } from '../Icon.jsx';
import { countTo, staggerRevealOnce, D, menosMovimiento } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';

const BODY_LABELS = { waist: 'Cintura', arm: 'Brazo', chest: 'Pecho', leg: 'Pierna' };
const UNI = ' (unilateral)';
const nombreEj = n => (n.endsWith(UNI) ? n.slice(0, -UNI.length) : n);
const signo = v => (v > 0 ? '+' : v < 0 ? '−' : '');
const pctTxt = v => `${signo(v)}${fmtNum(Math.abs(round1(v)))}${NBSP}%`;

export default function Progreso() {
  useStore();
  const res = resumenFuerza();
  const oldest = S.sessions.length ? S.sessions[S.sessions.length - 1].start : null;
  const weeksTracked = oldest ? Math.max(1, Math.round((Date.now() - oldest) / 6048e5)) : 0;

  return (
    <div className="prog">
      <div className="vtitle">
        <h1>Progreso</h1>
        <span className="sub">{weeksTracked} semana{weeksTracked === 1 ? '' : 's'}</span>
        <button type="button" className="icon-btn ml-auto" aria-label="Guía" onClick={() => openSheet('guide')}><Info /></button>
      </div>
      <FuerzaHero res={res} />
      {res && res.ejercicios.length > 0 && <PorEjercicio res={res} />}
      <Records />
      <Cuerpo />
      <EstaSemana />
      <Constancia />
      <HistorialFila />
    </div>
  );
}

/* ============================ 1. Tu fuerza ============================ */

function FuerzaHero({ res }) {
  const numRef = useRef(null);
  const pct = res?.pct;
  useEffect(() => {
    if (pct == null || !numRef.current) return;
    const fmt = n => `${signo(n)}${fmtNum(Math.abs(round1(n)))}`;
    if (menosMovimiento()) { numRef.current.textContent = fmt(pct); return; }
    countTo(numRef.current, pct, { duration: D.momento, format: fmt });
  }, [pct]);

  if (!res || pct == null) {
    return (
      <section className="card hero prog-fuerza" aria-label="Tu fuerza">
        <span className="prog-ojo">Tu fuerza</span>
        <h2 className="prog-vacio-t">Todavía no hay con qué comparar</h2>
        <p className="prog-sub">Cuando registres el mismo ejercicio en sesiones separadas por dos semanas, acá vas a ver si estás más fuerte, y cuánto.</p>
      </section>
    );
  }

  const { cuenta, semanas, indice } = res;
  const total = cuenta.sube + cuenta.igual + cuenta.baja;
  const tono = pct >= 1 ? 'sube' : pct <= -1 ? 'baja' : 'igual';
  return (
    <section className="card hero prog-fuerza" aria-label="Tu fuerza">
      <span className="prog-ojo">Tu fuerza · últimas {semanas} {semanas === 1 ? 'semana' : 'semanas'}</span>
      <div className={`prog-cifra ${tono}`}><span ref={numRef}>{`${signo(pct)}${fmtNum(Math.abs(round1(pct)))}`}</span><small>%</small></div>
      <p className="prog-sub">
        {cuenta.sube > 0 ? <>Subiste en <b>{cuenta.sube}</b> de {total} ejercicios</> : <>Ningún ejercicio subió</>}
        {cuenta.igual > 0 && <>, <b>{cuenta.igual}</b> {cuenta.igual === 1 ? 'sigue' : 'siguen'} igual</>}
        {cuenta.baja > 0 && <> y <b>{cuenta.baja}</b> {cuenta.baja === 1 ? 'bajó' : 'bajaron'}</>}.
      </p>
      <div className="prog-chart"><Chart id="chartFuerza" pts={indice} opts={{ unit: '%' }} /></div>
      <p className="prog-nota">1RM estimado de tu mejor serie, promedio de {total} ejercicios. 100 es cómo estabas al principio del período.</p>
    </section>
  );
}

/* ====================== 2. Ejercicio por ejercicio ====================== */

const FILTROS = [['sube', 'Suben'], ['igual', 'Igual'], ['baja', 'Bajan']];
const TOPE_LISTA = 6;

function PorEjercicio({ res }) {
  const { ejercicios, cuenta } = res;
  const porDefecto = FILTROS.find(([k]) => cuenta[k] > 0)?.[0] || 'sube';
  const [filtro, setFiltro] = useState(porDefecto);
  const [abierto, setAbierto] = useState(null);
  const [todos, setTodos] = useState(false);
  const lista = ejercicios
    .filter(e => e.estado === filtro)
    .sort((a, b) => (filtro === 'baja' ? a.pct - b.pct : b.pct - a.pct));
  const vistos = todos ? lista : lista.slice(0, TOPE_LISTA);
  const listaRef = useRef(null);
  useEffect(() => {
    const filas = listaRef.current?.querySelectorAll(':scope > .prog-ej');
    if (filas?.length) staggerRevealOnce(`prog-ej-${filtro}`, filas);
  }, [filtro]);

  return (
    <section className="prog-sec" aria-label="Ejercicio por ejercicio">
      <h2 className="sect">Ejercicio por ejercicio</h2>
      <div className="seg" role="tablist">
        {FILTROS.map(([k, label]) => (
          <button
            key={k} type="button" role="tab" aria-selected={filtro === k}
            className={filtro === k ? 'on' : ''} disabled={!cuenta[k]}
            onClick={() => { setFiltro(k); setAbierto(null); setTodos(false); }}
          >
            {label} {cuenta[k]}
          </button>
        ))}
      </div>
      <div className="card prog-lista" ref={listaRef}>
        {!lista.length && <p className="prog-sub">Ninguno en este grupo.</p>}
        {vistos.map(e => <FilaEjercicio key={e.name} e={e} abierto={abierto === e.name} onToggle={() => setAbierto(abierto === e.name ? null : e.name)} />)}
      </div>
      {lista.length > TOPE_LISTA && (
        <button type="button" className="btn dim sm" aria-expanded={todos} onClick={() => setTodos(v => !v)}>
          {todos ? 'Ver menos' : `Ver los ${lista.length}`}
        </button>
      )}
      {cuenta.nuevo > 0 && (
        <p className="prog-nota">{cuenta.nuevo} {cuenta.nuevo === 1 ? 'ejercicio todavía no tiene' : 'ejercicios todavía no tienen'} dos semanas de datos para comparar.</p>
      )}
    </section>
  );
}

function FilaEjercicio({ e, abierto, onToggle }) {
  const pr = abierto ? proyeccion(e) : null;
  const uni = e.name.endsWith(UNI);
  return (
    <div className={`prog-ej${abierto ? ' ab' : ''}`}>
      <button type="button" className="prog-ej-fila" aria-expanded={abierto} onClick={onToggle}>
        <span className="prog-ej-m">
          <span className="prog-ej-t">{nombreEj(e.name)}{uni && <span className="prog-ej-uni">unilateral</span>}</span>
          <span className="prog-ej-s">1RM ≈ {fmtNum(round1(e.ult.y))} kg · {fmtD(e.ult.date)}</span>
        </span>
        <Sparkline pts={e.pts} estado={e.estado} />
        <span className={`prog-ej-d ${e.estado}`}>
          <b>{signo(e.delta)}{fmtNum(Math.abs(e.delta))}<small> kg</small></b>
          <span>{pctTxt(e.pct * 100)}</span>
        </span>
      </button>
      {abierto && (
        <div className="prog-ej-det">
          <Chart id="chartEj" pts={e.pts.map(p => ({ date: p.date, y: round1(p.y) }))} opts={{ unit: 'kg' }} />
          <p className="prog-nota">
            {pr
              ? `A este ritmo, en 4 semanas rondarías ${fmtNum(round1(pr.value))} kg de 1RM${pr.capped ? ' (ritmo acotado a 1 % por semana)' : ''}.`
              : e.estado === 'igual' ? 'Estable: probá sumar una rep por serie o cambiar el rango de reps.'
                : e.estado === 'baja' ? 'Bajando: revisá descanso, comida y que el RIR no esté siempre en 0.'
                  : 'Subiendo, todavía sin señal clara para proyectar.'}
          </p>
        </div>
      )}
    </div>
  );
}

/** Mini curva del 1RM estimado. Sin ejes: es para leer la forma, el número
    va al lado. */
function Sparkline({ pts, estado }) {
  if (pts.length < 2) return <span className="prog-spark" aria-hidden="true" />;
  const ys = pts.map(p => p.y);
  const mn = Math.min(...ys), mx = Math.max(...ys);
  const W = 64, H = 26, pad = 3;
  const x = i => pad + (i * (W - pad * 2)) / (pts.length - 1);
  const y = v => (mx === mn ? H / 2 : H - pad - ((v - mn) * (H - pad * 2)) / (mx - mn));
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.y).toFixed(1)}`).join(' ');
  return (
    <svg className={`prog-spark ${estado}`} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={`${d} L${x(pts.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`} className="area" />
      <path d={d} className="linea" />
      <circle cx={x(pts.length - 1)} cy={y(ys[ys.length - 1])} r="2.6" className="punto" />
    </svg>
  );
}

/* ============================== 3. Récords ============================== */

function Records() {
  const recs = recordsRecientes(30);
  const [todos, setTodos] = useState(false);
  const series = exerciseSeries();
  const exNames = Object.keys(series);
  if (!exNames.length) return null;
  return (
    <section className="prog-sec" aria-label="Récords">
      <h2 className="sect">Récords</h2>
      <div className="card prog-recs">
        <div className="prog-recs-cab">
          <span className="prog-recs-n">{recs.length}</span>
          <span className="prog-recs-l">{recs.length === 1 ? 'récord' : 'récords'} en los últimos 30 días</span>
        </div>
        {recs.slice(0, 4).map((r, i) => (
          <div key={`${r.date}-${r.name}-${i}`} className="prog-rec">
            <span className="prog-rec-ico" aria-hidden="true"><Trofeo size={16} /></span>
            <span className="prog-rec-t">{r.name}</span>
            <span className="prog-rec-v">{fmtNum(round1(r.w))} kg × {r.r}</span>
            <span className="prog-rec-f">{fmtD(r.date)}</span>
          </div>
        ))}
        {!recs.length && <p className="prog-sub">Ninguno este mes. Tus mejores marcas siguen abajo.</p>}
      </div>
      <button type="button" className="btn dim sm" aria-expanded={todos} onClick={() => setTodos(v => !v)}>
        {todos ? 'Ocultar tus mejores marcas' : `Tus mejores marcas (${exNames.length})`}
      </button>
      {todos && <PRsList exNames={exNames} />}
    </section>
  );
}

function PRsList({ exNames }) {
  const bw = profileWeight();
  const prs = exNames.map(n => {
    let maxW = 0, bestVol = 0, bestSet = null, dV = '';
    S.sessions.forEach(s => (s.entries || []).forEach(e => {
      if (e.name.trim() !== nombreEj(n)) return;
      e.sets.forEach(st => {
        if (st.w > maxW) maxW = st.w;
        if (st.w * st.r > bestVol) { bestVol = st.w * st.r; bestSet = st; dV = s.date; }
      });
    }));
    return { n, maxW, bestSet, dV, tier: strengthTier(n, maxW, bw) };
  }).filter(p => p.bestSet).sort((a, b) => b.maxW - a.maxW);
  const listRef = useRef(null);
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
            {p.tier && <div className="s text-text">{p.tier.label} · {p.tier.ratio}× tu peso corporal</div>}</div>
          <div className="text-right flex-none">
            <div className="pr-w">{fmtNum(round1(p.maxW))}<span className="text-sm text-text-2"> kg</span></div>
            <div className="text-text-2 text-micro">{fmtNum(kg2lb(p.maxW))} lb</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ 4. Tu cuerpo ============================ */

function Cuerpo() {
  const weights = S.body.filter(b => b.weight != null);
  const lastW = weights[weights.length - 1];
  const wk = weeklyAvg();
  const headNum = wk && wk.curAvg != null ? wk.curAvg : (lastW ? lastW.weight : null);
  const wpts = filterByRange(weights.map(b => ({ date: b.date, y: round1(b.weight) })), S.progRange);
  const lastBf = [...S.body].reverse().find(b => b.bodyfat != null);
  const lastVals = {};
  ['waist', 'arm', 'chest', 'leg'].forEach(k => {
    for (let i = S.body.length - 1; i >= 0; i--) if (S.body[i][k] != null) { lastVals[k] = S.body[i][k]; break; }
  });

  return (
    <section className="prog-sec" aria-label="Tu cuerpo">
      <h2 className="sect">Tu cuerpo</h2>
      <div className="card prog-cuerpo">
        <div className="prog-cuerpo-cab">
          <div>
            <div className="prog-peso">{headNum != null ? fmtNum(round1(headNum)) : '—'}<small> kg</small></div>
            <span className="prog-ojo">{wk && wk.curAvg != null ? `Promedio de ${wk.n} día${wk.n === 1 ? '' : 's'}` : 'Peso corporal'}</span>
          </div>
          <div className="prog-cuerpo-der">
            {wk && wk.delta != null && (
              <span className={cn('prog-tend', wk.delta <= 0 ? 'baja' : 'sube')}>{wk.delta > 0 ? '+' : ''}{fmtNum(wk.delta)} kg/sem</span>
            )}
            <button type="button" className="chip" onClick={() => openSheet('body-form')}>+ Registro</button>
          </div>
        </div>
        {lastW && <p className="prog-nota">Último {fmtKg(round1(lastW.weight))}, {fmtDFull(lastW.date)}. El peso se mueve 1-2 kg de un día a otro: mirá el promedio.</p>}
        <div className="seg">
          {[['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['all', 'Todo']].map(([r, label]) => (
            <button key={r} type="button" className={(S.progRange || 'all') === r ? 'on' : ''} aria-pressed={(S.progRange || 'all') === r} onClick={() => { S.progRange = r; bump(); }}>{label}</button>
          ))}
        </div>
        <Chart id="chartWeight" pts={wpts} opts={{ unit: 'kg' }} />
        {(Object.keys(lastVals).length > 0 || lastBf) && (
          <div className="prog-medidas">
            {Object.entries(lastVals).map(([k, v]) => (
              <div key={k}><b>{fmtNum(v)}<small>{NBSP}cm</small></b><span>{BODY_LABELS[k]}</span></div>
            ))}
            {lastBf && <div><b>{fmtNum(lastBf.bodyfat)}<small>{NBSP}%</small></b><span>Grasa</span></div>}
            {lastBf && <div><b>{fmtNum(round1(lastBf.weight * (1 - lastBf.bodyfat / 100)))}<small>{NBSP}kg</small></b><span>Masa magra</span></div>}
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================ 5. Esta semana ============================ */

const BAND_LABEL = { bajo: 'bajo el mínimo', efectivo: 'en rango', 'cerca-max': 'cerca del máximo', excedido: 'excedido' };

/** Series REALES por grupo en los últimos 7 días, contra su banda (RP,
    Israetel): la franja verde va del mínimo efectivo al rango que hace
    crecer, y varía por grupo. Mismo dibujo que "Tu semana en series" de
    Entreno, que muestra lo que el PLAN promete. */
function EstaSemana() {
  const mv = muscleVolume(7);
  const cats = Object.entries(mv).sort((a, b) => b[1] - a[1]);
  if (!cats.length) return null;
  const risk = acwr();
  return (
    <section className="prog-sec" aria-label="Esta semana">
      <h2 className="sect">Esta semana</h2>
      {risk?.risk && (
        <div className="notice warn">
          <div className="text-sm text-text font-semibold">Volumen alto esta semana</div>
          <div className="s text-text-2 mt-1">Tonelaje 7 días ({fmtKg(risk.acute)}) es {risk.ratio}× tu promedio de las últimas 4 semanas — riesgo de sobreentrenamiento.</div>
        </div>
      )}
      <div className="card prog-semana">
        {cats.map(([c, n]) => {
          const b = VOLUME_BANDS[c] || { mev: 8, mav: 16, mrv: 22 };
          const tope = Math.max(b.mrv * 1.1, n);
          const band = volumeBand(c, n);
          return (
            <div key={c} className="prog-vol" style={{ '--franja-a': b.mev / tope, '--franja-b': b.mav / tope }}>
              <span className="n">{c}</span>
              <span className="ent-barra" aria-hidden="true"><span className="franja" /><i className={band} style={{ '--p': n / tope }} /></span>
              <span className="v">{n}</span>
              <span className={`prog-vol-b ${band}`}>{BAND_LABEL[band]}</span>
            </div>
          );
        })}
        <div className="ent-sem-ley"><i aria-hidden="true" />rango que hace crecer, según el grupo (Renaissance Periodization)</div>
      </div>
    </section>
  );
}

/* ============================ 6. Constancia ============================ */

function Constancia() {
  const heat = streakHeatmap();
  const semanas = semanasDeConstancia(heat.days);
  return (
    <section className="prog-sec" aria-label="Constancia">
      <h2 className="sect">Constancia</h2>
      <div className="card prog-const">
        <div className="prog-const-cifras">
          <div><b>{currentStreak()}</b><span>Racha actual</span></div>
          <div><b>{bestStreak()}</b><span>Mejor racha</span></div>
          <div><b>{heat.pct}%</b><span>Cumplimiento</span></div>
        </div>
        <div className="prog-mapa" role="img" aria-label={`Tus últimas ${semanas.length} semanas: ${heat.days.filter(d => d.status === 'done').length} días entrenados`}>
          <div className="prog-mapa-dias" aria-hidden="true">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}</div>
          {semanas.map((sem, i) => (
            <div key={i} className="prog-mapa-sem">
              {sem.map(d => <span key={d.date} className={`c ${d.status}`} title={d.status === 'fuera' ? undefined : d.date} />)}
            </div>
          ))}
        </div>
        <div className="prog-mapa-ley" aria-hidden="true">
          <span><i className="c done" />entrenaste</span>
          <span><i className="c rest" />descanso</span>
          <span><i className="c miss" />faltaste</span>
        </div>
      </div>
    </section>
  );
}

/* ============================ 7. Historial ============================ */

function HistorialFila() {
  if (!S.sessions.length) return null;
  const ult = S.sessions[0];
  return (
    <div className="group prog-hist">
      <button type="button" className="grouprow" onClick={() => openSheet('history')}>
        <span className="grouprow-grow">
          <span className="grouprow-t">Todas tus sesiones</span>
          <span className="grouprow-s">{S.sessions.length} registradas · la última, {ult.dayName || 'sesión'} del {fmtD(ult.date)}</span>
        </span>
        <span className="grouprow-chev" aria-hidden="true">›</span>
      </button>
    </div>
  );
}
