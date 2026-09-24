// Hook del gesto de volver (lib/atras.js): mientras `activo` sea true, volver
// llama a `cerrar` en vez de salir de la app.
import { useEffect, useRef } from 'react';
import { registrarAtras } from './atras.js';

export function useAtras(activo, cerrar) {
  // Siempre la última versión de `cerrar`, sin re-registrar la capa en cada
  // render (eso empujaría una entrada nueva al historial cada vez).
  const ref = useRef(cerrar);
  ref.current = cerrar;
  useEffect(() => {
    if (!activo) return undefined;
    return registrarAtras(() => ref.current());
  }, [activo]);
}
