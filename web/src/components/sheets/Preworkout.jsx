// Puerto de sheetPreworkout() (index.html) — dosis de fluidos/carbos/cafeína
// calculadas desde el peso del perfil (macros.js: profileWeight(), ya
// portado en Task 5 para Nutrición).
//
// PW (meal/sensitive) es un objeto mutable a nivel de módulo, igual que T
// (rest.js) o DRAG (drag.js): el original también lo tenía como global que
// sobrevive entre aperturas del sheet dentro de la misma carga de página
// (no se persiste a IndexedDB). Los checkboxes lo mutan y llaman bump()
// (mismo canal que S) para volver a pintar — no hace falta que PW viva
// dentro de S para eso.
//
// DEVIATION documentada: el botón "Ir al perfil" del original abre
// sheetSettings()/sheetProfile(), que todavía no existen en el puerto (son
// de Ajustes, una pantalla de una tarea posterior — Header.jsx ya deja
// onOpenSettings como no-op por la misma razón). Acá, en vez de abrir un
// sheet 'profile' que no tiene caso en el switch de App.jsx (quedaría un
// panel vacío), se cierra el sheet con un toast explicativo. Reemplazar por
// openSheet('profile') cuando exista esa pantalla.
import { S, bump, closeSheet } from '../../lib/state.js';
import { fmtNum, round1, dstr, uid, vibrate } from '../../lib/format.js';
import { profileWeight } from '../../lib/macros.js';
import { idb } from '../../lib/db.js';
import { toast } from '../Toast.jsx';

const PW = { meal: false, sensitive: false };

export default function Preworkout() {
  const w = profileWeight();

  if (!w) {
    return (
      <>
        <h2>Pre-workout</h2>
        <div className="txt-mut" style={{ fontSize: 14, lineHeight: 1.5, margin: '6px 0 16px' }}>
          Necesito tu peso para calcular las dosis. Complétalo en tu perfil.
        </div>
        <button type="button" className="btn" onClick={() => { closeSheet(); toast('Completá tu peso en Ajustes → Perfil'); }}>
          Ir al perfil
        </button>
      </>
    );
  }

  const fluidMin = Math.round(5 * w), fluidMax = Math.round(7 * w);
  const carbs = Math.round(w);
  const cafLo = Math.round(3 * w), cafHi = Math.round(6 * w), cafMax = Math.round(9 * w);
  const CAP = 400;
  const recTop = Math.min(cafHi, CAP);
  const overCap = cafHi > CAP;
  const cafRec = PW.sensitive ? `${Math.round(1.5 * w)}–${cafLo} mg` : `${cafLo}–${recTop} mg`;

  async function addMacros() {
    if (!carbs) { toast('No hay carbos que sumar'); return; }
    /* se registra en el día de hoy, no en la fecha que se esté mirando en
       Nutrición: el pre-workout se toma ahora */
    const meal = { id: uid(), date: dstr(), name: 'Pre-workout', kcal: Math.round(carbs * 4), p: 0, c: carbs, f: 0, t: new Date().toTimeString().slice(0, 5) };
    await idb.put('meals', meal);
    S.meals.push(meal);
    vibrate(12);
    closeSheet();
    toast(`＋ Sumado a Nutrición · ${Math.round(carbs * 4)} kcal · ${carbs} g carbos`);
  }
  function toggleMeal() { PW.meal = !PW.meal; bump(); }
  function toggleSens() { PW.sensitive = !PW.sensitive; bump(); }

  return (
    <>
      <h2>Pre-workout</h2>
      <div className="txt-mut" style={{ fontSize: 13, margin: '-8px 0 16px' }}>
        Calculado para tu peso de <b className="txt-blue">{fmtNum(round1(w))} kg</b>. Tómalo ~30-60 min antes de entrenar.
      </div>

      <div className="calcbox">
        <div className="cr big"><span>💧 Fluidos + electrolitos</span><b>{fluidMin}–{fluidMax} ml</b></div>
        <div className="txt-mut" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 8 }}>Agua con sodio, potasio, magnesio y calcio (5-7 ml/kg).</div>
      </div>

      <div className="calcbox" style={{ marginTop: 10, opacity: PW.meal ? .55 : 1 }}>
        <div className="cr big"><span>🍯 Carbos rápidos</span><b>{PW.meal ? '—' : `${carbs} g`}</b></div>
        <div className="txt-mut" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 8 }}>
          {PW.meal ? 'Ya cubierto: comiste una comida completa 60-90 min antes, no necesitas carbo extra.' : 'Fructosa, glucosa o sacarosa (1 g/kg) para energía rápida.'}
        </div>
      </div>

      <div className="calcbox" style={{ marginTop: 10 }}>
        <div className="cr big"><span>☕ Cafeína</span><b className={overCap || PW.sensitive ? 'txt-warn' : ''}>{cafRec}</b></div>
        <div className="txt-mut" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 8 }}>
          {PW.sensitive
            ? <span className="txt-warn">Marcaste sensibilidad: empieza bajo (o evítala). No la tomes tarde.</span>
            : <>Rango efectivo 3-6 mg/kg. {overCap && <span className="txt-warn">Tu 6 mg/kg = {cafHi} mg supera el límite prudente de 400 mg — no pases de 400.</span>}</>}
          <br />El extremo de 9 mg/kg ({cafMax} mg) es solo para gente muy adaptada.
        </div>
      </div>

      {!PW.meal && (
        <>
          <button type="button" className="btn ghost" style={{ marginTop: 14 }} onClick={addMacros}>
            ＋ Sumar a Nutrición · {carbs} g carbos ({Math.round(carbs * 4)} kcal)
          </button>
          <div className="txt-mut" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 8 }}>
            Solo si de verdad los tomás. Fluidos y cafeína no aportan calorías, así que no se cuentan.
          </div>
        </>
      )}

      <h3>Ajustes</h3>
      <label className="check"><input type="checkbox" checked={PW.meal} onChange={toggleMeal} /> Comí una comida completa 60-90 min antes</label>
      <label className="check"><input type="checkbox" checked={PW.sensitive} onChange={toggleSens} /> Soy sensible a la cafeína</label>
    </>
  );
}
