// Puerto del toast() de index.html: allí `toast(msg,opts)` escribía
// directamente en el <div id="toast"> del DOM y cualquier módulo lo llamaba
// como función global. Acá no hay un único nodo DOM que todos compartan, así
// que el mismo contrato ("llamar toast() desde cualquier módulo, incluso
// fuera de un componente") se resuelve con un pub-sub minimalista.
//
// Vive en lib/ y no en components/ a propósito: lo llaman módulos de negocio
// (session.js, rest.js, backup.js, rutina-logic.js, templates.js) y si el
// publicador viviera junto al componente, la lógica tendría que importar
// hacia components/ — una inversión de capas que la revisión final marcó.
// Acá la dirección es siempre la misma: components/ importa de lib/.
//
// No importa nada: es una hoja del grafo de módulos, así que no puede
// participar de un ciclo con state.js (ver la nota de state.js sobre dstr()).
let listener = null;
let hideTimer = null;

/**
 * Mismo comportamiento que el original: 1900ms de auto-dismiss, o 4000ms si
 * hay acción (opts.actionLabel). La acción ya no es un `data-act` de un
 * dispatcher global — es un callback `onAction` porque en React cada módulo
 * tiene su propia función, no un string que un switch central resuelva.
 */
export function toast(msg, opts = {}) {
  if (!listener) return;
  clearTimeout(hideTimer);
  listener({ msg, actionLabel: opts.actionLabel, onAction: opts.onAction });
  hideTimer = setTimeout(() => listener?.({ hide: true }), opts.actionLabel ? 4000 : 1900);
}

/**
 * La usa <Toast/>, el único suscriptor. Devuelve la función de baja para el
 * cleanup del efecto. El guard `listener === fn` evita que el desmontaje de
 * un Toast viejo borre la suscripción de uno nuevo si alguna vez llegaran a
 * solaparse (hoy sólo se monta uno).
 */
export function subscribeToast(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}
