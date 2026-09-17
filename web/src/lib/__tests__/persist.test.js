import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  ensurePersisted, storageEstimate, daysSinceBackup, necesitaBackup, DIAS_AVISO_BACKUP,
} from '../persist.js';

const DIA = 86400000;
// El jueves en que Enzo abrió la app y no había nada. Fecha fija: un test que
// lee el reloj real caduca solo (ver cycle.test.js, 6b06882).
const AHORA = new Date('2026-09-17T12:00:00Z').getTime();

/** Reemplaza navigator.storage por un doble. `undefined` lo saca del todo,
    que es el caso "navegador que no tiene la API". */
function conStorage(fake) {
  vi.stubGlobal('navigator', fake === undefined ? {} : { storage: fake });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('ensurePersisted', () => {
  it('no vuelve a pedir permiso si el origen YA es persistente', async () => {
    const persist = vi.fn();
    conStorage({ persisted: async () => true, persist });
    expect(await ensurePersisted()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('pide persistencia cuando todavía no la tiene, y devuelve que se concedió', async () => {
    const persist = vi.fn(async () => true);
    conStorage({ persisted: async () => false, persist });
    expect(await ensurePersisted()).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });

  it('devuelve false —no null— cuando el navegador la DENIEGA', async () => {
    // Denegado y "no se pudo saber" son estados distintos y se muestran
    // distinto: uno es un riesgo real que hay que decirle, el otro es
    // ignorancia. Confundirlos sería inventar un dato.
    conStorage({ persisted: async () => false, persist: async () => false });
    expect(await ensurePersisted()).toBe(false);
  });

  it('devuelve null si el navegador no tiene la API', async () => {
    conStorage(undefined);
    expect(await ensurePersisted()).toBe(null);
  });

  it('devuelve null si la llamada revienta, sin propagar el error', async () => {
    // Está en el camino del arranque: si tira, la app no abre. Perder la
    // persistencia no se compara con no poder entrenar.
    conStorage({ persisted: async () => { throw new Error('contexto inseguro'); }, persist: vi.fn() });
    await expect(ensurePersisted()).resolves.toBe(null);
  });
});

describe('storageEstimate', () => {
  it('devuelve usado y cuota cuando el navegador los da', async () => {
    conStorage({ estimate: async () => ({ usage: 1024, quota: 4096 }) });
    expect(await storageEstimate()).toEqual({ usage: 1024, quota: 4096 });
  });

  it('devuelve null —nunca 0— si el navegador no expone los números', async () => {
    // Un 0 se leería como "no estás usando nada", que es justo lo contrario
    // de lo que pasó acá.
    conStorage({ estimate: async () => ({}) });
    expect(await storageEstimate()).toBe(null);
  });

  it('devuelve null si no existe la API', async () => {
    conStorage(undefined);
    expect(await storageEstimate()).toBe(null);
  });
});

describe('daysSinceBackup', () => {
  it('devuelve null para "nunca respaldó", que no es lo mismo que hoy', () => {
    expect(daysSinceBackup(null, AHORA)).toBe(null);
    expect(daysSinceBackup(undefined, AHORA)).toBe(null);
  });

  it('cuenta días enteros', () => {
    expect(daysSinceBackup(AHORA, AHORA)).toBe(0);
    expect(daysSinceBackup(AHORA - 3 * DIA, AHORA)).toBe(3);
    expect(daysSinceBackup(AHORA - 3 * DIA + 1000, AHORA)).toBe(2);
  });
});

describe('necesitaBackup', () => {
  it('no molesta a quien todavía no anotó nada', () => {
    expect(necesitaBackup(0, null, AHORA)).toBe(false);
  });

  it('avisa si hay historial y NUNCA respaldó', () => {
    expect(necesitaBackup(12, null, AHORA)).toBe(true);
  });

  it('no avisa si respaldó hace poco', () => {
    expect(necesitaBackup(12, AHORA - 2 * DIA, AHORA)).toBe(false);
  });

  it('avisa recién a los 21 días, no todos los días', () => {
    expect(necesitaBackup(12, AHORA - (DIAS_AVISO_BACKUP - 1) * DIA, AHORA)).toBe(false);
    expect(necesitaBackup(12, AHORA - DIAS_AVISO_BACKUP * DIA, AHORA)).toBe(true);
  });
});
