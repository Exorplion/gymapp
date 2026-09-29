// Una sesión en una lista. La usan la sección "Tus sesiones" de Progreso y el
// sheet de todas las sesiones, así que vive suelta en components/ y no dentro
// de ninguna de las dos.
//
// Reemplazó a la fila plana `.hist-row` del historial viejo: ahí una sesión
// era una línea de texto (día · duración · series) y había que abrirla para
// saber si valía la pena.
//
// 2026-09-29 (auditoría visual 2, tanda D): de tarjeta a FILA de dos renglones
// dentro de una lista agrupada (.group + .grouprow). La tarjeta medía 115 px
// —insignia, nombre, fecha y duración, series y volumen, y la lista entera de
// ejercicios— y las ocho de Progreso ocupaban 1.136 px. La fila dice lo que se
// mira de un vistazo: arriba el turno y la fecha, abajo series y volumen en
// plomo, y el trofeo sólo si hubo récord. La duración y los ejercicios siguen
// en el detalle, a un toque.
import { openSheet } from '../lib/state.js';
import { WDS, fmtD } from '../lib/format.js';
import { sessionPRs } from '../lib/session.js';
import { Badge } from './ui/primitives.jsx';

export default function SessionCard({ sess }) {
  const nsets = (sess.entries || []).reduce((a, e) => a + e.sets.length, 0);
  const vol = Math.round((sess.entries || []).reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0));
  const nprs = sessionPRs(sess).length;
  // El día de semana se deriva de la fecha, no de sess.weekday — ese campo
  // sólo existe en sesiones viejas (pre-secuencia). La fecha siempre está,
  // en sesiones viejas y nuevas por igual, así que es la fuente confiable.
  const wd = new Date(sess.date + 'T12:00:00').getDay();

  return (
    <button type="button" className="grouprow sess-row" onClick={() => openSheet('session-view', { id: sess.id })}>
      <span className="hist-badge">{WDS[wd]}</span>
      <span className="grouprow-grow">
        <span className="sess-row-top">
          <span className="sc-name">{sess.dayName || 'Entrenamiento'}</span>
          {nprs > 0 && <Badge tone="warn" className="px-2 py-0 leading-5" aria-label={`${nprs} ${nprs === 1 ? 'récord' : 'récords'}`}>🏆{nprs}</Badge>}
          <span className="sess-row-fecha">{fmtD(sess.date)}</span>
        </span>
        {/* Una sesión anotada a mano (registrarDiaEntrenado) no tiene series:
            se sabe QUÉ entrenaste ese día, no con qué pesos. "0 series · 0 kg"
            sería falso — no es que no levantaste nada, es que no está medido.
            Si después se cargaron las series (cargarSeriesRetro), se muestran
            como en cualquier sesión. */}
        <span className="grouprow-s">
          {sess.retro && !sess.entries?.length
            ? 'Anotada a mano · sin series registradas'
            : `${nsets} ${nsets === 1 ? 'serie' : 'series'} · ${vol.toLocaleString('es')} kg de volumen`}
        </span>
      </span>
    </button>
  );
}
