// Cobertura de fibra: de las porciones conocidas de un músculo, cuáles
// cubren los ejercicios que la persona ya eligió en el asistente de rutina,
// y cuáles faltan.
//
// Deliberadamente NO da porcentajes. Se investigó (fuentes reales: Maeo et
// al. 2022, Boehler 2011, Rodríguez-Ribeiro et al. 2020, Coratella et al.
// 2023 — ver fibras.js) y ningún estudio EMG/hipertrofia da un reparto tipo
// "70% / 30%" entre dos ejercicios que sume 100%: esos números no existen en
// la literatura. Inventar uno sería mostrar una precisión que no hay — lo
// mismo que fibras.js ya decidía no hacer (ver su "LÍMITE HONESTO").
//
// Lo que SÍ hay, y alcanza para la pregunta real ("¿esta combinación cubre
// todo el músculo o me estoy repitiendo?"), es evidencia de qué ejercicio
// PRIORIZA qué porción — eso es lo que fibrasDe() ya modela, y esto sólo lo
// resume como cubierto/falta.
import { fibrasDe } from './fibras.js';

/** Grupos donde hay evidencia real de que las porciones se distinguen entre
    sí. El vasto interno/externo del cuádriceps se dejó AFUERA a propósito:
    la evidencia (ver investigación citada arriba) dice que se activan de
    forma muy correlacionada en casi todos los ejercicios — no se aíslan uno
    del otro — así que ofrecer una cobertura ahí sería fabricar una
    distinción que la ciencia no respalda. */
export const FIBRAS_DEL_GRUPO = {
  Pecho: ['Clavicular', 'Costal'],
  Espalda: ['Dorsal alto', 'Dorsal bajo'],
  Tríceps: ['Tríceps cabeza larga', 'Tríceps'],
  Pierna: ['Femoral', 'Glúteo'],
};

/** De las fibras conocidas de `cat`, cuáles cubren los `nombres` de
    ejercicio elegidos y cuáles faltan. `null` si el grupo no tiene fibras
    distinguibles con evidencia real (ver FIBRAS_DEL_GRUPO). */
export function coberturaDe(cat, nombres) {
  const fibras = FIBRAS_DEL_GRUPO[cat];
  if (!fibras) return null;
  const cubiertas = new Set();
  for (const n of nombres || []) {
    const f = fibrasDe(n);
    if (!f) continue;
    [...f.p, ...(f.s || [])].forEach(x => { if (fibras.includes(x)) cubiertas.add(x); });
  }
  return {
    fibras,
    cubiertas: fibras.filter(f => cubiertas.has(f)),
    faltan: fibras.filter(f => !cubiertas.has(f)),
  };
}
