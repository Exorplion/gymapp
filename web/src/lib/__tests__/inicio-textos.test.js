import { describe, it, expect } from 'vitest';
import { abreviar, frase, nombreZona } from '../inicio.js';

describe('textos de la portada', () => {
  it('abrevia los turnos para que entren en un día de la tira', () => {
    expect(['Anterior A', 'Posterior B', 'Empuje', 'Torso', 'Full body', 'Pierna 2', ''].map(abreviar))
      .toEqual(['Ant A', 'Post B', 'Emp', 'Tors', 'Full', 'Pier 2', '']);
  });
  it('frases con y', () => {
    expect(frase(['pecho'])).toBe('pecho');
    expect(frase(['pecho', 'hombros', 'tríceps'])).toBe('pecho, hombros y tríceps');
  });
  it('nombres de zona', () => {
    expect(['Hombro', 'Abs', 'Cuádriceps', 'Glúteo'].map(nombreZona)).toEqual(['Hombros', 'Abdomen', 'Cuádriceps', 'Glúteos']);
  });
});
