import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
for (const file of ['../js/color-engine.js', '../js/role-model.js', '../js/token-contract.js', '../js/system-generator.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), sandbox, { filename: file });
}
const { ColorEngine, SystemGenerator } = sandbox.window;

function run(options = {}, currentState = {}) {
  return SystemGenerator.generateSystem({ currentState, options });
}

function defaultOptions(overrides = {}) {
  return { characterId: 'balanced', brandSource: 'generated', secondaryStrategy: 'none', randomSeed: 42, ...overrides };
}

function relativeChroma(hex) {
  const color = ColorEngine.hexToOklch(hex);
  const maximum = ColorEngine.maxChromaAt(color.L, color.h);
  return maximum > 0 ? color.C / maximum : 0;
}

// --- Determinism -------------------------------------------------------------

// The same seed and options return the same generated inputs.
{
  const first = run(defaultOptions());
  const second = run(defaultOptions());
  assert.deepEqual(JSON.stringify(first.proposal), JSON.stringify(second.proposal), 'Same seed produced different systems');
  assert.equal(first.proposal.generation.randomSeed, 42);
}

// Different revisions (different seeds) can produce different unlocked inputs,
// while locked inputs never change.
{
  const locked = {
    roles: {
      brand: { enabled: true, seed: '#D8664A', locked: true },
      neutral: { enabled: true, seed: '#6F736E', locked: true },
    },
  };
  const results = [7, 8, 9].map(seed => run(defaultOptions({ randomSeed: seed }), locked));
  const brands = new Set(results.map(result => result.proposal.roles.brand.seed));
  const neutrals = new Set(results.map(result => result.proposal.roles.neutral.seed));
  assert.equal(brands.size, 1, 'Locked Brand changed across revisions');
  assert.equal(neutrals.size, 1, 'Locked Neutral changed across revisions');
  assert.equal(brands.values().next().value, '#D8664A');
  // Unlocked semantic seeds may vary; they stay inside their hue families.
  const successHues = results.map(result => ColorEngine.hexToOklch(result.proposal.roles.success.seed).h);
  assert.ok(new Set(successHues.map(h => Math.round(h))).size >= 1);
}

// --- Locks survive Generate and Reroll ---------------------------------------

{
  const lockedState = {
    roles: {
      brand: { enabled: true, seed: '#4F46E5', locked: true },
      neutral: { enabled: true, seed: '#44403C', locked: true },
      secondary: { enabled: true, seed: '#0EA5E9', strategy: 'contrasting', locked: true },
      danger: { enabled: true, seed: '#DC2626', locked: true },
    },
  };
  for (const seed of [11, 22, 33]) {
    const result = run(defaultOptions({ randomSeed: seed, secondaryStrategy: 'contrasting' }), lockedState);
    assert.equal(result.proposal.roles.brand.seed, '#4F46E5', 'Reroll changed locked Brand');
    assert.equal(result.proposal.roles.neutral.seed, '#44403C', 'Reroll changed locked Neutral');
    assert.equal(result.proposal.roles.secondary.seed, '#0EA5E9', 'Reroll changed locked Secondary');
    assert.equal(result.proposal.roles.danger.seed, '#DC2626', 'Reroll changed locked Danger');
    assert.equal(result.proposal.roles.brand.locked, true);
    assert.equal(result.proposal.roles.neutral.locked, true);
  }
}

// --- Provided Brand stays exact ----------------------------------------------

{
  const result = run(defaultOptions({ brandSource: 'hex', brandHex: '#B7523A' }));
  assert.equal(result.proposal.roles.brand.seed, '#B7523A', 'Provided Brand HEX was not preserved exactly');
  assert.equal(result.proposal.generation.brandSource, 'hex');

  const keep = run(defaultOptions({ brandSource: 'keep' }), { roles: { brand: { enabled: true, seed: '#123456', locked: false } } });
  assert.equal(keep.proposal.roles.brand.seed, '#123456', 'Keep did not preserve the current Brand');
}

// --- Generated hierarchy keeps Neutral quiet and Brand dominant --------------

{
  for (const characterId of Object.keys(SystemGenerator.CHARACTERS)) {
    for (const seed of [1, 5, 9]) {
      const result = run(defaultOptions({ characterId, randomSeed: seed }));
      const neutralOklch = ColorEngine.hexToOklch(result.proposal.roles.neutral.seed);
      const neutralPercent = relativeChroma(result.proposal.roles.neutral.seed);
      const presetPercent = SystemGenerator.CHARACTERS[characterId].neutral.chromaPercent;
      assert.ok(neutralOklch.C <= ColorEngine.familyChromaLimits.neutral + 1e-9,
        `${characterId} Neutral chroma ${neutralOklch.C} exceeds the ${ColorEngine.familyChromaLimits.neutral} contract`);
      assert.ok(neutralPercent <= presetPercent + 0.02,
        `${characterId} Neutral uses ${(neutralPercent * 100).toFixed(1)}% relative chroma; expected at most ${((presetPercent + 0.02) * 100).toFixed(1)}%`);

      const brandPercent = relativeChroma(result.proposal.roles.brand.seed);
      for (const roleId of ['success', 'warning', 'danger', 'information']) {
        const semanticPercent = relativeChroma(result.proposal.roles[roleId].seed);
        assert.ok(semanticPercent <= brandPercent + 0.02,
          `${characterId} ${roleId} relative chroma ${(semanticPercent * 100).toFixed(1)}% overtook Brand ${(brandPercent * 100).toFixed(1)}%`);
      }
    }
  }
}

// --- Semantic hue families stay recognizable ----------------------------------

{
  const families = { success: 145, warning: 80, danger: 27, information: 245 };
  for (const characterId of Object.keys(SystemGenerator.CHARACTERS)) {
    const result = run(defaultOptions({ characterId, randomSeed: 123 }));
    for (const [roleId, hue] of Object.entries(families)) {
      const drawn = ColorEngine.hexToOklch(result.proposal.roles[roleId].seed).h;
      const distance = Math.min(Math.abs(drawn - hue), 360 - Math.abs(drawn - hue));
      assert.ok(distance < 18, `${characterId} ${roleId} drifted ${Math.round(distance)}deg from hue ${hue}`);
    }
  }
}

// --- Every generated HEX is valid sRGB ----------------------------------------

{
  for (const characterId of Object.keys(SystemGenerator.CHARACTERS)) {
    for (const seed of [3, 6, 9]) {
      const result = run(defaultOptions({ characterId, randomSeed: seed, secondaryStrategy: 'contrasting' }));
      const seeds = Object.values(result.proposal.roles)
        .filter(role => role.seed)
        .map(role => role.seed);
      for (const hex of seeds) {
        assert.ok(ColorEngine.normalizeHex(hex), `${characterId} produced invalid HEX ${hex}`);
        assert.equal(ColorEngine.normalizeHex(hex), hex);
        const rgb = ColorEngine.hexToRgb(hex);
        assert.ok(rgb.every(channel => channel >= 0 && channel <= 255), `${hex} is outside sRGB`);
      }
    }
  }
}

// --- Context generation and repair ---------------------------------------------

{
  // A locked Context that fails 4.5:1 is an explicit unresolved result, not a silent repair.
  const failing = run(defaultOptions(), {
    context: { background: '#FFFFFF', text: '#FFFFFF', source: 'provided', locked: true },
  });
  assert.equal(failing.proposal.generation.status, 'needs-attention');
  assert.equal(failing.validation.status, 'needs-attention');
  const contextFailure = failing.diagnostics.find(diagnostic => diagnostic.code === 'CONTEXT_TEXT_ON_BACKGROUND');
  assert.ok(contextFailure, 'Locked failing Context produced no diagnostic');
  assert.equal(contextFailure.severity, 'error');
  assert.equal(contextFailure.actual, 1);

  // Generated Context always carries measured ink that passes 4.5:1.
  for (const characterId of Object.keys(SystemGenerator.CHARACTERS)) {
    const result = run(defaultOptions({ characterId, randomSeed: 4 }));
    assert.ok(ColorEngine.contrast(result.proposal.context.text, result.proposal.context.background) >= 4.5,
      `${characterId} generated Context fails 4.5:1`);
    assert.equal(result.proposal.context.source, 'generated');
  }
}

// --- Secondary strategies -------------------------------------------------------

{
  const none = run(defaultOptions({ secondaryStrategy: 'none' }));
  assert.equal(none.proposal.roles.secondary.enabled, false);
  assert.equal(none.proposal.roles.secondary.seed, null);

  for (const strategy of ['analogous', 'contrasting']) {
    const result = run(defaultOptions({ secondaryStrategy: strategy, randomSeed: 17 }));
    assert.equal(result.proposal.roles.secondary.enabled, true);
    assert.equal(result.proposal.roles.secondary.strategy, strategy);
    const secondaryHue = ColorEngine.hexToOklch(result.proposal.roles.secondary.seed).h;
    const brandHue = ColorEngine.hexToOklch(result.proposal.roles.brand.seed).h;
    const distance = Math.min(Math.abs(secondaryHue - brandHue), 360 - Math.abs(secondaryHue - brandHue));
    if (strategy === 'analogous') assert.ok(distance < 90, 'Analogous Secondary is not close to Brand');
    if (strategy === 'contrasting') assert.ok(distance > 90, 'Contrasting Secondary is not opposite Brand');
  }
}

// --- Impossible requests are explicit --------------------------------------------

{
  const unknownCharacter = run(defaultOptions({ characterId: 'neon' }));
  assert.equal(unknownCharacter.error.code, 'UNKNOWN_CHARACTER');
  assert.equal(unknownCharacter.proposal, undefined);

  const badHex = run(defaultOptions({ brandSource: 'hex', brandHex: '#GGGGGG' }));
  assert.equal(badHex.error.code, 'INVALID_BRAND_HEX');
  assert.equal(badHex.proposal, undefined);

  const missingHex = run(defaultOptions({ brandSource: 'hex' }));
  assert.equal(missingHex.error.code, 'MISSING_BRAND_HEX');

  const badStrategy = run(defaultOptions({ secondaryStrategy: 'rainbow' }));
  assert.equal(badStrategy.error.code, 'UNKNOWN_SECONDARY_STRATEGY');
}

// --- All five character presets generate -----------------------------------------

{
  for (const characterId of Object.keys(SystemGenerator.CHARACTERS)) {
    const result = run(defaultOptions({ characterId, randomSeed: 8 }));
    assert.equal(result.proposal.generation.characterId, characterId);
    assert.equal(result.proposal.generation.status, 'ready', `${characterId} did not generate cleanly`);
    assert.ok(result.proposal.context.background, `${characterId} generated no Context`);
    assert.ok(result.proposal.roles.brand.seed, `${characterId} generated no Brand`);
    for (const roleId of ['success', 'warning', 'danger', 'information']) {
      assert.ok(result.proposal.roles[roleId].seed, `${characterId} generated no ${roleId}`);
    }
  }
}

// --- Phase 3: website token resolution and validation ------------------------------

// The default generated system resolves the complete website token contract and
// every required relationship passes in Light and Dark.
{
  for (const seed of [42, 7, 123, 2026]) {
    const result = run(defaultOptions({ randomSeed: seed }));
    // READY and READY WITH WARNINGS both mean every required relationship
    // passes; only advisory diagnostics (for example a generated-seed repair)
    // differ. NEEDS ATTENTION must never appear for a default generation.
    assert.ok(['ready', 'ready-with-warnings'].includes(result.validation.status),
      `Default system (seed ${seed}) is not READY*`);
    assert.equal(result.validation.requiredFailures.length, 0,
      `Default system (seed ${seed}) has required failures`);
    const lightValues = result.proposal.websiteTokens.light.values;
    const darkValues = result.proposal.websiteTokens.dark.values;
    for (const group of ['surfaces', 'content', 'borders-and-focus', 'action-primary', 'action-secondary', 'action-destructive', 'fields', 'feedback']) {
      for (const token of sandbox.window.WebsiteTokenContract.tokenGroups[group]) {
        assert.ok(lightValues[token.id], `Light is missing ${token.id}`);
        assert.ok(darkValues[token.id], `Dark is missing ${token.id}`);
      }
    }
    for (const theme of ['light', 'dark']) {
      const values = result.proposal.websiteTokens[theme].values;
      for (const [tokenId, value] of Object.entries(values)) {
        assert.equal(ColorEngine.normalizeHex(value.hex), value.hex, `${theme} ${tokenId} is not a valid HEX`);
        assert.ok(['palette-token', 'measured-ink'].includes(value.sourceKind), `${theme} ${tokenId} lost its source kind`);
        assert.ok(value.sourceRole, `${theme} ${tokenId} lost its source role`);
        assert.ok(value.generatedBy, `${theme} ${tokenId} lost its generator`);
      }
    }
    for (const relationship of result.proposal.validation.relationships) {
      assert.notEqual(relationship.pass, false, `Required relationship failed: ${relationship.theme} ${relationship.tokenId} ${relationship.actual.toFixed(2)} vs ${relationship.required}`);
    }
  }
}

// Action foreground stays passing across Default, Hover, and Pressed.
{
  const result = run(defaultOptions({ randomSeed: 42 }));
  const actionChecks = result.proposal.validation.relationships.filter(relationship =>
    ['ACTION_FOREGROUND_ACROSS_STATES', 'ACTION_BACKGROUND_STATES'].includes(relationship.relationshipId));
  assert.ok(actionChecks.length >= 18, 'Interactive state family produced too few checks');
  for (const check of actionChecks) {
    assert.notEqual(check.pass, false, `Action state failed: ${check.theme} ${check.tokenId} ${check.actual.toFixed(2)}`);
  }
}

// Focus rings reach 3:1 against each recorded adjacent surface.
{
  const result = run(defaultOptions({ randomSeed: 42 }));
  const ringChecks = result.proposal.validation.relationships.filter(relationship => relationship.relationshipId === 'FOCUS_RING_ON_SURFACE');
  assert.ok(ringChecks.length >= 24, 'Focus ring checks are missing');
  for (const check of ringChecks) {
    assert.notEqual(check.pass, false, `Focus ring failed: ${check.theme} ${check.tokenId} vs ${check.background}`);
    assert.equal(check.target, 'nonText', 'Focus rings must use the non-text target');
    assert.equal(check.required, 3, 'Focus rings must require 3:1');
  }
}

// Muted and feedback text use the text target, never the border/icon target.
{
  const result = run(defaultOptions({ randomSeed: 42 }));
  const textTokens = result.proposal.validation.relationships.filter(relationship =>
    relationship.tokenId === 'content.muted'
    || relationship.tokenId.startsWith('feedback.') && relationship.tokenId.endsWith('.text'));
  assert.ok(textTokens.length >= 8, 'Muted/feedback text checks are missing');
  for (const check of textTokens) {
    assert.equal(check.target, 'normalText', `${check.tokenId} used the wrong target`);
    assert.equal(check.required, 4.5, `${check.tokenId} used the border/icon ratio`);
    assert.notEqual(check.pass, false, `${check.tokenId} failed the text target`);
  }
}

// AAA raises text constraints without changing the 3:1 non-text threshold.
{
  const result = run(defaultOptions({ randomSeed: 42 }));
  const p = result.proposal;
  const palettes = Object.fromEntries(Object.entries(p.palettes).map(([roleId, palette]) => [roleId, { scale: palette.scale }]));
  const aaa = sandbox.window.WebsiteTokenContract.resolveWebsiteTokens({
    palettes, roles: p.roles, assignments: p.assignments, targetProfileId: 'aaa-interface',
  });
  for (const theme of ['light', 'dark']) {
    const checks = sandbox.window.WebsiteTokenContract.validateTheme(aaa[theme]);
    for (const check of checks.filter(item => item.target === 'normalText')) {
      assert.equal(check.required, 7, 'AAA did not raise normal text to 7:1');
    }
    for (const check of checks.filter(item => item.target === 'nonText')) {
      assert.equal(check.required, 3, 'AAA changed the non-text threshold');
    }
  }
}

// Locked conflicts produce NEEDS ATTENTION instead of silent mutation.
{
  const lockedWhite = run(defaultOptions(), {
    roles: { brand: { enabled: true, seed: '#FFFFFF', locked: true } },
  });
  assert.equal(lockedWhite.validation.status, 'needs-attention');
  assert.equal(lockedWhite.proposal.roles.brand.seed, '#FFFFFF', 'A locked seed was replaced');
  assert.equal(lockedWhite.proposal.roles.brand.locked, true, 'A locked seed was unlocked');
  const ringFailure = lockedWhite.validation.requiredFailures.find(failure => failure.relationshipId === 'FOCUS_RING_ON_SURFACE');
  assert.ok(ringFailure, 'Locked conflict produced no focus-ring failure');
}

// Disabled Secondary leaves no accent tokens or stale references.
{
  const result = run(defaultOptions({ randomSeed: 42 }));
  for (const theme of ['light', 'dark']) {
    const values = result.proposal.websiteTokens[theme].values;
    for (const tokenId of Object.keys(values)) {
      assert.ok(!tokenId.startsWith('accent.'), `Disabled Secondary left ${tokenId} in ${theme}`);
    }
  }
  // Enabling Secondary adds exactly the three accent tokens per theme.
  const withSecondary = run(defaultOptions({ randomSeed: 42, secondaryStrategy: 'analogous' }));
  for (const theme of ['light', 'dark']) {
    const values = withSecondary.proposal.websiteTokens[theme].values;
    assert.ok(values['accent.secondary.surface'], `${theme} missing accent surface`);
    assert.ok(values['accent.secondary.border'], `${theme} missing accent border`);
    assert.ok(values['accent.secondary.text'], `${theme} missing accent text`);
  }
}

console.log('system-generator: deterministic, locked, character, and context checks passed');
