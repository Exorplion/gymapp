// Puerto de web/src/components/sheets/ExerciseForm.jsx (alta/edición de un
// ejercicio de la rutina). Incluye: autocompletado en vivo (estado derivado
// del input, no un listener global), sugeridos para el día
// (recommendedExercises), el explorador de catálogo completo (sólo al
// crear) y los steppers de series/reps (mismo patrón que Preworkout.js).
//
// DIFERIDO esta etapa (ver plan 2026-08-22-rn-etapa5n-exerciseform.md):
// dictado por voz (SpeechRecognition — sin librería nativa instalada ni
// dispositivo para probar) y foto de la máquina (requiere expo-image-picker/
// expo-image-manipulator, tampoco instalados). El ejercicio se guarda sin
// esas dos secciones; `photo` se pasa a saveExercise sin tocar (`ex?.photo
// || ''`) para no borrar una foto que el ejercicio ya tuviera guardada
// desde antes — este formulario recortado no tiene forma de reponerla si la
// pisara con ''.
import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, StyleSheet } from 'react-native';
import { EQUIP, EQUIP_HINT, isMachineBound } from '../../lib/equip.js';
import MachineField from '../MachineField.js';
import { MUSCLE_CATS, catOf, EXCATALOG } from '../../lib/muscle.js';
import { illusUrl } from '../../lib/illustrations.js';
import IllusPick from '../IllusPick.js';
import { norm } from '../../lib/format.js';
import { recommendedExercises, saveExercise } from '../../lib/rutina-logic.js';
import { C } from '../../theme';

const CATALOG_CATS = [...new Set(EXCATALOG.map(e => e.c))];

