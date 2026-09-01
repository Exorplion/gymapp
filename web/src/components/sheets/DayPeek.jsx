// Puerto de sheetDayPeek() (index.html) — vista rápida de un día sin entrar
// al editor.
import { useEffect, useRef } from 'react';
import { S } from '../../lib/state.js';
import { WD } from '../../lib/format.js';
import { exInfo, rirScheme } from '../../lib/exdb.js';
import { blocksOf } from '../../lib/muscle.js';
// TEMP verification-only stub (task 9) — editDay no longer exists; DayPeek.jsx
// is now orphaned dead code, a known separate gap not fixed here.
const editDay = () => {};
import { openSheet } from '../../lib/state.js';
import { Info } from '../Icon.jsx';
import { bloomOpen, staggerReveal } from '../../lib/motion.js';
import { Button } from '../ui/primitives.jsx';

export default function DayPeek({ wd }) {
  const d = S.routine[wd];
  const rootRef = useRef(null);
  const blocksRef = useRef(null);

  useEffect(() => {
    bloomOpen(rootRef.current);
    if (blocksRef.current) staggerReveal(blocksRef.current.children);
  }, []);

  if (!d?.exercises?.length) return null;
  const sets = d.exercises.reduce((a, e) => a + e.sets, 0);
  // Mismo agrupamiento que Hoy.jsx (BlockList): junta lo que ya está junto en
  // el orden guardado, no reordena nada.
  const blocks = blocksOf(d.exercises);

  return (
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">{d.name || WD[wd]}</h2>
      <div className="mt-1 mb-4 text-[13px] text-mut">
        {WD[wd]} · {d.exercises.length} ejercicios · {sets} series · {blocks.map(b => b.cat).join(' / ')}
      </div>
      <div ref={blocksRef}>
        {blocks.map(b => (
          <div key={b.cat} className="mb-2">
            <div className="mx-0.5 mb-1.5 mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-mut">{b.cat}</div>
            <div className="rounded-[var(--radius-r-lg)] border border-line bg-[rgba(12,19,34,.4)] p-3">
              {b.exs.map((ex, i) => (
                <div className="flex items-center gap-2.5 py-2" key={ex.id}>
                  <span className="w-5 flex-none text-[13px] text-mut">{i + 1}</span>
                  <div className="grow">
                    <div className="text-[14.5px] text-txt">{ex.name}</div>
                    <div className="text-[13px] text-mut">{ex.sets}×{ex.reps} · RIR {rirScheme(ex.sets, ex.name).join('/')}</div>
                  </div>
                  {exInfo(ex.name) && (
                    <button
                      type="button"
                      className="grid h-8 w-8 flex-none place-items-center rounded-full text-mut transition-colors hover:text-txt"
                      onClick={() => openSheet('ex-info', { name: ex.name, wd, exId: ex.id })}
                    >
                      <Info />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" className="mt-3.5 w-full" onClick={() => editDay(wd)}>
        ✎ Editar este día
      </Button>
    </div>
  );
}
