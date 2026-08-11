// Las dos siluetas de la pantalla de inicio: frente y espalda, con cada grupo
// muscular coloreado según hace cuántos días lo entrenaste, y tocable.
//
// La geometría NO se dibuja acá: viene de lib/bodydata.js, que es una lámina
// anatómica de MuscleMap (MIT) — curvas bezier, no polígonos. Antes usábamos
// body-highlighter y el cuerpo se veía facetado porque eran literalmente
// polígonos; esto son 32 músculos con forma orgánica.
//
// Dos cosas que la lámina nueva trae resueltas y antes eran trabajo nuestro:
// el cuerpo femenino está DIBUJADO aparte (no es el masculino deformado), y el
// pelo viene incluido y acorde a cada cuerpo. Por eso desaparecieron de acá el
// perfil de proporciones y los trazados de cabello hechos a mano.
//
// Lo que sí es de FIERRO es cómo se ve, y son tres capas por cuerpo:
//
//   1. masa   — los mismos trazos, oscuros y engordados con un stroke grueso.
//               Une los músculos por debajo, así los huecos entre ellos leen
//               como surcos de un cuerpo y no como agujeros al fondo.
//   2. músculo— cada grupo con el degradado de su estado. El degradado va por
//               músculo, no por cuerpo: es lo que los hace parecer inflados.
//   3. luz    — una sola fuente arriba a la izquierda sobre TODO el cuerpo, en
//               coordenadas del SVG. Sin esta capa cada músculo se ilumina por
//               su cuenta y el conjunto se ve facetado, como vidrio roto.
//
// Este componente no calcula estadísticas: pide groupStats() cuando tocás.
import { useState, useRef, useEffect, useCallback } from 'react';
import { cuerpo } from '../lib/bodydata.js';
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

/** La clase de una zona. El pelo y lo que no rastreamos tienen la suya. */
function claseDe(z, days) {
  if (z.cat === 'pelo') return 'sil-pelo';
  if (!z.cat) return 'sil-neutro';
  return tono(days[z.cat]);
}

/** Proporción del lienzo, para que la caja no deforme el dibujo.

    Sale del viewBox y no de una constante porque los dos cuerpos NO miden lo
    mismo: el masculino es 727×1280 y el femenino 650×1450. */
function proporcion(viewBox) {
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  return `${w} / ${h}`;
}

function Cara({ cara, days, etiqueta, sel, onPick }) {
  const trazos = fn => cara.zonas.map((z, i) => z.d.map((d, j) => fn(z, d, `${i}.${j}`)));

  return (
    <div className="sil-box">
      <svg
        viewBox={cara.viewBox}
        style={{ aspectRatio: proporcion(cara.viewBox) }}
        role="group"
        aria-label={`Músculos: ${etiqueta}`}
      >
        <g className="sil-masa">
          {trazos((z, d, k) => <path key={k} d={d} />)}
        </g>

        {cara.zonas.map((z, i) => {
          const dibujos = z.d.map((d, j) => <path key={j} d={d} />);
          const cls = claseDe(z, days);
          if (!z.cat || z.cat === 'pelo') {
            return <g key={i} className={`sil-z ${cls}`}>{dibujos}</g>;
          }
          const activo = sel === z.cat;
          return (
            <g
              key={i}
              className={`sil-z sil-tap ${cls} ${activo ? 'sil-sel' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${z.cat}, ${diasTexto(days[z.cat])}. Ver estadísticas.`}
              aria-pressed={activo}
              onClick={e => onPick(z.cat, e.currentTarget)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(z.cat, e.currentTarget); }
              }}
            >
              {dibujos}
            </g>
          );
        })}

        <g className="sil-luz">
          {trazos((z, d, k) => <path key={k} d={d} />)}
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
  const { frente, espalda } = cuerpo(S.cfg.bodySex || S.cfg.profile?.sex);

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
      <Cara cara={frente} days={days} etiqueta="Frente" sel={sel?.cat} onPick={tocar} />
      <Cara cara={espalda} days={days} etiqueta="Espalda" sel={sel?.cat} onPick={tocar} />

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
        {/* userSpaceOnUse: la luz es del cuerpo entero, no de cada trazo. Las
            coordenadas son las del lienzo grande de la lámina. */}
        <linearGradient id="sil-luz" gradientUnits="userSpaceOnUse" x1="120" y1="120" x2="620" y2="1300">
          <stop offset="0%" stopColor="rgba(255,255,255,.28)" />
          <stop offset="38%" stopColor="rgba(255,255,255,.05)" />
          <stop offset="100%" stopColor="rgba(0,0,0,.28)" />
        </linearGradient>
        <filter id="sil-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs></svg>
    </div>
  );
}
