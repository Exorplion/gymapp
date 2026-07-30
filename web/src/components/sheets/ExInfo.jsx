// Puerto de sheetExInfo() (index.html) — ficha educativa de un ejercicio +
// su esquema RIR. `wd` se recibe por paridad con la firma original
// (sheetExInfo(name,wd,exId)) pero, igual que en el original, no se usa: el
// esquema de sets/reps se busca recorriendo TODOS los días de S.routine por
// exId, no sólo `wd`.
import { S } from '../../lib/state.js';
import { exInfo, rirScheme, isLowerBackLift } from '../../lib/exdb.js';

export default function ExInfo({ name, exId }) {
  const info = exInfo(name);
  let sets = null;
  for (const d of Object.values(S.routine)) {
    const e = (d.exercises || []).find(x => x.id === exId);
    if (e) sets = e.sets;
  }
  const scheme = sets ? rirScheme(sets, name) : null;

  return (
    <>
      <h2>{name}</h2>
      {info ? (
        <>
          <h3>Músculos</h3>
          <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--txt)' }}>{info.m}</div>
          <h3>Por qué elegirlo</h3>
          <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--txt)' }}>
            {info.w.split('⚠').map((part, i, arr) => (
              <span key={i}>{part}{i < arr.length - 1 && <span className="txt-warn">⚠</span>}</span>
            ))}
          </div>
        </>
      ) : (
        <div className="txt-mut" style={{ fontSize: 14, lineHeight: 1.5, margin: '8px 0' }}>
          No tengo ficha educativa de este ejercicio todavía. Igual puedes registrarlo y seguir su progresión con normalidad.
        </div>
      )}
      {scheme && (
        <>
          <h3>Esfuerzo por serie (RIR)</h3>
          <div className="chips" style={{ marginBottom: 8 }}>
            {scheme.map((r, i) => (
              <span key={i} className={`chip${r === 0 ? ' blue' : ''}`}>
                Serie {i + 1}: {r === 0 ? 'al fallo' : `RIR ${r}`}
              </span>
            ))}
          </div>
          <div className="txt-mut" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Solo el <b>último set</b> va al fallo (RIR 0). Los primeros dejan reps en reserva para no arruinar el volumen con fatiga.
            {isLowerBackLift(name) && <> <span className="txt-warn">En este ejercicio nunca vayas al fallo (zona lumbar): máximo RIR 1.</span></>}
          </div>
        </>
      )}
    </>
  );
}
