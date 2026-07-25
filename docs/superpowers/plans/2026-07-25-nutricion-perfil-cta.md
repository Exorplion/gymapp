# Tarjeta de perfil más clara en Nutrición — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the tappable profile card in the Nutrición view (`renderNutri()`) explicitly communicate that it's editable, without hiding the calorie/goal data it already shows.

**Architecture:** Single-file static PWA (`index.html`) — no build step, no bundler, no JS test framework. This is a pure HTML-template string edit inside one existing function. Verification is manual (visual check in browser) plus a `curl`/`grep` smoke test against the locally-served file, matching how this codebase is actually tested elsewhere.

**Tech Stack:** Vanilla JS, template literals, plain CSS (existing classes only — no new CSS needed).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-nutricion-perfil-cta-design.md`
- Do not change any data, macro calculations, or the `sheetProfile()` form.
- Do not touch the empty-state card (`🎯 Calcular mis macros`, the `else` branch).
- Reuse existing CSS classes only (`txt-blue`, `chev`) — no new selectors.
- Keep `data-act="profile-open"` on the card container unchanged.

---

### Task 1: Add edit affordance to the profile card

**Files:**
- Modify: `index.html:1203-1211` (inside `renderNutri()`, the `if(m){...}` branch of the "tarjeta de perfil / CTA" block)

**Interfaces:**
- Consumes: existing vars in scope at that point in `renderNutri()` — `m` (macros object from `computeMacros()`), `S.cfg.profile` (profile object with `.goal`, `.sex`).
- Produces: no new functions/vars — purely template output. Nothing else in the file depends on this block's exact markup.

- [ ] **Step 1: Confirm current markup matches the target lines**

Run:
```bash
grep -n "tarjeta de perfil / CTA" -A 10 "C:/Users/LENOVO/Documents/Enzo/Gymapp/index.html"
```
Expected output (line numbers may shift slightly if the file has changed since this plan was written, but content should match):
```js
  /* --- tarjeta de perfil / CTA --- */
  if(m){
    h+=`<div class="card profcard" data-act="profile-open">
      <div class="pavatar">👤</div>
      <div class="grow">
        <div class="pt">${GOAL_LABEL[S.cfg.profile.goal]} · ${m.target} kcal</div>
        <div class="txt-mut" style="font-size:12.5px">${S.cfg.profile.sex==='f'?'Mujer':'Hombre'} · ${fmtNum(round1(m.weight))} kg · P ${m.protMin}-${m.protMax} · G ${m.fatMin}-${m.fatMax} · C ${m.carbs}g</div>
      </div>
      <span class="chev">›</span></div>`;
  }else{
```
If it doesn't match (file has diverged), stop and re-read the current file before editing.

- [ ] **Step 2: Edit the template**

Replace:
```js
    h+=`<div class="card profcard" data-act="profile-open">
      <div class="pavatar">👤</div>
      <div class="grow">
        <div class="pt">${GOAL_LABEL[S.cfg.profile.goal]} · ${m.target} kcal</div>
        <div class="txt-mut" style="font-size:12.5px">${S.cfg.profile.sex==='f'?'Mujer':'Hombre'} · ${fmtNum(round1(m.weight))} kg · P ${m.protMin}-${m.protMax} · G ${m.fatMin}-${m.fatMax} · C ${m.carbs}g</div>
      </div>
      <span class="chev">›</span></div>`;
```
With:
```js
    h+=`<div class="card profcard" data-act="profile-open">
      <div class="pavatar">👤</div>
      <div class="grow">
        <div class="pt">${GOAL_LABEL[S.cfg.profile.goal]} · ${m.target} kcal</div>
        <div class="txt-mut" style="font-size:12.5px">${S.cfg.profile.sex==='f'?'Mujer':'Hombre'} · ${fmtNum(round1(m.weight))} kg · P ${m.protMin}-${m.protMax} · G ${m.fatMin}-${m.fatMax} · C ${m.carbs}g</div>
        <div class="txt-blue" style="font-size:12.5px;font-weight:600;margin-top:4px">✎ Ver / modificar mis datos</div>
      </div>
      <span class="chev">✎</span></div>`;
```

- [ ] **Step 3: Smoke-test with the local static server**

The app is already served locally by a background `python -m http.server 8000` process from `C:/Users/LENOVO/Documents/Enzo/Gymapp`. If it's not running, start it:
```bash
cd "C:/Users/LENOVO/Documents/Enzo/Gymapp" && python -m http.server 8000
```
Then confirm the new markup is served:
```bash
curl -s http://localhost:8000/index.html | grep -o "Ver / modificar mis datos"
```
Expected: prints `Ver / modificar mis datos` (proves the file was saved and is servable — this does NOT execute the JS template, it's a static grep of the file contents).

- [ ] **Step 4: Manual visual verification in browser**

Open `http://localhost:8000/` in a browser. If no profile is configured yet, first tap the "🎯 Calcular mis macros" card and fill in the profile form (any values) to reach the configured state.

Confirm:
1. The Nutrición tab's top card now shows three lines: goal+kcal, sex/weight/macro ranges, and a blue **"✎ Ver / modificar mis datos"** line.
2. The trailing icon at the end of the card is now a pencil (✎) instead of `›`.
3. Tapping anywhere on the card still opens the profile editor sheet (unchanged behavior).
4. The empty-state card (no profile) is untouched — still just shows "🎯 Calcular mis macros".

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/LENOVO/Documents/Enzo/Gymapp"
git add index.html
git commit -m "$(cat <<'EOF'
feat: clarify nutrition profile card is editable

Adds an explicit "Ver / modificar mis datos" line and a pencil icon
to the profile/macros card in the Nutrición view, so it's clear the
card opens the editable profile form. Kcal/goal data unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Spec requires (1) keep title/subtitle unchanged, (2) add blue "✎ Ver / modificar mis datos" line, (3) replace `›` with pencil icon, (4) leave empty-state card untouched, (5) no data/logic changes. All five are covered by Task 1, Steps 2 and 4.
- **Placeholder scan:** none — every step has literal code/commands.
- **Type consistency:** N/A (no functions/types introduced).
- **Scope:** single task is correct — this is one contiguous template edit in one function, not decomposable further.
