// Helpers de animación imperativos (Web Animations API nativa), en el mismo
// espíritu que fireConfetti() en confetti.js: "aparecer, animarse solo,
// desaparecer" sin estado de React ni dependencias — se sacó Framer Motion
// del proyecto (ver commit "revert(movimiento): sacar Framer Motion") porque
// el resorte real corre en JS/compositor, no en una librería de por medio.
//
// Referencias de la investigación de animaciones "más famosas" (fitness y
// fuera de fitness) que inspiran estos presets:
// - Apple Fitness: anillos que cierran con fireworks al completar el día.
// - Apple Face ID: anillo de escaneo que expande/contrae dando feedback en vivo.
// - Duolingo: la llama de racha se aviva con la racha activa y decae al cortarse.
// - Instagram/Spotify: bounce del corazón al dar "me gusta".
// - Notion: los paneles/páginas se abren en "bloom" (escala + fade), no en corte seco.
// - Airbnb: las cards reaccionan a hover/tap con un reveal sutil, no un salto.
// Tendencia 2026 confirmada en la investigación: menos scroll-jacking
// elaborado, más de 1-2 gestos "de firma" simples y con propósito — por eso
// estos presets son pocos y cortos (~300-450ms), no un catálogo de efectos.

const SPRING = 'cubic-bezier(.34,1.56,.64,1)'; // = var(--spring) en styles.css

// Bounce de "me gusta" / toggle: racha, favoritos, checks. Ref: Instagram/Spotify.
export function pulseLike(el) {
  if (!el?.animate) return;
  el.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.35)' },
      { transform: 'scale(.92)' },
      { transform: 'scale(1)' },
    ],
    { duration: 420, easing: SPRING },
  );
}

// Bloom-open: sheets/paneles al montar. Ref: páginas de Notion.
export function bloomOpen(el) {
  if (!el?.animate) return;
  el.animate(
    [
      { transform: 'scale(.94) translateY(10px)', opacity: 0 },
      { transform: 'scale(1) translateY(0)', opacity: 1 },
    ],
    { duration: 320, easing: SPRING, fill: 'backwards' },
  );
}

