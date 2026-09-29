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
import { S, bump, useStore, openSheet, changeTab, wDisplay } from '../../lib/state.js';
import { staggerRevealOnce } from '../../lib/motion.js';
import { exInfo, rirScheme } from '../../lib/exdb.js';
import { equipLabel } from '../../lib/equip.js';
import { catOf, stalestGroups, daysSinceAll, diasTexto, blocksOf, subCatOf } from '../../lib/muscle.js';
import { coberturaDe } from '../../lib/coverage.js';
import { gymEquipFor } from '../../lib/gyms.js';
import { flipSort } from '../../lib/drag.js';
import { abrirAsistente } from '../../lib/asistente-agregar.js';
import {
  routineStats, routineName, renameRoutine,
  enterEditMode, exitEditMode, toggleSlotOpen, addWorkoutDay, removeWorkoutDay, weekdayProjection,
  deleteExercise, moveEx, saveSlot, deloadSuggestion, deloadActivo, applyDeload, endDeload,
} from '../../lib/rutina-logic.js';
import { fmtD } from '../../lib/format.js';
import { iconOf } from '../../lib/exicon.js';
import ExIcon from '../ExIcon.jsx';
import MuscleFibers from '../MuscleFibers.jsx';
import { ArrowDown, ArrowUp, Check, Info, Pencil, X } from '../Icon.jsx';
import { RutinaVacia } from '../Illustration.jsx';

/* El peso de partida declarado (ExerciseForm), sólo si está declarado: sin
   dato no se muestra nada — ni un "—" ni un 0, que serían afirmar algo que
   la rutina no dice. "desde" y no "peso" a propósito: es el arranque de la
   primera sesión, no lo que levantás siempre (ver pesoInicial en
   lib/session.js). */
function pesoPartidaTexto(ex) {
  const kg = ex?.pesoInicialKg;
  if (typeof kg !== 'number' || kg <= 0) return null;
  return `desde ${wDisplay(kg)} ${S.cfg.unit}`;
}

/** Envuelve moveEx (↑/↓) con la animación FLIP del original (flipSort mide
    el DOM antes/después de la mutación). moveEx() en sí NO llama bump() —
    el flushSync de acá es lo que fuerza el re-render sincrónico que flipSort
    necesita para medir la posición "after" correctamente; sin esto React
    podría no haber pintado todavía cuando flipSort mide, y la animación no
    se vería (aunque el reordenamiento en sí seguiría siendo correcto). */
async function handleMoveEx(index, exId, dir) {
  if (await moveEx(index, exId, dir)) flipSort(() => flushSync(() => bump()));
}

