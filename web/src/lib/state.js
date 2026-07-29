import { useSyncExternalStore } from 'react';
import { idb, STORES } from './db.js';
import { dstr } from './format.js';

// S sigue siendo el mismo objeto mutable de la app original: todo el código
// de negocio (session.js, streak.js, drag.js, etc.) lo lee y lo muta
// directamente, igual que antes. bump() es la señal para que React vuelva a
// pintar — se usa useSyncExternalStore porque el estado real vive afuera de
// React (en S), no en un componente; es la API que React expone para
// exactamente este caso ("external mutable store").
export const S = {
  routine: {},          // weekday -> {weekday,name,exercises:[{id,name,sets,reps}]}
  sessions: [],         // desc por start
  meals: [], foods: [], body: [],
  cfg: {
    unit: 'kg', rest: 90, goals: { kcal: 2600, p: 160, c: 280, f: 80 }, goalsAuto: false,
    profile: { sex: 'm', age: null, height: null, weightKg: null, activity: 'moderate', goal: 'deficit_mod', tdeeEmpirical: null, proteinPref: 0.5, fatPref: 0.5 },
  },
  draft: null,          // sesión en curso
  tab: 'hoy',
  hoyVals: {},          // exId -> {w(kg), r}
  hoyDay: null,         // weekday elegido en Hoy
  hoyOrder: {},         // weekday -> [exId] reordenado antes de arrancar el reloj
  rutOpen: new Date().getDay(),
  rutMode: 'view',      // 'view' = resumen de la semana · 'edit' = editor
  lib: [],              // rutinas guardadas por el usuario
  nutriDate: dstr(),
  foodEdit: false,
  histOpen: false,
  progEx: null,
  progRange: 'all',
  progTab: 'carga',
  ready: false,         // true una vez que loadAll() terminó
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
  S.routine = {}; rt.forEach(d => S.routine[d.weekday] = d);
  S.sessions = ss.sort((a, b) => b.start - a.start);
  S.meals = ms; S.foods = fs;
  S.body = bd.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  st.forEach(kv => {
    if (kv.key === 'cfg') S.cfg = { ...S.cfg, ...kv.value, goals: { ...S.cfg.goals, ...(kv.value.goals || {}) }, profile: { ...S.cfg.profile, ...(kv.value.profile || {}) } };
    if (kv.key === 'draft') S.draft = kv.value;
    if (kv.key === 'lib') S.lib = kv.value || [];
  });
  if (S.draft) S.hoyDay = S.draft.weekday;
  S.ready = true;
}

export const saveCfg = () => idb.put('settings', { key: 'cfg', value: S.cfg });
export const saveDraft = () => S.draft ? idb.put('settings', { key: 'draft', value: S.draft }) : idb.del('settings', 'draft');
