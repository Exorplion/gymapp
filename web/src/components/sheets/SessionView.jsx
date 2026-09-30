// Una sola vista para una sesión, con tres entradas: al terminarla
// (justFinished), al tocarla en el historial, y desde el día ya completado en
// Hoy. Lee la sesión de S.sessions POR ID, no por prop, para que una edición
// se refleje sin cerrar y reabrir el sheet.
//
// "Lo que hiciste" era una tarjeta plana por ejercicio: el nombre y una fila
// de chips. Sin grupo muscular, sin resumen y sin relación con la vez
// anterior — la vista donde uno mira "cómo me fue" no contestaba esa pregunta.
// Ahora cada ejercicio es una .dcard con su grupo, sus series numeradas, su
// volumen y cuánto cambió respecto de la última vez.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { S, useStore, openSheet, closeSheet } from '../../lib/state.js';
import { fmtDFull, fmtKg, fmtMiles, fmtNum, round1, uid } from '../../lib/format.js';
import { sessionPRs, deleteHistorySession, updateHistorySession, entryDelta, groupSets, cargarSeriesRetro, seriesDeEjercicio } from '../../lib/session.js';
import { pinAddedToRoutine } from '../../lib/rutina-logic.js';
import { catOf } from '../../lib/muscle.js';
import { equipLabel, exKey } from '../../lib/equip.js';
import { toast } from '../../lib/toast.js';
import { iconOf } from '../../lib/exicon.js';
import ExIcon from '../ExIcon.jsx';
import { Baja, Check, Pencil, Plus, Skip, Sube, Trofeo, X } from '../Icon.jsx';
import { sheetReveal } from '../../lib/motion.js';
import { importarConRespaldo } from '../../lib/lazy-respaldo.js';
// El burst de récord vive en su propio módulo y entra por React.lazy: son
// 320 KB de lottie-web (la dependencia más pesada de la app, 24% del bundle)
// para UNA animación de 44×44 que sólo se ve al cerrar la sesión que generó el
// récord. Cargarla ahí y no en el arranque saca ese parse+eval del arranque en
// frío sin cambiar nada de lo que se ve. Ver components/PrBurst.jsx.
// Si el módulo no llega (p.ej. una pantalla abierta desde antes de una
// publicación pide un archivo que ya no existe), se queda el trofeo fijo en
// vez de caer la pantalla entera: es decorativo. Ver lib/lazy-respaldo.js.
const TrofeoFijo = () => <div className="pr-troph"><Trofeo size={24} /></div>;
const PrBurst = lazy(() => importarConRespaldo(() => import('../PrBurst.jsx'), TrofeoFijo));

