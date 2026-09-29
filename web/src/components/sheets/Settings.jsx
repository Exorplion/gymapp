// Puerto de sheetSettings() + macroPreview() + los handlers ACT['unit'],
// ACT['rest-cfg'], ACT['goalmode'], ACT['profile-open'], data-chg==='goal',
// ACT['seed-load'], ACT['seed-wipe'], ACT['export'], ACT['import-pick'] +
// el listener de #importFile, ACT['wipe'] (index.html, bloque "AJUSTES /
// respaldo"). seedRegistro/seedCount/wipeSeed vienen de lib/seed.js;
// exportJSON/importJSON/wipeAll de lib/backup.js (Task 9).
//
// Los confirm() nativos de seed-load/seed-wipe/wipe se reemplazan por el
// sheet 'confirm' de la app (mismo criterio que el resto del port — ver nota
// de cabecera en lib/backup.js). seed-load tenía DOS confirm() encadenados
// en el original (uno condicional si ya hay datos cargados, otro siempre);
// acá se encadenan igual con dos openSheet('confirm',...) sucesivos.
//
// Las metas manuales (Kcal/Prot/Carb/Grasa) son inputs NO controlados
// (defaultValue, sin value=): el original las leía con el evento nativo
// `change`, que dispara UNA vez, al perder foco — no en cada tecla. Por eso
// acá el guardado (S.cfg.goals[k]=...; saveCfg(), un idb.put real) cuelga de
// onBlur, no de onChange: escribir a IndexedDB en cada tecla (fix round 1,
// hallazgo de review) persistía dígitos parciales ("1","19","195","1950")
// según cuándo se interrumpiera el tecleo, algo que el evento `change`
// original nunca hacía. onBlur, disparado por el navegador ANTES de que
// corra el click de otro elemento (tocar el toggle de modo, otro botón del
// sheet, o el backdrop para cerrar), sigue capturando el valor final tecleado
// sin perderlo en ninguno de esos casos. Nunca se reescribe el value del
// input (ni en blur ni en ningún otro momento) — mismo criterio que
// Profile.jsx / VoiceLog.jsx, ahora aplicado también al *momento* del guardado
// y no sólo al valor mostrado.
//
// El <input id="importFile"> vivía en el original como nodo persistente
// fuera del sheet (sibling de #sheet/#toast, único en toda la página); acá
// sólo hace falta mientras Ajustes está abierto, así que vive local a este
// componente — mismo comportamiento (mismo <input hidden> disparado por
// "Importar JSON"), distinto lugar en el árbol.
import { useEffect, useRef, useState } from 'react';
import { S, bump, closeSheet, openSheet, saveCfg } from '../../lib/state.js';
import { fmtMMSS, vibrate } from '../../lib/format.js';
import { computeMacros, applyComputedGoals } from '../../lib/macros.js';
import { seedRegistro, seedCount, wipeSeed } from '../../lib/seed.js';
import { exportJSON, importJSON, wipeAll } from '../../lib/backup.js';
import { storageEstimate, daysSinceBackup, necesitaBackup } from '../../lib/persist.js';
import { exportFoodsMD, importFoodsMD } from '../../lib/foodmd.js';
import { toast } from '../../lib/toast.js';
import { PRESETS, acentoDe, acentoGuardado, aplicarAcento, alejarDeEstados, distanciaMatiz, hexAOklch, variablesDe } from '../../lib/theme.js';
import { motion } from 'motion/react';
import { hojaProps, seccion } from '../../lib/variants.js';
import AvisosAjustes from '../AvisosAjustes.jsx';
import { enModoPrueba, entrarModoPrueba } from '../../lib/modoPrueba.js';

/** Entrar y salir del modo prueba (modoPrueba.js). Entrar sólo copia. Salir
    pasa por la hoja 'salir-prueba' (2026-09-29): antes tiraba la copia sin
    preguntar, con el argumento de que "no toca la base real" — cierto, pero
    lo que se tiraba podía ser entrenamiento real (así se perdieron el 27 y el
    28 de Enzo). Ahora dice qué hay en la copia y ofrece pasarlo. */
