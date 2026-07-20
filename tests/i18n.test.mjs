import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const roleModel = fs.readFileSync(new URL('../js/role-model.js', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../js/i18n.js', import.meta.url), 'utf8');

const sandbox = { window: {} };
vm.runInContext(source, vm.createContext(sandbox), { filename: 'js/i18n.js' });
const i18n = sandbox.window.I18n;

assert.equal(i18n.language, 'en', 'English must remain the default language');
assert.deepEqual(Object.keys(i18n.messages.en).sort(), Object.keys(i18n.messages.zh).sort(), 'EN and 中 catalogs differ');
assert.throws(() => i18n.t('missing.key'), /Missing i18n key/);
assert.throws(() => i18n.t('role.uses'), /Missing i18n param/);

const referencedKeys = new Set([
  ...[...html.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)].map(match => match[1]),
  ...[...app.matchAll(/\bt\('([^']+)'/g)].map(match => match[1]),
  ...[...roleModel.matchAll(/(?:descriptionKey|labelKey): '([^']+)'/g)].map(match => match[1]),
]);
for (const key of referencedKeys) {
  assert.ok(key in i18n.messages.en, `Missing EN translation for ${key}`);
  assert.ok(key in i18n.messages.zh, `Missing 中 translation for ${key}`);
}

assert.match(html, /<html lang="en">/, 'The document must start in English');
assert.match(html, /data-language="en"[^>]*aria-pressed="true"/, 'EN switch is not active by default');
assert.match(html, /data-language="zh"[^>]*aria-pressed="false"/, '中 switch is unexpectedly active by default');

console.log(`i18n: ${Object.keys(i18n.messages.en).length} paired messages and ${referencedKeys.size} references passed`);
