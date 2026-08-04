import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicateIds)], [], 'HTML contains duplicate IDs');

const idSelectors = [...app.matchAll(/\$\('#([^']+)'\)/g)].map(match => match[1]);
const missingIds = [...new Set(idSelectors.filter(id => !ids.includes(id)))];
assert.deepEqual(missingIds, [], `JavaScript points to missing IDs: ${missingIds.join(', ')}`);

for (const source of ['styles.css', 'js/color-engine.js', 'js/i18n.js', 'js/role-model.js', 'js/app.js']) {
  assert.match(html, new RegExp(`["']${source.replace('.', '\\.')}["']`), `${source} is not linked from index.html`);
}

assert.doesNotMatch(html, /<style\b/i, 'Inline style owner returned to index.html');
assert.doesNotMatch(html, /id="regenerateRole"/, 'The ineffective Regenerate action returned');
assert.ok(html.indexOf('id="generateSemantics"') < html.indexOf('id="lockRole"'), 'Sync and Lock button order regressed');
assert.match(html, /id="generateSemantics" class="button"/, 'Sync action did not receive the secondary visual style');
assert.match(html, /id="lockRole" class="button primary full-button"/, 'Lock action did not receive the primary visual style');
assert.match(html, /<span id="scaleDiagnostics" class="scale-diagnostic-inline" hidden><\/span>/, 'Scale diagnostics are not inline with the description');
assert.ok(html.indexOf('id="targetSelect"') > html.indexOf('id="stepDock"'), 'WCAG target is not owned by the bottom-right global dock');
assert.equal([...html.matchAll(/<script\b/g)].length, 4, 'Unexpected script count');
assert.ok(idSelectors.length > 30, 'Static selector scan did not inspect the app');
assert.match(css, /\.product-field input \{[^}]*border: 1px solid var\(--pv-neutral-line\)[^}]*outline: 0/s, 'Preview inputs do not have a neutral default state');
assert.match(css, /\.product-field\.focused input,[^\{]*\.product-field input:focus-visible \{[^}]*outline: 2px solid var\(--pv-brand\)/s, 'Preview focus is not modeled with a Brand ring');
assert.match(css, /\.product-field\.invalid input \{[^}]*border-color: var\(--pv-danger-line\)/s, 'Preview invalid state lost its Danger border');
assert.match(css, /\.product-field\.invalid\.focused input \{[^}]*outline-color: var\(--pv-brand\)/s, 'Invalid + Focus does not preserve the Brand outer ring');
assert.match(css, /\.saved-pair \{[^}]*grid-template-areas:[^}]*"sample copy remove"[^}]*"status status status"/s, 'Saved pair status and remove action do not own separate grid areas');
assert.match(css, /\.pair\.needs-work \{[^}]*box-shadow: 0 3px 12px rgba\(180,76,56,\.08\)/s, 'Fit report optimization tasks lost their full-card state treatment');
assert.doesNotMatch(css, /inset 3px 0 0 var\(--bad\)/, 'Fit report still uses the prohibited left border');
assert.doesNotMatch(css, /border-left|inset 3px 0 0/, 'The visual system still uses a left-border treatment');
assert.match(html, /id="addPair"[^>]*data-i18n="saved\.add"/, 'Saved pair editor lost its add action');
assert.doesNotMatch(html, /Contrast matrix|data-save-pair|id="matrix"/i, 'The removed Contrast matrix surface returned');
assert.doesNotMatch(app, /renderMatrix|data-save-pair|matrix-cell|savedPairId/, 'The removed Contrast matrix interaction returned');
assert.match(html, /id="step-candidates"[\s\S]*class="workflow-block fit-report-block"[\s\S]*id="step-standard"/, 'Role checks do not live in Step 02 Colors');
assert.doesNotMatch(html, /class="workflow-block assignment-block"|id="assignmentList"/, 'Redundant Semantic assignments section returned');
assert.match(html, /id="optimizeSemantics"[^>]*data-i18n="action\.optimizeSemantics"/, 'Role checks lost the one-click semantic optimizer');

console.log(`static-contract: ${ids.length} IDs and ${new Set(idSelectors).size} JavaScript ID selectors passed`);
