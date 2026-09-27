import globals from 'globals';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        __APP_VERSION__: 'readonly',
        __COMMIT_HASH__: 'readonly',
        __IS_DIRTY__: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { vars: 'all', args: 'none' }],
      'no-undef': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['vite.config.js', 'playwright.config.js', 'tests/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: [
      'docs/',
      'node_modules/',
      'ios/',
      'android/',
      '.system_generated/',
    ],
  },
];
