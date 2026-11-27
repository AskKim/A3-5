/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SQLite Domain-to-Row Upsert Writers (`src/storage/sqliteRowWriters.ts`).
 */

import type { Database } from 'sql.js';
import { normalizeJournalTags } from '../domain/barnJournal';
import {
  normalizeJudgeAssignment,
  normalizeJudgeClubContact,
  normalizeJudgeExpense,
} from '../domain/judgeNotebook';
import { sanitizeSafeRasterImageDataUrl } from '../domain/inputSanitization';
import {
  Animal,
  AnimalPhoto,
  AnimalReservation,
  BarnJournalEntry,
  BarnSettings,
  BarnTask,
  BreedingRecord,
  CageLocation,
  CareLog,
  ClientContact,
  DEFAULT_IRS_MILEAGE_RATE_CENTS,
  FeedAllocation,
  FeedBatch,
  JudgeAssignment,
  JudgeClubContact,
  JudgeExpense,
  LedgerEntry,
  MileageLog,
  normalizeBreedScheduleOverrides,
  normalizeCalendarSyncSettings,
  normalizeClientKind,
  normalizeCurrencyCode,
  normalizeFeedPurgeWindowDays,
  normalizeIgnoredConflicts,
  normalizeJournalColorCategory,
  normalizeJournalStarRating,
  normalizeLedgerCategory,
  normalizeLedgerEntryType,
  normalizeLitterWeightMilestones,
  normalizeMileageTripPurpose,
  normalizeOwnershipType,
  normalizePeltGrade,
  normalizePreferredContactMethod,
  normalizeProcessingStatus,
  normalizeReservationStatus,
  normalizeRufusLevel,
  normalizeServiceFeeDirection,
  normalizeTargetWeightCurve,
  normalizeUltrasoundResult,
  normalizeWaitlistIntent,
  normalizeWaitlistStatus,
  normalizeWeatherForecastSettings,
  normalizeWoolHarvestMethod,
  normalizeYouthOrgType,
  normalizeYouthProjectFeedLogs,
  ProcessingLog,
  reconcileCarrierTraitLists,
  ShowEvent,
  SpeciesProfile,
  WaitlistEntry,
  WoolHarvest,
  YouthProjectBook,
} from '../domain/models';
import {
  mergeEnteredAnimalIdsWithResults,
  normalizeShowResults,
} from '../domain/showResults';
import { sanitizeSpeciesMemo } from '../domain/speciesMemo';
import { normalizeIagarbScorecard } from '../domain/woolFiber';

function queryExistingImageColumnValue(
  db: Database,
  table: string,
  column: string,
  id: string
): string {
  if (!id) return '';
  try {
    const stmt = db.prepare(`SELECT ${column} AS val FROM ${table} WHERE id = ? LIMIT 1`);
    try {
      stmt.bind([id]);
      if (!stmt.step()) return '';
      const row = stmt.getAsObject() as { val?: unknown };
      const raw = row.val ? String(row.val) : '';
      return raw ? sanitizeSafeRasterImageDataUrl(raw) || '' : '';
    } finally {
      stmt.free();
    }
  } catch {
    return '';
  }
}

