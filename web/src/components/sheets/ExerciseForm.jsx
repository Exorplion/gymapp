// Puerto de sheetExForm() (index.html, sección 17 "selector de ejercicio").
//
// Hasta el 2026-09-28 también CREABA (un onboarding de 4 pasos, el
// CreateWizard). Ese alta pasó al asistente de 3 pasos, AgregarEjercicio.jsx,
// que es el mismo para la rutina y para la sesión abierta. Esto quedó como el
// formulario de EDITAR, con los campos avanzados.
import { useRef, useState } from 'react';
import { EQUIP, EQUIP_HINT, isMachineBound } from '../../lib/equip.js';
import MachineField from '../MachineField.jsx';
import { MUSCLE_CATS, catOf } from '../../lib/muscle.js';
import { shrinkImage } from '../../lib/photo.js';
import { illusUrl } from '../../lib/illustrations.js';
import IllusPick from './IllusPick.jsx';
import { round1 } from '../../lib/format.js';
import { saveExercise } from '../../lib/rutina-logic.js';
import { toast } from '../../lib/toast.js';
import { S, wToUnit, wFromUnit } from '../../lib/state.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/primitives.jsx';
import { Camera, Imagen } from '../Icon.jsx';


const inputCls = 'h-11 w-full rounded-[var(--radius-r)] border border-line-2 bg-surface-2 px-3.5 text-body text-text outline-none transition-colors focus-visible:border-accent';
const eyebrowCls = 'mt-4 mb-2 block t-etiqueta';
const chipBase = 'inline-flex items-center rounded-full border border-line-2 px-3.5 py-2 text-sm font-semibold transition-colors';
const chip = (on, tone = 'on') => cn(chipBase, on ? (tone === 'blue' ? 'border-transparent bg-accent text-[var(--on-accent)]' : 'border-transparent bg-[image:var(--accent-grad)] font-bold text-[var(--on-accent)]') : 'bg-surface-2 text-text hover:border-line');

/* El campo se escribe en la unidad que ve el usuario y se guarda en kg —
   `S.cfg.unit` es presentación, el modelo es siempre kg (ver state.js).
   Vacío, en blanco o basura devuelven null: "sin declarar", que NO es 0 y no
   tiene que bloquear el guardado. */
function kgDesdeCampo(txt) {
  const t = String(txt ?? '').trim().replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  if (!isFinite(n) || n <= 0) return null;
  return round1(wFromUnit(n));
}

/** Lo inverso, para precargar el formulario de edición sin arrastrar
    decimales largos de la conversión a lb. */
function campoDesdeKg(kg) {
  return typeof kg === 'number' && kg > 0 ? String(round1(wToUnit(kg))) : '';
}

/* Peso de partida — opcional a propósito. Sólo alimenta el arranque de la
   rueda cuando el ejercicio todavía NO tiene series registradas (ver
   pesoInicial() en lib/session.js): existe para que un ejercicio nuevo no
   aparezca en la sesión con 20 kg inventados. No le gana al historial ni a
   la progresión, y el texto de ayuda lo dice para que no se lea como "el
   peso fijo del ejercicio". */
function PesoInicialField({ value, onChange }) {
  const unidad = S.cfg?.unit === 'lb' ? 'lb' : 'kg';
  /* Usa `inputCls` y no la clase `.field` de MachineField: dentro de ESTE
     formulario el patrón de un campo de texto ya es inputCls (mirá Nombre,
     Series, Reps), y `.field` trae un input de 56px que al lado de los de
     44px se lee como de otro formulario. */
  return (
    <div className="mt-3">
      <label htmlFor="exform-peso-inicial" className="t-etiqueta mb-1.5 block">
        Peso de partida · opcional
      </label>
      <div className="flex items-center gap-2">
        <input
          id="exform-peso-inicial"
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          className={cn(inputCls, 'flex-1')}
          placeholder="Con cuánto arrancás"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <span className="flex-none text-sm text-text-2">{unidad}</span>
      </div>
      <div className="mt-1.5 text-sm text-text-2">
        Lo usa la sesión en vivo mientras no haya series registradas de este
        ejercicio. Después mandan tu historial y la progresión. Vacío = sin
        declarar.
      </div>
    </div>
  );
}

/* Sólo EDITAR: agregar un ejercicio es el asistente de 3 pasos
   (AgregarEjercicio.jsx, abrirAsistente). Acá viven los campos avanzados que
   el asistente deja para después: peso de partida, máquina, foto e
   ilustración. */
