# Sensación premium: movimiento y feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las cuatro transiciones/momentos que hoy se sienten abruptos en FIERRO (cambio de pestaña, cierre de sheets, reposicionamiento del carrusel de Hoy) y sumar un momento nuevo (pantalla de fin de sesión con racha, resumen y cuerpo animado), según el spec aprobado.

**Architecture:** Cuatro piezas independientes sobre la base React existente (estado externo `S` + `bump()`, CSS puro para animaciones, sin librerías nuevas). Ninguna toca el estilo/color de la app (ya confirmado tal cual está) ni cambia el gesto de swipe (sigue decidiéndose recién al soltar, sin seguir el dedo en vivo).

**Tech Stack:** React 19, CSS puro (`styles.css`, sin CSS-in-JS), vitest 4 (`web/src/lib/__tests__`, sin jsdom — sólo funciones puras de `lib/`), oxlint, verificación real en navegador vía CDP (Chrome DevTools Protocol) como se viene haciendo en toda la sesión.

## Global Constraints

- No tocar color/tema: el estilo oscuro + degradado actual queda tal cual (confirmado por Enzo contra mockups de referencia).
- El swipe entre pestañas NO sigue el dedo en vivo — eso no cambia, sólo la animación de la transición ya decidida.
- La pantalla de fin de sesión es corta (~3.5-4s), automática, y se puede tocar en cualquier momento para saltarla — no puede ser un flujo que haya que "pasar" tocando cada paso.
- Después de cada tarea: `npx vitest run` (282+ tests, ninguno debe romperse) y `npm run lint` (línea base: 10 warnings — no debe subir) antes de commitear. Esto corre desde `web/`.
- Cada commit sigue el estilo ya usado en el repo (mensaje explicando el POR QUÉ, no sólo el qué — ver `git log` para el tono).
- Verificación real en navegador (no sólo "compila"): igual que el resto de la sesión, con Chrome headless vía CDP, capturando screenshots donde aplique. Esta app no tiene jsdom configurado — los componentes (JSX/CSS) se verifican en navegador real, no con vitest; sólo la lógica pura de `lib/` tiene tests unitarios.

---

## Task 1: Transición entre pestañas — las dos pantallas se deslizan juntas

**Files:**
- Modify: `web/src/App.jsx` (imports, estado del componente, JSX del `<main>`)
- Modify: `web/src/styles.css` (nuevas animaciones de salida, `position:relative` en `main`)

**Interfaces:**
- Consumes: `ORDEN` (array ya existente en `App.jsx`), `store.tab` (vía `useStore()`), componentes de pantalla ya importados (`Inicio`, `Hoy`, `Rutina`, `Nutricion`, `Progreso`).
- Produces: nada que otra tarea consuma — es autocontenida.

**Contexto exacto (por qué se ve como parpadeo hoy):** `App.jsx` sólo monta la pantalla activa, con `key={store.tab}`. Al cambiar de pestaña React desmonta la vieja de golpe y sólo la nueva entra animada (`slideR`/`slideL` en `styles.css:144-147`). No hay animación de salida — es un corte instantáneo, no un deslizamiento continuo.

- [ ] **Paso 1: Agregar `useState` al import de React en `App.jsx`**

Buscar la línea 1 de `web/src/App.jsx`:
```js
import { useEffect, useMemo, useRef } from 'react';
```
Reemplazar por:
```js
import { useEffect, useMemo, useRef, useState } from 'react';
```

- [ ] **Paso 2: Agregar la función `pantallaDe(tab)` a nivel de módulo**

En `web/src/App.jsx`, justo debajo de la constante `SWIPE_ORDEN` (después de su comentario, antes de `export default function App()`), agregar:

```js
/* Qué componente va para cada pestaña — la usan tanto la pantalla activa
   como la saliente (Task de transición), así que vive aparte del JSX del
   render para no duplicar el bloque de cinco casos. */
function pantallaDe(tab) {
  switch (tab) {
    case 'inicio': return <Inicio />;
    case 'hoy': return <Hoy />;
    case 'rutina': return <Rutina />;
    case 'nutri': return <Nutricion />;
    case 'prog': return <Progreso />;
    default: return null;
  }
}
```

- [ ] **Paso 3: Reemplazar el cálculo de `dir` y sumar el seguimiento de la pantalla saliente**

Buscar en `web/src/App.jsx` (dentro de `export default function App()`):
```js
  const tabPrevio = useRef(store.tab);
  const dir = useMemo(() => {
    const antes = ORDEN.indexOf(tabPrevio.current);
    const ahora = ORDEN.indexOf(store.tab);
    tabPrevio.current = store.tab;
    return ahora < antes ? 'l' : 'r';
  }, [store.tab]);
```

Reemplazar por:
```js
  const tabPrevio = useRef(store.tab);
  const dir = useMemo(() => {
    const antes = ORDEN.indexOf(tabPrevio.current);
    const ahora = ORDEN.indexOf(store.tab);
    return ahora < antes ? 'l' : 'r';
  }, [store.tab]);

  /* Antes sólo existía la pantalla activa: al cambiar de pestaña, la vieja
     desaparecía de golpe y sólo la nueva entraba animada — un corte, no un
     deslizamiento. Acá, mientras dura la transición (380ms, mismo tiempo que
     ya usa .view.enter), se guarda cuál era la pantalla anterior para
     poder pintarla también: sale deslizando hacia el lado opuesto de por
     donde entra la nueva, las dos a la vez. La mutación de tabPrevio.current
     se hace ACÁ (no en el useMemo de arriba) para que dir se calcule contra
     el valor viejo antes de perderlo. */
  const [saliente, setSaliente] = useState(null); // {tab, dir} | null
  const salienteTimer = useRef(null);
  useEffect(() => {
    if (store.tab === tabPrevio.current) return;
    setSaliente({ tab: tabPrevio.current, dir });
    tabPrevio.current = store.tab;
    clearTimeout(salienteTimer.current);
    salienteTimer.current = setTimeout(() => setSaliente(null), 380);
    return () => clearTimeout(salienteTimer.current);
  }, [store.tab, dir]);
```

- [ ] **Paso 4: Pintar la pantalla saliente en el JSX**

Buscar en `web/src/App.jsx`:
```jsx
      <main className={store.tab === 'inicio' ? 'full' : ''} ref={mainRef}>
        {/* El `key` es lo que hace que la animación se repita: sin él React
            reusa el mismo div y el navegador no vuelve a correr el keyframe. */}
        <div className={`view enter dir-${dir}`} key={store.tab}>
          {store.tab === 'inicio' && <Inicio />}
          {store.tab === 'hoy' && <Hoy />}
          {store.tab === 'rutina' && <Rutina />}
          {store.tab === 'nutri' && <Nutricion />}
          {store.tab === 'prog' && <Progreso />}
        </div>
      </main>
```

Reemplazar por:
```jsx
      <main className={store.tab === 'inicio' ? 'full' : ''} ref={mainRef}>
        {/* La saliente va PRIMERO en el DOM (así la entrante, montada después,
            queda arriba en el stacking normal) y con pointer-events:none —
            es puramente decorativa mientras se termina de ir. */}
        {saliente && (
          <div className={`view leave dir-${saliente.dir}`}>
            {pantallaDe(saliente.tab)}
          </div>
        )}
        {/* El `key` es lo que hace que la animación se repita: sin él React
            reusa el mismo div y el navegador no vuelve a correr el keyframe. */}
        <div className={`view enter dir-${dir}`} key={store.tab}>
          {pantallaDe(store.tab)}
        </div>
      </main>
```

