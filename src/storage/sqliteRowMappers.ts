/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SQLite Row-to-Domain Mappers & Numeric/Enum Sanitizers (`src/storage/sqliteRowMappers.ts`).
 */

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
  BreedingStatus,
  CageLocation,
  CareLog,
  CareLogType,
  ClientContact,
  DEFAULT_CALENDAR_SYNC_SETTINGS,
  DEFAULT_IRS_MILEAGE_RATE_CENTS,
  FeedAllocation,
  FeedAllocationTargetType,
  FeedBatch,
  JudgeAssignment,
  JudgeClubContact,
  JudgeExpense,
  LedgerEntry,
  MileageLog,
  normalizeAnimalStatus,
  normalizeBreedScheduleOverrides,
  normalizeCalendarSyncSettings,
  normalizeClientKind,
  normalizeCurrencyCode,
  normalizeFeedPurgeWindowDays,
  normalizeHousingUnitType,
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
  normalizeWeightUnit,
  normalizeWoolHarvestMethod,
  normalizeYouthOrgType,
  normalizeYouthProjectFeedLogs,
  ProcessingLog,
  reconcileCarrierTraitLists,
  ShowEvent,
  SpeciesProfile,
  TaskCategory,
  TaskPriority,
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
import { getAdjustedNowIsoUtc } from './storageProtection';

const VALID_BREEDING_STATUSES: ReadonlySet<BreedingStatus> = new Set([
  'Planned',
  'Bred',
  'Palpated Positive',
  'Born',
  'Weaned',
  'Missed',
]);

export function normalizeSqliteBreedingStatus(raw: unknown): BreedingStatus {
  const s = typeof raw === 'string' ? raw : String(raw ?? '');
  return VALID_BREEDING_STATUSES.has(s as BreedingStatus)
    ? (s as BreedingStatus)
    : 'Planned';
}

const VALID_TASK_CATEGORIES: ReadonlySet<TaskCategory> = new Set([
  'Care',
  'Palpation',
  'Nestbox',
  'Birth Check',
  'Weaning',
  'Rebreed',
  'Health',
  'Show Prep',
  'Other',
]);

export function normalizeSqliteTaskCategory(raw: unknown): TaskCategory {
  const s = typeof raw === 'string' ? raw : String(raw ?? '');
  return VALID_TASK_CATEGORIES.has(s as TaskCategory) ? (s as TaskCategory) : 'Other';
}

export function normalizeSqliteTaskPriority(raw: unknown): TaskPriority {
  if (raw === 'High' || raw === 'Normal' || raw === 'Low') {
    return raw;
  }
  return 'Normal';
}

const VALID_CARE_LOG_TYPES: ReadonlySet<CareLogType> = new Set([
  'Weight Check',
  'Show / Leg',
  'Palpation',
  'Ultrasound',
  'Health / Vet',
  'Health Score / BCS',
  'Grooming & Hoof',
  'Journal Note',
]);

export function normalizeSqliteCareLogType(raw: unknown): CareLogType {
  const s = typeof raw === 'string' ? raw : String(raw ?? '');
  return VALID_CARE_LOG_TYPES.has(s as CareLogType)
    ? (s as CareLogType)
    : 'Journal Note';
}

export type SafeParseSqliteJsonFn = <T>(
  raw: unknown,
  fallback: T,
  contextLabel: string
) => T;

export interface SqliteRowMapperContext {
  safeParseJson: SafeParseSqliteJsonFn;
  finiteNum: (raw: unknown, fallback: number) => number;
  finiteNonNeg: (raw: unknown, fallback?: number) => number;
  safeArray: <T>(val: unknown) => T[];
  getSanitizedNumericCount: () => number;
}

export function createSqliteRowMapperContext(
  safeParseJson: SafeParseSqliteJsonFn
): SqliteRowMapperContext {
  let sanitizedNumericCount = 0;
  const finiteNum = (raw: unknown, fallback: number): number => {
    if (raw === null || raw === undefined || raw === '') return fallback;
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      sanitizedNumericCount++;
      return fallback;
    }
    return num;
  };
  const finiteNonNeg = (raw: unknown, fallback = 0): number => {
    const n = finiteNum(raw, fallback);
    if (n < 0) {
      sanitizedNumericCount++;
      return fallback;
    }
    return n;
  };
  const safeArray = <T>(val: unknown): T[] => (Array.isArray(val) ? (val as T[]) : []);
  return {
    safeParseJson,
    finiteNum,
    finiteNonNeg,
    safeArray,
    getSanitizedNumericCount: () => sanitizedNumericCount,
  };
}

