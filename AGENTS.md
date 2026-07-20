# Accessible Color Picker local contract

## Project purpose

This project is a small, standalone color design system tool inspired by MGifford UI Palette Generator.

The user already knows the page `Background` and `Text` colors. The tool helps them define `Brand` and `Neutral`, decide whether an optional `Secondary` is needed, generate four recognizable semantic families, inspect WCAG contrast relationships, preview components, and export usable colors.

Do not turn it into a generic color picker. Its core question is:

> Given a fixed background and text color, can this starter palette become a coherent, accessible interface color system?

## Current source of truth

- `index.html` owns the runnable page structure and loads the standalone source files.
- `styles.css` owns all visual and responsive styles.
- `js/color-engine.js` owns pure color parsing, conversion, scale, luminance, and contrast calculations.
- `js/role-model.js` owns role definitions, suggestions, palette aliases, semantic assignment resolution, and default color state.
- `js/app.js` owns the single mutable state, rendering, interaction, navigation, copy, and export behavior.
- `AGENTS.md` owns the project intent and maintenance rules.
- There is currently no build step, package manager, framework, or generated source.
- The page must continue to work when `index.html` is opened directly through `file://`.

## Eight-role model

- `docs/color-role-model.md` owns the accepted product and color decisions for the eight-role expansion.
- `plans/2026-07-20-color-role-expansion.md` owns the implementation sequence and acceptance gates.
- Eight visible roles are `Brand`, `Neutral`, optional `Secondary`, `Regular`, `Success`, `Warning`, `Danger`, and `Information`.
- `Regular` is a read-through alias of `Neutral`; it never owns a duplicate palette.
- Semantic families keep recognizable hue ranges. Brand may influence their tonal and chroma character, but not rename or replace their semantic identity.
- Hue-family names such as Coral, Teal, or Amber are not part of the user-facing model. The UI names purpose; HEX and OKLCH own the actual color.

If the project later adopts a framework or build system, update this file in the same change and identify the new source files and build output explicitly.

## Product flow

The workflow has three ordered steps plus two separate result destinations:

1. `Context`: set the fixed Background and Text colors and show an explicit PASS or FAIL result for normal text at 4.5:1.
2. `Colors`: define Brand and Neutral, optionally add Secondary, generate semantic suggestions, and inspect each active 50–950 scale.
3. `Standard`: choose the WCAG target, inspect the fit report, and inspect the contrast matrix.

After those steps:

- `Preview`: review the current system in light and dark component examples. It is an unnumbered result destination, not a workflow step. Light and Dark are switched locally inside Preview and are not shown simultaneously.
- `Export`: copy CSS variables or JSON. It is an unnumbered result destination alongside Preview.

The floating Steps window is the navigation owner for this sequence. Only Context, Colors, and Standard carry step numbers. `Preview` and `Export` remain separate, unnumbered entries at the same navigation level after the steps. Every destination must have a stable anchor and participate in active-section tracking.

## Color and accessibility rules

- WCAG contrast uses relative luminance. Keep the calculation deterministic and centralized in `luminance()` and `contrast()`.
- `Context` always evaluates `Text on Background` against 4.5:1 and reports `PASS · AA`, `PASS · AAA`, or `FAIL` visibly. Do not communicate status through color alone.
- The selectable target controls active roles, fit reports, semantic assignments, and matrix evaluation. Current targets are AA normal text 4.5:1, AA large text 3:1, and AAA normal text 7:1.
- Reference palettes are generated in OKLCH. Keep the exact input seed at `500`, use one shared tonal rhythm, and apply per-family chroma limits.
- If an OKLCH request is outside sRGB, reduce chroma while preserving lightness and hue as far as possible, and expose a diagnostic instead of silently clipping.
- Generated scale usage labels are recommendations, not guarantees:
  - 50–200: page and surface
  - 300–400: border and muted
  - 500: seed
  - 600–700: action and pressed state
  - 800–950: strong and dark surfaces
