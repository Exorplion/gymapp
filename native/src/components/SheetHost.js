// Puerto de web/src/components/Sheet.jsx (wrapper del modal) +
// web/src/App.jsx's SheetContent (switch type→componente, líneas ~68-97).
// El original es un <div id="sheet"> a mano con backdrop propio y trampa de
// foco (irrelevante en RN: no hay DOM ni Tab). Acá el "sheet real" lo da
// @gorhom/bottom-sheet, que ya resuelve gesto de arrastre, animación y
// backdrop de forma nativa.
//
// Se usa el `BottomSheet` controlado (no `BottomSheetModal`, que requiere
// una ref imperativa .present()/.dismiss() por consumidor) porque acá TODO
// el estado de "qué está abierto" ya vive en un solo lugar — S.sheet — igual
// que en el original (un solo sheet a la vez, dueño único del estado). Un
// `index` derivado de `S.sheet` Y de si su `type` está registrado (0 si
// hay algo Y resuelve un componente, -1 si no) evita abrir un sheet vacío
// para tipos aún no portados — ver revisión final de Etapa 5a (C2).
//
// Registro type→componente: EMPTY_REGISTRY se llena en Tasks 2 y 3
// (Etapa 5a) con 'guide', 'streak-detail', 'reorder-hoy', 'confirm', y
// después con el resto de las ~18 sheets del original. Es un objeto plano
// exportado (SHEET_REGISTRY) — a completar así:
//   SHEET_REGISTRY['guide'] = GuideSheet;
// Un type sin entrada no crashea: SheetContent devuelve null.
import { useCallback } from 'react';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Dimensions } from 'react-native';
import { S, useStore, closeSheet } from '../lib/state.js';
import Guide from './sheets/Guide.js';
import StreakDetail from './sheets/StreakDetail.js';
import ReorderHoy from './sheets/ReorderHoy.js';
import ConfirmSheet from './sheets/ConfirmSheet.js';
import History from './sheets/History.js';
import ExInfo from './sheets/ExInfo.js';
import BodyForm from './sheets/BodyForm.js';
import Preworkout from './sheets/Preworkout.js';
import Profile from './sheets/Profile.js';
import EntryEdit from './sheets/EntryEdit.js';
import CopyExercises from './sheets/CopyExercises.js';
import SessionExercise from './sheets/SessionExercise.js';
import FoodVoice from './sheets/FoodVoice.js';
import VoiceLog from './sheets/VoiceLog.js';
import MealForm from './sheets/MealForm.js';
import SessionView from './sheets/SessionView.js';
import ExerciseForm from './sheets/ExerciseForm.js';
import Settings from './sheets/Settings.js';
import { SessStartInfo } from '../screens/Hoy.js';

// type (string) -> Component. Task 2 registró los primeros 3 sheets reales
// (Guide/StreakDetail/ReorderHoy); Task 3 agrega 'confirm' — el resto
// (~17 sheets) llega en tasks futuras de esta etapa, siguiendo el mismo
// patrón de import + entry.
export const SHEET_REGISTRY = {
  guide: Guide,
  'streak-detail': StreakDetail,
  'reorder-hoy': ReorderHoy,
  confirm: ConfirmSheet,
  history: History,
  'ex-info': ExInfo,
  'body-form': BodyForm,
  preworkout: Preworkout,
  profile: Profile,
  'entry-edit': EntryEdit,
  'copy-exs': CopyExercises,
  'ex-swap': SessionExercise,
  'food-voice': FoodVoice,
  'voice-log': VoiceLog,
  'meal-form': MealForm,
  'session-view': SessionView,
  'ex-form': ExerciseForm,
  settings: Settings,
  'sess-start-info': SessStartInfo,
};

function SheetContent({ sheet }) {
  if (!sheet) return null;
  const Component = SHEET_REGISTRY[sheet.type];
  if (!Component) return null; // tipo no registrado todavía: no rompe, no pinta nada
  return <Component {...(sheet.props || {})} />;
}

function renderBackdrop(props) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
    />
  );
}

export default function SheetHost() {
  useStore();
  const sheet = S.sheet;

  // -1 = cerrado, 0 = abierto (un solo snap point: el contenido define su
  // propia altura vía BottomSheetScrollView + enableDynamicSizing, clamped
  // a maxDynamicContentSize como el 88dvh del original). `index` es un prop
  // controlado en @gorhom/bottom-sheet: cambiarlo entre renders anima el
  // sheet a ese snap point — no hace falta ref imperativa acá porque quien
  // manda es S.sheet, no un consumidor individual.
  const index = sheet && SHEET_REGISTRY[sheet.type] ? 0 : -1;

  // Se dispara tanto por swipe-down como por tap en el backdrop
  // (pressBehavior="close" arriba) — cualquiera de los dos debe sincronizar
  // S.sheet de vuelta a null, igual que onClose en el original.
  const handleClose = useCallback(() => {
    if (S.sheet) closeSheet();
  }, []);

  return (
    <BottomSheet
      index={index}
      enableDynamicSizing
      maxDynamicContentSize={Dimensions.get('window').height * 0.88}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onClose={handleClose}
      backgroundStyle={{ backgroundColor: '#0e1626' }}
      handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,.3)' }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SheetContent sheet={sheet} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