export function upsertSettingsRow(db: Database, s: BarnSettings): void {
  const extraJson = JSON.stringify({
    showHomeSummaryGrid: s.showHomeSummaryGrid ?? true,
    barnNameOnboarded: s.barnNameOnboarded ?? false,
    ignoredTaskIds: s.ignoredTaskIds ?? [],
    dismissedTaskGroupKeys: s.dismissedTaskGroupKeys ?? {},
    dismissedMemoAlertSignatures: s.dismissedMemoAlertSignatures ?? {},
    speciesHubBlockOrder: s.speciesHubBlockOrder ?? {},
    includePhotoOnPedigree: s.includePhotoOnPedigree ?? false,
    breederLogoDataUrl: s.breederLogoDataUrl
      ? sanitizeSafeRasterImageDataUrl(s.breederLogoDataUrl) || undefined
      : undefined,
    breederEmail: s.breederEmail?.trim() || undefined,
    breederPhone: s.breederPhone?.trim() || undefined,
    breederAddress: s.breederAddress?.trim() || undefined,
    breederLocation: s.breederLocation?.trim() || undefined,
    breederZip: s.breederZip?.trim() || undefined,
    breederCountry: s.breederCountry?.trim() || undefined,
    breederWebsite: s.breederWebsite?.trim() || undefined,
    showcaseTagline: s.showcaseTagline?.trim() || undefined,
    calendarSync: s.calendarSync ? normalizeCalendarSyncSettings(s.calendarSync) : undefined,
    weatherForecast: s.weatherForecast
      ? normalizeWeatherForecastSettings(s.weatherForecast)
      : undefined,
    lastBackupMeta: s.lastBackupMeta ?? undefined,
    backupReminderSnoozedUntilMs: s.backupReminderSnoozedUntilMs ?? undefined,
    autoOffloadRetiredToOpfs: Boolean(s.autoOffloadRetiredToOpfs),
    feedTagPurgeWindowDays: normalizeFeedPurgeWindowDays(s.feedTagPurgeWindowDays, 60),
    enableJudgeNotebook: Boolean(s.enableJudgeNotebook),
  });
  db.run(
    `INSERT OR REPLACE INTO barn_settings
     (id, barn_name, breeder_name, preferred_unit, currency_code, default_species, pinned_landing_species, default_generations, theme_mode, custom_colors_json, image_optimization_preset, extra_settings_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.id || 'barn_settings',
      s.barnName,
      s.breederName,
      s.preferredUnit,
      normalizeCurrencyCode(s.currencyCode, 'USD'),
      s.defaultSpecies,
      s.pinnedLandingSpecies,
      s.defaultGenerations,
      s.themeMode,
      JSON.stringify(s.customColors || {}),
      s.imageOptimizationPreset || 'balanced',
      extraJson,
      s.updatedAt,
    ]
  );
}

export function upsertSpeciesRow(db: Database, sp: SpeciesProfile): void {
  db.run(
    `INSERT OR REPLACE INTO species_profiles
     (id, name, sort_order, default_animal_prefix, preferred_unit, memo_text, memo_updated_at, gestation_days, rebreed_days_after_birth, wean_days_after_birth, maturity_days, birth_event_label, male_label, female_label, offspring_label, example_breeds_json, milestones_json, breed_overrides_json, target_weight_curve_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sp.id,
      sp.name,
      sp.sortOrder ?? 0,
      sp.defaultAnimalPrefix || '',
      sp.preferredUnit || '',
      sanitizeSpeciesMemo(sp.memoText ?? ''),
      String(sp.memoUpdatedAt || ''),
      sp.gestationDays,
      sp.rebreedDaysAfterBirth,
      sp.weanDaysAfterBirth,
      sp.maturityDays && sp.maturityDays > 0 ? Math.round(sp.maturityDays) : 0,
      sp.birthEventLabel,
      sp.maleLabel,
      sp.femaleLabel,
      sp.offspringLabel,
      JSON.stringify(sp.exampleBreeds),
      JSON.stringify(sp.milestones),
      JSON.stringify(normalizeBreedScheduleOverrides(sp.breedOverrides)),
      JSON.stringify(normalizeTargetWeightCurve(sp.targetWeightCurve)),
      sp.createdAt,
      sp.updatedAt,
    ]
  );
}

export function upsertAnimalRow(db: Database, a: Animal): void {
  const carriers = reconcileCarrierTraitLists(
    a.suspectedCarrierOf,
    a.confirmedCarrierOf,
    a.clearedCarrierOf
  );
  db.run(
    `INSERT OR REPLACE INTO animals
     (id, tattoo, name, species, breed, variety, sex, status, archived, needs_attention, ignored_conflicts_json, birth_date_iso, weight_grams, genotype_json, genotype_raw, rufus_level, suspected_carrier_of_json, confirmed_carrier_of_json, cleared_carrier_of_json, registration_number, grand_champion_number, legs_count, cage_location, breeder_name, owner_name, ownership_type, culled, cull_date_iso, cull_reason, deceased_date_iso, death_cause, sold_date_iso, sale_price_cents, purchase_cost_cents, buyer_name, for_sale, asking_price_cents, sale_notes, sire_id, dam_id, notes, offloaded_archive_key, offloaded_at_iso, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.id,
      a.tattoo,
      a.name,
      a.species,
      a.breed,
      a.variety,
      a.sex,
      a.status,
      a.archived ? 1 : 0,
      a.needsAttention ? 1 : 0,
      JSON.stringify(normalizeIgnoredConflicts(a.ignoredConflicts)),
      a.birthDateIso,
      a.weightGrams,
      JSON.stringify(a.genotype),
      a.genotypeRaw,
      normalizeRufusLevel(a.rufusLevel),
      JSON.stringify(carriers.suspectedCarrierOf),
      JSON.stringify(carriers.confirmedCarrierOf),
      JSON.stringify(carriers.clearedCarrierOf),
      a.registrationNumber,
      a.grandChampionNumber,
      a.legsCount,
      a.cageLocation,
      a.breederName,
      a.ownerName,
      normalizeOwnershipType(a.ownershipType, 'Owned'),
      a.culled ? 1 : 0,
      a.cullDateIso || '',
      a.cullReason || '',
      a.deceasedDateIso || '',
      a.deathCause || '',
      a.soldDateIso || '',
      a.salePriceCents && a.salePriceCents > 0 ? Math.round(a.salePriceCents) : 0,
      a.purchaseCostCents && a.purchaseCostCents > 0 ? Math.round(a.purchaseCostCents) : 0,
      a.buyerName || '',
      a.forSale &&
      a.status !== 'Sold' &&
      a.status !== 'Deceased' &&
      a.status !== 'Archived' &&
      !a.archived
        ? 1
        : 0,
      a.askingPriceCents && a.askingPriceCents > 0 ? Math.round(a.askingPriceCents) : 0,
      a.saleNotes || '',
      a.sireId,
      a.damId,
      a.notes,
      a.offloadedArchiveKey || '',
      a.offloadedAtIso || '',
      a.createdAt,
      a.updatedAt,
    ]
  );
}

export function upsertAnimalPhotoRow(db: Database, p: AnimalPhoto): void {
  let resolvedDataUrl = p.dataUrl;
  if (!resolvedDataUrl) {
    const stmt = db.prepare('SELECT data_url FROM animal_photos WHERE id = ? LIMIT 1');
    try {
      stmt.bind([p.id]);
      if (stmt.step()) {
        const existing = stmt.getAsObject() as { data_url?: unknown };
        resolvedDataUrl = String(existing.data_url || '');
      }
    } finally {
      stmt.free();
    }
  }
  db.run(
    `INSERT OR REPLACE INTO animal_photos
     (id, species, animal_id, is_primary, sort_order, caption, original_file_name, mime_type, width, height, original_bytes, stored_bytes, thumbnail_data_url, data_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id,
      p.species,
      p.animalId,
      p.isPrimary ? 1 : 0,
      p.sortOrder,
      p.caption,
      p.originalFileName,
      p.mimeType,
      p.width,
      p.height,
      p.originalBytes,
      p.storedBytes,
      p.thumbnailDataUrl,
      resolvedDataUrl,
      p.createdAt,
      p.updatedAt,
    ]
  );
}

