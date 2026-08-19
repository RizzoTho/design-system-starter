# Accessible Color Picker local contract

## Project purpose

This project is a small, standalone color design system tool inspired by MGifford UI Palette Generator.

Two paths share one system. `Quick start` asks for a color character, a Brand source, and a Secondary strategy, then generates a complete accessible website color system in one action — no HEX value required. `Advanced editing` keeps the direct workflow: Background, Text, Brand, Neutral, optional Secondary, semantic roles, locks, scales, Role checks, and Custom pairs. Every result is inspected through WCAG contrast relationships, previewed as a real website page, and exported.

Do not turn it into a generic color picker. Its core question is:

> With a small amount of direction, can the tool generate the website surfaces, content, actions, form states, feedback colors, interaction states, and Light / Dark mappings needed to start building?

## Current source of truth

- `index.html` owns the runnable page structure and loads the standalone source files in dependency order.
- `styles.css` owns all visual and responsive styles.
- `js/color-engine.js` owns pure color parsing, conversion, scale, luminance, and contrast calculations.
- `js/i18n.js` owns the complete English and Chinese catalogs plus language switching. English is the default.
- `js/role-model.js` owns role definitions, suggestions, palette aliases, semantic assignment resolution, and default color state.
- `js/token-contract.js` owns the generic website token definitions, target profiles, relationship definitions, Light / Dark website-token resolution, and validation summaries.
- `js/system-generator.js` owns character presets, deterministic Context / Brand / Neutral / Secondary / semantic batch generation, bounded constraint search, and the end-to-end `generateSystem()` proposal builder.
- `js/project-state.js` owns schema version 2, strict project encode/decode/validation, and storage payload preparation.
- `js/select.js` owns the shared dropdown control: it upgrades every `<select>` to a listbox and keeps presentation and keyboard behavior only. The native `<select>` stays in the DOM as the value owner, so `.value`, the bubbling `change` event, its data attributes, and `i18n` translation of the `<option>` text all keep working.
- `js/app.js` owns the single mutable state, rendering, interaction, navigation, direct Quick start generation, failed-generation reports, one-level Undo, copy, and export behavior.
- `scripts/prepare-pages.sh` owns the clean `_site/` artifact used for GitHub Pages deployment.
- `.github/workflows/pages.yml` owns verification and deployment to the `github-pages` environment from `main`.
- `AGENTS.md` owns the project intent and maintenance rules.
- Browser script load order: `color-engine.js` → `i18n.js` → `role-model.js` → `token-contract.js` → `system-generator.js` → `project-state.js` → `select.js` → `app.js`. `index.html` and `tests/static-contract.test.mjs` enforce it.
- There is no package manager, framework, or generated source. GitHub Pages uses a dependency-free packaging script that copies runtime files into ignored `_site/` output.
- The page must continue to work when `index.html` is opened directly through `file://`.

## Eight-role model

- `docs/color-role-model.md` owns the accepted product and color decisions for the eight-role expansion.
- `docs/website-token-contract.md` owns the accepted website token, target profile, and relationship decisions.
- `plans/2026-07-20-color-role-expansion.md` owns the eight-role implementation history.
- `plans/2026-08-06-starter-pair-set.md` owns the starter-pair history; its unfinished Reroll and preset phases are subsumed by the current plan.
- `plans/2026-08-09-one-click-website-color-system.md` owns the current one-click implementation phases.
- Eight visible roles are `Brand`, `Neutral`, optional `Secondary`, `Regular`, `Success`, `Warning`, `Danger`, and `Information`.
- `Regular` is a read-through alias of `Neutral`; it never owns a duplicate palette.
- Semantic families keep recognizable hue ranges. Brand may influence their tonal and chroma character, but not rename or replace their semantic identity.
- Hue-family names such as Coral, Teal, or Amber are not part of the user-facing model. The UI names purpose; HEX and OKLCH own the actual color.

If the project later adopts a framework or build system, update this file in the same change and identify the new source files and build output explicitly.

## Product flow

The default route is `Quick start`: up to three direct choices (color character, Brand source, Secondary strategy) and one `Generate website system` action. Every valid generation applies immediately; pressing Generate again is the reroll. The result links directly to Preview, and one-level `Undo` restores the system that was active before the latest generation. A `NEEDS ATTENTION` attempt never replaces the current system.

