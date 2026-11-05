import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-config-next already registers the jsx-a11y plugin; enable its full
    // recommended rule set on top.
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'jsx-a11y/label-has-associated-control': [
        'error',
        { controlComponents: ['Input', 'Select', 'Textarea'], assert: 'either', depth: 3 },
      ],
      // The spec mandates alt text of the form "Photo of <name>, <designation>".
      'jsx-a11y/img-redundant-alt': 'off',
    },
  },
  {
    files: ['scripts/**', 'loadtest/**', 'tests/**'],
    rules: { 'no-console': 'off' },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'public/sw.js',
    'lib/supabase/database.types.ts',
    'playwright-report/**',
    'test-results/**',
    'coverage/**',
    // k6 scripts run in the k6 runtime, not Node/browser.
    'loadtest/**',
  ]),
]);

export default eslintConfig;
