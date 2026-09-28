// Puerto de <div id="restbar"> + <div id="rest-fs"> (index.html ~líneas
// 654-688) + tickRest()/startRest()/etc. del bloque "timer descanso"
// (~líneas 1370-1421). El original escribía directo a nodos DOM
// ($('#rest-time').textContent=…, $('#rfs-prog').style.strokeDashoffset=…).
// Acá, dos canales (G3, auditoría 2026-09):
//  - los cambios de ESTADO (abrir, minimizar, sonar, la pregunta del RIR)
//    llegan por bump() → useStore(), igual que S;
//  - el paso del TIEMPO llega por suscribirReloj (rest.js), una vez por
//    segundo y sólo a los dos relojes (<Tiempo/>, <BarraDescanso/>). Antes
//    cada tick de 250 ms era un bump() y re-renderizaba la app entera.
// El anillo y la barrita no escuchan ningún tick: recorren el descanso
// completo de una y se reprograman cuando cambia T.seq. La barrita es una
// animación de transform (compositor); el anillo lo dibuja un worker en un
// OffscreenCanvas (lib/anillo.worker.js explica por qué no una animación).
//
// Ambos bloques (pill minimizada y overlay de pantalla completa) viven en un
// solo componente, igual que en el original: son mutuamente excluyentes
// según T.state y comparten el mismo <defs> de gradiente SVG.
//
// Acá adentro vive también la pregunta "¿cuántas te quedaron?" (RIR), y no en
// un sheet propio encima. La razón es de toques, no de estética: al confirmar
// la serie, saveSet() ya llama a startRest() y ESTE overlay se abre solo,
// tapando la pantalla. Un segundo overlay apilado obligaría a un toque extra
// sólo para sacárselo de encima, sobre la acción más repetida de toda la app
// (15-30 veces por sesión). Metida acá son cero toques de más y la pregunta
// aparece sin que la busques, que era justamente lo que fallaba cuando vivía
// escondida en el <details> "Más opciones" de la tarjeta del ejercicio.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  T, minimizeRest, expandRest, stopRest, shiftRest, REST_CIRC, cerrarPreguntaRir,
  suscribirReloj, versionReloj, tramoAnillo,
} from '../lib/rest.js';
import { tramosAnillo, CIERRE } from '../lib/anillo.js';
import { setRirUltimaSerie } from '../lib/session.js';
import { RIR_OPTS } from '../lib/rir.js';
import { useStore } from '../lib/state.js';
import { useAtras } from '../lib/useAtras.js';
import { fmtMMSS } from '../lib/format.js';
import { ChevronDown } from './Icon.jsx';
import { impactBurst, squashStretch, menosMovimiento, D, EASE_OUT } from '../lib/motion.js';

// La curva de salida de la app, en el formato que pide motion.
const CURVA = EASE_OUT.match(/[\d.]+/g).map(Number);

/** El segundo que se ve. Sólo re-renderiza a quien lo llama, una vez por
    segundo (rest.js avisa cuando cambia T.leftSec, no en cada tick). */
function useReloj() {
  useSyncExternalStore(suscribirReloj, versionReloj);
  return fmtMMSS(T.leftSec);
}

function Tiempo() {
  return useReloj();
}

/* Progreso (0..1) → cómo lo pinta cada uno. El anillo con el trazo; la
   barrita con scaleX, que va en el compositor (antes era `width`, o sea
   layout en cada cambio). */
const PINTA_ANILLO = p => ({ strokeDashoffset: REST_CIRC * (1 - p) });
const PINTA_BARRA = p => ({ transform: `scaleX(${p})` });

/* El motor del anillo: un worker que dibuja en un OffscreenCanvas. Uno por
   lienzo (transferControlToOffscreen se puede llamar una sola vez, y el doble
   efecto del modo estricto lo intentaría dos veces). `null` = el navegador no
   puede, y el anillo vuelve a ser el <circle> animado con WAAPI. */
