# Website token contract decision

- Status: Accepted
- Date: 2026-08-09
- Scope: Website semantic token layer for the one-click color system
- Implementation status: Contract accepted; implementation follows in Phases 1–8 of [`plans/2026-08-09-one-click-website-color-system.md`](../plans/2026-08-09-one-click-website-color-system.md)
- Depends on: [`docs/color-role-model.md`](color-role-model.md) (eight-role model, semantic hue identity, assignment semantics)

## Decision

The starter result is a **website color system**, not just a palette. After role assignments resolve, a generic website profile maps component intent to named tokens for surfaces, content, actions, fields, focus, feedback, and accents. This contract names those tokens exactly, defines the relationships the system must measure, and fixes the traceability and export rules.

Product-specific profiles (Dashboard, Marketing, Portfolio, Documentation) extend the now-stable generic contract. Step 03 selects one additive coverage profile at a time. Profiles add component tokens, relationship checks, and a matching Preview module; they never rename semantic meaning or change the selected color character.

## Approved product flow decisions

1. Quick start generates the generic website system; Step 03 may add one product-specific coverage profile after generation or before the next generation.
2. Step 03 becomes `Website tokens`; existing Saved pairs are retained as `Custom pairs` beneath it.
3. The first untouched generation auto-applies when valid; later generation stays a proposal until explicitly applied.

## Three token layers

| Layer | Names | Example | Owns |
| --- | --- | --- | --- |
| `reference` | `--palette-{roleId}-{step}` | `--palette-brand-600` | Numbered 50–950 palette steps, one owner per enabled role |
| `role` | `--role-{roleId}-{theme}-{kind}` | `--role-brand-light-bold` | Resolved `subtle`, `border-icon`, `bold`, `on-bold` per role per theme |
| `website` | theme-stable names below | `--surface-page` | Purpose-named component tokens, resolved per theme |

Website tokens may reference role tokens. Role tokens never infer component use from their number alone. `Regular` remains a read-through alias of `Neutral` in every layer.

## Website token list

Website names are stable across Light and Dark. Light resolves inside `:root`; Dark resolves inside `[data-theme="dark"]` with the same names. Consumers never append `light` or `dark` to a website token name.

### Surfaces

| Token | Intent |
| --- | --- |
| `--surface-page` | Page background |
| `--surface-raised` | Cards, panels, popovers |
| `--surface-sunken` | Inset wells, code blocks, table headers |
| `--surface-overlay` | Modal and menu background |

### Content

| Token | Intent |
| --- | --- |
| `--content-primary` | Primary text on surfaces |
| `--content-secondary` | Secondary text |
| `--content-muted` | Muted, hint, and disabled-adjacent text |
| `--content-link` | Link text (least contrast that passes to keep hue recognizable) |
| `--content-link-hover` | Link hover state |
| `--content-inverse` | Text on filled or dark surfaces |

### Borders and focus

| Token | Intent |
| --- | --- |
| `--border-default` | Default borders and dividers |
| `--border-strong` | Stronger borders, table rules |
| `--focus-ring` | Brand focus ring |
| `--focus-ring-danger-context` | Focus ring for controls in a Danger context (keeps the Danger border visible) |

### Primary action

| Token | Intent |
| --- | --- |
| `--action-primary-background` | Default fill |
| `--action-primary-foreground` | Measured ink, held stable across states |
| `--action-primary-background-hover` | Hover fill |
| `--action-primary-background-pressed` | Pressed fill |
| `--action-primary-focus-ring` | Focus ring against every surface it touches |

### Neutral secondary action

| Token | Intent |
| --- | --- |
| `--action-secondary-background` | Quiet fill |
| `--action-secondary-foreground` | Measured ink |
| `--action-secondary-border` | Outline |
| `--action-secondary-background-hover` | Hover fill |
| `--action-secondary-background-pressed` | Pressed fill |
| `--action-secondary-focus-ring` | Focus ring |

### Destructive action

| Token | Intent |
| --- | --- |
| `--action-destructive-background` | Danger fill |
| `--action-destructive-foreground` | Measured ink |
| `--action-destructive-background-hover` | Hover fill |
| `--action-destructive-background-pressed` | Pressed fill |
| `--action-destructive-focus-ring` | Focus ring |

