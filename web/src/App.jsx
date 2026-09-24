import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { idbOpenOnce } from './lib/db.js';
import { ensurePersisted } from './lib/persist.js';
import { S, useStore, bump, loadAll, closeSheet, openSheet, TAB_ORDEN, changeTab, lastTabChangeUsedVT, resolveAutoRest, tomarFotoSaliente } from './lib/state.js';
import { dstr } from './lib/format.js';
import { applyComputedGoals } from './lib/macros.js';
import { initDragListeners } from './lib/drag.js';
import { empiezaExcluido, clasificarSwipe, pintaHorizontal } from './lib/swipe.js';
import { currentStreak } from './lib/streak.js';
import { sessionExs } from './lib/session.js';
import { mostrarSesion, ocultarSesion } from './lib/ongoing.js';
import { aplicarPaleta } from './lib/theme.js';
import { accionDeArranque, ejecutarAccion } from './lib/acciones.js';
import { useAtras } from './lib/useAtras.js';
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
import DayDrop from './components/sheets/DayDrop.jsx';
import CopyExercises from './components/sheets/CopyExercises.jsx';
import SessionExercise from './components/sheets/SessionExercise.jsx';
import EntryEdit from './components/sheets/EntryEdit.jsx';
import ExerciseForm from './components/sheets/ExerciseForm.jsx';
import Library from './components/sheets/Library.jsx';
import DayPeek from './components/sheets/DayPeek.jsx';
import ExInfo from './components/sheets/ExInfo.jsx';
import ReorderHoy from './components/sheets/ReorderHoy.jsx';
import MarcarDia from './components/sheets/MarcarDia.jsx';
import GymMatch from './components/sheets/GymMatch.jsx';
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
import GymPhotoView from './components/sheets/GymPhotoView.jsx';
import RoutineWizard from './components/sheets/RoutineWizard.jsx';
import YearRecap from './components/sheets/YearRecap.jsx';

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
    case 'marcar-dia': return <MarcarDia {...sheet.props} />;
    case 'gym-match': return <GymMatch {...sheet.props} />;
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
    case 'gym-photo': return <GymPhotoView {...sheet.props} />;
    case 'year-recap': return <YearRecap {...sheet.props} />;
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
  /* Este efecto tiene que ser useLayoutEffect, no useEffect: con useEffect
     corre DESPUÉS de que el navegador ya pintó el commit donde cambió
     store.tab. En ESE pintado, la pantalla entrante ya está montada con
     "view enter dir-X" pero TODAVÍA sin "esperando" (listoParaAnimar sigue
     en true, como quedó de la transición anterior) y sin su compañera
     saliente — así que la animación pushIn arranca sola, en ese cuadro.
     Recién en el commit siguiente aparece saliente y, un layout-effect
     después, se agrega "esperando" y congela la animación a mitad de
     camino: ese frenazo es el "parpadeo" que reportó Enzo.
     Con useLayoutEffect, setSaliente corre ANTES de que el navegador pinte
     el commit del cambio de pestaña, así que React alcanza a re-renderizar
     con la saliente ya montada y "esperando" ya puesto (ver el
     useLayoutEffect de abajo, encadenado por el cambio de `saliente`) en el
     mismo ciclo, sin que exista un cuadro intermedio pintado con la
     entrante suelta. Verificado con un MutationObserver + getAnimations()
     sobre .view.enter (CPU frenada 6x y sin frenar, varias corridas en las
     dos direcciones): en la primera mutación del DOM tras el cambio de
     pestaña, .view.leave y la clase "esperando" en .view.enter aparecen
     siempre juntos — nunca se observó un commit con la entrante montada
     sola y sin "esperando". */
  useLayoutEffect(() => {
    if (store.tab === tabPrevio.current) return;
    if (lastTabChangeUsedVT) { tabPrevio.current = store.tab; return; }
    /* Si el cambio vino de un deslizamiento con el dedo, el recorrido YA se
       hizo — la pantalla vieja salió del marco arrastrada y la nueva entró
       detrás. Montar acá la animación de la barra la haría entrar una
       segunda vez, desde el borde, después de haber llegado. */
    if (porArrastre.current) { porArrastre.current = false; tabPrevio.current = store.tab; return; }
    setSaliente({ tab: tabPrevio.current, dir, foto: tomarFotoSaliente() });
    tabPrevio.current = store.tab;
    clearTimeout(salienteTimer.current);
    /* El desmontaje tiene que llegar DESPUÉS de que termine el deslizamiento,
       con margen. El deslizamiento dura --d3 (320ms, ver pushInR/pushOutR en
       styles.css) y esto estaba en 340: veinte milisegundos de colchón, o sea
       menos de dos frames. Alcanza en una máquina holgada; en un teléfono
       cargado, un frame perdido al arrancar la animación deja la pantalla
       saliente desmontada ANTES de terminar su recorrido — desaparece de
       golpe a mitad del deslizamiento, que es justo el corte que se quería
       sacar. Con 480 el colchón es de 160ms y el efecto es el mismo: nadie
       ve la pantalla saliente después de que salió del marco. */
    salienteTimer.current = setTimeout(() => setSaliente(null), 480);
    return () => clearTimeout(salienteTimer.current);
  }, [store.tab, dir]);

  /* ───────── Deslizar la pantalla para cambiar de pestaña ─────────

     Existió y se sacó: "cualquier gesto horizontal, en cualquier parte,
     terminaba cambiando de pestaña sin querer" (ver el comentario de ORDEN).
     Vuelve, y con lo que le faltaba: ahora la pantalla SIGUE AL DEDO.

     Eso no es un adorno, es lo que arregla el motivo por el que se sacó. Un
     swipe que sólo se evalúa al soltar es una apuesta a ciegas: o cambia de
     pestaña o no, y si no querías, ya está. Siguiendo al dedo ves apenas
     empezás que la pantalla se está moviendo, y si no era tu intención
     volvés y la soltás — vuelve sola a su lugar. La activación accidental
     deja de ser un accidente y pasa a ser algo que podés cancelar.

     Se reusan los umbrales de lib/swipe.js, que ya tienen tests: la lista de
     zonas excluidas (carrusel, silueta, tiras de chips, campos de texto), el
     mínimo para saber si el gesto pinta horizontal, y el criterio final.

     El orden es el de la BARRA (cuatro pestañas), no TAB_ORDEN: 'hoy' vive
     ahí dentro pero no es una pestaña visible, y deslizar hasta una pantalla
     que la barra no marca como activa se lee como que no pasó nada. Desde
     'hoy' se sale hacia Inicio, que es de donde se entra. */
  const ORDEN_SWIPE = ['inicio', 'rutina', 'nutri', 'prog'];
  const [arrastre, setArrastre] = useState(null); // {dx, destino, ancho, soltando} | null
  const gesto = useRef(null);
  const porArrastre = useRef(false);
  const soltarTimer = useRef(null);

  function vecinoDe(tab, hacia) {
    /* 'hoy' no está en la barra, pero se entra desde Inicio: volver con el
       dedo tiene que devolverte ahí. Sin este caso, Hoy sería la única
       pantalla de la que no se puede salir deslizando — y es justo una en la
       que tenés las manos ocupadas. */
    if (tab === 'hoy') return hacia < 0 ? 'inicio' : 'rutina';
    const i = ORDEN_SWIPE.indexOf(tab);
    if (i < 0) return null;
    return ORDEN_SWIPE[i + hacia] || null;
  }

  function alBajar(e) {
    if (store.sheet) return;                         // con una hoja abierta, no
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (empiezaExcluido(e.target)) return;
    gesto.current = { x0: e.clientX, y0: e.clientY, capturado: false, abortado: false };
  }

  function alMover(e) {
    const g = gesto.current;
    if (!g || g.abortado) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;

    if (!g.capturado) {
      const pinta = pintaHorizontal(dx, dy);
      if (pinta === null) return;                    // todavía no se sabe
      if (pinta === false) { g.abortado = true; return; }  // es un scroll
      const vista = mainRef.current?.querySelector(':scope > .view.enter');
      g.ancho = vista?.offsetWidth || 1;
      g.capturado = true;
    }

    const destino = vecinoDe(store.tab, dx < 0 ? 1 : -1);
    /* Sin vecino (primera o última pestaña) el gesto no se bloquea: se deja
       ceder un poco y volver. Una pared invisible confunde; una que empuja
       de vuelta dice "hasta acá". */
    setArrastre({ dx: destino ? dx : dx * 0.28, destino, ancho: g.ancho, soltando: false });
  }

  function alSoltar(e) {
    const g = gesto.current;
    gesto.current = null;
    if (!g || !g.capturado) { setArrastre(null); return; }

    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    const sentido = clasificarSwipe(dx, dy);
    const destino = sentido ? vecinoDe(store.tab, sentido) : null;

    clearTimeout(soltarTimer.current);
    if (destino) {
      // Completar el recorrido desde donde quedó el dedo, y recién ahí
      // cambiar de pestaña: si cambiáramos ya, la pantalla saltaría atrás
      // para volver a entrar desde el borde.
      setArrastre({ dx: Math.sign(dx) * g.ancho, destino, ancho: g.ancho, soltando: true });
      porArrastre.current = true;
      soltarTimer.current = setTimeout(() => { changeTab(destino); setArrastre(null); }, 220);
    } else {
      setArrastre(a => (a ? { ...a, dx: 0, soltando: true } : null));
      soltarTimer.current = setTimeout(() => setArrastre(null), 220);
    }
  }

  useEffect(() => () => clearTimeout(soltarTimer.current), []);

  /* ───────── Que el deslizamiento empiece cuando haya con qué dibujarlo ──

     Medido el 2026-09-15 con el CPU frenado 6× (un teléfono de gama media):
     montar la pantalla nueva bloquea el hilo principal entre 550 y 880ms. La
     animación arranca en el mismo commit que ese montaje, así que corre
     mientras nada se puede pintar: cuando el hilo se libera ya pasaron sus
     320ms y la pantalla aparece puesta. Tocás y la app salta. Ése es el
     "parpadeo" que quedaba, y no se arregla con más CSS — no había frames.

     No se puede hacer el montaje más barato que gratis, pero sí se puede
     poner en orden: primero montar, y recién cuando el navegador pudo pintar
     un frame, soltar la animación.

     `animation-play-state:paused` la deja congelada en su primer keyframe, o
     sea la pantalla nueva esperando fuera del marco — exactamente donde tiene
     que estar. Los dos requestAnimationFrame son la forma de saber que el
     navegador ya pintó: el primero se agenda durante el trabajo bloqueante y
     el segundo sólo llega cuando de verdad hubo un cuadro. */
  const [listoParaAnimar, setListoParaAnimar] = useState(true);
  useLayoutEffect(() => {
    if (!saliente) return;
    setListoParaAnimar(false);
    let id2 = 0;
    const id1 = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => setListoParaAnimar(true)); });
    return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2); };
  }, [saliente]);

  /* `main` sólo mide del alto de .view.enter (.view.leave es position:absolute,
     no participa del layout — ver el comentario de styles.css). Si la pantalla
     que se va es más alta que la que entra (p. ej. Rutina con un turno
     abierto vs. Nutrición), main la recorta en seco con su overflow:hidden
     ANTES de que termine de deslizarse afuera: se ve como si la parte de
     abajo de la pantalla saliente se cortara/rompiera a mitad de la
     animación en vez de deslizar completa fuera del marco. Mientras dura la
     transición, se fuerza a mano un min-height igual al más alto de los dos
     (medido después de pintar ambas, con useLayoutEffect para no parpadear)
     y se libera al terminar. */
  const mainRef = useRef(null);
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    if (!saliente) { main.style.minHeight = ''; return; }
    const entrante = main.querySelector(':scope > .view.enter');
    const saliendo = main.querySelector(':scope > .view.leave');
    const h = Math.max(entrante?.scrollHeight || 0, saliendo?.scrollHeight || 0);
    if (h) main.style.minHeight = `${h}px`;
  }, [saliente]);

  // Puerto del arranque original (el script inline al final de index.html
  // hacía idbOpen().then(loadAll) antes de la primera render()). loadAll()
  // ya deja S.ready=true; acá además recalculamos las metas automáticas de
  // macros (por si cambió algo del perfil) antes del primer bump().
  useEffect(() => {
    /* Le pedimos al navegador que NO desaloje nuestros datos. Va acá, en el
       arranque, y NO encadenado a la promesa de abajo a propósito: es
       independiente de que la base abra, y sobre todo no puede demorar ni
       hacer fallar el arranque. Si se rechaza o no existe la API,
       ensurePersisted() ya devuelve null en vez de tirar (persist.js).
       Esto es la mitad barata del arreglo del 2026-09-17; la otra mitad es
       el respaldo exportado, que es lo único que sobrevive a un borrado
       hecho a mano por el usuario. */
    ensurePersisted().then(p => { S.persisted = p; bump(); });

    idbOpenOnce().then(loadAll).then(() => {
      applyComputedGoals();
      // El color se aplica ACÁ, apenas se conoce S.cfg, y no cuando se abre
      // Ajustes: si no, la app arrancaría siempre con el azul de fábrica y
      // recién cambiaría al tuyo si entrabas a Ajustes.
      aplicarPaleta(S.cfg.themeColor);
      bump();
      // Recién con los datos cargados: el formulario de peso usa S.body para
      // el placeholder con tu último registro.
      accionDeArranque();
    }).catch(err => {
      /* Sin este catch, cualquier fallo del arranque dejaba la app en una
         pantalla vacía PERMANENTE: no corría el bump(), así que React nunca
         volvía a renderizar y el `return null` de más abajo quedaba fijo.
         Sin mensaje, sin botón de recargar, y sin nada en consola en el caso
         de `blocked` (ver db.js). Los disparadores son reales: IndexedDB
         bloqueado en navegación privada, almacenamiento lleno, u otra
         pestaña abierta con una versión anterior. */
      console.error('[FIERRO] falló el arranque:', err);
      S.bootError = err;
      S.ready = true;   // deja de esperar: hay que pintar el error, no seguir en blanco
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

  /* Tocar el recordatorio con la app ya abierta: el service worker no la
     recarga, le manda un mensaje (sw-notif.js) y la acción corre acá. */
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const alMensaje = e => {
      if (e.data?.tipo === 'fierro-accion' && S.ready && !S.bootError) ejecutarAccion(e.data.accion);
    };
    sw.addEventListener('message', alMensaje);
    return () => sw.removeEventListener('message', alMensaje);
  }, []);

  /* Cambio de día con la app abierta.
     Una PWA instalada no se cierra: se suspende. `S.nutriDate` se calculaba
     UNA sola vez, al importar el módulo, así que si dejabas la app abierta a
     la noche y a la mañana registrabas el desayuno, se guardaba con la fecha
     de AYER — contaminando las calorías del día, las metas y la
     recalibración de TDEE. Otras pantallas (Preworkout, BodyForm) sí pedían
     la fecha fresca, así que la app se contradecía a sí misma.
     `resolveAutoRest()` tenía el mismo problema: sólo corría en loadAll(), o
     sea que el puntero de días de descanso no avanzaba sin recargar. */
  useEffect(() => {
    let hoyPrevio = dstr();
    function alVolver() {
      if (document.visibilityState !== 'visible') return;
      const hoy = dstr();
      if (hoy === hoyPrevio) return;
      // Sólo se arrastra la fecha si estabas mirando "hoy". Si navegaste a
      // propósito a un día pasado, cambiártelo de abajo sería peor que el bug.
      if (S.nutriDate === hoyPrevio) S.nutriDate = hoy;
      hoyPrevio = hoy;
      Promise.resolve(resolveAutoRest()).catch(e =>
        console.error('[FIERRO] no se pudo avanzar el turno al cambiar el día:', e));
      bump();
    }
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
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

  /* El gesto de volver de Android (lib/atras.js). Sin esto cerraba la app
     entera. Orden de lo que se cierra: la hoja abierta primero, después la
     pestaña vuelve a Inicio (Hoy cuenta como fuera de Inicio), y recién ahí
     volver sale de la app. */
  useAtras(!!store.sheet, closeSheet);
  useAtras(store.tab !== 'inicio', () => changeTab('inicio'));

  /* El arranque falló: se dice, con la causa y una salida. Antes esto era
     indistinguible de "todavía cargando" — las dos cosas eran una pantalla
     negra, sólo que ésta no terminaba nunca. */
  if (store.bootError) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: 32, textAlign: 'center',
      }}>
        <div className="vtitle" style={{ margin: 0 }}>No se pudo abrir FIERRO</div>
        <p className="s text-mut" style={{ maxWidth: 340, lineHeight: 1.5 }}>
          {String(store.bootError?.message || store.bootError)}
        </p>
        <p className="s text-mut2" style={{ maxWidth: 340, lineHeight: 1.5 }}>
          Tus datos siguen guardados en el teléfono: esto es un problema para
          abrirlos, no una pérdida.
        </p>
        <button type="button" className="btn" onClick={() => location.reload()}>
          Reintentar
        </button>
      </div>
    );
  }

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
      <main
        ref={mainRef}
        className={`${store.tab === 'inicio' ? 'full' : ''}${arrastre ? ' arrastrando' : ''}`}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      >
        {/* La saliente va PRIMERO en el DOM (así la entrante, montada después,
            queda arriba en el stacking normal) y con pointer-events:none —
            es puramente decorativa mientras se termina de ir. */}
        {saliente && (
          <div
            className={`view leave dir-${saliente.dir}${listoParaAnimar ? '' : ' esperando'}`}
            /* Se cuelga la FOTO del DOM que estaba en pantalla (ver
               sacarFoto en state.js), no se vuelve a montar la pantalla con
               React. La saliente no se toca ni cambia mientras se va: sólo
               tiene que verse igual que un instante antes. Montarla de nuevo
               costaba cientos de milisegundos de hilo bloqueado y era la
               mitad de por qué el deslizamiento no llegaba a dibujarse.

               `pantallaDe` queda como salida de emergencia por si no hubo
               foto (un cambio de pestaña que no pasó por changeTab). */
            ref={el => {
              if (!el || !saliente.foto || el.firstChild) return;
              el.append(...Array.from(saliente.foto.childNodes));
            }}
          >
            {saliente.foto ? null : pantallaDe(saliente.tab)}
          </div>
        )}
        {/* La vecina, sólo mientras dura el gesto: esperando fuera del marco,
            del lado hacia el que estás arrastrando, y moviéndose lo mismo que
            la de adelante. Es lo que hace que se vea que hay algo del otro
            lado en vez de un hueco. */}
        {arrastre?.destino && (
          <div
            className={`view vecino${arrastre.soltando ? ' soltando' : ''}`}
            style={{ transform: `translateX(${arrastre.dx + (arrastre.dx < 0 ? arrastre.ancho : -arrastre.ancho)}px)` }}
          >
            {pantallaDe(arrastre.destino)}
          </div>
        )}
        {/* El `key` es lo que hace que la animación se repita: sin él React
            reusa el mismo div y el navegador no vuelve a correr el keyframe. */}
        <div
          className={`view enter dir-${dir}${arrastre ? (arrastre.soltando ? ' arrastrada soltando' : ' arrastrada') : ''}${listoParaAnimar ? '' : ' esperando'}`}
          key={store.tab}
          /* `animation:'none'` no es decorativo: las animaciones de entrada
             usan fill:both, o sea que su valor final de `transform` queda
             aplicado para siempre y le gana a un transform inline. Sin
             apagarla, la pantalla no se movería ni un píxel con el dedo. */
          style={arrastre ? { animation: 'none', transform: `translateX(${arrastre.dx}px)` } : undefined}
        >
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
      <Sheet open={!!store.sheet} onClose={closeSheet} variante={store.sheet?.type === 'confirm' ? 'dialogo' : undefined}>
        <SheetContent sheet={store.sheet} />
      </Sheet>
      <RestTimer />
      <SessionComplete />
    </>
  );
}
