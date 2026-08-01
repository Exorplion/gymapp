// Puerto del carrusel de ejercicios de renderHoy() (index.html: el bloque
// `#ex-carousel`/`.carousel-slide` + initCarousel()/scrollCarouselTo()).
// Componente propio (no inlineado en Hoy.jsx) porque tiene lógica real de
// posicionamiento de scroll que vale la pena aislar — ver lib/carousel.js
// para por qué esa matemática vive en su propio módulo sin dependencias
// (para no crear un ciclo session.js <-> ExerciseCarousel.jsx).
//
// Los inputs de peso/reps de la tarjeta abierta se mantienen NO controlados
// (defaultValue inicial + refs) — el mismo rol que cumplía updExDisplays()
// en el original, que tampoco disparaba un re-render completo por cada
// tecla. Un <input value=…> controlado atado a bump() en cada tecla (o,
// como se detectó en code review — ver ExerciseSlide más abajo — un input
// no controlado que de todos modos reescribe su PROPIO .value en cada
// tecla) pelea con lo que el usuario está escribiendo: borrar el campo para
// tipear un número nuevo (parseFloat('') es NaN, la guarda no actualiza
// v.w, pero si igual se reescribe el input vuelve el valor viejo) o tipear
// un decimal como "62.5" carácter por carácter (parseFloat('62.') da 62, y
// reescribir el input con wDisplay(62)="62" borra el "." recién tecleado).
// Por eso el input de cada campo sólo se reescribe a mano desde los
// steppers (w-/w+/r-/r+, que sí empujan un valor que el usuario no tecleó)
// — nunca desde el propio onChange de ese input. Ver ExerciseSlide/
// syncInputs() vs. syncDependents() más abajo, y task-6-report.md ("Fix
// Round 1") para el bug real que esto corrige.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { S, wDisplay, wAlt, wStep, openSheet } from '../lib/state.js';
import { round1, fmtNum, lb2kg } from '../lib/format.js';
import { exInfo, rirScheme, progressionWarn } from '../lib/exdb.js';
import { ensureVals, lastDataFor, setsDone, saveSet, deleteSet, startExercise } from '../lib/session.js';
import { jumpToSlide, slideCenterDist } from '../lib/carousel.js';

