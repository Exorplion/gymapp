// Lista de gimnasios: crear, activar, renombrar, borrar, y entrar al match de
// cada uno (sheet 'gym-match': tu rutina entera contra ESE gym, con lo que
// falta asignar a la vista).
//
// El detalle de "con qué equipo hago este ejercicio acá" sigue viviendo en un
// sheet aparte (GymEquip), uno por ejercicio, para no volver esto un
// formulario gigante. Lo que cambió el 2026-09-10 es que ya no hay que llegar
// ejercicio por ejercicio desde "Mis ejercicios" con el gym activo: desde acá
// se ve la lista completa de un gym, esté activo o no.
import { useEffect, useRef, useState } from 'react';
import { S, closeSheet, openSheet } from '../../lib/state.js';
import { createGym, renameGym, deleteGym, setActiveGym } from '../../lib/gyms.js';
import { bloomOpen, staggerReveal } from '../../lib/motion.js';
import { Button } from '../ui/primitives.jsx';

const inputCls = 'h-11 w-full rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 text-body text-txt outline-none transition-colors focus-visible:border-blue2';

export default function Gyms() {
  const [nombre, setNombre] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const rootRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { bloomOpen(rootRef.current); }, []);
  useEffect(() => {
    if (listRef.current) staggerReveal(listRef.current.children);
  }, [S.gyms.length]);

  function agregar() {
    if (!nombre.trim()) return;
    createGym(nombre);
    setNombre('');
  }

  function guardarNombre(id) {
    renameGym(id, editNombre);
    setEditId(null);
  }

  return (
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">Gimnasios</h2>
      <div className="mt-1 mb-4 text-sm text-mut">
        Guardá los gimnasios donde entrenás. Tocá el nombre para activarlo, o el
        engranaje para ver cuál de tus ejercicios ya tiene máquina asignada ahí y
        cuál no.
      </div>

      {S.gyms.length === 0 && (
        <div className="mb-4 mt-1 text-sm text-mut">Todavía no guardaste ningún gimnasio.</div>
      )}

      {S.gyms.length > 0 && (
        <div ref={listRef} className="mb-4 rounded-[var(--radius-r-lg)] border border-line bg-[rgba(12,19,34,.4)] p-3">
          {S.gyms.map(g => {
            const activo = g.id === S.cfg.activeGym;
            const n = Object.keys(g.equip || {}).length;
            if (editId === g.id) {
              return (
                <div className="flex items-center gap-2.5 py-2" key={g.id}>
                  <input
                    className={`${inputCls} grow`}
                    value={editNombre}
                    autoFocus
                    onChange={e => setEditNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && guardarNombre(g.id)}
                  />
                  <button type="button" className="grid h-9 w-9 flex-none place-items-center rounded-full text-mut hover:text-txt" aria-label="Guardar el nombre" onClick={() => guardarNombre(g.id)}>✓</button>
                </div>
              );
            }
            return (
              <div className="flex items-center gap-2.5 py-2" key={g.id}>
                <button type="button" className="grow text-left" onClick={() => setActiveGym(activo ? null : g.id)}>
                  <div className="flex items-center gap-2 text-sm text-txt">
                    {g.name}
                    {activo && <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-nano font-semibold uppercase tracking-wide text-accent">activo</span>}
                  </div>
                  <div className="text-sm text-mut">{n} ejercicio{n === 1 ? '' : 's'} con equipo propio acá</div>
                </button>
                {/* El match de la rutina entera contra ESTE gym. Antes había
                    que abrir los 22 ejercicios de a uno desde "Mis
                    ejercicios" para saber qué faltaba configurar acá. */}
                <button type="button" className="grid h-9 w-9 flex-none place-items-center rounded-full text-mut hover:text-txt" aria-label={`Ver los ejercicios en ${g.name}`} onClick={() => openSheet('gym-match', { gymId: g.id })}>⚙</button>
                <button type="button" className="grid h-9 w-9 flex-none place-items-center rounded-full text-mut hover:text-txt" aria-label="Renombrar" onClick={() => { setEditId(g.id); setEditNombre(g.name); }}>✎</button>
                <button type="button" className="grid h-9 w-9 flex-none place-items-center rounded-full text-red hover:bg-red/10" aria-label="Borrar" onClick={() => deleteGym(g.id)}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="gym-nombre" className="mb-1.5 block text-sm font-medium text-mut">Nuevo gimnasio</label>
        <input
          id="gym-nombre"
          className={inputCls}
          value={nombre}
          placeholder="Ej. Gym del finde"
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregar()}
        />
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={agregar}>+ Agregar gimnasio</Button>
      <Button type="button" variant="ghost" className="mt-4 w-full" onClick={closeSheet}>Listo</Button>
    </div>
  );
}
