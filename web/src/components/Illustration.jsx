// Ilustraciones para los dos estados vacíos más importantes de la app (los
// que ve alguien recién llegado, no los sub-estados chicos de Progreso que
// ya tienen contexto de sobra alrededor). Mismo lenguaje que Icon.jsx —
// trazo fino, currentColor — pero a una escala más grande y compuesta, no
// un glifo suelto. Reemplazan a los emoji 🏗️/🏋️ que hacían de placeholder.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

/** Rutina sin armar: la semana en tira, vacía, con el día de hoy invitando a
    tocar — la misma metáfora que ya usa la pantalla real debajo (WD1, los
    siete días en fila), así la ilustración no inventa un ícono nuevo, señala
    a la propia interfaz. */
export function RutinaVacia({ size = 84, className }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 100 60" className={className} aria-hidden="true">
      <g {...base} opacity="0.4">
        <rect x="4" y="20" width="11" height="24" rx="3" />
        <rect x="19" y="20" width="11" height="24" rx="3" />
        <rect x="34" y="20" width="11" height="24" rx="3" />
        <rect x="64" y="20" width="11" height="24" rx="3" />
        <rect x="79" y="20" width="11" height="24" rx="3" />
      </g>
      <rect x="49" y="16" width="12" height="28" rx="3.5" {...base} strokeDasharray="3.5 3.5" opacity="0.7" />
      <path d="M55 24v12M49 30h12" {...base} strokeWidth="2.4" />
    </svg>
  );
}

/** Sin plan para hoy: la barra apoyada, quieta — no hay ejercicio de la
    rutina para este día en particular (puede ser descanso real, o que
    todavía no se cargó nada). Las tres rayas arriba son el gesto universal
    de "en pausa/descansando", sin caer en un emoji de luna que no pega con
    el resto del ícono set. */
export function HoySinPlan({ size = 84, className }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 100 60" className={className} aria-hidden="true">
      <g {...base}>
        <line x1="18" y1="42" x2="82" y2="42" />
        <circle cx="24" cy="42" r="11" />
        <circle cx="76" cy="42" r="11" />
        <circle cx="24" cy="42" r="5" />
        <circle cx="76" cy="42" r="5" />
      </g>
      <g {...base} opacity="0.55">
        <path d="M58 20l5-5" />
        <path d="M66 14l4-4" />
        <path d="M73 9l3-3" />
      </g>
    </svg>
  );
}
