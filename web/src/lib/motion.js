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

// Anillo de escaneo (expande + fade). Ref: Face ID.
export function scanPulse(el) {
  if (!el?.animate) return;
  el.animate(
    [
      { transform: 'scale(1)', opacity: .9 },
      { transform: 'scale(1.6)', opacity: 0 },
    ],
    { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' },
  );
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
