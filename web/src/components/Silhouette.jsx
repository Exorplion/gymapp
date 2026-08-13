// La silueta de la pantalla de inicio: un cuerpo que gira, con cada grupo
// muscular coloreado según hace cuántos días lo entrenaste, y tocable.
//
// Antes eran dos cuerpos lado a lado y quedaban chicos: cada uno se llevaba
// medio ancho de pantalla (170px de 354) mientras sobraban 134px de alto sin
// usar. Uno solo aprovecha las dos medidas y se dibuja un 40% más grande.
//
// Gira de verdad con el dedo —el ángulo sigue la mano y al soltar cae a la cara
// más cercana—, pero que quede claro qué es: son DOS dibujos planos montados
// espalda contra espalda, no un modelo 3D. Se puede ver de frente o de atrás, no
// de perfil. Un 3D real necesitaría una malla, y la lámina anatómica que
// tenemos —la única con esta calidad de músculo— es SVG plano.
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

/** Ancho al que se dibuja el cuerpo dentro de su caja.

    No es el ancho de la caja: el SVG se encaja adentro con su proporción y deja
    aire a los costados. Hace falta el ancho del CUERPO porque es contra eso que
    se mide el arrastre — girás el cuerpo, no la pantalla. */
function anchoDelCuerpo(el, viewBox) {
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  if (!el) return 220;
  return Math.min(el.clientWidth, el.clientHeight * (w / h)) || 220;
}

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

