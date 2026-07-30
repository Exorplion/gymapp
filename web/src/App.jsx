import { useEffect } from 'react';
import { idbOpenOnce } from './lib/db.js';
import { S, useStore, bump, loadAll } from './lib/state.js';
import { applyComputedGoals } from './lib/macros.js';
import { startRest } from './lib/rest.js';
import { initDragListeners } from './lib/drag.js';
import Header from './components/Header.jsx';
import TabBar from './components/TabBar.jsx';
import Sheet from './components/Sheet.jsx';
import Toast from './components/Toast.jsx';
import RestTimer from './components/RestTimer.jsx';
import Confetti from './components/Confetti.jsx';

export default function App() {
  const store = useStore();

  // Puerto del arranque original (el script inline al final de index.html
  // hacía idbOpen().then(loadAll) antes de la primera render()). loadAll()
  // ya deja S.ready=true; acá además recalculamos las metas automáticas de
  // macros (por si cambió algo del perfil) antes del primer bump().
  useEffect(() => {
    idbOpenOnce().then(loadAll).then(() => {
      applyComputedGoals();
      bump();
    });
  }, []);

  // Registra los listeners globales de drag-and-drop (touchstart/mousedown/etc.,
  // drag.js) una sola vez, tal como pide el comentario de cabecera de
  // initDragListeners() en drag.js. No hay ningún [data-sort]/[data-sid] montado
  // todavía (Task 5 agrega esa marcación en Rutina/Hoy), así que hoy esto no
  // tiene nada que arrastrar — pero sin este efecto los listeners nunca se
  // registran y el drag quedaría muerto incluso después de que exista el markup.
  useEffect(() => {
    initDragListeners();
  }, []);

  if (!store.ready) {
    // body{background:var(--bg)} ya cubre el fondo (styles.css se importa
    // antes de este primer render), así que no hace falta un nodo de splash:
    // no renderizar nada no produce flash blanco.
    return null;
  }

  return (
    <>
      <Header />
      <main>
        {store.tab} view — not yet implemented
        {/* dev-only: no hay UI de sesión todavía (Task 6) para disparar
            startRest() de forma natural. import.meta.env.DEV hace que Vite
            elimine esta rama en el build de producción (npm run build), así
            que no queda alcanzable fuera de `npm run dev`. Quitar cuando la
            vista de Hoy llame a startRest() de verdad. */}
        {import.meta.env.DEV && (
          <button type="button" onClick={() => startRest()} style={{ marginTop: 12 }}>
            [dev] iniciar descanso
          </button>
        )}
      </main>
      <TabBar active={store.tab} onChange={t => { S.tab = t; bump(); }} />
      <Toast />
      <Sheet />
      <RestTimer />
      <Confetti />
    </>
  );
}
