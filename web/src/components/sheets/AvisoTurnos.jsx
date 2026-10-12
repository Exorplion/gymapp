// El aviso de la unificación de turnos (turnos universales, Fase 1).
//
// Sale UNA vez, al arrancar, y sólo si la migración descartó una copia
// distinta de algún turno (reconciliarTurnos, lib/turnos.js). La migración
// corre sin un toque tuyo y por eso no puede bajar el archivo sola: el
// navegador exige un toque para descargar. Este botón es ese toque. Las tres
// redes: el respaldo en Mis rutinas, las filas crudas guardadas
// (settings.rutinaAntesDeTurnos) y este archivo.
//
// Mismos patrones que SalirPrueba: diálogo (DIALOGOS en App.jsx), título,
// texto en .txt-mut, botón principal `btn ok` y la fila `.dlg-fila`.
import { closeSheet, openSheet } from '../../lib/state.js';
import { exportJSON } from '../../lib/backup.js';
import { textoAvisoTurnos } from '../../lib/turnos.js';

export default function AvisoTurnos({ aviso }) {
  const t = textoAvisoTurnos(aviso);
  return (
    <>
      <h2>{t.titulo}</h2>
      <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.5, marginBottom: 10 }}>{t.intro}</div>
      {/* Una línea por turno, como párrafos: la lista con sangría y sin
          viñetas (el reset global las saca) se leía como un solo bloque. */}
      {t.lineas.map(l => (
        <div key={l} style={{ fontSize: 'var(--t-body)', lineHeight: 1.5, marginBottom: 8 }}>{l}</div>
      ))}
      <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.5, marginBottom: 18 }}>{t.respaldo}</div>
      <button type="button" className="btn ok" onClick={() => exportJSON()}>Descargar respaldo</button>
      <div className="dlg-fila">
        <button type="button" className="btn sm ghost" onClick={() => openSheet('library')}>Ver en Mis rutinas</button>
        <button type="button" className="btn sm" onClick={closeSheet}>Entendido</button>
      </div>
    </>
  );
}
