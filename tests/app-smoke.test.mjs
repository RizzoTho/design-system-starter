import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeClassList {
  values = new Set();
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : force;
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.disabled = false;
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.classList = new FakeClassList();
    this.style = { values: {}, setProperty: (name, value) => { this.style.values[name] = value; } };
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  focus() {}
  select() {}
  remove() {}
  scrollIntoView() {}
  closest() { return null; }
  dispatch(type, extra = {}) { this.listeners[type]?.({ target: this, preventDefault() {}, ...extra }); }
}

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const elements = Object.fromEntries(ids.map(id => [id, new FakeElement(id)]));
elements.targetSelect.value = '4.5';
elements.backgroundColor.value = '#f7f3eb';
elements.backgroundHexInput.value = '#F7F3EB';
elements.textColor.value = '#25231f';
elements.textHexInput.value = '#25231F';

const previewButtons = ['light', 'dark'].map(theme => {
  const element = new FakeElement();
  element.dataset.previewTheme = theme;
  return element;
});
const languageButtons = ['en', 'zh'].map(language => {
  const element = new FakeElement();
  element.dataset.language = language;
  return element;
});
const stepLinks = [
  ['context', '#step-context'],
  ['candidates', '#step-candidates'],
  ['standard', '#step-standard'],
  ['preview', '#preview'],
  ['export', '#export'],
].map(([step, href]) => {
  const element = new FakeElement();
  element.dataset.stepLink = step;
  element.attributes.href = href;
  return element;
});
const workflowTargets = ['step-context', 'step-candidates', 'step-standard', 'preview'].map(id => elements[id]);
workflowTargets.forEach((element, index) => { element.dataset.workflowStep = ['context', 'candidates', 'standard', 'preview'][index]; });

const documentListeners = {};
let lastCreatedElement = null;
let copiedText = '';
const document = {
  body: { appendChild() {} },
  documentElement: { lang: 'en' },
  querySelector(selector) { return selector.startsWith('#') ? elements[selector.slice(1)] || null : null; },
  querySelectorAll(selector) {
    if (selector === '[data-preview-theme]') return previewButtons;
    if (selector === '[data-language]') return languageButtons;
    if (selector === '[data-step-link]') return stepLinks;
    if (selector === '[data-workflow-step]') return workflowTargets;
    return [];
  },
  addEventListener(type, listener) { documentListeners[type] = listener; },
  createElement() { lastCreatedElement = new FakeElement(); return lastCreatedElement; },
  execCommand() { copiedText = lastCreatedElement?.value || ''; return true; },
};

class FakeIntersectionObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
}

const sandbox = {
  console,
  document,
  navigator: {},
  IntersectionObserver: FakeIntersectionObserver,
  setTimeout,
  clearTimeout,
};
sandbox.window = sandbox;
sandbox.window.isSecureContext = false;
sandbox.window.matchMedia = () => ({ matches: true });

