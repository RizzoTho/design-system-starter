(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const {
    hexToRgb,
    rgbToHex,
    hexToOklch,
    oklchToHex,
    mapOklchToSrgb,
    shiftLightness,
    contrast,
    textColor,
    makePalette,
  } = window.ColorEngine;
  const model = window.ColorRoleModel;

  const state = {
    context: { ...model.defaults.context },
    target: model.defaults.target,
    activeRole: model.defaults.activeRole,
    roles: model.createInitialRoles(),
    palettes: {},
    assignments: {},
    diagnostics: [],
    secondarySuggestionIndex: 0,
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
    const alias = definition.aliasOf ? ` · uses ${model.roles[definition.aliasOf].label}` : '';

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
    $('#activeRoleDescription').textContent = definition.description;
    $('#summaryLabel').textContent = `${enabled ? 'ACTIVE' : 'DISABLED'} ${roleId.toUpperCase()}`;
    $('#summaryTitle').textContent = definition.aliasOf ? `${definition.label} uses ${model.roles[ownerId].label}` : `${definition.label} color`;
    $('#summaryHex').textContent = enabled ? `${seed} · ${formatOklch(seed)}` : 'No palette is generated';
    $('#summaryNote').textContent = definition.aliasOf ? 'No duplicate palette · edits update Neutral' : '500 keeps the exact seed';
    $('#scaleRole').textContent = definition.aliasOf ? `${definition.label} / ${model.roles[ownerId].label}` : definition.label;

    for (const input of [seedColor, hexInput, hueRange, chromaRange, lightRange]) input.disabled = !enabled;
    $('#lockRole').disabled = !enabled;
    $('#lockRole').textContent = `${role.locked ? 'Unlock' : 'Lock'} ${model.roles[ownerId].label}`;
    $('#lockRole').setAttribute('aria-pressed', String(Boolean(role.locked)));
    $('#regenerateRole').disabled = roleId === 'brand' || roleId === 'regular' || (roleId === 'secondary' && !enabled);
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
        <i style="--role-color:${seed || '#CFC8BC'}"></i><span>${definition.label}</span>${definition.aliasOf ? '<em>alias</em>' : state.roles[owner].locked ? '<em>locked</em>' : ''}
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
        ? `Alias of ${model.roles[owner].label}`
        : enabled
          ? `${seed}${state.roles[owner].locked ? ' · Locked' : ''}`
          : 'Optional · Off';
      return `<button class="role-card ${state.activeRole === roleId ? 'active' : ''}" type="button" data-select-role="${roleId}">
        <span class="role-card-swatch" style="background:${seed || '#E4DED4'};color:${seed ? textColor(seed) : '#6F675C'}">${enabled ? 'Aa' : '—'}</span>
        <span><strong>${definition.label}</strong><small>${status}</small></span>
      </button>`;
    }).join('');
  }

  function renderSecondarySuggestions() {
    const strategy = state.roles.secondary.strategy;
    const suggestions = model.makeSecondarySuggestions(state.roles.brand.seed, strategy);
    $('#secondarySuggestions').innerHTML = suggestions.map(suggestion => `<button type="button" class="suggestion" data-secondary-hex="${suggestion.hex}"><i style="background:${suggestion.hex}"></i><span>${suggestion.label}</span><b>${suggestion.hex}</b></button>`).join('');
  }

  function renderScale() {
    if (!scale.length) {
      $('#scale').innerHTML = '<div class="empty-state">Secondary 目前关闭。选择近似色或对比色策略后再生成 palette。</div>';
      return;
    }
    const usage = { 50: 'Page', 100: 'Surface', 200: 'Hover', 300: 'Border', 400: 'Muted', 500: 'Seed', 600: 'Action', 700: 'Pressed', 800: 'Strong', 900: 'Dark', 950: 'Deep' };
    $('#scale').innerHTML = scale.map(item => `<button class="swatch" data-copy="${item.hex}" data-apply-color="${item.hex}" data-copy-label="Applied and copied" title="${item.step} · ${usage[item.step]} · 应用并复制 ${item.hex}"><span class="swatch-color" style="background:${item.hex}">${item.step === 600 ? '<span class="swatch-rec">REC</span>' : ''}<span class="swatch-hex">${item.hex}</span></span><span class="swatch-meta"><b>${item.step}</b><span class="token-use">${usage[item.step]}</span><span class="contrast-values">W ${item.ratioOnWhite.toFixed(1)} · K ${item.ratioOnBlack.toFixed(1)}</span></span></button>`).join('');
  }

  function renderDiagnostics() {
    const activeDiagnostics = paletteForRole(state.activeRole)?.diagnostics || [];
    const note = $('#scaleDiagnostics');
    note.hidden = activeDiagnostics.length === 0;
    note.textContent = activeDiagnostics.length
      ? `${activeDiagnostics.length} 个 token 为进入 sRGB gamut 自动降低了 chroma；Lightness 与 Hue 尽量保持不变。`
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

  function renderContextStatus() {
    const ratio = contrast(state.context.text, state.context.background);
    const pass = ratio >= 4.5;
    const level = ratio >= 7 ? 'AAA' : pass ? 'AA' : '';
    const element = $('#contextStatus');
    element.classList.toggle('pass', pass);
    element.classList.toggle('fail', !pass);
    element.innerHTML = `<span class="status-icon" aria-hidden="true">${pass ? '✓' : '!'}</span><span><strong>${pass ? `PASS · ${level}` : 'FAIL'}</strong><small>Text on Background · ${ratio.toFixed(2)}:1<br />Required · 4.5:1</small></span>`;
    $('#contextCanvas').style.setProperty('--context-bg', state.context.background);
    $('#contextCanvas').style.setProperty('--context-text', state.context.text);
  }

  function renderPairings() {
    const target = state.target;
    $('#pairList').innerHTML = model.roleOrder.map(roleId => {
      const definition = model.roles[roleId];
      if (!roleIsEnabled(roleId)) {
        return `<div class="pair pair-disabled"><span class="pair-swatch">—</span><span class="pair-copy"><strong>${definition.label}</strong><span>Optional role is disabled</span></span></div>`;
      }
      const color = roleSeed(roleId);
      const onBackground = contrast(color, state.context.background);
      const textOnCandidate = contrast(state.context.text, color);
      const measuredOnColor = textColor(color);
      const measuredOnRatio = contrast(measuredOnColor, color);
      const bgLabel = fitLabel(onBackground, target);
      const onLabel = fitLabel(measuredOnRatio, target);
      const alias = definition.aliasOf ? ` · uses ${model.roles[definition.aliasOf].label}` : '';
      return `<button class="pair" data-copy="${definition.label}: ${color}; ${color} on ${state.context.background}; ${measuredOnColor} on ${color}" data-copy-label="Fit result copied" title="复制 ${definition.label} 的 contrast 结果"><span class="pair-swatch" style="background:${color};color:${measuredOnColor}">Aa</span><span class="pair-copy"><strong>${definition.label}<em>${color}${alias}</em></strong><span>${color} on Background · ${onBackground.toFixed(2)}:1<br />Fixed Text on role · ${textOnCandidate.toFixed(2)}:1<br />Measured ${measuredOnColor} on role · ${measuredOnRatio.toFixed(2)}:1</span></span><span class="fit-badges"><i class="fit-badge ${fitClass(bgLabel)}">BG ${bgLabel}</i><i class="fit-badge ${fitClass(onLabel)}">ON ${onLabel}</i></span></button>`;
    }).join('');
  }

  function renderMatrix() {
    if (!scale.length) {
      $('#matrix').innerHTML = '';
      $('#matrixNote').textContent = '当前角色没有 palette。';
      return;
    }
    const target = state.target;
    const header = '<div></div>' + scale.map(item => `<div class="matrix-head"><i style="background:${item.hex}"></i>${item.step}</div>`).join('');
    const rows = scale.map(foreground => `<div class="matrix-label"><span style="color:${foreground.hex}">●</span>&nbsp; ${foreground.step} · ${foreground.hex}</div>` + scale.map(background => {
      const ratio = contrast(foreground.hex, background.hex);
      const pass = ratio >= target;
      const safeInk = textColor(background.hex);
      const ratioBackground = safeInk === '#FFFFFF' ? 'rgba(0,0,0,.58)' : 'rgba(255,255,255,.72)';
      return `<button class="matrix-cell ${pass ? 'pass' : 'fail'}" data-copy="${foreground.hex} on ${background.hex}" data-copy-label="Color pair copied" style="background:${background.hex};color:${safeInk};--ratio-bg:${ratioBackground}" title="${foreground.hex} on ${background.hex} · ${ratio.toFixed(2)}:1 · ${pass ? 'Pass' : 'Fail'}" aria-label="${foreground.hex} on ${background.hex}, contrast ${ratio.toFixed(2)} to 1, ${pass ? 'passes' : 'fails'} current target"><span class="matrix-sample" style="color:${foreground.hex}">Aa</span><span class="matrix-ratio">${ratio.toFixed(1)}</span></button>`;
    }).join('')).join('');
    $('#matrix').innerHTML = header + rows;
    const passCount = scale.reduce((sum, foreground) => sum + scale.filter(background => contrast(foreground.hex, background.hex) >= target).length, 0);
    $('#matrixNote').innerHTML = `<b>${passCount} / ${scale.length * scale.length}</b> pairs pass ${target === 7 ? 'AAA' : target === 3 ? 'AA large text' : 'AA normal text'} · ratio is rounded to one decimal place.`;
  }

  function renderAssignments() {
    const visibleRoles = model.roleOrder.filter(roleId => roleIsEnabled(roleId));
    $('#assignmentList').innerHTML = visibleRoles.map(roleId => {
      const definition = model.roles[roleId];
      if (definition.aliasOf) {
        return `<div class="assignment-row alias-row"><div><strong>${definition.label}</strong><small>Alias of ${model.roles[definition.aliasOf].label}</small></div><span class="assignment-alias">Uses Neutral assignments</span></div>`;
      }
      const themes = state.assignments[roleId];
      return `<div class="assignment-row"><div><strong>${definition.label}</strong><small>${roleSeed(roleId)}</small></div>${['light', 'dark'].map(theme => {
        const assignment = themes[theme];
        return `<div class="assignment-theme"><b>${theme}</b><span title="Subtle ${assignment.subtle.step}" style="--assignment-color:${assignment.subtle.hex}"><i></i>Subtle</span><span title="Border/Icon ${assignment.borderIcon.step} · ${assignment.borderIcon.ratioOnSubtle.toFixed(2)}:1" style="--assignment-color:${assignment.borderIcon.hex}"><i></i>Border ${assignment.borderIcon.pass ? '✓' : '!'}</span><span title="Bold ${assignment.bold.step}" style="--assignment-color:${assignment.bold.hex}"><i></i>Bold</span><span title="On-bold · ${assignment.onBold.ratio.toFixed(2)}:1" style="--assignment-color:${assignment.onBold.hex}"><i></i>On ${assignment.onBold.pass ? '✓' : '!'}</span></div>`;
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
      <aside class="product-sidebar" aria-label="Workspace navigation">
        <div class="product-mark"><span>W</span><strong>Workbench</strong></div>
        <nav class="product-nav">
          <a class="active" href="#preview"><span aria-hidden="true">⌂</span>Overview</a>
          <a href="#preview"><span aria-hidden="true">✓</span>Tasks <b>4</b></a>
          <a href="#preview"><span aria-hidden="true">◫</span>Files</a>
          <a href="#preview"><span aria-hidden="true">↗</span>Activity</a>
        </nav>
        <div class="product-team"><span class="product-avatar">RM</span><span><strong>Release team</strong><small>6 collaborators</small></span></div>
      </aside>
      <div class="product-main">
        <header class="product-toolbar"><span>Projects <b>/ Website refresh</b></span><div><button class="product-icon-button" aria-label="Notifications">●</button><span class="product-avatar">JA</span></div></header>
        <main class="product-body">
          <section class="product-heading"><div><span class="product-kicker">IN PROGRESS · RELEASE 2.4</span><h3>Website refresh</h3><p>Prepare the accessibility pass before Friday’s release.</p></div><div class="product-actions"><button class="product-secondary-button">Invite</button><button class="product-primary-button">Publish update</button></div></section>
          <div class="product-grid">
            <section class="product-panel task-panel">
              <div class="product-panel-head"><div><h4>Release checklist</h4><p>4 of 7 tasks completed</p></div><span class="progress-badge">57%</span></div>
              <div class="product-progress"><i></i></div>
              <ul class="task-list">
                <li class="done"><span class="task-state">✓</span><span><strong>Confirm content hierarchy</strong><small>Completed by Jane</small></span><em>Done</em></li>
                <li><span class="task-state regular">○</span><span><strong>Review focus order</strong><small>Assigned to Marcus</small></span><em>Regular</em></li>
                <li class="warning"><span class="task-state">!</span><span><strong>Check empty states</strong><small>Needs review before release</small></span><em>Warning</em></li>
              </ul>
              <div class="product-field"><label for="previewReleaseNote-${theme}">Release note</label><input id="previewReleaseNote-${theme}" value="Improved keyboard navigation" readonly /><small><span aria-hidden="true">i</span> Visible focus uses Brand; helper text uses Information.</small></div>
              <div class="product-field invalid"><label for="previewOwner-${theme}">Owner email</label><input id="previewOwner-${theme}" value="jane@" aria-invalid="true" readonly /><small><span aria-hidden="true">!</span> Enter a complete email address.</small></div>
            </section>
            <aside class="product-aside">
              <section class="info-callout"><span aria-hidden="true">i</span><div><strong>Accessibility review</strong><p>Contrast checks update when you change a role.</p></div></section>
              <section class="product-panel compact-panel"><div class="product-panel-head"><div><h4>Release health</h4><p>Latest automated checks</p></div><span class="success-dot">✓</span></div><dl class="health-list"><div><dt>Components ready</dt><dd>18 / 20</dd></div><div><dt>Contrast checks</dt><dd class="success-text">Passed</dd></div><div><dt>Blocking issues</dt><dd class="danger-text">1 open</dd></div></dl><button class="warning-button">Review warning</button></section>
              <section class="product-panel people-panel"><div><h4>Collaborators</h4><p>Design, engineering and content</p></div><div class="avatar-stack"><span>JA</span><span>MK</span><span>RL</span><b>+3</b></div></section>
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
    if (mapped.reduced) showToast('Chroma reduced to fit sRGB');
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

  function regenerateActiveRole() {
    const roleId = state.activeRole;
    const ownerId = activeOwnerId();
    if (state.roles[ownerId].locked) {
      showToast(`${model.roles[ownerId].label} is locked`);
      return;
    }
    if (roleId === 'secondary') {
      const suggestions = model.makeSecondarySuggestions(state.roles.brand.seed, state.roles.secondary.strategy);
      if (!suggestions.length) return;
      state.secondarySuggestionIndex = (state.secondarySuggestionIndex + 1) % suggestions.length;
      state.roles.secondary.seed = suggestions[state.secondarySuggestionIndex].hex;
    } else if (roleId === 'neutral') {
      const brand = hexToOklch(state.roles.brand.seed);
      state.roles.neutral.seed = oklchToHex({ L: 0.56, C: 0.025, h: brand.h });
    } else if (model.semanticRoleIds.includes(roleId)) {
      state.roles[roleId].seed = model.makeSemanticSuggestion(roleId, state.roles.brand.seed).hex;
    }
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
    showToast(`${changed} unlocked semantic colors generated`);
  }

  function copy(value, message = 'Copied') {
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
            reportError('Copy failed — please copy manually', { error, fallbackError });
          }
        });
      return;
    }
    try {
      fallback();
      showToast(message);
    } catch (error) {
      reportError('Copy failed — please copy manually', error);
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
      state.secondarySuggestionIndex = 0;
    }
    renderAll();
  });
  $('#lockRole').addEventListener('click', () => {
    const role = activeRoleState();
    role.locked = !role.locked;
    renderAll();
  });
  $('#regenerateRole').addEventListener('click', regenerateActiveRole);
  $('#generateSemantics').addEventListener('click', generateSemanticColors);
  $('#copyCss').addEventListener('click', () => copy(cssOutput(), 'CSS variables copied'));
  $('#copyJson').addEventListener('click', () => copy(jsonOutput(), 'JSON copied'));

  document.addEventListener('click', event => {
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
    copy(copyTarget.dataset.copy, copyTarget.dataset.copyLabel || 'Copied');
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
  function setActiveStep(name) {
    stepLinks.forEach(link => link.classList.toggle('active', link.dataset.stepLink === name));
  }
  stepDockToggle.addEventListener('click', () => {
    const minimized = stepDock.classList.toggle('minimized');
    stepDockToggle.textContent = minimized ? '+' : '−';
    stepDockToggle.setAttribute('aria-expanded', String(!minimized));
    stepDockToggle.setAttribute('aria-label', minimized ? '展开步骤导航' : '最小化步骤导航');
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
  renderAll();
})();
