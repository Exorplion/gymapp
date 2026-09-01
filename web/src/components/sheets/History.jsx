// Todas las sesiones cerradas, agrupadas por semana. Se abre desde "Ver todas"
// de la sección Tus sesiones (Progreso), que muestra sólo las 8 más recientes.
//
// Antes este sheet era la ÚNICA forma de ver el historial y colgaba del reloj
// del header, con una fila plana por sesión. Ahora el reloj lleva a Progreso y
// esto es el desborde de esa sección.
import { useEffect, useRef } from 'react';
import { S, useStore } from '../../lib/state.js';
import { groupSessionsByWeek } from '../../lib/session.js';
import { bloomOpen, staggerReveal } from '../../lib/motion.js';
import { Card } from '../ui/primitives.jsx';
import SessionCard from '../SessionCard.jsx';

export default function History() {
  useStore();
  const grupos = groupSessionsByWeek(S.sessions);
  const n = S.sessions.length;
  const rootRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { bloomOpen(rootRef.current); }, []);
  useEffect(() => {
    if (listRef.current) staggerReveal(listRef.current.children);
  }, [n]);

  return (
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">Todas tus sesiones</h2>
      <div className="mt-0.5 mb-3.5 text-[13px] text-mut">
        {n ? `${n} ${n === 1 ? 'sesión cerrada' : 'sesiones cerradas'}` : 'Todavía no cerraste ninguna sesión'}
      </div>

      {!n ? (
        <Card className="p-[18px] text-center text-mut">
          <p className="m-0">Tus sesiones completadas aparecerán acá.</p>
        </Card>
      ) : (
        <div ref={listRef}>
          {grupos.map(g => (
            <div key={g.key}>
              <div className="mx-0.5 mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-mut">{g.label} · {g.sessions.length} {g.sessions.length === 1 ? 'sesión' : 'sesiones'}</div>
              <div className="mb-4 flex flex-col gap-2.5">
                {g.sessions.map(s => <SessionCard key={s.id} sess={s} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
