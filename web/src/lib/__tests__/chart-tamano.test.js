import { describe, it, expect } from 'vitest';
import { drawChart } from '../charts.js';

globalThis.devicePixelRatio = 2;

/* G4 (auditoría total 2026-09): al entrar a Progreso, drawChart leía
   cv.clientWidth apenas montaba el gráfico, con la pantalla nueva recién
   insertada: un layout forzado de toda la página (~200 ms a 6×) en medio del
   cambio de pestaña. Chart.jsx ahora se entera del tamaño por el
   ResizeObserver —que corre con el layout ya hecho— y se lo pasa: con el
   tamaño en la mano, drawChart no toca la geometría del canvas. */
function lienzoQueNoSeMide() {
  // Un contexto 2D de mentira: cualquier método devuelve el mismo contexto
  // (createLinearGradient → algo con addColorStop, measureText → algo con width).
  const ctx = new Proxy({ width: 10 }, { get: (o, k) => (k in o ? o[k] : () => ctx), set: (o, k, v) => { o[k] = v; return true; } });
  const cv = { getContext: () => ctx };
  Object.defineProperty(cv, 'clientWidth', { get() { throw new Error('leyó clientWidth'); } });
  Object.defineProperty(cv, 'clientHeight', { get() { throw new Error('leyó clientHeight'); } });
  return cv;
}

describe('drawChart con el tamaño ya conocido', () => {
  it('no lee la geometría del canvas', () => {
    const cv = lienzoQueNoSeMide();
    const pts = [{ date: '2026-08-01', y: 70 }, { date: '2026-08-08', y: 71 }, { date: '2026-08-15', y: 70.5 }];
    expect(() => drawChart(cv, pts, { unit: 'kg' }, { w: 320, h: 200 })).not.toThrow();
    const dpr = globalThis.devicePixelRatio || 1;
    expect(cv.width).toBe(320 * dpr);
    expect(cv.height).toBe(200 * dpr);
  });

  it('sin puntos suficientes tampoco', () => {
    const cv = lienzoQueNoSeMide();
    expect(() => drawChart(cv, [], {}, { w: 300, h: 200 })).not.toThrow();
  });
});
