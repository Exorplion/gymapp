// Puerto de sheetSettings() + macroPreview() + los handlers ACT['unit'],
// ACT['rest-cfg'], ACT['goalmode'], ACT['profile-open'], data-chg==='goal',
// ACT['seed-load'], ACT['seed-wipe'], ACT['export'], ACT['import-pick'] +
// el listener de #importFile, ACT['wipe'] (index.html, bloque "AJUSTES /
// respaldo"). seedRegistro/seedCount/wipeSeed vienen de lib/seed.js;
// exportJSON/importJSON/wipeAll de lib/backup.js (Task 9).
//
// Los confirm() nativos de seed-load/seed-wipe/wipe se reemplazan por el
// sheet 'confirm' de la app (mismo criterio que el resto del port — ver nota
// de cabecera en lib/backup.js). seed-load tenía DOS confirm() encadenados
// en el original (uno condicional si ya hay datos cargados, otro siempre);
// acá se encadenan igual con dos openSheet('confirm',...) sucesivos.
//
// Las metas manuales (Kcal/Prot/Carb/Grasa) son inputs NO controlados
// (defaultValue, sin value=): el original las leía con el evento nativo
// `change`, que dispara UNA vez, al perder foco — no en cada tecla. Por eso
// acá el guardado (S.cfg.goals[k]=...; saveCfg(), un idb.put real) cuelga de
// onBlur, no de onChange: escribir a IndexedDB en cada tecla (fix round 1,
// hallazgo de review) persistía dígitos parciales ("1","19","195","1950")
// según cuándo se interrumpiera el tecleo, algo que el evento `change`
// original nunca hacía. onBlur, disparado por el navegador ANTES de que
// corra el click de otro elemento (tocar el toggle de modo, otro botón del
// sheet, o el backdrop para cerrar), sigue capturando el valor final tecleado
// sin perderlo en ninguno de esos casos. Nunca se reescribe el value del
// input (ni en blur ni en ningún otro momento) — mismo criterio que
// Profile.jsx / VoiceLog.jsx, ahora aplicado también al *momento* del guardado
// y no sólo al valor mostrado.
//
// El <input id="importFile"> vivía en el original como nodo persistente
// fuera del sheet (sibling de #sheet/#toast, único en toda la página); acá
// sólo hace falta mientras Ajustes está abierto, así que vive local a este
// componente — mismo comportamiento (mismo <input hidden> disparado por
// "Importar JSON"), distinto lugar en el árbol.
import { useRef } from 'react';
import { S, bump, closeSheet, openSheet, saveCfg } from '../../lib/state.js';
import { fmtMMSS, vibrate } from '../../lib/format.js';
import { computeMacros, applyComputedGoals } from '../../lib/macros.js';
import { seedRegistro, seedCount, wipeSeed } from '../../lib/seed.js';
import { exportJSON, importJSON, wipeAll } from '../../lib/backup.js';
import { toast } from '../../lib/toast.js';

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

