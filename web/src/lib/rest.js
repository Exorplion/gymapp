// Puerto del timer de descanso (index.html: "timer descanso"). El estado
// vive en T (mutable, igual que S) y bump() avisa a React para repintar —
// mismo patrón que streak.js/session.js. Las escrituras directas a nodos DOM
// del original ($('#rest-fs'), $('#rfs-time'), $('#rest-fill'), etc.) se
// reemplazan por campos en T (T.leftSec, T.pct) que el componente
// <RestTimer/> lee en cada render en vez de que la función los escriba a mano.
//
// El final del descanso NO se decide contando ticks: se compara contra T.end,
// que es una marca de tiempo absoluta. El navegador frena los setInterval de
// las pestañas ocultas, así que contar ticks atrasaría la alarma justo cuando
// más importa — con el teléfono bloqueado. Comparando contra un instante fijo,
// que el tick llegue tarde sólo significa que la alarma suena apenas tarde, no
// que se pierda.
import { S, bump } from './state.js';
import { toast } from './toast.js';
import { prepararAlarma, pedirPermiso, sonar, callar } from './alarm.js';

// Acá vivían un AudioContext (T.audio) y un ding() de osciladores. Se fueron los
// dos: ding() ya no lo llamaba nadie desde que la alarma pasó a ser un <audio>
// (alarm.js), y el AudioContext se creaba y se resume()aba en cada descanso sin
// cerrarse nunca. Un AudioContext en estado "running" ya le da a Android el foco
// de audio multimedia, así que las teclas de volumen del teléfono dejaban de
// controlar el timbre durante todo el descanso — por nada, porque no sonaba.
//
// `rir` es la pregunta "¿cuántas te quedaron?" que el overlay muestra arriba
// del anillo: null = no hay nada que preguntar. Vive acá y no en un estado de
// React porque quien sabe que se registró una serie es saveSet() (session.js),
// que no es un componente — es el mismo canal por el que T ya le habla a
// <RestTimer/> sin suscripción propia.
export const T = { end: 0, total: 0, int: null, state: 'hidden', leftSec: 0, pct: 0, rir: null };

export const REST_CIRC = 2 * Math.PI * 88;

/** Arranca el descanso.

    `segs` permite pedir una duración distinta a la configurada — la usa el
    calentamiento, que tiene su propia pausa de 2:45 antes de la primera serie.
    Sin argumento vale el ajuste de siempre. */
export function startRest(segs) {
  const total = segs > 0 ? segs : S.cfg.rest;
  if (!total) return;
  /* Callar la alarma anterior antes de arrancar la nueva cuenta. La alarma
     se auto-silencia recién a los 120s (TOPE, alarm.js), así que si volvías
     a la serie y arrancabas otro descanso mientras todavía sonaba, seguía
     vibrando y con el <audio> en loop DURANTE TODO el descanso nuevo — y sin
     forma de pararla, porque el overlay que ofrece "PARAR" ya había pasado a
     mostrar el temporizador nuevo. */
  callar();
  // Desbloquear el <audio> con el gesto que arrancó el descanso. Sólo lo
  // desbloquea: el recurso queda suelto hasta que la alarma tenga que sonar.
  prepararAlarma();
  pedirPermiso();
  /* Cada descanso arranca SIN pregunta. Esto es lo que hace que el
     calentamiento (que llama startRest(segs) con su propia duración, ver
     WarmupCard.jsx) nunca pregunte: no hay ninguna serie registrada a la que
     atarle un RIR, y la respuesta se escribiría sobre la serie anterior. Sólo
     saveSet() llama después a pedirRir(), y sólo cuando cerró la serie. */
  T.rir = null;
  T.total = total; T.end = Date.now() + T.total * 1000;
  T.state = 'fullscreen';
  bump();
  if (!T.int) T.int = setInterval(tickRest, 250);
  tickRest();
}

/** Suma o resta segundos al descanso en curso.

    Restar no puede dejar el final en el pasado: eso dispararía la alarma en el
    acto, que no es lo que pedís cuando tocás −30s con 10 segundos a favor. El
    piso son 5 segundos, suficiente para volver a tocar +30 si te pasaste. */
