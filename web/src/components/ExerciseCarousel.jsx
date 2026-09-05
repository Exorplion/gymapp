// Puerto del carrusel de ejercicios de renderHoy() (index.html: el bloque
// `#ex-carousel`/`.carousel-slide` + initCarousel()/scrollCarouselTo()).
// Componente propio (no inlineado en Hoy.jsx) porque tiene lógica real de
// posicionamiento de scroll que vale la pena aislar — ver lib/carousel.js
// para por qué esa matemática vive en su propio módulo sin dependencias
// (para no crear un ciclo session.js <-> ExerciseCarousel.jsx).
//
// Peso/reps viven enteros dentro de ReelPicker.jsx (rueda gruesa + rueda
// fina vertical de enteros vecinos, mantener presionado + edición manual
// tocando el número — ver el comentario de cabecera de ese archivo). Antes
// había un <input> de respaldo debajo de cada rueda; Enzo pidió sacarlo
// (menos clutter, y el número editable tiene que vivir en la rueda, no
// aparte) — lo único que sigue mostrándose acá afuera es la conversión de
// unidad (`alt`, kg↔lb) y el aviso de progresión, ninguno de los dos
// editable, así que el patrón de refs no controlados (`altRef`/`pwRef`) se
// mantiene sólo para esos dos.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { S, wDisplay, wAlt, wStep, wToUnit, wFromUnit, openSheet } from '../lib/state.js';
import { round1, fmtNum } from '../lib/format.js';
import { exInfo, rirScheme, progressionWarn } from '../lib/exdb.js';
import { suggestedWeight } from '../lib/charts.js';
import {
  ensureVals, lastDataFor, setsDone, saveSet, deleteSet, startExercise,
  targetSets, isSkipped, skipExercise, unskipExercise, addExtraSet, dropSet, reemplazaA,
  isUnilateral, toggleUnilateral, setSide,
} from '../lib/session.js';
import { sideImbalance } from '../lib/symmetry.js';
import { jumpToSlide, scrollToSlideEl, slideCenterDist } from '../lib/carousel.js';
import { staggerReveal, squashStretch, impactBurst } from '../lib/motion.js';
import { relatedHistory, equipLabel } from '../lib/equip.js';
import { iconOf } from '../lib/exicon.js';
import ExIcon from './ExIcon.jsx';
import ReelPicker from './ReelPicker.jsx';
import { Info, Skip, Swap } from './Icon.jsx';

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

  // El PRIMER posicionamiento de este montaje tiene que ser instantáneo
  // (jumpToSlide) — recién se abre Hoy, animar desde scrollLeft=0 se vería
  // como el carrusel "viajando" apenas se pinta la pantalla. Los
  // reposicionamientos SIGUIENTES (cambiaste de día, arrancó la sesión,
  // avanzó el ejercicio en curso) sí deslizan: antes saltaban de golpe, el
  // único movimiento suave era el que hacías vos con el dedo.
  const yaHuboSalto = useRef(false);

  useLayoutEffect(() => {
    const car = carRef.current;
    if (!car) return;
    const idx = exs.length ? Math.max(0, openIdx) : 0;
    if (!yaHuboSalto.current) {
      jumpToSlide(car, idx);
      yaHuboSalto.current = true;
      // Reveal escalonado sólo la primera vez que se pinta el carrusel de
      // este día — no en cada bump (avanzar de ejercicio no debe volver a
      // animar las tarjetas ya visibles).
      staggerReveal(car.children);
    } else if (idx > 0) {
      // jumpToSlide ignora idx<=0 a propósito (no hace falta reposicionar
      // hacia el primer slide) — se preserva el mismo criterio acá.
      scrollToSlideEl(car, car.children[idx], 'smooth');
    }
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
      <button type="button" onClick={() => openSheet('ex-swap', { wd, exId: ex.id })}><Swap /> Cambiar</button>
      <button type="button" onClick={confirmarSalto}><Skip /> Saltar</button>
    </div>
  );
}

/** RPE opcional 1-10 por serie (Plan Fierro · Fase 2): el dato que destraba
    ACWR, la recuperación muscular por esfuerzo y el ajuste de calorías por
    bandas. Se guarda en v.rpe (leído por saveSet() al confirmar la serie) y
    se resetea solo después de cada serie — nunca se arrastra a la
    siguiente para no dar un dato viejo por accidente. Optativo de verdad:
    no bloquea "Terminé la serie" si no se toca. */
