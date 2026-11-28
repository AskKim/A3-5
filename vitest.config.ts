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
      // json-summary keeps coverage/coverage-summary.json, so "which file is the biggest
      // uncovered pot" is answered from the last run instead of a full re-measurement.
      reporter: ['text-summary', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**', 'src/**/*.d.ts'],
      // Ratchet, re-measured 2026-11-28 after mounting the developer console (previously zero
      // coverage) and the external importer panel's staging flow over all of src/** (unimported
      // files count): st 59.91, br 50.12, fn 45.66, ln 61.36. Floors sit a point under the measured
      // values so a new untested module fails the gate instead of quietly diluting the gains.
      thresholds: {
        statements: 62,
        branches: 52,
        functions: 48,
        lines: 64,
        // Per-area floors stop one area's gains paying for another's gaps: components are the
        // thinnest shell (27.6% st) and domain the most mature (85.3% st), so a global average
        // alone would let new untested screens ride on tested domain code.
        'src/domain/**': { statements: 84, branches: 69, functions: 84, lines: 86 },
        'src/components/**': { statements: 36, branches: 29, functions: 24, lines: 38 },
        'src/storage/**': { statements: 55, branches: 43, functions: 49, lines: 57 },
        'src/hooks/**': { statements: 45, branches: 33, functions: 44, lines: 46 },
        'src/engine/**': { statements: 72, branches: 62, functions: 79, lines: 74 },
      },
    },
  },
});
