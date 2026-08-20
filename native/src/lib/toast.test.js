import { toast, subscribeToast } from './toast.js';

describe('toast.js — portado de web/src/lib/toast.js', () => {
  it('toast() no hace nada si no hay listener suscripto', () => {
    expect(() => toast('hola')).not.toThrow();
  });

  it('subscribeToast() recibe el mensaje al llamar toast()', () => {
    const recibidos = [];
    const unsub = subscribeToast(evt => recibidos.push(evt));
    toast('Guardado');
    expect(recibidos[0]).toMatchObject({ msg: 'Guardado' });
    unsub();
  });

  it('el unsubscribe corta la suscripción', () => {
    const recibidos = [];
    const unsub = subscribeToast(evt => recibidos.push(evt));
    unsub();
    toast('no debería llegar');
    expect(recibidos.length).toBe(0);
  });
});
