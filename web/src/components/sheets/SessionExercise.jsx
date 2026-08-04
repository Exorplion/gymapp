// Cambiar o agregar un ejercicio con la sesión ya abierta.
//
// Un solo sheet para los dos casos porque piden lo mismo (qué ejercicio, con
// cuántas series y reps) y sólo cambia qué se hace con la respuesta:
//
//   con exId  → reemplaza: saltea el original y mete el nuevo en su lugar
//   sin exId  → agrega al final
//
// Nada de esto toca S.routine: vive en el borrador. Al cerrar la sesión, el
// resumen ofrece dejarlo fijo en la rutina del día.
import { useEffect, useRef, useState } from 'react';
import { S, closeSheet } from '../../lib/state.js';
import { WD } from '../../lib/format.js';
import { addSessionExercise, replaceSessionExercise, sessionExs } from '../../lib/session.js';
import { recommendedExercises } from '../../lib/rutina-logic.js';
import { toast } from '../../lib/toast.js';

export default function SessionExercise({ wd, exId = null }) {
  const esCambio = !!exId;
  const original = esCambio ? sessionExs(+wd).find(e => e.id === exId) : null;

  const [name, setName] = useState('');
  const [sets, setSets] = useState(String(original?.sets ?? 3));
  const [reps, setReps] = useState(String(original?.reps ?? 10));
  const nameRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Sugerencias del catálogo para el grupo del día, sin los que ya están en la
  // sesión: cambiar de máquina es el caso normal y escribir el nombre entero
  // con las manos húmedas, no.
  const yaEstan = new Set(sessionExs(+wd).map(e => e.name.trim().toLowerCase()));
  const sugeridos = recommendedExercises(+wd).filter(s => !yaEstan.has(s.n.trim().toLowerCase())).slice(0, 6);

  async function confirmar() {
    const n = name.trim();
    if (!n) { toast('Ponle nombre al ejercicio'); return; }
    const datos = { name: n, sets, reps };
    const r = esCambio ? await replaceSessionExercise(exId, datos) : await addSessionExercise(datos);
    if (!r) { toast('No se pudo agregar'); return; }
    closeSheet();
    toast(esCambio ? `${original?.name} → ${n}` : `＋ ${n}`);
  }

  return (
    <>
      <h2>{esCambio ? 'Cambiar ejercicio' : 'Agregar ejercicio'}</h2>
      <div className="sheet-sub">
        {esCambio
          ? <>En vez de <b className="txt-blue">{original?.name}</b>, que queda saltado en su lugar. Podés restablecerlo después.</>
          : <>Se suma al final de la sesión de <b className="txt-blue">{S.routine[+wd]?.name || WD[+wd]}</b>.</>}
      </div>

      <div className="calcbox" style={{ marginBottom: 'var(--s3)' }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
          Vale sólo para hoy — tu rutina no cambia. Al cerrar la sesión te
          pregunto si querés dejarlo fijo.
        </div>
      </div>

      <div className="field">
        <label>Ejercicio</label>
        <input ref={nameRef} value={name} onChange={e => setName(e.target.value)} placeholder="Remo en polea" autoComplete="off" />
      </div>

      {sugeridos.length > 0 && (
        <div className="field">
          <label>Sugerencias para este día</label>
          <div className="chips">
            {sugeridos.map(s => (
              <span key={s.n} className={`chip ${name.trim().toLowerCase() === s.n.toLowerCase() ? 'blue' : ''}`} onClick={() => setName(s.n)}>
                {s.n}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="f2">
        <div className="field">
          <label>Series</label>
          <input type="number" inputMode="numeric" value={sets} onChange={e => setSets(e.target.value)} />
        </div>
        <div className="field">
          <label>Reps</label>
          <input type="number" inputMode="numeric" value={reps} onChange={e => setReps(e.target.value)} />
        </div>
      </div>

      <button type="button" className="btn" onClick={confirmar}>
        {esCambio ? 'Cambiar' : 'Agregar a la sesión'}
      </button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={closeSheet}>Cancelar</button>
    </>
  );
}
