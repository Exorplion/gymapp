// Puerto de web/src/components/BodyMini.jsx — el cuerpo chico que muestra
// qué trabaja un ejercicio.
//
// Usa la misma lámina que el mapa de Inicio (Silhouette), así que lo que ves
// acá y lo que ves allá son literalmente el mismo dibujo — no dos
// ilustraciones que puedan contradecirse.
//
// Acá SÍ se pintan los parches (clavicular, vasto interno, dorsal alto...): es
// justamente para lo que existen. En el mapa general quedan afuera porque
// pintarlos junto al músculo entero deja manchas; acá reemplazan al padre y
// muestran la porción exacta.
//
// Se dibujan las dos caras siempre, aunque el ejercicio trabaje sólo una: un
// cuerpo al que le falta la espalda se lee como un error, no como "acá no hay
// nada". La cara sin nada marcado se ve apagada, que ya dice lo suyo.
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { cuerpo } from '../lib/bodydata.js';
import { esGrupo, ZONA_DE } from '../lib/fibras.js';
import { S } from '../lib/state.js';

/** Las zonas que hay que encender para una lista de nombres.

    Devuelve un predicado sobre las zonas de la lámina: una zona se enciende si
    su subzona coincide por nombre, o —cuando el nombre es un grupo entero— si
    su categoría coincide. */
function enciende(nombres) {
  const subs = new Set(nombres.filter(n => !esGrupo(n)));
  const cats = new Set(nombres.filter(esGrupo).map(n => ZONA_DE[n] || n));
  return z => (z.sub && subs.has(z.sub)) || (z.cat && cats.has(z.cat));
}

function Cara({ cara, principales, secundarias }) {
  const esP = enciende(principales);
  const esS = enciende(secundarias);

  /* Si hay un parche encendido, su músculo padre se apaga: mostrar el pecho
     entero Y el clavicular encima sería decir "trabaja todo el pecho" cuando lo
     que queremos decir es "sobre todo esta parte". */
  const padresTapados = new Set(
    cara.zonas.filter(z => z.parche && (esP(z) || esS(z))).map(z => z.cat),
  );

  const nivel = z => {
    if (esP(z)) return 'bm-p';
    if (esS(z)) return 'bm-s';
    return 'bm-off';
  };

  const visibles = cara.zonas.filter(z => {
    if (z.cat === 'pelo' || !z.cat) return !z.parche;      // cabeza, pelo, manos
    if (z.parche) return esP(z) || esS(z);                 // sólo el parche que marca
    return !padresTapados.has(z.cat) || !(esP(z) || esS(z));
  });

  const colorDe = nivelKey => {
    if (nivelKey === 'bm-p') return 'url(#bm-grad)';
    if (nivelKey === 'bm-s') return 'rgba(34,211,238,.4)';
    return '#232c42';
  };

  return (
    <Svg viewBox={cara.viewBox} width="100%" height="100%" accessibilityElementsHidden>
      {/* Degradado propio, no el de Silhouette: BodyMini se abre desde
          Rutina, donde la silueta de Inicio NO está montada. react-native-svg
          registra gradientes por instancia de <Svg> (no globalmente como el
          DOM), así que un <Defs> en un <Svg> separado sería invisible acá —
          dejaría los músculos pintados de negro. Cada <Svg> lleva su propio
          <Defs>. */}
      <Defs>
        <LinearGradient id="bm-grad" x1="12%" y1="0%" x2="88%" y2="100%">
          <Stop offset="0%" stopColor="#B9F8FF" />
          <Stop offset="45%" stopColor="#22D3EE" />
          <Stop offset="100%" stopColor="#0A6F88" />
        </LinearGradient>
      </Defs>

      <G>
        {cara.zonas.filter(z => !z.parche).map((z, i) => z.d.map((d, j) => (
          <Path key={`masa-${i}.${j}`} d={d} fill="#101B2F" stroke="#101B2F" strokeWidth={2} strokeLinejoin="round" />
        )))}
      </G>
      {visibles.map((z, i) => {
        const key = z.cat === 'pelo' ? 'bm-pelo' : !z.cat ? 'bm-off' : nivel(z);
        const fill = key === 'bm-pelo' ? '#3a2a1c' : colorDe(key);
        return (
          <G key={i}>
            {z.d.map((d, j) => <Path key={j} d={d} fill={fill} stroke="none" />)}
          </G>
        );
      })}
    </Svg>
  );
}

/**
 * @param {{ p: string[], s: string[] }} fibras  porciones principales y secundarias
 */
export default function BodyMini({ fibras }) {
  const { frente, espalda } = cuerpo(S.cfg.bodySex || S.cfg.profile?.sex);
  const p = fibras?.p || [];
  const s = fibras?.s || [];
  if (!p.length && !s.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.cuerpos}>
        <View style={styles.svgBox}>
          <Cara cara={frente} principales={p} secundarias={s} />
        </View>
        <View style={styles.svgBox}>
          <Cara cara={espalda} principales={p} secundarias={s} />
        </View>
      </View>
      <View style={styles.leyenda}>
        <Text style={styles.tagP}>{p.join(' · ')}</Text>
        {s.length > 0 && <Text style={styles.tagS}>también {s.join(' · ')}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  cuerpos: { flexDirection: 'row', gap: 12, width: '100%' },
  svgBox: { flex: 1, aspectRatio: 638 / 1260 },
  leyenda: { marginTop: 10, alignItems: 'center' },
  tagP: { color: '#B9F8FF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  tagS: { color: '#8a93a6', fontSize: 12, marginTop: 2, textAlign: 'center' },
});
