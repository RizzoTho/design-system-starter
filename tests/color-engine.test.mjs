import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(new URL('../js/color-engine.js', import.meta.url), 'utf8'), context);
vm.runInContext(fs.readFileSync(new URL('../js/role-model.js', import.meta.url), 'utf8'), context);

const engine = context.window.ColorEngine;
const model = context.window.ColorRoleModel;

assert.equal(engine.hexToRgb('#D8664A').join(','), '216,102,74');
assert.equal(engine.hexToRgb('not-a-color'), null);
assert.throws(() => engine.hexToOklch('#123'), /Invalid HEX/);

for (const hex of ['#000000', '#FFFFFF', '#D8664A', '#3B7A78', '#FFD400', '#4F46E5']) {
  const roundTrip = engine.oklchToHex(engine.hexToOklch(hex));
  const original = engine.hexToRgb(hex);
  const result = engine.hexToRgb(roundTrip);
  assert.ok(result.every((channel, index) => Math.abs(channel - original[index]) <= 1), `${hex} round trip became ${roundTrip}`);
}

for (const [family, hex] of Object.entries({
  brand: '#D8664A',
  neutral: '#6F736E',
  success: '#348B53',
  warning: '#B77900',
  danger: '#C74337',
  information: '#3778C2',
})) {
  const palette = engine.makePalette(hex, { family });
  assert.equal(palette.scale.length, 11);
  assert.equal(palette.scale.find(token => token.step === 500).hex, hex);
  const lightness = palette.scale.map(token => engine.hexToOklch(token.hex).L);
  for (let index = 1; index < lightness.length; index += 1) {
    assert.ok(lightness[index] <= lightness[index - 1] + 0.004, `${family} lightness is not monotonic at ${palette.scale[index].step}`);
  }
}

const mapped = engine.mapOklchToSrgb({ L: 0.72, C: 0.45, h: 145 });
assert.equal(mapped.reduced, true);
assert.ok(mapped.actualChroma < mapped.requestedChroma);
assert.ok(mapped.actualChroma <= mapped.maxChroma + 1e-7);
assert.match(mapped.hex, /^#[0-9A-F]{6}$/);
assert.equal(engine.inSrgbGamut(mapped.oklch), true);
assert.ok(engine.maxChromaAt(0.72, 145) > 0);

const hueAwarePalette = engine.makePalette('#D8664A', { family: 'brand' });
for (const token of hueAwarePalette.scale) {
  assert.ok(token.oklch.C <= engine.maxChromaAt(token.oklch.L, token.oklch.h) + 1e-7, `Token ${token.step} exceeded its hue-aware gamut boundary`);
}
assert.equal(hueAwarePalette.scale.find(token => token.step === 500).hex, '#D8664A');

const gamutPalette = engine.makePalette('#00FF00', { family: 'success', chromaLimit: 0.4 });
assert.ok(gamutPalette.diagnostics.some(item => item.type === 'gamut-reduction'));
assert.ok(gamutPalette.diagnostics.every(item => Number.isFinite(item.requestedChromaPercent)));

assert.ok(Math.abs(engine.contrast('#000000', '#FFFFFF') - 21) < 1e-12);
assert.equal(engine.textColor('#000000'), '#FFFFFF');
assert.equal(engine.textColor('#FFFFFF'), '#111111');

assert.equal(model.resolvePaletteOwner('regular'), 'neutral');
assert.equal(model.paletteOwnerIds.includes('regular'), false);
assert.equal(model.roleOrder.length, 8);
assert.equal(model.makeSecondarySuggestions('#D8664A', 'none').length, 0);
assert.equal(model.makeSecondarySuggestions('#D8664A', 'analogous').length, 3);

const semantic = model.makeSemanticSuggestions('#8B5CF6');
for (const roleId of model.semanticRoleIds) {
  const hue = engine.hexToOklch(semantic[roleId].hex).h;
  const targetHue = model.roles[roleId].semanticHue;
  const distance = Math.min(Math.abs(hue - targetHue), 360 - Math.abs(hue - targetHue));
  assert.ok(distance < 3, `${roleId} drifted from its semantic hue family`);
}

for (const roleId of model.semanticRoleIds) {
  const original = semantic[roleId].hex;
  assert.ok(semantic[roleId].actualChroma <= semantic[roleId].requestedChroma + 1e-7);
  const optimized = model.optimizeSemanticSeed(roleId, original, '#F7F3EB', 4.5);
  assert.ok(optimized, `${roleId} could not be optimized for the default Background`);
  assert.ok(engine.contrast(optimized.hex, '#F7F3EB') >= 4.5, `${roleId} still fails on Background`);
  const foreground = engine.textColor(optimized.hex);
  assert.ok(engine.contrast(foreground, optimized.hex) >= 4.5, `${roleId} still fails its recommended foreground`);
  const hueDistance = Math.min(
    Math.abs(engine.hexToOklch(optimized.hex).h - engine.hexToOklch(original).h),
    360 - Math.abs(engine.hexToOklch(optimized.hex).h - engine.hexToOklch(original).h),
  );
  assert.ok(hueDistance < 3, `${roleId} optimization changed its semantic hue family`);
}
assert.equal(model.optimizeSemanticSeed('success', '#52A257', '#F7F3EB', 22), null, 'Impossible targets should fail visibly');

const roleState = model.createInitialRoles();
const palettes = {};
for (const roleId of model.paletteOwnerIds) {
  const role = roleState[roleId];
  if (role.enabled && role.seed) palettes[roleId] = engine.makePalette(role.seed, { family: roleId });
}
const assignments = model.resolveAssignments(palettes, roleState, 4.5);
assert.equal(assignments.regular.aliasOf, 'neutral');
assert.equal('secondary' in assignments, false);
for (const roleId of ['brand', 'neutral', ...model.semanticRoleIds]) {
  for (const theme of ['light', 'dark']) {
    assert.equal(assignments[roleId][theme].borderIcon.pass, true, `${roleId} ${theme} border failed 3:1`);
    assert.equal(assignments[roleId][theme].onBold.pass, true, `${roleId} ${theme} on-bold failed target`);
  }
}
assert.equal(assignments.warning.light.onBold.hex, engine.textColor(assignments.warning.light.bold.hex));

console.log('color-engine: all deterministic checks passed');
