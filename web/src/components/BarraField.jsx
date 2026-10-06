// "Qué barra": fija (ya cargada, el número es todo) u olímpica (barra + discos).
// Compartido entre editar ejercicio (Rutina) y las opciones de la tarjeta en
// vivo, como MachineField.
//
// En las dos se anota el TOTAL: la olímpica sólo agrega el peso de la barra
// sola, para que la tarjeta diga cuánto va de cada lado (textoDiscos,
// equip.js). Anotar discos por lado partiría el historial en dos números que
// no se comparan (Enzo, 2026-10-06).
import { useState } from 'react';
import { S, wToUnit, wFromUnit } from '../lib/state.js';
import { round1 } from '../lib/format.js';
import { cn } from '../lib/utils.js';

const OLIMPICA_KG = 20;

export default function BarraField({ kg, onChange }) {
  const unidad = S.cfg?.unit === 'lb' ? 'lb' : 'kg';
  const olimpica = kg > 0;
  const [txt, setTxt] = useState(() => String(round1(wToUnit(olimpica ? kg : OLIMPICA_KG))));

  function escribir(t) {
    setTxt(t);
    const n = parseFloat(String(t).replace(',', '.'));
    if (isFinite(n) && n > 0) onChange(round1(wFromUnit(n)));
  }

  return (
    <div className="field mt-3">
      <label id="lbl-que-barra">Qué barra</label>
      <div className="chips" role="radiogroup" aria-labelledby="lbl-que-barra">
        <button type="button" role="radio" aria-checked={!olimpica} className={cn('chip', !olimpica && 'on')} onClick={() => onChange(null)}>
          Fija, ya cargada
        </button>
        <button
          type="button" role="radio" aria-checked={olimpica} className={cn('chip', olimpica && 'on')}
          onClick={() => { if (!olimpica) escribir(txt); }}
        >
          Olímpica + discos
        </button>
      </div>
      {olimpica && (
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor="campo-barra-kg" className="flex-none text-sm text-text-2">La barra sola pesa</label>
          <input
            id="campo-barra-kg" type="number" inputMode="decimal" step="any" min="0"
            className="flex-1" value={txt} onChange={e => escribir(e.target.value)}
          />
          <span className="flex-none text-sm text-text-2">{unidad}</span>
        </div>
      )}
      <div className="ptext sm mt-1.5">
        {olimpica
          ? 'Anotás el total; la tarjeta te dice cuánto poner de cada lado.'
          : 'El número que anotás es todo lo que levantás.'}
      </div>
    </div>
  );
}
