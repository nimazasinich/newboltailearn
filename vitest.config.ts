import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['server/tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/**/*.test.js'],
    testTimeout: 10000,
    hookTimeout: 10000,
    env: {
      NODE_ENV: 'test'
    },
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.js',
        '*.config.ts',
        'dist/',
        'coverage/',
        'scripts/',
        'public/',
        '.github/',
        'start*.js',
        'test*.js',
        'validate*.js'
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
      }
    }
  },
});