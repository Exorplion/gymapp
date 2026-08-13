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
import {
  ensureVals, lastDataFor, setsDone, saveSet, deleteSet, startExercise,
  targetSets, isSkipped, skipExercise, unskipExercise, addExtraSet, dropSet, reemplazaA,
  isUnilateral, toggleUnilateral,
} from '../lib/session.js';
import { jumpToSlide, slideCenterDist } from '../lib/carousel.js';
import { relatedHistory, equipLabel } from '../lib/equip.js';
import { iconOf } from '../lib/exicon.js';
import ExIcon from './ExIcon.jsx';

export default function ExerciseCarousel({ exs, wd, active, started, curId, nextEx }) {
  const carRef = useRef(null);
  const dotsRef = useRef(null);

  const meta = useMemo(() => {
    const m = exs.map(ex => {
      const done = setsDone(ex.id);
      const target = targetSets(ex);
      const skipped = active && isSkipped(ex.id);
      const full = !skipped && done.length >= target;
      const open = active && curId === ex.id && !full && !skipped;
      return { ex, done, target, skipped, full, open };
    });
    m.forEach(item => {
      item.isNext = active && !item.open && !item.skipped && !curId && nextEx && nextEx.id === item.ex.id;
      item.waiting = active && !item.open && !item.isNext && !item.full && !item.skipped;
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
      <div id="ex-carousel" className={`carousel${active ? ' focus' : ''}`} ref={carRef}>
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

/** Las tres salidas que el gimnasio real necesita y la app no daba: una serie
    de más, cambiar de ejercicio porque la máquina está ocupada, y saltarlo
    porque no te da el tiempo. Botones explícitos y no un menú escondido: se
    tocan jadeando y con las manos húmedas. */
function ExActions({ ex, wd }) {
  function confirmarSalto() {
    openSheet('confirm', {
      title: `¿Saltar ${ex.name}?`,
      body: 'Queda marcado como saltado y pasás al siguiente. Podés restablecerlo en cualquier momento y vuelve a su lugar.',
      confirmLabel: 'Saltar',
      onConfirm: () => skipExercise(ex.id),
    });
  }
  return (
    <div className="ex-actions">
      {/* Sumar y quitar juntos: decidir "hoy hago una menos" es tan común como
          "hoy hago una más", y hasta ahora sólo se podía hacia arriba. */}
      <button type="button" onClick={() => dropSet(ex.id)}>− Serie</button>
      <button type="button" onClick={() => addExtraSet(ex.id)}>+ Serie</button>
      <button type="button" onClick={() => openSheet('ex-swap', { wd, exId: ex.id })}>⇄ Cambiar</button>
      <button type="button" onClick={confirmarSalto}>↷ Saltar</button>
    </div>
  );
}

function ExerciseSlide({ m, wd, started }) {
  const { ex, done, target, skipped, full, open, isNext, waiting } = m;
  const v = ensureVals(ex);
  const last = lastDataFor(ex);
  // el esquema se arma sobre el objetivo de HOY: con una serie extra concedida
  // hay que darle un RIR también a esa
  const scheme = rirScheme(target, ex.name);
  const curSet = Math.min(done.length, target - 1);
  const curRir = scheme[curSet];
  const info = exInfo(ex.name);
  // Sin historial propio: primera vez en ESTE equipo. Mostramos de dónde venís
  // en las otras variantes, sin traducir el número (ver relatedHistory).
  const related = last ? [] : relatedHistory(ex, S.sessions);
  // "Un lado por vez": lo que dice la rutina, salvo que la máquina de HOY te
  // haya obligado a cambiarlo (ver isUnilateral en session.js).
  const uni = isUnilateral(ex);

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
  const cls = [full ? 'full doneex' : '', open ? 'cur' : '', waiting ? 'wait' : '', skipped ? 'skipped' : ''].filter(Boolean).join(' ');

  return (
    <div className="carousel-slide" data-exid={ex.id}>
      <div className={`card ex-card ${cls}`} id={`exc-${ex.id}`} style={{ '--done': Math.min(1, done.length / target) }}>
        <div className={`ex-done-count ${full ? 'full' : ''}`}>{done.length}/{target}</div>
        <ExIcon icono={iconOf(ex)} size={38} className="ex-card-icon" />
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
        {/* Cambiaste éste por otro: el original ya no está en la lista, pero
            queda dicho de dónde salió. */}
        {reemplazaA(ex.id) && (
          <div className="ex-envez">en vez de {reemplazaA(ex.id)}</div>
        )}
        <div className="extarget">
          Objetivo {target} × {ex.reps}
          {target > ex.sets && <span className="txt-blue"> (+{target - ex.sets} hoy)</span>}
          {open && (
            <> · serie {done.length + 1} → {curRir === 0 ? <b className="txt-blue">al fallo</b> : `RIR ${curRir}`}</>
          )}
        </div>
        {last && (
          <div className="exlast">
            Última vez: {last.map(s => `${fmtNum(round1(s.w))}×${s.r}`).join(' · ')} kg
            {uni && ' por lado'}
          </div>
        )}
        {!last && equipLabel(ex) && (
          <div className="ex-first">
            <div className="t">Primera vez en {equipLabel(ex)}</div>
            {related.length > 0 && (
              <div className="s">
                Este ejercicio lo venís haciendo en {related.map(r => `${r.label} (${fmtNum(round1(r.w))}×${r.r})`).join(' · ')}.
              </div>
            )}
            <div className="s">
              Ese número no se traslada: cada sistema mueve una carga distinta. Arrancá
              claramente liviano y subí hasta que las {ex.reps} reps te queden con 2 en
              reserva. Lo que anotes hoy queda como tu punto de partida acá.
            </div>
          </div>
        )}
        {full && <div className="ex-state ok">✓ Completo · {done.length} de {target} series</div>}
        {waiting && <div className="ex-state">En espera · {done.length ? `${done.length}/${target} series` : 'te toca después'}</div>}
        {/* Saltado: la tarjeta se queda donde está, apagada. Restablecer la
            devuelve exactamente a su lugar porque saltar no toca draft.order. */}
        {skipped && (
          <>
            <div className="ex-state skip">↷ Saltado{done.length ? ` · ${done.length} serie${done.length === 1 ? '' : 's'} registrada${done.length === 1 ? '' : 's'}` : ''}</div>
            <button type="button" className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => unskipExercise(ex.id)}>
              ↺ Restablecer
            </button>
          </>
        )}
        {full && (
          <button type="button" className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => addExtraSet(ex.id)}>
            + Una serie más
          </button>
        )}
        {isNext && (
          <>
            <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => startExercise(ex)}>
              ▶ Iniciar ejercicio
            </button>
            <div className="txt-mut" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              Dale cuando estés en la máquina{!started ? ' — acá arranca el cronómetro' : ''}
            </div>
            <ExActions ex={ex} wd={wd} />
          </>
        )}
        {open && (
          <>
            <div className="prog-warn" ref={pwRef} style={{ display: pwarnInitial ? '' : 'none' }}>
              {pwarnInitial ? `⚠ ${pwarnInitial}` : ''}
            </div>
            {/* Un lado por vez: lo que dice la rutina, con un botón para
                anularlo sólo hoy — la máquina que te tocó puede obligarte a
                hacerlo distinto de cómo lo planeaste. */}
            <button
              type="button"
              className={`chip ${uni ? 'on' : ''}`}
              style={{ marginBottom: 8 }}
              aria-pressed={uni}
              onClick={() => toggleUnilateral(ex.id)}
            >
              {uni ? '✓ Un lado por vez' : 'Un lado por vez'}
            </button>
            <div className="setrows">
              <div>
                <div className="steplabel">Peso ({S.cfg.unit === 'kg' ? 'kg' : 'lb'}){uni ? ' por lado' : ''}</div>
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
              ✓ Terminé la serie {done.length + 1} de {target}
            </button>
            <ExActions ex={ex} wd={wd} />
          </>
        )}
        {done.length > 0 && (
          <div className="chips setchips">
            {done.map((s, i) => (
              <button
                key={i}
                type="button"
                className="chip blue"
                aria-label={`Borrar serie: ${fmtNum(round1(s.w))} kg por ${s.r}`}
                onClick={() => deleteSet(ex.id, i)}
              >
                {fmtNum(round1(s.w))}kg × {s.r}<span className="x">✕</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