function Cara({ cara, days, etiqueta, sel, onPick, activa, revelar }) {
  /* Los parches quedan fuera del cuerpo normal.

     Son las capas que MuscleMap dibuja ENCIMA del músculo base para resaltar
     una porción —clavicular sobre el pecho, vasto interno sobre el cuádriceps—
     y pintarlas junto con el padre dejaba manchas con forma de gota: eran sus
     contornos asomando sobre el músculo entero. Sirven para mostrar qué porción
     trabaja un ejercicio, no para el mapa general. */
  const zonas = cara.zonas.filter(z => !z.parche);
  const trazos = fn => zonas.map((z, i) => z.d.map((d, j) => fn(z, d, `${i}.${j}`)));

  /* La cara que quedó atrás sale del alcance del teclado y del lector: sigue en
     el DOM porque el giro necesita las dos montadas, pero tabular hasta un
     músculo que no se ve sería tabular al vacío. */
  return (
    <svg
      viewBox={cara.viewBox}
      role="group"
      aria-label={`Músculos: ${etiqueta}`}
      aria-hidden={!activa}
    >
      <g className="sil-masa">
        {trazos((z, d, k) => <path key={k} d={d} />)}
      </g>

      {zonas.map((z, i) => {
        const dibujos = z.d.map((d, j) => <path key={j} d={d} />);
        const cls = claseDe(z, days);
        if (!z.cat || z.cat === 'pelo') {
          return <g key={i} className={`sil-z ${cls}`}>{dibujos}</g>;
        }
        const delayMs = revelar ? revelar[z.cat] : undefined;
        const revelando = delayMs !== undefined;
        /* Sin onPick (modo no interactivo, ver Silhouette más abajo): la
           zona es sólo el dibujo pintado, sin role=button/tabIndex/onClick.
           Es la pantalla de fin de sesión mostrando un vistazo, no un mapa
           para tocar. */
        if (!onPick) {
          return (
            <g
              key={i}
              className={`sil-z ${cls}${revelando ? ' sil-revela' : ''}`}
              style={revelando ? { animationDelay: `${delayMs}ms` } : undefined}
            >
              {dibujos}
            </g>
          );
        }
        const activo = sel === z.cat;
        return (
          <g
            key={i}
            className={`sil-z sil-tap ${cls} ${activo ? 'sil-sel' : ''}`}
            role="button"
            tabIndex={activa ? 0 : -1}
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
  );
}

export default function Silhouette({ days = {}, interactivo = true, revelar = null }) {
  const [sel, setSel] = useState(null);   // { cat, x, y, arriba }
  const [ang, setAng] = useState(0);      // grados; los múltiplos pares de 180 son la frente
  const [quieto, setQuieto] = useState(true);   // ni girando ni cayendo: se puede tocar
  const [tirando, setTirando] = useState(false); // el dedo manda: sin transición, el giro sigue la mano
  const caja = useRef(null);
  const stage = useRef(null);
  const gesto = useRef(null);             // { x, ang, giro } mientras el dedo está apoyado

  // `bodySex` es el ajuste explícito de Ajustes; si nunca se tocó, hereda el
  // sexo del perfil para que quien ya lo cargó no tenga que elegir dos veces.
  // Van separados porque el del perfil existe para calcular calorías: unirlos
  // obligaría a mentir en uno para arreglar el otro.
  const { frente, espalda } = cuerpo(S.cfg.bodySex || S.cfg.profile?.sex);

  // Qué cara mira al frente: 0 frente, 1 espalda. Se saca del ángulo y no de un
  // estado aparte para que no puedan discrepar — el ángulo es la única verdad.
  const atras = Math.abs(Math.round(ang / 180) % 2) === 1;

  const cerrar = useCallback(() => setSel(null), []);

  /** El cuerpo terminó de moverse: vuelve a aceptar toques y el gesto se olvida.

      Olvidarlo acá y no en el click es lo que evita que un giro viejo se quede
      colgado y se coma el siguiente toque —por ejemplo uno hecho con el
      teclado, que nunca pasa por el dedo. */
  const asentar = () => { setQuieto(true); gesto.current = null; };

  /** Gira hasta la cara pedida por el camino más corto. */
  const girarA = quiero => {
    const n = Math.round(ang / 180);
    const destino = (Math.abs(n % 2) === 1) === quiero ? n : n + 1;
    if (destino * 180 === ang) return;
    setSel(null);
    setQuieto(false);
    vibrate(8);
    setAng(destino * 180);
  };

  // Escape cierra. Se registra sólo mientras hay algo abierto.
  useEffect(() => {
    if (!sel) return;
    const h = e => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sel, cerrar]);

  /* Red por si el fin de la transición no llega nunca.

     Pasa de verdad: con "reducir movimiento" activado no hay transición, así
     que tampoco hay transitionend, y el cuerpo se quedaría sordo a los toques
     para siempre esperando un aviso que no existe. También cubre el caso de una
     transición interrumpida a mitad de camino. */
  useEffect(() => {
    if (quieto || tirando) return;
    const t = setTimeout(asentar, 700);
    return () => clearTimeout(t);
    // `asentar` sólo toca setters y un ref: no hace falta en las dependencias, y
    // ponerlo reiniciaría el temporizador en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quieto, tirando, ang]);

  /** Ancla el globo al músculo tocado, en coordenadas de la caja.

      Se mide con getBoundingClientRect y no con el bbox del SVG porque el SVG
      escala: el bbox está en unidades del viewBox y acá hacen falta píxeles.

      El globo va debajo del músculo, salvo que no entre — entonces va arriba.
      Y se recorta a los bordes de la caja para que nunca se salga por un
      costado. */
  const tocar = (cat, el) => {
    // Si el dedo venía girando el cuerpo, el click de cierre no es un toque:
    // soltar sobre un músculo no es lo mismo que elegirlo.
    if (gesto.current?.giro) { gesto.current = null; return; }
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

  /* Arrastrar para girar.

     El ángulo sigue al dedo en vez de saltar al final del gesto: media vuelta
     por ancho de cuerpo. Contra el ancho del CUERPO y no el de la pantalla —
     medido contra la pantalla había que arrastrar 177px para darlo vuelta y se
     sentía pesado; contra el cuerpo alcanza con 110, que es un pulgar.

     Recién a los 8px se considera giro: abajo de eso es un toque, y el músculo
     tiene que poder recibirlo. */
  const dedoAbajo = e => {
    if (e.button > 0) return;
    gesto.current = { x: e.clientX, ang, giro: false };
  };

  const dedoMueve = e => {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    if (!g.giro) {
      if (Math.abs(dx) < 8) return;
      g.giro = true;
      setSel(null);
      setQuieto(false);
      setTirando(true);
      stage.current?.setPointerCapture?.(e.pointerId);
    }
    setAng(g.ang + (dx / anchoDelCuerpo(stage.current, frente.viewBox)) * 180);
  };

  const dedoArriba = () => {
    const g = gesto.current;
    if (!g?.giro) { gesto.current = null; return; }
    setTirando(false);
    vibrate(8);
    // Cae a la cara más cercana. Si ya estaba justo ahí no hay transición que
    // esperar, así que el cuerpo se da por asentado en el acto: si no, quedaría
    // sordo a los toques para siempre.
    const destino = Math.round(ang / 180) * 180;
    setAng(destino);
    if (destino === ang) asentar();
  };

  return (
    <div className="sil-pair" ref={caja}>
      {/* Las dos caras montadas espalda contra espalda. Mientras el cuerpo se
          mueve no recibe toques: el rectángulo de un músculo en pleno giro está
          aplastado y el globo saldría anclado a cualquier lado. */}
      <div
        className={`sil-stage ${quieto ? '' : 'girando'}`}
        ref={stage}
        {...(interactivo ? {
          onPointerDown: dedoAbajo,
          onPointerMove: dedoMueve,
          onPointerUp: dedoArriba,
          onPointerCancel: dedoArriba,
        } : {})}
      >
        <div
          className={`sil-flip ${tirando ? '' : 'suave'}`}
          style={{ transform: `rotateY(${ang}deg)` }}
          onTransitionEnd={asentar}
        >
          <div className={`sil-face ${atras ? '' : 'on'}`}>
            <Cara cara={frente} days={days} etiqueta="Frente" sel={sel?.cat} onPick={interactivo ? tocar : undefined} activa={!atras} revelar={revelar} />
          </div>
          <div className={`sil-face atras ${atras ? 'on' : ''}`}>
            <Cara cara={espalda} days={days} etiqueta="Espalda" sel={sel?.cat} onPick={interactivo ? tocar : undefined} activa={atras} revelar={revelar} />
          </div>
        </div>
      </div>

      {/* Dos botones y no uno que alterna: un botón solo tendría que decir o
          dónde estás o adónde vas, y las dos lecturas son igual de válidas.
          No interactivo (pantalla de fin de sesión): ni girar ni tocar
          tienen sentido en un vistazo de unos segundos. */}
      {interactivo && (
        <div className="sil-caras" role="group" aria-label="Girar el cuerpo">
          <button type="button" aria-pressed={!atras} onClick={() => girarA(false)}>Frente</button>
          <button type="button" aria-pressed={atras} onClick={() => girarA(true)}>Espalda</button>
        </div>
      )}

      {interactivo && sel && (
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
