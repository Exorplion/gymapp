// Micro-silueta de fibras: al lado del encabezado de un grupo muscular en
// Entreno, dice SIN TEXTO qué porciones de ese músculo tocan los ejercicios
// elegidos. Enzo lo pidió así explícito: "que arriba en pecho diga como que
// partes del pecho se están trabajando... pero de manera creativa" — nombrar
// cada porción en el encabezado (pecho medio, superior...) es el ruido visual
// que quería evitar. El nombre sólo aparece al tocar.
//
// NO inventa anatomía nueva: la fuente de verdad es fibrasDe() (lib/fibras.js),
// la misma tabla que ya arma el desglose por fibra de groupStats(). Acá sólo
// se traduce esa porción a una "banda" — arriba/medio/abajo del ícono — y se
// agrupan sinónimos que en el dibujo no tienen forma propia para distinguirse
// (Trapecio y Dorsal alto son los dos "espalda alta", por ejemplo — ver la
// nota en muscle.ts sobre por qué no son subgrupos separados).
//
// Un grupo donde fibras.js no distingue nada (Glúteo, Gemelos, Hombro-Tríceps
// genéricos) directamente no tiene entrada en BANDAS_CAT: porcionesDe()
// devuelve [] y el componente no dibuja nada. Es el mismo criterio de
// groupStats() para `fibras`: no vale la pena — ni es honesto — mostrar una
// única bolsa como si fuera una selección.
import { useState, useRef, useEffect } from 'react';
import { fibrasDe } from '../lib/fibras.js';
import { popIn, D } from '../lib/motion.js';

/* Porción que devuelve fibrasDe() -> banda que se dibuja. Sólo entran acá las
   porciones que sí tienen una distinción real y legible ("superior" contra
   "inferior"); lo que fibras.js sólo puede nombrar en genérico (p.ej. el
   'Tríceps' de un pushdown, que no sabe qué cabeza prioriza — ver el comentario
   de fibras.js sobre JM press/skullcrusher/dips) no entra, a propósito. */
const FIBRA_A_BANDA = {
  Clavicular: 'superior', Costal: 'medio',
  'Dorsal alto': 'alta', Trapecio: 'alta', 'Dorsal bajo': 'baja',
  'Deltoides anterior': 'anterior', Hombro: 'lateral',
  'Bíceps braquial': 'braquial', Braquiorradial: 'braquiorradial',
  'Vasto interno': 'cuádriceps', 'Vasto externo': 'cuádriceps',
  Femoral: 'isquios', Aductores: 'aductores',
  'Abdomen superior': 'superior', 'Abdomen inferior': 'inferior', Oblicuos: 'oblicuos',
};

/* Orden de dibujo (arriba->abajo en el ícono) por grupo. Sólo los grupos acá
   tienen algo honesto que mostrar: el resto (Glúteo, Gemelos, Tríceps,
   Bíceps-genérico...) siempre cae en una sola bolsa según fibras.js, y
   dibujarla como si fuera una selección sería inventar precisión. */
const BANDAS_CAT = {
  Pecho: ['superior', 'medio'],
  Espalda: ['alta', 'baja'],
  Hombro: ['anterior', 'lateral'],
  Bíceps: ['braquial', 'braquiorradial'],
  Pierna: ['cuádriceps', 'isquios', 'aductores'],
  Abs: ['superior', 'inferior', 'oblicuos'],
};

/* Cuánto "pesa" un ejercicio para la intensidad. `sets` en la rutina es un
   número planeado (Rutina.jsx: `sets: parseInt(...)`), pero por si llega un
   arreglo de series ya registradas (mismo shape que en session.js) también se
   soporta. Sin dato numérico, el ejercicio sigue contando como "presente" —
   la porción SÍ se entrena— pero con el mínimo (1), nunca con un número
   inventado. */
function volumenDe(ex) {
  const s = ex?.sets;
  if (typeof s === 'number' && s > 0) return s;
  if (Array.isArray(s)) return s.length || 1;
  return 1;
}

/**
 * Qué porciones de `cat` trabajan `exercises`, con el volumen (series) de
 * cada una. Devuelve `[]` cuando no hay nada que distinguir honestamente:
 * lista vacía/undefined, ejercicios que fibrasDe() no reconoce, o un grupo
 * sin subdivisión real en la lámina.
 *
 * Forma: `[{ banda, sets }]`, en el orden fijo de BANDAS_CAT (no por volumen)
 * para que el ícono no reordene sus segmentos entre un render y otro.
 */
export function porcionesDe(cat, exercises) {
  const bandas = BANDAS_CAT[cat];
  if (!bandas) return [];
  const acc = new Map();
  for (const ex of exercises || []) {
    const fib = fibrasDe(ex);
    if (!fib) continue;
    for (const p of fib.p || []) {
      const banda = FIBRA_A_BANDA[p];
      if (!banda || !bandas.includes(banda)) continue;
      acc.set(banda, (acc.get(banda) || 0) + volumenDe(ex));
    }
  }
  return bandas.filter(b => acc.has(b)).map(banda => ({ banda, sets: acc.get(banda) }));
}

/** "superior y medio" / "superior, medio y aductores" — para el aria-label y
    para lo que se ve al tocar. Nunca lista una sola con "y" colgando. */
function nombrarLista(nombres) {
  if (nombres.length <= 1) return nombres[0] || '';
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export default function MuscleFibers({ cat, exercises }) {
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef(null);
  const porciones = porcionesDe(cat, exercises);

  useEffect(() => { if (abierto) popIn(panelRef.current, { scale: 0.92, duration: D.toque }); }, [abierto]);

  // Nada que distinguir: no se dibuja ni un placeholder vacío. La ausencia de
  // dato no se rellena con un ícono apagado.
  if (!porciones.length) return null;

  const bandasTotal = BANDAS_CAT[cat];
  const maxSets = Math.max(...porciones.map(p => p.sets));
  const nombres = porciones.map(p => p.banda);
  const texto = `${cat}: ${nombrarLista(nombres)}`;

  return (
    <span className="mfibras-wrap">
      <button
        type="button"
        className="mfibras-btn"
        aria-label={texto}
        aria-expanded={abierto}
        onClick={() => setAbierto(v => !v)}
      >
        <svg viewBox="0 0 20 24" width="28" height="32" className="mfibras-svg" aria-hidden="true">
          {bandasTotal.map((banda, i) => {
            const h = 24 / bandasTotal.length;
            const encontrada = porciones.find(p => p.banda === banda);
            // Intensidad honesta: proporcional a las series reales de esa
            // porción contra la más entrenada del grupo, no decorativa. Un
            // piso de .35 para que una porción con poco volumen siga
            // leyéndose como "entrenada" y no como "casi apagada".
            const intensidad = encontrada ? 0.35 + 0.65 * (encontrada.sets / maxSets) : 0;
            return (
              <rect
                key={banda}
                x="1" y={i * h + 1} width="18" height={h - 2} rx="3"
                className={encontrada ? 'mfibras-on' : 'mfibras-off'}
                style={encontrada ? { fillOpacity: intensidad } : undefined}
              />
            );
          })}
        </svg>
      </button>
      {abierto && (
        <span ref={panelRef} className="mfibras-panel" role="status">
          {texto}
        </span>
      )}
    </span>
  );
}
