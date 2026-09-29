// La tira de Inicio, montada de verdad (SSR, sin navegador): el martes
// 29-sep tiene que ofrecer el domingo 27 para anotar, y ningún día futuro.
// Es el caso exacto de Enzo del 2026-09-29.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { S } from '../state.js';
import Inicio from '../../components/screens/Inicio.jsx';

// useStore usa useSyncExternalStore sin snapshot de servidor: en SSR se
// reemplaza por un lector quieto. Lo que se prueba es qué días pinta la tira.
vi.mock('../state.js', async orig => ({ ...(await orig()), useStore: () => ({}) }));
vi.mock('../db.js', () => ({ DB: {}, STORES: [], idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T10:00:00')); });
afterAll(() => { vi.useRealTimers(); });

function tira() {
  const html = renderToStaticMarkup(createElement(Inicio));
  const m = html.match(/<div class="wkreal"[^>]*>([\s\S]*?)<\/div>/);
  return [...(m?.[1] || '').matchAll(/aria-label="([^"]+)"/g)].map(x => x[1]);
}

describe('tira de Inicio', () => {
  it('el martes 29 muestra del miércoles 23 al martes 29, con el domingo 27 tocable', () => {
    S.sessions = [];
    const labels = tira();
    expect(labels).toHaveLength(7);
    expect(labels[0]).toMatch(/^Mié 23/);
    expect(labels[6]).toMatch(/^Mar 29/);
    expect(labels.find(l => l.startsWith('Dom 27'))).toMatch(/tocá para anotar/);
    expect(labels.some(l => /todavía no llegó/.test(l))).toBe(false);
  });
});
