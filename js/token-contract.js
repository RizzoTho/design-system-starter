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
  };
})();
