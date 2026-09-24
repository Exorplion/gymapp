// El gesto de volver de Android (lib/atras.js), contra un historial falso que
// se comporta como el real: pushState trunca lo que había adelante y back()
// aterriza DESPUÉS, en otro turno, con su popstate.
import { describe, it, expect, vi } from 'vitest';
import { crearAtras } from '../atras.js';

function historialFalso() {
  const h = {
    entradas: [null], i: 0, onpop: null,
    get state() { return h.entradas[h.i]; },
    pushState(st) { h.entradas.splice(h.i + 1); h.entradas.push(st); h.i++; },
    back() {
      if (h.i === 0) { h.salio = true; return; }
      queueMicrotask(() => { h.i--; h.onpop?.(h.state); });
    },
  };
  return h;
}

/** Arma la pila sobre un historial falso y simula el gesto. */
function montar() {
  const h = historialFalso();
  const a = crearAtras(h);
  h.onpop = st => a.alVolver(st);
  const gesto = async () => { h.back(); await Promise.resolve(); await Promise.resolve(); };
  return { h, a, gesto };
}

describe('gesto de volver', () => {
  it('cierra la última capa abierta en vez de salir', async () => {
    const { h, a, gesto } = montar();
    const cerrarTab = vi.fn(), cerrarHoja = vi.fn();
    a.registrar(cerrarTab);
    a.registrar(cerrarHoja);
    await gesto();
    expect(cerrarHoja).toHaveBeenCalledOnce();
    expect(cerrarTab).not.toHaveBeenCalled();
    await gesto();
    expect(cerrarTab).toHaveBeenCalledOnce();
    expect(h.salio).toBeFalsy();
    // sin capas, volver sale de la app (lo hace el sistema, no nosotros)
    await gesto();
    expect(h.salio).toBe(true);
  });

  it('cerrar por la interfaz consume su entrada: el próximo volver no queda "muerto"', async () => {
    const { h, a, gesto } = montar();
    const cerrarTab = vi.fn();
    a.registrar(cerrarTab);
    const quitarHoja = a.registrar(vi.fn());
    quitarHoja();                       // la × de la hoja
    await Promise.resolve(); await Promise.resolve();
    expect(h.i).toBe(1);                // quedó sólo la entrada de la pestaña
    await gesto();
    expect(cerrarTab).toHaveBeenCalledOnce();
  });

  it('cerrar una hoja y abrir otra en el mismo instante no se lleva la nueva', async () => {
    const { a, gesto } = montar();
    const quitar = a.registrar(vi.fn());
    quitar();                           // Ajustes se cierra…
    const cerrarPerfil = vi.fn();
    a.registrar(cerrarPerfil);          // …y Perfil se abre en el mismo tick
    await Promise.resolve(); await Promise.resolve();
    expect(cerrarPerfil).not.toHaveBeenCalled();
    expect(a.abiertas()).toBe(1);
    await gesto();
    expect(cerrarPerfil).toHaveBeenCalledOnce();
  });

  it('la limpieza es idempotente y no retrocede de más', async () => {
    const { h, a } = montar();
    const quitar = a.registrar(vi.fn());
    quitar(); quitar();
    await Promise.resolve(); await Promise.resolve();
    expect(h.i).toBe(0);
    expect(h.salio).toBeFalsy();
  });
});
