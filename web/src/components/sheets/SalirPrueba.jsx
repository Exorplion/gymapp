// Salir del modo prueba sin perder nada (2026-09-29).
//
// Enzo entrenó de verdad el domingo 27 y el lunes 28 estando en el modo
// prueba, y al salir la copia se borró con esas dos sesiones adentro: la
// pastilla del header pedía una confirmación genérica y Ajustes → "Salir y
// descartar la copia" ni siquiera eso. Ahora las dos salidas —y la pregunta
// "¿Seguís en modo prueba?" cuando la app se abre otro día— pasan por esta
// hoja, que dice qué tiene la copia que tus datos reales no, y ofrece
// pasarlo o descartarlo a sabiendas.
import { useEffect, useState } from 'react';
import { closeSheet } from '../../lib/state.js';
import { fmtDFull, fmtNum } from '../../lib/format.js';
import { toast } from '../../lib/toast.js';
import { enModoPrueba, resumenPrueba, salirModoPrueba, seguirEnPrueba, textoResumen } from '../../lib/modoPrueba.js';

/** El aviso de "esto queda en la copia", para los momentos en que se
    registra algo: terminar una sesión, anotar un día pasado. Fuera del modo
    prueba no pinta nada. */
export function AvisoPrueba({ children }) {
  if (!enModoPrueba()) return null;
  return (
    <div className="calcbox warn" role="note" style={{ marginTop: 0, marginBottom: 'var(--s3)', fontSize: 'var(--t-sm)', lineHeight: 1.45 }}>
      {children || <>Estás en la <b>copia de prueba</b>: esto no llega a tus datos reales hasta que salgas y elijas pasarlo.</>}
    </div>
  );
}

/** El marco ámbar alrededor de toda la app mientras se está en la copia
    (styles.css, .marco-prueba). Decorativo para el lector de pantalla: el
    estado ya lo dice la pastilla del header, que es un botón con nombre. */
export function MarcoPrueba() {
  if (!enModoPrueba()) return null;
  return (
    <div className="marco-prueba" aria-hidden="true">
      <span className="marco-prueba-rot">PRUEBA</span>
    </div>
  );
}

/** Lo que se ve: separado de la carga para poder probarlo sin IndexedDB. */
export function ResumenSalida({ dif, motivo, ocupado = false, onPasar, onDescartar, onSeguir }) {
  const titulo = motivo === 'otro-dia' ? '¿Seguís en modo prueba?' : 'Salir del modo prueba';
  if (!dif) {
    return (
      <>
        <h2>{titulo}</h2>
        <div className="txt-mut" style={{ fontSize: 14, lineHeight: 1.5 }}>Revisando lo que registraste en la prueba…</div>
      </>
    );
  }
  const hayAlgo = dif.sesiones.length + dif.pesos.length + dif.comidas.length > 0;
  return (
    <>
      <h2>{titulo}</h2>
      {motivo === 'otro-dia' && (
        <div className="txt-mut" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>
          La app sigue en la <b>copia de prueba</b> desde otro día. Lo que anotes acá no llega a tus datos reales.
        </div>
      )}
      <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: hayAlgo ? 8 : 18 }}>{textoResumen(dif)}</div>
      {hayAlgo && (
        <ul className="txt-mut" style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 14px', paddingLeft: 18 }}>
          {dif.sesiones.map(s => <li key={s.id}>{s.dayName || 'Entrenamiento'} · {fmtDFull(s.date)}</li>)}
          {dif.pesos.map(b => <li key={b.id}>Peso{b.weight != null ? ` ${fmtNum(b.weight)} kg` : ''} · {fmtDFull(b.date)}</li>)}
          {dif.comidas.length > 0 && <li>{dif.comidas.length} {dif.comidas.length === 1 ? 'comida' : 'comidas'}</li>}
        </ul>
      )}
      {dif.enCurso && (
        <div className="calcbox warn" role="note" style={{ marginTop: 0, marginBottom: 14, fontSize: 'var(--t-sm)', lineHeight: 1.45 }}>
          Hay una sesión en curso en la prueba. Si es de verdad, completala antes de salir: una sesión abierta no se pasa.
        </div>
      )}
      {hayAlgo ? (
        <>
          <button type="button" className="btn ok" disabled={ocupado} onClick={onPasar}>Pasarlas a mis datos reales</button>
          <div className="dlg-fila">
            <button type="button" className="btn sm ghost" disabled={ocupado} onClick={onSeguir}>
              {motivo === 'otro-dia' ? 'Sí, sigo probando' : 'Seguir en prueba'}
            </button>
            <button type="button" className="btn sm danger" disabled={ocupado} onClick={onDescartar}>Descartarlas</button>
          </div>
        </>
      ) : (
        <div className="dlg-fila">
          <button type="button" className="btn sm ghost" disabled={ocupado} onClick={onSeguir}>
            {motivo === 'otro-dia' ? 'Sí, sigo probando' : 'Seguir en prueba'}
          </button>
          <button type="button" className="btn sm" disabled={ocupado} onClick={onDescartar}>Salir</button>
        </div>
      )}
    </>
  );
}

export default function SalirPrueba({ motivo }) {
  const [dif, setDif] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    resumenPrueba().then(d => { if (vivo) setDif(d); }).catch(e => {
      console.error('[FIERRO] no se pudo comparar la prueba con tus datos:', e);
      // Sin resumen no se ofrece descartar a ciegas: se dice y se sigue en prueba.
      toast('No pude revisar la copia de prueba. Seguís en prueba; probá de nuevo.');
      closeSheet();
    });
    return () => { vivo = false; };
  }, []);

  async function salir(pasar) {
    setOcupado(true);
    try {
      await salirModoPrueba({ pasar: pasar ? dif : null });
    } catch (e) {
      console.error('[FIERRO] no se pudo salir del modo prueba:', e);
      toast(e.message || 'No se pudo salir del modo prueba');
      setOcupado(false);
    }
  }

  return (
    <ResumenSalida
      dif={dif}
      motivo={motivo}
      ocupado={ocupado}
      onPasar={() => salir(true)}
      onDescartar={() => salir(false)}
      onSeguir={() => { seguirEnPrueba(); closeSheet(); }}
    />
  );
}
