// "¿Le sacás foto a esta máquina?" — en el descanso, después de la primera
// serie de un ejercicio de máquina sin foto (Enzo, 2026-10-12: "el usuario no
// va a entender para qué es la foto… al terminar la serie le podría
// preguntar"). Cuándo se ofrece y cuántas veces: lib/fotoPregunta.js.
//
// Va donde estaba la pregunta del RIR y recién cuando esa se cerró: una
// pregunta por vez. Se pliega igual que ella (grid-template-rows, CSS).
import { useEffect, useRef, useState } from 'react';
import { S } from '../lib/state.js';
import { findEx, isUnilateral } from '../lib/session.js';
import { tocaOfrecerFoto, fotoOfrecida, fotoRechazada, fotoHecha } from '../lib/fotoPregunta.js';
import { createGym, setActiveGym, getPhoto, guardarFotoMaquina } from '../lib/gyms.js';
import { maquinaElegida } from '../lib/maquinas.js';
import { toast } from '../lib/toast.js';
import { Camera } from './Icon.jsx';

// Cada descanso cuenta una sola vez para el tope de "ignorada", aunque
// minimices y vuelvas a abrir el reloj.
const contadas = new Set();

export default function OfertaFoto({ serie }) {
  const [ex, setEx] = useState(null);
  const [cerrada, setCerrada] = useState(false);
  const inputRef = useRef(null);
  const clave = serie ? `${S.draft?.id}:${serie.exId}:${serie.idx}` : '';

  useEffect(() => {
    let vivo = true;
    setEx(null);
    setCerrada(false);
    const e = serie ? findEx(serie.exId) : null;
    if (!e || !tocaOfrecerFoto(e, serie.idx, { uni: isUnilateral(e) })) return undefined;
    const gymId = S.cfg.activeGym;
    const foto = gymId ? getPhoto(gymId, e.name, maquinaElegida(gymId, e.name)?.id) : Promise.resolve(null);
    foto.then(blob => {
      if (!vivo || blob) return;
      setEx(e);
      if (!contadas.has(clave)) { contadas.add(clave); fotoOfrecida(e.name); }
    }).catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  if (!ex) return null;

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let gymId = S.cfg.activeGym;
    let nuevo = false;
    // Las fotos se guardan por gimnasio. Sin uno elegido, alguien que empieza
    // no tiene por qué saberlo: se crea "Mi gimnasio" y se le avisa.
    if (!gymId) {
      const g = createGym('Mi gimnasio');
      await setActiveGym(g.id);
      gymId = g.id;
      nuevo = true;
    }
    const ok = await guardarFotoMaquina(gymId, ex.name, file, maquinaElegida(gymId, ex.name)?.id);
    if (!ok) return;
    await fotoHecha(ex.name);
    if (nuevo) toast('Foto guardada en «Mi gimnasio»');
    setCerrada(true);
  }

  function ahoraNo() {
    fotoRechazada(ex.name);
    setCerrada(true);
  }

  return (
    <div className={`rfs-foto-caja${cerrada ? ' cerrada' : ''}`} inert={cerrada || undefined}>
      <div className="rfs-foto">
        <div className="rfs-foto-t"><Camera size={18} /> ¿Le sacás foto a esta máquina?</div>
        <p className="rfs-foto-s">Así tu progreso queda guardado en ella y no se mezcla con el de otra.</p>
        <div className="dlg-fila">
          <button type="button" className="btn sm ghost" onClick={ahoraNo}>Ahora no</button>
          <button type="button" className="btn sm" onClick={() => inputRef.current?.click()}>Sacar foto</button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      </div>
    </div>
  );
}
