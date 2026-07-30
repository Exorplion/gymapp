// Puerto de "reordenar (Hoy y Rutina)" (index.html). Manipulación de DOM
// pura vía getBoundingClientRect/style.transform — no depende de React ni de
// ningún estado propio del framework. El hook useDragSort() (Task 4) monta
// esto sobre markup real con [data-sort]/[data-sid]; hasta entonces no hay
// DOM que arrastrar, por eso Task 3 sólo verifica que el módulo importe
// limpio y que las firmas exportadas sean correctas (ver task-3-brief.md).
import { S, bump } from './state.js';
import { vibrate } from './format.js';
import { setExOrder } from './session.js';

const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* FLIP: mido dónde está cada fila, dejo que el render la mueva, y la
   devuelvo a su sitio viejo con un transform para animarla hasta el nuevo.
   Sin esto el reordenado por flechas sería un salto seco. */
export function flipSort(mutate) {
  const first = new Map();
  $$('[data-sort] > [data-sid]').forEach(k => first.set(k.dataset.sid, k.getBoundingClientRect().top));
  keepScroll(mutate);
  if (!first.size) return;
  $$('[data-sort] > [data-sid]').forEach(k => {
    const f = first.get(k.dataset.sid);
    if (f == null) return;
    const d = f - k.getBoundingClientRect().top;
    if (!d) return;
    k.style.transition = 'none';
    k.style.transform = `translateY(${d}px)`;
    requestAnimationFrame(() => {
      k.style.transition = 'transform .34s var(--ease)';
      k.style.transform = '';
      setTimeout(() => { k.style.transition = ''; k.style.transform = ''; }, 380);
    });
  });
}

export const DRAG = { on: false, box: null, el: null, cards: [], rects: [], gap: 12, from: -1, to: -1, y0: 0, self: 0, cy: 0, raf: 0, swallow: false };
const LP = { t: null, card: null, x: 0, y: 0 };

export function dragPick(e) {
  const t = e.target;
  if (!t || !t.closest) return null;
  if (t.closest('button,input,select,textarea,.chip,#restbar')) return null;
  const card = t.closest('[data-sid]');
  if (!card) return null;
  const box = card.parentElement;
  if (!box || !box.hasAttribute('data-sort')) return null;
  if ([...box.children].filter(k => k.dataset.sid).length < 2) return null;
  return card;
}

export function dragStart(card, clientY) {
  const box = card.parentElement;
  const cards = [...box.children].filter(k => k.dataset.sid);
  const from = cards.indexOf(card);
  if (from < 0) return;
  const rects = cards.map(k => { const r = k.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; });
  const gap = Math.max(0, rects[1].top - (rects[0].top + rects[0].h));
  Object.assign(DRAG, { on: true, box, el: card, cards, rects, gap, from, to: from, y0: clientY + scrollY, self: 0, cy: clientY });
  document.body.classList.add('dragging-on');
  card.classList.remove('shift', 'settling');
  card.classList.add('dragging');
  cards.forEach((k, i) => { if (i !== from) k.classList.add('shift'); });
  vibrate(18);
  DRAG.raf = requestAnimationFrame(dragTick);
}

/* la ventana sigue al dedo: cerca de los bordes se desplaza sola, más rápido
   cuanto más al borde estés, para poder llevar un ejercicio al otro extremo */
const DRAG_EDGE = 120, DRAG_SPEED = 18;
export function dragTick() {
  if (!DRAG.on) return;
  const h = innerHeight;
  let v = 0;
  if (DRAG.cy < DRAG_EDGE) v = -DRAG_SPEED * (1 - DRAG.cy / DRAG_EDGE);
  else if (DRAG.cy > h - DRAG_EDGE) v = DRAG_SPEED * (1 - (h - DRAG.cy) / DRAG_EDGE);
  if (v) {
    const max = Math.max(0, document.documentElement.scrollHeight - h);
    const y = Math.max(0, Math.min(max, scrollY + v));
    if (y !== scrollY) { scrollTo({ top: y, behavior: 'instant' }); dragUpdate(); }
  }
  DRAG.raf = requestAnimationFrame(dragTick);
}

export function dragMove(clientY) {
  if (!DRAG.on) return;
  DRAG.cy = clientY;
  dragUpdate();
}

export function dragUpdate() {
  const dy = (DRAG.cy + scrollY) - DRAG.y0;
  DRAG.el.style.transform = `translateY(${dy}px) scale(var(--lift,1.03))`;
  const mid = DRAG.rects[DRAG.from].top + DRAG.rects[DRAG.from].h / 2 + dy;
  let to = 0;
  DRAG.rects.forEach((r, i) => { if (i !== DRAG.from && mid > r.top + r.h / 2) to++; });
  if (to !== DRAG.to) { DRAG.to = to; dragLayout(); vibrate(6); }
}

/* recalcula el apilado real (las filas no miden todas lo mismo) y corre cada
   una a su nueva posición */
export function dragLayout() {
  const { rects, gap, from, to, cards } = DRAG;
  const idx = rects.map((_, i) => i);
  const [m] = idx.splice(from, 1); idx.splice(to, 0, m);
  let y = rects[0].top;
  const shift = new Array(rects.length);
  idx.forEach(i => { shift[i] = y - rects[i].top; y += rects[i].h + gap; });
  DRAG.self = shift[from];
  cards.forEach((k, i) => { if (i !== from) k.style.transform = shift[i] ? `translateY(${shift[i]}px)` : ''; });
}

