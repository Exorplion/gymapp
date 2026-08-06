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
import { T, minimizeRest, expandRest, stopRest, tickRest, REST_CIRC } from '../lib/rest.js';
import { useStore } from '../lib/state.js';
import { fmtMMSS } from '../lib/format.js';

export default function RestTimer() {
  useStore(); // se suscribe a bump(); T se lee directo (T.leftSec/T.pct/T.state) igual que S

  const sonandoAhora = T.state === 'ringing';
  const timeStr = fmtMMSS(T.leftSec);
  const pctClamped = Math.max(0, Math.min(1, T.pct));
  const fillPct = pctClamped * 100;
  // Sonando el anillo se cierra entero: pasa de ser cuenta regresiva a ser el
  // aviso. Va acá y no en el CSS porque el style inline le gana a la hoja.
  const dashOffset = sonandoAhora ? 0 : REST_CIRC * (1 - pctClamped);

  // El dispatcher original resolvía un solo data-act por click (closest()
  // se detiene en el ancestro más cercano), así que clickear +30s/Saltar no
  // también disparaba rest-expand del contenedor. Acá el equivalente es
  // stopPropagation() en los botones.
  function addTime(e) { e.stopPropagation(); T.end += 30000; tickRest(); }
  function skip(e) { e.stopPropagation(); stopRest(); }
  function minimize(e) { e.stopPropagation(); minimizeRest(); }

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

      <div id="restbar" className={T.state === 'minimized' ? 'show' : ''} data-act="rest-expand" onClick={expandRest}>
        <div className="rb-top">
          <div>
            <div className="rb-lbl">Descanso</div>
            <div id="rest-time">{timeStr}</div>
          </div>
          <div className="rb-btns">
            <button type="button" onClick={addTime}>+30s</button>
            <button type="button" onClick={skip}>Saltar</button>
          </div>
        </div>
        <div id="rest-track"><i id="rest-fill" style={{ width: `${fillPct}%` }}></i></div>
      </div>

      <div id="rest-fs" className={T.state === 'fullscreen' || sonandoAhora ? 'show' : ''}>
        <div className={`rfs-inner${sonandoAhora ? ' ringing' : ''}`}>
          <div className="rfs-lbl">{sonandoAhora ? '¡Dale!' : 'Descanso'}</div>
          <div className="rfs-ring">
            <svg viewBox="0 0 200 200">
              <circle className="rfs-track" cx="100" cy="100" r="88" />
              <circle className="rfs-prog" id="rfs-prog" cx="100" cy="100" r="88" style={{ strokeDashoffset: dashOffset }} />
            </svg>
            <div className="rfs-time" id="rfs-time">{sonandoAhora ? '¡YA!' : timeStr}</div>
          </div>
          {sonandoAhora ? (
            /* Un solo botón, ancho y sin vecinos: está sonando y lo único que
               querés es callarla. Poner "+30s" al lado sería invitarte a errarle. */
            <button type="button" className="rfs-parar" onClick={skip} autoFocus>PARAR</button>
          ) : (
            <div className="rfs-btns">
              <button type="button" className="btn sm ghost" onClick={addTime}>+30s</button>
              <button type="button" className="btn sm dim" onClick={skip}>Saltar</button>
            </div>
          )}
          {!sonandoAhora && (
            <button type="button" className="icon-btn rfs-min" aria-label="Minimizar" onClick={minimize}>⌄</button>
          )}
        </div>
      </div>
    </>
  );
}
