import { useEffect, useState } from 'react';
import { subscribeToast } from '../lib/toast.js';

// Único suscriptor del pub-sub de lib/toast.js. La función toast() vive allá
// (no acá) para que los módulos de negocio no tengan que importar desde
// components/ — ver el comentario de cabecera de lib/toast.js.
export default function Toast() {
  const [state, setState] = useState(null); // {msg, actionLabel, onAction} | null
  const [show, setShow] = useState(false);

  useEffect(() => subscribeToast((next) => {
    if (next.hide) { setShow(false); return; }
    setState(next);
    setShow(true);
  }), []);

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
