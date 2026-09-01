import { useEffect, useRef, useState } from 'react';
import { S, useStore } from '../lib/state.js';
import { subscribeToast } from '../lib/toast.js';
import { bloomOpen } from '../lib/motion.js';

// Único suscriptor del pub-sub de lib/toast.js. La función toast() vive allá
// (no acá) para que los módulos de negocio no tengan que importar desde
// components/ — ver el comentario de cabecera de lib/toast.js.
export default function Toast() {
  useStore();   // para saber si hay un sheet abierto — ver más abajo
  const [state, setState] = useState(null); // {msg, actionLabel, onAction} | null
  const [show, setShow] = useState(false);
  const elRef = useRef(null);

  useEffect(() => subscribeToast((next) => {
    if (next.hide) { setShow(false); return; }
    setState(next);
    setShow(true);
  }), []);

  // La transición show/hide ya la maneja styles.css (transform+opacity vía
  // .show). Este bloom-open (WAAPI, mismo lenguaje que Sheet/Notion) es un
  // toque extra al aparecer: un pop sutil de escala que styles.css no hacía.
  useEffect(() => {
    if (show) bloomOpen(elRef.current);
  }, [show]);

  return (
    // Con un sheet abierto el toast se va arriba: el panel llega hasta 88dvh y
    // el toast, que va por encima (z-index 70 vs 60), le tapaba los botones.
    // role="status" + aria-live: sin esto el toast es puramente visual — cada
    // "Serie registrada", "Ejercicio completo" o error de validación aparece y
    // desaparece sin que un lector de pantalla lo anuncie nunca (WCAG 4.1.3).
    // "polite" y no "assertive": son confirmaciones y avisos de baja urgencia,
    // no interrumpen lo que el lector esté leyendo en ese momento.
    <div id="toast" ref={elRef} role="status" aria-live="polite" className={`${show ? 'show' : ''}${S.sheet ? ' over-sheet' : ''}`}>
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
