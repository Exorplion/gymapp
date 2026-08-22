// Puerto de web/src/components/Silhouette.jsx — SIN arrastre/giro por gesto.
//
// Ruling de alcance (Etapa 4a, Task 3): la silueta web gira con el dedo y cae
// a la cara más cercana al soltar. Acá no hay emulador/dispositivo para
// verificar un gesto de arrastre, así que esta etapa NO lo porta — mismo
// criterio que el drag-and-drop cortado en una etapa anterior. Lo que sí se
// porta: las tres capas por cuerpo (masa/músculo/luz) y el tap para ver
// stats de un grupo. El frente/espalda es un botón que ALTERNA qué cara se
// dibuja, no un giro 3D.
//
// La geometría viene de lib/bodydata.js (ya portada, mismos paths que la
// web). Este componente no calcula estadísticas: pide groupStats() al tocar.
import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import Svg, { Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { cuerpo } from '../lib/bodydata.js';
import { groupStats, diasTexto } from '../lib/muscle.js';
import { vibrate } from '../lib/format.js';
import { S } from '../lib/state.js';

/** Días → id del gradiente que le corresponde (ver <Defs> más abajo). */
function tono(d) {
  if (d === null || d === undefined) return 'sil-gn';
  if (d <= 1) return 'sil-g0';
  if (d <= 3) return 'sil-g1';
  if (d <= 6) return 'sil-g2';
  return 'sil-g3';
}

/** El gradiente de una zona. El pelo y lo que no rastreamos tienen el suyo. */
function gradienteDe(z, days) {
  if (z.cat === 'pelo') return 'sil-gpelo';
  if (!z.cat) return 'sil-gne';
  return tono(days[z.cat]);
}

/** Volumen en kg, corto: 12.4k en vez de 12380. */
function kilos(v) {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)}k`;
  return String(v);
}

function Cara({ cara, days, etiqueta, sel, onPick }) {
  // Los parches (clavicular sobre pecho, vasto interno sobre cuádriceps) los
  // dibuja MuscleMap ENCIMA del músculo base para resaltar una porción; acá
  // no se pintan porque su contorno deja manchas con forma de gota sobre el
  // músculo entero.
  const zonas = cara.zonas.filter(z => !z.parche);

  return (
    <Svg viewBox={cara.viewBox} width="100%" height="100%" accessibilityLabel={`Músculos: ${etiqueta}`}>
      {/* Defs DEBE vivir dentro de este mismo <Svg>: react-native-svg registra
          gradientes por instancia de SvgView (no globalmente como el DOM), así
          que un <Defs> en un <Svg> separado es invisible para los <Path> de
          acá. */}
      <Defs>
        <LinearGradient id="sil-g0" x1="12%" y1="0%" x2="88%" y2="100%">
          <Stop offset="0%" stopColor="#B9F8FF" /><Stop offset="45%" stopColor="#22D3EE" /><Stop offset="100%" stopColor="#0A6F88" />
        </LinearGradient>
        <LinearGradient id="sil-g1" x1="12%" y1="0%" x2="88%" y2="100%">
          <Stop offset="0%" stopColor="#A9CEFF" /><Stop offset="45%" stopColor="#2E7DFF" /><Stop offset="100%" stopColor="#12315F" />
        </LinearGradient>
        <LinearGradient id="sil-g2" x1="12%" y1="0%" x2="88%" y2="100%">
          <Stop offset="0%" stopColor="#5B7FB5" /><Stop offset="45%" stopColor="#2C4C86" /><Stop offset="100%" stopColor="#101E38" />
        </LinearGradient>
        <LinearGradient id="sil-g3" x1="12%" y1="0%" x2="88%" y2="100%">
          <Stop offset="0%" stopColor="#F6C98B" /><Stop offset="45%" stopColor="#E39C43" /><Stop offset="100%" stopColor="#6B3F10" />
        </LinearGradient>
        <LinearGradient id="sil-gn" x1="12%" y1="0%" x2="88%" y2="100%">
          <Stop offset="0%" stopColor="#39445C" /><Stop offset="45%" stopColor="#232C42" /><Stop offset="100%" stopColor="#131A2B" />
        </LinearGradient>
        <LinearGradient id="sil-gne" x1="12%" y1="0%" x2="88%" y2="100%">
          <Stop offset="0%" stopColor="#3A4763" /><Stop offset="45%" stopColor="#26304A" /><Stop offset="100%" stopColor="#151D30" />
        </LinearGradient>
        <LinearGradient id="sil-gpelo" x1="15%" y1="0%" x2="85%" y2="100%">
          <Stop offset="0%" stopColor="#8A6A4A" /><Stop offset="45%" stopColor="#5C4430" /><Stop offset="100%" stopColor="#33241A" />
        </LinearGradient>
        <LinearGradient id="sil-luz" gradientUnits="userSpaceOnUse" x1="120" y1="120" x2="620" y2="1300">
          <Stop offset="0%" stopColor="rgba(255,255,255,.28)" />
          <Stop offset="38%" stopColor="rgba(255,255,255,.05)" />
          <Stop offset="100%" stopColor="rgba(0,0,0,.28)" />
        </LinearGradient>
      </Defs>

      {/* 1. masa: los mismos trazos, oscuros, para que los huecos entre
          músculos lean como surcos de un cuerpo y no como agujeros. */}
      <G>
        {zonas.map((z, i) => z.d.map((d, j) => (
          <Path key={`masa-${i}-${j}`} d={d} fill="#101B2F" stroke="#101B2F" strokeWidth={5} strokeLinejoin="round" />
        )))}
      </G>

      {/* 2. músculo: cada grupo con el degradado de su estado. */}
      {zonas.map((z, i) => {
        const grad = gradienteDe(z, days);
        const dibujos = z.d.map((d, j) => (
          <Path
            key={j}
            d={d}
            fill={`url(#${grad})`}
            stroke={sel === z.cat ? '#2E7DFF' : 'rgba(2,5,12,.5)'}
            strokeWidth={sel === z.cat ? 4 : 1.4}
            strokeLinejoin="round"
          />
        ));
        if (!z.cat || z.cat === 'pelo' || !onPick) {
          return <G key={i}>{dibujos}</G>;
        }
        return (
          <G
            key={i}
            onPress={() => onPick(z.cat)}
            accessibilityRole="button"
            accessibilityLabel={`${z.cat}, ${diasTexto(days[z.cat])}. Ver estadísticas.`}
          >
            {dibujos}
          </G>
        );
      })}

      {/* 3. luz: una sola fuente arriba a la izquierda sobre TODO el cuerpo.
          La web la mezcla con mix-blend-mode:overlay (no existe en
          react-native-svg); acá se aproxima con opacidad baja, que sobre
          fondo oscuro da un resultado visualmente cercano sin depender de
          blend modes que el motor no soporta. */}
      <G opacity={0.5}>
        {zonas.map((z, i) => z.d.map((d, j) => (
          <Path key={`luz-${i}-${j}`} d={d} fill="url(#sil-luz)" stroke="none" />
        )))}
      </G>
    </Svg>
  );
}

