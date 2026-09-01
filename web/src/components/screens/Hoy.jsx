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
import { staggerReveal, bloomOpen } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';
import { S, useStore, bump, openSheet, closeSheet, saveDraft, changeTab } from '../../lib/state.js';
import { WDS, MO, fmtMMSS } from '../../lib/format.js';
import { orderedExs, sessionExs, nextPending, setsDone, targetSets, isSkipped, startSession, discardSession, completeSession, moveBlock } from '../../lib/session.js';
import { flipSort } from '../../lib/drag.js';
import { blocksOf, catOf, MUSCLE_CATS } from '../../lib/muscle.js';
import { equipLabel } from '../../lib/equip.js';
import { parseWorkoutSpeech } from '../../lib/voice.js';
import ExerciseCarousel from '../ExerciseCarousel.jsx';
import WarmupCard from '../WarmupCard.jsx';
import { tocaCalentar, bloqueDe, DESCANSO } from '../../lib/warmup.js';
import { startRest } from '../../lib/rest.js';
import { toast } from '../../lib/toast.js';
import { Bolt, Mic, RecordDot } from '../Icon.jsx';
import { HoySinPlan } from '../Illustration.jsx';
import Silhouette from '../Silhouette.jsx';

const SR_CLASS = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;

export default function Hoy() {
  useStore();
  const today = new Date();
  const index = S.cfg.seqIndex;
  const day = S.routine[index];
  const active = !!S.draft;
  // Con sesión abierta la lista sale del borrador: incluye lo que agregaste
  // hoy, que no está en la rutina.
  const exs = active ? sessionExs(index) : orderedExs(index, day?.exercises || []);
  const started = active && !!S.draft.start;
  const curId = active ? S.draft.cur : null;
  const nextEx = active ? nextPending(exs) : null;
  const allDone = active && exs.length > 0 && !nextEx;

  // El próximo ejercicio a hacer decide qué calentamiento corresponde — no
  // necesariamente el primero del día: puede ser el primero de un bloque
  // nuevo (ver lib/warmup.js).
  const exCalentar = active ? (nextEx || exs[0]) : null;

  /* El calentamiento se marca hecho por BLOQUE en el borrador y no en un
     estado local: así sobrevive a cerrar la app en el medio, que es
     exactamente cuando pasa —dejás el teléfono, calentás, volvés—. Si
     viviera en React, al volver te lo ofrecería otra vez. */
  async function cerrarCalentamiento(conDescanso) {
    if (!S.draft || !exCalentar) return;
    const bloque = bloqueDe(exCalentar);
    if (bloque) {
      if (!Array.isArray(S.draft.warmBlocks)) S.draft.warmBlocks = [];
      if (!S.draft.warmBlocks.includes(bloque)) S.draft.warmBlocks.push(bloque);
    }
    await saveDraft();
    bump();
    if (conDescanso) startRest(DESCANSO);
  }
  const terminarCalentamiento = () => cerrarCalentamiento(true);
  const saltarCalentamiento = () => cerrarCalentamiento(false);

  // Bloom-open sutil para la tarjeta vacía "sin ejercicios hoy" al montar.
  const emptyCardRef = useRef(null);
  useEffect(() => {
    if (emptyCardRef.current) bloomOpen(emptyCardRef.current);
  }, [emptyCardRef.current]);

  return (
    <>
      {/* Hoy dejó de ser pestaña: se entra desde Inicio, así que necesita su
          propia salida. */}
      <div className="vtitle">
        <button type="button" className="back-btn" aria-label="Volver a Inicio" onClick={() => changeTab('inicio')}>‹</button>
        <h1>Hoy</h1>
        <span className="sub">{WDS[today.getDay()]} {today.getDate()} {MO[today.getMonth()]}</span>
      </div>

      {active ? (
        <ActiveHero day={day} exs={exs} started={started} allDone={allDone} activeEx={nextEx || (curId ? exs.find(e => e.id === curId) : null)} />
      ) : day?.type === 'rest' ? (
        <RestHero />
      ) : (
        <PreSessionHero day={day} index={index} exs={exs} />
      )}
      {/* el pre-workout se toma 30-60 min ANTES: durante la sesión ya no sirve de
          nada y solo compite con las tarjetas de ejercicio */}
      {!active && exs.length > 0 && (
        <button type="button" className="pw-btn" onClick={() => openSheet('preworkout')}>
          <Bolt size={20} className="pwi" /><span className="pwt">Pre-workout</span>
          <span className="text-mut text-[12.5px] font-medium">fluidos · carbos · cafeína</span>
          <span className="chev">›</span>
        </button>
      )}
      {/* registro retroactivo: para cuando entrenaste sin ir anotando serie por serie */}
      {!active && SR_CLASS && <VoiceLogButton />}

      {!exs.length ? (
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
        <>
          <BlockList index={index} exs={exs} />
          {exs.length > 1 && (
            <button type="button" className="btn sm ghost mb-[var(--s3)]" onClick={() => openSheet('reorder-hoy')}>
              ↕ Reordenar dentro de un bloque
            </button>
          )}
        </>
      ) : (
        <>
          {/* El calentamiento va antes del carrusel, sobre el próximo ejercicio
              a hacer — no fijo en el primero del día: reaparece cada vez que
              ese próximo ejercicio cae en un bloque muscular que todavía no
              calentaste (ver lib/warmup.js). */}
          {exCalentar && tocaCalentar(S.draft, exCalentar) && (
            <WarmupCard
              ex={exCalentar}
              onListo={terminarCalentamiento}
              onSaltar={saltarCalentamiento}
            />
          )}
          <ExerciseCarousel exs={exs} wd={index} active={active} started={started} curId={curId} nextEx={nextEx} />
          <div className="flex gap-2 mt-[var(--s2)]">
            {/* Decidiste hacer algo que no estaba en el plan. Vale sólo para hoy;
                al cerrar la sesión se ofrece dejarlo fijo. */}
            <button type="button" className="btn sm ghost flex-[2]" onClick={() => openSheet('ex-swap', { wd: index })}>
              + Agregar ejercicio
            </button>
            {/* Antes sólo se podía reacomodar el orden ANTES de arrancar
                (BlockList, más arriba): un ejercicio agregado en vivo quedaba
                pegado al final sin forma de moverlo. commitSort() ya escribe en
                S.draft.order cuando hay sesión abierta (setExOrder, session.js),
                así que ReorderHoy funciona igual acá que antes de arrancar. */}
            <button type="button" className="btn sm ghost flex-1" onClick={() => openSheet('reorder-hoy')}>
              ↕ Reordenar
            </button>
          </div>
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

function ActiveHero({ day, exs, started, allDone, activeEx }) {
  const nsets = Object.values(S.draft.entries).reduce((a, e) => a + e.sets.length, 0);
  const doneEx = exs.filter(e => !isSkipped(e.id) && setsDone(e.id).length >= targetSets(e)).length;
  const nSkip = exs.filter(e => isSkipped(e.id)).length;
  const cat = activeEx ? catOf(activeEx) : null;
  return (
    <div className="card hero">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'w-[9px] h-[9px] rounded-[5px] animate-pulse',
            started ? 'bg-ok shadow-[0_0_12px_var(--ok)]' : 'bg-warn shadow-[0_0_12px_var(--warn)]',
          )}
        ></span>
        <div className="grow flex-1">
          <div className="cond text-xl font-bold">{day?.name || 'Entrenamiento'}</div>
          <div className="text-mut text-[13px]">
            {started
              ? <><ElapsedTimer start={S.draft.start} /> · {doneEx}/{exs.length - nSkip} ejercicios · {nsets} serie{nsets === 1 ? '' : 's'}{nSkip > 0 ? ` · ${nSkip} saltado${nSkip === 1 ? '' : 's'}` : ''}</>
              : 'Sesión abierta · el reloj arranca cuando inicies el primer ejercicio'}
          </div>
        </div>
        {/* El cuerpo se reenciende en vivo con el grupo del ejercicio que
            estás a punto de hacer — no un vistazo fijo del día entero (eso
            ya lo viste antes de arrancar, en BlockList): acá importa "qué
            estoy por trabajar AHORA", así que cambia ejercicio a ejercicio. */}
        {cat && <div className="active-body-mini"><Silhouette days={{ [cat]: 0 }} interactivo={false} /></div>}
      </div>
      {allDone && (
        <div className="calcbox mt-3">
          <div className="text-sm leading-normal">
            🎉 Terminaste los {exs.length - nSkip} ejercicios que hiciste hoy.
            {nSkip > 0 && ` Saltaste ${nSkip}.`} Cerrá la sesión para guardarla.
          </div>
        </div>
      )}
      <div className="flex gap-2.5 mt-3.5">
        <button type="button" className="btn sm ok flex-[2]" onClick={confirmSessDone}>✓ Completar sesión</button>
        <button type="button" className="btn sm dim flex-1" onClick={confirmSessDiscard}>Descartar</button>
      </div>
    </div>
  );
}

function confirmSessDone() {
  openSheet('confirm', {
    title: 'Completar sesión',
    body: '¿Completar y guardar la sesión?',
    confirmLabel: 'Completar',
    onConfirm: () => completeSession(),
  });
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
function RestHero() {
  return (
    <div className="card hero">
      <div className="eyebrow">Hoy</div>
      <div className="hero-day">Descanso</div>
      <div className="text-mut text-[13px] mt-1.5">
        Mañana seguís con el próximo turno de tu rutina.
      </div>
    </div>
  );
}

/** El turno pendiente según la secuencia. Al completar un entrenamiento el
    puntero ya avanzó (session.js), así que acá siempre es el próximo por
    hacer — nunca uno ya cerrado —, y el eyebrow puede quedar fijo en "Toca
    hoy" sin comparar contra ningún día de la semana. */
function PreSessionHero({ day, index, exs }) {
  const totalSets = exs.reduce((a, e) => a + e.sets, 0);
  const estMin = Math.round(totalSets * ((S.cfg.rest || 90) + 40) / 60);
  return (
    <div className="card hero">
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
        <button type="button" className="btn hero-cta" onClick={() => openSheet('sess-start-info', { index })}>
          Empezar entrenamiento
        </button>
      )}
    </div>
  );
}

/** Los ejercicios de hoy agrupados por bloque muscular, con un vistazo del
    cuerpo arriba (qué grupos se encienden hoy), controles ▲▼ para mover
    BLOQUES enteros —nunca ejercicios sueltos, así un grupo nunca queda a
    medio mezclar con otro— y cada bloque desplegable para ver y editar sus
    ejercicios sin salir de Hoy. Sólo antes de arrancar: una vez que el
    reloj corre, orderedExs() ya no admite reacomodo (ver su comentario en
    session.js), así que este bloque ni se muestra con sesión activa. */
function BlockList({ index, exs }) {
  const blocks = blocksOf(exs);
  // El primer bloque arranca desplegado: es "qué toca primero", la
  // pregunta que trajo a alguien a esta pantalla — no una lista cerrada
  // que hay que aprender a abrir.
  const [openCat, setOpenCat] = useState(blocks[0]?.cat ?? null);
  const listRef = useRef(null);
  // Reveal escalonado de los bloques musculares del día al montar Hoy.
  useEffect(() => {
    const cards = listRef.current?.querySelectorAll(':scope > .block-card');
    if (cards?.length) staggerReveal(cards);
  }, []);
  /* Mueve el bloque y RECIÉN DESPUÉS pinta el nuevo orden adentro de
     flipSort: así flipSort mide el "antes" con el DOM viejo, deja que
     flushSync(bump) pinte el "después" de un tirón, y anima la diferencia
     con un transform — el mismo truco que ya usa Rutina.jsx para sus
     flechas ↑/↓ (handleMoveEx, drag.js). Sin esto el bloque cambia de
     posición de un salto: sólo el texto se ve distinto, nunca el
     movimiento. */
  async function mover(cat, dir) {
    await moveBlock(index, blocks, cat, dir);
    flipSort(() => flushSync(() => bump()));
  }

  return (
    <div className="block-list" data-sort="hoy-blocks" ref={listRef}>
      <BodyPreview cats={blocks.map(b => b.cat)} />
      {blocks.map((b, i) => {
        const open = openCat === b.cat;
        return (
          <div className="block-card" data-sid={b.cat} key={b.cat}>
            <button
              type="button"
              className="block-head"
              aria-expanded={open}
              onClick={() => setOpenCat(open ? null : b.cat)}
            >
              <span className="chev">{open ? '⌄' : '›'}</span>
              <span className="t">{b.cat}</span>
              <span className="s">{b.exs.length} ejercicio{b.exs.length === 1 ? '' : 's'}</span>
              {blocks.length > 1 && (
                <span className="block-move" onClick={e => e.stopPropagation()}>
                  <button type="button" disabled={i === 0} aria-label={`Mover ${b.cat} antes`} onClick={() => mover(b.cat, -1)}>▲</button>
                  <button type="button" disabled={i === blocks.length - 1} aria-label={`Mover ${b.cat} después`} onClick={() => mover(b.cat, 1)}>▼</button>
                </span>
              )}
            </button>
            <div className={`block-collapse${open ? ' open' : ''}`}>
              <div className="block-collapse-inner">
                <div className="block-exs">
                  {b.exs.map(ex => (
                    <div className="block-ex-row" key={ex.id}>
                      <button type="button" className="grow" onClick={() => openSheet('ex-info', { name: ex.name, exId: ex.id })}>
                        <span className="t">{ex.name}</span>
                        <span className="s">{equipLabel(ex) ? `${equipLabel(ex)} · ` : ''}{ex.sets}×{ex.reps}</span>
                      </button>
                      <button type="button" className="mini" aria-label={`Editar ${ex.name}`} onClick={() => openSheet('ex-form', { wd: index, ex })}>✎</button>
                    </div>
                  ))}
                  <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => openSheet('ex-form', { wd: index, ex: null })}>
                    + Agregar ejercicio
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** El cuerpo con los grupos de HOY encendidos — mismo componente y mismos
    colores que Inicio/BodyMap, pero acá "encendido" no es recencia (hace
    cuántos días), es "está en el plan de hoy sí o no": por eso arma su
    propio `days` en vez de reusar daysSinceAll(). */
function BodyPreview({ cats }) {
  const set = new Set(cats);
  const days = {};
  MUSCLE_CATS.forEach(c => { days[c] = set.has(c) ? 0 : null; });
  return <div className="block-body"><Silhouette days={days} interactivo={false} /></div>;
}

/** Las tres preguntas de autorregulación diaria (Plan Fierro · Fase 3, patrón
    Juggernaut AI/Whoop): sin sensores, 3 taps que ajustan ±10% el peso
    sugerido del día. Vive fuera del componente, mismo patrón que PW
    (Preworkout.jsx) — mutable a nivel de módulo, no persistido, se resetea
    solo al cerrar/reabrir el sheet. */
const PRECHECK = { sleep: null, sore: null, motivation: null };
function resetPrecheck() { PRECHECK.sleep = null; PRECHECK.sore = null; PRECHECK.motivation = null; }

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

  async function abrir() {
    await startSession(index, precheckAdjust());
    resetPrecheck();
  }
  function cancelar() { resetPrecheck(); closeSheet(); }

  return (
    <>
      <h2>Iniciar entrenamiento</h2>
      <div className="sheet-sub">
        Vas a abrir la sesión de <b className="txt-blue">{day?.name || 'Entrenamiento'}</b> · {n} ejercicio{n === 1 ? '' : 's'}.
      </div>

      <div className="calcbox">
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
        <div className="text-mut text-[12.5px] mt-2">
          Ajuste sugerido hoy: {precheckAdjust() > 0 ? '+' : ''}{Math.round(precheckAdjust() * 100)}% sobre el peso sugerido
        </div>
      )}

      <div className="calcbox" style={{ marginTop: 10 }}>
        <div style={{ fontSize: 14, lineHeight: 1.55 }}>
          ⏱ <b>El cronómetro arranca cuando toques "Iniciar ejercicio"</b>, no ahora. Así el tiempo mide lo que entrenaste y no lo que tardaste en cambiarte, calentar y llegar a la máquina.
        </div>
      </div>
      <div className="calcbox" style={{ marginTop: 10 }}>
        <div style={{ fontSize: 14, lineHeight: 1.55 }}>↕ Antes de arrancar podés <b>reacomodar el orden</b> con el botón "Reordenar", por si la máquina está ocupada.</div>
      </div>
      <div className="calcbox" style={{ marginTop: 10 }}>
        <div style={{ fontSize: 14, lineHeight: 1.55 }}>✓ Vas de a un ejercicio: al llegar a las series objetivo se cierra solo y pasás al siguiente.</div>
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
    <button type="button" className={`pw-btn${recording ? ' accent' : ''}`} onClick={toggle}>
      <span className="pwi">{recording ? <RecordDot size={20} /> : <Mic size={20} />}</span>
      <span className="pwt">{recording ? 'Escuchando…' : 'Registrar por voz'}</span>
      <span className="txt-mut" style={{ fontSize: 12.5, fontWeight: 500 }}>contá qué entrenaste hoy</span>
      <span className="chev">›</span>
    </button>
  );
}

