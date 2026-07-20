import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeClassList {
  values = new Set();
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
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
  querySelector(selector) { return selector.startsWith('#') ? elements[selector.slice(1)] || null : null; },
  querySelectorAll(selector) {
    if (selector === '[data-preview-theme]') return previewButtons;
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
for (const file of ['../js/color-engine.js', '../js/role-model.js', '../js/app.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), context, { filename: file });
}

assert.match(elements.roleOverview.innerHTML, /Brand/);
assert.match(elements.roleOverview.innerHTML, /Regular/);
assert.match(elements.roleOverview.innerHTML, /Alias of Neutral/);
assert.equal((elements.scale.innerHTML.match(/class="swatch"/g) || []).length, 11);
assert.match(elements.contextStatus.innerHTML, /PASS · AAA/);
assert.match(elements.pairList.innerHTML, /Information/);
assert.match(elements.assignmentList.innerHTML, /Uses Neutral assignments/);
assert.match(elements.lightPreviewContent.innerHTML, /Sync in progress/);
assert.match(elements.darkPreviewContent.innerHTML, /Could not publish/);

elements.copyJson.dispatch('click');
const exportedJson = JSON.parse(copiedText);
assert.equal(exportedJson.roles.regular.aliasOf, 'neutral');
assert.equal('secondary' in exportedJson.reference, false);
assert.equal(exportedJson.semantic.regular.aliasOf, 'neutral');
elements.copyCss.dispatch('click');
assert.doesNotMatch(copiedText, /--color-secondary-/);
assert.match(copiedText, /--color-regular-light-subtle: var\(--color-neutral-light-subtle\)/);

documentListeners.click({
  target: { closest: selector => selector === '[data-select-role]' ? { dataset: { selectRole: 'regular' } } : null },
});
assert.match(elements.candidateLabel.textContent, /Regular/);
assert.match(elements.summaryTitle.textContent, /uses Neutral/);

documentListeners.click({
  target: { closest: selector => selector === '[data-select-role]' ? { dataset: { selectRole: 'secondary' } } : null },
});
elements.secondaryStrategy.value = 'analogous';
elements.secondaryStrategy.dispatch('change');
assert.equal(elements.hexInput.disabled, false);
assert.equal((elements.secondarySuggestions.innerHTML.match(/class="suggestion"/g) || []).length, 3);

elements.targetSelect.value = '7';
elements.targetSelect.dispatch('change');
assert.match(elements.matrixNote.innerHTML, /AAA/);

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

console.log('app-smoke: startup and core role interactions passed');
