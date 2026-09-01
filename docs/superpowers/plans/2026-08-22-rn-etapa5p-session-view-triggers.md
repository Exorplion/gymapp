# Etapa 5p — conectar los triggers reales de `session-view` (diferidos desde Etapa 4a/2c) + cierre de `Library.js`

Sub-etapa de Etapa 5 ("sheets restantes"). Continúa sobre Etapa 5o
(cerrada — commit `fd6094a`). Con `SessionView` ya portado y revisado
(Etapa 5m), esta etapa conecta los 3 lugares que quedaron con
comportamiento sustituto documentado por no existir el sheet todavía.

## Alcance y rulings

**Cierre de nota, sin código: `Library.js` NO necesita reconciliación.**
Se leyó `native/src/screens/Library.js` (237 líneas) — es un port
completo y deliberado de `web/src/components/sheets/Library.jsx` (111
líneas) + `sheetLibSave(name)`, decidido como PANTALLA propia en vez de
sheet modal desde Etapa 3 (antes de que el sistema de sheets existiera),
con su propia arquitectura de dos modos (`list`/`save`) documentada in
extenso en su comentario de cabecera, incluyendo el fix de navegación de
la revisión final de Etapa 3 (commit `a102939`). No hay nada pendiente
de "portar" — es la resolución final, no un placeholder. Se cierra esta
nota en el plan sin tocar el archivo.

**`SessionCard.js` (Etapa 4a) — se conecta al sheet real.** Hoy sólo
navega a Hoy si la sesión es "de hoy" (única acción con sentido cuando
no existía sheet), documentado explícitamente como sustituto temporal
("sheet de detalle: Etapa 5"). Con `SessionView` ya portado y revisado
(Etapa 5m), se cambia `onPress` para llamar
`openSheet('session-view', {id: sess.id})` para CUALQUIER sesión
(no sólo la de hoy) — igual que el original web, que no distingue.

**`Inicio.js` (Etapa 2c) — se conecta al sheet real.** El CTA de "sesión
ya completada hoy" (`hecha`) hoy navega a Hoy con un comentario
explícito "Sin sheet 'session-view' todavía (Etapa 5)". Se cambia a
`openSheet('session-view', {id: hecha.id})`, igual que
`web/src/components/screens/Inicio.jsx:57`.

**`Hoy.js`'s `WeekHistory` (Etapa 2b) — se agrega el trigger que nunca
existió.** Las filas de sesiones de la semana son actualmente `View`
inertes (ni siquiera tenían un comentario de diferimiento — simplemente
no se portó la interacción). Se convierten en `Pressable` llamando
`openSheet('session-view', {id: s.id})`, igual que
`web/src/components/screens/Hoy.jsx:335`.

Ruling: **NO se toca `SessionComplete.jsx`** (la pantalla de fin de
sesión con `justFinished:true`) — no está portada todavía, es una
pantalla completa, no un simple trigger; queda fuera de alcance de esta
etapa de "conectar triggers", es una etapa propia futura.

Ruling: **NO se agrega un ícono de ajustes/Header esta etapa** — a
diferencia de los 3 triggers de `session-view` (mecánicos: cambiar una
navegación por un `openSheet`), decidir DÓNDE vive un botón de ajustes
en la UI de RN es una decisión de diseño nueva (no hay `Header.jsx`
portado, ni un lugar obvio ya usado en otra pantalla) que merece su
propia etapa con su propia consideración de UX, no un efecto colateral
de esta etapa mecánica. `Settings.js` (Etapa 5o) queda registrado y
listo, sin trigger, documentado como tal desde su propio cierre.

Ruling: **`SessionCard.js` puede simplificar su lógica de `esHoy`/
navegación** una vez que TODA sesión abre el sheet — la distinción
"hoy vs. no-hoy" que forzaba navegar a la pestaña Hoy para la sesión de
hoy deja de ser necesaria (el sheet muestra el detalle sin importar la
fecha). Documentar el cambio como una simplificación posible en el
reporte, pero decidir si conviene MANTENER la navegación a Hoy además
de abrir el sheet para el caso "sesión de hoy" (podría ser valioso
seguir ofreciendo ambas: ver detalle Y poder ir a la pestaña activa) —
no asumir, leer el comportamiento del original web para esa distinción
específica antes de decidir (el original web SIEMPRE abre el sheet,
nunca navega — portar ese comportamiento exacto, sin agregar la
navegación extra que era sólo un sustituto).

