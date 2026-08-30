// Asistente de creación de rutina por onboarding: en vez de arrancar con un
// día vacío o una plantilla cerrada, primero pregunta qué grupos musculares
// va a trabajar ese día (un toque, sin escribir nada) y recién después
// muestra ejercicios recomendados de cada grupo para que la persona elija
// cuáles quiere — nunca los que la app "decide" (el pedido explícito era que
// no se le imponga nada: ej. pecho puede arrancar con plano o con inclinado,
// y elige la persona).
import { useState } from 'react';
import { closeSheet } from '../../lib/state.js';
import { MUSCLE_CATS, EXCATALOG } from '../../lib/muscle.js';
import { createWorkoutFromWizard } from '../../lib/rutina-logic.js';
import { toast } from '../../lib/toast.js';

export default function RoutineWizard() {
  const [step, setStep] = useState(1);
  const [cats, setCats] = useState([]);
  const [chosen, setChosen] = useState([]); // [{name, cat}]
  const [name, setName] = useState('');

  function toggleCat(c) {
    setCats(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]);
  }
  function toggleEx(n, cat) {
    setChosen(cs => cs.some(e => e.name === n)
      ? cs.filter(e => e.name !== n)
      : [...cs, { name: n, cat }]);
  }
  function irAEjercicios() {
    if (!cats.length) { toast('Elegí al menos un grupo'); return; }
    setName(cats.join(' / '));
    setStep(2);
  }
  async function crear() {
    if (!chosen.length) { toast('Elegí al menos un ejercicio'); return; }
    await createWorkoutFromWizard(name, chosen);
    closeSheet();
    toast(`"${name || 'Nuevo día'}" creado con ${chosen.length} ejercicio${chosen.length === 1 ? '' : 's'}`);
  }

  if (step === 1) {
    return (
      <>
        <h2>Nuevo día · grupos musculares</h2>
        <div className="sheet-sub">
          ¿Qué vas a trabajar este día? Podés elegir más de uno — por ejemplo Pecho, Hombro y Tríceps para un día de empuje.
        </div>
        <div className="chips" style={{ marginTop: 'var(--s2)' }}>
          {MUSCLE_CATS.map(c => (
            <button
              key={c}
              type="button"
              className={`chip ${cats.includes(c) ? 'on' : ''}`}
              aria-pressed={cats.includes(c)}
              onClick={() => toggleCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button type="button" className="btn" style={{ marginTop: 'var(--s4)' }} onClick={irAEjercicios}>
          Siguiente
        </button>
        <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={closeSheet}>Cancelar</button>
      </>
    );
  }

  return (
    <>
      <h2>Elegí los ejercicios</h2>
      <div className="sheet-sub">
        Tocá los que quieras incluir. Son sugerencias — nada se agrega solo.
      </div>
      <div className="field">
        <label htmlFor="wiz-nombre">Nombre del día</label>
        <input id="wiz-nombre" value={name} onChange={e => setName(e.target.value)} placeholder="Push" />
      </div>
      {cats.map(c => {
        const pool = EXCATALOG.filter(e => e.c === c);
        return (
          <div key={c} className="field">
            <label>{c}</label>
            <div className="chips">
              {pool.map(e => (
                <button
                  key={e.n}
                  type="button"
                  className={`chip ${chosen.some(x => x.name === e.n) ? 'on' : ''}`}
                  aria-pressed={chosen.some(x => x.name === e.n)}
                  onClick={() => toggleEx(e.n, c)}
                >
                  {e.n}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <div className="txt-mut" style={{ fontSize: 12.5, margin: '4px 0 var(--s3)' }}>
        {chosen.length} ejercicio{chosen.length === 1 ? '' : 's'} elegido{chosen.length === 1 ? '' : 's'} · series y repeticiones se pueden ajustar después, ejercicio por ejercicio.
      </div>
      <button type="button" className="btn" onClick={crear}>Crear día</button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={() => setStep(1)}>Volver</button>
    </>
  );
}
