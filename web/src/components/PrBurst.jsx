// El estallido de "nuevo récord", aislado en su propio módulo con un único
// objetivo: que `lottie-react` + `lottie-web` NO entren en el arranque.
//
// Son 320 KB de bundle —la dependencia más pesada de la app, el 24% del total—
// para reproducir un JSON de 6.8 KB, en UN solo lugar, y sólo cuando acabás de
// cerrar la sesión que generó el récord. Todo lo demás de la app ya se dibuja
// con WAAPI, GSAP o CSS.
//
// Importante por qué se hace así y no reemplazando la animación: la auditoría
// de rendimiento del HANDOFF concluyó que en una PWA instalada partir el bundle
// NO acelera las visitas siguientes (el service worker precachea todo igual).
// Lo que sí se paga en cada arranque en frío es el parse+eval. Sacar del
// arranque un módulo grande de uso raro ataca exactamente eso, y a diferencia
// de cambiar el burst por partículas propias, no toca nada de lo que Enzo ya ve.
//
// Se carga con React.lazy desde SessionView.jsx, con el trofeo fijo como
// fallback — que es el mismo símbolo que se muestra al reabrir una sesión vieja
// con récord, así que si la carga tarda no aparece un hueco ni un spinner
// nuevo, aparece lo que esa tarjeta muestra el resto del tiempo.
//
// lottie-react 3.x no tiene export default: el componente es `Lottie` nombrado,
// y el prop del JSON pasó a llamarse `src` (antes `animationData` en 1.x/2.x,
// la versión que documentan la mayoría de los tutoriales viejos).
import { Lottie } from 'lottie-react';
import prBurst from '../assets/lottie/pr-burst.json';

export default function PrBurst() {
  return (
    <Lottie
      src={prBurst}
      autoplay
      loop={false}
      style={{ width: 44, height: 44, flex: 'none' }}
    />
  );
}