export function upsertCageRow(db: Database, c: CageLocation): void {
  db.run(
    `INSERT OR REPLACE INTO cages
     (id, species, label, section, capacity, notes, unit_type, feed_lot_name, feed_stock_remaining, feed_stock_unit, daily_ration_note, feed_low_threshold, maintenance_interval_days, maintenance_task_label, last_maintenance_date_iso, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.id,
      c.species,
      c.label,
      c.section,
      c.capacity,
      c.notes,
      c.unitType || '',
      c.feedLotName || '',
      Number.isFinite(Number(c.feedStockRemaining)) && Number(c.feedStockRemaining) > 0
        ? Number(c.feedStockRemaining)
        : 0,
      c.feedStockUnit || '',
      c.dailyRationNote || '',
      Number.isFinite(Number(c.feedLowThreshold)) && Number(c.feedLowThreshold) > 0
        ? Number(c.feedLowThreshold)
        : 0,
      Number.isFinite(Number(c.maintenanceIntervalDays)) && Number(c.maintenanceIntervalDays) > 0
        ? Math.round(Number(c.maintenanceIntervalDays))
        : 0,
      c.maintenanceTaskLabel || '',
      c.lastMaintenanceDateIso || '',
      c.createdAt,
      c.updatedAt,
    ]
  );
}

export function upsertBreedingRow(db: Database, b: BreedingRecord): void {
  db.run(
    `INSERT OR REPLACE INTO breedings
     (id, species, sire_id, dam_id, sire_name, dam_name, bred_date_iso, expected_due_date_iso, actual_birth_date_iso, projected_coi_percent, live_count, stillborn_count, fostered_count, weaned_count, offspring_created, status, service_fee_cents, service_fee_direction, ultrasound_date_iso, ultrasound_result, ultrasound_fetal_count, ultrasound_projected_due_iso, litter_weight_milestones_json, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.id,
      b.species,
      b.sireId,
      b.damId,
      b.sireName,
      b.damName,
      b.bredDateIso,
      b.expectedDueDateIso,
      b.actualBirthDateIso,
      b.projectedCoiPercent,
      b.liveCount,
      b.stillbornCount,
      b.fosteredCount,
      b.weanedCount,
      b.offspringCreated ? 1 : 0,
      b.status,
      b.serviceFeeCents && b.serviceFeeCents > 0 ? Math.round(b.serviceFeeCents) : 0,
      normalizeServiceFeeDirection(b.serviceFeeDirection),
      b.ultrasoundDateIso || '',
      normalizeUltrasoundResult(b.ultrasoundResult),
      b.ultrasoundFetalCount && b.ultrasoundFetalCount > 0
        ? Math.round(b.ultrasoundFetalCount)
        : 0,
      b.ultrasoundProjectedDueIso || '',
      JSON.stringify(normalizeLitterWeightMilestones(b.litterWeightMilestones)),
      b.notes,
      b.createdAt,
      b.updatedAt,
    ]
  );
}

