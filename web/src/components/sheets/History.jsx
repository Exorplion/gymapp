import { S, openSheet } from '../../lib/state.js';
import { WD, WDS, fmtD } from '../../lib/format.js';

// En el mockup el historial no vive dentro de la pantalla Hoy: sale del
// reloj del header como sheet propio. Hoy queda terminando en la tarjeta de
// músculos, que es como se ve en el rediseño.
//
// Cada fila lleva una insignia con el día de la semana — es lo que deja
// reconocer el patrón de la semana de un vistazo sin leer las fechas.
export default function History() {
  const hist = S.sessions.slice(0, 12);

  return (
    <>
      <h2 className="sheet-title">Historial</h2>
      <div className="txt-mut" style={{ fontSize: 13, marginTop: 2, marginBottom: 14 }}>
        {hist.length
          ? `Últimas ${hist.length} sesiones cerradas`
          : 'Todavía no cerraste ninguna sesión'}
      </div>

      {!hist.length ? (
        <div className="card"><div className="empty" style={{ padding: 18 }}>
          <p style={{ margin: 0 }}>Tus sesiones completadas aparecerán acá.</p>
        </div></div>
      ) : (
        <div className="hist-list">
          {hist.map(s => {
            const nsets = (s.entries || []).reduce((a, e) => a + e.sets.length, 0);
            return (
              <button
                key={s.id}
                type="button"
                className="hist-row"
                onClick={() => openSheet('hist-detail', { id: s.id })}
              >
                <span className="hist-badge">{WDS[s.weekday]}</span>
                <span className="grow">
                  <span className="t">{s.dayName || WD[s.weekday]}</span>
                  <span className="s">{fmtD(s.date)} · {s.duration} min · {nsets} series</span>
                </span>
                <span className="chev">›</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
