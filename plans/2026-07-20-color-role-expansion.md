# Plan: Expand the picker into an eight-role color system

## Goal

Turn the current Brand and Neutral prototype into a starter-friendly eight-role color workflow with OKLCH palette generation, semantic assignments, quick suggestions, measurable accessibility, and maintainable standalone source files.

The accepted product and color decisions live in [`docs/color-role-model.md`](../docs/color-role-model.md). This file owns execution order only.

## Current state

- `index.html` is the direct runnable entry point; source ownership is split across HTML, CSS, and three JavaScript files.
- The project has no build step, package manager, or framework.
- The page must continue to work when opened through `file://`.
- Phase 0 and Phase 1 established the Git baseline and split the standalone sources without adding a build step.
- Phase 2 through Phase 4 are in progress: the eight-role state, OKLCH engine, role overview, Secondary strategies, semantic suggestions, locks, and regenerate controls are implemented; semantic component assignments and complete Preview coverage remain later phases.

## Constraints

- Preserve `file://` execution.
- Do not introduce a framework or dependency for work that can remain clear in browser-native HTML, CSS, and JavaScript.
- Keep a single application state owner.
- Keep WCAG calculation deterministic and centralized.
- Keep reference palette generation separate from semantic assignment.
- Invalid input, gamut reduction, calculation failure, and copy failure must remain observable.
- Do not change all roles at once without a regression baseline.
- Update `AGENTS.md` in the same implementation change that moves the source of truth out of inline HTML.

## Target source layout

```text
color-design-system/
├── AGENTS.md
├── index.html
├── styles.css
├── js/
│   ├── color-engine.js
│   ├── role-model.js
│   └── app.js
├── tests/
│   └── color-engine.test.mjs
├── docs/
│   └── color-role-model.md
└── plans/
    └── 2026-07-20-color-role-expansion.md
```

No ES module is required in the browser. The JavaScript files should use small explicit browser globals, loaded in dependency order, so direct `file://` execution remains reliable:

1. `color-engine.js`
2. `role-model.js`
3. `app.js`

### File responsibilities

`index.html`

- semantic page structure;
- stable IDs and anchors;
- stylesheet and script references;
- no calculation logic and minimal inline style.

`styles.css`

- the complete visual system;
- responsive behavior;
- role picker, role overview, scale, report, matrix, preview, and export styles.

`js/color-engine.js`

- HEX and sRGB parsing;
- OKLab and OKLCH conversion;
- sRGB gamut detection and chroma reduction;
- relative luminance and contrast;
- scale generation with exact seed preservation at `500`;
- measured foreground selection;
- no DOM access.

`js/role-model.js`

- role definitions and palette ownership;
- `Regular → Neutral` alias;
- optional Secondary state;
- semantic hue families;
- suggestion strategies;
- palette-to-semantic assignment resolution;
- export schema preparation;
- no direct rendering.

`js/app.js`

- the only mutable application state owner;
- event handling;
- render functions;
- active-section tracking;
- copy feedback;
- CSS and JSON serialization.

`tests/color-engine.test.mjs`

- deterministic tests for conversion, scale generation, gamut behavior, contrast thresholds, and foreground selection.

## Proposed state model

```js
{
  context: {
    background: '#F7F3EB',
    text: '#25231F'
  },
  target: 4.5,
  activeRole: 'brand',
  roles: {
    brand: { enabled: true, seed: '#D8664A', locked: true },
    neutral: { enabled: true, seed: '#3B7A78', temperature: 'balanced', locked: false },
    secondary: { enabled: false, seed: null, strategy: 'none', locked: false },
    regular: { aliasOf: 'neutral' },
    success: { enabled: true, seed: null, locked: false },
    warning: { enabled: true, seed: null, locked: false },
    danger: { enabled: true, seed: null, locked: false },
    information: { enabled: true, seed: null, locked: false }
  },
  palettes: {},
  assignments: {},
  diagnostics: []
}
```

The exact defaults are implementation parameters, not new product decisions. They must be calibrated through contrast tests and preview results.

## Execution phases

### Phase 0: Establish a recoverable baseline and contracts

- [x] Confirm whether this standalone directory should become a Git repository.
- [x] If approved, initialize Git, commit the current baseline, then create `feat/color-role-expansion` before the source split.
- [x] Record the current default state and exported CSS/JSON as regression fixtures.
- [x] Run the current static verification commands and record results.
- [x] Preserve the desktop and narrow visual baseline through the annotated browser screenshots in the 2026-07-20 review thread; automated Browser control cannot inspect the current `file://` page.

