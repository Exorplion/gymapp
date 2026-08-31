// Asistente de creación de rutina por onboarding: primero pregunta qué
// grupos musculares va a trabajar cada día (tocando tarjetas grandes, el
// cuerpo se enciende en vivo con lo que vas eligiendo) y después muestra
// ejercicios recomendados de cada grupo para que la persona elija cuáles
// quiere — nunca los que la app "decide" (ej. pecho puede arrancar con
// plano o con inclinado, y elige la persona).
//
// La "cobertura de fibra" que se ve en el paso 2 (coverage.js) es
// deliberadamente un checklist cubierto/falta, NO un porcentaje: se
// investigó (fuentes reales, ver fibras.js y coverage.js) y ningún estudio
// EMG da un reparto tipo "70/30" entre ejercicios que sume 100% — inventar
// ese número sería mostrar una precisión que no existe.
//
// Arma una rutina de PRUEBA: uno o más días, guardados directo en la
// biblioteca (S.lib) al terminar — nunca toca el split activo ni pide
// vaciarlo. Aplicar la rutina guardada (con su propio confirm de reemplazo)
// es un paso aparte, el de siempre en "Mis rutinas".
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import gsap from 'gsap';
import { closeSheet } from '../../lib/state.js';
import { MUSCLE_CATS, EXCATALOG } from '../../lib/muscle.js';
import { coberturaDe } from '../../lib/coverage.js';
import { saveWizardRoutine } from '../../lib/rutina-logic.js';
import { toast } from '../../lib/toast.js';
import AnimatedText from '../AnimatedText.jsx';
import Silhouette from '../Silhouette.jsx';

const TOTAL_PASOS = 3;

/** Barra de progreso arriba del sheet — el mismo lenguaje que ya usaban las
    referencias de onboarding que pidió Enzo (Liftoff): una barra que se
    llena paso a paso, no un texto "paso 2 de 3". El estilo visual es el de
    Fierro (gradiente cian/azul), no una copia literal de la referencia. */
function WizardProgress({ step }) {
  const pct = Math.round((step / TOTAL_PASOS) * 100);
  return (
    <div className="wiz-progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_PASOS}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/** El cuerpo reacciona en vivo a lo que se va eligiendo: los grupos de
    `cats` se encienden como "hoy" (tono más brillante), el resto queda
    neutro — mismo mecanismo que BodyPreview en Hoy.jsx. No interactivo: acá
    el cuerpo informa, no se toca ni se gira. */
function WizardBody({ cats }) {
  const set = new Set(cats);
  const days = {};
  MUSCLE_CATS.forEach(c => { days[c] = set.has(c) ? 0 : null; });
  return (
    <div className="wiz-body">
      <Silhouette days={days} interactivo={false} />
    </div>
  );
}

/** Entrada en cascada de los chips/tarjetas de un paso: corre cada vez que
    `step` cambia (grupos -> ejercicios -> guardar), sobre lo que haya
    adentro del contenedor en ESE momento. */
function useStepReveal(step) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const targets = el.querySelectorAll('.chip, .field, .card.sub, .wiz-groupcard');
    if (!targets.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: 12, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.035, ease: 'power2.out', delay: 0.05 },
      );
    });
    return () => ctx.revert();
  }, [step]);
  return ref;
}

/** Checklist de cobertura de fibra para un grupo, debajo de sus ejercicios
    elegidos. null (coberturaDe) = el grupo no tiene porciones distinguibles
    con evidencia real — no se muestra nada en vez de fabricar una. */
function CoverageStrip({ cat, nombres }) {
  const cob = coberturaDe(cat, nombres);
  if (!cob) return null;
  return (
    <div className="wiz-coverage">
      {cob.fibras.map(f => (
        <span key={f} className={`wiz-fiber ${cob.cubiertas.includes(f) ? 'on' : ''}`}>
          {cob.cubiertas.includes(f) ? '✓ ' : ''}{f}
        </span>
      ))}
    </div>
  );
}

