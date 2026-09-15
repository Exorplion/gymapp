// El borrado de un gimnasio se puede deshacer.
//
// Por qué tiene test y no era sólo un detalle de interfaz: al borrar un gym
// se va con él su mapa de equipo (`equip`), que es "este ejercicio, acá, con
// esta máquina" acumulado a lo largo de varias sesiones. Eso no se reconstruye
// de memoria, y el botón de borrar vive pegado al de activar, que es el que
// más se toca de la fila. Deshacer tiene que devolver EXACTAMENTE lo que había.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';

// El toast se intercepta para poder ejecutar su acción desde el test: es la
// única forma de llegar al "Deshacer" sin montar la interfaz.
let ultimoToast = null;
vi.mock('../toast.js', () => ({
  toast: (msg, opts) => { ultimoToast = { msg, ...opts }; },
}));
// idb escribe en IndexedDB; acá no interesa la persistencia, sólo el estado.
vi.mock('../db.js', () => ({ idb: { put: vi.fn(async () => {}), del: vi.fn(async () => {}) } }));

const { deleteGym } = await import('../gyms.js');

const gym = (id, name, equip = {}) => ({ id, name, equip });

describe('deleteGym', () => {
  beforeEach(() => {
    ultimoToast = null;
    S.gyms = [gym('a', 'Smart Fit'), gym('b', 'Gym del finde', { 'jalon|polea': 'x' }), gym('c', 'El de casa')];
    S.cfg = { ...S.cfg, activeGym: null };
  });

  it('borra el gimnasio y ofrece deshacer', () => {
    deleteGym('b');
    expect(S.gyms.map(g => g.id)).toEqual(['a', 'c']);
    expect(ultimoToast.msg).toContain('Gym del finde');
    expect(ultimoToast.actionLabel).toBe('Deshacer');
  });

  it('deshacer lo devuelve a su posición, no al final', () => {
    deleteGym('b');
    ultimoToast.onAction();
    expect(S.gyms.map(g => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('deshacer devuelve el mapa de equipo intacto', () => {
    deleteGym('b');
    ultimoToast.onAction();
    expect(S.gyms.find(g => g.id === 'b').equip).toEqual({ 'jalon|polea': 'x' });
  });

  it('si el borrado era el gym activo, deshacer lo vuelve a activar', () => {
    S.cfg.activeGym = 'b';
    deleteGym('b');
    expect(S.cfg.activeGym).toBe(null);
    ultimoToast.onAction();
    expect(S.cfg.activeGym).toBe('b');
  });

  it('borrar uno que NO era el activo no toca cuál está activo', () => {
    S.cfg.activeGym = 'a';
    deleteGym('c');
    expect(S.cfg.activeGym).toBe('a');
    ultimoToast.onAction();
    expect(S.cfg.activeGym).toBe('a');
  });

  it('borrar un id que no existe no hace nada ni ofrece deshacer', () => {
    deleteGym('no-existe');
    expect(S.gyms.map(g => g.id)).toEqual(['a', 'b', 'c']);
    expect(ultimoToast).toBe(null);
  });
});
