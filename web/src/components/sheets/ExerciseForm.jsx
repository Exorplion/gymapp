// Puerto de sheetExForm() (index.html, sección 17 "selector de ejercicio").
// Incluye: autocompletado en vivo (antes updateExAutocomplete(), disparado
// por un listener delegado global sobre #f-exname — acá es sólo estado
// derivado del input), sugeridos para el día (recommendedExercises), el
// explorador de catálogo completo (<details>, sólo al crear), dictado por
// voz (SpeechRecognition, sólo al crear) y los steppers de series/reps
// (antes ACT['exf-step']).
import { useEffect, useRef, useState } from 'react';
import { norm } from '../../lib/format.js';
import { EXCATALOG } from '../../lib/muscle.js';
import { recommendedExercises, saveExercise } from '../../lib/rutina-logic.js';
import { toast } from '../Toast.jsx';

const SR_CLASS = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;
const CATALOG_CATS = [...new Set(EXCATALOG.map(e => e.c))];

export default function ExerciseForm({ wd, ex }) {
  const [name, setName] = useState(ex ? ex.name : '');
  const [sets, setSets] = useState(ex ? ex.sets : 4);
  const [reps, setReps] = useState(ex ? ex.reps : 10);
  const [acOpen, setAcOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const nameRef = useRef(null);
  const voiceRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);
  // Si queda un reconocimiento de voz corriendo al desmontar (cierre del
  // sheet a mitad de dictado), lo cortamos — el original nunca desmonta este
  // formulario mientras VOICE existe (es la misma pantalla), pero acá el
  // sheet sí puede cerrarse por otra vía.
  useEffect(() => () => voiceRef.current?.stop(), []);

  const suggestions = ex ? [] : recommendedExercises(wd);
  const nq = norm(name);
  const acMatches = acOpen && nq ? EXCATALOG.filter(e => norm(e.n).includes(nq)).slice(0, 6) : [];

  function pickName(n) { setName(n); setAcOpen(false); }
  function handleNameChange(v) { setName(v); setAcOpen(true); }

  function step(setter, d) { setter(v => Math.max(1, (parseInt(v) || 0) + d)); }

  function toggleVoice() {
    if (!SR_CLASS) return;
    if (voiceRef.current) { voiceRef.current.stop(); return; }
    const rec = new SR_CLASS();
    rec.lang = 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
    voiceRef.current = rec; setRecording(true);
    rec.onresult = e => {
      const txt = (e.results[0]?.[0]?.transcript || '').trim();
      if (txt) { setName(txt.charAt(0).toUpperCase() + txt.slice(1)); nameRef.current?.focus(); }
    };
    rec.onerror = () => toast('No se pudo escuchar. Probá de nuevo.');
    rec.onend = () => { voiceRef.current = null; setRecording(false); };
    rec.start();
  }

  function handleSave() { saveExercise(wd, ex ? ex.id : null, { name, sets, reps }); }

  return (
    <>
      <h2>{ex ? 'Editar' : 'Nuevo'} ejercicio</h2>
      <div className="field">
        <label>Nombre</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={nameRef}
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Press banca"
            autoComplete="off"
            style={{ flex: 1 }}
          />
          {!ex && SR_CLASS && (
            <button
              type="button"
              className={`icon-btn${recording ? ' accent' : ''}`}
              id="ex-voice-btn"
              aria-label="Dictar por voz"
              style={{ flex: 'none' }}
              onClick={toggleVoice}
            >
              {recording ? '🔴' : '🎤'}
            </button>
          )}
        </div>
        <div id="ex-autocomplete">
          {acMatches.length > 0 && (
            <div className="ac-list">
              {acMatches.map(e => (
                <button key={e.n} type="button" className="ac-item" onClick={() => pickName(e.n)}>
                  {e.n} <span className="txt-mut" style={{ fontSize: 11.5 }}>· {e.c}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {suggestions.length > 0 && (
        <>
          <div className="txt-mut" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', margin: '4px 0 6px' }}>
            Sugeridos para hoy
          </div>
          <div className="chips">
            {suggestions.map(e => (
              <button key={e.n} type="button" className="chip" onClick={() => pickName(e.n)}>{e.n}</button>
            ))}
          </div>
        </>
      )}
      {!ex && (
        <details style={{ marginTop: 10 }}>
          <summary className="txt-blue" style={{ fontSize: 13, fontWeight: 600 }}>📚 Explorar toda la base de ejercicios</summary>
          <div style={{ marginTop: 8 }}>
            {CATALOG_CATS.map(c => (
              <div key={c}>
                <div className="txt-mut" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', margin: '10px 0 6px' }}>{c}</div>
                <div className="chips">
                  {EXCATALOG.filter(e => e.c === c).map(e => (
                    <button key={e.n} type="button" className="chip" onClick={() => pickName(e.n)}>{e.n}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="f2" style={{ marginTop: 14 }}>
        <div className="field">
          <label>Series objetivo</label>
          <div className="step">
            <button type="button" onClick={() => step(setSets, -1)}>−</button>
            <div className="val"><input type="number" inputMode="numeric" value={sets} onChange={e => setSets(e.target.value)} /></div>
            <button type="button" onClick={() => step(setSets, 1)}>+</button>
          </div>
        </div>
        <div className="field">
          <label>Reps objetivo</label>
          <div className="step">
            <button type="button" onClick={() => step(setReps, -1)}>−</button>
            <div className="val"><input type="number" inputMode="numeric" value={reps} onChange={e => setReps(e.target.value)} /></div>
            <button type="button" onClick={() => step(setReps, 1)}>+</button>
          </div>
        </div>
      </div>
      <button type="button" className="btn" style={{ marginTop: 14 }} onClick={handleSave}>Guardar</button>
    </>
  );
}
