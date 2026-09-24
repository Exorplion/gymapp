// Accesos directos: `?accion=peso` en la URL, o el mismo pedido llegando por
// mensaje del service worker.
//
// Los usan tres puertas distintas que terminan en el mismo lugar:
//   - la notificación del recordatorio diario (sw-notif.js)
//   - el atajo "Registrar peso" al mantener apretado el ícono (manifest)
//   - cualquier link guardado con ?accion=peso
// Una lista cerrada y no "abrí el sheet que diga la URL": una URL la puede
// escribir cualquiera, y un sheet abierto con props que no esperaba es el
// tipo de crash que ya costó un bug ("Turno NaN").
import { openSheet } from './state.js';

const ACCIONES = {
  peso: () => openSheet('body-form'),
};

/** La acción pedida en un querystring, si es una de las conocidas. */
export function accionDeUrl(search) {
  try {
    const a = new URLSearchParams(search || '').get('accion');
    return a && Object.hasOwn(ACCIONES, a) ? a : null;
  } catch { return null; }
}

/** Corre la acción. Devuelve false si no existe. */
export function ejecutarAccion(a) {
  if (!a || !Object.hasOwn(ACCIONES, a)) return false;
  ACCIONES[a]();
  return true;
}

/** Lee la URL de arranque, corre la acción y la saca de la barra: si no, un
    recargar volvería a abrir el formulario. */
export function accionDeArranque(loc = window.location, hist = window.history) {
  const a = accionDeUrl(loc.search);
  if (!a) return null;
  try { hist.replaceState(null, '', loc.pathname + loc.hash); } catch { /* sin history: no importa */ }
  ejecutarAccion(a);
  return a;
}
