// Pictogramas de ejercicios: la persona y su aparato, al costado de cada
// tarjeta en Hoy y en Rutina.
//
// Por qué no las fotos que ya teníamos: las de free-exercise-db son fotos de
// gente en un gimnasio. Sirven para el detalle del ejercicio —"¿cómo se hace
// esto?"— pero a 34 px, en una lista que estás recorriendo con el pulgar entre
// serie y serie, una foto es una mancha. Un pictograma se reconoce de un
// vistazo. Conviven: la foto sigue en la ficha del ejercicio.
//
// Se dibujan a mano y acá sí funciona, al revés de lo que pasó con la lámina
// anatómica. La diferencia es que esto es geometría y aquello era anatomía: una
// banca es un rectángulo y una barra es una línea con dos discos, mientras que
// un dorsal no es ninguna forma que se pueda nombrar. Dibujar a ciegas sirve
// para lo primero y no para lo segundo.
//
// Todo es trazo con puntas redondeadas sobre un lienzo de 48×48, con el piso a
// la altura 42. El cuerpo usa currentColor, así que hereda el color de la
// tarjeta; el aparato va en un tono apagado para que la persona sea lo que se
// lee primero.

/* Primitivas. La barra y la mancuerna aparecen en media docena de dibujos, así
   que se definen una vez: si cambia el grosor de los discos, cambia en todas. */

/* Las coordenadas se fuerzan a número antes de cualquier cuenta.
   Si llegan como cadena —y en JSX `x="14"` es una cadena— el `+` concatena en
   vez de sumar: "15" + 3.4 da "153.4", y el trazo se va a 153 en un lienzo de
   48. La resta no falla porque `-` sí fuerza a número, así que el dibujo se
   estiraba sólo hacia abajo y costaba verlo venir. */
const N = v => Number(v);

/** Barra con sus discos. Horizontal por defecto. */
const Barra = ({ x1, x2, y, disco = 3.4 }) => {
  const a = N(x1), b = N(x2), c = N(y), d = N(disco);
  return (
    <g className="exi-e">
      <line x1={a} y1={c} x2={b} y2={c} />
      <line x1={a + 2} y1={c - d} x2={a + 2} y2={c + d} strokeWidth="2.6" />
      <line x1={b - 2} y1={c - d} x2={b - 2} y2={c + d} strokeWidth="2.6" />
    </g>
  );
};

/** Mancuerna cortita, para cuando el peso va en una mano. */
const Mancuerna = ({ x, y, r = 3 }) => {
  const a = N(x), b = N(y), c = N(r);
  return <line className="exi-e" x1={a} y1={b - c} x2={a} y2={b + c} strokeWidth="3.4" />;
};

/** Banca. `inc` la inclina, para el press inclinado. */
const Banca = ({ x1 = 9, x2 = 39, y = 28, inc = 0 }) => {
  const a = N(x1), b = N(x2), c = N(y), i = N(inc);
  return (
    <g className="exi-e">
      <line x1={a} y1={c + i} x2={b} y2={c} />
      <line x1={a + 3} y1={c + i} x2={a + 3} y2={42} />
      <line x1={b - 3} y1={c} x2={b - 3} y2={42} />
    </g>
  );
};

/** Torre de polea: el poste y el cable. */
const Polea = ({ x = 40, desde = 8, hasta = 20 }) => {
  const a = N(x);
  return (
    <g className="exi-e">
      <line x1={a} y1={6} x2={a} y2={42} />
      <line x1={a} y1={N(desde)} x2={a - 6} y2={N(hasta)} strokeWidth="1.6" />
    </g>
  );
};

const Cabeza = ({ cx, cy, r = 3.3 }) => <circle className="exi-h" cx={cx} cy={cy} r={r} />;

/** El cuerpo: una polilínea gruesa. */
const C = ({ d }) => <path className="exi-b" d={d} />;

const Piso = () => <line className="exi-p" x1="5" y1="42" x2="43" y2="42" />;

/* ---------- los dibujos ----------
   Cada uno es la persona en el momento más reconocible del movimiento: el
   press banca acostado con la barra arriba, la sentadilla abajo, el curl con
   el codo cerrado. Un pictograma en la posición neutra no se distinguiría del
   de al lado. */
