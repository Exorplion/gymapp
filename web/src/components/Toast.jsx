import { useEffect, useState } from 'react';

// Puerto del toast() de index.html: allí `toast(msg,opts)` escribía
// directamente en el <div id="toast"> del DOM y cualquier módulo lo llamaba
// como función global. Acá no hay un único nodo DOM que todos compartan, así
// que el mismo contrato ("llamar toast() desde cualquier módulo, incluso
// fuera de un componente") se resuelve con un pub-sub minimalista: los
// módulos de negocio (session.js, streak.js, etc. en tareas futuras) importan
// `toast` de este archivo igual que importarían la función global original,
// y <Toast/> es el único suscriptor que la renderiza.
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

export default function Toast() {
  const [state, setState] = useState(null); // {msg, actionLabel, onAction} | null
  const [show, setShow] = useState(false);

  useEffect(() => {
    listener = (next) => {
      if (next.hide) { setShow(false); return; }
      setState(next);
      setShow(true);
    };
    return () => { listener = null; };
  }, []);

  return (
    <div id="toast" className={show ? 'show' : ''}>
      {state && (
        <>
          <span>{state.msg}</span>
          {state.actionLabel && (
            <button
              type="button"
              className="toast-act"
              onClick={() => { state.onAction?.(); setShow(false); }}
            >
              {state.actionLabel}
            </button>
          )}
        </>
      )}
    </div>
  );
}
