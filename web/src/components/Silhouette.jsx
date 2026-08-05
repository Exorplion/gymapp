// Las dos siluetas de la pantalla de inicio: frente y espalda, con cada grupo
// muscular coloreado según hace cuántos días lo entrenaste.
//
// Anatómico y no geométrico: a ~330px de alto, que es el tamaño real en
// pantalla, el argumento de "las formas simples se leen mejor en chico" no
// aplica porque no es chico. Las formas son reconocibles —el abanico del
// pectoral, la V del dorsal, la gota del cuádriceps, el diamante del gemelo—
// pero el relleno es liso, sin sombreado ni textura: diagrama técnico, no
// lámina de medicina.
//
// Dos vistas y no una porque con los nueve grupos de FIERRO la espalda y el
// glúteo no existen de frente, y el tríceps casi no se ve. Y hay un efecto de
// composición: dos cuerpos simétricos con zonas marcadas es la forma de una
// lámina de anatomía, no la de un avatar de videojuego.
//
// Se dibuja SÓLO la mitad izquierda de cada cuerpo dentro de <defs>, y la
// derecha es un <use> espejado. La mitad del trazado, simetría exacta, y
// cambiar la forma del dorsal la cambia en los dos lados. La cabeza y el
// cuello van aparte porque no se espejan.
//
// Este componente no calcula nada: recibe el mapa {grupo: días} y lo pinta.
// El cálculo vive en lib/muscle.js.

/** Días → clase de color.

    `null` (nunca entrenado) se pinta neutro y callado: no es lo mismo que
    "hace mucho", y marcarlo sería gritarle a alguien recién llegado por algo
    que todavía no hizo mal. */
function tono(d) {
  if (d === null || d === undefined) return 'sil-none';
  if (d <= 1) return 'sil-d0';
  if (d <= 3) return 'sil-d1';
  if (d <= 6) return 'sil-d2';
  return 'sil-d3';
}

