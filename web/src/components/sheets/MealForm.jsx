// Puerto de sheetMealForm() + async saveMeal() + async addMealFromFood()
// (index.html, sección NUTRICIÓN). El formulario en sí sólo agrega — el
// original nunca edita una comida existente (sólo borra), así que no hay
// prop `meal` ni modo edición, a diferencia de ExerciseForm.jsx.
//
// Los 4 campos numéricos (kcal/proteína/carbos/grasa) son inputs
// controlados que guardan el string tal cual lo tipeó el usuario — nunca se
// reformatea el valor de vuelta al mismo input en su propio onChange (la
// causa raíz del bug de Task 6: reescribir value= con un número
// redondeado/parseado en cada tecla rompe borrar-y-retipear y corta
// decimales a medio tipear como "62."). El redondeo/clamping (Math.max(0,
// parseFloat(...)||0), igual que el saveMeal() original) sólo pasa una vez,
// al guardar — un momento en el que el usuario ya terminó de tipear, no en
// cada onChange.
import { useEffect, useRef, useState } from 'react';
import { S, bump, closeSheet } from '../../lib/state.js';
import { uid, vibrate } from '../../lib/format.js';
import { idb } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';

/** Núcleo compartido de addMealFromFood()/quickadd-meal (Nutricion.jsx): dado
    algo con forma {name,kcal,p,c,f}, lo registra como comida del día
    seleccionado. Exportado para que la fila "Frecuentes" (S.foods, por id)
    y la fila "Un toque" (frequentMeals(), objetos ya en mano) de
    Nutricion.jsx no dupliquen el put+push+toast — el original SÍ duplicaba
    este cuerpo entre addMealFromFood() y el handler inline de
    'quickadd-meal', pero acá no hay razón para repetirlo dos veces. */
export async function logMeal(f) {
  const meal = { id: uid(), date: S.nutriDate, name: f.name, kcal: f.kcal, p: f.p, c: f.c, f: f.f, t: new Date().toTimeString().slice(0, 5) };
  await idb.put('meals', meal);
  S.meals.push(meal);
  vibrate(12);
  bump();
  toast(`＋ ${f.name}`);
}

/** Puerto verbatim de addMealFromFood(id) — busca en S.foods y delega en
    logMeal(). Usada por la fila "Frecuentes" de Nutricion.jsx. */
export async function addMealFromFood(id) {
  const f = S.foods.find(x => x.id === id);
  if (!f) return;
  await logMeal(f);
}

export default function MealForm() {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [prot, setProt] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [freq, setFreq] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { toast('Ponle nombre a la comida'); return; }
    const k = Math.max(0, parseFloat(kcal) || 0);
    const p = Math.max(0, parseFloat(prot) || 0);
    const c = Math.max(0, parseFloat(carbs) || 0);
    const f = Math.max(0, parseFloat(fat) || 0);
    const meal = { id: uid(), date: S.nutriDate, name: trimmed, kcal: k, p, c, f, t: new Date().toTimeString().slice(0, 5) };
    await idb.put('meals', meal);
    S.meals.push(meal);
    if (freq) {
      const food = { id: uid(), name: trimmed, kcal: k, p, c, f };
      await idb.put('foods', food);
      S.foods.push(food);
    }
    closeSheet();
    toast('Comida agregada');
  }

  return (
    <>
      <h2>Agregar comida</h2>
      <div className="field">
        <label>Nombre</label>
        <input ref={nameRef} value={name} onChange={e => setName(e.target.value)} placeholder="Pollo con arroz" autoComplete="off" />
      </div>
      <div className="f2">
        <div className="field">
          <label>Calorías</label>
          <input type="number" inputMode="numeric" placeholder="0" value={kcal} onChange={e => setKcal(e.target.value)} />
        </div>
        <div className="field">
          <label>Proteína (g)</label>
          <input type="number" inputMode="decimal" placeholder="0" value={prot} onChange={e => setProt(e.target.value)} />
        </div>
        <div className="field">
          <label>Carbos (g)</label>
          <input type="number" inputMode="decimal" placeholder="0" value={carbs} onChange={e => setCarbs(e.target.value)} />
        </div>
        <div className="field">
          <label>Grasa (g)</label>
          <input type="number" inputMode="decimal" placeholder="0" value={fat} onChange={e => setFat(e.target.value)} />
        </div>
      </div>
      <label className="check"><input type="checkbox" checked={freq} onChange={e => setFreq(e.target.checked)} /> Guardar como frecuente</label>
      <button type="button" className="btn" onClick={save}>Agregar</button>
    </>
  );
}
