// Cambiar QUÉ ejercicio fue una entrada ya registrada.
//
// Se podían corregir los pesos y las series, pero si anotaste "Press banca" y
// en realidad fue "Press inclinado" quedaba mal para siempre — y arrastraba su
// historial y su volumen a la categoría equivocada.
//
// Cambia sólo esa entrada de esa sesión. Si la RUTINA del día también tiene el
// nombre viejo, lo ofrece con un botón: el historial y el plan son dos cosas, y
// corregir un registro no debería reescribir el plan sin permiso.
import { useMemo, useRef, useState } from 'react';
import { S, closeSheet, openSheet } from '../../lib/state.js';
import { norm } from '../../lib/format.js';
import { updateHistorySession } from '../../lib/session.js';
import { renameRoutineExercise } from '../../lib/rutina-logic.js';
import { EXCATALOG, MUSCLE_CATS, catOf } from '../../lib/muscle.js';
import { EQUIP, isMachineBound } from '../../lib/equip.js';
import { toast } from '../../lib/toast.js';
import MachineField from '../MachineField.jsx';

export default function EntryEdit({ sessId, idx }) {
  const sess = S.sessions.find(s => s.id === sessId);
  const entry = sess?.entries?.[idx];

  const [name, setName] = useState(entry?.name || '');
  const [equip, setEquip] = useState(entry?.equip || '');
  const [machine, setMachine] = useState(entry?.machine || '');
  const [cat, setCat] = useState(entry?.cat || '');
  const [unilateral, setUnilateral] = useState(!!entry?.unilateral);
  const nameRef = useRef(null);

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
    <>
      <h2>Cambiar ejercicio</h2>
      <div className="sheet-sub">
        Corrige qué fue <b>{original}</b> en esta sesión. Los pesos y las series
        que anotaste no se tocan.
      </div>

      <div className="field">
        <label htmlFor="entryedit-nombre">Qué ejercicio fue</label>
        <input id="entryedit-nombre" ref={nameRef} value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
      </div>

      {sugeridos.length > 0 && (
        <div className="field">
          <label>De la base</label>
          <div className="chips">
            {sugeridos.map(e => (
              <button key={e.n} type="button" className="chip" onClick={() => { setName(e.n); setCat(''); }}>
                {e.n} <span className="txt-mut">· {e.c}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="eyebrow lbl-block" style={{ marginTop: 'var(--s4)' }}>
        Qué grupo entrena
        {!cat && auto && <span className="txt-mut" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}> · detecté {auto}</span>}
      </label>
      <div className="chips">
        {MUSCLE_CATS.map(c => (
          <button
            key={c}
            type="button"
            className={`chip ${cat === c ? 'on' : (!cat && auto === c ? 'blue' : '')}`}
            aria-pressed={cat === c}
            onClick={() => setCat(cat === c ? '' : c)}
          >
            {c}
          </button>
        ))}
      </div>

      <label className="eyebrow lbl-block" style={{ marginTop: 'var(--s4)' }}>Con qué lo hiciste</label>
      <div className="chips">
        {EQUIP.map(e => (
          <button
            key={e.id}
            type="button"
            className={`chip ${equip === e.id ? 'on' : ''}`}
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

      <p className="ptext sm" style={{ marginTop: 'var(--s3)' }}>
        El equipo es lo que decide contra qué historial se compara: el mismo
        ejercicio en dos máquinas distintas no mueve la misma carga.
      </p>

      <label className="eyebrow lbl-block" style={{ marginTop: 'var(--s4)' }}>Cómo se hizo</label>
      <div className="chips">
        <button
          type="button"
          className={`chip ${unilateral ? 'on' : ''}`}
          aria-pressed={unilateral}
          onClick={() => setUnilateral(u => !u)}
        >
          Un lado por vez
        </button>
      </div>

      <button type="button" className="btn" style={{ marginTop: 'var(--s4)' }} onClick={guardar}>Guardar</button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={closeSheet}>Cancelar</button>
    </>
  );
}