export function upsertTaskRow(db: Database, t: BarnTask): void {
  db.run(
    `INSERT OR REPLACE INTO barn_tasks
     (id, species, title, category, priority, start_date_iso, due_date_iso, linked_animal_id, linked_animal_name, linked_breeding_id, completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.id,
      t.species,
      t.title,
      t.category,
      t.priority,
      t.startDateIso || '',
      t.dueDateIso,
      t.linkedAnimalId,
      t.linkedAnimalName,
      t.linkedBreedingId,
      t.completed ? 1 : 0,
      t.createdAt,
      t.updatedAt,
    ]
  );
}

export function upsertCareLogRow(db: Database, l: CareLog): void {
  db.run(
    `INSERT OR REPLACE INTO care_logs
     (id, species, animal_id, date_iso, type, title, weight_grams, show_leg_earned, medication_name, dosage, administration_route, withdrawal_days, withdrawal_clear_date_iso, body_condition_score, famacha_score, fecal_egg_count, ultrasound_result, ultrasound_fetal_count, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      l.id,
      l.species,
      l.animalId,
      l.dateIso,
      l.type,
      l.title,
      l.weightGrams,
      l.showLegEarned ? 1 : 0,
      l.medicationName || '',
      l.dosage || '',
      l.administrationRoute || '',
      l.withdrawalDays && l.withdrawalDays > 0 ? Math.round(l.withdrawalDays) : 0,
      l.withdrawalClearDateIso || '',
      l.bodyConditionScore && l.bodyConditionScore > 0 ? Number(l.bodyConditionScore) : 0,
      l.famachaScore && l.famachaScore > 0 ? Math.round(l.famachaScore) : 0,
      l.fecalEggCount && l.fecalEggCount > 0 ? Math.round(l.fecalEggCount) : 0,
      normalizeUltrasoundResult(l.ultrasoundResult),
      l.ultrasoundFetalCount && l.ultrasoundFetalCount > 0
        ? Math.round(l.ultrasoundFetalCount)
        : 0,
      l.notes,
      l.createdAt,
      l.updatedAt,
    ]
  );
}

export function upsertShowRow(db: Database, s: ShowEvent): void {
  const cleanResults = normalizeShowResults(s.results ?? [], { dropEmpty: false });
  const syncedEnteredIds = mergeEnteredAnimalIdsWithResults(s.enteredAnimalIds ?? [], cleanResults);
  db.run(
    `INSERT OR REPLACE INTO shows
     (id, species, name, location, sanctioning_body, event_date_iso, entry_deadline_iso, entered_animal_ids_json, results_json, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.id,
      s.species,
      s.name,
      s.location,
      s.sanctioningBody,
      s.eventDateIso,
      s.entryDeadlineIso,
      JSON.stringify(syncedEnteredIds),
      JSON.stringify(cleanResults),
      s.notes,
      s.createdAt,
      s.updatedAt,
    ]
  );
}

export function upsertFeedBatchRow(db: Database, f: FeedBatch): void {
  let safePhoto = f.tagPhotoDataUrl
    ? sanitizeSafeRasterImageDataUrl(f.tagPhotoDataUrl) || ''
    : '';
  const safeThumb = f.tagPhotoThumbnailDataUrl
    ? sanitizeSafeRasterImageDataUrl(f.tagPhotoThumbnailDataUrl) || safePhoto
    : safePhoto;
  // Preserve full-resolution tag photo in SQLite when caller saved a lightweight-hydrated row
  if (!safePhoto && safeThumb && !f.tagPhotoPurgedAtIso) {
    safePhoto = queryExistingImageColumnValue(db, 'feed_batches', 'tag_photo_data_url', f.id);
  }
  db.run(
    `INSERT OR REPLACE INTO feed_batches
     (id, species, brand, product_name, lot_number, mill_code, manufacture_date_iso, purchase_date_iso, bag_count, bag_weight_value, bag_weight_unit, total_quantity, remaining_quantity, low_stock_threshold, total_cost_cents, supplier_name, protein_percent, notes, tag_photo_data_url, tag_photo_thumbnail_data_url, tag_photo_mime_type, tag_photo_bytes, tag_photo_captured_date_iso, tag_photo_purged_at_iso, tag_photo_bytes_reclaimed, ocr_raw_text, ocr_confidence, ocr_manual_override, recall_flagged, recall_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      f.id,
      f.species,
      f.brand || '',
      f.productName,
      f.lotNumber || '',
      f.millCode || '',
      f.manufactureDateIso || '',
      f.purchaseDateIso,
      Number.isFinite(Number(f.bagCount)) && Number(f.bagCount) >= 0 ? Number(f.bagCount) : 0,
      Number.isFinite(Number(f.bagWeightValue)) && Number(f.bagWeightValue) >= 0
        ? Number(f.bagWeightValue)
        : 0,
      f.bagWeightUnit || 'lbs',
      Number.isFinite(Number(f.totalQuantity)) && Number(f.totalQuantity) >= 0
        ? Number(f.totalQuantity)
        : 0,
      Number.isFinite(Number(f.remainingQuantity)) && Number(f.remainingQuantity) >= 0
        ? Number(f.remainingQuantity)
        : 0,
      Number.isFinite(Number(f.lowStockThreshold)) && Number(f.lowStockThreshold) >= 0
        ? Number(f.lowStockThreshold)
        : 0,
      f.totalCostCents && f.totalCostCents > 0 ? Math.round(f.totalCostCents) : 0,
      f.supplierName || '',
      f.proteinPercent && f.proteinPercent > 0 ? Number(f.proteinPercent) : 0,
      f.notes || '',
      safePhoto,
      safeThumb,
      f.tagPhotoMimeType || '',
      f.tagPhotoBytes && f.tagPhotoBytes > 0 ? Math.round(f.tagPhotoBytes) : 0,
      f.tagPhotoCapturedDateIso || '',
      f.tagPhotoPurgedAtIso || '',
      f.tagPhotoBytesReclaimed && f.tagPhotoBytesReclaimed > 0
        ? Math.round(f.tagPhotoBytesReclaimed)
        : 0,
      f.ocrRawText || '',
      f.ocrConfidence && f.ocrConfidence > 0 ? Number(f.ocrConfidence) : 0,
      f.ocrManualOverride ? 1 : 0,
      f.recallFlagged ? 1 : 0,
      f.recallNote || '',
      f.createdAt,
      f.updatedAt,
    ]
  );
}

