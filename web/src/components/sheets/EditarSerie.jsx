// Corregir una serie de la sesión en vivo (2026-10-12).
//
// Enzo: "registré una serie, me di cuenta de que el número estaba mal, le di
// a la X pero el descanso ya estaba corriendo". Si el número estaba mal, la
// serie se hizo igual: se corrige acá, con las mismas ruedas de la tarjeta, y
// el descanso sigue contando. Borrar queda para "esta serie no pasó".
//
// En unilateral la fila de la tabla son dos series (un lado cada una): se
// corrigen las dos, cada una con su lado.
import { useState } from 'react';
import { m as motion } from 'motion/react';
import { S, closeSheet, wDisplay, wStep, wToUnit, wFromUnit } from '../../lib/state.js';
import { editarSerie } from '../../lib/session.js';
import { hojaProps, seccion } from '../../lib/variants.js';
import ReelPicker from '../ReelPicker.jsx';

const LADO = { left: 'Izquierda', right: 'Derecha' };

export default function EditarSerie({ exId, idxs = [], n }) {
  const sets = S.draft?.entries?.[exId]?.sets || [];
  const filas = idxs.filter(i => sets[i]).map(i => ({ i, side: sets[i].side }));
  const [vals, setVals] = useState(() => filas.map(f => ({ w: sets[f.i].w, r: sets[f.i].r })));
  if (!filas.length) return <h2>Corregir serie</h2>;
  // la de la máquina con la que se anotó (saveSet la guarda en la entrada)
  const unidad = (S.draft.entries[exId].unit || S.cfg.unit) === 'lb' ? 'lb' : 'kg';
  const cambiar = (k, campo) => valor => setVals(vs => vs.map((v, j) => (j === k ? { ...v, [campo]: valor } : v)));

  async function guardar() {
    closeSheet();
    for (const [k, f] of filas.entries()) await editarSerie(exId, f.i, vals[k], { n });
  }

  return (
    <motion.div {...hojaProps}>
      <h2>Corregir la serie {n}</h2>
      <motion.div variants={seccion} className="txt-mut" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.5 }}>
        {S.draft.entries[exId].name} · el descanso sigue contando.
      </motion.div>
      {filas.map((f, k) => (
        <motion.div variants={seccion} key={f.i}>
          {LADO[f.side] && <div className="steplabel" style={{ marginTop: 'var(--s3)' }}>{LADO[f.side]}</div>}
          <div className="setrows dos">
            <div>
              <div className="steplabel">Peso <span>{unidad}</span></div>
              <ReelPicker
                value={vals[k].w}
                step={wStep(unidad)}
                min={0.5}
                fmt={v => wDisplay(v, unidad)}
                toUnit={v => wToUnit(v, unidad)}
                fromUnit={v => wFromUnit(v, unidad)}
                onChange={cambiar(k, 'w')}
                label={`Peso${LADO[f.side] ? `, ${LADO[f.side].toLowerCase()}` : ''}`}
              />
            </div>
            <div>
              <div className="steplabel">Reps</div>
              <ReelPicker
                value={vals[k].r}
                step={1}
                min={1}
                onChange={cambiar(k, 'r')}
                label={`Reps${LADO[f.side] ? `, ${LADO[f.side].toLowerCase()}` : ''}`}
              />
            </div>
          </div>
        </motion.div>
      ))}
      <motion.div variants={seccion} className="dlg-fila">
        <button type="button" className="btn sm ghost" onClick={closeSheet}>Cancelar</button>
        <button type="button" className="btn sm" onClick={guardar}>Guardar</button>
      </motion.div>
    </motion.div>
  );
}