export default function ExerciseForm({ wd, ex }) {
  if (!ex) return null;
  return <EditForm wd={wd} ex={ex} />;
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
  // En la unidad que se ve; se convierte a kg recién al guardar.
  const [pesoInicial, setPesoInicial] = useState(() => campoDesdeKg(ex.pesoInicialKg));
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
  function handleSave() {
    saveExercise(wd, ex.id, {
      name, sets, reps, equip, machine, photo, illus, cat, unilateral,
      pesoInicialKg: kgDesdeCampo(pesoInicial),
    });
  }

  return (
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-text">Editar ejercicio</h2>

      <div className="mt-3">
        <label htmlFor="exform-nombre" className="t-etiqueta mb-1.5 block">Nombre</label>
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
          <label htmlFor="exform-series" className="t-etiqueta mb-1.5 block">Series objetivo</label>
          <div className="flex h-11 items-center overflow-hidden rounded-[var(--radius-r)] border border-line-2 bg-surface-2">
            <button type="button" className="h-full w-11 flex-none text-lg text-text-2 hover:text-text" aria-label="Una serie menos" onClick={() => step(setSets, -1)}>−</button>
            <div className="flex-1 text-center"><input id="exform-series" type="number" inputMode="numeric" className="w-full bg-transparent text-center text-body text-text outline-none" value={sets} onChange={e => setSets(e.target.value)} /></div>
            <button type="button" className="h-full w-11 flex-none text-lg text-text-2 hover:text-text" aria-label="Una serie más" onClick={() => step(setSets, 1)}>+</button>
          </div>
        </div>
        <div>
          <label htmlFor="exform-reps" className="t-etiqueta mb-1.5 block">Reps objetivo</label>
          <div className="flex h-11 items-center overflow-hidden rounded-[var(--radius-r)] border border-line-2 bg-surface-2">
            <button type="button" className="h-full w-11 flex-none text-lg text-text-2 hover:text-text" aria-label="Una repetición menos" onClick={() => step(setReps, -1)}>−</button>
            <div className="flex-1 text-center"><input id="exform-reps" type="number" inputMode="numeric" className="w-full bg-transparent text-center text-body text-text outline-none" value={reps} onChange={e => setReps(e.target.value)} /></div>
            <button type="button" className="h-full w-11 flex-none text-lg text-text-2 hover:text-text" aria-label="Una repetición más" onClick={() => step(setReps, 1)}>+</button>
          </div>
        </div>
      </div>

      <PesoInicialField value={pesoInicial} onChange={setPesoInicial} />

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
        <div className="mt-1.5 text-sm text-text-2">
          El peso y las reps que anotes en la sesión van a leerse como "por lado".
        </div>
      )}

      <label className={eyebrowCls}>
        Qué grupo entrena
        {!cat && auto && <span className="text-micro normal-case tracking-normal text-text-2"> · detecté {auto}</span>}
        {!cat && !auto && name.trim() && <span className="text-micro normal-case tracking-normal text-warn"> · no lo reconozco, elegilo</span>}
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
        <div className="mt-2 text-sm text-text-2">
          {EQUIP_HINT[equip]}
        </div>
      )}
      {isMachineBound(equip) && (
        <MachineField equip={equip} machine={machine} onChange={setMachine} />
      )}

      {equip && (
        <div className="mt-3">
          <label className="t-etiqueta mb-1.5 block">Foto de la máquina</label>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhoto}
          />
          {photo ? (
            <div className="overflow-hidden rounded-[var(--radius-r-lg)] border border-line-2">
              <img src={photo} alt="" className="block w-full" />
              <div className="flex gap-2 p-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => photoRef.current?.click()}>Cambiar</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto('')}>Quitar</Button>
              </div>
            </div>
          ) : (
            <>
              <Button type="button" variant="secondary" className="w-full" onClick={() => photoRef.current?.click()}>
                <Camera /> Sacar o elegir foto
              </Button>
              <div className="mt-1.5 text-sm text-text-2">
                Para reconocerla al llegar. Se guarda reducida en tu teléfono, nunca se sube a ningún lado.
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-3">
        <label className="t-etiqueta mb-1.5 block">Ilustración del movimiento</label>
        {illus ? (
          <div className="overflow-hidden rounded-[var(--radius-r-lg)] border border-line-2">
            <img src={illusUrl(illus)} alt="" className="block w-full" />
            <div className="flex gap-2 p-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(true)}>Cambiar</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIllus('')}>Quitar</Button>
            </div>
          </div>
        ) : (
          <>
            <Button type="button" variant="secondary" className="w-full" onClick={() => setPicking(true)}>
              <Imagen /> Buscar ilustración
            </Button>
            <div className="mt-1.5 text-sm text-text-2">
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
