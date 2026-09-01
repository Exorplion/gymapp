// Puerto de sheetProfile() + macroPreview() + readProfileForm() +
// refreshProfilePreview() + async saveProfile() (index.html, "perfil:
// formulario y guardado").
//
// DEVIATION documentada: el original mutaba S.cfg.profile.sex DE INMEDIATO
// al tocar el toggle Hombre/Mujer (antes de guardar), mientras el resto de
// los campos vivían como texto suelto en el DOM hasta 'prof-save' (que los
// leía con readProfileForm()). Acá todo el formulario —sexo incluido— vive
// en un solo borrador local de React (`draft`) que sólo se escribe a
// S.cfg.profile al guardar: si el usuario cierra el sheet sin guardar, el
// perfil real queda intacto (el original sí podía dejar un sexo a medio
// cambiar en memoria, aunque nunca persistido a IndexedDB). `draft` ES el
// objeto que readProfileForm() reconstruía leyendo inputs del DOM, así que
// esa función ya no hace falta como tal.
//
// Los inputs numéricos libres (edad/altura/peso/TDEE) son no controlados
// (defaultValue + ref) — mismo patrón que VoiceLog.jsx (Task 6, FIX ROUND
// 1): el onChange sólo actualiza `draft` (parseFloat crudo, sin redondear)
// para alimentar el preview en vivo, nunca reescribe el value del input que
// el usuario está tecleando. La única escritura directa a un input es el
// botón "usar último registrado" sobre el campo de peso — eso sí es
// aceptable porque el usuario no tecleó ese valor, lo pidió con un tap
// (mismo criterio que los steppers +/- de VoiceLog.jsx/ExerciseForm.jsx).
import { useEffect, useRef, useState } from 'react';
import { S, closeSheet, saveCfg } from '../../lib/state.js';
import { fmtNum, round1, vibrate } from '../../lib/format.js';
import {
  computeMacros, applyComputedGoals, profileWeight,
  ACTF, ACT_LABEL, ACT_HINT, GOALDELTA, GOAL_LABEL, GOAL_HINT,
} from '../../lib/macros.js';
import { toast } from '../../lib/toast.js';
import { bloomOpen } from '../../lib/motion.js';

function MacroPreview({ m }) {
  return (
    <>
      <div className="cr"><span>BMR (Mifflin-St Jeor)</span><b>{m.bmr} kcal</b></div>
      <div className="cr"><span>TDEE {m.empirical ? '(empírico)' : '(calculado)'}</span><b>{m.tdee} kcal</b></div>
      <div className="cr"><span>Proteína <span className="txt-mut">({m.protMin}–{m.protMax})</span></span><b>{m.prot} g</b></div>
      <div className="cr"><span>Grasa <span className="txt-mut">({m.fatMin}–{m.fatMax})</span></span><b>{m.fat} g</b></div>
      <div className="cr"><span>Carbos <span className="txt-mut">(resto)</span></span><b>{m.carbs} g</b></div>
      <div className="cr big"><span>Target diario</span><b>{m.target} kcal</b></div>
    </>
  );
}

