# Debug 2026-09-29 — "volví a perder mis datos" y "no me deja registrar un domingo"

Rama `debug/datos-y-domingo` (sobre `origin/main` = 3bb25d9, #127). Sólo
diagnóstico: no hay arreglos en esta rama.

> Notas en progreso — se completan a medida que avanza la investigación.

## Bug 2 — el domingo (hipótesis inicial, a confirmar en Chrome)

`SemanaReal` (Inicio.jsx:197) pinta `semanaDe()` (lib/week.ts:48): lunes a
domingo de la semana de HOY (`lunesDe`, week.ts:40). Hoy martes 29 → la tira es
lun 28 … dom 4-oct. El domingo 27 no está en la tira, y la columna "Dom" que sí
está es el domingo 4 (futuro) → `disabled={d.esFuturo}` (Inicio.jsx:220).
No hay otro camino a `marcar-dia`: los heatmaps de Progreso y Racha son `div`
sin onClick.

## Bug 1 — datos (inventario en curso)

- db.js, backup.js, persist.js, main.jsx, sw-notif.js: sin cambios entre #117 y #127.
- Diff #118–#127 en state.js/App.jsx/session.js/rutina-logic.js: nada que borre.
