// Buscar → elegir → gramos. Antes había que escribir kcal, proteína, carbos y
// grasa a mano en cada comida, con una tabla de 55 alimentos que sólo usaba el
// dictado por voz.
//
// Se conserva la regla de foodvoice.js: nunca se inventan macros. Un alimento
// que no está en ningún lado se crea a mano una vez, con los cuatro campos de
// siempre, y desde entonces queda disponible en el buscador.
//
// Cada ítem del carrito guarda el `food` original, no sólo sus macros ya
// escalados: recalcular los gramos vuelve a llamar a macrosFor() sobre la
// fuente, en vez de re-escalar un número ya escalado (que pierde precisión y
// se rompe si los gramos pasan por cero).
import { useEffect, useMemo, useRef, useState } from 'react';
import { S, bump, closeSheet } from '../../lib/state.js';
import { uid, vibrate, round1 } from '../../lib/format.js';
import { idb } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { searchFoods, macrosFor, defaultGrams } from '../../lib/foodsearch.js';
import { SLOTS, slotForTime } from '../../lib/meals.js';

const ahora = () => new Date().toTimeString().slice(0, 5);

/** Registra algo con forma {name,kcal,p,c,f} como comida del día seleccionado.
    Lo comparten las filas "Un toque" y "Frecuentes" de Nutricion.jsx. */
export async function logMeal(f, slot) {
  const t = ahora();
  const meal = {
    id: uid(), date: S.nutriDate, name: f.name,
    kcal: f.kcal, p: f.p, c: f.c, f: f.f,
    t, slot: slot || slotForTime(t),
  };
  await idb.put('meals', meal);
  S.meals.push(meal);
  vibrate(12);
  bump();
  toast(`＋ ${f.name}`);
}

/** Puerto verbatim de addMealFromFood(id) — busca en S.foods y delega. */
export async function addMealFromFood(id) {
  const f = S.foods.find(x => x.id === id);
  if (!f) return;
  await logMeal(f);
}

export default function MealForm({ slot: slotInicial }) {
  const [slot, setSlot] = useState(slotInicial || slotForTime(ahora()));
  const [q, setQ] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [nuevo, setNuevo] = useState(null);
  const buscarRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => buscarRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const hits = useMemo(() => searchFoods(q, { slot, limit: 8 }), [q, slot]);

  const total = carrito.reduce((a, i) => ({
    kcal: a.kcal + i.kcal, p: round1(a.p + i.p), c: round1(a.c + i.c), f: round1(a.f + i.f),
  }), { kcal: 0, p: 0, c: 0, f: 0 });

  function agregar(food) {
    const grams = defaultGrams(food);
    setCarrito(c => [...c, { food, grams, ...macrosFor(food, grams) }]);
    setQ('');
    buscarRef.current?.focus();
  }

  function setGramos(idx, raw) {
    const g = Math.max(0, parseFloat(String(raw).replace(',', '.')) || 0);
    setCarrito(c => c.map((it, j) => (j === idx ? { ...it, grams: g, ...macrosFor(it.food, g) } : it)));
  }

  const quitar = idx => setCarrito(c => c.filter((_, j) => j !== idx));

  async function guardar() {
    if (!carrito.length) { toast('Agregá al menos un alimento'); return; }
    const t = ahora();
    const meal = {
      id: uid(), date: S.nutriDate, t, slot,
      name: carrito.length === 1 ? carrito[0].food.name : carrito.map(i => i.food.name).join(' + '),
      kcal: Math.round(total.kcal), p: round1(total.p), c: round1(total.c), f: round1(total.f),
      items: carrito.map(i => ({ name: i.food.name, grams: i.grams, kcal: i.kcal, p: i.p, c: i.c, f: i.f })),
    };
    await idb.put('meals', meal);
    S.meals.push(meal);
    vibrate(12);
    closeSheet();
    toast('Comida agregada');
  }

  if (nuevo) {
    return <AlimentoNuevo nombre={nuevo} onListo={f => { setNuevo(null); agregar(f); }} onCancel={() => setNuevo(null)} />;
  }

  return (
    <>
      <h2>Agregar comida</h2>

      <div className="seg" style={{ marginBottom: 'var(--s3)' }}>
        {SLOTS.map(s => (
          <button key={s.k} type="button" className={slot === s.k ? 'on' : ''} onClick={() => setSlot(s.k)}>{s.label}</button>
        ))}
      </div>

      <div className="field">
        <input
          ref={buscarRef} value={q} onChange={e => setQ(e.target.value)}
          placeholder="🔍 Buscá un alimento" autoComplete="off"
        />
      </div>

      <div className="food-hits">
        {hits.map(f => (
          <button key={f.key} type="button" className="food-hit" onClick={() => agregar(f)}>
            <span className="grow">
              <span className="t">{f.name}</span>
              {f.source === 'mine' && <span className="eq-tag">tuyo</span>}
            </span>
            <span className="s">{f.kcal} kcal{f.base === '100g' ? '/100g' : '/porción'}</span>
          </button>
        ))}
        {q.trim() && !hits.length && (
          <button type="button" className="food-hit nuevo" onClick={() => setNuevo(q.trim())}>
            <span className="grow"><span className="t">Crear "{q.trim()}"</span></span>
            <span className="s">no lo tengo · lo definís vos</span>
          </button>
        )}
      </div>

      {carrito.length > 0 && (
        <>
          <div className="sect">En esta comida</div>
          <div className="card">
            {carrito.map((i, idx) => (
              <div key={idx} className="cart-row">
                <span className="n">{i.food.name}</span>
                <input type="number" inputMode="decimal" value={i.grams} onChange={e => setGramos(idx, e.target.value)} />
                <span className="u">g</span>
                <span className="k">{i.kcal} kcal</span>
                <button type="button" className="mini red" onClick={() => quitar(idx)}>✕</button>
              </div>
            ))}
            <div className="cart-total"><span>Total</span><b>{Math.round(total.kcal)} kcal</b></div>
            <div className="txt-mut" style={{ fontSize: 12.5, textAlign: 'right' }}>
              P {total.p} · C {total.c} · G {total.f}
            </div>
          </div>
        </>
      )}

      <button type="button" className="btn" onClick={guardar}>Agregar</button>
    </>
  );
}

