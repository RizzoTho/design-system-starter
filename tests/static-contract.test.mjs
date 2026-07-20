import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicateIds)], [], 'HTML contains duplicate IDs');

const idSelectors = [...app.matchAll(/\$\('#([^']+)'\)/g)].map(match => match[1]);
const missingIds = [...new Set(idSelectors.filter(id => !ids.includes(id)))];
assert.deepEqual(missingIds, [], `JavaScript points to missing IDs: ${missingIds.join(', ')}`);

for (const source of ['styles.css', 'js/color-engine.js', 'js/role-model.js', 'js/app.js']) {
  assert.match(html, new RegExp(`["']${source.replace('.', '\\.')}["']`), `${source} is not linked from index.html`);
}

assert.doesNotMatch(html, /<style\b/i, 'Inline style owner returned to index.html');
assert.equal([...html.matchAll(/<script\b/g)].length, 3, 'Unexpected script count');
assert.ok(idSelectors.length > 30, 'Static selector scan did not inspect the app');

console.log(`static-contract: ${ids.length} IDs and ${new Set(idSelectors).size} JavaScript ID selectors passed`);