export function upsertFeedAllocationRow(db: Database, fa: FeedAllocation): void {
  db.run(
    `INSERT OR REPLACE INTO feed_allocations
     (id, species, feed_batch_id, target_type, target_id, target_label, date_iso, quantity, unit, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fa.id,
      fa.species,
      fa.feedBatchId,
      fa.targetType,
      fa.targetId || '',
      fa.targetLabel || '',
      fa.dateIso,
      Number.isFinite(Number(fa.quantity)) && Number(fa.quantity) >= 0 ? Number(fa.quantity) : 0,
      fa.unit || 'lbs',
      fa.notes || '',
      fa.createdAt,
      fa.updatedAt,
    ]
  );
}

export function upsertLedgerEntryRow(db: Database, le: LedgerEntry): void {
  let safePhoto = le.receiptPhotoDataUrl
    ? sanitizeSafeRasterImageDataUrl(le.receiptPhotoDataUrl) || ''
    : '';
  const safeThumb = le.receiptPhotoThumbnailDataUrl
    ? sanitizeSafeRasterImageDataUrl(le.receiptPhotoThumbnailDataUrl) || safePhoto
    : safePhoto;
  // Preserve full-resolution receipt photo in SQLite when caller saved a lightweight-hydrated row
  if (!safePhoto && safeThumb) {
    safePhoto = queryExistingImageColumnValue(db, 'ledger_entries', 'receipt_photo_data_url', le.id);
  }
  db.run(
    `INSERT OR REPLACE INTO ledger_entries
     (id, species, date_iso, entry_type, category, amount_cents, title, vendor_or_party, linked_animal_id, linked_breeding_id, linked_feed_batch_id, linked_project_id, receipt_photo_data_url, receipt_photo_thumbnail_data_url, receipt_photo_mime_type, receipt_photo_bytes, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      le.id,
      le.species,
      le.dateIso || '',
      normalizeLedgerEntryType(le.entryType, 'expense'),
      normalizeLedgerCategory(le.category, 'other'),
      Number.isFinite(Number(le.amountCents)) && Number(le.amountCents) >= 0
        ? Math.round(Number(le.amountCents))
        : 0,
      le.title || '',
      le.vendorOrParty || '',
      le.linkedAnimalId || '',
      le.linkedBreedingId || '',
      le.linkedFeedBatchId || '',
      le.linkedProjectId || '',
      safePhoto,
      safeThumb,
      le.receiptPhotoMimeType || '',
      le.receiptPhotoBytes && le.receiptPhotoBytes > 0 ? Math.round(le.receiptPhotoBytes) : 0,
      le.notes || '',
      le.createdAt,
      le.updatedAt,
    ]
  );
}