- [ ] **Paso 5: Sumar las animaciones de salida en `styles.css`**

Buscar en `web/src/styles.css`:
```css
main{
  max-width:520px;margin:0 auto;
  padding:16px 18px calc(var(--tabs-h) + env(safe-area-inset-bottom) + 110px);
}
```
Reemplazar por (agrega `position:relative`, necesario para que `.view.leave` se ancle a `main` y no al body):
```css
main{
  position:relative;
  max-width:520px;margin:0 auto;
  padding:16px 18px calc(var(--tabs-h) + env(safe-area-inset-bottom) + 110px);
}
```

Buscar:
```css
.view.enter.dir-r{animation:slideR .38s var(--ease)}
.view.enter.dir-l{animation:slideL .38s var(--ease)}
.view.enter>*{animation:vin .38s var(--ease) backwards}
@media (prefers-reduced-motion:reduce){
  .view.enter.dir-r,.view.enter.dir-l,.view.enter>*{animation:none}
}
```
Reemplazar por:
```css
.view.enter.dir-r{animation:slideR .38s var(--ease)}
.view.enter.dir-l{animation:slideL .38s var(--ease)}
.view.enter>*{animation:vin .38s var(--ease) backwards}
/* La saliente ocupa el mismo lugar que la entrante (absolute, ancla a
   main gracias al position:relative de arriba) para que las dos se vean
   deslizando juntas y no una debajo de la otra. No participa del alto de
   main: si sumara su propio alto al de la entrante, la página saltaría de
   scroll por 380ms cada vez que cambiás de pestaña. */
.view.leave{position:absolute;top:0;left:0;right:0;pointer-events:none}
@keyframes slideOutL{to{opacity:0;transform:translate3d(-56px,0,0)}}
@keyframes slideOutR{to{opacity:0;transform:translate3d(56px,0,0)}}
.view.leave.dir-r{animation:slideOutL .38s var(--ease) forwards}
.view.leave.dir-l{animation:slideOutR .38s var(--ease) forwards}
@media (prefers-reduced-motion:reduce){
  .view.enter.dir-r,.view.enter.dir-l,.view.enter>*,
  .view.leave.dir-r,.view.leave.dir-l{animation:none}
}
```

- [ ] **Paso 6: Correr la suite completa y lint**

Run: `cd web && npx vitest run`
Expected: todos los tests pasan (282 o más), ninguno roto por este cambio (es JSX/CSS, no toca `lib/`).

Run: `cd web && npm run lint`
Expected: mismos 10 warnings de siempre, ninguno nuevo.

- [ ] **Paso 7: Verificar en navegador real (CDP)**

Con el dev server corriendo (`npm run dev` desde `web/`) y Chrome headless con el puerto de depuración abierto (mismo patrón usado en toda la sesión — CDP vía WebSocket), navegar a la app y:
1. Tocar dos pestañas distintas de la tab bar (por ejemplo Inicio → Rutina) y capturar una screenshot ~150ms después de tocar (a mitad de los 380ms de animación).
2. Confirmar visualmente que HAY DOS pantallas visibles a la vez en ese frame intermedio (la de Inicio saliendo hacia la izquierda, la de Rutina entrando desde la derecha), no una pantalla en blanco ni un salto directo.
3. Esperar 400ms más y confirmar que sólo queda la pantalla nueva, sin rastro de la vieja, y que el scroll/alto de la página es el correcto (no quedó "hueco" del cálculo de alto).
4. Repetir en la dirección opuesta (Rutina → Inicio) para confirmar que la pantalla saliente esta vez sale hacia la derecha (no siempre para el mismo lado).

- [ ] **Paso 8: Commit**

```bash
git add web/src/App.jsx web/src/styles.css
git commit -m "$(cat <<'EOF'
feat(nav): las pantallas se deslizan juntas al cambiar de pestaña

Antes sólo se montaba la pantalla activa: al cambiar de pestaña React
desmontaba la vieja de golpe y sólo la nueva entraba animada — un corte
instantáneo que se sentía como parpadeo, no como un deslizamiento.

Ahora, mientras dura la transición (380ms), se mantienen montadas las dos
pantallas: la saliente sale hacia el lado opuesto de por donde entra la
nueva, juntas. La saliente es absolute (no suma su alto al de main) y
pointer-events:none (puramente decorativa).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Cierre animado de los sheets

**Files:**
- Modify: `web/src/components/Sheet.jsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: nada de otras tareas de este plan.
- Produces: nada que otra tarea consuma — `Sheet.jsx` sigue recibiendo `{open, onClose, children}` exactamente igual que hoy, ningún consumidor de `<Sheet/>` (sólo `App.jsx`) necesita cambiar.

**Contexto exacto (por qué se corta de golpe hoy):** `web/src/components/Sheet.jsx` renderiza `<div id="sheet" className={open ? 'open' : ''}>`. En `styles.css`, `#sheet{display:none}` / `#sheet.open{display:block}` — apenas `open` pasa a `false`, `display:none` corta todo, sin animación. La apertura sí anima (`.panel{animation:shup .3s...}`, `.bk{animation:fdin .2s}`), pero no hay ninguna animación espejada de cierre.

Hay una segunda trampa, más sutil: quien abre un sheet (`App.jsx`) le pasa como `children` el resultado de `<SheetContent sheet={store.sheet}/>`, y `closeSheet()` (en `state.js`) pone `S.sheet = null` en el MISMO instante en que `open` pasa a `false`. Si `Sheet.jsx` sólo mantuviera la animación del `<div id="sheet">` pero siguiera pasando los `children` en vivo, el contenido de adentro (`SheetContent` con `sheet=null`) se pondría en blanco al instante — verías el panel deslizándose vacío, no el contenido real desapareciendo. Por eso hace falta CACHEAR el último `children` real mientras el sheet estaba abierto, y usar esa copia durante el cierre.

- [ ] **Paso 1: Reescribir `Sheet.jsx` con el estado de cierre**

Reemplazar el contenido completo de `web/src/components/Sheet.jsx`:

