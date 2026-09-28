// El acento se deriva de UN matiz (lib/theme.js). Lo que estos tests protegen
// es la promesa de la pieza 4 del rediseño de color: elijas el color que
// elijas, (1) todo se sigue leyendo en AA, y (2) el acento nunca se confunde
// con verde/rojo/ámbar, que son los colores de estado.
//
// La barrida cada 10° es la parte importante: los presets los elegimos
// nosotros y es fácil que pasen; el "personalizado" puede ser cualquier cosa.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  oklchAHex, hexAOklch, contrastRatio,
  PRESETS, ACENTO_DEFECTO, CROMA_PROPIO, ESTADOS, BASE, HERO_TINTE,
  distanciaMatiz, alejarDeEstados, acentoDe, variablesDe, acentoGuardado,
} from '../theme.js';

const MARGEN = 20;
const canales = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
// Composición alfa de un color sobre un fondo opaco: es lo que el ojo ve de
// una superficie translúcida (el blur no cambia nada sobre un fondo casi liso).
const componer = (rgb, a, fondo) => '#' + [0, 1, 2]
  .map(i => Math.round(rgb[i] * a + canales(fondo)[i] * (1 - a)).toString(16).padStart(2, '0'))
  .join('');
const glass = componer(BASE.glassRgb, BASE.glassAlfa, BASE.bg);

const barrida = [
  ...PRESETS.map(p => [p.nombre, { id: p.id }]),
  ...Array.from({ length: 36 }, (_, i) => [`propio ${i * 10}°`, { id: 'propio', h: i * 10 }]),
];

