# FIERRO

PWA de entrenamiento + nutrición, de un solo usuario. Los datos viven en IndexedDB
del teléfono y **nunca tocan el repo**.

## Antes de empezar

**Leé [`HANDOFF.md`](./HANDOFF.md)** si vas a trabajar en el roadmap del producto
(`Plan Fierro.pdf`). Tiene el estado real, qué se intentó y falló, y el próximo paso
exacto. Evita reintentar caminos ya descartados.

## Stack

React 19 · Vite · Tailwind v4 · shadcn/Radix · framer-motion + GSAP · vitest.
Sin backend, por decisión explícita — no proponerlo salvo que Enzo lo pida.

Usar `framer-motion` (import path legacy), **no** `motion/react`. Mezclarlos rompe
`AnimatePresence`.

## Comandos

```bash
cd web
npm run dev     # localhost:5173
npm run test    # vitest
npm run lint    # oxlint (el error de WarmupCard.jsx es preexistente)
npm run build   # build + copia a la raíz del repo para GitHub Pages
```

## Publicar

GitHub Pages sirve **la raíz de `main`** y **no hay CI que buildee**: un cambio en
`web/src/` no llega al sitio hasta que se commitea el build. Orden correcto:

1. Rebasar el código sobre `origin/main` **primero** (si no, los assets conflictúan)
2. `cd web && npm run build`
3. Commitear la raíz: `assets/ index.html manifest.webmanifest sw.js workbox-*.js`
4. Push → PR → merge

`gh auth status` tiene que mostrar **Exorplion** activa; si está `erojasefc` (la del
trabajo), el push da 403 → `gh auth switch --hostname github.com --user Exorplion`.

## Coherencia visual — NO negociable

**Todo lo nuevo se ve como el resto de la app.** No es un pedido de estilo:
Enzo lo reclamó tres veces distintas ("las tarjetas se ven mal, desalineadas
y con cero estética, **siempre pasa lo mismo**"), y cada vez la causa fue la
misma — inventar markup nuevo en vez de usar el patrón que ya existía.

Antes de escribir una pantalla, un sheet o una tarjeta:

1. **Buscá el patrón que ya existe y usalo.** Una tarjeta tocable con título,
   subtítulo y chevron **ya es** `.nav-card` (`styles.css:2148`). Un panel es
   `.card`. Un botón-chip es `.chip`. Si algo se parece a lo que estás
   haciendo, no lo rehagas: reusalo.
2. **Nunca combines una clase de apariencia con un reset.** `.linkcard` es un
   **reset de botón** — `border:0; padding:0; background:none` — hecho para
   que un `<button>` NO parezca tarjeta. `class="card linkcard"` es
   autocontradictorio: el reset gana y te quedás con una tarjeta sin padding
   ni borde. Fue exactamente el bug de "Mis rutinas".
   - Para una tarjeta tocable: **`class="card cardbtn"`**. `.cardbtn` la hace
     botón sin tocar fondo, borde ni padding.
   - `.linkcard` sólo para un `<button>` que debe verse como texto pelado,
     sin ninguna clase de apariencia.
   - Para una lista: **`.group` + `.grouprow`**. `.grouprow` ya trae el reset
     adentro, así que no hay nada que combinar.
   - Y no confíes en la especificidad para salvarte: `card hero linkcard`
     hoy "funciona" sólo porque `.card.hero` son dos clases y le gana al
     reset. Eso no es un diseño, es un accidente.
3. **Si inventás una clase, tiene que existir en `styles.css`.** `.tmpl` se
   usó en el markup y nunca se escribió: una clase muerta no falla, no avisa,
   y deja la tarjeta a medio estilar.
4. **Espaciado, radios, colores y tipografía salen de tokens**, nunca de un
   número suelto ni de un hex. Mirá `:root` en `styles.css`.
5. **Verificá a 390px en un navegador real** antes de decir que está listo, y
   **medí**: `getBoundingClientRect()` para ver si algo se desborda o se
   superpone, `getComputedStyle()` para confirmar que el padding que creés que
   está, está. Un screenshot solo no alcanza; los tests no ven esto.

Trampa registrada: `innerText` devuelve **vacío** si un ancestro tiene
`visibility:hidden`. Para inspeccionar el DOM usá `textContent`.

## Criterio de producto

La app **no inventa datos que no puede sostener**. Cuando falta información se dice,
no se rellena con un cero ni con una estimación disfrazada de hecho:

- `daysSinceGroup()` devuelve `null` para "nunca" (distinto de "hace mucho")
- `microsOfDay()` devuelve `coverage` para no afirmar sobre lo que no midió
- `acwr()` devuelve `null` sin 4 semanas de historial
- un alimento sin datos de micronutrientes cuenta como "sin dato", nunca como 0

Y los avisos son **raros, no diarios**: micros sólo si estuvieron bajos 5 de 7 días,
confetti sólo en hitos reales — nunca en el registro rutinario, o la moneda se devalúa.