export default function Silhouette({ days = {} }) {
  const [atras, setAtras] = useState(false);
  const [sel, setSel] = useState(null); // cat elegido, o null

  // `bodySex` es el ajuste explícito de Ajustes; si nunca se tocó, hereda el
  // sexo del perfil (mismo criterio que la web).
  const { frente, espalda } = cuerpo(S.cfg.bodySex || S.cfg.profile?.sex);
  const cara = atras ? espalda : frente;

  const tocar = cat => {
    vibrate(8);
    setSel(cat);
  };
  const cerrar = () => setSel(null);
  const girar = () => { vibrate(8); setAtras(a => !a); };

  const stats = sel ? groupStats(sel) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.caja}>
        <Cara cara={cara} days={days} etiqueta={atras ? 'Espalda' : 'Frente'} sel={sel} onPick={tocar} />
      </View>

      <Pressable style={styles.girar} onPress={girar}>
        <Text style={styles.girarTexto}>{atras ? '↻ Ver de frente' : '↻ Ver de atrás'}</Text>
      </Pressable>

      <Modal visible={!!sel} transparent animationType="fade" onRequestClose={cerrar}>
        <Pressable style={styles.tapa} onPress={cerrar}>
          <Pressable style={styles.pop} onPress={() => {}}>
            {stats && <MusclePop stats={stats} onClose={cerrar} />}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** El cuadro de stats del grupo elegido, dentro del Modal. */
