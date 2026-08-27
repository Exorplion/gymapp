// La portada.
//
// Antes la app abría en "Hoy", que es una pila de tarjetas que se scrollea:
// útil, y un feed. No había un momento en que mirases la app y te dieran ganas
// de ir al gimnasio.
//
// Se organiza como un panel de mando (grid asimétrico, no una lista): arriba
// una tira con los turnos de la secuencia y la tarjeta de estado del día
// (con el NOMBRE real del turno, no un genérico "toca entrenar"); abajo un
// grid con el vistazo del cuerpo, la racha, el grupo más flojo, las calorías
// de hoy y el último peso registrado. Nada de esto imita ningún diseño de
// referencia: el vistazo del cuerpo es un dibujo propio (Silhouette,
// lib/bodydata.js) y el grid usa la tipografía condensada e itálica y los
// degradados cian/azul que ya son de Fierro.
//
// La tira de arriba NO es un calendario de días de la semana (como el de
// TRACKED): la rutina de Fierro no vive en casilleros lun-dom, es una
// SECUENCIA de largo variable que avanza sólo cuando entrenás (ver
// rutina-logic.js) — un calendario por fecha mentiría sobre cómo funciona.
// En cambio es la misma tira de turnos que ya usa Rutina.jsx (weekbars),
// reutilizada acá: cada turno es su posición en la secuencia, no un día
// calendario, y tocar cualquiera que no sea "hoy" abre una vista previa
// (mismo sheet 'day-peek' que usa Rutina) sin tocar el puntero real.
import { S, useStore, bump, openSheet } from '../../lib/state.js';
import { WDS, MO, dstr, fmtD } from '../../lib/format.js';
import { pendingSlot, sessionForSlot } from '../../lib/session.js';
import { daysSinceAll, stalestGroups } from '../../lib/muscle.js';
import { currentStreak } from '../../lib/streak.js';
import { mealsOf } from '../../lib/meals.js';
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
  // secuencia, no el día de la semana).
  const fecha = `${WDS[hoy.getDay()]} ${hoy.getDate()} ${MO[hoy.getMonth()]}`;

  const irAHoy = () => { S.tab = 'hoy'; bump(); };

  // Los cuatro estados de la misma pantalla. El título usa el nombre real
  // del turno pendiente —"Anterior A", no "Toca entrenar"— así la tarjeta
  // contesta directo la primera pregunta al abrir la app: ¿cuál me toca?
  let eyebrow, titulo, sub, cta;
  if (enCurso) {
    const hechos = Object.values(draft.entries).filter(e => e.sets.length).length;
    const turnoDraft = S.routine.find(s => s.id === draft.slotId);
    const total = (turnoDraft?.exercises || []).length;
    eyebrow = 'Sesión en curso';
    titulo = turnoDraft?.name || 'Entrenando';
    sub = `${hechos} de ${total} ejercicios registrados`;
    cta = (
      <button type="button" className="ini-cta pulse" onClick={irAHoy}>
        SEGUIR<small>{hechos} de {total}</small>
      </button>
    );
  } else if (hecha) {
    eyebrow = 'Completado · hoy';
    titulo = slot?.name || 'Listo por hoy';
    sub = `${hecha.duration} min · ${(hecha.entries || []).length} ejercicios`;
    cta = (
      <button type="button" className="ini-cta ok" onClick={() => openSheet('session-view', { id: hecha.id })}>
        VER LO QUE HICISTE
      </button>
    );
  } else if (slot?.type === 'workout' && slot.exercises?.length) {
    eyebrow = fecha;
    titulo = slot.name || 'Entrenamiento';
    sub = `${slot.exercises.length} ejercicio${slot.exercises.length === 1 ? '' : 's'} · vas por tu racha`;
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
      {S.routine.length > 1 && <SeqStrip />}

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
        <MacrosTile />
        <WeightTile />
      </div>
    </div>
  );
}

