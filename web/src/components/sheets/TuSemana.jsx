// "Tu semana" (turnos universales, Fase 2): la semana se edita acá, aparte
// del turno. Opción B del lienzo del 2026-10-12, elegida por Enzo: el riel de
// Entreno queda para mirar y elegir, y esta hoja tiene una fila grande por
// día para moverla, sacarla o agregar otra.
//
// Los descansos son paradas como cualquier otra: lo que armás es lo que
// queda. "Acomodar descansos" es un botón, de una vez y con deshacer.
// El "Hoy" sigue a su día (rutina-logic.js, editarSemana): mover o agregar
// paradas no cambia lo que te toca.
//
// Mismo mecanismo de arrastre que "Reordenar" (ReorderHoy.jsx): data-sort /
// data-sid y drag.js, con flechas al lado para hacer lo mismo de un toque.
import { useEffect, useRef, useState } from 'react';
import { S, bump, closeSheet, useStore } from '../../lib/state.js';
import { claveTurno } from '../../lib/turnos.js';
import { sheetReveal } from '../../lib/motion.js';
import { minutosDeTurno } from '../../lib/entreno.js';
import {
  weekdayProjection, moverParada, agregarParada, sacarParada, acomodarDescansos,
  vecesEnSemana, turnosGuardados, rachaMasLarga, hasOpenSession,
} from '../../lib/rutina-logic.js';
import { ArrowDown, ArrowUp, Grip, Mover, Plus, X } from '../Icon.jsx';

/** Cada turno una vez, en el orden de la semana, y después los guardados.
    Sin turnos (modo viejo) no se puede repetir uno: sólo descanso o nuevo. */
function turnosParaAgregar() {
  if (!Array.isArray(S.turnos)) return [];
  const vistos = new Set();
  const out = [];
  S.routine.forEach(s => {
    if (s.type !== 'workout') return;
    const k = claveTurno(s);
    if (vistos.has(k)) return;
    vistos.add(k);
    out.push({ id: k, name: s.name || 'Sin nombre' });
  });
  turnosGuardados().forEach(t => out.push({ id: t.id, name: t.name || 'Sin nombre', guardado: true }));
  return out;
}

