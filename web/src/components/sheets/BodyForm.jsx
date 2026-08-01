// Puerto de sheetBodyForm() + async saveBody() (index.html, sección
// PROGRESO). Mismo criterio que MealForm.jsx (Task 7): los 5 campos
// numéricos son inputs controlados que guardan el string tal cual lo tipeó
// el usuario — nunca se reescribe el value= del propio input en su propio
// onChange (la causa raíz del bug de Task 6). El parseFloat/clamping sólo
// pasa una vez, al guardar.
//
// A diferencia de MealForm.jsx, acá los campos arrancan VACÍOS (no
// precargados con el último registro) — el original sólo pone el último
// valor como placeholder (pista visual), no como value inicial: dejar un
// campo en blanco al guardar significa "no registro este dato hoy", no
// "repetí el valor de la vez pasada". saveBody() lo refleja con num():
// parseFloat('') es NaN → null → esa columna queda null en el registro.
import { useEffect, useRef, useState } from 'react';
import { S, closeSheet, saveCfg } from '../../lib/state.js';
import { uid, dstr } from '../../lib/format.js';
import { applyComputedGoals } from '../../lib/macros.js';
import { idb } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';

export default function BodyForm() {
  const last = S.body[S.body.length - 1] || {};
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [arm, setArm] = useState('');
  const [chest, setChest] = useState('');
  const [leg, setLeg] = useState('');
  const weightRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => weightRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  async function save() {
    const num = raw => { const v = parseFloat(raw); return isNaN(v) ? null : v; };
    const rec = { id: uid(), date: dstr(), weight: num(weight), waist: num(waist), arm: num(arm), chest: num(chest), leg: num(leg) };
    if (rec.weight == null && rec.waist == null && rec.arm == null && rec.chest == null && rec.leg == null) {
      toast('Ingresa al menos un dato');
      return;
    }
    await idb.put('body', rec);
    S.body.push(rec);
    S.body.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    // sincroniza el peso del perfil → recalcula macros (Sección 0: nada fijo).
    // El original llama saveCfg() en las dos ramas del if/else de
    // applyComputedGoals() — o sea, siempre guarda si hay peso nuevo,
    // recalcule o no las metas automáticas. Se porta tal cual, sin "arreglar"
    // el if/else redundante.
    if (rec.weight != null) {
      S.cfg.profile.weightKg = rec.weight;
      applyComputedGoals();
      await saveCfg();
    }
    closeSheet();
    toast(S.cfg.goalsAuto && rec.weight != null ? 'Registro guardado · macros actualizadas' : 'Registro guardado');
  }

  return (
    <>
      <h2>Registro corporal</h2>
      <div className="field">
        <label>Peso (kg)</label>
        <input ref={weightRef} type="number" inputMode="decimal" step="any" placeholder={last.weight ?? '70.0'} value={weight} onChange={e => setWeight(e.target.value)} />
      </div>
      <div className="f2">
        <div className="field">
          <label>Cintura (cm)</label>
          <input type="number" inputMode="decimal" step="any" placeholder={last.waist ?? '—'} value={waist} onChange={e => setWaist(e.target.value)} />
        </div>
        <div className="field">
          <label>Brazo (cm)</label>
          <input type="number" inputMode="decimal" step="any" placeholder={last.arm ?? '—'} value={arm} onChange={e => setArm(e.target.value)} />
        </div>
        <div className="field">
          <label>Pecho (cm)</label>
          <input type="number" inputMode="decimal" step="any" placeholder={last.chest ?? '—'} value={chest} onChange={e => setChest(e.target.value)} />
        </div>
        <div className="field">
          <label>Pierna (cm)</label>
          <input type="number" inputMode="decimal" step="any" placeholder={last.leg ?? '—'} value={leg} onChange={e => setLeg(e.target.value)} />
        </div>
      </div>
      <button type="button" className="btn" onClick={save}>Guardar registro</button>
    </>
  );
}
