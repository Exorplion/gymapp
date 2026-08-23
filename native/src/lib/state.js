// native/src/lib/state.js
// Puerto verbatim de web/src/lib/state.js — misma forma de S, mismo
// bump()/useStore() (useSyncExternalStore funciona igual en RN que en
// React DOM, es API de React puro, no del navegador). Sólo cambia de dónde
// importa idb/STORES (./db.js portado en Task 2, sobre AsyncStorage).
import { useSyncExternalStore } from 'react';
import { idb, STORES } from './db.js';
import { dstr, fmtNum, round1, kg2lb, KG2LB, vibrate } from './format.js';

export const S = {
  routine: [],
  sessions: [],
  meals: [], foods: [], body: [],
  cfg: {
    unit: 'kg', rest: 90, goals: { kcal: 2600, p: 160, c: 280, f: 80 }, goalsAuto: false,
    reminderHour: 18, reminderEnabled: true,
    seqIndex: 0,
    seqIndexDate: null,
    profile: { sex: 'm', age: null, height: null, weightKg: null, activity: 'moderate', goal: 'deficit_mod', tdeeEmpirical: null, proteinPref: 0.5, fatPref: 0.5 },
  },
  draft: null,
  tab: 'inicio',
  hoyVals: {},
  rutOpen: null,
  rutMode: 'view',
  lib: [],
  nutriDate: dstr(),
  foodEdit: false,
  histOpen: false,
  progEx: null,
  progRange: 'all',
  progTab: 'carga',
  ready: false,
  sheet: null,
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
  await resolveAutoRest();
}

export function resolveAutoRest() {
  const today = dstr();
  if (S.cfg.seqIndexDate && S.cfg.seqIndexDate < today) {
    for (let i = 0; i < S.routine.length && S.routine[S.cfg.seqIndex]?.type === 'rest'; i++) {
      S.cfg.seqIndex = (S.cfg.seqIndex + 1) % Math.max(1, S.routine.length);
    }
  }
  if (S.routine.length) S.cfg.seqIndexDate = today;
  return saveCfg();
}

export const saveCfg = () => idb.put('settings', { key: 'cfg', value: S.cfg });
export const saveDraft = () => S.draft ? idb.put('settings', { key: 'draft', value: S.draft }) : idb.del('settings', 'draft');

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

export function openSheet(type, props = {}) { S.sheet = { type, props }; bump(); vibrate(6); }
export function closeSheet() { S.sheet = null; bump(); }
