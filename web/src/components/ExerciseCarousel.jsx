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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { S, wDisplay, wAlt, wStep, wToUnit, wFromUnit, openSheet } from '../lib/state.js';
import { round1, fmtNum } from '../lib/format.js';
import { exInfo, rirScheme, progressionWarn } from '../lib/exdb.js';
import { suggestedWeight } from '../lib/charts.js';
import { progresion, progresionTexto } from '../lib/progression.js';
import {
  ensureVals, lastDataFor, setsDone, saveSet, deleteSet, startExercise,
  targetSets, isSkipped, skipExercise, unskipExercise, addExtraSet, dropSet, reemplazaA,
  isUnilateral, toggleUnilateral, setSide, seriesCompletas,
} from '../lib/session.js';
import { sideImbalance } from '../lib/symmetry.js';
import { shrinkImageBlob } from '../lib/photo.js';
import { toast } from '../lib/toast.js';
import { jumpToSlide, scrollToSlideEl, slideScrollLeft } from '../lib/carousel.js';
import { staggerRevealOnce, squashStretch, impactBurst, bloomOpen, menosMovimiento } from '../lib/motion.js';
import { relatedHistory, equipLabel, puedeSerUnilateral } from '../lib/equip.js';
import { getPhoto, savePhoto, deletePhoto } from '../lib/gyms.js';
import { iconOf } from '../lib/exicon.js';
import ExIcon from './ExIcon.jsx';
import ReelPicker from './ReelPicker.jsx';
import { Info, Skip, Swap } from './Icon.jsx';
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
const CF_MAX_OPACITY_DROP = 0.6;
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
       <details>) a `full` y el carrusel se achica a la mitad de alto en medio
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

/** Las tres salidas que el gimnasio real necesita y la app no daba: una serie
    de más, cambiar de ejercicio porque la máquina está ocupada, y saltarlo
    porque no te da el tiempo. Botones explícitos y no un menú escondido: se
    tocan jadeando y con las manos húmedas. */
function ExActions({ ex, wd, uni, puedeUni }) {
  function confirmarSalto() {
    openSheet('confirm', {
      title: `¿Saltar ${ex.name}?`,
      body: 'Queda marcado como saltado y pasás al siguiente. Podés restablecerlo en cualquier momento y vuelve a su lugar.',
      confirmLabel: 'Saltar',
      onConfirm: () => skipExercise(ex.id),
    });
  }
  return (
    <div className="ex-actions">
      {/* Sumar y quitar juntos: decidir "hoy hago una menos" es tan común como
          "hoy hago una más", y hasta ahora sólo se podía hacia arriba. */}
      <button type="button" className="ex-act" onClick={() => dropSet(ex.id)}>− Serie</button>
      <button type="button" className="ex-act" onClick={() => addExtraSet(ex.id)}>+ Serie</button>
      {/* Un botón de verdad, entre botones — no un chip inerte compitiendo con
          el título (Enzo, ver el handoff 2026-09-17). Sólo aparece donde
          puedeSerUnilateral(ex) lo permite; el estado on/off se lee igual que
          cualquier otro toggle de la app (fondo lleno + aria-pressed). */}
      {puedeUni && (
        <button
          type="button"
          className={`ex-act uni ${uni ? 'on' : ''}`}
          aria-pressed={uni}
          onClick={() => toggleUnilateral(ex.id)}
        >
          {uni ? '✓ Unilateral' : 'Unilateral'}
        </button>
      )}
      {/* "Cambiar" no decía QUÉ cambia. Enzo: "está malísimo" — ahora dice la
          acción completa, en la voz de la app. */}
      <button type="button" className="ex-act" onClick={() => openSheet('ex-swap', { wd, exId: ex.id })}>
        <Swap /> Otro ejercicio
      </button>
      <button type="button" className="ex-act" onClick={confirmarSalto}><Skip /> Saltar</button>
    </div>
  );
}