### Fields

| Token | Intent |
| --- | --- |
| `--field-background` | Field fill |
| `--field-text` | Entered text |
| `--field-placeholder` | Placeholder |
| `--field-border` | Default border |
| `--field-border-focus` | Focus border (Brand ring remains the outer signal) |
| `--field-border-invalid` | Invalid border (Danger) |
| `--field-helper-invalid` | Invalid helper text |
| `--field-focus-ring` | Brand focus ring (Danger border persists under it when Invalid + Focus) |

### Feedback families

For each of `success`, `warning`, `danger`, `information`:

| Token | Intent |
| --- | --- |
| `--feedback-{role}-surface` | Notice surface |
| `--feedback-{role}-border` | Notice border |
| `--feedback-{role}-icon` | Icon (3:1 indicator) |
| `--feedback-{role}-text` | Notice text (4.5:1 text target) |
| `--feedback-{role}-bold` | Bold treatment where the family needs a solid fill |
| `--feedback-{role}-on-bold` | Measured ink on the bold fill |

### Secondary accent

Only when `Secondary` is enabled:

| Token | Intent |
| --- | --- |
| `--accent-secondary-surface` | Badge / accent surface |
| `--accent-secondary-border` | Accent border |
| `--accent-secondary-text` | Accent text |

`Secondary` never produces a second filled action. It is an accent decoration only.

## Product coverage profiles

The `General website` option resolves only the generic contract above. Selecting a profile adds the following website tokens to both Light and Dark without removing or renaming any generic token.

| Profile | Additive tokens | Required relationships | Advisory measurements | Preview module |
| --- | --- | --- | --- | --- |
| Dashboard / SaaS | `--surface-sidebar`, `--surface-table-stripe`, `--content-tabular`, `--border-table`, `--chart-series-1`…`4` | Sidebar text and tabular text | Zebra, table rules, chart series | Sidebar, metrics, table, chart |
| Marketing / Landing page | `--surface-hero`, `--surface-section-accent`, `--content-hero-title`, `--content-hero-body`, `--border-feature`, `--decoration-highlight` | Hero title, hero body, feature boundary | Section tint and highlight | Hero and feature strip |
| Portfolio | `--surface-project-card`, `--surface-media-overlay`, `--content-project-title`, `--content-project-meta`, `--content-media-caption`, `--border-project-card`, `--accent-project-index` | Project title, metadata, media caption, card boundary | Project index | Project and media card |
| Documentation | `--surface-docs-sidebar`, `--surface-code-block`, `--surface-inline-code`, `--content-docs-nav`, `--content-code`, `--content-line-number`, `--content-inline-code`, `--border-code-block` | Navigation, block code, line numbers, inline code, code boundary | None | Docs navigation and code sample |

Rules:

- A profile changes coverage, not palette identity. Every value still resolves from the active Brand / Neutral system and the shared Reference → Role → Website layers.
- Only one profile is active because each represents a concrete product surface contract, not a stackable style preset.
- Profile selection is persisted as `profileId` at project and `website` level in schema v2 JSON and is included additively in CSS and Tailwind exports.
- Profile relationship checks use the same `aa-interface` or `aaa-interface` thresholds as the generic contract. Advisory measurements remain advisory and are never relabeled PASS.
- Preview reads the resolved profile token values. Advanced role edits and profile changes re-resolve validation, Preview, CSS, and JSON from the same state owner.

## Traceability metadata

Every resolved website token in JSON carries its origin:

```js
{
  hex: '#B7523A',
  sourceRole: 'brand',
  sourceStep: 600,
  sourceKind: 'palette-token',   // or 'measured-ink' for measured black/white
  generatedBy: 'action-primary-default',
  locked: false
}
```

A measured black or white foreground uses `sourceKind: 'measured-ink'` and has no fake palette step.

## Target profiles

| Profile | Normal text | Large text | Non-text (border, icon, indicator, focus) |
| --- | ---: | ---: | ---: |
| `aa-interface` (default) | 4.5:1 | 3:1 | 3:1 |
| `aaa-interface` | 7:1 | 4.5:1 | 3:1 |

The current advanced `AA large text · 3:1` option remains available only for explicitly tagged Advanced pairs (`advancedPairTarget`). It is never a blanket target for generated website text.

