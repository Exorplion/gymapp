// Tabla de alimentos comunes, orientada a lo que se come en Perú.
//
// Macros por 100 g. `u` es el peso en gramos de una unidad natural del
// alimento, para que "dos huevos" o "un plátano" funcionen sin que tengas que
// pesar nada. Los platos preparados llevan `u` = porción típica.
//
// Son valores de tabla, es decir promedios: tu arroz con pollo no pesa lo
// mismo que el de al lado, y una pechuga varía según el corte. Para llevar una
// tendencia sirve de sobra; si necesitás precisión en un alimento puntual,
// registralo una vez con sus macros reales y la app usa los tuyos desde
// entonces (ver foodvoice.js — tus alimentos siempre ganan sobre esta tabla).
export const FOOD_TABLE = [
  // ── Proteínas ──────────────────────────────────────────────────────────
  { n: 'pollo',            a: ['pechuga', 'pechuga de pollo', 'pollo a la plancha'], kcal: 165, p: 31,   c: 0,    f: 3.6, u: 150 },
  { n: 'pollo a la brasa', a: ['brasa', 'cuarto de pollo'],                          kcal: 220, p: 26,   c: 2,    f: 12,  u: 250 },
  { n: 'huevo',            a: ['huevos', 'huevo entero'],                            kcal: 143, p: 12.6, c: 0.7,  f: 9.5, u: 55 },
  { n: 'clara de huevo',   a: ['claras', 'clara'],                                   kcal: 52,  p: 11,   c: 0.7,  f: 0.2, u: 33 },
  { n: 'atún',             a: ['atun', 'lata de atún', 'atún en agua'],               kcal: 116, p: 26,   c: 0,    f: 1,   u: 120 },
  { n: 'pescado',          a: ['bonito', 'merluza', 'tilapia', 'trucha'],            kcal: 128, p: 23,   c: 0,    f: 3.5, u: 150 },
  { n: 'carne de res',     a: ['res', 'bistec', 'lomo', 'carne'],                    kcal: 217, p: 26,   c: 0,    f: 12,  u: 150 },
  { n: 'cerdo',            a: ['chuleta', 'carne de cerdo'],                         kcal: 242, p: 27,   c: 0,    f: 14,  u: 150 },
  { n: 'pavo',             a: ['pechuga de pavo', 'pavita'],                          kcal: 135, p: 29,   c: 0,    f: 1.7, u: 150 },
  { n: 'whey',             a: ['proteína', 'proteina', 'batido de proteína', 'scoop'], kcal: 400, p: 80,  c: 8,    f: 5,   u: 30 },
  { n: 'hígado',           a: ['higado', 'hígado de pollo'],                          kcal: 165, p: 24,   c: 3,    f: 6,   u: 120 },

  // ── Carbohidratos ──────────────────────────────────────────────────────
  { n: 'arroz',            a: ['arroz blanco', 'arroz cocido'],                      kcal: 130, p: 2.7,  c: 28,   f: 0.3, u: 200 },
  { n: 'arroz integral',   a: ['integral'],                                          kcal: 123, p: 2.7,  c: 26,   f: 1,   u: 200 },
  { n: 'papa',            a: ['papas', 'papa sancochada', 'papa cocida'],             kcal: 87,  p: 2,    c: 20,   f: 0.1, u: 150 },
  { n: 'camote',           a: ['batata'],                                             kcal: 90,  p: 2,    c: 21,   f: 0.1, u: 150 },
  { n: 'yuca',             a: ['mandioca'],                                           kcal: 160, p: 1.4,  c: 38,   f: 0.3, u: 150 },
  { n: 'quinua',           a: ['quinoa'],                                             kcal: 120, p: 4.4,  c: 21,   f: 1.9, u: 180 },
  { n: 'avena',            a: ['hojuelas de avena', 'avena cocida'],                  kcal: 389, p: 17,   c: 66,   f: 7,   u: 40 },
  { n: 'pan',              a: ['pan francés', 'pan integral', 'rebanada de pan'],     kcal: 265, p: 9,    c: 49,   f: 3.2, u: 30 },
  { n: 'fideos',           a: ['pasta', 'espaguetis', 'tallarines'],                  kcal: 158, p: 5.8,  c: 31,   f: 0.9, u: 200 },
  { n: 'choclo',           a: ['maíz', 'maiz', 'elote'],                              kcal: 96,  p: 3.4,  c: 21,   f: 1.5, u: 150 },
  { n: 'lentejas',         a: ['lenteja'],                                            kcal: 116, p: 9,    c: 20,   f: 0.4, u: 200 },
  { n: 'frijoles',         a: ['frejoles', 'porotos', 'frijol'],                      kcal: 127, p: 8.7,  c: 23,   f: 0.5, u: 200 },
  { n: 'garbanzos',        a: ['garbanzo'],                                           kcal: 164, p: 8.9,  c: 27,   f: 2.6, u: 200 },

  // ── Lácteos ────────────────────────────────────────────────────────────
  { n: 'leche',            a: ['leche entera', 'vaso de leche'],                      kcal: 61,  p: 3.2,  c: 4.8,  f: 3.3, u: 240 },
  { n: 'leche descremada', a: ['leche light', 'leche sin grasa'],                     kcal: 35,  p: 3.4,  c: 5,    f: 0.1, u: 240 },
  { n: 'yogurt griego',    a: ['yogur griego', 'griego'],                             kcal: 59,  p: 10,   c: 3.6,  f: 0.4, u: 170 },
  { n: 'yogurt',           a: ['yogur'],                                              kcal: 63,  p: 3.5,  c: 7,    f: 3.3, u: 170 },
  { n: 'queso fresco',     a: ['queso'],                                              kcal: 264, p: 18,   c: 3,    f: 20,  u: 40 },

  // ── Grasas ─────────────────────────────────────────────────────────────
  { n: 'palta',            a: ['aguacate'],                                           kcal: 160, p: 2,    c: 9,    f: 15,  u: 150 },
  { n: 'aceite de oliva',  a: ['aceite'],                                             kcal: 884, p: 0,    c: 0,    f: 100, u: 14 },
  { n: 'maní',             a: ['mani', 'cacahuate'],                                  kcal: 567, p: 26,   c: 16,   f: 49,  u: 30 },
  { n: 'almendras',        a: ['almendra'],                                           kcal: 579, p: 21,   c: 22,   f: 50,  u: 30 },
  { n: 'mantequilla de maní', a: ['mantequilla de mani', 'peanut butter'],            kcal: 588, p: 25,   c: 20,   f: 50,  u: 32 },

  // ── Frutas ─────────────────────────────────────────────────────────────
  { n: 'plátano',          a: ['platano', 'banana', 'guineo'],                        kcal: 89,  p: 1.1,  c: 23,   f: 0.3, u: 120 },
  { n: 'manzana',          a: [],                                                     kcal: 52,  p: 0.3,  c: 14,   f: 0.2, u: 180 },
  { n: 'papaya',           a: [],                                                     kcal: 43,  p: 0.5,  c: 11,   f: 0.3, u: 150 },
  { n: 'piña',             a: ['pina', 'ananá'],                                      kcal: 50,  p: 0.5,  c: 13,   f: 0.1, u: 150 },
  { n: 'mango',            a: [],                                                     kcal: 60,  p: 0.8,  c: 15,   f: 0.4, u: 200 },
  { n: 'naranja',          a: [],                                                     kcal: 47,  p: 0.9,  c: 12,   f: 0.1, u: 150 },
  { n: 'fresa',            a: ['fresas', 'frutilla'],                                 kcal: 32,  p: 0.7,  c: 7.7,  f: 0.3, u: 150 },

  // ── Verduras ───────────────────────────────────────────────────────────
  { n: 'brócoli',          a: ['brocoli'],                                            kcal: 34,  p: 2.8,  c: 7,    f: 0.4, u: 100 },
  { n: 'tomate',           a: ['tomates'],                                            kcal: 18,  p: 0.9,  c: 3.9,  f: 0.2, u: 120 },
  { n: 'lechuga',          a: ['ensalada'],                                           kcal: 15,  p: 1.4,  c: 2.9,  f: 0.2, u: 80 },
  { n: 'zanahoria',        a: ['zanahorias'],                                         kcal: 41,  p: 0.9,  c: 10,   f: 0.2, u: 80 },
  { n: 'espinaca',         a: ['espinacas'],                                          kcal: 23,  p: 2.9,  c: 3.6,  f: 0.4, u: 100 },

  // ── Platos preparados (macros de la porción típica, vía `u`) ───────────
  { n: 'arroz con pollo',  a: [],                                                     kcal: 155, p: 9,    c: 20,   f: 4.5, u: 350 },
  { n: 'lomo saltado',     a: ['saltado'],                                            kcal: 145, p: 9,    c: 15,   f: 5.5, u: 400 },
  { n: 'ceviche',          a: ['cebiche'],                                            kcal: 85,  p: 13,   c: 5,    f: 1.5, u: 300 },
  { n: 'ají de gallina',   a: ['aji de gallina'],                                     kcal: 165, p: 9,    c: 13,   f: 8,   u: 350 },
  { n: 'causa',            a: ['causa limeña'],                                       kcal: 130, p: 4,    c: 18,   f: 4.5, u: 250 },
  { n: 'tallarín saltado', a: ['tallarin saltado'],                                   kcal: 150, p: 8,    c: 19,   f: 4.5, u: 400 },
  { n: 'sopa',             a: ['caldo'],                                              kcal: 40,  p: 3,    c: 4,    f: 1.2, u: 350 },
  { n: 'sándwich de pollo', a: ['sandwich de pollo', 'sanguche de pollo'],            kcal: 200, p: 14,   c: 22,   f: 6,   u: 180 },
  { n: 'hamburguesa',      a: [],                                                     kcal: 250, p: 13,   c: 21,   f: 12,  u: 220 },
  { n: 'pizza',            a: ['porción de pizza'],                                   kcal: 266, p: 11,   c: 33,   f: 10,  u: 110 },
];

