// "¿En qué máquina?" — las máquinas de un ejercicio en el gym activo
// (Enzo, 2026-10-06: el Close grip row en la Low row machine o en la polea).
// Cada una es una foto con el nombre que le pongas; elegirla cambia el nombre
// del ejercicio ("Close grip row en Polea") y con qué historial se compara.
// Modelo y por qué: lib/maquinas.js; fotos y guardado: lib/gyms.js.
//
// Se abre tocando la foto de la tarjeta o desde ⋯ → "En qué máquina".
import { useEffect, useRef, useState } from 'react';
import { S, openSheet, wDisplay } from '../../lib/state.js';
import { sessionExs, lastDataFor } from '../../lib/session.js';
import { maquinasDe, maquinaElegida } from '../../lib/maquinas.js';
import { asegurarLegado, crearMaquina, renombrarMaquina, borrarMaquina, elegirMaquina, getPhoto, guardarFotoMaquina, LEGADO } from '../../lib/gyms.js';
import { toast } from '../../lib/toast.js';
import { cn } from '../../lib/utils.js';
import { Camera, Check, Pencil, Plus } from '../Icon.jsx';

const inputCls = 'h-11 w-full min-w-0 rounded-[var(--radius-r)] border border-line-2 bg-surface-2 px-3.5 text-body text-text outline-none transition-colors focus-visible:border-accent';

