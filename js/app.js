const $ = (selector) => document.querySelector(selector);
const seedColor = $('#seedColor');
const hexInput = $('#hexInput');
const hueRange = $('#hueRange');
const satRange = $('#satRange');
const lightRange = $('#lightRange');
const backgroundColorInput = $('#backgroundColor');
const backgroundHexInput = $('#backgroundHexInput');
const textColorInput = $('#textColor');
const textHexInput = $('#textHexInput');
const targetSelect = $('#targetSelect');
const {
  steps,
  hexToRgb,
  rgbToHex,
  hslToRgb,
  rgbToHsl,
  shiftLightness,
  contrast,
  textColor,
  makeScaleFor,
} = window.ColorEngine;
const roleDefaults = window.ColorRoleModel.defaults;
let current = { ...roleDefaults.current };
const candidates = { ...roleDefaults.candidates };
const context = { ...roleDefaults.context };
let activeRole = roleDefaults.activeRole;
let scale = [];

function makeScale() { return makeScaleFor(current.hex); }

function updateInputs() {
  seedColor.value = current.hex.toLowerCase();
  hexInput.value = current.hex;
  hueRange.value = current.h; satRange.value = current.s; lightRange.value = current.l;
  $('#seedValue').textContent = current.hex; $('#hueValue').textContent = `${current.h}°`; $('#satValue').textContent = `${current.s}%`; $('#lightValue').textContent = `${current.l}%`;
  $('#summaryHex').textContent = `${current.hex} · HSL ${current.h} ${current.s} ${current.l}`;
  $('#candidateLabel').textContent = `${activeRole === 'brand' ? 'Brand' : 'Neutral'} color`;
  $('#summaryLabel').textContent = `ACTIVE ${activeRole.toUpperCase()}`;
  $('#summaryTitle').textContent = activeRole === 'brand' ? 'Brand color' : 'Neutral color';
  $('#scaleRole').textContent = activeRole === 'brand' ? 'Brand' : 'Neutral';
  backgroundColorInput.value = context.background.toLowerCase(); backgroundHexInput.value = context.background;
  textColorInput.value = context.text.toLowerCase(); textHexInput.value = context.text;
  $('#backgroundValue').textContent = context.background; $('#textValue').textContent = context.text;
}
function update() {
  scale = makeScale();
  const seedInk = textColor(current.hex);
  $('#seedSummary').style.setProperty('--seed', current.hex); $('#seedSummary').style.setProperty('--seed-ink', seedInk);
  renderContextStatus(); renderScale(); renderPairings(); renderMatrix(); renderPreviews();
}
function setFromHex(value, sync = true) {
  const rgb = hexToRgb(value.toUpperCase());
  if (!rgb) { hexInput.setAttribute('aria-invalid', 'true'); return; }
  hexInput.removeAttribute('aria-invalid');
  current.hex = rgbToHex(rgb); Object.assign(current, rgbToHsl(rgb)); candidates[activeRole] = current.hex;
  if (sync) updateInputs();
  update();
}
function setContextFromHex(kind, value) {
  const rgb = hexToRgb(value.toUpperCase());
  const input = kind === 'background' ? backgroundHexInput : textHexInput;
  if (!rgb) { input.setAttribute('aria-invalid', 'true'); return; }
  input.removeAttribute('aria-invalid'); context[kind] = rgbToHex(rgb); updateInputs(); update();
}
function renderScale() {
  const usage = { 50:'Page', 100:'Surface', 200:'Hover', 300:'Border', 400:'Muted', 500:'Seed', 600:'Action', 700:'Pressed', 800:'Strong', 900:'Dark', 950:'Deep' };
  $('#scale').innerHTML = scale.map(item => `<button class="swatch" data-copy="${item.hex}" data-apply-color="${item.hex}" data-copy-label="Applied and copied" title="${item.step} · ${usage[item.step]} · 应用并复制 ${item.hex}"><span class="swatch-color" style="background:${item.hex}">${item.step === 600 ? '<span class="swatch-rec">REC</span>' : ''}<span class="swatch-hex">${item.hex}</span></span><span class="swatch-meta"><b>${item.step}</b><span class="token-use">${usage[item.step]}</span><span class="contrast-values">W ${item.ratioOnWhite.toFixed(1)} · K ${item.ratioOnBlack.toFixed(1)}</span></span></button>`).join('');
}
function fitLabel(ratio, target) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= target) return 'PASS';
  if (ratio >= 3) return '3:1';
  return 'FAIL';
}
function fitClass(label) { return label === 'FAIL' ? 'fail' : label === '3:1' ? 'warn' : 'pass'; }
function renderContextStatus() {
  const ratio = contrast(context.text, context.background), pass = ratio >= 4.5;
  const level = ratio >= 7 ? 'AAA' : pass ? 'AA' : '';
  const el = $('#contextStatus');
  el.classList.toggle('pass', pass); el.classList.toggle('fail', !pass);
  el.innerHTML = `<span class="status-icon" aria-hidden="true">${pass ? '✓' : '!'}</span><span><strong>${pass ? `PASS · ${level}` : 'FAIL'}</strong><small>Text on Background · ${ratio.toFixed(2)}:1<br />Required · 4.5:1</small></span>`;
  $('#contextCanvas').style.setProperty('--context-bg', context.background);
  $('#contextCanvas').style.setProperty('--context-text', context.text);
}
function renderPairings() {
  const target = Number(targetSelect.value);
  $('#pairList').innerHTML = ['brand', 'neutral'].map(role => {
    const name = role === 'brand' ? 'Brand' : 'Neutral', color = candidates[role];
    const onBackground = contrast(color, context.background), textOnCandidate = contrast(context.text, color);
    const bgLabel = fitLabel(onBackground, target), textLabel = fitLabel(textOnCandidate, target);
    return `<button class="pair" data-copy="${name}: ${color}; ${color} on ${context.background}; ${context.text} on ${color}" data-copy-label="Fit result copied" title="复制 ${name} 的 contrast 结果"><span class="pair-swatch" style="background:${color};color:${textColor(color)}">Aa</span><span class="pair-copy"><strong>${name} <em>${color}</em></strong><span>${color} on Background · ${onBackground.toFixed(2)}:1<br />Text on ${name} · ${textOnCandidate.toFixed(2)}:1</span></span><span class="fit-badges"><i class="fit-badge ${fitClass(bgLabel)}">BG ${bgLabel}</i><i class="fit-badge ${fitClass(textLabel)}">TEXT ${textLabel}</i></span></button>`;
  }).join('');
}
function renderMatrix() {
  const target = Number(targetSelect.value); const header = `<div></div>` + scale.map(item => `<div class="matrix-head"><i style="background:${item.hex}"></i>${item.step}</div>`).join('');
  const rows = scale.map(fg => `<div class="matrix-label"><span style="color:${fg.hex}">●</span>&nbsp; ${fg.step} · ${fg.hex}</div>` + scale.map(bg => {
    const ratio = contrast(fg.hex, bg.hex), pass = ratio >= target, safeInk = textColor(bg.hex);
    const ratioBg = safeInk === '#FFFFFF' ? 'rgba(0,0,0,.58)' : 'rgba(255,255,255,.72)';
    return `<button class="matrix-cell ${pass ? 'pass' : 'fail'}" data-copy="${fg.hex} on ${bg.hex}" data-copy-label="Color pair copied" style="background:${bg.hex};color:${safeInk};--ratio-bg:${ratioBg}" title="${fg.hex} on ${bg.hex} · ${ratio.toFixed(2)}:1 · ${pass ? 'Pass' : 'Fail'}" aria-label="${fg.hex} on ${bg.hex}, contrast ${ratio.toFixed(2)} to 1, ${pass ? 'passes' : 'fails'} current target"><span class="matrix-sample" style="color:${fg.hex}">Aa</span><span class="matrix-ratio">${ratio.toFixed(1)}</span></button>`;
  }).join('')).join('');
  $('#matrix').innerHTML = header + rows;
  const passCount = scale.reduce((sum, fg) => sum + scale.filter(bg => contrast(fg.hex,bg.hex) >= target).length, 0);
  $('#matrixNote').innerHTML = `<b>${passCount} / ${scale.length * scale.length}</b> pairs pass ${target === 7 ? 'AAA' : target === 3 ? 'AA large text' : 'AA normal text'} · ratio is rounded to one decimal place.`;
}
function buttonTextFor(background) {
  const light = '#FFF9F0';
  return contrast(light, background) >= 4.5 ? light : textColor(background);
}
function renderPreviews() {
  const brandScale = makeScaleFor(candidates.brand), neutralScale = makeScaleFor(candidates.neutral);
  const brandButton = brandScale[6].hex, neutralButton = neutralScale[6].hex;
  const lightCanvas = context.background, lightText = context.text;
  const lightCard = shiftLightness(lightCanvas, rgbToHsl(hexToRgb(lightCanvas)).l > 50 ? -3 : 6);
  const darkCanvas = shiftLightness(lightCanvas, -70), darkText = textColor(darkCanvas), darkCard = shiftLightness(darkCanvas, 5);
  const setVars = (el, values) => Object.entries(values).forEach(([key, value]) => el.style.setProperty(key, value));
  setVars($('#lightPreview'), {'--brand-button': brandButton, '--on-brand': buttonTextFor(brandButton), '--neutral-button': neutralButton, '--on-neutral': buttonTextFor(neutralButton), '--candidate-marker': candidates.neutral, '--light-canvas': lightCanvas, '--light-text': lightText, '--demo-card': lightCard, '--demo-text': lightText, '--link': candidates.brand});
  setVars($('#darkPreview'), {'--brand-button': brandButton, '--on-brand': buttonTextFor(brandButton), '--neutral-button': neutralButton, '--on-neutral': buttonTextFor(neutralButton), '--candidate-marker': candidates.neutral, '--dark-canvas': darkCanvas, '--dark-text': darkText, '--demo-card': darkCard, '--demo-text': darkText, '--link': candidates.brand});
}
function copy(value, message = 'Copied') {
  const fallback = () => {
    const area = document.createElement('textarea');
    area.value = value; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select();
    const copied = document.execCommand('copy'); area.remove();
    if (!copied) throw new Error('Clipboard copy was rejected');
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).then(() => showToast(message)).catch(() => { try { fallback(); showToast(message); } catch (error) { showToast('Copy failed — please copy manually'); } });
    return;
  }
  try { fallback(); showToast(message); } catch (error) { showToast('Copy failed — please copy manually'); }
}
function cssOutput() { return `:root {\n  --color-background: ${context.background};\n  --color-text: ${context.text};\n  --color-brand: ${candidates.brand};\n  --color-neutral: ${candidates.neutral};\n${scale.map(item => `  --color-primary-${item.step}: ${item.hex};`).join('\n')}\n  --color-on-primary: ${textColor(current.hex)};\n  --color-canvas: ${context.background};\n}`; }
function jsonOutput() { return JSON.stringify({ context, candidates, activeRole, target: Number(targetSelect.value), activeScale: Object.fromEntries(scale.map(item => [item.step, item.hex])) }, null, 2); }
let toastTimer;
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1700); }

