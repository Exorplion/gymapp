// El campo "con qué máquina", compartido entre el alta de ejercicio (Rutina)
// y la corrección de una entrada ya registrada.
//
// Para polea es chips y no texto libre: pedir la marca no sirve —entrenás
// siempre en el mismo gimnasio y ni te acordás cómo se llama la polea— así
// que en vez de eso se pide lo que sí importa: cuánto pesa tirar de ella. Es
// el mismo campo `machine` de siempre, sólo una forma más fácil de llenarlo.
import { POLEA_FEEL } from '../lib/equip.js';

export default function MachineField({ equip, machine, onChange }) {
  if (equip === 'polea') {
    return (
      <div className="field" style={{ marginTop: 'var(--s3)' }}>
        <label id="lbl-como-siente">Cómo se siente</label>
        <div className="chips" role="group" aria-labelledby="lbl-como-siente">
          {POLEA_FEEL.map(f => (
            <button
              key={f.id}
              type="button"
              className={`chip ${machine === f.id ? 'on' : ''}`}
              aria-pressed={machine === f.id}
              onClick={() => onChange(machine === f.id ? '' : f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ptext sm" style={{ marginTop: 6 }}>
          Las poleas no se distinguen por marca, sino por cuántas lleva el
          sistema y si hay contrapeso. El historial se lleva por separado
          para cada sensación.
        </div>
      </div>
    );
  }
  return (
    <div className="field" style={{ marginTop: 'var(--s3)' }}>
      <label htmlFor="campo-que-maquina">Qué máquina</label>
      <input
        id="campo-que-maquina"
        type="text"
        placeholder="Life Fitness, Hammer, la del fondo…"
        value={machine}
        onChange={e => onChange(e.target.value)}
      />
      <div className="ptext sm" style={{ marginTop: 6 }}>
        En este sistema el número depende de la máquina, así que el historial
        se lleva por separado para cada una. Poné el nombre que te sirva a vos.
      </div>
    </div>
  );
}
