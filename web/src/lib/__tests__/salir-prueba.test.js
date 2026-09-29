// La salida del modo prueba (hoja 'salir-prueba') y los avisos de "esto queda
// en la copia" (2026-09-29).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { S } from '../state.js';
import { CLAVE } from '../modoPrueba.js';
import { ResumenSalida } from '../../components/sheets/SalirPrueba.jsx';
import MarcarDia from '../../components/sheets/MarcarDia.jsx';
import { TerminarSesion } from '../../components/screens/Hoy.jsx';

vi.mock('../state.js', async orig => ({ ...(await orig()), useStore: () => ({}) }));
vi.mock('../db.js', () => ({ DB: {}, STORES: [], idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));

const memoria = new Map();
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => { memoria.set(k, String(v)); },
  removeItem: k => { memoria.delete(k); },
  clear: () => { memoria.clear(); },
};

const dif = {
  sesiones: [
    { id: 'd', date: '2026-09-27', dayName: 'Posterior A' },
    { id: 'l', date: '2026-09-28', dayName: 'Pierna' },
  ],
  pesos: [{ id: 'b', date: '2026-09-27', weight: 79.5 }],
  comidas: [],
  enCurso: false,
};
const vacio = { sesiones: [], pesos: [], comidas: [], enCurso: false };
const html = props => renderToStaticMarkup(createElement(ResumenSalida, { onPasar() {}, onDescartar() {}, onSeguir() {}, ...props }));

describe('ResumenSalida', () => {
  it('dice cuánto hay en la copia y ofrece pasarlo o descartarlo', () => {
    const h = html({ dif });
    expect(h).toContain('Registraste 2 sesiones y 1 peso en la prueba.');
    expect(h).toContain('Posterior A · Dom 27 sep');
    expect(h).toContain('Pierna · Lun 28 sep');
    expect(h).toContain('Pasarlas a mis datos reales');
    expect(h).toContain('Descartarlas');
  });

  it('sin nada nuevo, sólo ofrece salir', () => {
    const h = html({ dif: vacio });
    expect(h).toContain('No registraste nada nuevo en la prueba.');
    expect(h).not.toContain('Pasarlas');
    expect(h).toContain('>Salir<');
  });

  it('abierta otro día, pregunta si seguís', () => {
    const h = html({ dif, motivo: 'otro-dia' });
    expect(h).toContain('¿Seguís en modo prueba?');
    expect(h).toContain('Sí, sigo probando');
  });

  it('avisa si hay una sesión abierta en la prueba', () => {
    expect(html({ dif: { ...vacio, enCurso: true } })).toContain('sesión en curso');
  });

  it('mientras lee las dos bases, lo dice', () => {
    expect(html({ dif: null })).toContain('Revisando');
  });
});

describe('avisos de copia de prueba', () => {
  beforeEach(() => {
    localStorage.clear();
    S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Posterior A', exercises: [{ id: 'e1', name: 'Remo', sets: 3, reps: 8 }] }];
    S.sessions = [];
    S.draft = { entries: { e1: { sets: [{ w: 1, r: 1 }] } } };
  });

  it('en prueba, Terminar avisa que la sesión queda en la copia', () => {
    localStorage.setItem(CLAVE, '1');
    expect(renderToStaticMarkup(createElement(TerminarSesion))).toContain('copia de prueba');
  });

  it('fuera de prueba no dice nada', () => {
    expect(renderToStaticMarkup(createElement(TerminarSesion))).not.toContain('copia de prueba');
  });

  it('en prueba, anotar un día pasado avisa que queda en la copia', () => {
    localStorage.setItem(CLAVE, '1');
    expect(renderToStaticMarkup(createElement(MarcarDia, { fecha: '2026-09-27' }))).toContain('copia de prueba');
  });
});

describe('marco del modo prueba', () => {
  it('en prueba hay un marco con el texto PRUEBA; fuera, nada', async () => {
    const { MarcoPrueba } = await import('../../components/sheets/SalirPrueba.jsx');
    localStorage.clear();
    expect(renderToStaticMarkup(createElement(MarcoPrueba))).toBe('');
    localStorage.setItem(CLAVE, '1');
    const h = renderToStaticMarkup(createElement(MarcoPrueba));
    expect(h).toContain('class="marco-prueba"');
    expect(h).toContain('PRUEBA');
  });

  it('el marco usa el token de estado ámbar y no toma toques', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const css = readFileSync(join(import.meta.dirname, '../../styles.css'), 'utf8');
    const regla = css.match(/\.marco-prueba\{[^}]*\}/)?.[0] || '';
    expect(regla).toContain('var(--warn)');
    expect(regla).toContain('pointer-events:none');
    expect(regla).toContain('position:fixed');
  });
});
