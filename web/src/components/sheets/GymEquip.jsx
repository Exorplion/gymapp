// "Con qué equipo hacés ESTE ejercicio en ESTE gym" — mismos chips de
// EQUIP/isMachineBound que ExerciseForm.jsx (equip.js), pero acotado a un
// gym en vez de a la rutina entera: lo que se guarda acá NO toca el equipo
// por defecto del ejercicio, sólo la variante de este gym (setGymEquip,
// lib/gyms.js). Al activar el gym, esa variante se aplica sola (setActiveGym).
import { useState } from 'react';
import { closeSheet } from '../../lib/state.js';
import { EQUIP, EQUIP_HINT, isMachineBound } from '../../lib/equip.js';
import { setGymEquip, gymEquipFor } from '../../lib/gyms.js';

export default function GymEquip({ gymId, gymName, exName }) {
  const actual = gymEquipFor(gymId, exName);
  const [equip, setEquip] = useState(actual?.equip || '');
  const [machine, setMachine] = useState(actual?.machine || '');

  function guardar() {
    setGymEquip(gymId, exName, equip, machine);
    closeSheet();
  }
  function quitar() {
    setGymEquip(gymId, exName, '', '');
    closeSheet();
  }

  return (
    <>
      <h2>{exName}</h2>
      <div className="sheet-sub">Equipo en <b className="txt-blue">{gymName}</b> — no cambia el equipo por defecto de la rutina.</div>
      <div className="chips" style={{ marginTop: 4 }}>
        {EQUIP.map(e => (
          <button
            type="button"
            key={e.id}
            className={`chip ${equip === e.id ? 'on' : ''}`}
            aria-pressed={equip === e.id}
            onClick={() => setEquip(equip === e.id ? '' : e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>
      {equip && <div className="ptext sm" style={{ marginTop: 8 }}>{EQUIP_HINT[equip]}</div>}
      {isMachineBound(equip) && (
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="gym-eq-machine">Máquina (opcional)</label>
          <input id="gym-eq-machine" value={machine} onChange={e => setMachine(e.target.value)} placeholder="Ej. Life Fitness" />
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {actual && <button type="button" className="btn sm ghost" style={{ flex: 1 }} onClick={quitar}>Quitar</button>}
        <button type="button" className="btn sm" style={{ flex: 1 }} onClick={guardar}>Guardar</button>
      </div>
    </>
  );
}