export default function ExerciseForm({ wd, ex }) {
  const [name, setName] = useState(ex ? ex.name : '');
  const [sets, setSets] = useState(ex ? ex.sets : 4);
  const [reps, setReps] = useState(ex ? ex.reps : 10);
  const [equip, setEquip] = useState(ex?.equip || '');
  const [cat, setCat] = useState(ex?.cat || '');
  const [machine, setMachine] = useState(ex?.machine || '');
  const [unilateral, setUnilateral] = useState(!!ex?.unilateral);
  const [illus, setIllus] = useState(ex?.illus || '');
  const [picking, setPicking] = useState(false);
  const [acOpen, setAcOpen] = useState(false);
  const [explorando, setExplorando] = useState(false);
  const nameRef = useRef(null);

  /* El teclado se abre solo al CREAR, que es cuando lo primero que vas a
     hacer es escribir un nombre. Al editar no: entrás a cambiar las series o
     el equipo, y el teclado tapa media pantalla para un campo que no ibas a
     tocar. Si querés cambiar el nombre, lo tocás. */
  useEffect(() => {
    if (ex) return;
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [ex]);

  const suggestions = ex ? [] : recommendedExercises(wd);
  const nq = norm(name);
  const acMatches = acOpen && nq ? EXCATALOG.filter(e => norm(e.n).includes(nq)).slice(0, 6) : [];

  function pickName(n) { setName(n); setAcOpen(false); }
  function handleNameChange(v) { setName(v); setAcOpen(true); }

  function step(setter, d) { setter(v => Math.max(1, (parseInt(v) || 0) + d)); }

  // lo que el matcher deduce del nombre, para mostrarlo antes de que elijas
  const auto = catOf({ name });
  function handleSave() {
    saveExercise(wd, ex ? ex.id : null, { name, sets, reps, equip, machine, photo: ex?.photo || '', illus, cat, unilateral });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>{ex ? 'Editar' : 'Nuevo'} ejercicio</Text>

      <Text style={styles.label}>Nombre</Text>
      <TextInput
        ref={nameRef}
        style={styles.input}
        value={name}
        onChangeText={handleNameChange}
        placeholder="Press banca"
        placeholderTextColor={C.mut2}
        autoCorrect={false}
      />
      {acMatches.length > 0 && (
        <View style={styles.acList}>
          {acMatches.map(e => (
            <Pressable key={e.n} style={styles.acItem} onPress={() => pickName(e.n)}>
              <Text style={styles.acItemText}>{e.n} <Text style={styles.mut}>· {e.c}</Text></Text>
            </Pressable>
          ))}
        </View>
      )}

      {suggestions.length > 0 && (
        <>
          <Text style={styles.eyebrow}>Sugeridos para hoy</Text>
          <View style={styles.chips}>
            {suggestions.map(e => (
              <Pressable key={e.n} style={styles.chip} onPress={() => pickName(e.n)}>
                <Text style={styles.chipText}>{e.n}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {!ex && (
        <View style={{ marginTop: 10 }}>
          <Pressable onPress={() => setExplorando(v => !v)}>
            <Text style={styles.explorarLink}>📚 {explorando ? 'Ocultar' : 'Explorar toda la'} base de ejercicios</Text>
          </Pressable>
          {explorando && (
            <View style={{ marginTop: 8 }}>
              {CATALOG_CATS.map(c => (
                <View key={c}>
                  <Text style={styles.eyebrow}>{c}</Text>
                  <View style={styles.chips}>
                    {EXCATALOG.filter(e => e.c === c).map(e => (
                      <Pressable key={e.n} style={styles.chip} onPress={() => pickName(e.n)}>
                        <Text style={styles.chipText}>{e.n}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.row2}>
        <View style={styles.field}>
          <Text style={styles.label}>Series objetivo</Text>
          <View style={styles.step}>
            <Pressable style={styles.stepBtn} onPress={() => step(setSets, -1)}><Text style={styles.stepBtnText}>−</Text></Pressable>
            <TextInput
              style={styles.stepVal}
              keyboardType="numeric"
              value={String(sets)}
              onChangeText={setSets}
            />
            <Pressable style={styles.stepBtn} onPress={() => step(setSets, 1)}><Text style={styles.stepBtnText}>+</Text></Pressable>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Reps objetivo</Text>
          <View style={styles.step}>
            <Pressable style={styles.stepBtn} onPress={() => step(setReps, -1)}><Text style={styles.stepBtnText}>−</Text></Pressable>
            <TextInput
              style={styles.stepVal}
              keyboardType="numeric"
              value={String(reps)}
              onChangeText={setReps}
            />
            <Pressable style={styles.stepBtn} onPress={() => step(setReps, 1)}><Text style={styles.stepBtnText}>+</Text></Pressable>
          </View>
        </View>
      </View>

      {/* Unilateral: un lado por vez. Cambia sólo cómo se lee lo que anotás en
          la sesión —"20 kg × 12 por lado" y no "20 kg × 12" a secas— no cómo se
          guarda. */}
      <Text style={styles.eyebrow}>Cómo se hace</Text>
      <View style={styles.chips}>
        <Pressable
          style={[styles.chip, unilateral && styles.chipOn]}
          onPress={() => setUnilateral(u => !u)}
        >
          <Text style={[styles.chipText, unilateral && styles.chipTextOn]}>Un lado por vez</Text>
        </Pressable>
      </View>
      {unilateral && (
        <Text style={styles.ptext}>
          El peso y las reps que anotes en la sesión van a leerse como "por lado".
        </Text>
      )}

      {/* Qué grupo entrena. El automático acierta en la mayoría, pero ninguna
          lista de palabras va a adivinar "JM press unilateral" — por eso hay
          una salida manual, y por eso se muestra qué dedujo antes de tocarla. */}
      <Text style={styles.eyebrow}>
        Qué grupo entrena
        {!cat && auto ? <Text style={styles.mut}> · detecté {auto}</Text> : null}
        {!cat && !auto && name.trim() ? <Text style={styles.warn}> · no lo reconozco, elegilo</Text> : null}
      </Text>
      <View style={styles.chips}>
        {MUSCLE_CATS.map(c => (
          <Pressable
            key={c}
            style={[styles.chip, cat === c ? styles.chipOn : (!cat && auto === c ? styles.chipBlue : null)]}
            onPress={() => setCat(cat === c ? '' : c)}
          >
            <Text style={[styles.chipText, cat === c && styles.chipTextOn]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      {/* Con qué se hace el ejercicio. Es lo que permite que el historial no
          mezcle números que no son comparables — ver lib/equip.js. */}
      <Text style={styles.eyebrow}>Con qué lo hacés</Text>
      <View style={styles.chips}>
        {EQUIP.map(e => (
          <Pressable
            key={e.id}
            style={[styles.chip, equip === e.id && styles.chipOn]}
            onPress={() => setEquip(equip === e.id ? '' : e.id)}
          >
            <Text style={[styles.chipText, equip === e.id && styles.chipTextOn]}>{e.label}</Text>
          </Pressable>
        ))}
      </View>
      {equip && (
        <Text style={styles.ptext}>{EQUIP_HINT[equip]}</Text>
      )}
      {isMachineBound(equip) && (
        <MachineField equip={equip} machine={machine} onChange={setMachine} />
      )}

      {/* Ilustración del movimiento (free-exercise-db, dominio público). Se
          elige a mano una vez: la base es en inglés y adivinar automáticamente
          pondría la imagen equivocada más de una vez. */}
      <View style={{ marginTop: 14 }}>
        <Text style={styles.label}>Ilustración del movimiento</Text>
        {illus ? (
          <View style={styles.illusBox}>
            <Image source={{ uri: illusUrl(illus) }} style={styles.illusImg} resizeMode="cover" />
            <View style={styles.illusActs}>
              <Pressable style={styles.ghostBtnSm} onPress={() => setPicking(true)}>
                <Text style={styles.ghostBtnSmText}>Cambiar</Text>
              </Pressable>
              <Pressable style={styles.ghostBtnSm} onPress={() => setIllus('')}>
                <Text style={styles.ghostBtnSmText}>Quitar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Pressable style={styles.ghostBtn} onPress={() => setPicking(true)}>
              <Text style={styles.ghostBtnText}>🖼 Buscar ilustración</Text>
            </Pressable>
            <Text style={styles.ptext}>
              Para ver cómo se hace el movimiento. Se descarga la primera vez y queda guardada.
            </Text>
          </>
        )}
        {picking && (
          <IllusPick exName={name} onPick={setIllus} onClose={() => setPicking(false)} />
        )}
      </View>

      <Pressable style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Guardar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 12 },
  label: { color: C.mut, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  mut: { color: C.mut },
  warn: { color: C.warn },
  input: {
    backgroundColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    color: C.txt, fontSize: 15, borderWidth: 1, borderColor: C.line,
  },
  acList: { marginTop: 4 },
  acItem: { paddingVertical: 8, paddingHorizontal: 4 },
  acItemText: { color: C.mut, fontSize: 14 },
  eyebrow: { color: C.mut, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 7, paddingHorizontal: 13, borderRadius: 16,
    backgroundColor: C.line, borderWidth: 1, borderColor: C.line,
  },
  chipOn: { backgroundColor: 'rgba(46,125,255,.16)', borderColor: C.blue },
  chipBlue: { borderColor: 'rgba(46,125,255,.5)' },
  chipText: { color: C.mut, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: C.blue2 },
  explorarLink: { color: C.blue2, fontSize: 13, fontWeight: '600' },
  ptext: { color: C.mut, fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  row2: { flexDirection: 'row', gap: 12, marginTop: 14 },
  field: { flex: 1 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.line, borderWidth: 1, borderColor: C.line,
  },
  stepBtnText: { color: C.txt, fontSize: 18, fontWeight: '700' },
  stepVal: {
    flex: 1, textAlign: 'center', color: C.txt, fontSize: 16, fontWeight: '700',
    backgroundColor: C.line, borderRadius: 10, paddingVertical: 8,
  },
  illusBox: { backgroundColor: C.line, borderRadius: 12, padding: 8, marginTop: 6 },
  illusImg: { width: '100%', aspectRatio: 1.6, borderRadius: 8, backgroundColor: C.line },
  illusActs: { flexDirection: 'row', gap: 8, marginTop: 8 },
  ghostBtnSm: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: C.line2,
  },
  ghostBtnSmText: { color: C.txt, fontSize: 13, fontWeight: '600' },
  ghostBtn: {
    marginTop: 6, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: C.line2,
  },
  ghostBtnText: { color: C.txt, fontSize: 14, fontWeight: '700' },
  saveBtn: { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: C.txt, fontWeight: '700', fontSize: 15 },
});
