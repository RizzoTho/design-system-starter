# Plan: Reduce friction from seed to a usable set of colors

## Goal

A starter should reach a batch of usable, exportable color combinations without inventing a HEX value first and without assembling pairs one at a time.

The accepted product and color decisions live in [`docs/color-role-model.md`](../docs/color-role-model.md). The eight-role execution history lives in [`2026-07-20-color-role-expansion.md`](2026-07-20-color-role-expansion.md). This file owns the next round of friction reduction only.

> **Superseded by [`2026-08-09-one-click-website-color-system.md`](2026-08-09-one-click-website-color-system.md).** That plan's Quick start generation subsumes the unfinished Reroll (Phase 3) and semantic preset batch (Phase 4) work below. The completed pair phases (cross-role pairs, starter set, Secondary-as-accent) remain valid, are still the running product, and must not be silently removed. The website token contract lives in [`docs/website-token-contract.md`](../docs/website-token-contract.md).

## Current state

The previous round moved role checks into Colors, replaced the contrast matrix with a Pair editor, and made semantic optimization a single action. The middle of the workflow is no longer the bottleneck. Two ends remain.

**Entry.** Step 02 opens with a HEX input. A user who does not already have a brand color has nothing to act on. Every downstream generator is fully determined by that one value, so the workflow is blocked at its cheapest-to-unblock point.

**Exit.** Step 03 starts with one default `Brand 50 on Brand 600` pair and an `Add pair` button. The real need is almost always a set — primary action, secondary action, body text on surface, muted text, danger action, and so on. Producing that set is currently N manual rows, and every row costs four field decisions.

## What already exists to build on

- `resolveAssignments()` resolves `subtle`, `borderIcon`, `bold`, and `onBold` for every palette owner in both Light and Dark, with measured ratios and pass state. A starter pair set is a projection of data the model already computes; it is not new color math.
- The Pair editor's coordinate model is `roleId` plus `foregroundStep` and `backgroundStep`, which keeps pairs stable across palette edits and deduplicates correctly.

## Model gap this exposes

A saved pair draws both its foreground and its background from **one** role palette. `updatePairField()` resolves both steps against a single `nextRoleId`.

This is fine for `Brand 50 on Brand 600`, but it cannot express the most common real combinations:

- `Brand 600` link text on a `Neutral 50` surface;
- `Neutral 900` body text on a `Neutral 50` surface next to a `Danger 600` action on the same surface;
- any assignment whose `onBold` foreground is measured white or black rather than a palette step.

A meaningful starter set is mostly cross-role. The pair model must gain an independent foreground role and background role before the set is worth generating, and it must be able to hold a measured foreground that is not a token step.

This is the first phase, not a detail of the second.

## Decisions

**The starter set is a set of component combinations, not a full assignment table.** Roughly 8–12 pairs named by product intent — "Primary action", "Body text", "Warning notice" — rather than by position in the role model. The four-layer `subtle` / `borderIcon` / `bold` / `onBold` table stays where it already lives, in CSS and JSON export, and does not occupy Step 03. Deletion is cheaper than construction, so the set errs toward covering a real screen.

**Seeds are chosen by rerolling, not by picking a preset industry.** Named industry starting points are dropped. A user converges by rerolling what they have not yet committed to, which reuses the lock control that already exists.

**The eight roles split into three groups by how their color is chosen.**

| Group | Roles | Mechanism | Why |
| --- | --- | --- | --- |
| Rerolled | `Brand`, `Secondary`, `Neutral` | Randomize with lock | These are the three decisions Step 02 already asks for, and they have no correct answer to preset |
| Preset | `Success`, `Warning`, `Danger`, `Information` | Choose from batches | Hue identity is fixed by meaning; only character varies, which is exactly what a preset can carry |
| Derived | `Regular` | Follows `Neutral` | Alias under the accepted role model; it has no seed to reroll or preset |

`Regular` is neither rerolled nor preset. It is an alias of `Neutral`, so it changes when `Neutral` changes and needs no control of its own. It still appears in the interface as one of the component states alongside the four semantic roles.

This split is not cosmetic. Rerolling a semantic role would be wrong — `Danger` must stay red — so one mechanism cannot serve both of the first two groups.

## Constraints

Inherited from the existing plan and unchanged:

- preserve `file://` execution;
- no framework, build step, or dependency;
- one application state owner;
- WCAG calculation stays deterministic and centralized;
- reference palette generation stays separate from semantic assignment;
- gamut reduction and calculation failure stay observable;
- every user-facing string is added to both the English and Chinese catalogs.

Added for this round:

