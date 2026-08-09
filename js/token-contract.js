// Website token contract: generic website token definitions, target profiles,
// and relationship definitions. Pure module: no DOM access, no generation policy.
//
// Ownership: docs/website-token-contract.md is the accepted decision document.
// This file makes those decisions machine-checkable. Website-token resolution
// and CSS/JSON/Tailwind serialization are added in later phases.
(() => {
  'use strict';

  const FEEDBACK_ROLES = ['success', 'warning', 'danger', 'information'];

  // Group -> tokens. The `id` is the canonical dotted path used in diagnostics
  // and JSON traceability; `css` is the theme-stable CSS custom property name.
  const TOKEN_GROUPS = {
    surfaces: [
      { id: 'surface.page', css: '--surface-page' },
      { id: 'surface.raised', css: '--surface-raised' },
      { id: 'surface.sunken', css: '--surface-sunken' },
      { id: 'surface.overlay', css: '--surface-overlay' },
    ],
    content: [
      { id: 'content.primary', css: '--content-primary' },
      { id: 'content.secondary', css: '--content-secondary' },
      { id: 'content.muted', css: '--content-muted' },
      { id: 'content.link', css: '--content-link' },
      { id: 'content.linkHover', css: '--content-link-hover' },
      { id: 'content.inverse', css: '--content-inverse' },
    ],
    'borders-and-focus': [
      { id: 'border.default', css: '--border-default' },
      { id: 'border.strong', css: '--border-strong' },
      { id: 'focus.ring', css: '--focus-ring' },
      { id: 'focus.ringDangerContext', css: '--focus-ring-danger-context' },
    ],
    'action-primary': [
      { id: 'action.primary.background', css: '--action-primary-background' },
      { id: 'action.primary.foreground', css: '--action-primary-foreground' },
      { id: 'action.primary.hover', css: '--action-primary-background-hover' },
      { id: 'action.primary.pressed', css: '--action-primary-background-pressed' },
      { id: 'action.primary.focusRing', css: '--action-primary-focus-ring' },
    ],
    'action-secondary': [
      { id: 'action.secondary.background', css: '--action-secondary-background' },
      { id: 'action.secondary.foreground', css: '--action-secondary-foreground' },
      { id: 'action.secondary.border', css: '--action-secondary-border' },
      { id: 'action.secondary.hover', css: '--action-secondary-background-hover' },
      { id: 'action.secondary.pressed', css: '--action-secondary-background-pressed' },
      { id: 'action.secondary.focusRing', css: '--action-secondary-focus-ring' },
    ],
    'action-destructive': [
      { id: 'action.destructive.background', css: '--action-destructive-background' },
      { id: 'action.destructive.foreground', css: '--action-destructive-foreground' },
      { id: 'action.destructive.hover', css: '--action-destructive-background-hover' },
      { id: 'action.destructive.pressed', css: '--action-destructive-background-pressed' },
      { id: 'action.destructive.focusRing', css: '--action-destructive-focus-ring' },
    ],
    fields: [
      { id: 'field.background', css: '--field-background' },
      { id: 'field.text', css: '--field-text' },
      { id: 'field.placeholder', css: '--field-placeholder' },
      { id: 'field.border', css: '--field-border' },
      { id: 'field.borderFocus', css: '--field-border-focus' },
      { id: 'field.borderInvalid', css: '--field-border-invalid' },
      { id: 'field.helperInvalid', css: '--field-helper-invalid' },
      { id: 'field.focusRing', css: '--field-focus-ring' },
    ],
    feedback: FEEDBACK_ROLES.flatMap(role => [
      { id: `feedback.${role}.surface`, css: `--feedback-${role}-surface` },
      { id: `feedback.${role}.border`, css: `--feedback-${role}-border` },
      { id: `feedback.${role}.icon`, css: `--feedback-${role}-icon` },
      { id: `feedback.${role}.text`, css: `--feedback-${role}-text` },
      { id: `feedback.${role}.bold`, css: `--feedback-${role}-bold` },
      { id: `feedback.${role}.onBold`, css: `--feedback-${role}-on-bold` },
    ]),
    accent: [
      { id: 'accent.secondary.surface', css: '--accent-secondary-surface' },
      { id: 'accent.secondary.border', css: '--accent-secondary-border' },
      { id: 'accent.secondary.text', css: '--accent-secondary-text' },
    ],
  };

  // Required tokens resolve for every generated system; accent tokens resolve
  // only when Secondary is enabled.
  const REQUIRED_GROUPS = [
    'surfaces', 'content', 'borders-and-focus',
    'action-primary', 'action-secondary', 'action-destructive',
    'fields', 'feedback',
  ];
  const ACCENT_GROUPS = ['accent'];

  // Target profiles: text ratios are raised by profile; non-text stays 3:1.
  // `aa-interface` is the default profile for generated website systems.
  const TARGET_PROFILES = {
    'aa-interface': { normalText: 4.5, largeText: 3, nonText: 3 },
    'aaa-interface': { normalText: 7, largeText: 4.5, nonText: 3 },
  };

  const TEXT_TARGET = 'normalText';
  const LARGE_TARGET = 'largeText';
  const NON_TEXT_TARGET = 'nonText';

  // Every required token must be covered by at least one relationship.
  // `target` selects the applicable ratio inside the active target profile.
  const RELATIONSHIPS = [
    {
      id: 'TEXT_ON_SURFACE',
      target: TEXT_TARGET,
      severity: 'required',
      tokens: [
        'content.primary', 'content.secondary', 'content.muted',
        'content.link', 'content.linkHover', 'content.inverse',
        'field.text', 'field.placeholder', 'field.helperInvalid',
        ...FEEDBACK_ROLES.flatMap(role => [`feedback.${role}.text`, `feedback.${role}.onBold`]),
        'accent.secondary.text',
      ],
      notes: 'Text foregrounds are measured against their resolved surface; links and status text take the least contrast that passes so the hue stays recognizable.',
    },
    {
      id: 'LARGE_TEXT_ON_SURFACE',
      target: LARGE_TARGET,
      severity: 'required',
      tokens: [],
      notes: 'Explicitly large display text uses the large-text ratio, never the blanket non-text target. Tagged at resolution time.',
    },
    {
      id: 'SURFACE_CARRIES_CONTENT',
      target: TEXT_TARGET,
      severity: 'required',
      tokens: [
        'surface.page', 'surface.raised', 'surface.sunken', 'surface.overlay',
        'action.primary.background', 'action.secondary.background', 'action.destructive.background',
        'field.background',
        'accent.secondary.surface',
        ...FEEDBACK_ROLES.flatMap(role => [`feedback.${role}.surface`, `feedback.${role}.bold`]),
      ],
      notes: 'Surfaces and fills are the measured backgrounds for adjacent content; text uses the text target and indicators use the non-text target at resolution time.',
    },
    {
      id: 'ACTION_FOREGROUND_ACROSS_STATES',
      target: TEXT_TARGET,
      severity: 'required',
      tokens: [
        'action.primary.foreground', 'action.secondary.foreground',
        'action.destructive.foreground',
      ],
      notes: 'Interactive foreground is selected against Default and held stable across Hover and Pressed.',
    },
    {
      id: 'NON_TEXT_INDICATOR_ON_SURFACE',
      target: NON_TEXT_TARGET,
      severity: 'required',
      tokens: [
        'border.default', 'border.strong',
        'field.border', 'field.borderFocus', 'field.borderInvalid',
        'action.secondary.border',
        ...FEEDBACK_ROLES.flatMap(role => [`feedback.${role}.border`, `feedback.${role}.icon`]),
        'accent.secondary.border',
      ],
      notes: 'Meaningful borders, icons, and semantic indicators meet 3:1 against the adjacent surface.',
    },
    {
      id: 'FOCUS_RING_ON_SURFACE',
      target: NON_TEXT_TARGET,
      severity: 'required',
      tokens: [
        'focus.ring', 'focus.ringDangerContext',
        'action.primary.focusRing', 'action.secondary.focusRing', 'action.destructive.focusRing',
        'field.focusRing',
      ],
      notes: 'Focus rings reach 3:1 against every adjacent surface they touch.',
    },
    {
      id: 'ACTION_BACKGROUND_STATES',
      target: TEXT_TARGET,
      severity: 'required',
      tokens: [
        'action.primary.hover', 'action.primary.pressed',
        'action.secondary.hover', 'action.secondary.pressed',
        'action.destructive.hover', 'action.destructive.pressed',
      ],
      notes: 'Hover and Pressed background states keep the held foreground passing; they search bounded candidates and are not accepted merely for being adjacent steps.',
    },
    {
      id: 'CONTEXT_TEXT_ON_BACKGROUND',
      target: TEXT_TARGET,
      severity: 'required',
      tokens: [],
      special: 'context',
      notes: 'Context Text on Background must pass 4.5:1 before generation continues.',
    },
    {
      id: 'DISABLED_CONTENT',
      target: null,
      severity: 'advisory',
      tokens: [],
      notes: 'Disabled content is measured and reported; it is never labeled PASS through an exemption.',
    },
  ];

  function allTokens() {
    return Object.values(TOKEN_GROUPS).flat();
  }

  function tokenById(id) {
    return allTokens().find(token => token.id === id) || null;
  }

  function validateContract(contract) {
    const errors = [];
    const { tokenGroups, targetProfiles, relationships, feedbackRoles } = contract;

    if (!tokenGroups || typeof tokenGroups !== 'object' || Array.isArray(tokenGroups)) {
      errors.push('tokenGroups must be an object of arrays');
      return { ok: false, errors };
    }
    const seenIds = new Set();
    const seenCss = new Set();
    for (const [group, tokens] of Object.entries(tokenGroups)) {
      if (!Array.isArray(tokens)) {
        errors.push(`group "${group}" must be an array`);
        continue;
      }
      for (const token of tokens) {
        if (!token || typeof token.id !== 'string' || !token.id) errors.push(`group "${group}" contains a token without an id`);
        if (!token || typeof token.css !== 'string' || !/^--[a-z0-9-]+$/.test(token.css)) errors.push(`token ${token?.id || '(no id)'} has an invalid css name "${token?.css}"`);
        if (token.id) {
          if (seenIds.has(token.id)) errors.push(`duplicate token id "${token.id}"`);
          seenIds.add(token.id);
        }
        if (token.css) {
          if (seenCss.has(token.css)) errors.push(`duplicate css name "${token.css}"`);
          seenCss.add(token.css);
        }
      }
    }

    if (!targetProfiles || typeof targetProfiles !== 'object' || Array.isArray(targetProfiles)) {
      errors.push('targetProfiles must be an object');
    } else {
      for (const [profileId, profile] of Object.entries(targetProfiles)) {
        for (const key of ['normalText', 'largeText', 'nonText']) {
          const value = profile?.[key];
          if (typeof value !== 'number' || !Number.isFinite(value) || value <= 1) {
            errors.push(`profile "${profileId}" has an invalid ${key} threshold: ${value}`);
          }
        }
        if (profile && !(profile.normalText > profile.largeText && profile.largeText >= profile.nonText && profile.nonText >= 3)) {
          errors.push(`profile "${profileId}" thresholds violate the text >= large >= non-text ordering`);
        }
      }
    }

    if (!Array.isArray(relationships)) {
      errors.push('relationships must be an array');
      return { ok: false, errors };
    }
    const covered = new Set();
    for (const relationship of relationships) {
      if (!relationship || typeof relationship.id !== 'string' || !relationship.id) {
        errors.push('relationship without an id');
        continue;
      }
      if (!['required', 'advisory'].includes(relationship.severity)) {
        errors.push(`relationship "${relationship.id}" has invalid severity "${relationship.severity}"`);
      }
      if (relationship.target !== null && !['normalText', 'largeText', 'nonText'].includes(relationship.target)) {
        errors.push(`relationship "${relationship.id}" has invalid target "${relationship.target}"`);
      }
      if (relationship.severity === 'required' && relationship.target === null && !relationship.special) {
        errors.push(`required relationship "${relationship.id}" must name a target or be special`);
      }
      if (!Array.isArray(relationship.tokens)) {
        errors.push(`relationship "${relationship.id}" tokens must be an array`);
        continue;
      }
      for (const tokenId of relationship.tokens) {
        if (!seenIds.has(tokenId)) errors.push(`relationship "${relationship.id}" references unknown token "${tokenId}"`);
        else covered.add(tokenId);
      }
    }

    for (const id of seenIds) {
      if (!covered.has(id)) {
        errors.push(`required token "${id}" has no relationship check`);
      }
    }

    if (!Array.isArray(feedbackRoles) || feedbackRoles.length === 0) {
      errors.push('feedbackRoles must be a non-empty array');
    }

    return { ok: errors.length === 0, errors };
  }

  const contract = {
    feedbackRoles: FEEDBACK_ROLES,
    tokenGroups: TOKEN_GROUPS,
    requiredGroups: REQUIRED_GROUPS,
    accentGroups: ACCENT_GROUPS,
    targetProfiles: TARGET_PROFILES,
    relationships: RELATIONSHIPS,
  };

  // --- Website-token resolution -----------------------------------------------
  //
  // Resolves the generic website token contract from existing palettes and role
  // assignments, independently for Light and Dark. Each resolved value carries
  // traceability; each resolved relationship check records the surface it was
  // measured against, so validation is evidence-based rather than inferred from
  // token numbers.

  const HOVER_CANDIDATES = Object.freeze({
    // White/mid ink (brand, danger): darken toward the dark end of the scale.
    'light-chromatic': [700, 800, 900, 600, 500, 400],
    'dark-chromatic': [300, 200, 500, 400, 100],
    // Near-black ink on the neutral quiet fill: stay in the mid-grey range so
    // the pressed state does not melt into the ink.
    'light-neutral': [300, 400, 500, 200, 600],
    'dark-neutral': [500, 600, 700, 400, 800],
  });
  const PRESSED_CANDIDATES = Object.freeze({
    'light-chromatic': [800, 900, 950, 700, 600],
    'dark-chromatic': [400, 300, 200, 500, 100],
    'light-neutral': [400, 500, 600, 300, 700],
    'dark-neutral': [900, 950, 800, 700, 600],
  });
  const FOCUS_CANDIDATES = Object.freeze({
    light: [600, 700, 800, 500, 400, 300],
    dark: [400, 300, 200, 500, 600, 700],
  });

  function stepHex(palettes, roleId, step) {
    const palette = palettes[roleId];
    if (!palette) throw new Error(`Palette for role "${roleId}" is missing`);
    const token = palette.scale.find(item => item.step === step);
    if (!token) throw new Error(`Palette "${roleId}" is missing step ${step}`);
    return token.hex;
  }

  function measuredInk(fillHex) {
    return { hex: window.ColorEngine.textColor(fillHex), sourceKind: 'measured-ink' };
  }

  // The role assignment table supplies the accepted subtle / borderIcon / bold /
  // onBold coordinates per role and theme. Website tokens project those onto
  // component intent and re-verify the measured result.
  function assignmentFor(assignments, roleId, theme) {
    if (roleId === 'regular') roleId = 'neutral';
    const table = assignments[roleId];
    if (!table || !table[theme]) throw new Error(`Assignment for "${roleId}" ${theme} is missing`);
    return table[theme];
  }

  // Bounded state-family search: hover and pressed backgrounds must keep the
  // held ink passing. Candidates are searched in preference order; adjacency to
  // the default is a preference, never an acceptance criterion. The candidate
  // family depends on the ink: chromatic actions hold a light ink and darken;
  // the neutral quiet action holds near-black ink and must stay mid-grey.
  function stateFamilySearch(palettes, roleId, theme, inkHex, defaultStep, target, generatedBy, values, checks, diagnostics, candidateKey) {
    const candidates = HOVER_CANDIDATES[candidateKey] || [];
    const pressedCandidates = PRESSED_CANDIDATES[candidateKey] || [];
    const states = {};
    for (const [state, list] of [['hover', candidates], ['pressed', pressedCandidates]]) {
      const attempts = [];
      let chosen = null;
      let best = null;
      for (const step of list) {
        const hex = stepHex(palettes, roleId, step);
        const ratio = window.ColorEngine.contrast(inkHex, hex);
        attempts.push(step);
        if (!best || ratio > best.ratio) best = { step, hex, ratio };
        if (ratio >= target) {
          chosen = { step, hex, ratio };
          break;
        }
      }
      const tokenId = `${generatedBy}.${state}`;
      if (!chosen) {
        // Bounded search fell back to the best-measured candidate. The value is
        // recorded so the token set stays inspectable; the diagnostic keeps the
        // failure visible instead of silently accepting a below-target state.
        chosen = best;
        diagnostics.push({
          code: `${generatedBy.toUpperCase().replace(/\./g, '_')}_INK_CONTRAST`,
          severity: 'error',
          theme,
          path: tokenId,
          foreground: inkHex,
          background: chosen ? chosen.hex : null,
          actual: chosen ? chosen.ratio : null,
          required: target,
          sourceRole: roleId,
          attemptedSteps: attempts,
          recovery: 'Unlock the role or adjust the held ink',
        });
      }
      if (!chosen) continue;
      values[tokenId] = {
        hex: chosen.hex,
        sourceRole: roleId,
        sourceStep: chosen.step,
        sourceKind: 'palette-token',
        generatedBy,
        locked: false,
      };
      checks.push({
        tokenId,
        relationshipId: 'ACTION_BACKGROUND_STATES',
        foreground: inkHex,
        background: chosen.hex,
        backgroundTokenId: tokenId,
        target: 'normalText',
      });
    }
    return states;
  }

  // Focus ring search: a brand step must reach 3:1 against every adjacent
  // surface it touches. If no candidate passes, the search reports the
  // attempted coordinates instead of silently weakening the requirement.
  function focusRingSearch(palettes, roleId, theme, adjacentSurfaces, generatedBy, values, checks, diagnostics, tokenId, target) {
    const candidates = theme === 'dark' ? FOCUS_CANDIDATES.dark : FOCUS_CANDIDATES.light;
    const attempts = [];
    let best = null;
    for (const step of candidates) {
      const hex = stepHex(palettes, roleId, step);
      const weakest = Math.min(...adjacentSurfaces.map(surface => window.ColorEngine.contrast(hex, surface)));
      attempts.push(step);
      if (!best || weakest > best.weakest) best = { step, hex, weakest };
      if (weakest >= target) {
        values[tokenId] = {
          hex,
          sourceRole: roleId,
          sourceStep: step,
          sourceKind: 'palette-token',
          generatedBy,
          locked: false,
        };
        for (const surface of adjacentSurfaces) {
          checks.push({
            tokenId,
            relationshipId: 'FOCUS_RING_ON_SURFACE',
            foreground: hex,
            background: surface,
            backgroundTokenId: tokenId,
            target: 'nonText',
          });
        }
        return hex;
      }
    }
    if (best) {
      values[tokenId] = {
        hex: best.hex,
        sourceRole: roleId,
        sourceStep: best.step,
        sourceKind: 'palette-token',
        generatedBy,
        locked: false,
      };
      for (const surface of adjacentSurfaces) {
        checks.push({
          tokenId,
          relationshipId: 'FOCUS_RING_ON_SURFACE',
          foreground: best.hex,
          background: surface,
          backgroundTokenId: tokenId,
          target: 'nonText',
        });
      }
    }
    diagnostics.push({
      code: 'FOCUS_RING_ON_SURFACE',
      severity: 'error',
      theme,
      path: tokenId,
      foreground: best ? best.hex : null,
      background: null,
      actual: best ? best.weakest : null,
      required: target,
      sourceRole: roleId,
      attemptedSteps: attempts,
      recovery: 'Unlock the role or change the Brand seed',
    });
    return best ? best.hex : null;
  }

  // Field borders must reach 3:1 against the field background, which sits one
  // step lighter (light theme) or darker (dark theme) than the page. The role's
  // preferred coordinate is tried first; the bounded list is the fallback.
  const BORDER_CANDIDATES = Object.freeze({
    brand: Object.freeze({ light: [600, 700, 500, 800, 400], dark: [300, 200, 400, 500, 100] }),
    danger: Object.freeze({ light: [500, 600, 400, 700, 300], dark: [300, 400, 200, 500, 100] }),
  });

  function borderSearch(palettes, roleId, theme, surface, generatedBy, values, checks, diagnostics, tokenId, target, preferredStep) {
    const list = BORDER_CANDIDATES[roleId] ? BORDER_CANDIDATES[roleId][theme] : [];
    const ordered = preferredStep ? [preferredStep, ...list.filter(step => step !== preferredStep)] : list;
    const attempts = [];
    let best = null;
    for (const step of ordered) {
      const hex = stepHex(palettes, roleId, step);
      const ratio = window.ColorEngine.contrast(hex, surface);
      attempts.push(step);
      if (!best || ratio > best.ratio) best = { step, hex, ratio };
      if (ratio >= target) {
        values[tokenId] = {
          hex,
          sourceRole: roleId,
          sourceStep: step,
          sourceKind: 'palette-token',
          generatedBy,
          locked: false,
        };
        checks.push({ tokenId, relationshipId: 'NON_TEXT_INDICATOR_ON_SURFACE', foreground: hex, background: surface, backgroundTokenId: tokenId, target: 'nonText' });
        return hex;
      }
    }
    if (best) {
      values[tokenId] = {
        hex: best.hex,
        sourceRole: roleId,
        sourceStep: best.step,
        sourceKind: 'palette-token',
        generatedBy,
        locked: false,
      };
      checks.push({ tokenId, relationshipId: 'NON_TEXT_INDICATOR_ON_SURFACE', foreground: best.hex, background: surface, backgroundTokenId: tokenId, target: 'nonText' });
    }
    diagnostics.push({
      code: 'FIELD_BORDER_ON_FIELD',
      severity: 'error',
      theme,
      path: tokenId,
      foreground: best ? best.hex : null,
      background: surface,
      actual: best ? best.ratio : null,
      required: target,
      sourceRole: roleId,
      attemptedSteps: attempts,
      recovery: 'Unlock the role or change the seed',
    });
    return best ? best.hex : null;
  }

  function resolveTheme(theme, { palettes, roles, assignments, targetProfileId }) {
    const profile = TARGET_PROFILES[targetProfileId] || TARGET_PROFILES['aa-interface'];
    const textTarget = profile.normalText;
    const nonTextTarget = profile.nonText;
    const dark = theme === 'dark';
    const values = {};
    const checks = [];
    const diagnostics = [];

    const neutralAssignment = assignmentFor(assignments, 'neutral', theme);
    const page = neutralAssignment.subtle.hex;
    const raised = stepHex(palettes, 'neutral', dark ? 950 : 50);
    const sunken = stepHex(palettes, 'neutral', dark ? 800 : 200);
    const overlay = stepHex(palettes, 'neutral', 950);

    const record = (tokenId, hex, sourceRole, sourceStep, sourceKind, generatedBy, locked = false) => {
      values[tokenId] = { hex, sourceRole, sourceStep, sourceKind, generatedBy, locked };
      return hex;
    };
    const textCheck = (tokenId, foregroundHex, backgroundHex, relationshipId = 'TEXT_ON_SURFACE') => {
      checks.push({ tokenId, relationshipId, foreground: foregroundHex, background: backgroundHex, backgroundTokenId: null, target: 'normalText' });
    };
    const nonTextCheck = (tokenId, foregroundHex, backgroundHex, relationshipId = 'NON_TEXT_INDICATOR_ON_SURFACE') => {
      checks.push({ tokenId, relationshipId, foreground: foregroundHex, background: backgroundHex, backgroundTokenId: null, target: 'nonText' });
    };

    // Bounded repair for text tokens: search the palette for a passing step;
    // when none exists, fall back to measured ink rather than accepting a
    // below-target token. The fallback records a warning, never a silent PASS.
    const resolveText = (tokenId, roleId, palette, backgroundHex, mode) => {
      const token = window.ColorRoleModel.foregroundToken(palette, backgroundHex, textTarget, mode);
      if (token.pass) {
        record(tokenId, token.hex, roleId, token.step, 'palette-token', tokenId);
        textCheck(tokenId, token.hex, backgroundHex);
        return token.hex;
      }
      const ink = window.ColorEngine.textColor(backgroundHex);
      record(tokenId, ink, roleId, null, 'measured-ink', tokenId);
      textCheck(tokenId, ink, backgroundHex);
      diagnostics.push({
        code: 'ASSIGNMENT_INK_FALLBACK',
        severity: 'warning',
        theme,
        path: tokenId,
        foreground: ink,
        background: backgroundHex,
        actual: window.ColorEngine.contrast(ink, backgroundHex),
        required: textTarget,
        sourceRole: roleId,
        attemptedSteps: [],
        recovery: 'Choose another step or adjust the assignment Lightness',
      });
      return ink;
    };

    // Surfaces
    record('surface.page', page, 'neutral', neutralAssignment.subtle.step, 'palette-token', 'surface.page');
    record('surface.raised', raised, 'neutral', dark ? 950 : 50, 'palette-token', 'surface.raised');
    record('surface.sunken', sunken, 'neutral', dark ? 800 : 200, 'palette-token', 'surface.sunken');
    record('surface.overlay', overlay, 'neutral', 950, 'palette-token', 'surface.overlay');
    const surfaceHexes = [page, raised, sunken, overlay];

    // Content
    const neutralPalette = palettes.neutral;
    const primary = dark ? stepHex(palettes, 'neutral', 50) : stepHex(palettes, 'neutral', 950);
    record('content.primary', primary, 'neutral', dark ? 50 : 950, 'palette-token', 'content.primary');
    textCheck('content.primary', primary, page);

    const secondary = dark ? stepHex(palettes, 'neutral', 100) : stepHex(palettes, 'neutral', 900);
    record('content.secondary', secondary, 'neutral', dark ? 100 : 900, 'palette-token', 'content.secondary');
    textCheck('content.secondary', secondary, page);

    const muted = window.ColorRoleModel.foregroundToken(neutralPalette, page, textTarget, 'minPassing');
    if (muted.pass) {
      record('content.muted', muted.hex, 'neutral', muted.step, 'palette-token', 'content.muted');
      textCheck('content.muted', muted.hex, page);
    } else {
      resolveText('content.muted', 'neutral', neutralPalette, page, 'minPassing');
    }

    const link = window.ColorRoleModel.foregroundToken(palettes.brand, page, textTarget, 'minPassing');
    if (link.pass) {
      record('content.link', link.hex, 'brand', link.step, 'palette-token', 'content.link');
      textCheck('content.link', link.hex, page);
    } else {
      resolveText('content.link', 'brand', palettes.brand, page, 'minPassing');
    }

    const linkHover = window.ColorRoleModel.foregroundToken(palettes.brand, page, textTarget, 'maxContrast');
    if (linkHover.pass) {
      record('content.linkHover', linkHover.hex, 'brand', linkHover.step, 'palette-token', 'content.linkHover');
      textCheck('content.linkHover', linkHover.hex, page);
    } else {
      resolveText('content.linkHover', 'brand', palettes.brand, page, 'maxContrast');
    }

    const inverse = measuredInk(primary);
    record('content.inverse', inverse.hex, 'neutral', null, 'measured-ink', 'content.inverse');
    textCheck('content.inverse', inverse.hex, primary);

    // Borders and focus
    const borderDefault = neutralAssignment.borderIcon.hex;
    record('border.default', borderDefault, 'neutral', neutralAssignment.borderIcon.step, 'palette-token', 'border.default');
    nonTextCheck('border.default', borderDefault, page);

    const strongStep = dark ? 400 : 600;
    const borderStrong = stepHex(palettes, 'neutral', strongStep);
    record('border.strong', borderStrong, 'neutral', strongStep, 'palette-token', 'border.strong');
    nonTextCheck('border.strong', borderStrong, page);

    const brandAssignment = assignmentFor(assignments, 'brand', theme);
    // Focus rings and field borders sit on the surfaces controls actually touch:
    // the page, raised cards, sunken wells, and field fills. The overlay scrim is
    // behind all content and is never an adjacency for a ring.
    const fieldBackground = dark ? stepHex(palettes, 'neutral', 950) : stepHex(palettes, 'neutral', 50);
    record('field.background', fieldBackground, 'neutral', dark ? 950 : 50, 'palette-token', 'field.background');
    const ringSurfaces = [page, raised, sunken, fieldBackground];

    focusRingSearch(palettes, 'brand', theme, ringSurfaces, 'focus.ring', values, checks, diagnostics, 'focus.ring', nonTextTarget);
    // The Danger-context ring sits on the same control surfaces; the Danger
    // border lives inside the ring, so the ring's requirement is the same 3:1
    // against the surfaces it touches, never against the fill it surrounds.
    focusRingSearch(palettes, 'brand', theme, ringSurfaces, 'focus.ringDangerContext', values, checks, diagnostics, 'focus.ringDangerContext', nonTextTarget);

    // Primary action
    const brandBold = brandAssignment.bold;
    const primaryInk = brandAssignment.onBold;
    record('action.primary.background', brandBold.hex, 'brand', brandBold.step, 'palette-token', 'action.primary.background');
    record('action.primary.foreground', primaryInk.hex, 'brand', null, 'measured-ink', 'action.primary.foreground');
    textCheck('action.primary.foreground', primaryInk.hex, brandBold.hex, 'ACTION_FOREGROUND_ACROSS_STATES');
    stateFamilySearch(palettes, 'brand', theme, primaryInk.hex, brandBold.step, textTarget, 'action.primary', values, checks, diagnostics, dark ? 'dark-chromatic' : 'light-chromatic');
    focusRingSearch(palettes, 'brand', theme, ringSurfaces, 'action.primary.focusRing', values, checks, diagnostics, 'action.primary.focusRing', nonTextTarget);

    // Neutral secondary action
    const secondaryBackground = dark ? stepHex(palettes, 'neutral', 800) : stepHex(palettes, 'neutral', 200);
    const secondaryInk = dark ? stepHex(palettes, 'neutral', 50) : stepHex(palettes, 'neutral', 950);
    const secondaryBorder = neutralAssignment.borderIcon.hex;
    record('action.secondary.background', secondaryBackground, 'neutral', dark ? 800 : 200, 'palette-token', 'action.secondary.background');
    record('action.secondary.foreground', secondaryInk, 'neutral', dark ? 50 : 950, 'palette-token', 'action.secondary.foreground');
    record('action.secondary.border', secondaryBorder, 'neutral', neutralAssignment.borderIcon.step, 'palette-token', 'action.secondary.border');
    textCheck('action.secondary.foreground', secondaryInk, secondaryBackground, 'ACTION_FOREGROUND_ACROSS_STATES');
    nonTextCheck('action.secondary.border', secondaryBorder, page);
    stateFamilySearch(palettes, 'neutral', theme, secondaryInk, dark ? 800 : 200, textTarget, 'action.secondary', values, checks, diagnostics, dark ? 'dark-neutral' : 'light-neutral');
    focusRingSearch(palettes, 'brand', theme, ringSurfaces, 'action.secondary.focusRing', values, checks, diagnostics, 'action.secondary.focusRing', nonTextTarget);

    // Destructive action
    const dangerAssignment = assignmentFor(assignments, 'danger', theme);
    const dangerBold = dangerAssignment.bold;
    const dangerInk = dangerAssignment.onBold;
    record('action.destructive.background', dangerBold.hex, 'danger', dangerBold.step, 'palette-token', 'action.destructive.background');
    record('action.destructive.foreground', dangerInk.hex, 'danger', null, 'measured-ink', 'action.destructive.foreground');
    textCheck('action.destructive.foreground', dangerInk.hex, dangerBold.hex, 'ACTION_FOREGROUND_ACROSS_STATES');
    stateFamilySearch(palettes, 'danger', theme, dangerInk.hex, dangerBold.step, textTarget, 'action.destructive', values, checks, diagnostics, dark ? 'dark-chromatic' : 'light-chromatic');
    focusRingSearch(palettes, 'brand', theme, ringSurfaces, 'action.destructive.focusRing', values, checks, diagnostics, 'action.destructive.focusRing', nonTextTarget);

    // Fields
    const fieldText = dark ? stepHex(palettes, 'neutral', 50) : stepHex(palettes, 'neutral', 950);
    const placeholder = window.ColorRoleModel.foregroundToken(neutralPalette, fieldBackground, textTarget, 'minPassing');
    // The field border must reach 3:1 against the field background, which is one
    // step lighter (light theme) or darker (dark theme) than the page surface.
    const fieldBorder = dark ? stepHex(palettes, 'neutral', 500) : stepHex(palettes, 'neutral', 600);
    const helperInvalid = window.ColorRoleModel.foregroundToken(palettes.danger, fieldBackground, textTarget, 'minPassing');
    record('field.text', fieldText, 'neutral', dark ? 50 : 950, 'palette-token', 'field.text');
    textCheck('field.text', fieldText, fieldBackground);
    if (placeholder.pass) {
      record('field.placeholder', placeholder.hex, 'neutral', placeholder.step, 'palette-token', 'field.placeholder');
      textCheck('field.placeholder', placeholder.hex, fieldBackground);
    } else {
      resolveText('field.placeholder', 'neutral', neutralPalette, fieldBackground, 'minPassing');
    }
    record('field.border', fieldBorder, 'neutral', dark ? 500 : 600, 'palette-token', 'field.border');
    nonTextCheck('field.border', fieldBorder, fieldBackground);
    borderSearch(palettes, 'brand', theme, fieldBackground, 'field.borderFocus', values, checks, diagnostics, 'field.borderFocus', nonTextTarget, brandBold.step);
    borderSearch(palettes, 'danger', theme, fieldBackground, 'field.borderInvalid', values, checks, diagnostics, 'field.borderInvalid', nonTextTarget, dangerAssignment.borderIcon.step);
    if (helperInvalid.pass) {
      record('field.helperInvalid', helperInvalid.hex, 'danger', helperInvalid.step, 'palette-token', 'field.helperInvalid');
      textCheck('field.helperInvalid', helperInvalid.hex, fieldBackground);
    } else {
      resolveText('field.helperInvalid', 'danger', palettes.danger, fieldBackground, 'minPassing');
    }
    focusRingSearch(palettes, 'brand', theme, ringSurfaces, 'field.focusRing', values, checks, diagnostics, 'field.focusRing', nonTextTarget);

    // Feedback families
    for (const roleId of FEEDBACK_ROLES) {
      const roleAssignment = assignmentFor(assignments, roleId, theme);
      const subtleHex = roleAssignment.subtle.hex;
      const borderHex = roleAssignment.borderIcon.hex;
      const boldHex = roleAssignment.bold.hex;
      const onBoldHex = roleAssignment.onBold.hex;
      const textToken = window.ColorRoleModel.foregroundToken(palettes[roleId], subtleHex, textTarget, 'minPassing');
      record(`feedback.${roleId}.surface`, subtleHex, roleId, roleAssignment.subtle.step, 'palette-token', `feedback.${roleId}.surface`);
      record(`feedback.${roleId}.border`, borderHex, roleId, roleAssignment.borderIcon.step, 'palette-token', `feedback.${roleId}.border`);
      record(`feedback.${roleId}.icon`, borderHex, roleId, roleAssignment.borderIcon.step, 'palette-token', `feedback.${roleId}.icon`);
      record(`feedback.${roleId}.bold`, boldHex, roleId, roleAssignment.bold.step, 'palette-token', `feedback.${roleId}.bold`);
      record(`feedback.${roleId}.onBold`, onBoldHex, roleId, null, 'measured-ink', `feedback.${roleId}.onBold`);
      if (textToken.pass) {
        record(`feedback.${roleId}.text`, textToken.hex, roleId, textToken.step, 'palette-token', `feedback.${roleId}.text`);
        textCheck(`feedback.${roleId}.text`, textToken.hex, subtleHex);
      } else {
        resolveText(`feedback.${roleId}.text`, roleId, palettes[roleId], subtleHex, 'minPassing');
      }
      textCheck(`feedback.${roleId}.onBold`, onBoldHex, boldHex);
      nonTextCheck(`feedback.${roleId}.border`, borderHex, subtleHex);
      nonTextCheck(`feedback.${roleId}.icon`, borderHex, subtleHex);
    }

    // Secondary accent (only when Secondary is enabled)
    const secondaryRole = roles.secondary;
    if (secondaryRole && secondaryRole.enabled !== false && assignments.secondary) {
      const secondaryAssignment = assignmentFor(assignments, 'secondary', theme);
      const accentSurface = secondaryAssignment.subtle.hex;
      const accentBorder = secondaryAssignment.borderIcon.hex;
      const accentText = window.ColorRoleModel.foregroundToken(palettes.secondary, accentSurface, textTarget, 'minPassing');
      record('accent.secondary.surface', accentSurface, 'secondary', secondaryAssignment.subtle.step, 'palette-token', 'accent.secondary.surface');
      record('accent.secondary.border', accentBorder, 'secondary', secondaryAssignment.borderIcon.step, 'palette-token', 'accent.secondary.border');
      if (accentText.pass) {
        record('accent.secondary.text', accentText.hex, 'secondary', accentText.step, 'palette-token', 'accent.secondary.text');
        textCheck('accent.secondary.text', accentText.hex, accentSurface);
      } else {
        resolveText('accent.secondary.text', 'secondary', palettes.secondary, accentSurface, 'minPassing');
      }
      nonTextCheck('accent.secondary.border', accentBorder, accentSurface);
    }

    return { values, checks, diagnostics, profileId: targetProfileId };
  }

  function resolveWebsiteTokens({ palettes, roles, assignments, targetProfileId = 'aa-interface' }) {
    const profileId = TARGET_PROFILES[targetProfileId] ? targetProfileId : 'aa-interface';
    const deps = { palettes, roles, assignments, targetProfileId: profileId };
    return {
      targetProfileId: profileId,
      light: resolveTheme('light', deps),
      dark: resolveTheme('dark', deps),
    };
  }

  // --- Relationship validation -------------------------------------------------

  function validateTheme(themeResult) {
    const profile = TARGET_PROFILES[themeResult.profileId] || TARGET_PROFILES['aa-interface'];
    return themeResult.checks.map(check => {
      const relationship = RELATIONSHIPS.find(item => item.id === check.relationshipId) || null;
      const required = relationship && relationship.severity === 'required' ? profile[check.target] : null;
      const actual = window.ColorEngine.contrast(check.foreground, check.background);
      return {
        tokenId: check.tokenId,
        relationshipId: check.relationshipId,
        severity: relationship ? relationship.severity : 'required',
        target: check.target,
        foreground: check.foreground,
        background: check.background,
        actual,
        required,
        pass: required === null ? 'advisory' : actual >= required,
      };
    });
  }

  function summarize(resolution) {
    const relationships = [
      ...validateTheme(resolution.light).map(result => ({ ...result, theme: 'light' })),
      ...validateTheme(resolution.dark).map(result => ({ ...result, theme: 'dark' })),
    ];
    const requiredFailures = relationships.filter(result => result.pass === false);
    const warnings = [
      ...resolution.light.diagnostics.filter(diagnostic => diagnostic.severity === 'warning'),
      ...resolution.dark.diagnostics.filter(diagnostic => diagnostic.severity === 'warning'),
    ];
    let status = 'ready';
    if (requiredFailures.length > 0) status = 'needs-attention';
    else if (warnings.length > 0) status = 'ready-with-warnings';
    return {
      status,
      requiredFailures,
      warnings,
      relationships,
    };
  }

  // --- Serialization -----------------------------------------------------------
  //
  // Layered CSS keeps provenance inspectable: website tokens reference role
  // tokens, role tokens reference reference palettes, and measured ink stays a
  // literal HEX. Consumers never invent another naming layer.

  function roleKindFor(assignments, roleId, theme, step) {
    if (roleId === 'regular') roleId = 'neutral';
    const table = assignments[roleId]?.[theme];
    if (!table) return null;
    if (table.subtle && table.subtle.step === step) return 'subtle';
    if (table.borderIcon && table.borderIcon.step === step) return 'border-icon';
    if (table.bold && table.bold.step === step) return 'bold';
    return null;
  }

  function websiteValueRef(value, assignments, theme) {
    if (value.sourceKind === 'measured-ink') return value.hex;
    const kind = roleKindFor(assignments, value.sourceRole, theme, value.sourceStep);
    if (kind) return `var(--role-${value.sourceRole}-${theme}-${kind})`;
    return `var(--palette-${value.sourceRole}-${value.sourceStep})`;
  }

  function tokenCssName(tokenId) {
    const token = tokenById(tokenId);
    return token ? token.css : `--${tokenId.replace(/\./g, '-')}`;
  }

  // Reference, Role, and Website layers. Website Light resolves in :root;
  // Website Dark resolves in [data-theme="dark"] with the same names.
  function serializeCss({ palettes, assignments, websiteTokens, context }) {
    const lines = [':root {', '  /* Reference */'];
    for (const [roleId, palette] of Object.entries(palettes)) {
      for (const token of palette.scale) {
        lines.push(`  --palette-${roleId}-${token.step}: ${token.hex};`);
      }
    }
    lines.push('', '  /* Role */');
    for (const [roleId, themes] of Object.entries(assignments)) {
      if (roleId === 'regular') continue;
      for (const theme of ['light', 'dark']) {
        const table = themes[theme];
        if (!table) continue;
        for (const [kind, cssKind] of [['subtle', 'subtle'], ['borderIcon', 'border-icon'], ['bold', 'bold']]) {
          const item = table[kind];
          if (!item) continue;
          lines.push(`  --role-${roleId}-${theme}-${cssKind}: var(--palette-${roleId}-${item.step});`);
        }
        lines.push(`  --role-${roleId}-${theme}-on-bold: ${table.onBold.hex};`);
      }
    }
    if (context) {
      lines.push('', '  /* Context */');
      lines.push(`  --color-background: ${context.background};`);
      lines.push(`  --color-text: ${context.text};`);
    }
    lines.push('', '  /* Website · Light */');
    for (const [tokenId, value] of Object.entries(websiteTokens.light.values)) {
      lines.push(`  ${tokenCssName(tokenId)}: ${websiteValueRef(value, assignments, 'light')};`);
    }
    lines.push('}');
    lines.push('', '[data-theme="dark"] {', '  /* Website · Dark */');
    for (const [tokenId, value] of Object.entries(websiteTokens.dark.values)) {
      lines.push(`  ${tokenCssName(tokenId)}: ${websiteValueRef(value, assignments, 'dark')};`);
    }
    lines.push('}');
    return lines.join('\n');
  }

  // Tailwind adapter references the website CSS variables; it never duplicates
  // HEX values, so Light / Dark resolution stays in CSS.
  function serializeTailwind(websiteTokens) {
    const names = Object.keys(websiteTokens.light.values);
    if (!names.length) return '';
    const lines = ["module.exports = { theme: { extend: { colors: {"];
    for (const tokenId of names) {
      const name = tokenId.replace(/\./g, '-');
      lines.push(`    '${name}': 'var(${tokenCssName(tokenId)})',`);
    }
    lines.push('  } } } };');
    return lines.join('\n');
  }

  // Compatibility projection: the legacy starter set is a projection of the
  // generated website system onto pair coordinates. Website tokens own the
  // starter result; this function only feeds the compatibility-pair action.
  function compatibilityPairSpecs(websiteTokens, roles) {
    const light = websiteTokens ? websiteTokens.light.values : null;
    if (!light) return [];
    const specs = [];
    const pair = (slug, nameKey, foregroundTokenId, backgroundTokenId, usage) => {
      const foreground = light[foregroundTokenId];
      const background = light[backgroundTokenId];
      if (!foreground || !background) return;
      specs.push({
        slug,
        nameKey,
        foregroundRoleId: foreground.sourceRole,
        foregroundStep: foreground.sourceKind === 'measured-ink' ? 'auto' : foreground.sourceStep,
        backgroundRoleId: background.sourceRole,
        backgroundStep: background.sourceStep,
        usage,
      });
    };
    pair('body-text', 'starter.bodyText', 'content.primary', 'surface.page', 'static');
    pair('muted-text', 'starter.mutedText', 'content.muted', 'surface.page', 'static');
    pair('link', 'starter.link', 'content.link', 'surface.page', 'static');
    pair('primary-action', 'starter.primaryAction', 'action.primary.foreground', 'action.primary.background', 'interactive');
    pair('neutral-action', 'starter.neutralAction', 'action.secondary.foreground', 'action.secondary.background', 'interactive');
    if (roles.secondary && roles.secondary.enabled !== false) {
      pair('secondary-accent', 'starter.secondaryAccent', 'accent.secondary.text', 'surface.page', 'static');
    }
    pair('destructive-action', 'starter.destructiveAction', 'action.destructive.foreground', 'action.destructive.background', 'interactive');
    for (const role of ['success', 'warning', 'danger', 'information']) {
      pair(`${role}-notice`, `starter.${role}Notice`, `feedback.${role}.text`, `feedback.${role}.surface`, 'static');
    }
    return specs;
  }

  window.WebsiteTokenContract = {
    contract,
    feedbackRoles: FEEDBACK_ROLES,
    targetProfiles: TARGET_PROFILES,
    relationships: RELATIONSHIPS,
    tokenGroups: TOKEN_GROUPS,
    requiredGroups: REQUIRED_GROUPS,
    accentGroups: ACCENT_GROUPS,
    allTokens,
    tokenById,
    validateContract,
    resolveWebsiteTokens,
    validateTheme,
    summarize,
    serializeCss,
    serializeTailwind,
    compatibilityPairSpecs,
  };
})();
