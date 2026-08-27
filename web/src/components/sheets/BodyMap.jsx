// Sheet "Tu cuerpo": el mapa muscular completo e interactivo, movido acá
// desde Inicio para que Inicio pueda ser un grid de tarjetas sin perder el
// modelo — se abre en grande, con lugar de sobra, en vez de competir por
// espacio con el resto de la portada.
import { daysSinceAll, stalestGroups } from '../../lib/muscle.js';
import Silhouette from '../Silhouette.jsx';

export default function BodyMap() {
  const dias = daysSinceAll();
  const viejos = stalestGroups();

  return (
    <div className="bodymap-sheet">
      <h2>Tu cuerpo</h2>
      <div className="sheet-sub">Tocá un músculo para ver cuándo lo entrenaste.</div>

      <div className="bodymap-stage">
        <Silhouette days={dias} />
      </div>

      <div className="ini-legend">
        <span><i className="sw sil-sw0"></i>ayer</span>
        <span><i className="sw sil-sw1"></i>2-3 d</span>
        <span><i className="sw sil-sw2"></i>4-6 d</span>
        <span><i className="sw sil-sw3"></i>7+ d</span>
      </div>

      {viejos.length > 0 && <StaleLine grupos={viejos} dias={dias} />}
    </div>
  );
}

function StaleLine({ grupos, dias }) {
  const top = grupos.slice(0, 2);
  const d = dias[top[0]];
  return (
    <div className="ini-stale">
      ⌁ {top.join(' y ')} hace {d} día{d === 1 ? '' : 's'}
    </div>
  );
}