export default function Settings() {
  const g = S.cfg.goals;
  const m = S.cfg.goalsAuto ? computeMacros() : null;
  const nSeed = seedCount();
  const importRef = useRef(null);

  function setUnit(u) {
    S.cfg.unit = u; saveCfg();
    bump(); // re-renderiza toda la app: wDisplay/wAlt en Hoy/Rutina/Progreso dependen de S.cfg.unit
  }

  function stepRest(d) {
    S.cfg.rest = Math.max(0, (S.cfg.rest || 0) + d);
    saveCfg();
    bump();
  }

  function setGoalMode(auto) {
    S.cfg.goalsAuto = auto;
    if (S.cfg.goalsAuto && !computeMacros()) {
      S.cfg.goalsAuto = false;
      closeSheet();
      openSheet('profile');
      return;
    }
    applyComputedGoals();
    saveCfg();
    bump();
  }

  function setGoal(k, raw) {
    const num = Math.max(0, parseInt(raw, 10) || 0);
    S.cfg.goals[k] = num;
    saveCfg();
  }

  function confirmSeedLoadStep2() {
    const mine = S.sessions.filter(s => !s.seed).length;
    openSheet('confirm', {
      title: 'Cargar datos de prueba',
      body: (
        <>
          Esto reemplaza tu split por la rutina Anterior/Posterior y agrega ~5 semanas de sesiones, ~1 mes de nutrición y tus pesadas.
          {mine > 0 && <><br /><br />Tus {mine} sesiones propias no se tocan.</>}
          <br /><br />
          Ojo: el historial de sesiones está reconstruido desde tus pesos anotados, no es un registro real.
          <br /><br />
          ¿Continuar?
        </>
      ),
      confirmLabel: 'Cargar',
      onConfirm: async () => {
        toast('Cargando…');
        await seedRegistro();
        vibrate([30, 50, 30]);
        setTimeout(() => location.reload(), 400);
      },
    });
  }

  function startSeedLoad() {
    if (seedCount()) {
      openSheet('confirm', {
        title: 'Ya hay datos cargados',
        body: 'Cargarlos otra vez los va a duplicar.',
        confirmLabel: 'Cargar de nuevo',
        onConfirm: confirmSeedLoadStep2,
      });
      return;
    }
    confirmSeedLoadStep2();
  }

  function startSeedWipe() {
    openSheet('confirm', {
      title: 'Borrar datos de prueba',
      body: `Se borran los ${seedCount()} registros cargados. Lo que hayas anotado vos queda.`,
      confirmLabel: 'Borrar',
      onConfirm: async () => {
        await wipeSeed();
        setTimeout(() => location.reload(), 300);
      },
    });
  }

  function startWipeAll() {
    openSheet('confirm', {
      title: 'Borrar todos los datos',
      body: 'Esta acción no se puede deshacer. Exporta un backup antes.',
      confirmLabel: 'Borrar todo',
      onConfirm: () => wipeAll(),
    });
  }

  function onImportFile(e) {
    const f = e.target.files[0];
    if (f) importJSON(f);
    e.target.value = '';
  }

  return (
    <>
      <h2>Ajustes</h2>

      <h3>Unidad de peso</h3>
      <div className="seg">
        <button type="button" className={S.cfg.unit === 'kg' ? 'on' : ''} onClick={() => setUnit('kg')}>Kilos (kg)</button>
        <button type="button" className={S.cfg.unit === 'lb' ? 'on' : ''} onClick={() => setUnit('lb')}>Libras (lb)</button>
      </div>

      <h3>Descanso entre series</h3>
      <div className="step">
        <button type="button" onClick={() => stepRest(-15)}>−</button>
        <div className="val">
          <input readOnly value={S.cfg.rest ? fmtMMSS(S.cfg.rest) : 'OFF'} />
          <span className="alt">−/+ 15 seg · 0 = sin timer</span>
        </div>
        <button type="button" onClick={() => stepRest(15)}>+</button>
      </div>

      <h3>Metas nutricionales diarias</h3>
      <div className="seg">
        <button type="button" className={S.cfg.goalsAuto ? 'on' : ''} onClick={() => setGoalMode(true)}>Desde perfil</button>
        <button type="button" className={S.cfg.goalsAuto ? '' : 'on'} onClick={() => setGoalMode(false)}>Manual</button>
      </div>
      {S.cfg.goalsAuto ? (
        <>
          <div className="calcbox" style={{ marginTop: 12 }}>
            {m ? <MacroPreview m={m} /> : <div className="txt-mut" style={{ fontSize: 13 }}>Completa tu perfil para calcular las metas.</div>}
          </div>
          <button type="button" className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => openSheet('profile')}>✎ Editar perfil</button>
        </>
      ) : (
        <div className="f4" style={{ marginTop: 12 }}>
          <div className="field"><label>Kcal</label><input type="number" inputMode="numeric" defaultValue={g.kcal} onBlur={e => setGoal('kcal', e.target.value)} /></div>
          <div className="field"><label>Prot</label><input type="number" inputMode="numeric" defaultValue={g.p} onBlur={e => setGoal('p', e.target.value)} /></div>
          <div className="field"><label>Carb</label><input type="number" inputMode="numeric" defaultValue={g.c} onBlur={e => setGoal('c', e.target.value)} /></div>
          <div className="field"><label>Grasa</label><input type="number" inputMode="numeric" defaultValue={g.f} onBlur={e => setGoal('f', e.target.value)} /></div>
        </div>
      )}

      <h3>Datos de prueba</h3>
      <div className="txt-mut" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
        Carga tu rutina Anterior/Posterior, ~1 mes de nutrición y ~5 semanas de sesiones reconstruidas desde tus pesos anotados. Sirve para ver la app llena; se borra aparte sin tocar lo demás.
      </div>
      <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={startSeedLoad}>🧪 Cargar mi registro</button>
      {nSeed > 0 && (
        <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={startSeedWipe}>Borrar lo cargado ({nSeed} registros)</button>
      )}

      <h3>Respaldo</h3>
      <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={() => exportJSON()}>⬇ Exportar todo a JSON</button>
      <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={() => importRef.current?.click()}>⬆ Importar JSON</button>
      <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={onImportFile} />
      <button type="button" className="btn danger" onClick={startWipeAll}>Borrar todos los datos</button>

      <div className="txt-mut" style={{ fontSize: 12, textAlign: 'center', marginTop: 16 }}>FIERRO v1 · datos 100% en tu dispositivo</div>
    </>
  );
}
