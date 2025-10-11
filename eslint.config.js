// @ts-check
import js from '@eslint/js'
import typescript from 'typescript-eslint'

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'docs/**',
      'ctrf/**',
      '*.js',
      '*.mjs',
      'src/test-utils/**',
      'scripts/**',
      'examples/**',
      'final/**',
      'src/__tests__/**',
      'src/test-utils/**',
      'src/test-utils/**',
      '**/*.test.ts',
      'src/cli.ts',
    ],
  },
  js.configs.recommended,
  ...typescript.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
]
