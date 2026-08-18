// Qué hacer cuando soltás una rutina sobre un día que ya tiene entrenamiento.
//
// No usa el sheet 'confirm' genérico (App.jsx) porque acá no hay una acción y
// su cancelación: hay dos resultados igual de válidos — correr al ocupante a
// otro día, o intercambiarlos — y cuál querés depende de la semana que estés
// armando. Un confirm de dos botones tendría que esconder uno de los dos.
//
// El "no volver a preguntar" guarda la elección en S.cfg.dayDrop; se cambia
// después desde Ajustes.
import { useState } from 'react';
import { S, closeSheet, saveCfg, bump } from '../../lib/state.js';
import { WD } from '../../lib/format.js';
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

  async function choose(mode) {
    closeSheet();
    if (remember) { S.cfg.dayDrop = mode; await saveCfg(); bump(); }
    applyDayDrop(from, to, mode);
  }

  return (
    <>
      <h2>El {WD[to].toLowerCase()} ya está ocupado</h2>
      <div className="txt-mut" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
        Estás moviendo <b>{moving}</b> al {WD[to].toLowerCase()}, que hoy tiene <b>{sitting}</b>. ¿Qué hago con {sitting}?
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {canShift && (
          <button type="button" className="btn stack" onClick={() => choose('shift')}>
            Correrlo al {WD[parked].toLowerCase()}
            <span className="btn-sub">el primer día libre · el {WD[from].toLowerCase()} queda de descanso</span>
          </button>
        )}
        <button type="button" className="btn glass stack" onClick={() => choose('swap')}>
          Intercambiarlos
          <span className="btn-sub">{sitting} pasa al {WD[from].toLowerCase()}</span>
        </button>
      </div>

      <label className="check-row">
        <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
        <span>No volver a preguntar (se cambia en Ajustes)</span>
      </label>

      <button type="button" className="btn sm ghost" style={{ marginTop: 'var(--s3)' }} onClick={closeSheet}>
        Cancelar
      </button>
    </>
  );
}
