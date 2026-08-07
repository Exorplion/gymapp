import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { muestrasAlarma, PITIDOS, SR, DUR } from '../alarm.js';
import { tiempoDeSesion, resumenDeSesion } from '../ongoing.js';
import { S } from '../state.js';
import { T, startRest, stopRest, tickRest, recuperarRest, shiftRest, minimizeRest } from '../rest.js';

/** Lee el WAV como muestras con signo, salteando las 44 bytes de cabecera. */
function muestras() {
  const v = new DataView(muestrasAlarma());
  const n = (v.byteLength - 44) / 2;
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = v.getInt16(44 + i * 2, true);
  return out;
}
const pico = (m, desde, hasta) => {
  let max = 0;
  for (let i = Math.floor(desde * SR); i < Math.floor(hasta * SR); i++) max = Math.max(max, Math.abs(m[i]));
  return max;
};

describe('el WAV de la alarma', () => {
  it('es un WAV mono de 16 bits válido', () => {
    const b = muestrasAlarma();
    const v = new DataView(b);
    const txt = o => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    expect(txt(0)).toBe('RIFF');
    expect(txt(8)).toBe('WAVE');
    expect(txt(12)).toBe('fmt ');
    expect(txt(36)).toBe('data');
    expect(v.getUint16(22, true)).toBe(1);        // mono
    expect(v.getUint16(34, true)).toBe(16);       // 16 bits
    expect(v.getUint32(24, true)).toBe(SR);
    // la cabecera declara exactamente los bytes que siguen
    expect(v.getUint32(40, true)).toBe(b.byteLength - 44);
    expect(b.byteLength).toBe(44 + SR * DUR * 2);
  });

  // Éste es el test que importa: una alarma muda es el peor fallo posible,
  // porque no se nota hasta que estás en el gimnasio esperándola.
  it('suena fuerte en cada uno de los tres pitidos', () => {
    const m = muestras();
    for (const [a, b] of PITIDOS) {
      expect(pico(m, a + .02, b - .02)).toBeGreaterThan(20000);
    }
  });

  it('se queda en silencio entre pitido y pitido, y hasta el final', () => {
    const m = muestras();
    expect(pico(m, PITIDOS[0][1] + .01, PITIDOS[1][0] - .01)).toBe(0);
    expect(pico(m, PITIDOS[2][1] + .01, DUR)).toBe(0);
  });

  it('entra y sale con rampa, así no chasquea', () => {
    const m = muestras();
    const [a] = PITIDOS[0];
    // en el primer milisegundo todavía viene subiendo
    expect(pico(m, a, a + .001)).toBeLessThan(pico(m, a + .02, a + .05));
  });

  it('no satura: se mantiene dentro del rango de 16 bits', () => {
    const m = muestras();
    let max = 0;
    for (const x of m) max = Math.max(max, Math.abs(x));
    expect(max).toBeLessThanOrEqual(32767);
    expect(max).toBeGreaterThan(20000);
  });
});

describe('el reloj de descanso', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 10, 0, 0));
    S.cfg.rest = 90;
    T.state = 'hidden'; T.end = 0; T.int = null;
  });
  afterEach(() => { stopRest(); vi.useRealTimers(); });

  it('arranca en pantalla completa con el tiempo configurado', () => {
    startRest();
    expect(T.state).toBe('fullscreen');
    expect(T.leftSec).toBe(90);
  });

  it('descuenta con el reloj', () => {
    startRest();
    vi.advanceTimersByTime(30000);
    expect(T.leftSec).toBe(60);
    expect(T.state).toBe('fullscreen');
  });

  it('al llegar a cero pasa a sonando', () => {
    startRest();
    vi.advanceTimersByTime(90000);
    expect(T.state).toBe('ringing');
    expect(T.leftSec).toBe(0);
  });

  // El motivo de comparar contra T.end en vez de contar ticks: el navegador
  // frena los timers de las pestañas ocultas, así que el tick puede no llegar.
  it('recupera el vencimiento aunque no haya corrido ningún tick', () => {
    startRest();
    clearInterval(T.int); T.int = null;         // como si el navegador lo hubiera congelado
    vi.setSystemTime(Date.now() + 200000);      // volvés mucho después
    recuperarRest();
    expect(T.state).toBe('ringing');
  });

  it('si volvés antes de que venza, sigue contando', () => {
    startRest();
    clearInterval(T.int); T.int = null;
    vi.setSystemTime(Date.now() + 40000);
    recuperarRest();
    expect(T.state).toBe('fullscreen');
    expect(T.leftSec).toBe(50);
  });

  it('cortarla la deja escondida y libera el intervalo', () => {
    startRest();
    vi.advanceTimersByTime(90000);
    stopRest();
    expect(T.state).toBe('hidden');
    expect(T.int).toBe(null);
  });

  it('no vuelve a disparar si ya está sonando', () => {
    startRest();
    vi.advanceTimersByTime(90000);
    expect(T.state).toBe('ringing');
    recuperarRest();
    tickRest();
    expect(T.state).toBe('ringing');
  });

  it('sin tiempo de descanso configurado no hace nada', () => {
    S.cfg.rest = 0;
    startRest();
    expect(T.state).toBe('hidden');
  });
});