export function upsertProcessingLogRow(db: Database, pl: ProcessingLog): void {
  db.run(
    `INSERT OR REPLACE INTO processing_logs
     (id, species, title, linked_animal_id, linked_breeding_id, scheduled_date_iso, harvest_date_iso, status, animal_count, live_weight_grams, dressed_weight_grams, dress_out_percent, pelt_count, pelt_grade, pelt_color_notes, processing_cost_cents, meat_value_cents, pelt_value_cents, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pl.id,
      pl.species,
      pl.title || '',
      pl.linkedAnimalId || '',
      pl.linkedBreedingId || '',
      pl.scheduledDateIso || '',
      pl.harvestDateIso || '',
      normalizeProcessingStatus(pl.status, 'Processed'),
      Number.isFinite(Number(pl.animalCount)) && Number(pl.animalCount) >= 1
        ? Math.round(Number(pl.animalCount))
        : 1,
      Number.isFinite(Number(pl.liveWeightGrams)) && Number(pl.liveWeightGrams) >= 0
        ? Math.round(Number(pl.liveWeightGrams))
        : 0,
      Number.isFinite(Number(pl.dressedWeightGrams)) && Number(pl.dressedWeightGrams) >= 0
        ? Math.round(Number(pl.dressedWeightGrams))
        : 0,
      typeof pl.dressOutPercent === 'number' &&
      Number.isFinite(pl.dressOutPercent) &&
      pl.dressOutPercent > 0
        ? pl.dressOutPercent
        : 0,
      Number.isFinite(Number(pl.peltCount)) && Number(pl.peltCount) >= 0
        ? Math.round(Number(pl.peltCount))
        : 0,
      normalizePeltGrade(pl.peltGrade),
      pl.peltColorNotes || '',
      pl.processingCostCents && pl.processingCostCents > 0
        ? Math.round(pl.processingCostCents)
        : 0,
      pl.meatValueCents && pl.meatValueCents > 0 ? Math.round(pl.meatValueCents) : 0,
      pl.peltValueCents && pl.peltValueCents > 0 ? Math.round(pl.peltValueCents) : 0,
      pl.notes || '',
      pl.createdAt,
      pl.updatedAt,
    ]
  );
}

export function upsertYouthProjectBookRow(db: Database, yp: YouthProjectBook): void {
  db.run(
    `INSERT OR REPLACE INTO youth_project_books
     (id, species, organization, project_title, member_name, club_or_chapter, leader_or_advisor, project_year, start_date_iso, end_date_iso, status, linked_animal_ids_json, linked_breeding_ids_json, starting_inventory_value_cents, ending_inventory_value_cents, feed_logs_json, goals_and_reflection, show_and_community_notes, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      yp.id,
      yp.species,
      normalizeYouthOrgType(yp.organization, '4-H'),
      yp.projectTitle || '',
      yp.memberName || '',
      yp.clubOrChapter || '',
      yp.leaderOrAdvisor || '',
      yp.projectYear || '',
      yp.startDateIso || '',
      yp.endDateIso || '',
      yp.status === 'Completed' ? 'Completed' : 'Active',
      JSON.stringify(Array.isArray(yp.linkedAnimalIds) ? yp.linkedAnimalIds : []),
      JSON.stringify(Array.isArray(yp.linkedBreedingIds) ? yp.linkedBreedingIds : []),
      Number.isFinite(Number(yp.startingInventoryValueCents)) &&
      Number(yp.startingInventoryValueCents) >= 0
        ? Math.round(Number(yp.startingInventoryValueCents))
        : 0,
      Number.isFinite(Number(yp.endingInventoryValueCents)) &&
      Number(yp.endingInventoryValueCents) >= 0
        ? Math.round(Number(yp.endingInventoryValueCents))
        : 0,
      JSON.stringify(normalizeYouthProjectFeedLogs(yp.feedLogs)),
      yp.goalsAndReflection || '',
      yp.showAndCommunityNotes || '',
      yp.notes || '',
      yp.createdAt,
      yp.updatedAt,
    ]
  );
}

export function upsertClientContactRow(db: Database, cc: ClientContact): void {
  db.run(
    `INSERT OR REPLACE INTO client_contacts
     (id, species, full_name, ranch_or_herd_name, email, phone, preferred_contact, client_kind, city_state, shipping_address, tags_json, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cc.id,
      cc.species,
      cc.fullName || '',
      cc.ranchOrHerdName || '',
      cc.email || '',
      cc.phone || '',
      normalizePreferredContactMethod(cc.preferredContact, 'sms'),
      normalizeClientKind(cc.clientKind, 'pet_buyer'),
      cc.cityState || '',
      cc.shippingAddress || '',
      JSON.stringify(Array.isArray(cc.tags) ? cc.tags : []),
      cc.notes || '',
      cc.createdAt,
      cc.updatedAt,
    ]
  );
}

export function upsertWaitlistEntryRow(db: Database, wl: WaitlistEntry): void {
  const cleanSex =
    wl.preferredSex === 'Male' || wl.preferredSex === 'Female' ? wl.preferredSex : 'Any';
  db.run(
    `INSERT OR REPLACE INTO waitlist_entries
     (id, species, client_id, client_name, priority_rank, status, intent, desired_breed, desired_variety, preferred_sex, preferred_breeding_id, requested_by_date_iso, inquiry_date_iso, follow_up_date_iso, last_contacted_date_iso, max_budget_cents, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      wl.id,
      wl.species,
      wl.clientId || '',
      wl.clientName || '',
      Number.isFinite(Number(wl.priorityRank)) && Number(wl.priorityRank) >= 1
        ? Math.round(Number(wl.priorityRank))
        : 1,
      normalizeWaitlistStatus(wl.status, 'Active'),
      normalizeWaitlistIntent(wl.intent, 'Show / Breeding'),
      wl.desiredBreed || '',
      wl.desiredVariety || '',
      cleanSex,
      wl.preferredBreedingId || '',
      wl.requestedByDateIso || '',
      wl.inquiryDateIso || '',
      wl.followUpDateIso || '',
      wl.lastContactedDateIso || '',
      wl.maxBudgetCents && wl.maxBudgetCents > 0 ? Math.round(wl.maxBudgetCents) : 0,
      wl.notes || '',
      wl.createdAt,
      wl.updatedAt,
    ]
  );
}

