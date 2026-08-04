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
import { S, useStore, bump, openSheet, closeSheet } from '../../lib/state.js';
import { WD, WD1, WDS, MO, WEEK_ORDER, fmtMMSS, fmtNum, round1 } from '../../lib/format.js';
import { orderedExs, sessionExs, nextPending, setsDone, targetSets, isSkipped, startSession, discardSession, completeSession, sessionForWeekday, sessionPRs } from '../../lib/session.js';
import { muscleVolume, uncategorized } from '../../lib/muscle.js';
import { parseWorkoutSpeech } from '../../lib/voice.js';
import ExerciseCarousel from '../ExerciseCarousel.jsx';
import { toast } from '../../lib/toast.js';

const SR_CLASS = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;


/** Devuelve 'r' o 'l' según hacia qué lado del orden semanal se movió el día
    elegido desde el render anterior. Se usa sólo para decidir de qué lado
    entra la tarjeta: no participa del estado de la app. */
function useDayDirection() {
  const wd = S.hoyDay ?? new Date().getDay();
  const prev = useRef(wd);
  const dir = useRef('r');
  if (prev.current !== wd) {
    dir.current = WEEK_ORDER.indexOf(wd) >= WEEK_ORDER.indexOf(prev.current) ? 'r' : 'l';
    prev.current = wd;
  }
  return dir.current;
}

