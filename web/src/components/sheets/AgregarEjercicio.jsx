// Asistente "Agregar ejercicio" en 3 pasos (spec 2026-09-27 §1, maqueta 01,
// opción A). Reemplaza al CreateWizard de ExerciseForm (rutina) y al modo
// agregar de SessionExercise (sesión abierta): un solo flujo para lo mismo.
//
//   ① ¿Qué ejercicio?   ② ¿Dónde va?   ③ ¿Cómo lo hacés?
//
// Toda la lógica vive en lib/asistente-agregar.js (probada sin montar nada):
// este componente sólo pinta ese estado y llama a esas funciones. Lo único
// propio de acá es la coreografía: el paso entra deslizándose de costado
// (--ease-push; "‹" desliza al revés), la barra de 3 segmentos se llena, y la
// fila nueva del paso 2 se arrastra con el mismo drag.js del resto de la app.
//
// Va a pantalla completa (Sheet variante "pantalla") y cada paso entra sin
// scroll a 390×844 y 430×932: si la lista del turno no entra, se recorta
// alrededor del nuevo (recortar()) en vez de scrollear.
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { closeSheet } from '../../lib/state.js';
import { MUSCLE_CATS, catOf } from '../../lib/muscle.js';
import { vibrate } from '../../lib/format.js';
import { toast } from '../../lib/toast.js';
import { flipSort, setAsistDrop } from '../../lib/drag.js';
import { menosMovimiento } from '../../lib/motion.js';
import { interceptarHoja } from '../../lib/atras.js';
import {
  PASOS, NUEVO, estadoInicial, setNombre, setGrupo, setCampo, ajustar, necesitaGrupo,
  avanzar, volver, rangoReps, textoCTA, autocompletar, catalogoDe, teFaltaHoy,
  contextoRutina, contextoSesion, moverNuevo, soltarEn, listaPaso2, confirmarAgregar,
  abrirAsistente,
} from '../../lib/asistente-agregar.js';
import EquipIcon from '../EquipIcon.jsx';
import { EQUIP_ASIST } from '../../lib/equip.js';
import { X, ChevronLeft, ArrowUp, ArrowDown, Grip, Spark, Check, Plus, Minus, Sides } from '../Icon.jsx';

const TITULOS = ['¿Qué ejercicio?', '¿Dónde va?', '¿Cómo lo hacés?'];

const ctxDe = (tipo, wd) => (tipo === 'sesion' ? contextoSesion(wd) : contextoRutina(wd));

/* Cuántas filas se ven alrededor del nuevo en el paso 2. A 932 px de alto
   entra una vuelta más que a 844 sin scrollear (medido en Chrome). */
const radioLista = () => (typeof innerHeight === 'number' && innerHeight >= 900 ? 4 : 3);

