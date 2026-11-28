import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
      '@engine': path.resolve(import.meta.dirname, 'src/engine'),
      '@features': path.resolve(import.meta.dirname, 'src/features'),
      '@app': path.resolve(import.meta.dirname, 'src/app'),
      '@domain': path.resolve(import.meta.dirname, 'src/domain'),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, 'import/**', 'old/**', 'android-wrapper/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**', 'src/**/*.d.ts'],
      // Ratchet, measured 2026-11-28 over all of src/** (unimported files count):
      // st 48.01, br 40.31, fn 34.35, ln 49.23.
      thresholds: { statements: 47, branches: 39, functions: 33, lines: 48 },
    },
  },
});