After generation, `Advanced editing` provides three ordered steps plus two separate result destinations:

1. `Context`: the fixed Background and Text colors (generated by Quick start or provided by the user) with an explicit PASS or FAIL result for normal text at 4.5:1.
2. `Colors`: define Brand and Neutral, optionally add Secondary, generate semantic suggestions, inspect each active 50–950 scale, and review role checks against the current target.
3. `Website tokens`: the generated system as purpose-named tokens for both themes, an additive `General / Dashboard / Marketing / Portfolio / Documentation` coverage selector, and `Custom pairs` (editable foreground/background snapshots) nested beneath it.

After those steps:

- `Preview`: review the current system as one landing page in Light or Dark. It is an unnumbered result destination, not a workflow step. Light and Dark are switched locally inside Preview and are not shown simultaneously.
- `Export`: copy CSS variables or JSON. It is an unnumbered result destination alongside Preview.

The floating Steps window is the navigation owner for this sequence: Quick start, then Context, Colors, and Website tokens carry the ordered entries, and `Preview` and `Export` remain separate, unnumbered entries at the same navigation level. Every destination must have a stable anchor and participate in active-section tracking. The WCAG target is a global control in the bottom-right Steps window, not a page-local step.

## Color and accessibility rules

- WCAG contrast uses relative luminance. Keep the calculation deterministic and centralized in `luminance()` and `contrast()`.
- `Context` always evaluates `Text on Background` against 4.5:1 and reports `PASS · AA`, `PASS · AAA`, or `FAIL` visibly. Do not communicate status through color alone.
- The selectable target controls active role checks, generated semantic assignment data, and saved-pair evaluation. Current targets are AA normal text 4.5:1, AA large text 3:1, and AAA normal text 7:1.
- The generated website system uses a target profile (`aa-interface` by default, `aaa-interface` available) rather than one blanket ratio: normal text 4.5:1 (7:1 under AAA), explicitly large text 3:1 (4.5:1 under AAA), and meaningful border / icon / indicator / focus 3:1 in both profiles. The advanced `AA large text · 3:1` option remains only for explicitly tagged Advanced pairs.
- The website token contract is generic. Product coverage profiles (Dashboard, Marketing, Portfolio, Documentation) were removed along with their Preview modules: a per-product token set could not be proved by one honest website page, and the generic contract already covers surfaces, content, actions, fields, feedback, and accent. Do not reintroduce a product-specific token layer without a Preview surface that measures it.
- The website token contract has three layers: `reference` (`--palette-{roleId}-{step}`), `role` (`--role-{roleId}-{theme}-{kind}`), and `website` (theme-stable names such as `--surface-page`, `--content-primary`, `--action-primary-background`). Light and Dark resolve the same website names independently. Details and the full token list live in `docs/website-token-contract.md`.
- Every resolved website token carries traceability (source role, source step or measured ink, generator). A measured black or white foreground uses `measured-ink` and has no fake palette step.
- Validation statuses: `READY` (every required relationship passes in both themes), `READY WITH WARNINGS` (advisory diagnostics remain), and `NEEDS ATTENTION` (a required relationship is unresolved and must name the relationship, actual ratio, required ratio, and recovery). A system is never `READY` when either theme has a required failure.
- Reference palettes are generated in OKLCH. Keep the exact input seed at `500`, use one shared tonal rhythm, and apply per-family chroma limits.
- For every non-seed step, derive chroma as a family-relative percentage of the sRGB maximum for that step's `L` and `H`; do not reuse Brand's absolute `C` across semantic hues.
- Steps 50-200 additionally take an absolute chroma floor so a tint still reads as its hue. Near white the sRGB gamut is narrow, so a percentage of a percentage collapses to grey; the floor is absolute rather than a share of the maximum because available chroma swings roughly fourfold across hues at those lightnesses. Neutral is excluded, and the floor never reaches the seed or the bold end, so the Brand-over-semantics hierarchy is untouched.
- Generated color hierarchy is intentional: Neutral is a near-achromatic foundation, Brand owns recurring emphasis, and unlocked semantic families stay below the generated Brand's relative chroma budget. Semantic hue identity stays recognizable, but semantic color is a local status signal rather than ambient surface tint.
- If an OKLCH request is outside sRGB, reduce chroma while preserving lightness and hue as far as possible, and expose a diagnostic with the requested and actual chroma instead of silently clipping.
- Generated scale usage labels are recommendations, not guarantees:
  - 50–200: page and surface
  - 300–400: border and muted
  - 500: seed
  - 600–700: action and pressed state
  - 800–950: strong and dark surfaces
