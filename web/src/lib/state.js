import { useSyncExternalStore } from 'react';
import { idb, STORES } from './db.js';
import { dstr, fmtNum, round1, kg2lb, KG2LB, vibrate } from './format.js';

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
  },
  draft: null,          // sesión en curso
  tab: 'inicio',        // la portada; 'hoy' sigue existiendo, pero se entra desde acá
  hoyVals: {},          // exId -> {w(kg), r}
  // hoyDay / hoyOrder / dayFx / rutOpen(por weekday) / dayDrop se eliminan
  // acá — reemplazados en las tasks siguientes por sus equivalentes de
  // secuencia (S.rutOpen pasa a ser un índice o null, ver Task 9).
  rutOpen: null,
  rutMode: 'view',      // 'view' = resumen de la semana · 'edit' = editor
  lib: [],              // rutinas guardadas por el usuario
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
  });
  S.ready = true;
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
