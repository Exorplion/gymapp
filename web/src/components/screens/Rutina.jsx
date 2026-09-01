// Puerto de renderRutina() (index.html) — pantalla Rutina completa: resumen
// de la secuencia (modo "view") y editor turno por turno (modo "edit"), según
// S.rutMode. Sigue el mismo mecanismo de sheets de Task 1/5 (S.sheet vía
// openSheet/closeSheet, ver state.js) y el mismo drag-to-reorder de Task 3/4
// (data-sort/data-sid, ver drag.js) para la secuencia de turnos (kind="seq")
// y ejercicios dentro de un turno (kind="rut" — el mismo string que usaba el
// original y que commitSort() ya distingue de "hoy"/"seq").
//
// Task 9 (rutina-por-secuencia): la rutina dejó de ser 7 casilleros fijos por
// weekday (S.routine[wd]) y pasó a ser una secuencia ordenada de largo
// variable (S.routine[i]), así que ni la vista ni el editor recorren
// WEEK_ORDER — recorren S.routine directo, y cada turno se identifica por su
// posición (i) en vez de por el día de la semana que le tocaba.
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { S, bump, useStore, openSheet } from '../../lib/state.js';
import { staggerReveal } from '../../lib/motion.js';
import { exInfo, rirScheme } from '../../lib/exdb.js';
import { equipLabel } from '../../lib/equip.js';
import { catOf } from '../../lib/muscle.js';
import { gymEquipFor } from '../../lib/gyms.js';
import { flipSort } from '../../lib/drag.js';
import {
  routineStats, routineName,
  enterEditMode, exitEditMode, toggleSlotOpen, addWorkoutDay, removeWorkoutDay, weekdayProjection,
  deleteExercise, moveEx,
} from '../../lib/rutina-logic.js';
import { toast } from '../../lib/toast.js';
import { iconOf } from '../../lib/exicon.js';
import ExIcon from '../ExIcon.jsx';
import { Info } from '../Icon.jsx';
import { RutinaVacia } from '../Illustration.jsx';

/** Puerto del guard de sheetLibSave() (index.html): "No hay rutina que
    guardar" si S.routine no tiene ningún turno con ejercicios. En el original
    este chequeo vive DENTRO de sheetLibSave, así que es el único punto de
    entrada al formulario de guardado — acá el editor tiene un segundo punto
    de entrada (el botón "Guardar como…" de la barra de edición, además del
    de Library.jsx en modo lista), así que el guard se repite acá para que
    ningún camino hacia el sheet 'library'/{mode:'save'} se lo salte. */
function openLibSaveSheet() {
  if (!routineStats().workoutCount) { toast('No hay rutina que guardar'); return; }
  openSheet('library', { mode: 'save' });
}

/** Envuelve moveEx (↑/↓) con la animación FLIP del original (flipSort mide
    el DOM antes/después de la mutación). moveEx() en sí NO llama bump() —
    el flushSync de acá es lo que fuerza el re-render sincrónico que flipSort
    necesita para medir la posición "after" correctamente; sin esto React
    podría no haber pintado todavía cuando flipSort mide, y la animación no
    se vería (aunque el reordenamiento en sí seguiría siendo correcto). */
async function handleMoveEx(index, exId, dir) {
  await moveEx(index, exId, dir);
  flipSort(() => flushSync(() => bump()));
}

export default function Rutina() {
  useStore();
  if (S.rutMode === 'edit') return <RutinaEdit />;
  return (
    <>
      <div className="vtitle"><h1>Rutina</h1><span className="sub">{S.rutTab === 'ejercicios' ? 'tus ejercicios' : 'tu semana'}</span></div>
      <div className="seg" style={{ margin: 'var(--s2) 0 var(--s3)' }}>
        <button type="button" className={S.rutTab !== 'ejercicios' ? 'on' : ''} onClick={() => { S.rutTab = 'semana'; bump(); }}>Mi semana</button>
        <button type="button" className={S.rutTab === 'ejercicios' ? 'on' : ''} onClick={() => { S.rutTab = 'ejercicios'; bump(); }}>Mis ejercicios</button>
      </div>
      {S.rutTab === 'ejercicios' ? <MisEjercicios /> : <RutinaView />}
    </>
  );
}

/** Cada ejercicio distinto que aparece en tu rutina, una sola vez —el mismo
    lugar de siempre para ver/editar qué trabaja (ex-info) y, si tenés un
    gimnasio activo (lib/gyms.js), con qué equipo lo hacés AHÍ. No es un
    catálogo separado: sale de S.routine, así que nunca puede desincronizarse
    de lo que de verdad estás entrenando. */
