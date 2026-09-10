// El puente entre entrenar y comer.
//
// Hasta acá las dos mitades de FIERRO no se hablaban: el objetivo de calorías
// y macros era el MISMO todos los días —el día que hiciste piernas y el día
// que no te moviste—, y el único cruce que existía era un aviso de proteína
// que no proponía hacer nada. Enzo eligió explícitamente que FIERRO sea "el
// ciclo completo" (2026-09-10), así que esto es el primer puente real.
//
// LO QUE ESTO NO HACE, y es la parte importante: no inventa calorías. No
// estima cuánto quemaste (no hay forma honesta de hacerlo con tonelaje: el
// gasto de una sesión de fuerza es chico y muy variable, y poner un número
// ahí sería precisión disfrazada). Lo que hace es REDISTRIBUIR el mismo total
// semanal: más carbohidratos el día que entrenás, menos el día que no. La
// media de la semana queda intacta —hay un test que lo verifica sobre el
// reparto real de días— así que el déficit o superávit que elegiste en el
// perfil no se toca. Es un cambio de CUÁNDO, no de CUÁNTO.
//
// Por qué sólo los carbohidratos: la proteína no se cicla (el músculo la
// necesita igual el día de descanso, que es cuando de hecho se repara) y la
// grasa sostiene las hormonas. El carbohidrato es el macro que de verdad
// acompaña al trabajo: es el combustible del esfuerzo y el que repone
// glucógeno. Así que la proteína y la grasa quedan fijas y el carbo absorbe
// todo el vaivén.
import { S } from './state.js';
import { dstr } from './format.js';

/** Cuánto se estira el carbo del día de entrenamiento, como fracción. 0.25
    con la mitad de los días entrenados da ±12.5%: se nota en el plato sin
    volverse dos dietas distintas. Es una convención declarada, no un dato
    medido — por eso está acá arriba con nombre, y no escondida en una
    fórmula. */
const AMPLITUD = 0.25;

/** Días hacia atrás que se miran para saber cada cuánto entrenás de verdad.
    Dos semanas: suficiente para que una semana rara no domine, corto como
    para seguir un cambio de ritmo. */
const VENTANA = 14;

interface Sesion { date: string }
const sesiones = (): Sesion[] => S.sessions as Sesion[];

/** ¿Entrenaste ese día? Se responde con las sesiones REALES guardadas, no con
    lo que la rutina decía que tocaba: el plan es una intención y esto tiene
    que seguir los hechos. */
export function trainedOn(dateStr: string): boolean {
  return sesiones().some(s => s.date === dateStr);
}

/** Qué fracción de los últimos `dias` días entrenaste, entre 0 y 1.

    Devuelve `null` cuando la respuesta no significaría nada: sin historial
    suficiente, si nunca entrenaste en la ventana, o si entrenaste TODOS los
    días. Los dos extremos importan — sin un día de descanso contra el cual
    compararlo, "el día que entrenás" no es un día distinto de ningún otro, y
    no hay nada que ciclar. Siguiendo el criterio de la app: cuando falta el
    dato se dice, no se rellena con un promedio cómodo. */
export function trainingFraction(dias = VENTANA, hoy = dstr()): number | null {
  const todas = sesiones();
  if (!todas.length) return null;
  const fin = new Date(hoy + 'T12:00:00');
  const desde = new Date(+fin - (dias - 1) * 86400000);
  // Sin al menos una ventana entera de historial, la fracción diría más sobre
  // cuándo instalaste la app que sobre cómo entrenás.
  const masVieja = todas.reduce((a, s) => (s.date < a ? s.date : a), todas[0].date);
  if (new Date(masVieja + 'T12:00:00') > desde) return null;

  const conSesion = new Set<string>();
  for (const s of todas) {
    const d = new Date(s.date + 'T12:00:00');
    if (d >= desde && d <= fin) conSesion.add(s.date);
  }
  const f = conSesion.size / dias;
  if (f <= 0 || f >= 1) return null;
  return f;
}

export type TipoDeDia = 'entreno' | 'descanso';