function RpeSelector({ v }) {
  const [rpe, setRpe] = useState(v.rpe);
  return (
    <div className="mt-2.5">
      <div className="steplabel">RPE (esfuerzo) · opcional</div>
      <div className="flex gap-1 mt-1" role="group" aria-label="Esfuerzo percibido, 1 a 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
          const on = rpe === n;
          return (
            <motion.button
              key={n}
              type="button"
              aria-pressed={on}
              className={`chip ${on ? 'on' : ''}`}
              style={{ minWidth: 26, padding: '4px 0', textAlign: 'center', flex: 1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.12 }}
              onClick={() => { const next = on ? null : n; v.rpe = next; setRpe(next); }}
            >
              {n}
            </motion.button>
          );
        })}
      </div>
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
  // Aviso raro, no diario (mismo criterio que lowMicros): sólo si el
  // desbalance izq/der es un patrón sostenido en varias sesiones.
  const imbalance = uni ? sideImbalance(ex) : null;

  const altRef = useRef(null), pwRef = useRef(null);

  // altRef/pwRef siguen sin controlar (refs, no state) por la misma razón de
  // siempre: son texto derivado que cambia con cada serie/peso y no vale la
  // pena un bump() de toda la app por eso. Ya no hay ningún input que
  // sincronizar acá — peso/reps viven enteros dentro de ReelPicker.jsx.
  function syncDependents() {
    if (altRef.current) altRef.current.textContent = wAlt(v.w);
    if (pwRef.current) {
      const warn = progressionWarn(ex.name, v.w);
      pwRef.current.style.display = warn ? '' : 'none';
      pwRef.current.textContent = warn ? `⚠ ${warn}` : '';
    }
  }
  // La rueda (gesto, rueda fina o edición manual — ver ReelPicker.jsx)
  // entrega siempre un valor absoluto en kg.
  function setW(newW) { v.w = Math.max(0, round1(newW)); syncDependents(); }
  function setR(newR) { v.r = Math.max(1, Math.round(newR)); }

  const pwarnInitial = open ? progressionWarn(ex.name, v.w) : null;
  const cls = [full ? 'full doneex' : '', open ? 'cur' : '', waiting ? 'wait' : '', skipped ? 'skipped' : ''].filter(Boolean).join(' ');

  return (
    <div className="carousel-slide" data-exid={ex.id}>
      <div className={`card ex-card ${cls}`} id={`exc-${ex.id}`} style={{ '--done': Math.min(1, done.length / target) }}>
        {/* key=done.length: fuerza a React a remontar el nodo cada vez que el
            número cambia, así el "pop" de styles.css se repite en cada serie
            (el mismo truco que ya usa App.jsx con key={store.tab} para la
            animación de deslizamiento — sin un key nuevo, React reusa el
            nodo y el @keyframes nunca vuelve a correr). Antes esta cuenta
            saltaba de "1/3" a "2/3" sin ningún acuse de recibo propio: el
            chip nuevo hacía pop, el riel lateral se llenaba, pero el número
            que en verdad resume el progreso quedaba mudo. */}
        <div key={done.length} className={`ex-done-count ${full ? 'full' : ''}`}>{done.length}/{target}</div>
        <ExIcon icono={iconOf(ex)} size={38} className="ex-card-icon" />
        <div className="exname">
          {ex.name}{' '}
          {info && (
            <button
              type="button"
              className="mini info inline"
              onClick={() => openSheet('ex-info', { name: ex.name, wd, exId: ex.id })}
            >
              <Info />
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
        {(() => {
          const base = suggestedWeight(ex.name);
          if (!base || !open) return null;
          // El ajuste del chequeo de 3 preguntas (Plan Fierro · Fase 3) se
          // aplica acá — S.draft.precheckAdjust queda en 0 si no se
          // contestó nada, así que no cambia nada para quien no lo usa.
          const adj = S.draft?.precheckAdjust || 0;
          const sug = round1(base * (1 + adj));
          return (
            <div className="text-mut text-[12px] mt-1">
              Sugerido hoy: ~{fmtNum(sug)} kg (80% de tu 1RM estimado{adj !== 0 ? `, ${adj > 0 ? '+' : ''}${Math.round(adj * 100)}% por tu chequeo` : ''})
            </div>
          );
        })()}
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
            <div className="ex-state skip"><Skip size={13} /> Saltado{done.length ? ` · ${done.length} serie${done.length === 1 ? '' : 's'} registrada${done.length === 1 ? '' : 's'}` : ''}</div>
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
            {uni && (
              <div className="setrows" style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  className={`chip ${v.side === 'left' ? 'on' : ''}`}
                  aria-pressed={v.side === 'left'}
                  onClick={() => setSide(ex.id, 'left')}
                >
                  Izquierda
                </button>
                <button
                  type="button"
                  className={`chip ${v.side === 'right' ? 'on' : ''}`}
                  aria-pressed={v.side === 'right'}
                  onClick={() => setSide(ex.id, 'right')}
                >
                  Derecha
                </button>
              </div>
            )}
            {imbalance && (
              <div className="prog-warn" style={{ marginBottom: 8 }}>
                ⚠ {imbalance.strongerSide === 'left' ? 'Izquierda' : 'Derecha'} viene
                {' '}~{imbalance.pct}% más fuerte que el otro lado, sostenido en las
                últimas sesiones.
              </div>
            )}
            <div className="setrows">
              <div>
                <div className="steplabel">Peso ({S.cfg.unit === 'kg' ? 'kg' : 'lb'}){uni ? ' por lado' : ''}</div>
                <ReelPicker
                  key={`w-${done.length}`}
                  value={v.w}
                  step={wStep()}
                  fmt={n => wDisplay(n)}
                  toUnit={wToUnit}
                  fromUnit={wFromUnit}
                  onChange={setW}
                  label="Peso"
                />
                <div className="reel-alt" ref={altRef}>{wAlt(v.w)}</div>
              </div>
              <div>
                <div className="steplabel">Reps</div>
                <ReelPicker
                  key={`r-${done.length}`}
                  value={v.r}
                  step={1}
                  min={1}
                  onChange={setR}
                  label="Reps"
                />
              </div>
            </div>
            {/* key=done.length: saveSet() resetea v.rpe a null después de
                cada serie, y el estado local de RpeSelector no puede
                enterarse de una mutación sobre `v`. Remontarlo por serie
                lo deja siempre en blanco para la que viene — mismo truco
                que ya usa .ex-done-count más arriba. */}
            <RpeSelector key={done.length} v={v} />
            <button
              type="button"
              className="btn"
              onClick={e => {
                // "Juice" de videojuego: squash & stretch en el botón + una
                // ráfaga de partículas en el punto de toque, sobre la acción
                // más repetida de toda la app — el equivalente a un "hit"
                // en un juego. saveSet() se llama después de disparar el
                // feedback: la animación es puramente visual y no bloquea
                // ni depende del resultado.
                squashStretch(e.currentTarget);
                impactBurst(e.clientX, e.clientY, { color: 'var(--ok)' });
                saveSet(ex.id);
              }}
            >
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
