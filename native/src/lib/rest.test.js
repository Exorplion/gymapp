// Tests de la lógica pura de cuenta regresiva de rest.js. Los efectos de
// audio/vibración/notificación reales (alarm.js) se mockean — acá sólo se
// verifica que T.end/T.leftSec/T.pct/T.state se calculan bien contra un
// Date.now() mockeado, no que el hardware suene.
jest.mock('./alarm.js', () => ({
  prepararAlarma: jest.fn(),
  pedirPermiso: jest.fn(),
  sonar: jest.fn(),
  callar: jest.fn(),
  scheduleEndNotification: jest.fn(),
  cancelScheduledNotification: jest.fn(),
}));

import { S } from './state.js';
import { T, startRest, stopRest, shiftRest, tickRest, minimizeRest, expandRest, recuperarRest } from './rest.js';
import { callar, sonar } from './alarm.js';

describe('rest.js', () => {
  let now;

  beforeEach(() => {
    now = 1000000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    T.end = 0; T.total = 0; T.int = null; T.state = 'hidden'; T.leftSec = 0; T.pct = 0;
    S.cfg.rest = 90;
    jest.clearAllMocks();
  });

  afterEach(() => {
    stopRest();
    Date.now.mockRestore();
  });

  it('startRest(90) fija T.total y T.end 90000ms adelante', () => {
    startRest(90);
    expect(T.total).toBe(90);
    expect(T.end).toBe(now + 90000);
    expect(T.state).toBe('fullscreen');
  });

  it('startRest() sin segs usa S.cfg.rest', () => {
    startRest();
    expect(T.total).toBe(90);
  });

  it('startRest() no arranca nada si no hay segs y S.cfg.rest es 0', () => {
    S.cfg.rest = 0;
    startRest();
    expect(T.state).toBe('hidden');
    expect(T.total).toBe(0);
  });

  it('tickRest() calcula leftSec/pct correctamente tras avanzar el tiempo', () => {
    startRest(90);
    now += 30000; // pasaron 30s de 90
    tickRest();
    expect(T.leftSec).toBe(60);
    expect(T.pct).toBeCloseTo(60 / 90, 5);
  });

  it('shiftRest(-9999) respeta el piso de 5 segundos', () => {
    startRest(90);
    now += 80000; // quedan 10s
    shiftRest(-9999);
    expect(T.end).toBe(now + 5000);
  });

  it('shiftRest(+N) sube T.total cuando el nuevo restante supera al total original', () => {
    startRest(90);
    now += 80000; // quedan 10s, total sigue en 90
    shiftRest(60); // quedan 10+60=70s, que es MENOS que 90 -> total no debería subir
    expect(T.total).toBe(90);
    shiftRest(60); // ahora quedan 70+60=130s, que SÍ supera el total (90) -> debe subir
    expect(T.total).toBe(130);
  });

  it('recuperarRest() dispara terminar() si el tiempo ya venció mientras estaba en segundo plano', () => {
    startRest(90);
    now += 200000; // muy pasado el final
    recuperarRest();
    expect(T.state).toBe('ringing');
    expect(sonar).toHaveBeenCalled();
  });

  it('el alCallar de sonar() (tope de 2 min) deja T.state en hidden', () => {
    sonar.mockImplementationOnce((_texto, alCallar) => { if (alCallar) alCallar(); });
    startRest(90);
    now += 90000;
    tickRest(); // dispara terminar() -> sonar() -> mock invoca alCallar sincrónico
    expect(T.state).toBe('hidden');
  });

  it('minimizeRest/expandRest alternan el estado', () => {
    startRest(90);
    minimizeRest();
    expect(T.state).toBe('minimized');
    expandRest();
    expect(T.state).toBe('fullscreen');
  });

  it('stopRest() limpia el intervalo, llama callar() y pone hidden', () => {
    startRest(90);
    stopRest();
    expect(callar).toHaveBeenCalled();
    expect(T.int).toBeNull();
    expect(T.state).toBe('hidden');
  });

  it('tickRest() dispara terminar() cuando el tiempo se acaba', () => {
    startRest(90);
    now += 90000;
    tickRest();
    expect(T.state).toBe('ringing');
    expect(T.leftSec).toBe(0);
    expect(T.pct).toBe(0);
  });
});