/** La tira de turnos: la misma idea que .weekbars de Rutina.jsx (una barra
    por turno, alta si tiene series) pero de largo variable y tocable. El
    turno de HOY (S.cfg.seqIndex) tiene el anillo encendido; los demás abren
    una vista previa sin mover el puntero — la secuencia sólo avanza
    entrenando de verdad, nunca tocando la tira. */
function SeqStrip() {
  const idx = S.cfg.seqIndex;
  const maxSets = Math.max(1, ...S.routine.map(s => s.type === 'workout' ? (s.exercises || []).reduce((a, e) => a + e.sets, 0) : 0));
  return (
    <div className="ini-strip" role="group" aria-label="Turnos de tu rutina">
      {S.routine.map((slot, i) => {
        const on = slot.type === 'workout' && !!slot.exercises?.length;
        const sets = on ? slot.exercises.reduce((a, e) => a + e.sets, 0) : 0;
        const h = sets ? Math.round(14 + (sets / maxSets) * 18) : 5;
        const hoy = i === idx;
        return (
          <button
            type="button"
            key={slot.id}
            className={`ini-strip-i ${on ? 'on' : ''} ${hoy ? 'hoy' : ''}`}
            onClick={() => hoy ? (S.tab = 'hoy', bump()) : openSheet('day-peek', { wd: i })}
            aria-label={`${on ? (slot.name || 'Turno') : 'Descanso'}${hoy ? ', hoy' : ''}`}
            aria-current={hoy ? 'date' : undefined}
          >
            <span className="b" style={{ height: h }}></span>
            <span className="n">{i + 1}</span>
          </button>
        );
      })}
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

/** Calorías de hoy: mismo dato que la tarjeta hero de Comida (mealsOf +
    S.cfg.goals), resumido a un solo número — el detalle completo (anillo,
    macros por separado) ya vive ahí, acá alcanza con la cifra que importa
    para decidir si conviene comer algo antes de entrenar. */
function MacrosTile() {
  const meals = mealsOf(dstr());
  const kcal = Math.round(meals.reduce((a, m) => a + m.kcal, 0));
  const goal = S.cfg.goals?.kcal || 0;
  if (!goal) {
    return (
      <button type="button" className="ini-tile ini-tile-macros" onClick={() => { S.tab = 'nutri'; bump(); }}>
        <div className="ini-tile-lbl">Calorías</div>
        <div className="ini-tile-hint" style={{ marginTop: 6 }}>Calculá tu objetivo en Comida</div>
      </button>
    );
  }
  const restantes = Math.max(0, goal - kcal);
  return (
    <button type="button" className="ini-tile ini-tile-macros" onClick={() => { S.tab = 'nutri'; bump(); }}>
      <div className="ini-tile-lbl">Calorías</div>
      <div className="ini-tile-num sm">{restantes}<small>kcal restantes</small></div>
      <div className="ini-tile-bar"><i style={{ width: `${Math.min(100, Math.round(kcal / goal * 100))}%` }}></i></div>
    </button>
  );
}

/** Último peso registrado: mismo dato que el hero de Progreso (S.body),
    pero mostrado como último valor y no como serie — acá importa "¿cuándo
    fue la última vez que me pesé?", el gráfico completo ya vive en
    Progreso. */
function WeightTile() {
  const registros = S.body.filter(b => b.weight != null);
  const ultimo = registros[registros.length - 1];
  if (!ultimo) {
    return (
      <button type="button" className="ini-tile ini-tile-weight" onClick={() => { S.tab = 'prog'; bump(); }}>
        <div className="ini-tile-lbl">Peso</div>
        <div className="ini-tile-hint" style={{ marginTop: 6 }}>Todavía no registraste</div>
      </button>
    );
  }
  return (
    <button type="button" className="ini-tile ini-tile-weight" onClick={() => { S.tab = 'prog'; bump(); }}>
      <div className="ini-tile-lbl">Peso</div>
      <div className="ini-tile-num sm">{ultimo.weight}<small>kg</small></div>
      <div className="ini-tile-hint">{ultimo.date === dstr() ? 'hoy' : fmtD(ultimo.date)}</div>
    </button>
  );
}
