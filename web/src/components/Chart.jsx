// Wrapper de <canvas class="chart"> alrededor del motor puro de charts.js.
// El original dibuja con un solo drawChart(cv,pts,opts) llamado a mano cada
// vez que renderProg() reconstruye el DOM (o sea: en cada bump), y selecciona
// un punto con un addEventListener('click', …) delegado GLOBAL sobre
// canvas.chart (uno solo para todos los canvases de la página, filtrando por
// closest('canvas.chart')). Acá, al ser un componente por canvas, ese
// delegado global se vuelve un onClick propio de esta instancia — mismo
// cuerpo (pickChartPoint + redraw), sin necesidad de closest() porque ya
// estamos parados en el <canvas> correcto.
//
// El redraw corre en un useEffect keyeado en [pts, opts] (cambia de rango,
// de pestaña Carga/1RM, de ejercicio elegido, llega un registro nuevo…) y
// además en un ResizeObserver sobre el propio <canvas>: drawChart lee
// cv.clientWidth/clientHeight para fijar la resolución del canvas, así que
// si el contenedor cambia de tamaño (abrir/cerrar un sheet desplaza layout,
// rotar el teléfono) sin que pts/opts cambien, hay que redibujar igual o el
// canvas queda con el tamaño viejo. El original nunca tuvo este problema
// porque cada bump volvía a llamar drawChart() de cero con el clientWidth
// del momento — acá se reproduce ese mismo efecto neto sin depender de que
// haya un bump por medio.
import { useEffect, useRef } from 'react';
import { drawChart, pickChartPoint } from '../lib/charts.js';

export default function Chart({ pts, opts, id }) {
  const cvRef = useRef(null);
  const latest = useRef({ pts, opts });
  latest.current = { pts, opts };

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    cv._opts = opts;
    drawChart(cv, pts, opts);
  }, [pts, opts]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const { pts: p, opts: o } = latest.current;
      drawChart(cv, p, o);
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  function onClick(e) {
    const cv = cvRef.current;
    if (!cv || !cv._pts) return;
    pickChartPoint(cv, e.clientX);
    drawChart(cv, cv._pts, cv._opts || {});
  }

  return <canvas className="chart" id={id} ref={cvRef} onClick={onClick} />;
}