function ModoPrueba() {
  const [ocupado, setOcupado] = useState(false);
  const en = enModoPrueba();
  async function entrar() {
    setOcupado(true);
    try { await entrarModoPrueba(); } catch (e) {
      console.error('[FIERRO] no se pudo entrar al modo prueba:', e);
      toast(e.message || 'No se pudo armar la copia de prueba');
      setOcupado(false);
    }
  }
  return (
    <>
      <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.5, marginBottom: 10 }}>
        {en
          ? <>Estás en una <b>copia</b> de tus datos. Lo que registres acá no llega a tus datos reales: al salir te muestro qué registraste y elegís si pasarlo o descartarlo.</>
          : 'Una copia de tus datos para simular un entrenamiento y probar cosas nuevas. Nada de lo que hagas ahí llega a tu progreso real.'}
      </div>
      {en
        ? <button type="button" className="btn" style={{ marginBottom: 10 }} onClick={() => openSheet('salir-prueba')}>Salir del modo prueba</button>
        : <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={entrar} disabled={ocupado}>{ocupado ? 'Copiando tus datos…' : 'Entrar al modo prueba'}</button>}
    </>
  );
}

function MacroPreview({ m }) {
  return (
    <>
      <div className="cr"><span>BMR (Mifflin-St Jeor)</span><b>{m.bmr} kcal</b></div>
      <div className="cr"><span>TDEE {m.empirical ? '(empírico)' : '(calculado)'}</span><b>{m.tdee} kcal</b></div>
      <div className="cr"><span>Proteína <span className="txt-mut">({m.protMin}–{m.protMax})</span></span><b>{m.prot} g</b></div>
      <div className="cr"><span>Grasa <span className="txt-mut">({m.fatMin}–{m.fatMax})</span></span><b>{m.fat} g</b></div>
      <div className="cr"><span>Carbos <span className="txt-mut">(resto)</span></span><b>{m.carbs} g</b></div>
      <div className="cr big"><span>Target diario</span><b>{m.target} kcal</b></div>
    </>
  );
}

