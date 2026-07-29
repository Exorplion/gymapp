import { useEffect } from 'react';
import { idbOpenOnce } from './lib/db.js';
import { S, useStore, bump, loadAll } from './lib/state.js';
import { applyComputedGoals } from './lib/macros.js';
import Header from './components/Header.jsx';
import TabBar from './components/TabBar.jsx';
import Sheet from './components/Sheet.jsx';
import Toast from './components/Toast.jsx';

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

  if (!store.ready) {
    // body{background:var(--bg)} ya cubre el fondo (styles.css se importa
    // antes de este primer render), así que no hace falta un nodo de splash:
    // no renderizar nada no produce flash blanco.
    return null;
  }

  return (
    <>
      <Header />
      <main>{store.tab} view — not yet implemented</main>
      <TabBar active={store.tab} onChange={t => { S.tab = t; bump(); }} />
      <Toast />
      <Sheet />
    </>
  );
}
