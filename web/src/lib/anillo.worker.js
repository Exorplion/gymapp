// El anillo del descanso, dibujado fuera del hilo principal (G3, auditoría
// 2026-09).
//
// Por qué un worker y no una animación CSS/WAAPI: se probó primero UNA sola
// animación lineal de stroke-dashoffset (en vez de una nueva cada 250 ms) y
// medido a 6× el hilo principal seguía ocupado ~800 ms por segundo. No por
// la animación en sí: mientras haya una animación que no corre en el
// compositor, el navegador recorre en CADA frame el ciclo de estilo, pintado
// y armado de capas de TODA la página (Layerize solo: ~400 ms/s, con la
// sesión en vivo detrás). Con el anillo pintado acá, en un OffscreenCanvas,
// el hilo principal queda ~85 % libre: sólo trabaja una vez por segundo para
// cambiar el número.
//
// Geometría calcada del SVG de RestTimer.jsx (viewBox 200, r 88, trazo 10,
// punta redonda, girado −90° para arrancar arriba) y el mismo degradado
// (objectBoundingBox de (0,0) a (1,1) = de (−88,−88) a (88,88)).
import { progresoEn } from './anillo.js';

let lienzo = null, ctx = null;
let orden = null;      // { tramos, ms, inicio, colores }
let cuadroPedido = 0;
/* Lo último que se pintó. Un descanso de 2 min a 720 px de lienzo mueve la
   punta del arco ~0,3 px por cuadro: redibujar los 60 cuadros por segundo era
   pintar casi siempre lo mismo (medido a 6×: ~30 % de un núcleo durante todo
   el descanso, que es media sesión de gimnasio). Ahora un cuadro sólo pinta
   si la punta avanzó al menos un píxel real; los tramos rápidos (la llegada
   suave, el cierre al sonar) siguen pintándose en cada cuadro. */
let pintado = { p: -1, colores: null };
let degradado = { clave: '', g: null };

// performance.now() del worker y el de la página tienen orígenes distintos;
// timeOrigin + now() es un reloj común a los dos.
const ahora = () => performance.timeOrigin + performance.now();
const pedirCuadro = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame
  : cb => setTimeout(() => cb(), 16);
const soltarCuadro = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;

function dibujar(p, colores) {
  if (!ctx) return;
  const w = lienzo.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, lienzo.height);
  if (p <= 0) return;
  const k = w / 200;
  ctx.setTransform(k, 0, 0, k, w / 2, lienzo.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  if (colores.solido) ctx.strokeStyle = colores.solido;
  else {
    // El degradado vive en coordenadas del arco, que no cambian: se arma una
    // vez por par de colores, no en cada cuadro.
    const clave = `${colores.a}|${colores.b}`;
    if (degradado.clave !== clave) {
      const g = ctx.createLinearGradient(-88, -88, 88, 88);
      g.addColorStop(0, colores.a);
      g.addColorStop(1, colores.b);
      degradado = { clave, g };
    }
    ctx.strokeStyle = degradado.g;
  }
  ctx.beginPath();
  ctx.arc(0, 0, 88, 0, 2 * Math.PI * Math.min(1, p));
  ctx.stroke();
}

/** Cuánto del arco es un píxel del lienzo (la circunferencia, r 88 en el
    viewBox de 200, medida en píxeles reales). */
const unPixel = () => 1 / (2 * Math.PI * 88 * (lienzo ? lienzo.width / 200 : 1));

function pintar(p, colores) {
  dibujar(p, colores);
  pintado = { p, colores };
}

function cuadro() {
  cuadroPedido = 0;
  if (!orden) return;
  const f = (ahora() - orden.inicio) / orden.ms;
  const p = progresoEn(orden.tramos, f);
  const igual = pintado.colores === orden.colores && Math.abs(p - pintado.p) < unPixel();
  if (!igual || f >= 1) pintar(p, orden.colores);
  if (f < 1) cuadroPedido = pedirCuadro(cuadro);
  else orden = null;
}

function parar() {
  orden = null;
  if (cuadroPedido) soltarCuadro(cuadroPedido);
  cuadroPedido = 0;
}

self.onmessage = ({ data: m }) => {
  if (m.tipo === 'lienzo') {
    lienzo = m.lienzo;
    ctx = lienzo.getContext('2d');
    lienzo.width = lienzo.height = m.px;
  } else if (m.tipo === 'tramo') {
    orden = { tramos: m.tramos, ms: Math.max(1, m.ms), inicio: m.inicio, colores: m.colores };
    if (!cuadroPedido) cuadroPedido = pedirCuadro(cuadro);
  } else if (m.tipo === 'quieto') {
    parar();
    pintar(m.p, m.colores);
  } else if (m.tipo === 'pausa') {
    parar();
  }
};
