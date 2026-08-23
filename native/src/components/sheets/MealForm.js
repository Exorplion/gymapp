// Puerto de web/src/components/sheets/MealForm.jsx (214 líneas) — SOLO el
// componente `MealForm` (default export) y su sub-componente `AlimentoNuevo`
// (líneas 46-214 del original). Las dos funciones puras de arriba
// (logMeal/addMealFromFood, líneas 25-44) YA se portaron verbatim a
// native/src/lib/meal-logic.js en Etapa 4b — no se vuelven a definir acá.
// MealForm en sí no las llama: arma su propio registro de comida con
// `items[]` para el carrito multi-alimento.
//
// Buscar → elegir → gramos. Se conserva la regla de foodvoice.js: nunca se
// inventan macros. Un alimento que no está en ningún lado se crea a mano una
// vez, con los cuatro campos de siempre, y desde entonces queda disponible
// en el buscador.
//
// Cada ítem del carrito guarda el `food` original, no sólo sus macros ya
// escalados: recalcular los gramos vuelve a llamar a macrosFor() sobre la
// fuente, en vez de re-escalar un número ya escalado (que pierde precisión y
// se rompe si los gramos pasan por cero). setGramos() SÍ parsea en cada
// cambio (necesita recalcular kcal en vivo), pero el propio campo de gramos
// es un TextInput controlado normal — lo que se muestra es exactamente lo
// que la última edición produjo, sin riesgo de reformateo intermedio.
//
// AlimentoNuevo (alta de alimento nuevo) usa sus 4 campos numéricos como
// inputs controlados con el string crudo tal cual se tipeó — el parseo sólo
// pasa una vez, al confirmar en crear() — mismo patrón que SessionExercise.js
// (Etapa 5i): reescribir el value con un número redondeado en cada tecla
// rompe borrar-y-retipear y corta decimales a medio escribir ("62.").
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { S, bump, closeSheet } from '../../lib/state.js';
import { uid, vibrate, round1 } from '../../lib/format.js';
import { idb } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { searchFoods, macrosFor, defaultGrams } from '../../lib/foodsearch.js';
import { SLOTS, slotForTime } from '../../lib/meals.js';
import { C } from '../../theme';

