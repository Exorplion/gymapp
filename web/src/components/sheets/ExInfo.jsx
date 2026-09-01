// Puerto de sheetExInfo() (index.html) — ficha educativa de un ejercicio +
// su esquema RIR. `wd` se recibe por paridad con la firma original
// (sheetExInfo(name,wd,exId)) pero, igual que en el original, no se usa: el
// esquema de sets/reps se busca recorriendo TODOS los días de S.routine por
// exId, no sólo `wd`.
import { useEffect, useRef } from 'react';
import { illusUrl } from '../../lib/illustrations.js';
import { equipLabel } from '../../lib/equip.js';
import { S } from '../../lib/state.js';
import { exInfo, rirScheme, isLowerBackLift } from '../../lib/exdb.js';
import { fibrasDe } from '../../lib/fibras.js';
import { bloomOpen } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';
import BodyMini from '../BodyMini.jsx';

export default function ExInfo({ name, exId }) {
  const rootRef = useRef(null);
  useEffect(() => { bloomOpen(rootRef.current); }, []);

  const info = exInfo(name);
  let sets = null, ex = null;
  for (const d of Object.values(S.routine)) {
    const found = (d.exercises || []).find(x => x.id === exId);
    if (found) { sets = found.sets; ex = found; }
  }
  const scheme = sets ? rirScheme(sets, name) : null;

  const fibras = fibrasDe(name);

  return (
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">{name}</h2>
      {/* Qué porción trabaja, sobre el mismo cuerpo del mapa de Inicio. Va
          primero: es lo que contesta "¿para qué hago esto?" de un vistazo,
          antes que el texto. */}
      {fibras && <BodyMini fibras={fibras} />}
      {/* Ilustración del movimiento y, si le sacaste foto, la máquina de tu
          gimnasio. La foto va segunda: la ilustración enseña el movimiento, la
          foto sirve para reconocer dónde hacerlo. */}
      {(ex?.illus || ex?.photo) && (
        <div className="mt-3 flex gap-2 overflow-hidden rounded-[var(--radius-r-lg)] border border-line2">
          {ex.illus && <img src={illusUrl(ex.illus)} alt="" loading="lazy" className="block w-full" />}
          {ex.photo && <img src={ex.photo} alt="" className="block w-full" />}
        </div>
      )}
      {equipLabel(ex) && (
        <div className="mt-2 text-[12.5px] text-mut">
          <span className="inline-flex items-center rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-mut">{equipLabel(ex)}</span>
        </div>
      )}
      {info ? (
        <>
          <h3 className="mt-4 mb-1.5 font-cond text-lg font-semibold text-txt">Músculos</h3>
          <div className="text-[15px] leading-relaxed text-txt">{info.m}</div>
          <h3 className="mt-4 mb-1.5 font-cond text-lg font-semibold text-txt">Por qué elegirlo</h3>
          <div className="text-[14.5px] leading-relaxed text-txt">
            {info.w.split('⚠').map((part, i, arr) => (
              <span key={i}>{part}{i < arr.length - 1 && <span className="text-warn">⚠</span>}</span>
            ))}
          </div>
        </>
      ) : (
        <div className="my-2 text-[14px] leading-relaxed text-mut">
          No tengo ficha educativa de este ejercicio todavía. Igual puedes registrarlo y seguir su progresión con normalidad.
        </div>
      )}
      {scheme && (
        <>
          <h3 className="mt-4 mb-1.5 font-cond text-lg font-semibold text-txt">Esfuerzo por serie (RIR)</h3>
          <div className="mb-2 flex flex-wrap gap-2">
            {scheme.map((r, i) => (
              <span key={i} className={cn(
                'inline-flex items-center rounded-full border border-line2 bg-card2 px-3.5 py-2 text-[13px] font-medium text-txt',
                r === 0 && 'border-transparent bg-blue2 text-[var(--on-grad)]',
              )}>
                Serie {i + 1}: {r === 0 ? 'al fallo' : `RIR ${r}`}
              </span>
            ))}
          </div>
          <div className="text-[13px] leading-relaxed text-mut">
            Solo el <b className="text-txt">último set</b> va al fallo (RIR 0). Los primeros dejan reps en reserva para no arruinar el volumen con fatiga.
            {isLowerBackLift(name) && <> <span className="text-warn">En este ejercicio nunca vayas al fallo (zona lumbar): máximo RIR 1.</span></>}
          </div>
        </>
      )}
    </div>
  );
}
