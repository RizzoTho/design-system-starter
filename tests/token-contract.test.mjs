import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/token-contract.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
for (const file of ['../js/color-engine.js', '../js/role-model.js', '../js/token-contract.js', '../js/system-generator.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), sandbox, { filename: file });
}
const contract = sandbox.window.WebsiteTokenContract;
const generated = sandbox.window.SystemGenerator.generateSystem({
  currentState: {},
  options: { characterId: 'balanced', brandSource: 'generated', secondaryStrategy: 'none', randomSeed: 42 },
});
const proposal = generated.proposal;
const palettes = Object.fromEntries(Object.entries(proposal.palettes).map(([roleId, palette]) => [roleId, { scale: palette.scale }]));
const roles = proposal.roles;
const assignments = proposal.assignments;

// The built-in contract must validate cleanly.
{
  const result = contract.validateContract(contract.contract);
  assert.deepEqual([...result.errors], [], `Built-in contract is invalid: ${result.errors.join('; ')}`);
  assert.equal(result.ok, true);
}

// Token ids and css names are unique across the whole contract.
{
  const ids = contract.allTokens().map(token => token.id);
  assert.equal(new Set(ids).size, ids.length, 'Token ids are duplicated');
  const css = contract.allTokens().map(token => token.css);
  assert.equal(new Set(css).size, css.length, 'CSS names are duplicated');
}

// Every group is declared and every token belongs to exactly one group.
{
  const groupCount = Object.values(contract.tokenGroups).flat().length;
  assert.equal(groupCount, contract.allTokens().length, 'A token belongs to more than one group or none');
}

// Every required token has at least one relationship check.
{
  const covered = new Set();
  for (const relationship of contract.relationships) {
    for (const tokenId of relationship.tokens) covered.add(tokenId);
  }
  const allIds = new Set(contract.allTokens().map(token => token.id));
  const requiredGroupIds = new Set(
    contract.requiredGroups.flatMap(group => contract.tokenGroups[group].map(token => token.id))
  );
  const uncovered = [...requiredGroupIds].filter(id => !covered.has(id));
  assert.deepEqual([...uncovered], [], `Required tokens with no relationship check: ${uncovered.join(', ')}`);
}

// Feedback families expand for all four semantic roles and stay in the required set.
{
  assert.deepEqual([...contract.feedbackRoles], ['success', 'warning', 'danger', 'information']);
  for (const role of contract.feedbackRoles) {
    for (const kind of ['surface', 'border', 'icon', 'text', 'bold', 'onBold']) {
      assert.ok(contract.tokenById(`feedback.${role}.${kind}`), `Missing feedback.${role}.${kind}`);
    }
  }
}

// Target profiles: aa-interface is the default and ordering is text > large >= non-text.
{
  assert.ok(contract.targetProfiles['aa-interface'], 'aa-interface profile is missing');
  assert.ok(contract.targetProfiles['aaa-interface'], 'aaa-interface profile is missing');
  for (const [id, profile] of Object.entries(contract.targetProfiles)) {
    assert.ok(profile.normalText > profile.largeText, `${id}: normal text must exceed large text`);
    assert.ok(profile.largeText >= profile.nonText, `${id}: large text must not drop below non-text`);
    assert.ok(profile.nonText >= 3, `${id}: non-text never drops below 3:1`);
  }
}

// The validator rejects a missing token definition (a relationship referencing a
// token that does not exist).
{
  const bad = structuredClone(contract.contract);
  bad.relationships[0].tokens.push('content.doesNotExist');
  const result = contract.validateContract(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('doesNotExist')), 'Unknown token was not rejected');
}

// The validator rejects duplicate token names.
{
  const bad = structuredClone(contract.contract);
  bad.tokenGroups.surfaces.push({ id: 'surface.raised', css: '--surface-raised' });
  const result = contract.validateContract(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('duplicate')), 'Duplicate token was not rejected');
}

// The validator rejects an invalid css name.
{
  const bad = structuredClone(contract.contract);
  bad.tokenGroups.surfaces.push({ id: 'surface.bad', css: 'surface-bad' });
  const result = contract.validateContract(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('invalid css name')), 'Invalid css name was not rejected');
}

// The validator rejects invalid thresholds (too low or mis-ordered).
{
  const bad = structuredClone(contract.contract);
  bad.targetProfiles['aa-interface'].normalText = 1.2;
  assert.equal(contract.validateContract(bad).ok, false, 'Below-minimum threshold was accepted');

  const misordered = structuredClone(contract.contract);
  misordered.targetProfiles['aa-interface'] = { normalText: 3, largeText: 4.5, nonText: 3 };
  assert.equal(contract.validateContract(misordered).ok, false, 'Mis-ordered thresholds were accepted');
}