Phase 0 result: baseline commit `b310dad` on `main`; implementation continues on `feat/color-role-expansion`. Static source, fixture parsing, and default contrast checks passed before the split.

Exit criteria:

- The pre-refactor page can be recovered exactly.
- Existing behavior has a written or captured baseline.

### Phase 1: Split source files without changing behavior

- [x] Move inline CSS to `styles.css`.
- [x] Move pure color functions to `js/color-engine.js`.
- [x] Move current role definitions into `js/role-model.js` without adding roles yet.
- [x] Move rendering, state, and events to `js/app.js`.
- [x] Keep script loading synchronous and ordered for `file://` compatibility.
- [x] Update `AGENTS.md` with the new source owners and run commands.
- [x] Verify that the split preserves script syntax, default seeds, contrast results, IDs/selectors, and baseline export data at source level.
- [ ] Confirm visual equivalence after a manual `file://` refresh; automated Browser control cannot inspect this URL.

Phase 1 source result: inline owners were removed, the four linked source files exist, all scripts parse, 42 IDs and 36 JavaScript ID selectors resolve, default contrast remains 14.17:1, and Brand/Neutral `500` remain exact. Manual visual equivalence stays open for final review.

Exit criteria:

- `index.html` contains structure rather than application logic.
- Direct `file://` opening still works.
- Brand and Neutral retain separate values.
- No visual or behavioral regression is accepted in this phase.

### Phase 2: Introduce the role model

- [x] Add all eight visible roles to the central model.
- [x] Implement `Regular` as a read-through alias of `Neutral`.
- [x] Make `Secondary` optional with `none`, `analogous`, and `contrasting` strategies.
- [x] Add clear role definitions and usage guidance to the UI.
- [x] Ensure a role cannot bypass the shared palette, report, preview, and export pipeline.
- [x] Preserve independent seeds and locks when switching roles.

Exit criteria:

- The state has eight visible roles but no duplicate Regular palette.
- Secondary can be enabled or disabled without stale tokens.
- Switching roles never overwrites another role's seed.

### Phase 3: Replace HSL scale generation with OKLCH

- [x] Implement sRGB ↔ OKLab ↔ OKLCH conversion.
- [x] Define one shared tonal curve for `50` through `950`.
- [x] Define per-family chroma limits rather than forcing one saturation value.
- [x] Preserve the exact seed HEX at `500`.
- [x] Reduce chroma for out-of-gamut results while preserving lightness and hue as far as possible.
- [x] Emit a diagnostic when gamut reduction occurs.
- [x] Add deterministic Node tests.

Required tests:

- [x] HEX parsing rejects invalid values.
- [x] Conversion round trips stay within the agreed tolerance.
- [x] `500` equals the input seed exactly for every palette owner.
- [x] The 11 scale steps are monotonic in perceived lightness.
- [x] Gamut reduction returns valid sRGB and records a diagnostic.
- [x] Contrast is calculated from unrounded values.

Exit criteria:

- `node tests/color-engine.test.mjs` passes.
- Existing default Brand and Neutral remain visually recognizable.

### Phase 4: Generate Secondary and semantic suggestions

- [x] Generate up to three Secondary suggestions from the chosen strategy.
- [x] Generate Success, Warning, Danger, and Information from fixed semantic hue families.
- [x] Let Brand influence tonal rhythm and chroma character, not semantic hue identity.
- [x] Add lock, adjust, and regenerate controls per independent role.
- [x] Keep Warning's dark on-color option when light text fails.
- [x] Show why a suggestion is usable: representative component, ratio, and PASS/FAIL.

Exit criteria:

- Semantic roles remain recognizable when Brand hue changes radically.
- Regenerating one unlocked role does not change locked roles.
- Every suggested solid color has a measured on-color result.

### Phase 5: Resolve semantic assignments

- [x] Resolve subtle surface, border/icon, bold surface, and on-bold foreground for each semantic role.
- [x] Add a semantic assignment report separate from the reference scale.
- [x] Extend previews to include neutral/default, success, warning, danger, and information components.
- [x] Keep one full-width preview visible at a time and switch Light / Dark locally inside Preview.
- [x] Keep color from being the only semantic signal by including text and icons.
- [x] Update the matrix to inspect the active palette without naming or assigning hue semantics inside the matrix.

Exit criteria:

- Each role has inspectable palette tokens and semantic usage tokens.
- Assignment PASS/FAIL changes with the selected WCAG target.
- Warning, Danger, Success, and Information remain distinguishable without relying on color alone.