const motores = new WeakMap();
function motorAnillo(canvas) {
  if (!canvas) return null;
  if (motores.has(canvas)) return motores.get(canvas);
  let motor = null;
  try {
    if (typeof Worker === 'function' && canvas.transferControlToOffscreen) {
      const worker = new Worker(new URL('../lib/anillo.worker.js', import.meta.url), { type: 'module' });
      const off = canvas.transferControlToOffscreen();
      worker.postMessage({ tipo: 'lienzo', lienzo: off, px: Math.round(240 * (devicePixelRatio || 1)) }, [off]);
      canvas.dataset.activo = '';
      motor = {
        tramo: (tramos, ms, colores) => worker.postMessage({ tipo: 'tramo', tramos, ms, colores, inicio: performance.timeOrigin + performance.now() }),
        quieto: (p, colores) => worker.postMessage({ tipo: 'quieto', p, colores }),
        pausa: () => worker.postMessage({ tipo: 'pausa' }),
      };
    }
  } catch {
    motor = null;
  }
  motores.set(canvas, motor);
  return motor;
}

/* Los colores del anillo salen del mismo lugar que los del SVG (el
   degradado #restGrad y, sonando, el trazo de .ringing), así una paleta
   nueva los cambia a los dos. */
function coloresAnillo(circulo, sonando) {
  if (sonando) return { solido: getComputedStyle(circulo).stroke };
  const [a, b] = document.querySelectorAll('#restGrad stop');
  return { a: getComputedStyle(a).stopColor, b: getComputedStyle(b).stopColor };
}

function animarTramo(el, pinta, tramos, ms) {
  if (!el?.animate) return;
  for (const a of el.getAnimations()) a.cancel();
  el.animate(
    tramos.map(k => ({ offset: k.offset, easing: k.easing, ...pinta(k.p) })),
    { duration: Math.max(1, ms), fill: 'forwards' },
  );
}

