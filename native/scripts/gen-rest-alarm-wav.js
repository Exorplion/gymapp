// Script de un solo uso: genera native/assets/sounds/rest-alarm.wav.
//
// Reproduce EXACTAMENTE la matemática de muestrasAlarma() en
// web/src/lib/alarm.js (mismos PITIDOS, SR, DUR, rampas de 8ms), pero
// en vez de sintetizar el WAV en runtime dentro de un <audio>, lo
// escribe una vez a disco para empaquetarlo como asset local de RN
// (ver ruling 2 de docs/superpowers/plans/2026-08-22-rn-etapa6a-rest-timer.md).
//
// No se vuelve a correr en runtime ni en CI: es un generador de asset,
// se ejecuta a mano cuando hace falta regenerar el archivo.
const fs = require('fs');
const path = require('path');

const PITIDOS = [[0, .16, 880], [.26, .42, 880], [.52, .70, 1175]];
const SR = 22050;
const DUR = 2;

function muestrasAlarma() {
  const sr = SR, dur = DUR, n = sr * dur;
  const buf = Buffer.alloc(44 + n * 2);
  const txt = (o, s) => buf.write(s, o, 'ascii');
  txt(0, 'RIFF'); buf.writeUInt32LE(36 + n * 2, 4); txt(8, 'WAVE');
  txt(12, 'fmt '); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  txt(36, 'data'); buf.writeUInt32LE(n * 2, 40);

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let m = 0;
    for (const [a, b, f] of PITIDOS) {
      if (t < a || t >= b) continue;
      const d = t - a, largo = b - a;
      const env = Math.min(1, d / .008, (largo - d) / .008);
      m += Math.sin(2 * Math.PI * f * t) * env;
    }
    const s = Math.max(-1, Math.min(1, m)) * 32767 * .85;
    buf.writeInt16LE(Math.round(s), 44 + i * 2);
  }
  return buf;
}

const outPath = path.join(__dirname, '..', 'assets', 'sounds', 'rest-alarm.wav');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, muestrasAlarma());
console.log('escrito', outPath);
