// Puerto de sheetDayPeek() (index.html) — vista rápida de un día sin entrar
// al editor.
import { S } from '../../lib/state.js';
import { WD } from '../../lib/format.js';
import { exInfo, rirScheme } from '../../lib/exdb.js';
// TEMP verification-only stub (task 9) — editDay no longer exists; DayPeek.jsx
// is now orphaned dead code, a known separate gap not fixed here.
const editDay = () => {};
import { openSheet } from '../../lib/state.js';
import { Info } from '../Icon.jsx';

export default function DayPeek({ wd }) {
  const d = S.routine[wd];
  if (!d?.exercises?.length) return null;
  const sets = d.exercises.reduce((a, e) => a + e.sets, 0);

  return (
    <>
      <h2>{d.name || WD[wd]}</h2>
      <div className="sheet-sub">
        {WD[wd]} · {d.exercises.length} ejercicios · {sets} series
      </div>
      <div className="card sub" style={{ padding: 'var(--s2) var(--s3)' }}>
        {d.exercises.map((ex, i) => (
          <div className="row" key={ex.id}>
            <span className="txt-mut" style={{ width: 20, flex: 'none', fontSize: 13 }}>{i + 1}</span>
            <div className="grow">
              <div className="t">{ex.name}</div>
              <div className="s">{ex.sets}×{ex.reps} · RIR {rirScheme(ex.sets, ex.name).join('/')}</div>
            </div>
            {exInfo(ex.name) && (
              <button
                type="button"
                className="mini info"
                onClick={() => openSheet('ex-info', { name: ex.name, wd, exId: ex.id })}
              >
                <Info />
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" className="btn ghost" style={{ marginTop: 14 }} onClick={() => editDay(wd)}>
        ✎ Editar este día
      </button>
    </>
  );
}
