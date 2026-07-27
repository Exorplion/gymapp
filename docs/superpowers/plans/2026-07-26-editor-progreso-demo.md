# Editor de rutina, progreso y datos de demo — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hacer que el editor de rutina permita reordenar/eliminar días y deshacer cambios, reemplazar los diálogos nativos del navegador por sheets propios, hacer los gráficos de Progreso legibles e interactivos con menos scroll, y generar un mes de datos de demo con variación humana realista.

**Architecture:** todo vive en el único archivo `index.html` (PWA vanilla JS sin build step, estado global `S`, persistencia por `idb.put/clear`, renderizado por strings de HTML). Se extiende el sistema de drag-and-drop genérico (`[data-sort]`/`[data-sid]`) que ya usan los ejercicios, se añade un helper genérico de confirmación por sheet, un stack de historial en memoria para deshacer/rehacer, y se generaliza `drawChart()` para que dibuje en base a fechas reales en vez de índices.

**Tech Stack:** HTML/CSS/JS vanilla, IndexedDB, Canvas 2D. Sin frameworks, sin test runner.

## Global Constraints

- No se introduce ningún framework, librería de gráficos ni build step — todo el código nuevo sigue el estilo existente (funciones cortas, `data-act`/`ACT`, `openSheet`/`toast`).
- No se toca ninguna pantalla fuera de Editar rutina y Progreso (Hoy y Nutrición quedan intactas).
- El historial de deshacer/rehacer vive solo en memoria durante `S.rutMode==='edit'` — no se persiste en IndexedDB.
- Los datos de demo siguen marcados `seed:true` y siguen siendo borrables con `wipeSeed()` sin tocar datos reales.
- Verificación manual en navegador (skill `run`) en cada tarea — no hay suite de tests automatizada en este proyecto.

---

## Fase A — Editor de rutina

### Task 1: Sheet de confirmación genérico, reemplaza prompt()/confirm() del editor

**Files:**
- Modify: `index.html` — nueva sección junto a `openSheet()`/`closeSheet()` (~línea 2460)
- Modify: `index.html:2836-2865` (`ACT['lib-save']`, `ACT['lib-del']`)
- Modify: `index.html:2765-2774` (`ACT['tmpl-clear']`)

**Interfaces:**
- Produces: `sheetConfirm(title, body, confirmLabel, onConfirm)` — abre un sheet de confirmación; `onConfirm` corre si el usuario confirma.
- Produces: `ACT['confirm-yes']`, `ACT['lib-save']`, `ACT['lib-save-confirm']` — usados por tareas posteriores (ninguna otra tarea depende de esto, pero deben existir con estos nombres exactos).

- [ ] **Step 1: Agregar el helper `sheetConfirm` junto a `openSheet`/`closeSheet` (index.html:2458-2460)**

```js
/* ================= sheet ================= */
function openSheet(html){$('#sheet-c').innerHTML=html;$('#sheet').classList.add('open');}
function closeSheet(){$('#sheet').classList.remove('open');}
let PENDING_CONFIRM=null;
function sheetConfirm(title,body,confirmLabel,onConfirm){
  PENDING_CONFIRM=onConfirm;
  openSheet(`<h2>${esc(title)}</h2>
    <div class="txt-mut" style="font-size:14px;line-height:1.5;margin-bottom:18px">${esc(body)}</div>
    <div style="display:flex;gap:10px">
      <button class="btn sm ghost" data-act="sheet-close" style="flex:1">Cancelar</button>
      <button class="btn sm danger" data-act="confirm-yes" style="flex:1">${esc(confirmLabel)}</button>
    </div>`);
}
```

- [ ] **Step 2: Registrar el handler `confirm-yes` en el `ACT` map, junto a `'sheet-close'` (index.html:2670)**

```js
  'sheet-close':()=>closeSheet(),
  'confirm-yes':()=>{const fn=PENDING_CONFIRM;PENDING_CONFIRM=null;closeSheet();fn&&fn();},
```

- [ ] **Step 3: Reemplazar `ACT['lib-save']` (el `prompt()` de "Guardar como…") por un sheet con input, en index.html:2836-2851**

```js
  'lib-save':()=>{
    const st=routineStats();
    if(!st.days.length){toast('No hay rutina que guardar');return;}
    openSheet(`<h2>Guardar rutina</h2>
      <div class="field"><label>Nombre</label>
      <input id="f-savename" value="${esc(routineName()==='Rutina personalizada'?'':routineName())}" placeholder="Mi rutina"></div>
      <div style="display:flex;gap:10px">
        <button class="btn sm ghost" data-act="sheet-close" style="flex:1">Cancelar</button>
        <button class="btn sm" data-act="lib-save-confirm" style="flex:1">Guardar</button>
      </div>`);
    setTimeout(()=>$('#f-savename')?.focus(),80);
  },
  'lib-save-confirm':async()=>{
    const name=($('#f-savename')?.value||'').trim();
    if(!name){toast('Ingresá un nombre');return;}
    const days=routineSnapshot();
    const prev=S.lib.find(r=>norm(r.name)===norm(name));
    const doSave=async()=>{
      if(prev){prev.days=days;prev.savedAt=dstr();}
      else S.lib.unshift({id:uid(),name,days,savedAt:dstr()});
      S.cfg.routineName=name;
      await saveLib();await saveCfg();
      closeSheet();renderRutina();vibrate(15);
      toast(`Guardada como "${name}"`);
    };
    if(prev)sheetConfirm(`¿Reemplazar "${prev.name}"?`,'Ya tenés una rutina guardada con este nombre.','Reemplazar',doSave);
    else await doSave();
  },
```

- [ ] **Step 4: Reemplazar el `confirm()` de `ACT['lib-del']` (index.html:2860-2865)**

```js
  'lib-del':b=>{
    const r=S.lib.find(x=>x.id===b.dataset.id);if(!r)return;
    sheetConfirm(`¿Borrar "${r.name}"?`,'Tu split actual no cambia — solo se borra de tu biblioteca.','Borrar',async()=>{
      S.lib=S.lib.filter(x=>x.id!==r.id);
      await saveLib();sheetLibrary();
    });
  },
```

- [ ] **Step 5: Reemplazar el `confirm()` de `ACT['tmpl-clear']` (index.html:2765-2774)**

