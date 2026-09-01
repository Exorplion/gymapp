// Sheet "Tu cuerpo": el mapa muscular completo e interactivo, movido acá
// desde Inicio para que Inicio pueda ser un grid de tarjetas sin perder el
// modelo — se abre en grande, con lugar de sobra, en vez de competir por
// espacio con el resto de la portada.
//
// La tarjeta de volumen semanal por grupo ("Músculos esta semana") se mudó
// acá desde Hoy.jsx: es un dato sobre TU CUERPO en la semana, no sobre el
// turno de hoy en particular — este sheet es su lugar natural, junto al
// mapa de recuperación con el que ya comparte los mismos nueve grupos.
import { useEffect, useRef } from 'react';
import { S, closeSheet, changeTab } from '../../lib/state.js';
import { daysSinceAll, stalestGroups, muscleVolume, uncategorized } from '../../lib/muscle.js';
import { staggerReveal } from '../../lib/motion.js';
import Silhouette from '../Silhouette.jsx';

export default function BodyMap() {
  const dias = daysSinceAll();
  const viejos = stalestGroups();
  const mv = muscleVolume(7);
  const mvCats = Object.entries(mv).sort((a, b) => b[1] - a[1]);
  const maxv = mvCats.length ? mvCats[0][1] : 0;
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) staggerReveal(listRef.current.children);
  }, [mvCats.length]);

  return (
    <div>
      <h2 className="font-cond text-2xl font-bold text-txt">Tu cuerpo</h2>
      <div className="mt-1 mb-4 text-[13px] text-mut">Tocá un músculo para ver cuándo lo entrenaste.</div>

      <div className="flex h-[min(52vh,420px)] justify-center my-1.5">
        <Silhouette days={dias} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-mut">
        <LegendSw color="bg-cyan">ayer</LegendSw>
        <LegendSw color="bg-blue">2-3 d</LegendSw>
        <LegendSw color="bg-blue3">4-6 d</LegendSw>
        <LegendSw color="bg-line2">7+ d</LegendSw>
      </div>

      {viejos.length > 0 && <StaleLine grupos={viejos} dias={dias} />}

      {mvCats.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 font-cond text-lg font-semibold text-txt">Músculos esta semana</h3>
          <div ref={listRef}>
            {mvCats.map(([c, n]) => (
              <div key={c} className="mb-2">
                <div className="mb-1 flex justify-between text-[13px]">
                  <span className="text-txt">{c}</span>
                  <span className="font-cond font-bold text-mut">{n} series</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/40">
                  <div
                    className="h-full rounded-full bg-[image:var(--grad)]"
                    style={{ width: `${Math.round(n / maxv * 100)}%`, animation: 'rise .5s var(--ease) backwards' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[13px] leading-relaxed text-mut">
            10–20 series semanales por grupo es el rango habitual para ganar masa.
          </div>
          <SinGrupoAviso />
        </>
      )}
    </div>
  );
}

function LegendSw({ color, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={`inline-block h-2.5 w-2.5 rounded-full ${color}`}></i>{children}
    </span>
  );
}

/** Los ejercicios sin grupo muscular no suman en la tarjeta de arriba. Antes
    se descartaban en silencio, así que el resumen se veía completo cuando no
    lo estaba. Ahora se dicen y se pueden asignar. */
function SinGrupoAviso() {
  const sin = uncategorized();
  if (!sin.length) return null;
  return (
    <button
      type="button"
      className="mt-3 flex w-full flex-col gap-0.5 rounded-[var(--radius-r)] border border-warn/30 bg-warn/10 px-3.5 py-3 text-left transition-colors hover:bg-warn/15"
      onClick={() => { closeSheet(); changeTab('rutina', () => { S.rutMode = 'edit'; }); }}
    >
      <span className="text-[13.5px] font-medium text-txt">
        {sin.length} ejercicio{sin.length === 1 ? '' : 's'} sin grupo muscular · no suma{sin.length === 1 ? '' : 'n'} acá
      </span>
      <span className="text-[12.5px] text-mut">{sin.slice(0, 4).map(e => e.name).join(' · ')}{sin.length > 4 ? ` +${sin.length - 4}` : ''}</span>
      <span className="text-[12.5px] font-semibold text-warn">Asignar →</span>
    </button>
  );
}

function StaleLine({ grupos, dias }) {
  const top = grupos.slice(0, 2);
  const d = dias[top[0]];
  return (
    <div className="mt-3 rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 py-2.5 text-[13.5px] text-mut">
      ⌁ {top.join(' y ')} hace {d} día{d === 1 ? '' : 's'}
    </div>
  );
}
