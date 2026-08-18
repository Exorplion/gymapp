// Puerto de "plantillas de rutina" (index.html, sección
// "/* ================= plantillas de rutina (Sección 12) ================= */").
// TEMPLATES es data estática pura; applyTemplate() reemplaza
// renderRutina()/closeSheet(html)/sheetConfirm(...)/sheetLibrary() por
// bump()/closeSheet()/openSheet('confirm',{...}) — el mecanismo de sheets de
// Task 1/5 (ver state.js).
import { S, bump, openSheet, closeSheet } from './state.js';
import { vibrate } from './format.js';
import { applyDays } from './rutina-logic.js';
import { toast } from './toast.js';

export const TEMPLATES = [
  { id: 'fullbody', name: 'Full Body', days: '3 días/sem', who: 'principiantes o poco tiempo', freq: 'cada grupo 3×/sem',
    secuencia: [
      ['Full Body A', [['Sentadilla', 3, 8], ['Press banca', 3, 8], ['Remo con barra', 3, 10], ['Press militar', 3, 10], ['Curl femoral', 3, 12]]],
      ['Full Body B', [['Peso muerto rumano', 3, 10], ['Jalón al pecho', 3, 10], ['Press inclinado mancuernas', 3, 10], ['Elevaciones laterales', 3, 15], ['Extensiones de cuádriceps', 3, 15]]],
      ['Full Body C', [['Prensa', 3, 12], ['Fondos', 3, 10], ['Dominadas', 3, 8], ['Curl con barra', 3, 12], ['Elevación de gemelos', 3, 15]]],
    ] },
  { id: 'ul', name: 'Upper / Lower', days: '4 días/sem', who: 'intermedios · frecuencia 2 balanceada', freq: 'cada grupo 2×/sem',
    secuencia: [
      ['Torso A', [['Press banca', 4, 8], ['Remo con barra', 4, 10], ['Press militar', 3, 10], ['Jalón al pecho', 3, 12], ['Curl con barra', 3, 12], ['Extensión tríceps polea', 3, 12]]],
      ['Pierna A', [['Sentadilla', 4, 8], ['Peso muerto rumano', 4, 10], ['Prensa', 3, 12], ['Curl femoral', 3, 12], ['Elevación de gemelos', 4, 15]]],
      ['Torso B', [['Press inclinado mancuernas', 4, 10], ['Dominadas', 4, 8], ['Elevaciones laterales', 4, 15], ['Aperturas en polea', 3, 12], ['Curl martillo', 3, 12], ['Overhead extension', 3, 12]]],
      ['Pierna B', [['Prensa', 4, 12], ['Zancadas', 3, 10], ['Extensiones de cuádriceps', 4, 15], ['Curl femoral', 4, 12], ['Elevación de gemelos', 4, 15]]],
    ] },
  { id: 'ppl', name: 'Push / Pull / Legs', days: '3 días/sem', who: 'todo nivel · versión de 3 días', freq: 'cada grupo 1×/sem',
    secuencia: [
      ['Push (empuje)', [['Press banca', 4, 8], ['Press militar', 3, 10], ['Press inclinado mancuernas', 3, 10], ['Elevaciones laterales', 4, 15], ['Extensión tríceps polea', 3, 12]]],
      ['Pull (tracción)', [['Dominadas', 4, 8], ['Remo con barra', 4, 10], ['Jalón al pecho', 3, 12], ['Face pull', 3, 15], ['Curl con barra', 4, 12]]],
      ['Legs (pierna)', [['Sentadilla', 4, 8], ['Peso muerto rumano', 4, 10], ['Prensa', 3, 12], ['Extensiones de cuádriceps', 3, 15], ['Elevación de gemelos', 4, 15]]],
    ] },
  { id: 'ppl6', name: 'PPL ×2', days: '6 días/sem', who: 'avanzados · máximo volumen', freq: 'cada grupo 2×/sem',
    secuencia: [
      ['Push A', [['Press banca', 4, 8], ['Press militar', 3, 10], ['Aperturas en polea', 3, 12], ['Elevaciones laterales', 4, 15], ['Extensión tríceps polea', 3, 12]]],
      ['Pull A', [['Dominadas', 4, 8], ['Remo con barra', 4, 10], ['Face pull', 3, 15], ['Curl con barra', 4, 12]]],
      ['Legs A', [['Sentadilla', 4, 8], ['Peso muerto rumano', 4, 10], ['Extensiones de cuádriceps', 3, 15], ['Elevación de gemelos', 4, 15]]],
      ['Push B', [['Press inclinado mancuernas', 4, 10], ['Fondos', 3, 10], ['Elevaciones laterales', 4, 15], ['Overhead extension', 3, 12]]],
      ['Pull B', [['Jalón al pecho', 4, 10], ['Remo', 4, 12], ['Pájaros', 3, 15], ['Curl martillo', 4, 12]]],
      ['Legs B', [['Prensa', 4, 12], ['Curl femoral', 4, 12], ['Zancadas', 3, 10], ['Elevación de gemelos', 4, 15]]],
    ] },
  { id: 'hybrid', name: 'PPL + UL híbrido', days: '5 días/sem', who: 'buen punto medio volumen/recuperación', freq: 'grupos 2×/sem aprox',
    secuencia: [
      ['Push', [['Press banca', 4, 8], ['Press militar', 3, 10], ['Elevaciones laterales', 4, 15], ['Extensión tríceps polea', 3, 12]]],
      ['Pull', [['Dominadas', 4, 8], ['Remo con barra', 4, 10], ['Face pull', 3, 15], ['Curl con barra', 4, 12]]],
      ['Legs', [['Sentadilla', 4, 8], ['Peso muerto rumano', 4, 10], ['Extensiones de cuádriceps', 3, 15], ['Elevación de gemelos', 4, 15]]],
      ['Upper (torso)', [['Press inclinado mancuernas', 4, 10], ['Jalón al pecho', 4, 10], ['Elevaciones laterales', 3, 15], ['Curl martillo', 3, 12], ['Overhead extension', 3, 12]]],
      ['Lower (pierna)', [['Prensa', 4, 12], ['Curl femoral', 4, 12], ['Zancadas', 3, 10], ['Elevación de gemelos', 4, 15]]],
    ] },
  { id: 'antpost', name: 'Anterior / Posterior', days: '4 días/sem', who: 'empujadores vs traccionadores', freq: 'cada grupo 2×/sem',
    secuencia: [
      ['Anterior A', [['Press banca', 4, 8], ['Press militar', 3, 10], ['Sentadilla', 4, 8], ['Elevaciones laterales', 3, 15], ['Extensión tríceps polea', 3, 12]]],
      ['Posterior A', [['Dominadas', 4, 8], ['Remo con barra', 4, 10], ['Peso muerto rumano', 4, 10], ['Curl con barra', 3, 12], ['Face pull', 3, 15]]],
      ['Anterior B', [['Press inclinado mancuernas', 4, 10], ['Prensa', 4, 12], ['Fondos', 3, 10], ['Extensiones de cuádriceps', 3, 15], ['Overhead extension', 3, 12]]],
      ['Posterior B', [['Jalón al pecho', 4, 10], ['Remo', 4, 12], ['Curl femoral', 4, 12], ['Curl martillo', 3, 12], ['Pájaros', 3, 15]]],
    ] },
];

export async function applyTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id); if (!t) return;
  const has = S.routine.some(s => s.type === 'workout' && s.exercises?.length);
  const doApply = async () => {
    const seq = t.secuencia.map(([name, list]) => ({
      type: 'workout', name, exercises: list.map(([n, s, r]) => ({ name: n, sets: s, reps: r })),
    }));
    await applyDays(seq, t.name);
    S.rutOpen = 0;
    S.rutMode = 'view';
    closeSheet(); bump(); vibrate([20, 40, 20]);
    toast(`Plantilla "${t.name}" cargada`);
  };
  if (has) {
    openSheet('confirm', {
      title: '¿Reemplazar tu split?',
      body: `Esto reemplaza tu split actual por "${t.name}". Podés editar todo después.`,
      confirmLabel: 'Reemplazar',
      onConfirm: doApply,
      onCancel: () => openSheet('library'),
    });
  } else {
    await doApply();
  }
}