- `W` and `K` show each token's contrast ratio against White and Black.
- In the Custom pairs editor, the pair editor exposes Foreground role, Foreground token, Background role, Background token, and Usage. A pair's foreground and background are chosen independently, so a foreground from one role may sit on a background from another. `Aa` is the actual foreground-on-background sample and the number is the contrast ratio.
- A Foreground token may be `auto`, which measures readable ink for the resolved background instead of naming a palette step. This is how an on-bold foreground is expressed. When a foreground is `auto`, its role has no effect and the Foreground role control is disabled.
- Custom pairs start with Brand `50` on Brand `600`. Editing a field re-evaluates the pair immediately; duplicate coordinates must remain visible as a clear message instead of silently creating duplicate exports.
- Button text must be selected by measured contrast. Do not assume a fixed light or dark text color from token number alone.

## Interaction contract

- The fixed top-right `EN / 中` control switches the whole product copy. English is active on first load.
- Every user-facing title, description, button label, status, and feedback change must update both `en` and `zh` catalogs in the same change.
- Product and technical terms such as Brand, Neutral, Secondary, Regular, Success, Warning, Danger, Information, WCAG, AA, AAA, OKLCH, HEX, CSS, JSON, token, palette, surface, and contrast remain untranslated where they are the clearest label.
- Missing translation keys or mismatched catalogs must fail visibly. Do not add a silent language fallback.
- Quick start: every valid Generate applies atomically and immediately. Repeating Generate produces a fresh deterministic revision with the same choices. The applied status offers Preview and one-level Undo; it does not show Apply / Reroll / Cancel confirmation controls. A `NEEDS ATTENTION` attempt is inspectable and dismissible, names the failing relationships and recovery, and never replaces the active system.
- Quick start generation is deterministic: the same character, Brand source, Secondary strategy, and random seed reproduce the same inputs. Locks survive repeated Generate. The starter default lock on Brand is a convenience, not a commitment — explicit Quick start sources produce a fresh brand unless the user deliberately locked Brand in Advanced editing. An explicitly provided Brand HEX stays exact at `500`.
- Background, Text, and every enabled palette owner accept direct HEX input and native color input. Generated and provided Context values are marked by source in the Context panel; a user edit turns the source into `provided`.
- Invalid HEX must be marked invalid without silently changing the last valid color.
- Clicking a Generated scale token copies its HEX value and applies it to the active palette owner.
- Switching roles must preserve independent seeds and locks. Automatic generation changes unlocked roles only.
- Disabling Secondary must remove its palettes and exports without leaving stale tokens.
- Step 03 starts with one default `Brand 50 on Brand 600` pair. Foreground role, Foreground token, Background role, Background token, and Static/Interactive Usage are directly editable; changes re-evaluate the pair immediately. Add pair creates another editable row, and saved pairs remain removable from Step 03.
- Interactive Hover and Pressed derive from the background role's scale, never the foreground role's. An `auto` foreground is measured once against the Default background and held across states so a control cannot flip its ink mid-interaction.
- The Custom pairs compatibility action generates a set of pairs named by product intent: body text, muted text, link, primary/secondary/neutral/destructive actions, and one notice per semantic role. Disabled roles are skipped rather than fabricated. The set is generated from Light assignments; Dark stays in export. It is a compatibility projection — the generated website system is the starter-result owner.
- Starter foregrounds are selected against the active text target, not from `borderIcon`, which is chosen at 3:1 for borders and icons. Body text and neutral actions take the most readable token; links and status text take the least contrast that still passes, so the role's hue stays recognizable instead of collapsing to near-black.
- Generating appends and never overwrites. A coordinate that already exists is skipped. Because a changed target produces different coordinates, regenerating after a target change can leave two rows sharing a product-intent name — the older one visibly failing. That is preferred over silently rewriting a pair the user may have edited.
- A generated pair exports under its product intent (`--pair-body-text-*`). Unnamed pairs keep role-indexed names (`--pair-brand-1-*`).
- Saved pairs are re-evaluated when the global target changes and are included in CSS and JSON export.
- Step 03 (`Website tokens`) shows the generated contract grouped by intent — surfaces, content, borders and focus, actions, fields, feedback, and the optional Secondary accent — with Light and Dark values per token and a validation status. The `Generate compatibility pairs` action in Custom pairs is a legacy projection kept for the compatibility window; the generated website system is the starter-result owner.
- Changing an Advanced role re-resolves Preview, validation, CSS, JSON, and Tailwind from the same state owner. A project saved with a retired coverage profile fails to import visibly; it is never repaired by silently dropping the profile.
- Custom pairs are editable snapshots with an explicit `Static` or `Interactive` use. `Interactive` derives stable Default, Hover, and Pressed backgrounds from the saved scale plus a Brand focus ring. Every exported state keeps its measured contrast result; later palette edits must not silently change an existing snapshot. Custom pairs never overwrite generated website tokens.
- Step 03 must explain the usage boundary before selection: `Static` is for non-interactive text, surfaces, and icons; `Interactive` is for controls that need Default, Hover, Pressed, and Focus states.
- Role checks belong to Step 02 Colors. Results below the active target are optimization tasks, not passive diagnostics. Show a visible task summary, name the failing relationship and measured gap, and label each affected role with text or icon in addition to color. Clicking a check row opens that role in Colors; check rows must not copy diagnostic text.
- Export is layered: Reference, Role, and Website CSS sections with alias provenance, then the compatibility `--color-*` / `--pair-*` block under a visible deprecation note. JSON is schema v2 and round-trips through import.
- The Export section owns project persistence: Save locally (localStorage), New project, Download JSON, Import JSON, and a Tailwind adapter that references website CSS variables. Boot-time Load restores the last saved project; a bad stored project or invalid import reports a visible failure and never replaces the active project.
- Every dropdown is the one listbox in `js/select.js`; do not leave a bare native `<select>` on the page. A native select on macOS opens its menu over the trigger so the current option lines up with the closed control, which reads as the control being covered rather than expanded. The menu opens below its trigger and flips above it only when the viewport leaves no room below. Selection is marked by weight and a check mark, never by the highlight colour alone. `renderAll()` re-runs `SelectControl.upgrade()`, which is where re-rendered rows, programmatic values, and translated option text are picked up.
- Copy feedback must be short, use white text, and must not obscure the main task.
- Generated scale tokens have no hover movement. Avoid decorative motion that suggests a state change where none exists.
- The floating Steps window can be minimized and restored. Navigation should respect `prefers-reduced-motion`.

