// La portada (rehecha el 2026-10-01).
//
// Enzo: "en la pantalla de inicio yo debería ver lo importante para un usuario
// de gimnasio: la rutina que le toca hoy, el porcentaje de recuperación de sus
// músculos junto con sus días de descanso… la información no debería ser
// redundante, al contrario, debería ser de valor". Y "cuando abrís te muestra
// en un texto grande la rutina, yo lo entiendo pero una persona externa capaz
// no". Maqueta aprobada para mostrar en el lienzo "FIERRO Inicio nuevo".
//
// Cuatro bloques, cada uno contesta UNA pregunta:
//   1. Hoy:            ¿qué me toca, qué trabaja y puedo hacerlo?
//   2. Recuperación:   ¿cómo están mis músculos? (frente y espalda, lib/recuperacion.js)
//   3. Semana:         ¿qué hice estos días? Cada día dice lo que fue
//                      (✓ turno, Libre, + Anotar): se entiende sin tocarlo.
//   4. Comida y peso:  lo de hoy, juntos.
//
// Lo que se fue y por qué: la tarjeta de racha (ya está arriba, en el
// encabezado), "Más flojo" (lo dice mejor el mapa de recuperación) y el botón
// grande "Ver lo que hiciste" (ahora es un enlace chico en la tarjeta de hoy).
//
// La tira de días muestra HECHOS, no el plan: la rutina de Fierro es una
// secuencia que avanza cuando entrenás, no casilleros lun-dom (rutina-logic.js).
import { memo, useEffect, useRef, useState } from 'react';
import { S, useStore, openSheet, changeTab, esDiaLibre } from '../../lib/state.js';
import { dstr, fmtKg, fmtNum, round1 } from '../../lib/format.js';
import { pendingSlot, sesionDeHoy, lifetimeTonnage, recallYearAgo } from '../../lib/session.js';
import { catOf } from '../../lib/muscle.js';
import { ultimosSieteDias } from '../../lib/week.js';
import { mealsOf } from '../../lib/meals.js';
import { weeklyAvg } from '../../lib/charts.js';
import { cuerpo } from '../../lib/bodydata.js';
import { recuperacion, zonasDeEjercicio, zonaDeForma, cuandoLista, porRegion, ZONAS } from '../../lib/recuperacion.js';
import { LLANO, nombreZona, nombreCorto, frase, capital, abreviar, haceTexto } from '../../lib/inicio.js';
import { turnoFoco, siguienteTurno } from '../../lib/turnoFoco.js';
import AnimatedText from '../AnimatedText.jsx';
import { Alerta, Check, Play, Plus, Taza } from '../Icon.jsx';
import { menosMovimiento, screenReveal, D } from '../../lib/motion.js';

const turnos = () => S.routine.filter(s => s.type === 'workout' && s.exercises?.length);
/** Minutos de la última vez que hiciste ese turno; si nunca, ~3 min por serie. */
function minutosDe(slot) {
  const ult = S.sessions.find(s => s.slotId === slot.id && s.duration);
  if (ult) return Math.round(ult.duration / 5) * 5;
  return Math.round(((slot.exercises || []).reduce((a, e) => a + (e.sets || 0), 0) * 3) / 5) * 5;
}
const seriesDeEntrada = e => (e.unilateral ? Math.ceil((e.sets || []).length / 2) : (e.sets || []).length);

export default function Inicio() {
  useStore();
  const raiz = useRef(null);
  // Entrada en cascada de los bloques al llegar a Inicio, después del
  // deslizamiento de pestaña (screenReveal espera a que termine).
  useEffect(() => {
    if (menosMovimiento()) return;
    const bloques = raiz.current?.querySelectorAll(':scope > .ini2-card');
    if (bloques?.length) screenReveal(bloques, { delayStep: D.paso, distance: 16, scale: 0.98 });
  }, []);

  const rec = recuperacion(S.sessions);
  return (
    <div className="inicio ini2" ref={raiz}>
      <HoyCard rec={rec} />
      <RecuperacionCard rec={rec} />
      <SemanaCard />
      <ComidaPesoCard />
      <MemoriaLine slot={pendingSlot()} />
    </div>
  );
}

/* ============================== 1. Hoy ============================== */

