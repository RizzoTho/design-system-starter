/*
 * The dropdown control.
 *
 * A native <select> on macOS opens its menu on top of the trigger so the current
 * option lines up with the closed control: pressing a select reads as "the
 * control was covered", not "the control expanded". Every <select> on the page is
 * upgraded to a listbox whose menu always opens below its trigger, and above it
 * only when the viewport leaves no room below, so the control stays visible while
 * it is open.
 *
 * The native <select> stays in the DOM as the value owner. `app.js` keeps reading
 * and writing `.value`, `change` still bubbles from the same element with the same
 * data attributes, and `i18n.apply()` keeps translating the <option> text. This
 * file owns presentation and keyboard behavior only; it never owns a value.
 */
(() => {
  'use strict';

  const OPTION_HEIGHT = 34;
  const MENU_CHROME = 16;
  const MAX_VISIBLE_OPTIONS = 6;
  const controllers = new WeakMap();
  const openControls = new Set();
  let sequence = 0;

  /* One document listener for the whole page: a pair-editor select is rebuilt on
     every render, so a listener per instance would accumulate one dead closure
     per row per render. */
  document.addEventListener('pointerdown', event => {
    [...openControls].forEach(controller => {
      if (!controller.wrapper.contains(event.target)) controller.close();
    });
  });

  function selectKey(native) {
    if (native.id) return native.id;
    const names = Object.keys(native.dataset).sort();
    if (names.length) return names.map(name => `${name}:${native.dataset[name]}`).join('|');
    return `select-${sequence + 1}`;
  }

  function labelFor(native) {
    const direct = native.getAttribute('aria-label');
    if (direct) return direct;
    if (native.id) {
      const explicit = document.querySelector(`label[for="${native.id}"]`);
      if (explicit) return explicit.textContent.trim();
    }
    const wrapping = native.closest('label');
    return wrapping ? wrapping.textContent.trim() : '';
  }

  function checkMark() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'select-check');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M5 13L9 17L19 7');
    svg.append(path);
    return svg;
  }

  function chevron() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'select-chevron');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm2.5 4.5 3.5 3.5 3.5-3.5');
    svg.append(path);
    return svg;
  }

  function upgradeOne(native) {
    const id = sequence += 1;
    const key = selectKey(native);
    const label = labelFor(native);

    const wrapper = document.createElement('div');
    wrapper.className = 'select';
    wrapper.dataset.selectKey = key;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    if (native.id) trigger.id = `${native.id}-trigger`;
    if (label) trigger.setAttribute('aria-label', label);

    const valueWrap = document.createElement('span');
    valueWrap.className = 'select-value-wrap';
    const value = document.createElement('span');
    value.className = 'select-value';
    /* The trigger reserves the width of its widest option so picking a shorter
       one does not resize the control under the pointer. */
    const sizer = document.createElement('span');
    sizer.className = 'select-sizer';
    sizer.setAttribute('aria-hidden', 'true');
    valueWrap.append(value, sizer);
    trigger.append(valueWrap, chevron());

    const menu = document.createElement('ul');
    menu.className = 'select-menu';
    menu.id = `select-listbox-${id}`;
    menu.hidden = true;
    menu.setAttribute('role', 'listbox');
    if (label) menu.setAttribute('aria-label', label);

    native.parentNode.insertBefore(wrapper, native);
    wrapper.append(trigger, menu, native);
    native.classList.add('select-native');
    native.setAttribute('tabindex', '-1');
    native.setAttribute('aria-hidden', 'true');

    /* A label pointing at this control now points at the trigger: a <button> is
       labelable, so the accessible name and click-to-focus both survive. */
    if (native.id) {
      const explicit = document.querySelector(`label[for="${native.id}"]`);
      if (explicit) explicit.htmlFor = trigger.id;
    }

    let open = false;
    let activeIndex = 0;
    let ignoreNextClick = false;

    function options() {
      return [...native.options];
    }

    function renderMenu() {
      const items = options();
      menu.textContent = '';
      items.forEach((option, index) => {
        const item = document.createElement('li');
        item.className = 'select-option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(index === native.selectedIndex));
        item.dataset.active = String(index === activeIndex);
        item.textContent = option.textContent;
        if (index === native.selectedIndex) item.append(checkMark());
        item.addEventListener('mouseenter', () => setActive(index));
        item.addEventListener('click', () => commit(index));
        menu.append(item);
      });
    }

    function setActive(index) {
      activeIndex = index;
      [...menu.children].forEach((item, position) => {
        item.dataset.active = String(position === index);
      });
      const item = menu.children[index];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }

    function setOpen(next) {
      if (next === open) return;
      open = next;
      trigger.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      if (!open) {
        openControls.delete(controller);
        trigger.removeAttribute('aria-controls');
        return;
      }
      openControls.add(controller);
      trigger.setAttribute('aria-controls', menu.id);
      /* Measure before showing: a row sitting against the bottom of the viewport
         opens upward instead of pushing its menu off-screen. */
      const box = trigger.getBoundingClientRect();
      const needed = Math.min(native.options.length, MAX_VISIBLE_OPTIONS) * OPTION_HEIGHT + MENU_CHROME;
      const dropUp = box.bottom + needed > window.innerHeight && box.top > needed;
      menu.dataset.drop = dropUp ? 'up' : 'down';
      renderMenu();
      setActive(native.selectedIndex < 0 ? 0 : native.selectedIndex);
    }

    function commit(index) {
      const option = native.options[index];
      setOpen(false);
      if (!option || option.value === native.value) {
        trigger.focus();
        return;
      }
      native.value = option.value;
      sync();
      native.dispatchEvent(new Event('change', { bubbles: true }));
      /* A change can re-render the section that owns this control. Return focus to
         whichever trigger now holds this key so the keyboard keeps its place. */
      const current = document.querySelector(`[data-select-key="${CSS.escape(key)}"] .select-trigger`);
      if (current) current.focus();
    }

    function sync() {
      const index = native.selectedIndex < 0 ? 0 : native.selectedIndex;
      const items = options();
      value.textContent = items[index] ? items[index].textContent : '';
      sizer.textContent = '';
      items.forEach(option => {
        const shadow = document.createElement('span');
        shadow.textContent = option.textContent;
        sizer.append(shadow);
      });
      trigger.disabled = native.disabled;
      if (open) renderMenu();
    }

    trigger.addEventListener('pointerdown', () => {
      if (trigger.disabled) return;
      ignoreNextClick = true;
      setOpen(!open);
    });
    /* Pointer and keyboard take separate paths. The pointer toggles on
       pointerdown, and the click that follows it — or the click a <label>
       forwards here — must not toggle the menu a second time. */
    trigger.addEventListener('click', () => {
      if (ignoreNextClick) {
        ignoreNextClick = false;
        return;
      }
      setOpen(true);
    });

    wrapper.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (!open) return;
        event.stopPropagation();
        setOpen(false);
        trigger.focus();
        return;
      }
      if (!open) {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
          event.preventDefault();
          ignoreNextClick = true;
          setOpen(true);
        }
        return;
      }
      const last = native.options.length - 1;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive(Math.min(activeIndex + 1, last));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActive(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActive(last);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        ignoreNextClick = true;
        commit(activeIndex);
      } else if (event.key === 'Tab') {
        setOpen(false);
      }
    });

    const controller = { wrapper, sync, close: () => setOpen(false) };
    controllers.set(wrapper, controller);
    sync();
    return controller;
  }

  /*
   * Upgrade every select that is not upgraded yet and re-read the ones that are.
   * `app.js` calls this at the end of every render, which is where new pair-editor
   * selects appear, where programmatic values land, and where a language switch
   * has just replaced the option text.
   */
  function upgrade(root = document) {
    root.querySelectorAll('select:not(.select-native)').forEach(upgradeOne);
    root.querySelectorAll('.select').forEach(wrapper => {
      const controller = controllers.get(wrapper);
      if (controller) controller.sync();
    });
  }

  window.SelectControl = Object.freeze({ upgrade });

  upgrade();
})();
