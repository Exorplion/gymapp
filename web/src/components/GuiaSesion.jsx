// La guía de la sesión en vivo: un globito que señala UN control por vez
// (opción B "Globo", docs/referencias-guia-sesion.html). Qué aviso toca lo
// decide lib/guia.js (pistaQueToca); acá se busca el control en la pantalla,
// se espera a que la tarjeta termine de moverse y se pinta el globo con su
// anillo que late. No bloquea nada ni oscurece: se va cuando usás el control
// (marcarGuia desde la acción) o tocás la ✕.
//
// Vive en App, fuera de las pantallas: Hoy queda montada oculta entre visitas
// (<Activity>) y un portal colgado de ahí podía quedar a la vista en otra
// pestaña. Desde acá se ve todo lo que importa: la pestaña, la hoja abierta y
// el estado del descanso.
//
// Costo (H7): registrar una serie es el commit más vigilado de la app. Acá no
// se lee layout en ese commit: después de cada render sólo se buscan nodos
// (querySelector, sin layout). Se mide UNA vez cuando el globo aparece —tarde,
// cuando la tarjeta ya se acomodó— y otra vez sólo si cambia el tamaño de la
// tarjeta (ResizeObserver, que avisa después del layout que el navegador hace
// igual), la ventana, o si el carrusel terminó de deslizarse.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { S, useStore, versionDePantalla } from '../lib/state.js';
import { T } from '../lib/rest.js';
import { pistaQueToca, TEXTOS, marcarGuia, ubicarGlobo } from '../lib/guia.js';
import { D } from '../lib/motion.js';
import { X } from './Icon.jsx';

/* El control de cada aviso y de qué lado del control va el globo. El lado
   evita tapar lo que hace falta en ese momento: el de la rueda va arriba
   (abajo está el botón de la serie), el del botón y la tabla abajo (arriba
   están las ruedas), el del RIR arriba (abajo están −30s / +30s / Saltar). */
const LADO = { btn: 'abajo', rueda: 'arriba', rir: 'arriba', tabla: 'abajo', dots: 'abajo' };

/** Los controles que hay ahora en pantalla. Sólo busca nodos: nada de layout. */
function controles() {
  const card = document.querySelector('.ex-card.cur');
  return {
    btn: card?.querySelector('.btn-serie:not(.aprox)') || null,
    rueda: card?.querySelector('.setrows.dos') || null,
    tabla: card?.querySelector('.ex-tabla') || null,
    dots: card?.querySelector('.ex-opts') || null,
    rir: document.querySelector('#rest-fs.show:not(.out) .rfs-rir-caja:not(.cerrada) .rfs-rir') || null,
  };
}

/** Ejercicios de esta sesión con series, sin contar el abierto. */
function ejerciciosPrevios() {
  const d = S.draft;
  if (!d?.entries) return 0;
  return Object.keys(d.entries).filter(id => id !== d.cur && d.entries[id]?.sets?.length).length;
}

export default function GuiaSesion() {
  useStore();
  // La versión del store: cambia con cada bump() (fuera de una pantalla, la de verdad).
  const version = versionDePantalla(null);
  const [pista, setPista] = useState(null);
  const n = useRef(0);

  /* Después de cada bump, con el DOM ya escrito: ¿qué aviso toca y dónde
     está su control? Si es el mismo de antes no cambia nada (setPista
     devuelve el mismo objeto y React no vuelve a pintar). */
  useEffect(() => {
    let id = null, objetivo = null;
    if (S.tab === 'hoy' && S.draft && !S.sessionComplete) {
      const c = controles();
      id = pistaQueToca({
        hoja: !!S.sheet,
        descanso: T.state,
        hayRir: !!c.rir,
        hayBoton: !!c.btn,
        hayRueda: !!c.rueda,
        hayTabla: !!c.tabla,
        hayDots: !!c.dots,
        ejerciciosPrevios: ejerciciosPrevios(),
      }, S.cfg.guia?.visto);
      objetivo = id ? c[id] : null;
    }
    setPista(p => {
      if (p?.id === id && p?.objetivo === objetivo) return p;
      if (!id) return null;
      n.current++;
      return { id, objetivo, host: id === 'rir' ? objetivo.closest('.rfs-inner') : null, n: n.current };
    });
  }, [version]);

  if (!pista) return null;
  return (
    <Globo
      key={pista.n}
      id={pista.id}
      objetivo={pista.objetivo}
      host={pista.host}
    />
  );
}

/** Lo visible de la pantalla, debajo del encabezado y encima de lo que
    flota abajo (barra de pestañas, barra del descanso). */
