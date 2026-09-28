// Puerto de fireConfetti() (index.html ~línea 1279). El original crea un
// <div class="confetti-host"> con 28 <i> hijos, los estilea inline (color,
// delay, drift, rotación) y lo cuelga directo de document.body — fuera del
// árbol que dibuja el resto de la UI — para que se autodestruya con
// setTimeout una vez terminada la animación CSS
// (.confetti-host/@keyframes confettiFall, ya en styles.css).
//
// Se mantiene como función imperativa idéntica al original en vez de
// reimplementarla como estado declarativo: no es "mostrar/ocultar según una
// condición", es "aparecer, animarse solo, desaparecer". Hacerlo declarativo
// sólo agregaría riesgo (temporizadores en useEffect, cleanup, refs) sin
// ningún beneficio visual ni de mantenimiento.
//
// Vive en lib/ porque quien la llama es session.js (lógica de negocio, al
// completar una sesión): no toca React ni ningún nodo montado por React, así
// que no tenía por qué vivir en components/.
import { leerToken } from './theme.js';

/* Los colores del festejo: el acento elegido (claro y fuerte), el verde de
   "logrado", la llama de la racha y el blanco del texto. Se leen de los
   tokens en el momento de disparar, así siguen al acento (antes eran cinco
   hex de la paleta azul anterior, con cualquier tema). */
const TOKENS = ['--accent', '--accent-strong', '--ok', '--flame', '--text'];

export function fireConfetti() {
  /* Respeta "reducir movimiento" del sistema (WCAG 2.3.3). La regla CSS
     global de styles.css:239 no alcanza acá: estas partículas se animan por
     JS, no por CSS. Es puro festejo transitorio y no deja ningún estado, así
     que no dispararlo no le saca información a nadie — el hito igual se
     anuncia por texto en SessionComplete. */
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colores = TOKENS.map(leerToken).filter(Boolean);
  const host = document.createElement('div');
  host.className = 'confetti-host';
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colores.length ? colores[i % colores.length] : `var(${TOKENS[i % TOKENS.length]})`;
    p.style.animationDelay = (Math.random() * .3) + 's';
    p.style.animationDuration = (1.6 + Math.random() * .9) + 's';
    p.style.setProperty('--rot', (Math.random() * 360) + 'deg');
    p.style.setProperty('--drift', (Math.random() * 140 - 70) + 'px');
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 2700);
}
