// Puerto verbatim de sheetGuide() (index.html, "guía educativa" — Parte C).
// Contenido estático, sin estado ni acciones — se cierra tocando el fondo
// del sheet (Sheet.jsx ya lo resuelve), igual que el original no traía
// botón de cierre propio.
import { useEffect, useRef } from 'react';
import { bloomOpen, staggerReveal } from '../../lib/motion.js';

export default function Guide() {
  const rootRef = useRef(null);
  useEffect(() => {
    bloomOpen(rootRef.current);
    if (rootRef.current) staggerReveal(rootRef.current.children);
  }, []);

  return (
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">Cómo leer tu progreso</h2>
      <h3 className="mt-4 mb-1.5 font-cond text-lg font-semibold text-txt">⚖️ El peso fluctúa</h3>
      <div className="text-[14.5px] leading-relaxed text-mut">Variar 1-2 kg en un día es normal (agua, glucógeno, sodio, digestión). Pésate a diario en las mismas condiciones y mira el <b className="text-txt">promedio semanal</b>, no el número de un día suelto.</div>
      <h3 className="mt-4 mb-1.5 font-cond text-lg font-semibold text-txt">💪 Recomposición: mira el gym, no la balanza</h3>
      <div className="text-[14.5px] leading-relaxed text-mut">Ganar músculo en déficit es real pero lento (~0.5-1 kg en 3-4 meses) e invisible en la balanza. El mejor indicador de que estás reteniendo/ganando músculo es que <b className="text-txt">tus pesos en el gym se mantienen o suben</b>. Dale más peso a la fuerza que al número.</div>
      <h3 className="mt-4 mb-1.5 font-cond text-lg font-semibold text-txt">🧪 Creatina</h3>
      <div className="text-[14.5px] leading-relaxed text-mut">5 g/día todos los días (incluso descanso), sin fase de carga; el timing da igual, solo importa la constancia. Sube +1-2 kg en la balanza los primeros 7-10 días por <b className="text-txt">agua intracelular — no es grasa</b>.</div>
      <h3 className="mt-4 mb-1.5 font-cond text-lg font-semibold text-txt">🏃 Cardio en déficit</h3>
      <div className="text-[14.5px] leading-relaxed text-mut">El cuello de botella de perder grasa casi nunca es el cardio, es el control calórico. En días de descanso, 25-30 min moderados suman ~200-250 kcal. Evítalo justo después de sesiones largas de pesas (interfiere con la recuperación).</div>
      <h3 className="mt-4 mb-1.5 font-cond text-lg font-semibold text-txt">🎯 Expectativas</h3>
      <div className="text-[14.5px] leading-relaxed text-mut">Pérdida de grasa saludable: ~0.25-0.3 kg/sem con déficit de ~300 kcal. Abs visibles requieren ~10-12% de grasa — la mayoría subestima cuánto falta. El mismo peso con más músculo se ve muy distinto.</div>
    </div>
  );
}