export function mapSettingsRow(
  sRow: Record<string, unknown> | undefined,
  ctx: SqliteRowMapperContext
): BarnSettings {
  if (!sRow) {
    return {
      id: 'barn_settings',
      barnName: 'Copper Creek Barn',
      breederName: '',
      preferredUnit: 'lbs_oz',
      currencyCode: 'USD',
      defaultSpecies: 'Rabbit',
      pinnedLandingSpecies: '',
      defaultGenerations: 3,
      themeMode: 'dark',
      imageOptimizationPreset: 'balanced',
      showHomeSummaryGrid: true,
      barnNameOnboarded: false,
      ignoredTaskIds: [],
      dismissedTaskGroupKeys: {},
      dismissedMemoAlertSignatures: {},
      speciesHubBlockOrder: {},
      includePhotoOnPedigree: false,
      calendarSync: { ...DEFAULT_CALENDAR_SYNC_SETTINGS },
      autoOffloadRetiredToOpfs: false,
      feedTagPurgeWindowDays: 60,
      enableJudgeNotebook: false,
      updatedAt: getAdjustedNowIsoUtc(),
    };
  }

  const extraSettings = sRow.extra_settings_json
    ? ctx.safeParseJson<Record<string, unknown>>(
        sRow.extra_settings_json,
        {},
        'barn_settings.extra_settings_json'
      )
    : {};
  const rawGen = Number(sRow.default_generations);
  const parsedGen: 3 | 4 | 5 | 6 =
    rawGen === 4 || rawGen === 5 || rawGen === 6 ? rawGen : 3;

  return {
    id: String(sRow.id),
    barnName: String(sRow.barn_name),
    breederName: String(sRow.breeder_name),
    preferredUnit: normalizeWeightUnit(sRow.preferred_unit, 'lbs_oz'),
    currencyCode: normalizeCurrencyCode(sRow.currency_code, 'USD'),
    defaultSpecies: String(sRow.default_species || 'Rabbit'),
    pinnedLandingSpecies: String(sRow.pinned_landing_species ?? ''),
    defaultGenerations: parsedGen,
    themeMode: sRow.theme_mode === 'dark' ? 'dark' : 'light',
    customColors: sRow.custom_colors_json
      ? ctx.safeParseJson(
          sRow.custom_colors_json,
          undefined,
          'barn_settings.custom_colors_json'
        )
      : undefined,
    imageOptimizationPreset:
      sRow.image_optimization_preset === 'compact' ||
      sRow.image_optimization_preset === 'balanced' ||
      sRow.image_optimization_preset === 'high_detail'
        ? sRow.image_optimization_preset
        : 'balanced',
    showHomeSummaryGrid:
      typeof extraSettings.showHomeSummaryGrid === 'boolean'
        ? extraSettings.showHomeSummaryGrid
        : true,
    barnNameOnboarded:
      typeof extraSettings.barnNameOnboarded === 'boolean'
        ? extraSettings.barnNameOnboarded
        : false,
    ignoredTaskIds: ctx.safeArray<string>(extraSettings.ignoredTaskIds),
    dismissedTaskGroupKeys:
      extraSettings.dismissedTaskGroupKeys &&
      typeof extraSettings.dismissedTaskGroupKeys === 'object'
        ? (extraSettings.dismissedTaskGroupKeys as Record<string, string>)
        : {},
    dismissedMemoAlertSignatures:
      extraSettings.dismissedMemoAlertSignatures &&
      typeof extraSettings.dismissedMemoAlertSignatures === 'object'
        ? (extraSettings.dismissedMemoAlertSignatures as Record<string, string>)
        : {},
    speciesHubBlockOrder:
      extraSettings.speciesHubBlockOrder &&
      typeof extraSettings.speciesHubBlockOrder === 'object'
        ? (extraSettings.speciesHubBlockOrder as BarnSettings['speciesHubBlockOrder'])
        : {},
    includePhotoOnPedigree: Boolean(extraSettings.includePhotoOnPedigree),
    breederLogoDataUrl:
      typeof extraSettings.breederLogoDataUrl === 'string'
        ? sanitizeSafeRasterImageDataUrl(extraSettings.breederLogoDataUrl) || undefined
        : undefined,
    breederEmail:
      typeof extraSettings.breederEmail === 'string' && extraSettings.breederEmail.trim()
        ? extraSettings.breederEmail.trim()
        : undefined,
    breederPhone:
      typeof extraSettings.breederPhone === 'string' && extraSettings.breederPhone.trim()
        ? extraSettings.breederPhone.trim()
        : undefined,
    breederAddress:
      typeof extraSettings.breederAddress === 'string' && extraSettings.breederAddress.trim()
        ? extraSettings.breederAddress.trim()
        : undefined,
    breederLocation:
      typeof extraSettings.breederLocation === 'string' && extraSettings.breederLocation.trim()
        ? extraSettings.breederLocation.trim()
        : undefined,
    breederZip:
      typeof extraSettings.breederZip === 'string' && extraSettings.breederZip.trim()
        ? extraSettings.breederZip.trim()
        : undefined,
    breederCountry:
      typeof extraSettings.breederCountry === 'string' && extraSettings.breederCountry.trim()
        ? extraSettings.breederCountry.trim()
        : undefined,
    breederWebsite:
      typeof extraSettings.breederWebsite === 'string' && extraSettings.breederWebsite.trim()
        ? extraSettings.breederWebsite.trim()
        : undefined,
    showcaseTagline:
      typeof extraSettings.showcaseTagline === 'string' && extraSettings.showcaseTagline.trim()
        ? extraSettings.showcaseTagline.trim()
        : undefined,
    calendarSync: normalizeCalendarSyncSettings(extraSettings.calendarSync),
    weatherForecast: normalizeWeatherForecastSettings(extraSettings.weatherForecast),
    lastBackupMeta:
      extraSettings.lastBackupMeta && typeof extraSettings.lastBackupMeta === 'object'
        ? (extraSettings.lastBackupMeta as BarnSettings['lastBackupMeta'])
        : undefined,
    backupReminderSnoozedUntilMs:
      typeof extraSettings.backupReminderSnoozedUntilMs === 'number' &&
      Number.isFinite(extraSettings.backupReminderSnoozedUntilMs)
        ? extraSettings.backupReminderSnoozedUntilMs
        : undefined,
    autoOffloadRetiredToOpfs: Boolean(extraSettings.autoOffloadRetiredToOpfs),
    feedTagPurgeWindowDays: normalizeFeedPurgeWindowDays(
      extraSettings.feedTagPurgeWindowDays,
      60
    ),
    enableJudgeNotebook: Boolean(extraSettings.enableJudgeNotebook),
    updatedAt: String(sRow.updated_at || getAdjustedNowIsoUtc()),
  };
}

