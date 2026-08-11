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
import { EQUIP, isMachineBound } from '../../lib/equip.js';
import MachineField from '../MachineField.jsx';
import { toast } from '../../lib/toast.js';

export default function SessionExercise({ wd, exId = null }) {
  const esCambio = !!exId;
  const original = esCambio ? sessionExs(+wd).find(e => e.id === exId) : null;

  /* El nombre arranca con el del original y no vacío: cambiar de equipo es el
     caso normal ("predicador con barra" → "predicador con mancuerna"), y
     obligar a retipear el nombre entero para tocar sólo el equipo es
     exactamente la fricción que este sheet existe para sacar de encima. */
  const [name, setName] = useState(original?.name || '');
  const [sets, setSets] = useState(String(original?.sets ?? 3));
  const [reps, setReps] = useState(String(original?.reps ?? 10));
  const [equip, setEquip] = useState(original?.equip || '');
  const [machine, setMachine] = useState(original?.machine || '');
  const [unilateral, setUnilateral] = useState(!!original?.unilateral);
  const nameRef = useRef(null);
  // Sólo cuenta como "sólo cambié el equipo" si nada del resto se tocó: así el
  // mensaje de confirmación no dice "cambiaste el equipo" cuando en realidad
  // cambiaste el ejercicio entero y de paso el equipo también cambió.
  const soloEquipo = esCambio && name.trim() === (original?.name || '').trim();

  useEffect(() => {
    // seleccionado y no sólo enfocado: si vas a cambiar sólo el equipo, el
    // nombre precargado no estorba; si vas a escribir uno nuevo, la primera
    // tecla lo reemplaza entero en vez de meterse al final del viejo.
    const t = setTimeout(() => nameRef.current?.select(), 80);
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
    const datos = { name: n, sets, reps, equip, machine: equip && machine ? machine : undefined, unilateral };
    const r = esCambio ? await replaceSessionExercise(exId, datos) : await addSessionExercise(datos);
    if (!r) { toast('No se pudo agregar'); return; }
    closeSheet();
    if (soloEquipo) toast(`${n} → ahora con ${(EQUIP.find(e => e.id === equip)?.label || 'sin equipo').toLowerCase()}`);
    else toast(esCambio ? `${original?.name} → ${n}` : `＋ ${n}`);
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

      {/* Con qué lo hacés hoy. Es lo que permite tocar SÓLO esto —"predicador
          con barra" a "predicador con mancuerna"— sin retipear el ejercicio
          entero: ver equip.js para por qué el historial se compara distinto
          en cada equipo. */}
      <label className="eyebrow lbl-block" style={{ marginTop: 'var(--s3)' }}>Con qué lo hacés</label>
      <div className="chips">
        {EQUIP.map(e => (
          <button
            key={e.id}
            type="button"
            className={`chip ${equip === e.id ? 'on' : ''}`}
            onClick={() => setEquip(equip === e.id ? '' : e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>
      {isMachineBound(equip) && (
        <MachineField equip={equip} machine={machine} onChange={setMachine} />
      )}

      <label className="eyebrow lbl-block" style={{ marginTop: 'var(--s3)' }}>Cómo se hace</label>
      <div className="chips">
        <button
          type="button"
          className={`chip ${unilateral ? 'on' : ''}`}
          onClick={() => setUnilateral(u => !u)}
        >
          Un lado por vez
        </button>
      </div>

      <button type="button" className="btn" style={{ marginTop: 'var(--s3)' }} onClick={confirmar}>
        {esCambio ? 'Cambiar' : 'Agregar a la sesión'}
      </button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={closeSheet}>Cancelar</button>
    </>
  );
}
