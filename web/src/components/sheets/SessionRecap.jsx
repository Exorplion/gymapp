// Puerto de sheetSessionRecap() (index.html) — duración/series/volumen +
// tarjeta de PR. El disparo de confetti NO vive acá: completeSession()
// (session.js) llama fireConfetti() directamente al abrir este sheet, igual
// que el original llamaba fireConfetti() imperativamente al final de
// sheetSessionRecap() — un efecto de "esto pasó" en el momento de la acción,
// no algo que dependa del ciclo de vida de este componente (evita
// duplicar el disparo si React remonta el componente, p.ej. en StrictMode).
import { closeSheet } from '../../lib/state.js';
import { WD, fmtDFull, fmtNum, round1 } from '../../lib/format.js';

export default function SessionRecap({ sess, prs }) {
  const nsets = sess.entries.reduce((a, e) => a + e.sets.length, 0);
  const vol = sess.entries.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0);
  const hasPR = prs.length > 0;

  return (
    <>
      <h2>{hasPR ? '🎉 ' : '💪 '}Sesión guardada</h2>
      <div className="txt-mut" style={{ margin: '-8px 0 16px', fontSize: 14 }}>{sess.dayName || WD[sess.weekday]} · {fmtDFull(sess.date)}</div>
      <div className="macro3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="cond" style={{ fontSize: 26, fontWeight: 700 }}>{sess.duration}</div>
          <div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Min</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="cond" style={{ fontSize: 26, fontWeight: 700 }}>{nsets}</div>
          <div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Series</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="cond" style={{ fontSize: 26, fontWeight: 700 }}>{sess.entries.length}</div>
          <div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Ejercicios</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="cond" style={{ fontSize: 26, fontWeight: 700 }}>{Math.round(vol)}</div>
          <div className="txt-mut" style={{ fontSize: 'var(--t-micro)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Kg vol.</div>
        </div>
      </div>
      {hasPR && (
        <div className="card pr-card" style={{ marginTop: 18, animation: 'flash 1.2s ease 2' }}>
          <div className="pr-troph" style={{ animation: 'zoom .4s var(--ease) backwards' }}>🏆</div>
          <div className="grow">
            <div className="cond" style={{ fontSize: 17, fontWeight: 700 }}>¡Nuevo récord!</div>
            <div className="txt-mut" style={{ fontSize: 13 }}>{prs.map(p => `${p.name} · ${fmtNum(round1(p.w))} kg × ${p.r}`).join(' · ')}</div>
          </div>
        </div>
      )}
      <button type="button" className={`btn ${hasPR ? 'ok' : ''}`} style={{ marginTop: 18 }} onClick={closeSheet}>Guardar y cerrar</button>
    </>
  );
}
