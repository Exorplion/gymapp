// Selector de rueda por gestos para peso/reps (paso 4 de la revisión UX,
// inspirado en el selector de números de "LIFTOFF" — ver
// docs/referencias-sueltas/ — pero con el lenguaje visual de FIERRO, no un
// clon literal). Reemplaza los steppers +/- de toque repetido: acá deslizás
// y el valor cae solo, con scroll-snap nativo (mismo mecanismo que
// .carousel), sin spring en JS.
//
// Segunda vuelta (a pedido de Enzo): la rueda horizontal sólo tiene dientes
// cada `step` (2.5kg, por ejemplo) — no hay forma de parar en 88 si los
// dientes son 87.5/90. Se agregan dos caminos, los dos DENTRO de la rueda
// (nunca en un número aparte debajo — eso fue lo primero que se probó y
// Enzo pidió sacarlo, menos clutter):
//  1. Mantener presionado (en cualquier parte de la rueda, sin arrastrar)
//     abre una rueda fina VERTICAL con los enteros vecinos al valor actual
//     — para el caso común (88 entre 87.5 y 90).
//  2. Tocar (sin mantener) el número centrado lo vuelve editable ahí mismo
//     — para el caso raro que ni la rueda fina resuelve (un decimal como
//     88.3). El teclado numérico del teléfono aparece recién ahí.
//
// `value`/`step`/`min`/`onChange` siguen en la unidad INTERNA (kg para
// peso, siempre — ver wStep()/state.js). `toUnit`/`fromUnit` (identidad por
// defecto, sólo peso los pasa distintos) convierten esa unidad interna a la
// que el usuario ve (kg o lb según S.cfg.unit) y de vuelta — la rueda fina y
// la edición manual trabajan en la unidad que el usuario VE y TIPEA, no en
// kg crudos, para no pedirle que piense en la conversión.
//
// El valor mostrado deja de depender de que el padre vuelva a renderizar
// con un `value` nuevo (ExerciseCarousel no hace bump() en cada cambio, por
// diseño — ver su comentario de cabecera): la rueda guarda su propio estado
// interno (`val`) y sólo AVISA hacia afuera con onChange(). Así, tanto el
// picker fino como la edición manual pueden recentrar la rueda horizontal
// ellos mismos sin depender de un ciclo de render del padre.
import { useEffect, useRef, useState } from 'react';
import { reelValues, reelCenter, reelNearestIndex } from '../lib/reel.js';

const HOLD_MS = 450;
const FINE_COUNT = 9; // ventana de enteros vecinos en la rueda fina (±4)

