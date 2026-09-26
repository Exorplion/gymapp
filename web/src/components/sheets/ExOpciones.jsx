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
import { useRef } from 'react';
import { S, closeSheet, openSheet } from '../../lib/state.js';
import {
  sessionExs, addExtraSet, dropSet, toggleUnilateral, isUnilateral, skipExercise,
} from '../../lib/session.js';
import { puedeSerUnilateral } from '../../lib/equip.js';
import { guardarFotoMaquina } from '../../lib/gyms.js';
import { Later, Plus, Minus, Sides, Swap, Camera, Skip } from '../Icon.jsx';

export default function ExOpciones({ exId, wd }) {
  const inputRef = useRef(null);
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

  async function onFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (await guardarFotoMaquina(gymId, ex.name, file)) closeSheet();
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
        {gymId ? (
          <button type="button" className="grouprow" onClick={() => inputRef.current?.click()}>
            <Camera className="opc-ico" />
            <span className="grouprow-grow">
              <span className="grouprow-t">Foto de la máquina</span>
              <span className="grouprow-s">Para reconocerla la próxima vez. Queda en la tarjeta.</span>
            </span>
          </button>
        ) : (
          <div className="grouprow" style={{ cursor: 'default' }}>
            <Camera className="opc-ico" />
            <span className="grouprow-grow">
              <span className="grouprow-t">Foto de la máquina</span>
              <span className="grouprow-s">Elegí un gym al empezar la sesión para poder guardarla.</span>
            </span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={onFoto} />
      <div className="group">
        <button type="button" className="grouprow opc-peligro" onClick={omitir}>
          <Skip className="opc-ico" />
          <span className="grouprow-grow"><span className="grouprow-t">Omitir ejercicio</span></span>
        </button>
      </div>
    </>
  );
}
