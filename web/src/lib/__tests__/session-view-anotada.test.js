// La hoja de una sesión anotada a mano (sin duración medida): no puede decir
// "· min" vacío, y si todavía no tiene series ofrece cargarlas.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { S } from '../state.js';
import SessionView from '../../components/sheets/SessionView.jsx';

vi.mock('../state.js', async orig => ({ ...(await orig()), useStore: () => ({}) }));
vi.mock('../db.js', () => ({ DB: {}, STORES: [], idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));

const base = { id: 'r', date: '2026-09-27', slotId: 's1', dayName: 'Posterior A', start: 1, end: 1, duration: null, retro: true };
const html = props => renderToStaticMarkup(createElement(SessionView, props));

beforeEach(() => {
  S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Posterior A', exercises: [{ id: 'e1', name: 'Remo', sets: 3, reps: 8 }] }];
});

describe('SessionView de una sesión anotada a mano', () => {
  it('sin duración no pinta "· min" vacío', () => {
    S.sessions = [{ ...base, entries: [] }];
    const h = html({ id: 'r' });
    expect(h).not.toMatch(/·\s*min/);
    expect(h).not.toMatch(/<div class="n"><\/div>/);
  });

  it('sin series ofrece cargarlas', () => {
    S.sessions = [{ ...base, entries: [] }];
    expect(html({ id: 'r' })).toContain('Cargar las series');
  });

  it('con series no vuelve a ofrecerlo', () => {
    S.sessions = [{ ...base, entries: [{ name: 'Remo', sets: [{ w: 40, r: 8 }] }] }];
    expect(html({ id: 'r' })).not.toContain('Cargar las series');
  });
});
