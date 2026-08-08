// Las dos siluetas de la pantalla de inicio: frente y espalda, con cada grupo
// muscular coloreado según hace cuántos días lo entrenaste, y tocable.
//
// La geometría NO se dibuja acá: viene de lib/bodydata.js, que es una lámina
// anatómica hecha por un diseñador. Lo que sí es de FIERRO es cómo se ve, y son
// tres capas por cuerpo:
//
//   1. masa   — los mismos polígonos, oscuros y engordados con un stroke
//               grueso. Une los músculos por debajo, así los huecos entre ellos
//               leen como surcos de un cuerpo y no como agujeros al fondo.
//   2. músculo— cada grupo con el degradado de su estado. El degradado va por
//               músculo, no por cuerpo: es lo que los hace parecer inflados.
//   3. luz    — una sola fuente arriba a la izquierda sobre TODO el cuerpo, en
//               coordenadas del SVG. Sin esta capa cada músculo se ilumina por
//               su cuenta y el conjunto se ve facetado, como vidrio roto.
//
// Cada grupo es un <g> con la clase de estado encima. `fill` y `stroke` se
// heredan a los polígonos de adentro, así que el estado se pinta una vez y el
// glow se aplica al grupo entero en lugar de a cada pieza.
//
// Este componente no calcula estadísticas: pide groupStats() cuando tocás.
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cuerpo, adaptarTrazo } from '../lib/bodydata.js';
import { groupStats, diasTexto } from '../lib/muscle.js';
import { vibrate } from '../lib/format.js';
import { S } from '../lib/state.js';
import MusclePop from './MusclePop.jsx';

const ANCHO_POP = 208;

/** Días → clase de color.

    `null` (nunca entrenado) se pinta neutro y callado: no es lo mismo que
    "hace mucho", y marcarlo sería gritarle a alguien recién llegado por algo
    que todavía no hizo mal. */
function tono(d) {
  if (d === null || d === undefined) return 'sil-none';
  if (d <= 1) return 'sil-d0';
  if (d <= 3) return 'sil-d1';
  if (d <= 6) return 'sil-d2';
  return 'sil-d3';
}

/* El pelo.

   La proporción sola no alcanzaba para distinguir los dos cuerpos: a 170 px de
   ancho, hombros y cadera se leen sólo si tenés los dos al lado. El pelo se ve
   de una.

   No sale de bodydata.js porque la lámina anatómica no trae cabello — la cabeza
   ahí es un polígono liso (y 0-25, x 40-59). Se dibuja acá encima.

   El casquete se dibuja MÁS GRANDE que el cráneo a propósito y después se
   recorta contra él: así su borde exterior es exactamente el del hueso. Es lo
   que hace que se lea como pelo del personaje y no como una calcomanía pegada
   encima — que era el problema de la primera versión. Lo único que queda fuera
   del recorte son las mechas largas, porque el pelo sí sobresale de la cabeza. */
const PELO = {
  m: clip => (
    <path
      clipPath={clip}
      d="M36,15 C36,3 42,-3 49.5,-3 C57,-3 63,3 63,15
         C58,9.5 54,7.6 49.5,7.6 C45,7.6 41,9.5 36,15 Z"
    />
  ),
  f: clip => (
    <>
      <path
        clipPath={clip}
        d="M35,16 C35,2.5 41.5,-4 49.5,-4 C57.5,-4 64,2.5 64,16
           C58.5,10 54,7.8 49.5,7.8 C45,7.8 40.5,10 35,16 Z"
      />
      {/* Las mechas que caen al costado de la cara. Salen del borde del cráneo,
          se abren apenas y terminan en punta sobre el cuello. Rectas y anchas
          —como estaban— formaban dos barras y el conjunto se leía como un
          bloque, no como pelo. */}
      <path d="M40.6,9 C38.7,14 38.5,20.5 39.9,27
               C41.1,23 41.4,16.5 43.1,10.5 Z" />
      <path d="M58.4,9 C60.3,14 60.5,20.5 59.1,27
               C57.9,23 57.6,16.5 55.9,10.5 Z" />
    </>
  ),
};

/** El polígono de la cabeza, para recortar el casquete contra el cráneo.

    Se busca en vez de escribirlo a mano porque el modelo femenino deforma las
    coordenadas: copiarlas dejaría el recorte desalineado en uno de los dos. */
function craneoDe(zonas) {
  for (const z of zonas) {
    if (z.cat) continue;
    for (const p of z.pts) {
      const n = p.split(' ').map(Number);
      let maxY = -Infinity;
      for (let i = 1; i < n.length; i += 2) maxY = Math.max(maxY, n[i]);
      if (maxY < 40) return p;
    }
  }
  return null;
}