export default function ExerciseCarousel({ exs, wd, active, started, curId, nextEx }) {
  const carRef = useRef(null);
  const dotsRef = useRef(null);

  const meta = useMemo(() => {
    const m = exs.map(ex => {
      const done = setsDone(ex.id);
      const full = done.length >= ex.sets;
      const open = active && curId === ex.id && !full;
      return { ex, done, full, open };
    });
    m.forEach(item => {
      item.isNext = active && !item.open && !curId && nextEx && nextEx.id === item.ex.id;
      item.waiting = active && !item.open && !item.isNext && !item.full;
    });
    return m;
  }, [exs, active, curId, nextEx]);

  const openIdx = useMemo(() => meta.findIndex(m => m.open || m.isNext), [meta]);

  // "A qué slide hay que llevar la vista" sólo cambia cuando cambia el día,
  // el set de ejercicios (día distinto / reordenado), si arrancó la sesión, o
  // cuál es el ejercicio en curso — NO en cada tecla de peso/reps. El
  // original resetea el scroll en CADA render porque su arquitectura
  // (innerHTML=h) recrea el DOM entero y por lo tanto pierde scrollLeft de
  // todas formas; acá React reconcilia sin recrear nodos, así que forzar el
  // salto en cada bump() (p.ej. al tocar "+" en el peso) rompería el swipe
  // manual del usuario para mirar los vecinos. Ver task-6-report.md, Design
  // Decisions.
  const focusKey = `${wd}|${active}|${curId ?? ''}|${exs.map(e => e.id).join(',')}`;

  useLayoutEffect(() => {
    const car = carRef.current;
    if (!car) return;
    const idx = exs.length ? Math.max(0, openIdx) : 0;
    jumpToSlide(car, idx);
    const dotsWrap = dotsRef.current;
    function upd() {
      if (!dotsWrap) return;
      const dots = [...dotsWrap.children];
      let best = 0, bestDist = Infinity;
      [...car.children].forEach((s, i) => {
        const dist = slideCenterDist(car, s);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      dots.forEach((d, j) => d.classList.toggle('on', j === best));
    }
    car.addEventListener('scroll', upd, { passive: true });
    upd();
    return () => car.removeEventListener('scroll', upd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  if (!exs.length) return null;

  return (
    <>
      <div id="ex-carousel" className="carousel" ref={carRef}>
        {meta.map(m => (
          <ExerciseSlide key={m.ex.id} m={m} wd={wd} started={started} />
        ))}
      </div>
      {exs.length > 1 && (
        <div className="carousel-dots" id="ex-dots" ref={dotsRef}>
          {exs.map(ex => <i key={ex.id}></i>)}
        </div>
      )}
    </>
  );
}

function ExerciseSlide({ m, wd, started }) {
  const { ex, done, full, open, isNext, waiting } = m;
  const v = ensureVals(ex);
  const last = lastDataFor(ex);
  const scheme = rirScheme(ex.sets, ex.name);
  const curSet = Math.min(done.length, ex.sets - 1);
  const curRir = scheme[curSet];
  const info = exInfo(ex.name);

  const wRef = useRef(null), rRef = useRef(null), altRef = useRef(null), pwRef = useRef(null);

  // FIX ROUND 1 (code review): syncInputs() used to run unconditionally from
  // onWChange/onRChange too — i.e. on every keystroke, not just on blur like
  // the original's native `change` listener. That reintroduced exactly the
  // bug the header comment above says refs were meant to avoid: clearing the
  // field to retype snapped back to the old value (parseFloat('') is NaN, so
  // v.w was never updated, but the input's OWN value was still forced back
  // to wDisplay(v.w)), and typing a decimal like "62.5" lost the "." the
  // instant it was typed (parseFloat('62.') is 62, so v.w became 62 and the
  // input got overwritten with "62"). The fix: only the input the user is
  // NOT actively typing into gets its .value force-set. syncDependents()
  // patches the alt-unit span and the progression banner (neither is the
  // field being typed in), and is what onWChange/onRChange call. syncInputs()
  // (which also rewrites wRef/rRef.value) is reserved for the stepper
  // buttons, which — like updExDisplays() in the original — push a value the
  // user did NOT type character-by-character, so overwriting the field is
  // exactly what should happen there.
  function syncDependents() {
    if (altRef.current) altRef.current.textContent = wAlt(v.w);
    if (pwRef.current) {
      const warn = progressionWarn(ex.name, v.w);
      pwRef.current.style.display = warn ? '' : 'none';
      pwRef.current.textContent = warn ? `⚠ ${warn}` : '';
    }
  }
  function syncInputs() {
    if (wRef.current) wRef.current.value = wDisplay(v.w);
    if (rRef.current) rRef.current.value = v.r;
    syncDependents();
  }
  function stepW(d) { v.w = Math.max(0, round1(v.w + d * wStep())); syncInputs(); }
  function stepR(d) { v.r = Math.max(1, v.r + d); syncInputs(); }
  function onWChange(e) {
    const num = parseFloat(e.target.value);
    if (!isNaN(num) && num >= 0) v.w = S.cfg.unit === 'kg' ? num : lb2kg(num);
    syncDependents();
  }
  function onRChange(e) {
    const num = parseInt(e.target.value, 10);
    if (!isNaN(num) && num > 0) v.r = num;
    // Reps no tiene ninguna UI dependiente (el banner de progresión sólo
    // depende del peso) — nada más que refrescar acá, y sobre todo: no tocar
    // rRef.current.value mientras el usuario está tecleando en ese mismo input.
  }

  const pwarnInitial = open ? progressionWarn(ex.name, v.w) : null;
  const cls = [full ? 'full doneex' : '', open ? 'cur' : '', waiting ? 'wait' : ''].filter(Boolean).join(' ');

  return (
    <div className="carousel-slide" data-exid={ex.id}>
      <div className={`card ex-card ${cls}`} id={`exc-${ex.id}`} style={{ '--done': Math.min(1, done.length / ex.sets) }}>
        <div className={`ex-done-count ${full ? 'full' : ''}`}>{done.length}/{ex.sets}</div>
        <div className="exname">
          {ex.name}{' '}
          {info && (
            <button
              type="button"
              className="mini info inline"
              onClick={() => openSheet('ex-info', { name: ex.name, wd, exId: ex.id })}
            >
              ⓘ
            </button>
          )}
        </div>
        <div className="extarget">
          Objetivo {ex.sets} × {ex.reps}
          {open && (
            <> · serie {done.length + 1} → {curRir === 0 ? <b className="txt-blue">al fallo</b> : `RIR ${curRir}`}</>
          )}
        </div>
        {last && (
          <div className="exlast">Última vez: {last.map(s => `${fmtNum(round1(s.w))}×${s.r}`).join(' · ')} kg</div>
        )}
        {full && <div className="ex-state ok">✓ Completo · {done.length} de {ex.sets} series</div>}
        {waiting && <div className="ex-state">En espera · {done.length ? `${done.length}/${ex.sets} series` : 'te toca después'}</div>}
        {isNext && (
          <>
            <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => startExercise(ex)}>
              ▶ Iniciar ejercicio
            </button>
            <div className="txt-mut" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              Dale cuando estés en la máquina{!started ? ' — acá arranca el cronómetro' : ''}
            </div>
          </>
        )}
        {open && (
          <>
            <div className="prog-warn" ref={pwRef} style={{ display: pwarnInitial ? '' : 'none' }}>
              {pwarnInitial ? `⚠ ${pwarnInitial}` : ''}
            </div>
            <div className="setgrid">
              <div>
                <div className="steplabel">Peso ({S.cfg.unit === 'kg' ? 'kg' : 'lb'})</div>
                <div className="step">
                  <button type="button" onClick={() => stepW(-1)}>−</button>
                  <div className="val">
                    <input ref={wRef} type="number" inputMode="decimal" step="any" defaultValue={wDisplay(v.w)} onChange={onWChange} />
                    <span className="alt" ref={altRef}>{wAlt(v.w)}</span>
                  </div>
                  <button type="button" onClick={() => stepW(1)}>+</button>
                </div>
              </div>
              <div>
                <div className="steplabel">Reps</div>
                <div className="step">
                  <button type="button" onClick={() => stepR(-1)}>−</button>
                  <div className="val"><input ref={rRef} type="number" inputMode="numeric" defaultValue={v.r} onChange={onRChange} /></div>
                  <button type="button" onClick={() => stepR(1)}>+</button>
                </div>
              </div>
            </div>
            <button type="button" className="btn" onClick={() => saveSet(ex.id)}>
              ✓ Terminé la serie {done.length + 1} de {ex.sets}
            </button>
          </>
        )}
        {done.length > 0 && (
          <div className="chips setchips">
            {done.map((s, i) => (
              <span key={i} className="chip blue" onClick={() => deleteSet(ex.id, i)}>
                {fmtNum(round1(s.w))}kg × {s.r}<span className="x">✕</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
