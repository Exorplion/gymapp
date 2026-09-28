// El estallido de récord (pr-burst.json) trae el azul de la paleta vieja y un
// dorado escritos adentro del JSON. PrBurst los cambia al montar por el acento
// y la llama: si el JSON cambia y deja de coincidir, el estallido vuelve a
// salir azul sin avisar. Esto lo vigila.
import { describe, it, expect } from 'vitest';
import prBurst from '../../assets/lottie/pr-burst.json';
import { recolorearLottie, AZUL_LOTTIE, DORADO_LOTTIE, rgbALottie } from '../lottie-color.js';

const colores = json => {
  const out = [];
  (function andar(n) {
    if (Array.isArray(n)) n.forEach(andar);
    else if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) {
      if (k === 'c' && v && Array.isArray(v.k)) out.push(v.k);
      else andar(v);
    }
  })(json);
  return out;
};

describe('recolorearLottie', () => {
  const acento = rgbALottie('73,207,252'), llama = rgbALottie('255,196,107');
  const nuevo = recolorearLottie(prBurst, [[AZUL_LOTTIE, acento], [DORADO_LOTTIE, llama]]);

  it('el JSON original trae los dos colores que se reemplazan', () => {
    const c = colores(prBurst).map(k => k.join());
    expect(c.filter(k => k === AZUL_LOTTIE.join()).length).toBe(4);
    expect(c.filter(k => k === DORADO_LOTTIE.join()).length).toBe(5);
  });

  it('no queda ni un azul ni un dorado: todo es acento o llama', () => {
    const c = colores(nuevo).map(k => k.join());
    expect(c.filter(k => k === acento.join()).length).toBe(4);
    expect(c.filter(k => k === llama.join()).length).toBe(5);
    expect(c.length).toBe(9);
  });

  it('no toca el JSON importado (se usa en cada montaje)', () => {
    expect(colores(prBurst).map(k => k.join())).toContain(AZUL_LOTTIE.join());
  });

  it('rgbALottie pasa "r,g,b" a [r,g,b,1] en 0-1', () => {
    expect(rgbALottie('255,0,51')).toEqual([1, 0, 0.2, 1]);
  });
});
