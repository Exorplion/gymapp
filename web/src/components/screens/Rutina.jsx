// Puerto de renderRutina() (index.html) — pantalla Rutina completa: resumen
// de la semana (modo "view") y editor día por día (modo "edit"), según
// S.rutMode. Sigue el mismo mecanismo de sheets de Task 1/5 (S.sheet vía
// openSheet/closeSheet, ver state.js) y el mismo drag-to-reorder de Task 3/4
// (data-sort/data-sid, ver drag.js) para días (kind="days") y ejercicios
// dentro de un día (kind="rut" — el mismo string que usaba el original y que
// commitSort() ya distingue de "hoy"/"days").
import { flushSync } from 'react-dom';
import { S, bump, useStore, openSheet } from '../../lib/state.js';
import { WD, WD1, WEEK_ORDER } from '../../lib/format.js';
import { exInfo, rirScheme } from '../../lib/exdb.js';
import { equipLabel } from '../../lib/equip.js';
import { catOf } from '../../lib/muscle.js';
import { flipSort } from '../../lib/drag.js';
import {
  routineStats, routineName, activeDayWds,
  enterEditMode, exitEditMode, toggleDayOpen, deleteDay, deleteExercise, moveEx,
} from '../../lib/rutina-logic.js';
import { toast } from '../../lib/toast.js';

/** Puerto del guard de sheetLibSave() (index.html): "No hay rutina que
    guardar" si S.routine no tiene ningún día con ejercicios. En el original
    este chequeo vive DENTRO de sheetLibSave, así que es el único punto de
    entrada al formulario de guardado — acá el editor tiene un segundo punto
    de entrada (el botón "Guardar como…" de la barra de edición, además del
    de Library.jsx en modo lista), así que el guard se repite acá para que
    ningún camino hacia el sheet 'library'/{mode:'save'} se lo salte. */
function openLibSaveSheet() {
  if (!routineStats().days.length) { toast('No hay rutina que guardar'); return; }
  openSheet('library', { mode: 'save' });
}

/** Envuelve moveEx (↑/↓) con la animación FLIP del original (flipSort mide
    el DOM antes/después de la mutación). moveEx() en sí NO llama bump() —
    el flushSync de acá es lo que fuerza el re-render sincrónico que flipSort
    necesita para medir la posición "after" correctamente; sin esto React
    podría no haber pintado todavía cuando flipSort mide, y la animación no
    se vería (aunque el reordenamiento en sí seguiría siendo correcto). */
async function handleMoveEx(wd, exId, dir) {
  await moveEx(wd, exId, dir);
  flipSort(() => flushSync(() => bump()));
}

export default function Rutina() {
  useStore();
  return S.rutMode !== 'edit' ? <RutinaView /> : <RutinaEdit />;
}

