// Puerto de sheetReorderHoy() (index.html) — modal de drag-to-reorder para
// el día de Hoy. Reusa el mismo mecanismo genérico de drag.js (Task 3/4,
// data-sort/data-sid) que ya usa Rutina.jsx para días/ejercicios — acá con
// kind="hoy" (que commitSort() ya distingue de "days"/"rut"): drag.js sólo
// necesita el markup correcto, no hace falta ninguna lógica nueva.
import { useEffect, useRef } from 'react';
import { S, closeSheet, bump } from '../../lib/state.js';
import { orderedExs, sessionExs, setExOrder } from '../../lib/session.js';
import { staggerReveal } from '../../lib/motion.js';

export default function ReorderHoy() {
  const index = S.cfg.seqIndex;
  // Con sesión abierta se reordena sobre la lista de la sesión (incluye lo
  // agregado en vivo); si no hay sesión, sobre la rutina del turno.
  const exs = S.draft ? sessionExs(index) : orderedExs(index, S.routine[index]?.exercises || []);
  const listRef = useRef(null);

  // Sólo la entrada inicial de las filas se anima (mount) — nunca se toca el
  // reordenamiento en sí, que sigue siendo enteramente cosa de drag.js
  // (data-sort/data-sid intactos).
  useEffect(() => {
    if (listRef.current) staggerReveal(listRef.current.children);
  }, []);

  /* Arrastrar era la ÚNICA forma de reordenar acá, y eso falla el criterio
     2.5.7 de WCAG (todo lo que se hace arrastrando tiene que poder hacerse
     con un solo toque). No es sólo un tema de lectores de pantalla: mantener
     presionado y arrastrar con una mano, de pie, con el teléfono sudado y
     entre serie y serie, es exactamente cuando un gesto sostenido falla.

     Las flechas escriben el mismo orden que el arrastre (`setExOrder`), así
     que las dos formas son intercambiables y ninguna es la de segunda. */
  async function mover(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= exs.length) return;
    const ids = exs.map(e => e.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await setExOrder(index, ids);
    bump();
  }

  return (
    <>
      <h2>Reordenar</h2>
      <div className="drag-hint tight"><span>↕</span><span>Arrastrá manteniendo presionado, o usá las flechas.</span></div>
      <div data-sort="hoy" ref={listRef}>
        {exs.map((ex, i) => (
          <div className="row" data-sid={ex.id} key={ex.id}>
            <div className="grow">
              <div className="t">{ex.name}</div>
              <div className="s">{ex.sets} × {ex.reps}</div>
            </div>
            <button
              type="button"
              className="mini"
              aria-label={`Subir ${ex.name}`}
              disabled={i === 0}
              onClick={() => mover(i, -1)}
            >↑</button>
            <button
              type="button"
              className="mini"
              aria-label={`Bajar ${ex.name}`}
              disabled={i === exs.length - 1}
              onClick={() => mover(i, 1)}
            >↓</button>
            <span className="chev" style={{ cursor: 'grab' }} aria-hidden="true">☰</span>
          </div>
        ))}
      </div>
      <button type="button" className="btn dim" style={{ marginTop: 16 }} onClick={closeSheet}>Listo</button>
    </>
  );
}
