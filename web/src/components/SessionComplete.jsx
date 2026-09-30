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
import { useAtras } from '../lib/useAtras.js';
import { currentStreak } from '../lib/streak.js';
import { catsDeSesion } from '../lib/muscle.js';
import { caraConMas, cuerpo } from '../lib/bodydata.js';
import { fmtKg, fmtMiles, round1 } from '../lib/format.js';
import { fireConfetti } from '../lib/confetti.js';
import { Flame, Mancuerna, Trofeo } from './Icon.jsx';
import Silhouette from './Silhouette.jsx';
import { cn } from '../lib/utils.js';
import { countTo, popIn, D } from '../lib/motion.js';

// Los tres tiempos NO duran lo mismo (a propósito: racha y resumen son un
// vistazo, el cuerpo necesita más para que el revelado por zona se note).
// BEAT2_DELAY/BEAT3_DELAY son cuándo arranca cada bloque — tanto el CSS
// (animation-delay de .b1/.b2/.b3, ver styles.css) como el modo sin
// movimiento de acá abajo (reducido) usan estos mismos números: si alguna
// vez se desincronizan, "reducir movimiento" dejaría de coincidir con el
// timeline normal. Los delays de cada zona del cuerpo (revelar, más abajo)
// se suman a partir de BEAT3_DELAY, para que el revelado escalonado ocurra
// DURANTE el tiempo en que ese bloque ya es visible, no antes.
/* Los tiempos de la celebración son de ella (G10: constantes con nombre, no
   ms sueltos). El CSS los lee de las mismas variables que escribe
   #session-complete (style, abajo), así no pueden desincronizarse. */
export const BEAT2_DELAY = 650;
export const BEAT3_DELAY = 1300;
export const BEAT_CORTO = 700;   // lo que dura en pantalla la racha y el resumen
export const BEAT_LARGO = 1100;  // el cuerpo: necesita tiempo para el revelado por zona
const STAGGER_ZONA = 120;
const DUR_TOTAL = BEAT3_DELAY + BEAT_LARGO;
const CONTEO_MS = D.panel;
const TIEMPOS_CSS = {
  '--beat2': `${BEAT2_DELAY}ms`, '--beat3': `${BEAT3_DELAY}ms`,
  '--beat-corto': `${BEAT_CORTO}ms`, '--beat-largo': `${BEAT_LARGO}ms`,
};
/* La salida (auditoría total, H4). Antes cerrar() la desmontaba en un
   cuadro mientras la hoja de la sesión recién arrancaba (.bk desde opacidad
   0, el panel desde abajo): durante esos cuadros se veía la pantalla Hoy
   entera, un destello entre la celebración y el resumen. Ahora queda
   encima, opaca, lo que tarda el fondo de la hoja en llegar (--d1), y
   recién ahí se funde (--d3) sobre la hoja que ya está subiendo. Mismos
   números que #session-complete.saliendo en styles.css (lo compara
   hojas-salidas.test.js). */
export const SALIDA_MS = D.toque + D.panel;
// Se desmonta con el animationend de fdout; el timer es la red (con el hilo
// ocupado la animación arranca tarde y un timer puro la cortaría).
const RED_SALIDA_MS = SALIDA_MS + D.panel;

