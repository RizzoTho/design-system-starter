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

const profileIds = ['dashboard', 'marketing', 'portfolio', 'documentation'];

// Every profile is a complete additive contract; unknown profiles fail fast.
{
  for (const profileId of profileIds) {
    const result = contract.validateProfile(profileId);
    assert.deepEqual([...result.errors], [], `${profileId} profile is invalid: ${result.errors.join('; ')}`);
    assert.equal(result.ok, true);
  }
  assert.equal(contract.validateProfile('unknown-profile').ok, false, 'Unknown profile was accepted by the validator');
  assert.throws(
    () => contract.resolveWebsiteTokens({ palettes, roles, assignments, profileId: 'unknown-profile' }),
    /Unknown website coverage profile/,
    'Unknown profile was silently projected as the generic contract'
  );
}

// Profile tokens resolve only when requested, preserve traceability, and pass
// every required Light / Dark relationship under both target profiles.
{
  const plain = contract.resolveWebsiteTokens({ palettes, roles, assignments });
  assert.equal(plain.profileId, null);
  for (const profileId of profileIds) {
    for (const token of contract.profileTokens(profileId)) {
      assert.equal(plain.light.values[token.id], undefined, `${profileId} token ${token.id} leaked into the generic contract`);
    }
    for (const targetProfileId of ['aa-interface', 'aaa-interface']) {
      const resolution = contract.resolveWebsiteTokens({
        palettes,
        roles,
        assignments,
        targetProfileId,
        profileId,
      });
      assert.equal(resolution.profileId, profileId);
      for (const theme of ['light', 'dark']) {
        const values = resolution[theme].values;
        for (const token of contract.profileTokens(profileId)) {
          const value = values[token.id];
          assert.ok(value, `${profileId} ${theme} is missing ${token.id}`);
          assert.match(value.hex, /^#[0-9A-F]{6}$/, `${profileId} ${theme} ${token.id} has invalid HEX`);
          assert.ok(value.sourceRole, `${profileId} ${theme} ${token.id} lost sourceRole`);
          assert.ok(['palette-token', 'measured-ink'].includes(value.sourceKind), `${profileId} ${theme} ${token.id} lost sourceKind`);
          assert.ok(value.generatedBy, `${profileId} ${theme} ${token.id} lost generatedBy`);
        }
      }
      const summary = contract.summarize(resolution);
      const profileRelationshipIds = new Set(contract.PROFILE_EXTENSIONS[profileId].relationships.map(item => item.id));
      const profileFailures = summary.requiredFailures.filter(item => profileRelationshipIds.has(item.relationshipId));
      assert.equal(profileFailures.length, 0,
        `${profileId} ${targetProfileId} has profile failures: ${profileFailures.map(item => `${item.theme}/${item.relationshipId}/${item.actual.toFixed(2)}`).join(', ')}`);
    }
  }
}

// Advisory profile relationships remain measurements, never fake PASS results.
{
  const expectedAdvisory = {
    dashboard: 'DASHBOARD_DECORATION',
    marketing: 'MARKETING_DECORATION',
    portfolio: 'PORTFOLIO_DECORATION',
  };
  for (const [profileId, relationshipId] of Object.entries(expectedAdvisory)) {
    const resolution = contract.resolveWebsiteTokens({ palettes, roles, assignments, profileId });
    const checks = contract.summarize(resolution).relationships.filter(item => item.relationshipId === relationshipId);
    assert.ok(checks.length > 0, `${profileId} advisory relationship produced no measurements`);
    for (const check of checks) assert.equal(check.pass, 'advisory', `${profileId} advisory measurement was labeled PASS`);
  }
}

// Export remains backward-compatible and uses every profile's explicit CSS
// name rather than deriving a camelCase fallback from the token id.
{
  for (const profileId of profileIds) {
    const resolution = contract.resolveWebsiteTokens({ palettes, roles, assignments, profileId });
    const css = contract.serializeCss({ palettes, assignments, websiteTokens: resolution });
    assert.match(css, /--surface-page: var\(--role-neutral-light-subtle\)/, `${profileId} changed a generic website token`);
    const tailwind = contract.serializeTailwind(resolution);
    for (const token of contract.profileTokens(profileId)) {
      assert.ok(css.includes(`${token.css}: `), `${profileId} CSS export lost ${token.css}`);
      const adapterName = token.id.replace(/\./g, '-');
      assert.ok(tailwind.includes(`'${adapterName}': 'var(${token.css})'`), `${profileId} Tailwind export lost ${token.css}`);
    }
  }
}

// A deterministic 100-seed matrix per profile proves the complete generator,
// not only a hand-picked resolution, keeps every required relationship valid.
{
  const characters = Object.keys(sandbox.window.SystemGenerator.CHARACTERS);
  for (const profileId of profileIds) {
    for (let randomSeed = 1; randomSeed <= 100; randomSeed += 1) {
      const result = sandbox.window.SystemGenerator.generateSystem({
        currentState: {},
        options: {
          characterId: characters[(randomSeed - 1) % characters.length],
          brandSource: 'generated',
          secondaryStrategy: randomSeed % 3 === 0 ? 'analogous' : 'none',
          randomSeed,
          profileId,
        },
      });
      assert.equal(result.error, undefined, `${profileId} seed ${randomSeed} returned ${result.error?.code}`);
      assert.equal(result.proposal.profileId, profileId, `${profileId} seed ${randomSeed} lost proposal profileId`);
      assert.equal(result.proposal.websiteTokens.profileId, profileId, `${profileId} seed ${randomSeed} lost website profileId`);
      assert.equal(result.validation.requiredFailures.length, 0,
        `${profileId} seed ${randomSeed} has required failures: ${result.validation.requiredFailures.map(item => item.relationshipId).join(', ')}`);
    }
  }
  const invalid = sandbox.window.SystemGenerator.generateSystem({
    currentState: {},
    options: { characterId: 'balanced', brandSource: 'generated', secondaryStrategy: 'none', profileId: 'unknown-profile' },
  });
  assert.equal(invalid.error.code, 'UNKNOWN_PROFILE', 'Generator accepted an unknown profile');
}

console.log('token-contract: definitions, four profiles, exports, and 400 generated profile systems passed');
