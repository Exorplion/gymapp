// Sheet "Tu cuerpo" (rehecho el 2026-10-03, lienzo "FIERRO Mapa de
// recuperación", aprobado por Enzo: "están perfectas").
//
// Lo que estaba mal: la tarjeta de Inicio pintaba el cuerpo por RECUPERACIÓN
// (naranja cargado, ámbar recuperando, acento listo) y al tocar "Mapa" se
// abría otra cosa: la silueta vieja, pintada por hace cuántos días entrenaste
// cada grupo, en una escala de azules. "Debería verse igual que en la tarjeta,
// en vez de todo azul… toda la información desplegada, por eso abrís el mapa."
//
// Cinco bloques, de lo que se decide hoy a lo que se mira en la semana:
//   1. Lo del turno que toca: el promedio y lo más justo, con un consejo.
//   2. El cuerpo, frente y espalda juntos, con el mismo color de la tarjeta.
//      Tocar un músculo lo marca y abre su fila.
//   3. Cómo vas a estar: el mismo modelo con el reloj adelantado (esta
//      noche, mañana, pasado) para planear sin hacer cuentas.
//   4. Músculo por músculo: todas las zonas, primero las del turno; cada fila se
//      abre con lo que hiciste (series, RIR) y las series de la semana.
//   5. Series esta semana, con la franja de 10–20 marcada.
//
// El cuerpo que giraba con el dedo (Silhouette) se queda en el resto de la
// app; acá van las dos caras a la vez porque se viene a ver TODO.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { S, closeSheet, changeTab } from '../../lib/state.js';
import { uncategorized } from '../../lib/muscle.js';
import { dstr } from '../../lib/format.js';
import { lunesDe } from '../../lib/week.js';
import { cuerpo } from '../../lib/bodydata.js';
import { recuperacion, zonasDeEjercicio, zonaDeForma, cuandoLista, seriesPorZona, cabezasTriceps, momentos, estadoDe, ZONAS } from '../../lib/recuperacion.js';
import { turnoFoco } from '../../lib/turnoFoco.js';
import { LLANO, nombreZona, frase, capital, haceTexto } from '../../lib/inicio.js';
import { sheetReveal, menosMovimiento } from '../../lib/motion.js';
import { Paradas } from '../Silhouette.jsx';

const HORA = 3600000;
/** La escala de "Series esta semana" llega al menos a 24, así la franja de
    10–20 cae siempre en el mismo lugar salvo que alguien se pase de 24. */
const ESCALA_MIN = 24;
const RANGO = [10, 20];

const rirTexto = rir => (rir == null ? null : rir < 0.5 ? 'al fallo' : `RIR ${Math.round(rir) >= 4 ? '4+' : Math.round(rir)}`);
const promedio = xs => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

