// "¿Entrenaste este día?" — anotar a mano un día que quedó vacío.
//
// El caso que lo pidió: Enzo entrenó el martes y el jueves, pero el martes no
// lo anotó. Sin esto ese día queda como descanso para siempre: corta la racha,
// no cuenta para el volumen semanal, y el puntero de la secuencia se queda un
// turno atrás — la app termina proponiéndole repetir un turno que ya hizo.
//
// Se ELIGE entre los turnos que ya tiene configurados; no se escribe un nombre
// libre. Un turno suelto que no existe en la rutina no se puede comparar con
// nada después (ni progresión, ni volumen por grupo, ni "última vez"), así que
// sería un dato huérfano.
//
// Y no se piden los pesos. Registrar "hice Posterior A el martes" es un hecho
// que se recuerda; "hice 62.5 × 9, 62.5 × 8 y 60 × 8" no. Pedirlo llevaría a
// completarlo de memoria o con lo de la última vez, y eso entraría al historial
// como si fuera medido: alimentaría PRs, progresión y tonelaje con números
// inventados. La sesión queda marcada como registrada a mano, sin series.
import { S, closeSheet } from '../../lib/state.js';
import { registrarDiaEntrenado } from '../../lib/session.js';
import { fmtDFull } from '../../lib/format.js';
import { catOf } from '../../lib/muscle.js';

export default function MarcarDia({ fecha }) {
  const ya = S.sessions.filter(s => s.date === fecha);
  const turnos = S.routine.filter(s => s.type === 'workout' && s.exercises?.length);

  async function marcar(slotId) {
    await registrarDiaEntrenado(fecha, slotId);
    closeSheet();
  }

  return (
    <>
      <h2>{fmtDFull(fecha)}</h2>

      {ya.length > 0 && (
        <div className="sheet-sub">
          Ya tenés {ya.length === 1 ? 'registrado' : 'registrados'} {ya.map(s => s.dayName).join(', ')} este día.
        </div>
      )}

      {!turnos.length ? (
        <div className="card"><div className="empty">
          <p>Todavía no tenés turnos con ejercicios en tu rutina.</p>
        </div></div>
      ) : (
        <>
          <div className="sheet-sub">
            ¿Qué entrenaste? Se anota el turno, no las series — los pesos de un día que
            ya pasó no se recuerdan, y ponerlos de memoria ensuciaría tus récords.
          </div>
          <div>
            {turnos.map(slot => {
              const grupos = [...new Set((slot.exercises || []).map(catOf).filter(Boolean))];
              return (
                <button
                  type="button"
                  className="row w-full text-left"
                  key={slot.id}
                  onClick={() => marcar(slot.id)}
                >
                  <div className="grow">
                    <div className="t">{slot.name || 'Turno'}</div>
                    <div className="s">
                      {slot.exercises.length} ejercicios{grupos.length ? ` · ${grupos.join(' · ')}` : ''}
                    </div>
                  </div>
                  <span className="chev" aria-hidden="true">›</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <button type="button" className="btn dim" style={{ marginTop: 16 }} onClick={closeSheet}>
        No entrené ese día
      </button>
    </>
  );
}