/* Detalle anatómico.

   La lámina trae los músculos como bloques, y a algunos les falta el corte que
   uno reconoce: el recto abdominal viene en DOS columnas enteras —de ahí que
   los abs se vieran planos—, el dorsal no se separa del redondo mayor, y los
   erectores no tienen surco.

   Esto es lo único que se dibuja a mano en el cuerpo, y funciona porque no está
   inventando anatomía: son cortes sobre formas que ya están bien puestas. Las
   coordenadas salen de medir los polígonos reales, no de suponerlas.

   Las columnas del recto van de y 57 a 107, x 40.8-49.0 y 50.6-58.4. */
const DETALLE = {
  frente: [
    // los cortes del recto abdominal, tres por lado: el six-pack
    '41.4 66.2 44.8 67.2 48.3 66.3', '51.3 66.3 54.6 67.2 58.1 66.2',
    '41.2 75.4 44.8 76.4 48.4 75.5', '51.2 75.5 54.7 76.4 58.3 75.4',
    '41.4 84.4 44.9 85.4 48.5 84.5', '51.1 84.5 54.7 85.4 58.4 84.4',
    // el borde del haz clavicular del pectoral
    '31.6 47.4 39.5 49.4 47.4 47.8', '52.6 47.8 60.5 49.4 68.4 47.4',
  ],
  espalda: [
    // el surco de los erectores, a los lados de la columna
    '48.4 74.5 47.9 87 48.6 100', '51.6 74.5 52.1 87 51.4 100',
    // el redondo mayor, que la lámina deja pegado al dorsal
    '33.2 45.5 38.6 48.6 44.2 52.6', '66.8 45.5 61.4 48.6 55.8 52.6',
    // el pico inferior del trapecio
    '38.6 50.5 50 62.5 61.4 50.5',
  ],
};

function Cara({ zonas, days, etiqueta, sel, onPick, pelo, detalle, craneo, id }) {
  return (
    <div className="sil-box">
      <svg viewBox="0 0 100 200" role="group" aria-label={`Músculos: ${etiqueta}`}>
        <g className="sil-masa">
          {zonas.map((z, i) => z.pts.map((p, j) => <polygon key={`${i}.${j}`} points={p} />))}
        </g>

        {zonas.map((z, i) => {
          const pol = z.pts.map((p, j) => <polygon key={j} points={p} />);
          if (!z.cat) return <g key={i} className="sil-z sil-neutro">{pol}</g>;
          const activo = sel === z.cat;
          return (
            <g
              key={i}
              className={`sil-z sil-tap ${tono(days[z.cat])} ${activo ? 'sil-sel' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${z.cat}, ${diasTexto(days[z.cat])}. Ver estadísticas.`}
              aria-pressed={activo}
              onClick={e => onPick(z.cat, e.currentTarget)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(z.cat, e.currentTarget); }
              }}
            >
              {pol}
            </g>
          );
        })}

        <g className="sil-detalle">
          {detalle.map((d, i) => <polyline key={i} points={d} />)}
        </g>

        {/* El casquete se recorta contra el cráneo: así su borde ES el del
            hueso y no puede leerse como una figura pegada encima. Las mechas
            largas quedan afuera a propósito — el pelo sí sobresale. */}
        {craneo && (
          <clipPath id={`sil-craneo-${id}`}><polygon points={craneo} /></clipPath>
        )}
        <g className="sil-pelo">
          {(PELO[pelo] || PELO.m)(craneo ? `url(#sil-craneo-${id})` : undefined)}
        </g>

        <g className="sil-luz">
          {zonas.map((z, i) => z.pts.map((p, j) => <polygon key={`${i}.${j}`} points={p} />))}
        </g>
      </svg>
      <span>{etiqueta}</span>
    </div>
  );
}

