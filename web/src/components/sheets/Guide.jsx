// Puerto verbatim de sheetGuide() (index.html, "guía educativa" — Parte C).
// Contenido estático, sin estado ni acciones — se cierra tocando el fondo
// del sheet (Sheet.jsx ya lo resuelve), igual que el original no traía
// botón de cierre propio.
export default function Guide() {
  return (
    <>
      <h2>Cómo leer tu progreso</h2>
      <h3>⚖️ El peso fluctúa</h3>
      <div className="gtx">Variar 1-2 kg en un día es normal (agua, glucógeno, sodio, digestión). Pésate a diario en las mismas condiciones y mira el <b>promedio semanal</b>, no el número de un día suelto.</div>
      <h3>💪 Recomposición: mira el gym, no la balanza</h3>
      <div className="gtx">Ganar músculo en déficit es real pero lento (~0.5-1 kg en 3-4 meses) e invisible en la balanza. El mejor indicador de que estás reteniendo/ganando músculo es que <b>tus pesos en el gym se mantienen o suben</b>. Dale más peso a la fuerza que al número.</div>
      <h3>🧪 Creatina</h3>
      <div className="gtx">5 g/día todos los días (incluso descanso), sin fase de carga; el timing da igual, solo importa la constancia. Sube +1-2 kg en la balanza los primeros 7-10 días por <b>agua intracelular — no es grasa</b>.</div>
      <h3>🏃 Cardio en déficit</h3>
      <div className="gtx">El cuello de botella de perder grasa casi nunca es el cardio, es el control calórico. En días de descanso, 25-30 min moderados suman ~200-250 kcal. Evítalo justo después de sesiones largas de pesas (interfiere con la recuperación).</div>
      <h3>🎯 Expectativas</h3>
      <div className="gtx">Pérdida de grasa saludable: ~0.25-0.3 kg/sem con déficit de ~300 kcal. Abs visibles requieren ~10-12% de grasa — la mayoría subestima cuánto falta. El mismo peso con más músculo se ve muy distinto.</div>
    </>
  );
}
