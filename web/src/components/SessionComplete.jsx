// Pantalla completa y automática al terminar el entrenamiento del día:
// racha, resumen, cuerpo — tres tiempos seguidos, no simultáneos (ver
// docs/superpowers/specs/2026-08-13-sensacion-premium-movimiento-design.md).
// Se puede tocar en cualquier momento para saltarla: entrenar es una acción
// diaria, así que nada acá puede volverse una traba en un mal día.
//
// No es un sheet (Sheet.jsx): ocupa toda la pantalla, mismo patrón que ya
// usa el overlay de descanso (#rest-fs en RestTimer.jsx) — position:fixed
// propio, sin pasar por el sistema de S.sheet.
import { useEffect, useRef } from 'react';
import { S, useStore, openSheet } from '../lib/state.js';
import { currentStreak } from '../lib/streak.js';
import { catsDeSesion } from '../lib/muscle.js';
import { fmtNum, round1 } from '../lib/format.js';
import Silhouette from './Silhouette.jsx';

// Los tres tiempos NO duran lo mismo (a propósito: racha y resumen son un
// vistazo, el cuerpo necesita más para que el revelado por zona se note).
// BEAT3_DELAY es cuándo arranca el tercer bloque — los delays de cada zona
// del cuerpo (revelar, más abajo) se suman a partir de ahí, para que el
// revelado escalonado ocurra DURANTE el tiempo en que ese bloque ya es
// visible, no antes.
const BEAT3_DELAY = 1950;
const STAGGER_ZONA = 150;
const DUR_TOTAL = 3650; // 1950 (arranca beat 3) + 1700 (dura beat 3)

function resumenDe(sess) {
  let series = 0, kg = 0;
  for (const e of sess.entries) {
    series += e.sets.length;
    for (const s of e.sets) kg += (s.w || 0) * (s.r || 0);
  }
  return { ejercicios: sess.entries.length, series, kg };
}

export default function SessionComplete() {
  useStore(); // se re-renderiza cuando S.sessionComplete cambia (mismo canal que el resto de S)
  const sess = S.sessionComplete;
  const timerRef = useRef(null);

  function cerrar() {
    clearTimeout(timerRef.current);
    const id = S.sessionComplete?.id;
    S.sessionComplete = null;
    if (id) openSheet('session-view', { id, justFinished: true });
  }

  useEffect(() => {
    if (!sess) return;
    timerRef.current = setTimeout(cerrar, DUR_TOTAL);
    return () => clearTimeout(timerRef.current);
    // sess.id y no `sess`: sess es un objeto nuevo cada vez que se llama
    // completeSession(), pero comparar por id evita reiniciar el timer si
    // bump() (global a S) dispara un re-render de esta pantalla por algo
    // que no tiene nada que ver (otra parte de la app tocando S).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sess?.id]);

  if (!sess) return null;

  const { ejercicios, series, kg } = resumenDe(sess);
  const streak = currentStreak();
  const cats = catsDeSesion(sess);
  const revelar = Object.fromEntries(cats.map((c, i) => [c, BEAT3_DELAY + i * STAGGER_ZONA]));
  const diasHoy = Object.fromEntries(cats.map(c => [c, 0]));

  return (
    <div id="session-complete" role="status" aria-label="Entrenamiento completo" onClick={cerrar}>
      <div className="sc-beat b1">
        <div className="sc-flame">🔥</div>
        <div className="sc-streak-n">{streak}</div>
        <div className="sc-lbl">{streak === 1 ? 'día de racha' : 'días de racha'}</div>
      </div>
      <div className="sc-beat b2">
        <div className="sc-resumen">
          <div><b>{ejercicios}</b><span>ejercicios</span></div>
          <div><b>{series}</b><span>series</span></div>
          <div><b>{fmtNum(round1(kg))}</b><span>kg movidos</span></div>
        </div>
      </div>
      <div className="sc-beat b3">
        <div className="sc-cuerpo">
          <Silhouette days={diasHoy} interactivo={false} revelar={revelar} />
        </div>
      </div>
    </div>
  );
}