export default function Silhouette({ days = {} }) {
  // El trapecio pinta con Espalda: FIERRO no lo tiene como grupo propio y
  // catOf manda ahí los remos. Los antebrazos van neutros — no los
  // rastreamos, y pintarlos sería inventar un dato.
  const t = c => tono(days[c]);

  return (
    <div className="sil-pair">
      <div className="sil-box">
        <svg viewBox="0 0 120 250" role="img" aria-label="Músculos del frente">
          <use href="#sil-fh" /><use href="#sil-fh" transform="translate(120,0) scale(-1,1)" />
          <ellipse className="sil-skin" cx="60" cy="20" rx="12" ry="14.5" />
          <path className="sil-skin" d="M53,32 L67,32 L68,44 L52,44 Z" />
          <ellipse className="sil-edge" cx="60" cy="20" rx="12" ry="14.5" />
        </svg>
        <span>Frente</span>
      </div>

      <div className="sil-box">
        <svg viewBox="0 0 120 250" role="img" aria-label="Músculos de la espalda">
          <use href="#sil-bh" /><use href="#sil-bh" transform="translate(120,0) scale(-1,1)" />
          <ellipse className="sil-skin" cx="60" cy="20" rx="12" ry="14.5" />
          <path className="sil-skin" d="M53,32 L67,32 L68,44 L52,44 Z" />
          <ellipse className="sil-edge" cx="60" cy="20" rx="12" ry="14.5" />
        </svg>
        <span>Espalda</span>
      </div>

      {/* Los trazados, una sola vez. Viven acá y no en un archivo aparte
          porque sólo los usa este componente. */}
      <svg width="0" height="0" className="sil-defs" aria-hidden="true"><defs>

        <g id="sil-fh">
          {/* brazo y antebrazo: sin grupo propio, van neutros */}
          <path className="sil-skin" d="M25,57 C19,61 15,71 14,84 L13,104 C13,114 15,124 18,131 L24,130 C22,121 21,111 21,101 L23,84 C24,74 27,66 31,62 Z" />
          <path className="sil-skin" d="M60,44 C50,43 41,45 35,50 C29,56 27,66 27,76 L29,96 C31,110 34,124 38,134 L60,136 Z" />
          <path className="sil-skin" d="M60,136 L38,134 C35,146 34,162 35,178 L37,198 C38,210 40,224 42,236 L52,237 C54,222 55,206 56,190 L60,160 Z" />
          {/* deltoides anterior */}
          <path className={`sil-z ${t('Hombro')}`} d="M40,46 C32,49 28,57 28,66 C33,68 39,66 43,62 C45,55 44,49 42,46 Z" />
          {/* pectoral: el abanico desde el esternón */}
          <path className={`sil-z ${t('Pecho')}`} d="M58,46 C50,46 42,49 38,55 C35,62 36,70 40,75 C46,79 54,79 58,76 Z" />
          {/* bíceps: el pico */}
          <path className={`sil-z ${t('Bíceps')}`} d="M27,63 C22,68 19,77 19,88 C19,95 21,101 24,104 C28,103 30,97 30,90 L31,72 C31,67 30,64 27,63 Z" />
          {/* recto abdominal y oblicuo */}
          <path className={`sil-z ${t('Abs')}`} d="M58,79 L45,80 C44,92 45,106 48,118 C51,124 55,127 58,127 Z" />
          <path className={`sil-z ${t('Abs')}`} d="M43,80 C40,88 40,100 42,110 L46,118 C44,106 43,92 44,80 Z" />
          {/* cuádriceps: la gota */}
          <path className={`sil-z ${t('Pierna')}`} d="M56,142 C48,141 41,144 39,152 C36,164 36,178 38,190 C40,196 45,198 49,195 C52,184 54,170 56,156 Z" />
          {/* gemelo */}
          <path className={`sil-z ${t('Gemelos')}`} d="M46,202 C41,204 38,212 38,222 C38,230 40,236 43,238 C47,237 49,231 49,223 L48,208 Z" />
          <g className="sil-sep">
            <path d="M46,92 L58,92" /><path d="M47,104 L58,104" /><path d="M49,115 L58,115" />
          </g>
          <g className="sil-edge">
            <path d="M60,44 C50,43 41,45 35,50 C29,56 27,66 27,76 L29,96 C31,110 34,124 38,134" />
            <path d="M38,134 C35,146 34,162 35,178 L37,198 C38,210 40,224 42,236" />
          </g>
        </g>

        <g id="sil-bh">
          <path className="sil-skin" d="M25,57 C19,61 15,71 14,84 L13,104 C13,114 15,124 18,131 L24,130 C22,121 21,111 21,101 L23,84 C24,74 27,66 31,62 Z" />
          <path className="sil-skin" d="M60,44 C50,43 41,45 35,50 C29,56 27,66 27,76 L29,96 C31,108 34,120 38,130 L60,132 Z" />
          <path className="sil-skin" d="M60,132 L38,130 C35,142 34,160 35,178 L37,198 C38,210 40,224 42,236 L52,237 C54,222 55,206 56,190 L60,158 Z" />
          {/* deltoides posterior */}
          <path className={`sil-z ${t('Hombro')}`} d="M40,46 C32,49 28,57 28,66 C33,68 39,66 43,62 C45,55 44,49 42,46 Z" />
          {/* trapecio y dorsal ancho: los dos pintan con Espalda */}
          <path className={`sil-z ${t('Espalda')}`} d="M60,42 L48,46 C44,52 42,58 42,64 L60,68 Z" />
          <path className={`sil-z ${t('Espalda')}`} d="M42,66 C36,72 32,82 31,92 C33,102 37,110 42,116 L60,110 L60,70 Z" />
          {/* tríceps: la herradura */}
          <path className={`sil-z ${t('Tríceps')}`} d="M27,63 C22,68 19,77 19,88 C19,95 21,101 24,104 C28,103 30,97 30,90 L31,72 C31,67 30,64 27,63 Z" />
          {/* glúteo */}
          <path className={`sil-z ${t('Glúteo')}`} d="M58,124 C48,123 40,127 37,136 C35,146 37,155 43,159 C50,161 56,157 58,150 Z" />
          {/* femoral */}
          <path className={`sil-z ${t('Pierna')}`} d="M56,163 C48,162 41,165 39,173 C37,184 37,196 39,206 C42,211 47,211 50,207 C53,196 54,180 56,170 Z" />
          {/* gemelo: el diamante del gastrocnemio */}
          <path className={`sil-z ${t('Gemelos')}`} d="M47,210 C41,212 38,220 38,229 C38,236 40,241 43,242 C47,241 49,235 49,227 L48,215 Z" />
          <g className="sil-edge">
            <path d="M60,44 C50,43 41,45 35,50 C29,56 27,66 27,76 L29,96 C31,108 34,120 38,130" />
            <path d="M38,130 C35,142 34,160 35,178 L37,198 C38,210 40,224 42,236" />
          </g>
        </g>

      </defs></svg>
    </div>
  );
}
