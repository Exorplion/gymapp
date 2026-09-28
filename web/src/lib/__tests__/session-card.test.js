// "1 series · 333 kg de volumen" (auditoría 2026-09-27, P1).
import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { S } from '../state.js';
import SessionCard from '../../components/SessionCard.jsx';

const sesion = sets => ({
  id: 's', date: '2026-09-22', start: 1, duration: 40, dayName: 'Posterior A',
  entries: [{ name: 'Remo', sets: Array.from({ length: sets }, () => ({ w: 37, r: 9 })) }],
});
const texto = sess => renderToStaticMarkup(createElement(SessionCard, { sess }));

beforeEach(() => { S.sessions = []; });

describe('SessionCard', () => {
  it('una serie va en singular', () => {
    expect(texto(sesion(1))).toContain('1 serie · 333 kg de volumen');
  });
  it('varias, en plural', () => {
    expect(texto(sesion(3))).toContain('3 series ·');
  });
});
