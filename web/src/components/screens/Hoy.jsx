// Puerto de renderHoy() (index.html) — la pantalla "Hoy" completa: hero de
// sesión activa / pre-sesión, semana en tira, tarjeta de volumen muscular,
// botones de pre-workout/voz, carrusel de ejercicios (ExerciseCarousel.jsx,
// componente propio por su lógica de scroll) e historial. Es la función más
// grande del original (~170 líneas) — acá se divide en subcomponentes
// hermanos dentro del mismo archivo (mismo criterio que Rutina.jsx con
// RutinaView/RutinaEdit/DayCard), no en archivos nuevos: el plan sólo pide
// un archivo para esta pantalla.
//
// SessStartInfo y HistDetail se exportan acá (no son de los "5 sheets" que
// pide el Paso 4 del brief, que sí tienen archivo propio) porque son
// contenido de sheet específico de Hoy sin lógica de scroll/drag que
// justifique aislarlos — mismo criterio que ConfirmSheet en App.jsx (sheet
// cross-cutting definido junto a quien lo usa). App.jsx los registra en el
// switch de <SheetContent/> como 'sess-start-info' y 'hist-detail'.
import { useEffect, useRef, useState } from 'react';
import { S, useStore, bump, openSheet, closeSheet } from '../../lib/state.js';
import { WD, WD1, WDS, MO, WEEK_ORDER, fmtMMSS, fmtDFull, fmtNum, round1 } from '../../lib/format.js';
import { orderedExs, nextPending, setsDone, startSession, discardSession, completeSession, deleteHistorySession } from '../../lib/session.js';
import { muscleVolume } from '../../lib/muscle.js';
import { parseWorkoutSpeech } from '../../lib/voice.js';
import ExerciseCarousel from '../ExerciseCarousel.jsx';
import { toast } from '../../lib/toast.js';

const SR_CLASS = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;

export default function Hoy() {
  useStore();
  const today = new Date();
  const wd = S.hoyDay ?? today.getDay();
  const day = S.routine[wd];
  const exs = orderedExs(wd, day?.exercises || []);
  const active = !!S.draft;
  const started = active && !!S.draft.start;
  const curId = active ? S.draft.cur : null;
  const nextEx = active ? nextPending(exs) : null;
  const allDone = active && exs.length > 0 && !nextEx;

  const mv = muscleVolume(7);
  const mvCats = Object.entries(mv).sort((a, b) => b[1] - a[1]);
  const maxv = mvCats.length ? mvCats[0][1] : 0;

  const hist = S.sessions.slice(0, 12);

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
          {day?.name && <PreSessionHero day={day} wd={wd} exs={exs} today={today} />}
          <div className="wkstrip">
            {WEEK_ORDER.map(d => {
              const dayR = S.routine[d];
              const has = dayR?.exercises?.length;
              const isToday = d === today.getDay();
              return (
                <button
                  key={d}
                  type="button"
                  className={`wd ${has ? 'has' : ''} ${d === wd ? 'on' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => { S.hoyDay = d; bump(); }}
                >
                  <div className="l">{WD1[d]}</div>
                  <div className="n">{has ? (dayR.name || 'Rutina') : 'Descanso'}</div>
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
        </>
      )}

      <div className="sect">Historial</div>
      {!hist.length ? (
        <div className="card"><div className="empty" style={{ padding: 18 }}><p style={{ margin: 0 }}>Tus sesiones completadas aparecerán aquí.</p></div></div>
      ) : (
        <div className="card">
          {hist.map(s => {
            const nsets = (s.entries || []).reduce((a, e) => a + e.sets.length, 0);
            return (
              <div key={s.id} className="row" style={{ cursor: 'pointer' }} onClick={() => openSheet('hist-detail', { id: s.id })}>
                <div className="grow">
                  <div className="t">{s.dayName || WD[s.weekday]}</div>
                  <div className="s">{fmtDFull(s.date)} · {s.duration} min · {nsets} series</div>
                </div>
                <span className="chev">›</span>
              </div>
            );
          })}
        </div>
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

function ActiveHero({ day, wd, exs, started, allDone }) {
  const nsets = Object.values(S.draft.entries).reduce((a, e) => a + e.sets.length, 0);
  const doneEx = exs.filter(e => setsDone(e.id).length >= e.sets).length;
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
              ? <><ElapsedTimer start={S.draft.start} /> · {doneEx}/{exs.length} ejercicios · {nsets} serie{nsets === 1 ? '' : 's'}</>
              : 'Sesión abierta · el reloj arranca cuando inicies el primer ejercicio'}
          </div>
        </div>
      </div>
      {allDone && (
        <div className="calcbox" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>🎉 Terminaste los {exs.length} ejercicios del día. Cerrá la sesión para guardarla.</div>
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

/** Puerto de sheetHist() (index.html) — detalle de una sesión del historial. */
export function HistDetail({ id }) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return null;
  return (
    <>
      <h2>{s.dayName || WD[s.weekday]}</h2>
      <div className="txt-mut" style={{ margin: '-8px 0 14px', fontSize: 14 }}>{fmtDFull(s.date)} · {s.duration} min</div>
      {(s.entries || []).map((e, i) => (
        <div key={i} className="card" style={{ padding: '12px 14px' }}>
          <div className="cond" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{e.name}</div>
          <div className="chips">{e.sets.map((st, j) => <span key={j} className="chip">{fmtNum(round1(st.w))}kg × {st.r}</span>)}</div>
        </div>
      ))}
      <button type="button" className="btn danger sm" style={{ marginTop: 6 }} onClick={() => confirmHistDel(s.id)}>Eliminar sesión</button>
    </>
  );
}

function confirmHistDel(id) {
  openSheet('confirm', {
    title: 'Eliminar sesión',
    body: 'Se elimina del historial. Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
    onConfirm: () => deleteHistorySession(id),
    onCancel: () => openSheet('hist-detail', { id }),
  });
}
