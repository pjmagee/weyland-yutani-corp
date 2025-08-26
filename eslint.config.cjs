// ESLint v9+ flat config (CommonJS)
const globals = require('globals');
const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        d3: 'readonly',
      },
    },
    rules: {
      // Require blank lines between certain statements for readability
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'directive', next: '*' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'const', next: '*' },
        { blankLine: 'always', prev: 'let', next: '*' },
        { blankLine: 'always', prev: 'var', next: '*' },
        { blankLine: 'always', prev: '*', next: 'if' },
        { blankLine: 'always', prev: '*', next: 'for' },
        { blankLine: 'always', prev: '*', next: 'while' },
        { blankLine: 'always', prev: '*', next: 'switch' },
        { blankLine: 'always', prev: '*', next: 'try' }
      ],
      // Enforce a blank line between top-level function declarations
      'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }]
    }
  },
  js.configs.recommended,
  prettier,
  {
    ignores: ['node_modules/**', 'dist/**', 'eslint.config.*'],
  },
];