export default function ReelPicker({
  value, step, min = 0, fmt, onChange, label,
  toUnit = x => x, fromUnit = x => x,
}) {
  const [val, setVal] = useState(value);
  const [editing, setEditing] = useState(false);
  const [fineOpen, setFineOpen] = useState(false);

  const scrollerRef = useRef(null);
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const holdTimerRef = useRef(null);
  const movedRef = useRef(false);

  // Se regenera sólo cuando el valor actual se corrió fuera de la ventana ya
  // renderizada — si se regenerara en cada valor, cada tick recentraría la
  // lista entera y el gesto se sentiría trabado.
  const valuesRef = useRef(reelValues(val, step, min));
  const values = valuesRef.current;
  const onValue = Math.round(val / step) * step;
  if (!values.includes(onValue)) {
    valuesRef.current = reelValues(val, step, min);
  }

  function commit(v) {
    const clamped = Math.max(min, v);
    setVal(clamped);
    onChange(clamped);
  }

  // Recentra la rueda horizontal en el montaje y cada vez que `val` cambia
  // por un camino que NO fue el propio scroll de esta rueda (rueda fina o
  // edición manual) — el scroll nativo ya recentra por su cuenta en onScroll.
  useEffect(() => {
    const idx = valuesRef.current.indexOf(onValue);
    if (idx >= 0) reelCenter(scrollerRef.current, idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val]);

  function onScroll() {
    clearTimeout(timerRef.current);
    // Se lee el diente centrado 120ms después de que el scroll se queda
    // quieto — un throttle continuo sobre scroll dispararía onChange (y su
    // re-render) decenas de veces por gesto.
    timerRef.current = setTimeout(() => {
      const idx = reelNearestIndex(scrollerRef.current);
      if (idx < 0) return;
      const v = valuesRef.current[idx];
      reelCenter(scrollerRef.current, idx);
      // Comparar contra `onValue` (el múltiplo de step al que YA está
      // centrada la rueda gruesa) y no contra `val` (el valor real, que
      // puede no ser múltiplo de step si vino de la rueda fina o de
      // edición manual): el useEffect de [val] más abajo recentra esta
      // rueda al diente más cercano cada vez que `val` cambia por fuera de
      // un scroll suyo — y ESE recentrado (reelCenter() escribiendo
      // scrollLeft a mano) dispara su propio evento 'scroll', que entraba
      // por acá. Comparar contra `val` hacía que ese eco se leyera como "el
      // usuario arrastró hasta el diente redondeado" y pisaba el valor
      // exacto elegido en la rueda fina con el múltiplo de step más
      // cercano (Enzo: "si selecciono un numero la app lo redondea al mas
      // cercano" — 82 elegido en la rueda fina volvía a 82.5 solo). Contra
      // `onValue` el eco se ve igual a sí mismo (mismo diente ya centrado)
      // y no dispara nada; un arrastre real SÍ cambia a un diente distinto
      // del que ya estaba centrado, así que sigue commiteando bien.
      if (v !== onValue) commit(v);
    }, 120);
  }

  // Mantener presionado (sin arrastrar) en cualquier parte de la rueda abre
  // el picker fino. Si el dedo se mueve antes de los HOLD_MS, es un gesto de
  // scroll normal y se cancela — el scroll nativo sigue su curso solo.
  function onPressStart() {
    if (editing) return;
    movedRef.current = false;
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      if (!movedRef.current) setFineOpen(true);
    }, HOLD_MS);
  }
  function onPressMove() {
    movedRef.current = true;
    clearTimeout(holdTimerRef.current);
  }
  function onPressEnd() {
    clearTimeout(holdTimerRef.current);
  }

  // Tocar (tap corto, sin mantener) el número centrado lo vuelve editable,
  // en la unidad que el usuario ve (toUnit), no en kg crudos.
  function openEdit(e) {
    e.stopPropagation();
    setEditing(true);
  }
  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing]);
  function commitEdit() {
    const raw = inputRef.current?.value;
    const num = raw === '' ? NaN : parseFloat(raw);
    setEditing(false);
    if (!isNaN(num)) commit(fromUnit(num));
  }
  function onEditKeyDown(e) {
    if (e.key === 'Enter') inputRef.current?.blur();
    if (e.key === 'Escape') setEditing(false);
  }

  return (
    <div className="reel" aria-label={label}>
      <div className="reel-indicator" aria-hidden="true" />
      <div
        className="reel-track"
        ref={scrollerRef}
        onScroll={onScroll}
        onPointerDown={onPressStart}
        onPointerMove={onPressMove}
        onPointerUp={onPressEnd}
        onPointerCancel={onPressEnd}
      >
        {values.map((v, i) => {
          const on = v === onValue;
          if (on && editing) {
            return (
              <div key={i} className="reel-tooth on editing">
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  defaultValue={toUnit(val)}
                  onBlur={commitEdit}
                  onKeyDown={onEditKeyDown}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            );
          }
          // El diente centrado muestra `val` (el valor real elegido), NO
          // `v` (el múltiplo de `step` de ESE diente en particular): si
          // `val` vino de la rueda fina o de edición manual y no es un
          // múltiplo exacto de `step` (82 entre dientes de 80/82.5), no
          // existe ningún diente propio para 82 — el más cercano (82.5) se
          // usa sólo para SABER dónde centrar el scroll, nunca para decidir
          // qué número mostrar. Mostrar `v` ahí hacía que se viera "82.5"
          // después de elegir 82 a mano (aunque el valor real ya estuviera
          // guardado bien) — se leía como que el redondeo seguía sin
          // arreglar.
          return (
            <div
              key={i}
              className={`reel-tooth${on ? ' on' : ''}`}
              {...(on ? { role: 'button', tabIndex: 0, onClick: openEdit } : {})}
            >
              {on ? (fmt ? fmt(val) : val) : (fmt ? fmt(v) : v)}
            </div>
          );
        })}
      </div>
      {fineOpen && (
        <FineReel
          value={val}
          min={min}
          toUnit={toUnit}
          fromUnit={fromUnit}
          onChange={commit}
          onClose={() => setFineOpen(false)}
        />
      )}
    </div>
  );
}