```jsx
// Puerto de <div id="sheet"> (index.html ~línea 710) + openSheet()/closeSheet()
// (~línea 2949). El original guarda un único string de HTML en #sheet-c;
// acá el contenido son children de React (lo decide quien use <Sheet/>), y
// el estado "qué sheet está abierto" vive en S.sheet — ver state.js: un solo
// campo `{type, props} | null` alcanza porque, igual que en el original, sólo
// hay un sheet abierto a la vez en toda la app.
//
// Es un modal de verdad para quien navega con teclado o lector de pantalla:
// Escape cierra, Tab no se escapa hacia la página de atrás (que además queda
// oculta con display:none — ver styles.css — así que "escaparse" la dejaría
// en un foco muerto, ni visible ni anunciado), y al cerrar el foco vuelve a
// lo que lo abrió en vez de perderse en <body>.
import { useEffect, useRef, useState } from 'react';

const FOCUSABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CIERRE_MS = 300; // mismo tiempo que .panel usa para abrir (shup .3s)

export default function Sheet({ open, onClose, children }) {
  const panelRef = useRef(null);
  const previoRef = useRef(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const abiertoAntes = useRef(open);

  /* Antes de cerrar de golpe, quien nos llama ya puso S.sheet=null — así
     que `children` en este mismo render ya es null (SheetContent con
     sheet=null devuelve null). Si mostráramos ESO durante el cierre, el
     panel se vería vacío deslizándose, no el contenido real desapareciendo.
     Por eso se guarda el último contenido real mientras open era true, y
     ESO es lo que se pinta durante la animación de cierre. */
  const childrenRef = useRef(children);
  if (open) childrenRef.current = children;

  /* mostrando = todavía hay algo que pintar (abierto de verdad, o cerrando
     con la animación en curso). closing sólo se prende en la transición
     true->false, nunca de entrada (si open ya arranca en false no hay nada
     que animar). */
  useEffect(() => {
    if (open) {
      clearTimeout(closeTimer.current);
      setClosing(false);
      abiertoAntes.current = true;
      return;
    }
    if (!abiertoAntes.current) return;
    abiertoAntes.current = false;
    setClosing(true);
    closeTimer.current = setTimeout(() => setClosing(false), CIERRE_MS);
    return () => clearTimeout(closeTimer.current);
  }, [open]);

  const mostrando = open || closing;

  useEffect(() => {
    if (!open) return;
    previoRef.current = document.activeElement;

    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      const focusables = panel ? [...panel.querySelectorAll(FOCUSABLES)] : [];
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      // Si el foco está fuera del panel (nunca debería, pero puede pasar si
      // algo lo movió a mano) lo trae adentro en vez de dejarlo perdido.
      if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Vuelve a quien lo abrió — un botón "⇄ Cambiar", el ícono de
      // Ajustes — si ese elemento sigue en la página. Sin esto el foco cae a
      // <body> y quien navega con teclado pierde el lugar por completo.
      if (previoRef.current && document.contains(previoRef.current)) previoRef.current.focus();
    };
  }, [open, onClose]);

  return (
    <div id="sheet" className={mostrando ? (closing ? 'open closing' : 'open') : ''}>
      <div className="bk" onClick={onClose}></div>
      <div className="panel" ref={panelRef} role="dialog" aria-modal={open || undefined}>
        <div className="handle"></div>
        <div id="sheet-c">{mostrando ? childrenRef.current : null}</div>
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Sumar la animación de cierre en `styles.css`**

Buscar:
```css
#sheet{position:fixed;inset:0;z-index:60;display:none}
#sheet.open{display:block}
#sheet .bk{position:absolute;inset:0;background:rgba(2,4,9,.7);backdrop-filter:blur(4px);animation:fdin .2s}
@keyframes fdin{from{opacity:0}}
#sheet .panel{
  position:absolute;left:0;right:0;bottom:0;max-width:520px;margin:0 auto;
  max-height:88dvh;overflow-y:auto;
  background:linear-gradient(180deg,rgba(14,22,38,.92),rgba(10,16,28,.92));
  backdrop-filter:blur(24px) saturate(1.5);-webkit-backdrop-filter:blur(24px) saturate(1.5);
  border:1px solid rgba(255,255,255,.14);border-bottom:none;
  border-radius:26px 26px 0 0;
  padding:10px 20px calc(24px + env(safe-area-inset-bottom));
  animation:shup .3s cubic-bezier(.2,.8,.3,1);
  box-shadow:var(--glass-hi),0 -20px 60px -20px rgba(0,0,0,.7);
}
@keyframes shup{from{transform:translateY(60%);opacity:.4}}
```
Reemplazar por:
```css
#sheet{position:fixed;inset:0;z-index:60;display:none}
#sheet.open{display:block}
#sheet .bk{position:absolute;inset:0;background:rgba(2,4,9,.7);backdrop-filter:blur(4px);animation:fdin .2s}
@keyframes fdin{from{opacity:0}}
#sheet .panel{
  position:absolute;left:0;right:0;bottom:0;max-width:520px;margin:0 auto;
  max-height:88dvh;overflow-y:auto;
  background:linear-gradient(180deg,rgba(14,22,38,.92),rgba(10,16,28,.92));
  backdrop-filter:blur(24px) saturate(1.5);-webkit-backdrop-filter:blur(24px) saturate(1.5);
  border:1px solid rgba(255,255,255,.14);border-bottom:none;
  border-radius:26px 26px 0 0;
  padding:10px 20px calc(24px + env(safe-area-inset-bottom));
  animation:shup .3s cubic-bezier(.2,.8,.3,1);
  box-shadow:var(--glass-hi),0 -20px 60px -20px rgba(0,0,0,.7);
}
@keyframes shup{from{transform:translateY(60%);opacity:.4}}
/* El cierre es el espejo exacto de shup/fdin, misma duración cada uno —
   antes no existía ninguno de los dos: #sheet pasaba a display:none en el
   instante en que open se ponía en false y todo desaparecía de golpe.
   #sheet.closing es más específico que #sheet .panel/.bk de arriba, así
   que gana en la cascada sin necesitar !important. */
@keyframes shdown{to{transform:translateY(60%);opacity:.4}}
@keyframes fdout{to{opacity:0}}
#sheet.closing .panel{animation:shdown .3s cubic-bezier(.2,.8,.3,1) forwards}
#sheet.closing .bk{animation:fdout .2s forwards}
```

- [ ] **Paso 3: Correr la suite completa y lint**

Run: `cd web && npx vitest run`
Expected: todos los tests pasan (`Sheet.jsx` no tiene tests unitarios propios — este proyecto no tiene jsdom configurado, sólo se prueban funciones puras de `lib/` — así que esto es una verificación de que el cambio no rompió ningún test EXISTENTE, no de que el sheet en sí funcione: eso es el paso 5).

Run: `cd web && npm run lint`
Expected: mismos 10 warnings de siempre.

- [ ] **Paso 4: Verificar en navegador real (CDP) — apertura sin cambios**

Abrir cualquier sheet (por ejemplo, Ajustes desde el ícono del header) y confirmar que la animación de apertura se ve exactamente igual que antes (sube deslizando, fondo se oscurece) — este paso no debería haber cambiado nada visible.

- [ ] **Paso 5: Verificar en navegador real (CDP) — cierre animado**

1. Abrir un sheet con contenido visible (por ejemplo Ajustes).
2. Cerrarlo (tocar el fondo, o Escape) y capturar una screenshot ~150ms después (a mitad de los 300ms de cierre).
3. Confirmar que en ese frame intermedio el panel SIGUE mostrando su contenido real (no está vacío) y está a mitad de camino deslizándose hacia abajo con el fondo aclarándose de vuelta — no un corte instantáneo a pantalla previa.
4. Esperar 350ms más y confirmar que el sheet desapareció del todo y el DOM no quedó con `#sheet` visible ni bloqueando clicks (probar tocar algo de la pantalla de atrás después de cerrado).
5. Repetir con un sheet largo con scroll (por ejemplo, Biblioteca de ejercicios) para confirmar que no hay ningún salto de layout raro.

- [ ] **Paso 6: Commit**