export default function RestTimer() {
  useStore(); // se suscribe a bump() (cambios de estado); T se lee directo igual que S
  /* Del reloj, RestTimer sólo necesita enterarse cuando cambia el TRAMO del
     anillo (T.seq: ±30 s, volver a la app), no de cada segundo: el selector
     devuelve T.seq y React sólo re-renderiza si cambió. */
  useSyncExternalStore(suscribirReloj, () => T.seq);
  // El descanso a pantalla completa se minimiza con el gesto de volver, en
  // vez de cerrar la app con el cronómetro corriendo.
  useAtras(T.state === 'fullscreen', minimizeRest);

  const ringRef = useRef(null);
  const ringBoxRef = useRef(null);
  const timeFsRef = useRef(null);
  const sonabaAntes = useRef(false);
  const sonandoAhora = T.state === 'ringing';
  /* La pantalla completa también SALE animada (2026-09-26, auditoría de
     salidas): antes entraba con un fundido y se iba de golpe (display:none)
     al minimizar, saltar o terminar. `saliendo` la deja pintada D.objeto ms
     más con la clase .out, que corre el fundido de salida. */
  const visibleFs = T.state === 'fullscreen' || sonandoAhora;
  const [saliendo, setSaliendo] = useState(false);
  const eraVisible = useRef(visibleFs);
  useEffect(() => {
    if (eraVisible.current && !visibleFs) {
      setSaliendo(true);
      const t = setTimeout(() => setSaliendo(false), D.objeto);
      eraVisible.current = visibleFs;
      return () => clearTimeout(t);
    }
    eraVisible.current = visibleFs;
    if (visibleFs) setSaliendo(false);
  }, [visibleFs]);
  /* El anillo (y la barrita de la pill): UNA animación lineal que recorre
     el descanso entero, programada con el tiempo que falta (tramoAnillo).
     Antes se lanzaba una animación nueva de 900 ms en cada tick de 250 ms.
     Se reprograma sólo cuando cambia el tramo (T.seq: arrancar, ±30 s,
     volver a la app). Si el anillo no está donde tiene que estar (arranca un
     descanso, sumaste 30 s), llega con la misma curva suave de antes y
     después sigue lineal. Sonando, se cierra entero: pasa de ser cuenta
     regresiva a ser el aviso. */
  const fillRef = useRef(null);
  const lienzoRef = useRef(null);
  const plan = useRef(null);      // { desde, t0, ms } del tramo en curso
  const quieto = useRef(0);       // progreso pintado cuando no hay tramo
  function progresoAhora() {
    const p = plan.current;
    if (!p) return quieto.current;
    return p.desde * Math.max(0, 1 - (performance.now() - p.t0) / p.ms);
  }
  const corriendo = T.state === 'fullscreen' || T.state === 'minimized';
  useEffect(() => {
    const anillo = ringRef.current, barra = fillRef.current;
    const motor = motorAnillo(lienzoRef.current);
    if (sonandoAhora) {
      const previo = progresoAhora();
      plan.current = null; quieto.current = 1;
      const colores = motor && coloresAnillo(anillo, true);
      if (menosMovimiento()) {
        if (motor) motor.quieto(1, colores); else Object.assign(anillo.style, PINTA_ANILLO(1));
        return;
      }
      const tramos = [{ offset: 0, p: previo, easing: CIERRE }, { offset: 1, p: 1, easing: 'linear' }];
      if (motor) motor.tramo(tramos, 900, colores); else animarTramo(anillo, PINTA_ANILLO, tramos, 900);
      return;
    }
    if (!corriendo) {
      // Se cortó o se saltó: el anillo se queda donde estaba para el próximo.
      quieto.current = progresoAhora(); plan.current = null;
      motor?.pausa();
      return;
    }
    const { desde, ms } = tramoAnillo();
    const previo = progresoAhora();
    plan.current = { desde, t0: performance.now(), ms: Math.max(1, ms) };
    if (menosMovimiento()) return;   // lo pinta el efecto de abajo, por segundo
    const tramos = tramosAnillo({ previo, desde, ms });
    animarTramo(barra, PINTA_BARRA, tramos, ms);
    if (!motor) animarTramo(anillo, PINTA_ANILLO, tramos, ms);
    // Minimizado no se ve: el worker no dibuja hasta que vuelva a expandirse.
    else if (visibleFs) motor.tramo(tramos, ms, coloresAnillo(anillo, false));
    else motor.pausa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [T.seq, sonandoAhora, corriendo, visibleFs]);

  /* Con "reducir movimiento" no hay animación continua: se pinta el valor
     de cada segundo, como antes. */
  useEffect(() => {
    if (!menosMovimiento()) return;
    const pintar = () => {
      if (T.state === 'ringing') return;
      const { desde } = tramoAnillo();
      const motor = motorAnillo(lienzoRef.current);
      if (motor && ringRef.current) motor.quieto(desde, coloresAnillo(ringRef.current, false));
      else if (ringRef.current) Object.assign(ringRef.current.style, PINTA_ANILLO(desde));
      if (fillRef.current) Object.assign(fillRef.current.style, PINTA_BARRA(desde));
    };
    pintar();
    return suscribirReloj(pintar);
  }, []);

  // Momento de logro sin celebración: terminar el descanso no tenía ningún
  // "hit" — a diferencia del PR (confetti) o la serie (impactBurst en el
  // botón). Se dispara UNA vez en la transición a "sonando" (no en cada
  // render mientras suena), con la misma técnica de "juice" que el resto:
  // ráfaga de partículas en el punto exacto del anillo + squash & stretch
  // en el "¡YA!".
  useEffect(() => {
    if (sonandoAhora && !sonabaAntes.current) {
      const box = ringBoxRef.current?.getBoundingClientRect();
      if (box) impactBurst(box.left + box.width / 2, box.top + box.height / 2, { count: 10, distance: 60 });
      squashStretch(timeFsRef.current);
    }
    sonabaAntes.current = sonandoAhora;
  }, [sonandoAhora]);

  // El dispatcher original resolvía un solo data-act por click (closest()
  // se detiene en el ancestro más cercano), así que clickear +30s/Saltar no
  // también disparaba rest-expand del contenedor. Acá el equivalente es
  // stopPropagation() en los botones.
  function addTime(e) { e.stopPropagation(); shiftRest(30); }
  function subTime(e) { e.stopPropagation(); shiftRest(-30); }
  function skip(e) { e.stopPropagation(); stopRest(); }
  function minimize(e) { e.stopPropagation(); minimizeRest(); }

  /* La franja entera es "tocar para expandir", pero adentro tiene botones de
     verdad (−30s/+30s/Saltar) — no puede ser un <button>, anidar interactivos
     no es válido HTML. role="button" + tabIndex la hace alcanzable por
     teclado igual.

     El chequeo target===currentTarget importa: sin él, apretar Enter en
     "Saltar" (que SÍ está enfocado y responde a Enter por su cuenta, como
     cualquier <button>) dispararía ADEMÁS expandRest() acá, porque el keydown
     original sigue burbujeando aunque el click que ese botón generó ya se
     haya frenado con stopPropagation() más arriba — eso frena el click, no
     este keydown, que es un evento aparte. */
  function onKeyExpand(e) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expandRest(); }
  }

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="restGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
      </svg>

      <BarraDescanso
        show={T.state === 'minimized'}
        fillRef={fillRef}
        onKeyDown={onKeyExpand}
        subTime={subTime}
        addTime={addTime}
        skip={skip}
      />

      <div id="rest-fs" className={visibleFs ? 'show' : saliendo ? 'show out' : ''} aria-hidden={!visibleFs}>
        <div className={`rfs-inner${sonandoAhora ? ' ringing' : ''}`}>
          <div className="rfs-lbl">{sonandoAhora ? '¡Dale!' : 'Descanso'}</div>
          {/* Sólo en 'fullscreen': sonando no se pregunta nada (T.rir ya se
              limpió en rest.js) y minimizado tampoco — la pill es una franja
              de 2cm donde el tiempo y los ±30s ya van justos; meterle cinco
              chips la convertiría en otra cosa. Si volvés a expandir antes de
              que termine el descanso, la pregunta sigue ahí. */}
          {/* Contestada, sale con altura y fundido (no desaparece de golpe):
              el reloj sube a ocupar su lugar. */}
          <AnimatePresence initial={false}>
            {T.rir && !T.rir.cerrada && T.state === 'fullscreen' && (
              <motion.div
                key="rir"
                className="rfs-rir-caja"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', transition: { duration: D.panel / 1000, ease: CURVA } }}
                exit={{ opacity: 0, height: 0, transition: { duration: D.panel / 1000, ease: CURVA } }}
              >
                <PreguntaRir />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="rfs-ring" ref={ringBoxRef}>
            <svg viewBox="0 0 200 200">
              <circle className="rfs-track" cx="100" cy="100" r="88" />
              <circle
                ref={ringRef}
                className="rfs-prog"
                id="rfs-prog"
                cx="100"
                cy="100"
                r="88"
                data-circumference={REST_CIRC}
              />
            </svg>
            {/* Con el worker andando (data-activo) el <circle> de progreso
                se esconde y queda sólo como fuente de los colores; el que se
                ve es el lienzo. Va DESPUÉS del <svg>: el svg tiene transform,
                o sea que se pinta en la misma capa que los posicionados, en
                orden de aparición — adelante, su pista lo tapaba entero. */}
            <canvas className="rfs-lienzo" ref={lienzoRef} aria-hidden="true" />
            <div className="rfs-time" id="rfs-time" ref={timeFsRef}>{sonandoAhora ? '¡YA!' : <Tiempo />}</div>
          </div>
          {sonandoAhora ? (
            /* Un solo botón, ancho y sin vecinos: está sonando y lo único que
               querés es callarla. Poner "+30s" al lado sería invitarte a errarle. */
            <button type="button" className="rfs-parar" onClick={skip} autoFocus>PARAR</button>
          ) : (
            <div className="rfs-btns">
              <button type="button" className="btn sm ghost" onClick={subTime}>−30s</button>
              <button type="button" className="btn sm ghost" onClick={addTime}>+30s</button>
              <button type="button" className="btn sm dim" onClick={skip}>Saltar</button>
            </div>
          )}
          {!sonandoAhora && (
            <button type="button" className="icon-btn rfs-min" aria-label="Minimizar" onClick={minimize}><ChevronDown /></button>
          )}
        </div>
      </div>
    </>
  );
}