export interface GoalsCiclados {
  kcal: number; p: number; c: number; f: number;
  tipo: TipoDeDia;
  /** Diferencia de carbohidratos contra el objetivo plano, en gramos con
      signo. Es lo que hace que el aviso sea accionable: "sumá 34 g" se puede
      ejecutar, "hoy comé más carbos" no. */
  deltaCarbs: number;
  /** Fracción de días entrenados que se usó para el reparto — se muestra para
      que el número no salga de una caja negra. */
  fraccion: number;
}

/** Los objetivos del día, ciclados según si ese día entrenaste o no.

    `null` significa "no hay con qué ciclar" y el llamador debe usar
    `S.cfg.goals` tal cual: sin objetivo de carbos, o sin un ritmo de
    entrenamiento del que hablar. Nunca devuelve un reparto inventado.

    La cuenta, y por qué la media semanal no se mueve: con `f` = fracción de
    días entrenados y `k` = AMPLITUD,

        día de entreno:   c × (1 + k·(1 − f))
        día de descanso:  c × (1 − k·f)

    El promedio pesado es f·(1 + k(1−f)) + (1−f)·(1 − k·f) = 1, exacto. Los
    dos términos de `k` se cancelan. Por eso el estiramiento del día de
    entreno depende de cuántos días de DESCANSO hay para compensarlo, y no al
    revés: si entrenás casi todos los días, casi no hay de dónde sacar. */
export function cycledGoals(dateStr = dstr(), hoy = dstr()): GoalsCiclados | null {
  const g = S.cfg.goals as { kcal: number; p: number; c: number; f: number } | undefined;
  if (!g || !(g.c > 0)) return null;
  /* La fracción se mide SIEMPRE desde hoy, aunque el día que se está mirando
     sea uno pasado. Al revés —recalculando la ventana desde cada fecha— dos
     días de la misma semana podían salir con ritmos distintos, y peor: al
     mirar hacia atrás la ventana se corría hasta un tramo sin sesiones, la
     fracción daba 0 y el ajuste desaparecía sin explicación. Lo que se
     pregunta acá es "cada cuánto entrenás", que es una propiedad tuya de
     ahora, no del día que estás mirando. */
  const f = trainingFraction(VENTANA, hoy);
  if (f == null) return null;

  const entreno = trainedOn(dateStr);
  const factor = entreno ? 1 + AMPLITUD * (1 - f) : 1 - AMPLITUD * f;
  const c = Math.round(g.c * factor);
  const deltaCarbs = c - g.c;
  return {
    // Sólo el carbo se mueve, así que la diferencia de calorías es
    // exactamente la de los carbos: 4 kcal por gramo. No se recalcula el
    // total desde cero para que no aparezcan diferencias de redondeo entre
    // el kcal mostrado y la suma de los macros mostrados.
    kcal: g.kcal + deltaCarbs * 4,
    p: g.p,
    f: g.f,
    c,
    tipo: entreno ? 'entreno' : 'descanso',
    deltaCarbs,
    fraccion: Math.round(f * 100) / 100,
  };
}

/** La frase que explica el ajuste, ya lista para mostrar. Se arma acá y no en
    el .jsx para que la lógica y su explicación no se separen: si mañana
    cambia la regla, el texto que la justifica cambia en el mismo lugar. */
export function cycleExplain(gc: GoalsCiclados): string {
  const dias = Math.round(gc.fraccion * VENTANA);
  if (gc.tipo === 'entreno') {
    return `Hoy entrenaste: +${gc.deltaCarbs} g de carbohidratos para reponer glucógeno. `
      + `Sale de los días que descansás (${VENTANA - dias} de los últimos ${VENTANA}), no de comer de más: `
      + `el total de la semana no cambia.`;
  }
  return `Hoy no entrenaste: ${gc.deltaCarbs} g de carbohidratos. `
    + `Esos gramos se mueven a los días que sí entrenás (${dias} de los últimos ${VENTANA}); `
    + `el total de la semana no cambia.`;
}
