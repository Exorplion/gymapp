# Debug 2026-09-29: "volví a perder mis datos" y "no me deja registrar un domingo"

Rama `debug/datos-y-domingo` (sobre `origin/main` = 3bb25d9, #127). Es sólo
diagnóstico, sin arreglos. Lo único de código es un test que falla a propósito
(`web/src/lib/__tests__/debug-domingo.test.js`).

Reproducción: build de producción (`npx vite build` + `npx vite preview --port
4187 --strictPort`) en Chrome (MCP chrome-devtools), contexto aislado propio,
390×844 mobile. Hoy es martes 2026-09-29.

**Dato de Enzo que reencuadra el bug 1:** no perdió todo. Le faltan sólo las
sesiones del **domingo 27 y del lunes 28**, y tampoco puede anotarlas después.
Un desalojo del navegador borra el origen entero, así que una pérdida parcial
de días concretos no puede venir de ahí.

---

## Bug 2: no deja registrar el domingo (ni, en la práctica, los pesos)

### Causa raíz (confianza ALTA, reproducido)

El registro retroactivo tiene **una sola entrada**: la tira de la semana en
Inicio (`SemanaReal`, `web/src/components/screens/Inicio.jsx:197`). La tira
pinta `semanaDe()` (`web/src/lib/week.ts:48`), que es **de lunes a domingo de la
semana de HOY** (`lunesDe`, `week.ts:40`).

- El martes 29 la tira va del **lun 28 al dom 4-oct**. El domingo 27 pertenece a
  la semana anterior y **no aparece**.
- La columna "DOM" que Enzo ve y toca es el **domingo 4 de octubre** (futuro):
  `disabled={d.esFuturo}` (`Inicio.jsx:217`) y el `onClick` la ignora
  (`Inicio.jsx:225`). Tocarla no hace nada.
- **Un lunes la tira no ofrece ningún día pasado**: `diasSinRegistro('2026-09-28')`
  devuelve `[]`. El lunes es justo el día en que más falta hace anotar el fin de semana.
- No hay otro camino a la hoja `marcar-dia`: los heatmaps de Progreso
  (`Progreso.jsx:217`) y de Racha (`StreakDetail.jsx:34`) son `div` sin
  `onClick`, y el historial no tiene un "agregar sesión".

Observado en Chrome (snapshot a11y del build de `main`):
```
button "Lun 28: sin registrar, tocá para anotar qué entrenaste"
button "Mar 29: …"
button "Mié 30: todavía no llegó" disabled
…
button "Dom 4: todavía no llegó" disabled
```

### El lunes 28 SÍ se puede anotar, pero sin pesos (confianza ALTA, reproducido)

En `main`, tocar "Lun 28" abre la hoja y elegir un turno guarda la sesión
(toast "Anotado: Posterior A el 28 sep"; en Progreso figura "Lun Posterior A · 28
sep · Anotada a mano · sin series registradas"). Lo que **no** se puede es
cargar los pesos, y eso es **a propósito**: `MarcarDia.jsx:67` dice "Se anota el
turno, no las series". Fue una decisión del 2026-09-10 (HANDOFF, "registro
retroactivo"). Como Enzo dice "cuando quiero registrar mis pesos", para él el
lunes también está "bloqueado".

Existe un camino escondido para agregar series a una sesión anotada a mano:
Progreso → la sesión → "✎ Corregir lo que anoté" → chips "＋ ejercicio" → editar
peso y reps. Funciona (verificado: pasó a "1 serie · 180 kg"), pero:
- nadie lo descubre desde la tira de Inicio;
- cada ejercicio arranca con un valor por defecto (20 kg, o el de la última
  serie) que hay que corregir a mano;
- la cabecera muestra "Lun 28 sep · min" y "MIN" vacío porque `duration: null`
  (`SessionView.jsx:96`), un defecto menor de presentación.

**El peso corporal no tiene registro retroactivo**: `BodyForm.jsx:39` guarda
siempre `date: dstr()` (hoy).

### Test que falla

`web/src/lib/__tests__/debug-domingo.test.js`, 3/3 en rojo:
- martes 29: el domingo 27 no es alcanzable (`expected ['2026-09-28'] to include '2026-09-27'`);
- lunes 28: `diasSinRegistro` no incluye el domingo 27 (`expected [] …`);
- martes 29: el "Dom" de la tira es futuro (`expected true to be false`).

### Opciones de arreglo

| Opción | Pros | Contras |
|---|---|---|
| A. La tira pasa a ser **los últimos 7 días que terminan hoy** (ventana móvil) en vez de lun–dom | El domingo y el lunes siempre están. Cambio chico en `semanaDe`/`SemanaReal`. Nunca muestra días futuros deshabilitados. | Deja de ser "la semana". La decisión del 09-10 era mostrar la semana real lun–dom y hay que revisarla con Enzo. Hay que actualizar week.test.js. |
| B. Mantener lun–dom y **navegar semanas** (‹ semana anterior) | Conserva la semana calendario. Sirve para cualquier día. | Más UI y otro gesto en Inicio, que es "sin scroll". |
| C. Lun–dom + **el aviso "¿Entrenaste el …?" mira hacia atrás más allá del lunes** (p. ej. los últimos 3 días) | Arregla justo el caso lunes/martes con muy poco cambio. | El domingo sigue sin verse en la tira: el "Dom" visible seguiría siendo el futuro y confundiendo. |
| D. **Pesos retroactivos**: desde `MarcarDia`, después de elegir el turno, ofrecer "cargar las series" (reusar la edición de `SessionView`, precargada con los ejercicios del turno) | Responde a "registrar mis pesos". Reusa código que ya funciona. | Contradice la decisión del 09-10 (pesos de memoria contra récords medidos). Hay que decidir con Enzo si esas series cuentan para PRs/progresión o se marcan `retro`. |
| E. Peso corporal con fecha elegible en `BodyForm` | Simple. | Otra decisión de producto: hoy el promedio usa la fecha de registro. |

Recomendación: **A + D**. A cierra el "no me deja tocar el domingo". D cierra
"no me deja cargar los pesos", pero necesita que Enzo confirme que quiere
anotar pesos de memoria.

---

## Bug 1: faltan las sesiones del domingo 27 y del lunes 28

### Lo que se descartó, con evidencia

**No es una regresión de #118–#127 al cargar o actualizar.**
- `db.js` (DB `fierro`, `ver: 3`), `backup.js`, `persist.js`, `main.jsx` y
  `sw-notif.js` no cambian entre #117 y #127 (`git log` de esos archivos; el
  último toque es 55221b0 del 09-24 y no es de persistencia). No hubo
  `onupgradeneeded`.
- `git diff 85df81b 3bb25d9` de `state.js`, `App.jsx`, `session.js`,
  `rutina-logic.js`, `gyms.js` y `vite.config.js` no tiene ningún `clear`,
  `del` ni `deleteDatabase` nuevo, ni cambios en `loadAll()`. `porBloques()`
  (usado por `moveEx`/`saveExercise` en #124/#127) conserva todos los
  ejercicios (`muscle.ts:272-288`).
- **Reproducción de actualización (a, b, d):** build de #122 (3bd92fa, anterior a
  #124) en :4187 → "Cargar mi registro" (15 sesiones, 154 comidas, 29 cuerpo) →
  color `#e0457b` guardado como `themeColor` → sesión abierta con 2 series
  (`draft`). Después se cambió el servidor por el build de `main` en el mismo
  puerto, con la pestaña abierta, y se forzó `registration.update()`:
  - el SW nuevo se instala y precachea `index-DcFptb6J.js`, pero **la pestaña
    no se recarga sola** (`registerSW.js` sin workbox-window) y sigue con el JS
    viejo hasta la próxima carga;
  - al recargar: **mismos conteos en todos los stores** (body 29, meals 154,
    routine 7, sessions 15, settings 3), `draft` intacto con 2 series,
    `themeColor` migrado a `acento {id:'propio', h:1}` y borrado. "SESIÓN EN
    CURSO · 1 de 10";
  - **completar esa sesión en `main`** (Terminar → Completar y guardar) la guarda
    (sessions 16, `date 2026-09-29`, 1 ejercicio, 2 series) y borra el `draft`.
- **H2 (actualizar a mitad de sesión) queda descartada:** el borrador vive en
  IndexedDB (`saveDraft` en cada serie), no hay descarte de "borradores viejos"
  al arrancar (grep sin resultados) y la forma nueva del draft (`rampa`,
  `extras[].cat`) sólo agrega claves opcionales.
- **H3 (completeSession falla en silencio) queda descartada:** el
  `idb.put('sessions', sess)` (`session.js:877`) es lo primero que escribe y no
  está dentro de ningún try/catch. El único try/catch (`session.js:928-941`)
  envuelve el respaldo automático, después de guardar.
- **Desalojo del navegador:** borra el origen entero. No encaja con perder dos
  días sueltos.

### Causa más probable: MODO PRUEBA (H1), confianza MEDIA-ALTA

El mecanismo está confirmado en Chrome. Falta confirmar con Enzo que fue lo que
le pasó.

1. Ajustes → "Entrar al modo prueba" copia la base `fierro` entera a
   `fierro-prueba` y deja la marca `fierro-modo-prueba=1` en localStorage
   (`modoPrueba.js:83-88`). Desde ahí **todo** se escribe en la copia: sesiones
   completas, sesiones anotadas a mano y la configuración (incluido el puntero
   `seqIndex`).
2. La marca **sobrevive a recargas y a actualizaciones del SW**. Verificado:
   después de recargar, `localStorage = {fierro-modo-prueba: "1"}`, las dos bases
   existen y la app sigue en prueba. Nada sale del modo prueba solo.
3. En prueba **no corre el respaldo automático** (`session.js:931`), así que
   esas sesiones no quedan en ningún JSON.
4. **Salir borra la copia entera** (`modoPrueba.js:91-96`, `deleteDatabase`).
   Verificado: una sesión anotada el lun 28 en prueba ("Posterior A (retro)",
   17 sesiones en la copia contra 16 en la real) **desaparece** al salir (queda
   sólo `fierro`, 16 sesiones, `localStorage` vacío).
5. Hay dos salidas y ninguna dice cuánto se pierde:
   - la pastilla "MODO PRUEBA" del header, con confirmación genérica ("Se borra
     la copia con todo lo que hiciste acá", `Header.jsx:17`);
   - **Ajustes → "Salir y descartar la copia", que borra SIN confirmación**
     (`Settings.jsx:71`). La justificación del comentario ("ninguno de los dos
     toca la base real") es cierta pero engañosa: lo que se tira puede ser
     entrenamiento real.
6. Entrar de nuevo **rehace la copia desde la real** (`borrarBase` en
   `modoPrueba.js:57`): lo de la prueba anterior se pisa.

Escenario que explica exactamente "faltan el 27 y el 28": Enzo entró al modo
prueba el 27 o antes (la función salió el 09-25, justo para simular), entrenó
**de verdad** el domingo y el lunes sin notar que seguía en prueba, y el 29
salió. Desde #120 el aviso es una pastilla ámbar arriba a la izquierda, que se
ve (captura en el scratchpad) pero es fácil de naturalizar. Al salir, la base
real vuelve tal como estaba antes de entrar.

**Señal fuerte para confirmarlo sin preguntar de memoria:** como la config
también vuelve atrás, el puntero `seqIndex` de la base real quedó donde estaba
antes del domingo. Si hoy Inicio le propone **el mismo turno que hizo el
domingo** (o sea, la secuencia "retrocedió dos turnos"), casi seguro fue esto.

### Hipótesis alternativa (confianza BAJA): una sola sesión abierta y descartada

Si el domingo abrió una sesión y no la completó, el lunes Inicio sigue mostrando
"SESIÓN EN CURSO" y las series del lunes caen **en el mismo borrador**. Un
"Terminar → Descartar → Descartar" (dos confirmaciones, `Hoy.jsx:246` y `:284`)
se lleva los dos días juntos. Tiene poca probabilidad por la doble
confirmación, pero da la misma huella que modo prueba.

### Otras formas de perder datos (inventario completo de escrituras destructivas)

| Camino | Dónde | Protección |
|---|---|---|
| Borrar todos los datos | `backup.js:149` (`wipeAll`, `clear` de los 7 stores) | confirmación |
| Importar JSON | `backup.js:98`: `clear` + `put` de cada store que trae el archivo, y `settings` clave por clave | valida el formato antes; **si se importa estando en modo prueba, restaura en la copia y se pierde al salir** |
| Vaciar split / aplicar plantilla / cargar mi registro | `rutina-logic.js:322, 428, 817` (`clear('routine')`) | confirmación; no toca sesiones |
| Borrar datos de prueba | `seed.js:208` (sólo filas `seed:true`) | confirmación |
| Eliminar sesión | `session.js:1159` | confirmación en SessionView |
| Descartar sesión en curso | `session.js:1068` | dos confirmaciones |
| Modo prueba salir / entrar | `modoPrueba.js:91` / `:57` (`deleteDatabase('fierro-prueba')`) | Header: una confirmación genérica · **Ajustes: ninguna** |
| "Buscar actualización" | `Settings.jsx:188` | borra **sólo Cache Storage**, no IndexedDB |
| main.jsx | `caches.delete` de `fierro-vNN` | sólo cachés legacy |
| Service worker (workbox) | `cleanupOutdatedCaches`, `skipWaiting`, `clientsClaim` | no toca IndexedDB ni localStorage |
| Upgrade de IndexedDB | `db.js` `onupgradeneeded` | `ver` sigue en 3 desde agosto: no corre |

Fuera de la app: desalojo del navegador (borra todo), "Borrar datos del sitio"
a mano, desinstalar la PWA en algunos Android (puede borrar los datos del
origen), cambiar de navegador o de perfil, o abrir otra URL (otro origen, otra
base).

### `persist()` y respaldo automático en `main`

- `ensurePersisted()` se sigue llamando en el arranque (`App.jsx:393`), fuera
  de la cadena de carga. No cambió desde 000356b.
- En el Chrome de prueba (contexto aislado, sin instalar) `persisted() = false`.
  Es lo esperable: Chrome sólo lo concede con la PWA instalada o con engagement.
  `estimate()`: ~1.9 MB usados (IndexedDB 128 KB).
- El respaldo automático **funciona en `main`**: al completar la sesión de la
  prueba se escribió `cfg.lastBackupAt = 2026-09-29T13:53:48Z` (no había copia
  anterior). En modo prueba no corre, a propósito (`session.js:931`).

### Qué pedirle a Enzo

1. ¿Entró al **modo prueba** en algún momento desde el 25? ¿Vio la pastilla
   ámbar "MODO PRUEBA" arriba a la izquierda el domingo o el lunes? ¿Tocó
   "Salir" (pastilla) o "Salir y descartar la copia" (Ajustes) el lunes o hoy?
2. ¿Qué turno le propone hoy Inicio? ¿Es el mismo que hizo el domingo?
3. ¿El domingo y el lunes **completó** la sesión (vio la pantalla de racha y
   resumen) o la dejó abierta? ¿Descartó alguna?
4. ¿Tiene en Descargas algún `fierro-backup-2026-09-27.json` o
   `…-28.json`? Si no existe y le tocaba el respaldo semanal, es otra señal de
   que estaba en modo prueba.
5. ¿Entrenó desde la PWA instalada o desde una pestaña de Chrome, y en la
   dirección de siempre (`exorplion.github.io/gymapp`)?

### Opciones de arreglo (bug 1)

| Opción | Pros | Contras |
|---|---|---|
| a. **Salir del modo prueba dice qué se pierde** ("Registraste 2 sesiones en la copia: dom 27 y lun 28") y ofrece **pasarlas a tu app real** antes de borrar | Recupera exactamente este caso, que es el daño real. | Hay que definir cómo se fusiona (sesiones sí; ¿config? ¿rutina?). |
| b. Confirmación también en Ajustes → "Salir y descartar la copia" | Trivial. | Sólo agrega un paso: no evita el error si la persona cree que la prueba era "de mentira". |
| c. Aviso más fuerte cuando en prueba se **completa** una sesión o se anota un día ("Esto queda en la copia de prueba") | Ataca el momento del error. | Un aviso más en una app que intenta tener pocos. |
| d. El modo prueba **vence solo** (p. ej. al cambiar el día, pregunta "¿seguís probando?") | Evita quedarse días en prueba sin darse cuenta. | Puede interrumpir una prueba legítima. |
| e. Respaldo automático también en prueba, con otro nombre (`fierro-PRUEBA-…json`) | Deja rastro recuperable. | Llena Descargas y confunde, que es lo que el código evitó a propósito. |

Recomendación: **a + b + d**. Para lo ya perdido: si Enzo todavía está en modo
prueba, **no debe salir** hasta que se implemente (a) o exporte la copia a mano
(Ajustes → Exportar todo a JSON, que en prueba exporta la copia). Si ya salió,
la base `fierro-prueba` fue borrada con `deleteDatabase` y **no se puede
recuperar**: lo único que queda es anotar los dos días a mano cuando el bug 2
esté resuelto.
