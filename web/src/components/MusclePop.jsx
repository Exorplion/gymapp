// El globo que sale al tocar un músculo en Inicio.
//
// Antes salía pegado al músculo (ancla x/y contra el punto tocado): la
// pregunta que estás haciendo es "¿y este de acá?", y una hoja que tapa media
// pantalla te hace perder de vista el cuerpo justo cuando lo estás mirando.
// El problema: la ventanita median por aproximación (190px fijos) contra una
// altura real de 280-330px según cuántas fibras mostrara, y sólo se
// clampeaba contra el borde X — con un músculo cerca de arriba del cuerpo
// (pecho, deltoides, trapecio) la cabecera con el nombre y la × de cerrar
// quedaba con `top` negativo, invisible.
//
// Ahora Silhouette.jsx hace zoom al músculo tocado (así seguís viéndolo, sólo
// que agrandado) y esta ficha se ancla siempre al borde inferior de
// `.sil-pair` (el contenedor de la silueta, ya contenido en pantalla): no
// depende de ninguna coordenada de toque, así que no hay forma de que se
// salga de cuadro.
//
// Muestra hechos medidos y ninguna recomendación. La app sabe cuántas series
// hiciste; no sabe si son pocas.
//
// Desborde: la ficha no tenía tope de alto. Anclada a bottom:0 dentro de
// `.sil-pair`, un grupo con muchas fibras —Pierna: cuádriceps, isquios y
// aductores, nueve ejercicios— crecía hacia arriba hasta pasarse del
// contenedor y se cortaba contra el borde de la pantalla. Ahora la ficha tiene
// tope (`max-height` en `.mpop`) y lo único de alto variable —la lista de
// ejercicios— vive en un contenedor con scroll propio: cabecera, números y pie
// quedan siempre visibles.
import { useEffect, useRef } from 'react';
import { diasTexto } from '../lib/muscle.js';
import { bloomOpen } from '../lib/motion.js';
import { X } from './Icon.jsx';