/** La pill del descanso minimizado. Componente aparte porque es lo único,
    junto con <Tiempo/>, que cambia cada segundo: su aria-label lleva el
    tiempo. La barrita (#rest-fill) no se toca desde acá: la anima RestTimer
    con un solo tramo continuo. */
function BarraDescanso({ show, fillRef, onKeyDown, subTime, addTime, skip }) {
  const tiempo = useReloj();
  return (
    <div
      id="restbar"
      className={show ? 'show' : ''}
      data-act="rest-expand"
      role="button"
      tabIndex={0}
      aria-label={`Descanso, ${tiempo} restantes. Tocar para expandir.`}
      onClick={expandRest}
      onKeyDown={onKeyDown}
    >
      <div className="rb-top">
        <div>
          <div className="rb-lbl">Descanso</div>
          <div id="rest-time">{tiempo}</div>
        </div>
        <div className="rb-btns">
          <button type="button" onClick={subTime}>−30s</button>
          <button type="button" onClick={addTime}>+30s</button>
          <button type="button" onClick={skip}>Saltar</button>
        </div>
      </div>
      <div id="rest-track"><i id="rest-fill" ref={fillRef}></i></div>
    </div>
  );
}

/** "¿Cuántas te quedaron?" — el RIR de la serie que acaba de cerrarse.

    Opcional de verdad: no contestar no bloquea nada, no insiste y no muestra
    ningún reproche; la pregunta se va sola cuando el descanso termina. Tocar
    otro chip corrige, tocar el mismo des-selecciona y el `rpe` vuelve a null
    — igual que se comportaba el selector viejo. Lee el estado elegido de
    T.rir.valor y no de un useState propio, así una corrección sobrevive a
    minimizar y volver a expandir. */
