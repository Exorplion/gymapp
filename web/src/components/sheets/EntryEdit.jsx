// Cambiar QUÉ ejercicio fue una entrada ya registrada.
//
// Se podían corregir los pesos y las series, pero si anotaste "Press banca" y
// en realidad fue "Press inclinado" quedaba mal para siempre — y arrastraba su
// historial y su volumen a la categoría equivocada.
//
// Cambia sólo esa entrada de esa sesión. Si la RUTINA del día también tiene el
// nombre viejo, lo ofrece con un botón: el historial y el plan son dos cosas, y
// corregir un registro no debería reescribir el plan sin permiso.
import { useEffect, useMemo, useRef, useState } from 'react';
import { S, closeSheet, openSheet } from '../../lib/state.js';
import { norm } from '../../lib/format.js';
import { updateHistorySession } from '../../lib/session.js';
import { renameRoutineExercise } from '../../lib/rutina-logic.js';
import { EXCATALOG, MUSCLE_CATS, catOf } from '../../lib/muscle.js';
import { EQUIP, isMachineBound } from '../../lib/equip.js';
import { toast } from '../../lib/toast.js';
import { bloomOpen } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/primitives.jsx';
import MachineField from '../MachineField.jsx';

const inputCls = 'h-11 w-full rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 text-[15px] text-txt outline-none transition-colors focus-visible:border-blue2';
const eyebrowCls = 'mt-4 mb-2 block text-[11px] font-semibold uppercase tracking-wide text-mut';
const chipBase = 'inline-flex items-center rounded-full border border-line2 px-3.5 py-2 text-[13px] font-medium transition-colors';
const chip = (on, tone = 'on') => cn(chipBase, on ? (tone === 'blue' ? 'border-transparent bg-blue2 text-[var(--on-grad)]' : 'border-transparent bg-[image:var(--grad)] font-bold text-[var(--on-grad)]') : 'bg-card2 text-txt hover:border-line');

export default function EntryEdit({ sessId, idx }) {
  const sess = S.sessions.find(s => s.id === sessId);
  const entry = sess?.entries?.[idx];

  const [name, setName] = useState(entry?.name || '');
  const [equip, setEquip] = useState(entry?.equip || '');
  const [machine, setMachine] = useState(entry?.machine || '');
  const [cat, setCat] = useState(entry?.cat || '');
  const [unilateral, setUnilateral] = useState(!!entry?.unilateral);
  const nameRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => { bloomOpen(rootRef.current); }, []);

  const q = norm(name);
  const sugeridos = useMemo(
    () => (q ? EXCATALOG.filter(e => norm(e.n).includes(q) && norm(e.n) !== q).slice(0, 6) : []),
    [q],
  );

  if (!sess || !entry) return null;
  const original = entry.name;
  const auto = catOf({ name });

  async function guardar() {
    const n = name.trim();
    if (!n) { toast('Ponle nombre al ejercicio'); return; }
    const copia = structuredClone(sess);
    Object.assign(copia.entries[idx], {
      name: n,
      equip: equip || undefined,
      machine: equip && isMachineBound(equip) && machine ? machine.trim() : undefined,
      cat: cat || undefined,
      unilateral: unilateral || undefined,
    });
    await updateHistorySession(copia, `Ahora dice ${n}`);

    // ¿la rutina de ese turno también lo tiene mal? Sólo se puede resolver
    // para sesiones nuevas (con slotId) — una sesión vieja (weekday) no
    // tiene forma confiable de mapearse a un turno actual de la secuencia,
    // así que no se ofrece el cambio ahí (mejor no ofrecerlo que ofrecer
    // corregir el turno equivocado).
    const slot = sess.slotId ? S.routine.find(s => s.id === sess.slotId) : null;
    const enRutina = (slot?.exercises || []).some(e => e.name === original);
    if (enRutina && n !== original) {
      openSheet('confirm', {
        title: '¿También en tu rutina?',
        body: `"${slot.name || 'Tu rutina'}" todavía tiene "${original}". Si el nombre estaba mal en el plan, lo vas a volver a registrar mal.`,
        confirmLabel: 'Cambiarlo ahí también',
        onConfirm: () => renameRoutineExercise(sess.slotId, original, { name: n, equip, machine, cat, unilateral }),
      });
      return;
    }
    closeSheet();
  }

  return (
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">Cambiar ejercicio</h2>
      <div className="mt-1 mb-4 text-[13px] leading-relaxed text-mut">
        Corrige qué fue <b className="text-txt">{original}</b> en esta sesión. Los pesos y las series
        que anotaste no se tocan.
      </div>

      <div className="mb-3">
        <label htmlFor="entryedit-nombre" className="mb-1.5 block text-[13px] font-medium text-mut">Qué ejercicio fue</label>
        <input id="entryedit-nombre" ref={nameRef} className={inputCls} value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
      </div>

      {sugeridos.length > 0 && (
        <div className="mb-3">
          <label className="mb-1.5 block text-[13px] font-medium text-mut">De la base</label>
          <div className="flex flex-wrap gap-2">
            {sugeridos.map(e => (
              <button key={e.n} type="button" className={chip(false)} onClick={() => { setName(e.n); setCat(''); }}>
                {e.n} <span className="ml-1 text-mut">· {e.c}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label className={eyebrowCls}>
        Qué grupo entrena
        {!cat && auto && <span className="text-[11px] font-medium normal-case tracking-normal text-mut"> · detecté {auto}</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {MUSCLE_CATS.map(c => (
          <button
            key={c}
            type="button"
            className={chip(cat === c || (!cat && auto === c), cat === c ? 'on' : 'blue')}
            aria-pressed={cat === c}
            onClick={() => setCat(cat === c ? '' : c)}
          >
            {c}
          </button>
        ))}
      </div>

      <label className={eyebrowCls}>Con qué lo hiciste</label>
      <div className="flex flex-wrap gap-2">
        {EQUIP.map(e => (
          <button
            key={e.id}
            type="button"
            className={chip(equip === e.id)}
            aria-pressed={equip === e.id}
            onClick={() => setEquip(equip === e.id ? '' : e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>
      {isMachineBound(equip) && (
        <MachineField equip={equip} machine={machine} onChange={setMachine} />
      )}

      <p className="mt-3 text-[13px] leading-relaxed text-mut">
        El equipo es lo que decide contra qué historial se compara: el mismo
        ejercicio en dos máquinas distintas no mueve la misma carga.
      </p>

      <label className={eyebrowCls}>Cómo se hizo</label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={chip(unilateral)}
          aria-pressed={unilateral}
          onClick={() => setUnilateral(u => !u)}
        >
          Un lado por vez
        </button>
      </div>

      <Button type="button" className="mt-4 w-full" onClick={guardar}>Guardar</Button>
      <Button type="button" variant="ghost" className="mt-2.5 w-full" onClick={closeSheet}>Cancelar</Button>
    </div>
  );
}
