// Variants de `motion` para el contenido de las hojas: la versión
// declarativa de sheetReveal() (motion.js).
//
// Misma coreografía, mismos tiempos, dicha de otra forma: el panel sube (CSS
// `shup`, --d2) y RECIÉN cuando llegó entran las secciones, una tras otra.
// Por eso `delayChildren` = D.objeto: si las secciones arrancaran junto con
// el panel serían dos movimientos en el mismo eje, uno adentro del otro — lo
// que Enzo describió como "un stagger terrible" en Mis rutinas.
//
// Reemplaza al bloomOpen() que Ajustes, Perfil, Pre-workout, Tu Año y la ficha
// de ejercicio le hacían a su raíz: una escala con fundido ENCIMA de la
// subida del panel. Sheet.jsx ya documentaba ese doble movimiento como el
// problema; en estas hojas había sobrevivido.
//
// "Reducir movimiento" lo resuelve <MotionConfig reducedMotion="user"> en
// App.jsx: con la preferencia activa, motion no anima transformaciones.
import { D, EASE_OUT } from './motion.js';

const s = ms => ms / 1000;
const curva = EASE_OUT.match(/[\d.]+/g).map(Number);

/** El contenedor: no se mueve, sólo ordena la entrada de los hijos. */
export const hoja = {
  oculto: {},
  visible: { transition: { delayChildren: s(D.objeto), staggerChildren: 0.03 } },
};

/** Cada sección de la hoja. */
export const seccion = {
  oculto: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: s(D.panel), ease: curva } },
};

/** Props listas para el contenedor: `<motion.div {...hojaProps}>`. */
export const hojaProps = { variants: hoja, initial: 'oculto', animate: 'visible' };
