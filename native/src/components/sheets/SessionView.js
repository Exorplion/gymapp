// Puerto de web/src/components/sheets/SessionView.jsx (281 líneas) — el sheet
// más grande/complejo portado hasta ahora en esta migración.
//
// Una sola vista para una sesión, con tres entradas: al terminarla
// (justFinished), al tocarla en el historial, y desde el día ya completado en
// Hoy. Lee la sesión de S.sessions POR ID, no por prop, para que una edición
// se refleje sin cerrar y reabrir el sheet.
//
// "Lo que hiciste" era una tarjeta plana por ejercicio: el nombre y una fila
// de chips. Sin grupo muscular, sin resumen y sin relación con la vez
// anterior — la vista donde uno mira "cómo me fue" no contestaba esa pregunta.
// Ahora cada ejercicio es una tarjeta con su grupo, sus series numeradas, su
// volumen y cuánto cambió respecto de la última vez.
//
// El ícono Skip (Icon.jsx en web) no está portado todavía en RN — se
// reemplaza por el emoji ⏭, mismo criterio que StreakDetail.js con 🔥.
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { S, useStore, openSheet, closeSheet } from '../../lib/state.js';
import { fmtDFull, fmtNum, round1, uid } from '../../lib/format.js';
import { sessionPRs, deleteHistorySession, updateHistorySession, entryDelta, groupSets } from '../../lib/session.js';
import { pinAddedToRoutine } from '../../lib/rutina-logic.js';
import { catOf } from '../../lib/muscle.js';
import { equipLabel, exKey } from '../../lib/equip.js';
import { toast } from '../../lib/toast.js';
import { iconOf } from '../../lib/exicon.js';
import ExIcon from '../ExIcon.js';

// Colores del tema oscuro ya establecido en esta migración.
const GREEN = '#1fbf75';
const WARN = '#e0a23a';
const BLUE = '#2e7dff';
const GOLD = '#e0b23a';
const MUT = '#8a93a6';

// Riel de color por veredicto: sube = mejora, baja = regresión, igual/nuevo =
// neutro, pr = récord. Los colores concretos son elección de esta migración;
// el CONCEPTO (una columna que se lee de arriba a abajo de un vistazo) es lo
// que se preserva del original.
const RAIL = { pr: GOLD, sube: GREEN, baja: WARN, igual: BLUE, nuevo: MUT };

