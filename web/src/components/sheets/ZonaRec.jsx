// Detalle de la recuperación de una zona, al tocarla en el Inicio
// (2026-10-01). Dice el número, cuándo llega al 100 %, qué la cargó y —sin
// letra chica— que es una estimación.
import { S } from '../../lib/state.js';
import { recuperacion, cuandoLista } from '../../lib/recuperacion.js';
import { nombreZona } from '../../lib/inicio.js';

const rirTexto = rir => (rir == null ? null : rir < 0.5 ? 'al fallo' : `RIR ${Math.round(rir) >= 4 ? '4+' : Math.round(rir)}`);

export default function ZonaRec({ zona }) {
  const r = recuperacion(S.sessions)[zona];
  if (!r) {
    return (
      <>
        <h2>{nombreZona(zona)}</h2>
        <p className="ptext">Todavía no registraste ningún ejercicio para esta zona.</p>
      </>
    );
  }
  return (
    <div className="zona-rec">
      <h2>{nombreZona(zona)}</h2>
      <div className="zona-rec-cifra">
        <b className={r.estado}>{r.pct}%</b>
        <span>de recuperación{r.pct < 100 ? `, ${cuandoLista(r.listaEn)}` : ''}</span>
      </div>
      <div className="zona-rec-caja">
        <div className="zona-rec-k">Lo que hiciste</div>
        {r.ejercicios.map((e, i) => (
          <div className="zona-rec-ex" key={i}>
            <span>{e.name}</span>
            <span>{e.series} {e.series === 1 ? 'serie' : 'series'}{rirTexto(e.rir) ? `, ${rirTexto(e.rir)}` : ''}</span>
          </div>
        ))}
        <div className="zona-rec-k sm">{r.dayName ? `${r.dayName}, ` : ''}{new Date(r.date + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </div>
      <p className="ptext sm">
        Es una estimación: cuenta las horas desde tu última serie, cuántas series hiciste y qué tan cerca del fallo
        quedaste (el RIR que contestás en el descanso). No mide tu cuerpo: si lo sentís cargado, hacele caso a eso.
      </p>
    </div>
  );
}
