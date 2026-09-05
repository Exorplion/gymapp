import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { idb, STORES } from './db.js';
import { dstr, fmtNum, round1, kg2lb, lb2kg, KG2LB, vibrate } from './format.js';

// S sigue siendo el mismo objeto mutable de la app original: todo el código
// de negocio (session.js, streak.js, drag.js, etc.) lo lee y lo muta
// directamente, igual que antes. bump() es la señal para que React vuelva a
// pintar — se usa useSyncExternalStore porque el estado real vive afuera de
// React (en S), no en un componente; es la API que React expone para
// exactamente este caso ("external mutable store").
export const S = {
  routine: [],   // [{id, order, type:'workout'|'rest', name?, exercises?}]
  sessions: [],         // desc por start
  meals: [], foods: [], body: [],
  cfg: {
    unit: 'kg', rest: 90, goals: { kcal: 2600, p: 160, c: 280, f: 80 }, goalsAuto: false,
    seqIndex: 0,        // posición pendiente en S.routine
    seqIndexDate: null, // 'YYYY-MM-DD': desde cuándo seqIndex está en este valor
    profile: { sex: 'm', age: null, height: null, weightKg: null, activity: 'moderate', goal: 'deficit_mod', tdeeEmpirical: null, proteinPref: 0.5, fatPref: 0.5 },
    activeGym: null,    // id de S.gyms, o null (sin gym activo)
  },
  draft: null,          // sesión en curso
  tab: 'inicio',        // la portada; 'hoy' sigue existiendo, pero se entra desde acá
  hoyVals: {},          // exId -> {w(kg), r}
  // hoyDay / hoyOrder / dayFx / rutOpen(por weekday) / dayDrop se eliminan
  // acá — reemplazados en las tasks siguientes por sus equivalentes de
  // secuencia (S.rutOpen pasa a ser un índice o null, ver Task 9).
  rutOpen: null,
  rutMode: 'view',      // 'view' = resumen de la semana · 'edit' = editor
  rutTab: 'semana',     // 'semana' = tu plan · 'ejercicios' = Mis ejercicios (transitorio, no persiste)
  lib: [],              // rutinas guardadas por el usuario
  gyms: [],             // [{id, name, equip: {nombreEjercicioNorm: {equip, machine}}}]
  nutriDate: dstr(),
  foodEdit: false,
  histOpen: false,
  progEx: null,
  progRange: 'all',
  progTab: 'carga',
  ready: false,         // true una vez que loadAll() terminó
  sheet: null,           // {type, props} | null — qué sheet está abierto (Task 1 dejó esto pendiente para quien lo necesitara primero; ver Sheet.jsx)
  // La sesión recién cerrada, mientras dura la pantalla de racha/resumen/
  // cuerpo (SessionComplete.jsx) — null cuando no hay nada que mostrar.
  // Separado de `sheet` porque es pantalla completa, no un sheet: los dos
  // sistemas conviven pero no se pisan.
  sessionComplete: null,
};

let version = 0;
const listeners = new Set();
export function bump() {
  version++;
  listeners.forEach(l => l());
}
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function getSnapshot() { return version; }

/** Suscribe el componente a S y devuelve el objeto vivo (léelo directo, ej. S.sessions). */
export function useStore() {
  useSyncExternalStore(subscribe, getSnapshot);
  return S;
}

