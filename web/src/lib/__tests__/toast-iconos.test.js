// El glifo de tono de un aviso se separa del texto para dibujarlo como SVG
// (auditoría total, G7): el texto que se lee queda limpio.
import { describe, it, expect } from 'vitest';
import { partirToast } from '../toast.js';

describe('partirToast', () => {
  it('separa el glifo de delante', () => {
    expect(partirToast('⚠ Archivo inválido')).toEqual({ icono: 'alerta', texto: 'Archivo inválido' });
    expect(partirToast('✓ Press banca completo · sigue Remo')).toEqual({ icono: 'check', texto: 'Press banca completo · sigue Remo' });
    expect(partirToast('＋ Pollo')).toEqual({ icono: 'mas', texto: 'Pollo' });
    expect(partirToast('⏱ Rutina en marcha · Remo')).toEqual({ icono: 'reloj', texto: 'Rutina en marcha · Remo' });
    expect(partirToast('🎯 Metas: 2300 kcal')).toEqual({ icono: 'diana', texto: 'Metas: 2300 kcal' });
    expect(partirToast('💪 Sesión guardada · 21 series')).toEqual({ icono: 'mancuerna', texto: 'Sesión guardada · 21 series' });
  });
  it('y el ✓ del final', () => {
    expect(partirToast('Datos restaurados ✓')).toEqual({ icono: 'check', texto: 'Datos restaurados' });
  });
  it('un aviso sin glifo queda igual', () => {
    expect(partirToast('Serie registrada')).toEqual({ icono: null, texto: 'Serie registrada' });
    expect(partirToast('Press banca → Remo')).toEqual({ icono: null, texto: 'Press banca → Remo' });
  });
});
