// Íconos de equipo para el asistente "Agregar ejercicio" (paso 3).
//
// La maqueta los dibujaba con emoji (🏋️ 💪 🔗 ⚙️…) y la auditoría ya lo
// había marcado (G7): un emoji no se recolorea con CSS, cambia de dibujo en
// cada plataforma y no pesa lo mismo que el resto del set. Acá son del mismo
// material que Icon.jsx: viewBox 24×24, trazo fino en currentColor, puntas
// redondeadas, sin relleno de color. Así el elegido toma el acento con sólo
// cambiar `color`, igual que cualquier otro ícono de la app.
//
// Los ids son los de EQUIP (equip.js) — son parte de la clave del historial
// (exKey), no se inventa ninguno — más '' = "Otro" (sin equipo declarado).
import { EQUIP } from '../lib/equip.js';

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

/** Los 7 equipos reales + "Otro". "Peso corporal" va corto porque la celda
    de la grilla mide ~80 px: el nombre largo sigue en el aria-label. */
export const EQUIP_ASIST = [
  ...EQUIP.map(e => ({ id: e.id, label: e.id === 'corporal' ? 'Corporal' : e.label, nombre: e.label })),
  { id: '', label: 'Otro', nombre: 'Otro o sin equipo' },
];

function trazo(id) {
  switch (id) {
    case 'barra': // barra larga con un disco fino de cada lado
      return (
        <>
          <path d="M2 12h3.5M8.5 12h7M18.5 12H22" />
          <rect x="5.5" y="6.5" width="3" height="11" rx="1" />
          <rect x="15.5" y="6.5" width="3" height="11" rx="1" />
        </>
      );
    case 'mancuernas': // mancuerna corta en diagonal, cabezas gruesas
      return (
        <g transform="rotate(-40 12 12)">
          <path d="M9.5 12h5" />
          <rect x="4" y="8" width="5.5" height="8" rx="1.6" />
          <rect x="14.5" y="8" width="5.5" height="8" rx="1.6" />
        </g>
      );
    case 'discos': // disco con agujero central y manija
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2.2" />
          <path d="M8.6 6.9a6.2 6.2 0 0 1 6.8 0" />
        </>
      );
    case 'placas': // stack numerado con el pasador
      return (
        <>
          <rect x="4" y="4" width="13" height="4.2" rx="1" />
          <rect x="4" y="9.9" width="13" height="4.2" rx="1" />
          <rect x="4" y="15.8" width="13" height="4.2" rx="1" />
          <path d="M17 12h3.5" />
          <circle cx="20.5" cy="12" r="1" />
        </>
      );
    case 'polea': // roldana, cable y manija
      return (
        <>
          <circle cx="10" cy="6.5" r="3.5" />
          <circle cx="10" cy="6.5" r=".6" fill="currentColor" stroke="none" />
          <path d="M13.5 6.5V16M6.5 6.5v8" />
          <path d="M10.5 19h6M13.5 16v3" />
          <rect x="4.5" y="14.5" width="4" height="5" rx="1" />
        </>
      );
    case 'smith': // barra entre dos guías
      return (
        <>
          <path d="M7 3v18M17 3v18" />
          <path d="M3 11h18" />
          <rect x="9.5" y="8.5" width="1.8" height="5" rx=".6" />
          <rect x="12.7" y="8.5" width="1.8" height="5" rx=".6" />
        </>
      );
    case 'corporal': // figura
      return (
        <>
          <circle cx="12" cy="4.8" r="2.1" />
          <path d="M12 7.6v6.2M6.8 10.2l5.2-1.4 5.2 1.4M12 13.8l-3.4 6.7M12 13.8l3.4 6.7" />
        </>
      );
    default: // otro: tres puntos
      return (
        <>
          <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </>
      );
  }
}

export default function EquipIcon({ id = '', size = 22, className }) {
  return (
    <svg width={size} height={size} {...base} className={className} aria-hidden="true">
      {trazo(id)}
    </svg>
  );
}