/** Rueda fina vertical: enteros vecinos al valor actual —EN LA UNIDAD QUE EL
    USUARIO VE (toUnit), no en kg crudos, para el caso común de "quiero un
    número que la rueda gruesa no tiene entre sus dientes de `step`" (87.5/90
    → 88). Se cierra sola apenas el scroll asienta en un valor: quedaba
    abierta con el backdrop encima de la rueda gruesa, tapando exactamente el
    resultado que se acababa de elegir ("no se nota el resultado de mi
    elección" — Enzo). Un breve respiro (CLOSE_MS) antes de cerrar deja ver
    el dígito elegido resaltado un instante antes de volver a la rueda
    gruesa ya actualizada. */
const CLOSE_MS = 260;

function FineReel({ value, min, toUnit, fromUnit, onChange, onClose }) {
  const scrollerRef = useRef(null);
  const timerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const center = Math.round(toUnit(value));
  const dispMin = Math.ceil(toUnit(min));
  const valuesRef = useRef(reelValues(center, 1, dispMin, FINE_COUNT));
  const values = valuesRef.current;

  useEffect(() => {
    const idx = values.indexOf(center);
    if (idx >= 0) reelCenter(scrollerRef.current, idx, 'y');
    return () => { clearTimeout(timerRef.current); clearTimeout(closeTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onScroll() {
    clearTimeout(timerRef.current);
    clearTimeout(closeTimerRef.current);
    timerRef.current = setTimeout(() => {
      const idx = reelNearestIndex(scrollerRef.current, 'y');
      if (idx < 0) return;
      const v = values[idx];
      reelCenter(scrollerRef.current, idx, 'y');
      // El montaje mismo dispara un 'scroll' (reelCenter() del useEffect de
      // arriba escribe scrollTop para centrar el valor inicial) — sin este
      // guard, ESE scroll programático (no un gesto real) también agendaba
      // el cierre automático, así que la rueda se cerraba sola a los
      // ~380ms de abrirse SIN IMPORTAR si el usuario todavía la estaba
      // sosteniendo/elegiendo un número — se sentía como que "se bugueaba y
      // desaparecía, no dejaba elegir" (Enzo). Ahora sólo se agenda el
      // cierre cuando el asentamiento cambió el valor de verdad — mientras
      // el usuario no elija nada distinto del que ya estaba centrado, la
      // rueda se queda abierta esperando.
      if (v !== center) {
        onChange(fromUnit(v));
        closeTimerRef.current = setTimeout(onClose, CLOSE_MS);
      }
    }, 120);
  }

  return (
    <>
      <div className="reel-fine-backdrop" onClick={onClose} />
      <div className="reel-fine" role="dialog" aria-label="Elegir número exacto">
        <div className="reel-fine-indicator" aria-hidden="true" />
        <div className="reel-fine-track" ref={scrollerRef} onScroll={onScroll}>
          {values.map((v, i) => (
            <div key={i} className={`reel-tooth-v${v === center ? ' on' : ''}`}>{v}</div>
          ))}
        </div>
      </div>
    </>
  );
}
