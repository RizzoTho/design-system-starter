import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const roleModel = fs.readFileSync(new URL('../js/role-model.js', import.meta.url), 'utf8');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicateIds)], [], 'HTML contains duplicate IDs');

const idSelectors = [...app.matchAll(/\$\('#([^']+)'\)/g)].map(match => match[1]);
const missingIds = [...new Set(idSelectors.filter(id => !ids.includes(id)))];
assert.deepEqual(missingIds, [], `JavaScript points to missing IDs: ${missingIds.join(', ')}`);

for (const source of ['styles.css', 'js/color-engine.js', 'js/i18n.js', 'js/role-model.js', 'js/token-contract.js', 'js/system-generator.js', 'js/project-state.js', 'js/select.js', 'js/app.js']) {
  assert.match(html, new RegExp(`["']${source.replace('.', '\\.')}["']`), `${source} is not linked from index.html`);
}

const scriptSources = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
const expectedOrder = ['js/color-engine.js', 'js/i18n.js', 'js/role-model.js', 'js/token-contract.js', 'js/system-generator.js', 'js/project-state.js', 'js/select.js', 'js/app.js'];
assert.deepEqual(scriptSources, expectedOrder, 'Script sources are missing or out of dependency order');

assert.doesNotMatch(html, /<style\b/i, 'Inline style owner returned to index.html');
assert.doesNotMatch(html, /id="regenerateRole"/, 'The ineffective Regenerate action returned');
assert.ok(html.indexOf('id="generateSemantics"') < html.indexOf('id="lockRole"'), 'Sync and Lock button order regressed');
assert.match(html, /id="generateSemantics" class="button"/, 'Sync action did not receive the secondary visual style');
assert.match(html, /id="lockRole" class="button primary full-button"/, 'Lock action did not receive the primary visual style');
assert.match(html, /<span id="scaleDiagnostics" class="scale-diagnostic-inline" hidden><\/span>/, 'Scale diagnostics are not inline with the description');
// The bottom-right Steps dock is gone. The global WCAG target leads the workflow
// ahead of 01 Context, and each step heading owns a hollow mark that collapses
// its own section. The mark stays monochrome: in the chrome, color means "press
// this next", and a step heading is not that.
assert.doesNotMatch(html, /id="stepDock"|data-step-link/, 'The Steps dock returned');
assert.ok(html.indexOf('id="targetSelect"') < html.indexOf('id="step-context"'), 'The global WCAG target no longer leads the workflow ahead of 01');
assert.equal([...html.matchAll(/data-step-toggle/g)].length, 4, 'Every workflow step must own exactly one collapse mark');
assert.doesNotMatch(html, /<div class="step-heading"><b>/, 'A step heading prints a number again instead of the mark');
assert.match(css, /\.step-mark::before \{[^}]*border: 2px solid var\(--ui-ink\)/s, 'The step mark is no longer a monochrome hollow ring');
assert.match(css, /\[data-touched="false"\] \.step-mark::before \{[^}]*animation: step-breathe/s, 'An untouched step no longer breathes');
assert.match(css, /@keyframes step-breathe/, 'The breathing keyframes are missing');
assert.match(css, /prefers-reduced-motion[\s\S]{0,220}\[data-touched="false"\] \.step-mark::before \{[^}]*animation: none/, 'The breathing light ignores reduced motion');
assert.match(css, /\.workflow-section\.is-collapsed \.step-content \{[^}]*display: none/s, 'The mark no longer collapses the whole step section');
assert.equal([...html.matchAll(/<script\b/g)].length, 8, 'Unexpected script count');
assert.ok(idSelectors.length > 30, 'Static selector scan did not inspect the app');
// Quick start is one centered column and the generation result is the foot of
// that card, not a second panel in an empty column.
assert.match(html, /<aside class="step-controls quick-start">[\s\S]*id="generationResult"[\s\S]*<\/aside>/, 'The generation result left the Quick start card');
assert.match(css, /\.quick-start-section \{[^}]*grid-template-columns: minmax\(0, 1fr\)/s, 'Quick start returned to a two-column layout');
assert.match(css, /\.quick-start-section \.generation-result \{[^}]*border-top/s, 'The result is no longer attached to the foot of the card');
assert.match(css, /\.quick-start-section \.field \.select \{[^}]*width: max-content/s, 'Quick start selects stretch again, parking the chevron away from the value');

// Braces must balance: an unclosed media query silently nests every rule after
// it and disables them outside that breakpoint.
{
  let depth = 0;
  for (const ch of css) {
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    assert.ok(depth >= 0, 'styles.css closes a block that was never opened');
  }
  assert.equal(depth, 0, 'styles.css has an unclosed block; rules after it are nested by accident');
}

// The landing-page Preview is bound to the exported token names, so what the
// page paints and what the export ships can never drift.
assert.match(app, /function previewTokenVariables/, 'Preview no longer binds the exported website token names');
assert.doesNotMatch(app, /--pv-[a-z]/, 'Preview reintroduced hand-derived colors outside the token contract');
assert.match(css, /\.site-preview \{[^}]*background: var\(--surface-page\)/s, 'The page background is not the generated surface');
assert.match(css, /\.site-card \{[^}]*background: var\(--surface-raised\)/s, 'Cards no longer use the raised surface');
assert.match(css, /\.site-band \{[^}]*background: var\(--surface-sunken\)/s, 'The single alternating band lost the sunken surface');
// Field states follow one model: neutral default, focus ring, Danger border,
// and Danger + focus keeping the danger-context ring.
assert.match(css, /\.site-form input \{[^}]*border: 1px solid var\(--field-border\)[^}]*outline: 0/s, 'Preview inputs do not have a neutral default state');
assert.match(css, /\.spec-field\.is-focused input \{[^}]*outline: 2px solid var\(--field-focus-ring\)/s, 'Preview focus is not modeled with a focus ring');
assert.match(css, /\.spec-field\.is-invalid input \{[^}]*border-color: var\(--field-border-invalid\)/s, 'Preview invalid state lost its Danger border');
assert.match(css, /\.spec-field\.is-invalid\.is-focused input \{[^}]*outline-color: var\(--focus-ring-danger-context\)/s, 'Invalid + Focus does not use the danger-context ring');
assert.match(css, /\.saved-pair \{[^}]*grid-template-areas:[^}]*"sample copy remove"[^}]*"status status status"/s, 'Saved pair status and remove action do not own separate grid areas');
assert.match(css, /\.pair\.needs-work \{[^}]*box-shadow: 0 3px 12px rgb\(var\(--ui-danger-rgb\) \/ \.08\)/s, 'Fit report optimization tasks lost their full-card state treatment');
assert.doesNotMatch(css, /inset 3px 0 0 var\(--bad\)/, 'Fit report still uses the prohibited left border');
// The colored left bar stays banned as a card treatment. The preview rail's 1px
// divider is column structure, not an accent, so that one rule is exempt by name.
const cardCss = css.split('\n').filter(line => !line.trimStart().startsWith('.preview-rail')).join('\n');
assert.doesNotMatch(cardCss, /border-left|inset 3px 0 0/, 'The visual system still uses a left-border treatment');
assert.match(html, /id="addPair"[^>]*data-i18n="saved\.add"/, 'Saved pair editor lost its add action');
assert.doesNotMatch(html, /Contrast matrix|data-save-pair|id="matrix"/i, 'The removed Contrast matrix surface returned');
assert.doesNotMatch(app, /renderMatrix|data-save-pair|matrix-cell|savedPairId/, 'The removed Contrast matrix interaction returned');
assert.match(html, /id="step-candidates"[\s\S]*class="workflow-block fit-report-block"[\s\S]*id="step-standard"/, 'Role checks do not live in Step 02 Colors');
assert.doesNotMatch(html, /class="workflow-block assignment-block"|id="assignmentList"/, 'Redundant Semantic assignments section returned');
assert.match(html, /id="optimizeSemantics"[^>]*data-i18n="action\.optimizeSemantics"/, 'Role checks lost the one-click semantic optimizer');
assert.match(app, /data-pair-field="foregroundRoleId"[\s\S]*data-pair-field="backgroundRoleId"/, 'A pair lost its independent foreground and background roles');
assert.doesNotMatch(app, /pair\.roleId|paletteSnapshot/, 'The single-role pair model returned');
assert.match(css, /\.saved-pair-fields \{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/s, 'Pair editor fields do not fit the five-field coordinate');
assert.match(html, /id="generateStarterSet"[^>]*data-i18n="saved\.generateLegacy"/, 'Step 03 lost the compatibility starter-set action');
// Only one control in an action group carries a saturated fill, and Secondary
// stays an accent that decorates a badge.
assert.match(css, /\.site-button\.primary \{[^}]*background: var\(--action-primary-background\)/s, 'The primary action lost its filled treatment');
// Neutral is never a button fill: the secondary action is a text button with no
// fill and no border, separated from the primary action by weight.
assert.match(css, /\.site-button\.secondary \{[^}]*background: transparent;[^}]*border-color: transparent/s, 'The secondary action regained a fill or a border');
assert.doesNotMatch(css, /\.site-button\.[a-z-]* \{[^}]*background: var\(--action-secondary-background\)/s, 'A button is filled with the Neutral action surface again');
assert.doesNotMatch(css, /\.site-button\.[a-z-]* \{[^}]*--surface-sunken|\.site-button\.[a-z-]* \{[^}]*--surface-raised/s, 'A button is filled with a Neutral surface again');
assert.doesNotMatch(css, /\.site-button\.secondary \{[^}]*--action-primary-background/s, 'The secondary action is filled again and competes with the primary');
// The preview frame and the site nav share one width.
assert.match(css, /\.preview \{ width: min\(850px, 100%\); \}/, 'The preview frame is no longer bounded to 850px');
assert.match(css, /\.site-accent-badge \{[^}]*background: var\(--accent-secondary-surface\)/s, 'Secondary lost its accent badge role in the preview');
assert.doesNotMatch(css, /\.site-button\.[a-z-]* \{[^}]*--accent-secondary/s, 'Secondary became a filled action instead of an accent');
// Semantic color is local state evidence: the landing page carries no status
// fills, and every feedback treatment lives in the spec zone.
const landingRules = css.slice(css.indexOf('.site-nav {'), css.indexOf('.spec-zone {'));
assert.doesNotMatch(landingRules, /--feedback-/, 'Status colors leaked into the landing page');
assert.match(css, /\.spec-notice\.success \{[^}]*background: var\(--feedback-success-surface\)/s, 'Success feedback lost its own surface, border, and text');
assert.match(css, /\.spec-notice\.danger \.spec-chip \{[^}]*color: var\(--feedback-danger-on-bold\);[^}]*background: var\(--feedback-danger-bold\)/s, 'The bold feedback chip lost its measured on-bold ink');
// The overlay is a scrim; the dialog above it is the surface that carries text.
assert.match(css, /\.spec-overlay \{[^}]*background: var\(--surface-overlay\)/s, 'The overlay scrim lost its token');
assert.match(css, /\.spec-dialog \{[^}]*background: var\(--surface-raised\)/s, 'The dialog is painted on the scrim instead of a raised surface');
assert.doesNotMatch(app, /class="spec-overlay"[^>]*>\s*[^<\s]/, 'The overlay scrim carries text of its own');
assert.doesNotMatch(app, /id="applyProposal"|id="rerollProposal"|id="cancelProposal"/, 'Quick start reintroduced the redundant proposal confirmation actions');
assert.match(app, /id="dismissGenerationIssue"/, 'A failed generation has no dismissible diagnostic report');
assert.match(roleModel, /function starterPairSpecs/, 'The starter set moved out of the role model');
assert.doesNotMatch(roleModel, /borderIcon\.step[^;]*starter/, 'Starter text foregrounds must not reuse the 3:1 border/icon token');

