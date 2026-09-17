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
//
// Reestructuración (handoff 2026-09-17): el editor dejó de ser una PANTALLA
// aparte (RutinaEdit). S.rutMode sigue existiendo (templates.js y BodyMap.jsx
// lo tocan directo para saltar a editar), pero ahora sólo decide si las
// MISMAS tarjetas de siempre son arrastrables/editables — tocar el lápiz ya
// no navega a otro componente, sólo cambia qué controles se muestran encima
// del mismo layout. Esto también mata la redundancia de las "cuatro puertas"
// hacia una rutina: ahora hay una sola entrada siempre visible ("Mis
// rutinas", más abajo) en vez de tres botones que sólo aparecían con la
// rutina vacía.
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { S, bump, useStore, openSheet, changeTab } from '../../lib/state.js';
import { staggerRevealOnce } from '../../lib/motion.js';
import { exInfo, rirScheme } from '../../lib/exdb.js';
import { equipLabel } from '../../lib/equip.js';
import { catOf, stalestGroups, daysSinceAll, diasTexto, blocksOf, subCatOf } from '../../lib/muscle.js';
import { coberturaDe } from '../../lib/coverage.js';
import { gymEquipFor } from '../../lib/gyms.js';
import { flipSort } from '../../lib/drag.js';
import {
  routineStats, routineName,
  enterEditMode, exitEditMode, toggleSlotOpen, addWorkoutDay, removeWorkoutDay, weekdayProjection,
  deleteExercise, moveEx, saveSlot, deloadSuggestion, deloadActivo, applyDeload, endDeload,
} from '../../lib/rutina-logic.js';
import { toast } from '../../lib/toast.js';
import { fmtD } from '../../lib/format.js';
import { iconOf } from '../../lib/exicon.js';
import ExIcon from '../ExIcon.jsx';
import MuscleFibers from '../MuscleFibers.jsx';
import { ArrowDown, ArrowUp, Info, Pencil, X } from '../Icon.jsx';
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
  return (
    <>
      <div className="vtitle"><h1>Entreno</h1><span className="sub">{S.rutTab === 'ejercicios' ? 'tus ejercicios' : 'tu plan'}</span></div>
      <div className="seg" style={{ margin: 'var(--s2) 0 var(--s3)' }}>
        <button type="button" className={S.rutTab !== 'ejercicios' ? 'on' : ''} onClick={() => { S.rutTab = 'semana'; bump(); }}>Mi plan</button>
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
    return <div className="text-mut text-sm mt-2">Armá tu rutina primero — acá van a aparecer sus ejercicios.</div>;
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
                  <span className="s">{subCatOf(ex) || 'Sin grupo'}{equipLabel(ex) ? ` · ${equipLabel(ex)}` : ''}</span>
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

/** La pantalla entera de Entreno: hero + accesos + tarjetas de turno, todo en
    el mismo lugar tanto mirando como editando. `editing` (S.rutMode==='edit')
    sólo prende drag/inputs/acciones en las MISMAS tarjetas — no cambia de
    árbol de componentes, que es justo lo que Enzo pidió ("tocás el lápiz y
    las tarjetas se vuelven arrastrables y editables sin cambiar de
    pantalla"). */
function RutinaView() {
  const editing = S.rutMode === 'edit';
  const st = routineStats();
  const gymActivo = S.gyms.find(g => g.id === S.cfg.activeGym);
  const dow = weekdayProjection();
  // En edición sólo se muestran (y arrastran) los turnos de ENTRENAMIENTO —
  // los descansos se recalculan solos alrededor (applyWorkoutOrder,
  // rutina-logic.js). `index` sigue apuntando a la posición real en
  // S.routine (necesario para ex-info/moveEx/data-wd); `n` es sólo el número
  // de posición que se muestra.
  const workouts = S.routine
    .map((slot, i) => ({ slot, i }))
    .filter(x => x.slot.type === 'workout');
  const maxSets = Math.max(1, ...S.routine.map(slot => slot.type === 'workout' ? (slot.exercises || []).reduce((a, e) => a + e.sets, 0) : 0));
  const cardsRef = useRef(null);
  // Reveal escalonado de las tarjetas de turno — sólo la primera vez que se
  // ve Rutina en la sesión (staggerRevealOnce), no en cada cambio de
  // pestaña, y no mientras se edita (ahí las tarjetas ya están en pantalla,
  // sólo cambiaron de estado).
  useEffect(() => {
    if (editing) return;
    const cards = cardsRef.current?.querySelectorAll(':scope > .day-card');
    if (cards?.length) staggerRevealOnce('rutina', cards);
  }, [editing]);

  function toggleEdit() {
    if (editing) exitEditMode(); else enterEditMode();
  }

  return (
    <>
      {/* Tarjeta del plan — se esconde en edición para dejarle el lugar a la
          tira de proyección semanal, que es la referencia que importa
          mientras estás reordenando turnos. */}
      {!editing && st.workoutCount > 0 && (
        <div className="card hero hero-plan">
          <div className="hero-eyebrow">Plan activo</div>
          <div className="hero-day">{routineName()}</div>
          <div className="text-mut text-sm mt-1">
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
      )}

      {editing && <WeekProjection dow={dow} />}

      <div className="btn-row">
        <button type="button" className="btn" onClick={toggleEdit}>{editing ? '‹ Listo' : '✎ Editar rutina'}</button>
        {editing && <button type="button" className="btn glass" onClick={openLibSaveSheet}>💾 Guardar como…</button>}
      </div>

      {/* Antes había CUATRO puertas hacia una rutina ("Ver rutinas y
          plantillas", "Armar con asistente", "✎ Armar mi rutina" y "Guardar
          como…" dentro del editor), y las tres primeras sólo aparecían con la
          rutina vacía. Ahora hay UNA sola puerta, siempre visible —no sólo
          cuando no hay rutina— y en el mismo lugar de siempre: justo arriba
          de "Mis gimnasios", mismo estilo de nav-card. */}
      {!editing && (
        <button type="button" className="nav-card" onClick={() => openSheet('library')}>
          <span className="nav-card-ico" aria-hidden="true">📚</span>
          <div className="grow">
            <div className="t">Mis rutinas</div>
            <div className="s">
              {st.workoutCount
                ? `${routineName()} · ${st.workoutCount} entrenamiento${st.workoutCount === 1 ? '' : 's'} · guardadas, plantillas y la que estás usando`
                : 'Elegí una plantilla o armá la tuya — guardadas, plantillas y asistente'}
            </div>
          </div>
          <span className="chev" aria-hidden="true">›</span>
        </button>
      )}

      {/* Los gimnasios eran alcanzables sólo desde un botón dentro de "Mis
          ejercicios", que es la pestaña de al lado: quedaban escondidos detrás
          de otra cosa. Acá son una opción propia, y el subtítulo dice qué vas a
          encontrar adentro en vez de repetir el nombre del botón. */}
      {!editing && (
        <button type="button" className="nav-card" onClick={() => openSheet('gyms')}>
          <span className="nav-card-ico" aria-hidden="true">🏋</span>
          <div className="grow">
            <div className="t">Ver mis gimnasios</div>
            <div className="s">
              {S.gyms.length
                ? `${S.gyms.length} guardado${S.gyms.length === 1 ? '' : 's'}${gymActivo ? ` · entrenando en ${gymActivo.name}` : ''} · qué máquina usás para cada ejercicio en cada uno`
                : 'Guardá dónde entrenás y emparejá cada ejercicio con la máquina de ese gimnasio'}
            </div>
          </div>
          <span className="chev" aria-hidden="true">›</span>
        </button>
      )}

      {!editing && (
        <>
          <DeloadCard />
          <ReforzarCard />
          <CoberturaCard />
        </>
      )}

      {!editing && !st.workoutCount && (
        <div className="card"><div className="empty">
          <RutinaVacia className="big" />
          <p>Todavía no tenés rutina.<br />Tocá "Mis rutinas" arriba para elegir una plantilla, o "✎ Editar rutina" para armar la tuya turno por turno.</p>
        </div></div>
      )}

      {editing && workouts.length > 1 && (
        <div className="drag-hint tight"><span>↕</span><span>Mantené presionado un entrenamiento y soltalo para reordenarlo — el descanso se acomoda solo.</span></div>
      )}

      {/* Cada turno es una tarjeta que se despliega en el lugar, con sus
          ejercicios numerados. En edición sólo se listan los de entrenamiento
          (data-sort="seq", ver drag.js); mirando se listan TODOS, descansos
          incluidos, en su posición real. */}
      <div className="day-cards" ref={cardsRef} {...(editing ? { 'data-sort': 'seq' } : {})}>
        {editing
          ? workouts.map(({ slot, i }, pos) => <SlotCard key={slot.id} slot={slot} index={i} n={pos + 1} editing />)
          : S.routine.map((slot, i) => <SlotCard key={slot.id} slot={slot} index={i} n={i + 1} editing={false} />)}
      </div>
      {editing && <button type="button" className="btn sm ghost mt-[var(--s3)]" onClick={addWorkoutDay}>+ Entrenamiento</button>}
    </>
  );
}

/** Deload (Plan Fierro · Fase 3): 3+ semanas seguidas en el tope tolerable de
    volumen para un grupo.

    Antes esto era sólo un aviso, y terminaba en "una semana con 40-50% menos
    series suele restaurar el progreso" — o sea, dejándote abrir cada
    ejercicio y bajarle las series a mano, y acordarte de subirlas la semana
    siguiente. Eso último es lo que no pasa nunca, y una descarga a medias es
    peor que ninguna: bajás el volumen y te quedás bajo sin querer. Ahora es
    un estado con principio y fin, y terminarla devuelve cada ejercicio a las
    series exactas que tenía. */
function DeloadCard() {
  const activo = deloadActivo();
  const grupos = deloadSuggestion();
  if (!activo && !grupos.length) return null;

  if (activo) {
    return (
      <div className="notice ok">
        <div className="text-sm text-txt font-medium">Descarga en curso desde el {fmtD(activo.desde)}</div>
        <div className="s text-mut mt-1">
          {activo.grupos.join(', ')} con las series reducidas. Al terminarla, cada ejercicio
          vuelve exactamente a las series que tenía.
        </div>
        <button type="button" className="btn sm ghost mt-2.5" onClick={endDeload}>
          Terminar la descarga
        </button>
      </div>
    );
  }

  return (
    <div className="notice warn">
      <div className="text-sm text-txt font-medium">⚠ Puede ser momento de una descarga</div>
      <div className="s text-mut mt-1">
        {grupos.join(', ')} llevan 3+ semanas en tu volumen máximo recuperable. Una semana con 40-50% menos series por grupo suele restaurar el progreso.
      </div>
      <button type="button" className="btn sm ghost mt-2.5" onClick={() => applyDeload(grupos)}>
        Aplicar la descarga a {grupos.length === 1 ? grupos[0] : `estos ${grupos.length} grupos`}
      </button>
    </div>
  );
}

/** Cobertura de fibra sobre la rutina QUE YA TENÉS.

    Esto existía sólo dentro del asistente, o sea que lo veías una vez, el día
    que armaste la rutina, y nunca más — justo cuando menos sabías. La
    pregunta que contesta ("¿esta combinación cubre todo el músculo o me estoy
    repitiendo?") sigue valiendo cada vez que agregás o cambiás un ejercicio,
    que es todo el tiempo.

    Sólo se muestran los grupos donde FALTA algo: si está todo cubierto no hay
    nada que decidir, y una fila de tildes verdes sería ruido. Y sólo los
    grupos que la rutina ya entrena — sugerir cobertura de un músculo que no
    trabajás sería inventarte un problema.

    coberturaDe() devuelve null para los grupos sin porciones distinguibles
    con evidencia real; ahí no se muestra nada en vez de fabricar una. */
function CoberturaCard() {
  const porGrupo = new Map();
  S.routine.forEach(slot => (slot.exercises || []).forEach(ex => {
    const cat = catOf(ex);
    if (!cat) return;
    if (!porGrupo.has(cat)) porGrupo.set(cat, []);
    porGrupo.get(cat).push(ex.name);
  }));

  const huecos = [...porGrupo.entries()]
    .map(([cat, nombres]) => ({ cat, cob: coberturaDe(cat, nombres) }))
    .filter(x => x.cob && x.cob.faltan.length && x.cob.cubiertas.length);

  if (!huecos.length) return null;

  return (
    <div className="notice">
      <div className="text-sm text-txt font-medium">Porciones que tu rutina todavía no toca</div>
      <div className="s text-mut mt-1">
        Cada músculo tiene porciones que responden a ejercicios distintos. Estas no las
        cubre ninguno de los que elegiste.
      </div>
      {huecos.map(({ cat, cob }) => (
        <div key={cat} className="mt-2.5">
          <div className="eyebrow">{cat}</div>
          <div className="wiz-coverage">
            {cob.fibras.map(f => (
              <span key={f} className={`wiz-fiber ${cob.cubiertas.includes(f) ? 'on' : ''}`}>
                {cob.cubiertas.includes(f) ? '✓ ' : ''}{f}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ejercicios/grupos sin entrenar hace 10+ días (Plan Fierro · Fase 1,
    "Reforzar: lo que se está enfriando") — stalestGroups() ya alimenta el
    body-map de Inicio; acá se expone como una acción, no sólo como dato. */
function ReforzarCard() {
  const viejos = stalestGroups(10);
  if (!viejos.length) return null;
  const dias = daysSinceAll();
  return (
    <div className="notice">
      {/* Mismo encabezado que DeloadCard y CoberturaCard: era un `.sect` con
          los márgenes anulados a mano, que en esta tarjeta se leía como un
          título huérfano y de otro tamaño que sus vecinas. */}
      <div className="text-sm text-txt font-medium">Se está enfriando</div>
      <div className="s text-mut mt-1">
        Grupos que hace más de diez días que no tocás. Sumalos al día de hoy.
      </div>
      {/* Antes era un .btn.sm.ghost por fila (hasta 3): un botón de pill
          completo, repetido, al lado de un texto chico — se veía enorme y
          pesado para lo que es (Enzo: "el boton... es muy grande"). Un chip
          chico (mismo componente visual que "Un toque"/"Frecuentes" en
          Nutrición) es la acción rápida que en verdad es, sin competir en
          tamaño con el texto de la fila. */}
      {viejos.slice(0, 3).map(c => (
        <div key={c} className="row">
          <div className="grow"><div className="t">{c}</div><div className="s">{diasTexto(dias[c])} sin entrenar</div></div>
          <button type="button" className="chip warn" onClick={() => changeTab('hoy')}>+ Hoy</button>
        </div>
      ))}
    </div>
  );
}

/** Tira horizontal: qué día de la semana le tocaría a cada turno contando
    desde HOY (weekdayProjection, rutina-logic.js) — descansos incluidos,
    apagados, para que se vea DÓNDE caen sin poder tocarlos.

    2026-09-15 — Enzo: "ese calendario semanal en editar rutina no lo
    entiendo, creo que está mal sincronizado". No está desincronizado, pero
    la sensación era correcta y el problema era nuestro: la tira mostraba
    LUN/MAR/MIÉ como si fuera una agenda, y no lo es. La rutina es una
    secuencia que avanza cuando entrenás, no cuando pasa un día (ver el
    comentario de lib/week.js). Los días que mostraba salen de suponer que
    vas a entrenar un turno por día, todos los días, desde hoy — en cuanto
    te saltás uno, cada etiqueta queda corrida.

    O sea que la tira afirmaba fechas que no puede sostener, que es
    justamente lo que la app no hace. Se arregla diciendo en voz alta de qué
    supuesto salen, y anclando la tira con el turno en el que estás parado
    ahora: sin ese ancla no había forma de leer dónde empieza la cuenta. */
function WeekProjection({ dow }) {
  /* El turno actual de la secuencia. weekdayProjection() cuenta los días
     desde ACÁ (i - idx), así que éste es el que cae hoy — y por eso es el
     único que la tira puede afirmar sin suponer nada. */
  const idx = S.cfg.seqIndex || 0;
  /* Cada turno abre su vista previa (sheet 'day-peek') sin mover el puntero.
     Ese atajo vivía en la tira de turnos de Inicio, que se borró el 2026-09-10
     por competir visualmente con el calendario de la semana real; acá tiene
     más sentido, porque es la pantalla donde el plan se mira y se edita. Los
     descansos no se tocan: no hay nada que espiar. */
  return (
    <>
      {/* Decir el supuesto es la mitad del arreglo: sin esta línea la tira
          se lee como "tu semana", y no lo es. */}
      <div className="week-proj-cap">
        Si entrenás un turno por día desde hoy
      </div>
      <div className="week-proj">
        {S.routine.map((slot, i) => {
          const descanso = slot.type === 'rest';
          const ahora = i === idx;
          const contenido = (
            <>
              {/* El turno actual dice "HOY" y no un día de la semana: es el
                  único dato de la tira que no depende del supuesto. */}
              <span className="wd">{ahora ? 'Hoy' : dow[i]}</span>
              <span className="t">{descanso ? '—' : (slot.name || 'Sin nombre')}</span>
            </>
          );
          const cls = `week-proj-d${descanso ? ' off' : ''}${ahora ? ' now' : ''}`;
          return descanso ? (
            <div key={slot.id} className={cls}>{contenido}</div>
          ) : (
            <button
              type="button"
              key={slot.id}
              className={cls}
              aria-label={`Ver ${slot.name || 'este turno'}${ahora ? ' (el que te toca ahora)' : ''}`}
              onClick={() => openSheet('day-peek', { wd: i })}
            >
              {contenido}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Nombre de turno editable in situ — reemplaza al sheet SlotEdit.jsx, que
    existía sólo para esto. Estado local para no pelear con cada tecleo contra
    el bump() de saveSlot; se persiste recién al perder el foco, y también con
    Enter (mismo gesto que "aceptar" en cualquier input de una sola línea). */
function SlotNameInput({ index, slot }) {
  const [name, setName] = useState(slot.name || '');
  useEffect(() => { setName(slot.name || ''); }, [slot.id, slot.name]);
  function commit() {
    const trimmed = name.trim();
    if (trimmed !== (slot.name || '')) saveSlot(index, { name: trimmed });
  }
  return (
    <input
      className="day-name-input"
      value={name}
      onChange={e => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      onClick={e => e.stopPropagation()}
      placeholder="Nombre del turno (grupos musculares)"
      aria-label={`Nombre del turno ${index + 1}`}
    />
  );
}

function SlotCard({ slot, index, n, editing }) {
  const open = S.rutOpen === index;
  const on = slot.type === 'workout';

  // Turno de descanso: fila apagada, sin controles y sin data-sid — no
  // participa del drag (los descansos se recalculan solos, ver
  // applyWorkoutOrder) y en modo edición ni siquiera se llega a renderizar
  // esta rama (RutinaView ya filtra sólo workouts para `editing`).
  if (!on) {
    return (
      <div className="day-card">
        <div className="day-head" style={{ cursor: 'default' }}>
          <span className="day-badge off">{n}</span>
          <span className="grow"><span className="t">Descanso</span><span className="s">libre</span></span>
        </div>
      </div>
    );
  }

  const exs = slot.exercises || [];
  const sets = exs.reduce((a, e) => a + e.sets, 0);
  // referencia del riel de series en edición: el ejercicio con más series del turno
  const maxSets = Math.max(1, ...exs.map(e => e.sets || 0));
  // Agrupados por GRUPO muscular grueso (blocksOf, lib/muscle.js) y no por
  // subgrupo: separar "press plano" (Pecho) de "press inclinado" (Pecho
  // superior) es justo la distinción que Enzo quiere ver JUNTA acá. La
  // precisión fina no se pierde — pasa a mostrarla MuscleFibers, sin texto.
  const bloques = blocksOf(exs);

  /* REGRESIÓN 2026-09-17: esto decía `card day` (la clase del viejo
     editor-pantalla-aparte, pensada para el acordeón .day-body/.day.open de
     esa pantalla) pero el markup de abajo es el acordeón .day-collapse/
     .day-collapse-in de la vista normal, que sólo se abre con
     `.day-card.open` (ver styles.css). Con la clase vieja el turno nunca
     alcanzaba altura > 0 al abrirse, Y de paso `.day.open .chev` (esa regla
     es de OTRO acordeón, styles.css:1559) rotaba el glifo que acá ya se
     intercambia a mano (⌄/›) — la superposición de las dos cosas es el "<"
     que se veía en vez de un chevron abierto. Una sola clase arregla las dos
     cosas: `day-card` es la que styles.css espera. */
  return (
    <div className={`day-card ${open ? 'open' : ''}`} data-sid={slot.id}>
      <div className="day-headrow">
        {editing && <span className="mini day-handle" title="Arrastrar a otra posición">✥</span>}
        <button type="button" className="day-head" onClick={() => toggleSlotOpen(index)}>
          <span className={`day-badge ${on ? '' : 'off'}`}>{n}</span>
          <span className="grow">
            {editing ? (
              <SlotNameInput index={index} slot={slot} />
            ) : (
              <span className={`day-name ${slot.name ? '' : 'off'}`}>{slot.name || 'Rutina'}</span>
            )}
            <span className="s">{exs.length ? `${exs.length} ejercicios · ${sets} series` : 'libre'}</span>
          </span>
          <span className="chev">{open ? '⌄' : '›'}</span>
        </button>
        {editing && <button type="button" className="mini red" title="Quitar turno" aria-label={`Quitar el turno ${slot.name || 'sin nombre'}`} onClick={() => removeWorkoutDay(slot.id)}><X /></button>}
      </div>

      <div className="day-collapse">
        <div className="day-collapse-in">
        <div className="day-exs">
          {editing && exs.length > 1 && (
            <div className="drag-hint tight"><span>↕</span><span>Mantené presionado un ejercicio para reordenarlo.</span></div>
          )}
          {editing ? (
            /* En edición la lista es PLANA (data-sort="rut" exige hijos
               directos con data-sid, ver drag.js): el encabezado del grupo
               va DENTRO de la primera fila de cada bloque, nunca como fila
               aparte — una fila-encabezado sin data-sid quedaría huérfana
               arriba después de un drag, con el bloque ya movido debajo. */
            <div data-sort="rut" data-wd={index} style={{ '--lift': 1.015 }}>
              {bloques.flatMap(b => b.exs).map((ex, i, arr) => (
                <div
                  className="ex-row" data-sid={ex.id} key={ex.id}
                  style={{ '--fill': maxSets ? ex.sets / maxSets : 1, '--i': i }}
                >
                  {(i === 0 || catOf(arr[i - 1]) !== catOf(ex)) && (
                    <div className="ex-group-tag">
                      {catOf(ex) || 'Sin grupo'}
                      <MuscleFibers cat={catOf(ex)} exercises={bloques.find(b => b.cat === (catOf(ex) || 'Otros'))?.exs || []} />
                    </div>
                  )}
                  <ExIcon icono={iconOf(ex)} size={26} className="ex-row-icon" />
                  <div className="ex-row-top">
                    <span className="eyebrow">{i + 1}</span>
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
                      <button type="button" className="mini" data-act="ex-up" disabled={i === 0} onClick={() => handleMoveEx(index, ex.id, -1)}><ArrowUp /></button>
                      <button type="button" className="mini" data-act="ex-down" disabled={i === arr.length - 1} onClick={() => handleMoveEx(index, ex.id, 1)}><ArrowDown /></button>
                      <button type="button" className="mini" aria-label={`Editar ${ex.name}`} onClick={() => openSheet('ex-form', { wd: index, ex })}><Pencil /></button>
                      <button type="button" className="mini red" aria-label={`Borrar ${ex.name}`} onClick={() => deleteExercise(index, ex.id)}><X /></button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Mirando (no editando): sí se pintan como bloques separados con
               encabezado propio — no hay drag acá, así que no hay riesgo de
               fila huérfana. */
            bloques.map(bloque => (
              <div key={bloque.cat} className="day-exs-block">
                <div className="day-exs-head">
                  <span className="grow">{bloque.cat}</span>
                  <MuscleFibers cat={bloque.cat} exercises={bloque.exs} />
                  <span>{bloque.exs.length} ej · {bloque.exs.reduce((a, e) => a + e.sets, 0)} series</span>
                </div>
                {bloque.exs.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    className="day-ex"
                    onClick={() => openSheet('ex-info', { name: e.name, wd: index, exId: e.id })}
                  >
                    <span className="i">{exs.indexOf(e) + 1}</span>
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
            ))
          )}
        </div>
        {editing && (
          <div className="dbi">
            <div className="flex gap-2.5 mt-3">
              <button type="button" className="btn sm ghost flex-1" onClick={() => openSheet('ex-form', { wd: index, ex: null })}>
                + Ejercicio
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
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