### Phase 6: Build the starter quick-pick flow

- [x] Keep the ordered workflow: Context, Colors, Standard.
- [x] In Colors, present Brand first, Neutral second, and Secondary as optional.
- [x] Put generated semantic roles behind one concise suggestion action.
- [x] Provide an overview showing all eight roles without opening eight full editors.
- [x] Reveal detailed scale controls only for the active role.
- [x] Keep Preview and Export as unnumbered result destinations.
- [x] Keep theme switching inside Preview; Standard owns only the WCAG target.

Exit criteria:

- A starter can reach a complete initial system with three direct choices.
- Advanced tuning remains available without dominating the default path.
- The narrow layout does not require horizontal scrolling for primary controls.

### Phase 7: Extend export and complete verification

- [x] Export all enabled reference palettes.
- [x] Export semantic assignments separately from reference tokens.
- [x] Represent Regular as an alias in JSON rather than duplicated values.
- [x] Omit disabled Secondary tokens cleanly.
- [x] Include diagnostics in JSON or the UI report, not as silent console-only warnings.
- [ ] Run the full project verification checklist.

Automated verification result on 2026-07-20: JavaScript syntax, static HTML/selector contracts, deterministic color-engine checks, application startup, role switching, Secondary state, locked semantic regeneration, assignment output, and CSS/JSON export checks pass. Automated Browser control rejected the local `file://` URL by policy, so manual desktop and narrow visual review remains open and the full checklist is not marked complete.

Exit criteria:

- CSS and JSON agree with the visible state.
- No stale role remains after Secondary is disabled.
- All static, calculation, interaction, desktop, and narrow checks are reported separately.

## Milestones

| Date | Milestone | Deliverable |
| --- | --- | --- |
| 2026-07-20 | Role contract | Accepted decision doc and implementation plan |
| 2026-07-21 to 2026-07-22 | Source and core palette | Recoverable baseline, deliberate file split, Brand and Neutral on OKLCH |
| 2026-07-23 to 2026-07-24 | Semantic generator | Optional Secondary and four semantic suggestions |
| 2026-07-27 | Semantic assignments | Surface, border/icon, bold, and on-bold roles with contrast results |
| 2026-07-28 | Quick picker and export | Three-decision flow, overview, CSS and JSON |
| 2026-07-29 | Verification | Static checks, calculation tests, interaction checks, desktop and narrow review |

Target: seven working days for the MVP after plan approval. A complete dual-theme token mapping and color-vision-deficiency simulation remain a separate two-to-three-day follow-up.

## Risks and mitigations

### Too many roles overload the starter flow

Mitigation: show a compact role overview, edit one role at a time, and auto-generate semantic suggestions after three direct choices.

### Brand influence weakens semantic recognition

Mitigation: fix semantic hue families; share tonal rhythm and chroma character only.

### Yellow Warning fails with light text

Mitigation: measure on-color and allow dark foregrounds. Never infer foreground from token number.

### OKLCH colors leave the sRGB gamut

Mitigation: reduce chroma at constant hue and lightness, record the reduction, and test output validity.

### A source split creates competing owners

Mitigation: complete the split in one phase and update `AGENTS.md` immediately. Do not leave inline and external implementations active together.

### The directory lacks Git recovery

Mitigation: resolve repository setup before the source split. Do not begin the substantial refactor without a recoverable baseline.

## Full success criteria

- [x] Background and Text remain fixed context inputs.
- [x] Brand, Neutral, optional Secondary, Success, Warning, Danger, and Information own independent palettes.
- [x] Regular aliases Neutral and does not own a palette.
- [x] Every independent palette has 11 tokens from `50` to `950`.
- [x] Every `500` token exactly matches its accepted seed.
- [x] Semantic suggestions use OKLCH alignment and recognizable hue families.
- [x] Every semantic role has measured surface, border/icon, bold, and on-bold assignments.
- [x] Normal text, large text, and meaningful non-text indicators are evaluated against the correct targets.
- [x] Semantic meaning is not communicated by color alone.
- [x] Preview covers all roles in representative components.
- [x] CSS and JSON exports separate reference palettes from semantic tokens.
- [ ] Direct `file://` opening continues to work.
- [ ] Static checks and browser checks are reported separately.

## Approval gate

Do not begin Phase 0 or code changes until Riza confirms this execution plan. Once approved, update this file as phases complete. If the architecture changes materially, revise this plan before changing the code.
