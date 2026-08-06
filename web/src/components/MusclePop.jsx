// El globo que sale al tocar un músculo en Inicio.
//
// Sale pegado al músculo que tocaste y no como hoja desde abajo: la pregunta
// que estás haciendo es "¿y este de acá?", y una hoja que tapa media pantalla
// te hace perder de vista el cuerpo justo cuando lo estás mirando.
//
// Muestra hechos medidos y ninguna recomendación. La app sabe cuántas series
// hiciste; no sabe si son pocas.
import { diasTexto } from '../lib/muscle.js';

/** Volumen en kg, corto: 12.4k en vez de 12380. */
function kilos(v) {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)}k`;
  return String(v);
}

export default function MusclePop({ stats, pos, onClose }) {
  const { cat, dias, sets, sesiones, porSemana, volumen, mejor, top, ventana } = stats;
  const nunca = dias === null;

  return (
    <div
      className={`mpop ${pos.arriba ? 'arriba' : 'abajo'}`}
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      role="dialog"
      aria-label={`Estadísticas de ${cat}`}
    >
      <div className="mpop-head">
        <span className="mpop-name">{cat}</span>
        <span className={`mpop-when t${dias === null ? 'n' : dias <= 1 ? '0' : dias <= 3 ? '1' : dias <= 6 ? '2' : '3'}`}>
          {diasTexto(dias)}
        </span>
        <button type="button" className="mpop-x" onClick={onClose} aria-label="Cerrar">×</button>
      </div>

      {nunca && sets === 0 ? (
        <p className="mpop-vacio">Todavía no registraste nada de este grupo.</p>
      ) : (
        <>
          <div className="mpop-nums">
            <div><b>{sets}</b><span>series</span></div>
            <div><b>{sesiones}</b><span>sesiones</span></div>
            <div><b>{porSemana}</b><span>por sem.</span></div>
          </div>

          {top.length > 0 && (
            <ul className="mpop-list">
              {top.map(t => (
                <li key={t.name}><span>{t.name}</span><b>{t.sets}</b></li>
              ))}
            </ul>
          )}

          <div className="mpop-pie">
            {mejor && mejor.w > 0 && <span className="mpop-top">Tope {mejor.w} kg × {mejor.r}</span>}
            {volumen > 0 && <span>{kilos(volumen)} kg movidos</span>}
          </div>
        </>
      )}

      <div className="mpop-cap">últimos {ventana} días</div>
    </div>
  );
}
