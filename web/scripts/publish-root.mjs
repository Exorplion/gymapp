// Copia el build de web/dist a la raíz del repo, que es lo que se sirve
// (GitHub Pages desde la raíz de main, con .nojekyll).
//
// Por qué un script y no `build.outDir: '..'` en vite.config.js: con outDir
// apuntando fuera del proyecto, un `emptyOutDir: true` — el default cuando
// outDir está fuera de la raíz — borraría el repo entero. Acá el borrado está
// acotado a mano a las carpetas que el build genera, y nunca toca nada más.
//
// Se ejecuta solo, como parte de `npm run build`.
import { cp, rm, readdir, mkdir } from 'node:fs/promises';
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

// assets/ lleva nombres con hash, así que sin limpiar se acumularían los de
// todos los builds anteriores. Es el único directorio que el build es dueño
// de recrear por completo.
await rm(join(root, 'assets'), { recursive: true, force: true });
await mkdir(root, { recursive: true });

for (const entry of await readdir(dist)) {
  await cp(join(dist, entry), join(root, entry), { recursive: true });
}

console.log(`publish-root: ${(await readdir(dist)).length} entradas copiadas de web/dist a la raíz.`);