Ruling: todas las dependencias ya existen — `openSheet` (`state.js`),
`session-view` ya registrado en `SHEET_REGISTRY` (Etapa 5m). Cero
dependencias nuevas.

Ruling: jest se mantiene igual — esta etapa no toca `lib/`.

## Task única

**Files:**
- Modify: `native/src/screens/SessionCard.js` (siempre abre el sheet,
  quitar la lógica `esHoy`/navegación si el original web no la tiene)
- Modify: `native/src/screens/Inicio.js` (CTA de `hecha` abre el sheet
  en vez de navegar)
- Modify: `native/src/screens/Hoy.js` (`WeekHistory` — filas tappables)

- [x] **Step 1**: Leer `web/src/components/SessionCard.jsx`,
  `web/src/components/screens/Inicio.jsx` línea ~57, y
  `web/src/components/screens/Hoy.jsx` línea ~335 — confirmar que los
  3 SIEMPRE llaman `openSheet('session-view', {id})` sin ninguna
  distinción especial por fecha.

- [x] **Step 2**: Actualizar `SessionCard.js` — `onPress` llama
  `openSheet('session-view', {id: sess.id})` siempre. Decidir (ver
  ruling) si la navegación a Hoy para la sesión de hoy se mantiene
  ADEMÁS o se retira — documentar la decisión con su razón.

- [x] **Step 3**: Actualizar `Inicio.js` — el CTA de `hecha` llama
  `openSheet('session-view', {id: hecha.id})` en vez de navegar,
  actualizando el comentario que documentaba el diferimiento.

- [x] **Step 4**: Actualizar `Hoy.js`'s `WeekHistory` — cada fila pasa
  de `View` a `Pressable` con `onPress={() =>
  openSheet('session-view', {id: s.id})}`.

- [x] **Step 5: Verificar**

Run: `cd native && npx jest` → 339/339, sin cambios.
Run: `cd native && npx expo-doctor` → 21/21.
Run: `cd native && npx expo export --platform android` → compila sin
error.

- [x] **Step 6: Commit**

```bash
cd native && git add src/screens/SessionCard.js src/screens/Inicio.js src/screens/Hoy.js && git commit -m "feat(rn): conectar triggers reales de session-view (SessionCard, Inicio, WeekHistory)"
```

---

## Revisión final de la etapa

- [x] `cd native && npx jest` — sin cambios respecto a Etapa 5o (339).
- [x] `cd native && npx expo-doctor` — sin errores.
- [x] Bundler de Metro compila sin error.
- [x] `web/` sin ningún archivo modificado.
- [x] Confirmar que los 3 triggers pasan el `id` correcto de la sesión
  (no un índice, no `sess` completo).
- [x] Confirmar que ninguno de los 3 cambios rompe la navegación
  existente que SÍ debía mantenerse (si la ruling de Step 2 decidió
  mantener alguna).

### Resultado de la revisión final (opus, commit fd6094a..00a7211)

CLEAN — Approved en el primer pase. Se confirmó leyendo el original web
que `SessionCard.jsx` NUNCA navega — siempre abre el sheet sin importar
la fecha — así que la lógica `esHoy`/navegación de la versión RN se
retiró por completo (no se mantuvo), tal como pedía la ruling. El
cleanup no planeado en `History.js` (retirar el wrapper
`navWithClose`) resultó ser una limpieza de código que YA estaba muerto
desde antes de esta etapa: `SheetHost.js` nunca pasa `navigation` como
prop a ningún sheet, así que ese wrapper envolvía un no-op — confirmado
leyendo el mecanismo de montaje de sheets. También se confirmó que abrir
`session-view` desde dentro del sheet `History` es seguro: `openSheet`
reemplaza el slot en vez de anularlo primero, así que el sheet cambia de
contenido sin parpadeo de cierre/apertura. jest 339/339, expo-doctor
21/21, bundler limpio. Dos notas menores no bloqueantes registradas para
el futuro: un comentario en `Nutricion.js` cita una referencia ahora
desactualizada a `SessionCard.js`, y `Hoy.js` muestra `s.date` crudo en
vez de `fmtDFull(s.date)` (defecto preexistente de Etapa 2b, fuera de
alcance de esta etapa).