- `W` and `K` show each token's contrast ratio against White and Black.
- In the contrast matrix, the row is the foreground color and the column is the background color. `Aa` is the actual foreground-on-background sample. The number is the contrast ratio.
- A green matrix outline and check mean the pair reaches the selected target. Non-passing cells must remain readable enough to inspect even when the represented pair itself fails.
- Button text must be selected by measured contrast. Do not assume a fixed light or dark text color from token number alone.

## Interaction contract

- Background, Text, and every enabled palette owner accept direct HEX input and native color input.
- Invalid HEX must be marked invalid without silently changing the last valid color.
- Clicking a Generated scale token copies its HEX value and applies it to the active palette owner.
- Switching roles must preserve independent seeds and locks. Automatic generation changes unlocked roles only.
- Disabling Secondary must remove its palettes and exports without leaving stale tokens.
- Clicking a matrix cell copies the foreground/background pair.
- Copy feedback must be short, use white text, and must not obscure the main task.
- Generated scale tokens have no hover movement. Avoid decorative motion that suggests a state change where none exists.
- The floating Steps window can be minimized and restored. Navigation should respect `prefers-reduced-motion`.

## Visual contract

- Overall page and section background: `#F5F4EC`.
- All left-side settings panels use the same warm grey-beige background and the same numbered badge color. Do not assign different panel colors per step.
- Titles use IBM Plex Sans through `--font-title`.
- Main title is centered: `COLOR DESIGN SYSTEM` in uppercase, with lowercase `for starter` at 80% of the main title size.
- Section titles use direct, starter-friendly phrases such as `Context contrast`, `Generated scale`, `Fit report`, `Contrast matrix`, `Component preview`, and `Export colors`.
- Components use bounded widths instead of stretching to the viewport. Reading-focused results stay compact. Preview uses the full project content width with one Light or Dark example visible at a time. Data-heavy scales or matrices may use the available workflow width with horizontal scrolling when needed.
- Generated scale metadata uses black text on one continuous light block. Do not put metadata text directly over dark swatches or reintroduce fragmented inline backgrounds.
- Preserve the restrained editorial palette, thin borders, generous spacing, and visible information hierarchy. Avoid generic dashboard styling, gradients, or ornamental card proliferation.
- Functional previews may use rounded containers. Workflow sections themselves stay flat on the page background.

## Implementation boundaries

- Keep calculation logic separate from rendering functions.
- Keep a single state owner for fixed context, candidate colors, active role, scale, and target.
- New color roles should extend the role model, fit report, preview, and export together. Do not add a disconnected picker that bypasses the existing workflow.
- Keep design-token generation distinct from semantic usage. A generated number such as `600` is a token; `Brand primary action` is a semantic assignment.
- Do not add dependencies for work that remains clear and maintainable in the current standalone source files.
- Keep the current split complete. Do not move calculation or application logic back into `index.html`, and do not introduce generated duplicates without identifying source and output owners.
- Errors must remain observable. Do not add silent fallbacks that hide invalid state, failed copy operations, or broken calculations.

## Verification before completion

For every behavior or layout change:

1. Run `node --check` on every JavaScript owner.
2. Run `node tests/static-contract.test.mjs`, `node tests/color-engine.test.mjs`, and `node tests/app-smoke.test.mjs`.
3. Manually verify Context PASS and FAIL states with at least one high-contrast and one low-contrast pair.
4. Verify palette owners retain separate values and locks when switching roles; verify Regular edits Neutral without creating another palette.
5. Click a Generated scale token and confirm it both copies and becomes the active HEX input.
6. Change the WCAG target and confirm Fit report and Contrast matrix update together.
7. Check the Steps links, minimize control, Preview entry, and Export entry.
8. Check desktop and narrow layouts. The scale and matrix may scroll horizontally, but controls and copy must remain usable.
9. Report static checks and browser checks separately. Never claim visual verification if only source checks ran.

## Repository continuity

- This directory is the standalone repository. Keep `AGENTS.md`, the decision doc, tests, and source changes together.
- `index.html` remains the direct runnable entry point; it is not generated output.
- Add hosting, package, or deployment files only when the project actually needs them.