```bash
git add web/src/components/Sheet.jsx web/src/styles.css
git commit -m "$(cat <<'EOF'
feat(sheet): animación de cierre — antes cortaba de golpe

#sheet pasaba a display:none en el instante en que open se ponía en false:
la apertura sí animaba (shup/fdin) pero el cierre no tenía nada espejado,
todo desaparecía de un corte.

Sheet.jsx ahora atrasa el desmontaje con un estado "closing" que dispara la
animación inversa (shdown/fdout, misma duración que la apertura) antes de
dejar de renderizar. Importante: como quien llama ya puso S.sheet=null en
el mismo instante que open pasa a false, había que CACHEAR el último
children real (childrenRef) para que el panel muestre su contenido
deslizándose, no un panel vacío — sin eso se vería el hueco, no el cierre.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Reposicionamiento suave del carrusel de Hoy

**Files:**
- Modify: `web/src/components/ExerciseCarousel.jsx`

**Interfaces:**
- Consumes: `scrollToSlideEl` (ya existe en `web/src/lib/carousel.js`, firma `scrollToSlideEl(car, slide, behavior='smooth')`) — no se modifica `carousel.js`, sólo se usa una función que ya estaba exportada.
- Produces: nada que otra tarea consuma.

**Contexto exacto (por qué salta hoy):** en `ExerciseCarousel.jsx`, el `useLayoutEffect` que posiciona el carrusel (se dispara cuando cambia `focusKey`: día distinto, arranca la sesión, cambia el ejercicio en curso) llama a `jumpToSlide(car, idx)`, que hace `car.scrollLeft = ...` DIRECTO — instantáneo, sin transición. Cuando deslizás vos con el dedo es scroll nativo del navegador (fluido); el salto abrupto pasa sólo en los reposicionamientos que decide la propia app. La única excepción real es el PRIMER pintado (recién se abre Hoy): ahí SÍ tiene que ser instantáneo — animarlo desde `scrollLeft=0` se vería como el carrusel "viajando" apenas se pinta la pantalla.

- [ ] **Paso 1: Importar `scrollToSlideEl`**

Buscar en `web/src/components/ExerciseCarousel.jsx`:
```js
import { jumpToSlide, slideCenterDist } from '../lib/carousel.js';
```
Reemplazar por:
```js
import { jumpToSlide, scrollToSlideEl, slideCenterDist } from '../lib/carousel.js';
```

- [ ] **Paso 2: Sumar el ref de "ya hubo un primer salto" y cambiar la llamada**

Buscar (dentro de `export default function ExerciseCarousel(...)`, antes del `useLayoutEffect`):
```js
  const focusKey = `${wd}|${active}|${curId ?? ''}|${exs.map(e => e.id).join(',')}`;

  useLayoutEffect(() => {
    const car = carRef.current;
    if (!car) return;
    const idx = exs.length ? Math.max(0, openIdx) : 0;
    jumpToSlide(car, idx);
    const dotsWrap = dotsRef.current;
```
Reemplazar por:
```js
  const focusKey = `${wd}|${active}|${curId ?? ''}|${exs.map(e => e.id).join(',')}`;

  // El PRIMER posicionamiento de este montaje tiene que ser instantáneo
  // (jumpToSlide) — recién se abre Hoy, animar desde scrollLeft=0 se vería
  // como el carrusel "viajando" apenas se pinta la pantalla. Los
  // reposicionamientos SIGUIENTES (cambiaste de día, arrancó la sesión,
  // avanzó el ejercicio en curso) sí deslizan: antes saltaban de golpe, el
  // único movimiento suave era el que hacías vos con el dedo.
  const yaHuboSalto = useRef(false);

  useLayoutEffect(() => {
    const car = carRef.current;
    if (!car) return;
    const idx = exs.length ? Math.max(0, openIdx) : 0;
    if (!yaHuboSalto.current) {
      jumpToSlide(car, idx);
      yaHuboSalto.current = true;
    } else if (idx > 0) {
      // jumpToSlide ignora idx<=0 a propósito (no hace falta reposicionar
      // hacia el primer slide) — se preserva el mismo criterio acá.
      scrollToSlideEl(car, car.children[idx], 'smooth');
    }
    const dotsWrap = dotsRef.current;
```

- [ ] **Paso 3: Correr la suite completa y lint**

Run: `cd web && npx vitest run`
Expected: todos los tests pasan (no se tocó `lib/carousel.js`, así que sus tests si existen no se ven afectados; confirmar igual).

Run: `cd web && npm run lint`
Expected: mismos 10 warnings de siempre.

- [ ] **Paso 4: Verificar en navegador real (CDP)**

Seedear una rutina con 3+ ejercicios en `indexedDB` (mismo patrón usado en toda la sesión: abrir `fierro` DB, poner un `routine` con `exercises`), navegar a Hoy y:
1. Confirmar que el PRIMER pintado del carrusel (recién entrás a Hoy) posiciona el ejercicio correcto sin ningún salto ni animación visible — instantáneo, como antes.
2. Completar todas las series del primer ejercicio (disparar `saveSet` hasta llegar al objetivo) y confirmar que el avance automático al siguiente ejercicio sigue siendo suave (esto YA era `scrollCarouselTo`, con `behavior:'smooth'` — no debería haber cambiado, es la confirmación de que no se rompió).
3. El caso que sí cambia: forzar un cambio de `focusKey` SIN que sea el primer montaje — por ejemplo, con la sesión ya arrancada, tocar "Reordenar" y cambiar el orden de los ejercicios (eso dispara un `curId` distinto) o cambiar de día si la pantalla lo permite estando en Hoy — y confirmar que el carrusel esta vez SÍ desliza (no salta) hacia la nueva posición.

- [ ] **Paso 5: Commit**

```bash
git add web/src/components/ExerciseCarousel.jsx
git commit -m "$(cat <<'EOF'
feat(hoy): el carrusel desliza al reposicionarse, no salta

jumpToSlide() hacía car.scrollLeft=... directo cada vez que cambiaba
focusKey (día distinto, arranca la sesión, cambia el ejercicio en curso) —
instantáneo, sin transición. El scroll nativo (deslizar vos con el dedo) ya
era fluido; el salto abrupto pasaba sólo cuando la propia app reposicionaba.

Ahora sólo el PRIMER montaje de la pantalla usa el salto instantáneo (animar
desde scrollLeft=0 recién pintada se vería raro); los reposicionamientos
siguientes usan scrollToSlideEl con behavior:'smooth', que ya existía y ya
se usaba después de completar un ejercicio.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `catsDeSesion` — qué grupos musculares trabajó una sesión

**Files:**
- Modify: `web/src/lib/muscle.js`
- Test: `web/src/lib/__tests__/muscle.test.js`

**Interfaces:**
- Consumes: `catOf` (ya definida en el mismo archivo, `muscle.js:97`).
- Produces: `catsDeSesion(sess)` — recibe un objeto sesión (`{entries: [{cat, ...}], ...}`, la misma forma que arma `completeSession()` en `session.js`) y devuelve `string[]`: los nombres de categoría únicos, en el orden en que aparece cada uno por primera vez. Task 6 la usa.

Esta es la única pieza de lógica de todo el plan que no es CSS/JSX puro — por eso es la única con test unitario de verdad (vitest, sin jsdom, igual que el resto de `lib/`).

- [ ] **Paso 1: Escribir el test que falla**

Abrir `web/src/lib/__tests__/muscle.test.js`. Buscar la línea del import:
```js
import { catOf, muscleVolume, uncategorized, daysSinceGroup, daysSinceAll, stalestGroups, MUSCLE_CATS, groupStats, diasTexto } from '../muscle.js';
```
Reemplazar por:
```js
import { catOf, muscleVolume, uncategorized, daysSinceGroup, daysSinceAll, stalestGroups, MUSCLE_CATS, groupStats, diasTexto, catsDeSesion } from '../muscle.js';
```

Al final del archivo (después del último `describe(...)`), agregar:
```js
describe('catsDeSesion', () => {
  it('devuelve los grupos únicos, en el orden de primera aparición', () => {
    const sess = {
      entries: [
        { name: 'Press banca', cat: 'Pecho', sets: [{ w: 60, r: 8 }] },
        { name: 'Sentadilla', cat: 'Pierna', sets: [{ w: 80, r: 8 }] },
        { name: 'Press inclinado', cat: 'Pecho', sets: [{ w: 40, r: 10 }] },
      ],
    };
    expect(catsDeSesion(sess)).toEqual(['Pecho', 'Pierna']);
  });

  it('sesión vacía no explota', () => {
    expect(catsDeSesion({ entries: [] })).toEqual([]);
  });

  it('sin sess (undefined/null) no explota', () => {
    expect(catsDeSesion(undefined)).toEqual([]);
    expect(catsDeSesion(null)).toEqual([]);
  });

  it('una entrada sin cat asignado se clasifica por nombre, como en cualquier otro lado', () => {
    const sess = { entries: [{ name: 'Press banca', sets: [{ w: 60, r: 8 }] }] };
    expect(catsDeSesion(sess)).toEqual(['Pecho']);
  });
});
```

- [ ] **Paso 2: Correr el test para confirmar que falla**

Run: `cd web && npx vitest run muscle.test.js`
Expected: FAIL — `catsDeSesion is not a function` o similar (todavía no existe en `muscle.js`).

- [ ] **Paso 3: Implementar `catsDeSesion` en `muscle.js`**

Al final de `web/src/lib/muscle.js`, agregar:
```js
/** Los grupos musculares que trabajó una sesión ya cerrada, en el orden en
    que aparecen (primer ejercicio de cada uno manda) y sin repetir — para
    la pantalla de fin de sesión, que ilumina el cuerpo con lo que se hizo
    HOY y no con el historial completo (eso ya lo hace groupStats). */
export function catsDeSesion(sess) {
  const vistos = new Set();
  const out = [];
  for (const e of sess?.entries || []) {
    const c = catOf(e);
    if (c && !vistos.has(c)) { vistos.add(c); out.push(c); }
  }
  return out;
}
```

- [ ] **Paso 4: Correr el test para confirmar que pasa**

Run: `cd web && npx vitest run muscle.test.js`
Expected: PASS, las 4 nuevas pruebas en verde.

- [ ] **Paso 5: Correr la suite completa y lint**

Run: `cd web && npx vitest run`
Expected: todos los tests pasan.

Run: `cd web && npm run lint`
Expected: mismos 10 warnings de siempre.

- [ ] **Paso 6: Commit**

```bash
git add web/src/lib/muscle.js web/src/lib/__tests__/muscle.test.js
git commit -m "$(cat <<'EOF'
feat(muscle): catsDeSesion — qué grupos trabajó una sesión cerrada

Función chica y pura para la pantalla de fin de sesión (Task siguiente):
a partir de sess.entries (ya trae .cat por entrada, como arma
completeSession en session.js) devuelve los grupos únicos en el orden en
que aparecen. No reusa groupStats() porque esa mira TODA la ventana de 28
días — acá hace falta sólo lo de HOY.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `Silhouette` — modo no interactivo con revelado por zona

**Files:**
- Modify: `web/src/components/Silhouette.jsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: nada nuevo — sigue usando `groupStats`, `diasTexto` de `lib/muscle.js` como antes.
- Produces: dos props nuevas en `<Silhouette/>`, AMBAS opcionales y con default que preserva el comportamiento actual al 100% (Inicio, que ya usa `<Silhouette days={...}/>`, no cambia en absoluto):
  - `interactivo` (boolean, default `true`): en `false`, no hay gesto de girar, no hay tap-to-ver-estadísticas, no se muestran los botones Frente/Espalda.
  - `revelar` (objeto `{[cat]: delayMs}` o `null`, default `null`): cuando una zona tiene `cat` presente en `revelar`, se le suma la clase `sil-revela` con `animation-delay` igual al valor — la zona aparece con un fade-in a partir de ese momento en vez de estar ya pintada desde el arranque. Task 6 arma este objeto con los delays absolutos de cada beat.

**Contexto:** la pantalla de fin de sesión (Task 6) necesita mostrar el cuerpo con los grupos de HOY iluminándose, pero SIN el gesto de girar ni el tap a estadísticas (es una vista de un vistazo, no interactiva) y CON un efecto de revelado escalonado (no todo pintado de una).

- [ ] **Paso 1: Agregar los props nuevos a `Cara` y su lógica de revelado**

Buscar en `web/src/components/Silhouette.jsx`:
```jsx
function Cara({ cara, days, etiqueta, sel, onPick, activa }) {
```
Reemplazar por:
```jsx
function Cara({ cara, days, etiqueta, sel, onPick, activa, revelar }) {
```

Buscar:
```jsx
      {zonas.map((z, i) => {
        const dibujos = z.d.map((d, j) => <path key={j} d={d} />);
        const cls = claseDe(z, days);
        if (!z.cat || z.cat === 'pelo') {
          return <g key={i} className={`sil-z ${cls}`}>{dibujos}</g>;
        }
        const activo = sel === z.cat;
        return (
          <g
            key={i}
            className={`sil-z sil-tap ${cls} ${activo ? 'sil-sel' : ''}`}
            role="button"
            tabIndex={activa ? 0 : -1}
            aria-label={`${z.cat}, ${diasTexto(days[z.cat])}. Ver estadísticas.`}
            aria-pressed={activo}
            onClick={e => onPick(z.cat, e.currentTarget)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(z.cat, e.currentTarget); }
            }}
          >
            {dibujos}
          </g>
        );
      })}
```
Reemplazar por:
```jsx
      {zonas.map((z, i) => {
        const dibujos = z.d.map((d, j) => <path key={j} d={d} />);
        const cls = claseDe(z, days);
        if (!z.cat || z.cat === 'pelo') {
          return <g key={i} className={`sil-z ${cls}`}>{dibujos}</g>;
        }
        const delayMs = revelar ? revelar[z.cat] : undefined;
        const revelando = delayMs !== undefined;
        /* Sin onPick (modo no interactivo, ver Silhouette más abajo): la
           zona es sólo el dibujo pintado, sin role=button/tabIndex/onClick.
           Es la pantalla de fin de sesión mostrando un vistazo, no un mapa
           para tocar. */
        if (!onPick) {
          return (
            <g
              key={i}
              className={`sil-z ${cls}${revelando ? ' sil-revela' : ''}`}
              style={revelando ? { animationDelay: `${delayMs}ms` } : undefined}
            >
              {dibujos}
            </g>
          );
        }
        const activo = sel === z.cat;
        return (
          <g
            key={i}
            className={`sil-z sil-tap ${cls} ${activo ? 'sil-sel' : ''}`}
            role="button"
            tabIndex={activa ? 0 : -1}
            aria-label={`${z.cat}, ${diasTexto(days[z.cat])}. Ver estadísticas.`}
            aria-pressed={activo}
            onClick={e => onPick(z.cat, e.currentTarget)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(z.cat, e.currentTarget); }
            }}
          >
            {dibujos}
          </g>
        );
      })}
```

- [ ] **Paso 2: Agregar los props nuevos a `Silhouette` y condicionar gesto/botones/popover**

Buscar:
```jsx
export default function Silhouette({ days = {} }) {
```
Reemplazar por:
```jsx
export default function Silhouette({ days = {}, interactivo = true, revelar = null }) {
```

Buscar:
```jsx
      <div
        className={`sil-stage ${quieto ? '' : 'girando'}`}
        ref={stage}
        onPointerDown={dedoAbajo}
        onPointerMove={dedoMueve}
        onPointerUp={dedoArriba}
        onPointerCancel={dedoArriba}
      >
        <div
          className={`sil-flip ${tirando ? '' : 'suave'}`}
          style={{ transform: `rotateY(${ang}deg)` }}
          onTransitionEnd={asentar}
        >
          <div className={`sil-face ${atras ? '' : 'on'}`}>
            <Cara cara={frente} days={days} etiqueta="Frente" sel={sel?.cat} onPick={tocar} activa={!atras} />
          </div>
          <div className={`sil-face atras ${atras ? 'on' : ''}`}>
            <Cara cara={espalda} days={days} etiqueta="Espalda" sel={sel?.cat} onPick={tocar} activa={atras} />
          </div>
        </div>
      </div>

      {/* Dos botones y no uno que alterna: un botón solo tendría que decir o
          dónde estás o adónde vas, y las dos lecturas son igual de válidas. */}
      <div className="sil-caras" role="group" aria-label="Girar el cuerpo">
        <button type="button" aria-pressed={!atras} onClick={() => girarA(false)}>Frente</button>
        <button type="button" aria-pressed={atras} onClick={() => girarA(true)}>Espalda</button>
      </div>

      {sel && (
        <>
          <button type="button" className="sil-tapa" onClick={cerrar} aria-label="Cerrar estadísticas" />
          <MusclePop stats={groupStats(sel.cat)} pos={sel} onClose={cerrar} />
        </>
      )}
```
Reemplazar por:
```jsx
      <div
        className={`sil-stage ${quieto ? '' : 'girando'}`}
        ref={stage}
        {...(interactivo ? {
          onPointerDown: dedoAbajo,
          onPointerMove: dedoMueve,
          onPointerUp: dedoArriba,
          onPointerCancel: dedoArriba,
        } : {})}
      >
        <div
          className={`sil-flip ${tirando ? '' : 'suave'}`}
          style={{ transform: `rotateY(${ang}deg)` }}
          onTransitionEnd={asentar}
        >
          <div className={`sil-face ${atras ? '' : 'on'}`}>
            <Cara cara={frente} days={days} etiqueta="Frente" sel={sel?.cat} onPick={interactivo ? tocar : undefined} activa={!atras} revelar={revelar} />
          </div>
          <div className={`sil-face atras ${atras ? 'on' : ''}`}>
            <Cara cara={espalda} days={days} etiqueta="Espalda" sel={sel?.cat} onPick={interactivo ? tocar : undefined} activa={atras} revelar={revelar} />
          </div>
        </div>
      </div>

      {/* Dos botones y no uno que alterna: un botón solo tendría que decir o
          dónde estás o adónde vas, y las dos lecturas son igual de válidas.
          No interactivo (pantalla de fin de sesión): ni girar ni tocar
          tienen sentido en un vistazo de unos segundos. */}
      {interactivo && (
        <div className="sil-caras" role="group" aria-label="Girar el cuerpo">
          <button type="button" aria-pressed={!atras} onClick={() => girarA(false)}>Frente</button>
          <button type="button" aria-pressed={atras} onClick={() => girarA(true)}>Espalda</button>
        </div>
      )}

      {interactivo && sel && (
        <>
          <button type="button" className="sil-tapa" onClick={cerrar} aria-label="Cerrar estadísticas" />
          <MusclePop stats={groupStats(sel.cat)} pos={sel} onClose={cerrar} />
        </>
      )}
```

- [ ] **Paso 3: Sumar la animación de revelado en `styles.css`**

Buscar:
```css
.sil-tap{cursor:pointer;-webkit-tap-highlight-color:transparent}
.sil-tap:focus{outline:none}
.sil-tap:focus-visible,.sil-sel{stroke:var(--accent);stroke-width:4}
```
Agregar DESPUÉS de ese bloque (sin tocarlo):
```css
/* Revelado escalonado para la pantalla de fin de sesión (Silhouette con
   interactivo=false + revelar): cada zona entra con su propio delay en vez
   de estar ya pintada desde el primer frame — "backwards" la mantiene en el
   estado inicial (tenue) durante el delay, si no destellaría a opacidad
   completa antes de empezar a animar. Sólo anima opacity: si tocara filter
   pelearía con el glow que .sil-d0 ya trae puesto (filter:url(#sil-glow)) y
   se vería un parpadeo al terminar la animación. */
@keyframes sil-revela{from{opacity:.18}to{opacity:1}}
.sil-revela{animation:sil-revela .5s var(--ease) backwards}
@media (prefers-reduced-motion:reduce){
  .sil-revela{animation:none}
}
```

- [ ] **Paso 4: Correr la suite completa y lint**

Run: `cd web && npx vitest run`
Expected: todos los tests pasan (no se tocó `lib/muscle.js` en esta tarea).

Run: `cd web && npm run lint`
Expected: mismos 10 warnings de siempre.

- [ ] **Paso 5: Verificar en navegador real (CDP) — Inicio no cambió**

Entrar a Inicio (que usa `<Silhouette days={...}/>` sin los props nuevos, o sea con los defaults `interactivo=true, revelar=null`) y confirmar que se ve y se comporta EXACTAMENTE igual que antes de este cambio: gira con el dedo, tocar un músculo abre el globo de estadísticas, los botones Frente/Espalda siguen ahí.

- [ ] **Paso 6: Verificar en navegador real (CDP) — modo no interactivo**

Esta tarea no tiene todavía quién la use con `interactivo={false}` (eso es Task 6) — para probarla aislada, se puede montar temporalmente en cualquier pantalla algo como:
```jsx
<Silhouette days={{ Pecho: 0, Pierna: 0 }} interactivo={false} revelar={{ Pecho: 0, Pierna: 300 }} />
```
y confirmar por CDP que: (a) no hay botones Frente/Espalda visibles, (b) tocar el cuerpo no gira nada ni abre ningún popover, (c) los grupos Pecho y Pierna aparecen con fade-in escalonado (Pecho primero, Pierna 300ms después) en vez de estar pintados desde el arranque, (d) el resto del cuerpo se ve en su tono neutro de siempre. Sacar el montaje de prueba después de confirmar (no debe quedar en el código — Task 6 lo monta de verdad).

- [ ] **Paso 7: Commit**

```bash
git add web/src/components/Silhouette.jsx web/src/styles.css
git commit -m "$(cat <<'EOF'
feat(cuerpo): Silhouette suma modo no interactivo con revelado por zona

Dos props nuevas, ambas opcionales con default que preserva el
comportamiento actual al 100% (Inicio no cambia en nada):

- interactivo=false apaga el gesto de girar, el tap a estadísticas y los
  botones Frente/Espalda — para un vistazo de unos segundos, no un mapa
  para explorar.
- revelar={cat: delayMs} hace que esa zona aparezca con fade-in a partir
  de ese momento en vez de estar pintada desde el primer frame.

Preparación para la pantalla de fin de sesión (task siguiente), que
necesita mostrar el cuerpo iluminándose sin dejar tocar nada.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Pantalla de fin de sesión (racha + resumen + cuerpo)

**Files:**
- Create: `web/src/components/SessionComplete.jsx`
- Modify: `web/src/lib/state.js` (nuevo campo `S.sessionComplete`)
- Modify: `web/src/lib/session.js` (`completeSession()` dispara la pantalla nueva en vez de abrir el sheet directo)
- Modify: `web/src/App.jsx` (monta `<SessionComplete/>`)
- Modify: `web/src/styles.css` (estilos de la pantalla nueva)

**Interfaces:**
- Consumes: `catsDeSesion` (Task 4, `lib/muscle.js`), `Silhouette` con `interactivo`/`revelar` (Task 5), `currentStreak()` (`lib/streak.js`, ya existe, sin args), `S.sessionComplete` (campo nuevo en `state.js`).
- Produces: nada que otra tarea de este plan consuma — es la última pieza.

**Contexto exacto:** hoy, `completeSession()` en `session.js` guarda la sesión, vibra, y abre DIRECTO el sheet `session-view` con `justFinished:true` (más confetti si hubo PRs — eso no cambia, sigue disparándose igual). No hay ningún momento que reconozca "terminaste el día" antes de caer en el detalle numérico.

- [ ] **Paso 1: Sumar el campo nuevo a `S` en `state.js`**

Buscar en `web/src/lib/state.js`:
```js
  ready: false,         // true una vez que loadAll() terminó
  sheet: null,           // {type, props} | null — qué sheet está abierto (Task 1 dejó esto pendiente para quien lo necesitara primero; ver Sheet.jsx)
};
```
Reemplazar por:
```js
  ready: false,         // true una vez que loadAll() terminó
  sheet: null,           // {type, props} | null — qué sheet está abierto (Task 1 dejó esto pendiente para quien lo necesitara primero; ver Sheet.jsx)
  // La sesión recién cerrada, mientras dura la pantalla de racha/resumen/
  // cuerpo (SessionComplete.jsx) — null cuando no hay nada que mostrar.
  // Separado de `sheet` porque es pantalla completa, no un sheet: los dos
  // sistemas conviven pero no se pisan.
  sessionComplete: null,
};
```

- [ ] **Paso 2: Cambiar `completeSession()` para disparar la pantalla nueva**

Buscar en `web/src/lib/session.js`:
```js
import { S, bump, saveDraft, wBoth, openSheet, closeSheet } from './state.js';
```
Reemplazar por (se saca `openSheet`: su único uso en este archivo era la línea que se cambia en el paso siguiente, y queda sin usar si no se saca — el lint lo marcaría):
```js
import { S, bump, saveDraft, wBoth, closeSheet } from './state.js';
```

Buscar:
```js
  S.draft = null; S.hoyDay = null;
  await saveDraft();
  stopRest();
  vibrate([30, 50, 30]);
  bump();
  openSheet('session-view', { id: sess.id, justFinished: true });
  if (prs.length > 0) fireConfetti();
```
Reemplazar por:
```js
  S.draft = null; S.hoyDay = null;
  await saveDraft();
  stopRest();
  vibrate([30, 50, 30]);
  // Antes acá se abría directo el sheet de detalle (session-view). Ahora
  // primero pasa la pantalla de racha/resumen/cuerpo (SessionComplete.jsx,
  // montada en App.jsx) — ella es quien abre session-view cuando termina o
  // la salteás tocando. El confetti de PRs no cambia: sigue disparándose acá.
  S.sessionComplete = sess;
  bump();
  if (prs.length > 0) fireConfetti();
```

- [ ] **Paso 3: Crear `SessionComplete.jsx`**

Crear `web/src/components/SessionComplete.jsx`:
```jsx
// Pantalla completa y automática al terminar el entrenamiento del día:
// racha, resumen, cuerpo — tres tiempos seguidos, no simultáneos (ver
// docs/superpowers/specs/2026-08-13-sensacion-premium-movimiento-design.md).
// Se puede tocar en cualquier momento para saltarla: entrenar es una acción
// diaria, así que nada acá puede volverse una traba en un mal día.
//
// No es un sheet (Sheet.jsx): ocupa toda la pantalla, mismo patrón que ya
// usa el overlay de descanso (#rest-fs en RestTimer.jsx) — position:fixed
// propio, sin pasar por el sistema de S.sheet.
import { useEffect, useRef } from 'react';
import { S, useStore, openSheet } from '../lib/state.js';
import { currentStreak } from '../lib/streak.js';
import { catsDeSesion } from '../lib/muscle.js';
import { fmtNum, round1 } from '../lib/format.js';
import Silhouette from './Silhouette.jsx';

// Los tres tiempos NO duran lo mismo (a propósito: racha y resumen son un
// vistazo, el cuerpo necesita más para que el revelado por zona se note).
// BEAT3_DELAY es cuándo arranca el tercer bloque — los delays de cada zona
// del cuerpo (revelar, más abajo) se suman a partir de ahí, para que el
// revelado escalonado ocurra DURANTE el tiempo en que ese bloque ya es
// visible, no antes.
const BEAT3_DELAY = 1950;
const STAGGER_ZONA = 150;
const DUR_TOTAL = 3650; // 1950 (arranca beat 3) + 1700 (dura beat 3)

function resumenDe(sess) {
  let series = 0, kg = 0;
  for (const e of sess.entries) {
    series += e.sets.length;
    for (const s of e.sets) kg += (s.w || 0) * (s.r || 0);
  }
  return { ejercicios: sess.entries.length, series, kg };
}

export default function SessionComplete() {
  useStore(); // se re-renderiza cuando S.sessionComplete cambia (mismo canal que el resto de S)
  const sess = S.sessionComplete;
  const timerRef = useRef(null);

  function cerrar() {
    clearTimeout(timerRef.current);
    const id = S.sessionComplete?.id;
    S.sessionComplete = null;
    if (id) openSheet('session-view', { id, justFinished: true });
  }

  useEffect(() => {
    if (!sess) return;
    timerRef.current = setTimeout(cerrar, DUR_TOTAL);
    return () => clearTimeout(timerRef.current);
    // sess.id y no `sess`: sess es un objeto nuevo cada vez que se llama
    // completeSession(), pero comparar por id evita reiniciar el timer si
    // bump() (global a S) dispara un re-render de esta pantalla por algo
    // que no tiene nada que ver (otra parte de la app tocando S).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sess?.id]);

  if (!sess) return null;

  const { ejercicios, series, kg } = resumenDe(sess);
  const streak = currentStreak();
  const cats = catsDeSesion(sess);
  const revelar = Object.fromEntries(cats.map((c, i) => [c, BEAT3_DELAY + i * STAGGER_ZONA]));
  const diasHoy = Object.fromEntries(cats.map(c => [c, 0]));

  return (
    <div id="session-complete" role="status" aria-label="Entrenamiento completo" onClick={cerrar}>
      <div className="sc-beat b1">
        <div className="sc-flame">🔥</div>
        <div className="sc-streak-n">{streak}</div>
        <div className="sc-lbl">{streak === 1 ? 'día de racha' : 'días de racha'}</div>
      </div>
      <div className="sc-beat b2">
        <div className="sc-resumen">
          <div><b>{ejercicios}</b><span>ejercicios</span></div>
          <div><b>{series}</b><span>series</span></div>
          <div><b>{fmtNum(round1(kg))}</b><span>kg movidos</span></div>
        </div>
      </div>
      <div className="sc-beat b3">
        <div className="sc-cuerpo">
          <Silhouette days={diasHoy} interactivo={false} revelar={revelar} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Paso 4: Montar `<SessionComplete/>` en `App.jsx`**

Buscar en `web/src/App.jsx`:
```js
import RestTimer from './components/RestTimer.jsx';
```
Reemplazar por:
```js
import RestTimer from './components/RestTimer.jsx';
import SessionComplete from './components/SessionComplete.jsx';
```

Buscar:
```jsx
      <Toast />
      <Sheet open={!!store.sheet} onClose={closeSheet}>
        <SheetContent sheet={store.sheet} />
      </Sheet>
      <RestTimer />
    </>
  );
}
```
Reemplazar por:
```jsx
      <Toast />
      <Sheet open={!!store.sheet} onClose={closeSheet}>
        <SheetContent sheet={store.sheet} />
      </Sheet>
      <RestTimer />
      <SessionComplete />
    </>
  );
}
```

- [ ] **Paso 5: Sumar los estilos en `styles.css`**

Al final de `web/src/styles.css`, agregar:
```css
/* ---------- pantalla de fin de sesión ---------- */
#session-complete{
  position:fixed;inset:0;z-index:70;
  background:radial-gradient(120% 100% at 50% 0%,rgba(34,211,238,.16),transparent 60%),#05070c;
  display:flex;align-items:center;justify-content:center;
  overflow:hidden;
}
.sc-beat{
  position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  opacity:0;padding:24px;text-align:center;
  animation:sc-beat var(--dur) var(--ease) forwards;
}
@keyframes sc-beat{0%{opacity:0;transform:scale(.94)}12%{opacity:1;transform:none}88%{opacity:1}100%{opacity:0;transform:scale(1.04)}}
.sc-beat.b1{--dur:1000ms;animation-delay:0ms}
.sc-beat.b2{--dur:1050ms;animation-delay:950ms}
.sc-beat.b3{--dur:1700ms;animation-delay:1950ms}
@media (prefers-reduced-motion:reduce){
  .sc-beat{animation:none;opacity:1}
}

.sc-flame{font-size:56px;line-height:1}
.sc-streak-n{font-family:'Barlow Condensed';font-weight:800;font-size:64px;color:#fff;line-height:1}
.sc-lbl{color:var(--mut);font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.1em}

.sc-resumen{display:flex;gap:28px}
.sc-resumen div{display:flex;flex-direction:column;align-items:center;gap:2px}
.sc-resumen b{font-family:'Barlow Condensed';font-weight:800;font-size:34px;color:#fff}
.sc-resumen span{color:var(--mut);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}

/* .sil-pair (Silhouette) usa flex:1;min-height:0 — necesita un padre flex
   con alto definido para poder estirarse; sin display:flex acá colapsaría
   a alto cero. */
.sc-cuerpo{display:flex;flex-direction:column;width:220px;height:280px}
```

- [ ] **Paso 6: Correr la suite completa y lint**

Run: `cd web && npx vitest run`
Expected: todos los tests pasan.

Run: `cd web && npm run lint`
Expected: mismos 10 warnings de siempre — en particular, confirmar que sacar `openSheet` del import de `session.js` no dejó ningún otro warning de import sin usar (si `openSheet` se necesitara en otro lado del archivo que no se vio en este plan, el lint lo va a marcar; en ese caso, no sacarlo del import).

- [ ] **Paso 7: Verificar en navegador real (CDP)**

Seedear una rutina, arrancar una sesión, registrar al menos una serie por cada ejercicio (para que `completeSession()` no la rechace por "no registraste ninguna serie"), y tocar "Completar sesión":

1. Confirmar que aparece la pantalla completa nueva (no el sheet de detalle directo).
2. Capturar una screenshot ~500ms después de abrir: debe verse el beat 1 (racha, con el número correcto — confirmar que coincide con lo que ya mostraba el header antes de completar, +1).
3. Capturar otra a ~1400ms: debe verse el beat 2 (ejercicios/series/kg — confirmar que los números coinciden con lo que realmente se registró en la sesión de prueba).
4. Capturar otra a ~2500ms: debe verse el beat 3 (el cuerpo, con los grupos trabajados iluminados — confirmar que sólo brillan los grupos de los ejercicios que se registraron, no todo el cuerpo).
5. Sin tocar nada, confirmar que ~3700ms después de completar la sesión, la pantalla se cierra sola y aparece el sheet `session-view` de siempre (mismo comportamiento que antes de este cambio, sólo que ahora pasa DESPUÉS de la nueva pantalla).
6. Repetir completando otra sesión y esta vez TOCAR la pantalla a mitad del beat 2: confirmar que se salta directo a `session-view` sin esperar el resto de la secuencia.
7. Confirmar que si la sesión tuvo un PR, el confetti sigue disparándose (comportamiento preexistente, no debería haber cambiado).

- [ ] **Paso 8: Build completo**

Run: `cd web && npm run build`
Expected: build limpio, sin errores, `publish-root` copia los assets nuevos a la raíz del repo (mismo flujo de siempre).

- [ ] **Paso 9: Commit**

```bash
git add web/src/components/SessionComplete.jsx web/src/lib/state.js web/src/lib/session.js web/src/App.jsx web/src/styles.css
git commit -m "$(cat <<'EOF'
feat(sesion): pantalla de fin de sesión — racha, resumen, cuerpo

Antes completeSession() abría directo el sheet de detalle (session-view):
no había ningún momento que reconociera "terminaste el día" antes de caer
en el número frío. Ahora, antes de eso, se muestra una pantalla completa
automática de ~3.5s en tres tiempos seguidos (no simultáneos): la racha
sumando +1, un vistazo al resumen del día, y el cuerpo iluminando los
grupos musculares trabajados HOY (Silhouette en modo no interactivo,
Task de revelado por zona).

Se puede tocar en cualquier momento para saltarla directo a session-view —
entrenar es diario, y una pantalla que no se puede apurar en un mal día es
fricción, no algo premium. El confetti de PRs no cambia, sigue disparándose
igual que antes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Deploy final

Después de la Task 6 (última tarea), seguir el flujo de deploy ya establecido en toda la sesión:

```bash
cd web && npm run build   # ya corrido en Task 6 paso 8, pero repetir si hubo cambios después
cd ..
git status --short        # confirmar qué cambió en index.html/sw.js/assets/
git add index.html sw.js assets/
git commit -m "build: publicar sensación premium — movimiento y fin de sesión"
gh auth switch --hostname github.com --user Exorplion
git push
```

Y esperar/confirmar que `https://exorplion.github.io/gymapp/` sirve el nuevo hash de `assets/index-*.js` antes de dar por terminado, exactamente como se verificó cada cambio anterior en esta sesión.

---

## Self-Review (hecho antes de guardar este plan)

**Cobertura del spec:** las cuatro piezas del spec (`docs/superpowers/specs/2026-08-13-sensacion-premium-movimiento-design.md`) tienen su tarea — Task 1 (transición de pestañas), Task 2 (cierre de sheets), Task 3 (carrusel), Tasks 4-6 (pantalla de fin de sesión, partida en la función pura, el cambio a Silhouette, y el componente nuevo). Los non-goals del spec (color/tema, swipe en vivo, íconos/tipografía, feedback físico, ilustraciones) no tienen ninguna tarea acá — correcto, quedan fuera a propósito.

**Placeholders:** ninguno — cada paso de código tiene el contenido real, no descripciones de qué hacer.

**Consistencia de tipos/nombres:** `catsDeSesion(sess) → string[]` (Task 4) es lo que consume Task 6 tal cual. `Silhouette({interactivo, revelar})` (Task 5) es exactamente lo que Task 6 usa (`interactivo={false} revelar={revelar}`, donde `revelar` en Task 6 es el objeto `{cat: delayMs}` que Task 5 espera). `S.sessionComplete` (Task 6 paso 1) es el mismo campo que lee `SessionComplete.jsx` (paso 3) y que escribe `completeSession()` (paso 2).
