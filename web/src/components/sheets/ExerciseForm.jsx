// Puerto de sheetExForm() (index.html, sección 17 "selector de ejercicio").
// Incluye: autocompletado en vivo (antes updateExAutocomplete(), disparado
// por un listener delegado global sobre #f-exname — acá es sólo estado
// derivado del input), sugeridos para el día (recommendedExercises), el
// explorador de catálogo completo (<details>, sólo al crear), dictado por
// voz (SpeechRecognition, sólo al crear) y los steppers de series/reps
// (antes ACT['exf-step']).
//
// CREAR es un onboarding de 4 pasos (① nombre ② cómo se hace ③ confirmar,
// con el grupo muscular ya detectado ④ agregado, con "agregar otro" para
// seguir sin cerrar el sheet) — pedido de Enzo 2026-09-17: "que al terminar
// de crear uno la app lo agrupa en su grupo muscular en segundo plano, antes
// de eso te dice confirmar". EDITAR sigue siendo el formulario directo de
// siempre (un ejercicio ya existe, no tiene sentido "agregar otro" — ver
// consigna del handoff, punto 8): esa rama no cambió de forma, sólo de lugar
// en el archivo.
//
// El obstáculo que había: el sistema de sheets no apila (un solo S.sheet,
// openSheet() reemplaza — ver state.js), así que un flujo de varios paneles
// encadenados no era posible. La salida es no necesitarlo: el sheet queda
// abierto y su CONTENIDO avanza por pasos, acá adentro.
//
// Quedaba un segundo obstáculo: saveExercise() (rutina-logic.js) hacía
// closeSheet() al terminar, porque hasta ahora SIEMPRE se volvía atrás. Se
// resolvió en la raíz, con su opción `mantenerSheet` — la primera versión
// cerraba y reabría el panel en cada ejercicio para sobrevivir a ese cierre,
// y eso reconstruía todo el DOM del formulario una vez por ejercicio.
import { useEffect, useRef, useState } from 'react';
import { EQUIP, EQUIP_HINT, isMachineBound } from '../../lib/equip.js';
import MachineField from '../MachineField.jsx';
import { MUSCLE_CATS, catOf } from '../../lib/muscle.js';
import { shrinkImage } from '../../lib/photo.js';
import { illusUrl } from '../../lib/illustrations.js';
import IllusPick from './IllusPick.jsx';
import { norm } from '../../lib/format.js';
import { EXCATALOG } from '../../lib/muscle.js';
import { exMatchesQuery } from '../../lib/exdb.js';
import { recommendedExercises, saveExercise } from '../../lib/rutina-logic.js';
import { toast } from '../../lib/toast.js';
import { closeSheet } from '../../lib/state.js';
import { Mic, RecordDot } from '../Icon.jsx';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/primitives.jsx';
import MuscleFibers from '../MuscleFibers.jsx';
import {
  TOTAL_PASOS, initialWizardState, resolvedCat, nextStep, prevStep,
  setField, confirmAdded, startAnother,
} from '../../lib/exercise-wizard.js';

const SR_CLASS = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;
const CATALOG_CATS = [...new Set(EXCATALOG.map(e => e.c))];

const inputCls = 'h-11 w-full rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 text-body text-txt outline-none transition-colors focus-visible:border-blue2';
const eyebrowCls = 'mt-4 mb-2 block text-micro font-semibold uppercase tracking-wide text-mut';
const chipBase = 'inline-flex items-center rounded-full border border-line2 px-3.5 py-2 text-sm font-medium transition-colors';
const chip = (on, tone = 'on') => cn(chipBase, on ? (tone === 'blue' ? 'border-transparent bg-blue2 text-[var(--on-grad)]' : 'border-transparent bg-[image:var(--grad)] font-bold text-[var(--on-grad)]') : 'bg-card2 text-txt hover:border-line');

/** Barra de progreso de los 4 pasos: sobria, sin número de paso ni texto —
    sólo cuánto camino queda. Mismo lenguaje de tokens que el resto de la
    app (--d2/--ease-out), nunca un ms suelto. */
function WizardProgress({ step }) {
  return (
    <div className="exwiz-progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_PASOS}>
      {Array.from({ length: TOTAL_PASOS }, (_, i) => (
        <i key={i} className={i < step ? 'on' : ''} />
      ))}
    </div>
  );
}

/* Wrapper sin hooks propios: decide qué formulario renderizar según
   `ex`. Tiene que ser así y no un `if` dentro de un solo componente —
   EditForm y CreateWizard llaman hooks en cantidad y orden distintos, y
   las reglas de hooks de React (con razón: son las que garantizan que
   cada useState conserve SU slot entre renders) no permiten esa rama
   condicional dentro de un mismo componente. */
