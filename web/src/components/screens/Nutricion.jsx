// Puerto de renderNutri() (index.html, sección NUTRICIÓN) — tarjeta de
// perfil/CTA, navegador de fecha, anillo de kcal, barras de macros +
// nutriFeedback(), fila "Un toque" (frequentMeals()), fila "Frecuentes"
// (S.foods) y la lista de comidas del día.
//
// El anillo de kcal reusa el gradiente SVG #restGrad (RestTimer.jsx, Task 4,
// montado siempre en App.jsx) vía la regla `.kr-prog{stroke:url(#restGrad)}`
// que ya vive en styles.css — no hace falta (ni se debe) declarar un
// <defs><linearGradient id="restGrad">> propio acá: un id duplicado en el
// DOM haría que url(#restGrad) resuelva de forma ambigua/inconsistente
// entre navegadores.
//
// "Un toque" (frequentMeals()) y "Frecuentes" (S.foods) son dos fuentes de
// datos distintas que en el original registran una comida con el mismo
// cuerpo de código repetido dos veces (addMealFromFood() vs. el handler
// inline de 'quickadd-meal'). Acá ambas rutas comparten logMeal() (ver
// MealForm.jsx) — la fila "Un toque" ya tiene el objeto {name,kcal,p,c,f} en
// mano (viene de frequentMeals()) y lo pasa directo; la fila "Frecuentes"
// sólo tiene el id del food guardado y usa addMealFromFood(id), que hace el
// find() y delega en logMeal().
import { S, useStore, bump, openSheet } from '../../lib/state.js';
import { dstr, fmtDFull, fmtNum, round1 } from '../../lib/format.js';
import { computeMacros, GOAL_LABEL } from '../../lib/macros.js';
import { mealsOf, macroCls, nutriFeedback, frequentMeals, mealsBySlot, slotForTime } from '../../lib/meals.js';
import { idb } from '../../lib/db.js';
import { logMeal, addMealFromFood } from '../sheets/MealForm.jsx';

// El botón de voz sólo aparece si el navegador reconoce voz — mismo criterio
// que el registro por voz de sesiones en Hoy.jsx.
const SR_FOOD = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
  : null;

// 2*Math.PI*52 redondeado — mismo círculo (r=52) y mismo valor que
// .kr-prog{stroke-dasharray:326.7} en styles.css; el original también lo
// tenía como literal "326.7", no como fórmula.
const KCAL_CIRC = 326.7;

