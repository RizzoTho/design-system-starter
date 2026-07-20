(() => {
  'use strict';

  window.ColorRoleModel = Object.freeze({
    roles: Object.freeze({
      brand: Object.freeze({ label: 'Brand' }),
      neutral: Object.freeze({ label: 'Neutral' }),
    }),
    defaults: Object.freeze({
      current: Object.freeze({ hex: '#D8664A', h: 11, s: 64, l: 57 }),
      candidates: Object.freeze({ brand: '#D8664A', neutral: '#3B7A78' }),
      context: Object.freeze({ background: '#F7F3EB', text: '#25231F' }),
      activeRole: 'brand',
    }),
  });
})();