export default function RoutineWizard() {
  const [step, setStep] = useState(1); // 1: grupos del día actual, 2: ejercicios del día actual, 3: nombre y guardar
  const [days, setDays] = useState([]); // días ya cerrados: [{name, exercises:[{name,cat}]}]
  const [cats, setCats] = useState([]);
  const [chosen, setChosen] = useState([]); // [{name, cat}] del día en curso
  const [dayName, setDayName] = useState('');
  const [routineName, setRoutineName] = useState('');
  const revealRef = useStepReveal(step);

  function toggleCat(c) {
    setCats(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]);
  }
  function toggleEx(n, cat) {
    setChosen(cs => cs.some(e => e.name === n)
      ? cs.filter(e => e.name !== n)
      : [...cs, { name: n, cat }]);
  }

  // Cambia de paso con View Transitions API cuando el navegador la soporta
  // (Chrome/Edge, Safari reciente) y no hay "reducir movimiento": el sheet
  // entero hace un crossfade suave en vez del salto seco de siempre. Sin
  // soporte, cae directo al setStep de toda la vida — mismo resultado, sin
  // el efecto.
  function cambiarPaso(fn) {
    const puedeVT = typeof document.startViewTransition === 'function'
      && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // startViewTransition necesita el DOM ya actualizado ANTES de tomar la
    // foto del "después" — flushSync fuerza ese render sincrónico; sin él,
    // React batchea el setState y la librería fotografía el estado viejo dos
    // veces (nunca se ve el cambio).
    if (puedeVT) document.startViewTransition(() => flushSync(fn));
    else fn();
  }

  function irAEjercicios() {
    if (!cats.length) { toast('Elegí al menos un grupo'); return; }
    cambiarPaso(() => { setDayName(cats.join(' / ')); setStep(2); });
  }

  function cerrarDia() {
    if (!chosen.length) { toast('Elegí al menos un ejercicio'); return null; }
    const dia = { name: dayName.trim(), exercises: chosen };
    const nuevos = [...days, dia];
    setDays(nuevos);
    return nuevos;
  }

  function agregarOtroDia() {
    if (!cerrarDia()) return;
    cambiarPaso(() => { setCats([]); setChosen([]); setDayName(''); setStep(1); });
  }

  function irAGuardar() {
    const nuevos = cerrarDia();
    if (!nuevos) return;
    cambiarPaso(() => {
      setRoutineName(nuevos.map(d => d.name).join(' + '));
      setStep(3);
    });
  }

  function guardar() {
    saveWizardRoutine(routineName, days);
    // saveWizardRoutine ya cierra el sheet y muestra el toast (o abre el
    // confirm de reemplazo si el nombre ya existe en la biblioteca).
  }

  if (step === 1) {
    const titulo1 = days.length ? `Día ${days.length + 1} · grupos musculares` : 'Nueva rutina · grupos musculares';
    return (
      <>
        <WizardProgress step={1} />
        <h2><AnimatedText text={titulo1} /></h2>
        <div className="sheet-sub">
          ¿Qué vas a trabajar este día? Podés elegir más de uno — por ejemplo Pecho, Hombro y Tríceps para un día de empuje.
          {days.length > 0 && ` Ya tenés ${days.length} día${days.length === 1 ? '' : 's'} armado${days.length === 1 ? '' : 's'} en esta rutina.`}
        </div>
        <WizardBody cats={cats} />
        <div className="wiz-grid" ref={revealRef}>
          {MUSCLE_CATS.map(c => (
            <button
              key={c}
              type="button"
              className={`wiz-groupcard ${cats.includes(c) ? 'on' : ''}`}
              aria-pressed={cats.includes(c)}
              onClick={() => toggleCat(c)}
            >
              <span className="t">{c}</span>
              {cats.includes(c) && <span className="check">✓</span>}
            </button>
          ))}
        </div>
        <button type="button" className="btn" style={{ marginTop: 'var(--s4)' }} onClick={irAEjercicios}>
          Siguiente
        </button>
        <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={closeSheet}>Cancelar</button>
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <WizardProgress step={2} />
        <h2><AnimatedText text="Elegí los ejercicios" /></h2>
        <div className="sheet-sub">
          Tocá los que quieras incluir. Son sugerencias — nada se agrega solo.
        </div>
        <WizardBody cats={cats} />
        <div ref={revealRef}>
        <div className="field">
          <label htmlFor="wiz-dia-nombre">Nombre de este día</label>
          <input id="wiz-dia-nombre" value={dayName} onChange={e => setDayName(e.target.value)} placeholder="Push" />
        </div>
        {cats.map(c => {
          const pool = EXCATALOG.filter(e => e.c === c);
          const elegidosDeC = chosen.filter(x => x.cat === c).map(x => x.name);
          return (
            <div key={c} className="field">
              <label>{c}</label>
              <div className="chips">
                {pool.map(e => (
                  <button
                    key={e.n}
                    type="button"
                    className={`chip ${chosen.some(x => x.name === e.n) ? 'on' : ''}`}
                    aria-pressed={chosen.some(x => x.name === e.n)}
                    onClick={() => toggleEx(e.n, c)}
                  >
                    {e.n}
                  </button>
                ))}
              </div>
              <CoverageStrip cat={c} nombres={elegidosDeC} />
            </div>
          );
        })}
        <div className="txt-mut" style={{ fontSize: 12.5, margin: '4px 0 var(--s3)' }}>
          {chosen.length} ejercicio{chosen.length === 1 ? '' : 's'} elegido{chosen.length === 1 ? '' : 's'} · series y repeticiones se pueden ajustar después, ejercicio por ejercicio.
        </div>
        </div>
        <button type="button" className="btn" onClick={irAGuardar}>
          {days.length ? 'Terminar y guardar rutina' : 'Guardar rutina'}
        </button>
        <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={agregarOtroDia}>
          + Agregar otro día a esta rutina
        </button>
        <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={() => setStep(1)}>Volver</button>
      </>
    );
  }

  // step === 3: nombre de la rutina entera y guardado en la biblioteca.
  return (
    <>
      <WizardProgress step={3} />
      <h2><AnimatedText text="Guardar en tu biblioteca" /></h2>
      <div className="sheet-sub">
        Queda en "Mis rutinas" para probarla cuando quieras — tu split activo no cambia.
      </div>
      <div ref={revealRef}>
      <div className="field">
        <label htmlFor="wiz-nombre">Nombre de la rutina</label>
        <input id="wiz-nombre" value={routineName} onChange={e => setRoutineName(e.target.value)} placeholder="Mi rutina de prueba" />
      </div>
      <div className="card sub" style={{ padding: 'var(--s2) var(--s3)', marginBottom: 'var(--s3)' }}>
        {days.map((d, i) => (
          <div className="row" key={i}>
            <div className="grow">
              <div className="t">{d.name || `Día ${i + 1}`}</div>
              <div className="s">{d.exercises.length} ejercicio{d.exercises.length === 1 ? '' : 's'}</div>
            </div>
          </div>
        ))}
      </div>
      </div>
      <button type="button" className="btn" onClick={guardar}>Guardar en mi biblioteca</button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={() => setStep(2)}>Volver</button>
    </>
  );
}
