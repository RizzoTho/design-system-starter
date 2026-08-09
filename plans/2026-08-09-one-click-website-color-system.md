# Plan: Turn the color workflow into a one-click website color system

- Status: Approved (owner confirmed 2026-08-09; Phase 0 complete, Phases 1–8 open)
- Date: 2026-08-09
- Scope: Starter entry, complete-system generation, website semantic tokens, per-relationship accessibility, Light / Dark output, persistence, and export adapters
- Depends on: [`docs/color-role-model.md`](../docs/color-role-model.md)
- Builds on: [`plans/2026-08-06-starter-pair-set.md`](2026-08-06-starter-pair-set.md)

## Goal

A starter who has no palette and limited color-system knowledge can make at most three direct choices, press one primary action, and receive a coherent, inspectable, accessible website color system that is ready to preview, save, and export.

## Product promise

The default path should answer this question:

> Given a small amount of direction, can the tool generate the website surfaces, content, actions, form states, feedback colors, interaction states, and Light / Dark mappings needed to start building?

Success is not “eleven palette steps exist.” Success is:

- the first useful result does not require a HEX value;
- one generation action runs the complete pipeline;
- required website relationships are measured against the right accessibility constraint;
- unresolved relationships remain visible and block a false completion claim;
- exported semantic tokens can be consumed by a website without inventing another naming layer;
- existing expert controls remain available for inspection and adjustment.

## Why this is a new phase

The current tool is a strong accessible color-system authoring workflow, but it still assumes that the user already knows `Background`, `Text`, `Brand`, and `Neutral`. It also separates semantic syncing, semantic optimization, starter-pair generation, Preview, and Export into user-managed steps.

This plan changes the default entry and exit while preserving the implemented middle:

- keep the eight-role model, OKLCH scales, locks, Role checks, Pair editor, Preview, and observable diagnostics;
- add a starter-facing generation layer before those expert controls;
- add a website semantic token layer after role assignments;
- treat Saved pairs as optional custom extensions, not as the primary website contract.

When approved, this plan subsumes the unfinished Reroll and semantic preset phases in `2026-08-06-starter-pair-set.md`. Completed pair behavior remains valid and must not be silently removed.

## Source-of-truth transition

The current `AGENTS.md` says the user already knows `Background` and `Text`, and Step 03 is owned by Saved pairs. The new product promise intentionally expands that contract.

Do not update `AGENTS.md` before implementation changes the running product. During Phase 0, add an accepted website-token decision document. In the first implementation change that alters the default flow:

1. update `AGENTS.md` to describe generated and provided Context modes;
2. update Step 03 ownership from Saved pairs to Website tokens with Custom pairs nested inside it;
3. identify every new JavaScript source owner and script load order;
4. update both READMEs in the same change;
5. link the older plans as implementation history rather than current behavior.

Until that implementation change lands, the current contract remains the truth about the runnable page.

## Hard constraints

- Preserve direct `file://` execution.
- Keep the project dependency-free unless a later approved plan changes the build model.
- Keep one mutable application state owner in `js/app.js`.
- Keep color math deterministic and centralized in `js/color-engine.js`.
- Keep reference palette generation, role assignment, and website semantic usage as separate layers.
- Keep the accepted eight-role model and `Regular → Neutral` alias.
- Keep semantic hue identity: Success green, Warning amber/orange, Danger red, Information blue/cyan.
- Keep `500` equal to an explicitly provided seed.
- Keep all automatic generation testable by injecting its random source.
- Keep generated and manually edited values distinguishable by source metadata.
- Preserve locked and explicitly provided seeds during automatic repair.
- Keep every gamut reduction, failed relationship, invalid import, storage failure, and copy failure observable.
- Add every user-facing string to both English and Chinese catalogs in the same change.
- Keep one saturated control per action group. `Secondary` remains an accent, not a second filled action.
- Report static checks and browser checks separately.
- Begin implementation from a clean, integrated `main` on a new `codex/one-click-website-color-system` branch. Do not stack the implementation on the current `fix/secondary-not-a-filled-button` branch unless that branch is deliberately chosen as the integration base.

## Decisions in this plan

### 1. Two paths, one underlying system

The default route is `Quick start`. The existing editor becomes `Advanced editing`.

Quick start asks for no more than three decisions:

1. Color character: `Balanced`, `Warm`, `Cool`, `Vivid`, or `Muted`.
2. Brand source: `Generate`, `Use HEX`, or `Keep current`.
3. Secondary strategy: `None`, `Analogous`, or `Contrasting`.

The first release generates a general website system. Product-specific profiles such as Marketing, Dashboard, Portfolio, and Documentation are added only after the generic website token contract is stable. They are component-coverage profiles, not arbitrary “industry color” presets.

Advanced editing retains direct Background, Text, role, HEX, OKLCH, lock, scale, Role check, custom pair, Preview, and Export controls.

### 2. One complete generation action

`Generate website system` is the primary action. It performs the whole pipeline and returns one proposal object. It must not call a series of DOM actions or partially mutate state.

On an untouched first visit, a valid proposal becomes the active result immediately, so the first useful system is one click away. Once the user has edited or applied a system, later generations remain proposals until the user chooses `Apply`, `Reroll`, or `Cancel`.

### 3. Three token layers

