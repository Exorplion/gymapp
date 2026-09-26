// Puerto de renderHoy() (index.html) — la pantalla "Hoy" completa: hero de
// sesión activa / pre-sesión, semana en tira, tarjeta de volumen muscular,
// botones de pre-workout/voz, carrusel de ejercicios (ExerciseCarousel.jsx,
// componente propio por su lógica de scroll) e historial. Es la función más
// grande del original (~170 líneas) — acá se divide en subcomponentes
// hermanos dentro del mismo archivo (mismo criterio que Rutina.jsx con
// RutinaView/RutinaEdit/DayCard), no en archivos nuevos: el plan sólo pide
// un archivo para esta pantalla.
//
// SessStartInfo se exporta acá (no es de los "5 sheets" que pide el Paso 4
// del brief, que sí tienen archivo propio) porque es
// contenido de sheet específico de Hoy sin lógica de scroll/drag que
// justifique aislarlo — mismo criterio que ConfirmSheet en App.jsx (sheet
// cross-cutting definido junto a quien lo usa). App.jsx lo registra en el
// switch de <SheetContent/> como 'sess-start-info'.
//
// HistDetail vivía acá hasta que SessionView (components/sheets/) unificó las
// dos vistas de una sesión — la del historial y la del cierre.
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { staggerRevealOnce, bloomOpen, animateRing, countTo } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';
import { S, useStore, bump, openSheet, closeSheet, changeTab, wDisplay } from '../../lib/state.js';
import { WDS, MO, fmtMMSS, dstr } from '../../lib/format.js';
import { opcionesDescanso } from '../../lib/descansoHoy.js';
import { orderedExs, sessionExs, nextPending, setsDone, targetSets, isSkipped, sessionProgress, startSession, discardSession, completeSession, moveBlock, indiceHoy, elegirTurnoHoy } from '../../lib/session.js';
import { flipSort } from '../../lib/drag.js';
import { blocksOf, catOf, MUSCLE_CATS } from '../../lib/muscle.js';
import { equipLabel } from '../../lib/equip.js';
import { parseWorkoutSpeech } from '../../lib/voice.js';
import { createGym, setActiveGym } from '../../lib/gyms.js';
import ExerciseCarousel from '../ExerciseCarousel.jsx';
import { objetivoHoy, resumenPlan } from '../../lib/objetivoHoy.js';
import { toast } from '../../lib/toast.js';
import { Bolt, Mic, Pencil, RecordDot, Dots, Plus } from '../Icon.jsx';
import { HoySinPlan } from '../Illustration.jsx';
import Silhouette from '../Silhouette.jsx';

const SR_CLASS = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;

