import { describe, it, expect } from 'vitest';
import { foodsToMD, parseFoodsMD } from '../foodmd.js';

const pollo = { name: 'Pollo', alias: ['pechuga', 'pollo a la plancha'], kcal: 165, p: 31, c: 0, f: 3.6, unit: 150, cat: 'Proteínas' };
const huevo = { name: 'Huevo', alias: ['huevos'], kcal: 143, p: 12.6, c: 0.7, f: 9.5, unit: 55, cat: 'Proteínas' };

describe('foodsToMD', () => {
  it('genera una tabla markdown con encabezado explicativo', () => {
    const md = foodsToMD([pollo]);
    expect(md).toContain('| Alimento |');
    expect(md).toContain('| Pollo |');
    expect(md).toContain('pechuga, pollo a la plancha');
    expect(md).toContain('165');
    expect(md).toContain('Macros');
    expect(md).toContain('100 g');
  });
});

describe('parseFoodsMD', () => {
  it('lee la tabla que genera foodsToMD (ida y vuelta)', () => {
    const salida = parseFoodsMD(foodsToMD([pollo, huevo]));
    expect(salida).toHaveLength(2);
    expect(salida[0]).toMatchObject({ name: 'Pollo', kcal: 165, p: 31, c: 0, f: 3.6, unit: 150, cat: 'Proteínas' });
    expect(salida[0].alias).toEqual(['pechuga', 'pollo a la plancha']);
    expect(salida[1]).toMatchObject({ name: 'Huevo', kcal: 143, p: 12.6, unit: 55 });
  });

  it('ignora el encabezado, la fila de separadores y las líneas sueltas', () => {
    const md = `# Alimentos
texto suelto que no es tabla

| Alimento | Alias | kcal | P | C | G | Unidad | Categoría |
|---|---|---:|---:|---:|---:|---:|---|
| Arroz |  | 130 | 2.7 | 28 | 0.3 | 200 | Carbos |
`;
    const salida = parseFoodsMD(md);
    expect(salida).toHaveLength(1);
    expect(salida[0]).toMatchObject({ name: 'Arroz', kcal: 130, unit: 200, cat: 'Carbos' });
    expect(salida[0].alias).toEqual([]);
  });

  it('acepta coma decimal y celdas vacías', () => {
    const md = `| Alimento | Alias | kcal | P | C | G | Unidad | Categoría |
|---|---|---:|---:|---:|---:|---:|---|
| Palta |  | 160 | 2 | 9 | 15,3 |  |  |
`;
    const salida = parseFoodsMD(md);
    expect(salida[0].f).toBe(15.3);
    expect(salida[0].unit).toBe(null);
    expect(salida[0].cat).toBe(null);
  });

  it('descarta filas sin nombre o sin calorías', () => {
    const md = `| Alimento | Alias | kcal | P | C | G | Unidad | Categoría |
|---|---|---:|---:|---:|---:|---:|---|
|  |  | 100 | 1 | 1 | 1 |  |  |
| Sin datos |  |  |  |  |  |  |  |
| Bueno |  | 50 | 1 | 2 | 0 |  |  |
`;
    expect(parseFoodsMD(md).map(f => f.name)).toEqual(['Bueno']);
  });

  it('un archivo vacío o sin tabla devuelve lista vacía', () => {
    expect(parseFoodsMD('')).toEqual([]);
    expect(parseFoodsMD('# Nada\n\nsólo prosa.')).toEqual([]);
  });

  it('un alimento con 0 kcal es válido y no se descarta', () => {
    const md = `| Alimento | Alias | kcal | P | C | G | Unidad | Categoría |
|---|---|---:|---:|---:|---:|---:|---|
| Agua |  | 0 | 0 | 0 | 0 |  |  |
`;
    expect(parseFoodsMD(md)).toHaveLength(1);
  });
});
