// Puerto de <header class="top"> (index.html, ~línea 632) + el bloque
// .header-actions (racha + ajustes) agregado en el rediseño visual.
// El sheet de ajustes se conecta en una tarea posterior (Ajustes todavía no
// existe); onOpenStreak sí se conecta desde Task 6 — App.jsx pasa
// currentStreak() (streak.js, Task 2) y abre el sheet 'streak-detail'
// (StreakDetail.jsx) al tocar el botón, igual que 'streak-open' en el ACT{}
// original.
import { useEffect, useRef } from 'react';
import { Flame } from './Icon.jsx';
import { pulseLike, countTo } from '../lib/motion.js';

export default function Header({ streak = 0, onOpenSettings = () => {}, onOpenStreak = () => {}, onOpenSessions = () => {} }) {
  const flameRef = useRef(null);
  const nRef = useRef(null);
  const prevStreak = useRef(streak);

  // Cuando la racha SUBE (se cerró un día más), la llama pega un bounce
  // (Instagram/Spotify) y el número cuenta hasta el nuevo valor en vez de
  // saltar de golpe. Si baja/reinicia no anima — no hay nada que celebrar.
  useEffect(() => {
    if (streak > prevStreak.current) {
      pulseLike(flameRef.current);
      countTo(nRef.current, streak, { from: prevStreak.current });
    } else if (nRef.current) {
      nRef.current.textContent = String(streak);
    }
    prevStreak.current = streak;
  }, [streak]);

  return (
    <header className="top">
      <div className="brand">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M3 10v4M6 8v8M9 6v12M15 6v12M18 8v8M21 10v4M9 12h6" />
        </svg>
        FIERRO
      </div>
      <div className="header-actions">
        <button className="icon-btn streak-btn" id="streak-btn" aria-label="Racha" onClick={onOpenStreak}>
          <Flame ref={flameRef} className="streak-flame" />
          <span className="streak-n" id="streak-n" ref={nRef}>{streak}</span>
        </button>
        {/* El reloj del mockup. Antes abría el historial como sheet; ahora
            lleva a la sección "Tus sesiones" de Progreso, que es donde vive. */}
        <button className="icon-btn" aria-label="Tus sesiones" onClick={onOpenSessions}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5.2l3.4 2" />
          </svg>
        </button>
        <button className="icon-btn" aria-label="Ajustes" onClick={onOpenSettings}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
