// La portada.
//
// Antes la app abría en "Hoy", que es una pila de tarjetas que se scrollea:
// útil, y un feed. No había un momento en que mirases la app y te dieran ganas
// de ir al gimnasio.
//
// Acá el héroe es tu cuerpo: dos siluetas con cada grupo coloreado según hace
// cuántos días lo entrenaste. Se enciende cuando entrenás y se apaga sola.
//
// Todo entra sin scroll — por eso la silueta es flex:1 y se encoge antes que
// el resto. "Hoy" pasa a ser adonde te lleva el botón grande.
import { S, useStore, bump, openSheet } from '../../lib/state.js';
import { WD, WD1, WDS, MO, WEEK_ORDER } from '../../lib/format.js';
import { orderedExs, sessionForWeekday } from '../../lib/session.js';
import { daysSinceAll, stalestGroups } from '../../lib/muscle.js';
import Silhouette from '../Silhouette.jsx';

export default function Inicio() {
  useStore();
  const hoy = new Date();
  const wd = hoy.getDay();
  const day = S.routine[wd];
  const exs = orderedExs(wd, day?.exercises || []);
  const hecha = sessionForWeekday(wd);
  const draft = S.draft;
  const enCurso = !!draft;

  const dias = daysSinceAll();
  const viejos = stalestGroups();
  const totalSets = exs.reduce((a, e) => a + e.sets, 0);
  const estMin = Math.round(totalSets * ((S.cfg.rest || 90) + 40) / 60);
  const fecha = `${WDS[wd]} ${hoy.getDate()} ${MO[hoy.getMonth()]}`;

  const irAHoy = () => { S.tab = 'hoy'; S.hoyDay = null; bump(); };

  // Los cuatro estados de la misma pantalla. Cambia el texto y el botón, no la
  // forma: la silueta sigue siendo el héroe en todos.
  let eyebrow, titulo, sub, cta;
  if (enCurso) {
    const hechos = Object.values(draft.entries).filter(e => e.sets.length).length;
    const total = orderedExs(draft.weekday, S.routine[draft.weekday]?.exercises || []).length;
    eyebrow = 'Sesión en curso';
    titulo = draft.dayName || WD[draft.weekday];
    sub = `${hechos} de ${total} ejercicios registrados`;
    cta = (
      <button type="button" className="ini-cta pulse" onClick={irAHoy}>
        SEGUIR<small>{hechos} de {total}</small>
      </button>
    );
  } else if (hecha) {
    eyebrow = 'Completado · hoy';
    titulo = hecha.dayName || WD[wd];
    sub = `${hecha.duration} min · ${(hecha.entries || []).length} ejercicios`;
    cta = (
      <button type="button" className="ini-cta ok" onClick={() => openSheet('session-view', { id: hecha.id })}>
        VER LO QUE HICISTE
      </button>
    );
  } else if (exs.length) {
    eyebrow = `${fecha} · toca hoy`;
    titulo = day.name || WD[wd];
    sub = `${exs.length} ejercicios · ${totalSets} series · ~${estMin} min`;
    cta = (
      <button type="button" className="ini-cta" onClick={irAHoy}>
        EMPEZAR<small>{exs.length} ej · ~{estMin} min</small>
      </button>
    );
  } else {
    const hayRutina = WEEK_ORDER.some(d => S.routine[d]?.exercises?.length);
    eyebrow = fecha;
    titulo = hayRutina ? 'Descanso' : 'Sin rutina';
    sub = hayRutina ? 'Hoy no toca entrenar' : 'Armá tu split para empezar';
    cta = hayRutina
      ? <button type="button" className="ini-cta dim" onClick={irAHoy}>ENTRENAR IGUAL</button>
      : <button type="button" className="ini-cta" onClick={() => { S.tab = 'rutina'; bump(); }}>ARMAR MI RUTINA</button>;
  }

  return (
    <div className="inicio">
      <div className="ini-top">
        <div className="ini-eyebrow">{eyebrow}</div>
        <div className="ini-title">{titulo}</div>
        <div className="ini-sub">{sub}</div>
      </div>

      <Silhouette days={dias} />

      <div className="ini-legend">
        <span><i className="sw sil-sw0"></i>ayer</span>
        <span><i className="sw sil-sw1"></i>2-3 d</span>
        <span><i className="sw sil-sw2"></i>4-6 d</span>
        <span><i className="sw sil-sw3"></i>7+ d</span>
      </div>

      {/* Una sola línea nombra el grupo más olvidado. Con nueve grupos,
          nombrarlos todos sería una lista; nombrar el peor es un consejo. */}
      {viejos.length > 0 && <StaleLine grupos={viejos} dias={dias} />}

      {cta}

      <div className="wkstrip ini-wk">
        {WEEK_ORDER.map(d => {
          const dd = S.routine[d];
          const has = dd?.exercises?.length;
          const listo = !!has && !!sessionForWeekday(d);
          return (
            <button
              key={d}
              type="button"
              className={`wd ${has ? 'has' : ''} ${d === wd ? 'today on' : ''} ${listo ? 'done' : ''}`}
              aria-current={d === wd ? 'date' : undefined}
              onClick={() => { S.hoyDay = d; S.tab = 'hoy'; bump(); }}
            >
              <div className="l">{WD1[d]}</div>
              <div className="n">{has ? (dd.name || 'Rutina') : 'Descanso'}</div>
              {listo && <div className="tick">✓</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Los grupos más olvidados, con sus días reales. Nombra como mucho dos.

    `stalestGroups` los devuelve del más viejo al más nuevo, así que los días
    que se muestran son los del primero — el peor caso. */
function StaleLine({ grupos, dias }) {
  const top = grupos.slice(0, 2);
  const d = dias[top[0]];
  return (
    <div className="ini-stale">
      ⌁ {top.join(' y ')} hace {d} día{d === 1 ? '' : 's'}
    </div>
  );
}