export function dragEnd(commit) {
  if (!DRAG.on) return;
  DRAG.on = false;
  cancelAnimationFrame(DRAG.raf);
  const { cards, el, from, to, self, box } = DRAG;
  document.body.classList.remove('dragging-on');
  DRAG.swallow = true; setTimeout(() => { DRAG.swallow = false; }, 400);
  const moved = commit && to !== from;
  el.classList.remove('dragging');
  el.classList.add('settling');
  el.style.transform = moved ? `translateY(${self}px)` : '';
  const clean = () => cards.forEach(k => { k.style.transform = ''; k.classList.remove('shift', 'settling'); });
  if (!moved) { setTimeout(clean, 300); return; }
  const ids = cards.map(k => k.dataset.sid);
  const [m] = ids.splice(from, 1); ids.splice(to, 0, m);
  vibrate(22);
  const kind = box.dataset.sort, wd = box.dataset.wd;
  if (kind === 'days') {
    // pushHistory('Días intercambiados'); // rutina-logic.js (undo history) aún no portado — ver progress.md
    setTimeout(() => {
      // swapDayContents(ids); // rutina-logic.js aún no portado — ver progress.md
      clean();
      bump(); // originalmente renderRutina()
    }, 300);
    return;
  }
  /* guardo ya, en paralelo con la animación de aterrizaje */
  const saved = commitSort(kind, wd, ids);
  setTimeout(async () => {
    /* en vez de re-dibujar la vista entera (eso es lo que hacía parpadear y te
       perdía de lugar), muevo los nodos en el DOM al orden nuevo y borro los
       transforms en la misma tarea: en pantalla no cambia un pixel */
    const by = new Map(cards.map(k => [k.dataset.sid, k]));
    ids.forEach(id => { const k = by.get(id); if (k) box.appendChild(k); });
    clean();
    refreshSortArrows(box);
    await saved;
    /* Hoy sí necesita recalcular cuál es el próximo ejercicio; lo hace sobre un
       DOM que ya está en el orden final, así que no se mueve nada */
    if (kind === 'hoy') keepScroll(() => bump()); // originalmente keepScroll(renderHoy)
  }, 300);
}

/* deshabilita ↑ en el primero y ↓ en el último sin volver a dibujar */
function refreshSortArrows(box) {
  const ks = [...box.children].filter(k => k.dataset.sid);
  ks.forEach((k, i) => {
    const up = k.querySelector('[data-d="-1"],[data-act="ex-up"]');
    const dn = k.querySelector('[data-d="1"],[data-act="ex-down"]');
    if (up) up.disabled = i === 0;
    if (dn) dn.disabled = i === ks.length - 1;
  });
}

export function keepScroll(fn) {
  const y = scrollY;
  fn();
  if (Math.abs(scrollY - y) > 1) scrollTo({ top: y, behavior: 'instant' });
}

export async function commitSort(kind, wd, ids) {
  if (kind === 'hoy') return setExOrder(S.hoyDay ?? new Date().getDay(), ids);
  const d = S.routine[+wd];
  if (!d || !d.exercises) return;
  // pushHistory('Ejercicios reordenados'); // rutina-logic.js (undo history) aún no portado — ver progress.md
  const by = new Map(d.exercises.map(e => [e.id, e]));
  const out = [];
  ids.forEach(i => { if (by.has(i)) { out.push(by.get(i)); by.delete(i); } });
  by.forEach(e => out.push(e));   // nada se pierde si la lista quedó desfasada
  d.exercises = out;
  // return persistDay(+wd); // rutina-logic.js (persistencia de S.routine) aún no portado — ver progress.md
}

/** Registra los listeners globales de drag una sola vez. Se llama desde
    App.jsx en un useEffect con deps [] (Task 4) en vez de ejecutarse al
    cargar el módulo: así importar drag.js no depende de que exista
    `document`/`addEventListener` (p.ej. en un script de verificación Node),
    y coincide con el patrón "attach once" del original (la app nunca
    desmonta App en la práctica, pero igual conviene no tener efectos
    secundarios al importar). */
export function initDragListeners() {
  addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const card = dragPick(e); if (!card) return;
    LP.card = card; LP.x = e.touches[0].clientX; LP.y = e.touches[0].clientY;
    clearTimeout(LP.t);
    LP.t = setTimeout(() => { if (LP.card) dragStart(LP.card, LP.y); }, 330);
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (DRAG.on) { e.preventDefault(); dragMove(e.touches[0].clientY); return; }
    if (!LP.card) return;
    const t = e.touches[0];
    /* si el dedo se movió antes de los 330 ms era scroll, no un arrastre */
    if (Math.abs(t.clientY - LP.y) > 10 || Math.abs(t.clientX - LP.x) > 10) { clearTimeout(LP.t); LP.card = null; }
  }, { passive: false });
  addEventListener('touchend', () => { clearTimeout(LP.t); LP.card = null; if (DRAG.on) dragEnd(true); }, { passive: true });
  addEventListener('touchcancel', () => { clearTimeout(LP.t); LP.card = null; if (DRAG.on) dragEnd(false); }, { passive: true });

  addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const card = dragPick(e); if (!card) return;
    LP.card = card; LP.x = e.clientX; LP.y = e.clientY;
    clearTimeout(LP.t);
    LP.t = setTimeout(() => { if (LP.card) dragStart(LP.card, LP.y); }, 300);
  });
  addEventListener('mousemove', e => {
    if (DRAG.on) { e.preventDefault(); dragMove(e.clientY); return; }
    if (!LP.card) return;
    if (Math.abs(e.clientY - LP.y) > 8 || Math.abs(e.clientX - LP.x) > 8) { clearTimeout(LP.t); LP.card = null; }
  });
  addEventListener('mouseup', () => { clearTimeout(LP.t); LP.card = null; if (DRAG.on) dragEnd(true); });
  /* el click que cierra un arrastre no debe disparar nada */
  addEventListener('click', e => { if (DRAG.swallow) { e.preventDefault(); e.stopPropagation(); } }, true);
}
