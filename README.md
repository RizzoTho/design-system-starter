# Accessible Color Design System

中文说明: [README.zh.md](README.zh.md)

For designers and engineers who already know their interface `Background` and `Text` colors, but need a faster way to build the rest of a usable color system.

Color work is difficult because visual harmony and measured accessibility do not always agree. I built this tool around the decisions that repeatedly matter in real interface work: preserve recognizable semantic roles, tune perceptual rhythm, verify contrast, and inspect colors in components before exporting them. AI does not replace that domain judgment; it helps turn it into a faster, repeatable workflow.

## What it is

A dependency-free browser tool for defining `Brand`, `Neutral`, optional `Secondary`, and semantic color roles against a fixed interface context.

It generates OKLCH-based 50–950 scales, evaluates WCAG contrast, previews Light and Dark component assignments, saves static or interactive foreground/background pairs, and exports CSS variables or JSON. Interactive pairs include Default, Hover, Pressed, and focus-ring values. The interface supports English and Chinese.

## Run locally

No installation or build step is required.

1. Download or clone the repository.
2. Open `index.html` directly in a browser.

For a local HTTP server instead:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Basic workflow

1. Confirm the fixed `Background` and `Text` colors.
2. Set `Brand` and `Neutral`; enable `Secondary` only when it has a clear use.
3. Sync unlocked semantic colors to `Brand`, then tune or lock individual roles.
4. Choose the global WCAG target and inspect Fit report, assignments, and Contrast matrix.
5. Save useful foreground/background pairs, inspect Component preview, and export.

## GitHub Pages

The included workflow publishes the runtime files whenever `main` is updated.

1. Push the repository to GitHub with `main` as the default branch.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Run the **Deploy GitHub Pages** workflow or push to `main`.

The workflow runs the project checks before deployment and publishes only the standalone page assets.

## Repository structure

```text
index.html          Runnable page structure
styles.css          Visual and responsive styles
js/                 Color engine, role model, i18n, and interactions
tests/              Static, deterministic, i18n, and smoke checks
docs/               Product and color-model decisions
plans/              Implementation history and acceptance gates
scripts/            Deployment artifact preparation
.github/workflows/  GitHub Pages deployment
```

## Limitations

- State is session-only and resets when the page reloads.
- Saved pairs are explicit snapshots; Interactive pairs derive state values from the saved scale, but neither type automatically becomes a semantic assignment.
- The tool targets sRGB and does not yet simulate color-vision deficiencies.
- Generated usage labels are recommendations; WCAG results remain the acceptance signal.

## License

[MIT](LICENSE)
