// Puerto de sheetReorderHoy() (index.html) — modal de drag-to-reorder para
// el día de Hoy. Reusa el mismo mecanismo genérico de drag.js (Task 3/4,
// data-sort/data-sid) que ya usa Rutina.jsx para días/ejercicios — acá con
// kind="hoy" (que commitSort() ya distingue de "days"/"rut"): drag.js sólo
// necesita el markup correcto, no hace falta ninguna lógica nueva.
import { S, closeSheet } from '../../lib/state.js';
import { orderedExs, currentDayForHoy } from '../../lib/session.js';

export default function ReorderHoy() {
  const wd = currentDayForHoy();
  const exs = orderedExs(wd, S.routine[wd]?.exercises || []);

  return (
    <>
      <h2>Reordenar</h2>
      <div className="drag-hint tight"><span>↕</span><span>Mantené presionado y arrastrá para cambiar el orden.</span></div>
      <div data-sort="hoy">
        {exs.map(ex => (
          <div className="row" data-sid={ex.id} key={ex.id}>
            <div className="grow">
              <div className="t">{ex.name}</div>
              <div className="s">{ex.sets} × {ex.reps}</div>
            </div>
            <span className="chev" style={{ cursor: 'grab' }}>☰</span>
          </div>
        ))}
      </div>
      <button type="button" className="btn dim" style={{ marginTop: 16 }} onClick={closeSheet}>Listo</button>
    </>
  );
}