export function upsertAnimalReservationRow(db: Database, ar: AnimalReservation): void {
  db.run(
    `INSERT OR REPLACE INTO animal_reservations
     (id, species, agreement_number, client_id, client_name, waitlist_entry_id, animal_id, breeding_id, pick_order, item_label, status, reserved_date_iso, hold_expires_date_iso, total_price_cents, deposit_required_cents, deposit_paid_cents, deposit_due_date_iso, deposit_paid_date_iso, pickup_scheduled_date_iso, completed_date_iso, balance_reminder_date_iso, payment_method, ledger_entry_id, terms_summary, health_guarantee_notes, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ar.id,
      ar.species,
      ar.agreementNumber || '',
      ar.clientId || '',
      ar.clientName || '',
      ar.waitlistEntryId || '',
      ar.animalId || '',
      ar.breedingId || '',
      ar.pickOrder && ar.pickOrder > 0 ? Math.round(ar.pickOrder) : 0,
      ar.itemLabel || '',
      normalizeReservationStatus(ar.status, 'Pending Deposit'),
      ar.reservedDateIso || '',
      ar.holdExpiresDateIso || '',
      Number.isFinite(Number(ar.totalPriceCents)) && Number(ar.totalPriceCents) >= 0
        ? Math.round(Number(ar.totalPriceCents))
        : 0,
      Number.isFinite(Number(ar.depositRequiredCents)) && Number(ar.depositRequiredCents) >= 0
        ? Math.round(Number(ar.depositRequiredCents))
        : 0,
      Number.isFinite(Number(ar.depositPaidCents)) && Number(ar.depositPaidCents) >= 0
        ? Math.round(Number(ar.depositPaidCents))
        : 0,
      ar.depositDueDateIso || '',
      ar.depositPaidDateIso || '',
      ar.pickupScheduledDateIso || '',
      ar.completedDateIso || '',
      ar.balanceReminderDateIso || '',
      ar.paymentMethod || '',
      ar.ledgerEntryId || '',
      ar.termsSummary || '',
      ar.healthGuaranteeNotes || '',
      ar.notes || '',
      ar.createdAt,
      ar.updatedAt,
    ]
  );
}

export function upsertWoolHarvestRow(db: Database, wh: WoolHarvest): void {
  const interval =
    typeof wh.shearingIntervalDays === 'number' &&
    Number.isFinite(wh.shearingIntervalDays) &&
    wh.shearingIntervalDays > 0
      ? Math.round(wh.shearingIntervalDays)
      : 0;
  const staple =
    typeof wh.stapleLengthMm === 'number' &&
    Number.isFinite(wh.stapleLengthMm) &&
    wh.stapleLengthMm > 0
      ? wh.stapleLengthMm
      : 0;
  const scoreJson = wh.iagarbScore ? JSON.stringify(normalizeIagarbScorecard(wh.iagarbScore)) : '{}';
  db.run(
    `INSERT OR REPLACE INTO wool_harvests
     (id, species, animal_id, harvest_date_iso, shearing_interval_days, prime_weight_grams, grade_weight_grams, harvest_method, staple_length_mm, iagarb_score_json, witnessed_by, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      wh.id,
      wh.species,
      wh.animalId || '',
      wh.harvestDateIso || '',
      interval,
      Number.isFinite(Number(wh.primeWeightGrams)) && Number(wh.primeWeightGrams) >= 0
        ? Math.round(Number(wh.primeWeightGrams))
        : 0,
      Number.isFinite(Number(wh.gradeWeightGrams)) && Number(wh.gradeWeightGrams) >= 0
        ? Math.round(Number(wh.gradeWeightGrams))
        : 0,
      normalizeWoolHarvestMethod(wh.harvestMethod, 'Shear'),
      staple,
      scoreJson,
      wh.witnessedBy || '',
      wh.notes || '',
      wh.createdAt,
      wh.updatedAt,
    ]
  );
}

