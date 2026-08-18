// Llevar ejercicios de un turno a otro. Un solo componente para las dos
// direcciones, porque las dos muestran lo mismo — de dónde, adónde y cuáles —
// y sólo cambia qué extremo viene fijo:
//
//   push ("Copiar a otro turno")  → origen fijo, elegís destino
//   pull ("Traer de otro turno")  → destino fijo, elegís origen
//
// Anterior A y Anterior B son la misma rutina: hasta ahora armarlas era cargar
// nueve ejercicios a mano dos veces, y cada corrección otras dos.
import { useMemo, useState } from 'react';
import { S, closeSheet } from '../../lib/state.js';
import { equipLabel, exKey } from '../../lib/equip.js';
import { copyExercises, copySourceExercises } from '../../lib/rutina-logic.js';

// Nombre a mostrar para un turno de la secuencia actual.
const slotLabel = i => S.routine[i]?.name || `Turno ${i + 1}`;

export default function CopyExercises({ mode = 'push', index }) {
  const propio = +index;
  const esPush = mode === 'push';

  // Turnos con ejercicios, que son los únicos que sirven de origen.
  const conEjercicios = S.routine.map((s, i) => i).filter(i => S.routine[i]?.exercises?.length);
  const otros = conEjercicios.filter(i => i !== propio);

  /* Destinos posibles: primero los turnos que ya tienen ejercicios —que es a
     lo que uno quiere copiar— y después los libres. Ordenados así porque la
     pregunta real casi siempre es "a cuál de mis otros turnos", no "a qué
     casillero vacío". */
  const destinos = useMemo(() => {
    const resto = S.routine.map((s, i) => i).filter(i => i !== propio);
    return [
      ...resto.filter(i => S.routine[i]?.exercises?.length),
      ...resto.filter(i => !S.routine[i]?.exercises?.length),
    ];
  }, [propio]);

  const [fuente, setFuente] = useState('actual');          // sólo en pull
  const [libId, setLibId] = useState(S.lib[0]?.id ?? null);
  const [libIndex, setLibIndex] = useState(null);
  const [origenIndex, setOrigenIndex] = useState(esPush ? propio : (otros[0] ?? null));
  const [destinoIndex, setDestinoIndex] = useState(esPush ? null : propio);
  const [sel, setSel] = useState(null);                     // null = todos
  const [modo, setModo] = useState('merge');

  const rutinaLib = S.lib.find(r => r.id === libId) || null;
  const diasLib = rutinaLib ? rutinaLib.days.map((d, i) => i).filter(i => rutinaLib.days[i]?.exercises?.length) : [];
  const libIndexActivo = libIndex != null && diasLib.includes(libIndex) ? libIndex : (diasLib[0] ?? null);

  const src = useMemo(() => (
    (!esPush && fuente === 'lib')
      ? { libId, libIndex: libIndexActivo }
      : { fromIndex: esPush ? propio : origenIndex }
  ), [esPush, fuente, libId, libIndexActivo, propio, origenIndex]);

  const disponibles = copySourceExercises(src);
  const idDe = e => e.id ?? e.name;

  const destino = esPush ? destinoIndex : propio;
  const exsDestino = destino != null ? (S.routine[destino]?.exercises || []) : [];
  const destinoOcupado = exsDestino.length > 0;
  const yaHay = new Set(exsDestino.map(exKey));

  // null = "todos los que se pueden": en merge eso excluye los repetidos, así
  // que la selección por defecto ya es la útil sin que tengas que destildar.
  const seleccion = sel ?? new Set(
    disponibles.filter(e => modo === 'replace' || !yaHay.has(exKey(e))).map(idDe),
  );
  const elegidos = disponibles.filter(e => seleccion.has(idDe(e)));

  function toggle(e) {
    const next = new Set(seleccion);
    const k = idDe(e);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSel(next);
  }

  const todosPuestos = elegidos.length === disponibles.length;
  const alternarTodos = () => setSel(todosPuestos ? new Set() : new Set(disponibles.map(idDe)));

  async function confirmar() {
    if (destino == null || !elegidos.length) return;
    await copyExercises(src, destino, elegidos.map(idDe), destinoOcupado ? modo : 'replace');
    closeSheet();
  }

  const nombreOrigen = (!esPush && fuente === 'lib')
    ? `${rutinaLib?.name || 'rutina'} · ${libIndexActivo != null ? (rutinaLib?.days[libIndexActivo]?.name || `Turno ${libIndexActivo + 1}`) : ''}`
    : slotLabel(esPush ? propio : origenIndex);

  return (
    <>
      <h2>{esPush ? 'Copiar a otro turno' : 'Traer de otro turno'}</h2>
      <div className="sheet-sub">
        {esPush
          ? <>Desde <b className="txt-blue">{nombreOrigen}</b>. El historial de cada ejercicio viaja con él.</>
          : <>Hacia <b className="txt-blue">{slotLabel(propio)}</b>. El historial de cada ejercicio viaja con él.</>}
      </div>

      {/* ---- de dónde (sólo pull) ---- */}
      {!esPush && (
        <>
          {S.lib.length > 0 && (
            <div className="seg" style={{ marginBottom: 'var(--s3)' }}>
              <button type="button" className={fuente === 'actual' ? 'on' : ''} aria-pressed={fuente === 'actual'} onClick={() => { setFuente('actual'); setSel(null); }}>Mi rutina</button>
              <button type="button" className={fuente === 'lib' ? 'on' : ''} aria-pressed={fuente === 'lib'} onClick={() => { setFuente('lib'); setSel(null); }}>Mis rutinas</button>
            </div>
          )}
          {fuente === 'actual' ? (
            <div className="field">
              <label>¿De qué turno?</label>
              {!otros.length ? (
                <div className="txt-mut" style={{ fontSize: 13.5 }}>No hay otro turno con ejercicios todavía.</div>
              ) : (
                <div className="chips">
                  {otros.map(i => (
                    <button key={i} type="button" className={`chip ${i === origenIndex ? 'blue' : ''}`} aria-pressed={i === origenIndex} onClick={() => { setOrigenIndex(i); setSel(null); }}>
                      {slotLabel(i)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="copyex-rutina">¿De qué rutina?</label>
                <select id="copyex-rutina" value={libId ?? ''} onChange={e => { setLibId(e.target.value); setLibIndex(null); setSel(null); }}>
                  {S.lib.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {diasLib.length > 0 && (
                <div className="field">
                  <label>¿De qué turno de esa rutina?</label>
                  <div className="chips">
                    {diasLib.map(i => (
                      <button key={i} type="button" className={`chip ${i === libIndexActivo ? 'blue' : ''}`} aria-pressed={i === libIndexActivo} onClick={() => { setLibIndex(i); setSel(null); }}>
                        {rutinaLib.days[i].name || `Turno ${i + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ---- adónde (sólo push) ----

           Se nombra la RUTINA y no sólo el turno. Uno no piensa "el turno 3":
           piensa "Posterior B". Con el número suelto, si no te acordás qué
           rutina vive en cada turno la pregunta no se puede contestar — y el
           lado de "traer de otro turno" ya lo mostraba así desde siempre.

           Los turnos libres se muestran igual, porque copiar a un turno vacío
           es justamente cómo se estrena una rutina nueva; van al final y
           dicen "libre", para que se lean como otra cosa. */}
      {esPush && (
        <div className="field">
          <label>¿A qué rutina?</label>
          <div className="chips col">
            {destinos.map(i => {
              const turno = S.routine[i];
              const ocupado = !!turno?.exercises?.length;
              return (
                <button
                  key={i}
                  type="button"
                  className={`chip ancho ${i === destinoIndex ? 'blue' : ''}`}
                  aria-pressed={i === destinoIndex}
                  onClick={() => { setDestinoIndex(i); setSel(null); }}
                >
                  <span className="chip-nom">{turno?.name || `Turno ${i + 1}`}</span>
                  <span className="chip-sub">
                    {ocupado ? `${turno.exercises.length} ejercicios` : 'libre'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- qué hacer con lo que ya está ---- */}
      {destino != null && destinoOcupado && (
        <div className="calcbox" style={{ marginBottom: 'var(--s3)' }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 8 }}>
            {slotLabel(destino)} ya tiene <b>{`${exsDestino.length} ejercicios`}</b>.
          </div>
          <label className="check-row" style={{ marginTop: 0 }}>
            <input type="radio" name="modo-copia" checked={modo === 'merge'} onChange={() => { setModo('merge'); setSel(null); }} />
            <span>Sumar los que falten <span className="txt-mut">— no borra nada</span></span>
          </label>
          <label className="check-row">
            <input type="radio" name="modo-copia" checked={modo === 'replace'} onChange={() => { setModo('replace'); setSel(null); }} />
            <span>Reemplazar todo <span className="txt-mut">— el turno queda igual al origen</span></span>
          </label>
        </div>
      )}

      {/* ---- cuáles ---- */}
      <div className="sect">
        Qué ejercicios
        <button
          type="button" className="btn sm ghost"
          style={{ width: 'auto', padding: '0 12px', height: 30, marginLeft: 'auto' }}
          onClick={alternarTodos}
        >
          {todosPuestos ? 'Ninguno' : 'Todos'}
        </button>
      </div>
      {!disponibles.length ? (
        <div className="card"><div className="empty" style={{ padding: 16 }}>
          <p style={{ margin: 0 }}>Ese turno no tiene ejercicios.</p>
        </div></div>
      ) : (
        <div className="pick-list">
          {disponibles.map((e, i) => {
            const repetido = modo === 'merge' && destinoOcupado && yaHay.has(exKey(e));
            return (
              <label key={idDe(e)} className={`pick-row ${repetido ? 'dim' : ''}`}>
                <input type="checkbox" checked={seleccion.has(idDe(e))} onChange={() => toggle(e)} />
                <span className="i">{i + 1}</span>
                <span className="grow">
                  <span className="t">{e.name}</span>
                  <span className="s">
                    {equipLabel(e) && <span className="eq-tag">{equipLabel(e)}</span>}
                    {e.sets}×{e.reps}
                    {repetido && <span className="txt-warn"> · ya está</span>}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      <button type="button" className="btn" style={{ marginTop: 'var(--s3)' }} disabled={destino == null || !elegidos.length} onClick={confirmar}>
        {destino == null
          ? (esPush ? 'Elegí a dónde' : 'Elegí un turno')
          /* El destino se nombra por su rutina y no por el número de turno,
             igual que en la lista de arriba: "al Posterior A" es lo que uno
             tiene en la cabeza, "al turno 3" te obliga a traducir. */
          : `${esPush ? 'Copiar' : 'Traer'} ${elegidos.length} ejercicio${elegidos.length === 1 ? '' : 's'}${esPush ? ` a ${slotLabel(destino)}` : ''}`}
      </button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={closeSheet}>Cancelar</button>
    </>
  );
}