// Dropdowns are one listbox owned by js/select.js. A native select on macOS opens
// its menu over the trigger, so the control being changed disappears behind it.
const selectControl = fs.readFileSync(new URL('../js/select.js', import.meta.url), 'utf8');
assert.match(selectControl, /role', 'listbox'/, 'The dropdown is no longer exposed as a listbox');
assert.match(css, /\.select-menu \{[^}]*top: calc\(100% \+ 6px\)/s, 'The dropdown menu no longer opens below its trigger');
assert.match(css, /\.select-menu\[data-drop="up"\] \{[^}]*bottom: calc\(100% \+ 6px\)/s, 'The dropdown lost its flip-up escape for rows at the bottom of the viewport');
assert.match(css, /\.select-option\[aria-selected="true"\] \{[^}]*font-weight/s, 'The selected option is marked by colour alone');
assert.match(app, /SelectControl\.upgrade\(\)/, 'Rendered selects are never upgraded to the shared dropdown');
assert.doesNotMatch(css, /^\.text-input, select \{/m, 'Native select styling returned alongside the upgraded control');

// Chrome tokenization (plans/2026-08-19-chrome-tokenization.zh.md). The tool's own
// shell resolves every color from a --ui-* token in :root, so a later black-and-white
// pass changes a value list instead of 92 scattered literals. Two directions matter:
// chrome must not hardcode, and the Preview must not borrow a chrome token — it is
// driven by the exported website tokens so the page and the export cannot drift.
const rootStart = css.indexOf(':root {');
const rootEnd = css.indexOf('\n}', rootStart) + 2;
assert.ok(rootStart > -1 && rootEnd > rootStart, 'The :root token block is missing');
const chromeCss = css.slice(0, rootStart) + css.slice(rootEnd);
const bareColors = [...new Set([...chromeCss.matchAll(/#[0-9a-fA-F]{3,6}\b|rgba\(/g)].map(match => match[0]))];
assert.deepEqual(bareColors, [], `Chrome rules hardcode colors instead of --ui-* tokens: ${bareColors.join(', ')}`);

const previewRules = [...css.matchAll(/^\s*(\.(?:site|spec)-[^{]*)\{([^}]*)\}/gm)];
assert.ok(previewRules.length > 20, 'The preview rule scan did not inspect the preview');
const borrowedChrome = previewRules.filter(([, , body]) => /var\(--ui-/.test(body)).map(([, selector]) => selector.trim());
assert.deepEqual(borrowedChrome, [], `Preview rules borrowed chrome tokens: ${borrowedChrome.join(', ')}`);

console.log(`static-contract: ${ids.length} IDs and ${new Set(idSelectors).size} JavaScript ID selectors passed`);
