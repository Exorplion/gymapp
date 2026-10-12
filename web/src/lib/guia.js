// La guía de la sesión en vivo para quien recién empieza (Enzo, 2026-10-12:
// "no se entiende qué es una serie más/menos, omitir…"; aprobó la opción B
// "Globo" de docs/referencias-guia-sesion.html).
//
// Cinco avisos, cada uno UNA vez y en el momento en que importa — nunca un
// tour al abrir la app. Un globito señala el control y no bloquea nada; se va
// para siempre cuando usás ese control o tocás su ✕. Uno por vez, en el orden
// de PISTAS.
//
// Este módulo es la lógica pura (qué aviso toca) y lo que se guarda:
// S.cfg.guia = { visto: { btn: true, … } }. Quién lo pinta y dónde es
// components/GuiaSesion.jsx; los "ya lo usó" son llamadas a marcarGuia()
// desde las acciones de siempre (saveSet, la rueda, el RIR, la tabla, el ⋯).
import { S, bump, saveCfg } from './state.js';

export const PISTAS = ['btn', 'rueda', 'rir', 'tabla', 'dots'];

export const TEXTOS = {
  btn: 'Hacé la serie y tocá acá. El descanso arranca solo.',
  rueda: 'Deslizá o tocá un número para cambiarlo. Mantené apretado para elegir uno exacto.',
  rir: '¿Cuántas reps más podías hacer? Con eso la app decide si subirte el peso la próxima.',
  tabla: 'Tocá una serie para corregir el número. La ✕ es para borrarla.',
  dots: 'Más opciones: hacer después, una serie más o menos, cambiar de ejercicio.',
};

/** ¿Ya se vio (o se usó) este aviso? */
export function vista(id, cfg = S.cfg) {
  return !!cfg?.guia?.visto?.[id];
}

/** Qué aviso toca ahora, o null. `ctx` es lo que hay en pantalla:
    - hoja: hay una hoja abierta (ningún aviso encima de una hoja)
    - descanso: T.state ('fullscreen' | 'ringing' | 'minimized' | null)
    - hayRir: la pregunta del RIR está a la vista en el descanso
    - hayBoton / hayRueda / hayTabla / hayDots: el control está en la
      tarjeta abierta (el botón, sólo en modo serie: no en la aproximación)
    - ejerciciosPrevios: ejercicios de esta sesión con series, sin contar el
      que está abierto (el ⋯ sale en el tercero aunque falte alguno)
    Puro: no lee S ni el DOM. */
export function pistaQueToca(ctx, visto = {}) {
  const v = visto || {};
  if (ctx.hoja) return null;
  /* El descanso a pantalla completa tapa la tarjeta: ahí sólo vive el del
     RIR, que está ADENTRO. Sonando no se pregunta nada. */
  if (ctx.descanso === 'fullscreen' || ctx.descanso === 'ringing') {
    return ctx.descanso === 'fullscreen' && ctx.hayRir && !v.rir ? 'rir' : null;
  }
  if (!v.btn && ctx.hayBoton) return 'btn';
  // La rueda después del botón, nunca a la vez (desde la segunda serie).
  if (v.btn && !v.rueda && ctx.hayRueda) return 'rueda';
  if (!v.tabla && ctx.hayTabla) return 'tabla';
  const losOtros = v.btn && v.rueda && v.rir && v.tabla;
  if (!v.dots && ctx.hayDots && (losOtros || ctx.ejerciciosPrevios >= 2)) return 'dots';
  return null;
}

/** La guía de una instalación que todavía no la decidió. Quien ya tiene
    sesiones guardadas cuando esto llega ya conoce la app: no ve ninguno
    (puede pedirla en Ajustes). null = ya estaba decidida, nada que cambiar. */
export function guiaInicial(guia, nSesiones) {
  if (guia !== undefined) return null;
  return { visto: nSesiones > 0 ? Object.fromEntries(PISTAS.map(p => [p, true])) : {} };
}

/** Se decide UNA vez, al cargar (App.jsx, después de loadAll). */
export function iniciarGuia() {
  const nueva = guiaInicial(S.cfg.guia, S.sessions?.length || 0);
  if (!nueva) return Promise.resolve();
  S.cfg.guia = nueva;
  return saveCfg();
}

/** "Ya lo usó": el aviso no vuelve. Se llama desde acciones que se repiten
    (cada serie), así que si ya estaba visto no escribe ni repinta nada. */
export function marcarGuia(id) {
  if (vista(id)) return Promise.resolve();
  S.cfg.guia = { ...(S.cfg.guia || {}), visto: { ...(S.cfg.guia?.visto || {}), [id]: true } };
  bump();
  return saveCfg();
}

/** Ajustes → "Ver la guía otra vez". */
export function reiniciarGuia() {
  S.cfg.guia = { visto: {} };
  bump();
  return saveCfg();
}