export default function Settings() {
  const g = S.cfg.goals;
  const m = S.cfg.goalsAuto ? computeMacros() : null;
  const nSeed = seedCount();
  const importRef = useRef(null);
  const mdRef = useRef(null);
  const rootRef = useRef(null);
  const [buscando, setBuscando] = useState(false);
  // null mientras no se midió: el bloque de abajo no afirma nada hasta tenerlo.
  const [espacio, setEspacio] = useState(null);

  useEffect(() => { storageEstimate().then(setEspacio); }, []);

  const diasBackup = daysSinceBackup(S.cfg.lastBackupAt);
  const avisarBackup = necesitaBackup(S.sessions.length, S.cfg.lastBackupAt);
  // `!== false` y no una verdad simple: una instalación vieja no tiene la
  // clave, y undefined tiene que leerse como prendido (ver tocaAutoBackup).
  const autoOn = S.cfg.autoBackup !== false;

  function setAutoBackup(on) {
    S.cfg.autoBackup = on;
    saveCfg();
    bump();
  }

  /* El acento: un preset o un matiz propio (lib/theme.js). La base grafito
     no se elige: es la misma para todos. Se aplica en vivo, antes de
     guardar, porque el selector nativo dispara onChange en cada arrastre
     del dedo sobre la rueda y tiene que sentirse instantáneo. */
  const acento = acentoGuardado(S.cfg).sel;
  const hexAcento = variablesDe(acentoDe(acento))['--accent'];
  const [corrido, setCorrido] = useState(false);

  function elegirAcento(sel) {
    S.cfg.acento = sel;
    delete S.cfg.themeColor;
    aplicarAcento(sel);
    saveCfg();
    bump();
  }
  function elegirPreset(id) {
    setCorrido(false);
    elegirAcento({ id });
  }
  /* Del color propio se toma SÓLO el matiz: la luz y la intensidad son las
     mismas de los presets, así cualquier elección se lee igual de bien. Un
     gris no tiene matiz, así que es Monocromo. */
  function elegirPropio(hex) {
    const o = hexAOklch(hex);
    if (!o) return;
    if (o.C < 0.03) { elegirPreset('mono'); return; }
    const h = Math.round(o.h);
    setCorrido(distanciaMatiz(alejarDeEstados(h), h) > 2);
    elegirAcento({ id: 'propio', h: alejarDeEstados(h) });
  }

  function setUnit(u) {
    S.cfg.unit = u; saveCfg();
    bump(); // re-renderiza toda la app: wDisplay/wAlt en Hoy/Rutina/Progreso dependen de S.cfg.unit
  }

  function stepRest(d) {
    S.cfg.rest = Math.max(0, (S.cfg.rest || 0) + d);
    saveCfg();
    bump();
  }

  /* El cuerpo se elige acá, que es donde uno lo busca.

     `cfg.bodySex` es un ajuste propio y no el sexo del perfil: aquél existe
     para calcular calorías, y mezclarlos obligaría a mentir en uno para
     arreglar el otro. Mientras nadie lo toque hereda el del perfil, así que
     quien ya lo cargó no tiene que elegir dos veces. */
  const cuerpoSexo = () => S.cfg.bodySex || S.cfg.profile?.sex || 'm';

  function setCuerpo(s) {
    S.cfg.bodySex = s;
    saveCfg();
    bump();
  }

  /* Va a buscar una versión nueva a mano.

     La app está en autoUpdate, pero eso sólo revisa al cargar la página, y una
     PWA instalada que se retoma de segundo plano puede no cargar nada durante
     días. El resultado es que pedís un cambio, se publica, y en el teléfono no
     aparece — sin ninguna señal de por qué.

     Se borran los cachés además de actualizar el service worker: si el SW ya
     estaba al día pero los archivos viejos seguían guardados, sólo con
     update() no alcanzaría. */
  async function buscarUpdate() {
    setBuscando(true);
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
      await Promise.all(regs.map(r => r.update().catch(() => {})));
      if (window.caches) {
        const claves = await caches.keys();
        await Promise.all(claves.map(k => caches.delete(k).catch(() => false)));
      }
      toast('Buscando la última versión…');
      // recarga sin caché: si había una nueva, entra ahora
      setTimeout(() => window.location.reload(true), 600);
    } catch {
      setBuscando(false);
      toast('No se pudo revisar. Probá cerrar y abrir la app.');
    }
  }

  function setDayDrop(mode) {
    S.cfg.dayDrop = mode;
    saveCfg();
    bump();
  }

  function setGoalMode(auto) {
    S.cfg.goalsAuto = auto;
    if (S.cfg.goalsAuto && !computeMacros()) {
      S.cfg.goalsAuto = false;
      closeSheet();
      openSheet('profile');
      return;
    }
    applyComputedGoals();
    saveCfg();
    bump();
  }

  function setGoal(k, raw) {
    const num = Math.max(0, parseInt(raw, 10) || 0);
    S.cfg.goals[k] = num;
    saveCfg();
  }

  function confirmSeedLoadStep2() {
    const mine = S.sessions.filter(s => !s.seed).length;
    openSheet('confirm', {
      title: 'Cargar datos de prueba',
      body: (
        <>
          Esto reemplaza tu split por la rutina Anterior/Posterior y agrega ~5 semanas de sesiones, ~1 mes de nutrición y tus pesadas.
          {mine > 0 && <><br /><br />Tus {mine} sesiones propias no se tocan.</>}
          <br /><br />
          Ojo: el historial de sesiones está reconstruido desde tus pesos anotados, no es un registro real.
          <br /><br />
          ¿Continuar?
        </>
      ),
      confirmLabel: 'Cargar',
      onConfirm: async () => {
        toast('Cargando…');
        await seedRegistro();
        vibrate([30, 50, 30]);
        setTimeout(() => location.reload(), 400);
      },
    });
  }

  function startSeedLoad() {
    if (seedCount()) {
      openSheet('confirm', {
        title: 'Ya hay datos cargados',
        body: 'Cargarlos otra vez los va a duplicar.',
        confirmLabel: 'Cargar de nuevo',
        onConfirm: confirmSeedLoadStep2,
      });
      return;
    }
    confirmSeedLoadStep2();
  }

  function startSeedWipe() {
    openSheet('confirm', {
      title: 'Borrar datos de prueba',
      body: `Se borran los ${seedCount()} registros cargados. Lo que hayas anotado vos queda.`,
      confirmLabel: 'Borrar',
      onConfirm: async () => {
        await wipeSeed();
        setTimeout(() => location.reload(), 300);
      },
    });
  }

  function startWipeAll() {
    openSheet('confirm', {
      title: 'Borrar todos los datos',
      body: 'Esta acción no se puede deshacer. Exporta un backup antes.',
      confirmLabel: 'Borrar todo',
      onConfirm: () => wipeAll(),
    });
  }

  function onImportFile(e) {
    const f = e.target.files[0];
    if (f) importJSON(f);
    e.target.value = '';
  }

  function onMdFile(e) {
    const f = e.target.files[0];
    if (f) importFoodsMD(f);
    e.target.value = '';
  }

  return (
    <motion.div ref={rootRef} {...hojaProps}>
      {/* El título NO se anima: sube con el panel. Si también esperara, la
          hoja llegaría vacía y se rellenaría después — el error que
          screenReveal() (motion.js) documenta haber cometido con las
          pantallas. */}
      <h2>Ajustes</h2>

      <motion.section variants={seccion}>
        <h3>Color</h3>
        <div className="acento-muestras" role="group" aria-label="Color de acento">
          {PRESETS.map(p => (
            <button
              type="button"
              key={p.id}
              className="acento-muestra"
              aria-pressed={acento.id === p.id}
              onClick={() => elegirPreset(p.id)}
            >
              <i style={{ background: variablesDe(p)['--accent'] }} />
              {p.nombre}
            </button>
          ))}
          {/* El <input type=color> nativo no se puede estilar por dentro: va
              invisible encima de la muestra, que es lo que se ve. */}
          <label className={`acento-muestra propio${acento.id === 'propio' ? ' on' : ''}`}>
            <i style={acento.id === 'propio' ? { background: hexAcento } : undefined}>
              <input type="color" value={hexAcento} onChange={e => elegirPropio(e.target.value)} aria-label="Elegir un color propio" />
            </i>
            Propio
          </label>
        </div>
        {corrido && (
          <p className="acento-nota" role="status">
            Lo corrimos un poco: ese tono se confundía con el verde, el rojo o el
            ámbar de los avisos.
          </p>
        )}
        {/* La vista previa usa las mismas clases que la app, con el acento
            ya aplicado: es la paleta real, no una muestra aparte. */}
        <div className="card sub acento-previa" aria-hidden="true">
          <div className="eyebrow blue">Vista previa</div>
          <div className="acento-previa-fila">
            <b className="acento-previa-num">58.4<small> kg</small></b>
            <span className="chip on">Elegido</span>
          </div>
          <div className="pbar"><i style={{ width: '62%' }} /></div>
          <div className="acento-previa-estados">
            <span className="ok">Logrado</span>
            <span className="danger">Bajaste</span>
            <span className="warn">Aproximación</span>
          </div>
          <div className="btn sm">Empezar</div>
        </div>
        <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s2)', lineHeight: 1.45 }}>
          La base grafito es la misma para todos. El acento pinta botones,
          anillos, gráficos y el mapa muscular; verde, rojo y ámbar quedan
          reservados para los avisos.
        </div>
      </motion.section>

      <motion.section variants={seccion}>
        <h3>Unidad de peso</h3>
        <div className="seg">
          <button type="button" className={S.cfg.unit === 'kg' ? 'on' : ''} aria-pressed={S.cfg.unit === 'kg'} onClick={() => setUnit('kg')}>Kilos (kg)</button>
          <button type="button" className={S.cfg.unit === 'lb' ? 'on' : ''} aria-pressed={S.cfg.unit === 'lb'} onClick={() => setUnit('lb')}>Libras (lb)</button>
        </div>
      </motion.section>

      <motion.section variants={seccion}>
        <h3>Cuerpo del mapa muscular</h3>
        <div className="seg">
          <button type="button" className={cuerpoSexo() !== 'f' ? 'on' : ''} aria-pressed={cuerpoSexo() !== 'f'} onClick={() => setCuerpo('m')}>Hombre</button>
          <button type="button" className={cuerpoSexo() === 'f' ? 'on' : ''} aria-pressed={cuerpoSexo() === 'f'} onClick={() => setCuerpo('f')}>Mujer</button>
        </div>
        <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s2)', lineHeight: 1.45 }}>
          Cambia la silueta de Inicio. Los grupos musculares y tus datos son los mismos.
        </div>
      </motion.section>

      <motion.section variants={seccion}>
        <h3>Descanso entre series</h3>
        <div className="step">
          <button type="button" onClick={() => stepRest(-15)}>−</button>
          <div className="val">
            <input readOnly value={S.cfg.rest ? fmtMMSS(S.cfg.rest) : 'OFF'} />
            <span className="alt">−/+ 15 seg · 0 = sin timer</span>
          </div>
          <button type="button" onClick={() => stepRest(15)}>+</button>
        </div>
      </motion.section>

      <motion.section variants={seccion}>
        <h3>Avisos</h3>
        <AvisosAjustes />
      </motion.section>

      <motion.section variants={seccion}>
        <h3>Al mover un día sobre otro ocupado</h3>
        <div className="seg">
          <button type="button" className={(S.cfg.dayDrop || 'ask') === 'ask' ? 'on' : ''} aria-pressed={(S.cfg.dayDrop || 'ask') === 'ask'} onClick={() => setDayDrop('ask')}>Preguntar</button>
          <button type="button" className={S.cfg.dayDrop === 'shift' ? 'on' : ''} aria-pressed={S.cfg.dayDrop === 'shift'} onClick={() => setDayDrop('shift')}>Correr</button>
          <button type="button" className={S.cfg.dayDrop === 'swap' ? 'on' : ''} aria-pressed={S.cfg.dayDrop === 'swap'} onClick={() => setDayDrop('swap')}>Intercambiar</button>
        </div>
        <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s2)', lineHeight: 1.45 }}>
          <b>Correr</b>: el día que estaba ahí se va al próximo día libre. <b>Intercambiar</b>: los dos cambian de lugar.
        </div>
      </motion.section>

      <motion.section variants={seccion}>
        <h3>Metas nutricionales diarias</h3>
        <div className="seg">
          <button type="button" className={S.cfg.goalsAuto ? 'on' : ''} aria-pressed={S.cfg.goalsAuto} onClick={() => setGoalMode(true)}>Desde perfil</button>
          <button type="button" className={S.cfg.goalsAuto ? '' : 'on'} aria-pressed={!S.cfg.goalsAuto} onClick={() => setGoalMode(false)}>Manual</button>
        </div>
        {S.cfg.goalsAuto ? (
          <>
            <div className="calcbox" style={{ marginTop: 12 }}>
              {m ? <MacroPreview m={m} /> : <div className="txt-mut" style={{ fontSize: 'var(--t-sm)' }}>Completa tu perfil para calcular las metas.</div>}
            </div>
            <button type="button" className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => openSheet('profile')}>✎ Editar perfil</button>
          </>
        ) : (
          <div className="f4" style={{ marginTop: 12 }}>
            <div className="field"><label htmlFor="meta-kcal">Kcal</label><input id="meta-kcal" type="number" inputMode="numeric" defaultValue={g.kcal} onBlur={e => setGoal('kcal', e.target.value)} /></div>
            <div className="field"><label htmlFor="meta-prot">Prot</label><input id="meta-prot" type="number" inputMode="numeric" defaultValue={g.p} onBlur={e => setGoal('p', e.target.value)} /></div>
            <div className="field"><label htmlFor="meta-carb">Carb</label><input id="meta-carb" type="number" inputMode="numeric" defaultValue={g.c} onBlur={e => setGoal('c', e.target.value)} /></div>
            <div className="field"><label htmlFor="meta-grasa">Grasa</label><input id="meta-grasa" type="number" inputMode="numeric" defaultValue={g.f} onBlur={e => setGoal('f', e.target.value)} /></div>
          </div>
        )}
      </motion.section>

      <motion.section variants={seccion}>
        <h3>Modo prueba</h3>
        <ModoPrueba />
      </motion.section>

      <motion.section variants={seccion}>
        <h3>Datos de prueba</h3>
        <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.5, marginBottom: 10 }}>
          Carga tu rutina Anterior/Posterior, ~1 mes de nutrición y ~5 semanas de sesiones reconstruidas desde tus pesos anotados. Sirve para ver la app llena; se borra aparte sin tocar lo demás.
        </div>
        <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={startSeedLoad}>🧪 Cargar mi registro</button>
        {nSeed > 0 && (
          <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={startSeedWipe}>Borrar lo cargado ({nSeed} registros)</button>
        )}
      </motion.section>

      <motion.section variants={seccion}>
        <h3>Mi base de alimentos</h3>
        <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.5, marginBottom: 10 }}>
          Bajá la tabla en Markdown, editala donde quieras y volvé a subirla. Se
          actualizan los que ya tenías y se agregan los nuevos — nada se borra.
        </div>
        <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={() => exportFoodsMD()}>⬇ Exportar alimentos a MD</button>
        <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={() => mdRef.current?.click()}>⬆ Importar alimentos MD</button>
        <input ref={mdRef} type="file" accept=".md,text/markdown,text/plain" hidden onChange={onMdFile} />
      </motion.section>

      <motion.section variants={seccion}>
        <h3>Respaldo</h3>

        {/* Estado real del almacenamiento. Existe por la pérdida total del
            2026-09-17: la app no tenía forma de decir que sus datos estaban
            en una repisa que el sistema podía tirar. Cada estado dice lo que
            sabe y nada más — `null` es "no se pudo saber", no "está todo
            bien". Ver el encabezado de lib/persist.js. */}
        <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.5, marginBottom: 10 }}>
          {S.persisted === true && <>✓ Tu teléfono tiene <b>reservado</b> este espacio. El sistema no lo borra solo.</>}
          {/* Sin el glifo ⋮ a propósito: en la tipografía de la app se lee
              como dos puntos ("menú : del navegador") y confunde. */}
          {S.persisted === false && (
            <><b className="txt-warn">⚠ El navegador no reservó este espacio.</b> Si el teléfono
            se queda sin memoria puede borrar <b>todo</b> de golpe y sin avisar. Para que lo
            reserve, instalá la app: menú del navegador (los tres puntitos de arriba a la
            derecha) → "Agregar a pantalla de inicio". Y hasta entonces, exportá seguido.</>
          )}
          {S.persisted === null && <>No se pudo saber si este navegador reserva el espacio.</>}
          {espacio && <><br />Ocupado: <b>{(espacio.usage / 1048576).toFixed(1)} MB</b>.</>}
          <br />
          {diasBackup === null
            ? <b className="txt-warn">Nunca exportaste un respaldo.</b>
            : <>Último respaldo: <b>{diasBackup === 0 ? 'hoy' : `hace ${diasBackup} día${diasBackup === 1 ? '' : 's'}`}</b>.</>}
        </div>

        {/* El respaldo exportado es lo ÚNICO que sobrevive a un borrado del
            usuario o del sistema: vive en Descargas, fuera del almacenamiento
            que el navegador puede desalojar. Cuando hace falta de verdad, el
            botón deja de ser un "ghost" más de la lista. */}
        <button type="button" className={avisarBackup ? 'btn' : 'btn ghost'} style={{ marginBottom: 10 }} onClick={() => exportJSON()}>⬇ Exportar todo a JSON</button>

        {/* Prendido de fábrica. El default lo eligió la pérdida del
            2026-09-17, no una preferencia: acordarse de respaldar es
            justamente lo que falla. */}
        <div className="seg" style={{ marginBottom: 10 }}>
          <button type="button" className={autoOn ? 'on' : ''} aria-pressed={autoOn} onClick={() => setAutoBackup(true)}>Respaldo automático</button>
          <button type="button" className={autoOn ? '' : 'on'} aria-pressed={!autoOn} onClick={() => setAutoBackup(false)}>Sólo manual</button>
        </div>
        <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.5, marginBottom: 10 }}>
          {autoOn
            ? 'Al cerrar un entrenamiento, si pasó una semana desde tu última copia, la app guarda un JSON en Descargas sola. Ahí no lo alcanza ningún borrado del navegador.'
            : 'Nadie va a respaldar por vos. Si el teléfono borra los datos, se pierde lo que no hayas exportado a mano.'}
        </div>
        <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={() => importRef.current?.click()}>⬆ Importar JSON</button>
        <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={onImportFile} />
        <button type="button" className="btn danger" onClick={startWipeAll}>Borrar todos los datos</button>
      </motion.section>

      <motion.section variants={seccion}>
        <h3>Versión</h3>
        <div className="txt-mut" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.5, marginBottom: 10 }}>
          Instalada: <b className="txt-blue">{__BUILD__}</b><br />
          Si acabás de pedir un cambio y no lo ves, es que tu teléfono todavía
          tiene la versión anterior guardada. Este botón la va a buscar.
        </div>
        <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={buscarUpdate} disabled={buscando}>
          {buscando ? 'Buscando…' : '⟳ Buscar actualización'}
        </button>
      </motion.section>

      <motion.section variants={seccion}>
        <div className="txt-mut" style={{ fontSize: 'var(--t-micro)', textAlign: 'center', marginTop: 16 }}>FIERRO v1 · datos 100% en tu dispositivo</div>
      </motion.section>
    </motion.div>
  );
}
