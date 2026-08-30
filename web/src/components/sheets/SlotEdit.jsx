// Puerto del sheet de nombre de turno — en el original (index.html) vivía
// inline dentro del handler ACT['day-edit'], con un selector "¿qué día de la
// semana?" para mover el día ahí mismo. Task 9 (rutina-por-secuencia) saca
// ese selector: mover un turno ahora es arrastrarlo en la lista de edición
// (ver Rutina.jsx, data-sort="seq"), no un campo dentro de este sheet — así
// que lo único que queda acá es el nombre.
import { useRef, useState } from 'react';
import { S } from '../../lib/state.js';
import { saveSlot } from '../../lib/rutina-logic.js';

export default function SlotEdit({ index }) {
  const d = S.routine[index];
  const [name, setName] = useState(d?.name || '');
  const inputRef = useRef(null);

  return (
    <>
      <h2>Turno {index + 1}</h2>
      <div className="field">
        <label htmlFor="slotedit-nombre">Nombre (grupos musculares)</label>
        <input id="slotedit-nombre" ref={inputRef} value={name} onChange={e => setName(e.target.value)} placeholder="Pecho / Tríceps" />
      </div>
      <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s2)', lineHeight: 1.45 }}>
        Para cambiar el orden, arrastrá el turno en la lista de edición.
      </div>
      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => saveSlot(index, { name })}>Guardar</button>
    </>
  );
}
