import { useEffect, useMemo, useRef, useState } from 'react';
import { idbOpenOnce } from './lib/db.js';
import { S, useStore, bump, loadAll, closeSheet, openSheet, TAB_ORDEN, changeTab, lastTabChangeUsedVT } from './lib/state.js';
import { applyComputedGoals } from './lib/macros.js';
import { initDragListeners } from './lib/drag.js';
import { currentStreak } from './lib/streak.js';
import { sessionExs } from './lib/session.js';
import { mostrarSesion, ocultarSesion } from './lib/ongoing.js';
import { aplicarPaleta } from './lib/theme.js';
import Header from './components/Header.jsx';
import TabBar from './components/TabBar.jsx';
import Sheet from './components/Sheet.jsx';
import Toast from './components/Toast.jsx';
import RestTimer from './components/RestTimer.jsx';
import SessionComplete from './components/SessionComplete.jsx';
import Rutina from './components/screens/Rutina.jsx';
import Inicio from './components/screens/Inicio.jsx';
import Hoy, { SessStartInfo } from './components/screens/Hoy.jsx';
import Nutricion from './components/screens/Nutricion.jsx';
import Progreso from './components/screens/Progreso.jsx';
import SlotEdit from './components/sheets/SlotEdit.jsx';
import DayDrop from './components/sheets/DayDrop.jsx';
import CopyExercises from './components/sheets/CopyExercises.jsx';
import SessionExercise from './components/sheets/SessionExercise.jsx';
import EntryEdit from './components/sheets/EntryEdit.jsx';
import ExerciseForm from './components/sheets/ExerciseForm.jsx';
import Library from './components/sheets/Library.jsx';
import DayPeek from './components/sheets/DayPeek.jsx';
import ExInfo from './components/sheets/ExInfo.jsx';
import ReorderHoy from './components/sheets/ReorderHoy.jsx';
import History from './components/sheets/History.jsx';
import FoodVoice from './components/sheets/FoodVoice.jsx';
import StreakDetail from './components/sheets/StreakDetail.jsx';
import SessionView from './components/sheets/SessionView.jsx';
import Preworkout from './components/sheets/Preworkout.jsx';
import VoiceLog from './components/sheets/VoiceLog.jsx';
import MealForm from './components/sheets/MealForm.jsx';
import Profile from './components/sheets/Profile.jsx';
import BodyForm from './components/sheets/BodyForm.jsx';
import Guide from './components/sheets/Guide.jsx';
import Settings from './components/sheets/Settings.jsx';
import BodyMap from './components/sheets/BodyMap.jsx';
import Gyms from './components/sheets/Gyms.jsx';
import GymEquip from './components/sheets/GymEquip.jsx';
import RoutineWizard from './components/sheets/RoutineWizard.jsx';

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
    case 'slot-edit': return <SlotEdit {...sheet.props} />;
    case 'day-drop': return <DayDrop {...sheet.props} />;
    case 'copy-exs': return <CopyExercises {...sheet.props} />;
    case 'ex-swap': return <SessionExercise {...sheet.props} />;
    case 'entry-edit': return <EntryEdit {...sheet.props} />;
    case 'ex-form': return <ExerciseForm {...sheet.props} />;
    case 'library': return <Library {...sheet.props} />;
    case 'routine-wizard': return <RoutineWizard {...sheet.props} />;
    case 'day-peek': return <DayPeek {...sheet.props} />;
    case 'ex-info': return <ExInfo {...sheet.props} />;
    case 'confirm': return <ConfirmSheet {...sheet.props} />;
    case 'reorder-hoy': return <ReorderHoy {...sheet.props} />;
    case 'streak-detail': return <StreakDetail {...sheet.props} />;
    case 'history': return <History {...sheet.props} />;
    case 'food-voice': return <FoodVoice {...sheet.props} />;
    case 'session-view': return <SessionView {...sheet.props} />;
    case 'preworkout': return <Preworkout {...sheet.props} />;
    case 'voice-log': return <VoiceLog {...sheet.props} />;
    case 'sess-start-info': return <SessStartInfo {...sheet.props} />;
    case 'meal-form': return <MealForm {...sheet.props} />;
    case 'profile': return <Profile {...sheet.props} />;
    case 'body-form': return <BodyForm {...sheet.props} />;
    case 'guide': return <Guide {...sheet.props} />;
    case 'settings': return <Settings {...sheet.props} />;
    case 'body-map': return <BodyMap {...sheet.props} />;
    case 'gyms': return <Gyms {...sheet.props} />;
    case 'gym-equip': return <GymEquip {...sheet.props} />;
    default: return null;
  }
}

