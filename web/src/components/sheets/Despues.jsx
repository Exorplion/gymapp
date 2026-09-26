// "¿Cuándo lo hacés?" — la hoja del botón "Después" de la tarjeta (2026-09-25).
//
// Antes "Hacer después" mandaba el ejercicio al final sin preguntar. Enzo:
// "debería decirte a dónde lo quieres mover". Una fila por cada ejercicio
// que te queda ("Después de Aperturas") y "Al final"; elegir cierra la hoja
// y el aviso trae "Deshacer" (moverEjercicio, session.js).
import { motion } from 'motion/react';
import { S, closeSheet } from '../../lib/state.js';
import { sessionExs, isSkipped, setsDone, targetSets, moverEjercicio } from '../../lib/session.js';
import { hojaProps, seccion } from '../../lib/variants.js';

export default function Despues({ exId }) {
  const index = S.routine.findIndex(s => s.id === S.draft?.slotId);
  const exs = sessionExs(index);
  const ex = exs.find(e => e.id === exId);
  if (!ex) return <h2>Después</h2>;
  const pendientes = exs.filter(e => e.id !== exId && !isSkipped(e.id) && setsDone(e.id).length < targetSets(e));
  // El último pendiente y "al final" son el mismo lugar: se ofrece una vez.
  const opciones = pendientes.slice(0, -1);
  const y = despuesDe => () => { closeSheet(); moverEjercicio(exId, despuesDe); };

  return (
    <motion.div {...hojaProps}>
      <h2>¿Cuándo hacés {ex.name}?</h2>
      <motion.div variants={seccion} className="txt-mut" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 'var(--s3)' }}>
        {pendientes.length
          ? 'Sigue pendiente: elegí después de cuál lo hacés. Si te equivocás, lo deshacés desde el aviso.'
          : 'Es el único que te queda: no hay dónde moverlo.'}
      </motion.div>
      {pendientes.length > 0 && (
        <motion.div variants={seccion} className="group" style={{ marginBottom: 'var(--s3)' }}>
          {opciones.map((e, i) => (
            <button key={e.id} type="button" className="grouprow" onClick={y(e.id)}>
              <span className="despues-n" aria-hidden="true">{i + 1}</span>
              <span className="grouprow-grow">
                <span className="grouprow-t">Después de {e.name}</span>
                {i === 0 && <span className="grouprow-s">El que sigue</span>}
              </span>
              <span className="grouprow-chev" aria-hidden="true">›</span>
            </button>
          ))}
          <button type="button" className="grouprow" onClick={y(null)}>
            <span className="despues-n" aria-hidden="true">↓</span>
            <span className="grouprow-grow">
              <span className="grouprow-t">Al final</span>
              <span className="grouprow-s">Después de {pendientes[pendientes.length - 1].name}</span>
            </span>
            <span className="grouprow-chev" aria-hidden="true">›</span>
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
