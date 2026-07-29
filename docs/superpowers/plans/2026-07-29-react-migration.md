# Migración a React Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild FIERRO (currently a single-file `index.html` vanilla-JS PWA, ~3600 lines) as a Vite + React app in `web/`, preserving 100% of existing functionality, data (same IndexedDB name/schema), and the visual design already achieved — while gaining the ability to match the `fierro-rediseno.html` mockup's structure directly (same component-based paradigm) instead of reverse-engineering computed CSS values one at a time.

**Architecture:** The new app lives entirely in `web/` (a Vite project), alongside the existing `index.html`/`sw.js` at the repo root, which are **not touched or deleted** until the React version has full verified parity — this is an additive migration, not an in-place rewrite. `web/src/lib/` holds all business logic ported as plain ES modules (IndexedDB access, macros engine, streak calc, session/PR logic, muscle volume, drag mechanism, rest timer state machine, chart drawing, voice parsing, templates, seed data, backup/export) — almost all of this logic is framework-agnostic and transfers with only import/export adjustments, not rewrites. `web/src/lib/state.js` provides `S` (the same mutable global state object the original app used) plus a `useStore()` hook built on React's `useSyncExternalStore` — component code reads `S.whatever` directly and calls `bump()` after mutating it, mirroring the original app's `render()`-after-mutation pattern instead of introducing a new state paradigm mid-port. `web/src/components/` holds the JSX component tree: a shared shell (Header, TabBar, Sheet, Toast, Confetti, RestTimer) plus one component per screen (Hoy, Rutina, Nutricion, Progreso) plus one component per sheet/modal (there are ~20 sheets in the original app — each becomes a small component rendered inside the shared `<Sheet>` shell).

**Tech Stack:** Vite 8, React 19 (function components + hooks only, no class components), plain JavaScript/JSX (no TypeScript — this is a mechanical port of working JS, adding type annotations is out of scope and would only slow the port down), `vite-plugin-pwa` for the service worker (replaces the hand-rolled `sw.js` cache-versioning with automatic precache-manifest generation from the build output — lower risk than re-implementing cache busting by hand), IndexedDB via the same hand-rolled `idb` wrapper (no new dependency).

## Global Constraints

- **Never touch, rename, or delete `index.html`, `sw.js`, or `manifest.json` at the repo root during this plan.** The old app stays live and deployable until every task in this plan is complete and the final review confirms full parity. Deleting/replacing it is a separate, later decision the user makes explicitly — not part of this plan.
- **Same IndexedDB name and schema.** `DB.name==='fierro'`, `DB.ver===1`, same 6 object stores with the same `keyPath`s (`web/src/lib/db.js`, already created). A user who has been using the vanilla version must be able to open the React version and see the exact same data — never change the store names, key paths, or add a schema migration as part of this plan.
- **No behavior changes.** This plan ports existing behavior faithfully, including bugs-as-designed (e.g. the exact PR-comparison-by-name logic, the exact streak rest-day handling). Anything that looks like a bug in the original code is out of scope to "fix" here — file it as a finding for the final review, don't silently change behavior mid-port.
- **All business-logic modules are already scaffolded as empty targets or partially done** (`web/src/lib/db.js`, `format.js`, `state.js`, `macros.js` already exist and are complete — do not recreate them, import from them).
- **Component styling**: reuse the existing, already-designed CSS from `index.html`'s `<style>` block verbatim as one global stylesheet (`web/src/styles.css`) — this preserves all the visual-redesign work already done (glassmorphism, the floating nav pill, dark-text-on-gradient, etc.) without re-deriving it. Class names in JSX must match the existing CSS class names exactly (e.g. `className="card ex-card"`, not a CSS-modules or styled-components rewrite).
- **Verification**: this project has no automated test suite. Every task must be verified by actually running `npm run dev` in `web/` and exercising the feature in a real Playwright browser — screenshots and described observations, not static code reading. This is a hard-learned lesson from the earlier visual-redesign plan on this same project: multiple implementers submitted curl/static-analysis checks disguised as "verification" and were sent back each time. Do not repeat that.
- **Read the original source, don't guess.** Every task below names exact function names and approximate line ranges in the repo-root `index.html` (current, unmodified) to port from. Read the actual current lines before porting — line numbers drift slightly as the file is a living document; use the function/section name comments (`/* ================= ... ================= */`) to relocate if a line number is off by a few lines.

---

### Task 1: Global stylesheet + app shell skeleton (Header, TabBar, Sheet, Toast)

**Files:**
- Create: `web/src/styles.css`
- Create: `web/src/components/Header.jsx`
- Create: `web/src/components/TabBar.jsx`
- Create: `web/src/components/Sheet.jsx`
- Create: `web/src/components/Toast.jsx`
- Modify: `web/src/App.jsx`, `web/src/main.jsx`

