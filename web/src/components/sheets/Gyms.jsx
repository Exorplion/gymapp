// Lista de gimnasios: crear, activar, borrar. El detalle de "qué equipo usás
// en este gym para cada ejercicio" NO vive acá — se configura desde "Mis
// ejercicios" (Rutina.jsx), ejercicio por ejercicio, con el gym activo ya
// elegido acá. Separar las dos cosas evita un formulario gigante: elegís el
// gym una vez, y de ahí en más cada ejercicio se configura donde ya lo estás
// mirando.
import { useState } from 'react';
import { S, closeSheet } from '../../lib/state.js';
import { createGym, renameGym, deleteGym, setActiveGym } from '../../lib/gyms.js';

export default function Gyms() {
  const [nombre, setNombre] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState('');

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
    <>
      <h2>Gimnasios</h2>
      <div className="sheet-sub">
        Guardá los gimnasios donde entrenás. Activá uno y, desde "Mis ejercicios", decile con qué equipo hacés cada ejercicio ahí.
      </div>

      {S.gyms.length === 0 && (
        <div className="txt-mut" style={{ fontSize: 13.5, margin: '4px 0 16px' }}>Todavía no guardaste ningún gimnasio.</div>
      )}

      {S.gyms.length > 0 && (
        <div className="card sub" style={{ padding: 'var(--s2) var(--s3)', marginBottom: 16 }}>
          {S.gyms.map(g => {
            const activo = g.id === S.cfg.activeGym;
            const n = Object.keys(g.equip || {}).length;
            if (editId === g.id) {
              return (
                <div className="row" key={g.id}>
                  <input
                    className="grow"
                    value={editNombre}
                    autoFocus
                    onChange={e => setEditNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && guardarNombre(g.id)}
                  />
                  <button type="button" className="mini" onClick={() => guardarNombre(g.id)}>✓</button>
                </div>
              );
            }
            return (
              <div className="row" key={g.id}>
                <button type="button" className="grow linkcard" onClick={() => setActiveGym(activo ? null : g.id)}>
                  <div className="t">{g.name}{activo && <span className="lib-tag">activo</span>}</div>
                  <div className="s">{n} ejercicio{n === 1 ? '' : 's'} con equipo propio acá</div>
                </button>
                <button type="button" className="mini" aria-label="Renombrar" onClick={() => { setEditId(g.id); setEditNombre(g.name); }}>✎</button>
                <button type="button" className="mini red" aria-label="Borrar" onClick={() => deleteGym(g.id)}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="field">
        <label htmlFor="gym-nombre">Nuevo gimnasio</label>
        <input
          id="gym-nombre"
          value={nombre}
          placeholder="Ej. Gym del finde"
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregar()}
        />
      </div>
      <button type="button" className="btn sm ghost" onClick={agregar}>+ Agregar gimnasio</button>
      <button type="button" className="btn dim" style={{ marginTop: 16 }} onClick={closeSheet}>Listo</button>
    </>
  );
}
