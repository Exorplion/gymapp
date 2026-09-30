// Copia el build de web/dist a la raíz del repo, que es lo que se sirve
// (GitHub Pages desde la raíz de main, con .nojekyll).
//
// Por qué un script y no `build.outDir: '..'` en vite.config.js: con outDir
// apuntando fuera del proyecto, un `emptyOutDir: true` — el default cuando
// outDir está fuera de la raíz — borraría el repo entero. Acá el borrado está
// acotado a mano a las carpetas que el build genera, y nunca toca nada más.
//
// Se ejecuta solo, como parte de `npm run build`.
import { cp, rm, readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { podar } from './publicaciones.mjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const webDir = join(here, '..');
const dist = join(webDir, 'dist');
const root = join(webDir, '..');

if (!existsSync(dist)) {
  console.error('publish-root: no existe web/dist — corré `vite build` primero.');
  process.exit(1);
}

// assets/ lleva nombres con hash. Antes se borraba entero en cada
// publicación, y eso rompía las pantallas que quedaron abiertas desde antes:
// piden los módulos de SU build y ya no estaban (ver publicaciones.mjs). Ahora
// se conservan los de las últimas publicaciones y se borra sólo lo más viejo.
const assetsRaiz = join(root, 'assets');
const registro = join(assetsRaiz, '.publicaciones.json');
await mkdir(assetsRaiz, { recursive: true });
const presentes = (await readdir(assetsRaiz)).filter(f => f !== '.publicaciones.json');
const nuevos = existsSync(join(dist, 'assets')) ? await readdir(join(dist, 'assets')) : [];
let historialPrevio = null;
try { historialPrevio = JSON.parse(await readFile(registro, 'utf8')); } catch { /* primera vez */ }
const { historial, borrar } = podar(historialPrevio, nuevos, presentes);
for (const f of borrar) await rm(join(assetsRaiz, f), { recursive: true, force: true });

for (const entry of await readdir(dist)) {
  await cp(join(dist, entry), join(root, entry), { recursive: true });
}

await writeFile(registro, JSON.stringify(historial) + '\n');

console.log(`publish-root: ${(await readdir(dist)).length} entradas copiadas de web/dist a la raíz; assets/ conserva ${historial.length} publicaciones (${borrar.length} archivos viejos borrados).`);
