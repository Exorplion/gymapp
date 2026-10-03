// Textos de la portada (Inicio.jsx, 2026-10-01): cómo se nombra cada zona en
// una frase y cómo se abrevia un turno para que entre en un día de la tira.
import { dstr } from './format.js';

/** Cómo se dice cada grupo/zona dentro de una frase ("Pecho, hombros y tríceps"). */
export const LLANO = {
  Pecho: 'pecho', Espalda: 'espalda', Lumbares: 'lumbares', Hombro: 'hombros', Bíceps: 'bíceps', Tríceps: 'tríceps',
  Pierna: 'piernas', Cuádriceps: 'cuádriceps', Femoral: 'femoral', Glúteo: 'glúteos', Gemelos: 'gemelos', Abs: 'abdomen',
};

export const capital = t => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** Una zona sola, con mayúscula: "Hombros", "Abdomen". */
export const nombreZona = z => capital(LLANO[z] || z);

const DIA = 86400000;
/** Días enteros entre `fecha` y `hoy` (nunca negativo). */
export const diasDesde = (fecha, hoy = dstr()) =>
  Math.max(0, Math.round((new Date(hoy + 'T12:00:00') - new Date(fecha + 'T12:00:00')) / DIA));
/** "hoy", "ayer", "hace 3 días". */
export const haceTexto = (fecha, hoy = dstr()) => {
  const d = diasDesde(fecha, hoy);
  return d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
};

/** "a", "a y b", "a, b y c". */
export const frase = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** "Anterior A" → "Ant A", "Posterior B" → "Post B", "Empuje" → "Emp": la
    primera palabra hasta el final de su primera sílaba trabada (máx. 4
    letras) y la última palabra si es una letra o número. Entra en los ~48 px
    de un día de la tira. */
export function abreviar(nombre) {
  const ps = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!ps.length) return '';
  const w = ps[0];
  const voc = c => /[aeiouáéíóú]/i.test(c);
  let i = 0;
  while (i < w.length && !voc(w[i])) i++;
  while (i < w.length && voc(w[i])) i++;
  while (i < w.length && !voc(w[i])) i++;
  const corta = w.slice(0, Math.max(1, Math.min(4, i)));
  const ult = ps.length > 1 && ps[ps.length - 1].length <= 2 ? ` ${ps[ps.length - 1]}` : '';
  return corta + ult;
}