export default function Silhouette({ days = {} }) {
  const [sel, setSel] = useState(null);   // { cat, x, y, arriba }
  const caja = useRef(null);

  // `bodySex` es el ajuste explícito de Ajustes; si nunca se tocó, hereda el
  // sexo del perfil para que quien ya lo cargó no tenga que elegir dos veces.
  // Van separados porque el del perfil existe para calcular calorías: unirlos
  // obligaría a mentir en uno para arreglar el otro.
  const sexo = S.cfg.bodySex || S.cfg.profile?.sex;
  const { frente, espalda } = cuerpo(sexo);
  const pelo = sexo === 'f' ? 'f' : 'm';
  // el detalle se deforma con el cuerpo, o quedaría corrido en el femenino
  const det = useMemo(() => ({
    frente: DETALLE.frente.map(d => adaptarTrazo(d, sexo)),
    espalda: DETALLE.espalda.map(d => adaptarTrazo(d, sexo)),
  }), [sexo]);

  const cerrar = useCallback(() => setSel(null), []);

  // Escape cierra. Se registra sólo mientras hay algo abierto.
  useEffect(() => {
    if (!sel) return;
    const h = e => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sel, cerrar]);

  /** Ancla el globo al músculo tocado, en coordenadas de la caja.

      Se mide con getBoundingClientRect y no con el bbox del SVG porque el SVG
      escala: el bbox está en unidades del viewBox y acá hacen falta píxeles.

      El globo va debajo del músculo, salvo que no entre — entonces va arriba.
      Y se recorta a los bordes de la caja para que nunca se salga por un
      costado. */
  const tocar = (cat, el) => {
    if (sel?.cat === cat) return cerrar();
    const c = caja.current?.getBoundingClientRect();
    const m = el.getBoundingClientRect();
    if (!c) return;
    const cx = m.left + m.width / 2 - c.left;
    const media = ANCHO_POP / 2;
    const abajo = m.bottom - c.top + 8;
    const arriba = abajo + 190 > c.height;
    vibrate(8);
    setSel({
      cat,
      x: Math.max(media + 2, Math.min(cx, c.width - media - 2)),
      y: arriba ? m.top - c.top - 8 : abajo,
      arriba,
    });
  };

  return (
    <div className="sil-pair" ref={caja}>
      <Cara
        zonas={frente} days={days} etiqueta="Frente" sel={sel?.cat} onPick={tocar}
        pelo={pelo} detalle={det.frente} craneo={craneoDe(frente)} id="f"
      />
      <Cara
        zonas={espalda} days={days} etiqueta="Espalda" sel={sel?.cat} onPick={tocar}
        pelo={pelo} detalle={det.espalda} craneo={craneoDe(espalda)} id="b"
      />

      {sel && (
        <>
          <button type="button" className="sil-tapa" onClick={cerrar} aria-label="Cerrar estadísticas" />
          <MusclePop stats={groupStats(sel.cat)} pos={sel} onClose={cerrar} />
        </>
      )}

      {/* Degradados y filtro, una sola vez para las dos caras. */}
      <svg width="0" height="0" className="sil-defs" aria-hidden="true"><defs>
        <linearGradient id="sil-g0" x1="12%" y1="0%" x2="88%" y2="100%">
          <stop offset="0%" stopColor="#B9F8FF" /><stop offset="45%" stopColor="#22D3EE" /><stop offset="100%" stopColor="#0A6F88" />
        </linearGradient>
        <linearGradient id="sil-g1" x1="12%" y1="0%" x2="88%" y2="100%">
          <stop offset="0%" stopColor="#A9CEFF" /><stop offset="45%" stopColor="#2E7DFF" /><stop offset="100%" stopColor="#12315F" />
        </linearGradient>
        <linearGradient id="sil-g2" x1="12%" y1="0%" x2="88%" y2="100%">
          <stop offset="0%" stopColor="#5B7FB5" /><stop offset="45%" stopColor="#2C4C86" /><stop offset="100%" stopColor="#101E38" />
        </linearGradient>
        <linearGradient id="sil-g3" x1="12%" y1="0%" x2="88%" y2="100%">
          <stop offset="0%" stopColor="#F6C98B" /><stop offset="45%" stopColor="#E39C43" /><stop offset="100%" stopColor="#6B3F10" />
        </linearGradient>
        <linearGradient id="sil-gn" x1="12%" y1="0%" x2="88%" y2="100%">
          <stop offset="0%" stopColor="#39445C" /><stop offset="45%" stopColor="#232C42" /><stop offset="100%" stopColor="#131A2B" />
        </linearGradient>
        <linearGradient id="sil-gne" x1="12%" y1="0%" x2="88%" y2="100%">
          <stop offset="0%" stopColor="#3A4763" /><stop offset="45%" stopColor="#26304A" /><stop offset="100%" stopColor="#151D30" />
        </linearGradient>
        {/* Castaño: el cuerpo es todo frío, así que el pelo cálido se despega
            solo. Oscurecerlo en azul lo hacía desaparecer contra el fondo. */}
        <linearGradient id="sil-gpelo" x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#8A6A4A" /><stop offset="45%" stopColor="#5C4430" /><stop offset="100%" stopColor="#33241A" />
        </linearGradient>
        {/* userSpaceOnUse: la luz es del cuerpo entero, no de cada polígono */}
        <linearGradient id="sil-luz" gradientUnits="userSpaceOnUse" x1="18" y1="10" x2="86" y2="190">
          <stop offset="0%" stopColor="rgba(255,255,255,.30)" />
          <stop offset="38%" stopColor="rgba(255,255,255,.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,.30)" />
        </linearGradient>
        <filter id="sil-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs></svg>
    </div>
  );
}
