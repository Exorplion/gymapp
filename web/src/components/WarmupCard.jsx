// El calentamiento antes de la primera serie del día.
//
// Aparece al abrir la sesión y desaparece en cuanto registrás algo: es un
// recordatorio para un momento puntual, no una tarjeta más de la pantalla.
//
// Muestra los pesos ya calculados en vez del porcentaje. "50%" te obliga a
// hacer la cuenta parado frente a la barra; "42.5 kg × 5" se carga y se levanta.
// El porcentaje va igual, chiquito, para el que quiera ver de dónde sale.
import { S, wDisplay, wStep } from '../lib/state.js';
import { warmupSets, DESCANSO } from '../lib/warmup.js';
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

  // Sin peso de trabajo no hay porcentaje que calcular. Es el caso de un
  // ejercicio estrenado hoy: mejor no mostrar nada que mostrar tres ceros.
  if (!series.length) return null;

  return (
    <div className="warmup">
      <div className="warmup-top">
        <span className="eyebrow">Calentamiento · {ex.name}</span>
        <button type="button" className="warmup-skip" onClick={onSaltar}>Saltar</button>
      </div>

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