```js
  'tmpl-clear':()=>{
    if(!Object.values(S.routine).some(d=>d.exercises?.length)){
      S.rutMode='edit';closeSheet();renderRutina();return;
    }
    sheetConfirm('¿Vaciar tu split?','Se borran todos los días y ejercicios.','Vaciar',async()=>{
      await idb.clear('routine');S.routine={};
      S.cfg.routineName='';await saveCfg();
      S.rutMode='edit';closeSheet();renderRutina();toast('Split vacío — armá el tuyo');
    });
  },
```

- [ ] **Step 6: Verificar en el navegador (skill `run`)**

Abrir la app, entrar a Editar rutina:
- "Guardar como…" muestra el sheet con input (no el prompt nativo), guarda y muestra el toast de confirmación.
- Guardar con un nombre que ya existe en la biblioteca abre el sheet de "¿Reemplazar…?" en vez del `confirm()` nativo.
- Desde Mis rutinas, borrar una rutina guardada abre el sheet de confirmación con botón rojo "Borrar".
- "Empezar en blanco" con una rutina cargada abre el sheet de confirmación "¿Vaciar tu split?".
- Confirmar en `about:blank` o cualquier consola que NO aparezca ningún diálogo nativo del navegador (`window.confirm`/`window.prompt`) en ninguno de estos 4 flujos.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: replace native prompt/confirm with sheet-based dialogs in routine editor"
```

---

### Task 2: Reordenar días (drag) y vaciar un día

**Files:**
- Modify: `index.html:1322-1418` (`renderRutina`)
- Modify: `index.html:2572-2630` (`dragEnd`, `commitSort`)
- Modify: `index.html:2765` área del `ACT` map (nuevo `day-del`)
- CSS: junto a `index.html:278-301` (reglas de `[data-sort]`/`[data-sid]`)

**Interfaces:**
- Consumes: `dragPick`, `dragStart`, `DRAG` state — sin cambios de firma (Task 1 no los toca).
- Produces: `activeDayWds()` — lista de wd (0-6) con contenido, en orden `WEEK_ORDER`. Usado por Task 3 (`pushHistory`/`undoRutina` no lo necesitan, pero lo reutiliza `swapDayContents`).
- Produces: `swapDayContents(newOrderIds)` — recibe un array de strings de wd en el nuevo orden y reasigna el contenido de `S.routine` en consecuencia.
- Produces: `ACT['day-del']`.

- [ ] **Step 1: Extraer `activeDayWds()` y usarlo en `renderRutina` (index.html:1378-1379)**

Reemplazar:
```js
  const rest=WEEK_ORDER.filter(wd=>!S.routine[wd]?.name&&!S.routine[wd]?.exercises?.length);
  WEEK_ORDER.filter(wd=>!rest.includes(wd)).forEach(wd=>{
```
por:
```js
  const active=activeDayWds();
  const rest=WEEK_ORDER.filter(wd=>!active.includes(wd));
  active.forEach(wd=>{
```
y agregar la función, cerca de `routineStats()` (index.html:1298):
```js
function activeDayWds(){
  return WEEK_ORDER.filter(wd=>S.routine[wd]?.name||S.routine[wd]?.exercises?.length);
}
```

- [ ] **Step 2: Envolver la lista de días en `data-sort="days"` y agregar asa + papelera al encabezado (index.html:1383-1390)**

Reemplazar el bloque completo del `.card.day` por:
```js
  h+=active.length>1?`<div class="drag-hint tight"><span>&#8597;</span><span>Mantené presionada el asa para intercambiar dos días.</span></div>`:'';
  h+=`<div data-sort="days">`;
  active.forEach(wd=>{
    const d=S.routine[wd];
    const exs=d?.exercises||[];
    const open=S.rutOpen===wd;
    h+=`<div class="card day ${open?'open':''}" data-wd="${wd}" data-sid="${wd}">
      <div class="day-headrow">
        <span class="mini day-handle" title="Arrastrar para intercambiar">&#10021;</span>
        <button class="day-head" data-act="day-toggle" data-wd="${wd}">
          <div>
            <span class="day-wd">${WD[wd]}</span>
            <span class="day-name ${d?.name?'':'empty'}">${d?.name?esc(d.name):'Descanso / sin asignar'}</span>
          </div>
          <span class="day-meta">${exs.length?exs.length+' ej.':''}<span class="chev">&rsaquo;</span></span>
        </button>
        <button class="mini red" data-act="day-del" data-wd="${wd}" title="Vaciar día">&#10005;</button>
      </div>
      <div class="day-body"><div class="dbi">
        ${exs.length>1?`<div class="drag-hint tight"><span>&#8597;</span><span>Mantené presionado un ejercicio para reordenarlo.</span></div>`:''}
        <div data-sort="rut" data-wd="${wd}" style="--lift:1.015">
        ${exs.map((ex,i)=>`<div class="row" data-sid="${ex.id}">
          <button class="mini info" data-act="ex-info" data-wd="${wd}" data-ex="${ex.id}" ${exInfo(ex.name)?'':'style="opacity:.4"'}>&#9432;</button>
          <div class="grow"><div class="t">${esc(ex.name)}</div><div class="s">${ex.sets}×${ex.reps} · RIR ${rirScheme(ex.sets,ex.name).join('/')}</div></div>
          <button class="mini" data-act="ex-up" data-wd="${wd}" data-ex="${ex.id}" ${i===0?'disabled':''}>&uarr;</button>
          <button class="mini" data-act="ex-down" data-wd="${wd}" data-ex="${ex.id}" ${i===exs.length-1?'disabled':''}>&darr;</button>
          <button class="mini" data-act="ex-edit" data-wd="${wd}" data-ex="${ex.id}">&#9998;</button>
          <button class="mini red" data-act="ex-del" data-wd="${wd}" data-ex="${ex.id}">&#10005;</button>
        </div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;margin-top:12px">
          <button class="btn sm ghost" data-act="ex-add" data-wd="${wd}" style="flex:2">+ Ejercicio</button>
          <button class="btn sm dim" data-act="day-edit" data-wd="${wd}" style="flex:1">&#9998; Día</button>
        </div>
      </div></div>
    </div>`;
  });
  h+=`</div>`;
```

- [ ] **Step 3: CSS del encabezado y del estado "arrastrando" del día (agregar junto a index.html:297, después de la regla `.row.dragging`)**

```css
.day-headrow{display:flex;align-items:center;gap:8px}
.day-headrow .day-head{flex:1}
.day-headrow .day-handle{cursor:grab;flex:none}
.card.day.dragging{
  box-shadow:0 26px 52px -20px rgba(0,0,0,.85),0 0 0 1px rgba(46,125,255,.35);
}
```

- [ ] **Step 4: `swapDayContents`, junto a `applyDays` (index.html:1309-1320)**

```js
function swapDayContents(newOrderIds){
  const active=activeDayWds();
  const snapshot=active.map(wd=>S.routine[wd]);
  const proms=[];
  active.forEach((wd,i)=>{
    const fromWd=+newOrderIds[i];
    const srcIdx=active.indexOf(fromWd);
    S.routine[wd]=srcIdx>=0?{...snapshot[srcIdx],weekday:wd}:ensureDay(wd);
    proms.push(persistDay(wd));
  });
  return Promise.all(proms);
}
```

- [ ] **Step 5: Bifurcar `dragEnd` para el caso `kind==='days'` (index.html:2572-2604)**

Justo después de la línea `vibrate(22);` y antes de `const saved=commitSort(kind,wd,ids);`, insertar:
```js
  if(kind==='days'){
    setTimeout(async()=>{ await swapDayContents(ids); clean(); renderRutina(); },300);
    return;
  }
```
(La función completa queda igual salvo por este bloque agregado.)

- [ ] **Step 6: `ACT['day-del']`, junto a `ACT['day-save']` (index.html:2794)**

```js
  'day-del':async b=>{
    const wd=+b.dataset.wd,d=S.routine[wd];
    if(!d?.name&&!d?.exercises?.length)return;
    S.routine[wd]={weekday:wd,name:'',exercises:[]};
    await persistDay(wd);
    renderRutina();
  },
```

- [ ] **Step 7: Verificar en el navegador (skill `run`)**

- Entrar a Editar rutina con al menos 3 días con contenido.
- Mantener presionada el asa (⚡) de un día y arrastrarlo sobre otro: al soltar, el contenido (nombre + ejercicios) de ambos días se intercambia; las etiquetas LUN/MAR/etc. quedan en su posición original.
- Tocar la papelera roja de un día: ese día queda "Descanso / sin asignar" sin afectar los demás.
- Confirmar que arrastrar sigue funcionando igual que antes para reordenar ejercicios dentro de un día (no se rompió `data-sort="rut"`).
- Confirmar que con un solo día activo no aparece el hint de arrastre ni se puede iniciar un drag (mínimo 2 días para que tenga sentido).

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: drag to swap day content and clear a single day in the routine editor"
```

---

### Task 3: Deshacer / rehacer en el editor

**Files:**
- Modify: `index.html` — nuevo bloque junto a `flipSort`/`DRAG` (~línea 2474) o junto a `activeDayWds()`
- Modify: `index.html:646-649` (`toast`)
- Modify: `index.html:2821-2829` (`ex-del`, `moveEx` en `dragEnd`/`commitSort` de Task 2, `day-del` de Task 2)
- Modify: `index.html:2831-2832` (`rut-view`)

**Interfaces:**
- Consumes: `activeDayWds()`, `swapDayContents()` de Task 2.
- Produces: `pushHistory(msg)`, `undoRutina()`, `redoRutina()`, `ACT['rut-undo']`, `ACT['rut-redo']`.
- Modifies: `toast(msg, opts)` — `opts` es un parámetro nuevo opcional; las ~30 llamadas existentes `toast('algo')` sin segundo argumento siguen funcionando igual.

- [ ] **Step 1: Extender `toast()` para aceptar un botón de acción (index.html:646-649)**

```js
function toast(msg,opts={}){
  const t=$('#toast');
  t.innerHTML=opts.actionLabel
    ?`<span>${esc(msg)}</span> <button data-act="${opts.actionAct}" class="toast-act">${esc(opts.actionLabel)}</button>`
    :esc(msg);
  t.classList.add('show');
  clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),opts.actionLabel?4000:1900);
}
```

Agregar el estilo del botón junto al CSS de `#toast`:
```css
.toast-act{background:none;border:none;color:var(--blue2);font-weight:700;font-size:13px;padding:0 0 0 4px;text-transform:uppercase;letter-spacing:.04em}
```

- [ ] **Step 2: Historial + deshacer/rehacer, junto a `activeDayWds()`**

```js
let RUT_HISTORY=[],RUT_REDO=[];
function pushHistory(msg){
  RUT_HISTORY.push(structuredClone(S.routine));
  if(RUT_HISTORY.length>20)RUT_HISTORY.shift();
  RUT_REDO=[];
  toast(msg,{actionLabel:'Deshacer',actionAct:'rut-undo'});
}
async function undoRutina(){
  if(!RUT_HISTORY.length)return;
  RUT_REDO.push(structuredClone(S.routine));
  S.routine=RUT_HISTORY.pop();
  await Promise.all(Object.keys(S.routine).map(wd=>persistDay(+wd)));
  renderRutina();
  toast('Deshecho',{actionLabel:'Rehacer',actionAct:'rut-redo'});
}
async function redoRutina(){
  if(!RUT_REDO.length)return;
  RUT_HISTORY.push(structuredClone(S.routine));
  S.routine=RUT_REDO.pop();
  await Promise.all(Object.keys(S.routine).map(wd=>persistDay(+wd)));
  renderRutina();
  toast('Rehecho',{actionLabel:'Deshacer',actionAct:'rut-undo'});
}
```

- [ ] **Step 3: Registrar `rut-undo`/`rut-redo` en el `ACT` map, y limpiar el historial al salir del editor y al guardar (index.html:2831-2832, 2836)**

```js
  'rut-undo':()=>undoRutina(),
  'rut-redo':()=>redoRutina(),
  'rut-view':()=>{S.rutMode='view';RUT_HISTORY=[];RUT_REDO=[];renderRutina();scrollTo({top:0,behavior:'instant'});},
```

Dentro de `doSave` en `ACT['lib-save-confirm']` (Task 1), agregar `RUT_HISTORY=[];RUT_REDO=[];` justo antes de `closeSheet();renderRutina();`.

- [ ] **Step 4: Llamar `pushHistory` antes de cada mutación destructiva/de reordenamiento**

`ex-del` (index.html:2821-2827) — se quita el `confirm()`, ya no hace falta con deshacer disponible:
```js
  'ex-del':async b=>{
    const wd=+b.dataset.wd,d=S.routine[wd];
    const ex=d.exercises.find(e=>e.id===b.dataset.ex);
    if(!ex)return;
    pushHistory(`"${ex.name}" eliminado`);
    d.exercises=d.exercises.filter(e=>e.id!==b.dataset.ex);
    await persistDay(wd);renderRutina();
  },
```

`moveEx` (index.html:3026-3034):
```js
async function moveEx(wd,exId,dir){
  const d=S.routine[wd];
  const i=d.exercises.findIndex(e=>e.id===exId);
  const j=i+dir;
  if(i<0||j<0||j>=d.exercises.length)return;
  pushHistory('Ejercicios reordenados');
  [d.exercises[i],d.exercises[j]]=[d.exercises[j],d.exercises[i]];
  await persistDay(wd);
  flipSort(()=>renderRutina());
}
```

`commitSort`, rama de ejercicios (index.html:2620-2630), agregar `pushHistory` antes de reordenar:
```js
async function commitSort(kind,wd,ids){
  if(kind==='hoy')return setExOrder(currentDayForHoy(),ids);
  const d=S.routine[+wd];
  if(!d||!d.exercises)return;
  pushHistory('Ejercicios reordenados');
  const by=new Map(d.exercises.map(e=>[e.id,e]));
  const out=[];
  ids.forEach(i=>{if(by.has(i)){out.push(by.get(i));by.delete(i);}});
  by.forEach(e=>out.push(e));
  d.exercises=out;
  return persistDay(+wd);
}
```

`day-del` (Task 2, Step 6) — agregar `pushHistory` como primera línea del cuerpo:
```js
  'day-del':async b=>{
    const wd=+b.dataset.wd,d=S.routine[wd];
    if(!d?.name&&!d?.exercises?.length)return;
    pushHistory('Día vaciado');
    S.routine[wd]={weekday:wd,name:'',exercises:[]};
    await persistDay(wd);
    renderRutina();
  },
```

`dragEnd`, rama `kind==='days'` (Task 2, Step 5) — agregar `pushHistory` antes del `setTimeout`:
```js
  if(kind==='days'){
    pushHistory('Días intercambiados');
    setTimeout(async()=>{ await swapDayContents(ids); clean(); renderRutina(); },300);
    return;
  }
```

- [ ] **Step 5: Verificar en el navegador (skill `run`)**

- Borrar un ejercicio: aparece el toast "'X' eliminado · Deshacer" (ya no aparece ningún `confirm()` nativo). Tocar "Deshacer" restaura el ejercicio y muestra "Deshecho · Rehacer".
- Tocar "Rehacer" en ese segundo toast vuelve a borrar el ejercicio.
- Repetir la prueba con: reordenar ejercicios con las flechas ↑↓, arrastrar un ejercicio, vaciar un día, e intercambiar dos días — en los 4 casos debe aparecer el toast con "Deshacer" y funcionar.
- Salir del editor (Listo) y volver a entrar: confirmar que "Deshacer" ya no tiene efecto sobre acciones de antes de salir (el historial se vació).
- Hacer más de 20 acciones seguidas y confirmar que la app no acumula memoria de forma descontrolada (el stack se recorta a 20).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add undo/redo history to the routine editor, remove now-redundant delete confirm"
```

---

## Fase B — Progreso

### Task 4: `drawChart` — eje X por fecha real, unidad en eje Y, tooltip al tocar

**Files:**
- Modify: `index.html:2206-2257` (`drawChart`)
- Modify: `index.html:2172-2178` (llamadas a `drawChart` en `renderProg`)
- Modify: `index.html:1871-1884` (`exerciseSeries`) — agrega `w`/`r` del set ganador

**Interfaces:**
- Produces: `drawChart(cv, pts, opts)` donde `pts:{date:'YYYY-MM-DD', y:Number, r?:Number}[]` (antes era `{label,y}[]`) y `opts:{unit?:String}`.
- Produces: `pickChartPoint(cv, clientX)` — usado por el listener de tap.
- Modifies: `exerciseSeries()` — cada punto pasa a ser `{date, best, maxW, w, r}` (agrega `w`/`r`, no quita nada existente).

- [ ] **Step 1: Agregar `w`/`r` del set ganador en `exerciseSeries` (index.html:1871-1884)**

```js
function exerciseSeries(){
  // nombre -> [{date, best(vol), maxW, w, r}] ascendente
  const map={};
  [...S.sessions].sort((a,b)=>a.start-b.start).forEach(s=>{
    (s.entries||[]).forEach(e=>{
      let best=0,maxW=0,bestSet=null;
      e.sets.forEach(st=>{
        if(st.w*st.r>best){best=st.w*st.r;bestSet=st;}
        maxW=Math.max(maxW,st.w);
      });
      if(!best)return;
      const key=e.name.trim();
      (map[key]=map[key]||[]).push({date:s.date,best,maxW,w:bestSet.w,r:bestSet.r});
    });
  });
  return map;
}
```

- [ ] **Step 2: Reescribir `drawChart` con eje temporal, unidad y selección de punto (index.html:2206-2257)**

```js
const CHART_SEL=new Map();
function drawChart(cv,pts,opts={}){
  const dpr=devicePixelRatio||1;
  const W=cv.clientWidth||300,H=cv.clientHeight||200;
  cv.width=W*dpr;cv.height=H*dpr;
  const x=cv.getContext('2d');x.scale(dpr,dpr);
  x.clearRect(0,0,W,H);
  if(pts.length<2){
    x.fillStyle='#5C6885';x.font='500 14px Barlow, sans-serif';x.textAlign='center';
    x.fillText(pts.length?'Registra al menos 2 puntos para ver la curva':'Sin datos todavía',W/2,H/2);
    cv._pts=null;
    return;
  }
  const P={l:46,r:16,t:24,b:26};
  const ys=pts.map(p=>p.y);
  let mn=Math.min(...ys),mx=Math.max(...ys);
  if(mn===mx){mn-=1;mx+=1;}
  const padY=(mx-mn)*.14;mn-=padY;mx+=padY;
  const t0=+new Date(pts[0].date+'T00:00:00'),t1=+new Date(pts[pts.length-1].date+'T00:00:00');
  const span=t1-t0||1;
  const X=d=>P.l+(W-P.l-P.r)*((+new Date(d+'T00:00:00'))-t0)/span;
  const Y=v=>P.t+(H-P.t-P.b)*(1-(v-mn)/(mx-mn));
  if(opts.unit){x.font='600 10px Barlow, sans-serif';x.fillStyle='#8B97B4';x.textAlign='left';x.fillText(opts.unit,2,12);}
  x.font='500 11px Barlow, sans-serif';
  x.strokeStyle='rgba(120,150,220,.13)';x.lineWidth=1;
  for(let i=0;i<=3;i++){
    const v=mn+(mx-mn)*i/3,y=Y(v);
    x.beginPath();x.moveTo(P.l,y);x.lineTo(W-P.r,y);x.stroke();
    x.fillStyle='#6B7A99';x.textAlign='right';x.fillText(fmtNum(round1(v)),P.l-8,y+4);
  }
  x.textAlign='center';x.fillStyle='#6B7A99';
  x.fillText(fmtD(pts[0].date),Math.max(P.l+16,X(pts[0].date)),H-8);
  x.fillText(fmtD(pts[pts.length-1].date),Math.min(W-P.r-16,X(pts[pts.length-1].date)),H-8);
  const g=x.createLinearGradient(0,P.t,0,H-P.b);
  g.addColorStop(0,'rgba(62,150,255,.32)');g.addColorStop(1,'rgba(62,150,255,0)');
  x.beginPath();
  pts.forEach((p,i)=>{const px=X(p.date);i?x.lineTo(px,Y(p.y)):x.moveTo(px,Y(p.y));});
  x.lineTo(X(pts[pts.length-1].date),H-P.b);x.lineTo(X(pts[0].date),H-P.b);x.closePath();
  x.fillStyle=g;x.fill();
  x.beginPath();
  pts.forEach((p,i)=>{const px=X(p.date);i?x.lineTo(px,Y(p.y)):x.moveTo(px,Y(p.y));});
  x.strokeStyle='#3E96FF';x.lineWidth=2.5;x.lineJoin='round';x.lineCap='round';
  x.shadowColor='rgba(62,150,255,.5)';x.shadowBlur=8;
  x.stroke();x.shadowBlur=0;
  const selIdx=Math.min(CHART_SEL.get(cv)??pts.length-1,pts.length-1);
  pts.forEach((p,i)=>{
    const sel=i===selIdx,px=X(p.date);
    x.beginPath();x.arc(px,Y(p.y),sel?4.5:3,0,7);
    x.fillStyle=sel?'#8FC2FF':'#3E96FF';x.fill();
  });
  const sp=pts[selIdx],spx=X(sp.date);
  x.strokeStyle='rgba(143,194,255,.4)';x.lineWidth=5;
  x.beginPath();x.arc(spx,Y(sp.y),8,0,7);x.stroke();
  const valTxt=`${fmtNum(sp.y)}${opts.unit?' '+opts.unit:''}${sp.r?' × '+sp.r:''}`;
  x.fillStyle='#EAF0FC';x.font='700 13px "Barlow Condensed", sans-serif';x.textAlign='center';
  x.fillText(`${fmtD(sp.date)} · ${valTxt}`,spx,Math.max(14,Y(sp.y)-14));
  cv._pts=pts;cv._X=X;
}
function pickChartPoint(cv,clientX){
  const pts=cv._pts,X=cv._X;if(!pts||!X)return;
  const rect=cv.getBoundingClientRect();
  const px=clientX-rect.left;
  let best=0,bd=Infinity;
  pts.forEach((p,i)=>{const d=Math.abs(X(p.date)-px);if(d<bd){bd=d;best=i;}});
  CHART_SEL.set(cv,best);
}
addEventListener('click',e=>{
  const cv=e.target.closest?.('canvas.chart');
  if(!cv||!cv._pts)return;
  pickChartPoint(cv,e.clientX);
  drawChart(cv,cv._pts,cv._opts||{});
});
```

- [ ] **Step 3: Actualizar las llamadas a `drawChart` en `renderProg` para pasar `{date,y,r}` y `opts.unit` (index.html:2172-2178)**

```js
  el.innerHTML=h;
  const wpts=weights.map(b=>({date:b.date,y:round1(b.weight)}));
  const cw=$('#chartWeight');if(cw){cw._opts={unit:'kg'};drawChart(cw,wpts,cw._opts);}
  if(S.progEx){
    const pts=(series[S.progEx]||[]).map(p=>({date:p.date,y:Math.round(p.w),r:p.r}));
    const ce=$('#chartEx');if(ce){ce._opts={unit:'kg'};drawChart(ce,pts,ce._opts);}
  }
```

- [ ] **Step 4: Verificar en el navegador (skill `run`)**

- En Progreso, con al menos 2 registros de peso separados por varios días, confirmar que el espacio entre puntos en el gráfico es proporcional al tiempo real (no a la cantidad de puntos).
- Confirmar que aparece "kg" arriba a la izquierda del gráfico en ambos gráficos.
- Tocar distintos puntos del gráfico y confirmar que el texto sobre el punto muestra la fecha y el valor exacto de ESE punto (y en el de progresión de carga, también las reps).
- Cambiar de ejercicio en el selector de "Progresión de carga" y confirmar que el gráfico se redibuja con el punto más reciente seleccionado por defecto.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: time-proportional chart axis, unit label and tap-to-inspect tooltip"
```

---

### Task 5: Filtro de rango (1M/3M/6M/Todo)

**Files:**
- Modify: `index.html:2038-2178` (`renderProg`)

**Interfaces:**
- Consumes: `drawChart(cv,pts,opts)` de Task 4.
- Produces: `S.progRange` (`'1m'|'3m'|'6m'|'all'`, default `'all'`), `ACT['prog-range']`, `filterByRange(pts, range)`.

- [ ] **Step 1: Agregar `filterByRange`, junto a `weeklyAvg`/`exerciseSeries` (index.html:~1870)**

```js
const RANGE_DAYS={'1m':30,'3m':90,'6m':180};
function filterByRange(pts,range){
  if(!range||range==='all')return pts;
  const cutoff=Date.now()-RANGE_DAYS[range]*86400000;
  return pts.filter(p=>+new Date(p.date+'T00:00:00')>=cutoff);
}
```

- [ ] **Step 2: Chips de rango dentro de la tarjeta "hero", antes del `<canvas id="chartWeight">` (index.html:2067)**

```js
    <div class="seg" style="margin-top:12px">
      ${[['1m','1M'],['3m','3M'],['6m','6M'],['all','Todo']].map(([r,label])=>
        `<button data-act="prog-range" data-r="${r}" class="${(S.progRange||'all')===r?'on':''}">${label}</button>`).join('')}
    </div>
    <div style="margin-top:12px"><canvas class="chart" id="chartWeight"></canvas></div>
```

- [ ] **Step 3: Aplicar el filtro a ambos gráficos en `renderProg` (index.html:2173-2178, ya editado por Task 4)**

```js
  const wpts=filterByRange(weights.map(b=>({date:b.date,y:round1(b.weight)})),S.progRange);
  const cw=$('#chartWeight');if(cw){cw._opts={unit:'kg'};drawChart(cw,wpts,cw._opts);}
  if(S.progEx){
    const pts=filterByRange((series[S.progEx]||[]).map(p=>({date:p.date,y:Math.round(p.w),r:p.r})),S.progRange);
    const ce=$('#chartEx');if(ce){ce._opts={unit:'kg'};drawChart(ce,pts,ce._opts);}
  }
```

- [ ] **Step 4: `ACT['prog-range']`, junto a `ACT['prog-ex']` (index.html:3004-3005 usa `data-chg`, este usa `data-act`; agregar cerca del resto de acciones de Progreso)**

```js
  'prog-range':b=>{S.progRange=b.dataset.r;renderProg();},
```

- [ ] **Step 5: Verificar en el navegador (skill `run`)**

- Tocar cada chip (1M/3M/6M/Todo) y confirmar que ambos gráficos (peso y progresión de carga) muestran solo los puntos dentro de ese rango, y que el chip activo queda resaltado.
- Con "1M" activo y menos de 2 puntos en ese rango, confirmar que se muestra el mensaje "Registra al menos 2 puntos…" en vez de un gráfico roto.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add date-range filter chips to progress charts"
```

---

### Task 6: Tabs internos en Progreso (Carga / 1RM / Volumen)

**Files:**
- Modify: `index.html:2038-2178` (`renderProg`)

**Interfaces:**
- Produces: `S.progTab` (`'carga'|'1rm'|'volumen'`, default `'carga'`), `ACT['prog-tab']`.

- [ ] **Step 1: Insertar el selector de pestañas después de la tarjeta "hero" y antes de "Progresión de carga" (index.html:2073-2075)**

Reemplazar:
```js
  h+=`<div class="sect">Progresión de carga</div>`;
```
por:
```js
  const tab=S.progTab||'carga';
  h+=`<div class="seg" style="margin:var(--s3) 0">
    ${[['carga','Carga'],['1rm','1RM'],['volumen','Volumen']].map(([k,label])=>
      `<button data-act="prog-tab" data-t="${k}" class="${tab===k?'on':''}">${label}</button>`).join('')}
  </div>`;
```

- [ ] **Step 2: Envolver cada bloque existente en un `if(tab===...)` (index.html:2075-2126, sin cambiar el contenido interno de cada bloque)**

```js
  if(tab==='carga'){
    if(!exNames.length){
      h+=`<div class="card"><div class="empty" style="padding:18px"><p style="margin:0">Completa sesiones para ver la progresión<br>de tu mejor serie (peso × reps).</p></div></div>`;
    }else{
      h+=`<div class="card">
        <div class="field" style="margin-bottom:10px"><select data-chg="prog-ex">
          ${exNames.map(n=>`<option ${n===S.progEx?'selected':''}>${esc(n)}</option>`).join('')}
        </select></div>
        <canvas class="chart" id="chartEx"></canvas>
        <div class="txt-mut" style="font-size:12px;text-align:center;margin-top:6px">Mejor serie por sesión · peso × reps (kg)</div>
      </div>`;
    }
  }

  if(tab==='1rm'){
    const readout=strengthReadout();
    h+=`<div class="sect">Fuerza · 1RM estimado</div>`;
    if(!readout.length){
      h+=`<div class="card sub"><div class="empty" style="padding:18px"><p style="margin:0">Registrá un ejercicio en dos sesiones para empezar a ver su tendencia.</p></div></div>`;
    }else{
      /* ... contenido existente sin cambios ... */
    }
  }

  if(tab==='volumen'){
    const mv=muscleVolume(7),cats=Object.entries(mv).sort((a,b)=>b[1]-a[1]);
    if(cats.length){
      /* ... contenido existente sin cambios ... */
    }
  }
```

(El contenido interno de cada `if` es exactamente el HTML que hoy generan esas secciones — solo se mueve dentro de la condición, no se reescribe.)

- [ ] **Step 3: `ACT['prog-tab']`, junto a `ACT['prog-range']` de Task 5**

```js
  'prog-tab':b=>{S.progTab=b.dataset.t;renderProg();},
```

- [ ] **Step 4: Ajustar el llamado a `drawChart` del gráfico de ejercicio para que solo ocurra si `tab==='carga'` (index.html, bloque final de `renderProg`)**

```js
  el.innerHTML=h;
  const wpts=filterByRange(weights.map(b=>({date:b.date,y:round1(b.weight)})),S.progRange);
  const cw=$('#chartWeight');if(cw){cw._opts={unit:'kg'};drawChart(cw,wpts,cw._opts);}
  if(tab==='carga'&&S.progEx){
    const pts=filterByRange((series[S.progEx]||[]).map(p=>({date:p.date,y:Math.round(p.w),r:p.r})),S.progRange);
    const ce=$('#chartEx');if(ce){ce._opts={unit:'kg'};drawChart(ce,pts,ce._opts);}
  }
```

- [ ] **Step 5: Verificar en el navegador (skill `run`)**

- Entrar a Progreso: el peso corporal sigue visible arriba sin cambios; debajo aparecen las 3 pestañas.
- Cambiar entre pestañas y confirmar que solo se muestra un bloque a la vez (Carga / 1RM / Volumen), sin necesidad de scrollear los tres.
- Confirmar que cambiar de pestaña no rompe el gráfico de progresión de carga al volver a la pestaña "Carga".

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: tabbed sections in Progreso to reduce vertical scroll"
```

---

## Fase C — Datos de demo más realistas

### Task 7: Sesiones con variación humana, ventana de ~1 mes

**Files:**
- Modify: `index.html:2313-2345` (`SEED_WEEKS`, `seedSessions`)

**Interfaces:**
- Modifies: `seedSessions()` — misma firma (sin argumentos, retorna array de sesiones), pero con menos sesiones y valores con ruido.

- [ ] **Step 1: Reducir la ventana y agregar variación humana en `seedSessions` (index.html:2313-2345)**

```js
const SEED_WEEKS=5, SEED_REF=2;   // ~1 mes; los pesos anotados corresponden a hace 2 semanas

function seedSessions(){
  const out=[];
  const today=new Date();today.setHours(0,0,0,0);
  Object.keys(SEED_SPLIT).forEach(k=>{
    const wd=+k,[dayName,list]=SEED_SPLIT[wd];
    const exs=S.routine[wd].exercises;
    const iRef=SEED_WEEKS-1-SEED_REF;
    for(let i=0;i<SEED_WEEKS;i++){
      /* día salteado de tanto en tanto (ocupado/enfermo) — nunca la semana más reciente */
      if(i<SEED_WEEKS-1&&Math.random()<0.15)continue;
      const back=(SEED_WEEKS-1-i)*7+((today.getDay()-wd+7)%7);
      const d=new Date(today);d.setDate(today.getDate()-back);
      if(d>today)continue;
      const cyc=i%3, reps=[6,7,9][cyc];
      /* 20% de las semanas queda "en meseta": un escalón atrás del progreso esperado */
      const stepBase=Math.floor(i/3)-Math.floor(iRef/3);
      const step=Math.random()<0.2?Math.max(0,stepBase-1):stepBase;
      const entries=exs.map((ex,n)=>{
        const [,,,wRec,inc]=list[n];
        const noise=(Math.random()-0.5)*inc;
        const w=Math.max(inc,Math.round((wRec+step*inc+noise)/(inc/2))*(inc/2));
        const sets=[];
        for(let sN=0;sN<ex.sets;sN++)sets.push({w,r:sN?Math.max(5,reps-1):reps,t:d.getTime()});
        return {exId:ex.id,name:ex.name,sets};
      });
      const nsets=entries.reduce((a,e)=>a+e.sets.length,0);
      const dur=Math.round(nsets*2.9+8);
      const start=new Date(d);start.setHours(6,0,0,0);
      out.push({id:uid(),date:dstr(d),weekday:wd,dayName,seed:true,
        start:start.getTime(),end:start.getTime()+dur*60000,duration:dur,entries});
    }
  });
  return out.sort((a,b)=>b.start-a.start);
}
```

- [ ] **Step 2: Verificar en el navegador (skill `run`)**

- Ajustes → "Cargar mi registro" (borrar antes lo cargado si ya había, con "Borrar lo cargado").
- En Progreso, confirmar que la ventana de sesiones cubre ~5 semanas en vez de 8, y que NO todas las semanas tienen exactamente la misma sesión para un mismo día (algunas faltan, los pesos varían levemente entre semanas de la misma posición del ciclo).
- Confirmar que la sesión más reciente (última semana) siempre está presente.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: shrink demo session window to ~1 month and add human variance"
```

---

### Task 8: Comidas generadas para toda la ventana de demo

**Files:**
- Modify: `index.html:2260-2386` (nueva función `genMealsForDay`, cambios en `seedRegistro`)

**Interfaces:**
- Produces: `genMealsForDay(date, goals)` → array de `[name,kcal,p,c,f,t]` (mismo shape que las filas de `SEED_MEALS`).
- Modifies: `seedRegistro()` — reordena la asignación de `S.cfg.goals` para que ocurra antes del loop de comidas, y agrega comidas generadas para los días de la ventana que `SEED_MEALS` no cubre.

- [ ] **Step 1: Agregar `MEAL_POOL` y `genMealsForDay`, junto a `SEED_MEALS` (index.html:2298-2309)**

```js
const MEAL_POOL=[
  ['Desayuno',480,28,58,15],['Pollo + arroz',530,45,58,16],['Milanesa',720,42,78,26],
  ['Ensalada + pollo',380,38,20,14],['Yogurt + fruta',260,18,38,4],
  ['Arroz tapado',860,44,106,28],['Spaghetti',800,35,116,22],['Snack proteico',230,20,28,4],
];
function genMealsForDay(date,goals){
  const roll=Math.random();
  if(roll<0.08){
    const big=MEAL_POOL[Math.floor(Math.random()*MEAL_POOL.length)];
    return [[big[0]+' (día libre)',Math.round(goals.kcal*1.3),Math.round(goals.p*.6),Math.round(goals.c*1.4),Math.round(goals.f*1.5),'13:30']];
  }
  const n=roll<0.15?2:4;
  const picks=[...MEAL_POOL].sort(()=>Math.random()-0.5).slice(0,n);
  const times=['07:30','13:00','17:00','20:30'];
  const scale=(goals.kcal/n)/500;
  return picks.map((m,i)=>{
    const jitter=0.88+Math.random()*0.24;
    const f=scale*jitter;
    return [m[0],Math.round(m[1]*f),Math.round(m[2]*f),Math.round(m[3]*f),Math.round(m[4]*f),times[i]||'20:00'];
  });
}
```

- [ ] **Step 2: Mover la asignación de `S.cfg.goals` antes del loop de comidas y generar las comidas faltantes, en `seedRegistro` (index.html:2346-2376)**

```js
async function seedRegistro(){
  for(const wd in SEED_SPLIT){
    const [name,list]=SEED_SPLIT[wd];
    S.routine[wd]={weekday:+wd,name,seed:true,
      exercises:list.map(([n,st,r])=>({id:uid(),name:n,sets:st,reps:r}))};
    await persistDay(+wd);
  }
  for(const s of seedSessions()){await idb.put('sessions',s);S.sessions.push(s);}
  S.sessions.sort((a,b)=>b.start-a.start);

  S.cfg.goals={kcal:1950,p:140,c:201,f:65};
  S.cfg.goalsAuto=false;

  for(const date in SEED_MEALS)
    for(const [name,kcal,p,c,f,t] of SEED_MEALS[date]){
      const m={id:uid(),date,name,kcal,p,c,f,t,seed:true};
      await idb.put('meals',m);S.meals.push(m);
    }
  const windowStart=new Date();windowStart.setDate(windowStart.getDate()-SEED_WEEKS*7);
  for(let d=new Date(windowStart);d<=new Date();d.setDate(d.getDate()+1)){
    const ds=dstr(d);
    if(SEED_MEALS[ds])continue;
    for(const [name,kcal,p,c,f,t] of genMealsForDay(ds,S.cfg.goals)){
      const m={id:uid(),date:ds,name,kcal,p,c,f,t,seed:true};
      await idb.put('meals',m);S.meals.push(m);
    }
  }

  for(const [date,weight,waist,arm] of SEED_BODY){
    const b={id:uid(),date,weight,waist:waist??null,arm:arm??null,chest:null,leg:null,seed:true};
    await idb.put('body',b);S.body.push(b);
  }
  S.body.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  S.cfg.profile.weightKg=74;
  S.cfg.rest=180;
  S.cfg.routineName='Anterior / Posterior';
  await saveCfg();
  S.lib=S.lib.filter(r=>r.name!=='Anterior / Posterior');
  S.lib.unshift({id:uid(),name:'Anterior / Posterior',days:routineSnapshot(),savedAt:dstr()});
  await saveLib();
}
```

- [ ] **Step 3: Verificar en el navegador (skill `run`)**

- Cargar el demo y abrir Nutrición: recorrer varios días de las últimas ~5 semanas y confirmar que TODOS tienen comidas (no solo la semana del 13-18 jul), con macros variando día a día alrededor de la meta (1950 kcal), y que aparece ocasionalmente un día con una sola comida grande ("día libre").
- Confirmar que "Borrar lo cargado" en Ajustes borra también estas comidas generadas (todas quedan con `seed:true`).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: generate a full month of demo meals with natural variance"
```

---

### Task 9: Peso corporal con cadencia realista

**Files:**
- Modify: `index.html:2310-2312` (uso de `SEED_BODY` en `seedRegistro`)

**Interfaces:**
- Produces: `genBodyForWindow()` → array con el mismo shape que `SEED_BODY` (`[date,weight,waist?,arm?]`), incluyendo los puntos reales anotados sin modificarlos.

- [ ] **Step 1: Agregar `genBodyForWindow`, junto a `SEED_BODY` (index.html:2310-2312)**

```js
function genBodyForWindow(){
  const anchors=SEED_BODY.map(([date,weight,waist,arm])=>({t:+new Date(date+'T00:00:00'),weight,waist,arm}));
  const out=[...SEED_BODY];
  const start=anchors[0].t,end=anchors[anchors.length-1].t;
  for(let t=start;t<=end;t+=2*86400000){
    if(anchors.some(a=>Math.abs(a.t-t)<86400000))continue;
    let lo=anchors[0],hi=anchors[anchors.length-1];
    for(let i=0;i<anchors.length-1;i++)if(anchors[i].t<=t&&t<=anchors[i+1].t){lo=anchors[i];hi=anchors[i+1];break;}
    const frac=hi.t===lo.t?0:(t-lo.t)/(hi.t-lo.t);
    const base=lo.weight+(hi.weight-lo.weight)*frac;
    const noise=(Math.random()-0.5)*0.8;
    out.push([dstr(new Date(t)),Math.round((base+noise)*10)/10]);
  }
  return out.sort((a,b)=>a[0]<b[0]?-1:1);
}
```

- [ ] **Step 2: Usar `genBodyForWindow()` en vez de `SEED_BODY` dentro de `seedRegistro` (parte del bloque de Task 8, Step 2)**

```js
  for(const [date,weight,waist,arm] of genBodyForWindow()){
    const b={id:uid(),date,weight,waist:waist??null,arm:arm??null,chest:null,leg:null,seed:true};
    await idb.put('body',b);S.body.push(b);
  }
```

- [ ] **Step 3: Verificar en el navegador (skill `run`)**

- Cargar el demo y abrir Progreso: el gráfico de peso corporal muestra varios puntos por semana (no solo uno), con pequeñas subidas y bajadas día a día, siguiendo la tendencia de los puntos reales anotados (que siguen apareciendo exactos, sin ruido, en sus fechas originales).
- Confirmar que `weeklyAvg()` (el promedio semanal mostrado arriba de "Progreso") sigue calculando un número razonable con esta mayor densidad de datos.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: generate realistic day-to-day bodyweight noise for demo data"
```

---

## Self-Review

**Cobertura del spec:** Sección 1 (días) → Task 2. Sección 2 (undo/redo) → Task 3. Sección 3 (modales) → Task 1. Sección 4 (ejes/tooltip) → Task 4. Sección 4 (filtro de rango) → Task 5. Sección 5 (tabs) → Task 6. Sección 6 (demo) → Tasks 7-9. Los 6 puntos del spec tienen tarea asignada.

**Consistencia de tipos:** `pts` pasa de `{label,y}` a `{date,y,r?}` de forma consistente entre Task 4 (definición) y Tasks 5-6 (todas las llamadas a `drawChart`/`filterByRange` usan `date`, no `label`). `activeDayWds()` se define en Task 2 y no se vuelve a redefinir. `swapDayContents` tiene la misma firma en Task 2 (definición) y Task 3 (uso en `dragEnd`).

**Corrección de terminología:** el spec original decía que el toast debía ofrecer "Rehacer" inmediatamente después de una acción — es un error de nomenclatura (esa acción se deshace, no se rehace). El plan usa "Deshacer" en el primer toast y "Rehacer" solo en el toast posterior a un deshacer, que es el comportamiento realmente descrito.
