(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const {
    hexToRgb,
    rgbToHex,
    hexToOklch,
    mapOklchToSrgb,
    contrast,
    textColor,
    makePalette,
  } = window.ColorEngine;
  const model = window.ColorRoleModel;
  const i18n = window.I18n;
  const t = (key, params) => i18n.t(key, params);

  const autoForeground = model.autoForegroundStep;

  const state = {
    context: { ...model.defaults.context },
    target: model.defaults.target,
    activeRole: model.defaults.activeRole,
    roles: model.createInitialRoles(),
    palettes: {},
    assignments: {},
    diagnostics: [],
    savedPairs: [],
    defaultPairInitialized: false,
    nextPairKey: 1,
    language: 'en',
    mode: 'quick-start',
    generationIssue: null,
    previousState: null,
    generation: null,
    websiteTokens: null,
    targetProfileId: 'aa-interface',
    validation: null,
    generationCounter: 0,
    userLocks: {},
  };

  const seedColor = $('#seedColor');
  const hexInput = $('#hexInput');
  const hueRange = $('#hueRange');
  const chromaRange = $('#chromaRange');
  const lightRange = $('#lightRange');
  const backgroundColorInput = $('#backgroundColor');
  const backgroundHexInput = $('#backgroundHexInput');
  const textColorInput = $('#textColor');
  const textHexInput = $('#textHexInput');
  const targetSelect = $('#targetSelect');
  let scale = [];

  function reportError(message, error) {
    console.error(message, error);
    showToast(message);
  }

  function activeOwnerId() {
    return model.resolvePaletteOwner(state.activeRole);
  }

  function activeRoleState() {
    return state.roles[activeOwnerId()];
  }

  function roleSeed(roleId) {
    const ownerId = model.resolvePaletteOwner(roleId);
    return state.roles[ownerId].seed;
  }

  function roleIsEnabled(roleId) {
    const ownerId = model.resolvePaletteOwner(roleId);
    return state.roles[ownerId].enabled !== false && Boolean(state.roles[ownerId].seed);
  }

  function paletteForRole(roleId) {
    return state.palettes[model.resolvePaletteOwner(roleId)] || null;
  }

  function rebuildPalettes() {
    const palettes = {};
    const diagnostics = [];
    for (const roleId of model.paletteOwnerIds) {
      const role = state.roles[roleId];
      if (!role.enabled || !role.seed) continue;
      const palette = makePalette(role.seed, { family: roleId });
      palettes[roleId] = palette;
      diagnostics.push(...palette.diagnostics);
    }
    state.palettes = palettes;
    state.diagnostics = diagnostics;
    state.savedPairs = state.savedPairs.filter(pair => roleIsEnabled(pair.backgroundRoleId)
      && (pair.foregroundStep === autoForeground || roleIsEnabled(pair.foregroundRoleId)));
    state.assignments = model.resolveAssignments(palettes, state.roles, state.target);
    if (state.websiteTokens) {
      state.websiteTokens = window.WebsiteTokenContract.resolveWebsiteTokens({
        palettes,
        roles: state.roles,
        assignments: state.assignments,
        targetProfileId: state.targetProfileId,
        context: state.context,
      });
      state.validation = window.WebsiteTokenContract.summarize(state.websiteTokens);
      if (state.generation) {
        const nextStatus = state.validation.status === 'needs-attention'
          ? 'needs-attention'
          : state.generation.status === 'ready-with-warnings'
            ? 'ready-with-warnings'
            : state.validation.status;
        state.generation = {
          ...state.generation,
          status: nextStatus,
        };
      }
    }
    scale = paletteForRole(state.activeRole)?.scale || [];
  }

  function formatOklch(hex) {
    const { L, C, h } = hexToOklch(hex);
    return `OKLCH ${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${h.toFixed(0)}°`;
  }

  function updateInputs() {
    const roleId = state.activeRole;
    const ownerId = activeOwnerId();
    const definition = model.roles[roleId];
    const role = activeRoleState();
    const enabled = roleIsEnabled(roleId);
    const seed = role.seed || '#E4DED4';
    const oklch = hexToOklch(seed);
    const alias = definition.aliasOf ? ` · ${t('role.uses', { role: model.roles[definition.aliasOf].label })}` : '';

    seedColor.value = seed.toLowerCase();
    hexInput.value = role.seed || '';
    hueRange.value = Math.round(oklch.h);
    chromaRange.value = oklch.C.toFixed(3);
    lightRange.value = oklch.L.toFixed(3);
    $('#seedValue').textContent = role.seed || 'OFF';
    $('#hueValue').textContent = `${Math.round(oklch.h)}°`;
    $('#chromaValue').textContent = oklch.C.toFixed(3);
    $('#lightValue').textContent = `${Math.round(oklch.L * 100)}%`;
    $('#candidateLabel').textContent = `${definition.label}${alias}`;
    $('#activeRoleDescription').textContent = t(definition.descriptionKey);
    $('#summaryLabel').textContent = t(enabled ? 'summary.active' : 'summary.disabled', { role: roleId.toUpperCase() });
    $('#summaryTitle').textContent = definition.aliasOf
      ? t('summary.alias', { role: definition.label, owner: model.roles[ownerId].label })
      : t('summary.color', { role: definition.label });
    $('#summaryHex').textContent = enabled ? `${seed} · ${formatOklch(seed)}` : t('summary.noPalette');
    $('#summaryNote').textContent = definition.aliasOf ? t('summary.noDuplicate') : t('summary.seedExact');
    $('#scaleRole').textContent = definition.aliasOf ? `${definition.label} / ${model.roles[ownerId].label}` : definition.label;

    for (const input of [seedColor, hexInput, hueRange, chromaRange, lightRange]) input.disabled = !enabled;
    $('#lockRole').disabled = !enabled;
    $('#lockRole').textContent = t(role.locked ? 'action.unlock' : 'action.lock', { role: model.roles[ownerId].label });
    $('#lockRole').setAttribute('aria-pressed', String(Boolean(role.locked)));
    $('#semanticSyncActions').hidden = roleId !== 'brand';
    $('#secondaryControls').hidden = roleId !== 'secondary';
    $('#secondaryStrategy').value = state.roles.secondary.strategy;

    backgroundColorInput.value = state.context.background.toLowerCase();
    backgroundHexInput.value = state.context.background;
    textColorInput.value = state.context.text.toLowerCase();
    textHexInput.value = state.context.text;
    $('#backgroundValue').textContent = state.context.background;
    $('#textValue').textContent = state.context.text;
  }

  function renderRoleNavigation() {
    const markup = model.roleOrder.map(roleId => {
      const definition = model.roles[roleId];
      const enabled = roleIsEnabled(roleId);
      const seed = roleSeed(roleId);
      const owner = model.resolvePaletteOwner(roleId);
      return `<button class="role-tab ${state.activeRole === roleId ? 'active' : ''} ${enabled ? '' : 'disabled-role'}" type="button" data-select-role="${roleId}" aria-pressed="${state.activeRole === roleId}">
        <i style="--role-color:${seed || '#CFC8BC'}"></i><span>${definition.label}</span>${definition.aliasOf ? `<em>${t('role.alias')}</em>` : state.roles[owner].locked ? `<em>${t('role.locked')}</em>` : ''}
      </button>`;
    }).join('');
    $('#roleTabs').innerHTML = markup;
  }

  function renderRoleOverview() {
    $('#roleOverview').innerHTML = model.roleOrder.map(roleId => {
      const definition = model.roles[roleId];
      const enabled = roleIsEnabled(roleId);
      const seed = roleSeed(roleId);
      const owner = model.resolvePaletteOwner(roleId);
      const status = definition.aliasOf
        ? t('role.aliasOf', { role: model.roles[owner].label })
        : enabled
          ? `${seed}${state.roles[owner].locked ? ` · ${t('role.locked')}` : ''}`
          : t('role.optionalOff');
      return `<button class="role-card ${state.activeRole === roleId ? 'active' : ''}" type="button" data-select-role="${roleId}">
        <span class="role-card-swatch" style="background:${seed || '#E4DED4'};color:${seed ? textColor(seed) : '#6F675C'}">${enabled ? 'Aa' : '—'}</span>
        <span><strong>${definition.label}</strong><small>${status}</small></span>
      </button>`;
    }).join('');
  }

  function renderSecondarySuggestions() {
    const strategy = state.roles.secondary.strategy;
    const suggestions = model.makeSecondarySuggestions(state.roles.brand.seed, strategy);
    $('#secondarySuggestions').innerHTML = suggestions.map((suggestion, index) => `<button type="button" class="suggestion" data-secondary-hex="${suggestion.hex}"><i style="background:${suggestion.hex}"></i><span>${t('secondary.suggestion', { strategy: t(suggestion.labelKey), index: index + 1 })}</span><b>${suggestion.hex}</b></button>`).join('');
  }

  function renderScale() {
    if (!scale.length) {
      $('#scale').innerHTML = `<div class="empty-state">${t('scale.empty')}</div>`;
      return;
    }
    const usage = { 50: 'Page', 100: 'Surface', 200: 'Hover', 300: 'Border', 400: 'Muted', 500: 'Seed', 600: 'Action', 700: 'Pressed', 800: 'Strong', 900: 'Dark', 950: 'Deep' };
    $('#scale').innerHTML = scale.map(item => `<button class="swatch" data-copy="${item.hex}" data-apply-color="${item.hex}" data-copy-label="${t('toast.appliedCopied')}" title="${item.step} · ${usage[item.step]} · ${t('toast.appliedCopied')} ${item.hex}"><span class="swatch-color" style="background:${item.hex}">${item.step === 600 ? '<span class="swatch-rec">REC</span>' : ''}<span class="swatch-hex">${item.hex}</span></span><span class="swatch-meta"><b>${item.step}</b><span class="token-use">${usage[item.step]}</span><span class="contrast-values">W ${item.ratioOnWhite.toFixed(1)} · K ${item.ratioOnBlack.toFixed(1)}</span></span></button>`).join('');
  }

  function renderDiagnostics() {
    const activeDiagnostics = paletteForRole(state.activeRole)?.diagnostics || [];
    const note = $('#scaleDiagnostics');
    note.hidden = activeDiagnostics.length === 0;
    note.textContent = activeDiagnostics.length
      ? t('diagnostic.gamut', { count: activeDiagnostics.length })
      : '';
  }

  function fitLabel(ratio, target) {
    if (ratio >= 7) return 'AAA';
    if (ratio >= target) return 'PASS';
    if (ratio >= 3) return '3:1';
    return 'FAIL';
  }

  function fitClass(label) {
    return label === 'FAIL' ? 'fail' : label === '3:1' ? 'warn' : 'pass';
  }

  function paletteToken(roleId, step) {
    const token = paletteForRole(roleId)?.scale.find(item => item.step === step);
    if (!token) throw new Error(`Palette is missing token ${step} for pair role ${roleId}.`);
    return token;
  }

  function snapshotForRole(roleId) {
    const palette = paletteForRole(roleId);
    if (!palette) throw new Error(`Missing palette for pair role: ${roleId}`);
    return palette.scale.map(token => ({ step: token.step, hex: token.hex }));
  }

  function resolvePairForeground({ foregroundRoleId, foregroundStep, background }) {
    if (foregroundStep === autoForeground) return textColor(background);
    return paletteToken(foregroundRoleId, foregroundStep).hex;
  }

  function createSavedPair({
    foregroundRoleId = 'brand',
    backgroundRoleId = 'brand',
    foregroundStep = 50,
    backgroundStep = 600,
    usage = 'static',
    slug = null,
    nameKey = null,
  } = {}) {
    const background = paletteToken(backgroundRoleId, backgroundStep).hex;
    return {
      key: `pair-${state.nextPairKey++}`,
      slug,
      nameKey,
      foregroundRoleId,
      backgroundRoleId,
      foregroundStep,
      backgroundStep,
      foreground: resolvePairForeground({ foregroundRoleId, foregroundStep, background }),
      background,
      usage,
      foregroundSnapshot: foregroundStep === autoForeground ? null : snapshotForRole(foregroundRoleId),
      backgroundSnapshot: snapshotForRole(backgroundRoleId),
      brandPaletteSnapshot: snapshotForRole('brand'),
    };
  }

  function refreshSavedPairSnapshot(pair) {
    pair.background = paletteToken(pair.backgroundRoleId, pair.backgroundStep).hex;
    pair.foreground = resolvePairForeground(pair);
    pair.foregroundSnapshot = pair.foregroundStep === autoForeground ? null : snapshotForRole(pair.foregroundRoleId);
    pair.backgroundSnapshot = snapshotForRole(pair.backgroundRoleId);
    pair.brandPaletteSnapshot = snapshotForRole('brand');
  }

  function pairRoleOptions(selectedRoleId) {
    return model.paletteOwnerIds
      .filter(roleId => roleIsEnabled(roleId))
      .map(roleId => `<option value="${roleId}" ${roleId === selectedRoleId ? 'selected' : ''}>${model.roles[roleId].label}</option>`)
      .join('');
  }

  function pairStepOptions(roleId, selectedStep, { allowAuto = false } = {}) {
    const autoOption = allowAuto
      ? `<option value="${autoForeground}" ${selectedStep === autoForeground ? 'selected' : ''}>${t('saved.autoForeground')}</option>`
      : '';
    return autoOption + (paletteForRole(roleId)?.scale || [])
      .map(token => `<option value="${token.step}" ${token.step === selectedStep ? 'selected' : ''}>${token.step} · ${token.hex}</option>`)
      .join('');
  }

  function ensureDefaultPair() {
    if (state.defaultPairInitialized) return;
    state.defaultPairInitialized = true;
    if (!state.savedPairs.length && paletteForRole('brand')) state.savedPairs.push(createSavedPair());
  }

  function pairState(foreground, background) {
    const ratio = contrast(foreground, background);
    return {
      foreground,
      background,
      ratio: Number(ratio.toFixed(2)),
      passesTarget: ratio >= state.target,
    };
  }

  function derivePairStateFamily(pair) {
    const palette = paletteForRole(pair.backgroundRoleId);
    if (!palette) throw new Error(`Missing palette for saved pair background role: ${pair.backgroundRoleId}`);
    const pairScale = pair.backgroundSnapshot || palette.scale;
    const defaultIndex = pairScale.findIndex(token => token.step === pair.backgroundStep);
    if (defaultIndex < 0) throw new Error(`Saved pair snapshot is missing background step ${pair.backgroundStep}.`);
    const direction = defaultIndex + 2 < pairScale.length ? 1 : -1;
    const hoverIndex = Math.max(0, Math.min(pairScale.length - 1, defaultIndex + direction));
    const pressedIndex = Math.max(0, Math.min(pairScale.length - 1, defaultIndex + direction * 2));
    const brandScale = pair.brandPaletteSnapshot || paletteForRole('brand')?.scale;
    if (!brandScale) throw new Error('Missing Brand palette for focus-ring derivation.');
    const focusCandidates = [500, 600, 700, 400, 800, 300, 900, 200, 950, 100, 50]
      .map(step => brandScale.find(token => token.step === step))
      .filter(Boolean)
      .map(token => ({ hex: token.hex, ratio: contrast(token.hex, pair.background) }));
    const focus = focusCandidates.find(candidate => candidate.ratio >= 3)
      || focusCandidates.sort((a, b) => b.ratio - a.ratio)[0];
    return {
      default: pairState(pair.foreground, pair.background),
      hover: pairState(pair.foreground, pairScale[hoverIndex].hex),
      pressed: pairState(pair.foreground, pairScale[pressedIndex].hex),
      focusRing: {
        hex: focus.hex,
        ratio: Number(focus.ratio.toFixed(2)),
        passesNonTextTarget: focus.ratio >= 3,
      },
    };
  }

  function renderSavedPairs() {
    $('#savedPairCount').textContent = String(state.savedPairs.length);
    if (!state.savedPairs.length) {
      $('#savedPairs').innerHTML = `<p class="saved-pairs-empty">${t('saved.empty')}</p>`;
      return;
    }
    $('#savedPairs').innerHTML = state.savedPairs.map(pair => {
      const family = derivePairStateFamily(pair);
      const { ratio, passesTarget: pass } = family.default;
      const auto = pair.foregroundStep === autoForeground;
      const foregroundLabel = auto
        ? t('saved.autoForeground')
        : `${model.roles[pair.foregroundRoleId].label} ${pair.foregroundStep}`;
      const coordinateLabel = `${foregroundLabel} → ${model.roles[pair.backgroundRoleId].label} ${pair.backgroundStep}`;
      const pairLabel = pair.nameKey ? t(pair.nameKey) : coordinateLabel;
      const coordinateNote = pair.nameKey ? `${coordinateLabel} · ` : '';
      const usage = pair.usage || 'static';
      const stateSamples = usage === 'interactive' ? `<div class="saved-pair-states">
        ${['default', 'hover', 'pressed'].map(stateName => {
          const sample = family[stateName];
          return `<span><i style="background:${sample.background};color:${sample.foreground}">Aa</i><small>${t(`saved.${stateName}`)} · ${sample.ratio.toFixed(1)}:1</small></span>`;
        }).join('')}
        <span><i class="focus-ring-sample" style="--focus-ring:${family.focusRing.hex}"></i><small>${t('saved.focus')} · ${family.focusRing.ratio.toFixed(1)}:1</small></span>
      </div>` : '';
      return `<div class="saved-pair ${usage === 'interactive' ? 'interactive' : ''}">
        <span class="saved-pair-sample" style="background:${pair.background};color:${pair.foreground}">Aa</span>
        <span class="saved-pair-copy"><strong>${pairLabel}</strong><small>${coordinateNote}${pair.foreground} → ${pair.background}</small></span>
        <button class="saved-pair-remove" type="button" data-remove-pair="${pair.key}" aria-label="${t('saved.remove')}">×</button>
        <div class="saved-pair-fields">
          <label><span>${t('saved.foregroundRole')}</span><select data-pair-field="foregroundRoleId" data-pair-key="${pair.key}" ${auto ? 'disabled' : ''}>${pairRoleOptions(pair.foregroundRoleId)}</select></label>
          <label><span>${t('saved.foreground')}</span><select data-pair-field="foregroundStep" data-pair-key="${pair.key}">${pairStepOptions(pair.foregroundRoleId, pair.foregroundStep, { allowAuto: true })}</select></label>
          <label><span>${t('saved.backgroundRole')}</span><select data-pair-field="backgroundRoleId" data-pair-key="${pair.key}">${pairRoleOptions(pair.backgroundRoleId)}</select></label>
          <label><span>${t('saved.background')}</span><select data-pair-field="backgroundStep" data-pair-key="${pair.key}">${pairStepOptions(pair.backgroundRoleId, pair.backgroundStep)}</select></label>
          <label><span>${t('saved.usage')}</span><select data-pair-field="usage" data-pair-key="${pair.key}"><option value="static" ${usage === 'static' ? 'selected' : ''}>${t('saved.static')}</option><option value="interactive" ${usage === 'interactive' ? 'selected' : ''}>${t('saved.interactive')}</option></select></label>
        </div>
        <em class="${pass ? 'pass' : 'fail'}">${ratio.toFixed(1)}:1 · ${pass ? 'PASS' : `FAIL · ${t('saved.needsRatio', { target: state.target.toFixed(1) })}`}</em>
        ${stateSamples}
      </div>`;
    }).join('');
  }

  function renderContextStatus() {
    const ratio = contrast(state.context.text, state.context.background);
    const pass = ratio >= 4.5;
    const level = ratio >= 7 ? 'AAA' : pass ? 'AA' : '';
    const element = $('#contextStatus');
    element.classList.toggle('pass', pass);
    element.classList.toggle('fail', !pass);
    element.innerHTML = `<span class="status-icon" aria-hidden="true">${pass ? '✓' : '!'}</span><span><strong>${pass ? `PASS · ${level}` : 'FAIL'}</strong><small>${t('context.status.text')} · ${ratio.toFixed(2)}:1<br />${t('context.status.required')} · 4.5:1</small></span>`;
    $('#contextCanvas').style.setProperty('--context-bg', state.context.background);
    $('#contextCanvas').style.setProperty('--context-text', state.context.text);
  }

  function renderPairings() {
    const target = state.target;
    const results = model.roleOrder.map(roleId => {
      const definition = model.roles[roleId];
      if (!roleIsEnabled(roleId)) {
        return { needsWork: false, html: `<div class="pair pair-disabled"><span class="pair-swatch">—</span><span class="pair-copy"><strong>${definition.label}</strong><span>${t('fit.disabled')}</span></span></div>` };
      }
      const color = roleSeed(roleId);
      const onBackground = contrast(color, state.context.background);
      const measuredOnColor = textColor(color);
      const measuredOnRatio = contrast(measuredOnColor, color);
      const bgLabel = fitLabel(onBackground, target);
      const onLabel = fitLabel(measuredOnRatio, target);
      const needsWork = onBackground < target || measuredOnRatio < target;
      const alias = definition.aliasOf ? ` · ${t('role.uses', { role: model.roles[definition.aliasOf].label })}` : '';
      const issues = [];
      if (onBackground < target) issues.push(t('fit.issue.background', { ratio: onBackground.toFixed(2), target: target.toFixed(1) }));
      if (measuredOnRatio < target) issues.push(t('fit.issue.onColor', { ratio: measuredOnRatio.toFixed(2), target: target.toFixed(1) }));
      const task = needsWork ? `<i class="fit-task"><b aria-hidden="true">!</b><span><strong>${t('fit.needsWork')}</strong><small>${issues.join('<br />')}</small><em>${t('fit.openColors')}</em></span></i>` : '';
      return { needsWork, html: `<button class="pair ${needsWork ? 'needs-work' : ''}" data-edit-role="${roleId}" aria-label="${t('fit.editRole', { role: definition.label })}" title="${t('fit.editRole', { role: definition.label })}"><span class="pair-swatch" style="background:${color};color:${measuredOnColor}">Aa</span><span class="pair-copy"><strong>${definition.label}<em>${color}${alias}</em></strong><span>${t('fit.onBackground', { color })} · ${onBackground.toFixed(2)}:1<br />${t('fit.measured', { color: measuredOnColor })} · ${measuredOnRatio.toFixed(2)}:1</span></span><span class="fit-badges">${task}<i class="fit-badge ${fitClass(bgLabel)}">BG ${bgLabel}</i><i class="fit-badge ${fitClass(onLabel)}">ON ${onLabel}</i></span></button>` };
    });
    const needsWorkCount = results.filter(result => result.needsWork).length;
    const summary = needsWorkCount ? `<div class="fit-work-summary"><span aria-hidden="true">!</span><strong>${t('fit.workSummary', { count: needsWorkCount })}</strong></div>` : '';
    $('#pairList').innerHTML = summary + results.map(result => result.html).join('');
  }

  // Preview is one landing page, not a component gallery. It is styled by the
  // exported website token names, so what the page shows and what the export
  // ships are the same values. surface.page owns the largest area: nav, hero,
  // features and signup sit directly on it. surface.raised is only for cards
  // and surface.sunken only for the single alternating band and the spec zone.
  // Semantic color stays local to state evidence, so the page itself carries no
  // status fills and the system-spec zone below the footer owns every state.
  function previewTokenValues(theme) {
    if (state.websiteTokens) return state.websiteTokens[theme].values;
    // Before the first generation the same resolver that produces the export is
    // run for display only. The result is never stored and never exported.
    return window.WebsiteTokenContract.resolveWebsiteTokens({
      palettes: state.palettes,
      roles: state.roles,
      assignments: state.assignments,
      targetProfileId: state.targetProfileId,
      context: state.context,
    })[theme].values;
  }

  // Accent tokens resolve only when Secondary is enabled. An absent token is
  // skipped rather than replaced by an invented fallback color.
  function previewTokenVariables(values) {
    return window.WebsiteTokenContract.allTokens()
      .filter(token => values[token.id])
      .map(token => `${token.css}:${values[token.id].hex}`)
      .join(';');
  }

  function specNoticeMarkup(roleId) {
    const glyphs = { success: '✓', warning: '!', danger: '×', information: 'i' };
    const label = model.roles[roleId].label;
    return `<div class="spec-notice ${roleId}">
      <span class="spec-notice-icon" aria-hidden="true">${glyphs[roleId]}</span>
      <span class="spec-notice-copy"><strong>${label}</strong><small>${t(`preview.spec.message.${roleId}`)}</small></span>
      <b class="spec-chip">${t('preview.spec.chip')}</b>
    </div>`;
  }

  function specPaletteMarkup(theme) {
    const tokenIdForRole = (roleId) => {
      if (roleId === 'brand') return 'action.primary.background';
      if (roleId === 'neutral') return 'surface.page';
      if (roleId === 'secondary') return 'accent.secondary.surface';
      return `feedback.${roleId}.bold`;
    };
    return model.paletteOwnerIds.filter(roleId => roleIsEnabled(roleId)).map(roleId => {
      const assignment = state.assignments[roleId][theme];
      const onBoldPass = assignment.onBold.pass;
      return `<button class="semantic-card" type="button" data-select-role="${roleId}" aria-label="${t('preview.openRole', { role: model.roles[roleId].label })}" title="${t('preview.openRole', { role: model.roles[roleId].label })}"><span class="semantic-card-swatch" style="--semantic-subtle:${assignment.subtle.hex};--semantic-border:${assignment.borderIcon.hex};--semantic-bold:${assignment.bold.hex};--semantic-on:${assignment.onBold.hex}"><i></i><b>Aa</b></span><span><strong>${model.roles[roleId].label}</strong><small>${assignment.bold.hex} · ${tokenIdForRole(roleId)}</small><em class="${onBoldPass ? 'pass' : 'fail'}">Aa ${assignment.onBold.ratio.toFixed(1)}:1 · ${onBoldPass ? 'PASS' : 'FAIL'}</em></span></button>`;
    }).join('');
  }

  function sitePreviewMarkup(theme, values) {
    const themeLabel = t(theme === 'light' ? 'tokens.light' : 'tokens.dark');
    // Secondary is an accent. When it is enabled it decorates one badge; it
    // never becomes a second filled action next to the primary one.
    const accentBadge = values['accent.secondary.surface']
      ? `<span class="site-accent-badge">${t('preview.site.featureBadge')}</span>`
      : '';
    const features = ['one', 'two', 'three'].map((key, index) => `<article class="site-card">
        ${index === 0 ? accentBadge : ''}
        <h5>${t(`preview.site.feature.${key}.title`)}</h5>
        <p>${t(`preview.site.feature.${key}.desc`)}</p>
        <a class="site-link" href="#preview">${t('preview.site.featureLink')}</a>
      </article>`).join('');
    const metrics = ['one', 'two', 'three'].map(key => `<div><dt>${t(`preview.site.metric.${key}.label`)}</dt><dd>${t(`preview.site.metric.${key}.value`)}</dd></div>`).join('');
    const footerLinks = ['privacy', 'terms', 'status'].map(key => `<a class="site-link" href="#preview">${t(`preview.site.footer.${key}`)}</a>`).join('');
    const notices = ['success', 'warning', 'danger', 'information'].map(specNoticeMarkup).join('');

    return `<div class="site-preview" style="${previewTokenVariables(values)}">
      <header class="site-nav">
        <span class="site-brand"><i aria-hidden="true"></i>${t('preview.site.brand')}</span>
        <nav class="site-nav-links" aria-label="${t('aria.siteNavigation')}">
          <a class="active" href="#preview">${t('preview.site.nav.product')}</a>
          <a href="#preview">${t('preview.site.nav.pricing')}</a>
          <a href="#preview">${t('preview.site.nav.docs')}</a>
          <a href="#preview">${t('preview.site.nav.blog')}</a>
        </nav>
        <div class="site-nav-actions"><a class="site-link" href="#preview">${t('preview.site.nav.signIn')}</a><button class="site-button primary compact" type="button">${t('preview.site.nav.cta')}</button></div>
      </header>
      <section class="site-hero">
        <p class="site-eyebrow">${t('preview.site.eyebrow')}</p>
        <h3>${t('preview.site.title')}</h3>
        <p class="site-lede">${t('preview.site.lede')}</p>
        <div class="site-actions"><button class="site-button primary" type="button">${t('preview.site.primaryAction')}</button><button class="site-button secondary" type="button">${t('preview.site.secondaryAction')}</button></div>
        <p class="site-trust">${t('preview.site.trust')}</p>
      </section>
      <section class="site-features">${features}</section>
      <section class="site-band">
        <blockquote>${t('preview.site.quote')}<cite>${t('preview.site.quoteAuthor')}</cite></blockquote>
        <dl class="site-metrics">${metrics}</dl>
      </section>
      <section class="site-cta">
        <div><strong>${t('preview.site.cta.title')}</strong><p>${t('preview.site.cta.body')}</p></div>
        <button class="site-button inverse" type="button">${t('preview.site.cta.action')}</button>
      </section>
      <section class="site-signup">
        <div class="site-signup-copy"><h5>${t('preview.site.signup.title')}</h5><p>${t('preview.site.signup.body')}</p></div>
        <div class="site-form">
          <label for="siteEmail-${theme}">${t('preview.site.signup.label')}</label>
          <div class="site-form-row">
            <input id="siteEmail-${theme}" placeholder="${t('preview.site.signup.placeholder')}" readonly />
            <button class="site-button primary" type="button">${t('preview.site.signup.action')}</button>
          </div>
          <p class="site-form-note">${t('preview.site.signup.note')}</p>
        </div>
      </section>
      <footer class="site-footer">
        <span>${t('preview.site.footer.copyright')}</span>
        <nav class="site-footer-links" aria-label="${t('aria.siteFooter')}">${footerLinks}</nav>
      </footer>
      <section class="spec-zone">
        <header class="spec-head"><div><strong>${t('preview.spec.title')}</strong><p>${t('preview.spec.desc')}</p></div><code>${themeLabel}</code></header>
        <div class="spec-grid">
          <article class="spec-block">
            <h5>${t('preview.spec.actions')}</h5>
            <div class="spec-row">
              <span class="spec-item"><button class="site-button primary" type="button">${t('preview.site.primaryAction')}</button><small>${t('preview.spec.state.default')}</small></span>
              <span class="spec-item"><button class="site-button primary is-hover" type="button">${t('preview.site.primaryAction')}</button><small>${t('preview.spec.state.hover')}</small></span>
              <span class="spec-item"><button class="site-button primary is-pressed" type="button">${t('preview.site.primaryAction')}</button><small>${t('preview.spec.state.pressed')}</small></span>
              <span class="spec-item"><button class="site-button primary is-focused" type="button">${t('preview.site.primaryAction')}</button><small>${t('preview.spec.state.focus')}</small></span>
            </div>
            <div class="spec-row">
              <span class="spec-item"><button class="site-button secondary" type="button">${t('preview.site.secondaryAction')}</button><small>${t('preview.spec.state.default')}</small></span>
              <span class="spec-item"><button class="site-button secondary is-hover" type="button">${t('preview.site.secondaryAction')}</button><small>${t('preview.spec.state.hover')}</small></span>
              <span class="spec-item"><button class="site-button destructive" type="button">${t('preview.spec.destructive')}</button><small>${t('preview.spec.destructiveNote')}</small></span>
            </div>
          </article>
          <article class="spec-block">
            <h5>${t('preview.spec.fields')}</h5>
            <div class="spec-field"><label for="specDefault-${theme}">${t('preview.spec.state.default')}</label><input id="specDefault-${theme}" value="${t('preview.spec.fieldValue')}" readonly /></div>
            <div class="spec-field is-focused"><label for="specFocus-${theme}">${t('preview.spec.state.focus')}</label><input id="specFocus-${theme}" value="${t('preview.spec.fieldValue')}" readonly /></div>
            <div class="spec-field is-invalid"><label for="specInvalid-${theme}">${t('preview.spec.state.invalid')}</label><input id="specInvalid-${theme}" value="jane@" aria-invalid="true" readonly /><small>${t('preview.spec.fieldHelper')}</small></div>
          </article>
          <article class="spec-block spec-feedback">
            <h5>${t('preview.spec.feedback')}</h5>
            <p class="spec-note">${t('preview.spec.feedbackDesc')}</p>
            ${notices}
          </article>
          <article class="spec-block">
            <h5>${t('preview.spec.overlay')}</h5>
            <p class="spec-note">${t('preview.spec.overlayDesc')}</p>
            <div class="spec-overlay">
              <div class="spec-dialog">
                <strong>${t('preview.spec.overlayTitle')}</strong>
                <p>${t('preview.spec.overlayBody')}</p>
                <div class="spec-dialog-actions"><button class="site-button secondary compact" type="button">${t('preview.spec.overlayCancel')}</button><button class="site-button destructive compact" type="button">${t('preview.spec.overlayConfirm')}</button></div>
              </div>
            </div>
          </article>
          <article class="spec-block spec-palette">
            <h5>${t('preview.paletteTitle')}</h5>
            <p class="spec-note">${t('preview.paletteDesc')}</p>
            <div class="semantic-card-grid">${specPaletteMarkup(theme)}</div>
          </article>
        </div>
      </section>
    </div>`;
  }

  function renderPreviews() {
    // Both themes render identical markup; only the token values differ.
    for (const [theme, container] of [['light', '#lightPreview'], ['dark', '#darkPreview']]) {
      const values = previewTokenValues(theme);
      const element = $(container);
      for (const token of window.WebsiteTokenContract.allTokens()) {
        if (values[token.id]) element.style.setProperty(token.css, values[token.id].hex);
        else element.style.removeProperty(token.css);
      }
      $(`${container}Content`).innerHTML = sitePreviewMarkup(theme, values);
    }
  }

  function renderAll() {
    rebuildPalettes();
    ensureDefaultPair();
    const activeSeed = activeRoleState().seed || '#E4DED4';
    $('#seedSummary').style.setProperty('--seed', activeSeed);
    $('#seedSummary').style.setProperty('--seed-ink', textColor(activeSeed));
    updateInputs();
    renderRoleNavigation();
    renderRoleOverview();
    renderSecondarySuggestions();
    renderContextStatus();
    renderScale();
    renderDiagnostics();
    renderPairings();
    renderSavedPairs();
    renderPreviews();
    renderGenerationResult();
    renderContextSourceNote();
    renderWebsiteTokens();
    SelectControl.upgrade();
  }

  function setRoleSeed(value) {
    const rgb = hexToRgb(String(value).toUpperCase());
    if (!rgb) {
      hexInput.setAttribute('aria-invalid', 'true');
      return;
    }
    hexInput.removeAttribute('aria-invalid');
    const ownerId = activeOwnerId();
    state.roles[ownerId].seed = rgbToHex(rgb);
    state.roles[ownerId].enabled = true;
    renderAll();
  }

  function setRoleFromOklch() {
    const ownerId = activeOwnerId();
    const mapped = mapOklchToSrgb({
      L: Number(lightRange.value),
      C: Number(chromaRange.value),
      h: Number(hueRange.value),
    });
    state.roles[ownerId].seed = mapped.hex;
    state.roles[ownerId].enabled = true;
    if (mapped.reduced) showToast(t('toast.gamutReduced'));
    renderAll();
  }

  function setContextFromHex(kind, value) {
    const rgb = hexToRgb(String(value).toUpperCase());
    const input = kind === 'background' ? backgroundHexInput : textHexInput;
    if (!rgb) {
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    input.removeAttribute('aria-invalid');
    state.context[kind] = rgbToHex(rgb);
    state.context.source = state.context.locked ? 'locked' : 'provided';
    renderAll();
  }

  function generateSemanticColors() {
    const suggestions = model.makeSemanticSuggestions(state.roles.brand.seed);
    let changed = 0;
    for (const roleId of model.semanticRoleIds) {
      if (state.roles[roleId].locked) continue;
      state.roles[roleId].seed = suggestions[roleId].hex;
      changed += 1;
    }
    renderAll();
    showToast(t('toast.semanticGenerated', { count: changed }));
  }

  function optimizeSemanticColors() {
    let changed = 0;
    let unresolved = 0;
    for (const roleId of model.semanticRoleIds) {
      const role = state.roles[roleId];
      if (role.locked) continue;
      const result = model.optimizeSemanticSeed(roleId, role.seed, state.context.background, state.target);
      if (!result) {
        unresolved += 1;
        continue;
      }
      if (!result.adjusted) continue;
      role.seed = result.hex;
      changed += 1;
    }
    renderAll();
    if (unresolved) showToast(t('toast.semanticOptimizePartial', { changed, unresolved }));
    else if (changed) showToast(t('toast.semanticOptimized', { count: changed }));
    else showToast(t('toast.semanticAlreadyPass'));
  }

  // An `auto` foreground is measured from the background, so its own role does not
  // participate in identity. Without this, two `auto` pairs over the same background
  // would look distinct only because of a role that has no effect on either color.
  function pairCoordinate({ foregroundRoleId, foregroundStep, backgroundRoleId, backgroundStep }) {
    const foreground = foregroundStep === autoForeground ? autoForeground : `${foregroundRoleId}:${foregroundStep}`;
    return `${foreground}|${backgroundRoleId}:${backgroundStep}`;
  }

  function pairCoordinateExists(coordinate, exceptKey) {
    return state.savedPairs.some(pair => pair.key !== exceptKey && pairCoordinate(pair) === coordinate);
  }

  function updatePairField(fieldTarget) {
    const pair = state.savedPairs.find(item => item.key === fieldTarget.dataset.pairKey);
    if (!pair) throw new Error(`Saved pair not found: ${fieldTarget.dataset.pairKey}`);
    const field = fieldTarget.dataset.pairField;
    const raw = fieldTarget.value;

    if (field === 'usage') {
      if (!['static', 'interactive'].includes(raw)) throw new Error(`Unknown saved pair usage: ${raw}`);
      pair.usage = raw;
      renderAll();
      return;
    }

    const isRoleField = field === 'foregroundRoleId' || field === 'backgroundRoleId';
    const value = isRoleField || raw === autoForeground ? raw : Number(raw);
    const next = { ...pair, [field]: value };

    // Switching the foreground role must not keep a step the new palette shares by
    // coincidence only; every palette carries the same steps, so this stays valid.
    if (!roleIsEnabled(next.backgroundRoleId)) throw new Error(`Pair background role is not enabled: ${next.backgroundRoleId}`);
    if (next.foregroundStep !== autoForeground && !roleIsEnabled(next.foregroundRoleId)) {
      throw new Error(`Pair foreground role is not enabled: ${next.foregroundRoleId}`);
    }
    if (!Number.isInteger(next.backgroundStep)) throw new Error('Pair background step must be an integer.');
    if (next.foregroundStep !== autoForeground && !Number.isInteger(next.foregroundStep)) {
      throw new Error('Pair foreground step must be an integer or auto.');
    }
    paletteToken(next.backgroundRoleId, next.backgroundStep);
    if (next.foregroundStep !== autoForeground) paletteToken(next.foregroundRoleId, next.foregroundStep);
    if (pairCoordinateExists(pairCoordinate(next), pair.key)) {
      showToast(t('toast.pairAlreadyExists'));
      renderAll();
      return;
    }

    pair.foregroundRoleId = next.foregroundRoleId;
    pair.backgroundRoleId = next.backgroundRoleId;
    pair.foregroundStep = next.foregroundStep;
    pair.backgroundStep = next.backgroundStep;
    refreshSavedPairSnapshot(pair);
    renderAll();
  }

  function addPair() {
    const activeOwner = activeOwnerId();
    const roleId = roleIsEnabled(activeOwner) ? activeOwner : 'brand';
    const candidates = [
      { foregroundStep: autoForeground, backgroundStep: 600 },
      { foregroundStep: 50, backgroundStep: 600 },
      { foregroundStep: 950, backgroundStep: 100 },
      { foregroundStep: 100, backgroundStep: 600 },
    ].map(candidate => ({ ...candidate, foregroundRoleId: roleId, backgroundRoleId: roleId }));
    const next = candidates.find(candidate => !pairCoordinateExists(pairCoordinate(candidate)));
    if (!next) {
      showToast(t('toast.pairAlreadyExists'));
      return;
    }
    state.savedPairs.push(createSavedPair(next));
    renderAll();
    showToast(t('toast.pairAdded'));
  }

  function generateStarterSet() {
    // The generated website system is the starter-result owner. Once applied,
    // the compatibility action projects website tokens onto pair coordinates;
    // before any generation it falls back to the legacy role-model projection.
    const specs = state.websiteTokens
      ? window.WebsiteTokenContract.compatibilityPairSpecs(state.websiteTokens, state.roles)
      : model.starterPairSpecs(state.palettes, state.roles, state.assignments, state.target);
    let added = 0;
    let skipped = 0;
    for (const spec of specs) {
      // Append rather than replace: a row the user already built stays theirs.
      if (pairCoordinateExists(pairCoordinate(spec))) {
        skipped += 1;
        continue;
      }
      state.savedPairs.push(createSavedPair(spec));
      added += 1;
    }
    renderAll();
    if (!added) showToast(t('toast.starterSetExists'));
    else if (skipped) showToast(t('toast.starterSetPartial', { added, skipped }));
    else showToast(t('toast.starterSetGenerated', { count: added }));
  }

  function copy(value, message = t('toast.copied')) {
    const fallback = () => {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      if (!copied) throw new Error('Clipboard copy was rejected');
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value)
        .then(() => showToast(message))
        .catch(error => {
          try {
            fallback();
            showToast(message);
          } catch (fallbackError) {
            reportError(t('toast.copyFailed'), { error, fallbackError });
          }
        });
      return;
    }
    try {
      fallback();
      showToast(message);
    } catch (error) {
      reportError(t('toast.copyFailed'), error);
    }
  }

  function legacyCssSection() {
    const lines = [
      ':root {',
      `  --color-background: ${state.context.background};`,
      `  --color-text: ${state.context.text};`,
    ];
    for (const roleId of model.paletteOwnerIds) {
      const palette = state.palettes[roleId];
      if (!palette) continue;
      for (const token of palette.scale) lines.push(`  --color-${roleId}-${token.step}: ${token.hex};`);
    }
    for (const [roleId, themes] of Object.entries(state.assignments)) {
      if (roleId === 'regular') continue;
      for (const theme of ['light', 'dark']) {
        const assignment = themes[theme];
        lines.push(`  --color-${roleId}-${theme}-subtle: ${assignment.subtle.hex};`);
        lines.push(`  --color-${roleId}-${theme}-border-icon: ${assignment.borderIcon.hex};`);
        lines.push(`  --color-${roleId}-${theme}-bold: ${assignment.bold.hex};`);
        lines.push(`  --color-${roleId}-${theme}-on-bold: ${assignment.onBold.hex};`);
      }
    }
    lines.push('  --color-regular-light-subtle: var(--color-neutral-light-subtle);');
    lines.push('  --color-regular-light-border-icon: var(--color-neutral-light-border-icon);');
    lines.push('  --color-regular-light-bold: var(--color-neutral-light-bold);');
    lines.push('  --color-regular-light-on-bold: var(--color-neutral-light-on-bold);');
    lines.push('  --color-regular-dark-subtle: var(--color-neutral-dark-subtle);');
    lines.push('  --color-regular-dark-border-icon: var(--color-neutral-dark-border-icon);');
    lines.push('  --color-regular-dark-bold: var(--color-neutral-dark-bold);');
    lines.push('  --color-regular-dark-on-bold: var(--color-neutral-dark-on-bold);');
    const pairCounts = {};
    for (const pair of state.savedPairs) {
      // A generated pair exports under its product intent. An unnamed pair falls back to
      // the background role, which owns the surface and its interactive states.
      const base = pair.slug || pair.backgroundRoleId;
      pairCounts[base] = (pairCounts[base] || 0) + 1;
      const name = pair.slug && pairCounts[base] === 1 ? base : `${base}-${pairCounts[base]}`;
      lines.push(`  --pair-${name}-foreground: ${pair.foreground};`);
      lines.push(`  --pair-${name}-background: ${pair.background};`);
      if ((pair.usage || 'static') === 'interactive') {
        const family = derivePairStateFamily(pair);
        lines.push(`  --pair-${name}-background-hover: ${family.hover.background};`);
        lines.push(`  --pair-${name}-background-pressed: ${family.pressed.background};`);
        lines.push(`  --pair-${name}-focus-ring: ${family.focusRing.hex};`);
      }
    }
    lines.push('}');
    return lines.join('\n');
  }

  function cssOutput() {
    if (!state.websiteTokens) return legacyCssSection();
    const layered = window.WebsiteTokenContract.serializeCss({
      palettes: state.palettes,
      assignments: state.assignments,
      websiteTokens: state.websiteTokens,
      context: state.context,
    });
    const deprecation = state.savedPairs.length
      ? '/* Deprecated: --pair-* names are kept for the compatibility window; use the website tokens above instead. */'
      : '';
    const legacy = legacyCssSection().replace(':root {', ':root {\n  /* Deprecated: --color-* names are kept for the compatibility window; use the layered tokens above instead. */');
    return `${layered}\n\n${deprecation ? `${deprecation}\n` : ''}${legacy}`;
  }

  function currentProject() {
    return {
      schemaVersion: window.ProjectState.SCHEMA_VERSION,
      mode: state.mode,
      generation: state.generation,
      context: state.context,
      targetProfileId: state.targetProfileId,
      advancedPairTarget: state.target,
      activeRole: state.activeRole,
      roles: Object.fromEntries(model.roleOrder.map(roleId => [roleId, model.roles[roleId].aliasOf ? { aliasOf: model.roles[roleId].aliasOf } : { ...state.roles[roleId] }])),
      palettes: Object.fromEntries(Object.entries(state.palettes).map(([roleId, palette]) => [roleId, Object.fromEntries(palette.scale.map(token => [token.step, token.hex]))])),
      assignments: state.assignments,
      website: state.websiteTokens ? {
        targetProfileId: state.websiteTokens.targetProfileId,
        light: { values: state.websiteTokens.light.values },
        dark: { values: state.websiteTokens.dark.values },
      } : null,
      validation: state.validation,
      pairs: state.savedPairs.map(pair => {
        const family = derivePairStateFamily(pair);
        const { key, foregroundSnapshot, backgroundSnapshot, brandPaletteSnapshot, ...publicPair } = pair;
        return {
          ...publicPair,
          usage: pair.usage || 'static',
          ratio: family.default.ratio,
          passesTarget: family.default.passesTarget,
          states: (pair.usage || 'static') === 'interactive' ? {
            default: family.default,
            hover: family.hover,
            pressed: family.pressed,
          } : { default: family.default },
          focusRing: (pair.usage || 'static') === 'interactive' ? family.focusRing : null,
        };
      }),
      diagnostics: state.diagnostics,
    };
  }

  function jsonOutput() {
    return JSON.stringify(currentProject(), null, 2);
  }

  // --- Persistence and import ---------------------------------------------------

  const STORAGE_KEY = 'design-system-starter.project.v2';
  const storage = (typeof window.localStorage !== 'undefined') ? window.localStorage : null;

  function applyImportedProject(project) {
    // Product coverage profiles were removed with the landing-page Preview.
    // A project that still carries one fails visibly instead of losing tokens
    // to a silent drop.
    const retiredProfileId = project.profileId ?? project.website?.profileId ?? null;
    if (retiredProfileId) {
      throw new Error(`Website coverage profiles were removed; this project still requests "${retiredProfileId}"`);
    }
    state.context = { ...project.context };
    state.roles = project.roles;
    state.target = Number(project.advancedPairTarget ?? project.target ?? 4.5);
    state.targetProfileId = project.targetProfileId || 'aa-interface';
    state.websiteTokens = project.website || null;
    state.validation = project.validation || null;
    state.generation = project.generation || null;
    state.savedPairs = (project.pairs || []).map((pair, index) => ({
      ...pair,
      key: `pair-import-${index + 1}`,
      foregroundSnapshot: null,
      backgroundSnapshot: null,
      brandPaletteSnapshot: null,
    }));
    state.nextPairKey = state.savedPairs.length + 100;
    state.defaultPairInitialized = true;
    state.activeRole = project.activeRole || 'brand';
    state.generationIssue = null;
    state.previousState = null;
    state.userLocks = {};
    targetSelect.value = String(state.target);
    renderAll();
  }

  function saveProject() {
    if (!storage) {
      reportError(t('toast.saveFailed'), new Error('localStorage is unavailable'));
      return;
    }
    try {
      const payload = window.ProjectState.prepareForStorage(currentProject());
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      showToast(t('toast.projectSaved'));
    } catch (error) {
      reportError(t('toast.saveFailed'), error);
    }
  }

  function loadStoredProject() {
    if (!storage) return;
    let raw = null;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (error) {
      reportError(t('toast.loadFailed'), error);
      return;
    }
    if (!raw) return;
    try {
      const project = window.ProjectState.decode(raw);
      applyImportedProject(project);
      showToast(t('toast.projectLoaded'));
    } catch (error) {
      // A bad stored project is never silently discarded: it stays observable
      // and the active project is left untouched.
      reportError(t('toast.importFailed'), error);
    }
  }

  function newProject() {
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch (error) {
        reportError(t('toast.clearFailed'), error);
      }
    }
    state.context = { ...model.defaults.context };
    state.target = model.defaults.target;
    state.activeRole = model.defaults.activeRole;
    state.roles = model.createInitialRoles();
    state.savedPairs = [];
    state.defaultPairInitialized = false;
    state.nextPairKey = 1;
    state.websiteTokens = null;
    state.targetProfileId = 'aa-interface';
    state.validation = null;
    state.generation = null;
    state.generationIssue = null;
    state.previousState = null;
    state.userLocks = {};
    targetSelect.value = String(state.target);
    renderAll();
    showToast(t('toast.projectNew'));
  }

  function downloadJson() {
    try {
      const blob = new Blob([jsonOutput()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'color-design-system-project.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast(t('toast.downloaded'));
    } catch (error) {
      reportError(t('toast.downloadFailed'), error);
    }
  }

  function importProjectText(json) {
    try {
      const project = window.ProjectState.decode(json);
      applyImportedProject(project);
    } catch (error) {
      reportError(t('toast.importFailed'), error);
      return;
    }
    showToast(t('toast.projectImported'));
  }

  function handleImportFile(file) {
    if (typeof file.text === 'function') {
      file.text().then(importProjectText).catch(error => reportError(t('toast.importFailed'), error));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => importProjectText(String(reader.result));
    reader.onerror = error => reportError(t('toast.importFailed'), error);
    reader.readAsText(file);
  }

  // --- Quick start: one-click website system ----------------------------------

  function quickOptions() {
    const characterId = $('#characterSelect').value;
    const brandSource = $('#brandSourceSelect').value;
    const brandHex = brandSource === 'hex' ? $('#quickBrandHex').value.trim() : null;
    const secondaryStrategy = $('#quickSecondaryStrategy').value;
    return { characterId, brandSource, brandHex, secondaryStrategy };
  }

  function currentStateForGeneration() {
    const roles = { ...state.roles };
    const source = quickOptions().brandSource;
    // The starter default lock on Brand is a convenience, not a commitment:
    // explicit Quick start sources (Generate / HEX) produce a fresh brand unless
    // the user deliberately locked Brand in Advanced editing. "Keep current"
    // never unlocks anything.
    const brandLockedByUser = state.userLocks.brand === true;
    if (source !== 'keep' && !brandLockedByUser) {
      roles.brand = { ...roles.brand, locked: false };
    }
    return { context: state.context, roles, target: state.target };
  }

  function nextGenerationSeed() {
    state.generationCounter += 1;
    return (state.generationCounter * 7919) % 2147483647;
  }

  function buildGenerationResult(options) {
    return window.SystemGenerator.generateSystem({
      currentState: currentStateForGeneration(),
      options: {
        ...options,
        randomSeed: nextGenerationSeed(),
        revision: state.generationCounter,
        targetProfileId: state.targetProfileId,
      },
    });
  }

  function generateWebsiteSystem() {
    const options = quickOptions();
    if (options.brandSource === 'hex') {
      if (!/^#[0-9a-f]{6}$/i.test(options.brandHex)) {
        $('#quickBrandHex').setAttribute('aria-invalid', 'true');
        showToast(t('toast.invalidHex'));
        return;
      }
      $('#quickBrandHex').removeAttribute('aria-invalid');
    }
    const result = buildGenerationResult(options);
    if (result.error) {
      showToast(result.error.message);
      return;
    }
    if (result.validation.status === 'needs-attention') {
      state.generationIssue = result;
      renderGenerationResult();
      showToast(t('toast.generationNeedsAttention'));
      return;
    }
    applyGeneration(result);
  }

  function dismissGenerationIssue() {
    state.generationIssue = null;
    renderGenerationResult();
    showToast(t('toast.generationIssueDismissed'));
  }

  function applyGeneration(result) {
    const proposal = result.proposal;
    state.previousState = JSON.stringify({
      context: state.context,
      target: state.target,
      roles: state.roles,
      savedPairs: state.savedPairs,
      defaultPairInitialized: state.defaultPairInitialized,
      nextPairKey: state.nextPairKey,
      websiteTokens: state.websiteTokens,
      targetProfileId: state.targetProfileId,
      validation: state.validation,
      generation: state.generation,
      userLocks: state.userLocks,
    });
    state.context = { ...proposal.context };
    state.roles = proposal.roles;
    state.targetProfileId = proposal.targetProfileId;
    state.target = proposal.advancedPairTarget;
    state.websiteTokens = proposal.websiteTokens;
    state.validation = proposal.validation;
    state.generation = proposal.generation;
    state.generationIssue = null;
    targetSelect.value = String(proposal.advancedPairTarget);
    renderAll();
    showToast(t('toast.systemGenerated'));
  }

  function undoApply() {
    if (!state.previousState) return;
    const previous = JSON.parse(state.previousState);
    state.context = previous.context;
    state.target = previous.target;
    state.roles = previous.roles;
    state.savedPairs = previous.savedPairs;
    state.defaultPairInitialized = previous.defaultPairInitialized;
    state.nextPairKey = previous.nextPairKey;
    state.websiteTokens = previous.websiteTokens;
    state.targetProfileId = previous.targetProfileId;
    state.validation = previous.validation;
    state.generation = previous.generation;
    state.userLocks = previous.userLocks || {};
    state.previousState = null;
    targetSelect.value = String(state.target);
    renderAll();
    showToast(t('toast.systemUndone'));
  }

  function generationStatusCopy(status) {
    if (status === 'ready') return { key: 'gen.ready', descKey: 'gen.ready.desc', icon: '✓', className: 'ready' };
    if (status === 'ready-with-warnings') return { key: 'gen.readyWarnings', descKey: 'gen.readyWarnings.desc', icon: '✓', className: 'ready-with-warnings' };
    return { key: 'gen.needsAttention', descKey: 'gen.needsAttention.desc', icon: '!', className: 'needs-attention' };
  }

  function renderGenerationResult() {
    const container = $('#generationResult');
    if (!container) return;
    if (!state.generationIssue) {
      if (state.generation) {
        const copy = generationStatusCopy(state.validation?.status || state.generation.status);
        const undo = state.previousState ? `<button id="undoApply" class="button" type="button">${t('gen.undo')}</button>` : '';
        container.innerHTML = `<div class="generation-status ${copy.className}"><span class="status-icon" aria-hidden="true">${copy.icon}</span><div><strong>${t(copy.key)}</strong><small>${t('gen.appliedNote')}</small></div><div class="generation-status-actions"><a class="button" href="#preview">${t('gen.preview')}</a>${undo}</div></div>`;
      } else {
        container.innerHTML = `<p class="generation-empty">${t('tokens.empty')}</p>`;
      }
      return;
    }
    const proposal = state.generationIssue.proposal;
    const copy = generationStatusCopy(proposal.validation.status);
    const failures = proposal.validation.requiredFailures || [];
    const taskRows = failures.length ? `<ul class="generation-tasks">${failures.map(failure => `<li><strong>${failure.theme} · ${failure.tokenId}</strong><span>${t('gen.failureDetail', { token: failure.relationshipId, actual: Number(failure.actual).toFixed(2), required: Number(failure.required).toFixed(1) })}</span>${failure.recovery ? `<em>${t('gen.recovery', { recovery: failure.recovery })}</em>` : ''}</li>`).join('')}</ul>` : '';
    const summary = failures.length ? `<p class="generation-summary">${t('gen.taskSummary', { count: failures.length })}</p>` : '';
    container.innerHTML = `<div class="generation-status ${copy.className}"><span class="status-icon" aria-hidden="true">${copy.icon}</span><div><strong>${t(copy.key)}</strong><small>${t('gen.failureStatusDesc')}</small></div></div>
      ${summary}
      ${taskRows}
      <p class="generation-note">${t('gen.failureNote')}</p>
      <div class="generation-actions">
        <button id="dismissGenerationIssue" class="button" type="button">${t('gen.dismiss')}</button>
      </div>`;
  }

  function renderContextSourceNote() {
    const note = $('#contextSourceNote');
    if (!note) return;
    const source = state.context.source;
    note.textContent = source === 'generated' ? t('context.source.generated')
      : source === 'provided' ? t('context.source.provided')
      : source === 'locked' ? t('context.source.locked')
      : '';
  }

  function renderWebsiteTokenStatus() {
    const element = $('#websiteTokenStatus');
    if (!element) return;
    if (!state.validation) {
      element.innerHTML = '';
      return;
    }
    const copy = generationStatusCopy(state.validation.status);
    const failures = state.validation.requiredFailures || [];
    element.innerHTML = `<div class="generation-status ${copy.className}"><span class="status-icon" aria-hidden="true">${copy.icon}</span><div><strong>${t(copy.key)}</strong><small>${t(copy.descKey)}</small></div></div>${failures.length ? `<p class="generation-summary">${t('gen.taskSummary', { count: failures.length })}</p>` : ''}`;
  }

  function tokenSourceLabel(value) {
    if (value.sourceKind === 'measured-ink') return t('tokens.measured');
    if (value.sourceKind === 'context-color') return t('tokens.contextBackground');
    const definition = model.roles[value.sourceRole];
    return definition ? `${definition.label} ${value.sourceStep}` : value.sourceRole;
  }

  function renderWebsiteTokens() {
    const container = $('#websiteTokens');
    if (!container) return;
    renderWebsiteTokenStatus();
    if (!state.websiteTokens) {
      container.innerHTML = `<p class="website-tokens-empty">${t('tokens.empty')}</p>`;
      return;
    }
    const contract = window.WebsiteTokenContract;
    const light = state.websiteTokens.light.values;
    const dark = state.websiteTokens.dark.values;
    const order = [
      ['surfaces', 'tokens.group.surfaces'],
      ['content', 'tokens.group.content'],
      ['borders-and-focus', 'tokens.group.bordersAndFocus'],
      ['action-primary', 'tokens.group.actions'],
      ['action-secondary', 'tokens.group.actions'],
      ['action-destructive', 'tokens.group.actions'],
      ['fields', 'tokens.group.fields'],
      ['feedback', 'tokens.group.feedback'],
      ['accent', 'tokens.group.accent'],
    ];
    const html = order.map(([group, labelKey]) => {
      const tokens = (contract.tokenGroups[group] || []).filter(token => light[token.id] || dark[token.id]);
      if (!tokens.length) return '';
      const rows = tokens.map(token => {
        const lightValue = light[token.id];
        const darkValue = dark[token.id];
        return `<tr><td class="token-name"><code>${token.css}</code></td><td><span class="token-swatch" style="background:${lightValue.hex}"></span><code>${lightValue.hex}</code><small>${tokenSourceLabel(lightValue)}</small></td><td><span class="token-swatch" style="background:${darkValue.hex}"></span><code>${darkValue.hex}</code><small>${tokenSourceLabel(darkValue)}</small></td></tr>`;
      }).join('');
      return `<div class="token-group"><h3>${t(labelKey)}</h3><div class="token-table-scroll"><table class="token-table"><thead><tr><th></th><th>${t('tokens.light')}</th><th>${t('tokens.dark')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }).join('');
    container.innerHTML = html || `<p class="website-tokens-empty">${t('tokens.empty')}</p>`;
  }

  let toastTimer;
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1700);
  }

  seedColor.addEventListener('input', event => setRoleSeed(event.target.value));
  hexInput.addEventListener('change', event => setRoleSeed(event.target.value));
  [hueRange, chromaRange, lightRange].forEach(input => input.addEventListener('input', setRoleFromOklch));
  backgroundColorInput.addEventListener('input', event => setContextFromHex('background', event.target.value));
  backgroundHexInput.addEventListener('change', event => setContextFromHex('background', event.target.value));
  textColorInput.addEventListener('input', event => setContextFromHex('text', event.target.value));
  textHexInput.addEventListener('change', event => setContextFromHex('text', event.target.value));
  targetSelect.addEventListener('change', () => {
    state.target = Number(targetSelect.value);
    renderAll();
  });
  $('#brandSourceSelect').addEventListener('change', () => {
    $('#quickBrandHexField').hidden = $('#brandSourceSelect').value !== 'hex';
  });
  $('#generateSystem').addEventListener('click', generateWebsiteSystem);
  $('#secondaryStrategy').addEventListener('change', event => {
    const strategy = event.target.value;
    state.roles.secondary.strategy = strategy;
    state.roles.secondary.enabled = strategy !== 'none';
    if (strategy === 'none') state.roles.secondary.seed = null;
    else {
      const suggestions = model.makeSecondarySuggestions(state.roles.brand.seed, strategy);
      state.roles.secondary.seed = suggestions[0].hex;
    }
    renderAll();
  });
  $('#lockRole').addEventListener('click', () => {
    const ownerId = activeOwnerId();
    const role = activeRoleState();
    role.locked = !role.locked;
    state.userLocks[ownerId] = role.locked;
    renderAll();
  });
  $('#generateSemantics').addEventListener('click', generateSemanticColors);
  $('#optimizeSemantics').addEventListener('click', optimizeSemanticColors);
  $('#generateStarterSet').addEventListener('click', generateStarterSet);
  $('#addPair').addEventListener('click', addPair);
  $('#copyCss').addEventListener('click', () => copy(cssOutput(), t('toast.cssCopied')));
  $('#copyJson').addEventListener('click', () => copy(jsonOutput(), t('toast.jsonCopied')));
  $('#copyTailwind').addEventListener('click', () => {
    const adapter = state.websiteTokens ? window.WebsiteTokenContract.serializeTailwind(state.websiteTokens) : '';
    if (!adapter) {
      showToast(t('tokens.empty'));
      return;
    }
    copy(adapter, t('toast.tailwindCopied'));
  });
  $('#saveProject').addEventListener('click', saveProject);
  $('#newProject').addEventListener('click', newProject);
  $('#downloadJson').addEventListener('click', downloadJson);
  $('#importFile').addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    if (file) handleImportFile(file);
  });

  document.addEventListener('change', event => {
    const pairField = event.target.closest('[data-pair-field]');
    if (pairField) updatePairField(pairField);
  });

  document.addEventListener('click', event => {
    const dismissTarget = event.target.closest('#dismissGenerationIssue');
    if (dismissTarget) {
      dismissGenerationIssue();
      return;
    }
    const undoTarget = event.target.closest('#undoApply');
    if (undoTarget) {
      undoApply();
      return;
    }
    const editRoleTarget = event.target.closest('[data-edit-role]');
    if (editRoleTarget) {
      state.activeRole = editRoleTarget.dataset.editRole;
      renderAll();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      $('#step-candidates').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      revealStep($('#step-candidates'));
      return;
    }
    const removePairTarget = event.target.closest('[data-remove-pair]');
    if (removePairTarget) {
      state.savedPairs = state.savedPairs.filter(pair => pair.key !== removePairTarget.dataset.removePair);
      renderAll();
      showToast(t('toast.pairRemoved'));
      return;
    }
    const roleTarget = event.target.closest('[data-select-role]');
    if (roleTarget) {
      state.activeRole = roleTarget.dataset.selectRole;
      renderAll();
      return;
    }
    const secondaryTarget = event.target.closest('[data-secondary-hex]');
    if (secondaryTarget) {
      state.roles.secondary.seed = secondaryTarget.dataset.secondaryHex;
      state.roles.secondary.enabled = true;
      renderAll();
      return;
    }
    const copyTarget = event.target.closest('[data-copy]');
    if (!copyTarget) return;
    copy(copyTarget.dataset.copy, copyTarget.dataset.copyLabel || t('toast.copied'));
    if (copyTarget.dataset.applyColor) {
      setRoleSeed(copyTarget.dataset.applyColor);
      hexInput.focus({ preventScroll: true });
      hexInput.select();
    }
  });

  document.querySelectorAll('[data-preview-theme]').forEach(button => button.addEventListener('click', () => {
    const theme = button.dataset.previewTheme;
    document.querySelectorAll('[data-preview-theme]').forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    $('#lightPreview').hidden = theme !== 'light';
    $('#darkPreview').hidden = theme !== 'dark';
  }));

  const languageButtons = [...document.querySelectorAll('[data-language]')];
  const stepSections = [...document.querySelectorAll('[data-workflow-step]')];
  function stepMark(section) {
    return section.querySelector('[data-step-toggle]');
  }
  // The mark takes its name from the step title it sits beside (aria-labelledby),
  // so four collapse controls announce four different names instead of one
  // repeated string. State is carried by aria-expanded alone.
  function updateStepMarkLabels() {
    stepSections.forEach(section => {
      const mark = stepMark(section);
      if (!mark) return;
      mark.setAttribute('aria-expanded', String(!section.classList.contains('is-collapsed')));
    });
  }
  // Any route that scrolls to a step has to open it first; scrolling to a
  // collapsed heading looks like the action did nothing.
  function revealStep(section) {
    if (!section) return;
    section.classList.remove('is-collapsed');
    section.dataset.touched = 'true';
    updateStepMarkLabels();
  }
  function applyLanguage(language) {
    i18n.setLanguage(language);
    state.language = language;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    languageButtons.forEach(button => {
      const active = button.dataset.language === language;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    i18n.apply(document);
    updateStepMarkLabels();
    renderAll();
  }
  languageButtons.forEach(button => button.addEventListener('click', () => applyLanguage(button.dataset.language)));
  // A step starts untouched and its mark breathes. The first interaction anywhere
  // inside that section stops the pulse for good, so breathing reads as "not
  // looked at yet" rather than as decoration.
  stepSections.forEach(section => {
    section.dataset.touched = 'false';
    const settle = () => { section.dataset.touched = 'true'; };
    section.addEventListener('pointerdown', settle);
    section.addEventListener('focusin', settle);
    const mark = stepMark(section);
    if (!mark) return;
    mark.addEventListener('click', () => {
      section.classList.toggle('is-collapsed');
      updateStepMarkLabels();
    });
  });

  targetSelect.value = String(state.target);
  applyLanguage('en');
  loadStoredProject();
})();
