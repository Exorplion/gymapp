// Puerto de sheetExForm() (index.html, sección 17 "selector de ejercicio").
// Incluye: autocompletado en vivo (antes updateExAutocomplete(), disparado
// por un listener delegado global sobre #f-exname — acá es sólo estado
// derivado del input), sugeridos para el día (recommendedExercises), el
// explorador de catálogo completo (<details>, sólo al crear), dictado por
// voz (SpeechRecognition, sólo al crear) y los steppers de series/reps
// (antes ACT['exf-step']).
import { useEffect, useRef, useState } from 'react';
import { EQUIP, EQUIP_HINT, isMachineBound } from '../../lib/equip.js';
import MachineField from '../MachineField.jsx';
import { MUSCLE_CATS, catOf } from '../../lib/muscle.js';
import { shrinkImage } from '../../lib/photo.js';
import { illusUrl } from '../../lib/illustrations.js';
import IllusPick from './IllusPick.jsx';
import { norm } from '../../lib/format.js';
import { EXCATALOG } from '../../lib/muscle.js';
import { recommendedExercises, saveExercise } from '../../lib/rutina-logic.js';
import { toast } from '../../lib/toast.js';
import { Mic, RecordDot } from '../Icon.jsx';

const SR_CLASS = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;
const CATALOG_CATS = [...new Set(EXCATALOG.map(e => e.c))];