function RutinaView() {
  const st = routineStats();
  const maxSets = Math.max(1, ...WEEK_ORDER.map(d => S.routine[d]?.exercises?.reduce((a, e) => a + e.sets, 0) || 0));

  if (!st.days.length) {
    return (
      <>
        <div className="vtitle"><h1>Rutina</h1><span className="sub">tu semana de un vistazo</span></div>
        <div className="card"><div className="empty">
          <div className="big">🏗</div>
          <p>Todavía no tenés rutina.<br />Elegí una <b>plantilla</b> lista o armá tu split día por día.</p>
          <button
            type="button"
            className="btn sm"
            style={{ maxWidth: 260, margin: '0 auto' }}
            onClick={() => openSheet('library')}
          >
            Ver rutinas y plantillas
          </button>
        </div></div>
        <button type="button" className="btn ghost" style={{ marginTop: 'var(--s3)' }} onClick={enterEditMode}>
          ✎ Armar mi rutina
        </button>
      </>
    );
  }

  return (
    <>
      <div className="vtitle"><h1>Rutina</h1><span className="sub">tu semana</span></div>

      {/* Tarjeta del plan. El mockup le da a cada pantalla un matiz propio:
          Hoy es azul, Rutina es violeta. */}
      <div className="card hero hero-plan">
        <div className="hero-eyebrow">Plan activo</div>
        <div className="hero-day">{routineName()}</div>
        <div className="txt-mut" style={{ fontSize: 13, marginTop: 4 }}>
          {st.days.length} día{st.days.length === 1 ? '' : 's'} de entrenamiento · {st.ex} ejercicios · {st.sets} series por semana
        </div>
        {/* Barras proporcionales a las series del día: la semana se lee de un
            vistazo, y los días libres quedan como un guion bajo. */}
        <div className="weekbars">
          {WEEK_ORDER.map(d => {
            const dd = S.routine[d];
            const sets = dd?.exercises?.reduce((a, e) => a + e.sets, 0) || 0;
            const h = sets ? Math.round(30 + (sets / maxSets) * 40) : 10;
            return (
              <div key={d} className={`wbar ${sets ? 'on' : ''}`}>
                <div className="b" style={{ height: h }}></div>
                <span>{WD1[d]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="btn" onClick={enterEditMode}>Editar rutina</button>
        <button type="button" className="btn glass" onClick={() => openSheet('library')}>Mis rutinas</button>
      </div>

      {/* Cada día es una tarjeta que se despliega en el lugar, con sus
          ejercicios numerados — en el original abría un sheet aparte. */}
      <div className="day-cards">
        {WEEK_ORDER.map(d => {
          const dd = S.routine[d];
          const on = !!dd?.exercises?.length;
          const sets = on ? dd.exercises.reduce((a, e) => a + e.sets, 0) : 0;
          const open = S.rutOpen === d && on;
          return (
            <div key={d} className={`day-card ${open ? 'open' : ''}`}>
              <button
                type="button"
                className="day-head"
                onClick={() => { S.rutOpen = open ? -1 : d; bump(); }}
              >
                <span className={`day-badge ${on ? '' : 'off'}`}>{WD1[d]}</span>
                <span className="grow">
                  <span className="t">{on ? (dd.name || WD[d]) : 'Descanso'}</span>
                  <span className="s">{on ? `${dd.exercises.length} ejercicios · ${sets} series` : 'libre'}</span>
                </span>
                <span className="chev">{open ? '⌄' : '›'}</span>
              </button>
              {open && (
                <div className="day-exs">
                  {dd.exercises.map((e, i) => (
                    <div key={e.id} className="day-ex">
                      <span className="i">{i + 1}</span>
                      <span className="grow">
                        <span className="t">{e.name}</span>
                        <span className="s">
                          {equipLabel(e) && <span className="eq-tag">{equipLabel(e)}</span>}
                          RIR {rirScheme(e.sets).join('/')}
                        </span>
                      </span>
                      <span className="x">{e.sets}×{e.reps}</span>
                    </div>
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
  const active = activeDayWds();

  return (
    <>
      <div className="vtitle"><h1>Editar</h1><span className="sub">{routineName()}</span></div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--s4)' }}>
        <button type="button" className="btn sm ghost" style={{ flex: 1 }} onClick={exitEditMode}>‹ Listo</button>
        <button
          type="button"
          className="btn sm ghost"
          style={{ flex: 1 }}
          onClick={openLibSaveSheet}
        >
          💾 Guardar como…
        </button>
      </div>
      {active.length > 0 && (
        <div className="drag-hint tight"><span>↕</span><span>Mantené presionado un día y soltalo sobre otro para moverlo ahí.</span></div>
      )}
      {/* Los siete días, siempre. Antes sólo se listaban los activos y los
          libres eran chips aparte, así que no había forma de arrastrar una
          rutina a un día de descanso — que es justo el caso de "entreno martes
          y jueves, no lunes y miércoles". Cada tarjeta es un destino de drop. */}
      <div data-sort="days">
        {WEEK_ORDER.map(wd => <DayCard key={wd} wd={wd} />)}
      </div>
    </>
  );
}
function DayCard({ wd }) {
  const d = S.routine[wd];
  const exs = d?.exercises || [];
  const empty = !d?.name && !exs.length;
  const open = S.rutOpen === wd && !empty;
  const fx = S.dayFx[wd];
  // referencia del riel: el ejercicio con más series del día
  const maxSets = Math.max(1, ...exs.map(e => e.sets || 0));

  // Día libre: una tarjeta fina, sin cuerpo. Sigue siendo arrastrable y sobre
  // todo soltable — es el destino natural al correr una rutina de día.
  if (empty) {
    return (
      <div className={`card day rest ${fx ? `fx-${fx}` : ''}`} data-wd={wd} data-sid={wd}>
        <div className="day-headrow">
          <span className="mini day-handle" title="Arrastrar">✥</span>
          <button type="button" className="day-head" onClick={() => openSheet('day-edit', { wd })}>
            <div className="day-txt">
              <span className="day-wd">{WD[wd]}</span>
              <span className="day-name off">Descanso</span>
            </div>
            <span className="day-meta">asignar<span className="chev">›</span></span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`card day ${open ? 'open' : ''} ${fx ? `fx-${fx}` : ''}`} data-wd={wd} data-sid={wd}>
      <div className="day-headrow">
        <span className="mini day-handle" title="Arrastrar a otro día">✥</span>
        <button type="button" className="day-head" onClick={() => toggleDayOpen(wd)}>
          <div className="day-txt">
            <span className="day-wd">{WD[wd]}</span>
            <span className={`day-name ${d?.name ? '' : 'off'}`}>{d?.name || 'Descanso / sin asignar'}</span>
          </div>
          <span className="day-meta">{exs.length ? `${exs.length} ej.` : ''}<span className="chev">›</span></span>
        </button>
        <button type="button" className="mini red" title="Vaciar día" onClick={() => deleteDay(wd)}>✕</button>
      </div>
      <div className="day-body"><div className="dbi">
        {exs.length > 1 && (
          <div className="drag-hint tight"><span>↕</span><span>Mantené presionado un ejercicio para reordenarlo.</span></div>
        )}
        <div data-sort="rut" data-wd={wd} style={{ '--lift': 1.015 }}>
          {/* El nombre va en su propia línea a ancho completo. Cuando esto era
              una .row con los cinco botones al lado, en 320px al nombre le
              quedaban 62px: los 40 ejercicios del split se veían como
              "Press ...", "Pec de...", "Leg pr...". */}
          {exs.map((ex, i) => (
            <div
              className="ex-row" data-sid={ex.id} key={ex.id}
              /* el riel se llena según las series de ESTE ejercicio contra el
                 que más tiene del día: la lista se vuelve un gráfico del
                 reparto de volumen, que es lo que estás decidiendo acá */
              style={{ '--fill': maxSets ? ex.sets / maxSets : 1, '--i': i }}
            >
              <div className="ex-row-top">
                <span className="eyebrow">{i + 1} · {catOf(ex) || 'sin grupo'}</span>
                <button
                  type="button"
                  className="mini info inline"
                  data-act="ex-info"
                  style={exInfo(ex.name) ? undefined : { opacity: .4 }}
                  onClick={() => openSheet('ex-info', { name: ex.name, wd, exId: ex.id })}
                >
                  ⓘ
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
                    onClick={() => handleMoveEx(wd, ex.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="mini"
                    data-act="ex-down"
                    disabled={i === exs.length - 1}
                    onClick={() => handleMoveEx(wd, ex.id, 1)}
                  >
                    ↓
                  </button>
                  <button type="button" className="mini" onClick={() => openSheet('ex-form', { wd, ex })}>✎</button>
                  <button type="button" className="mini red" onClick={() => deleteExercise(wd, ex.id)}>✕</button>
                </span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button type="button" className="btn sm ghost" style={{ flex: 2 }} onClick={() => openSheet('ex-form', { wd, ex: null })}>
            + Ejercicio
          </button>
          <button type="button" className="btn sm dim" style={{ flex: 1 }} onClick={() => openSheet('day-edit', { wd })}>
            ✎ Día
          </button>
        </div>
        {/* Anterior A y Anterior B son la misma rutina: sin esto había que
            cargar los mismos nueve ejercicios a mano dos veces, y cada
            corrección otras dos. Botones siempre visibles y no un aviso al
            salir del editor — un cartel cada vez que terminás de editar se
            vuelve ruido y termina en que lo cerrás sin leer. */}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            type="button" className="btn sm dim" style={{ flex: 1 }}
            disabled={!exs.length}
            onClick={() => openSheet('copy-exs', { mode: 'push', wd })}
          >
            ⧉ Copiar a otro día
          </button>
          <button type="button" className="btn sm dim" style={{ flex: 1 }} onClick={() => openSheet('copy-exs', { mode: 'pull', wd })}>
            ⤓ Traer de otro día
          </button>
        </div>
      </div></div>
    </div>
  );
}
