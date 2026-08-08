// Llevar ejercicios de un día a otro. Un solo componente para las dos
// direcciones, porque las dos muestran lo mismo — de dónde, adónde y cuáles —
// y sólo cambia qué extremo viene fijo:
//
//   push ("Copiar a otro día")  → origen fijo, elegís destino
//   pull ("Traer de otro día")  → destino fijo, elegís origen
//
// Anterior A y Anterior B son la misma rutina: hasta ahora armarlas era cargar
// nueve ejercicios a mano dos veces, y cada corrección otras dos.
import { useMemo, useState } from 'react';
import { S, closeSheet } from '../../lib/state.js';
import { WD, WD1, WEEK_ORDER } from '../../lib/format.js';
import { equipLabel, exKey } from '../../lib/equip.js';
import { copyExercises, copySourceExercises } from '../../lib/rutina-logic.js';

export default function CopyExercises({ mode = 'push', wd }) {
  const propio = +wd;
  const esPush = mode === 'push';

  // Días de la semana con ejercicios, que son los únicos que sirven de origen.
  const conEjercicios = WEEK_ORDER.filter(d => S.routine[d]?.exercises?.length);
  const otros = conEjercicios.filter(d => d !== propio);

  /* Destinos posibles: primero las rutinas que ya existen —que es a lo que uno
     quiere copiar— y después los días libres. Ordenados así porque la pregunta
     real casi siempre es "a cuál de mis otras rutinas", no "a qué casilla
     vacía". */
  const destinos = useMemo(() => {
    const resto = WEEK_ORDER.filter(d => d !== propio);
    return [
      ...resto.filter(d => S.routine[d]?.exercises?.length),
      ...resto.filter(d => !S.routine[d]?.exercises?.length),
    ];
  }, [propio]);

  const [fuente, setFuente] = useState('semana');          // sólo en pull
  const [libId, setLibId] = useState(S.lib[0]?.id ?? null);
  const [libWd, setLibWd] = useState(null);
  const [origenWd, setOrigenWd] = useState(esPush ? propio : (otros[0] ?? null));
  const [destinoWd, setDestinoWd] = useState(esPush ? null : propio);
  const [sel, setSel] = useState(null);                     // null = todos
  const [modo, setModo] = useState('merge');

  const rutinaLib = S.lib.find(r => r.id === libId) || null;
  const diasLib = rutinaLib ? Object.keys(rutinaLib.days).map(Number) : [];
  const libWdActivo = libWd != null && diasLib.includes(libWd) ? libWd : (diasLib[0] ?? null);

  const src = useMemo(() => (
    (!esPush && fuente === 'lib')
      ? { libId, libWd: libWdActivo }
      : { fromWd: esPush ? propio : origenWd }
  ), [esPush, fuente, libId, libWdActivo, propio, origenWd]);

  const disponibles = copySourceExercises(src);
  const idDe = e => e.id ?? e.name;

  const destino = esPush ? destinoWd : propio;
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
    ? `${rutinaLib?.name || 'rutina'} · ${libWdActivo != null ? (rutinaLib?.days[libWdActivo]?.name || WD[libWdActivo]) : ''}`
    : (S.routine[esPush ? propio : origenWd]?.name || WD[esPush ? propio : origenWd] || '—');

  return (
    <>
      <h2>{esPush ? 'Copiar a otro día' : 'Traer de otro día'}</h2>
      <div className="sheet-sub">
        {esPush
          ? <>Desde <b className="txt-blue">{nombreOrigen}</b>. El historial de cada ejercicio viaja con él.</>
          : <>Hacia <b className="txt-blue">{S.routine[propio]?.name || WD[propio]}</b>. El historial de cada ejercicio viaja con él.</>}
      </div>

      {/* ---- de dónde (sólo pull) ---- */}
      {!esPush && (
        <>
          {S.lib.length > 0 && (
            <div className="seg" style={{ marginBottom: 'var(--s3)' }}>
              <button type="button" className={fuente === 'semana' ? 'on' : ''} onClick={() => { setFuente('semana'); setSel(null); }}>Mi semana</button>
              <button type="button" className={fuente === 'lib' ? 'on' : ''} onClick={() => { setFuente('lib'); setSel(null); }}>Mis rutinas</button>
            </div>
          )}
          {fuente === 'semana' ? (
            <div className="field">
              <label>¿De qué día?</label>
              {!otros.length ? (
                <div className="txt-mut" style={{ fontSize: 13.5 }}>No hay otro día con ejercicios todavía.</div>
              ) : (
                <div className="chips">
                  {otros.map(d => (
                    <button key={d} type="button" className={`chip ${d === origenWd ? 'blue' : ''}`} onClick={() => { setOrigenWd(d); setSel(null); }}>
                      {WD1[d]} · {S.routine[d]?.name || WD[d]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="field">
                <label>¿De qué rutina?</label>
                <select value={libId ?? ''} onChange={e => { setLibId(e.target.value); setLibWd(null); setSel(null); }}>
                  {S.lib.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {diasLib.length > 0 && (
                <div className="field">
                  <label>¿De qué día de esa rutina?</label>
                  <div className="chips">
                    {diasLib.map(d => (
                      <button key={d} type="button" className={`chip ${d === libWdActivo ? 'blue' : ''}`} onClick={() => { setLibWd(d); setSel(null); }}>
                        {WD1[d]} · {rutinaLib.days[d].name || WD[d]}
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

           Se nombra la RUTINA y no sólo el día. Uno no piensa "el miércoles":
           piensa "Posterior B". Con la inicial suelta, si no te acordás qué
           rutina vive en cada día la pregunta no se puede contestar — y el lado
           de "traer de otro día" ya lo mostraba así desde siempre.

           Los días libres se muestran igual, porque copiar a un día vacío es
           justamente cómo se estrena una rutina nueva; van al final y dicen
           "libre", para que se lean como otra cosa. */}
      {esPush && (
        <div className="field">
          <label>¿A qué rutina?</label>
          <div className="chips col">
            {destinos.map(d => {
              const dia = S.routine[d];
              const ocupado = !!dia?.exercises?.length;
              return (
                <button
                  key={d}
                  type="button"
                  className={`chip ancho ${d === destinoWd ? 'blue' : ''}`}
                  onClick={() => { setDestinoWd(d); setSel(null); }}
                >
                  <span className="chip-dia">{WD1[d]}</span>
                  <span className="chip-nom">{ocupado ? (dia.name || WD[d]) : WD[d]}</span>
                  <span className="chip-sub">
                    {ocupado ? `${dia.exercises.length} ejercicios` : 'libre'}
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
            El {WD[destino].toLowerCase()} ya tiene <b>{S.routine[destino]?.name || `${exsDestino.length} ejercicios`}</b>.
          </div>
          <label className="check-row" style={{ marginTop: 0 }}>
            <input type="radio" name="modo-copia" checked={modo === 'merge'} onChange={() => { setModo('merge'); setSel(null); }} />
            <span>Sumar los que falten <span className="txt-mut">— no borra nada</span></span>
          </label>
          <label className="check-row">
            <input type="radio" name="modo-copia" checked={modo === 'replace'} onChange={() => { setModo('replace'); setSel(null); }} />
            <span>Reemplazar todo <span className="txt-mut">— el día queda igual al origen</span></span>
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
          <p style={{ margin: 0 }}>Ese día no tiene ejercicios.</p>
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
          ? (esPush ? 'Elegí a dónde' : 'Elegí un día')
          /* El destino se nombra por su rutina y no por el día, igual que en la
             lista de arriba: "al Posterior A" es lo que uno tiene en la cabeza,
             "al miércoles" te obliga a traducir. */
          : `${esPush ? 'Copiar' : 'Traer'} ${elegidos.length} ejercicio${elegidos.length === 1 ? '' : 's'}${esPush ? ` a ${S.routine[destino]?.name || WD[destino]}` : ''}`}
      </button>
      <button type="button" className="btn dim" style={{ marginTop: 10 }} onClick={closeSheet}>Cancelar</button>
    </>
  );
}
