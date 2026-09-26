// Puerto del carrusel de ejercicios de renderHoy() (index.html: el bloque
// `#ex-carousel`/`.carousel-slide` + initCarousel()/scrollCarouselTo()).
// Componente propio (no inlineado en Hoy.jsx) porque tiene lógica real de
// posicionamiento de scroll que vale la pena aislar — ver lib/carousel.js
// para por qué esa matemática vive en su propio módulo sin dependencias
// (para no crear un ciclo session.js <-> ExerciseCarousel.jsx).
//
// Peso/reps viven enteros dentro de ReelPicker.jsx (rueda gruesa + rueda
// fina vertical de enteros vecinos, mantener presionado + edición manual
// tocando el número — ver el comentario de cabecera de ese archivo). Antes
// había un <input> de respaldo debajo de cada rueda; Enzo pidió sacarlo
// (menos clutter, y el número editable tiene que vivir en la rueda, no
// aparte) — lo único que sigue mostrándose acá afuera es la conversión de
// unidad (`alt`, kg↔lb) y el aviso de progresión, ninguno de los dos
// editable, así que el patrón de refs no controlados (`altRef`/`pwRef`) se
// mantiene sólo para esos dos.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { S, wDisplay, wAltPartes, wStep, wToUnit, wFromUnit, openSheet } from '../lib/state.js';
import { motion, AnimatePresence } from 'motion/react';
import { round1, fmtNum } from '../lib/format.js';
import { exInfo, rirScheme, progressionWarn } from '../lib/exdb.js';
import { rirPedido } from '../lib/rir.js';
import { objetivoHoy } from '../lib/objetivoHoy.js';
import { tocaCalentar, warmupSets } from '../lib/warmup.js';
import {
  ensureVals, lastDataFor, setsDone, saveSet, deleteSet, startExercise,
  targetSets, isSkipped, skipExercise, unskipExercise, addExtraSet, reemplazaA,
  isUnilateral, setSide, seriesCompletas, hacerDespues, marcarCalentado,
} from '../lib/session.js';
import { sideImbalance } from '../lib/symmetry.js';
import { toast } from '../lib/toast.js';
import { T } from '../lib/rest.js';
import { jumpToSlide, scrollToSlideEl, slideScrollLeft } from '../lib/carousel.js';
import { staggerRevealOnce, squashStretch, impactBurst, menosMovimiento, D, EASE_OUT } from '../lib/motion.js';
import { relatedHistory, equipLabel } from '../lib/equip.js';
import { getPhoto, deletePhoto, guardarFotoMaquina } from '../lib/gyms.js';
import { iconOf } from '../lib/exicon.js';
import ExIcon from './ExIcon.jsx';
import ReelPicker from './ReelPicker.jsx';
import { Info, Skip, Dots, Later, Check, X } from './Icon.jsx';
// EXPERIMENTO — coverflow 3D (pedido de Enzo, ver motion.dev/examples/react-carousel-coverflow).
// Revertir = borrar este import + el archivo + el bloque "COVERFLOW" de abajo.
import '../styles-coverflow.css';

// ---- COVERFLOW: matemática pura (testeada aparte) ----------------------
// t = distancia señalada del centro del slide al centro visible del
// carrusel, normalizada por el ancho del slide (o sea "cuántos slides de
// distancia"). slideCenterDist() de lib/carousel.js ya hace exactamente esa
// cuenta pero en valor absoluto (la necesita para elegir el dot activo); acá
// hace falta el signo para saber hacia qué lado inclinar, así que
// measureAndPaint() (más abajo, dentro del componente) calcula su propia
// versión señalada, en la misma pasada de lectura que usa para los dots, y
// le pasa el resultado a esta función.
const CF_MAX_ANGLE = 32; // grados, vecino inmediato
const CF_MAX_SCALE_DROP = 0.15;
/* Los vecinos bajan a 0.7, no a 0.4. Era la única objeción que sobrevivió a
   la re-medición del coverflow (2026-09-22): el costo de latencia que casi
   lo hace descartar bajó de +65ms a +5.6ms cuando el PR #114 saco el scroll
   duplicado, pero sobre fondo oscuro un 0.4 no es "atenuado", es
   desaparecido — el ejercicio que viene dejaba de leerse. La profundidad ya
   la cuentan el rotateY, la escala y el translateZ; la opacidad sólo tenía
   que insinuar que eso no es lo que estás tocando ahora. */
const CF_MAX_OPACITY_DROP = 0.3;
const CF_MAX_Z = 70; // px hundidos hacia adentro
const CF_FLAT_EPSILON = 0.03; // por debajo de esto, el slide activo queda EXACTAMENTE plano

function coverflowFrame(t) {
  const clamped = Math.max(-1.6, Math.min(1.6, t));
  if (Math.abs(clamped) < CF_FLAT_EPSILON) {
    return { rotateY: 0, scale: 1, opacity: 1, translateZ: 0, zIndex: 100 };
  }
  const abs = Math.min(Math.abs(clamped), 1); // el efecto satura a partir de 1 slide de distancia
  const sign = clamped > 0 ? 1 : -1;
  return {
    rotateY: -sign * CF_MAX_ANGLE * abs,
    scale: 1 - CF_MAX_SCALE_DROP * abs,
    opacity: 1 - CF_MAX_OPACITY_DROP * abs,
    translateZ: -CF_MAX_Z * abs,
    zIndex: Math.round(100 - abs * 20),
  };
}

/** Aplica coverflowFrame() como estilo inline directamente sobre el nodo del
    DOM — nada de setState acá. Esto se ejecuta en cada frame de scroll (el
    dedo del usuario, y además cada serie registrada reposiciona el carrusel)
    y App.jsx recuerda muy bien (PR #98, 1fps) lo que cuesta re-renderizar de
    más en esta pantalla: el efecto tiene que seguir el dedo a costo cero de
    React. */
