// Foto de la máquina, tomada por vos y guardada en el ejercicio.
//
// Por qué la foto propia y no una ilustración de catálogo: las bases abiertas
// de ejercicios (free-exercise-db, wger) tienen el MOVIMIENTO, no la máquina
// concreta de tu gimnasio — y las fotos de máquinas por marca son material de
// los fabricantes, con derechos. Tu foto además es más útil: reconocés esa
// máquina, no una parecida.
//
// Se guarda como data URL dentro del ejercicio, en el mismo store de rutina
// que todo lo demás. Por eso importa reducirla: una foto de celular son varios
// MB, y multiplicado por decenas de ejercicios llenaría IndexedDB. 480px de
// lado mayor con JPEG al 70% deja un archivo de ~40-60 KB, más que suficiente
// para reconocer una máquina de un vistazo.
const MAX_SIDE = 480;
const QUALITY = 0.7;

/**
 * Toma el File del input de cámara y devuelve un data URL reducido.
 * Rechaza si el archivo no es una imagen o si el navegador no puede decodificarla.
 */
export function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('El archivo no es una imagen'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const cx = cv.getContext('2d');
      // Fondo negro: si la foto viene con transparencia, el JPEG la pintaría
      // de blanco y desentonaría con el resto de la interfaz.
      cx.fillStyle = '#04070F';
      cx.fillRect(0, 0, w, h);
      cx.drawImage(img, 0, 0, w, h);
      try {
        resolve(cv.toDataURL('image/jpeg', QUALITY));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

/** Tamaño aproximado en KB de un data URL, para poder avisarlo. */
export function dataUrlKB(dataUrl) {
  if (!dataUrl) return 0;
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.round((b64.length * 3 / 4) / 1024);
}
