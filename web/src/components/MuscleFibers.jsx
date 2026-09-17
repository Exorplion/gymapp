// Micro-silueta de fibras: al lado del encabezado de un grupo muscular en
// Entreno, dice SIN TEXTO qué porciones de ese músculo tocan los ejercicios
// elegidos. Enzo lo pidió así explícito: "que arriba en pecho diga como que
// partes del pecho se están trabajando... pero de manera creativa" — nombrar
// cada porción en el encabezado (pecho medio, superior...) es el ruido visual
// que quería evitar. El nombre sólo aparece al tocar.
//
// Antes esto dibujaba franjas abstractas (rectángulos apilados). Ahora usa la
// MISMA lámina anatómica que Silhouette/BodyMini (lib/bodydata.js, MuscleMap
// MIT). "Usa las curvas reales del pecho", como pidió Enzo.
//
// La lámina representa una porción de DOS formas distintas, y las dos cuentan
// como reales:
//   - PARCHE: una capa que MuscleMap dibuja ENCIMA de un músculo base para
//     resaltar una parte —clavicular/costal sobre el pecho entero, vasto
//     interno/externo sobre el cuádriceps. `parche: true`, `sub` propio.
//   - HERMANA: zonas del mismo `cat` que son regiones DISTINTAS del dibujo,
//     una al lado de la otra, sin que exista un "músculo entero" detrás para
//     resaltar sobre él — Trapecio, Dorsal alto y Dorsal bajo en Espalda son
//     las tres, juntas, la espalda completa; no hay una cuarta zona "espalda
//     base" debajo. `sub` propio, sin `parche`.
// Confundir los dos modelos rompía Espalda: tratarla como "necesita una base
// sin sub debajo" la dejaba sin nada que dibujar y el grupo se quedaba sin
// ícono a pesar de que fibras.js sí distingue Trapecio/Dorsal alto/Dorsal
// bajo con total honestidad.
//
// El puente con fibras.js es la MISMA coincidencia de string que ya usa
// BodyMini (ver `enciende()` ahí): lo que fibrasDe() devuelve como porción
// principal tiene que ser EXACTAMENTE el `sub` de una zona de bodydata.js.
//
// Un grupo cuya lámina no distingue ninguna porción —ni parche ni hermana—
// (Bíceps, Tríceps, Glúteo, Gemelos) no tiene nada honesto que resaltar:
// porcionesDe() devuelve [] y el componente no dibuja nada.
import { useState, useRef, useEffect } from 'react';
import { fibrasDe } from '../lib/fibras.js';
import { cuerpo } from '../lib/bodydata.js';
import { S } from '../lib/state.js';
import { popIn, D } from '../lib/motion.js';

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

/** Junta, para `cat`, las tres capas que puede tener en UNA cara —frente o
    espalda—:
      - `base`: zonas sin `sub` (el músculo entero, cuando existe uno).
      - `hermanas`: zonas con `sub` propio que NO son parche — regiones que
        entre todas ya arman el músculo completo (ver cabecera del archivo).
      - `parches`: zonas con `sub` propio y `parche: true` — capas que se
        dibujan encima de la base.
    Cuando el `cat` aparece en las dos caras (Espalda tiene un Trapecio
    "de adorno" asomando en el pecho, además del trío completo de espalda;
    Hombro tiene el deltoides liso de espalda además del frente con su
    parche), se elige la cara con MÁS subzonas reales (hermanas+parches): es
    la que tiene algo honesto para mostrar. Si ninguna cara distingue nada,
    devuelve `null`. */
function zonasDe(sexo, cat) {
  const { frente, espalda } = cuerpo(sexo);
  const armar = cara => {
    const zonas = cara.zonas.filter(z => z.cat === cat);
    if (!zonas.length) return null;
    const base = zonas.filter(z => z.sub === null);
    const hermanas = zonas.filter(z => z.sub !== null && !z.parche);
    const parches = zonas.filter(z => z.sub !== null && z.parche);
    return { cara, zonas, base, hermanas, parches, subs: hermanas.length + parches.length };
  };
  const candidatos = [armar(frente), armar(espalda)].filter(Boolean);
  if (!candidatos.length) return null;
  // sort() es estable: entre dos caras con el mismo conteo gana la primera
  // (frente), un desempate arbitrario pero determinístico.
  const elegido = candidatos.sort((a, b) => b.subs - a.subs)[0];
  return elegido.subs > 0 ? elegido : null;
}

