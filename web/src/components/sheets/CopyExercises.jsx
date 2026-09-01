// Llevar ejercicios de un turno a otro. Un solo componente para las dos
// direcciones, porque las dos muestran lo mismo — de dónde, adónde y cuáles —
// y sólo cambia qué extremo viene fijo:
//
//   push ("Copiar a otro turno")  → origen fijo, elegís destino
//   pull ("Traer de otro turno")  → destino fijo, elegís origen
//
// Anterior A y Anterior B son la misma rutina: hasta ahora armarlas era cargar
// nueve ejercicios a mano dos veces, y cada corrección otras dos.
import { useEffect, useMemo, useRef, useState } from 'react';
import { S, closeSheet } from '../../lib/state.js';
import { equipLabel, exKey } from '../../lib/equip.js';
import { copyExercises, copySourceExercises } from '../../lib/rutina-logic.js';
import { bloomOpen, staggerReveal } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';
import { Button, Card } from '../ui/primitives.jsx';

// Nombre a mostrar para un turno de la secuencia actual.
const slotLabel = i => S.routine[i]?.name || `Turno ${i + 1}`;

const chipBase = 'inline-flex items-center rounded-full border border-line2 px-3.5 py-2 text-[13px] font-medium transition-colors';
const chip = on => cn(chipBase, on ? 'border-transparent bg-blue2 font-bold text-[var(--on-grad)]' : 'bg-card2 text-txt hover:border-line');

