// El borrado de un gimnasio se puede deshacer.
//
// Por qué tiene test y no era sólo un detalle de interfaz: al borrar un gym
// se va con él su mapa de equipo (`equip`), que es "este ejercicio, acá, con
// esta máquina" acumulado a lo largo de varias sesiones. Eso no se reconstruye
// de memoria, y el botón de borrar vive pegado al de activar, que es el que
// más se toca de la fila. Deshacer tiene que devolver EXACTAMENTE lo que había.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S, wToUnit } from '../state.js';

// El toast se intercepta para poder ejecutar su acción desde el test: es la
// única forma de llegar al "Deshacer" sin montar la interfaz.
let ultimoToast = null;
vi.mock('../toast.js', () => ({
  toast: (msg, opts) => { ultimoToast = { msg, ...opts }; },
}));
// idb escribe en IndexedDB; acá no interesa la persistencia, sólo el estado.
vi.mock('../db.js', () => ({ idb: { put: vi.fn(async () => {}), del: vi.fn(async () => {}) } }));
// Sin esto, setActiveGym llama a indiceHoy() de session.js, que a su vez
// depende de la rutina completa (turnos, eleccionHoy) — nada de eso importa
// para probar que la unidad se aplica/guarda, así que se corta ahí.
vi.mock('../session.js', () => ({ indiceHoy: () => -1 }));

const { deleteGym, cambiarUnidad, setActiveGym } = await import('../gyms.js');

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

describe('cambiarUnidad: kg/lb por máquina', () => {
  beforeEach(() => {
    S.gyms = [gym('a', 'Smart Fit'), gym('b', 'Gym Libras')];
    S.cfg = { ...S.cfg, unit: 'kg', activeGym: 'b', unidades: {} };
    S.routine = [];
    S.draft = null;
    S.hoyVals = {};
  });
  const jalon = { id: 'x1', name: 'Jalón al pecho', variante: 'm-polea' };

  it('la guarda para ESA máquina en ESE gym, sin tocar la general', () => {
    cambiarUnidad(jalon, 'lb');
    expect(S.cfg.unidades['b|jalón al pecho@m-polea']).toBe('lb');
    expect(S.cfg.unit).toBe('kg');
  });

  it('el gym recuerda la última, para las máquinas que todavía no tienen', () => {
    cambiarUnidad(jalon, 'lb');
    expect(S.gyms.find(g => g.id === 'b').unit).toBe('lb');
    expect(S.gyms.find(g => g.id === 'a').unit).toBeUndefined();
  });

  it('lleva el peso de la rueda al escalón de la otra unidad (50 kg → 110 lb)', () => {
    S.hoyVals.x1 = { w: 50, r: 10 };
    cambiarUnidad(jalon, 'lb');
    expect(wToUnit(S.hoyVals.x1.w, 'lb')).toBeCloseTo(110, 6);
    cambiarUnidad(jalon, 'kg');
    expect(S.hoyVals.x1.w).toBe(50);
  });

  it('cambiar de gym ya no pisa la unidad general', async () => {
    S.gyms[1].unit = 'lb';
    await setActiveGym('b');
    expect(S.cfg.unit).toBe('kg');
  });
});
