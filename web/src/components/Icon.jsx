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
      <circle cx="12" cy="12" r="7" fill="var(--danger)" />
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

/* Subir y bajar en una lista. Reemplazan a ↑ y ↓, que además de no ser del
   mismo material que el resto del set tenían un problema propio: las flechas
   tipográficas cambian bastante de peso y de largo entre plataformas, así
   que la columna de botones ↑/↓ se veía pareja en un teléfono y despareja en
   otro. Un trazo dibujado mide lo mismo en todos. */
export function ArrowUp({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M12 19V5M12 5l-5.5 5.5M12 5l5.5 5.5" />
    </svg>
  );
}

export function ArrowDown({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M12 5v14M12 19l-5.5-5.5M12 19l5.5-5.5" />
    </svg>
  );
}

/* Los de la tarjeta de ejercicio rediseñada (2026-09-24): el botón de
   opciones, "hacer después", la foto de la máquina y sumar/quitar serie. */
export function Dots({ size = 18, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18.5" cy="12" r="1.3" />
    </svg>
  );
}

export function Later({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /><path d="M4 4l2.5 2.5" />
    </svg>
  );
}

export function Camera({ size = 17, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

export function Plus({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Minus({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

export function Sides({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M8 7l-4 5 4 5M16 7l4 5-4 5M4 12h16" />
    </svg>
  );
}

/* Los del asistente "Agregar ejercicio" (2026-09-28): volver un paso, la
   manija de arrastre de la fila nueva y la chispa de la sugerencia. */
export function ChevronLeft({ size = 18, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M15 5.5L8.5 12l6.5 6.5" />
    </svg>
  );
}

/** Manija de arrastre: seis puntos, el mismo gesto que usan las listas del
    teléfono. Es una pista visual; el arrastre sale de toda la fila. */
export function Grip({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

/** La sugerencia de la app (el ✦ de la maqueta): una chispa de cuatro puntas. */
export function Spark({ size = 14, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden="true">
      <path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5v.1c-4.6.6-6.9 2.9-7.5 7.5h-.1c-.6-4.6-2.9-6.9-7.5-7.5V10c4.6-.6 6.9-2.9 7.5-7.5z" transform="translate(0 2)" />
    </svg>
  );
}

/* ---- Tanda C / tanda 8 (2026-09-29): los emoji y glifos que quedaban ----
   📚 🏋 🎯 👤 🏆 💾 ⬇ ⬆ ⟳ 🧪 ⚠ 🖼 ▶ ↺ 💧 ☕ ↕ ☰ ⤓ ⌁ ✥, escritos a mano en
   ~25 archivos (auditoría total, G7). Mismo material que el resto: 24×24,
   trazo 1.8 en currentColor, puntas redondeadas. */

/** Mis rutinas: tres lomos de carpeta, no una pila de libros de colores. */
export function Rutinas({ size = 18, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <rect x="3.5" y="4" width="4" height="16" rx="1" />
      <rect x="9" y="4" width="4" height="16" rx="1" />
      <path d="M14.6 5.3l3.7-1 3.1 14.7-3.7 1z" />
    </svg>
  );
}

/** Gimnasio: la mancuerna de la marca, de trazo. */
export function Mancuerna({ size = 18, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M3 10v4M6 8v8M9 6v12M15 6v12M18 8v8M21 10v4M9 12h6" />
    </svg>
  );
}

/** Metas / calcular macros: una diana. */
export function Diana({ size = 18, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** El perfil (sexo, peso, actividad). */
export function Persona({ size = 18, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.9-3.9 3.8-6 7.5-6s6.6 2.1 7.5 6" />
    </svg>
  );
}

/** Récord personal. */
export function Trofeo({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M8.5 20h7M10 17h4" />
    </svg>
  );
}

export function Guardar({ size = 17, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4" /><rect x="8" y="13" width="8" height="5" rx="1" />
    </svg>
  );
}

/** Bajar un archivo (exportar). */
export function Descargar({ size = 17, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19.5h14" />
    </svg>
  );
}

/** Subir un archivo (importar). */
export function Subir({ size = 17, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M5 19.5h14" />
    </svg>
  );
}

/** Traer de otro lado (⤓): una flecha que entra a una bandeja. */
export function Traer({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M12 3v10M8 9.5l4 4 4-4" /><path d="M4 14v5h16v-5" />
    </svg>
  );
}

/** Buscar actualización / volver a cargar. */
export function Recargar({ size = 17, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" />
    </svg>
  );
}

/** Restablecer (↺): vuelve atrás. */
export function Restablecer({ size = 15, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4.5v4h4" />
    </svg>
  );
}

/** Datos de prueba: un tubo de ensayo. */
export function Probeta({ size = 17, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M9 3h6M10 3v6.5L5.2 18a2 2 0 0 0 1.7 3h10.2a2 2 0 0 0 1.7-3L14 9.5V3" /><path d="M7.5 15h9" />
    </svg>
  );
}

/** Advertencia. Hereda el color: con .txt-warn o text-warn va en ámbar. */
export function Alerta({ size = 15, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M12 3.5L2.8 19.5h18.4z" /><path d="M12 10v4.2" />
      <circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Imagen({ size = 17, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 16l-5-5L6 19" />
    </svg>
  );
}

/** Empezar / hacer ahora. Relleno, como el ▶ que reemplaza. */
export function Play({ size = 14, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden="true">
      <path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" />
    </svg>
  );
}

/** Fluidos. */
export function Gota({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M12 3.5s-6 6.6-6 10.7a6 6 0 0 0 12 0C18 10.1 12 3.5 12 3.5z" />
    </svg>
  );
}

/** Cafeína. */
export function Taza({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M9 3.5v2.5M12.5 3.5v2.5" />
    </svg>
  );
}

/** Reordenar (↕): la pista de "mantené presionado y arrastrá". */
export function Mover({ size = 15, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M12 3.5v17M8 7.5l4-4 4 4M8 16.5l4 4 4-4" />
    </svg>
  );
}

/** Hace tiempo (⌁): un reloj de arena. */
export function Arena({ size = 14, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M6.5 3.5h11M6.5 20.5h11M8 3.5c0 4.5 8 4.5 8 8.5s-8 4-8 8.5M16 3.5c0 4.5-8 4.5-8 8.5s8 4 8 8.5" />
    </svg>
  );
}

/** Tendencia: sube / baja (↗ ↘ de los resúmenes). */
export function Sube({ size = 13, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M6 18L18 6M9 6h9v9" />
    </svg>
  );
}
export function Baja({ size = 13, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <path d="M6 6l12 12M18 9v9H9" />
    </svg>
  );
}

/** Copiar a otro lado (⧉). */
export function Copiar({ size = 16, className, style }) {
  return (
    <svg width={size} height={size} {...base} className={className} style={style} aria-hidden="true">
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </svg>
  );
}
