// Modo prueba (pedido de Enzo, 2026-09-25): una copia de sus datos donde
// simular un entrenamiento —abrir la sesión, ver las tarjetas, descartar—
// sin tocar la base donde vive su progreso real.
//
// Por qué una segunda base y no otra dirección publicada: IndexedDB es por
// origen, y cualquier copia de la app en exorplion.github.io vería la MISMA
// base `fierro`. Lo que separa los datos es el nombre de la base, así que el
// modo prueba es eso: abrir `fierro-prueba` en vez de `fierro`.
//
// La marca vive en localStorage (no en la base: hay que leerla ANTES de
// saber cuál abrir). Es el único uso de localStorage de la app.
import { DB, STORES, idbOpen } from './db.js';
import { dstr } from './format.js';

export const CLAVE = 'fierro-modo-prueba';
/** El día en que se entró (o se confirmó "sigo probando"). Si la app se abre
    otro día, pregunta "¿Seguís en modo prueba?" (pruebaDeOtroDia). */
export const DESDE = 'fierro-modo-prueba-desde';
export const BASE_REAL = 'fierro';
export const BASE_PRUEBA = 'fierro-prueba';

export function enModoPrueba() {
  try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; }
}

/** Fija qué base abre idbOpen(). Se llama una vez, antes de abrirla. */
export function elegirBase() {
  DB.name = enModoPrueba() ? BASE_PRUEBA : BASE_REAL;
}

export function borrarBase(nombre) {
  return new Promise((res, rej) => {
    const r = indexedDB.deleteDatabase(nombre);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
    // Otra pestaña la tiene abierta: el borrado queda en cola y se completa
    // cuando la suelte. No hay que esperarlo para seguir.
    r.onblocked = () => res();
  });
}

function leerStore(db, st) {
  return new Promise((res, rej) => {
    const q = db.transaction(st).objectStore(st).getAll();
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}

/** Copia la base real ENTERA a una base de prueba nueva. Necesita la
    conexión real abierta, y la deja abierta y activa al terminar. */
export async function copiarAPrueba() {
  const real = DB.db;
  if (!real || DB.name !== BASE_REAL) throw new Error('El modo prueba se arma desde la base real');

  const datos = {};
  for (const st of STORES) {
    if (real.objectStoreNames.contains(st)) datos[st] = await leerStore(real, st);
  }

  await borrarBase(BASE_PRUEBA);
  DB.name = BASE_PRUEBA;
  try {
    // idbOpen() crea el esquema al día (y, en una base nueva, una rutina de
    // 7 descansos de relleno): se vacía todo antes de volcar la copia.
    await idbOpen();
    const prueba = DB.db;
    await new Promise((res, rej) => {
      const t = prueba.transaction(STORES, 'readwrite');
      for (const st of STORES) {
        const store = t.objectStore(st);
        store.clear();
        for (const fila of datos[st] || []) store.put(fila);
      }
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('No se pudo copiar a la base de prueba'));
    });
    prueba.close();
  } finally {
    DB.name = BASE_REAL;
    DB.db = real;
  }
}

/** Arma la copia, marca el modo (y el día) y recarga: la app arranca sobre
    la copia. */
export async function entrarModoPrueba(hoy = dstr()) {
  await copiarAPrueba();
  localStorage.setItem(CLAVE, '1');
  if (!enModoPrueba()) throw new Error('Este navegador no deja guardar la marca del modo prueba');
  seguirEnPrueba(hoy);
  location.reload();
}

/* ---------------------------------------------------------------------------
   Salir sin perder nada (2026-09-29).

   Enzo entró al modo prueba, entrenó DE VERDAD el domingo 27 y el lunes 28 sin
   notar que seguía en la copia, y al salir la copia se borró con esas dos
   sesiones adentro (docs/debug-2026-09-29-datos-y-domingo.md). Salir ahora
   primero mira qué tiene la copia que la base real no tiene, lo dice, y
   ofrece pasarlo a la real o descartarlo a sabiendas.
   ------------------------------------------------------------------------- */

const mismaFila = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const porFecha = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Qué hay en la copia de prueba que la real no tiene. Puro: recibe las filas
    de las dos bases. Sin duplicar: una sesión con otro id pero el mismo turno
    el mismo día que una real no cuenta, ni un peso igual el mismo día. Una
    sesión con el mismo id pero distinta (corregida en la prueba) sí cuenta. */
export function diferenciasPrueba(real, prueba) {
  const sesionesReales = real.sessions || [];
  const sesReal = new Map(sesionesReales.map(s => [s.id, s]));
  const sesiones = (prueba.sessions || []).filter(s => {
    const r = sesReal.get(s.id);
    if (r) return !mismaFila(r, s);
    return !sesionesReales.some(x => x.date === s.date && x.slotId && x.slotId === s.slotId);
  }).sort(porFecha);
  const bodyReal = real.body || [];
  const idsBody = new Set(bodyReal.map(b => b.id));
  const pesos = (prueba.body || [])
    .filter(b => !idsBody.has(b.id) && !bodyReal.some(x => x.date === b.date && x.weight === b.weight))
    .sort(porFecha);
  const idsMeals = new Set((real.meals || []).map(m => m.id));
  const comidas = (prueba.meals || []).filter(m => !idsMeals.has(m.id));
  return { sesiones, pesos, comidas };
}

const cuenta = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** "Registraste 2 sesiones y 1 peso en la prueba." */
export function textoResumen(dif) {
  const partes = [];
  if (dif.sesiones.length) partes.push(cuenta(dif.sesiones.length, 'sesión', 'sesiones'));
  if (dif.pesos.length) partes.push(cuenta(dif.pesos.length, 'peso', 'pesos'));
  if (dif.comidas.length) partes.push(cuenta(dif.comidas.length, 'comida', 'comidas'));
  if (!partes.length) return 'No registraste nada nuevo en la prueba.';
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0];
  return `Registraste ${lista} en la prueba.`;
}

