// Puerto de <nav class="tabbar"> (index.html ~línea 690) + moveTabIndicator()
// (~línea 862). El original medía el botón .on con getBoundingClientRect()
// en cada cambio de pestaña, en resize y cuando cargaban las fuentes.
//
// Ya no se mide nada (G4, auditoría 2026-09): esa lectura, en un
// useLayoutEffect, forzaba un layout de la página entera justo cuando la
// pantalla nueva se acababa de montar — medido a 6×, ~340 ms del cambio de
// pestaña a Entreno. Los cuatro botones son de ancho igual (flex:1 con
// tope), así que dónde cae la píldora es aritmética: el CSS la calcula con
// el índice (--i) y el ancho de la barra en unidades de contenedor (cqw).
// Ver .tab-ind en styles.css.
const TABS = [
  {
    // Inicio toma el lugar de Hoy: la barra no crece. "Hoy" pasa a ser adonde
    // te lleva el botón grande de la portada.
    id: 'inicio', label: 'Inicio',
    path: 'M3.5 10.5 12 3.5l8.5 7',
    path2: 'M5.5 9v11.5h13V9',
  },
  {
    // El id sigue siendo 'rutina' a propósito aunque la etiqueta diga
    // "Entreno": ese id está guardado en S.cfg (la pestaña en la que quedaste)
    // y viaja en los backups. Cambiarlo dejaría a cualquier usuario existente
    // abriendo una pestaña que ya no existe, por un cambio de texto.
    id: 'rutina', label: 'Entreno',
    path: 'M8 3v4M16 3v4M3.5 10h17M8 14h3M8 17.5h6',
    rect: { x: 3.5, y: 5, width: 17, height: 16, rx: 3 },
  },
  {
    // "Comida" es la etiqueta del mockup, y además entra sin apretarse en la
    // píldora: "Nutrición" es la más larga de las cuatro y desbalanceaba el nav.
    id: 'nutri', label: 'Comida',
    path: 'M12 21c-4 0-7-3-7-7 0-5 4-7 7-11 3 4 7 6 7 11 0 4-3 7-7 7z',
    path2: 'M12 21c-2 0-3.5-1.6-3.5-3.5',
  },
  {
    id: 'prog', label: 'Progreso',
    path: 'M3.5 20.5h17',
    path2: 'M4.5 16.5 9.5 11l3.5 3.5 6.5-7',
    path3: 'M15 7.5h4.5V12',
  },
];

/** Dónde va la píldora: el índice de la pestaña activa. Si `active` no es
    una pestaña de la barra, se queda en la primera (antes se quedaba donde
    estaba; hoy App nunca pasa otra cosa: 'hoy' llega como 'inicio'). */
function indiceDePestana(active) {
  return Math.max(0, TABS.findIndex(t => t.id === active));
}

export default function TabBar({ active, onChange }) {
  return (
    <nav className="tabbar" style={{ '--n': TABS.length }}>
      <i className="tab-ind" aria-hidden="true" style={{ '--i': indiceDePestana(active) }}></i>
      {TABS.map(t => (
        <button
          key={t.id}
          type="button"
          className={active === t.id ? 'on' : ''}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <svg viewBox="0 0 24 24">
            {t.rect && <rect x={t.rect.x} y={t.rect.y} width={t.rect.width} height={t.rect.height} rx={t.rect.rx} />}
            <path d={t.path} />
            {t.path2 && <path d={t.path2} />}
            {t.path3 && <path d={t.path3} />}
          </svg>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
