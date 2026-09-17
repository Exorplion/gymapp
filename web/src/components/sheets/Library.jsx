// Puerto de sheetLibrary() + sheetLibSave(name) (index.html) — dos pantallas
// distintas en el original (dos llamadas a openSheet con HTML distinto) que
// acá se unifican en un componente con dos modos, porque el plan de Task 5
// sólo prevé un archivo Library.jsx para ambas.
//
// Reestructuración (handoff 2026-09-17, punto 1): antes había CUATRO puertas
// para conseguir una rutina, y las cuatro sólo aparecían con la rutina vacía
// — "Mis rutinas" pasó a ser la ÚNICA puerta, siempre visible (Rutina.jsx),
// y este sheet se reorganiza en tres secciones con la MISMA data para las
// tres (turnos, frecuencia): la que estás usando, las que creaste vos, y las
// plantillas. Enzo lo pidió textual: "muestra PPL dice los días y frecuencia
// y abajo está anterior posterior con la misma data".
//
// Entrar a cualquiera abre una vista previa con el contenido COMPLETO antes
// de decidir cambiarse — reemplazar el split activo es destructivo, así que
// mirar "3 días · 12 ejercicios" y confiar no alcanza. La confirmación real
// (applyLibRoutine/applyTemplate) sigue viviendo donde ya vivía, sin tocarla.
import { useEffect, useRef, useState } from 'react';
import { S, openSheet, closeSheet } from '../../lib/state.js';
import { fmtD } from '../../lib/format.js';
import { TEMPLATES, applyTemplate } from '../../lib/templates.js';
import {
  routineStats, routineName, summarizeSlots, slotsFrequencyText,
  applyLibRoutine, deleteLibRoutine, saveCurrentAsLib, startBlank,
} from '../../lib/rutina-logic.js';
import { sheetReveal } from '../../lib/motion.js';
import { X } from '../Icon.jsx';

/** Una plantilla (t.secuencia: [[nombre, [[nombre,sets,reps],...]], ...]) no
    tiene la misma forma que S.routine/S.lib — se normaliza acá nomás, sólo
    para mostrarla en la vista previa, sin tocar templates.js (applyTemplate
    ya hace esta misma conversión al aplicarla de verdad). */
/** t.days viene como "3 días/sem" (para prosa) — acá se extrae sólo el
    número para el dato corto de la fila ("3 D"), sin tocar templates.js. */
function templateDaysShort(t) {
  const n = t.days.match(/\d+/);
  return n ? `${n[0]} D` : t.days;
}

function templateSlots(t) {
  /* `list === null` es un turno de DESCANSO (ver applyTemplate en
     templates.js). Este map tiene que respetarlo o revienta con
     "null.map is not a function" y se lleva puesta la pantalla entera:
     pasó al agregar los descansos a Anterior/Posterior, y ni los tests
     ni el build lo vieron — sólo se vio abriendo la vista previa. */
  return t.secuencia.map(([name, list]) => (list === null
    ? { type: 'rest' }
    : {
        type: 'workout', name,
        exercises: list.map(([n, sets, reps]) => ({ name: n, sets, reps })),
      }
  ));
}

/** Contenido completo de un turno/plantilla — ejercicios con series×reps,
    sin agrupar por músculo (esto es un vistazo antes de decidir, no la
    pantalla de edición). */
