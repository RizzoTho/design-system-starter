import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
for (const file of ['../js/color-engine.js', '../js/system-generator.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), sandbox, { filename: file });
}
const { ColorEngine, SystemGenerator } = sandbox.window;

function run(options = {}, currentState = {}) {
  return SystemGenerator.generateSystem({ currentState, options });
}

function defaultOptions(overrides = {}) {
  return { characterId: 'balanced', brandSource: 'generated', secondaryStrategy: 'none', randomSeed: 42, ...overrides };
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

// --- Neutral stays inside its low-chroma contract ----------------------------

{
  for (const characterId of Object.keys(SystemGenerator.CHARACTERS)) {
    for (const seed of [1, 5, 9]) {
      const result = run(defaultOptions({ characterId, randomSeed: seed }));
      const neutralOklch = ColorEngine.hexToOklch(result.proposal.roles.neutral.seed);
      assert.ok(neutralOklch.C <= ColorEngine.familyChromaLimits.neutral + 1e-9,
        `${characterId} Neutral chroma ${neutralOklch.C} exceeds the ${ColorEngine.familyChromaLimits.neutral} contract`);
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

console.log('system-generator: deterministic, locked, character, and context checks passed');
