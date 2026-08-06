(() => {
  'use strict';

  const {
    clamp,
    contrast,
    hexToOklch,
    mapOklchToSrgb,
    maxChromaAt,
    normalizeHue,
    textColor,
    familyChromaLimits,
  } = window.ColorEngine;

  const roleOrder = Object.freeze([
    'brand',
    'neutral',
    'secondary',
    'regular',
    'success',
    'warning',
    'danger',
    'information',
  ]);

  const roles = Object.freeze({
    brand: Object.freeze({
      label: 'Brand',
      descriptionKey: 'role.brand.desc',
      paletteOwner: true,
      required: true,
    }),
    neutral: Object.freeze({
      label: 'Neutral',
      descriptionKey: 'role.neutral.desc',
      paletteOwner: true,
      required: true,
    }),
    secondary: Object.freeze({
      label: 'Secondary',
      descriptionKey: 'role.secondary.desc',
      paletteOwner: true,
      required: false,
    }),
    regular: Object.freeze({
      label: 'Regular',
      descriptionKey: 'role.regular.desc',
      paletteOwner: false,
      aliasOf: 'neutral',
      required: true,
    }),
    success: Object.freeze({
      label: 'Success',
      descriptionKey: 'role.success.desc',
      paletteOwner: true,
      required: true,
      semanticHue: 145,
    }),
    warning: Object.freeze({
      label: 'Warning',
      descriptionKey: 'role.warning.desc',
      paletteOwner: true,
      required: true,
      semanticHue: 80,
    }),
    danger: Object.freeze({
      label: 'Danger',
      descriptionKey: 'role.danger.desc',
      paletteOwner: true,
      required: true,
      semanticHue: 27,
    }),
    information: Object.freeze({
      label: 'Information',
      descriptionKey: 'role.information.desc',
      paletteOwner: true,
      required: true,
      semanticHue: 245,
    }),
  });

  const secondaryStrategies = Object.freeze({
    none: Object.freeze({ labelKey: 'strategy.none', offsets: Object.freeze([]) }),
    analogous: Object.freeze({ labelKey: 'strategy.analogous', offsets: Object.freeze([-34, 34, 62]) }),
    contrasting: Object.freeze({ labelKey: 'strategy.contrasting', offsets: Object.freeze([180, 150, 210]) }),
  });

  const semanticRoleIds = Object.freeze(['success', 'warning', 'danger', 'information']);
  const paletteOwnerIds = Object.freeze(roleOrder.filter(roleId => roles[roleId].paletteOwner));

  function resolvePaletteOwner(roleId) {
    const definition = roles[roleId];
    if (!definition) throw new Error(`Unknown color role: ${roleId}`);
    return definition.aliasOf || roleId;
  }

  function suggestedHex({ L, C, h }) {
    return mapOklchToSrgb({ L, C, h }).hex;
  }

  function relativeChroma({ L, C, h }) {
    const maximum = maxChromaAt(L, h);
    return maximum > 0 ? clamp(C / maximum, 0, 1) : 0;
  }

  function chromaAtPercent(L, h, percent, limit) {
    return Math.min(maxChromaAt(L, h) * clamp(percent, 0, 1), limit);
  }

  function makeSecondarySuggestions(brandHex, strategy = 'analogous') {
    const definition = secondaryStrategies[strategy];
    if (!definition) throw new Error(`Unknown Secondary strategy: ${strategy}`);
    if (strategy === 'none') return [];
    const brand = hexToOklch(brandHex);
    const brandChromaPercent = relativeChroma(brand);
    return definition.offsets.map((offset, index) => ({
      id: `${strategy}-${index + 1}`,
      labelKey: definition.labelKey,
      strategy,
      hex: suggestedHex({
        L: clamp(brand.L, 0.50, 0.72),
        C: chromaAtPercent(
          clamp(brand.L, 0.50, 0.72),
          normalizeHue(brand.h + offset),
          Math.max(brandChromaPercent * (index === 0 ? 0.92 : 0.82), 0.35),
          familyChromaLimits.secondary,
        ),
        h: normalizeHue(brand.h + offset),
      }),
    }));
  }

  function makeSemanticSuggestion(roleId, brandHex) {
    const definition = roles[roleId];
    if (!semanticRoleIds.includes(roleId)) throw new Error(`Role has no semantic hue family: ${roleId}`);
    const brand = hexToOklch(brandHex);
    const familyLimit = familyChromaLimits[roleId];
    const lightnessShift = roleId === 'warning' ? 0.05 : 0;
    const lightness = clamp(brand.L + lightnessShift, 0.54, 0.72);
    const semanticHue = definition.semanticHue;
    const semanticChromaPercent = Math.max(relativeChroma(brand) * 0.90, roleId === 'warning' ? 0.55 : 0.45);
    const requested = {
      L: lightness,
      C: chromaAtPercent(lightness, semanticHue, semanticChromaPercent, familyLimit),
      h: semanticHue,
    };
    const mapped = mapOklchToSrgb(requested);
    return {
      id: roleId,
      label: definition.label,
      roleId,
      hex: mapped.hex,
      semanticHue: definition.semanticHue,
      gamutReduced: mapped.reduced,
      requestedChroma: mapped.requestedChroma,
      actualChroma: mapped.actualChroma,
    };
  }

  function makeSemanticSuggestions(brandHex) {
    return Object.fromEntries(semanticRoleIds.map(roleId => [roleId, makeSemanticSuggestion(roleId, brandHex)]));
  }

  function optimizeSemanticSeed(roleId, seedHex, backgroundHex, target) {
    if (!semanticRoleIds.includes(roleId)) throw new Error(`Role has no semantic optimizer: ${roleId}`);
    if (!Number.isFinite(target) || target <= 0) throw new Error(`Invalid contrast target: ${target}`);
    if (target > 21) return null;

    const passes = hex => contrast(hex, backgroundHex) >= target
      && contrast(textColor(hex), hex) >= target;
    if (passes(seedHex)) return { hex: seedHex, adjusted: false, chromaReduced: false };

    const source = hexToOklch(seedHex);
    const baseChromaPercent = Math.max(relativeChroma(source), 0.35);
    const lightnessCandidates = Array.from({ length: 461 }, (_, index) => 0.04 + index * 0.002)
      .sort((first, second) => Math.abs(first - source.L) - Math.abs(second - source.L));
    const chromaFactors = [1, 0.92, 0.84, 0.72, 0.58, 0.42, 0.24, 0];

    for (const factor of chromaFactors) {
      for (const L of lightnessCandidates) {
        const mapped = mapOklchToSrgb({
          L,
          C: chromaAtPercent(L, source.h, baseChromaPercent * factor, familyChromaLimits[roleId]),
          h: source.h,
        });
        if (!passes(mapped.hex)) continue;
        return {
          hex: mapped.hex,
          adjusted: true,
          chromaReduced: factor < 1 || mapped.reduced,
        };
      }
    }
    return null;
  }

  function createInitialRoles() {
    const semantic = makeSemanticSuggestions('#D8664A');
    return {
      brand: { enabled: true, seed: '#D8664A', locked: true },
      neutral: { enabled: true, seed: '#6F736E', temperature: 'balanced', locked: false },
      secondary: { enabled: false, seed: null, strategy: 'none', locked: false },
      regular: { aliasOf: 'neutral' },
      success: { enabled: true, seed: semantic.success.hex, locked: false },
      warning: { enabled: true, seed: semantic.warning.hex, locked: false },
      danger: { enabled: true, seed: semantic.danger.hex, locked: false },
      information: { enabled: true, seed: semantic.information.hex, locked: false },
    };
  }

  function tokenAt(palette, step) {
    const token = palette.scale.find(item => item.step === step);
    if (!token) throw new Error(`Palette is missing token ${step}`);
    return token;
  }

  function strongestContrastToken(palette, candidates, against) {
    return candidates
      .map(step => tokenAt(palette, step))
      .sort((first, second) => window.ColorEngine.contrast(second.hex, against) - window.ColorEngine.contrast(first.hex, against))[0];
  }

  function resolveAssignment(roleId, palette, target, theme = 'light') {
    const dark = theme === 'dark';
    const subtle = tokenAt(palette, dark ? 900 : 100);
    const borderCandidates = dark ? [700, 600, 500, 400, 300] : [400, 500, 600, 700];
    const boldCandidates = dark ? [400, 300, 500, 600] : [600, 700, 800, 500];
    const border = borderCandidates
      .map(step => tokenAt(palette, step))
      .find(token => window.ColorEngine.contrast(token.hex, subtle.hex) >= 3)
      || strongestContrastToken(palette, borderCandidates, subtle.hex);
    const bold = boldCandidates
      .map(step => tokenAt(palette, step))
      .find(token => {
        const onColor = window.ColorEngine.textColor(token.hex);
        return window.ColorEngine.contrast(onColor, token.hex) >= target
          && window.ColorEngine.contrast(token.hex, subtle.hex) >= 3;
      })
      || strongestContrastToken(palette, boldCandidates, subtle.hex);
    const onBold = window.ColorEngine.textColor(bold.hex);
    const borderRatio = window.ColorEngine.contrast(border.hex, subtle.hex);
    const onBoldRatio = window.ColorEngine.contrast(onBold, bold.hex);

    return {
      roleId,
      theme,
      subtle: { step: subtle.step, hex: subtle.hex },
      borderIcon: { step: border.step, hex: border.hex, ratioOnSubtle: borderRatio, pass: borderRatio >= 3 },
      bold: { step: bold.step, hex: bold.hex },
      onBold: { hex: onBold, ratio: onBoldRatio, pass: onBoldRatio >= target },
    };
  }

  // A pair foreground is normally a palette step. `auto` instead measures readable ink
  // for the resolved background, which is how an on-bold foreground is expressed.
  const autoForegroundStep = 'auto';

  // `borderIcon` is chosen at 3:1 because it is meant for borders and icons, so it is not
  // a safe source for text. These pick a foreground against the active text target instead.
  //   maxContrast — most readable, used where legibility outranks character (body text).
  //   minPassing  — the least contrast that still passes, which keeps the role's hue
  //                 recognizable. Used for links and status text, where near-black would
  //                 throw away the very color that carries the meaning.
  function foregroundToken(palette, backgroundHex, target, mode = 'maxContrast') {
    const ranked = palette.scale
      .map(token => ({ step: token.step, hex: token.hex, ratio: contrast(token.hex, backgroundHex) }))
      .sort((first, second) => second.ratio - first.ratio);
    const passing = ranked.filter(token => token.ratio >= target);
    if (!passing.length) return { ...ranked[0], pass: false };
    const chosen = mode === 'minPassing' ? passing[passing.length - 1] : passing[0];
    return { ...chosen, pass: true };
  }

  // The starter set is a projection of resolved assignments onto pair coordinates.
  // Rows whose foreground is an on-bold assignment use `auto`; the rest resolve a token
  // against the active target. Disabled roles drop out rather than being fabricated.
  function starterPairSpecs(palettes, roleState, assignments, target) {
    const enabled = roleId => Boolean(palettes[roleId]) && roleState[roleId].enabled !== false;
    const light = roleId => assignments[roleId].light;
    const specs = [];

    const text = (slug, nameKey, foregroundRoleId, backgroundRoleId, backgroundStep, mode) => {
      const backgroundHex = tokenAt(palettes[backgroundRoleId], backgroundStep).hex;
      const foreground = foregroundToken(palettes[foregroundRoleId], backgroundHex, target, mode);
      specs.push({
        slug,
        nameKey,
        foregroundRoleId,
        foregroundStep: foreground.step,
        backgroundRoleId,
        backgroundStep,
        usage: 'static',
      });
    };

    const action = (slug, nameKey, roleId) => {
      specs.push({
        slug,
        nameKey,
        foregroundRoleId: roleId,
        foregroundStep: autoForegroundStep,
        backgroundRoleId: roleId,
        backgroundStep: light(roleId).bold.step,
        usage: 'interactive',
      });
    };

    if (enabled('neutral')) {
      const surface = light('neutral').subtle.step;
      text('body-text', 'starter.bodyText', 'neutral', 'neutral', surface, 'maxContrast');
      text('muted-text', 'starter.mutedText', 'neutral', 'neutral', surface, 'minPassing');
      if (enabled('brand')) text('link', 'starter.link', 'brand', 'neutral', surface, 'minPassing');
    }
    if (enabled('brand')) action('primary-action', 'starter.primaryAction', 'brand');
    if (enabled('secondary')) action('secondary-action', 'starter.secondaryAction', 'secondary');
    if (enabled('neutral')) {
      // One tier above the page surface, so a quiet control still reads as raised.
      const raised = 200;
      text('neutral-action', 'starter.neutralAction', 'neutral', 'neutral', raised, 'maxContrast');
      specs[specs.length - 1].usage = 'interactive';
    }
    if (enabled('danger')) action('destructive-action', 'starter.destructiveAction', 'danger');
    for (const roleId of semanticRoleIds) {
      if (!enabled(roleId)) continue;
      text(`${roleId}-notice`, `starter.${roleId}Notice`, roleId, roleId, light(roleId).subtle.step, 'minPassing');
    }
    return specs;
  }

  function resolveAssignments(palettes, roleState, target) {
    const assignments = {};
    for (const roleId of paletteOwnerIds) {
      if (!palettes[roleId] || roleState[roleId].enabled === false) continue;
      assignments[roleId] = {
        light: resolveAssignment(roleId, palettes[roleId], target, 'light'),
        dark: resolveAssignment(roleId, palettes[roleId], target, 'dark'),
      };
    }
    assignments.regular = { aliasOf: 'neutral' };
    return assignments;
  }

  const defaults = Object.freeze({
    current: Object.freeze({ hex: '#D8664A', h: 11, s: 64, l: 57 }),
    candidates: Object.freeze({ brand: '#D8664A', neutral: '#6F736E' }),
    context: Object.freeze({ background: '#F7F3EB', text: '#25231F' }),
    activeRole: 'brand',
    target: 4.5,
    secondaryStrategy: 'none',
  });

  window.ColorRoleModel = Object.freeze({
    roleOrder,
    roles,
    paletteOwnerIds,
    semanticRoleIds,
    secondaryStrategies,
    defaults,
    resolvePaletteOwner,
    makeSecondarySuggestions,
    makeSemanticSuggestion,
    makeSemanticSuggestions,
    optimizeSemanticSeed,
    autoForegroundStep,
    foregroundToken,
    starterPairSpecs,
    createInitialRoles,
    resolveAssignment,
    resolveAssignments,
  });
})();
