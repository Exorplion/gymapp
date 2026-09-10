// La semana en curso, por FECHA REAL.
//
// Hay una decisión vieja en el código —escrita en el encabezado de Inicio.jsx—
// que dice que un calendario por día de la semana "mentiría sobre cómo
// funciona la app", porque la rutina de FIERRO no vive en casilleros lun-dom:
// es una SECUENCIA de largo variable que avanza sólo cuando entrenás. Esa
// decisión sigue siendo correcta **para el plan**, y por eso la tira de turnos
// de Inicio no se toca.
//
// Lo que hay acá es otra cosa: no el plan, los HECHOS. Qué días de esta semana
// entrenaste de verdad, según las sesiones guardadas, que tienen fecha real.
// Un calendario de lo que pasó no pretende que el plan viva en casilleros; sólo
// muestra el calendario en el que vivís vos. Enzo lo pidió con el caso exacto
// que lo destapa: "esta semana no inicié el lunes, inicié el martes y el
// miércoles descansé" — y la app mostraba el turno 1 en la primera posición,
// que se lee como lunes.
import { S } from './state.js';
import { dstr, WDS } from './format.js';

interface Sesion { id: string; date: string; slotId?: string; dayName?: string }

export interface DiaSemana {
  /** 'YYYY-MM-DD' */
  fecha: string;
  /** 'Lun', 'Mar'… ya listo para pintar. */
  etiqueta: string;
  /** Día del mes. */
  numero: number;
  esHoy: boolean;
  /** Un día que todavía no llegó: no es "no entrenaste", es "todavía no". La
      distinción importa — pintarlo igual que un día vacío del pasado sería
      afirmar algo sobre el futuro. */
  esFuturo: boolean;
  /** Las sesiones de ese día. Vacío = ese día no hay ninguna registrada. */
  sesiones: Sesion[];
}

/** El lunes de la semana de `fecha`. La semana arranca el lunes porque es el
    orden en que la app ya muestra los días en todos lados (WEEK_ORDER). */
export function lunesDe(fecha = dstr()): Date {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Los siete días de la semana de `hoy`, de lunes a domingo, cada uno con las
    sesiones que de verdad se registraron ese día. */
export function semanaDe(hoy = dstr()): DiaSemana[] {
  const lunes = lunesDe(hoy);
  const porFecha = new Map<string, Sesion[]>();
  for (const s of S.sessions as Sesion[]) {
    if (!porFecha.has(s.date)) porFecha.set(s.date, []);
    porFecha.get(s.date)!.push(s);
  }
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(+lunes + i * 86400000);
    const fecha = dstr(d);
    return {
      fecha,
      etiqueta: WDS[d.getDay()],
      numero: d.getDate(),
      esHoy: fecha === hoy,
      esFuturo: fecha > hoy,
      sesiones: porFecha.get(fecha) || [],
    };
  });
}

/** Los días PASADOS de esta semana sin ninguna sesión registrada, del más
    reciente al más viejo. Es la lista de "¿entrenaste ese día y no lo
    anotaste?" — nada más que eso: un día vacío no significa que hayas
    entrenado, significa que la app no sabe. Por eso se pregunta en vez de
    asumir en cualquiera de las dos direcciones. */
export function diasSinRegistro(hoy = dstr()): DiaSemana[] {
  return semanaDe(hoy).filter(d => !d.esFuturo && !d.esHoy && !d.sesiones.length).reverse();
}