function MusclePop({ stats, onClose }) {
  const { cat, dias, sets, sesiones, porSemana, volumen, mejor, top, fibras, ventana } = stats;
  const nunca = dias === null;

  return (
    <View>
      <View style={styles.popHead}>
        <Text style={styles.popNombre}>{cat}</Text>
        <Text style={styles.popCuando}>{diasTexto(dias)}</Text>
      </View>

      {sets === 0 ? (
        <Text style={styles.popVacio}>
          {nunca
            ? 'Todavía no registraste nada de este grupo.'
            : `Sin series en los últimos ${ventana} días — la última vez fue ${diasTexto(dias)}.`}
        </Text>
      ) : (
        <>
          <View style={styles.popNums}>
            <View style={styles.popNum}><Text style={styles.popNumB}>{sets}</Text><Text style={styles.popNumS}>series</Text></View>
            <View style={styles.popNum}><Text style={styles.popNumB}>{sesiones}</Text><Text style={styles.popNumS}>sesiones</Text></View>
            <View style={styles.popNum}><Text style={styles.popNumB}>{porSemana}</Text><Text style={styles.popNumS}>por sem.</Text></View>
          </View>

          {fibras ? (
            fibras.map(f => (
              <View key={f.fibra} style={styles.popFibra}>
                <Text style={styles.popFibraNombre}>{f.fibra}</Text>
                {f.ejercicios.map(e => (
                  <View key={e.name} style={styles.popRow}>
                    <Text style={styles.popRowNombre} numberOfLines={1}>{e.name}</Text>
                    <Text style={styles.popRowN}>{e.sets}</Text>
                  </View>
                ))}
              </View>
            ))
          ) : top.length > 0 && (
            <View>
              {top.map(t => (
                <View key={t.name} style={styles.popRow}>
                  <Text style={styles.popRowNombre} numberOfLines={1}>{t.name}</Text>
                  <Text style={styles.popRowN}>{t.sets}</Text>
                </View>
              ))}
            </View>
          )}

          {mejor && (
            <Text style={styles.popMejor}>Mejor: {mejor.name} — {mejor.w}×{mejor.r}</Text>
          )}
          <Text style={styles.popVolumen}>{kilos(volumen)} kg movidos en {ventana} días</Text>
        </>
      )}

      <Pressable style={styles.popCerrar} onPress={onClose}>
        <Text style={styles.popCerrarTexto}>Cerrar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  caja: { width: '100%', aspectRatio: 638 / 1260, maxHeight: 420 },
  girar: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#0e1626' },
  girarTexto: { color: '#8a93a6', fontSize: 13, fontWeight: '600' },

  tapa: { flex: 1, backgroundColor: 'rgba(2,5,12,.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pop: { width: '100%', maxWidth: 340, backgroundColor: '#0e1626', borderRadius: 16, padding: 16 },
  popHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  popNombre: { color: '#fff', fontSize: 18, fontWeight: '700' },
  popCuando: { color: '#8a93a6', fontSize: 13, fontWeight: '600' },
  popVacio: { color: '#8a93a6', fontSize: 13, lineHeight: 19 },

  popNums: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  popNum: { alignItems: 'center' },
  popNumB: { color: '#fff', fontSize: 20, fontWeight: '700' },
  popNumS: { color: '#8a93a6', fontSize: 11, marginTop: 2 },

  popFibra: { marginBottom: 10 },
  popFibraNombre: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  popRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  popRowNombre: { color: '#8a93a6', fontSize: 13, flexShrink: 1, marginRight: 8 },
  popRowN: { color: '#fff', fontSize: 13, fontWeight: '600' },

  popMejor: { color: '#8a93a6', fontSize: 12, marginTop: 8 },
  popVolumen: { color: '#8a93a6', fontSize: 12, marginTop: 4 },

  popCerrar: { marginTop: 14, alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12 },
  popCerrarTexto: { color: '#2E7DFF', fontSize: 13, fontWeight: '700' },
});