describe('el aviso de sesión en curso', () => {
  const T0 = new Date(2026, 7, 6, 10, 0, 0).getTime();
  const luego = min => T0 + min * 60000;

  it('antes del primer minuto no inventa un número', () => {
    expect(tiempoDeSesion(T0, luego(0))).toBe('recién arrancaste');
    expect(tiempoDeSesion(T0, T0 + 59000)).toBe('recién arrancaste');
  });

  it('cuenta en minutos hasta la hora', () => {
    expect(tiempoDeSesion(T0, luego(1))).toBe('1 min');
    expect(tiempoDeSesion(T0, luego(42))).toBe('42 min');
    expect(tiempoDeSesion(T0, luego(59))).toBe('59 min');
  });

  it('pasada la hora muestra horas y minutos con dos dígitos', () => {
    expect(tiempoDeSesion(T0, luego(60))).toBe('1 h 00 min');
    expect(tiempoDeSesion(T0, luego(65))).toBe('1 h 05 min');
    expect(tiempoDeSesion(T0, luego(135))).toBe('2 h 15 min');
  });

  // El cronómetro arranca al iniciar el primer ejercicio, no al abrir la
  // sesión: hasta entonces `start` es null y no hay tiempo que mostrar.
  it('sin cronómetro arrancado no muestra tiempo', () => {
    expect(tiempoDeSesion(null)).toBe('recién arrancaste');
  });

  it('resume ejercicios y series, en singular y plural', () => {
    expect(resumenDeSesion({ hechos: 1, total: 5, series: 3 })).toBe('1 de 5 ejercicios · 3 series');
    expect(resumenDeSesion({ hechos: 0, total: 1, series: 1 })).toBe('0 de 1 ejercicio · 1 serie');
  });

  it('sin series todavía, sólo nombra los ejercicios', () => {
    expect(resumenDeSesion({ hechos: 0, total: 4, series: 0 })).toBe('0 de 4 ejercicios');
  });
});

describe('ajustar el descanso en curso', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 10, 0, 0));
    S.cfg.rest = 90;
    T.state = 'hidden'; T.end = 0; T.int = null;
  });
  afterEach(() => { stopRest(); vi.useRealTimers(); });

  it('+30s alarga el descanso', () => {
    startRest();
    shiftRest(30);
    expect(T.leftSec).toBe(120);
  });

  it('−30s lo acorta', () => {
    startRest();
    shiftRest(-30);
    expect(T.leftSec).toBe(60);
  });

  // Restar más de lo que queda dispararía la alarma en el acto, que es lo
  // contrario de lo que pedís al tocar −30s.
  it('−30s con menos de 30 restantes deja un piso, no dispara la alarma', () => {
    startRest();
    vi.advanceTimersByTime(80000);   // quedan 10
    shiftRest(-30);
    expect(T.leftSec).toBe(5);
    expect(T.state).toBe('fullscreen');
  });

  it('el anillo no se pasa de vuelta al sumar tiempo', () => {
    startRest();
    shiftRest(30);
    expect(T.pct).toBeLessThanOrEqual(1);
    expect(T.total).toBeGreaterThanOrEqual(120);
  });

  it('no hace nada si ya está sonando', () => {
    startRest();
    vi.advanceTimersByTime(90000);
    expect(T.state).toBe('ringing');
    shiftRest(30);
    expect(T.state).toBe('ringing');
  });

  it('funciona igual con el timer minimizado', () => {
    startRest();
    minimizeRest();
    shiftRest(-30);
    expect(T.leftSec).toBe(60);
    expect(T.state).toBe('minimized');
  });
});
