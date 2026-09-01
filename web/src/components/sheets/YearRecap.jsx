// "Tu Año Fierro" (Plan Fierro · Fase 3): tarjetas deslizables de solo
// lectura sobre los últimos 365 días — mismo espíritu que Spotify Wrapped o
// Strava Year in Sport. yearRecap() (session.js) ya sintetiza todos los
// números; acá sólo se presentan como tarjetas con "juice" de framer-motion,
// coherente con el resto de la app.
import { motion } from 'framer-motion';
import { yearRecap } from '../../lib/session.js';
import { fmtNum, fmtD, round1 } from '../../lib/format.js';
import { bloomOpen } from '../../lib/motion.js';
import { useEffect, useRef } from 'react';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

function Card({ eyebrow, value, sub }) {
  return (
    <motion.div variants={item} className="calcbox" style={{ marginTop: 10 }}>
      <div className="text-mut text-[12.5px] font-medium">{eyebrow}</div>
      <div className="font-cond text-3xl font-bold text-txt mt-1">{value}</div>
      {sub && <div className="text-mut text-[12.5px] mt-1">{sub}</div>}
    </motion.div>
  );
}

export default function YearRecap() {
  const rootRef = useRef(null);
  useEffect(() => { if (rootRef.current) bloomOpen(rootRef.current); }, []);
  const r = yearRecap();

  if (!r) {
    return (
      <div ref={rootRef}>
        <h2>Tu Año Fierro</h2>
        <div className="sheet-sub">Todavía no hay sesiones en los últimos 365 días — volvé cuando lleves un tiempo entrenando.</div>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <h2>Tu Año Fierro</h2>
      <div className="sheet-sub">Los últimos 365 días, en números.</div>
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        <Card eyebrow="Kilos movidos" value={`${fmtNum(r.kg)} kg`} sub={`en ${r.series} series`} />
        <Card eyebrow="Sesiones" value={r.sesiones} sub={`racha más larga: ${r.rachaMasLarga} día${r.rachaMasLarga === 1 ? '' : 's'}`} />
        {r.ejercicioTop && <Card eyebrow="Ejercicio más entrenado" value={r.ejercicioTop.name} sub={`${fmtNum(r.ejercicioTop.kg)} kg movidos en total`} />}
        {r.diaMasFuerte && <Card eyebrow="Tu día más fuerte" value={fmtD(r.diaMasFuerte.date)} sub={`${fmtNum(r.diaMasFuerte.kg)} kg en esa sesión`} />}
        {r.prMasGrande && <Card eyebrow="Tu PR más grande" value={`${fmtNum(round1(r.prMasGrande.w))} kg`} sub={`${r.prMasGrande.name} · ${fmtD(r.prMasGrande.date)}`} />}
      </motion.div>
    </div>
  );
}