function PeekSlots({ slots }) {
  return (
    <div className="card sub" style={{ padding: 'var(--s2) var(--s3)', marginBottom: 16 }}>
      {slots.map((s, i) => (
        <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="t">{s.type === 'rest' ? 'Descanso' : (s.name || 'Sin nombre')}</div>
            {s.type === 'workout' && (
              <div className="s">
                {(s.exercises || []).map(e => `${e.name} (${e.sets}×${e.reps})`).join(' · ') || 'sin ejercicios'}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Encabezado de resumen compartido por las tres secciones: mismo orden de
    datos (turnos de entrenamiento, de descanso, frecuencia) para que
    comparar una contra otra sea leer la misma línea tres veces, no adivinar
    qué significa cada tarjeta. */
function SlotSummaryLine({ slots }) {
  const st = summarizeSlots(slots);
  return (
    <div className="s">
      {st.workoutCount} turno{st.workoutCount === 1 ? '' : 's'} de entrenamiento · {st.restCount} de descanso · {slotsFrequencyText(slots)}
    </div>
  );
}

function LibraryList({ onPeek }) {
  const st = routineStats();
  const tmplRef = useRef(null);

  useEffect(() => {
    if (tmplRef.current) sheetReveal(tmplRef.current.children);
  }, []);

  return (
    <>
      <h2>Mis rutinas</h2>
      <div className="sheet-sub">
        La que estás usando, las que armaste vos, y plantillas listas. Tocá cualquiera para ver su contenido completo antes de cambiarte.
      </div>

      {/* 1. La que estás usando — la ÚNICA caja de la pantalla (héroe): todo
          lo demás es lista agrupada, así que el destaque se nota de verdad. */}
      <div className="eyebrow" style={{ marginBottom: 6 }}>La que estás usando</div>
      <button
        type="button"
        className="card hero cardbtn"
        style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 16 }}
        onClick={() => onPeek({ kind: 'current' })}
      >
        <div className="cond" style={{ fontSize: 18, fontWeight: 700 }}>{routineName()}</div>
        <SlotSummaryLine slots={S.routine} />
      </button>
      {st.workoutCount > 0 && (
        <button type="button" className="btn ghost" style={{ marginBottom: 16 }} onClick={() => openSheet('library', { mode: 'save' })}>
          💾 Guardar la actual como…
        </button>
      )}

      {/* 2. Las que creaste vos — misma data que "la que estás usando", para
          poder comparar un split contra otro de un vistazo (Enzo: "PPL dice
          los días y frecuencia y abajo está anterior posterior con la misma
          data"). Lista agrupada: una superficie, filas con hairline. */}
      {S.lib.length > 0 && (
        <>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Las que creaste vos</div>
          <div className="group" style={{ marginBottom: 16 }}>
            {S.lib.map(r => {
              const cur = r.name === S.cfg.routineName;
              const st2 = summarizeSlots(r.days);
              return (
                <div className="grouprow" key={r.id} style={{ paddingRight: 'var(--s2)' }}>
                  <button type="button" className="grouprow-grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => onPeek({ kind: 'lib', id: r.id })}>
                    <span className="grouprow-t">{r.name}{cur && <span className="lib-tag">en uso</span>}</span>
                    <span className="grouprow-s">{slotsFrequencyText(r.days)} · guardada {fmtD(r.savedAt)}</span>
                  </button>
                  <span className="grouprow-v">{st2.workoutCount} D</span>
                  <span className="grouprow-chev">›</span>
                  <button type="button" className="mini red" aria-label={`Borrar la rutina ${r.name}`} onClick={() => deleteLibRoutine(r.id)}><X /></button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 3. Plantillas — mismo patrón de lista agrupada. */}
      <div className="eyebrow" style={{ marginBottom: 6 }}>Plantillas</div>
      <div className="txt-mut" style={{ fontSize: 13, margin: '-2px 0 8px' }}>
        Reemplazan tu split actual. Después las editás a gusto.
      </div>
      <div className="group" ref={tmplRef} style={{ marginBottom: 16 }}>
      {TEMPLATES.map(t => (
        <button
          key={t.id}
          type="button"
          className="grouprow"
          onClick={() => onPeek({ kind: 'tmpl', id: t.id })}
        >
          <span className="grouprow-grow">
            <span className="grouprow-t">{t.name}</span>
            <span className="grouprow-s">{t.who} · {t.freq}</span>
          </span>
          <span className="grouprow-v">{templateDaysShort(t)}</span>
          <span className="grouprow-chev">›</span>
        </button>
      ))}
      </div>

      <div className="card" style={{ borderStyle: 'dashed', borderColor: 'var(--line2)' }}>
        <div className="cond" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Personalizada</div>
        <div className="txt-mut" style={{ fontSize: 13, marginBottom: 12 }}>
          Empezá de cero y armá tu propio split día por día.
        </div>
        <button type="button" className="btn sm ghost" onClick={() => openSheet('routine-wizard')}>Armar con asistente</button>
        <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={startBlank}>Empezar en blanco</button>
      </div>
    </>
  );
}

/** Vista previa de una rutina/plantilla ANTES de decidir cambiarse — la
    confirmación de reemplazo (destructiva) sigue viviendo en
    applyLibRoutine/applyTemplate, esto sólo deja ver qué hay adentro. */
function LibraryPeek({ peek, onBack }) {
  let title, slots, onUse, useLabel;
  if (peek.kind === 'current') {
    title = routineName();
    slots = S.routine;
    onUse = null; // ya es la que estás usando — no hay nada que "usar"
  } else if (peek.kind === 'lib') {
    const r = S.lib.find(x => x.id === peek.id);
    if (!r) return null;
    title = r.name;
    slots = r.days;
    onUse = () => applyLibRoutine(r.id);
    useLabel = 'Usar esta rutina';
  } else {
    const t = TEMPLATES.find(x => x.id === peek.id);
    if (!t) return null;
    title = t.name;
    slots = templateSlots(t);
    onUse = () => applyTemplate(t.id);
    useLabel = 'Usar esta plantilla';
  }

  return (
    <>
      <button type="button" className="btn sm ghost" style={{ marginBottom: 12 }} onClick={onBack}>‹ Volver</button>
      <h2>{title}</h2>
      <SlotSummaryLine slots={slots} />
      <div style={{ marginTop: 12 }}>
        <PeekSlots slots={slots} />
      </div>
      {onUse && (
        <button type="button" className="btn" onClick={onUse}>{useLabel}</button>
      )}
    </>
  );
}

function LibrarySave({ initialName }) {
  const [name, setName] = useState(initialName ?? (routineName() === 'Rutina personalizada' ? '' : routineName()));
  const inputRef = useRef(null);
  const rootRef = useRef(null);

  return (
    <div ref={rootRef}>
      <h2>Guardar rutina</h2>
      <div className="field">
        <label htmlFor="lib-nombre">Nombre</label>
        <input id="lib-nombre" ref={inputRef} value={name} onChange={e => setName(e.target.value)} placeholder="Mi rutina" />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn sm ghost" style={{ flex: 1 }} onClick={closeSheet}>Cancelar</button>
        <button type="button" className="btn sm" style={{ flex: 1 }} onClick={() => saveCurrentAsLib(name)}>Guardar</button>
      </div>
    </div>
  );
}

export default function Library({ mode = 'list', name }) {
  const [peek, setPeek] = useState(null);
  if (mode === 'save') return <LibrarySave initialName={name} />;
  if (peek) return <LibraryPeek peek={peek} onBack={() => setPeek(null)} />;
  return <LibraryList onPeek={setPeek} />;
}
