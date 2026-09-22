/* Ver la foto de la máquina, no volver a sacarla.
   Enzo: "presiono el ícono que muestra la foto y me vuelve a decir para tomar
   una nueva foto. No debería ser así: si presiono ese recuadro con la foto que
   ya tomé, solo me la debería mostrar". La miniatura de 56px sirve para
   reconocer de un vistazo cuál era la máquina, pero no para MIRARLA — y tocar
   algo que muestra contenido tiene que mostrar ese contenido, no destruirlo.
   Reemplazar y borrar siguen estando, pero como lo que son: acciones
   destructivas, detrás del confirm genérico de App.jsx.

   La foto se vuelve a leer del store acá adentro (no se recibe la URL por
   props) para que el object URL nazca y muera con ESTE componente: si el sheet
   heredara la URL de GymPhoto y GymPhoto se desmontara —pasa apenas cambiás de
   ejercicio— la imagen quedaría apuntando a un blob ya revocado, o sea rota. */
import { useEffect, useRef, useState } from 'react';
import { openSheet } from '../../lib/state.js';
import { getPhoto } from '../../lib/gyms.js';

export default function GymPhotoView({ gymId, gymName, exName, onReemplazar, onBorrar }) {
  const [url, setUrl] = useState(null);
  const [falta, setFalta] = useState(false);
  const urlRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    getPhoto(gymId, exName).then(blob => {
      if (cancelado) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const next = blob ? URL.createObjectURL(blob) : null;
      urlRef.current = next;
      setUrl(next);
      setFalta(!blob);
    }).catch(() => { if (!cancelado) setFalta(true); });
    return () => {
      cancelado = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [gymId, exName]);

  function pedirReemplazo() {
    openSheet('confirm', {
      title: '¿Reemplazar la foto?',
      body: `Se abre la cámara y la foto que sacaste ahora pisa a la que ya tenías de ${exName}. La anterior no se puede recuperar.`,
      confirmLabel: 'Sacar otra',
      onConfirm: onReemplazar,
    });
  }

  function pedirBorrado() {
    openSheet('confirm', {
      title: '¿Borrar la foto?',
      body: `${exName} se queda sin foto en ${gymName || 'este gym'}. Podés volver a sacarla cuando quieras.`,
      confirmLabel: 'Borrar',
      onConfirm: onBorrar,
    });
  }

  return (
    <>
      <h2>{exName}</h2>
      <div className="txt-mut" style={{ fontSize: 14, marginBottom: 'var(--s4)' }}>
        La máquina que usás en {gymName || 'tu gym activo'}.
      </div>
      {/* La ausencia de foto se dice, no se disfraza de recuadro vacío: puede
          pasar si la borraste desde otra pestaña mientras esto estaba abierto. */}
      {falta ? (
        <div className="txt-mut" style={{ fontSize: 14, marginBottom: 'var(--s4)' }}>
          Esta foto ya no está guardada.
        </div>
      ) : (
        <figure className="photo-full">
          {url && <img src={url} alt={`Máquina de ${exName} en ${gymName || 'tu gym'}`} />}
        </figure>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn sm ghost" style={{ flex: 1 }} onClick={pedirReemplazo}>
          ✎ Reemplazar
        </button>
        {!falta && (
          <button type="button" className="btn sm danger" style={{ flex: 1 }} onClick={pedirBorrado}>
            Borrar
          </button>
        )}
      </div>
    </>
  );
}
