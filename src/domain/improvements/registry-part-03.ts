/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Improvement registry entries IMP-035 … IMP-051 (17 of 85).
 *
 * Split out of `improvementRegistry.ts` so the registry stays reviewable as it grows. The public
 * surface (`IMPROVEMENTS_REGISTRY`, invariant evaluation, markdown/JSON export) still lives in
 * `src/domain/improvementRegistry.ts` and is unchanged.
 */

import type { ImprovementEntry } from './types';

export const REGISTRY_PART_03: ImprovementEntry[] = [
  {
    id: 'IMP-035',
    title: 'Batch Cage Card, Compact Mini-Sheet & Pedigree Printing from Herd Multi-Select',
    category: 'species-ux',
    source: 'session',
    summary:
      'Allows breeders to multi-select animals in `HerdScreen` and generate a single printable `.HTM` / Print-to-PDF sheet across four formats: 8-up kennel/cage cards, 1/4-page (4-up) mini 3-gen pedigree sheets, 3-generation 4x6 photo cards (2-up Letter or direct 4x6 paper), and stacked formal 3–6G pedigrees, backed by pure TS HTML generation (`batchPrint.ts`), bounded on-demand batch photo hydration (`loadAnimalPhotoDataUrlsBatch`), and live layout/option controls in `PrintPreviewModal`.',
    userIntent:
      'Print cage cards, 4-up mini pedigrees, 4x6 photo cards, or stacked pedigrees for multiple selected animals in one pass for shows, auctions, or transport.',
    files: [
      'src/domain/batchPrint.ts',
      'src/domain/__tests__/batchPrint.test.ts',
      'src/hooks/useBarnStore.ts',
      'src/App.tsx',
      'src/components/PrintPreviewModal.tsx',
      'src/components/HerdScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/batchPrint.ts',
        requiredSubstrings: [
          'BATCH_PRINT_LAYOUTS',
          'generateBatchPrintHtml',
          'resolveBatchPrintAnimals',
          'computeBatchPrintPageCount',
          'buildBatchPrintFileName',
        ],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['loadAnimalPhotoDataUrlsBatch'],
      },
      {
        filePath: 'src/components/PrintPreviewModal.tsx',
        requiredSubstrings: [
          'batchPrintOptions',
          'onChangeBatchPrintOptions',
          'BATCH_PRINT_LAYOUTS',
        ],
      },
      {
        filePath: 'src/components/HerdScreen.tsx',
        requiredSubstrings: [
          'openBatchPrintPreview',
          'generateBatchPrintHtml',
          'resolveBatchPrintAnimals',
          'Batch Print (',
        ],
      },
    ],
    restorePlaybook: [
      'Restore `src/domain/batchPrint.ts` and `src/domain/__tests__/batchPrint.test.ts`.',
      'Keep `loadAnimalPhotoDataUrlsBatch` exported from `src/hooks/useBarnStore.ts` and passed as `onLoadFullPhotosBatch` to `HerdScreen` in `src/App.tsx`.',
      'Keep `batchPrintOptions` controls in `src/components/PrintPreviewModal.tsx` and multi-select `Batch Print` wiring in `src/components/HerdScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-036',
    title: 'QR-Coded Cage Cards & Visual Hutch-Row / Facility Pen Board',
    category: 'species-ux',
    source: 'session',
    userIntent:
      'Embed scannable QR codes on printable cage cards that open the animal profile route directly in the PWA, and provide a visual Hutch-by-Hutch / Cage Row & Pasture Board grouping pens by barn section with linked feedlot inventories and recurring maintenance reminders.',
    summary:
      'Adds a zero-dependency pure TS ISO/IEC 18004 QR code encoder and single-path SVG renderer (`qrCode.ts`), embeds toggleable scannable QR profile deep links into both thermal single cage cards (`generateThermalCageCardHtml`) and 8-up batch cage cards (`batchPrint.ts`), parses `?route=herd&animalId=...` and `?route=dashboard&cageId=...` on startup in `useBarnStore.ts`, extends `CageLocation` and SQLite/JSON serialization with housing unit type, feedlot inventory, and recurring maintenance schedules, and adds the pure `facilityBoard.ts` engine plus interactive `FacilityPenBoard` inside `SpeciesDashboardScreen` (with compact list toggle, full-screen board modal, quick stock adjustments, 1-click maintenance logging/task scheduling, and pen/row QR card printing).',
    files: [
      'src/domain/qrCode.ts',
      'src/domain/facilityBoard.ts',
      'src/domain/models.ts',
      'src/domain/batchPrint.ts',
      'src/domain/syncAndExports.ts',
      'src/domain/__tests__/qrCode.test.ts',
      'src/domain/__tests__/facilityBoard.test.ts',
      'src/domain/__tests__/batchPrint.test.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/FacilityPenBoard.tsx',
      'src/components/PrintPreviewModal.tsx',
      'src/components/HerdScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/qrCode.ts',
        requiredSubstrings: [
          'encodeQrMatrix',
          'renderQrSvg',
          'buildAnimalProfileDeepLink',
          'buildCageBoardDeepLink',
          'parseAppDeepLinkParams',
        ],
      },
      {
        filePath: 'src/domain/facilityBoard.ts',
        requiredSubstrings: [
          'buildFacilityBoardModel',
          'evaluateCageMaintenanceStatus',
          'evaluateCageFeedStatus',
          'buildCageMaintenanceTaskDraft',
          'matchesFacilityBoardFilter',
        ],
      },
      {
        filePath: 'src/domain/batchPrint.ts',
        requiredSubstrings: ['includeQrCodes', 'supportsQrCode', 'buildAnimalProfileDeepLink'],
      },
      {
        filePath: 'src/domain/syncAndExports.ts',
        requiredSubstrings: ['ThermalCageCardOptions', 'buildAnimalProfileDeepLink', 'renderQrSvg'],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: [
          'feed_lot_name',
          'maintenance_interval_days',
          'last_maintenance_date_iso',
        ],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['parseAppDeepLinkParams', 'highlightedCageId', 'setHighlightedCageId'],
      },
      {
        filePath: 'src/components/FacilityPenBoard.tsx',
        requiredSubstrings: [
          'FacilityPenBoard',
          'buildCageMaintenanceTaskDraft',
          'onPrintCageCardsForAnimals',
        ],
      },
      {
        filePath: 'src/components/SpeciesDashboardScreen.tsx',
        requiredSubstrings: [
          'FacilityPenBoard',
          'facilityBoardModel',
          'handlePrintCageCardsForAnimals',
          'highlightedCageId',
        ],
      },
    ],
    restorePlaybook: [
      'Restore `src/domain/qrCode.ts`, `src/domain/facilityBoard.ts`, and their tests in `src/domain/__tests__/qrCode.test.ts` and `src/domain/__tests__/facilityBoard.test.ts`.',
      'Keep extended `CageLocation` fields in `src/domain/models.ts`, SQLite columns/migrations in `src/storage/webSqliteAdapter.ts`, and JSON round-trip parsing in `src/domain/syncAndExports.ts`.',
      'Keep QR code rendering in `src/domain/syncAndExports.ts` (`generateThermalCageCardHtml`) and `src/domain/batchPrint.ts` (`includeQrCodes`) wired to `PrintPreviewModal.tsx`, `HerdScreen.tsx`, and `SpeciesDashboardScreen.tsx`.',
      'Keep `FacilityPenBoard.tsx` mounted in `SpeciesDashboardScreen.tsx` and `highlightedCageId` deep-link resolution in `useBarnStore.ts` and `src/App.tsx`.',
    ],
  },
  {
    id: 'IMP-037',
    title: 'Side-by-Side Multi-Candidate Pairing Comparison Matrix (Breeding Lab)',
    category: 'species-ux',
    source: 'session',
    summary:
      'Adds a pure TypeScript multi-candidate pairing matrix engine (`pairingMatrix.ts`) and interactive `PairingComparisonMatrix` table inside `BreedingScreen` so breeders can compare one Dam against multiple candidate Sires (or one Sire against multiple candidate Dams) side by side for projected Wright COI %, shared bottleneck ancestors, carrier and genetic health/lethal risk flags, and predicted coat varieties, with 1-click loading into the Cage-Side Pairing Logger.',
    userIntent:
      'Compare one dam against multiple candidate sires (or vice versa) in a single Breeding Lab table showing COI %, shared bottleneck ancestors, carrier risk flags, and predicted coat varieties side by side.',
    files: [
      'src/domain/pairingMatrix.ts',
      'src/domain/__tests__/pairingMatrix.test.ts',
      'src/components/PairingComparisonMatrix.tsx',
      'src/components/BreedingScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/pairingMatrix.ts',
        requiredSubstrings: [
          'buildPairingComparisonMatrix',
          'selectDefaultMatrixCandidateIds',
          'createSpeciesCoiEvaluator',
          'analyzePairingCarrierRisksFromAnalyses',
          'simulatePairingGenetics',
        ],
      },
      {
        filePath: 'src/components/PairingComparisonMatrix.tsx',
        requiredSubstrings: [
          'PairingComparisonMatrix',
          'buildPairingComparisonMatrix',
          'ColorGeneticsNotice',
          'onLoadPairingInLogger',
        ],
      },
      {
        filePath: 'src/components/BreedingScreen.tsx',
        requiredSubstrings: ['PairingComparisonMatrix', 'handleLoadPairingFromMatrix'],
      },
    ],
    restorePlaybook: [
      'Restore `src/domain/pairingMatrix.ts` and its unit tests in `src/domain/__tests__/pairingMatrix.test.ts`.',
      'Restore `src/components/PairingComparisonMatrix.tsx` with anchor role toggle, candidate multi-select, COI/bottleneck/carrier/variety columns, and `ColorGeneticsNotice`.',
      'Mount `<PairingComparisonMatrix />` and `handleLoadPairingFromMatrix` inside `src/components/BreedingScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-038',
    title: 'Color-Coded Allele Provenance, Unique-Ancestor Dimming & ARBA Registration Flags',
    category: 'species-ux',
    source: 'session',
    summary:
      'Adds a pure TypeScript allele provenance classifier (`analyzeAlleleProvenance` in `geneticsEngine.ts`) and pedigree convergence + ARBA 3-generation registration evaluator (`pedigreeAnalysis.ts`), a reusable color-coded genotype renderer (`ColoredGenotypeDisplay.tsx`), Dim Unique convergence spotlighting and red ARBA registration deficiency overlays on `PedigreeScreen`, and provenance displays with legend across `HerdScreen` and `BreedingScreen`.',
    userIntent:
      'Color-code alleles by inheritance provenance (sire vs. dam vs. offspring vs. manual), dim unique non-convergent ancestors on pedigree trees to highlight linebred convergence, and flag Gen 0–3 pedigree nodes in red when missing ARBA registration fields would block registration.',
    files: [
      'src/domain/geneticsEngine.ts',
      'src/domain/pedigreeAnalysis.ts',
      'src/domain/__tests__/pedigreeAnalysis.test.ts',
      'src/components/ColoredGenotypeDisplay.tsx',
      'src/components/PedigreeScreen.tsx',
      'src/components/HerdScreen.tsx',
      'src/components/BreedingScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/geneticsEngine.ts',
        requiredSubstrings: [
          'analyzeAlleleProvenance',
          'AlleleProvenanceSource',
          'AnimalAlleleProvenanceResult',
        ],
      },
      {
        filePath: 'src/domain/pedigreeAnalysis.ts',
        requiredSubstrings: [
          'isArbaRegistrationSpecies',
          'evaluateAnimalArbaRegistration',
          'analyzePedigreeTree',
        ],
      },
      {
        filePath: 'src/components/ColoredGenotypeDisplay.tsx',
        requiredSubstrings: ['ColoredGenotypeDisplay', 'AlleleProvenanceLegend'],
      },
      {
        filePath: 'src/components/PedigreeScreen.tsx',
        requiredSubstrings: [
          'analyzePedigreeTree',
          'analyzeAlleleProvenance',
          'dimUniqueAncestors',
          'showRegistrationFlags',
          'ColoredGenotypeDisplay',
        ],
      },
      {
        filePath: 'src/components/HerdScreen.tsx',
        requiredSubstrings: ['analyzeAlleleProvenance', 'ColoredGenotypeDisplay'],
      },
      {
        filePath: 'src/components/BreedingScreen.tsx',
        requiredSubstrings: [
          'analyzeAlleleProvenance',
          'ColoredGenotypeDisplay',
          'AlleleProvenanceLegend',
        ],
      },
    ],
    restorePlaybook: [
      'Keep `analyzeAlleleProvenance` in `src/domain/geneticsEngine.ts` and `src/domain/pedigreeAnalysis.ts` with unit tests in `src/domain/__tests__/pedigreeAnalysis.test.ts`.',
      'Restore `src/components/ColoredGenotypeDisplay.tsx` (`ColoredGenotypeDisplay` + `AlleleProvenanceLegend`).',
      'Keep Dim Unique, ARBA Reg Flags, and provenance wiring in `PedigreeScreen.tsx`, `HerdScreen.tsx`, and `BreedingScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-039',
    title: 'Pedigree Print Orientation Toggle, Optional Breeder Logo, ARBA lbs.oz Notation & Direct Offline PDF Export',
    category: 'species-ux',
    source: 'session',
    summary:
      'Adds Landscape/Portrait 8.5"x11" print orientation, optional barn/rabbitry raster logo header upload (`BarnSettings.breederLogoDataUrl`), ARBA `lbs.oz` dot weight notation (`formatWeightArbaLbsOzDot`, e.g., `10.04`), and a zero-dependency pure TypeScript 100% offline PDF 1.4 binary generator (`buildPedigreePdfBytes` in `pdfExporter.ts` + `webPdfActions.ts`) with direct Download .PDF in `PrintPreviewModal`.',
    userIntent:
      'Allow breeders to switch ARBA pedigrees between Landscape and Portrait 8.5"x11", attach a rabbitry/barn logo in the header, toggle ARBA lbs.oz decimal dot weights, and download a .PDF file directly 100% offline.',
    files: [
      'src/domain/models.ts',
      'src/domain/syncAndExports.ts',
      'src/domain/pdfExporter.ts',
      'src/domain/__tests__/pdfExporter.test.ts',
      'src/utils/webPdfActions.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/components/PrintPreviewModal.tsx',
      'src/components/PedigreeScreen.tsx',
      'src/components/HerdScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'breederLogoDataUrl',
          'formatWeightArbaLbsOzDot',
          'formatPedigreeWeight',
        ],
      },
      {
        filePath: 'src/domain/syncAndExports.ts',
        requiredSubstrings: [
          'PedigreePrintOrientation',
          'arbaLbsOzDotNotation',
          'showBreederLogo',
          'barn-logo',
        ],
      },
      {
        filePath: 'src/domain/pdfExporter.ts',
        requiredSubstrings: ['buildPedigreePdfBytes', 'PdfRasterImage', '/DCTDecode'],
      },
      {
        filePath: 'src/components/PrintPreviewModal.tsx',
        requiredSubstrings: ['onDownloadPdf', 'Download .PDF', 'ARBA lbs.oz (10.04)', 'Portrait (8.5'],
      },
    ],
    restorePlaybook: [
      'Keep `breederLogoDataUrl`, `formatWeightArbaLbsOzDot`, and `formatPedigreeWeight` in `src/domain/models.ts` and `webSqliteAdapter.ts` extra_settings_json.',
      'Restore `src/domain/pdfExporter.ts`, `src/utils/webPdfActions.ts`, and `src/domain/__tests__/pdfExporter.test.ts`.',
      'Keep orientation, ARBA lbs.oz, logo upload/toggle, and `onDownloadPdf` wired across `SettingsAndSyncScreen.tsx`, `PrintPreviewModal.tsx`, `PedigreeScreen.tsx`, and `HerdScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-040',
    title: '8-Generation Pedigree Tree Mode, Custom Print Styling Presets & Shareable HTML Pedigree Cards',
    category: 'species-ux',
    source: 'session',
    summary:
      'Extends pedigree traversal, SQLite neighborhood loading, Evans .HTM output, and pure-TS offline PDF 1.4 export (auto-paginating 7-gen into 2 sheets and 8-gen into 4 grandparent quadrants) up to 8 generations on demand while keeping startup defaults capped at 3–6G; adds white-paper-locked color/border/layout print presets (`pedigreePrintStyles.ts`) and lightweight standalone mobile `.HTML` shareable pedigree cards (`shareablePedigreeCard.ts`).',
    userIntent:
      'Let breeders view and export up to 8 generations on demand, customize pedigree print borders, colors, and layouts safely on crisp white paper, and export lightweight standalone shareable pedigree HTML cards.',
    files: [
      'src/domain/models.ts',
      'src/domain/pedigreeCalculator.ts',
      'src/domain/pedigreePrintStyles.ts',
      'src/domain/shareablePedigreeCard.ts',
      'src/domain/syncAndExports.ts',
      'src/domain/pdfExporter.ts',
      'src/domain/exporters/exporterTypes.ts',
      'src/domain/exporters/registry.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/PrintPreviewModal.tsx',
      'src/components/PedigreeScreen.tsx',
      'src/components/HerdScreen.tsx',
      'src/components/ImportExportHubScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'DefaultPedigreeGenerations',
          'PedigreeGenerationDepth',
          'normalizePedigreeGenerationDepth',
          'normalizeDefaultPedigreeGenerations',
        ],
      },
      {
        filePath: 'src/domain/pedigreePrintStyles.ts',
        requiredSubstrings: [
          'PEDIGREE_COLOR_PRESETS',
          'PEDIGREE_BORDER_STYLES',
          'PEDIGREE_LAYOUT_PRESETS',
          'resolvePedigreePrintTheme',
        ],
      },
      {
        filePath: 'src/domain/shareablePedigreeCard.ts',
        requiredSubstrings: [
          'generateShareablePedigreeCardHtml',
          'buildShareablePedigreeCardFileName',
          'ShareablePedigreeCardOptions',
        ],
      },
      {
        filePath: 'src/domain/exporters/registry.ts',
        requiredSubstrings: ['shareable-pedigree-card', 'generateShareablePedigreeCardHtml'],
      },
      {
        filePath: 'src/components/PrintPreviewModal.tsx',
        requiredSubstrings: [
          'pedigreeDocMode',
          'onChangePedigreeDocMode',
          'PEDIGREE_COLOR_PRESETS',
          'PEDIGREE_BORDER_STYLES',
          'PEDIGREE_LAYOUT_PRESETS',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['Math.min(8, Math.max(0, Math.floor(maxDepth)))', 'MAX_RECORDS = 512'],
      },
    ],
    restorePlaybook: [
      'Keep `PedigreeGenerationDepth` (`3..8`) and normalizers in `src/domain/models.ts` plus Gen 7–8 `slotRoleLabel`/`buildPedigreeSlots` in `src/domain/pedigreeCalculator.ts`.',
      'Restore `src/domain/pedigreePrintStyles.ts`, `src/domain/shareablePedigreeCard.ts`, multi-page 7–8G sheets in `src/domain/pdfExporter.ts`, and `shareable-pedigree-card` in `src/domain/exporters/registry.ts`.',
      'Preserve 7/8-gen toggles, style preset selectors, and `pedigreeDocMode` wiring across `webSqliteAdapter.ts`, `useBarnStore.ts`, `PrintPreviewModal.tsx`, `PedigreeScreen.tsx`, `HerdScreen.tsx`, and `ImportExportHubScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-041',
    title: 'Structured Show Placements, Wins, Judge Notes & E-Leg Vault',
    category: 'species-ux',
    source: 'session',
    summary:
      'Expands ShowEvent entries with per-animal class placements, sanctionable awards (BOB, BOS, BIS, GCH, BOV, BOSV, RIS), judge names and notes, earned legs/points, E-Leg certificate numbers, and compressed raster E-Leg photo attachments (showResults.ts), synchronizing Animal.legsCount deltas and feeding Grand Championship progress and show honors into Male/Female reports, Barn Binder, Evans .HTM, Shareable Cards, Offline PDF pedigrees, and Herd/Pedigree/Species screens.',
    userIntent:
      'Capture structured show results, judge feedback, legs, and E-Leg certificate photos per entered animal so GC progress and show wins automatically enrich pedigrees, Barn Binder, and breeder reports.',
    files: [
      'src/domain/models.ts',
      'src/domain/showResults.ts',
      'src/domain/__tests__/showResults.test.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/domain/reportGenerators.ts',
      'src/domain/barnBinder.ts',
      'src/domain/syncAndExports.ts',
      'src/domain/pdfExporter.ts',
      'src/domain/shareablePedigreeCard.ts',
      'src/domain/exporters/registry.ts',
      'src/domain/speciesMigration.ts',
      'src/domain/syncOutbox.ts',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/components/PedigreeScreen.tsx',
      'src/components/HerdScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'ShowAwardCode',
          'SHOW_AWARD_OPTIONS',
          'ShowELegAttachment',
          'ShowAnimalResult',
        ],
      },
      {
        filePath: 'src/domain/showResults.ts',
        requiredSubstrings: [
          'normalizeShowResults',
          'sanitizeShowELegAttachment',
          'computeShowLegDeltas',
          'computeAnimalShowSummary',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['results_json', 'normalizeShowResults'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['normalizeShowResults', 'computeShowLegDeltas'],
      },
      {
        filePath: 'src/domain/reportGenerators.ts',
        requiredSubstrings: ['computeAnimalShowSummary', 'gcProgress', 'showWins', 'showPoints'],
      },
      {
        filePath: 'src/domain/barnBinder.ts',
        requiredSubstrings: ['computeAnimalShowSummary', 'Show Legs / GC Progress'],
      },
      {
        filePath: 'src/domain/syncAndExports.ts',
        requiredSubstrings: ['computeAnimalShowSummary', 'gcProgress.shortLabel'],
      },
      {
        filePath: 'src/domain/pdfExporter.ts',
        requiredSubstrings: ['computeAnimalShowSummary', 'gcProgress.shortLabel'],
      },
      {
        filePath: 'src/domain/shareablePedigreeCard.ts',
        requiredSubstrings: ['computeAnimalShowSummary', 'awardsSummaryText'],
      },
      {
        filePath: 'src/components/SpeciesDashboardScreen.tsx',
        requiredSubstrings: ['ShowAnimalResult', 'SHOW_AWARD_OPTIONS', 'eLegLightboxRef', 'showSubmitLock'],
      },
      {
        filePath: 'src/components/PedigreeScreen.tsx',
        requiredSubstrings: ['computeAnimalShowSummary', 'subjectShowSummary'],
      },
      {
        filePath: 'src/components/HerdScreen.tsx',
        requiredSubstrings: ['computeAnimalShowSummary', 'activeAnimalShowSummary', 'eLegLightboxRef'],
      },
    ],
    restorePlaybook: [
      'Keep ShowAwardCode, SHOW_AWARD_OPTIONS, ShowELegAttachment, ShowAnimalResult, and ShowEvent.results in `src/domain/models.ts` plus `src/domain/showResults.ts` and `src/domain/__tests__/showResults.test.ts`.',
      'Preserve `results_json` persistence/migration in `src/storage/webSqliteAdapter.ts`, leg delta reconciliation in `src/hooks/useBarnStore.ts`, and species migration/outbox handling in `speciesMigration.ts` / `syncOutbox.ts`.',
      'Keep `computeAnimalShowSummary` integrations across `reportGenerators.ts`, `barnBinder.ts`, `syncAndExports.ts`, `pdfExporter.ts`, `shareablePedigreeCard.ts`, `exporters/registry.ts`, `SpeciesDashboardScreen.tsx`, `PedigreeScreen.tsx`, and `HerdScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-042',
    title: 'Genetic Variety / Coat Explorer Sandbox (What-If Playground in Breeding Lab)',
    category: 'species-ux',
    source: 'session',
    summary:
      'Adds pure TS single-genotype phenotype, hidden recessive carrier, and single-animal health/lethal alert evaluation (`evaluateSingleGenotypeSandbox`, `buildSandboxHypotheticalAnimal` in `geneticsEngine.ts`) plus the ephemeral interactive `CoatExplorerSandbox` playground inside `BreedingScreen` supporting Single Genotype and What-If Pairing Cross modes, variety presets with optional modifier checks, read-only herd/logger seeding, and interactive locus allele editing without creating temporary animal records.',
    userIntent:
      'Let breeders experiment with hypothetical loci combinations and What-If crosses inside Breeding Lab and see predicted coat varieties, hidden carriers, and alerts without creating temporary animal records first.',
    files: [
      'src/domain/geneticsEngine.ts',
      'src/domain/__tests__/geneticsEngine.test.ts',
      'src/components/CoatExplorerSandbox.tsx',
      'src/components/BreedingScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/geneticsEngine.ts',
        requiredSubstrings: [
          'SingleGenotypeEvaluation',
          'evaluateSingleGenotypeSandbox',
          'buildSandboxHypotheticalAnimal',
        ],
      },
      {
        filePath: 'src/components/CoatExplorerSandbox.tsx',
        requiredSubstrings: [
          'CoatExplorerSandbox',
          'evaluateSingleGenotypeSandbox',
          'buildSandboxHypotheticalAnimal',
          'ColorGeneticsNotice',
        ],
      },
      {
        filePath: 'src/components/BreedingScreen.tsx',
        requiredSubstrings: ['<CoatExplorerSandbox'],
      },
    ],
    restorePlaybook: [
      'Keep `SingleGenotypeEvaluation`, `evaluateSingleGenotypeSandbox`, and `buildSandboxHypotheticalAnimal` in `src/domain/geneticsEngine.ts` with tests in `src/domain/__tests__/geneticsEngine.test.ts`.',
      'Restore `src/components/CoatExplorerSandbox.tsx` with Single Genotype & What-If Cross modes, variety presets, locus selectors, and `ColorGeneticsNotice`.',
      'Mount `<CoatExplorerSandbox />` inside `src/components/BreedingScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-043',
    title: 'Rate of Gain, Comparative Weight Charts & Litter Survival Curves',
    category: 'species-ux',
    source: 'session',
    summary:
      'Adds pure TS age-in-days Rate of Gain (ADG), Barn Cohort Benchmark, interpolated user-defined goal weight curves, meteorological seasonal bucketing, and dam/sire litter survival & milestone analytics (`growthAnalytics.ts`) backed by `SpeciesProfile.targetWeightCurve` and `BreedingRecord.litterWeightMilestones` across SQLite, JSON, store hooks, `GrowthAndSurvivalLab`, `BreedingScreen` Outcome milestone editor, `HerdScreen` compare actions, and the `litter-survival-performance-report`.',
    userIntent:
      'Track kit/offspring survival rate per dam and sire, chart litter weight-gain milestones across seasons, and compare multi-animal Rate of Gain curves on an age-in-days axis with native target/goal overlays.',
    files: [
      'src/domain/models.ts',
      'src/domain/growthAnalytics.ts',
      'src/domain/__tests__/growthAnalytics.test.ts',
      'src/domain/syncAndExports.ts',
      'src/domain/reportCatalog.ts',
      'src/domain/reportGenerators.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/GrowthAndSurvivalLab.tsx',
      'src/components/BreedingScreen.tsx',
      'src/components/HerdScreen.tsx',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'TargetWeightPoint',
          'normalizeTargetWeightCurve',
          'LitterWeightMilestone',
          'normalizeLitterWeightMilestones',
        ],
      },
      {
        filePath: 'src/domain/growthAnalytics.ts',
        requiredSubstrings: [
          'evaluateLitterSurvivalAndMilestones',
          'buildAnimalGrowthSeries',
          'buildBarnCohortBenchmarkCurve',
          'buildComparativeGrowthChartModel',
          'resolveMeteorologicalSeason',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['target_weight_curve_json', 'litter_weight_milestones_json'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['updateSpeciesTargetWeightCurve', 'openGrowthCompareForAnimals'],
      },
      {
        filePath: 'src/components/GrowthAndSurvivalLab.tsx',
        requiredSubstrings: [
          'GrowthAndSurvivalLab',
          'buildComparativeGrowthChartModel',
          'evaluateLitterSurvivalAndMilestones',
        ],
      },
      {
        filePath: 'src/components/BreedingScreen.tsx',
        requiredSubstrings: ['<GrowthAndSurvivalLab', 'litterWeightMilestones'],
      },
      {
        filePath: 'src/domain/reportGenerators.ts',
        requiredSubstrings: ['litter-survival-performance-report', 'evaluateLitterSurvivalAndMilestones'],
      },
    ],
    restorePlaybook: [
      'Keep `TargetWeightPoint`, `normalizeTargetWeightCurve`, `LitterWeightMilestone`, and `normalizeLitterWeightMilestones` in `src/domain/models.ts` plus `target_weight_curve_json` & `litter_weight_milestones_json` in `src/storage/webSqliteAdapter.ts` and `src/domain/syncAndExports.ts`.',
      'Restore `src/domain/growthAnalytics.ts` and `src/domain/__tests__/growthAnalytics.test.ts`.',
      'Keep `updateSpeciesTargetWeightCurve`, `openGrowthCompareForAnimals`, `GrowthAndSurvivalLab.tsx`, Outcome milestone inputs in `BreedingScreen.tsx`, Herd growth compare buttons in `HerdScreen.tsx` / `App.tsx`, and `litter-survival-performance-report` in `reportCatalog.ts` / `reportGenerators.ts`.',
    ],
  },
  {
    id: 'IMP-044',
    title: 'Feed Inventory Ledger, Tag Lot-Number OCR & Biosecurity Auto-Purge',
    category: 'species-ux',
    source: 'session',
    summary:
      'Adds strictly species-isolated `FeedBatch` & `FeedAllocation` tracking across SQLite schema v3 (`feed_batches`, `feed_allocations`), JSON/ZIP backups, data health repair, and `useBarnStore`, paired with pre-compression local OCR (`captureFeedTagWithPreCompressionOcr` + `extractFeedTagDetailsFromOcrText`) to index mill lot numbers and plant codes with manual override, configurable 30/60/90-day biosecurity auto-purge of stored tag images (`purgeExpiredFeedTagPhotosPure`), lot traceability across cages/litters/animals (`traceFeedLotToCagesAndLitters`), and an offline manufacturer emergency directory (`FEED_MANUFACTURER_DIRECTORY`).',
    userIntent:
      'Track purchased feed lots, allocate intake to pens and litters, scan feed tag stamps before deep compression with manual fallback, auto-purge heavy raw tag images after lot indexing, and keep an offline feed manufacturer recall & hotline directory.',
    files: [
      'src/domain/models.ts',
      'src/domain/feedInventory.ts',
      'src/domain/feedManufacturerDirectory.ts',
      'src/domain/__tests__/feedInventory.test.ts',
      'src/storage/feedTagOcr.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/FeedLedgerScreen.tsx',
      'src/components/FacilityPenBoard.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'FeedBatch',
          'FeedAllocation',
          'FEED_PURGE_WINDOW_OPTIONS',
          'normalizeFeedPurgeWindowDays',
        ],
      },
      {
        filePath: 'src/domain/feedInventory.ts',
        requiredSubstrings: [
          'extractFeedTagDetailsFromOcrText',
          'purgeExpiredFeedTagPhotosPure',
          'traceFeedLotToCagesAndLitters',
          'formatFeedLedgerCsv',
        ],
      },
      {
        filePath: 'src/domain/feedManufacturerDirectory.ts',
        requiredSubstrings: [
          'FEED_MANUFACTURER_DIRECTORY',
          'filterFeedManufacturerDirectory',
          'matchManufacturerForBrand',
        ],
      },
      {
        filePath: 'src/storage/feedTagOcr.ts',
        requiredSubstrings: ['captureFeedTagWithPreCompressionOcr', 'optimizeImageBlob'],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['feed_batches', 'feed_allocations', 'saveFeedBatchesBatch'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'saveFeedBatch',
          'logFeedAllocation',
          'runFeedTagBiosecurityAutoPurge',
        ],
      },
      {
        filePath: 'src/components/FeedLedgerScreen.tsx',
        requiredSubstrings: [
          'FeedLedgerScreen',
          'captureFeedTagWithPreCompressionOcr',
          'FEED_MANUFACTURER_DIRECTORY',
        ],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['FeedLedgerScreen', "route === 'feed'"],
      },
    ],
    restorePlaybook: [
      'Keep `FeedBatch`, `FeedAllocation`, `FEED_PURGE_WINDOW_OPTIONS`, and `normalizeFeedPurgeWindowDays` in `src/domain/models.ts` plus SQLite tables in `src/storage/webSqliteAdapter.ts`.',
      'Restore `src/domain/feedInventory.ts`, `src/domain/feedManufacturerDirectory.ts`, `src/domain/__tests__/feedInventory.test.ts`, and `src/storage/feedTagOcr.ts`.',
      'Keep `saveFeedBatch`, `logFeedAllocation`, `runFeedTagBiosecurityAutoPurge` in `useBarnStore.ts` and mount `FeedLedgerScreen.tsx` in `SpeciesDashboardScreen.tsx`, `FacilityPenBoard.tsx`, and `App.tsx`.',
    ],
  },
  {
    id: 'IMP-045',
    title: 'Offline Photo Pedigree Scanning & Local OCR Importer',
    category: 'species-ux',
    source: 'session',
    summary:
      'Adds 100% offline client-side paper pedigree scanning and PDF extraction via `pdfScanExtractor.ts` (searchable `/FlateDecode` `BT...ET` text vectors with coordinates and embedded `/DCTDecode` scanned JPEG pages) plus `pedigreeOcrParser.ts` (2D bounding-box 3-col/4-col pedigree tree reconstruction and text heuristics into an editable 15-slot 3-generation draft queue backed by `PlatformImportPreview`), wired with `pedigreeOcrScanner.ts` (native Chromium `TextDetector` + lazy bounded `tesseract.js` worker with `offline_manual` fallback) into `PedigreeOcrScannerPanel.tsx` and `ExternalImporterPanel.tsx`.',
    userIntent:
      'Allow breeders to snap a photo or upload JPG/PNG/WebP/PDF scans of paper pedigrees completely offline, review/correct extracted ancestor names, ear tattoos, weights, and ARBA registration numbers across 3 generations, and stage them straight into the Import Review Queue with duplicate/conflict resolution.',
    files: [
      'src/domain/importers/pdfScanExtractor.ts',
      'src/domain/importers/pedigreeOcrParser.ts',
      'src/domain/__tests__/pedigreeOcrParser.test.ts',
      'src/storage/pedigreeOcrScanner.ts',
      'src/components/PedigreeOcrScannerPanel.tsx',
      'src/components/ExternalImporterPanel.tsx',
      'src/components/ImportExportHubScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/importers/pdfScanExtractor.ts',
        requiredSubstrings: [
          'extractPedigreePdfPages',
          'MAX_PDF_SCAN_BYTES',
          'MAX_PDF_SCAN_PAGES',
        ],
      },
      {
        filePath: 'src/domain/importers/pedigreeOcrParser.ts',
        requiredSubstrings: [
          'PEDIGREE_OCR_SLOT_DESCRIPTORS',
          'parsePedigreeSlotLines',
          'parsePedigreeOcrResult',
          'buildPlatformImportPreviewFromOcrDrafts',
        ],
      },
      {
        filePath: 'src/storage/pedigreeOcrScanner.ts',
        requiredSubstrings: ['scanPedigreeDocumentFile', 'tesseract.js'],
      },
      {
        filePath: 'src/components/PedigreeOcrScannerPanel.tsx',
        requiredSubstrings: [
          'PedigreeOcrScannerPanel',
          'scanPedigreeDocumentFile',
          'buildPlatformImportPreviewFromOcrDrafts',
        ],
      },
      {
        filePath: 'src/components/ExternalImporterPanel.tsx',
        requiredSubstrings: ['externalOcrPreview', 'onClearExternalOcrPreview'],
      },
      {
        filePath: 'src/components/ImportExportHubScreen.tsx',
        requiredSubstrings: ['<PedigreeOcrScannerPanel', 'stagedOcrPreview'],
      },
    ],
    restorePlaybook: [
      'Restore pure parsers `src/domain/importers/pdfScanExtractor.ts`, `src/domain/importers/pedigreeOcrParser.ts`, and `src/domain/__tests__/pedigreeOcrParser.test.ts`.',
      'Restore `src/storage/pedigreeOcrScanner.ts` and `src/components/PedigreeOcrScannerPanel.tsx`.',
      'Keep `externalOcrPreview`/`onClearExternalOcrPreview` props in `ExternalImporterPanel.tsx` and `<PedigreeOcrScannerPanel>` wired inside `ImportExportHubScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-046',
    title: 'Local Economic Ledger, Meat/Pelt Processing Yields & 4-H/FFA Project Books',
    category: 'species-ux',
    source: 'session',
    summary:
      'Adds species-isolated general barn income/expense tracking (`LedgerEntry`) with compressed receipt photo attachments (`optimizeImageFile`) and feed-lot deduplication; automated per-animal and per-litter net profit/loss margins (`computeAnimalProfitMargins`, `computeLitterProfitMargins`); meat & pelt processing logs (`ProcessingLog`) tracking butcher schedules, harvest dates, live-to-dressed carcass dress-out %, and pelt grades; 4-H/FFA Youth Project Record Books (`YouthProjectBook`) with ration feed logs, inventory changes, and printable `.HTM`/PDF completion reports (`generateYouthProjectReportHtml`); SQLite v4 persistence, sync outbox deltas, 3 new report presets, and `EconomicsLedgerScreen.tsx` accessible from Species Dashboard & `E` shortcut.',
    userIntent:
      'Provide offline barn bookkeeping with receipt photos, automated animal/litter P&L margins, meat/pelt carcass yield and pelt grading logs, and printable 4-H/FFA youth livestock project completion books.',
    files: [
      'src/domain/models.ts',
      'src/domain/economicsLedger.ts',
      'src/domain/__tests__/economicsLedger.test.ts',
      'src/domain/reportCatalog.ts',
      'src/domain/reportGenerators.ts',
      'src/domain/syncOutbox.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/EconomicsLedgerScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'LedgerEntry',
          'LEDGER_CATEGORY_OPTIONS',
          'ProcessingLog',
          'PELT_GRADE_OPTIONS',
          'YouthProjectBook',
        ],
      },
      {
        filePath: 'src/domain/economicsLedger.ts',
        requiredSubstrings: [
          'calculateDressOutPercent',
          'computeAnimalProfitMargins',
          'computeLitterProfitMargins',
          'evaluateSpeciesEconomicsSummary',
          'evaluateProcessingSummary',
          'evaluateYouthProjectSummary',
          'generateYouthProjectReportHtml',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: [
          'ledger_entries',
          'processing_logs',
          'youth_project_books',
          'saveLedgerEntry',
          'saveProcessingLog',
          'saveYouthProjectBook',
        ],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'saveLedgerEntry',
          'saveProcessingLog',
          'saveYouthProjectBook',
        ],
      },
      {
        filePath: 'src/components/EconomicsLedgerScreen.tsx',
        requiredSubstrings: [
          'EconomicsLedgerScreen',
          'generateYouthProjectReportHtml',
          'evaluateSpeciesEconomicsSummary',
        ],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['EconomicsLedgerScreen', "route === 'economics'"],
      },
    ],
    restorePlaybook: [
      'Keep `LedgerEntry`, `ProcessingLog`, and `YouthProjectBook` interfaces and normalizers in `src/domain/models.ts` plus SQLite v4 tables in `src/storage/webSqliteAdapter.ts`.',
      'Restore `src/domain/economicsLedger.ts` and `src/domain/__tests__/economicsLedger.test.ts` along with the 3 financial/production/youth presets in `reportCatalog.ts` and `reportGenerators.ts`.',
      'Keep store CRUD mutations in `src/hooks/useBarnStore.ts` and wire `EconomicsLedgerScreen.tsx` into `SpeciesDashboardScreen.tsx` and `App.tsx`.',
    ],
  },
  {
    id: 'IMP-047',
    title: 'Post-Crash Alignment, Ready External Exporters, Feed/Archive Parity & Android WebView Print/Share',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Enforces the React PWA preservation rule in `AGENTS.md` and `prompts/master_system_prompt.md`; aligns PWA/Android versions to `0.1.0-alpha.2`; migrates `feedBatches` and `feedAllocations` during cross-species moves; surfaces v3/v4 feed, ledger, processing, and 4-H/FFA counts in `archiveInspector.ts`; implements `herdboss-transfer-bundle` (.ZIP) and `registry-worksheet-csv` (.CSV) as ready exporters; and fixes `@media print` extraction, accent-ink preservation, native wrapper Share .HTM enablement, and Android `PrintBridge.kt` offscreen HTML + landscape/portrait printing while removing the stale `PedigreePrintNotice` banner.',
    userIntent:
      'Realign the entire codebase after build-crash drift, keep the PWA locked to React + Vite + TypeScript, complete half-done exporters and migration/inspector coverage, and make pedigree/binder print & share work seamlessly on desktop, mobile web, and the Android WebView APK.',
    files: [
      'AGENTS.md',
      '.env.example',
      'package.json',
      'public/version.json',
      'src/domain/upgradeGate.ts',
      'src/domain/speciesMigration.ts',
      'src/domain/archiveInspector.ts',
      'src/domain/exporters/exporterTypes.ts',
      'src/domain/exporters/registry.ts',
      'src/native/pedigreeBridge.ts',
      'src/components/PrintPreviewModal.tsx',
      'src/components/ImportExportHubScreen.tsx',
      'src/index.css',
      'android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/MainActivity.kt',
      'android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/PrintBridge.kt',
      '.github/structure.txt',
    ],
    invariants: [
      {
        filePath: 'AGENTS.md',
        requiredSubstrings: ['Never Convert PWA Away From React'],
      },
      {
        filePath: 'src/domain/speciesMigration.ts',
        requiredSubstrings: ['feedBatchesMigrated', 'feedAllocationsMigrated'],
      },
      {
        filePath: 'src/domain/archiveInspector.ts',
        requiredSubstrings: [
          'feedBatchCount',
          'feedAllocationCount',
          'ledgerEntryCount',
          'processingLogCount',
          'youthProjectBookCount',
        ],
      },
      {
        filePath: 'src/domain/exporters/registry.ts',
        requiredSubstrings: ['herdboss-transfer-bundle', 'registry-worksheet-csv', 'binaryContent'],
      },
      {
        filePath: 'src/components/PrintPreviewModal.tsx',
        requiredSubstrings: [
          'canShareHtmlDocument',
          'extractScopedPrintCssFromRules',
          'detectDocumentPrintOrientation',
        ],
      },
      {
        filePath: 'android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/PrintBridge.kt',
        requiredSubstrings: ['printFromBridge', 'printHtmlDocument', 'buildPrintAttributes'],
      },
    ],
    restorePlaybook: [
      'Verify `AGENTS.md` and `prompts/master_system_prompt.md` keep the React PWA lock rule intact.',
      'Ensure `package.json`, `public/version.json`, and `src/domain/upgradeGate.ts` match `android-wrapper/app/build.gradle.kts` (`0.1.0-alpha.2`).',
      'Keep `herdboss-transfer-bundle` and `registry-worksheet-csv` in `src/domain/exporters/registry.ts` with `binaryContent` download dispatch in `ImportExportHubScreen.tsx`.',
      'Keep `@media print` extraction, native Share .HTM support, and Android `PrintBridge.kt` offscreen HTML rendering intact and do not reintroduce `PedigreePrintNotice`.',
    ],
  },
  {
    id: 'IMP-048',
    title: 'Hybrid Architecture Guardrails & React-Only Core PWA Lock',
    category: 'ci-tooling',
    source: 'session',
    userIntent:
      'Prevent AI Studio, GitHub import triage, or contributors from misinterpreting the hybrid Kotlin Android WebView wrapper (`android-wrapper/`) as a signal to rewrite the core React PWA into Kotlin.',
    summary:
      'Documents and enforces across `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `metadata.json`, `package.json`, `index.html`, `.github/structure.txt`, `.github/workflows/build-android-apk.yml`, and `android-wrapper/` (`README.md`, Gradle build files, `MainActivity.kt`) that the core PWA (`/src/`) MUST always stay React + Vite + TypeScript while `android-wrapper/` is strictly a thin hybrid WebView shell.',
    files: [
      'AGENTS.md',
      'README.md',
      'ARCHITECTURE.md',
      'metadata.json',
      'package.json',
      'index.html',
      'android-wrapper/README.md',
      'android-wrapper/build.gradle.kts',
      'android-wrapper/settings.gradle.kts',
      'android-wrapper/app/build.gradle.kts',
      'android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/MainActivity.kt',
      '.github/structure.txt',
      '.github/workflows/build-android-apk.yml',
    ],
    invariants: [
      {
        filePath: 'AGENTS.md',
        requiredSubstrings: [
          'Core PWA MUST Always Stay in React',
          'NEVER recode the site in Kotlin',
        ],
      },
      {
        filePath: 'README.md',
        requiredSubstrings: [
          'Core PWA MUST Always Stay in React',
          'Never Recode the PWA in Kotlin',
        ],
      },
      {
        filePath: 'ARCHITECTURE.md',
        requiredSubstrings: [
          'Critical Hybrid Architecture Boundary',
          'Never Convert PWA Away From React',
        ],
      },
      {
        filePath: 'metadata.json',
        requiredSubstrings: [
          'React + Vite + TypeScript offline-first PWA',
          'thin hybrid Kotlin WebView shell',
        ],
      },
      {
        filePath: 'package.json',
        requiredSubstrings: ['React + Vite + TypeScript offline-first PWA'],
      },
      {
        filePath: 'index.html',
        requiredSubstrings: ['NEVER CONVERT THIS PWA AWAY FROM REACT'],
      },
      {
        filePath: 'android-wrapper/README.md',
        requiredSubstrings: [
          'Thin Hybrid Shell ONLY',
          'NEVER convert, rewrite, or recode the core PWA into Kotlin',
        ],
      },
      {
        filePath: 'android-wrapper/app/build.gradle.kts',
        requiredSubstrings: ['CRITICAL HYBRID BOUNDARY'],
      },
    ],
    restorePlaybook: [
      'Ensure `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `metadata.json`, `package.json`, and `index.html` explicitly lock the core PWA to React + Vite + TypeScript.',
      'Keep `android-wrapper/README.md` and the `CRITICAL HYBRID BOUNDARY` headers in `android-wrapper/build.gradle.kts`, `settings.gradle.kts`, `app/build.gradle.kts`, and `MainActivity.kt`.',
    ],
  },
  {
    id: 'IMP-049',
    title: 'Client CRM, Buyer Waitlist, Reservations & Deposit Reminders',
    category: 'species-ux',
    source: 'session',
    summary:
      'Adds species-isolated local-first breeder CRM tracking buyer contacts (`ClientContact`), ranked waitlist inquiries (`WaitlistEntry`) with live unreserved animal/pairing match scoring (`findWaitlistMatches`), animal/litter-pick reservations (`AnimalReservation`) with sequential agreement numbering and deposit/balance progress (`evaluateReservationFinancials`), automated overdue/due/upcoming follow-up reminders (`evaluateCrmFollowUpReminders`) with 1-click Master Task creation, XSS-safe printable Sales Agreements with optional breeder logo and active withdrawal disclosures (`generateSalesAgreementHtml`), SQLite v5 persistence, sync outbox deltas, 2 CRM report presets, and `ClientCrmScreen.tsx` accessible from Species Dashboard & `C` shortcut.',
    userIntent:
      'Track buyer contacts, waitlist queues, animal/litter reservations, deposit due reminders, and printable sales agreements offline without cloud dependencies.',
    files: [
      'src/domain/models.ts',
      'src/domain/clientCrm.ts',
      'src/domain/__tests__/clientCrm.test.ts',
      'src/domain/reportCatalog.ts',
      'src/domain/reportGenerators.ts',
      'src/domain/syncOutbox.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/ClientCrmScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'ClientContact',
          'WaitlistEntry',
          'AnimalReservation',
          'RESERVATION_STATUSES',
          'WAITLIST_STATUSES',
        ],
      },
      {
        filePath: 'src/domain/clientCrm.ts',
        requiredSubstrings: [
          'evaluateReservationFinancials',
          'evaluateCrmFollowUpReminders',
          'findWaitlistMatches',
          'generateSalesAgreementHtml',
          'formatReservationsCsv',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: [
          'client_contacts',
          'waitlist_entries',
          'animal_reservations',
          'saveClientContact',
          'saveWaitlistEntry',
          'saveAnimalReservation',
        ],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'saveClientContact',
          'saveWaitlistEntry',
          'saveAnimalReservation',
          'completeReservationSale',
          'createCrmReminderTask',
        ],
      },
      {
        filePath: 'src/components/ClientCrmScreen.tsx',
        requiredSubstrings: [
          'ClientCrmScreen',
          'generateSalesAgreementHtml',
          'evaluateCrmFollowUpReminders',
          'findWaitlistMatches',
        ],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['ClientCrmScreen', "route === 'crm'"],
      },
    ],
    restorePlaybook: [
      'Keep `ClientContact`, `WaitlistEntry`, and `AnimalReservation` interfaces and normalizers in `src/domain/models.ts` plus SQLite v5 tables in `src/storage/webSqliteAdapter.ts`.',
      'Restore `src/domain/clientCrm.ts` and `src/domain/__tests__/clientCrm.test.ts` along with the 2 CRM presets in `reportCatalog.ts` and `reportGenerators.ts`.',
      'Keep CRM mutations in `src/hooks/useBarnStore.ts` and wire `ClientCrmScreen.tsx` into `SpeciesDashboardScreen.tsx` and `App.tsx`.',
    ],
  },
  {
    id: 'IMP-050',
    title: 'Alternative Certificates, Show Entry/Remark Cards & IAGARB Wool/Fiber Tracking',
    category: 'species-ux',
    source: 'session',
    summary:
      'Adds privacy-scoped Pet-Sale Birth Certificates (omitting breeder contact info & pricing), official Breeding/Service Certificates, ARBA-style Show Entry Forms (`mailto:` + plain-text copy + Open/Youth/fees) & 4-up/1-up Show Remark Cards from ShowEvent rosters, Gen 0–2 multi-photo Family Portrait and IAGARB German Angora pedigree layouts, and SQLite v6 `wool_harvests` tracking via lazy-loaded `WoolHarvestPanel` with 7-position 100-pt IAGARB scoring and 90-day 325g shearing yield calculations.',
    userIntent:
      'Support alternative companion birth/breeding certificates, printable/emailable show documents directly from show rosters, family portrait & IAGARB Angora pedigree templates, and wool/fiber harvest logging.',
    files: [
      'src/domain/models.ts',
      'src/domain/woolFiber.ts',
      'src/domain/alternativeCertificates.ts',
      'src/domain/showDocuments.ts',
      'src/domain/pedigreePrintStyles.ts',
      'src/domain/syncAndExports.ts',
      'src/domain/pdfExporter.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/PrintPreviewModal.tsx',
      'src/components/WoolHarvestPanel.tsx',
      'src/components/HerdScreen.tsx',
      'src/components/PedigreeScreen.tsx',
      'src/components/BreedingScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/App.tsx',
      'src/domain/__tests__/woolFiber.test.ts',
      'src/domain/__tests__/alternativeCertificates.test.ts',
      'src/domain/__tests__/showDocuments.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'WoolHarvest',
          'IagarbScorecard',
          'WOOL_HARVEST_METHODS',
          'normalizeWoolHarvestMethod',
        ],
      },
      {
        filePath: 'src/domain/woolFiber.ts',
        requiredSubstrings: [
          'IAGARB_JUDGING_POSITIONS',
          'computeIagarbScoreTotal',
          'evaluateIagarbEligibility',
          'compute90DayEquivalentGrams',
          'summarizeAnimalWoolHarvests',
        ],
      },
      {
        filePath: 'src/domain/alternativeCertificates.ts',
        requiredSubstrings: [
          'generatePetBirthCertificateHtml',
          'generateBreedingCertificateHtml',
          'buildPetBirthCertificateFileName',
          'buildBreedingCertificateFileName',
        ],
      },
      {
        filePath: 'src/domain/showDocuments.ts',
        requiredSubstrings: [
          'generateShowEntryFormHtml',
          'generateShowRemarkCardsHtml',
          'buildShowEntryMailtoUrl',
          'buildShowEntryPlainTextSummary',
        ],
      },
      {
        filePath: 'src/domain/pedigreePrintStyles.ts',
        requiredSubstrings: ['family_portrait', 'iagarb_angora'],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['wool_harvests', 'saveWoolHarvest', 'deleteWoolHarvest'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['saveWoolHarvest', 'deleteWoolHarvest'],
      },
      {
        filePath: 'src/components/WoolHarvestPanel.tsx',
        requiredSubstrings: [
          'WoolHarvestPanel',
          'onSaveWoolHarvest',
          'IAGARB_JUDGING_POSITIONS',
        ],
      },
      {
        filePath: 'src/components/HerdScreen.tsx',
        requiredSubstrings: [
          'generatePetBirthCertificateHtml',
          'onSaveWoolHarvest',
          'WoolHarvestPanel',
        ],
      },
      {
        filePath: 'src/components/BreedingScreen.tsx',
        requiredSubstrings: ['generateBreedingCertificateHtml', 'Breeding Cert'],
      },
      {
        filePath: 'src/components/SpeciesDashboardScreen.tsx',
        requiredSubstrings: [
          'generateShowEntryFormHtml',
          'generateShowRemarkCardsHtml',
          'buildShowEntryMailtoUrl',
        ],
      },
    ],
    restorePlaybook: [
      'Keep `WoolHarvest` and `IagarbScorecard` models in `src/domain/models.ts` and `wool_harvests` SQLite v6 schema in `src/storage/webSqliteAdapter.ts`.',
      'Restore pure modules `src/domain/woolFiber.ts`, `src/domain/alternativeCertificates.ts`, and `src/domain/showDocuments.ts` with their unit tests.',
      'Keep `family_portrait` & `iagarb_angora` rendering in `pedigreePrintStyles.ts`, `syncAndExports.ts`, and `pdfExporter.ts`, plus UI wiring in `WoolHarvestPanel.tsx`, `HerdScreen.tsx`, `PedigreeScreen.tsx`, `BreedingScreen.tsx`, `SpeciesDashboardScreen.tsx`, and `App.tsx`.',
    ],
  },
  {
    id: 'IMP-051',
    title: 'Founder Loss / Heritability Analytics, Interactive Barn Scheduler Gantt & LAN P2P Outbox Sync',
    category: 'species-ux',
    source: 'session',
    summary:
      'Wires pure TypeScript path-summed founder & ancestor genetic contributions (`0.5^depth`), Lacy effective founders (`fe`), Lost/Endangered/Active founder bottleneck ledger, and mid-parent OLS heritability (`h²`) cohort trends (`pedigreeAnalytics.ts`) via lazy-loaded `FounderAndHeritabilityPanel` into both `PedigreeScreen.tsx` and `BreedingScreen.tsx`; wires pure UTC multi-day Gantt timeline, smart critical priority escalation (`barnScheduler.ts`), SQLite `barn_tasks.start_date_iso` persistence, `useBarnStore` task rescheduling/escalation/reconciliation mutations, and zero-server WebRTC DataChannel & folder delta reconciliation (`p2pSyncProtocol.ts`, `p2pLanChannel.ts`) via lazy-loaded `BarnSchedulerGantt` inside `SpeciesDashboardScreen.tsx`.',
    userIntent:
      'Provide heritability trends, founder-loss analytics, drag-and-drop chore scheduling with smart escalation, and serverless LAN P2P outbox sync.',
    files: [
      'src/domain/models.ts',
      'src/domain/pedigreeAnalytics.ts',
      'src/domain/barnScheduler.ts',
      'src/domain/p2pSyncProtocol.ts',
      'src/storage/p2pLanChannel.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/FounderAndHeritabilityPanel.tsx',
      'src/components/BarnSchedulerGantt.tsx',
      'src/components/PedigreeScreen.tsx',
      'src/components/BreedingScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/App.tsx',
      'src/domain/__tests__/pedigreeAnalytics.test.ts',
      'src/domain/__tests__/barnScheduler.test.ts',
      'src/domain/__tests__/p2pSyncProtocol.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/pedigreeAnalytics.ts',
        requiredSubstrings: [
          'analyzeAnimalFounderContributions',
          'analyzePairingFounderShift',
          'analyzeSpeciesFounderLoss',
          'analyzeSpeciesHeritabilityTrends',
        ],
      },
      {
        filePath: 'src/domain/barnScheduler.ts',
        requiredSubstrings: [
          'evaluateTaskPriorityEscalation',
          'buildPriorityEscalationUpdates',
          'buildBarnGanttTimeline',
          'shiftTaskDatesByDays',
          'resizeTaskStartDateByDays',
        ],
      },
      {
        filePath: 'src/domain/p2pSyncProtocol.ts',
        requiredSubstrings: [
          'encodeP2pSignalToken',
          'decodeP2pSignalToken',
          'createP2pDeltaWireMessage',
          'parseP2pWireOrDeltaPayload',
          'summarizeTaskReconciliation',
        ],
      },
      {
        filePath: 'src/storage/p2pLanChannel.ts',
        requiredSubstrings: [
          'supportsLanWebRtcP2p',
          'createLanP2pSession',
          'reconcileWithPickedSyncFolder',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['start_date_iso'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'rescheduleTask',
          'applySmartTaskEscalations',
          'reconcileP2pOutboxOps',
        ],
      },
      {
        filePath: 'src/components/FounderAndHeritabilityPanel.tsx',
        requiredSubstrings: [
          'FounderAndHeritabilityPanel',
          'analyzeSpeciesFounderLoss',
          'analyzeSpeciesHeritabilityTrends',
        ],
      },
      {
        filePath: 'src/components/BarnSchedulerGantt.tsx',
        requiredSubstrings: [
          'BarnSchedulerGantt',
          'buildBarnGanttTimeline',
          'createLanP2pSession',
        ],
      },
      {
        filePath: 'src/components/PedigreeScreen.tsx',
        requiredSubstrings: ['FounderAndHeritabilityPanel', 'mode="pedigree"'],
      },
      {
        filePath: 'src/components/BreedingScreen.tsx',
        requiredSubstrings: ['FounderAndHeritabilityPanel', 'mode="breeding"'],
      },
      {
        filePath: 'src/components/SpeciesDashboardScreen.tsx',
        requiredSubstrings: ['BarnSchedulerGantt', 'taskViewMode', 'onReconcileOutboxOps'],
      },
    ],
    restorePlaybook: [
      'Keep pure domain engines `src/domain/pedigreeAnalytics.ts`, `src/domain/barnScheduler.ts`, `src/domain/p2pSyncProtocol.ts`, `src/storage/p2pLanChannel.ts`, and their Vitest suites intact.',
      'Keep `barn_tasks.start_date_iso` in `src/storage/webSqliteAdapter.ts` and `rescheduleTask`, `applySmartTaskEscalations`, and `reconcileP2pOutboxOps` in `src/hooks/useBarnStore.ts`.',
      'Keep lazy-loaded `FounderAndHeritabilityPanel` mounted in `PedigreeScreen.tsx` & `BreedingScreen.tsx` and lazy-loaded `BarnSchedulerGantt` toggled inside `SpeciesDashboardScreen.tsx` & wired from `App.tsx`.',
    ],
  },
];
