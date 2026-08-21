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
// `index` derivado de `S.sheet` (0 si hay algo, -1 si es null) es más
// simple y evita duplicar el estado en un ref imperativo.
//
// Registro type→componente: EMPTY_REGISTRY se llena en Tasks 2 y 3
// (Etapa 5a) con 'guide', 'streak-detail', 'reorder-hoy', 'confirm', y
// después con el resto de las ~18 sheets del original. Es un objeto plano
// exportado (SHEET_REGISTRY) — a completar así:
//   SHEET_REGISTRY['guide'] = GuideSheet;
// Un type sin entrada no crashea: SheetContent devuelve null.
import { useCallback, useMemo } from 'react';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { S, useStore, closeSheet } from '../lib/state.js';

// type (string) -> Component. Vacío a propósito en esta task — ver nota
// arriba. Tasks 2/3 hacen `SHEET_REGISTRY.guide = Guide` etc., no tocan
// este archivo.
export const SHEET_REGISTRY = {};

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
  // propia altura vía BottomSheetView + enableDynamicSizing). `index` es un
  // prop controlado en @gorhom/bottom-sheet: cambiarlo entre renders anima
  // el sheet a ese snap point — no hace falta ref imperativa acá porque
  // quien manda es S.sheet, no un consumidor individual.
  const index = sheet ? 0 : -1;

  // Se dispara tanto por swipe-down como por tap en el backdrop
  // (pressBehavior="close" arriba) — cualquiera de los dos debe sincronizar
  // S.sheet de vuelta a null, igual que onClose en el original.
  const handleClose = useCallback(() => {
    if (S.sheet) closeSheet();
  }, []);

  const snapPoints = useMemo(() => ['CONTENT_HEIGHT'], []);

  return (
    <BottomSheet
      index={index}
      enableDynamicSizing
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onClose={handleClose}
      backgroundStyle={{ backgroundColor: '#0e1626' }}
      handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,.3)' }}
    >
      <BottomSheetView style={{ paddingBottom: 24 }}>
        <SheetContent sheet={sheet} />
      </BottomSheetView>
    </BottomSheet>
  );
}