The system has three explicit layers:

1. `reference`: numbered 50–950 palette tokens;
2. `role`: subtle, border/icon, bold, and on-bold assignments for Brand, Neutral, optional Secondary, and semantic roles;
3. `website`: purpose-named tokens for surfaces, content, actions, fields, focus, feedback, and accents.

Website tokens may reference role tokens, but role tokens never infer component use from their number alone.

### 4. Relationship-specific accessibility

The generated website system uses a target profile rather than applying one ratio to every relationship.

The default profile is `AA interface`:

- normal text: 4.5:1;
- explicitly large text: 3:1;
- meaningful border, icon, state indicator, and focus ring: 3:1;
- semantic meaning: text, icon, or shape in addition to color.

The current `AA large text · 3:1` option remains available for explicitly tagged Advanced pairs. It must not become a blanket target for general website text.

### 5. Light and Dark are independent outputs

Light and Dark use the same token names and component intent, but each theme resolves and validates its own assignment coordinates. Dark is no longer merely a preview/export side effect of Light-generated pairs.

### 6. Generated website tokens own the starter result

The existing generated starter pairs become a compatibility projection of website tokens. They no longer own generation policy.

Saved pairs remain:

- editable snapshots;
- useful for custom foreground/background relationships;
- independently removable;
- exported as custom pairs.

They do not overwrite generated website tokens and are not required to obtain a complete starter system.

### 7. Persistence is explicit and versioned

Applied systems are stored locally with a schema version. The user can export and import the same project JSON. A bad or unknown schema fails visibly; it never resets the current project silently.

## Target user flow

```text
Quick start
  ├─ Choose color character
  ├─ Generate Brand or enter Brand HEX
  ├─ Choose Secondary strategy
  └─ Generate website system
       ↓
Generation result
  ├─ READY
  ├─ READY WITH WARNINGS
  └─ NEEDS ATTENTION
       ↓
Inspect
  ├─ Context
  ├─ Colors and Role checks
  ├─ Website tokens and Custom pairs
  └─ Light / Dark Preview
       ↓
Apply and save
       ↓
Export
  ├─ CSS variables
  ├─ Project JSON
  └─ Tailwind theme adapter
```

`READY` means every required relationship in both themes passes. `READY WITH WARNINGS` means required relationships pass but advisory diagnostics remain, such as gamut reduction. `NEEDS ATTENTION` means at least one required relationship is unresolved and must name the relationship, actual ratio, required ratio, and available recovery action.

## Target state model

The exact object shape may change during implementation, but ownership and separation must remain:

```js
{
  schemaVersion: 2,
  mode: 'quick-start',
  generation: {
    characterId: 'balanced',
    brandSource: 'generated',
    secondaryStrategy: 'none',
    randomSeed: 123456789,
    revision: 1,
    status: 'ready',
    diagnostics: []
  },
  context: {
    background: '#F7F3EB',
    text: '#25231F',
    source: 'generated',
    locked: false
  },
  targetProfileId: 'aa-interface',
  advancedPairTarget: 4.5,
  activeRole: 'brand',
  roles: {},
  palettes: {},
  assignments: {
    light: {},
    dark: {}
  },
  websiteTokens: {
    light: {},
    dark: {}
  },
  validation: {
    status: 'ready',
    requiredFailures: [],
    warnings: [],
    relationships: []
  },
  savedPairs: [],
  dirty: false
}
```

The generation engine receives current state and options and returns a new proposal. It does not mutate `state`:

```js
generateSystem({
  currentState,
  options,
  randomSource
}) => {
  proposal,
  validation,
  diagnostics
}
```

## Website semantic token contract

The generic website profile must resolve at least the following tokens for both themes.

### Surfaces

- `surface.page`
- `surface.raised`
- `surface.sunken`
- `surface.overlay`

### Content

- `content.primary`
- `content.secondary`
- `content.muted`
- `content.link`
- `content.linkHover`
- `content.inverse`

### Borders and focus

- `border.default`
- `border.strong`
- `focus.ring`
- `focus.ringDangerContext`

### Primary action

- `action.primary.background`
- `action.primary.foreground`
- `action.primary.hover`
- `action.primary.pressed`
- `action.primary.focusRing`

### Neutral secondary action

- `action.secondary.background`
- `action.secondary.foreground`
- `action.secondary.border`
- `action.secondary.hover`
- `action.secondary.pressed`
- `action.secondary.focusRing`

### Destructive action

- `action.destructive.background`
- `action.destructive.foreground`
- `action.destructive.hover`
- `action.destructive.pressed`
- `action.destructive.focusRing`

### Fields

- `field.background`
- `field.text`
- `field.placeholder`
- `field.border`
- `field.borderFocus`
- `field.borderInvalid`
- `field.helperInvalid`
- `field.focusRing`

### Feedback families

For each of `success`, `warning`, `danger`, and `information`:

- `feedback.{role}.surface`
- `feedback.{role}.border`
- `feedback.{role}.icon`
- `feedback.{role}.text`
- `feedback.{role}.bold`
- `feedback.{role}.onBold`

### Optional Secondary accent

Only when Secondary is enabled:

- `accent.secondary.surface`
- `accent.secondary.border`
- `accent.secondary.text`

Each resolved token stores traceability metadata in JSON:

