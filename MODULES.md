# Current Modules Split: Core / Foundation / Non-Content-Specific vs. Content-Specific

Generated dynamically from `src/` via `npm run list:modules` (`src/domain/moduleCatalog.ts`).
Excludes `*.test.ts*` and `__tests__/` files.

## Summary

- **Total Non-Test Source Modules:** 256
- **Core / Foundation / Non-Content-Specific Features & Utilities:** 59 (23.0%)
  - Core Foundation (`src/engine/`): 31
  - Non-Content Features (`src/features/`): 17
  - Reusable Utilities (`src/utils/`): 11
- **Content-Specific Modules:** 197 (77.0%)
  - Domain Engines (`src/domain/`): 86
  - App Composition & Configs (`src/app/`): 9
  - Storage Adapters & Workers (`src/storage/`): 27
  - Native Bridge (`src/native/`): 1
  - State Store Hook (`src/hooks/`): 18
  - UI Screens & Modals (`src/components/`): 53
  - Root Entry & Styles (`src/`): 3

```bash
# Print live split module listing
npm run list:modules

# Regenerate MODULES.md from live src/ directory
npx tsx scripts/list-modules.ts --write

# Check zero content-named core modules & MODULES.md sync
npx tsx scripts/list-modules.ts --check
```

---

## 1. Core / Foundation / Non-Content-Specific Modules (59)

### Core Engine / Foundation (`src/engine/`, `@engine/*`) (31)