## Visual contract

- Overall page and section background: `#F5F4EC`.
- All left-side settings panels use the same warm grey-beige background and the same numbered badge color. Do not assign different panel colors per step.
- Titles use IBM Plex Sans through `--font-title`.
- Main title is centered: `COLOR DESIGN SYSTEM` in uppercase, with lowercase `for starter` at 80% of the main title size.
- Section titles use direct, starter-friendly phrases such as `Context contrast`, `Generated scale`, `Role checks`, `Pair editor`, `Website preview`, and `Export colors`.
- Do not add a standalone `Semantic assignments` report to the workflow. Its component-level assignment data is surfaced through the Theme palette in Preview's system spec and through Export, which avoids duplicating Color roles and Role checks.
- The Preview frame is bounded to 850px so the page reads at a realistic reading width, and the site navigation spans exactly that frame.
- Components use bounded widths instead of stretching to the viewport. Reading-focused results stay compact. Preview uses the full project content width with one Light or Dark example visible at a time. The scale may use the available workflow width with horizontal scrolling when needed; Pair editor fields and copy/remove controls must remain usable.
- Preview renders one landing page — navigation, hero, feature cards, one alternating band, an inverse call-to-action, a signup form, and a footer — using identical markup for Light and Dark. It is a website, not a component gallery: do not regress to isolated component demos, a workspace shell, or a raw 50–950 gallery.
- `surface.page` owns the largest area, and in Light it is the Context `Background` itself, not a Neutral step that resembles it. Navigation, hero, features, signup, and footer sit directly on it. `surface.raised` is only for cards and the dialog, and `surface.sunken` only for the single alternating band and the system-spec zone. A raised or sunken surface that is not on the correct side of the page collapses onto the page rather than claiming an elevation it does not have.
- Preview is styled by the exported token names (`var(--surface-page)`, `var(--action-primary-background)`, …), which are set on the preview root from the resolved contract. Preview must not derive colors of its own; a token that does not resolve is skipped, never replaced by a fallback.
- The landing page carries no status fills. Every state — action hover/pressed/focus, field default/focus/invalid, the four feedback roles with their bold fill and measured ink, the destructive action, the overlay scrim with its raised dialog, and the Theme palette — lives in the `System spec` zone below the footer, visibly separated from the page above.
- Only one control in an action group carries a saturated fill. The primary action is filled; the second action is a text button. Neutral is never a button fill and those buttons carry no border either — a grey box beside a colored one reads as a second, competing control. `Secondary` is an accent that decorates a badge, never a second filled button. Large callout surfaces, metric bars, and peer actions remain Neutral. Compact meaning-bearing badges, state glyphs, and feedback rows use the owning role's `bold` fill with its measured `onBold` ink; do not put saturated role-colored text on a grey Neutral background.
- Preview input states follow one model: Default uses a Neutral border, Focus adds a focus ring, Invalid uses a Danger border and helper treatment, and Invalid + Focus keeps the Danger border with the danger-context ring.
- Generated scale metadata uses black text on one continuous light block. Do not put metadata text directly over dark swatches or reintroduce fragmented inline backgrounds.
- Preserve the restrained editorial palette, thin borders, generous spacing, and visible information hierarchy. Avoid generic dashboard styling, gradients, or ornamental card proliferation.
- Functional previews may use rounded containers. Workflow sections themselves stay flat on the page background.