export default function Hoy() {
  useStore();
  const today = new Date();
  // Con sesión abierta, el turno de la sesión; en un descanso, el que
  // elegiste para entrenar igual; si no, el pendiente (session.js).
  const index = indiceHoy();
  const day = S.routine[index];
  const active = !!S.draft;
  // Elegiste entrenar en un día de descanso y todavía no abriste la sesión:
  // se ve el plan de ese turno, con la salida para volver a elegir.
  const entrenaEnDescanso = !active && S.routine[S.cfg.seqIndex]?.type === 'rest' && day?.type === 'workout';
  // Con sesión abierta la lista sale del borrador: incluye lo que agregaste
  // hoy, que no está en la rutina.
  const exs = active ? sessionExs(index) : orderedExs(index, day?.exercises || []);
  const started = active && !!S.draft.start;
  const curId = active ? S.draft.cur : null;
  const nextEx = active ? nextPending(exs) : null;
  const allDone = active && exs.length > 0 && !nextEx;

  // Bloom-open sutil para la tarjeta vacía "sin ejercicios hoy" al montar.
  const emptyCardRef = useRef(null);
  useEffect(() => {
    if (emptyCardRef.current) bloomOpen(emptyCardRef.current);
  }, [emptyCardRef.current]);

  return (
    <>
      {/* Hoy dejó de ser pestaña: se entra desde Inicio, así que necesita su
          propia salida. Con la sesión abierta el título se va: la barra de
          la sesión ocupa su lugar y la pantalla entera tiene que entrar sin
          scroll (Enzo, 2026-09-25). Se vuelve con Inicio o con el gesto. */}
      {!active && (
        <div className="vtitle">
          <button type="button" className="back-btn" aria-label="Volver a Inicio" onClick={() => changeTab('inicio')}>‹</button>
          <h1>Hoy</h1>
          <span className="sub">{WDS[today.getDay()]} {today.getDate()} {MO[today.getMonth()]}</span>
        </div>
      )}

      {active ? (
        <SesionBarra day={day} index={index} exs={exs} started={started} allDone={allDone} />
      ) : day?.type === 'rest' ? (
        <RestHero />
      ) : (
        <>
          {entrenaEnDescanso && (
            <div className="hoy-elegido">
              <span>Entrenando en tu día de descanso</span>
              <button type="button" className="linkcard" onClick={() => { elegirTurnoHoy(null); bump(); }}>‹ Elegir otro</button>
            </div>
          )}
          <PreSessionHero day={day} index={index} exs={exs} />
        </>
      )}

      {day?.type === 'rest' && !active ? null : !exs.length ? (
        <div className="card" ref={emptyCardRef}><div className="empty">
          <HoySinPlan className="big" />
          <p>Este turno todavía no tiene ejercicios.<br />Configuralo en la pestaña Rutina.</p>
          <button
            type="button"
            className="btn sm ghost max-w-[240px] mx-auto"
            onClick={() => changeTab('rutina')}
          >
            Configurar rutina
          </button>
        </div></div>
      ) : !active ? (
        // Antes de arrancar: sólo los bloques, editables y desplegables — el
        // carrusel es de EJECUCIÓN (serie, descanso, cronómetro), no tiene
        // nada que hacer en la etapa de "mirar y planear qué toca hoy".
        <PlanHoy index={index} exs={exs} />
      ) : (
        <>
          {/* La rampa de aproximación (50/75/90%) ya no va en una tarjeta
              aparte arriba del carrusel: vive adentro de la tarjeta del
              ejercicio que la necesita (ExerciseCarousel.jsx). El
              calentamiento general se ofrece una vez, al abrir la sesión
              (hoja 'calentamiento'). */}
          <ExerciseCarousel exs={exs} wd={index} active={active} started={started} curId={curId} nextEx={nextEx} />
        </>
      )}

    </>
  );
}

/** Puerto del <span id="hoy-elapsed"> + el setInterval global que lo
    tickeaba cada segundo (index.html, "cronómetro en vivo de la sesión").
    Acá el tick queda aislado a este span en vez de un intervalo module-level
    que hurgaba el DOM por id — evita re-renderizar toda la pantalla de Hoy
    una vez por segundo mientras hay una sesión abierta. */
function ElapsedTimer({ start }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span id="hoy-elapsed" data-start={start}>{fmtMMSS(Math.floor((Date.now() - start) / 1000))}</span>;
}

/** Rueda de porcentaje de la sesión en vivo: series reales hechas / series
    reales objetivo del turno de hoy (sessionProgress(), session.js — no
    cuenta filas unilaterales dobles, no cuenta lo salteado). Calca el
    patrón de RestTimer.jsx: SVG con data-circumference fijo, animateRing()
    para el trazo (salta al valor final con "reducir movimiento", nunca deja
    el anillo vacío) y countTo() para el número — nunca un contador propio.

    Chica y de un vistazo a propósito: vive al lado del cuerpo muscular en el
    hero, no reemplaza el "N/M ejercicios" de arriba (que cuenta EJERCICIOS,
    esto cuenta SERIES, más granular) ni le saca lugar al carrusel o al botón
    de registrar — lo que importa mientras entrenás es el toque, no el
    adorno. */
const RING_CIRC = 2 * Math.PI * 15.5;