export default function Rutina() {
  useStore();
  return (
    <>
      <div className="vtitle"><h1>Entreno</h1><span className="sub">{S.rutTab === 'ejercicios' ? 'tus ejercicios' : 'tu plan'}</span></div>
      <div className="seg" style={{ margin: '0 0 var(--s4)' }}>
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
    return <div className="text-text-2 text-sm mt-2">Armá tu rutina primero — acá van a aparecer sus ejercicios.</div>;
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

  /* Editando: la misma pila de siempre, con la tira de proyección arriba. */
  if (editing) {
    return (
      <>
        {/* Enzo: "en la pantalla editar rutina debería aparecer el nombre de la
            rutina y al lado un lápiz por si el usuario quiere editar el
            nombre, sólo allí funcionaría eso" — a diferencia de "Guardar
            como…" (que se sacó de acá, ver abajo), esto NO crea una copia en
            S.lib: renameRoutine() sólo pisa S.cfg.routineName. */}
        <RoutineNameHeader />
        <WeekProjection dow={dow} />
        <div className="btn-row">
          <button type="button" className="btn" onClick={toggleEdit}>‹ Listo</button>
        </div>
        {workouts.length > 1 && (
          <div className="drag-hint tight mt-[var(--s4)]"><span>↕</span><span>Mantené presionado un entrenamiento y soltalo para reordenarlo — el descanso se acomoda solo.</span></div>
        )}
        <div className="day-cards" ref={cardsRef} data-sort="seq">
          {workouts.map(({ slot, i }, pos) => <SlotCard key={slot.id} slot={slot} index={i} n={pos + 1} editing />)}
        </div>
        <button type="button" className="btn sm ghost mt-[var(--s3)]" onClick={addWorkoutDay}>+ Entrenamiento</button>
      </>
    );
  }

  /* Mirando (tanda D de la auditoría visual 2, V10). Antes era una pila de
     siete bloques de peso parecido a 10–16 px entre sí —hero, botón, dos
     nav-card, el aviso de descarga, las porciones y recién ahí los turnos—
     y la lista de turnos, que es lo que se viene a ver, arrancaba a 1.021 px
     (390×844). Ahora son cuatro grupos a --s6: el plan con su acción, los
     accesos (y el estado de la descarga) como UNA lista agrupada, los
     turnos, y abajo lo que es consejo y no plan. */
  return (
    <div className="pila">
      <div className="grupo">
        {st.workoutCount > 0 && (
          <div className="card hero hero-plan">
            <div className="hero-day">{routineName()}</div>
            {/* Tres cifras y no una oración: "4 turnos de entrenamiento · 40
                ejercicios · 88 series por ciclo" ocupaba dos renglones y se
                leía como un párrafo. Es la composición de la hero de Hoy. */}
            <div className="hero-stats">
              <div><div className="cond">{st.workoutCount}</div><span>{st.workoutCount === 1 ? 'turno' : 'turnos'}</span></div>
              <div><div className="cond">{st.ex}</div><span>ejercicios</span></div>
              <div><div className="cond">{st.sets}</div><span>series por ciclo</span></div>
            </div>
            {/* Barras proporcionales a las series del turno: la secuencia se lee de
                un vistazo, y los turnos de descanso quedan como un guion bajo. */}
            <div className="weekbars">
              {S.routine.map((slot, i) => {
                const sets = slot.type === 'workout' ? (slot.exercises || []).reduce((a, e) => a + e.sets, 0) : 0;
                const h = sets ? Math.round(14 + (sets / maxSets) * 22) : 6;
                return (
                  <div key={slot.id} className={`wbar ${sets ? 'on' : ''}`}>
                    <div className="b" style={{ height: h }}></div>
                    <span>{i + 1}</span>
                  </div>
                );
              })}
            </div>
            {/* La acción adentro de la hero, como EMPEZAR en la de Hoy: la
                tarjeta y su botón son un solo objeto. */}
            <div className="btn-row">
              <button type="button" className="btn" onClick={toggleEdit}>✎ Editar rutina</button>
            </div>
          </div>
        )}
        {!st.workoutCount && (
          <div className="btn-row">
            <button type="button" className="btn" onClick={toggleEdit}>✎ Editar rutina</button>
          </div>
        )}
      </div>

      {/* Antes había CUATRO puertas hacia una rutina ("Ver rutinas y
          plantillas", "Armar con asistente", "✎ Armar mi rutina" y "Guardar
          como…" dentro del editor), y las tres primeras sólo aparecían con la
          rutina vacía. Ahora hay UNA sola puerta, siempre visible —no sólo
          cuando no hay rutina—. "Guardar como…" (una COPIA en "Mis rutinas")
          sigue existiendo, pero sólo desde ahí (Library.jsx) — editar la
          rutina activa ya persiste sola turno por turno (Enzo: "no tiene
          mucho sentido, si es una rutina que ya está definida sólo debería
          ser guardar y ya está").

          Los gimnasios eran alcanzables sólo desde un botón dentro de "Mis
          ejercicios", que es la pestaña de al lado: quedaban escondidos
          detrás de otra cosa. Acá son una opción propia.

          2026-09-29 (tanda D): eran dos nav-card sueltas, cada una con su
          borde y 12 px de margen, que se leían como botones de otro sistema
          pegados entre la hero y los turnos. Ahora son una lista agrupada
          (.group), y el aviso de descarga entra en la misma lista como una
          fila de estado: es sobre el plan, igual que las otras dos. */}
      <div className="group">
        <button type="button" className="grouprow" onClick={() => openSheet('library')}>
          <span className="nav-card-ico" aria-hidden="true">📚</span>
          <span className="grouprow-grow">
            <span className="grouprow-t">Mis rutinas</span>
            <span className="grouprow-s">
              {st.workoutCount ? 'Guardadas, plantillas y la que usás' : 'Elegí una plantilla o armá la tuya'}
            </span>
          </span>
          <span className="grouprow-chev" aria-hidden="true">›</span>
        </button>
        <button type="button" className="grouprow" onClick={() => openSheet('gyms')}>
          <span className="nav-card-ico" aria-hidden="true">🏋</span>
          <span className="grouprow-grow">
            <span className="grouprow-t">Mis gimnasios</span>
            <span className="grouprow-s">
              {S.gyms.length
                ? (gymActivo ? `Entrenás en ${gymActivo.name}` : `${S.gyms.length} guardado${S.gyms.length === 1 ? '' : 's'}`)
                : 'Qué máquina usás en cada uno'}
            </span>
          </span>
          <span className="grouprow-chev" aria-hidden="true">›</span>
        </button>
        <DeloadRow cual="activa" />
      </div>

      {!st.workoutCount && (
        <div className="card"><div className="empty">
          <RutinaVacia className="big" />
          <p>Todavía no tenés rutina.<br />Tocá "Mis rutinas" arriba para elegir una plantilla, o "✎ Editar rutina" para armar la tuya turno por turno.</p>
        </div></div>
      )}

      {/* Cada turno es una tarjeta que se despliega en el lugar, con sus
          ejercicios numerados. Mirando se listan TODOS, descansos incluidos,
          en su posición real. */}
      <div className="day-cards" ref={cardsRef}>
        {S.routine.map((slot, i) => <SlotCard key={slot.id} slot={slot} index={i} n={i + 1} editing={false} />)}
      </div>

      {/* Consejo, no plan: van después de los turnos. La descarga SUGERIDA
          es consejo; la descarga EN CURSO es el estado del plan y vive arriba,
          en la lista de accesos. */}
      {deloadSuggestion().length > 0 && !deloadActivo() && (
        <div className="group"><DeloadRow cual="sugerida" /></div>
      )}
      <ReforzarCard />
      <CoberturaCard />
    </div>
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
function DeloadRow({ cual }) {
  const activo = deloadActivo();
  const grupos = deloadSuggestion();
  if (cual === 'activa' && !activo) return null;
  if (cual === 'sugerida' && (activo || !grupos.length)) return null;

  /* Una fila de estado dentro de la lista de accesos (tanda D): el título
     dice el estado, el subtítulo el alcance, y la acción es un chip chico
     —como "+ Hoy" en "Se está enfriando"— en vez de un botón de ancho
     completo debajo de un párrafo. No es un <button> entero: tocar la fila
     no puede aplicar una descarga por accidente. */
  if (activo) {
    return (
      <div className="grouprow grouprow-estado">
        <span className="nav-card-ico ok" aria-hidden="true"><Check /></span>
        <span className="grouprow-grow">
          <span className="grouprow-t">Descarga en curso</span>
          <span className="grouprow-s">
            Desde el {fmtD(activo.desde)}: {activo.grupos.join(', ')}. Al terminar, cada ejercicio vuelve a sus series.
          </span>
        </span>
        <button type="button" className="chip" onClick={endDeload}>Terminar</button>
      </div>
    );
  }

  return (
    <div className="grouprow grouprow-estado">
      <span className="nav-card-ico warn" aria-hidden="true"><Info /></span>
      <span className="grouprow-grow">
        <span className="grouprow-t">Descarga sugerida</span>
        <span className="grouprow-s">
          {grupos.join(', ')}: 3+ semanas en tu volumen máximo. Una semana con 40-50% menos series suele restaurar el progreso.
        </span>
      </span>
      <button
        type="button" className="chip warn"
        aria-label={`Aplicar la descarga a ${grupos.length === 1 ? grupos[0] : `estos ${grupos.length} grupos`}`}
        onClick={() => applyDeload(grupos)}
      >
        Aplicar
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
      {/* Título arriba de la explicación en tamaño: antes el texto (.s, sin
          regla dentro de .notice) salía más grande que el título (auditoría
          2026-09-26). */}
      <div className="text-body text-text font-semibold">Porciones que tu rutina todavía no toca</div>
      <div className="text-sm text-text-2 mt-1 leading-normal">
        Cada músculo tiene porciones que responden a ejercicios distintos. Estas no las
        cubre ninguno de los que elegiste.
      </div>
      {huecos.map(({ cat, cob }) => (
        <div key={cat} className="mt-3">
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
      {/* Mismo encabezado que CoberturaCard (y que la vieja DeloadCard): era un `.sect` con
          los márgenes anulados a mano, que en esta tarjeta se leía como un
          título huérfano y de otro tamaño que sus vecinas. */}
      <div className="text-sm text-text font-semibold">Se está enfriando</div>
      <div className="s text-text-2 mt-1">
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

/** Nombre de la RUTINA (no de un turno), visible sólo en edición, con un
    lápiz al lado que la vuelve editable ahí mismo — igual mecanismo que
    SlotNameInput (estado local, persiste al perder foco o con Enter), pero
    tocando renameRoutine() en vez de saveSlot(): esto pisa S.cfg.routineName
    y nada más, nunca crea una entrada en S.lib. */
function RoutineNameHeader() {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(routineName());
  const inputRef = useRef(null);
  useEffect(() => { if (!editingName) setName(routineName()); }, [editingName]);
  useEffect(() => { if (editingName) inputRef.current?.focus(); }, [editingName]);

  function commit() {
    setEditingName(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== routineName()) renameRoutine(trimmed);
  }

  return (
    <div className="routine-name-head">
      {editingName ? (
        <input
          ref={inputRef}
          className="routine-name-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder="Nombre de la rutina"
          aria-label="Nombre de la rutina"
        />
      ) : (
        <span className="routine-name-txt">{routineName()}</span>
      )}
      <button
        type="button"
        className="mini"
        aria-label="Editar nombre de la rutina"
        onClick={() => setEditingName(v => !v)}
      >
        <Pencil />
      </button>
    </div>
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
  const enOrden = bloques.flatMap(b => b.exs);

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
          {/* Glifo FIJO: lo gira styles.css (.day-card.open .day-head .chev,
              90°). Cambiarlo acá a "⌄" además de la rotación es el "<" que
              volvió (auditoría 2026-09-27, E1): un solo mecanismo. */}
          <span className="chev" aria-hidden="true">›</span>
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
              {enOrden.map((ex, i, arr) => (
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
                      className={`mini info inline${exInfo(ex.name) ? '' : ' sin-ficha'}`}
                      data-act="ex-info"
                      aria-label={`Qué trabaja ${ex.name}`}
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
                      {pesoPartidaTexto(ex) && ` · ${pesoPartidaTexto(ex)}`}
                    </span>
                    <span className="acts">
                      {/* ↑↓ mueven dentro del grupo (moveEx): en el borde
                          del grupo no hay a dónde, así que se apagan. */}
                      <button type="button" className="mini" data-act="ex-up" aria-label={`Subir ${ex.name}`} disabled={i === 0 || catOf(arr[i - 1]) !== catOf(ex)} onClick={() => handleMoveEx(index, ex.id, -1)}><ArrowUp /></button>
                      <button type="button" className="mini" data-act="ex-down" aria-label={`Bajar ${ex.name}`} disabled={i === arr.length - 1 || catOf(arr[i + 1]) !== catOf(ex)} onClick={() => handleMoveEx(index, ex.id, 1)}><ArrowDown /></button>
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
                    {/* El número es el lugar en la lista agrupada, el mismo
                        que en edición y en Plan de hoy — no el índice
                        guardado (A.9/A.10). */}
                    <span className="i">{enOrden.indexOf(e) + 1}</span>
                    <ExIcon icono={iconOf(e)} size={24} className="day-ex-icon" />
                    <span className="grow">
                      <span className="t">{e.name}</span>
                      <span className="s">
                        {equipLabel(e) && <span className="eq-tag">{equipLabel(e)}</span>}
                        RIR {rirScheme(e.sets).join('/')}
                        {pesoPartidaTexto(e) && ` · ${pesoPartidaTexto(e)}`}
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
              <button type="button" className="btn sm ghost flex-1" onClick={() => abrirAsistente(index, 'rutina')}>
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
