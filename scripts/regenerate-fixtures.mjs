// Regenerate tests/fixtures/default-export.{css,json} from the current app source.
//
// The fixtures freeze the default-state export contract so Phase 6 migration and
// Phase 8 consolidation can compare against a known baseline. They are not
// referenced by the runtime suites yet; they are the recorded compatibility baseline.
//
// Usage: node scripts/regenerate-fixtures.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const repoRoot = new URL('..', import.meta.url);

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
    this.scrollCount = 0;
    this.style = { values: {}, setProperty: (name, value) => { this.style.values[name] = value; } };
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  focus() {}
  select() {}
  remove() {}
  scrollIntoView() { this.scrollCount += 1; }
  closest() { return null; }
  dispatch(type, extra = {}) { this.listeners[type]?.({ target: this, preventDefault() {}, ...extra }); }
}

const html = fs.readFileSync(new URL('index.html', repoRoot), 'utf8');
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
let copiedText = '';
let lastCreatedElement = null;
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
for (const file of ['js/color-engine.js', 'js/i18n.js', 'js/role-model.js', 'js/token-contract.js', 'js/system-generator.js', 'js/project-state.js', 'js/app.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, repoRoot), 'utf8'), context, { filename: file });
}

// Keep the default Context values so the fixture matches the untouched first visit.
elements.copyCss.dispatch('click');
const css = copiedText;
elements.copyJson.dispatch('click');
const json = copiedText;

assert.match(css, /--color-background: #F7F3EB/);
assert.match(json, /"advancedPairTarget": 4\.5/);

const fixturesDir = new URL('tests/fixtures/', repoRoot);
fs.mkdirSync(fixturesDir, { recursive: true });
fs.writeFileSync(new URL('default-export.css', fixturesDir), css);
fs.writeFileSync(new URL('default-export.json', fixturesDir), json);

// Phase 6 fixtures: the layered v2 export after the default Quick start system
// auto-applies on an untouched session. These freeze the generated website
// token contract plus the compatibility sections.
elements.characterSelect.value = 'balanced';
elements.brandSourceSelect.value = 'generated';
elements.quickSecondaryStrategy.value = 'none';
elements.generateSystem.dispatch('click');
assert.match(elements.generationResult.innerHTML, /READY/);
elements.copyCss.dispatch('click');
const v2Css = copiedText;
elements.copyJson.dispatch('click');
const v2Json = copiedText;
assert.match(v2Css, /--palette-brand-500: /);
assert.match(v2Css, /--role-brand-light-bold: var\(--palette-brand-600\)/);
assert.match(v2Css, /--surface-page: var\(--role-neutral-light-subtle\)/);
assert.match(v2Css, /\[data-theme="dark"\]/);
assert.match(v2Json, /"schemaVersion": 2/);
fs.writeFileSync(new URL('default-system-v2.css', fixturesDir), v2Css);
fs.writeFileSync(new URL('default-system-v2.json', fixturesDir), v2Json);
console.log('regenerate-fixtures: wrote default-export.{css,json} and default-system-v2.{css,json}');
