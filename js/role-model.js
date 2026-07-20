(() => {
  'use strict';

  const { clamp, hexToOklch, mapOklchToSrgb, normalizeHue, familyChromaLimits } = window.ColorEngine;

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
      description: '核心识别色，用于主要操作与品牌强调。',
      paletteOwner: true,
      required: true,
    }),
    neutral: Object.freeze({
      label: 'Neutral',
      description: '正文、边框、surface 与默认组件的基础颜色。',
      paletteOwner: true,
      required: true,
    }),
    secondary: Object.freeze({
      label: 'Secondary',
      description: '可选的第二强调色；只有明确用途时才启用。',
      paletteOwner: true,
      required: false,
    }),
    regular: Object.freeze({
      label: 'Regular',
      description: '默认、非关键、没有明确状态倾向；直接复用 Neutral。',
      paletteOwner: false,
      aliasOf: 'neutral',
      required: true,
    }),
    success: Object.freeze({
      label: 'Success',
      description: '任务或流程成功完成。',
      paletteOwner: true,
      required: true,
      semanticHue: 145,
    }),
    warning: Object.freeze({
      label: 'Warning',
      description: '存在潜在风险，用户仍可继续，但后续可能遇到问题。',
      paletteOwner: true,
      required: true,
      semanticHue: 80,
    }),
    danger: Object.freeze({
      label: 'Danger',
      description: '需要立即处理的严重错误，问题解决前通常无法继续。',
      paletteOwner: true,
      required: true,
      semanticHue: 27,
    }),
    information: Object.freeze({
      label: 'Information',
      description: '需要关注的补充信息或进行中状态。',
      paletteOwner: true,
      required: true,
      semanticHue: 245,
    }),
  });

  const secondaryStrategies = Object.freeze({
    none: Object.freeze({ label: '不使用', offsets: Object.freeze([]) }),
    analogous: Object.freeze({ label: '近似色', offsets: Object.freeze([-34, 34, 62]) }),
    contrasting: Object.freeze({ label: '对比色', offsets: Object.freeze([180, 150, 210]) }),
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

  function makeSecondarySuggestions(brandHex, strategy = 'analogous') {
    const definition = secondaryStrategies[strategy];
    if (!definition) throw new Error(`Unknown Secondary strategy: ${strategy}`);
    if (strategy === 'none') return [];
    const brand = hexToOklch(brandHex);
    return definition.offsets.map((offset, index) => ({
      id: `${strategy}-${index + 1}`,
      label: `${definition.label} ${index + 1}`,
      strategy,
      hex: suggestedHex({
        L: clamp(brand.L, 0.50, 0.72),
        C: clamp(brand.C * (index === 0 ? 0.92 : 0.82), 0.07, familyChromaLimits.secondary),
        h: normalizeHue(brand.h + offset),
      }),
    }));
  }

  function makeSemanticSuggestion(roleId, brandHex) {
    const definition = roles[roleId];
    if (!semanticRoleIds.includes(roleId)) throw new Error(`Role has no semantic hue family: ${roleId}`);
    const brand = hexToOklch(brandHex);
    const familyLimit = familyChromaLimits[roleId];
    const chromaFloor = roleId === 'warning' ? 0.12 : 0.10;
    const lightnessShift = roleId === 'warning' ? 0.05 : 0;
    const requested = {
      L: clamp(brand.L + lightnessShift, 0.54, 0.72),
      C: clamp(brand.C * 0.90, chromaFloor, familyLimit),
      h: definition.semanticHue,
    };
    const mapped = mapOklchToSrgb(requested);
    return {
      id: roleId,
      label: definition.label,
      roleId,
      hex: mapped.hex,
      semanticHue: definition.semanticHue,
      gamutReduced: mapped.reduced,
    };
  }

  function makeSemanticSuggestions(brandHex) {
    return Object.fromEntries(semanticRoleIds.map(roleId => [roleId, makeSemanticSuggestion(roleId, brandHex)]));
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
    createInitialRoles,
    resolveAssignment,
    resolveAssignments,
  });
})();