function shiftNutriDate(days) {
  const d = new Date(S.nutriDate + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const s = dstr(d);
  if (s > dstr()) return;
  S.nutriDate = s;
  bump();
}

async function deleteMeal(id) {
  await idb.del('meals', id);
  S.meals = S.meals.filter(m => m.id !== id);
  bump();
}

async function deleteFood(id) {
  await idb.del('foods', id);
  S.foods = S.foods.filter(f => f.id !== id);
  if (!S.foods.length) S.foodEdit = false;
  bump();
}

export default function Nutricion() {
  useStore();
  const date = S.nutriDate;
  const meals = mealsOf(date);
  const tot = meals.reduce((a, mm) => ({ kcal: a.kcal + mm.kcal, p: a.p + mm.p, c: a.c + mm.c, f: a.f + mm.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  const g = S.cfg.goals;
  const m = S.cfg.goalsAuto ? computeMacros() : null; // rangos vivos sólo si perfil activo
  const pct = (v, goal) => goal ? Math.min(100, v / goal * 100) : 0;
  const isToday = date === dstr();
  const kc = Math.round(tot.kcal), tp = Math.round(tot.p), tc = Math.round(tot.c), tf = Math.round(tot.f);
  const kcalOff = KCAL_CIRC * (1 - Math.min(1, g.kcal ? kc / g.kcal : 0));
  const freq = frequentMeals();

  return (
    <>
      <div className="vtitle"><h1>Comida</h1><span className="sub">{fmtDFull(S.nutriDate)}</span></div>

      {m ? (
        <div className="card profcard">
          <div className="pavatar">👤</div>
          <div className="grow">
            <div className="pt">{GOAL_LABEL[S.cfg.profile.goal]} · {m.target} kcal</div>
            <div className="txt-mut" style={{ fontSize: 12.5 }}>
              {S.cfg.profile.sex === 'f' ? 'Mujer' : 'Hombre'} · {fmtNum(round1(m.weight))} kg · P {m.protMin}-{m.protMax} · G {m.fatMin}-{m.fatMax} · C {m.carbs}g
            </div>
          </div>
          <button type="button" className="icon-btn accent" aria-label="Ver / modificar mis datos" onClick={() => openSheet('profile')}>✎</button>
        </div>
      ) : (
        <div className="card profcard" style={{ borderColor: 'var(--line2)' }} onClick={() => openSheet('profile')}>
          <div className="pavatar">🎯</div>
          <div className="grow">
            <div className="pt">Calcular mis macros</div>
            <div className="txt-mut" style={{ fontSize: 12.5 }}>Perfil → TDEE → target y rangos automáticos{S.cfg.goalsAuto ? '' : ' (usando metas manuales)'}</div>
          </div>
          <span className="chev">›</span>
        </div>
      )}

      <div className="datenav">
        <button type="button" className="mini" style={{ width: 44, height: 44 }} onClick={() => shiftNutriDate(-1)}>‹</button>
        <div
          className="d" style={{ textAlign: 'center' }}
          role={isToday ? undefined : 'button'}
          onClick={isToday ? undefined : () => { S.nutriDate = dstr(); bump(); }}
        >
          {/* La fecha ya está en el título de la pantalla; acá alcanza con
              decir qué día se está mirando y cómo volver. */}
          {isToday ? 'Hoy' : fmtDFull(date)}
          {!isToday && <small>toca para volver a hoy</small>}
        </div>
        <button type="button" className="mini" style={{ width: 44, height: 44 }} disabled={isToday} onClick={() => shiftNutriDate(1)}>›</button>
      </div>

      <div className="card hero hero-kcal">
        <div className="kcal-top">
          <div className="kcal-ring">
            <svg viewBox="0 0 120 120">
              <circle className="kr-track" cx="60" cy="60" r="52" />
              <circle className="kr-prog" cx="60" cy="60" r="52" style={{ strokeDashoffset: kcalOff }} />
            </svg>
            <div className="kr-val">
              <div className="kr-n">{kc}</div>
              <div className="kr-of">de {g.kcal}</div>
            </div>
          </div>
          <div className="kcal-side">
            {/* El mockup pone el dato accionable — cuánto QUEDA — grande y
                aparte del anillo, que muestra lo ya consumido. */}
            {/* "Pasado" no se entendía. "Excedente" dice lo mismo y se lee solo. */}
            <div className="hero-eyebrow">{kc > g.kcal ? 'Excedente' : 'Restantes'}</div>
            <div className="kcal-big">
              {kc > g.kcal ? kc - g.kcal : Math.max(0, g.kcal - kc)}<span>kcal</span>
            </div>
            <div className="txt-mut" style={{ fontSize: 12.5, marginTop: 2 }}>
              {GOAL_LABEL[S.cfg.profile.goal]}
              {S.cfg.profile.weightKg ? ` · ${fmtNum(round1(S.cfg.profile.weightKg))} kg` : ''}
            </div>
          </div>
        </div>
        <div className="macro3">
          <div className="m">
            <div className="lbl"><span>Proteína</span><span>{tp}/{g.p}</span></div>
            <div className="pbar prot"><i className={macroCls(tp, 'prot', m)} style={{ width: `${pct(tp, g.p)}%` }}></i></div>
          </div>
          <div className="m">
            <div className="lbl"><span>Carbos</span><span>{tc}/{g.c}</span></div>
            <div className="pbar carb"><i style={{ width: `${pct(tc, g.c)}%` }}></i></div>
          </div>
          <div className="m">
            <div className="lbl"><span>Grasa</span><span>{tf}/{g.f}</span></div>
            <div className="pbar fat"><i className={macroCls(tf, 'fat', m)} style={{ width: `${pct(tf, g.f)}%` }}></i></div>
          </div>
        </div>
        <div className="nutri-fb" dangerouslySetInnerHTML={{ __html: nutriFeedback(kc, tp, tf, g, m) }} />
      </div>

      {freq.length > 0 && (
        <>
          <div className="sect">Un toque</div>
          <div className="chip-scroll">
            {freq.map((f, i) => (
              <span key={i} className="chip blue" onClick={() => logMeal(f)}>
                ＋ {f.name} <span className="txt-mut" style={{ fontWeight: 500 }}>{f.kcal}</span>
              </span>
            ))}
          </div>
        </>
      )}

      <div className="sect">
        Frecuentes
        {S.foods.length > 0 && (
          <button
            type="button" className="mini"
            style={{ width: 32, height: 32, fontSize: 13, ...(S.foodEdit ? { color: 'var(--blue2)', borderColor: 'var(--line2)' } : {}) }}
            onClick={() => { S.foodEdit = !S.foodEdit; bump(); }}
          >✎</button>
        )}
      </div>
      {S.foods.length > 0 ? (
        <div className="chip-scroll">
          {S.foods.map(f => S.foodEdit ? (
            <span key={f.id} className="chip" onClick={() => deleteFood(f.id)}>{f.name}<span className="x">✕</span></span>
          ) : (
            <span key={f.id} className="chip blue" onClick={() => addMealFromFood(f.id)}>
              ＋ {f.name} <span className="txt-mut" style={{ fontWeight: 500 }}>{f.kcal}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="txt-mut" style={{ fontSize: 14, margin: '4px 2px 8px' }}>
          Al agregar una comida, márcala como <b>frecuente</b> y quedará aquí para sumarla con un tap.
        </div>
      )}

      <div className="spacer"></div>
      <button
        type="button" className="btn"
        onClick={() => openSheet('meal-form', { slot: slotForTime(new Date().toTimeString().slice(0, 5)) })}
      >
        + Agregar comida
      </button>
      {SR_FOOD && (
        <button type="button" className="pw-btn" style={{ marginTop: 'var(--s3)' }} onClick={() => openSheet('food-voice')}>
          <span className="pwi">🎙</span><span className="pwt">Registrar por voz</span>
          <span className="txt-mut" style={{ fontSize: 12.5, fontWeight: 500 }}>decí qué comiste</span>
          <span className="chev">›</span>
        </button>
      )}

      <div className="sect">Comidas de {isToday ? 'hoy' : 'este día'}</div>
      {!meals.length ? (
        <div className="card"><div className="empty" style={{ padding: 16 }}><p style={{ margin: 0 }}>Nada registrado {isToday ? 'hoy' : 'este día'}.</p></div></div>
      ) : (
        mealsBySlot(date).map(b => (
          <div key={b.k} className="slot-block">
            <div className="slot-head"><span>{b.label}</span><span className="num">{b.kcal} kcal</span></div>
            <div className="card">
              {b.meals.map(meal => (
                <div className="row" key={meal.id}>
                  <div className="grow">
                    <div className="t">{meal.name}</div>
                    <div className="s">{meal.kcal} kcal · P {meal.p} · C {meal.c} · G {meal.f}</div>
                    {meal.items?.length > 1 && (
                      <div className="s" style={{ color: 'var(--mut2)' }}>
                        {meal.items.map(i => `${i.name} ${i.grams}g`).join(' · ')}
                      </div>
                    )}
                  </div>
                  <button type="button" className="meal-del" onClick={() => deleteMeal(meal.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
