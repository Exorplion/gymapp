// Elegir la ilustración del movimiento para un ejercicio.
//
// Va EMBEBIDO en el formulario, no como sheet propio: S.sheet tiene una sola
// ranura, así que abrir un sheet desde otro reemplaza al primero y se pierde
// todo lo que hubieras escrito (nombre, series, equipo, foto).
//
// Se elige a mano una sola vez, en vez de adivinar automáticamente: la base es
// en inglés y tus ejercicios están en español, así que un emparejamiento
// automático acertaría a veces y pondría la ilustración equivocada el resto —
// y una ilustración equivocada de un ejercicio es peor que ninguna.
//
// La búsqueda arranca con el nombre de tu ejercicio ya escrito, y entiende
// vocabulario en español (ver lib/illustrations.js).
import { useEffect, useMemo, useRef, useState } from 'react';
import { searchIllus, illusUrl } from '../../lib/illustrations.js';
import { staggerReveal } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';

export default function IllusPick({ exName = '', onPick, onClose }) {
  const [q, setQ] = useState(exName);
  const results = useMemo(() => searchIllus(q), [q]);
  const gridRef = useRef(null);

  // Cada nueva búsqueda repinta la grilla entera: una entrada en cascada
  // suave marca que cambió el set de resultados, no sólo un parpadeo.
  useEffect(() => {
    if (gridRef.current) staggerReveal(gridRef.current.children);
  }, [results]);

  return (
    <>
      <div className="illus-head">
        <div className="steplabel" style={{ margin: 0 }}>Elegí la ilustración</div>
        <button type="button" className={cn('mini', 'transition-transform active:scale-90')} onClick={() => onClose?.()}>✕</button>
      </div>
      <div className="txt-mut" style={{ fontSize: 13, marginTop: 2, marginBottom: 14 }}>
        Buscá el movimiento y tocá el que corresponda. Las imágenes son de
        free-exercise-db, de dominio público.
      </div>

      <div className="field">
        <input
          type="text"
          className="w-full"
          value={q}
          placeholder="press banca, sentadilla, jalón…"
          aria-label="Buscar ilustración del movimiento"
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {results.length === 0 ? (
        <div className="card"><div className="empty" style={{ padding: 18 }}>
          <p style={{ margin: 0 }}>
            {q.trim() ? 'Nada con ese nombre. Probá con otra palabra.' : 'Escribí el nombre del movimiento.'}
          </p>
        </div></div>
      ) : (
        <div className="illus-grid" ref={gridRef}>
          {results.map(it => (
            <button
              key={it.id}
              type="button"
              className={cn('illus-opt', 'transition-transform active:scale-95')}
              onClick={() => { onPick?.(it.id); onClose?.(); }}
            >
              <img src={illusUrl(it.id)} alt="" loading="lazy" />
              <span>{it.name}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
