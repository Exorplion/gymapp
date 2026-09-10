// "Qué máquina uso para cada ejercicio EN ESTE GIMNASIO."
//
// Las piezas ya existían —`gymEquipFor`/`setGymEquip` (lib/gyms.js) y el sheet
// GymEquip para configurar uno— pero sólo se llegaba a ellas ejercicio por
// ejercicio desde "Mis ejercicios", y con el gimnasio ya activo. O sea: para
// saber qué te falta configurar en un gym había que abrir los 22 ejercicios de
// a uno. Esto es la vista que faltaba: la rutina entera contra UN gimnasio, con
// lo que falta a la vista.
//
// Por qué importa que sea por gym y no una config global: `exKey` (equip.js)
// incluye el equipo, así que el historial de un ejercicio se parte si el mismo
// movimiento se registra con equipos distintos. Tener el match resuelto ANTES
// de entrenar en un gym nuevo es lo que mantiene el historial de una pieza.
import { useEffect, useRef } from 'react';
import { S, openSheet, closeSheet } from '../../lib/state.js';
import { gymEquipFor } from '../../lib/gyms.js';
import { subBlocksOf } from '../../lib/muscle.js';
import { equipLabel } from '../../lib/equip.js';
import { bloomOpen, staggerReveal } from '../../lib/motion.js';

/** Cada ejercicio distinto de la rutina, una sola vez. Sale de S.routine, así
    que no puede desincronizarse de lo que de verdad entrenás. */
function ejerciciosDeLaRutina() {
  const vistos = new Map();
  for (const slot of S.routine) {
    for (const ex of slot.exercises || []) {
      const k = ex.name.trim().toLowerCase();
      if (!vistos.has(k)) vistos.set(k, ex);
    }
  }
  return [...vistos.values()];
}

export default function GymMatch({ gymId }) {
  const gym = S.gyms.find(g => g.id === gymId);
  const exs = ejerciciosDeLaRutina();
  const bloques = subBlocksOf(exs);
  const listos = exs.filter(ex => gymEquipFor(gymId, ex.name)).length;

  const rootRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => { bloomOpen(rootRef.current); }, []);
  useEffect(() => {
    if (listRef.current) staggerReveal(listRef.current.children);
  }, []);

  if (!gym) return null;

  return (
    <div ref={rootRef}>
      <h2>{gym.name}</h2>

      {!exs.length ? (
        <div className="card"><div className="empty">
          <p>Tu rutina todavía no tiene ejercicios, así que no hay nada que emparejar.</p>
        </div></div>
      ) : (
        <>
          <div className="sheet-sub">
            {listos} de {exs.length} ejercicios con equipo asignado acá.
            {listos < exs.length && ' Los que faltan usan el equipo por defecto del ejercicio.'}
          </div>

          <div ref={listRef}>
            {bloques.map(b => (
              <div key={b.cat} className="day-exs-block">
                <div className="day-exs-head">
                  {b.cat}
                  <span>{b.exs.filter(e => gymEquipFor(gymId, e.name)).length}/{b.exs.length}</span>
                </div>
                {b.exs.map(ex => {
                  const ov = gymEquipFor(gymId, ex.name);
                  return (
                    <button
                      type="button"
                      className="row w-full text-left"
                      key={ex.id}
                      onClick={() => openSheet('gym-equip', { gymId, gymName: gym.name, exName: ex.name })}
                    >
                      <div className="grow">
                        <div className="t">{ex.name}</div>
                        {/* Se distingue "acá lo hago con esto" de "todavía no lo
                            dijiste": lo segundo no es un error, es un dato que
                            falta, y decirlo así evita que parezca configurado
                            cuando en realidad está heredando. */}
                        <div className="s">
                          {ov
                            ? `Acá: ${equipLabel(ov) || ov.equip}${ov.machine ? ` · ${ov.machine}` : ''}`
                            : `Sin asignar${equipLabel(ex) ? ` · usa ${equipLabel(ex)}` : ''}`}
                        </div>
                      </div>
                      <span className={`gym-eq-btn${ov ? ' on' : ''}`}>{ov ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      <button type="button" className="btn dim" style={{ marginTop: 16 }} onClick={closeSheet}>Listo</button>
    </div>
  );
}
