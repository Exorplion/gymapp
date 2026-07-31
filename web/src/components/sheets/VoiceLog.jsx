// Puerto de sheetVoiceLog() (index.html) — confirmación/edición del registro
// retroactivo antes de guardarlo como sesión. El original guardaba el
// borrador en un global `let VLOG=null` mutado por los data-act
// vlog-step/vlog-del/vlog-dur/vlog-save; acá eso se reemplaza por estado
// local de React (useState, sembrado desde los `items`/`duration` que llegan
// como props al abrir el sheet vía openSheet('voice-log', {items, duration}))
// — mismo criterio que ExerciseForm.jsx (Task 5) para un formulario efímero
// que sólo le importa a este sheet mientras está abierto.
//
// FIX ROUND 1 (code review): los inputs de series/reps/peso y de duración
// eran controlados (value={it[f]} atado al estado) y el handler de cambio
// reformateaba el número (round1/Math.round) de vuelta al mismo render en
// cada tecla. Eso rompía exactamente igual que el bug ya corregido en
// ExerciseCarousel.jsx: borrar el campo para tipear de nuevo no dejaba
// avanzar (ver más abajo) y un peso decimal como "62.5" perdía el "." en
// cuanto se tipeaba (parseFloat('62.') da 62, y volver a pintar value={62}
// se lo come). La causa de fondo es la misma — reescribir el valor de un
// campo mientras el usuario lo está tecleando — así que la solución es la
// misma: inputs NO controlados (defaultValue + refs), el handler de cambio
// sólo actualiza el estado (`items`/`duration`, que es lo que save() y los
// steppers realmente necesitan), y sólo los steppers +/- reescriben el
// input a mano (ellos sí empujan un valor que el usuario no tecleó).
//
// Los items no traían un id estable (vienen de parseWorkoutSpeech(), que
// sólo da name/sets/reps/w) — hacía falta uno para que la key de cada
// tarjeta (y por lo tanto sus refs) sobreviva a delItem() sin que React
// reutilice el nodo DOM de una fila borrada para la fila siguiente (lo que
// dejaría un <input> no controlado mostrando el valor tecleado de OTRO
// ejercicio). Se genera una vez, al sembrar el estado inicial.
import { useRef, useState } from 'react';
import { S, bump, wStep, closeSheet } from '../../lib/state.js';
import { WD, dstr, uid, round1, vibrate } from '../../lib/format.js';
import { idb } from '../../lib/db.js';
import { toast } from '../Toast.jsx';

const FIELDS = [['sets', 'Series'], ['reps', 'Reps'], ['w', 'Peso kg']];

export default function VoiceLog({ items: initialItems, duration: initialDuration }) {
  const [items, setItems] = useState(() => initialItems.map(it => ({ ...it, _id: uid() })));
  const [duration, setDuration] = useState(initialDuration);
  const fieldRefs = useRef({}); // `${_id}-${f}` -> <input>
  const durRef = useRef(null);

  function stepField(id, f, d) {
    setItems(prev => prev.map(it => {
      if (it._id !== id) return it;
      const next = f === 'w' ? { ...it, w: Math.max(0, round1(it.w + d * wStep())) } : { ...it, [f]: Math.max(1, it[f] + d) };
      const el = fieldRefs.current[`${id}-${f}`];
      if (el) el.value = next[f]; // stepper: user didn't type this, so it's fine (expected) to overwrite the field
      return next;
    }));
  }
  function changeField(id, f, value) {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return; // leave the field's own DOM value alone — the user is still typing it
    setItems(prev => prev.map(it => it._id === id ? { ...it, [f]: f === 'w' ? num : Math.max(1, Math.round(num)) } : it));
  }
  function delItem(id) {
    const next = items.filter(it => it._id !== id);
    if (!next.length) { closeSheet(); toast('Registro descartado'); return; }
    setItems(next);
  }
  function changeDuration(value) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) setDuration(num);
  }
  function stepDuration(d) {
    setDuration(v => {
      const next = Math.max(1, v + d);
      if (durRef.current) durRef.current.value = next;
      return next;
    });
  }

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
      {items.map(it => (
        <div className="card sub" style={{ marginBottom: 'var(--s2)' }} key={it._id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
            <div className="grow" style={{ flex: 1 }}><div className="cond" style={{ fontSize: 'var(--t-lg)', fontWeight: 700 }}>{it.name}</div></div>
            <button type="button" className="mini red" onClick={() => delItem(it._id)}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--s2)', marginTop: 'var(--s2)' }}>
            {FIELDS.map(([f, lbl]) => (
              <div key={f}>
                <div className="steplabel" style={{ marginBottom: 'var(--s1)' }}>{lbl}</div>
                <div className="step">
                  <button type="button" onClick={() => stepField(it._id, f, -1)}>−</button>
                  <div className="val">
                    <input
                      ref={el => { fieldRefs.current[`${it._id}-${f}`] = el; }}
                      type="number" inputMode="decimal" defaultValue={it[f]}
                      onChange={e => changeField(it._id, f, e.target.value)}
                      style={{ fontSize: 24 }}
                    />
                  </div>
                  <button type="button" onClick={() => stepField(it._id, f, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="steplabel" style={{ marginTop: 'var(--s4)' }}>Duración (min)</div>
      <div className="step" style={{ marginTop: 'var(--s1)' }}>
        <button type="button" onClick={() => stepDuration(-5)}>−</button>
        <div className="val"><input ref={durRef} type="number" inputMode="numeric" defaultValue={duration} onChange={e => changeDuration(e.target.value)} /></div>
        <button type="button" onClick={() => stepDuration(5)}>+</button>
      </div>
      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={save}>Guardar sesión</button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={closeSheet}>Cancelar</button>
    </>
  );
}
