// Todas las sesiones cerradas, agrupadas por semana. Se abre desde "Ver todas"
// de la sección Tus sesiones (Progreso), que muestra sólo las 8 más recientes.
//
// Antes este sheet era la ÚNICA forma de ver el historial y colgaba del reloj
// del header, con una fila plana por sesión. Ahora el reloj lleva a Progreso y
// esto es el desborde de esa sección.
import { useEffect, useRef, useState } from 'react';
import { S, useStore } from '../../lib/state.js';
import { groupSessionsByWeek } from '../../lib/session.js';
import { bloomOpen, staggerReveal } from '../../lib/motion.js';
import { Card } from '../ui/primitives.jsx';
import SessionCard from '../SessionCard.jsx';

/* Ocho semanas por tanda: entran casi dos meses de entrenamiento, que es la
   ventana que alguien mira de verdad al abrir el historial. */
const SEMANAS_POR_TANDA = 8;

export default function History() {
  useStore();
  const n = S.sessions.length;
  /* Se pintan las semanas de a tandas. Este sheet montaba TODAS las sesiones
     de toda la vida de una sola vez, y cada una es una SessionCard con su
     propio markup: a las 200 sesiones son 200 tarjetas construidas para ver
     las tres de arriba. Se pagina por SEMANA y no por sesión para no partir
     un grupo por la mitad — el encabezado "semana del…" quedaría anunciando
     sesiones que no están.

     El botón dice cuántas faltan en vez de "cargar más": el número es el dato
     que hace falta para decidir si vale la pena seguir bajando. */
  const [semanas, setSemanas] = useState(SEMANAS_POR_TANDA);
  const todos = groupSessionsByWeek(S.sessions);
  const grupos = todos.slice(0, semanas);
  const faltan = todos.length - grupos.length;
  const rootRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { bloomOpen(rootRef.current); }, []);
  useEffect(() => {
    if (listRef.current) staggerReveal(listRef.current.children);
  }, [n]);
  // Las tandas siguientes NO vuelven a animar la lista entera: sólo entran
  // las semanas nuevas, y las que ya estabas mirando se quedan quietas.
  useEffect(() => {
    if (semanas === SEMANAS_POR_TANDA) return;
    const nuevas = Array.from(listRef.current?.children || []).slice(semanas - SEMANAS_POR_TANDA);
    if (nuevas.length) staggerReveal(nuevas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanas]);

  return (
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">Todas tus sesiones</h2>
      <div className="mt-0.5 mb-3.5 text-sm text-mut">
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
              <div className="mx-0.5 mb-2 mt-4 text-micro font-semibold uppercase tracking-wide text-mut">{g.label} · {g.sessions.length} {g.sessions.length === 1 ? 'sesión' : 'sesiones'}</div>
              <div className="mb-4 flex flex-col gap-2.5">
                {g.sessions.map(s => <SessionCard key={s.id} sess={s} />)}
              </div>
            </div>
          ))}
          {faltan > 0 && (
            <button
              type="button"
              className="btn sm ghost mt-2"
              onClick={() => setSemanas(x => x + SEMANAS_POR_TANDA)}
            >
              Ver {faltan} {faltan === 1 ? 'semana más' : 'semanas más'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
