// Puerto de web/src/components/sheets/CopyExercises.jsx (250 líneas).
//
// Llevar ejercicios de un turno a otro. Un solo componente para las dos
// direcciones, porque las dos muestran lo mismo — de dónde, adónde y cuáles —
// y sólo cambia qué extremo viene fijo:
//
//   push ("Copiar a otro turno")  → origen fijo, elegís destino
//   pull ("Traer de otro turno")  → destino fijo, elegís origen
//
// Anterior A y Anterior B son la misma rutina: hasta ahora armarlas era cargar
// nueve ejercicios a mano dos veces, y cada corrección otras dos.
//
// FIX de bug real y confirmado del original (no introducido por esta
// migración, ver plan de Etapa 5h): el original destructura `{ mode, index }`
// pero sus dos únicos call sites (Rutina.jsx) pasan `wd`, nunca `index` — por
// lo tanto en el original `index` SIEMPRE es `undefined`, `propio = +index`
// es `NaN`, y cada filtro `i !== propio` es siempre verdadero (`NaN` nunca es
// igual a nada): el turno actual nunca se excluye de "otros"/"destinos". Acá
// se destructura `wd` (el nombre real que pasan los call sites, tanto los de
// `Rutina.jsx` en web como los de `Rutina.js` en esta migración) para que el
// filtro funcione desde el día uno. Resto de la lógica portado verbatim.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { S, closeSheet } from '../../lib/state.js';
import { equipLabel, exKey } from '../../lib/equip.js';
import { copyExercises, copySourceExercises } from '../../lib/rutina-logic.js';
import { C } from '../../theme';

// Nombre a mostrar para un turno de la secuencia actual.
const slotLabel = i => S.routine[i]?.name || `Turno ${i + 1}`;

