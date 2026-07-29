// Puerto de <div id="sheet"> (index.html ~línea 710) + openSheet()/closeSheet()
// (~línea 2949). El original guarda un único string de HTML en #sheet-c;
// acá el contenido son children de React (lo decide quien use <Sheet/>), y
// el estado "qué sheet está abierto" vive en S.sheet — ver state.js: un solo
// campo `{type, props} | null` alcanza porque, igual que en el original, sólo
// hay un sheet abierto a la vez en toda la app.
export default function Sheet({ open, onClose, children }) {
  return (
    <div id="sheet" className={open ? 'open' : ''}>
      <div className="bk" onClick={onClose}></div>
      <div className="panel">
        <div className="handle"></div>
        <div id="sheet-c">{children}</div>
      </div>
    </div>
  );
}