```js
{
  hex: '#B7523A',
  sourceRole: 'brand',
  sourceStep: 600,
  sourceKind: 'palette-token',
  generatedBy: 'action-primary-default',
  locked: false
}
```

A measured black or white foreground uses `sourceKind: 'measured-ink'` and has no fake palette step.

## Accessibility relationship contract

The validator evaluates relationships, not isolated colors.

| Relationship | Required target | Repair order |
| --- | ---: | --- |
| Primary, secondary, muted, link, field, and feedback text on their surfaces | 4.5:1 | choose another step, then adjust assignment Lightness |
| Explicitly large display text | 3:1 | choose another step |
| Primary and destructive action foreground across Default, Hover, and Pressed | 4.5:1 | search background steps while holding ink stable |
| Neutral secondary action foreground across states | 4.5:1 | search Neutral foreground/background coordinates |
| Border, icon, and semantic indicator against adjacent surface | 3:1 | choose another role step |
| Focus ring against every adjacent surface it touches | 3:1 | search Brand steps, then report unresolved |
| Context Text on Background | 4.5:1 | choose measured text or report locked conflict |
| Disabled content | advisory measurement only | never label PASS through an exemption |

Rules:

- Contrast uses unrounded values; display rounding never decides PASS.
- Interactive foreground is selected against Default and held across Hover and Pressed.
- Hover and Pressed search bounded candidate sets; they are not accepted merely because they are adjacent steps.
- Assignment search changes token coordinates before changing a provided or locked seed.
- Semantic repair preserves Hue, searches Lightness first, and reduces Chroma only when necessary.
- If a locked seed makes a required relationship impossible, return `NEEDS ATTENTION`; do not unlock or replace it.
- AAA mode raises applicable normal-text relationships to 7:1 but leaves non-text relationships at 3:1.

## Complete generation pipeline

### Stage 1: Validate the request

- Validate character, Brand source, optional HEX, Secondary strategy, target profile, and locks.
- Normalize valid HEX once.
- Return a field-level error for invalid input without changing the active system.

### Stage 2: Resolve Context

- Preserve a locked or explicitly provided Background and Text.
- Otherwise choose a Neutral-informed Background and measured Text.
- Require Context Text on Background to pass 4.5:1 before continuing.
- Record whether each value was provided, generated, or repaired.

### Stage 3: Resolve identity seeds

- Preserve locked roles.
- Preserve an explicitly provided Brand seed at `500`.
- Generate Brand within character-specific OKLCH bounds when no seed is provided.
- Generate Neutral with low chroma and a deliberate relationship to Brand temperature.
- Resolve Secondary from the selected strategy; keep it disabled for `None`.
- Keep randomness at the application boundary and inject a deterministic random source into pure generation functions.

### Stage 4: Resolve semantic seeds

- Generate Success, Warning, Danger, and Information as one character-consistent batch.
- Preserve semantic hue families.
- Preserve locked semantic roles.
- Measure each proposed batch before applying it.

### Stage 5: Build reference palettes and role assignments

- Generate each enabled 50–950 scale.
- Preserve exact provided seeds at `500`.
- Resolve Light and Dark role assignments independently.
- Accumulate gamut and assignment diagnostics.

### Stage 6: Resolve website tokens

- Map generic website intents to role assignment candidates.
- Resolve all required tokens in Light and Dark.
- Keep Secondary in accent tokens only.
- Derive the compatibility starter-pair projection from website tokens.

### Stage 7: Solve relationship constraints

- Evaluate the complete relationship table.
- Search bounded candidate coordinates for failing assignments.
- Re-run validation after every accepted repair.
- Stop after an explicit maximum attempt count.
- Return the best proposal plus unresolved diagnostics when no complete solution exists.

### Stage 8: Return one atomic proposal

- Return proposal state, traceability metadata, validation summary, and diagnostics.
- Do not mutate active state during search.
- Initial untouched state may auto-apply a valid proposal.
- Later proposals require Apply, Reroll, or Cancel.

## Proposed source ownership

### Existing owners

`js/color-engine.js`

- color parsing and conversion;
- gamut mapping;
- luminance and contrast;
- numbered scale generation;
- no generation policy and no DOM access.

`js/role-model.js`

- eight roles and aliases;
- semantic hue identity;
- palette ownership;
- role-level suggestion and assignment primitives;
- no website component naming and no DOM access.

`js/i18n.js`

- complete English and Chinese copy;
- catalog parity and visible missing-key failure.

`js/app.js`

- only mutable state owner;
- proposal/apply/undo interaction;
- rendering and event handling;
- navigation, clipboard, download, file import, and local storage calls;
- no color search algorithm.

### New owners

`js/token-contract.js`

- website token definitions;
- target profiles and relationship definitions;
- Light / Dark website-token resolution;
- compatibility projection to generated pairs;
- CSS, JSON, and Tailwind serialization;
- no DOM access.

`js/system-generator.js`

- character presets;
- deterministic Reroll primitives;
- Context, Brand, Neutral, Secondary, and semantic batch generation;
- bounded constraint search;
- end-to-end `generateSystem()` proposal construction;
- no DOM access.

`js/project-state.js`

- schema version;
- project encode/decode and validation;
- import migration functions when a prior schema is supported;
- storage payload preparation;
- no silent fallback and no DOM rendering.

