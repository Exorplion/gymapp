// porcionesDe(): qué porciones de un grupo se están entrenando y con cuánto
// volumen, a partir de los ejercicios elegidos. Es la lógica pura detrás de
// MuscleFibers.jsx, separada para poder testearla sin renderizar nada.
import { describe, it, expect } from 'vitest';
import { porcionesDe } from '../../components/MuscleFibers.jsx';

describe('porcionesDe', () => {
  it('distingue press plano de press inclinado en Pecho: ambas porciones presentes', () => {
    const out = porcionesDe('Pecho', [
      { name: 'Press plano', sets: 3 },
      { name: 'Press inclinado', sets: 4 },
    ]);
    const bandas = out.map(x => x.banda);
    // press plano toca clavicular+costal ("superior"+"medio"); press
    // inclinado sólo clavicular ("superior"). Las dos deben aparecer, y
    // deben ser DISTINTAS entre sí — si no, el header no diría nada nuevo.
    expect(bandas).toContain('superior');
    expect(bandas).toContain('medio');
    expect(new Set(bandas).size).toBe(bandas.length);
  });

  it('un ejercicio que fibras.js no reconoce no rompe y no inventa porción', () => {
    const out = porcionesDe('Pecho', [{ name: 'Ejercicio inventado que no existe', sets: 3 }]);
    expect(out).toEqual([]);
  });

  it('lista vacía o undefined no explota (turno de descanso sin exercises)', () => {
    expect(porcionesDe('Pecho', [])).toEqual([]);
    expect(porcionesDe('Pecho', undefined)).toEqual([]);
  });

  it('un grupo sin porciones distinguibles en la lámina (Glúteo) siempre devuelve vacío', () => {
    // Glúteo no tiene subdivisión honesta en fibras.js: todo cae en la misma
    // bolsa. Mostrar una porción ahí sería inventar precisión.
    const out = porcionesDe('Glúteo', [{ name: 'Hip thrust', sets: 4 }]);
    expect(out).toEqual([]);
  });

  it('el volumen (series) se suma cuando dos ejercicios tocan la misma porción', () => {
    const out = porcionesDe('Pecho', [
      { name: 'Press plano', sets: 3 },
      { name: 'Press declinado', sets: 2 }, // sólo costal ("medio")
    ]);
    const medio = out.find(x => x.banda === 'medio');
    expect(medio.sets).toBe(5); // 3 (plano) + 2 (declinado)
  });

  it('sin dato de sets numérico, cuenta como presente sin inventar volumen', () => {
    const out = porcionesDe('Pecho', [{ name: 'Press inclinado' }]);
    expect(out.find(x => x.banda === 'superior').sets).toBe(1);
  });
});