## Implementation boundaries

- Keep calculation logic separate from rendering functions.
- Keep a single state owner for fixed context, candidate colors, active role, scale, and target.
- New color roles should extend the role model, role checks, pair editor, preview, and export together. Do not add a disconnected picker that bypasses the existing workflow.
- Keep design-token generation distinct from semantic usage. A generated number such as `600` is a token; `Brand primary action` is a semantic assignment.
- Do not add dependencies for work that remains clear and maintainable in the current standalone source files.
- Keep the current split complete. Do not move calculation or application logic back into `index.html`, and do not introduce generated duplicates without identifying source and output owners.
- Errors must remain observable. Do not add silent fallbacks that hide invalid state, failed copy operations, or broken calculations.

## Verification before completion

For every behavior or layout change:

1. Run `node --check` on every JavaScript owner.
2. Run `node tests/static-contract.test.mjs`, `node tests/i18n.test.mjs`, `node tests/color-engine.test.mjs`, `node tests/app-smoke.test.mjs`, `node tests/token-contract.test.mjs`, `node tests/system-generator.test.mjs`, `node tests/project-state.test.mjs`, and `node tests/quick-start.test.mjs`.
3. Manually verify Context PASS and FAIL states with at least one high-contrast and one low-contrast pair.
4. Verify palette owners retain separate values and locks when switching roles; verify Regular edits Neutral without creating another palette.
5. Click a Generated scale token and confirm it both copies and becomes the active HEX input.
6. Change the global WCAG target and confirm Role checks, saved-pair status, and Interactive state results update together.
7. Confirm the default Brand `50` on `600` pair, edit Role/Foreground/Background/Usage fields, add a second pair, verify the Interactive state family and focus ring in CSS and JSON, then remove it.
8. Check the Steps links (Quick start, Context, Colors, Website tokens, Preview, Export), minimize control, global target, Preview entry, and Export entry.
9. Verify Quick start: one-click generation on a fresh and edited session, repeated Generate, direct Preview route, provided Brand HEX, one-level Undo, a dismissible `NEEDS ATTENTION` report that leaves the active system unchanged, and lock survival.
10. Confirm the Preview page background equals the `surface.page` value shown in Step 03 for that theme, that Light and Dark render the same markup, and that an Advanced role edit re-resolves Preview, tokens, and every export together.
11. Check desktop and narrow layouts. The scale and Website token table may scroll horizontally, but pair fields and copy must remain usable, and Quick start must not overflow.
12. Report static checks and browser checks separately. Never claim visual verification if only source checks ran.

## Repository continuity

- This directory is the standalone repository. Keep `AGENTS.md`, the decision doc, tests, and source changes together.
- `index.html` remains the direct runnable entry point; it is not generated output.
- Add hosting, package, or deployment files only when the project actually needs them.
