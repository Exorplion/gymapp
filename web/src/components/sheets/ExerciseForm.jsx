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
import { bloomOpen } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/primitives.jsx';

const SR_CLASS = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;
const CATALOG_CATS = [...new Set(EXCATALOG.map(e => e.c))];

const inputCls = 'h-11 w-full rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 text-[15px] text-txt outline-none transition-colors focus-visible:border-blue2';
const eyebrowCls = 'mt-4 mb-2 block text-[11px] font-semibold uppercase tracking-wide text-mut';
const chipBase = 'inline-flex items-center rounded-full border border-line2 px-3.5 py-2 text-[13px] font-medium transition-colors';
const chip = (on, tone = 'on') => cn(chipBase, on ? (tone === 'blue' ? 'border-transparent bg-blue2 text-[var(--on-grad)]' : 'border-transparent bg-[image:var(--grad)] font-bold text-[var(--on-grad)]') : 'bg-card2 text-txt hover:border-line');

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
  const rootRef = useRef(null);

  useEffect(() => { bloomOpen(rootRef.current); }, []);

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
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">{ex ? 'Editar' : 'Nuevo'} ejercicio</h2>
      <div className="mt-3">
        <label htmlFor="exform-nombre" className="mb-1.5 block text-[13px] font-medium text-mut">Nombre</label>
        <div className="flex items-center gap-2">
          <input
            id="exform-nombre"
            ref={nameRef}
            className={cn(inputCls, 'flex-1')}
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Press banca"
            autoComplete="off"
          />
          {!ex && SR_CLASS && (
            <button
              type="button"
              className={cn(
                'grid h-11 w-11 flex-none place-items-center rounded-[13px] border border-white/10 text-mut',
                recording && 'bg-accent/15 text-accent',
              )}
              id="ex-voice-btn"
              aria-label="Dictar por voz"
              onClick={toggleVoice}
            >
              {recording ? <RecordDot /> : <Mic />}
            </button>
          )}
        </div>
        {acMatches.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1 rounded-[var(--radius-r)] border border-line2 bg-card2 p-1.5">
            {acMatches.map(e => (
              <button key={e.n} type="button" className="rounded-[10px] px-2.5 py-1.5 text-left text-[13.5px] text-txt hover:bg-white/5" onClick={() => pickName(e.n)}>
                {e.n} <span className="text-[11.5px] text-mut">· {e.c}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {suggestions.length > 0 && (
        <>
          <div className="mt-3 mb-1.5 text-[11px] uppercase tracking-wide text-mut">
            Sugeridos para hoy
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(e => (
              <button key={e.n} type="button" className={chip(false)} onClick={() => pickName(e.n)}>{e.n}</button>
            ))}
          </div>
        </>
      )}
      {!ex && (
        <details className="mt-2.5">
          <summary className="cursor-pointer text-[13px] font-semibold text-blue">📚 Explorar toda la base de ejercicios</summary>
          <div className="mt-2">
            {CATALOG_CATS.map(c => (
              <div key={c}>
                <div className="mt-2.5 mb-1.5 text-[11px] uppercase tracking-wide text-mut">{c}</div>
                <div className="flex flex-wrap gap-2">
                  {EXCATALOG.filter(e => e.c === c).map(e => (
                    <button key={e.n} type="button" className={chip(false)} onClick={() => pickName(e.n)}>{e.n}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="mt-3.5 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="exform-series" className="mb-1.5 block text-[13px] font-medium text-mut">Series objetivo</label>
          <div className="flex h-11 items-center overflow-hidden rounded-[var(--radius-r)] border border-line2 bg-card2">
            <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" onClick={() => step(setSets, -1)}>−</button>
            <div className="flex-1 text-center"><input id="exform-series" type="number" inputMode="numeric" className="w-full bg-transparent text-center text-[15px] text-txt outline-none" value={sets} onChange={e => setSets(e.target.value)} /></div>
            <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" onClick={() => step(setSets, 1)}>+</button>
          </div>
        </div>
        <div>
          <label htmlFor="exform-reps" className="mb-1.5 block text-[13px] font-medium text-mut">Reps objetivo</label>
          <div className="flex h-11 items-center overflow-hidden rounded-[var(--radius-r)] border border-line2 bg-card2">
            <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" onClick={() => step(setReps, -1)}>−</button>
            <div className="flex-1 text-center"><input id="exform-reps" type="number" inputMode="numeric" className="w-full bg-transparent text-center text-[15px] text-txt outline-none" value={reps} onChange={e => setReps(e.target.value)} /></div>
            <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" onClick={() => step(setReps, 1)}>+</button>
          </div>
        </div>
      </div>

      {/* El grid de dos columnas de arriba es sólo para Series/Reps: cierra acá
          y a propósito. Todo lo de abajo (grupo, equipo, unilateral, foto) es
          contenido a ancho completo. */}

      {/* Unilateral: un lado por vez. Cambia sólo cómo se lee lo que anotás en
          la sesión —"20 kg × 12 por lado" y no "20 kg × 12" a secas— no cómo se
          guarda. Va como chip solo y no en el nombre porque "curl unilateral"
          es texto libre que el resto de la app no puede leer: esto sí. */}
      <label className={eyebrowCls}>Cómo se hace</label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={chip(unilateral)}
          aria-pressed={unilateral}
          onClick={() => setUnilateral(u => !u)}
        >
          Un lado por vez
        </button>
      </div>
      {unilateral && (
        <div className="mt-1.5 text-[13px] text-mut">
          El peso y las reps que anotes en la sesión van a leerse como "por lado".
        </div>
      )}

      {/* Qué grupo entrena. El automático acierta en la mayoría, pero ninguna
          lista de palabras va a adivinar "JM press unilateral" — por eso hay
          una salida manual, y por eso se muestra qué dedujo antes de tocarla.
          Sin grupo, las series de este ejercicio no cuentan en "Músculos esta
          semana". */}
      <label className={eyebrowCls}>
        Qué grupo entrena
        {!cat && auto && <span className="text-[11px] font-medium normal-case tracking-normal text-mut"> · detecté {auto}</span>}
        {!cat && !auto && name.trim() && <span className="text-[11px] font-medium normal-case tracking-normal text-warn"> · no lo reconozco, elegilo</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {MUSCLE_CATS.map(c => (
          <button
            key={c}
            type="button"
            className={chip(cat === c || (!cat && auto === c), cat === c ? 'on' : 'blue')}
            aria-pressed={cat === c}
            onClick={() => setCat(cat === c ? '' : c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Con qué se hace el ejercicio. Es lo que permite que el historial no
          mezcle números que no son comparables — ver lib/equip.js. */}
      <label className={eyebrowCls}>Con qué lo hacés</label>
      <div className="flex flex-wrap gap-2">
        {EQUIP.map(e => (
          <button
            key={e.id}
            type="button"
            className={chip(equip === e.id)}
            aria-pressed={equip === e.id}
            onClick={() => setEquip(equip === e.id ? '' : e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>
      {equip && (
        <div className="mt-2 text-[13px] text-mut">
          {EQUIP_HINT[equip]}
        </div>
      )}
      {isMachineBound(equip) && (
        <MachineField equip={equip} machine={machine} onChange={setMachine} />
      )}

      {/* Foto de la máquina: sacada por vos, guardada en el ejercicio. Es más
          útil que una ilustración genérica porque reconocés ESA máquina. */}
      {equip && (
        <div className="mt-3">
          <label className="mb-1.5 block text-[13px] font-medium text-mut">Foto de la máquina</label>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhoto}
          />
          {photo ? (
            <div className="overflow-hidden rounded-[var(--radius-r-lg)] border border-line2">
              <img src={photo} alt="" className="block w-full" />
              <div className="flex gap-2 p-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => photoRef.current?.click()}>Cambiar</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto('')}>Quitar</Button>
              </div>
            </div>
          ) : (
            <>
              <Button type="button" variant="secondary" className="w-full" onClick={() => photoRef.current?.click()}>
                📷 Sacar o elegir foto
              </Button>
              <div className="mt-1.5 text-[13px] text-mut">
                Para reconocerla al llegar. Se guarda reducida en tu teléfono, nunca se sube a ningún lado.
              </div>
            </>
          )}
        </div>
      )}

      {/* Ilustración del movimiento (free-exercise-db, dominio público). Se
          elige a mano una vez: la base es en inglés y adivinar automáticamente
          pondría la imagen equivocada más de una vez. */}
      <div className="mt-3">
        <label className="mb-1.5 block text-[13px] font-medium text-mut">Ilustración del movimiento</label>
        {illus ? (
          <div className="overflow-hidden rounded-[var(--radius-r-lg)] border border-line2">
            <img src={illusUrl(illus)} alt="" className="block w-full" />
            <div className="flex gap-2 p-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(true)}>Cambiar</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIllus('')}>Quitar</Button>
            </div>
          </div>
        ) : (
          <>
            <Button type="button" variant="secondary" className="w-full" onClick={() => setPicking(true)}>
              🖼 Buscar ilustración
            </Button>
            <div className="mt-1.5 text-[13px] text-mut">
              Para ver cómo se hace el movimiento. Se descarga la primera vez y queda guardada.
            </div>
          </>
        )}
        {picking && (
          <IllusPick exName={name} onPick={setIllus} onClose={() => setPicking(false)} />
        )}
      </div>
      <Button type="button" className="mt-3.5 w-full" onClick={handleSave}>Guardar</Button>
    </div>
  );
}