function applyCoverflowStyle(slide, frame, isCenter) {
  /* El slide ACTIVO queda plano por decisión, no por umbral.
     Antes el estado plano dependía de que la distancia calculada cayera bajo
     CF_FLAT_EPSILON, y eso no pasa nunca de forma confiable: `offsetLeft` y
     `clientWidth` son enteros pero `scrollLeft` es fraccional, así que el
     motor de scroll-snap de Chrome deja un residuo sub-pixel permanente.
     Medido con el slide centrado a propósito: transform
     `matrix3d(0.985093, 0, -0.0500593, …)` y `opacity: 0.945` — o sea la
     tarjeta con la rueda de peso, el RPE y el botón de registrar la serie
     quedaba rotada ~3° y atenuada.
     `isCenter` ya sabe cuál es el activo (es el más cercano al centro): si lo
     sabemos, se le fuerza el estado plano y no se le pregunta al número. */
  const plano = isCenter
    ? { rotateY: 0, scale: 1, opacity: 1, translateZ: 0, zIndex: 100 }
    : frame;
  const { rotateY, scale, opacity, translateZ, zIndex } = plano;
  slide.style.transform = rotateY === 0 && translateZ === 0 && scale === 1
    ? ''
    : `perspective(1200px) rotateY(${rotateY}deg) translateZ(${translateZ}px) scale(${scale})`;
  slide.style.opacity = opacity === 1 ? '' : String(opacity);
  slide.style.zIndex = String(zIndex);
  slide.classList.toggle('cf-center', isCenter);
}
// ---- fin COVERFLOW matemática -------------------------------------------

// coverflowFrame colgada del componente (no un `export` de nivel de módulo
// aparte) para no disparar el warning de oxlint react(only-export-components)
// — este archivo sólo puede tener un export además del default. El test la
// llama como ExerciseCarousel.coverflowFrame(t).
ExerciseCarousel.coverflowFrame = coverflowFrame;