export default function CopyExercises({ mode = 'push', wd }) {
  const propio = +wd;
  const esPush = mode === 'push';

  // Turnos con ejercicios, que son los únicos que sirven de origen.
  const conEjercicios = S.routine.map((s, i) => i).filter(i => S.routine[i]?.exercises?.length);
  const otros = conEjercicios.filter(i => i !== propio);

  /* Destinos posibles: primero los turnos que ya tienen ejercicios —que es a
     lo que uno quiere copiar— y después los libres. Ordenados así porque la
     pregunta real casi siempre es "a cuál de mis otros turnos", no "a qué
     casillero vacío". */
  const destinos = useMemo(() => {
    const resto = S.routine.map((s, i) => i).filter(i => i !== propio);
    return [
      ...resto.filter(i => S.routine[i]?.exercises?.length),
      ...resto.filter(i => !S.routine[i]?.exercises?.length),
    ];
  }, [propio]);

  const [fuente, setFuente] = useState('actual');          // sólo en pull
  const [libId, setLibId] = useState(S.lib[0]?.id ?? null);
  const [libIndex, setLibIndex] = useState(null);
  const [origenIndex, setOrigenIndex] = useState(esPush ? propio : (otros[0] ?? null));
  const [destinoIndex, setDestinoIndex] = useState(esPush ? null : propio);
  const [sel, setSel] = useState(null);                     // null = todos
  const [modo, setModo] = useState('merge');

  const rutinaLib = S.lib.find(r => r.id === libId) || null;
  const diasLib = rutinaLib ? rutinaLib.days.map((d, i) => i).filter(i => rutinaLib.days[i]?.exercises?.length) : [];
  const libIndexActivo = libIndex != null && diasLib.includes(libIndex) ? libIndex : (diasLib[0] ?? null);

  const src = useMemo(() => (
    (!esPush && fuente === 'lib')
      ? { libId, libIndex: libIndexActivo }
      : { fromIndex: esPush ? propio : origenIndex }
  ), [esPush, fuente, libId, libIndexActivo, propio, origenIndex]);

  const disponibles = copySourceExercises(src);
  const idDe = e => e.id ?? e.name;

  const destino = esPush ? destinoIndex : propio;
  const exsDestino = destino != null ? (S.routine[destino]?.exercises || []) : [];
  const destinoOcupado = exsDestino.length > 0;
  const yaHay = new Set(exsDestino.map(exKey));

  // null = "todos los que se pueden": en merge eso excluye los repetidos, así
  // que la selección por defecto ya es la útil sin que tengas que destildar.
  const seleccion = sel ?? new Set(
    disponibles.filter(e => modo === 'replace' || !yaHay.has(exKey(e))).map(idDe),
  );
  const elegidos = disponibles.filter(e => seleccion.has(idDe(e)));

  function toggle(e) {
    const next = new Set(seleccion);
    const k = idDe(e);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSel(next);
  }

  const todosPuestos = elegidos.length === disponibles.length;
  const alternarTodos = () => setSel(todosPuestos ? new Set() : new Set(disponibles.map(idDe)));

  async function confirmar() {
    if (destino == null || !elegidos.length) return;
    await copyExercises(src, destino, elegidos.map(idDe), destinoOcupado ? modo : 'replace');
    closeSheet();
  }

  const nombreOrigen = (!esPush && fuente === 'lib')
    ? `${rutinaLib?.name || 'rutina'} · ${libIndexActivo != null ? (rutinaLib?.days[libIndexActivo]?.name || `Turno ${libIndexActivo + 1}`) : ''}`
    : slotLabel(esPush ? propio : origenIndex);

  const disabled = destino == null || !elegidos.length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>{esPush ? 'Copiar a otro turno' : 'Traer de otro turno'}</Text>
      <Text style={styles.sub}>
        {esPush
          ? <>Desde <Text style={styles.blue}>{nombreOrigen}</Text>. El historial de cada ejercicio viaja con él.</>
          : <>Hacia <Text style={styles.blue}>{slotLabel(propio)}</Text>. El historial de cada ejercicio viaja con él.</>}
      </Text>

      {/* ---- de dónde (sólo pull) ---- */}
      {!esPush && (
        <>
          {S.lib.length > 0 && (
            <View style={styles.seg}>
              <Pressable
                style={[styles.segBtn, fuente === 'actual' && styles.segBtnOn]}
                onPress={() => { setFuente('actual'); setSel(null); }}
              >
                <Text style={[styles.segBtnText, fuente === 'actual' && styles.segBtnTextOn]}>Mi rutina</Text>
              </Pressable>
              <Pressable
                style={[styles.segBtn, fuente === 'lib' && styles.segBtnOn]}
                onPress={() => { setFuente('lib'); setSel(null); }}
              >
                <Text style={[styles.segBtnText, fuente === 'lib' && styles.segBtnTextOn]}>Mis rutinas</Text>
              </Pressable>
            </View>
          )}
          {fuente === 'actual' ? (
            <View style={styles.field}>
              <Text style={styles.label}>¿De qué turno?</Text>
              {!otros.length ? (
                <Text style={styles.mutSmall}>No hay otro turno con ejercicios todavía.</Text>
              ) : (
                <View style={styles.chips}>
                  {otros.map(i => (
                    <Pressable
                      key={i}
                      style={[styles.chip, i === origenIndex && styles.chipOn]}
                      onPress={() => { setOrigenIndex(i); setSel(null); }}
                    >
                      <Text style={[styles.chipText, i === origenIndex && styles.chipTextOn]}>{slotLabel(i)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>¿De qué rutina?</Text>
                <View style={styles.chips}>
                  {S.lib.map(r => (
                    <Pressable
                      key={r.id}
                      style={[styles.chip, r.id === libId && styles.chipOn]}
                      onPress={() => { setLibId(r.id); setLibIndex(null); setSel(null); }}
                    >
                      <Text style={[styles.chipText, r.id === libId && styles.chipTextOn]}>{r.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {diasLib.length > 0 && (
                <View style={styles.field}>
                  <Text style={styles.label}>¿De qué turno de esa rutina?</Text>
                  <View style={styles.chips}>
                    {diasLib.map(i => (
                      <Pressable
                        key={i}
                        style={[styles.chip, i === libIndexActivo && styles.chipOn]}
                        onPress={() => { setLibIndex(i); setSel(null); }}
                      >
                        <Text style={[styles.chipText, i === libIndexActivo && styles.chipTextOn]}>
                          {rutinaLib.days[i].name || `Turno ${i + 1}`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </>
      )}

      {/* ---- adónde (sólo push) ----

           Se nombra la RUTINA y no sólo el turno. Uno no piensa "el turno 3":
           piensa "Posterior B". Con el número suelto, si no te acordás qué
           rutina vive en cada turno la pregunta no se puede contestar — y el
           lado de "traer de otro turno" ya lo mostraba así desde siempre.

           Los turnos libres se muestran igual, porque copiar a un turno vacío
           es justamente cómo se estrena una rutina nueva; van al final y
           dicen "libre", para que se lean como otra cosa. */}
      {esPush && (
        <View style={styles.field}>
          <Text style={styles.label}>¿A qué rutina?</Text>
          <View style={styles.chipsCol}>
            {destinos.map(i => {
              const turno = S.routine[i];
              const ocupado = !!turno?.exercises?.length;
              return (
                <Pressable
                  key={i}
                  style={[styles.chipAncho, i === destinoIndex && styles.chipOn]}
                  onPress={() => { setDestinoIndex(i); setSel(null); }}
                >
                  <Text style={[styles.chipText, i === destinoIndex && styles.chipTextOn]}>
                    {turno?.name || `Turno ${i + 1}`}
                  </Text>
                  <Text style={[styles.chipSub, i === destinoIndex && styles.chipSubOn]}>
                    {ocupado ? `${turno.exercises.length} ejercicios` : 'libre'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* ---- qué hacer con lo que ya está ---- */}
      {destino != null && destinoOcupado && (
        <View style={styles.calcbox}>
          <Text style={styles.calcText}>
            {slotLabel(destino)} ya tiene <Text style={styles.calcBold}>{exsDestino.length} ejercicios</Text>.
          </Text>
          <Pressable style={styles.radioRow} onPress={() => { setModo('merge'); setSel(null); }}>
            <View style={[styles.radioOuter, modo === 'merge' && styles.radioOuterOn]}>
              {modo === 'merge' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.radioText}>Sumar los que falten <Text style={styles.mut}>— no borra nada</Text></Text>
          </Pressable>
          <Pressable style={styles.radioRow} onPress={() => { setModo('replace'); setSel(null); }}>
            <View style={[styles.radioOuter, modo === 'replace' && styles.radioOuterOn]}>
              {modo === 'replace' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.radioText}>Reemplazar todo <Text style={styles.mut}>— el turno queda igual al origen</Text></Text>
          </Pressable>
        </View>
      )}

      {/* ---- cuáles ---- */}
      <View style={styles.sect}>
        <Text style={styles.sectText}>Qué ejercicios</Text>
        <Pressable style={styles.ghostSm} onPress={alternarTodos}>
          <Text style={styles.ghostSmText}>{todosPuestos ? 'Ninguno' : 'Todos'}</Text>
        </Pressable>
      </View>
      {!disponibles.length ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>Ese turno no tiene ejercicios.</Text>
        </View>
      ) : (
        <View style={styles.pickList}>
          {disponibles.map((e, i) => {
            const repetido = modo === 'merge' && destinoOcupado && yaHay.has(exKey(e));
            const checked = seleccion.has(idDe(e));
            return (
              <Pressable key={idDe(e)} style={[styles.pickRow, repetido && styles.pickRowDim]} onPress={() => toggle(e)}>
                <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                  {checked && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.pickIndex}>{i + 1}</Text>
                <View style={styles.pickGrow}>
                  <Text style={styles.pickName}>{e.name}</Text>
                  <Text style={styles.pickSub}>
                    {equipLabel(e) ? `${equipLabel(e)} · ` : ''}{e.sets}×{e.reps}
                    {repetido && <Text style={styles.warn}> · ya está</Text>}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        style={[styles.btn, disabled && styles.btnDisabled]}
        disabled={disabled}
        onPress={confirmar}
      >
        <Text style={styles.btnText}>
          {destino == null
            ? (esPush ? 'Elegí a dónde' : 'Elegí un turno')
            /* El destino se nombra por su rutina y no por el número de turno,
               igual que en la lista de arriba: "al Posterior A" es lo que uno
               tiene en la cabeza, "al turno 3" te obliga a traducir. */
            : `${esPush ? 'Copiar' : 'Traer'} ${elegidos.length} ejercicio${elegidos.length === 1 ? '' : 's'}${esPush ? ` a ${slotLabel(destino)}` : ''}`}
        </Text>
      </Pressable>
      <Pressable style={styles.btnDim} onPress={closeSheet}>
        <Text style={styles.btnText}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 4 },
  sub: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  blue: { color: C.blue2, fontWeight: '700' },
  mut: { color: C.mut },
  mutSmall: { color: C.mut, fontSize: 13 },
  warn: { color: C.warn },

  seg: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  segBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: C.line, borderWidth: 1, borderColor: C.line,
  },
  segBtnOn: { backgroundColor: C.blue, borderColor: C.blue },
  segBtnText: { color: C.mut, fontSize: 14, fontWeight: '600' },
  segBtnTextOn: { color: C.txt },

  field: { marginBottom: 14 },
  label: { color: C.mut, fontSize: 12, fontWeight: '600', marginBottom: 8 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: C.line, borderWidth: 1, borderColor: C.line,
  },
  chipOn: { backgroundColor: 'rgba(46,125,255,.16)', borderColor: C.blue },
  chipText: { color: C.mut, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: C.blue2 },

  chipsCol: { gap: 8 },
  chipAncho: {
    padding: 12, borderRadius: 12, backgroundColor: C.line,
    borderWidth: 1, borderColor: C.line,
  },
  chipSub: { color: C.mut, fontSize: 12, marginTop: 2 },
  chipSubOn: { color: C.blue3 },

  calcbox: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, marginBottom: 14 },
  calcText: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  calcBold: { color: C.txt, fontWeight: '700' },
  radioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.line2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioOuterOn: { borderColor: C.blue },
  radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: C.blue },
  radioText: { color: C.mut, fontSize: 13, flex: 1, lineHeight: 18 },

  sect: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 },
  sectText: { color: C.mut, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  ghostSm: { marginLeft: 'auto', paddingHorizontal: 12, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.line },
  ghostSmText: { color: C.txt, fontSize: 13, fontWeight: '600' },

  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 16 },
  emptyText: { color: C.mut, fontSize: 13, textAlign: 'center' },

  pickList: { gap: 2 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  pickRowDim: { opacity: 0.5 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: C.line2, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: C.blue, borderColor: C.blue },
  checkboxMark: { color: C.txt, fontSize: 12, fontWeight: '700' },
  pickIndex: { color: C.mut, fontSize: 11, width: 16 },
  pickGrow: { flex: 1 },
  pickName: { color: C.txt, fontSize: 14, fontWeight: '600' },
  pickSub: { color: C.mut, fontSize: 12, marginTop: 2 },

  btn: { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  btnDisabled: { opacity: 0.4 },
  btnDim: { backgroundColor: C.line, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnText: { color: C.txt, fontSize: 14, fontWeight: '700' },
});