/** `inicial` sólo existe para los tests de markup (arrancar en el paso 2 o 3). */
export default function AgregarEjercicio({ wd, tipo = 'rutina', inicial }) {
  const [e, setE] = useState(() => inicial || estadoInicial(tipo));
  const [dir, setDir] = useState(''); // '' = recién abierto: el paso no se desliza
  const [error, setError] = useState(null);
  const [explorar, setExplorar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const raizRef = useRef(null);
  const tituloRef = useRef(null);
  const inputRef = useRef(null);
  const primerPaso = useRef(true);
  const focoAlAbrir = useRef(!inicial);

  const ctx = ctxDe(tipo, wd);

  /* El arrastre de la fila nueva: drag.js avisa el orden que quedó en la
     caja y soltarEn lo traduce a una posición válida. Si la ajustó (rutina:
     la soltaste fuera de su bloque), el FLIP la lleva al borde válido. */
  useEffect(() => {
    setAsistDrop((ids, limpiar) => {
      const aplicar = () => { limpiar?.(); flushSync(() => setE(prev => soltarEn(prev, ctxDe(tipo, wd), ids))); };
      if (menosMovimiento()) aplicar();
      else flipSort(aplicar, raizRef.current || document);
    });
    return () => setAsistDrop(null);
  }, [tipo, wd]);

  /* Foco: al abrir, en el campo (paso 1 vacío); al cambiar de paso, en el
     título — quien navega con lector de pantalla oye la pregunta nueva. */
  useEffect(() => {
    if (focoAlAbrir.current) inputRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (primerPaso.current) { primerPaso.current = false; return; }
    tituloRef.current?.focus({ preventScroll: true });
  }, [e.paso]);

  /* Siempre sobre el estado más reciente (setE con función): dos toques
     seguidos en el mismo cuadro no se pisan entre sí. */
  function cambiar(f) { setE(prev => (typeof f === 'function' ? f(prev) : f)); setError(null); }

  function siguiente() {
    const r = avanzar(e);
    if (r.error) { setError(r.error); vibrate([10, 40, 10]); return; }
    inputRef.current?.blur();
    setDir('r'); cambiar(r.estado);
  }

  function atras() { setDir('l'); cambiar(volver); }

  /* El volver de Android / del navegador hace lo mismo que "‹": un paso
     atrás. En el paso 1 no se ocupa y la hoja se cierra como cualquier otra.
     Refs para no volver a registrar en cada render. */
  const pasoRef = useRef(e.paso);
  pasoRef.current = e.paso;
  const atrasRef = useRef(atras);
  atrasRef.current = atras;
  useEffect(() => interceptarHoja(() => {
    if (pasoRef.current <= 1) return false;
    atrasRef.current();
    return true;
  }), []);

  async function agregar() {
    if (guardando) return;
    setGuardando(true);
    const nuevo = await confirmarAgregar(e, wd);
    if (!nuevo) { setGuardando(false); setError('No se pudo agregar. Probá de nuevo.'); return; }
    closeSheet();
    // addSessionExercise ya vibra; saveExercise (rutina) no.
    if (tipo !== 'sesion') vibrate(15);
    toast(`${nuevo.name} agregado`, { actionLabel: 'Agregar otro', onAction: () => abrirAsistente(wd, tipo) });
  }

  function moverFlecha(d) {
    const aplicar = () => flushSync(() => setE(prev => moverNuevo(prev, ctxDe(tipo, wd), d)));
    vibrate(6);
    if (menosMovimiento()) aplicar();
    else flipSort(aplicar, raizRef.current || document);
  }

  const turno = ctx.nombreTurno || (tipo === 'sesion' ? 'Sesión de hoy' : 'Turno');

  return (
    <div className="asist" ref={raizRef} data-paso={e.paso}>
      <header className="asist-top">
        {e.paso === 1 ? (
          <button type="button" className="asist-x" aria-label="Cerrar" onClick={closeSheet}><X size={18} /></button>
        ) : (
          <button type="button" className="asist-x" aria-label="Volver al paso anterior" onClick={atras}><ChevronLeft size={20} /></button>
        )}
        <div
          className="asist-prog" role="progressbar" aria-valuemin={1} aria-valuemax={PASOS} aria-valuenow={e.paso}
          aria-label={`Paso ${e.paso} de ${PASOS}`}
        >
          {Array.from({ length: PASOS }, (_, i) => <i key={i} className={i < e.paso ? 'on' : ''} />)}
        </div>
      </header>

      <div key={e.paso} className={`asist-step${dir ? ` dir-${dir}` : ''}`}>
        <div className="asist-eyebrow">
          <span>Paso {e.paso} de {PASOS}</span>
          <span className="asist-turno">{turno}</span>
        </div>
        <h2 className="plan-title asist-h" ref={tituloRef} tabIndex={-1}>{TITULOS[e.paso - 1]}</h2>
        {e.paso === 1 && (
          <Paso1 e={e} ctx={ctx} cambiar={cambiar} explorar={explorar} setExplorar={setExplorar} inputRef={inputRef} siguiente={siguiente} />
        )}
        {e.paso === 2 && <Paso2 e={e} ctx={ctx} tipo={tipo} cambiar={cambiar} moverFlecha={moverFlecha} />}
        {e.paso === 3 && <Paso3 e={e} tipo={tipo} cambiar={cambiar} />}
      </div>

      <footer className="asist-pie">
        {error && <p className="asist-error" role="alert">{error}</p>}
        {tipo === 'sesion' && e.paso === PASOS && !error && <p className="asist-nota">Vale sólo para hoy · tu rutina no cambia</p>}
        <button type="button" className="btn asist-cta" disabled={guardando} onClick={e.paso < PASOS ? siguiente : agregar}>
          {e.paso < PASOS ? 'Siguiente' : textoCTA(tipo)}
        </button>
      </footer>
    </div>
  );
}

/* ---------- ① ¿Qué ejercicio? ---------- */
function Paso1({ e, ctx, cambiar, explorar, setExplorar, inputRef, siguiente }) {
  const { name } = e.form;
  const nombres = [...ctx.fijos, ...ctx.movibles].map(x => x.name);
  const ac = autocompletar(name, 4);
  const falta = teFaltaHoy(ctx);
  const pideGrupo = necesitaGrupo(e.form);
  const elegido = n => name.trim().toLowerCase() === n.toLowerCase();

  // Lo que muestra la fila de sugerencias: el catálogo del grupo que se está
  // explorando, o lo que le falta al turno.
  const sug = explorar
    ? { titulo: `Explorar · ${explorar}`, items: catalogoDe(explorar, nombres).slice(0, 6) }
    : falta ? { titulo: `Te falta hoy · ${falta.cat}`, items: falta.ejercicios } : null;

  const chip = n => (
    <button
      key={n} type="button" className={`chip${elegido(n) ? ' blue' : ''}`} aria-pressed={elegido(n)}
      onClick={() => cambiar(x => setNombre(x, n))}
    >
      {n}
    </button>
  );

  return (
    <div className="asist-cuerpo">
      <div className="field asist-campo">
        <input
          ref={inputRef}
          className="asist-input"
          aria-label="Nombre del ejercicio"
          placeholder="Buscá o escribí uno"
          autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="next"
          value={name}
          onChange={ev => { const v = ev.target.value; cambiar(x => setNombre(x, v)); }}
          onKeyDown={ev => { if (ev.key === 'Enter') siguiente(); }}
        />
        {name && (
          <button type="button" className="asist-limpiar" aria-label="Borrar el nombre" onClick={() => { cambiar(x => setNombre(x, '')); inputRef.current?.focus(); }}>
            <X size={16} />
          </button>
        )}
      </div>

      {ac.length > 0 && (
        <div className="chips asist-chips" role="group" aria-label="Del catálogo">{ac.map(chip)}</div>
      )}

      {pideGrupo && (
        <section className="asist-sec" aria-labelledby="asist-grupo">
          <h3 className="asist-lbl" id="asist-grupo">¿Qué grupo entrena?</h3>
          <div className="chips asist-chips">
            {MUSCLE_CATS.map(c => (
              <button
                key={c} type="button" className={`chip${e.form.cat === c ? ' on' : ''}`} aria-pressed={e.form.cat === c}
                onClick={() => cambiar(x => setGrupo(x, x.form.cat === c ? '' : c))}
              >
                {c}
              </button>
            ))}
          </div>
        </section>
      )}

      {sug && sug.items.length > 0 && (
        <section className="asist-sec" aria-labelledby="asist-sug">
          <h3 className="asist-lbl" id="asist-sug">{sug.titulo}</h3>
          <div key={explorar || 'falta'} className="chips asist-chips asist-aparece">{sug.items.map(chip)}</div>
        </section>
      )}

      {!pideGrupo && (
        <section className="asist-sec" aria-labelledby="asist-exp">
          <h3 className="asist-lbl" id="asist-exp">Explorar</h3>
          <div className="chips asist-chips">
            {MUSCLE_CATS.map(c => (
              <button
                key={c} type="button" className={`chip${explorar === c ? ' on' : ''}`} aria-pressed={explorar === c}
                onClick={() => setExplorar(explorar === c ? null : c)}
              >
                {c}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- ② ¿Dónde va? ---------- */
const ESTADO_FIJO = { hecho: 'hecho', 'en-curso': 'en curso', salteado: 'salteado' };

function Paso2({ e, ctx, tipo, cambiar, moverFlecha }) {
  const L = listaPaso2(e, ctx, { radio: radioLista() });
  const { recorte } = L;
  const fijos = recorte.visibles.filter(f => f.fijo);
  const movs = recorte.visibles.filter(f => !f.fijo);
  const grupo = f => catOf(f) || f.cat || '';

  return (
    <div className="asist-cuerpo">
      <p className="asist-sug">
        <Spark className="asist-sug-ico" />
        <span>{L.sugerida.texto}</span>
      </p>
      <div className="asist-pista">
        <span>Mantenelo apretado para arrastrarlo, o usá las flechas.</span>
        {!L.enSugerida && (
          <button type="button" className="asist-link" onClick={() => cambiar(x => ({ ...x, posicion: null }))}>Volver al sugerido</button>
        )}
      </div>

      <div className="asist-lista">
        {recorte.arriba > 0 && <div className="asist-mas">+{recorte.arriba} antes</div>}
        {fijos.map(f => (
          <div key={f.id} className="asist-fila fijo">
            <span className="n">{f.estado === 'hecho' ? <Check size={14} /> : f.n}</span>
            <span className="t">{f.name}</span>
            <span className="g">{ESTADO_FIJO[f.estado] || grupo(f)}</span>
          </div>
        ))}
        {tipo === 'sesion' && fijos.length > 0 && movs.length > 0 && <div className="asist-grp">Lo que falta</div>}
        <div className="asist-caja" data-sort="asist" style={{ '--lift': 1.04 }}>
          {movs.map(f => (f.id === NUEVO ? (
            <div key={f.id} className="asist-fila nuevo" data-sid={f.id}>
              <span className="n">{f.n}</span>
              <span className="t"><span className="sr-only">Nuevo: </span>{f.name}</span>
              <span className="asist-flechas">
                <button type="button" className="mini" aria-label="Subir" disabled={!L.puedeSubir} onClick={() => moverFlecha(-1)}><ArrowUp /></button>
                <button type="button" className="mini" aria-label="Bajar" disabled={!L.puedeBajar} onClick={() => moverFlecha(1)}><ArrowDown /></button>
              </span>
              <Grip className="asist-grip" />
            </div>
          ) : (
            <div key={f.id} className="asist-fila" data-sid={f.id} data-fijo="">
              <span className="n">{f.n}</span>
              <span className="t">{f.name}</span>
              <span className="g">{grupo(f)}</span>
            </div>
          )))}
        </div>
        {recorte.abajo > 0 && <div className="asist-mas">+{recorte.abajo} más</div>}
      </div>
    </div>
  );
}

/* ---------- ③ ¿Cómo lo hacés? ---------- */
function Paso3({ e, tipo, cambiar }) {
  const { sets, reps, equip, unilateral } = e.form;
  const rango = rangoReps(reps);
  return (
    <div className="asist-cuerpo">
      <div className="asist-steppers">
        <Stepper
          etiqueta="Series" valor={sets} texto={String(sets)} unidad="de trabajo"
          menos="Menos series" mas="Más series" min={sets <= 1} max={sets >= 10}
          onMenos={() => cambiar(x => ajustar(x, 'sets', -1))} onMas={() => cambiar(x => ajustar(x, 'sets', 1))}
        />
        <Stepper
          etiqueta="Reps" valor={reps} texto={rango.texto} unidad="doble progresión"
          menos="Menos repeticiones" mas="Más repeticiones" min={reps <= 1} max={reps >= 50}
          onMenos={() => cambiar(x => ajustar(x, 'reps', -1))} onMas={() => cambiar(x => ajustar(x, 'reps', 1))}
        />
      </div>

      <section className="asist-sec" aria-labelledby="asist-eq-t">
        <h3 className="asist-lbl" id="asist-eq-t">Con qué</h3>
        <div className="asist-eq" role="radiogroup" aria-labelledby="asist-eq-t">
          {EQUIP_ASIST.map(q => (
            <button
              key={q.id || 'otro'} type="button" role="radio" aria-checked={equip === q.id} aria-label={q.nombre}
              onClick={() => { vibrate(6); cambiar(x => setCampo(x, 'equip', q.id)); }}
            >
              <EquipIcon id={q.id} size={24} />
              <span>{q.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="group asist-uni">
        <button type="button" className="grouprow" role="switch" aria-checked={unilateral} onClick={() => cambiar(x => setCampo(x, 'unilateral', !x.form.unilateral))}>
          <Sides className="opc-ico" />
          <span className="grouprow-grow">
            <span className="grouprow-t">Unilateral</span>
            <span className="grouprow-s">Un lado por vez · izq / der</span>
          </span>
          <span className="grouprow-v">{unilateral ? 'Sí' : 'No'}</span>
        </button>
      </div>

      <p className="asist-despues">
        {tipo === 'sesion'
          ? 'La máquina y la foto se cargan después, desde la tarjeta.'
          : 'Peso de partida, máquina y foto se cargan después, desde editar.'}
      </p>
    </div>
  );
}

function Stepper({ etiqueta, valor, texto, unidad, menos, mas, min, max, onMenos, onMas }) {
  return (
    <div className="card asist-stp">
      <div className="asist-lbl">{etiqueta}</div>
      <div className="asist-stp-v" aria-live="polite">
        <b key={valor} className="asist-num">{texto}</b>
        <small>{unidad}</small>
      </div>
      <div className="asist-stp-b">
        <button type="button" aria-label={menos} disabled={min} onClick={onMenos}><Minus size={18} /></button>
        <button type="button" aria-label={mas} disabled={max} onClick={onMas}><Plus size={18} /></button>
      </div>
    </div>
  );
}