function HoyCard({ rec }) {
  const slot = pendingSlot();
  const hecha = sesionDeHoy();
  const draft = S.draft;
  const hayRutina = turnos().length > 0;
  const libreHoy = hayRutina && esDiaLibre(dstr());
  const irAHoy = () => changeTab('hoy');
  const fecha = capital(new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }));

  if (draft) {
    const turno = S.routine.find(s => s.id === draft.slotId);
    const exs = turno?.exercises || [];
    const hechos = exs.filter(e => draft.entries?.[e.id]?.sets?.length).length;
    const series = Object.values(draft.entries || {}).reduce((a, e) => a + seriesDeEntrada(e), 0);
    const sigue = exs.find(e => e.id === draft.cur) || exs.find(e => !draft.entries?.[e.id]?.sets?.length);
    const min = draft.start ? Math.max(1, Math.round((Date.now() - draft.start) / 60000)) : null;
    return (
      <section className="ini2-card ini2-hoy en-curso" aria-label="Sesión en curso">
        <div className="ini2-fila">
          <span className="ini2-rotulo acento">Entrenando ahora</span>
          {min != null && <span className="ini2-dim">{min} min</span>}
        </div>
        <div className="ini2-titulo-pila">
          <AnimatedText as="h1" className="ini2-titulo" text={turno?.name || 'Entrenando'} />
          {sigue && <p className="ini2-sub">Sigue <b>{sigue.name}</b></p>}
        </div>
        <div className="ini2-avance" aria-hidden="true" style={{ '--n': Math.max(1, exs.length) }}>
          {exs.map((e, i) => <i key={e.id} className={i < hechos ? 'on' : ''} />)}
        </div>
        <div className="ini2-dim"><b>{hechos} de {exs.length}</b> ejercicios, {series} {series === 1 ? 'serie hecha' : 'series hechas'}</div>
        <button type="button" className="ini2-cta" onClick={irAHoy}>SEGUIR</button>
      </section>
    );
  }

  if (hecha) {
    const series = (hecha.entries || []).reduce((a, e) => a + seriesDeEntrada(e), 0);
    const kg = (hecha.entries || []).reduce((a, e) => a + (e.sets || []).reduce((b, s) => b + (s.w || 0) * (s.r || 0), 0), 0);
    const manana = pendingSlot();
    return (
      <section className="ini2-card ini2-hoy hecho" aria-label="Lo que entrenaste hoy">
        <div className="ini2-fila">
          <span className="ini2-rotulo ok"><Check size={16} />Hecho hoy</span>
          <button type="button" className="ini2-enlace" onClick={() => openSheet('session-view', { id: hecha.id })}>Ver resumen ›</button>
        </div>
        <AnimatedText as="h1" className="ini2-titulo" text={hecha.dayName || 'Listo por hoy'} />
        <div className="ini2-cifras">
          <div><b>{hecha.duration}</b><span>minutos</span></div>
          <div><b>{series}</b><span>series</span></div>
          <div><b>{fmtNum(Math.round(kg))}</b><span>kg movidos</span></div>
        </div>
        {manana?.type === 'workout' && manana.exercises?.length > 0 && (
          <div className="ini2-nota">Mañana toca <b>{manana.name}</b>.</div>
        )}
      </section>
    );
  }

  if (!hayRutina) {
    return (
      <section className="ini2-card ini2-hoy" aria-label="Tu rutina">
        <span className="ini2-dim">{fecha}</span>
        <div className="ini2-titulo-pila">
          <h1 className="ini2-titulo">Sin rutina</h1>
          <p className="ini2-sub">Armá tu plan de entrenamiento y acá vas a ver qué te toca cada día.</p>
        </div>
        <button type="button" className="ini2-cta" onClick={() => changeTab('rutina')}>ARMAR MI RUTINA</button>
      </section>
    );
  }

  const esTurno = slot?.type === 'workout' && slot.exercises?.length > 0;
  const proximo = esTurno ? slot : siguienteTurno(S.cfg.seqIndex ?? 0);
  if (libreHoy || !esTurno) {
    return (
      <section className="ini2-card ini2-hoy" aria-label="Hoy">
        <span className="ini2-dim">{fecha}</span>
        <div className="ini2-titulo-pila">
          <span className="ini2-rotulo">{libreHoy ? 'Lo marcaste libre' : 'Hoy no toca entrenar'}</span>
          <h1 className="ini2-titulo">Descanso</h1>
          {proximo && <p className="ini2-sub">{proximo.name} te espera para la próxima.</p>}
        </div>
        <button type="button" className="ini2-cta dim" onClick={irAHoy}>ENTRENAR IGUAL</button>
      </section>
    );
  }

  const exs = slot.exercises;
  const grupos = [...new Set(exs.map(e => catOf(e)).filter(Boolean))].map(c => LLANO[c] || c);
  const series = exs.reduce((a, e) => a + (e.sets || 0), 0);
  const lista = turnos();
  const n = lista.findIndex(s => s.id === slot.id) + 1;
  const despues = siguienteTurno(S.cfg.seqIndex ?? 0);
  /* El aviso: la zona de HOY menos recuperada, si está por debajo del 85 %. */
  const zonasHoy = [...new Set(exs.flatMap(e => zonasDeEjercicio(e)))];
  const floja = zonasHoy.map(z => [z, rec[z]]).filter(([, r]) => r && r.pct < 85).sort((a, b) => a[1].pct - b[1].pct)[0];

  return (
    <section className="ini2-card ini2-hoy" aria-label="Lo que te toca hoy">
      <div className="ini2-fila">
        <span className="ini2-dim">{fecha}</span>
        {lista.length > 1 && n > 0 && <span className="ini2-dim">Turno {n} de {lista.length}</span>}
      </div>
      <div className="ini2-titulo-pila">
        <span className="ini2-rotulo acento">Hoy te toca</span>
        <AnimatedText as="h1" className="ini2-titulo" text={slot.name || 'Entrenamiento'} />
        {grupos.length > 0 && <p className="ini2-sub">{capital(frase(grupos))}</p>}
      </div>
      <div className="ini2-meta">
        <span><b>{exs.length}</b> {exs.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
        <span><b>{series}</b> series</span>
        <span>unos <b>{minutosDe(slot)}</b> min</span>
      </div>
      {floja && (
        <div className="ini2-aviso" role="note">
          <Alerta size={18} />
          <div>
            <b>{nombreZona(floja[0])} al {floja[1].pct} %.</b> Última vez {haceTexto(floja[1].date)}. Si hoy lo sentís cargado, sacá una serie.
          </div>
        </div>
      )}
      <button type="button" className="ini2-cta" onClick={irAHoy}><Play size={18} />ENTRENAR</button>
      {despues && despues.id !== slot.id && <div className="ini2-pie">Después sigue {despues.name}</div>}
    </section>
  );
}

