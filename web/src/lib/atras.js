// El gesto de "volver" de Android (deslizar desde el borde, o el botón).
//
// Una PWA instalada es UNA sola página: sin entradas propias en el historial,
// volver no tiene a dónde ir y Android cierra la app entera — aunque tuvieras
// una hoja abierta o estuvieras en Progreso. Eso reportó Enzo el 2026-09-24.
//
// La salida estándar: cada capa que se abre (una hoja, la ficha del músculo,
// el descanso a pantalla completa, una pestaña que no es Inicio) empuja una
// entrada al historial. Volver la saca y el navegador avisa con `popstate`;
// acá se cierra lo que quedó por encima. Con todo cerrado y en Inicio no hay
// entradas propias, y volver hace lo de siempre: salir.
//
// Cada entrada lleva su PROFUNDIDAD en `history.state`. En `popstate` se
// cierra todo lo que esté más arriba de la profundidad a la que se llegó, en
// vez de "la última": así una capa que se cerró por la interfaz fuera de
// orden no desincroniza la pila, a lo sumo deja una entrada vacía que se
// consume con un volver sin efecto.
//
// Cuando la capa se cierra desde la interfaz (la × de una hoja), su entrada
// sigue en el historial y hay que sacarla con `history.back()`. Ese back es
// asíncrono: si en el mismo instante se abre otra capa (cerrar Ajustes y
// abrir Perfil), su pushState quedaría ANTES de que el back aterrice y el back
// se la llevaría. Por eso, mientras hay un back propio en vuelo, las capas
// nuevas esperan y se empujan recién cuando llega su popstate.

/** Crea una pila sobre un `history` (el real, o uno falso en los tests). */
export function crearAtras(h) {
  const pila = [];        // { depth, cerrar, viva }
  const diferidas = [];
  let esperando = 0;      // history.back() propios que todavía no aterrizaron

  const profundidad = () => h.state?.fierroAtras ?? 0;

  function empujar(e) {
    e.depth = profundidad() + 1;
    h.pushState({ ...(h.state || {}), fierroAtras: e.depth }, '');
  }

  /** Registra una capa abierta. Devuelve la función para cuando se cierra
      por la interfaz (no por el gesto). Llamarla dos veces no hace nada. */
  function registrar(cerrar) {
    const e = { depth: 0, cerrar, viva: true };
    pila.push(e);
    if (esperando) diferidas.push(e); else empujar(e);
    return () => {
      if (!e.viva) return;
      e.viva = false;
      pila.splice(pila.indexOf(e), 1);
      const i = diferidas.indexOf(e);
      if (i >= 0) { diferidas.splice(i, 1); return; }   // nunca llegó al historial
      if (profundidad() === e.depth) { esperando++; h.back(); }
    };
  }

  /** El manejador de `popstate`. */
  function alVolver(state) {
    const d = state?.fierroAtras ?? 0;
    if (esperando) {
      // Es el back que pedimos nosotros: no hay nada que cerrar.
      esperando--;
      if (!esperando) diferidas.splice(0).forEach(empujar);
      return;
    }
    // De arriba hacia abajo: lo último que se abrió es lo primero que se cierra.
    for (let i = pila.length - 1; i >= 0; i--) {
      const e = pila[i];
      if (e.depth <= d) continue;
      e.viva = false;
      pila.splice(i, 1);
      e.cerrar();
    }
  }

  return { registrar, alVolver, abiertas: () => pila.length };
}

let global = null;
function atras() {
  if (global) return global;
  if (typeof window === 'undefined' || !window.history?.pushState) return null;
  global = crearAtras(window.history);
  window.addEventListener('popstate', e => global.alVolver(e.state));
  return global;
}

/** Registra una capa en la pila del gesto de volver. Devuelve la limpieza. */
export function registrarAtras(cerrar) {
  return atras()?.registrar(cerrar) || (() => {});
}