export function mapSpeciesProfileRow(
  r: Record<string, unknown>,
  idx: number,
  ctx: SqliteRowMapperContext
): SpeciesProfile {
  const maturity = ctx.finiteNonNeg(r.maturity_days, 0);
  return {
    id: String(r.id),
    name: String(r.name),
    sortOrder: ctx.finiteNum(r.sort_order, idx),
    defaultAnimalPrefix: String(r.default_animal_prefix || ''),
    preferredUnit:
      r.preferred_unit === 'lbs_oz' ||
      r.preferred_unit === 'lbs' ||
      r.preferred_unit === 'grams' ||
      r.preferred_unit === 'kg'
        ? r.preferred_unit
        : undefined,
    memoText: sanitizeSpeciesMemo(r.memo_text ?? ''),
    memoUpdatedAt: String(r.memo_updated_at || ''),
    gestationDays: ctx.finiteNonNeg(r.gestation_days, 31),
    rebreedDaysAfterBirth: ctx.finiteNonNeg(r.rebreed_days_after_birth, 28),
    weanDaysAfterBirth: ctx.finiteNonNeg(r.wean_days_after_birth, 42),
    maturityDays: maturity > 0 ? maturity : undefined,
    birthEventLabel: String(r.birth_event_label),
    maleLabel: String(r.male_label),
    femaleLabel: String(r.female_label),
    offspringLabel: String(r.offspring_label),
    exampleBreeds: ctx.safeArray<string>(
      ctx.safeParseJson<string[]>(
        r.example_breeds_json || '[]',
        [],
        `species_profiles(${String(r.name)}).example_breeds_json`
      )
    ),
    milestones: ctx.safeArray(
      ctx.safeParseJson(
        r.milestones_json || '[]',
        [],
        `species_profiles(${String(r.name)}).milestones_json`
      )
    ),
    breedOverrides: normalizeBreedScheduleOverrides(
      ctx.safeArray(
        ctx.safeParseJson(
          r.breed_overrides_json || '[]',
          [],
          `species_profiles(${String(r.name)}).breed_overrides_json`
        )
      )
    ),
    targetWeightCurve: normalizeTargetWeightCurve(
      ctx.safeArray(
        ctx.safeParseJson(
          r.target_weight_curve_json || '[]',
          [],
          `species_profiles(${String(r.name)}).target_weight_curve_json`
        )
      )
    ),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapSqliteAnimalRow(
  r: Record<string, unknown>,
  safeParseJson: SafeParseSqliteJsonFn,
  finiteNonNeg?: (raw: unknown, fallback?: number) => number,
  safeArray?: <T>(val: unknown) => T[]
): Animal {
  const sanitizeNonNeg =
    finiteNonNeg ??
    ((raw: unknown, fallback = 0): number => {
      if (raw === null || raw === undefined || raw === '') return fallback;
      const num = Number(raw);
      return Number.isFinite(num) && num >= 0 ? num : fallback;
    });
  const toSafeArray =
    safeArray ?? (<T>(val: unknown): T[] => (Array.isArray(val) ? (val as T[]) : []));

  const animalLabel = String(r.name || r.id || 'unknown');
  const suspectedRaw = safeParseJson<unknown>(
    r.suspected_carrier_of_json || '[]',
    [],
    `animals(${animalLabel}).suspected_carrier_of_json`
  );
  const confirmedRaw = safeParseJson<unknown>(
    r.confirmed_carrier_of_json || '[]',
    [],
    `animals(${animalLabel}).confirmed_carrier_of_json`
  );
  const clearedRaw = safeParseJson<unknown>(
    r.cleared_carrier_of_json || '[]',
    [],
    `animals(${animalLabel}).cleared_carrier_of_json`
  );
  const carriers = reconcileCarrierTraitLists(suspectedRaw, confirmedRaw, clearedRaw);
  const rawSex = String(r.sex || 'Unknown');
  const sex: Animal['sex'] =
    rawSex === 'Male' || rawSex === 'Female' ? rawSex : 'Unknown';
  const status: Animal['status'] = normalizeAnimalStatus(
    typeof r.status === 'string' ? r.status : undefined
  );

  return {
    id: String(r.id),
    tattoo: String(r.tattoo),
    name: String(r.name),
    species: String(r.species),
    breed: String(r.breed),
    variety: String(r.variety),
    sex,
    status,
    archived: Number(r.archived) === 1,
    needsAttention: Number(r.needs_attention) === 1,
    ignoredConflicts: normalizeIgnoredConflicts(
      safeParseJson(
        r.ignored_conflicts_json || '[]',
        [],
        `animals(${animalLabel}).ignored_conflicts_json`
      )
    ),
    birthDateIso: String(r.birth_date_iso),
    weightGrams: sanitizeNonNeg(r.weight_grams, 0),
    genotype: toSafeArray(
      safeParseJson(
        r.genotype_json || '[]',
        [],
        `animals(${animalLabel}).genotype_json`
      )
    ),
    genotypeRaw: String(r.genotype_raw),
    rufusLevel: normalizeRufusLevel(r.rufus_level),
    suspectedCarrierOf: carriers.suspectedCarrierOf,
    confirmedCarrierOf: carriers.confirmedCarrierOf,
    clearedCarrierOf: carriers.clearedCarrierOf,
    registrationNumber: String(r.registration_number),
    grandChampionNumber: String(r.grand_champion_number),
    legsCount: sanitizeNonNeg(r.legs_count, 0),
    cageLocation: String(r.cage_location),
    breederName: String(r.breeder_name),
    ownerName: String(r.owner_name),
    ownershipType: normalizeOwnershipType(r.ownership_type, 'Owned'),
    culled: Number(r.culled) === 1,
    cullDateIso: String(r.cull_date_iso || ''),
    cullReason: String(r.cull_reason || ''),
    deceasedDateIso: String(r.deceased_date_iso || ''),
    deathCause: String(r.death_cause || ''),
    soldDateIso: String(r.sold_date_iso || ''),
    salePriceCents: sanitizeNonNeg(r.sale_price_cents, 0),
    purchaseCostCents: sanitizeNonNeg(r.purchase_cost_cents, 0),
    buyerName: String(r.buyer_name || ''),
    forSale:
      Number(r.for_sale) === 1 &&
      status !== 'Sold' &&
      status !== 'Deceased' &&
      status !== 'Archived' &&
      Number(r.archived) !== 1,
    askingPriceCents: sanitizeNonNeg(r.asking_price_cents, 0),
    saleNotes: String(r.sale_notes || ''),
    sireId: String(r.sire_id),
    damId: String(r.dam_id),
    notes: String(r.notes),
    offloadedArchiveKey: r.offloaded_archive_key ? String(r.offloaded_archive_key) : undefined,
    offloadedAtIso: r.offloaded_at_iso ? String(r.offloaded_at_iso) : undefined,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapAnimalPhotoRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext,
  lightweightPhotos?: boolean
): AnimalPhoto {
  return {
    id: String(r.id),
    species: String(r.species),
    animalId: String(r.animal_id),
    isPrimary: Number(r.is_primary) === 1,
    sortOrder: ctx.finiteNum(r.sort_order, 0),
    caption: String(r.caption || ''),
    originalFileName: String(r.original_file_name || ''),
    mimeType: String(r.mime_type || 'image/webp'),
    width: ctx.finiteNonNeg(r.width, 0),
    height: ctx.finiteNonNeg(r.height, 0),
    originalBytes: ctx.finiteNonNeg(r.original_bytes, 0),
    storedBytes: ctx.finiteNonNeg(r.stored_bytes, 0),
    thumbnailDataUrl: String(r.thumbnail_data_url || r.data_url || ''),
    dataUrl: lightweightPhotos ? '' : String(r.data_url || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapCageRow(r: Record<string, unknown>, ctx: SqliteRowMapperContext): CageLocation {
  const unitType = normalizeHousingUnitType(r.unit_type);
  const feedLotName = r.feed_lot_name ? String(r.feed_lot_name) : '';
  const feedStockRemaining = ctx.finiteNonNeg(r.feed_stock_remaining, 0);
  const feedStockUnit = r.feed_stock_unit ? String(r.feed_stock_unit) : '';
  const dailyRationNote = r.daily_ration_note ? String(r.daily_ration_note) : '';
  const feedLowThreshold = ctx.finiteNonNeg(r.feed_low_threshold, 0);
  const maintenanceIntervalDays = Math.round(ctx.finiteNonNeg(r.maintenance_interval_days, 0));
  const maintenanceTaskLabel = r.maintenance_task_label ? String(r.maintenance_task_label) : '';
  const lastMaintenanceDateIso = r.last_maintenance_date_iso
    ? String(r.last_maintenance_date_iso)
    : '';
  return {
    id: String(r.id),
    species: String(r.species),
    label: String(r.label),
    section: String(r.section),
    capacity: Math.max(1, ctx.finiteNonNeg(r.capacity, 1)),
    notes: String(r.notes),
    ...(unitType ? { unitType } : {}),
    ...(feedLotName ? { feedLotName } : {}),
    ...(feedStockRemaining > 0 ? { feedStockRemaining } : {}),
    ...(feedStockUnit ? { feedStockUnit } : {}),
    ...(dailyRationNote ? { dailyRationNote } : {}),
    ...(feedLowThreshold > 0 ? { feedLowThreshold } : {}),
    ...(maintenanceIntervalDays > 0 ? { maintenanceIntervalDays } : {}),
    ...(maintenanceTaskLabel ? { maintenanceTaskLabel } : {}),
    ...(lastMaintenanceDateIso ? { lastMaintenanceDateIso } : {}),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapBreedingRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): BreedingRecord {
  return {
    id: String(r.id),
    species: String(r.species),
    sireId: String(r.sire_id),
    damId: String(r.dam_id),
    sireName: String(r.sire_name),
    damName: String(r.dam_name),
    bredDateIso: String(r.bred_date_iso),
    expectedDueDateIso: String(r.expected_due_date_iso),
    actualBirthDateIso: String(r.actual_birth_date_iso),
    projectedCoiPercent: ctx.finiteNonNeg(r.projected_coi_percent, 0),
    liveCount: ctx.finiteNonNeg(r.live_count, 0),
    stillbornCount: ctx.finiteNonNeg(r.stillborn_count, 0),
    fosteredCount: ctx.finiteNonNeg(r.fostered_count, 0),
    weanedCount: ctx.finiteNonNeg(r.weaned_count, 0),
    offspringCreated: Number(r.offspring_created) === 1,
    status: normalizeSqliteBreedingStatus(r.status),
    serviceFeeCents: ctx.finiteNonNeg(r.service_fee_cents, 0),
    serviceFeeDirection: normalizeServiceFeeDirection(r.service_fee_direction),
    ultrasoundDateIso: String(r.ultrasound_date_iso || ''),
    ultrasoundResult: normalizeUltrasoundResult(r.ultrasound_result),
    ultrasoundFetalCount: ctx.finiteNonNeg(r.ultrasound_fetal_count, 0),
    ultrasoundProjectedDueIso: String(r.ultrasound_projected_due_iso || ''),
    litterWeightMilestones: normalizeLitterWeightMilestones(
      ctx.safeArray(
        ctx.safeParseJson(
          r.litter_weight_milestones_json || '[]',
          [],
          `breedings(${String(r.id)}).litter_weight_milestones_json`
        )
      )
    ),
    notes: String(r.notes),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapTaskRow(r: Record<string, unknown>): BarnTask {
  return {
    id: String(r.id),
    species: String(r.species),
    title: String(r.title),
    category: normalizeSqliteTaskCategory(r.category),
    priority: normalizeSqliteTaskPriority(r.priority),
    ...(typeof r.start_date_iso === 'string' && r.start_date_iso.trim()
      ? { startDateIso: r.start_date_iso.trim() }
      : {}),
    dueDateIso: String(r.due_date_iso),
    linkedAnimalId: String(r.linked_animal_id),
    linkedAnimalName: String(r.linked_animal_name),
    linkedBreedingId: String(r.linked_breeding_id),
    completed: Number(r.completed) === 1,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapCareLogRow(r: Record<string, unknown>, ctx: SqliteRowMapperContext): CareLog {
  return {
    id: String(r.id),
    species: String(r.species),
    animalId: String(r.animal_id),
    dateIso: String(r.date_iso),
    type: normalizeSqliteCareLogType(r.type),
    title: String(r.title),
    weightGrams: ctx.finiteNonNeg(r.weight_grams, 0),
    showLegEarned: Number(r.show_leg_earned) === 1,
    medicationName: String(r.medication_name || ''),
    dosage: String(r.dosage || ''),
    administrationRoute: String(r.administration_route || ''),
    withdrawalDays: ctx.finiteNonNeg(r.withdrawal_days, 0),
    withdrawalClearDateIso: String(r.withdrawal_clear_date_iso || ''),
    bodyConditionScore: ctx.finiteNonNeg(r.body_condition_score, 0),
    famachaScore: ctx.finiteNonNeg(r.famacha_score, 0),
    fecalEggCount: ctx.finiteNonNeg(r.fecal_egg_count, 0),
    ultrasoundResult: normalizeUltrasoundResult(r.ultrasound_result),
    ultrasoundFetalCount: ctx.finiteNonNeg(r.ultrasound_fetal_count, 0),
    notes: String(r.notes),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapShowRow(r: Record<string, unknown>, ctx: SqliteRowMapperContext): ShowEvent {
  const parsedEnteredIds = ctx.safeArray<string>(
    ctx.safeParseJson<string[]>(
      r.entered_animal_ids_json || '[]',
      [],
      `shows(${String(r.name || r.id)}).entered_animal_ids_json`
    )
  );
  const parsedResults = normalizeShowResults(
    ctx.safeParseJson<unknown[]>(
      r.results_json || '[]',
      [],
      `shows(${String(r.name || r.id)}).results_json`
    ),
    { dropEmpty: false }
  );
  return {
    id: String(r.id),
    species: String(r.species),
    name: String(r.name),
    location: String(r.location),
    sanctioningBody: String(r.sanctioning_body),
    eventDateIso: String(r.event_date_iso),
    entryDeadlineIso: String(r.entry_deadline_iso),
    enteredAnimalIds: mergeEnteredAnimalIdsWithResults(parsedEnteredIds, parsedResults),
    results: parsedResults.length > 0 ? parsedResults : undefined,
    notes: String(r.notes),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapFeedBatchRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext,
  lightweightPhotos?: boolean
): FeedBatch {
  const totalCostRaw = ctx.finiteNonNeg(r.total_cost_cents, 0);
  const proteinRaw = ctx.finiteNonNeg(r.protein_percent, 0);
  const tagPhotoDataUrl = lightweightPhotos
    ? undefined
    : r.tag_photo_data_url
      ? sanitizeSafeRasterImageDataUrl(String(r.tag_photo_data_url)) || undefined
      : undefined;
  const tagPhotoThumbnailDataUrl = r.tag_photo_thumbnail_data_url
    ? sanitizeSafeRasterImageDataUrl(String(r.tag_photo_thumbnail_data_url)) || tagPhotoDataUrl
    : tagPhotoDataUrl;
  const tagPhotoBytes = ctx.finiteNonNeg(r.tag_photo_bytes, 0);
  const tagPhotoBytesReclaimed = ctx.finiteNonNeg(r.tag_photo_bytes_reclaimed, 0);
  const ocrConf = ctx.finiteNonNeg(r.ocr_confidence, 0);
  return {
    id: String(r.id),
    species: String(r.species),
    brand: String(r.brand || ''),
    productName: String(r.product_name),
    lotNumber: String(r.lot_number || ''),
    millCode: String(r.mill_code || ''),
    manufactureDateIso: String(r.manufacture_date_iso || ''),
    purchaseDateIso: String(r.purchase_date_iso),
    bagCount: ctx.finiteNonNeg(r.bag_count, 0),
    bagWeightValue: ctx.finiteNonNeg(r.bag_weight_value, 0),
    bagWeightUnit: String(r.bag_weight_unit || 'lbs'),
    totalQuantity: ctx.finiteNonNeg(r.total_quantity, 0),
    remainingQuantity: ctx.finiteNonNeg(r.remaining_quantity, 0),
    lowStockThreshold: ctx.finiteNonNeg(r.low_stock_threshold, 0),
    ...(totalCostRaw > 0 ? { totalCostCents: Math.round(totalCostRaw) } : {}),
    supplierName: String(r.supplier_name || ''),
    ...(proteinRaw > 0 ? { proteinPercent: proteinRaw } : {}),
    notes: String(r.notes || ''),
    ...(tagPhotoDataUrl ? { tagPhotoDataUrl } : {}),
    ...(tagPhotoThumbnailDataUrl ? { tagPhotoThumbnailDataUrl } : {}),
    ...(r.tag_photo_mime_type ? { tagPhotoMimeType: String(r.tag_photo_mime_type) } : {}),
    ...(tagPhotoBytes > 0 ? { tagPhotoBytes } : {}),
    ...(r.tag_photo_captured_date_iso
      ? { tagPhotoCapturedDateIso: String(r.tag_photo_captured_date_iso) }
      : {}),
    ...(r.tag_photo_purged_at_iso
      ? { tagPhotoPurgedAtIso: String(r.tag_photo_purged_at_iso) }
      : {}),
    ...(tagPhotoBytesReclaimed > 0 ? { tagPhotoBytesReclaimed } : {}),
    ...(r.ocr_raw_text ? { ocrRawText: String(r.ocr_raw_text) } : {}),
    ...(ocrConf > 0 ? { ocrConfidence: ocrConf } : {}),
    ...(Number(r.ocr_manual_override) === 1 ? { ocrManualOverride: true } : {}),
    ...(Number(r.recall_flagged) === 1 ? { recallFlagged: true } : {}),
    ...(r.recall_note ? { recallNote: String(r.recall_note) } : {}),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapFeedAllocationRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): FeedAllocation {
  const tType = String(r.target_type || 'general');
  const targetType: FeedAllocationTargetType =
    tType === 'cage' || tType === 'litter' || tType === 'animal' ? tType : 'general';
  return {
    id: String(r.id),
    species: String(r.species),
    feedBatchId: String(r.feed_batch_id),
    targetType,
    targetId: String(r.target_id || ''),
    targetLabel: String(r.target_label || ''),
    dateIso: String(r.date_iso),
    quantity: ctx.finiteNonNeg(r.quantity, 0),
    unit: String(r.unit || 'lbs'),
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapLedgerEntryRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext,
  lightweightPhotos?: boolean
): LedgerEntry {
  const receiptPhotoDataUrl = lightweightPhotos
    ? undefined
    : r.receipt_photo_data_url
      ? sanitizeSafeRasterImageDataUrl(String(r.receipt_photo_data_url)) || undefined
      : undefined;
  const receiptPhotoThumbnailDataUrl = r.receipt_photo_thumbnail_data_url
    ? sanitizeSafeRasterImageDataUrl(String(r.receipt_photo_thumbnail_data_url)) ||
      receiptPhotoDataUrl
    : receiptPhotoDataUrl;
  const receiptPhotoBytes = ctx.finiteNonNeg(r.receipt_photo_bytes, 0);
  return {
    id: String(r.id),
    species: String(r.species),
    dateIso: String(r.date_iso || ''),
    entryType: normalizeLedgerEntryType(r.entry_type, 'expense'),
    category: normalizeLedgerCategory(r.category, 'other'),
    amountCents: Math.round(ctx.finiteNonNeg(r.amount_cents, 0)),
    title: String(r.title || ''),
    vendorOrParty: String(r.vendor_or_party || ''),
    ...(r.linked_animal_id ? { linkedAnimalId: String(r.linked_animal_id) } : {}),
    ...(r.linked_breeding_id ? { linkedBreedingId: String(r.linked_breeding_id) } : {}),
    ...(r.linked_feed_batch_id ? { linkedFeedBatchId: String(r.linked_feed_batch_id) } : {}),
    ...(r.linked_project_id ? { linkedProjectId: String(r.linked_project_id) } : {}),
    ...(receiptPhotoDataUrl ? { receiptPhotoDataUrl } : {}),
    ...(receiptPhotoThumbnailDataUrl ? { receiptPhotoThumbnailDataUrl } : {}),
    ...(r.receipt_photo_mime_type
      ? { receiptPhotoMimeType: String(r.receipt_photo_mime_type) }
      : {}),
    ...(receiptPhotoBytes > 0 ? { receiptPhotoBytes } : {}),
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapProcessingLogRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): ProcessingLog {
  const dressPctRaw = ctx.finiteNonNeg(r.dress_out_percent, 0);
  const procCostRaw = Math.round(ctx.finiteNonNeg(r.processing_cost_cents, 0));
  const meatValRaw = Math.round(ctx.finiteNonNeg(r.meat_value_cents, 0));
  const peltValRaw = Math.round(ctx.finiteNonNeg(r.pelt_value_cents, 0));
  return {
    id: String(r.id),
    species: String(r.species),
    title: String(r.title || ''),
    ...(r.linked_animal_id ? { linkedAnimalId: String(r.linked_animal_id) } : {}),
    ...(r.linked_breeding_id ? { linkedBreedingId: String(r.linked_breeding_id) } : {}),
    scheduledDateIso: String(r.scheduled_date_iso || ''),
    harvestDateIso: String(r.harvest_date_iso || ''),
    status: normalizeProcessingStatus(r.status, 'Processed'),
    animalCount: Math.max(1, Math.round(ctx.finiteNonNeg(r.animal_count, 1))),
    liveWeightGrams: Math.round(ctx.finiteNonNeg(r.live_weight_grams, 0)),
    dressedWeightGrams: Math.round(ctx.finiteNonNeg(r.dressed_weight_grams, 0)),
    ...(dressPctRaw > 0 ? { dressOutPercent: dressPctRaw } : {}),
    peltCount: Math.round(ctx.finiteNonNeg(r.pelt_count, 0)),
    peltGrade: normalizePeltGrade(r.pelt_grade),
    peltColorNotes: String(r.pelt_color_notes || ''),
    ...(procCostRaw > 0 ? { processingCostCents: procCostRaw } : {}),
    ...(meatValRaw > 0 ? { meatValueCents: meatValRaw } : {}),
    ...(peltValRaw > 0 ? { peltValueCents: peltValRaw } : {}),
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapYouthProjectBookRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): YouthProjectBook {
  const linkedAnimalIds = ctx.safeArray<string>(
    ctx.safeParseJson<string[]>(
      r.linked_animal_ids_json || '[]',
      [],
      `youth_project_books(${String(r.id)}).linked_animal_ids_json`
    )
  );
  const linkedBreedingIds = ctx.safeArray<string>(
    ctx.safeParseJson<string[]>(
      r.linked_breeding_ids_json || '[]',
      [],
      `youth_project_books(${String(r.id)}).linked_breeding_ids_json`
    )
  );
  const feedLogs = normalizeYouthProjectFeedLogs(
    ctx.safeParseJson<unknown[]>(
      r.feed_logs_json || '[]',
      [],
      `youth_project_books(${String(r.id)}).feed_logs_json`
    )
  );
  return {
    id: String(r.id),
    species: String(r.species),
    organization: normalizeYouthOrgType(r.organization, '4-H'),
    projectTitle: String(r.project_title || ''),
    memberName: String(r.member_name || ''),
    clubOrChapter: String(r.club_or_chapter || ''),
    leaderOrAdvisor: String(r.leader_or_advisor || ''),
    projectYear: String(r.project_year || ''),
    startDateIso: String(r.start_date_iso || ''),
    endDateIso: String(r.end_date_iso || ''),
    status: String(r.status) === 'Completed' ? 'Completed' : 'Active',
    linkedAnimalIds,
    linkedBreedingIds,
    startingInventoryValueCents: Math.round(
      ctx.finiteNonNeg(r.starting_inventory_value_cents, 0)
    ),
    endingInventoryValueCents: Math.round(
      ctx.finiteNonNeg(r.ending_inventory_value_cents, 0)
    ),
    feedLogs,
    goalsAndReflection: String(r.goals_and_reflection || ''),
    showAndCommunityNotes: String(r.show_and_community_notes || ''),
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapClientContactRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): ClientContact {
  const tags = ctx.safeArray<string>(
    ctx.safeParseJson<string[]>(
      r.tags_json || '[]',
      [],
      `client_contacts(${String(r.id)}).tags_json`
    )
  )
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim());
  return {
    id: String(r.id),
    species: String(r.species),
    fullName: String(r.full_name || ''),
    ranchOrHerdName: String(r.ranch_or_herd_name || ''),
    email: String(r.email || ''),
    phone: String(r.phone || ''),
    preferredContact: normalizePreferredContactMethod(r.preferred_contact, 'sms'),
    clientKind: normalizeClientKind(r.client_kind, 'pet_buyer'),
    cityState: String(r.city_state || ''),
    shippingAddress: String(r.shipping_address || ''),
    tags,
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapWaitlistEntryRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): WaitlistEntry {
  const rawSex = String(r.preferred_sex || 'Any');
  const preferredSex: WaitlistEntry['preferredSex'] =
    rawSex === 'Male' || rawSex === 'Female' ? rawSex : 'Any';
  const maxBudgetRaw = Math.round(ctx.finiteNonNeg(r.max_budget_cents, 0));
  return {
    id: String(r.id),
    species: String(r.species),
    clientId: String(r.client_id || ''),
    clientName: String(r.client_name || ''),
    priorityRank: Math.max(1, Math.round(ctx.finiteNonNeg(r.priority_rank, 1))),
    status: normalizeWaitlistStatus(r.status, 'Active'),
    intent: normalizeWaitlistIntent(r.intent, 'Show / Breeding'),
    desiredBreed: String(r.desired_breed || ''),
    desiredVariety: String(r.desired_variety || ''),
    preferredSex,
    ...(r.preferred_breeding_id
      ? { preferredBreedingId: String(r.preferred_breeding_id) }
      : {}),
    requestedByDateIso: String(r.requested_by_date_iso || ''),
    inquiryDateIso: String(r.inquiry_date_iso || ''),
    followUpDateIso: String(r.follow_up_date_iso || ''),
    lastContactedDateIso: String(r.last_contacted_date_iso || ''),
    ...(maxBudgetRaw > 0 ? { maxBudgetCents: maxBudgetRaw } : {}),
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapAnimalReservationRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): AnimalReservation {
  const pickOrderRaw = Math.round(ctx.finiteNonNeg(r.pick_order, 0));
  return {
    id: String(r.id),
    species: String(r.species),
    agreementNumber: String(r.agreement_number || ''),
    clientId: String(r.client_id || ''),
    clientName: String(r.client_name || ''),
    ...(r.waitlist_entry_id ? { waitlistEntryId: String(r.waitlist_entry_id) } : {}),
    ...(r.animal_id ? { animalId: String(r.animal_id) } : {}),
    ...(r.breeding_id ? { breedingId: String(r.breeding_id) } : {}),
    ...(pickOrderRaw > 0 ? { pickOrder: pickOrderRaw } : {}),
    itemLabel: String(r.item_label || ''),
    status: normalizeReservationStatus(r.status, 'Pending Deposit'),
    reservedDateIso: String(r.reserved_date_iso || ''),
    holdExpiresDateIso: String(r.hold_expires_date_iso || ''),
    totalPriceCents: Math.round(ctx.finiteNonNeg(r.total_price_cents, 0)),
    depositRequiredCents: Math.round(ctx.finiteNonNeg(r.deposit_required_cents, 0)),
    depositPaidCents: Math.round(ctx.finiteNonNeg(r.deposit_paid_cents, 0)),
    depositDueDateIso: String(r.deposit_due_date_iso || ''),
    depositPaidDateIso: String(r.deposit_paid_date_iso || ''),
    pickupScheduledDateIso: String(r.pickup_scheduled_date_iso || ''),
    completedDateIso: String(r.completed_date_iso || ''),
    balanceReminderDateIso: String(r.balance_reminder_date_iso || ''),
    paymentMethod: String(r.payment_method || ''),
    ...(r.ledger_entry_id ? { ledgerEntryId: String(r.ledger_entry_id) } : {}),
    termsSummary: String(r.terms_summary || ''),
    healthGuaranteeNotes: String(r.health_guarantee_notes || ''),
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapWoolHarvestRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): WoolHarvest {
  const intervalRaw = Math.round(ctx.finiteNonNeg(r.shearing_interval_days, 0));
  const stapleRaw = ctx.finiteNonNeg(r.staple_length_mm, 0);
  const rawScoreJson = r.iagarb_score_json
    ? ctx.safeParseJson<Record<string, unknown> | null>(
        r.iagarb_score_json,
        null,
        `wool_harvests(${String(r.id)}).iagarb_score_json`
      )
    : null;
  const iagarbScore =
    rawScoreJson && Object.keys(rawScoreJson).length > 0
      ? normalizeIagarbScorecard(rawScoreJson)
      : undefined;
  return {
    id: String(r.id),
    species: String(r.species),
    animalId: String(r.animal_id || ''),
    harvestDateIso: String(r.harvest_date_iso || ''),
    ...(intervalRaw > 0 ? { shearingIntervalDays: intervalRaw } : {}),
    primeWeightGrams: Math.round(ctx.finiteNonNeg(r.prime_weight_grams, 0)),
    gradeWeightGrams: Math.round(ctx.finiteNonNeg(r.grade_weight_grams, 0)),
    harvestMethod: normalizeWoolHarvestMethod(r.harvest_method, 'Shear'),
    ...(stapleRaw > 0 ? { stapleLengthMm: stapleRaw } : {}),
    ...(iagarbScore ? { iagarbScore } : {}),
    witnessedBy: String(r.witnessed_by || ''),
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapMileageLogRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): MileageLog {
  const hasOdoStart =
    r.odometer_start !== null &&
    r.odometer_start !== undefined &&
    r.odometer_start !== '' &&
    Number.isFinite(Number(r.odometer_start)) &&
    Number(r.odometer_start) >= 0;
  const hasOdoEnd =
    r.odometer_end !== null &&
    r.odometer_end !== undefined &&
    r.odometer_end !== '' &&
    Number.isFinite(Number(r.odometer_end)) &&
    Number(r.odometer_end) >= 0;
  const tolls = Math.round(ctx.finiteNonNeg(r.parking_and_tolls_cents, 0));
  return {
    id: String(r.id),
    species: String(r.species),
    dateIso: String(r.date_iso || ''),
    purpose: normalizeMileageTripPurpose(r.purpose, 'Show Travel'),
    origin: String(r.origin || ''),
    destination: String(r.destination || ''),
    roundTrip: Number(r.round_trip) !== 0,
    miles: Number(ctx.finiteNonNeg(r.miles, 0).toFixed(1)),
    ...(hasOdoStart ? { odometerStart: Number(Number(r.odometer_start).toFixed(1)) } : {}),
    ...(hasOdoEnd ? { odometerEnd: Number(Number(r.odometer_end).toFixed(1)) } : {}),
    rateCentsPerMile: Math.round(
      ctx.finiteNonNeg(r.rate_cents_per_mile, DEFAULT_IRS_MILEAGE_RATE_CENTS)
    ),
    ...(tolls > 0 ? { parkingAndTollsCents: tolls } : {}),
    ...(r.linked_show_id ? { linkedShowId: String(r.linked_show_id) } : {}),
    ...(r.linked_client_id ? { linkedClientId: String(r.linked_client_id) } : {}),
    ...(r.vehicle_label ? { vehicleLabel: String(r.vehicle_label) } : {}),
    taxDeductible: Number(r.tax_deductible) !== 0,
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapJournalEntryRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): BarnJournalEntry {
  const parsedTags = r.tags_json
    ? ctx.safeParseJson<unknown[]>(r.tags_json, [], `journal_entries(${String(r.id)}).tags_json`)
    : [];
  const parsedAnimalIds = r.linked_animal_ids_json
    ? ctx.safeParseJson<unknown[]>(
        r.linked_animal_ids_json,
        [],
        `journal_entries(${String(r.id)}).linked_animal_ids_json`
      )
    : [];
  const linkedAnimalIds = Array.isArray(parsedAnimalIds)
    ? parsedAnimalIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  return {
    id: String(r.id),
    species: String(r.species),
    entryDateIso: String(r.entry_date_iso || ''),
    title: String(r.title || 'Barn Journal Entry'),
    body: sanitizeSpeciesMemo(String(r.body || '')),
    colorCategory: normalizeJournalColorCategory(r.color_category),
    starRating: normalizeJournalStarRating(r.star_rating),
    tags: normalizeJournalTags(parsedTags),
    pinned: Boolean(Number(r.pinned)),
    ...(linkedAnimalIds.length > 0 ? { linkedAnimalIds } : {}),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapJudgeClubRow(r: Record<string, unknown>): JudgeClubContact | null {
  return normalizeJudgeClubContact({
    id: String(r.id),
    species: String(r.species || 'Rabbit'),
    clubName: String(r.club_name || ''),
    sanctioningBody: String(r.sanctioning_body || 'ARBA'),
    contactPerson: String(r.contact_person || ''),
    roleTitle: String(r.role_title || ''),
    email: String(r.email || ''),
    phone: String(r.phone || ''),
    cityState: String(r.city_state || ''),
    venueName: String(r.venue_name || ''),
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  });
}

export function mapJudgeAssignmentRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): JudgeAssignment | null {
  return normalizeJudgeAssignment({
    id: String(r.id),
    species: String(r.species || 'Rabbit'),
    showName: String(r.show_name || ''),
    clubId: r.club_id ? String(r.club_id) : undefined,
    clubName: String(r.club_name || ''),
    sanctioningBody: String(r.sanctioning_body || 'ARBA'),
    showDateIso: String(r.show_date_iso || ''),
    endDateIso: String(r.end_date_iso || ''),
    location: String(r.location || ''),
    venueAddress: String(r.venue_address || ''),
    assignmentRole: String(r.assignment_role || ''),
    breedsAssigned: String(r.breeds_assigned || ''),
    bidStatus: r.bid_status,
    bidSubmittedDateIso: String(r.bid_submitted_date_iso || ''),
    bidResponseDueIso: String(r.bid_response_due_iso || ''),
    contractStatus: r.contract_status,
    contractNumber: String(r.contract_number || ''),
    contractSignedDateIso: String(r.contract_signed_date_iso || ''),
    judgingFeeCents: Math.round(ctx.finiteNonNeg(r.judging_fee_cents, 0)),
    perDiemCents: Math.round(ctx.finiteNonNeg(r.per_diem_cents, 0)),
    hotelProvided: Number(r.hotel_provided) !== 0,
    mileageReimbursementRateCents: Math.round(
      ctx.finiteNonNeg(r.mileage_reimbursement_rate_cents, DEFAULT_IRS_MILEAGE_RATE_CENTS)
    ),
    estimatedMiles: Number(ctx.finiteNonNeg(r.estimated_miles, 0).toFixed(1)),
    actualMiles: Number(ctx.finiteNonNeg(r.actual_miles, 0).toFixed(1)),
    linkedMileageLogId: r.linked_mileage_log_id ? String(r.linked_mileage_log_id) : undefined,
    feePaid: Number(r.fee_paid) !== 0,
    feePaidDateIso: String(r.fee_paid_date_iso || ''),
    contractTermsSummary: String(r.contract_terms_summary || ''),
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  });
}

export function mapJudgeExpenseRow(
  r: Record<string, unknown>,
  ctx: SqliteRowMapperContext
): JudgeExpense | null {
  return normalizeJudgeExpense({
    id: String(r.id),
    species: String(r.species || 'Rabbit'),
    assignmentId: r.assignment_id ? String(r.assignment_id) : undefined,
    dateIso: String(r.date_iso || ''),
    category: r.category,
    description: String(r.description || ''),
    vendor: String(r.vendor || ''),
    amountCents: Math.round(ctx.finiteNonNeg(r.amount_cents, 0)),
    reimbursable: Number(r.reimbursable) !== 0,
    reimbursed: Number(r.reimbursed) !== 0,
    reimbursedDateIso: String(r.reimbursed_date_iso || ''),
    taxDeductible: Number(r.tax_deductible) !== 0,
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  });
}
