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
import { useRef, useState } from 'react';
//
// 2026-09-29: la fecha se elige (por defecto hoy, nunca futura) y el guardado
// vive en lib/cuerpo.js. Antes se guardaba siempre con la fecha de hoy y Enzo
// no podía cargar el peso de los días que había perdido.
import { S, closeSheet } from '../../lib/state.js';
import { dstr, fmtDFull } from '../../lib/format.js';
import { guardarRegistroCorporal } from '../../lib/cuerpo.js';
import { toast } from '../../lib/toast.js';
import { Button } from '../ui/primitives.jsx';

const inputCls = 'h-11 w-full rounded-[var(--radius-r)] border border-line-2 bg-surface-2 px-3.5 text-body text-text placeholder:text-text-3 outline-none transition-colors focus-visible:border-accent';
const labelCls = 'mb-1.5 block text-sm font-medium text-text-2';

export default function BodyForm() {
  const last = S.body[S.body.length - 1] || {};
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [arm, setArm] = useState('');
  const [chest, setChest] = useState('');
  const [leg, setLeg] = useState('');
  const [bodyfat, setBodyfat] = useState('');
  const hoy = dstr();
  const [fecha, setFecha] = useState(hoy);
  const weightRef = useRef(null);
  const rootRef = useRef(null);


  async function save() {
    const f = fecha && fecha <= hoy ? fecha : hoy;
    const rec = await guardarRegistroCorporal({ weight, waist, arm, chest, leg, bodyfat }, f);
    if (!rec) { toast('Ingresa al menos un dato'); return; }
    closeSheet();
    const cuando = f === hoy ? '' : ` del ${fmtDFull(f)}`;
    toast(S.cfg.goalsAuto && rec.weight != null && f === hoy ? 'Registro guardado · macros actualizadas' : `Registro guardado${cuando}`);
  }

  return (
    <div ref={rootRef}>
      <h2 className="mb-4 font-cond text-2xl font-bold text-text">Registro corporal</h2>
      {/* Peso y fecha en la misma fila: la fecha no agrega alto a la hoja. */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="body-peso" className={labelCls}>Peso (kg)</label>
          <input id="body-peso" ref={weightRef} type="number" inputMode="decimal" step="any" className={inputCls} placeholder={last.weight ?? '70.0'} value={weight} onChange={e => setWeight(e.target.value)} />
        </div>
        <div>
          <label htmlFor="body-fecha" className={labelCls}>Fecha</label>
          <input id="body-fecha" type="date" max={hoy} className={inputCls} value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
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
