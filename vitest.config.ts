import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: ['default', '@d2t/vitest-ctrf-json-reporter'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/test-utils/**',
        'ctrf/',
      ],
    },
    environment: 'node',
    globals: false,
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules/', 'dist/', 'coverage/', 'src/test-utils/**'],
  },
})
