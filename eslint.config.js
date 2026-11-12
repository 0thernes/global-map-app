import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/',
      'js/',
      'vendor/',
      'data/',
      'textures/',
      'shots/',
      'docs/screenshots/',
      'dist/',
      'coverage/',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser } },
  },
  {
    files: ['scripts/**/*.mjs', 'test/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node } },
  },
  {
    // Playwright scripts: code inside page.evaluate() runs in the browser
    files: [
      'test/smoke.mjs',
      'test/screens.mjs',
      'test/ui_audit.mjs',
      'test/ui_views.mjs',
      'test/a11y.mjs',
      'scripts/audit/*.mjs',
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
