// El calentamiento antes de la primera serie de cada bloque muscular del día.
//
// Aparece al empezar el bloque y desaparece en cuanto registrás algo de él: es
// un recordatorio para un momento puntual, no una tarjeta más de la pantalla.
//
// Dos partes, en orden: primero movilidad general del bloque (nada que
// levantar, nada que registrar), después la rampa numérica de ESTE ejercicio.
// La rampa calienta el patrón y el peso; la movilidad calienta la
// articulación entera, que es lo que hace falta de más al entrar en frío a
// piernas después de una hora de tren superior.
//
// Muestra los pesos ya calculados en vez del porcentaje. "50%" te obliga a
// hacer la cuenta parado frente a la barra; "42.5 kg × 5" se carga y se levanta.
// El porcentaje va igual, chiquito, para el que quiera ver de dónde sale.
import { S, wDisplay, wStep } from '../lib/state.js';
import { warmupSets, MOVILIDAD, DESCANSO, bloqueDe } from '../lib/warmup.js';
import { lastDataFor } from '../lib/session.js';
import { fmtMMSS } from '../lib/format.js';

export default function WarmupCard({ ex, onListo, onSaltar }) {
  /* El peso de trabajo sale de lo que tengas cargado hoy y, si todavía no
     tocaste nada, de la última vez que lo hiciste.

     No se usa ensureVals() —que sería lo obvio— porque esa función RELLENA
     S.hoyVals con 20 kg cuando no hay historial, y calcular una rampa sobre un
     relleno daría tres pesos inventados con toda la pinta de ser reales. */
  const top = S.hoyVals[ex.id]?.w ?? lastDataFor(ex)?.at(-1)?.w;
  // el paso sale de la unidad activa: en libras el incremento real es otro
  const series = warmupSets(top, wStep());
  const movilidad = MOVILIDAD[bloqueDe(ex)] || [];

  // Sin peso de trabajo no hay porcentaje que calcular. Es el caso de un
  // ejercicio estrenado hoy: mejor no mostrar nada que mostrar tres ceros.
  // La movilidad sola, sin ninguna rampa debajo, no sería un calentamiento —
  // sería una lista suelta sin conexión con lo que vas a levantar.
  if (!series.length) return null;

  return (
    <div className="warmup">
      <div className="warmup-top">
        <span className="eyebrow">Calentamiento · {ex.name}</span>
        <button type="button" className="warmup-skip" onClick={onSaltar}>Saltar</button>
      </div>

      {movilidad.length > 0 && (
        <ul className="warmup-mov">
          {movilidad.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}

      <ol className="warmup-list">
        {series.map((s, i) => (
          <li key={i}>
            <span className="n">{i + 1}</span>
            <span className="w">{wDisplay(s.w)}<i>{S.cfg.unit}</i></span>
            <span className="x">× {s.reps}</span>
            <span className="p">{Math.round(s.pct * 100)}%</span>
          </li>
        ))}
      </ol>

      <p className="warmup-nota">
        Las tres seguidas, sin descanso. Después <b>{fmtMMSS(DESCANSO)}</b> y vas a tu primera serie.
      </p>

      <button type="button" className="btn sm" onClick={onListo}>
        Listo · arrancar el descanso
      </button>
    </div>
  );
}