export default function ExerciseForm({ wd, ex }) {
  const [name, setName] = useState(ex ? ex.name : '');
  const [sets, setSets] = useState(ex ? ex.sets : 4);
  const [reps, setReps] = useState(ex ? ex.reps : 10);
  const [equip, setEquip] = useState(ex?.equip || '');
  const [cat, setCat] = useState(ex?.cat || '');
  const [machine, setMachine] = useState(ex?.machine || '');
  const [unilateral, setUnilateral] = useState(!!ex?.unilateral);
  const [photo, setPhoto] = useState(ex?.photo || '');
  const [illus, setIllus] = useState(ex?.illus || '');
  const [picking, setPicking] = useState(false);
  const photoRef = useRef(null);

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';           // permite volver a elegir la misma foto
    if (!file) return;
    try {
      setPhoto(await shrinkImage(file));
    } catch (err) {
      toast(err.message || 'No se pudo procesar la foto');
    }
  }
  const [acOpen, setAcOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const nameRef = useRef(null);
  const voiceRef = useRef(null);

  /* El teclado se abre solo al CREAR, que es cuando lo primero que vas a hacer
     es escribir un nombre. Al editar no: entrás a cambiar las series o el
     equipo, y el teclado tapa media pantalla para un campo que no ibas a tocar.
     Si querés cambiar el nombre, lo tocás. */
  useEffect(() => {
    if (ex) return;
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [ex]);
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

  // lo que el matcher deduce del nombre, para mostrarlo antes de que elijas
  const auto = catOf({ name });
  function handleSave() { saveExercise(wd, ex ? ex.id : null, { name, sets, reps, equip, machine, photo, illus, cat, unilateral }); }

  return (
    <>
      <h2>{ex ? 'Editar' : 'Nuevo'} ejercicio</h2>
      <div className="field">
        <label htmlFor="exform-nombre">Nombre</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            id="exform-nombre"
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
              {recording ? <RecordDot /> : <Mic />}
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
          <label htmlFor="exform-series">Series objetivo</label>
          <div className="step">
            <button type="button" onClick={() => step(setSets, -1)}>−</button>
            <div className="val"><input id="exform-series" type="number" inputMode="numeric" value={sets} onChange={e => setSets(e.target.value)} /></div>
            <button type="button" onClick={() => step(setSets, 1)}>+</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="exform-reps">Reps objetivo</label>
          <div className="step">
            <button type="button" onClick={() => step(setReps, -1)}>−</button>
            <div className="val"><input id="exform-reps" type="number" inputMode="numeric" value={reps} onChange={e => setReps(e.target.value)} /></div>
            <button type="button" onClick={() => step(setReps, 1)}>+</button>
          </div>
        </div>
      </div>

      {/* El grid de dos columnas de arriba es sólo para Series/Reps: cierra acá
          y a propósito. Todo lo de abajo (grupo, equipo, unilateral, foto) es
          contenido a ancho completo — meterlo dentro del mismo .f2 lo aplastaba
          a la mitad de la pantalla, porque el grid ubica CUALQUIER hijo directo
          en una de sus dos columnas, sea o no un .field. */}

      {/* Unilateral: un lado por vez. Cambia sólo cómo se lee lo que anotás en
          la sesión —"20 kg × 12 por lado" y no "20 kg × 12" a secas— no cómo se
          guarda. Va como chip solo y no en el nombre porque "curl unilateral"
          es texto libre que el resto de la app no puede leer: esto sí. */}
      <label className="eyebrow lbl-block" style={{ marginTop: 'var(--s4)' }}>Cómo se hace</label>
      <div className="chips">
        <button
          type="button"
          className={`chip ${unilateral ? 'on' : ''}`}
          aria-pressed={unilateral}
          onClick={() => setUnilateral(u => !u)}
        >
          Un lado por vez
        </button>
      </div>
      {unilateral && (
        <div className="ptext sm" style={{ marginTop: 6 }}>
          El peso y las reps que anotes en la sesión van a leerse como "por lado".
        </div>
      )}

      {/* Qué grupo entrena. El automático acierta en la mayoría, pero ninguna
          lista de palabras va a adivinar "JM press unilateral" — por eso hay
          una salida manual, y por eso se muestra qué dedujo antes de tocarla.
          Sin grupo, las series de este ejercicio no cuentan en "Músculos esta
          semana". */}
      <label className="eyebrow lbl-block" style={{ marginTop: 'var(--s4)' }}>
        Qué grupo entrena
        {!cat && auto && <span className="txt-mut" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}> · detecté {auto}</span>}
        {!cat && !auto && name.trim() && <span className="txt-warn" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}> · no lo reconozco, elegilo</span>}
      </label>
      <div className="chips">
        {MUSCLE_CATS.map(c => (
          <button
            key={c}
            type="button"
            className={`chip ${cat === c ? 'on' : (!cat && auto === c ? 'blue' : '')}`}
            aria-pressed={cat === c}
            onClick={() => setCat(cat === c ? '' : c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Con qué se hace el ejercicio. Es lo que permite que el historial no
          mezcle números que no son comparables — ver lib/equip.js. */}
      <label className="eyebrow lbl-block" style={{ marginTop: 'var(--s4)' }}>Con qué lo hacés</label>
      <div className="chips">
        {EQUIP.map(e => (
          <button
            key={e.id}
            type="button"
            className={`chip ${equip === e.id ? 'on' : ''}`}
            aria-pressed={equip === e.id}
            onClick={() => setEquip(equip === e.id ? '' : e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>
      {equip && (
        <div className="ptext sm" style={{ marginTop: 8 }}>
          {EQUIP_HINT[equip]}
        </div>
      )}
      {isMachineBound(equip) && (
        <MachineField equip={equip} machine={machine} onChange={setMachine} />
      )}

      {/* Foto de la máquina: sacada por vos, guardada en el ejercicio. Es más
          útil que una ilustración genérica porque reconocés ESA máquina. */}
      {equip && (
        <div style={{ marginTop: 'var(--s3)' }}>
          <label>Foto de la máquina</label>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={onPhoto}
          />
          {photo ? (
            <div className="mach-photo">
              <img src={photo} alt="" />
              <div className="mach-photo-acts">
                <button type="button" className="btn sm ghost" onClick={() => photoRef.current?.click()}>Cambiar</button>
                <button type="button" className="btn sm ghost" onClick={() => setPhoto('')}>Quitar</button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" className="btn ghost" onClick={() => photoRef.current?.click()}>
                📷 Sacar o elegir foto
              </button>
              <div className="ptext sm" style={{ marginTop: 6 }}>
                Para reconocerla al llegar. Se guarda reducida en tu teléfono, nunca se sube a ningún lado.
              </div>
            </>
          )}
        </div>
      )}

      {/* Ilustración del movimiento (free-exercise-db, dominio público). Se
          elige a mano una vez: la base es en inglés y adivinar automáticamente
          pondría la imagen equivocada más de una vez. */}
      <div style={{ marginTop: 'var(--s3)' }}>
        <label>Ilustración del movimiento</label>
        {illus ? (
          <div className="mach-photo">
            <img src={illusUrl(illus)} alt="" />
            <div className="mach-photo-acts">
              <button type="button" className="btn sm ghost" onClick={() => setPicking(true)}>Cambiar</button>
              <button type="button" className="btn sm ghost" onClick={() => setIllus('')}>Quitar</button>
            </div>
          </div>
        ) : (
          <>
            <button type="button" className="btn ghost" onClick={() => setPicking(true)}>
              🖼 Buscar ilustración
            </button>
            <div className="ptext sm" style={{ marginTop: 6 }}>
              Para ver cómo se hace el movimiento. Se descarga la primera vez y queda guardada.
            </div>
          </>
        )}
        {picking && (
          <IllusPick exName={name} onPick={setIllus} onClose={() => setPicking(false)} />
        )}
      </div>
      <button type="button" className="btn" style={{ marginTop: 14 }} onClick={handleSave}>Guardar</button>
    </>
  );
}