- a generated set must be inspectable and removable per pair, never an opaque bundle;
- generation must not overwrite pairs the user already edited;
- every generated pair carries its measured contrast against the active target, including the ones that fail;
- randomness must be injectable. Every reroll function takes a random source as an argument so tests can pin it. Calling `Math.random()` inside color logic would make `tests/color-engine.test.mjs` non-deterministic, which the existing suite depends on;
- a reroll or a preset changes unlocked roles only, matching how semantic generation already behaves.

## Phases

### Phase 1: Let a pair span two roles

- [x] Give a saved pair an independent foreground role and background role.
- [x] Allow a foreground that is a measured color rather than a palette step, so `onBold` assignments are expressible.
- [x] Extend pair identity and deduplication to the wider coordinate.
- [x] Keep existing single-role pairs valid; migrate the default pair without changing what it renders.
- [x] Update the Interactive state family so Hover and Pressed still derive from the background role's scale.
- [x] Extend CSS and JSON export to the wider coordinate.

Exit criteria:

- `Brand 600` on `Neutral 50` is expressible and exports correctly.
- The default `Brand 50 on Brand 600` pair is unchanged on screen.
- Editing either role re-evaluates contrast and state families immediately.
- All four test suites pass.

### Phase 2: Generate a starter set

The set below is the target. It covers the surfaces, actions, and status messages a starter needs to build one screen.

| # | Name | Foreground | Background | Usage |
| --- | --- | --- | --- | --- |
| 1 | Body text | `Neutral` strongest passing | `Neutral` `subtle` | Static |
| 2 | Muted text | `Neutral` weakest passing | `Neutral` `subtle` | Static |
| 3 | Link | `Brand` strongest passing | `Neutral` `subtle` | Static |
| 4 | Primary action | `Brand` `onBold` | `Brand` `bold` | Interactive |
| 5 | Secondary action | `Secondary` `onBold` | `Secondary` `bold` | Interactive |
| 6 | Neutral action | `Neutral` strongest passing | `Neutral` raised surface | Interactive |
| 7 | Destructive action | `Danger` `onBold` | `Danger` `bold` | Interactive |
| 8 | Success notice | `Success` strongest passing | `Success` `subtle` | Static |
| 9 | Warning notice | `Warning` strongest passing | `Warning` `subtle` | Static |
| 10 | Danger notice | `Danger` strongest passing | `Danger` `subtle` | Static |
| 11 | Information notice | `Information` strongest passing | `Information` `subtle` | Static |

Ten pairs with `Secondary` disabled, eleven with it enabled.

Rows 4, 5, and 7 are direct projections of resolved assignments. The rest need one derivation the assignment model does not currently expose: the strongest-contrast token that meets the active target against a given background. `borderIcon` is checked at 3:1 and is meant for borders and icons, so it is not a safe default for notice text. Reuse the existing `strongestContrastToken()` helper rather than adding a second selection rule.

- [x] Add target-aware foreground selection against a given background token.
- [x] Add one action in Step 03 that generates the set.
- [x] Name each generated pair by product intent, not by token position.
- [x] Skip roles that are disabled; do not fabricate a `Secondary` row when `Secondary` is off.
- [x] Append rather than replace when the user already has pairs, and do not duplicate rows that already exist.
- [x] Show failing generated pairs with their measured gap instead of silently dropping them.

Two things changed during implementation.

**Notice and link foregrounds take the least contrast that passes, not the most.** The table above said "strongest passing" for every text row. That is wrong for anything whose meaning is carried by its hue: maximizing contrast pushes `Success` text to near-black and throws away the green. Body text and neutral actions still maximize contrast; links and status text take the minimum that passes. Both modes live in `foregroundToken()`.

**Regenerating after a target change can leave two rows sharing a name.** Dedup is by coordinate, and a different target resolves different tokens, so the new row is genuinely a new coordinate. The older row stays and is visibly failing. This follows the append-never-overwrite rule, and showing both beats silently rewriting a pair the user may have edited — but if it proves annoying, refreshing a generated row in place is the alternative.

**Sub-decision: which theme does the set come from?** Assignments resolve per theme; a saved pair has no theme field. Generating both themes would double the set to twenty-two rows and contradict the size decision above. Generate from the Light assignment set, and leave Dark where it already lives in export. Revisit only if Dark-first turns out to be a real starting point for users.

Exit criteria:

- One action moves a starter from a seed to the full set of inspectable pairs.
- Every generated pair is individually editable and removable, exactly like a hand-made one.
- Disabling `Secondary` and regenerating produces no stale tokens.
- Generated pairs and hand-made pairs are indistinguishable in the export contract.
- Changing the global target re-evaluates every generated pair.

### Phase 2.5: Stop teaching a second filled action

Found by an external color review and confirmed against this project's own role model, which states that `Secondary` must not replace neutral secondary UI by default. Both the Preview and the generated set did exactly that.

