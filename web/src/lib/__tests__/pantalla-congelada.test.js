import { describe, it, expect, beforeEach } from 'vitest';
import { S, bump, changeTab, versionDePantalla } from '../state.js';

/* G4 (auditoría total 2026-09): la pantalla que se va sigue montada 480 ms
   mientras se desliza afuera (es la misma, no una copia: ver App.jsx). Pero
   se suscribe al store con useStore(), y el bump() del propio cambio de
   pestaña la hacía renderizar de nuevo —Progreso entero, con sus cálculos y
   su gráfico— en el mismo cuadro en que se monta la nueva. Por eso queda
   congelada: para sus componentes, el store no cambia hasta que vuelva a ser
   la pestaña de adelante. */
describe('la pantalla que se va no se entera de los bump()', () => {
  beforeEach(() => { S.tab = 'inicio'; });

  it('fuera de una pantalla (App, hojas) todo bump se ve', () => {
    const v = versionDePantalla(null);
    bump();
    expect(versionDePantalla(null)).not.toBe(v);
  });

  it('la saliente queda en la versión que ya había pintado', () => {
    const antes = versionDePantalla('inicio');
    changeTab('prog');
    expect(versionDePantalla('inicio')).toBe(antes);
    bump();
    expect(versionDePantalla('inicio')).toBe(antes);
  });

  it('la entrante sí ve el cambio', () => {
    const antes = versionDePantalla('prog');
    changeTab('prog');
    expect(versionDePantalla('prog')).not.toBe(antes);
  });

  it('al volver a ser la de adelante se descongela', () => {
    changeTab('prog');
    const congelada = versionDePantalla('inicio');
    changeTab('inicio');
    expect(versionDePantalla('inicio')).not.toBe(congelada);
    bump();
    expect(versionDePantalla('inicio')).toBe(versionDePantalla(null));
  });
});
