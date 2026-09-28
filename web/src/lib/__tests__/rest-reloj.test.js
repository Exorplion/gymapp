import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* G3 (auditoría total 2026-09): el descanso llamaba a bump() —el aviso GLOBAL
   de state.js— cada 250 ms, así que toda la app (App, Hoy, la tarjeta del
   ejercicio con sus diez slides…) se re-renderizaba cuatro veces por segundo
   mientras mirabas un reloj. El reloj ahora tiene su propio canal
   (suscribirReloj) que avisa sólo cuando cambia el segundo, y bump() queda
   para los cambios de estado de verdad (abrir, minimizar, sonar, cortar). */
vi.mock('../state.js', async orig => ({ ...(await orig()), bump: vi.fn() }));

// Mismo DOM mínimo que alarm.test.js: startRest() prepara el <audio>.
const CUERPO = [];
globalThis.document = {
  body: { appendChild: el => CUERPO.push(el) },
  querySelector: sel => (sel === 'audio' ? CUERPO[0] || null : null),
  addEventListener: () => {},
};
globalThis.Audio = class {
  constructor() { this.attrs = {}; }
  getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
  removeAttribute(n) { delete this.attrs[n]; }
  set src(v) { this.attrs.src = v; }
  get src() { return this.attrs.src; }
  load() {}
  play() { return Promise.resolve(); }
  pause() {}
};
globalThis.URL.createObjectURL = () => 'blob:alarma';

const { S, bump } = await import('../state.js');
const {
  T, startRest, stopRest, shiftRest, minimizeRest, recuperarRest,
  suscribirReloj, versionReloj, tramoAnillo, tramosAnillo,
} = await import('../rest.js');

describe('el reloj del descanso no re-renderiza la app', () => {
  let avisos;
  let soltar;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 10, 0, 0));
    S.cfg.rest = 90;
    T.state = 'hidden'; T.end = 0; T.int = null;
    avisos = 0;
    soltar = suscribirReloj(() => { avisos++; });
  });
  afterEach(() => { soltar(); stopRest(); vi.useRealTimers(); });

  it('los ticks no llaman a bump()', () => {
    startRest();
    bump.mockClear();
    vi.advanceTimersByTime(10000);
    expect(bump).not.toHaveBeenCalled();
  });

  it('avisa al reloj una vez por segundo, no en cada tick de 250 ms', () => {
    startRest();
    avisos = 0;
    vi.advanceTimersByTime(10000);   // 40 ticks
    expect(avisos).toBe(10);
  });

  it('la versión del reloj cambia cuando cambia el segundo', () => {
    startRest();
    const v0 = versionReloj();
    vi.advanceTimersByTime(250);
    expect(versionReloj()).toBe(v0);
    vi.advanceTimersByTime(1000);
    expect(versionReloj()).not.toBe(v0);
  });

  it('±30 s avisa al reloj y reprograma el anillo sin bump()', () => {
    startRest();
    const seq = T.seq;
    bump.mockClear(); avisos = 0;
    shiftRest(30);
    expect(bump).not.toHaveBeenCalled();
    expect(avisos).toBe(1);
    expect(T.seq).toBe(seq + 1);
  });

  it('los cambios de estado sí pasan por bump()', () => {
    bump.mockClear();
    startRest();
    expect(bump).toHaveBeenCalled();
    bump.mockClear();
    minimizeRest();
    expect(bump).toHaveBeenCalled();
    bump.mockClear();
    vi.advanceTimersByTime(90000);
    expect(T.state).toBe('ringing');
    expect(bump).toHaveBeenCalled();
  });

  /* En Android el reloj monotónico (el de las animaciones) se frena con el
     teléfono dormido y Date.now() no: al volver, el anillo tiene que
     reprogramarse contra T.end o quedaría atrasado. */
  it('volver a la app reprograma el anillo', () => {
    startRest();
    const seq = T.seq;
    vi.setSystemTime(Date.now() + 20000);
    recuperarRest();
    expect(T.seq).toBe(seq + 1);
  });

  it('cada descanso nuevo reprograma el anillo', () => {
    startRest();
    const seq = T.seq;
    stopRest();
    startRest();
    expect(T.seq).toBe(seq + 1);
  });
});

describe('el anillo: una sola animación continua', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 10, 0, 0));
    S.cfg.rest = 90;
    T.state = 'hidden'; T.end = 0; T.int = null;
  });
  afterEach(() => { stopRest(); vi.useRealTimers(); });

  it('tramoAnillo dice dónde está el anillo y cuánto le falta para vaciarse', () => {
    startRest();
    expect(tramoAnillo()).toEqual({ desde: 1, ms: 90000 });
    vi.advanceTimersByTime(45000);
    expect(tramoAnillo()).toEqual({ desde: 0.5, ms: 45000 });
  });

  it('tramoAnillo nunca pasa de lleno ni de vacío', () => {
    startRest();
    vi.setSystemTime(Date.now() + 200000);
    expect(tramoAnillo()).toEqual({ desde: 0, ms: 0 });
  });

  it('sin salto: si ya está donde tiene que estar, baja lineal hasta cero', () => {
    const k = tramosAnillo({ previo: 0.5, desde: 0.5, ms: 45000 });
    expect(k).toEqual([
      { offset: 0, p: 0.5, easing: 'linear' },
      { offset: 1, p: 0, easing: 'linear' },
    ]);
  });

  it('con salto (+30 s, arranque): primero llega suave y después baja lineal', () => {
    const k = tramosAnillo({ previo: 0.5, desde: 1, ms: 60000, llegada: 900 });
    expect(k).toHaveLength(3);
    expect(k[0]).toMatchObject({ offset: 0, p: 0.5 });
    expect(k[0].easing).not.toBe('linear');
    expect(k[1].offset).toBeCloseTo(900 / 60000, 6);
    // a los 900 ms tiene que estar donde la cuenta lineal dice, sin escalón
    expect(k[1].p).toBeCloseTo(1 * (60000 - 900) / 60000, 6);
    expect(k[1].easing).toBe('linear');
    expect(k[2]).toEqual({ offset: 1, p: 0, easing: 'linear' });
  });

  it('si queda menos que la llegada, llega suave directo a cero', () => {
    const k = tramosAnillo({ previo: 1, desde: 0.01, ms: 500, llegada: 900 });
    expect(k).toHaveLength(2);
    expect(k[1]).toMatchObject({ offset: 1, p: 0 });
  });
});
