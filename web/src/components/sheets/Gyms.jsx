// Lista de gimnasios: crear, activar, renombrar, borrar, y entrar al match de
// cada uno (sheet 'gym-match': tu rutina entera contra ESE gym, con lo que
// falta asignar a la vista).
//
// El detalle de "con qué equipo hago este ejercicio acá" sigue viviendo en un
// sheet aparte (GymEquip), uno por ejercicio, para no volver esto un
// formulario gigante. Lo que cambió el 2026-09-10 es que ya no hay que llegar
// ejercicio por ejercicio desde "Mis ejercicios" con el gym activo: desde acá
// se ve la lista completa de un gym, esté activo o no.
//
// Pasada de estética (2026-09-15). Esta pantalla se había armado a mano en vez
// de con las piezas que la app ya tenía, y se notaba:
//   · los botones de la fila eran los caracteres ⚙ ✎ ✕ dentro de un `div`
//     redondo SIN fondo ni borde — se leían como letras sueltas flotando, no
//     como botones. Ahora son `<Button variant="icon">`, la misma pieza de
//     38px con borde y degradado que usa el resto de la app, con los íconos
//     de trazo de Icon.jsx.
//   · el nombre del gym y su subtítulo estaban los dos en `text-sm`: dos
//     renglones del mismo tamaño no forman jerarquía, y la fila se leía como
//     un bloque gris. El nombre pasa a `text-body` semibold.
//   · la tarjeta usaba `bg-[rgba(12,19,34,.4)]` escrito a mano — un azul
//     marino que quedó de la paleta vieja y que hoy no coincide con ninguna
//     superficie de "acero". Ahora es `<Card>`, el mismo token que el resto.
//   · las filas no tenían separador y se apretaban entre sí; ahora van
//     divididas y con el alto parejo entre el modo normal y el de renombrar.
import { useEffect, useRef, useState } from 'react';
import { S, closeSheet, openSheet } from '../../lib/state.js';
import { createGym, renameGym, deleteGym, setActiveGym } from '../../lib/gyms.js';
import { sheetReveal } from '../../lib/motion.js';
import { Button, Card, Badge } from '../ui/primitives.jsx';
import { Tune, Pencil, X, Check } from '../Icon.jsx';
import { cn } from '../../lib/utils.js';

const inputCls = 'h-11 w-full rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 text-body text-txt outline-none transition-colors focus-visible:border-blue2';

export default function Gyms() {
  const [nombre, setNombre] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const rootRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) sheetReveal(listRef.current.children);
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
      <p className="mt-1 mb-4 text-sm text-mut">
        Guardá los gimnasios donde entrenás. Tocá el nombre para activarlo, o las
        perillas para ver cuál de tus ejercicios ya tiene máquina asignada ahí y
        cuál no.
      </p>

      {S.gyms.length === 0 && (
        <Card className="mb-4 text-sm text-mut">Todavía no guardaste ningún gimnasio.</Card>
      )}

      {S.gyms.length > 0 && (
        <Card className="mb-4 overflow-hidden p-0">
          {/* El separador va acá y no en la Card: los hijos directos de la
              Card son este contenedor y nada más, así que `divide-y` puesto
              arriba no dibujaría ninguna línea entre las filas. */}
          <div ref={listRef} className="divide-y divide-line">
            {S.gyms.map(g => {
              const activo = g.id === S.cfg.activeGym;
              const n = Object.keys(g.equip || {}).length;

              if (editId === g.id) {
                return (
                  /* Mismo padding y mismo alto que la fila normal: si el modo
                     de renombrar fuera más bajo, la lista entera saltaría al
                     entrar y salir de la edición. */
                  <div className="flex items-center gap-2 px-3 py-2.5" key={g.id}>
                    <input
                      className={cn(inputCls, 'min-w-0 grow')}
                      value={editNombre}
                      autoFocus
                      aria-label={`Nuevo nombre para ${g.name}`}
                      onChange={e => setEditNombre(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') guardarNombre(g.id);
                        /* Escape cancela. Antes no había forma de salir del
                           modo edición sin guardar: la única salida era
                           confirmar un nombre que quizá no querías. */
                        if (e.key === 'Escape') setEditId(null);
                      }}
                    />
                    <div className="flex flex-none items-center gap-1.5">
                      <Button type="button" variant="icon" size="icon" className="text-accent" aria-label="Guardar el nombre" onClick={() => guardarNombre(g.id)}>
                        <Check />
                      </Button>
                      <Button type="button" variant="icon" size="icon" aria-label="Cancelar el cambio de nombre" onClick={() => setEditId(null)}>
                        <X />
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  className={cn('flex items-center gap-2 px-3 py-2.5', activo && 'bg-accent/[.06]')}
                  key={g.id}
                >
                  {/* El gym activo se marca dos veces a propósito: la etiqueta
                      lo dice y el fondo lo muestra. Con la etiqueta sola hay
                      que leer la fila para saber en cuál estás parado. */}
                  <button
                    type="button"
                    aria-pressed={activo}
                    className="min-w-0 grow rounded-[var(--radius-r)] px-1 py-0.5 text-left focus-visible:outline-2 focus-visible:outline-blue2 focus-visible:outline-offset-2"
                    onClick={() => setActiveGym(activo ? null : g.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-body font-semibold text-txt">{g.name}</span>
                      {activo && <Badge tone="accent" className="flex-none">activo</Badge>}
                    </div>
                    <div className="mt-0.5 text-sm text-mut">
                      {n} ejercicio{n === 1 ? '' : 's'} con equipo propio acá
                    </div>
                  </button>

                  <div className="flex flex-none items-center gap-1.5">
                    {/* El match de la rutina entera contra ESTE gym. Antes había
                        que abrir los 22 ejercicios de a uno desde "Mis
                        ejercicios" para saber qué faltaba configurar acá. */}
                    <Button type="button" variant="icon" size="icon" aria-label={`Ver los ejercicios en ${g.name}`} onClick={() => openSheet('gym-match', { gymId: g.id })}>
                      <Tune />
                    </Button>
                    <Button type="button" variant="icon" size="icon" aria-label={`Renombrar ${g.name}`} onClick={() => { setEditId(g.id); setEditNombre(g.name); }}>
                      <Pencil />
                    </Button>
                    {/* Rojo con borde rojo, no un ✕ gris igual a los de al
                        lado: es el único de los tres que destruye algo. */}
                    <Button type="button" variant="icon" size="icon" className="border-red/30 text-red" aria-label={`Borrar ${g.name}`} onClick={() => deleteGym(g.id)}>
                      <X />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mb-3">
        <label htmlFor="gym-nombre" className="mb-1.5 block text-sm font-medium text-mut">Nuevo gimnasio</label>
        {/* Campo y botón en la misma fila: el botón suelto debajo dejaba un
            escalón raro contra el borde del campo, y separaba la acción de
            lo que la dispara. */}
        <div className="flex items-center gap-2">
          <input
            id="gym-nombre"
            className={cn(inputCls, 'min-w-0 grow')}
            value={nombre}
            placeholder="Ej. Gym del finde"
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && agregar()}
          />
          {/* Deshabilitado con el campo vacío: antes el botón se veía activo
              y al tocarlo no pasaba nada. */}
          <Button type="button" variant="secondary" className="h-11 flex-none px-4" disabled={!nombre.trim()} onClick={agregar}>
            Agregar
          </Button>
        </div>
      </div>

      <Button type="button" variant="ghost" className="mt-4 w-full" onClick={closeSheet}>Listo</Button>
    </div>
  );
}
