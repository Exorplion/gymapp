// El recordatorio diario de peso: lo que se puede fijar sin un navegador de
// verdad. El push en sí (suscribirse, recibirlo con la app cerrada) sólo se
// prueba en el teléfono.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { accionDeUrl, accionDeArranque } from '../acciones.js';
import { claveABytes, suscripcionParaCopiar, VAPID_PUBLIC } from '../push.js';
import { avisoActivo } from '../notify.js';

vi.mock('../state.js', async orig => {
  const real = await orig();
  return { ...real, openSheet: vi.fn() };
});

describe('accesos directos por URL', () => {
  it('reconoce sólo las acciones de la lista', () => {
    expect(accionDeUrl('?accion=peso')).toBe('peso');
    expect(accionDeUrl('?accion=borrar-todo')).toBe(null);
    expect(accionDeUrl('?accion=__proto__')).toBe(null);
    expect(accionDeUrl('')).toBe(null);
  });

  it('al arrancar abre el formulario y limpia la URL, para que recargar no lo reabra', async () => {
    const { openSheet } = await import('../state.js');
    const hist = { replaceState: vi.fn() };
    const a = accionDeArranque({ search: '?accion=peso', pathname: '/gymapp/', hash: '' }, hist);
    expect(a).toBe('peso');
    expect(openSheet).toHaveBeenCalledWith('body-form');
    expect(hist.replaceState).toHaveBeenCalledWith(null, '', '/gymapp/');
  });
});

describe('suscripción push', () => {
  it('la clave pública VAPID decodifica a un punto P-256 sin comprimir (65 bytes, 0x04)', () => {
    const b = claveABytes(VAPID_PUBLIC);
    expect(b.length).toBe(65);
    expect(b[0]).toBe(4);
  });

  it('el código a copiar lleva sólo endpoint y claves', () => {
    const sub = { toJSON: () => ({ endpoint: 'https://push.example/abc', expirationTime: null, keys: { p256dh: 'P', auth: 'A' } }) };
    expect(JSON.parse(suscripcionParaCopiar(sub))).toEqual({ endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } });
  });

  it('una suscripción incompleta no produce un código que la Action no podría usar', () => {
    expect(suscripcionParaCopiar({ endpoint: 'x', keys: {} })).toBe(null);
    expect(suscripcionParaCopiar(null)).toBe(null);
  });
});

describe('avisos por tipo', () => {
  beforeEach(() => { S.cfg = { ...S.cfg }; delete S.cfg.avisos; });

  it('sin configurar, están todos prendidos (instalaciones viejas no tienen la clave)', () => {
    expect(avisoActivo('descanso')).toBe(true);
    expect(avisoActivo('sesion')).toBe(true);
  });

  it('se apagan de a uno', () => {
    S.cfg.avisos = { sesion: false };
    expect(avisoActivo('sesion')).toBe(false);
    expect(avisoActivo('descanso')).toBe(true);
  });

  it('`avisos: false` de un respaldo viejo apaga todo', () => {
    S.cfg.avisos = false;
    expect(avisoActivo('descanso')).toBe(false);
  });
});
