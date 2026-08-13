// Registrar comida dictando. Mismo patrón que VoiceLog.jsx (sesiones): el
// reconocimiento de voz corre en el navegador, sin enviar audio a ningún lado.
//
// Lo que se dicta se interpreta con la tabla local + tus propios alimentos
// (lib/foodvoice.js). Nada se guarda hasta que confirmás, y lo que la app no
// reconoce se marca en vez de inventarle macros — completás esos una vez y
// quedan guardados como alimento tuyo para la próxima.
import { useEffect, useRef, useState } from 'react';
import { S, closeSheet, bump } from '../../lib/state.js';
import { idb } from '../../lib/db.js';
import { uid, fmtNum, round1, vibrate } from '../../lib/format.js';
import { parseFoodSpeech, sumItems } from '../../lib/foodvoice.js';
import { toast } from '../../lib/toast.js';

const SR_CLASS = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
  : null;

export default function FoodVoice() {
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);
  const [recording, setRecording] = useState(false);
  const recRef = useRef(null);

  // Se corta el reconocimiento si el sheet se cierra a mitad de dictado:
  // sin esto el micrófono seguiría abierto.
  useEffect(() => () => { try { recRef.current?.stop(); } catch (e) { /* ya detenido */ } }, []);

  function listen() {
    if (!SR_CLASS) { toast('Tu navegador no reconoce voz'); return; }
    const rec = new SR_CLASS();
    recRef.current = rec;
    rec.lang = 'es-PE';
    rec.interimResults = false;
    rec.onresult = e => {
      const heard = e.results[0][0].transcript;
      setText(heard);
      setItems(parseFoodSpeech(heard, S.foods));
    };
    rec.onerror = () => { setRecording(false); toast('No te escuché, probá de nuevo'); };
    rec.onend = () => setRecording(false);
    setRecording(true);
    rec.start();
  }

  function reparse(t) {
    setText(t);
    setItems(parseFoodSpeech(t, S.foods));
  }

  const known = items.filter(i => !i.unknown);
  const unknown = items.filter(i => i.unknown);
  const total = sumItems(items);

  async function confirm() {
    if (!known.length) return;
    const time = new Date().toTimeString().slice(0, 5);
    for (const i of known) {
      const meal = {
        id: uid(), date: S.nutriDate, name: i.name,
        kcal: i.kcal, p: i.p, c: i.c, f: i.f, t: time,
      };
      await idb.put('meals', meal);
      S.meals.push(meal);
    }
    vibrate(14);
    bump();
    closeSheet();
    toast(`＋ ${known.length} ${known.length === 1 ? 'comida' : 'comidas'} · ${total.kcal} kcal`);
  }

  return (
    <>
      <h2 className="sheet-title">Registrar por voz</h2>
      <div className="txt-mut" style={{ fontSize: 13, marginTop: 2, marginBottom: 14 }}>
        Decí lo que comiste, con cantidades si las sabés. Por ejemplo:
        «200 gramos de pollo y una taza de arroz».
      </div>

      <button
        type="button"
        className={`btn ${recording ? 'ghost' : ''}`}
        onClick={listen}
        disabled={recording}
      >
        {recording ? '🎙 Escuchando…' : '🎙 Dictar'}
      </button>

      <div className="field" style={{ marginTop: 'var(--s3)' }}>
        <label htmlFor="foodvoice-texto">O escribilo</label>
        <input
          id="foodvoice-texto"
          type="text"
          value={text}
          placeholder="dos huevos, 150 g de pollo…"
          onChange={e => reparse(e.target.value)}
        />
      </div>

      {known.length > 0 && (
        <>
          <div className="sect">Reconocido</div>
          <div className="card">
            {known.map((i, n) => (
              <div className="row" key={n}>
                <div className="grow">
                  <div className="t">{i.name}</div>
                  <div className="s">
                    {i.grams ? `${i.grams} g · ` : ''}{i.kcal} kcal · P {fmtNum(round1(i.p))} · C {fmtNum(round1(i.c))} · G {fmtNum(round1(i.f))}
                    {i.source === 'mine' && <span className="eq-tag" style={{ marginLeft: 7 }}>tuyo</span>}
                  </div>
                </div>
                <button type="button" className="meal-del" onClick={() => setItems(items.filter(x => x !== i))}>✕</button>
              </div>
            ))}
            <div className="row" style={{ borderTop: '1px solid rgba(255,255,255,.09)' }}>
              <div className="grow"><div className="t">Total</div></div>
              <div className="num" style={{ color: 'var(--accent)' }}>{total.kcal} kcal</div>
            </div>
          </div>
        </>
      )}

      {unknown.length > 0 && (
        <>
          <div className="sect">No lo reconozco</div>
          <div className="card">
            <div className="txt-mut" style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 10 }}>
              No le invento macros a lo que no conozco. Agregalo una vez con
              «+ Agregar comida» y marcalo como frecuente: desde entonces lo
              reconozco cuando lo dictes.
            </div>
            {unknown.map((i, n) => (
              <div className="row" key={n}><div className="grow"><div className="t">{i.name}</div></div></div>
            ))}
          </div>
        </>
      )}

      {known.length > 0 && (
        <button type="button" className="btn" style={{ marginTop: 'var(--s4)' }} onClick={confirm}>
          Agregar {known.length === 1 ? 'la comida' : `las ${known.length} comidas`}
        </button>
      )}
    </>
  );
}
