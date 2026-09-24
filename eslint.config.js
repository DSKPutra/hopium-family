// @ts-check
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/expo-env.d.ts',
      'supabase/functions/**',
      'apps/mobile/ios/**',
      'apps/mobile/android/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    rules: {
      // i18next/dayjs-style default instances trip this rule without real bugs.
      'import/no-named-as-default-member': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-warning-comments': ['error', { terms: ['todo', 'fixme'], location: 'anywhere' }],
      'prettier/prettier': 'warn',
    },
  },
  {
    files: ['**/*.config.js', '**/babel.config.js', 'scripts/**'],
    rules: { 'no-console': 'off' },
  },
]);
