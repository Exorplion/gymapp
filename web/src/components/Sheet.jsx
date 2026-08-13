// Puerto de <div id="sheet"> (index.html ~línea 710) + openSheet()/closeSheet()
// (~línea 2949). El original guarda un único string de HTML en #sheet-c;
// acá el contenido son children de React (lo decide quien use <Sheet/>), y
// el estado "qué sheet está abierto" vive en S.sheet — ver state.js: un solo
// campo `{type, props} | null` alcanza porque, igual que en el original, sólo
// hay un sheet abierto a la vez en toda la app.
//
// Es un modal de verdad para quien navega con teclado o lector de pantalla:
// Escape cierra, Tab no se escapa hacia la página de atrás (que además queda
// oculta con display:none — ver styles.css — así que "escaparse" la dejaría
// en un foco muerto, ni visible ni anunciado), y al cerrar el foco vuelve a
// lo que lo abrió en vez de perderse en <body>.
import { useEffect, useRef } from 'react';

const FOCUSABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Sheet({ open, onClose, children }) {
  const panelRef = useRef(null);
  const previoRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    previoRef.current = document.activeElement;

    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      const focusables = panel ? [...panel.querySelectorAll(FOCUSABLES)] : [];
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      // Si el foco está fuera del panel (nunca debería, pero puede pasar si
      // algo lo movió a mano) lo trae adentro en vez de dejarlo perdido.
      if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Vuelve a quien lo abrió — un botón "⇄ Cambiar", el ícono de
      // Ajustes — si ese elemento sigue en la página. Sin esto el foco cae a
      // <body> y quien navega con teclado pierde el lugar por completo.
      if (previoRef.current && document.contains(previoRef.current)) previoRef.current.focus();
    };
  }, [open, onClose]);

  return (
    <div id="sheet" className={open ? 'open' : ''}>
      <div className="bk" onClick={onClose}></div>
      <div className="panel" ref={panelRef} role="dialog" aria-modal={open || undefined}>
        <div className="handle"></div>
        <div id="sheet-c">{children}</div>
      </div>
    </div>
  );
}
