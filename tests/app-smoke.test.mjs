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
const storageStore = new Map();
sandbox.localStorage = {
  getItem: key => (storageStore.has(key) ? storageStore.get(key) : null),
  setItem: (key, value) => { storageStore.set(key, String(value)); },
  removeItem: key => { storageStore.delete(key); },
};

const context = vm.createContext(sandbox);
for (const file of ['../js/color-engine.js', '../js/i18n.js', '../js/role-model.js', '../js/token-contract.js', '../js/system-generator.js', '../js/project-state.js', '../js/app.js']) {
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
assert.match(elements.pairList.innerHTML, /fit-work-summary/);
assert.match(elements.pairList.innerHTML, /Needs optimization/);
assert.match(elements.pairList.innerHTML, /pair needs-work/);
assert.match(elements.pairList.innerHTML, /Role on Background: 3\.21:1, needs 4\.5:1/);
assert.match(elements.pairList.innerHTML, /Adjust in Colors/);
assert.match(elements.pairList.innerHTML, /#D8664A on Background/);
assert.match(elements.pairList.innerHTML, /Recommended foreground #111111 on this color/);
assert.doesNotMatch(elements.pairList.innerHTML, /Fixed Text on role/);
const needsWorkBeforeOptimize = (elements.pairList.innerHTML.match(/pair needs-work/g) || []).length;
elements.optimizeSemantics.dispatch('click');
const needsWorkAfterOptimize = (elements.pairList.innerHTML.match(/pair needs-work/g) || []).length;
assert.ok(needsWorkAfterOptimize < needsWorkBeforeOptimize, 'One-click semantic optimization did not reduce failing roles');
assert.match(elements.toast.textContent, /semantic roles optimized/);
assert.match(elements.pairList.innerHTML, /data-edit-role="brand"/);
assert.doesNotMatch(elements.pairList.innerHTML, /data-copy=/, 'Fit report still behaves like a copy surface');
documentListeners.click({
  target: { closest: selector => selector === '[data-edit-role]' ? { dataset: { editRole: 'brand' } } : null },
});
assert.equal(elements['step-candidates'].scrollCount, 1, 'Fit report did not navigate to Colors');
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
assert.match(elements.pairList.innerHTML, /需要优化/);
languageButtons[0].dispatch('click');
assert.equal(document.documentElement.lang, 'en');
assert.match(elements.lightPreviewContent.innerHTML, /Publish update/);

assert.equal(elements.savedPairCount.textContent, '1');
assert.match(elements.savedPairs.innerHTML, /Brand 50 → Brand 600/);
assert.match(elements.savedPairs.innerHTML, /#F0EEED → #B7523A/);
assert.match(elements.savedPairs.innerHTML, /saved-pair-fields/);
assert.match(elements.savedPairs.innerHTML, /Static/);
assert.match(elements.savedPairs.innerHTML, /saved-pair-remove/);
assert.match(elements.savedPairs.innerHTML, /data-pair-field="foregroundRoleId"/);
assert.match(elements.savedPairs.innerHTML, /data-pair-field="backgroundRoleId"/);
assert.match(elements.savedPairs.innerHTML, /data-pair-field="foregroundStep"/);
elements.addPair.dispatch('click');
assert.equal(elements.savedPairCount.textContent, '2');

const pairUsageTarget = {
  value: 'interactive',
  dataset: { pairField: 'usage', pairKey: 'pair-1' },
  closest: selector => selector === '[data-pair-field]' ? pairUsageTarget : null,
};
documentListeners.change({ target: pairUsageTarget });
assert.match(elements.savedPairs.innerHTML, /Interactive/);
assert.match(elements.savedPairs.innerHTML, /Hover/);
assert.match(elements.savedPairs.innerHTML, /Pressed/);
assert.match(elements.savedPairs.innerHTML, /Focus/);

const pairBackgroundTarget = {
  value: '700',
  dataset: { pairField: 'backgroundStep', pairKey: 'pair-1' },
  closest: selector => selector === '[data-pair-field]' ? pairBackgroundTarget : null,
};
documentListeners.change({ target: pairBackgroundTarget });
assert.match(elements.savedPairs.innerHTML, /Brand 50 → Brand 700/);
assert.match(elements.savedPairs.innerHTML, /#F0EEED → #96412C/);

documentListeners.click({
  target: { closest: selector => selector === '[data-remove-pair]' ? { dataset: { removePair: 'pair-2' } } : null },
});
assert.equal(elements.savedPairCount.textContent, '1');

// A pair must be able to span two roles; a single-role model cannot express
// Brand text on a Neutral surface, which is the most common real combination.
const crossRolePair = {
  value: 'neutral',
  dataset: { pairField: 'backgroundRoleId', pairKey: 'pair-1' },
  closest: selector => selector === '[data-pair-field]' ? crossRolePair : null,
};
documentListeners.change({ target: crossRolePair });
assert.match(elements.savedPairs.innerHTML, /Brand 50 → Neutral 700/, 'A pair could not span two roles');
// The foreground stays Brand 50 while the background leaves the Brand palette.
assert.match(elements.savedPairs.innerHTML, /#F0EEED → #(?!96412C)/, 'Background did not follow the new role');

elements.copyJson.dispatch('click');
const crossRoleJson = JSON.parse(copiedText);
assert.equal(crossRoleJson.pairs[0].foregroundRoleId, 'brand');
assert.equal(crossRoleJson.pairs[0].backgroundRoleId, 'neutral');
// Hover and Pressed must come from the background role's scale, not the foreground's.
const neutralSteps = Object.values(crossRoleJson.palettes.neutral);
assert.ok(neutralSteps.includes(crossRoleJson.pairs[0].states.hover.background),
  'Hover did not follow the background role scale');
assert.ok(neutralSteps.includes(crossRoleJson.pairs[0].states.pressed.background),
  'Pressed did not follow the background role scale');

const restoreBackgroundRole = {
  value: 'brand',
  dataset: { pairField: 'backgroundRoleId', pairKey: 'pair-1' },
  closest: selector => selector === '[data-pair-field]' ? restoreBackgroundRole : null,
};
documentListeners.change({ target: restoreBackgroundRole });
assert.match(elements.savedPairs.innerHTML, /Brand 50 → Brand 700/);

elements.copyJson.dispatch('click');
const exportedJson = JSON.parse(copiedText);
assert.equal(exportedJson.roles.regular.aliasOf, 'neutral');
assert.equal('secondary' in exportedJson.palettes, false);
assert.equal(exportedJson.assignments.regular.aliasOf, 'neutral');
assert.equal(exportedJson.pairs.length, 1);
assert.equal('key' in exportedJson.pairs[0], false);
assert.equal('backgroundSnapshot' in exportedJson.pairs[0], false);
assert.equal('foregroundSnapshot' in exportedJson.pairs[0], false);
assert.equal(exportedJson.pairs[0].foregroundRoleId, 'brand');
assert.equal(exportedJson.pairs[0].backgroundRoleId, 'brand');
assert.equal(exportedJson.pairs[0].foregroundStep, 50);
assert.equal(exportedJson.pairs[0].backgroundStep, 700);
assert.equal(exportedJson.pairs[0].usage, 'interactive');
assert.ok(exportedJson.pairs[0].states.default.background);
assert.ok(exportedJson.pairs[0].states.hover.background);
assert.ok(exportedJson.pairs[0].states.pressed.background);
assert.ok(exportedJson.pairs[0].focusRing.hex);
elements.copyCss.dispatch('click');
assert.doesNotMatch(copiedText, /--color-secondary-/);
assert.match(copiedText, /--color-regular-light-subtle: var\(--color-neutral-light-subtle\)/);
assert.match(copiedText, /--pair-brand-1-foreground: #F0EEED/);
assert.match(copiedText, /--pair-brand-1-background-hover:/);
assert.match(copiedText, /--pair-brand-1-background-pressed:/);
assert.match(copiedText, /--pair-brand-1-focus-ring:/);

// An on-bold foreground is measured black or white, not a palette step, so the pair
// model has to hold a foreground that no token can express.
const autoForegroundTarget = {
  value: 'auto',
  dataset: { pairField: 'foregroundStep', pairKey: 'pair-1' },
  closest: selector => selector === '[data-pair-field]' ? autoForegroundTarget : null,
};
documentListeners.change({ target: autoForegroundTarget });
assert.match(elements.savedPairs.innerHTML, /Auto · measured ink → Brand 700/);
assert.match(elements.savedPairs.innerHTML, /data-pair-field="foregroundRoleId"[^>]*disabled/,
  'Foreground role stayed editable while the foreground was measured');
elements.copyJson.dispatch('click');
const autoJson = JSON.parse(copiedText);
assert.equal(autoJson.pairs[0].foregroundStep, 'auto');
assert.equal(autoJson.pairs[0].foreground, '#FFFFFF');
assert.ok(autoJson.pairs[0].states.default.passesTarget,
  'A measured foreground should reach the target against its own background');
// The measured ink is fixed at Default so a button cannot flip ink between states.
assert.equal(autoJson.pairs[0].states.hover.foreground, autoJson.pairs[0].states.default.foreground);

// The starter set is the point of the whole workflow: one action from a seed to the
// combinations a screen actually needs.
const beforeGenerate = Number(elements.savedPairCount.textContent);
elements.generateStarterSet.dispatch('click');
const afterGenerate = Number(elements.savedPairCount.textContent);
assert.equal(afterGenerate - beforeGenerate, 10, 'Starter set did not produce ten rows with Secondary disabled');
for (const name of ['Body text', 'Muted text', 'Link', 'Primary action', 'Neutral action',
  'Destructive action', 'Success notice', 'Warning notice', 'Danger notice', 'Information notice']) {
  assert.match(elements.savedPairs.innerHTML, new RegExp(name), `Starter set is missing ${name}`);
}
assert.doesNotMatch(elements.savedPairs.innerHTML, /Secondary/, 'A disabled role was fabricated into the set');

// Secondary is an accent, not a second filled action. Enabling it must not add a
// saturated control that competes with the primary action.
elements.secondaryStrategy.value = 'analogous';
elements.secondaryStrategy.dispatch('change');
elements.generateStarterSet.dispatch('click');
assert.match(elements.savedPairs.innerHTML, /Secondary accent/, 'Enabling Secondary produced no accent pair');
elements.copyJson.dispatch('click');
const withSecondary = JSON.parse(copiedText);
const accent = withSecondary.pairs.find(pair => pair.slug === 'secondary-accent');
assert.ok(accent, 'Secondary lost its accent pair');
assert.equal(accent.backgroundRoleId, 'neutral', 'Secondary accent should sit on the Neutral surface');
assert.equal(accent.usage, 'static', 'Secondary accent must not be an interactive filled control');
assert.notEqual(accent.foregroundStep, 'auto', 'Secondary accent must not use an on-bold fill');
assert.equal(withSecondary.pairs.filter(pair => pair.slug === 'secondary-action').length, 0,
  'The filled Secondary action row returned');
elements.secondaryStrategy.value = 'none';
elements.secondaryStrategy.dispatch('change');

// Generating again must not duplicate rows the user already has.
elements.generateStarterSet.dispatch('click');
assert.equal(Number(elements.savedPairCount.textContent), afterGenerate, 'Regenerating duplicated starter pairs');

elements.copyJson.dispatch('click');
const starterJson = JSON.parse(copiedText);
const bodyText = starterJson.pairs.find(pair => pair.slug === 'body-text');
const primary = starterJson.pairs.find(pair => pair.slug === 'primary-action');
const link = starterJson.pairs.find(pair => pair.slug === 'link');
assert.ok(bodyText && primary && link, 'Starter pairs lost their product-intent slugs');
assert.equal(primary.foregroundStep, 'auto', 'Primary action did not use a measured on-bold foreground');
assert.equal(primary.usage, 'interactive');
assert.equal(bodyText.usage, 'static');
// Body text maximizes contrast; Link keeps Brand character by taking the least that passes.
assert.ok(bodyText.ratio > link.ratio, 'Body text should outrank Link in contrast');
assert.equal(link.backgroundRoleId, 'neutral', 'Link should sit on the Neutral surface, not its own');
assert.equal(link.foregroundRoleId, 'brand');
for (const pair of starterJson.pairs.filter(item => item.slug)) {
  assert.ok(pair.ratio >= starterJson.advancedPairTarget, `${pair.slug} did not reach the active target`);
}

elements.copyCss.dispatch('click');
assert.match(copiedText, /--pair-body-text-foreground:/, 'Starter pairs did not export under their product intent');
assert.match(copiedText, /--pair-primary-action-background-hover:/);
assert.match(copiedText, /--pair-brand-1-foreground:/, 'Unnamed pairs lost their role-indexed names');

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

// Every pair stays individually removable, generated ones included.
for (const key of [...elements.savedPairs.innerHTML.matchAll(/data-remove-pair="([^"]+)"/g)].map(match => match[1])) {
  documentListeners.click({
    target: { closest: selector => selector === '[data-remove-pair]' ? { dataset: { removePair: key } } : null },
  });
}
assert.equal(elements.savedPairCount.textContent, '0');
assert.match(elements.savedPairs.innerHTML, /No pairs configured/);

// --- Quick start: one-click website system (session already touched above) -------

elements.characterSelect.value = 'balanced';
elements.brandSourceSelect.value = 'generated';
elements.quickSecondaryStrategy.value = 'none';

// Because the session above edited state, generation must stay a proposal
// until explicitly applied — never silently replace an edited system.
elements.generateSystem.dispatch('click');
assert.ok(context.window.SystemGenerator, 'SystemGenerator is not loaded');
assert.match(elements.generationResult.innerHTML, /Apply system/, 'Generation did not stay a proposal on a touched session');
assert.match(elements.generationResult.innerHTML, /Reroll/);
assert.match(elements.generationResult.innerHTML, /Cancel/);

documentListeners.click({ target: { closest: selector => selector === '#rerollProposal' ? {} : null } });
assert.match(elements.generationResult.innerHTML, /Apply system/, 'Reroll did not replace the proposal');
documentListeners.click({ target: { closest: selector => selector === '#cancelProposal' ? {} : null } });
assert.doesNotMatch(elements.generationResult.innerHTML, /Apply system/, 'Cancel did not clear the proposal');
// Nothing was applied in this touched session yet, so the result area returns
// to the empty prompt instead of an applied-state display.
assert.match(elements.generationResult.innerHTML, /token contract/, 'Cancel did not return to the empty prompt');

// Regenerate and Apply explicitly.
elements.generateSystem.dispatch('click');
documentListeners.click({ target: { closest: selector => selector === '#applyProposal' ? {} : null } });
assert.doesNotMatch(elements.generationResult.innerHTML, /Apply system/, 'Apply did not replace the proposal with the applied state');
assert.match(elements.generationResult.innerHTML, /Undo apply/, 'Applied system shows no Undo');
assert.ok(elements.websiteTokens.innerHTML.includes('--surface-page'), 'Website tokens did not render in Step 03');
assert.ok(elements.websiteTokens.innerHTML.includes('--action-primary-background'), 'Website token contract is incomplete');
assert.match(elements.contextSourceNote.textContent, /Provided|Generated/, 'Context source note is missing after generation');

// Undo restores the previous state — in this touched session nothing was
// applied before, so the result area returns to the empty prompt.
documentListeners.click({ target: { closest: selector => selector === '#undoApply' ? {} : null } });
assert.doesNotMatch(elements.generationResult.innerHTML, /Apply system/, 'Undo did not clear the applied state');
assert.match(elements.generationResult.innerHTML, /token contract/, 'Undo did not return to the empty prompt');

// Provided Brand HEX stays exact after Apply.
documentListeners.click({ target: { closest: selector => selector === '[data-select-role]' ? { dataset: { selectRole: 'brand' } } : null } });
elements.brandSourceSelect.value = 'hex';
elements.quickBrandHex.value = '#B7523A';
elements.generateSystem.dispatch('click');
documentListeners.click({ target: { closest: selector => selector === '#applyProposal' ? {} : null } });
assert.equal(elements.hexInput.value, '#B7523A', 'Provided HEX was not applied to the active Brand');

// Invalid HEX is rejected without changing the active system.
const seedBeforeInvalid = elements.hexInput.value;
elements.quickBrandHex.value = 'not-a-color';
elements.generateSystem.dispatch('click');
assert.equal(elements.quickBrandHex.attributes['aria-invalid'], 'true', 'Invalid HEX was not flagged');
assert.equal(elements.hexInput.value, seedBeforeInvalid, 'Invalid HEX changed the active system');

// --- Phase 6: persistence and import round trip ---------------------------------

// Save writes the current project; New clears it and resets the active system.
elements.coverageProfileSelect.value = 'portfolio';
elements.coverageProfileSelect.dispatch('change');
assert.ok(elements.websiteTokens.innerHTML.includes('--surface-project-card'), 'Portfolio profile did not resolve before Save');
elements.copyJson.dispatch('click');
const savedJson = copiedText;
elements.saveProject.dispatch('click');
assert.ok(storageStore.has('design-system-starter.project.v2'), 'Save did not write to local storage');
const savedBrand = elements.hexInput.value;
elements.newProject.dispatch('click');
assert.notEqual(elements.hexInput.value, savedBrand, 'New project did not reset the active Brand');
assert.equal(elements.coverageProfileSelect.value, '', 'New project did not reset website coverage');

// Export -> Import round trip preserves the visible system and pairs.
storageStore.clear();
storageStore.set('design-system-starter.project.v2', savedJson);
const roundTrip = JSON.parse(savedJson);
assert.equal(roundTrip.schemaVersion, 2, 'v2 JSON lost its schema version');
assert.equal('palettes' in roundTrip, true, 'v2 JSON lost the palettes section');
assert.equal('assignments' in roundTrip, true, 'v2 JSON lost the assignments section');
const pairCountBeforeImport = Number(elements.savedPairCount.textContent);
elements.importFile.dispatch('change', {
  target: { files: [{ text: async () => savedJson }] },
});
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(elements.hexInput.value, savedBrand, 'Import did not restore the saved Brand');
assert.equal(elements.coverageProfileSelect.value, 'portfolio', 'Import did not restore website coverage');
assert.ok(elements.websiteTokens.innerHTML.includes('--surface-project-card'), 'Import lost Portfolio tokens');
assert.ok(elements.lightPreviewContent.innerHTML.includes('profile-portfolio'), 'Import lost the Portfolio Preview module');
assert.equal(Number(elements.savedPairCount.textContent), roundTrip.pairs.length,
  'Import changed the saved pair count');
assert.match(elements.toast.textContent, /Project imported/, 'Import did not report success');

// An unknown additive profile fails before any imported state is applied.
const unknownProfile = { ...roundTrip, profileId: 'unknown-profile' };
const brandBeforeUnknownProfile = elements.hexInput.value;
elements.importFile.dispatch('change', {
  target: { files: [{ text: async () => JSON.stringify(unknownProfile) }] },
});
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(elements.hexInput.value, brandBeforeUnknownProfile, 'Unknown profile import changed the active Brand');
assert.equal(elements.coverageProfileSelect.value, 'portfolio', 'Unknown profile import changed website coverage');
assert.match(elements.toast.textContent, /Import failed/, 'Unknown profile import did not report a visible failure');

// An invalid import fails visibly without mutating the active project.
const activeBeforeInvalid = elements.hexInput.value;
elements.importFile.dispatch('change', {
  target: { files: [{ text: async () => '{ not json' }] },
});
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(elements.hexInput.value, activeBeforeInvalid, 'Invalid import changed the active project');
assert.match(elements.toast.textContent, /Import failed/, 'Invalid import did not report a visible failure');

console.log('app-smoke: startup and core role interactions passed');
