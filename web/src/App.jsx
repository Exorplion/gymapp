import { useEffect } from 'react';
import { idbOpenOnce } from './lib/db.js';
import { S, useStore, bump, loadAll, closeSheet, openSheet } from './lib/state.js';
import { applyComputedGoals } from './lib/macros.js';
import { initDragListeners } from './lib/drag.js';
import { currentStreak } from './lib/streak.js';
import Header from './components/Header.jsx';
import TabBar from './components/TabBar.jsx';
import Sheet from './components/Sheet.jsx';
import Toast from './components/Toast.jsx';
import RestTimer from './components/RestTimer.jsx';
import Rutina from './components/screens/Rutina.jsx';
import Hoy, { SessStartInfo, HistDetail } from './components/screens/Hoy.jsx';
import Nutricion from './components/screens/Nutricion.jsx';
import Progreso from './components/screens/Progreso.jsx';
import DayEdit from './components/sheets/DayEdit.jsx';
import ExerciseForm from './components/sheets/ExerciseForm.jsx';
import Library from './components/sheets/Library.jsx';
import DayPeek from './components/sheets/DayPeek.jsx';
import ExInfo from './components/sheets/ExInfo.jsx';
import ReorderHoy from './components/sheets/ReorderHoy.jsx';
import StreakDetail from './components/sheets/StreakDetail.jsx';
import SessionRecap from './components/sheets/SessionRecap.jsx';
import Preworkout from './components/sheets/Preworkout.jsx';
import VoiceLog from './components/sheets/VoiceLog.jsx';
import MealForm from './components/sheets/MealForm.jsx';
import Profile from './components/sheets/Profile.jsx';
import BodyForm from './components/sheets/BodyForm.jsx';
import Guide from './components/sheets/Guide.jsx';
import Settings from './components/sheets/Settings.jsx';

// Confirm genérico (antes sheetConfirm() + PENDING_CONFIRM/PENDING_CANCEL
// globales en index.html). No es uno de los 5 sheets nombrados en el plan de
// Task 5 porque no es específico de Rutina — es infraestructura cross-cutting
// que Nutrición/Progreso/Ajustes también van a necesitar (mismo patrón
// title/body/confirmLabel/onConfirm/onCancel del original). Vive acá, junto
// al resto del "sheet dispatch", en vez de como su propio archivo bajo
// components/sheets/, para no inflar la lista de archivos de esta tarea con
// algo que no es un sheetXxx() propio de Rutina.
function ConfirmSheet({ title, body, confirmLabel, onConfirm, onCancel }) {
  function cancel() { if (onCancel) onCancel(); else closeSheet(); }
  function confirm() { closeSheet(); onConfirm?.(); }
  return (
    <>
      <h2>{title}</h2>
      <div className="txt-mut" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>{body}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn sm ghost" style={{ flex: 1 }} onClick={cancel}>Cancelar</button>
        <button type="button" className="btn sm danger" style={{ flex: 1 }} onClick={confirm}>{confirmLabel}</button>
      </div>
    </>
  );
}

// Qué componente renderizar según S.sheet.type — el equivalente de Task 5 al
// switch(data-act) del dispatcher ACT{} original, pero acotado a "qué
// contenido va dentro de <Sheet/>". Las pantallas siguientes (Hoy, Nutrición,
// Progreso, Ajustes) van a sumar sus propios casos acá mismo.
function SheetContent({ sheet }) {
  if (!sheet) return null;
  switch (sheet.type) {
    case 'day-edit': return <DayEdit {...sheet.props} />;
    case 'ex-form': return <ExerciseForm {...sheet.props} />;
    case 'library': return <Library {...sheet.props} />;
    case 'day-peek': return <DayPeek {...sheet.props} />;
    case 'ex-info': return <ExInfo {...sheet.props} />;
    case 'confirm': return <ConfirmSheet {...sheet.props} />;
    case 'reorder-hoy': return <ReorderHoy {...sheet.props} />;
    case 'streak-detail': return <StreakDetail {...sheet.props} />;
    case 'session-recap': return <SessionRecap {...sheet.props} />;
    case 'preworkout': return <Preworkout {...sheet.props} />;
    case 'voice-log': return <VoiceLog {...sheet.props} />;
    case 'sess-start-info': return <SessStartInfo {...sheet.props} />;
    case 'hist-detail': return <HistDetail {...sheet.props} />;
    case 'meal-form': return <MealForm {...sheet.props} />;
    case 'profile': return <Profile {...sheet.props} />;
    case 'body-form': return <BodyForm {...sheet.props} />;
    case 'guide': return <Guide {...sheet.props} />;
    case 'settings': return <Settings {...sheet.props} />;
    default: return null;
  }
}

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
  // initDragListeners() en drag.js. Desde Task 5, Rutina.jsx ya monta markup
  // real con [data-sort]/[data-sid] (días y ejercicios dentro de un día), así
  // que sin este efecto el drag quedaría muerto.
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
      <Header streak={currentStreak()} onOpenStreak={() => openSheet('streak-detail')} onOpenSettings={() => openSheet('settings')} />
      <main>
        {store.tab === 'hoy' && <Hoy />}
        {store.tab === 'rutina' && <Rutina />}
        {store.tab === 'nutri' && <Nutricion />}
        {store.tab === 'prog' && <Progreso />}
      </main>
      <TabBar active={store.tab} onChange={t => { S.tab = t; bump(); }} />
      <Toast />
      <Sheet open={!!store.sheet} onClose={closeSheet}>
        <SheetContent sheet={store.sheet} />
      </Sheet>
      <RestTimer />
    </>
  );
}