/** La foto de una máquina, leída del store; el object URL nace y muere acá. */
function useFoto(gymId, exName, maqId) {
  const [url, setUrl] = useState(null);
  const rev = S.fotoRev || 0;
  useEffect(() => {
    let vivo = true, u = null;
    getPhoto(gymId, exName, maqId)
      .then(b => { if (vivo) { u = b ? URL.createObjectURL(b) : null; setUrl(u); } })
      .catch(() => { if (vivo) setUrl(null); });
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [gymId, exName, maqId, rev]);
  return url;
}

export default function Maquinas({ exId, wd }) {
  const index = wd ?? S.routine.findIndex(s => s.id === S.draft?.slotId);
  const ex = sessionExs(index).find(e => e.id === exId);
  const gymId = S.cfg.activeGym;
  const gym = S.gyms?.find(g => g.id === gymId);
  const [editando, setEditando] = useState(null);   // id de máquina, 'nueva' o null
  const [verFoto, setVerFoto] = useState(null);

  const exName = ex?.name;
  // La foto de siempre pasa a ser "Máquina 1" la primera vez que se abre.
  useEffect(() => { if (gymId && exName) asegurarLegado(gymId, exName); }, [gymId, exName]);

  if (!ex) return <h2>Máquina</h2>;
  if (!gym) {
    return (
      <>
        <h2>{ex.name}</h2>
        <p className="ptext mut">Las máquinas se guardan por gimnasio. Elegí en cuál estás y volvé acá.</p>
        <button type="button" className="btn sm mt-3" onClick={() => openSheet('gyms')}>Elegir gimnasio</button>
      </>
    );
  }

  const lista = maquinasDe(gymId, ex.name);
  const activa = maquinaElegida(gymId, ex.name);
  const yaEmpezado = !!S.draft?.entries?.[ex.id]?.sets?.length;

  async function elegir(maqId) {
    if ((activa?.id || null) === maqId) return;
    // Igual que unilateral: las series de hoy ya quedaron con la otra máquina,
    // y mezclarlas pondría dos historiales en uno.
    if (yaEmpezado) { toast('Ya registraste series hoy: cambiá de máquina antes de la primera serie'); return; }
    await elegirMaquina(gymId, ex.name, maqId);
  }

  return (
    <>
      <h2>{ex.name}</h2>
      <p className="ptext mut" style={{ marginBottom: 'var(--s3)' }}>
        En qué máquina lo hacés en <b>{gym.name}</b>. Cada una lleva su propio historial de pesos.
      </p>
      <div className="group">
        {lista.map(m => (editando === m.id ? (
          <FormMaquina
            key={m.id} inicial={m.nombre}
            onGuardar={async nombre => { await renombrarMaquina(gymId, ex.name, m.id, nombre); setEditando(null); }}
            onBorrar={() => openSheet('confirm', {
              title: `¿Borrar ${m.nombre}?`,
              body: `Se borra la máquina y su foto de ${gym.name}. Lo que entrenaste en ella queda en tu historial.`,
              confirmLabel: 'Borrar',
              onConfirm: () => borrarMaquina(gymId, ex.name, m.id),
            })}
            onCancelar={() => setEditando(null)}
          />
        ) : (
          <FilaMaquina
            key={m.id} gymId={gymId} ex={ex} m={m} activa={activa?.id === m.id}
            abierta={verFoto === m.id} onFoto={() => setVerFoto(v => (v === m.id ? null : m.id))}
            onElegir={() => elegir(m.id)} onEditar={() => setEditando(m.id)}
          />
        )))}
        {editando === 'nueva' ? (
          <FormMaquina
            nueva inicial=""
            onGuardar={async (nombre, foto) => {
              const m = await crearMaquina(gymId, ex.name, nombre, foto);
              // Con series ya hechas hoy, la nueva queda guardada pero no
              // elegida: se vuelve a la que estabas usando.
              if (m && yaEmpezado) {
                await elegirMaquina(gymId, ex.name, activa?.id || null);
                toast('Ya registraste series hoy: la nueva queda para la próxima');
              }
              setEditando(null);
            }}
            onCancelar={() => setEditando(null)}
          />
        ) : (
          <button type="button" className="grouprow" onClick={() => setEditando('nueva')}>
            <Plus className="opc-ico" />
            <span className="grouprow-grow">
              <span className="grouprow-t">Nueva máquina</span>
              <span className="grouprow-s">Sacale foto y ponele el nombre que te sirva: "Polea", "Low row"…</span>
            </span>
          </button>
        )}
        {activa && (
          <button type="button" className="grouprow" onClick={() => elegir(null)}>
            <span className="grouprow-grow">
              <span className="grouprow-t">Sin máquina</span>
              <span className="grouprow-s">El ejercicio a secas, con el historial de antes.</span>
            </span>
          </button>
        )}
      </div>
    </>
  );
}

function FilaMaquina({ gymId, ex, m, activa, abierta, onFoto, onElegir, onEditar }) {
  const url = useFoto(gymId, ex.name, m.legado ? LEGADO : m.id);
  const inputRef = useRef(null);
  const ultima = lastDataFor({ ...ex, variante: m.legado ? undefined : m.id });
  const unidad = S.cfg.unit === 'lb' ? 'lb' : 'kg';
  const top = ultima?.length ? Math.max(...ultima.map(s => s.w)) : null;
  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    await guardarFotoMaquina(gymId, ex.name, file, m.legado ? LEGADO : m.id);
  }
  return (
    <>
      <div className={cn('grouprow maq-fila', activa && 'on')}>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <button
          type="button" className="ex-foto maq-foto"
          aria-label={url ? `Ver la foto de ${m.nombre}` : `Sacarle foto a ${m.nombre}`}
          onClick={() => (url ? onFoto() : inputRef.current?.click())}
        >
          {url ? <img src={url} alt="" /> : <Camera />}
        </button>
        <button type="button" className="maq-elegir grouprow-grow" aria-pressed={activa} onClick={onElegir}>
          <span className="grouprow-t">{m.nombre}</span>
          <span className="grouprow-s">{top != null ? `Última vez ${wDisplay(top)} ${unidad}` : 'Sin registro todavía'}</span>
        </button>
        {activa && <Check className="opc-ico" />}
        <button type="button" className="maq-editar" aria-label={`Renombrar o borrar ${m.nombre}`} onClick={onEditar}><Pencil /></button>
      </div>
      {abierta && url && (
        <div className="maq-ver">
          <figure className="photo-full"><img src={url} alt={`${m.nombre}`} /></figure>
          <button type="button" className="btn sm ghost" onClick={() => inputRef.current?.click()}><Camera /> Cambiar foto</button>
        </div>
      )}
    </>
  );
}

function FormMaquina({ inicial, nueva = false, onGuardar, onBorrar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial);
  const [foto, setFoto] = useState(null);
  const inputRef = useRef(null);
  return (
    <div className="grouprow maq-form">
      <input
        className={inputCls} value={nombre} autoFocus placeholder={nueva ? 'Nombre: Polea, Low row…' : 'Nombre'}
        aria-label="Nombre de la máquina" onChange={e => setNombre(e.target.value)}
      />
      {nueva && (
        <>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { setFoto(e.target.files?.[0] || null); e.target.value = ''; }} />
          <button type="button" className="btn sm ghost" onClick={() => inputRef.current?.click()}>
            <Camera /> {foto ? 'Foto lista' : 'Sacar foto'}
          </button>
        </>
      )}
      <div className="maq-form-acc">
        <button type="button" className="btn sm" onClick={() => onGuardar(nombre, foto)}>{nueva ? 'Agregar' : 'Guardar'}</button>
        <button type="button" className="btn sm ghost" onClick={onCancelar}>Cancelar</button>
        {onBorrar && <button type="button" className="btn sm danger" onClick={onBorrar}>Borrar</button>}
      </div>
    </div>
  );
}
