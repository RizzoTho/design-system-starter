(() => {
  'use strict';

  const steps = Object.freeze([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
  const lightnessFractions = Object.freeze([1, 0.82, 0.64, 0.46, 0.23, 0, 0.20, 0.40, 0.60, 0.80, 1]);
  const chromaMultipliers = Object.freeze([0.18, 0.28, 0.44, 0.62, 0.82, 1, 1.04, 1.06, 1.02, 0.92, 0.78]);
  // Near white the sRGB gamut is narrow, so a percentage of a percentage collapses
  // to grey: a tint step at 6% of the available chroma is not a faint hue, it is
  // no hue. The light steps therefore take an absolute chroma floor. It is
  // absolute rather than a share of the maximum because the available chroma
  // swings by 4x across hues at those lightnesses, and a share floor makes the
  // green tint shout while the red tint whispers. `tintFloorShare` only stops a
  // hue from being pushed to the very edge of its own gamut. Neutral is excluded
  // so it stays near-achromatic, and the floor never touches 300-950, so the seed
  // and the bold end keep the generated Brand-over-semantics hierarchy.
  const tintFloorChroma = Object.freeze([0.022, 0.042, 0.055, 0, 0, 0, 0, 0, 0, 0, 0]);
  const tintFloorShare = 0.85;
  const maxChromaSearch = 0.5;
  const familyChromaLimits = Object.freeze({
    brand: 0.25,
    secondary: 0.23,
    neutral: 0.055,
    success: 0.19,
    warning: 0.20,
    danger: 0.22,
    information: 0.20,
  });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeHue(value) {
    return ((value % 360) + 360) % 360;
  }

  function normalizeHex(hex) {
    const clean = String(hex).replace('#', '').trim();
    if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
    return `#${clean.toUpperCase()}`;
  }

  function hexToRgb(hex) {
    const normalized = normalizeHex(hex);
    if (!normalized) return null;
    return [
      parseInt(normalized.slice(1, 3), 16),
      parseInt(normalized.slice(3, 5), 16),
      parseInt(normalized.slice(5, 7), 16),
    ];
  }

  function rgbToHex([r, g, b]) {
    return `#${[r, g, b]
      .map(value => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()}`;
  }

  function hslToRgb(h, s, l) {
    const saturation = s / 100;
    const lightness = l / 100;
    const k = n => (n + h / 30) % 12;
    const a = saturation * Math.min(lightness, 1 - lightness);
    const f = n => lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [255 * f(0), 255 * f(8), 255 * f(4)];
  }

  function rgbToHsl([r, g, b]) {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    let hue = 0;
    let saturation = 0;
    const lightness = (max + min) / 2;

    if (delta) {
      saturation = delta / (1 - Math.abs(2 * lightness - 1));
      if (max === red) hue = 60 * (((green - blue) / delta) % 6);
      else if (max === green) hue = 60 * ((blue - red) / delta + 2);
      else hue = 60 * ((red - green) / delta + 4);
    }

    return {
      h: Math.round(normalizeHue(hue)),
      s: Math.round(saturation * 100),
      l: Math.round(lightness * 100),
    };
  }

  function srgbToLinear(channel) {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(channel) {
    const value = channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
    return value * 255;
  }

  function rgbToOklab(rgb) {
    const [red, green, blue] = rgb.map(srgbToLinear);
    const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
    const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
    const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
    const lRoot = Math.cbrt(l);
    const mRoot = Math.cbrt(m);
    const sRoot = Math.cbrt(s);

    return {
      L: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
      a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
      b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
    };
  }

  function oklabToLinearRgb({ L, a, b }) {
    const lRoot = L + 0.3963377774 * a + 0.2158037573 * b;
    const mRoot = L - 0.1055613458 * a - 0.0638541728 * b;
    const sRoot = L - 0.0894841775 * a - 1.291485548 * b;
    const l = lRoot ** 3;
    const m = mRoot ** 3;
    const s = sRoot ** 3;

    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  }

  function oklabToRgb(oklab) {
    return oklabToLinearRgb(oklab).map(linearToSrgb);
  }

  function oklabToOklch({ L, a, b }) {
    const C = Math.sqrt(a * a + b * b);
    return { L, C, h: C < 0.000001 ? 0 : normalizeHue(Math.atan2(b, a) * 180 / Math.PI) };
  }

  function oklchToOklab({ L, C, h }) {
    const radians = normalizeHue(h) * Math.PI / 180;
    return { L, a: C * Math.cos(radians), b: C * Math.sin(radians) };
  }

  function hexToOklch(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) throw new Error(`Invalid HEX color: ${hex}`);
    return oklabToOklch(rgbToOklab(rgb));
  }

  function inSrgbGamut(oklch) {
    return oklabToLinearRgb(oklchToOklab(oklch))
      .every(channel => channel >= -1e-7 && channel <= 1 + 1e-7);
  }

  function maxChromaAt(L, h) {
    const lightness = clamp(L, 0, 1);
    const hue = normalizeHue(h);
    let low = 0;
    let high = maxChromaSearch;

    while (inSrgbGamut({ L: lightness, C: high, h: hue }) && high < 1) {
      high = Math.min(1, high * 2);
    }
    if (inSrgbGamut({ L: lightness, C: high, h: hue })) return high;

    for (let index = 0; index < 24; index += 1) {
      const mid = (low + high) / 2;
      if (inSrgbGamut({ L: lightness, C: mid, h: hue })) low = mid;
      else high = mid;
    }
    return low;
  }

  function paletteLightness(seedLightness, index) {
    const fraction = lightnessFractions[index];
    const maxLightness = Math.max(seedLightness, Math.min(0.95, seedLightness + 0.40));
    const minLightness = Math.min(seedLightness, Math.max(0.05, seedLightness - 0.40));
    if (index < 5) return seedLightness + (maxLightness - seedLightness) * fraction;
    if (index === 5) return seedLightness;
    return seedLightness - (seedLightness - minLightness) * fraction;
  }

  function mapOklchToSrgb(oklch) {
    const requested = {
      L: clamp(oklch.L, 0, 1),
      C: Math.max(0, oklch.C),
      h: normalizeHue(oklch.h),
    };

    const actualChroma = maxChromaAt(requested.L, requested.h);
    const reduced = requested.C > actualChroma + 1e-7;
    const mapped = { ...requested, C: reduced ? actualChroma : requested.C };

    return {
      hex: rgbToHex(oklabToRgb(oklchToOklab(mapped))),
      oklch: mapped,
      reduced,
      requestedChroma: requested.C,
      actualChroma: mapped.C,
      maxChroma: actualChroma,
    };
  }

  function oklchToHex(oklch) {
    return mapOklchToSrgb(oklch).hex;
  }

  function shiftLightness(hex, amount) {
    const oklch = hexToOklch(hex);
    return oklchToHex({ ...oklch, L: clamp(oklch.L + amount / 100, 0.04, 0.98) });
  }

  function luminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) throw new Error(`Invalid HEX color: ${hex}`);
    const [red, green, blue] = rgb.map(srgbToLinear);
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  }

  function contrast(foreground, background) {
    const foregroundLuminance = luminance(foreground);
    const backgroundLuminance = luminance(background);
    return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
      / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
  }

  function textColor(background, light = '#FFFFFF', dark = '#111111') {
    return contrast(light, background) >= contrast(dark, background) ? light : dark;
  }

  function makePalette(hex, options = {}) {
    const seed = normalizeHex(hex);
    if (!seed) throw new Error(`Invalid HEX color: ${hex}`);
    const family = options.family || 'brand';
    const seedOklch = hexToOklch(seed);
    const chromaLimit = options.chromaLimit ?? familyChromaLimits[family] ?? familyChromaLimits.brand;
    const baseChroma = Math.min(seedOklch.C, chromaLimit);
    const seedMaxChroma = maxChromaAt(seedOklch.L, seedOklch.h);
    const baseChromaPercent = seedMaxChroma > 0 ? clamp(baseChroma / seedMaxChroma, 0, 1) : 0;
    const diagnostics = [];

    const scale = steps.map((step, index) => {
      if (step === 500) {
        return {
          step,
          hex: seed,
          ink: textColor(seed),
          ratioOnWhite: contrast('#FFFFFF', seed),
          ratioOnBlack: contrast('#111111', seed),
          oklch: seedOklch,
        };
      }

      const requested = {
        L: paletteLightness(seedOklch.L, index),
        h: seedOklch.h,
      };
      const availableChroma = maxChromaAt(requested.L, requested.h);
      const requestedChromaPercent = baseChromaPercent * chromaMultipliers[index];
      const tintFloor = family === 'neutral'
        ? 0
        : Math.min(tintFloorChroma[index], availableChroma * tintFloorShare);
      requested.C = Math.min(Math.max(availableChroma * requestedChromaPercent, tintFloor), chromaLimit);
      const mapped = mapOklchToSrgb(requested);
      if (mapped.reduced) {
        diagnostics.push(Object.freeze({
          type: 'gamut-reduction',
          family,
          step,
          requestedChroma: mapped.requestedChroma,
          actualChroma: mapped.actualChroma,
          requestedChromaPercent,
        }));
      }
      return {
        step,
        hex: mapped.hex,
        ink: textColor(mapped.hex),
        ratioOnWhite: contrast('#FFFFFF', mapped.hex),
        ratioOnBlack: contrast('#111111', mapped.hex),
        oklch: mapped.oklch,
      };
    });

    return { scale, diagnostics: Object.freeze(diagnostics) };
  }

  function makeScaleFor(hex, options) {
    return makePalette(hex, options).scale;
  }

  window.ColorEngine = Object.freeze({
    steps,
    lightnessFractions,
    chromaMultipliers,
    tintFloorChroma,
    maxChromaAt,
    familyChromaLimits,
    clamp,
    normalizeHue,
    normalizeHex,
    hexToRgb,
    rgbToHex,
    hslToRgb,
    rgbToHsl,
    rgbToOklab,
    oklabToRgb,
    oklabToOklch,
    oklchToOklab,
    hexToOklch,
    oklchToHex,
    inSrgbGamut,
    mapOklchToSrgb,
    shiftLightness,
    luminance,
    contrast,
    textColor,
    makePalette,
    makeScaleFor,
  });
})();