export default function ExerciseCarousel({ exs, wd, active, started, curId, nextEx }) {
  const carRef = useRef(null);
  const dotsRef = useRef(null);

  const meta = useMemo(() => {
    const m = exs.map(ex => {
      const done = setsDone(ex.id);
      const target = targetSets(ex);
      const skipped = active && isSkipped(ex.id);
      const full = !skipped && done.length >= target;
      const open = active && curId === ex.id && !full && !skipped;
      return { ex, done, target, skipped, full, open };
    });
    m.forEach(item => {
      item.isNext = active && !item.open && !item.skipped && !curId && nextEx && nextEx.id === item.ex.id;
      item.waiting = active && !item.open && !item.isNext && !item.full && !item.skipped;
    });
    return m;
  }, [exs, active, curId, nextEx]);

  const openIdx = useMemo(() => meta.findIndex(m => m.open || m.isNext), [meta]);

  // "A qué slide hay que llevar la vista" sólo cambia cuando cambia el día,
  // el set de ejercicios (día distinto / reordenado), si arrancó la sesión, o
  // cuál es el ejercicio en curso — NO en cada tecla de peso/reps. El
  // original resetea el scroll en CADA render porque su arquitectura
  // (innerHTML=h) recrea el DOM entero y por lo tanto pierde scrollLeft de
  // todas formas; acá React reconcilia sin recrear nodos, así que forzar el
  // salto en cada bump() (p.ej. al tocar "+" en el peso) rompería el swipe
  // manual del usuario para mirar los vecinos. Ver task-6-report.md, Design
  // Decisions.
  const focusKey = `${wd}|${active}|${curId ?? ''}|${exs.map(e => e.id).join(',')}`;

  // El PRIMER posicionamiento de este montaje tiene que ser instantáneo
  // (jumpToSlide) — recién se abre Hoy, animar desde scrollLeft=0 se vería
  // como el carrusel "viajando" apenas se pinta la pantalla. Los
  // reposicionamientos SIGUIENTES (cambiaste de día, arrancó la sesión,
  // avanzó el ejercicio en curso) sí deslizan: antes saltaban de golpe, el
  // único movimiento suave era el que hacías vos con el dedo.
  const yaHuboSalto = useRef(false);

  useLayoutEffect(() => {
    const car = carRef.current;
    if (!car) return;
    // openIdx es -1 cuando no hay ejercicio abierto ni próximo: terminaste el
    // último del día. Antes eso caía en Math.max(0, -1) = 0 y el carrusel se
    // iba al PRIMER ejercicio, que no es a donde estabas mirando. Con -1 no se
    // reposiciona nada: la vista se queda donde está (y el coverflow se repinta
    // igual, más abajo).
    const idx = exs.length ? openIdx : -1;
    const dotsWrap = dotsRef.current;
    // COVERFLOW: gateado por prefers-reduced-motion (menosMovimiento) — con
    // movimiento reducido el carrusel queda 100% como antes, plano y sin 3D.
    const coverflowOn = !menosMovimiento();
    let rafId = null;
    // TODAS las lecturas de layout (offsetLeft/offsetWidth/scrollLeft, tanto
    // para el coverflow como para el dot activo) van en una sola pasada,
    // ANTES de escribir nada — si se intercalan lectura/escritura por slide
    // (o si el coverflow escribe en un rAF distinto del de los dots) cada
    // lectura posterior fuerza un reflow síncrono sobre el layout que la
    // escritura anterior acaba de invalidar. Se detectó exactamente este
    // patrón (135ms de reflow forzado en una corrida de 1.8s con CPU 6x)
    // cuando el coverflow escribía en su propio rAF y los dots leían justo
    // después, en el mismo upd(), sobre un layout ya invalidado.
    function measureAndPaint() {
      const children = [...car.children];
      const scrollLeft = car.scrollLeft;
      const clientWidth = car.clientWidth;
      // Lectura (batch): un solo recorrido, nada se escribe todavía.
      const reads = children.map(s => ({ offsetLeft: s.offsetLeft, offsetWidth: s.offsetWidth }));
      let bestIdx = 0, bestAbsDist = Infinity;
      const signedT = reads.map((r, i) => {
        const center = r.offsetLeft + r.offsetWidth / 2 - scrollLeft;
        const raw = center - clientWidth / 2;
        const absDist = Math.abs(raw);
        if (absDist < bestAbsDist) { bestAbsDist = absDist; bestIdx = i; }
        return raw / (r.offsetWidth || clientWidth || 1);
      });
      // Escritura (batch): recién ahora se toca el DOM.
      if (coverflowOn) {
        children.forEach((s, i) => applyCoverflowStyle(s, coverflowFrame(signedT[i]), i === bestIdx));
      }
      if (dotsWrap) {
        [...dotsWrap.children].forEach((d, j) => d.classList.toggle('on', j === bestIdx));
      }
    }
    let firstPaint = true;
    function upd() {
      if (firstPaint) {
        // La primera pasada (montaje) se aplica ya mismo: si se difiere un
        // frame con rAF, el carrusel se ve "plano" un instante y después
        // salta al coverflow — mismo tipo de parpadeo que PR #98 ya evitó
        // para el reveal escalonado.
        firstPaint = false;
        measureAndPaint();
        return;
      }
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => { rafId = null; measureAndPaint(); });
    }
    /* ---- El scroll suave llega hasta donde dijimos, o se corrige ----------

       `car.scrollTo({behavior:'smooth'})` NO garantiza llegar: con
       `scroll-snap-type: x mandatory`, cuando el layout del contenedor cambia
       mientras la animación corre, Chrome re-evalúa el snap y ABORTA el scroll
       programático donde estaba. Y completar un ejercicio es justo eso: la
       tarjeta que se cierra pasa de `open` (ruedas de peso/reps, botón,
       opciones) a `full` y el carrusel se achica a la mitad de alto en medio
       del viaje.

       Medido a 430px: pedimos scrollTo(2323.5) y el carrusel se quedó
       clavado en 2286.4 — el slide siguiente 36.9px corrido del centro, para
       siempre. A 390px el mismo flujo llegaba bien; por eso el bug se sentía
       intermitente ("a veces queda desalineada").

       Entonces: se recuerda a dónde pedimos ir y, cuando el scroll termina, se
       comprueba. Si quedó corto se vuelve a pedir — suave si falta un tramo
       que se va a ver como movimiento, instantáneo si es el resto sub-píxel
       que deja el snap. Dos intentos como techo: si a la tercera no llegó, algo
       más está mandando y seguir insistiendo sería pelearle al usuario.

       Y se abandona el destino apenas el usuario toca el carrusel: si te
       pusiste a mirar el ejercicio de al lado, la app no tiene derecho a
       arrastrarte de vuelta. */
    let destino = null;
    let intentos = 0;
    function irAlFoco(behavior) {
      if (idx <= 0) return; // idx<=0: el primer slide ya está en su lugar (mismo criterio que jumpToSlide)
      const slide = car.children[idx];
      if (!slide) return;
      destino = slideScrollLeft(car, slide);
      intentos = 0;
      scrollToSlideEl(car, slide, behavior);
    }
    function soltarDestino() { destino = null; }

    /* Re-asentar cuando el scroll TERMINA, no sólo mientras se mueve: el
       último evento `scroll` de una animación suave puede llegar con el
       scrollLeft todavía en movimiento, y el coverflow quedaba pintado con un
       frame intermedio (el slide activo con una matriz que no era la
       identidad). `scrollend` es el evento que garantiza "ya no se mueve más";
       donde no existe (Safari viejo) se emula con un temporizador corto
       colgado del propio scroll, sin polling ni listeners de más. */
    const hayScrollEnd = 'onscrollend' in car;
    let finTimer = null;
    function settle() {
      if (destino != null) {
        const falta = destino - car.scrollLeft;
        if (Math.abs(falta) > 1 && intentos < 2) {
          intentos++;
          // >24px es un tramo que se ve: se completa animado, así el
          // movimiento se lee como uno solo y no como un tirón.
          car.scrollTo({ left: destino, behavior: Math.abs(falta) > 24 ? 'smooth' : 'auto' });
          return; // el scrollend del nuevo scroll vuelve a pasar por acá
        }
        destino = null;
      }
      measureAndPaint();
    }
    function updConFin() {
      upd();
      if (hayScrollEnd) return;
      clearTimeout(finTimer);
      finTimer = setTimeout(settle, 140);
    }
    car.addEventListener('scroll', updConFin, { passive: true });
    if (hayScrollEnd) car.addEventListener('scrollend', settle, { passive: true });
    for (const ev of ['pointerdown', 'touchstart', 'wheel', 'keydown']) {
      car.addEventListener(ev, soltarDestino, { passive: true });
    }

    /* Si cambia el ANCHO del carrusel (rotar el teléfono, la barra de
       direcciones del navegador que aparece/desaparece), el scrollLeft que
       centraba el slide deja de centrarlo: la cuenta depende de clientWidth.
       Se observa SÓLO el carrusel —un elemento, no los diez slides— y sólo se
       actúa si el ancho cambió de verdad, así que en la vida normal de la
       pantalla este observer no hace absolutamente nada. Reposicionar con
       'auto' y no 'smooth' a propósito: es una corrección de layout, no una
       navegación; animarla se vería como un salto fantasma. */
    let anchoPrevio = car.clientWidth;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (car.clientWidth === anchoPrevio) return;
      anchoPrevio = car.clientWidth;
      irAlFoco('auto');
      measureAndPaint();
    }) : null;
    if (ro) ro.observe(car);

    /* El posicionamiento va DESPUÉS de dejar todo armado (irAlFoco y sus
       listeners) y no al principio del efecto: el scroll tiene que salir con
       su red de seguridad ya puesta. Sigue siendo la misma pasada síncrona de
       useLayoutEffect, o sea antes de que el navegador pinte. */
    if (!yaHuboSalto.current) {
      jumpToSlide(car, idx);
      yaHuboSalto.current = true;
      // Reveal escalonado sólo la primera vez que se pinta el carrusel EN
      // TODA LA SESIÓN (staggerRevealOnce, ver motion.js) — antes sólo se
      // evitaba repetirlo en cada bump (yaHuboSalto), pero Hoy remonta el
      // carrusel entero cada vez que volvés a esa pestaña (key={store.tab}
      // en App.jsx), así que igual competía con el fundido de cambio de
      // pestaña en cada visita.
      staggerRevealOnce('hoy-carousel', car.children);
    } else {
      irAlFoco('smooth');
    }

    upd();
    return () => {
      car.removeEventListener('scroll', updConFin);
      if (hayScrollEnd) car.removeEventListener('scrollend', settle);
      for (const ev of ['pointerdown', 'touchstart', 'wheel', 'keydown']) {
        car.removeEventListener(ev, soltarDestino);
      }
      clearTimeout(finTimer);
      if (ro) ro.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  if (!exs.length) return null;

  return (
    <>
      <div id="ex-carousel" className={`carousel${active ? ' focus' : ''}${menosMovimiento() ? '' : ' coverflow'}`} ref={carRef}>
        {meta.map(m => (
          <ExerciseSlide key={m.ex.id} m={m} wd={wd} started={started} />
        ))}
      </div>
      {exs.length > 1 && (
        <div className="carousel-dots" id="ex-dots" ref={dotsRef}>
          {exs.map(ex => <i key={ex.id}></i>)}
        </div>
      )}
    </>
  );
}