export default function CopyExercises({ mode = 'push', index }) {
  const propio = +index;
  const esPush = mode === 'push';
  const rootRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { bloomOpen(rootRef.current); }, []);

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

  useEffect(() => {
    if (listRef.current) staggerReveal(listRef.current.children);
  }, [disponibles.length, src]);

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
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">{esPush ? 'Copiar a otro turno' : 'Traer de otro turno'}</h2>
      <div className="mt-1 mb-4 text-[13px] text-mut">
        {esPush
          ? <>Desde <b className="text-blue">{nombreOrigen}</b>. El historial de cada ejercicio viaja con él.</>
          : <>Hacia <b className="text-blue">{slotLabel(propio)}</b>. El historial de cada ejercicio viaja con él.</>}
      </div>

      {/* ---- de dónde (sólo pull) ---- */}
      {!esPush && (
        <>
          {S.lib.length > 0 && (
            <div className="mb-3 inline-flex rounded-[var(--radius-r)] border border-line2 bg-card2 p-1">
              <button type="button" className={cn('rounded-[calc(var(--radius-r)-4px)] px-3.5 py-1.5 text-[13px] font-medium', fuente === 'actual' ? 'bg-blue2 text-[var(--on-grad)]' : 'text-mut')} aria-pressed={fuente === 'actual'} onClick={() => { setFuente('actual'); setSel(null); }}>Mi rutina</button>
              <button type="button" className={cn('rounded-[calc(var(--radius-r)-4px)] px-3.5 py-1.5 text-[13px] font-medium', fuente === 'lib' ? 'bg-blue2 text-[var(--on-grad)]' : 'text-mut')} aria-pressed={fuente === 'lib'} onClick={() => { setFuente('lib'); setSel(null); }}>Mis rutinas</button>
            </div>
          )}
          {fuente === 'actual' ? (
            <div className="mb-3">
              <label className="mb-1.5 block text-[13px] font-medium text-mut">¿De qué turno?</label>
              {!otros.length ? (
                <div className="text-[13.5px] text-mut">No hay otro turno con ejercicios todavía.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {otros.map(i => (
                    <button key={i} type="button" className={chip(i === origenIndex)} aria-pressed={i === origenIndex} onClick={() => { setOrigenIndex(i); setSel(null); }}>
                      {slotLabel(i)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="mb-3">
                <label htmlFor="copyex-rutina" className="mb-1.5 block text-[13px] font-medium text-mut">¿De qué rutina?</label>
                <select id="copyex-rutina" className="h-11 w-full rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 text-[15px] text-txt outline-none" value={libId ?? ''} onChange={e => { setLibId(e.target.value); setLibIndex(null); setSel(null); }}>
                  {S.lib.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {diasLib.length > 0 && (
                <div className="mb-3">
                  <label className="mb-1.5 block text-[13px] font-medium text-mut">¿De qué turno de esa rutina?</label>
                  <div className="flex flex-wrap gap-2">
                    {diasLib.map(i => (
                      <button key={i} type="button" className={chip(i === libIndexActivo)} aria-pressed={i === libIndexActivo} onClick={() => { setLibIndex(i); setSel(null); }}>
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
        <div className="mb-3">
          <label className="mb-1.5 block text-[13px] font-medium text-mut">¿A qué rutina?</label>
          <div className="flex flex-col gap-2">
            {destinos.map(i => {
              const turno = S.routine[i];
              const ocupado = !!turno?.exercises?.length;
              return (
                <button
                  key={i}
                  type="button"
                  className={cn(
                    'flex flex-col items-start rounded-[var(--radius-r)] border px-3.5 py-2.5 text-left transition-colors',
                    i === destinoIndex ? 'border-transparent bg-blue2 text-[var(--on-grad)]' : 'border-line2 bg-card2 text-txt hover:border-line',
                  )}
                  aria-pressed={i === destinoIndex}
                  onClick={() => { setDestinoIndex(i); setSel(null); }}
                >
                  <span className="text-[14px] font-semibold">{turno?.name || `Turno ${i + 1}`}</span>
                  <span className={cn('text-[12.5px]', i === destinoIndex ? 'opacity-80' : 'text-mut')}>
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
        <Card className="mb-3">
          <div className="mb-2 text-[13.5px] leading-relaxed text-txt">
            {slotLabel(destino)} ya tiene <b>{`${exsDestino.length} ejercicios`}</b>.
          </div>
          <label className="flex items-center gap-2.5 text-[13.5px] text-txt">
            <input type="radio" name="modo-copia" checked={modo === 'merge'} onChange={() => { setModo('merge'); setSel(null); }} />
            <span>Sumar los que falten <span className="text-mut">— no borra nada</span></span>
          </label>
          <label className="mt-2 flex items-center gap-2.5 text-[13.5px] text-txt">
            <input type="radio" name="modo-copia" checked={modo === 'replace'} onChange={() => { setModo('replace'); setSel(null); }} />
            <span>Reemplazar todo <span className="text-mut">— el turno queda igual al origen</span></span>
          </label>
        </Card>
      )}

      {/* ---- cuáles ---- */}
      <div className="mb-2 flex items-center text-[13px] font-semibold uppercase tracking-wide text-mut">
        Qué ejercicios
        <Button type="button" variant="ghost" size="sm" className="ml-auto h-[30px] w-auto px-3" onClick={alternarTodos}>
          {todosPuestos ? 'Ninguno' : 'Todos'}
        </Button>
      </div>
      {!disponibles.length ? (
        <Card><div className="p-4 text-center text-mut">
          <p className="m-0">Ese turno no tiene ejercicios.</p>
        </div></Card>
      ) : (
        <div ref={listRef} className="flex flex-col gap-2">
          {disponibles.map((e, i) => {
            const repetido = modo === 'merge' && destinoOcupado && yaHay.has(exKey(e));
            return (
              <label key={idDe(e)} className={cn('flex items-center gap-2.5 rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 py-2.5', repetido && 'opacity-50')}>
                <input type="checkbox" checked={seleccion.has(idDe(e))} onChange={() => toggle(e)} />
                <span className="w-5 flex-none text-[13px] text-mut">{i + 1}</span>
                <span className="grow">
                  <span className="block text-[14.5px] text-txt">{e.name}</span>
                  <span className="text-[13px] text-mut">
                    {equipLabel(e) && <span className="mr-1.5 inline-flex items-center rounded-full bg-white/8 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-mut">{equipLabel(e)}</span>}
                    {e.sets}×{e.reps}
                    {repetido && <span className="text-warn"> · ya está</span>}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      <Button type="button" className="mt-4 w-full" disabled={destino == null || !elegidos.length} onClick={confirmar}>
        {destino == null
          ? (esPush ? 'Elegí a dónde' : 'Elegí un turno')
          /* El destino se nombra por su rutina y no por el número de turno,
             igual que en la lista de arriba: "al Posterior A" es lo que uno
             tiene en la cabeza, "al turno 3" te obliga a traducir. */
          : `${esPush ? 'Copiar' : 'Traer'} ${elegidos.length} ejercicio${elegidos.length === 1 ? '' : 's'}${esPush ? ` a ${slotLabel(destino)}` : ''}`}
      </Button>
      <Button type="button" variant="ghost" className="mt-2.5 w-full" onClick={closeSheet}>Cancelar</Button>
    </div>
  );
}
