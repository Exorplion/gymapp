// Puerto de sheetLibrary() + sheetLibSave(name) (index.html) — dos pantallas
// distintas en el original (dos llamadas a openSheet con HTML distinto) que
// acá se unifican en un componente con dos modos, porque el plan de Task 5
// sólo prevé un archivo Library.jsx para ambas.
import { useEffect, useRef, useState } from 'react';
import { S, openSheet, closeSheet } from '../../lib/state.js';
import { fmtD } from '../../lib/format.js';
import { TEMPLATES, applyTemplate } from '../../lib/templates.js';
import {
  routineStats, routineName, applyLibRoutine, deleteLibRoutine, saveCurrentAsLib, startBlank,
} from '../../lib/rutina-logic.js';

function LibraryList() {
  const st = routineStats();
  return (
    <>
      <h2>Mis rutinas</h2>
      <div className="sheet-sub">
        Guardá el split que estés usando para volver a él cuando quieras, o cargá una plantilla.
      </div>
      {st.days.length > 0 && (
        <button
          type="button"
          className="btn ghost"
          style={{ marginBottom: 16 }}
          onClick={() => openSheet('library', { mode: 'save' })}
        >
          💾 Guardar la actual como…
        </button>
      )}
      {S.lib.length > 0 && (
        <>
          <h3>Guardadas</h3>
          <div className="card sub" style={{ padding: 'var(--s2) var(--s3)', marginBottom: 16 }}>
            {S.lib.map(r => {
              const nd = Object.keys(r.days).length;
              const ne = Object.values(r.days).reduce((a, d) => a + d.exercises.length, 0);
              const cur = r.name === S.cfg.routineName;
              return (
                <div className="row" key={r.id}>
                  <button type="button" className="grow linkcard" data-act="lib-apply" onClick={() => applyLibRoutine(r.id)}>
                    <div className="t">{r.name}{cur && <span className="lib-tag">en uso</span>}</div>
                    <div className="s">{nd} días · {ne} ejercicios · guardada {fmtD(r.savedAt)}</div>
                  </button>
                  <button type="button" className="mini red" onClick={() => deleteLibRoutine(r.id)}>✕</button>
                </div>
              );
            })}
          </div>
        </>
      )}
      <h3>Plantillas</h3>
      <div className="txt-mut" style={{ fontSize: 13, margin: '-4px 0 12px' }}>
        Reemplazan tu split actual. Después las editás a gusto.
      </div>
      {TEMPLATES.map(t => (
        <div
          key={t.id}
          className="card tmpl"
          data-act="tmpl-apply"
          style={{ cursor: 'pointer', marginBottom: 10 }}
          onClick={() => applyTemplate(t.id)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="grow">
              <div className="cond" style={{ fontSize: 20, fontWeight: 700 }}>{t.name}</div>
              <div className="txt-mut" style={{ fontSize: 12.5, marginTop: 2 }}>{t.days} · {t.who}</div>
              <div className="txt-blue" style={{ fontSize: 12, marginTop: 3, fontWeight: 600 }}>{t.freq}</div>
            </div>
            <span className="btn sm" style={{ width: 'auto', padding: '0 16px', minHeight: 40 }}>Usar</span>
          </div>
        </div>
      ))}
      <div className="card" style={{ borderStyle: 'dashed', borderColor: 'var(--line2)' }}>
        <div className="cond" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Personalizada</div>
        <div className="txt-mut" style={{ fontSize: 13, marginBottom: 12 }}>
          Empezá de cero y armá tu propio split día por día.
        </div>
        <button type="button" className="btn sm ghost" onClick={startBlank}>Empezar en blanco</button>
      </div>
    </>
  );
}

function LibrarySave({ initialName }) {
  const [name, setName] = useState(initialName ?? (routineName() === 'Rutina personalizada' ? '' : routineName()));
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <h2>Guardar rutina</h2>
      <div className="field">
        <label htmlFor="lib-nombre">Nombre</label>
        <input id="lib-nombre" ref={inputRef} value={name} onChange={e => setName(e.target.value)} placeholder="Mi rutina" />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn sm ghost" style={{ flex: 1 }} onClick={closeSheet}>Cancelar</button>
        <button type="button" className="btn sm" style={{ flex: 1 }} onClick={() => saveCurrentAsLib(name)}>Guardar</button>
      </div>
    </>
  );
}

export default function Library({ mode = 'list', name }) {
  return mode === 'save' ? <LibrarySave initialName={name} /> : <LibraryList />;
}
