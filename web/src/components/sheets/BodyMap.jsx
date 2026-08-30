// Sheet "Tu cuerpo": el mapa muscular completo e interactivo, movido acá
// desde Inicio para que Inicio pueda ser un grid de tarjetas sin perder el
// modelo — se abre en grande, con lugar de sobra, en vez de competir por
// espacio con el resto de la portada.
//
// La tarjeta de volumen semanal por grupo ("Músculos esta semana") se mudó
// acá desde Hoy.jsx: es un dato sobre TU CUERPO en la semana, no sobre el
// turno de hoy en particular — este sheet es su lugar natural, junto al
// mapa de recuperación con el que ya comparte los mismos nueve grupos.
import { S, closeSheet, changeTab } from '../../lib/state.js';
import { daysSinceAll, stalestGroups, muscleVolume, uncategorized } from '../../lib/muscle.js';
import Silhouette from '../Silhouette.jsx';

export default function BodyMap() {
  const dias = daysSinceAll();
  const viejos = stalestGroups();
  const mv = muscleVolume(7);
  const mvCats = Object.entries(mv).sort((a, b) => b[1] - a[1]);
  const maxv = mvCats.length ? mvCats[0][1] : 0;

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

      {mvCats.length > 0 && (
        <>
          <h3 style={{ marginTop: 22 }}>Músculos esta semana</h3>
          {mvCats.map(([c, n]) => (
            <div key={c} style={{ marginBottom: 'var(--s2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-sm)', marginBottom: 3 }}>
                <span>{c}</span><span className="num">{n} series</span>
              </div>
              <div className="pbar">
                <i style={{ width: `${Math.round(n / maxv * 100)}%`, animation: 'rise .5s var(--ease) backwards' }}></i>
              </div>
            </div>
          ))}
          <div className="ptext sm" style={{ marginTop: 12 }}>
            10–20 series semanales por grupo es el rango habitual para ganar masa.
          </div>
          <SinGrupoAviso />
        </>
      )}
    </div>
  );
}

/** Los ejercicios sin grupo muscular no suman en la tarjeta de arriba. Antes
    se descartaban en silencio, así que el resumen se veía completo cuando no
    lo estaba. Ahora se dicen y se pueden asignar. */
function SinGrupoAviso() {
  const sin = uncategorized();
  if (!sin.length) return null;
  return (
    <button
      type="button"
      className="sin-grupo"
      onClick={() => { closeSheet(); changeTab('rutina', () => { S.rutMode = 'edit'; }); }}
    >
      <span className="t">
        {sin.length} ejercicio{sin.length === 1 ? '' : 's'} sin grupo muscular · no suma{sin.length === 1 ? '' : 'n'} acá
      </span>
      <span className="s">{sin.slice(0, 4).map(e => e.name).join(' · ')}{sin.length > 4 ? ` +${sin.length - 4}` : ''}</span>
      <span className="a">Asignar →</span>
    </button>
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