export default function Profile() {
  const p0 = S.cfg.profile;
  const [draft, setDraft] = useState({ ...p0 });
  const weightRef = useRef(null);
  const ageRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => { if (rootRef.current) bloomOpen(rootRef.current); }, []);

  // Sugerencia de peso desde Progreso — sólo si el perfil no tiene peso
  // propio todavía, calculada una vez sobre el perfil REAL (no el borrador),
  // igual que el original (bw se calcula al abrir el sheet, no en vivo).
  const bw = !p0.weightKg ? profileWeight() : null;

  // refreshProfilePreview(): mismo truco que el original — canjea
  // S.cfg.profile por el borrador para reusar computeMacros() tal cual, y lo
  // restaura antes de que cualquier otro código pueda leerlo (todo síncrono,
  // sin await de por medio).
  function macrosFor(d) {
    const saved = S.cfg.profile;
    S.cfg.profile = d;
    const m = computeMacros();
    S.cfg.profile = saved;
    return m;
  }
  const m = macrosFor(draft);

  function setField(field, value) { setDraft(d => ({ ...d, [field]: value })); }
  function setNumField(field, raw) {
    const v = parseFloat(raw);
    setDraft(d => ({ ...d, [field]: isNaN(v) ? null : v }));
  }
  function useLastWeight() {
    if (bw == null) return;
    if (weightRef.current) weightRef.current.value = bw; // tap, no tecleo: sí se puede reescribir
    setDraft(d => ({ ...d, weightKg: bw }));
  }

  async function save() {
    if (!draft.age || !draft.height || !draft.weightKg) { toast('Faltan edad, altura o peso'); return; }
    S.cfg.profile = draft;
    S.cfg.goalsAuto = true;
    applyComputedGoals();
    await saveCfg();
    closeSheet();
    vibrate(15);
    const mm = computeMacros();
    toast(`🎯 Metas: ${mm.target} kcal · P ${mm.prot} · C ${mm.carbs} · G ${mm.fat}`);
  }

  return (
    <div ref={rootRef}>
      <h2>Perfil y macros</h2>
      <div className="sheet-sub">Todo se recalcula desde estos datos. Nada queda fijo.</div>

      <h3>Sexo</h3>
      <div className="seg">
        <button type="button" className={draft.sex === 'm' ? 'on' : ''} aria-pressed={draft.sex === 'm'} onClick={() => setField('sex', 'm')}>Hombre</button>
        <button type="button" className={draft.sex === 'f' ? 'on' : ''} aria-pressed={draft.sex === 'f'} onClick={() => setField('sex', 'f')}>Mujer</button>
      </div>

      <div className="f2" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="perfil-edad">Edad</label>
          <input id="perfil-edad" ref={ageRef} type="number" inputMode="numeric" defaultValue={draft.age ?? ''} placeholder="24" onChange={e => setNumField('age', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="perfil-altura">Altura (cm)</label>
          <input id="perfil-altura" type="number" inputMode="numeric" defaultValue={draft.height ?? ''} placeholder="179" onChange={e => setNumField('height', e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="perfil-peso">
          Peso (kg)
          {bw != null && <> · <button type="button" className="txt-blue linklike" onClick={useLastWeight}>usar último registrado ({fmtNum(round1(bw))})</button></>}
        </label>
        <input id="perfil-peso" ref={weightRef} type="number" inputMode="decimal" step="any" defaultValue={draft.weightKg ?? ''} placeholder="74" onChange={e => setNumField('weightKg', e.target.value)} />
      </div>

      <h3 id="perfil-hlbl-actividad">Nivel de actividad</h3>
      <div className="field">
        <select aria-labelledby="perfil-hlbl-actividad" value={draft.activity} onChange={e => setField('activity', e.target.value)}>
          {Object.keys(ACTF).map(k => <option key={k} value={k}>{ACT_LABEL[k]} — {ACT_HINT[k]}</option>)}
        </select>
      </div>

      <h3 id="perfil-hlbl-objetivo">Objetivo</h3>
      <div className="field">
        <select aria-labelledby="perfil-hlbl-objetivo" value={draft.goal} onChange={e => setField('goal', e.target.value)}>
          {Object.keys(GOALDELTA).map(k => <option key={k} value={k}>{GOAL_LABEL[k]} — {GOAL_HINT[k]}</option>)}
        </select>
      </div>

      <h3>Reparto de proteína y grasa</h3>
      <div className="rangerow">
        <div className="rlbl" id="perfil-lbl-prot"><span>Proteína</span><b>{m ? m.prot + ' g' : '—'}</b></div>
        <input type="range" aria-labelledby="perfil-lbl-prot" min="0" max="100" value={Math.round((draft.proteinPref ?? 0.5) * 100)} onChange={e => setField('proteinPref', (+e.target.value) / 100)} />
      </div>
      <div className="rangerow">
        <div className="rlbl" id="perfil-lbl-grasa"><span>Grasa</span><b>{m ? m.fat + ' g' : '—'}</b></div>
        <input type="range" aria-labelledby="perfil-lbl-grasa" min="0" max="100" value={Math.round((draft.fatPref ?? 0.5) * 100)} onChange={e => setField('fatPref', (+e.target.value) / 100)} />
      </div>

      <h3 id="perfil-hlbl-tdee">TDEE empírico <span className="txt-mut" style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', fontSize: 12 }}>(opcional)</span></h3>
      <div className="field">
        <input
          aria-labelledby="perfil-hlbl-tdee"
          type="number" inputMode="numeric"
          defaultValue={draft.tdeeEmpirical ?? ''}
          placeholder={m ? `calculado: ${m.tdeeCalc}` : 'kcal de mantenimiento real'}
          onChange={e => setNumField('tdeeEmpirical', e.target.value)}
        />
        <div className="txt-mut" style={{ fontSize: 12, marginTop: 7, lineHeight: 1.4 }}>
          Si tras 2-3 semanas tu peso no se mueve como predice el cálculo, pon aquí las kcal a las que realmente te mantienes. Este valor manda sobre el calculado.
        </div>
      </div>

      <div className="calcbox">
        {m ? <MacroPreview m={m} /> : <div className="cr" style={{ justifyContent: 'center', color: 'var(--mut2)' }}>Completa edad, altura y peso para ver tus macros.</div>}
      </div>

      <button type="button" className="btn" style={{ marginTop: 14 }} onClick={save}>Guardar y usar estas metas</button>
    </div>
  );
}