/** Foto de "esta máquina, en este gym" (a pedido explícito de Enzo — ver el
    comentario de cabecera de gyms.js sobre por qué es un ángulo propio y no
    un catálogo tipo TRACKED): un campo más del registro equip[exKey], no
    una pantalla aparte. Sólo aparece con un gym activo — sin eso no hay a
    qué gym atar la foto. Sin foto, el chip saca una. CON foto, tocar la
    miniatura MUESTRA la foto (sheet 'gym-photo') — antes reabría la cámara
    directamente, y eso era destruir lo que el control decía mostrar (Enzo:
    "solo me la debería mostrar"). Reemplazar y borrar viven adentro de ese
    preview, detrás del confirm genérico.

    El <input> de la cámara se queda ACÁ y no se duplica en el sheet: el sheet
    lo dispara por callback. Un input `display:none` responde igual a .click()
    aunque la pantalla de atrás esté oculta mientras el sheet se cierra, que es
    exactamente el mismo truco del que ya dependía este componente. */
function GymPhoto({ gymId, exName }) {
  const [url, setUrl] = useState(null);
  const inputRef = useRef(null);
  const urlRef = useRef(null);

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
      // este catch era un rechazo no manejado y la miniatura no aparecía nunca
      // sin ninguna señal de por qué.
      if (!cancelled) setUrl(null);
    });
    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [gymId, exName]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Comprimir ANTES de guardar (480px / JPEG 70 → ~50 KB en vez de varios
    // MB), y no mostrar la miniatura hasta que la escritura haya terminado
    // bien: antes se hacía setUrl() pase lo que pase, así que si el guardado
    // fallaba por cuota el usuario veía su foto y creía que había quedado —
    // al volver no estaba.
    let blob;
    try {
      blob = await shrinkImageBlob(file);
    } catch {
      toast('No se pudo leer esa imagen');
      return;
    }
    try {
      await savePhoto(gymId, exName, blob);
    } catch {
      toast('No se pudo guardar la foto (¿sin espacio?)');
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const next = URL.createObjectURL(blob);
    urlRef.current = next;
    setUrl(next);
  }

  async function borrarFoto() {
    try {
      await deletePhoto(gymId, exName);
    } catch {
      toast('No se pudo borrar la foto');
      return;
    }
    // Revocar SIEMPRE antes de soltar la referencia: si la foto ya no está en
    // el store, una miniatura siguiendo viva sería una foto que no existe.
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
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

  return (
    <div className="gym-photo">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={onFile}
      />
      {url ? (
        <button type="button" className="gym-photo-thumb" onClick={verFoto} aria-label={`Ver la foto de la máquina de ${exName}`}>
          <img src={url} alt="" />
        </button>
      ) : (
        <button type="button" className="chip" onClick={() => inputRef.current?.click()}>
          📷 Foto de la máquina
        </button>
      )}
    </div>
  );
}

function ExerciseSlide({ m, wd, started }) {
  const { ex, done, target, skipped, full, open, isNext, waiting } = m;
  const v = ensureVals(ex);
  const last = lastDataFor(ex);
  // el esquema se arma sobre el objetivo de HOY: con una serie extra concedida
  // hay que darle un RIR también a esa
  const scheme = rirScheme(target, ex.name);
  const curSet = Math.min(done.length, target - 1);
  const curRir = scheme[curSet];
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
  const puedeUni = puedeSerUnilateral(ex);
  // Sin historial propio: primera vez en ESTE equipo. Mostramos de dónde venís
  // en las otras variantes, sin traducir el número (ver relatedHistory).
  const related = last ? [] : relatedHistory(ex, S.sessions);
  // D3: si es unilateral y nunca se registró bajo esa clave, puede ser que
  // SÍ haya historial bilateral del mismo ejercicio (acabás de prender el
  // interruptor). No es el mismo dato — 40kg bilateral y 25kg unilateral no
  // son comparables — así que sólo sirve para decir "tenés algo, pero no
  // esto", nunca para mostrarlo como si fuera la carga unilateral.
  const lastBilateral = (uni && !last) ? lastDataFor({ ...ex, unilateral: false }) : null;
  // Aviso raro, no diario (mismo criterio que lowMicros): sólo si el
  // desbalance izq/der es un patrón sostenido en varias sesiones.
  const imbalance = uni ? sideImbalance(ex) : null;

  const altRef = useRef(null), pwRef = useRef(null);
  const moreBodyRef = useRef(null);

  // altRef/pwRef siguen sin controlar (refs, no state) por la misma razón de
  // siempre: son texto derivado que cambia con cada serie/peso y no vale la
  // pena un bump() de toda la app por eso. Ya no hay ningún input que
  // sincronizar acá — peso/reps viven enteros dentro de ReelPicker.jsx.
  function syncDependents() {
    if (altRef.current) altRef.current.textContent = wAlt(v.w);
    if (pwRef.current) {
      const warn = progressionWarn(ex.name, v.w);
      pwRef.current.style.display = warn ? '' : 'none';
      pwRef.current.textContent = warn ? `⚠ ${warn}` : '';
    }
  }
  // La rueda (gesto, rueda fina o edición manual — ver ReelPicker.jsx)
  // entrega siempre un valor absoluto en kg.
  function setW(newW) { v.w = Math.max(0, round1(newW)); syncDependents(); }
  function setR(newR) { v.r = Math.max(1, Math.round(newR)); }

  const prog = open ? progresion(ex) : null;
  const pwarnInitial = open ? progressionWarn(ex.name, v.w) : null;
  const cls = [full ? 'full doneex' : '', open ? 'cur' : '', waiting ? 'wait' : '', skipped ? 'skipped' : ''].filter(Boolean).join(' ');

  return (
    <div className="carousel-slide" data-exid={ex.id}>
      <div className={`card ex-card ${cls}`} id={`exc-${ex.id}`} style={{ '--done': Math.min(1, done.length / target) }}>
        {/* key=done.length: fuerza a React a remontar el nodo cada vez que el
            número cambia, así el "pop" de styles.css se repite en cada serie
            (el mismo truco que ya usa App.jsx con key={store.tab} para la
            animación de deslizamiento — sin un key nuevo, React reusa el
            nodo y el @keyframes nunca vuelve a correr). Antes esta cuenta
            saltaba de "1/3" a "2/3" sin ningún acuse de recibo propio: el
            chip nuevo hacía pop, el riel lateral se llenaba, pero el número
            que en verdad resume el progreso quedaba mudo. */}
        <div key={done.length} className={`ex-done-count ${full ? 'full' : ''}`}>
          {serieHechas}{serieAMedias ? '½' : ''}/{serieObjetivo}
        </div>
        <ExIcon icono={iconOf(ex)} size={38} className="ex-card-icon" />
        <div className="exname-row">
          <div className="exname">
            {ex.name}{uni && <span className="txt-blue"> (unilateral)</span>}{' '}
            {info && (
              <button
                type="button"
                className="mini info inline"
                onClick={() => openSheet('ex-info', { name: ex.name, wd, exId: ex.id })}
              >
                <Info />
              </button>
            )}
          </div>
        </div>
        {/* Cambiaste éste por otro: el original ya no está en la lista, pero
            queda dicho de dónde salió. */}
        {reemplazaA(ex.id) && (
          <div className="ex-envez">en vez de {reemplazaA(ex.id)}</div>
        )}
        <div className="extarget">
          Objetivo {serieObjetivo} × {ex.reps}
          {serieObjetivo > ex.sets && <span className="txt-blue"> (+{serieObjetivo - ex.sets} hoy)</span>}
          {open && (
            <>
              {' '}· serie {serieHechas + 1} → {curRir === 0 ? <b className="txt-blue">al fallo</b> : `RIR ${curRir}`}
              {serieAMedias && <> · falta {v.side === 'left' ? 'izquierda' : 'derecha'}</>}
            </>
          )}
        </div>
        {last && (
          <div className="exlast">
            Última vez: {last.map(s => `${fmtNum(round1(s.w))}×${s.r}`).join(' · ')} kg
            {uni && ' por lado'}
          </div>
        )}
        {/* D3: la ausencia de dato no es un cero. Si es unilateral y nunca se
            registró bajo esa clave, se dice — nunca se disfraza el número
            bilateral (que es otra carga, no traducible 1 a 1) de sugerido
            unilateral. */}
        {!last && uni && (
          <div className="exlast text-mut">
            Sin registro unilateral todavía{lastBilateral ? ' (tenés historial bilateral de este ejercicio, pero es una carga distinta)' : ''}.
          </div>
        )}
        {/* Doble progresión: la instrucción concreta de hoy. Va ANTES del
            sugerido por 1RM y lo reemplaza cuando existe — un 1RM estimado da
            un número correcto pero no una instrucción: no sabe qué hiciste la
            semana pasada, así que no puede decirte si hoy te toca avanzar o
            sostener. Cuando no hay historial todavía, el sugerido por 1RM
            sigue siendo lo mejor que se puede decir. */}
        {open && prog && (
          <div className={`prog-next${prog.accion === 'subir_peso' ? ' up' : ''}`}>
            {prog.accion === 'subir_peso' ? '↑ ' : ''}{progresionTexto(prog)}
          </div>
        )}
        {(() => {
          // D4: el 1RM estimado también se parte por lateralidad — sin el
          // sufijo, un unilateral recién activado heredaría el sugerido
          // bilateral (otra carga) disfrazado de dato propio.
          const base = suggestedWeight(uni ? `${ex.name} (unilateral)` : ex.name);
          if (!base || !open || prog) return null;
          // El ajuste del chequeo de 3 preguntas (Plan Fierro · Fase 3) se
          // aplica acá — S.draft.precheckAdjust queda en 0 si no se
          // contestó nada, así que no cambia nada para quien no lo usa.
          const adj = S.draft?.precheckAdjust || 0;
          const sug = round1(base * (1 + adj));
          return (
            <div className="text-mut text-micro mt-1">
              Sugerido hoy: ~{fmtNum(sug)} kg (80% de tu 1RM estimado{adj !== 0 ? `, ${adj > 0 ? '+' : ''}${Math.round(adj * 100)}% por tu chequeo` : ''})
            </div>
          );
        })()}
        {!last && !lastBilateral && equipLabel(ex) && (
          <div className="ex-first">
            <div className="t">Primera vez en {equipLabel(ex)}</div>
            {related.length > 0 && (
              <div className="s">
                Este ejercicio lo venís haciendo en {related.map(r => `${r.label} (${fmtNum(round1(r.w))}×${r.r})`).join(' · ')}.
              </div>
            )}
            <div className="s">
              Ese número no se traslada: cada sistema mueve una carga distinta. Arrancá
              claramente liviano y subí hasta que las {ex.reps} reps te queden con 2 en
              reserva. Lo que anotes hoy queda como tu punto de partida acá.
            </div>
          </div>
        )}
        {full && <div className="ex-state ok">✓ Completo · {serieObjetivo} de {serieObjetivo} series</div>}
        {waiting && <div className="ex-state">En espera · {serieHechas ? `${serieHechas}${serieAMedias ? '½' : ''}/${serieObjetivo} series` : 'te toca después'}</div>}
        {/* Saltado: la tarjeta se queda donde está, apagada. Restablecer la
            devuelve exactamente a su lugar porque saltar no toca draft.order. */}
        {skipped && (
          <>
            <div className="ex-state skip"><Skip size={13} /> Saltado{serieHechas ? ` · ${serieHechas}${serieAMedias ? '½' : ''} serie${serieHechas === 1 && !serieAMedias ? '' : 's'} registrada${serieHechas === 1 && !serieAMedias ? '' : 's'}` : ''}</div>
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
        {isNext && (
          <>
            <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => startExercise(ex)}>
              ▶ Iniciar ejercicio
            </button>
            <div className="txt-mut" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              Dale cuando estés en la máquina{!started ? ' — acá arranca el cronómetro' : ''}
            </div>
            <ExActions ex={ex} wd={wd} uni={uni} puedeUni={puedeUni} />
          </>
        )}
        {open && (
          <>
            <div className="prog-warn" ref={pwRef} style={{ display: pwarnInitial ? '' : 'none' }}>
              {pwarnInitial ? `⚠ ${pwarnInitial}` : ''}
            </div>
            {uni && (
              <div className="setrows" style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  className={`chip ${v.side === 'left' ? 'on' : ''}`}
                  aria-pressed={v.side === 'left'}
                  onClick={() => setSide(ex.id, 'left')}
                >
                  Izquierda
                </button>
                <button
                  type="button"
                  className={`chip ${v.side === 'right' ? 'on' : ''}`}
                  aria-pressed={v.side === 'right'}
                  onClick={() => setSide(ex.id, 'right')}
                >
                  Derecha
                </button>
              </div>
            )}
            {imbalance && (
              <div className="prog-warn" style={{ marginBottom: 8 }}>
                ⚠ {imbalance.strongerSide === 'left' ? 'Izquierda' : 'Derecha'} viene
                {' '}~{imbalance.pct}% más fuerte que el otro lado, sostenido en las
                últimas sesiones.
              </div>
            )}
            <div className="setrows">
              <div>
                <div className="steplabel">Peso ({S.cfg.unit === 'kg' ? 'kg' : 'lb'}){uni ? ' por lado' : ''}</div>
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
                <div className="reel-alt" ref={altRef}>{wAlt(v.w)}</div>
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
            </div>
            <button
              type="button"
              className="btn"
              onClick={e => {
                // "Juice" de videojuego: squash & stretch en el botón + una
                // ráfaga de partículas en el punto de toque, sobre la acción
                // más repetida de toda la app — el equivalente a un "hit"
                // en un juego. saveSet() se llama después de disparar el
                // feedback: la animación es puramente visual y no bloquea
                // ni depende del resultado.
                squashStretch(e.currentTarget);
                impactBurst(e.clientX, e.clientY, { color: 'var(--ok)' });
                saveSet(ex.id);
              }}
            >
              ✓ Terminé la serie {serieHechas + 1} de {serieObjetivo}
              {uni && ` · lado ${v.side === 'left' ? 'izquierdo' : 'derecho'}`}
            </button>
            {/* Todo lo que NO es peso, reps y confirmar vive acá abajo,
                cerrado. El core loop de una serie es "elegí el peso, elegí
                las reps, confirmá": cada cosa más que compita por ese
                espacio es peaje que se paga entre 15 y 30 veces por sesión,
                con el pulso a 150 y el teléfono en una mano. El toggle "un
                lado por vez" YA NO vive acá (Enzo: tiene que estar a la
                vista) — subió junto al nombre del ejercicio.

                El RIR tampoco vive más acá, y por eso el rótulo dejó de
                decir "de esta serie": adentro ya no queda nada que sea de
                una serie en particular —la foto de la máquina y las
                acciones son del EJERCICIO— y el rótulo viejo pasó a ser
                mentira. La pregunta del esfuerzo se mudó al overlay de
                descanso (RestTimer.jsx): acá abajo, escondida detrás de un
                acordeón y ANTES de confirmar, no la abría nadie, que es la
                forma cara de no tener el dato (Enzo: "le doy 'terminé' e
                inicia mi descanso, y se me olvida").

                <details> nativo y no un estado de React a propósito: viene
                con el teclado, el foco y el anuncio de abierto/cerrado ya
                resueltos. Se estiliza como el resto de la app (chip/card) en
                vez de dejarlo con la pinta nativa del navegador — la queja
                concreta de Enzo era que ese control desentonaba con todo lo
                demás. */}
            <details
              className="ex-more"
              onToggle={e => { if (e.currentTarget.open) bloomOpen(moreBodyRef.current); }}
            >
              <summary className="chip ex-more-summary">Más opciones del ejercicio</summary>
              <div className="ex-more-body" ref={moreBodyRef}>
                {S.cfg.activeGym && <GymPhoto gymId={S.cfg.activeGym} exName={ex.name} />}
                <ExActions ex={ex} wd={wd} uni={uni} puedeUni={puedeUni} />
              </div>
            </details>
          </>
        )}
        {done.length > 0 && (
          <div className="chips setchips">
            {done.map((s, i) => (
              <button
                key={i}
                type="button"
                className="chip blue"
                aria-label={`Borrar serie: ${fmtNum(round1(s.w))} kg por ${s.r}`}
                onClick={() => deleteSet(ex.id, i)}
              >
                {fmtNum(round1(s.w))}kg × {s.r}<span className="x">✕</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
