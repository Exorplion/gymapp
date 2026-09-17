// EXPERIMENTO coverflow — testea sólo la matemática pura (distancia
// normalizada -> rotateY/scale/opacity/translateZ/zIndex), sin DOM ni React.
// Revertir el experimento incluye borrar este archivo.
import { describe, it, expect } from 'vitest';
import ExerciseCarousel from './ExerciseCarousel.jsx';

const coverflowFrame = ExerciseCarousel.coverflowFrame;

describe('coverflowFrame', () => {
  it('el slide activo (distancia ~0) queda EXACTAMENTE plano', () => {
    const f = coverflowFrame(0);
    expect(f.rotateY).toBe(0);
    expect(f.scale).toBe(1);
    expect(f.opacity).toBe(1);
    expect(f.translateZ).toBe(0);
  });

  it('distancias por debajo del epsilon también quedan planas (sin rotación residual)', () => {
    const f = coverflowFrame(0.01);
    expect(f.rotateY).toBe(0);
    expect(f.scale).toBe(1);
  });

  it('un slide a la derecha del centro rota hacia adentro (signo negativo)', () => {
    const f = coverflowFrame(1);
    expect(f.rotateY).toBeLessThan(0);
  });

  it('un slide a la izquierda del centro rota hacia el otro lado (signo positivo)', () => {
    const f = coverflowFrame(-1);
    expect(f.rotateY).toBeGreaterThan(0);
  });

  it('es simétrico en magnitud entre izquierda y derecha', () => {
    const right = coverflowFrame(1);
    const left = coverflowFrame(-1);
    expect(right.rotateY).toBeCloseTo(-left.rotateY);
    expect(right.scale).toBeCloseTo(left.scale);
    expect(right.opacity).toBeCloseTo(left.opacity);
    expect(right.translateZ).toBeCloseTo(left.translateZ);
  });

  it('escala y opacidad decrecen monótonamente con la distancia', () => {
    const near = coverflowFrame(0.3);
    const far = coverflowFrame(0.9);
    expect(far.scale).toBeLessThan(near.scale);
    expect(far.opacity).toBeLessThan(near.opacity);
    expect(far.translateZ).toBeLessThan(near.translateZ);
  });

  it('el efecto satura más allá de 1 slide de distancia (no sigue creciendo sin límite)', () => {
    const one = coverflowFrame(1);
    const far = coverflowFrame(1.6);
    expect(far.scale).toBeCloseTo(one.scale);
    expect(far.opacity).toBeCloseTo(one.opacity);
    expect(far.rotateY).toBeCloseTo(one.rotateY);
  });

  it('clampea entradas fuera de rango sin romperse', () => {
    const huge = coverflowFrame(50);
    const one = coverflowFrame(1);
    expect(huge.scale).toBeCloseTo(one.scale);
    expect(Number.isFinite(huge.rotateY)).toBe(true);
  });

  it('opacidad y escala nunca son negativas ni superan 1', () => {
    for (const t of [-2, -1, -0.5, 0, 0.5, 1, 2]) {
      const f = coverflowFrame(t);
      expect(f.opacity).toBeGreaterThanOrEqual(0);
      expect(f.opacity).toBeLessThanOrEqual(1);
      expect(f.scale).toBeGreaterThan(0);
      expect(f.scale).toBeLessThanOrEqual(1);
    }
  });
});
