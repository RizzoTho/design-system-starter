# Color role model decision

- Status: Accepted
- Date: 2026-07-20
- Scope: Accessible Color Picker role expansion
- Implementation status: Planned, not yet implemented

## Decision

The product will expose eight color roles, but it will not require eight independent color palettes.

The ordered design flow is:

1. Fix `Background` and `Text`.
2. Choose `Brand`.
3. Choose the temperature and character of `Neutral`.
4. Optionally choose `Secondary`.
5. Generate and tune four independent semantic palettes: `Success`, `Warning`, `Danger`, and `Information`.
6. Map `Regular` to `Neutral` instead of generating another hue.

This produces eight visible roles with at most seven palette owners. If `Secondary` is not needed, the system uses six palette owners.

## Why this order

`Neutral` comes before `Secondary` because it owns most of the interface environment:

- page and container surfaces;
- primary and secondary text;
- borders and dividers;
- disabled and default component states;
- the backgrounds against which all chromatic roles are evaluated.

`Secondary` is an optional second brand accent. It must not be used merely because the model has a slot for it, and it must not replace neutral secondary UI by default.

## Role ownership

| Visible role | Palette owner | Purpose |
| --- | --- | --- |
| `Brand` | `Brand` | Brand identity and primary actions |
| `Secondary` | `Secondary`, optional | A second brand accent with an explicit product use |
| `Neutral` | `Neutral` | Surfaces, text, borders, disabled and secondary UI |
| `Regular` | Alias of `Neutral` | Default, non-critical component state |
| `Success` | `Success` | A task or process completed successfully |
| `Warning` | `Warning` | A potential risk or undesirable result; the user may continue |
| `Danger` | `Danger` | A serious error that requires attention and may block progress |
| `Information` | `Information` | Additional information or an in-progress state that needs attention |

The UI may show friendly labels such as `Positive / Success` and `Negative / Danger`, but exported token names use `success` and `danger` consistently.

## Semantic color behavior

Semantic colors keep their recognizable hue families:

- `Success`: green;
- `Warning`: amber or orange;
- `Danger`: red;
- `Information`: blue or cyan.

Brand may influence their visual character, not their meaning. Semantic palettes may share Brand's perceived intensity, tonal rhythm, and light/dark mapping strategy, but they must not be pulled toward Brand's hue if that weakens recognition.

`Warning` is not an error state. Its content definition must describe potential risk, caution, or an undesirable result. An error that has already occurred belongs to `Danger`.

## Color generation model

Palette generation will move from HSL-based tonal alignment to OKLCH-based alignment.

Reasons:

- equal HSL lightness does not produce equal perceived lightness across hues;
- OKLCH provides a better basis for aligning perceived lightness and chroma;
- semantic palettes can share a tonal rhythm without sharing a hue;
- gamut reduction can preserve hue while reducing chroma.

Every independent palette keeps the existing `50` to `950` token scale. Token `500` must preserve the exact input seed HEX. The remaining steps are derived from OKLCH lightness and chroma curves, then converted to in-gamut sRGB values.

Out-of-gamut colors must be handled observably. The generator should report when chroma was reduced; it must not silently replace a color with an unrelated fallback.

## Palette tokens and semantic assignments

Generated palette tokens and semantic usage tokens remain separate.

Reference palette examples:

```css
--palette-success-50: ...;
--palette-success-500: ...;
--palette-success-950: ...;
```

Semantic assignment examples:

```css
--color-background-success-subtle: ...;
--color-border-success: ...;
--color-icon-success: ...;
--color-background-success-bold: ...;
--color-text-on-success: ...;
```

Each semantic role must provide at least:

1. a subtle surface;
2. a border or icon color;
3. a solid emphasis color;
4. a measured on-solid foreground.

Assignments are selected through contrast checks. They are not permanently hard-coded to a token number merely because that number has a recommended usage label.

## Quick-pick interaction

The starter flow asks for no more than three direct decisions:

1. Choose `Brand`.
2. Choose `Neutral` character: warm, balanced, or cool.
3. Choose a `Secondary` strategy: analogous, contrasting, or none.

The system then suggests `Success`, `Warning`, `Danger`, and `Information`. Each suggestion can be locked or adjusted. The single Sync semantic colors to Brand action appears only while Brand is active and refreshes unlocked semantic roles; `Regular` updates automatically with `Neutral`.

The quick picker must show the consequence of a choice, not only the swatch. A suggestion is accepted together with its contrast result and representative component usage.

Component Preview uses one full-width example canvas at a time. A local Light / Dark switch changes the surface; the two themes are not displayed side by side. The WCAG target remains globally available in the bottom-right Steps window. Step 03 holds pairs selected from the Contrast matrix rather than owning that target.

The preview is one coherent application workspace, not a gallery of disconnected swatches or cards. Light and Dark render the same markup with different assignments so a user can inspect each role in context:

- Brand owns the selected navigation, visible focus, progress, and primary action.
- Neutral and its Regular alias own the application shell, default task, borders, and secondary UI.
- Success, Warning, Danger, and Information appear in task state, validation, health, and guidance patterns with text or icons alongside color.
- Optional Secondary appears only as an additional product action when enabled.

## Accessibility invariants

- Context `Text on Background` is always checked against `4.5:1`.
- Normal text pairs must reach `4.5:1` for AA.
- Large text pairs must reach `3:1` for AA.
- Meaningful UI boundaries, icons, and state indicators must reach `3:1` against adjacent colors.
- Semantic meaning must also be expressed by text, icon, or shape; color is never the only signal.
- On-color text is selected by measured contrast. `Warning` may require dark text even when other bold semantic colors use light text.
- Contrast calculations use unrounded values; rounding is display-only.

## MVP boundary

The first implementation includes:

- eight visible roles and the alias relationship for `Regular`;
- optional `Secondary`;
- OKLCH scale generation for independent palette owners;
- quick suggestions for the four semantic palettes;
- semantic assignments and WCAG evaluation;
- light context preview and a representative dark-surface preview;
- a local Light / Dark switch with one preview visible at a time;
- saved matrix pairs that are re-evaluated against the global target and included in export;
- CSS and JSON export.

The first implementation does not promise a complete dual-theme token system or color-vision-deficiency simulation. Those are follow-up work after the role model and contrast behavior are stable.

## Sources

- [Atlassian Design System: Color roles](https://atlassian.design/foundations/color-new/)
- [Carbon Design System: Color tokens](https://carbondesignsystem.com/elements/color/tokens/)
- [W3C WCAG 2.2: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- [W3C WCAG 2.2: Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C WCAG 2.2: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [W3C CSS Color Module Level 4](https://www.w3.org/TR/css-color-4/)