/** Unidades de medida reconocidas al dictar, con su peso en gramos. */
export const UNITS = [
  { k: ['gramo', 'gramos', 'g', 'gr', 'grs'],                 g: 1 },
  { k: ['kilo', 'kilos', 'kg', 'kilogramo', 'kilogramos'],    g: 1000 },
  { k: ['taza', 'tazas'],                                     g: 200 },
  // 'plato' usa la porción propia del alimento: un plato de lomo saltado y uno
  // de arroz no pesan lo mismo, y cada entrada ya define la suya en `u`.
  { k: ['plato', 'platos'],                                   g: null },
  { k: ['porción', 'porcion', 'porciones'],                   g: null },  // usa el peso de unidad del alimento
  { k: ['cucharada', 'cucharadas'],                           g: 15 },
  { k: ['cucharadita', 'cucharaditas'],                       g: 5 },
  { k: ['vaso', 'vasos'],                                     g: 240 },
  { k: ['rebanada', 'rebanadas', 'tajada', 'tajadas'],        g: 30 },
  { k: ['scoop', 'scoops', 'medida', 'medidas'],              g: 30 },
  { k: ['filete', 'filetes'],                                 g: 150 },
  { k: ['lata', 'latas'],                                     g: 120 },
  { k: ['unidad', 'unidades'],                                g: null },
];

/** Números escritos con palabras, para "dos huevos" y "medio plátano". */
export const NUM_WORDS = {
  'medio': 0.5, 'media': 0.5, 'un': 1, 'una': 1, 'uno': 1,
  'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6,
  'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10, 'doce': 12,
};
