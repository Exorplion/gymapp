// Íconos propios de FIERRO, mismo lenguaje visual que ya usaban TabBar.jsx y
// Header.jsx (trazo fino, currentColor, viewBox 24x24) — antes estos siete
// conceptos vivían como emoji sueltos (🔥⚡🎤ⓘ↷⇄⌄) repartidos en una docena de
// archivos, mezclados con los SVG dibujados a mano del resto de la app. Un
// emoji no se puede recolorear con CSS ni pesa lo mismo entre plataformas —
// acá cada uno es del mismo material que el resto del ícono set.
//
// A propósito quedan afuera los `›` de las filas que se despliegan (Rutina,
// Hoy, Progreso): son un sistema aparte (disclosure chevrons repetidos en
// muchos lugares) y mezclarlos acá los dejaría a mitad de camino — mejor una
// pasada propia el día que se encare esa consistencia.
import { forwardRef } from 'react';

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

/** La racha: llena y no de trazo — es el mismo criterio que ya usa el ícono
    activo de la tab bar (relleno = "esto importa ahora"), y una racha sólo
    se muestra cuando hay algo que contar.
    forwardRef: Header.jsx necesita el nodo DOM para animarlo (pulseLike) al
    subir la racha — misma API para todo lo demás, un ref es opcional. */
export const Flame = forwardRef(function Flame({ size = 16, className, style }, ref) {
  return (
    <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden="true">
      <path d="M12 21c4.5 0 7.5-2.8 7.5-6.8 0-3.1-1.9-5.3-3.5-7.6-.2 1.9-1.1 3.2-2.3 3.7.7-2.9-.3-5.3-3.2-7.8-.3 3.2-1.8 4.9-3.7 7C5.4 11.4 4.5 13 4.5 14.6 4.5 18.5 7.3 21 12 21z" />
    </svg>
  );
});

export function Bolt({ size = 18, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

export function Mic({ size = 19, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8.5" y1="21" x2="15.5" y2="21" />
    </svg>
  );
}

/** El punto rojo de "grabando": a propósito NO hereda currentColor — grabar
    es rojo en cualquier app de cámara o dictado, y ponerlo del mismo azul
    del botón lo hacía ilegible como estado distinto. */
export function RecordDot({ size = 19, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="var(--red)" />
    </svg>
  );
}

export function Info({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="7.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Skip({ size = 15, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M4 7v5a2 2 0 0 0 2 2h12" />
      <path d="M13 10l4 4-4 4" />
    </svg>
  );
}

export function Swap({ size = 15, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M4 8h13M17 8l-3.5-3.5M17 8l-3.5 3.5" />
      <path d="M20 16H7M7 16l3.5-3.5M7 16l3.5 3.5" />
    </svg>
  );
}

/** Sólo el minimizar del timer de descanso — el resto de los chevrones
    (filas que se despliegan) quedan fuera de esta pasada a propósito. */
export function ChevronDown({ size = 18, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/* Los cuatro de las filas de lista: ajustar, renombrar, quitar, confirmar.
   Vivían como los glifos ⚙ ✎ ✕ ✓ escritos a mano dentro de Gyms.jsx y
   FoodVoice.jsx — exactamente el problema que este archivo ya había resuelto
   para 🔥⚡🎤: un carácter no se recolorea con CSS, cambia de forma según la
   plataforma y no comparte el grosor de trazo del resto del set, así que en
   una fila al lado de un ícono de verdad se ve más fino y desalineado. */

/** "Ajustar lo de este gimnasio". Perillas y no un engranaje: lo que abre no
    es una pantalla de configuración sino la lista de ejercicios donde vas
    asignando con qué máquina hacés cada uno acá — ajustar, no configurar. */
export function Tune({ size = 17, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M4 7h9M19 7h1M4 12h3M13 12h7M4 17h9M19 17h1" />
      <circle cx="16" cy="7" r="2.1" />
      <circle cx="10" cy="12" r="2.1" />
      <circle cx="16" cy="17" r="2.1" />
    </svg>
  );
}

export function Pencil({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  );
}

/** Quitar / cerrar. */
export function X({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

export function Check({ size = 17, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
