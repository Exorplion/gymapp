// Qué hacer cuando soltás una rutina sobre un día que ya tiene entrenamiento.
//
// No usa el sheet 'confirm' genérico (App.jsx) porque acá no hay una acción y
// su cancelación: hay dos resultados igual de válidos — correr al ocupante a
// otro día, o intercambiarlos — y cuál querés depende de la semana que estés
// armando. Un confirm de dos botones tendría que esconder uno de los dos.
//
// El "no volver a preguntar" guarda la elección en S.cfg.dayDrop; se cambia
// después desde Ajustes.
import { useEffect, useRef, useState } from 'react';
import { S, closeSheet, saveCfg, bump } from '../../lib/state.js';
import { WD } from '../../lib/format.js';
import { bloomOpen } from '../../lib/motion.js';
import { Button } from '../ui/primitives.jsx';
// TEMP verification-only stub (task 9) — applyDayDrop/nextFreeDay no longer
// exist; DayDrop.jsx is now orphaned dead code, a known separate gap not
// fixed here.
const applyDayDrop = () => {};
const nextFreeDay = () => null;

export default function DayDrop({ fromWd, toWd }) {
  const [remember, setRemember] = useState(false);
  const from = +fromWd, to = +toWd;
  const moving = S.routine[from]?.name || WD[from];
  const sitting = S.routine[to]?.name || WD[to];
  const parked = nextFreeDay(to, from);
  // Con la semana llena no hay adónde correrlo: la única salida es el
  // intercambio, así que se ofrece esa sola en vez de una opción que mentiría.
  const canShift = parked !== null && parked !== from;
  const rootRef = useRef(null);

  useEffect(() => { bloomOpen(rootRef.current); }, []);

  async function choose(mode) {
    closeSheet();
    if (remember) { S.cfg.dayDrop = mode; await saveCfg(); bump(); }
    applyDayDrop(from, to, mode);
  }

  return (
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">El {WD[to].toLowerCase()} ya está ocupado</h2>
      <div className="mb-[18px] text-[14px] leading-relaxed text-mut">
        Estás moviendo <b className="text-txt">{moving}</b> al {WD[to].toLowerCase()}, que hoy tiene <b className="text-txt">{sitting}</b>. ¿Qué hago con {sitting}?
      </div>

      <div className="grid gap-2.5">
        {canShift && (
          <Button type="button" className="h-auto flex-col items-start gap-0.5 py-3 text-left" onClick={() => choose('shift')}>
            <span>Correrlo al {WD[parked].toLowerCase()}</span>
            <span className="text-[12.5px] font-normal opacity-80">el primer día libre · el {WD[from].toLowerCase()} queda de descanso</span>
          </Button>
        )}
        <Button type="button" variant="secondary" className="h-auto flex-col items-start gap-0.5 py-3 text-left" onClick={() => choose('swap')}>
          <span>Intercambiarlos</span>
          <span className="text-[12.5px] font-normal text-mut">{sitting} pasa al {WD[from].toLowerCase()}</span>
        </Button>
      </div>

      <label className="mt-4 flex items-center gap-2.5 text-[13.5px] text-mut">
        <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
        <span>No volver a preguntar (se cambia en Ajustes)</span>
      </label>

      <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={closeSheet}>
        Cancelar
      </Button>
    </div>
  );
}
