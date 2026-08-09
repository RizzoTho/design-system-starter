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

for (const source of ['styles.css', 'js/color-engine.js', 'js/i18n.js', 'js/role-model.js', 'js/token-contract.js', 'js/system-generator.js', 'js/project-state.js', 'js/app.js']) {
  assert.match(html, new RegExp(`["']${source.replace('.', '\\.')}["']`), `${source} is not linked from index.html`);
}

const scriptSources = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
const expectedOrder = ['js/color-engine.js', 'js/i18n.js', 'js/role-model.js', 'js/token-contract.js', 'js/system-generator.js', 'js/project-state.js', 'js/app.js'];
assert.deepEqual(scriptSources, expectedOrder, 'Script sources are missing or out of dependency order');

assert.doesNotMatch(html, /<style\b/i, 'Inline style owner returned to index.html');
assert.doesNotMatch(html, /id="regenerateRole"/, 'The ineffective Regenerate action returned');
assert.ok(html.indexOf('id="generateSemantics"') < html.indexOf('id="lockRole"'), 'Sync and Lock button order regressed');
assert.match(html, /id="generateSemantics" class="button"/, 'Sync action did not receive the secondary visual style');
assert.match(html, /id="lockRole" class="button primary full-button"/, 'Lock action did not receive the primary visual style');
assert.match(html, /<span id="scaleDiagnostics" class="scale-diagnostic-inline" hidden><\/span>/, 'Scale diagnostics are not inline with the description');
assert.ok(html.indexOf('id="targetSelect"') > html.indexOf('id="stepDock"'), 'WCAG target is not owned by the bottom-right global dock');
assert.equal([...html.matchAll(/<script\b/g)].length, 7, 'Unexpected script count');
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
assert.match(app, /data-pair-field="foregroundRoleId"[\s\S]*data-pair-field="backgroundRoleId"/, 'A pair lost its independent foreground and background roles');
assert.doesNotMatch(app, /pair\.roleId|paletteSnapshot/, 'The single-role pair model returned');
assert.match(css, /\.saved-pair-fields \{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/s, 'Pair editor fields do not fit the five-field coordinate');
assert.match(html, /id="generateStarterSet"[^>]*data-i18n="saved\.generateLegacy"/, 'Step 03 lost the compatibility starter-set action');
assert.match(css, /\.product-secondary-button \{[^}]*background: transparent/s, 'The preview secondary action is filled again and competes with the primary');
assert.doesNotMatch(app, /--pv-secondary:|--pv-on-secondary:/, 'Secondary is being used as a filled control colour again');
assert.match(app, /--pv-accent-soft:|--pv-accent-line:/, 'Secondary lost its accent role in the preview');
assert.match(app, /--pv-accent:\$\{accent\.bold\.hex\}/, 'Preview accent has no bold assignment for meaning-bearing badges');
assert.match(app, /--pv-on-accent:\$\{accent\.onBold\.hex\}/, 'Preview accent badge does not use measured on-bold ink');
assert.match(css, /\.product-kicker \{[^}]*color: var\(--pv-on-accent\);[^}]*background: var\(--pv-accent\)/s, 'The Preview kicker returned to grey plus bright accent text');
assert.match(css, /\.progress-badge \{[^}]*color: var\(--pv-on-brand\);[^}]*background: var\(--pv-brand\)/s, 'The progress badge returned to grey plus bright Brand text');
assert.match(css, /\.task-state \{[^}]*color: var\(--pv-on-success\);[^}]*background: var\(--pv-success\)/s, 'Success task state lost its solid semantic treatment');
assert.match(css, /\.task-list li\.warning \.task-state \{[^}]*color: var\(--pv-on-warning\);[^}]*background: var\(--pv-warning\)/s, 'Warning task state lost its solid semantic treatment');
assert.match(css, /\.product-field\.invalid small \{[^}]*color: var\(--pv-on-danger\);[^}]*background: var\(--pv-danger\)/s, 'Invalid feedback returned to grey plus bright Danger text');
assert.match(app, /<svg class="notification-icon"[^>]*aria-hidden="true"/, 'The Preview notification control has no recognizable bell icon');
assert.doesNotMatch(app, /aria\.notifications'\)\}">●<\/button>/, 'The ambiguous notification dot returned');
assert.match(css, /\.info-callout \{[^}]*background: var\(--pv-panel\)/s, 'Information returned as a large tinted Preview surface');
assert.match(css, /\.warning-button \{[^}]*background: transparent/s, 'Warning returned as a competing filled Preview action');
assert.match(css, /\.signal-bars i::after \{[^}]*background: var\(--pv-neutral-bold\)/s, 'Signal bars use three competing semantic fills again');
assert.match(css, /\.signal-bars small::before \{[^}]*background: var\(--signal-marker\)/s, 'Semantic signal markers disappeared from the neutral bars');
assert.doesNotMatch(app, /id="applyProposal"|id="rerollProposal"|id="cancelProposal"/, 'Quick start reintroduced the redundant proposal confirmation actions');
assert.match(app, /id="dismissGenerationIssue"/, 'A failed generation has no dismissible diagnostic report');
assert.match(roleModel, /function starterPairSpecs/, 'The starter set moved out of the role model');
assert.doesNotMatch(roleModel, /borderIcon\.step[^;]*starter/, 'Starter text foregrounds must not reuse the 3:1 border/icon token');

console.log(`static-contract: ${ids.length} IDs and ${new Set(idSelectors).size} JavaScript ID selectors passed`);
