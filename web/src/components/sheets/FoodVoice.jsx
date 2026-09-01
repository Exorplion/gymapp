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
import { bloomOpen, staggerReveal } from '../../lib/motion.js';
import { Button, Card } from '../ui/primitives.jsx';

const SR_CLASS = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
  : null;

export default function FoodVoice() {
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);
  const [recording, setRecording] = useState(false);
  const recRef = useRef(null);
  const rootRef = useRef(null);
  const knownRef = useRef(null);

  useEffect(() => { bloomOpen(rootRef.current); }, []);

  // Se corta el reconocimiento si el sheet se cierra a mitad de dictado:
  // sin esto el micrófono seguiría abierto.
  useEffect(() => () => { try { recRef.current?.stop(); } catch (e) { /* ya detenido */ } }, []);

  useEffect(() => {
    if (knownRef.current) staggerReveal(knownRef.current.children);
  }, [items]);

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
    <div ref={rootRef}>
      <h2 className="font-cond text-2xl font-bold text-txt">Registrar por voz</h2>
      <div className="mt-0.5 mb-3.5 text-[13px] text-mut">
        Decí lo que comiste, con cantidades si las sabés. Por ejemplo:
        «200 gramos de pollo y una taza de arroz».
      </div>

      <Button type="button" variant={recording ? 'ghost' : 'primary'} className="w-full" onClick={listen} disabled={recording}>
        {recording ? '🎙 Escuchando…' : '🎙 Dictar'}
      </Button>

      <div className="mt-3">
        <label htmlFor="foodvoice-texto" className="mb-1.5 block text-[13px] font-medium text-mut">O escribilo</label>
        <input
          id="foodvoice-texto"
          type="text"
          className="h-11 w-full rounded-[var(--radius-r)] border border-line2 bg-card2 px-3.5 text-[15px] text-txt outline-none transition-colors focus-visible:border-blue2"
          value={text}
          placeholder="dos huevos, 150 g de pollo…"
          onChange={e => reparse(e.target.value)}
        />
      </div>

      {known.length > 0 && (
        <>
          <div className="mx-0.5 mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-mut">Reconocido</div>
          <Card className="p-0 divide-y divide-white/5">
            <div ref={knownRef}>
              {known.map((i, n) => (
                <div className="flex items-center gap-2.5 px-4 py-2.5" key={n}>
                  <div className="grow">
                    <div className="text-[14.5px] text-txt">{i.name}</div>
                    <div className="text-[13px] text-mut">
                      {i.grams ? `${i.grams} g · ` : ''}{i.kcal} kcal · P {fmtNum(round1(i.p))} · C {fmtNum(round1(i.c))} · G {fmtNum(round1(i.f))}
                      {i.source === 'mine' && <span className="ml-1.5 inline-flex items-center rounded-full bg-white/8 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-mut">tuyo</span>}
                    </div>
                  </div>
                  <button type="button" className="grid h-8 w-8 flex-none place-items-center rounded-full text-mut hover:text-txt" onClick={() => setItems(items.filter(x => x !== i))}>✕</button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2.5 border-t border-white/[.09] px-4 py-2.5">
              <div className="grow"><div className="text-[14.5px] text-txt">Total</div></div>
              <div className="font-cond font-bold text-accent">{total.kcal} kcal</div>
            </div>
          </Card>
        </>
      )}

      {unknown.length > 0 && (
        <>
          <div className="mx-0.5 mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-mut">No lo reconozco</div>
          <Card>
            <div className="mb-2.5 text-[12.5px] leading-relaxed text-mut">
              No le invento macros a lo que no conozco. Agregalo una vez con
              «+ Agregar comida» y marcalo como frecuente: desde entonces lo
              reconozco cuando lo dictes.
            </div>
            {unknown.map((i, n) => (
              <div className="py-1.5" key={n}><div className="text-[14.5px] text-txt">{i.name}</div></div>
            ))}
          </Card>
        </>
      )}

      {known.length > 0 && (
        <Button type="button" className="mt-4 w-full" onClick={confirm}>
          Agregar {known.length === 1 ? 'la comida' : `las ${known.length} comidas`}
        </Button>
      )}
    </div>
  );
}