const DIBUJOS = {
  banca: () => (<>
    <Banca />
    <Cabeza cx="13" cy="24" />
    <C d="M17,25 H30 l5,4 l3,7" />
    <C d="M21,25 V17" /><C d="M27,25 V17" />
    <Barra x1="14" x2="34" y="15" />
  </>),

  inclinado: () => (<>
    <Banca inc={9} />
    <Cabeza cx="30" cy="21" />
    <C d="M27,23 L17,32 l-2,8" />
    <C d="M28,25 L24,16" /><C d="M31,25 L34,16" />
    <Barra x1="19" x2="39" y="14" />
  </>),

  aperturas: () => (<>
    <Cabeza cx="24" cy="11" />
    <C d="M24,15 V27 M24,27 l-4,13 M24,27 l4,13" />
    <C d="M24,18 L14,15 M24,18 L34,15" />
    <Mancuerna x="13" y="15" /><Mancuerna x="35" y="15" />
  </>),

  fondos: () => (<>
    <g className="exi-e"><line x1="10" y1="18" x2="10" y2="42" /><line x1="38" y1="18" x2="38" y2="42" />
      <line x1="6" y1="18" x2="14" y2="18" /><line x1="34" y1="18" x2="42" y2="18" /></g>
    <Cabeza cx="24" cy="14" />
    <C d="M24,18 V29 M24,29 l-3,9 M24,29 l4,8" />
    <C d="M24,20 L12,18 M24,20 L36,18" />
  </>),

  dominadas: () => (<>
    <g className="exi-e"><line x1="8" y1="9" x2="40" y2="9" /><line x1="24" y1="9" x2="24" y2="5" /></g>
    <Cabeza cx="24" cy="17" />
    <C d="M24,21 V31 M24,31 l-4,9 M24,31 l4,6" />
    <C d="M18,10 L21,19 M30,10 L27,19" />
  </>),

  jalon: () => (<>
    <Polea x={40} desde={9} hasta={12} />
    <Barra x1="14" x2="34" y="13" />
    <Cabeza cx="21" cy="21" />
    <C d="M21,25 V32 H31 l4,6" />
    <C d="M18,14 L20,22 M27,14 L24,22" />
    <line className="exi-e" x1="14" y1="32" x2="26" y2="32" />
  </>),

  remo: () => (<>
    <Cabeza cx="12" cy="16" />
    <C d="M15,18 H26 l2,10 l-1,12" />
    <C d="M20,19 V28" />
    <Barra x1="11" x2="29" y="29" />
  </>),

  remopolea: () => (<>
    <Polea x={41} desde={20} hasta={22} />
    <Cabeza cx="16" cy="18" />
    <C d="M16,22 V29 H28 l6,3" />
    <C d="M18,24 L34,22" />
    <Barra x1="32" x2="38" y="22" disco={2.6} />
    <line className="exi-e" x1="10" y1="29" x2="22" y2="29" />
  </>),

  pesomuerto: () => (<>
    <Cabeza cx="15" cy="14" />
    <C d="M18,16 H26 l1,12 l-1,12" />
    <C d="M21,17 V30" />
    <Barra x1="11" x2="31" y="31" />
    <Piso />
  </>),

  militar: () => (<>
    <Cabeza cx="24" cy="17" />
    <C d="M24,21 V29 M24,29 l-4,11 M24,29 l4,11" />
    <C d="M24,23 L18,13 M24,23 L30,13" />
    <Barra x1="14" x2="34" y="11" />
  </>),

  lateral: () => (<>
    <Cabeza cx="24" cy="12" />
    <C d="M24,16 V28 M24,28 l-4,12 M24,28 l4,12" />
    <C d="M24,19 L13,17 M24,19 L35,17" />
    <Mancuerna x="12" y="17" /><Mancuerna x="36" y="17" />
  </>),

  pajaro: () => (<>
    <Cabeza cx="13" cy="17" />
    <C d="M16,19 H27 l2,9 l-1,12" />
    <C d="M20,20 L14,28 M20,20 L27,28" />
    <Mancuerna x="13" y="29" /><Mancuerna x="28" y="29" />
  </>),

  curl: () => (<>
    <Cabeza cx="24" cy="12" />
    <C d="M24,16 V28 M24,28 l-4,12 M24,28 l4,12" />
    <C d="M20,19 L18,24 L23,22 M28,19 L30,24 L25,22" />
    <Barra x1="15" x2="33" y="22" disco={2.8} />
  </>),

  pushdown: () => (<>
    <Polea x={40} desde={9} hasta={16} />
    <Cabeza cx="20" cy="13" />
    <C d="M20,17 V29 M20,29 l-3,11 M20,29 l4,11" />
    <C d="M20,20 L27,17 L30,24" />
    <Barra x1="27" x2="34" y="24" disco={2.4} />
  </>),

  sobrecabeza: () => (<>
    <Cabeza cx="22" cy="17" />
    <C d="M22,21 V30 M22,30 l-4,10 M22,30 l4,10" />
    <C d="M22,23 L29,15 L24,10 M22,23 L15,15 L20,10" />
    <Mancuerna x="22" y="9" r={4} />
  </>),

  sentadilla: () => (<>
    <Cabeza cx="22" cy="16" />
    <C d="M22,20 V27 M22,27 l7,6 l-3,7 M22,27 l-5,7 l1,6" />
    <C d="M16,15 H29" />
    <Barra x1="12" x2="34" y="15" />
    <Piso />
  </>),

  prensa: () => (<>
    <g className="exi-e"><line x1="12" y1="38" x2="34" y2="16" /><line x1="30" y1="10" x2="40" y2="20" strokeWidth="3" /></g>
    <Cabeza cx="12" cy="30" />
    <C d="M15,31 H24 l7,-6" />
    <Piso />
  </>),

  legext: () => (<>
    <g className="exi-e"><line x1="10" y1="26" x2="24" y2="26" /><line x1="12" y1="26" x2="12" y2="40" /><line x1="14" y1="18" x2="14" y2="26" /></g>
    <Cabeza cx="15" cy="15" />
    <C d="M15,19 V25 H26 l8,-5" />
    <Mancuerna x="34" y="20" />
  </>),

  legcurl: () => (<>
    <g className="exi-e"><line x1="9" y1="28" x2="33" y2="28" /><line x1="12" y1="28" x2="12" y2="40" /><line x1="30" y1="28" x2="30" y2="40" /></g>
    <Cabeza cx="11" cy="24" />
    <C d="M15,26 H30 l4,-7" />
    <Mancuerna x="34" y="18" />
  </>),

  zancada: () => (<>
    <Cabeza cx="22" cy="13" />
    <C d="M22,17 V27" />
    <C d="M22,27 l8,6 v7 M22,27 l-7,6 l-1,7" />
    <Mancuerna x="15" y="24" /><Mancuerna x="29" y="24" />
    <Piso />
  </>),

  hipthrust: () => (<>
    <Banca x1={7} x2={20} y={26} />
    <Cabeza cx="11" cy="22" />
    <C d="M14,24 L24,26 h8 l4,10" />
    <Barra x1="22" x2="34" y="21" disco={3} />
    <Piso />
  </>),

  gemelos: () => (<>
    <Cabeza cx="24" cy="13" />
    <C d="M24,17 V28 M24,28 l-3,8 l-3,2 M24,28 l3,8 l3,2" />
    <Mancuerna x="17" y="24" /><Mancuerna x="31" y="24" />
    <g className="exi-e"><line x1="12" y1="38" x2="36" y2="38" /><line x1="12" y1="38" x2="12" y2="42" /><line x1="36" y1="38" x2="36" y2="42" /></g>
  </>),

  abs: () => (<>
    <Cabeza cx="14" cy="24" />
    <C d="M17,26 q7,2 9,7 M26,33 l7,-2 M26,33 l3,8" />
    <Piso />
  </>),

  rueda: () => (<>
    <Cabeza cx="17" cy="22" />
    <C d="M20,24 L28,30 l6,4 M20,24 L14,32" />
    <circle className="exi-e" cx="36" cy="36" r="4.5" />
    <Piso />
  </>),

  aductor: () => (<>
    <g className="exi-e"><line x1="16" y1="24" x2="32" y2="24" /><line x1="24" y1="24" x2="24" y2="16" /></g>
    <Cabeza cx="24" cy="12" />
    <C d="M24,23 l-8,9 M24,23 l8,9" />
    <g className="exi-e"><line x1="13" y1="30" x2="13" y2="38" /><line x1="35" y1="30" x2="35" y2="38" /></g>
  </>),

  backext: () => (<>
    {/* el banco a 45°, que es lo que distingue este de una plancha */}
    <g className="exi-e">
      <line x1="13" y1="39" x2="31" y2="21" />
      <line x1="23" y1="29" x2="23" y2="42" />
      <line x1="30" y1="36" x2="37" y2="36" />
    </g>
    <Cabeza cx="14" cy="19" />
    <C d="M17,21 L26,29 l5,8" />
  </>),

  /** Sin patrón reconocido: una mancuerna, honesta y neutra. */
  generico: () => (<>
    <g className="exi-e">
      <line x1="14" y1="24" x2="34" y2="24" />
      <line x1="14" y1="18" x2="14" y2="30" strokeWidth="3.6" />
      <line x1="34" y1="18" x2="34" y2="30" strokeWidth="3.6" />
    </g>
  </>),
};

/**
 * El pictograma de un ejercicio.
 *
 * `icono` es la clave que devuelve iconOf() (lib/exicon.js). Si no se
 * reconoce, cae en el genérico en vez de dejar un hueco: una tarjeta sin dibujo
 * al lado de otras que sí lo tienen se ve rota, no vacía.
 */
export default function ExIcon({ icono, size = 34, className = '' }) {
  const Dibujo = DIBUJOS[icono] || DIBUJOS.generico;
  return (
    <svg
      className={`exi ${className}`}
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <Dibujo />
    </svg>
  );
}
