// Puerto de sheetVoiceLog() (index.html) — confirmación/edición del registro
// retroactivo antes de guardarlo como sesión. El original guardaba el
// borrador en un global `let VLOG=null` mutado por los data-act
// vlog-step/vlog-del/vlog-dur/vlog-save; acá eso se reemplaza por estado
// local de React (useState, sembrado desde los `items`/`duration` que llegan
// como props al abrir el sheet vía openSheet('voice-log', {items, duration}))
// — mismo criterio que ExerciseForm.jsx (Task 5) para un formulario efímero
// que sólo le importa a este sheet mientras está abierto.
import { useState } from 'react';
import { S, bump, wStep, closeSheet } from '../../lib/state.js';
import { WD, dstr, uid, round1, vibrate } from '../../lib/format.js';
import { idb } from '../../lib/db.js';
import { toast } from '../Toast.jsx';

const FIELDS = [['sets', 'Series'], ['reps', 'Reps'], ['w', 'Peso kg']];

export default function VoiceLog({ items: initialItems, duration: initialDuration }) {
  const [items, setItems] = useState(initialItems);
  const [duration, setDuration] = useState(initialDuration);

  function stepField(i, f, d) {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      if (f === 'w') return { ...it, w: Math.max(0, round1(it.w + d * wStep())) };
      return { ...it, [f]: Math.max(1, it[f] + d) };
    }));
  }
  function changeField(i, f, value) {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [f]: f === 'w' ? round1(num) : Math.max(1, Math.round(num)) } : it));
  }
  function delItem(i) {
    const next = items.filter((_, idx) => idx !== i);
    if (!next.length) { closeSheet(); toast('Registro descartado'); return; }
    setItems(next);
  }
  function changeDuration(value) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) setDuration(num);
  }
  function stepDuration(d) { setDuration(v => Math.max(1, v + d)); }

  async function save() {
    if (!items.length) return;
    const wd = new Date().getDay(), day = S.routine[wd];
    const entries = items.map(it => ({
      exId: uid(), name: it.name,
      sets: Array.from({ length: it.sets }, () => ({ w: round1(it.w), r: it.reps })),
    }));
    const end = Date.now(), dur = Math.max(1, duration | 0);
    const sess = {
      id: uid(), date: dstr(), weekday: wd, dayName: day?.name || WD[wd],
      start: end - dur * 60000, end, duration: dur, entries,
    };
    await idb.put('sessions', sess);
    S.sessions.unshift(sess);
    const n = entries.reduce((a, e) => a + e.sets.length, 0);
    closeSheet();
    vibrate([30, 50, 30]);
    bump();
    toast(`💪 Sesión guardada · ${n} series · ${dur} min`);
  }

  if (!items.length) return null;

  return (
    <>
      <h2>Confirmá tu sesión</h2>
      <div className="txt-mut" style={{ fontSize: 14, lineHeight: 1.55, margin: '-8px 0 16px' }}>
        Esto es lo que entendí. <b>Revisá los pesos</b>: el dictado casi nunca los capta bien, así que van con lo que levantaste la última vez.
      </div>
      {items.map((it, i) => (
        <div className="card sub" style={{ marginBottom: 'var(--s2)' }} key={i}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
            <div className="grow" style={{ flex: 1 }}><div className="cond" style={{ fontSize: 'var(--t-lg)', fontWeight: 700 }}>{it.name}</div></div>
            <button type="button" className="mini red" onClick={() => delItem(i)}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--s2)', marginTop: 'var(--s2)' }}>
            {FIELDS.map(([f, lbl]) => (
              <div key={f}>
                <div className="steplabel" style={{ marginBottom: 'var(--s1)' }}>{lbl}</div>
                <div className="step">
                  <button type="button" onClick={() => stepField(i, f, -1)}>−</button>
                  <div className="val"><input type="number" inputMode="decimal" value={it[f]} onChange={e => changeField(i, f, e.target.value)} style={{ fontSize: 24 }} /></div>
                  <button type="button" onClick={() => stepField(i, f, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="steplabel" style={{ marginTop: 'var(--s4)' }}>Duración (min)</div>
      <div className="step" style={{ marginTop: 'var(--s1)' }}>
        <button type="button" onClick={() => stepDuration(-5)}>−</button>
        <div className="val"><input type="number" inputMode="numeric" value={duration} onChange={e => changeDuration(e.target.value)} /></div>
        <button type="button" onClick={() => stepDuration(5)}>+</button>
      </div>
      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={save}>Guardar sesión</button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={closeSheet}>Cancelar</button>
    </>
  );
}