/* 2026-09-25: al contestar, la opción queda marcada un instante (lo que
   tardás en ver que se anotó) y la pregunta se va. Antes se quedaba hasta el
   final del descanso, ocupando la mitad de la pantalla del reloj. Y en vez de
   cinco chips sueltos, una sola barra segmentada: se lee como UNA pregunta. */
const PAUSA_CONFIRMAR = 450;

function PreguntaRir() {
  const p = T.rir;
  const elegido = p.valor;
  return (
    <div className="rfs-rir">
      <div className="rfs-rir-t">¿Cuántas reps te quedaban?</div>
      <div className="rfs-rir-meta">
        Opcional{p.pedia != null && ` · pedía ${p.pedia === 0 ? 'al fallo' : `RIR ${p.pedia}`}`}
      </div>
      <div className="rir-seg" role="group" aria-label="Repeticiones en reserva que te quedaron">
        {RIR_OPTS.map(n => {
          const on = elegido === n;
          return (
            <motion.button
              key={n}
              type="button"
              aria-pressed={on}
              aria-label={n === 0 ? '0, al fallo' : n === 4 ? '4 o más' : String(n)}
              className={on ? 'on' : ''}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.12 }}
              onClick={e => {
                e.stopPropagation();
                setRirUltimaSerie(n);
                setTimeout(cerrarPreguntaRir, PAUSA_CONFIRMAR);
              }}
            >
              <b>{n === 4 ? '4+' : n}</b>
              {n === 0 && <small>fallo</small>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
