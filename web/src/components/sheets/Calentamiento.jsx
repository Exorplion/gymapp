// El calentamiento general: se abre solo al tocar "Abrir sesión" y va antes de
// cualquier máquina (2026-09-24).
//
// Es lo que Enzo ya hacía por su cuenta antes de ir a la polea —rotaciones
// interna y externa, face pulls para el manguito rotador— y pidió que la app
// lo acompañe: dos ejercicios como máximo, bien hechos. En días que arrancan
// con pierna, cadera y tobillo (lib/warmup.ts, calentamientoGeneral).
//
// Se puede saltar sin culpa: si ya calentaste y te olvidaste de abrir la
// sesión, no tiene sentido hacerte esperar. Los tildes son sólo para vos:
// no son series ni van al historial, pero sí viven en el borrador de la
// sesión (2026-10-01): bloquear el teléfono a mitad del calentamiento hacía
// que Android cerrara la app, y al volver la hoja ya no estaba. Ahora App.jsx
// la reabre al arrancar, con lo que ya habías tildado.
import { useState } from 'react';
import { m as motion } from 'motion/react';
import {
  sessionExs, indiceHoy, calentamientoHechos, tildarCalentamiento, cerrarCalentamiento,
} from '../../lib/session.js';
import { calentamientoGeneral } from '../../lib/warmup.js';
import { hojaProps, seccion } from '../../lib/variants.js';
import { Check } from '../Icon.jsx';

export default function Calentamiento({ index }) {
  const plan = calentamientoGeneral(sessionExs(index ?? indiceHoy()));
  const [hechos, setHechos] = useState(() => new Set(calentamientoHechos()));
  const todos = hechos.size === plan.ejercicios.length;

  function tildar(i) {
    setHechos(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
    tildarCalentamiento(i);
  }

  return (
    <motion.div {...hojaProps}>
      <h2>Calentamiento</h2>
      <div className="sheet-sub">{plan.foco} · ~5 min, antes de la primera máquina</div>

      <motion.div variants={seccion} className="group" style={{ marginBottom: 'var(--s4)' }}>
        {plan.ejercicios.map((e, i) => {
          const hecho = hechos.has(i);
          return (
            <button
              key={e.nombre}
              type="button"
              className={`grouprow calent-row${hecho ? ' hecho' : ''}`}
              aria-pressed={hecho}
              onClick={() => tildar(i)}
            >
              <span className="plan-num">{i + 1}</span>
              <span className="grouprow-grow">
                <span className="grouprow-t">{e.nombre}</span>
                <span className="calent-dosis">{e.dosis}</span>
                <span className="grouprow-s">{e.como}</span>
              </span>
              <span className="calent-check" aria-hidden="true">{hecho && <Check size={15} />}</span>
            </button>
          );
        })}
      </motion.div>

      <motion.div variants={seccion}>
        <button type="button" className="btn" onClick={cerrarCalentamiento}>
          {todos ? 'Listo, a entrenar' : 'A entrenar'}
        </button>
        <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={cerrarCalentamiento}>
          Saltar calentamiento
        </button>
      </motion.div>
    </motion.div>
  );
}