describe('oklchAHex / hexAOklch', () => {
  it('ida y vuelta conserva el matiz', () => {
    for (const h of [30, 120, 230, 300]) {
      const { hex } = oklchAHex(0.8, 0.08, h);
      expect(distanciaMatiz(hexAOklch(hex).h, h)).toBeLessThan(1.5);
      expect(hexAOklch(hex).L).toBeCloseTo(0.8, 2);
    }
  });

  it('siempre devuelve un hex válido dentro del gamut', () => {
    for (let h = 0; h < 360; h += 15) {
      const { hex } = oklchAHex(0.8, 0.4, h);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('recorta el croma cuando el color no entra en sRGB', () => {
    // Un azul a luminosidad .80 no existe con croma .3 en una pantalla sRGB.
    const { c } = oklchAHex(0.8, 0.3, 262);
    expect(c).toBeLessThan(0.3);
    expect(c).toBeGreaterThan(0.05);
  });

  it('croma 0 da un gris exacto', () => {
    const [r, g, b] = canales(oklchAHex(0.62, 0, 123).hex);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('con texto que no es un color, null', () => {
    expect(hexAOklch('no')).toBe(null);
    expect(hexAOklch(undefined)).toBe(null);
  });
});

describe('contrastRatio', () => {
  it('blanco contra negro es 21:1 y no importa el orden', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#101113', '#f3f4f6')).toBeCloseTo(contrastRatio('#f3f4f6', '#101113'), 6);
  });
});

describe('presets', () => {
  it('son Hielo, Cobalto, Violeta, Fucsia y Monocromo — sin Naranja ni Lima', () => {
    expect(PRESETS.map(p => p.id)).toEqual(['hielo', 'cobalto', 'violeta', 'fucsia', 'mono']);
  });

  it('Hielo es el de fábrica', () => {
    expect(ACENTO_DEFECTO).toEqual({ id: 'hielo' });
  });

  it('Monocromo no tiene croma: el acento es gris', () => {
    const v = variablesDe(acentoDe({ id: 'mono' }));
    const [r, g, b] = canales(v['--accent']);
    expect(r === g && g === b).toBe(true);
  });

  it('un id desconocido cae al de fábrica, no a una paleta rota', () => {
    expect(acentoDe({ id: 'naranja' })).toEqual(acentoDe(ACENTO_DEFECTO));
    expect(acentoDe(undefined)).toEqual(acentoDe(ACENTO_DEFECTO));
  });

  it('el personalizado usa el croma fijo, no el del color elegido', () => {
    expect(acentoDe({ id: 'propio', h: 200 }).c).toBe(CROMA_PROPIO);
  });
});

describe('contraste AA para cada preset y una barrida de matices cada 10°', () => {
  it.each(barrida)('%s', (_nombre, sel) => {
    const v = variablesDe(acentoDe(sel));
    // La esquina tintada de las tarjetas hero es el peor fondo de la app.
    const hero = componer(canales(v['--accent-strong']), HERO_TINTE, glass);
    for (const fondo of [glass, BASE.surface, BASE.surface2, hero]) {
      for (const texto of [BASE.text, BASE.text2, BASE.text3, v['--accent']]) {
        expect(contrastRatio(texto, fondo), `${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // El texto de los CTA va sobre el degradado: tiene que leerse en los dos extremos.
    expect(contrastRatio(v['--on-accent'], v['--accent'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(v['--on-accent'], v['--accent-strong'])).toBeGreaterThanOrEqual(4.5);
    // accent-strong se usa en rellenos e íconos: AA de no-texto.
    expect(contrastRatio(v['--accent-strong'], glass)).toBeGreaterThanOrEqual(3);
  });
});

describe('distancia entre el acento y los colores de estado', () => {
  const matizEstado = Object.fromEntries(Object.entries(ESTADOS).map(([k, hex]) => [k, hexAOklch(hex).h]));

  it('ningún matiz personalizado queda a menos de 20° de verde, rojo o ámbar', () => {
    for (let h = 0; h < 360; h++) {
      const v = variablesDe(acentoDe({ id: 'propio', h }));
      // Se mide el color que de verdad se pinta, después del recorte de gamut.
      const real = hexAOklch(v['--accent']).h;
      for (const [estado, he] of Object.entries(matizEstado)) {
        expect(distanciaMatiz(real, he), `matiz ${h} → ${real.toFixed(1)} vs ${estado}`).toBeGreaterThanOrEqual(MARGEN - 1);
      }
    }
  });

  it('los presets con color también', () => {
    for (const p of PRESETS.filter(p => p.c > 0)) {
      const real = hexAOklch(variablesDe(acentoDe({ id: p.id }))['--accent']).h;
      for (const he of Object.values(matizEstado)) expect(distanciaMatiz(real, he)).toBeGreaterThanOrEqual(MARGEN);
    }
  });

  it('alejarDeEstados deja quieto un matiz que ya está lejos', () => {
    expect(alejarDeEstados(225)).toBe(225);
    expect(alejarDeEstados(295)).toBe(295);
  });

  it('alejarDeEstados corre el rojo fuera de su zona', () => {
    const h = alejarDeEstados(matizEstado.danger);
    expect(distanciaMatiz(h, matizEstado.danger)).toBeGreaterThanOrEqual(MARGEN);
  });

  it('distanciaMatiz es circular', () => {
    expect(distanciaMatiz(350, 10)).toBe(20);
    expect(distanciaMatiz(10, 350)).toBe(20);
    expect(distanciaMatiz(0, 180)).toBe(180);
  });
});

describe('acentoGuardado: migración del themeColor viejo', () => {
  it('sin nada guardado → Hielo, sin migrar', () => {
    expect(acentoGuardado({})).toEqual({ sel: ACENTO_DEFECTO, migrado: false });
    expect(acentoGuardado(undefined)).toEqual({ sel: ACENTO_DEFECTO, migrado: false });
  });

  it('el celeste que antes era "de fábrica" (#38BDF8) → Hielo', () => {
    expect(acentoGuardado({ themeColor: '#38BDF8' })).toEqual({ sel: { id: 'hielo' }, migrado: true });
  });

  it('un violeta → Violeta', () => {
    expect(acentoGuardado({ themeColor: '#8B5CF6' }).sel).toEqual({ id: 'violeta' });
  });

  it('negro o gris (sin matiz) → el de fábrica', () => {
    expect(acentoGuardado({ themeColor: '#000000' })).toEqual({ sel: ACENTO_DEFECTO, migrado: true });
    expect(acentoGuardado({ themeColor: '#808080' }).sel).toEqual(ACENTO_DEFECTO);
  });

  it('un rojo lejos de todo preset → personalizado, corrido fuera del rojo', () => {
    const { sel } = acentoGuardado({ themeColor: '#EF4444' });
    expect(sel.id).toBe('propio');
    expect(distanciaMatiz(sel.h, hexAOklch(ESTADOS.danger).h)).toBeGreaterThanOrEqual(MARGEN);
  });

  it('si ya hay acento elegido, gana y no se migra nada', () => {
    expect(acentoGuardado({ acento: { id: 'fucsia' }, themeColor: '#8B5CF6' })).toEqual({ sel: { id: 'fucsia' }, migrado: false });
  });

  it('un acento guardado roto cae al de fábrica', () => {
    expect(acentoGuardado({ acento: { id: 'propio', h: 'x' } }).sel).toEqual(ACENTO_DEFECTO);
  });
});

describe('styles.css y theme.js dicen lo mismo', () => {
  // Los valores por defecto del CSS son los que se ven antes de que corra el
  // JS (y en los tests de componentes). Si se separan, el primer cuadro sale
  // con un color y el siguiente con otro.
  const css = readFileSync(join(import.meta.dirname, '../../styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const root = css.slice(css.indexOf(':root{'), css.indexOf('}', css.indexOf(':root{')));
  const valor = nombre => {
    const m = root.match(new RegExp(`${nombre}\\s*:\\s*([^;]+);`));
    return m ? m[1].trim().toLowerCase() : null;
  };

  it('las variables del acento de fábrica', () => {
    for (const [nombre, v] of Object.entries(variablesDe(acentoDe(ACENTO_DEFECTO)))) {
      expect(valor(nombre), nombre).toBe(String(v).toLowerCase());
    }
  });

  it('la base y los estados', () => {
    expect(valor('--bg')).toBe(BASE.bg);
    expect(valor('--surface')).toBe(BASE.surface);
    expect(valor('--surface-2')).toBe(BASE.surface2);
    expect(valor('--text')).toBe(BASE.text);
    expect(valor('--text-2')).toBe(BASE.text2);
    expect(valor('--text-3')).toBe(BASE.text3);
    expect(valor('--glass-rgb')).toBe(BASE.glassRgb.join(','));
    expect(valor('--ok')).toBe(ESTADOS.ok.toLowerCase());
    expect(valor('--danger')).toBe(ESTADOS.danger.toLowerCase());
    expect(valor('--warn')).toBe(ESTADOS.warn.toLowerCase());
    expect(valor('--flame')).toBe(ESTADOS.flame.toLowerCase());
  });

  it('theme-color, manifest y favicon son de la base grafito, no los casi-negros azulados de antes', () => {
    const web = join(import.meta.dirname, '../../..');
    const html = readFileSync(join(web, 'index.html'), 'utf8');
    const vite = readFileSync(join(web, 'vite.config.js'), 'utf8');
    const favicon = readFileSync(join(web, 'public/favicon.svg'), 'utf8');
    expect(html).toContain(`<meta name="theme-color" content="${BASE.bg}" />`);
    expect(vite).toContain(`background_color: '${BASE.bg}'`);
    expect(vite).toContain(`theme_color: '${BASE.bg}'`);
    // El rayo violeta de Vite ya no: es la mancuerna de FIERRO.
    expect(favicon).not.toMatch(/863bff/i);
    expect(favicon).toMatch(/FIERRO/);
  });
});