| Module Path | Purpose / Notes |
| --- | --- |
| `src/engine/binaryEncoding.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/bridge/desktopBridgeAdapter.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/bridge/index.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/bridge/platformBridge.interface.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/bridge/platformBridge.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/codecs/archiveAndCsvUtils.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/codecs/index.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/codecs/textFormats.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/index.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/primitives/boundedCache.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/primitives/crypto.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/primitives/deviceCapabilityCore.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/primitives/genericRegistries.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/primitives/genericSync.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/primitives/index.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/primitives/pdfDocumentExtractor.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/primitives/qrCodec.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/primitives/sanitization.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/primitives/themeColor.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/storage/browserProbes.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/storage/browserStorageAdapters.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/storage/crossTabSync.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/storage/index.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/storage/lanWebRtcTransport.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/storage/lifecycleCoordinator.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/storage/nativeBridgeStorageAdapter.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/storage/opfsStream.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/storage/resilientStorageAdapter.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/storage/sqliteWasmStorageAdapter.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/storage/storageAdapter.interface.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |
| `src/engine/sync/index.ts` | Content-agnostic core primitive, codec, bridge, or storage foundation module. |

### Non-Content-Specific Feature Modules (`src/features/`, `@features/*`) (17)

| Module Path | Purpose / Notes |
| --- | --- |
| `src/features/backup-vault/index.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/backup-vault/portableVault.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/csv-exporter/csvExporter.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/csv-exporter/index.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/csv-exporter/types.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/csv-importer/csvImporter.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/csv-importer/csvParser.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/csv-importer/index.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/csv-importer/types.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/document-export/htmlPrintPackage.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/document-export/index.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/featureModule.interface.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/ics-calendar/icsBuilder.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/ics-calendar/index.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/index.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/ocr-parser/index.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |
| `src/features/ocr-parser/ocrTextPipeline.ts` | Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service). |

### Reusable Content-Free UI & Runtime Utilities (`src/utils/`) (11)

| Module Path | Purpose / Notes |
| --- | --- |
| `src/utils/canvasUtils.ts` | Content-free browser/React helper or hook extractable alongside core packages. |
| `src/utils/comboboxNav.ts` | Content-free browser/React helper or hook extractable alongside core packages. |
| `src/utils/es2018Shims.ts` | Content-free browser/React helper or hook extractable alongside core packages. |
| `src/utils/googleCalendarClient.ts` | Content-free browser/React helper or hook extractable alongside core packages. |
| `src/utils/lazyRoute.tsx` | Content-free browser/React helper or hook extractable alongside core packages. |
| `src/utils/perfTiming.ts` | Content-free browser/React helper or hook extractable alongside core packages. |
| `src/utils/useAccessibleDialog.ts` | Content-free browser/React helper or hook extractable alongside core packages. |
| `src/utils/useAsyncSubmitLock.ts` | Content-free browser/React helper or hook extractable alongside core packages. |
| `src/utils/useVirtualWindow.ts` | Content-free browser/React helper or hook extractable alongside core packages. |
| `src/utils/webFileActions.ts` | Content-free browser/React helper or hook extractable alongside core packages. |
| `src/utils/webPdfActions.ts` | Content-free browser/React helper or hook extractable alongside core packages. |

---

## 2. Content-Specific Modules (197)

### Domain Engines & Compatibility Facades (`src/domain/`) (86)

| Module Path | Purpose / Notes |
| --- | --- |
| `src/domain/alternativeCertificates.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/animalConflicts.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/archiveInspector.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/backupArchive.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/backupStatus.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/backupVault.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/barnAlerts.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/barnBench.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/barnBinder.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/barnJournal.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/barnScheduler.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/batchPrint.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/binaryEncoding.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/breederShowcase.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/breedingCalendar.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/calendarExport.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/carrierGenetics.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/clientCrm.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/cloudAppFolderSync.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/csvExport.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/dataHealthCheck.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/deviceCapability.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/economicsLedger.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/encryptedExport.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/exporters/exporterTypes.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/exporters/registry.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/facilityBoard.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/feedInventory.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/feedManufacturerDirectory.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/geneticsEngine.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/growthAnalytics.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/healthReference.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/imageOptimizationSpec.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/importers/archiveAndCsvUtils.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/importers/conflictResolver.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/importers/csvColumnMapper.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/importers/csvStarterTemplate.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/importers/herdBossImporter.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/importers/importerTypes.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/importers/pdfScanExtractor.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/importers/pedigreeOcrParser.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/importers/registry.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/importers/universalPedigreeImporter.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/improvementRegistry.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/improvements/rationales.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/improvements/registry-part-01.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/improvements/registry-part-02.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/improvements/registry-part-03.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/improvements/registry-part-04.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/improvements/registry-part-05.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/improvements/types.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/inputSanitization.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/judgeNotebook.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/mileageTaxLog.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/milestones.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/models.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/moduleCatalog.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/p2pSyncProtocol.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/pairingMatrix.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/pdfExporter.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/pedigreeAnalysis.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/pedigreeAnalytics.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/pedigreeCalculator.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/pedigreePrintStyles.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/photoMaintenance.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/promptRegistry.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/promptsCatalog.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/qrCode.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/reportCatalog.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/reportGenerators.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/sampleData.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/shareablePedigreeCard.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/showDocuments.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/showResults.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/speciesMemo.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/speciesMigration.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/suggestionsBacklog.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/supportBundle.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/syncAndExports.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/syncOutbox.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/syncRetention.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/taskMaster.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/techyStuffGuardrails.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/themePalette.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/upgradeGate.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |
| `src/domain/woolFiber.ts` | Domain-specific business logic, catalog, or Alpha 2 compatibility facade. |

### Application Composition & Configs (`src/app/`, `@app/*`) (9)

| Module Path | Purpose / Notes |
| --- | --- |
| `src/app/animalCsvConfig.ts` | Application-level species/domain configuration or dependency-injection wiring. |
| `src/app/animalProfileSchema.ts` | Application-level species/domain configuration or dependency-injection wiring. |
| `src/app/appConfig.interface.ts` | Application-level species/domain configuration or dependency-injection wiring. |
| `src/app/index.ts` | Application-level species/domain configuration or dependency-injection wiring. |
| `src/app/pedigreeAppConfig.ts` | Application-level species/domain configuration or dependency-injection wiring. |
| `src/app/pedigreeAppWiring.ts` | Sole composition root wiring content-agnostic `@engine/*` + `@features/*` to Community Pedigree domain modules. |
| `src/app/pedigreeCalendarClient.ts` | Application-level species/domain configuration or dependency-injection wiring. |
| `src/app/pedigreePdfActions.ts` | Application-level species/domain configuration or dependency-injection wiring. |
| `src/app/PlatformBridgeContext.tsx` | Application-level species/domain configuration or dependency-injection wiring. |

### Content-Bound Storage Adapters & Workers (`src/storage/`) (27)

| Module Path | Purpose / Notes |
| --- | --- |
| `src/storage/archiveAndImport.worker.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/backgroundFreezeCoordinator.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/capturedIdeasStore.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/cloudAppFolderSync.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/crashLogger.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/deviceCapabilityDetector.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/feedTagOcr.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/localSyncChannels.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/offThreadWorkerClient.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/opfsStorage.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/opfsTempStream.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/p2pLanChannel.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/passphraseCrypto.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/pedigreeOcrScanner.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/photoHydration.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/pwaUpdateManager.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/sqliteIdbPersistence.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/sqliteRowMappers.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/sqliteRowWriters.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/sqliteSchema.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/storageAdapter.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/storageProbes.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/storageProtection.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/vetDocsFolder.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/weatherForecast.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/webImageOptimizer.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |
| `src/storage/webSqliteAdapter.ts` | Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target). |

### Content-Specific Native Shell Bridge (`src/native/`) (1)

| Module Path | Purpose / Notes |
| --- | --- |
| `src/native/pedigreeBridge.ts` | Content-specific native Android/iOS WebView container bridge (`pedigreeNative`), consumed via `@engine/bridge` contracts. |

### Content-Specific State Controller Hook (`src/hooks/`) (18)

| Module Path | Purpose / Notes |
| --- | --- |
| `src/hooks/barnStore/backupReminder.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/photoCacheBudget.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/restoreOrchestrator.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/storeFacades.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/storePorts.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/useAlertDismissals.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/useAnimalsCrud.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/useBackupReminderActions.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/useBreeding.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/useCloudSyncActions.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/useOpfsArchiveOffload.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/useOpfsVaultActions.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/usePhotoCache.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/usePhotoMutations.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/useRollingBackupActions.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/useSyncConflictDismissal.ts` | Content-specific application state hook. |
| `src/hooks/barnStore/useSyncConflictResolution.ts` | Content-specific application state hook. |
| `src/hooks/useBarnStore.ts` | Content-specific Zustand/React barn state store orchestrating species isolation, breeding chore cascades, and persistence. |

### Content-Specific UI Screens & Modals (`src/components/`) (53)

| Module Path | Purpose / Notes |
| --- | --- |
| `src/components/AboutModal.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/AnimalEditorModal.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/AnimalPhotoGallery.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/ArchivedHerdsModal.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/AsyncErrorToastHost.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/BarnBenchScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/BarnJournalScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/BarnSchedulerGantt.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/BreedingCalendarPanel.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/BreedingScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/CalendarIntegrationModals.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/CarrierTraitCombobox.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/ClientCrmScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/CloudAppFolderSyncPanel.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/CoatExplorerSandbox.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/ColoredGenotypeDisplay.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/ColorGeneticsNotice.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/CrashErrorBoundary.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/DeviceCapabilityCard.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/DiagnosticsAndSupportPanel.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/EconomicsLedgerScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/ExternalImporterPanel.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/FacilityPenBoard.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/FeedLedgerScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/FounderAndHeritabilityPanel.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/GrowthAndSurvivalLab.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/HealthReferencePanel.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/HelpDocumentationModal.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/HerdScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/HomeSpeciesScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/ImageCompressionNotice.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/ImportExportHubScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/JudgeNotebookScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/MileageTaxPanel.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/PairingComparisonMatrix.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/PedigreeOcrScannerPanel.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/PedigreeScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/PrintPreviewModal.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/PromptsDirectoryScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/PWAInstallButton.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/ReportsScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/SearchableParentPicker.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/SettingsAndSyncScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/SpeciesDashboardScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/SpeciesEditorModal.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/SpeciesMemoScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/SpeciesMigrationModal.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/SuggestionsBacklogScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/TechyStuffErrorBoundary.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/TechyStuffScreen.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/UnifiedBackupVaultPanel.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/WipedStorageRecoveryModal.tsx` | Content-specific React screen, panel, or modal component. |
| `src/components/WoolHarvestPanel.tsx` | Content-specific React screen, panel, or modal component. |

### Application Entry & Root Styles (`src/*`) (3)

| Module Path | Purpose / Notes |
| --- | --- |
| `src/App.tsx` | Application root entry point or global stylesheet. |
| `src/index.css` | Application root entry point or global stylesheet. |
| `src/main.tsx` | Application root entry point or global stylesheet. |
