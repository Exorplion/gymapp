import { describe, it, expect } from 'vitest';
import { fibrasDe, esGrupo, ZONA_DE } from '../fibras.js';
import { EXCATALOG } from '../muscle.js';
import { CUERPOS } from '../bodydata.js';

/** Todos los nombres de subzona que la lámina sabe pintar. */
const SUBS = new Set();
for (const s of ['m', 'f']) for (const c of ['frente', 'espalda']) {
  CUERPOS[s][c].zonas.forEach(z => z.sub && SUBS.add(z.sub));
}

describe('fibrasDe', () => {
  // Los ejemplos que dio Enzo: el jalón carga abajo, el remo neutro arriba.
  it('distingue dorsal bajo de dorsal alto', () => {
    expect(fibrasDe('Jalón al pecho').p).toContain('Dorsal bajo');
    expect(fibrasDe('Jalón ancho').p).toContain('Dorsal bajo');
    expect(fibrasDe('Remo neutro').p).toContain('Dorsal alto');
    expect(fibrasDe('Remo espalda alta').p).toContain('Dorsal alto');
  });

  it('distingue clavicular de costal en el pecho', () => {
    expect(fibrasDe('Press inclinado').p).toEqual(['Clavicular']);
    expect(fibrasDe('Press declinado').p).toEqual(['Costal']);
    expect(fibrasDe('Fondos').p).toEqual(['Costal']);
    expect(fibrasDe('Press banca').p).toEqual(['Clavicular', 'Costal']);
  });

  it('separa los vastos del cuádriceps', () => {
    expect(fibrasDe('Leg extension').p).toEqual(['Vasto interno', 'Vasto externo']);
    expect(fibrasDe('Zancadas').p).toContain('Vasto externo');
  });

  // El orden de la tabla ES la lógica, igual que en catOf.
  it('lo específico gana a lo genérico', () => {
    expect(fibrasDe('Curl femoral').p).toEqual(['Femoral']);
    expect(fibrasDe('Curl con barra').p).toEqual(['Bíceps braquial']);
    expect(fibrasDe('Press militar').p).toEqual(['Deltoides anterior']);
    expect(fibrasDe('JM press').p).toEqual(['Tríceps']);
    expect(fibrasDe('Peso muerto rumano').p).toEqual(['Femoral']);
    expect(fibrasDe('Jalón al pecho').p).toEqual(['Dorsal bajo']);
  });

  // Bíceps braquial (agarre supinado) vs braquiorradial (agarre neutro o
  // pronado): son dos músculos distintos, no la misma bolsa "bíceps".
  it('distingue bíceps braquial de braquiorradial por el agarre', () => {
    expect(fibrasDe('Curl predicador').p).toEqual(['Bíceps braquial']);
    expect(fibrasDe('Curl inclinado').p).toEqual(['Bíceps braquial']);
    expect(fibrasDe('Curl martillo').p).toEqual(['Braquiorradial']);
    expect(fibrasDe('Curl inverso').p).toEqual(['Braquiorradial']);
  });

  // Según el criterio de Enzo (ver la nota en fibras.js): overhead reparte
  // distinto que la extensión con el brazo pegado al cuerpo.
  it('distingue la extensión de tríceps overhead de la que va con el brazo pegado', () => {
    expect(fibrasDe('Extensión sobre cabeza').p).toEqual(['Tríceps medial-lateral']);
    expect(fibrasDe('Extensión tríceps polea').p).toEqual(['Tríceps']);
    expect(fibrasDe('JM press').p).toEqual(['Tríceps']);
  });

  it('las secundarias son las que acompañan, no las que mandan', () => {
    const banca = fibrasDe('Press banca');
    expect(banca.s).toContain('Tríceps');
    expect(banca.p).not.toContain('Tríceps');
  });

  it('acepta el objeto y no sólo el nombre', () => {
    expect(fibrasDe({ name: 'Sentadilla' }).p).toContain('Vasto externo');
  });

  // Sin coincidencia no inventa: la ficha oculta la sección en vez de mostrar
  // una suposición con cara de dato.
  it('lo desconocido devuelve null', () => {
    for (const v of ['Zarandaja voladora', '', null, undefined]) {
      expect(fibrasDe(v)).toBe(null);
    }
  });

  it('siempre devuelve las dos listas', () => {
    const f = fibrasDe('Dominadas');
    expect(Array.isArray(f.p)).toBe(true);
    expect(Array.isArray(f.s)).toBe(true);
  });
});

describe('las porciones que nombra se pueden pintar', () => {
  // Si una porción no existe en la lámina y tampoco es un grupo, el cuerpito no
  // encendería nada y la ficha diría algo que el dibujo no muestra.
  it('toda porción es o una subzona de la lámina o un grupo entero', () => {
    const malas = new Set();
    for (const e of EXCATALOG) {
      const f = fibrasDe(e.n);
      if (!f) continue;
      for (const n of [...f.p, ...f.s]) {
        if (!SUBS.has(n) && !esGrupo(n)) malas.add(`${e.n} → ${n}`);
      }
    }
    expect([...malas]).toEqual([]);
  });

  it('todo grupo tiene a qué zona del cuerpo corresponde', () => {
    for (const g of [
      'Bíceps', 'Bíceps braquial', 'Braquiorradial',
      'Tríceps', 'Tríceps medial-lateral',
      'Hombro', 'Glúteo', 'Gemelos', 'Femoral', 'Aductores',
    ]) {
      expect(esGrupo(g), g).toBe(true);
      expect(ZONA_DE[g], g).toBeTruthy();
    }
  });

  // Un ejercicio del catálogo sin porciones deja la ficha a medias.
  it('los ejercicios del catálogo están cubiertos', () => {
    const sin = EXCATALOG.filter(e => !fibrasDe(e.n)).map(e => e.n);
    expect(sin).toEqual([]);
  });
});