/* Orden de las pantallas, para saber hacia qué lado entra la nueva al
   cambiar de pestaña (con la barra de abajo — el swipe de pantalla completa
   se sacó: cualquier gesto horizontal, en cualquier parte, terminaba
   cambiando de pestaña sin querer).

   "Hoy" va pegado a Inicio porque se entra desde ahí: yendo a Hoy la pantalla
   avanza, y al volver retrocede. La barra de abajo no lo muestra como pestaña,
   pero el movimiento tiene que contar la misma historia.

   Vive en state.js (TAB_ORDEN) y no acá: changeTab() necesita el mismo orden
   para calcular la dirección ANTES de que exista ningún componente montado. */
const ORDEN = TAB_ORDEN;

/* Qué componente va para cada pestaña — la usan tanto la pantalla activa
   como la saliente (Task de transición), así que vive aparte del JSX del
   render para no duplicar el bloque de cinco casos. */
function pantallaDe(tab) {
  switch (tab) {
    case 'inicio': return <Inicio />;
    case 'hoy': return <Hoy />;
    case 'rutina': return <Rutina />;
    case 'nutri': return <Nutricion />;
    case 'prog': return <Progreso />;
    default: return null;
  }
}

export default function App() {
  const store = useStore();

  /* La animación de deslizamiento ya estaba en la hoja de estilos —slideR y
     slideL— y la usaba la app original; se perdió al migrar a React y las
     pantallas pasaron a aparecer de golpe. Esto la vuelve a enchufar.

     La dirección sale del orden de las pantallas: si vas hacia la derecha de la
     barra, la nueva entra desde la derecha. Sin eso el movimiento sería siempre
     igual y no diría nada sobre dónde estás parado. */
  const tabPrevio = useRef(store.tab);
  const dir = useMemo(() => {
    const antes = ORDEN.indexOf(tabPrevio.current);
    const ahora = ORDEN.indexOf(store.tab);
    return ahora < antes ? 'l' : 'r';
  }, [store.tab]);

  /* Antes sólo existía la pantalla activa: al cambiar de pestaña, la vieja
     desaparecía de golpe y sólo la nueva entraba animada — un corte, no un
     deslizamiento. Acá, mientras dura la transición (340ms, mismo tiempo que
     ya usa .view.enter — bajado de 260ms porque se sentía apurado, no como
     el push/pop de una app nativa), se guarda cuál era la pantalla anterior
     para poder pintarla también: sale deslizando hacia el lado opuesto de
     por donde entra la nueva, las dos a la vez. La mutación de
     tabPrevio.current se hace ACÁ (no en el useMemo de arriba) para que dir
     se calcule contra el valor viejo antes de perderlo. */
  const [saliente, setSaliente] = useState(null); // {tab, dir} | null
  const salienteTimer = useRef(null);
  useEffect(() => {
    if (store.tab === tabPrevio.current) return;
    if (lastTabChangeUsedVT) { tabPrevio.current = store.tab; return; }
    setSaliente({ tab: tabPrevio.current, dir });
    tabPrevio.current = store.tab;
    clearTimeout(salienteTimer.current);
    salienteTimer.current = setTimeout(() => setSaliente(null), 340);
    return () => clearTimeout(salienteTimer.current);
  }, [store.tab, dir]);

  // Puerto del arranque original (el script inline al final de index.html
  // hacía idbOpen().then(loadAll) antes de la primera render()). loadAll()
  // ya deja S.ready=true; acá además recalculamos las metas automáticas de
  // macros (por si cambió algo del perfil) antes del primer bump().
  useEffect(() => {
    idbOpenOnce().then(loadAll).then(() => {
      applyComputedGoals();
      // El color se aplica ACÁ, apenas se conoce S.cfg, y no cuando se abre
      // Ajustes: si no, la app arrancaría siempre con el azul de fábrica y
      // recién cambiaría al tuyo si entrabas a Ajustes.
      aplicarPaleta(S.cfg.themeColor);
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

  // El aviso de "sesión en curso" en la barra del teléfono.
  //
  // Va acá, atado a si HAY sesión, en vez de encenderlo en startSession() y
  // apagarlo en los tres lugares que la terminan (completar, descartar,
  // recargar con un borrador viejo). Un solo punto no se puede desincronizar.
  //
  // Lee S.draft dentro del callback y no en las dependencias: la sesión cambia
  // a cada serie, y pasar una foto de cómo estaba al arrancar dejaría el aviso
  // mintiendo desde el primer ejercicio.
  const haySesion = !!store.draft;
  useEffect(() => {
    if (!haySesion) return ocultarSesion();
    mostrarSesion(() => {
      const d = S.draft;
      if (!d) return null;
      const entries = Object.values(d.entries || {});
      return {
        start: d.start,
        hechos: entries.filter(e => e.sets?.length).length,
        total: sessionExs(S.routine.findIndex(s => s.id === d.slotId)).length,
        series: entries.reduce((a, e) => a + (e.sets?.length || 0), 0),
      };
    });
    return ocultarSesion;
  }, [haySesion]);

  if (!store.ready) {
    // body{background:var(--bg)} ya cubre el fondo (styles.css se importa
    // antes de este primer render), así que no hace falta un nodo de splash:
    // no renderizar nada no produce flash blanco.
    return null;
  }

  return (
    <>
      <Header
        streak={currentStreak()}
        onOpenStreak={() => openSheet('streak-detail')}
        onOpenSettings={() => openSheet('settings')}
        onOpenSessions={() => {
          changeTab('prog');
          // el scroll espera a que Progreso esté pintado
          setTimeout(() => document.getElementById('sesiones')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
        }}
      />
      {/* Inicio no scrollea: necesita que main deje de reservar el colchón
          inferior que sí usan las pantallas largas. */}
      <main className={store.tab === 'inicio' ? 'full' : ''}>
        {/* La saliente va PRIMERO en el DOM (así la entrante, montada después,
            queda arriba en el stacking normal) y con pointer-events:none —
            es puramente decorativa mientras se termina de ir. */}
        {saliente && (
          <div className={`view leave dir-${saliente.dir}`}>
            {pantallaDe(saliente.tab)}
          </div>
        )}
        {/* El `key` es lo que hace que la animación se repita: sin él React
            reusa el mismo div y el navegador no vuelve a correr el keyframe. */}
        <div className={`view enter dir-${dir}`} key={store.tab}>
          {pantallaDe(store.tab)}
        </div>
      </main>
      {/* Con S.tab === 'hoy' ninguna pestaña sería la activa, y
          moveTabIndicator() (TabBar.jsx) busca `button.on`: sin encontrarlo
          deja la píldora colgada donde estaba. Hoy se entra desde Inicio, así
          que mientras estás ahí Inicio sigue siendo la pestaña activa. */}
      {/* changeTab() (state.js) ya vibra y calcula la dirección del
          deslizamiento — es el mismo camino que usan los demás botones que
          cambian de pestaña en toda la app (Hoy, Inicio, BodyMap). */}
      <TabBar active={store.tab === 'hoy' ? 'inicio' : store.tab} onChange={changeTab} />
      <Toast />
      <Sheet open={!!store.sheet} onClose={closeSheet}>
        <SheetContent sheet={store.sheet} />
      </Sheet>
      <RestTimer />
      <SessionComplete />
    </>
  );
}
