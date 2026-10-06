// La pestaña Entreno, rehecha el 2026-10-06 (opción A, "el riel del ciclo",
// elegida por Enzo en el lienzo "FIERRO Entreno nuevo").
//
// Enzo: "cuando vas a la pestaña de entreno deberías ver cuál es tu rutina,
// tener la opción de editarla, cuáles son tus rutinas, tus gimnasios, pero
// capaz hay algo redundante… y debajo están todas las tarjetas por los días 1
// a 7, incluyendo los de descanso. Siento que es toda una pantalla de
// scrolleo". Lo que estaba mal y cómo se arregló:
//   - El plan se decía dos veces (barras 1–7 en la hero y 7 tarjetas abajo):
//     ahora es UN riel, con los descansos como puntos.
//   - Los ejercicios vivían detrás de un acordeón por turno: ahora se ve un
//     turno a la vez, con los ejercicios abiertos. Flechas, riel o deslizar.
//   - Cuatro puertas (hero + editar + Mis rutinas + Mis gimnasios) ocupaban
//     media pantalla: ahora son el nombre con un lápiz y dos chips.
//   - "Porciones que no toca" y "Se está enfriando" eran dos avisos sueltos
//     al final: ahora son la nota de "Tu semana en series", que además dice
//     cuánto le da el plan a cada músculo.
//
// S.rutMode sigue decidiendo si se edita (templates.js y BodyMap.jsx lo
// tocan), S.rutOpen pasa a ser el TURNO ELEGIDO (índice en S.routine) y
// S.rutTab la vista (Plan / Ejercicios). El drag de ejercicios es el de
// siempre (data-sort="rut", drag.js); el orden de los turnos se cambia con
// "Mover antes / después", que llama a applyWorkoutOrder como el drag viejo.
import { memo, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { S, bump, useStore, openSheet, changeTab, wDisplay } from '../../lib/state.js';
import { exInfo, rirScheme } from '../../lib/exdb.js';
import { equipLabel } from '../../lib/equip.js';
import { catOf, blocksOf, diasTexto, daysSinceAll } from '../../lib/muscle.js';
import { gymEquipFor } from '../../lib/gyms.js';
import { flipSort } from '../../lib/drag.js';
import { abrirAsistente } from '../../lib/asistente-agregar.js';
import { cuerpo } from '../../lib/bodydata.js';
import { zonaDeForma } from '../../lib/recuperacion.js';
import { nombreZona, abreviar, haceTexto, frase, LLANO } from '../../lib/inicio.js';
import {
  routineStats, routineName, renameRoutine,
  enterEditMode, exitEditMode, addWorkoutDay, removeWorkoutDay,
  deleteExercise, moveEx, saveSlot, deloadSuggestion, deloadActivo, applyDeload, endDeload,
} from '../../lib/rutina-logic.js';
import {
  indicesDeTurnos, turnoElegido, marcaDeTurno, seriesPorZonaDeTurno, seriesSemanaDelPlan,
  huecosDeCobertura, enfriandose, minutosDeTurno, ultimaVezDeTurno, progresoDeEjercicio,
  turnosDeEjercicio, moverTurno,
} from '../../lib/entreno.js';
import { fmtD } from '../../lib/format.js';
import { Check, ChevronLeft, Copiar, Grip, Info, Mancuerna, Pencil, Rutinas, Traer, X, ArrowUp, ArrowDown, Plus } from '../Icon.jsx';
import { RutinaVacia } from '../Illustration.jsx';

const kgTxt = kg => `${wDisplay(kg)} ${S.cfg.unit}`;

/* El peso de partida declarado (ExerciseForm), sólo si está declarado: sin
   dato no se muestra nada — ni un "—" ni un 0. "desde" porque es el arranque
   de la primera sesión, no lo que levantás siempre. */
function pesoPartidaTexto(ex) {
  const kg = ex?.pesoInicialKg;
  if (typeof kg !== 'number' || kg <= 0) return null;
  return `desde ${kgTxt(kg)}`;
}

/** Lo que va debajo del nombre de un ejercicio: equipo, RIR y el último peso
    registrado (o el de partida si nunca lo hiciste). */
function subtituloEjercicio(ex, conPeso) {
  const partes = [];
  if (equipLabel(ex)) partes.push(equipLabel(ex));
  partes.push(`RIR ${rirScheme(ex.sets, ex.name).join('/')}`);
  if (conPeso) {
    const p = progresoDeEjercicio(ex.name);
    if (p) partes.push(`últ. ${kgTxt(p.kg)}`);
    else if (pesoPartidaTexto(ex)) partes.push(pesoPartidaTexto(ex));
  }
  return partes.join(' · ');
}

/** FLIP de moveEx (↑/↓): el flushSync fuerza el render que flipSort mide. */
async function handleMoveEx(index, exId, dir) {
  if (await moveEx(index, exId, dir)) flipSort(() => flushSync(() => bump()));
}

function elegir(i) { S.rutOpen = i; bump(); }

export default function Rutina() {
  useStore();
  const editing = S.rutMode === 'edit';
  const vista = !editing && S.rutTab === 'ejercicios' ? 'ejercicios' : 'plan';
  return (
    <div className="ent">
      {editing ? <CabeceraEditando /> : <Cabecera vista={vista} />}
      {vista === 'ejercicios' ? <MisEjercicios /> : <Plan editing={editing} />}
    </div>
  );
}

/* ============================ Cabecera ============================ */

function Cabecera({ vista }) {
  const st = routineStats();
  const gym = S.gyms.find(g => g.id === S.cfg.activeGym);
  const setVista = v => { S.rutTab = v === 'ejercicios' ? 'ejercicios' : 'semana'; bump(); };
  return (
    <header className="ent-cab">
      <span className="ent-ojo">Tu rutina</span>
      <div className="ent-nombre-fila">
        <h1 className="ent-nombre">{routineName()}</h1>
        <button type="button" className="ent-ico" aria-label={st.workoutCount ? 'Editar rutina' : 'Armar mi rutina'} onClick={enterEditMode}>
          <Pencil size={18} />
        </button>
      </div>
      <div className="ent-chips">
        <button type="button" className="chip" onClick={() => openSheet('library')}>
          <Rutinas size={15} /> {st.workoutCount ? 'Cambiar rutina' : 'Elegir una rutina'}
        </button>
        <button type="button" className="chip" onClick={() => openSheet('gyms')}>
          <Mancuerna size={15} /> Gimnasio <span className="ent-chip-dim">· {gym ? gym.name : 'ninguno'}</span>
        </button>
      </div>
      <div className="ent-vistas" role="tablist" aria-label="Qué ver">
        <button type="button" role="tab" aria-selected={vista === 'plan'} className={vista === 'plan' ? 'on' : ''} onClick={() => setVista('plan')}>Plan</button>
        <button type="button" role="tab" aria-selected={vista === 'ejercicios'} className={vista === 'ejercicios' ? 'on' : ''} onClick={() => setVista('ejercicios')}>Ejercicios</button>
      </div>
    </header>
  );
}

/* Editando: una franja que dice el modo y lo cierra ("Listo" confirma; con
   un ‹ delante se leía como "atrás", auditoría total E7), y el nombre de la
   rutina editable ahí mismo (pisa S.cfg.routineName, nunca crea una copia). */
function CabeceraEditando() {
  return (
    <header className="ent-cab">
      <div className="ent-ed-barra">
        <span className="ent-ed-modo">Editando</span>
        <span className="ent-ed-nota">se guarda solo</span>
        <button type="button" className="ent-listo" onClick={exitEditMode}><Check size={16} /> Listo</button>
      </div>
      <RoutineNameHeader />
    </header>
  );
}

function RoutineNameHeader() {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(routineName());
  const inputRef = useRef(null);
  useEffect(() => { if (!editingName) setName(routineName()); }, [editingName]);
  useEffect(() => { if (editingName) inputRef.current?.focus(); }, [editingName]);
  function commit() {
    setEditingName(false);
    const t = name.trim();
    if (t && t !== routineName()) renameRoutine(t);
  }
  return (
    <div className="ent-nombre-fila ent-nombre-ed">
      {editingName ? (
        <input
          ref={inputRef} className="ent-nombre-input" value={name}
          onChange={e => setName(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder="Nombre de la rutina" aria-label="Nombre de la rutina"
        />
      ) : (
        <h1 className="ent-nombre">{routineName()}</h1>
      )}
      <button type="button" className="ent-ico" aria-label="Cambiar el nombre de la rutina" onClick={() => setEditingName(v => !v)}>
        <Pencil size={18} />
      </button>
    </div>
  );
}

/* ============================== Plan ============================== */

function Plan({ editing }) {
  const turnos = indicesDeTurnos();
  const sel = turnoElegido();
  // Dirección del último cambio de turno: la entrada del turno nuevo se
  // desliza desde ese lado (CSS .ent-turno, --dx).
  const [dir, setDir] = useState(0);
  const ir = i => { if (i === sel || i < 0) return; setDir(i > sel ? 1 : -1); elegir(i); };

  if (!turnos.length && !editing) {
    return (
      <div className="card ent-vacio">
        <RutinaVacia className="big" />
        <p>Todavía no tenés rutina.</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => openSheet('library')}>Elegir una plantilla</button>
          <button type="button" className="btn ghost" onClick={enterEditMode}>Armar la mía</button>
        </div>
      </div>
    );
  }

  const slot = S.routine[sel];
  return (
    <>
      <Riel sel={sel} editing={editing} onElegir={ir} />
      {slot && (
        <Turno
          key={slot.id} slot={slot} index={sel} editing={editing} dir={dir}
          antes={turnos[turnos.indexOf(sel) - 1] ?? -1}
          despues={turnos[turnos.indexOf(sel) + 1] ?? -1}
          onIr={ir}
        />
      )}
      {!editing && (
        <>
          <DescargaFila />
          <SemanaSeries />
        </>
      )}
    </>
  );
}

/* El ciclo entero en una línea: cada entrenamiento es una parada con su
   nombre corto, cada descanso un punto. "Hoy" marca el pendiente; si el
   pendiente es un descanso, "Sigue" marca el turno que viene. */
function Riel({ sel, editing, onElegir }) {
  const st = routineStats();
  const descansos = S.routine.length - st.workoutCount;
  async function nuevo() {
    const t = await addWorkoutDay();
    elegir(S.routine.findIndex(s => s.id === t.id));
  }
  return (
    <div className="ent-riel-caja">
      <div className="ent-riel" role="tablist" aria-label="Tu ciclo de entrenamiento">
        {S.routine.map((slot, i) => {
          if (slot.type !== 'workout') {
            return <span key={slot.id} className="ent-parada libre" title="Descanso"><span className="ent-cod" aria-hidden="true" /></span>;
          }
          const marca = marcaDeTurno(i);
          return (
            <button
              type="button" role="tab" key={slot.id} aria-selected={i === sel}
              className={`ent-parada${i === sel ? ' sel' : ''}`}
              aria-label={`${slot.name || 'Turno sin nombre'}${marca === 'hoy' ? ', te toca hoy' : marca === 'sigue' ? ', es el que sigue' : ''}`}
              onClick={() => onElegir(i)}
            >
              {marca && <span className="ent-marca">{marca === 'hoy' ? 'Hoy' : 'Sigue'}</span>}
              <span className="ent-cod">{abreviar(slot.name) || i + 1}</span>
              <span className="ent-num">{i + 1}</span>
            </button>
          );
        })}
        {editing && (
          <button type="button" className="ent-parada mas" aria-label="Agregar un entrenamiento" onClick={nuevo}>
            <span className="ent-cod"><Plus size={18} /></span>
            <span className="ent-num" aria-hidden="true">&nbsp;</span>
          </button>
        )}
      </div>
      <div className="ent-riel-pie">
        <span>{st.workoutCount} {st.workoutCount === 1 ? 'entrenamiento' : 'entrenamientos'}{descansos > 0 && ` · ${descansos} ${descansos === 1 ? 'descanso' : 'descansos'}`}</span>
        <span>{editing ? 'Los descansos se acomodan solos' : `${st.sets} series por ciclo`}</span>
      </div>
    </div>
  );
}

function Turno({ slot, index, editing, dir, antes, despues, onIr }) {
  const exs = slot.exercises || [];
  const series = exs.reduce((a, e) => a + (e.sets || 0), 0);
  const marca = marcaDeTurno(index);
  const ultima = ultimaVezDeTurno(slot);
  const estado = marca === 'hoy' ? 'Te toca hoy' : marca === 'sigue' ? 'Es el que sigue'
    : ultima ? `Hecho ${haceTexto(ultima)}` : 'Todavía no lo hiciste';

  // Deslizar de costado cambia de turno (sólo mirando: editando, el gesto
  // largo es el arrastre de ejercicios).
  const toque = useRef(null);
  const onPointerDown = e => { if (!editing && e.isPrimary) toque.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = e => {
    const t = toque.current; toque.current = null;
    if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) onIr(dx < 0 ? despues : antes);
  };

  return (
    <section
      className="ent-turno" style={{ '--dx': `${dir * 22}px` }} aria-label={slot.name || 'Turno'}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { toque.current = null; }}
    >
      <div className="ent-turno-cab">
        <div className="ent-turno-tit">
          <span className={`ent-estado${marca ? ' toca' : ''}`}>{estado}</span>
          {editing ? <SlotNameInput index={index} slot={slot} /> : <h2 className="ent-turno-nombre">{slot.name || 'Sin nombre'}</h2>}
        </div>
        <div className="ent-flechas">
          <button type="button" className="ent-flecha" aria-label="Turno anterior" disabled={antes < 0} onClick={() => onIr(antes)}><ChevronLeft size={18} /></button>
          <button type="button" className="ent-flecha der" aria-label="Turno siguiente" disabled={despues < 0} onClick={() => onIr(despues)}><ChevronLeft size={18} /></button>
        </div>
      </div>

      {exs.length > 0 && (
        <div className="ent-cifras">
          <div><b>{exs.length}</b><span>{exs.length === 1 ? 'ejercicio' : 'ejercicios'}</span></div>
          <div><b>{series}</b><span>series</span></div>
          <div><b>~{minutosDeTurno(slot)}</b><span>minutos</span></div>
        </div>
      )}

      {exs.length > 0 && <MusculosDelTurno slot={slot} />}

      {exs.length === 0 && (
        <p className="ent-sin-ej">{editing ? 'Este turno todavía no tiene ejercicios.' : 'Sin ejercicios todavía. Tocá el lápiz de arriba para agregarle.'}</p>
      )}

      {editing ? <ListaEditable slot={slot} index={index} /> : <ListaEjercicios slot={slot} index={index} />}

      {editing && <AccionesTurno slot={slot} index={index} antes={antes} despues={despues} />}
    </section>
  );
}

/* Frente y espalda con las zonas que trabaja el turno encendidas (más luz,
   más series) y al lado las cinco con más series. Memo por la firma de
   series: no se redibuja el cuerpo en cada bump de la pantalla. */
function MusculosDelTurno({ slot }) {
  const zonas = seriesPorZonaDeTurno(slot);
  const firma = zonas.map(z => z.join(':')).join('|') + '#' + (S.cfg.bodySex || S.cfg.profile?.sex || '');
  const max = Math.max(1, ...zonas.map(z => z[1]));
  return (
    <div className="ent-musculos">
      <CuerpoTurno firma={firma} zonas={zonas} sexo={S.cfg.bodySex || S.cfg.profile?.sex} />
      <ul className="ent-mz" aria-label="Series por músculo en este turno">
        {zonas.slice(0, 5).map(([z, v]) => (
          <li key={z} className="ent-mz-f">
            <span className="n">{nombreZona(z)}</span>
            <span className="v">{v}</span>
            <span className="b" aria-hidden="true"><i style={{ '--p': v / max }} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CuerpoTurno = memo(function CuerpoTurno({ zonas, sexo }) {
  const { frente, espalda } = cuerpo(sexo);
  const mapa = new Map(zonas);
  const max = Math.max(1, ...zonas.map(z => z[1]));
  const cara = (c, etiqueta) => (
    <svg viewBox={c.viewBox} className="ent-cara" role="img" aria-label={etiqueta}>
      {c.zonas.filter(z => !z.parche).map((z, i) => {
        const zona = z.cat && z.cat !== 'pelo' ? zonaDeForma(z.cat, z.slug) : null;
        const v = zona ? mapa.get(zona) : 0;
        const cls = z.cat === 'pelo' ? 'pelo' : v ? 'on' : 'off';
        // Un solo <path> por zona (sus trazos unidos): 40 elementos en vez
        // de 200, que se notaba al entrar a la pestaña con el CPU lento.
        return <path key={i} d={z.d.join(' ')} className={`ent-z ${cls}`} style={v ? { '--a': 0.35 + 0.65 * (v / max) } : undefined} />;
      })}
    </svg>
  );
  return (
    <div className="ent-cuerpo" aria-hidden="true">
      {cara(frente, 'Frente')}
      {cara(espalda, 'Espalda')}
    </div>
  );
}, (a, b) => a.firma === b.firma);

/* Mirando: bloques por grupo con su encabezado, cada fila abre la ficha. */
function ListaEjercicios({ slot, index }) {
  const bloques = blocksOf(slot.exercises || []);
  const enOrden = bloques.flatMap(b => b.exs);
  return (
    <div className="ent-lista">
      {bloques.map(b => (
        <div key={b.cat} className="ent-grupo">
          <div className="ent-grupo-h">
            <span>{b.cat === 'Otros' ? 'Sin grupo' : b.cat}</span>
            <span className="c">{b.exs.reduce((a, e) => a + (e.sets || 0), 0)} series</span>
          </div>
          {b.exs.map(e => (
            <button
              key={e.id} type="button" className="ent-ex" style={{ '--i': enOrden.indexOf(e) }}
              onClick={() => openSheet('ex-info', { name: e.name, wd: index, exId: e.id })}
            >
              <span className="ent-ex-n">{enOrden.indexOf(e) + 1}</span>
              <span className="ent-ex-m">
                <span className="ent-ex-t">{e.name}</span>
                <span className="ent-ex-s">{subtituloEjercicio(e, true)}</span>
              </span>
              <span className="ent-ex-p">{e.sets}<i>×</i>{e.reps}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/* Editando: lista PLANA (data-sort="rut" exige hijos directos con data-sid,
   drag.js), con el encabezado del grupo dentro de la primera fila de cada
   bloque. Tocar una fila abre SUS acciones; antes cada fila llevaba cuatro
   botones siempre a la vista y la lista se volvía ilegible. Mantener
   presionado la arrastra, como siempre. */
function ListaEditable({ slot, index }) {
  const [abierta, setAbierta] = useState(null);
  const exs = slot.exercises || [];
  const bloques = blocksOf(exs);
  const enOrden = bloques.flatMap(b => b.exs);
  if (!exs.length) return null;
  return (
    <>
      {exs.length > 1 && <p className="ent-pista">Tocá un ejercicio para ver sus acciones. Mantenelo presionado para moverlo.</p>}
      <div className="ent-lista ed" data-sort="rut" data-wd={index}>
        {enOrden.map((ex, i, arr) => {
          const primero = i === 0 || catOf(arr[i - 1]) !== catOf(ex);
          const ultimoDelGrupo = i === arr.length - 1 || catOf(arr[i + 1]) !== catOf(ex);
          const ab = abierta === ex.id;
          return (
            <div
              key={ex.id} data-sid={ex.id} className={`ent-exe${ab ? ' ab' : ''}${primero ? ' primero' : ''}`}
              role="button" tabIndex={0} aria-expanded={ab}
              onClick={e => { if (!e.target.closest('.ent-bandeja')) setAbierta(ab ? null : ex.id); }}
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setAbierta(ab ? null : ex.id); } }}
            >
              {primero && (
                <div className="ent-grupo-h">
                  <span>{catOf(ex) || 'Sin grupo'}</span>
                  <span className="c">{bloques.find(b => b.cat === (catOf(ex) || 'Otros'))?.exs.reduce((a, e) => a + (e.sets || 0), 0)} series</span>
                </div>
              )}
              <span className="ent-agarre" aria-hidden="true"><Grip /></span>
              <span className="ent-ex-m">
                <span className="ent-ex-t">{ex.name}</span>
                <span className="ent-ex-s">{subtituloEjercicio(ex, false)}</span>
              </span>
              <span className="ent-ex-p">{ex.sets}<i>×</i>{ex.reps}</span>
              <div className="ent-bandeja">
                <div>
                  {/* ↑↓ mueven dentro del grupo (moveEx): en el borde del grupo
                      no hay a dónde, así que se apagan. */}
                  <button type="button" className="ent-acc" data-act="ex-up" aria-label={`Subir ${ex.name}`} disabled={primero} onClick={() => handleMoveEx(index, ex.id, -1)}><ArrowUp size={16} /></button>
                  <button type="button" className="ent-acc" data-act="ex-down" aria-label={`Bajar ${ex.name}`} disabled={ultimoDelGrupo} onClick={() => handleMoveEx(index, ex.id, 1)}><ArrowDown size={16} /></button>
                  <button type="button" className={`ent-acc${exInfo(ex.name) ? '' : ' sin-ficha'}`} data-act="ex-info" aria-label={`Qué trabaja ${ex.name}`} onClick={() => openSheet('ex-info', { name: ex.name, wd: index, exId: ex.id })}><Info size={16} /> Ficha</button>
                  <button type="button" className="ent-acc" aria-label={`Editar ${ex.name}`} onClick={() => openSheet('ex-form', { wd: index, ex })}><Pencil size={15} /> Editar</button>
                  <button type="button" className="ent-acc rojo" aria-label={`Quitar ${ex.name}`} onClick={() => deleteExercise(index, ex.id)}><X size={15} /> Quitar</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* Agregar, copiar entre turnos (Anterior A y B son la misma rutina: sin esto
   había que cargar los mismos nueve ejercicios dos veces), mover el turno en
   el ciclo y sacarlo. */
function AccionesTurno({ slot, index, antes, despues }) {
  const exs = slot.exercises || [];
  async function mover(d) {
    const i = await moverTurno(slot.id, d);
    if (i != null) elegir(i);
  }
  return (
    <div className="ent-acciones">
      <button type="button" className="btn ghost" onClick={() => abrirAsistente(index, 'rutina')}><Plus size={18} /> Agregar ejercicio</button>
      <div className="ent-dos">
        <button type="button" className="btn sm dim" disabled={!exs.length} onClick={() => openSheet('copy-exs', { mode: 'push', wd: index })}><Copiar /> Copiar a otro</button>
        <button type="button" className="btn sm dim" onClick={() => openSheet('copy-exs', { mode: 'pull', wd: index })}><Traer /> Traer de otro</button>
      </div>
      <div className="ent-dos">
        <button type="button" className="btn sm dim" disabled={antes < 0} onClick={() => mover(-1)}><ChevronLeft size={16} /> Mover antes</button>
        <button type="button" className="btn sm dim ent-btn-der" disabled={despues < 0} onClick={() => mover(1)}>Mover después <ChevronLeft size={16} /></button>
      </div>
      <button type="button" className="ent-quitar" onClick={() => removeWorkoutDay(slot.id)}>Quitar {slot.name || 'este turno'} del ciclo</button>
    </div>
  );
}

/** Nombre de turno editable in situ: estado local, se guarda al perder el
    foco o con Enter. */
function SlotNameInput({ index, slot }) {
  const [name, setName] = useState(slot.name || '');
  useEffect(() => { setName(slot.name || ''); }, [slot.id, slot.name]);
  function commit() {
    const t = name.trim();
    if (t !== (slot.name || '')) saveSlot(index, { name: t });
  }
  return (
    <input
      className="ent-turno-input" value={name}
      onChange={e => setName(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      placeholder="Nombre del turno" aria-label={`Nombre del turno ${index + 1}`}
    />
  );
}

/* ======================= Debajo del turno ======================= */

/* Deload (Plan Fierro · Fase 3): un estado con principio y fin; terminarlo
   devuelve cada ejercicio a sus series. La fila no es un botón entero:
   tocarla no puede aplicar una descarga por accidente. */
function DescargaFila() {
  const activo = deloadActivo();
  const grupos = deloadSuggestion();
  if (!activo && !grupos.length) return null;
  return (
    <div className="group ent-descarga">
      {activo ? (
        <div className="grouprow grouprow-estado">
          <span className="nav-card-ico ok" aria-hidden="true"><Check /></span>
          <span className="grouprow-grow">
            <span className="grouprow-t">Descarga en curso</span>
            <span className="grouprow-s">Desde el {fmtD(activo.desde)}: {activo.grupos.join(', ')}. Al terminar, cada ejercicio vuelve a sus series.</span>
          </span>
          <button type="button" className="chip" onClick={endDeload}>Terminar</button>
        </div>
      ) : (
        <div className="grouprow grouprow-estado">
          <span className="nav-card-ico warn" aria-hidden="true"><Info /></span>
          <span className="grouprow-grow">
            <span className="grouprow-t">Descarga sugerida</span>
            <span className="grouprow-s">{grupos.join(', ')}: 3+ semanas en tu volumen máximo. Una semana con 40-50% menos series suele restaurar el progreso.</span>
          </span>
          <button
            type="button" className="chip warn"
            aria-label={`Aplicar la descarga a ${grupos.length === 1 ? grupos[0] : `estos ${grupos.length} grupos`}`}
            onClick={() => applyDeload(grupos)}
          >Aplicar</button>
        </div>
      )}
    </div>
  );
}

/** "Tríceps cabeza larga" dentro de Tríceps se dice "la cabeza larga". */
function porcion(cat, f) {
  const sin = f.toLowerCase().startsWith(`${cat.toLowerCase()} `) ? f.slice(cat.length).trim() : '';
  return sin ? `la ${sin.toLowerCase()}` : f.toLowerCase();
}

const TOPE = 22; // escala de las barras: un poco más que el techo de la franja 10–20

/** Cuánto trabaja tu PLAN cada músculo por semana, contra la franja de 10–20
    series que suele rendir; y, en la nota, lo que la rutina no toca. */
function SemanaSeries() {
  const { filas, factor, dias, sinEntrenar } = seriesSemanaDelPlan();
  if (!filas.length) return null;
  const tope = Math.max(TOPE, ...filas.map(f => f.series));
  const bajos = filas.filter(f => f.series < 10).map(f => LLANO[f.zona] || f.zona);
  const huecos = huecosDeCobertura();
  const frios = enfriandose();
  const dias10 = daysSinceAll();
  return (
    <section className="ent-sec" aria-label="Tu semana en series">
      <h2 className="sect">Tu semana en series</h2>
      <div className="card ent-semana" style={{ '--franja-a': 10 / tope, '--franja-b': 20 / tope }}>
        {factor !== 1 && <p className="ent-semana-sub">Tu ciclo dura {dias} días; acá está llevado a 7.</p>}
        {filas.map(f => (
          <div key={f.zona} className="ent-sem-f">
            <span className="n">{nombreZona(f.zona)}</span>
            <span className="ent-barra" aria-hidden="true"><span className="franja" /><i className={f.series < 10 ? 'bajo' : ''} style={{ '--p': f.series / tope }} /></span>
            <span className="v">{f.series}</span>
          </div>
        ))}
        <div className="ent-sem-ley"><i aria-hidden="true" />10 a 20 series por semana es lo que suele rendir</div>
        {(bajos.length > 0 || huecos.length > 0 || frios.length > 0 || sinEntrenar.length > 0) && (
          <div className="ent-nota">
            {bajos.length > 0 && <p>Por debajo de 10: <b>{frase(bajos)}</b>.</p>}
            {huecos.map(h => <p key={h.cat}><b>{h.cat}</b>: ningún ejercicio llega a {frase(h.faltan.map(f => porcion(h.cat, f)))}.</p>)}
            {sinEntrenar.length > 0 && <p>No entrena: {frase(sinEntrenar.map(z => LLANO[z] || z))}.</p>}
            {frios.slice(0, 3).map(c => (
              <p key={c} className="ent-frio">
                <span><b>{c}</b>: {diasTexto(dias10[c])} sin entrenar.</span>
                <button type="button" className="chip warn" onClick={() => changeTab('hoy')}>+ Hoy</button>
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================== Ejercicios =========================== */

/** Cada ejercicio distinto de tu rutina, una sola vez, por grupo: en qué
    turnos está, tu último peso y cuánto cambió. Sale de S.routine, así que
    nunca se desincroniza de lo que entrenás. El gimnasio vive acá: decide
    con qué máquina hacés cada ejercicio. */
function MisEjercicios() {
  const vistos = new Map();
  for (const slot of S.routine) for (const ex of slot.exercises || []) {
    const k = ex.name.trim().toLowerCase();
    if (!vistos.has(k)) vistos.set(k, ex);
  }
  const bloques = blocksOf([...vistos.values()]);
  const gym = S.gyms.find(g => g.id === S.cfg.activeGym);

  if (!vistos.size) {
    return <p className="ent-sin-ej">Armá tu rutina primero: acá van a aparecer sus ejercicios.</p>;
  }

  return (
    <>
      <div className="ent-gym">
        <Mancuerna size={18} />
        <span className="grow">{gym ? <>Máquinas de <b>{gym.name}</b></> : 'Sin gimnasio elegido'}</span>
        <button type="button" className="chip" onClick={() => openSheet('gyms')}>{gym ? 'Cambiar' : 'Elegir'}</button>
      </div>
      <div className="ent-lista">
        {bloques.map(b => (
          <div key={b.cat} className="ent-grupo">
            <div className="ent-grupo-h">
              <span>{b.cat === 'Otros' ? 'Sin grupo' : b.cat}</span>
              <span className="c">{b.exs.length} {b.exs.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
            </div>
            {b.exs.map((ex, i) => {
              const p = progresoDeEjercicio(ex.name);
              const ov = gym ? gymEquipFor(gym.id, ex.name) : null;
              return (
                <div key={ex.id} className="ent-ej" style={{ '--i': i }}>
                  <button type="button" className="ent-ej-main" onClick={() => openSheet('ex-info', { name: ex.name, exId: ex.id })}>
                    <span className="ent-ex-t">{ex.name}</span>
                    <span className="ent-ej-en">
                      {turnosDeEjercicio(ex.name).map(t => <span key={t.id} className="ent-tag">{abreviar(t.name)}</span>)}
                      {equipLabel(ex) && <span className="ent-ej-eq">{equipLabel(ex)}</span>}
                    </span>
                  </button>
                  <div className="ent-ej-kg">
                    {p ? (
                      <>
                        <b>{kgTxt(p.kg)}</b>
                        {p.delta != null && (
                          <span className={p.delta > 0 ? 'sube' : p.delta < 0 ? 'baja' : ''}>
                            {p.delta > 0 ? `+${wDisplay(p.delta)}` : p.delta < 0 ? `−${wDisplay(-p.delta)}` : 'igual'} en {p.semanas} sem
                          </span>
                        )}
                      </>
                    ) : <span>sin registro</span>}
                    {gym && (
                      <button type="button" className={`gym-eq-btn${ov ? ' on' : ''}`} onClick={() => openSheet('gym-equip', { gymId: gym.id, gymName: gym.name, exName: ex.name })}>
                        {ov ? <><Check size={13} /> propio</> : '+ equipo'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