export async function loadAll() {
  const [rt, ss, ms, fs, bd, st] = await Promise.all(STORES.map(s => idb.all(s)));
  S.routine = rt.sort((a, b) => a.order - b.order);
  S.sessions = ss.sort((a, b) => b.start - a.start);
  S.meals = ms; S.foods = fs;
  S.body = bd.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  st.forEach(kv => {
    if (kv.key === 'cfg') S.cfg = { ...S.cfg, ...kv.value, goals: { ...S.cfg.goals, ...(kv.value.goals || {}) }, profile: { ...S.cfg.profile, ...(kv.value.profile || {}) } };
    if (kv.key === 'draft') S.draft = kv.value;
    if (kv.key === 'lib') S.lib = kv.value || [];
    if (kv.key === 'gyms') S.gyms = kv.value || [];
  });
  S.ready = true;
  await resolveAutoRest();
  // TDEE adaptativo continuo (Plan Fierro · Fase 3): se recalcula una vez
  // por día de app abierta, no en cada render — ver macros.js. Import
  // dinámico para no crear un ciclo state.js↔macros.js (macros.js ya
  // importa saveCfg de acá).
  const { refreshAdaptiveTDEE } = await import('./macros.js');
  await refreshAdaptiveTDEE();
}

/** Si el turno pendiente es un descanso y quedó así desde ANTES de hoy,
    avanza al próximo turno de entrenamiento — el descanso no necesita que
    completes nada para pasar de página, sólo que pase el día calendario.
    `completeSession()` (session.js) ya adelanta el puntero al cerrar un
    entrenamiento; esto cubre el caso simétrico del descanso, que no se
    "completa" con una acción del usuario.

    El loop (no un solo paso) cubre varios descansos seguidos en la
    secuencia: los salta todos de una vez hasta el próximo turno de
    entrenamiento, o hasta dar la vuelta completa si la rutina es 100%
    descanso — acotado a `S.routine.length` pasos para no depender de que
    la fecha cambie en el medio para cortar. */
export function resolveAutoRest() {
  const today = dstr();
  if (S.cfg.seqIndexDate && S.cfg.seqIndexDate < today) {
    // `seqIndexDate` NO se toca acá adentro: si se pisara en cada vuelta, la
    // siguiente iteración compararía contra "hoy" en vez de contra la fecha
    // vieja y el while se frenaría después de un solo paso — exactamente el
    // bug que esto reemplaza. Se guarda una única vez, al final, ya resuelto
    // el punto de llegada.
    // Tope defensivo en S.routine.length: cubre la rutina 100% descanso sin
    // depender de que la fecha cambie para cortar el loop.
    for (let i = 0; i < S.routine.length && S.routine[S.cfg.seqIndex]?.type === 'rest'; i++) {
      S.cfg.seqIndex = (S.cfg.seqIndex + 1) % Math.max(1, S.routine.length);
    }
  }
  if (S.routine.length) S.cfg.seqIndexDate = today;
  return saveCfg();
}

export const saveCfg = () => idb.put('settings', { key: 'cfg', value: S.cfg });
export const saveDraft = () => S.draft ? idb.put('settings', { key: 'draft', value: S.draft }) : idb.del('settings', 'draft');

// Funciones de peso — dependen de S.cfg.unit para mostrar kg o lb
export function wDisplay(kg) {
  return S.cfg.unit === 'kg' ? fmtNum(round1(kg)) : fmtNum(kg2lb(kg));
}

export function wAlt(kg) {
  return S.cfg.unit === 'kg' ? `${fmtNum(kg2lb(kg))} lb` : `${fmtNum(round1(kg))} kg`;
}

export function wBoth(kg) {
  return `${fmtNum(round1(kg))} kg · ${fmtNum(kg2lb(kg))} lb`;
}

export function wStep() {
  return S.cfg.unit === 'kg' ? 2.5 : 5 / KG2LB;
}

/** kg → unidad que ve el usuario, y de vuelta — numéricos (sin formatear a
    texto, eso es wDisplay()). Los usa ReelPicker.jsx (toUnit/fromUnit) para
    que la rueda fina y la edición manual trabajen en la unidad que el
    usuario ve, no en kg crudos. */
export function wToUnit(kg) {
  return S.cfg.unit === 'kg' ? kg : kg2lb(kg);
}
export function wFromUnit(n) {
  return S.cfg.unit === 'kg' ? n : lb2kg(n);
}

