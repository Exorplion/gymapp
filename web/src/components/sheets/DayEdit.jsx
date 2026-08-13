// Puerto del sheet de nombre de día — en el original vive inline dentro del
// handler ACT['day-edit'] (index.html, ~línea 3310), no como una función
// sheetXxx() separada: `openSheet(\`<h2>${WD[wd]}</h2>...\`)` + el handler
// hermano ACT['day-save'] que persiste. Acá se unifican en un solo
// componente porque en React "abrir el formulario" y "guardarlo" son la
// misma unidad (estado local del input).
//
// Además del nombre, elige a qué día de la semana va: el arrastre es más
// rápido pero exige pulso y una pantalla donde los dos días se vean a la vez.
// Esta lista es el mismo movimiento sin gesto, y de paso dice de antemano qué
// va a pasar — que en el caso "el destino ya está ocupado" no es obvio.
import { useEffect, useRef, useState } from 'react';
import { S } from '../../lib/state.js';
import { WD, WD1, WEEK_ORDER } from '../../lib/format.js';
import { saveDay, dayIsFree, nextFreeDay } from '../../lib/rutina-logic.js';

export default function DayEdit({ wd }) {
  const d = S.routine[wd];
  const [name, setName] = useState(d?.name || '');
  const [day, setDay] = useState(+wd);
  const inputRef = useRef(null);
  // Un día vacío se está asignando, no moviendo: ofrecer ahí un selector de
  // día invierte el modelo mental sin agregar nada.
  const movable = !!(d?.name || d?.exercises?.length);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <h2>{WD[wd]}</h2>
      <div className="field">
        <label htmlFor="dayedit-nombre">Nombre del día (grupos musculares)</label>
        <input
          id="dayedit-nombre"
          ref={inputRef}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Pecho / Tríceps"
        />
      </div>
      {movable && (
        <div className="field">
          <label>¿Qué día de la semana?</label>
          <div className="chips">
            {WEEK_ORDER.map(x => (
              <button
                key={x}
                type="button"
                className={`chip ${x === day ? 'blue' : ''}`}
                aria-pressed={x === day}
                onClick={() => setDay(x)}
              >
                {WD1[x]}
                {!dayIsFree(x) && <span className="chip-dot" />}
              </button>
            ))}
          </div>
          <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s2)', lineHeight: 1.45 }}>
            {outcome(+wd, day)}
          </div>
        </div>
      )}
      <button type="button" className="btn" onClick={() => saveDay(wd, { name, toWd: day })}>Guardar</button>
    </>
  );
}

/** Qué va a pasar al guardar, dicho antes de guardar. El intercambio y el
    correrse son operaciones que tocan un día que no estás mirando, así que no
    deberían descubrirse después de ejecutarlas. */
function outcome(from, to) {
  if (to === from) return 'Tocá otro día para mover este entrenamiento ahí. Tu historial no cambia: sigue mostrando los días en que realmente entrenaste.';
  if (dayIsFree(to)) return `Se muda al ${WD[to].toLowerCase()}. El ${WD[from].toLowerCase()} queda de descanso.`;
  const sitting = S.routine[to]?.name || WD[to];
  const mode = S.cfg.dayDrop || 'ask';
  if (mode === 'ask') return `El ${WD[to].toLowerCase()} ya tiene "${sitting}". Al guardar te pregunto si lo corro a otro día o si los intercambio.`;
  const parked = mode === 'shift' ? nextFreeDay(to, from) : null;
  if (parked === null || parked === from) return `Se intercambia con "${sitting}", que pasa al ${WD[from].toLowerCase()}.`;
  return `"${sitting}" se corre al ${WD[parked].toLowerCase()} y el ${WD[from].toLowerCase()} queda de descanso.`;
}