### New tests and decision document

- `docs/website-token-contract.md`
- `tests/system-generator.test.mjs`
- `tests/token-contract.test.mjs`
- `tests/project-state.test.mjs`
- `tests/fixtures/default-system-v2.css`
- `tests/fixtures/default-system-v2.json`

Expected browser script order:

1. `js/color-engine.js`
2. `js/i18n.js`
3. `js/role-model.js`
4. `js/token-contract.js`
5. `js/system-generator.js`
6. `js/project-state.js`
7. `js/app.js`

The exact order must be enforced by `index.html` and `tests/static-contract.test.mjs`.

## Execution phases

### Phase 0: Align owners, baseline, and branch

Effort: Small

- [x] Confirm this plan and the three approval decisions at the end.
- [x] Finish or deliberately integrate the current Secondary-action branch.
- [x] Create `codex/one-click-website-color-system` from the intended clean base.
- [x] Record current CSS and JSON exports as compatibility fixtures.
- [x] Run the current four test suites and JavaScript syntax checks.
- [ ] Manually record current desktop and narrow behavior through `file://`.
- [x] Add `docs/website-token-contract.md` with accepted layer, token, and relationship decisions.
- [x] Update links between the 2026-07-20, 2026-08-06, and current plans.

Phase 0 result: `fix/secondary-not-a-filled-button` was already merged into `main` as PR #4 (`2d0a9c8`); implementation continues on `codex/one-click-website-color-system` from that clean base. `tests/fixtures/default-export.{css,json}` were regenerated from the current default export contract via `scripts/regenerate-fixtures.mjs` (the previous fixtures recorded the pre-eight-role `--color-primary-*` format). All four test suites and all JavaScript syntax checks pass. Automated Browser control still cannot inspect `file://`, so manual desktop and narrow recording remains open for the owner.

Exit criteria:

- The current product can be recovered and compared.
- The new plan, role decision, and website-token decision have non-overlapping ownership.
- No implementation starts on an ambiguous branch base.

### Phase 1: Add pure contracts without changing the UI

Effort: Medium

- [x] Add `token-contract.js` with generic website token definitions.
- [x] Add `aa-interface` and `aaa-interface` target profiles.
- [x] Add relationship definitions with required/advisory severity.
- [x] Add `project-state.js` with schema version 2 and strict validation.
- [x] Add script links and update source-owner tests.
- [x] Keep current rendered UI and current exports unchanged in this phase.
- [x] Add unit tests for missing token definitions, duplicate names, invalid thresholds, and invalid project payloads.

Phase 1 result: `js/token-contract.js` and `js/project-state.js` load in dependency order (`color-engine → i18n → role-model → token-contract → project-state → app`), enforced by `tests/static-contract.test.mjs`. The built-in contract validates clean: 52 website tokens across 9 groups, all required tokens covered by at least one relationship, `aa-interface` (4.5 / 3 / 3) and `aaa-interface` (7 / 4.5 / 3) profiles, and coded `ProjectStateError` failures for invalid JSON, unknown schema, non-object payloads, and missing sections. New suites `tests/token-contract.test.mjs` and `tests/project-state.test.mjs` prove the validators reject missing definitions, duplicate names, invalid thresholds, and invalid payloads. Existing UI and exports are byte-identical (fixtures regenerate without a diff; all six suites pass).

### Phase 2: Implement deterministic starting-system generation

Effort: Large

- [x] Add character presets: Balanced, Warm, Cool, Vivid, and Muted.
- [x] Add generated and provided Context modes.
- [x] Add Brand generation with bounded OKLCH candidates.
- [x] Add Neutral generation related to Brand character.
- [x] Reuse Secondary strategies without making Secondary a filled action.
- [x] Add semantic batch presets whose four colors are previewed and measured together.
- [x] Add Reroll for generated Brand, Neutral, and Secondary only.
- [x] Preserve all locked and explicitly provided seeds.
- [x] Store a reproducible generation seed and revision.
- [ ] Return diagnostics when bounded search uses its best candidate rather than a complete candidate.

Phase 2 result: `js/system-generator.js` builds one atomic seed proposal via `generateSystem({ currentState, options, randomSource })` — character presets (`balanced`, `warm`, `cool`, `vivid`, `muted`), generated/provided/locked Context with explicit `CONTEXT_TEXT_ON_BACKGROUND` failure, Brand generation inside character OKLCH bounds, low-chroma Neutral related to Brand temperature, Secondary from the accepted strategy offsets, and a four-color semantic batch with hue identity preserved. A deterministic mulberry32 PRNG (`createRandom`) is injected at the application boundary, so the same seed and options reproduce the same inputs and Reroll is a new seed with locks preserved. The bounded-search fallback diagnostic arrives with Phase 3's constraint solver. `tests/system-generator.test.mjs` covers determinism, revision variance, lock survival, exact provided Brand, Neutral's low-chroma contract, semantic hue families, sRGB validity, and explicit unresolved results.

Required tests:

- [x] the same random seed and options return the same generated system inputs;
- [x] different revisions can produce different unlocked inputs;
- [x] locks survive Generate and Reroll;
- [x] provided Brand remains exact at `500`;
- [x] Neutral stays inside its low-chroma contract;
- [x] semantic hue families remain recognizable;
- [x] every generated HEX is valid sRGB;
- [x] impossible requests return an explicit unresolved result.