function vistaDePantalla(ancho, alto) {
  const header = document.querySelector('header.top')?.getBoundingClientRect();
  const abajo = ['nav.tabbar', '#restbar.show']
    .map(s => document.querySelector(s)?.getBoundingClientRect().top)
    .filter(v => v != null && v > 0);
  return { top: header ? Math.max(0, header.bottom) : 0, bottom: Math.min(alto, ...abajo), width: ancho };
}

/* Cuánto espera el globo antes de aparecer: la tarjeta que se abre se
   despliega (--d3) y sus piezas entran escalonadas; el carrusel que viaja al
   ejercicio siguiente tarda otro tanto. Aparecer en el medio sería medir algo
   que todavía se mueve. */
const ESPERA = D.momento + D.panel;
/* El anillo, unos px por fuera del control, como .ex-paso.cur. */
const AIRE = 4;

function Globo({ id, objetivo, host }) {
  const ref = useRef(null);
  const [listo, setListo] = useState(false);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setListo(true), ESPERA);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!listo) return;
    let radio = null;
    function medir() {
      const g = ref.current;
      if (!g || !objetivo.isConnected) return;
      // Todas las lecturas juntas, antes de escribir nada.
      const r = objetivo.getBoundingClientRect();
      const w = g.offsetWidth, h = g.offsetHeight;
      const ancho = document.documentElement.clientWidth, alto = window.innerHeight;
      const vista = host ? { top: 0, bottom: alto, width: ancho } : vistaDePantalla(ancho, alto);
      const base = host ? host.getBoundingClientRect() : { left: -window.scrollX, top: -window.scrollY };
      // Sin radio propio (el par de ruedas es una grilla), el de las tarjetas.
      radio ??= getComputedStyle(objetivo).borderRadius.replace(/^0px$/, 'var(--r)');
      // El control se fue de costado (deslizaste el carrusel): sin globo.
      if (!r.width || r.right <= 0 || r.left >= ancho) { setPos(null); return; }
      const u = ubicarGlobo({ objetivo: r, globo: { w, h }, vista, lado: LADO[id] });
      setPos({
        w, lado: u.lado, flecha: u.flecha,
        left: u.left - base.left, top: u.top - base.top,
        anillo: { left: r.left - AIRE - base.left, top: r.top - AIRE - base.top, w: r.width + 2 * AIRE, h: r.height + 2 * AIRE, radio },
      });
    }

    /* La primera medición la da el primer aviso del observer (llega después
       del layout que el navegador hace de todos modos). */
    const caja = host || objetivo.closest('.ex-card') || objetivo;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => medir()) : null;
    if (ro) ro.observe(caja); else medir();

    /* Mientras el carrusel se desliza el control se mueve de costado: el
       globo se esconde y vuelve a medirse cuando el carrusel se queda quieto. */
    const car = host ? null : document.getElementById('ex-carousel');
    let quieto = null;
    const alMover = () => {
      setPos(null);
      if ('onscrollend' in car) return;
      clearTimeout(quieto);
      quieto = setTimeout(medir, D.objeto);
    };
    if (car) {
      car.addEventListener('scroll', alMover, { passive: true });
      if ('onscrollend' in car) car.addEventListener('scrollend', medir, { passive: true });
    }
    window.addEventListener('resize', medir);
    return () => {
      ro?.disconnect();
      clearTimeout(quieto);
      if (car) {
        car.removeEventListener('scroll', alMover);
        car.removeEventListener('scrollend', medir);
      }
      window.removeEventListener('resize', medir);
    };
  }, [listo, objetivo, host, id]);

  if (!listo) return null;
  const a = pos?.anillo;
  return createPortal(
    <>
      {a && (
        <div
          className="guia-anillo"
          aria-hidden="true"
          style={{
            left: a.left, top: a.top, width: a.w, height: a.h, borderRadius: a.radio,
            // Crece unos 6 px por lado, sea el control ancho o chico.
            '--anillo-x': 1 + 12 / a.w, '--anillo-y': 1 + 12 / a.h,
          }}
        />
      )}
      <div
        ref={ref}
        className={pos ? `guia-globo ${pos.lado}` : 'guia-globo midiendo'}
        role="status"
        data-guia={id}
        style={pos ? { left: pos.left, top: pos.top, width: pos.w, '--flecha': `${pos.flecha}px` } : undefined}
      >
        <span>{TEXTOS[id]}</span>
        <button type="button" className="guia-globo-x" aria-label="Cerrar aviso" onClick={() => marcarGuia(id)}>
          <X size={14} />
        </button>
      </div>
    </>,
    host || document.body,
  );
}