/* Los nombres de sub-zona son los mismos en el cuerpo masculino y femenino
   (sólo cambian las coordenadas), así que para enumerar "qué porciones tiene
   esta categoría" alcanza con mirar un solo cuerpo — no hace falta saber el
   sexo real todavía. */
function subsDeCat(cat) {
  const grupo = zonasDe('m', cat);
  return grupo ? [...grupo.hermanas, ...grupo.parches].map(z => z.sub) : null;
}

/**
 * Qué porciones de `cat` trabajan `exercises`, con el volumen (series) de
 * cada una. Devuelve `[]` cuando no hay nada que distinguir honestamente:
 * lista vacía/undefined, ejercicios que fibrasDe() no reconoce, o un grupo
 * sin ninguna subzona real (ni parche ni hermana) en la lámina.
 *
 * Forma: `[{ sub, sets }]`, en el orden en que aparecen en bodydata.js (no
 * por volumen), para que el ícono no reordene sus piezas entre un render y
 * otro.
 */
export function porcionesDe(cat, exercises) {
  const subs = subsDeCat(cat);
  if (!subs || !subs.length) return [];
  const acc = new Map();
  for (const ex of exercises || []) {
    const fib = fibrasDe(ex);
    if (!fib) continue;
    for (const p of fib.p || []) {
      if (!subs.includes(p)) continue;
      acc.set(p, (acc.get(p) || 0) + volumenDe(ex));
    }
  }
  return subs.filter(s => acc.has(s)).map(sub => ({ sub, sets: acc.get(sub) }));
}

/** "clavicular y costal" — para el aria-label y para lo que se ve al tocar.
    Nunca lista una sola con "y" colgando. Va en minúscula porque acompaña al
    nombre del grupo ("Pecho: clavicular y costal"). */
function nombrarLista(nombres) {
  const m = nombres.map(n => n.toLowerCase());
  if (m.length <= 1) return m[0] || '';
  if (m.length === 2) return `${m[0]} y ${m[1]}`;
  return `${m.slice(0, -1).join(', ')} y ${m[m.length - 1]}`;
}

/* La lámina es estática (no cambia en tiempo de ejecución), así que la caja
   de cada grupo se mide UNA sola vez por sexo+categoría y se guarda acá. Sin
   esto, cada Entreno con varios grupos abiertos remediría lo mismo una y
   otra vez con un <svg> oculto montado y desmontado. */
const cacheCajas = new Map();

/** Mide, con `getBBox()`, la caja que ocupa TODA la categoría —base, hermanas
    y parches por igual— sobre el lienzo entero de la lámina. Tiene que ser
    el conjunto completo: en Espalda no hay `base`, así que si sólo se
    midieran las hermanas trabajadas hoy el encuadre cambiaría de tamaño
    ejercicio a ejercicio, y la caja tiene que ser la del grupo entero, fijo,
    no la de lo que está encendido.
    Es lo que permite "acercar" el viewBox al músculo sin hardcodear
    coordenadas a ojo —el pecho no está en el mismo lugar en el cuerpo
    masculino que en el femenino, y a mano se desactualizaría en cuanto
    alguien regenere bodydata.js.
    Si no se puede medir (SSR, jsdom sin getBBox real) devuelve `null`: el
    llamador cae al viewBox completo de la cara en vez de dibujar algo
    torcido con números inventados. */
