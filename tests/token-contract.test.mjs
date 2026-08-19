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

// --- Website coverage profiles were removed ------------------------------------

// The contract is generic only. Nothing may reintroduce a per-product token set
// through a side door.
{
  for (const name of ['PROFILE_EXTENSIONS', 'validateProfile', 'profileTokens', 'profileTokenGroups', 'resolveProfileTheme']) {
    assert.equal(contract[name], undefined, `Retired coverage-profile API ${name} is still exported`);
  }
  const resolution = contract.resolveWebsiteTokens({ palettes, roles, assignments });
  assert.equal(resolution.profileId, undefined, 'Resolution still carries a coverage profile');
  assert.equal(resolution.targetProfileId, 'aa-interface');
}

// The page surface is the Context Background, not a palette step that resembles
// it. Dark has no user-provided Context, so it stays Neutral-derived.
{
  const context = { background: '#FBF9F4', text: '#111111' };
  const resolution = contract.resolveWebsiteTokens({ palettes, roles, assignments, context });
  const page = resolution.light.values['surface.page'];
  assert.equal(page.hex, '#FBF9F4', 'The page surface is not the Context Background');
  assert.equal(page.sourceKind, 'context-color');
  assert.equal(page.sourceRole, 'context');
  assert.equal(resolution.dark.values['surface.page'].sourceKind, 'palette-token', 'Dark invented a Context page');

  // Text on the page is re-measured against that surface, never against the
  // palette step the page used to be.
  for (const tokenId of ['content.primary', 'content.secondary', 'content.muted']) {
    const ratio = sandbox.window.ColorEngine.contrast(resolution.light.values[tokenId].hex, page.hex);
    assert.ok(ratio >= 4.5, `${tokenId} measures ${ratio.toFixed(2)}:1 on the Context page`);
  }

  // A raised surface that is not lighter than the page collapses onto the page
  // rather than claiming an elevation it does not have.
  const white = contract.resolveWebsiteTokens({ palettes, roles, assignments, context: { background: '#FFFFFF', text: '#111111' } });
  assert.equal(white.light.values['surface.raised'].hex, '#FFFFFF', 'Raised stayed darker than a white page');
  assert.ok(sandbox.window.ColorEngine.contrast(white.light.values['surface.sunken'].hex, '#000000')
    < sandbox.window.ColorEngine.contrast('#FFFFFF', '#000000'), 'Sunken is not deeper than the page');

  // A malformed Context Background falls back visibly instead of silently.
  const broken = contract.resolveWebsiteTokens({ palettes, roles, assignments, context: { background: 'not-a-color', text: '#111111' } });
  assert.equal(broken.light.values['surface.page'].sourceKind, 'palette-token');
  assert.ok(broken.light.diagnostics.some(item => item.code === 'CONTEXT_BACKGROUND_INVALID'),
    'Invalid Context Background produced no diagnostic');
}

// Every token in the contract exports under its explicit CSS name in both
// adapters; no camelCase fallback is derived from the token id.
{
  const resolution = contract.resolveWebsiteTokens({ palettes, roles, assignments });
  const css = contract.serializeCss({ palettes, assignments, websiteTokens: resolution });
  const tailwind = contract.serializeTailwind(resolution);
  assert.match(css, /--surface-raised: var\(--palette-neutral-50\)/, 'The raised surface lost its palette alias');
  for (const token of contract.allTokens()) {
    if (!resolution.light.values[token.id]) continue;
    assert.ok(css.includes(`${token.css}: `), `CSS export lost ${token.css}`);
    assert.ok(tailwind.includes(`'${token.id.replace(/\./g, '-')}': 'var(${token.css})'`), `Tailwind export lost ${token.css}`);
  }
}

// A deterministic 100-seed matrix proves the complete generator, not only a
// hand-picked resolution, keeps every required relationship valid.
{
  const characters = Object.keys(sandbox.window.SystemGenerator.CHARACTERS);
  for (let randomSeed = 1; randomSeed <= 100; randomSeed += 1) {
    const result = sandbox.window.SystemGenerator.generateSystem({
      currentState: {},
      options: {
        characterId: characters[(randomSeed - 1) % characters.length],
        brandSource: 'generated',
        secondaryStrategy: randomSeed % 3 === 0 ? 'analogous' : 'none',
        randomSeed,
      },
    });
    assert.equal(result.error, undefined, `seed ${randomSeed} returned ${result.error?.code}`);
    assert.equal(result.validation.requiredFailures.length, 0,
      `seed ${randomSeed} has required failures: ${result.validation.requiredFailures.map(item => item.relationshipId).join(', ')}`);
  }
}

console.log('token-contract: definitions, generic-only exports, and 100 generated systems passed');