/** Omitir desde la tarjeta en espera: la misma confirmación que la hoja de
    opciones. Omitir no es "hacer después": el ejercicio no se hace hoy. */
function confirmarOmitir(ex) {
  openSheet('confirm', {
    title: `¿Omitir ${ex.name}?`,
    body: 'Queda marcado como omitido y pasás al siguiente. Podés restablecerlo en cualquier momento y vuelve a su lugar.',
    confirmLabel: 'Omitir',
    onConfirm: () => skipExercise(ex.id),
  });
}

/** La foto de "esta máquina, en este gym" (a pedido explícito de Enzo — ver
    el comentario de cabecera de gyms.js), como MINIATURA en el encabezado de
    la tarjeta (2026-09-24): se ve de un vistazo y un toque la abre en grande.
    Antes era un chip adentro del acordeón de "más opciones", donde nadie la
    encontraba.

    Sin foto no se dibuja nada: sacarla vive en la hoja de opciones (⋯). Tocar
    la miniatura MUESTRA la foto (sheet 'gym-photo'); reemplazar y borrar viven
    adentro de ese preview. El <input> de la cámara se queda acá porque
    'gym-photo' lo dispara por callback para reemplazar.

    `S.fotoRev` en las dependencias: la hoja de opciones guarda una foto nueva
    y sube ese número (gyms.js), y la miniatura se vuelve a leer sola. */
function FotoMaquina({ gymId, exName }) {
  const [url, setUrl] = useState(null);
  const inputRef = useRef(null);
  const urlRef = useRef(null);
  const rev = S.fotoRev || 0;

  useEffect(() => {
    let cancelled = false;
    getPhoto(gymId, exName).then(blob => {
      if (cancelled) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const next = blob ? URL.createObjectURL(blob) : null;
      urlRef.current = next;
      setUrl(next);
    }).catch(() => {
      // Leer la foto puede fallar (IndexedDB bloqueada por otra pestaña). Sin
      // este catch era un rechazo no manejado y la miniatura no aparecía nunca.
      if (!cancelled) setUrl(null);
    });
    return () => {
      cancelled = true;
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [gymId, exName, rev]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    await guardarFotoMaquina(gymId, exName, file);
  }

  async function borrarFoto() {
    try {
      await deletePhoto(gymId, exName);
    } catch {
      toast('No se pudo borrar la foto');
      return;
    }
    toast('Foto borrada');
  }

  function verFoto() {
    openSheet('gym-photo', {
      gymId,
      gymName: S.gyms?.find(g => g.id === gymId)?.name || '',
      exName,
      onReemplazar: () => inputRef.current?.click(),
      onBorrar: borrarFoto,
    });
  }

  if (!url) return null;
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFile} />
      <button type="button" className="ex-foto" onClick={verFoto} aria-label={`Ver la foto de la máquina de ${exName}`}>
        <img src={url} alt="" />
      </button>
    </>
  );
}

/** "Última vez" y "Hoy", lado a lado (2026-09-24). Antes eran dos renglones
    de texto gris ("Objetivo 4 × 10", "Última vez: 60×10 · 60×10…") más un
    párrafo de progresión abajo: tres lecturas para una sola pregunta — ¿qué
    tengo que hacer hoy contra lo de la vez pasada? Dos columnas con el número
    grande la contestan de un vistazo. El número de Hoy sale de
    objetivoHoy() — la doble progresión, o el sugerido por 1RM — nunca de un
    relleno. */
function ultimaVez(last) {
  const unidad = S.cfg.unit === 'lb' ? 'lb' : 'kg';
  let ultima = null;
  if (last?.length) {
    const top = Math.max(...last.map(s => s.w));
    const parejas = last.every(s => Math.abs(s.w - top) < 0.01);
    ultima = {
      peso: `${wDisplay(top)} ${unidad}`,
      detalle: parejas ? `${last.map(s => s.r).join(' · ')} reps` : last.map(s => `${wDisplay(s.w)}×${s.r}`).join(' · '),
    };
  }
  return ultima;
}

function Comparativa({ last, obj, uni }) {
  const unidad = S.cfg.unit === 'lb' ? 'lb' : 'kg';
  const ultima = ultimaVez(last);
  const hoyPeso = obj.peso != null
    ? `${obj.tipo === 'sugerido' ? '~' : ''}${wDisplay(obj.peso)} ${unidad}${obj.tipo === 'subir' ? ' ↑' : ''}`
    : '—';
  return (
    <div className="ex-cmp">
      <div className="ex-cmp-col">
        <span className="ex-cmp-lbl">Sesión anterior{uni ? ' · por lado' : ''}</span>
        {ultima ? <><b>{ultima.peso}</b><small>{ultima.detalle}</small></> : <small>sin registro</small>}
      </div>
      <div className={`ex-cmp-col hoy${obj.tipo === 'subir' ? ' up' : ''}`}>
        <span className="ex-cmp-lbl">Hoy</span>
        <b>{hoyPeso}</b>
        <small>{obj.texto}</small>
      </div>
    </div>
  );
}

