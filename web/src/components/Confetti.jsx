// Puerto de fireConfetti() (index.html ~línea 1279). El original crea un
// <div class="confetti-host"> con 28 <i> hijos, los estilea inline (color,
// delay, drift, rotación) y lo cuelga directo de document.body — fuera del
// árbol que dibuja el resto de la UI — para que se autodestruya con
// setTimeout una vez terminada la animación CSS
// (.confetti-host/@keyframes confettiFall, ya en styles.css desde Task 1).
//
// No hay ningún estado de React que describir acá (no es "mostrar/ocultar
// según una condición", es "aparecer, animarse solo, desaparecer"), así que
// se mantiene como función imperativa idéntica al original en vez de
// reimplementarla como estado declarativo — eso sólo agregaría riesgo
// (temporizadores en useEffect, cleanup, refs) sin ningún beneficio visual
// o de mantenimiento.
//
// <Confetti/> (default export) es a propósito un no-op: no necesita un nodo
// montado por React porque fireConfetti() no apunta a ningún ref suyo. Se
// mantiene como componente (en vez de borrarse) sólo para que App.jsx pueda
// montarlo junto a <RestTimer/>/<Sheet/>/<Toast/> como pide el plan, sin
// que eso implique que haga nada.
const COLORS = ['#2E7DFF', '#5EA2FF', '#22D3EE', '#2EE6A8', '#FFB454'];

export function fireConfetti() {
  const host = document.createElement('div');
  host.className = 'confetti-host';
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = COLORS[i % COLORS.length];
    p.style.animationDelay = (Math.random() * .3) + 's';
    p.style.animationDuration = (1.6 + Math.random() * .9) + 's';
    p.style.setProperty('--rot', (Math.random() * 360) + 'deg');
    p.style.setProperty('--drift', (Math.random() * 140 - 70) + 'px');
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 2700);
}

export default function Confetti() {
  return null;
}
