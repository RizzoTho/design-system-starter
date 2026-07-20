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

  const state = {
    context: { ...model.defaults.context },
    target: model.defaults.target,
    activeRole: model.defaults.activeRole,
    roles: model.createInitialRoles(),
    palettes: {},
    assignments: {},
    diagnostics: [],
    savedPairs: [],
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

  function savedPairId(roleId, foreground, background) {
    return `${roleId}:${foreground}:${background}`;
  }

  function renderSavedPairs() {
    $('#savedPairCount').textContent = String(state.savedPairs.length);
    if (!state.savedPairs.length) {
      $('#savedPairs').innerHTML = `<p class="saved-pairs-empty">${t('saved.empty')}</p>`;
      return;
    }
    $('#savedPairs').innerHTML = state.savedPairs.map(pair => {
      const ratio = contrast(pair.foreground, pair.background);
      const pass = ratio >= state.target;
      const roleLabel = model.roles[pair.roleId].label;
      return `<div class="saved-pair">
        <span class="saved-pair-sample" style="background:${pair.background};color:${pair.foreground}">Aa</span>
        <span class="saved-pair-copy"><strong>${roleLabel}</strong><small>${pair.foreground} → ${pair.background}</small></span>
        <em class="${pass ? 'pass' : 'fail'}">${ratio.toFixed(1)}:1 · ${pass ? 'PASS' : 'FAIL'}</em>
        <button type="button" data-remove-pair="${savedPairId(pair.roleId, pair.foreground, pair.background)}" aria-label="${t('saved.remove')}">×</button>
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
    $('#pairList').innerHTML = model.roleOrder.map(roleId => {
      const definition = model.roles[roleId];
      if (!roleIsEnabled(roleId)) {
        return `<div class="pair pair-disabled"><span class="pair-swatch">—</span><span class="pair-copy"><strong>${definition.label}</strong><span>${t('fit.disabled')}</span></span></div>`;
      }
      const color = roleSeed(roleId);
      const onBackground = contrast(color, state.context.background);
      const textOnCandidate = contrast(state.context.text, color);
      const measuredOnColor = textColor(color);
      const measuredOnRatio = contrast(measuredOnColor, color);
      const bgLabel = fitLabel(onBackground, target);
      const onLabel = fitLabel(measuredOnRatio, target);
      const alias = definition.aliasOf ? ` · ${t('role.uses', { role: model.roles[definition.aliasOf].label })}` : '';
      return `<button class="pair" data-copy="${definition.label}: ${color}; ${color} on ${state.context.background}; ${measuredOnColor} on ${color}" data-copy-label="${t('toast.fitCopied')}" title="${definition.label} contrast"><span class="pair-swatch" style="background:${color};color:${measuredOnColor}">Aa</span><span class="pair-copy"><strong>${definition.label}<em>${color}${alias}</em></strong><span>${t('fit.onBackground', { color })} · ${onBackground.toFixed(2)}:1<br />${t('fit.fixedText')} · ${textOnCandidate.toFixed(2)}:1<br />${t('fit.measured', { color: measuredOnColor })} · ${measuredOnRatio.toFixed(2)}:1</span></span><span class="fit-badges"><i class="fit-badge ${fitClass(bgLabel)}">BG ${bgLabel}</i><i class="fit-badge ${fitClass(onLabel)}">ON ${onLabel}</i></span></button>`;
    }).join('');
  }

  function renderMatrix() {
    if (!scale.length) {
      $('#matrix').innerHTML = '';
      $('#matrixNote').textContent = t('matrix.noPalette');
      return;
    }
    const target = state.target;
    const header = '<div></div>' + scale.map(item => `<div class="matrix-head"><i style="background:${item.hex}"></i>${item.step}</div>`).join('');
    const rows = scale.map(foreground => `<div class="matrix-label"><span style="color:${foreground.hex}">●</span>&nbsp; ${foreground.step} · ${foreground.hex}</div>` + scale.map(background => {
      const ratio = contrast(foreground.hex, background.hex);
      const pass = ratio >= target;
      const pairId = savedPairId(state.activeRole, foreground.hex, background.hex);
      const saved = state.savedPairs.some(pair => savedPairId(pair.roleId, pair.foreground, pair.background) === pairId);
      const safeInk = textColor(background.hex);
      const ratioBackground = safeInk === '#FFFFFF' ? 'rgba(0,0,0,.58)' : 'rgba(255,255,255,.72)';
      return `<button class="matrix-cell ${pass ? 'pass' : 'fail'} ${saved ? 'saved' : ''}" data-save-pair="true" data-pair-role="${state.activeRole}" data-pair-foreground="${foreground.hex}" data-pair-background="${background.hex}" style="background:${background.hex};color:${safeInk};--ratio-bg:${ratioBackground}" title="${foreground.hex} on ${background.hex} · ${ratio.toFixed(2)}:1 · ${pass ? 'PASS' : 'FAIL'}" aria-label="${foreground.hex} on ${background.hex}, contrast ${ratio.toFixed(2)} to 1, ${pass ? 'PASS' : 'FAIL'}${saved ? `, ${t('saved.status')}` : ''}"><span class="matrix-sample" style="color:${foreground.hex}">Aa</span><span class="matrix-ratio">${ratio.toFixed(1)}</span></button>`;
    }).join('')).join('');
    $('#matrix').innerHTML = header + rows;
    const passCount = scale.reduce((sum, foreground) => sum + scale.filter(background => contrast(foreground.hex, background.hex) >= target).length, 0);
    const targetLabel = target === 7 ? t('target.aaa') : target === 3 ? t('target.large') : t('target.normal');
    $('#matrixNote').textContent = t('matrix.summary', { passed: passCount, total: scale.length * scale.length, target: targetLabel });
  }

  function renderAssignments() {
    const visibleRoles = model.roleOrder.filter(roleId => roleIsEnabled(roleId));
    $('#assignmentList').innerHTML = visibleRoles.map(roleId => {
      const definition = model.roles[roleId];
      if (definition.aliasOf) {
        return `<div class="assignment-row alias-row"><div><strong>${definition.label}</strong><small>${t('role.aliasOf', { role: model.roles[definition.aliasOf].label })}</small></div><span class="assignment-alias">${t('role.usesAssignments', { role: model.roles[definition.aliasOf].label })}</span></div>`;
      }
      const themes = state.assignments[roleId];
      return `<div class="assignment-row"><div><strong>${definition.label}</strong><small>${roleSeed(roleId)}</small></div>${['light', 'dark'].map(theme => {
        const assignment = themes[theme];
        return `<div class="assignment-theme"><b>${t('assignment.theme', { theme: theme.toUpperCase() })}</b><span title="Subtle ${assignment.subtle.step}" style="--assignment-color:${assignment.subtle.hex}"><i></i>${t('assignment.subtle')}</span><span title="Border/Icon ${assignment.borderIcon.step} · ${assignment.borderIcon.ratioOnSubtle.toFixed(2)}:1" style="--assignment-color:${assignment.borderIcon.hex}"><i></i>${t('assignment.border')} ${assignment.borderIcon.pass ? '✓' : '!'}</span><span title="Bold ${assignment.bold.step}" style="--assignment-color:${assignment.bold.hex}"><i></i>${t('assignment.bold')}</span><span title="On-bold · ${assignment.onBold.ratio.toFixed(2)}:1" style="--assignment-color:${assignment.onBold.hex}"><i></i>${t('assignment.on')} ${assignment.onBold.pass ? '✓' : '!'}</span></div>`;
      }).join('')}</div>`;
    }).join('');
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
              <div class="product-field"><label for="previewReleaseNote-${theme}">${t('preview.releaseNote')}</label><input id="previewReleaseNote-${theme}" value="${t('preview.releaseNoteValue')}" readonly /><small><span aria-hidden="true">i</span>${t('preview.focusHelp')}</small></div>
              <div class="product-field invalid"><label for="previewOwner-${theme}">${t('preview.ownerEmail')}</label><input id="previewOwner-${theme}" value="jane@" aria-invalid="true" readonly /><small><span aria-hidden="true">!</span>${t('preview.invalidEmail')}</small></div>
            </section>
            <aside class="product-aside">
              <section class="info-callout"><span aria-hidden="true">i</span><div><strong>${t('preview.a11yReview')}</strong><p>${t('preview.contrastUpdate')}</p></div></section>
              <section class="product-panel compact-panel"><div class="product-panel-head"><div><h4>${t('preview.health')}</h4><p>${t('preview.latestChecks')}</p></div><span class="success-dot">✓</span></div><dl class="health-list"><div><dt>${t('preview.componentsReady')}</dt><dd>18 / 20</dd></div><div><dt>${t('preview.contrastChecks')}</dt><dd class="success-text">${t('preview.passed')}</dd></div><div><dt>${t('preview.blockingIssues')}</dt><dd class="danger-text">${t('preview.open')}</dd></div></dl><button class="warning-button">${t('preview.reviewWarning')}</button></section>
              <section class="product-panel people-panel"><div><h4>${t('preview.collaborators')}</h4><p>${t('preview.collaboratorsDesc')}</p></div><div class="avatar-stack"><span>JA</span><span>MK</span><span>RL</span><b>+3</b></div></section>
            </aside>
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
    renderAssignments();
    renderSavedPairs();
    renderMatrix();
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
      pairCounts[pair.roleId] = (pairCounts[pair.roleId] || 0) + 1;
      const name = `${pair.roleId}-${pairCounts[pair.roleId]}`;
      lines.push(`  --pair-${name}-foreground: ${pair.foreground};`);
      lines.push(`  --pair-${name}-background: ${pair.background};`);
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
      pairs: state.savedPairs.map(pair => ({
        ...pair,
        ratio: Number(contrast(pair.foreground, pair.background).toFixed(2)),
        passesTarget: contrast(pair.foreground, pair.background) >= state.target,
      })),
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
  $('#copyCss').addEventListener('click', () => copy(cssOutput(), t('toast.cssCopied')));
  $('#copyJson').addEventListener('click', () => copy(jsonOutput(), t('toast.jsonCopied')));

  document.addEventListener('click', event => {
    const removePairTarget = event.target.closest('[data-remove-pair]');
    if (removePairTarget) {
      state.savedPairs = state.savedPairs.filter(pair => savedPairId(pair.roleId, pair.foreground, pair.background) !== removePairTarget.dataset.removePair);
      renderAll();
      showToast(t('toast.pairRemoved'));
      return;
    }
    const pairTarget = event.target.closest('[data-save-pair]');
    if (pairTarget) {
      const pair = {
        roleId: pairTarget.dataset.pairRole,
        foreground: pairTarget.dataset.pairForeground,
        background: pairTarget.dataset.pairBackground,
      };
      const id = savedPairId(pair.roleId, pair.foreground, pair.background);
      const alreadySaved = state.savedPairs.some(item => savedPairId(item.roleId, item.foreground, item.background) === id);
      if (!alreadySaved) state.savedPairs.push(pair);
      renderAll();
      copy(`${pair.foreground} on ${pair.background}`, t(alreadySaved ? 'toast.pairAlreadySaved' : 'toast.pairSaved'));
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
