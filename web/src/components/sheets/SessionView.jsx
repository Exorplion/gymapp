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
import { useState } from 'react';
import { S, useStore, openSheet, closeSheet } from '../../lib/state.js';
import { WD, fmtDFull, fmtNum, round1, uid } from '../../lib/format.js';
import { sessionPRs, deleteHistorySession, updateHistorySession, entryDelta, groupSets } from '../../lib/session.js';
import { pinAddedToRoutine } from '../../lib/rutina-logic.js';
import { catOf } from '../../lib/muscle.js';
import { equipLabel, exKey } from '../../lib/equip.js';
import { toast } from '../../lib/toast.js';
import { iconOf } from '../../lib/exicon.js';
import ExIcon from '../ExIcon.jsx';
import { Skip } from '../Icon.jsx';

export default function SessionView({ id, justFinished = false }) {
  useStore();
  const [editando, setEditando] = useState(false);
  // La pregunta de fijar lo agregado se responde una vez y no vuelve
  const [pinResuelto, setPinResuelto] = useState(false);
  const s = S.sessions.find(x => x.id === id);
  if (!s) return null;

  const prs = sessionPRs(s);
  const hasPR = prs.length > 0;
  const prKeys = new Set(prs.map(exKey));
  const entries = s.entries || [];
  const nsets = entries.reduce((a, e) => a + e.sets.length, 0);
  const vol = entries.reduce((a, e) => a + e.sets.reduce((b, st) => b + st.w * st.r, 0), 0);
  const delDia = (S.routine[s.weekday]?.exercises || []).filter(ex => !entries.some(e => e.name === ex.name));

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

  const agregarEjercicio = ex => editar(c => {
    c.entries.push({
      exId: ex.id || uid(), name: ex.name, equip: ex.equip, machine: ex.machine, cat: ex.cat,
      sets: [{ w: 20, r: ex.reps || 10, t: Date.now() }],
    });
  }, `${ex.name} agregado`);

  return (
    <>
      <h2>{justFinished ? `${hasPR ? '🎉' : '💪'} Sesión guardada` : (s.dayName || WD[s.weekday])}</h2>
      <div className="sheet-sub">
        {justFinished ? `${s.dayName || WD[s.weekday]} · ` : ''}{fmtDFull(s.date)} · {s.duration} min
      </div>

      <div className="stats" style={{ '--n': 4 }}>
        <div><div className="n">{s.duration}</div><span className="l">Min</span></div>
        <div><div className="n">{nsets}</div><span className="l">Series</span></div>
        <div><div className="n">{entries.length}</div><span className="l">Ejercicios</span></div>
        <div><div className="n">{Math.round(vol)}</div><span className="l">Kg vol.</span></div>
      </div>

      {hasPR && (
        <div className="card pr-card" style={{ marginTop: 18, animation: justFinished ? 'flash 1.2s ease 2' : undefined }}>
          <div className="pr-troph">🏆</div>
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

      {editando && delDia.length > 0 && (
        <>
          <div className="sect">Agregar un ejercicio que hiciste</div>
          <div className="chips" style={{ marginBottom: 'var(--s3)' }}>
            {delDia.map(ex => (
              <button key={ex.id} type="button" className="chip blue" onClick={() => agregarEjercicio(ex)}>＋ {ex.name}</button>
            ))}
          </div>
        </>
      )}

      {justFinished ? (
        <button type="button" className={`btn ${hasPR ? 'ok' : ''}`} style={{ marginTop: 18 }} onClick={closeSheet}>
          Guardar y cerrar
        </button>
      ) : (
        <>
          <button type="button" className="btn ghost" style={{ marginTop: 14 }} onClick={() => setEditando(v => !v)}>
            {editando ? '✓ Listo' : '✎ Corregir lo que anoté'}
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
        {esPR && <span className="entry-pr" title="Récord en esta sesión">🏆</span>}
      </div>
      <div className="dcard-head">
        {editando ? (
          <button type="button" className="entry-name-edit" onClick={() => openSheet('entry-edit', { sessId: sess.id, idx })}>
            {entry.name} <span className="pen">✎</span>
          </button>
        ) : (
          <span className="dcard-title">{entry.name}</span>
        )}
        {editando && <button type="button" className="mini red" title="Quitar ejercicio" onClick={() => onBorrarEjercicio(idx)}>✕</button>}
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
              <button type="button" className="mini red" onClick={() => onBorrarSerie(idx, si)}>✕</button>
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
        <span>{entry.sets.length} serie{entry.sets.length === 1 ? '' : 's'} · {Math.round(vol).toLocaleString('es')} kg</span>
        {d && d.delta !== 0 && (
          <span className={d.delta > 0 ? 'txt-ok' : 'txt-warn'}>
            {d.delta > 0 ? '↗ +' : '↘ '}{fmtNum(d.delta)} kg
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
