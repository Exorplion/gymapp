// Puerto de <div id="restbar"> + <div id="rest-fs"> (index.html ~líneas
// 654-688) + tickRest()/startRest()/etc. del bloque "timer descanso"
// (~líneas 1370-1421). El original escribía directo a nodos DOM
// ($('#rest-time').textContent=…, $('#rfs-prog').style.strokeDashoffset=…);
// acá eso se reemplaza por leer T.leftSec/T.pct (rest.js, Task 3) en cada
// render. T muta fuera de React pero rest.js llama al mismo bump() que usa
// state.js para S, así que useStore() (mismo canal, un solo contador de
// versión) alcanza para re-renderizar este componente sin una suscripción
// aparte — es la razón por la que rest.js no necesita su propio
// listeners/subscribe.
//
// Ambos bloques (pill minimizada y overlay de pantalla completa) viven en un
// solo componente, igual que en el original: son mutuamente excluyentes
// según T.state y comparten el mismo <defs> de gradiente SVG.
import { useEffect, useRef } from 'react';
import { T, minimizeRest, expandRest, stopRest, shiftRest, REST_CIRC } from '../lib/rest.js';
import { useStore } from '../lib/state.js';
import { fmtMMSS } from '../lib/format.js';
import { ChevronDown } from './Icon.jsx';
import { animateRing, impactBurst, squashStretch } from '../lib/motion.js';

export default function RestTimer() {
  useStore(); // se suscribe a bump(); T se lee directo (T.leftSec/T.pct/T.state) igual que S

  const ringRef = useRef(null);
  const ringBoxRef = useRef(null);
  const timeFsRef = useRef(null);
  const sonabaAntes = useRef(false);
  const sonandoAhora = T.state === 'ringing';
  const timeStr = fmtMMSS(T.leftSec);
  const pctClamped = Math.max(0, Math.min(1, T.pct));
  const fillPct = pctClamped * 100;
  // El anillo del overlay de pantalla completa se anima con animateRing()
  // (Apple Fitness) en vez de un style inline recalculado en cada render:
  // así el "cierre" entre un tick y el siguiente es una transición suave de
  // ~900ms, no un salto de un dashoffset fijo a otro. Sonando, el anillo se
  // cierra entero: pasa de ser cuenta regresiva a ser el aviso.
  useEffect(() => {
    animateRing(ringRef.current, sonandoAhora ? 1 : pctClamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(pctClamped * 1000), sonandoAhora]);

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
            <stop offset="0%" stopColor="var(--blue2)" />
            <stop offset="100%" stopColor="var(--cyan)" />
          </linearGradient>
        </defs>
      </svg>

      <div
        id="restbar"
        className={T.state === 'minimized' ? 'show' : ''}
        data-act="rest-expand"
        role="button"
        tabIndex={0}
        aria-label={`Descanso, ${timeStr} restantes. Tocar para expandir.`}
        onClick={expandRest}
        onKeyDown={onKeyExpand}
      >
        <div className="rb-top">
          <div>
            <div className="rb-lbl">Descanso</div>
            <div id="rest-time">{timeStr}</div>
          </div>
          <div className="rb-btns">
            <button type="button" onClick={subTime}>−30s</button>
            <button type="button" onClick={addTime}>+30s</button>
            <button type="button" onClick={skip}>Saltar</button>
          </div>
        </div>
        <div id="rest-track"><i id="rest-fill" style={{ width: `${fillPct}%` }}></i></div>
      </div>

      <div id="rest-fs" className={T.state === 'fullscreen' || sonandoAhora ? 'show' : ''}>
        <div className={`rfs-inner${sonandoAhora ? ' ringing' : ''}`}>
          <div className="rfs-lbl">{sonandoAhora ? '¡Dale!' : 'Descanso'}</div>
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
            <div className="rfs-time" id="rfs-time" ref={timeFsRef}>{sonandoAhora ? '¡YA!' : timeStr}</div>
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