/* ========================== 2. Recuperación ========================== */

/* Dos vistas (2026-10-03, opción A del lienzo "FIERRO Mapa de
   recuperación"): las zonas del turno que toca —lo que Enzo quería ver en un
   día de posterior— y las más cargadas de todas, que era lo único que había.
   "Más cargados" muestra hasta seis filas, que entran al lado del cuerpo; el
   turno muestra todas las suyas, por región (2026-10-08). */
const FILAS = 6;

function RecuperacionCard({ rec }) {
  const foco = turnoFoco();
  const [modo, setModo] = useState('turno');
  const conDato = ZONAS.filter(z => rec[z]);
  const sexo = S.cfg.bodySex || S.cfg.profile?.sex;
  const verTurno = !!foco && modo === 'turno';
  // Las sin dato van al final: no son "las más cargadas", son desconocidas.
  const porPct = (a, b) => (rec[a]?.pct ?? 101) - (rec[b]?.pct ?? 101);
  /* Con el turno van TODAS sus zonas, por región y en el orden del cuerpo
     (2026-10-08, Enzo: "debería estar más organizado"; con el tope de seis,
     trapecio y romboides de Posterior quedaban fuera). "Más cargados" sigue
     siendo un top: ahí el orden es la cifra. */
  const grupos = verTurno
    ? porRegion(foco.zonas)
    : [{ nombre: null, zonas: [...conDato].sort(porPct).slice(0, FILAS) }];
  const apagadas = verTurno ? ZONAS.filter(z => !foco.zonas.includes(z)) : [];
  // Firma por valor para el memo del cuerpo: ~560 trazos que sólo cambian
  // cuando cambia el estado de alguna zona o cuáles van apagadas.
  const firma = ZONAS.map(z => rec[z]?.estado || '-').join('|') + '#' + (sexo || '') + '#' + apagadas.join(',');
  const abrir = zona => openSheet('body-map', zona ? { zona } : undefined);
  return (
    <section className="ini2-card ini2-rec" aria-label="Cómo están tus músculos">
      <div className="ini2-fila">
        <h2 className="ini2-h2">Cómo están tus músculos</h2>
        <button type="button" className="ini2-enlace" onClick={() => abrir()}>Mapa ›</button>
      </div>
      {conDato.length === 0 ? (
        <div className="ini2-rec-vacio">
          <CuerpoRecuperacion firma={firma} rec={rec} sexo={sexo} apagadas={apagadas} />
          <p className="ini2-sub">Cuando registres tu primer entrenamiento, acá vas a ver cómo se recupera cada músculo.</p>
        </div>
      ) : (
        <>
          {foco && (
            <div className="seg ini2-rec-seg" role="group" aria-label="Qué músculos mostrar">
              <button type="button" className={verTurno ? 'on' : ''} aria-pressed={verTurno} onClick={() => setModo('turno')}>
                <span>{foco.cuando === 'hoy' ? 'Hoy' : 'Próximo'} · {foco.slot.name}</span>
              </button>
              <button type="button" className={verTurno ? '' : 'on'} aria-pressed={!verTurno} onClick={() => setModo('cargados')}>
                <span>Más cargados</span>
              </button>
            </div>
          )}
          <div className="ini2-rec-grid">
            <button type="button" className="ini2-rec-cuerpo" aria-label="Abrir el mapa del cuerpo" onClick={() => abrir()}>
              <CuerpoRecuperacion firma={firma} rec={rec} sexo={sexo} apagadas={apagadas} />
            </button>
            <div className={`ini2-rec-lista${verTurno ? ' por-region' : ''}`}>
              {grupos.map(g => (
                <div key={g.nombre || 'top'} className="ini2-rec-region" role={g.nombre ? 'group' : undefined} aria-label={g.nombre || undefined}>
                  {g.nombre && <span className="ini2-rec-region-t t-etiqueta" aria-hidden="true">{g.nombre}</span>}
                  {g.zonas.map(z => {
                    const r = rec[z];
                    return (
                      <button
                        type="button"
                        key={z}
                        className="ini2-rec-fila"
                        aria-label={r ? `${nombreZona(z)}: ${r.pct} %, ${cuandoLista(r.listaEn)}` : `${nombreZona(z)}: sin registro`}
                        onClick={() => abrir(z)}
                      >
                        <span className="ini2-rec-linea">
                          <b>{nombreCorto(z)}</b>
                          <span className={`ini2-rec-pct ${r?.estado || 'sin-dato'}`}>{r ? `${r.pct}%` : '–'}</span>
                        </span>
                        <span className={`ini2-rec-barra ${r?.estado || 'sin-dato'}`} aria-hidden="true">
                          <i style={{ transform: `scaleX(${(r?.pct ?? 0) / 100})` }} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <p className="ini2-rec-listos">{resumenRec(rec, verTurno ? foco : null, conDato)}</p>
          <div className="ini2-leyenda" aria-hidden="true">
            <span><i className="cargado" />Cargado</span>
            <span><i className="recuperando" />Recuperando</span>
            <span><i className="listo" />Listo</span>
            <span className="ini2-leyenda-nota">estimado</span>
          </div>
        </>
      )}
    </section>
  );
}

/** La línea de abajo de la tarjeta. Con turno: lo más justo de ese turno y
    cuándo llega, y qué está listo. Sin turno: qué ya está listo. */
function resumenRec(rec, foco, conDato) {
  if (foco) {
    const conRec = foco.zonas.filter(z => rec[z]).sort((a, b) => rec[a].pct - rec[b].pct);
    if (!conRec.length) return `Todavía no registraste nada de ${foco.slot.name}.`;
    const listos = conRec.filter(z => rec[z].pct >= 90).map(z => LLANO[z]);
    const justo = conRec[0];
    const cuando = foco.cuando === 'hoy' ? 'de hoy' : `de ${foco.slot.name}`;
    let t = rec[justo].pct >= 90
      ? `Todo lo ${cuando} está listo.`
      : `Lo más justo ${cuando}: ${LLANO[justo]}, ${cuandoLista(rec[justo].listaEn)}.`;
    if (listos.length && rec[justo].pct < 90) t += ` ${capital(frase(listos))}, ${listos.length === 1 ? 'listo' : 'listos'}.`;
    return t;
  }
  const listos = conDato.filter(z => rec[z].pct >= 90).map(z => LLANO[z]);
  if (listos.length === conDato.length) return 'Todo lo que entrenaste está listo.';
  return listos.length ? `${capital(frase(listos))} ${listos.length === 1 ? 'ya está listo' : 'ya están listos'}.` : 'Nada está al 100 % todavía.';
}

/** Frente y espalda, cada forma pintada por el estado de su zona. Más liviano
    que el mapa (sin luz ni toques): acá sólo se mira. Las zonas `apagadas`
    (las que no son del turno que se está mirando) quedan tenues. Memo por
    la firma de estados. */
const CuerpoRecuperacion = memo(function CuerpoRecuperacion({ rec, sexo, apagadas }) {
  const { frente, espalda } = cuerpo(sexo);
  const cara = (c, etiqueta) => (
    <svg viewBox={c.viewBox} className="ini2-cuerpo-cara" role="img" aria-label={etiqueta}>
      {c.zonas.filter(z => !z.parche).map((z, i) => {
        const zona = z.cat && z.cat !== 'pelo' ? zonaDeForma(z.cat, z.slug) : null;
        const cls = z.cat === 'pelo' ? 'pelo' : zona ? (rec[zona]?.estado || 'sin-dato') : 'neutro';
        const apagada = zona && apagadas.includes(zona) ? ' apagado' : '';
        return <g key={i} className={`ini2-z ${cls}${apagada}`}>{z.d.map((d, j) => <path key={j} d={d} />)}</g>;
      })}
    </svg>
  );
  return (
    <div className="ini2-cuerpo">
      {cara(frente, 'Frente del cuerpo')}
      {cara(espalda, 'Espalda del cuerpo')}
    </div>
  );
}, (a, b) => a.firma === b.firma);

/* ============================ 3. Semana ============================ */

function SemanaCard() {
  const dias = ultimosSieteDias();
  const slot = pendingSlot();
  const entrenos = dias.filter(d => d.sesiones.length).length;
  const libres = dias.filter(d => !d.sesiones.length && !d.esFuturo && esDiaLibre(d.fecha)).length;
  const sinRegistro = dias.filter(d => !d.esFuturo && !d.esHoy && !d.sesiones.length && !esDiaLibre(d.fecha));
  const ultimoVacio = sinRegistro[sinRegistro.length - 1];
  return (
    <section className="ini2-card ini2-semana" aria-label="Tus últimos 7 días">
      <div className="ini2-fila">
        <h2 className="ini2-h2">Tus últimos 7 días</h2>
        <span className="ini2-dim"><b>{entrenos}</b> {entrenos === 1 ? 'entreno' : 'entrenos'}{libres > 0 && <>, <b>{libres}</b> {libres === 1 ? 'descanso' : 'descansos'}</>}</span>
      </div>
      <div className="ini2-dias">
        {dias.map(d => {
          const hecho = d.sesiones.length > 0;
          const libre = !hecho && esDiaLibre(d.fecha);
          const vacio = !hecho && !libre && !d.esHoy && !d.esFuturo;
          const nombre = hecho ? d.sesiones.map(x => x.dayName).filter(Boolean).join(' y ') : '';
          const estado = hecho ? 'hecho' : libre ? 'libre' : d.esHoy ? 'hoy' : d.esFuturo ? 'futuro' : 'vacio';
          const pie = hecho ? abreviar(d.sesiones[0].dayName) : libre ? 'Libre' : d.esHoy ? (slot?.type === 'workout' ? abreviar(slot.name) : 'Hoy') : vacio ? 'Anotar' : '';
          const abrir = () => {
            if (d.esFuturo) return;
            if (hecho && d.sesiones.length === 1) openSheet('session-view', { id: d.sesiones[0].id });
            else openSheet('marcar-dia', { fecha: d.fecha });
          };
          return (
            <button
              type="button"
              key={d.fecha}
              className={`ini2-dia ${estado}`}
              disabled={d.esFuturo}
              aria-current={d.esHoy ? 'date' : undefined}
              aria-label={
                hecho ? `${d.etiqueta} ${d.numero}: ${nombre}`
                  : libre ? `${d.etiqueta} ${d.numero}: día libre`
                    : d.esHoy ? `${d.etiqueta} ${d.numero}: hoy`
                      : vacio ? `${d.etiqueta} ${d.numero}: sin registrar, tocá para anotar` : `${d.etiqueta} ${d.numero}`
              }
              onClick={abrir}
            >
              <span className="ini2-dia-t">{d.esHoy ? 'Hoy' : `${d.etiqueta} ${d.numero}`}</span>
              <span className="ini2-dia-c">
                {hecho ? <Check size={18} /> : libre ? <Taza size={18} /> : vacio ? <Plus size={16} /> : d.numero}
              </span>
              <span className="ini2-dia-p">{pie}</span>
            </button>
          );
        })}
      </div>
      {ultimoVacio && (
        <p className="ini2-pista">
          ¿Entrenaste el {new Date(ultimoVacio.fecha + 'T12:00:00').toLocaleDateString('es', { weekday: 'long' })}? Tocá el <b>+</b> y anotalo.
        </p>
      )}
    </section>
  );
}

/* ========================= 4. Comida y peso ========================= */

function ComidaPesoCard() {
  const meals = mealsOf(dstr());
  const kcal = Math.round(meals.reduce((a, m) => a + (m.kcal || 0), 0));
  const prot = Math.round(meals.reduce((a, m) => a + (m.p || 0), 0));
  const metaK = S.cfg.goals?.kcal || 0;
  const metaP = S.cfg.goals?.p || 0;
  const frac = metaK ? Math.min(1, kcal / metaK) : 0;
  const C = 2 * Math.PI * 27;
  const wk = weeklyAvg();
  return (
    <section className="ini2-card ini2-comida" aria-label="Comida y peso de hoy">
      <button type="button" className="ini2-comida-izq" onClick={() => changeTab('nutri')}>
        <span className="ini2-rotulo">Comida de hoy</span>
        <span className="ini2-comida-num">
          <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="27" className="ini2-anillo-pista" />
            <circle cx="32" cy="32" r="27" className="ini2-anillo" strokeDasharray={`${frac * C} ${C}`} transform="rotate(-90 32 32)" />
          </svg>
          <span>
            <b>{fmtNum(kcal)}</b>
            <small>{metaK ? `de ${fmtNum(metaK)} kcal` : 'kcal'}</small>
          </span>
        </span>
        {metaP > 0 && <span className="ini2-dim">Proteína <b>{prot}</b> de {metaP} g</span>}
      </button>
      <div className="ini2-comida-der">
        <span className="ini2-rotulo">Peso</span>
        {wk ? (
          <>
            <span className="ini2-peso"><b>{fmtNum(round1(wk.last.weight))}</b><small> kg</small></span>
            <span className="ini2-dim ini2-peso-sub">
              {wk.curAvg != null && <>Promedio {fmtNum(round1(wk.curAvg))}</>}
              {wk.delta != null && wk.delta !== 0 && <><br />{wk.delta > 0 ? 'subiendo' : 'bajando'} {fmtNum(Math.abs(wk.delta))} por semana</>}
            </span>
          </>
        ) : (
          <span className="ini2-dim">Todavía no te pesaste</span>
        )}
        <button type="button" className="ini2-boton-sec" onClick={() => openSheet('body-form')}>+ Anotar peso</button>
      </div>
    </section>
  );
}

/** "Hace 1 año hacías esto" y el tonelaje de por vida, como pie de la portada. */
function MemoriaLine({ slot }) {
  const tonelaje = lifetimeTonnage();
  let recall = null;
  for (const ex of slot?.exercises || []) {
    const r = recallYearAgo(ex.name);
    if (r) { recall = { name: ex.name, ...r }; break; }
  }
  if (!recall && !tonelaje) return null;
  return (
    <div className="ini2-memoria">
      {recall && <div>Hace 1 año: {recall.name} {recall.sets.map(s => `${fmtNum(round1(s.w))}×${s.r}`).join(', ')} kg</div>}
      {tonelaje > 0 && (
        <button type="button" className="ini2-enlace-pie" onClick={() => openSheet('year-recap')}>
          {fmtKg(tonelaje)} levantados en total. <b>Tu Año Fierro ›</b>
        </button>
      )}
    </div>
  );
}
