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
    // The OPFS multi-vault restore test legitimately runs ~6s under a full parallel suite; the 5s
    // default turned a slow machine into a red build rather than a meaningful failure.
    testTimeout: 15000,
    exclude: [...configDefaults.exclude, 'import/**', 'old/**', 'android-wrapper/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**', 'src/**/*.d.ts'],
      // Ratchet, re-measured 2026-11-28 after the storage failure-path and render-test
      // passes over all of src/** (unimported files count): st 52.69, br 43.02,
      // fn 38.77, ln 54.11. Floors sit a point under the measured values so a new
      // untested module fails the gate instead of quietly diluting the render gains.
      thresholds: { statements: 51, branches: 42, functions: 37, lines: 53 },
    },
  },
});
