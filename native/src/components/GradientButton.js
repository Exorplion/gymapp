// Botón CTA primario con el gradiente cian-azul del original
// (web/src/styles.css: `--grad2`, usado en `.btn`/`.ini-cta`).
//
// El plan de esta etapa asumía `expo-linear-gradient` "ya instalado" — no lo
// está (no aparece en package.json ni node_modules). En vez de agregar una
// dependencia nueva sin poder probarla en dispositivo, se pinta el gradiente
// con `react-native-svg`, que ya es dependencia del proyecto y ya se usa para
// gradientes en Silhouette.js/BodyMini.js/RestTimer.js — mismo patrón,
// aplicado acá como fondo de un botón en vez de relleno de un trazo/figura.
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { GRAD_PRIMARY } from '../theme';

/**
 * @param {{ style?: object, radius?: number, gradId?: string }} props
 * El resto de props (onPress, disabled, accessibilityLabel, children...) se
 * pasan directo al Pressable — se usa igual que un Pressable normal, sólo
 * que pinta el gradiente en vez de esperar un backgroundColor sólido.
 */
export default function GradientButton({ style, radius = 14, gradId = 'ctaGrad', children, ...pressableProps }) {
  return (
    <Pressable style={[styles.base, style]} {...pressableProps}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradId} x1={GRAD_PRIMARY.x1} y1={GRAD_PRIMARY.y1} x2={GRAD_PRIMARY.x2} y2={GRAD_PRIMARY.y2}>
            {GRAD_PRIMARY.stops.map(s => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={radius} fill={`url(#${gradId})`} />
      </Svg>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