// Reveal escalonado de listas (ejercicios de una rutina, comidas del día).
export function staggerReveal(els, { delayStep = 45, distance = 14 } = {}) {
  if (!els || els.animate) return; // guard: no pasar un solo elemento por error
  Array.from(els).forEach((el, i) => {
    if (!el?.animate) return;
    el.animate(
      [
        { transform: `translateY(${distance}px)`, opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      { duration: 360, delay: i * delayStep, easing: SPRING, fill: 'backwards' },
    );
  });
}

// Las 5 pantallas (Hoy/Rutina/Nutrición/Progreso + el carrusel de Hoy) tienen
// key={store.tab}/key={done.length} en App.jsx/ExerciseCarousel.jsx, así que
// se REMONTAN cada vez que volvés a esa pestaña — no sólo la primera vez que
// las ves. Antes eso significaba que staggerReveal() volvía a correr en
// CADA visita, compitiendo con el fundido de cambio de pestaña (screenIn,
// styles.css) y leyéndose como "caótico" (Enzo, 2026-09-04). Con
// staggerRevealOnce() el reveal escalonado sólo pasa la primera vez que esa
// pantalla aparece en la sesión — las visitas siguientes entran de una sola
// vez junto con el fundido de la pantalla, sin el segundo movimiento
// compitiendo encima. `revealed` vive en memoria (no localStorage): recargar
// la app es "sesión nueva" y las tarjetas vuelven a hacer su primer reveal,
// que es exactamente cuándo tiene sentido mostrarlo.
const revealed = new Set();
export function staggerRevealOnce(key, els, opts) {
  if (revealed.has(key)) return;
  revealed.add(key);
  staggerReveal(els, opts);
}

// Cierre de anillo de progreso (0..1) sobre un <circle> con
// data-circumference ya seteado. Ref: anillos de Apple Fitness.
export function animateRing(circleEl, progress, { duration = 900 } = {}) {
  if (!circleEl?.animate) return;
  const circumference = Number(circleEl.getAttribute('data-circumference')) || 0;
  if (!circumference) return;
  const from = Number(circleEl.getAttribute('data-progress')) || 0;
  const to = Math.max(0, Math.min(1, progress));
  circleEl.setAttribute('data-progress', String(to));
  circleEl.animate(
    [
      { strokeDashoffset: circumference * (1 - from) },
      { strokeDashoffset: circumference * (1 - to) },
    ],
    { duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
  );
}

// Anillo de escaneo (expande + fade) en un punto de PANTALLA. Ref: Face ID.
//
// No anima el elemento tocado directamente: sobre un <g> de SVG, scale()
// transforma desde el origen del viewBox (esquina), no desde el centro del
// músculo — el "pulso" salía desplazado/deformado en vez de expandirse desde
// el punto de toque. Tampoco se posiciona contra el bounding box del <g>
// tocado: un grupo bilateral (hombros, pantorrillas) es UN solo <g> con las
// piezas de ambos lados adentro, así que su centro cae en el medio del
// torso, no en el lado que tocaste. La única coordenada confiable es la del
// evento (clientX/clientY) — por eso este helper toma directamente un punto
// de pantalla, no un elemento ni un contenedor.
//
// position:fixed + document.body: no depende de que ningún ancestro tenga
// position:relative, e ignora cualquier transform 3D de un padre (el cuerpo
// gira con rotateY) porque cuelga fuera de ese árbol. Se autodestruye al
// terminar — mismo patrón imperativo que fireConfetti().
export function tapRing(x, y, { size = 26, color = 'var(--cyan)' } = {}) {
  const ring = document.createElement('span');
  ring.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;` +
    `margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;border:2px solid ${color};` +
    'pointer-events:none;z-index:9999;box-sizing:border-box;';
  document.body.appendChild(ring);
  const anim = ring.animate(
    [
      { transform: 'scale(1)', opacity: .9 },
      { transform: 'scale(2.4)', opacity: 0 },
    ],
    { duration: 550, easing: 'cubic-bezier(.4,0,.2,1)' },
  );
  anim.onfinish = () => ring.remove();
}

// "Juice" de videojuego: squash & stretch — comprime al recibir el toque y
// estira al soltar, en vez de un escalado uniforme. Es la técnica que más
// vida le da a una interacción según el game design clásico (los 12
// principios de animación de Disney, adoptados por juegos). Para el botón
// de acción más repetido de la app: marcar una serie.
export function squashStretch(el) {
  if (!el?.animate) return;
  el.animate(
    [
      { transform: 'scale(1,1)' },
      { transform: 'scale(1.12,.86)', offset: .35 },
      { transform: 'scale(.94,1.08)', offset: .62 },
      { transform: 'scale(1,1)' },
    ],
    { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' },
  );
}

// Ráfaga de partículas en el punto de contacto (screen-space, position:fixed
// como tapRing). Ref: el combo "hit-stop + shake + partículas" de feedback
// de impacto en videojuegos — acá sólo la parte de partículas, sin sacudir
// la pantalla (haría perder de vista dónde estabas parado en un formulario).
// Para momentos de logro: serie completada, PR nuevo.
export function impactBurst(x, y, { count = 6, color = 'var(--cyan)', distance = 26 } = {}) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dx = Math.cos(angle) * distance * (0.7 + Math.random() * 0.5);
    const dy = Math.sin(angle) * distance * (0.7 + Math.random() * 0.5);
    const p = document.createElement('span');
    p.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;` +
      `border-radius:50%;background:${color};pointer-events:none;z-index:9999;`;
    document.body.appendChild(p);
    const anim = p.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0 },
      ],
      { duration: 460 + Math.random() * 140, easing: 'cubic-bezier(.2,.8,.4,1)' },
    );
    anim.onfinish = () => p.remove();
  }
}

// Cuenta ascendente/descendente de un número (peso, series, calorías, kcal).
export function countTo(el, to, { from = 0, duration = 600, format = (n) => Math.round(n) } = {}) {
  if (!el) return;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = format(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