function milestoneTexto(m) {
  if (!m) return null;
  if (m.type === 'racha') return <><Flame size={14} className="ico-linea txt-flame" /> {m.value} días de racha</>;
  if (m.type === 'sesiones') return <><Trofeo size={14} className="ico-linea" /> Sesión #{m.value}</>;
  if (m.type === 'tonelaje') return <><Mancuerna size={14} className="ico-linea" /> {fmtKg(m.value)} movidos en total</>;
  return null;
}

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
  // La sesión que se está yendo: ya no está en S.sessionComplete (la hoja
  // del resumen se abrió), pero se sigue pintando hasta que termina el fundido.
  const [saliendo, setSaliendo] = useState(null);
  const salidaTimer = useRef(null);
  const streakRef = useRef(null);
  const flameRef = useRef(null);
  const ejRef = useRef(null);
  const serRef = useRef(null);
  const kgRef = useRef(null);

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
    if (!actual) return;
    S.sessionComplete = null;
    if (!reducido) {
      setSaliendo(actual);
      clearTimeout(salidaTimer.current);
      salidaTimer.current = setTimeout(() => setSaliendo(null), RED_SALIDA_MS);
    }
    if (!actual.id) return;
    openSheet('session-view', { id: actual.id, justFinished: true });
    // El confetti se dispara ACÁ (cuando se abre el sheet que muestra el PR),
    // no al terminar la sesión: ver el comentario en completeSession()
    // (session.js) para el porqué del cambio. cerrar() es el único camino de
    // salida de esta pantalla —lo mismo si el timer la cierra sola que si la
    // tocás para saltarla— así que cubre los dos casos sin nada extra.
    if (actual.huboPR || actual.milestone) fireConfetti();
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

  /* Cuenta ascendente de los números del resumen, sincronizada con los mismos
     delays que ya usan los beats (BEAT2_DELAY). Se salta entera bajo "reducir
     movimiento" — mismo criterio que el resto de esta pantalla: contar de 0 a
     N ES movimiento, y el usuario pidió que no lo haya.

     Antes esto era lo último que quedaba de GSAP en la app: tres tweens sobre
     objetos planos que escribían el textContent a mano en cada onUpdate.
     countTo() (lib/motion.js) hace exactamente eso —rAF, escribe el número
     sin pasar por React, se cancela solo si el nodo se desmonta— y ya lo usan
     Inicio y Nutrición. Cuatro números, cuatro llamadas, y GSAP sale del
     bundle. La llama usa popIn() con la curva con rebote de la app en vez de
     `elastic.out`; es la única diferencia perceptible del cambio y es un
     rebote por otro. */
  useEffect(() => {
    if (!sess || reducido) return;
    const { ejercicios, series, kg } = resumenDe(sess);
    /* Los números cuentan en CONTEO_MS y quedan quietos el resto del tiempo:
       antes contaban 800 ms desde los 650 y el tiempo 2 empezaba a fundirse
       a los ~1266, así que se iban contando — nunca se veía el número final
       quieto (H6). Con D.panel terminan a los 970 y se leen ~300 ms. */
    popIn(flameRef.current, { scale: 0.3, rotate: -25, duration: D.momento });
    const cancels = [
      countTo(streakRef.current, currentStreak(), { duration: D.momento }),
      countTo(ejRef.current, ejercicios, { duration: CONTEO_MS, delay: BEAT2_DELAY }),
      countTo(serRef.current, series, { duration: CONTEO_MS, delay: BEAT2_DELAY }),
      countTo(kgRef.current, round1(kg), {
        duration: CONTEO_MS, delay: BEAT2_DELAY, format: n => fmtMiles(round1(n)),
      }),
    ];
    return () => cancels.forEach(c => c());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sess?.id]);

  // Volver desde la celebración hace lo mismo que tocarla: salta al resumen.
  useAtras(!!sess, cerrar);

  useEffect(() => () => clearTimeout(salidaTimer.current), []);

  /* Mientras sale se pinta la sesión que se fue: los mismos nodos, así las
     animaciones de los beats y los números ya contados no arrancan de nuevo. */
  const visible = sess || saliendo;
  if (!visible) return null;

  const { ejercicios, series, kg } = resumenDe(visible);
  const streak = currentStreak();
  const cats = catsDeSesion(visible);
  // Esta pantalla no es interactiva y nunca gira: muestra la cara con más
  // zonas de lo trabajado (H5). Antes era siempre de frente, y un día
  // Posterior encendía casi nada — una silueta oscura durante 1,1 s.
  // Lo que no tiene geometría en esa cara (Glúteo de frente, Pecho de
  // espalda) no ocupa un turno del escalonado: dejaría un hueco muerto, una
  // pausa sin que nada se ilumine, en el ritmo de revelado.
  const sexo = S.cfg.bodySex || S.cfg.profile?.sex;
  const cara = caraConMas(cats, sexo);
  const enCara = new Set(cuerpo(sexo)[cara].zonas.map(z => z.cat));
  const catsVisibles = cats.filter(c => enCara.has(c));
  const revelar = Object.fromEntries(catsVisibles.map((c, i) => [c, BEAT3_DELAY + i * STAGGER_ZONA]));
  const diasHoy = Object.fromEntries(cats.map(c => [c, 0]));

  // Sólo bajo movimiento reducido: la opacidad de CADA beat la manda
  // beatActual en vez de la animación (apagada por CSS). Con movimiento
  // normal esto no se toca — el timeline sigue siendo 100% CSS, como ya
  // estaba verificado.
  const estiloDe = n => (reducido ? { opacity: beatActual === n ? 1 : 0 } : undefined);

  return (
    <div
      id="session-complete"
      className={sess ? undefined : 'saliendo'}
      style={TIEMPOS_CSS}
      role="status"
      aria-label="Entrenamiento completo"
      aria-hidden={sess ? undefined : true}
      onClick={sess ? cerrar : undefined}
      onAnimationEnd={e => {
        if (!sess && e.target === e.currentTarget && e.animationName === 'fdout') {
          clearTimeout(salidaTimer.current);
          setSaliendo(null);
        }
      }}
    >
      <div className="sc-beat b1" style={estiloDe(1)}>
        <span ref={flameRef} style={{ display: 'inline-block' }}><Flame size={56} className="sc-flame" /></span>
        <div className="sc-streak-n" ref={streakRef}>{reducido ? streak : 0}</div>
        <div className="sc-lbl">{streak === 1 ? 'día de racha' : 'días de racha'}</div>
        {visible.milestone && <div className="sc-lbl" style={{ marginTop: 6 }}>{milestoneTexto(visible.milestone)}</div>}
      </div>
      <div className="sc-beat b2" style={estiloDe(2)}>
        <div className="sc-resumen">
          <div className={cn('rounded-[var(--radius-r)] bg-white/5 px-4 py-3')}><b ref={ejRef}>{reducido ? ejercicios : 0}</b><span>ejercicios</span></div>
          <div className={cn('rounded-[var(--radius-r)] bg-white/5 px-4 py-3')}><b ref={serRef}>{reducido ? series : 0}</b><span>series</span></div>
          <div className={cn('rounded-[var(--radius-r)] bg-white/5 px-4 py-3')}><b ref={kgRef}>{reducido ? fmtMiles(round1(kg)) : 0}</b><span>kg movidos</span></div>
        </div>
      </div>
      <div className="sc-beat b3" style={estiloDe(3)}>
        <div className="sc-cuerpo">
          <Silhouette days={diasHoy} interactivo={false} revelar={revelar} desdeAtras={cara === 'espalda'} />
        </div>
      </div>
    </div>
  );
}