export default function SessionView({ id, justFinished = false }) {
  useStore();
  const [editando, setEditando] = useState(false);
  // La pregunta de fijar lo agregado se responde una vez y no vuelve
  const [pinResuelto, setPinResuelto] = useState(false);
  const entriesRef = useRef(null);
  const s = S.sessions.find(x => x.id === id);

  useEffect(() => {
    if (entriesRef.current) sheetReveal(entriesRef.current.children);
  }, [id]);

  if (!s) return null;

  const prs = sessionPRs(s);
  const hasPR = prs.length > 0;
  const prKeys = new Set(prs.map(exKey));
  const entries = s.entries || [];
  const nsets = entries.reduce((a, e) => a + e.sets.length, 0);
  const vol = entries.reduce((a, e) => a + e.sets.reduce((b, st) => b + st.w * st.r, 0), 0);
  const delDia = (S.routine.find(sl => sl.id === s.slotId)?.exercises || []).filter(ex => !entries.some(e => e.name === ex.name));

  /* Toda edición clona la sesión, la muta y la manda entera a
     updateHistorySession — que guarda y ofrece Deshacer. start, end, duration,
     date, weekday y dayName no se tocan en ninguna de estas funciones: el
     tiempo que quedó registrado en el gimnasio es un hecho medido. */
  function editar(fn, msg) {
    const copia = structuredClone(s);
    fn(copia);
    copia.entries = (copia.entries || []).filter(e => e.sets.length);
    // Una sesión sin series no es una corrección, es un borrado a medias: deja
    // un registro fantasma con su duración pero sin nada adentro.
    if (!copia.entries.length) {
      toast('Una sesión no puede quedar vacía — usá "Eliminar sesión"');
      return;
    }
    updateHistorySession(copia, msg);
  }

  const setSerie = (ei, si, campo, valor) => editar(c => {
    c.entries[ei].sets[si][campo] = campo === 'w'
      ? Math.max(0, round1(parseFloat(String(valor).replace(',', '.')) || 0))
      : Math.max(1, parseInt(valor, 10) || 1);
  }, 'Serie corregida');

  const borrarSerie = (ei, si) => editar(c => { c.entries[ei].sets.splice(si, 1); }, 'Serie borrada');

  const agregarSerie = ei => editar(c => {
    const sets = c.entries[ei].sets;
    const ult = sets[sets.length - 1];
    sets.push({ w: ult ? ult.w : 20, r: ult ? ult.r : 10, t: Date.now() });
  }, 'Serie agregada');

  const borrarEjercicio = ei => editar(c => { c.entries[ei].sets = []; }, 'Ejercicio borrado');

  /* Arranca con lo último de ESE ejercicio antes de la fecha de la sesión,
     o con la meta si nunca se hizo (seriesDeEjercicio) — antes, 20 kg
     fijos. Las horas quedan en el día de la sesión, no en el de hoy. */
  const agregarEjercicio = ex => editar(c => {
    const t0 = new Date(c.date + 'T12:00:00').getTime();
    c.entries.push({
      exId: ex.id || uid(), name: ex.name, equip: ex.equip, machine: ex.machine, cat: ex.cat, unilateral: ex.unilateral,
      sets: seriesDeEjercicio(ex, c.date).map((st, i) => ({ ...st, t: t0 + i * 60000 })),
    });
  }, `${ex.name} agregado`);

  return (
    <>
      {/* Sin emoji en el título (auditoría total, H9): el festejo, si hubo
          récord, lo hace la tarjeta del récord de abajo. */}
      <h2>{justFinished ? 'Sesión guardada' : (s.dayName || 'Entrenamiento')}</h2>
      {/* Una sesión anotada a mano no tiene duración medida (null = "no se
          sabe"): antes quedaba "· min" y un "MIN" vacío. Se dice lo que es. */}
      <div className="sheet-sub">
        {justFinished ? `${s.dayName || 'Entrenamiento'} · ` : ''}{fmtDFull(s.date)}
        {s.duration != null ? ` · ${s.duration} min` : s.retro ? ' · anotada a mano' : ''}
      </div>

      <div className="stats" style={{ '--n': 4 }}>
        <div><div className="n">{s.duration ?? '—'}</div><span className="l">Min</span></div>
        <div><div className="n">{nsets}</div><span className="l">Series</span></div>
        <div><div className="n">{entries.length}</div><span className="l">Ejercicios</span></div>
        <div><div className="n">{fmtMiles(Math.round(vol))}</div><span className="l">Kg vol.</span></div>
      </div>

      {hasPR && (
        <div className={`card pr-card${justFinished ? ' destello' : ''}`} style={{ marginTop: 'var(--s4)' }}>
          {/* El burst animado sólo se reproduce al cerrar LA sesión que generó
              el récord — reabrir una sesión vieja con PR no debería repetir el
              festejo cada vez, así que ahí se queda el trofeo fijo de siempre. */}
          {justFinished
            ? (
              // El fallback es el MISMO trofeo que muestra una sesión vieja con
              // récord: si la carga tarda no aparece un hueco ni un spinner,
              // aparece lo que esa tarjeta muestra el resto del tiempo.
              <Suspense fallback={<div className="pr-troph"><Trofeo size={24} /></div>}>
                <PrBurst />
              </Suspense>
            )
            : <div className="pr-troph"><Trofeo size={24} /></div>}
          <div className="grow">
            <div className="cond" style={{ fontSize: 'var(--t-lg)', fontWeight: 700 }}>
              {justFinished ? '¡Nuevo récord!' : `${prs.length} récord${prs.length === 1 ? '' : 's'} en esta sesión`}
            </div>
            <div className="ptext sm">
              {prs.map(p => `${p.name} · ${fmtNum(round1(p.w))} kg × ${p.r}${p.unilateral ? ' por lado' : ''}`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Agregaste algo fuera del plan: se pregunta una vez si queda fijo.
          Improvisar en el gimnasio no debería reescribir tu rutina solo. */}
      {justFinished && !pinResuelto && s.added?.length > 0 && (
        <div className="calcbox blue" style={{ marginTop: 16 }}>
          <p className="ptext" style={{ marginBottom: 12 }}>
            Agregaste <b className="txt-blue">{s.added.map(a => a.name).join(', ')}</b> hoy.
            ¿Lo dejo en tu rutina de {s.dayName}?
          </p>
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button type="button" className="btn sm ghost" onClick={() => { setPinResuelto(true); toast('Queda sólo en esta sesión'); }}>
              No, sólo fue hoy
            </button>
            <button type="button" className="btn sm" onClick={async () => { setPinResuelto(true); await pinAddedToRoutine(s.slotId, s.added); }}>
              Sí, agregarlo
            </button>
          </div>
        </div>
      )}

      {/* Los saltados no tienen series, así que no entran en entries: cero
          volumen, cero PRs. Se muestran aparte para que dentro de un mes sepas
          si ese día no tocaba o si lo dejaste pasar. */}
      {s.skipped?.length > 0 && (
        <div className="skip-note">
          <Skip size={14} style={{ flex: 'none', marginTop: 2 }} />
          <span>{s.skipped.length} saltado{s.skipped.length === 1 ? '' : 's'} · {s.skipped.map(x => x.name).join(' · ')}</span>
        </div>
      )}

      <div className="sect">Lo que hiciste</div>
      {/* Día anotado a mano sin series (MarcarDia): se pueden cargar acá. Se
          arranca de lo que hiciste la última vez antes de ese día (o de tu
          meta) y se abre la corrección para ajustar lo que haya sido
          distinto. Desde ahí cuenta como cualquier sesión: historial,
          progresión y récords, con la fecha de ese día. */}
      {!entries.length && (
        <div className="card" style={{ marginBottom: 'var(--s3)' }}>
          <p className="ptext" style={{ marginBottom: 12 }}>
            Sin series registradas. Cargalas con lo que hiciste la última vez y corregí lo que haya sido distinto.
          </p>
          <button type="button" className="btn" onClick={async () => { if (await cargarSeriesRetro(s.id)) setEditando(true); }}>
            Cargar las series de ese día
          </button>
        </div>
      )}
      <div ref={entriesRef}>
      {entries.map((e, ei) => (
        <EntryCard
          key={ei}
          sess={s} entry={e} idx={ei}
          editando={editando}
          esPR={prKeys.has(exKey(e))}
          onSetSerie={setSerie} onBorrarSerie={borrarSerie}
          onAgregarSerie={agregarSerie} onBorrarEjercicio={borrarEjercicio}
        />
      ))}
      </div>

      {editando && delDia.length > 0 && (
        <>
          <div className="sect">Agregar un ejercicio que hiciste</div>
          <div className="chips" style={{ marginBottom: 'var(--s3)' }}>
            {delDia.map(ex => (
              <button key={ex.id} type="button" className="chip blue" onClick={() => agregarEjercicio(ex)}><Plus size={14} /> {ex.name}</button>
            ))}
          </div>
        </>
      )}

      {justFinished ? (
        <button type="button" className={`btn ${hasPR ? 'ok' : ''}`} style={{ marginTop: 18 }} onClick={closeSheet}>
          {/* Ya está guardada: el botón sólo cierra (H9). */}
          Listo
        </button>
      ) : (
        <>
          <button type="button" className="btn ghost" style={{ marginTop: 14 }} onClick={() => setEditando(v => !v)}>
            {editando ? <><Check size={18} /> Listo</> : <><Pencil size={17} /> Corregir lo que anoté</>}
          </button>
          <p className="ptext sm center" style={{ marginTop: 8 }}>
            Los minutos y la fecha no cambian: sólo se corrige lo que hiciste.
          </p>
          <button type="button" className="btn danger sm" style={{ marginTop: 14 }} onClick={() => confirmDel(s.id)}>
            Eliminar sesión
          </button>
        </>
      )}
    </>
  );
}

/** Un ejercicio de la sesión.
 *
 * El riel de la izquierda es el que le da vida a la lista: su color dice cómo
 * te fue en ESE ejercicio — subiste, igual, bajaste, récord. Apilados, los
 * rieles forman una columna que se lee de arriba abajo y cuenta la sesión
 * entera de un vistazo. Antes las once tarjetas pesaban visualmente lo mismo,
 * porque codificaban qué ejercicio (categórico, todos iguales) y no cuánto
 * moviste (que es lo que varía).
 *
 * Y el peso va grande, agrupado: en el gimnasio no se dice "85×7, 85×6", se
 * dice "85 por 7 y 6". El número es el contenido de un registro de fuerza.
 */
function EntryCard({ sess, entry, idx, editando, esPR, onSetSerie, onBorrarSerie, onAgregarSerie, onBorrarEjercicio }) {
  const grupo = catOf(entry);
  const vol = entry.sets.reduce((a, st) => a + st.w * st.r, 0);
  const d = entryDelta(sess, entry);
  const grupos = groupSets(entry.sets);

  const veredicto = esPR ? 'pr' : !d ? 'nuevo' : d.delta > 0 ? 'sube' : d.delta < 0 ? 'baja' : 'igual';

  return (
    <div className={`dcard entry v-${veredicto}`} style={{ '--i': idx }}>
      <div className="entry-top">
        <ExIcon icono={iconOf(entry)} size={22} className="entry-icon" />
        <span className={`eyebrow ${grupo ? '' : 'warn'}`}>{grupo || 'sin grupo'}</span>
        {equipLabel(entry) && <span className="eq-tag">{equipLabel(entry)}</span>}
        {esPR && <span className="entry-pr" title="Récord en esta sesión" role="img" aria-label="Récord en esta sesión"><Trofeo size={17} /></span>}
      </div>
      <div className="dcard-head">
        {editando ? (
          <button type="button" className="entry-name-edit" onClick={() => openSheet('entry-edit', { sessId: sess.id, idx })}>
            {entry.name} <span className="pen" aria-hidden="true"><Pencil size={13} /></span>
          </button>
        ) : (
          <span className="dcard-title">{entry.name}</span>
        )}
        {editando && <button type="button" className="mini red" title="Quitar ejercicio" aria-label={`Quitar ${entry.name}`} onClick={() => onBorrarEjercicio(idx)}><X /></button>}
      </div>

      {editando ? (
        <>
          {entry.sets.map((st, si) => (
            // la key lleva los valores: al borrar una serie los índices se
            // corren, y sin esto el input no controlado seguiría mostrando el
            // defaultValue de la serie que ocupaba ese lugar antes
            <div key={`${si}-${st.w}-${st.r}`} className="set-edit">
              <span className="i">{si + 1}</span>
              <input
                type="number" inputMode="decimal" step="any" defaultValue={fmtNum(round1(st.w))}
                onBlur={ev => onSetSerie(idx, si, 'w', ev.target.value)}
              />
              <span className="u">kg ×</span>
              <input
                type="number" inputMode="numeric" defaultValue={st.r}
                onBlur={ev => onSetSerie(idx, si, 'r', ev.target.value)}
              />
              <button type="button" className="mini red" aria-label={`Borrar la serie ${si + 1}`} onClick={() => onBorrarSerie(idx, si)}><X /></button>
            </div>
          ))}
          <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => onAgregarSerie(idx)}>+ Serie</button>
        </>
      ) : (
        <div className="loads">
          {grupos.map((g, i) => (
            <div key={i} className="load">
              <span className="kg">{fmtNum(round1(g.w))}<small>kg</small></span>
              <span className="reps">
                {g.reps.map((r, j) => (
                  <span key={j} className="rep">
                    <b className="s">Serie {g.from + j}</b>
                    <b className="r">{r}<small>reps</small></b>
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="dcard-foot">
        <span>{entry.sets.length} serie{entry.sets.length === 1 ? '' : 's'} · {fmtKg(Math.round(vol))}</span>
        {d && d.delta !== 0 && (
          <span className={d.delta > 0 ? 'txt-ok' : 'txt-warn'}>
            {d.delta > 0 ? <><Sube /> +</> : <><Baja />{' '}</>}{fmtNum(d.delta)} kg
          </span>
        )}
        {d && d.delta === 0 && <span className="txt-mut">= igual</span>}
        {!d && <span className="txt-mut">primera vez</span>}
      </div>
    </div>
  );
}

function confirmDel(id) {
  openSheet('confirm', {
    title: 'Eliminar sesión',
    body: 'Se elimina del historial. Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
    onConfirm: () => deleteHistorySession(id),
    onCancel: () => openSheet('session-view', { id }),
  });
}
