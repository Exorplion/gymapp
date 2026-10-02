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
//
// El tamaño lo dice SÓLO el ResizeObserver (G4, auditoría 2026-09): corre
// con el layout ya hecho, así que leer clientWidth ahí es gratis. Antes el
// primer dibujo iba en el useEffect del montaje y drawChart leía clientWidth
// con Progreso recién insertado: un layout forzado de la página entera
// (~200 ms a 6×) en medio del cambio de pestaña. Ahora el montaje no dibuja:
// el ResizeObserver avisa antes del primer paint (la observación inicial) y
// dibuja ahí, así que el gráfico sale en el mismo cuadro. Los redibujos
// después (otro rango, otro ejercicio, el acento, tocar un punto) usan el
// tamaño que dejó guardado.
import { useEffect, useRef } from 'react';
import { drawChart, pickChartPoint } from '../lib/charts.js';
import { bloomOpen } from '../lib/motion.js';
import { cn } from '../lib/utils.js';
import { EVENTO_ACENTO } from '../lib/theme.js';

/* Cuántas veces cambió el acento desde que cargó la app. Un gráfico oculto
   (<Activity>) no escucha el evento —su efecto está desmontado—, así que al
   reaparecer compara este número con el de su último dibujo. */
let vecesAcento = 0;
if (typeof window !== 'undefined') window.addEventListener(EVENTO_ACENTO, () => { vecesAcento++; });

export default function Chart({ pts, opts, id }) {
  const cvRef = useRef(null);
  const latest = useRef({ pts, opts });
  const mounted = useRef(false);
  const tam = useRef(null);   // { w, h } en CSS px, del ResizeObserver
  latest.current = { pts, opts };

  // Bloom sutil sólo la primera vez que el canvas recibe datos reales — no en
  // cada redraw por tecla/resize, para no "parpadear" el gráfico en cada bump.
  useEffect(() => {
    if (mounted.current || !pts?.length) return;
    mounted.current = true;
    bloomOpen(cvRef.current);
  }, [pts]);

  /* Redibujar cuando cambian los DATOS, no la identidad de los arrays: quien
     llama arma `pts` y `opts={{ unit }}` de nuevo en cada render, y cada
     bump() de la app redibujaba los dos canvas de Progreso aunque nada
     hubiera cambiado (auditoría 2026-10). */
  const firma = (pts || []).map(p => `${p.date}:${p.y}:${p.r ?? ''}`).join('|') + '#' + (opts?.unit ?? '');
  const firmaRef = useRef(firma);
  firmaRef.current = firma;
  const marca = () => `${firmaRef.current}#${vecesAcento}`;
  const dibujado = useRef(null);   // la firma que tiene pintada el canvas
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const { pts: p, opts: o } = latest.current;
    cv._opts = o;
    // Sin tamaño todavía (recién montado) dibuja el ResizeObserver. Sin
    // ResizeObserver (navegador viejo) se dibuja acá, midiendo.
    if (tam.current || typeof ResizeObserver === 'undefined') { drawChart(cv, p, o, tam.current); dibujado.current = marca(); }
  }, [firma]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = cv.clientWidth, h = cv.clientHeight;
      /* Progreso queda montada entre visitas (<Activity>, App.jsx) y al
         reaparecer el observer avisa de nuevo aunque nada cambió. El canvas
         conserva su dibujo mientras está oculto: si el tamaño y los datos
         son los mismos, no hay nada que redibujar (eran dos gráficos enteros
         en cada vuelta a la pestaña). */
      if (tam.current && tam.current.w === w && tam.current.h === h && dibujado.current === marca()) return;
      tam.current = { w, h };
      const { pts: p, opts: o } = latest.current;
      cv._opts = o;
      drawChart(cv, p, o, tam.current);
      dibujado.current = marca();
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  // El canvas no sigue a var(): cuando cambia el acento en Ajustes, hay que
  // volver a dibujar con los colores nuevos.
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const redibujar = () => { drawChart(cv, latest.current.pts, latest.current.opts, tam.current); dibujado.current = marca(); };
    window.addEventListener(EVENTO_ACENTO, redibujar);
    return () => window.removeEventListener(EVENTO_ACENTO, redibujar);
  }, []);

  function onClick(e) {
    const cv = cvRef.current;
    if (!cv || !cv._pts) return;
    pickChartPoint(cv, e.clientX);
    drawChart(cv, cv._pts, cv._opts || {}, tam.current);
  }

  return <canvas className={cn('chart', 'rounded-r')} id={id} ref={cvRef} onClick={onClick} />;
}