## Relationship contract

The validator evaluates relationships, not isolated colors. Every required token has at least one relationship check.

| Relationship | Required target | Severity | Repair order |
| --- | ---: | --- | --- |
| Primary, secondary, muted, link, field, and feedback text on their surfaces | text target | required | choose another step, then adjust assignment Lightness |
| Explicitly large display text on its surface | large target | required | choose another step |
| Primary and destructive action foreground across Default, Hover, and Pressed | text target | required | search background steps while holding ink stable |
| Neutral secondary action foreground across states | text target | required | search Neutral foreground/background coordinates |
| Border, icon, and semantic indicator against adjacent surface | 3:1 | required | choose another role step |
| Focus ring against every adjacent surface it touches | 3:1 | required | search Brand steps, then report unresolved |
| Context Text on Background | 4.5:1 | required | choose measured text or report locked conflict |
| Disabled content | advisory measurement only | advisory | never label PASS through an exemption |

Rules:

- Contrast uses unrounded values; display rounding never decides PASS.
- Interactive foreground is selected against Default and held across Hover and Pressed.
- Hover and Pressed search bounded candidate sets; they are not accepted merely because they are adjacent steps.
- Assignment search changes token coordinates before changing a provided or locked seed.
- Semantic repair preserves Hue, searches Lightness first, and reduces Chroma only when necessary.
- If a locked seed makes a required relationship impossible, the result is `NEEDS ATTENTION`; the system never unlocks or replaces the seed silently.
- `aaa-interface` raises applicable normal-text relationships to 7:1 and leaves non-text relationships at 3:1.

## Validation status

| Status | Meaning |
| --- | --- |
| `READY` | Every required relationship in both Light and Dark passes |
| `READY WITH WARNINGS` | Required relationships pass; advisory diagnostics remain (for example gamut reduction) |
| `NEEDS ATTENTION` | At least one required relationship unresolved; the result names the relationship, actual ratio, required ratio, and available recovery action |

A system cannot be `READY` when either theme has a required failure.

## Diagnostic shape

```js
{
  code: 'ACTION_PRIMARY_HOVER_TEXT_CONTRAST',
  severity: 'error',                 // error | warning | advisory
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

Errors appear in the result summary and console. Warnings appear in diagnostics and export. No empty catch blocks, no generic failure message when a relationship path is known, no automatic reset after invalid storage or import data.

## Export direction

Exact serialization lands in Phase 6, but the shape is fixed:

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

Export rules:

- CSS sections are separated: Reference, Role, Website, and Custom pairs.
- Website names stay stable across themes; only their resolution changes.
- Current `--color-*` and `--pair-*` variables remain for one compatibility window, with a visible deprecation note where a website equivalent exists.
- JSON exports `schemaVersion: 2` and carries generation options, traceability, diagnostics, and custom pairs.
- The Tailwind adapter references website CSS variables; it never duplicates HEX values.
- Export → Import round trips preserve the visible system, locks, validation, and custom pairs.

## Source ownership

| File | Owns |
| --- | --- |
| `js/token-contract.js` | Website token definitions, target profiles, relationship definitions, Light / Dark website-token resolution, compatibility projection to generated pairs (`compatibilityPairSpecs`), CSS / JSON / Tailwind serialization. No DOM access. |
| `js/system-generator.js` | Character presets, deterministic Reroll primitives, Context / Brand / Neutral / Secondary / semantic batch generation, bounded constraint search, end-to-end `generateSystem()`. No DOM access. |
| `js/project-state.js` | Schema version, project encode/decode and validation, import migration, storage payload preparation. No silent fallback, no DOM rendering. |

Browser script order: `color-engine.js` → `i18n.js` → `role-model.js` → `token-contract.js` → `system-generator.js` → `project-state.js` → `app.js`. The order is enforced by `index.html` and `tests/static-contract.test.mjs`.

## Compatibility window

- Current CSS and JSON exports may have consumers. New website output is additive; nothing existing is removed in the first release.
- Current Saved pairs remain editable snapshots exported under `pairs`; generated website tokens live under `website`.
- Custom pair snapshots are never converted into live website assignments, and regenerating the website system never replaces a user-edited pair.