export function shiftRest(secs) {
  if (T.state !== 'fullscreen' && T.state !== 'minimized') return;
  const piso = Date.now() + 5000;
  T.end = Math.max(piso, T.end + secs * 1000);
  // el total sube con el tiempo agregado para que el anillo no se pase de vuelta
  T.total = Math.max(T.total, Math.ceil((T.end - Date.now()) / 1000));
  tickRest();
}

/** "Acabo de registrar una serie, preguntale el RIR mientras descansa."

    La llama saveSet() JUSTO DESPUÉS de startRest(), porque startRest() limpia
    la pregunta anterior. `exId`/`setIdx` apuntan a la serie ya guardada en el
    draft, así la respuesta se escribe sobre esa y no sobre "la última" —que
    puede haber cambiado si mientras tanto registraste otra cosa. `pedia` es
    lo que la rutina pedía para esa serie, para poder leer "pedía RIR 2,
    dejaste 1" sin buscar el número treinta píxeles más arriba. */
export function pedirRir({ exId, setIdx, pedia }) {
  T.rir = { exId, setIdx, pedia: pedia ?? null, valor: null };
  bump();
}

/** Deja anotada la respuesta en el propio T para que el chip se vea elegido.
    El guardado de verdad (parchear `rpe` en la serie) lo hace session.js —
    rest.js no toca el draft, nunca lo hizo. */
export function marcarRirElegido(valor) {
  if (!T.rir) return;
  T.rir.valor = valor;
  bump();
}

/** Contestada, la pregunta se va y queda sólo el reloj (Enzo, 2026-09-25).
    Vive en T y no en el componente: minimizar y volver a expandir no la
    trae de vuelta. */
export function cerrarPreguntaRir() {
  if (!T.rir) return;
  T.rir.cerrada = true;
  bump();
}

export function minimizeRest() {
  if (T.state !== 'fullscreen') return;
  T.state = 'minimized';
  bump();
}

export function expandRest() {
  if (T.state !== 'minimized') return;
  T.state = 'fullscreen';
  bump();
}

export function tickRest() {
  const left = Math.max(0, Math.ceil((T.end - Date.now()) / 1000));
  const pct = Math.max(0, (T.end - Date.now()) / (T.total * 1000));
  T.leftSec = left;
  T.pct = pct;
  if (left <= 0 && T.state !== 'ringing') return terminar();
  bump();
}

/** Se acabó: para el reloj y arranca la alarma, que suena hasta que la cortan. */
function terminar() {
  clearInterval(T.int); T.int = null;
  T.leftSec = 0; T.pct = 0;
  /* Se terminó el descanso: la pregunta se va. Es opcional de verdad — no
     contestarla no deja nada pendiente ni muestra ningún reproche. Y sonando
     no se pregunta nada: está sonando y lo único que querés es callarla. */
  T.rir = null;
  T.state = 'ringing';
  bump();
  toast('⏱ ¡Descanso terminado!');
  // Si se calla sola por el tope, hay que sacar la pantalla de "sonando" o
  // quedaría pidiendo que pares algo que ya no suena.
  sonar('Ya pasaron tus ' + T.total + ' segundos. A la próxima serie.', () => {
    if (T.state === 'ringing') { T.state = 'hidden'; bump(); }
  });
}

export function stopRest() {
  clearInterval(T.int); T.int = null;
  callar();
  T.rir = null;
  T.state = 'hidden';
  bump();
}

/** Recupera el descanso al volver a la app.

    El navegador puede haber congelado los timers mientras estabas en otra app.
    Al volver, esto compara contra T.end y dispara la alarma si el descanso
    venció mientras no mirabas — sin esto la pantalla se quedaría en un número
    viejo, esperando un tick que nunca llegó. */
export function recuperarRest() {
  if (T.state === 'hidden' || T.state === 'ringing') return;
  if (Date.now() >= T.end) terminar();
  else tickRest();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) recuperarRest();
  });
}