export default function ExerciseForm({ wd, ex }) {
  // MODO EDICIÓN: un ejercicio ya existe. El onboarding de 4 pasos con
  // "agregar otro" no tiene sentido acá (no hay "otro" que agregar) — se
  // mantiene el formulario directo de siempre, con su botón Guardar.
  if (ex) return <EditForm wd={wd} ex={ex} />;
  // CREAR: onboarding de 4 pasos.
  return <CreateWizard wd={wd} />;
}

function CreateWizard({ wd }) {
  const rootRef = useRef(null);
  const [wiz, setWiz] = useState(initialWizardState);
  const [dir, setDir] = useState('r'); // dirección del deslizamiento entre pasos
  const [acOpen, setAcOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [picking, setPicking] = useState(false);
  const photoRef = useRef(null);
  const nameRef = useRef(null);
  const voiceRef = useRef(null);
  const suggestions = recommendedExercises(wd);
  const [writingFree, setWritingFree] = useState(() => !suggestions.length);

  useEffect(() => () => voiceRef.current?.stop(), []);

  const form = wiz.form;
  function setWizField(field, value) { setWiz(w => setField(w, field, value)); }

  const nq = norm(form.name);
  const acMatches = acOpen && nq ? EXCATALOG.filter(e => exMatchesQuery(e.n, nq)).slice(0, 6) : [];

  function pickName(n) { setWizField('name', n); setAcOpen(false); setWritingFree(true); }
  function handleNameChange(v) { setWizField('name', v); setAcOpen(true); }
  function step(field, d) { setWiz(w => setField(w, field, Math.max(1, (parseInt(w.form[field]) || 0) + d))); }

  function toggleVoice() {
    if (!SR_CLASS) return;
    if (voiceRef.current) { voiceRef.current.stop(); return; }
    const rec = new SR_CLASS();
    rec.lang = 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
    voiceRef.current = rec; setRecording(true);
    rec.onresult = e => {
      const txt = (e.results[0]?.[0]?.transcript || '').trim();
      if (txt) { setWizField('name', txt.charAt(0).toUpperCase() + txt.slice(1)); nameRef.current?.focus(); }
    };
    rec.onerror = () => toast('No se pudo escuchar. Probá de nuevo.');
    rec.onend = () => { voiceRef.current = null; setRecording(false); };
    rec.start();
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setWizField('photo', await shrinkImage(file));
    } catch (err) {
      toast(err.message || 'No se pudo procesar la foto');
    }
  }

  // lo que el matcher deduce del nombre, para mostrarlo antes de que elijas
  const auto = catOf({ name: form.name });

  function handleNext() {
    const { state, error } = nextStep(wiz);
    if (error) { toast(error); return; }
    setDir('r');
    setWiz(state);
  }
  function handleBack() {
    setDir('l');
    setWiz(prevStep(wiz));
  }

  /** Paso ③ -> guarda de verdad y pasa al ④, sin salir del sheet.
      `mantenerSheet:true` es lo que lo hace posible (ver saveExercise en
      rutina-logic.js): antes había que cerrar y reabrir el panel en cada
      ejercicio para sobrevivir a su closeSheet(), lo que reconstruía todo
      el DOM del formulario una vez por ejercicio. Ahora el panel no se
      entera: sólo cambia de paso, como los otros tres. */
  async function handleConfirmAndSave() {
    const nombre = form.name.trim();
    await saveExercise(wd, null, {
      name: form.name, sets: form.sets, reps: form.reps, equip: form.equip,
      machine: form.machine, photo: form.photo, illus: form.illus,
      cat: form.cat, unilateral: form.unilateral,
    }, { mantenerSheet: true });
    setDir('r');
    setWiz(confirmAdded(wiz, nombre));
  }

  function handleAgregarOtro() {
    const otra = startAnother(wiz);
    setDir('r');
    setWiz(otra);
    setAcOpen(false);
    setWritingFree(!recommendedExercises(wd).length);
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  const grupo = resolvedCat(form);
  const equipLabel = EQUIP.find(e => e.id === form.equip)?.label;

  return (
    <div ref={rootRef}>
      <WizardProgress step={wiz.step} />
      <div key={wiz.step} className={cn('exwiz-step', dir === 'l' && 'dir-l')}>

        {wiz.step === 1 && (
          <>
            <h2 className="font-cond text-2xl font-bold text-txt">¿Qué ejercicio?</h2>

            {!writingFree && (
              <>
                {suggestions.length > 0 && (
                  <>
                    <div className="mt-3 mb-1.5 text-micro uppercase tracking-wide text-mut">
                      Sugeridos para hoy
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map(e => (
                        <button key={e.n} type="button" className={chip(false)} onClick={() => pickName(e.n)}>{e.n}</button>
                      ))}
                    </div>
                  </>
                )}
                <details className="mt-2.5" open={!suggestions.length}>
                  <summary className="cursor-pointer text-sm font-semibold text-blue">📚 Explorar toda la base de ejercicios</summary>
                  <div className="mt-2">
                    {CATALOG_CATS.map(c => (
                      <div key={c}>
                        <div className="mt-2.5 mb-1.5 text-micro uppercase tracking-wide text-mut">{c}</div>
                        <div className="flex flex-wrap gap-2">
                          {EXCATALOG.filter(e => e.c === c).map(e => (
                            <button key={e.n} type="button" className={chip(false)} onClick={() => pickName(e.n)}>{e.n}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
                <Button type="button" variant="ghost" className="mt-3 w-full" onClick={() => { setWritingFree(true); setTimeout(() => nameRef.current?.focus(), 0); }}>
                  ✏️ Escribir otro
                </Button>
              </>
            )}

            {writingFree && (
              <div className="mt-3">
                <label htmlFor="exform-nombre" className="mb-1.5 block text-sm font-medium text-mut">Nombre</label>
                <div className="flex items-center gap-2">
                  <input
                    id="exform-nombre"
                    ref={nameRef}
                    className={cn(inputCls, 'flex-1')}
                    value={form.name}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="Press banca"
                    autoComplete="off"
                  />
                  {SR_CLASS && (
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
                      <button key={e.n} type="button" className="rounded-[10px] px-2.5 py-1.5 text-left text-sm text-txt hover:bg-white/5" onClick={() => pickName(e.n)}>
                        {e.n} <span className="text-micro text-mut">· {e.c}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" className="mt-1.5 text-sm font-medium text-blue" onClick={() => setWritingFree(false)}>
                  ← Volver a sugerencias
                </button>
              </div>
            )}

            <Button type="button" className="mt-3.5 w-full" onClick={handleNext}>Siguiente</Button>
            <Button type="button" variant="ghost" className="mt-2 w-full" onClick={closeSheet}>Cancelar</Button>
          </>
        )}

        {wiz.step === 2 && (
          <>
            <h2 className="font-cond text-2xl font-bold text-txt">¿Cómo lo hacés?</h2>
            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="exform-series" className="mb-1.5 block text-sm font-medium text-mut">Series objetivo</label>
                <div className="flex h-11 items-center overflow-hidden rounded-[var(--radius-r)] border border-line2 bg-card2">
                  <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" aria-label="Una serie menos" onClick={() => step('sets', -1)}>−</button>
                  <div className="flex-1 text-center"><input id="exform-series" type="number" inputMode="numeric" className="w-full bg-transparent text-center text-body text-txt outline-none" value={form.sets} onChange={e => setWizField('sets', e.target.value)} /></div>
                  <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" aria-label="Una serie más" onClick={() => step('sets', 1)}>+</button>
                </div>
              </div>
              <div>
                <label htmlFor="exform-reps" className="mb-1.5 block text-sm font-medium text-mut">Reps objetivo</label>
                <div className="flex h-11 items-center overflow-hidden rounded-[var(--radius-r)] border border-line2 bg-card2">
                  <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" aria-label="Una repetición menos" onClick={() => step('reps', -1)}>−</button>
                  <div className="flex-1 text-center"><input id="exform-reps" type="number" inputMode="numeric" className="w-full bg-transparent text-center text-body text-txt outline-none" value={form.reps} onChange={e => setWizField('reps', e.target.value)} /></div>
                  <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" aria-label="Una repetición más" onClick={() => step('reps', 1)}>+</button>
                </div>
              </div>
            </div>

            <label className={eyebrowCls}>Cómo se hace</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={chip(form.unilateral)}
                aria-pressed={form.unilateral}
                onClick={() => setWizField('unilateral', !form.unilateral)}
              >
                Un lado por vez
              </button>
            </div>
            {form.unilateral && (
              <div className="mt-1.5 text-sm text-mut">
                El peso y las reps que anotes en la sesión van a leerse como "por lado".
              </div>
            )}

            <label className={eyebrowCls}>Con qué lo hacés</label>
            <div className="flex flex-wrap gap-2">
              {EQUIP.map(e => (
                <button
                  key={e.id}
                  type="button"
                  className={chip(form.equip === e.id)}
                  aria-pressed={form.equip === e.id}
                  onClick={() => setWizField('equip', form.equip === e.id ? '' : e.id)}
                >
                  {e.label}
                </button>
              ))}
            </div>
            {form.equip && (
              <div className="mt-2 text-sm text-mut">
                {EQUIP_HINT[form.equip]}
              </div>
            )}
            {isMachineBound(form.equip) && (
              <MachineField equip={form.equip} machine={form.machine} onChange={v => setWizField('machine', v)} />
            )}

            {form.equip && (
              <div className="mt-3">
                <label className="mb-1.5 block text-sm font-medium text-mut">Foto de la máquina</label>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onPhoto}
                />
                {form.photo ? (
                  <div className="overflow-hidden rounded-[var(--radius-r-lg)] border border-line2">
                    <img src={form.photo} alt="" className="block w-full" />
                    <div className="flex gap-2 p-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => photoRef.current?.click()}>Cambiar</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setWizField('photo', '')}>Quitar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button type="button" variant="secondary" className="w-full" onClick={() => photoRef.current?.click()}>
                      📷 Sacar o elegir foto
                    </Button>
                    <div className="mt-1.5 text-sm text-mut">
                      Para reconocerla al llegar. Se guarda reducida en tu teléfono, nunca se sube a ningún lado.
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="mt-3">
              <label className="mb-1.5 block text-sm font-medium text-mut">Ilustración del movimiento</label>
              {form.illus ? (
                <div className="overflow-hidden rounded-[var(--radius-r-lg)] border border-line2">
                  <img src={illusUrl(form.illus)} alt="" className="block w-full" />
                  <div className="flex gap-2 p-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(true)}>Cambiar</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setWizField('illus', '')}>Quitar</Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button type="button" variant="secondary" className="w-full" onClick={() => setPicking(true)}>
                    🖼 Buscar ilustración
                  </Button>
                  <div className="mt-1.5 text-sm text-mut">
                    Para ver cómo se hace el movimiento. Se descarga la primera vez y queda guardada.
                  </div>
                </>
              )}
              {picking && (
                <IllusPick exName={form.name} onPick={v => setWizField('illus', v)} onClose={() => setPicking(false)} />
              )}
            </div>

            <Button type="button" className="mt-3.5 w-full" onClick={handleNext}>Siguiente</Button>
            <Button type="button" variant="ghost" className="mt-2 w-full" onClick={handleBack}>← Volver</Button>
          </>
        )}

        {wiz.step === 3 && (
          <>
            <h2 className="font-cond text-2xl font-bold text-txt">Confirmar</h2>
            <div className="exwiz-confirm">
              <div className="nombre">{form.name}</div>
              <div className="datos">
                {form.sets}×{form.reps}
                {equipLabel ? ` · ${equipLabel}` : ''}
                {form.machine ? ` · ${form.machine}` : ''}
                {form.unilateral ? ' · por lado' : ''}
              </div>
              <div className="grupo-row">
                <MuscleFibers cat={grupo} exercises={[{ name: form.name, sets: form.sets }]} />
                {grupo ? (
                  <span className="text-sm font-medium text-txt">{grupo}</span>
                ) : (
                  <span className="text-sm font-medium text-warn">No lo reconozco — elegí el grupo</span>
                )}
              </div>
            </div>
            {!form.cat && (
              <>
                <label className={eyebrowCls}>Qué grupo entrena</label>
                <div className="flex flex-wrap gap-2">
                  {MUSCLE_CATS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={chip(auto === c, 'blue')}
                      aria-pressed={auto === c}
                      onClick={() => setWizField('cat', c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}
            {form.cat && (
              <button type="button" className="mt-2 text-sm font-medium text-blue" onClick={() => setWizField('cat', '')}>
                Volver al automático
              </button>
            )}

            <Button type="button" className="mt-3.5 w-full" onClick={handleConfirmAndSave}>Agregar</Button>
            <Button type="button" variant="ghost" className="mt-2 w-full" onClick={handleBack}>← Volver</Button>
          </>
        )}

        {wiz.step === 4 && (
          <>
            <div className="exwiz-done">
              <div className="check">✓</div>
              <h2 className="font-cond text-2xl font-bold text-txt">Agregado</h2>
              <div className="nombre">{wiz.batch[wiz.batch.length - 1]}</div>
            </div>

            {wiz.batch.length > 0 && (
              <div className="exwiz-batch">
                Agregaste {wiz.batch.length}: {wiz.batch.join(' · ')}
              </div>
            )}

            <Button type="button" className="w-full" onClick={handleAgregarOtro}>+ Agregar otro</Button>
            <Button type="button" variant="ghost" className="mt-2 w-full" onClick={closeSheet}>Listo</Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Formulario directo de edición — sin pasos, sin "agregar otro": el
    ejercicio ya existe, sólo se corrigen sus datos. Es el mismo formulario
    que existía antes de este onboarding, sólo separado en su propio
    componente para no mezclar sus condicionales con los del wizard. */
function EditForm({ wd, ex }) {
  const rootRef = useRef(null);
  const [name, setName] = useState(ex.name);
  const [sets, setSets] = useState(ex.sets);
  const [reps, setReps] = useState(ex.reps);
  const [equip, setEquip] = useState(ex.equip || '');
  const [cat, setCat] = useState(ex.cat || '');
  const [machine, setMachine] = useState(ex.machine || '');
  const [unilateral, setUnilateral] = useState(!!ex.unilateral);
  const [photo, setPhoto] = useState(ex.photo || '');
  const [illus, setIllus] = useState(ex.illus || '');
  const [picking, setPicking] = useState(false);
  const photoRef = useRef(null);

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await shrinkImage(file));
    } catch (err) {
      toast(err.message || 'No se pudo procesar la foto');
    }
  }

  function step(setter, d) { setter(v => Math.max(1, (parseInt(v) || 0) + d)); }

  const auto = catOf({ name });
  function handleSave() { saveExercise(wd, ex.id, { name, sets, reps, equip, machine, photo, illus, cat, unilateral }); }

  return (
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">Editar ejercicio</h2>

      <div className="mt-3">
        <label htmlFor="exform-nombre" className="mb-1.5 block text-sm font-medium text-mut">Nombre</label>
        <input
          id="exform-nombre"
          className={inputCls}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Press banca"
          autoComplete="off"
        />
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="exform-series" className="mb-1.5 block text-sm font-medium text-mut">Series objetivo</label>
          <div className="flex h-11 items-center overflow-hidden rounded-[var(--radius-r)] border border-line2 bg-card2">
            <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" aria-label="Una serie menos" onClick={() => step(setSets, -1)}>−</button>
            <div className="flex-1 text-center"><input id="exform-series" type="number" inputMode="numeric" className="w-full bg-transparent text-center text-body text-txt outline-none" value={sets} onChange={e => setSets(e.target.value)} /></div>
            <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" aria-label="Una serie más" onClick={() => step(setSets, 1)}>+</button>
          </div>
        </div>
        <div>
          <label htmlFor="exform-reps" className="mb-1.5 block text-sm font-medium text-mut">Reps objetivo</label>
          <div className="flex h-11 items-center overflow-hidden rounded-[var(--radius-r)] border border-line2 bg-card2">
            <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" aria-label="Una repetición menos" onClick={() => step(setReps, -1)}>−</button>
            <div className="flex-1 text-center"><input id="exform-reps" type="number" inputMode="numeric" className="w-full bg-transparent text-center text-body text-txt outline-none" value={reps} onChange={e => setReps(e.target.value)} /></div>
            <button type="button" className="h-full w-11 flex-none text-lg text-mut hover:text-txt" aria-label="Una repetición más" onClick={() => step(setReps, 1)}>+</button>
          </div>
        </div>
      </div>

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
        <div className="mt-1.5 text-sm text-mut">
          El peso y las reps que anotes en la sesión van a leerse como "por lado".
        </div>
      )}

      <label className={eyebrowCls}>
        Qué grupo entrena
        {!cat && auto && <span className="text-micro font-medium normal-case tracking-normal text-mut"> · detecté {auto}</span>}
        {!cat && !auto && name.trim() && <span className="text-micro font-medium normal-case tracking-normal text-warn"> · no lo reconozco, elegilo</span>}
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
        <div className="mt-2 text-sm text-mut">
          {EQUIP_HINT[equip]}
        </div>
      )}
      {isMachineBound(equip) && (
        <MachineField equip={equip} machine={machine} onChange={setMachine} />
      )}

      {equip && (
        <div className="mt-3">
          <label className="mb-1.5 block text-sm font-medium text-mut">Foto de la máquina</label>
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
              <div className="mt-1.5 text-sm text-mut">
                Para reconocerla al llegar. Se guarda reducida en tu teléfono, nunca se sube a ningún lado.
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-3">
        <label className="mb-1.5 block text-sm font-medium text-mut">Ilustración del movimiento</label>
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
            <div className="mt-1.5 text-sm text-mut">
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
