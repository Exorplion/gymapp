// La tarjeta de una sesión en una lista. La usan la sección "Tus sesiones" de
// Progreso y el sheet de todas las sesiones, así que vive suelta en
// components/ y no dentro de ninguna de las dos.
//
// Reemplaza a la fila plana `.hist-row` del historial viejo: ahí una sesión
// era una línea de texto (día · duración · series) y había que abrirla para
// saber si valía la pena. Acá el volumen, los récords y qué ejercicios
// hiciste se leen sin entrar.
import { openSheet } from '../lib/state.js';
import { WDS, fmtD } from '../lib/format.js';
import { sessionPRs } from '../lib/session.js';

export default function SessionCard({ sess }) {
  const nsets = (sess.entries || []).reduce((a, e) => a + e.sets.length, 0);
  const vol = Math.round((sess.entries || []).reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0));
  const nprs = sessionPRs(sess).length;
  const names = (sess.entries || []).map(e => e.name).join(' · ');
  // El día de semana se deriva de la fecha, no de sess.weekday — ese campo
  // sólo existe en sesiones viejas (pre-secuencia). La fecha siempre está,
  // en sesiones viejas y nuevas por igual, así que es la fuente confiable.
  const wd = new Date(sess.date + 'T12:00:00').getDay();

  return (
    <button type="button" className="sess-card" onClick={() => openSheet('session-view', { id: sess.id })}>
      <div className="sc-top">
        <span className="hist-badge">{WDS[wd]}</span>
        <span className="sc-name">{sess.dayName || 'Entrenamiento'}</span>
        {nprs > 0 && <span className="sc-pr">🏆{nprs}</span>}
      </div>
      <div className="sc-meta">{fmtD(sess.date)} · {sess.duration} min</div>
      <div className="sc-meta strong">{nsets} series · {vol.toLocaleString('es')} kg de volumen</div>
      {names && <div className="sc-exs">{names}</div>}
    </button>
  );
}
