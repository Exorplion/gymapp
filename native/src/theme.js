// Tokens de diseño transcritos de web/src/styles.css (:root, líneas 4-45).
// NO inventar valores nuevos aquí — cualquier cambio de paleta/escala se
// hace primero en el CSS original y se vuelve a transcribir.

export const C = {
  bg: '#04070F',
  bg2: '#0A0F1A',
  card: '#0C1322',
  card2: '#111B30',
  line: 'rgba(102,145,255,.10)',
  line2: 'rgba(102,145,255,.20)',
  txt: '#EEF4FF',
  mut: '#93A4C8',
  mut2: '#64749A',
  accent: '#7FD1FF',
  deep: '#2540E8',
  blue: '#2E7DFF',
  blue2: '#5EA2FF',
  blue3: '#8FC2FF',
  cyan: '#22D3EE',
  onGrad: '#03121F',
  ok: '#2EE6A8',
  warn: '#FFB454',
  red: '#FF5D73',
};

// Stops del gradiente de los CTAs primarios, transcritos de
// web/src/styles.css:23 — `--grad2:linear-gradient(112deg,#4FA8FF 0%,#22D3EE 58%,#7FD1FF 100%)`.
// No hay expo-linear-gradient instalado en este proyecto (a pesar de lo que
// dice el plan) — se pinta con react-native-svg (ya usado en Silhouette.js/
// BodyMini.js/RestTimer.js para otros gradientes), ver GradientButton.js.
export const GRAD_PRIMARY = {
  stops: [
    { offset: '0%', color: '#4FA8FF' },
    { offset: '58%', color: '#22D3EE' },
    { offset: '100%', color: '#7FD1FF' },
  ],
  // Aproximación de la dirección 112deg del CSS en coordenadas x1/y1/x2/y2
  // de objectBoundingBox (derecha, levemente hacia abajo).
  x1: '0%', y1: '0%', x2: '100%', y2: '37%',
};

// escala de espaciado: seis pasos, sin márgenes sueltos.
export const S = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
};

// escala tipográfica: micro..hero (reemplaza la deriva de 18 tamaños distintos).
export const T = {
  micro: 11,
  sm: 13,
  body: 15,
  lg: 18,
  xl: 22,
  display: 34,
  hero: 44,
};

export const R = {
  r: 18,
  rLg: 26,
  pill: 999,
};

export default { C, S, T, R, GRAD_PRIMARY };
