import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'dist-supabase', 'dev-dist', 'coverage', 'playwright-report', 'test-results'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  jsxA11y.flatConfigs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'jsx-a11y/label-has-associated-control': ['error', { controlComponents: ['CommitInput'] }],
      // Scrollable previews must be reachable by keyboard.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: ['pre'], roles: ['tabpanel'] }],
    },
  },
  {
    // The domain layer stays framework-free so it can be tested and reused on its own.
    files: ['src/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-*', '@supabase/*', '@/data/*', '@/features/*'] },
      ],
    },
  },
  prettier,
);
