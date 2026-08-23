// Superficie de card con un gradiente pintado encima del fondo, en vez de
// un backgroundColor sólido. Mismo patrón que GradientButton.js (react-native-svg,
// no expo-linear-gradient — no instalado en este proyecto), pero pensado para
// un contenedor no-presionable (View) en vez de un botón.
//
// Uso actual: heroCard de Rutina.js, que en el original web
// (web/src/styles.css:1372-1374) pinta
// `linear-gradient(158deg,rgba(108,92,255,.24),rgba(255,255,255,.03) 60%),var(--card)`
// — dos capas: el gradiente violeta translúcido encima, `--card` debajo.
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

/**
 * @param {{ style?: object, radius?: number, colors: {offset:string,color:string,opacity?:number}[], x1?:string, y1?:string, x2?:string, y2?:string, gradId?: string }} props
 */
export default function GradientCard({ style, radius = 18, colors, x1 = '0%', y1 = '0%', x2 = '38%', y2 = '100%', gradId = 'cardGrad', children }) {
  return (
    <View style={[styles.base, style]}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradId} x1={x1} y1={y1} x2={x2} y2={y2}>
            {colors.map(s => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={radius} fill={`url(#${gradId})`} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
