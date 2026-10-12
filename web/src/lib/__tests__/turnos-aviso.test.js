// El aviso de la unificación: qué dice, y que sale una sola vez.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { textoAvisoTurnos } from '../turnos.js';
import { abrirAvisoTurnos } from '../rutina-logic.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(async () => {}), del: vi.fn(), all: vi.fn(), clear: vi.fn(), tx: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));

const RESP = 'Respaldo antes de unificar turnos (12 oct)';

describe('textoAvisoTurnos', () => {
  it('un turno, gana la primera', () => {
    const t = textoAvisoTurnos({ grupos: [{ nombre: 'Posterior', versiones: 2, gano: 'primera' }], respaldo: RESP });
    expect(t.titulo).toBe('Ahora cada turno es uno solo');
    expect(t.intro).toBe('Si cambiás Posterior, cambia todas las veces que aparece en tu semana.');
    expect(t.lineas).toEqual(['Posterior tenía 2 versiones distintas: quedó la primera de tu semana.']);
    expect(t.respaldo).toBe(`La otra está en Mis rutinas → «${RESP}».`);
  });

  it('una editada por otra versión de la app', () => {
    const t = textoAvisoTurnos({ grupos: [{ nombre: 'Posterior', versiones: 2, gano: 'editada' }], respaldo: RESP });
    expect(t.lineas).toEqual(['Posterior tenía 2 versiones distintas: quedó la que cambiaste último.']);
  });

  it('varios turnos o más de dos versiones: "las otras"', () => {
    const t = textoAvisoTurnos({
      grupos: [{ nombre: 'Anterior', versiones: 2, gano: 'primera' }, { nombre: 'Posterior', versiones: 3, gano: 'primera' }],
      respaldo: RESP,
    });
    expect(t.intro).toBe('Si cambiás Anterior, cambia todas las veces que aparece en tu semana.');
    expect(t.lineas).toHaveLength(2);
    expect(t.lineas[1]).toBe('Posterior tenía 3 versiones distintas: quedó la primera de tu semana.');
    expect(t.respaldo).toBe(`Las otras están en Mis rutinas → «${RESP}».`);
  });
});

describe('abrirAvisoTurnos', () => {
  beforeEach(() => { S.sheet = null; });

  it('abre la hoja una vez y borra el aviso', () => {
    S.cfg.avisoTurnos = { fecha: '2026-10-12', grupos: [{ nombre: 'Posterior', versiones: 2, gano: 'primera' }], respaldo: RESP };
    expect(abrirAvisoTurnos()).toBe(true);
    expect(S.sheet.type).toBe('aviso-turnos');
    expect(S.sheet.props.aviso.respaldo).toBe(RESP);
    expect(S.cfg.avisoTurnos).toBeUndefined();
    S.sheet = null;
    expect(abrirAvisoTurnos()).toBe(false);
    expect(S.sheet).toBeNull();
  });
});
