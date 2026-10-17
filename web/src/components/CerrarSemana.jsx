// "Para cerrar la semana" (turnos universales, Fase 4, opción A del lienzo
// claude.ai/artifact/4Qswpo9x8WCfX5Y1BQhkY2): la tarjeta entre el turno y el
// plan de Hoy cuando una sesión fuera del plan dejó algo sin hacer. Qué te
// propongo y por qué, una sola decisión. Al sumar se achica a una línea con
// Deshacer y lo sumado aparece marcado en el plan. La lógica es
// lib/compensacion.js; el estado (aceptada / hoy no), session.js.
import { useState } from 'react';
import { aceptarCompensacion, descartarCompensacion, deshacerCompensacion } from '../lib/session.js';
import { diaLargo, listaZonas } from '../lib/compensacion.js';
import { toast } from '../lib/toast.js';
import { vibrate } from '../lib/format.js';
import { Check } from './Icon.jsx';

const titulo = h => (h.tipo === 'traer'
  ? <>Traer <em>{h.ex.name}</em> · {h.ex.sets}×{h.ex.reps}</>
  : <><em>+{h.mas}</em> series de {h.nombre}</>);

/** "El martes hiciste Pull con Juan en vez de Posterior." */
function Origen({ origen }) {
  return (
    <p className="cs-origen">
      {origen.map((o, i) => (
        <span key={o.sessionId}>
          {i > 0 && ' '}
          {i === 0 ? 'El' : 'Y el'} {diaLargo(o.fecha)} hiciste <b>{o.hiciste || 'otra cosa'}</b> en vez de <b>{o.enVezDe}</b>.
        </span>
      ))}
    </p>
  );
}

/** Las series que faltan por zona, como barras (la más larga = la que más falta). */
function QueFalta({ faltan, origen }) {
  const max = Math.max(...faltan.map(f => f.series), 1);
  const turnos = [...new Set(origen.map(o => o.enVezDe))].join(' y ');
  return (
    <div className="cs-falta">
      {faltan.map(f => (
        <div className="cs-zf" key={f.zona}>
          <span className="cs-zf-n">{f.zona}</span>
          <span className="cs-zf-barra" aria-hidden="true"><i style={{ width: `${(f.series / max) * 100}%` }} /></span>
          <span className="cs-zf-v">−{f.series}</span>
          {f.frecuencia.real < f.frecuencia.plan && (
            <span className="cs-zf-f">{f.frecuencia.real} de {f.frecuencia.plan} veces esta semana</span>
          )}
        </div>
      ))}
      <p className="cs-falta-pie">Series que {turnos} tenía para cada músculo y no se hicieron.</p>
    </div>
  );
}

/** Lo que va otro día y lo que no entra, en una línea. */
function nota(c) {
  const partes = c.despues.map(d => `${listaZonas(d.zonas).replace(/^./, m => m.toUpperCase())}: el ${diaLargo(d.fecha)} en ${d.turno}.`);
  if (c.sinLugar.length) {
    const s = c.sinLugar.map((x, i) => (i === 0 ? `${x.series} series de ${x.zona.toLowerCase()}` : `${x.series} de ${x.zona.toLowerCase()}`));
    const lista = s.length < 2 ? s[0] : `${s.slice(0, -1).join(', ')} y ${s[s.length - 1]}`;
    partes.push(`No entra esta semana: ${lista}. No pasa a la semana que viene.`);
  }
  return partes.join(' ');
}

export default function CerrarSemana({ comp, aceptada }) {
  const [sel, setSel] = useState(() => new Set(comp.hoy.map(h => h.id)));
  const [ver, setVer] = useState(false);

  if (aceptada) {
    const lista = aceptada.map(h => (h.tipo === 'traer' ? h.ex.name : `+${h.mas} ${h.nombre}`)).join(', ');
    return (
      <div className="hoy-elegido cs-hecho">
        <span><Check size={14} /> Sumado a hoy: <b>{lista}</b></span>
        <button type="button" className="linkcard" onClick={() => deshacerCompensacion()}>Deshacer</button>
      </div>
    );
  }

  const tog = id => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const texto = nota(comp);
  return (
    <section className="cs" aria-label="Para cerrar la semana">
      <div className="cs-head">
        <h2 className="cs-t">Para cerrar la semana</h2>
        <button type="button" className="linkcard cs-ver" aria-expanded={ver} onClick={() => setVer(v => !v)}>
          {ver ? 'Ocultar' : 'Ver qué falta'}
        </button>
      </div>
      <Origen origen={comp.origen} />
      <div className="group">
        {comp.hoy.map(h => (
          <button type="button" key={h.id} className="grouprow cs-fila" aria-pressed={sel.has(h.id)} onClick={() => tog(h.id)}>
            <span className="cs-tick" aria-hidden="true"><Check size={14} /></span>
            <span className="grouprow-grow">
              <span className="grouprow-t">{titulo(h)}</span>
              <span className="grouprow-s">
                {h.tipo === 'traer'
                  ? `Del ${h.desde} que no hiciste · faltan ${h.falta} series de ${h.zona.toLowerCase()}`
                  : `Faltan ${h.falta} series de ${h.zona.toLowerCase()} esta semana`}
              </span>
            </span>
          </button>
        ))}
        {ver && <QueFalta faltan={comp.faltan} origen={comp.origen} />}
        {texto && <div className="grouprow grouprow-estado cs-nota">{texto}</div>}
      </div>
      <div className="cs-acts">
        <button
          type="button" className="btn sm" disabled={!sel.size}
          onClick={() => { vibrate(15); aceptarCompensacion(comp, [...sel]); }}
        >
          Sumar a hoy
        </button>
        <button
          type="button" className="btn sm dim"
          onClick={() => {
            descartarCompensacion(comp);
            toast('Listo, hoy no. Tu plan queda como estaba.', { actionLabel: 'Deshacer', onAction: () => deshacerCompensacion() });
          }}
        >
          Hoy no
        </button>
      </div>
    </section>
  );
}
