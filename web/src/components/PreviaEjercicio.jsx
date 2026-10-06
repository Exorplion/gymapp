// La previa del ejercicio (rediseño 2026-09-27, pieza 3, maqueta 03
// opción B). Con la sesión abierta y el ejercicio sin empezar, debajo de la
// tarjeta quedaban 356–444 px vacíos; acá va lo que vale la pena leer antes
// de arrancar: la fuerza y cómo viene, el récord, cómo está el grupo y la
// meta de hoy.
//
// Todos los números salen de lib/previa.js (que a su vez usa charts, muscle
// y objetivoHoy: nada se calcula dos veces). Criterio de la app: sin dato no
// se pinta un cero ni un panel vacío — la primera vez no hay gráfico ni
// récord, y un grupo sin historial dice "sin registro".
//
// Paneles con el vidrio de la app (.card), sin clases de apariencia nuevas
// que peleen con él. Al tocar Empezar la previa sale con un fundido corto
// (AnimatePresence en ExerciseSlide) mientras la tarjeta se despliega.
import { m as motion } from 'motion/react';
import { S, wDisplay } from '../lib/state.js';
import { sparkPuntos, metaPartes, cambioTexto } from '../lib/previa.js';
import { diasTexto } from '../lib/muscle.js';
import { D, EASE_OUT, menosMovimiento } from '../lib/motion.js';

const curva = EASE_OUT.match(/[\d.]+/g).map(Number);
const TONO = { sube: 'previa-up', baja: 'previa-down', igual: '' };

/** La línea de fuerza de las últimas 8 semanas. `ancho`/`alto` son los del
    viewBox: el CSS la dibuja a ese tamaño, así el trazo no se deforma. */
export function Sparkline({ puntos, ancho = 96, alto = 38, className = 'previa-spark' }) {
  const spark = sparkPuntos(puntos, { ancho, alto });
  if (!spark) return null;
  return (
    <svg className={className} viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} aria-hidden="true" focusable="false">
      <polyline points={spark.points} />
      <circle cx={spark.ultimo.x} cy={spark.ultimo.y} r="3" />
    </svg>
  );
}

export default function PreviaEjercicio({ datos }) {
  const unidad = S.cfg.unit === 'lb' ? 'lb' : 'kg';
  const { primeraVez, fuerza, record, recuperacion, meta, sufijo } = datos;
  const cambio = cambioTexto(fuerza);
  const { numeros, porque } = metaPartes(meta, sufijo);
  const salida = menosMovimiento()
    ? undefined
    : { opacity: 0, y: 12, transition: { duration: D.objeto / 1000, ease: curva } };

  const panelRecuperacion = recuperacion && (
    <div className="card previa-panel">
      <div className="previa-k">{recuperacion.cat}</div>
      {recuperacion.dias == null ? (
        <>
          <div className="previa-big previa-nada">—</div>
          <div className="previa-s">sin registro</div>
        </>
      ) : (
        <>
          <div className="previa-big">{recuperacion.pct}<small> %</small></div>
          <div className="previa-s">
            <span className={recuperacion.pct >= 100 ? 'previa-up' : ''}>{recuperacion.pct >= 100 ? 'listo' : 'recuperado'}</span>
            {' · '}{diasTexto(recuperacion.dias)}
          </div>
        </>
      )}
    </div>
  );

  return (
    <motion.div className="previa" exit={salida}>
      {primeraVez ? (
        /* Primera vez: sin gráfico ni récord. La tarjeta ya dice "Primera
           vez"; acá va con qué arrancar, al lado del grupo. */
        <div className="previa-dos">
          <div className="card previa-panel">
            <div className="previa-k">Meta de hoy</div>
            <div className="previa-big">{numeros}</div>
            {porque && <div className="previa-s">{porque}</div>}
          </div>
          {panelRecuperacion}
        </div>
      ) : (
        <>
          {fuerza && (
            <div className="card previa-panel previa-fuerza">
              <div>
                <div className="previa-k">Tu fuerza en este ejercicio</div>
                <div className="previa-big">{wDisplay(fuerza.actual)}<small> {unidad} · 1RM est.</small></div>
                <div className={`previa-s ${cambio ? TONO[cambio.tono] : ''}`}>
                  {cambio ? cambio.texto : `última sesión ${fuerza.hace}`}
                </div>
              </div>
              <Sparkline puntos={fuerza.puntos} />
            </div>
          )}
          {(record || recuperacion) && (
            <div className="previa-dos">
              {record && (
                <div className="card previa-panel">
                  <div className="previa-k">Récord</div>
                  <div className="previa-big">{wDisplay(record.w)}<small> {unidad} × {record.r}</small></div>
                  <div className="previa-s">{record.hace}</div>
                </div>
              )}
              {panelRecuperacion}
            </div>
          )}
          <div className="card sub previa-panel previa-meta">
            <div className="previa-k">Meta de hoy</div>
            <p><b>{numeros}</b>{porque && <> · {porque}</>}</p>
          </div>
        </>
      )}
    </motion.div>
  );
}