export default function Hoy() {
  useStore();
  // Hacia qué lado se movió el usuario en la tira semanal: la tarjeta entra
  // desde ese lado, así el gesto y la animación coinciden.
  const dir = useDayDirection();
  const today = new Date();
  const wd = S.hoyDay ?? today.getDay();
  const day = S.routine[wd];
  const active = !!S.draft;
  // Con sesión abierta la lista sale del borrador: incluye lo que agregaste
  // hoy, que no está en la rutina.
  const exs = active && S.draft.weekday === wd ? sessionExs(wd) : orderedExs(wd, day?.exercises || []);
  const started = active && !!S.draft.start;
  const curId = active ? S.draft.cur : null;
  const nextEx = active ? nextPending(exs) : null;
  const allDone = active && exs.length > 0 && !nextEx;

  // Para que el plegado se pueda animar, el contenido tiene que seguir
  // montado mientras la ranura se cierra: si se desmonta al instante no queda
  // nada cuya altura interpolar y el colapso salta a 0. Conservamos el último
  // día con rutina y lo seguimos pintando; cuando la ranura está cerrada
  // queda oculto por el overflow.
  const lastShown = useRef(null);
  if (day?.name) lastShown.current = { day, wd, exs };
  const shown = lastShown.current;

  const mv = muscleVolume(7);
  const mvCats = Object.entries(mv).sort((a, b) => b[1] - a[1]);
  const maxv = mvCats.length ? mvCats[0][1] : 0;


  return (
    <>
      <div className="vtitle"><h1>Hoy</h1><span className="sub">{WDS[today.getDay()]} {today.getDate()} {MO[today.getMonth()]}</span></div>

      {active ? (
        <ActiveHero day={day} wd={wd} exs={exs} started={started} allDone={allDone} />
      ) : (
        <>
          {/* El mockup pone la tarjeta del día PRIMERO y la tira semanal
              debajo: lo primero que ves es qué te toca hoy, no el calendario.
              Antes estaba al revés. */}
          {/* Ranura con altura animada: al cambiar de día la tarjeta se
              despliega o se pliega en vez de aparecer/desaparecer de golpe.
              El grid-template-rows 0fr↔1fr es lo que permite animar "auto"
              sin medir alturas a mano. La key por día hace que el contenido
              entre de nuevo al pasar de un día de entrenamiento a otro. */}
          <div className={`hero-slot ${day?.name ? 'open' : ''}`} aria-hidden={!day?.name}>
            <div className="hero-slot-in">
              {shown && (
                <div key={shown.wd} className={`hero-swap dir-${dir}`}>
                  <HeroForDay day={shown.day} wd={shown.wd} exs={shown.exs} today={today} />
                </div>
              )}
            </div>
          </div>
          <div className="wkstrip">
            {WEEK_ORDER.map(d => {
              const dayR = S.routine[d];
              const has = dayR?.exercises?.length;
              const isToday = d === today.getDay();
              const hecho = !!has && !!sessionForWeekday(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`wd ${has ? 'has' : ''} ${d === wd ? 'on' : ''} ${isToday ? 'today' : ''} ${hecho ? 'done' : ''}`}
                  onClick={() => { S.hoyDay = d; bump(); }}
                >
                  <div className="l">{WD1[d]}</div>
                  <div className="n">{has ? (dayR.name || 'Rutina') : 'Descanso'}</div>
                  {hecho && <div className="tick">✓</div>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mvCats.length > 0 && (
        <>
        {/* En el mockup el encabezado va FUERA de la tarjeta, con su línea
            hasta el borde — no como etiqueta interna. */}
        <div className="sect">Músculos esta semana</div>
        <div className="card">
          {mvCats.map(([c, n]) => (
            <div key={c} style={{ marginBottom: 'var(--s2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-sm)', marginBottom: 3 }}>
                <span>{c}</span><span className="num">{n} series</span>
              </div>
              <div className="pbar">
                <i style={{ width: `${Math.round(n / maxv * 100)}%`, animation: 'rise .5s var(--ease) backwards' }}></i>
              </div>
            </div>
          ))}
          <div className="txt-mut" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 12 }}>
            10–20 series semanales por grupo es el rango habitual para ganar masa.
          </div>
          <SinGrupoAviso />
        </div>
        </>
      )}

      {/* el pre-workout se toma 30-60 min ANTES: durante la sesión ya no sirve de
          nada y solo compite con las tarjetas de ejercicio */}
      {!active && exs.length > 0 && (
        <button type="button" className="pw-btn" onClick={() => openSheet('preworkout')}>
          <span className="pwi">⚡</span><span className="pwt">Pre-workout</span>
          <span className="txt-mut" style={{ fontSize: 12.5, fontWeight: 500 }}>fluidos · carbos · cafeína</span>
          <span className="chev">›</span>
        </button>
      )}
      {/* registro retroactivo: para cuando entrenaste sin ir anotando serie por serie */}
      {!active && SR_CLASS && <VoiceLogButton />}

      {!exs.length ? (
        <div className="card"><div className="empty">
          <div className="big">🏋️</div>
          <p>No hay rutina para <b>{WD[wd]}</b>.<br />Configura tu split en la pestaña Rutina.</p>
          <button
            type="button"
            className="btn sm ghost"
            style={{ maxWidth: 240, margin: '0 auto' }}
            onClick={() => { S.tab = 'rutina'; bump(); }}
          >
            Configurar rutina
          </button>
        </div></div>
      ) : (
        <>
          {exs.length > 1 && (
            <button type="button" className="btn sm ghost" style={{ marginBottom: 'var(--s3)' }} onClick={() => openSheet('reorder-hoy')}>
              ↕ Reordenar
            </button>
          )}
          <ExerciseCarousel exs={exs} wd={wd} active={active} started={started} curId={curId} nextEx={nextEx} />
          {/* Decidiste hacer algo que no estaba en el plan. Vale sólo para hoy;
              al cerrar la sesión se ofrece dejarlo fijo. */}
          {active && (
            <button type="button" className="btn sm ghost" style={{ marginTop: 'var(--s2)' }} onClick={() => openSheet('ex-swap', { wd })}>
              + Agregar ejercicio a esta sesión
            </button>
          )}
        </>
      )}

    </>
  );
}

/** Los ejercicios sin grupo muscular no suman en esta tarjeta. Antes se
    descartaban en silencio, así que el resumen se veía completo cuando no lo
    estaba — de 22 ejercicios reales, 18 no contaban y no había forma de
    saberlo. Ahora se dicen y se pueden asignar. */
function SinGrupoAviso() {
  const sin = uncategorized();
  if (!sin.length) return null;
  return (
    <button
      type="button"
      className="sin-grupo"
      onClick={() => { S.tab = 'rutina'; S.rutMode = 'edit'; bump(); }}
    >
      <span className="t">
        {sin.length} ejercicio{sin.length === 1 ? '' : 's'} sin grupo muscular · no suma{sin.length === 1 ? '' : 'n'} acá
      </span>
      <span className="s">{sin.slice(0, 4).map(e => e.name).join(' · ')}{sin.length > 4 ? ` +${sin.length - 4}` : ''}</span>
      <span className="a">Asignar →</span>
    </button>
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

function ActiveHero({ day, wd, exs, started, allDone }) {
  const nsets = Object.values(S.draft.entries).reduce((a, e) => a + e.sets.length, 0);
  const doneEx = exs.filter(e => !isSkipped(e.id) && setsDone(e.id).length >= targetSets(e)).length;
  const nSkip = exs.filter(e => isSkipped(e.id)).length;
  return (
    <div className="card hero">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 9, height: 9, borderRadius: 5,
          background: started ? 'var(--ok)' : 'var(--warn)',
          boxShadow: `0 0 12px ${started ? 'var(--ok)' : 'var(--warn)'}`,
          animation: 'pulse 1.5s infinite',
        }}></span>
        <div className="grow" style={{ flex: 1 }}>
          <div className="cond" style={{ fontSize: 20, fontWeight: 700 }}>{day?.name || WD[wd]}</div>
          <div className="txt-mut" style={{ fontSize: 13 }}>
            {started
              ? <><ElapsedTimer start={S.draft.start} /> · {doneEx}/{exs.length - nSkip} ejercicios · {nsets} serie{nsets === 1 ? '' : 's'}{nSkip > 0 ? ` · ${nSkip} saltado${nSkip === 1 ? '' : 's'}` : ''}</>
              : 'Sesión abierta · el reloj arranca cuando inicies el primer ejercicio'}
          </div>
        </div>
      </div>
      {allDone && (
        <div className="calcbox" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            🎉 Terminaste los {exs.length - nSkip} ejercicios que hiciste hoy.
            {nSkip > 0 && ` Saltaste ${nSkip}.`} Cerrá la sesión para guardarla.
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="btn sm ok" style={{ flex: 2 }} onClick={confirmSessDone}>✓ Completar sesión</button>
        <button type="button" className="btn sm dim" style={{ flex: 1 }} onClick={confirmSessDiscard}>Descartar</button>
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

/** Un día de esta semana que ya tiene sesión cerrada muestra el resumen; el
    resto, la invitación a empezar. */
function HeroForDay({ day, wd, exs, today }) {
  const done = sessionForWeekday(wd);
  return done
    ? <DoneHero sess={done} wd={wd} today={today} />
    : <PreSessionHero day={day} wd={wd} exs={exs} today={today} />;
}

/** El día de esta semana que ya entrenaste. Antes acá seguía apareciendo
    "Empezar entrenamiento" como si nada: nadie miraba S.sessions para saber si
    el día ya se había cerrado.

    El botón principal pasa a ser mirar lo que hiciste. Volver a entrenar queda
    como texto discreto — existe para la doble sesión y para el día que te
    equivocaste, no como camino principal. */
function DoneHero({ sess, wd, today }) {
  const nsets = (sess.entries || []).reduce((a, e) => a + e.sets.length, 0);
  const prs = sessionPRs(sess);
  return (
    <div className="card hero done-hero">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--ok)', boxShadow: '0 0 8px var(--ok)' }}></span>
        <div className="txt-mut" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          Completado · {wd === today.getDay() ? 'hoy' : WD[wd]}
        </div>
      </div>
      <div className="hero-day">{sess.dayName || WD[wd]}</div>
      <div className="hero-stats">
        <div><div className="cond">{sess.duration}</div><span>Minutos</span></div>
        <div><div className="cond">{nsets}</div><span>Series</span></div>
        <div><div className="cond">{(sess.entries || []).length}</div><span>Ejercicios</span></div>
      </div>
      {prs.length > 0 && (
        <div className="done-pr">
          🏆 {prs.length} récord{prs.length === 1 ? '' : 's'} · {prs.map(p => `${p.name} ${fmtNum(round1(p.w))} × ${p.r}`).join(' · ')}
        </div>
      )}
      <button type="button" className="btn hero-cta ok" onClick={() => openSheet('session-view', { id: sess.id })}>
        Ver lo que hiciste
      </button>
      <button type="button" className="done-again" onClick={() => openSheet('sess-start-info', { wd })}>
        Entrenar de nuevo
      </button>
    </div>
  );
}

function PreSessionHero({ day, wd, exs, today }) {
  const totalSets = exs.reduce((a, e) => a + e.sets, 0);
  const estMin = Math.round(totalSets * ((S.cfg.rest || 90) + 40) / 60);
  return (
    <div className="card hero">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' }}></span>
        <div className="txt-mut" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          {wd === today.getDay() ? 'Toca hoy' : WD[wd]}
        </div>
      </div>
      {/* 46px e itálica: en el mockup el nombre del día es el elemento más
          grande de la pantalla, por encima del propio título "HOY". */}
      <div className="hero-day">{day.name}</div>
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
        <button type="button" className="btn hero-cta" onClick={() => openSheet('sess-start-info', { wd })}>
          Empezar entrenamiento
        </button>
      )}
    </div>
  );
}

/** Sheet informativo previo a abrir la sesión (data-act="sess-start" del
    original) — separado de 'sess-start-go', que en el puerto es
    startSession() (session.js). */
export function SessStartInfo({ wd }) {
  const day = S.routine[wd];
  const n = day?.exercises?.length || 0;
  return (
    <>
      <h2>Iniciar entrenamiento</h2>
      <div className="txt-mut" style={{ fontSize: 14, lineHeight: 1.55, margin: '-8px 0 16px' }}>
        Vas a abrir la sesión de <b className="txt-blue">{day?.name || WD[wd]}</b> · {n} ejercicio{n === 1 ? '' : 's'}.
      </div>
      <div className="calcbox">
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
      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => startSession(wd)}>Abrir sesión</button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={closeSheet}>Cancelar</button>
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
      <span className="pwi">{recording ? '🔴' : '🎤'}</span>
      <span className="pwt">{recording ? 'Escuchando…' : 'Registrar por voz'}</span>
      <span className="txt-mut" style={{ fontSize: 12.5, fontWeight: 500 }}>contá qué entrenaste hoy</span>
      <span className="chev">›</span>
    </button>
  );
}

