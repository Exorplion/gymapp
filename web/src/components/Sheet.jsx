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
import { useEffect, useRef, useState } from 'react';
import { bloomOpen } from '../lib/motion.js';

const FOCUSABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CIERRE_MS = 220; // mismo tiempo que .panel usa para abrir (shup .22s)

export default function Sheet({ open, onClose, children }) {
  const panelRef = useRef(null);
  const previoRef = useRef(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const abiertoAntes = useRef(open);

  /* Antes de cerrar de golpe, quien nos llama ya puso S.sheet=null — así
     que `children` en este mismo render ya es null (SheetContent con
     sheet=null devuelve null). Si mostráramos ESO durante el cierre, el
     panel se vería vacío deslizándose, no el contenido real desapareciendo.
     Por eso se guarda el último contenido real mientras open era true, y
     ESO es lo que se pinta durante la animación de cierre. */
  const childrenRef = useRef(children);
  if (open) childrenRef.current = children;

  /* mostrando = todavía hay algo que pintar (abierto de verdad, o cerrando
     con la animación en curso). closing sólo se prende en la transición
     true->false, nunca de entrada (si open ya arranca en false no hay nada
     que animar). */
  useEffect(() => {
    if (open) {
      clearTimeout(closeTimer.current);
      setClosing(false);
      // Bloom-open (WAAPI) sobre el .panel, encima de la transición CSS
      // (shup .22s) que ya hace styles.css — mismo lenguaje que Notion al
      // abrir una página. No reemplaza el open/closing de CSS: sólo agrega
      // un pop de escala+fade que ese slide no tenía.
      bloomOpen(panelRef.current);
      abiertoAntes.current = true;
      return;
    }
    if (!abiertoAntes.current) return;
    abiertoAntes.current = false;
    setClosing(true);
    closeTimer.current = setTimeout(() => setClosing(false), CIERRE_MS);
    return () => clearTimeout(closeTimer.current);
  }, [open]);

  const mostrando = open || closing;

  /* Nombre accesible del diálogo.

     Los 27 sheets ya pintan su propio <h2> ("Ajustes", "Reordenar", "Elegir
     número exacto"…), pero el role="dialog" no estaba enlazado a ninguno: un
     lector de pantalla anunciaba "diálogo" a secas, 27 veces distintas, sin
     decir cuál. Enlazarlo acá y no sheet por sheet es a propósito — son 27
     archivos y el próximo que se agregue lo hereda solo, en vez de depender
     de que alguien se acuerde.

     Se le pone el id al encabezado que YA existe en vez de pasar un título
     por props: el texto visible y el anunciado quedan siendo el mismo string
     por construcción, así que no pueden desincronizarse.

     Si un sheet no tiene encabezado, `etiqueta` queda en false y el panel no
     lleva aria-labelledby: un aria-labelledby que apunta a la nada deja el
     diálogo SIN nombre, que es peor que no ponerlo — el navegador no cae al
     contenido, cae al vacío. */
  const [etiqueta, setEtiqueta] = useState(false);
  useEffect(() => {
    if (!mostrando) { setEtiqueta(false); return; }
    const h = panelRef.current?.querySelector('#sheet-c h1, #sheet-c h2, #sheet-c h3');
    if (h) { h.id = 'sheet-title'; setEtiqueta(true); }
    else setEtiqueta(false);
    // Depende de `children` (la prop) y no de childrenRef.current: mutar un
    // ref no vuelve a renderizar, así que como dependencia no dispara nada —
    // sería una dependencia decorativa. Durante el cierre `children` ya es
    // null, pero para entonces la etiqueta ya está puesta y el panel se está
    // yendo igual.
  }, [mostrando, children]);

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
    <div id="sheet" className={mostrando ? (closing ? 'open closing' : 'open') : ''}>
      <div className="bk" onClick={onClose}></div>
      <div
        className="panel"
        ref={panelRef}
        role="dialog"
        aria-modal={open || undefined}
        aria-labelledby={etiqueta ? 'sheet-title' : undefined}
      >
        <div className="handle"></div>
        <div id="sheet-c">{mostrando ? childrenRef.current : null}</div>
      </div>
    </div>
  );
}