**Interfaces:**
- Consumes: `S`, `useStore`, `bump` from `web/src/lib/state.js` (already created); `loadAll` (already created).
- Produces: `<Header/>` (renders the FIERRO brand + streak button + settings button — streak count itself is wired in Task 3, stub it at `0` for now with a `data-act`-free `onClick` no-op), `<TabBar/>` (renders the floating pill nav with the sliding `.tab-ind` chip — reuses the exact CSS classes from the original; the indicator-measurement logic from `moveTabIndicator()` must be ported as a `useLayoutEffect` keyed on `S.tab`), `<Sheet/>` (generic modal shell taking `{open, onClose, children}` — later tasks render sheet-specific content inside it), `<Toast/>` (a global toast queue — port `toast(msg,opts)`'s behavior as a small module-level event emitter + component, since many later modules need to call `toast(...)` from plain JS, not just from component code).
- `App.jsx` after this task: boots the DB (`idbOpenOnce` + `loadAll` + `applyComputedGoals`), shows a loading state until `S.ready`, then renders `<Header/>`, a placeholder `<main>` (`{S.tab} view — not yet implemented`), `<TabBar/>`, `<Sheet/>`, `<Toast/>`.

- [ ] **Step 1: Copy the entire `<style>...</style>` block content from `index.html` (lines ~19-563, from `/* ====... FIERRO — dark steel & electric blue ====*/` through the closing `</style>`) into `web/src/styles.css`** verbatim — every CSS rule, custom property, and keyframe, unchanged. Import it once in `web/src/main.jsx` via `import './styles.css'`.

- [ ] **Step 2: Port the toast system.** Read `toast(msg,opts)` at `index.html` (search `function toast(msg,opts={})`) and the `#toast` HTML/CSS (search `id="toast"`). Create `web/src/components/Toast.jsx` as a small pub-sub: a module-level array of listeners, an exported `toast(msg, opts)` function any module can call (matching the original signature/behavior — same 1900ms/4000ms auto-dismiss timing, same `actionLabel`/`actionAct` support model but as an `onAction` callback instead of a `data-act` string, since there's no global dispatch table anymore), and a `<Toast/>` component that subscribes and renders the current toast with the exact original CSS classes/markup.

- [ ] **Step 3: Port the Header.** Read the `<header class="top">` markup (search `<header class="top">`) — brand SVG + text, and the header-actions div with the streak button and settings button (added across the earlier visual-redesign plan — search `class="header-actions"`). Build `web/src/components/Header.jsx` reproducing this markup in JSX with the same classes. The streak count and the settings-sheet click handler are wired in later tasks — for now render the streak number as a prop (default `0`) and leave the settings button's `onClick` as a prop passed from `App.jsx` (default no-op).

- [ ] **Step 4: Port the TabBar + sliding indicator.** Read `<nav class="tabbar">` (search `<nav class="tabbar">`) and `moveTabIndicator()`/`switchTab()` (search `function moveTabIndicator` and `function switchTab`). Build `web/src/components/TabBar.jsx`: takes `{active, onChange}` props, renders the 4 tab buttons with their exact SVG icons and the `<i className="tab-ind">` element, and a `useLayoutEffect` that measures the active button's `getBoundingClientRect()` (relative to the nav) and sets the indicator's `width`/`transform` — this is a direct port of `moveTabIndicator()`'s body, just triggered by a `useLayoutEffect` dependency on `active` instead of being called manually after DOM mutation. Also re-run it on `window resize` (add/remove a `resize` listener in the same effect) and once after `document.fonts.ready` resolves (matching the original's `if(document.fonts?.ready)document.fonts.ready.then(moveTabIndicator)`).

- [ ] **Step 5: Port the Sheet shell.** Read `<div id="sheet">...</div>` markup and `openSheet`/`closeSheet` (search `function openSheet` and `function closeSheet`). Build `web/src/components/Sheet.jsx` as `{open, onClose, children}` — renders the `.bk` backdrop (`onClick={onClose}`) and `.panel` with the exact classes/animation. Later tasks will manage `open`/`children` from a small sheet-stack state (a single "what sheet is open + its props" value in `S` or a tiny separate context — your call, but keep it simple: a single `S.sheet = null | {type, props}` field plus a `bump()` after setting it works fine and matches the "one sheet open at a time" reality of the original app).

- [ ] **Step 6: Wire `App.jsx` + `main.jsx`.** `main.jsx`: import `./styles.css`, keep `<StrictMode>`. `App.jsx`: on mount (`useEffect`, empty deps), call `idbOpenOnce().then(loadAll).then(() => { applyComputedGoals(); bump(); })`; while `!S.ready`, render nothing (or a minimal splash matching `body{background:var(--bg)}` so there's no white flash); once ready, render `<Header/>`, a `<main>` placeholder, `<TabBar active={S.tab} onChange={t => {S.tab=t; bump();}}/>`, `<Toast/>`, `<Sheet/>`.

- [ ] **Step 7: Verify in browser.** `cd web && npm run dev`. Open the dev URL in Playwright. Confirm: no console errors, the header renders with the FIERRO brand + two icon buttons, the tab bar renders as a floating glass pill at the bottom with a visible sliding chip, clicking each of the 4 tabs moves the chip to the correct button (screenshot before/after at least one tab switch), and calling the exported `toast()` function from the browser console (`import` isn't accessible from devtools, so instead temporarily wire a test button or use React DevTools — simplest: add a temporary `onClick={() => import('./components/Toast.jsx').then(m=>m.toast('test'))}` on the header brand for this check only, then remove it before committing) shows a toast that auto-dismisses.

- [ ] **Step 8: Commit.**

```bash
git add web/
git commit -m "feat(web): scaffold Vite+React app with global styles, header, tab bar, sheet and toast shells"
```

---

### Task 2: Business-logic modules — streak, session/PR, muscle volume, meal frequency

**Files:**
- Create: `web/src/lib/streak.js`
- Create: `web/src/lib/session.js`
- Create: `web/src/lib/muscle.js`
- Create: `web/src/lib/meals.js`

**Interfaces:**
- Consumes: `S` from `state.js`, `dstr`/`fmtDFull`/`norm`/`round1` etc. from `format.js`, `idb` from `db.js`, `bump` from `state.js`.
- Produces (consumed by screen components in later tasks): `dayCompleted`, `currentStreak`, `bestStreak`, `streakHeatmap`, `updHeaderStreak` (`streak.js`); `lastDataFor`, `ensureVals`, `orderedExs`, `setExOrder`, `setsDone`, `nextPending`, `saveSet`, `completeSession`, `calcSessionPRs` (`session.js`); `catOf`, `muscleVolume`, `EXCATALOG` (`muscle.js` — `EXCATALOG` is also needed by `rutina-logic.js` in Task 5, export it from here and re-export or import cross-module, your call); `frequentMeals`, `mealsOf`, `macroCls`, `nutriFeedback` (`meals.js`).

- [ ] **Step 1: Port `streak.js`.** Read `index.html` from the `/* ================= racha ================= */` comment through `sheetStreak()`'s definition (search `function dayCompleted`, `currentStreak`, `bestStreak`, `streakHeatmap`, `updHeaderStreak` — do NOT port `sheetStreak()` itself, that becomes a React component in Task 6). Port `dayCompleted(dateStr)`, `currentStreak()`, `bestStreak()`, `streakHeatmap()` verbatim (they read `S.routine`/`S.sessions`, import `S` from `state.js` and `dstr` from `format.js`). For `updHeaderStreak()`: in the original this pokes a DOM node directly (`$('#streak-n')`) — in React this isn't needed since the Header component will just read `currentStreak()` directly on render; skip porting `updHeaderStreak()` as a DOM-poker, but do export `currentStreak` for the Header to call.

- [ ] **Step 2: Port `session.js`.** Read from `/* ================= HOY ================= */` for `lastDataFor(exName)`, `ensureVals(ex)`, `orderedExs(wd,exs)`, `setExOrder(wd,ids)`, `setsDone(exId)`, `nextPending(list)` (these are small pure helpers, port verbatim). Then port `saveSet(exId)` (search `async function saveSet`) and `completeSession()` + `calcSessionPRs(entries)` (search `async function completeSession` and `function calcSessionPRs`) — **important**: the original `saveSet`/`completeSession` call `renderHoy()`, `startRest()`, `toast()`, `sheetSessionRecap()`, `fireConfetti()` directly; port the data-mutation logic verbatim but replace direct DOM/render calls with: `bump()` (instead of `renderHoy()`), the ported `toast()` from Task 1, and for `startRest()`/`sheetSessionRecap()`/`fireConfetti()` — these are ported in Tasks 3 and 6 respectively; for now, import them with a comment noting the dependency, since Task ordering means `rest.js` (Task 3) will exist by the time this is wired into a component in Task 6. If you're implementing this task before Task 3 lands, still write the correct import statements (`import { startRest } from './rest.js'`) — they'll resolve once Task 3 completes; this task's own verification only needs `saveSet`/`completeSession`'s *pure logic* (the entries/PR computation), which doesn't require the rest-timer UI to exist — verify those parts with a temporary Node script (`node --input-type=module -e "..."`) that imports the module and calls the functions against a fake `S`, rather than a full browser session (there's no UI to click yet at this point in the plan).

- [ ] **Step 3: Port `muscle.js`.** Read `EXCATALOG` (search `const EXCATALOG=`), `catOf(name)`, `muscleVolume(days)` — port verbatim, all pure functions/data over `S.sessions`.

- [ ] **Step 4: Port `meals.js`.** Read `mealsOf(date)`, `macroCls(v,kind,m)`, `nutriFeedback(kc,tp,tf,g,m)`, `frequentMeals(limit=6)` (search each name) — port verbatim, all pure/`S.meals`-reading functions. `nutriFeedback` returns an HTML string in the original (template literal) — keep it returning a string for now (it'll be rendered via `dangerouslySetInnerHTML` in Task 7, OR — preferred, lower risk — rewrite just this one function's return value as small JSX-returnable data (an array of `{cls, text}` objects) so Task 7 can map it to real JSX without `dangerouslySetInnerHTML`; pick whichever you finish correctly and note the choice in your report, since Task 7 depends on knowing which shape you produced.

- [ ] **Step 5: Verify.** No UI exists yet for these modules. Verify with a Node script per module: import the module, seed a minimal fake `S` (import `{S}` from `state.js` and assign directly to `S.sessions`/`S.routine`/`S.meals` before calling the functions — this mirrors exactly how the original file's own logic was verified against constructed scenarios in the earlier visual-redesign plan's task reviews), call each exported function with 2-3 representative scenarios (e.g. `currentStreak()` with a rest day in the middle; `calcSessionPRs` with a session that does and doesn't beat history; `frequentMeals` with a repeated meal name), and print the results. This is legitimate verification for this task specifically because there is no UI yet to exercise — later tasks that DO have UI must use the real browser, per the Global Constraints.

- [ ] **Step 6: Commit.**

```bash
git add web/src/lib/streak.js web/src/lib/session.js web/src/lib/muscle.js web/src/lib/meals.js
git commit -m "feat(web): port streak, session/PR, muscle-volume and meal-frequency logic modules"
```

---

### Task 3: Rest timer state machine + drag/reorder mechanism

**Files:**
- Create: `web/src/lib/rest.js`
- Create: `web/src/lib/drag.js`

**Interfaces:**
- Consumes: `S`, `bump`, `vibrate`/`fmtMMSS` from `format.js`.
- Produces: `T` (rest timer state), `startRest`, `minimizeRest`, `expandRest`, `stopRest`, `tickRest`, `ding`, `REST_CIRC` (`rest.js`); `DRAG`, `dragPick`, `dragStart`, `dragMove`, `dragEnd`, `dragTick`, `dragUpdate`, `dragLayout`, `commitSort`, `flipSort`, `keepScroll` (`drag.js`) — these are consumed by a `<RestTimer/>` component (Task 4) and a `useDragSort()` hook (Task 4) respectively.

- [ ] **Step 1: Port `rest.js`.** Read from `/* ================= timer descanso ================= */` through `stopRest()` (search `const T=`, `function audioCtx`, `function ding`, `const REST_CIRC`, `function startRest`, `function minimizeRest`, `function expandRest`, `function tickRest`, `function stopRest`). The original versions of `startRest`/`tickRest`/`stopRest` poke specific DOM nodes by id (`$('#rest-fs')`, `$('#rfs-time')`, etc.) — **this task ports the timing/state logic only** (the `T` object, `audioCtx`, `ding`, the state transitions `hidden→fullscreen→minimized→fullscreen→hidden`), replacing every direct DOM write with a `bump()` call plus storing the current displayed values (`left` seconds, `pct` fraction) as fields on `T` itself (e.g. `T.leftSec`, `T.pct`) so a React component (Task 4) can read them on render instead of the function writing into specific elements. Keep `setInterval(tickRest,250)` as-is.

- [ ] **Step 2: Port `drag.js`.** Read from `/* ================= reordenar (Hoy y Rutina) ================= */` through `commitSort` (search `function flipSort`, `const DRAG=`, `function dragPick`, `function dragStart`, `const DRAG_EDGE`, `function dragTick`, `function dragMove`, `function dragUpdate`, `function dragLayout`, `function dragEnd`, `function refreshSortArrows`, `function keepScroll`, `async function commitSort`) — this is pure DOM manipulation via `getBoundingClientRect`/inline `style.transform`, entirely framework-agnostic; port verbatim with two changes: (1) `commitSort`'s `kind==='hoy'` branch calls `setExOrder` (from `session.js`, Task 2) and, where the original did `renderHoy()`/`renderRutina()`, call `bump()` instead; (2) the global `addEventListener('touchstart'/'mousedown'/etc, ...)` registrations at the bottom of the original drag section — port these as a single exported `initDragListeners()` function that attaches them once (call it once from `App.jsx` in a `useEffect` with an empty dependency array, with a cleanup that removes them — or, simpler and matching the original's "attach once, never remove" reality, attach them at module load time in `drag.js` itself, since this app never unmounts `App` in practice). `refreshSortArrows` — note the final whole-branch review on the previous (CSS) plan found this already partially vestigial (only `ex-up`/`ex-down` still use it after the carousel work removed the old `ex-move` arrows) — port it as-is; do not attempt to "clean it up" further in this port, that's out of scope.

- [ ] **Step 3: Verify.** `rest.js`: Node-script test is acceptable here too (no UI yet) — call `startRest()`, advance fake time or just call `tickRest()` a few times manually and confirm `T.leftSec`/`T.pct`/`T.state` update as expected, call `minimizeRest()`/`expandRest()`/`stopRest()` and confirm state transitions. `drag.js`: this one genuinely needs a real DOM to test (`getBoundingClientRect` needs rendered elements) — defer full interactive verification to Task 4 (where it's wired into an actual component with real `[data-sort]`/`[data-sid]` markup); for this task, verify only that the module imports cleanly and the exported functions have the right shapes (a quick Node import-and-typeof check is sufficient here specifically because real verification requires UI that doesn't exist until Task 4 — this is the same "no UI yet" situation as Task 2, not a shortcut).

- [ ] **Step 4: Commit.**

```bash
git add web/src/lib/rest.js web/src/lib/drag.js
git commit -m "feat(web): port rest-timer state machine and generic drag/reorder mechanism"
```

---

### Task 4: Shared UI — RestTimer component + useDragSort hook + Confetti

**Files:**
- Create: `web/src/components/RestTimer.jsx`
- Create: `web/src/components/Confetti.jsx`
- Create: `web/src/lib/useDragSort.js`
- Modify: `web/src/App.jsx` (mount `<RestTimer/>` and `<Confetti/>` at the top level, alongside `<Sheet/>`/`<Toast/>`)

**Interfaces:**
- Consumes: `T`/`startRest`/etc. from `rest.js` (Task 3), `DRAG`/`dragPick`/etc. from `drag.js` (Task 3), `bump`/`useStore` from `state.js`.
- Produces: `<RestTimer/>` (renders both the `#rest-fs` full-screen overlay and the `#restbar` pill, driven by `T.state`/`T.leftSec`/`T.pct`, subscribed via a small `useSyncExternalStore`-based hook on `T` the same way `state.js` does for `S` — add a tiny local subscription inside `rest.js` mirroring `state.js`'s `bump`/`listeners` pattern, or reuse the same global `bump()` from `state.js` if simplest, since `T` changes always coincide with wanting a re-render anyway), `<Confetti/>` (port `fireConfetti()`'s DOM-node creation as a React-driven equivalent — simplest faithful port: keep `fireConfetti()` in `session.js`/wherever as an imperative DOM-append function exactly as before, since it deliberately lives OUTSIDE React's tree for its whole lifecycle (append, animate via CSS, remove itself via `setTimeout`) and re-implementing it as declarative React state adds risk for zero benefit — `<Confetti/>` can be a no-op empty component or removed entirely if `fireConfetti()` is kept as a standalone DOM function; decide and document which you did), `useDragSort({kind, wd})` — a hook wrapping `drag.js`'s functions for use inside a component: returns nothing or a ref, its job is to ensure `dragPick`/etc. are live and that the component re-renders (`bump()`) after a successful drop via `commitSort`.

- [ ] **Step 1: Build `RestTimer.jsx`** reproducing the exact markup from `index.html`'s `#rest-fs` and `#restbar` (search both ids) as JSX, with `className`s unchanged, reading `T.state`/`T.leftSec`/`T.pct` to decide what's visible and to set the `stroke-dashoffset`/width/text values that the original wrote via direct DOM pokes. Wire the `+30s`/`Saltar`/minimize/expand buttons to the ported functions from `rest.js`.

- [ ] **Step 2: Decide and implement the `fireConfetti()` approach** per the Interfaces note above — keep it as an imperative function (recommended) or build a declarative component; either way it must produce the same visual result (a burst of ~28 falling colored particles using the existing `.confetti-host`/`@keyframes confettiFall` CSS, already in `styles.css` from Task 1).

- [ ] **Step 3: Build `useDragSort.js`.** A hook that, given `{kind, wd}` (matching `commitSort`'s existing parameters), doesn't need to do much beyond existing since `drag.js`'s listeners are global (attached once) — its real job is ensuring components using `[data-sort]="kind"` markup re-render after a drop. If Task 3's `drag.js` already calls `bump()` inside `commitSort`, this hook might not need to exist as a separate file at all — if so, DELETE this file from your file list and don't create it, and note in your report that it was unnecessary (the global `bump()` in `commitSort` already covers it); don't create a needless empty abstraction just because the plan named the file.

- [ ] **Step 4: Verify in browser.** Since there's no session UI yet to naturally trigger `startRest()`, add a temporary test button in `App.jsx`'s placeholder `<main>` that calls `startRest()` directly (remove before committing, or leave behind a clearly-marked dev-only button if genuinely useful — your call, but if you leave it, it must not be visible/reachable in a production build). Click it, screenshot: confirm the full-screen overlay appears with the countdown ring, minimize it and confirm the pill appears and keeps counting, expand it back, let it reach 0 or skip it, confirm both disappear. Check console for errors.

- [ ] **Step 5: Commit.**

```bash
git add web/src/components/RestTimer.jsx web/src/components/Confetti.jsx web/src/lib/useDragSort.js web/src/App.jsx
git commit -m "feat(web): add RestTimer and Confetti components wired to the ported timer/drag logic"
```

---

### Task 5: Rutina business logic + Rutina screen component

**Files:**
- Create: `web/src/lib/rutina-logic.js`
- Create: `web/src/lib/templates.js`
- Create: `web/src/components/screens/Rutina.jsx`
- Create: `web/src/components/sheets/DayEdit.jsx`, `web/src/components/sheets/ExerciseForm.jsx`, `web/src/components/sheets/Library.jsx`, `web/src/components/sheets/DayPeek.jsx`, `web/src/components/sheets/ExInfo.jsx`

**Interfaces:**
- Consumes: `EXCATALOG` from `muscle.js` (Task 2), `S`/`bump`/`useStore`, `useDragSort`/drag primitives (Task 3/4).
- Produces: the fully working Rutina tab — day-by-day summary, day editor (add/edit/delete exercises, exercise autocomplete against `EXCATALOG`), drag-to-reorder of both days and exercises, undo/redo, save/apply templates, "mis rutinas" library (save/apply/delete a saved split).

- [ ] **Step 1: Port `rutina-logic.js`.** Read from `/* ================= RUTINA ================= */` (first occurrence, `daySessions`) through `applyDays`/`swapDayContents`/`pushHistory`/`undoRutina`/`redoRutina`/`ensureDay`/`persistDay` (search each name), then the second `/* ================= RUTINA ================= */` block's `routineStats`/`routineName`/`activeDayWds`/`routineSnapshot`/`saveLib`, then further down `dayCategories(name)`/`recommendedExercises(wd)` (these use `EXCATALOG` — import it from `muscle.js`). Port all verbatim; replace `renderRutina()` calls with `bump()`.

- [ ] **Step 2: Port `templates.js`.** Read `const TEMPLATES=` and `async function applyTemplate(id)` (search both) — port verbatim (large static data array + one function), replace `renderRutina()`/`closeSheet()` with `bump()` / the Task 1 sheet-close mechanism.

- [ ] **Step 3: Build `Rutina.jsx`.** Read `function renderRutina()` in full (search it — this is a long function, roughly 100 lines) and reproduce its output as JSX: the plan-summary hero card, the 7-day pill row (with drag via the Task 3/4 drag mechanism — same `data-sort="days"` convention as the original), the "editar rutina"/"mis rutinas" buttons, the accordion day list (view mode) or the day-by-day editor (edit mode) depending on `S.rutMode`, with each day's exercise list also using `data-sort`/`data-sid` for drag-to-reorder (same `kind` convention `commitSort` already branches on for non-`'hoy'`/`'days'` kinds — read `commitSort`'s body from Task 3 to confirm the exact `kind` string this screen's exercise-reorder list must use, since it must match exactly for `commitSort` to route correctly).

- [ ] **Step 4: Build the 5 sheet components** (`DayEdit`, `ExerciseForm`, `Library`, `DayPeek`, `ExInfo`), each a faithful port of the corresponding `sheetXxx()` function's markup (search `function sheetDayPeek`, `function sheetLibrary`, `function sheetLibSave`, `function sheetExForm`, `function sheetExInfo`, and the day-name-edit sheet inlined in the original `ACT['day-edit']` handler — search `'day-edit':b=>`) as JSX rendered inside `<Sheet>` from Task 1, wired to `rutina-logic.js`/`templates.js`.

- [ ] **Step 5: Wire `Rutina.jsx` into `App.jsx`** — replace the `{S.tab}` placeholder with `S.tab==='rutina' ? <Rutina/> : ...` (this establishes the pattern the remaining screens will follow too).

- [ ] **Step 6: Verify in browser.** Full real-browser pass: create a routine from scratch (add a day, add 2-3 exercises with the autocomplete), drag-reorder both days and exercises within a day (press-and-hold + drag, same physics as before — confirm it visually reorders), toggle edit/view mode, apply a template, save the current split to "mis rutinas" and re-apply it, delete a day, use undo/redo at least twice each, confirm the day-info (ⓘ) sheet opens for exercises that have catalog info. Screenshot key states. Check console for errors throughout.

- [ ] **Step 7: Commit.**

```bash
git add web/src/lib/rutina-logic.js web/src/lib/templates.js web/src/components/screens/Rutina.jsx web/src/components/sheets/DayEdit.jsx web/src/components/sheets/ExerciseForm.jsx web/src/components/sheets/Library.jsx web/src/components/sheets/DayPeek.jsx web/src/components/sheets/ExInfo.jsx web/src/App.jsx
git commit -m "feat(web): port Rutina screen with drag-to-reorder, templates and library"
```

---

### Task 6: Exercise catalog/RIR/progression + Hoy screen (hero, week strip, carousel, streak sheet, recap sheet)

**Files:**
- Create: `web/src/lib/exdb.js`
- Create: `web/src/components/screens/Hoy.jsx`
- Create: `web/src/components/ExerciseCarousel.jsx`
- Create: `web/src/components/sheets/ReorderHoy.jsx`, `web/src/components/sheets/StreakDetail.jsx`, `web/src/components/sheets/SessionRecap.jsx`, `web/src/components/sheets/Preworkout.jsx`, `web/src/components/sheets/VoiceLog.jsx`

**Interfaces:**
- Consumes: everything from Task 2 (`session.js`, `streak.js`, `muscle.js`), Task 3/4 (`rest.js`, drag), `EXCATALOG` (Task 2's `muscle.js`).
- Produces: the fully working Hoy tab.

- [ ] **Step 1: Port `exdb.js`.** Read `const EXDB=` through `progressionWarn`/`sessionMaxW` (search `const EXDB=`, `function exInfo`, `const LOWBACK=`, `const isLowerBackLift=`, `function rirScheme`, `function sessionMaxW`, `function progressionWarn`) — port verbatim, all pure data/functions over `S.sessions`.

- [ ] **Step 2: Build `Hoy.jsx`.** Read `function renderHoy()` in full (search it — this is the largest single function in the original app, ~170 lines) and reproduce it as JSX: the active-session hero (elapsed timer, complete/discard buttons) OR the pre-session hero (eyebrow/title/stats-row/start-button, per the visual-redesign work already done — read the CURRENT `index.html`'s hero markup carefully since it was modified twice this session, most recently to add the 3-stat row and nest the button inside the card), the week strip (with the `.has`/`.on`/`.today` fill logic also added during the visual-redesign work), the muscle-volume card (`muscleVolume(7)`), the pre-workout/voice-log buttons, and the historial list at the bottom (`S.sessions.slice(0,12)`).

- [ ] **Step 3: Build `ExerciseCarousel.jsx`.** Read the `#ex-carousel`/`.carousel-slide` markup inside `renderHoy()` plus `initCarousel(idx)`/`scrollCarouselTo(exId)` (search both) — port the carousel's scroll-position math verbatim (it derives positions from `offsetLeft`/`offsetWidth`, not `clientWidth`, per a fix already applied earlier this session — preserve that), reproduce each slide's markup (steppers, "terminé la serie" button, set chips, progression warning) exactly, wired to `saveSet`/`ensureVals`/etc. from `session.js`.

- [ ] **Step 4: Build the 5 sheet components.** `ReorderHoy` (port `function sheetReorderHoy` — the drag-to-reorder modal reusing the same drag mechanism as Rutina, `kind==='hoy'`), `StreakDetail` (port `function sheetStreak` — the 56-day heatmap), `SessionRecap` (port `function sheetSessionRecap` — duration/series/volumen stats + PR card + confetti trigger), `Preworkout` (port `function sheetPreworkout`), `VoiceLog` (port `function sheetVoiceLog` plus the voice-parsing helpers: search `const NUMWORDS=`, `function digitize`, `function voiceCandidates`, `function matchAt`, `function parseWorkoutSpeech` — put the parsing helpers in a new `web/src/lib/voice.js` file rather than inline in the component, since they're pure functions independent of React).

- [ ] **Step 5: Wire `Hoy.jsx` into `App.jsx`.**

- [ ] **Step 6: Verify in browser.** Full pass: view Hoy on a rest day (empty state) and a training day (hero + stats), tap the streak button and confirm the heatmap sheet opens with real data, start a session, confirm the carousel shows one exercise at a time with peek-neighbors and swipes correctly, log sets until an exercise completes and confirm auto-advance, open the reorder modal and drag an exercise, complete the session and confirm the recap sheet appears (with confetti if any PR), try voice logging if the browser/OS supports `SpeechRecognition` (note in your report if the test environment doesn't support it — that's a browser capability gap, not a bug), confirm historial shows past sessions and opens the detail sheet. Check console throughout.

- [ ] **Step 7: Commit.**

```bash
git add web/src/lib/exdb.js web/src/lib/voice.js web/src/components/screens/Hoy.jsx web/src/components/ExerciseCarousel.jsx web/src/components/sheets/ReorderHoy.jsx web/src/components/sheets/StreakDetail.jsx web/src/components/sheets/SessionRecap.jsx web/src/components/sheets/Preworkout.jsx web/src/components/sheets/VoiceLog.jsx web/src/App.jsx
git commit -m "feat(web): port exercise catalog/RIR logic and the full Hoy screen"
```

---

### Task 7: Nutrición screen

**Files:**
- Create: `web/src/components/screens/Nutricion.jsx`
- Create: `web/src/components/sheets/MealForm.jsx`, `web/src/components/sheets/Profile.jsx`

**Interfaces:**
- Consumes: `meals.js`/`macros.js` (Task 2), `S`/`bump`.

- [ ] **Step 1: Build `Nutricion.jsx`.** Read `function renderNutri()` in full (search it) and reproduce as JSX: the profile/CTA card, date navigator, the kcal ring (SVG, reusing the shared `#restGrad` gradient def — this needs to exist once in the DOM; put it in `App.jsx` or a small always-mounted `<SvgDefs/>` component so both the rest timer and the kcal ring can reference `url(#restGrad)`), the macro bars + `nutriFeedback` output (per whichever shape Task 2 produced — string via `dangerouslySetInnerHTML` or structured JSX), the "Un toque" quick-add chip row (`frequentMeals()`), the "Frecuentes" chip row (`S.foods`), and the meal list for the selected date.

- [ ] **Step 2: Build `MealForm.jsx`** (port `function sheetMealForm` + `async function saveMeal` + `async function addMealFromFood`) and `Profile.jsx`** (port `function sheetProfile` + `macroPreview`/`readProfileForm`/`refreshProfilePreview`/`async function saveProfile` — search each name).

- [ ] **Step 3: Wire into `App.jsx`.**

- [ ] **Step 4: Verify in browser.** Add 2-3 meals (repeat one name), confirm the kcal ring fills and the "Un toque" row shows the repeated meal first with instant one-tap add (no form opening), confirm the profile/macros form computes and saves correctly, navigate between dates, mark a meal as frequent and confirm it appears in "Frecuentes", delete a meal. Check console.

- [ ] **Step 5: Commit.**

```bash
git add web/src/components/screens/Nutricion.jsx web/src/components/sheets/MealForm.jsx web/src/components/sheets/Profile.jsx web/src/App.jsx
git commit -m "feat(web): port the Nutrición screen with the kcal ring and quick-add chips"
```

---

### Task 8: Chart engine + Progreso screen

**Files:**
- Create: `web/src/lib/charts.js`
- Create: `web/src/components/screens/Progreso.jsx`
- Create: `web/src/components/Chart.jsx`
- Create: `web/src/components/sheets/BodyForm.jsx`, `web/src/components/sheets/Guide.jsx`

**Interfaces:**
- Consumes: `S`, `muscleVolume` (Task 2).

- [ ] **Step 1: Port `charts.js`.** Read `function weeklyAvg` (search it, lives near the pre-workout section), then from `/* ================= PROGRESO ================= */`: `exerciseSeries`, `const RANGE_DAYS=`, `filterByRange`, then further down `const e1rm=`, `function e1rmSeries`, `function trend`, `function project`, `function strengthReadout`, and finally `function drawChart`/`function pickChartPoint`/`const CHART_SEL=` (search each) — port all verbatim. `drawChart` is pure canvas 2D drawing, framework-agnostic.

- [ ] **Step 2: Build `Chart.jsx`** — a small wrapper component: `{pts, opts}` props, holds a `<canvas>` ref, calls `drawChart(canvasEl, pts, opts)` in a `useEffect` keyed on `pts`/the container's resize (match the original's redraw-on-data-change behavior), and wires the existing click-to-select-point behavior (`pickChartPoint` + redraw) as an `onClick` handler instead of the original's global delegated `addEventListener('click', ...)` on `canvas.chart`.

- [ ] **Step 3: Build `Progreso.jsx`.** Read `function renderProg()` in full (search it) and reproduce as JSX: the weight hero card + `<Chart/>`, the range selector (1M/3M/6M/Todo), the Carga/1RM/Volumen tab selector and each tab's content (exercise picker + `<Chart/>` for Carga, the strength-readout list for 1RM, the muscle-volume bars for Volumen — reuse the same bar markup pattern as `Hoy.jsx`'s muscle-volume card if that's cleaner than duplicating it, your call), the frequency section, and the PRs list.

- [ ] **Step 4: Build `BodyForm.jsx`** (port `function sheetBodyForm` + `async function saveBody`) and `Guide.jsx`** (port `function sheetGuide`).

- [ ] **Step 5: Wire into `App.jsx`.**

- [ ] **Step 6: Verify in browser.** With some sessions/body-weight entries logged (use Task 9's seed data once available, or log a couple manually), confirm the weight chart draws with the gradient area fill, switch range filters, switch Carga/1RM/Volumen tabs and confirm each renders correctly, click a chart point and confirm the selected-point label updates, log a body-measurement entry, open the guide sheet. Check console.

- [ ] **Step 7: Commit.**

```bash
git add web/src/lib/charts.js web/src/components/screens/Progreso.jsx web/src/components/Chart.jsx web/src/components/sheets/BodyForm.jsx web/src/components/sheets/Guide.jsx web/src/App.jsx
git commit -m "feat(web): port the chart engine and the full Progreso screen"
```

---

### Task 9: Settings sheet, backup (export/import/wipe), demo data seeding

**Files:**
- Create: `web/src/lib/seed.js`
- Create: `web/src/lib/backup.js`
- Create: `web/src/components/sheets/Settings.jsx`

**Interfaces:**
- Consumes: everything (seed data touches all stores).

- [ ] **Step 1: Port `seed.js`.** Read from `/* ================= AJUSTES / respaldo ================= */` through `wipeSeed()` (search `const KG=`, `const SEED_SPLIT=`, `const SEED_MEALS=`, `const SEED_BODY=`, `const SEED_WEEKS=`, `function genBodyForWindow`, `const MEAL_POOL=`, `function genMealsForDay`, `function seedSessions`, `async function seedRegistro`, `function seedCount`, `async function wipeSeed`) — port verbatim, this is a large block of static data + generator functions.

- [ ] **Step 2: Port `backup.js`.** Read `function exportJSON`, `async function importJSON(file)`, `async function wipeAll()` (search each) — port verbatim; `exportJSON`'s file-download trick (creating a blob URL + a temporary `<a>` click) is framework-agnostic DOM code, keep as-is.

- [ ] **Step 3: Build `Settings.jsx`.** Read `function sheetSettings()` in full (search it) and reproduce as JSX, wiring the profile/units/rest-timer-duration/seed-load/seed-wipe/export/import/wipe-all controls to the ported modules. Note the original's `seed-load`/`seed-wipe`/`wipe-all` handlers call `location.reload()` after finishing — preserve that (a full reload is the simplest correct way to guarantee every component re-reads fresh `S` after a bulk data change, and matches existing behavior exactly).

- [ ] **Step 4: Wire the Settings sheet to the Header's gear icon in `App.jsx`.**

- [ ] **Step 5: Verify in browser.** Open Settings, change the unit (kg/lb) and confirm it's reflected across screens, change rest-timer duration, load demo/seed data and confirm it populates Hoy/Rutina/Nutrición/Progreso realistically (cross-check a few numbers against what the seed data defines), export a JSON backup and confirm the file downloads with the current data, wipe all data and confirm the app returns to a clean empty state without hanging (this is the exact scenario the original CSS-plan's final review found could infinite-loop the streak calculation — confirm `currentStreak()`'s guard clause, ported in Task 2, still holds here). Check console.

- [ ] **Step 6: Commit.**

```bash
git add web/src/lib/seed.js web/src/lib/backup.js web/src/components/sheets/Settings.jsx web/src/App.jsx
git commit -m "feat(web): port settings, demo-data seeding and JSON backup/restore"
```

---

### Task 10: Production build, PWA verification, and full-app smoke test

**Files:**
- Modify: `web/vite.config.js` (if any adjustments are needed after seeing real build output)
- No new source files expected — this task is verification-only, plus small fixes if the build surfaces issues.

**Interfaces:** N/A — this is an integration/verification task across everything built in Tasks 1-9.

- [ ] **Step 1: Run `npm run build` in `web/`** and fix any build errors (missing imports, unused-variable lint failures, etc.) that only surface at build time (dev mode's Vite is more forgiving about some things than a production Rollup build).

- [ ] **Step 2: Run `npm run preview`** (serves the production build) and re-verify, in a real Playwright browser, EVERY feature from Tasks 1-9's individual verifications in one continuous pass against the production build specifically (dev-mode and prod-mode can behave differently, especially around the service worker) — all 4 tabs, starting/completing a session with a PR, the rest timer full-screen/minimize, drag-reorder in both Hoy and Rutina, the streak sheet, nutrition quick-add, the progress charts, settings/seed/export/wipe.

- [ ] **Step 3: Verify the PWA/service-worker behavior specifically**: confirm `vite-plugin-pwa` generated a service worker and manifest in the `dist/` output, confirm the app is installable (Chrome's install prompt / manifest validity — Playwright can check `navigator.serviceWorker.getRegistrations()` resolves non-empty after load), and confirm a second load while offline (Playwright's `context.setOffline(true)`) still serves the app shell from cache.

- [ ] **Step 4: Confirm IndexedDB parity** — with the OLD `index.html` app open once in a browser profile to create some real data (a routine + a session + a meal), then open the NEW React app (`npm run preview`) in the **same browser profile/origin** (same `localhost` port as whichever the old app was served on, since IndexedDB is scoped per-origin) and confirm the exact same data appears — this is the concrete proof that the schema/name-preservation constraint held throughout the whole migration, not just each task's own fresh-data testing.

- [ ] **Step 5: Report findings.** Write a summary to `.superpowers/sdd/2026-07-29-react-migration/final-parity-report.md` listing: every feature verified working, anything found broken (must be fixed before this task is done), and any deliberate behavior differences discovered along the way (there should be none per the Global Constraints — if you find one, flag it loudly rather than silently accepting it).

- [ ] **Step 6: Commit** (only if fixes were needed in Step 1; otherwise this task may have no commit beyond the verification report, which is fine — note that in your report).
