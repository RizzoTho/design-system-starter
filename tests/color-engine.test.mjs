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
assert.match(mapped.hex, /^#[0-9A-F]{6}$/);
assert.equal(engine.inSrgbGamut(mapped.oklch), true);

const gamutPalette = engine.makePalette('#00FF00', { family: 'success', chromaLimit: 0.4 });
assert.ok(gamutPalette.diagnostics.some(item => item.type === 'gamut-reduction'));

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

console.log('color-engine: all deterministic checks passed');