// The validator rejects a relationship with an invalid target or severity.
{
  const bad = structuredClone(contract.contract);
  bad.relationships[0].target = 'borderIcon';
  assert.equal(contract.validateContract(bad).ok, false, 'Unknown target was accepted');

  const badSeverity = structuredClone(contract.contract);
  badSeverity.relationships[0].severity = 'warning';
  assert.equal(contract.validateContract(badSeverity).ok, false, 'Unknown severity was accepted');
}

// The validator rejects an uncovered required token (a new required token added
// without a relationship).
{
  const bad = structuredClone(contract.contract);
  bad.tokenGroups.surfaces.push({ id: 'surface.extra', css: '--surface-extra' });
  const result = contract.validateContract(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('has no relationship check')), 'Uncovered required token was accepted');
}

// --- Phase 7: product-specific coverage profiles ---------------------------------

// The dashboard profile validates as a complete coverage contract.
{
  const result = contract.validateProfile('dashboard');
  assert.deepEqual([...result.errors], [], `Dashboard profile is invalid: ${result.errors.join('; ')}`);
  assert.equal(result.ok, true);
  assert.equal(contract.validateProfile('unknown-profile').ok, false, 'Unknown profile was accepted');
}

// Profile tokens are additive and only resolve when the profile is requested.
{
  const resolution = contract.resolveWebsiteTokens({
    palettes,
    roles,
    assignments,
    targetProfileId: 'aa-interface',
    profileId: 'dashboard',
  });
  assert.equal(resolution.profileId, 'dashboard');
  for (const theme of ['light', 'dark']) {
    const values = resolution[theme].values;
    for (const tokenId of ['surface.sidebar', 'surface.tableStripe', 'content.tabular', 'border.table', 'chart.series.1', 'chart.series.2', 'chart.series.3', 'chart.series.4']) {
      assert.ok(values[tokenId], `${theme} is missing profile token ${tokenId}`);
    }
  }
  const plain = contract.resolveWebsiteTokens({ palettes, roles, assignments });
  assert.equal(plain.profileId, null);
  assert.equal(plain.light.values['surface.sidebar'], undefined, 'Profile token leaked without a profile');
}

// Required profile relationships pass in Light and Dark; decoration is advisory.
{
  const resolution = contract.resolveWebsiteTokens({
    palettes, roles, assignments, targetProfileId: 'aa-interface', profileId: 'dashboard',
  });
  const summary = contract.summarize(resolution);
  assert.equal(summary.requiredFailures.length, 0, 'Dashboard required relationships failed');
  for (const check of summary.relationships.filter(item => item.relationshipId === 'SIDEBAR_TEXT_ON_SIDEBAR')) {
    assert.equal(check.pass, true, `Sidebar text failed ${check.theme}`);
    assert.equal(check.required, 4.5, 'Sidebar text must use the text target');
  }
  for (const check of summary.relationships.filter(item => item.relationshipId === 'TABULAR_TEXT_ON_SURFACE')) {
    assert.equal(check.pass, true, `Tabular text failed ${check.theme}`);
  }
  for (const check of summary.relationships.filter(item => item.relationshipId === 'DASHBOARD_DECORATION')) {
    assert.equal(check.pass, 'advisory', 'Dashboard decoration must stay advisory');
  }
}

// The profile export remains backward-compatible: generic tokens unchanged plus
// additive profile tokens in the same website layer.
{
  const resolution = contract.resolveWebsiteTokens({
    palettes, roles, assignments, targetProfileId: 'aa-interface', profileId: 'dashboard',
  });
  const css = contract.serializeCss({
    palettes,
    assignments,
    websiteTokens: { light: { values: resolution.light.values }, dark: { values: resolution.dark.values } },
  });
  assert.match(css, /--surface-page: var\(--role-neutral-light-subtle\)/, 'Generic website token changed');
  assert.match(css, /--surface-sidebar: var\(--palette-neutral-800\)/, 'Dashboard sidebar lost its reference alias');
  assert.match(css, /--chart-series-1: /, 'Dashboard chart series missing from export');
  const tailwind = contract.serializeTailwind({ light: { values: resolution.light.values }, dark: { values: resolution.dark.values } });
  assert.match(tailwind, /'surface-sidebar': 'var\(--surface-sidebar\)'/, 'Tailwind adapter lost the profile token');
}

console.log('token-contract: definitions, thresholds, and coverage checks passed');
