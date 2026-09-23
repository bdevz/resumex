import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Lambda's CommonJS suites use node:test; run them separately with node --test.
    include: ['src/**/*.test.ts'],
  },
});