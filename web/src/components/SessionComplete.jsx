// Pantalla completa y automática al terminar el entrenamiento del día:
// racha, resumen, cuerpo — tres tiempos seguidos, no simultáneos (ver
// docs/superpowers/specs/2026-08-13-sensacion-premium-movimiento-design.md).
// Se puede tocar en cualquier momento para saltarla: entrenar es una acción
// diaria, así que nada acá puede volverse una traba en un mal día.
//
// No es un sheet (Sheet.jsx): ocupa toda la pantalla, mismo patrón que ya
// usa el overlay de descanso (#rest-fs en RestTimer.jsx) — position:fixed
// propio, sin pasar por el sistema de S.sheet.
import { useEffect, useRef, useState } from 'react';
import { S, useStore, openSheet } from '../lib/state.js';
import { currentStreak } from '../lib/streak.js';
import { catsDeSesion } from '../lib/muscle.js';
import { fmtNum, round1 } from '../lib/format.js';
import { fireConfetti } from '../lib/confetti.js';
import { Flame } from './Icon.jsx';
import Silhouette from './Silhouette.jsx';

// Los tres tiempos NO duran lo mismo (a propósito: racha y resumen son un
// vistazo, el cuerpo necesita más para que el revelado por zona se note).
// BEAT2_DELAY/BEAT3_DELAY son cuándo arranca cada bloque — tanto el CSS
// (animation-delay de .b1/.b2/.b3, ver styles.css) como el modo sin
// movimiento de acá abajo (reducido) usan estos mismos números: si alguna
// vez se desincronizan, "reducir movimiento" dejaría de coincidir con el
// timeline normal. Los delays de cada zona del cuerpo (revelar, más abajo)
// se suman a partir de BEAT3_DELAY, para que el revelado escalonado ocurra
// DURANTE el tiempo en que ese bloque ya es visible, no antes.
const BEAT2_DELAY = 650;
const BEAT3_DELAY = 1300;
const STAGGER_ZONA = 120;
const DUR_TOTAL = 2400; // 1300 (arranca beat 3) + 1100 (dura beat 3)

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
  const beatTimersRef = useRef([]);
  const [beatActual, setBeatActual] = useState(1);

  /* Con "reducir movimiento" activado, styles.css apaga la animación de
     .sc-beat (el fade+scale) — pero los tres beats están montados unos
     sobre otros (position:absolute;inset:0) y sin esa animación no queda
     NADA que los mantenga separados en el tiempo: se verían los tres
     superpuestos y opacos a la vez durante los ~2.4s. El
     *{animation-duration:.01ms!important} global (más arriba en
     styles.css) tampoco sirve de red acá: aplastaría también la duración
     de CADA beat a .01ms, cuando tienen que durar ~1s cada uno para que se
     entiendan.

     Por eso, sólo en este caso, quién se ve lo decide este estado (JS) y
     no el CSS: aparece/desaparece de golpe, sin mover ni escalar nada, en
     los mismos momentos que ya usan los animation-delay de abajo. */
  const reducido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function cerrar() {
    clearTimeout(timerRef.current);
    beatTimersRef.current.forEach(clearTimeout);
    const actual = S.sessionComplete;
    S.sessionComplete = null;
    if (!actual?.id) return;
    openSheet('session-view', { id: actual.id, justFinished: true });
    // El confetti se dispara ACÁ (cuando se abre el sheet que muestra el PR),
    // no al terminar la sesión: ver el comentario en completeSession()
    // (session.js) para el porqué del cambio. cerrar() es el único camino de
    // salida de esta pantalla —lo mismo si el timer la cierra sola que si la
    // tocás para saltarla— así que cubre los dos casos sin nada extra.
    if (actual.huboPR) fireConfetti();
  }

  useEffect(() => {
    if (!sess) return;
    timerRef.current = setTimeout(cerrar, DUR_TOTAL);
    if (reducido) {
      setBeatActual(1);
      beatTimersRef.current = [
        setTimeout(() => setBeatActual(2), BEAT2_DELAY),
        setTimeout(() => setBeatActual(3), BEAT3_DELAY),
      ];
    }
    return () => {
      clearTimeout(timerRef.current);
      beatTimersRef.current.forEach(clearTimeout);
      beatTimersRef.current = [];
    };
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
  // Glúteo sólo tiene geometría en la cara de espalda (ver bodydata.js), y
  // esta pantalla no interactiva arranca de frente y nunca gira (Task 5 le
  // sacó el gesto de rotar). Un Glúteo entrenado nunca se ve acá, pero si
  // ocupara un turno del escalonado dejaría un hueco muerto —una pausa sin
  // que nada se ilumine— en el ritmo de revelado de las zonas que sí se ven.
  // Se excluye del cálculo de delays para que el resto quede parejo.
  const catsVisibles = cats.filter(c => c !== 'Glúteo');
  const revelar = Object.fromEntries(catsVisibles.map((c, i) => [c, BEAT3_DELAY + i * STAGGER_ZONA]));
  const diasHoy = Object.fromEntries(cats.map(c => [c, 0]));

  // Sólo bajo movimiento reducido: la opacidad de CADA beat la manda
  // beatActual en vez de la animación (apagada por CSS). Con movimiento
  // normal esto no se toca — el timeline sigue siendo 100% CSS, como ya
  // estaba verificado.
  const estiloDe = n => (reducido ? { opacity: beatActual === n ? 1 : 0 } : undefined);

  return (
    <div id="session-complete" role="status" aria-label="Entrenamiento completo" onClick={cerrar}>
      <div className="sc-beat b1" style={estiloDe(1)}>
        <Flame size={56} className="sc-flame" />
        <div className="sc-streak-n">{streak}</div>
        <div className="sc-lbl">{streak === 1 ? 'día de racha' : 'días de racha'}</div>
      </div>
      <div className="sc-beat b2" style={estiloDe(2)}>
        <div className="sc-resumen">
          <div><b>{ejercicios}</b><span>ejercicios</span></div>
          <div><b>{series}</b><span>series</span></div>
          <div><b>{fmtNum(round1(kg))}</b><span>kg movidos</span></div>
        </div>
      </div>
      <div className="sc-beat b3" style={estiloDe(3)}>
        <div className="sc-cuerpo">
          <Silhouette days={diasHoy} interactivo={false} revelar={revelar} />
        </div>
      </div>
    </div>
  );
}
