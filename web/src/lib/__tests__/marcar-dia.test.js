// La hoja "¿Qué entrenaste?" de un día pasado (MarcarDia). Desde el
// 2026-09-29 no se queda en el turno: lo ya anotado ese día se puede abrir
// para cargar las series, y el texto ya no dice que los pesos no se cargan.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { S } from '../state.js';
import MarcarDia from '../../components/sheets/MarcarDia.jsx';

vi.mock('../db.js', () => ({ DB: {}, STORES: [], idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));

const html = () => renderToStaticMarkup(createElement(MarcarDia, { fecha: '2026-09-28' }));

beforeEach(() => {
  S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Posterior A', exercises: [{ id: 'e1', name: 'Remo', sets: 3, reps: 8 }] }];
  S.sessions = [];
});

describe('MarcarDia', () => {
  it('ya no dice que los pesos no se cargan', () => {
    expect(html()).not.toContain('Se anota el turno, no las series');
  });

  it('una sesión ya anotada sin series se puede abrir para cargarlas', () => {
    S.sessions = [{ id: 'r', date: '2026-09-28', slotId: 's1', dayName: 'Posterior A', entries: [], retro: true }];
    const h = html();
    expect(h).toMatch(/<button[^>]*aria-label="Abrir Posterior A del/);
    expect(h).toContain('sin series · tocá para cargarlas');
  });
});
