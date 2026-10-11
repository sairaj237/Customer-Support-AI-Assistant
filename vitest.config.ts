import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Run tests in Node environment (no browser needed for unit/property tests)
    environment: 'node',
    // Match test files inside the src directory
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
