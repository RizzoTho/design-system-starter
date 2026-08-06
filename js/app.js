(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const {
    hexToRgb,
    rgbToHex,
    hexToOklch,
    mapOklchToSrgb,
    shiftLightness,
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

  function previewMarkup(theme) {
    const brand = state.assignments.brand[theme];
    const neutral = state.assignments.neutral[theme];
    const secondary = state.assignments.secondary?.[theme];
    const success = state.assignments.success[theme];
    const warning = state.assignments.warning[theme];
    const danger = state.assignments.danger[theme];
    const information = state.assignments.information[theme];
    const optionalAction = secondary || neutral;
    const paletteRoles = model.paletteOwnerIds.filter(roleId => roleIsEnabled(roleId));
    const variables = [
      `--pv-brand:${brand.bold.hex}`,
      `--pv-on-brand:${brand.onBold.hex}`,
      `--pv-brand-soft:${brand.subtle.hex}`,
      `--pv-brand-line:${brand.borderIcon.hex}`,
      `--pv-neutral-soft:${neutral.subtle.hex}`,
      `--pv-neutral-line:${neutral.borderIcon.hex}`,
      `--pv-neutral-bold:${neutral.bold.hex}`,
      `--pv-on-neutral:${neutral.onBold.hex}`,
      `--pv-secondary:${optionalAction.bold.hex}`,
      `--pv-on-secondary:${optionalAction.onBold.hex}`,
      `--pv-success-soft:${success.subtle.hex}`,
      `--pv-success-line:${success.borderIcon.hex}`,
      `--pv-success:${success.bold.hex}`,
      `--pv-on-success:${success.onBold.hex}`,
      `--pv-warning-soft:${warning.subtle.hex}`,
      `--pv-warning-line:${warning.borderIcon.hex}`,
      `--pv-warning:${warning.bold.hex}`,
      `--pv-on-warning:${warning.onBold.hex}`,
      `--pv-danger-soft:${danger.subtle.hex}`,
      `--pv-danger-line:${danger.borderIcon.hex}`,
      `--pv-danger:${danger.bold.hex}`,
      `--pv-on-danger:${danger.onBold.hex}`,
      `--pv-info-soft:${information.subtle.hex}`,
      `--pv-info-line:${information.borderIcon.hex}`,
      `--pv-info:${information.bold.hex}`,
      `--pv-on-info:${information.onBold.hex}`,
    ].join(';');

    return `<div class="product-preview" style="${variables}">
      <aside class="product-sidebar" aria-label="${t('aria.workspaceNavigation')}">
        <div class="product-mark"><span>W</span><strong>${t('preview.mark')}</strong></div>
        <nav class="product-nav">
          <a class="active" href="#preview"><span aria-hidden="true">⌂</span>${t('preview.nav.overview')}</a>
          <a href="#preview"><span aria-hidden="true">✓</span>${t('preview.nav.tasks')} <b>4</b></a>
          <a href="#preview"><span aria-hidden="true">◫</span>${t('preview.nav.files')}</a>
          <a href="#preview"><span aria-hidden="true">↗</span>${t('preview.nav.activity')}</a>
        </nav>
        <div class="product-team"><span class="product-avatar">RM</span><span><strong>${t('preview.team')}</strong><small>${t('preview.collaboratorsCount')}</small></span></div>
      </aside>
      <div class="product-main">
        <header class="product-toolbar"><span>${t('preview.projects')} <b>/ ${t('preview.projectName')}</b></span><div><button class="product-icon-button" aria-label="${t('aria.notifications')}">●</button><span class="product-avatar">JA</span></div></header>
        <main class="product-body">
          <section class="product-heading"><div><span class="product-kicker">${t('preview.kicker')}</span><h3>${t('preview.projectName')}</h3><p>${t('preview.projectDesc')}</p></div><div class="product-actions"><button class="product-secondary-button">${t('preview.invite')}</button><button class="product-primary-button">${t('preview.publish')}</button></div></section>
          <div class="product-grid">
            <section class="product-panel task-panel">
              <div class="product-panel-head"><div><h4>${t('preview.checklist')}</h4><p>${t('preview.progress')}</p></div><span class="progress-badge">57%</span></div>
              <div class="product-progress"><i></i></div>
              <ul class="task-list">
                <li class="done"><span class="task-state">✓</span><span><strong>${t('preview.task.hierarchy')}</strong><small>${t('preview.task.completedBy')}</small></span><em>${t('preview.task.done')}</em></li>
                <li><span class="task-state regular">○</span><span><strong>${t('preview.task.focus')}</strong><small>${t('preview.task.assigned')}</small></span><em>${t('preview.task.regular')}</em></li>
                <li class="warning"><span class="task-state">!</span><span><strong>${t('preview.task.empty')}</strong><small>${t('preview.task.review')}</small></span><em>${t('preview.task.warning')}</em></li>
              </ul>
              <div class="product-field focused"><label for="previewReleaseNote-${theme}">${t('preview.releaseNote')}</label><input id="previewReleaseNote-${theme}" value="${t('preview.releaseNoteValue')}" readonly /><small><span aria-hidden="true">i</span>${t('preview.focusHelp')}</small></div>
              <div class="product-field invalid"><label for="previewOwner-${theme}">${t('preview.ownerEmail')}</label><input id="previewOwner-${theme}" value="jane@" aria-invalid="true" readonly /><small><span aria-hidden="true">!</span>${t('preview.invalidEmail')}</small></div>
            </section>
            <aside class="product-aside">
              <section class="info-callout"><span aria-hidden="true">i</span><div><strong>${t('preview.a11yReview')}</strong><p>${t('preview.contrastUpdate')}</p></div></section>
              <section class="product-panel compact-panel"><div class="product-panel-head"><div><h4>${t('preview.health')}</h4><p>${t('preview.latestChecks')}</p></div><span class="success-dot">✓</span></div><dl class="health-list"><div><dt>${t('preview.componentsReady')}</dt><dd>18 / 20</dd></div><div><dt>${t('preview.contrastChecks')}</dt><dd class="success-text">${t('preview.passed')}</dd></div><div><dt>${t('preview.blockingIssues')}</dt><dd class="danger-text">${t('preview.open')}</dd></div></dl><button class="warning-button">${t('preview.reviewWarning')}</button></section>
              <section class="product-panel people-panel"><div><h4>${t('preview.collaborators')}</h4><p>${t('preview.collaboratorsDesc')}</p></div><div class="avatar-stack"><span>JA</span><span>MK</span><span>RL</span><b>+3</b></div></section>
            </aside>
          </div>
          <div class="product-insights">
            <section class="product-panel palette-panel">
              <div class="product-panel-head"><div><h4>${t('preview.paletteTitle')}</h4><p>${t('preview.paletteDesc')}</p></div><span class="palette-count">${paletteRoles.length}</span></div>
              <div class="semantic-card-grid">${paletteRoles.map(roleId => {
                const assignment = state.assignments[roleId][theme];
                return `<div class="semantic-card"><span class="semantic-card-swatch" style="--semantic-subtle:${assignment.subtle.hex};--semantic-border:${assignment.borderIcon.hex};--semantic-bold:${assignment.bold.hex};--semantic-on:${assignment.onBold.hex}"><i></i><b>Aa</b></span><span><strong>${model.roles[roleId].label}</strong><small>${assignment.bold.hex}</small></span></div>`;
              }).join('')}</div>
            </section>
            <section class="product-panel signals-panel">
              <div class="product-panel-head"><div><h4>${t('preview.signalsTitle')}</h4><p>${t('preview.signalsDesc')}</p></div><span class="information-dot">i</span></div>
              <div class="signal-bars" aria-label="${t('preview.signalsTitle')}"><span><i style="--signal-width:78%;--signal-color:var(--pv-success)"></i><b>78%</b><small>${t('preview.signal.completed')}</small></span><span><i style="--signal-width:42%;--signal-color:var(--pv-warning)"></i><b>42%</b><small>${t('preview.signal.risk')}</small></span><span><i style="--signal-width:14%;--signal-color:var(--pv-danger)"></i><b>14%</b><small>${t('preview.signal.blocked')}</small></span></div>
              <div class="product-empty"><span aria-hidden="true">□</span><div><strong>${t('preview.emptyTitle')}</strong><small>${t('preview.emptyDesc')}</small></div></div>
            </section>
          </div>
        </main>
      </div>
    </div>`;
  }

  function renderPreviews() {
    const lightCanvas = state.context.background;
    const lightText = state.context.text;
    const lightCard = shiftLightness(lightCanvas, hexToOklch(lightCanvas).L > 0.5 ? 2 : 6);
    const lightMuted = shiftLightness(lightCanvas, hexToOklch(lightCanvas).L > 0.5 ? -3 : 6);
    const darkCanvas = shiftLightness(lightCanvas, -70);
    const darkText = textColor(darkCanvas);
    const darkCard = shiftLightness(darkCanvas, 5);
    const darkMuted = shiftLightness(darkCanvas, 9);
    const neutralScale = paletteForRole('neutral').scale;
    const findMutedText = (background, theme) => {
      const candidateSteps = theme === 'light' ? [600, 700, 800, 900, 950] : [400, 300, 200, 100, 50];
      const required = Math.max(4.5, state.target);
      return candidateSteps
        .map(step => neutralScale.find(token => token.step === step))
        .find(token => contrast(token.hex, background) >= required)?.hex
        || textColor(background);
    };
    const setVariables = (element, values) => Object.entries(values).forEach(([key, value]) => element.style.setProperty(key, value));
    setVariables($('#lightPreview'), { '--light-canvas': lightCanvas, '--light-text': lightText, '--pv-canvas': lightCanvas, '--pv-panel': lightCard, '--pv-muted-surface': lightMuted, '--pv-text': lightText, '--pv-muted-text': findMutedText(lightCard, 'light'), '--pv-line': shiftLightness(lightText, 62) });
    setVariables($('#darkPreview'), { '--dark-canvas': darkCanvas, '--dark-text': darkText, '--pv-canvas': darkCanvas, '--pv-panel': darkCard, '--pv-muted-surface': darkMuted, '--pv-text': darkText, '--pv-muted-text': findMutedText(darkCard, 'dark'), '--pv-line': shiftLightness(darkText, -56) });
    $('#lightPreviewContent').innerHTML = previewMarkup('light');
    $('#darkPreviewContent').innerHTML = previewMarkup('dark');
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
    const specs = model.starterPairSpecs(state.palettes, state.roles, state.assignments, state.target);
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

  function cssOutput() {
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

  function jsonOutput() {
    const reference = Object.fromEntries(Object.entries(state.palettes).map(([roleId, palette]) => [roleId, Object.fromEntries(palette.scale.map(token => [token.step, token.hex]))]));
    return JSON.stringify({
      context: state.context,
      target: state.target,
      roles: Object.fromEntries(model.roleOrder.map(roleId => [roleId, model.roles[roleId].aliasOf ? { aliasOf: model.roles[roleId].aliasOf } : { ...state.roles[roleId] }])),
      reference,
      semantic: state.assignments,
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
    }, null, 2);
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
    const role = activeRoleState();
    role.locked = !role.locked;
    renderAll();
  });
  $('#generateSemantics').addEventListener('click', generateSemanticColors);
  $('#optimizeSemantics').addEventListener('click', optimizeSemanticColors);
  $('#generateStarterSet').addEventListener('click', generateStarterSet);
  $('#addPair').addEventListener('click', addPair);
  $('#copyCss').addEventListener('click', () => copy(cssOutput(), t('toast.cssCopied')));
  $('#copyJson').addEventListener('click', () => copy(jsonOutput(), t('toast.jsonCopied')));

  document.addEventListener('change', event => {
    const pairField = event.target.closest('[data-pair-field]');
    if (pairField) updatePairField(pairField);
  });

  document.addEventListener('click', event => {
    const editRoleTarget = event.target.closest('[data-edit-role]');
    if (editRoleTarget) {
      state.activeRole = editRoleTarget.dataset.editRole;
      renderAll();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      $('#step-candidates').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setActiveStep('candidates');
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

  const stepDock = $('#stepDock');
  const stepDockToggle = $('#stepDockToggle');
  const stepLinks = [...document.querySelectorAll('[data-step-link]')];
  const languageButtons = [...document.querySelectorAll('[data-language]')];
  function setActiveStep(name) {
    stepLinks.forEach(link => link.classList.toggle('active', link.dataset.stepLink === name));
  }
  function updateStepDockToggleLabel() {
    const minimized = stepDock.classList.contains('minimized');
    stepDockToggle.setAttribute('aria-label', t(minimized ? 'aria.expandSteps' : 'aria.minimizeSteps'));
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
    updateStepDockToggleLabel();
    renderAll();
  }
  languageButtons.forEach(button => button.addEventListener('click', () => applyLanguage(button.dataset.language)));
  stepDockToggle.addEventListener('click', () => {
    const minimized = stepDock.classList.toggle('minimized');
    stepDockToggle.textContent = minimized ? '+' : '−';
    stepDockToggle.setAttribute('aria-expanded', String(!minimized));
    updateStepDockToggleLabel();
  });
  stepLinks.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    setActiveStep(link.dataset.stepLink);
  }));
  const observedTargets = [...document.querySelectorAll('[data-workflow-step]'), $('#export')];
  const stepObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    setActiveStep(visible.target.id === 'export' ? 'export' : visible.target.dataset.workflowStep);
  }, { rootMargin: '-20% 0px -58% 0px', threshold: [0, 0.15, 0.4] });
  observedTargets.forEach(target => stepObserver.observe(target));

  targetSelect.value = String(state.target);
  applyLanguage('en');
})();
