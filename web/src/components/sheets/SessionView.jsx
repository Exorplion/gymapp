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
import { S, useStore, openSheet, closeSheet } from '../../lib/state.js';
import { WD, fmtDFull, fmtNum, round1 } from '../../lib/format.js';
import { sessionPRs, deleteHistorySession } from '../../lib/session.js';

export default function SessionView({ id, justFinished = false }) {
  useStore();
  const s = S.sessions.find(x => x.id === id);
  if (!s) return null;

  const prs = sessionPRs(s);
  const hasPR = prs.length > 0;
  const nsets = (s.entries || []).reduce((a, e) => a + e.sets.length, 0);
  const vol = (s.entries || []).reduce((a, e) => a + e.sets.reduce((b, st) => b + st.w * st.r, 0), 0);

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
      {(s.entries || []).map((e, i) => (
        <div key={i} className="card" style={{ padding: '12px 14px' }}>
          <div className="cond" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{e.name}</div>
          <div className="chips">
            {e.sets.map((st, j) => (
              <span key={j} className="chip">{fmtNum(round1(st.w))}kg × {st.r}</span>
            ))}
          </div>
        </div>
      ))}

      {justFinished ? (
        <button type="button" className={`btn ${hasPR ? 'ok' : ''}`} style={{ marginTop: 18 }} onClick={closeSheet}>
          Guardar y cerrar
        </button>
      ) : (
        <button type="button" className="btn danger sm" style={{ marginTop: 6 }} onClick={() => confirmDel(s.id)}>
          Eliminar sesión
        </button>
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
