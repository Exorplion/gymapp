// El cuerpo chico que muestra qué trabaja un ejercicio.
//
// Usa la misma lámina que el mapa de Inicio, así que lo que ves acá y lo que
// ves allá son literalmente el mismo dibujo — no dos ilustraciones que puedan
// contradecirse.
//
// Acá SÍ se pintan los parches (clavicular, vasto interno, dorsal alto...): es
// justamente para lo que existen. En el mapa general quedan afuera porque
// pintarlos junto al músculo entero deja manchas; acá reemplazan al padre y
// muestran la porción exacta.
//
// Se dibujan las dos caras siempre, aunque el ejercicio trabaje sólo una: un
// cuerpo al que le falta la espalda se lee como un error, no como "acá no hay
// nada". La cara sin nada marcado se ve apagada, que ya dice lo suyo.
import { useEffect, useRef } from 'react';
import { cuerpo } from '../lib/bodydata.js';
import { esGrupo, ZONA_DE } from '../lib/fibras.js';
import { S } from '../lib/state.js';
import { bloomOpen } from '../lib/motion.js';

/** Las zonas que hay que encender para una lista de nombres.

    Devuelve un predicado sobre las zonas de la lámina: una zona se enciende si
    su subzona coincide por nombre, o —cuando el nombre es un grupo entero— si
    su categoría coincide. */
function enciende(nombres) {
  const subs = new Set(nombres.filter(n => !esGrupo(n)));
  const cats = new Set(nombres.filter(esGrupo).map(n => ZONA_DE[n] || n));
  return z => (z.sub && subs.has(z.sub)) || (z.cat && cats.has(z.cat));
}

function Cara({ cara, principales, secundarias }) {
  const esP = enciende(principales);
  const esS = enciende(secundarias);

  /* Si hay un parche encendido, su músculo padre se apaga: mostrar el pecho
     entero Y el clavicular encima sería decir "trabaja todo el pecho" cuando lo
     que queremos decir es "sobre todo esta parte". */
  const padresTapados = new Set(
    cara.zonas.filter(z => z.parche && (esP(z) || esS(z))).map(z => z.cat),
  );

  const nivel = z => {
    if (esP(z)) return 'bm-p';
    if (esS(z)) return 'bm-s';
    return 'bm-off';
  };

  const visibles = cara.zonas.filter(z => {
    if (z.cat === 'pelo' || !z.cat) return !z.parche;      // cabeza, pelo, manos
    if (z.parche) return esP(z) || esS(z);                 // sólo el parche que marca
    return !padresTapados.has(z.cat) || !(esP(z) || esS(z));
  });

  return (
    <svg viewBox={cara.viewBox} className="bm-svg" aria-hidden="true">
      <g className="bm-masa">
        {cara.zonas.filter(z => !z.parche).map((z, i) =>
          z.d.map((d, j) => <path key={`${i}.${j}`} d={d} />))}
      </g>
      {visibles.map((z, i) => (
        <g key={i} className={z.cat === 'pelo' ? 'bm-pelo' : !z.cat ? 'bm-off' : nivel(z)}>
          {z.d.map((d, j) => <path key={j} d={d} />)}
        </g>
      ))}
    </svg>
  );
}

/**
 * @param {{ p: string[], s: string[] }} fibras  porciones principales y secundarias
 */
export default function BodyMini({ fibras }) {
  const { frente, espalda } = cuerpo(S.cfg.bodySex || S.cfg.profile?.sex);
  const p = fibras?.p || [];
  const s = fibras?.s || [];
  const ref = useRef(null);

  useEffect(() => { if (p.length || s.length) bloomOpen(ref.current); }, [p.length, s.length]);

  if (!p.length && !s.length) return null;

  return (
    <div className="bodymini" ref={ref}>
      {/* Degradados propios y no los de Silhouette: esta ficha se abre desde
          Rutina, donde la silueta de Inicio NO está montada. Referenciar sus
          defs dejaría los músculos pintados de negro. */}
      <svg width="0" height="0" aria-hidden="true"><defs>
        <linearGradient id="bm-grad" x1="12%" y1="0%" x2="88%" y2="100%">
          <stop offset="0%" stopColor="#B9F8FF" /><stop offset="45%" stopColor="#22D3EE" /><stop offset="100%" stopColor="#0A6F88" />
        </linearGradient>
      </defs></svg>
      <div className="bm-cuerpos">
        <Cara cara={frente} principales={p} secundarias={s} />
        <Cara cara={espalda} principales={p} secundarias={s} />
      </div>
      <div className="bm-leyenda">
        <span className="bm-tag p">{p.join(' · ')}</span>
        {s.length > 0 && <span className="bm-tag s">también {s.join(' · ')}</span>}
      </div>
    </div>
  );
}
