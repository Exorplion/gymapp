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

## Criterio de producto

La app **no inventa datos que no puede sostener**. Cuando falta información se dice,
no se rellena con un cero ni con una estimación disfrazada de hecho:

- `daysSinceGroup()` devuelve `null` para "nunca" (distinto de "hace mucho")
- `microsOfDay()` devuelve `coverage` para no afirmar sobre lo que no midió
- `acwr()` devuelve `null` sin 4 semanas de historial
- un alimento sin datos de micronutrientes cuenta como "sin dato", nunca como 0

Y los avisos son **raros, no diarios**: micros sólo si estuvieron bajos 5 de 7 días,
confetti sólo en hitos reales — nunca en el registro rutinario, o la moneda se devalúa.
