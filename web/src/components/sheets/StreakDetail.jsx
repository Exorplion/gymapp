// Puerto de sheetStreak() (index.html) — heatmap de 56 días + racha
// actual/mejor/% de cumplimiento. streak.js (Task 2) ya trae toda la lógica
// (currentStreak/bestStreak/streakHeatmap); acá sólo se arma el markup.
import { useEffect, useRef } from 'react';
import { streakHeatmap, currentStreak, bestStreak } from '../../lib/streak.js';
import { fmtDFull } from '../../lib/format.js';
import { Flame } from '../Icon.jsx';
import { countTo, pulseLike } from '../../lib/motion.js';

export default function StreakDetail() {
  const { days, pct } = streakHeatmap();
  const curRef = useRef(null);
  const bestRef = useRef(null);
  const pctRef = useRef(null);
  const flameRef = useRef(null);

  // Los tres números cuentan hacia arriba al abrir el sheet — la racha es lo
  // primero que se lee acá, así que es lo primero que se anima.
  useEffect(() => {
    if (curRef.current) countTo(curRef.current, currentStreak());
    if (bestRef.current) countTo(bestRef.current, bestStreak());
    if (pctRef.current) countTo(pctRef.current, pct, { format: n => `${Math.round(n)}%` });
    if (flameRef.current) pulseLike(flameRef.current);
  }, [pct]);

  return (
    <>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Flame ref={flameRef} size={24} style={{ color: '#FFC46B' }} />Racha</h2>
      <div className="stats">
        <div><div className="n" ref={curRef}>{currentStreak()}</div><span className="l">Actual</span></div>
        <div><div className="n" ref={bestRef}>{bestStreak()}</div><span className="l">Mejor</span></div>
        <div><div className="n" ref={pctRef}>{pct}%</div><span className="l">Cumplimiento</span></div>
      </div>
      <div className="heatmap" style={{ marginTop: 20 }}>
        {days.map((d, i) => (
          <div key={d.date} className={`cell ${d.status}`} style={{ animationDelay: `${i * 8}ms` }} title={fmtDFull(d.date)}></div>
        ))}
      </div>
      <p className="ptext sm" style={{ marginTop: 14 }}>
        Últimos 56 días · un día cuenta si tenía rutina asignada y completaste la
        sesión. Los días de descanso no suman ni cortan la racha.
      </p>
    </>
  );
}