/* La rampa de aproximación como pasos (2026-09-25). Antes era un renglón
   "Aproximación · 22.5×5 · 35×3 · 40×1" con un solo "Hecho". Ahora cada
   escalón se toca al hacerlo y se pone verde; el último marca el
   calentamiento como hecho (y arranca el descanso, como antes). El avance
   vive en memoria por sesión: volver a Hoy desde otra pestaña no lo pierde. */
const pasosRampa = new Map();

function Rampa({ ex, rampa }) {
  const clave = `${S.draft?.id}|${ex.id}`;
  const [hechos, setHechos] = useState(() => pasosRampa.get(clave) || 0);
  function tocar(i) {
    const n = i + 1;
    if (n <= hechos) return;
    pasosRampa.set(clave, n);
    setHechos(n);
    if (n >= rampa.length) marcarCalentado(ex, true);
  }
  const avance = rampa.length > 1 ? Math.min(1, Math.max(0, hechos - 1) / (rampa.length - 1)) : 0;
  return (
    <div className="ex-rampa">
      <div className="ex-rampa-hd">
        <span>Aproximación</span>
        <button type="button" className="linkcard" onClick={() => marcarCalentado(ex, false)}>Saltar</button>
      </div>
      <div className="ex-rampa-pasos" style={{ '--avance': avance }}>
        {rampa.map((s, i) => (
          <button
            key={i}
            type="button"
            className={`ex-paso${i < hechos ? ' hecho' : i === hechos ? ' cur' : ''}`}
            aria-label={`${Math.round(s.pct * 100)}%: ${wDisplay(s.w)} por ${s.reps}${i < hechos ? ', hecho' : ''}`}
            onClick={() => tocar(i)}
          >
            <i>{i < hechos ? <Check size={15} /> : `${Math.round(s.pct * 100)}%`}</i>
            <b>{wDisplay(s.w)}</b>
            <span>× {s.reps}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Las series hechas como tabla (2026-09-25). Antes cada serie era un chip,
   y un unilateral de 2 series eran 4 chips ("15×10 I · 15×10 D…"). Ahora
   una fila por serie; en unilateral "Izquierda / Derecha" se dice UNA vez,
   en el encabezado. Borrar pide confirmación y borra la fila entera: antes
   un toque en el chip borraba al instante, y borrar un solo lado corría
   todas las filas de abajo. */
function filasDeSeries(done, uni) {
  if (!uni) return done.map((s, i) => ({ idx: [i], w: [s.w], r: s.r }));
  const filas = [];
  for (let i = 0; i < done.length; i += 2) {
    const par = done.slice(i, i + 2).map((s, k) => ({ ...s, i: i + k }));
    const izq = par.find(s => s.side === 'left') || (par[0].side !== 'right' ? par[0] : null);
    const der = par.find(s => s !== izq) || null;
    filas.push({ idx: par.map(s => s.i), w: par.map(s => s.w), izq: izq?.r ?? null, der: der?.r ?? null });
  }
  return filas;
}

function TablaSeries({ exId, done, uni, unidad }) {
  const filas = filasDeSeries(done, uni);
  function borrar(f, n) {
    openSheet('confirm', {
      title: `¿Borrar la serie ${n}?`,
      body: uni ? 'Se borran los dos lados de esa serie.' : 'Se borra lo que anotaste en esa serie.',
      confirmLabel: 'Borrar',
      onConfirm: async () => { for (const i of [...f.idx].sort((a, b) => b - a)) await deleteSet(exId, i); },
    });
  }
  return (
    <table className="ex-tabla">
      <thead>
        <tr>
          <th scope="col"><span className="sr-only">Serie</span></th>
          <th scope="col">Peso</th>
          {uni ? <><th scope="col" className="c">Izquierda</th><th scope="col" className="c">Derecha</th></> : <th scope="col" className="c">Reps</th>}
          <th scope="col"><span className="sr-only">Borrar</span></th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f, k) => {
          const pesos = [...new Set(f.w.map(w => wDisplay(w)))];
          return (
            <tr key={k}>
              <td className="n">{k + 1}</td>
              <td><b>{pesos.join(' / ')}</b> {unidad}</td>
              {uni
                ? <><td className="c"><b>{f.izq ?? '—'}</b></td><td className="c"><b>{f.der ?? '—'}</b></td></>
                : <td className="c"><b>{f.r}</b></td>}
              <td className="x">
                <button type="button" aria-label={`Borrar la serie ${k + 1}`} onClick={() => borrar(f, k + 1)}><X size={14} /></button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* La comparativa, como aviso (2026-09-25, pedido de Enzo): las dos cajas
   fijas ocupaban media tarjeta para algo que se lee UNA vez, al arrancar el
   ejercicio. Ahora aparece flotando sobre la tarjeta cuando el ejercicio se
   activa, se va sola a los AVISO_MS (la rayita de abajo lo cuenta) o al
   tocarla, y la etiqueta "Últ." del encabezado la vuelve a traer — en la
   serie 3 también hace falta saber qué hiciste la vez pasada.
   Una vez por ejercicio y por sesión (id del borrador): volver a Hoy desde
   otra pestaña remonta la tarjeta y no tiene que repetirlo. */
const yaAvisadas = new Set();
const AVISO_MS = 4000;

function AvisoUltimaVez({ visible, onCerrar, last, obj, uni }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onCerrar, AVISO_MS);
    return () => clearTimeout(t);
  }, [visible, onCerrar]);
  return (
    <div className="ex-aviso-ancla">
      <AnimatePresence>
        {visible && (
          <motion.div
            className="ex-aviso"
            role="status"
            onClick={onCerrar}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: D.objeto / 1000, ease: curvaSalida } }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: D.toque / 1000 } }}
          >
            <button type="button" className="ex-aviso-x" aria-label="Cerrar" onClick={e => { e.stopPropagation(); onCerrar(); }}>✕</button>
            <Comparativa last={last} obj={obj} uni={uni} />
            <i className="ex-aviso-reloj" aria-hidden="true" style={{ animationDuration: `${AVISO_MS}ms` }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Las tarjetas que ya se abrieron en esta sesión de la app: la que se abre
   por primera vez se despliega hacia abajo; la que ya estaba abierta (volviste
   a Hoy desde otra pestaña, y Hoy se remonta entero) aparece ya abierta. Si
   se animara en cada visita sería el "segundo movimiento" que motion.js
   documenta haber sacado de los cambios de pestaña. */
const yaAbiertas = new Set();

/* El despliegue de la tarjeta activa: la altura crece y adentro las piezas
   entran en orden — serie, aproximación, ruedas, botón. Mismos tiempos que el
   resto de la app (D.panel para lo grande, pasos cortos entre piezas). */
const curvaSalida = EASE_OUT.match(/[\d.]+/g).map(Number);
const desplegar = {
  oculto: { height: 0, opacity: 0 },
  visible: {
    height: 'auto', opacity: 1,
    transition: { duration: D.panel / 1000, ease: curvaSalida, when: 'beforeChildren', staggerChildren: 0.05 },
  },
};
const pieza = {
  oculto: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: D.objeto / 1000, ease: curvaSalida } },
};

function ExerciseSlide({ m, wd, started }) {
  const { ex, done, target, skipped, full, open, isNext, waiting } = m;
  const v = ensureVals(ex);
  const last = lastDataFor(ex);
  const info = exInfo(ex.name);
  // "Un lado por vez": lo que dice la rutina, salvo que la máquina de HOY te
  // haya obligado a cambiarlo (ver isUnilateral en session.js).
  const uni = isUnilateral(ex);
  // D1/D6: lo que Enzo cuenta en el gimnasio es la SERIE, no el lado — la
  // fila sigue siendo por lado (targetSets ya la duplicó), pero toda cifra
  // que se le muestra a Enzo tiene que pasar por seriesCompletas() antes de
  // pintarse. serieAMedias marca la fila impar: hiciste un lado, falta el
  // otro — v.side ya quedó apuntando al lado pendiente (saveSet lo alterna).
  const serieObjetivo = seriesCompletas(target, uni);
  const serieHechas = seriesCompletas(done.length, uni);
  const serieAMedias = uni && done.length % 2 === 1;
  /* El esquema de esfuerzo va sobre SERIES REALES, nunca sobre filas: en
     unilateral cada serie real son dos filas, y armarlo sobre filas convertía
     un 4×10 en rirScheme(8) = 7/6/5/4/3/2/1/0 ("pedía RIR 6"). El índice
     también es en series, y tiene que coincidir clavado con el que calcula
     saveSet() en session.js para la pregunta del descanso: si se tocan estas
     cuentas, se tocan las dos. */
  const scheme = rirScheme(serieObjetivo, ex.name);
  const curRir = rirPedido(scheme, serieHechas);
  // Sin historial propio: primera vez en ESTE equipo. Mostramos de dónde venís
  // en las otras variantes, sin traducir el número (ver relatedHistory).
  const related = last ? [] : relatedHistory(ex, S.sessions);
  // D3: si es unilateral y nunca se registró bajo esa clave, puede haber
  // historial bilateral — es otra carga, así que sólo sirve para decir
  // "tenés algo, pero no esto", nunca como si fuera la carga unilateral.
  const lastBilateral = (uni && !last) ? lastDataFor({ ...ex, unilateral: false }) : null;
  // Aviso raro, no diario: sólo si el desbalance izq/der es un patrón sostenido.
  const imbalance = uni ? sideImbalance(ex) : null;
  const obj = (!full && !skipped) ? objetivoHoy(ex, { uni, ajuste: S.draft?.precheckAdjust || 0 }) : null;

  /* La rampa de aproximación (50/75/90%), ahora ADENTRO de la tarjeta del
     ejercicio que la necesita y sólo antes de su primera serie. Se calcula
     sobre el peso de HOY que dice la tarjeta (objetivoHoy) o la última vez:
     nunca sobre el relleno de 20 kg de ensureVals(), que daría tres pesos
     inventados con toda la pinta de ser reales. */
  const calentar = open && done.length === 0 && tocaCalentar(S.draft, ex);
  const rampa = calentar ? warmupSets(obj?.peso ?? last?.at(-1)?.w, wStep()) : [];

  const unidad = S.cfg.unit === 'kg' ? 'kg' : 'lb';
  const altRef = useRef(null), pwRef = useRef(null), valRef = useRef(null);
  // altRef/pwRef sin controlar (refs, no state): son texto derivado que cambia
  // con cada peso y no vale un bump() de toda la app — peso/reps viven enteros
  // dentro de ReelPicker.jsx.
  function syncDependents() {
    if (altRef.current) altRef.current.textContent = wAltPartes(v.w).n;
    if (valRef.current) valRef.current.textContent = `${wDisplay(v.w)} ${unidad} × ${v.r}`;
    if (pwRef.current) {
      const warn = progressionWarn(ex.name, v.w);
      pwRef.current.style.display = warn ? '' : 'none';
      pwRef.current.textContent = warn ? `⚠ ${warn}` : '';
    }
  }
  // La rueda (gesto, rueda fina o edición manual — ver ReelPicker.jsx)
  // entrega siempre un valor absoluto en kg.
  function setW(newW) { v.w = Math.max(0, round1(newW)); syncDependents(); }
  function setR(newR) { v.r = Math.max(1, Math.round(newR)); syncDependents(); }

  const animar = useMemo(() => open && !yaAbiertas.has(ex.id) && !menosMovimiento(), [open, ex.id]);
  useEffect(() => { if (open) yaAbiertas.add(ex.id); }, [open, ex.id]);

  const hayComparativa = !!obj && (!!last || obj.tipo !== 'primera');
  const ultima = ultimaVez(last);
  const [aviso, setAviso] = useState(false);
  const cerrarAviso = useCallback(() => setAviso(false), []);
  /* Al activarse el ejercicio: después del despliegue de la tarjeta, no
     encima de él (serían dos movimientos peleándose por la mirada). Y nunca
     debajo del descanso a pantalla completa: tras la última serie el
     siguiente se activa solo, pero lo que se ve es el reloj — el aviso se
     habría ido sin que nadie lo leyera. Espera a que el reloj se achique o
     termine, y recién ahí se marca como mostrado. */
  const tapado = T.state === 'fullscreen' || T.state === 'ringing';
  useEffect(() => {
    const clave = `${S.draft?.id}|${ex.id}`;
    if (!open || !hayComparativa || tapado || yaAvisadas.has(clave)) return;
    const t = setTimeout(() => { yaAvisadas.add(clave); setAviso(true); }, animar ? D.panel : 0);
    return () => clearTimeout(t);
  }, [open, hayComparativa, ex.id, animar, tapado]);

  const pwarnInitial = open ? progressionWarn(ex.name, v.w) : null;
  const cls = [full ? 'full doneex' : '', open ? 'cur' : '', waiting ? 'wait' : '', skipped ? 'skipped' : ''].filter(Boolean).join(' ');
  const gymId = S.cfg.activeGym;
  const rirTxt = scheme?.length ? `${scheme[0]} → ${scheme[scheme.length - 1] === 0 ? 'fallo' : scheme[scheme.length - 1]}` : null;

  return (
    <div className="carousel-slide" data-exid={ex.id}>
      <div className={`card ex-card ${cls}`} id={`exc-${ex.id}`} style={{ '--done': Math.min(1, done.length / target) }}>
        {/* Encabezado: el dibujo del movimiento, el nombre con sus datos fijos
            como etiquetas, y a la derecha lo que es DE ESTA máquina (la foto)
            y las opciones. Las opciones arriba y como botón, no en un
            acordeón al fondo: Enzo, "si no hacés scroll no te das cuenta". */}
        <div className="exh">
          <ExIcon icono={iconOf(ex)} size={34} className="exh-icon" />
          <div className="exh-main">
            <div className="exname">
              {ex.name}{uni && <span className="txt-blue"> · unilateral</span>}{' '}
              {info && (
                <button
                  type="button"
                  className="mini info inline"
                  aria-label={`Qué trabaja ${ex.name}`}
                  onClick={() => openSheet('ex-info', { name: ex.name, wd, exId: ex.id })}
                >
                  <Info />
                </button>
              )}
            </div>
            {/* Cambiaste éste por otro: el original ya no está en la lista,
                pero queda dicho de dónde salió. */}
            {reemplazaA(ex.id) && <div className="ex-envez">en vez de {reemplazaA(ex.id)}</div>}
            {equipLabel(ex) && <div className="ex-equipo">{equipLabel(ex)}</div>}
          </div>
          <div className="exh-side">
            {gymId && <FotoMaquina gymId={gymId} exName={ex.name} />}
            {open && (
              <button
                type="button"
                className="ex-opts"
                aria-label={`Opciones de ${ex.name}`}
                onClick={() => openSheet('ex-opciones', { exId: ex.id, wd })}
              >
                <Dots />
              </button>
            )}
          </div>
        </div>

        {/* Los datos fijos del ejercicio como tablero, no como burbujas
            (Enzo, 2026-09-25: "que parezca menos generado por IA"). "Sesión
            anterior" y no "Última": última podía ser cualquier cosa. */}
        {!skipped && (
          <div className="ex-meta">
            <div>
              <small>Series</small>
              <b>{serieObjetivo} × {ex.reps}{serieObjetivo > ex.sets && <span className="txt-blue"> +{serieObjetivo - ex.sets}</span>}</b>
            </div>
            {rirTxt && !full && <div><small>RIR</small><b>{rirTxt}</b></div>}
            {hayComparativa && ultima ? (
              <button type="button" className="ex-meta-ant" aria-label={`Sesión anterior: ${ultima.peso}. Ver la comparación con hoy`} onClick={() => setAviso(a => !a)}>
                <small>Sesión anterior</small><b>{ultima.peso}</b>
              </button>
            ) : (
              <div><small>Sesión anterior</small><b className="text-mut">—</b></div>
            )}
          </div>
        )}
        {hayComparativa && <AvisoUltimaVez visible={aviso} onCerrar={cerrarAviso} last={last} obj={obj} uni={uni} />}
        {/* D3: la ausencia de dato no es un cero. */}
        {!last && uni && !full && !skipped && (
          <div className="exlast text-mut">
            Primera vez unilateral{lastBilateral ? ' · tu historial es bilateral, otra carga' : ''}.
          </div>
        )}
        {!last && !lastBilateral && !full && !skipped && (
          <div className="ex-first">
            <div className="t">Primera vez{equipLabel(ex) ? ` en ${equipLabel(ex)}` : ''}</div>
            {related.length > 0 && (
              <div className="s">
                Este ejercicio lo venís haciendo en {related.map(r => `${r.label} (${fmtNum(round1(r.w))}×${r.r})`).join(' · ')}.
              </div>
            )}
            <div className="s">
              Arrancá claramente liviano y subí hasta que las {ex.reps} reps te queden con 2 en
              reserva. Lo que anotes hoy queda como tu punto de partida.
            </div>
          </div>
        )}

        {full && <div className="ex-state ok">✓ Completo · {serieObjetivo} de {serieObjetivo} series</div>}
        {waiting && <div className="ex-state">En espera · {serieHechas ? `${serieHechas}${serieAMedias ? '½' : ''}/${serieObjetivo} series` : 'te toca después'}</div>}
        {/* Omitido: la tarjeta se queda donde está, apagada. Restablecer la
            devuelve exactamente a su lugar porque omitir no toca draft.order. */}
        {skipped && (
          <>
            <div className="ex-state skip"><Skip size={13} /> Omitido{serieHechas ? ` · ${serieHechas}${serieAMedias ? '½' : ''} serie${serieHechas === 1 && !serieAMedias ? '' : 's'} registrada${serieHechas === 1 && !serieAMedias ? '' : 's'}` : ''}</div>
            <button type="button" className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => unskipExercise(ex.id)}>
              ↺ Restablecer
            </button>
          </>
        )}
        {full && (
          <button type="button" className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => addExtraSet(ex.id)}>
            + Una serie más
          </button>
        )}

        {/* Antes de empezar: una sola acción grande. "Empezar rutina" se
            toca UNA vez (arranca el cronómetro); después cada ejercicio se
            activa solo al terminar el anterior. Todo lo demás (series,
            unilateral, cambiar) recién tiene sentido con el ejercicio en
            marcha, así que acá sólo quedan las dos salidas del "no puedo
            hacerlo ahora". */}
        {isNext && (
          <div className="ex-pre">
            <button type="button" className="btn" onClick={() => startExercise(ex)}>
              {started ? '▶ Hacer ahora' : '▶ Empezar rutina'}
            </button>
            <div className="ex-pre-links">
              <button type="button" className="linkcard" onClick={() => hacerDespues(ex.id)}><Later size={14} /> Hacer después</button>
              <button type="button" className="linkcard" onClick={() => confirmarOmitir(ex)}><Skip size={13} /> Omitir ejercicio</button>
            </div>
          </div>
        )}

        {open && (
          <motion.div className="ex-live" variants={desplegar} initial={animar ? 'oculto' : false} animate="visible">
            <motion.div variants={pieza} className="ex-serie">
              <div className="ex-serie-top">
                <span>
                  <b className="cond">Serie {serieHechas + 1} de {serieObjetivo}</b>
                  {' · '}{curRir === 0 ? <b className="txt-blue">al fallo</b> : `RIR ${curRir}`}
                  {/* Unilateral: el lado que toca, tocable para cambiarlo. Antes
                      eran dos chips "Izquierda / Derecha" en una fila propia. */}
                  {uni && (
                    <>
                      {' · '}
                      <button type="button" className="ex-lado" aria-label={`Lado: ${v.side === 'left' ? 'izquierda' : 'derecha'}. Tocá para cambiar`} onClick={() => setSide(ex.id, v.side === 'left' ? 'right' : 'left')}>
                        {v.side === 'left' ? 'izquierda' : 'derecha'} ⇄
                      </button>
                    </>
                  )}
                </span>
                <button type="button" className="ex-despues" onClick={() => hacerDespues(ex.id)}>
                  <Later size={14} /> Después
                </button>
              </div>
              <div className="ex-seg" aria-hidden="true">
                {Array.from({ length: serieObjetivo }, (_, i) => (
                  <i key={i} className={i < serieHechas ? 'on' : i === serieHechas ? 'cur' : ''} />
                ))}
              </div>
            </motion.div>

            {calentar && (
              <motion.div variants={pieza}>
                {rampa.length ? <Rampa ex={ex} rampa={rampa} /> : (
                  <div className="ex-aprox">
                    <div className="ex-aprox-t">
                      <span className="txt-warn">Aproximación</span>{' · '}3 series subiendo hasta tu peso de trabajo: 5, 3 y 1 reps
                    </div>
                    <div className="ex-aprox-acts">
                      <button type="button" className="chip" onClick={() => marcarCalentado(ex, true)}>Hecho</button>
                      <button type="button" className="linkcard" onClick={() => marcarCalentado(ex, false)}>Saltar</button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <div className="prog-warn" ref={pwRef} style={{ display: pwarnInitial ? '' : 'none' }}>
              {pwarnInitial ? `⚠ ${pwarnInitial}` : ''}
            </div>
            {imbalance && (
              <div className="prog-warn" style={{ marginBottom: 8 }}>
                ⚠ {imbalance.strongerSide === 'left' ? 'Izquierda' : 'Derecha'} viene
                {' '}~{imbalance.pct}% más fuerte que el otro lado, sostenido en las
                últimas sesiones.
              </div>
            )}
            {/* Peso y reps lado a lado: las ruedas ya no tienen botones ±
                (eran la razón de apilarlas), así que a media tarjeta cada una
                muestra su número y los vecinos, y le devuelve media pantalla
                de alto al resto de la tarjeta (Enzo: "la rueda es muy
                grande"). */}
            <motion.div variants={pieza} className="setrows dos">
              <div>
                <div className="steplabel">Peso <span>{unidad}{uni ? ' / lado' : ''}</span></div>
                <ReelPicker
                  key={`w-${done.length}`}
                  value={v.w}
                  step={wStep()}
                  min={0.5}
                  fmt={n => wDisplay(n)}
                  toUnit={wToUnit}
                  fromUnit={wFromUnit}
                  onChange={setW}
                  label="Peso"
                />
                {/* La otra unidad, centrada bajo SU rueda y dicha como
                    equivalencia (≈), no como un dato más. */}
                <div className="reel-alt">≈ <b ref={altRef}>{wAltPartes(v.w).n}</b> {wAltPartes(v.w).u}</div>
              </div>
              <div>
                <div className="steplabel">Reps</div>
                <ReelPicker
                  key={`r-${done.length}`}
                  value={v.r}
                  step={1}
                  min={1}
                  onChange={setR}
                  label="Reps"
                />
              </div>
            </motion.div>
            <motion.div variants={pieza}>
              <button
                type="button"
                className="btn-serie"
                onClick={e => {
                  // "Juice" de videojuego: squash & stretch en el botón + una
                  // ráfaga de partículas en el punto de toque, sobre la acción
                  // más repetida de toda la app. saveSet() va después: la
                  // animación es visual y no depende del resultado.
                  squashStretch(e.currentTarget);
                  impactBurst(e.clientX, e.clientY, { color: 'var(--ok)' });
                  saveSet(ex.id);
                }}
              >
                <span className="btn-serie-ok" aria-hidden="true"><Check size={22} /></span>
                <span className="btn-serie-t">{uni ? (v.side === 'left' ? 'Izquierda' : 'Derecha') : `Serie ${serieHechas + 1}`} lista</span>
                {/* Lo que va a quedar anotado: se confirma de un vistazo antes
                    de tocar. Se actualiza con las ruedas (syncDependents). */}
                <small ref={valRef}>{wDisplay(v.w)} {unidad} × {v.r}</small>
              </button>
            </motion.div>
          </motion.div>
        )}

        {done.length > 0 && <TablaSeries exId={ex.id} done={done} uni={uni} unidad={unidad} />}
      </div>
    </div>
  );
}
