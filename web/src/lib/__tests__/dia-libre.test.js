// Que un día declarado libre apague el "ENTRENAR" de Inicio.
//
// El bug de Enzo era literal: el botón "No entrené ese día" sólo cerraba el
// sheet. La parte de estado se prueba en state.test.js (setDiaLibre /
// esDiaLibre); lo que falta cubrir es la CADENA DE ESTADOS de Inicio, que es
// un if/else adentro del componente.
//
// Se lee el JSX como texto, igual que a11y-markup.test.js y por la misma
// razón: montar Inicio pediría @testing-library, jsdom y un IndexedDB falso
// para responder algo que se ve mirando el orden de los branches. Lo que se
// fija acá es el ORDEN, que es justamente lo que se puede romper sin querer
// al tocar el componente: si el branch de "toca entrenar" quedara ANTES del
// de día libre, el bug volvería tal cual.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const leer = ruta => readFileSync(new URL(ruta, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'utf8');

describe('Inicio deja de pedir entrenar en un día libre', () => {
  const src = leer('../../components/screens/Inicio.jsx');

  it('consulta esDiaLibre para el día de hoy', () => {
    expect(src).toMatch(/esDiaLibre\(dstr\(\)\)/);
  });

  it('el branch de día libre va ANTES del que muestra ENTRENAR', () => {
    const libre = src.indexOf('} else if (libreHoy) {');
    const entrenar = src.indexOf("} else if (slot?.type === 'workout'");
    expect(libre).toBeGreaterThan(-1);
    expect(entrenar).toBeGreaterThan(libre);
  });

  it('pero deja una salida: se puede entrenar igual', () => {
    const bloque = src.slice(src.indexOf('} else if (libreHoy) {'), src.indexOf("} else if (slot?.type === 'workout'"));
    expect(bloque).toContain('ENTRENAR IGUAL');
  });

  it('un día libre no se reclama después con "¿Entrenaste el...?"', () => {
    expect(src).toMatch(/sinRegistro\s*=\s*dias\.filter\([^)]*!esDiaLibre\(d\.fecha\)/);
  });
});

describe('MarcarDia guarda la decisión, no la descarta', () => {
  const src = leer('../../components/sheets/MarcarDia.jsx');

  it('el botón de día libre persiste con setDiaLibre, no sólo cierra el sheet', () => {
    expect(src).toContain('setDiaLibre(fecha, !libre)');
  });

  it('ofrece quitar la marca cuando el día ya está declarado libre', () => {
    expect(src).toContain('Quitar día libre');
  });

  it('el descarte es un "Cerrar" aparte', () => {
    expect(src).toMatch(/onClick=\{closeSheet\}[^]*Cerrar/);
  });
});