seedColor.addEventListener('input', e => setFromHex(e.target.value));
hexInput.addEventListener('change', e => setFromHex(e.target.value));
[hueRange, satRange, lightRange].forEach(input => input.addEventListener('input', () => { current.h = Number(hueRange.value); current.s = Number(satRange.value); current.l = Number(lightRange.value); current.hex = rgbToHex(hslToRgb(current.h,current.s,current.l)); candidates[activeRole] = current.hex; updateInputs(); update(); }));
backgroundColorInput.addEventListener('input', e => setContextFromHex('background', e.target.value));
backgroundHexInput.addEventListener('change', e => setContextFromHex('background', e.target.value));
textColorInput.addEventListener('input', e => setContextFromHex('text', e.target.value));
textHexInput.addEventListener('change', e => setContextFromHex('text', e.target.value));
document.querySelectorAll('.role-mode button').forEach(button => button.addEventListener('click', () => {
  candidates[activeRole] = current.hex;
  activeRole = button.dataset.role;
  const nextHex = candidates[activeRole];
  current = { hex: nextHex, ...rgbToHsl(hexToRgb(nextHex)) };
  document.querySelectorAll('.role-mode button').forEach(item => item.classList.toggle('active', item === button));
  updateInputs(); update();
}));
targetSelect.addEventListener('change', update);
document.addEventListener('click', e => {
  const copyTarget = e.target.closest('[data-copy]');
  if (!copyTarget) return;
  const appliedColor = copyTarget.dataset.applyColor;
  copy(copyTarget.dataset.copy, copyTarget.dataset.copyLabel || 'Copied');
  if (appliedColor) {
    setFromHex(appliedColor);
    hexInput.focus({ preventScroll: true });
    hexInput.select();
  }
});
$('#copyCss').addEventListener('click', () => copy(cssOutput(), 'CSS variables copied'));
$('#copyJson').addEventListener('click', () => copy(jsonOutput(), 'JSON copied'));
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

const stepDock = $('#stepDock'), stepDockToggle = $('#stepDockToggle');
const stepLinks = [...document.querySelectorAll('[data-step-link]')];
function setActiveStep(name) { stepLinks.forEach(link => link.classList.toggle('active', link.dataset.stepLink === name)); }
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
}, { rootMargin: '-20% 0px -58% 0px', threshold: [0, .15, .4] });
observedTargets.forEach(target => stepObserver.observe(target));

updateInputs(); update();
