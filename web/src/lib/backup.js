// Puerto de exportJSON()/importJSON(file)/wipeAll() (index.html, bloque
// "AJUSTES / respaldo"). El formato exportado ({app:'fierro',version:1,...})
// se mantiene byte-compatible con el original a propósito: un backup bajado
// desde la app vanilla tiene que poder restaurarse acá y viceversa, así que
// ni las claves ni su forma cambian.
//
// DEVIATION (consistente con el resto del port, no nueva): el wipeAll()
// original arranca con `if(!confirm(...))return;` — un diálogo nativo
// bloqueante. Cada otro confirm() de la app original ya se reemplazó, en
// tareas anteriores, por el sheet 'confirm' propio de la app (ver
// rutina-logic.js: startBlank/applyLibRoutine/deleteLibRoutine, Hoy.jsx:
// confirmSessDone/confirmSessDiscard/confirmHistDel). Siguiendo ese mismo
// criterio, la confirmación de "Borrar todos los datos" vive en
// Settings.jsx (openSheet('confirm',...)), y wipeAll() acá es sólo la acción
// ya confirmada: vaciar todos los stores y recargar. El resultado percibido
// por el usuario es el mismo (se le pide confirmar antes de borrar todo).
//
// Import unidireccional: sólo depende de state.js/format.js/db.js/Toast.jsx.
import { S } from './state.js';
import { dstr } from './format.js';
import { idb, STORES } from './db.js';
import { toast } from '../components/Toast.jsx';

export function exportJSON() {
  const data = {
    app: 'fierro', version: 1, exportedAt: new Date().toISOString(),
    routine: Object.values(S.routine), sessions: S.sessions, meals: S.meals, foods: S.foods, body: S.body, cfg: S.cfg,
  };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fierro-backup-${dstr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Backup descargado');
}

export async function importJSON(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'fierro' || !d.version) throw new Error('formato');
    for (const st of STORES) await idb.clear(st);
    for (const r of d.routine || []) await idb.put('routine', r);
    for (const r of d.sessions || []) await idb.put('sessions', r);
    for (const r of d.meals || []) await idb.put('meals', r);
    for (const r of d.foods || []) await idb.put('foods', r);
    for (const r of d.body || []) await idb.put('body', r);
    if (d.cfg) await idb.put('settings', { key: 'cfg', value: d.cfg });
    toast('Datos restaurados ✓');
    setTimeout(() => location.reload(), 600);
  } catch (e) { toast('⚠ Archivo inválido'); }
}

/** Ya confirmado por quien llama (ver nota de cabecera) — sólo ejecuta el borrado. */
export async function wipeAll() {
  for (const st of STORES) await idb.clear(st);
  location.reload();
}
