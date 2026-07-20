(() => {
  'use strict';

  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function hexToRgb(hex) {
    const clean = hex.replace('#', '').trim();
    if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
    return [parseInt(clean.slice(0,2),16), parseInt(clean.slice(2,4),16), parseInt(clean.slice(4,6),16)];
  }
  function rgbToHex([r, g, b]) { return '#' + [r,g,b].map(v => Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase(); }
  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [255 * f(0), 255 * f(8), 255 * f(4)];
  }
  function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = 0, s = 0, l = (max + min) / 2;
    if (d) {
      s = d / (1 - Math.abs(2*l - 1));
      switch (max) { case r: h = 60 * (((g-b)/d) % 6); break; case g: h = 60 * ((b-r)/d + 2); break; default: h = 60 * ((r-g)/d + 4); }
    }
    return { h: Math.round((h + 360) % 360), s: Math.round(s*100), l: Math.round(l*100) };
  }
  function shiftLightness(hex, amount) {
    const hsl = rgbToHsl(hexToRgb(hex));
    return rgbToHex(hslToRgb(hsl.h, hsl.s, clamp(hsl.l + amount, 4, 96)));
  }
  function luminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) throw new Error('Invalid HEX color');
    return rgb.reduce((sum, value, i) => {
      const channel = value / 255;
      const linear = channel <= .03928 ? channel / 12.92 : Math.pow((channel + .055) / 1.055, 2.4);
      return sum + linear * [0.2126, 0.7152, 0.0722][i];
    }, 0);
  }
  function contrast(foreground, background) {
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
  }
  function textColor(background) { return contrast('#FFFFFF', background) >= contrast('#111111', background) ? '#FFFFFF' : '#111111'; }
  
  function makeScaleFor(hex) {
    const hsl = rgbToHsl(hexToRgb(hex));
    const lightnessByStep = [97, 94, 88, 79, 68, hsl.l, 44, 35, 26, 18, 12];
    const saturationByStep = [Math.max(hsl.s - 20, 12), Math.max(hsl.s - 16, 15), Math.max(hsl.s - 10, 18), Math.max(hsl.s - 4, 20), hsl.s, hsl.s, hsl.s + 2, hsl.s + 2, hsl.s + 3, hsl.s + 3, hsl.s + 3];
    return steps.map((step, index) => {
      const stepHex = step === 500
        ? rgbToHex(hexToRgb(hex))
        : rgbToHex(hslToRgb(hsl.h, clamp(saturationByStep[index], 0, 100), lightnessByStep[index]));
      return { step, hex: stepHex, ink: textColor(stepHex), ratioOnWhite: contrast('#FFFFFF', stepHex), ratioOnBlack: contrast('#111111', stepHex) };
    });
  }

  window.ColorEngine = Object.freeze({
    steps,
    clamp,
    hexToRgb,
    rgbToHex,
    hslToRgb,
    rgbToHsl,
    shiftLightness,
    luminance,
    contrast,
    textColor,
    makeScaleFor,
  });
})();