/** Abre otra base por nombre, en su versión actual, sin tocar DB.db. */
function abrirOtra(nombre) {
  return new Promise((res, rej) => {
    const r = indexedDB.open(nombre);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('La base está bloqueada por otra pestaña'));
  });
}

async function leerDatos(db) {
  const out = {};
  for (const st of ['sessions', 'body', 'meals', 'settings']) {
    out[st] = db.objectStoreNames.contains(st) ? await leerStore(db, st) : [];
  }
  out.cfg = out.settings.find(x => x.key === 'cfg')?.value || null;
  return out;
}

/** Lo que tiene la copia de prueba (la conexión abierta, DB.db) que la real
    no. Lleva también la config de la prueba, para el puntero de la secuencia. */
export async function resumenPrueba() {
  if (!DB.db || DB.name !== BASE_PRUEBA) throw new Error('El resumen se arma desde el modo prueba');
  const prueba = await leerDatos(DB.db);
  const realDb = await abrirOtra(BASE_REAL);
  try {
    const real = await leerDatos(realDb);
    // Una sesión abierta en la prueba no se pasa (no está completa): se avisa.
    const enCurso = prueba.settings.some(x => x.key === 'draft' && x.value);
    return { ...diferenciasPrueba(real, prueba), cfgPrueba: prueba.cfg, enCurso };
  } finally {
    realDb.close();
  }
}

/** Escribe en la base REAL lo que resumenPrueba() encontró. Se puede correr
    dos veces sin duplicar (put por id). Si lo que se pasa incluye la sesión
    más reciente de todas, el puntero de la secuencia (seqIndex) sigue al de
    la prueba: si no, la app te volvería a proponer el turno que ya hiciste. */
export async function pasarPruebaAReal(dif) {
  const realDb = await abrirOtra(BASE_REAL);
  try {
    const real = await leerDatos(realDb);
    const pasadas = new Set(dif.sesiones.map(s => s.id));
    const ultimaReal = real.sessions.filter(s => !pasadas.has(s.id)).reduce((m, s) => (s.date > m ? s.date : m), '');
    const ultimaPasada = dif.sesiones.reduce((m, s) => (s.date > m ? s.date : m), '');
    const moverPuntero = !!ultimaPasada && ultimaPasada >= ultimaReal && typeof dif.cfgPrueba?.seqIndex === 'number';

    await new Promise((res, rej) => {
      const t = realDb.transaction(['sessions', 'body', 'meals', 'settings'], 'readwrite');
      for (const s of dif.sesiones) t.objectStore('sessions').put(s);
      for (const b of dif.pesos) t.objectStore('body').put(b);
      for (const m of dif.comidas) t.objectStore('meals').put(m);
      if (moverPuntero) {
        const cfg = { ...(real.cfg || {}), seqIndex: dif.cfgPrueba.seqIndex, seqIndexDate: dif.cfgPrueba.seqIndexDate ?? null };
        t.objectStore('settings').put({ key: 'cfg', value: cfg });
      }
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('No se pudo pasar lo de la prueba a tus datos reales'));
    });
  } finally {
    realDb.close();
  }
}

/** La app se abrió otro día que el que se entró al modo prueba: hay que
    preguntar si se sigue. Una prueba de antes de este arreglo no tiene fecha:
    también pregunta (es justo el caso de quedarse días sin darse cuenta). */
export function pruebaDeOtroDia(hoy = dstr()) {
  if (!enModoPrueba()) return false;
  let desde = null;
  try { desde = localStorage.getItem(DESDE); } catch { /* sin almacenamiento */ }
  return desde !== hoy;
}

/** "Sí, sigo probando": no vuelve a preguntar hasta otro día. */
export function seguirEnPrueba(hoy = dstr()) {
  try { localStorage.setItem(DESDE, hoy); } catch { /* sin almacenamiento */ }
}

/** Sale del modo prueba. Con `pasar` (el resultado de resumenPrueba), primero
    escribe eso en la base real; sin él, la copia se descarta entera. */
export async function salirModoPrueba({ pasar = null } = {}) {
  if (pasar) await pasarPruebaAReal(pasar);
  try { localStorage.removeItem(CLAVE); localStorage.removeItem(DESDE); } catch { /* sin almacenamiento: igual se recarga */ }
  DB.db?.close();
  DB.db = null;
  await borrarBase(BASE_PRUEBA);
  location.reload();
}
