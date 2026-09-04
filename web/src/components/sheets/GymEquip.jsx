// "Con qué equipo hacés ESTE ejercicio en ESTE gym" — mismos chips de
// EQUIP/isMachineBound que ExerciseForm.jsx (equip.js), pero acotado a un
// gym en vez de a la rutina entera: lo que se guarda acá NO toca el equipo
// por defecto del ejercicio, sólo la variante de este gym (setGymEquip,
// lib/gyms.js). Al activar el gym, esa variante se aplica sola (setActiveGym).
import { useEffect, useRef, useState } from 'react';
import { closeSheet } from '../../lib/state.js';
import { EQUIP, EQUIP_HINT, isMachineBound } from '../../lib/equip.js';
import { setGymEquip, gymEquipFor } from '../../lib/gyms.js';
import { bloomOpen, staggerReveal } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/primitives.jsx';

const chipBase = 'inline-flex items-center rounded-full border border-line2 px-3.5 py-2 text-[13px] font-medium transition-colors';
const chip = on => cn(chipBase, on ? 'border-transparent bg-[image:var(--grad)] font-bold text-[var(--on-grad)]' : 'bg-card2 text-txt hover:border-line');

export default function GymEquip({ gymId, gymName, exName }) {
  const actual = gymEquipFor(gymId, exName);
  const [equip, setEquip] = useState(actual?.equip || '');
  const [machine, setMachine] = useState(actual?.machine || '');
  const rootRef = useRef(null);
  const chipsRef = useRef(null);

  useEffect(() => { bloomOpen(rootRef.current); }, []);
  useEffect(() => { if (chipsRef.current) staggerReveal(chipsRef.current.children); }, []);

  function guardar() {
    setGymEquip(gymId, exName, equip, machine);
    closeSheet();
  }
  function quitar() {
    setGymEquip(gymId, exName, '', '');
    closeSheet();
  }

  return (
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">{exName}</h2>
      <div className="mt-1 mb-3 text-[13px] text-mut">Equipo en <b className="text-blue">{gymName}</b> — no cambia el equipo por defecto de la rutina.</div>
      <div ref={chipsRef} className="mt-1 flex flex-wrap gap-2">
        {EQUIP.map(e => (
          <button
            type="button"
            key={e.id}
            className={chip(equip === e.id)}
            aria-pressed={equip === e.id}
            onClick={() => setEquip(equip === e.id ? '' : e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>
      {equip && <div className="mt-2 text-[13px] text-mut">{EQUIP_HINT[equip]}</div>}
      {isMachineBound(equip) && (
        <div className="mt-3">
          <label htmlFor="gym-eq-machine" className="mb-1.5 block text-[13px] font-medium text-mut">Máquina (opcional)</label>
          <input id="gym-eq-machine" className="h-11 w-full rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 text-[15px] text-txt outline-none transition-colors focus-visible:border-blue2" value={machine} onChange={e => setMachine(e.target.value)} placeholder="Ej. Life Fitness" />
        </div>
      )}
      <div className="mt-4 flex gap-2.5">
        {actual && <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={quitar}>Quitar</Button>}
        <Button type="button" size="sm" className="flex-1" onClick={guardar}>Guardar</Button>
      </div>
    </div>
  );
}
