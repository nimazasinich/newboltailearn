import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist', 'node_modules', 'server/server', '*.cjs', '*.js'] },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'no-debugger': 'error',
    },
  },
  {
    files: ['**/*.test.{ts,tsx,js,jsx}', '**/tests/**/*.{ts,tsx,js,jsx}', '**/test/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  }
];