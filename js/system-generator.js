// System generator: character presets, deterministic Context / Brand / Neutral /
// Secondary / semantic batch seed generation, and the end-to-end generateSystem()
// proposal builder. Pure module: no DOM access, no mutation of the current state.
//
// Phase 2 scope: complete input seeds for the starter system. Phase 3 consumes
// these seeds to resolve palettes, role assignments, and website tokens.
(() => {
  'use strict';

  const {
    clamp,
    contrast,
    hexToOklch,
    mapOklchToSrgb,
    maxChromaAt,
    normalizeHue,
    normalizeHex,
    textColor,
    familyChromaLimits,
  } = window.ColorEngine;

  const SEMANTIC_ROLES = ['success', 'warning', 'danger', 'information'];

  // Character presets. Chroma is expressed as a fraction of the sRGB maximum
  // available at each drawn L and H, then capped by the family chroma limit, so
  // every requested color stays inside the gamut by construction. Generated
  // systems reserve recurring color emphasis for Brand: Neutral stays nearly
  // achromatic and semantic families sit below Brand's relative chroma budget.
  // `hue: null` means a free hue; a range draws inside that band.
  const CHARACTERS = Object.freeze({
    balanced: Object.freeze({
      labelKey: 'character.balanced',
      brand: Object.freeze({ hue: null, L: [0.50, 0.64], chromaPercent: [0.30, 0.42] }),
      neutral: Object.freeze({ hue: null, L: [0.55, 0.62], chromaPercent: 0.04, hueOffset: [-6, 10] }),
      semantic: Object.freeze({ L: [0.54, 0.68], chromaPercent: [0.22, 0.30] }),
      temperature: 'balanced',
      context: Object.freeze({ backgroundL: 0.94, backgroundChromaPercent: 0.06 }),
    }),
    warm: Object.freeze({
      labelKey: 'character.warm',
      brand: Object.freeze({ hue: [25, 55], L: [0.50, 0.64], chromaPercent: [0.30, 0.42] }),
      neutral: Object.freeze({ hue: null, L: [0.55, 0.62], chromaPercent: 0.045, hueOffset: [-14, 4] }),
      semantic: Object.freeze({ L: [0.54, 0.68], chromaPercent: [0.22, 0.30] }),
      temperature: 'warm',
      context: Object.freeze({ backgroundL: 0.94, backgroundChromaPercent: 0.07 }),
    }),
    cool: Object.freeze({
      labelKey: 'character.cool',
      brand: Object.freeze({ hue: [200, 260], L: [0.48, 0.62], chromaPercent: [0.28, 0.40] }),
      neutral: Object.freeze({ hue: null, L: [0.55, 0.62], chromaPercent: 0.04, hueOffset: [2, 14] }),
      semantic: Object.freeze({ L: [0.54, 0.68], chromaPercent: [0.20, 0.27] }),
      temperature: 'cool',
      context: Object.freeze({ backgroundL: 0.94, backgroundChromaPercent: 0.05 }),
    }),
    vivid: Object.freeze({
      labelKey: 'character.vivid',
      brand: Object.freeze({ hue: null, L: [0.46, 0.58], chromaPercent: [0.55, 0.72] }),
      neutral: Object.freeze({ hue: null, L: [0.55, 0.62], chromaPercent: 0.03, hueOffset: [-6, 10] }),
      semantic: Object.freeze({ L: [0.50, 0.64], chromaPercent: [0.40, 0.52] }),
      temperature: 'balanced',
      context: Object.freeze({ backgroundL: 0.94, backgroundChromaPercent: 0.05 }),
    }),
    muted: Object.freeze({
      labelKey: 'character.muted',
      brand: Object.freeze({ hue: null, L: [0.56, 0.70], chromaPercent: [0.16, 0.24] }),
      neutral: Object.freeze({ hue: null, L: [0.55, 0.62], chromaPercent: 0.035, hueOffset: [-6, 10] }),
      semantic: Object.freeze({ L: [0.56, 0.70], chromaPercent: [0.10, 0.16] }),
      temperature: 'balanced',
      context: Object.freeze({ backgroundL: 0.94, backgroundChromaPercent: 0.07 }),
    }),
  });

  const SECONDARY_STRATEGIES = ['none', 'analogous', 'contrasting'];

  // Deterministic PRNG (mulberry32). Injecting the random source keeps every
  // generation reproducible: the same seed and options produce the same inputs.
  function createRandom(seed) {
    let state = seed >>> 0;
    if (state === 0) state = 0x9E3779B9;
    return function random() {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function between(random, min, max) {
    return min + random() * (max - min);
  }

  function drawHue(character, random) {
    if (character.hue) return normalizeHue(between(random, character.hue[0], character.hue[1]));
    return normalizeHue(between(random, 0, 360));
  }

  function drawOklch(bounds, hue, random, limit) {
    const L = between(random, bounds.L[0], bounds.L[1]);
    const percent = Array.isArray(bounds.chromaPercent)
      ? between(random, bounds.chromaPercent[0], bounds.chromaPercent[1])
      : bounds.chromaPercent;
    const chroma = Math.min(maxChromaAt(L, hue) * clamp(percent, 0, 1), limit);
    return { L, C: chroma, h: normalizeHue(hue) };
  }

  function toHex(oklch) {
    const mapped = mapOklchToSrgb(oklch);
    return {
      hex: mapped.hex,
      oklch: mapped.oklch,
      gamutReduced: mapped.reduced,
      requestedChroma: mapped.requestedChroma,
      actualChroma: mapped.actualChroma,
    };
  }

  // --- Context -------------------------------------------------------------

  // Generated context: a Neutral-informed, low-chroma light background with
  // measured ink. A locked or explicitly provided Context is preserved; a
  // preserved Context that fails 4.5:1 yields an unresolved diagnostic instead
  // of a silent repair.
  function generateContext(currentState, character, random) {
    const existing = currentState?.context || {};
    const preserved = existing.source === 'provided' || existing.locked === true || existing.source === 'locked';
    if (preserved && existing.background && existing.text) {
      const actual = contrast(existing.text, existing.background);
      return {
        context: {
          background: normalizeHex(existing.background),
          text: normalizeHex(existing.text),
          source: existing.locked ? 'locked' : 'provided',
          locked: Boolean(existing.locked),
        },
        diagnostics: actual < 4.5 ? [{
          code: 'CONTEXT_TEXT_ON_BACKGROUND',
          severity: 'error',
          path: 'context.text-on-background',
          foreground: normalizeHex(existing.text),
          background: normalizeHex(existing.background),
          actual,
          required: 4.5,
          recovery: 'Choose a measured text color or unlock the Context',
        }] : [],
      };
    }
    const hue = existing.background
      ? hexToOklch(existing.background).h
      : normalizeHue(between(random, 40, 90));
    const backgroundOklch = {
      L: character.context.backgroundL,
      C: Math.min(maxChromaAt(character.context.backgroundL, hue) * character.context.backgroundChromaPercent, 0.03),
      h: hue,
    };
    const background = toHex(backgroundOklch).hex;
    const text = textColor(background);
    return {
      context: { background, text, source: 'generated', locked: false },
      diagnostics: [],
    };
  }

  // --- Identity seeds --------------------------------------------------------

  function generateBrand(currentState, options, character, random, repairDepth = 0) {
    const role = currentState?.roles?.brand || {};
    if (role.locked && role.seed) {
      return { seed: normalizeHex(role.seed), source: 'locked', locked: true };
    }
    if (options.brandSource === 'hex' && options.brandHex) {
      return { seed: normalizeHex(options.brandHex), source: 'provided', locked: false };
    }
    if (options.brandSource === 'keep' && role.seed) {
      return { seed: normalizeHex(role.seed), source: 'provided', locked: false };
    }
    // Stage 7 repair: each deeper attempt narrows the lightness band toward the
    // dark end so the darkest palette steps can carry the focus rings.
    const LMax = repairDepth > 0
      ? Math.max(0.42, character.brand.L[1] - 0.05 * repairDepth)
      : character.brand.L[1];
    const bounds = repairDepth > 0
      ? { ...character.brand, L: [Math.min(character.brand.L[0], LMax - 0.02), LMax] }
      : character.brand;
    const hue = drawHue(character.brand, random);
    const drawn = toHex(drawOklch(bounds, hue, random, familyChromaLimits.brand));
    return {
      seed: drawn.hex,
      source: 'generated',
      locked: false,
      gamutReduced: drawn.gamutReduced,
      requestedChroma: drawn.requestedChroma,
      actualChroma: drawn.actualChroma,
    };
  }

  function generateNeutral(currentState, brandSeed, character, random) {
    const role = currentState?.roles?.neutral || {};
    if (role.locked && role.seed) {
      return { seed: normalizeHex(role.seed), source: 'locked', locked: true, temperature: role.temperature || character.temperature };
    }
    if (role.seed && (role.source === 'provided' || currentState?.context?.source === 'provided')) {
      return { seed: normalizeHex(role.seed), source: 'provided', locked: false, temperature: role.temperature || character.temperature };
    }
    const brand = hexToOklch(brandSeed);
    const hue = character.neutral.hue
      ? normalizeHue(between(random, character.neutral.hue[0], character.neutral.hue[1]))
      : normalizeHue(brand.h + between(random, character.neutral.hueOffset[0], character.neutral.hueOffset[1]));
    return {
      seed: toHex(drawOklch(character.neutral, hue, random, familyChromaLimits.neutral)).hex,
      source: 'generated',
      locked: false,
      temperature: character.temperature,
    };
  }

  // Secondary reuses the accepted strategy offsets; it is never a second filled
  // action. The strategy chooses the offset family, the draw picks one member.
  function generateSecondary(currentState, brandSeed, strategy, random) {
    const role = currentState?.roles?.secondary || {};
    if (strategy === 'none') {
      return { enabled: false, seed: null, strategy: 'none', source: 'disabled', locked: false };
    }
    if (role.locked && role.seed && role.strategy === strategy) {
      return { enabled: true, seed: normalizeHex(role.seed), strategy, source: 'locked', locked: true };
    }
    const brand = hexToOklch(brandSeed);
    const offsets = strategy === 'analogous' ? [-34, 34, 62] : [180, 150, 210];
    const offset = offsets[Math.floor(random() * offsets.length)];
    const L = clamp(brand.L, 0.50, 0.72);
    const percent = Math.max((maxChromaAt(brand.L, brand.h) > 0 ? brand.C / maxChromaAt(brand.L, brand.h) : 0.35) * 0.85, 0.35);
    const seed = toHex({
      L,
      C: Math.min(maxChromaAt(L, normalizeHue(brand.h + offset)) * percent, familyChromaLimits.secondary),
      h: normalizeHue(brand.h + offset),
    }).hex;
    return { enabled: true, seed, strategy, source: 'generated', locked: false };
  }

  // Semantic batch: the four hue families are generated together as one
  // character-consistent batch. Locked semantic roles are preserved.
  function semanticHue(roleId) {
    return { success: 145, warning: 80, danger: 27, information: 245 }[roleId];
  }

  function generateSemanticBatch(currentState, brandSeed, character, random) {
    const roles = currentState?.roles || {};
    const brand = hexToOklch(brandSeed);
    const brandChromaPercent = maxChromaAt(brand.L, brand.h) > 0 ? brand.C / maxChromaAt(brand.L, brand.h) : 0.35;
    const seeds = {};
    const diagnostics = [];
    for (const roleId of SEMANTIC_ROLES) {
      const role = roles[roleId] || {};
      if (role.locked && role.seed) {
        seeds[roleId] = { seed: normalizeHex(role.seed), source: 'locked', locked: true };
        continue;
      }
      const hue = semanticHue(roleId);
      const lightnessShift = roleId === 'warning' ? 0.05 : 0;
      const L = clamp(
        between(random, character.semantic.L[0], character.semantic.L[1]) + lightnessShift,
        0.46,
        0.74
      );
      const semanticPercent = Array.isArray(character.semantic.chromaPercent)
        ? between(random, character.semantic.chromaPercent[0], character.semantic.chromaPercent[1])
        : character.semantic.chromaPercent;
      const percent = semanticPercent * (0.88 + 0.12 * brandChromaPercent);
      const drawn = toHex({
        L,
        C: Math.min(maxChromaAt(L, hue) * clamp(percent, 0, 1), familyChromaLimits[roleId]),
        h: hue,
      });
      seeds[roleId] = { seed: drawn.hex, source: 'generated', locked: false };
      if (drawn.gamutReduced) {
        diagnostics.push({
          code: 'SEMANTIC_GAMUT_REDUCTION',
          severity: 'warning',
          path: `roles.${roleId}.seed`,
          foreground: drawn.hex,
          background: null,
          actual: null,
          required: null,
          requestedChroma: drawn.requestedChroma,
          actualChroma: drawn.actualChroma,
        });
      }
    }
    return { seeds, diagnostics };
  }

  // --- Orchestrator ----------------------------------------------------------

  // Returns one atomic proposal. Does not mutate currentState. Invalid input
  // returns { error } without changing anything. Generation-time conflicts that
  // cannot be solved (a locked Context that fails) return a proposal whose
  // status is 'needs-attention' with an explicit diagnostic.
  function generateSystem({ currentState = {}, options = {}, randomSource }) {
    const characterId = options.characterId || 'balanced';
    const character = CHARACTERS[characterId];
    if (!character) {
      return { error: { code: 'UNKNOWN_CHARACTER', field: 'characterId', message: `Unknown color character: ${characterId}` } };
    }
    if (!SECONDARY_STRATEGIES.includes(options.secondaryStrategy || 'none')) {
      return { error: { code: 'UNKNOWN_SECONDARY_STRATEGY', field: 'secondaryStrategy', message: `Unknown Secondary strategy: ${options.secondaryStrategy}` } };
    }
    if (!['generated', 'hex', 'keep'].includes(options.brandSource || 'generated')) {
      return { error: { code: 'UNKNOWN_BRAND_SOURCE', field: 'brandSource', message: `Unknown Brand source: ${options.brandSource}` } };
    }
    let brandHex = null;
    if (options.brandSource === 'hex') {
      if (!options.brandHex) {
        return { error: { code: 'MISSING_BRAND_HEX', field: 'brandHex', message: 'Brand HEX is required when the Brand source is HEX' } };
      }
      brandHex = normalizeHex(options.brandHex);
      if (!brandHex) {
        return { error: { code: 'INVALID_BRAND_HEX', field: 'brandHex', message: `Invalid Brand HEX: ${options.brandHex}` } };
      }
    }

    const random = randomSource || createRandom(options.randomSeed || 1);
    const diagnostics = [];
    const contextResult = generateContext(currentState, character, random);
    diagnostics.push(...contextResult.diagnostics);
    const context = contextResult.context;

    const brand = generateBrand(currentState, options, character, random);
    if (brand.gamutReduced) {
      diagnostics.push({
        code: 'BRAND_GAMUT_REDUCTION',
        severity: 'warning',
        path: 'roles.brand.seed',
        foreground: brand.seed,
        background: null,
        actual: null,
        required: null,
        requestedChroma: brand.requestedChroma,
        actualChroma: brand.actualChroma,
      });
    }
    const neutral = generateNeutral(currentState, brand.seed, character, random);
    const secondary = generateSecondary(currentState, brand.seed, options.secondaryStrategy || 'none', random);
    const semantic = generateSemanticBatch(currentState, brand.seed, character, random);
    diagnostics.push(...semantic.diagnostics);

    const roles = {
      brand: { enabled: true, seed: brand.seed, locked: brand.locked },
      neutral: { enabled: true, seed: neutral.seed, temperature: neutral.temperature, locked: neutral.locked },
      secondary: {
        enabled: secondary.enabled,
        seed: secondary.seed,
        strategy: secondary.strategy,
        locked: secondary.locked,
      },
      regular: { aliasOf: 'neutral' },
      success: { enabled: true, seed: semantic.seeds.success.seed, locked: semantic.seeds.success.locked },
      warning: { enabled: true, seed: semantic.seeds.warning.seed, locked: semantic.seeds.warning.locked },
      danger: { enabled: true, seed: semantic.seeds.danger.seed, locked: semantic.seeds.danger.locked },
      information: { enabled: true, seed: semantic.seeds.information.seed, locked: semantic.seeds.information.locked },
    };

    const hasErrors = diagnostics.some(diagnostic => diagnostic.severity === 'error');

    // Phase 3 pipeline: reference palettes, role assignments, and the website
    // token resolution are built from the seed proposal. Resolution and
    // validation are pure; the current state is never mutated.
    const assemble = seedRoles => {
      const palettes = {};
      const paletteRoles = Object.keys(seedRoles).filter(roleId => seedRoles[roleId].seed && seedRoles[roleId].enabled !== false);
      for (const roleId of paletteRoles) {
        palettes[roleId] = window.ColorEngine.makePalette(seedRoles[roleId].seed, { family: roleId });
      }
      const target = Number(currentState.target) || 4.5;
      const assignments = window.ColorRoleModel.resolveAssignments(palettes, seedRoles, target);
      const websiteTokens = window.WebsiteTokenContract.resolveWebsiteTokens({
        palettes,
        roles: seedRoles,
        assignments,
        targetProfileId: options.targetProfileId || 'aa-interface',
        context,
      });
      const validation = window.WebsiteTokenContract.summarize(websiteTokens);
      const combinedDiagnostics = [
        ...diagnostics,
        ...websiteTokens.light.diagnostics,
        ...websiteTokens.dark.diagnostics,
      ];
      return { palettes, assignments, websiteTokens, validation, combinedDiagnostics, target };
    };

    // Stage 7 bounded repair: when required relationships fail and the Brand is
    // generated (never locked or provided), redraw Brand within its character
    // bounds with a darkening bias so the darkest palette steps can carry the
    // focus rings. Stops after an explicit maximum attempt count and returns
    // the best proposal plus unresolved diagnostics.
    const MAX_REPAIR_ATTEMPTS = 6;
    const brandIsRepairable = () =>
      brand.source === 'generated'
      && !['hex', 'keep'].includes(options.brandSource || 'generated');

    let repairAttempts = 0;
    let assembled = assemble(roles);
    while (assembled.validation.status === 'needs-attention' && brandIsRepairable() && repairAttempts < MAX_REPAIR_ATTEMPTS) {
      repairAttempts += 1;
      const repairedBrand = generateBrand(currentState, options, character, random, repairAttempts);
      roles.brand = { enabled: true, seed: repairedBrand.seed, locked: false };
      assembled = assemble(roles);
    }
    if (repairAttempts > 0) {
      diagnostics.push({
        code: 'GENERATED_SEED_REPAIRED',
        severity: 'warning',
        theme: null,
        path: 'roles.brand.seed',
        foreground: null,
        background: null,
        actual: null,
        required: null,
        attemptedSteps: Array.from({ length: repairAttempts }, (_, index) => index + 1),
        recovery: 'The generated Brand lightness was adjusted so focus rings reach 3:1',
      });
    }
    if (repairAttempts >= MAX_REPAIR_ATTEMPTS && assembled.validation.status === 'needs-attention') {
      diagnostics.push({
        code: 'BOUNDED_REPAIR_EXHAUSTED',
        severity: 'error',
        theme: null,
        path: 'roles.brand.seed',
        foreground: null,
        background: null,
        actual: null,
        required: null,
        attemptedSteps: Array.from({ length: MAX_REPAIR_ATTEMPTS }, (_, index) => index + 1),
        recovery: 'Unlock a role or change the Brand seed',
      });
    }

    const { palettes, assignments, websiteTokens, validation, target } = assembled;
    // Rebuild the combined diagnostics after repair, so repair warnings and
    // per-theme resolution diagnostics are all observable in the proposal.
    const combinedDiagnostics = [
      ...diagnostics,
      ...websiteTokens.light.diagnostics,
      ...websiteTokens.dark.diagnostics,
    ];
    const hasWarnings = combinedDiagnostics.some(diagnostic => diagnostic.severity === 'warning')
      || validation.warnings.length > 0;
    const finalStatus = validation.status === 'needs-attention' ? 'needs-attention'
      : validation.status === 'ready-with-warnings' ? 'ready-with-warnings'
      : hasErrors ? 'needs-attention'
      : hasWarnings ? 'ready-with-warnings'
      : 'ready';

    return {
      proposal: {
        mode: 'quick-start',
        generation: {
          characterId,
          brandSource: options.brandSource || 'generated',
          secondaryStrategy: secondary.strategy,
          randomSeed: options.randomSeed || 1,
          revision: options.revision || 1,
          repairAttempts,
          status: finalStatus,
          diagnostics: combinedDiagnostics.filter(diagnostic => diagnostic.severity === 'error'),
        },
        context,
        targetProfileId: websiteTokens.targetProfileId,
        advancedPairTarget: target,
        activeRole: 'brand',
        roles,
        palettes: Object.fromEntries(
          Object.entries(palettes).map(([roleId, palette]) => [roleId, { scale: palette.scale.map(token => ({ step: token.step, hex: token.hex })) }])
        ),
        assignments,
        websiteTokens: {
          targetProfileId: websiteTokens.targetProfileId,
          light: { values: websiteTokens.light.values },
          dark: { values: websiteTokens.dark.values },
        },
        validation,
        savedPairs: [],
        diagnostics: combinedDiagnostics,
      },
      validation: {
        status: finalStatus,
        requiredFailures: validation.requiredFailures,
        warnings: [...validation.warnings, ...combinedDiagnostics.filter(diagnostic => diagnostic.severity === 'warning')],
      },
      diagnostics: combinedDiagnostics,
    };
  }

  window.SystemGenerator = Object.freeze({
    CHARACTERS,
    SECONDARY_STRATEGIES,
    SEMANTIC_ROLES,
    createRandom,
    generateContext,
    generateBrand,
    generateNeutral,
    generateSecondary,
    generateSemanticBatch,
    generateSystem,
  });
})();
