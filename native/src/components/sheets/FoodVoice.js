// Puerto de web/src/components/sheets/FoodVoice.jsx — registrar comida
// dictando o escribiendo lo que se comió.
//
// RULING de alcance (ver docs/superpowers/plans/2026-08-22-rn-etapa5j-
// foodvoice.md): el dictado por voz del original usa la Web Speech API del
// navegador, sin equivalente directo en RN — requeriría instalar una
// librería nativa de reconocimiento de voz y probarla en un dispositivo
// real, nada de eso verificable en este entorno. Se porta el camino de
// TEXTO completo (el campo "O escribilo" + parseFoodSpeech(), ya portado y
// testeado en lib/foodvoice.js desde Etapa 4b) y el botón "🎙 Dictar" queda
// deshabilitado, con un texto que avisa que el dictado llega en una etapa
// futura — no se oculta el botón (mantiene la promesa) ni se simula un
// dictado falso.
import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { S, closeSheet, bump } from '../../lib/state.js';
import { idb } from '../../lib/db.js';
import { uid, fmtNum, round1, vibrate } from '../../lib/format.js';
import { parseFoodSpeech, sumItems } from '../../lib/foodvoice.js';
import { toast } from '../../lib/toast.js';
import { C } from '../../theme';

export default function FoodVoice() {
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);

  function reparse(t) {
    setText(t);
    setItems(parseFoodSpeech(t, S.foods));
  }

  const known = items.filter(i => !i.unknown);
  const unknown = items.filter(i => i.unknown);
  const total = sumItems(items);

  async function confirm() {
    if (!known.length) return;
    const time = new Date().toTimeString().slice(0, 5);
    for (const i of known) {
      const meal = {
        id: uid(), date: S.nutriDate, name: i.name,
        kcal: i.kcal, p: i.p, c: i.c, f: i.f, t: time,
      };
      await idb.put('meals', meal);
      S.meals.push(meal);
    }
    vibrate(14);
    bump();
    closeSheet();
    toast(`＋ ${known.length} ${known.length === 1 ? 'comida' : 'comidas'} · ${total.kcal} kcal`);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Registrar por voz</Text>
      <Text style={styles.mut}>
        Decí lo que comiste, con cantidades si las sabés. Por ejemplo:
        «200 gramos de pollo y una taza de arroz».
      </Text>

      <View style={styles.disabledBtn}>
        <Text style={styles.disabledBtnText}>🎙 Dictar</Text>
        <Text style={styles.disabledBtnSub}>El dictado por voz llega en una etapa futura — por ahora, escribilo abajo</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>O escribilo</Text>
        <TextInput
          style={styles.input}
          value={text}
          placeholder="dos huevos, 150 g de pollo…"
          placeholderTextColor={C.mut2}
          onChangeText={reparse}
        />
      </View>

      {known.length > 0 && (
        <>
          <Text style={styles.sect}>Reconocido</Text>
          <View style={styles.card}>
            {known.map((i, n) => (
              <View style={styles.row} key={n}>
                <View style={styles.grow}>
                  <Text style={styles.t}>{i.name}</Text>
                  <Text style={styles.s}>
                    {i.grams ? `${i.grams} g · ` : ''}{i.kcal} kcal · P {fmtNum(round1(i.p))} · C {fmtNum(round1(i.c))} · G {fmtNum(round1(i.f))}
                    {i.source === 'mine' && <Text style={styles.tag}>  tuyo</Text>}
                  </Text>
                </View>
                <Pressable style={styles.del} onPress={() => setItems(items.filter(x => x !== i))}>
                  <Text style={styles.delText}>✕</Text>
                </Pressable>
              </View>
            ))}
            <View style={[styles.row, styles.totalRow]}>
              <View style={styles.grow}><Text style={styles.t}>Total</Text></View>
              <Text style={styles.totalKcal}>{total.kcal} kcal</Text>
            </View>
          </View>
        </>
      )}

      {unknown.length > 0 && (
        <>
          <Text style={styles.sect}>No lo reconozco</Text>
          <View style={styles.card}>
            <Text style={styles.explain}>
              No le invento macros a lo que no conozco. Agregalo una vez con
              «+ Agregar comida» y marcalo como frecuente: desde entonces lo
              reconozco cuando lo dictes.
            </Text>
            {unknown.map((i, n) => (
              <View style={styles.row} key={n}>
                <View style={styles.grow}><Text style={styles.t}>{i.name}</Text></View>
              </View>
            ))}
          </View>
        </>
      )}

      {known.length > 0 && (
        <Pressable style={styles.confirmBtn} onPress={confirm}>
          <Text style={styles.confirmBtnText}>
            Agregar {known.length === 1 ? 'la comida' : `las ${known.length} comidas`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 6 },
  mut: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 14 },

  disabledBtn: { backgroundColor: C.line, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, opacity: 0.55 },
  disabledBtnText: { color: C.txt, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  disabledBtnSub: { color: C.mut, fontSize: 12, textAlign: 'center', marginTop: 4 },

  field: { marginTop: 16 },
  label: { color: C.mut, fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, color: C.txt, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },

  sect: { color: C.mut, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  grow: { flex: 1 },
  t: { color: C.txt, fontSize: 14, fontWeight: '600' },
  s: { color: C.mut, fontSize: 12, marginTop: 2 },
  tag: { color: C.blue, fontSize: 11, fontWeight: '700' },
  del: { paddingHorizontal: 8, paddingVertical: 4 },
  delText: { color: C.mut, fontSize: 16 },
  totalRow: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: C.line2 },
  totalKcal: { color: C.blue, fontSize: 15, fontWeight: '700' },

  explain: { color: C.mut, fontSize: 12.5, lineHeight: 18, marginBottom: 10 },

  confirmBtn: { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  confirmBtnText: { color: C.txt, fontWeight: '700', fontSize: 15 },
});