- [x] Make the Preview's second action neutral with an outline instead of a saturated fill.
- [x] Give `Secondary` an accent use in the Preview — it colors the status badge, not a control.
- [x] Replace the generated `Secondary action` row with a `Secondary accent` pair on the Neutral surface.
- [x] Keep the quiet `Neutral action` row as the second button.

Exit criteria:

- Only one control in an action group carries a saturated fill.
- Enabling `Secondary` adds an accent pair, never an interactive filled row.
- A panel-scoped semantic action, such as the warning banner's, may still be filled.

### Phase 3: Reroll Brand, Secondary, and Neutral

- [ ] Add a reroll action for the palette-seed group that changes unlocked roles only.
- [ ] Take the random source as an argument so the behavior is testable.
- [ ] Draw `Brand` as a free hue with lightness and chroma constrained to a usable band, expressed as a fraction of the maximum chroma available at that lightness and hue.
- [ ] Draw `Neutral` at low chroma, with its hue related to `Brand` so temperature stays a deliberate choice rather than an accident.
- [ ] Draw `Secondary` from the existing strategy suggestions rather than a free hue, so it stays a considered second accent.
- [ ] Bias each draw toward the fixed `Background` and the active target, with a bounded number of attempts and a fallback to the best candidate found.

Biasing the draw matters more than it looks. An unbiased reroll produces seeds that fail Role checks, which sends the user back through optimization on every attempt and reinstates the friction this round exists to remove. A bounded retry is cheap because the gamut math is already there.

Exit criteria:

- A user with no color in mind reaches a complete generated system by rerolling.
- Locked roles survive every reroll.
- Repeated rerolls with a pinned random source are reproducible.
- Direct HEX entry is not displaced as the primary control.
- `Secondary` reroll stays within its selected strategy.

### Phase 4: Offer preset batches for the four semantic roles

- [ ] Define several batches. Each batch sets the character of `Success`, `Warning`, `Danger`, and `Information` while preserving their hue identity.
- [ ] Present batches as a choice, showing all four swatches together rather than one role at a time.
- [ ] Show each batch's measured result against the current `Background` and target before it is applied.
- [ ] Apply to unlocked roles only.
- [ ] Leave `Regular` out of the batch entirely; it follows `Neutral` and has no seed to set.

Batches vary chroma and lightness character, not meaning. `Danger` stays red in every batch. Candidate directions: a vivid set, a muted set for dense or data-heavy interfaces, and a deep set for higher contrast. The existing per-family chroma caps remain the ceiling.

This satisfies the accepted invariant that a suggestion is accepted together with its contrast result, applied to a batch instead of a single role.

Exit criteria:

- Every batch keeps `Success` green, `Warning` amber, `Danger` red, and `Information` blue.
- Selecting a batch never changes a locked role.
- Each batch shows pass or fail before it is applied, and the display re-evaluates when the target changes.
- Batches remain distinguishable without relying on color alone.

## Out of scope

- Named industry starting points. Dropped in favor of rerolling.
- Extracting a seed from an uploaded image. It is the only entry mechanism that needs new input handling and file reading, and the only one at risk against `file://` execution. Separate work if it is wanted later.
- Rerolling semantic roles. Their hue identity is fixed by meaning.
- Generating the starter set for both themes at once.
- Color-vision-deficiency simulation.
- A complete dual-theme token system beyond what export already emits.
- Persistence of a session across reloads.
- Reintroducing the contrast matrix or a standalone semantic assignment report.

## Verification

Follow the existing checklist in `AGENTS.md`. This round adds:

1. Build a cross-role pair by hand; confirm contrast, Interactive states, and export.
2. Generate the starter set on a default seed; confirm the count, the names, and that each pair carries a measured result.
3. Disable `Secondary`, regenerate, and confirm ten rows and no stale tokens in CSS or JSON.
4. Generate twice; confirm no duplicates and no loss of edited pairs.
5. Change the global target; confirm every generated pair re-evaluates.
6. Lock `Brand`, reroll several times, and confirm `Brand` never changes while `Neutral` and `Secondary` do.
7. Reroll with a pinned random source twice; confirm identical results.
8. Apply each preset batch; confirm hue identity holds, locked roles are untouched, and each batch shows its result before it is applied.
9. Report static checks and browser checks separately.

Required tests, extending `tests/color-engine.test.mjs` and `tests/app-smoke.test.mjs`:

- reroll with a pinned random source is reproducible;
- reroll never changes a locked role;
- a biased draw returns an in-gamut seed and reports when it fell back;
- every preset batch keeps its four semantic hue families;
- starter-set generation is idempotent; running it twice produces no duplicates;
- generated pairs survive a target change with re-evaluated results.