// Reemplaza openSheet(html)/closeSheet() del original (que escribían un
// string de HTML en #sheet-c). Acá "qué sheet mostrar" es sólo un tipo +
// props — quien renderiza <Sheet/> (App.jsx) decide qué componente pintar
// según S.sheet.type. Un solo campo alcanza porque, igual que en el
// original, sólo hay un sheet abierto a la vez en toda la app.
// Un solo lugar y no cada llamado a openSheet() en cada archivo: abrir CUALQUIER
// sheet (Ajustes, Biblioteca, editar un día, lo que sea) es una acción frecuente
// y hoy no vibraba nunca — más liviano que cambiar de pestaña porque pasa más
// seguido. Cerrar no suma vibración propia: no hace falta un aviso físico para
// algo que ya elegiste dejar de mirar.
export function openSheet(type, props = {}) { S.sheet = { type, props }; bump(); vibrate(6); }
export function closeSheet() { S.sheet = null; bump(); }

/* Orden de las pantallas — App.jsx lo usa para calcular la dirección del
   deslizamiento; vive acá (y no ahí) para que changeTab() pueda calcular la
   misma dirección sin depender de un componente. */
export const TAB_ORDEN = ['inicio', 'hoy', 'rutina', 'nutri', 'prog'];

/** Marca, para el useEffect de transición de App.jsx, si el último cambio de
    pestaña ya se animó con View Transitions API — así ese efecto no arma
    ADEMÁS su propio par saliente/entrante. Señal efímera, no persistida. */
export let lastTabChangeUsedVT = false;

/** Cambia de pestaña. Con View Transitions API disponible y sin "reducir
    movimiento", el cambio queda envuelto en document.startViewTransition()
    (ver styles.css: <main> tiene su propio view-transition-name, aislado de
    Header/TabBar/overlays). flushSync fuerza el commit sincrónico que la
    librería necesita para fotografiar el "después" real.

    `extra` corre en el mismo instante que S.tab (BodyMap.jsx lo usa para
    fijar S.rutMode='edit' junto con el cambio, no después). */
export function changeTab(t, extra) {
  if (S.tab === t) return;
  const antes = TAB_ORDEN.indexOf(S.tab);
  const ahora = TAB_ORDEN.indexOf(t);
  const dir = ahora < antes ? 'l' : 'r';
  const puedeVT = typeof document !== 'undefined'
    && typeof document.startViewTransition === 'function'
    && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const aplicar = () => { S.tab = t; extra?.(); bump(); };
  if (puedeVT) {
    lastTabChangeUsedVT = true;
    document.documentElement.dataset.tdir = dir;
    /* main no tiene scroll propio (scrollea la página entera), así que su
       alto "real" es el de TODO su contenido, no sólo la franja visible
       entre el header y la barra de pestañas. La View Transition API saca
       una foto de ese alto completo (viejo y nuevo) y la pinta en el
       top-layer — por encima de CUALQUIER z-index, incluida la barra fija
       de abajo. Sin recortarla, durante los 340ms del deslizamiento se ve
       un pedazo de la pantalla vieja/nueva flotando sobre la barra (un
       botón que en verdad está más abajo del pliegue visible). Se mide acá
       el alto real entre main y la barra (una vez, antes de la foto) y
       ::view-transition-group(app-main) en styles.css lo usa para recortar
       en vez de animar su propio alto contenido-a-contenido. */
    const main = document.querySelector('main');
    const nav = document.querySelector('nav.tabbar');
    if (main && nav) {
      const h = nav.getBoundingClientRect().top - main.getBoundingClientRect().top;
      if (h > 0) document.documentElement.style.setProperty('--vt-clip-h', `${Math.round(h)}px`);
    }
    const vt = document.startViewTransition(() => flushSync(aplicar));
    vt.finished.finally(() => {
      delete document.documentElement.dataset.tdir;
      document.documentElement.style.removeProperty('--vt-clip-h');
    });
  } else {
    lastTabChangeUsedVT = false;
    aplicar();
  }
  vibrate(8);
}
