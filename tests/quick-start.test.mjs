import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Every valid generation applies immediately so the useful result remains one
// click away. Undo restores the system that was active before that generation.

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
    this.style = {
      values: {},
      setProperty: (name, value) => { this.style.values[name] = value; },
      removeProperty: (name) => { delete this.style.values[name]; },
    };
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
  querySelector(selector) { return selector === '[data-step-toggle]' ? this.stepMark ?? null : null; }
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
const workflowTargets = ['quick-start', 'step-context', 'step-candidates', 'step-standard', 'preview'].map(id => elements[id]);
workflowTargets.forEach((element, index) => { element.dataset.workflowStep = ['quick-start', 'context', 'candidates', 'standard', 'preview'][index]; });
workflowTargets.forEach(element => { element.stepMark = new FakeElement(); });

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
for (const file of ['../js/color-engine.js', '../js/i18n.js', '../js/role-model.js', '../js/token-contract.js', '../js/system-generator.js', '../js/project-state.js', '../js/select.js', '../js/app.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), context, { filename: file });
}

// A fresh session: the first click must produce a rendered website system.
elements.characterSelect.value = 'balanced';
elements.brandSourceSelect.value = 'generated';
elements.quickSecondaryStrategy.value = 'none';
elements.generateSystem.dispatch('click');

assert.match(elements.generationResult.innerHTML, /READY/, 'First generation did not reach READY');
assert.match(elements.generationResult.innerHTML, /View preview/, 'Applied system has no direct Preview route');
assert.match(elements.generationResult.innerHTML, /Undo generation/, 'Applied system shows no Undo');
assert.doesNotMatch(elements.generationResult.innerHTML, /Apply system|Reroll|Cancel/, 'Applied system still asks for proposal confirmation');
assert.ok(elements.websiteTokens.innerHTML.includes('--surface-page'), 'Website tokens did not render');
assert.ok(elements.websiteTokens.innerHTML.includes('--feedback-success-text'), 'Feedback tokens missing');
assert.ok(elements.websiteTokens.innerHTML.includes('--action-primary-background-hover'), 'Action state tokens missing');
assert.match(elements.contextSourceNote.textContent, /Generated/, 'Context source note missing');
assert.ok(elements.websiteTokenStatus.innerHTML.includes('READY'), 'Step 03 status is not READY');
assert.ok(elements.websiteTokenStatus.innerHTML.includes('READY WITH WARNINGS') === false, 'Unexpected warnings on default');

// Phase 5: Preview consumes the website token contract, not ad hoc colors.
const pageRow = elements.websiteTokens.innerHTML.split('--surface-page')[1].split('</tr>')[0];
const pageLightHex = (pageRow.split('<td>')[1].match(/#[0-9A-F]{6}/) || [])[0];
const pageDarkHex = (pageRow.split('<td>')[2].match(/#[0-9A-F]{6}/) || [])[0];
assert.ok(pageLightHex && pageDarkHex, 'Website token table lost the surface.page values');
assert.equal(elements.lightPreview.style.values['--surface-page'], pageLightHex,
  'Light preview canvas does not consume the website token contract');
assert.equal(elements.darkPreview.style.values['--surface-page'], pageDarkHex,
  'Dark preview canvas does not consume the website token contract');
// The landing page paints that same value; the export and the page cannot drift.
assert.ok(elements.lightPreviewContent.innerHTML.includes(`--surface-page:${pageLightHex}`),
  'Light landing page is not painted by the exported surface token');
assert.ok(elements.darkPreviewContent.innerHTML.includes(`--surface-page:${pageDarkHex}`),
  'Dark landing page is not painted by the exported surface token');

// Theme palette cards name the token source, show the measured result, and link
// back to their role in Colors.
assert.match(elements.lightPreviewContent.innerHTML, /feedback\.success\.bold/, 'Palette card lost its token source');
assert.match(elements.lightPreviewContent.innerHTML, /action\.primary\.background/, 'Brand card lost its token source');
assert.match(elements.lightPreviewContent.innerHTML, /data-select-role="danger"/, 'Palette card does not link back to Colors');
assert.match(elements.lightPreviewContent.innerHTML, /· PASS/, 'Palette card lost its measured result');

// The preview and the token contract agree on muted text.
const mutedLight = (elements.websiteTokens.innerHTML.split('--content-muted')[1].match(/#[0-9A-F]{6}/) || [])[0];
assert.equal(elements.lightPreview.style.values['--content-muted'], mutedLight,
  'Light preview muted text diverges from the token contract');

// Advanced edits re-resolve the contract instead of leaving stale Website
// tokens and Preview values behind.
const primaryBeforeEdit = (elements.websiteTokens.innerHTML.split('--action-primary-background<')[1].match(/#[0-9A-F]{6}/) || [])[0];
elements.hexInput.value = '#4F46E5';
elements.hexInput.dispatch('change');
const primaryAfterEdit = (elements.websiteTokens.innerHTML.split('--action-primary-background<')[1].match(/#[0-9A-F]{6}/) || [])[0];
assert.notEqual(primaryAfterEdit, primaryBeforeEdit, 'Advanced Brand edit left the contract stale');
assert.ok(elements.lightPreviewContent.innerHTML.includes(`--action-primary-background:${primaryAfterEdit}`),
  'Preview diverged from the re-resolved token');

// Coverage profiles are gone: the project payload and the export carry the
// generic contract only.
elements.copyJson.dispatch('click');
const websiteJson = JSON.parse(copiedText);
assert.equal('profileId' in websiteJson, false, 'Project JSON still carries a coverage profile');
assert.equal('profileId' in websiteJson.website, false, 'Website JSON still carries a coverage profile');
elements.copyCss.dispatch('click');
assert.ok(copiedText.includes('--surface-page:'), 'CSS export lost the generic contract');
assert.ok(copiedText.includes('--surface-hero:') === false, 'CSS export still emits retired profile tokens');

// The applied system feeds the Advanced workflow: Context passes and palettes render.
assert.match(elements.contextStatus.innerHTML, /PASS/, 'Generated Context does not pass');
assert.equal((elements.scale.innerHTML.match(/class="swatch"/g) || []).length, 11, 'Applied system did not render a scale');

// The compatibility pair action projects the applied website system onto pair
// coordinates; the website tokens own the starter result.
const pairsBeforeCompat = Number(elements.savedPairCount.textContent);
elements.generateStarterSet.dispatch('click');
// Body text, muted text, and link sat on surface.page. That surface is now the
// Context color, which has no palette coordinate, so the legacy pair model can
// no longer express them and the projection skips them instead of describing a
// different color than the page.
assert.equal(Number(elements.savedPairCount.textContent), pairsBeforeCompat + 7,
  'Compatibility projection did not produce seven palette-expressible rows with Secondary disabled');
elements.copyJson.dispatch('click');
const compatJson = JSON.parse(copiedText);
const compatSlugs = compatJson.pairs.map(pair => pair.slug);
for (const slug of ['body-text', 'muted-text', 'link']) {
  assert.ok(!compatSlugs.includes(slug), `${slug} was projected onto a palette step that is not the page`);
}
const compatPrimary = compatJson.pairs.find(pair => pair.slug === 'primary-action');
assert.equal(compatPrimary.foregroundStep, 'auto', 'Primary action did not use measured ink');
assert.equal(compatPrimary.backgroundRoleId, 'brand', 'Primary action background left the Brand role');
assert.equal(compatJson.pairs.find(pair => pair.slug === 'success-notice').backgroundRoleId, 'success',
  'Semantic notice left its own role surface');
for (const pair of compatJson.pairs.filter(item => item.slug)) {
  assert.ok(pair.ratio >= compatJson.advancedPairTarget, `${pair.slug} dropped below the active target`);
}

// A second click is the reroll: it applies immediately and can be undone.
const brandBeforeRegenerate = elements.hexInput.value;
elements.generateSystem.dispatch('click');
assert.notEqual(elements.hexInput.value, brandBeforeRegenerate, 'Second Generate did not produce a fresh unlocked Brand');
assert.doesNotMatch(elements.generationResult.innerHTML, /Apply system|Reroll|Cancel/, 'Second Generate returned to proposal confirmation');
documentListeners.click({ target: { closest: selector => selector === '#undoApply' ? {} : null } });
assert.equal(elements.hexInput.value, brandBeforeRegenerate, 'Undo did not restore the previous Brand');
assert.doesNotMatch(elements.generationResult.innerHTML, /Undo generation/, 'Consumed one-level Undo remained active');
assert.match(elements.generationResult.innerHTML, /View preview/, 'Undo lost the direct Preview route');
assert.ok(elements.websiteTokens.innerHTML.includes('--surface-page'), 'Undo lost the website tokens');

// Keep current brand source preserves the applied Brand seed.
elements.brandSourceSelect.value = 'keep';
const currentBrand = elements.hexInput.value;
elements.generateSystem.dispatch('click');
assert.equal(elements.hexInput.value, currentBrand, 'Keep current did not preserve the Brand seed');

// A locked Brand survives generation: lock, generate with a different source,
// and the seed must not change.
documentListeners.click({ target: { closest: selector => selector === '[data-select-role]' ? { dataset: { selectRole: 'brand' } } : null } });
elements.lockRole.dispatch('click');
elements.brandSourceSelect.value = 'generated';
elements.generateSystem.dispatch('click');
assert.equal(elements.hexInput.value, currentBrand, 'A locked Brand changed after generation');

// NEEDS ATTENTION keeps the current system and only exposes a diagnostic report.
// A locked near-white Brand makes focus rings unresolvable.
elements.lockRole.dispatch('click'); // unlock
elements.hexInput.value = '#FFFFFF';
elements.hexInput.dispatch('change');
elements.lockRole.dispatch('click'); // lock white
const tokensBeforeFailure = elements.websiteTokens.innerHTML;
elements.generateSystem.dispatch('click');
assert.match(elements.generationResult.innerHTML, /NEEDS ATTENTION/, 'Locked white Brand did not produce NEEDS ATTENTION');
assert.match(elements.generationResult.innerHTML, /current system was not changed/i,
  'Failed generation does not explain that the current system was kept');
assert.match(elements.generationResult.innerHTML, /Dismiss report/, 'Failed generation has no dismiss action');
assert.doesNotMatch(elements.generationResult.innerHTML, /Apply system|Reroll|Cancel/, 'Failed generation exposes proposal confirmation actions');
assert.equal(elements.hexInput.value, '#FFFFFF', 'NEEDS ATTENTION changed the active system');
assert.equal(elements.websiteTokens.innerHTML, tokensBeforeFailure, 'NEEDS ATTENTION replaced the active website tokens');
documentListeners.click({ target: { closest: selector => selector === '#dismissGenerationIssue' ? {} : null } });
assert.doesNotMatch(elements.generationResult.innerHTML, /Dismiss report/, 'Dismiss did not clear the failed generation report');

console.log('quick-start: direct apply, repeat generation, Undo, locks, and failed-generation isolation passed');