function MisEjercicios() {
  const vistos = new Map();
  for (const slot of S.routine) {
    for (const ex of slot.exercises || []) {
      const k = ex.name.trim().toLowerCase();
      if (!vistos.has(k)) vistos.set(k, ex);
    }
  }
  const exs = [...vistos.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const gym = S.gyms.find(g => g.id === S.cfg.activeGym);

  if (!exs.length) {
    return <div className="text-mut text-[13.5px] mt-2">Armá tu rutina primero — acá van a aparecer sus ejercicios.</div>;
  }

  return (
    <>
      <button type="button" className="btn sm ghost mb-3" onClick={() => openSheet('gyms')}>
        🏋 {gym ? `Gimnasio: ${gym.name}` : 'Sin gimnasio activo'}
      </button>
      <div className="day-exs bg-transparent p-0">
        {exs.map(ex => {
          const ov = gym ? gymEquipFor(gym.id, ex.name) : null;
          return (
            <div className="day-ex items-center" key={ex.id}>
              <button type="button" className="grow flex items-center gap-2.5 bg-none border-0 text-left p-0" onClick={() => openSheet('ex-info', { name: ex.name, exId: ex.id })}>
                <span className="grow">
                  <span className="t">{ex.name}</span>
                  <span className="s">{catOf(ex) || 'Sin grupo'}{equipLabel(ex) ? ` · ${equipLabel(ex)}` : ''}</span>
                </span>
              </button>
              {gym && (
                <button type="button" className={`gym-eq-btn${ov ? ' on' : ''}`} onClick={() => openSheet('gym-equip', { gymId: gym.id, gymName: gym.name, exName: ex.name })}>
                  {ov ? '✓ propio' : '+ equipo'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function RutinaView() {
  const st = routineStats();
  const maxSets = Math.max(1, ...S.routine.map(slot => slot.type === 'workout' ? (slot.exercises || []).reduce((a, e) => a + e.sets, 0) : 0));
  const cardsRef = useRef(null);
  // Reveal escalonado de las tarjetas de turno al entrar a Rutina.
  useEffect(() => {
    const cards = cardsRef.current?.querySelectorAll(':scope > .day-card');
    if (cards?.length) staggerReveal(cards);
  }, []);

  if (!st.workoutCount) {
    return (
      <>
        <div className="card"><div className="empty">
          <RutinaVacia className="big" />
          <p>Todavía no tenés rutina.<br />Elegí una <b>plantilla</b> lista o armá tu split turno por turno.</p>
          <button
            type="button"
            className="btn sm max-w-[260px] mx-auto"
            onClick={() => openSheet('library')}
          >
            Ver rutinas y plantillas
          </button>
        </div></div>
        {/* Entrada directa al onboarding, sin pasar por "Mis rutinas" primero
            — este es el primer momento en que alguien sin rutina ve la
            pantalla, así que es donde más sentido tiene ofrecer el asistente. */}
        <button type="button" className="btn sm ghost mt-[var(--s3)]" onClick={() => openSheet('routine-wizard')}>
          Armar con asistente
        </button>
        <button type="button" className="btn ghost mt-[var(--s2)]" onClick={enterEditMode}>
          ✎ Armar mi rutina
        </button>
      </>
    );
  }

  return (
    <>
      {/* Tarjeta del plan. El mockup le da a cada pantalla un matiz propio:
          Hoy es azul, Rutina es violeta. */}
      <div className="card hero hero-plan">
        <div className="hero-eyebrow">Plan activo</div>
        <div className="hero-day">{routineName()}</div>
        <div className="text-mut text-[13px] mt-1">
          {st.workoutCount} turno{st.workoutCount === 1 ? '' : 's'} de entrenamiento · {st.ex} ejercicios · {st.sets} series por ciclo
        </div>
        {/* Barras proporcionales a las series del turno: la secuencia se lee de
            un vistazo, y los turnos de descanso quedan como un guion bajo. */}
        <div className="weekbars">
          {S.routine.map((slot, i) => {
            const sets = slot.type === 'workout' ? (slot.exercises || []).reduce((a, e) => a + e.sets, 0) : 0;
            const h = sets ? Math.round(30 + (sets / maxSets) * 40) : 10;
            return (
              <div key={slot.id} className={`wbar ${sets ? 'on' : ''}`}>
                <div className="b" style={{ height: h }}></div>
                <span>{i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="btn" onClick={enterEditMode}>Editar rutina</button>
        <button type="button" className="btn glass" onClick={() => openSheet('library')}>Mis rutinas</button>
      </div>

      {/* Cada turno es una tarjeta que se despliega en el lugar, con sus
          ejercicios numerados — en el original abría un sheet aparte. */}
      <div className="day-cards" ref={cardsRef}>
        {S.routine.map((slot, i) => {
          const on = slot.type === 'workout' && !!slot.exercises?.length;
          const sets = on ? slot.exercises.reduce((a, e) => a + e.sets, 0) : 0;
          const open = S.rutOpen === i && on;
          return (
            <div key={slot.id} className={`day-card ${open ? 'open' : ''}`}>
              <button
                type="button"
                className="day-head"
                onClick={() => { S.rutOpen = open ? -1 : i; bump(); }}
              >
                <span className={`day-badge ${on ? '' : 'off'}`}>{i + 1}</span>
                <span className="grow">
                  <span className="t">{on ? (slot.name || 'Rutina') : 'Descanso'}</span>
                  <span className="s">{on ? `${slot.exercises.length} ejercicios · ${sets} series` : 'libre'}</span>
                </span>
                <span className="chev">{open ? '⌄' : '›'}</span>
              </button>
              {open && (
                <div className="day-exs">
                  {/* Tocar el ejercicio abre su ficha: qué porción del músculo
                      trabaja, dibujada sobre el mismo cuerpo del mapa de
                      Inicio. Antes esta fila no hacía nada al tocarla, que es
                      justo donde uno va a preguntar "¿y esto para qué?". */}
                  {slot.exercises.map((e, k) => (
                    <button
                      key={e.id}
                      type="button"
                      className="day-ex"
                      onClick={() => openSheet('ex-info', { name: e.name, wd: i, exId: e.id })}
                    >
                      <span className="i">{k + 1}</span>
                      <ExIcon icono={iconOf(e)} size={24} className="day-ex-icon" />
                      <span className="grow">
                        <span className="t">{e.name}</span>
                        <span className="s">
                          {equipLabel(e) && <span className="eq-tag">{equipLabel(e)}</span>}
                          RIR {rirScheme(e.sets).join('/')}
                        </span>
                      </span>
                      <span className="x">{e.sets}×{e.reps}</span>
                      <span className="chev">›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function RutinaEdit() {
  // El editor ya no muestra descansos: sólo los turnos de entrenamiento, en
  // su orden real dentro de S.routine (necesario para que `index` siga
  // sirviendo para ex-info/moveEx/data-wd, que indexan S.routine directo,
  // no la lista filtrada) más un número de posición sólo para mostrar.
  const dow = weekdayProjection();
  const workouts = S.routine
    .map((slot, i) => ({ slot, i }))
    .filter(x => x.slot.type === 'workout');

  return (
    <>
      <div className="vtitle"><h1>Editar</h1><span className="sub">{routineName()}</span></div>
      <div className="flex gap-2.5 mb-[var(--s4)]">
        <button type="button" className="btn sm ghost flex-1" onClick={exitEditMode}>‹ Listo</button>
        <button
          type="button"
          className="btn sm ghost flex-1"
          onClick={openLibSaveSheet}
        >
          💾 Guardar como…
        </button>
      </div>

      <WeekProjection dow={dow} />

      {workouts.length > 1 && (
        <div className="drag-hint tight"><span>↕</span><span>Mantené presionado un entrenamiento y soltalo para reordenarlo — el descanso se acomoda solo.</span></div>
      )}
      <div data-sort="seq">
        {workouts.map(({ slot, i }, pos) => <SlotCard key={slot.id} slot={slot} index={i} n={pos + 1} />)}
      </div>
      <button type="button" className="btn sm ghost mt-[var(--s3)]" onClick={addWorkoutDay}>+ Entrenamiento</button>
    </>
  );
}

/** Tira horizontal: qué día de la semana le tocaría a cada turno si
    arrancaras un lunes (weekdayProjection, rutina-logic.js) — descansos
    incluidos, apagados, para que se vea DÓNDE caen sin poder tocarlos. */
function WeekProjection({ dow }) {
  return (
    <div className="week-proj">
      {S.routine.map((slot, i) => (
        <div key={slot.id} className={`week-proj-d ${slot.type === 'rest' ? 'off' : ''}`}>
          <span className="wd">{dow[i]}</span>
          <span className="t">{slot.type === 'rest' ? '—' : (slot.name || 'Sin nombre')}</span>
        </div>
      ))}
    </div>
  );
}

function SlotCard({ slot, index, n }) {
  const exs = slot.exercises || [];
  const open = S.rutOpen === index;
  // referencia del riel: el ejercicio con más series del turno
  const maxSets = Math.max(1, ...exs.map(e => e.sets || 0));

  return (
    <div className={`card day ${open ? 'open' : ''}`} data-sid={slot.id}>
      <div className="day-headrow">
        <span className="mini day-handle" title="Arrastrar a otra posición">✥</span>
        <button type="button" className="day-head" onClick={() => toggleSlotOpen(index)}>
          <div className="day-txt">
            <span className="day-wd">Entrenamiento {n}</span>
            <span className={`day-name ${slot.name ? '' : 'off'}`}>{slot.name || 'Sin nombre'}</span>
          </div>
          <span className="day-meta">{exs.length ? `${exs.length} ej.` : ''}<span className="chev">›</span></span>
        </button>
        <button type="button" className="mini red" title="Quitar turno" onClick={() => removeWorkoutDay(slot.id)}>✕</button>
      </div>
      <div className="day-body"><div className="dbi">
        {exs.length > 1 && (
          <div className="drag-hint tight"><span>↕</span><span>Mantené presionado un ejercicio para reordenarlo.</span></div>
        )}
        <div data-sort="rut" data-wd={index} style={{ '--lift': 1.015 }}>
          {/* El nombre va en su propia línea a ancho completo. Cuando esto era
              una .row con los cinco botones al lado, en 320px al nombre le
              quedaban 62px: los 40 ejercicios del split se veían como
              "Press ...", "Pec de...", "Leg pr...". */}
          {exs.map((ex, i) => (
            <div
              className="ex-row" data-sid={ex.id} key={ex.id}
              /* el riel se llena según las series de ESTE ejercicio contra el
                 que más tiene del turno: la lista se vuelve un gráfico del
                 reparto de volumen, que es lo que estás decidiendo acá */
              style={{ '--fill': maxSets ? ex.sets / maxSets : 1, '--i': i }}
            >
              <ExIcon icono={iconOf(ex)} size={26} className="ex-row-icon" />
              <div className="ex-row-top">
                <span className="eyebrow">{i + 1} · {catOf(ex) || 'sin grupo'}</span>
                <button
                  type="button"
                  className="mini info inline"
                  data-act="ex-info"
                  style={exInfo(ex.name) ? undefined : { opacity: .4 }}
                  onClick={() => openSheet('ex-info', { name: ex.name, wd: index, exId: ex.id })}
                >
                  <Info />
                </button>
              </div>
              <div className="n">{ex.name}</div>
              <div className="ex-row-bot">
                <span className="presc">{ex.sets}<i>×</i>{ex.reps}</span>
                <span className="m">
                  RIR {rirScheme(ex.sets, ex.name).join('/')}
                  {equipLabel(ex) && <span className="eq-tag">{equipLabel(ex)}</span>}
                </span>
                <span className="acts">
                  <button
                    type="button"
                    className="mini"
                    data-act="ex-up"
                    disabled={i === 0}
                    onClick={() => handleMoveEx(index, ex.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="mini"
                    data-act="ex-down"
                    disabled={i === exs.length - 1}
                    onClick={() => handleMoveEx(index, ex.id, 1)}
                  >
                    ↓
                  </button>
                  <button type="button" className="mini" onClick={() => openSheet('ex-form', { wd: index, ex })}>✎</button>
                  <button type="button" className="mini red" onClick={() => deleteExercise(index, ex.id)}>✕</button>
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2.5 mt-3">
          <button type="button" className="btn sm ghost flex-[2]" onClick={() => openSheet('ex-form', { wd: index, ex: null })}>
            + Ejercicio
          </button>
          <button type="button" className="btn sm dim flex-1" onClick={() => openSheet('slot-edit', { index })}>
            ✎ Turno
          </button>
        </div>
        {/* Anterior A y Anterior B son la misma rutina: sin esto había que
            cargar los mismos nueve ejercicios a mano dos veces, y cada
            corrección otras dos. Botones siempre visibles y no un aviso al
            salir del editor — un cartel cada vez que terminás de editar se
            vuelve ruido y termina en que lo cerrás sin leer. */}
        <div className="flex gap-2.5 mt-2.5">
          <button
            type="button" className="btn sm dim flex-1"
            disabled={!exs.length}
            onClick={() => openSheet('copy-exs', { mode: 'push', wd: index })}
          >
            ⧉ Copiar a otro turno
          </button>
          <button type="button" className="btn sm dim flex-1" onClick={() => openSheet('copy-exs', { mode: 'pull', wd: index })}>
            ⤓ Traer de otro turno
          </button>
        </div>
      </div></div>
    </div>
  );
}
