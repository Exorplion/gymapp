// Las opciones del ejercicio en curso: el botón ⋯ arriba a la derecha de la
// tarjeta (2026-09-24).
//
// Antes vivían en un acordeón "Más opciones del ejercicio" al fondo de la
// tarjeta, debajo de las ruedas y del botón de registrar. Enzo: si no
// scrolleás, no sabés que existen. Arriba y como un botón con nombre, se ven;
// y como hoja, cada opción tiene lugar para decir qué hace.
//
// "Hacer después" es nueva y distinta de "Omitir": la máquina está ocupada,
// así que el ejercicio pasa al final y sigue pendiente. Omitir es no hacerlo.
import { S, closeSheet, openSheet } from '../../lib/state.js';
import {
  sessionExs, addExtraSet, dropSet, toggleUnilateral, isUnilateral, skipExercise, setBarra,
} from '../../lib/session.js';
import BarraField from '../BarraField.jsx';
import { puedeSerUnilateral } from '../../lib/equip.js';
import { maquinaElegida } from '../../lib/maquinas.js';
import { Later, Plus, Minus, Sides, Swap, Camera, Skip } from '../Icon.jsx';

export default function ExOpciones({ exId, wd }) {
  const index = wd ?? S.routine.findIndex(s => s.id === S.draft?.slotId);
  const ex = sessionExs(index).find(e => e.id === exId);
  if (!ex) return <h2>Opciones</h2>;
  const uni = isUnilateral(ex);
  const gymId = S.cfg.activeGym;

  // Cada acción cierra la hoja y la tarjeta muestra el resultado: la hoja es
  // para elegir, no para quedarse mirando. Unilateral es la excepción — es un
  // interruptor, y ver cómo cambia es la confirmación.
  const y = fn => () => { closeSheet(); fn(); };

  function omitir() {
    openSheet('confirm', {
      title: `¿Omitir ${ex.name}?`,
      body: 'Queda marcado como omitido y pasás al siguiente. Podés restablecerlo en cualquier momento y vuelve a su lugar.',
      confirmLabel: 'Omitir',
      onConfirm: () => skipExercise(ex.id),
    });
  }


  return (
    <>
      <h2>{ex.name}</h2>
      <div className="group" style={{ marginBottom: 'var(--s3)' }}>
        <button type="button" className="grouprow" onClick={y(() => openSheet('despues', { exId: ex.id }))}>
          <Later className="opc-ico" />
          <span className="grouprow-grow">
            <span className="grouprow-t">Hacer después</span>
            <span className="grouprow-s">Elegís después de cuál. Para cuando la máquina está ocupada.</span>
          </span>
        </button>
        <button type="button" className="grouprow" onClick={y(() => addExtraSet(ex.id))}>
          <Plus className="opc-ico" />
          <span className="grouprow-grow"><span className="grouprow-t">Una serie más</span></span>
        </button>
        <button type="button" className="grouprow" onClick={y(() => dropSet(ex.id))}>
          <Minus className="opc-ico" />
          <span className="grouprow-grow"><span className="grouprow-t">Una serie menos</span></span>
        </button>
        {puedeSerUnilateral(ex) && (
          <button type="button" className="grouprow" role="switch" aria-checked={uni} onClick={() => toggleUnilateral(ex.id)}>
            <Sides className="opc-ico" />
            <span className="grouprow-grow">
              <span className="grouprow-t">Unilateral</span>
              <span className="grouprow-s">Un lado por vez, sólo hoy.</span>
            </span>
            <span className="grouprow-v">{uni ? 'Sí' : 'No'}</span>
          </button>
        )}
        <button type="button" className="grouprow" onClick={y(() => openSheet('ex-swap', { wd: index, exId: ex.id }))}>
          <Swap className="opc-ico" />
          <span className="grouprow-grow"><span className="grouprow-t">Cambiar por otro ejercicio</span></span>
        </button>
        {/* Las máquinas de este ejercicio en el gym (Maquinas.jsx): foto,
            nombre y su propio historial. Reemplaza a "Foto de la máquina",
            que sólo guardaba una. */}
        <button type="button" className="grouprow" onClick={() => openSheet('maquinas', { exId: ex.id, wd: index })}>
          <Camera className="opc-ico" />
          <span className="grouprow-grow">
            <span className="grouprow-t">En qué máquina</span>
            <span className="grouprow-s">
              {!gymId ? 'Se guardan por gimnasio: elegí en cuál estás.'
                : maquinaElegida(gymId, ex.name) ? `Ahora: ${maquinaElegida(gymId, ex.name).nombre}. Elegí otra o agregá una.`
                  : 'Foto y nombre de cada máquina, cada una con su historial.'}
            </span>
          </span>
        </button>
      </div>
      {/* Barra fija u olímpica: un dato del ejercicio, no de hoy (setBarra).
          Acá y no sólo en editar, porque es en la máquina donde te das cuenta. */}
      {ex.equip === 'barra' && (
        <div style={{ marginBottom: 'var(--s3)' }}>
          <BarraField kg={ex.barraKg} onChange={kg => setBarra(ex.id, kg)} />
        </div>
      )}
      <div className="group">
        <button type="button" className="grouprow opc-peligro" onClick={omitir}>
          <Skip className="opc-ico" />
          <span className="grouprow-grow"><span className="grouprow-t">Omitir ejercicio</span></span>
        </button>
      </div>
    </>
  );
}
