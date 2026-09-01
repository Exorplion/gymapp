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
import { bloomOpen } from '../../lib/motion.js';
import { Button } from '../ui/primitives.jsx';

const inputCls = 'h-11 w-full rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 text-[15px] text-txt placeholder:text-mut2 outline-none transition-colors focus-visible:border-blue2';
const labelCls = 'mb-1.5 block text-[13px] font-medium text-mut';

export default function BodyForm() {
  const last = S.body[S.body.length - 1] || {};
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [arm, setArm] = useState('');
  const [chest, setChest] = useState('');
  const [leg, setLeg] = useState('');
  const [bodyfat, setBodyfat] = useState('');
  const weightRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => { bloomOpen(rootRef.current); }, []);

  async function save() {
    const num = raw => { const v = parseFloat(raw); return isNaN(v) ? null : v; };
    const rec = { id: uid(), date: dstr(), weight: num(weight), waist: num(waist), arm: num(arm), chest: num(chest), leg: num(leg), bodyfat: num(bodyfat) };
    if (rec.weight == null && rec.waist == null && rec.arm == null && rec.chest == null && rec.leg == null && rec.bodyfat == null) {
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
    <div ref={rootRef}>
      <h2 className="mb-4 font-cond text-2xl font-bold text-txt">Registro corporal</h2>
      <div className="mb-3">
        <label htmlFor="body-peso" className={labelCls}>Peso (kg)</label>
        <input id="body-peso" ref={weightRef} type="number" inputMode="decimal" step="any" className={inputCls} placeholder={last.weight ?? '70.0'} value={weight} onChange={e => setWeight(e.target.value)} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="body-cintura" className={labelCls}>Cintura (cm)</label>
          <input id="body-cintura" type="number" inputMode="decimal" step="any" className={inputCls} placeholder={last.waist ?? '—'} value={waist} onChange={e => setWaist(e.target.value)} />
        </div>
        <div>
          <label htmlFor="body-brazo" className={labelCls}>Brazo (cm)</label>
          <input id="body-brazo" type="number" inputMode="decimal" step="any" className={inputCls} placeholder={last.arm ?? '—'} value={arm} onChange={e => setArm(e.target.value)} />
        </div>
        <div>
          <label htmlFor="body-pecho" className={labelCls}>Pecho (cm)</label>
          <input id="body-pecho" type="number" inputMode="decimal" step="any" className={inputCls} placeholder={last.chest ?? '—'} value={chest} onChange={e => setChest(e.target.value)} />
        </div>
        <div>
          <label htmlFor="body-pierna" className={labelCls}>Pierna (cm)</label>
          <input id="body-pierna" type="number" inputMode="decimal" step="any" className={inputCls} placeholder={last.leg ?? '—'} value={leg} onChange={e => setLeg(e.target.value)} />
        </div>
      </div>
      <div className="mb-4">
        <label htmlFor="body-grasa" className={labelCls}>% de grasa corporal (opcional)</label>
        <input id="body-grasa" type="number" inputMode="decimal" step="any" min="3" max="60" className={inputCls} placeholder={last.bodyfat ?? 'balanza o calibre'} value={bodyfat} onChange={e => setBodyfat(e.target.value)} />
      </div>
      <Button type="button" className="w-full" onClick={save}>Guardar registro</Button>
    </div>
  );
}
