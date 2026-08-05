import { useLayoutEffect, useRef } from 'react';

// Puerto de <nav class="tabbar"> (index.html ~línea 690) + moveTabIndicator()
// (~línea 862). El original mide el botón .on con getBoundingClientRect()
// cada vez que cambia S.tab (llamado a mano dentro de switchTab()), en
// resize, y una vez cuando document.fonts.ready resuelve (los botones son
// flex, así que su ancho depende de la fuente ya cargada). Acá el mismo
// cálculo corre en un useLayoutEffect con `active` como dependencia — se
// dispara antes del paint, igual que la llamada síncrona original evitaba
// un flash del chip en la posición vieja.
const TABS = [
  {
    // Inicio toma el lugar de Hoy: la barra no crece. "Hoy" pasa a ser adonde
    // te lleva el botón grande de la portada.
    id: 'inicio', label: 'Inicio',
    path: 'M3.5 10.5 12 3.5l8.5 7',
    path2: 'M5.5 9v11.5h13V9',
  },
  {
    id: 'rutina', label: 'Rutina',
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

export default function TabBar({ active, onChange }) {
  const navRef = useRef(null);
  const indRef = useRef(null);

  useLayoutEffect(() => {
    const nav = navRef.current, ind = indRef.current;
    if (!nav || !ind) return;
    function moveTabIndicator() {
      const btn = nav.querySelector('button.on');
      if (!btn) return;
      const b = btn.getBoundingClientRect(), n = nav.getBoundingClientRect();
      ind.style.width = Math.round(b.width) + 'px';
      ind.style.transform = `translateX(${Math.round(b.left - n.left)}px)`;
    }
    moveTabIndicator();
    addEventListener('resize', moveTabIndicator);
    document.fonts?.ready?.then(moveTabIndicator);
    return () => removeEventListener('resize', moveTabIndicator);
  }, [active]);

  return (
    <nav className="tabbar" ref={navRef}>
      <i className="tab-ind" aria-hidden="true" ref={indRef}></i>
      {TABS.map(t => (
        <button
          key={t.id}
          type="button"
          className={active === t.id ? 'on' : ''}
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
