// Puerto del sheet de nombre de día — en el original vive inline dentro del
// handler ACT['day-edit'] (index.html, ~línea 3310), no como una función
// sheetXxx() separada: `openSheet(\`<h2>${WD[wd]}</h2>...\`)` + el handler
// hermano ACT['day-save'] que persiste. Acá se unifican en un solo
// componente porque en React "abrir el formulario" y "guardarlo" son la
// misma unidad (estado local del input).
import { useEffect, useRef, useState } from 'react';
import { S } from '../../lib/state.js';
import { WD } from '../../lib/format.js';
import { saveDayName } from '../../lib/rutina-logic.js';

export default function DayEdit({ wd }) {
  const d = S.routine[wd];
  const [name, setName] = useState(d?.name || '');
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <h2>{WD[wd]}</h2>
      <div className="field">
        <label>Nombre del día (grupos musculares)</label>
        <input
          ref={inputRef}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Pecho / Tríceps"
        />
      </div>
      <button type="button" className="btn" onClick={() => saveDayName(wd, name)}>Guardar</button>
    </>
  );
}
