// Puerto de web/src/components/RestTimer.jsx. El estado vive en T (rest.js,
// mutable fuera de React) y bump() avisa a React para repintar — mismo canal
// que S/useStore, así que este componente no necesita una suscripción
// aparte (ver docblock de rest.js).
//
// Ambos bloques (pill minimizada y overlay de pantalla completa) viven acá,
// son mutuamente excluyentes según T.state, igual que el original.
//
// Este componente se monta SIEMPRE en App.js (sibling de Toast/SheetHost) —
// como es 'position: absolute' sobre toda la pantalla, cuando T.state es
// 'hidden' no renderiza nada visible (ambos bloques quedan ocultos).
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { T, minimizeRest, expandRest, stopRest, shiftRest, REST_CIRC } from '../lib/rest.js';
import { useStore } from '../lib/state.js';
import { fmtMMSS } from '../lib/format.js';
import { C } from '../theme';

export default function RestTimer() {
  useStore(); // se suscribe a bump(); T se lee directo (T.leftSec/T.pct/T.state) igual que S

  if (T.state === 'hidden') return null;

  const sonandoAhora = T.state === 'ringing';
  const timeStr = fmtMMSS(T.leftSec);
  const pctClamped = Math.max(0, Math.min(1, T.pct));
  const fillPct = pctClamped * 100;
  // Sonando el anillo se cierra entero: pasa de ser cuenta regresiva a ser el
  // aviso.
  const dashOffset = sonandoAhora ? 0 : REST_CIRC * (1 - pctClamped);

  function addTime() { shiftRest(30); }
  function subTime() { shiftRest(-30); }
  function skip() { stopRest(); }
  function minimize() { minimizeRest(); }

  // A diferencia del original web, acá no hace falta stopPropagation()
  // ni un chequeo target===currentTarget: en RN, un Pressable dentro de
  // otro Pressable ya reclama el toque para sí mismo (el responder más
  // profundo que matchea gana el gesto) y NO lo deja burbujear al
  // Pressable contenedor. Verificado contra el modelo de gesture
  // responders de RN — los botones internos (−30s/+30s/Saltar) disparan
  // sólo su propio onPress, nunca también el onPress del contenedor de la
  // pill. Por eso alcanza con onPress simples, sin ningún guard extra.

  return (
    <>
      {T.state === 'minimized' && (
        <Pressable
          style={styles.pill}
          onPress={expandRest}
          accessibilityRole="button"
          accessibilityLabel={`Descanso, ${timeStr} restantes. Tocar para expandir.`}
        >
          <View style={styles.pillTop}>
            <View>
              <Text style={styles.pillLbl}>Descanso</Text>
              <Text style={[styles.pillTime, { fontVariant: ['tabular-nums'] }]}>{timeStr}</Text>
            </View>
            <View style={styles.pillBtns}>
              <Pressable style={styles.pillBtn} onPress={subTime}>
                <Text style={styles.pillBtnText}>−30s</Text>
              </Pressable>
              <Pressable style={styles.pillBtn} onPress={addTime}>
                <Text style={styles.pillBtnText}>+30s</Text>
              </Pressable>
              <Pressable style={styles.pillBtn} onPress={skip}>
                <Text style={styles.pillBtnText}>Saltar</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.pillTrack}>
            <View style={[styles.pillFill, { width: `${fillPct}%` }]} />
          </View>
        </Pressable>
      )}

      {(T.state === 'fullscreen' || sonandoAhora) && (
        <View style={styles.overlay}>
          <View style={styles.inner}>
            <Text style={[styles.lbl, sonandoAhora && styles.lblRinging]}>{sonandoAhora ? '¡Dale!' : 'Descanso'}</Text>
            <View style={styles.ringWrap}>
              <Svg width={200} height={200} viewBox="0 0 200 200">
                {/* Defs vive DENTRO de este mismo <Svg> — el <Circle> de abajo
                    lo referencia con stroke="url(#restGrad)". Un <Defs> en un
                    <Svg> separado sería invisible acá (ruling 7 del plan). */}
                <Defs>
                  <LinearGradient id="restGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor={C.blue2} />
                    <Stop offset="100%" stopColor={C.cyan} />
                  </LinearGradient>
                </Defs>
                <Circle cx={100} cy={100} r={88} stroke={C.line} strokeWidth={12} fill="none" />
                <Circle
                  cx={100} cy={100} r={88}
                  stroke={sonandoAhora ? C.warn : 'url(#restGrad)'} strokeWidth={12} fill="none"
                  strokeDasharray={REST_CIRC}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                />
              </Svg>
              <Text style={[styles.ringTime, sonandoAhora && styles.ringTimeRinging, { fontVariant: ['tabular-nums'] }]}>{sonandoAhora ? '¡YA!' : timeStr}</Text>
            </View>

            {sonandoAhora ? (
              // Un solo botón, ancho y sin vecinos: está sonando y lo único
              // que querés es callarla. Poner "+30s" al lado sería
              // invitarte a errarle.
              <Pressable style={styles.pararBtn} onPress={skip}>
                <Text style={styles.pararBtnText}>PARAR</Text>
              </Pressable>
            ) : (
              <View style={styles.fsBtns}>
                <Pressable style={styles.fsBtnGhost} onPress={subTime}>
                  <Text style={styles.fsBtnGhostText}>−30s</Text>
                </Pressable>
                <Pressable style={styles.fsBtnGhost} onPress={addTime}>
                  <Text style={styles.fsBtnGhostText}>+30s</Text>
                </Pressable>
                <Pressable style={styles.fsBtnDim} onPress={skip}>
                  <Text style={styles.fsBtnDimText}>Saltar</Text>
                </Pressable>
              </View>
            )}

            {!sonandoAhora && (
              <Pressable style={styles.minBtn} onPress={minimize} accessibilityLabel="Minimizar">
                <Text style={styles.minBtnText}>⌄</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Pill minimizada — franja horizontal fija abajo, sobre el tab bar.
  pill: {
    position: 'absolute',
    left: 12, right: 12, bottom: 90,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    overflow: 'hidden',
  },
  pillTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pillLbl: { color: C.mut, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', fontFamily: 'Barlow_600SemiBold' },
  pillTime: { color: C.txt, fontSize: 20, fontWeight: '800', marginTop: 2, fontFamily: 'BarlowCondensed_700Bold_Italic' },
  pillBtns: { flexDirection: 'row', gap: 8 },
  pillBtn: { backgroundColor: C.card2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  pillBtnText: { color: C.txt, fontSize: 13, fontWeight: '700' },
  pillTrack: { height: 4, borderRadius: 2, backgroundColor: C.bg2, marginTop: 10, overflow: 'hidden' },
  pillFill: { height: '100%', backgroundColor: C.blue, borderRadius: 2 },

  // Overlay de pantalla completa.
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5,7,13,.96)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  inner: { alignItems: 'center', paddingHorizontal: 24 },
  lbl: { color: C.mut, fontSize: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  lblRinging: { color: C.warn },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringTime: { position: 'absolute', color: C.txt, fontSize: 40, fontWeight: '800', fontFamily: 'BarlowCondensed_700Bold_Italic' },
  ringTimeRinging: { color: C.warn },

  fsBtns: { flexDirection: 'row', gap: 10, marginTop: 26 },
  fsBtnGhost: { backgroundColor: C.card2, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  fsBtnGhostText: { color: C.txt, fontSize: 14, fontWeight: '700' },
  fsBtnDim: { backgroundColor: C.card2, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  fsBtnDimText: { color: C.mut, fontSize: 14, fontWeight: '700' },

  // Sin lib de gradiente en RN acá: se aproxima el gradiente ámbar del
  // original (#FFB454 -> #E07C1A) con el tono medio del token C.warn como
  // color sólido, y texto oscuro (#2A1603) igual que el original, para
  // mantener buen contraste sobre el ámbar.
  pararBtn: { backgroundColor: C.warn, borderRadius: 18, paddingHorizontal: 48, paddingVertical: 18, marginTop: 26 },
  pararBtnText: { color: '#2A1603', fontSize: 20, fontWeight: '800', letterSpacing: 1 },

  minBtn: { marginTop: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  minBtnText: { color: C.txt, fontSize: 18, fontWeight: '700' },
});
