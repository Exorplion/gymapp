// Guardar un registro corporal (peso y medidas), con la fecha que se elija.
//
// Antes vivía dentro de BodyForm.jsx y guardaba siempre `date: dstr()`: el
// peso de un día pasado no se podía cargar. Enzo, 2026-09-29: "no he podido
// registrar mis pesos de los otros días". Ahora la fecha se elige (por
// defecto hoy, nunca futura).
import { S, saveCfg } from './state.js';
import { uid, dstr } from './format.js';
import { applyComputedGoals } from './macros.js';
import { idb } from './db.js';

const CAMPOS = ['weight', 'waist', 'arm', 'chest', 'leg', 'bodyfat'];

/** `valores` trae los strings tal cual se tipearon; un campo vacío es "no
    registro este dato", nunca un cero. Devuelve el registro guardado, o null
    si no había ningún dato o la fecha es futura. */
export async function guardarRegistroCorporal(valores, fecha = dstr()) {
  if (!fecha || fecha > dstr()) return null;
  const num = raw => { const v = parseFloat(raw); return isNaN(v) ? null : v; };
  const rec = { id: uid(), date: fecha };
  for (const c of CAMPOS) rec[c] = num(valores?.[c]);
  if (CAMPOS.every(c => rec[c] == null)) return null;

  /* El peso del perfil (que alimenta las macros) es tu peso ACTUAL: sólo lo
     cambia un registro que sea el más reciente. Cargar hoy el peso del
     domingo no puede hacer volver atrás las metas calculadas con el de hoy. */
  const esElMasReciente = rec.weight != null && S.body.every(b => b.weight == null || b.date <= fecha);

  await idb.put('body', rec);
  S.body.push(rec);
  S.body.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  if (esElMasReciente) {
    S.cfg.profile.weightKg = rec.weight;
    applyComputedGoals();
    await saveCfg();
  }
  return rec;
}
