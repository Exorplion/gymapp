// Todas las sesiones cerradas, agrupadas por semana. Se abre desde "Ver todas"
// de la sección Tus sesiones (Progreso), que muestra sólo las 8 más recientes.
//
// Antes este sheet era la ÚNICA forma de ver el historial y colgaba del reloj
// del header, con una fila plana por sesión. Ahora el reloj lleva a Progreso y
// esto es el desborde de esa sección.
import { S, useStore } from '../../lib/state.js';
import { groupSessionsByWeek } from '../../lib/session.js';
import SessionCard from '../SessionCard.jsx';

export default function History() {
  useStore();
  const grupos = groupSessionsByWeek(S.sessions);
  const n = S.sessions.length;

  return (
    <>
      <h2 className="sheet-title">Todas tus sesiones</h2>
      <div className="txt-mut" style={{ fontSize: 13, marginTop: 2, marginBottom: 14 }}>
        {n ? `${n} ${n === 1 ? 'sesión cerrada' : 'sesiones cerradas'}` : 'Todavía no cerraste ninguna sesión'}
      </div>

      {!n ? (
        <div className="card"><div className="empty" style={{ padding: 18 }}>
          <p style={{ margin: 0 }}>Tus sesiones completadas aparecerán acá.</p>
        </div></div>
      ) : (
        grupos.map(g => (
          <div key={g.key}>
            <div className="sess-week">{g.label} · {g.sessions.length} {g.sessions.length === 1 ? 'sesión' : 'sesiones'}</div>
            <div className="sess-list">
              {g.sessions.map(s => <SessionCard key={s.id} sess={s} />)}
            </div>
          </div>
        ))
      )}
    </>
  );
}