function cajaDe(sexo, cat, grupo) {
  const key = `${sexo}:${cat}`;
  if (cacheCajas.has(key)) return cacheCajas.get(key);
  let caja = null;
  if (typeof document !== 'undefined') {
    try {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', grupo.cara.viewBox);
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
      const g = document.createElementNS(NS, 'g');
      for (const z of grupo.zonas) {
        for (const d of z.d) {
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', d);
          g.appendChild(p);
        }
      }
      svg.appendChild(g);
      document.body.appendChild(svg);
      const r = g.getBBox();
      document.body.removeChild(svg);
      if (r && r.width > 0 && r.height > 0) caja = { x: r.x, y: r.y, width: r.width, height: r.height };
    } catch {
      caja = null;
    }
  }
  cacheCajas.set(key, caja);
  return caja;
}

export default function MuscleFibers({ cat, exercises }) {
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef(null);
  const porciones = porcionesDe(cat, exercises);

  useEffect(() => { if (abierto) popIn(panelRef.current, { scale: 0.92, duration: D.toque }); }, [abierto]);

  // Nada que distinguir: no se dibuja ni un placeholder vacío. La ausencia de
  // dato no se rellena con un ícono apagado.
  if (!porciones.length) return null;

  const sexo = S.cfg.bodySex || S.cfg.profile?.sex;
  const grupo = zonasDe(sexo, cat);
  // No debería pasar —porcionesDe ya exige subzonas reales— pero si algo
  // cambia bodydata.js sin sincronizar, mejor no dibujar nada que dibujar a
  // ciegas.
  if (!grupo) return null;

  const caja = cajaDe(sexo, cat, grupo);
  const viewBox = caja ? `${caja.x} ${caja.y} ${caja.width} ${caja.height}` : grupo.cara.viewBox;

  const maxSets = Math.max(...porciones.map(p => p.sets));
  const nombres = porciones.map(p => p.sub);
  const texto = `${cat}: ${nombrarLista(nombres)}`;
  const encontrada = sub => porciones.find(p => p.sub === sub);
  const intensidad = sets => 0.35 + 0.65 * (sets / maxSets);

  return (
    <span className="mfibras-wrap">
      <button
        type="button"
        className="mfibras-btn"
        aria-label={texto}
        aria-expanded={abierto}
        onClick={() => setAbierto(v => !v)}
      >
        <svg viewBox={viewBox} width="28" height="32" className="mfibras-svg" aria-hidden="true">
          {/* Músculo base, apagado: es el contexto sobre el que se resalta la
              porción entrenada, no una selección en sí mismo. Grupos sin
              base (Espalda: las hermanas YA son el músculo completo) no
              dibujan nada acá. */}
          <g className="mfibras-off">
            {grupo.base.map((z, i) => z.d.map((d, j) => <path key={`b${i}.${j}`} d={d} />))}
          </g>
          {/* Hermanas: regiones propias que entre todas arman el músculo
              completo (Espalda: Trapecio/Dorsal alto/Dorsal bajo). A
              diferencia de un parche, SIEMPRE se dibujan aunque no estén
              entrenadas —si no, un grupo con dos de tres encendidas se vería
              como un músculo mutilado en vez de parcialmente entrenado. */}
          {grupo.hermanas.map((z, i) => {
            const p = encontrada(z.sub);
            return (
              <g
                key={`h${i}`}
                className={p ? 'mfibras-on' : 'mfibras-off'}
                style={p ? { fillOpacity: intensidad(p.sets) } : undefined}
              >
                {z.d.map((d, j) => <path key={j} d={d} />)}
              </g>
            );
          })}
          {/* Parches ENCIMA del músculo base, en el mismo orden en que
              MuscleMap los dibuja. Sólo se pinta el que de verdad se entrenó
              —uno sin entrenar no aparece, ni siquiera apagado: encimarlo
              sobre el base ya apagado no suma nada y sólo agrega trazos. */}
          {grupo.parches.map((z, i) => {
            const p = encontrada(z.sub);
            if (!p) return null;
            return (
              <g key={`p${i}`} className="mfibras-on" style={{ fillOpacity: intensidad(p.sets) }}>
                {z.d.map((d, j) => <path key={j} d={d} />)}
              </g>
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