export default function BodyMap({ zona = null }) {
  // El "ahora" se fija al abrir: la proyección se mide contra un reloj
  // quieto, si no las cifras cambiarían solas mientras se lee.
  const [ahora] = useState(() => Date.now());
  const ms = useMemo(() => momentos(ahora), [ahora]);
  const [m, setM] = useState(0);
  const [abierta, setAbierta] = useState(zona);
  const [sel, setSel] = useState(zona);
  const raiz = useRef(null);
  const h = ms[m].horas;
  const rec = useMemo(() => recuperacion(S.sessions, ahora + h * HORA), [ahora, h]);
  const semana = useMemo(() => seriesPorZona(S.sessions, dstr(lunesDe())), []);
  const cabezas = useMemo(() => cabezasTriceps(S.sessions, dstr(lunesDe())), []);
  const foco = turnoFoco();
  const sexo = S.cfg.bodySex || S.cfg.profile?.sex;
  const conDato = ZONAS.filter(z => rec[z]);

  useEffect(() => {
    if (menosMovimiento() || !raiz.current) return;
    sheetReveal(raiz.current.querySelectorAll(':scope > .bm-bloque'));
  }, []);

  const elegir = z => { setSel(z); setAbierta(z); };

  if (!conDato.length) {
    return (
      <div className="bm" ref={raiz}>
        <Encabezado />
        <div className="bm-bloque bm-vacio">
          <CuerpoGrande firma="vacio" rec={rec} sexo={sexo} sel={null} onPick={() => {}} />
          <p className="ptext mut">Cuando registres tu primer entrenamiento, acá vas a ver cómo se recupera cada músculo, cuándo vuelve al 100 % y cuántas series llevás en la semana.</p>
        </div>
      </div>
    );
  }

  const porPct = (a, b) => rec[a].pct - rec[b].pct;
  const focoZ = foco ? foco.zonas.filter(z => rec[z]).sort(porPct) : [];
  const base = focoZ.length ? focoZ : [...conDato].sort(porPct);
  const prom = promedio(base.map(z => rec[z].pct));
  const resto = conDato.filter(z => !focoZ.includes(z)).sort(porPct);
  const nunca = ZONAS.filter(z => !rec[z]);
  const listos = conDato.filter(z => rec[z].pct >= 90).length;
  const firma = ZONAS.map(z => rec[z]?.estado || '-').join('|') + '#' + (sexo || '') + '#' + (sel || '');
  const s = sel && rec[sel];
  const textoM = ms[m].texto;
  const fila = z => {
    const r = rec[z];
    const sub = h
      ? (r.pct >= 100 ? `Listo ${textoM}` : `Al ${r.pct} % ${textoM}`)
      : `${capital(haceTexto(r.date))}, ${r.pct >= 100 ? 'listo' : cuandoLista(r.listaEn, ahora)}`;
    return (
      <FilaZona
        key={z} zona={z} r={r} sub={sub} series={semana[z]} cabezas={z === 'Tríceps' ? cabezas : null}
        abierta={abierta === z}
        onToggle={() => { const ab = abierta === z; setAbierta(ab ? null : z); setSel(ab ? null : z); }}
      />
    );
  };

  return (
    <div className="bm" ref={raiz}>
      <Encabezado />

      <section className="bm-bloque card hero bm-hero" aria-label={focoZ.length ? foco.slot.name : 'Promedio'}>
        <div className="bm-hero-fila">
          <div>
            <div className={`bm-hero-pct ${estadoDe(prom)}`}>{prom}<small>%</small></div>
            <span className="t-etiqueta">
              {focoZ.length ? `${foco.slot.name}, ${foco.cuando === 'hoy' ? 'lo de hoy' : 'lo próximo'}` : 'Promedio de lo que entrenaste'}
            </span>
          </div>
          <div className="bm-hero-barras" aria-hidden="true">
            {base.slice(0, 9).map(z => (
              <span key={z} className={rec[z].estado}><i style={{ transform: `scaleY(${rec[z].pct / 100})` }} /></span>
            ))}
          </div>
        </div>
        <p className="bm-hero-frase">{fraseHero({ rec, base, foco: focoZ.length ? foco : null, h, textoM, prom, ahora })}</p>
      </section>

      <section className="bm-bloque" aria-label="Mapa del cuerpo">
        <div className="bm-cuerpo-caja">
          <CuerpoGrande firma={firma} rec={rec} sexo={sexo} sel={sel} onPick={elegir} />
          {s && (
            <div className="bm-ficha" role="status">
              <b>{nombreZona(sel)}</b>
              <span className={s.estado}>{s.pct}%</span>
            </div>
          )}
        </div>
        <div className="bm-leyenda" aria-hidden="true">
          <span><i className="cargado" />Cargado, menos de 60 %</span>
          <span><i className="recuperando" />Recuperando</span>
          <span><i className="listo" />Listo, 90 % o más</span>
        </div>
      </section>

      <section className="bm-bloque" aria-label="Cómo vas a estar">
        <h3 className="sect bm-sect">Cómo vas a estar</h3>
        <div className="seg bm-momentos" role="group" aria-label="Momento">
          {ms.map((x, i) => (
            <button type="button" key={x.etiqueta} className={i === m ? 'on' : ''} aria-pressed={i === m} onClick={() => setM(i)}>{x.etiqueta}</button>
          ))}
        </div>
        <p className="bm-nota" aria-live="polite">
          {h ? `Si no entrenás antes, ${textoM}` : 'Ahora'}: <b>{listos} de {conDato.length}</b> {conDato.length === 1 ? 'músculo listo' : 'músculos listos'}.
        </p>
      </section>

      <section className="bm-bloque" aria-label="Músculo por músculo">
        <h3 className="sect bm-sect">Músculo por músculo</h3>
        {focoZ.length > 0 && (
          <>
            <span className="t-etiqueta">{foco.cuando === 'hoy' ? 'Para hoy' : 'Para el próximo'} · {foco.slot.name}</span>
            <div className="group bm-filas">{focoZ.map(fila)}</div>
          </>
        )}
        {resto.length > 0 && (
          <>
            {focoZ.length > 0 && <span className="t-etiqueta bm-etq-resto">El resto</span>}
            <div className="group bm-filas">{resto.map(fila)}</div>
          </>
        )}
        {nunca.length > 0 && (
          <p className="bm-nota">Sin registro todavía: {frase(nunca.map(z => LLANO[z]))}.</p>
        )}
      </section>

      <SemanaSeries semana={semana} zonas={ZONAS.filter(z => rec[z] || semana[z])} />
      <SinGrupoAviso />

      <p className="bm-bloque bm-pie">
        Es una estimación: cuenta las horas desde tu última serie, cuántas series hiciste y qué tan cerca del fallo
        quedaste (el RIR que contestás en el descanso). No mide tu cuerpo: si lo sentís cargado, hacele caso a eso.
      </p>
    </div>
  );
}