const ahora = () => new Date().toTimeString().slice(0, 5);

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
    <View style={styles.wrap}>
      <Text style={styles.h2}>Agregar comida</Text>

      <View style={styles.seg}>
        {SLOTS.map(s => (
          <Pressable
            key={s.k}
            style={[styles.segBtn, slot === s.k && styles.segBtnOn]}
            onPress={() => setSlot(s.k)}
          >
            <Text style={[styles.segBtnText, slot === s.k && styles.segBtnTextOn]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.field}>
        <TextInput
          ref={buscarRef}
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder="🔍 Buscá un alimento"
          placeholderTextColor={C.mut2}
          autoComplete="off"
        />
      </View>

      <View style={styles.hits}>
        {hits.map(f => (
          <Pressable key={f.key} style={styles.hit} onPress={() => agregar(f)}>
            <View style={styles.grow}>
              <View style={styles.hitNameRow}>
                <Text style={styles.hitName}>{f.name}</Text>
                {f.source === 'mine' && <Text style={styles.tag}>tuyo</Text>}
              </View>
            </View>
            <Text style={styles.hitSub}>{f.kcal} kcal{f.base === '100g' ? '/100g' : '/porción'}</Text>
          </Pressable>
        ))}
        {q.trim() && !hits.length && (
          <Pressable style={[styles.hit, styles.hitNuevo]} onPress={() => setNuevo(q.trim())}>
            <View style={styles.grow}>
              <Text style={styles.hitName}>Crear "{q.trim()}"</Text>
            </View>
            <Text style={styles.hitSub}>no lo tengo · lo definís vos</Text>
          </Pressable>
        )}
      </View>

      {carrito.length > 0 && (
        <>
          <Text style={styles.sect}>En esta comida</Text>
          <View style={styles.card}>
            {carrito.map((i, idx) => (
              <View key={idx} style={styles.cartRow}>
                <Text style={styles.cartName}>{i.food.name}</Text>
                <TextInput
                  style={styles.cartInput}
                  keyboardType="decimal-pad"
                  value={String(i.grams)}
                  onChangeText={v => setGramos(idx, v)}
                />
                <Text style={styles.cartUnit}>g</Text>
                <Text style={styles.cartKcal}>{i.kcal} kcal</Text>
                <Pressable style={styles.miniRed} onPress={() => quitar(idx)}>
                  <Text style={styles.miniRedText}>✕</Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.cartTotal}>
              <Text style={styles.cartTotalLabel}>Total</Text>
              <Text style={styles.cartTotalKcal}>{Math.round(total.kcal)} kcal</Text>
            </View>
            <Text style={styles.cartMacros}>P {total.p} · C {total.c} · G {total.f}</Text>
          </View>
        </>
      )}

      <Pressable style={styles.btn} onPress={guardar}>
        <Text style={styles.btnText}>Agregar</Text>
      </Pressable>
    </View>
  );
}

/** El caso "no lo tengo": los cuatro campos de siempre, una sola vez. Se
    guarda en S.foods con base 'portion' — son los macros de lo que te vas a
    comer, no de 100 g.

    Los campos guardan el string tal cual se tipeó y sólo se parsean al
    confirmar: reescribir el value con un número redondeado en cada tecla
    rompe borrar-y-retipear y corta decimales a medio escribir ("62."). */
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
    <View style={styles.wrap}>
      <Text style={styles.h2}>Alimento nuevo</Text>
      <Text style={styles.sub}>
        No lo tengo en la base, así que no me lo invento. Poné sus macros una vez
        y queda guardado para siempre.
      </Text>
      <View style={styles.field}>
        <Text style={styles.label}>Nombre</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} autoComplete="off" />
      </View>
      <View style={styles.f2}>
        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>Calorías</Text>
          <TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={C.mut2} value={kcal} onChangeText={setKcal} />
        </View>
        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>Proteína (g)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.mut2} value={prot} onChangeText={setProt} />
        </View>
        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>Carbos (g)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.mut2} value={carbs} onChangeText={setCarbs} />
        </View>
        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>Grasa (g)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.mut2} value={fat} onChangeText={setFat} />
        </View>
      </View>
      <Pressable style={styles.btn} onPress={crear}>
        <Text style={styles.btnText}>Guardar y agregar</Text>
      </Pressable>
      <Pressable style={styles.btnDim} onPress={onCancel}>
        <Text style={styles.btnText}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 14 },
  sub: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 14 },

  seg: { flexDirection: 'row', backgroundColor: C.line, borderRadius: 12, padding: 4, marginBottom: 14 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segBtnOn: { backgroundColor: C.blue },
  segBtnText: { color: C.mut, fontSize: 13, fontWeight: '600' },
  segBtnTextOn: { color: C.txt },

  field: { marginBottom: 14 },
  label: { color: C.mut, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: C.txt,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.line,
  },

  hits: { marginBottom: 6 },
  hit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.line, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  hitNuevo: { backgroundColor: 'rgba(46,125,255,.12)' },
  grow: { flex: 1 },
  hitNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hitName: { color: C.txt, fontSize: 14, fontWeight: '600' },
  tag: { color: C.blue, fontSize: 11, fontWeight: '700' },
  hitSub: { color: C.mut, fontSize: 12, marginLeft: 8 },

  sect: { color: C.mut, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.line },
  cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, gap: 8 },
  cartName: { color: C.txt, fontSize: 13, fontWeight: '600', flex: 1 },
  cartInput: {
    width: 56, backgroundColor: C.line, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6, color: C.txt, fontSize: 13,
    borderWidth: 1, borderColor: C.line, textAlign: 'right',
  },
  cartUnit: { color: C.mut, fontSize: 12 },
  cartKcal: { color: C.mut, fontSize: 13, minWidth: 56, textAlign: 'right' },
  miniRed: { paddingHorizontal: 6, paddingVertical: 4 },
  miniRedText: { color: C.red, fontSize: 15 },
  cartTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  cartTotalLabel: { color: C.txt, fontSize: 13, fontWeight: '700' },
  cartTotalKcal: { color: C.blue, fontSize: 15, fontWeight: '700' },
  cartMacros: { color: C.mut, fontSize: 13, textAlign: 'right', marginTop: 2 },

  f2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  half: { flexBasis: '47%', flexGrow: 1 },

  btn: { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnDim: { backgroundColor: C.line, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnText: { color: C.txt, fontSize: 14, fontWeight: '700' },
});