function SessionRing({ progress }) {
  const ringRef = useRef(null);
  const numRef = useRef(null);
  const pct = progress.pct;
  const pctLabel = Math.round(pct * 100);
  useEffect(() => {
    animateRing(ringRef.current, pct);
    if (numRef.current) countTo(numRef.current, pctLabel, { format: n => `${Math.round(n)}%` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pctLabel]);
  return (
    <div
      className="session-ring"
      role="progressbar"
      aria-valuenow={pctLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progreso de la sesión: ${progress.done} de ${progress.total} series, ${pctLabel} por ciento`}
    >
      <svg viewBox="0 0 36 36">
        <circle className="session-ring-track" cx="18" cy="18" r="15.5" />
        <circle
          ref={ringRef}
          className="session-ring-prog"
          cx="18"
          cy="18"
          r="15.5"
          data-circumference={RING_CIRC}
        />
      </svg>
      <span className="session-ring-num" ref={numRef}>{pctLabel}%</span>
    </div>
  );
}

/** La sesión en curso, en una barra (2026-09-25). Antes era una tarjeta de
    ~150 px con el cuerpo, el anillo y dos botones grandes, más el título
    "HOY" encima: entre los dos empujaban la tarjeta del ejercicio fuera de la
    pantalla. Enzo: la sesión en vivo tiene que entrar entera, sin scroll —
    lo único que hacés ahí es registrar series. Queda lo que se mira de reojo
    (avance, nombre, reloj) y dos botones: Terminar, que pregunta qué hacer
    (TerminarSesion), y ···, con lo que se usa poco (SesionMenu). */
function SesionBarra({ day, index, exs, started, allDone }) {
  const nsets = Object.values(S.draft.entries).reduce((a, e) => a + e.sets.length, 0);
  const doneEx = exs.filter(e => !isSkipped(e.id) && setsDone(e.id).length >= targetSets(e)).length;
  const nSkip = exs.filter(e => isSkipped(e.id)).length;
  const progress = sessionProgress(exs);
  return (
    <>
      <div className={cn('ses-barra', allDone && 'lista')}>
        {progress && <SessionRing progress={progress} />}
        <div className="ses-barra-main">
          <div className="ses-barra-t">{day?.name || 'Entrenamiento'}</div>
          <div className="ses-barra-s">
            {started
              ? <><b><ElapsedTimer start={S.draft.start} /></b> · {doneEx}/{exs.length - nSkip} ejerc. · {nsets} serie{nsets === 1 ? '' : 's'}</>
              : 'Sin empezar'}
          </div>
        </div>
        <button type="button" className="ses-terminar" onClick={() => openSheet('terminar-sesion')}>Terminar</button>
        <button type="button" className="ses-mas" aria-label="Más opciones de la sesión" onClick={() => openSheet('sesion-menu', { wd: index })}>
          <Dots />
        </button>
      </div>
      {allDone && (
        <div className="ses-lista">
          Terminaste los {exs.length - nSkip} ejercicios{nSkip > 0 ? ` (omitiste ${nSkip})` : ''}. Tocá <b>Terminar</b> para guardar.
        </div>
      )}
    </>
  );
}

/** Lo que abre "Terminar": un aviso, no una hoja (variante "dialogo" en
    App.jsx, con su entrada y su salida). Completar es la acción principal;
    Descartar pasa por una confirmación más porque borra todo lo registrado. */
export function TerminarSesion() {
  const nsets = S.draft ? Object.values(S.draft.entries).reduce((a, e) => a + e.sets.length, 0) : 0;
  return (
    <>
      <h2>Terminar la sesión</h2>
      <div className="txt-mut" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
        {nsets
          ? `Llevás ${nsets} serie${nsets === 1 ? '' : 's'} registrada${nsets === 1 ? '' : 's'}.`
          : 'Todavía no registraste ninguna serie.'}
      </div>
      <button type="button" className="btn ok" disabled={!nsets} onClick={() => { closeSheet(); completeSession(); }}>✓ Completar y guardar</button>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button type="button" className="btn sm ghost" style={{ flex: 1 }} onClick={closeSheet}>Seguir entrenando</button>
        <button type="button" className="btn sm danger" style={{ flex: 1 }} onClick={confirmSessDiscard}>Descartar</button>
      </div>
    </>
  );
}

/** El ··· de la barra: lo que antes era una fila de dos botones debajo del
    carrusel. Se usa poco y ocupaba ~60 px en cada serie. */
export function SesionMenu({ wd }) {
  const y = fn => () => { closeSheet(); fn(); };
  return (
    <>
      <h2>Sesión</h2>
      <div className="group" style={{ marginBottom: 'var(--s3)' }}>
        {/* Decidiste hacer algo que no estaba en el plan. Vale sólo para hoy;
            al cerrar la sesión se ofrece dejarlo fijo. */}
        <button type="button" className="grouprow" onClick={y(() => openSheet('ex-swap', { wd }))}>
          <Plus className="opc-ico" />
          <span className="grouprow-grow">
            <span className="grouprow-t">Agregar ejercicio</span>
            <span className="grouprow-s">Sólo para hoy. Al terminar podés dejarlo fijo en la rutina.</span>
          </span>
        </button>
        {/* commitSort() escribe en S.draft.order con la sesión abierta
            (setExOrder), así que ReorderHoy funciona igual que antes de
            arrancar. */}
        <button type="button" className="grouprow" onClick={y(() => openSheet('reorder-hoy'))}>
          <span className="opc-ico" aria-hidden="true">↕</span>
          <span className="grouprow-grow">
            <span className="grouprow-t">Reordenar ejercicios</span>
            <span className="grouprow-s">Cambiá el orden de lo que te falta.</span>
          </span>
        </button>
      </div>
    </>
  );
}

function confirmSessDiscard() {
  openSheet('confirm', {
    title: 'Descartar sesión',
    body: '¿Descartar la sesión en curso? Se pierde todo lo registrado.',
    confirmLabel: 'Descartar',
    onConfirm: () => discardSession(),
  });
}

/** Descanso programado: informativa y sin botón — el turno avanza solo al
    otro día (completeSession() ya adelanta seqIndex al completar un
    entrenamiento; resolveAutoRest() en state.js hace lo mismo con el
    descanso cuando pasa un día calendario). */
/** Descanso según la secuencia. Antes decía sólo "Descanso" y debajo caía la
    tarjeta de "este turno no tiene ejercicios, configuralo en Rutina" — que
    es para un turno de entrenamiento vacío, y en un descanso parecía un
    error (Enzo, 2026-09-25). Ahora dice de dónde venís y qué te toca, y deja
    elegir cualquier turno para entrenar igual. Elegir no toca la secuencia:
    al cerrar la sesión el puntero avanza desde el turno que hiciste. */
function RestHero() {
  const o = opcionesDescanso({ routine: S.routine, seqIndex: S.cfg.seqIndex, sessions: S.sessions, hoy: dstr() });
  const hace = d => (d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`);
  function elegir(i) { elegirTurnoHoy(i); bump(); scrollTo({ top: 0, behavior: 'instant' }); }
  return (
    <>
      <div className="card hero">
        <div className="eyebrow">Hoy te toca descansar</div>
        <div className="hero-day">Descanso</div>
        <div className="text-mut text-sm mt-1.5">
          {o.ultimo && (
            <>Último entrenamiento: <b className="text-txt">{o.ultimo.nombre}</b>, {hace(o.ultimo.dias)}
              {o.diasDescanso > 0 && <> · {o.diasDescanso} día{o.diasDescanso === 1 ? '' : 's'} de descanso</>}.<br /></>
          )}
          {o.recomendado
            ? <>Lo recomendable es descansar. Si igual querés entrenar, te toca <b className="text-txt">{o.recomendado.nombre}</b>.</>
            : 'Mañana seguís con el próximo turno de tu rutina.'}
        </div>
      </div>

      {o.opciones.length > 0 && (
        <section className="plan-hoy" aria-label="Entrenar igual">
          <div className="plan-head">
            <h2 className="plan-title">¿Entrenar igual? Elegí cuál</h2>
          </div>
          <div className="group">
            {o.opciones.map(op => (
              <button key={op.id} type="button" className="grouprow" onClick={() => elegir(op.index)}>
                <span className="grouprow-grow">
                  <span className="grouprow-t">{op.nombre}</span>
                  <span className="grouprow-s">
                    {op.recomendado
                      ? `Es el que sigue en tu secuencia${o.despues && o.despues !== op.nombre ? ` · después viene ${o.despues}` : ''}`
                      : op.dias === null ? 'Todavía no lo hiciste'
                      : op.reciente ? `${hace(op.dias)[0].toUpperCase()}${hace(op.dias).slice(1)} · repetirlo no deja descansar esos músculos`
                      : `${hace(op.dias)[0].toUpperCase()}${hace(op.dias).slice(1)}`}
                  </span>
                </span>
                {op.recomendado && <span className="grouprow-v">Recomendado</span>}
                <span className="grouprow-chev" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** El turno pendiente según la secuencia. Al completar un entrenamiento el
    puntero ya avanzó (session.js), así que acá siempre es el próximo por
    hacer — nunca uno ya cerrado —, y el eyebrow puede quedar fijo en "Toca
    hoy" sin comparar contra ningún día de la semana. */
function PreSessionHero({ day, index, exs }) {
  const totalSets = exs.reduce((a, e) => a + e.sets, 0);
  const estMin = Math.round(totalSets * ((S.cfg.rest || 90) + 40) / 60);
  const cats = [...new Set(exs.map(e => catOf(e)).filter(Boolean))];
  return (
    <div className="card hero hero-hoy">
      {/* El cuerpo con los grupos de hoy, en la esquina (Enzo, 2026-09-24):
          antes era un bloque propio entre los botones y la lista, y empujaba
          los ejercicios media pantalla hacia abajo. */}
      {cats.length > 0 && <CuerpoDeHoy cats={cats} />}
      <div className="flex items-center gap-2">
        <span className="w-[7px] h-[7px] rounded-[4px] bg-cyan shadow-[0_0_8px_var(--cyan)]"></span>
        <div className="eyebrow">Toca hoy</div>
      </div>
      {/* 46px e itálica: en el mockup el nombre del día es el elemento más
          grande de la pantalla, por encima del propio título "HOY". */}
      <div className="hero-day">{day?.name || 'Entrenamiento'}</div>
      <div className="hero-stats">
        <div>
          <div className="cond">{exs.length}</div>
          <span>Ejercicio{exs.length === 1 ? '' : 's'}</span>
        </div>
        <div>
          <div className="cond">{totalSets}</div>
          <span>Series</span>
        </div>
        <div>
          <div className="cond">~{estMin}</div>
          <span>Minutos</span>
        </div>
      </div>
      {exs.length > 0 && (
        <>
          <button type="button" className="btn hero-cta" onClick={() => openSheet('sess-start-info', { index })}>
            Empezar entrenamiento
          </button>
          {/* Pre-workout y voz no se usan todos los días: dos accesos chicos
              adentro de la misma tarjeta, no dos tarjetas enteras que
              separaban el plan del botón de empezar. */}
          <div className="hero-acts">
            <button type="button" className="chip" onClick={() => openSheet('preworkout')}>
              <Bolt size={15} /> Pre-workout
            </button>
            {SR_CLASS && <VoiceLogButton />}
          </div>
        </>
      )}
    </div>
  );
}

/** El plan de hoy: los ejercicios en el orden en que se van a hacer,
    numerados y agrupados por bloque muscular, con lo que toca superar en
    cada uno a la derecha.

    Antes eran bloques plegables con ▲▼ siempre a la vista: para ver qué
    tocaba había que abrirlos de a uno, y nada decía si hoy había algo que
    ganarle a la vez pasada (Enzo: "no me despierta nada"). Ahora la lista
    está abierta y dice la meta; los controles de ordenar y editar aparecen
    sólo en modo edición, que es cuando se usan. */
function PlanHoy({ index, exs }) {
  const [editando, setEditando] = useState(false);
  const blocks = blocksOf(exs);
  const { subir, superar } = resumenPlan(exs);
  const listRef = useRef(null);
  useEffect(() => {
    const items = listRef.current?.querySelectorAll(':scope > .plan-block');
    if (items?.length) staggerRevealOnce('hoy', items);
  }, []);
  /* Mueve el bloque y RECIÉN DESPUÉS pinta el nuevo orden adentro de
     flipSort: así flipSort mide el "antes" con el DOM viejo y anima la
     diferencia con un transform (drag.js). */
  async function mover(cat, dir) {
    await moveBlock(index, blocks, cat, dir);
    flipSort(() => flushSync(() => bump()));
  }
  let n = 0;
  return (
    <section className="plan-hoy" data-sort="hoy-blocks" ref={listRef} aria-label="Plan de hoy">
      <div className="plan-head">
        <h2 className="plan-title">Plan de hoy</h2>
        <button type="button" className="plan-edit" aria-pressed={editando} onClick={() => setEditando(v => !v)}>
          {editando ? 'Listo' : 'Editar'}
        </button>
      </div>
      {(subir > 0 || superar > 0) && (
        <div className="plan-resumen">
          {subir > 0 && <span className="up">↑ {subir} para subir peso</span>}
          {subir > 0 && superar > 0 && ' · '}
          {superar > 0 && <span>{superar} para superar reps</span>}
        </div>
      )}
      {blocks.map((b, i) => (
        <div className="plan-block" data-sid={b.cat} key={b.cat}>
          <div className="plan-block-head">
            <span>{b.cat} · {b.exs.length}</span>
            {editando && blocks.length > 1 && (
              <span className="block-move">
                <button type="button" disabled={i === 0} aria-label={`Mover ${b.cat} antes`} onClick={() => mover(b.cat, -1)}>▲</button>
                <button type="button" disabled={i === blocks.length - 1} aria-label={`Mover ${b.cat} después`} onClick={() => mover(b.cat, 1)}>▼</button>
              </span>
            )}
          </div>
          <div className="group">
            {b.exs.map(ex => {
              n += 1;
              return (
                <div className="grouprow plan-row" key={ex.id}>
                  <button type="button" className="plan-row-main" onClick={() => openSheet('ex-info', { name: ex.name, exId: ex.id })}>
                    <span className="plan-num">{n}</span>
                    <span className="grouprow-grow">
                      <span className="grouprow-t">{ex.name}</span>
                      <span className="grouprow-s">{ex.sets}×{ex.reps}{equipLabel(ex) ? ` · ${equipLabel(ex)}` : ''}</span>
                    </span>
                    <Meta ex={ex} />
                  </button>
                  {editando && (
                    <button type="button" className="mini" aria-label={`Editar ${ex.name}`} onClick={() => openSheet('ex-form', { wd: index, ex })}><Pencil /></button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {editando && (
        <div className="plan-edit-acts">
          <button type="button" className="btn sm ghost" onClick={() => openSheet('ex-form', { wd: index, ex: null })}>+ Agregar ejercicio</button>
          {exs.length > 1 && (
            <button type="button" className="btn sm ghost" onClick={() => openSheet('reorder-hoy')}>↕ Reordenar dentro de un bloque</button>
          )}
        </div>
      )}
    </section>
  );
}

/** Lo que toca superar hoy, a la derecha de cada ejercicio del plan. */
function Meta({ ex }) {
  const o = objetivoHoy(ex);
  const kg = o.peso != null ? `${wDisplay(o.peso)} ${S.cfg.unit === 'lb' ? 'lb' : 'kg'}` : null;
  if (o.tipo === 'subir') {
    return <span className="plan-meta up"><b>{kg} ↑</b><small>antes {wDisplay(o.antes)}</small></span>;
  }
  if (o.tipo === 'sostener' || o.tipo === 'sumar') {
    return <span className="plan-meta"><b>{kg}</b><small>superar reps</small></span>;
  }
  if (o.tipo === 'sugerido') {
    return <span className="plan-meta"><b>~{kg}</b><small>sugerido</small></span>;
  }
  return <span className="plan-meta"><small>primera vez</small></span>;
}

/** El cuerpo con los grupos de HOY encendidos — mismo componente y mismos
    colores que Inicio/BodyMap, pero acá "encendido" no es recencia (hace
    cuántos días), es "está en el plan de hoy sí o no": por eso arma su
    propio `days` en vez de reusar daysSinceAll(). */
function CuerpoDeHoy({ cats }) {
  const set = new Set(cats);
  const days = {};
  MUSCLE_CATS.forEach(c => { days[c] = set.has(c) ? 0 : null; });
  return <div className="hero-hoy-body" aria-hidden="true"><Silhouette days={days} interactivo={false} /></div>;
}

/** Las tres preguntas de autorregulación diaria (Plan Fierro · Fase 3, patrón
    Juggernaut AI/Whoop): sin sensores, 3 taps que ajustan ±10% el peso
    sugerido del día. Vive fuera del componente, mismo patrón que PW
    (Preworkout.jsx) — mutable a nivel de módulo, no persistido, se resetea
    solo al cerrar/reabrir el sheet. */
const PRECHECK = { sleep: null, sore: null, motivation: null, pre: null };
function resetPrecheck() { PRECHECK.sleep = null; PRECHECK.sore = null; PRECHECK.motivation = null; PRECHECK.pre = null; }

/** ±10% si dormiste mal o estás dolorido; sin marcar nada, sin ajuste. Se
    guarda en S.draft.precheckAdjust al abrir la sesión — ExerciseCarousel lo
    aplica sobre suggestedWeight(). */
function precheckAdjust() {
  let adj = 0;
  if (PRECHECK.sleep === 'mal') adj -= 0.1;
  if (PRECHECK.sore) adj -= 0.1;
  if (PRECHECK.motivation === 'alta' && PRECHECK.sleep !== 'mal' && !PRECHECK.sore) adj += 0.05;
  return Math.max(-0.15, Math.min(0.05, adj));
}

/** Sheet informativo previo a abrir la sesión (data-act="sess-start" del
    original) — separado de 'sess-start-go', que en el puerto es
    startSession() (session.js). */
export function SessStartInfo({ index }) {
  useStore();
  const day = S.routine[index];
  const n = day?.exercises?.length || 0;

  function chip(field, value, label) {
    const on = PRECHECK[field] === value;
    return (
      <button
        type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
        onClick={() => { PRECHECK[field] = on ? null : value; bump(); }}
      >
        {label}
      </button>
    );
  }

  // Paso obligatorio antes de abrir sesión (a pedido de Enzo): elegir con
  // qué gym entrenás hoy, con "Sin gym" como salida válida (no todos los
  // días hay uno, y no vale la pena bloquear la sesión por eso) y crear uno
  // nuevo ahí mismo si hace falta —sin salir de esta pantalla, sin otro
  // sheet encima. Arranca en el gym que ya estaba activo, no en "Sin gym":
  // si ya elegiste uno la vez pasada, lo más probable es que sigas ahí.
  const [selGym, setSelGym] = useState(S.cfg.activeGym || '');
  const [addingGym, setAddingGym] = useState(false);
  const [gymName, setGymName] = useState('');
  function crearGym() {
    const n2 = gymName.trim();
    if (!n2) return;
    const gym = createGym(n2);
    if (gym) setSelGym(gym.id);
    setGymName('');
    setAddingGym(false);
  }

  async function abrir() {
    if (selGym !== (S.cfg.activeGym || '')) await setActiveGym(selGym || null);
    await startSession(index, precheckAdjust(), { preworkout: PRECHECK.pre });
    resetPrecheck();
    // El calentamiento general, antes de cualquier máquina. Se puede saltar:
    // si ya calentaste y te olvidaste de abrir la sesión, no te frena.
    openSheet('calentamiento', { index });
  }
  function cancelar() { resetPrecheck(); closeSheet(); }

  return (
    <>
      <h2>Antes de empezar</h2>
      <div className="sheet-sub">
        <b className="txt-blue">{day?.name || 'Entrenamiento'}</b> · {n} ejercicio{n === 1 ? '' : 's'}
      </div>

      <div className="calcbox">
        <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 8 }}>¿Dónde entrenás hoy?</div>
        <div className="chips">
          <button type="button" className={`chip ${selGym === '' ? 'on' : ''}`} aria-pressed={selGym === ''} onClick={() => setSelGym('')}>Sin gym</button>
          {S.gyms.map(g => (
            <button key={g.id} type="button" className={`chip ${selGym === g.id ? 'on' : ''}`} aria-pressed={selGym === g.id} onClick={() => setSelGym(g.id)}>{g.name}</button>
          ))}
          <button type="button" className="chip" onClick={() => setAddingGym(v => !v)}>+ Nuevo gym</button>
        </div>
        {addingGym && (
          <div className="flex gap-2 mt-2">
            <input
              type="text" placeholder="Nombre del gym" value={gymName}
              onChange={e => setGymName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') crearGym(); }}
              className="h-11 grow rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 text-body text-txt outline-none transition-colors focus-visible:border-blue2"
              autoFocus
            />
            <button type="button" className="btn sm" style={{ width: 'auto', padding: '0 var(--s4)' }} onClick={crearGym}>Crear</button>
          </div>
        )}
      </div>
      <div className="calcbox" style={{ marginTop: 10 }}>
        <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 8 }}>¿Cómo dormiste?</div>
        <div className="chips">{chip('sleep', 'bien', 'Bien')}{chip('sleep', 'regular', 'Regular')}{chip('sleep', 'mal', 'Mal')}</div>
      </div>
      <div className="calcbox" style={{ marginTop: 10 }}>
        <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 8 }}>¿Estás dolorido de algo?</div>
        <div className="chips">{chip('sore', true, 'Sí')}{chip('sore', false, 'No')}</div>
      </div>
      <div className="calcbox" style={{ marginTop: 10 }}>
        <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 8 }}>¿Motivación de hoy?</div>
        <div className="chips">{chip('motivation', 'baja', 'Baja')}{chip('motivation', 'normal', 'Normal')}{chip('motivation', 'alta', 'Alta')}</div>
      </div>
      {precheckAdjust() !== 0 && (
        <div className="text-mut text-micro mt-2">
          Ajuste sugerido hoy: {precheckAdjust() > 0 ? '+' : ''}{Math.round(precheckAdjust() * 100)}% sobre el peso sugerido
        </div>
      )}

      {/* Qué comiste antes (2026-09-24): opcional, se guarda con la sesión.
          El cálculo de cuánto tomar sigue a un toque, sin salir de acá. */}
      <div className="calcbox" style={{ marginTop: 10 }}>
        <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 8 }}>Pre-workout <span className="txt-mut">(opcional)</span></div>
        <div className="chips">{chip('pre', 'nada', 'Nada')}{chip('pre', 'liviano', 'Algo liviano')}{chip('pre', 'comida', 'Comida')}</div>
        <button type="button" className="linkcard txt-blue" style={{ fontSize: 13, marginTop: 8 }} onClick={() => openSheet('preworkout')}>Ver cuánto tomar ›</button>
      </div>
      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={abrir}>Abrir sesión</button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={cancelar}>Cancelar</button>
    </>
  );
}

/** Puerto del botón "hoy-voice" (index.html) — mismo patrón de
    SpeechRecognition que ExerciseForm.jsx (Task 5): ref a la instancia +
    estado local `recording` para el ícono/etiqueta. */
function VoiceLogButton() {
  const voiceRef = useRef(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => () => voiceRef.current?.stop(), []);

  function toggle() {
    if (!SR_CLASS) return;
    if (voiceRef.current) { voiceRef.current.stop(); return; } // toca de nuevo para cancelar
    const rec = new SR_CLASS();
    rec.lang = 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
    voiceRef.current = rec; setRecording(true);
    rec.onresult = e => {
      const txt = (e.results[0]?.[0]?.transcript || '').trim();
      if (!txt) return;
      const items = parseWorkoutSpeech(txt);
      if (!items.length) { toast(`No reconocí ningún ejercicio en "${txt}". Nombralos como están en tu rutina.`); return; }
      openSheet('voice-log', { items, duration: 60, raw: txt });
    };
    rec.onerror = () => toast('No se pudo escuchar. Probá de nuevo.');
    rec.onend = () => { voiceRef.current = null; setRecording(false); };
    rec.start();
  }

  return (
    <button
      type="button"
      className={`chip${recording ? ' on' : ''}`}
      onClick={toggle}
      title="Contá qué entrenaste y se anota solo"
      aria-label={recording ? 'Escuchando: tocá para cancelar' : 'Registrar por voz lo que entrenaste'}
    >
      {recording ? <RecordDot size={15} /> : <Mic size={15} />} {recording ? 'Escuchando…' : 'Registrar por voz'}
    </button>
  );
}