const context = vm.createContext(sandbox);
for (const file of ['../js/color-engine.js', '../js/i18n.js', '../js/role-model.js', '../js/app.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), context, { filename: file });
}

assert.equal(document.documentElement.lang, 'en');
assert.equal(languageButtons[0].attributes['aria-pressed'], 'true');
assert.equal(languageButtons[1].attributes['aria-pressed'], 'false');
assert.equal(elements.semanticSyncActions.hidden, false, 'Brand sync action is hidden while Brand is active');

assert.match(elements.roleOverview.innerHTML, /Brand/);
assert.match(elements.roleOverview.innerHTML, /Regular/);
assert.match(elements.roleOverview.innerHTML, /Alias of Neutral/);
assert.equal((elements.scale.innerHTML.match(/class="swatch"/g) || []).length, 11);
assert.match(elements.contextStatus.innerHTML, /PASS · AAA/);
elements.textHexInput.value = '#F7F3EB';
elements.textHexInput.dispatch('change');
assert.match(elements.contextStatus.innerHTML, /FAIL/);
elements.textHexInput.value = '#25231F';
elements.textHexInput.dispatch('change');
assert.match(elements.contextStatus.innerHTML, /PASS · AAA/);
assert.match(elements.pairList.innerHTML, /Information/);
assert.match(elements.assignmentList.innerHTML, /Uses Neutral assignments/);
for (const content of [elements.lightPreviewContent.innerHTML, elements.darkPreviewContent.innerHTML]) {
  assert.match(content, /Publish update/);
  assert.match(content, /Review focus order/);
  assert.match(content, /Check empty states/);
  assert.match(content, /Enter a complete email address/);
  assert.match(content, /Accessibility review/);
  assert.match(content, /Contrast checks/);
  assert.match(content, /Theme palette/);
  assert.match(content, /Release signals/);
  assert.match(content, /No archived releases/);
  assert.match(content, /class="product-field focused"/);
  assert.match(content, /class="product-field invalid"/);
}
assert.match(elements.lightPreviewContent.innerHTML, /previewReleaseNote-light/);
assert.match(elements.darkPreviewContent.innerHTML, /previewReleaseNote-dark/);
const previewIds = [...`${elements.lightPreviewContent.innerHTML}${elements.darkPreviewContent.innerHTML}`.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(previewIds).size, previewIds.length, 'Light and Dark preview markup contains duplicate IDs');
assert.ok(context.window.ColorEngine.contrast(elements.lightPreview.style.values['--pv-muted-text'], elements.lightPreview.style.values['--pv-panel']) >= 4.5);
assert.ok(context.window.ColorEngine.contrast(elements.darkPreview.style.values['--pv-muted-text'], elements.darkPreview.style.values['--pv-panel']) >= 4.5);

languageButtons[1].dispatch('click');
assert.equal(document.documentElement.lang, 'zh-CN');
assert.equal(languageButtons[0].attributes['aria-pressed'], 'false');
assert.equal(languageButtons[1].attributes['aria-pressed'], 'true');
assert.match(elements.activeRoleDescription.textContent, /核心识别色/);
assert.match(elements.lightPreviewContent.innerHTML, /发布更新/);
assert.match(elements.contextStatus.innerHTML, /要求 · 4\.5:1/);
languageButtons[0].dispatch('click');
assert.equal(document.documentElement.lang, 'en');
assert.match(elements.lightPreviewContent.innerHTML, /Publish update/);

const savedPairTarget = {
  dataset: { pairRole: 'brand', pairForeground: '#FFF6F4', pairBackground: '#BF4B2E' },
};
const pairClick = {
  target: { closest: selector => selector === '[data-save-pair]' ? savedPairTarget : null },
};
documentListeners.click(pairClick);
documentListeners.click(pairClick);
assert.equal(elements.savedPairCount.textContent, '1', 'Duplicate matrix clicks created duplicate saved pairs');
assert.match(elements.savedPairs.innerHTML, /#FFF6F4 → #BF4B2E/);
assert.match(elements.savedPairs.innerHTML, /Static/);
assert.match(elements.matrix.innerHTML, /matrix-cell[^>]*saved/);

const pairUsageTarget = {
  value: 'interactive',
  dataset: { pairUsage: 'brand:#FFF6F4:#BF4B2E' },
  closest: selector => selector === '[data-pair-usage]' ? pairUsageTarget : null,
};
documentListeners.change({ target: pairUsageTarget });
assert.match(elements.savedPairs.innerHTML, /Interactive/);
assert.match(elements.savedPairs.innerHTML, /Hover/);
assert.match(elements.savedPairs.innerHTML, /Pressed/);
assert.match(elements.savedPairs.innerHTML, /Focus/);

elements.copyJson.dispatch('click');
const exportedJson = JSON.parse(copiedText);
assert.equal(exportedJson.roles.regular.aliasOf, 'neutral');
assert.equal('secondary' in exportedJson.reference, false);
assert.equal(exportedJson.semantic.regular.aliasOf, 'neutral');
assert.equal(exportedJson.pairs.length, 1);
assert.equal(exportedJson.pairs[0].roleId, 'brand');
assert.equal(exportedJson.pairs[0].usage, 'interactive');
assert.equal(exportedJson.pairs[0].states.default.background, '#BF4B2E');
assert.ok(exportedJson.pairs[0].states.hover.background);
assert.ok(exportedJson.pairs[0].states.pressed.background);
assert.ok(exportedJson.pairs[0].focusRing.hex);
elements.copyCss.dispatch('click');
assert.doesNotMatch(copiedText, /--color-secondary-/);
assert.match(copiedText, /--color-regular-light-subtle: var\(--color-neutral-light-subtle\)/);
assert.match(copiedText, /--pair-brand-1-foreground: #FFF6F4/);
assert.match(copiedText, /--pair-brand-1-background-hover:/);
assert.match(copiedText, /--pair-brand-1-background-pressed:/);
assert.match(copiedText, /--pair-brand-1-focus-ring:/);

documentListeners.click({
  target: { closest: selector => selector === '[data-select-role]' ? { dataset: { selectRole: 'regular' } } : null },
});
assert.match(elements.candidateLabel.textContent, /Regular/);
assert.match(elements.summaryTitle.textContent, /uses Neutral/);
assert.equal(elements.semanticSyncActions.hidden, true, 'Brand sync action remained visible for Regular');

documentListeners.click({
  target: { closest: selector => selector === '[data-select-role]' ? { dataset: { selectRole: 'secondary' } } : null },
});
elements.secondaryStrategy.value = 'analogous';
elements.secondaryStrategy.dispatch('change');
assert.equal(elements.hexInput.disabled, false);
assert.equal((elements.secondarySuggestions.innerHTML.match(/class="suggestion"/g) || []).length, 3);

elements.targetSelect.value = '7';
elements.targetSelect.dispatch('change');
assert.match(elements.matrixNote.textContent, /AAA/);
assert.match(elements.savedPairs.innerHTML, /FAIL/, 'Saved pair status did not follow the global target');
assert.ok(context.window.ColorEngine.contrast(elements.lightPreview.style.values['--pv-muted-text'], elements.lightPreview.style.values['--pv-panel']) >= 7);
assert.ok(context.window.ColorEngine.contrast(elements.darkPreview.style.values['--pv-muted-text'], elements.darkPreview.style.values['--pv-panel']) >= 7);

elements.hexInput.value = 'invalid';
elements.hexInput.dispatch('change');
assert.equal(elements.hexInput.attributes['aria-invalid'], 'true');

documentListeners.click({
  target: { closest: selector => selector === '[data-select-role]' ? { dataset: { selectRole: 'danger' } } : null },
});
const lockedDanger = elements.hexInput.value;
elements.lockRole.dispatch('click');
documentListeners.click({
  target: { closest: selector => selector === '[data-select-role]' ? { dataset: { selectRole: 'brand' } } : null },
});
elements.hexInput.value = '#4F46E5';
elements.hexInput.dispatch('change');
elements.generateSemantics.dispatch('click');
documentListeners.click({
  target: { closest: selector => selector === '[data-select-role]' ? { dataset: { selectRole: 'danger' } } : null },
});
assert.equal(elements.hexInput.value, lockedDanger, 'Generating from a new Brand changed a locked semantic role');

documentListeners.click({
  target: { closest: selector => selector === '[data-remove-pair]' ? { dataset: { removePair: 'brand:#FFF6F4:#BF4B2E' } } : null },
});
assert.equal(elements.savedPairCount.textContent, '0');
assert.match(elements.savedPairs.innerHTML, /No pairs saved yet/);

console.log('app-smoke: startup and core role interactions passed');
