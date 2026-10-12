// "Hoy hago otra cosa" (turnos universales, Fase 3; spec 2026-10-12, §4).
//
// Se abre desde Hoy, antes de empezar: otro de tus turnos (cada uno una vez,
// sin el que tocaba) o una sesión libre, que arranca vacía y se llena con el
// asistente de siempre. En un descanso Hoy ya lista los turnos; ahí esta hoja
// se abre sólo con la sesión libre (`soloLibre`).
//
// La semana sigue como estaba (opción A, lib/puntero.js): el día cuenta como
// usado y mañana te toca lo que venía. La hoja lo dice, porque es lo que uno
// se pregunta antes de salirse del plan.
//
// Mismos patrones que RestHero (Hoy.jsx): .group / .grouprow para la lista.
import { useState } from 'react';
import { S, bump, closeSheet } from '../../lib/state.js';
import { dstr } from '../../lib/format.js';
import { opcionesDelDia } from '../../lib/descansoHoy.js';
import { elegirTurnoHoy, startSessionLibre } from '../../lib/session.js';
import { abrirAsistente } from '../../lib/asistente-agregar.js';
import { Plus } from '../Icon.jsx';

const hace = d => (d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : `Hace ${d} días`);

export default function OtraCosa({ soloLibre = false }) {
  const [libre, setLibre] = useState(soloLibre);
  const [nombre, setNombre] = useState('');
  const p = S.routine[S.cfg.seqIndex];
  const tocaba = p?.type === 'workout' ? (p.name || 'tu turno') : null;
  const o = opcionesDelDia({ routine: S.routine, seqIndex: S.cfg.seqIndex, sessions: S.sessions, hoy: dstr() });

  function elegir(i) {
    elegirTurnoHoy(i);
    closeSheet();
    bump();
    scrollTo({ top: 0, behavior: 'instant' });
  }

  async function empezarLibre(e) {
    e.preventDefault();
    await startSessionLibre(nombre);
    // Lo primero en una sesión libre es elegir qué hacer.
    abrirAsistente(-1, 'sesion');
  }

  return (
    <>
      <h2>{soloLibre ? 'Sesión libre' : 'Hoy hago otra cosa'}</h2>
      <p className="otra-nota">
        {tocaba
          ? <>Hoy tocaba <b>{tocaba}</b>. Tu semana sigue igual: mañana te toca lo que venía después.</>
          : <>Hoy tocaba descansar. Entrenar otra cosa no mueve tu semana.</>}
      </p>

      {!soloLibre && o.opciones.length > 0 && (
        <div className="group">
          {o.opciones.map(op => (
            <button key={op.id} type="button" className="grouprow" onClick={() => elegir(op.index)}>
              <span className="grouprow-grow">
                <span className="grouprow-t">{op.nombre}</span>
                <span className="grouprow-s">
                  {op.dias === null ? 'Todavía no lo hiciste'
                    : op.reciente ? `${hace(op.dias)} · repetirlo no deja descansar esos músculos`
                    : hace(op.dias)}
                </span>
              </span>
              <span className="grouprow-chev" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      )}

      {libre ? (
        <form className="otra-libre" onSubmit={empezarLibre}>
          <label htmlFor="otra-nombre">Nombre (opcional)</label>
          <input
            id="otra-nombre" value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Pull con Juan" maxLength={40} autoComplete="off"
          />
          <button type="submit" className="btn"><Plus size={18} /> Empezar y elegir el primer ejercicio</button>
        </form>
      ) : (
        <div className="group" style={{ marginTop: 'var(--s2)' }}>
          <button type="button" className="grouprow" onClick={() => setLibre(true)}>
            <span className="grouprow-grow">
              <span className="grouprow-t">Sesión libre</span>
              <span className="grouprow-s">Arrancás vacío y agregás ejercicios sobre la marcha</span>
            </span>
            <span className="grouprow-chev" aria-hidden="true">›</span>
          </button>
        </div>
      )}
    </>
  );
}
