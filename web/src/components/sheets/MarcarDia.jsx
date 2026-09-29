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
// Los pesos (2026-09-29). Hasta acá se anotaba sólo el turno: "los pesos de
// un día que ya pasó no se recuerdan, y ponerlos de memoria ensuciaría los
// récords". Enzo perdió el domingo 27 y el lunes 28 (quedaron en la copia del
// modo prueba) y no tenía cómo volver a cargar lo que SÍ sabe que levantó.
// Ahora, al elegir el turno se abre la sesión (SessionView), que ofrece
// "Cargar las series de ese día" prellenadas con la última vez antes de esa
// fecha, para corregir lo distinto. Lo cargado cuenta como sesión real.
import { S, closeSheet, openSheet, esDiaLibre, setDiaLibre } from '../../lib/state.js';
import { toast } from '../../lib/toast.js';
import { registrarDiaEntrenado } from '../../lib/session.js';
import { fmtDFull } from '../../lib/format.js';
import { catOf } from '../../lib/muscle.js';

export default function MarcarDia({ fecha }) {
  const ya = S.sessions.filter(s => s.date === fecha);
  const turnos = S.routine.filter(s => s.type === 'workout' && s.exercises?.length);
  const libre = esDiaLibre(fecha);

  async function marcar(slotId) {
    /* Anotar que SÍ entrenaste manda sobre la declaración anterior: si el día
       estaba marcado libre y después resulta que fuiste, la marca sobra y
       dejarla haría que Inicio contradijera a la sesión que acabás de
       registrar. */
    // El turno ya estaba anotado ese día: se abre ése (para cargarle las
    // series) en vez de avisar que está repetido y no hacer nada.
    const previa = ya.find(s => s.slotId === slotId);
    if (previa) { openSheet('session-view', { id: previa.id }); return; }
    const sess = await registrarDiaEntrenado(fecha, slotId);
    if (!sess) { closeSheet(); return; }
    await setDiaLibre(fecha, false);
    openSheet('session-view', { id: sess.id });
  }

  /* Antes este botón sólo cerraba el sheet: declarar que no entrenaste no
     dejaba rastro, así que Inicio te seguía empujando a entrenar el mismo día
     que ya habías decidido descansar. Ahora guarda la decisión, y por eso
     dejó de estar solo al fondo con cara de "cancelar" — el descarte es el
     "Cerrar" de al lado. */
  async function alternarLibre() {
    await setDiaLibre(fecha, !libre);
    toast(libre ? 'Listo, ya no figura como día libre' : `Día libre: ${fmtDFull(fecha)}`);
    closeSheet();
  }

  return (
    <>
      <h2>{fmtDFull(fecha)}</h2>

      {ya.length > 0 && (
        <>
          <div className="sheet-sub">Ya anotado este día:</div>
          <div>
            {ya.map(sess => {
              const n = (sess.entries || []).reduce((a, e) => a + (e.sets?.length || 0), 0);
              return (
                <button
                  type="button"
                  className="row w-full text-left"
                  key={sess.id}
                  aria-label={`Abrir ${sess.dayName || 'la sesión'} del ${fmtDFull(fecha)}`}
                  onClick={() => openSheet('session-view', { id: sess.id })}
                >
                  <div className="grow">
                    <div className="t">{sess.dayName || 'Entrenamiento'}</div>
                    <div className="s">{n ? `${n} ${n === 1 ? 'serie' : 'series'}` : 'sin series · tocá para cargarlas'}</div>
                  </div>
                  <span className="chev" aria-hidden="true">›</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {!turnos.length ? (
        <div className="card"><div className="empty">
          <p>Todavía no tenés turnos con ejercicios en tu rutina.</p>
        </div></div>
      ) : (
        <>
          <div className="sheet-sub">
            ¿Qué entrenaste? Elegí el turno y después cargá las series, arrancando
            de lo que hiciste la última vez.
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

      {libre && (
        <div className="sheet-sub">Este día ya figura como <b>día libre</b>.</div>
      )}

      <div className="btn-row">
        <button type="button" className="btn dim" onClick={alternarLibre}>
          {libre ? 'Quitar día libre' : 'Marcar día libre'}
        </button>
        <button type="button" className="btn ghost" onClick={closeSheet}>
          Cerrar
        </button>
      </div>
    </>
  );
}
