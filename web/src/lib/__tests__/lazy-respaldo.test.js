// Un módulo que se carga aparte y es sólo decorativo no puede tirar la pantalla
// si no llega (lib/lazy-respaldo.js). Caso real: el estallido de récord
// (PrBurst) no se pudo bajar tras una publicación y la vista de la sesión
// recién guardada quedó en "Algo se rompió en esta pantalla".
import { describe, it, expect } from 'vitest';
import { importarConRespaldo } from '../lazy-respaldo.js';

const Respaldo = () => null;

describe('importarConRespaldo', () => {
  it('si el import funciona, devuelve el módulo tal cual', async () => {
    const Real = () => null;
    const mod = await importarConRespaldo(() => Promise.resolve({ default: Real }), Respaldo);
    expect(mod.default).toBe(Real);
  });

  it('si el import falla, devuelve el respaldo en vez de rechazar', async () => {
    const err = new TypeError('Failed to fetch dynamically imported module: .../PrBurst-BFgPSmMD.js');
    const mod = await importarConRespaldo(() => Promise.reject(err), Respaldo);
    expect(mod.default).toBe(Respaldo);
  });
});
