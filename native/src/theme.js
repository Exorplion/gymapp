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

export default { C, S, T, R };