function Encabezado() {
  return (
    <div className="bm-cabeza">
      <h2 className="bm-titulo">Tu cuerpo</h2>
      <p className="bm-sub">Recuperación estimada, {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric' })} a las {new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
    </div>
  );
}

/** La frase de la hero: ahora, lo más justo y un consejo concreto; en una
    proyección, el promedio a esa hora. */
function fraseHero({ rec, base, foco, h, textoM, prom, ahora }) {
  const justo = base[0];
  const r = rec[justo];
  const de = foco ? `lo de ${foco.slot.name}` : 'lo que entrenaste';
  if (h) {
    return `${capital(textoM)}, ${de} llega al ${prom} % en promedio.`
      + (r.pct < 90 ? ` Lo más justo sigue siendo ${LLANO[justo]}, al ${r.pct} %.` : ' Todo listo.');
  }
  if (r.pct >= 90) return foco ? `Todo lo de ${foco.slot.name} está listo.` : 'Todo lo que entrenaste está listo.';
  let t = `Lo más justo es ${LLANO[justo]}, al ${r.pct} %: llega ${cuandoLista(r.listaEn, ahora)}.`;
  const ej = foco?.slot.exercises?.find(e => zonasDeEjercicio(e).includes(justo));
  if (ej && r.pct < 85 && foco.cuando === 'hoy') t += ` Si en ${ej.name} lo sentís cargado, sacá una serie.`;
  const listos = base.filter(z => rec[z].pct >= 90).map(z => LLANO[z]);
  if (listos.length) t += ` ${capital(frase(listos))}, ${listos.length === 1 ? 'listo' : 'listos'}.`;
  return t;
}

/** Una fila de "Músculo por músculo": cifra, cuándo llega, barra, y al
    abrirla lo que hiciste en la última sesión que tocó la zona. */
function FilaZona({ zona, r, sub, series, cabezas, abierta, onToggle }) {
  const fecha = new Date(r.date + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric' });
  return (
    <div className={`bm-fila${abierta ? ' abierta' : ''}`}>
      <button type="button" className="bm-fila-btn" aria-expanded={abierta} onClick={onToggle}>
        <span className="bm-fila-nombre">{nombreZona(zona)}</span>
        <span className={`bm-fila-pct ${r.estado}`}>{r.pct}%</span>
        <svg className="bm-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        <span className="bm-fila-sub">{sub}</span>
        <span className={`bm-barra ${r.estado}`} aria-hidden="true"><i style={{ transform: `scaleX(${r.pct / 100})` }} /></span>
      </button>
      <div className="bm-pliegue" inert={!abierta}>
        <div>
          <div className="bm-detalle">
            <span className="t-etiqueta">Lo que hiciste · {r.dayName ? `${r.dayName}, ` : ''}{fecha}</span>
            {r.ejercicios.map((e, i) => (
              <div className="bm-ej" key={i}>
                <span>{e.name}</span>
                <span>{e.series} {e.series === 1 ? 'serie' : 'series'}{rirTexto(e.rir) ? `, ${rirTexto(e.rir)}` : ''}</span>
              </div>
            ))}
          </div>
          <div className="bm-ej bm-ej-semana"><span>Esta semana</span><span><b>{series}</b> {series === 1 ? 'serie' : 'series'}</span></div>
          {cabezas && <CabezasTriceps {...cabezas} />}
        </div>
      </div>
    </div>
  );
}

/** El tríceps tiene un solo % (las tres cabezas se recuperan juntas), pero
    sí se puede decir cómo repartiste la semana entre ellas (Enzo,
    2026-10-06: "que te dé un insight de las tres cabezas"). */
function CabezasTriceps({ larga, resto }) {
  const total = larga + resto;
  if (!total) return null;
  const serie = n => `${n} ${n === 1 ? 'serie' : 'series'}`;
  const consejo = !larga
    ? 'Nada con el brazo arriba esta semana: es lo que más hace crecer la cabeza larga. Sumá una extensión sobre la cabeza.'
    : larga * 3 < total
      ? 'La cabeza larga va floja: una extensión sobre la cabeza más la emparejaría.'
      : null;
  return (
    <>
      <div className="bm-ej"><span>Cabeza larga · brazo arriba</span><span>{serie(larga)}</span></div>
      <div className="bm-ej"><span>Lateral y medial · pushdown, press</span><span>{serie(resto)}</span></div>
      {consejo && <p className="bm-nota">{consejo}</p>}
    </>
  );
}

/** Series por zona desde el lunes, con la franja del rango habitual. */
function SemanaSeries({ semana, zonas }) {
  if (!zonas.length) return null;
  const orden = [...zonas].sort((a, b) => semana[b] - semana[a]);
  const escala = Math.max(ESCALA_MIN, ...orden.map(z => semana[z]));
  const pos = n => `${(n / escala) * 100}%`;
  const lunes = lunesDe();
  const desde = dstr(lunes) === dstr() ? 'Hoy es lunes: la semana arranca hoy.' : `Del lunes ${lunes.getDate()} a hoy.`;
  const bajos = orden.filter(z => semana[z] < RANGO[0]).map(z => LLANO[z]);
  return (
    <section className="bm-bloque" aria-label="Series esta semana">
      <h3 className="sect bm-sect">Series esta semana</h3>
      <p className="bm-nota">{desde} La franja marca el rango habitual para ganar músculo: de {RANGO[0]} a {RANGO[1]} series por semana.</p>
      <div className="card bm-semana" style={{ '--r0': pos(RANGO[0]), '--r1': pos(RANGO[1]) }}>
        <div className="bm-sem-fila bm-sem-escala" aria-hidden="true">
          <span />
          <span className="bm-sem-marcas"><i style={{ left: 'var(--r0)' }}>{RANGO[0]}</i><i style={{ left: 'var(--r1)' }}>{RANGO[1]}</i></span>
          <span />
        </div>
        {orden.map(z => {
          const n = semana[z];
          const en = n >= RANGO[0];
          return (
            <div className={`bm-sem-fila${en ? ' en' : ''}`} key={z}>
              <span className="bm-sem-nombre">{nombreZona(z)}</span>
              <span className="bm-sem-pista" aria-hidden="true"><b /><i className="crece-x" style={{ width: pos(n) }} /></span>
              <span className="bm-sem-n">{n}</span>
            </div>
          );
        })}
      </div>
      <p className="bm-nota">
        {bajos.length ? `Por debajo de ${RANGO[0]} esta semana: ${frase(bajos)}.` : `Todo en ${RANGO[0]} series o más esta semana.`}
      </p>
    </section>
  );
}

/** El cuerpo grande: frente y espalda, tres capas por cara como Silhouette
    (masa que une, músculo con su degradado, una luz de arriba a la
    izquierda) pero pintado por RECUPERACIÓN, con los colores de la tarjeta
    de Inicio. Los degradados leen los tokens por `style` (Paradas): el de
    "listo" sigue al acento elegido. Memo por la firma de estados y la
    selección: son ~560 trazos. */
const CuerpoGrande = memo(function CuerpoGrande({ rec, sexo, sel, onPick }) {
  const { frente, espalda } = cuerpo(sexo);
  const luz = (c, id) => {
    const [x, y] = c.viewBox.split(/\s+/).map(Number);
    return (
      <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={x + 185} cy={y + 170} r="1150">
        <stop offset="0" style={{ stopColor: 'rgb(var(--hi-rgb))', stopOpacity: 0.3 }} />
        <stop offset=".45" style={{ stopColor: 'rgb(var(--hi-rgb))', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: 'rgb(var(--shade-rgb))', stopOpacity: 0.35 }} />
      </radialGradient>
    );
  };
  const cara = (c, idLuz, etiqueta) => {
    const formas = c.zonas.filter(z => !z.parche);
    return (
      <figure className="bm-cara">
        <svg viewBox={c.viewBox} role="img" aria-label={etiqueta}>
          <g className="bm-masa">{formas.map((z, i) => z.d.map((d, j) => <path key={`${i}-${j}`} d={d} />))}</g>
          {formas.map((z, i) => {
            const zona = z.cat && z.cat !== 'pelo' ? zonaDeForma(z.cat, z.slug) : null;
            const r = zona && rec[zona];
            const cls = z.cat === 'pelo' ? 'pelo' : r ? r.estado : 'sin-dato';
            return (
              <g key={i} className={`bm-z ${cls}${zona && zona === sel ? ' sel' : ''}${r ? ' toca' : ''}`} onClick={r ? () => onPick(zona) : undefined}>
                {z.d.map((d, j) => <path key={j} d={d} />)}
              </g>
            );
          })}
          <g className="bm-luz" fill={`url(#${idLuz})`}>{formas.map((z, i) => z.d.map((d, j) => <path key={`${i}-${j}`} d={d} />))}</g>
        </svg>
        <figcaption className="t-etiqueta">{etiqueta.split(' ')[0]}</figcaption>
      </figure>
    );
  };
  return (
    <div className="bm-cuerpo">
      <svg className="bm-defs" width="0" height="0" aria-hidden="true">
        <defs>
          <linearGradient id="bm-g-cargado" x1="0" y1="0" x2=".55" y2="1"><Paradas t="rec-cargado" /></linearGradient>
          <linearGradient id="bm-g-recuperando" x1="0" y1="0" x2=".55" y2="1"><Paradas t="rec-recup" /></linearGradient>
          <linearGradient id="bm-g-listo" x1="0" y1="0" x2=".55" y2="1"><Paradas t="mapa-0" /></linearGradient>
          <linearGradient id="bm-g-neutro" x1="0" y1="0" x2=".55" y2="1"><Paradas t="mapa-n" /></linearGradient>
          {luz(frente, 'bm-luz-f')}
          {luz(espalda, 'bm-luz-e')}
        </defs>
      </svg>
      {cara(frente, 'bm-luz-f', 'Frente del cuerpo')}
      {cara(espalda, 'bm-luz-e', 'Espalda del cuerpo')}
    </div>
  );
}, (a, b) => a.firma === b.firma);

/** Los ejercicios sin grupo muscular no suman en el mapa ni en las series.
    Antes se descartaban en silencio, así que el resumen se veía completo
    cuando no lo estaba. Ahora se dicen y se pueden asignar. */
function SinGrupoAviso() {
  const sin = uncategorized();
  if (!sin.length) return null;
  return (
    <button
      type="button"
      className="bm-bloque mt-3 flex w-full flex-col gap-0.5 rounded-[var(--radius-r)] border border-warn/30 bg-warn/10 px-3.5 py-3 text-left transition-colors hover:bg-warn/15"
      onClick={() => { closeSheet(); changeTab('rutina', () => { S.rutMode = 'edit'; }); }}
    >
      <span className="text-sm font-semibold text-text">
        {sin.length} ejercicio{sin.length === 1 ? '' : 's'} sin grupo muscular · no suma{sin.length === 1 ? '' : 'n'} acá
      </span>
      <span className="text-micro text-text-2">{sin.slice(0, 4).map(e => e.name).join(' · ')}{sin.length > 4 ? ` +${sin.length - 4}` : ''}</span>
      <span className="text-micro font-semibold text-warn">Asignar →</span>
    </button>
  );
}