export default function SessionView({ id, justFinished = false }) {
  useStore();
  const [editando, setEditando] = useState(false);
  // La pregunta de fijar lo agregado se responde una vez y no vuelve
  const [pinResuelto, setPinResuelto] = useState(false);
  const s = S.sessions.find(x => x.id === id);
  if (!s) return null;

  const prs = sessionPRs(s);
  const hasPR = prs.length > 0;
  const prKeys = new Set(prs.map(exKey));
  const entries = s.entries || [];
  const nsets = entries.reduce((a, e) => a + e.sets.length, 0);
  const vol = entries.reduce((a, e) => a + e.sets.reduce((b, st) => b + st.w * st.r, 0), 0);
  const delDia = (S.routine.find(sl => sl.id === s.slotId)?.exercises || []).filter(ex => !entries.some(e => e.name === ex.name));

  /* Toda edición clona la sesión, la muta y la manda entera a
     updateHistorySession — que guarda y ofrece Deshacer. start, end, duration,
     date, weekday y dayName no se tocan en ninguna de estas funciones: el
     tiempo que quedó registrado en el gimnasio es un hecho medido. */
  function editar(fn, msg) {
    const copia = structuredClone(s);
    fn(copia);
    copia.entries = (copia.entries || []).filter(e => e.sets.length);
    // Una sesión sin series no es una corrección, es un borrado a medias: deja
    // un registro fantasma con su duración pero sin nada adentro.
    if (!copia.entries.length) {
      toast('Una sesión no puede quedar vacía — usá "Eliminar sesión"');
      return;
    }
    updateHistorySession(copia, msg);
  }

  const setSerie = (ei, si, campo, valor) => editar(c => {
    c.entries[ei].sets[si][campo] = campo === 'w'
      ? Math.max(0, round1(parseFloat(String(valor).replace(',', '.')) || 0))
      : Math.max(1, parseInt(valor, 10) || 1);
  }, 'Serie corregida');

  const borrarSerie = (ei, si) => editar(c => { c.entries[ei].sets.splice(si, 1); }, 'Serie borrada');

  const agregarSerie = ei => editar(c => {
    const sets = c.entries[ei].sets;
    const ult = sets[sets.length - 1];
    sets.push({ w: ult ? ult.w : 20, r: ult ? ult.r : 10, t: Date.now() });
  }, 'Serie agregada');

  const borrarEjercicio = ei => editar(c => { c.entries[ei].sets = []; }, 'Ejercicio borrado');

  const agregarEjercicio = ex => editar(c => {
    c.entries.push({
      exId: ex.id || uid(), name: ex.name, equip: ex.equip, machine: ex.machine, cat: ex.cat,
      sets: [{ w: 20, r: ex.reps || 10, t: Date.now() }],
    });
  }, `${ex.name} agregado`);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>
        {justFinished ? `${hasPR ? '🎉' : '💪'} Sesión guardada` : (s.dayName || 'Entrenamiento')}
      </Text>
      <Text style={styles.sub}>
        {justFinished ? `${s.dayName || 'Entrenamiento'} · ` : ''}{fmtDFull(s.date)} · {s.duration} min
      </Text>

      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.n}>{s.duration}</Text><Text style={styles.l}>Min</Text></View>
        <View style={styles.stat}><Text style={styles.n}>{nsets}</Text><Text style={styles.l}>Series</Text></View>
        <View style={styles.stat}><Text style={styles.n}>{entries.length}</Text><Text style={styles.l}>Ejercicios</Text></View>
        <View style={styles.stat}><Text style={styles.n}>{Math.round(vol)}</Text><Text style={styles.l}>Kg vol.</Text></View>
      </View>

      {hasPR && (
        <View style={styles.prCard}>
          <Text style={styles.prTroph}>🏆</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.prTitle}>
              {justFinished ? '¡Nuevo récord!' : `${prs.length} récord${prs.length === 1 ? '' : 's'} en esta sesión`}
            </Text>
            <Text style={styles.prText}>
              {prs.map(p => `${p.name} · ${fmtNum(round1(p.w))} kg × ${p.r}${p.unilateral ? ' por lado' : ''}`).join(' · ')}
            </Text>
          </View>
        </View>
      )}

      {/* Agregaste algo fuera del plan: se pregunta una vez si queda fijo.
          Improvisar en el gimnasio no debería reescribir tu rutina solo. */}
      {justFinished && !pinResuelto && s.added?.length > 0 && (
        <View style={styles.pinBox}>
          <Text style={styles.pinText}>
            Agregaste <Text style={styles.pinBold}>{s.added.map(a => a.name).join(', ')}</Text> hoy.
            {' '}¿Lo dejo en tu rutina de {s.dayName}?
          </Text>
          <View style={styles.btnRow}>
            <Pressable style={styles.btnGhostSm} onPress={() => { setPinResuelto(true); toast('Queda sólo en esta sesión'); }}>
              <Text style={styles.btnGhostSmText}>No, sólo fue hoy</Text>
            </Pressable>
            <Pressable
              style={styles.btnSm}
              onPress={async () => { setPinResuelto(true); await pinAddedToRoutine(s.slotId, s.added); }}
            >
              <Text style={styles.btnSmText}>Sí, agregarlo</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Los saltados no tienen series, así que no entran en entries: cero
          volumen, cero PRs. Se muestran aparte para que dentro de un mes sepas
          si ese día no tocaba o si lo dejaste pasar. */}
      {s.skipped?.length > 0 && (
        <View style={styles.skipNote}>
          <Text style={styles.skipIcon}>⏭</Text>
          <Text style={styles.skipText}>
            {s.skipped.length} saltado{s.skipped.length === 1 ? '' : 's'} · {s.skipped.map(x => x.name).join(' · ')}
          </Text>
        </View>
      )}

      <Text style={styles.sect}>Lo que hiciste</Text>
      {entries.map((e, ei) => (
        <EntryCard
          key={ei}
          sess={s} entry={e} idx={ei}
          editando={editando}
          esPR={prKeys.has(exKey(e))}
          onSetSerie={setSerie} onBorrarSerie={borrarSerie}
          onAgregarSerie={agregarSerie} onBorrarEjercicio={borrarEjercicio}
        />
      ))}

      {editando && delDia.length > 0 && (
        <>
          <Text style={styles.sect}>Agregar un ejercicio que hiciste</Text>
          <View style={styles.chips}>
            {delDia.map(ex => (
              <Pressable key={ex.id} style={styles.chipBlue} onPress={() => agregarEjercicio(ex)}>
                <Text style={styles.chipBlueText}>＋ {ex.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {justFinished ? (
        <Pressable style={[styles.btn, hasPR && styles.btnOk]} onPress={closeSheet}>
          <Text style={styles.btnText}>Guardar y cerrar</Text>
        </Pressable>
      ) : (
        <>
          <Pressable style={styles.btnGhost} onPress={() => setEditando(v => !v)}>
            <Text style={styles.btnGhostText}>{editando ? '✓ Listo' : '✎ Corregir lo que anoté'}</Text>
          </Pressable>
          <Text style={styles.ptextCenter}>
            Los minutos y la fecha no cambian: sólo se corrige lo que hiciste.
          </Text>
          <Pressable style={styles.btnDanger} onPress={() => confirmDel(s.id)}>
            <Text style={styles.btnDangerText}>Eliminar sesión</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

/** Un ejercicio de la sesión.
 *
 * El riel de la izquierda es el que le da vida a la lista: su color dice cómo
 * te fue en ESE ejercicio — subiste, igual, bajaste, récord. Apilados, los
 * rieles forman una columna que se lee de arriba abajo y cuenta la sesión
 * entera de un vistazo. Antes las tarjetas pesaban visualmente lo mismo,
 * porque codificaban qué ejercicio (categórico, todos iguales) y no cuánto
 * moviste (que es lo que varía).
 *
 * Y el peso va grande, agrupado: en el gimnasio no se dice "85×7, 85×6", se
 * dice "85 por 7 y 6". El número es el contenido de un registro de fuerza.
 */
function EntryCard({ sess, entry, idx, editando, esPR, onSetSerie, onBorrarSerie, onAgregarSerie, onBorrarEjercicio }) {
  const grupo = catOf(entry);
  const vol = entry.sets.reduce((a, st) => a + st.w * st.r, 0);
  const d = entryDelta(sess, entry);
  const grupos = groupSets(entry.sets);

  const veredicto = esPR ? 'pr' : !d ? 'nuevo' : d.delta > 0 ? 'sube' : d.delta < 0 ? 'baja' : 'igual';

  return (
    <View style={[styles.entryCard, { borderLeftColor: RAIL[veredicto] }]}>
      <View style={styles.entryTop}>
        <ExIcon icono={iconOf(entry)} size={22} />
        <Text style={[styles.eyebrow, !grupo && styles.eyebrowWarn]}>{grupo || 'sin grupo'}</Text>
        {!!equipLabel(entry) && <Text style={styles.eqTag}>{equipLabel(entry)}</Text>}
        {esPR && <Text style={styles.entryPr}>🏆</Text>}
      </View>
      <View style={styles.dcardHead}>
        {editando ? (
          <Pressable onPress={() => openSheet('entry-edit', { sessId: sess.id, idx })}>
            <Text style={styles.entryNameEdit}>{entry.name} <Text style={styles.pen}>✎</Text></Text>
          </Pressable>
        ) : (
          <Text style={styles.dcardTitle}>{entry.name}</Text>
        )}
        {editando && (
          <Pressable style={styles.miniRed} onPress={() => onBorrarEjercicio(idx)}>
            <Text style={styles.miniRedText}>✕</Text>
          </Pressable>
        )}
      </View>

      {editando ? (
        <>
          {entry.sets.map((st, si) => (
            // la key lleva los valores: al borrar una serie los índices se
            // corren, y sin esto el input no controlado seguiría mostrando el
            // defaultValue de la serie que ocupaba ese lugar antes
            <View key={`${si}-${st.w}-${st.r}`} style={styles.setEdit}>
              <Text style={styles.setEditI}>{si + 1}</Text>
              <TextInput
                style={styles.setEditInput}
                keyboardType="decimal-pad"
                defaultValue={fmtNum(round1(st.w))}
                onBlur={ev => onSetSerie(idx, si, 'w', ev.nativeEvent.text)}
              />
              <Text style={styles.setEditU}>kg ×</Text>
              <TextInput
                style={styles.setEditInput}
                keyboardType="number-pad"
                defaultValue={String(st.r)}
                onBlur={ev => onSetSerie(idx, si, 'r', ev.nativeEvent.text)}
              />
              <Pressable style={styles.miniRed} onPress={() => onBorrarSerie(idx, si)}>
                <Text style={styles.miniRedText}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.btnGhostSm} onPress={() => onAgregarSerie(idx)}>
            <Text style={styles.btnGhostSmText}>+ Serie</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.loads}>
          {grupos.map((g, i) => (
            <View key={i} style={styles.load}>
              <Text style={styles.kg}>{fmtNum(round1(g.w))}<Text style={styles.kgSmall}>kg</Text></Text>
              <View style={styles.reps}>
                {g.reps.map((r, j) => (
                  <View key={j} style={styles.rep}>
                    <Text style={styles.repS}>Serie {g.from + j}</Text>
                    <Text style={styles.repR}>{r}<Text style={styles.repRSmall}>reps</Text></Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.dcardFoot}>
        <Text style={styles.dcardFootText}>
          {entry.sets.length} serie{entry.sets.length === 1 ? '' : 's'} · {Math.round(vol).toLocaleString('es')} kg
        </Text>
        {d && d.delta !== 0 && (
          <Text style={d.delta > 0 ? styles.txtOk : styles.txtWarn}>
            {d.delta > 0 ? '↗ +' : '↘ '}{fmtNum(d.delta)} kg
          </Text>
        )}
        {d && d.delta === 0 && <Text style={styles.txtMut}>= igual</Text>}
        {!d && <Text style={styles.txtMut}>primera vez</Text>}
      </View>
    </View>
  );
}

function confirmDel(id) {
  openSheet('confirm', {
    title: 'Eliminar sesión',
    body: 'Se elimina del historial. Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
    onConfirm: () => deleteHistorySession(id),
    onCancel: () => openSheet('session-view', { id }),
  });
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  h2: { color: '#fff', fontSize: 19, fontWeight: '700', marginBottom: 4 },
  sub: { color: MUT, fontSize: 13, marginBottom: 14 },

  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  n: { color: '#fff', fontSize: 20, fontWeight: '700' },
  l: { color: MUT, fontSize: 11, marginTop: 2 },

  prCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18,
    backgroundColor: 'rgba(224,178,58,.1)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(224,178,58,.3)',
  },
  prTroph: { fontSize: 26 },
  prTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  prText: { color: MUT, fontSize: 12, marginTop: 2 },

  pinBox: {
    marginTop: 16, backgroundColor: 'rgba(46,125,255,.1)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(46,125,255,.25)',
  },
  pinText: { color: '#c7cdda', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  pinBold: { color: '#5b9dff', fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 10 },

  skipNote: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'flex-start' },
  skipIcon: { color: MUT, fontSize: 14, marginTop: 1 },
  skipText: { color: MUT, fontSize: 12, flex: 1, lineHeight: 17 },

  sect: {
    color: MUT, fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.4, marginTop: 20, marginBottom: 10,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chipBlue: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: 'rgba(46,125,255,.12)', borderWidth: 1, borderColor: '#2e7dff',
  },
  chipBlueText: { color: '#5b9dff', fontSize: 13, fontWeight: '600' },

  btn: { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  btnOk: { backgroundColor: GREEN },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  btnGhost: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14,
    backgroundColor: 'rgba(255,255,255,.06)',
  },
  btnGhostText: { color: '#c7cdda', fontSize: 14, fontWeight: '600' },

  ptextCenter: { color: MUT, fontSize: 12, textAlign: 'center', marginTop: 8 },

  btnDanger: {
    borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 14,
    backgroundColor: 'rgba(224,80,90,.12)', borderWidth: 1, borderColor: 'rgba(224,80,90,.35)',
  },
  btnDangerText: { color: '#e0505a', fontSize: 13, fontWeight: '700' },

  btnGhostSm: {
    borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.06)', marginTop: 8,
  },
  btnGhostSmText: { color: '#c7cdda', fontSize: 13, fontWeight: '600' },
  btnSm: { backgroundColor: BLUE, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  btnSmText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  entryCard: {
    backgroundColor: 'rgba(255,255,255,.05)', borderRadius: 14, padding: 14, marginBottom: 12,
    borderLeftWidth: 4,
  },
  entryTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: {
    color: MUT, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1,
  },
  eyebrowWarn: { color: WARN },
  eqTag: {
    color: '#c7cdda', fontSize: 11, fontWeight: '600', backgroundColor: 'rgba(255,255,255,.08)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  entryPr: { fontSize: 15 },

  dcardHead: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  dcardTitle: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  entryNameEdit: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  pen: { color: MUT, fontSize: 12 },

  miniRed: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(224,80,90,.14)',
  },
  miniRedText: { color: '#e0505a', fontSize: 12, fontWeight: '700' },

  setEdit: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  setEditI: { color: MUT, fontSize: 12, width: 16 },
  setEditInput: {
    backgroundColor: 'rgba(255,255,255,.06)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    color: '#fff', fontSize: 14, width: 64, borderWidth: 1, borderColor: 'rgba(255,255,255,.08)',
  },
  setEditU: { color: MUT, fontSize: 12 },

  loads: { marginTop: 10, gap: 10 },
  load: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kg: { color: '#fff', fontSize: 20, fontWeight: '700', minWidth: 64 },
  kgSmall: { fontSize: 12, color: MUT, fontWeight: '600' },
  reps: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flex: 1 },
  rep: { alignItems: 'center' },
  repS: { color: MUT, fontSize: 10 },
  repR: { color: '#c7cdda', fontSize: 13, fontWeight: '700' },
  repRSmall: { fontSize: 10, color: MUT, fontWeight: '500' },

  dcardFoot: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.06)',
  },
  dcardFootText: { color: MUT, fontSize: 12 },
  txtOk: { color: GREEN, fontSize: 12, fontWeight: '700' },
  txtWarn: { color: WARN, fontSize: 12, fontWeight: '700' },
  txtMut: { color: MUT, fontSize: 12 },
});
