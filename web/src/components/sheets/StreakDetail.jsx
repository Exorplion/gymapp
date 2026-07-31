// Puerto de sheetStreak() (index.html) — heatmap de 56 días + racha
// actual/mejor/% de cumplimiento. streak.js (Task 2) ya trae toda la lógica
// (currentStreak/bestStreak/streakHeatmap); acá sólo se arma el markup.
import { streakHeatmap, currentStreak, bestStreak } from '../../lib/streak.js';
import { fmtDFull } from '../../lib/format.js';

export default function StreakDetail() {
  const { days, pct } = streakHeatmap();
  const cur = currentStreak(), best = bestStreak();

  return (
    <>
      <h2>🔥 Racha</h2>
      <div className="macro3" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: -4 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="cond" style={{ fontSize: 30, fontWeight: 700 }}>{cur}</div>
          <div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Actual</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="cond" style={{ fontSize: 30, fontWeight: 700 }}>{best}</div>
          <div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Mejor</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="cond" style={{ fontSize: 30, fontWeight: 700 }}>{pct}%</div>
          <div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Cumplimiento</div>
        </div>
      </div>
      <div className="heatmap" style={{ marginTop: 20 }}>
        {days.map((d, i) => (
          <div key={d.date} className={`cell ${d.status}`} style={{ animationDelay: `${i * 8}ms` }} title={fmtDFull(d.date)}></div>
        ))}
      </div>
      <div className="txt-mut" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 14 }}>
        Últimos 56 días · un día cuenta si tenía rutina asignada y completaste la sesión. Los días de descanso no suman ni cortan la racha.
      </div>
    </>
  );
}