/** Volumen en kg, corto: 12.4k en vez de 12380. */
function kilos(v) {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)}k`;
  return String(v);
}

/* `porcion` es opcional: `{ nombre, dias }` de la PORCIÓN que se tocó en la
   figura (ver Silhouette.jsx). Existe porque el mapa grande enciende porciones
   —trapecio, dorsal alto, dorsal bajo— y la cabecera mostraba el dato del grupo
   grueso: tocabas el trapecio pintado gris de "nunca" y la ficha te decía
   "Espalda · hoy". Desde 2026-09-24 también el cuerpo de la ficha es de la
   porción: Silhouette le pide a groupStats las cifras acotadas. */
/**
 * Qué dice la cabecera: el nombre y los días de los que se va a hablar.
 *
 * Pura y exportada a propósito — es la regla que se rompía (el badge decía
 * "hoy" sobre un trapecio nunca entrenado) y acá se puede testear sin montar
 * React, igual que claseDeZona en Silhouette.jsx.
 *
 * `porcion.dias` puede ser `null`: una porción sin registro es "nunca", y eso
 * NO se sustituye por el dato del grupo — sería justo la mentira que esto
 * viene a arreglar.
 */
export function cabeceraDe(cat, dias, porcion = null) {
  if (!porcion) return { nombre: cat, dias };
  return { nombre: `${cat} · ${porcion.nombre.toLowerCase()}`, dias: porcion.dias ?? null };
}

export default function MusclePop({ stats, porcion = null, onClose }) {
  const { cat, dias, sets, sesiones, porSemana, volumen, mejor, top, fibras, ventana } = stats;
  const nunca = dias === null;
  const { nombre: nombreHead, dias: diasHead } = cabeceraDe(cat, dias, porcion);
  const popRef = useRef(null);

  // Bloom-open al aparecer como hoja desde abajo: sale del borde, no salta de golpe.
  useEffect(() => { bloomOpen(popRef.current); }, []);

  return (
    <div
      ref={popRef}
      className="mpop"
      role="dialog"
      aria-label={porcion ? `Estadísticas de ${cat}, ${porcion.nombre.toLowerCase()}` : `Estadísticas de ${cat}`}
    >
      {/* El nombre manda y la frescura va debajo, no al lado. Antes el badge
          de días competía con el nombre por el mismo renglón; apilados se
          leen en orden y la cabecera deja de ser una fila de tres cosas. */}
      <div className="mpop-head">
        <div className="mpop-title">
          {/* "Espalda · trapecio": el grupo da contexto y la porción dice qué
              tocaste. En minúscula porque es una parte del de al lado, no otro
              título. */}
          <span className="mpop-name">{nombreHead}</span>
          <span className={`mpop-when t${diasHead === null ? 'n' : diasHead <= 1 ? '0' : diasHead <= 3 ? '1' : diasHead <= 6 ? '2' : '3'}`}>
            {diasTexto(diasHead)}
          </span>
        </div>
        <button type="button" className="mpop-x" onClick={onClose} aria-label="Cerrar"><X /></button>
      </div>

      {/* Antes esto sólo cubría "nunca" (dias===null): si lo habías
          entrenado alguna vez pero no dentro de la ventana de 28 días, caía
          al bloque de abajo y mostraba "0 series · 0 sesiones · 0 por sem." —
          técnicamente correcto pero mudo sobre el porqué, cuando el dato
          real (hace cuántos días) ya estaba arriba en el badge. Mismo
          principio que el estado "Locked" de Ultrahuman: explicar la
          condición en vez de mostrar un bloque en cero. */}
      {sets === 0 ? (
        <p className="mpop-vacio">
          {nunca
            ? `Todavía no registraste nada de ${porcion ? 'esta porción' : 'este grupo'}.`
            : `Sin series en los últimos ${ventana} días.`}
        </p>
      ) : (
        <>
          <div className="mpop-nums">
            <div><b>{sets}</b><span>series</span></div>
            <div><b>{sesiones}</b><span>sesiones</span></div>
            <div><b>{porSemana}</b><span>por sem.</span></div>
          </div>

          {/* Lo único de alto variable —la lista de ejercicios— es lo único
              que scrollea. Los tres números de arriba quedan fuera: son el
              resumen, y un resumen que hay que ir a buscar no es un resumen.

              Por fibra cuando hay más de una fibra real que distinguir (ver
              groupStats en lib/muscle.js) — reemplaza a la lista plana y no
              se muestra junto a ella, porque diría lo mismo dos veces. Sin
              eso —Glúteo, Gemelos, cualquier grupo donde todo cae en la
              misma bolsa— la lista plana de siempre. */}
          <div className="mpop-scroll">
            {fibras ? (
              <div className="mpop-fibras">
                {fibras.map(f => (
                  /* La porción tocada se marca en el desglose para no obligar
                     a buscarla con el ojo. Sutil —un punto y el nombre en
                     claro, con tokens— porque el dato sigue siendo la lista;
                     esto es sólo dónde mirar primero. */
                  <div key={f.fibra} className={`mpop-fibra${porcion && f.fibra === porcion.nombre ? ' on' : ''}`}>
                    <div className="mpop-fibra-nombre">{f.fibra}</div>
                    <ul className="mpop-list">
                      {f.ejercicios.map(e => (
                        <li key={e.name}><span>{e.name}</span><b>{e.sets}</b></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : top.length > 0 && (
              <ul className="mpop-list">
                {top.map(t => (
                  <li key={t.name}><span>{t.name}</span><b>{t.sets}</b></li>
                ))}
              </ul>
            )}
          </div>

        </>
      )}

      {/* Un solo pie. Antes eran dos renglones —tope/volumen y el caption
          "últimos N días"— que decían cosas del mismo rango de importancia a
          dos alturas distintas. La ventana es contexto de todo lo de arriba,
          no un título aparte: va al final de la misma línea. */}
      <div className="mpop-pie">
        {sets > 0 && mejor && mejor.w > 0 && <span className="mpop-top">Tope {mejor.w} kg × {mejor.r}</span>}
        {sets > 0 && volumen > 0 && <span>{kilos(volumen)} kg movidos</span>}
        <span className="mpop-vent">últimos {ventana} días</span>
      </div>
    </div>
  );
}