export default function TuSemana() {
  useStore();
  const [pregunta, setPregunta] = useState(null);   // id del slot cuya última aparición se saca
  const [agregando, setAgregando] = useState(false);
  const listRef = useRef(null);
  useEffect(() => { if (listRef.current) sheetReveal(listRef.current.children); }, []);

  const dias = weekdayProjection();
  const seq = S.cfg.seqIndex || 0;
  const n = S.routine.length;
  const entrenos = S.routine.filter(s => s.type === 'workout').length;
  const racha = rachaMasLarga();

  async function mover(i, dir) {
    setPregunta(null);
    await moverParada(i, dir);
  }

  async function sacar(i) {
    const s = S.routine[i];
    if (!s) return;
    if (hasOpenSession(i)) { await sacarParada(i); return; }   // avisa y no saca
    // La última aparición de un turno pregunta antes (por defecto se guarda).
    if (s.type === 'workout' && Array.isArray(S.turnos) && vecesEnSemana(claveTurno(s)) === 1) { setPregunta(s.id); return; }
    await sacarParada(i);
  }

  async function responder(guardar) {
    const i = S.routine.findIndex(s => s.id === pregunta);
    setPregunta(null);
    if (i >= 0) await sacarParada(i, { guardar });
  }

  async function agregar(turnoId) {
    setAgregando(false);
    await agregarParada(turnoId);
  }

  /* Tocar un día muestra su turno en Entreno. */
  function ver(i) {
    if (S.routine[i]?.type !== 'workout') return;
    S.rutOpen = i; S.rutTurno = null;
    closeSheet(); bump();
  }

  const opciones = turnosParaAgregar();
  return (
    <>
      <h2>Tu semana</h2>
      <p className="sem-resumen">
        {entrenos} {entrenos === 1 ? 'entrenamiento' : 'entrenamientos'} · {n - entrenos} {n - entrenos === 1 ? 'descanso' : 'descansos'} · {n} {n === 1 ? 'día' : 'días'}
      </p>
      {n > 0 && n !== 7 && (
        <p className="sem-aviso">Tu ciclo dura {n} {n === 1 ? 'día' : 'días'}: no coincide con la semana, así que los días se van corriendo de una vuelta a la otra.</p>
      )}
      {racha >= 4 && (
        <p className="sem-aviso">Hay {racha} días seguidos de entrenamiento sin descanso.</p>
      )}
      <div className="drag-hint tight"><Mover /><span>Mantené apretado un día para arrastrarlo, o usá las flechas. Los días son estimados: la semana avanza cuando entrenás.</span></div>

      <div className="sem-lista" data-sort="semana" ref={listRef}>
        {S.routine.map((s, i) => {
          const esEntreno = s.type === 'workout';
          const hoy = i === seq;
          if (pregunta === s.id) {
            return (
              <div key={s.id} data-sid={s.id} className="sem-fila sem-pregunta" role="group" aria-label="Última aparición">
                <p>Es la única vez que aparece <b>{s.name || 'este turno'}</b> en tu semana. ¿Lo guardás para después?</p>
                <div className="sem-ops">
                  <button type="button" className="btn sm" onClick={() => responder(true)}>Guardarlo</button>
                  <button type="button" className="btn sm danger" onClick={() => responder(false)}>Borrarlo</button>
                  <button type="button" className="btn sm ghost" onClick={() => setPregunta(null)}>Cancelar</button>
                </div>
              </div>
            );
          }
          const exs = esEntreno ? (s.exercises || []).length : 0;
          return (
            <div key={s.id} data-sid={s.id} className={`sem-fila${esEntreno ? '' : ' descanso'}${hoy ? ' hoy' : ''}`}>
              <span className="sem-dia">{dias[i]}{hoy && <em>Hoy</em>}</span>
              <div
                className="sem-cuerpo" role={esEntreno ? 'button' : undefined} tabIndex={esEntreno ? 0 : undefined}
                onClick={() => ver(i)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ver(i); } }}
              >
                <span className="sem-n">{esEntreno ? (s.name || 'Sin nombre') : 'Descanso'}</span>
                {/* Corto a propósito: a 390 px la columna del nombre mide
                    ~115 px, y "8 ejercicios · ~55 min" se cortaba. */}
                {esEntreno && (
                  <span className="sem-s">
                    {exs ? `${exs} ej · ~${minutosDeTurno(s)} min` : 'Sin ejercicios'}
                  </span>
                )}
              </div>
              <button type="button" className="mini" aria-label={`Subir ${dias[i]}`} disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp /></button>
              <button type="button" className="mini" aria-label={`Bajar ${dias[i]}`} disabled={i === n - 1} onClick={() => mover(i, 1)}><ArrowDown /></button>
              <button type="button" className="mini red" aria-label={`Sacar ${esEntreno ? s.name || 'turno' : 'descanso'} del ${dias[i]}`} onClick={() => sacar(i)}><X size={16} /></button>
              <span className="sem-agarre" aria-hidden="true"><Grip /></span>
            </div>
          );
        })}
      </div>

      {agregando ? (
        <div className="sem-agregar">
          <p>¿Qué agregás al final?</p>
          <div className="sem-ops">
            {opciones.map(t => (
              <button key={t.id} type="button" className="chip" onClick={() => agregar(t.id)}>
                {t.name}{t.guardado && <span className="ent-chip-dim"> · guardado</span>}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => agregar(null)}>Descanso</button>
            <button type="button" className="chip blue" onClick={() => agregar('nuevo')}><Plus size={15} /> Turno nuevo</button>
          </div>
          <button type="button" className="btn sm ghost" onClick={() => setAgregando(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className="btn ghost" onClick={() => { setPregunta(null); setAgregando(true); }}><Plus size={18} /> Agregar un día</button>
      )}

      <div className="sem-pie">
        <button type="button" className="btn sm dim" disabled={!entrenos} onClick={acomodarDescansos}>Acomodar descansos</button>
        <button type="button" className="btn sm" onClick={closeSheet}>Listo</button>
      </div>
    </>
  );
}
