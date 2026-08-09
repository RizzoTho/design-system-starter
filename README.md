# Accessible Color Design System

中文说明: [README.zh.md](README.zh.md)

Generate a complete, accessible website color system from up to three choices — no HEX value required — then inspect and tune it in the Advanced workflow. Color work is difficult because visual harmony and measured accessibility do not always agree. This tool turns the decisions that repeatedly matter in real interface work into a fast, repeatable workflow: preserve recognizable semantic roles, tune perceptual rhythm, verify contrast with WCAG math, and inspect colors in components before exporting them.

## What it is

A dependency-free browser tool with two paths:

- **Quick start** — choose a color character (Balanced, Warm, Cool, Vivid, or Muted), a Brand source, and a Secondary strategy, then press one action to generate a complete website color system: Context, all role palettes, Light and Dark website tokens, and a `READY` / `READY WITH WARNINGS` / `NEEDS ATTENTION` validation summary.
- **Advanced editing** — the direct workflow for `Background`, `Text`, `Brand`, `Neutral`, optional `Secondary`, and semantic roles with OKLCH scales, locks, Role checks, Website tokens, and Custom pairs.

It generates OKLCH-based 50–950 scales, evaluates WCAG contrast with relationship-specific targets (text, large text, and non-text), previews Light and Dark component assignments, saves static or interactive foreground/background pairs, and exports CSS variables or JSON. Optional Dashboard, Marketing, Portfolio, and Documentation coverage profiles add concrete component tokens and matching Preview modules without changing the color character. The interface supports English and Chinese.

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

1. **Quick start**: pick a color character, a Brand source (Generate, HEX, or Keep current), and a Secondary strategy, then press `Generate website system`. The first valid system auto-applies; later generations stay proposals until Apply / Reroll / Cancel, and Undo restores the previous system.
2. **Context**: confirm or tune the generated `Background` and `Text`; the panel shows a measured PASS or FAIL at 4.5:1.
3. **Colors**: inspect `Brand`, `Neutral`, optional `Secondary`, and the semantic roles; tune or lock individual roles and review Role checks against the global WCAG target.
4. **Website tokens**: review the generated contract grouped by intent (surfaces, content, actions, fields, feedback, accent) with Light and Dark values. Optionally select a Dashboard, Marketing, Portfolio, or Documentation coverage profile to add component tokens and a matching Preview module; Custom pairs stay editable snapshots beneath it.
5. **Preview and Export**: inspect the Light / Dark component workspace, then copy CSS variables or JSON.

## GitHub Pages

The included workflow publishes the runtime files whenever `main` is updated.

1. Push the repository to GitHub with `main` as the default branch.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Run the **Deploy GitHub Pages** workflow or push to `main`.

The workflow runs the project checks before deployment and publishes only the standalone page assets.

## Repository structure

```text
index.html          Runnable page structure (loads sources in dependency order)
styles.css          Visual and responsive styles
js/                 color-engine, i18n, role-model, token-contract,
                    system-generator, project-state, and app
js/token-contract.js       Website token definitions, targets, validation
js/system-generator.js     Deterministic one-click generation pipeline
js/project-state.js        Schema v2 encode / decode / validation
tests/              Static, deterministic, i18n, smoke, and Quick start checks
docs/               Product, color-model, and website-token decisions
plans/              Implementation history and acceptance gates
scripts/            Deployment artifact preparation
.github/workflows/  GitHub Pages deployment
```

## Limitations

- Local Save keeps the project in the browser's localStorage for this origin; Download JSON creates a portable file. State resets when storage is cleared or on a different machine.
- Custom pairs are explicit snapshots; Interactive pairs derive state values from the saved scale, but neither type automatically becomes a semantic assignment.
- One product coverage profile can be active at a time. Profiles extend the generic contract; they are not industry color presets and do not change the selected color character.
- The tool targets sRGB and does not yet simulate color-vision deficiencies.
- Generated usage labels are recommendations; WCAG results remain the acceptance signal.

## License

[MIT](LICENSE)
