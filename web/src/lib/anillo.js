// Matemática del anillo del descanso, sin DOM ni estado: la usan RestTimer
// (hilo principal) y anillo.worker.js (el worker que lo dibuja). Ver el
// comentario de cabecera del worker para por qué el anillo no es una
// animación CSS/WAAPI.

/** La curva con la que el anillo "llega" (la misma que usaba animateRing). */
export const CIERRE = 'cubic-bezier(.4,0,.2,1)';

/** Los tramos (en progreso 0..1) que recorre el anillo.

    Si el anillo ya está donde tiene que estar, baja lineal hasta cero. Si
    no (arranca un descanso, tocaste +30 s), primero LLEGA en `llegada` ms
    con la curva de siempre al punto exacto donde la cuenta lineal va a
    estar en ese instante, y desde ahí sigue lineal: sin escalón entre los
    dos tramos. Mismo formato que los keyframes de WAAPI (offset + easing del
    tramo que empieza ahí), así el camino de respaldo los usa tal cual. */
export function tramosAnillo({ previo, desde, ms, llegada = 900 }) {
  const lineal = { offset: 1, p: 0, easing: 'linear' };
  if (Math.abs(previo - desde) < 1e-3) return [{ offset: 0, p: desde, easing: 'linear' }, lineal];
  if (ms <= llegada) return [{ offset: 0, p: previo, easing: CIERRE }, lineal];
  return [
    { offset: 0, p: previo, easing: CIERRE },
    { offset: llegada / ms, p: desde * (ms - llegada) / ms, easing: 'linear' },
    lineal,
  ];
}

/** Una curva de CSS ('linear' o 'cubic-bezier(a,b,c,d)') como función
    x → y en [0,1]. Newton con respaldo de bisección, como los navegadores. */
export function curva(nombre) {
  if (!nombre || nombre === 'linear') return x => x;
  const m = nombre.match(/cubic-bezier\(([^)]+)\)/);
  if (!m) return x => x;
  const [x1, y1, x2, y2] = m[1].split(',').map(Number);
  const b = (t, a, c) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * c + t * t * t;
  const db = (t, a, c) => 3 * (1 - t) * (1 - t) * a + 6 * (1 - t) * t * (c - a) + 3 * t * t * (1 - c);
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = db(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      const t2 = t - (b(t, x1, x2) - x) / d;
      if (t2 < 0 || t2 > 1) break;
      t = t2;
    }
    if (Math.abs(b(t, x1, x2) - x) > 1e-5) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 40; i++) { t = (lo + hi) / 2; if (b(t, x1, x2) < x) lo = t; else hi = t; }
    }
    return b(t, y1, y2);
  };
}

/** El progreso del anillo en la fracción `f` (0..1) del tramo completo. */
export function progresoEn(tramos, f) {
  if (f <= 0) return tramos[0].p;
  if (f >= 1) return tramos[tramos.length - 1].p;
  for (let i = 0; i < tramos.length - 1; i++) {
    const a = tramos[i], z = tramos[i + 1];
    if (f <= z.offset) {
      const u = z.offset > a.offset ? (f - a.offset) / (z.offset - a.offset) : 1;
      return a.p + (z.p - a.p) * curva(a.easing)(u);
    }
  }
  return tramos[tramos.length - 1].p;
}