Exit criteria:

- A pure function can create complete input seeds without DOM access.
- A user no longer needs to invent a HEX value to start.

### Phase 3: Resolve and validate website tokens in both themes

Effort: Large

- [x] Resolve all generic website tokens from existing palettes and assignments.
- [x] Resolve Light and Dark independently.
- [x] Implement state-family search for Default, Hover, and Pressed.
- [x] Keep one measured foreground stable across an interactive family.
- [x] Resolve focus rings against the actual adjacent surfaces.
- [x] Resolve field Default, Focus, Invalid, and Invalid + Focus through the accepted ownership model.
- [x] Resolve feedback text separately from 3:1 border/icon assignments.
- [x] Add `READY`, `READY WITH WARNINGS`, and `NEEDS ATTENTION` validation summaries.
- [x] Emit relationship diagnostics with path, actual ratio, required ratio, source coordinates, and suggested recovery.
- [x] (Phase 2 carryover) Return diagnostics when bounded search uses its best candidate rather than a complete candidate.

Phase 3 result: `WebsiteTokenContract.resolveWebsiteTokens()` resolves every generic website token per theme with traceability (source role, step or measured ink, generator) and records every measured relationship check against its actual surface. `summarize()` produces `READY` / `READY WITH WARNINGS` / `NEEDS ATTENTION` across both themes. Bounded searches: state families (chromatic darkening vs neutral mid-grey candidates so the quiet action's near-black ink never melts into a dark pressed state), focus rings (brand steps vs the surfaces controls actually touch — the overlay scrim is not an adjacency), and field borders (preferred coordinate first, then bounded list). Stage 7 repair redraws a generated Brand with a darkening bias only when required and only while unlocked; locked conflicts return `NEEDS ATTENTION` with the relationship, actual/required ratio, and recovery. Verification matrix: 4500 default generations (5 characters × 3 Secondary strategies × 300 seeds) all `READY`; locked white Brand returns `NEEDS ATTENTION` with the seed preserved; provided HEX stays exact at `500`; `aaa-interface` raises text to 7:1 and leaves non-text at 3:1; disabled Secondary leaves no accent tokens.

Required tests:

- [x] every required Light relationship passes for the default generated system;
- [x] every required Dark relationship passes for the default generated system;
- [x] action foreground passes against Default, Hover, and Pressed;
- [x] focus ring reaches 3:1 against each recorded adjacent surface;
- [x] muted and feedback text use text targets, not border/icon targets;
- [x] AAA raises text constraints without changing the 3:1 non-text threshold;
- [x] locked conflicts produce `NEEDS ATTENTION` instead of silent mutation;
- [x] disabled Secondary leaves no accent tokens or stale references.

Exit criteria:

- One proposal contains a complete website token set and evidence for both themes.
- No required generated state is accepted solely because its token number looks plausible.

### Phase 4: Add the Quick start and atomic proposal UI

Effort: Large

- [x] Add a bounded Quick start panel before the existing workflow.
- [x] Make English the initial language and update both catalogs together.
- [x] Add the three direct choices and one `Generate website system` action.
- [x] Keep direct HEX and OKLCH controls behind Advanced editing without removing them.
- [x] Render generation status and task summary without relying on color alone.
- [x] Auto-apply a valid first proposal only when state is untouched.
- [x] Add Apply, Reroll, Cancel, and Undo for later proposals.
- [x] Keep a failed proposal inspectable without replacing the active system.
- [x] Rename Step 03 to `Website tokens` and place Custom pairs beneath the generated contract.
- [x] Move the existing `Generate starter set` behavior behind compatibility/custom-pair UI after parity exists.
- [x] Update Steps navigation, anchors, minimize behavior, and active-section tracking.
- [x] Preserve reduced-motion behavior.

Phase 4 result: a `Quick start` section precedes the workflow with the three choices (character, Brand source with a revealed HEX field, Secondary strategy) and one `Generate website system` action. The first valid generation on an untouched session auto-applies; later generations stay proposals with `Apply` / `Reroll` / `Cancel` and `Undo` restores the previous system. A `NEEDS ATTENTION` proposal is inspectable, names each failing relationship with measured vs required ratio and recovery, and is blocked from Apply. Step 03 is now `Website tokens` (grouped Light / Dark contract with a validation badge) with `Custom pairs` beneath it; the starter-set action is relabeled `Generate compatibility pairs`. The Steps dock gained a Quick start entry and the Website tokens label; Context shows a generated/provided/locked source note. The default brand lock is treated as a starter convenience — explicit Quick start sources produce a fresh brand unless the user deliberately locked Brand (`state.userLocks`). AGENTS.md, both READMEs, and the GitHub Pages workflow now describe the running product: seven script owners in load order, eight test suites, and the Quick start flow. New suite `tests/quick-start.test.mjs` covers untouched auto-apply, proposal flow, locks, provided HEX, and blocked Apply.

Exit criteria:

- A fresh user reaches a rendered website system with one primary action.
- An expert can still enter exact Context and role values.
- Generation never destroys an edited system without an explicit Apply.
- Quick start remains usable at narrow width without horizontal scrolling.

### Phase 5: Bind Preview to website tokens

Effort: Medium

- [x] Replace Preview-only ad hoc color selection with website token consumption.
- [x] Keep one coherent workspace and identical markup across Light and Dark.
- [x] Bind navigation, surfaces, content, links, actions, fields, focus, feedback, structured data, and empty states to named website tokens.
- [x] Show the active token source and relationship result in the compact Theme palette.
- [x] Keep Secondary as a badge/accent treatment.
- [x] Make every unresolved Preview state link back to its website token or source role.

Phase 5 result: when a website system is applied, `renderPreviews()` derives the preview canvas, panel, sunken surface, text, muted text, and border from the website token contract (`surface.page`, `surface.raised`, `surface.sunken`, `content.primary`, `content.muted`, `border.default`) for both themes; the pre-generation fallback is preserved. The preview markup stays identical across Light and Dark. Theme palette cards are now buttons that name their token source (`action.primary.background`, `feedback.success.bold`, …), show the measured on-bold ratio and PASS / FAIL in text, and link back to the role in Colors via `data-select-role` — an unresolved state is always reachable from the card. Semantic variables still come from role assignments (the role layer is part of the export contract); the general UI variables come from website tokens. `tests/quick-start.test.mjs` asserts Light and Dark preview canvases and muted text equal the rendered token contract, and that palette cards carry token ids, results, and role links.

Exit criteria:

- Preview is a consumer of the export contract rather than a parallel color implementation.
- A CSS export applied to the same markup reproduces the visible theme assignments.

### Phase 6: Add layered export, persistence, and import

Effort: Large

- [x] Export Reference, Role, and Website layers as clearly separated CSS sections.
- [x] Prefer CSS aliases between layers so provenance remains inspectable.
- [x] Export schema-versioned project JSON with generation options, traceability, diagnostics, and custom pairs.
- [x] Add local Save, Load, New, JSON Download, and JSON Import actions.
- [ ] Confirm local storage and file import work through `file://`.
- [x] Preserve current `--color-*` and `--pair-*` variables for one compatibility window.
- [x] Add a visible deprecation note for legacy pair names when website equivalents exist.
- [x] Fail an invalid import without mutating or clearing the active project.
- [x] Add a Tailwind adapter that references website CSS variables rather than duplicating HEX values.

Phase 6 result: `WebsiteTokenContract.serializeCss()` emits the layered contract — Reference (`--palette-*`), Role (`--role-*-light/dark-{kind}`, aliased to reference tokens), and Website Light in `:root` with Website Dark in `[data-theme="dark"]`. Provenance stays inspectable: website tokens alias role tokens where the source is an assignment kind, else reference palettes; measured ink stays a literal HEX. The legacy `--color-*` and `--pair-*` sections are appended under visible deprecation comments for the compatibility window. JSON is now schema v2 (`palettes` / `assignments` / `website` / `validation` / `generation`), validated by `ProjectState.decode()` on every import and boot-time load. The Export section adds Save locally, New project, Download JSON, Import JSON (file input), and a Tailwind adapter copy that references website CSS variables only. Invalid imports fail with a visible toast and never mutate the active project. New fixtures `tests/fixtures/default-system-v2.{css,json}` freeze the layered default output; `scripts/regenerate-fixtures.mjs` regenerates all four fixtures.

Exit criteria:

- Reload restores the last applied project or reports a visible storage failure.
- Export → Import round trip preserves the visible system, locks, validation, and custom pairs.
- CSS, JSON, Tailwind, and Preview agree on website token values.

### Phase 7: Add product-specific coverage profiles

Effort: Medium per profile

Implement profiles one at a time after the generic contract is stable:

1. Dashboard / SaaS — **coverage mechanism and first profile implemented**
2. Marketing / Landing page — pending, follows the same pattern
3. Portfolio — pending, follows the same pattern
4. Documentation — pending, follows the same pattern

For each profile:

- [x] Define additional component token requirements only where the generic contract is insufficient.
- [x] Reuse the same Reference, Role, and Website layers.
- [ ] Specify which Preview modules demonstrate the profile.
- [x] Keep color character independent from product profile.
- [x] Add profile-specific relationship tests.
- [x] Avoid arbitrary industry palettes; product profile changes coverage, not semantic meaning.

Phase 7 result: `WebsiteTokenContract.PROFILE_EXTENSIONS` registers profiles as additive coverage contracts. The Dashboard / SaaS profile adds `surface.sidebar` (dark rail in Light, darker-than-page in Dark), `surface.tableStripe`, `content.tabular` (data text at the text target), `border.table`, and four `chart.series` tokens derived from the system's own Brand / Neutral scales. `resolveWebsiteTokens({ profileId })` merges profile tokens per theme; `validateProfile()` enforces coverage; `summarize()` evaluates profile relationships with the same target profile so required checks can never be downgraded to advisory; `serializeCss` / `serializeTailwind` include profile tokens additively (backward-compatible). A 100-seed matrix passes all required Dashboard relationships in Light and Dark. Remaining per profile: Preview modules that demonstrate the profile and the profile selection UI, which the plan defers beyond the generic release.

Exit criteria per profile:

- The profile adds concrete website coverage rather than a renamed preset.
- All added required relationships pass in Light and Dark.
- Export remains backward-compatible with the generic website contract.

### Phase 8: Remove duplicate policy and complete verification

Effort: Medium

- [x] Make website-token resolution the only starter generation owner.
- [x] Convert `starterPairSpecs()` into a compatibility projection or remove it after all callers and tests migrate.
- [x] Remove UI actions that duplicate Generate pipeline stages, while retaining equivalent Advanced controls.
- [x] Update `AGENTS.md`, both READMEs, the decision document, and older plan status.
- [ ] Update the GitHub Pages workflow to check every new JavaScript owner and test suite.
- [x] Confirm `scripts/prepare-pages.sh` includes all runtime files.
- [x] Refresh default CSS and JSON fixtures.
- [ ] Run the full static and browser verification matrices below.

Phase 8 result: `WebsiteTokenContract.compatibilityPairSpecs()` projects the applied website system onto pair coordinates (body text, muted text, link, primary / neutral / destructive actions, secondary accent, and per-semantic notices), so the compatibility-pair action derives from the website tokens that own the starter result. The legacy `starterPairSpecs()` remains only as the pre-generation fallback, with its comment updated. Advanced controls that mirror single pipeline stages (sync semantics, optimize) stay as intended. `scripts/prepare-pages.sh` already copies every runtime source; fixtures are current and regenerate idempotently. The GitHub Pages workflow update is blocked locally because the push token lacks the `workflow` scope — the change is ready and must land with workflow-scoped credentials. The static matrix (8 suites, 4500 default generations, artifact build, fixture idempotency) passes; the manual browser matrix remains open.

Exit criteria:

- There is one owner for each generation policy and export name.
- Documentation describes the running product rather than the proposed product.
- Static, browser, deployment-artifact, and direct `file://` results are reported separately.

## Export naming direction

Exact names belong in `docs/website-token-contract.md`, but CSS should follow this shape:

```css
:root {
  /* Reference */
  --palette-brand-600: #B7523A;

  /* Role */
  --role-brand-light-bold: var(--palette-brand-600);
  --role-brand-light-on-bold: #FFFFFF;

  /* Website */
  --surface-page: var(--role-neutral-light-subtle);
  --content-primary: var(--palette-neutral-950);
  --action-primary-background: var(--role-brand-light-bold);
  --action-primary-foreground: var(--role-brand-light-on-bold);
  --action-primary-background-hover: var(--palette-brand-700);
  --action-primary-background-pressed: var(--palette-brand-800);
}

[data-theme="dark"] {
  --surface-page: var(--role-neutral-dark-subtle);
  --content-primary: var(--palette-neutral-50);
  --action-primary-background: var(--role-brand-dark-bold);
  --action-primary-foreground: var(--role-brand-dark-on-bold);
}
```

Theme-level website names stay stable. Consumers should not have to append `light` or `dark` to component token names.

## Migration and compatibility strategy

### Current state

- No local persisted project exists today, so there is no local-storage migration requirement for existing users.
- Current CSS and JSON exports may already have consumers, so names cannot disappear without a compatibility window.
- Existing Saved pairs are explicit snapshots and must remain unchanged unless the user edits them.

### Migration rules

1. Add website tokens without removing current palette, role, or pair output.
2. Add `schemaVersion: 2` to new JSON exports.
3. Keep current CSS variables as aliases or duplicate compatibility output for one release window.
4. Keep current custom pairs under `pairs`; add generated website tokens under `website`.
5. Do not convert custom pair snapshots into live website assignments.
6. Do not replace a user-edited pair when regenerating the website system.
7. Remove legacy generation UI only after website-token parity, fixture parity, and browser QA.

## Test strategy

### Syntax and static contracts

- `node --check` every JavaScript owner.
- Confirm every runtime source is loaded exactly once and in dependency order.
- Confirm no duplicate IDs or missing selectors.
- Confirm EN and 中 catalogs have identical keys.
- Confirm generated website token names are unique and complete.
- Confirm every CSS `var()` reference resolves within the export.

### Pure unit tests

- Existing color parsing, conversion, gamut, scale, and contrast tests.
- Deterministic generation by random seed.
- Lock and provided-seed preservation.
- Semantic hue-family preservation.
- Context generation and repair.
- Website token resolution for Light and Dark.
- Relationship-specific thresholds.
- Bounded search and unresolved diagnostics.
- Schema validation and import round trip.
- CSS, JSON, and Tailwind serializer parity.

### Application smoke tests

- Fresh-state one-click generation.
- Provided Brand HEX generation.
- Generated Brand Reroll.
- Lock survival.
- Secondary None / Analogous / Contrasting.
- First auto-apply versus later proposal approval.
- Cancel and Undo.
- Required failure remains visible.
- Target-profile change re-resolves and revalidates.
- Website token navigation to source role.
- Custom pair add, edit, duplicate message, remove, and export.
- Project save, reload, import, invalid import, and new project.
- English / Chinese switching after generation.

### Browser verification

Run separately from source tests:

- direct `file://` opening;
- desktop target width;
- narrow mobile width;
- keyboard-only Quick start, proposal actions, Advanced editing, Preview, and Export;
- focus visibility and reduced motion;
- Context PASS and FAIL examples;
- Light and Dark Preview parity;
- Default, Hover, Pressed, Focus, Invalid, and Invalid + Focus;
- clipboard success and failure;
- JSON download/import and local reload;
- no horizontal overflow in Quick start and Website tokens;
- generated failure task remains readable and does not rely on color alone.

### Deployment verification

- Run all tests in `.github/workflows/pages.yml`.
- Build `_site/` from a clean workspace.
- Confirm every new JavaScript source is present in `_site/js/`.
- Open the prepared artifact over HTTP and verify startup.
- Report artifact preparation separately from GitHub Pages deployment success.

## Observability contract

Every generation or import diagnostic uses a stable code and includes enough context to reproduce the issue:

```js
{
  code: 'ACTION_PRIMARY_HOVER_TEXT_CONTRAST',
  severity: 'error',
  theme: 'dark',
  path: 'action.primary.hover',
  foreground: '#FFFFFF',
  background: '#A23D2C',
  actual: 4.18,
  required: 4.5,
  sourceRole: 'brand',
  attemptedSteps: [700, 800, 600],
  recovery: 'Adjust Brand or unlock generated assignments'
}
```

Rules:

- errors appear in the result summary and console;
- warnings appear in diagnostics and export;
- no empty catch blocks;
- no generic “generation failed” when a relationship path is known;
- no automatic reset after invalid storage or import data.

## Risks and mitigations

### Scope expands into a general website builder

Mitigation: generate color tokens and representative Preview modules only. Do not generate layout, typography, content, or application code.

### Automatic repair destroys Brand identity

Mitigation: search assignment coordinates before seed changes, preserve provided and locked seeds, preserve semantic Hue, and report unresolved conflicts.

### Quick start duplicates the expert workflow

Mitigation: Quick start owns generation; Context, Colors, and Custom pairs own inspection and manual adjustment. Remove duplicate policy after parity.

### Website tokens become another redundant report

Mitigation: Website tokens are the export and Preview contract, not a second view of the same role assignments. Show them by component intent and keep raw assignments in Advanced detail.

### Light passes while Dark quietly fails

Mitigation: both themes are required inputs to one validation status. A system cannot be `READY` when either theme has a required failure.

### Reroll becomes irreproducible

Mitigation: store the random seed and revision; keep pure generation functions injectable and deterministic in tests.

### Export names break current consumers

Mitigation: additive output first, compatibility aliases for one release window, fixture comparison, and explicit deprecation before removal.

### Persistence hides schema problems

Mitigation: strict decode, explicit schema version, non-mutating invalid import, and visible recovery actions.

### Bounded search is slow or cannot solve a locked system

Mitigation: use finite candidate lists, record attempted coordinates, keep the best measured proposal, and return `NEEDS ATTENTION` rather than looping or weakening requirements.

## Milestones

| Milestone | Phases | User-visible result |
| --- | --- | --- |
| M0 · Contract and baseline | 0–1 | Stable website token and validation contracts with no UI regression |
| M1 · Generation engine | 2–3 | Deterministic complete proposals with Light / Dark evidence |
| M2 · Starter experience | 4–5 | One-click Quick start and Preview driven by website tokens |
| M3 · Durable handoff | 6 | Save, import, layered CSS/JSON, and Tailwind output |
| M4 · Coverage expansion | 7 | Dashboard, Marketing, Portfolio, and Documentation profiles |
| M5 · Consolidation | 8 | One generation owner, updated contracts, and complete verification |

The implementation should land milestone by milestone. Do not combine M1 through M3 into one unreviewable change.

## Full success criteria

- [ ] A fresh user can generate a complete initial system without entering HEX.
- [ ] Quick start requires no more than three direct choices and one primary generation action.
- [ ] Generated Context Text on Background passes 4.5:1.
- [ ] Generated Brand, Neutral, optional Secondary, and semantic roles preserve the accepted role model.
- [ ] Locked and explicitly provided seeds survive Generate, Reroll, and repair.
- [ ] Both Light and Dark resolve the complete generic website token contract.
- [ ] Every required text, non-text, focus, and interactive-state relationship uses its applicable target.
- [ ] Interactive foreground remains stable across Default, Hover, and Pressed.
- [ ] A required failure produces `NEEDS ATTENTION`, never a false `READY`.
- [ ] Preview consumes website tokens rather than separate ad hoc color selection.
- [ ] Website token names remain stable across Light and Dark.
- [ ] Custom Saved pairs remain editable snapshots and do not become live assignments.
- [ ] CSS, JSON, Tailwind, Preview, and imported projects agree.
- [ ] Invalid input, failed search, gamut reduction, storage failure, import failure, and copy failure remain observable.
- [ ] English and Chinese catalogs remain complete.
- [ ] Direct `file://` use continues to work.
- [ ] Desktop and narrow browser checks pass and are reported separately from static tests.
- [ ] GitHub Pages verification includes every new source and test owner.

## Approval gate

Code implementation does not begin until the owner confirms these three decisions:

1. The first release generates one generic website system; product-specific profiles follow after the contract is stable.
2. Step 03 becomes `Website tokens`, with existing Saved pairs retained as `Custom pairs` beneath it.
3. The first untouched generation auto-applies when valid; later generation stays a proposal until explicitly applied.

Once approved, update this plan as phases complete. If the token contract, source ownership, or product flow changes materially, revise this file before changing implementation.
