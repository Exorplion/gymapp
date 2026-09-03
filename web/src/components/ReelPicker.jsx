// Selector de rueda por gestos para peso/reps (paso 4 de la revisión UX,
// inspirado en el selector de números de "LIFTOFF" — ver
// docs/referencias-sueltas/ — pero con el lenguaje visual de FIERRO, no un
// clon literal). Reemplaza los steppers +/- de toque repetido: acá deslizás
// y el valor cae solo, con scroll-snap nativo (mismo mecanismo que
// .carousel), sin spring en JS.
import { useEffect, useRef } from 'react';
import { reelValues, reelCenter, reelNearestIndex } from '../lib/reel.js';

export default function ReelPicker({ value, step, min = 0, fmt, onChange, label }) {
  const scrollerRef = useRef(null);
  const timerRef = useRef(null);
  // Se regenera sólo cuando cambia el step o el "centro lógico" se corrió
  // fuera de la ventana ya renderizada — si se regenerara en cada valor,
  // cada tick recentraría la lista entera y el gesto se sentiría trabado.
  const valuesRef = useRef(reelValues(value, step, min));
  const values = valuesRef.current;
  if (!values.includes(Math.round(value / step) * step)) {
    valuesRef.current = reelValues(value, step, min);
  }

  useEffect(() => {
    const idx = valuesRef.current.indexOf(Math.round(value / step) * step);
    if (idx >= 0) reelCenter(scrollerRef.current, idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (v !== value) onChange(v);
    }, 120);
  }

  return (
    <div className="reel" aria-label={label}>
      <div className="reel-indicator" aria-hidden="true" />
      <div className="reel-track" ref={scrollerRef} onScroll={onScroll}>
        {values.map((v, i) => (
          <div key={i} className={`reel-tooth${v === Math.round(value / step) * step ? ' on' : ''}`}>
            {fmt ? fmt(v) : v}
          </div>
        ))}
      </div>
    </div>
  );
}
