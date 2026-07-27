# Rediseño visual + funcionalidades nuevas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the visual language of the `fierro-rediseno.html` mockup (dark glass, blue/cyan accents, Barlow/Barlow Condensed, new motion) onto the real FIERRO app, and add the genuinely new features it demonstrates — streak tracking, a session-recap sheet with confetti, a full-screen/minimizable rest timer, a horizontal exercise carousel with a drag-to-reorder modal, one-tap nutrition quick-add chips, and a weekly muscle-volume card — without touching any existing data logic.

**Architecture:** Everything lives in the single `index.html` file (vanilla JS, IndexedDB via `idb`, global state `S`, event dispatch via `data-act` + the `ACT` map, render functions `renderHoy`/`renderRutina`/`renderNutri`/`renderProg`). No build step, no frameworks. Each task below is a set of precise find-and-replace edits against the current file content (use the Edit tool — locate by the exact `old_string`, not by line number, since line numbers shift as earlier tasks land). Tasks run in the given order because several later tasks depend on CSS variables, keyframes, or DOM ids introduced by earlier ones (see each task's **Interfaces**).

**Tech Stack:** HTML5, vanilla ES2020+ JS, CSS (custom properties, `backdrop-filter`, SVG `stroke-dashoffset` rings, `scroll-snap`), IndexedDB. No new dependencies of any kind.

## Global Constraints

- Single file: everything is a `Modify: index.html` edit. Do not create new files or a build step.
- Never change the shape or names of `S`, `idb`, `ACT`, or any existing `data-act` value that other code still calls — only add new `S` fields / `ACT` entries, or remove an entry in the same task that removes its last caller.
- Reuse the existing `[data-sort] > [data-sid]` drag mechanism (`dragPick`/`dragStart`/`dragMove`/`dragEnd`/`commitSort` around line 2660-2820) as-is. Never reimplement drag physics.
- No new libraries: confetti, rings, and all animation are hand-rolled CSS/SVG/vanilla JS.
- All new user-facing copy is in Spanish, matching the existing tone (informal "vos", sentence case, no title case).
- This project has no automated test suite. Verify every task by actually running the app in a browser (see each task's Verify step) — static analysis or Node-only checks are not acceptable substitutes. Serve the app with `python -m http.server 8000` from the repo root and drive it with Playwright/`chromium-cli` per the `run` skill.
- Streak heatmap window: the spec says both "12 semanas" and "56 días", which are inconsistent (12×7=84≠56). This plan resolves it to **56 days (8 weeks)** — use that number everywhere streak history is computed.
- Commit messages follow this repo's existing convention: `type: short imperative description` (see `git log`), e.g. `feat: add streak tracking with heatmap sheet`.

---

### Task 1: Visual foundation — tokens, glassmorphism, new keyframes

**Files:**
- Modify: `index.html` (the `<style>` block, roughly lines 22-514 in the current file)

**Interfaces:**
- Produces (consumed by later tasks): CSS custom properties `--cyan`, `--grad2`, `--glass-blur`, `--glass-border`, `--glass-hi`; keyframes `@keyframes zoom`, `@keyframes sweep`, `@keyframes rise`, `@keyframes glowring`, `@keyframes flash` (in addition to the pre-existing `vin`, `pop`, `slideR/L`, `fdin`, `shup`, `pulse`, which are untouched).
- No JS changes in this task.

- [ ] **Step 1: Extend the `:root` token block — cyan accent + glass tokens + darker background**

Find:
```css
:root{
  --bg:#05070D;
  --bg2:#0A0F1A;
  --card:#0C1322;
  --card2:#111B30;
  --line:rgba(102,145,255,.10);
  --line2:rgba(102,145,255,.20);
  --txt:#EAF0FC;
  --mut:#8B97B4;
  --mut2:#5C6885;
  --blue:#2E7DFF;
  --blue2:#5EA2FF;
  --blue3:#8FC2FF;
  --grad:linear-gradient(135deg,#1D5CE8 0%,#3E96FF 100%);
  --ok:#2EE6A8;
  --warn:#FFB454;
  --red:#FF5D73;
  --r:18px;
  --tabs-h:64px;
  --glow:0 6px 24px -6px rgba(46,125,255,.45);
```

Replace with:
```css
:root{
  --bg:#04070F;
  --bg2:#0A0F1A;
  --card:#0C1322;
  --card2:#111B30;
  --line:rgba(102,145,255,.10);
  --line2:rgba(102,145,255,.20);
  --txt:#EAF0FC;
  --mut:#8B97B4;
  --mut2:#5C6885;
  --blue:#2E7DFF;
  --blue2:#5EA2FF;
  --blue3:#8FC2FF;
  --cyan:#22D3EE;
  --grad:linear-gradient(135deg,#1D5CE8 0%,#3E96FF 100%);
  --grad2:linear-gradient(112deg,var(--blue2),var(--cyan));
  --ok:#2EE6A8;
  --warn:#FFB454;
  --red:#FF5D73;
  --r:18px;
  --tabs-h:64px;
  --glow:0 6px 24px -6px rgba(46,125,255,.45);
  --glass-blur:blur(22px) saturate(1.5);
  --glass-border:rgba(255,255,255,.12);
  --glass-hi:inset 0 1px 0 rgba(255,255,255,.16);
```

- [ ] **Step 2: Add a cyan glow layer to the background atmosphere + soften the noise texture**

Find:
```css
body::before{
  content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;
  background:
    radial-gradient(90% 40% at 50% -5%, rgba(38,98,255,.16), transparent 65%),
    radial-gradient(70% 30% at 100% 100%, rgba(30,70,180,.08), transparent 60%);
}
body::after{
  content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.05;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
}
```

Replace with:
```css
body::before{
  content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;
  background:
    radial-gradient(90% 40% at 50% -5%, rgba(38,98,255,.16), transparent 65%),
    radial-gradient(70% 30% at 100% 100%, rgba(30,70,180,.08), transparent 60%),
    radial-gradient(60% 34% at 100% 100%, rgba(34,211,238,.10), transparent 62%);
}
body::after{
  content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.045;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
}
```

- [ ] **Step 3: Add the new keyframes, right after the reduced-motion media query**

Find:
```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important}
}
```

Replace with:
```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important}
}
/* nuevas animaciones del rediseño: zoom (aparición con rebote), sweep (brillo
   diagonal en botones primarios), rise (barras que crecen desde 0), glowring
   (pulso de foco en el timer), flash (resalte de logro) */
@keyframes zoom{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes sweep{0%,20%{left:-60%}80%,100%{left:130%}}
@keyframes rise{from{width:0}}
@keyframes glowring{0%,100%{filter:drop-shadow(0 0 6px rgba(34,211,238,.35))}50%{filter:drop-shadow(0 0 18px rgba(34,211,238,.7))}}
@keyframes flash{0%,100%{background-color:transparent}50%{background-color:rgba(46,125,255,.14)}}
```

- [ ] **Step 4: Glassmorphism on `.card` / `.card.hero`**

Find:
```css
.card{
  background:linear-gradient(180deg,var(--card),rgba(12,19,34,.6));
  border:1px solid var(--line);border-radius:var(--r);
  padding:var(--s4);margin-bottom:var(--s3);
}
.card.hero{
  background:linear-gradient(140deg,#0E1730 0%,#0B1220 55%),var(--card);
  border-color:var(--line2);
  position:relative;overflow:hidden;
}
```

Replace with:
```css
.card{
  background:linear-gradient(180deg,var(--card),rgba(12,19,34,.6));
  border:1px solid var(--glass-border);border-radius:var(--r);
  padding:var(--s4);margin-bottom:var(--s3);
  backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);
  box-shadow:var(--glass-hi),0 14px 34px -18px rgba(0,0,0,.6);
}
.card.hero{
  background:linear-gradient(140deg,#0E1730 0%,#0B1220 55%),var(--card);
  border-color:rgba(255,255,255,.16);
  position:relative;overflow:hidden;
}
```

- [ ] **Step 5: `.btn` — cyan-blue gradient + diagonal sweep shine on primary buttons**

Find:
```css
.btn{
  display:flex;align-items:center;justify-content:center;gap:8px;
  width:100%;min-height:52px;border-radius:15px;
  font-family:'Barlow Condensed';font-weight:700;font-size:19px;
  letter-spacing:.09em;text-transform:uppercase;
  background:var(--grad);color:#fff;box-shadow:var(--glow);
  transition:.15s;
}
```

Replace with:
```css
.btn{
  display:flex;align-items:center;justify-content:center;gap:8px;
  width:100%;min-height:52px;border-radius:15px;
  font-family:'Barlow Condensed';font-weight:700;font-size:19px;
  letter-spacing:.09em;text-transform:uppercase;
  background:var(--grad2);color:#fff;box-shadow:var(--glow);
  transition:.15s;position:relative;overflow:hidden;
}
.btn:not(.sm):not(.ghost):not(.dim):not(.danger)::after{
  content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;
  background:linear-gradient(115deg,transparent,rgba(255,255,255,.35),transparent);
  animation:sweep 3.2s ease-in-out infinite;pointer-events:none;
}
```

- [ ] **Step 6: `nav.tabbar` — stronger glass**

Find:
```css
nav.tabbar{
  position:fixed;bottom:0;left:0;right:0;z-index:50;
  display:flex;justify-content:space-around;
  padding:6px 8px calc(6px + env(safe-area-inset-bottom));
  background:rgba(6,9,16,.88);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-top:1px solid var(--line);
}
```

Replace with:
```css
nav.tabbar{
  position:fixed;bottom:0;left:0;right:0;z-index:50;
  display:flex;justify-content:space-around;
  padding:6px 8px calc(6px + env(safe-area-inset-bottom));
  background:rgba(6,9,16,.72);
  backdrop-filter:blur(26px) saturate(1.5);-webkit-backdrop-filter:blur(26px) saturate(1.5);
  border-top:1px solid var(--glass-border);
  box-shadow:var(--glass-hi);
}
```

- [ ] **Step 7: `.tab-ind` — cyan-blue gradient**

Find:
```css
.tab-ind{
  position:absolute;top:0;left:0;width:26px;height:3px;border-radius:2px;
  background:var(--grad);box-shadow:var(--glow);pointer-events:none;
  transform:translateX(-60px) skewX(-20deg);
  transition:transform .38s var(--ease);
}
```

Replace with:
```css
.tab-ind{
  position:absolute;top:0;left:0;width:26px;height:3px;border-radius:2px;
  background:var(--grad2);box-shadow:0 6px 20px -4px rgba(34,211,238,.55);pointer-events:none;
  transform:translateX(-60px) skewX(-20deg);
  transition:transform .38s var(--ease);
}
```

- [ ] **Step 8: `#sheet .panel` — glass**

Find:
```css
#sheet .panel{
  position:absolute;left:0;right:0;bottom:0;max-width:520px;margin:0 auto;
  max-height:88dvh;overflow-y:auto;
  background:linear-gradient(180deg,#0E1626,#0A101C);
  border:1px solid var(--line2);border-bottom:none;
  border-radius:26px 26px 0 0;
  padding:10px 20px calc(24px + env(safe-area-inset-bottom));
  animation:shup .3s cubic-bezier(.2,.8,.3,1);
}
```

Replace with:
```css
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
```

- [ ] **Step 9: Verify in browser**

Serve with `python -m http.server 8000`, open in Playwright/chromium-cli, screenshot all 4 tabs. Confirm: darker background with visible blue+cyan glow and faint grain; cards show frosted-glass blur against the background glow; primary buttons show the blue→cyan gradient with a diagonal shine sweeping across every ~3s; bottom nav and any open sheet show the glass blur; nothing is visually broken (no missing text, no unreadable contrast).

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "feat: add cyan accent, glassmorphism and new keyframes to the design tokens"
```

---

### Task 2: Racha (streak) — calc + header icon + detail sheet

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `S.routine`, `S.sessions`, `dstr()`, `esc()`, `fmtDFull()`, `openSheet()`, the `ACT` map, `render()` (all pre-existing).
- Produces (consumed later only by this task's own UI): `dayCompleted(dateStr)`, `currentStreak()`, `bestStreak()`, `streakHeatmap()` → `{days:[{date,status:'done'|'miss'|'rest'}],pct}`, `updHeaderStreak()`, `sheetStreak()`, `ACT['streak-open']`. `updHeaderStreak()` is called from `render()` so every tab switch keeps the header count fresh.

- [ ] **Step 1: Add the header streak button**

Find:
```html
<header class="top">
  <div class="brand">
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 10v4M6 8v8M9 6v12M15 6v12M18 8v8M21 10v4M9 12h6"/></svg>
    FIERRO
  </div>
  <button class="icon-btn" data-act="settings" aria-label="Ajustes">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>
  </button>
</header>
```

Replace with:
```html
<header class="top">
  <div class="brand">
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 10v4M6 8v8M9 6v12M15 6v12M18 8v8M21 10v4M9 12h6"/></svg>
    FIERRO
  </div>
  <div class="header-actions">
    <button class="icon-btn streak-btn" data-act="streak-open" id="streak-btn" aria-label="Racha">
      <span class="streak-flame">🔥</span><span class="streak-n" id="streak-n">0</span>
    </button>
    <button class="icon-btn" data-act="settings" aria-label="Ajustes">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>
    </button>
  </div>
</header>
```

- [ ] **Step 2: CSS for the header actions group + streak pill + heatmap grid**

Find:
```css
.icon-btn.accent{border-color:var(--blue2);color:var(--blue2);background:rgba(46,125,255,.14)}
.icon-btn.accent:active{background:rgba(46,125,255,.24)}
```

Replace with:
```css
.icon-btn.accent{border-color:var(--blue2);color:var(--blue2);background:rgba(46,125,255,.14)}
.icon-btn.accent:active{background:rgba(46,125,255,.24)}
.header-actions{display:flex;gap:8px;align-items:center}
.streak-btn{width:auto;padding:0 12px;flex-direction:row;gap:6px}
.streak-flame{font-size:17px;line-height:1}
.streak-n{font-family:'Barlow Condensed';font-weight:700;font-size:15px}
.heatmap{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.heatmap .cell{aspect-ratio:1;border-radius:4px;background:var(--card2);border:1px solid var(--line)}
.heatmap .cell.done{background:var(--grad2);border-color:transparent;animation:zoom .3s var(--ease) backwards}
.heatmap .cell.rest{opacity:.28}
.heatmap .cell.miss{background:rgba(255,93,115,.12);border-color:rgba(255,93,115,.3)}
```

- [ ] **Step 3: Streak calculation functions + sheet, added after `completeSession()`'s timer block start**

Find:
```js
/* ================= timer descanso ================= */
const T={end:0,total:0,int:null,audio:null};
```

Replace with:
```js
/* ================= racha ================= */
/* un día "cumplido" necesita rutina asignada Y una sesión guardada esa fecha;
   los días de descanso (sin rutina) no cuentan ni cortan la racha */
function dayCompleted(dateStr){
  const wd=new Date(dateStr+'T12:00:00').getDay();
  if(!S.routine[wd]?.exercises?.length)return null;
  return S.sessions.some(s=>s.date===dateStr);
}
function currentStreak(){
  const todayStr=dstr();
  let n=0,d=new Date(),first=true;
  for(;;){
    const ds=dstr(d);
    const c=dayCompleted(ds);
    if(c===null){d.setDate(d.getDate()-1);first=false;continue;}
    if(c===false){
      if(first&&ds===todayStr){d.setDate(d.getDate()-1);first=false;continue;}
      break;
    }
    n++;d.setDate(d.getDate()-1);first=false;
  }
  return n;
}
function bestStreak(){
  if(!S.sessions.length)return 0;
  const dates=S.sessions.map(s=>s.date);
  let d=new Date(dates.reduce((a,b)=>a<b?a:b)+'T12:00:00');
  const end=new Date();
  let cur=0,best=0;
  while(d<=end){
    const c=dayCompleted(dstr(d));
    if(c===true){cur++;best=Math.max(best,cur);}
    else if(c===false){cur=0;}
    d.setDate(d.getDate()+1);
  }
  return best;
}
function streakHeatmap(){
  const days=[];let done=0,total=0;
  for(let i=55;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=dstr(d);
    const c=dayCompleted(ds);
    if(c!==null){total++;if(c)done++;}
    days.push({date:ds,status:c===null?'rest':c?'done':'miss'});
  }
  return {days,pct:total?Math.round(done/total*100):0};
}
function updHeaderStreak(){
  const el=$('#streak-n');if(el)el.textContent=currentStreak();
}
function sheetStreak(){
  const {days,pct}=streakHeatmap();
  const cur=currentStreak(),best=bestStreak();
  openSheet(`<h2>🔥 Racha</h2>
    <div class="macro3" style="grid-template-columns:repeat(3,1fr);margin-top:-4px">
      <div style="text-align:center"><div class="cond" style="font-size:30px;font-weight:700">${cur}</div><div class="txt-mut" style="font-size:var(--t-micro);letter-spacing:.1em;text-transform:uppercase">Actual</div></div>
      <div style="text-align:center"><div class="cond" style="font-size:30px;font-weight:700">${best}</div><div class="txt-mut" style="font-size:var(--t-micro);letter-spacing:.1em;text-transform:uppercase">Mejor</div></div>
      <div style="text-align:center"><div class="cond" style="font-size:30px;font-weight:700">${pct}%</div><div class="txt-mut" style="font-size:var(--t-micro);letter-spacing:.1em;text-transform:uppercase">Cumplimiento</div></div>
    </div>
    <div class="heatmap" style="margin-top:20px">${days.map((d,i)=>
      `<div class="cell ${d.status}" style="animation-delay:${i*8}ms" title="${fmtDFull(d.date)}"></div>`).join('')}</div>
    <div class="txt-mut" style="font-size:12px;line-height:1.5;margin-top:14px">Últimos 56 días · un día cuenta si tenía rutina asignada y completaste la sesión. Los días de descanso no suman ni cortan la racha.</div>`);
}

/* ================= timer descanso ================= */
const T={end:0,total:0,int:null,audio:null};
```

- [ ] **Step 4: Register the `streak-open` action and refresh the header on every render**

Find:
```js
  'goto-rutina':()=>switchTab('rutina'),
  'settings':()=>sheetSettings(),
```

Replace with:
```js
  'goto-rutina':()=>switchTab('rutina'),
  'streak-open':()=>sheetStreak(),
  'settings':()=>sheetSettings(),
```

Find:
```js
function render(keepScroll){
  const y=keepScroll?scrollY:0;
  if(S.tab==='hoy')renderHoy();
  else if(S.tab==='rutina')renderRutina();
  else if(S.tab==='nutri')renderNutri();
  else if(S.tab==='prog')renderProg();
```

Replace with:
```js
function render(keepScroll){
  const y=keepScroll?scrollY:0;
  if(S.tab==='hoy')renderHoy();
  else if(S.tab==='rutina')renderRutina();
  else if(S.tab==='nutri')renderNutri();
  else if(S.tab==='prog')renderProg();
  updHeaderStreak();
```

- [ ] **Step 5: Verify in browser**

Reload the app. Confirm the 🔥 counter appears in the header next to the gear icon and shows a sensible number (0 on a fresh profile, or a real count if using seeded/demo data — load `?seed` to get sessions). Tap it: a sheet opens with 3 stats (Actual/Mejor/Cumplimiento) and a 7×8 heatmap grid where past workout days are colored (blue-cyan = done, red-tinted = missed, faded = rest day). Complete a workout (or use existing seeded data) and confirm the header count updates after switching tabs.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add streak tracking with header counter and heatmap sheet"
```

---

### Task 3: Session-completion recap sheet + PR detection + confetti

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `completeSession()`'s existing session-building logic (order/entries computation, unchanged), `S.sessions`, `esc()`, `fmtNum()`, `round1()`, `fmtDFull()`, `openSheet()`, the pre-existing `.pr-card`/`.pr-troph`/`.pr-w` CSS classes.
- Produces: `calcSessionPRs(entries)` → `[{name,w,r}]`, `sheetSessionRecap(sess,prs)`, `fireConfetti()`, `ACT['recap-close']`. `completeSession()` now opens this sheet instead of a toast.

- [ ] **Step 1: PR detection + recap sheet + confetti, inserted right after `completeSession()`**

Find:
```js
  await idb.put('sessions',sess);
  S.sessions.unshift(sess);
  S.draft=null;S.hoyDay=null;
  await saveDraft();
  stopRest();
  vibrate([30,50,30]);
  renderHoy();
  toast(`💪 Sesión guardada · ${sess.duration} min`);
}
```

Replace with:
```js
  const prs=calcSessionPRs(entries);
  await idb.put('sessions',sess);
  S.sessions.unshift(sess);
  S.draft=null;S.hoyDay=null;
  await saveDraft();
  stopRest();
  vibrate([30,50,30]);
  renderHoy();
  sheetSessionRecap(sess,prs);
}
/* compara la mejor serie de cada ejercicio de la sesión contra el máximo
   histórico ANTES de esta sesión (S.sessions todavía no la incluye acá) */
function calcSessionPRs(entries){
  const prior=S.sessions;
  const prs=[];
  entries.forEach(e=>{
    if(!e.sets.length)return;
    const bestSet=e.sets.reduce((a,b)=>b.w>a.w?b:a,e.sets[0]);
    let prevMax=0;
    prior.forEach(s=>(s.entries||[]).forEach(pe=>{
      if(pe.name.trim()!==e.name.trim())return;
      pe.sets.forEach(st=>{if(st.w>prevMax)prevMax=st.w;});
    }));
    if(bestSet.w>prevMax)prs.push({name:e.name,w:bestSet.w,r:bestSet.r});
  });
  return prs;
}
function sheetSessionRecap(sess,prs){
  const nsets=sess.entries.reduce((a,e)=>a+e.sets.length,0);
  const vol=sess.entries.reduce((a,e)=>a+e.sets.reduce((b,s)=>b+s.w*s.r,0),0);
  const hasPR=prs.length>0;
  openSheet(`<h2>${hasPR?'🎉 ':'💪 '}Sesión guardada</h2>
    <div class="txt-mut" style="margin:-8px 0 16px;font-size:14px">${esc(sess.dayName||WD[sess.weekday])} · ${fmtDFull(sess.date)}</div>
    <div class="macro3" style="grid-template-columns:repeat(4,1fr)">
      <div style="text-align:center"><div class="cond" style="font-size:26px;font-weight:700">${sess.duration}</div><div class="txt-mut" style="font-size:var(--t-micro);letter-spacing:.08em;text-transform:uppercase">Min</div></div>
      <div style="text-align:center"><div class="cond" style="font-size:26px;font-weight:700">${nsets}</div><div class="txt-mut" style="font-size:var(--t-micro);letter-spacing:.08em;text-transform:uppercase">Series</div></div>
      <div style="text-align:center"><div class="cond" style="font-size:26px;font-weight:700">${sess.entries.length}</div><div class="txt-mut" style="font-size:var(--t-micro);letter-spacing:.08em;text-transform:uppercase">Ejercicios</div></div>
      <div style="text-align:center"><div class="cond" style="font-size:26px;font-weight:700">${Math.round(vol)}</div><div class="txt-mut" style="font-size:var(--t-micro);letter-spacing:.08em;text-transform:uppercase">Kg vol.</div></div>
    </div>
    ${hasPR?`<div class="card pr-card" style="margin-top:18px;animation:flash 1.2s ease 2">
      <div class="pr-troph" style="animation:zoom .4s var(--ease) backwards">🏆</div>
      <div class="grow"><div class="cond" style="font-size:17px;font-weight:700">¡Nuevo récord!</div>
      <div class="txt-mut" style="font-size:13px">${prs.map(p=>`${esc(p.name)} · ${fmtNum(round1(p.w))} kg × ${p.r}`).join(' · ')}</div></div>
    </div>`:''}
    <button class="btn ${hasPR?'ok':''}" data-act="recap-close" style="margin-top:18px">Guardar y cerrar</button>`);
  if(hasPR)fireConfetti();
}
function fireConfetti(){
  const host=document.createElement('div');
  host.className='confetti-host';
  const colors=['#2E7DFF','#5EA2FF','#22D3EE','#2EE6A8','#FFB454'];
  for(let i=0;i<28;i++){
    const p=document.createElement('i');
    p.style.left=Math.random()*100+'%';
    p.style.background=colors[i%colors.length];
    p.style.animationDelay=(Math.random()*.3)+'s';
    p.style.animationDuration=(1.6+Math.random()*.9)+'s';
    p.style.setProperty('--rot',(Math.random()*360)+'deg');
    p.style.setProperty('--drift',(Math.random()*140-70)+'px');
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(()=>host.remove(),2700);
}
```

- [ ] **Step 2: Register `recap-close`**

Find:
```js
  'sess-done':()=>{if(confirm('¿Completar y guardar la sesión?'))completeSession();},
```

Replace with:
```js
  'sess-done':()=>{if(confirm('¿Completar y guardar la sesión?'))completeSession();},
  'recap-close':()=>closeSheet(),
```

- [ ] **Step 3: Confetti CSS + cyan PR trophy, appended to the PR section**

Find:
```css
.pr-troph{width:44px;height:44px;border-radius:14px;background:var(--grad);display:grid;place-items:center;
  box-shadow:var(--glow);font-size:20px;flex:none}
.pr-w{font-family:'Barlow Condensed';font-weight:700;font-size:26px;line-height:1;color:var(--blue3)}
```

Replace with:
```css
.pr-troph{width:44px;height:44px;border-radius:14px;background:var(--grad2);display:grid;place-items:center;
  box-shadow:var(--glow);font-size:20px;flex:none}
.pr-w{font-family:'Barlow Condensed';font-weight:700;font-size:26px;line-height:1;color:var(--blue3)}
.confetti-host{position:fixed;inset:0;z-index:80;pointer-events:none;overflow:hidden}
.confetti-host i{position:absolute;top:-12px;width:8px;height:14px;border-radius:2px;
  opacity:.95;animation:confettiFall linear forwards;transform:rotate(var(--rot))}
@keyframes confettiFall{to{transform:translate(var(--drift),110vh) rotate(calc(var(--rot) + 360deg));opacity:0}}
```

- [ ] **Step 4: Verify in browser**

Start a session on a day with exercises, log at least one set per exercise (use weights clearly above any historical max so a PR triggers — on a fresh/empty profile every first set is automatically a PR since `prevMax` starts at 0), tap "✓ Completar sesión" and confirm. Confirm a sheet opens showing duration/series/ejercicios/kg vol., a "¡Nuevo récord!" card, and a burst of falling confetti particles above the sheet. Tap "Guardar y cerrar" and confirm the sheet closes and Hoy shows the empty/pre-session state. Repeat with weights below any historical max (log a session, then a second one with lower weight) and confirm no PR card / no confetti appears, just the plain recap.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: replace session-saved toast with a recap sheet, PR detection and confetti"
```

---

### Task 4: Rest timer — full-screen overlay with minimize-to-pill

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `T` timer object, `fmtMMSS()`, `ding()`, `toast()` (all pre-existing, untouched logic).
- Produces: `T.state` (`'hidden'|'fullscreen'|'minimized'`), `minimizeRest()`, `expandRest()`, `ACT['rest-min']`, `ACT['rest-expand']`, DOM ids `#rest-fs`, `#rfs-time`, `#rfs-prog`, and an SVG gradient def `#restGrad` (consumed by Task 6's kcal ring).
- `startRest()`/`tickRest()`/`stopRest()` keep their existing counting logic; only their DOM-touching lines change.

- [ ] **Step 1: Add the full-screen overlay markup + shared SVG gradient, after the existing `#restbar`**

Find:
```html
<div id="restbar">
  <div class="rb-top">
    <div>
      <div class="rb-lbl">Descanso</div>
      <div id="rest-time">1:30</div>
    </div>
    <div class="rb-btns">
      <button data-act="rest-add">+30s</button>
      <button data-act="rest-skip">Saltar</button>
    </div>
  </div>
  <div id="rest-track"><i id="rest-fill"></i></div>
</div>
```

Replace with:
```html
<svg width="0" height="0" style="position:absolute">
  <defs><linearGradient id="restGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#5EA2FF"/><stop offset="100%" stop-color="#22D3EE"/>
  </linearGradient></defs>
</svg>
<div id="restbar" data-act="rest-expand">
  <div class="rb-top">
    <div>
      <div class="rb-lbl">Descanso</div>
      <div id="rest-time">1:30</div>
    </div>
    <div class="rb-btns">
      <button data-act="rest-add">+30s</button>
      <button data-act="rest-skip">Saltar</button>
    </div>
  </div>
  <div id="rest-track"><i id="rest-fill"></i></div>
</div>
<div id="rest-fs">
  <div class="rfs-inner">
    <div class="rfs-lbl">Descanso</div>
    <div class="rfs-ring">
      <svg viewBox="0 0 200 200">
        <circle class="rfs-track" cx="100" cy="100" r="88"/>
        <circle class="rfs-prog" id="rfs-prog" cx="100" cy="100" r="88"/>
      </svg>
      <div class="rfs-time" id="rfs-time">1:30</div>
    </div>
    <div class="rfs-btns">
      <button class="btn sm ghost" data-act="rest-add">+30s</button>
      <button class="btn sm dim" data-act="rest-skip">Saltar</button>
    </div>
    <button class="icon-btn rfs-min" data-act="rest-min" aria-label="Minimizar">⌄</button>
  </div>
</div>
```

- [ ] **Step 2: CSS for the full-screen overlay, appended after the existing rest-timer bar rules**

Find:
```css
#rest-track{height:5px;border-radius:3px;background:rgba(255,255,255,.08);margin-top:10px;overflow:hidden}
#rest-fill{display:block;height:100%;border-radius:3px;background:var(--grad);width:100%;transition:width .25s linear}
```

Replace with:
```css
#rest-track{height:5px;border-radius:3px;background:rgba(255,255,255,.08);margin-top:10px;overflow:hidden}
#rest-fill{display:block;height:100%;border-radius:3px;background:var(--grad);width:100%;transition:width .25s linear}

/* ---------- rest timer: pantalla completa ---------- */
#rest-fs{position:fixed;inset:0;z-index:65;display:none;place-items:center;
  background:rgba(3,5,10,.94);backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);
  animation:fdin .25s var(--ease);}
#rest-fs.show{display:grid}
.rfs-inner{display:flex;flex-direction:column;align-items:center;gap:22px;padding:24px;position:relative;width:100%;max-width:360px}
.rfs-lbl{font-family:'Barlow Condensed';font-weight:700;font-size:15px;letter-spacing:.2em;text-transform:uppercase;color:var(--blue2)}
.rfs-ring{position:relative;width:240px;height:240px;animation:glowring 2.4s ease-in-out infinite}
.rfs-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.rfs-track{fill:none;stroke:var(--card2);stroke-width:10}
.rfs-prog{fill:none;stroke:url(#restGrad);stroke-width:10;stroke-linecap:round;
  stroke-dasharray:552.9;stroke-dashoffset:0;transition:stroke-dashoffset .25s linear}
.rfs-time{position:absolute;inset:0;display:grid;place-items:center;
  font-family:'Barlow Condensed';font-weight:700;font-size:56px;font-variant-numeric:tabular-nums}
.rfs-btns{display:flex;gap:12px;width:100%}
.rfs-btns .btn{flex:1}
.rfs-min{position:absolute;top:-6px;right:-6px}
```

- [ ] **Step 3: Rewrite the timer's DOM-touching functions to drive both the pill and the full-screen ring**

Find:
```js
function startRest(){
  if(!S.cfg.rest)return;
  audioCtx(); // crear con gesto del usuario
  T.total=S.cfg.rest;T.end=Date.now()+T.total*1000;
  $('#restbar').classList.add('show');
  if(!T.int)T.int=setInterval(tickRest,250);
  tickRest();
}
function tickRest(){
  const left=Math.max(0,Math.ceil((T.end-Date.now())/1000));
  $('#rest-time').textContent=fmtMMSS(left);
  $('#rest-fill').style.width=Math.max(0,(T.end-Date.now())/(T.total*1000)*100)+'%';
  if(left<=0){stopRest();ding();toast('⏱ ¡Descanso terminado!');}
}
function stopRest(){
  clearInterval(T.int);T.int=null;
  $('#restbar').classList.remove('show');
}
```

Replace with:
```js
const REST_CIRC=2*Math.PI*88;
function startRest(){
  if(!S.cfg.rest)return;
  audioCtx(); // crear con gesto del usuario
  T.total=S.cfg.rest;T.end=Date.now()+T.total*1000;
  T.state='fullscreen';
  $('#rest-fs').classList.add('show');
  $('#restbar').classList.remove('show');
  if(!T.int)T.int=setInterval(tickRest,250);
  tickRest();
}
function minimizeRest(){
  if(T.state!=='fullscreen')return;
  T.state='minimized';
  $('#rest-fs').classList.remove('show');
  $('#restbar').classList.add('show');
}
function expandRest(){
  if(T.state!=='minimized')return;
  T.state='fullscreen';
  $('#restbar').classList.remove('show');
  $('#rest-fs').classList.add('show');
}
function tickRest(){
  const left=Math.max(0,Math.ceil((T.end-Date.now())/1000));
  const pct=Math.max(0,(T.end-Date.now())/(T.total*1000));
  const rt=$('#rest-time');if(rt)rt.textContent=fmtMMSS(left);
  const rf=$('#rest-fill');if(rf)rf.style.width=pct*100+'%';
  const fst=$('#rfs-time');if(fst)fst.textContent=fmtMMSS(left);
  const prog=$('#rfs-prog');if(prog)prog.style.strokeDashoffset=REST_CIRC*(1-pct)+'';
  if(left<=0){stopRest();ding();toast('⏱ ¡Descanso terminado!');}
}
function stopRest(){
  clearInterval(T.int);T.int=null;
  T.state='hidden';
  $('#restbar').classList.remove('show');
  $('#rest-fs').classList.remove('show');
}
```

Find:
```js
const T={end:0,total:0,int:null,audio:null};
```

Replace with:
```js
const T={end:0,total:0,int:null,audio:null,state:'hidden'};
```

- [ ] **Step 4: Register the minimize/expand actions**

Find:
```js
  'rest-add':()=>{T.end+=30000;tickRest();},
  'rest-skip':()=>stopRest(),
```

Replace with:
```js
  'rest-add':()=>{T.end+=30000;tickRest();},
  'rest-skip':()=>stopRest(),
  'rest-min':()=>minimizeRest(),
  'rest-expand':()=>expandRest(),
```

- [ ] **Step 5: Verify in browser**

Start a session, log a set to trigger the rest timer. Confirm a full-screen overlay appears with a circular countdown ring (draining smoothly), the correct mm:ss in the center, +30s/Saltar buttons, and a minimize (⌄) button. Tap minimize: confirm the overlay collapses and a small floating pill appears at the bottom showing the same running countdown; confirm you can switch tabs while the pill keeps counting. Tap the pill: confirm it expands back to full-screen at the correct remaining time. Let it reach 0 (or tap Saltar): confirm both the pill and the full-screen overlay disappear and the completion chime/toast still fires as before.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: rest timer defaults to full-screen with a minimize-to-pill state"
```

---

### Task 5: Live-session vertical list → horizontal carousel + drag-to-reorder modal

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `orderedExs`, `setsDone`, `ensureVals`, `lastDataFor`, `rirScheme`, `progressionWarn`, `exInfo`, `currentDayForHoy`, `setExOrder`, `findEx`, the drag mechanism (`dragPick`/`dragEnd`/`commitSort`), `WD`, `esc` (all pre-existing, untouched).
- Produces: `#ex-carousel` (replaces `#ex-list`), `.carousel-slide[data-exid]`, `initCarousel(idx)`, `scrollCarouselTo(exId)`, `sheetReorderHoy()`, `ACT['reorder-open']`.
- Removes: `ACT['ex-move']` (its only callers — the per-card ▲/▼ arrows — are removed by this task) and the now-unused `.ex-move` CSS.
- Widens the `dragPick` exclusion and the tab-swipe exclusion so drag works inside `#sheet` (needed for the new reorder modal) and so horizontal carousel swipes don't trigger a tab change.

- [ ] **Step 1: Allow the reusable drag mechanism to work inside sheets**

Find:
```js
  if(t.closest('button,input,select,textarea,.chip,#sheet,#restbar'))return null;
```

Replace with:
```js
  if(t.closest('button,input,select,textarea,.chip,#restbar'))return null;
```

- [ ] **Step 2: Stop the carousel's horizontal swipe from being hijacked by tab-switching**

Find:
```js
  if(e.target.closest('.chip-scroll,input,select,textarea,#sheet,#restbar,details')){SWOK=false;return;}
```

Replace with:
```js
  if(e.target.closest('.chip-scroll,input,select,textarea,#sheet,#restbar,details,#ex-carousel')){SWOK=false;return;}
```

- [ ] **Step 3: Replace the vertical draggable `#ex-list` with a horizontal `#ex-carousel` + dot indicators + a "Reordenar" button**

Find:
```js
    const anyDrag=exs.length>1;
    if(anyDrag)h+=`<div class="drag-hint"><span>↕</span><span>Mantené presionado un ejercicio y arrastralo para cambiar el orden.</span></div>`;
    h+=`<div id="ex-list" data-sort="hoy">`;
    meta.forEach((m,idx)=>{
      const ex=m.ex,done=m.done,full=m.full,open=m.open,isNext=m.isNext,waiting=m.waiting;
      const v=ensureVals(ex);
      const last=lastDataFor(ex.name);
      const scheme=rirScheme(ex.sets,ex.name);
      const curSet=Math.min(done.length,ex.sets-1);
      const curRir=scheme[curSet];
      const pwarn=progressionWarn(ex.name,v.w);
      /* el ejercicio en curso conserva su contador a la vista; los demás ceden
         la esquina a las flechas (arrastrar funciona en todos igual) */
      const arrows=anyDrag&&!open;
      const cls=[full?'full doneex':'',open?'cur':'',waiting?'wait':''].filter(Boolean).join(' ');
      h+=`<div class="card ex-card ${cls}" id="exc-${ex.id}" data-sid="${ex.id}" style="--done:${Math.min(1,done.length/ex.sets)}">
        ${arrows?`<div class="ex-move">
          <button data-act="ex-move" data-ex="${ex.id}" data-d="-1" ${idx===0?'disabled':''} aria-label="Subir">▲</button>
          <button data-act="ex-move" data-ex="${ex.id}" data-d="1" ${idx===exs.length-1?'disabled':''} aria-label="Bajar">▼</button>
        </div>`:`<div class="ex-done-count ${full?'full':''}">${done.length}/${ex.sets}</div>`}
        <div class="exname" style="${arrows?'padding-right:44px':''}">${esc(ex.name)} ${exInfo(ex.name)?`<button class="mini info inline" data-act="ex-info" data-wd="${wd}" data-ex="${ex.id}">ⓘ</button>`:''}</div>
        <div class="extarget">Objetivo ${ex.sets} × ${ex.reps}${open?` · serie ${done.length+1} → ${curRir===0?'<b class="txt-blue">al fallo</b>':'RIR '+curRir}`:''}</div>
        ${last?`<div class="exlast">Última vez: ${last.map(s=>`${fmtNum(round1(s.w))}×${s.r}`).join(' · ')} kg</div>`:''}
        ${full?`<div class="ex-state ok">✓ Completo · ${done.length} de ${ex.sets} series</div>`:''}
        ${waiting?`<div class="ex-state">En espera · ${done.length?`${done.length}/${ex.sets} series`:'te toca después'}</div>`:''}
        ${isNext?`<button class="btn" data-act="ex-start" data-ex="${ex.id}" style="margin-top:14px">▶ Iniciar ejercicio</button>
          <div class="txt-mut" style="font-size:12px;text-align:center;margin-top:8px">Dale cuando estés en la máquina${!started?' — acá arranca el cronómetro':''}</div>`:''}
        ${open?`
        <div class="prog-warn" id="pw-${ex.id}" style="${pwarn?'':'display:none'}">⚠ ${pwarn||''}</div>
        <div class="setgrid">
          <div>
            <div class="steplabel">Peso (${S.cfg.unit==='kg'?'kg':'lb'})</div>
            <div class="step">
              <button data-act="w-" data-ex="${ex.id}">−</button>
              <div class="val">
                <input type="number" inputmode="decimal" step="any" value="${wDisplay(v.w)}" data-chg="w" data-ex="${ex.id}">
                <span class="alt" id="alt-${ex.id}">${wAlt(v.w)}</span>
              </div>
              <button data-act="w+" data-ex="${ex.id}">+</button>
            </div>
          </div>
          <div>
            <div class="steplabel">Reps</div>
            <div class="step">
              <button data-act="r-" data-ex="${ex.id}">−</button>
              <div class="val"><input type="number" inputmode="numeric" value="${v.r}" data-chg="r" data-ex="${ex.id}"></div>
              <button data-act="r+" data-ex="${ex.id}">+</button>
            </div>
          </div>
        </div>
        <button class="btn" data-act="set-save" data-ex="${ex.id}">✓ Terminé la serie ${done.length+1} de ${ex.sets}</button>`:''}
        ${active&&done.length?`<div class="chips setchips">${done.map((s,i)=>
          `<span class="chip blue" data-act="set-del" data-ex="${ex.id}" data-i="${i}">${fmtNum(round1(s.w))}kg × ${s.r}<span class="x">✕</span></span>`).join('')}</div>`:''}
      </div>`;
    });
    h+=`</div>`;
```

Replace with:
```js
    openIdx=meta.findIndex(m=>m.open||m.isNext);
    if(exs.length>1)h+=`<button class="btn sm ghost" data-act="reorder-open" style="margin-bottom:var(--s3)">↕ Reordenar</button>`;
    h+=`<div id="ex-carousel" class="carousel">`;
    meta.forEach(m=>{
      const ex=m.ex,done=m.done,full=m.full,open=m.open,isNext=m.isNext,waiting=m.waiting;
      const v=ensureVals(ex);
      const last=lastDataFor(ex.name);
      const scheme=rirScheme(ex.sets,ex.name);
      const curSet=Math.min(done.length,ex.sets-1);
      const curRir=scheme[curSet];
      const pwarn=progressionWarn(ex.name,v.w);
      const cls=[full?'full doneex':'',open?'cur':'',waiting?'wait':''].filter(Boolean).join(' ');
      h+=`<div class="carousel-slide" data-exid="${ex.id}"><div class="card ex-card ${cls}" id="exc-${ex.id}" style="--done:${Math.min(1,done.length/ex.sets)}">
        <div class="ex-done-count ${full?'full':''}">${done.length}/${ex.sets}</div>
        <div class="exname">${esc(ex.name)} ${exInfo(ex.name)?`<button class="mini info inline" data-act="ex-info" data-wd="${wd}" data-ex="${ex.id}">ⓘ</button>`:''}</div>
        <div class="extarget">Objetivo ${ex.sets} × ${ex.reps}${open?` · serie ${done.length+1} → ${curRir===0?'<b class="txt-blue">al fallo</b>':'RIR '+curRir}`:''}</div>
        ${last?`<div class="exlast">Última vez: ${last.map(s=>`${fmtNum(round1(s.w))}×${s.r}`).join(' · ')} kg</div>`:''}
        ${full?`<div class="ex-state ok">✓ Completo · ${done.length} de ${ex.sets} series</div>`:''}
        ${waiting?`<div class="ex-state">En espera · ${done.length?`${done.length}/${ex.sets} series`:'te toca después'}</div>`:''}
        ${isNext?`<button class="btn" data-act="ex-start" data-ex="${ex.id}" style="margin-top:14px">▶ Iniciar ejercicio</button>
          <div class="txt-mut" style="font-size:12px;text-align:center;margin-top:8px">Dale cuando estés en la máquina${!started?' — acá arranca el cronómetro':''}</div>`:''}
        ${open?`
        <div class="prog-warn" id="pw-${ex.id}" style="${pwarn?'':'display:none'}">⚠ ${pwarn||''}</div>
        <div class="setgrid">
          <div>
            <div class="steplabel">Peso (${S.cfg.unit==='kg'?'kg':'lb'})</div>
            <div class="step">
              <button data-act="w-" data-ex="${ex.id}">−</button>
              <div class="val">
                <input type="number" inputmode="decimal" step="any" value="${wDisplay(v.w)}" data-chg="w" data-ex="${ex.id}">
                <span class="alt" id="alt-${ex.id}">${wAlt(v.w)}</span>
              </div>
              <button data-act="w+" data-ex="${ex.id}">+</button>
            </div>
          </div>
          <div>
            <div class="steplabel">Reps</div>
            <div class="step">
              <button data-act="r-" data-ex="${ex.id}">−</button>
              <div class="val"><input type="number" inputmode="numeric" value="${v.r}" data-chg="r" data-ex="${ex.id}"></div>
              <button data-act="r+" data-ex="${ex.id}">+</button>
            </div>
          </div>
        </div>
        <button class="btn" data-act="set-save" data-ex="${ex.id}">✓ Terminé la serie ${done.length+1} de ${ex.sets}</button>`:''}
        ${active&&done.length?`<div class="chips setchips">${done.map((s,i)=>
          `<span class="chip blue" data-act="set-del" data-ex="${ex.id}" data-i="${i}">${fmtNum(round1(s.w))}kg × ${s.r}<span class="x">✕</span></span>`).join('')}</div>`:''}
      </div></div>`;
    });
    h+=`</div>`;
    if(exs.length>1)h+=`<div class="carousel-dots" id="ex-dots">${exs.map(()=>`<i></i>`).join('')}</div>`;
```

- [ ] **Step 4: Initialize/scroll the carousel after each render — add the call right after `el.innerHTML=h;` and the helper functions near `saveSet`**

Find:
```js
  el.innerHTML=h;
}

function updExDisplays(exId){
```

Replace with:
```js
  el.innerHTML=h;
  initCarousel(exs.length?Math.max(0,openIdx):0);
}
function initCarousel(idx){
  const car=$('#ex-carousel');if(!car)return;
  const dots=$$('#ex-dots i');
  if(idx>0)car.scrollLeft=idx*car.clientWidth;
  const upd=()=>{
    const i=Math.round(car.scrollLeft/(car.clientWidth||1));
    dots.forEach((d,j)=>d.classList.toggle('on',j===i));
  };
  car.addEventListener('scroll',upd,{passive:true});
  upd();
}
function scrollCarouselTo(exId){
  const car=$('#ex-carousel');if(!car)return;
  const idx=[...car.children].findIndex(c=>c.dataset.exid===exId);
  if(idx>=0)setTimeout(()=>car.scrollTo({left:idx*car.clientWidth,behavior:'smooth'}),60);
}

function updExDisplays(exId){
```

`openIdx` (assigned inside Step 3's block, inside `else{...}`) is also read after `el.innerHTML=h;` to tell `initCarousel` which slide to land on, so it must be declared in the outer scope before the `if(!exs.length){...}else{...}` branch:

Find:
```js
  if(!exs.length){
    h+=`<div class="card"><div class="empty">
      <div class="big">🏋️</div>
      <p>No hay rutina para <b>${WD[wd]}</b>.<br>Configura tu split en la pestaña Rutina.</p>
      <button class="btn sm ghost" data-act="goto-rutina" style="max-width:240px;margin:0 auto">Configurar rutina</button>
    </div></div>`;
  }else{
```

Replace with:
```js
  let openIdx=0;
  if(!exs.length){
    h+=`<div class="card"><div class="empty">
      <div class="big">🏋️</div>
      <p>No hay rutina para <b>${WD[wd]}</b>.<br>Configura tu split en la pestaña Rutina.</p>
      <button class="btn sm ghost" data-act="goto-rutina" style="max-width:240px;margin:0 auto">Configurar rutina</button>
    </div></div>`;
  }else{
```

- [ ] **Step 5: Point the post-save and post-start auto-scrolls at the carousel instead of `scrollIntoView`**

Find:
```js
  if(finished){
    toast(nxt?`✓ ${ex.name} completo · sigue ${nxt.name}`:`✓ ${ex.name} completo · terminaste el día`);
    const card=$('#exc-'+(nxt?nxt.id:exId));
    if(card)setTimeout(()=>card.scrollIntoView({block:'center',behavior:'smooth'}),60);
  }else{
```

Replace with:
```js
  if(finished){
    toast(nxt?`✓ ${ex.name} completo · sigue ${nxt.name}`:`✓ ${ex.name} completo · terminaste el día`);
    scrollCarouselTo(nxt?nxt.id:exId);
  }else{
```

Find:
```js
    await saveDraft();vibrate(15);renderHoy();
    const card=$('#exc-'+ex.id);
    if(card)setTimeout(()=>card.scrollIntoView({block:'center',behavior:'smooth'}),60);
    toast(first?`⏱ Cronómetro en marcha · ${ex.name}`:`${ex.name} · serie 1 de ${ex.sets}`);
```

Replace with:
```js
    await saveDraft();vibrate(15);renderHoy();
    scrollCarouselTo(ex.id);
    toast(first?`⏱ Cronómetro en marcha · ${ex.name}`:`${ex.name} · serie 1 de ${ex.sets}`);
```

- [ ] **Step 6: Add the reorder-modal sheet + register its action; remove the now-dead `ex-move` action**

Find:
```js
  'ex-move':async b=>{
    const wd=currentDayForHoy();
    const list=orderedExs(wd,S.routine[wd]?.exercises||[]);
    const i=list.findIndex(e=>e.id===b.dataset.ex),j=i+(+b.dataset.d);
    if(i<0||j<0||j>=list.length)return;
    const ids=list.map(e=>e.id);
    [ids[i],ids[j]]=[ids[j],ids[i]];
    await setExOrder(wd,ids);
    vibrate(8);
    flipSort(()=>renderHoy());
  },
  'sess-start':()=>{
```

Replace with:
```js
  'reorder-open':()=>sheetReorderHoy(),
  'sess-start':()=>{
```

Find:
```js
function sheetHist(id){
```

Replace with:
```js
function sheetReorderHoy(){
  const wd=currentDayForHoy();
  const exs=orderedExs(wd,S.routine[wd]?.exercises||[]);
  openSheet(`<h2>Reordenar</h2>
    <div class="drag-hint tight"><span>↕</span><span>Mantené presionado y arrastrá para cambiar el orden.</span></div>
    <div data-sort="hoy">${exs.map(ex=>`
      <div class="row" data-sid="${ex.id}">
        <div class="grow"><div class="t">${esc(ex.name)}</div><div class="s">${ex.sets} × ${ex.reps}</div></div>
        <span class="chev" style="cursor:grab">☰</span>
      </div>`).join('')}</div>
    <button class="btn dim" data-act="sheet-close" style="margin-top:16px">Listo</button>`);
}
function sheetHist(id){
```

- [ ] **Step 7: Remove the now-unused `.ex-move` CSS, replace with the carousel CSS**

Find:
```css
.ex-move{position:absolute;top:12px;right:12px;display:flex;flex-direction:column;gap:4px;z-index:2}
.ex-move button{width:30px;height:26px;border-radius:8px;background:var(--card2);border:1px solid var(--line);color:var(--mut);font-size:12px;display:grid;place-items:center}
.ex-move button:active{color:var(--blue2);border-color:var(--blue2)}
.ex-move button:disabled{opacity:.22}
```

Replace with:
```css
.carousel{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;
  margin:0 calc(-1*var(--s4)) 0;padding:0 var(--s4) 4px;scrollbar-width:none}
.carousel::-webkit-scrollbar{display:none}
.carousel-slide{flex:0 0 100%;scroll-snap-align:center;min-width:0}
.carousel-dots{display:flex;justify-content:center;gap:6px;margin:10px 0 4px}
.carousel-dots i{width:6px;height:6px;border-radius:3px;background:var(--card2);border:1px solid var(--line2);transition:.2s}
.carousel-dots i.on{width:18px;background:var(--grad2);border-color:transparent}
```

- [ ] **Step 8: Verify in browser**

Open Hoy on a day with 2+ exercises, start the session. Confirm exercises now show one at a time in a horizontally swipeable carousel with dot indicators below, and every control that existed before (steppers, "Terminé la serie", set chips, ⓘ info button, progression warning) is present and functional on the active slide. Confirm horizontal swiping the carousel does NOT switch app tabs. Tap "↕ Reordenar": confirm a sheet opens with the plain vertical list; press-and-hold + drag a row to a new position and confirm it visually reorders with the same physics as the routine editor's day drag, and confirm the background carousel reflects the new order once the sheet closes. Log a set and confirm the carousel auto-scrolls to the next pending exercise.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat: turn the live-session exercise list into a swipeable carousel with a drag-to-reorder modal"
```

---

### Task 6: Nutrición — kcal ring + "un toque" quick-add chips from real meal history

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `S.meals`, `norm()`, `esc()`, `idb.put`, `uid()`, `vibrate()`, `renderNutri()`, `toast()`, and the `#restGrad` SVG gradient def produced by Task 4.
- Produces: `frequentMeals(limit)` → `[{name,kcal,p,c,f,count,last}]`, `ACT['quickadd-meal']`.

- [ ] **Step 1: Frequent-meals calculation, added next to `saveMeal`/`addMealFromFood`**

Find:
```js
async function addMealFromFood(id){
```

Replace with:
```js
/* agrupa S.meals por nombre normalizado; usa los macros del registro más
   reciente de cada nombre, ordena por frecuencia */
function frequentMeals(limit=6){
  const groups=new Map();
  S.meals.forEach(m=>{
    const key=norm(m.name);
    if(!key)return;
    const last=m.date+' '+m.t;
    const g=groups.get(key);
    if(!g){groups.set(key,{name:m.name,kcal:m.kcal,p:m.p,c:m.c,f:m.f,count:1,last});return;}
    g.count++;
    if(last>g.last){g.name=m.name;g.kcal=m.kcal;g.p=m.p;g.c=m.c;g.f=m.f;g.last=last;}
  });
  return [...groups.values()].sort((a,b)=>b.count-a.count).slice(0,limit);
}
async function addMealFromFood(id){
```

- [ ] **Step 2: Register the quick-add action**

Find:
```js
  'hist-view':b=>sheetHist(b.dataset.id),
```

Replace with:
```js
  'hist-view':b=>sheetHist(b.dataset.id),
  'quickadd-meal':async b=>{
    const f=frequentMeals()[+b.dataset.idx];if(!f)return;
    const meal={id:uid(),date:S.nutriDate,name:f.name,kcal:f.kcal,p:f.p,c:f.c,f:f.f,t:new Date().toTimeString().slice(0,5)};
    await idb.put('meals',meal);S.meals.push(meal);
    vibrate(12);renderNutri();
    toast(`＋ ${f.name}`);
  },
```

- [ ] **Step 3: Replace the linear kcal header with a ring, and insert the "Un toque" chip row below it**

Find:
```js
  <div class="card hero">
    <div style="display:flex;align-items:baseline;justify-content:space-between">
      <div class="bignum">${kc}<small> / ${g.kcal} kcal</small></div>
      <div class="cond ${kc>g.kcal+150?'txt-red':'txt-blue'}" style="font-size:17px;font-weight:700">${kc>g.kcal?'+'+(kc-g.kcal)+' pasado':Math.max(0,g.kcal-kc)+' restantes'}</div>
    </div>
    <div class="pbar" style="margin-top:12px"><i style="width:${pct(kc,g.kcal)}%" class="${kc>g.kcal+150?'red':kc>g.kcal?'warn':''}"></i></div>
    <div class="macro3">
      <div class="m"><div class="lbl"><span>Proteína</span><span>${tp}/${g.p}g</span></div><div class="pbar"><i class="${macroCls(tp,'prot',m)}" style="width:${pct(tp,g.p)}%"></i></div>${m?`<div class="rng">rango ${m.protMin}–${m.protMax}g</div>`:''}</div>
      <div class="m"><div class="lbl"><span>Carbos</span><span>${tc}/${g.c}g</span></div><div class="pbar"><i style="width:${pct(tc,g.c)}%"></i></div>${m?`<div class="rng">resto de kcal</div>`:''}</div>
      <div class="m"><div class="lbl"><span>Grasa</span><span>${tf}/${g.f}g</span></div><div class="pbar"><i class="${macroCls(tf,'fat',m)}" style="width:${pct(tf,g.f)}%"></i></div>${m?`<div class="rng">rango ${m.fatMin}–${m.fatMax}g</div>`:''}</div>
    </div>
    ${nutriFeedback(kc,tp,tf,g,m)}
  </div>`;

  h+=`<div class="sect">Frecuentes ${S.foods.length?`<button class="mini" data-act="food-editmode" style="width:32px;height:32px;font-size:13px;${S.foodEdit?'color:var(--blue2);border-color:var(--line2)':''}">✎</button>`:''}</div>`;
```

Replace with:
```js
  const kcalOff=326.7*(1-Math.min(1,g.kcal?kc/g.kcal:0));
  h+=`<div class="card hero">
    <div style="display:flex;align-items:center;gap:16px">
      <div class="kcal-ring">
        <svg viewBox="0 0 120 120"><circle class="kr-track" cx="60" cy="60" r="52"/><circle class="kr-prog" cx="60" cy="60" r="52" style="stroke-dashoffset:${kcalOff}"></circle></svg>
        <div class="kr-val"><div class="cond" style="font-size:22px;font-weight:700">${kc}</div><div class="txt-mut" style="font-size:10px">/ ${g.kcal}</div></div>
      </div>
      <div class="grow">
        <div class="cond ${kc>g.kcal+150?'txt-red':'txt-blue'}" style="font-size:17px;font-weight:700">${kc>g.kcal?'+'+(kc-g.kcal)+' pasado':Math.max(0,g.kcal-kc)+' restantes'}</div>
        <div class="txt-mut" style="font-size:12.5px;margin-top:2px">${kc} de ${g.kcal} kcal</div>
      </div>
    </div>
    <div class="macro3">
      <div class="m"><div class="lbl"><span>Proteína</span><span>${tp}/${g.p}g</span></div><div class="pbar"><i class="${macroCls(tp,'prot',m)}" style="width:${pct(tp,g.p)}%"></i></div>${m?`<div class="rng">rango ${m.protMin}–${m.protMax}g</div>`:''}</div>
      <div class="m"><div class="lbl"><span>Carbos</span><span>${tc}/${g.c}g</span></div><div class="pbar"><i style="width:${pct(tc,g.c)}%"></i></div>${m?`<div class="rng">resto de kcal</div>`:''}</div>
      <div class="m"><div class="lbl"><span>Grasa</span><span>${tf}/${g.f}g</span></div><div class="pbar"><i class="${macroCls(tf,'fat',m)}" style="width:${pct(tf,g.f)}%"></i></div>${m?`<div class="rng">rango ${m.fatMin}–${m.fatMax}g</div>`:''}</div>
    </div>
    ${nutriFeedback(kc,tp,tf,g,m)}
  </div>`;

  const freq=frequentMeals();
  if(freq.length){
    h+=`<div class="sect">Un toque</div>
    <div class="chip-scroll">${freq.map((f,i)=>
      `<span class="chip blue" data-act="quickadd-meal" data-idx="${i}">＋ ${esc(f.name)} <span class="txt-mut" style="font-weight:500">${f.kcal}</span></span>`
    ).join('')}</div>`;
  }

  h+=`<div class="sect">Frecuentes ${S.foods.length?`<button class="mini" data-act="food-editmode" style="width:32px;height:32px;font-size:13px;${S.foodEdit?'color:var(--blue2);border-color:var(--line2)':''}">✎</button>`:''}</div>`;
```

- [ ] **Step 4: CSS for the kcal ring**

Find:
```css
.macro3 .m:nth-child(3) .pbar>i{background:linear-gradient(90deg,#E8A21D,#FFB454)}
```

Replace with:
```css
.macro3 .m:nth-child(3) .pbar>i{background:linear-gradient(90deg,#E8A21D,#FFB454)}
.kcal-ring{position:relative;width:92px;height:92px;flex:none}
.kcal-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.kr-track{fill:none;stroke:var(--card2);stroke-width:9}
.kr-prog{fill:none;stroke:url(#restGrad);stroke-width:9;stroke-linecap:round;stroke-dasharray:326.7;transition:stroke-dashoffset .5s var(--ease)}
.kr-val{position:absolute;inset:0;display:grid;place-items:center;text-align:center;line-height:1.15}
```

- [ ] **Step 5: Verify in browser**

Open Nutrición. Confirm the kcal header now shows a circular ring (blue→cyan) next to the "restantes/pasado" text, filling proportionally to kcal consumed vs goal. Log 2-3 different meals via "+ Agregar comida" (some repeated by name), reload/re-open Nutrición, and confirm an "Un toque" chip row appears below the ring showing the most-repeated meal names with their kcal; tap one and confirm it's added to today's meals instantly (no form opens) and the ring/macros update. Confirm a brand-new profile with zero meals shows no "Un toque" section (no empty chip row).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add a kcal ring and one-tap quick-add chips from real meal history"
```

---

### Task 7: Hoy — enlarged week strip + weekly muscle-volume card

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `S.routine`, `WEEK_ORDER`, `WD1`, `esc()`, `muscleVolume(days)` (pre-existing, already used by Progreso's Volumen tab), the pre-existing `.wkstrip` CSS, and the `rise` keyframe from Task 1.
- No new `ACT` entries; `hoy-day` keeps its existing handler and `data-wd` contract.

- [ ] **Step 1: Replace the compact day-letter strip with the enlarged week strip (day name shown, same active/rest criteria)**

Find:
```js
  }else{
    h+=`<div class="dayrow">${WEEK_ORDER.map(d=>`
      <button data-act="hoy-day" data-wd="${d}" class="${d===wd?'on':''}">${WD1[d]}${(S.routine[d]?.exercises?.length)?'<span class="dot"></span>':''}</button>`).join('')}
    </div>`;
```

Replace with:
```js
  }else{
    h+=`<div class="wkstrip">${WEEK_ORDER.map(d=>{
      const dayR=S.routine[d];
      const has=dayR?.exercises?.length;
      const isToday=d===today.getDay();
      return `<button data-act="hoy-day" data-wd="${d}" class="wd ${d===wd?'on':''} ${isToday?'today':''}">
        <div class="l">${WD1[d]}</div><div class="n">${has?esc(dayR.name||'Rutina'):'Descanso'}</div>
      </button>`;
    }).join('')}</div>`;
```

- [ ] **Step 2: Add the weekly muscle-volume card, shown regardless of active/pre-session state**

Find:
```js
    if(exs.length)h+=`<button class="btn" data-act="sess-start" style="margin-bottom:var(--s3)">▶ Iniciar entrenamiento</button>`;
  }

  /* el pre-workout se toma 30-60 min ANTES: durante la sesión ya no sirve de nada
     y solo compite con las tarjetas de ejercicio */
```

Replace with:
```js
    if(exs.length)h+=`<button class="btn" data-act="sess-start" style="margin-bottom:var(--s3)">▶ Iniciar entrenamiento</button>`;
  }

  const mv=muscleVolume(7),mvCats=Object.entries(mv).sort((a,b)=>b[1]-a[1]);
  if(mvCats.length){
    const maxv=mvCats[0][1];
    h+=`<div class="card sub" style="margin-top:2px">
      <div class="steplabel" style="margin-bottom:10px">Volumen · esta semana</div>
      ${mvCats.map(([c,n])=>`<div style="margin-bottom:var(--s2)">
        <div style="display:flex;justify-content:space-between;font-size:var(--t-sm);margin-bottom:3px"><span>${esc(c)}</span><span class="num">${n} series</span></div>
        <div class="pbar" style="height:7px"><i style="width:${Math.round(n/maxv*100)}%;animation:rise .5s var(--ease) backwards"></i></div>
      </div>`).join('')}
    </div>`;
  }

  /* el pre-workout se toma 30-60 min ANTES: durante la sesión ya no sirve de nada
     y solo compite con las tarjetas de ejercicio */
```

- [ ] **Step 3: Verify in browser**

Open Hoy with a configured weekly split (or load `?seed`). Confirm the week strip now shows one wide cell per day with a single-letter weekday label and, below it, either the day's routine name (e.g. "Pecho") or "Descanso" for rest days — with the same active-day highlighting and "today" ring as before, and tapping a day still switches `S.hoyDay` correctly. Confirm a "Volumen · esta semana" card appears below (only when there's at least one completed set this week) showing one animated bar per muscle group, matching what Progreso → Volumen shows for the same 7-day window.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: enlarge the Hoy week strip with day names and add a weekly muscle-volume card"
```

---

### Task 8: Final visual pass — Rutina / Progreso / nav accent consistency

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `--grad2` (Task 1). No JS or markup changes — CSS only.
- No new `ACT` entries, no behavior change anywhere in Rutina or Progreso (both already inherited the Task 1 glass upgrade on `.card`/`.card.hero`/`nav.tabbar`/`.tab-ind`/`#sheet .panel` automatically, since they share those classes with Hoy/Nutrición).

- [ ] **Step 1: Bring the segmented-control accent (Progreso's range/tab selector) in line with the new primary gradient**

Find:
```css
.seg button.on{background:var(--grad);color:#fff;font-weight:700;box-shadow:var(--glow)}
```

Replace with:
```css
.seg button.on{background:var(--grad2);color:#fff;font-weight:700;box-shadow:var(--glow)}
```

- [ ] **Step 2: Verify in browser — full pass across all 4 tabs**

Screenshot Hoy, Rutina, Nutrición and Progreso. Confirm on Rutina: day cards, the "ver/editar" toggle, drag-to-reorder of days and exercises, undo/redo, and the plantillas/biblioteca sheets all still work exactly as before, now rendered with the frosted-glass card style and the updated primary-button gradient — no behavior changed. Confirm on Progreso: the 1M/3M/6M/Todo range selector and Carga/1RM/Volumen tabs use the blue→cyan active state, the weight/exercise charts still draw and respond to taps, and the PRs list still reflects real session data. Confirm nothing regressed on Hoy or Nutrición from the earlier tasks (carousel still swipes, rest timer still full-screens, streak sheet still opens, quick-add chips still work).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "style: extend the cyan accent to Progreso's segmented controls for consistency"
```
