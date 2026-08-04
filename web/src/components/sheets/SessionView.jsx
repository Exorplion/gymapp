// Una sola vista para una sesión, con tres entradas: al terminarla
// (justFinished), al tocarla en el historial, y desde el día ya completado en
// Hoy.
//
// Antes eran dos componentes que mostraban lo mismo distinto: SessionRecap
// (cuatro stats + tarjeta de PR, sólo al cerrar) y HistDetail (chips planos,
// sin stats ni PRs, sólo desde el historial). Mirar una sesión de hace tres
// días no tenía por qué dar menos información que mirar la que acabás de
// cerrar.
//
// Lee la sesión de S.sessions POR ID, no por prop: así una edición se refleja
// sin cerrar y reabrir el sheet.
import { useState } from 'react';
import { S, useStore, openSheet, closeSheet } from '../../lib/state.js';
import { WD, fmtDFull, fmtNum, round1, uid } from '../../lib/format.js';
import { sessionPRs, deleteHistorySession, updateHistorySession } from '../../lib/session.js';
import { toast } from '../../lib/toast.js';

export default function SessionView({ id, justFinished = false }) {
  useStore();
  const [editando, setEditando] = useState(false);
  const s = S.sessions.find(x => x.id === id);
  if (!s) return null;

  const prs = sessionPRs(s);
  const hasPR = prs.length > 0;
  const nsets = (s.entries || []).reduce((a, e) => a + e.sets.length, 0);
  const vol = (s.entries || []).reduce((a, e) => a + e.sets.reduce((b, st) => b + st.w * st.r, 0), 0);
  const delDia = (S.routine[s.weekday]?.exercises || []).filter(ex => !(s.entries || []).some(e => e.name === ex.name));

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
      exId: ex.id || uid(), name: ex.name, equip: ex.equip, machine: ex.machine,
      sets: [{ w: 20, r: ex.reps || 10, t: Date.now() }],
    });
  }, `${ex.name} agregado`);

  return (
    <>
      <h2>{justFinished ? `${hasPR ? '🎉' : '💪'} Sesión guardada` : (s.dayName || WD[s.weekday])}</h2>
      <div className="txt-mut" style={{ margin: '-8px 0 16px', fontSize: 14 }}>
        {justFinished ? `${s.dayName || WD[s.weekday]} · ` : ''}{fmtDFull(s.date)} · {s.duration} min
      </div>

      <div className="macro3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <SessStat n={s.duration} l="Min" />
        <SessStat n={nsets} l="Series" />
        <SessStat n={(s.entries || []).length} l="Ejercicios" />
        <SessStat n={Math.round(vol)} l="Kg vol." />
      </div>

      {hasPR && (
        <div className="card pr-card" style={{ marginTop: 18, animation: justFinished ? 'flash 1.2s ease 2' : undefined }}>
          <div className="pr-troph">🏆</div>
          <div className="grow">
            <div className="cond" style={{ fontSize: 17, fontWeight: 700 }}>
              {justFinished ? '¡Nuevo récord!' : `${prs.length} récord${prs.length === 1 ? '' : 's'} en esta sesión`}
            </div>
            <div className="txt-mut" style={{ fontSize: 13 }}>
              {prs.map(p => `${p.name} · ${fmtNum(round1(p.w))} kg × ${p.r}`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      <div className="sect">Lo que hiciste</div>
      {(s.entries || []).map((e, ei) => (
        <div key={ei} className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div className="cond" style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>{e.name}</div>
            {editando && <button type="button" className="mini red" title="Quitar ejercicio" onClick={() => borrarEjercicio(ei)}>✕</button>}
          </div>
          {editando ? (
            <>
              {e.sets.map((st, si) => (
                // la key lleva los valores: al borrar una serie los índices se
                // corren, y sin esto el input no controlado seguiría mostrando
                // el defaultValue de la serie que ocupaba ese lugar antes
                <div key={`${si}-${st.w}-${st.r}`} className="set-edit">
                  <span className="i">{si + 1}</span>
                  <input
                    type="number" inputMode="decimal" step="any" defaultValue={fmtNum(round1(st.w))}
                    onBlur={ev => setSerie(ei, si, 'w', ev.target.value)}
                  />
                  <span className="u">kg ×</span>
                  <input
                    type="number" inputMode="numeric" defaultValue={st.r}
                    onBlur={ev => setSerie(ei, si, 'r', ev.target.value)}
                  />
                  <button type="button" className="mini red" onClick={() => borrarSerie(ei, si)}>✕</button>
                </div>
              ))}
              <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => agregarSerie(ei)}>+ Serie</button>
            </>
          ) : (
            <div className="chips">
              {e.sets.map((st, si) => (
                <span key={si} className="chip">{fmtNum(round1(st.w))}kg × {st.r}</span>
              ))}
            </div>
          )}
        </div>
      ))}

      {editando && delDia.length > 0 && (
        <>
          <div className="sect">Agregar un ejercicio que hiciste</div>
          <div className="chips" style={{ marginBottom: 'var(--s3)' }}>
            {delDia.map(ex => (
              <span key={ex.id} className="chip blue" onClick={() => agregarEjercicio(ex)}>＋ {ex.name}</span>
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
          <div className="txt-mut" style={{ fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 1.45 }}>
            Los minutos y la fecha no cambian: sólo se corrigen los pesos y las series.
          </div>
          <button type="button" className="btn danger sm" style={{ marginTop: 14 }} onClick={() => confirmDel(s.id)}>
            Eliminar sesión
          </button>
        </>
      )}
    </>
  );
}

function SessStat({ n, l }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="cond" style={{ fontSize: 26, fontWeight: 700 }}>{n}</div>
      <div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{l}</div>
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
