// Puerto de web/src/components/sheets/ExInfo.jsx — ficha educativa de un
// ejercicio + su esquema RIR. `wd` se recibe por paridad con la firma
// original (sheetExInfo(name,wd,exId)) pero, igual que en el original, no se
// usa: el esquema de sets/reps se busca recorriendo TODOS los días de
// S.routine por exId, no sólo `wd`.
import { View, Text, Image, StyleSheet } from 'react-native';
import { illusUrl } from '../../lib/illustrations.js';
import { equipLabel } from '../../lib/equip.js';
import { S } from '../../lib/state.js';
import { exInfo, rirScheme, isLowerBackLift } from '../../lib/exdb.js';
import { fibrasDe } from '../../lib/fibras.js';
import BodyMini from '../BodyMini.js';
import { C } from '../../theme';

export default function ExInfo({ name, exId }) {
  const info = exInfo(name);
  let sets = null, ex = null;
  for (const d of Object.values(S.routine)) {
    const found = (d.exercises || []).find(x => x.id === exId);
    if (found) { sets = found.sets; ex = found; }
  }
  const scheme = sets ? rirScheme(sets, name) : null;

  const fibras = fibrasDe(name);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>{name}</Text>

      {/* Qué porción trabaja, sobre el mismo cuerpo del mapa de Inicio. Va
          primero: es lo que contesta "¿para qué hago esto?" de un vistazo,
          antes que el texto. */}
      {fibras && <BodyMini fibras={fibras} />}

      {/* Ilustración del movimiento y, si le sacaste foto, la máquina de tu
          gimnasio. La foto va segunda: la ilustración enseña el movimiento,
          la foto sirve para reconocer dónde hacerlo. */}
      {(ex?.illus || ex?.photo) && (
        <View style={styles.media}>
          {ex.illus && <Image source={{ uri: illusUrl(ex.illus) }} style={styles.mediaImg} resizeMode="cover" />}
          {ex.photo && <Image source={{ uri: ex.photo }} style={styles.mediaImg} resizeMode="cover" />}
        </View>
      )}

      {equipLabel(ex) && (
        <View style={styles.eqRow}>
          <Text style={styles.eqTag}>{equipLabel(ex)}</Text>
        </View>
      )}

      {info ? (
        <>
          <Text style={styles.h3}>Músculos</Text>
          <Text style={styles.body}>{info.m}</Text>
          <Text style={styles.h3}>Por qué elegirlo</Text>
          <Text style={styles.bodyWhy}>
            {info.w.split('⚠').map((part, i, arr) => (
              <Text key={i}>
                {part}
                {i < arr.length - 1 && <Text style={styles.warn}>⚠</Text>}
              </Text>
            ))}
          </Text>
        </>
      ) : (
        <Text style={styles.noInfo}>
          No tengo ficha educativa de este ejercicio todavía. Igual puedes registrarlo y seguir su progresión con normalidad.
        </Text>
      )}

      {scheme && (
        <>
          <Text style={styles.h3}>Esfuerzo por serie (RIR)</Text>
          <View style={styles.chips}>
            {scheme.map((r, i) => (
              <View key={i} style={[styles.chip, r === 0 && styles.chipBlue]}>
                <Text style={styles.chipText}>Serie {i + 1}: {r === 0 ? 'al fallo' : `RIR ${r}`}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.ptext}>
            Solo el <Text style={styles.b}>último set</Text> va al fallo (RIR 0). Los primeros dejan reps en reserva para no arruinar el volumen con fatiga.
            {isLowerBackLift(name) && <Text style={styles.warn}> En este ejercicio nunca vayas al fallo (zona lumbar): máximo RIR 1.</Text>}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: C.txt, fontSize: 19, fontWeight: '700', marginBottom: 10 },
  h3: { color: C.txt, fontSize: 15, fontWeight: '700', marginTop: 14, marginBottom: 4 },
  body: { color: C.mut, fontSize: 15, lineHeight: 22 },
  bodyWhy: { color: C.mut, fontSize: 15, lineHeight: 21 },
  warn: { color: C.warn },
  b: { color: C.mut, fontWeight: '700' },
  noInfo: { color: C.mut, fontSize: 14, lineHeight: 20, marginVertical: 8 },
  media: { flexDirection: 'row', gap: 8, marginTop: 8 },
  mediaImg: { flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: C.line },
  eqRow: { marginTop: 8 },
  eqTag: { color: C.mut, fontSize: 13, backgroundColor: C.line, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: C.line2 },
  chipBlue: { backgroundColor: 'rgba(96,165,250,.18)' },
  chipText: { color: C.txt, fontSize: 13, fontWeight: '600' },
  ptext: { color: C.mut, fontSize: 13, lineHeight: 19 },
});