/** El caso "no lo tengo": los cuatro campos de siempre, una sola vez. Se guarda
    en S.foods con base 'portion' — son los macros de lo que te vas a comer, no
    de 100 g.

    Los campos guardan el string tal cual se tipeó y sólo se parsean al
    confirmar: reescribir el value con un número redondeado en cada tecla rompe
    borrar-y-retipear y corta decimales a medio escribir ("62."). */
function AlimentoNuevo({ nombre, onListo, onCancel }) {
  const [name, setName] = useState(nombre);
  const [kcal, setKcal] = useState('');
  const [prot, setProt] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  async function crear() {
    const trimmed = name.trim();
    if (!trimmed) { toast('Ponle nombre al alimento'); return; }
    const food = {
      id: uid(), name: trimmed,
      kcal: Math.max(0, parseFloat(kcal) || 0),
      p: Math.max(0, parseFloat(prot) || 0),
      c: Math.max(0, parseFloat(carbs) || 0),
      f: Math.max(0, parseFloat(fat) || 0),
      base: 'portion', unit: null, alias: [], cat: null,
    };
    await idb.put('foods', food);
    S.foods.push(food);
    bump();
    onListo({
      key: trimmed.toLowerCase(), name: food.name, base: 'portion', unit: null,
      kcal: food.kcal, p: food.p, c: food.c, f: food.f, source: 'mine', alias: [],
    });
  }

  return (
    <>
      <h2>Alimento nuevo</h2>
      <div className="txt-mut" style={{ fontSize: 14, lineHeight: 1.5, margin: '-8px 0 16px' }}>
        No lo tengo en la base, así que no me lo invento. Poné sus macros una vez
        y queda guardado para siempre.
      </div>
      <div className="field">
        <label>Nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
      </div>
      <div className="f2">
        <div className="field"><label>Calorías</label><input type="number" inputMode="numeric" placeholder="0" value={kcal} onChange={e => setKcal(e.target.value)} /></div>
        <div className="field"><label>Proteína (g)</label><input type="number" inputMode="decimal" placeholder="0" value={prot} onChange={e => setProt(e.target.value)} /></div>
        <div className="field"><label>Carbos (g)</label><input type="number" inputMode="decimal" placeholder="0" value={carbs} onChange={e => setCarbs(e.target.value)} /></div>
        <div className="field"><label>Grasa (g)</label><input type="number" inputMode="decimal" placeholder="0" value={fat} onChange={e => setFat(e.target.value)} /></div>
      </div>
      <button type="button" className="btn" onClick={crear}>Guardar y agregar</button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={onCancel}>Cancelar</button>
    </>
  );
}
