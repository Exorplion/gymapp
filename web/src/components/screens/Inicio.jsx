// La portada.
//
// Antes la app abría en "Hoy", que es una pila de tarjetas que se scrollea:
// útil, y un feed. No había un momento en que mirases la app y te dieran ganas
// de ir al gimnasio.
//
// Se organiza como un panel de mando (grid asimétrico, no una lista): arriba
// el estado del día entero de ancho; abajo una tarjeta grande con un
// vistazo del cuerpo —toca para abrirlo entero, con lugar de sobra, en vez
// de pelear espacio con el resto de la portada— y dos tarjetas chicas con la
// racha y el grupo más flojo. Nada de esto imita ningún diseño de
// referencia: el vistazo del cuerpo es un dibujo propio (Silhouette,
// lib/bodydata.js) y el grid usa la tipografía condensada e itálica y los
// degradados cian/azul que ya son de Fierro.
import { S, useStore, bump, openSheet } from '../../lib/state.js';
import { WDS, MO } from '../../lib/format.js';
import { pendingSlot, sessionForSlot } from '../../lib/session.js';
import { daysSinceAll, stalestGroups } from '../../lib/muscle.js';
import { currentStreak } from '../../lib/streak.js';
import Silhouette from '../Silhouette.jsx';

export default function Inicio() {
  useStore();
  const hoy = new Date();
  const slot = pendingSlot();
  const hecha = slot ? sessionForSlot(slot.id) : null;
  const draft = S.draft;
  const enCurso = !!draft;

  const dias = daysSinceAll();
  const viejos = stalestGroups();
  const racha = currentStreak();
  // La fecha es puramente informativa acá — ubica al usuario en el
  // calendario, pero no decide qué turno toca (eso lo resuelve la
  // secuencia, no el día de la semana). El detalle del turno — nombre,
  // ejercicios, series, minutos estimados — vive en Hoy; acá sólo se
  // avisa el estado para no duplicar esa tarjeta.
  const fecha = `${WDS[hoy.getDay()]} ${hoy.getDate()} ${MO[hoy.getMonth()]}`;

  const irAHoy = () => { S.tab = 'hoy'; bump(); };

  // Los cuatro estados de la misma pantalla. Cambia el texto y el botón de
  // la tarjeta de arriba — el grid de abajo (cuerpo, racha, grupo flojo) es
  // siempre el mismo, porque esos tres datos no dependen de si hoy toca
  // entrenar o no.
  let eyebrow, titulo, sub, cta;
  if (enCurso) {
    const hechos = Object.values(draft.entries).filter(e => e.sets.length).length;
    const turnoDraft = S.routine.find(s => s.id === draft.slotId);
    const total = (turnoDraft?.exercises || []).length;
    eyebrow = 'Sesión en curso';
    titulo = 'Entrenando';
    sub = `${hechos} de ${total} ejercicios registrados`;
    cta = (
      <button type="button" className="ini-cta pulse" onClick={irAHoy}>
        SEGUIR<small>{hechos} de {total}</small>
      </button>
    );
  } else if (hecha) {
    eyebrow = 'Completado · hoy';
    titulo = 'Listo por hoy';
    sub = `${hecha.duration} min · ${(hecha.entries || []).length} ejercicios`;
    cta = (
      <button type="button" className="ini-cta ok" onClick={() => openSheet('session-view', { id: hecha.id })}>
        VER LO QUE HICISTE
      </button>
    );
  } else if (slot?.type === 'workout' && slot.exercises?.length) {
    eyebrow = fecha;
    titulo = 'Toca entrenar';
    sub = 'Vas por tu racha';
    cta = <button type="button" className="ini-cta" onClick={irAHoy}>IR A HOY</button>;
  } else {
    const hayRutina = S.routine.some(s => s.type === 'workout' && s.exercises?.length);
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

      {cta}

      <div className="ini-grid">
        <BodyTile dias={dias} viejos={viejos} />
        <RachaTile racha={racha} />
        <StaleTile grupos={viejos} dias={dias} />
      </div>
    </div>
  );
}

/** La tarjeta grande: un vistazo quieto del cuerpo (Silhouette en modo no
    interactivo, el mismo que usa el resumen de fin de sesión) que abre el
    mapa completo al tocar. No es un botón con texto porque el propio
    dibujo ya dice de qué se trata — un ícono nunca va a explicar esto mejor
    que el cuerpo real coloreado. */
function BodyTile({ dias, viejos }) {
  return (
    <button type="button" className="ini-tile ini-tile-body" onClick={() => openSheet('body-map')}>
      <div className="ini-tile-lbl">Tu cuerpo<span className="ini-tile-go">Ver mapa ›</span></div>
      <div className="ini-tile-thumb"><Silhouette days={dias} interactivo={false} /></div>
      {viejos.length > 0 && <div className="ini-tile-hint">Hace tiempo no entrenás {viejos[0]}</div>}
    </button>
  );
}

function RachaTile({ racha }) {
  return (
    <div className="ini-tile ini-tile-racha">
      <div className="ini-tile-lbl">Racha</div>
      <div className="ini-tile-num">{racha}<small>{racha === 1 ? 'día' : 'días'}</small></div>
    </div>
  );
}

/** El grupo más olvidado, con sus días reales. Nombra como mucho dos.

    `stalestGroups` los devuelve del más viejo al más nuevo, así que los días
    que se muestran son los del primero — el peor caso. */
function StaleTile({ grupos, dias }) {
  if (!grupos.length) return <div className="ini-tile ini-tile-stale ini-tile-ok">Todo entrenado esta semana</div>;
  const top = grupos.slice(0, 2);
  const d = dias[top[0]];
  return (
    <div className="ini-tile ini-tile-stale">
      <div className="ini-tile-lbl">Más flojo</div>
      <div className="ini-tile-stale-name">{top.join(' y ')}</div>
      <div className="ini-tile-stale-days">hace {d} día{d === 1 ? '' : 's'}</div>
    </div>
  );
}