export function upsertMileageLogRow(db: Database, ml: MileageLog): void {
  const milesVal =
    Number.isFinite(Number(ml.miles)) && Number(ml.miles) >= 0
      ? Number(Number(ml.miles).toFixed(1))
      : 0;
  const rateVal =
    Number.isFinite(Number(ml.rateCentsPerMile)) && Number(ml.rateCentsPerMile) >= 0
      ? Math.round(Number(ml.rateCentsPerMile))
      : DEFAULT_IRS_MILEAGE_RATE_CENTS;
  const tollsVal =
    Number.isFinite(Number(ml.parkingAndTollsCents)) && Number(ml.parkingAndTollsCents) > 0
      ? Math.round(Number(ml.parkingAndTollsCents))
      : 0;
  const odoStart =
    ml.odometerStart !== undefined &&
    ml.odometerStart !== null &&
    Number.isFinite(Number(ml.odometerStart)) &&
    Number(ml.odometerStart) >= 0
      ? Number(Number(ml.odometerStart).toFixed(1))
      : null;
  const odoEnd =
    ml.odometerEnd !== undefined &&
    ml.odometerEnd !== null &&
    Number.isFinite(Number(ml.odometerEnd)) &&
    Number(ml.odometerEnd) >= 0
      ? Number(Number(ml.odometerEnd).toFixed(1))
      : null;
  db.run(
    `INSERT OR REPLACE INTO mileage_logs
     (id, species, date_iso, purpose, origin, destination, round_trip, miles, odometer_start, odometer_end, rate_cents_per_mile, parking_and_tolls_cents, linked_show_id, linked_client_id, vehicle_label, tax_deductible, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ml.id,
      ml.species,
      ml.dateIso || '',
      normalizeMileageTripPurpose(ml.purpose, 'Show Travel'),
      ml.origin || '',
      ml.destination || '',
      ml.roundTrip ? 1 : 0,
      milesVal,
      odoStart,
      odoEnd,
      rateVal,
      tollsVal,
      ml.linkedShowId || '',
      ml.linkedClientId || '',
      ml.vehicleLabel || '',
      ml.taxDeductible !== false ? 1 : 0,
      ml.notes || '',
      ml.createdAt,
      ml.updatedAt,
    ]
  );
}

export function upsertJournalEntryRow(db: Database, je: BarnJournalEntry): void {
  db.run(
    `INSERT OR REPLACE INTO journal_entries
     (id, species, entry_date_iso, title, body, color_category, star_rating, tags_json, pinned, linked_animal_ids_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      je.id,
      je.species,
      je.entryDateIso || '',
      je.title || 'Barn Journal Entry',
      sanitizeSpeciesMemo(je.body || ''),
      normalizeJournalColorCategory(je.colorCategory),
      normalizeJournalStarRating(je.starRating),
      JSON.stringify(normalizeJournalTags(je.tags)),
      je.pinned ? 1 : 0,
      JSON.stringify(Array.isArray(je.linkedAnimalIds) ? je.linkedAnimalIds : []),
      je.createdAt,
      je.updatedAt,
    ]
  );
}

export function upsertJudgeClubRow(db: Database, jc: JudgeClubContact): void {
  const clean = normalizeJudgeClubContact(jc) ?? jc;
  db.run(
    `INSERT OR REPLACE INTO judge_clubs
     (id, species, club_name, sanctioning_body, contact_person, role_title, email, phone, city_state, venue_name, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clean.id,
      clean.species,
      clean.clubName,
      clean.sanctioningBody || 'ARBA',
      clean.contactPerson || '',
      clean.roleTitle || '',
      clean.email || '',
      clean.phone || '',
      clean.cityState || '',
      clean.venueName || '',
      clean.notes || '',
      clean.createdAt,
      clean.updatedAt,
    ]
  );
}

export function upsertJudgeAssignmentRow(db: Database, ja: JudgeAssignment): void {
  const clean = normalizeJudgeAssignment(ja) ?? ja;
  db.run(
    `INSERT OR REPLACE INTO judge_assignments
     (id, species, show_name, club_id, club_name, sanctioning_body, show_date_iso, end_date_iso, location, venue_address, assignment_role, breeds_assigned, bid_status, bid_submitted_date_iso, bid_response_due_iso, contract_status, contract_number, contract_signed_date_iso, judging_fee_cents, per_diem_cents, hotel_provided, mileage_reimbursement_rate_cents, estimated_miles, actual_miles, linked_mileage_log_id, fee_paid, fee_paid_date_iso, contract_terms_summary, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clean.id,
      clean.species,
      clean.showName,
      clean.clubId || '',
      clean.clubName || '',
      clean.sanctioningBody || 'ARBA',
      clean.showDateIso || '',
      clean.endDateIso || '',
      clean.location || '',
      clean.venueAddress || '',
      clean.assignmentRole || '',
      clean.breedsAssigned || '',
      clean.bidStatus,
      clean.bidSubmittedDateIso || '',
      clean.bidResponseDueIso || '',
      clean.contractStatus,
      clean.contractNumber || '',
      clean.contractSignedDateIso || '',
      clean.judgingFeeCents,
      clean.perDiemCents,
      clean.hotelProvided ? 1 : 0,
      clean.mileageReimbursementRateCents,
      clean.estimatedMiles,
      clean.actualMiles,
      clean.linkedMileageLogId || '',
      clean.feePaid ? 1 : 0,
      clean.feePaidDateIso || '',
      clean.contractTermsSummary || '',
      clean.notes || '',
      clean.createdAt,
      clean.updatedAt,
    ]
  );
}

export function upsertJudgeExpenseRow(db: Database, jx: JudgeExpense): void {
  const clean = normalizeJudgeExpense(jx) ?? jx;
  db.run(
    `INSERT OR REPLACE INTO judge_expenses
     (id, species, assignment_id, date_iso, category, description, vendor, amount_cents, reimbursable, reimbursed, reimbursed_date_iso, tax_deductible, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clean.id,
      clean.species,
      clean.assignmentId || '',
      clean.dateIso || '',
      clean.category,
      clean.description,
      clean.vendor || '',
      clean.amountCents,
      clean.reimbursable ? 1 : 0,
      clean.reimbursed ? 1 : 0,
      clean.reimbursedDateIso || '',
      clean.taxDeductible ? 1 : 0,
      clean.notes || '',
      clean.createdAt,
      clean.updatedAt,
    ]
  );
}
